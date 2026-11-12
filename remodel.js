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

const S={ sov:{}, pov:{}, labels:{}, memo:"", cname:"", cur:[], prop:[], cats:new Set(CATS.filter(c=>c.on).map(c=>c.k)), msg:"", busy:false, open:{}, custom:[], hide:new Set() };
const getCat=k=>CAT[k]||S.custom.find(c=>c.k===k)||{k,t:k};
const hasOv=(d,k)=>d.ov&&Object.prototype.hasOwnProperty.call(d.ov,k);
let SEQ=1;
const manOf=t=>{ const B=window.BOSANG; if(typeof t==="number") return t; const v=B&&B.manAny?B.manAny(String(t||"")):null; return v==null?null:v; };

/* 세부보장이 딸린 담보(예: 암종별(30종) 통합암진단비 → [위암]·[폐암]… 부위별 금액) 정리
   - 머리 담보에 가입금액이 없으면 세부 금액 중 가장 큰 값을 머리 담보 금액으로 (부위마다 각각 지급 = 한 부위 기준 금액)
   - 세부 줄은 합산하지 않음(부위 수만큼 더해지는 것 방지) */
function fixSubs(items,details){
  /* 기준 이름: 공백·[기본계약] 같은 대괄호 표시·갱신형/무배당 머리말·└ 표시 제거 (괄호 속 부위명은 남김) */
  const base=s=>String(s||"").replace(/\s+/g,"").replace(/\[[^\]]*\]/g,"").replace(/^[┗└ㄴ·\-]+/,"").replace(/^\d{1,3}(?=[가-힣(])/,"").replace(/^(갱신형|무배당|\(무\))+/,"");
  const stripLast=s=>s.replace(/\((?:[^()]|\([^()]*\))*\)$/,"");
  const miss=v=>v==null||!(+v>0);
  items.forEach(h=>{
    if(h.sub) return; const hb=base(h.name); if(hb.length<6) return;
    /* 세부보장: 머리 담보 이름 뒤에 (부위명)이 붙은 담보들 — 예: …통합암진단비(전이포함)(유사암제외)(위암(전이포함)) */
    const subs=items.filter(s=>s!==h&&!s.sub&&base(s.name).length>hb.length&&base(s.name).indexOf(hb)===0&&/^\(/.test(base(s.name).slice(hb.length)));
    if(subs.length&&(subs.length>=2||miss(h.amt))){ if(miss(h.amt)){ const v=Math.max(0,...subs.map(s=>+s.amt||0)); if(v){ h.amt=v; h.note=`세부보장 ${subs.length}개 · 부위마다 최대 ${fmt(v)}`; } } h.nsub=subs.length; subs.forEach(s=>{ s.sub=1; s.cat=""; }); }
    if(miss(h.amt)&&Array.isArray(details)){ const d=details.find(t=>{ const tb=base(t.rider); return tb===hb||tb.indexOf(hb)===0||hb.indexOf(tb)===0; });
      if(d){ const v=Math.max(0,...(d.rows||[]).map(r=>+r.amt||0)); if(v){ h.amt=v; h.note="세부 지급표 중 최대 금액"; } } }
    if(miss(h.amt)&&h.cat) h.amt=null;
  });
  /* 머리 담보 없이 세부 담보만 있으면: 같은 머리 이름끼리 한 줄만 남김(가장 큰 금액) */
  const seen={}; items.filter(i=>!i.sub&&i.cat&&/\)$/.test(base(i.name))).forEach(i=>{ const k=i.cat+"|"+stripLast(base(i.name)); const o=seen[k];
    if(!o){ seen[k]=i; return; } if(stripLast(base(o.name))===base(o.name)) return; /* 이미 머리 담보 */
    if((+i.amt||0)>(+o.amt||0)){ o.sub=1; o.cat=""; seen[k]=i; } else { i.sub=1; i.cat=""; } });
  return items.filter(i=>i.amt!=null||i.cat);
}

