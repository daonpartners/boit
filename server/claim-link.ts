// 보잇 · 고객 청구 링크 (Supabase Edge Function 'claim-link', verify_jwt=false) — 2026-11-23
// 설계사(로그인): create(링크 만들기) · list(접수 목록) · open(불러오기) · done(팩스 발송 후 파기) · del(삭제)
// 고객(로그인 없음, ?pub=1): info(링크 확인) → upload(사진·서명 1회용 업로드 주소 받기) → submit(이름·주민번호·휴대폰·주소 암호화 저장)
// 청구 서류 3개월 보관(2026-11-23): keep_put(발송 후 서류·주민번호 보관) · keep_list · keep_get(불러오기) · keep_del(즉시 파기)
// 예약 정리(?purge=1, x-watch-key): 만료된 링크·접수 건, 90일 지난 보관 서류 삭제
// 원칙: 고객 입력값은 AES-GCM 암호화. 파일은 비공개 버킷. 로그에 개인정보를 남기지 않음.
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) || "";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
const BUCKET = "boit-claim", T = "boit_claim_req", K = "boit_claim_keep", DAY = 864e5, MAXF = 30, KEEPF = 80;
const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");
const clip = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);

let KEY: CryptoKey | null = null;
async function key() {
  if (KEY) return KEY;
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("boit-claim-link:" + env("SUPABASE_SERVICE_ROLE_KEY")));
  KEY = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  return KEY;
}
const b64 = (u: Uint8Array) => { let s = ""; for (const x of u) s += String.fromCharCode(x); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function enc(o: unknown) { const iv = crypto.getRandomValues(new Uint8Array(12)); const c = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(JSON.stringify(o)))); return b64(iv) + "." + b64(c); }
async function dec(s: string) { if (!s) return {}; const [iv, c] = s.split("."); return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await key(), unb64(c)))); }
const mask = (n: string) => (n = String(n || ""), n.length <= 1 ? n : n.length === 2 ? n[0] + "*" : n[0] + "*".repeat(n.length - 2) + n.slice(-1));

async function wipe(rows: { token: string; files: string[] }[]) {
  const paths = rows.flatMap((r) => (Array.isArray(r.files) ? r.files : []));
  for (let i = 0; i < paths.length; i += 500) await db.storage.from(BUCKET).remove(paths.slice(i, i + 500));
  // 업로드 주소만 받고 목록에 안 남은 파일까지: 폴더째 확인
  for (const r of rows) {
    const own = (r.files && r.files[0]) ? String(r.files[0]).split("/")[0] : "";
    if (!own) continue;
    const { data } = await db.storage.from(BUCKET).list(`${own}/${r.token}`, { limit: 100 });
    if (data && data.length) await db.storage.from(BUCKET).remove(data.map((f) => `${own}/${r.token}/${f.name}`));
  }
  if (rows.length) await db.from(T).delete().in("token", rows.map((r) => r.token));
}
async function keepWipe(owner: string, gid: string, files: string[]) {
  const dir = `${owner}/keep/${gid}`;
  const { data } = await db.storage.from(BUCKET).list(dir, { limit: 200 });
  const all = new Set([...(Array.isArray(files) ? files : []), ...(data || []).map((f) => `${dir}/${f.name}`)]);
  const L = [...all]; for (let i = 0; i < L.length; i += 500) await db.storage.from(BUCKET).remove(L.slice(i, i + 500));
  await db.from(K).delete().eq("owner", owner).eq("gid", gid);
}
async function row(t: unknown) {
  const tok = String(t || "");
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(tok)) return null;
  const { data } = await db.from(T).select("*").eq("token", tok).maybeSingle();
  if (data && new Date(data.expires_at).getTime() < Date.now()) { await wipe([data]); return null; }
  return data;
}

