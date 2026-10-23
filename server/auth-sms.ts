// 보잇 · 휴대폰 인증번호 발송 (Supabase Auth「Send SMS Hook」→ 이 Edge Function → 솔라피)
// 가입 휴대폰 인증, 휴대폰으로 비밀번호 찾기에 쓰는 인증번호 문자를 보냄.
// 발송 계정: 다온파트너스(대표) 솔라피 계정 1개 · 발신번호는 그 계정에 등록된 번호.
//
// 배포:   supabase functions deploy auth-sms --no-verify-jwt   (Auth가 서명으로 호출하므로 JWT 확인 끔)
// 비밀값: SEND_SMS_HOOK_SECRET  — Auth Hooks 화면에서 만든 값 (v1,whsec_… 형태 그대로)
//         AUTH_SMS_API_KEY / AUTH_SMS_API_SECRET — 솔라피 콘솔 [API Key 관리]
//         AUTH_SMS_FROM — 솔라피에 등록된 발신번호 (숫자만, 예: 01012345678)
// 원칙:   인증번호·받는 번호는 저장하지 않음. 로그에도 남기지 않음.
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const env = (k: string) => Deno.env.get(k) || "";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const fail = (msg: string, code = 500) => json({ error: { http_code: code, message: msg } }, code);

async function hmacHex(secret: string, data: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)));
  return [...s].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function keyAuth(apiKey: string, apiSecret: string) {
  const date = new Date().toISOString();
  const abc = "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const salt = [...crypto.getRandomValues(new Uint8Array(32))].map((x) => abc[x % abc.length]).join("");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${await hmacHex(apiSecret, date + salt)}`;
}
// +821012345678 / 821012345678 → 01012345678
function krLocal(p: string) {
  const d = String(p || "").replace(/\D/g, "");
  return d.startsWith("82") ? "0" + d.slice(2) : d;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail("method", 405);
  const payload = await req.text();
  let ev: { user: Record<string, string>; sms: Record<string, string> };
  try {
    const wh = new Webhook(env("SEND_SMS_HOOK_SECRET").replace("v1,whsec_", ""));
    ev = wh.verify(payload, Object.fromEntries(req.headers)) as typeof ev;
  } catch {
    return fail("서명 확인 실패", 401);
  }
  const u = ev.user || {}, sms = ev.sms || {};
  const type = String(sms.sms_type || sms.type || "");
  // 번호 바꾸기(가입 인증)는 새 번호(phone_change)로, 그 외(비밀번호 찾기 등)는 인증된 번호로
  const target = type === "phone_change" || (!u.phone_confirmed_at && u.phone_change) ? (u.phone_change || u.phone) : (u.phone || u.phone_change);
  const to = krLocal(target);
  if (!/^01\d{8,9}$/.test(to)) return fail("휴대폰번호 형식이 올바르지 않습니다.", 400);
  if (!sms.otp) return fail("인증번호 없음", 400);
  const key = env("AUTH_SMS_API_KEY"), sec = env("AUTH_SMS_API_SECRET"), from = env("AUTH_SMS_FROM").replace(/\D/g, "");
  if (!key || !sec || !from) return fail("문자 발송 설정이 아직 없습니다.", 500);

  const text = `[보잇] 인증번호 ${sms.otp}\n5분 안에 입력해 주세요. 본인이 요청하지 않았다면 무시하세요.`;
  const r = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: { Authorization: await keyAuth(key, sec), "Content-Type": "application/json" },
    body: JSON.stringify({ message: { to, from, text } }),
  });
  const j = await r.json().catch(() => ({}));
  const st = String(j.statusCode || "");
  if (!r.ok || (st && !["2000", "3000", "4000"].includes(st))) {
    console.log("solapi_fail", r.status, j.errorCode || st, j.errorMessage || j.statusMessage || ""); // 번호·인증번호는 남기지 않음
    return fail("인증번호 문자를 보내지 못했습니다. 잠시 후 다시 시도하세요.", 500);
  }
  return json({});
});
