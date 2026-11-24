/* 보잇 · 핵심 3가지 바로 시작 + 처음 1회 30초 따라하기 + 보안 표시 (2026-11-23 대표 지시: 쓰기 편하게, 왜 보잇인지 바로 보이게)
   - 홈 검색창 아래: [보험금 청구] [병력고지 체크] [고객 청구 링크] 큰 버튼 + 한 줄 이점
   - 보상청구·병력고지 체크 화면 처음 들어오면 단계별 말풍선 안내 (한 번만, '30초 안내'로 다시 보기)
   - 보상청구·병력 화면 위에 자물쇠 표시: 주민번호 암호화 · 청구 서류 3개월 뒤 자동 파기 */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const LS=k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, LSset=(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} };
const ICON={claim:'<svg viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/></svg>',
  ds:'<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
  link:'<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 18h3M10 8.5l2 2 3-3.5"/></svg>'};
const CORE=[["claim","보험금 청구","청구서 자동작성 · 최대 6곳 동시 팩스","claim"],["ds","병력고지 체크","진료기록을 청약서 질문별로 · 간편 유형 판정","disclose"],["link","고객 청구 링크","고객이 휴대폰으로 사진·서명 → 바로 불러오기","claim"]];

function core(){ const html=CORE.map(([k,t,s])=>`<button type="button" class="c3" data-core="${k}"><span class="c3i">${ICON[k]}</span><span class="c3t"><b>${t}</b><small>${s}</small></span><span class="c3a">›</span></button>`).join("");
  const at=document.querySelector('[data-view="home"] .hsearch'); if(at&&!$("#core3")){ const d=document.createElement("div"); d.id="core3"; d.className="core3"; d.innerHTML=html; at.insertAdjacentElement("afterend",d); }
  const mg=document.querySelector('#mhome .mh-grid'); if(mg&&!$("#core3m")){ const d=document.createElement("div"); d.id="core3m"; d.className="core3 m"; d.innerHTML=html; mg.insertAdjacentElement("beforebegin",d); } }
document.addEventListener("click",e=>{ const b=e.target.closest("[data-core]"); if(!b) return; const k=b.dataset.core, v=(CORE.find(x=>x[0]===k)||[])[3];
  if(v==="claim"&&window.S&&S.sent&&typeof resetClaim==="function") resetClaim();
  go(v); if(k==="link") setTimeout(()=>{ if(typeof openLink==="function") openLink(); },150); });

/* ── 30초 따라하기 ── */
const TOURS={
  claim:[["#stepbody .fsec:nth-of-type(1)","1. 고객","이름 옆 돋보기로 내 고객을 부르면 주민번호 앞자리·휴대폰·주소가 채워집니다. 고객이 링크로 보낸 접수는 화면 맨 위 목록에서 [불러와 청구하기]."],
    ["#stepbody .fsec:nth-of-type(2)","2. 서류 · 진료일자","사진·PDF를 한꺼번에 올리면 진단서·영수증 등으로 자동 분류됩니다. 진료일자가 비어 있으면 노란 칸에 넣어 주세요."],
    [".insmode2","3. 보험사","서류와 예상 보험금으로 청구할 보험사가 자동으로 들어갑니다. 빼려면 ✕ 빼기, 더 넣으려면 [+ 보험사 추가]. 최대 6곳."],
    ["#stepbody .fsec:nth-of-type(5)","4. 사고 상세","질병·상해를 고르고 받을 계좌를 확인합니다."],
    ["#next","5. 확인 후 동시 발송","남은 항목이 없어지면 눌러 주세요. 마지막 확인 창에서 보험사·팩스번호·서류를 체크해야 발송됩니다."]],
  disclose:[["#ds-cust","1. 고객","고객을 고르고 청약 예정일을 넣습니다. 고지 기간은 이 날짜 기준으로 계산합니다."],
    ["#hl-box, .ds-src, #ds-list","2. 진료내역 가져오기","간편인증으로 고객 휴대폰에서 바로 불러오거나, 고객에게 링크를 보내 직접 인증하게 할 수 있습니다."],
    ["#ds-res","3. 결과","맨 위 '한눈에 보기'에서 가입 가능한 간편 유형을 보고, 유형을 누르면 질문별 근거·초진·재진이 나옵니다."]]};
let T=null;
function tour(k,force){ const steps=TOURS[k]; if(!steps) return; if(!force&&LS("boit_tour_"+k)) return; LSset("boit_tour_"+k,"1");
  T={k,i:0,steps}; show(); }
