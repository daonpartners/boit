/* 보잇 · 문자·카드 — 한 화면 순서: ① 받는 고객 → ② 무엇을 보낼까(단·장문/카드문자/데일리뉴스) → ③ 만들기 → ④ 보내기 (2026-11-22)
   - 받는 고객은 세 종류가 함께 씀 (MF_SEL)
   - 문자로 보내기: 솔라피(설계사 본인 계정) · 카드·뉴스는 이미지 문자(MMS): JPG 200KB 이하로 줄여 'upload_image' → 'send'의 imageId
   - 무료로 보내기: 카톡·이미지 저장·복사 (기존 버튼 그대로 옮겨 씀)
   - 자동 발송 규칙·솔라피 연결·한도·기록은 [⚙ 자동 발송·솔라피 설정] 화면 */
(function(){
"use strict";
const $=s=>document.querySelector(s), esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const dg=s=>String(s||"").replace(/\D/g,"");
const okPh=c=>/^01\d{8,9}$/.test(dg(c&&c.phone));
const SEL=new Set(); window.MF_SEL=SEL;
let PV={emo:"",news:""}, BUSY=false, PI=0, MFQ="", MFOPEN=false;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const custs=()=>typeof CUSTOMERS!=="undefined"?CUSTOMERS:[];
const selList=()=>[...SEL].map(id=>custs().find(c=>c.id===id)).filter(Boolean);
const prevC=()=>{ const L=selList(); if(!L.length) return null; if(PI>=L.length) PI=0; return L[PI]; };
const curMode=()=>{ const sv=document.querySelector('section[data-view="sms"]'); if(sv&&!sv.hidden) return "sms"; return window.MNMODE||"emo"; };
const inSet=()=>{ const sv=document.querySelector('section[data-view="sms"]'); return sv&&!sv.hidden&&typeof getSV==="function"&&getSV()==="biz"; };
function syncSel(){ const L=selList(); if(window.EMO){ EMO.list=L.map(c=>({c})); EMO.cur=Math.min(PI,Math.max(0,L.length-1)); } if(window.MK){ MK.cust=(prevC()||{}).id||null; } }
function bm(c){ const b=dg(c.birth); if(b.length===8) return +b.slice(4,6); const r=dg(c.rrn7||""); if(r.length>=6) return +r.slice(2,4); return 0; }

/* PNG/JPG blob → MMS용 JPG base64 (200KB 이하) */
async function toJpeg(blob){ const url=URL.createObjectURL(blob); try{
    const im=await new Promise((ok,no)=>{ const i=new Image(); i.onload=()=>ok(i); i.onerror=no; i.src=url; });
    for(const max of [1000,860,720,600]){ const k=Math.min(1,max/Math.max(im.width,im.height)), c=document.createElement("canvas"); c.width=Math.round(im.width*k); c.height=Math.round(im.height*k);
      const g=c.getContext("2d"); g.fillStyle="#fff"; g.fillRect(0,0,c.width,c.height); g.drawImage(im,0,0,c.width,c.height);
      for(const q of [.85,.75,.65,.55,.45]){ const d=c.toDataURL("image/jpeg",q); if(d.length*0.75<195000) return {data:d.split(",")[1],url:d}; } }
    return null; } finally{ URL.revokeObjectURL(url); } }


/* 문자 글: 카드·뉴스는 내용이 이미지에 있으니 인사 + 내 개인페이지 링크 / 단·장문은 고객마다 #{이름} 채움 */
function link(){ try{ return typeof hpUrl==="function"?hpUrl():""; }catch(_){ return ""; } }
function msgText(mode,c){ if(mode==="sms"){ try{ return c?mkSendText(c.id):(typeof mkOut==="function"?mkOut():""); }catch(_){ return ""; } }
  const me=(typeof ME!=="undefined"&&ME.name)||"담당 설계사", ph=(typeof ME!=="undefined"&&ME.phone)||"", u=link();
  const d=new Date(Date.now()+9*3600e3), md=`${d.getUTCMonth()+1}.${d.getUTCDate()}`;
  const head=mode==="emo"?"":`[데일리뉴스 ${md}] ${c&&c.name?c.name+"님, ":""}오늘의 경제·보험 소식입니다.`;
  return `${mode==="emo"?"":head+"\n\n"}${me} 드림${ph?" "+ph:""}${u?`\n\n▶ 담당 설계사 페이지\n${u}`:""}`; }
function phone(mode){ const c=prevC(), n=SEL.size, img=PV[mode];
  const nav=n>1?`<button type="button" class="cs-nav" data-pi="-1" aria-label="이전 고객">◀</button>`:"", nav2=n>1?`<button type="button" class="cs-nav" data-pi="1" aria-label="다음 고객">▶</button>`:"";
  return `<div class="cs-ph"><div class="cs-in"><div class="cs-top"><span>9:41</span><span class="cs-notch"></span><span>LTE</span></div>
  <div class="cs-hd"><b>${esc(typeof ME!=="undefined"&&ME.sl&&ME.sl.sender||"내 휴대폰 번호")}</b><small>${nav}${esc(c?c.name:"고객")}님이 받는 화면${n>1?` (${PI+1}/${n})`:""}${nav2}</small></div>
  <div class="cs-body">${mode==="sms"?"":img?`<img src="${img}" alt="카드 미리보기">`:'<div class="cs-noimg">카드를 그리는 중…</div>'}<div class="cs-bub">${esc(msgText(mode,c)||"(문자 글을 입력하세요)")}</div></div></div></div>`; }

/* ③ 만들기 + ④ 보내기 상자 (휴대폰 옆) */
const SLOTS={sms:["#mk-kinds","#mk-txt"],emo:["#emo-pcs","#emo-bgs"],news:["#mn-themes"]};
const FREE={sms:"#mk-msg",emo:"#emo-out",news:"#mn-msg"};
function box(mode){ const n=SEL.size, ready=typeof pbReady==="function"&&pbReady(), noMkt=selList().filter(c=>!c.mkt).length;
  return `<div class="cs-box"><div class="cs-r" id="cs-r-${mode}">${phone(mode)}</div><div class="cs-l">
    <div class="mf-h"><b class="mf-n">3</b>만들기 <span class="note">왼쪽 휴대폰이 고객이 받는 화면입니다. 고치면 바로 바뀝니다.</span></div>
    ${SLOTS[mode].map(k=>`<div class="cs-slot" data-slot="${k}"></div>`).join("")}
    ${mode==="emo"?'<p class="note" style="margin:0 0 4px">카드 글·인사말·좋은 글 고르기는 오른쪽 칸에서 고칩니다.</p>':""}
    <div class="mf-h" style="margin-top:18px"><b class="mf-n">4</b>보내기</div>
    <div class="cs-send"><b>문자로 보내기</b> <span class="note">내 번호로 발송 · 솔라피 충전금 사용${mode==="sms"?" (단문 18원·장문 45원)":" (이미지 문자 110원)"} · VAT 별도</span>
      <div class="row" style="gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap"><label class="row note" style="gap:4px"><input type="radio" name="cs-when-${mode}" value="now" checked> 바로</label><label class="row note" style="gap:4px"><input type="radio" name="cs-when-${mode}" value="at"> 예약</label><input type="datetime-local" id="cs-at-${mode}" style="max-width:220px"></div>
      <button class="btn primary" type="button" data-cssend="${mode}" style="margin-top:10px;width:100%" ${n?"":"disabled"}>${n?`${n}명에게 문자 보내기`:"① 받는 고객을 먼저 고르세요"}</button>
      <p class="note" id="cs-out-${mode}" style="margin:6px 0 0">${ready?"":'솔라피 연결과 발신번호가 필요합니다 · <button type="button" class="lk" data-mfset="1">⚙ 설정 열기</button>'}</p>
      ${noMkt?`<p class="note" style="margin:4px 0 0">광고 수신 미동의 ${noMkt}명 포함: 상품 권유가 들어가면 광고성 문자라 보낼 수 없습니다 (정보통신망법 제50조).</p>`:""}
      ${mode!=="sms"&&!link()?'<p class="note" style="margin:6px 0 0;color:#b54708">아직 내 개인페이지가 공개되지 않아 문자에 링크가 붙지 않습니다. <button type="button" class="btn sm" data-go="homepage">개인페이지 만들고 공개하기 →</button></p>':""}</div>
    ${FREE[mode]?`<div class="cs-slot cs-free" data-slot="${FREE[mode]}"></div>`:""}
    </div></div>`; }
function draw(m){ const h=$("#cs-"+m); if(!h) return; const keep={};
  [FREE[m],...SLOTS[m]].filter(Boolean).forEach(k=>{ const el=$(k), pan=el&&(el.closest(".mk-free")||el.closest(".panel")); if(pan&&pan!==h){ pan.remove(); keep[k]=pan; } });
  h.innerHTML=box(m); h.querySelectorAll(".cs-slot").forEach(sl=>{ const pan=keep[sl.dataset.slot]; if(pan){ pan.classList.add("cs-pcs"); sl.appendChild(pan); } }); }
function updPhone(mode){ const r=$("#cs-r-"+mode); if(r) r.innerHTML=phone(mode); }

/* 화면에 붙이기 */
function mount(){
  [["emo","#emo-wrap"],["news","#mn-news"]].forEach(([m,sel])=>{ const a=$(sel); if(!a) return;
    let left=a.querySelector(":scope>.mn-left"); if(!left){ const st=a.firstElementChild; left=document.createElement("div"); left.className="mn-left"; a.insertBefore(left,st); left.appendChild(st); st.classList.add("cs-stage-"+m); }
    let h=$("#cs-"+m); if(!h){ h=document.createElement("div"); h.id="cs-"+m; h.className="panel"; left.insertBefore(h,left.firstElementChild); }
    if(m==="news") a.classList.add("mf-one");
    draw(m); });
  const kit=document.querySelector('section[data-view="sms"] [data-svv="kit"]');
  if(kit){ let h=$("#cs-sms"); if(!h){ h=document.createElement("div"); h.id="cs-sms"; h.className="panel"; kit.insertBefore(h,kit.firstElementChild); } draw("sms"); }
  const cc=$("#cd-cust"); if(cc){ const r=cc.closest(".row"); r.hidden=true; if(r.previousElementSibling&&r.previousElementSibling.tagName==="H2") r.previousElementSibling.hidden=true; const ch=$("#cd-chips"); if(ch) ch.hidden=true; }
  renderFlow(); }

/* ① 받는 고객 · ② 무엇을 보낼까 (두 화면 위에 같은 머리) */
function listHTML(){ const Q=MFQ.trim(), L=custs().filter(c=>!Q||String(c.name).includes(Q)||dg(c.phone).includes(dg(Q))).slice(0,400);
  return L.map(c=>`<label class="${okPh(c)?"":"off"}"><input type="checkbox" data-mfc="${c.id}" ${SEL.has(c.id)?"checked":""} ${okPh(c)?"":"disabled"}> ${esc(c.name)} <span class="note">${esc(c.type||"관리")}${okPh(c)?"":" · 번호 없음"}${c.mkt?"":" · 광고 수신 미동의"}</span></label>`).join("")||'<p class="note">해당 고객이 없습니다.</p>'; }
function headHTML(){ if(inSet()) return `<div class="mf mf-set"><button class="btn" type="button" data-mfback="1">← 문자 보내기로 돌아가기</button><b style="font-size:16px">⚙ 자동 발송 · 솔라피 설정</b></div>`;
  const L=selList(), mon=new Date(Date.now()+9*3600e3).getUTCMonth()+1;
  return `<div class="mf"><div class="mf-top"><span class="note">순서: ① 받는 고객 → ② 보낼 것 → ③ 만들기 → ④ 보내기</span><button class="btn" type="button" data-mfset="1">⚙ 자동 발송·솔라피 설정</button></div>
  <div class="mf-s"><b class="mf-n">1</b><div class="mf-b"><div class="mf-h">받는 고객 <span class="mf-cnt">${L.length}명</span></div>
    <div class="row mf-g" style="gap:6px;flex-wrap:wrap"><button class="btn sm" type="button" data-mfg="all">전체</button><button class="btn sm" type="button" data-mfg="관리">관리고객</button><button class="btn sm" type="button" data-mfg="가망">가망고객</button><button class="btn sm" type="button" data-mfg="bday">${mon}월 생일</button><button class="btn sm" type="button" data-mfg="mkt">광고 수신 동의</button><button class="btn sm" type="button" data-mfg="none">모두 빼기</button><button class="btn sm" type="button" data-mflist="1">${MFOPEN?"목록 닫기 ▴":"한 명씩 고르기 ▾"}</button></div>
    <div class="mf-chips">${L.slice(0,14).map(c=>`<span class="mf-chip">${esc(c.name)}<button type="button" data-mfx="${c.id}" aria-label="${esc(c.name)} 빼기">×</button></span>`).join("")}${L.length>14?`<span class="note">외 ${L.length-14}명</span>`:""}${L.length?"":'<span class="note">위 버튼으로 묶음을 넣거나 [한 명씩 고르기]로 고르세요.</span>'}</div>
    <div class="mf-pick" ${MFOPEN?"":"hidden"}><input class="mf-q" placeholder="이름·전화번호 검색" value="${esc(MFQ)}" autocomplete="off"><div class="cs-list mf-list">${MFOPEN?listHTML():""}</div></div>
  </div></div>
  <div class="mf-s"><b class="mf-n">2</b><div class="mf-b"><div class="mf-h">무엇을 보낼까</div><div class="mf-ts"></div></div></div></div>`; }
function renderFlow(){ document.querySelectorAll('section[data-view="sms"],section[data-view="morning"]').forEach(sec=>{
    const ts=sec.querySelector(".ts-tabs"); if(!ts) return; let h=sec.querySelector(".mf-host"); if(!h){ h=document.createElement("div"); h.className="mf-host"; ts.parentElement.insertBefore(h,ts); }
    const q=h.querySelector(".mf-q"), foc=q&&document.activeElement===q, pos=foc?q.selectionStart:0;
    ts.remove(); h.innerHTML=headHTML(); const slot=h.querySelector(".mf-ts"); if(slot) slot.appendChild(ts); else { ts.hidden=true; h.appendChild(ts); }
    ts.hidden=!slot; const svt=sec.querySelector("#sv-tabs"); if(svt) svt.hidden=true;
    if(foc){ const n=h.querySelector(".mf-q"); n.focus(); try{ n.setSelectionRange(pos,pos); }catch(_){} } }); }
function selChanged(){ PI=0; syncSel(); const m=curMode(); if(m==="emo"&&typeof renderEmo==="function") renderEmo(); if(m==="sms"&&typeof renderKit==="function"){ try{ renderKit(); }catch(_){} }
  renderFlow(); ["sms","emo","news"].forEach(draw); autoPv(m,250); }

/* 미리보기 이미지 (카드·뉴스) */
let PVT={}, PVN=0;
async function preview(mode){ if(BUSY||mode==="sms") return; const n=++PVN; try{ await wait(60); const b=mode==="emo"?await emoBlob():await mnBlob(); if(n!==PVN||!b) return; const j=await toJpeg(b); if(n!==PVN) return; PV[mode]=j?j.url:""; updPhone(mode); }catch(e){} }
function autoPv(mode,ms){ if(mode==="sms"){ setTimeout(()=>updPhone("sms"),60); return; } clearTimeout(PVT[mode]); PVT[mode]=setTimeout(()=>{ const w=$(mode==="emo"?"#emo-wrap":"#mn-news"); if(w&&!w.hidden) preview(mode); },ms==null?500:ms); }

/* 보내기 — 진행 상황을 큰 팝업으로 (확인 → 보내는 중 → 완료/충전 필요/오류) */
const CHARGE="https://console.solapi.com/";
function pop(o){ let w=$("#cs-pop"); if(!w){ w=document.createElement("div"); w.id="cs-pop"; w.setAttribute("role","dialog"); w.setAttribute("aria-modal","true"); document.body.appendChild(w); }
  if(!o){ w.hidden=true; return; } w.hidden=false;
  const ic={wait:'<div class="cp-spin"></div>',ok:'<div class="cp-ic ok">✓</div>',warn:'<div class="cp-ic warn">!</div>',ask:'<div class="cp-ic ask">?</div>'}[o.kind||"wait"];
  w.innerHTML=`<div class="cp-box">${ic}<h2>${esc(o.title)}</h2>${o.sub?`<p>${esc(o.sub).replace(/\n/g,"<br>")}</p>`:""}
    ${o.pct!=null?`<div class="cp-bar"><i style="width:${Math.max(3,Math.min(100,o.pct))}%"></i></div>`:""}
    ${(o.btns||[]).length?`<div class="cp-btns">${o.btns.map((b,k)=>b.href?`<a class="btn ${b.primary?"primary":""}" href="${b.href}" target="_blank" rel="noopener" data-cpk="${k}">${esc(b.t)}</a>`:`<button class="btn ${b.primary?"primary":""}" type="button" data-cpk="${k}">${esc(b.t)}</button>`).join("")}</div>`:""}</div>`;
  w.querySelectorAll("[data-cpk]").forEach(el=>el.onclick=()=>{ const b=o.btns[+el.dataset.cpk]; if(b.act) b.act(); if(!b.keep) pop(null); }); }
const ask=(title,sub,yes)=>new Promise(r=>pop({kind:"ask",title,sub,btns:[{t:"취소",act:()=>r(false)},{t:yes||"보내기",primary:true,act:()=>r(true)}]}));
const openSet=()=>{ if(typeof setSV==="function") setSV("biz"); if(typeof go==="function") go("sms"); if(typeof renderSmsView==="function") renderSmsView(); renderFlow(); window.scrollTo(0,0); };
const needCharge=(sub)=>pop({kind:"warn",title:"솔라피 충전이 필요합니다",sub:sub+"\n\n최소 1만 원부터 충전됩니다 (금액 칸에 10000 입력).\n1만 원이면 단문 약 500건 · 장문 약 200건 · 카드·뉴스 이미지 문자 약 80건\n충전한 뒤 다시 [문자 보내기]를 누르세요.",btns:[{t:"닫기"},{t:"솔라피 충전하러 가기",primary:true,href:CHARGE}]});
const fail=(sub)=>pop({kind:"warn",title:"보내지 못했습니다",sub,btns:/잔액|충전/.test(sub||"")?[{t:"닫기"},{t:"솔라피 충전하러 가기",primary:true,href:CHARGE}]:/연결|발신번호|권한/.test(sub||"")?[{t:"닫기"},{t:"⚙ 솔라피 설정 열기",primary:true,act:openSet}]:[{t:"확인",primary:true}]});
/* 솔라피 연결 직후: 연결된 계정 확인 팝업 (브라우저에 로그인돼 있던 다른 계정이 연결되는 실수 방지) */
window.csAcctCheck=r=>{ if(!r) return;
  if(r.error==="dup_account"){ pop({kind:"warn",title:"다른 회원의 솔라피 계정입니다",sub:r.message+"\n\n솔라피 화면 오른쪽 위 계정 이름 → 로그아웃 후 다시 [솔라피 연결]을 누르세요.",btns:[{t:"솔라피 열기 (로그아웃)",href:"https://console.solapi.com/"},{t:"확인",primary:true}]}); return; }
  if(r.error) return;
  pop({kind:"ask",title:"이 솔라피 계정이 본인 계정인가요?",sub:`연결된 솔라피 계정: ${r.account||"(이름 확인 불가)"}\n발신번호: ${(r.senders||[]).map(x=>x.no).join(", ")||"없음"}\n\n본인 계정이 아니면 문자가 다른 사람 번호·잔액으로 나갑니다.`,
    btns:[{t:"아니요, 연결 끊기",act:async()=>{ await slCall("disconnect"); if(typeof ME!=="undefined"&&ME.sl){ ME.sl.on=false; ME.sl.sender=""; ME.sl.senders=[]; } if(typeof slRefresh==="function") await slRefresh(); pop({kind:"warn",title:"연결을 끊었습니다",sub:"솔라피에서 로그아웃한 뒤, 본인 솔라피 계정으로 다시 [솔라피 연결]을 누르세요.",btns:[{t:"솔라피 열기 (로그아웃)",href:"https://console.solapi.com/"},{t:"확인",primary:true}]}); },keep:true},{t:"네, 맞습니다",primary:true}]}); };
async function send(mode){ if(BUSY) return; const say=t=>{ const x=$("#cs-out-"+mode); if(x) x.textContent=t; };
  if(!(typeof pbReady==="function"&&pbReady())){ pop({kind:"warn",title:"솔라피 연결이 필요합니다",sub:"문자는 내 솔라피 계정·내 번호로 나갑니다.\n처음 한 번만 연결하고 발신번호를 고르면 됩니다.",btns:[{t:"닫기"},{t:"⚙ 솔라피 설정 열기",primary:true,act:openSet}]}); return; }
  const when=(document.querySelector(`[name="cs-when-${mode}"]:checked`)||{}).value, atv=($("#cs-at-"+mode)||{}).value;
  let at=null; if(when==="at"){ if(!atv){ pop({kind:"warn",title:"예약 날짜·시각을 넣으세요",btns:[{t:"확인",primary:true}]}); return; } at=new Date(atv); if(+at<Date.now()+60e3){ pop({kind:"warn",title:"예약 시각을 확인하세요",sub:"예약은 지금보다 뒤 시각이어야 합니다.",btns:[{t:"확인",primary:true}]}); return; } }
  const L=selList().filter(okPh); if(!L.length){ pop({kind:"warn",title:"보낼 고객이 없습니다",sub:"① 받는 고객을 고르세요 (휴대폰 번호가 있는 고객만 보낼 수 있습니다).",btns:[{t:"확인",primary:true}]}); return; }
  if(mode==="sms"&&!String(($("#mk-txt")||{}).value||"").trim()){ pop({kind:"warn",title:"문자 글을 입력하세요",btns:[{t:"확인",primary:true}]}); return; }
  /* 잔액 확인: 단문 18원·장문 45원·이미지 110원 (VAT 별도) → 10% 더해 대략 계산 */
  BUSY=true; pop({kind:"wait",title:"솔라피 잔액을 확인하는 중…"});
  let bal=null; try{ const st=await slCall("status"); if(st&&!st.error&&typeof st.balance==="number") bal=st.balance+(st.point||0); }catch(_){}
  const unit=mode==="sms"?(L.some(c=>[...mkSendText(c.id)].reduce((n,ch)=>n+(ch.charCodeAt(0)>127?2:1),0)>90)?45:18):110, cost=Math.ceil(L.length*unit*1.1);
  BUSY=false;
  if(bal!=null&&bal<cost){ needCharge(`보낼 문자 ${L.length}건 · 예상 요금 약 ${cost.toLocaleString()}원\n지금 잔액 ${bal.toLocaleString()}원`); return; }
  const lab={sms:"단·장문 문자",emo:"카드문자",news:"데일리뉴스"}[mode];
  if(!await ask(`${L.length}명에게 ${lab}를 ${at?"예약":"보낼까요"}${at?"할까요":""}?`,`${at?`예약 시각: ${atv.replace("T"," ")}\n`:""}예상 요금 약 ${cost.toLocaleString()}원 (솔라피 잔액에서 빠짐)${bal!=null?` · 지금 잔액 ${bal.toLocaleString()}원`:""}`,at?"예약하기":"보내기")) return;
  BUSY=true; const msgs=[], miss=[]; const step=(title,sub,pct)=>{ pop({kind:"wait",title,sub,pct}); say(title); };
  try{
    if(mode==="sms"){ L.forEach(c=>msgs.push({to:dg(c.phone),text:mkSendText(c.id)})); }
    else if(mode==="emo"){ const cur0=EMO.cur;
      for(let i=0;i<L.length;i++){ step("카드 만드는 중…",`${L[i].name}님 카드 (${i+1}/${L.length})`,(i/L.length)*80); EMO.cur=EMO.list.findIndex(r=>r.c.id===L[i].id); renderEmo(); await wait(450);
        const b=await emoBlob(), j=b&&await toJpeg(b); if(!j){ miss.push(L[i].name); continue; }
        const up=await slCall("upload_image",{data:j.data}); if(up.error){ EMO.cur=cur0; renderEmo(); say(up.message||""); fail(up.message||"이미지를 올리지 못했습니다."); return; }
        msgs.push({to:dg(L[i].phone),text:msgText("emo",L[i]),imageId:up.imageId,subject:"카드"}); }
      EMO.cur=cur0; renderEmo(); }
    else { step("뉴스 카드 올리는 중…","",30); const b=await mnBlob(), j=b&&await toJpeg(b); if(!j){ fail("뉴스 카드를 그리지 못했습니다."); return; }
      const up=await slCall("upload_image",{data:j.data}); if(up.error){ say(up.message||""); fail(up.message||"이미지를 올리지 못했습니다."); return; }
      L.forEach(c=>msgs.push({to:dg(c.phone),text:msgText("news",c),imageId:up.imageId,subject:"데일리뉴스"})); }
    if(!msgs.length){ fail("보낼 문자를 만들지 못했습니다."); return; }
    step(at?"솔라피에 예약하는 중…":"문자 보내는 중…",`${msgs.length}건`,90);
    const r=await slCall("send",{messages:msgs,at:at?at.toISOString():null});
    if(r.error){ say(r.message||"보내지 못했습니다."); if(r.error==="dup_account"){ window.csAcctCheck(r); return; } fail(r.message||"보내지 못했습니다."); return; }
    const nf=(r.failed||[]).length, ok=r.accepted||0;
    const t=`${at?"예약":"접수"} ${ok}건${nf?` · 실패 ${nf}건`:""}${miss.length?` · 카드 못 만든 고객 ${miss.length}명`:""}`;
    if(typeof pbLog==="function") pbLog(`${lab} ${at?"예약":"발송"}`,0,{n:msgs.length,ok,fail:nf});
    if(typeof ACTS!=="undefined") L.forEach(c=>ACTS.push({cust:c.id,date:new Date(Date.now()+9*3600e3).toISOString().slice(0,10),type:"문자",memo:`${lab} ${at?"예약":"발송"}`}));
    if(typeof cloudSave==="function") try{ cloudSave(true); }catch(_){}
    draw(mode); say(t);
    const why=[...new Set((r.failed||[]).map(f=>f.why).filter(Boolean))].slice(0,3).join("\n");
    pop({kind:nf||miss.length?"warn":"ok",title:at?`예약 완료 ${ok}건`:`발송 접수 ${ok}건`,
      sub:`${at?`${atv.replace("T"," ")}에 나갑니다.`:"솔라피가 통신사로 보내는 중입니다. 보통 1분 안에 도착합니다."}${nf?`\n실패 ${nf}건: ${why}`:""}${miss.length?`\n카드를 못 만든 고객: ${miss.join(", ")}`:""}\n최종 도착 결과는 솔라피 [발송 내역]에서 확인할 수 있습니다.`,
      btns:[{t:"솔라피 열기 (발송 내역)",href:"https://console.solapi.com/"},{t:"확인",primary:true}]});
  }catch(e){ fail("보내는 중 문제가 생겼습니다. 다시 시도하세요."); } finally{ BUSY=false; } }

/* 클릭·입력 */
document.addEventListener("click",e=>{ const t=e.target.closest("[data-mfg],[data-mfx],[data-mflist],[data-mfset],[data-mfback],[data-cssend],[data-pi]"); if(!t) return;
  if(t.dataset.cssend){ send(t.dataset.cssend); return; }
  if(t.dataset.pi){ const n=SEL.size; if(!n) return; PI=(PI+(+t.dataset.pi)+n)%n; syncSel(); const m=curMode(); if(m==="emo") renderEmo(); updPhone(m); autoPv(m,100); return; }
  if(t.dataset.mflist){ MFOPEN=!MFOPEN; renderFlow(); return; }
  if(t.dataset.mfset){ if(typeof setSV==="function") setSV("biz"); if(typeof go==="function") go("sms"); if(typeof renderSmsView==="function") renderSmsView(); renderFlow(); window.scrollTo(0,0); return; }
  if(t.dataset.mfback){ if(typeof setSV==="function") setSV("kit"); if(typeof renderSmsView==="function") renderSmsView(); mount(); return; }
  if(t.dataset.mfx){ SEL.delete(+t.dataset.mfx); selChanged(); return; }
  const g=t.dataset.mfg; if(g==="none") SEL.clear(); else { const mon=new Date(Date.now()+9*3600e3).getUTCMonth()+1;
    custs().filter(okPh).filter(c=>g==="all"||(g==="bday"?bm(c)===mon:g==="mkt"?!!c.mkt:(c.type||"관리")===g)).forEach(c=>SEL.add(c.id)); }
  selChanged(); });
document.addEventListener("change",e=>{ const x=e.target.closest("[data-mfc]"); if(!x) return; const id=+x.dataset.mfc; x.checked?SEL.add(id):SEL.delete(id); selChanged(); });
document.addEventListener("input",e=>{ const x=e.target; if(x.classList&&x.classList.contains("mf-q")){ MFQ=x.value; document.querySelectorAll(".mf-list").forEach(l=>l.innerHTML=listHTML()); document.querySelectorAll(".mf-q").forEach(o=>{ if(o!==x) o.value=MFQ; }); return; }
  if(x.id==="mk-txt") updPhone("sms"); });
/* 화면이 다시 그려지면 붙임 */
new MutationObserver(()=>{ if(($("#emo-wrap")&&!$("#cs-emo"))||($("#mn-news")&&!$("#cs-news"))||(document.querySelector('[data-svv="kit"]')&&!$("#cs-sms"))||!document.querySelector(".mf-host")){ mount(); autoPv("emo",300); autoPv("news",300); } }).observe(document.body,{childList:true,subtree:true});
/* 오른쪽에서 카드를 고치면 휴대폰 미리보기 자동 갱신 */
document.addEventListener("input",e=>{ if(BUSY||e.target.closest(".mf")) return; if(e.target.closest("#emo-wrap")) autoPv("emo"); if(e.target.closest("#mn-news")) autoPv("news"); });
document.addEventListener("change",e=>{ if(BUSY||e.target.closest("[data-mfc],.cs-send")) return; if(e.target.closest("#emo-wrap")) autoPv("emo"); if(e.target.closest("#mn-news")) autoPv("news"); });
document.addEventListener("click",e=>{ if(BUSY||e.target.closest(".mf,.cs-send,[data-pi]")) return;
  if(e.target.closest("[data-ts],[data-go],[data-sv]")) setTimeout(()=>{ syncSel(); renderFlow(); ["sms","emo","news"].forEach(draw); const m=curMode(); autoPv(m,300); },80);
  if(e.target.closest("#emo-wrap button,#emo-wrap [data-pc],#emo-wrap [data-emobg]")) autoPv("emo",350); if(e.target.closest("#mn-news button")) autoPv("news",350);
  if(e.target.closest("[data-mk],#mk-reset")) autoPv("sms"); },true); /* capture: 보잇이 버튼을 다시 그리기 전에 판단 */
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
.mf{display:flex;flex-direction:column;gap:10px;margin-top:12px}.mf-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.mf-s{display:flex;gap:12px;align-items:flex-start;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px 16px}.mf-b{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
.mf-n{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--accent);color:#fff;font-size:14px;font-weight:800;flex:none;margin-right:8px}
.mf-s>.mf-n{margin:0}.mf-h{font-weight:800;font-size:15.5px;display:flex;align-items:center;flex-wrap:wrap;gap:4px}.mf-h .note{font-weight:400;margin-left:6px}.mf-cnt{color:var(--accent);margin-left:6px}
.mf-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.mf-chip{display:inline-flex;align-items:center;gap:4px;border:1px solid color-mix(in srgb,var(--accent) 40%,var(--line));background:color-mix(in srgb,var(--accent) 8%,var(--surface));border-radius:999px;padding:3px 6px 3px 12px;font-size:13.5px}.mf-chip button{border:0;background:none;cursor:pointer;font-size:15px;line-height:1;color:var(--muted,#888);padding:0 4px}
.mf-q{width:100%;max-width:420px}.mf-ts .ts-tabs{margin:0!important}.mf-ts .ts-tabs .btn{min-width:120px;font-size:15px}.mf-set{flex-direction:row;align-items:center;gap:12px}
.mf-one{grid-template-columns:minmax(0,1fr)!important}[data-svv="kit"]>.mw{display:none!important}#cs-sms .fgrid{display:none}#mk-tocard{display:none!important}.mk-free{display:flex;flex-direction:column;gap:8px}.mk-free h2{font-size:15px;margin:0}
.cs-send{border:1px solid var(--line);border-radius:12px;padding:12px 14px}.cs-free .cs-pcs{margin:12px 0 0;padding:12px 14px!important;border:1px dashed var(--line)!important;border-radius:12px!important}
#cs-pop{position:fixed;inset:0;background:rgba(15,20,25,.45);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px}#cs-pop[hidden]{display:none}
.cp-box{background:var(--surface,#fff);color:var(--text,#111);border-radius:20px;padding:30px 28px 24px;width:min(460px,100%);text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.25)}
.cp-box h2{font-size:22px;margin:14px 0 8px;line-height:1.35}.cp-box p{font-size:15px;line-height:1.65;margin:0;color:var(--muted,#555)}
.cp-ic{width:60px;height:60px;border-radius:50%;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;color:#fff}.cp-ic.ok{background:#12a37a}.cp-ic.warn{background:#e08a00}.cp-ic.ask{background:var(--accent,#0f7a5c)}
.cp-spin{width:56px;height:56px;margin:0 auto;border-radius:50%;border:6px solid #e3ece8;border-top-color:var(--accent,#0f7a5c);animation:cpr 1s linear infinite}@keyframes cpr{to{transform:rotate(360deg)}}
.cp-bar{height:10px;border-radius:6px;background:#e9efec;margin:16px 0 0;overflow:hidden}.cp-bar i{display:block;height:100%;background:var(--accent,#0f7a5c);transition:width .3s}
.cp-btns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:20px}.cp-btns .btn{min-width:120px;font-size:15px;text-decoration:none}
.cs-nav{border:0;background:none;cursor:pointer;font-size:12px;color:#555;padding:0 6px}
`+`
.mn-left{display:flex;flex-direction:column;gap:14px;min-width:0;position:relative}.mn-wrap{max-width:1480px}
.cs-stage-emo{position:absolute!important;left:-20000px;top:0;width:600px}.cs-stage-news{position:absolute!important;left:-20000px;top:0;width:780px}
.cs-box{display:grid;grid-template-columns:360px minmax(0,1fr);gap:22px;align-items:start}@media(max-width:860px){.cs-box{grid-template-columns:1fr}}
.cs-pcs{padding:0!important;border:0!important;box-shadow:none!important;background:none!important;margin:0 0 12px}.cs-pcs h2{font-size:14px;margin:0}
.cs-pcs .emo-bgs{grid-template-columns:repeat(auto-fill,minmax(72px,1fr))!important}.cs-pcs .emo-bgs button{height:40px!important;font-size:12px}
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
