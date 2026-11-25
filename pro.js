/* 보잇 · 일반보험 › 전문인 배상 (2026-11-25 대표 지시)
   직업을 고르면 손해배상책임 보장(보험·공제·공탁) 법정 의무 여부·최저 금액·근거 조문을 보여 주고, 설계 도우미(견적 요청서)로 넘김.
   근거: 국가법령정보센터 현행 법령(2026-11-25 조회). 금액·조문을 확인하지 못한 항목은 '확인 중'으로 표시하고 단정하지 않음. */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
/* st: y=의무 / n=의무 아님(임의) / q=확인 중 */
const PROS=[
 {k:"realtor",n:"공인중개사(개업)",kw:"부동산 중개",ent:true,
  ind:{st:"y",amt:"2억원 이상",law:"공인중개사법 제30조 제3항, 시행령 제24조",how:"보증보험·공제(협회)·공탁 중 하나, 업무 시작 전",more:"중개 완성 때 보장금액·보증기관·기간을 거래당사자에게 설명하고 증서 사본을 줘야 합니다(제30조 제5항)."},
  corp:{st:"y",amt:"4억원 이상 + 분사무소마다 2억원 이상",law:"공인중개사법 제30조 제3항, 시행령 제24조",how:"보증보험·공제(협회)·공탁 중 하나, 업무 시작 전"}},
 {k:"tax",n:"세무사",kw:"세무 회계 기장",ent:true,
  ind:{st:"y",amt:"세무사 1명당 3천만원 이상",law:"세무사법 제16조의2, 시행령 제33조의4",how:"보험·한국세무사회 공제·공탁 중 하나, 등록 후 15일 이내 조치하고 세무사회에 신고"},
  corp:{st:"y",amt:"매 사업연도 총매출액의 2% 준비금 적립 또는 (소속 세무사 수 × 3천만원 − 적립 준비금)을 넘는 보험",law:"세무사법 제16조의7, 시행령 제14조의8",how:"손해배상준비금 적립 또는 손해배상책임보험, 사업연도마다",more:"위반 시 등록취소 또는 1년 이내 업무정지 사유(제16조의15)."}},
 {k:"appraiser",n:"감정평가사",kw:"감정평가",ent:true,
  ind:{st:"y",amt:"감정평가사 1명당 1억원 이상(보증보험)",law:"감정평가법 제28조 제2항, 시행령 제23조 제3항",how:"보험 또는 한국감정평가사협회 공제",more:"미조치 시 400만원 이하 과태료(제52조), 인가취소·업무정지 사유(제32조)."},
  corp:{st:"y",amt:"감정평가사 1명당 1억원 이상(보증보험)",law:"감정평가법 제28조 제2항, 시행령 제23조",how:"보험 또는 한국감정평가사협회 공제"}},
 {k:"admin",n:"행정사",kw:"행정사 인허가 대행",ent:true,
  ind:{st:"q",amt:"",law:"행정사법 — 개인 행정사 조항은 확인 중",note:"법률에서 확인한 의무 조항은 행정사법인(제25조의12)입니다. 개인 행정사는 확인 중입니다."},
  corp:{st:"y",amt:"(법인구성원+소속행정사 수) × 1천만원 이상 또는 법인당 1억원 이상",law:"행정사법 제25조의12, 시행령 제23조의8",how:"보험 또는 공탁, 법인업무신고 후 15일 이내",more:"미조치 시 500만원 이하 과태료(제38조)."}},
 {k:"customs",n:"관세사",kw:"관세 통관",ent:true,
  ind:{st:"y",amt:"시행령 금액 확인 중",law:"관세사법 제16조",how:"보험 가입 등(대통령령)",note:"관세법인 소속 관세사는 제외됩니다."},
  corp:{st:"y",amt:"시행령 금액 확인 중",law:"관세사법 제17조의5",how:"사업연도마다 손해배상준비금 적립 또는 손해배상책임보험",more:"위반 시 등록취소 또는 1년 이내 업무정지 사유(제18조)."}},
 {k:"cpa",n:"공인회계사",kw:"회계 감사",ent:true,
  ind:{st:"y",amt:"시행령 금액 확인 중",law:"공인회계사법 제19조",how:"한국공인회계사회 공제 또는 보험 등",note:"회계법인에 소속되지 않은 공인회계사가 대상입니다."},
  corp:{st:"y",amt:"매 사업연도 손해배상준비금 적립(기준은 시행령)",law:"공인회계사법 제28조",how:"손해배상준비금 적립(사업연도마다)",more:"위반 시 5년 이하 징역 또는 5천만원 이하 벌금(제53조)."}},
 {k:"architect",n:"건축사",kw:"설계 감리 건축",ent:false,
  ind:{st:"y",amt:"설계·감리 계약금액 기준(세부 산출은 국토부 고시)",law:"건축사법 제20조 제3항, 시행령 제21조",how:"보험 또는 공제(건축사공제조합 등), 착공일부터 완공일까지",more:"설계·감리 계약 때 보험·공제 증서를 건축주에게 내야 합니다(시행령 제21조 제2항)."}},
 {k:"lawyer",n:"변호사",kw:"법무법인 로펌",ent:true,
  ind:{st:"n",amt:"",law:"변호사법 — 개인 변호사·일반 법무법인 의무 조항 없음",note:"임의 가입(변호사 전문인배상)으로 권유합니다."},
  corp:{st:"y",amt:"시행령 금액 확인 중",law:"변호사법 제58조의12(법무법인(유한)), 제58조의30(법무조합 준용)",how:"손해배상 준비금 적립 또는 보험·공제기금 가입",note:"일반 법무법인은 의무 조항이 없고, 법무법인(유한)·법무조합만 의무입니다.",more:"위반 시 설립인가 취소 사유(제58조의13)."}},
 {k:"postnatal",n:"산후조리원(산후조리업)",kw:"산후조리",ent:false,
  ind:{st:"y",amt:"시행령 금액 확인 중",law:"모자보건법 제15조의15 제2항",how:"책임보험 가입 후 산후조리업 신고(제15조 제1항)",more:"미가입 시 100만원 이하 과태료(제27조), 시정명령·업 정지 사유."}},
 {k:"travel",n:"여행업",kw:"여행사 투어",ent:false,
  ind:{st:"y",amt:"직전 사업연도 매출액 구간별(시행규칙 별표 3) — 기획여행은 추가 가입",law:"관광진흥법 시행규칙 제18조",how:"보증보험·공제 가입 또는 영업보증금 예치, 사업 시작 전"}},
 {k:"scrivener",n:"법무사",kw:"등기 법무",ent:true,
  ind:{st:"q",amt:"",law:"법무사법 — 확인 중",note:"법령 원문을 다시 확인한 뒤 반영합니다. 확정 전에는 의무라고 안내하지 마세요."},
  corp:{st:"q",amt:"",law:"법무사법 — 확인 중"}},
 {k:"housing",n:"주택관리업자·관리사무소장",kw:"아파트 관리",ent:false,
  ind:{st:"q",amt:"",law:"공동주택관리법 — 확인 중",note:"법령 원문을 다시 확인한 뒤 반영합니다."}},
 {k:"security",n:"경비업",kw:"경비 보안",ent:false,
  ind:{st:"n",amt:"",law:"경비업법 제26조(손해배상 책임만 규정)",note:"경비업법에 보험 가입 의무 조항은 없습니다(경비협회 공제는 임의). 시설주와의 계약 조건으로 요구될 수 있습니다."}},
 {k:"beauty",n:"이·미용·피부·네일",kw:"미용실 네일 피부관리",ent:false,
  ind:{st:"n",amt:"",law:"공중위생관리법 — 보험 가입 의무 조항 확인되지 않음",note:"임의 가입. 시설소유관리자 특약은 전문직업인의 직업상 과실을 면책하므로 이·미용사 배상 특약이 따로 필요합니다(현대·메리츠·KB·한화·DB 약관)."}},
 {k:"etc",n:"그 밖의 전문직(노무사·변리사·IT·컨설팅 등)",kw:"노무 변리 컨설팅 디자인 개발",ent:false,
  ind:{st:"q",amt:"",law:"직업별 법령 확인 필요",note:"법정 의무가 확인되지 않은 직업은 임의 가입(전문인 배상책임)으로 권유하고, 발주처 계약 조건(보험 가입 요구)을 확인하세요."}}];
