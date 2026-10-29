// 보잇 · 팩스 결과 알림 (Supabase Edge Function 'fax-watch') — 1분마다 DB 예약작업(pg_cron)이 부름
// 1) '전송중'인 팩스(하루 이내)를 팝빌에서 결과 조회해 기록을 갱신
// 2) 결과가 나온(성공·실패) 팩스를 보낸 설계사에게 문자로 알림 (한 건당 1회, notified_at)
// 보호: 요청 머리글 x-watch-key 가 DB 표 boit_config 의 watch_key 와 같아야 함 (외부에서 못 부름)
// 문자: 솔라피 (가입 인증 문자와 같은 AUTH_SMS_* 비밀값·발신번호). 받는 번호 = 설계사가 휴대폰 인증한 번호.
// 문자에는 주민번호·서류 내용을 넣지 않음 (고객 이름은 가운데 가림, 보험사·번호·시각·장수·결과만).
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
// 발송: 알림톡 설정(boit_config: kakao_pfid · kakao_tpl_ok · kakao_tpl_bad)이 있으면 알림톡, 실패 시 솔라피가 짧은 문자(text)로 대신 보냄. 설정 전에는 짧은 문자(SMS, 90바이트 이내)만.
async function send(to: string, text: string, kakao?: { pfId: string; templateId: string; variables: Record<string, string> }) {
  const key = env("AUTH_SMS_API_KEY").trim(), sec = env("AUTH_SMS_API_SECRET").trim(), from = env("AUTH_SMS_FROM").replace(/\D/g, "");
  if (!key || !sec || !from) throw new Error("문자 설정 없음");
  const date = new Date().toISOString(), abc = "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const salt = [...crypto.getRandomValues(new Uint8Array(32))].map((x) => abc[x % abc.length]).join("");
  const message: Record<string, unknown> = { to, from, text };
  if (kakao) message.kakaoOptions = { pfId: kakao.pfId, templateId: kakao.templateId, variables: kakao.variables };
  const r = await fetch("https://api.solapi.com/messages/v4/send", { method: "POST", headers: { Authorization: `HMAC-SHA256 apiKey=${key}, date=${date}, salt=${salt}, signature=${await hmacHex(sec, date + salt)}`, "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
  const j = await r.json().catch(() => ({}));
  const st = String(j.statusCode || "");
  if (!r.ok || (st && !["2000", "3000", "4000"].includes(st))) throw new Error(`solapi ${r.status} ${j.errorCode || st}`);
}
// EUC-KR 기준 바이트 (한글 2, 영문·숫자 1) — SMS는 90바이트까지
const bytes = (t: string) => [...t].reduce((a, c) => a + (c.charCodeAt(0) > 127 ? 2 : 1), 0);
const fitSms = (parts: string[]) => { let t = parts.join(" "); while (bytes(t) > 90 && parts.length > 2) { parts.splice(parts.length - 2, 1); t = parts.join(" "); } return bytes(t) > 90 ? [...t].slice(0, 44).join("") : t; };
const CODE: Record<string, string> = { "300": "발신번호 오류", "301": "발신번호 미등록", "402": "문서 변환 실패", "405": "지원 안 되는 문서", "407": "지원 안 되는 파일", "408": "파일 이름 오류", "410": "파일 용량", "412": "장수 초과", "413": "장수 초과", "414": "변환 실패", "415": "변환 시간 초과", "416": "파일 처리 오류", "417": "암호 걸린 문서", "498": "변환 실패", "499": "과금 처리 실패" };
const kstTime = (d: string) => new Date(new Date(d).getTime() + 9 * 3600e3).toISOString().slice(5, 16).replace("-", "/").replace("T", " ");
const CS: Record<string, string> = {"KB손해보험": "1544-0114", "삼성화재": "1588-5114", "현대해상": "1588-5656", "DB손해보험": "1588-0100", "메리츠화재": "1566-7711", "한화손해보험": "1566-8000", "흥국화재": "1688-1688", "NH농협손해보험": "1644-9000", "라이나손해보험": "1566-5800", "롯데손해보험": "1588-3344", "하나손해보험": "1566-3000", "AXA손해보험": "1566-2266", "한화손보 캐롯(구 캐롯손해보험)": "1566-0300", "우체국보험": "1599-0100", "수협공제": "1588-4119", "신협공제": "1544-3030", "교직원공제(TheK손해보험)": "1577-3993", "미래에셋생명": "1588-0220", "삼성생명": "1588-3114", "교보생명": "1588-1001", "한화생명": "1588-6363", "KDB생명": "1588-4040", "신한라이프": "1588-5580", "라이나생명": "1588-0058", "메트라이프생명": "1588-9600", "동양생명": "1577-1004", "ABL생명": "1588-6500", "흥국생명": "1588-2288", "DB생명": "1588-3131", "iM라이프": "1588-4770", "하나생명": "1577-1112", "KB라이프생명": "1588-9922", "푸본현대생명": "1577-3311", "카디프생명": "1688-1118", "교보라이프플래닛생명": "1588-1810", "처브라이프": "1599-4600"}; // 보험사 고객센터 (보잇 앱 보험사 목록과 같음)
const fmtTel = (d: string) => { d = String(d || "").replace(/\D/g, ""); if (d.length < 8) return d; if (d.startsWith("02")) return d.replace(/^(02)(\d{3,4})(\d{4})$/, "$1-$2-$3"); if (/^050/.test(d)) return d.length === 12 ? d.replace(/^(\d{4})(\d{4})(\d{4})$/, "$1-$2-$3") : d.replace(/^(\d{4})(\d{3})(\d{4})$/, "$1-$2-$3"); return d.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3"); };
const pbTime = (t: string) => { const d = String(t || ""); return d.length >= 12 ? `${d.slice(4, 6)}/${d.slice(6, 8)} ${d.slice(8, 10)}:${d.slice(10, 12)}` : ""; };
const maskName = (n: string) => { n = String(n || "").trim(); return n.length <= 1 ? n : n.length === 2 ? n[0] + "*" : n[0] + "*".repeat(n.length - 2) + n[n.length - 1]; };
const krLocal = (p: string) => { const d = String(p || "").replace(/\D/g, ""); return d.startsWith("82") ? "0" + d.slice(2) : d; };

Deno.serve(async (req) => {
  const { data: cfg } = await db.from("boit_config").select("v").eq("k", "watch_key").maybeSingle();
  if (!cfg?.v || req.headers.get("x-watch-key") !== cfg.v) return json({ error: "forbidden" }, 403);
  const { data: kc } = await db.from("boit_config").select("k,v").in("k", ["kakao_pfid", "kakao_tpl_ok", "kakao_tpl_bad"]);
  const kv = new Map((kc || []).map((r: any) => [r.k, r.v]));
  const KAKAO = { pfId: kv.get("kakao_pfid") || "", ok: kv.get("kakao_tpl_ok") || "", bad: kv.get("kakao_tpl_bad") || "" };
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
  const { data: done } = await db.from("boit_fax").select("id,user_id,insurer,pages,state,result_code,created_at,receipt_num").in("state", ["ok", "bad"]).is("notified_at", null).gte("created_at", new Date(Date.now() - 3 * 864e5).toISOString()).limit(30);
  const phones = new Map<string, string>();
  for (const f of done || []) {
    try {
      if (!phones.has(f.user_id)) { const { data } = await db.auth.admin.getUserById(f.user_id); phones.set(f.user_id, krLocal(data?.user?.phone || "")); }
      const to = phones.get(f.user_id) || "";
      // 먼저 표시해 두어 같은 건을 두 번 보내지 않음
      await db.from("boit_fax").update({ notified_at: new Date().toISOString() }).eq("id", f.id).is("notified_at", null);
      if (!/^01\d{8,9}$/.test(to)) continue;
      const code = String(f.result_code || "").split(",").find((c) => c && c !== "100") || "";
      // 팝빌 전송 결과에서 발신·수신번호·완료시각·제목(보험금 청구 고객명) 가져옴
      let x: any = {};
      try { const r = await fetch(`${API_HOST}/FAX/${f.receipt_num}`, { headers: { Authorization: `Bearer ${await token()}`, "Accept-Language": "ko-KR" } }); const j: any = await r.json(); x = (Array.isArray(j) ? j[0] : j) || {}; } catch (_) { /* 기본 문구로 */ }
      const cust = maskName(String(x.title || "").replace(/^보험금\s*청구\s*/, ""));
      const ok = f.state === "ok", reason = CODE[code] || (code ? "결과코드 " + code : "확인 필요");
      const when = pbTime(x.resultDT) || kstTime(f.created_at), pages = String(f.pages || x.sendPageCnt || "-");
      // 짧은 문자 (90바이트 이내, 넘치면 뒤쪽 항목부터 뺌)
      const text = ok
        ? fitSms([`[보잇] ${cust ? cust + "님 " : ""}${f.insurer}`, "청구팩스 전송완료", `${pages}장`, when])
        : fitSms([`[보잇] ${cust ? cust + "님 " : ""}${f.insurer}`, `팩스 전송실패(${reason})`, when, "다시 보내기 필요"]);
      const tpl = ok ? KAKAO.ok : KAKAO.bad;
      const kakao = KAKAO.pfId && tpl ? { pfId: KAKAO.pfId, templateId: tpl, variables: { "#{고객}": cust || "고객", "#{보험사}": f.insurer, "#{수신}": fmtTel(x.receiveNum) || "-", "#{발신}": fmtTel(x.sendNum) || "-", "#{시각}": when, "#{장수}": pages, ...(ok ? { "#{고객센터}": CS[f.insurer] || "-" } : { "#{사유}": reason }) } } : undefined;
      await send(to, text, kakao);
      out.sent++;
    } catch (e) { out.errors.push(String((e as Error).message || e).slice(0, 80)); }
  }
  if (out.errors.length) console.log("fax-watch", JSON.stringify(out));
  return json(out);
});
