/* 보잇 · 제안·영업 › 리모델링 비교표 (2026-11-12)
   기존 보장분석 PDF(또는 저장된 고객 계약) + 보험사 설계서 PDF 여러 개 →
   유지/해지 계약 체크, 기준 담보별 기존·유지·제안·리모델링 후 금액과 변화, 월 보험료를 엑셀처럼 한 표로.
   - 보장분석 읽기: index.html bsReadPdf (메리츠 간편보장분석 '상품별 보험가입현황' · 신용정보원 '상품별 가입담보상세')
   - 설계서 읽기: grow.ai.kr/report/bosang.js BOSANG.readProposal (KB손보 양식, 그 외 AI 읽기)
   - 담보 분류는 담보명 글자로만 정함(추정 연결 없음). 잘못 분류된 담보는 '담보 분류 확인'에서 바꿀 수 있음.
   금액 단위: 만원. 보험료: 원. */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt=v=>v==null||isNaN(v)?"":v>=10000?((v%10000?(v/10000).toFixed(1).replace(/\.0$/,""):v/10000)+"억"):(Math.round(v*10)/10).toLocaleString("ko-KR")+"만";
const wonTxt=n=>n?Math.round(n).toLocaleString("ko-KR")+"원":"-";

/* 기준 담보 (순서 = 표 순서). yn: 금액 대신 가입 여부로 표시 */
const CATS=[
 {k:"cancer",     t:"암진단비(일반암)",           on:1, g:"진단비"},
 {k:"cancer_all", t:"통합암진단비",               on:1, g:"진단비"},
 {k:"cancer_meta",t:"암진단비(전이암 포함)",       on:1, g:"진단비"},
 {k:"sim",        t:"유사암진단비",               on:0, g:"진단비"},
 {k:"brain",      t:"뇌혈관질환진단비",           on:1, g:"진단비"},
 {k:"stroke",     t:"뇌졸중진단비",               on:0, g:"진단비"},
 {k:"bleed",      t:"뇌출혈진단비",               on:0, g:"진단비"},
 {k:"heart",      t:"심장질환진단비(심근염·부정맥 등)", on:1, g:"진단비"},
 {k:"ami",        t:"급성심근경색진단비",         on:1, g:"진단비"},
 {k:"ihd",        t:"허혈성심장질환진단비",       on:1, g:"진단비"},
 {k:"ctx",        t:"암 주요·통합치료비",         on:1, g:"치료비"},
 {k:"ctx_np",     t:"비급여 암치료비(하이클래스 등)", on:1, g:"치료비"},
 {k:"circ",       t:"순환계·뇌심 치료비",         on:1, g:"치료비"},
 {k:"dem",        t:"치매치료비(레켐비·표적치매약물)", on:1, g:"치료비"},
 {k:"dsurg",      t:"질병수술비",                 on:1, g:"수술비"},
 {k:"isurg",      t:"상해수술비",                 on:1, g:"수술비"},
 {k:"dtype",      t:"질병 종수술비(1~5종 등)",     on:1, g:"수술비", yn:1},
 {k:"itype",      t:"상해 종수술비",              on:1, g:"수술비", yn:1},
 {k:"nsurg",      t:"N대 수술비",                 on:1, g:"수술비", yn:1},
 {k:"care",       t:"간병인·간호간병(사용·지원)",  on:1, g:"간병",   yn:1},
 {k:"ddeath",     t:"질병사망",                   on:0, g:"사망·장해"},
 {k:"ideath",     t:"상해사망",                   on:0, g:"사망·장해"},
 {k:"idis",       t:"상해후유장해",               on:0, g:"사망·장해"},
];
const CAT=Object.fromEntries(CATS.map(c=>[c.k,c]));
const NOT_DX=/치료|수술|입원|통원|생활|간병|일당|납입면제|재진단|계속|보험료/;
function classify(name){
  const n=String(name||"").replace(/\s+/g,"");
  if(/납입면제|보험료납입|해약환급|포인트/.test(n)) return "";
  if((/비급여/.test(n)&&/암/.test(n)&&/치료/.test(n))||/하이클래스/.test(n)) return "ctx_np";
  if(/(암|항암).*(주요치료|통합치료|치료비|치료지원|치료자금)|표적항암|면역항암|양성자|중입자|카티|다빈치|로봇수술/.test(n)) return "ctx";
  if(/(순환계|2대|3대|뇌심|심뇌|뇌혈관|허혈|심장|혈전).*(치료)/.test(n)) return "circ";
  if(/레켐비|도나네맙|표적.*치매|치매.*(표적|약물|치료)/.test(n)) return "dem";
  if(/간병인|간호.*간병|간병.*(지원|사용|일당|비)/.test(n)) return "care";
  if(/[1-9]\s*[~\-～]\s*[1-9]\s*종|[1-9]종수술|종수술/.test(n)&&/수술/.test(n)) return /상해/.test(n)?"itype":"dtype";
  if(/\d+대.*수술/.test(n)) return "nsurg";
  /* 질병·상해수술비는 이름 그대로인 담보만 (특정·중대한·주요·N대 등 붙은 수술비는 제외) */
  { const b=n.replace(/\[[^\]]*\]|\([^)]*\)|[ⅠⅡⅢⅣⅤ]|[IV]+$|\d+$/g,"").replace(/^(갱신형|무배당|기본계약|특약)/,"");
    if(/^질병수술비$/.test(b)) return "dsurg";
    if(/^상해수술비$/.test(b)) return "isurg"; }
  if(/진단/.test(n)&&!NOT_DX.test(n)){
    if(/통합암|통합.*암|암.*통합/.test(n)) return "cancer_all";
    if(/전이/.test(n)&&/암/.test(n)) return "cancer_meta";
    if(/유사암|소액암|갑상선|기타피부|제자리|경계성/.test(n)&&!/제외/.test(n)) return "sim";
    if(/뇌혈관/.test(n)) return "brain";
    if(/뇌졸중/.test(n)) return "stroke";
    if(/뇌출혈/.test(n)) return "bleed";
    if(/급성심근경색|심근경색/.test(n)) return "ami";
    if(/허혈/.test(n)) return "ihd";
    if(/심장|심근염|부정맥|심부전|판막/.test(n)) return "heart";
    if(/암/.test(n)&&!/고액|특정|\d+대|여성|남성|소아|부위|최초|이차|2차/.test(n)) return "cancer";
  }
  if(/질병사망/.test(n)&&!/후유/.test(n)) return "ddeath";
  if(/상해사망/.test(n)&&!/후유/.test(n)) return "ideath";
  if(/상해후유장해/.test(n)) return "idis";
  return "";
}

