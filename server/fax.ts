// 보잇 · 팩스 발송 서버 기능 (Supabase Edge Function 'fax') — 팝빌(Popbill) 팩스 API 연동
// 보상청구 서류를 보험사 청구 팩스로 보내고, 접수번호로 전송 결과를 확인함.
//
// 배포:  supabase functions deploy fax --no-verify-jwt   (로그인 확인은 함수 안에서 직접 함)
// 비밀값 (Supabase 대시보드 > Edge Functions > Secrets 에서 대표가 직접 입력):
//   POPBILL_LINK_ID     팝빌 링크아이디 (DAONPARTNERS)
//   POPBILL_SECRET_KEY  팝빌 비밀키
//   POPBILL_CORP_NUM    팝빌 회원 사업자번호 (다온파트너스, 숫자 10자리)
//   POPBILL_IS_TEST     "true" = 테스트 환경(기본) / "false" = 운영 환경 (운영 전환 승인 후에만)
//   POPBILL_SENDER      발신 팩스번호 (팝빌에 등록한 번호, 숫자만) — 비우면 팝빌 원발신번호
// 표 만들기: server/fax.sql 을 1회 실행
//
// 근거: 팝빌 개발자센터 인증(https://developers.popbill.com/api-reference/fax/getting-started/authorization),
//       팩스 전송(…/api/send), 결과 조회(…/api/info), 팝빌 공식 Node SDK popbill 1.64.2 · linkhub 1.8.2 의 서명·요청 방식과 같게 만듦.
// 원칙: 비밀키·토큰은 화면으로 절대 돌려주지 않음. 팩스 파일(청구서·의료서류)은 서버에 저장하지 않고 팝빌로 바로 넘김.
//       기록 표(boit_fax)에는 접수번호·수신 팩스번호·보험사명·장수·결과만 남김 (고객 주민번호·서류 내용 없음).
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) || "";
const IS_TEST = env("POPBILL_IS_TEST") !== "false";
const SERVICE_ID = IS_TEST ? "POPBILL_TEST" : "POPBILL";
const AUTH_HOST = "https://auth.linkhub.co.kr";
const API_HOST = IS_TEST ? "https://popbill-test.linkhub.co.kr" : "https://popbill.linkhub.co.kr";
const SCOPES = ["member", "160", "161"]; // 팩스 일반망·지능망 + 공통
const DAY_LIMIT = 100; // 설계사 1명 하루 최대 발송 건수 (남용 방지)
const MAX_FILES = 30, MAX_BYTES = 20 * 1024 * 1024;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

/* ---------- 팝빌 인증 토큰 (30분 유효 → 25분 동안 재사용) ---------- */
const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
let TOKEN: { t: string; exp: number } | null = null;
async function token() {
  if (TOKEN && TOKEN.exp > Date.now() + 60_000) return TOKEN.t;
  const body = JSON.stringify({ access_id: env("POPBILL_CORP_NUM").replace(/\D/g, ""), scope: SCOPES });
  const digest = b64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body))));
  const xDate = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const uri = `/${SERVICE_ID}/Token`;
  const forwarded = "*"; // Edge Function 은 요청마다 나가는 IP가 달라질 수 있어 IP 제한을 두지 않음
  const target = ["POST", digest, xDate, forwarded, "2.0", uri].join("\n");
  const key = await crypto.subtle.importKey("raw", unb64(env("POPBILL_SECRET_KEY")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = b64(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(target))));
  const r = await fetch(AUTH_HOST + uri, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-lh-date": xDate, "x-lh-version": "2.0", "x-lh-forwarded": forwarded, Authorization: `LINKHUB ${env("POPBILL_LINK_ID")} ${sig}` },
    body,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.session_token) throw { code: j.code || r.status, message: j.message || "팝빌 인증에 실패했습니다." };
  TOKEN = { t: j.session_token, exp: Date.now() + 25 * 60_000 };
  return TOKEN.t;
}
async function pb(method: string, path: string, body?: BodyInit, extra: Record<string, string> = {}) {
  const r = await fetch(API_HOST + path, { method, headers: { Authorization: `Bearer ${await token()}`, "Accept-Language": "ko-KR", ...extra }, body });
  const t = await r.text();
  let j: any = null; try { j = JSON.parse(t); } catch (_) { j = t; }
  if (!r.ok || (j && typeof j === "object" && !Array.isArray(j) && typeof j.code === "number" && j.code < 0)) throw { code: j?.code || r.status, message: j?.message || "팝빌 요청이 실패했습니다." };
  return j;
}
const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