/* ---------- 읽기 ---------- */
async function addCover(files){
  for(const f of files){
    S.msg=`${f.name} 읽는 중…`; draw();
    try{
      if(typeof bsReadPdf!=="function") throw new Error("보장분석 읽기 도구가 없습니다.");
      const r=await bsReadPdf(f);
      if(!r.ctrs.length){ S.msg=`${f.name}: 계약·담보 표를 찾지 못했습니다. 메리츠 간편보장분석 또는 신용정보원 보장분석 PDF인지 확인하세요.`; continue; }
      r.ctrs.forEach(o=>S.cur.push({id:SEQ++,co:o.co,prod:o.prod,from:o.from||"",prem:o.prem||0,on:true,
        items:fixSubs(o.items.map(x=>({name:x.name,amt:x.amt/1e4,cat:x.kind==="정액"?classify(x.name):""})))}));
      if(r.name&&!S.cname) S.cname=r.name; S.msg=`${f.name}: 계약 ${r.ctrs.length}건을 읽었습니다.${r.name?` (고객 ${r.name})`:""}`;
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
  { const cu=(typeof CUSTOMERS!=="undefined"?CUSTOMERS:[]).find(x=>x.id===id); if(cu&&!S.cname) S.cname=cu.name; } S.msg=`저장된 계약 ${ks.length}건을 불러왔습니다.`; draw();
}
async function addProp(files){
  const B=window.BOSANG;
  if(!B||!B.readProposal||!window.pdfjsLib){ S.msg="설계서 읽기 도구를 불러오지 못했습니다. 새로고침 후 다시 시도하세요."; draw(); return; }
  for(const f of files){
    S.msg=`${f.name} 읽는 중… (AI가 읽는 회사는 10~20초 걸립니다)`; draw();
    try{
      const r=await B.readProposal(f,window.pdfjsLib), p=r.p;
      const items=fixSubs((p.items||[]).filter(i=>!i.group).map(i=>({name:i.name,amt:i.amt,cat:classify(i.name),per:i.per||"",raw:i.amtText||""})),p.details);
      const prem=p.premium||(p.items||[]).reduce((a,i)=>a+(+i.prem||0),0);
      S.prop.push({id:SEQ++,co:p.company||"",prod:p.product||f.name.replace(/\.pdf$/i,""),prem:+prem||0,on:true,items,ai:r.source==="ai"});
      S.msg=`${f.name}: 담보 ${items.length}개를 읽었습니다.${r.source==="ai"?" AI가 읽은 표이니 금액을 원본과 대조해 주세요.":""}`;
    }catch(e){ S.msg=`${f.name}: ${e&&e.msg?e.msg:"읽지 못했습니다."}`; }
  }
  draw();
}

/* ---------- 계산 ---------- */
function cellOf(doc,k){
  const C=getCat(k);
  if(hasOv(doc,k)){ const v=doc.ov[k]; if(v==null||v===""||v===0) return {none:true,ed:1}; return C.yn?{yn:true,names:["직접 입력"],ed:1}:{amt:+v,names:["직접 입력 "+fmt(+v)],ed:1}; }
  const its=doc.items.filter(i=>i.cat===k); if(!its.length) return null;
  if(C.yn){ return {yn:true,names:its.map(i=>i.name)}; }
  return {amt:its.reduce((a,i)=>a+(+i.amt||0),0),names:its.map(i=>i.name+" "+(+i.amt>0?fmt(+i.amt):"금액 못 읽음")),unk:its.every(i=>!(+i.amt>0))};
}
function sumOf(docs,k){
  const cs=docs.map(d=>cellOf(d,k)).filter(x=>x&&!x.none); if(!cs.length) return null;
  if(getCat(k).yn) return {yn:true,names:cs.flatMap(c=>c.names)};
  return {amt:cs.reduce((a,c)=>a+c.amt,0)};
}
function table(){
  const cats=CATS.filter(c=>S.cats.has(c.k)).concat(S.custom).map(c=>S.labels[c.k]?Object.assign({},c,{t:S.labels[c.k]}):c);
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
  /* 암진단비 합계: 일반암 + 통합암 + 전이암 포함 진단비 (유사암 제외) */
  const CK=["cancer","cancer_all","cancer_meta"], ci=rows.findIndex(r=>CK.includes(r.c.k));
  if(ci>=0){
    const tot=list=>{ const xs=list.filter(x=>x&&!x.none); return xs.length?{amt:xs.reduce((a,x)=>a+(x.amt||0),0),names:xs.flatMap(x=>x.names||[])}:null; };
    const docT=d=>tot(CK.map(k=>cellOf(d,k)));
    const sumT=ds=>tot(ds.map(docT));
    const before=sumT(S.cur), kept=sumT(keep), add=sumT(props), after=kept||add?{amt:(kept?kept.amt:0)+(add?add.amt:0)}:null;
    rows.splice(ci,0,{c:{k:"cancer_total",t:S.labels.cancer_total||"암진단비 합계 (일반·통합·전이)",total:1},cur:S.cur.map(docT),before,kept,prop:S.prop.map(docT),add,after,diff:(after?after.amt:0)-(before?before.amt:0)});
  }
  /* 합계 칸 직접 수정: 기존 합계·유지분 합계·리모델링 후 (고친 값이 있으면 그 값으로, 바뀐 내용은 다시 계산) */
  const has=(o,f)=>o&&Object.prototype.hasOwnProperty.call(o,f);
  const val=(yn,v)=>yn?(v?{yn:true,names:["직접 입력"]}:null):(+v>0?{amt:+v,names:["직접 입력"]}:null);
  rows.forEach(r=>{ const o=S.sov[r.c.k], yn=!!r.c.yn; r.ed={}; if(!o) return;
    ["before","kept"].forEach(f=>{ if(has(o,f)){ r[f]=val(yn,o[f]); r.ed[f]=1; } });
    if(has(o,"after")){ r.after=val(yn,o.after); r.ed.after=1; }
    else if(r.ed.kept){ if(yn) r.after=r.kept||r.add?{yn:true}:null; else r.after=r.kept||r.add?{amt:(r.kept?r.kept.amt:0)+(r.add?r.add.amt:0)}:null; }
    r.diff=yn?(!r.before&&r.after?"신규":r.before&&!r.after?"없어짐":r.before&&r.after?"유지":""):((r.after?r.after.amt:0)-(r.before?r.before.amt:0)); });
  const P=S.pov, pB=has(P,"before")?+P.before||0:pBefore, pK=has(P,"kept")?+P.kept||0:pKept, pA=has(P,"after")?+P.after||0:pK+pAdd;
  return {cats,rows,pBefore:pB,pKept:pK,pAdd,pAfter:pA,ped:{before:has(P,"before"),kept:has(P,"kept"),after:has(P,"after")},cancer:cancerFeat(keep,props)};
}

/* 암 보장 방식 비교: 담보명에 적힌 것만으로 판단 (통합암 = 부위별 각각, '전이' 표기 = 전이암 포함, 'N종' = 부위 수) */
function featOf(docs){
  const its=docs.flatMap(d=>d.items.filter(i=>["cancer","cancer_all","cancer_meta"].includes(i.cat)));
  const ovA=docs.some(d=>d.ov&&+d.ov.cancer_all), ovM=docs.some(d=>d.ov&&+d.ov.cancer_meta), ovC=docs.some(d=>d.ov&&+d.ov.cancer);
  const site=its.some(i=>i.cat==="cancer_all")||ovA;
  const meta=its.some(i=>(/전이/.test(i.name)&&!/전이.*(제외|불포함)/.test(i.name))||i.cat==="cancer_meta")||ovM;
  const ns=its.map(i=>(String(i.name).match(/(\d{1,2})\s*종/)||[])[1]).filter(Boolean).map(Number); const n=ns.length?Math.max(...ns):0;
  return {any:its.length>0||ovA||ovM||ovC,site,meta,n};
}
function featTxt(f){ if(!f.any) return "암진단비 없음";
  return [f.site?`통합암${f.n?` ${f.n}종`:""} 부위별 각각 지급`:"부위별 보장 없음", f.meta?"전이암 포함":"전이암 포함 표기 없음"].join(" · "); }
S.cf=S.cf||{b:{},a:{}};
function cancerFeat(keep,props){ const b=Object.assign(featOf(S.cur),S.cf.b), a=Object.assign(featOf(keep.concat(props)),S.cf.a); return {b,a,bt:featTxt(b),at:featTxt(a),better:(!b.site&&a.site)||(!b.meta&&a.meta)}; }
function cancerNote(T){ if(S.cnote!=null) return S.cnote; const k=T.cancer; if(!k.better) return "";
  const pts=[]; if(!k.b.meta&&k.a.meta) pts.push("기존에는 전이암을 따로 보장받지 못했지만, 이제 전이된 암도 보장"); if(!k.b.site&&k.a.site) pts.push(`암이 생긴 부위마다 각각 진단비 지급${k.a.n?`(${k.a.n}종)`:""}`);
  return pts.join(" · "); }

/* 칸 너비 조절: 머리 칸 오른쪽 끝을 끌어서 */
S.w=S.w||{};
function colRules(keys){ return keys.map((k,i)=>S.w[k]?`.rm-tbl tbody tr>*:nth-child(${i+1}),.rm-tbl thead th[data-col="${k}"]{width:${S.w[k]}px;min-width:${S.w[k]}px;max-width:${S.w[k]}px}`:"").join("\n"); }

/* ---------- 화면 ---------- */
const cellH=(x,yn,dim)=>{ if(!x) return `<td class="rm-n${dim?" dim":""}">-</td>`;
  const tip=esc((x.names||[]).join("\n"));
  return yn?`<td class="rm-n${dim?" dim":""}" title="${tip}">가입</td>`:`<td class="rm-n${dim?" dim":""}" title="${tip}">${fmt(x.amt)}</td>`; };
const valTxt=x=>!x||x.none||x.unk?"":x.yn?"가입":fmt(x.amt);
/* 계약·제안 칸: 바로 고쳐 쓰는 칸 (엑셀처럼) */
function edCell(kind,d,r,cls){
  const x=r[kind==="cur"?"cur":"prop"][(kind==="cur"?S.cur:S.prop).indexOf(d)], key=`${kind}:${d.id}:${r.c.k}`, ed=x&&x.ed, tip=esc(((x&&x.names)||[]).join("\n"));
  const reset=ed?`<button type="button" class="rm-rs" data-rmrs="${key}" title="원래 값으로">↺</button>`:"";
  if(r.c.yn) return `<td class="rm-e ${cls}${ed?" ed":""}" title="${tip}"><select data-rmed="${key}"><option value="">-</option><option value="Y" ${x&&!x.none?"selected":""}>가입</option></select>${reset}</td>`;
  return `<td class="rm-e ${cls}${ed?" ed":""}" title="${tip}"><input data-rmed="${key}" value="${esc(valTxt(x))}" placeholder="${x&&x.unk?"금액 입력":"-"}" class="${x&&x.unk?"unk":""}" inputmode="decimal">${reset}</td>`;
}
function parseAmt(s){ s=String(s||"").replace(/[\s,]/g,"").replace(/원$/,""); if(!s||s==="-") return null; if(/^\d+(\.\d+)?$/.test(s)) return +s;
  const B=window.BOSANG; let v=B&&B.manAny?B.manAny(s):null; if(v==null&&B&&B.manAny) v=B.manAny(s+"원"); return v==null?undefined:v; }
/* 합계 칸(기존 합계·유지분 합계·리모델링 후)도 고쳐 쓰기 */
function sumCell(r,f,cls){
  const x=r[f], key=`${r.c.k}:${f}`, ed=r.ed&&r.ed[f];
  const reset=ed?`<button type="button" class="rm-rs" data-rmsrs="${key}" title="자동 계산으로">↺</button>`:"";
  if(r.c.yn) return `<td class="rm-e ${cls||""}${ed?" ed":""}"><select data-rmsum="${key}"><option value="">-</option><option value="Y" ${x?"selected":""}>가입</option></select>${reset}</td>`;
  return `<td class="rm-e ${cls||""}${ed?" ed":""}"><input data-rmsum="${key}" value="${x?esc(fmt(x.amt)):""}" placeholder="-" inputmode="decimal">${reset}</td>`;
}
function premSum(T,f,cls){ const v=f==="before"?T.pBefore:f==="kept"?T.pKept:T.pAfter, ed=T.ped[f];
  return `<td class="rm-e ${cls||""}${ed?" ed":""}"><input data-rmpsum="${f}" value="${v?Math.round(v).toLocaleString("ko-KR"):""}" placeholder="0" inputmode="numeric">${ed?`<button type="button" class="rm-rs" data-rmpsrs="${f}" title="자동 계산으로">↺</button>`:""}</td>`; }
/* 바뀐 내용: '기존 → 리모델링 후 (증감)' */
function chg(r){
  if(!r.before&&!r.after) return {txt:"",cls:"",d:0};
  if(r.c.yn){ const a=r.before?"가입":"없음", b=r.after?"가입":"없음"; return {txt:`${a} → ${b}`,tag:r.diff,cls:{신규:"new",없어짐:"down"}[r.diff]||"",d:0}; }
  const a=r.before?fmt(r.before.amt):"없음", b=r.after?fmt(r.after.amt):"없음", d=Math.round(r.diff*10)/10;
  return {txt:`${a} → ${b}`,tag:d?(d>0?"+":"−")+fmt(Math.abs(d)):"변동 없음",cls:!r.before&&r.after?"new":d>0?"up":d<0?"down":"",d};
}
function diffH(r){ const x=chg(r); if(!x.txt) return `<td class="rm-n">-</td>`;
  return `<td class="rm-n rm-chg ${x.cls}"><span>${x.txt}</span><b>${x.tag}</b></td>`; }
function draw(){
  const R=$("#rm-root"); if(!R) return;
  const T=table();
  const docHead=(d,kind)=>`<th class="rm-doc ${kind}${d.on?"":" off"}" data-col="${kind}:${d.id}"><i class="rm-rz" data-rz="${kind}:${d.id}"></i><label><input type="checkbox" data-rmon="${kind}:${d.id}" ${d.on?"checked":""}> ${kind==="cur"?(d.on?"유지":"해지"):(d.on?"가입":"제외")}</label><button type="button" class="rm-colx" data-rmdel="${kind}:${d.id}" title="이 칸 삭제">✕</button><b>${esc(d.co||"")}</b><span>${esc(String(d.prod||"").slice(0,26))}</span></th>`;
  const hb=k=>S.hide.has(k), hx=k=>`<button type="button" class="rm-colx" data-rmhide="${k}" title="이 칸 숨기기">✕</button>`;
  const premCell=(kind,d,cls)=>`<td class="rm-e ${cls}${d.premEd?" ed":""}"><input data-rmprem="${kind}:${d.id}" value="${d.prem?Math.round(d.prem).toLocaleString("ko-KR"):""}" placeholder="0" inputmode="numeric">${d.premEd?`<button type="button" class="rm-rs" data-rmprs="${kind}:${d.id}" title="원래 값으로">↺</button>`:""}</td>`;
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
    <div class="row between"><h3 class="rm-h3" style="margin:0"><span>4</span>리모델링 비교표 <small>단위 만원 · 모든 금액 칸은 자동 계산되고, 눌러서 바로 고칠 수 있습니다</small></h3>
      <div class="rm-btns"><button class="btn" type="button" id="rm-xlsx">엑셀 받기</button><button class="btn primary" type="button" id="rm-print">리포트 출력</button></div></div>
    <div class="rm-legend"><span class="rm-lg pc">제안 칸</span><span class="rm-lg up">늘어남</span><span class="rm-lg new">새로 생김</span><span class="rm-lg down">줄어듦·없어짐</span><span class="rm-lg ed">● 직접 고친 칸 (↺ 원래대로)</span><span class="rm-lg">✕ 칸·줄 삭제</span><span class="rm-lg">↔ 머리 칸 오른쪽 끝을 끌어 너비 조절${Object.keys(S.w).length?` · <button type="button" class="lnk" id="rm-wreset">너비 원래대로</button>`:""}</span></div>
    <style id="rm-colw">${colRules(["lab",...VC.map(d=>"cur:"+d.id),...(hb("before")?[]:["before"]),...(hb("kept")?[]:["kept"]),...VP.map(d=>"prop:"+d.id),"after","chg"])}</style>
    <div class="tbl-wrap rm-wrap"><table class="rm-tbl"><thead>
      <tr><th class="rm-sticky" rowspan="2" data-col="lab">담보<i class="rm-rz" data-rz="lab"></i></th>${VC.length?`<th colspan="${VC.length}" class="grp cur">기존 계약 (유지)</th>`:""}${hb("before")?"":`<th rowspan="2" class="sum" data-col="before">${hx("before")}기존<br>합계<i class="rm-rz" data-rz="before"></i></th>`}${hb("kept")?"":`<th rowspan="2" class="sum" data-col="kept">${hx("kept")}유지분<br>합계<i class="rm-rz" data-rz="kept"></i></th>`}${VP.length?`<th colspan="${VP.length}" class="grp prop">제안</th>`:""}<th rowspan="2" class="sum fin" data-col="after">리모델링<br>후<i class="rm-rz" data-rz="after"></i></th><th rowspan="2" class="sum chgh" data-col="chg">바뀐 내용<br><small>기존 → 후</small><i class="rm-rz" data-rz="chg"></i></th></tr>
      <tr>${VC.map(d=>docHead(d,"cur")).join("")}${VP.map(d=>docHead(d,"prop")).join("")}</tr></thead><tbody>
      ${T.rows.map(r=>{ const x=chg(r);
        if(r.c.total) return `<tr class="rm-tot"><th class="rm-sticky"><input class="rm-lab" data-rmlab="${r.c.k}" value="${esc(r.c.t)}" title="눌러서 이름 고치기"></th>${CI.map(i=>cellH(r.cur[i])).join("")}${hb("before")?"":sumCell(r,"before")}${hb("kept")?"":sumCell(r,"kept")}${PI.map(i=>cellH(r.prop[i]).replace('class="rm-n','class="rm-n pc')).join("")}${sumCell(r,"after","fin "+x.cls)}<td class="rm-n rm-chg ${x.cls}">${x.txt?`<span>${x.txt}</span><b>${x.tag}</b>`:"-"}${T.cancer.better?`<i class="rm-feat">${esc(T.cancer.at)}</i>`:""}</td></tr>`;
        return `<tr><th class="rm-sticky"><button type="button" class="rm-rowx" data-rmrow="${r.c.k}" title="이 줄 삭제">✕</button><input class="rm-lab" data-rmlab="${r.c.k}" value="${esc(r.c.t)}" title="눌러서 이름 고치기"></th>${VC.map(d=>edCell("cur",d,r,"cc")).join("")}${hb("before")?"":sumCell(r,"before")}${hb("kept")?"":sumCell(r,"kept")}${VP.map(d=>edCell("prop",d,r,"pc")).join("")}${sumCell(r,"after","fin "+x.cls)}${diffH(r)}</tr>`; }).join("")}
      <tr class="prem"><th class="rm-sticky">월 보험료(원)</th>${VC.map(d=>premCell("cur",d,"cc")).join("")}${hb("before")?"":premSum(T,"before")}${hb("kept")?"":premSum(T,"kept")}${VP.map(d=>premCell("prop",d,"pc")).join("")}${premSum(T,"after","fin "+(T.pAfter>T.pBefore?"down":T.pAfter<T.pBefore?"up":""))}${(()=>{const d=T.pAfter-T.pBefore; return `<td class="rm-n rm-chg ${d>0?"down":d<0?"up":""}"><span>${wonTxt(T.pBefore)} → ${wonTxt(T.pAfter)}</span><b>${d?(d>0?"+":"−")+Math.abs(d).toLocaleString("ko-KR")+"원":"변동 없음"}</b></td>`;})()}</tr>
    </tbody></table></div>
    <div class="rm-tools"><div class="rm-add"><input id="rm-newrow" placeholder="추가할 담보 이름 (예: 표적항암약물치료비)"><label><input type="checkbox" id="rm-newyn"> 가입 여부로</label><button class="btn" type="button" id="rm-addrow">+ 줄 추가</button></div>
      ${S.hide.size?`<span class="rm-hid">숨긴 칸: ${[...S.hide].map(k=>({before:"기존 합계",kept:"유지분 합계"})[k]).join(", ")} <button type="button" class="lnk" id="rm-unhide">다시 보기</button></span>`:""}</div>
    <div class="rm-sum"><div><span>지금 월 보험료</span><b>${wonTxt(T.pBefore)}</b></div><div><span>해지로 줄어드는 보험료</span><b>${wonTxt(T.pBefore-T.pKept)}</b></div><div><span>제안 추가 보험료</span><b>${wonTxt(T.pAdd)}</b></div><div class="hi"><span>리모델링 후 월 보험료</span><b>${wonTxt(T.pAfter)}</b></div></div>
    ${T.cancer.b.any||T.cancer.a.any?`<div class="rm-cancer${T.cancer.better?" good":""}"><b>암 보장 방식</b>
      <div class="rm-cmp"><span><em>기존</em>${esc(T.cancer.bt)}</span><span class="ar">→</span><span><em>리모델링 후</em>${esc(T.cancer.at)}</span></div>
      <div class="rm-cfs">${[["b","기존",T.cancer.b],["a","리모델링 후",T.cancer.a]].map(([w,l,f])=>`<div><em>${l}</em><label><input type="checkbox" data-rmcf="${w}:site" ${f.site?"checked":""}> 부위별 각각</label><label><input data-rmcf="${w}:n" value="${f.n||""}" inputmode="numeric" placeholder="-" style="width:44px">종</label><label><input type="checkbox" data-rmcf="${w}:meta" ${f.meta?"checked":""}> 전이암 포함</label></div>`).join("")}<small>담보명으로 자동 표시 — 약관·설계서와 다르면 여기서 고치세요</small></div>
      <label class="rm-cn">고객 안내 문구 (고쳐 쓸 수 있음)<textarea id="rm-cnote" rows="2" placeholder="예: 기존에는 전이암을 따로 보장받지 못했지만, 이제 30종 부위별로 전이암까지 각각 보장">${esc(cancerNote(T))}</textarea></label></div>`:""}
    ${(()=>{ const ch=T.rows.map(r=>[r,chg(r)]).filter(([r,x])=>x.txt&&x.tag!=="변동 없음"&&x.tag!=="유지");
      return ch.length?`<div class="rm-chlist"><b>바뀐 담보</b><ul>${ch.map(([r,x])=>`<li class="${x.cls}"><span>${esc(r.c.t)}</span>${x.txt} <em>${x.tag}</em></li>`).join("")}</ul></div>`:""; })()}
    <p class="rm-hint">해지한 계약·제외한 제안은 표에서 빠지고 '기존 합계'에만 들어갑니다. 다시 넣으려면 위 1·2번 목록에서 체크하세요. 금액은 보장분석·설계서에 적힌 가입금액 합계입니다(실제 지급액은 약관 지급기준·감액기간에 따름). 보장분석 보험료가 '미제공'인 계약은 0원으로 표시됩니다. 해지 전 새 계약 인수 확정, 해지환급금, 면책·감액기간 재시작을 고객에게 안내하세요.</p>
  </div>
  <div class="panel" style="margin-top:12px"><h3 class="rm-h3" style="margin:0 0 8px"><span>5</span>리포트 정보 <small>바로 출력 리포트에 들어갑니다</small></h3>
    <div class="rm-rep"><label>고객 이름<input id="rm-cname" value="${esc(S.cname)}" placeholder="예: 홍길동"></label>
    <label class="w">상담 메모<textarea id="rm-memo" rows="4" placeholder="예: 기존 KB 건강보험은 갱신형이라 보험료 상승 부담 → 비갱신형으로 전환. 심장 진단비 보강. 다음 상담 12/1.">${esc(S.memo)}</textarea></label></div>
  </div>
  <div class="panel" style="margin-top:12px"><h3 class="rm-h3" style="margin:0 0 8px"><span>6</span>담보 분류 확인 <small>표에 안 들어간 담보·잘못 들어간 담보를 바꿀 수 있습니다</small></h3>
    ${[...S.cur.map(d=>["cur",d]),...S.prop.map(d=>["prop",d])].map(([kind,d])=>{ const key=kind+":"+d.id, open=!!S.open[key], n=d.items.filter(i=>i.cat).length;
      return `<div class="rm-doc-it"><button type="button" class="rm-acc" data-rmopen="${key}">${open?"▾":"▸"} ${kind==="cur"?"기존":"제안"} · <b>${esc(d.co)}</b> ${esc(String(d.prod).slice(0,30))} <small>담보 ${d.items.length}개 중 ${n}개 분류됨</small></button>
      ${open?`<table class="rm-items"><tbody>${d.items.map((it,i)=>`<tr class="${it.cat?"":"un"}"><td>${esc(it.name)}</td><td class="rm-n">${+it.amt>0?fmt(+it.amt):'<span style="color:#c0392b">금액 못 읽음</span>'}${it.note?`<br><small class="note">${esc(it.note)}</small>`:""}${it.raw&&!(+it.amt>0)?`<br><small class="note">원문: ${esc(it.raw)}</small>`:""}</td><td><select data-rmcatset="${key}:${i}"><option value="">(표에 안 넣음)</option>${CATS.map(c=>`<option value="${c.k}" ${it.cat===c.k?"selected":""}>${esc(c.t)}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table>`:""}</div>`; }).join("")}
  </div>`:""}`;
}

/* ---------- 엑셀·출력 ---------- */
function aoa(){
  const T=table(), CI=S.cur.map((d,i)=>i).filter(i=>S.cur[i].on), PI=S.prop.map((d,i)=>i).filter(i=>S.prop[i].on);
  const hb=k=>S.hide.has(k), opt=(k,v)=>hb(k)?[]:[v];
  const H1=["담보",...CI.map(i=>`[기존·유지] ${S.cur[i].co} ${S.cur[i].prod}`),...opt("before","기존 합계"),...opt("kept","유지분 합계"),...PI.map(i=>`[제안 ${String.fromCharCode(65+i)}] ${S.prop[i].co} ${S.prop[i].prod}`),"리모델링 후","바뀐 내용(기존 → 후)","증감"];
  const v=(x,yn)=>!x?"-":yn?"가입":Math.round(x.amt*10)/10;
  const out=[H1];
  T.rows.forEach(r=>out.push([r.c.t,...CI.map(i=>v(r.cur[i]&&!r.cur[i].none?r.cur[i]:null,r.c.yn)),...opt("before",v(r.before,r.c.yn)),...opt("kept",v(r.kept,r.c.yn)),...PI.map(i=>v(r.prop[i]&&!r.prop[i].none?r.prop[i]:null,r.c.yn)),v(r.after,r.c.yn),chg(r).txt||"-",r.c.yn?(r.diff||"-"):(!r.before&&!r.after?"-":Math.round(r.diff*10)/10)]));
  out.push(["월 보험료(원)",...CI.map(i=>S.cur[i].prem||0),...opt("before",T.pBefore),...opt("kept",T.pKept),...PI.map(i=>S.prop[i].prem||0),T.pAfter,`${T.pBefore.toLocaleString("ko-KR")}원 → ${T.pAfter.toLocaleString("ko-KR")}원`,T.pAfter-T.pBefore]);
  const cn=cancerNote(T); out.push(["암 보장 방식",`기존: ${T.cancer.bt}`,`리모델링 후: ${T.cancer.at}`]); if(cn) out.push(["고객 안내",cn]);
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
/* 리포트: 1장 기존·제안 계약(유지·해지) + 보험료 → 2장 비교표 → 3장 좋아진 점·암 보장 방식·메모 */
function printIt(){
  const T=table(), A=aoa(), hdr=A[0], body=A.slice(1).filter(r=>r.length>1&&!/^(암 보장 방식|고객 안내)$/.test(r[0]));
  const w$=n=>n?Math.round(n).toLocaleString("ko-KR")+"원":"-";
  const nm=S.cname?esc(S.cname)+" 고객님":"고객님";
  let me={}; try{ me=typeof ME!=="undefined"?ME:{}; }catch(_){}
  const ymd=(()=>{ const d=new Date(Date.now()+9*3600e3); return d.toISOString().slice(0,10); })();
  const ctrRows=(list,kind)=>list.map((d,i)=>`<tr class="${d.on?"":"off"}"><td class="c"><span class="tag ${kind}${d.on?"":" x"}">${kind==="cur"?(d.on?"유지":"해지"):(d.on?"가입":"제외")}</span></td><td class="l">${kind==="prop"?String.fromCharCode(65+i)+". ":""}${esc(d.co)}</td><td class="l">${esc(d.prod)}</td>${kind==="cur"?`<td>${esc(d.from||"")}</td>`:""}<td>${w$(d.prem)}</td></tr>`).join("");
  const p1=`<section class="pg"><div class="hd"><div><small>BOIT 보험 리모델링 리포트</small><h1>${nm} 보험 리모델링 제안</h1></div><div class="who">${esc(me.name||"")}${me.company?" · "+esc(me.company):""}${me.phone?"<br>"+esc(me.phone):""}<br>${ymd}</div></div>
    <h2>1. 지금 가입한 보험 (유지·해지)</h2>${S.cur.length?`<table><tr><th style="width:60px">구분</th><th>보험사</th><th>상품</th><th style="width:90px">가입일</th><th style="width:100px">월 보험료</th></tr>${ctrRows(S.cur,"cur")}</table>`:'<p class="mut">기존 계약 정보 없음</p>'}
    <h2>2. 새로 제안하는 보험</h2>${S.prop.length?`<table><tr><th style="width:60px">구분</th><th>보험사</th><th>상품</th><th style="width:100px">월 보험료</th></tr>${ctrRows(S.prop,"prop")}</table>`:'<p class="mut">제안 설계서 없음</p>'}
    <div class="sum"><div><span>지금 월 보험료</span><b>${w$(T.pBefore)}</b></div><div><span>해지로 줄어드는 보험료</span><b>${w$(T.pBefore-T.pKept)}</b></div><div><span>제안 추가 보험료</span><b>${w$(T.pAdd)}</b></div><div class="hi"><span>리모델링 후 월 보험료</span><b>${w$(T.pAfter)}</b></div></div></section>`;
  const cellCls=(row,ci)=>{ if(ci===hdr.length-1){ const v=row[ci], pr=/보험료/.test(row[0]); return typeof v==="number"?((pr?-v:v)>0?"up":(pr?-v:v)<0?"down":""):v==="신규"?"new":v==="없어짐"?"down":""; } if(ci===hdr.length-3) return "fin"; return /^\[제안/.test(hdr[ci])?"pc":""; };
  const fC=(v,ci)=>typeof v==="number"?(ci===hdr.length-1&&v>0?"+":"")+v.toLocaleString("ko-KR"):esc(v);
  const p2=`<section class="pg"><h2>3. 보장 비교표 <small>(단위 만원 · 보험료는 원)</small></h2><table class="cmp"><tr>${hdr.map((h,ci)=>`<th class="${/^\[제안/.test(h)?"pc":ci===hdr.length-3?"fin":""}">${esc(h)}</th>`).join("")}</tr>${body.map(r=>`<tr class="${/보험료/.test(r[0])?"prem":/^암진단비 합계/.test(r[0])?"tot":""}">${r.map((v,ci)=>ci?`<td class="${cellCls(r,ci)}">${fC(v,ci)}</td>`:`<th>${esc(v)}</th>`).join("")}</tr>`).join("")}</table>
    <p class="mut">금액은 보장분석·설계서의 가입금액 합계이며 실제 지급액은 약관 지급기준·감액기간에 따릅니다.</p></section>`;
  const hasTot=T.rows.some(r=>r.c.total);
  const ch=T.rows.map(r=>[r,chg(r)]).filter(([r,x])=>x.txt&&x.tag!=="변동 없음"&&x.tag!=="유지"&&!(hasTot&&["cancer","cancer_all","cancer_meta"].includes(r.c.k)));
  const good=ch.filter(([r,x])=>x.cls==="up"||x.cls==="new"), bad=ch.filter(([r,x])=>x.cls==="down");
  const li=a=>a.map(([r,x])=>`<li><b>${esc(r.c.t)}</b> ${esc(x.txt)} <em>${esc(x.tag)}</em></li>`).join("");
  const cn=cancerNote(T);
  const p3=`<section class="pg"><h2>4. 리모델링으로 좋아지는 점</h2>
    ${T.cancer.b.any||T.cancer.a.any?`<div class="box g"><b>암 보장 방식</b><p>기존: ${esc(T.cancer.bt)}<br>리모델링 후: <b>${esc(T.cancer.at)}</b></p>${cn?`<p class="em">${esc(cn)}</p>`:""}</div>`:""}
    ${good.length?`<div class="box g"><b>늘어나거나 새로 생기는 보장</b><ul>${li(good)}</ul></div>`:""}
    ${bad.length?`<div class="box r"><b>줄어들거나 없어지는 보장</b><ul>${li(bad)}</ul></div>`:""}
    <div class="box"><b>월 보험료</b><p>${w$(T.pBefore)} → <b>${w$(T.pAfter)}</b> (${T.pAfter-T.pBefore>0?"+":T.pAfter-T.pBefore<0?"−":""}${Math.abs(T.pAfter-T.pBefore).toLocaleString("ko-KR")}원)</p></div>
    <h2>5. 상담 메모</h2><div class="box memo">${S.memo?esc(S.memo).replace(/\n/g,"<br>"):'<span class="mut">메모 없음</span>'}</div>
    <p class="mut">해지 전 새 계약의 인수(가입) 확정 여부, 해지환급금, 새 계약의 면책·감액기간을 꼭 확인하세요. 보장 내용과 지급 조건은 각 보험사 약관을 따릅니다.</p></section>`;
  const w=window.open("","_blank"); if(!w){ S.msg="팝업이 막혀 출력 창을 열지 못했습니다. 브라우저 주소창 오른쪽에서 팝업을 허용해 주세요."; draw(); return; }
  w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${S.cname?esc(S.cname)+"_":""}보험리모델링리포트_${ymd}</title><style>
  @page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{margin:0;font-family:Pretendard,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#1d2420;font-size:11.5px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pg{page-break-after:always;padding:2mm}.pg:last-child{page-break-after:auto}
  .hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #0f6b4f;padding-bottom:8px;margin-bottom:6px}.hd small{color:#0f6b4f;font-weight:700;letter-spacing:.5px}.hd h1{margin:2px 0 0;font-size:22px}.who{text-align:right;color:#555;font-size:11px}
  h2{font-size:15px;margin:14px 0 6px;color:#0f6b4f}h2 small{font-weight:400;color:#777;font-size:11px}
  table{border-collapse:collapse;width:100%}th,td{border:1px solid #c9d1cc;padding:4px 6px;text-align:right;white-space:nowrap}th{background:#eef3f0;text-align:center}td.l{text-align:left;white-space:normal}td.c{text-align:center}
  tr.off td{color:#999;text-decoration:line-through}tr.off td.c{text-decoration:none}
  .tag{display:inline-block;padding:1px 8px;border-radius:10px;font-weight:700;font-size:11px;background:#dff3e8;color:#0b7a4b}.tag.x{background:#fbe3e0;color:#c0392b}.tag.prop{background:#e3edf9;color:#2f6fb0}
  table.cmp th{white-space:normal;font-size:10.5px}table.cmp tbody th,table.cmp tr>th:first-child{text-align:left;background:#f7f9f8}
  .pc{background:#eaf2fb}.fin{background:#e7f4ee;font-weight:700}.up{background:#dff3e8;color:#0b7a4b;font-weight:700}.new{background:#fff3c4;color:#8a6100;font-weight:700}.down{background:#fbe3e0;color:#c0392b;font-weight:700}
  tr.prem th,tr.prem td{background:#fbf6ea}tr.tot th,tr.tot td{border-top:2px solid #0f6b4f;font-weight:700}
  .sum{display:flex;gap:8px;margin-top:12px}.sum div{flex:1;border:1px solid #c9d1cc;border-radius:8px;padding:8px 12px}.sum span{display:block;color:#666;font-size:11px}.sum b{font-size:17px}.sum .hi{border-color:#0f6b4f;background:#eef8f3}.sum .hi b{color:#0f6b4f}
  .box{border:1px solid #c9d1cc;border-radius:8px;padding:8px 12px;margin:8px 0}.box.g{border-color:#0b7a4b;background:#f1faf5}.box.r{border-color:#e3a39a;background:#fdf3f1}.box b{font-size:13px}.box p{margin:4px 0}.box ul{margin:4px 0 0;padding-left:18px;columns:2}.box li{margin:2px 0}.box em{font-style:normal;font-weight:700}
  .box.g em{color:#0b7a4b}.box.r em{color:#c0392b}.em{color:#0b7a4b;font-weight:700}.memo{min-height:80px;font-size:12.5px;line-height:1.6}.mut{color:#777;font-size:10.5px}
  </style></head><body>${p1}${p2}${p3}</body></html>`);
  w.document.close(); setTimeout(()=>{ w.focus(); w.print(); },400);
}

/* ---------- 이벤트 ---------- */
document.addEventListener("change",e=>{
  const t=e.target; if(!t.closest||!t.closest("#rm-root")) return;
  if(t.id==="rm-cov"){ const fs=[...t.files]; t.value=""; addCover(fs); return; }
  if(t.id==="rm-prop"){ const fs=[...t.files]; t.value=""; addProp(fs); return; }
  if(t.dataset.rmon){ const [k,id]=t.dataset.rmon.split(":"); const d=S[k].find(x=>x.id===+id); if(d){ d.on=t.checked; draw(); } return; }
  if(t.dataset.rmcat){ t.checked?S.cats.add(t.dataset.rmcat):S.cats.delete(t.dataset.rmcat); draw(); return; }
  if(t.dataset.rmed){ const [k,id,cat]=t.dataset.rmed.split(":"); const d=S[k].find(x=>x.id===+id); if(!d) return; d.ov=d.ov||{};
    if(t.tagName==="SELECT") d.ov[cat]=t.value; else { const v=parseAmt(t.value); if(v===undefined){ S.msg=`"${t.value}"는 금액으로 읽을 수 없습니다. 예: 3000, 3000만, 1.5억`; draw(); return; } d.ov[cat]=v; }
    S.msg=""; draw(); return; }
  if(t.dataset.rmprem){ const [k,id]=t.dataset.rmprem.split(":"); const d=S[k].find(x=>x.id===+id); if(!d) return; if(d.prem0==null) d.prem0=d.prem; d.prem=+String(t.value).replace(/[^\d]/g,"")||0; d.premEd=d.prem!==d.prem0; draw(); return; }
  if(t.dataset.rmsum){ const [k,f]=t.dataset.rmsum.split(":"); S.sov[k]=S.sov[k]||{};
    if(t.tagName==="SELECT") S.sov[k][f]=t.value; else { const v=parseAmt(t.value); if(v===undefined){ S.msg=`"${t.value}"는 금액으로 읽을 수 없습니다. 예: 3000, 3000만, 1.5억`; draw(); return; } S.sov[k][f]=v==null?0:v; }
    S.msg=""; draw(); return; }
  if(t.dataset.rmpsum){ S.pov[t.dataset.rmpsum]=+String(t.value).replace(/[^\d]/g,"")||0; draw(); return; }
  if(t.dataset.rmlab){ const v=t.value.trim(); if(v) S.labels[t.dataset.rmlab]=v; else delete S.labels[t.dataset.rmlab]; draw(); return; }
  if(t.id==="rm-cname"){ S.cname=t.value.trim(); return; }
  if(t.id==="rm-memo"){ S.memo=t.value; return; }
  if(t.id==="rm-cnote"){ S.cnote=t.value; S.cnoteTyped=true; return; }
  if(t.dataset.rmcf){ const [w,f]=t.dataset.rmcf.split(":"); S.cf[w][f]=f==="n"?(+String(t.value).replace(/[^\d]/g,"")||0):t.checked; S.cf[w].any=true; if(S.cnote!=null&&!S.cnoteTyped) S.cnote=null; draw(); return; }
  if(t.dataset.rmcatset){ const [k,id,i]=t.dataset.rmcatset.split(":"); const d=S[k].find(x=>x.id===+id); if(d&&d.items[+i]){ d.items[+i].cat=t.value; if(t.value) S.cats.add(t.value); draw(); } return; }
});
document.addEventListener("click",e=>{
  if(!e.target.closest("#rm-root")) return;
  const x=e.target.closest("[data-rmdel]"); if(x){ const [k,id]=x.dataset.rmdel.split(":"); S[k]=S[k].filter(d=>d.id!==+id); draw(); return; }
  const o=e.target.closest("[data-rmopen]"); if(o){ const k=o.dataset.rmopen; S.open[k]=!S.open[k]; draw(); return; }
  if(e.target.closest("#rm-custgo")){ loadCust(); return; }
  const ss=e.target.closest("[data-rmsrs]"); if(ss){ const [k,f]=ss.dataset.rmsrs.split(":"); if(S.sov[k]) delete S.sov[k][f]; draw(); return; }
  const pss=e.target.closest("[data-rmpsrs]"); if(pss){ delete S.pov[pss.dataset.rmpsrs]; draw(); return; }
  const rs=e.target.closest("[data-rmrs]"); if(rs){ const [k,id,cat]=rs.dataset.rmrs.split(":"); const d=S[k].find(x=>x.id===+id); if(d&&d.ov) delete d.ov[cat]; draw(); return; }
  const ps=e.target.closest("[data-rmprs]"); if(ps){ const [k,id]=ps.dataset.rmprs.split(":"); const d=S[k].find(x=>x.id===+id); if(d&&d.prem0!=null){ d.prem=d.prem0; d.premEd=false; } draw(); return; }
  const rw=e.target.closest("[data-rmrow]"); if(rw){ const k=rw.dataset.rmrow; S.cats.delete(k); if(S.custom.some(c=>c.k===k)){ S.custom=S.custom.filter(c=>c.k!==k); [...S.cur,...S.prop].forEach(d=>{ if(d.ov) delete d.ov[k]; }); } draw(); return; }
  const hd=e.target.closest("[data-rmhide]"); if(hd){ S.hide.add(hd.dataset.rmhide); draw(); return; }
  if(e.target.closest("#rm-wreset")){ S.w={}; draw(); return; }
  if(e.target.closest("#rm-unhide")){ S.hide.clear(); draw(); return; }
  if(e.target.closest("#rm-addrow")){ const nm=(($("#rm-newrow")||{}).value||"").trim(); if(!nm){ S.msg="추가할 담보 이름을 적어 주세요."; draw(); return; }
    const k="u"+(SEQ++); S.custom.push({k,t:nm,g:"추가",yn:($("#rm-newyn")||{}).checked?1:0}); S.cats.add(k); S.msg=""; draw(); return; }
  if(e.target.closest("#rm-xlsx")){ saveXlsx(); return; }
  if(e.target.closest("#rm-print")){ printIt(); return; }
});

/* 너비 끌기 */
let RZ=null;
document.addEventListener("pointerdown",e=>{ const h=e.target.closest&&e.target.closest("[data-rz]"); if(!h) return; e.preventDefault(); e.stopPropagation();
  const th=h.closest("th"); RZ={k:h.dataset.rz,x:e.clientX,w:th.getBoundingClientRect().width}; document.body.style.cursor="col-resize"; document.body.style.userSelect="none"; });
document.addEventListener("pointermove",e=>{ if(!RZ) return; S.w[RZ.k]=Math.max(48,Math.round(RZ.w+e.clientX-RZ.x));
  const st=document.getElementById("rm-colw"); if(st){ const ks=[...document.querySelectorAll(".rm-tbl tbody tr:first-child>*")].length; const heads=[...document.querySelectorAll(".rm-tbl thead th[data-col]")].map(t=>t.dataset.col);
    const order=["lab",...heads.filter(k=>/^cur:/.test(k)),...heads.filter(k=>k==="before"||k==="kept"),...heads.filter(k=>/^prop:/.test(k)),"after","chg"]; st.textContent=colRules(order); } });
document.addEventListener("pointerup",()=>{ if(!RZ) return; RZ=null; document.body.style.cursor=""; document.body.style.userSelect=""; draw(); });
document.addEventListener("keydown",e=>{ const t=e.target; if(e.key==="Enter"&&t.closest&&t.closest("#rm-root")&&(t.dataset.rmed!=null||t.dataset.rmprem!=null||t.dataset.rmsum!=null||t.dataset.rmpsum!=null||t.dataset.rmlab!=null||t.id==="rm-cname")){ e.preventDefault(); t.blur(); } });

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
.rm-tbl td.rm-e{padding:0;position:relative}
.rm-tbl td.rm-e input,.rm-tbl td.rm-e select{width:100%;min-width:92px;box-sizing:border-box;border:1px solid transparent;background:transparent;color:inherit;font:inherit;text-align:right;padding:7px 9px;border-radius:0}
.rm-tbl td.rm-e select{text-align-last:right;appearance:none;-webkit-appearance:none;cursor:pointer}
.rm-tbl td.rm-e input:hover,.rm-tbl td.rm-e select:hover{border-color:color-mix(in srgb,var(--c4) 40%,transparent)}
.rm-tbl td.rm-e input:focus,.rm-tbl td.rm-e select:focus{outline:2px solid var(--c4);outline-offset:-2px;background:var(--surface)}
.rm-tbl td.rm-e input.unk::placeholder{color:#c0392b;font-weight:700}
.rm-tbl td.rm-e.ed input,.rm-tbl td.rm-e.ed select{color:#6d3fc0;font-weight:700}
.rm-tbl td.rm-e.ed::after{content:"";position:absolute;top:3px;left:3px;width:6px;height:6px;border-radius:50%;background:#6d3fc0}
.rm-rs{position:absolute;left:10px;top:50%;transform:translateY(-50%);border:0;background:none;color:#6d3fc0;cursor:pointer;font-size:12px;padding:0}
.rm-tbl td.pc,.rm-tbl th.rm-doc.prop{background:color-mix(in srgb,#2f6fb0 9%,var(--surface))}
.rm-tbl td.cc{background:var(--surface)}
.rm-tbl td.fin.up{background:#d6f0e1;color:#0b7a4b}.rm-tbl td.fin.new{background:#fff0b8;color:#8a6100}.rm-tbl td.fin.down{background:#fbe0dc;color:#c0392b}
.rm-tbl td.rm-chg.up{background:#e6f6ec}.rm-tbl td.rm-chg.new{background:#fff6d6}.rm-tbl td.rm-chg.new b{color:#8a6100}.rm-tbl td.rm-chg.down{background:#fdeceb}
.rm-colx,.rm-rowx{border:0;background:none;color:var(--muted);cursor:pointer;font-size:11px;padding:0 3px;opacity:.45}
.rm-colx{position:absolute;top:3px;right:3px}.rm-tbl thead th{position:sticky}.rm-tbl thead th:hover .rm-colx,.rm-tbl tbody th:hover .rm-rowx{opacity:1;color:#c0392b}
.rm-rowx{margin-right:4px}
.rm-legend{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.rm-legend .rm-lg{white-space:nowrap}
.rm-legend .rm-lg{font-size:12px;padding:3px 8px;border-radius:6px;border:1px solid var(--line)}
.rm-lg.pc{background:color-mix(in srgb,#2f6fb0 12%,var(--surface))}.rm-lg.up{background:#d6f0e1;color:#0b7a4b}.rm-lg.new{background:#fff0b8;color:#8a6100}.rm-lg.down{background:#fbe0dc;color:#c0392b}.rm-lg.ed{color:#6d3fc0;font-weight:700}
.rm-tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-top:10px}
.rm-add{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.rm-add input[type=text],.rm-add #rm-newrow{padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--fg);font:inherit;width:280px}
.rm-add label{font-size:13px;display:flex;gap:4px;align-items:center}.rm-hid{font-size:13px;color:var(--muted)}
.rm-tbl tr.rm-tot th,.rm-tbl tr.rm-tot td{border-top:2px solid var(--c4);font-weight:700}
.rm-tbl tr.rm-tot th{background:color-mix(in srgb,var(--c4) 10%,var(--surface))}
.rm-feat{display:block;font-style:normal;font-size:11.5px;font-weight:700;color:#0b7a4b;margin-top:2px;white-space:normal}
.rm-cancer{margin-top:12px;border:1px solid var(--line);border-radius:10px;padding:10px 14px}.rm-cancer.good{border-color:#0b7a4b;background:#f1faf5}
.rm-cancer>b{font-size:14px}.rm-cmp{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:6px 0}
.rm-cmp span{font-size:13.5px}.rm-cmp em{display:block;font-style:normal;font-size:11.5px;color:var(--muted)}.rm-cmp .ar{font-size:18px;color:#0b7a4b}
.rm-cancer.good .rm-cmp span:last-child{font-weight:700;color:#0b7a4b}
.rm-cfs{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;margin:2px 0 8px;font-size:13px}.rm-cfs>div{display:flex;gap:10px;align-items:center}.rm-cfs em{font-style:normal;color:var(--muted);font-size:12px}
.rm-cfs label{display:flex;gap:4px;align-items:center}.rm-cfs input[data-rmcf$=":n"]{padding:3px 6px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--fg);font:inherit;text-align:right}.rm-cfs small{color:var(--muted);font-size:11.5px}
.rm-cn{display:block;font-size:12px;color:var(--muted)}.rm-cn textarea{display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--fg);font:inherit;font-size:13.5px;resize:vertical}
.rm-rz{position:absolute;top:0;right:-3px;bottom:0;width:8px;cursor:col-resize;z-index:4}.rm-rz:hover{background:color-mix(in srgb,var(--c4) 35%,transparent)}
.rm-tbl tbody td,.rm-tbl tbody th{overflow:hidden;text-overflow:ellipsis}.rm-tbl td.rm-e input,.rm-tbl td.rm-e select{min-width:0}
.rm-tbl td.rm-chg{white-space:normal}
.rm-lab{border:1px solid transparent;background:transparent;color:inherit;font:inherit;font-weight:inherit;padding:3px 4px;border-radius:6px;width:calc(100% - 22px);min-width:120px}
.rm-lab:hover{border-color:color-mix(in srgb,var(--c4) 40%,transparent)}.rm-lab:focus{outline:2px solid var(--c4);background:var(--surface)}
.rm-rep{display:flex;gap:12px;flex-wrap:wrap}.rm-rep label{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--muted)}.rm-rep label.w{flex:1;min-width:300px}
.rm-rep input,.rm-rep textarea{padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--fg);font:inherit;font-size:14px}.rm-rep textarea{resize:vertical}
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
window.REMODEL={draw,S,classify,table,CATS,fixSubs};
if(document.readyState!=="loading") draw(); else document.addEventListener("DOMContentLoaded",draw);
})();
