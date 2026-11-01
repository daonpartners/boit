// 보잇 · 고객 '내 보험 불러오기' (boit.ai.kr/myins/?a=설계사코드) — Supabase Edge Function 'myins'
// 고객 화면(로그인 없음): info → start(내보험다보여 아이디·비밀번호 + 본인정보) → next(보안문자·문자 인증번호·PASS 승인) → 완료
//   CODEF 신용정보원 '내보험다보여' 계약정보 /v1/kr/insurance/0001/credit4u/contract-info (업데이트 2026-08-24)
//   추가인증: CF-03002 + continue2Way → extraInfo.reqSecureNo(보안문자) / reqSMSAuthNo(문자) / commSimpleAuth(PASS) → is2Way + twoWayInfo 로 2차 요청
// 설계사 화면(보잇 로그인): list(받은 결과 보기 · 복호화) → del(가져간 뒤 삭제)
// 원칙: 아이디·비밀번호·주민번호는 조회에만 쓰고 저장·기록하지 않음(비밀번호는 브라우저→서버 HTTPS, 서버에서 바로 RSA 암호화해 CODEF로).
//   결과만 서버 비밀키(SMS_ENC_KEY에서 파생한 별도 열쇠)로 암호화해 boit_myins에 보관, 30일 뒤 자동 삭제(server/myins.sql)
//   로그에 이름·번호·결과를 남기지 않음
// 시범 기간(HL_MODE가 api가 아닐 때 = CODEF 데모 키 하루 100회): 관리자(boit_admin) 설계사의 링크만 동작
// 정식(HL_MODE=api): 이용권(boit_plan, 만료일 전)이 있는 설계사 링크만 동작
// 남용 제한: 같은 접속 1시간 6회, 설계사 1명 하루 60회 시도
// 배포: supabase functions deploy myins --no-verify-jwt
import { createClient } from "npm:@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";

const env = (k: string) => Deno.env.get(k) || "";
const API = env("HL_MODE") === "api";
const HOST = API ? "https://api.codef.io" : "https://development.codef.io";
const C4U = "/v1/kr/insurance/0001/credit4u/contract-info";
const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const no = (message: string, s = 400, extra: Record<string, unknown> = {}) => out({ ok: false, message, ...extra }, s);
const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const since = (min: number) => new Date(Date.now() - min * 60000).toISOString();
const fmtPhone = (p: string) => p.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");

