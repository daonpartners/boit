/* 보잇 · 제안서 꾸미기 › 고객용 요약 (2026-11-25 대표 지시)
   - 설계서만 올리면 '단품 제안' 1장: 이 설계로 준비되는 보장 + 이런 일이 생기면(담보별 금액, 더하지 않음)
   - 기존 보장분석 PDF도 올리면 '리모델링' 2장: ① 월 보험료·계약 정리·핵심 담보 지금→보완 후  ② 이런 일이 생기면(지금→보완 후) + 가입 전 확인
   - 숫자는 리모델링 비교표(remodel.js)와 같은 분류·계산. 금액은 설계서·보장분석 가입금액 그대로(만원), 지급은 약관·심사에 따름
   - 글밥 줄이기: 담보 한 줄에 '이름 · 금액'만, 설명 문장 없음 */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const RM=()=>window.REMODEL;
const fmt=v=>v==null||isNaN(v)?"":v>=10000?((v%10000?(v/10000).toFixed(1).replace(/\.0$/,""):v/10000)+"억"):(Math.round(v*10)/10).toLocaleString("ko-KR")+"만";
const won=n=>Math.round(+n||0).toLocaleString("ko-KR")+"원";
const PS={on:false,cur:[],msg:"",seq:1,cmp:false,pin:{},rows:["cancer","brain","ihd","heart"],ed:{}};

/* 리모델링 표 계산을 이 화면 계약으로 잠깐 바꿔서 (리모델링 비교표 화면의 내용은 건드리지 않음) */
function withRM(cur,prop,fn){ const S=RM().S, a=S.cur, b=S.prop; S.cur=cur; S.prop=prop; try{ return fn(); } finally{ S.cur=a; S.prop=b; } }
function propOf(docs){ return docs.map((d,i)=>{ const p=d.M.p; const items=RM().fixSubs((d.M.pvItems||p.items||[]).filter(x=>!x.group).map(x=>({name:x.name,amt:x.amt,cat:RM().classify(x.name),per:x.per||"",raw:x.amtText||""})),p.details);
  return {id:1000+i,co:p.company||"",prod:p.product||d.file,prem:+(p.premium||(p.items||[]).reduce((a,x)=>a+(+x.prem||0),0))||0,on:true,items}; }); }
let CNT={};
function setCnt(cur,prop){ CNT={b:{},a:{}}; const add=(o,docs)=>docs.forEach(d=>(d.items||[]).forEach(i=>{ if(i.cat&&+i.amt>0) o[i.cat]=(o[i.cat]||0)+1; }));
  add(CNT.b,cur); add(CNT.a,cur.filter(c=>c.on).concat(prop)); }
const nT=(r,side)=>{ const k=r.c.k; if(r.c.yn||k==="cancer_total") return ""; const n=(CNT[side]||{})[k]||0; return n>1?` (${n}개 합계)`:""; };
const txt=(x,r)=>!x||x.none?"":x.yn?RM().ynTxt(x):(RM().LISTK||{})[r.c.k]?RM().listTxt(x):(+x.amt>0?fmt(x.amt):"");

/* 상황별 묶음 — 담보 금액을 더하지 않고 줄마다 보여 줌 */
const SIT=[
 {t:"암 진단·치료",ic:"🎗",ks:["cancer_total","cancer","cancer_all","cancer_meta","sim","ctx","ctx_np","ctx_tgt","ctx_rad","ctx_robot"]},
 {t:"뇌혈관질환",ic:"🧠",ks:["brain","stroke","bleed","circ","circ_thr"]},
 {t:"심장질환",ic:"❤️",ks:["heart","ami","ihd","circ"]},
 {t:"수술·간병",ic:"🏥",ks:["dsurg","dtype","nsurg","isurg","itype","care"]},
];
function rowsOf(docs){ if(!RM()||!docs.length) return null; const prop=propOf(docs);
  setCnt(PS.cur,prop); return withRM(PS.cur,prop,()=>{ const T=RM().table(); return {T,prop}; }); }

function head(docs,me,sub,pg,n){ const p=docs[0].M.p, nm=esc(p.insured||"고객"), ymd=new Date(Date.now()+9*3600e3).toISOString().slice(0,10);
  return `<div class="ps-top"><span>${nm} 고객님 · ${sub}</span><span>${ymd} · ${pg}/${n}</span></div>`; }
