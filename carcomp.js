/* 보잇 · 자동차 › 자손·자상 보상비교 (2026-10-28)
   근거(원문 확인):
   - 삼성화재 개인용 애니카자동차보험 약관 2025.11.16 개정: <별표5> 자기신체사고 지급기준(가. 상해구분 및 급별 보험가입금액표), 제16조(지급보험금의 계산),
     [25] 자동차상해 특별약관, <별표1> 부상 위자료·휴업손해(85%)·통원 1일 8,000원, <별표3> 과실상계(2023.1.1 이후 12~14급 차량운전자 치료관계비)
   - 현대해상 Hicar 개인용자동차보험 약관 2025.06.26 개정: <별표3> 자기신체사고 보험금 지급기준 1) 상해구분 및 급별 보험가입금액표, <별표4> 과실상계
   - KB개인용자동차보험 약관 2026.10.25 개정(승인 2026.9.18): <별표5> 1) 상해구분 및 급별 보험가입금액표, 제16조, Ⅳ-8 부상가입금액 확장 특별약관 <별표>(1~6급만 기재)
   - 자동차손해배상 보장법 시행령 별표1(2021.1.5 개정, 2026.9.15 시행 시행령 기준): 상해 급별 책임보험금(대인배상Ⅰ) 한도
   상담·교육용 참고 계산. 보험금은 보험사가 사고 사실·약관에 따라 결정함. */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const won=n=>Math.round(n).toLocaleString()+"원";
const man=n=>{ n=Math.round(n); if(n>=1e4&&n%1e4===0) return (n/1e4).toLocaleString()+"만원"; if(n>=1e4) return (Math.round(n/1e3)/10).toLocaleString()+"만원"; return n.toLocaleString()+"원"; };
const G=[1,2,3,4,5,6,7,8,9,10,11,12,13,14];

/* 공통 기준 (단위: 만원) */
const WIJA=[200,176,152,128,75,50,40,30,25,20,20,15,15,15];          // 부상 위자료 (별표1)
const DAEIN1=[3000,1500,1200,1000,900,700,500,300,240,200,160,120,80,50]; // 대인배상Ⅰ 부상 한도 (시행령 별표1)
const TONGWON=8000, HUEOP=0.85;

/* 회사별 자기신체사고 부상 급별 한도 (만원) */
const K1500=[1500,800,750,700,500,400,250,180,140,120,120,120,80,50];
const INS={
  samsung:{name:"삼성화재",prod:"개인용 애니카자동차보험",doc:"약관 2025.11.16 개정 · <별표5> 자기신체사고 지급기준",url:"https://www.samsungfire.com/publication/pdf/20071_0_20251116_file1.pdf",
    amts:[1500,3000],
    tbl:(amt,post)=>amt===1500?(post?K1500:[1500,800,750,700,500,400,250,180,140,120,100,60,40,20])
                               :(post?[3000,1600,1500,1400,1000,800,500,200,200,180,180,180,130,80]:[3000,1600,1500,1400,1000,800,500,200,200,140,140,80,80,80]),
    split:true},
  hyundai:{name:"현대해상",prod:"Hicar 개인용자동차보험",doc:"약관 2025.06.26 개정 · <별표3> 자기신체사고 보험금 지급기준",url:"https://direct.hi.co.kr/dhNAS/terms/CM5117_20250626.pdf",
    amts:[1500,3000,5000],
    tbl:amt=>({1500:K1500,3000:[3000,1600,1500,1400,1000,800,500,360,280,240,200,180,130,80],5000:[5000,2700,2500,2300,1650,1300,800,600,450,400,300,290,210,130]})[amt]},
  kb:{name:"KB손해보험",prod:"KB개인용자동차보험",doc:"약관 2026.10.25 개정 · <별표5> + Ⅳ-8 부상가입금액 확장 특별약관",url:"https://www.kbinsure.co.kr/CG802030003.ec?fileNm=1_261025_private_m.pdf",
    amts:[1500,3000,5000,10000],
    tbl:amt=>{ const ext={3000:[3000,1600,1500,1400,1000,800],5000:[5000,2700,2500,2300,1650,1300],10000:[10000,5400,5000,4600,3300,2600]}[amt]; return ext?ext.concat(K1500.slice(6)):K1500; },
    note:"KB 부상가입금액 확장 특별약관 <별표>에는 1~6급만 적혀 있어, 7~14급은 보통약관 1,500만원형 한도로 표시했습니다. 7급 이하 한도는 KB에 확인하세요."},
  db:{name:"DB손해보험",prod:"프로미카 개인용자동차보험",doc:"약관 원문 확인 중 (공시 PDF 글자를 읽을 수 없어 대조 전)",url:"https://www.idbins.com/",amts:[],tbl:()=>null,pending:true}
};
const ORDER=["samsung","hyundai","kb","db"];
const C={ins:"samsung",date:new Date().toISOString().slice(0,10),amt:3000,grade:12,tab:"base",
  jsAmt:3000, tx:"", hosp:"", visit:"", daily:"", huDays:"", etc:"", kind:"solo", fault:"", driver:true, dedMode:"auto", ded:""};
