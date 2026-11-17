/* 보잇 · 온라인 자동화 (2026-11-12)
   설계사 블로그·카페 운영을 돕는 자동화 모음. 지금 쓸 수 있는 것: 블로그 키워드 조사, 콘텐츠 계획, 글 만들기(AI 글·정보 이미지·실사 사진·심의번호·배너), 필수기재 배너.
   키워드 조사: n8n '보잇 키워드 조사 API' (POST boit-keyword {token, keywords[], related})
     - 월간 검색량: 네이버 검색광고 API (keywordstool)
     - 경쟁도: 네이버 API HUB 블로그 검색 상위 10개 중 제목에 키워드를 그대로 넣은 글 수, 상위글 나이(중앙값)
     - 검색 결과 글 본문은 저장하지 않고 AI에 넣지 않음 (NAVER API HUB 이용 조건)
   필수기재 배너: 설계사별 배너 이미지(일반·기업/리쿠르팅/개인 건강보험) 등록 → 글 끝에 붙일 때 이미지 복사/다운로드. ME.oa.banners {gen,rec,hlt} = {img:dataURL,name,at}
   저장: ME.oa = {last, plan[], banners} (app_state 클라우드 저장에 포함)
   원칙: 보험 관련 글은 광고 → 회사 준법감시 심의 후 게시 (금융소비자보호법 제22조). 심의번호 없는 글은 '발행'으로 바꿀 수 없음.
*/
(function(){
"use strict";
const $=s=>document.querySelector(s);
const E=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const td=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const fmt=n=>Number(n||0).toLocaleString("ko-KR");
const API="https://daonpartners.app.n8n.cloud/webhook/boit-keyword";
function D(){ try{ if(!ME.oa||typeof ME.oa!=="object") ME.oa={}; if(!Array.isArray(ME.oa.plan)) ME.oa.plan=[]; return ME.oa; }catch(e){ window.__OA=window.__OA||{plan:[]}; return window.__OA; } }
let TAB="plan", BUSY=false, GBUSY=false, FLT="todo";
const VC={"최적":"var(--ok)","가능":"var(--c2)","어려움":"var(--warn)","포화":"var(--bad)","허수":"var(--muted)"};
const ST=["예정","초안","심의중","발행"];
const TOPICS=["화재보험","배상책임보험","자동차보험","운전자보험","실손보험","암보험","간병인보험","치매보험","어린이보험","펫보험","보험금 청구","소상공인 보험"];
const FREQ=[["day","매일"],["wk5","평일"],["wk3","주 3회"],["wk1","주 1회"]];
const WD="일월화수목금토";

function root(){ return $("#oa-root"); }
function render(){
  const R=root(); if(!R) return;
  const todo=D().plan.filter(p=>p.st!=="발행").length;
  const T=[["plan","① 계획 만들기"],["do",`② 쓰고 발행 (${todo})`],["banner","필수기재 배너"]];
  const cur=TAB==="write"?"do":TAB;
  R.innerHTML=`<div class="tabs">${T.map(([k,t])=>`<button class="btn" type="button" data-oat="${k}" aria-pressed="${cur===k}">${t}</button>`).join("")}</div>
  <div class="oa-rule">보험 글은 광고 → <b>회사 심의 후 게시</b> (금융소비자보호법 제22조)</div>
  <div id="oa-body" style="margin-top:14px"></div>`;
  ({plan:vPlanMake,do:vDo,write:vWrite,banner:vBanner,more:vMore}[TAB]||vPlanMake)();
}
const ymdOf=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const md=s=>{ if(!s) return "날짜 없음"; const d=new Date(s+"T00:00:00"); return (d.getMonth()+1)+"/"+d.getDate()+"("+WD[d.getDay()]+")"; };
function GS(){ const o=D(); if(!o.gen||typeof o.gen!=="object") o.gen={}; const g=o.gen; if(!Array.isArray(g.topics)) g.topics=["화재보험","간병인보험"]; if(!g.weeks) g.weeks=2; if(!g.freq) g.freq="wk3"; if(!g.start){ const t=new Date(); t.setDate(t.getDate()+1); g.start=ymdOf(t); } if(g.custom==null) g.custom=""; return g; }
function genDates(g){ const out=[], s=new Date(g.start+"T00:00:00"); if(isNaN(s)) return out;
  for(let i=0;i<g.weeks*7;i++){ const d=new Date(s); d.setDate(s.getDate()+i); const w=d.getDay();
    if(g.freq==="day"||(g.freq==="wk5"&&w>0&&w<6)||(g.freq==="wk3"&&(w===1||w===3||w===5))||(g.freq==="wk1"&&w===1)) out.push(ymdOf(d)); }
  return out; }
function genTopics(g){ return [...new Set([...g.topics,...String(g.custom||"").split(/[,\n]+/).map(s=>s.trim()).filter(s=>s.length>=2)])].slice(0,6); }

/* ---------- 1. 계획 만들기 ---------- */
function vPlanMake(){
  const B=$("#oa-body"), g=GS(), ds=genDates(g), tp=genTopics(g);
  B.innerHTML=`<div class="panel">
    <h2 style="margin:0 0 10px">주제·기간 고르면 키워드와 날짜를 자동으로</h2>
    <div class="oa-lb">주제 <small class="note">여러 개</small></div>
    <div class="oa-chips">${TOPICS.map(t=>`<button type="button" class="oa-chip${g.topics.includes(t)?" on":""}" data-gt="${E(t)}">${E(t)}</button>`).join("")}</div>
    <input id="oa-gc" class="oa-in" maxlength="60" value="${E(g.custom)}" placeholder="직접 입력 (쉼표로) 예: 식당 화재보험, 학원 배상책임">
    <div class="oa-when">
      <div><div class="oa-lb">기간</div><div class="oa-chips">${[1,2,4].map(w=>`<button type="button" class="oa-chip${g.weeks===w?" on":""}" data-gw="${w}">${w}주</button>`).join("")}</div></div>
      <div><div class="oa-lb">글 올리는 날</div><div class="oa-chips">${FREQ.map(([k,t])=>`<button type="button" class="oa-chip${g.freq===k?" on":""}" data-gf="${k}">${t}</button>`).join("")}</div></div>
      <div><div class="oa-lb">시작일</div><input id="oa-gs" class="oa-in" type="date" value="${E(g.start)}" style="max-width:200px;margin:0"></div>
    </div>
    <p class="oa-sum">올릴 날 <b>${ds.length}일</b>${ds.length?` · ${md(ds[0])} ~ ${md(ds[ds.length-1])}`:""}${tp.length?` · 주제 ${tp.length}개`:""}</p>
    <button class="btn primary" type="button" id="oa-gen" style="width:100%" ${GBUSY||!tp.length?"disabled":""}>${GBUSY?"키워드 조사 중… (30초 안팎)":tp.length?"키워드 추천 받기":"주제를 고르면 키워드를 추천합니다"}</button>
    <p class="note" id="oa-gmsg" style="margin:8px 0 0"></p>
  </div>
  ${vCand(ds)}
  <details class="panel oa-more" style="margin-top:14px" ${D().last?"":""}><summary>키워드 직접 조사하기</summary><div id="oa-kwbox"></div></details>`;
  vKw();
}
async function genPlan(){
  if(GBUSY) return; const g=GS(), ds=genDates(g), tp=genTopics(g); const msg=t=>{ const m=$("#oa-gmsg"); if(m) m.textContent=t; };
  if(!tp.length||!ds.length) return;
  const t0=await tok(); if(!t0) return msg("보잇에 로그인해야 쓸 수 있습니다.");
  GBUSY=true; vPlanMake();
  const one=async topic=>{ try{ const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:t0,keywords:[topic],related:20})}); const j=JSON.parse(await r.text()); return j&&j.ok&&Array.isArray(j.rows)?j.rows:[]; }catch(e){ return []; } };
  const res=await Promise.all(tp.map(one));
  const have=new Set(D().plan.map(p=>p.keyword)), used=new Set(), O={"최적":0,"가능":1,"어려움":2};
  const pools=tp.map((topic,i)=>{ const cores=topic.split(/\s+/).map(s=>s.replace(/보험$/,"")).filter(s=>s.length>=2);
    return res[i].filter(r=>O[r.verdict]!=null&&!have.has(r.keyword)&&(r.type==="입력"||!cores.length||cores.some(c=>String(r.keyword).replace(/\s+/g,"").includes(c.replace(/\s+/g,"")))))
      .sort((a,b)=>O[a.verdict]-O[b.verdict]||b.search-a.search).map(r=>Object.assign({topic},r)); });
  // 주제별로 번갈아 좋은 순서로 줄 세움 → 올릴 날 수만큼 미리 체크. 고르기는 설계사가 함 (2026-11-17)
  const order=[]; let left=true;
  while(left){ left=false; for(const pool of pools){ while(pool.length){ const r=pool.shift(); if(!used.has(r.keyword)){ used.add(r.keyword); order.push(r); left=true; break; } } } }
  GBUSY=false;
  if(!order.length){ vPlanMake(); return msg(res.every(r=>!r.length)?"키워드를 가져오지 못했습니다. 잠시 후 다시 눌러 주세요.":"새로 넣을 만한 키워드가 없습니다. 주제를 바꾸거나 아래에 직접 넣어 주세요."); }
  const C=CAND(), mine=C.filter(c=>c.mine||c.from==="kw");
  D().cand=[...mine,...order.filter(r=>!mine.some(c=>c.keyword===r.keyword)).map(r=>({keyword:r.keyword,verdict:r.verdict,search:r.search,topic:r.topic,on:false}))];
  let need=Math.max(0,ds.length-D().cand.filter(c=>c.on).length); D().cand.forEach(c=>{ if(!c.on&&need>0&&!c.mine){ c.on=true; need--; } });
  vPlanMake(); msg(`추천 키워드 ${order.length}개 · 올릴 날 수(${ds.length}일)만큼 좋은 순서로 미리 체크했습니다. 체크를 바꾸거나 직접 넣은 뒤 [계획에 넣기]를 누르세요.`);
  const cb=$("#oa-cand"); if(cb) cb.scrollIntoView({behavior:"smooth",block:"start"});
}
/* ---------- 1-0. 키워드 고르기 (추천·조사·직접 입력 모두 여기 모아서 체크) ---------- */
function CAND(){ const o=D(); if(!Array.isArray(o.cand)) o.cand=[]; return o.cand; }
function candAdd(r,from){ const C=CAND(), k=String(r.keyword||"").trim().slice(0,30); if(k.length<2) return false; const ex=C.find(c=>c.keyword===k); if(ex){ ex.on=true; return false; }
  C.push({keyword:k,verdict:r.verdict||"",search:r.search||0,topic:r.topic||"",on:true,mine:from==="mine",from}); return true; }