function foot(me){ return `<div class="ps-foot"><span>금액은 설계서·보장분석의 가입금액입니다. ‘○개 합계’는 같은 분류 담보를 더한 값으로, 한 번의 진단·치료로 모두 받는 금액이 아닐 수 있습니다. 실제 지급은 가입 상품의 약관(보장개시일·감액기간·면책 등)과 보험사 심사에 따릅니다.</span><b>${esc([me.name,me.org].filter(Boolean).join(" · "))}${me.phone?" · "+esc(me.phone):""}</b></div>`; }

function sitHTML(T,two){ const R=Object.fromEntries(T.rows.map(r=>[r.c.k,r]));
  return SIT.map(s=>{ const L=s.ks.map(k=>R[k]).filter(r=>r&&(two?(r.before||r.after):r.after)).filter((r,i,a)=>a.indexOf(r)===i);
    const skip=new Set(R.cancer_total&&R.cancer_total.after?["cancer","cancer_all"]:[]); const rows=L.filter(r=>!skip.has(r.c.k)).slice(0,6);
    if(!rows.length) return "";
    return `<div class="ps-sit"><b>${s.ic} ${s.t}</b>${rows.map(r=>`<div class="ps-li"><span>${esc(r.c.t)}</span>${two?`<i>${esc((txt(r.before,r)||"없음")+(r.before?nT(r,"b"):""))}</i><em>→</em>`:""}<b>${esc((txt(r.after,r)||"없음")+(r.after?nT(r,"a"):""))}</b></div>`).join("")}</div>`; }).join(""); }

function pages(docs,me){ if(!PS.cur.length) return ""; /* 단품 요약 1장은 없앰 (2026-11-25 대표 지시) */ const X=rowsOf(docs); if(!X) return ""; const {T,prop}=X, p=docs[0].M.p, two=PS.cur.length>0;
  const prod=prop.map(x=>`${x.co} ${x.prod}`.trim()).join(" / ");
  if(!two){
    const L=T.rows.filter(r=>r.after&&txt(r.after,r)&&!(r.c.k==="cancer"||r.c.k==="cancer_all")||(r.after&&r.c.k==="cancer_total"));
    const L2=(L.length?L:T.rows.filter(r=>r.after)).slice(0,16);
    return `<div class="a4 ps-page">${head(docs,me,"보장 제안 요약",1,1)}
      <h2 class="ps-h">${esc(p.insured||"고객")} 고객님께 드리는 보장 제안</h2>
      <div class="ps-kpi"><div><small>제안 상품</small><b>${esc(prod)}</b></div><div><small>월 보험료</small><b>${won(T.pAdd)}</b></div></div>
      <h3 class="ps-st">이 설계로 준비되는 보장</h3>
      <div class="ps-grid">${L2.map(r=>`<div class="ps-li"><span>${esc(r.c.t)}</span><b>${esc(txt(r.after,r)+nT(r,"a"))}</b></div>`).join("")}</div>
      <h3 class="ps-st">이런 일이 생기면 받는 보장</h3><div class="ps-sits">${sitHTML(T,false)}</div>
      ${foot(me)}</div>`; }
  const keep=PS.cur.filter(c=>c.on), cut=PS.cur.filter(c=>!c.on), d=T.pAfter-T.pBefore;
  const R=T.rows.filter(r=>(r.before||r.after)&&!(T.rows.some(x=>x.c.k==="cancer_total")&&(r.c.k==="cancer"||r.c.k==="cancer_all"))).slice(0,18);
  const ch=r=>{ if(r.c.yn) return r.diff||""; const v=r.diff; return v>0?`+${fmt(v)}`:v<0?`−${fmt(-v)}`:"같음"; };
  const cls=r=>{ const v=r.diff; return v==="신규"||v>0?"up":v==="없어짐"||v<0?"dn":""; };
  return `<div class="a4 ps-page">${head(docs,me,"보장 비교 요약",1,2)}
    <h2 class="ps-h">${esc(p.insured||"고객")} 고객님 보장 비교</h2>
    <div class="ps-kpi"><div><small>월 보험료</small><b>${won(T.pBefore)} → ${won(T.pAfter)}</b><em class="${d>0?"up":d<0?"dn":""}">${d>0?"+":d<0?"−":""}${won(Math.abs(d))}</em></div>
      <div><small>계약</small><b>유지 ${keep.length}건 · 정리 ${cut.length}건 · 신규 ${prop.length}건</b></div></div>
    <div class="ps-ctr">${keep.map(c=>`<span class="k">유지</span> ${esc(c.co)} ${esc(c.prod)}`).concat(cut.map(c=>`<span class="c">정리</span> ${esc(c.co)} ${esc(c.prod)}`),prop.map(c=>`<span class="n">신규</span> ${esc(c.co)} ${esc(c.prod)}`)).map(s=>`<div>${s}</div>`).join("")}</div>
    <h3 class="ps-st">핵심 담보 지금 → 보완 후</h3>
    <table class="ps-t"><thead><tr><th>담보</th><th>지금</th><th>보완 후</th><th>변화</th></tr></thead><tbody>
    ${R.map(r=>`<tr><td>${esc(r.c.t)}</td><td>${esc(txt(r.before,r)?txt(r.before,r)+nT(r,"b"):"—")}</td><td><b>${esc(txt(r.after,r)?txt(r.after,r)+nT(r,"a"):"—")}</b></td><td class="${cls(r)}">${esc(ch(r))}</td></tr>`).join("")}</tbody></table>
    ${foot(me)}</div>
  <div class="a4 ps-page">${head(docs,me,"보장 비교 요약",2,2)}
    <h3 class="ps-st" style="margin-top:4px">이런 일이 생기면 (지금 → 보완 후)</h3><div class="ps-sits two">${sitHTML(T,true)}</div>
    <h3 class="ps-st">가입 전 꼭 확인하세요</h3>
    <ul class="ps-chk"><li>정리하는 계약은 해지하면 되살리기 어렵고, 같은 조건으로 다시 가입하지 못할 수 있습니다.</li>
      <li>새 계약은 보장개시일(예: 암 90일)·감액기간이 새로 적용될 수 있습니다. 새 계약이 성립한 뒤 기존 계약을 정리하세요.</li>
      <li>건강 상태는 청약서 질문대로 사실대로 알려야 합니다(고지의무). 알리지 않으면 보험금을 못 받을 수 있습니다.</li>
      ${prop.concat(keep).some(x=>(x.items||[]).some(i=>/갱신/.test(i.name)&&!/비갱신/.test(i.name)))?"<li>갱신형 담보는 갱신 때 보험료가 오를 수 있습니다.</li>":""}</ul>
    ${foot(me)}</div>`; }


