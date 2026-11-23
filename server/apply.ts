// 보잇 · 고객 상담신청 (boit.ai.kr/apply/?a=설계사코드)
// 링크: ?a=설계사코드&i=mz|kb|mi (설계사가 보험사를 골라 고객에게 보냄)
// 흐름: info(설계사 표시) → submit(boit_leads 저장) → 고객은 설계사가 고른 보험사 공식 인증·동의 화면으로 이동
// 고객에게 보내는 문자 없음. 2026-11-23부터 새 신청이 들어오면 담당 설계사에게 알림 문자(다온 부담, 하루 30건까지) — 이전 결정(2026-10-25 문자 0건)을 바꿈
// 배포: supabase functions deploy apply --no-verify-jwt  (고객은 로그인하지 않음 · 남용은 횟수 제한으로 막음)
// 원칙: 로그에 이름·번호를 남기지 않음. 주민등록번호는 받지 않음 (보험사 공식 화면에서 고객이 직접 입력).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const env = (k: string) => Deno.env.get(k) || "";
const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const no = (msg: string, s = 400) => out({ ok: false, error: msg }, s);

export const PRODUCTS = ["간병인", "치매치료", "치아", "펫", "암", "건강종합", "어린이", "운전자", "화재", "연금"];
const LINK_HOSTS = /(^|\.)(meritzfire\.com|kbinsure\.co\.kr|miraeasset\.com)$/i;
const LABEL: Record<string, string> = { mz: "메리츠화재", kb: "KB손해보험", mi: "미래에셋생명" };

const krLocal = (p: string) => { const d = String(p || "").replace(/\D/g, ""); return d.startsWith("82") ? "0" + d.slice(2) : d; };
const fmt = (p: string) => p.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
const since = (min: number) => new Date(Date.now() - min * 60000).toISOString();

// 원수사 링크: 메리츠는 조직코드(숫자)만 넣어도 됨. KB는 설계사(LC) 코드 → 가입설계 동의 화면 + 고객이 코드 입력.
// 그 외는 허용된 보험사 공식 주소(https)만.
const KB_CONSENT = "https://www.kbinsure.co.kr/CG110040001.ecs"; // KB손해보험 가입설계 동의 (LC 코드 직접 입력, 링크로 미리 채울 수 없음)
function linkOf(k: string, v: unknown): { url: string; code: string } {
  const s = String(v || "").trim();
  if (k === "mz" && /^\d{6,12}$/.test(s)) return { url: "https://msea.meritzfire.com/mblCusReg.do?orgCd=" + s, code: "" };
  if (k === "kb" && /^[a-z]?\d{6,8}$/i.test(s)) return { url: KB_CONSENT, code: s };
  try { const u = new URL(s); if (u.protocol === "https:" && LINK_HOSTS.test(u.hostname)) return { url: u.toString(), code: "" }; } catch (_) { /* 무시 */ }
  return { url: "", code: "" };
}
async function advisor(code: string) {
  if (!/^[a-z0-9]{6,12}$/.test(code)) return null;
  const { data } = await sb.from("boit_apply").select("user_id,name,org,links,show,active").eq("code", code).maybeSingle();
  if (!data || !data.active) return null;
  const { data: u } = await sb.auth.admin.getUserById(data.user_id);
  const user = u?.user;
  if (!user || !user.phone || !user.phone_confirmed_at) return null; // 휴대폰 인증한 보잇 회원만
  // 등록된 원수사 링크 전부 (고객 링크의 i=mz|kb|mi 로 하나를 고름)
  const links = Object.keys(LABEL).map((k) => ({ k, label: LABEL[k], ...linkOf(k, (data.links || {})[k]) })).filter((x) => x.url);
  return { id: data.user_id as string, name: data.name as string, org: data.org as string, phone: krLocal(user.phone), links };
}