const S={ cur:[], prop:[], cats:new Set(CATS.filter(c=>c.on).map(c=>c.k)), msg:"", busy:false, open:{} };
let SEQ=1;
const manOf=t=>{ const B=window.BOSANG; if(typeof t==="number") return t; const v=B&&B.manAny?B.manAny(String(t||"")):null; return v==null?null:v; };

/* ---------- 읽기 ---------- */
async function addCover(files){
  for(const f of files){
    S.msg=`${f.name} 읽는 중…`; draw();
    try{
      if(typeof bsReadPdf!=="function") throw new Error("보장분석 읽기 도구가 없습니다.");
      const r=await bsReadPdf(f);
      if(!r.ctrs.length){ S.msg=`${f.name}: 계약·담보 표를 찾지 못했습니다. 메리츠 간편보장분석 또는 신용정보원 보장분석 PDF인지 확인하세요.`; continue; }
      r.ctrs.forEach(o=>S.cur.push({id:SEQ++,co:o.co,prod:o.prod,from:o.from||"",prem:o.prem||0,on:true,
        items:o.items.map(x=>({name:x.name,amt:x.amt/1e4,cat:x.kind==="정액"?classify(x.name):""}))}));
      S.msg=`${f.name}: 계약 ${r.ctrs.length}건을 읽었습니다.${r.name?` (고객 ${r.name})`:""}`;
    }catch(e){ S.msg=`${f.name}: 읽지 못했습니다. ${e&&e.message?e.message:""}`; }
  }
  draw();
}
function loadCust(){
  const v=(($("#rm-cust")||{}).value||"").trim(); if(!v) return;
  const id=typeof resolveCust==="function"?resolveCust(v):null;
  if(!id){ S.msg="고객을 찾지 못했습니다. 목록에서 골라 주세요."; draw(); return; }
  const ks=(typeof CONTRACTS!=="undefined"?CONTRACTS:[]).filter(k=>k.cust===id&&(k.cov||[]).length);
  if(!ks.length){ S.msg="이 고객은 저장된 담보가 없습니다. 보장분석 PDF를 올려 주세요."; draw(); return; }
  S.cur=S.cur.filter(c=>!c.fromCust);
  ks.forEach(k=>S.cur.push({id:SEQ++,fromCust:1,co:k.insurer,prod:k.product||"",from:k.start||"",prem:+k.premium||0,on:true,
    items:k.cov.map(v=>({name:v.name,amt:manOf(String(v.amount||"").replace(/,/g,"")),cat:(v.kind||"정액")==="정액"?classify(v.name):""})).filter(x=>x.amt!=null)}));
  S.msg=`저장된 계약 ${ks.length}건을 불러왔습니다.`; draw();
}
async function addProp(files){
  const B=window.BOSANG;
  if(!B||!B.readProposal||!window.pdfjsLib){ S.msg="설계서 읽기 도구를 불러오지 못했습니다. 새로고침 후 다시 시도하세요."; draw(); return; }
  for(const f of files){
    S.msg=`${f.name} 읽는 중… (AI가 읽는 회사는 10~20초 걸립니다)`; draw();
    try{
      const r=await B.readProposal(f,window.pdfjsLib), p=r.p;
      const items=(p.items||[]).filter(i=>!i.group&&i.amt!=null).map(i=>({name:i.name,amt:i.amt,cat:classify(i.name),per:i.per||""}));
      const prem=p.premium||(p.items||[]).reduce((a,i)=>a+(+i.prem||0),0);
      S.prop.push({id:SEQ++,co:p.company||"",prod:p.product||f.name.replace(/\.pdf$/i,""),prem:+prem||0,on:true,items,ai:r.source==="ai"});
      S.msg=`${f.name}: 담보 ${items.length}개를 읽었습니다.${r.source==="ai"?" AI가 읽은 표이니 금액을 원본과 대조해 주세요.":""}`;
    }catch(e){ S.msg=`${f.name}: ${e&&e.msg?e.msg:"읽지 못했습니다."}`; }
  }
  draw();
}

