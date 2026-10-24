// 보잇 · 고객 상담신청 (boit.ai.kr/apply/?a=설계사코드)
// 링크: ?a=설계사코드&i=mz|kb|mi (설계사가 보험사를 골라 고객에게 보냄)
// 흐름: info(설계사 표시) → submit(boit_leads 저장) → 고객은 설계사가 고른 보험사 공식 인증·동의 화면으로 이동
// 문자 발송 없음 (다온 비용 0원, 대표 결정 2026-10-25). 설계사는 보잇 고객관리에 자동 등록되는 것으로 확인
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
  // 등록된 원수사 링크 전부 (고객 링크의 i=mz|kb|mi 로 하나를 고름)
  const links = Object.keys(LABEL).map((k) => ({ k, label: LABEL[k], url: linkOf(k, (data.links || {})[k]) })).filter((x) => x.url);
  return { id: data.user_id as string, name: data.name as string, org: data.org as string, phone: krLocal(user.phone), links };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return no("method", 405);
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch (_) { return no("잘못된 요청입니다."); }
  const act = String(b.act || "");
  const ins = String(b.i || "");
  const adv = await advisor(String(b.a || ""));
  if (!adv) return no("신청 링크가 올바르지 않습니다. 담당 설계사에게 다시 받아 주세요.", 404);

  const pick = adv.links.filter((x) => x.k === ins); // 설계사가 고른 보험사 1곳
  if (act === "info") return out({ ok: true, name: adv.name, org: adv.org, products: PRODUCTS, ins: pick[0] ? pick[0].label : (LABEL[ins] || "") });

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
    const { data: dup } = await sb.from("boit_leads").select("id,products").eq("user_id", adv.id).eq("phone", fmt(phone)).gte("created_at", since(1440)).limit(1).maybeSingle();
    if (dup) {
      await sb.from("boit_leads").update({ products: [...new Set([...(dup.products || []), ...products])], name, taken: false }).eq("id", dup.id);
    } else {
      const { error } = await sb.from("boit_leads").insert({ user_id: adv.id, name, phone: fmt(phone), products, ins: pick[0] ? pick[0].label : "", ip });
      if (error) { console.log("lead_insert", error.message); return no("저장하지 못했습니다. 다시 시도해 주세요.", 500); }
    }
    return out({ ok: true, name: adv.name, links: pick });
  }
  return no("잘못된 요청입니다.");
});
