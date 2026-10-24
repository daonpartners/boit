// 보잇 · 고객 상담신청 (boit.ai.kr/apply/?a=설계사코드)
// 흐름: info(설계사 표시) → send(인증번호 문자) → verify(확인 후 boit_leads 저장 + 설계사 알림 문자)
// 배포: supabase functions deploy apply --no-verify-jwt  (고객은 로그인하지 않음 · 남용은 횟수 제한으로 막음)
// 비밀값: AUTH_SMS_API_KEY / AUTH_SMS_API_SECRET / AUTH_SMS_FROM (auth-sms와 같은 솔라피 계정)
// 원칙: 인증번호는 해시로만 저장, 로그에 이름·번호·인증번호를 남기지 않음. 주민등록번호는 받지 않음.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const env = (k: string) => Deno.env.get(k) || "";
const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const no = (msg: string, s = 400) => out({ ok: false, error: msg }, s);

export const PRODUCTS = ["간병인", "치매치료", "치아", "펫", "암", "건강종합", "어린이", "운전자", "화재", "연금"];
const LINK_HOSTS = /(^|\.)(meritzfire\.com|kbinsure\.co\.kr|miraeasset\.com)$/i;
const LABEL: Record<string, string> = { mz: "메리츠화재", kb: "KB손해보험", mi: "미래에셋생명" };

async function sha(s: string) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...h].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function hmacHex(secret: string, data: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)));
  return [...s].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function sms(to: string, text: string) {
  const key = env("AUTH_SMS_API_KEY").trim(), sec = env("AUTH_SMS_API_SECRET").trim(), from = env("AUTH_SMS_FROM").replace(/\D/g, "");
  if (!key || !sec || !from) return false;
  const date = new Date().toISOString();
  const abc = "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const salt = [...crypto.getRandomValues(new Uint8Array(32))].map((x) => abc[x % abc.length]).join("");
  const auth = `HMAC-SHA256 apiKey=${key}, date=${date}, salt=${salt}, signature=${await hmacHex(sec, date + salt)}`;
  const r = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST", headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { to, from, text } }),
  });
  const j = await r.json().catch(() => ({}));
  const st = String(j.statusCode || "");
  if (!r.ok || (st && !["2000", "3000", "4000"].includes(st))) { console.log("solapi_fail", r.status, j.errorCode || st); return false; }
  return true;
}
const krLocal = (p: string) => { const d = String(p || "").replace(/\D/g, ""); return d.startsWith("82") ? "0" + d.slice(2) : d; };
const fmt = (p: string) => p.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
const since = (min: number) => new Date(Date.now() - min * 60000).toISOString();

