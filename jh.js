/* 보잇 · 일반보험 › 중대재해·위험성평가 (2026-11-25)
   근거(이 파일의 문장은 아래 자료에 있는 내용만 씀)
   - 중대재해 처벌 등에 관한 법률 제2조·제3조·제4조·제6조·제7조 / 시행령 제4조 (국가법령정보센터 법령 PDF, 법률 해설 자료로 대조)
   - 산업안전보건법 제36조(위험성평가). 2026.2.19. 공포 개정법: 미실시 1천만원 이하, 근로자대표 참여·주지 위반 500만원 이하 과태료 (법률신문 2026.2.23 해설)
   - 고용노동부 보도자료 2026.11.4 「사업장 위험성평가에 관한 지침」 전부개정고시: 과태료 적용 50인 이상(건설 50억 이상) 2027.1.1, 50인 미만 2028.1.1,
     근로자대표 참여 요구 시 협의·참여, 일정 사전 고지, 신규·작업변경 근로자 결과 공유, 작업 시작 전 개선, 도급·수급 공동평가
   - 고용노동부 「새로운 위험성평가 안내서」(2023.5): 단계, 근로자 참여, 3단계(상·중·하) 판단, 공유·기록 3년
   - 대표 제공 엑셀: 근재 가입률 13.2%, 기업중대사고 배상 3.2% (보험연구원 2024 중소 제조기업 조사) · 보험은 법적 의무·형사책임을 대신하지 않음
   개정 고시 원문 세부 조항(부칙·과태료표)은 확인 중 → 화면에 표시 */
