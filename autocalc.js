/* 보잇 · 자동차 › ① 경상 합의금 계산 ② 사고 환입 비교 (2026-11-03)
   ① 근거: carcomp.js와 같은 원문 확인분 — 삼성화재 개인용 애니카자동차보험 약관(2025.11.16 개정) <별표1> 대인배상 지급기준
      · 부상 위자료(12~14급 15만원 … 1급 200만원) · 휴업손해 = 1일 수입감소액 × 휴업일수 × 85% (수입 감소가 관계 서류로 증명될 때)
      · 그 밖의 손해배상금: 통원 1일 8,000원, 입원 중 병원 식사를 제공받지 않은 경우 한 끼 4,030원
      · <별표3> 과실상계: 2023.1.1 이후 사고, 차량운전자 12~14급 → 치료관계비 중 대인배상Ⅰ 한도 초과분은 본인 과실만큼 본인 부담
      · 자동차손해배상 보장법 시행령 별표1: 대인배상Ⅰ 부상 한도
      일용근로자 임금(가사종사자 등)은 반기마다 바뀌므로 숫자를 넣어두지 않고 보험사 적용 금액을 입력받음.
   ② 사고 환입: 할인·할증 보험료는 보험사 요율로 정해지므로 계산하지 않음. 보험사 전산 재산출 값(사고 반영 / 환입 후)을 넣어 손익만 계산.
   상담·교육용 참고 계산. 보험금·보험료는 보험사가 정함. */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const num=v=>{ const n=+String(v==null?"":v).replace(/[^\d.]/g,""); return isFinite(n)?n:0; };
const won=n=>(n<0?"−":"")+Math.round(Math.abs(n)).toLocaleString()+"원";
const comma=v=>{ const d=String(v==null?"":v).replace(/[^\d]/g,""); return d?(+d).toLocaleString():""; };
const WIJA=[200,176,152,128,75,50,40,30,25,20,20,15,15,15];
const DAEIN1=[3000,1500,1200,1000,900,700,500,300,240,200,160,120,80,50];
const TONG=8000, MEAL=4030, HU=0.85;

