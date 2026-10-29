// 보잇 · 팩스 결과 알림 (Supabase Edge Function 'fax-watch') — 1분마다 DB 예약작업(pg_cron)이 부름
// 1) '전송중'인 팩스(하루 이내)를 팝빌에서 결과 조회해 기록을 갱신
// 2) 결과가 나온(성공·실패) 팩스를 보낸 설계사에게 문자로 알림 (한 건당 1회, notified_at)
// 보호: 요청 머리글 x-watch-key 가 DB 표 boit_config 의 watch_key 와 같아야 함 (외부에서 못 부름)
// 문자: 솔라피 (가입 인증 문자와 같은 AUTH_SMS_* 비밀값·발신번호). 받는 번호 = 설계사가 휴대폰 인증한 번호.
// 문자에는 고객 이름·주민번호를 넣지 않음 (보험사·접수시각·장수·결과만).
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) || "";
const IS_TEST = env("POPBILL_IS_TEST") !== "false";
const SERVICE_ID = IS_TEST ? "POPBILL_TEST" : "POPBILL";
const AUTH_HOST = "https://auth.linkhub.co.kr";
const API_HOST = IS_TEST ? "https://popbill-test.linkhub.co.kr" : "https://popbill.linkhub.co.kr";
const SCOPES = ["member", "160", "161"];
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
let TOKEN: { t: string; exp: number } | null = null;
async function token() {
  if (TOKEN && TOKEN.exp > Date.now() + 60_000) return TOKEN.t;
  const body = JSON.stringify({ access_id: env("POPBILL_CORP_NUM").replace(/\D/g, ""), scope: SCOPES });
  const digest = b64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body))));
  const xDate = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const uri = `/${SERVICE_ID}/Token`;
  const target = ["POST", digest, xDate, "*", "2.0", uri].join("\n");
  const key = await crypto.subtle.importKey("raw", unb64(env("POPBILL_SECRET_KEY")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = b64(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(target))));
  const r = await fetch(AUTH_HOST + uri, { method: "POST", headers: { "Content-Type": "application/json", "x-lh-date": xDate, "x-lh-version": "2.0", "x-lh-forwarded": "*", Authorization: `LINKHUB ${env("POPBILL_LINK_ID")} ${sig}` }, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.session_token) throw new Error(j.message || "팝빌 인증 실패");
  TOKEN = { t: j.session_token, exp: Date.now() + 25 * 60_000 };
  return TOKEN.t;
}
function verdict(x: any) { const st = Number(x?.state); if (st === 3) return Number(x?.successPageCnt) > 0 && !Number(x?.failPageCnt) ? "ok" : "bad"; return "sending"; }

async function hmacHex(secret: string, data: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)))].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function sms(to: string, text: string) {
  const key = env("AUTH_SMS_API_KEY").trim(), sec = env("AUTH_SMS_API_SECRET").trim(), from = env("AUTH_SMS_FROM").replace(/\D/g, "");
  if (!key || !sec || !from) throw new Error("문자 설정 없음");
  const date = new Date().toISOString(), abc = "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const salt = [...crypto.getRandomValues(new Uint8Array(32))].map((x) => abc[x % abc.length]).join("");
  const r = await fetch("https://api.solapi.com/messages/v4/send", { method: "POST", headers: { Authorization: `HMAC-SHA256 apiKey=${key}, date=${date}, salt=${salt}, signature=${await hmacHex(sec, date + salt)}`, "Content-Type": "application/json" }, body: JSON.stringify({ message: { to, from, text } }) });
  const j = await r.json().catch(() => ({}));
  const st = String(j.statusCode || "");
  if (!r.ok || (st && !["2000", "3000", "4000"].includes(st))) throw new Error(`solapi ${r.status} ${j.errorCode || st}`);
}
const CODE: Record<string, string> = { "300": "발신번호 오류", "301": "발신번호 미등록", "402": "문서 변환 실패", "405": "지원 안 되는 문서", "407": "지원 안 되는 파일", "408": "파일 이름 오류", "410": "파일 용량", "412": "장수 초과", "413": "장수 초과", "414": "변환 실패", "415": "변환 시간 초과", "416": "파일 처리 오류", "417": "암호 걸린 문서", "498": "변환 실패", "499": "과금 처리 실패" };
const kstTime = (d: string) => new Date(new Date(d).getTime() + 9 * 3600e3).toISOString().slice(5, 16).replace("-", "/").replace("T", " ");
const krLocal = (p: string) => { const d = String(p || "").replace(/\D/g, ""); return d.startsWith("82") ? "0" + d.slice(2) : d; };

