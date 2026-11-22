// 보잇 · 문서 보관함 만료 삭제 (Supabase Edge Function 'docs-purge') — 매일 DB 예약작업(pg_cron)이 부름
// 만료(만든 지 7일)된 제안서·리포트 파일을 Storage 'boit-docs'에서 지우고 목록(boit_docs)도 지움
// 보호: 머리글 x-watch-key 가 boit_config.watch_key 와 같아야 함
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) || "";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

Deno.serve(async (req) => {
  const { data: cfg } = await db.from("boit_config").select("v").eq("k", "watch_key").maybeSingle();
  if (!cfg?.v || req.headers.get("x-watch-key") !== cfg.v) return json({ error: "forbidden" }, 403);
  let removed = 0;
  for (let round = 0; round < 20; round++) {
    const { data: rows, error } = await db.from("boit_docs").select("id,path").lt("expires_at", new Date().toISOString()).limit(500);
    if (error) return json({ ok: false, error: error.message }, 500);
    if (!rows || !rows.length) break;
    const { error: se } = await db.storage.from("boit-docs").remove(rows.map((r) => r.path));
    if (se) return json({ ok: false, error: se.message, removed }, 500);
    const { error: de } = await db.from("boit_docs").delete().in("id", rows.map((r) => r.id));
    if (de) return json({ ok: false, error: de.message, removed }, 500);
    removed += rows.length;
  }
  return json({ ok: true, removed });
});