function vCand(ds){
  const C=CAND(), on=C.filter(c=>c.on), have=new Set(D().plan.map(p=>p.keyword));
  const over=on.length-ds.length;
  return `<div class="panel" id="oa-cand" style="margin-top:14px">
    <div class="row between" style="gap:8px;flex-wrap:wrap"><h2 style="margin:0">키워드 고르기 <small class="note">${C.length?`${C.length}개 중 ${on.length}개 선택`:"추천을 받거나 직접 넣으세요"}</small></h2>
      ${C.length?`<div class="row" style="gap:6px"><button class="btn sm" type="button" data-oacs="best">최적·가능만</button><button class="btn sm" type="button" data-oacs="none">모두 해제</button><button class="btn sm" type="button" data-oacs="clear">목록 비우기</button></div>`:""}</div>
    <div class="row" style="gap:6px;margin-top:10px;flex-wrap:nowrap"><input id="oa-ck" class="oa-in" maxlength="60" placeholder="내 키워드 직접 넣기 (쉼표로 여러 개)" style="flex:1;min-width:0;margin:0"><button class="btn sm" type="button" id="oa-cadd" style="white-space:nowrap">넣기</button></div>
    ${C.length?`<div class="oa-kl" style="margin-top:10px">${C.map((c,i)=>`<label class="oa-kr oa-cr${c.on?" on":""}"><input type="checkbox" data-oacc="${i}" ${c.on?"checked":""}>
      <div style="flex:1;min-width:0"><b>${E(c.keyword)}</b> ${c.verdict?`<b style="color:${VC[c.verdict]||"inherit"}">${E(c.verdict)}</b>`:`<small class="note">${c.mine?"직접 입력":"미조사"}</small>`}${have.has(c.keyword)?` <small class="note">· 이미 계획에 있음</small>`:""}
      <small class="note">${c.search?`월 ${fmt(c.search)}회`:""}${c.topic?` · ${E(c.topic)}`:""}</small></div>
      <span class="row" style="gap:2px;flex-wrap:nowrap"><button class="btn sm" type="button" data-oacu="${i}" title="위로" ${i?"":"disabled"}>▲</button><button class="btn sm" type="button" data-oacx="${i}" title="목록에서 빼기">✕</button></span></label>`).join("")}</div>`:""}
    <p class="oa-sum" style="margin-top:10px">선택 <b>${on.length}개</b> · 올릴 날 <b>${ds.length}일</b>${on.length&&ds.length?` → 위에서부터 ${md(ds[0])}부터 순서대로 배정`:""}${over>0?` · 남는 ${over}개는 날짜 없이 넣음`:""}</p>
    <button class="btn primary" type="button" id="oa-cput" style="width:100%" ${on.length?"":"disabled"}>선택한 ${on.length}개 계획에 넣기</button>
    <p class="note" style="margin:6px 0 0">넣은 뒤에도 [② 쓰고 발행]에서 키워드·날짜를 하나씩 바꾸거나 지울 수 있습니다.</p>
  </div>`; }
function candPut(){ const ds=genDates(GS()), C=CAND(), on=C.filter(c=>c.on); let n=0, i=0, dup=0;
  const taken=new Set(D().plan.filter(p=>p.date).map(p=>p.date)), free=ds.filter(d=>!taken.has(d));
  for(const c of on){ if(D().plan.some(p=>p.keyword===c.keyword)){ dup++; continue; } addPlan(c); const p=D().plan[D().plan.length-1]; p.date=free[i++]||""; p.topic=c.topic||""; n++; }
  D().cand=C.filter(c=>!c.on);
  FLT="todo"; TAB="do"; render(); const m=$("#oa-dmsg"); if(m) m.textContent=`${n}편을 계획에 넣었습니다.`+(dup?` (이미 있는 키워드 ${dup}개는 뺐습니다)`:"")+(n>free.length?` 날짜가 모자라 ${n-free.length}편은 날짜 없이 넣었습니다.`:""); }

function keepKw(){ const op=!!($(".oa-more")&&$(".oa-more").open), y=window.scrollY; vPlanMake(); const d=$(".oa-more"); if(d&&op) d.open=true; window.scrollTo(0,y); }
/* ---------- 1-1. 키워드 직접 조사 ---------- */
function vKw(){
  const B=$("#oa-kwbox"); if(!B) return; const L=D().last;
  B.innerHTML=`<div style="margin-top:10px">
    <textarea id="oa-k" class="oa-ta" rows="3" maxlength="800" placeholder="키워드 한 줄에 하나 (최대 20개)">${E(L&&L.input||"")}</textarea>
    <div class="row" style="margin-top:8px;gap:8px;align-items:center;flex-wrap:wrap"><select id="oa-r" class="oa-in" style="width:auto">${[0,5,10,20].map(n=>`<option value="${n}" ${(L&&L.related===n)||(!L&&n===10)?"selected":""}>${n?"연관 "+n+"개 더":"입력한 것만"}</option>`).join("")}</select><button class="btn primary" type="button" id="oa-go" ${BUSY?"disabled":""}>${BUSY?"조사 중…":"조사하기"}</button><span class="note" id="oa-msg"></span></div>
  </div><div id="oa-res"></div>`;
  if(L&&Array.isArray(L.rows)) vRes(L);
}
function vRes(L){
  const R=$("#oa-res"); if(!R) return;
  const inPlan=k=>D().plan.some(p=>p.keyword===k)||CAND().some(c=>c.keyword===k&&c.on);
  R.innerHTML=`<div class="row between" style="margin-top:14px;gap:8px;flex-wrap:wrap"><b>결과 <small class="note">${E((L.at||"").slice(0,10))} · ${L.rows.length}개</small></b><button class="btn sm" type="button" id="oa-addall">최적·가능 모두 고르기</button></div>
    <div class="oa-kl">${L.rows.map((r,i)=>`<div class="oa-kr"><div><b>${E(r.keyword)}</b> <b style="color:${VC[r.verdict]||"inherit"}">${E(r.verdict)}</b><small class="note">월 ${fmt(r.search)}회 · 상위10 제목일치 ${r.hits} · 상위글 ${fmt(r.age)}일</small></div>
      ${inPlan(r.keyword)?`<span class="note">고름</span>`:`<button class="btn sm" type="button" data-oaadd="${i}">고르기</button>`}</div>`).join("")}</div>
    <details class="oa-help" style="margin-top:10px"><summary>판정 기준</summary>
      <ul><li><b>최적</b>: 상위 10개 중 제목에 키워드 그대로 0~3개, 월 검색 100↑</li><li><b>가능</b> 4~6개 · <b>어려움</b> 7~8개 · <b>포화</b> 9~10개 · <b>허수</b> 월 검색 20↓</li></ul></details>`;
}
async function runKw(){
  if(BUSY) return;
  const raw=($("#oa-k")||{}).value||"", rel=parseInt(($("#oa-r")||{}).value,10)||0;
  const kws=[...new Set(raw.split(/[\n,]+/).map(s=>s.trim()).filter(s=>s.length>=2))].slice(0,20);
  const msg=t=>{ const m=$("#oa-msg"); if(m) m.textContent=t; };
  if(!kws.length) return msg("키워드를 한 개 이상 입력하세요.");
  const t0=await tok(); if(!t0) return msg("보잇에 로그인해야 쓸 수 있습니다.");
  BUSY=true; vKw(); $("#oa-k").value=raw;
  let r;
  try{ const res=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:t0,keywords:kws,related:rel})});
    const t=await res.text(); try{ r=JSON.parse(t); }catch(e){ r={ok:false,error:"서버 응답을 읽지 못했습니다. ("+res.status+") 잠시 후 다시 눌러 주세요."}; } }
  catch(e){ r={ok:false,error:"연결에 실패했습니다. 인터넷 연결을 확인해 주세요."}; }
  BUSY=false;
  if(r&&r.ok&&Array.isArray(r.rows)){ D().last={input:raw,related:rel,at:r.at||new Date().toISOString(),rows:r.rows}; vKw(); }
  else { vKw(); $("#oa-k").value=raw; msg((r&&r.error)||"조사하지 못했습니다."); }
}
function addPlan(r){ const P=D().plan; if(P.some(p=>p.keyword===r.keyword)) return false;
  P.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),keyword:r.keyword,verdict:r.verdict,search:r.search,ch:"블로그",date:"",st:"예정",no:"",url:"",memo:"",added:td()}); return true; }

