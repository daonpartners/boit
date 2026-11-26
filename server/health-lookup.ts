// 보잇 · 고객 자료 자동 불러오기 서버 기능 (Supabase Edge Function 'health-lookup')
// 홈택스 의료비(yearend) · 심평원 진료(start/finish) · 고객 직접 인증 링크(link_*). 내보험다보여는 고객 링크 함수 myins
// 1단계: 홈택스 연말정산간소화 소득세액공제자료 — 의료비 항목만 (CODEF 'income-tax-credit')
//   근거: developer.codef.io/products/public/each/c/income-tax-credit (업데이트 2026-08-24)
//   엔드포인트 데모 https://development.codef.io/v1/kr/public/nt/etc-yearend-tax/income-tax-credit · 정식 https://api.codef.io/…
//   간편인증 loginType "5"(회원 간편인증): identity=생년월일 8자리, userName, phoneNo, loginTypeLevel(1 카카오·3 삼성패스·4 KB·5 PASS·6 네이버·7 신한·8 토스·10 NH·11 우리), PASS는 telecom 필수
//   inquiryTypeCD 15자리 비트, index 3 = 의료비 → "000100000000000". 응답 CF-03002 + continue2Way → 고객 승인 후 is2Way/simpleAuth "1"/twoWayInfo로 2차 요청 (4분 30초 안)
//   id(요청 식별값)를 같게 주면 한 로그인 세션으로 여러 요청(연도별)을 순차 처리
// 비밀값: HL_PROVIDER=codef, HL_CLIENT_ID, HL_CLIENT_SECRET, HL_PUBLIC_KEY(인증서 비밀번호 암호화용 — 간편인증에선 안 씀), HL_MODE=demo|api (기본 demo)
// 원칙: 조회 결과는 저장하지 않고 바로 화면으로 돌려줌. 로그에 개인정보·금액을 남기지 않음.
// 사용 권한: 관리자(boit_admin)·테스터(boit_tester) 제한 없음 / 이용권 회원(boit_plan, 만료 전) 월 10회(조회 성공 기준, boit_hl_use) / 결제 전 회원 불가 (2026-11-26)
import { createClient } from "npm:@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";