function target(sel){ for(const s of sel.split(",")){ const el=document.querySelector(s.trim()); if(el&&el.offsetParent!==null) return el; } return null; }
function close(){ const o=$("#tour"); if(o) o.remove(); document.querySelectorAll(".tour-hl").forEach(x=>x.classList.remove("tour-hl")); T=null; }
function show(){ document.querySelectorAll(".tour-hl").forEach(x=>x.classList.remove("tour-hl"));
  if(!T) return; if(curView()!==T.k){ close(); return; } while(T.i<T.steps.length&&!target(T.steps[T.i][0])) T.i++;
  if(T.i>=T.steps.length){ close(); return; }
  const [sel,t,txt]=T.steps[T.i], el=target(sel); el.classList.add("tour-hl"); el.scrollIntoView({block:"center",behavior:"smooth"});
  let o=$("#tour"); if(!o){ o=document.createElement("div"); o.id="tour"; document.body.appendChild(o); }
  o.innerHTML=`<div class="tour-b" role="dialog" aria-label="사용 안내"><div class="tour-n">${T.i+1} / ${T.steps.length}</div><b>${t}</b><p>${txt}</p><div class="tour-a"><button type="button" class="lnk" data-tour="skip">그만 보기</button><button type="button" class="btn sm primary" data-tour="next">${T.i+1<T.steps.length?"다음":"시작하기"}</button></div></div>`; }
document.addEventListener("click",e=>{ const b=e.target.closest("[data-tour]"); if(b){ if(b.dataset.tour==="next"&&T){ T.i++; show(); } else close(); return; }
  const g=e.target.closest("[data-tourgo]"); if(g){ tour(g.dataset.tourgo,true); } });

/* 화면 위 '30초 안내' 버튼 + 보안 표시 */
const SEC='<span class="secbar" title="개인정보처리방침 10항"><svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/></svg>주민번호 암호화 · 청구 서류 3개월 뒤 자동 파기</span>';
function deco(){ const c=document.querySelector('[data-view="claim"] #cl-link'); if(c&&!$("#tg-claim")){ c.insertAdjacentHTML("beforebegin",`<button class="btn" type="button" id="tg-claim" data-tourgo="claim">30초 안내</button>`);
    const h=c.closest(".row")&&c.closest(".row").parentElement; if(h&&!h.querySelector(".secbar")) h.insertAdjacentHTML("afterend",`<div class="secwrap">${SEC}</div>`); }
  const dh=document.querySelector('[data-view="disclose"] h1'); if(dh&&!$("#tg-ds")){ dh.insertAdjacentHTML("afterend",`<div class="secwrap">${SEC.replace("3개월 뒤 자동 파기","진료내역은 동의한 경우만 6개월 보관")}<button class="btn sm" type="button" id="tg-ds" data-tourgo="disclose" style="margin-left:auto">30초 안내</button></div>`); } }
const curView=()=>{ const v=[...document.querySelectorAll("[data-view]")].find(x=>x.tagName==="SECTION"&&!x.hidden); return v?v.dataset.view:""; };
function onView(){ core(); deco(); const k=curView();
  if(T&&T.k!==k) close(); /* 다른 화면으로 가면 이전 화면 안내는 닫기 (2026-11-24: 병력고지 안내가 보상청구 화면에 남던 문제) */
  if(k==="claim"||k==="disclose") setTimeout(()=>{ if(curView()===k) tour(k); },400); }
new MutationObserver(ms=>{ if(ms.some(m=>m.attributeName==="hidden"&&m.target.tagName==="SECTION"&&!m.target.hidden)) onView(); }).observe(document.body,{subtree:true,attributes:true,attributeFilter:["hidden"]});
setTimeout(()=>{ core(); deco(); },300);
window.BOIT_TOUR=tour;

const css=document.createElement("style");
css.textContent=`.core3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0 2px}
.c3{display:flex;align-items:center;gap:12px;text-align:left;padding:16px;border-radius:16px;border:1px solid #CFE3DA;background:linear-gradient(135deg,#fff,#EEF9F4);cursor:pointer;font:inherit;color:inherit;box-shadow:0 6px 18px rgba(14,122,95,.08);transition:transform .15s,box-shadow .15s}
.c3:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(14,122,95,.16)}
.c3i{flex:none;width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#0E9A72,#0E7A5F);display:grid;place-items:center}
.c3i svg{width:26px;height:26px;fill:none;stroke:#fff;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.c3t{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}.c3t b{font-size:16.5px}.c3t small{font-size:12.5px;color:#5B6B66;line-height:1.4}.c3a{font-size:24px;color:#0E9A72}
@media (max-width:760px){.core3{grid-template-columns:1fr}.c3{padding:13px 14px}}
.core3.m{margin:10px 0 12px}
.secwrap{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0 4px}
.secbar{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#0B6B50;background:#E9F7F1;border:1px solid #BFE6D6;padding:4px 10px;border-radius:999px}
.secbar svg{width:14px;height:14px;fill:none;stroke:#0B6B50;stroke-width:2}
.tour-hl{position:relative;z-index:9990;outline:3px solid #F59E0B;outline-offset:4px;border-radius:12px;box-shadow:0 0 0 9999px rgba(10,30,25,.35)}
#tour{position:fixed;left:0;right:0;bottom:18px;z-index:9995;display:flex;justify-content:center;pointer-events:none;padding:0 12px}
.tour-b{pointer-events:auto;background:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.28);padding:16px 18px;max-width:460px;width:100%;border-top:4px solid #F59E0B}
.tour-b b{font-size:16px}.tour-b p{margin:6px 0 10px;font-size:14px;line-height:1.55;color:#2B3A35}.tour-n{font-size:11.5px;color:#B45309;font-weight:700;margin-bottom:2px}
.tour-a{display:flex;justify-content:space-between;align-items:center}`;
document.head.appendChild(css);
})();
