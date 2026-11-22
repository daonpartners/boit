/* 보잇 · 제안·영업 › 소개 이벤트 (2026-11-18 초안)
   설계사가 이벤트(주제·기간·내용·감사 선물)를 만들고 → 개인페이지에 반영 → 이벤트 링크·고객별 소개 링크·QR·공유 문구로 퍼뜨림.
   - 저장: ME.events (보잇 저장과 함께 클라우드 보관), 공개: boit_pages.data.events (개인페이지 공개 때 같이 올라감)
   - 고객 화면: p.html?u=주소&ev=이벤트&r=소개자코드 → 이벤트 카드 + '참여 신청'(설계사에게 문자) + '친구에게 전하기'
   - 소개받는 분이 직접 신청하는 방식(소개자가 남의 연락처를 대신 적지 않음)
   - 보험업법 제98조·시행령 제46조: 계약자에게 주는 금품은 최초 1년 보험료 10%와 3만원 중 적은 금액까지 → 계약 조건 선물 문구 막음 */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const G=n=>{ try{ return eval(n); }catch(_){ return null; } };
const today=()=>new Date(Date.now()+9*3600e3).toISOString().slice(0,10);
const addDays=(d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); };
const fmtD=v=>{ const d=String(v||"").replace(/\D/g,""); return d.length===8?`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6)}`:v; };

const TPL=[
 {t:"가족 보험 무료 점검",sub:"우리 가족 보험, 겹치거나 빠진 곳 없을까요?",body:"가입하신 보험을 한 번에 모아 보장이 겹치거나 빠진 곳이 없는지 무료로 점검해 드립니다.\n보험을 새로 들라는 상담이 아니라, 지금 가진 보험을 제대로 아는 시간입니다.",gift:"점검 후 보장 정리표(PDF) 드림"},
 {t:"숨은 보험금 찾기",sub:"3년 안의 병원비, 아직 안 받은 보험금이 있을 수 있어요",body:"최근 3년 진료 기록과 가입 보험을 비교해 청구하지 않은 보험금이 있는지 찾아 드립니다.\n보험금 청구권은 3년이 지나면 사라집니다(상법 제662조).",gift:"청구 서류 준비 도움"},
 {t:"우리 가게 화재보험 점검",sub:"사장님 가게, 불나면 정말 다 보상될까요?",body:"가게 화재보험·배상책임보험의 가입금액과 보장 범위를 점검해 드립니다.\n의무보험(다중이용업소 화재배상책임 등) 가입 대상인지도 함께 확인합니다.",gift:"가게 보험 점검표 드림"},
 {t:"아이 보험 정리",sub:"태아·어린이 보험, 지금 구성 괜찮을까요?",body:"자녀 보험의 보장 구성과 만기, 갱신 여부를 정리해 드립니다.",gift:"자녀 보장 정리표 드림"},
 {t:"새해 보험 다이어트",sub:"보험료는 줄이고 보장은 지키기",body:"겹치는 보장과 꼭 필요한 보장을 구분해 보험료 부담을 줄일 방법을 함께 찾아 드립니다.\n해지·변경은 손해가 없는지 먼저 확인한 뒤 결정하세요.",gift:"보험료 정리표 드림"}
];
/* 계약 조건 선물·고액 금품 문구 검사 */
function warn(e){ const t=[e.title,e.sub,e.body,e.gift].join(" "), w=[];
  if(/(계약|가입|체결|청약)\s*(하시면|하면|시|고객|완료|조건|만\s*해도)/.test(t)&&/(드림|드려|증정|선물|지급|사은|혜택|상품권|현금|쿠폰)/.test(t)) w.push("‘가입하면 선물’처럼 계약을 조건으로 한 혜택은 특별이익 제공(보험업법 제98조)이 될 수 있습니다.");
  const won=[...t.matchAll(/(\d[\d,]*)\s*(만\s*원|만원|원)/g)].map(m=>{ const n=+m[1].replace(/,/g,""); return /만/.test(m[2])?n*10000:n; });
  if(won.some(n=>n>30000)) w.push("3만원을 넘는 금품은 쓸 수 없습니다(보험업법 시행령 제46조: 최초 1년 보험료 10%와 3만원 중 적은 금액).");
  if(/현금|보험료\s*(대납|지원|할인)|수수료\s*(나눔|환급)/.test(t)) w.push("현금·보험료 대납·할인·수수료 나눔은 금지된 특별이익입니다.");
  return w; }