/* ---------- 2. 쓰고 발행 ---------- */
function vDo(){
  const B=$("#oa-body"), P=D().plan;
  P.sort((a,b)=>String(a.date||"9").localeCompare(String(b.date||"9")));
  const L=P.filter(p=>FLT==="all"||(FLT==="done"?p.st==="발행":p.st!=="발행"));
  const today=td();
  const act=p=>{ if(p.st==="발행") return p.url?`<a class="btn sm" href="${E(p.url)}" target="_blank" rel="noopener">글 열기</a>`:`<button class="btn sm" type="button" data-oaurl="${p.id}">주소 넣기</button>`;
    if(p.st==="심의중") return `<button class="btn sm primary" type="button" data-oaw="${p.id}">심의번호 넣고 발행</button>`;
    if(p.st==="초안") return `<button class="btn sm primary" type="button" data-oaw="${p.id}">글 이어서</button>`;
    return `<button class="btn sm primary" type="button" data-oaw="${p.id}">글 쓰기</button>`; };
  const stp=p=>{ const i=ST.indexOf(p.st); return `<div class="oa-prog">${["글쓰기","심의","발행"].map((t,j)=>`<span class="${i>j||(j===2&&i===3)?"on":""}">${t}</span>`).join("")}</div>`; };
  B.innerHTML=`<div class="row between" style="gap:8px;flex-wrap:wrap"><div class="oa-chips" style="margin:0">${[["todo","할 일"],["done","발행 완료"],["all","전체"]].map(([k,t])=>`<button type="button" class="oa-chip${FLT===k?" on":""}" data-oaf="${k}">${t} ${k==="todo"?P.filter(p=>p.st!=="발행").length:k==="done"?P.filter(p=>p.st==="발행").length:P.length}</button>`).join("")}</div>
    <div class="row" style="gap:6px"><input id="oa-nk" class="oa-in" placeholder="키워드 직접 추가" maxlength="30" style="width:150px"><button class="btn sm" type="button" id="oa-nadd">추가</button></div></div>
  <p class="note" id="oa-dmsg" style="margin:8px 0 0"></p>
  ${L.length?`<div class="oa-cards">${L.map(p=>`<div class="oa-pc${p.date&&p.date<today&&p.st!=="발행"?" late":""}" data-oap="${p.id}">
      <div class="oa-pt"><span class="d">${md(p.date)}</span><b>${E(p.keyword)}</b>${p.verdict?`<small style="color:${VC[p.verdict]||"inherit"}">${E(p.verdict)}</small>`:""}</div>
      ${stp(p)}
      <div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap">${act(p)}</div>
      <details class="oa-pd"><summary>키워드·날짜·심의번호·주소 바꾸기</summary><div class="oa-pf">
        <label>키워드<input data-f="keyword" value="${E(p.keyword)}" maxlength="30"></label>
        <label>올릴 날<input type="date" data-f="date" value="${E(p.date)}"></label>
        <label>채널<select data-f="ch">${["블로그","카페"].map(c=>`<option ${p.ch===c?"selected":""}>${c}</option>`).join("")}</select></label>
        <label>심의번호<input data-f="no" value="${E(p.no)}" placeholder="예) 2026-0806" maxlength="30"></label>
        <label>올린 글 주소 <small class="note">기록용</small><input data-f="url" value="${E(p.url)}" placeholder="https://blog.naver.com/…" maxlength="300"></label>
        <label>상태<select data-f="st">${ST.map(s=>`<option ${p.st===s?"selected":""}>${s}</option>`).join("")}</select></label>
        <label>글 끝 배너<span class="row" style="gap:4px;flex-wrap:nowrap"><select data-f="bn">${BN.map(([k,t])=>`<option value="${k}" ${((p.bn==="kid"?"hlt":p.bn)||"gen")===k?"selected":""}>${t}</option>`).join("")}</select><button class="btn sm" type="button" data-oabc="${E(p.bn||"gen")}">복사</button></span></label>
      </div><button class="btn sm" type="button" data-oadel="${p.id}" style="margin-top:8px">계획에서 삭제</button></details>
    </div>`).join("")}</div>`:`<div class="panel" style="margin-top:12px;text-align:center"><p class="note" style="margin:0 0 10px">${FLT==="done"?"발행한 글이 아직 없습니다.":"할 일이 없습니다."}</p><button class="btn primary" type="button" data-oat="plan">계획 만들기</button></div>`}`;
}

/* ---------- 3. 내 필수기재 배너 ---------- */
const BN=[["gen","일반·기업"],["rec","리쿠르팅"],["hlt","개인 건강보험"]];
const BNAME=k=>(BN.find(x=>x[0]===k)||BN[0])[1];
function BNS(){ const o=D(); if(!o.banners||typeof o.banners!=="object") o.banners={}; const b=o.banners; if(b.kid&&!b.hlt){ b.hlt=b.kid; } delete b.kid; return b; }
/* 고른 배너가 없으면 등록된 다른 배너를 씀 (하나만 올려도 모든 글에 사용) */
function BIMG(k){ const S=BNS(); k=k==="kid"?"hlt":(k||"gen"); if(S[k]&&S[k].img) return S[k]; for(const [x] of BN) if(S[x]&&S[x].img) return S[x]; return null; }
function vBanner(){
  const B=$("#oa-body"), S=BNS();
  B.innerHTML=`<div class="panel">
    <h2 style="margin:0 0 4px">내 필수기재 배너</h2>
    <p class="note" style="margin:0 0 12px">회사에서 받은 배너 이미지 등록 · 하나만 올리면 모든 글에 같은 배너 사용</p>
    <div class="oa-bgrid">${BN.map(([k,t])=>{ const b=S[k]; return `<div class="oa-bslot">
      <b>${t}</b>
      ${b&&b.img?`<img src="${b.img}" alt="${E(t)} 필수기재 배너"><small class="note">${E(b.name||"")} · ${E(b.at||"")}</small>
        <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm primary" type="button" data-oabc="${k}">이미지 복사</button><button class="btn sm" type="button" data-oabd="${k}">내려받기</button><label class="btn sm" style="cursor:pointer">바꾸기<input type="file" accept="image/png,image/jpeg,image/webp" data-oabu="${k}" hidden></label><button class="btn sm" type="button" data-oabx="${k}">삭제</button></div>`
      :`<label class="oa-bdrop">이미지 올리기 (PNG·JPG)<input type="file" accept="image/png,image/jpeg,image/webp" data-oabu="${k}" hidden></label>`}
    </div>`; }).join("")}</div>
    <span class="note" id="oa-bmsg"></span>
    <details class="oa-help" style="margin-top:12px"><summary>네이버 글에 붙이는 방법</summary>
      <ul><li>글 작성이 끝나면 <b>이미지 복사</b>를 누른 뒤, 네이버 글쓰기 화면 맨 끝을 클릭하고 <b>Ctrl+V</b>(휴대폰은 길게 눌러 붙여넣기)를 누르세요.</li>
      <li>붙여넣기가 안 되면 <b>내려받기</b>로 저장한 뒤 네이버 글쓰기의 사진 버튼으로 올리세요.</li>
      <li><b>② 쓰고 발행</b> 카드의 [날짜·심의번호·주소]에서 글마다 배너를 고르고 복사할 수 있습니다.</li></ul></details>
  </div>`;
}
function loadImg(file){ return new Promise((ok,no)=>{ if(!file||!/^image\//.test(file.type)) return no(new Error("이미지 파일만 올릴 수 있습니다."));
  if(file.size>8*1024*1024) return no(new Error("8MB 이하 이미지만 올릴 수 있습니다."));
  const rd=new FileReader(); rd.onload=()=>{ const im=new Image(); im.onload=()=>{
      const W=Math.min(1200,im.naturalWidth), H=Math.round(im.naturalHeight*W/im.naturalWidth);
      const c=document.createElement("canvas"); c.width=W; c.height=H; const g=c.getContext("2d"); g.fillStyle="#fff"; g.fillRect(0,0,W,H); g.drawImage(im,0,0,W,H);
      let u=c.toDataURL("image/png"); if(u.length>900000) u=c.toDataURL("image/jpeg",0.92); if(u.length>1400000) u=c.toDataURL("image/jpeg",0.8);
      ok(u); }; im.onerror=()=>no(new Error("이미지를 읽지 못했습니다.")); im.src=rd.result; };
  rd.onerror=()=>no(new Error("파일을 읽지 못했습니다.")); rd.readAsDataURL(file); }); }
function toPng(u){ return new Promise((ok,no)=>{ const im=new Image(); im.onload=()=>{ const c=document.createElement("canvas"); c.width=im.naturalWidth; c.height=im.naturalHeight; c.getContext("2d").drawImage(im,0,0); c.toBlob(b=>b?ok(b):no(new Error("변환 실패")),"image/png"); }; im.onerror=()=>no(new Error("이미지 오류")); im.src=u; }); }
async function copyBanner(k,btn){
  const b=BIMG(k); if(!b){ alert("먼저 '내 필수기재 배너'에서 배너 이미지를 올려 주세요."); TAB="banner"; render(); return; }
  try{ if(!navigator.clipboard||!window.ClipboardItem) throw new Error("x"); const blob=await toPng(b.img); await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]);
    const o=btn.textContent; btn.textContent="복사됨 — 글 끝에 붙여넣기"; setTimeout(()=>btn.textContent=o,1800); }
  catch(e){ if(confirm("이 브라우저에서는 이미지 복사가 안 됩니다. 내려받아서 사진으로 올릴까요?")) dlBanner(k); }
}
function dlBanner(k){ const b=BIMG(k); if(!b) return; const a=document.createElement("a"); a.href=b.img; a.download="필수기재배너_"+BNAME(k).replace(/·/g,"")+(b.img.indexOf("image/png")>0?".png":".jpg"); document.body.appendChild(a); a.click(); a.remove(); }
window.OA_BANNER=k=>{ const b=BIMG(k); return b&&b.img||""; };

