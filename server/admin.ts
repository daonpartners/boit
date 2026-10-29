// 보잇 · 관리자 서버 기능 (Supabase Edge Function 'admin')
// 관리자(표 boit_admin 에 등록된 회원)만 사용. 회원·팩스 통계, 팝빌 포인트 확인, 팝빌 충전·이용내역 화면 열기.
// 배포: supabase functions deploy admin --no-verify-jwt  (로그인·관리자 확인은 함수 안에서 직접 함)
// 비밀값은 fax 기능과 같은 POPBILL_* 를 씀. 고객 개인정보(주민번호·서류)는 다루지 않음 — 회원별 고객 '수'만 셈.
// 팝빌 주소 근거: 팝빌 공식 Node SDK popbill 1.64.2 · linkhub 1.8.2
//   연동회원 포인트 충전 GetChargeURL = GET /Member?TG=CHRG, 결제내역 GetPaymentURL = /Member?TG=PAYMENT,
//   사용내역 GetUseHistoryURL = /Member?TG=USEHISTORY, 팩스 전송내역 GetSentListURL = /FAX/?TG=BOX,
//   파트너 포인트 충전 GetPartnerURL('CHRG') = GET (인증서버)/{서비스}/URL?TG=CHRG, 잔액 /Point · /PartnerPoint
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) || "";
const IS_TEST = env("POPBILL_IS_TEST") !== "false";
const SERVICE_ID = IS_TEST ? "POPBILL_TEST" : "POPBILL";
const AUTH_HOST = "https://auth.linkhub.co.kr";
const API_HOST = IS_TEST ? "https://popbill-test.linkhub.co.kr" : "https://popbill.linkhub.co.kr";
const SCOPES = ["member", "160", "161"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
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
  if (!r.ok || !j.session_token) throw { code: j.code || r.status, message: j.message || "팝빌 인증에 실패했습니다." };
  TOKEN = { t: j.session_token, exp: Date.now() + 25 * 60_000 };
  return TOKEN.t;
}
async function getJ(url: string) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${await token()}`, "Accept-Language": "ko-KR" } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || (typeof j?.code === "number" && j.code < 0)) throw { code: j?.code || r.status, message: j?.message || "팝빌 요청이 실패했습니다." };
  return j;
}
const kst = (d: string | Date) => new Date(new Date(d).getTime() + 9 * 3600e3).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(jwt);
  const user = u?.user;
  if (!user) return json({ error: "login_required", message: "보잇에 다시 로그인하세요." }, 401);
  const { data: adm } = await db.from("boit_admin").select("user_id").eq("user_id", user.id).maybeSingle();
  let b: Record<string, any> = {};
  try { b = await req.json(); } catch (_) { /* 빈 요청 */ }
  if (b.action === "whoami") return json({ ok: true, admin: !!adm });
  if (!adm) return json({ error: "forbidden", message: "관리자만 볼 수 있습니다." }, 403);

  try {
    switch (b.action) {
      case "overview": {
        const today = kst(new Date()), month = today.slice(0, 7);
        // 회원
        const { data: lu } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const users = lu?.users || [];
        const { data: states } = await db.from("app_state").select("user_id,data,updated_at");
        const st = new Map((states || []).map((s: any) => [s.user_id, s]));
        // 팩스
        const { data: fax } = await db.from("boit_fax").select("user_id,insurer,receivers,file_cnt,pages,state,result_code,test,created_at,receipt_num").order("created_at", { ascending: false }).limit(5000);
        const F = fax || [];
        const fm = F.filter((x: any) => kst(x.created_at).startsWith(month));
        const sum = (a: any[]) => ({ n: a.length, pages: a.reduce((t, x) => t + (x.pages || 0), 0), ok: a.filter((x) => x.state === "ok").length, bad: a.filter((x) => x.state === "bad").length, sending: a.filter((x) => x.state === "sending").length });
        const byIns: Record<string, any> = {};
        fm.forEach((x: any) => { const k = x.insurer || "기타"; byIns[k] = byIns[k] || []; byIns[k].push(x); });
        const days: Record<string, any> = {};
        for (let i = 29; i >= 0; i--) days[kst(new Date(Date.now() - i * 864e5))] = [];
        F.forEach((x: any) => { const d = kst(x.created_at); if (days[d]) days[d].push(x); });
        const codes: Record<string, number> = {};
        F.filter((x: any) => x.state === "bad").forEach((x: any) => String(x.result_code || "?").split(",").forEach((c) => { codes[c] = (codes[c] || 0) + 1; }));
        const members = users.map((x: any) => {
          const s: any = st.get(x.id), me = s?.data?.me || {}, mf = fm.filter((f: any) => f.user_id === x.id);
          return { email: x.email, phone: !!x.phone, created: x.created_at, last: x.last_sign_in_at, name: me.name || "", company: me.company || "", branch: me.branch || "", plan: me.plan || "", expires: me.expires || "", cash: me.cash ?? null, customers: Array.isArray(s?.data?.customers) ? s.data.customers.length : 0, faxMonth: mf.length, pagesMonth: mf.reduce((t: number, f: any) => t + (f.pages || 0), 0), saved: s?.updated_at || null, admin: x.id === user.id };
        });
        const emailOf = new Map(users.map((x: any) => [x.id, x.email]));
        // 상담신청
        const { count: leadAll } = await db.from("boit_leads").select("id", { count: "exact", head: true });
        const { count: leadMonth } = await db.from("boit_leads").select("id", { count: "exact", head: true }).gte("created_at", month + "-01T00:00:00+09:00");
        // 팝빌
        let popbill: any = { test: IS_TEST };
        try {
          const [p, pp] = await Promise.all([getJ(`${AUTH_HOST}/${SERVICE_ID}/Point`), getJ(`${AUTH_HOST}/${SERVICE_ID}/PartnerPoint`)]);
          popbill = { ...popbill, point: p?.remainPoint ?? null, partnerPoint: pp?.remainPoint ?? null };
        } catch (e: any) { popbill.error = e?.message || String(e); }
        return json({
          ok: true, today, month, popbill,
          members: { total: users.length, newMonth: users.filter((x: any) => kst(x.created_at).startsWith(month)).length, active7: users.filter((x: any) => x.last_sign_in_at && Date.now() - new Date(x.last_sign_in_at).getTime() < 7 * 864e5).length, list: members },
          fax: { all: sum(F), month: sum(fm), today: sum(F.filter((x: any) => kst(x.created_at) === today)), byInsurer: Object.entries(byIns).map(([k, a]) => ({ insurer: k, ...sum(a as any[]) })).sort((a, b) => b.n - a.n), days: Object.entries(days).map(([d, a]) => ({ d, ...sum(a as any[]) })), failCodes: codes,
            recent: F.slice(0, 30).map((x: any) => ({ at: x.created_at, email: emailOf.get(x.user_id) || "", insurer: x.insurer, to: (x.receivers || []).join(","), files: x.file_cnt, pages: x.pages, state: x.state, code: x.result_code, test: x.test, receipt: x.receipt_num })) },
          leads: { total: leadAll || 0, month: leadMonth || 0 },
        });
      }
      // 팝빌 화면 열기 (주소 30초 유효)
      case "popbillUrl": {
        const T: Record<string, string> = { charge: `${API_HOST}/Member?TG=CHRG`, partnerCharge: `${AUTH_HOST}/${SERVICE_ID}/URL?TG=CHRG`, payment: `${API_HOST}/Member?TG=PAYMENT`, use: `${API_HOST}/Member?TG=USEHISTORY`, sent: `${API_HOST}/FAX/?TG=BOX` };
        const url = T[String(b.tg)];
        if (!url) return json({ error: "bad_tg", message: "알 수 없는 메뉴입니다." }, 400);
        const j = await getJ(url);
        return json({ ok: true, url: j?.url || null, test: IS_TEST });
      }
      default:
        return json({ error: "bad_action", message: "알 수 없는 요청입니다." }, 400);
    }
  } catch (e: any) {
    return json({ error: "server", code: e?.code ?? null, message: e?.message || String(e) }, 502);
  }
});