const S={sel:null,ref:"",draft:null,tpl:null};
function EV(){ const M=G("ME"); if(!M) return []; if(!Array.isArray(M.events)) M.events=[]; return M.events; }
function save(){ if(S.draft) return; try{ const f=G("cloudSave"); if(f) f(true); }catch(_){} }
function base(){ try{ return (G("hpUrl")&&G("hpUrl")())||""; }catch(_){ return ""; } }
function link(e,ref){ const b=base(); if(!b) return ""; return b+"&ev="+encodeURIComponent(e.id)+(ref?"&r="+encodeURIComponent(ref):""); }
function state(e){ const d=today(); if(!e.on) return ["꺼짐","x"]; if(e.start&&d<e.start) return ["예정","y"]; if(e.end&&d>e.end) return ["종료","x"]; return ["진행 중","g"]; }
const refOf=c=>"c"+Number(String(c.id).replace(/\D/g,"")||0).toString(36);

/* QR */
function libQR(){ return window.QRCode?Promise.resolve():new Promise((ok,no)=>{ const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; s.onload=ok; s.onerror=no; document.head.appendChild(s); }); }
async function drawQR(box,text){ box.innerHTML=""; if(!text) return; try{ await libQR(); new window.QRCode(box,{text,width:150,height:150,correctLevel:window.QRCode.CorrectLevel.M}); }catch(_){ box.textContent="QR을 만들지 못했습니다"; } }

function shareText(e,url){ const M=G("ME")||{}; return `[${e.title}]\n${e.sub||""}\n\n${(e.body||"").split("\n")[0]}\n${e.start||e.end?`기간: ${e.start||""} ~ ${e.end||""}\n`:""}\n신청·문의: ${url}\n\n${M.name||""} ${M.phone||""}`.replace(/\n{3,}/g,"\n\n"); }

function cur(){ return EV().find(x=>x.id===S.sel)||S.draft||null; }
function pgd(){ try{ const f=G("pgData"); if(f) return f(); }catch(_){} const M=G("ME")||{}; return {name:M.name||"",company:M.company||"",branch:M.branch||"",phone:M.phone||""}; }
/* 오른쪽 미리보기: 개인페이지에 걸릴 이벤트 카드 + 공유 문구 (저장 전 내용 그대로) */
function pvHTML(e){ const d=pgd(), u=link(e,S.ref)||"(개인페이지 주소)", c=d.color||"#0E7A5F";
  return `<div class="evp" style="--hpc:${esc(c)}"><div class="evp-top"><span class="av">${esc((d.name||"?").slice(0,1))}</span><span><b>${esc(d.name||"")} 설계사</b><small>${esc([d.company,d.branch].filter(Boolean).join(" "))}</small></span></div>
    <div class="ev"><span class="lb">진행 중인 이벤트</span><h4>${esc(e.title||"(제목)")}</h4>${e.sub?`<p class="sb">${esc(e.sub)}</p>`:""}
    ${String(e.body||"").split("\n").filter(Boolean).map(t=>`<p>${esc(t)}</p>`).join("")}
    ${e.gift?`<div class="gf">🎁 ${esc(e.gift)}</div>`:""}${e.start||e.end?`<div class="dt">기간 ${esc(e.start||"")} ~ ${esc(e.end||"")}</div>`:""}
    <div class="two"><span class="cta">${esc(e.cta||"참여 신청하기")}</span><span class="cta" style="background:#fff;color:var(--hpc);border:1px solid currentColor">친구에게 전하기</span></div></div>
    <p class="evp-n">참여 신청을 누르면 이름·휴대폰·개인정보 동의 칸이 열리고, 신청은 신청 DB로 들어옵니다.</p></div>
  <b style="font-size:13px;display:block;margin:12px 0 4px">공유 문구 (카톡·문자)</b><div class="evp-bub">${esc(shareText(e,u))}</div>`; }