const num=v=>{ const n=+String(v==null?"":v).replace(/[^\d.]/g,""); return isFinite(n)?n:0; };
const post=()=>C.date>="2023-01-01";
function limitsOf(key,amt){ const I=INS[key]; if(!I||I.pending) return null; return I.tbl(amt,post()); }
function curLimit(){ const t=limitsOf(C.ins,C.amt); return t?t[C.grade-1]*1e4:null; }

function calc(){
  const g=C.grade, tx=num(C.tx)*1e4, visit=num(C.visit), hosp=num(C.hosp), daily=num(C.daily), huDays=C.huDays===""?hosp:num(C.huDays), etc=num(C.etc)*1e4;
  const wija=WIJA[g-1]*1e4, hueop=daily*huDays*HUEOP, tong=visit*TONGWON;
  const actual=tx+wija+hueop+tong+etc;   // 실제손해액 (과실상계·한도 적용 전)
  const lim=curLimit(), jsLim=num(C.jsAmt)*1e4;
  let D=0, dline=[];
  if(C.kind==="both"){
    if(C.dedMode==="manual"){ D=num(C.ded)*1e4; dline.push(`보험사가 알려준 상대 대인배상 공제액 ${won(D)}`); }
    else{
      const f=Math.min(100,num(C.fault))/100, other=1-f, d1=DAEIN1[g-1]*1e4;
      const after=actual*other;
      let guar=tx;
      if(post()&&g>=12&&C.driver) guar=Math.min(tx,d1)+Math.max(0,tx-d1)*other;
      D=other<=0?0:Math.max(after,guar);
      dline.push(`손해액 합계 ${won(actual)} × 상대 과실 ${Math.round(other*100)}% = ${won(after)}`);
      if(other>0) dline.push(post()&&g>=12&&C.driver?`치료비 보장분: 대인Ⅰ 한도 ${man(d1)}까지 전액 + 초과분 ${won(Math.max(0,tx-d1))} × 상대 과실 → ${won(guar)}`:`치료비 보장분: 과실상계 후 금액이 치료비보다 적으면 치료비 ${won(tx)} 지급`);
      dline.push(`→ 상대 대인배상 참고액 ${won(D)} (둘 중 큰 금액)`);
    }
  }
  const rest=Math.max(0,actual-D);
  let js=null, jsLine="";
  if(lim!=null){ if(C.kind==="solo"){ js=Math.min(tx,lim); jsLine=`공제액이 없으면 실제 치료비 ${won(tx)}를 ${g}급 한도 ${man(lim)} 안에서 지급`; }
    else { js=Math.min(rest,lim); jsLine=`실제손해액 ${won(actual)} − 공제액 ${won(D)} = ${won(rest)}, ${g}급 한도 ${man(lim)} 안에서 지급`; } }
  const zs=Math.min(C.kind==="solo"?actual:rest,jsLim);
  const zsLine=C.kind==="solo"?`치료비 + 위자료 + 휴업손해 + 통원비 + 기타 = ${won(actual)}, 부상 가입금액 ${man(jsLim)} 안에서 지급`:`실제손해액 ${won(actual)} − 공제액 ${won(D)} = ${won(rest)}, 부상 가입금액 ${man(jsLim)} 안에서 지급`;
  return {tx,wija,hueop,tong,etc,actual,lim,D,dline,rest,js,jsLine,zs,zsLine,hosp,huDays,daily,visit};
}