/* ===== 제안 2개 비교표 (A4 가로 1장, 2026-11-25 대표 지시) =====
   기존 | 제안1 | 제안2 — 계약·월 보험료 표 + 진단비 줄(회사별로 나눠 적음, 합치지 않음) + 제안별 메모(직접 입력) */
const CROWS=[["cancer","암진단비",["cancer","cancer_all","cancer_meta"]],["brain","뇌혈관진단비",["brain"]],["ihd","허혈성진단비",["ihd"]],["heart","심장진단비",["heart"]],
 ["ami","급성심근경색진단비",["ami"]],["stroke","뇌졸중진단비",["stroke"]],["sim","유사암진단비",["sim"]],["ctx","암 주요·통합치료비",["ctx"]],["ctx_np","비급여 암치료비",["ctx_np"]],["circ","순환계·뇌심 치료비",["circ"]],["dsurg","질병수술비",["dsurg"]],["care","간병인",["care"]]];
const coS=c=>String(c||"").replace(/손해보험/,"손보").replace(/주식회사|\(주\)/g,"").trim();
const kman=v=>{ v=Math.round(+v||0); if(!v) return ""; const e=Math.floor(v/10000), r=v%10000, th=Math.floor(r/1000), rest=r%1000; let t=(e?e+"억":"")+(th?th+"천":"")+(rest?rest+"":""); return t+(rest||(!e&&!th)?"만":(e&&!th?"":"만")); };
const amtOf=(doc,cats)=>(doc.items||[]).filter(i=>cats.includes(i.cat)&&+i.amt>0).reduce((a,i)=>a+(+i.amt),0);
function oneLine(doc){ const P=[["암",["cancer","cancer_all"]],["뇌",["brain"]],["심장",["heart","ihd"]]].map(([t,c])=>{ const v=Math.max(0,...(doc.items||[]).filter(i=>c.includes(i.cat)&&+i.amt>0).map(i=>+i.amt)); return v?t+kman(v).replace(/만$/,""):""; }).filter(Boolean);
  if(P.length) return P.join("/");
  const has=re=>(doc.items||[]).some(i=>re.test(i.cat||"")), K=[[/^drv/,"운전자"],[/^silson$/,"실비"],[/^(ctx|circ)/,"치료비"],[/^care$/,"간병인"],[/surg|dtype|nsurg/,"수술비"],[/^(liab|fire)$/,"배상·화재"]].filter(([re])=>has(re)).map(x=>x[1]);
  if(K.length) return K.slice(0,3).join("/");
  return /\.pdf$/i.test(doc.prod||"")?"":String(doc.prod||"").replace(/\(.*?\)/g,"").replace(/\s+/g," ").trim().slice(0,16); }