function pvUpd(){ const e=cur(), x=$("#ev-pv"); if(e&&x) x.innerHTML=pvHTML(e); }
function draw(){
  const sec=document.querySelector('section[data-view="event"]'); if(!sec) return;
  const L=EV(), e=cur(), b=base();
  sec.innerHTML=`<div class="row between" style="margin-top:12px"><div><h2 style="margin:0">이벤트 페이지 <span class="note" style="font-weight:400">개인페이지에 거는 소개·참여 이벤트 · 신청은 신청 DB로</span></h2><p class="note" style="margin:2px 0 0">주제를 누르면 왼쪽에서 고치고, 오른쪽에서 고객이 보는 화면을 바로 확인합니다</p></div></div>
  ${!b?`<div class="panel" style="border:2px solid #E09A12;background:#FFF3D1;margin-top:12px"><b>개인페이지를 먼저 공개해 주세요.</b> 이벤트는 개인페이지에 걸리고, 링크도 개인페이지 주소로 만들어집니다. <button class="btn hot sm" type="button" data-go="homepage">개인페이지 열기</button></div>`:""}
  ${L.length?`<div style="margin-top:12px"><b style="font-size:14px">내 이벤트</b><div class="ev-row">${L.map(x=>{ const s=state(x); return `<button type="button" class="ev-it${x.id===S.sel?" on":""}" data-evsel="${esc(x.id)}"><b>${esc(x.title||"(제목 없음)")}</b><span class="hm-flag ${s[1]}" style="margin:0">${s[0]}</span><small>${esc(x.start||"")} ~ ${esc(x.end||"")}</small></button>`; }).join("")}</div></div>`:""}
  <div style="margin-top:12px"><b style="font-size:14px">${L.length?"새 이벤트 — 주제 고르기":"이벤트 주제 고르기"}</b><div class="ev-row">${TPL.map((t,i)=>`<button type="button" class="ev-tp${S.draft&&S.tpl===i?" on":""}" data-evtpl="${i}"><b>${esc(t.t)}</b><span>${esc(t.sub)}</span></button>`).join("")}<button type="button" class="ev-tp${S.draft&&S.tpl===-1?" on":""}" data-evtpl="-1"><b>직접 만들기</b><span>주제와 내용을 처음부터 씁니다</span></button></div></div>
  ${e?`<div class="ev-2col"><div class="ev-main">${editor(e)}</div><div class="ev-pvw"><b style="font-size:13px">미리보기 — 개인페이지에서 고객이 보는 화면</b><div class="ev-phone" id="ev-pv">${pvHTML(e)}</div></div></div>`
    :`<p class="note" style="margin-top:14px">위에서 이벤트나 주제를 누르세요.</p>`}`;
  if(e&&!S.draft){ const u=link(e,S.ref); drawQR($("#ev-qr"),u); }
}
function wbox(W){ return W.length?`<div class="ev-warn">${W.map(x=>`<div>⚠ ${esc(x)}</div>`).join("")}</div>`:""; }
function editor(e){
  const W=warn(e), u=link(e,S.ref), CU=G("CUSTOMERS")||[], s=state(e);
  return `<div class="panel"><div class="row between"><h2 style="font-size:16px;margin:0">이벤트 내용 <span class="hm-flag ${s[1]}" style="margin-left:6px">${s[0]}</span></h2><div class="row" style="gap:6px"><label style="display:flex;gap:5px;align-items:center;font-size:13px"><input type="checkbox" data-evf="on" ${e.on?"checked":""}> 개인페이지에 보이기</label>${S.draft?`<button class="btn primary sm" type="button" id="ev-keep">이 이벤트 저장</button><button class="btn sm" type="button" id="ev-del">닫기</button>`:`<button class="btn sm" type="button" id="ev-del">삭제</button>`}</div></div>
    ${S.draft?`<p class="note" style="margin:6px 0 0;background:#EEF4FF;border-radius:8px;padding:6px 9px">아직 저장 전입니다. 내용을 고친 뒤 [이 이벤트 저장]을 누르면 내 이벤트에 추가되고 링크·QR이 만들어집니다.</p>`:""}
    <div class="grid3" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:10px">
      <div class="field" style="grid-column:1/-1"><label>제목</label><input data-evf="title" value="${esc(e.title)}" placeholder="예: 가족 보험 무료 점검"></div>
      <div class="field" style="grid-column:1/-1"><label>한 줄 소개</label><input data-evf="sub" value="${esc(e.sub)}"></div>
      <div class="field" style="grid-column:1/-1"><label>내용</label><textarea data-evf="body" rows="4" style="border:1px solid var(--line);border-radius:8px;padding:9px 11px;font:inherit;background:var(--surface);color:var(--fg)">${esc(e.body)}</textarea></div>
      <div class="field"><label>시작일</label><input data-evf="start" value="${esc(e.start)}" placeholder="20261118" inputmode="numeric"></div>
      <div class="field"><label>종료일</label><input data-evf="end" value="${esc(e.end)}" placeholder="20261231" inputmode="numeric"></div>
      <div class="field" style="grid-column:1/-1"><label>신청해 주신 분께 드리는 것 (선택)</label><input data-evf="gift" value="${esc(e.gift)}" placeholder="예: 보장 정리표(PDF), 3만원 이하 소정의 감사 선물"></div>
      <div class="field" style="grid-column:1/-1"><label>신청 버튼 글자</label><input data-evf="cta" value="${esc(e.cta||"무료 점검 신청하기")}"></div>
    </div>
    <label style="display:flex;gap:6px;align-items:flex-start;margin-top:8px;font-size:13px"><input type="checkbox" class="need" data-evf="ok" ${e.ok?"checked":""} style="margin-top:3px"> 선물은 계약 여부와 관계없이 드리며, 3만원 이하이고 현금·보험료 할인·대납이 아님을 확인했습니다 (보험업법 제98조)</label>
    <div id="ev-wb">${wbox(W)}</div>
  </div>
  ${S.draft?"":`  <div class="panel" style="margin-top:12px"><div class="row between"><h2 style="font-size:16px;margin:0">링크 · QR · 공유</h2><button class="btn hot" type="button" id="ev-pub" ${!base()||W.length||!e.ok?"disabled":""}>개인페이지에 반영</button></div>
    <p class="note" style="margin:4px 0 10px">${!base()?"개인페이지를 공개하면 링크가 만들어집니다.":W.length||!e.ok?"위 확인 체크와 경고를 해결해야 반영할 수 있습니다.":e.pub?`마지막 반영: ${esc(e.pub)} · 내용을 고쳤다면 다시 반영하세요`:"아직 개인페이지에 반영하지 않았습니다."}</p>
    <div class="ev-link"><div id="ev-qr" class="ev-qr"></div><div style="min-width:0;flex:1">
      <div class="field"><label>누구 링크로 보낼까요?</label><select id="ev-ref"><option value="">기본 링크 (누구나)</option>${CU.map(c=>`<option value="${esc(refOf(c))}" ${S.ref===refOf(c)?"selected":""}>${esc(c.name)} 님 소개 링크</option>`).join("")}</select></div>
      <div class="ev-url">${u?esc(u):"(개인페이지 공개 후 생성)"}</div>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin-top:8px"><button class="btn sm" type="button" id="ev-copy" ${u?"":"disabled"}>링크 복사</button><button class="btn sm" type="button" id="ev-copyt" ${u?"":"disabled"}>공유 문구 복사</button><a class="btn sm" id="ev-sms" ${u?`href="sms:?body=${encodeURIComponent(shareText(e,u))}"`:'aria-disabled="true"'}>내 문자앱으로</a><button class="btn sm" type="button" id="ev-open" ${u&&e.pub?"":"disabled"}>고객 화면 보기</button></div>
      <p class="note" style="margin:8px 0 0">고객별 소개 링크로 들어온 신청은 문자에 소개자 코드가 함께 와서 누가 소개했는지 알 수 있습니다.</p>
    </div></div>
  </div>`}`;
}