/* ---------- 상태 코드 (팝빌 GetFaxResult: state=3 이면 result 로 성공·실패 확인) ---------- */
function verdict(x: any) {
  const st = Number(x?.state);
  // 결과코드 표는 팝빌 문서의 '팩스 상태' 페이지 기준으로 나중에 보강 — 지금은 성공·실패 장수로만 판정 (추정 없음)
  if (st === 3) return Number(x?.successPageCnt) > 0 && !Number(x?.failPageCnt) ? "ok" : "bad";
  return "sending"; // 3(완료) 외 상태 코드 의미는 팝빌 '팩스 상태' 표 확인 후 추가
}

// 이용권 확인 (2026-10-29 대표 결정): 관리자가 요금제를 지정한(boit_plan) 회원만, 만료일 전까지 실제 팩스 발송 가능
async function planOk(uid: string) {
  const { data } = await db.from("boit_plan").select("plan,expires").eq("user_id", uid).maybeSingle();
  if (!data) return false;
  if (!data.expires) return true;
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  return String(data.expires) >= today;
}
// 충전금 확인 (2026-10-29): 이번 달 포함 건수를 다 쓴 회원은 충전금이 초과 1건(550원) 이상 있어야 발송
const OVER_PRICE = 550, INC: Record<string, number> = { grow: 30, pro: 40, premium: 100 };
async function cashOk(uid: string) {
  const { data: p } = await db.from("boit_plan").select("plan").eq("user_id", uid).maybeSingle();
  const inc = INC[p?.plan || ""] || 0;
  const k = new Date(Date.now() + 9 * 3600e3); const mStart = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), 1) - 9 * 3600e3).toISOString();
  const { data: rows } = await db.from("boit_fax").select("pages,state").eq("user_id", uid).in("state", ["ok", "sending"]).gte("created_at", mStart);
  const used = (rows || []).reduce((a: number, r: any) => a + (r.state === "ok" ? Math.max(1, Math.ceil((r.pages || 1) / 10)) : 1), 0);
  if (used < inc) return { ok: true, used, inc, bal: null };
  const { data: c } = await db.from("boit_cash").select("amount").eq("user_id", uid);
  const bal = (c || []).reduce((a: number, r: any) => a + (r.amount || 0), 0);
  return { ok: bal >= OVER_PRICE, used, inc, bal };
}
const noCash = (x: any) => ({ error: "no_cash", message: `이번 달 포함 ${x.inc}건을 모두 썼고 충전금이 부족합니다 (잔액 ${Number(x.bal || 0).toLocaleString()}원, 초과 1건 ${OVER_PRICE}원). 충전금을 충전한 뒤 보내 주세요.`, used: x.used, inc: x.inc, bal: x.bal });
const NO_PLAN = { error: "no_plan", message: "이용권이 지정된 회원만 실제 팩스를 보낼 수 있습니다. 다온파트너스(관리자)에 이용권 등록을 요청하세요." };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  const ready = !!(env("POPBILL_LINK_ID") && env("POPBILL_SECRET_KEY") && digits(env("POPBILL_CORP_NUM")).length === 10);
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(jwt);
  const user = u?.user;
  if (!user) return json({ error: "login_required", message: "보잇에 다시 로그인하세요." }, 401);
  let b: Record<string, any> = {};
  try { b = await req.json(); } catch (_) { /* 빈 요청 */ }
  if (!ready) return json({ error: "not_configured", message: "팩스 서버 설정(팝빌 비밀값)이 아직 끝나지 않았습니다.", test: IS_TEST });

  try {
    switch (b.action) {
      // 연결 확인: 인증 + 등록된 발신번호 목록 + 잔여 포인트
      case "status": {
        const senders = await pb("GET", "/FAX/SenderNumber").catch((e) => ({ error: e }));
        const point = await fetch(`${AUTH_HOST}/${SERVICE_ID}/Point`, { headers: { Authorization: `Bearer ${await token()}` } }).then((r) => r.json()).catch(() => ({}));
        // 연동회원 포인트(/Point)와 파트너 포인트(/PartnerPoint)를 둘 다 보여 줌 — 팝빌 SDK getBalance·getPartnerBalance 와 같은 주소
        const ppoint = await fetch(`${AUTH_HOST}/${SERVICE_ID}/PartnerPoint`, { headers: { Authorization: `Bearer ${await token()}` } }).then((r) => r.json()).catch(() => ({}));
        return json({ ok: true, test: IS_TEST, sender: digits(env("POPBILL_SENDER")) || null, senders, point: point?.remainPoint ?? null, partnerPoint: ppoint?.remainPoint ?? null });
      }

      // 발송: { action:"send", to:[{num,name}], title, insurer, files:[{name, b64}], requestNum? }
      case "send": {
        if (!(await planOk(user.id))) return json(NO_PLAN, 403);
        { const c = await cashOk(user.id); if (!c.ok) return json(noCash(c), 402); }
        const to = (Array.isArray(b.to) ? b.to : []).map((x: any) => ({ rcv: digits(x.num), rcvnm: String(x.name || "").slice(0, 30) })).filter((x: any) => x.rcv.length >= 8);
        const files = (Array.isArray(b.files) ? b.files : []).filter((f: any) => f && f.b64);
        if (!to.length) return json({ error: "bad_receiver", message: "받는 팩스번호가 없습니다." }, 400);
        if (to.length > 10) return json({ error: "bad_receiver", message: "한 번에 10곳까지 보낼 수 있습니다." }, 400);
        if (!files.length || files.length > MAX_FILES) return json({ error: "bad_files", message: `보낼 파일은 1~${MAX_FILES}개여야 합니다.` }, 400);
        const since = new Date(Date.now() - 864e5).toISOString();
        const { count } = await db.from("boit_fax").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
        if ((count || 0) >= DAY_LIMIT) return json({ error: "limit", message: `하루 발송 한도(${DAY_LIMIT}건)를 넘었습니다.` }, 429);

        const fd = new FormData();
        const requestNum = (String(b.requestNum || "").replace(/[^A-Za-z0-9_-]/g, "") || `B${Date.now()}${Math.floor(Math.random() * 1e4)}`).slice(0, 36);
        const form: Record<string, unknown> = { snd: digits(env("POPBILL_SENDER")) || undefined, sndnm: "보잇", fCnt: files.length, title: String(b.title || "보험금 청구서류").slice(0, 100), adsYN: false, requestNum, rcvs: to };
        fd.append("form", JSON.stringify(form));
        let bytes = 0;
        for (const f of files) {
          const raw = unb64(String(f.b64).replace(/^data:[^,]+,/, ""));
          bytes += raw.length;
          fd.append("file", new Blob([raw], { type: "application/octet-stream" }), String(f.name || "file.pdf").replace(/[\\/:*?"<>|]/g, "_").slice(0, 80));
        }
        if (bytes > MAX_BYTES) return json({ error: "bad_files", message: "파일이 너무 큽니다 (합계 20MB 이하)." }, 400);
        const r = await pb("POST", "/FAX", fd);
        const receiptNum = r?.receiptNum;
        await db.from("boit_fax").insert({ user_id: user.id, receipt_num: receiptNum, request_num: requestNum, insurer: String(b.insurer || "").slice(0, 40), receivers: to.map((x: any) => x.rcv), file_cnt: files.length, test: IS_TEST, state: "sending" });
        return json({ ok: true, receiptNum, requestNum, test: IS_TEST });
      }

      // 결과: { action:"result", receiptNum }  (본인이 보낸 건만)
      case "result": {
        const rn = digits(b.receiptNum);
        const { data: row } = await db.from("boit_fax").select("id").eq("user_id", user.id).eq("receipt_num", rn).maybeSingle();
        if (!row) return json({ error: "not_found", message: "발송 기록을 찾지 못했습니다." }, 404);
        const list = await pb("GET", `/FAX/${rn}`);
        const items = (Array.isArray(list) ? list : [list]).map((x: any) => ({
          to: x.receiveNum, state: x.state, result: x.result, verdict: verdict(x),
          pages: x.sendPageCnt, ok: x.successPageCnt, fail: x.failPageCnt, sentAt: x.sendDT, doneAt: x.resultDT,
        }));
        const all = items.map((x) => x.verdict);
        const overall = all.every((v) => v === "ok") ? "ok" : all.some((v) => v === "sending") ? "sending" : all.some((v) => v === "bad") ? "bad" : all[0] || "sending";
        await db.from("boit_fax").update({ state: overall, pages: items.reduce((a, x) => a + (Number(x.pages) || 0), 0) || null, result_code: items.map((x) => x.result).join(","), updated_at: new Date().toISOString() }).eq("id", row.id);
        return json({ ok: true, overall, items });
      }

      // 다시 보내기: { action:"resend", receiptNum } → 팝빌에 남아 있는 변환본으로 같은 수신처에 재전송 (접수 후 60일 이내, 서류 다시 안 올림)
      case "resend": {
        if (!(await planOk(user.id))) return json(NO_PLAN, 403);
        { const c = await cashOk(user.id); if (!c.ok) return json(noCash(c), 402); }
        const rn = digits(b.receiptNum);
        const { data: row } = await db.from("boit_fax").select("id,insurer,receivers,file_cnt").eq("user_id", user.id).eq("receipt_num", rn).maybeSingle();
        if (!row) return json({ error: "not_found", message: "발송 기록을 찾지 못했습니다." }, 404);
        const since = new Date(Date.now() - 864e5).toISOString();
        const { count } = await db.from("boit_fax").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
        if ((count || 0) >= DAY_LIMIT) return json({ error: "limit", message: `하루 발송 한도(${DAY_LIMIT}건)를 넘었습니다.` }, 429);
        const requestNum = `R${Date.now()}${Math.floor(Math.random() * 1e4)}`.slice(0, 36);
        const r = await pb("POST", `/FAX/${rn}`, JSON.stringify({ rcvs: [], requestNum }), { "Content-Type": "application/json" });
        const receiptNum = r?.receiptNum;
        await db.from("boit_fax").insert({ user_id: user.id, receipt_num: receiptNum, request_num: requestNum, insurer: row.insurer, receivers: row.receivers, file_cnt: row.file_cnt, test: IS_TEST, state: "sending" });
        return json({ ok: true, receiptNum, test: IS_TEST });
      }

      // 보낸 팩스 보기: { action:"preview", receiptNum } → 팝빌이 변환한 팩스 화면 주소 (30초 유효, 본인이 보낸 건만)
      case "preview": {
        const rn = digits(b.receiptNum);
        const { data: row } = await db.from("boit_fax").select("id").eq("user_id", user.id).eq("receipt_num", rn).maybeSingle();
        if (!row) return json({ error: "not_found", message: "발송 기록을 찾지 못했습니다." }, 404);
        const r = await pb("GET", `/FAX/Preview/${rn}`);
        return json({ ok: true, url: r?.url || null });
      }

      default:
        return json({ error: "bad_action", message: "알 수 없는 요청입니다." }, 400);
    }
  } catch (e: any) {
    return json({ error: "popbill", code: e?.code ?? null, message: e?.message || String(e) }, 502);
  }
});