// 설계사 사진: 공개한 개인페이지(boit_pages.data.photo)에 올린 사진만 씀 (2026-11-22)
async function photoOf(uid: string) {
  const { data } = await sb.from("boit_pages").select("data").eq("user_id", uid).maybeSingle();
  const p = String((data?.data as Record<string, unknown> | undefined)?.photo || "");
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(p) && p.length < 1_500_000) return p;
  if (/^https:\/\/[\w.-]+\/[^\s"'<>]+$/.test(p) && p.length < 500) return p;
  return "";
}

// 개인페이지(p.html?u=주소&ev=이벤트) 이벤트 참여 신청 → boit_leads (출처: "이벤트: 제목", 소개 코드 ref)
// 이벤트 제목은 고객이 보낸 값이 아니라 서버에 공개된 개인페이지(boit_pages.data.events)에서 읽음
async function eventApply(b: Record<string, unknown>, req: Request) {
  const slug = String(b.u || "").toLowerCase(), evId = String(b.ev || "").slice(0, 20);
  if (!/^[a-z0-9][a-z0-9-]{3,29}$/.test(slug)) return no("주소가 올바르지 않습니다.", 404);
  const { data: pg } = await sb.from("boit_pages").select("user_id,data").eq("slug", slug).maybeSingle();
  if (!pg) return no("페이지를 찾을 수 없습니다.", 404);
  const ev = ((pg.data && (pg.data as any).events) || []).find((x: any) => x && x.id === evId);
  if (!ev) return no("이벤트를 찾을 수 없습니다.", 404);
  const now = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  if ((ev.start && now < ev.start) || (ev.end && now > ev.end)) return no("신청 기간이 아닙니다.");
  const { data: u } = await sb.auth.admin.getUserById(pg.user_id);
  if (!u?.user || !u.user.phone || !u.user.phone_confirmed_at) return no("신청을 받을 수 없는 페이지입니다.", 404);
  const name = String(b.name || "").replace(/\s+/g, " ").trim(), phone = String(b.phone || "").replace(/\D/g, "");
  if (name.length < 2 || name.length > 20 || /[<>]/.test(name)) return no("이름을 확인해 주세요.");
  if (!/^01\d{8,9}$/.test(phone)) return no("휴대폰번호를 확인해 주세요.");
  if (b.agree !== true) return no("개인정보 수집·이용에 동의해 주세요.");
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64);
  const cnt = async (col: string, val: string, min: number) => (await sb.from("boit_leads").select("id", { count: "exact", head: true }).eq(col, val).gte("created_at", since(min))).count || 0;
  if (ip && (await cnt("ip", ip, 60)) >= 20) return no("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", 429);
  if ((await cnt("user_id", pg.user_id, 1440)) >= 300) return no("요청이 너무 많습니다. 담당 설계사에게 문의해 주세요.", 429);
  const src = ("이벤트: " + String(ev.title || "")).slice(0, 60), ref = String(b.ref || "").replace(/[^\w]/g, "").slice(0, 12) || null;
  const { data: dup } = await sb.from("boit_leads").select("id").eq("user_id", pg.user_id).eq("phone", fmt(phone)).eq("src", src).gte("created_at", since(1440)).limit(1).maybeSingle();
  if (dup) await sb.from("boit_leads").update({ name, taken: false }).eq("id", dup.id);
  else { const { error } = await sb.from("boit_leads").insert({ user_id: pg.user_id, name, phone: fmt(phone), products: [], ins: "", src, ref, ip });
    if (error) { console.log("event_insert", error.message); return no("저장하지 못했습니다. 다시 시도해 주세요.", 500); }
    await notifyPlanner(sb, pg.user_id, "lead", `[보잇] ${nMask(name)} 고객 이벤트 신청. 보잇 앱에서 확인하세요`, { "고객명": nMask(name), "내용": "이벤트 신청" }); }
  return out({ ok: true });
}