const P={k:"realtor",corp:false,name:"",staff:""};
const ST={y:["의무","d"],n:["임의","o"],q:["확인 중","q"]};
function cur(){ const p=PROS.find(x=>x.k===P.k)||PROS[0], r=(P.corp&&p.corp)?p.corp:p.ind; return {p,r}; }
function render(){ const root=$("#pro-root"); if(!root) return;
  if(!$("#pro-css")){ const s=document.createElement("style"); s.id="pro-css"; s.textContent=CSS; document.head.appendChild(s); }
  const {p,r}=cur(), st=ST[r.st];
  root.innerHTML=`<div class="pro2">
  <aside class="panel pro-in">
    <div class="field"><label>직업 검색</label><input id="pro-q" placeholder="예: 세무, 중개, 산후조리" autocomplete="off"></div>
    <div class="pro-list" id="pro-list">${PROS.map(x=>`<button type="button" data-prok="${x.k}" aria-pressed="${x.k===P.k}">${esc(x.n)}</button>`).join("")}</div>
    ${p.ent?`<div class="pro-seg"><button type="button" data-procorp="0" aria-pressed="${!P.corp}">개인 사무소</button><button type="button" data-procorp="1" aria-pressed="${P.corp}">법인</button></div>`:""}
  </aside>
  <section class="panel pro-out">
    <div class="pro-hd"><b>${esc(p.n)}${p.ent?` <small>${P.corp?"법인":"개인"}</small>`:""}</b><span class="pro-st ${st[1]}">${st[0]}</span></div>
    <table class="pro-t"><tbody>
      <tr><th>법정 최저 금액</th><td>${r.amt?`<b>${esc(r.amt)}</b>`:"—"}</td></tr>
      <tr><th>방법·시기</th><td>${esc(r.how||(r.st==="n"?"법정 의무 없음 — 임의 가입":"—"))}</td></tr>
      <tr><th>근거</th><td>${esc(r.law)}</td></tr>
      ${r.more?`<tr><th>제재·유의</th><td>${esc(r.more)}</td></tr>`:""}
      ${r.note?`<tr><th>참고</th><td>${esc(r.note)}</td></tr>`:""}
    </tbody></table>
    <p class="pro-say">${r.st==="y"?`고객에게: “${esc(p.n)}${P.corp?" 법인":""}은 법으로 손해배상책임 보장(보험·공제 등)이 의무입니다${r.amt?` — ${esc(r.amt)}`:""}. 미가입 상태면 업무 시작 전에 갖춰야 합니다.”`:r.st==="n"?`고객에게: “법정 의무는 아니지만, 업무상 실수로 고객 손해를 배상할 일이 생기면 개인 재산으로 물어야 합니다. 전문인 배상책임으로 대비하세요.”`:"법령 확인이 끝나지 않은 항목입니다. 의무 여부를 단정하지 말고 협회·소관 부처에 확인하세요."}</p>
    <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" type="button" id="pro-go">설계 도우미로 → 견적 요청서 만들기</button><button class="btn" type="button" id="pro-copy">안내 문구 복사</button><span class="note" id="pro-msg"></span></div>
    <p class="note" style="margin:0">근거: 국가법령정보센터 현행 법령(2026-11-25 조회). 금액은 법정 최저 기준이며, 실제 가입 한도는 계약 규모·협회 공제 조건을 함께 보세요.</p>
  </section></div>`; }