(function(){
"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const td=()=>new Date(Date.now()+9*3600e3).toISOString().slice(0,10);

const STEPS=[
 ["준비","평가 일정을 정하고 근로자에게 미리 알립니다.","실시 담당자·방법(체크리스트, 3단계 판단 등)을 정합니다."],
 ["위험 찾기","작업별로 다칠 수 있는 요인을 근로자와 함께 찾습니다.","순회점검, 아차사고(다칠 뻔한 일) 사례를 활용합니다. 추락·끼임·부딪힘은 낮게 평가하지 않도록 주의합니다."],
 ["위험 정하기","찾은 위험이 받아들일 수 있는 수준인지 정합니다.","빈도·강도를 계산하지 않아도 상·중·하 3단계 판단 같은 쉬운 방법을 쓸 수 있습니다."],
 ["개선하기","받아들일 수 없는 위험부터 줄일 대책을 세우고 실행합니다.","평가로 찾은 위험은 근로자가 그 작업을 시작하기 전에 개선해야 합니다."],
 ["알리고 남기기","결과를 게시하고 작업 전 회의(TBM) 등으로 공유합니다.","새로 온 근로자·작업이 바뀐 근로자에게는 작업 전에 결과를 알립니다. 실시 결과는 기록해 3년간 보존합니다."]];
const SAPA=[
 ["안전보건 목표·경영방침을 정하고 알림","1호",""],
 ["안전보건 전담조직 두기","2호","상시근로자 500명 이상 등 일정 규모만 해당 — 소규모는 대부분 해당 없음"],
 ["유해·위험요인 확인·개선 절차 마련, 반기 1회 이상 점검","3호","위험성평가를 하고 그 절차에 따라 개선하면 이 의무를 한 것으로 봅니다(3호 단서)"],
 ["안전보건 인력·시설·장비, 위험요인 개선 예산 편성·집행","4호",""],
 ["안전보건관리책임자 등에게 권한·예산 주고 반기 1회 평가","5호",""],
 ["안전관리자·보건관리자 등 배치","6호","산업안전보건법상 배치 대상일 때"],
 ["종사자 의견 듣는 절차 마련, 반기 1회 점검","7호",""],
 ["중대재해·급박한 위험 대응 매뉴얼(작업중지·대피·보고·구호), 반기 1회 점검","8호",""],
 ["도급·용역·위탁 시 수급인 안전능력 평가기준·관리비용·기간 기준, 반기 1회 점검","9호","일을 맡기는 곳이 있을 때"]];
const J={n:"",biz:"",staff:"",build:false,amt:"",st:{},sp:{},rows:[{w:"",h:"",c:"",lv:"",fix:"",who:"",due:""},{w:"",h:"",c:"",lv:"",fix:"",who:"",due:""},{w:"",h:"",c:"",lv:"",fix:"",who:"",due:""}]};

function judge(){
  const n=+String(J.staff).replace(/\D/g,"")||0, big=n>=50||(J.build&&(+J.amt||0)>=50), out=[];
  if(!J.staff) return null;
  out.push(n<5?["n","중대재해처벌법","상시근로자 5명 미만은 적용되지 않습니다(법 제3조)."]:["y","중대재해처벌법",`상시근로자 ${n}명 — 적용 대상입니다. 5~49명 사업장도 2024.1.27.부터 적용되고 있습니다.`]);
  out.push(n>=1?["y","위험성평가 (산업안전보건법 제36조)",`근로자를 쓰는 사업주의 의무입니다${n<5?"(5명 미만도 똑같이 적용 — 인원 하한이 없습니다)":""}. 과태료는 ${big?"2027.1.1.":"2028.1.1."}부터 적용됩니다(${big?"50명 이상·건설 50억원 이상":"50명 미만·건설 50억원 미만"}, 고용노동부 2026.11.4.).`]:["q","위험성평가","근로자가 없으면 해당 여부를 확인하세요."]);
  return {n,big,out};
}
const css=`#jh-root{display:flex;flex-direction:column;gap:14px}#jh-root h2{display:flex;align-items:center;gap:8px;font-size:16px;margin:0}#jh-root h2 i{font-style:normal;width:24px;height:24px;border-radius:50%;background:#1F3A68;color:#fff;font-size:13px;display:inline-flex;align-items:center;justify-content:center}
.jh-res{display:flex;flex-direction:column;gap:6px}.jh-res div{display:flex;gap:8px;align-items:flex-start;font-size:13.5px}.jh-res .pill{flex:none}
.jh-st{display:flex;flex-direction:column;gap:8px}.jh-st label{display:grid;grid-template-columns:22px 1fr;gap:8px;border:1px solid var(--line);border-radius:10px;padding:9px 11px;cursor:pointer;background:var(--card,#fff)}.jh-st label:has(input:checked){background:#EEF2FA;border-color:#9DB0D8}
.jh-st b{font-size:14px}.jh-st p{margin:2px 0 0;font-size:12.5px;color:var(--muted);line-height:1.55}.jh-st input{margin-top:3px}
.jh-tbl{overflow:auto}.jh-tbl table{width:100%;border-collapse:collapse;min-width:760px}.jh-tbl th{font-size:12px;color:var(--muted);text-align:left;padding:4px}.jh-tbl td{padding:3px}.jh-tbl input,.jh-tbl select{width:100%;padding:6px;font-size:13px;box-sizing:border-box}
.jh-sp{display:flex;flex-direction:column;gap:4px}.jh-sp label{display:flex;gap:8px;align-items:flex-start;font-size:13.5px;padding:4px 0;border-bottom:1px dashed var(--line)}.jh-sp small{display:block;color:var(--muted);font-size:12px}.jh-sp em{font-style:normal;color:var(--muted);font-size:11.5px;margin-left:4px}
.jh-pen{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}.jh-pen div{border:1px solid var(--line);border-radius:10px;padding:10px;font-size:13px;background:var(--card,#fff)}.jh-pen b{display:block;font-size:14px;margin-bottom:2px}
.jh-pv{border:1px solid var(--line);border-radius:12px;background:#E9EDEB;padding:8px;overflow:auto;max-height:640px}body:not(.cap) .jh-pv .sheets{zoom:.5;margin:0}
.a4.jh h3{margin:0;font-size:23px}.a4.jh .ck{display:grid;grid-template-columns:22px 1fr;gap:4px 6px;font-size:12.5px;align-items:start}.a4.jh table.rt td,.a4.jh table.rt th{border:1px solid var(--pline);padding:6px 7px;font-size:12px;vertical-align:top;text-align:left}.a4.jh table.rt{border-collapse:collapse;width:100%}.a4.jh table.rt td{height:34px}`;

function render(){
  const root=$("#jh-root"); if(!root) return;
  if(!$("#jh-css")){ const s=document.createElement("style"); s.id="jh-css"; s.textContent=css; document.head.appendChild(s); }
  root.innerHTML=`
  <div class="panel" style="display:flex;flex-direction:column;gap:12px">
    <h2><i>1</i>적용 대상 확인</h2>
    <div class="fgrid">
      <div class="field"><label>사업장(상호)</label><input data-jh="n" value="${esc(J.n)}" placeholder="예: 행복분식" autocomplete="off"></div>
      <div class="field"><label>업종</label><input data-jh="biz" value="${esc(J.biz)}" placeholder="예: 음식점 / 제조 / 공사" autocomplete="off"></div>
      <div class="field"><label>상시근로자 수</label><input data-jh="staff" inputmode="numeric" value="${esc(J.staff)}" placeholder="예: 7"></div>
    </div>
    <div class="row" style="gap:10px;flex-wrap:wrap"><label class="row" style="gap:6px"><input type="checkbox" data-jhb="build" ${J.build?"checked":""}> 건설공사</label>${J.build?`<label class="row" style="gap:6px">공사금액 <input data-jh="amt" inputmode="numeric" value="${esc(J.amt)}" style="width:90px" placeholder="억원"> 억원</label>`:""}</div>
    <div class="jh-res" id="jh-res"></div>
  </div>
  <div class="panel" style="display:flex;flex-direction:column;gap:10px">
    <div class="row between"><h2><i>2</i>위험성평가 5단계</h2><span class="note">한 것을 체크 · 점검표에 반영</span></div>
    <div class="jh-st">${STEPS.map((s,i)=>`<label><input type="checkbox" data-jhst="${i}" ${J.st[i]?"checked":""}><span><b>${i+1}. ${s[0]}</b><p>${s[1]} ${s[2]}</p></span></label>`).join("")}</div>
    <p class="note" style="margin:0">2026.11.4. 개정: 근로자대표가 참여를 요구하면 일정·방법·범위를 협의해 참여시켜야 하고, 도급인·수급인은 따로 또는 함께 평가할 수 있습니다(함께 하면 양쪽 근로자 모두 참여).</p>
  </div>
  <div class="panel" style="display:flex;flex-direction:column;gap:10px">
    <div class="row between"><h2><i>3</i>위험성평가표</h2><button class="btn sm" type="button" id="jh-add">줄 추가</button></div>
    <div class="jh-tbl"><table><thead><tr><th style="width:15%">작업·공정</th><th style="width:20%">유해·위험요인</th><th style="width:17%">현재 안전조치</th><th style="width:8%">위험성</th><th style="width:20%">개선 대책</th><th style="width:9%">담당</th><th style="width:11%">완료 예정</th></tr></thead>
    <tbody>${J.rows.map((r,i)=>`<tr>${["w","h","c"].map(k=>`<td><input data-jhr="${i}:${k}" value="${esc(r[k])}" placeholder="${i===0?{w:"예: 주방 조리",h:"예: 젖은 바닥 미끄러짐",c:"예: 미끄럼방지 매트"}[k]:""}"></td>`).join("")}
      <td><select data-jhr="${i}:lv"><option value=""></option>${["상","중","하"].map(v=>`<option ${r.lv===v?"selected":""}>${v}</option>`).join("")}</select></td>${["fix","who","due"].map(k=>`<td><input data-jhr="${i}:${k}" value="${esc(r[k])}" placeholder="${i===0?{fix:"예: 배수로 청소 매일",who:"점장",due:"12/10"}[k]:""}"></td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="note" style="margin:0">위험성: 상 = 받아들일 수 없음(바로 개선) · 중 = 개선 계획 · 하 = 관리 유지. 근로자와 함께 작성하고 결과를 게시하세요.</p>
  </div>
  <div class="panel" style="display:flex;flex-direction:column;gap:10px">
    <div class="row between"><h2><i>4</i>중대재해처벌법 — 경영책임자 9가지 (시행령 제4조)</h2><span class="note" id="jh-spn"></span></div>
    <div class="jh-sp">${SAPA.map((s,i)=>`<label><input type="checkbox" data-jhsp="${i}" ${J.sp[i]?"checked":""}><span>${esc(s[0])}<em>${s[1]}</em>${s[2]?`<small>${esc(s[2])}</small>`:""}</span></label>`).join("")}</div>
    <p class="note" style="margin:0">처벌의 전제는 사고 자체가 아니라 이 체계를 사고 전에 갖추고 실제로 했는지입니다. 반기 점검은 기록으로 남기세요.</p>
  </div>
  <div class="panel" style="display:flex;flex-direction:column;gap:10px">
    <h2><i>5</i>처벌과 보험</h2>
    <div class="jh-pen">
      <div><b>사망 1명 이상</b>경영책임자 1년 이상 징역 또는 10억원 이하 벌금(함께 부과 가능) · 법인 50억원 이하 벌금 <span class="note">(법 제6조 제1항·제7조)</span></div>
      <div><b>같은 사고로 6개월 이상 치료 부상 2명 이상 / 같은 유해요인으로 직업성 질병 1년 내 3명 이상</b>7년 이하 징역 또는 1억원 이하 벌금 · 법인 10억원 이하 벌금 <span class="note">(법 제2조 제2호, 제6조 제2항·제7조)</span></div>
      <div><b>위험성평가 과태료</b>미실시 1천만원 이하 · 근로자대표 참여·결과 알림 위반 500만원 이하 <span class="note">(개정 산업안전보건법, 세부 금액표는 시행령 확인 중)</span></div>
    </div>
    <div class="banner" style="display:flex;flex-direction:column;gap:6px"><b>보험은 처벌을 대신하지 못합니다</b><span style="font-size:13px;line-height:1.6">벌금·형사책임은 보험으로 막을 수 없습니다. 보험으로 준비하는 것은 사고로 생긴 <b>손해배상</b>입니다. 일반 배상 특약은 직원 업무 중 부상을 보상하지 않으므로(6개사 약관), 직원이 있으면 산재보험과 <b>근재·사용자배상(EL)</b>을 함께 점검하세요. 중소 제조기업 가입률은 근재 13.2%, 기업중대사고 배상 3.2%입니다(보험연구원 2024 조사).</span>
      <div class="row" style="gap:6px"><button class="btn primary sm" type="button" id="jh-gi">근재 견적 요청서 만들기</button><a class="btn sm" href="https://kras.kosha.or.kr/" target="_blank" rel="noopener">안전보건공단 위험성평가 지원시스템(KRAS)</a></div></div>
  </div>
  <div class="panel" style="display:flex;flex-direction:column;gap:10px">
    <div class="row between"><h2><i>6</i>사장님께 드릴 점검표 (A4 2장)</h2><div class="row" style="gap:6px"><button class="btn sm" type="button" id="jh-copy">안내 문자 복사</button><button class="btn" type="button" id="jh-print">출력</button><button class="btn primary" type="button" id="jh-pdf">PDF 다운로드</button></div></div>
    <span class="note" id="pdfmsg-jh"></span>
    <div class="jh-pv"><div class="sheets" id="sheets-jh"></div></div>
  </div>
  <p class="note">기준: 중대재해처벌법·시행령, 산업안전보건법 제36조, 고용노동부 「새로운 위험성평가 안내서」(2023.5)와 2026.11.4. 위험성평가 지침 전부개정 발표. 개정 고시 원문의 세부 조항(부칙·과태료표)은 확인 중입니다. 법적 판단이 아닌 점검용 자료입니다.</p>`;
  paint();
}
function paint(){
  const r=judge(), el=$("#jh-res");
  if(el) el.innerHTML=r?r.out.map(([s,n,t])=>`<div><span class="pill ${s==="y"?"bad":s==="q"?"warn":"ok"}">${s==="y"?"적용":s==="q"?"확인":"제외"}</span><span><b>${n}</b> — ${esc(t)}</span></div>`).join(""):'<p class="note" style="margin:0">상시근로자 수를 넣으면 적용 여부가 나옵니다.</p>';
  const sn=$("#jh-spn"); if(sn) sn.textContent=`${Object.values(J.sp).filter(Boolean).length}/9 갖춤`;
  sheet();
}
function sheet(){
  const r=judge(), me=typeof ME!=="undefined"?ME:{}, nm=J.n||"사업장", ck=v=>v?"☑":"☐";
  const rows=J.rows.filter(x=>Object.values(x).some(Boolean)), blank=Math.max(0,10-rows.length);
  const p1=`<div class="a4 jh"><div class="ph"><b>중대재해·위험성평가 점검표</b><span>${td()} 기준 · 1/2</span></div>
   <div><div style="font-size:11px;letter-spacing:.12em;color:var(--ink2)">SAFETY CHECK</div><h3>${esc(nm)} 안전보건 점검표</h3><p style="margin:4px 0 0;font-size:12.5px;color:var(--ink2)">${esc(J.biz||"")}${J.staff?` · 상시근로자 ${esc(J.staff)}명`:""} · 담당 ${esc(me.name||"")} ${esc(me.phone||"")}</p></div>
   <div class="sec"><div class="st">적용 대상</div>${r?r.out.map(([s,n,t])=>`<p class="pt"><b>${n}: ${s==="y"?"적용":s==="q"?"확인 필요":"적용 제외"}</b> — ${esc(t)}</p>`).join(""):'<p class="pt">상시근로자 수 확인 필요</p>'}</div>
   <div class="sec"><div class="st">위험성평가 5단계 <span>${Object.values(J.st).filter(Boolean).length}/5</span></div><div class="ck">${STEPS.map((s,i)=>`<span>${ck(J.st[i])}</span><span><b>${s[0]}</b> — ${s[1]}</span>`).join("")}</div></div>
   <div class="sec"><div class="st">경영책임자 안전보건관리체계 (중대재해처벌법 시행령 제4조) <span>${Object.values(J.sp).filter(Boolean).length}/9</span></div><div class="ck">${SAPA.map((s,i)=>`<span>${ck(J.sp[i])}</span><span>${esc(s[0])} (${s[1]})${s[2]?` <span style="color:var(--ink2)">· ${esc(s[2])}</span>`:""}</span>`).join("")}</div></div>
   <div class="sec"><div class="st">알아두세요</div>
    <p class="pt">사망사고 시 경영책임자 1년 이상 징역 또는 10억원 이하 벌금, 법인 50억원 이하 벌금(중대재해처벌법 제6조·제7조).</p>
    <p class="pt">위험성평가를 하지 않으면 과태료(1천만원 이하)가 부과됩니다. ${r?(r.big?"이 사업장은 2027.1.1.부터":"이 사업장은 2028.1.1.부터"):"50명 이상 2027.1.1., 50명 미만 2028.1.1.부터"} 적용됩니다.</p>
    <p class="pt">보험은 벌금·형사책임을 대신하지 못합니다. 직원 사고의 손해배상은 산재보험과 근재·사용자배상책임보험으로 준비합니다.</p></div>
   <p style="margin:auto 0 0;font-size:10.5px;color:var(--ink2)">본 점검표는 입력 내용을 바탕으로 한 점검 자료이며 법적 판단이 아닙니다. 기준: 관계 법령, 고용노동부 위험성평가 안내서(2023.5)·지침 전부개정(2026.11.4.).</p></div>`;
  const p2=`<div class="a4 jh"><div class="ph"><b>위험성평가표</b><span>${td()} 기준 · 2/2</span></div>
   <div class="row between"><h3 style="font-size:20px">${esc(nm)} 위험성평가표</h3><span style="font-size:12px;color:var(--ink2)">평가일 ______ · 참여 근로자 ____________</span></div>
   <table class="rt"><thead><tr><th style="width:14%">작업·공정</th><th style="width:21%">유해·위험요인</th><th style="width:17%">현재 안전조치</th><th style="width:7%">위험성</th><th style="width:21%">개선 대책</th><th style="width:9%">담당</th><th style="width:11%">완료 예정</th></tr></thead>
   <tbody>${rows.map(x=>`<tr>${["w","h","c","lv","fix","who","due"].map(k=>`<td>${esc(x[k])}</td>`).join("")}</tr>`).join("")}${Array(blank).fill("<tr>"+"<td></td>".repeat(7)+"</tr>").join("")}</tbody></table>
   <p style="margin:0;font-size:11.5px;color:var(--ink2)">위험성: 상 = 받아들일 수 없음(작업 전 개선) · 중 = 개선 계획 수립 · 하 = 현재 관리 유지 · 결과는 게시·작업 전 회의로 공유하고, 새로 온 근로자·작업이 바뀐 근로자에게 알립니다 · 기록 3년 보존</p>
   <div class="row between" style="margin-top:auto;font-size:12.5px"><span>대표 ____________ (서명)</span><span>근로자대표 ____________ (서명)</span></div></div>`;
  const s=$("#sheets-jh"); if(s) s.innerHTML=p1+p2;
}
function smsText(){ const r=judge(), me=typeof ME!=="undefined"?ME:{};
  return `${J.n?J.n+" ":""}사장님, 위험성평가 안내드립니다.\n근로자를 쓰는 사업장은 위험성평가가 의무이고, ${r?(r.big?"2027.1.1.":"2028.1.1."):"규모에 따라 2027·2028년"}부터 미실시 시 과태료(1천만원 이하)가 부과됩니다.${r&&r.n>=5?"\n상시근로자 5명 이상이라 중대재해처벌법도 적용됩니다.":""}\n점검표와 평가표 작성을 도와드리겠습니다.\n${me.name||""} ${me.phone||""}`.trim(); }
const msg=t=>{ const m=$("#pdfmsg-jh"); if(m) m.textContent=t; };
const cap=(el)=>(typeof capCanvas==="function"?capCanvas:html2canvas)(el,{scale:2,backgroundColor:"#ffffff",useCORS:true});

document.addEventListener("input",e=>{ const t=e.target; if(!t.closest||!t.closest("#jh-root")) return;
  if(t.dataset.jh){ J[t.dataset.jh]=t.value; paint(); return; }
  if(t.dataset.jhr){ const [i,k]=t.dataset.jhr.split(":"); J.rows[+i][k]=t.value; sheet(); return; } });
document.addEventListener("change",e=>{ const t=e.target; if(!t.closest||!t.closest("#jh-root")) return;
  if(t.dataset.jhb){ J[t.dataset.jhb]=t.checked; render(); return; }
  if(t.dataset.jhst!=null){ J.st[t.dataset.jhst]=t.checked; paint(); return; }
  if(t.dataset.jhsp!=null){ J.sp[t.dataset.jhsp]=t.checked; paint(); return; }
  if(t.dataset.jhr){ const [i,k]=t.dataset.jhr.split(":"); J.rows[+i][k]=t.value; sheet(); } });
document.addEventListener("click",async e=>{ const t=e.target;
  if(t.closest&&t.closest('[data-lb="sapa"]')){ if(!$("#jh-root").children.length) render(); return; }
  if(!t.closest||!t.closest("#jh-root")) return;
  if(t.closest("#jh-add")){ J.rows.push({w:"",h:"",c:"",lv:"",fix:"",who:"",due:""}); render(); return; }
  if(t.closest("#jh-gi")){ if(window.GI) GI.open({name:J.n||GI.G.name,fl:[...new Set([...(GI.G.fl||[]),"staff"])],staff:J.staff||GI.G.staff}); return; }
  if(t.closest("#jh-copy")){ const s=smsText(); let ok=false; try{ ok=typeof copyText==="function"?await copyText(s,$("#pdfmsg-jh")):false; }catch(_){ } if(!ok&&navigator.clipboard) try{ await navigator.clipboard.writeText(s); }catch(_){ } msg("복사했습니다. 카카오톡·문자에 붙여넣으세요."); return; }
  if(t.closest("#jh-pdf")){ if(!window.html2canvas||!window.jspdf){ msg("PDF 도구를 불러오지 못했습니다."); return; } const dl=typeof DL!=="undefined"?DL:null; if(!dl){ msg("이 화면에서는 파일 저장을 지원하지 않습니다."); return; }
    msg("PDF를 만드는 중입니다..."); try{ if(document.fonts&&document.fonts.ready) await document.fonts.ready; const pdf=new jspdf.jsPDF({unit:"mm",format:"a4"}), pg=$$("#sheets-jh .a4");
      for(let i=0;i<pg.length;i++){ const cv=await cap(pg[i]); if(i) pdf.addPage(); pdf.addImage(cv.toDataURL("image/jpeg",0.9),"JPEG",0,0,210,Math.min(297,210*cv.height/cv.width)); }
      await dl.save({filename:`위험성평가점검표_${(J.n||"사업장").replace(/[\\/:*?"<>|]/g,"")}_${td()}.pdf`,data:pdf.output("blob")}); msg("저장했습니다."); }
    catch(err){ msg(err&&err.code==="declined"?"저장을 취소했습니다.":"PDF 저장에 실패했습니다."); } return; }
  if(t.closest("#jh-print")){ const w=window.open("","_blank"); if(!w){ msg("팝업이 막혀 있습니다. 팝업을 허용해 주세요."); return; } w.document.write("<p style='font-family:sans-serif;padding:20px'>출력 준비 중…</p>");
    try{ if(document.fonts&&document.fonts.ready) await document.fonts.ready; const imgs=[]; for(const pg of $$("#sheets-jh .a4")) imgs.push((await cap(pg)).toDataURL("image/jpeg",0.92));
      w.document.open(); w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>위험성평가 점검표</title><style>@page{size:A4;margin:0}body{margin:0}img{width:210mm;display:block;page-break-after:always}</style></head><body>${imgs.map(s=>`<img src="${s}">`).join("")}<script>window.onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`); w.document.close(); msg(""); }
    catch(_){ try{ w.close(); }catch(__){} msg("출력 준비에 실패했습니다."); } return; }
});
window.JH={render,J};
})();