document.addEventListener("click",async ev=>{ const t=ev.target.closest&&ev.target.closest("button,a"); if(!t||!t.closest('section[data-view="event"]')) return;
  const L=EV(), e=cur();
  if(t.dataset.evsel){ S.sel=t.dataset.evsel; S.draft=null; S.ref=""; draw(); return; }
  if(t.dataset.evtpl!=null){ const i=+t.dataset.evtpl, p=TPL[i]||{t:"",sub:"",body:"",gift:""};
    const n={id:Date.now().toString(36),title:p.t,sub:p.sub,body:p.body,gift:p.gift,cta:"무료 점검 신청하기",start:today(),end:addDays(today(),30),on:true,ok:false,pub:""};
    S.draft=n; S.tpl=i; S.sel=null; draw(); return; }
  if(t.id==="ev-keep"&&S.draft){ const n=S.draft; S.draft=null; S.tpl=null; L.unshift(n); S.sel=n.id; save(); draw(); return; }
  if(t.id==="ev-del"&&S.draft){ S.draft=null; S.tpl=null; draw(); return; }
  if(!e) return;
  if(t.id==="ev-del"){ if(!confirm("이 이벤트를 삭제할까요?")) return; L.splice(L.indexOf(e),1); S.sel=null; save(); draw(); return; }
  const u=link(e,S.ref);
  if(t.id==="ev-copy"&&u){ try{ await navigator.clipboard.writeText(u); t.textContent="복사했습니다"; }catch(_){ prompt("링크",u); } return; }
  if(t.id==="ev-copyt"&&u){ try{ await navigator.clipboard.writeText(shareText(e,u)); t.textContent="복사했습니다"; }catch(_){ prompt("문구",shareText(e,u)); } return; }
  if(t.id==="ev-open"&&u){ window.open(u,"_blank","noopener"); return; }
  if(t.id==="ev-pub"){ const M=G("ME"), C=G("CLOUD"), pg=G("pgData"), P=G("PGo")&&G("PGo")();
    if(!M||M.demo||!C||!C.user||!C.sb||!P||!P.slug){ alert("로그인한 계정에서 개인페이지를 공개한 뒤 반영할 수 있습니다."); return; }
    t.disabled=true; t.textContent="반영 중…";
    let error=null; try{ ({error}=await C.sb.from("boit_pages").upsert({slug:P.slug,user_id:C.user.id,data:pg(),updated_at:new Date().toISOString()},{onConflict:"user_id"})); }catch(err){ error=err; }
    if(error){ t.disabled=false; t.textContent="개인페이지에 반영"; alert("반영하지 못했습니다: "+(error.message||"연결 오류")); return; }
    L.forEach(x=>{ if(x.on) x.pub=today(); }); save(); draw(); return; }
});
document.addEventListener("input",ev=>{ const t=ev.target; if(!t.closest||!t.closest('section[data-view="event"]')) return;
  const e=cur(); if(!e||!t.dataset.evf||t.type==="checkbox") return; e[t.dataset.evf]=t.value; pvUpd(); });
