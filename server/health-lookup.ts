// 보잇 · 고객 자료 자동 불러오기 서버 기능 (Supabase Edge Function 'health-lookup')
// 1단계: 홈택스 연말정산간소화 소득세액공제자료 — 의료비 항목만 (CODEF 'income-tax-credit')
//   근거: developer.codef.io/products/public/each/c/income-tax-credit (업데이트 2026-08-24)
//   엔드포인트 데모 https://development.codef.io/v1/kr/public/nt/etc-yearend-tax/income-tax-credit · 정식 https://api.codef.io/…
//   간편인증 loginType "5"(회원 간편인증): identity=생년월일 8자리, userName, phoneNo, loginTypeLevel(1 카카오·3 삼성패스·4 KB·5 PASS·6 네이버·7 신한·8 토스·10 NH·11 우리), PASS는 telecom 필수
//   inquiryTypeCD 15자리 비트, index 3 = 의료비 → "000100000000000". 응답 CF-03002 + continue2Way → 고객 승인 후 is2Way/simpleAuth "1"/twoWayInfo로 2차 요청 (4분 30초 안)
//   id(요청 식별값)를 같게 주면 한 로그인 세션으로 여러 요청(연도별)을 순차 처리
// 비밀값: HL_PROVIDER=codef, HL_CLIENT_ID, HL_CLIENT_SECRET, HL_PUBLIC_KEY(인증서 비밀번호 암호화용 — 간편인증에선 안 씀), HL_MODE=demo|api (기본 demo)
// 원칙: 조회 결과는 저장하지 않고 바로 화면으로 돌려줌. 로그에 개인정보·금액을 남기지 않음.
// 시범 기간: 관리자(boit_admin)만 사용 (데모 키는 하루 100회 제한)
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) || "";
const HOST = env("HL_MODE") === "api" ? "https://api.codef.io" : "https://development.codef.io";
const YEAREND = "/v1/kr/public/nt/etc-yearend-tax/income-tax-credit";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

let TOKEN: { t: string; exp: number } | null = null;
async function token() {
  if (TOKEN && TOKEN.exp > Date.now() + 60_000) return TOKEN.t;
  const r = await fetch("https://oauth.codef.io/oauth/token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + btoa(`${env("HL_CLIENT_ID")}:${env("HL_CLIENT_SECRET")}`) },
    body: "grant_type=client_credentials&scope=read",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw { code: "token", message: "CODEF 인증 토큰을 받지 못했습니다. 키 값을 확인하세요." };
  TOKEN = { t: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return TOKEN.t;
}
async function codef(path: string, body: Record<string, unknown>) {
  const r = await fetch(HOST + path, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: "Bearer " + (await token()) }, body: encodeURIComponent(JSON.stringify(body)) });
  const t = await r.text();
  let j: any = null;
  try { j = JSON.parse(decodeURIComponent(t.replace(/\+/g, " "))); } catch (_) { try { j = JSON.parse(t); } catch (_) { j = null; } }
  if (!j) throw { code: "http_" + r.status, message: "CODEF 응답을 읽지 못했습니다 (" + r.status + ")" };
  return j;
}
const APP: Record<string, string> = { kakao: "1", samsung: "3", kb: "4", pass: "5", naver: "6", shinhan: "7", toss: "8", nh: "10", woori: "11" };

function base(b: any) {
  const p: Record<string, unknown> = {
    organization: "0004", loginType: "5", identity: digits(b.birth).slice(0, 8), userName: String(b.name || "").trim(), phoneNo: digits(b.phone),
    loginTypeLevel: APP[String(b.app)] || "1", id: String(b.sid || "").slice(0, 80), inquiryTypeCD: "000100000000000",
  };
  if (b.year) p.searchStartYear = String(b.year).slice(0, 4);
  if (p.loginTypeLevel === "5") p.telecom = String(b.telecom ?? "0");
  return p;
}
// 응답 정리: 의료비 항목의 기본내역만 (상호·사업자번호·구분·금액). 주민번호 등은 버림
function pick(data: any) {
  const arr = Array.isArray(data) ? data : data ? [data] : [];
  const rows: any[] = [];
  for (const d of arr) {
    const item = String(d?.resDeductibleItem ?? "");
    for (const x of (Array.isArray(d?.resBasicList) ? d.resBasicList : [])) {
      rows.push({ item, type: x.resType || "", name: x.resCompanyNm || "", biz: x.resCompanyIdentityNo || "", amount: x.resAmountPayment || x.resAmount || "", amount1: x.resAmountPayment1 || x.resAmount1 || "", who: x.resUserNm ? String(x.resUserNm).slice(0, 1) + "*" : "", n: Array.isArray(x.resDetailList) ? x.resDetailList.length : 0 });
    }
  }
  return rows;
}
const done = (j: any, year: string) => {
  const code = j?.result?.code || "";
  if (code === "CF-03002" || j?.data?.continue2Way) {
    const d = j.data || {};
    return { ok: true, need2way: true, year, twoWayInfo: { jobIndex: d.jobIndex, threadIndex: d.threadIndex, jti: d.jti, twoWayTimestamp: d.twoWayTimestamp }, method: d.method || "" };
  }
  if (code !== "CF-00000") return { ok: false, code, message: j?.result?.message || "조회에 실패했습니다.", extra: j?.result?.extraMessage || "" };
  return { ok: true, year, rows: pick(j.data) };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (env("HL_PROVIDER") !== "codef" || !env("HL_CLIENT_ID") || !env("HL_CLIENT_SECRET")) return json({ error: "not_configured", message: "조회 업체 키가 설정되지 않았습니다." });
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(jwt);
  if (!u?.user) return json({ error: "login_required", message: "보잇에 다시 로그인하세요." }, 401);
  const { data: adm } = await db.from("boit_admin").select("user_id").eq("user_id", u.user.id).maybeSingle();
  let b: any = {};
  try { b = await req.json(); } catch (_) { /* 빈 요청 */ }
  if (b.action === "start" || b.action === "finish") return json({ error: "not_configured" }); // 고지의무 화면(심평원 진료내역)은 2단계에서 연결 — 그때까지 시범 예시
  if (b.action === "ping") return json({ ok: true, provider: "codef", mode: HOST.includes("development") ? "demo" : "api", admin: !!adm });
  if (!adm) return json({ error: "forbidden", message: "시범 기간에는 관리자만 자동 불러오기를 쓸 수 있습니다." }, 403);
  try {
    if (b.action === "token") { await token(); return json({ ok: true }); }
    if (b.action === "yearend") {
      const p = base(b);
      if (String(p.identity).length !== 8 || !p.userName || String(p.phoneNo).length < 10) return json({ error: "bad_input", message: "이름·생년월일 8자리·휴대폰번호를 확인하세요." }, 400);
      if (b.twoWayInfo) Object.assign(p, { simpleAuth: "1", is2Way: true, twoWayInfo: b.twoWayInfo });
      return json(done(await codef(YEAREND, p), String(p.searchStartYear || "")));
    }
    return json({ error: "bad_action", message: "알 수 없는 요청입니다." }, 400);
  } catch (e: any) {
    return json({ error: "provider_error", code: e?.code || null, message: e?.message || String(e) }, 502);
  }
});