function say(){ const {p,r}=cur(); return `${p.n}${P.corp?" 법인":""} 전문인 배상책임 안내\n- 법정 의무: ${ST[r.st][0]}\n${r.amt?`- 최저 금액: ${r.amt}\n`:""}- 근거: ${r.law}${r.how?`\n- 방법: ${r.how}`:""}`; }
document.addEventListener("click",e=>{ const t=e.target;
  if(t.closest&&t.closest('[data-lb="pro"]')){ if(!$("#pro-root").children.length) render(); return; }
  if(!t.closest||!t.closest("#pro-root")) return;
  const k=t.closest("[data-prok]"); if(k){ P.k=k.dataset.prok; const p=PROS.find(x=>x.k===P.k); if(!p.ent) P.corp=false; render(); return; }
  const c=t.closest("[data-procorp]"); if(c){ P.corp=c.dataset.procorp==="1"; render(); return; }
  if(t.closest("#pro-copy")){ const m=$("#pro-msg"); if(typeof copyText==="function") copyText(say(),m); else { try{ navigator.clipboard.writeText(say()); m.textContent="복사했습니다."; }catch(_){ } } return; }
  if(t.closest("#pro-go")){ const {p,r}=cur(); if(window.GI&&GI.open) GI.open({biz:"pro",fl:["visit","pro"],prof:{n:p.n+(P.corp?" 법인":""),st:r.st,amt:r.amt,law:r.law}}); return; }
});
document.addEventListener("input",e=>{ if(e.target.id!=="pro-q") return; const q=e.target.value.replace(/\s+/g,"");
  document.querySelectorAll("#pro-list [data-prok]").forEach(b=>{ const p=PROS.find(x=>x.k===b.dataset.prok); b.hidden=!!q&&!(p.n+p.kw).replace(/\s+/g,"").includes(q); }); });