const TABS=[["base","기본정보","c2"],["limit","부상한도표","c3"],["comp","보상비교","c1"],["rule","약관·산정기준","c4"]];
function shell(){
  const r=$("#cc-root"); if(!r) return;
  r.innerHTML=`<div class="cc-hero"><div><b>자손·자상 보상비교</b><span>자기신체사고(자손)와 자동차상해(자상), 같은 사고에 얼마나 다른지 보험사 약관 기준으로 계산합니다.</span></div><button class="btn" type="button" id="cc-print">고객용 출력·PDF</button></div>
  <div class="cc-tabs">${TABS.map(([k,l,c])=>`<button type="button" class="cc-tab" data-cc="${k}" style="--c:var(--${c})" aria-pressed="${C.tab===k}">${l}</button>`).join("")}</div>
  <div id="cc-body"></div>`;
  draw();
}
function insOpts(){ return ORDER.map(k=>`<option value="${k}" ${C.ins===k?"selected":""}>${INS[k].name}${INS[k].pending?" (약관 확인 중)":""}</option>`).join(""); }
function amtOpts(){ const I=INS[C.ins]; if(!I.amts.includes(C.amt)) C.amt=I.amts[I.amts.length>1?1:0]||1500; return I.amts.map(a=>`<option value="${a}" ${C.amt===a?"selected":""}>${man(a*1e4)}형</option>`).join(""); }
function gradeOpts(){ return G.map(g=>`<option value="${g}" ${C.grade===g?"selected":""}>${g}급</option>`).join(""); }

