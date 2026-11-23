/* 보잇 · 고객 청구 링크 (2026-11-23 대표 지시)
   ① [고객 청구 링크 보내기] → 서버(claim-link)에서 고객별 7일 링크를 만들어 문자로 보냄 (boit.ai.kr/c.html?t=…)
   ② 고객이 이름·주민번호·휴대폰·주소·서류 사진·서명을 보내면 → 보상청구 화면 위 '고객이 보낸 청구 접수' 목록에 뜸 (로그인 때 알림)
   ③ [불러와 청구하기] → 고객·주민번호·주소·서류·서명이 청구 화면에 채워짐 → 설계사가 보험사 고르고 확인·발송
   ④ 팩스 접수가 되면 서버의 고객 자료(암호문·사진·서명)를 바로 지움. 안 보내도 접수 7일 뒤 자동 삭제 */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const live=()=>typeof faxLive==="function"&&faxLive();
let ROWS=[], LOADED=0, BUSY=false, LINK=null;
function logAct(){ if(!LINK||LINK.logged) return; const c=CUSTOMERS.find(x=>x.name===LINK.n&&digits(x.phone)===digits(LINK.ph)); if(c) ACTS.push({cust:c.id,date:today(),type:"문자",memo:"보험금 청구 링크 발송"}); LINK.logged=true; }

async function api(body){ const {data:{session}}=await CLOUD.sb.auth.getSession();
  try{ const r=await fetch(BOIT_CLOUD.url+"/functions/v1/claim-link",{method:"POST",headers:{"Content-Type":"application/json",apikey:BOIT_CLOUD.key,Authorization:"Bearer "+((session&&session.access_token)||"")},body:JSON.stringify(body)});
    return await r.json(); }catch(e){ return {error:"net",message:"서버에 연결하지 못했습니다."}; } }
const smsText=(n,url)=>`[보험금 청구 접수]\n${n}님, ${ME.name||"담당"} 설계사입니다.\n아래 링크에서 정보·서류 사진·서명을 보내 주시면 확인 후 보험사에 접수해 드립니다.\n${url}\n(7일간 유효)`;

/* ① 링크 보내기 */
window.openLink=function(){ LINK=null;
  infoDlg("고객 청구 링크 보내기",`<p class="note" style="margin:0">고객이 휴대폰으로 이름·주민번호·휴대폰·주소·서류 사진·서명을 보내면, 이 화면 위 <b>고객이 보낸 청구 접수</b>에 뜹니다.</p>
  <div class="fgrid"><div class="field"><label for="ck-name">고객 이름</label><input id="ck-name" autocomplete="off" list="dl-cust"></div><div class="field"><label for="ck-phone">휴대폰번호</label><input id="ck-phone" inputmode="tel" maxlength="13" autocomplete="off" placeholder="010-0000-0000"></div></div>
  <div class="smsprev"><span class="note">문자 미리보기</span><div id="ck-prev" style="white-space:pre-wrap"></div></div>
  <div class="row" id="ck-acts"><button class="btn primary" type="button" id="ck-send">링크 만들기</button><a class="btn" id="ck-demo" href="c.html?demo=1" target="_blank" rel="noopener" style="text-decoration:none;color:var(--fg)">고객 화면 미리보기</a></div><p class="note" id="ck-msg" style="margin:6px 0 0"></p>`);
  upd(); const d=$("#ck-demo"); if(d) d.href=`c.html?demo=1&p=${encodeURIComponent(ME.name||"")}&pp=${encodeURIComponent(ME.phone||"")}`; };