/* ---------- 3-1. 글 만들기 (AI 보험 블로그 글 + 정보 이미지 + 실사 사진) ----------
   흐름: 주제·스타일 → AI 글·이미지 생성 → 심의용 복사 → 심의번호 입력 → 하단 배너 붙여 최종글 복사
   서버: n8n '보잇 보험 블로그 글 AI' (POST boit-blog-write {token, action write|photo}) · 설계사별 하루 글 5편·사진 12장
   저장: ME.oa.posts[] (글·이미지 설계만, 최근 30편) / AI 사진은 이 기기 IndexedDB(boit-oa) — 다른 기기에서는 다시 만들어야 함
   원칙: 이미지 안에 회사·지점·상품명 넣지 않음. 심의번호 없이는 최종글 복사 불가. */
const WAPI="https://daonpartners.app.n8n.cloud/webhook/boit-blog-write";
const GENS=["여성","남성"];
const TYPES=[["전문형","약관·제도 근거 해설"],["상담사례형","상담에서 자주 받는 질문 중심"],["강의형","단계별로 가르치듯"],["친근형","이웃에게 말하듯 쉽게"],["뉴스해설형","제도 변경·발표 풀이"]];
const THEMES={navy:["네이비","#1f3a68","#2c5aa0","#f08a24","#f3f6fb"],green:["그린","#1d5c4a","#2f8a6c","#f2b134","#eef7f2"],coral:["코랄","#a8474a","#df7a68","#ffcf66","#fdf1ee"],purple:["퍼플","#4b3a8c","#7a5cc8","#ffb547","#f4f1fb"],pink:["로즈","#a3445f","#d9789a","#ffd27a","#fcf0f4"],brown:["브라운","#5e4634","#9a7655","#e7b765","#f8f3ec"],charcoal:["차콜","#262a31","#4a515c","#e9b44c","#f2f3f5"]};
const DISC="※ 이 글은 보험설계사(모집종사자)의 개인 의견이며, 구체적인 보장 내용은 해당 상품의 약관과 상품설명서를 반드시 확인하시기 바랍니다.";
let WCUR=null, WBUSY=false, PHB={};
function POSTS(){ const o=D(); if(!Array.isArray(o.posts)) o.posts=[]; return o.posts; }
function curPost(){ return POSTS().find(p=>p.id===WCUR)||null; }
/* IndexedDB (사진) */
const IDB={db:null,open(){ if(this.db) return Promise.resolve(this.db); return new Promise((ok,no)=>{ try{ const r=indexedDB.open("boit-oa",1); r.onupgradeneeded=()=>r.result.createObjectStore("ph"); r.onsuccess=()=>{ this.db=r.result; ok(this.db); }; r.onerror=()=>no(r.error); }catch(e){ no(e); } }); },
  put(k,v){ return this.open().then(db=>new Promise(ok=>{ const t=db.transaction("ph","readwrite"); t.objectStore("ph").put(v,k); t.oncomplete=()=>ok(true); t.onerror=()=>ok(false); })).catch(()=>false); },
  get(k){ return this.open().then(db=>new Promise(ok=>{ const r=db.transaction("ph").objectStore("ph").get(k); r.onsuccess=()=>ok(r.result||null); r.onerror=()=>ok(null); })).catch(()=>null); },
  del(k){ return this.open().then(db=>{ db.transaction("ph","readwrite").objectStore("ph").delete(k); }).catch(()=>{}); } };
async function loadPhotos(p){ if(!p||!p.out) return; for(let n=1;n<=(p.out.photos||[]).length;n++){ const k=p.id+"_"+n; if(!PHB[k]){ const v=await IDB.get(k); if(v) PHB[k]=v; } } }

/* 정보 이미지 (캔버스) — 회사명 없음, 색상 테마 */
const CF='Pretendard,"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
function wl(x,t,w){ const out=[]; String(t||"").split("\n").forEach(par=>{ let cur=""; Array.from(par).forEach(ch=>{ const s=cur+ch; if(x.measureText(s).width>w&&cur){ const sp=cur.lastIndexOf(" "); if(sp>0&&cur.length-sp<10){ out.push(cur.slice(0,sp)); cur=cur.slice(sp+1)+ch; } else { out.push(cur); cur=ch; } } else cur=s; }); out.push(cur); }); return out; }
function dt(x,t,X,Y,w,lh,max){ let ls=wl(x,t,w); if(max&&ls.length>max){ ls=ls.slice(0,max); ls[max-1]=ls[max-1].slice(0,-1)+"…"; } ls.forEach((l,i)=>x.fillText(l,X,Y+i*lh)); return ls.length*lh; }
function rr(x,X,Y,w,h,r){ x.beginPath(); x.moveTo(X+r,Y); x.arcTo(X+w,Y,X+w,Y+h,r); x.arcTo(X+w,Y+h,X,Y+h,r); x.arcTo(X,Y+h,X,Y,r); x.arcTo(X,Y,X+w,Y,r); x.closePath(); }
function card(spec,th){ const T=THEMES[th]||THEMES.navy, A=T[1],B=T[2],O=T[3],S=T[4], INK="#1b2333", MU="#5b6577";
  const c=document.createElement("canvas"); c.width=1080; c.height=1080; const x=c.getContext("2d"); const k=spec.kind; const it=(spec.items||[]).slice(0,6);
  if(k==="thumb"||k==="cta"){ const g=x.createLinearGradient(0,0,1080,1080); g.addColorStop(0,A); g.addColorStop(1,B); x.fillStyle=g; x.fillRect(0,0,1080,1080);
    x.fillStyle="rgba(255,255,255,.07)"; x.beginPath(); x.arc(930,170,260,0,7); x.fill(); x.beginPath(); x.arc(120,980,180,0,7); x.fill();
    if(spec.label){ x.fillStyle=O; x.font="700 34px "+CF; x.fillText(spec.label,80,250); }
    x.fillStyle=O; x.fillRect(80,290,120,12);
    x.fillStyle="#fff"; x.font="800 "+(k==="thumb"?80:68)+"px "+CF; let y=420+dt(x,spec.title,80,420,920,k==="thumb"?100:86,4)+16;
    if(spec.sub){ x.fillStyle="rgba(255,255,255,.88)"; x.font="500 38px "+CF; y+=dt(x,spec.sub,80,y,920,54,3)+18; }
    if(k==="cta"&&it.length){ x.font="600 34px "+CF; it.slice(0,3).forEach(s=>{ x.fillStyle="rgba(255,255,255,.15)"; rr(x,80,y,920,76,38); x.fill(); x.fillStyle="#fff"; x.fillText("✓  "+s,116,y+50); y+=96; }); }
    return c; }
  x.fillStyle="#fff"; x.fillRect(0,0,1080,1080); x.fillStyle=A; x.fillRect(0,0,1080,230); x.fillStyle=O; x.fillRect(0,230,1080,10);
  x.fillStyle="#fff"; x.font="800 54px "+CF; dt(x,spec.title,80,125,920,66,2);
  const top=300;
  if(k==="checklist"){ const gap=Math.min(150,Math.floor(700/Math.max(it.length,1)));
    it.forEach((s,i)=>{ const y=top+i*gap, h=gap-20, cy=y+h/2; x.fillStyle=S; rr(x,80,y,920,h,18); x.fill(); x.fillStyle=O; x.beginPath(); x.arc(135,cy,26,0,7); x.fill();
      x.strokeStyle="#fff"; x.lineWidth=6; x.lineCap="round"; x.beginPath(); x.moveTo(123,cy+1); x.lineTo(132,cy+11); x.lineTo(149,cy-10); x.stroke();
      x.fillStyle=INK; x.font="600 36px "+CF; dt(x,s,185,cy+13,790,42,1); }); }
  else if(k==="steps"){ const g=Math.min(165,Math.floor(690/Math.max(it.length,1)));
    x.strokeStyle="#e3e8f0"; x.lineWidth=6; x.beginPath(); x.moveTo(130,top+30); x.lineTo(130,top+30+(it.length-1)*g); x.stroke();
    it.forEach((s,i)=>{ const y=top+i*g; x.fillStyle=i===it.length-1?O:A; x.beginPath(); x.arc(130,y+30,32,0,7); x.fill(); x.fillStyle="#fff"; x.font="800 32px "+CF; x.textAlign="center"; x.fillText(String(i+1),130,y+41); x.textAlign="left";
      const pr=String(s).split(/\s+[—-]\s+/); x.fillStyle=INK; x.font="700 36px "+CF; x.fillText(pr[0],190,y+32); if(pr[1]){ x.fillStyle=MU; x.font="400 29px "+CF; dt(x,pr[1],190,y+74,820,36,1); } }); }
  else if(k==="compare"){ [spec.left||{},spec.right||{}].forEach((col,ci)=>{ const cx=80+ci*470, cc=ci?O:A;
      x.fillStyle=cc; rr(x,cx,top,450,92,18); x.fill(); x.fillStyle="#fff"; x.font="700 36px "+CF; x.textAlign="center"; x.fillText(col.title||"",cx+225,top+59); x.textAlign="left";
      x.fillStyle=S; rr(x,cx,top+112,450,600,18); x.fill(); let y=top+180; x.fillStyle=INK; x.font="500 32px "+CF; (col.items||[]).slice(0,5).forEach(s=>{ y+=dt(x,"· "+s,cx+30,y,390,42,2)+30; }); }); }
  else { it.slice(0,4).forEach((s,i)=>{ const cx=80+(i%2)*470, cy=top+Math.floor(i/2)*350, pr=String(s).split(/\s+[—-]\s+/);
      x.fillStyle=S; rr(x,cx,cy,450,330,22); x.fill(); x.fillStyle=O; x.fillRect(cx+30,cy+40,60,8);
      x.fillStyle=A; x.font="800 37px "+CF; const hh=dt(x,pr[0],cx+30,cy+108,390,46,2); if(pr[1]){ x.fillStyle=INK; x.font="400 29px "+CF; dt(x,pr[1],cx+30,cy+108+hh+16,390,40,3); } }); }
  return c; }