/* ---- CODEF ---- */
function rsa(plain: string) {
  const b64 = env("HL_PUBLIC_KEY").replace(/-----[^-]+-----|\s/g, "");
  const pem = "-----BEGIN PUBLIC KEY-----\n" + (b64.match(/.{1,64}/g) || []).join("\n") + "\n-----END PUBLIC KEY-----";
  return forge.util.encode64(forge.pki.publicKeyFromPem(pem).encrypt(forge.util.encodeUtf8(plain), "RSAES-PKCS1-V1_5"));
}
let TOKEN: { t: string; exp: number } | null = null;
async function token() {
  if (TOKEN && TOKEN.exp > Date.now() + 60_000) return TOKEN.t;
  const r = await fetch("https://oauth.codef.io/oauth/token", { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", Authorization: "Basic " + btoa(`${env("HL_CLIENT_ID")}:${env("HL_CLIENT_SECRET")}`) }, body: "grant_type=client_credentials&scope=read" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error("token");
  TOKEN = { t: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return TOKEN.t;
}
async function codef(body: Record<string, unknown>) {
  const r = await fetch(HOST + C4U, { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: "Bearer " + (await token()) }, body: encodeURIComponent(JSON.stringify(body)) });
  const t = await r.text();
  try { return JSON.parse(decodeURIComponent(t.replace(/\+/g, " "))); } catch (_) { try { return JSON.parse(t); } catch (_) { throw new Error("http_" + r.status); } }
}
// 결과 정리 — 계약·담보·실손 지급내역만 (보잇 미청구 찾기·보장분석과 같은 모양: {contracts, payments})
function parse(d: any) {
  d = Array.isArray(d) ? d[0] || {} : d || {};
  const L = (k: string) => (Array.isArray(d[k]) ? d[k] : []);
  const cov = (x: any) => (Array.isArray(x.resCoverageLists) ? x.resCoverageLists : []).map((c: any) => ({ name: String(c.resCoverageName || ""), amount: String(c.resCoverageAmount || ""), type: String(c.resAgreementType || c.resType || ""), status: String(c.resCoverageStatus || ""), insured: String(c.resInsuredPerson || ""), start: String(c.commStartDate || ""), end: String(c.commEndDate || ""), object: String(c.resObject || "") }));
  const con = (kind: string) => (x: any) => ({ kind, company: String(x.resCompanyNm || ""), product: String(x.resInsuranceName || ""), policy: String(x.resPolicyNumber || ""), status: String(x.resContractStatus || ""), start: String(x.commStartDate || x.resDateOfContract || ""), end: String(x.commEndDate || ""), premium: digits(x.resPremium), cycle: String(x.resPaymentCycle || ""), period: String(x.resPaymentPeriod || ""), insured: String(x.resInsuredPerson || ""), car: String(x.commCarName || ""), covers: cov(x) });
  const contracts = [...L("resActualLossContractList").map(con("실손")), ...L("resFlatRateContractList").map(con("정액")), ...L("resPropertyContractList").map(con("화재·특종")), ...L("resCarContractList").map(con("자동차")), ...L("resSavingsContractList").map(con("저축"))];
  const payments = L("resActualLossPaymentList").map((x: any) => ({ company: String(x.resCompanyNm || ""), product: String(x.resInsuranceName || ""), occur: String(x.resOccurDateTime || ""), total: String(x.resTotalAmount || ""),
    details: (Array.isArray(x.resDetailList) ? x.resDetailList : []).map((y: any) => ({ type: String(y.resType || ""), reason: String(y.resReasonForPayment || ""), paid: String(y.resPaidAmount || ""), date: String(y.resPaymentDate || ""), judge: String(y.resJudgeResult || "") })) }));
  // 또래(평균그룹) 비교 — 신용정보원 분석통계 그대로
  const stats = { flat: L("resFlatRateStatisticsList").map((x: any) => ({ name: String(x.resCoverageName || ""), self: String(x.resSelfCoverageAmt || ""), avg: String(x.resAvgGroupCoverageAmt || "") })),
    loss: L("resActualLossStatisticsList").map((x: any) => ({ name: String(x.resCoverageName || ""), self: String(x.resSelfRegYN || ""), avgRate: String(x.resAvgGroupRegRate || "") })) };
  return { contracts, payments, stats };
}

/* ---- 결과 암호화 (SMS_ENC_KEY → HKDF로 이 기능 전용 열쇠) ---- */
const b64e = (a: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(a)));
const b64d = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
let KEY: CryptoKey | null = null;
async function key() {
  if (KEY) return KEY;
  const base = await crypto.subtle.importKey("raw", b64d(env("SMS_ENC_KEY")), "HKDF", false, ["deriveKey"]);
  KEY = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("boit-myins"), info: new TextEncoder().encode("v1") }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  return KEY;
}
async function seal(o: unknown) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(JSON.stringify(o))); return { enc: b64e(ct), iv: b64e(iv) }; }
async function open(enc: string, iv: string) { const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(iv) }, await key(), b64d(enc)); return JSON.parse(new TextDecoder().decode(pt)); }