// ── 설계사 알림 (2026-11-23 대표 결정: 상담신청·고객 청구 접수 시 담당 설계사 휴대폰으로 알림) ──
// 다온 솔라피 계정(AUTH_SMS_*)으로 발송, 비용은 다온 부담. 문자에는 고객 이름 일부만 (번호·주민번호·질병 넣지 않음).
// boit_config 에 kakao_pfid 와 템플릿 ID(kakao_tpl_lead / kakao_tpl_claim)가 있으면 알림톡, 실패하면 솔라피가 문자로 대신 보냄.
// 설계사 1명당 하루 30건까지만 (남용·비용 제한). 실패해도 접수 자체는 정상 처리.
async function nHmac(secret: string, data: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)))].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const nBytes = (t: string) => [...t].reduce((a, c) => a + (c.charCodeAt(0) > 127 ? 2 : 1), 0);
const nFit = (t: string) => { let s = t; while (nBytes(s) > 90) s = [...s].slice(0, -1).join(""); return s; };
const nMask = (n: string) => { n = String(n || "").trim(); return n.length <= 1 ? n : n.length === 2 ? n[0] + "*" : n[0] + "*".repeat(n.length - 2) + n[n.length - 1]; };
const nLocal = (p: string) => { const d = String(p || "").replace(/\D/g, ""); return d.startsWith("82") ? "0" + d.slice(2) : d; };
const N_SENT = new Map<string, { day: string; n: number }>();
async function notifyPlanner(db: any, uid: string, kind: "lead" | "claim", text: string, vars: Record<string, string>) {
  try {
    const day = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const c = N_SENT.get(uid); if (c && c.day === day && c.n >= 30) return; N_SENT.set(uid, { day, n: c && c.day === day ? c.n + 1 : 1 });
    const { data: u } = await db.auth.admin.getUserById(uid);
    const to = nLocal(u?.user?.phone || ""); if (!u?.user?.phone_confirmed_at || !/^01\d{8,9}$/.test(to)) return;
    const key = (Deno.env.get("AUTH_SMS_API_KEY") || "").trim(), sec = (Deno.env.get("AUTH_SMS_API_SECRET") || "").trim(), from = (Deno.env.get("AUTH_SMS_FROM") || "").replace(/\D/g, "");
    if (!key || !sec || !from) return;
    const { data: cfg } = await db.from("boit_config").select("k,v").in("k", ["kakao_pfid", "kakao_tpl_" + kind]);
    const m = Object.fromEntries((cfg || []).map((r: any) => [r.k, r.v]));
    const message: Record<string, unknown> = { to, from, text: nFit(text) };
    if (m.kakao_pfid && m["kakao_tpl_" + kind]) message.kakaoOptions = { pfId: m.kakao_pfid, templateId: m["kakao_tpl_" + kind], variables: vars };
    const date = new Date().toISOString(), abc = "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const salt = [...crypto.getRandomValues(new Uint8Array(32))].map((x) => abc[x % abc.length]).join("");
    const r = await fetch("https://api.solapi.com/messages/v4/send", { method: "POST", headers: { Authorization: `HMAC-SHA256 apiKey=${key}, date=${date}, salt=${salt}, signature=${await nHmac(sec, date + salt)}`, "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
    if (!r.ok) console.log("notify_fail", r.status);
  } catch (e) { console.log("notify_err", String((e as Error)?.message || e).slice(0, 80)); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return no("method", 405);
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch (_) { return no("잘못된 요청입니다."); }
  const act = String(b.act || "");
  if (act === "event") return eventApply(b, req); // 개인페이지 이벤트 참여 신청 (2026-11-22)
  const ins = String(b.i || "");
  const adv = await advisor(String(b.a || ""));
  if (!adv) return no("신청 링크가 올바르지 않습니다. 담당 설계사에게 다시 받아 주세요.", 404);

  const pick = adv.links.filter((x) => x.k === ins); // 설계사가 고른 보험사 1곳
  if (act === "info") return out({ ok: true, name: adv.name, org: adv.org, photo: await photoOf(adv.id), products: PRODUCTS, ins: pick[0] ? pick[0].label : (LABEL[ins] || "") });

  const phone = String(b.phone || "").replace(/\D/g, "");
  if (!/^01\d{8,9}$/.test(phone)) return no("휴대폰번호를 확인해 주세요.");
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64);

  if (act === "submit") {
    const name = String(b.name || "").replace(/\s+/g, " ").trim();
    if (name.length < 2 || name.length > 20 || /[<>]/.test(name)) return no("이름을 확인해 주세요.");
    const products = [...new Set((Array.isArray(b.products) ? b.products : []).map(String))].filter((p) => PRODUCTS.includes(p));
    if (!products.length) return no("상담받을 상품을 하나 이상 골라 주세요.");
    if (b.agree !== true) return no("개인정보 수집·이용에 동의해 주세요.");
    // 남용 방지(문자 없음 · 비용 0원): 같은 접속 1시간 20건, 설계사 1명 하루 300건
    const cnt = async (col: string, val: string, min: number) => (await sb.from("boit_leads").select("id", { count: "exact", head: true }).eq(col, val).gte("created_at", since(min))).count || 0;
    if (ip && (await cnt("ip", ip, 60)) >= 20) return no("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", 429);
    if ((await cnt("user_id", adv.id, 1440)) >= 300) return no("요청이 너무 많습니다. 담당 설계사에게 문의해 주세요.", 429);
    // 같은 고객이 하루 안에 다시 신청하면 새로 만들지 않고 상품만 합침
    const { data: dup } = await sb.from("boit_leads").select("id,products").eq("user_id", adv.id).eq("phone", fmt(phone)).is("src", null).gte("created_at", since(1440)).limit(1).maybeSingle();
    if (dup) {
      await sb.from("boit_leads").update({ products: [...new Set([...(dup.products || []), ...products])], name, taken: false }).eq("id", dup.id);
    } else {
      const { error } = await sb.from("boit_leads").insert({ user_id: adv.id, name, phone: fmt(phone), products, ins: pick[0] ? pick[0].label : "", ip });
      if (error) { console.log("lead_insert", error.message); return no("저장하지 못했습니다. 다시 시도해 주세요.", 500); }
      await notifyPlanner(sb, adv.id, "lead", `[보잇] ${nMask(name)} 고객 상담신청(${products.slice(0, 3).join("·")}). 보잇 앱에서 확인하세요`, { "고객명": nMask(name), "내용": "상담신청 (" + products.join("·") + ")" });
    }
    return out({ ok: true, name: adv.name, links: pick });
  }
  return no("잘못된 요청입니다.");
});