function cardURL(p,n){ const s=(p.out.images||[])[n-1]; return s?card(s,p.style.theme).toDataURL("image/png"):""; }

/* 화면 */
function vWrite(){
  const B=$("#oa-body"), p=curPost(), L=POSTS();
  const pre=window.__OAKW||{}; window.__OAKW=null;
  const st=(p&&p.style)||D().wstyle||{gender:"여성",type:"전문형",theme:"navy"};
  const chip=(f,v,t,on)=>`<button type="button" class="oa-chip${on?" on":""}" data-ws="${f}" data-v="${E(v)}">${t}</button>`;
  B.innerHTML=`<div class="panel">
    <div class="row between" style="gap:8px;margin-bottom:8px"><h2 style="margin:0">글 만들기 <small class="note">하루 5편</small></h2><button class="btn sm" type="button" id="ow-back">← 목록</button></div>
    <div class="oa-steps"><span class="${!p||!p.out?"on":""}">① 주제·스타일</span><span class="${p&&p.out&&p.st==="초안"?"on":""}">② 글·이미지 확인</span><span class="${p&&p.st==="심의중"?"on":""}">③ 심의</span><span class="${p&&p.st==="완료"?"on":""}">④ 최종글 복사</span></div>
    <div class="oa-wgrid">
      <label>주제 키워드 <small class="note">(필수)</small><input id="ow-kw" maxlength="30" value="${E(p?p.kw:(pre.kw||""))}" placeholder="예) 70대 간병인보험"></label>
      <label>보조 키워드 <small class="note">(쉼표로)</small><input id="ow-kw2" maxlength="120" value="${E(p?p.kw2:"")}" placeholder="예) 간병인 비용, 간병보험 가입 나이"></label>
      <label style="grid-column:1/-1">내가 확인한 사실·강조할 점 <small class="note">(선택 · 적은 내용만 사실로 씁니다)</small><textarea id="ow-facts" class="oa-ta" rows="2" maxlength="1500" placeholder="예) 상담 오면 간병인 사용일당과 간병비 실손을 헷갈려하는 분이 많음">${E(p?p.facts:"")}</textarea></label>
      <label>주요 독자 <small class="note">(선택)</small><input id="ow-tg" maxlength="120" value="${E(p?p.target:"")}" placeholder="예) 부모님 간병이 걱정되는 40~50대 자녀"></label>
    </div>
    <div class="oa-srow"><b>설계사</b>${GENS.map(g=>chip("gender",g,g+" 설계사",st.gender===g)).join("")}</div>
    <div class="oa-srow"><b>글 유형</b>${TYPES.map(([t,d])=>chip("type",t,`${t} <small>${d}</small>`,st.type===t)).join("")}</div>
    <div class="oa-srow"><b>이미지 색상</b>${Object.entries(THEMES).map(([k,v])=>`<button type="button" class="oa-sw${st.theme===k?" on":""}" data-ws="theme" data-v="${k}" title="${v[0]}" style="--a:${v[1]};--b:${v[2]};--o:${v[3]}"><i></i>${v[0]}</button>`).join("")}</div>
    <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn primary" type="button" id="ow-go" ${WBUSY?"disabled":""}>${WBUSY?"글 쓰는 중… (1분 안팎)":(p&&p.out?"이 설정으로 다시 쓰기":"글 만들기")}</button>${p?`<button class="btn" type="button" id="ow-new">새 글</button>`:""}<span class="note" id="ow-msg"></span></div>
  </div>
  ${p&&p.out?vPost(p):""}
  ${L.length?`<div class="panel" style="margin-top:14px"><h2 style="margin:0 0 8px">내가 만든 글 <small class="note">${L.length}편</small></h2><div class="oa-kl">
    ${L.slice().reverse().map(x=>`<div class="oa-kr"><div><b>${E((x.out&&x.out.title)||x.kw)}</b><small class="note">${E(x.at)} · ${E(x.st)}${x.no?" · 심의 "+E(x.no):""}</small></div><span class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm" type="button" data-owo="${x.id}">${x.id===WCUR?"보는 중":"열기"}</button><button class="btn sm" type="button" data-owd="${x.id}">삭제</button></span></div>`).join("")}
  </div></div>`:""}`;
  if(p&&p.out){ drawPost(p); loadPhotos(p).then(()=>{ if(TAB==="write"&&WCUR===p.id) drawPost(p); }); }
}
function vPost(p){
  const o=p.out, bn=BNS();
  return `<div class="panel" style="margin-top:14px">
    ${(o.warn||[]).length?`<div class="oa-rule" style="margin:0 0 10px">${o.warn.map(E).join("<br>")}</div>`:""}
    <div class="row between" style="flex-wrap:wrap;gap:8px"><h2 style="margin:0">② 글·이미지 확인</h2><small class="note">본문 ${fmt(o.stat&&o.stat.chars)}자 · 키워드 ${o.stat&&o.stat.kwCount||0}회 · ${E(p.style.gender)} · ${E(p.style.type)} · ${E((THEMES[p.style.theme]||THEMES.navy)[0])}</small></div>
    <label style="display:block;margin-top:10px">제목<input id="ow-title" value="${E(o.title)}" maxlength="80" style="width:100%"></label>
    ${(o.titles_alt||[]).length?`<small class="note">다른 제목: ${o.titles_alt.map(E).join(" / ")}</small>`:""}
    <p class="note" style="margin:10px 0 0">본문은 바로 고칠 수 있습니다(문단을 눌러 수정). 고친 내용은 자동 저장됩니다.</p>
    <div class="oa-post" id="ow-body"></div>
    ${(o.tags||[]).length?`<p class="note">태그: ${o.tags.map(t=>"#"+E(t)).join(" ")}</p>`:""}
    ${(o.checklist||[]).length?`<details class="oa-help" open><summary>심의 전에 확인할 것</summary><ul>${o.checklist.map(c=>`<li>${E(c)}</li>`).join("")}</ul></details>`:""}
    <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="btn" type="button" data-owc="review">심의용 원고 복사</button>
      <button class="btn" type="button" id="ow-dlall">이미지 전체 받기</button>
      ${p.st==="초안"?`<button class="btn primary" type="button" data-owst="심의중">심의 올렸음</button>`:""}
    </div>
  </div>
  <div class="panel" style="margin-top:14px;${p.st==="초안"?"opacity:.55":""}">
    <h2 style="margin:0 0 4px">③ 심의번호 · ④ 최종글</h2>
    <p class="note" style="margin:0 0 10px">심의번호 입력 → 심의필 문구·배너가 붙은 최종글 복사 · 심의 후 수정 금지</p>
    <div class="oa-wgrid">
      <label>심의번호<input id="ow-no" value="${E(p.no||"")}" maxlength="40" placeholder="예) 준법감시인 심의필 제2026-1234호"></label>
      <label>심의필 문구 <small class="note">(회사 양식대로)</small><input id="ow-notxt" value="${E(p.noText||"")}" maxlength="160" placeholder="예) 준법감시인 심의필 제2026-1234호 (2026.11.13~2027.11.12)"></label>
      <label>필수기재 배너<select id="ow-bn">${BN.map(([k,t])=>`<option value="${k}" ${((p.bn==="kid"?"hlt":p.bn)||"gen")===k?"selected":""}>${t}${bn[k]&&bn[k].img?"":BIMG(k)?"":" (미등록)"}</option>`).join("")}</select></label>
    </div>
    <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="btn primary" type="button" data-owc="final">최종글 복사 (이미지 포함)</button>
      <button class="btn" type="button" data-owc="text">본문만 복사</button>
      <button class="btn" type="button" data-owc="title">제목 복사</button>
      <span class="note" id="ow-cmsg"></span>
    </div>
    <details class="oa-help" style="margin-top:10px"><summary>네이버 블로그에 붙이는 방법</summary><ul>
      <li>네이버 글쓰기에서 제목 칸에 <b>제목 복사</b>를 붙이고, 본문 칸을 누른 뒤 <b>최종글 복사</b> → Ctrl+V.</li>
      <li>이미지가 함께 안 붙으면 <b>본문만 복사</b>로 붙인 뒤 <b>이미지 전체 받기</b>로 받은 파일을 [이미지 N]·[사진 N] 자리에 올리세요. 필수기재 배너는 <b>내 필수기재 배너</b>에서 복사.</li>
      <li>AI 사진은 이 기기에만 저장됩니다. 다른 기기에서는 사진을 다시 만들어야 합니다.</li></ul></details>
  </div>`;
}
function drawPost(p){
  const W=$("#ow-body"); if(!W) return; const o=p.out;
  W.innerHTML="";
  o.blocks.forEach((b,i)=>{
    if(b.t==="h"||b.t==="p"){ const e=document.createElement(b.t==="h"?"h3":"p"); e.textContent=b.text; e.contentEditable=p.st==="초안"?"true":"false"; e.dataset.owb=i; W.appendChild(e); }
    else if(b.t==="table"){ const w=document.createElement("div"); w.innerHTML=`${b.caption?`<div class="oa-cap">${E(b.caption)}</div>`:""}<table class="oa-pt"><tr>${(b.head||[]).map(h=>`<th>${E(h)}</th>`).join("")}</tr>${(b.rows||[]).map(r=>`<tr>${r.map(c=>`<td>${E(c)}</td>`).join("")}</tr>`).join("")}</table>`; W.appendChild(w); }
    else if(b.t==="img"){ const s=(o.images||[])[b.n-1]; if(!s) return; const f=document.createElement("figure"); f.className="oa-fig"; const c=card(s,p.style.theme); c.style.width="100%"; c.style.maxWidth="420px"; f.appendChild(c); const cap=document.createElement("figcaption"); cap.textContent="이미지 "+b.n; f.appendChild(cap); W.appendChild(f); }
    else if(b.t==="photo"){ const ph=(o.photos||[])[b.n-1]; if(!ph) return; const k=p.id+"_"+b.n, u=PHB[k]; const f=document.createElement("figure"); f.className="oa-fig oa-ph";
      f.innerHTML=u?`<img src="${u}" alt="${E(ph.ko)}"><figcaption>사진 ${b.n} · AI 생성 · ${E(ph.ko)} <button class="btn sm" type="button" data-owp="${b.n}">다시 만들기</button> <button class="btn sm" type="button" data-owpd="${b.n}">받기</button></figcaption>`
        :`<div class="oa-phslot"><b>사진 ${b.n}</b> ${E(ph.ko)}<textarea class="oa-ta" rows="2" data-owpe="${b.n}" maxlength="900">${E(ph.en)}</textarea><div class="row" style="gap:6px"><button class="btn sm primary" type="button" data-owp="${b.n}">실사 사진 만들기 (40초 안팎)</button><span class="note" data-owpm="${b.n}"></span></div></div>`;
      W.appendChild(f); }
  });
  const d=document.createElement("p"); d.className="note"; d.textContent=DISC; W.appendChild(d);
}
async function tok(){ try{ return (typeof CLOUD!=="undefined"&&CLOUD.sb)?(await CLOUD.sb.auth.getSession()).data.session?.access_token:null; }catch(e){ return null; } }
async function callW(body){ const t=await tok(); if(!t) return {ok:false,error:"보잇에 로그인해야 쓸 수 있습니다."};
  try{ const r=await fetch(WAPI,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.assign({token:t},body))}); const x=await r.text(); try{ return JSON.parse(x); }catch(e){ return {ok:false,error:"서버 응답을 읽지 못했습니다. ("+r.status+") 잠시 후 다시 눌러 주세요."}; } }
  catch(e){ return {ok:false,error:"연결에 실패했습니다. 인터넷 연결을 확인해 주세요."}; } }