// 원수사 링크: 메리츠는 조직코드(숫자)만 넣어도 됨. 그 외는 허용된 보험사 주소만.
function linkOf(k: string, v: unknown) {
  const s = String(v || "").trim();
  if (k === "mz" && /^\d{6,12}$/.test(s)) return "https://msea.meritzfire.com/mblCusReg.do?orgCd=" + s;
  try { const u = new URL(s); if (u.protocol === "https:" && LINK_HOSTS.test(u.hostname)) return u.toString(); } catch (_) { /* 무시 */ }
  return "";
}
async function advisor(code: string) {
  if (!/^[a-z0-9]{6,12}$/.test(code)) return null;
  const { data } = await sb.from("boit_apply").select("user_id,name,org,links,show,active").eq("code", code).maybeSingle();
  if (!data || !data.active) return null;
  const { data: u } = await sb.auth.admin.getUserById(data.user_id);
  const user = u?.user;
  if (!user || !user.phone || !user.phone_confirmed_at) return null; // 휴대폰 인증한 보잇 회원만
  const links = (data.show || []).map((k: string) => ({ k, label: LABEL[k], url: linkOf(k, (data.links || {})[k]) })).filter((x: { url: string; label?: string }) => x.url && x.label);
  return { id: data.user_id as string, name: data.name as string, org: data.org as string, phone: krLocal(user.phone), links };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return no("method", 405);
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch (_) { return no("잘못된 요청입니다."); }
  const act = String(b.act || "");
  const adv = await advisor(String(b.a || ""));
  if (!adv) return no("신청 링크가 올바르지 않습니다. 담당 설계사에게 다시 받아 주세요.", 404);

  if (act === "info") return out({ ok: true, name: adv.name, org: adv.org, products: PRODUCTS });

  const phone = String(b.phone || "").replace(/\D/g, "");
  if (!/^01\d{8,9}$/.test(phone)) return no("휴대폰번호를 확인해 주세요.");
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64);

  if (act === "send") {
    const name = String(b.name || "").replace(/\s+/g, " ").trim();
    if (name.length < 2 || name.length > 20 || /[<>]/.test(name)) return no("이름을 확인해 주세요.");
    const products = [...new Set((Array.isArray(b.products) ? b.products : []).map(String))].filter((p) => PRODUCTS.includes(p));
    if (!products.length) return no("상담받을 상품을 하나 이상 골라 주세요.");
    if (b.agree !== true) return no("개인정보 수집·이용에 동의해 주세요.");
    // 남용 방지: 같은 번호 60초 1회·하루 5회, 같은 접속 1시간 20회, 설계사 1곳 하루 300회
    const cnt = async (col: string, val: string, min: number) => (await sb.from("boit_apply_otp").select("id", { count: "exact", head: true }).eq(col, val).gte("created_at", since(min))).count || 0;
    if (await cnt("phone", phone, 1)) return no("잠시 후 다시 시도해 주세요. (1분에 1번)", 429);
    if ((await cnt("phone", phone, 1440)) >= 5) return no("오늘 인증 요청 횟수를 넘었습니다. 내일 다시 시도해 주세요.", 429);
    if (ip && (await cnt("ip", ip, 60)) >= 20) return no("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.", 429);
    if ((await cnt("user_id", adv.id, 1440)) >= 300) return no("요청이 너무 많습니다. 담당 설계사에게 문의해 주세요.", 429);
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
    const { error } = await sb.from("boit_apply_otp").insert({
      phone, code_hash: await sha(phone + ":" + code + ":" + env("SUPABASE_SERVICE_ROLE_KEY")), user_id: adv.id, name, products, ip,
      expires_at: new Date(Date.now() + 5 * 60000).toISOString(),
    });
    if (error) { console.log("otp_insert", error.message); return no("잠시 후 다시 시도해 주세요.", 500); }
    const ok = await sms(phone, `[보험상담 신청] 인증번호 ${code}\n5분 안에 입력해 주세요.`);
    if (!ok) return no("인증번호 문자를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.", 502);
    await sb.from("boit_apply_otp").delete().lt("created_at", since(2880)); // 이틀 지난 기록 정리
    return out({ ok: true });
  }

  if (act === "verify") {
    const code = String(b.code || "").replace(/\D/g, "");
    if (!/^\d{6}$/.test(code)) return no("인증번호 6자리를 입력해 주세요.");
    const { data: row } = await sb.from("boit_apply_otp").select("*").eq("phone", phone).eq("user_id", adv.id).eq("used", false)
      .gte("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!row) return no("인증번호가 만료되었습니다. 다시 받아 주세요.");
    if (row.tries >= 5) return no("입력 횟수를 넘었습니다. 인증번호를 다시 받아 주세요.", 429);
    if (row.code_hash !== await sha(phone + ":" + code + ":" + env("SUPABASE_SERVICE_ROLE_KEY"))) {
      await sb.from("boit_apply_otp").update({ tries: row.tries + 1 }).eq("id", row.id);
      return no(`인증번호가 맞지 않습니다. (남은 횟수 ${4 - row.tries}번)`);
    }
    await sb.from("boit_apply_otp").update({ used: true }).eq("id", row.id);
    // 같은 고객이 하루 안에 다시 신청하면 새로 만들지 않고 상품만 합침
    const { data: dup } = await sb.from("boit_leads").select("id,products").eq("user_id", adv.id).eq("phone", fmt(phone)).gte("created_at", since(1440)).limit(1).maybeSingle();
    if (dup) {
      await sb.from("boit_leads").update({ products: [...new Set([...(dup.products || []), ...row.products])], name: row.name, taken: false }).eq("id", dup.id);
    } else {
      const { error } = await sb.from("boit_leads").insert({ user_id: adv.id, name: row.name, phone: fmt(phone), products: row.products });
      if (error) { console.log("lead_insert", error.message); return no("저장하지 못했습니다. 다시 시도해 주세요.", 500); }
      const list = row.products.length > 2 ? row.products.slice(0, 2).join("·") + ` 외${row.products.length - 2}` : row.products.join("·");
      await sms(adv.phone, `[보잇] 상담신청 접수\n${row.name} ${fmt(phone)}\n${list}`);
    }
    return out({ ok: true, name: adv.name, links: adv.links });
  }
  return no("잘못된 요청입니다.");
});