const inS=(k,x)=>{ const v=PS.pin[k]; return v?v[x]:true; };
function colOf(x,prop){ /* x: -1 기존, 0 제안1, 1 제안2 → 줄 배열 (기존 자리에 유지 계약, 정리한 자리에 신규) */
  if(x<0) return PS.cur.map(c=>({d:c,t:"cur"}));
  const out=PS.cur.map(c=>inS("c"+c.id,x)?{d:c,t:"keep"}:null), nw=prop.filter((p,i)=>inS("p"+i,x)).map(p=>({d:p,t:"new"}));
  for(let i=0;i<out.length&&nw.length;i++) if(!out[i]) out[i]=nw.shift();
  return out.concat(nw); }
const edT=(key,def)=>Object.prototype.hasOwnProperty.call(PS.ed,key)?PS.ed[key]:def;
function cmpPage(docs,me){ const prop=propOf(docs), p=docs[0].M.p;
  const cols=[-1,0,1].map(x=>colOf(x,prop)), n=Math.max(...cols.map(c=>c.length),1);
  const tot=cols.map(c=>c.filter(Boolean).reduce((a,r)=>a+(+r.d.prem||0),0));
  const cutSet=new Set(PS.cur.filter(c=>!inS("c"+c.id,0)||!inS("c"+c.id,1)).map(c=>c.id));
  const cell=(r,x,i)=>{ if(!r) return `<td></td><td></td><td></td>`; const d=r.d, k=(r.t==="new"?"p":"c")+(r.t==="new"?prop.indexOf(d):d.id), cls=r.t==="new"?"psn":(x<0&&cutSet.has(d.id)?"psc":"");
    return `<td class="${cls}">${esc(coS(d.co))}</td><td class="${cls}"><span class="ps-ed" contenteditable="true" data-psed="l_${k}">${esc(edT("l_"+k,oneLine(d)))}</span></td><td class="${cls} r">${d.prem?Math.round(d.prem).toLocaleString("ko-KR"):"—"}</td>`; };
  const RW=CROWS.filter(r=>PS.rows.includes(r[0]));
  /* 한 계약에 같은 줄 담보가 여러 개면 담보 이름을 붙여 따로 (예: KB손보 심장질환(특정Ⅰ) 1천 + 심장질환(특정Ⅱ) 1천) — 더하지 않음 */
  const sn=t=>String(t||"").replace(/\((간편가입|건강가입|일반가입|감액없음|갱신형|기본계약|선택계약)\)|\[[^\]]*\]|갱신형|무배당/g,"").replace(/진단비[ⅠⅡⅢⅣⅤ\d]*$/,"").replace(/\s+/g,"").slice(0,14);
  const cov=(x,cats)=>{ const L=[]; cols[x+1].filter(Boolean).forEach(r=>{ const its=(r.d.items||[]).filter(i=>cats.includes(i.cat)&&+i.amt>0); if(its.length===1) L.push(`${coS(r.d.co)} ${kman(its[0].amt)}`); else if(its.length>1) L.push(`${coS(r.d.co)} `+its.map(i=>`${sn(i.name)} ${kman(i.amt)}`).join(" + ")); });
    return L.length?L.join(" + "):"없음"; };
  const H=["기존","제안1","제안2"];
  return `<div class="a4 ps-page ps-land">${head(docs,me,"제안 비교",1,1)}
    <h2 class="ps-h" style="font-size:21px">${esc(p.insured||"고객")} 고객님 보장 제안 비교</h2>
    <table class="ps-cmp"><thead><tr>${H.map((h,x)=>`<th colspan="3" class="h${x}">${h}</th>`).join("")}</tr></thead><tbody>
    ${Array.from({length:n},(_,i)=>`<tr>${[0,1,2].map(x=>cell(cols[x][i],x-1,i)).join("")}</tr>`).join("")}
    <tr class="sum">${tot.map((t,x)=>`<td colspan="2">월 보험료</td><td class="r">${Math.round(t).toLocaleString("ko-KR")}${x?`<small class="${t-tot[0]>0?"dn":"up"}">${t-tot[0]>0?"+":t-tot[0]<0?"−":""}${Math.abs(Math.round(t-tot[0])).toLocaleString("ko-KR")}</small>`:""}</td>`).join("")}</tr>
    </tbody></table>
    <table class="ps-cmp ps-cov"><tbody>${RW.map(r=>`<tr>${[-1,0,1].map(x=>`<th>${r[1]}</th><td class="h${x+1}c">${esc(cov(x,r[2]))}</td>`).join("")}</tr>`).join("")}
    <tr class="memo">${[0,1,2].map(x=>`<td colspan="2" class="h${x}c"><div class="ps-ed ps-memo" contenteditable="true" data-psed="m${x}" data-ph="${H[x]} 메모 — 눌러서 입력 (예: 40세 이후 금액, 전이암 보장, 추천 이유)">${esc(edT("m"+x,""))}</div></td>`).join("")}</tr></tbody></table>
    <div class="ps-foot"><span>금액은 보장분석·설계서의 가입금액입니다. 여러 회사 진단비는 회사별로 나눠 적었으며, 한 번의 진단으로 모두 받는지는 각 약관에 따릅니다.</span><b>${esc([me.name,me.org].filter(Boolean).join(" · "))}${me.phone?" · "+esc(me.phone):""}</b></div></div>`; }