const env = (k: string) => Deno.env.get(k) || "";
const HOST = env("HL_MODE") === "api" ? "https://api.codef.io" : "https://development.codef.io";
const YEAREND = "/v1/kr/public/nt/etc-yearend-tax/income-tax-credit";
// 3) 건강보험심사평가원 '내진료정보열람' (CODEF hw/my-medical-information) — 최근 5년, 주상병코드·주상병명·진료비
//   organization "0020", loginType "5", identity = 주민등록번호 13자리(필수), startDate·endDate(최대 5년), type "0"=민감상병 미포함, childYN "0"
//   출력: resBasicTreatList(진료시작일·병원·진단과·타입·주상병코드/명·내원일수·총진료비·혜택받은금액·내가낸의료비), resDetailTreatList(세부진료 코드명), resPrescribeDrugList(약품·총투약일수)
//   주의: 주상병코드·명은 "26.04.28 사이트에서 사라짐, 통신상 데이터 제공"(CODEF 문서). 주민번호는 조회에만 쓰고 저장·기록하지 않음
const HIRA = "/v1/kr/public/hw/hira-list/my-medical-information";
function rsa(plain: string) {
  const b64 = env("HL_PUBLIC_KEY").replace(/-----[^-]+-----|\s/g, "");
  const pem = "-----BEGIN PUBLIC KEY-----\n" + (b64.match(/.{1,64}/g) || []).join("\n") + "\n-----END PUBLIC KEY-----";
  const key = forge.pki.publicKeyFromPem(pem);
  return forge.util.encode64(key.encrypt(forge.util.encodeUtf8(plain), "RSAES-PKCS1-V1_5"));
}
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
// ===== 하이픈(HYPHEN) API마켓 — 2026-11-23 대표 지시로 CODEF 대신 (HL_PROVIDER=hyphen) =====
//   헤더 user-id(HY_USER_ID) · Hkey(HY_HKEY), 테스트 모드 HY_TEST=Y → 'Hyphen-Gustation: Y' (하이픈 테스트베드: 실 사용 환경처럼 조회, 월 100건 지원 — 하이픈 공지)
//   심평원 '내 진료내역 조회' POST /in0165001213 (간편인증 EASY: 1차 요청 → step_data → 고객 승인 → step_data 넣어 2차 요청)
//   홈택스 '연말정산간소화 소득/세액공제 자료 조회(개인 전용)' POST /in0076001151 (stepMode step: init → stepData → sign), 의료비 mateKndCd G0003, attrYr "2025,2024"
const HYP = env("HL_PROVIDER") === "hyphen";
// 홈택스 연말정산 의료비: in0076000350은 귀속연도 1개만 받음 → 여러 해를 한 번에 받는 in0076001151 사용 (하이픈 명세 attrYr ex) "2020,2019", 2026-11-24)
const YE_API = "/in0076001151";
async function hy(path: string, body: Record<string, unknown>) {
  const h: Record<string, string> = { "Content-Type": "application/json", "user-id": env("HY_USER_ID"), Hkey: env("HY_HKEY") };
  if (env("HY_TEST") === "Y") h["Hyphen-Gustation"] = "Y";
  const r = await fetch("https://api.hyphen.im" + path, { method: "POST", headers: h, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  if (!j) throw { code: "http_" + r.status, message: "하이픈 응답을 읽지 못했습니다 (" + r.status + ")" };
  return j;
}
const hyErr = (j: any) => String(j?.common?.errYn || "") === "Y";
const hyMsg = (j: any) => String(j?.common?.errMsg || j?.data?.errMsg || "조회에 실패했습니다.");
const HYAPP: Record<string, string> = { kakao: "kakao", samsung: "kica", kb: "kb", pass: "pass", naver: "naver", shinhan: "shinhan", toss: "toss", nh: "nh", woori: "woori" };
const HYTEL = (t: unknown) => ["S", "K", "L", "S", "K", "L"][Number(t) || 0] || "S";
function hyHira(b: any) {
  const rrn = digits(b.rrn).slice(0, 13), end = new Date(Date.now() + 9 * 3600e3), start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - 5); start.setUTCDate(start.getUTCDate() + 1);
  return { loginMethod: "EASY", step: HYAPP[String(b.app)] || "kakao", name: String(b.name || "").trim(), mobileNo: digits(b.phone), ssn1: rrn.slice(0, 6), ssn2: rrn.slice(6), sdate: ymd(start), edate: ymd(end), diseaseItemYn: "Y", sensitiveCondYn: b.sensitive ? "Y" : "N" } as Record<string, unknown>;
}
const hyHas = (d: any) => ["basicMedicalTreatmentInfoList", "personalCareInfoList", "detailedMedicalTreatmentInfoList", "prescriptionFormulationInfoList"].some((k) => Array.isArray(d?.[k]) && d[k].length);
function hyRows(d: any) {
  const A = (k: string) => (Array.isArray(d?.[k]) ? d[k] : []), out: any[] = [];
  const det = A("detailedMedicalTreatmentInfoList"), drug = A("prescriptionFormulationInfoList");
  for (const x of A("basicMedicalTreatmentInfoList")) {
    const sd = digits(x.treatmentStartDate), key = (y: any) => digits(y.treatmentStartDate) === sd && String(y.medicalCenter || "") === String(x.medicalCenter || "");
    const procs = det.filter(key).map((y: any) => String(y.codeName || y.medicalDetails || "")).filter(Boolean);
    out.push({ d: dash(sd), h: String(x.medicalCenter || "").trim(), dept: String(x.diagDept || ""), c: String(x.primaryDxCode || "").toUpperCase(), n: String(x.primaryDxName || ""),
      t: /입원/.test(String(x.inOutpatient || "")) ? "입원" : "외래", k: num(x.numberVisitDays) || 1, r: drug.filter(key).reduce((a: number, y: any) => Math.max(a, num(y.totalDosingDays)), 0),
      tot: num(x.totalMedicalExpenses), pay: num(x.amtBenefited), self: num(x.medicalExpensesIPaid), proc: procs.filter((t: string) => /수술|술(?=$|[\s(\[\-·])|절개|배농|냉동|소작|레이저|천자|흡인|차단|제거|봉합|생검|발치|레진|충전|크라운|임플란트|브릿지|의치|틀니|보철|인레이|아말감|치석|치근|치주|치수|근관|발수/.test(t)).slice(0, 8).join(", ") || procs.slice(0, 2).join(", ") });
  }
  return out.filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.d));
}
// 하이픈 심평원 1회 요청 → {rows} | {wait: step_data} | {err}
async function hyHiraCall(body: Record<string, unknown>, sd?: string) {
  const j = await hy("/in0165001213", sd ? { ...body, step_data: sd } : body), d = j?.data || {};
  if (hyErr(j)) return { err: hyMsg(j), code: String(j?.common?.errCd || ""), approve: /승인|인증|서명|대기|진행/.test(hyMsg(j)) };
  if (hyHas(d) || (sd && !d.step_data)) return { rows: hyRows(d) };
  if (d.step_data) return { wait: String(d.step_data) };
  return { rows: hyRows(d) };
}
// 홈택스 의료비 자료(info) — 하이픈 응답 구조가 문서에 'object'로만 나와 있어, 배열 속 금액·상호를 찾아 기존 표 모양으로 바꿈 (테스트 응답으로 확인 후 고정)
function hyTax(d: any, years: string[], me = "") {
  const by: Record<string, any[]> = {}; years.forEach((y) => (by[y] = []));
  const pickK = (o: any, re: RegExp) => { for (const k of Object.keys(o || {})) if (re.test(k) && o[k] != null && typeof o[k] !== "object") return String(o[k]); return ""; };
  const walk = (v: any, yr: string) => {
    if (Array.isArray(v)) { for (const x of v) walk(x, yr); return; }
    if (!v || typeof v !== "object") return;
    const y2 = pickK(v, /^(attrYr|yr|year|bsnsYr)$/i) || yr;
    const amt = pickK(v, /(amt|amount|금액|sum)/i), name = pickK(v, /(trade|tnm|bizNm|cmpNm|corpNm|상호|기관|hospNm|nm)$/i);
    if (amt && name && !Object.values(v).some((x) => Array.isArray(x))) {
      const who = pickK(v, /(resNm|userNm|famNm|성명)/i);
      (by[y2] = by[y2] || []).push({ item: "의료비", type: pickK(v, /(type|gb|kind|구분)/i), name, biz: pickK(v, /(bizNo|bno|사업자)/i), amount: amt.replace(/[^\d]/g, ""), amount1: "", who: who ? who.slice(0, 1) + "*" : "", me: !who || !me || who.trim() === me, n: 0 });
      return;
    }
    for (const x of Object.values(v)) if (x && typeof x === "object") walk(x, y2);
  };
  walk(d?.info, String(d?.attrYr || years[0] || ""));
  return by;
}
const keysOf = (v: any, depth = 0): unknown => (Array.isArray(v) ? [keysOf(v[0], depth + 1)] : v && typeof v === "object" && depth < 5 ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x && typeof x === "object" ? keysOf(x, depth + 1) : typeof x])) : typeof v);

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
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
function hiraBase(b: any) {
  const p = base(b); delete p.inquiryTypeCD; delete p.searchStartYear;
  const end = new Date(Date.now() + 9 * 3600e3), start = new Date(end); start.setUTCFullYear(start.getUTCFullYear() - 5); start.setUTCDate(start.getUTCDate() + 1);
  Object.assign(p, { organization: "0020", identity: digits(b.rrn).slice(0, 13), startDate: ymd(start), endDate: ymd(end), type: b.sensitive ? "1" : "0", childYN: "0" });
  return p;
}
const dash = (s: string) => (s = String(s || ""), s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s);
const num = (s: unknown) => Number(String(s ?? "").replace(/[^\d-]/g, "")) || 0;
function hiraRows(data: any) {
  const arr = Array.isArray(data) ? data : data ? [data] : [], out: any[] = [];
  for (const d of arr) {
    const det = Array.isArray(d?.resDetailTreatList) ? d.resDetailTreatList : [], drug = Array.isArray(d?.resPrescribeDrugList) ? d.resPrescribeDrugList : [];
    for (const x of (Array.isArray(d?.resBasicTreatList) ? d.resBasicTreatList : [])) {
      const key = (y: any) => y.resTreatStartDate === x.resTreatStartDate && y.resHospitalName === x.resHospitalName;
      const procs = det.filter(key).map((y: any) => String(y.resCodeName || "")).filter(Boolean);
      out.push({ d: dash(x.resTreatStartDate), h: String(x.resHospitalName || "").trim(), dept: String(x.resDepartment || ""), c: String(x.resDiseaseCode || "").toUpperCase(), n: String(x.resDiseaseName || ""),
        t: /입원/.test(String(x.resTreatType || "")) ? "입원" : "외래", k: num(x.resVisitDays) || 1, r: drug.filter(key).reduce((a: number, y: any) => Math.max(a, num(y.resTotalDosingdays)), 0),
        tot: num(x.resTotalAmount), pay: num(x.resPublicCharge), self: num(x.resDeductibleAmt), proc: procs.filter((t: string) => /수술|술(?=$|[\s(\[\-·])|절개|배농|냉동|소작|레이저|천자|흡인|차단|제거|봉합|생검|발치|레진|충전|크라운|임플란트|브릿지|의치|틀니|보철|인레이|아말감|치석|치근|치주|치수|근관|발수/.test(t)).slice(0, 8).join(", ") || procs.slice(0, 2).join(", ") }); // 수술·수술 여부 다툼 소지(절개·배농·냉동 등)·치과 보존·보철·처치 진료행위는 목록 어디에 있어도 잡음 (2026-11-17)
    }
  }
  return out.filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.d));
}
function pick(data: any, me = "") {
  const arr = Array.isArray(data) ? data : data ? [data] : [];
  const rows: any[] = [];
  for (const d of arr) {
    const item = String(d?.resDeductibleItem ?? "");
    for (const x of (Array.isArray(d?.resBasicList) ? d.resBasicList : [])) {
      rows.push({ item, type: x.resType || "", name: x.resCompanyNm || "", biz: x.resCompanyIdentityNo || "", amount: x.resAmountPayment || x.resAmount || "", amount1: x.resAmountPayment1 || x.resAmount1 || "", who: x.resUserNm ? String(x.resUserNm).slice(0, 1) + "*" : "", me: !x.resUserNm || !me || String(x.resUserNm).trim() === me, n: Array.isArray(x.resDetailList) ? x.resDetailList.length : 0 });
    }
  }
  return rows;
}
const done = (j: any, year: string, me = "") => { // me: 조회한 본인 이름 — 부양가족(자녀 등) 자료와 구분
  const code = j?.result?.code || "";
  if (code === "CF-03002" || j?.data?.continue2Way) {
    const d = j.data || {};
    return { ok: true, need2way: true, year, twoWayInfo: { jobIndex: d.jobIndex, threadIndex: d.threadIndex, jti: d.jti, twoWayTimestamp: d.twoWayTimestamp }, method: d.method || "" };
  }
  if (code !== "CF-00000") return { ok: false, code, message: j?.result?.message || "조회에 실패했습니다.", extra: j?.result?.extraMessage || "" };
  return { ok: true, year, rows: pick(j.data, me) };
};


