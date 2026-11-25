// 보잇 · 공공데이터 조회 서버 기능 (Supabase Edge Function 'pubdata') — 2026-11-25
// 지금 기능: 재난배상책임보험 대상 사업장 (행정안전부_재난배상책임보험 사업장 정보, 공공데이터포털 15125655, Base URL apis.data.go.kr/1741000/ndms)
//   mode "expire" = /insrInfo        가입시설물보험정보에서 만기(insrnc_end_ymd)가 오늘~N일 안인 곳
//   mode "lapse"  = /closeBizStatus  미가입 시설물 중 계속사업자(biz_stts_cd=01)만
// 비밀값: DATA_GO_KR_KEY (공공데이터포털 일반 인증키 Decoding, 대표가 대시보드에서 직접 입력)
// 배포: supabase functions deploy pubdata --no-verify-jwt (로그인 확인은 함수 안에서 직접)
// 원칙: 인증키는 응답·로그에 남기지 않음. 조회 결과는 공공데이터(상호·주소·사업자번호·보험기간)만, 서버에 저장하지 않음.
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) || "";
const KEY = env("DATA_GO_KR_KEY");
const DAY_LIMIT = 100; // 회원 1명 하루 조회 횟수 (개발계정 전체 한도 하루 10,000건)
const PER = 30;
const BASE = "https://apis.data.go.kr/1741000/ndms";
const SIDO = ["서울특별시","부산광역시","대구광역시","인천광역시","광주광역시","대전광역시","울산광역시","세종특별자치시","경기도","강원특별자치도","충청북도","충청남도","전북특별자치도","전라남도","경상북도","경상남도","제주특별자치도"];
const TPBIZ = new Set(["01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21"]);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const ymd = (d: Date) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "");
const clean = (s: unknown, n: number) => String(s ?? "").replace(/[^\p{L}\p{N}\s\-·]/gu, "").replace(/\s+/g, " ").trim().slice(0, n);

async function useOne(uid: string) {
  const day = ymd(new Date()).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  const { data } = await db.from("boit_pubdata_use").select("n").eq("user_id", uid).eq("day", day).maybeSingle();
  const n = (data?.n || 0) + 1;
  if (n > DAY_LIMIT) return -1;
  await db.from("boit_pubdata_use").upsert({ user_id: uid, day, n });
  return DAY_LIMIT - n;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await db.auth.getUser(jwt);
  const user = u?.user;
  if (!user) return json({ error: "login_required", message: "보잇에 다시 로그인하세요." }, 401);
  if (!KEY) return json({ error: "not_configured", message: "공공데이터 인증키가 아직 설정되지 않았습니다." });
  let b: Record<string, any> = {};
  try { b = await req.json(); } catch (_) { /* 빈 요청 */ }

  if (b.action !== "ndms") return json({ error: "bad_action" }, 400);
  const sido = SIDO.includes(b.sido) ? b.sido : "";
  const gu = clean(b.gu, 20), road = clean(b.road, 30);
  if (!sido) return json({ error: "need_sido", message: "시·도를 고르세요." }, 400);
  const mode = b.mode === "lapse" ? "lapse" : "expire";
  const page = Math.min(Math.max(parseInt(b.page) || 1, 1), 500);
  const days = [30, 60, 90].includes(Number(b.days)) ? Number(b.days) : 60;

  const left = await useOne(user.id);
  if (left < 0) return json({ error: "day_limit", message: `오늘 조회 ${DAY_LIMIT}회를 모두 썼습니다. 내일 다시 조회하세요.` });

  const q = new URLSearchParams({ page: String(page), perPage: String(PER), type: "json" });
  q.set("cond[bplc_addr::LIKE]", [sido, gu, road].filter(Boolean).join(" ")); // 주소 앞부분 일치 (예: 대전광역시 유성구 한밭대로)
  if (TPBIZ.has(b.tpbiz)) q.set("cond[tpbiz_se_cd::EQ]", b.tpbiz);
  let path = "/insrInfo";
  if (mode === "expire") {
    const now = new Date();
    q.set("cond[insrnc_end_ymd::GTE]", ymd(now));
    q.set("cond[insrnc_end_ymd::LTE]", ymd(new Date(now.getTime() + days * 86400e3)));
  } else {
    path = "/closeBizStatus";
    q.set("cond[biz_stts_cd::EQ]", "01");
  }
  q.set("serviceKey", KEY);
  try {
    const r = await fetch(BASE + path + "?" + q.toString());
    const t = await r.text();
    let j: any = null; try { j = JSON.parse(t); } catch (_) { /* XML 오류 응답 */ }
    if (!r.ok || !j || !Array.isArray(j.data)) return json({ error: "upstream", message: "공공데이터포털 응답이 올바르지 않습니다. 잠시 후 다시 조회하세요.", status: r.status });
    const rows = j.data.map((x: any) => ({
      name: String(x.bldg_nm || "").trim(), addr: String(x.bplc_addr || "").trim(), brno: String(x.brno || "").replace(/\D/g, ""),
      biz: String(x.tpbiz_se_nm || "").trim(), start: String(x.insrnc_bgng_ymd || "").trim(), end: String(x.insrnc_end_ymd || "").trim(),
    }));
    return json({ ok: true, mode, rows, total: j.matchCount ?? 0, page, per: PER, left });
  } catch (_) {
    return json({ error: "upstream", message: "공공데이터포털에 연결하지 못했습니다. 잠시 후 다시 조회하세요." });
  }
});