function cmpPanel(docs){ const prop=propOf(docs);
  const b=(k,x,on,a,z)=>`<button type="button" class="ps-x${on?" on":""}" data-psin="${k}:${x}">${on?a:z}</button>`;
  return `<div class="ps-mx"><table><thead><tr><th>계약·설계서</th><th>제안1</th><th>제안2</th></tr></thead><tbody>
    ${PS.cur.map(c=>`<tr><td><span class="ps-tg c">기존</span> ${esc(coS(c.co))} ${esc(c.prod)}</td><td>${b("c"+c.id,0,inS("c"+c.id,0),"유지","정리")}</td><td>${b("c"+c.id,1,inS("c"+c.id,1),"유지","정리")}</td></tr>`).join("")}
    ${prop.map((d,i)=>`<tr><td><span class="ps-tg n">신규</span> ${esc(coS(d.co))} ${esc(d.prod)}</td><td>${b("p"+i,0,inS("p"+i,0),"넣음","뺌")}</td><td>${b("p"+i,1,inS("p"+i,1),"넣음","뺌")}</td></tr>`).join("")}</tbody></table>
    <div class="ps-row"><span class="note">비교할 줄</span>${CROWS.map(r=>`<button type="button" class="ps-x${PS.rows.includes(r[0])?" on":""}" data-psrow="${r[0]}">${r[1]}</button>`).join("")}</div>
    <p class="note" style="margin:0">표 안의 상품 한 줄 요약과 메모 칸은 눌러서 바로 고칠 수 있습니다.</p></div>`; }