/* ---------- 계산 ---------- */
function cellOf(doc,k){
  const its=doc.items.filter(i=>i.cat===k); if(!its.length) return null;
  if(CAT[k].yn){ return {yn:true,names:its.map(i=>i.name)}; }
  return {amt:its.reduce((a,i)=>a+(+i.amt||0),0),names:its.map(i=>i.name+" "+fmt(+i.amt))};
}
function sumOf(docs,k){
  const cs=docs.map(d=>cellOf(d,k)).filter(Boolean); if(!cs.length) return null;
  if(CAT[k].yn) return {yn:true,names:cs.flatMap(c=>c.names)};
  return {amt:cs.reduce((a,c)=>a+c.amt,0)};
}
function table(){
  const cats=CATS.filter(c=>S.cats.has(c.k));
  const keep=S.cur.filter(c=>c.on), props=S.prop.filter(p=>p.on);
  const rows=cats.map(c=>{
    const before=sumOf(S.cur,c.k), kept=sumOf(keep,c.k), add=sumOf(props,c.k);
    let after=null; if(c.yn) after=kept||add?{yn:true}:null; else { const a=(kept?kept.amt:0)+(add?add.amt:0); after=kept||add?{amt:a}:null; }
    let diff;
    if(c.yn) diff=!before&&after?"신규":before&&!after?"없어짐":before&&after?"유지":"";
    else { const d=(after?after.amt:0)-(before?before.amt:0); diff=d; }
    return {c,cur:S.cur.map(d=>cellOf(d,c.k)),before,kept,prop:S.prop.map(d=>cellOf(d,c.k)),add,after,diff};
  });
  const pBefore=S.cur.reduce((a,d)=>a+(d.prem||0),0), pKept=keep.reduce((a,d)=>a+(d.prem||0),0), pAdd=props.reduce((a,d)=>a+(d.prem||0),0);
  return {cats,rows,pBefore,pKept,pAdd,pAfter:pKept+pAdd};
}

/* ---------- 화면 ---------- */
const cellH=(x,yn,dim)=>{ if(!x) return `<td class="rm-n${dim?" dim":""}">-</td>`;
  const tip=esc((x.names||[]).join("\n"));
  return yn?`<td class="rm-n${dim?" dim":""}" title="${tip}">가입</td>`:`<td class="rm-n${dim?" dim":""}" title="${tip}">${fmt(x.amt)}</td>`; };
/* 바뀐 내용: '기존 → 리모델링 후 (증감)' */
function chg(r){
  if(!r.before&&!r.after) return {txt:"",cls:"",d:0};
  if(r.c.yn){ const a=r.before?"가입":"없음", b=r.after?"가입":"없음"; return {txt:`${a} → ${b}`,tag:r.diff,cls:{신규:"up",없어짐:"down"}[r.diff]||"",d:0}; }
  const a=r.before?fmt(r.before.amt):"없음", b=r.after?fmt(r.after.amt):"없음", d=Math.round(r.diff*10)/10;
  return {txt:`${a} → ${b}`,tag:d?(d>0?"+":"−")+fmt(Math.abs(d)):"변동 없음",cls:d>0?"up":d<0?"down":"",d};
}
function diffH(r){ const x=chg(r); if(!x.txt) return `<td class="rm-n">-</td>`;
  return `<td class="rm-n rm-chg ${x.cls}"><span>${x.txt}</span><b>${x.tag}</b></td>`; }