const CSS=`#pro-root .pro2{display:grid;grid-template-columns:minmax(280px,340px) minmax(0,1fr);gap:14px;align-items:start}@media(max-width:1000px){#pro-root .pro2{grid-template-columns:1fr}}
.pro-in{display:flex;flex-direction:column;gap:10px;padding:14px!important}.pro-list{display:flex;flex-direction:column;gap:4px;max-height:460px;overflow:auto}
.pro-list button{text-align:left;border:1.5px solid var(--line);background:var(--surface,#fff);border-radius:8px;padding:8px 10px;font:inherit;font-size:13.5px;cursor:pointer}.pro-list button[aria-pressed="true"]{border-color:var(--accent,#0E7A5F);background:#E6F4EF;font-weight:800}
.pro-seg{display:grid;grid-template-columns:1fr 1fr;gap:6px}.pro-seg button{border:1.5px solid var(--line);background:#fff;border-radius:8px;padding:8px;font:inherit;font-weight:700;cursor:pointer}.pro-seg button[aria-pressed="true"]{background:var(--accent,#0E7A5F);border-color:var(--accent,#0E7A5F);color:#fff}
.pro-out{display:flex;flex-direction:column;gap:12px}.pro-hd{display:flex;align-items:center;gap:10px}.pro-hd b{font-size:19px}.pro-hd small{font-size:13px;color:var(--muted)}
.pro-st{font-size:13px;font-weight:800;border-radius:99px;padding:3px 12px}.pro-st.d{background:#FDECEC;color:#B42318}.pro-st.o{background:#E6F4EF;color:#0E7A5F}.pro-st.q{background:#FFF4D6;color:#8A5A00}
.pro-t{width:100%;border-collapse:collapse;font-size:14px}.pro-t th{width:120px;text-align:left;vertical-align:top;color:var(--muted);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--line)}.pro-t td{padding:8px 10px;border-bottom:1px solid var(--line);line-height:1.55}
.pro-say{margin:0;background:#F4F8F6;border-left:4px solid var(--accent,#0E7A5F);padding:10px 12px;border-radius:6px;font-size:14px;line-height:1.6}`;
window.PRO={render,P,PROS};
})();