/* ===== ① 경상 합의금 ===== */
const S={grade:12,hosp:"",visit:"",meal:"",huType:"none",daily:"",huDays:"",fault:"",tx:"",driver:true,post:true};
function calcS(){
  const g=S.grade, hosp=num(S.hosp), visit=num(S.visit), meal=num(S.meal), daily=S.huType==="none"?0:num(S.daily);
  const huDays=S.huType==="none"?0:(S.huDays===""?hosp:num(S.huDays));
  const wija=WIJA[g-1]*1e4, hueop=daily*huDays*HU, tong=visit*TONG, meals=meal*MEAL, tx=num(S.tx);
  const pay=wija+hueop+tong+meals;              // 피해자에게 직접 주는 항목
  const f=Math.min(100,num(S.fault))/100, total=tx+pay, after=total*(1-f);
  const d1=DAEIN1[g-1]*1e4, light=S.post&&g>=12&&S.driver;
  let txPay, cash, own=0, lines=[];
  if(f<=0){ txPay=tx; cash=pay; lines.push("과실 0% → 치료비 전액 + 지급 항목 전액"); }
  else if(light){
    txPay=Math.min(tx,d1)+Math.max(0,tx-d1)*(1-f); own=tx-txPay;
    cash=Math.max(0,after-txPay); // 과실상계 후 총액에서 보험사 치료비 부담분을 뺀 나머지
    lines.push(`손해액 ${won(total)} × (1 − 본인 과실 ${Math.round(f*100)}%) = ${won(after)}`);
    lines.push(`치료비: 대인Ⅰ 한도 ${(DAEIN1[g-1]).toLocaleString()}만원까지 전액, 초과분 ${won(Math.max(0,tx-d1))}은 상대 과실만큼만 → 보험사 부담 ${won(txPay)}`);
    if(own>0) lines.push(`치료비 중 본인 과실분 ${won(own)}은 본인 보험(자손·자상)으로 처리`);
  } else {
    txPay=tx; cash=Math.max(0,after-tx);
    lines.push(`손해액 ${won(total)} × (1 − 본인 과실 ${Math.round(f*100)}%) = ${won(after)}`);
    lines.push(after<tx?"과실상계 후 금액이 치료비보다 적으면 치료비만 지급 → 합의금 0원":`보험사가 낸 치료비 ${won(tx)}를 빼고 나머지를 합의금으로`);
  }
  return {g,hosp,visit,meal,huDays,daily,wija,hueop,tong,meals,tx,pay,total,f,after,txPay,own,cash:Math.round(cash),lines,light};
}
function fi(id,label,val,ph,tip,em){ return `<div class="cc-f in"><label for="${id}">${label}<em>${em||"입력"}</em></label><input id="${id}" inputmode="numeric" value="${esc(val)}" placeholder="${esc(ph||"")}"><small>${tip||""}</small></div>`; }
function auto(label,val,tip){ return `<div class="cc-f auto"><label>${label}<em>자동</em></label><b>${val}</b><small>${tip||""}</small></div>`; }
function drawS(){
  const B=$("#ac-settle"); if(!B) return; const R=calcS();
  const huTip={none:"수입 감소 없음 (학생·무직·급여 정상지급 등)",proof:"급여명세서·소득금액증명 등 세법상 서류로 증명된 1일 감소액",house:"가사종사자 등 — 보험사가 적용하는 일용근로자 임금(1일)을 입력 · 반기마다 바뀜"}[S.huType];
  B.innerHTML=`<div class="cc-hero"><div><b>경상환자 합의금 계산</b><span>대인배상 지급기준(약관 별표1·별표3)으로 위자료 · 휴업손해 · 통원비를 계산합니다.</span></div><button class="btn" type="button" id="ac-s-print">고객용 출력·PDF</button></div>
  <div class="panel" style="margin-top:14px"><div class="cc-form">
    <div class="cc-f in"><label for="ac-grade">부상급수<em>입력</em></label><select id="ac-grade">${WIJA.map((w,i)=>`<option value="${i+1}" ${S.grade===i+1?"selected":""}>${i+1}급 · 위자료 ${w}만</option>`).join("")}</select><small>진단서로 보험사가 정함 (12급 염좌 · 14급 단순 타박 등)</small></div>
    ${fi("ac-hosp","입원일수",S.hosp,"0","실제 입원한 날")}
    ${fi("ac-visit","통원일수",S.visit,"0","실제 통원한 날 × 8,000원")}
    ${fi("ac-meal","병원 식사 안 받은 끼니",S.meal,"0","입원 중 병원 식사 미제공 시 한 끼 4,030원")}
    <div class="cc-f in"><label for="ac-hutype">휴업손해<em>입력</em></label><select id="ac-hutype"><option value="none" ${S.huType==="none"?"selected":""}>해당 없음</option><option value="proof" ${S.huType==="proof"?"selected":""}>소득 증빙 있음</option><option value="house" ${S.huType==="house"?"selected":""}>가사종사자 등 (일용근로자 임금)</option></select><small>${huTip}</small></div>
    ${S.huType==="none"?"":fi("ac-daily","1일 금액 (원)",comma(S.daily),"예: 120,000",S.huType==="house"?"보험사에 적용 금액 확인":"1일 수입감소액")}
    ${S.huType==="none"?"":fi("ac-hudays","휴업일수",S.huDays,"비우면 입원일수","치료기간 중 보험사가 인정한 날")}
    ${fi("ac-fault","본인 과실 (%)",S.fault,"0","과실비율정보포털 기준 참고")}
    ${fi("ac-tx","치료비 (원)",comma(S.tx),"보험사가 병원에 낸 금액","과실이 있을 때만 결과에 영향")}
    <div class="cc-f in"><label for="ac-driver">피해자가 차량 운전자<em>입력</em></label><select id="ac-driver"><option value="1" ${S.driver?"selected":""}>예</option><option value="0" ${!S.driver?"selected":""}>아니오 (동승자·보행자 등)</option></select><small>12~14급 치료비 과실책임 적용 여부</small></div>
    <div class="cc-f in"><label for="ac-post">사고일<em>입력</em></label><select id="ac-post"><option value="1" ${S.post?"selected":""}>2023.1.1 이후</option><option value="0" ${!S.post?"selected":""}>2022.12.31 이전</option></select><small>과실상계 기준이 바뀐 날</small></div>
  </div></div>
  <div class="cc-res">
    <div class="cc-card" style="--c:var(--c1)"><span>예상 합의금 (현금)</span><b>${won(R.cash)}</b><small>${R.f>0?"과실상계 후 · 치료비 제외":"위자료 + 휴업손해 + 통원비 + 식대"}</small></div>
    <div class="cc-card" style="--c:var(--c2)"><span>보험사 치료비 부담</span><b>${won(R.txPay)}</b><small>병원에 직접 지급 (합의금과 별도)</small></div>
    <div class="cc-card" style="--c:var(--c3)"><span>지급 항목 합계 (과실 전)</span><b>${won(R.pay)}</b><small>${R.g}급 위자료 ${won(R.wija)} 포함</small></div>
  </div>
  <div class="panel"><h2>계산 내역</h2>
    <div class="tbl-wrap"><table class="cc-tbl"><tbody>
      <tr><th>위자료 (${R.g}급)</th><td>${won(R.wija)}</td></tr>
      <tr><th>휴업손해</th><td>${R.hueop?`${won(R.daily)} × ${R.huDays}일 × 85% = ${won(R.hueop)}`:"0원"}</td></tr>
      <tr><th>통원비</th><td>${R.visit}일 × 8,000원 = ${won(R.tong)}</td></tr>
      <tr><th>입원 식대</th><td>${R.meal}끼 × 4,030원 = ${won(R.meals)}</td></tr>
      ${R.f>0?R.lines.map(l=>`<tr><th>과실상계</th><td>${esc(l)}</td></tr>`).join(""):""}
    </tbody></table></div>
    <p class="note" style="margin-top:10px">휴업손해 85%는 이미 곱해서 계산합니다 (1일 금액에는 85% 전 금액을 넣으세요). 실제 합의 전에는 보험사에 <b>보험금 산출내역서</b>를 받아 항목별로 맞는지 대조하세요. 상담·교육용 참고 계산이며 보험금은 보험사가 사고 사실과 약관에 따라 정합니다.</p>
    <p class="note">근거: 자동차보험 약관 <별표1> 대인배상 지급기준(위자료·휴업손해·그 밖의 손해배상금), <별표3> 과실상계, 자동차손해배상 보장법 시행령 별표1</p></div>`;
}