document.addEventListener("change",ev=>{ const t=ev.target; if(!t.closest||!t.closest('section[data-view="event"]')) return;
  const e=cur();
  if(t.id==="ev-ref"){ S.ref=t.value; draw(); return; }
  if(!e||!t.dataset.evf) return;
  if(t.type==="checkbox") e[t.dataset.evf]=t.checked; else if(/start|end/.test(t.dataset.evf)) e[t.dataset.evf]=t.value=fmtD(t.value); else e[t.dataset.evf]=t.value;
  save();
  if(t.type==="checkbox"){ draw(); return; }
  /* 글자 칸은 화면을 다시 그리지 않음 → 바로 누른 버튼(저장 등)이 한 번에 눌림 */
  const W=warn(e), wb=$("#ev-wb"), pb=$("#ev-pub"); if(wb) wb.innerHTML=wbox(W); if(pb) pb.disabled=!base()||!!W.length||!e.ok; pvUpd(); });
new MutationObserver(()=>{ const s=document.querySelector('section[data-view="event"]'); if(s&&!s.hidden&&!s.dataset.evDrawn){ s.dataset.evDrawn=1; draw(); } if(s&&s.hidden) delete s.dataset.evDrawn; })
  .observe(document.body,{subtree:true,attributes:true,attributeFilter:["hidden"]});