function wStyle(){ const s=Object.assign({gender:"여성",type:"전문형",theme:"navy"},D().wstyle||{}); $$(".oa-chip.on,.oa-sw.on").forEach(b=>{ s[b.dataset.ws]=b.dataset.v; }); return s; }
const $$=s=>Array.from(document.querySelectorAll(s));
async function runWrite(){
  if(WBUSY) return; const kw=($("#ow-kw").value||"").trim(); const msg=t=>{ const m=$("#ow-msg"); if(m) m.textContent=t; };
  if(kw.length<2) return msg("주제 키워드를 적어 주세요.");
  const inp={kw, kw2:($("#ow-kw2").value||"").trim(), facts:($("#ow-facts").value||"").trim(), target:($("#ow-tg").value||"").trim()}; const style=wStyle(); D().wstyle=style;
  WBUSY=true; const keep=Object.assign({},inp); vWrite(); ["kw","kw2","facts","tg"].forEach(k=>{ const e=$("#ow-"+k); if(e) e.value=keep[k==="tg"?"target":k]||""; });
  const r=await callW({action:"write",kw:inp.kw,kw2:inp.kw2,facts:inp.facts,target:inp.target,gender:style.gender,type:style.type});
  WBUSY=false;
  if(r&&r.ok){ let p=curPost(); if(!p||p.st!=="초안"){ p={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),at:td(),st:"초안",no:"",noText:"",bn:"gen"}; POSTS().push(p); }
    Object.assign(p,inp,{style,out:{title:r.title,titles_alt:r.titles_alt,summary:r.summary,keywords:r.keywords,blocks:r.blocks,images:r.images,photos:r.photos,tags:r.tags,checklist:r.checklist,warn:r.warn,stat:r.stat}});
    WCUR=p.id; const P=POSTS(); if(P.length>30) P.splice(0,P.length-30);
    const pl=D().plan.find(x=>x.keyword===kw); if(pl){ pl.post=p.id; if(pl.st==="예정") pl.st="초안"; }
    vWrite(); const m=$("#ow-msg"); if(m) m.textContent="글을 만들었습니다."+(r.left!=null?" (오늘 남은 횟수 "+r.left+"회)":""); }
  else { vWrite(); msg((r&&r.error)||"글을 만들지 못했습니다."); }
}
async function runPhoto(n,btn){
  const p=curPost(); if(!p) return; const ph=(p.out.photos||[])[n-1]; if(!ph) return;
  const ta=document.querySelector(`[data-owpe="${n}"]`); if(ta){ const v=ta.value.trim(); if(v.length>=20) ph.en=v.slice(0,900); }
  const m=document.querySelector(`[data-owpm="${n}"]`); btn.disabled=true; btn.textContent="만드는 중…";
  const r=await callW({action:"photo",prompt:ph.en});
  if(r&&r.ok&&r.img){ const k=p.id+"_"+n; PHB[k]=r.img; await IDB.put(k,r.img); drawPost(p); }
  else { btn.disabled=false; btn.textContent="실사 사진 만들기"; if(m) m.textContent=(r&&r.error)||"사진을 만들지 못했습니다."; else alert((r&&r.error)||"사진을 만들지 못했습니다."); }
}
function dlURL(u,name){ const a=document.createElement("a"); a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove(); }
function safe(s){ return String(s||"").replace(/[\\/:*?"<>|\n]/g," ").trim().slice(0,30); }
function dlAll(p){ let i=0; p.out.blocks.forEach(b=>{ if(b.t==="img"){ const u=cardURL(p,b.n); if(u) setTimeout(()=>dlURL(u,`${safe(p.out.title)}_이미지${b.n}.png`),(i++)*400); } else if(b.t==="photo"){ const u=PHB[p.id+"_"+b.n]; if(u) setTimeout(()=>dlURL(u,`${safe(p.out.title)}_사진${b.n}.jpg`),(i++)*400); } }); if(!i) alert("받을 이미지가 없습니다."); }
function postParts(p,mode){ // mode: review | text | final
  const o=p.out, H=[], T=[];
  o.blocks.forEach(b=>{
    if(b.t==="h"){ H.push(`<h3>${E(b.text)}</h3>`); T.push("■ "+b.text); }
    else if(b.t==="p"){ H.push(`<p>${E(b.text)}</p>`); T.push(b.text); }
    else if(b.t==="table"){ H.push((b.caption?`<p><b>${E(b.caption)}</b></p>`:"")+`<table border="1" cellpadding="6" style="border-collapse:collapse">${[`<tr>${(b.head||[]).map(h=>`<th>${E(h)}</th>`).join("")}</tr>`].concat((b.rows||[]).map(r=>`<tr>${r.map(c=>`<td>${E(c)}</td>`).join("")}</tr>`)).join("")}</table>`); T.push((b.caption?b.caption+"\n":"")+[b.head||[]].concat(b.rows||[]).map(r=>"| "+r.join(" | ")+" |").join("\n")); }
    else if(b.t==="img"){ const s=(o.images||[])[b.n-1]; if(!s) return; if(mode==="final"){ H.push(`<p><img src="${cardURL(p,b.n)}" width="540"></p>`); } else { H.push(`<p style="color:#c2410c">[이미지 ${b.n}: ${E(s.title)}]</p>`); } T.push(`[이미지 ${b.n}: ${s.title}]`); }
    else if(b.t==="photo"){ const ph=(o.photos||[])[b.n-1]; if(!ph) return; const u=PHB[p.id+"_"+b.n]; if(mode==="final"&&u){ H.push(`<p><img src="${u}" width="720"></p>`); } else { H.push(`<p style="color:#c2410c">[사진 ${b.n}: ${E(ph.ko)}]</p>`); } T.push(`[사진 ${b.n}: ${ph.ko}]`); }
  });
  H.push(`<p>${E(DISC)}</p>`); T.push(DISC);
  if(mode!=="review"){ const nt=p.noText||p.no; if(nt){ H.push(`<p>${E(nt)}</p>`); T.push(nt); } if(mode==="final"){ const bu=(BIMG(p.bn)||{}).img; if(bu) H.push(`<p><img src="${bu}" width="720"></p>`); else T.push("[필수기재 배너]"); } else T.push("[필수기재 배너]"); }
  return {html:H.join(""),text:T.join("\n\n")};
}
async function copyPost(p,mode,btn){
  const msg=t=>{ const m=$("#ow-cmsg"); if(m) m.textContent=t; };
  if(mode==="title"){ try{ await navigator.clipboard.writeText(p.out.title); msg("제목을 복사했습니다."); }catch(e){ msg("복사하지 못했습니다."); } return; }
  if((mode==="final"||mode==="text")&&!p.no){ alert("심의번호를 먼저 넣어 주세요. 보험 광고는 심의 후 게시해야 합니다 (금융소비자보호법 제22조)."); return; }
  if(mode==="final"&&!BIMG(p.bn)&&!confirm("글 끝 필수기재 배너가 등록되지 않았습니다. 배너 없이 복사할까요?")) return;
  const pt=postParts(p,mode==="review"?"review":mode);
  try{ if(navigator.clipboard&&window.ClipboardItem) await navigator.clipboard.write([new ClipboardItem({"text/html":new Blob([pt.html],{type:"text/html"}),"text/plain":new Blob([pt.text],{type:"text/plain"})})]); else await navigator.clipboard.writeText(pt.text);
    const o=btn.textContent; btn.textContent="복사됨"; setTimeout(()=>btn.textContent=o,1600);
    if(mode==="final"){ p.st="완료"; const pl=D().plan.find(x=>x.post===p.id||x.keyword===p.kw); if(pl){ pl.no=p.no; pl.post=p.id; pl.st="발행"; } msg("네이버 글쓰기 본문에 붙여넣고 발행하세요."); }
    else if(mode==="review") msg("심의 제출 양식에 붙여넣으세요. 이미지는 '이미지 전체 받기'로 함께 제출합니다.");
  }catch(e){ msg("이 브라우저에서는 복사가 안 됩니다. 다른 브라우저(크롬)로 열어 주세요."); }
}

/* ---------- 4. 자동화 목록 ---------- */
function vMore(){
  const B=$("#oa-body");
  const L=[
    ["블로그 키워드 조사","네이버 월간 검색량 + 블로그 상위글 경쟁도로 쓸 키워드 고르기","사용 중","kw"],
    ["콘텐츠 계획","키워드별 발행일·심의번호·발행 주소 관리","사용 중","plan"],
    ["글 만들기","키워드·스타일(설계사 성별·글 유형·색상)로 심의 제출용 원고 + 정보 이미지 + AI 실사 사진 → 심의번호·배너 붙여 최종글 복사","사용 중","write"],
    ["카페 글","블로그 글을 카페용(질문·후기형 금지, 정보형)으로 다시 쓰기","준비중"],
    ["내 필수기재 배너","설계사별 등록번호 배너를 등록해 두고 글 끝에 복사해 붙이기","사용 중","banner"],
    ["이미지·썸네일","글 만들기 안에서 정보 이미지 6장·실사 사진 2장 자동 생성","사용 중","write"],
    ["발행 후 순위 확인","발행한 글이 키워드 검색에서 몇 위인지 주기적으로 확인","준비중"],
    ["네이버 로직 점검","2주마다 네이버 검색 정책·공지 변화를 확인해 글쓰기 기준 갱신","준비중"],
    ["인스타·쇼츠","블로그 글을 인스타 글·쇼츠 대본으로 바꾸기","준비중"]];
  B.innerHTML=`<div class="oa-grid">${L.map(([t,d,s,go])=>`<div class="panel oa-card"><div class="row between"><b>${t}</b><span class="pill" style="background:${s==="사용 중"?"var(--accent-soft)":"var(--surface-2,#f1f1f1)"};color:${s==="사용 중"?"var(--ok)":"var(--muted)"}">${s}</span></div><p class="note" style="margin:6px 0 0">${d}</p>${go?`<button class="btn sm" type="button" data-oat="${go}" style="margin-top:10px;align-self:flex-start">열기</button>`:""}</div>`).join("")}</div>`;
}

/* ---------- 이벤트 ---------- */
document.addEventListener("click",e=>{ const t=e.target; if(!t||!t.closest||!t.closest("#oa-root")) return;
  const tb=t.closest("[data-oat]"); if(tb){ TAB=tb.dataset.oat; render(); return; }
  if(t.closest("#oa-go")){ runKw(); return; }
  if(t.closest("#oa-gen")){ genPlan(); return; }
  const gt=t.closest("[data-gt]"); if(gt){ const g=GS(), v=gt.dataset.gt; g.topics=g.topics.includes(v)?g.topics.filter(x=>x!==v):[...g.topics,v]; vPlanMake(); return; }
  const gw=t.closest("[data-gw]"); if(gw){ GS().weeks=+gw.dataset.gw; vPlanMake(); return; }
  const gf=t.closest("[data-gf]"); if(gf){ GS().freq=gf.dataset.gf; vPlanMake(); return; }
  const fl=t.closest("[data-oaf]"); if(fl){ FLT=fl.dataset.oaf; vDo(); return; }
  const ou=t.closest("[data-oaurl]"); if(ou){ const c=ou.closest("[data-oap]"); const d=c&&c.querySelector("details"); if(d){ d.open=true; const i=d.querySelector('[data-f="url"]'); if(i) i.focus(); } return; }
  if(t.closest("#ow-back")){ TAB="do"; render(); return; }
  const ws=t.closest("[data-ws]"); if(ws){ const f=ws.dataset.ws, v=ws.dataset.v; $$(`[data-ws="${f}"]`).forEach(b=>b.classList.toggle("on",b===ws)); const st=D().wstyle=Object.assign({gender:"여성",type:"전문형",theme:"navy"},D().wstyle||{}); st[f]=v; const p=curPost(); if(p&&p.out&&f==="theme"){ if(p.st==="초안"){ p.style.theme=v; drawPost(p); } else alert("심의에 올린 뒤에는 이미지를 바꾸면 다시 심의를 받아야 합니다."); } return; }
  if(t.closest("#ow-go")){ runWrite(); return; }
  if(t.closest("#ow-new")){ WCUR=null; vWrite(); return; }
  const wo=t.closest("[data-owo]"); if(wo){ WCUR=wo.dataset.owo; vWrite(); return; }
  const wd=t.closest("[data-owd]"); if(wd){ if(confirm("이 글을 삭제할까요?")){ const P=POSTS(); const i=P.findIndex(x=>x.id===wd.dataset.owd); if(i>=0){ const x=P[i]; (x.out&&x.out.photos||[]).forEach((_,j)=>{ IDB.del(x.id+"_"+(j+1)); delete PHB[x.id+"_"+(j+1)]; }); P.splice(i,1); } if(WCUR===wd.dataset.owd) WCUR=null; vWrite(); } return; }
  const wp=t.closest("[data-owp]"); if(wp){ runPhoto(+wp.dataset.owp,wp); return; }
  const wpd=t.closest("[data-owpd]"); if(wpd){ const p=curPost(); const u=p&&PHB[p.id+"_"+wpd.dataset.owpd]; if(u) dlURL(u,`${safe(p.out.title)}_사진${wpd.dataset.owpd}.jpg`); return; }
  const wc=t.closest("[data-owc]"); if(wc){ const p=curPost(); if(p&&p.out) copyPost(p,wc.dataset.owc,wc); return; }
  if(t.closest("#ow-dlall")){ const p=curPost(); if(p&&p.out) dlAll(p); return; }
  const wst=t.closest("[data-owst]"); if(wst){ const p=curPost(); if(p){ p.st=wst.dataset.owst; const pl=D().plan.find(x=>x.post===p.id); if(pl&&pl.st!=="발행") pl.st="심의중"; vWrite(); } return; }
  const aw=t.closest("[data-oaw]"); if(aw){ const pl=D().plan.find(x=>x.id===aw.dataset.oaw); if(pl){ if(pl.post&&POSTS().some(x=>x.id===pl.post)) WCUR=pl.post; else { WCUR=null; window.__OAKW={kw:pl.keyword}; } TAB="write"; render(); } return; }
  const a=t.closest("[data-oaadd]"); if(a){ const r=(D().last||{}).rows||[]; const x=r[+a.dataset.oaadd]; if(x){ candAdd(x,"kw"); keepKw(); } return; }
  if(t.closest("#oa-addall")){ const r=(D().last||{}).rows||[]; let n=0; r.filter(x=>x.verdict==="최적"||x.verdict==="가능").forEach(x=>{ if(candAdd(x,"kw")) n++; }); keepKw(); const m=$("#oa-msg"); if(m) m.textContent=n?n+"개를 '키워드 고르기'에 넣었습니다.":"새로 고를 키워드가 없습니다."; return; }
  if(t.closest("#oa-cadd")){ const v=($("#oa-ck").value||""); let n=0; v.split(/[,\n]+/).forEach(k=>{ if(candAdd({keyword:k},"mine")) n++; }); keepKw(); return; }
  const cs=t.closest("[data-oacs]"); if(cs){ const m=cs.dataset.oacs, C=CAND(); if(m==="clear"){ if(!confirm("키워드 고르기 목록을 비울까요? (계획에 넣은 것은 그대로)")) return; D().cand=[]; } else C.forEach(c=>{ c.on=m==="best"?(c.verdict==="최적"||c.verdict==="가능"||!!c.mine):false; }); keepKw(); return; }
  const cu=t.closest("[data-oacu]"); if(cu){ e.preventDefault(); const C=CAND(), i=+cu.dataset.oacu; if(i>0){ [C[i-1],C[i]]=[C[i],C[i-1]]; } keepKw(); return; }
  const cx=t.closest("[data-oacx]"); if(cx){ e.preventDefault(); CAND().splice(+cx.dataset.oacx,1); keepKw(); return; }
  if(t.closest("#oa-cput")){ candPut(); return; }
  if(t.closest("#oa-nadd")){ const k=($("#oa-nk").value||"").trim().slice(0,30); if(k.length>=2){ addPlan({keyword:k,verdict:"",search:0}); render(); } return; }
  const bc=t.closest("[data-oabc]"); if(bc){ const tr=bc.closest("[data-oap]"); let k=bc.dataset.oabc; if(tr){ const sel=tr.querySelector('[data-f="bn"]'); if(sel) k=sel.value; } copyBanner(k,bc); return; }
  const bd=t.closest("[data-oabd]"); if(bd){ dlBanner(bd.dataset.oabd); return; }
  const bx=t.closest("[data-oabx]"); if(bx){ if(confirm("이 배너 이미지를 삭제할까요?")){ delete BNS()[bx.dataset.oabx]; render(); } return; }
  const d=t.closest("[data-oadel]"); if(d){ if(confirm("이 계획을 삭제할까요?")){ const P=D().plan; const i=P.findIndex(p=>p.id===d.dataset.oadel); if(i>=0) P.splice(i,1); render(); } return; }
});
document.addEventListener("change",e=>{ const t=e.target; if(!t||!t.closest) return;
  if(t.id==="ow-title"||t.id==="ow-no"||t.id==="ow-notxt"||t.id==="ow-bn"){ const p=curPost(); if(!p) return; const v=String(t.value||"").trim();
    if(t.id==="ow-title"){ if(p.st!=="초안"&&v!==p.out.title&&!confirm("심의 후 제목을 바꾸면 다시 심의를 받아야 합니다. 바꿀까요?")){ t.value=p.out.title; return; } p.out.title=v.slice(0,80); }
    if(t.id==="ow-no"){ p.no=v.slice(0,40); if(v&&p.st==="초안") p.st="심의중"; if(!p.noText&&v){ p.noText=/심의필/.test(v)?v:"준법감시인 심의필 제"+v+"호"; const n2=$("#ow-notxt"); if(n2) n2.value=p.noText; } }
    if(t.id==="ow-notxt") p.noText=v.slice(0,160);
    if(t.id==="ow-bn") p.bn=v;
    return; }
  if(t.dataset&&t.dataset.oacc!=null){ const c=CAND()[+t.dataset.oacc]; if(c){ c.on=t.checked; keepKw(); } return; }
  if(t.id==="oa-gs"){ GS().start=t.value; keepKw(); return; }
  if(t.id==="oa-gc"){ GS().custom=t.value; vPlanMake(); return; }
  if(t.dataset&&t.dataset.oabu&&t.closest("#oa-root")){ const k=t.dataset.oabu, f=t.files&&t.files[0]; if(!f) return;
    loadImg(f).then(u=>{ BNS()[k]={img:u,name:String(f.name||"").slice(0,60),at:td()}; render(); }).catch(er=>{ const m=$("#oa-bmsg"); if(m) m.textContent=er.message; else alert(er.message); }); return; }
  const tr=t.closest("[data-oap]"); if(!tr||!t.dataset.f) return;
  const p=D().plan.find(x=>x.id===tr.dataset.oap); if(!p) return; const f=t.dataset.f; let v=String(t.value||"").trim();
  if(f==="url"&&v&&!/^https?:\/\//.test(v)){ alert("주소는 https:// 로 시작해야 합니다."); t.value=p.url; return; }
  if(f==="st"&&v==="발행"&&!p.no){ alert("심의번호를 먼저 넣어 주세요. 보험 광고는 심의 후 게시해야 합니다."); t.value=p.st; return; }
  if(f==="keyword"){ v=v.slice(0,30); if(v.length<2||D().plan.some(x=>x!==p&&x.keyword===v)){ alert(v.length<2?"키워드를 2자 이상 넣어 주세요.":"이미 계획에 있는 키워드입니다."); t.value=p.keyword; return; } if(v!==p.keyword){ p.verdict=""; p.search=0; } }
  p[f]=v; if(f==="url"&&v&&p.no&&p.st!=="발행") p.st="발행"; if(f==="st"||f==="date"||f==="url"||f==="keyword") vDo();
});
document.addEventListener("input",e=>{ const t=e.target; if(!t||!t.dataset||t.dataset.owb==null) return; const p=curPost(); if(!p||!p.out) return; const b=p.out.blocks[+t.dataset.owb]; if(b) b.text=t.innerText.replace(/\n+/g," ").trim(); });
document.addEventListener("keydown",e=>{ if(e.key!=="Enter"||!e.target) return; const id=e.target.id; if(id==="oa-nk"||id==="oa-ck"){ e.preventDefault(); const b=$(id==="oa-nk"?"#oa-nadd":"#oa-cadd"); if(b) b.click(); } });

const css=document.createElement("style"); css.textContent=`
.oa-when{display:flex;flex-wrap:wrap;gap:4px 28px;align-items:flex-start}.oa-when>div{min-width:0}.oa-when .oa-chips{margin-bottom:0}
.oa-cr{cursor:pointer;align-items:center;gap:10px}.oa-cr input[type=checkbox]{width:18px;height:18px;flex:none}.oa-cr:not(.on){opacity:.6}
.nav .grp[data-g="7"]{--g:var(--c5)}
.oa-rule{margin-top:12px;padding:10px 14px;border-radius:10px;background:var(--warn-soft);color:var(--warn);font-size:13.5px}.oa-rule b{color:inherit}
.oa-ta{width:100%;border:1px solid var(--line);border-radius:8px;padding:9px 11px;background:var(--surface);font:inherit;resize:vertical}
.oa-t td,.oa-t th{white-space:nowrap;vertical-align:middle}.oa-t td.num{text-align:right}
.oa-t input,.oa-t select{font:inherit;font-size:13.5px;padding:4px 6px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:inherit}
.oa-lb{font-size:13.5px;font-weight:700;margin:14px 0 6px}.oa-chips{display:flex;flex-wrap:wrap;gap:6px}
.oa-in{font:inherit;font-size:14px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:inherit;width:100%;margin-top:8px;box-sizing:border-box}
.oa-sum{margin:16px 0 10px;font-size:14.5px}.oa-more summary{cursor:pointer;font-weight:700}
.oa-kl{display:flex;flex-direction:column;margin-top:8px}.oa-kr{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)}.oa-kr>div{min-width:0}.oa-kr small{display:block;margin-top:2px}
.oa-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;margin-top:10px}
.oa-pc{border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--surface);min-width:0}.oa-pc.late{border-color:var(--warn)}
.oa-pt{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.oa-pt .d{font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums}.oa-pc.late .oa-pt .d{color:var(--warn);font-weight:700}.oa-pt b{font-size:15px}.oa-pt small{font-size:12px;font-weight:700}
.oa-prog{display:flex;gap:4px;margin-top:8px}.oa-prog span{flex:1;text-align:center;font-size:11.5px;padding:3px 0;border-radius:6px;background:var(--surface-2,#f1f1f1);color:var(--muted)}.oa-prog span.on{background:var(--accent-soft);color:var(--ok);font-weight:700}
.oa-pd{margin-top:8px}.oa-pd summary{cursor:pointer;font-size:12.5px;color:var(--muted)}.oa-pf{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.oa-pf label{display:flex;flex-direction:column;gap:3px;font-size:12.5px;font-weight:600;min-width:0}.oa-pf input,.oa-pf select{font:inherit;font-size:13.5px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:inherit;min-width:0;width:100%;box-sizing:border-box}
@media(max-width:520px){.oa-pf{grid-template-columns:1fr}}
.oa-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.oa-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.oa-card{display:flex;flex-direction:column}
.oa-bgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.oa-bslot{border:1px solid var(--line);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px}
.oa-bslot img{width:100%;border-radius:6px;border:1px solid var(--line);background:#fff}
.oa-bdrop{display:flex;align-items:center;justify-content:center;min-height:110px;border:2px dashed var(--line);border-radius:8px;color:var(--muted);cursor:pointer;font-size:14px}.oa-bdrop:hover{border-color:var(--accent);color:var(--accent)}
.oa-steps{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}.oa-steps span{font-size:13px;padding:5px 10px;border-radius:999px;background:var(--surface-2,#f1f1f1);color:var(--muted)}.oa-steps span.on{background:var(--accent);color:#fff;font-weight:700}
.oa-wgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}.oa-wgrid label{display:flex;flex-direction:column;gap:4px;font-size:13.5px;font-weight:600}.oa-wgrid input,.oa-wgrid select{font:inherit;font-weight:400;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:inherit}
.oa-srow{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:10px}.oa-srow>b{font-size:13.5px;min-width:80px}
.oa-chip{font:inherit;font-size:13.5px;padding:6px 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:inherit;cursor:pointer}.oa-chip small{color:var(--muted);font-size:11.5px;margin-left:4px}.oa-chip.on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent);font-weight:700}
.oa-sw{font:inherit;font-size:13px;display:inline-flex;align-items:center;gap:6px;padding:5px 10px 5px 6px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:inherit;cursor:pointer}.oa-sw i{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,var(--a) 0 55%,var(--o) 55%)}.oa-sw.on{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft);font-weight:700}
.oa-post{margin-top:12px;border:1px solid var(--line);border-radius:12px;padding:20px 22px;background:#fff;color:#222;max-width:760px;line-height:1.85}.oa-post p{margin:0 0 14px;font-size:15.5px}.oa-post h3{font-size:18px;margin:24px 0 10px;padding-left:10px;border-left:4px solid var(--accent)}.oa-post [contenteditable="true"]:focus{outline:2px dashed var(--accent);outline-offset:3px}
.oa-fig{margin:16px 0}.oa-fig img{width:100%;max-width:640px;border-radius:8px;display:block}.oa-fig figcaption{font-size:12px;color:#888;margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.oa-phslot{border:2px dashed #f0c48a;background:#fff8ef;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13.5px;color:#7a4a10}
.oa-cap{font-weight:700;font-size:14px;margin:8px 0 6px}.oa-pt{width:100%;border-collapse:collapse;font-size:14px;margin-bottom:14px}.oa-pt th,.oa-pt td{border:1px solid #ddd;padding:7px 9px;text-align:left}.oa-pt th{background:#f6f7f8}
.oa-help summary{cursor:pointer;color:var(--muted);font-size:13.5px}.oa-help ul{margin:8px 0 0;padding-left:18px;font-size:13.5px;color:var(--muted);display:flex;flex-direction:column;gap:4px}
`; document.head.appendChild(css);

window.ONLINE={render};
if(document.readyState!=="loading") render(); else document.addEventListener("DOMContentLoaded",render);
})();
