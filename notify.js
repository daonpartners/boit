/* 보잇 · 모든 기능의 결과를 화면 가운데 팝업으로 알림 (2026-11-22)
   - 진행 중(…하는 중) → 도는 표시 · 완료(저장·등록·삭제·수정·복사·공개…) → 초록 체크 · 문제(못/실패/확인하세요…) → 주황 ! + [확인]
   - 각 화면의 작은 안내 글(…-msg, …-out)이 바뀌면 그 내용을 그대로 띄움 (사용자가 버튼을 누른 직후만)
   - 저장 버튼을 눌렀는데 따로 안내가 없으면, 서버 저장이 끝난 순간 "저장했습니다"를 띄움 */
(function(){
"use strict";
let lastAct=0, lastLabel="", lastShown=0, lastText="", hideT=null;
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function kindOf(t){
  if(/(중…|중\.\.\.|중\s*$|여는 중|확인하는 중|만드는 중|보내는 중|올리는 중)/.test(t)) return "wait";
  if(/(못했|못 했|못합니다|실패|없습니다|확인하세요|넣으세요|넣어 주세요|고르세요|필요합니다|오류|만료|않습니다|안 됩니다|수 없습니다|먼저)/.test(t)) return "warn";
  if(/(했습니다|되었습니다|됐습니다|완료|저장됨|열었습니다)/.test(t)) return "ok";
  return "info";
}
function notify(text,kind){ text=String(text||"").trim(); if(!text) return;
  const cp=$("#cs-pop"); if(cp&&!cp.hidden) return;              /* 문자 보내기 팝업이 떠 있으면 그쪽이 우선 */
  const now=Date.now(); if(text===lastText&&now-lastShown<1500) return; lastText=text; lastShown=now;
  kind=kind||kindOf(text);
  let w=$("#bn-pop"); if(!w){ w=document.createElement("div"); w.id="bn-pop"; w.setAttribute("role","alertdialog"); w.setAttribute("aria-live","assertive"); document.body.appendChild(w); }
  const ic={wait:'<div class="bn-spin"></div>',ok:'<div class="bn-ic ok">✓</div>',warn:'<div class="bn-ic warn">!</div>',info:'<div class="bn-ic info">i</div>'}[kind];
  const title={wait:"진행 중",ok:"완료",warn:"확인해 주세요",info:"안내"}[kind];
  w.className="bn-"+kind; w.hidden=false;
  w.innerHTML=`<div class="bn-box">${ic}<b>${title}</b><p>${esc(text)}</p>${kind==="warn"||kind==="info"?'<button type="button" class="btn primary" data-bnok>확인</button>':""}</div>`;
  clearTimeout(hideT); if(kind==="ok") hideT=setTimeout(()=>{ w.hidden=true; },2200); else if(kind==="wait") hideT=setTimeout(()=>{ w.hidden=true; },20000); else if(kind==="info") hideT=setTimeout(()=>{ w.hidden=true; },6000);
}
window.notify=notify;
document.addEventListener("click",e=>{ if(e.target.closest("[data-bnok]")){ const w=$("#bn-pop"); if(w) w.hidden=true; return; }
  const w=$("#bn-pop"); if(w&&!w.hidden&&(w.className==="bn-ok")&&!e.target.closest("#bn-pop")) w.hidden=true;
  const b=e.target.closest("button,a.btn,[role=button]"); if(!b) return; lastAct=Date.now(); lastLabel=(b.textContent||"").replace(/\s+/g," ").trim(); lastShown=0; },true);
document.addEventListener("keydown",e=>{ if(e.key==="Enter") { lastAct=Date.now(); lastLabel="저장"; } if(e.key==="Escape"){ const w=$("#bn-pop"); if(w) w.hidden=true; } },true);
document.addEventListener("submit",()=>{ lastAct=Date.now(); lastLabel="저장"; },true);

/* 각 화면 안내 글이 바뀌면 띄움: id가 …msg / …out 으로 끝나는 곳 (문자 보내기 cs-out 은 자체 팝업이 있어 제외) */
const isMsg=el=>el&&el.id&&el.tagName!=="BUTTON"&&(/(^|[-_])(msg|out)([-_][\w-]+)?$/i.test(el.id)||/msg$|^pdfmsg/i.test(el.id))&&!/^cs-out/.test(el.id);
new MutationObserver(ms=>{ if(Date.now()-lastAct>5000) return;
  const seen=new Set();
  ms.forEach(m=>{ let el=m.target.nodeType===3?m.target.parentElement:m.target; for(let i=0;i<3&&el&&!isMsg(el);i++) el=el.parentElement; if(isMsg(el)&&!seen.has(el)){ seen.add(el); const t=(el.textContent||"").trim(); if(t) notify(t); } });
}).observe(document.body,{subtree:true,childList:true,characterData:true});

/* 저장 버튼을 눌렀는데 안내가 없을 때: 서버 저장 결과로 알림 */
const ACT=[[/삭제|지우기|빼기/,"삭제했습니다."],[/등록|추가|넣기/,"등록했습니다."],[/수정|바꾸기|변경/,"수정했습니다."],[/반영|공개/,"반영했습니다."],[/저장|확인|적용|완료/,"저장했습니다."]];
window.__onSave=ok=>{ if(Date.now()-lastAct>4000) return; if(Date.now()-lastShown<4000&&lastShown>lastAct) return;
  if(!ok){ notify("저장하지 못했습니다. 인터넷 연결을 확인하세요.","warn"); return; }
  const hit=ACT.find(([re])=>re.test(lastLabel)); if(hit) notify(hit[1],"ok"); };

/* ===== 돋보기: 미리보기·서류 사진을 크게 보기 (2026-11-22) =====
   - 서류 사진·썸네일(.dimg img · .dthumb img): 누르면 크게
   - A4 미리보기(.sheets) · 문자 미리보기(.smsprev) · [data-zoomable]: 오른쪽 위 [🔍 크게] 버튼 */
function zv(){ let z=document.getElementById("bn-zoom"); if(!z){ z=document.createElement("div"); z.id="bn-zoom"; z.innerHTML='<div class="bz-bar"><span>크게 보기 · 아무 곳이나 누르거나 Esc로 닫기</span><button type="button" class="btn" data-bzx>닫기 ✕</button></div><div class="bz-body"></div>'; document.body.appendChild(z);
  z.addEventListener("click",e=>{ if(e.target.closest("[data-bzx]")||!e.target.closest(".bz-body > *")||e.target.closest(".bz-img")) z.hidden=true; }); } return z; }
function zoomImg(src,alt,extra){ const z=zv(); z.querySelector(".bz-body").innerHTML=`<img class="bz-img" src="${src}" alt="${esc(alt||"")}">${extra||""}`; z.hidden=false; }
function zoomNode(el){ const z=zv(), c=el.cloneNode(true); c.querySelectorAll("[id]").forEach(x=>x.removeAttribute("id")); c.removeAttribute("id"); c.querySelectorAll(".bz-btn").forEach(x=>x.remove());
  c.style.zoom="1"; c.style.setProperty("--sz","1"); c.style.setProperty("--mz","1"); c.style.maxWidth="none"; c.classList.add("bz-clone");
  const b=z.querySelector(".bz-body"); b.innerHTML=""; b.appendChild(c); z.hidden=false; }
document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ const z=document.getElementById("bn-zoom"); if(z) z.hidden=true; } });
document.addEventListener("click",e=>{
  const zb=e.target.closest(".bz-btn"); if(zb){ e.preventDefault(); e.stopPropagation(); zoomNode(zb.parentElement); return; }
  const im=e.target.closest(".dimg img,.dthumb img,.docthumbs img,[data-zoomable] img"); if(!im||e.target.closest("button,select,label,#bn-zoom")) return;
  const dk=im.dataset.doc, f=dk&&window.boitDocFile?window.boitDocFile(...dk.split(":")):null;
  if(f&&/pdf$/i.test(f.type||f.name)){ const u=URL.createObjectURL(f); const w=window.open(u,"_blank"); if(w){ setTimeout(()=>URL.revokeObjectURL(u),60000); return; } zoomImg(im.src,im.alt,'<p class="bz-note">PDF 첫 장 미리보기입니다 (새 창이 막혀 있어 전체를 열지 못했습니다).</p>'); return; }
  zoomImg(im.src,im.alt,"");
},true);
let zt=0; new MutationObserver(()=>{ clearTimeout(zt); zt=setTimeout(()=>{ document.querySelectorAll(".sheets,.smsprev,[data-zoomable]").forEach(el=>{ if(el.closest("#bn-zoom")||el.querySelector(":scope>.bz-btn")||el.hidden||!el.children.length) return; if(getComputedStyle(el).position==="static") el.style.position="relative"; const b=document.createElement("button"); b.type="button"; b.className="bz-btn"; b.textContent="🔍 크게"; b.setAttribute("aria-label","크게 보기"); el.prepend(b); }); },300); }).observe(document.body,{childList:true,subtree:true});