async function pub(b: any) {
  const L = await row(b.t);
  if (!L) return json({ error: "expired", message: "링크가 만료되었습니다. 담당 설계사에게 새 링크를 요청해 주세요." }, 404);
  if (b.action === "info") return json({ ok: true, planner: L.planner, plannerPhone: L.planner_phone, name: mask(L.hint_name), status: L.status === "opened" ? "submitted" : L.status });
  if (L.status === "submitted" || L.status === "opened") return json({ error: "done", message: "이미 접수되었습니다. 담당 설계사가 확인 후 연락드립니다." }, 409);
  if (b.action === "upload") {
    const list = Array.isArray(b.files) ? b.files.slice(0, MAXF) : [];
    if (!list.length) return json({ error: "bad_input", message: "서류 사진을 1장 이상 올려 주세요." }, 400);
    if (L.tries >= 5) return json({ error: "too_many", message: "보내기 시도 횟수(5번)를 넘었습니다. 담당 설계사에게 새 링크를 요청해 주세요." }, 429);
    const ext = (t: string) => (t === "application/pdf" ? "pdf" : t === "image/png" ? "png" : "jpg");
    const n = L.tries + 1;
    const paths = list.map((f: any, i: number) => `${L.owner}/${L.token}/${n}-${String(i + 1).padStart(2, "0")}.${ext(String(f?.type || ""))}`);
    paths.push(`${L.owner}/${L.token}/${n}-sign.png`);
    const ups = [];
    for (const p of paths) {
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(p);
      if (error || !data) return json({ error: "storage", message: "사진 올릴 곳을 만들지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500);
      ups.push({ path: p, token: data.token });
    }
    await db.from(T).update({ status: "upload", tries: n, files: paths }).eq("token", L.token);
    return json({ ok: true, ups });
  }
  if (b.action === "submit") {
    if (L.status !== "upload") return json({ error: "bad_state", message: "사진부터 다시 보내 주세요." }, 400);
    const a = b.agree || {};
    if (!a.privacy || !a.unique || !a.sensitive || !a.provide) return json({ error: "bad_input", message: "필수 동의 4개에 체크해 주세요." }, 400);
    const name = clip(b.name, 30), rrn = digits(b.rrn), phone = digits(b.phone), addr = clip(b.addr, 120);
    if (!name || rrn.length !== 13 || !/^01\d{8,9}$/.test(phone) || !addr) return json({ error: "bad_input", message: "이름·주민등록번호·휴대폰번호·주소를 확인해 주세요." }, 400);
    const own = String(L.owner);
    const { data: got } = await db.storage.from(BUCKET).list(`${own}/${L.token}`, { limit: 100 });
    const have = new Set((got || []).map((f) => `${own}/${L.token}/${f.name}`));
    const files = (L.files || []).filter((p: string) => have.has(p));
    if (!files.some((p: string) => /-sign\.png$/.test(p))) return json({ error: "bad_input", message: "서명이 올라가지 않았습니다. 다시 보내 주세요." }, 400);
    if (files.length < 2) return json({ error: "bad_input", message: "서류 사진이 올라가지 않았습니다. 다시 보내 주세요." }, 400);
    const at = new Date().toISOString();
    const data = { name, rrn, phone, addr, memo: clip(b.memo, 300), agree: { ...a, at }, ua: clip(b.ua, 160) };
    const { error } = await db.from(T).update({ status: "submitted", enc: await enc(data), files, submitted_at: at, expires_at: new Date(Date.now() + 7 * DAY).toISOString() }).eq("token", L.token);
    if (error) return json({ error: "db", message: "접수하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500);
    return json({ ok: true, planner: L.planner, plannerPhone: L.planner_phone });
  }
  return json({ error: "bad_action", message: "알 수 없는 요청입니다." }, 400);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  const q = new URL(req.url).searchParams;
  let b: any = {};
  try { b = await req.json(); } catch (_) { /* 빈 요청 */ }
  try {
    if (q.get("purge") === "1") {
      const { data: cfg } = await db.from("boit_config").select("v").eq("k", "watch_key").maybeSingle();
      if (!cfg?.v || req.headers.get("x-watch-key") !== cfg.v) return json({ error: "forbidden" }, 403);
      let removed = 0;
      for (let i = 0; i < 20; i++) {
        const { data: rows } = await db.from(T).select("token,files").lt("expires_at", new Date().toISOString()).limit(200);
        if (!rows || !rows.length) break;
        await wipe(rows as any); removed += rows.length;
      }
      let kept = 0;
      for (let i = 0; i < 20; i++) {
        const { data: ks } = await db.from(K).select("owner,gid,files").lt("expires_at", new Date().toISOString()).limit(200);
        if (!ks || !ks.length) break;
        for (const k of ks) await keepWipe(k.owner, k.gid, k.files);
        kept += ks.length;
      }
      return json({ ok: true, removed, kept });
    }
    if (q.get("pub") === "1") return await pub(b);
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await db.auth.getUser(jwt);
    if (!u?.user) return json({ error: "login_required", message: "보잇에 다시 로그인하세요." }, 401);
    const me = u.user.id;
    if (b.action === "create") {
      const { count } = await db.from(T).select("token", { count: "exact", head: true }).eq("owner", me).gte("created_at", new Date(Date.now() - DAY).toISOString());
      if ((count || 0) >= 50) return json({ error: "too_many", message: "하루 50개까지 링크를 만들 수 있습니다." }, 429);
      const tok = b64(crypto.getRandomValues(new Uint8Array(24))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const { error } = await db.from(T).insert({ token: tok, owner: me, planner: clip(b.planner, 30), planner_phone: clip(b.plannerPhone, 20), hint_name: clip(b.name, 30) });
      if (error) return json({ error: "db", message: "링크를 만들지 못했습니다." }, 500);
      return json({ ok: true, token: tok, url: `https://boit.ai.kr/c.html?t=${tok}` });
    }
    if (b.action === "list") {
      const { data: rows } = await db.from(T).select("token,hint_name,status,enc,files,created_at,submitted_at,expires_at").eq("owner", me).order("created_at", { ascending: false }).limit(100);
      const out = [];
      for (const r of rows || []) {
        if (new Date(r.expires_at).getTime() < Date.now()) continue;
        let d: any = {};
        if (r.enc) { try { d = await dec(r.enc); } catch (_) { d = {}; } }
        out.push({ t: r.token, status: r.status, hint: r.hint_name, name: d.name || "", phone: d.phone || "", n: (r.files || []).filter((p: string) => !/-sign\.png$/.test(p)).length, created: r.created_at, submitted: r.submitted_at, expires: r.expires_at });
      }
      return json({ ok: true, rows: out });
    }
    if (String(b.action || "").startsWith("keep_")) {
      const gid = String(b.gid || "");
      if (b.action !== "keep_list" && !/^[A-Za-z0-9_-]{2,40}$/.test(gid)) return json({ error: "bad_input", message: "청구 번호가 올바르지 않습니다." }, 400);
      if (b.action === "keep_list") {
        const { data } = await db.from(K).select("gid,files,expires_at").eq("owner", me).gt("expires_at", new Date().toISOString()).limit(2000);
        return json({ ok: true, rows: (data || []).map((r) => ({ gid: r.gid, n: (r.files || []).length, expires: r.expires_at })) });
      }
      if (b.action === "keep_put") {
        const list = Array.isArray(b.files) ? b.files.slice(0, KEEPF) : [];
        const rrn = digits(b.rrn);
        if (!list.length) return json({ error: "bad_input", message: "보관할 서류가 없습니다." }, 400);
        const ext = (t: string) => (t === "application/pdf" ? "pdf" : t === "image/png" ? "png" : "jpg");
        const dir = `${me}/keep/${gid}`;
        const paths = list.map((f: any, i: number) => `${dir}/${String(i + 1).padStart(2, "0")}.${ext(String(f?.type || ""))}`);
        const names = list.map((f: any) => clip(f?.name, 80));
        const ups = [];
        for (const p of paths) {
          const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(p, { upsert: true });
          if (error || !data) return json({ error: "storage", message: "서류 보관 자리를 만들지 못했습니다." }, 500);
          ups.push({ path: p, token: data.token });
        }
        const data = { rrn: rrn.length === 13 ? rrn : "", name: clip(b.name, 30), phone: digits(b.phone), addr: clip(b.addr, 160), names, ins: Array.isArray(b.ins) ? b.ins.slice(0, 10).map((x: unknown) => clip(x, 30)) : [], kind: clip(b.kind, 60) };
        const { error } = await db.from(K).upsert({ owner: me, gid, enc: await enc(data), files: paths, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 90 * DAY).toISOString() });
        if (error) return json({ error: "db", message: "서류를 보관하지 못했습니다." }, 500);
        return json({ ok: true, ups });
      }
      const { data: R } = await db.from(K).select("*").eq("owner", me).eq("gid", gid).maybeSingle();
      if (!R || new Date(R.expires_at).getTime() < Date.now()) { if (R) await keepWipe(me, gid, R.files); return json({ error: "expired", message: "보관 기간(3개월)이 지나 서류가 파기되었습니다." }, 404); }
      if (b.action === "keep_del") { await keepWipe(me, gid, R.files); return json({ ok: true }); }
      if (b.action === "keep_get") {
        const d = await dec(R.enc);
        const files = [];
        for (let i = 0; i < (R.files || []).length; i++) {
          const { data } = await db.storage.from(BUCKET).createSignedUrl(R.files[i], 300);
          if (data?.signedUrl) files.push({ url: data.signedUrl, name: (d.names || [])[i] || "" });
        }
        return json({ ok: true, data: { rrn: d.rrn, name: d.name, phone: d.phone, addr: d.addr, ins: d.ins, kind: d.kind }, files, expires: R.expires_at });
      }
    }
    if (b.action === "open" || b.action === "done" || b.action === "del") {
      const L = await row(b.t);
      if (!L || L.owner !== me) return json({ error: "expired", message: "만료되었거나 이미 처리된 접수입니다." }, 404);
      if (b.action !== "open") { await wipe([L]); return json({ ok: true }); }
      if (L.status !== "submitted" && L.status !== "opened") return json({ error: "not_submitted", message: "고객이 아직 보내지 않았습니다." }, 409);
      const d = await dec(L.enc);
      const files = [];
      for (const p of L.files || []) {
        const { data } = await db.storage.from(BUCKET).createSignedUrl(p, 300);
        if (data?.signedUrl) files.push({ path: p, url: data.signedUrl, sign: /-sign\.png$/.test(p) });
      }
      if (L.status !== "opened") await db.from(T).update({ status: "opened" }).eq("token", L.token);
      return json({ ok: true, data: { name: d.name, rrn: d.rrn, phone: d.phone, addr: d.addr, memo: d.memo, agreeAt: d.agree?.at || "" }, files });
    }
    return json({ error: "bad_action", message: "알 수 없는 요청입니다." }, 400);
  } catch (e: any) {
    return json({ error: "server", message: "처리하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500);
  }
});