// ===== 고객 직접 인증 (문자 링크) — 2026-11-17 =====
// 설계사: link_new(이름·생년월일·휴대폰) → 링크 boit.ai.kr/hl.html?t=토큰 → 고객이 열어 본인 주민번호 입력·동의·앱 승인
// 고객 화면(로그인 없음, ?pub=1): link_info → link_start(주민번호) → link_finish(job) → 결과는 암호화해 표에 잠깐 보관
// 설계사: link_get으로 결과 받으면 즉시 삭제. 30분 지나면 만료·삭제. 주민번호는 표에 저장하지 않음(고객 화면 ↔ CODEF 사이에서만 사용)
let LKEY: CryptoKey | null = null;
async function lkey() {
  if (LKEY) return LKEY;
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("boit-hl-link:" + env("SUPABASE_SERVICE_ROLE_KEY")));
  LKEY = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  return LKEY;
}
const b64 = (u: Uint8Array) => { let s = ""; for (const x of u) s += String.fromCharCode(x); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function enc(o: unknown) { const iv = crypto.getRandomValues(new Uint8Array(12)); const c = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await lkey(), new TextEncoder().encode(JSON.stringify(o)))); return b64(iv) + "." + b64(c); }
async function dec(s: string) { const [iv, c] = s.split("."); return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await lkey(), unb64(c)))); }
const mask = (n: string) => (n = String(n || ""), n.length <= 1 ? n : n.length === 2 ? n[0] + "*" : n[0] + "*".repeat(n.length - 2) + n.slice(-1));
async function linkRow(t: unknown) {
  await db.from("boit_hl_link").delete().lt("expires_at", new Date().toISOString());
  const tok = String(t || "");
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(tok)) return null;
  const { data } = await db.from("boit_hl_link").select("*").eq("token", tok).maybeSingle();
  return data;
}
// 이용권 회원 월 조회 한도 (2026-11-26). 한국시간 기준 달마다 새로 셈
const HL_LIMIT = 10;
const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString();
async function access(uid: string) {
  const { data: a } = await db.from("boit_admin").select("user_id").eq("user_id", uid).maybeSingle();
  if (a) return { unl: true, paid: false };
  const { data: t } = await db.from("boit_tester").select("user_id").eq("user_id", uid).maybeSingle();
  if (t) return { unl: true, paid: false };
  const { data: p } = await db.from("boit_plan").select("plan,expires").eq("user_id", uid).maybeSingle();
  return { unl: false, paid: !!p?.plan && p.plan !== "none" && (!p.expires || String(p.expires) >= kst().slice(0, 10)) };
}
async function usedN(uid: string) { const { data } = await db.from("boit_hl_use").select("n").eq("user_id", uid).eq("ym", kst().slice(0, 7)).maybeSingle(); return Number(data?.n || 0); }
async function addUse(uid: string) { await db.rpc("boit_hl_use_add", { uid, m: kst().slice(0, 7) }); }
async function linkSave(token: string, owner: string, rows: unknown[]) {
  if (owner && !(await access(owner)).unl) await addUse(owner); // 고객 링크 조회는 링크를 만든 설계사 횟수로 셈
  await db.from("boit_hl_link").update({ status: "done", enc: await enc(rows), msg: "", expires_at: new Date(Date.now() + 30 * 60e3).toISOString() }).eq("token", token);
}
const twOf = (d: any) => ({ jobIndex: d.jobIndex, threadIndex: d.threadIndex, jti: d.jti, twoWayTimestamp: d.twoWayTimestamp });
async function linkPublic(b: any) {
  const L = await linkRow(b.t);
  if (!L) return json({ error: "expired", message: "링크가 만료되었거나 이미 사용되었습니다. 담당 설계사에게 새 링크를 요청하세요." }, 404);
  if (b.action === "link_info") return json({ ok: true, name: mask(L.name), planner: L.planner, app: L.app, telecom: L.telecom, status: L.status });
  if (L.status === "done") return json({ error: "done", message: "이미 조회가 끝났습니다. 담당 설계사에게 전달되었습니다." }, 409);
  if (b.action === "link_start") {
    const oa = await access(L.owner);
    if (!oa.unl && !oa.paid) return json({ error: "forbidden", message: "담당 설계사의 이용권이 만료되어 조회할 수 없습니다. 담당 설계사에게 문의하세요." }, 403);
    if (!b.agree) return json({ error: "bad_input", message: "조회·제공 동의에 체크해 주세요." }, 400);
    if (L.tries >= 5) return json({ error: "too_many", message: "시도 횟수(5번)를 넘었습니다. 담당 설계사에게 새 링크를 요청하세요." }, 429);
    const app = APP[String(b.app)] ? String(b.app) : L.app;
    const p = hiraBase({ name: L.name, birth: L.birth, phone: L.phone, app, telecom: String(b.telecom ?? L.telecom), rrn: b.rrn, sid: "boit-link-" + L.token.slice(0, 10) + "-" + Date.now() });
    if (String(p.identity).length !== 13) return json({ error: "bad_input", message: "주민등록번호 13자리를 입력해 주세요." }, 400);
    if (String(p.identity).slice(0, 6) !== String(L.birth).slice(2, 8)) return json({ error: "bad_input", message: "주민등록번호 앞 6자리가 설계사가 입력한 생년월일과 다릅니다. 확인해 주세요." }, 400);
    await db.from("boit_hl_link").update({ tries: L.tries + 1, status: "auth", app }).eq("token", L.token);
    if (HYP) {
      const hb = hyHira({ name: L.name, phone: L.phone, app, rrn: b.rrn }), r = await hyHiraCall(hb);
      if (r.rows) { await linkSave(L.token, L.owner, r.rows); return json({ ok: true, done: true }); }
      if (r.wait) return json({ ok: true, job: { hy: hb, sd: r.wait } });
      await db.from("boit_hl_link").update({ status: "error", msg: String(r.err || "인증 요청 실패").slice(0, 200) }).eq("token", L.token);
      return json({ error: "provider", code: r.code, message: r.err });
    }
    const j = await codef(HIRA, p), code = j?.result?.code || "";
    if (code === "CF-03002" || j?.data?.continue2Way) return json({ ok: true, job: { p, tw: twOf(j.data || {}) } });
    if (code === "CF-00000") { await linkSave(L.token, L.owner, hiraRows(j.data)); return json({ ok: true, done: true }); }
    await db.from("boit_hl_link").update({ status: "error", msg: String(j?.result?.message || "인증 요청 실패").slice(0, 200) }).eq("token", L.token);
    return json({ error: "provider", code, message: (j?.result?.message || "인증 요청에 실패했습니다.") + (j?.result?.extraMessage ? " · " + j.result.extraMessage : "") });
  }
  if (b.action === "link_finish") {
    const job = b.job || {};
    if (HYP) {
      if (!job.hy || !job.sd || digits(job.hy.mobileNo) !== digits(L.phone)) return json({ error: "bad_job", message: "처음부터 다시 진행해 주세요." }, 400);
      const r = await hyHiraCall(job.hy, job.sd);
      if (r.rows) { await linkSave(L.token, L.owner, r.rows); return json({ ok: true, done: true }); }
      if (r.wait || r.approve) return json({ error: "not_approved", code: r.code, job: { hy: job.hy, sd: r.wait || job.sd }, message: r.err || "" });
      await db.from("boit_hl_link").update({ status: "error", msg: String(r.err || "조회 실패").slice(0, 200) }).eq("token", L.token);
      return json({ error: "provider", code: r.code, message: r.err });
    }
    if (!job.p || !job.tw || job.p.organization !== "0020" || digits(job.p.phoneNo) !== digits(L.phone)) return json({ error: "bad_job", message: "처음부터 다시 진행해 주세요." }, 400);
    const j = await codef(HIRA, { ...job.p, simpleAuth: "1", is2Way: true, twoWayInfo: job.tw }), code = j?.result?.code || "";
    if (code === "CF-00000") { await linkSave(L.token, L.owner, hiraRows(j.data)); return json({ ok: true, done: true }); }
    if (code === "CF-03002" || j?.data?.continue2Way) return json({ error: "not_approved", code, job: { p: job.p, tw: twOf(j.data || {}) } });
    if (code === "CF-12872" || /승인|인증/.test(String(j?.result?.message || ""))) return json({ error: "not_approved", code, message: j?.result?.message || "" });
    if (/동일한 요청|중복 요청/.test(String(j?.result?.message || ""))) return json({ error: "busy", code, job }); // 앞선 확인이 처리 중 → 고객 화면이 잠시 뒤 다시 확인
    await db.from("boit_hl_link").update({ status: "error", msg: String(j?.result?.message || "조회 실패").slice(0, 200) }).eq("token", L.token);
    return json({ error: "provider", code, message: (j?.result?.message || "불러오지 못했습니다.") + (j?.result?.extraMessage ? " · " + j.result.extraMessage : "") });
  }
  return json({ error: "bad_action", message: "알 수 없는 요청입니다." }, 400);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (HYP ? !env("HY_USER_ID") || !env("HY_HKEY") : env("HL_PROVIDER") !== "codef" || !env("HL_CLIENT_ID") || !env("HL_CLIENT_SECRET")) return json({ error: "not_configured", message: "조회 업체 키가 설정되지 않았습니다.", provider: env("HL_PROVIDER") || "(없음)", hyUser: !!env("HY_USER_ID"), hyKey: !!env("HY_HKEY") });
  if (HYP && new URL(req.url).searchParams.get("check") === "key") return json({ ok: true, provider: "hyphen", test: env("HY_TEST") === "Y", ye: YE_API });
  // 하이픈 테스트 모드 점검 (관리자 확인용, 예시 응답만): ?hytest=1 + x-watch-key
  if (HYP && env("HY_TEST") === "Y" && new URL(req.url).searchParams.get("hytest") === "1") {
    const { data: cfg } = await db.from("boit_config").select("v").eq("k", "watch_key").maybeSingle();
    if (!cfg?.v || req.headers.get("x-watch-key") !== cfg.v) return json({ error: "forbidden" }, 403);
    const T = new URL(req.url).searchParams.get("t") || "hira", wait = () => new Promise((r) => setTimeout(r, 21000)); // 테스트 요청은 20초에 1번
    if (T === "hira") { const r1: any = await hy("/in0165001213", hyHira({ name: "홍길동", phone: "01012345678", app: "kakao", rrn: "9001011234568" })).catch((e) => ({ err: e?.message }));
      return json({ hira: { common: r1?.common, keys: keysOf(r1?.data), step_data: !!r1?.data?.step_data, rows: hyRows(r1?.data).slice(0, 3), n: hyRows(r1?.data).length } }); }
    if (T === "hira2") { const sd = new URL(req.url).searchParams.get("sd") || ""; const r1: any = await hy("/in0165001213", { ...hyHira({ name: "홍길동", phone: "01012345678", app: "kakao", rrn: "9001011234568" }), step_data: sd }).catch((e) => ({ err: e?.message }));
      return json({ hira2: { common: r1?.common, keys: keysOf(r1?.data), rows: hyRows(r1?.data).slice(0, 3), n: hyRows(r1?.data).length } }); }
    if (T === "tax") { const yrs = [String(new Date().getFullYear() - 1)], q = { loginMethod: "EASY", loginOrgCd: "kakao", resNm: "홍길동", resNo: "19900101", mobileNo: "01012345678", stepMode: "step", mateKndCd: "G0003", attrYr: yrs.join(",") };
      const t1: any = await hy("/in0076000350", { ...q, step: "init" }).catch((e) => ({ err: e?.message })); await wait();
      const t2: any = await hy("/in0076000350", { ...q, step: "sign", stepData: t1?.data?.stepData || "" }).catch((e) => ({ err: e?.message }));
      return json({ tax1: { common: t1?.common, keys: keysOf(t1?.data) }, tax2: { common: t2?.common, keys: keysOf(t2?.data), info: t2?.data?.info, rows: hyTax(t2?.data, yrs) } }); }
    if (T === "ins") { const ins: Record<string, unknown> = {};
      for (const pth of ["/in0017000048", "/in0017000050", "/in0017000052"]) { const x: any = await hy(pth, { userId: "testuser1", userPw: "testpw1234!" }).catch((e) => ({ err: e?.message })); ins[pth] = { common: x?.common, keys: keysOf(x?.data), n: Array.isArray(x?.data?.list) ? x.data.list.length : null, first: Array.isArray(x?.data?.list) ? x.data.list[0] : null }; if (pth !== "/in0017000052") await wait(); }
      return json({ ins }); }
    return json({ error: "t" });
  }
  if (new URL(req.url).searchParams.get("check") === "key") { let rsaOk = false; try { rsaOk = rsa("t").length > 20; } catch (_) { rsaOk = false; } return json({ ok: true, tokenOk: await token().then(() => true).catch(() => false), rsaOk }); } // 키·암호화 확인만 (조회·개인정보 없음)
  // 고객 화면(로그인 없음): 링크 토큰으로만 동작
  if (new URL(req.url).searchParams.get("pub") === "1") { let pb: any = {}; try { pb = await req.json(); } catch (_) { /* */ } try { return await linkPublic(pb); } catch (e: any) { return json({ error: "provider_error", code: e?.code || null, message: e?.message || String(e) }, 502); } }
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(jwt);
  if (!u?.user) return json({ error: "login_required", message: "보잇에 다시 로그인하세요." }, 401);
  // 관리자·테스터(boit_tester, 테스터 코드로 등록) 제한 없음 / 이용권 회원 월 10회 (2026-11-26)
  const ac = await access(u.user.id);
  const adm = ac.unl;
  let b: any = {};
  try { b = await req.json(); } catch (_) { /* 빈 요청 */ }
  const used = adm || !ac.paid ? 0 : await usedN(u.user.id);
  if (b.action === "ping") return json({ ok: true, provider: HYP ? "hyphen" : "codef", mode: HYP ? (env("HY_TEST") === "Y" ? "demo" : "api") : HOST.includes("development") ? "demo" : "api", admin: !!adm, paid: ac.paid, limit: adm ? null : HL_LIMIT, used });
  if (!adm && !ac.paid) return json({ error: "forbidden", message: "자동 불러오기는 이용권 결제 후 쓸 수 있습니다. (마이페이지 → 이용권 결제)" }, 403);
  const isNew = b.action === "start" || b.action === "link_new" || (b.action === "yearend" && !b.twoWayInfo);
  if (!adm && isNew && used >= HL_LIMIT) return json({ error: "quota", message: `이번 달 조회 ${HL_LIMIT}회를 모두 쓰셨습니다. 다음 달 1일에 다시 채워집니다.`, limit: HL_LIMIT, used }, 429);
  const ok = async () => { if (!adm) await addUse(u.user.id); }; // 조회 성공 1건마다 1회
  try {
    if (b.action === "token") { if (!HYP) await token(); return json({ ok: true }); }
    if (HYP && b.action === "start") {
      const rrn = digits(b.rrn);
      if (rrn.length !== 13) return json({ error: "bad_input", message: "심평원 조회는 주민등록번호 13자리가 필요합니다 (조회에만 쓰고 저장하지 않음)." }, 400);
      if (!String(b.name || "").trim() || digits(b.phone).length < 10) return json({ error: "bad_input", message: "이름·휴대폰번호를 확인하세요." }, 400);
      const hb = hyHira(b), r = await hyHiraCall(hb);
      if (r.rows) { await ok(); return json({ ok: true, job: { rows: r.rows } }); }
      if (r.wait) return json({ ok: true, job: { src: "hira", hy: hb, sd: r.wait, tw: 1 } });
      return json({ error: "provider", code: r.code, message: r.err });
    }
    if (HYP && b.action === "finish") {
      const job = b.job || {};
      if (job.rows) return json({ ok: true, rows: job.rows });
      if (!job.hy || !job.sd) return json({ error: "bad_job", message: "인증 요청부터 다시 하세요." }, 400);
      const r = await hyHiraCall(job.hy, job.sd);
      if (r.rows) { await ok(); return json({ ok: true, rows: r.rows }); }
      if (r.wait || r.approve) return json({ error: "not_approved", code: r.code, job: { src: "hira", hy: job.hy, sd: r.wait || job.sd, tw: 1 }, message: r.err || "" });
      return json({ error: "provider", code: r.code, message: r.err });
    }
    if (HYP && b.action === "yearend") {
      const years = (Array.isArray(b.years) && b.years.length ? b.years : [b.year]).map((y: unknown) => String(y).slice(0, 4)).filter((y: string) => /^\d{4}$/.test(y)).slice(0, 5);
      const name = String(b.name || "").trim(), birth = digits(b.birth).slice(0, 8), phone = digits(b.phone);
      if (!years.length || !name || birth.length !== 8 || phone.length < 10) return json({ error: "bad_input", message: "이름·생년월일 8자리·휴대폰번호를 확인하세요." }, 400);
      const q: Record<string, unknown> = { loginMethod: "EASY", loginOrgCd: HYAPP[String(b.app)] || "kakao", resNm: name, bizNm: name, resNo: birth, mobileNo: phone, stepMode: "step", mateKndCd: "G0003", attrYr: years.join(",") };
      if (q.loginOrgCd === "pass") q.mobileCo = HYTEL(b.telecom);
      const tw = b.twoWayInfo || null;
      if (!tw?.stepData) {
        const j = await hy(YE_API, { ...q, step: "init" });
        if (hyErr(j)) return json({ ok: false, provider: "hyphen", code: j?.common?.errCd || "", message: hyMsg(j) });
        return json({ ok: true, provider: "hyphen", need2way: true, years, twoWayInfo: { hy: 1, stepData: String(j?.data?.stepData || "") } });
      }
      const j = await hy(YE_API, { ...q, step: "sign", stepData: String(tw.stepData) });
      if (hyErr(j)) { const m = hyMsg(j); if (/승인|인증|서명/.test(m)) return json({ ok: true, provider: "hyphen", need2way: true, years, twoWayInfo: tw, message: m }); return json({ ok: false, provider: "hyphen", code: j?.common?.errCd || "", message: m }); }
      await ok();
      return json({ ok: true, provider: "hyphen", years, byYear: hyTax(j.data, years, name) });
    }
    // 진료내역: start(인증 요청) → 고객 승인 → finish(job) — 심평원만 (건강보험공단·내보험다보여 설계사 입력은 2026-11-17 삭제)
    if (b.action === "start") {
      const sid = b.sid || "boit-" + u.user.id.slice(0, 8) + "-" + Date.now();
      const p = hiraBase({ ...b, sid });
      if (String(p.identity).length !== 13) return json({ error: "bad_input", message: "심평원 조회는 주민등록번호 13자리가 필요합니다 (조회에만 쓰고 저장하지 않음)." }, 400);
      if (!p.userName || String(p.phoneNo).length < 10) return json({ error: "bad_input", message: "이름·휴대폰번호를 확인하세요." }, 400);
      const j = await codef(HIRA, p), code = j?.result?.code || "";
      if (code === "CF-03002" || j?.data?.continue2Way) return json({ ok: true, job: { src: "hira", p, tw: twOf(j.data || {}) } });
      if (code === "CF-00000") { await ok(); return json({ ok: true, job: { rows: hiraRows(j.data) } }); }
      return json({ error: "provider", code, message: (j?.result?.message || "인증 요청에 실패했습니다.") + (j?.result?.extraMessage ? " · " + j.result.extraMessage : "") });
    }
    if (b.action === "finish") {
      const job = b.job || {};
      if (job.rows) return json({ ok: true, rows: job.rows });
      if (!job.p || !job.tw) return json({ error: "bad_job", message: "인증 요청부터 다시 하세요." }, 400);
      if (job.p.organization !== "0020") return json({ error: "bad_job", message: "인증 요청부터 다시 하세요." }, 400);
      const j = await codef(HIRA, { ...job.p, simpleAuth: "1", is2Way: true, twoWayInfo: job.tw }), code = j?.result?.code || "";
      if (code === "CF-00000") { await ok(); return json({ ok: true, rows: hiraRows(j.data) }); }
      if (code === "CF-03002" || j?.data?.continue2Way) return json({ error: "not_approved", code, job: { src: "hira", p: job.p, tw: twOf(j.data || {}) }, message: "추가 확인이 필요합니다" });
      if (code === "CF-12872" || /승인|인증/.test(String(j?.result?.message || ""))) return json({ error: "not_approved", code, message: j?.result?.message || "" });
      return json({ error: "provider", code, message: (j?.result?.message || "불러오지 못했습니다.") + (j?.result?.extraMessage ? " · " + j.result.extraMessage : "") });
    }
    if (b.action === "link_new") {
      const name = String(b.name || "").trim(), birth = digits(b.birth).slice(0, 8), phone = digits(b.phone);
      if (!name || birth.length !== 8 || phone.length < 10) return json({ error: "bad_input", message: "이름·생년월일 8자리·휴대폰번호를 확인하세요." }, 400);
      const tok = b64(crypto.getRandomValues(new Uint8Array(24))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const { error } = await db.from("boit_hl_link").insert({ token: tok, owner: u.user.id, planner: String(b.planner || "").slice(0, 30), name: name.slice(0, 30), birth, phone, app: APP[String(b.app)] ? String(b.app) : "kakao", telecom: String(b.telecom ?? "0") });
      if (error) return json({ error: "db", message: "링크를 만들지 못했습니다." }, 500);
      return json({ ok: true, token: tok });
    }
    if (b.action === "link_get") {
      const L = await linkRow(b.t);
      if (!L || L.owner !== u.user.id) return json({ error: "expired", message: "링크가 만료되었습니다(30분). 새 링크를 보내 주세요." }, 404);
      if (L.status !== "done") return json({ ok: true, status: L.status, msg: L.msg });
      const rows = L.enc ? await dec(L.enc) : [];
      await db.from("boit_hl_link").delete().eq("token", L.token);
      return json({ ok: true, status: "done", rows });
    }
    if (b.action === "link_del") { await db.from("boit_hl_link").delete().eq("token", String(b.t || "")).eq("owner", u.user.id); return json({ ok: true }); }
    if (b.action === "yearend") {
      const p = base(b);
      if (String(p.identity).length !== 8 || !p.userName || String(p.phoneNo).length < 10) return json({ error: "bad_input", message: "이름·생년월일 8자리·휴대폰번호를 확인하세요." }, 400);
      if (b.twoWayInfo) Object.assign(p, { simpleAuth: "1", is2Way: true, twoWayInfo: b.twoWayInfo });
      const out: any = done(await codef(YEAREND, p), String(p.searchStartYear || ""), String(p.userName || ""));
      if (out.ok && !out.need2way) await ok();
      return json(out);
    }
    return json({ error: "bad_action", message: "알 수 없는 요청입니다." }, 400);
  } catch (e: any) {
    return json({ error: "provider_error", code: e?.code || null, message: e?.message || String(e) }, 502);
  }
});
