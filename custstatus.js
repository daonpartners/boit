/* 보잇 · 고객 목록 '진행 상태' (2026-11-23)
   고객마다 지금 무엇이 남았는지 한눈에: 고객이 보낸 청구 접수 · 청구 중/완료 · 서류 보관 D-n · 병력(진료내역) 저장 */
(function(){
"use strict";
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const dg=s=>String(s||"").replace(/\D/g,"");
const DAY=864e5;
window.custBadges=function(c){ const out=[], now=Date.now(), nm=c.name, ph=dg(c.phone);
  /* 고객이 링크로 보낸 청구 접수 */
  const cr=(window.BOIT_CREQ||[]).find(r=>(r.status==="submitted"||r.status==="opened")&&r.name===nm&&dg(r.phone)===ph);
  if(cr) out.push(`<span class="cs-b hot" title="보상청구 화면 맨 위에서 불러오기">고객 청구 도착</span>`);
  /* 청구내역 (같은 이름) */
  const hs=(S.history||[]).filter(h=>h.cust===nm&&!h.ex&&h.ts);
  const going=hs.filter(h=>["sending","wait"].includes(h.res)&&now-h.ts<14*DAY);
  const bad=hs.filter(h=>h.res==="bad"&&now-h.ts<14*DAY);
  const okLast=hs.filter(h=>h.res==="ok").sort((a,b)=>b.ts-a.ts)[0];
  if(bad.length) out.push(`<span class="cs-b bad">청구 실패 ${bad.length}</span>`);
  else if(going.length) out.push(`<span class="cs-b">청구 중 ${going.length}</span>`);
  else if(okLast&&now-okLast.ts<30*DAY) out.push(`<span class="cs-b ok">청구 완료 ${Math.max(0,Math.floor((now-okLast.ts)/DAY))}일 전</span>`);
  /* 서류 보관 D-n */
  const K=window.BOIT_KEPT; if(K&&K.size){ let left=-1; hs.forEach(h=>{ const r=h.gid&&K.get(h.gid); if(r){ const d=Math.ceil((new Date(r.expires).getTime()-now)/DAY); if(d>left) left=d; } }); if(left>=0) out.push(`<span class="cs-b">서류 보관 D-${left}</span>`); }
  /* 진료내역(병력) 저장 */
  if(c.hx&&(!c.hxUntil||new Date(c.hxUntil).getTime()>now)) out.push(`<span class="cs-b ok" title="병력고지의무 체크에서 바로 판정">진료내역 있음</span>`);
  return out.length?`<span class="cs-w">${out.join("")}</span>`:'<span class="note">–</span>'; };
const css=document.createElement("style");
css.textContent=`.cs-w{display:flex;flex-wrap:wrap;gap:4px}.cs-b{font-size:11.5px;padding:2px 8px;border-radius:999px;background:#EEF2F0;color:#3B4A45;white-space:nowrap}
.cs-b.ok{background:#DFF5EC;color:#0B6B50}.cs-b.bad{background:#FDE8E8;color:#B4231B}.cs-b.hot{background:#FFF1DE;color:#B45309;font-weight:700}`;
document.head.appendChild(css);
})();
