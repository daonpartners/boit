/* 보잇 · 카드문자 · 데일리뉴스 → 여러 고객에게 이미지 문자(MMS)로 보내기 (2026-11-22)
   - 카드문자: '받는 고객'(EMO.list)마다 카드를 그려(고객 이름 들어감) JPG로 줄여 솔라피에 올리고 → 고객별 문구와 함께 MMS 발송
   - 데일리뉴스: 오늘 뉴스 카드 1장을 올려 고른 고객 모두에게 같은 내용으로 발송
   - 바로 보내기 / 예약(날짜·시각) · 오른쪽 휴대폰 미리보기(이미지 + 문구)
   - 솔라피 MMS 규격: JPG 200KB 이하 (가로·세로 최대 1500×1440) → 최대 1000px, 품질 낮춰 맞춤
   - 서버: sms 'upload_image'(storage:write 권한 필요 → 기존 연결은 다시 연결해야 함) + 'send'의 imageId */
(function(){
"use strict";
const $=s=>document.querySelector(s), esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const dg=s=>String(s||"").replace(/\D/g,"");
const okPh=c=>/^01\d{8,9}$/.test(dg(c&&c.phone));
const NEWS=new Set(); let PV={emo:"",news:""}, BUSY=false;

/* PNG/JPG blob → MMS용 JPG base64 (200KB 이하) */
async function toJpeg(blob){ const url=URL.createObjectURL(blob); try{
    const im=await new Promise((ok,no)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=no; i.src=url; });
    for(const max of [1000,860,720,600]){ const k=Math.min(1,max/Math.max(im.width,im.height)), c=document.createElement("canvas"); c.width=Math.round(im.width*k); c.height=Math.round(im.height*k);
      const g=c.getContext("2d"); g.fillStyle="#fff"; g.fillRect(0,0,c.width,c.height); g.drawImage(im,0,0,c.width,c.height);
      for(const q of [.85,.75,.65,.55,.45]){ const d=c.toDataURL("image/jpeg",q); if(d.length*0.75<195000) return {data:d.split(",")[1],url:d}; } }
    return null; } finally{ URL.revokeObjectURL(url); } }

/* 문자 글: 카드 내용은 이미지에 있으니 글에는 인사 + 내 개인페이지 링크만 */
function link(){ try{ return typeof hpUrl==="function"?hpUrl():""; }catch(_){ return ""; } }
function msgText(mode,c){ const me=(typeof ME!=="undefined"&&ME.name)||"담당 설계사", ph=(typeof ME!=="undefined"&&ME.phone)||"", u=link();
  const d=new Date(Date.now()+9*3600e3), md=`${d.getUTCMonth()+1}.${d.getUTCDate()}`;
  const head=mode==="emo"?`${c&&c.name?c.name+"님, ":""}카드 한 장 보내드립니다.`:`[데일리뉴스 ${md}] ${c&&c.name?c.name+"님, ":""}오늘의 경제·보험 소식입니다.`;
  return `${head}\n\n${me} 드림${ph?" "+ph:""}${u?`\n\n▶ 담당 설계사 페이지\n${u}`:""}`; }
function phone(img,text,who){ return `<div class="cs-ph"><div class="cs-in"><div class="cs-top"><span>9:41</span><span class="cs-notch"></span><span>LTE</span></div>
  <div class="cs-hd"><b>${esc(typeof ME!=="undefined"&&ME.sl&&ME.sl.sender||"내 휴대폰 번호")}</b><small>${esc(who||"고객")}님이 받는 화면</small></div>
  <div class="cs-body">${img?`<img src="${img}" alt="카드 미리보기">`:'<div class="cs-noimg">카드를 그리는 중…</div>'}<div class="cs-bub">${esc(text||"")}</div></div></div></div>`; }

function cur(mode){ if(mode==="emo"){ const L=window.EMO&&EMO.list||[]; return (L[EMO.cur]||L[0]||{}).c||null; } const L=(typeof CUSTOMERS!=="undefined"?CUSTOMERS:[]).filter(c=>NEWS.has(c.id)); return L[0]||null; }
function box(mode){ const isE=mode==="emo", L=isE?(window.EMO&&EMO.list||[]):(typeof CUSTOMERS!=="undefined"?CUSTOMERS:[]).filter(c=>NEWS.has(c.id)).map(c=>({c}));
  const ready=typeof pbReady==="function"&&pbReady(), c=cur(mode);
  return `<div class="cs-box"><div class="cs-r" id="cs-r-${mode}">${phone(PV[mode],msgText(mode,c),c&&c.name)}</div><div class="cs-l">
    <b style="font-size:16px">고객에게 이미지 문자로 보내기</b>
    <p class="note" style="margin:4px 0 10px">왼쪽 휴대폰이 고객이 받는 화면입니다. 오른쪽에서 카드를 고치면 바로 바뀝니다.${isE?" 고객마다 이름이 들어간 카드가 따로 만들어집니다.":" 고른 고객 모두에게 같은 뉴스 카드가 갑니다."} · 솔라피 이미지 문자(MMS) 요금</p>
    ${isE?'<div class="cs-slot" data-slot="#emo-pcs"></div><div class="cs-slot" data-slot="#emo-bgs"></div>':""}
    <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn" type="button" data-cspick="${mode}">받는 고객 고르기 (${L.length}명)</button></div>
    <div class="cs-pick" id="cs-pick-${mode}" hidden></div>
    ${link()?"":'<p class="note" style="margin:8px 0 0">개인페이지를 공개하면 문자 끝에 내 개인페이지 링크가 붙습니다 (메뉴 › 개인페이지).</p>'}
    <div class="row" style="gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap"><label class="row note" style="gap:4px"><input type="radio" name="cs-when-${mode}" value="now" checked> 바로</label><label class="row note" style="gap:4px"><input type="radio" name="cs-when-${mode}" value="at"> 예약</label><input type="datetime-local" id="cs-at-${mode}" style="max-width:220px"></div>
    <button class="btn primary" type="button" data-cssend="${mode}" style="margin-top:10px;width:100%" ${L.length?"":"disabled"}>${L.length?`${L.length}명에게 보내기`:"받는 고객을 먼저 고르세요"}</button>
    <p class="note" id="cs-out-${mode}" style="margin:6px 0 0">${ready?"":"자동문자발송(문자충전) 탭에서 솔라피를 연결하고 발신번호를 정하면 보낼 수 있습니다."}</p>
    ${isE?'<div class="cs-slot" data-slot="#emo-out"></div>':""}
    </div></div>`; }
/* 큰 카드 미리보기는 화면 밖에 숨겨 두고(이미지 만들 때만 씀) 휴대폰 미리보기를 왼쪽 위에 크게 */
function mount(){ [["emo","#emo-wrap"],["news","#mn-news"]].forEach(([m,sel])=>{ const a=$(sel); if(!a) return;
  let left=a.querySelector(":scope>.mn-left"); if(!left){ const st=a.firstElementChild; left=document.createElement("div"); left.className="mn-left"; a.insertBefore(left,st); left.appendChild(st); }
  left.firstElementChild&&left.firstElementChild.id!=="cs-"+m&&left.firstElementChild.classList.add("cs-stage-"+m);
  let h=$("#cs-"+m); if(!h){ h=document.createElement("div"); h.id="cs-"+m; h.className="panel"; left.insertBefore(h,left.firstElementChild); }
  draw(m); }); }
/* 사진 카드 고르기 칸을 휴대폰 옆 첫 화면으로 옮김 (원래 오른쪽 맨 아래) */
/* 사진 카드·글 카드 배경·다른 방법(카톡·복사)을 왼쪽 상자로 모아 좌우 균형 맞춤 */
function draw(m){ const h=$("#cs-"+m); if(!h) return; const keep={};
  if(m==="emo") ["#emo-pcs","#emo-bgs","#emo-out"].forEach(k=>{ const el=$(k), pan=el&&el.closest(".panel"); if(pan){ pan.remove(); keep[k]=pan; } });
  h.innerHTML=box(m); h.querySelectorAll(".cs-slot").forEach(sl=>{ const pan=keep[sl.dataset.slot]; if(pan){ pan.classList.add("cs-pcs"); sl.appendChild(pan); } }); }
function pickList(mode){ const isE=mode==="emo", Q=(($("#cs-q-"+mode)||{}).value||"").trim(), sel=isE?new Set((EMO.list||[]).map(r=>r.c.id)):NEWS;
  const list=(typeof CUSTOMERS!=="undefined"?CUSTOMERS:[]).filter(c=>!Q||c.name.includes(Q)||dg(c.phone).includes(dg(Q))).slice(0,300);
  return `<div class="row" style="gap:6px;margin-top:8px"><input id="cs-q-${mode}" placeholder="이름·전화번호 검색" value="${esc(Q)}" style="flex:1;min-width:0" autocomplete="off"><button class="btn sm" type="button" data-csall="${mode}">보이는 고객 모두</button><button class="btn sm" type="button" data-csnone="${mode}">모두 빼기</button></div>
    <div class="cs-list">${list.map(c=>`<label class="${okPh(c)?"":"off"}"><input type="checkbox" data-cscust="${mode}" value="${c.id}" ${sel.has(c.id)?"checked":""} ${okPh(c)?"":"disabled"}> ${esc(c.name)} <span class="note">${esc(c.type||"관리")}${okPh(c)?"":" · 번호 없음"}${c.mkt?"":" · 광고 수신 미동의"}</span></label>`).join("")||'<p class="note">고객이 없습니다.</p>'}</div>
    <p class="note" style="margin:4px 0 0">카드·뉴스 문자에 상품 권유가 들어가면 광고성 문자입니다: 수신 동의 고객만 · 맨 앞 (광고) · 수신거부 방법 (정보통신망법 제50조)</p>`; }
function setCust(mode,id,on){ if(mode==="emo"){ const c=CUSTOMERS.find(x=>x.id===id); if(!c) return; EMO.list=EMO.list.filter(r=>r.c.id!==id); if(on) EMO.list.push({c}); if(EMO.cur>=EMO.list.length) EMO.cur=Math.max(0,EMO.list.length-1); }
  else { on?NEWS.add(id):NEWS.delete(id); } }
function refresh(mode,keepPick){ const open=!($("#cs-pick-"+mode)||{hidden:true}).hidden, q=($("#cs-q-"+mode)||{}).value; if(mode==="emo"&&typeof renderEmo==="function") renderEmo(); mount(); autoPv(mode,200);
  if(keepPick&&open){ const p=$("#cs-pick-"+mode); p.hidden=false; p.innerHTML=pickList(mode); const qi=$("#cs-q-"+mode); if(qi&&q!=null){ qi.value=q; } } }
function updPhone(mode){ const r=$("#cs-r-"+mode); if(!r) return; const c=cur(mode); r.innerHTML=phone(PV[mode],msgText(mode,c),c&&c.name); }
let PVT={}, PVN=0;
async function preview(mode){ if(BUSY) return; const n=++PVN; try{ await wait(60); const b=mode==="emo"?await emoBlob():await mnBlob(); if(n!==PVN||!b) return; const j=await toJpeg(b); if(n!==PVN) return; PV[mode]=j?j.url:""; updPhone(mode); }catch(e){} }
function autoPv(mode,ms){ clearTimeout(PVT[mode]); PVT[mode]=setTimeout(()=>{ const w=$(mode==="emo"?"#emo-wrap":"#mn-news"); if(w&&!w.hidden) preview(mode); },ms==null?500:ms); }
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function send(mode){ if(BUSY) return; const o=$("#cs-out-"+mode), say=t=>{ const x=$("#cs-out-"+mode); if(x) x.textContent=t; };
  if(!(typeof pbReady==="function"&&pbReady())){ say("솔라피 연결과 발신번호가 필요합니다 (자동문자발송 탭)."); return; }
  const when=(document.querySelector(`[name="cs-when-${mode}"]:checked`)||{}).value, atv=($("#cs-at-"+mode)||{}).value;
  let at=null; if(when==="at"){ if(!atv){ say("예약 날짜·시각을 넣으세요."); return; } at=new Date(atv); if(+at<Date.now()+60e3){ say("예약은 지금보다 뒤 시각이어야 합니다."); return; } }
  const isE=mode==="emo", L=(isE?EMO.list:CUSTOMERS.filter(c=>NEWS.has(c.id)).map(c=>({c}))).filter(r=>okPh(r.c));
  if(!L.length){ say("보낼 고객이 없습니다."); return; }
  if(!confirm(`${L.length}명에게 이미지 문자를 ${at?`${atv.replace("T"," ")}에 예약`:"지금"} 보낼까요? 요금은 솔라피 잔액에서 빠집니다.`)) return;
  BUSY=true; const msgs=[], fail=[];
  try{
    if(isE){ const cur0=EMO.cur;
      for(let i=0;i<L.length;i++){ say(`카드 만드는 중… ${i+1}/${L.length}`); EMO.cur=EMO.list.indexOf(L[i]); renderEmo(); await wait(450);
        const b=await emoBlob(), j=b&&await toJpeg(b); if(!j){ fail.push(L[i].c.name); continue; }
        const up=await slCall("upload_image",{data:j.data}); if(up.error){ say(up.message||"이미지를 올리지 못했습니다."); BUSY=false; EMO.cur=cur0; renderEmo(); mount(); return; }
        msgs.push({to:dg(L[i].c.phone),text:msgText("emo",L[i].c),imageId:up.imageId,subject:"카드"}); }
      EMO.cur=cur0; renderEmo(); }
    else { say("뉴스 카드 올리는 중…"); const b=await mnBlob(), j=b&&await toJpeg(b); if(!j){ say("뉴스 카드를 그리지 못했습니다."); BUSY=false; return; }
      const up=await slCall("upload_image",{data:j.data}); if(up.error){ say(up.message||"이미지를 올리지 못했습니다."); BUSY=false; return; }
      L.forEach(r=>msgs.push({to:dg(r.c.phone),text:msgText("news",r.c),imageId:up.imageId,subject:"데일리뉴스"})); }
    say("솔라피에 보내는 중…");
    const r=await slCall("send",{messages:msgs,at:at?at.toISOString():null});
    if(r.error){ say(r.message||"보내지 못했습니다."); return; }
    const t=`${at?"예약":"접수"} ${r.accepted||0}건${(r.failed||[]).length?` · 실패 ${(r.failed||[]).length}건`:""}${fail.length?` · 카드 못 만든 고객 ${fail.length}명`:""}`;
    if(typeof pbLog==="function") pbLog(`${isE?"카드문자":"데일리뉴스"} ${at?"예약":"발송"}`,0,{n:msgs.length,ok:r.accepted||0,fail:(r.failed||[]).length});
    if(typeof ACTS!=="undefined") L.forEach(x=>ACTS.push({cust:x.c.id,date:new Date(Date.now()+9*3600e3).toISOString().slice(0,10),type:"문자",memo:`${isE?"카드문자":"데일리뉴스"} ${at?"예약":"발송"}`}));
    if(typeof cloudSave==="function") try{ cloudSave(true); }catch(_){}
    mount(); say(t);
  }catch(e){ say("보내는 중 문제가 생겼습니다. 다시 시도하세요."); } finally{ BUSY=false; } }

document.addEventListener("click",e=>{ const t=e.target.closest("[data-cspick],[data-cspv],[data-cssend],[data-csall],[data-csnone]"); if(!t) return;
  if(t.dataset.cspick){ const m=t.dataset.cspick, p=$("#cs-pick-"+m); p.hidden=!p.hidden; if(!p.hidden) p.innerHTML=pickList(m); return; }
  if(t.dataset.cssend){ send(t.dataset.cssend); return; }
  const m=t.dataset.csall||t.dataset.csnone; const on=!!t.dataset.csall;
  document.querySelectorAll(`#cs-pick-${m} [data-cscust]:not(:disabled)`).forEach(x=>setCust(m,+x.value,on)); refresh(m,true); });
document.addEventListener("change",e=>{ const x=e.target.closest("[data-cscust]"); if(!x) return; setCust(x.dataset.cscust,+x.value,x.checked); refresh(x.dataset.cscust,true); });
document.addEventListener("input",e=>{ const x=e.target; if(!/^cs-q-/.test(x.id||"")) return; const m=x.id.slice(5), p=x.selectionStart, v=x.value; const pk=$("#cs-pick-"+m); pk.innerHTML=pickList(m); const n=$("#cs-q-"+m); n.value=v; n.focus(); try{ n.setSelectionRange(p,p); }catch(_){} });
/* 카드·뉴스 화면이 다시 그려질 때 붙임 */
new MutationObserver(()=>{ if((document.querySelector("#emo-wrap")&&!$("#cs-emo"))||(document.querySelector("#mn-news")&&!$("#cs-news"))){ mount(); autoPv("emo",300); autoPv("news",300); } }).observe(document.body,{childList:true,subtree:true});
/* 오른쪽에서 카드를 고치면 휴대폰 미리보기 자동 갱신 */
document.addEventListener("input",e=>{ if(BUSY||/^cs-/.test(e.target.id||"")) return; if(e.target.closest("#emo-wrap")) autoPv("emo"); if(e.target.closest("#mn-news")) autoPv("news"); });
document.addEventListener("change",e=>{ if(BUSY||e.target.closest("[data-cscust]")||(e.target.closest(".cs-box")&&!e.target.closest(".cs-pcs"))) return; if(e.target.closest("#emo-wrap")) autoPv("emo"); if(e.target.closest("#mn-news")) autoPv("news"); });
document.addEventListener("click",e=>{ if(BUSY||(e.target.closest(".cs-box")&&!e.target.closest(".cs-pcs"))) return; if(e.target.closest("[data-cdcur],[data-cddel],#cd-add,[data-ts]")) setTimeout(()=>{ ["emo","news"].forEach(draw); },80);
  if(e.target.closest("#emo-wrap button,#emo-wrap [data-pc],#emo-wrap [data-emobg],[data-ts=emo]")) autoPv("emo",350); if(e.target.closest("#mn-news button,[data-ts=news]")) autoPv("news",350); },true); /* capture: 보잇이 버튼을 다시 그리기 전에 판단 */
/* 화면이 처음 열렸는데 미리보기가 비어 있으면 그림 */
setInterval(()=>{ [["emo","#emo-wrap"],["news","#mn-news"]].forEach(([m,sel])=>{ const w=$(sel); if(w&&!w.hidden&&w.offsetParent&&!PV[m]&&!PVT[m+"x"]){ PVT[m+"x"]=1; preview(m).finally(()=>{ PVT[m+"x"]=0; }); } }); },1200);
/* 휴대폰 미리보기의 카드에서 글을 끌어 옮기기 (글 카드만) */
let DR=null;
document.addEventListener("pointerdown",e=>{ const img=e.target.closest("#cs-r-emo .cs-body img"); if(!img||BUSY||!window.EMO||EMO.photo) return;
  const node=document.getElementById("emo-node"), mid=node&&node.querySelector(".e-mid"); if(!mid) return;
  const nb=node.getBoundingClientRect(), k0=nb.width/540; let L=1e9,T=1e9,R=-1e9,B=-1e9;
  [...mid.children].forEach(c=>{ const r=c.getBoundingClientRect(); if(!r.width) return; L=Math.min(L,r.left);T=Math.min(T,r.top);R=Math.max(R,r.right);B=Math.max(B,r.bottom); });
  const ib=img.getBoundingClientRect(), k=ib.width/540; /* 카드 1px → 화면 px */
  const box={l:(L-nb.left)/k0*k,t:(T-nb.top)/k0*k,w:(R-L)/k0*k,h:(B-T)/k0*k};
  const g=document.createElement("div"); g.className="cs-ghost"; const host=img.parentElement; host.style.position="relative";
  const ox=ib.left-host.getBoundingClientRect().left+host.scrollLeft, oy=ib.top-host.getBoundingClientRect().top+host.scrollTop;
  Object.assign(g.style,{left:ox+box.l+"px",top:oy+box.t+"px",width:box.w+"px",height:box.h+"px"}); host.appendChild(g);
  DR={x:e.clientX,y:e.clientY,k,g,box,ox,oy,h:ib.height}; img.setPointerCapture&&img.setPointerCapture(e.pointerId); e.preventDefault(); });
document.addEventListener("pointermove",e=>{ if(!DR) return; const dx=e.clientX-DR.x, dy=e.clientY-DR.y; DR.g.style.transform=`translate(${dx}px,${dy}px)`; });
document.addEventListener("pointerup",e=>{ if(!DR) return; const d=DR; DR=null; d.g.remove(); const dx=(e.clientX-d.x)/d.k, dy=(e.clientY-d.y)/d.k; if(Math.abs(dx)+Math.abs(dy)<3) return;
  EMO.tx=Math.round(Math.max(-300,Math.min(300,(EMO.tx||0)+dx))); EMO.ty=Math.round(Math.max(-420,Math.min(420,(EMO.ty||0)+dy))); renderEmo(); autoPv("emo",50); });
const css=document.createElement("style"); css.textContent=`
.mn-left{display:flex;flex-direction:column;gap:14px;min-width:0;position:relative}.mn-wrap{max-width:1480px}
.cs-stage-emo{position:absolute!important;left:-20000px;top:0;width:600px}.cs-stage-news{position:absolute!important;left:-20000px;top:0;width:780px}
.cs-box{display:grid;grid-template-columns:360px minmax(0,1fr);gap:22px;align-items:start}@media(max-width:860px){.cs-box{grid-template-columns:1fr}}
.cs-pcs{padding:0!important;border:0!important;box-shadow:none!important;background:none!important;margin:0 0 12px}.cs-pcs h2{font-size:14px;margin:0}
.cs-pcs .emo-bgs{grid-template-columns:repeat(auto-fill,minmax(72px,1fr))!important}.cs-pcs .emo-bgs button{height:40px!important;font-size:12px}
.cs-slot[data-slot="#emo-out"] .cs-pcs{margin:16px 0 0;padding-top:14px!important;border-top:1px solid var(--line)!important;border-radius:0!important}
.cs-pcs .pc-grid>.note{grid-column:1/-1}.cs-pcs .pc-grid{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px}.cs-pcs .pc-grid button{padding:0;border-radius:10px;overflow:hidden}.cs-pcs .pc-grid img{width:100%;display:block}
#cs-r-emo .cs-body img{cursor:grab;touch-action:none}.cs-ghost{position:absolute;border:2px dashed #12a37a;background:rgba(18,163,122,.12);border-radius:6px;pointer-events:none;z-index:3}
.cs-list{max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:6px 10px;margin-top:6px;display:flex;flex-direction:column;gap:4px}.cs-list label{display:flex;gap:6px;align-items:center;font-size:13.5px}.cs-list label.off{opacity:.5}
.cs-ph{width:340px;max-width:100%;margin:0 auto;border-radius:44px;background:#1c1f24;padding:11px}.cs-in{border-radius:34px;background:#fff;overflow:hidden;height:680px;display:flex;flex-direction:column}
.cs-top{display:flex;justify-content:space-between;align-items:center;padding:9px 22px 3px;font-size:12px;font-weight:700;color:#111}.cs-notch{width:84px;height:22px;border-radius:12px;background:#1c1f24}
.cs-hd{padding:6px 14px 8px;border-bottom:1px solid #eee;text-align:center}.cs-hd b{display:block;font-size:14px;color:#111}.cs-hd small{font-size:11.5px;color:#888}
.cs-body{padding:12px;display:flex;flex-direction:column;gap:8px;flex:1;overflow:auto;background:#fff}.cs-body img{width:88%;border-radius:14px;align-self:flex-start;box-shadow:0 1px 3px rgba(0,0,0,.08)}.cs-noimg{width:88%;height:260px;border-radius:14px;background:#f0f1f3;color:#999;font-size:13px;display:flex;align-items:center;justify-content:center;text-align:center;padding:6px}
.cs-bub{align-self:flex-start;max-width:88%;background:#E9E9EB;color:#111;border-radius:18px 18px 18px 5px;padding:9px 12px;font-size:13.5px;line-height:1.55;white-space:pre-wrap;word-break:break-all}`;
document.head.appendChild(css);
})();
