/* 보잇 · 자동 문자 (2026-11-22)
   - 문자·카드 › 내 번호로 문자(솔라피) › 자동 발송: 생일 · 명절 · 월초 안부 — 카드 누르면 왼쪽 설정(켜기·대상·고객 고르기·시각·문구) / 오른쪽 미리보기(문구·다음 발송 일정)
   - 고객 상세 › 기본정보 '자동 문자' 줄에서 고객별로 켜고 끄기 (같은 설정을 함께 씀)
   - 발송: 보잇을 열면(그리고 30분마다) 앞으로 14일 안의 발송분을 솔라피 '예약 발송'으로 미리 넣어 둠 → 그날 보잇을 안 열어도 솔라피가 보냄
     · 이미 예약한 건은 고객·날짜별로 기록(ME.autoDone)해 두 번 넣지 않음
     · 예약 뒤 끄거나 고객을 빼도 이미 넣은 예약은 남음 → 솔라피 [발송 내역 › 예약]에서 취소 (화면에 안내)
   - 대상 기본값: '광고 수신 동의' 고객만 (영업 목적 안부 문자의 광고성 해당 여부 확인 전까지 · 정보통신망법 제50조)
   - 명절 날짜: 우주항공청 2027년 월력요항 기준 설 연휴 2027-02-06~09, 추석 연휴 2027-09-14~16 → 연휴 전 근무일 발송 */
