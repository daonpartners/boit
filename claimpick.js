/* 보잇 · 보상청구 › 담보 분석 자동 선택 · 발송 전 확인 창 · 발송 후 예상 보험금 창 (2026-11-23 대표 지시)
   ① 담보 분석: 고객 가입 담보(보장분석·내보험다보여로 고객관리에 저장된 계약, 또는 이 청구에서 올린 보장분석 PDF)를
      사고 유형·청구 항목과 맞춰, 해당 담보가 있는 보험사를 청구에 자동으로 넣음. 담보 정보가 없으면 가입 회사만 보여 줌.
      사고일보다 늦게 가입했거나 해지·만기·소멸된 계약은 뺌. 판정은 담보 이름 기준이라 실제 보장 여부는 약관 확인.
   ② 발송 전 확인 창: 고객·청구 항목·보험사별 팩스번호·장수·이용량을 보여 주고, "확인했습니다" 체크 후에만 [확인·발송].
   ③ 발송 후 예상 보험금 창: 예상 보험금 계산(claimest.js) 결과를 보낸 보험사별로 보여 줌. 상담용 참고 금액. */
(function(){
"use strict";
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const won=n=>Math.round(n).toLocaleString()+"원";
const MX=()=>typeof MAXINS!=="undefined"?MAXINS:6;

/* 청구 항목 → 담보 이름 판정 (보장분석 담보명 기준) */
const BIG=/암|뇌|심장|허혈|심근|협심/;
const RULE={
  silin:{lab:"실손 입원",sil:true,ok:n=>!/통원|외래|처방|약제/.test(n)},
  silout:{lab:"실손 통원·약제",sil:true,ok:n=>!/입원/.test(n)},
  hosp:{lab:"입원일당",ok:n=>/입원|간병/.test(n)&&!/요양|중환자|의료비|실손/.test(n)&&!BIG.test(n)},
  surg:{lab:"수술비",ok:n=>/수술/.test(n)&&!BIG.test(n)},
  dxc:{lab:"암 진단비",ok:n=>/암/.test(n)&&!/수술|입원|통원|사망|항암|요양/.test(n)},
  dxb:{lab:"뇌혈관 진단비",ok:n=>/뇌/.test(n)&&!/수술|입원|통원|사망/.test(n)},
  dxh:{lab:"심장 진단비",ok:n=>/심장|허혈|심근|협심/.test(n)&&!/수술|입원|통원|사망/.test(n)},
  chemo:{lab:"항암치료비",ok:n=>/항암|표적/.test(n)},
  disab:{lab:"후유장해",ok:n=>/후유장해/.test(n)},
  death:{lab:"사망",ok:n=>/사망/.test(n)},
  frac:{lab:"골절",ok:n=>/골절/.test(n)},
  tooth:{lab:"치아",ok:n=>/치아|보존|보철|크라운|임플란트|틀니|브릿지|레진|충전/.test(n)}};
/* 질병 사고면 '상해·재해' 담보 제외, 상해 사고면 '질병' 담보 제외 */
const sideOk=n=>{ const t=(S.acc&&S.acc.type)||""; if(/^질병/.test(t)) return !/상해|재해/.test(n); if(/상해|재해/.test(t)) return !/질병/.test(n); return true; };

function cust(){ const n=(S.cl&&S.cl.name||"").trim(); if(!n) return null; const p=String(S.cl.phone||"").replace(/\D/g,"");
  return (S.cl.custId&&CUSTOMERS.find(x=>x.id===S.cl.custId&&x.name===n))||(p.length>=10&&CUSTOMERS.find(x=>x.name===n&&String(x.phone||"").replace(/\D/g,"")===p))||null; }
const idOf=co=>typeof insIdByName==="function"?insIdByName(co):null;

/* 결과: {state, rows:[{co,id,hits:[담보명],none,why}], recs:[id]} */
function analyze(){
  if(S.cat==="pet"||S.cat==="liab") return {state:"skip",rows:[],recs:[]};
  const c=cust(), I=window.CE&&CE.ins?CE.ins():null;
  if(!c&&!I) return {state:"nocust",rows:[],recs:[]};
  if(!S.acc||!S.acc.type) return {state:"notype",rows:[],recs:[]};
  const keys=Object.keys(S.acc.items||{}).filter(k=>S.acc.items[k]&&RULE[k]);
  if(!keys.length) return {state:"noitem",rows:[],recs:[]};
  const rows=new Map(), row=co=>{ if(!rows.has(co)) rows.set(co,{co,id:idOf(co),hits:[],late:0,none:false,why:""}); return rows.get(co); };
  if(I&&(I.contracts||[]).length){
    I.contracts.forEach(ct=>{ const r=row(ct.company); if(!CE.live(ct)) return; if(!CE.inForce(ct)){ r.late++; return; }
      (ct.covers||[]).forEach(v=>{ const n=String(v.name||""); if(/해지|소멸|만기/.test(v.status||"")) return;
        keys.forEach(k=>{ const R=RULE[k]; if(!!R.sil!==(ct.kind==="실손")) return; if(!R.ok(n)||!sideOk(n)) return;
          const t=`${R.lab}: ${n}${v.amount?" "+v.amount:""}`; if(!r.hits.includes(t)) r.hits.push(t); }); }); });
    rows.forEach(r=>{ if(!r.hits.length){ r.none=true; r.why=r.late?"사고일 뒤에 가입한 계약만 있음":"고른 청구 항목에 해당하는 담보 없음"; } });
    /* 고객관리 계약 중 담보 정보가 없는 회사도 표시 */
    if(c) CONTRACTS.filter(k=>k.cust===c.id&&!(k.cov||[]).length).forEach(k=>{ if(!rows.has(k.insurer)){ const r=row(k.insurer); r.none=true; r.nocov=true; r.why="담보 정보 없음 — 보장분석을 저장하면 판정"; } });
    const L=[...rows.values()].sort((a,b)=>b.hits.length-a.hits.length);
    return {state:"cov",rows:L,recs:[...new Set(L.filter(r=>r.hits.length&&r.id).map(r=>r.id))]}; }
  /* 담보 정보가 없으면 가입 회사만 */
  const ks=c?CONTRACTS.filter(k=>k.cust===c.id):[];
  if(!ks.length) return {state:"nocontract",rows:[],recs:[]};
  ks.forEach(k=>{ const r=row(k.insurer); r.nocov=true; r.why=(k.product||"")+(k.kind?" · "+k.kind:""); });
  return {state:"company",rows:[...rows.values()],recs:[]}; }

/* 청구 항목이 바뀔 때마다 자동으로 넣고(최대 6곳), 이전에 자동으로 넣었던 곳 중 더는 해당 없는 곳은 뺌. 직접 고른 곳은 건드리지 않음 */
function auto(){ const A=analyze(), c=cust();
  const key=[c?c.id:"",S.acc&&S.acc.type,Object.keys(S.acc&&S.acc.items||{}).filter(k=>S.acc.items[k]).sort().join(","),A.recs.join(",")].join("|");
  if(S.cpKey===key) return A; S.cpKey=key;
  const prev=S.cpAuto||[]; S.ins=S.ins.filter(id=>!prev.includes(id)||A.recs.includes(id));
  const add=[], over=[]; A.recs.forEach(id=>{ if(S.ins.includes(id)) return; if(S.ins.length<MX()){ S.ins.push(id); add.push(id); } else over.push(id); });
  S.cpAuto=prev.filter(id=>S.ins.includes(id)&&A.recs.includes(id)).concat(add);
  S.cpMsg=add.length?`담보 분석으로 ${add.map(id=>insBy(id).name).join(", ")}을(를) 청구에 넣었습니다.`:"";
  if(over.length) S.cpMsg+=` 한 번에 ${MX()}곳까지라 ${over.map(id=>insBy(id).name).join(", ")}은(는) 넣지 못했습니다.`;
  return A; }

function html(){ const A=analyze(); if(A.state==="skip") return "";
  const head=`<div class="cpk-box" id="cpk-box"><div class="cp-h"><b>담보 분석 · 청구 보험사 자동 선택</b><span class="note">가입 담보와 청구 항목을 맞춰 해당 보험사를 넣습니다 (최대 ${MX()}곳)</span></div>`;
  const msg={nocust:"아래 2번에서 내 고객을 고르거나, '예상 보험금'에서 보장분석 PDF를 올리면 분석합니다.",notype:"아래 3번에서 사고 유형을 고르면 분석합니다.",noitem:"아래 3번에서 청구 항목을 체크하면 해당 담보가 있는 보험사를 찾습니다.",nocontract:"이 고객에게 등록된 계약이 없습니다. 아래에서 보험사를 직접 고르세요."}[A.state];
  if(msg) return head+`<p class="note" style="margin:6px 0 0">${msg}</p></div>`;
  const rec=A.recs.length, sel=new Set(S.ins);
  const tr=r=>`<tr class="${r.hits.length?"":"cp-no"}"><td><b>${esc(r.co)}</b></td><td>${r.hits.length?r.hits.map(h=>`<div>${esc(h)}</div>`).join(""):`<span class="note">${esc(r.why)}</span>`}</td>
    <td class="cp-act">${r.id?(sel.has(r.id)?`<span class="pill ok">청구 선택됨</span> <button class="lnk" type="button" data-ins="${r.id}">빼기</button>`:`<button class="btn sm${r.hits.length?" primary":""}" type="button" data-ins="${r.id}">청구에 넣기</button>`):'<span class="note">보험사 직접 선택</span>'}</td></tr>`;
  return head+`${S.cpMsg?`<p class="cp-msg">${esc(S.cpMsg)}</p>`:""}
    ${A.state==="company"?`<p class="note" style="margin:6px 0 0">저장된 담보 정보가 없어 가입 회사만 보여 줍니다. 보장분석을 저장하면 담보로 판정합니다.</p>`:`<p class="note" style="margin:6px 0 0">해당 담보 있음 <b>${rec}</b>곳 · 없음 ${A.rows.filter(r=>!r.hits.length).length}곳</p>`}
    <div class="tbl-wrap" style="margin-top:6px"><table class="cp-t"><thead><tr><th>보험사</th><th>${A.state==="company"?"가입 상품":"해당 담보"}</th><th></th></tr></thead><tbody>${A.rows.map(tr).join("")}</tbody></table></div>
    <p class="note" style="margin:6px 0 0">담보 이름으로 판정한 결과입니다. 실제 보장 여부·지급 조건은 각 보험사 약관과 심사로 정해집니다.</p></div>`; }
/* 발송 화면·확인 창에서 보험사별 해당 담보 */
function hitsOf(id){ const A=analyze(); const r=A.rows.find(x=>x.id===id); return r?r.hits:[]; }

/* ---------- 예상 보험금 (claimest.js 결과를 보험사별로) ---------- */
function estBy(){ if(!window.CE||!CE.estimate) return null; let R=null; try{ R=CE.estimate(); }catch(e){ R=null; } if(!R||!R.out.length) return null;
  const m=new Map(); R.out.forEach(x=>{ const id=idOf(x.co); const k=id||x.co; const a=m.get(k)||{id,co:x.co,L:[]}; a.L.push(x); m.set(k,a); }); return m; }

/* ---------- 창 공통 ---------- */
function modal(id,inner){ const old=document.getElementById(id); if(old) old.remove();
  const w=document.createElement("div"); w.id=id; w.className="cp-m"; w.setAttribute("role","dialog"); w.setAttribute("aria-modal","true"); w.innerHTML=`<div class="cp-mb">${inner}</div>`;
  document.body.appendChild(w); return w; }

/* ② 발송 전 확인: Promise<boolean> */
function confirmSend(o){ o=o||{}; return new Promise(res=>{
  const pg=allFiles().length+2, items=(typeof itemsFor==="function"?itemsFor():[]).filter(([k])=>S.acc.items[k]).map(([,v])=>v), E=estBy();
  const acct={auto:"자동이체 계좌",paid:"자동이체 계좌",saved:"저장된 계좌",new:"새로 입력한 계좌"}[S.acc.acct]||"-";
  const rows=S.ins.map(id=>{ const i=insBy(id), h=hitsOf(id), e=E&&E.get(id), v=e?e.L.reduce((a,x)=>a+(x.v||0),0):0;
    return `<tr><td><b>${esc(i.name)}</b>${h.length?`<div class="note">${esc(h.slice(0,2).join(" · "))}${h.length>2?` 외 ${h.length-2}`:""}</div>`:""}</td><td class="num">${esc(faxOf(id)||"번호 없음")}</td><td class="num">${pg}장</td><td class="num">${v?won(v):"-"}</td></tr>`; }).join("");
  const w=modal("cp-confirm",`<h2>발송 전 마지막 확인</h2>
    <p class="cp-warn">${o.live?"실제 팩스로 보험사에 접수됩니다. 보낸 뒤에는 되돌릴 수 없습니다.":"체험 모드입니다. 실제 팩스는 나가지 않습니다."}</p>
    <dl class="cp-dl"><dt>고객</dt><dd>${esc(S.cl.name||"")} · <span class="num">${esc(typeof maskRrn==="function"&&S.cl.rrn?maskRrn(S.cl.rrn):"")}</span> · ${esc(S.cl.phone||"")}</dd>
      <dt>청구</dt><dd>${esc(typeof catLabel==="function"?catLabel():"")} ${esc(S.acc.type||"")}${S.acc.date?" · 사고일 "+esc(S.acc.date):""}${items.length?"<br>"+esc(items.join(", ")):""}</dd>
      <dt>받을 계좌</dt><dd>${esc(acct)}</dd><dt>첨부</dt><dd>서류 ${allFiles().length}장 + 청구서·동의서 → 보험사당 ${pg}장</dd></dl>
    <div class="tbl-wrap"><table class="cp-t"><thead><tr><th>보험사 (${S.ins.length}곳)</th><th>받는 팩스</th><th>장수</th><th>예상 금액</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${o.use?`<p class="note" style="margin:8px 0 0">${esc(o.use)}</p>`:""}
    <label class="cp-chk"><input type="checkbox" id="cp-ok"> 고객 정보·보험사·팩스번호·서류를 확인했습니다</label>
    <div class="cp-a"><button type="button" class="btn" data-cp="no">취소</button><button type="button" class="btn primary" data-cp="yes" disabled>확인·발송</button></div>`);
  const chk=w.querySelector("#cp-ok"), y=w.querySelector('[data-cp="yes"]');
  const done=v=>{ w.remove(); document.removeEventListener("keydown",kd); res(v); }, kd=e=>{ if(e.key==="Escape") done(false); };
  chk.addEventListener("change",()=>{ y.disabled=!chk.checked; });
  w.addEventListener("click",e=>{ const b=e.target.closest("[data-cp]"); if(b){ if(b.dataset.cp==="yes"&&!chk.checked) return; done(b.dataset.cp==="yes"); } else if(e.target===w) done(false); });
  document.addEventListener("keydown",kd); setTimeout(()=>chk.focus(),0); }); }

/* ③ 발송 후 예상 보험금 */
function afterSend(ids){ const E=estBy(), sent=(ids&&ids.length?ids:S.ins).slice();
  let body="", tot=0;
  if(E){ const L=sent.map(id=>E.get(id)).filter(Boolean);
    if(L.length){ body=L.map(g=>{ const s=g.L.reduce((a,x)=>a+(x.v||0),0); tot+=s;
      return `<tr class="cp-co"><td colspan="2"><b>${esc(g.co)}</b></td><td class="num"><b>${s?won(s):"확인 필요"}</b></td></tr>`+g.L.map(x=>`<tr><td>${esc(x.cov)}</td><td class="note">${esc(x.why||"")}</td><td class="num">${x.v!=null&&x.v?won(x.v):'<span class="note">확인 필요</span>'}</td></tr>`).join(""); }).join("");
      const miss=sent.filter(id=>!E.get(id)).map(id=>insBy(id).name); if(miss.length) body+=`<tr><td colspan="3" class="note">${esc(miss.join(", "))}: 이번 서류·항목으로 계산된 담보 없음</td></tr>`; } }
  const w=modal("cp-after",`<h2>발송 접수 · 예상 보험금</h2>
    <p class="note" style="margin:0 0 8px">${esc(S.cl.name||"")} 고객 · ${sent.map(id=>esc(insBy(id).name)).join(", ")} ${sent.length}곳</p>
    ${body?`<div class="tbl-wrap"><table class="cp-t"><thead><tr><th>담보</th><th>근거</th><th>예상 금액</th></tr></thead><tbody>${body}</tbody>
      <tfoot><tr><td colspan="2"><b>금액이 나온 것 합계</b></td><td class="num"><b>${won(tot)}</b></td></tr></tfoot></table></div>`
      :`<p class="note">가입 담보 정보나 영수증·진단 내용이 없어 예상 금액을 계산하지 못했습니다. 고객관리에 보장분석을 저장하고 서류 글자 읽기를 하면 다음부터 표시됩니다.</p>`}
    <p class="cp-warn" style="margin-top:10px">상담용 예상 금액입니다. 실제 지급은 약관과 보험사 심사(면책·감액기간, 보장개시일, 고지 여부, 중복 실손 비례보상 등)로 정해집니다.</p>
    <div class="cp-a"><button type="button" class="btn" data-cp="alim">청구접수 알림톡 보내기</button><button type="button" class="btn primary" data-cp="close">닫기</button></div>`);
  w.addEventListener("click",e=>{ const b=e.target.closest("[data-cp]"); if(!b&&e.target!==w) return; w.remove(); if(b&&b.dataset.cp==="alim"){ const a=document.getElementById("cl-alim"); if(a) a.click(); } }); }

const css=document.createElement("style");
css.textContent=`.cpk-box{text-align:left;margin:10px 0 12px;width:auto;max-width:none;box-shadow:none;display:block;padding:12px 14px;border:1px solid var(--line,#D6E6DF);border-radius:12px;background:#F4FBF8}
.cpk-box p,.cpk-box .cp-h{text-align:left}.cp-h{display:flex;gap:8px;flex-wrap:wrap;align-items:baseline}.cp-msg{margin:6px 0 0;font-size:13.5px;color:var(--accent,#0E9A72);font-weight:600}
.cp-t{width:100%;font-size:13px;text-align:left}.cp-t td,.cp-t th{vertical-align:top}.cp-t tr.cp-no td{opacity:.65}.cp-t .cp-act{white-space:nowrap;text-align:right}.cp-t tr.cp-co td{background:#F2F8F5}
.cp-m{position:fixed;inset:0;z-index:9998;display:grid;place-items:center;background:rgba(10,30,25,.45);padding:14px}
.cp-mb{background:#fff;color:#17211E;border-radius:16px;max-width:620px;width:100%;max-height:90vh;overflow:auto;padding:20px 22px;box-shadow:0 20px 60px rgba(0,0,0,.25)}
.cp-mb h2{margin:0 0 8px;font-size:19px}.cp-warn{margin:0 0 10px;padding:8px 10px;border-radius:8px;background:#FFF4E5;color:#9A3412;font-size:13px}
.cp-dl{display:grid;grid-template-columns:76px 1fr;gap:4px 10px;margin:0 0 10px;font-size:13.5px}.cp-dl dt{color:#5B6B66}.cp-dl dd{margin:0}
.cp-chk{display:flex;gap:8px;align-items:center;margin:12px 0 0;padding:10px;border:2px solid var(--accent,#0E9A72);border-radius:10px;font-weight:600;font-size:14px;cursor:pointer}
.cp-chk input{width:20px;height:20px}.cp-a{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}.cp-a .btn[disabled]{opacity:.45;cursor:not-allowed}`;
document.head.appendChild(css);

window.CP={html,auto,analyze,confirmSend,afterSend,hitsOf};
})();