function upd(){ const p=$("#ck-prev"); if(p) p.textContent=smsText(($("#ck-name")||{}).value||"고객","https://boit.ai.kr/c.html?t=(보낼 때 만들어짐)"); }
document.addEventListener("input",e=>{ if(e.target.id==="ck-name") upd(); if(e.target.id==="ck-phone"){ e.target.value=fmtPhone(e.target.value); } });
document.addEventListener("click",async e=>{
  if(e.target.closest("#ck-send")){ const m=$("#ck-msg"), n=$("#ck-name").value.trim(), ph=$("#ck-phone").value;
    if(!n||!phoneOk(ph)){ m.textContent="이름과 휴대폰번호를 확인하세요."; return; }
    if(!live()){ m.textContent="체험 화면에서는 링크를 만들지 않습니다. '고객 화면 미리보기'로 고객 화면을 확인하세요."; return; }
    m.textContent="링크 만드는 중…"; const j=await api({action:"create",name:n,planner:ME.name||"",plannerPhone:ME.phone||""});
    if(!j.ok){ m.textContent=j.message||"링크를 만들지 못했습니다."; return; }
    LINK={n,ph,t:smsText(n,j.url)}; $("#ck-prev").textContent=LINK.t; $("#ck-name").disabled=$("#ck-phone").disabled=true;
    $("#ck-acts").innerHTML=`<button class="btn primary" type="button" id="ck-boit">보잇에서 문자 보내기</button><button class="btn" type="button" id="ck-copy">문구 복사</button><button class="btn" type="button" id="ck-app">내 휴대폰 문자로 보내기</button>`;
    m.textContent="링크 만들기 완료 (7일 유효) · 아래에서 보낼 방법 선택"; setTimeout(load,800); return; }
  if(e.target.closest("#ck-boit")&&LINK){ const m=$("#ck-msg");
    if(!smsGate({cost:SMS_PRICE.lms,memo:`청구 링크 문자 (${LINK.n})`,el:m,text:LINK.t,phone:LINK.ph})) return;
    logAct(); m.textContent=sentNote(SMS_PRICE.lms); return; }
  if(e.target.closest("#ck-copy")&&LINK){ copyText(LINK.t,$("#ck-msg")); logAct(); return; }
  if(e.target.closest("#ck-app")&&LINK){ const m=$("#ck-msg"); if(typeof isMobile==="function"&&!isMobile()){ try{ await navigator.clipboard.writeText(LINK.t); flash(m,"PC에서는 문자앱을 열 수 없어 문구를 복사했습니다. 휴대폰 카카오톡·문자에 붙여넣으세요."); }catch(_){ flash(m,"PC에서는 문자앱을 열 수 없습니다. 미리보기 글을 길게 눌러 직접 복사하세요."); } logAct(); return; } openSmsApp(LINK.ph,LINK.t,m); logAct(); return; }
  const op=e.target.closest("[data-creq-open]"); if(op){ openReq(op.dataset.creqOpen); return; }
  const dl=e.target.closest("[data-creq-del]"); if(dl){ if(!window.confirm("이 접수를 지울까요? 고객이 보낸 정보·사진·서명이 모두 삭제됩니다.")) return; await api({action:"del",t:dl.dataset.creqDel}); load(); return; }
});

/* ② 목록 */
async function load(quiet){ if(!live()||BUSY) return; BUSY=true;
  try{ const j=await api({action:"list"}); if(j.ok){ const before=new Set(ROWS.filter(r=>r.status!=="sent").map(r=>r.t)); ROWS=j.rows||[]; LOADED=Date.now();
      const fresh=ROWS.filter(r=>r.status==="submitted"&&!before.has(r.t));
      if(fresh.length&&window.notify&&!quiet) notify(`고객이 보낸 보험금 청구 접수 ${fresh.length}건이 있습니다. 보상청구 화면 맨 위에서 확인하세요.`,"info"); } }
  finally{ BUSY=false; window.BOIT_CREQ=ROWS; draw(); } }
