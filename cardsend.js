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

function phone(img,text,who){ return `<div class="cs-ph"><div class="cs-in"><div class="cs-top"><span>9:41</span><span class="cs-notch"></span><span>LTE</span></div>
  <div class="cs-hd"><b>${esc(typeof ME!=="undefined"&&ME.sl&&ME.sl.sender||"내 휴대폰 번호")}</b><small>${esc(who||"고객")}님이 받는 화면</small></div>
  <div class="cs-body">${img?`<img src="${img}" alt="카드 미리보기">`:'<div class="cs-noimg">미리보기를 누르면 카드가 보입니다</div>'}<div class="cs-bub">${esc(text||"")}</div></div></div></div>`; }

function box(mode){ const isE=mode==="emo", L=isE?(window.EMO&&EMO.list||[]):(typeof CUSTOMERS!=="undefined"?CUSTOMERS:[]).filter(c=>NEWS.has(c.id)).map(c=>({c}));
  const ready=typeof pbReady==="function"&&pbReady();
  return `<div class="cs-box"><div class="cs-l">
    <b style="font-size:15px">여러 고객에게 이미지 문자로 보내기</b>
    <p class="note" style="margin:4px 0 8px">${isE?"위 '받는 고객'에 넣은 고객마다 이름이 들어간 카드를 따로 만들어 보냅니다.":"오늘 뉴스 카드를 고른 고객에게 같은 내용으로 보냅니다."} · 솔라피 이미지 문자(MMS) 요금</p>
    <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn" type="button" data-cspick="${mode}">고객 여러 명 고르기 (${L.length}명)</button><button class="btn" type="button" data-cspv="${mode}">미리보기</button></div>
    <div class="cs-pick" id="cs-pick-${mode}" hidden></div>
    <div class="row" style="gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap"><label class="row note" style="gap:4px"><input type="radio" name="cs-when-${mode}" value="now" checked> 바로</label><label class="row note" style="gap:4px"><input type="radio" name="cs-when-${mode}" value="at"> 예약</label><input type="datetime-local" id="cs-at-${mode}" style="max-width:220px"></div>
    <button class="btn primary" type="button" data-cssend="${mode}" style="margin-top:10px;width:100%" ${L.length?"":"disabled"}>${L.length?`${L.length}명에게 보내기`:"받는 고객을 먼저 고르세요"}</button>
    <p class="note" id="cs-out-${mode}" style="margin:6px 0 0">${ready?"":"자동문자발송(문자충전) 탭에서 솔라피를 연결하고 발신번호를 정하면 보낼 수 있습니다."}</p>
    </div><div class="cs-r">${phone(PV[mode],isE?(typeof emoText==="function"?emoText():""):(typeof mnText==="function"?mnText():""),L[0]&&L[0].c.name)}</div></div>`; }
/* 카드·뉴스 화면 아래에 넓은 상자로 붙임 (보이는 탭에 맞춰 숨김) */
function mount(){ [["emo","#emo-wrap"],["news","#mn-news"]].forEach(([m,sel])=>{ const a=$(sel); if(!a) return; let h=$("#cs-"+m); if(!h){ h=document.createElement("div"); h.id="cs-"+m; h.className="panel"; h.style.marginTop="14px"; a.insertAdjacentElement("afterend",h); } h.hidden=a.hidden; h.innerHTML=box(m); }); }
function pickList(mode){ const isE=mode==="emo", Q=(($("#cs-q-"+mode)||{}).value||"").trim(), sel=isE?new Set((EMO.list||[]).map(r=>r.c.id)):NEWS;
  const list=(typeof CUSTOMERS!=="undefined"?CUSTOMERS:[]).filter(c=>!Q||c.name.includes(Q)||dg(c.phone).includes(dg(Q))).slice(0,300);
  return `<div class="row" style="gap:6px;margin-top:8px"><input id="cs-q-${mode}" placeholder="이름·전화번호 검색" value="${esc(Q)}" style="flex:1;min-width:0" autocomplete="off"><button class="btn sm" type="button" data-csall="${mode}">보이는 고객 모두</button><button class="btn sm" type="button" data-csnone="${mode}">모두 빼기</button></div>
    <div class="cs-list">${list.map(c=>`<label class="${okPh(c)?"":"off"}"><input type="checkbox" data-cscust="${mode}" value="${c.id}" ${sel.has(c.id)?"checked":""} ${okPh(c)?"":"disabled"}> ${esc(c.name)} <span class="note">${esc(c.type||"관리")}${okPh(c)?"":" · 번호 없음"}${c.mkt?"":" · 광고 수신 미동의"}</span></label>`).join("")||'<p class="note">고객이 없습니다.</p>'}</div>
    <p class="note" style="margin:4px 0 0">카드·뉴스 문자에 상품 권유가 들어가면 광고성 문자입니다: 수신 동의 고객만 · 맨 앞 (광고) · 수신거부 방법 (정보통신망법 제50조)</p>`; }
function setCust(mode,id,on){ if(mode==="emo"){ const c=CUSTOMERS.find(x=>x.id===id); if(!c) return; EMO.list=EMO.list.filter(r=>r.c.id!==id); if(on) EMO.list.push({c}); if(EMO.cur>=EMO.list.length) EMO.cur=Math.max(0,EMO.list.length-1); }
  else { on?NEWS.add(id):NEWS.delete(id); } }