const css=document.createElement("style"); css.textContent=`
#bn-pop{position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;pointer-events:none;padding:20px}#bn-pop[hidden]{display:none}
#bn-pop.bn-warn,#bn-pop.bn-info{background:rgba(15,20,25,.35);pointer-events:auto}
.bn-box{pointer-events:auto;background:var(--surface,#fff);color:var(--text,#111);border-radius:18px;padding:24px 26px 20px;min-width:260px;max-width:min(440px,100%);text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.25);animation:bnIn .18s ease-out}
.bn-box b{display:block;font-size:19px;margin:10px 0 6px}.bn-box p{margin:0;font-size:15px;line-height:1.6;color:var(--muted,#555);white-space:pre-line;word-break:keep-all}.bn-box .btn{margin-top:16px;min-width:120px}
.bn-ic{width:52px;height:52px;border-radius:50%;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#fff}.bn-ic.ok{background:#12a37a}.bn-ic.warn{background:#e08a00}.bn-ic.info{background:#2f6fde;font-family:Georgia,serif}
.bn-spin{width:48px;height:48px;margin:0 auto;border-radius:50%;border:5px solid #e3ece8;border-top-color:var(--accent,#0f7a5c);animation:bnR 1s linear infinite}
#bn-zoom{position:fixed;inset:0;z-index:10002;background:rgba(10,12,15,.85);display:flex;flex-direction:column}#bn-zoom[hidden]{display:none}
.bz-bar .btn{background:#fff;color:#111}.bz-bar{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;color:#ddd;font-size:13px}.bz-body{flex:1;overflow:auto;display:flex;flex-direction:column;align-items:center;padding:10px 16px 30px;gap:10px;cursor:zoom-out}
.bz-img{max-width:min(1100px,96vw);height:auto;border-radius:8px;background:#fff;box-shadow:0 10px 40px rgba(0,0,0,.5)}.bz-note{color:#ddd;font-size:13px;margin:0}
.bz-clone{background:#fff;border-radius:10px;padding:14px;cursor:default;max-width:96vw}.bz-clone .sheet{max-width:none}
.bz-btn{position:absolute;right:8px;top:8px;z-index:3;border:0;border-radius:999px;background:rgba(0,0,0,.6);color:#fff;font-size:12px;font-weight:700;padding:5px 10px;cursor:pointer}
.dimg img,.dthumb img,.docthumbs img{cursor:zoom-in}
@keyframes bnR{to{transform:rotate(360deg)}}@keyframes bnIn{from{transform:scale(.94);opacity:0}to{transform:none;opacity:1}}`;
document.head.appendChild(css);
})();
