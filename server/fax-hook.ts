// 보잇 · 팝빌 팩스 전송결과 웹훅 수신 (Supabase Edge Function 'fax-hook')
// 팝빌이 전송완료·실패 시점에 바로 POST(JSON)로 알려줌 → 기록 갱신 → 설계사 알림(fax-watch)을 즉시 실행
// 등록: test.popbill.com(운영은 www.popbill.com) 로그인 → 팩스 → 관리 > Webhook > Webhook 설정
//       URL https://lobdowpxujgiadrtxklb.supabase.co/functions/v1/fax-hook · 인증 방식 API Key(X-Api-Key) = boit_config.hook_key
// 근거: developers.popbill.com 팩스 웹훅 개요·이벤트(RESULT 필드: receiptNum, state, result, sendPageCnt, successPageCnt, failPageCnt, chargePageCnt, tiffFileSize …)
// 응답: 200 + {"result":"OK"} (그 밖은 실패로 보고 5분 간격 재전송)
// fax-watch(1분 예약작업)는 웹훅이 빠졌을 때를 대비한 보조 확인으로 계속 둠
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) || "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const OK = () => new Response(JSON.stringify({ result: "OK" }), { status: 200, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const { data: cfg } = await db.from("boit_config").select("k,v").in("k", ["hook_key", "watch_key"]);
  const kv = new Map((cfg || []).map((r: any) => [r.k, r.v]));
  if (!kv.get("hook_key") || req.headers.get("x-api-key") !== kv.get("hook_key")) return new Response(JSON.stringify({ result: "FORBIDDEN" }), { status: 403 });
  let e: any = {};
  try { e = await req.json(); } catch (_) { return OK(); }
  if (e.eventType !== "RESULT") return OK(); // MANUAL(사이트 실행 버튼) 등은 응답만
  const rn = String(e.receiptNum || "").replace(/\D/g, "");
  if (!rn) return OK();
  const st = Number(e.state);
  const state = st === 3 ? (Number(e.successPageCnt) > 0 && !Number(e.failPageCnt) ? "ok" : "bad") : st === 4 ? "bad" : "sending";
  if (state !== "sending") {
    await db.from("boit_fax").update({
      state, pages: Number(e.sendPageCnt) || null, result_code: String(e.result ?? ""), charge_pages: Number(e.chargePageCnt) || null,
      tiff_size: Number(e.tiffFileSize) || null, hook_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("receipt_num", rn);
    // 설계사 알림 바로 실행 (fax-watch가 알림 안 간 결과를 찾아 보냄)
    const wk = kv.get("watch_key");
    if (wk) await fetch(`${env("SUPABASE_URL")}/functions/v1/fax-watch`, { method: "POST", headers: { "Content-Type": "application/json", "x-watch-key": wk }, body: "{}" }).catch(() => {});
  }
  return OK();
});