const CSS=`
.ev-wrap{display:grid;grid-template-columns:260px minmax(0,1fr);gap:12px;margin-top:12px;align-items:start}
.ev-it{display:grid;grid-template-columns:1fr auto;gap:2px 6px;width:100%;text-align:left;border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:9px 10px;margin-bottom:6px;font:inherit;color:var(--fg);cursor:pointer}
.ev-it small{grid-column:1/-1;color:var(--muted);font-size:11.5px}.ev-it.on{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 25%,transparent)}
.ev-tpl{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
.ev-tp{text-align:left;border:1px solid var(--line);background:var(--surface);border-radius:12px;padding:14px;font:inherit;color:var(--fg);cursor:pointer}.ev-tp:hover{border-color:var(--accent)}
.ev-tp b{display:block;font-size:15px;margin-bottom:4px}.ev-tp span{font-size:12.5px;color:var(--muted);line-height:1.45}
.ev-warn{margin-top:10px;background:#FBE3D9;color:#8E3420;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.6}
.ev-link{display:flex;gap:16px;align-items:flex-start}.ev-qr{width:150px;height:150px;flex:none;background:#fff;border:1px solid var(--line);border-radius:10px;padding:6px;box-sizing:content-box}
.ev-url{font-size:12.5px;word-break:break-all;background:var(--surface-2,#F3F5F4);border-radius:8px;padding:8px 10px;margin-top:6px}
.ev-pre{white-space:pre-wrap;font:inherit;font-size:13px;background:var(--surface-2,#F3F5F4);border-radius:10px;padding:12px;margin:0;line-height:1.6}
.ev-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;padding:6px 2px 4px}.ev-row .ev-it,.ev-row .ev-tp{margin:0;padding:10px 12px}
.ev-tp.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,var(--surface));box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 25%,transparent)}
.ev-2col{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px;margin-top:12px;align-items:start}.ev-pvw{position:sticky;top:12px}
.ev-phone{margin-top:6px;border:1px solid #E4E7EB;border-radius:22px;padding:12px;background:#F4F6F8;max-height:calc(100vh - 80px);overflow:auto}
.evp{background:#F6F8F7;border-radius:14px;overflow:hidden;border:1px solid #E1E6E3;color:#18221F}.evp-top{display:flex;gap:10px;align-items:center;padding:12px 14px;background:var(--hpc);color:#fff}
.evp-top .av{width:38px;height:38px;border-radius:50%;background:#fff;color:var(--hpc);display:flex;align-items:center;justify-content:center;font-weight:800}.evp-top b{display:block;font-size:14px}.evp-top small{font-size:11.5px;opacity:.85}
.evp .ev{margin:12px;border:2px solid var(--hpc);border-radius:14px;padding:14px 14px 12px;background:#fff}.evp .lb{display:inline-block;font-size:11.5px;font-weight:700;color:#fff;background:var(--hpc);border-radius:99px;padding:2px 9px}
.evp h4{margin:8px 0 4px;font-size:17px}.evp .sb{margin:0 0 8px;font-size:13.5px;color:#4A5753}.evp .ev p{font-size:13px;line-height:1.65;margin:0 0 6px;color:#2A3532}
.evp .gf{font-size:12.5px;background:#F0F3F1;border-radius:8px;padding:7px 9px;margin:6px 0}.evp .dt{font-size:12px;color:#7A8682}.evp .two{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.evp .cta{display:block;text-align:center;margin-top:8px;background:var(--hpc);color:#fff;border-radius:9px;padding:10px;font-weight:700;font-size:13px}.evp-n{font-size:11.5px;color:#7A8682;margin:0 14px 12px;line-height:1.5}
.evp-bub{background:#fff;border-radius:14px 14px 14px 4px;padding:10px 12px;font-size:12.5px;line-height:1.55;white-space:pre-wrap;word-break:break-all;box-shadow:0 1px 2px rgba(0,0,0,.06)}
@media(max-width:900px){.ev-2col{grid-template-columns:1fr}.ev-pvw{position:static}}
@media(max-width:900px){.ev-wrap{grid-template-columns:1fr}.ev-link{flex-direction:column}}
`;
const st=document.createElement("style"); st.textContent=CSS; document.head.appendChild(st);
window.BOIT_EVENT={draw,warn};
})();