/* ===== ② 사고 환입 비교 ===== */
const H={name:"",ins:"",acc:[{date:"",kind:"대물",amt:"",on:true}],yrs:[{y:"",a:"",b:""}]};
function calcH(){
  const cost=H.acc.filter(a=>a.on).reduce((s,a)=>s+num(a.amt),0);
  const rows=H.yrs.map((r,i)=>({i,y:r.y,a:num(r.a),b:num(r.b),d:num(r.a)-num(r.b)})).filter(r=>r.a||r.b);
  const first=rows[0]?rows[0].d:0, sum=rows.reduce((s,r)=>s+r.d,0);
  return {cost,rows,first,sum,firstNet:first-cost,net:sum-cost};
}
function drawH(){
  const B=$("#ac-refund"); if(!B) return; const R=calcH();
  const verdict=!R.rows.length?"보험료를 넣으면 판단합니다":R.net>0?`환입이 ${won(R.net)} 유리`:R.net<0?`환입하지 않는 편이 ${won(-R.net)} 유리`:"차이 없음";
  B.innerHTML=`<div class="cc-hero"><div><b>사고 환입 비교</b><span>보험사 전산으로 다시 산출한 보험료를 넣으면, 환입 비용 대비 몇 년 안에 얼마나 아끼는지 계산합니다.</span></div><button class="btn" type="button" id="ac-h-print">고객용 출력·PDF</button></div>
  <div class="panel" style="margin-top:14px"><div class="row" style="gap:12px;flex-wrap:wrap">
    <div class="field" style="flex:1;min-width:160px"><label for="ac-h-name">고객</label><input id="ac-h-name" list="dl-cust" value="${esc(H.name)}" placeholder="이름"></div>
    <div class="field" style="flex:1;min-width:160px"><label for="ac-h-ins">보험사</label><input id="ac-h-ins" value="${esc(H.ins)}" placeholder="예: DB손해보험"></div></div></div>
  <div class="panel" style="margin-top:14px"><div class="row between"><h2>① 사고 목록 (환입할 사고 체크)</h2><button class="btn" type="button" data-ach="addacc">사고 추가</button></div>
    <div class="tbl-wrap"><table class="cc-tbl"><thead><tr><th>환입</th><th>사고일</th><th>처리 담보</th><th>보험사 지급액(환입 비용)</th><th></th></tr></thead><tbody>
    ${H.acc.map((a,i)=>`<tr><td><input type="checkbox" data-acc="${i}:on" ${a.on?"checked":""} aria-label="환입"></td>
      <td><input data-acc="${i}:date" value="${esc(a.date)}" placeholder="20250120" inputmode="numeric" style="width:110px"></td>
      <td><select data-acc="${i}:kind">${["대물","자차","대인","자손·자상"].map(k=>`<option ${a.kind===k?"selected":""}>${k}</option>`).join("")}</select></td>
      <td><input data-acc="${i}:amt" value="${esc(comma(a.amt))}" placeholder="0" inputmode="numeric" style="width:140px"> 원</td>
      <td>${H.acc.length>1?`<button class="btn" type="button" data-ach="delacc:${i}">삭제</button>`:""}</td></tr>`).join("")}
    </tbody></table></div><p class="note">환입 비용 = 보험사가 그 사고로 지급한 금액 (보험사 사고 내역에서 확인)</p></div>
  <div class="panel" style="margin-top:14px"><div class="row between"><h2>② 보험사 전산 재산출 보험료</h2><button class="btn" type="button" data-ach="addyr" ${H.yrs.length>=5?"disabled":""}>다음 해 추가</button></div>
    <div class="tbl-wrap"><table class="cc-tbl"><thead><tr><th>연도</th><th>사고 반영 보험료</th><th>환입 후 보험료</th><th>차이</th><th></th></tr></thead><tbody>
    ${H.yrs.map((r,i)=>{ const d=num(r.a)-num(r.b); return `<tr><td><input data-yr="${i}:y" value="${esc(r.y)}" placeholder="${new Date().getFullYear()+i}" inputmode="numeric" style="width:70px"></td>
      <td><input data-yr="${i}:a" value="${esc(comma(r.a))}" placeholder="0" inputmode="numeric" style="width:130px"> 원</td>
      <td><input data-yr="${i}:b" value="${esc(comma(r.b))}" placeholder="0" inputmode="numeric" style="width:130px"> 원</td>
      <td><b>${(r.a||r.b)?won(d):"–"}</b></td><td>${H.yrs.length>1?`<button class="btn" type="button" data-ach="delyr:${i}">삭제</button>`:""}</td></tr>`; }).join("")}
    </tbody></table></div><p class="note">첫 해는 갱신 화면의 '사고처리 시 / 사고환입 시' 보험료. 다음 해부터는 보험사 산출값이 있을 때만 넣으세요 (빈 해는 계산하지 않음).</p></div>
  <div class="cc-res">
    <div class="cc-card" style="--c:var(--c3)"><span>환입 비용</span><b>${won(R.cost)}</b><small>체크한 사고 ${H.acc.filter(a=>a.on).length}건 합계</small></div>
    <div class="cc-card" style="--c:var(--c2)"><span>첫 해 손익</span><b>${won(R.firstNet)}</b><small>보험료 차이 ${won(R.first)} − 환입 비용</small></div>
    <div class="cc-card" style="--c:var(--c1)"><span>${R.rows.length||0}년 누적 손익</span><b>${won(R.net)}</b><small>${esc(verdict)}</small></div>
  </div>
  <p class="note">할인·할증 보험료는 보험사 요율로 정해지므로 보잇이 추정하지 않습니다. 환입 가능 여부·기한·방법은 해당 보험사에 확인하세요. 상담용 참고 계산입니다.</p>`;
}

