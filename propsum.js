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
const PS={on:true,cur:[],msg:"",seq:1};

/* 리모델링 표 계산을 이 화면 계약으로 잠깐 바꿔서 (리모델링 비교표 화면의 내용은 건드리지 않음) */
function withRM(cur,prop,fn){ const S=RM().S, a=S.cur, b=S.prop; S.cur=cur; S.prop=prop; try{ return fn(); } finally{ S.cur=a; S.prop=b; } }
function propOf(docs){ return docs.map((d,i)=>{ const p=d.M.p; const items=RM().fixSubs((p.items||[]).filter(x=>!x.group).map(x=>({name:x.name,amt:x.amt,cat:RM().classify(x.name),per:x.per||"",raw:x.amtText||""})),p.details);
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

function pages(docs,me){ const X=rowsOf(docs); if(!X) return ""; const {T,prop}=X, p=docs[0].M.p, two=PS.cur.length>0;
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

function panelHTML(){ const n=PS.cur.length;
  return `<div class="ps-panel"><label class="ps-on"><input type="checkbox" id="ps-on" ${PS.on?"checked":""}> <b>고객용 요약 붙이기</b> <span class="note">${n?"리모델링 2장":"단품 제안 1장"} · 설계서 앞에 들어갑니다</span></label>
    <div class="ps-row"><label class="btn sm" style="cursor:pointer">기존 보장분석 PDF 올리기 (리모델링일 때)<input id="ps-cov" type="file" accept="application/pdf,.pdf" multiple hidden></label>${n?`<button type="button" class="lnk" id="ps-covx">보장분석 빼기 (단품 제안으로)</button>`:""}<span class="note" id="ps-msg">${esc(PS.msg)}</span></div>
    ${n?`<div class="ps-cl"><span class="note">기존 계약 — 눌러서 유지/정리를 바꾸세요</span>${PS.cur.map((c,i)=>`<button type="button" class="ps-c${c.on?" on":""}" data-psc="${i}"><b>${c.on?"유지":"정리"}</b> ${esc(c.co)} ${esc(c.prod)} · ${won(c.prem)}</button>`).join("")}</div>`:""}</div>`; }

async function addCover(files){ PS.msg="보장분석 읽는 중…"; redraw();
  const S=RM().S, a=S.cur; S.cur=PS.cur; let m="";
  try{ await RM().addCover(files); m=S.msg||""; } finally{ S.cur=a; try{ RM().draw(); }catch(_){} }
  PS.msg=m; redraw(); }
function redraw(){ if(window.DECO&&DECO.draw) DECO.draw(); }

document.addEventListener("change",e=>{ const t=e.target;
  if(t.id==="ps-on"){ PS.on=t.checked; redraw(); }
  if(t.id==="ps-cov"){ const f=[...t.files]; t.value=""; if(f.length) addCover(f); } });
document.addEventListener("click",e=>{ const b=e.target.closest("[data-psc],#ps-covx"); if(!b) return;
  if(b.id==="ps-covx"){ PS.cur=[]; PS.msg=""; redraw(); return; }
  const c=PS.cur[+b.dataset.psc]; if(c){ c.on=!c.on; redraw(); } });

(function css(){ if(document.getElementById("ps-css")) return; const s=document.createElement("style"); s.id="ps-css"; s.textContent=`
.ps-panel{margin-top:10px;padding:10px 12px;border:1px dashed var(--line,#d9dee3);border-radius:10px;display:flex;flex-direction:column;gap:8px}.ps-on{display:flex;gap:8px;align-items:center;cursor:pointer}
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
.ps-foot{margin-top:auto;display:flex;justify-content:space-between;gap:14px;font-size:10.5px;color:#7A8682;border-top:1px solid #E1E6E3;padding-top:8px}.ps-foot b{white-space:nowrap;color:#18221F}`; document.head.appendChild(s); })();

window.PROPSUM={PS,panelHTML,pages:(docs,me)=>PS.on&&docs.length?pages(docs,me):""};
})();