function draw(){ const head=$("#cl-link"); if(!head) return; const at=head.closest(".row.between")||head.closest(".row"); if(!at) return;
  let box=$("#creq-box"); if(!box){ box=document.createElement("div"); box.id="creq-box"; at.insertAdjacentElement("afterend",box); }
  const got=ROWS.filter(r=>r.status==="submitted"||r.status==="opened"), wait=ROWS.filter(r=>r.status==="sent"||r.status==="upload");
  if(!got.length&&!wait.length){ box.innerHTML=""; return; }
  const t=s=>{ if(!s) return ""; const d=new Date(s); return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
  box.innerHTML=`<div class="creq"><div class="creq-h"><b>고객이 보낸 청구 접수 <span>${got.length}</span>건</b>${wait.length?`<span class="note">답변 기다리는 링크 ${wait.length}개 (${wait.map(r=>esc(r.hint)).join(", ")})</span>`:""}</div>
    ${got.map(r=>`<div class="creq-r${r.status==="opened"?" seen":""}"><div><b>${esc(r.name||r.hint)}</b> <span class="note">${esc(r.phone?fmtPhone(r.phone):"")} · 사진 ${r.n}장 · ${t(r.submitted)} 접수${r.status==="opened"?" · 불러옴":""}</span></div>
      <div class="creq-a"><button class="btn sm primary" type="button" data-creq-open="${r.t}">불러와 청구하기</button><button class="lnk" type="button" data-creq-del="${r.t}">삭제</button></div></div>`).join("")}
    <p class="note" style="margin:6px 0 0">접수 후 7일 안에 청구하지 않으면 자동 삭제 · 청구하면 보낸 서류는 3개월 보관 후 파기</p></div>`; }

/* ③ 불러오기 → 청구 화면 채우기 */
async function openReq(t){ if(window.notify) notify("고객 자료 불러오는 중…","wait");
  const j=await api({action:"open",t}); if(!j.ok){ if(window.notify) notify(j.message||"불러오지 못했습니다.","warn"); return; }
  const D=j.data||{};
  resetClaim(); S.creq=t; S.insMode=""; S.cl.name=D.name||""; S.cl.rrn=fmtRrn(D.rrn||""); S.cl.phone=fmtPhone(D.phone||""); S.cl.addr=D.addr||"";
  const c=CUSTOMERS.find(x=>x.name===S.cl.name&&digits(x.phone)===digits(S.cl.phone)); if(c){ S.cl.custId=c.id; S.cl.save=false; }
  if(D.memo) S.acc.memo=D.memo;
  const files=[]; let sign=null;
  for(const f of j.files||[]){ try{ const b=await (await fetch(f.url)).blob(); if(f.sign){ sign=b; continue; }
      const ext=b.type==="application/pdf"?"pdf":b.type==="image/png"?"png":"jpg"; files.push(new File([b],`고객서류_${String(files.length+1).padStart(2,"0")}.${ext}`,{type:b.type||"image/jpeg"})); }catch(e){} }
  if(sign){ try{ const u=URL.createObjectURL(sign), im=await new Promise((r,x)=>{ const i=new Image(); i.onload=()=>r(i); i.onerror=x; i.src=u; });
      const cv=document.createElement("canvas"); cv.width=560; cv.height=160; cv.getContext("2d").drawImage(im,0,0,560,160); URL.revokeObjectURL(u);
      S.sign.mode="face"; S.sign.sig={ins:cv.toDataURL("image/png")}; }catch(e){} }
  go("claim"); renderStep(); if(files.length) await addAllFiles(files);
  window.scrollTo(0,0);
  if(window.notify) notify(`${S.cl.name}님 자료를 불러왔습니다 (서류 ${files.length}장${sign?" · 서명":""}). 보험사를 고르고 확인 후 발송하세요.`,"ok");
  load(true); }

/* ④ 팩스 접수가 되면 서버 자료 삭제 */
const origDone=window.sendDone;
if(typeof origDone==="function") window.sendDone=function(R){ const r=origDone.apply(this,arguments);
  try{ const t=S.creq; R=R||{}; if(t&&live()&&S.ins.some(id=>!R[id]||R[id].res!=="bad")){ S.creq=null; api({action:"done",t}).then(load); } }catch(e){}
  return r; };

/* 로그인·화면 이동 때 목록 확인 (2분 간격) */
setInterval(()=>{ if(live()&&Date.now()-LOADED>120000) load(); },15000);
document.addEventListener("click",e=>{ if(e.target.closest('[data-go="claim"]')) setTimeout(()=>{ draw(); if(live()&&Date.now()-LOADED>20000) load(); },50); });

const css=document.createElement("style");
css.textContent=`.creq{margin:12px 0 4px;padding:12px 14px;border:2px solid var(--accent,#0E9A72);border-radius:14px;background:#F2FBF7}
.creq-h{display:flex;gap:8px;flex-wrap:wrap;align-items:baseline}.creq-h b span{color:var(--accent,#0E9A72);font-size:18px}
.creq-r{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:9px 0;border-top:1px solid #D6EAE1;margin-top:8px}
.creq-r.seen{opacity:.75}.creq-a{display:flex;gap:10px;align-items:center}.creq-a .btn{white-space:nowrap}`;
document.head.appendChild(css);
})();