Deno.serve(async (req) => {
  const { data: cfg } = await db.from("boit_config").select("v").eq("k", "watch_key").maybeSingle();
  if (!cfg?.v || req.headers.get("x-watch-key") !== cfg.v) return json({ error: "forbidden" }, 403);
  const out = { checked: 0, updated: 0, sent: 0, errors: [] as string[] };
  // 1) 전송중 결과 조회
  const since = new Date(Date.now() - 864e5).toISOString();
  const { data: pend } = await db.from("boit_fax").select("id,receipt_num").eq("state", "sending").gte("created_at", since).limit(50);
  for (const p of pend || []) {
    try {
      out.checked++;
      const r = await fetch(`${API_HOST}/FAX/${p.receipt_num}`, { headers: { Authorization: `Bearer ${await token()}`, "Accept-Language": "ko-KR" } });
      const j: any = await r.json().catch(() => null);
      const list = Array.isArray(j) ? j : j ? [j] : [];
      if (!list.length) continue;
      const vs = list.map(verdict);
      const overall = vs.every((v) => v === "ok") ? "ok" : vs.some((v) => v === "sending") ? "sending" : "bad";
      if (overall !== "sending") {
        await db.from("boit_fax").update({ state: overall, pages: list.reduce((a: number, x: any) => a + (Number(x.sendPageCnt) || 0), 0) || null, result_code: list.map((x: any) => x.result).join(","), updated_at: new Date().toISOString() }).eq("id", p.id);
        out.updated++;
      }
    } catch (e) { out.errors.push(String((e as Error).message || e).slice(0, 80)); }
  }
  // 2) 결과 알림 문자 (사흘 이내 건만)
  const { data: done } = await db.from("boit_fax").select("id,user_id,insurer,pages,state,result_code,created_at").in("state", ["ok", "bad"]).is("notified_at", null).gte("created_at", new Date(Date.now() - 3 * 864e5).toISOString()).limit(30);
  const phones = new Map<string, string>();
  for (const f of done || []) {
    try {
      if (!phones.has(f.user_id)) { const { data } = await db.auth.admin.getUserById(f.user_id); phones.set(f.user_id, krLocal(data?.user?.phone || "")); }
      const to = phones.get(f.user_id) || "";
      // 먼저 표시해 두어 같은 건을 두 번 보내지 않음
      await db.from("boit_fax").update({ notified_at: new Date().toISOString() }).eq("id", f.id).is("notified_at", null);
      if (!/^01\d{8,9}$/.test(to)) continue;
      const code = String(f.result_code || "").split(",").find((c) => c && c !== "100") || "";
      const text = f.state === "ok"
        ? `[보잇] ${f.insurer} 청구팩스 전송완료 (${kstTime(f.created_at)} 접수, ${f.pages || "-"}장)`
        : `[보잇] ${f.insurer} 청구팩스 전송실패${code ? `(${CODE[code] || code})` : ""} - 청구내역에서 [다시 보내기] 해 주세요 (${kstTime(f.created_at)} 접수)`;
      await sms(to, text);
      out.sent++;
    } catch (e) { out.errors.push(String((e as Error).message || e).slice(0, 80)); }
  }
  if (out.errors.length) console.log("fax-watch", JSON.stringify(out));
  return json(out);
});