/* ---- 링크 주인(설계사) ---- */
async function advisor(code: string) {
  if (!/^[a-z0-9]{6,12}$/.test(code)) return null;
  const { data } = await sb.from("boit_apply").select("user_id,name,org,active").eq("code", code).maybeSingle();
  if (!data || !data.active) return null;
  const { data: u } = await sb.auth.admin.getUserById(data.user_id);
  if (!u?.user?.phone_confirmed_at) return null;
  let allowed = false;
  if (!API) { const { data: a } = await sb.from("boit_admin").select("user_id").eq("user_id", data.user_id).maybeSingle(); allowed = !!a; }
  else { const { data: p } = await sb.from("boit_plan").select("plan,expires").eq("user_id", data.user_id).maybeSingle(); allowed = !!p && p.plan && p.plan !== "none" && (!p.expires || p.expires >= new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)); }
  return { id: data.user_id as string, name: data.name as string, org: data.org as string, allowed };
}

// CODEF 응답 → 고객 화면 다음 단계
async function step(j: any, p: Record<string, unknown>, adv: { id: string }, who: { name: string; phone: string }) {
  const code = j?.result?.code || "";
  if (code === "CF-00000") {
    const r = parse(j.data);
    const s = await seal(r);
    const { error } = await sb.from("boit_myins").insert({ user_id: adv.id, name: who.name, phone: who.phone, n_contracts: r.contracts.length, enc: s.enc, iv: s.iv });
    if (error) { console.log("myins_insert", error.message); return no("저장하지 못했습니다. 다시 시도해 주세요.", 500); }
    return out({ ok: true, done: true, n: r.contracts.length, kinds: [...new Set(r.contracts.map((c) => c.kind))] });
  }
  if (code === "CF-03002" || j?.data?.continue2Way) {
    const d = j.data || {}, x = d.extraInfo || {};
    const need = x.reqSecureNo ? "secure" : x.reqSMSAuthNo !== undefined && !x.commSimpleAuth ? "sms" : "pass";
    return out({ ok: true, need, img: x.reqSecureNo || "", job: { p, tw: { jobIndex: d.jobIndex, threadIndex: d.threadIndex, jti: d.jti, twoWayTimestamp: d.twoWayTimestamp } } });
  }
  const msg = String(j?.result?.message || ""), extra = String(j?.result?.extraMessage || "");
  // 자주 나오는 오류는 쉬운 말로
  if (code === "CF-12827") return no("아이디 또는 비밀번호 형식이 맞지 않습니다. 내보험다보여 아이디(6~12자)·비밀번호(9~20자, 영문·숫자·특수문자)를 확인해 주세요.");
  if (code === "CF-12831") return no("내보험다보여 본인인증이 필요합니다. 아래 본인인증 정보를 입력하고 다시 눌러 주세요.", 400, { needAuth: true });
  return no((msg || "조회하지 못했습니다.") + (extra ? " (" + extra + ")" : ""), 400, { code });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return no("method", 405);
  let b: any = {};
  try { b = await req.json(); } catch (_) { return no("잘못된 요청입니다."); }
  const act = String(b.act || "");

  /* ---- 설계사 (보잇 로그인) ---- */
  if (act === "list" || act === "del") {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(jwt);
    if (!u?.user) return no("보잇에 다시 로그인하세요.", 401);
    if (act === "del") {
      const ids = (Array.isArray(b.ids) ? b.ids : []).map(Number).filter(Boolean).slice(0, 100);
      if (ids.length) await sb.from("boit_myins").delete().eq("user_id", u.user.id).in("id", ids);
      return out({ ok: true });
    }
    const { data, error } = await sb.from("boit_myins").select("id,name,phone,n_contracts,enc,iv,created_at").eq("user_id", u.user.id).order("created_at", { ascending: false }).limit(50);
    if (error) return no("불러오지 못했습니다.", 500);
    const rows = [];
    for (const r of data || []) { try { rows.push({ id: r.id, name: r.name, phone: r.phone, n: r.n_contracts, at: r.created_at, ins: await open(r.enc, r.iv) }); } catch (_) { rows.push({ id: r.id, name: r.name, phone: r.phone, n: r.n_contracts, at: r.created_at, ins: null }); } }
    return out({ ok: true, rows });
  }

  /* ---- 고객 (로그인 없음) ---- */
  if (env("HL_PROVIDER") !== "codef" || !env("HL_CLIENT_ID") || !env("SMS_ENC_KEY")) return no("지금은 이용할 수 없습니다. 담당 설계사에게 문의해 주세요.", 503);
  const adv = await advisor(String(b.a || "").toLowerCase());
  if (!adv) return no("링크가 올바르지 않습니다. 담당 설계사에게 다시 받아 주세요.", 404);
  if (act === "info") return out({ ok: true, name: adv.name, org: adv.org, open: adv.allowed });
  if (!adv.allowed) return no(API ? "담당 설계사의 보잇 이용권이 확인되지 않습니다. 담당 설계사에게 문의해 주세요." : "아직 시범 운영 중인 기능입니다. 담당 설계사에게 문의해 주세요.", 403);

  const name = String(b.name || "").replace(/\s+/g, " ").trim(), phone = digits(b.phone);
  if (name.length < 2 || name.length > 20 || /[<>]/.test(name)) return no("이름을 확인해 주세요.");
  if (!/^01\d{8,9}$/.test(phone)) return no("휴대폰번호를 확인해 주세요.");
  const who = { name, phone: fmtPhone(phone) };

  try {
    if (act === "start") {
      if (b.agree !== true) return no("개인(신용)정보 조회·제공에 동의해 주세요.");
      const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64);
      const cnt = async (col: string, val: string, min: number) => (await sb.from("boit_myins_try").select("id", { count: "exact", head: true }).eq(col, val).gte("created_at", since(min))).count || 0;
      if (ip && (await cnt("ip", ip, 60)) >= 6) return no("시도가 너무 많습니다. 1시간 뒤 다시 해 주세요.", 429);
      if ((await cnt("user_id", adv.id, 1440)) >= 60) return no("오늘은 더 조회할 수 없습니다. 담당 설계사에게 문의해 주세요.", 429);
      await sb.from("boit_myins_try").insert({ user_id: adv.id, ip });
      const id = String(b.cid || "").trim(), pw = String(b.cpw || "");
      if (!/^[A-Za-z0-9]{6,12}$/.test(id)) return no("내보험다보여 아이디를 확인해 주세요 (영문·숫자 6~12자).");
      if (pw.length < 9 || pw.length > 20) return no("내보험다보여 비밀번호를 확인해 주세요 (9~20자).");
      const p: Record<string, unknown> = { organization: "0001", id, password: rsa(pw), type: "0", userName: name, phoneNo: phone, telecom: String(b.telecom ?? "0").replace(/[^0-5]/g, "") || "0", authMethod: b.auth === "sms" ? "0" : "1", timeOut: "160" };
      const birth = digits(b.birth); if (birth.length === 8) p.birthDate = birth.slice(2); else if (birth.length === 6) p.birthDate = birth;
      return await step(await codef(p), p, adv, who);
    }
    if (act === "next") {
      const job = b.job || {};
      if (!job.p || !job.tw || job.p.organization !== "0001") return no("처음부터 다시 해 주세요.");
      const q: Record<string, unknown> = { ...job.p, is2Way: true, twoWayInfo: job.tw, secureNoRefresh: b.refresh ? "1" : "0" };
      if (b.secureNo) q.secureNo = String(b.secureNo).slice(0, 12);
      if (b.smsAuthNo) q.smsAuthNo = digits(b.smsAuthNo).slice(0, 8);
      if (b.pass) q.simpleAuth = "1";
      return await step(await codef(q), job.p, adv, who);
    }
  } catch (e) {
    console.log("myins_err", String((e as Error)?.message || e).slice(0, 80));
    return no("내보험다보여 연결 중 문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.", 502);
  }
  return no("잘못된 요청입니다.");
});