function panelHTML(){ const n=PS.cur.length, docs=window.DECO&&DECO.docs?DECO.docs():[], mode=PS.cmp?"cmp":PS.on?"rm":"none";
  const pg=(lbl,land)=>`<span class="ps-th${land?" land":""}"><i></i><i></i><i class="s"></i><i class="s"></i><em>${lbl}</em></span>`;
  const opt=(k,t,when,what,need,thumb)=>`<button type="button" class="ps-opt${mode===k?" on":""}" data-psmode="${k}"><span class="ps-ok">${mode===k?"✓":""}</span><span class="ps-ob"><b>${t}</b><small><u>언제</u> ${when}</small><small><u>나오는 것</u> ${what}</small>${need?`<small><u>준비</u> ${need}</small>`:""}</span><span class="ps-thumbs">${thumb}</span></button>`;
  return `<div class="ps-panel"><div class="ps-q"><b>설계서 앞에 붙일 장</b><span class="note">고르면 아래 미리보기 맨 위에 바로 나옵니다</span></div>
  <div class="ps-opts">
   ${opt("none","설계서만","새 보험 하나만 권할 때","올린 설계서 그대로 (꾸미기만)","",pg("설계서"))}
   ${opt("rm","기존 보험 정리 요약 + 설계서","고객의 기존 보험을 정리(해지·유지)하고 새 보험을 권할 때","① 바꾸기 전·후 보험료와 핵심 보장 숫자 ② 암·뇌·심장 등 상황별 보장 비교와 가입 전 확인 — A4 2장","기존 보장분석 PDF",pg("전·후 요약")+pg("상황별 비교")+pg("설계서"))}
   ${opt("cmp","제안 2개 비교표 + 설계서","설계서 2개를 놓고 고객이 고르게 할 때","기존 | 제안1 | 제안2 를 한 장에 나란히 (보험료·담보) — A4 가로 1장","설계서 2개 (기존 보장분석은 있으면 기존 칸에 들어감)",pg("기존|1|2",1)+pg("설계서"))}
  </div>
  ${mode!=="none"?`<div class="ps-row"><label class="btn sm" style="cursor:pointer">${n?"기존 보장분석 다시 올리기":"기존 보장분석 PDF 올리기"}<input id="ps-cov" type="file" accept="application/pdf,.pdf" multiple hidden></label>${n?`<span class="note">기존 계약 ${n}건 읽음</span><button type="button" class="lnk" id="ps-covx">빼기</button>`:""}<span class="note" id="ps-msg">${esc(PS.msg)}</span>
    ${mode==="rm"&&!n?'<span class="note" style="color:#B45309">기존 보장분석을 올려야 요약 2장이 만들어집니다</span>':""}${mode==="cmp"&&docs.length<2?'<span class="note" style="color:#B45309">설계서를 2개 올리면 제안1·제안2가 채워집니다</span>':""}
    ${mode!=="none"?'<button type="button" class="btn sm" id="ps-go">미리보기로 이동 ↓</button>':""}</div>`:""}
  ${PS.cmp?cmpPanel(docs):""}
  ${n&&mode==="rm"?`<div class="ps-cl"><span class="note">기존 계약 — 눌러서 유지/정리를 바꾸세요</span>${PS.cur.map((c,i)=>`<button type="button" class="ps-c${c.on?" on":""}" data-psc="${i}"><b>${c.on?"유지":"정리"}</b> ${esc(c.co)} ${esc(c.prod)} · ${won(c.prem)}</button>`).join("")}</div>`:""}</div>`; }
document.addEventListener("click",e=>{ const m=e.target.closest("[data-psmode]"); if(m){ const k=m.dataset.psmode; PS.on=k==="rm"; PS.cmp=k==="cmp"; redraw(); return; }
  if(e.target.closest("#ps-go")){ const t=document.querySelector(".dc-sum .a4")||document.querySelector("#dc-sheets"); if(t) t.scrollIntoView({behavior:"smooth",block:"start"}); } });

async function addCover(files){ PS.msg="보장분석 읽는 중…"; redraw();
  const S=RM().S, a=S.cur; S.cur=PS.cur; let m="";
  try{ await RM().addCover(files); m=S.msg||""; } finally{ S.cur=a; try{ RM().draw(); }catch(_){} }
  PS.msg=m; redraw(); }
function redraw(){ if(window.DECO&&DECO.draw) DECO.draw(); }

document.addEventListener("change",e=>{ const t=e.target;
  if(t.id==="ps-on"){ PS.on=t.checked; redraw(); }
  if(t.id==="ps-cmp"){ PS.cmp=t.checked; redraw(); }
  if(t.id==="ps-cov"){ const f=[...t.files]; t.value=""; if(f.length) addCover(f); } });
document.addEventListener("click",e=>{ const x=e.target.closest("[data-psin],[data-psrow]"); if(!x) return;
  if(x.dataset.psrow){ const k=x.dataset.psrow, i=PS.rows.indexOf(k); if(i>=0) PS.rows.splice(i,1); else PS.rows.push(k); PS.rows.sort((a,b)=>CROWS.findIndex(r=>r[0]===a)-CROWS.findIndex(r=>r[0]===b)); redraw(); return; }
  const [k,s]=x.dataset.psin.split(":"); const v=PS.pin[k]||[true,true]; v[+s]=!v[+s]; PS.pin[k]=v; redraw(); });