/* ===== 출력 ===== */
function printHtml(title,body){
  const name=(window.ME&&ME.name)||"담당 설계사", ph=(window.ME&&ME.phone)||"";
  const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4;margin:12mm}body{font-family:"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#17211E;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .hd{background:linear-gradient(120deg,#123D35,#2563EB);color:#fff;border-radius:10px;padding:16px 18px;margin-bottom:14px}.hd h1{font-size:22px;margin:0 0 4px}.hd p{margin:0;font-size:12px;color:#dbe7ff}
  table{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0}th,td{border:1px solid #DDE3DF;padding:7px 9px;text-align:left}th{background:#F3F5F2}
  .res{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:12px 0}.res div{border:1px solid #DDE3DF;border-top:4px solid var(--c);border-radius:8px;padding:10px}.res span{font-size:12px;color:#5E6B66}.res b{display:block;font-size:21px;color:var(--c);margin:2px 0}.res small{font-size:10.5px;color:#5E6B66}
  .note{font-size:10.5px;color:#5E6B66}.ft{margin-top:16px;border-top:1px solid #DDE3DF;padding-top:8px;font-size:12px}</style></head><body>
  <div class="hd"><h1>${esc(title)}</h1><p>${esc(new Date().toLocaleDateString("ko-KR"))}</p></div>${body}<div class="ft">담당 ${esc(name)} ${esc(ph)}</div></body></html>`;
  const f=document.createElement("iframe"); f.style.cssText="position:fixed;right:0;bottom:0;width:0;height:0;border:0"; document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
  setTimeout(()=>{ try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){} setTimeout(()=>f.remove(),2000); },300);
}
function printS(){ const R=calcS();
  printHtml("교통사고 합의금 안내",`<div class="res"><div style="--c:#0E7A5F"><span>예상 합의금</span><b>${won(R.cash)}</b><small>치료비 제외</small></div><div style="--c:#2563EB"><span>보험사 치료비 부담</span><b>${won(R.txPay)}</b><small>병원 직접 지급</small></div><div style="--c:#D9480F"><span>부상급수</span><b>${R.g}급</b><small>본인 과실 ${Math.round(R.f*100)}%</small></div></div>
  <table><tr><th>위자료 (${R.g}급)</th><td>${won(R.wija)}</td></tr><tr><th>휴업손해</th><td>${R.hueop?`${won(R.daily)} × ${R.huDays}일 × 85% = ${won(R.hueop)}`:"0원"}</td></tr><tr><th>통원비</th><td>${R.visit}일 × 8,000원 = ${won(R.tong)}</td></tr><tr><th>입원 식대</th><td>${R.meal}끼 × 4,030원 = ${won(R.meals)}</td></tr>${R.f>0?R.lines.map(l=>`<tr><th>과실상계</th><td>${esc(l)}</td></tr>`).join(""):""}</table>
  <p class="note">합의 전 보험사에 보험금 산출내역서를 요청해 항목별로 확인하세요. 근거: 자동차보험 약관 &lt;별표1&gt; 대인배상 지급기준, &lt;별표3&gt; 과실상계, 자동차손해배상 보장법 시행령 별표1. 참고 계산이며 보험금은 보험사가 정합니다.</p>`); }
function printH(){ const R=calcH();
  printHtml("자동차보험 사고 환입 비교",`<table><tr><th>고객 · 보험사</th><td>${esc(H.name||"-")} · ${esc(H.ins||"-")}</td></tr></table>
  <table><thead><tr><th>사고일</th><th>담보</th><th>환입 비용</th></tr></thead><tbody>${H.acc.filter(a=>a.on).map(a=>`<tr><td>${esc(a.date)}</td><td>${esc(a.kind)}</td><td>${won(num(a.amt))}</td></tr>`).join("")}</tbody></table>
  <table><thead><tr><th>연도</th><th>사고 반영</th><th>환입 후</th><th>차이</th></tr></thead><tbody>${R.rows.map(r=>`<tr><td>${esc(r.y||"")}</td><td>${won(r.a)}</td><td>${won(r.b)}</td><td>${won(r.d)}</td></tr>`).join("")}</tbody></table>
  <div class="res"><div style="--c:#D9480F"><span>환입 비용</span><b>${won(R.cost)}</b></div><div style="--c:#2563EB"><span>첫 해 손익</span><b>${won(R.firstNet)}</b></div><div style="--c:#0E7A5F"><span>${R.rows.length}년 누적 손익</span><b>${won(R.net)}</b></div></div>
  <p class="note">보험료는 보험사 전산 재산출 값입니다. 환입 가능 여부·기한은 보험사에 확인하세요.</p>`); }

/* ===== 이벤트 ===== */
const SM={"ac-hosp":"hosp","ac-visit":"visit","ac-meal":"meal","ac-daily":"daily","ac-hudays":"huDays","ac-fault":"fault","ac-tx":"tx"};
function keepFocus(fn,el){ const id=el.id, ds=el.dataset.acc||el.dataset.yr, sel=el.dataset.acc?"data-acc":"data-yr", pos=el.selectionStart, len=el.value.length; fn();
  const n=id?document.getElementById(id):document.querySelector(`[${sel}="${ds}"]`); if(n){ n.focus(); try{ const p=Math.max(0,pos+(n.value.length-len)); n.setSelectionRange(p,p); }catch(_){} } }
document.addEventListener("input",e=>{ const t=e.target;
  if(SM[t.id]){ S[SM[t.id]]=t.value.replace(/[^\d.]/g,""); keepFocus(drawS,t); return; }
  if(t.id==="ac-h-name"){ H.name=t.value; return; } if(t.id==="ac-h-ins"){ H.ins=t.value; return; }
  if(t.dataset.acc&&t.type!=="checkbox"&&t.tagName==="INPUT"){ const [i,k]=t.dataset.acc.split(":"); H.acc[+i][k]=k==="amt"?t.value.replace(/[^\d]/g,""):t.value; if(k==="amt") keepFocus(drawH,t); return; }
  if(t.dataset.yr){ const [i,k]=t.dataset.yr.split(":"); H.yrs[+i][k]=t.value.replace(/[^\d]/g,""); keepFocus(drawH,t); } });
document.addEventListener("change",e=>{ const t=e.target;
  if(t.id==="ac-grade"){ S.grade=+t.value; drawS(); } else if(t.id==="ac-hutype"){ S.huType=t.value; drawS(); } else if(t.id==="ac-driver"){ S.driver=t.value==="1"; drawS(); } else if(t.id==="ac-post"){ S.post=t.value==="1"; drawS(); }
  else if(t.dataset.acc){ const [i,k]=t.dataset.acc.split(":"); H.acc[+i][k]=t.type==="checkbox"?t.checked:t.value; drawH(); } });
document.addEventListener("click",e=>{ if(e.target.closest("#ac-s-print")) return printS(); if(e.target.closest("#ac-h-print")) return printH();
  const b=e.target.closest("[data-ach]"); if(!b) return; const [a,i]=b.dataset.ach.split(":");
  if(a==="addacc") H.acc.push({date:"",kind:"대물",amt:"",on:true}); else if(a==="delacc") H.acc.splice(+i,1);
  else if(a==="addyr"&&H.yrs.length<5){ const last=H.yrs[H.yrs.length-1]; H.yrs.push({y:last&&last.y?String(+last.y+1):"",a:"",b:""}); } else if(a==="delyr") H.yrs.splice(+i,1);
  drawH(); });
function init(){ drawS(); drawH(); }
window.AUTOCALC={calcS,calcH,S,H,init};
if(document.readyState!=="loading") init(); else document.addEventListener("DOMContentLoaded",init);
})();