(function(){
"use strict";
if(typeof ME==="undefined"||typeof CUSTOMERS==="undefined") return;
const $=s=>document.querySelector(s), esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const dg=s=>String(s||"").replace(/\D/g,"");
const kst=()=>new Date(Date.now()+9*3600e3);
const ymdK=d=>new Date(d.getTime()+9*3600e3).toISOString().slice(0,10);
const todayK=()=>kst().toISOString().slice(0,10);
const addD=(s,n)=>{ const d=new Date(s+"T00:00:00Z"); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); };
const dow=s=>new Date(s+"T00:00:00Z").getUTCDay();
const HOLI=["2027-01-01","2027-02-06","2027-02-07","2027-02-08","2027-02-09","2027-03-01","2027-05-01","2027-05-03","2027-05-05","2027-05-13","2027-06-06","2027-07-17","2027-07-19","2027-08-15","2027-08-16","2027-09-14","2027-09-15","2027-09-16","2027-10-03","2027-10-04","2027-10-09","2027-10-11","2027-12-25","2027-12-27","2026-12-25"];
const work=s=>dow(s)!==0&&dow(s)!==6&&!HOLI.includes(s);
/* 명절: 연휴 첫날 전 근무일 */
const FEAST=[["설","2027-02-06"],["추석","2027-09-14"]].map(([n,s])=>{ let d=addD(s,-1); while(!work(d)) d=addD(d,-1); return {n,d}; });

const TYPES={
  bday:{t:"생일",d:"고객 생일 당일",def:"{이름}님, 생일 축하드립니다. 늘 건강하시고 좋은 일만 가득하시길 바랍니다. - {설계사} 드림"},
  feast:{t:"명절",d:"설·추석 연휴 전 마지막 근무일",def:"{이름}님, 가족과 함께 따뜻하고 넉넉한 명절 보내세요. 늘 감사드립니다. - {설계사} 드림"},
  month:{t:"월초 안부",d:"매월 첫 근무일",def:"{이름}님, 새로운 한 달도 건강하고 평안하시길 바랍니다. 보험 관련 궁금한 점은 언제든 연락 주세요. - {설계사} 드림"},
  expiry:{t:"만기 안내",d:"자동차·일반보험 만기 전",ct:1,def:"{이름}님, {보험사} {상품}이 {날짜}에 만기됩니다. 갱신 준비를 도와드리겠습니다. 편하실 때 연락 주세요. - {설계사} 드림"},
  excl:{t:"면책·감액 종료",d:"계약별 면책·감액기간 종료일",ct:1,def:"{이름}님, {보험사} {상품}의 {구분}이 {날짜}에 끝납니다. 보장 내용은 약관 기준으로 안내드리니 궁금하시면 연락 주세요. - {설계사} 드림"},
  anniv:{t:"가입 1주년",d:"계약일 1년 되는 날",ct:1,def:"{이름}님, {보험사} {상품} 가입 1주년입니다. 믿고 맡겨 주셔서 감사합니다. 보장 점검이 필요하시면 언제든 연락 주세요. - {설계사} 드림"}
};
/* 만기 안내 대상: 1년 단위로 갱신하는 자동차·일반보험(화재·배상책임·기타). 장기·운전자는 제외 */
const GEN=["자동차","화재","배상책임","기타"];
const ctKey=k=>String(k.policyNo||"")||[k.insurer,k.product,k.start].join("~");
function rules(){ if(!ME.autos||typeof ME.autos!=="object") ME.autos={};
  Object.keys(TYPES).forEach(k=>{ if(!ME.autos[k]) ME.autos[k]={on:false,mode:"all",ids:[],ex:[],mkt:!TYPES[k].ct,time:"10:00",days:30,text:TYPES[k].def}; if(ME.autos[k].days==null) ME.autos[k].days=30; }); return ME.autos; }
const done=()=>(ME.autoDone&&typeof ME.autoDone==="object")?ME.autoDone:(ME.autoDone={});
function inMode(r,c){ if(r.mode==="pick") return (r.ids||[]).includes(c.id); if(r.mode==="관리"&&(c.type||"관리")!=="관리") return false; if(r.mode==="가망"&&c.type!=="가망") return false; return !(r.ex||[]).includes(c.id); }
const okPhone=c=>/^01\d{8,9}$/.test(dg(c.phone));
function targets(k){ const r=rules()[k]; return CUSTOMERS.filter(c=>inMode(r,c)&&okPhone(c)&&(!r.mkt||c.mkt)); }
function bdayOn(c,from,to){ const b=String(c.birth||"").slice(5,10); if(!/^\d\d-\d\d$/.test(b)) return null;
  for(const y of [from.slice(0,4),String(+from.slice(0,4)+1)]){ let s=`${y}-${b}`; if(b==="02-29"&&!(+y%4===0&&(+y%100!==0||+y%400===0))) s=`${y}-02-28`; if(s>=from&&s<=to) return s; } return null; }
function firstWork(y,m){ let d=`${y}-${String(m).padStart(2,"0")}-01`; while(!work(d)) d=addD(d,1); return d; }
/* 앞으로 days일 안의 발송 계획: [{k,d,c}] */
function plan(days,k0){ const from=todayK(), to=addD(from,days), out=[], R=rules();
  for(const k of Object.keys(TYPES)){ if(k0&&k!==k0) continue; const r=R[k]; if(!r.on&&!k0) continue; const T=targets(k);
    if(k==="bday") T.forEach(c=>{ const d=bdayOn(c,from,to); if(d) out.push({k,d,c}); });
    if(k==="feast") FEAST.filter(f=>f.d>=from&&f.d<=to).forEach(f=>T.forEach(c=>out.push({k,d:f.d,c,n:f.n})));
    if(TYPES[k].ct){ const ids=new Set(T.map(c=>c.id)), byId=new Map(T.map(c=>[c.id,c]));
      (typeof CONTRACTS!=="undefined"?CONTRACTS:[]).filter(t=>ids.has(t.cust)).forEach(t=>{ const c=byId.get(t.cust), ins=t.insurer||"", pr=t.product||"";
        const push=(d,date,gb)=>{ if(d&&d>=from&&d<=to) out.push({k,d,c,ct:t,date,gb,id:ctKey(t)+(gb||"")}); };
        if(k==="expiry"&&GEN.includes(t.kind)&&/^\d{4}-\d\d-\d\d$/.test(t.end||"")) push(addD(t.end,-(+r.days||30)),t.end);
        if(k==="excl"){ if(/^\d{4}-\d\d-\d\d$/.test(t.excl||"")) push(t.excl,t.excl,"면책기간"); if(/^\d{4}-\d\d-\d\d$/.test(t.reduce||"")) push(t.reduce,t.reduce,"감액기간"); }
        if(k==="anniv"&&/^\d{4}-\d\d-\d\d$/.test(t.start||"")){ const a=`${+t.start.slice(0,4)+1}${t.start.slice(4)}`; push(a,t.start); } }); }
    if(k==="month"){ const y=+from.slice(0,4), m=+from.slice(5,7); [[y,m],[m===12?y+1:y,m===12?1:m+1],[m>=11?y+1:y,((m+1)%12)+1]].forEach(([yy,mm])=>{ const d=firstWork(yy,mm); if(d>=from&&d<=to) T.forEach(c=>out.push({k,d,c})); }); } }
  return out.sort((a,b)=>a.d<b.d?-1:1); }
const fill=(t,c,x)=>String(t||"").replace(/\{이름\}/g,c?c.name:"홍길동").replace(/\{설계사\}/g,[ME.name].filter(Boolean).join(" ")+" 설계사")
  .replace(/\{보험사\}/g,x&&x.ct?x.ct.insurer||"":"OO보험").replace(/\{상품\}/g,x&&x.ct?x.ct.product||"보험":"OO보험 상품").replace(/\{날짜\}/g,x&&x.date?x.date.replace(/^(\d{4})-(\d\d)-(\d\d)$/,(m,y,mo,d)=>`${+mo}월 ${+d}일`):"O월 O일").replace(/\{구분\}/g,x&&x.gb?x.gb:"면책기간");
const keyOf=x=>`${x.k}|${x.d}|${x.c.id}${x.id?"|"+x.id:""}`;

/* ---- 예약 넣기 ---- */
let busy=false;
async function run(){ if(busy||typeof slLive!=="function"||!slLive()||typeof pbReady!=="function"||!pbReady()) return; busy=true;
  try{ const D=done(), todo=plan(14).filter(x=>rules()[x.k].on&&!D[keyOf(x)]); if(!todo.length) return;
    const groups={}; todo.forEach(x=>{ (groups[x.k+"|"+x.d]=groups[x.k+"|"+x.d]||[]).push(x); });
    let n=0;
    for(const g of Object.values(groups)){ const r=rules()[g[0].k], [hh,mm]=String(r.time||"10:00").split(":").map(Number);
      let at=new Date(`${g[0].d}T${String(hh).padStart(2,"0")}:${String(mm||0).padStart(2,"0")}:00+09:00`); if(+at<Date.now()+5*60e3) at=new Date(Date.now()+5*60e3);
      if(g[0].d<todayK()) continue;
      const res=await slCall("send",{messages:g.map(x=>({to:dg(x.c.phone),text:fill(r.text,x.c,x)})),at:at.toISOString()});
      if(res.error){ ME.autoErr=`${TYPES[g[0].k].t} ${g[0].d}: ${res.message||"예약하지 못했습니다"}`; continue; }
      const bad=new Set((res.failed||[]).map(f=>dg(f.to)));
      g.forEach(x=>{ if(!bad.has(dg(x.c.phone))){ D[keyOf(x)]={at:at.toISOString(),g:res.groupId||""}; n++; } });
      if(typeof pbLog==="function") pbLog(`자동 ${TYPES[g[0].k].t} 예약 (${g[0].d})`,0,{n:g.length,ok:g.length-bad.size,fail:bad.size}); }
    const cut=addD(todayK(),-60); Object.keys(D).forEach(k=>{ if(k.split("|")[1]<cut) delete D[k]; });
    if(n){ ME.autoErr=""; if(typeof cloudSave==="function") cloudSave(true); if(typeof slToast==="function") slToast(`자동 문자 ${n}건을 솔라피에 예약했습니다.`); }
  }catch(e){} finally{ busy=false; draw(); } }

/* ---- 문자·카드 화면 ---- */
let OPEN=null, Q="";
function card(k){ const r=rules()[k], T=targets(k), nx=plan(60,k)[0];
  return `<button type="button" class="au-c${OPEN===k?" on":""}" data-auk="${k}"><span class="row between"><b>${TYPES[k].t}</b><span class="au-st ${r.on?"y":""}">${r.on?"켜짐":"꺼짐"}</span></span><span class="note">${TYPES[k].d} · 대상 ${T.length}명</span><span class="note">${nx?`다음: ${nx.d.slice(5).replace("-","/")}${nx.n?` (${nx.n})`:""}`:"60일 안 발송 없음"}</span></button>`; }
function editor(k){ const r=rules()[k], T=targets(k), P=plan(60,k), D=done(), sent=P.filter(x=>D[keyOf(x)]).length;
  const list=CUSTOMERS.filter(c=>!Q||c.name.includes(Q)||dg(c.phone).includes(dg(Q))).slice(0,200);
  const days={}; P.forEach(x=>{ (days[x.d]=days[x.d]||[]).push(x.c.name); });
  return `<div class="au-2"><div class="au-l">
    <label class="au-sw"><input type="checkbox" data-auf="on" ${r.on?"checked":""}> <b>${TYPES[k].t} 자동 문자 켜기</b></label>
    <div class="field"><label>보낼 대상</label><div class="row" style="gap:6px;flex-wrap:wrap">${[["all","전체 고객"],["관리","관리고객"],["가망","가망고객"],["pick","직접 고르기"]].map(([v,t])=>`<button type="button" class="btn sm${r.mode===v?" primary":""}" data-aumode="${v}">${t}</button>`).join("")}</div></div>
    <div class="au-pick"><div class="row between" style="gap:8px"><input id="au-q" placeholder="이름·전화번호 검색" value="${esc(Q)}" autocomplete="off" style="flex:1;min-width:0"><span class="note">${r.mode==="pick"?"체크한 고객만":"체크 해제하면 빼기"}</span></div>
      <div class="au-list">${list.map(c=>{ const inc=inMode(r,c), why=!okPhone(c)?"번호 없음":r.mkt&&!c.mkt?"광고 수신 미동의":""; return `<label class="${why?"off":""}"><input type="checkbox" data-auc="${c.id}" ${inc&&!why?"checked":""} ${why?"disabled":""}> ${esc(c.name)} <span class="note">${esc(c.type||"관리")}${k==="bday"?` · ${esc(String(c.birth||"").slice(5)||"생일 없음")}`:""}${why?` · ${why}`:""}</span></label>`; }).join("")||'<p class="note">고객이 없습니다.</p>'}</div></div>
    <label class="row note" style="gap:6px"><input type="checkbox" data-auf="mkt" ${r.mkt?"checked":""}> 광고 수신 동의 고객에게만 보내기 (권장)</label>
    <div class="field"><label for="au-time">보낼 시각</label><input id="au-time" type="time" value="${esc(r.time||"10:00")}" data-auf="time" style="max-width:140px"></div>
    ${OPEN==="expiry"?`<div class="field"><label for="au-days">만기 며칠 전에 보낼까요</label><input id="au-days" type="number" min="1" max="90" value="${esc(r.days||30)}" data-auf="days" style="max-width:120px"> <span class="note">자동차·화재·배상책임·기타 계약 (장기·운전자 제외) · 계약에 만기일이 있어야 합니다</span></div>`:""}
    ${OPEN==="excl"?`<p class="note" style="margin:0">고객 상세 › 보험계약의 '면책기간 종료일'·'감액기간 종료일'이 입력된 계약만 보냅니다.</p>`:""}
    ${OPEN==="anniv"?`<p class="note" style="margin:0">보험계약의 계약일(시작일)이 입력된 계약만 보냅니다.</p>`:""}
    <div class="field"><label for="au-text">문구 — {이름} 고객 이름 · {설계사} 내 이름${TYPES[OPEN].ct?" · {보험사} {상품} {날짜}"+(OPEN==="excl"?" {구분}(면책기간/감액기간)":""):""} 자동</label><textarea id="au-text" rows="4" data-auf="text">${esc(r.text)}</textarea><button class="lnk" type="button" data-audef="1">기본 문구로</button></div>
    </div><div class="au-r">
    <div class="au-ph"><div class="au-ph-in"><div class="au-ph-top"><span>${String(r.time||"10:00")}</span><span class="au-notch"></span><span>LTE ▮▮▮</span></div>
      <div class="au-ph-hd"><span class="au-av">${esc((ME.name||"나").slice(0,1))}</span><div><b>${esc(ME.sl&&ME.sl.sender||"내 휴대폰 번호")}</b><small>문자 메시지</small></div></div>
      <div class="au-ph-body"><div class="au-ph-day">${P[0]?esc(P[0].d.replace(/^(\d{4})-(\d\d)-(\d\d)$/,(m,y,mo,d)=>`${+mo}월 ${+d}일`)):"보낼 날"} ${esc(r.time||"10:00")}</div><div class="au-bub" id="au-pv">${esc(fill(r.text,P[0]?P[0].c:T[0],P[0]))}</div></div>
      <div class="au-ph-in2"><span>문자 메시지</span><b>↑</b></div></div></div>
    <p class="note" style="text-align:center;margin:6px 0 0">${P[0]?`${esc(P[0].c.name)}님 휴대폰에 이렇게 보입니다`:"고객 휴대폰에 이렇게 보입니다"}</p>
    <div class="au-sch"><b style="font-size:13px;display:block">앞으로 60일 발송 일정 (${T.length}명 대상)</b>
    <div class="au-days">${Object.keys(days).slice(0,12).map(d=>`<div><span class="num">${d.slice(5).replace("-","/")}</span> ${esc(days[d].slice(0,4).join(", "))}${days[d].length>4?` 외 ${days[d].length-4}명`:""}</div>`).join("")||'<p class="note" style="margin:0">60일 안에 보낼 일정이 없습니다.</p>'}</div>
    <p class="note" style="margin:10px 0 0">${!r.on?"꺼져 있습니다. 켜면 보잇이 14일 앞까지 솔라피에 예약해 둡니다.":typeof pbReady==="function"&&pbReady()?`솔라피 예약 완료 ${sent}건 · 보잇을 열 때마다 14일 앞까지 자동으로 예약합니다.`:"솔라피를 연결하고 발신번호를 정하면 예약이 시작됩니다."}</p>
    ${sent?`<p class="note" style="margin:4px 0 0">이미 예약된 건을 취소하려면 솔라피 [발송 내역 › 예약 발송]에서 취소하세요.</p>`:""}
    ${ME.autoErr?`<p class="note err" style="margin:4px 0 0">${esc(ME.autoErr)}</p>`:""}
    </div></div></div>`; }
function draw(){ const h=$("#auto-host"); if(!h) return; rules();
  h.innerHTML=`<p class="note" style="margin:0 0 8px">카드를 누르면 왼쪽에서 설정하고 오른쪽에서 미리 봅니다 · 켜 두면 보잇이 솔라피에 미리 예약해 두어 보잇을 안 열어도 나갑니다 (14일 앞까지)</p>
    <div class="au-cs">${Object.keys(TYPES).map(card).join("")}</div>
    ${OPEN?`<div class="au-ed">${editor(OPEN)}</div>`:""}`; }
function save(){ if(typeof cloudSave==="function") try{ cloudSave(true); }catch(_){} }
document.addEventListener("click",e=>{ const h=e.target.closest("#auto-host"); if(!h) return;
  const c=e.target.closest("[data-auk]"); if(c){ OPEN=OPEN===c.dataset.auk?null:c.dataset.auk; Q=""; draw(); return; }
  const m=e.target.closest("[data-aumode]"); if(m&&OPEN){ const r=rules()[OPEN]; if(m.dataset.aumode==="pick"&&r.mode!=="pick") r.ids=targets(OPEN).map(x=>x.id); r.mode=m.dataset.aumode; r.ex=[]; save(); draw(); return; }
  if(e.target.closest("[data-audef]")&&OPEN){ rules()[OPEN].text=TYPES[OPEN].def; save(); draw(); return; } });
document.addEventListener("change",e=>{ if(!e.target.closest("#auto-host")||!OPEN) return; const r=rules()[OPEN], t=e.target;
  if(t.dataset.auc){ toggle(r,+t.dataset.auc,t.checked); save(); draw(); return; }
  const f=t.dataset.auf; if(!f) return; r[f]=t.type==="checkbox"?t.checked:t.type==="number"?Math.max(1,Math.min(90,+t.value||30)):t.value; save(); draw(); if(f==="on"&&r.on) run(); });
document.addEventListener("input",e=>{ if(!e.target.closest("#auto-host")||!OPEN) return; const t=e.target;
  if(t.id==="au-q"){ Q=t.value.trim(); const p=t.selectionStart; draw(); const n=$("#au-q"); n.focus(); try{ n.setSelectionRange(p,p); }catch(_){} return; }
  if(t.id==="au-text"){ rules()[OPEN].text=t.value; const P=plan(60,OPEN), pv=$("#au-pv"); if(pv) pv.textContent=fill(t.value,P[0]?P[0].c:targets(OPEN)[0],P[0]); } });
function toggle(r,id,on){ r.ids=r.ids||[]; r.ex=r.ex||[];
  if(r.mode==="pick"){ r.ids=r.ids.filter(x=>x!==id); if(on) r.ids.push(id); }
  else { r.ex=r.ex.filter(x=>x!==id); if(!on) r.ex.push(id); } }

/* ---- 고객 상세: '자동 문자' 줄 ---- */
if(typeof renderCInfo==="function"){ const orig=renderCInfo; window.renderCInfo=renderCInfo=function(c){ orig.apply(this,arguments); const el=$("#cd-info"); if(!el||!c) return; const R=rules();
  el.insertAdjacentHTML("beforeend",`<dt>자동 문자</dt><dd><span class="row" style="gap:6px;flex-wrap:wrap">${Object.keys(TYPES).map(k=>{ const r=R[k], inc=inMode(r,c), why=!okPhone(c)?"번호 없음":r.mkt&&!c.mkt?"광고 수신 동의 필요":"";
    return `<button type="button" class="au-chip${inc&&!why?" on":""}${r.on?"":" mute"}" title="${r.on?"":"이 자동 문자는 꺼져 있습니다"}" data-aucust="${k}" data-id="${c.id}" ${why?`title="${why}"`:""}>${TYPES[k].t} ${why?`<small>(${why})</small>`:inc?"✓":""}</button>`; }).join("")}<span class="note">${Object.keys(TYPES).some(k=>R[k].on)?"":"자동 문자가 모두 꺼져 있습니다 — 문자·카드에서 켜세요"}</span></span></dd>`); }; }
document.addEventListener("click",e=>{ const b=e.target.closest("[data-aucust]"); if(!b) return; const c=CUSTOMERS.find(x=>x.id===+b.dataset.id), k=b.dataset.aucust, r=rules()[k]; if(!c) return;
  if(!okPhone(c)){ alert("휴대폰 번호가 있어야 자동 문자를 보낼 수 있습니다."); return; }
  if(r.mkt&&!c.mkt){ alert("이 자동 문자는 '광고 수신 동의' 고객에게만 보내도록 설정되어 있습니다. [정보 수정]에서 수신 동의를 체크하거나, 문자·카드 › 자동 발송에서 설정을 바꾸세요."); return; }
  toggle(r,c.id,!inMode(r,c)); save(); if(typeof renderCust==="function") renderCust(); draw(); });

/* ---- 저장·실행 ---- */
if(typeof cloudSnap==="function"){ const o=cloudSnap; window.cloudSnap=cloudSnap=function(){ const s=o.apply(this,arguments); if(s&&s.me){ s.me.autos=ME.autos||null; s.me.autoDone=ME.autoDone||{}; } return s; }; }
const css=document.createElement("style"); css.textContent=`
.au-cs{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}.au-c{display:flex;flex-direction:column;gap:3px;text-align:left;border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--surface);font:inherit;color:inherit;cursor:pointer}.au-c b{font-size:15px}.au-c.on{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 25%,transparent)}.au-c.dis{opacity:.55;cursor:default}
.au-st{font-size:12px;border-radius:99px;padding:1px 8px;background:#EEF0F2;color:#666}.au-st.y{background:#E3F4EA;color:#17713f}
.au-ed{margin-top:12px;border-top:1px solid var(--line);padding-top:12px}.au-2{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start}@media(max-width:900px){.au-2{grid-template-columns:1fr}}
.au-l{display:flex;flex-direction:column;gap:10px}.au-sw{display:flex;gap:8px;align-items:center;font-size:15px}.au-list{max-height:240px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:6px 10px;margin-top:6px;display:flex;flex-direction:column;gap:4px}.au-list label{display:flex;gap:6px;align-items:center;font-size:13.5px}.au-list label.off{opacity:.55}
.au-r{position:sticky;top:12px}.au-ph{width:270px;margin:0 auto;border-radius:38px;background:#1c1f24;padding:10px;box-shadow:0 10px 30px rgba(0,0,0,.18)}.au-ph-in{border-radius:30px;background:#fff;overflow:hidden;display:flex;flex-direction:column;min-height:460px}
.au-ph-top{display:flex;justify-content:space-between;align-items:center;padding:8px 18px 4px;font-size:11px;font-weight:700;color:#111}.au-notch{width:70px;height:18px;border-radius:12px;background:#1c1f24}
.au-ph-hd{display:flex;gap:8px;align-items:center;padding:6px 12px 8px;border-bottom:1px solid #eee}.au-ph-hd b{display:block;font-size:13px;color:#111}.au-ph-hd small{font-size:10.5px;color:#888}.au-av{width:30px;height:30px;border-radius:50%;background:#d9dee5;display:flex;align-items:center;justify-content:center;font-weight:700;color:#555;font-size:13px}
.au-ph-body{flex:1;background:#fff;padding:10px 10px 14px;display:flex;flex-direction:column;gap:6px}.au-ph-day{text-align:center;font-size:10.5px;color:#999}
.au-bub{align-self:flex-start;max-width:86%;background:#E9E9EB;color:#111;border-radius:16px 16px 16px 4px;padding:9px 11px;font-size:12.5px;line-height:1.55;white-space:pre-wrap;word-break:break-all}
.au-ph-in2{display:flex;justify-content:space-between;align-items:center;margin:0 10px 12px;border:1px solid #ddd;border-radius:18px;padding:6px 6px 6px 12px;font-size:11px;color:#aaa}.au-ph-in2 b{width:22px;height:22px;border-radius:50%;background:#ccc;color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px}
.au-sch{margin-top:14px;border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--surface)}
.au-days{margin-top:6px;font-size:13px;line-height:1.7;max-height:200px;overflow:auto}.au-days .num{display:inline-block;min-width:44px;font-weight:700}
.au-chip{border:1px solid var(--line);border-radius:99px;padding:3px 10px;background:var(--surface);font:inherit;font-size:13px;cursor:pointer;color:inherit}.au-chip.on{background:#E3F4EA;border-color:#9fd5b3;color:#17713f;font-weight:600}.au-chip small{color:#8a5a00}.au-chip.mute{opacity:.55}`;
document.head.appendChild(css);
new MutationObserver(()=>{ const h=$("#auto-host"); if(h&&!h.dataset.d){ h.dataset.d=1; draw(); } }).observe(document.body,{childList:true,subtree:true});
const t=setInterval(()=>{ if(typeof CLOUD!=="undefined"&&CLOUD.user&&CLOUD.last){ clearInterval(t); setTimeout(run,4000); } },3000);
setInterval(run,30*60e3);
document.addEventListener("click",e=>{ if(e.target.closest("[data-sv],[data-go=sms]")) setTimeout(draw,60); });
document.addEventListener("visibilitychange",()=>{ if(!document.hidden) setTimeout(run,2000); });
window.BOIT_AUTO={run,plan,draw};
})();