function refresh(mode,keepPick){ const open=!($("#cs-pick-"+mode)||{hidden:true}).hidden, q=($("#cs-q-"+mode)||{}).value; if(mode==="emo"&&typeof renderEmo==="function") renderEmo(); mount();
  if(keepPick&&open){ const p=$("#cs-pick-"+mode); p.hidden=false; p.innerHTML=pickList(mode); const qi=$("#cs-q-"+mode); if(qi&&q!=null){ qi.value=q; } } }
async function preview(mode){ const o=$("#cs-out-"+mode); try{ const b=mode==="emo"?await emoBlob():await mnBlob(); if(!b){ if(o) o.textContent="카드를 그리지 못했습니다."; return; } const j=await toJpeg(b); PV[mode]=j?j.url:""; refresh(mode); }catch(e){ if(o) o.textContent="미리보기를 만들지 못했습니다."; } }
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
        msgs.push({to:dg(L[i].c.phone),text:emoText(),imageId:up.imageId,subject:"카드"}); }
      EMO.cur=cur0; renderEmo(); }
    else { say("뉴스 카드 올리는 중…"); const b=await mnBlob(), j=b&&await toJpeg(b); if(!j){ say("뉴스 카드를 그리지 못했습니다."); BUSY=false; return; }
      const up=await slCall("upload_image",{data:j.data}); if(up.error){ say(up.message||"이미지를 올리지 못했습니다."); BUSY=false; return; }
      const t=mnText(); L.forEach(r=>msgs.push({to:dg(r.c.phone),text:t,imageId:up.imageId,subject:"데일리뉴스"})); }
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
  if(t.dataset.cspv){ preview(t.dataset.cspv); return; }
  if(t.dataset.cssend){ send(t.dataset.cssend); return; }
  const m=t.dataset.csall||t.dataset.csnone; const on=!!t.dataset.csall;
  document.querySelectorAll(`#cs-pick-${m} [data-cscust]:not(:disabled)`).forEach(x=>setCust(m,+x.value,on)); refresh(m,true); });
document.addEventListener("change",e=>{ const x=e.target.closest("[data-cscust]"); if(!x) return; setCust(x.dataset.cscust,+x.value,x.checked); refresh(x.dataset.cscust,true); });
document.addEventListener("input",e=>{ const x=e.target; if(!/^cs-q-/.test(x.id||"")) return; const m=x.id.slice(5), p=x.selectionStart, v=x.value; const pk=$("#cs-pick-"+m); pk.innerHTML=pickList(m); const n=$("#cs-q-"+m); n.value=v; n.focus(); try{ n.setSelectionRange(p,p); }catch(_){} });
/* 카드·뉴스 화면이 다시 그려질 때 붙임 */
new MutationObserver(()=>{ [["emo","#emo-wrap"],["news","#mn-news"]].forEach(([m,sel])=>{ const a=$(sel), h=$("#cs-"+m); if(a&&!h) mount(); else if(a&&h&&h.hidden!==a.hidden) h.hidden=a.hidden; }); }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["hidden"]});
document.addEventListener("click",e=>{ if(e.target.closest("[data-cdcur],[data-cddel],#cd-add,[data-ts],[data-pc],[data-emobg]")) setTimeout(()=>{ ["emo","news"].forEach(m=>{ if($("#cs-"+m)) $("#cs-"+m).innerHTML=box(m); }); },80); });
const css=document.createElement("style"); css.textContent=`
.cs-box{display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:12px;align-items:start}@media(max-width:700px){.cs-box{grid-template-columns:1fr}}
.cs-list{max-height:220px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:6px 10px;margin-top:6px;display:flex;flex-direction:column;gap:4px}.cs-list label{display:flex;gap:6px;align-items:center;font-size:13.5px}.cs-list label.off{opacity:.5}
.cs-ph{width:220px;margin:0 auto;border-radius:32px;background:#1c1f24;padding:8px}.cs-in{border-radius:25px;background:#fff;overflow:hidden;min-height:380px;display:flex;flex-direction:column}
.cs-top{display:flex;justify-content:space-between;align-items:center;padding:6px 14px 2px;font-size:10px;font-weight:700;color:#111}.cs-notch{width:56px;height:14px;border-radius:10px;background:#1c1f24}
.cs-hd{padding:4px 10px 6px;border-bottom:1px solid #eee}.cs-hd b{display:block;font-size:12px;color:#111}.cs-hd small{font-size:10px;color:#888}
.cs-body{padding:8px;display:flex;flex-direction:column;gap:6px;max-height:420px;overflow:auto}.cs-body img{width:86%;border-radius:12px;align-self:flex-start}.cs-noimg{width:86%;height:110px;border-radius:12px;background:#f0f1f3;color:#999;font-size:11px;display:flex;align-items:center;justify-content:center;text-align:center;padding:6px}
.cs-bub{align-self:flex-start;max-width:90%;background:#E9E9EB;color:#111;border-radius:14px 14px 14px 4px;padding:7px 9px;font-size:11px;line-height:1.5;white-space:pre-wrap;word-break:break-all}`;
document.head.appendChild(css);
})();