function draw(){
  const R=$("#rm-root"); if(!R) return;
  const T=table();
  const docHead=(d,kind)=>`<th class="rm-doc ${kind}${d.on?"":" off"}"><label><input type="checkbox" data-rmon="${kind}:${d.id}" ${d.on?"checked":""}> ${kind==="cur"?(d.on?"유지":"해지"):(d.on?"가입":"제외")}</label><b>${esc(d.co||"")}</b><span>${esc(String(d.prod||"").slice(0,26))}</span></th>`;
  const hasData=S.cur.length||S.prop.length;
  /* 해지한 기존 계약·제외한 제안은 표에서 칸을 뺌 (합계 '기존 합계'에는 그대로 포함) */
  const CI=S.cur.map((d,i)=>i).filter(i=>S.cur[i].on), PI=S.prop.map((d,i)=>i).filter(i=>S.prop[i].on);
  const VC=CI.map(i=>S.cur[i]), VP=PI.map(i=>S.prop[i]);
  R.innerHTML=`
  <div class="rm-steps">
    <div class="panel rm-step"><h3><span>1</span>기존 보험</h3>
      <div class="rm-btns"><label class="btn primary" style="cursor:pointer">보장분석 PDF 올리기<input id="rm-cov" type="file" accept="application/pdf,.pdf" multiple hidden></label>
      <div class="rm-or"><input id="rm-cust" list="dl-cust" placeholder="또는 저장된 고객 이름" autocomplete="off"><button class="btn" type="button" id="rm-custgo">불러오기</button></div></div>
      <p class="rm-hint">메리츠 간편보장분석 · 신용정보원 보장분석 PDF</p>
      ${S.cur.length?`<ul class="rm-list">${S.cur.map(d=>`<li class="${d.on?"":"off"}"><label class="rm-sw"><input type="checkbox" data-rmon="cur:${d.id}" ${d.on?"checked":""}><span>${d.on?"유지":"해지"}</span></label><div><b>${esc(d.co)}</b> ${esc(d.prod)}<em>${d.from?esc(d.from)+" · ":""}${wonTxt(d.prem)}</em></div><button class="rm-x" data-rmdel="cur:${d.id}" aria-label="삭제">✕</button></li>`).join("")}</ul>`:""}
    </div>
    <div class="panel rm-step"><h3><span>2</span>제안 설계서</h3>
      <div class="rm-btns"><label class="btn primary" style="cursor:pointer">설계서 PDF 올리기 (여러 개)<input id="rm-prop" type="file" accept="application/pdf,.pdf" multiple hidden></label></div>
      <p class="rm-hint">보험사 가입설계서(제안서) PDF · A사, B사, C사…</p>
      ${S.prop.length?`<ul class="rm-list">${S.prop.map((d,i)=>`<li class="${d.on?"":"off"}"><label class="rm-sw p"><input type="checkbox" data-rmon="prop:${d.id}" ${d.on?"checked":""}><span>${d.on?"가입":"제외"}</span></label><div><b>${String.fromCharCode(65+i)}. ${esc(d.co)}</b> ${esc(d.prod)}<em>${wonTxt(d.prem)}${d.ai?" · AI 읽기":""}</em></div><button class="rm-x" data-rmdel="prop:${d.id}" aria-label="삭제">✕</button></li>`).join("")}</ul>`:""}
    </div>
  </div>
  <p class="rm-msg">${esc(S.msg)}</p>
  <div class="panel" style="margin-top:12px"><h3 class="rm-h3"><span>3</span>비교할 담보 고르기</h3>
    <div class="rm-cats">${["진단비","치료비","수술비","간병","사망·장해"].map(g=>`<div class="rm-cg"><b>${g}</b>${CATS.filter(c=>c.g===g).map(c=>`<label class="${S.cats.has(c.k)?"on":""}"><input type="checkbox" data-rmcat="${c.k}" ${S.cats.has(c.k)?"checked":""}>${esc(c.t)}</label>`).join("")}</div>`).join("")}</div>
  </div>
  ${hasData?`<div class="panel" style="margin-top:12px">
    <div class="row between"><h3 class="rm-h3" style="margin:0"><span>4</span>리모델링 비교표 <small>단위 만원 · 칸에 마우스를 올리면 담보명</small></h3>
      <div class="rm-btns"><button class="btn" type="button" id="rm-xlsx">엑셀 받기</button><button class="btn" type="button" id="rm-print">바로 출력</button></div></div>
    <div class="tbl-wrap rm-wrap"><table class="rm-tbl"><thead>
      <tr><th class="rm-sticky" rowspan="2">담보</th>${VC.length?`<th colspan="${VC.length}" class="grp cur">기존 계약 (유지)</th>`:""}<th rowspan="2" class="sum">기존<br>합계</th><th rowspan="2" class="sum">유지분<br>합계</th>${VP.length?`<th colspan="${VP.length}" class="grp prop">제안</th>`:""}<th rowspan="2" class="sum fin">리모델링<br>후</th><th rowspan="2" class="sum">바뀐 내용<br><small>기존 → 후</small></th></tr>
      <tr>${VC.map(d=>docHead(d,"cur")).join("")}${VP.map(d=>docHead(d,"prop")).join("")}</tr></thead><tbody>
      ${T.rows.map(r=>`<tr><th class="rm-sticky">${esc(r.c.t)}</th>${CI.map(i=>cellH(r.cur[i],r.c.yn)).join("")}${cellH(r.before,r.c.yn)}${cellH(r.kept,r.c.yn)}${PI.map(i=>cellH(r.prop[i],r.c.yn)).join("")}<td class="rm-n fin">${r.after?(r.c.yn?"가입":fmt(r.after.amt)):"-"}</td>${diffH(r)}</tr>`).join("")}
      <tr class="prem"><th class="rm-sticky">월 보험료</th>${VC.map(d=>`<td class="rm-n">${wonTxt(d.prem)}</td>`).join("")}<td class="rm-n">${wonTxt(T.pBefore)}</td><td class="rm-n">${wonTxt(T.pKept)}</td>${VP.map(d=>`<td class="rm-n">${wonTxt(d.prem)}</td>`).join("")}<td class="rm-n fin">${wonTxt(T.pAfter)}</td>${(()=>{const d=T.pAfter-T.pBefore; return `<td class="rm-n rm-chg ${d>0?"down":d<0?"up":""}"><span>${wonTxt(T.pBefore)} → ${wonTxt(T.pAfter)}</span><b>${d?(d>0?"+":"−")+Math.abs(d).toLocaleString("ko-KR")+"원":"변동 없음"}</b></td>`;})()}</tr>
    </tbody></table></div>
    <div class="rm-sum"><div><span>지금 월 보험료</span><b>${wonTxt(T.pBefore)}</b></div><div><span>해지로 줄어드는 보험료</span><b>${wonTxt(T.pBefore-T.pKept)}</b></div><div><span>제안 추가 보험료</span><b>${wonTxt(T.pAdd)}</b></div><div class="hi"><span>리모델링 후 월 보험료</span><b>${wonTxt(T.pAfter)}</b></div></div>
    ${(()=>{ const ch=T.rows.map(r=>[r,chg(r)]).filter(([r,x])=>x.txt&&x.tag!=="변동 없음"&&x.tag!=="유지");
      return ch.length?`<div class="rm-chlist"><b>바뀐 담보</b><ul>${ch.map(([r,x])=>`<li class="${x.cls}"><span>${esc(r.c.t)}</span>${x.txt} <em>${x.tag}</em></li>`).join("")}</ul></div>`:""; })()}
    <p class="rm-hint">해지한 계약·제외한 제안은 표에서 빠지고 '기존 합계'에만 들어갑니다. 다시 넣으려면 위 1·2번 목록에서 체크하세요. 금액은 보장분석·설계서에 적힌 가입금액 합계입니다(실제 지급액은 약관 지급기준·감액기간에 따름). 보장분석 보험료가 '미제공'인 계약은 0원으로 표시됩니다. 해지 전 새 계약 인수 확정, 해지환급금, 면책·감액기간 재시작을 고객에게 안내하세요.</p>
  </div>
  <div class="panel" style="margin-top:12px"><h3 class="rm-h3" style="margin:0 0 8px"><span>5</span>담보 분류 확인 <small>표에 안 들어간 담보·잘못 들어간 담보를 바꿀 수 있습니다</small></h3>
    ${[...S.cur.map(d=>["cur",d]),...S.prop.map(d=>["prop",d])].map(([kind,d])=>{ const key=kind+":"+d.id, open=!!S.open[key], n=d.items.filter(i=>i.cat).length;
      return `<div class="rm-doc-it"><button type="button" class="rm-acc" data-rmopen="${key}">${open?"▾":"▸"} ${kind==="cur"?"기존":"제안"} · <b>${esc(d.co)}</b> ${esc(String(d.prod).slice(0,30))} <small>담보 ${d.items.length}개 중 ${n}개 분류됨</small></button>
      ${open?`<table class="rm-items"><tbody>${d.items.map((it,i)=>`<tr class="${it.cat?"":"un"}"><td>${esc(it.name)}</td><td class="rm-n">${fmt(+it.amt)}</td><td><select data-rmcatset="${key}:${i}"><option value="">(표에 안 넣음)</option>${CATS.map(c=>`<option value="${c.k}" ${it.cat===c.k?"selected":""}>${esc(c.t)}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table>`:""}</div>`; }).join("")}
  </div>`:""}`;
}

/* ---------- 엑셀·출력 ---------- */
function aoa(){
  const T=table(), CI=S.cur.map((d,i)=>i).filter(i=>S.cur[i].on), PI=S.prop.map((d,i)=>i).filter(i=>S.prop[i].on);
  const H1=["담보",...CI.map(i=>`[기존·유지] ${S.cur[i].co} ${S.cur[i].prod}`),"기존 합계","유지분 합계",...PI.map(i=>`[제안 ${String.fromCharCode(65+i)}] ${S.prop[i].co} ${S.prop[i].prod}`),"리모델링 후","바뀐 내용(기존 → 후)","증감"];
  const v=(x,yn)=>!x?"-":yn?"가입":Math.round(x.amt*10)/10;
  const out=[H1];
  T.rows.forEach(r=>out.push([r.c.t,...CI.map(i=>v(r.cur[i],r.c.yn)),v(r.before,r.c.yn),v(r.kept,r.c.yn),...PI.map(i=>v(r.prop[i],r.c.yn)),v(r.after,r.c.yn),chg(r).txt||"-",r.c.yn?(r.diff||"-"):Math.round(r.diff*10)/10]));
  out.push(["월 보험료(원)",...CI.map(i=>S.cur[i].prem||0),T.pBefore,T.pKept,...PI.map(i=>S.prop[i].prem||0),T.pAfter,`${T.pBefore.toLocaleString("ko-KR")}원 → ${T.pAfter.toLocaleString("ko-KR")}원`,T.pAfter-T.pBefore]);
  out.push([]); out.push(["※ 금액 단위 만원(보험료는 원). 보장분석·설계서 가입금액 합계이며 실제 지급액은 약관 기준에 따름."]);
  return out;
}
async function saveXlsx(){
  if(!window.XLSX){ S.msg="엑셀 도구를 불러오지 못했습니다."; draw(); return; }
  const ws=XLSX.utils.aoa_to_sheet(aoa()); ws["!cols"]=[{wch:26},...aoa()[0].slice(1).map(()=>({wch:16}))];
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"리모델링 비교표");
  const blob=new Blob([XLSX.write(wb,{bookType:"xlsx",type:"array"})],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const d=new Date(), ymd=d.getFullYear()+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0");
  const name=`리모델링비교표_${ymd}.xlsx`;
  try{ let dl=null; try{ dl=typeof DL!=="undefined"?DL:null; }catch(_){}
    if(dl&&dl.save) await dl.save({filename:name,data:blob});
    else { const u=URL.createObjectURL(blob),a=document.createElement("a"); a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),2000); }
    S.msg="엑셀을 저장했습니다."; }catch(e){ S.msg=e&&e.code==="declined"?"저장을 취소했습니다.":"엑셀 저장에 실패했습니다."; }
  draw();
}
function printIt(){
  const t=document.querySelector(".rm-tbl"); if(!t) return; const s=document.querySelector(".rm-sum"), cl=document.querySelector(".rm-chlist");
  const w=window.open("","_blank"); if(!w){ S.msg="팝업이 막혀 출력 창을 열지 못했습니다."; draw(); return; }
  w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>리모델링 비교표</title><style>
  @page{size:A4 landscape;margin:10mm}body{font-family:Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#1d2420;font-size:11px}
  h1{font-size:17px;margin:0 0 8px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #c9d1cc;padding:4px 6px;text-align:right;white-space:nowrap}
  thead th{background:#eef3f0;text-align:center;white-space:normal}tbody th{text-align:left;background:#f7f9f8}input{display:none}label{font-weight:700}
  .rm-doc b,.rm-doc span{display:block}.rm-doc span{font-weight:400;font-size:10px;color:#556}.off,.dim{color:#9aa;text-decoration:line-through}
  .fin{background:#e7f4ee;font-weight:700}.up{color:#0b7a4b;font-weight:700}.down{color:#c0392b;font-weight:700}.prem th,.prem td{background:#fbf6ea}
  .rm-sum{display:flex;gap:10px;margin-top:10px}.rm-sum div{border:1px solid #c9d1cc;padding:8px 12px;flex:1}.rm-sum span{display:block;color:#667}.rm-sum b{font-size:15px}
  p{color:#667;margin-top:8px}.rm-chg span,.rm-chg b{display:block}.rm-chlist{margin-top:10px;border:1px solid #c9d1cc;padding:8px 12px}.rm-chlist ul{margin:4px 0 0;padding-left:16px;columns:2}.rm-chlist li span{font-weight:700;margin-right:6px}.rm-chlist em{font-style:normal;font-weight:700}</style></head><body><h1>보험 리모델링 비교표</h1>${t.outerHTML}${s?s.outerHTML:""}${cl?cl.outerHTML:""}<p>금액 단위 만원(보험료 원). 보장분석·설계서 가입금액 합계이며 실제 지급액은 약관 지급기준에 따릅니다.</p></body></html>`);
  w.document.close(); setTimeout(()=>{ w.focus(); w.print(); },300);
}

/* ---------- 이벤트 ---------- */
document.addEventListener("change",e=>{
  const t=e.target; if(!t.closest||!t.closest("#rm-root")) return;
  if(t.id==="rm-cov"){ const fs=[...t.files]; t.value=""; addCover(fs); return; }
  if(t.id==="rm-prop"){ const fs=[...t.files]; t.value=""; addProp(fs); return; }
  if(t.dataset.rmon){ const [k,id]=t.dataset.rmon.split(":"); const d=S[k].find(x=>x.id===+id); if(d){ d.on=t.checked; draw(); } return; }
  if(t.dataset.rmcat){ t.checked?S.cats.add(t.dataset.rmcat):S.cats.delete(t.dataset.rmcat); draw(); return; }
  if(t.dataset.rmcatset){ const [k,id,i]=t.dataset.rmcatset.split(":"); const d=S[k].find(x=>x.id===+id); if(d&&d.items[+i]){ d.items[+i].cat=t.value; if(t.value) S.cats.add(t.value); draw(); } return; }
});
document.addEventListener("click",e=>{
  if(!e.target.closest("#rm-root")) return;
  const x=e.target.closest("[data-rmdel]"); if(x){ const [k,id]=x.dataset.rmdel.split(":"); S[k]=S[k].filter(d=>d.id!==+id); draw(); return; }
  const o=e.target.closest("[data-rmopen]"); if(o){ const k=o.dataset.rmopen; S.open[k]=!S.open[k]; draw(); return; }
  if(e.target.closest("#rm-custgo")){ loadCust(); return; }
  if(e.target.closest("#rm-xlsx")){ saveXlsx(); return; }
  if(e.target.closest("#rm-print")){ printIt(); return; }
});

const CSS=`
.rm-steps{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.rm-step h3,.rm-h3{display:flex;align-items:center;gap:8px;font-size:16px;margin:0 0 10px}
.rm-step h3 span,.rm-h3 span{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--c4);color:#fff;font-size:13px}
.rm-h3 small{font-weight:400;color:var(--muted);font-size:12.5px;margin-left:6px}
.rm-btns{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.rm-or{display:flex;gap:6px}.rm-or input{padding:9px 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--fg);font:inherit;width:170px}
.rm-hint{font-size:12.5px;color:var(--muted);margin:8px 0 0;line-height:1.55}
.rm-msg{font-size:13px;color:var(--c4);margin:10px 2px 0;min-height:1em}
.rm-list{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}
.rm-list li{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--line);border-radius:10px;font-size:13.5px}
.rm-list li>div{flex:1;min-width:0}.rm-list em{display:block;font-style:normal;font-size:12px;color:var(--muted)}
.rm-list li.off>div{color:var(--muted);text-decoration:line-through}
.rm-sw{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;background:color-mix(in srgb,var(--c4) 14%,var(--surface));font-weight:700;font-size:12.5px;cursor:pointer;white-space:nowrap}
.rm-list li.off .rm-sw{background:color-mix(in srgb,#c0392b 14%,var(--surface));color:#c0392b}
.rm-x{border:0;background:none;color:var(--muted);cursor:pointer}
.rm-cats{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
.rm-cg{display:flex;flex-direction:column;gap:5px}.rm-cg>b{font-size:13px;color:var(--muted);margin-bottom:2px}
.rm-cg label{display:flex;gap:6px;align-items:flex-start;padding:6px 8px;border:1px solid var(--line);border-radius:8px;font-size:13px;cursor:pointer;line-height:1.35}
.rm-cg label.on{border-color:var(--c4);background:color-mix(in srgb,var(--c4) 8%,var(--surface));font-weight:600}
.rm-wrap{margin-top:10px;max-height:70vh;overflow:auto}
.rm-tbl{border-collapse:separate;border-spacing:0;min-width:100%;font-size:13px}
.rm-tbl th,.rm-tbl td{border-right:1px solid var(--line);border-bottom:1px solid var(--line);padding:7px 9px;white-space:nowrap;background:var(--surface)}
.rm-tbl thead th{position:sticky;top:0;z-index:2;background:color-mix(in srgb,var(--c4) 8%,var(--surface));text-align:center;font-size:12.5px;vertical-align:bottom}
.rm-tbl thead tr:nth-child(2) th{top:31px}
.rm-tbl th.grp.cur{background:color-mix(in srgb,#5b6b73 12%,var(--surface))}.rm-tbl th.grp.prop{background:color-mix(in srgb,#2f6fb0 14%,var(--surface))}
.rm-sticky{position:sticky;left:0;z-index:1;text-align:left!important;font-weight:600}.rm-tbl thead .rm-sticky{z-index:3}
.rm-doc{min-width:118px;white-space:normal!important}.rm-doc label{display:block;font-size:11.5px;cursor:pointer;margin-bottom:3px}
.rm-doc b{display:block;font-size:12.5px}.rm-doc span{display:block;font-weight:400;font-size:11px;color:var(--muted);line-height:1.3}
.rm-doc.off b,.rm-doc.off span{text-decoration:line-through;color:var(--muted)}
.rm-n{text-align:right}.rm-n.dim{color:var(--muted);text-decoration:line-through}
.rm-tbl .sum{min-width:78px}.rm-tbl td.fin,.rm-tbl th.fin{background:color-mix(in srgb,var(--c4) 12%,var(--surface));font-weight:700}
.rm-n.up{color:#0b7a4b;font-weight:700}.rm-n.down{color:#c0392b;font-weight:700}
.rm-tbl tr.prem th,.rm-tbl tr.prem td{background:color-mix(in srgb,#d9a441 12%,var(--surface));font-weight:600}
.rm-chg span{display:block;font-weight:500;color:var(--fg);font-size:12.5px}.rm-chg b{display:block;font-size:12.5px}
.rm-chlist{margin-top:12px;border:1px solid var(--line);border-radius:10px;padding:10px 14px}.rm-chlist>b{font-size:14px}
.rm-chlist ul{margin:6px 0 0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:4px 18px}
.rm-chlist li{font-size:13px}.rm-chlist li span{display:inline-block;min-width:150px;font-weight:600}.rm-chlist em{font-style:normal;font-weight:700;margin-left:4px}
.rm-chlist li.up em{color:#0b7a4b}.rm-chlist li.down em{color:#c0392b}
.rm-sum{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}
.rm-sum>div{border:1px solid var(--line);border-radius:10px;padding:10px 12px}.rm-sum span{display:block;font-size:12px;color:var(--muted)}.rm-sum b{font-size:17px}
.rm-sum .hi{border-color:var(--c4);background:color-mix(in srgb,var(--c4) 10%,var(--surface))}.rm-sum .hi b{color:var(--c4)}
.rm-doc-it{border-top:1px solid var(--line)}.rm-acc{display:block;width:100%;text-align:left;border:0;background:none;padding:9px 2px;font:inherit;color:var(--fg);cursor:pointer}
.rm-acc small{color:var(--muted);margin-left:6px}
.rm-items{width:100%;border-collapse:collapse;margin:0 0 10px;font-size:13px}.rm-items td{padding:4px 6px;border-bottom:1px dashed var(--line)}
.rm-items tr.un td:first-child{color:var(--muted)}.rm-items select{padding:5px 6px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--fg);font:inherit;font-size:12.5px}
@media(max-width:900px){.rm-steps{grid-template-columns:1fr}.rm-cats{grid-template-columns:1fr 1fr}.rm-sum{grid-template-columns:1fr 1fr}}
`;
const st=document.createElement("style"); st.textContent=CSS; document.head.appendChild(st);
window.REMODEL={draw,S,classify,table,CATS};
if(document.readyState!=="loading") draw(); else document.addEventListener("DOMContentLoaded",draw);
})();