function draw(){
  document.querySelectorAll(".cc-tab").forEach(b=>b.setAttribute("aria-pressed",b.dataset.cc===C.tab));
  const B=$("#cc-body"); if(!B) return; const I=INS[C.ins];
  if(C.tab==="base"){
    const lim=curLimit();
    B.innerHTML=`<div class="panel cc-grid4">
      <div class="field"><label for="cc-ins">① 보험사</label><select id="cc-ins">${insOpts()}</select></div>
      <div class="field"><label for="cc-date">② 사고일</label><input id="cc-date" type="date" value="${C.date}"></div>
      <div class="field"><label for="cc-amt">③ 자손 부상 가입금액</label><select id="cc-amt" ${I.pending?"disabled":""}>${amtOpts()}</select></div>
      <div class="field"><label for="cc-grade">④ 부상급수</label><select id="cc-grade">${gradeOpts()}</select></div>
    </div>
    <div class="cc-cards">
      <div class="cc-card dark"><span>현재 선택</span><b>${esc(I.name)} · ${C.grade}급</b><small>${I.pending?"약관 대조 전입니다":`자손 ${man(C.amt*1e4)}형 · ${post()?"2023.1.1 이후 사고":"2022.12.31 이전 사고"} 기준`}</small></div>
      <div class="cc-card" style="--c:var(--c2)"><span>자기신체사고 · 자손</span><b>${lim==null?"확인 중":man(lim)}</b><small>${C.grade}급 부상 한도 · 실제 치료비를 이 안에서 지급</small><button class="btn" type="button" data-cc="limit">전체 한도표</button></div>
      <div class="cc-card" style="--c:var(--c1)"><span>자동차상해 · 자상</span><b>별도 계산</b><small>치료비 + 위자료 + 휴업손해 + 통원비를 부상 가입금액 안에서 지급</small><button class="btn primary" type="button" data-cc="comp">자손 vs 자상 계산</button></div>
    </div>
    ${I.note?`<p class="note cc-warn">${esc(I.note)}</p>`:""}
    <div class="cc-g">${G.map(g=>`<div><b>${g}급</b><span>위자료 ${WIJA[g-1]}만 · 대인Ⅰ 한도 ${DAEIN1[g-1].toLocaleString()}만</span></div>`).join("")}</div>
    <p class="note">급수는 「자동차손해배상 보장법 시행령」 별표1 상해구분을 따릅니다 (예: 12급 척추 염좌·팔다리 단순 염좌, 14급 팔다리 단순 타박). 최종 급수는 보험사가 진단서로 정합니다.</p>`;
  }
  else if(C.tab==="limit"){
    if(I.pending){ B.innerHTML=`<div class="panel"><h2>${esc(I.name)} 부상급수별 한도표</h2><p class="note">${esc(I.doc)}. 대조가 끝나면 표가 표시됩니다.</p></div>`; return; }
    const cols=I.amts.map(a=>({a,t:I.tbl(a,post())}));
    B.innerHTML=`<div class="panel"><div class="row between"><h2>${esc(I.name)} 자손 부상급수별 한도표</h2><span class="note">${esc(I.doc)}${I.split?` · ${post()?"2023.1.1 이후":"2022.12.31 이전"} 사고`:""}</span></div>
      <div class="tbl-wrap" style="margin-top:10px"><table class="cc-tbl"><thead><tr><th>부상급수</th>${cols.map(c=>`<th>${man(c.a*1e4)}형</th>`).join("")}<th>위자료(공통)</th></tr></thead>
      <tbody>${G.map(g=>`<tr class="${g===C.grade?"on":""}"><td>${g}급</td>${cols.map(c=>`<td class="num ${c.a===C.amt&&g===C.grade?"hit":""}">${c.t[g-1].toLocaleString()}만원</td>`).join("")}<td class="num">${WIJA[g-1]}만원</td></tr>`).join("")}</tbody></table></div>
      ${I.note?`<p class="note cc-warn">${esc(I.note)}</p>`:""}</div>`;
  }
  else if(C.tab==="comp"){
    const R=calc(), lim=R.lim;
    const fi=(id,lbl,val,ph,auto,help)=>`<div class="cc-f ${auto?"auto":"in"}"><label for="${id}">${lbl}<em>${auto?"자동 계산":"직접 입력"}</em></label>${auto?`<b>${val}</b>`:`<input id="${id}" inputmode="decimal" value="${esc(val)}" placeholder="${esc(ph)}">`}${help?`<small>${help}</small>`:""}</div>`;
    B.innerHTML=`<div class="panel"><div class="row between"><h2>보상비교 입력</h2><span class="note">${esc(I.name)} · ${C.grade}급 · 자손 ${I.pending?"(약관 확인 중)":man(C.amt*1e4)+"형"} · <button class="lnk" type="button" data-cc="base">조건 바꾸기</button></span></div>
      <div class="cc-legend"><span class="in">직접 입력</span><span class="auto">자동 계산</span></div>
      <div class="cc-form">
        <div class="cc-f in"><label for="cc-kind">사고유형<em>직접 입력</em></label><select id="cc-kind"><option value="solo" ${C.kind==="solo"?"selected":""}>단독·일방과실 · 공제액 없음</option><option value="both" ${C.kind==="both"?"selected":""}>쌍방사고 · 상대 대인배상 있음</option></select></div>
        ${fi("cc-tx","치료관계비 (만원)",C.tx,"병원 치료비 총액",0,"보험사가 지급했거나 지급할 치료비")}
        <div class="cc-f auto"><label>부상 위자료<em>자동 계산</em></label><b>${man(R.wija)}</b><small>${C.grade}급 인정액</small></div>
        ${fi("cc-hosp","입원일수",C.hosp,"일",0,"")}
        ${fi("cc-daily","1일 수입감소액 (원)",C.daily,"증빙되는 1일 감소액",0,"세법상 서류 등으로 증명될 때만 인정 · 가사종사자는 일용근로자 임금")}
        ${fi("cc-hudays","휴업일수",C.huDays,"비우면 입원일수",0,"치료기간 범위에서 보험사가 인정")}
        <div class="cc-f auto"><label>휴업손해<em>자동 계산</em></label><b>${won(R.hueop)}</b><small>1일 감소액 × ${R.huDays}일 × 85%</small></div>
        ${fi("cc-visit","통원일수",C.visit,"일",0,"")}
        <div class="cc-f auto"><label>통원비<em>자동 계산</em></label><b>${won(R.tong)}</b><small>통원일수 × 8,000원</small></div>
        ${fi("cc-etc","기타 인정손해 (만원)",C.etc,"증빙 가능한 금액",0,"")}
        ${fi("cc-js","자상 부상 가입금액 (만원)",C.jsAmt,"예: 3000",0,"증권의 자동차상해 부상 가입금액")}
        ${C.kind==="both"?`
        ${fi("cc-fault","본인 과실 (%)",C.fault,"예: 50",0,"과실비율정보포털 기준 참고")}
        <div class="cc-f in"><label for="cc-driver">본인이 차량 운전자<em>직접 입력</em></label><select id="cc-driver"><option value="1" ${C.driver?"selected":""}>예 (운전자)</option><option value="0" ${!C.driver?"selected":""}>아니오 (동승자·보행자 등)</option></select><small>12~14급 치료비 과실책임 적용 여부</small></div>
        <div class="cc-f in"><label for="cc-dedmode">공제액 산정<em>직접 입력</em></label><select id="cc-dedmode"><option value="auto" ${C.dedMode==="auto"?"selected":""}>입력 항목으로 참고 계산</option><option value="manual" ${C.dedMode==="manual"?"selected":""}>보험사 확정액 직접 입력</option></select></div>
        ${C.dedMode==="manual"?fi("cc-ded","상대 대인배상 공제액 (만원)",C.ded,"보험사 안내 금액",0,""):""}`:""}
      </div>
      ${C.kind==="both"?`<div class="cc-box"><b>상대 대인배상(공제액) ${C.dedMode==="manual"?"":"참고"} 산출</b>${R.dline.map(x=>`<div>${esc(x)}</div>`).join("")}</div>`:""}
    </div>
    <div class="cc-res">
      <div class="cc-rc" style="--c:var(--c2)"><span>자손 예상 보험금</span><b>${R.js==null?"약관 확인 중":man(R.js)}</b><small>${esc(R.jsLine)}</small></div>
      <div class="cc-rc" style="--c:var(--c1)"><span>자상 예상 보험금</span><b>${man(R.zs)}</b><small>${esc(R.zsLine)}</small></div>
      <div class="cc-rc" style="--c:var(--c4)"><span>자상 − 자손 차이</span><b>${R.js==null?"–":man(R.zs-R.js)}</b><small>같은 사고에서 담보에 따라 달라지는 금액</small></div>
    </div>
    <div class="panel"><h2>손해액 산출 내역</h2><div class="cc-lines">
      <div><span>치료관계비</span><b>${won(R.tx)}</b></div><div><span>부상 위자료 (${C.grade}급)</span><b>${won(R.wija)}</b></div>
      <div><span>휴업손해 (${won(R.daily)} × ${R.huDays}일 × 85%)</span><b>${won(R.hueop)}</b></div><div><span>통원비 (${R.visit}일 × 8,000원)</span><b>${won(R.tong)}</b></div>
      <div><span>기타 인정손해</span><b>${won(R.etc)}</b></div><div class="sum"><span>실제손해액 (과실상계·한도 적용 전)</span><b>${won(R.actual)}</b></div></div>
      <p class="note">상담·교육용 참고 계산입니다. 급수·휴업일수·과실·공제액은 보험사가 사고 사실과 약관에 따라 정하며, 보험금 지급을 확정하지 않습니다.</p></div>`;
  }
  else if(C.tab==="rule"){
    B.innerHTML=`<div class="panel"><h2>약관·산정기준</h2>
      <div class="cc-rule"><b>자기신체사고 (자손)</b>
        <p>· 부상: 보험증권의 부상 가입금액에 해당하는 <b>상해 급별 한도</b> 안에서 지급 (각 사 약관 별표 「상해구분 및 급별 보험가입금액표」)</p>
        <p>· 공제액이 없으면(단독사고 등) <b>실제 지출한 치료비</b>를 급별 한도 안에서 지급, 공제액이 있으면 <b>실제손해액 + 비용 − 공제액</b>을 급별 한도 안에서 지급 (제16조)</p>
        <p>· 공제액 = 상대 자동차보험 대인배상Ⅰ·Ⅱ로 보상받을 수 있는 금액, 무보험차상해로 지급될 수 있는 금액, 배상의무자 외 제3자에게 받은 금액</p></div>
      <div class="cc-rule"><b>자동차상해 (자상, 자기신체사고 대체 특약)</b>
        <p>· 보험증권의 부상 가입금액을 한도로 <b>실제손해액 + 비용 − 공제액</b> 지급. 실제손해액은 대인배상 지급기준(별표1~4)으로 산출, 과실상계·보상한도 적용 전 금액</p>
        <p>· 자기신체사고와 동시에 가입할 수 없음 (자상이 자손을 대체)</p></div>
      <div class="cc-rule"><b>대인배상 지급기준 (별표1, 2023.1.1 이후 사고)</b>
        <p>· 부상 위자료: ${G.map(g=>`${g}급 ${WIJA[g-1]}만`).join(" / ")}</p>
        <p>· 휴업손해: 수입 감소가 관계 서류로 증명되는 경우에 한해 1일 수입감소액 × 휴업일수 × 85%. 취업가능연한(65세, 농·어업인 70세)을 넘으면 원칙적으로 산정하지 않음</p>
        <p>· 그 밖의 손해배상금: 통원 1일 8,000원, 입원 중 병원 식사를 제공받지 않은 경우 한 끼 4,030원</p>
        <p>· 과실상계(별표3): 차량운전자가 12~14급이고 치료관계비가 대인배상Ⅰ 한도를 넘으면, 초과분은 피해자 과실비율만큼 본인 부담 (보험사가 먼저 지급 후 청구)</p>
        <p>· 대인배상Ⅰ 부상 한도 (시행령 별표1): ${G.map(g=>`${g}급 ${DAEIN1[g-1].toLocaleString()}만`).join(" / ")}</p></div>
      <div class="cc-cards" style="margin-top:12px">${ORDER.map(k=>`<div class="cc-card" style="--c:var(--${k==="samsung"?"c2":k==="hyundai"?"c1":k==="kb"?"c4":"c3"})"><span>${esc(INS[k].name)}</span><b style="font-size:16px">${esc(INS[k].prod)}</b><small>${esc(INS[k].doc)}</small>${INS[k].pending?"":`<a class="btn" href="${INS[k].url}" target="_blank" rel="noopener">약관 원문 열기</a>`}</div>`).join("")}</div>
      <p class="note" style="margin-top:12px">사고일·계약 시점에 실제 적용되는 약관이 우선합니다. 본 계산은 상담·교육용이며 보험금 지급을 확정하지 않습니다.</p></div>`;
  }
}

