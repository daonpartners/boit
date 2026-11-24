/* 처음 온 설계사에게 '개인페이지부터 만들기' 유도 (2026-11-24 대표 지시)
   - 개인페이지가 아직 공개 안 됐으면: 홈 맨 위 안내 띠 + 처음 한 번 안내 창
   - 개인페이지가 있어야 되는 것: 상담 신청 링크·이벤트·문자 끝 내 링크·증권속지 QR
   - 체험(데모) 화면에는 띄우지 않음 */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const LS=k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } }, LSset=(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} };
const ready=()=>typeof ME!=="undefined"&&typeof CLOUD!=="undefined"&&CLOUD.user&&!ME.demo;
const hasPage=()=>{ try{ return typeof hpUrl==="function"&&!!hpUrl(); }catch(e){ return false; } };
const started=()=>{ try{ return !!(ME.page&&ME.page.slug); }catch(e){ return false; } };
const WHY=["고객에게 보내는 <b>내 소개 페이지</b> (사진·연락처·카톡 상담)","고객이 남기는 <b>상담 신청</b>이 랜딩페이지로 들어옴","문자·카드 끝에 <b>내 링크</b>, 증권 속지에 <b>내 QR</b>"];

function band(){
  const html=`<div class="hpn-in"><div class="hpn-tx"><b>${started()?"개인페이지를 공개하면 끝납니다":"1단계: 내 개인페이지부터 만드세요"}</b><span>3분이면 됩니다 · 만들어 두면 문자·상담 신청·이벤트가 모두 이 페이지로 연결됩니다</span></div><button type="button" class="btn primary" data-go="homepage">${started()?"공개하러 가기":"개인페이지 만들기"}</button></div>`;
  [["#hpn",'[data-view="home"] .hsearch',"beforebegin"],["#hpnm","#mhome .mh-grid","beforebegin"]].forEach(([id,at,pos])=>{
    let el=$(id); const show=ready()&&!hasPage();
    if(!show){ if(el) el.remove(); return; }
    const a=$(at); if(!a) return;
    if(!el){ el=document.createElement("div"); el.id=id.slice(1); el.className="hpn"; a.insertAdjacentElement(pos,el); }
    el.innerHTML=html;
  });
}
function popOnce(){
  if(!ready()||hasPage()) return; const k="boit_hpn_pop_"+CLOUD.user.id; if(LS(k)) return; LSset(k,"1");
  const o=document.createElement("div"); o.id="hpn-pop"; o.innerHTML=`<div class="hpn-box" role="dialog" aria-label="개인페이지 만들기 안내">
    <b class="hpn-t">반갑습니다! 개인페이지부터 만들어 주세요</b>
    <p class="hpn-s">고객에게 보낼 <b>내 소개 페이지</b>입니다. 사진·이름·연락처만 넣으면 3분이면 끝납니다.</p>
    <ul>${WHY.map(w=>`<li>${w}</li>`).join("")}</ul>
    <div class="hpn-a"><button type="button" class="btn" data-hpn="later">나중에</button><button type="button" class="btn primary" data-hpn="go">지금 만들기</button></div></div>`;
  document.body.appendChild(o);
}
document.addEventListener("click",e=>{ const b=e.target.closest("[data-hpn]"); if(!b) return; const o=$("#hpn-pop"); if(o) o.remove(); if(b.dataset.hpn==="go"&&typeof go==="function"){ go("homepage"); window.scrollTo(0,0); } });

let n=0; const tick=()=>{ band(); if(ready()){ setTimeout(popOnce,1200); return; } if(++n<40) setTimeout(tick,500); };
setTimeout(tick,800);
/* 화면 바뀔 때·개인페이지 공개 후 다시 확인 */
new MutationObserver(ms=>{ if(ms.some(m=>m.attributeName==="hidden"&&m.target.tagName==="SECTION"&&!m.target.hidden)) band(); }).observe(document.body,{subtree:true,attributes:true,attributeFilter:["hidden"]});
window.BOIT_HPN=band;

const css=document.createElement("style");
css.textContent=`.hpn{margin:12px 0}.hpn-in{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:14px;background:#FFF7E6;border:1.5px solid #F2B94B}
.hpn-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}.hpn-tx b{font-size:16px;color:#7A4B00}.hpn-tx span{font-size:13px;color:#6B5A3A;line-height:1.45}
@media (max-width:560px){.hpn-in{flex-direction:column;align-items:stretch}.hpn-in .btn{width:100%}}
#hpn-pop{position:fixed;inset:0;z-index:9996;background:rgba(10,30,25,.45);display:flex;align-items:center;justify-content:center;padding:16px}
.hpn-box{background:#fff;border-radius:18px;max-width:420px;width:100%;padding:22px 20px;box-shadow:0 20px 60px rgba(0,0,0,.3);display:flex;flex-direction:column;gap:10px}
.hpn-t{font-size:19px}.hpn-s{margin:0;font-size:14.5px;line-height:1.55;color:#2B3A35}.hpn-box ul{margin:0;padding-left:18px;font-size:14px;line-height:1.7;color:#2B3A35}
.hpn-a{display:flex;gap:8px;justify-content:flex-end;margin-top:6px}.hpn-a .btn{min-width:96px}`;
document.head.appendChild(css);
})();