document.addEventListener("input",e=>{ const t=e.target.closest&&e.target.closest("[data-psed]"); if(t) PS.ed[t.dataset.psed]=t.innerText.trim(); });
document.addEventListener("click",e=>{ const b=e.target.closest("[data-psc],#ps-covx"); if(!b) return;
  if(b.id==="ps-covx"){ PS.cur=[]; PS.msg=""; redraw(); return; }
  const c=PS.cur[+b.dataset.psc]; if(c){ c.on=!c.on; redraw(); } });

(function css(){ if(document.getElementById("ps-css")) return; const s=document.createElement("style"); s.id="ps-css"; s.textContent=`
.ps-panel{display:flex;flex-direction:column;gap:10px}.ps-q{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.ps-q b{font-size:15px}
.ps-opts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}@media(max-width:900px){.ps-opts{grid-template-columns:1fr}}
.ps-opt{all:unset;box-sizing:border-box;cursor:pointer;border:1.5px solid var(--line,#d9dee3);border-radius:12px;padding:12px;display:grid;grid-template-columns:22px 1fr;grid-template-rows:auto auto;gap:6px 8px;background:#fff}
.ps-opt:hover{border-color:#0E7A5F}.ps-opt.on{border-color:#0E7A5F;background:#F0F8F5;box-shadow:0 0 0 2px #0E7A5F22}
.ps-ok{width:20px;height:20px;border-radius:50%;border:1.5px solid #B8C4BF;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;font-weight:800}.ps-opt.on .ps-ok{background:#0E7A5F;border-color:#0E7A5F}
.ps-ob{display:flex;flex-direction:column;gap:3px}.ps-ob b{font-size:14.5px}.ps-ob small{font-size:12.5px;color:#4A5652;line-height:1.5}.ps-ob u{text-decoration:none;font-weight:700;color:#0E7A5F;margin-right:4px}
.ps-thumbs{grid-column:2;display:flex;gap:22px;align-items:flex-end}
.ps-th{width:38px;height:52px;border:1px solid #C9D3CF;border-radius:3px;background:#fff;display:flex;flex-direction:column;gap:3px;padding:5px 4px;box-sizing:border-box;position:relative}.ps-th.land{width:60px;height:42px}
.ps-th i{display:block;height:4px;background:#CFE3DA;border-radius:2px}.ps-th i.s{width:70%;background:#E5ECE9}.ps-th em{position:absolute;left:50%;bottom:-17px;transform:translateX(-50%);font-style:normal;font-size:10px;color:#6B7773;white-space:nowrap}.ps-thumbs{padding-bottom:16px}.ps-on{display:flex;gap:8px;align-items:center;cursor:pointer}
.ps-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.ps-cl{display:flex;flex-direction:column;gap:5px}
.ps-c{display:block;text-align:left;border:1px solid #F3B8B8;background:#FDF2F2;border-radius:8px;padding:6px 10px;font:inherit;font-size:13px;cursor:pointer}.ps-c b{color:#B42318;margin-right:4px}.ps-c.on{border-color:#B7E1CF;background:#EEF8F3}.ps-c.on b{color:#0E7A5F}
.a4.ps-page{width:100%;max-width:820px;aspect-ratio:210/297;background:#fff;box-shadow:0 1px 8px rgba(0,0,0,.12);padding:4.5% 6%!important;box-sizing:border-box;display:flex;flex-direction:column;gap:12px;color:#18221F;font-size:13.5px;overflow:hidden}
.ps-top{display:flex;justify-content:space-between;font-size:11px;color:#7A8682;border-bottom:2px solid #0E7A5F;padding-bottom:6px}
.ps-h{margin:4px 0 0;font-size:24px;line-height:1.3}.ps-st{margin:6px 0 0;font-size:15.5px;color:#0E7A5F}
.ps-kpi{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ps-kpi>div{background:#F1F6F4;border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:2px}.ps-kpi small{font-size:11.5px;color:#5A6662}.ps-kpi b{font-size:15px}.ps-kpi em{font-style:normal;font-weight:800;font-size:14px}
.up{color:#0E7A5F;font-weight:700}.dn{color:#C4472F;font-weight:700}
.ps-ctr{display:flex;flex-direction:column;gap:3px;font-size:12.5px}.ps-ctr span{display:inline-block;font-size:11px;font-weight:700;border-radius:99px;padding:1px 7px;margin-right:4px}.ps-ctr .k{background:#E2F1EB;color:#0E7A5F}.ps-ctr .c{background:#FDECEC;color:#B42318}.ps-ctr .n{background:#E7EEFF;color:#2952CC}
.ps-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 18px}.ps-li{display:flex;align-items:baseline;gap:8px;padding:6px 0;border-bottom:1px solid #EEF1EF;font-size:13.5px}.ps-li span{flex:1;min-width:0}.ps-li b{white-space:nowrap;color:#0E7A5F;font-size:14.5px}.ps-li i{font-style:normal;color:#7A8682;white-space:nowrap}.ps-li em{font-style:normal;color:#9AA4A0}
.ps-sits{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ps-sit{border:1px solid #E1E6E3;border-radius:10px;padding:8px 12px}.ps-sit>b{display:block;font-size:14.5px;margin-bottom:2px}
.ps-t{width:100%;border-collapse:collapse;font-size:13px}.ps-t th{background:#F1F6F4;font-size:11.5px;color:#5A6662;text-align:right;padding:6px 8px}.ps-t th:first-child,.ps-t td:first-child{text-align:left}.ps-t td{padding:6px 8px;border-bottom:1px solid #EEF1EF;text-align:right;white-space:nowrap}.ps-t td:first-child{white-space:normal}
.ps-chk{margin:0;padding-left:18px;font-size:13px;line-height:1.7}
.a4.ps-page{height:auto!important;min-height:0!important}.ps-land.a4.ps-page{aspect-ratio:297/210;max-width:1120px;padding:3% 3.5%!important;gap:8px;font-size:12.5px}
.ps-cmp{width:100%;border-collapse:collapse;font-size:12.5px;table-layout:fixed}.ps-cmp th,.ps-cmp td{border:1px solid #D5DBD8;padding:5px 6px;text-align:center;vertical-align:middle;word-break:keep-all}
.ps-cmp thead th{font-size:13.5px;padding:7px}.ps-cmp .h0{border-top:3px solid #18221F}.ps-cmp .h1{border-top:3px solid #2F6FEB;color:#2F6FEB}.ps-cmp .h2{border-top:3px solid #D92D20;background:#FFF6C2}
.ps-cmp td.r{text-align:right;font-variant-numeric:tabular-nums}.ps-cmp td.psc{color:#D92D20}.ps-cmp td.psn{color:#2F6FEB}.ps-cmp tr.sum td{font-weight:800;border-top:2px solid #18221F}.ps-cmp tr.sum small{display:block;font-size:11px}
.ps-cov th{background:#F4F6F5;font-size:12px;width:9%}.ps-cov td{text-align:left;width:24.3%}.ps-cov .h2c{background:#FFFDF0}.ps-memo{min-height:46px;text-align:left;font-size:12px;line-height:1.55;white-space:pre-wrap}
.ps-ed{outline:none;border-radius:4px}.dc-sheets .ps-ed:hover,.dc-sheets .ps-ed:focus{background:#FFF8D6}.dc-sheets .ps-memo:empty::before{content:attr(data-ph);color:#9AA4A0}
.ps-mx table{border-collapse:collapse;font-size:13px;margin:4px 0}.ps-mx th,.ps-mx td{border-bottom:1px solid var(--line,#e5e5e5);padding:5px 8px;text-align:left}.ps-x{border:1px solid var(--line,#d9dee3);background:#fff;border-radius:99px;padding:3px 11px;font:inherit;font-size:12.5px;cursor:pointer;color:#B42318}.ps-x.on{background:#E2F1EB;border-color:#B7E1CF;color:#0E7A5F;font-weight:700}
.ps-tg{font-size:11px;font-weight:700;border-radius:99px;padding:1px 7px}.ps-tg.c{background:#F0F3F1}.ps-tg.n{background:#E7EEFF;color:#2952CC}
.ps-foot{margin-top:auto;display:flex;justify-content:space-between;gap:14px;font-size:10.5px;color:#7A8682;border-top:1px solid #E1E6E3;padding-top:8px}.ps-foot b{white-space:nowrap;color:#18221F}`; document.head.appendChild(s); })();

window.PROPSUM={PS,panelHTML,pages:(docs,me)=>!docs.length||!RM()?"":PS.cmp?cmpPage(docs,me):PS.on?pages(docs,me):""};
})();