function printOut(){
  const R=calc(), I=INS[C.ins], name=(window.ME&&ME.name)||"담당 설계사", ph=(window.ME&&ME.phone)||"";
  const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>자손·자상 보상비교</title><style>
  @page{size:A4;margin:12mm}body{font-family:"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#17211E;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  h1{font-size:22px;margin:0 0 4px}.sub{color:#5E6B66;font-size:12px;margin:0 0 14px}
  .hd{background:linear-gradient(120deg,#123D35,#2563EB);color:#fff;border-radius:10px;padding:16px 18px;margin-bottom:14px}.hd h1{color:#fff}.hd .sub{color:#dbe7ff;margin:0}
  table{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0}th,td{border:1px solid #DDE3DF;padding:7px 9px;text-align:left}th{background:#F3F5F2;width:42%}
  .res{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:12px 0}.res div{border:1px solid #DDE3DF;border-top:4px solid var(--c);border-radius:8px;padding:10px}.res span{font-size:12px;color:#5E6B66}.res b{display:block;font-size:22px;color:var(--c);margin:2px 0}.res small{font-size:10.5px;color:#5E6B66}
  .note{font-size:10.5px;color:#5E6B66;margin:10px 0 0}.ft{margin-top:16px;border-top:1px solid #DDE3DF;padding-top:8px;font-size:12px}</style></head><body>
  <div class="hd"><h1>자동차사고 보상비교 안내</h1><p class="sub">자기신체사고(자손)와 자동차상해(자상) 예상 보험금 비교 · ${esc(new Date().toLocaleDateString("ko-KR"))}</p></div>
  <table><tr><th>보험사</th><td>${esc(I.name)} ${esc(I.prod)}</td></tr><tr><th>사고일 · 부상급수</th><td>${esc(C.date)} · ${C.grade}급</td></tr>
  <tr><th>자손 부상 가입금액 · ${C.grade}급 한도</th><td>${I.pending?"약관 확인 중":man(C.amt*1e4)+"형 · "+man(R.lim)}</td></tr><tr><th>자상 부상 가입금액</th><td>${man(num(C.jsAmt)*1e4)}</td></tr>
  <tr><th>사고유형</th><td>${C.kind==="solo"?"단독·일방과실 (공제액 없음)":`쌍방사고 · 본인 과실 ${num(C.fault)}% · 상대 대인배상 ${C.dedMode==="manual"?"":"참고"} ${won(R.D)}`}</td></tr></table>
  <div class="res"><div style="--c:#2563EB"><span>자손 예상 보험금</span><b>${R.js==null?"확인 중":man(R.js)}</b><small>${esc(R.jsLine)}</small></div><div style="--c:#0E7A5F"><span>자상 예상 보험금</span><b>${man(R.zs)}</b><small>${esc(R.zsLine)}</small></div><div style="--c:#D9480F"><span>차이</span><b>${R.js==null?"–":man(R.zs-R.js)}</b><small>같은 사고, 담보에 따른 차이</small></div></div>
  <table><tr><th>치료관계비</th><td>${won(R.tx)}</td></tr><tr><th>부상 위자료 (${C.grade}급)</th><td>${won(R.wija)}</td></tr><tr><th>휴업손해 (×85%)</th><td>${won(R.hueop)}</td></tr><tr><th>통원비 (1일 8,000원)</th><td>${won(R.tong)}</td></tr><tr><th>기타 인정손해</th><td>${won(R.etc)}</td></tr><tr><th><b>실제손해액</b></th><td><b>${won(R.actual)}</b></td></tr></table>
  <p class="note">근거: ${esc(I.name)} ${esc(I.doc)}, 대인배상 지급기준(별표1·별표3), 자동차손해배상 보장법 시행령 별표1. 상담·교육용 참고 계산이며 보험금은 보험사가 사고 사실과 약관에 따라 결정합니다.</p>
  <div class="ft">담당 ${esc(name)} ${esc(ph)}</div></body></html>`;
  const f=document.createElement("iframe"); f.style.cssText="position:fixed;right:0;bottom:0;width:0;height:0;border:0"; document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
  setTimeout(()=>{ try{ f.contentWindow.focus(); f.contentWindow.print(); }catch(e){} setTimeout(()=>f.remove(),2000); },300);
}

const MAP={"cc-tx":"tx","cc-hosp":"hosp","cc-daily":"daily","cc-hudays":"huDays","cc-visit":"visit","cc-etc":"etc","cc-js":"jsAmt","cc-fault":"fault","cc-ded":"ded"};
document.addEventListener("click",e=>{ const t=e.target.closest("[data-cc]"); if(t&&t.closest("#cc-root")){ C.tab=t.dataset.cc; draw(); return; } if(e.target.closest("#cc-print")) printOut(); });
document.addEventListener("change",e=>{ const id=e.target.id; if(!id||!id.startsWith("cc-")) return; const v=e.target.value;
  if(id==="cc-ins") C.ins=v; else if(id==="cc-date") C.date=v||C.date; else if(id==="cc-amt") C.amt=+v; else if(id==="cc-grade") C.grade=+v;
  else if(id==="cc-kind") C.kind=v; else if(id==="cc-driver") C.driver=v==="1"; else if(id==="cc-dedmode") C.dedMode=v; else if(MAP[id]){ C[MAP[id]]=v; }
  draw(); });
document.addEventListener("input",e=>{ const id=e.target.id; if(!MAP[id]) return; C[MAP[id]]=e.target.value; const pos=e.target.selectionStart; draw(); const n=document.getElementById(id); if(n){ n.focus(); try{ n.setSelectionRange(pos,pos); }catch(_){} } });
window.CARCOMP={init:shell,calc,C,INS};
if(document.readyState!=="loading") shell(); else document.addEventListener("DOMContentLoaded",shell);
})();
