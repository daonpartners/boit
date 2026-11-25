/* 보잇 · 연락처 모음 — 의료기관 / 간병 / 손해사정사 (2026-11-25 대표 지시)
   의료기관 근거 (2026-11-25 확인)
   - 상급종합병원: 보건복지부 제5기(2024.1.1~2026.12.31) 47곳. 제6기(2027~2029)는 2026년 12월 발표 → 발표 후 이 목록 교체
   - 권역심뇌혈관질환센터: 15곳 (복지부 2026.11.19 재지정 14곳 + 2026.2 성가롤로병원). 중앙센터 서울대병원
   - 지역암센터: 국가암정보센터(cancer.go.kr) 지정현황 13곳 + 국립암센터(중앙). 제5차 암관리종합계획으로 '권역암센터' 명칭 변경 예정
   전화번호는 바뀔 수 있어 적지 않고 네이버지도 검색으로 연결 */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
/* t: s=상급종합 c=암센터 h=권역심뇌혈관 */
const H=[
["서울대병원","서울","s","중앙심뇌혈관질환센터"],["삼성서울병원","서울","s"],["서울아산병원","서울","s"],["세브란스병원","서울","s"],["서울성모병원","서울","s"],
["강남세브란스병원","서울","s"],["강북삼성병원","서울","s"],["건국대병원","서울","s"],["경희대병원","서울","s"],["고려대구로병원","서울","s"],["고려대안암병원","서울","s"],
["이대목동병원","서울","s"],["중앙대병원","서울","s"],["한양대병원","서울","s"],
["길병원","인천","sc"],["인하대병원","인천","sh"],["인천성모병원","인천","s"],
["순천향대부천병원","경기","s"],["성빈센트병원","경기","s"],["고려대안산병원","경기","s"],["분당서울대병원","경기","sh"],["아주대병원","경기","sc"],["한림대성심병원","경기","s"],["국립암센터","경기","n","암관리법 제27조"],
["강릉아산병원","강원","s"],["원주세브란스기독병원","강원","s"],["강원대병원","강원","ch"],
["충북대병원","충북","sch"],
["충남대병원","대전","sch"],["건양대병원","대전","s"],["단국대병원","충남","sc"],["순천향대천안병원","충남","h"],
["전북대병원","전북","sc"],["원광대병원","전북","sh"],
["전남대병원","광주","sh"],["조선대병원","광주","s"],["화순전남대병원","전남","sc"],["성가롤로병원","전남","h"],
["경북대병원","대구","sh"],["칠곡경북대병원","대구","sc"],["계명대동산병원","대구","s"],["대구가톨릭대병원","대구","s"],["영남대병원","대구","s"],["안동병원","경북","h"],
["부산대병원","부산","sc"],["동아대병원","부산","sh"],["고신대복음병원","부산","s"],["부산백병원","부산","s"],
["울산대병원","울산","sch"],["양산부산대병원","경남","s"],["경상국립대병원","경남","sch"],["삼성창원병원","경남","s"],
["제주대병원","제주","ch"]];
const TAG={s:"상급종합병원",c:"지역암센터",h:"권역심뇌혈관질환센터",n:"국립암센터"};
const REG=["전체","서울","인천","경기","강원","충북","대전","충남","전북","광주","전남","대구","경북","부산","울산","경남","제주"];
/* 다온파트너스 제휴처 — 계약되면 여기에 추가 {n:"업체명",tel:"",area:"",memo:""} */
const PARTNER={carer:[],adjuster:[]};
const C={q:"",t:"",r:"전체"};
const map=n=>"https://map.naver.com/p/search/"+encodeURIComponent(n);
const uid=()=>{ try{ return (window.ME&&(ME.id||ME.uid))||"me"; }catch(e){ return "me"; } };
const key=k=>`boit_ct_${uid()}_${k}`;
const mine=k=>{ try{ return JSON.parse(localStorage.getItem(key(k))||"[]"); }catch(e){ return []; } };
const save=(k,a)=>{ try{ localStorage.setItem(key(k),JSON.stringify(a)); }catch(e){} };
const tel=v=>{ const d=String(v||"").replace(/[^\d]/g,""); return d.length>=8?`<a href="tel:${d}">${esc(v)}</a>`:esc(v); };
function css(){ if($("#ct-css")) return; const s=document.createElement("style"); s.id="ct-css"; s.textContent=`
.ct{display:flex;flex-direction:column;gap:12px}.ct-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px 14px!important}
.ct-top input,.ct-top select{padding:9px 12px;border:1.5px solid #B7E1CF;border-radius:10px;font:inherit}.ct-top input{flex:1;min-width:200px}
.ct-ch{display:flex;gap:6px;flex-wrap:wrap}.ct-ch button{border:1.5px solid var(--line);background:#fff;border-radius:99px;padding:6px 13px;font:inherit;font-weight:700;cursor:pointer}.ct-ch button[aria-pressed="true"]{background:var(--accent,#0E7A5F);border-color:var(--accent,#0E7A5F);color:#fff}
.ct-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
.ct-c{display:flex;flex-direction:column;gap:6px;padding:12px 14px!important}.ct-c b{font-size:15px}.ct-c small{color:var(--muted)}
.ct-tg{display:flex;gap:4px;flex-wrap:wrap}.ct-tg i{font-style:normal;font-size:11.5px;font-weight:700;padding:2px 8px;border-radius:99px;background:#EEF5F2;color:#0F5C46}.ct-tg i.c{background:#FDF0E7;color:#B4511B}.ct-tg i.n{background:#FDF0E7;color:#B4511B}.ct-tg i.h{background:#FDECEC;color:#B42323}
.ct-c a.btn{align-self:flex-start}.ct-box{padding:14px 16px!important}.ct-box h3{margin:0 0 8px;font-size:15px}.ct-box ul{margin:0;padding-left:18px}.ct-box li{margin:3px 0}
.ct-row{display:grid;grid-template-columns:1fr 130px 1fr auto;gap:8px;align-items:center;padding:7px 0;border-bottom:1px dashed var(--line);font-size:13.5px}
.ct-add{display:grid;grid-template-columns:1fr 140px 1fr auto;gap:6px;margin-top:8px}.ct-add input{padding:8px 10px;border:1.5px solid var(--line);border-radius:8px;font:inherit;min-width:0}
.ct-x{border:0;background:none;color:var(--muted);cursor:pointer;font-size:15px}
@media(max-width:640px){.ct-row,.ct-add{grid-template-columns:1fr 1fr}}`; document.head.appendChild(s); }
function myList(k,label){ const L=mine(k);
  return `<div class="panel ct-box"><h3>내 ${label}</h3>${L.length?L.map((x,i)=>`<div class="ct-row"><b>${esc(x.n)}</b><span>${tel(x.tel)}</span><small>${esc(x.memo)}</small><button type="button" class="ct-x" data-ctdel="${k}:${i}" aria-label="삭제">✕</button></div>`).join(""):'<p class="note" style="margin:0">자주 연락하는 곳을 추가해 두세요. 이 기기에만 저장됩니다.</p>'}
  <div class="ct-add"><input id="ct-n-${k}" placeholder="이름·업체명"><input id="ct-t-${k}" placeholder="전화" inputmode="tel"><input id="ct-m-${k}" placeholder="지역·메모"><button type="button" class="btn sm primary" data-ctadd="${k}">추가</button></div></div>`; }
function partner(k,label){ const L=PARTNER[k];
  return `<div class="panel ct-box"><h3>다온 제휴 ${label}</h3>${L.length?L.map(x=>`<div class="ct-row"><b>${esc(x.n)}</b><span>${tel(x.tel)}</span><small>${esc([x.area,x.memo].filter(Boolean).join(" · "))}</small><span></span></div>`).join(""):'<p class="note" style="margin:0">제휴 업체를 준비 중입니다.</p>'}</div>`; }
function hosp(){ const root=$("#hp-root"); if(!root) return;
  const q=C.q.replace(/\s+/g,"");
  const L=H.filter(h=>(!C.t||h[2].includes(C.t)||(C.t==="c"&&h[2].includes("n")))&&(C.r==="전체"||h[1]===C.r)&&(!q||h[0].includes(q)));
  root.innerHTML=`<div class="ct"><div class="panel ct-top"><input id="ct-q" value="${esc(C.q)}" placeholder="병원 이름 검색" autocomplete="off">
  <select id="ct-r" aria-label="지역">${REG.map(r=>`<option${r===C.r?" selected":""}>${r}</option>`).join("")}</select>
  <div class="ct-ch">${[["","전체"],["s","상급종합병원"],["c","지역암센터"],["h","권역심뇌혈관질환센터"]].map(([v,t])=>`<button type="button" data-ctt="${v}" aria-pressed="${C.t===v}">${t}</button>`).join("")}</div><span class="note">${L.length}곳</span></div>
  <div class="ct-grid">${L.map(h=>`<div class="panel ct-c"><b>${esc(h[0])}</b><small>${esc(h[1])}${h[3]?" · "+esc(h[3]):""}</small><div class="ct-tg">${h[2].split("").map(t=>`<i class="${t}">${TAG[t]}</i>`).join("")}</div><a class="btn sm" href="${map(h[0])}" target="_blank" rel="noopener">지도·전화</a></div>`).join("")||'<p class="note">찾는 병원이 없습니다.</p>'}</div>
  <p class="note" style="margin:0 2px">상급종합병원: 보건복지부 제5기(2024~2026) 지정. 2027년 1월부터 제6기 지정 결과로 바뀝니다(12월 발표 예정). 지역암센터: 국가암정보센터 지정현황(제5차 암관리종합계획에 따라 '권역암센터'로 명칭 변경 예정). 권역심뇌혈관질환센터: 보건복지부 지정.</p>
  <div class="panel ct-box"><h3>보험 약관의 병원 범위는 정부 지정과 다릅니다</h3><ul><li>'암중점치료기관', '암종합치료기관' 등은 정부 지정 명칭이 아니라 보험회사가 약관에서 정한 용어입니다. 같은 이름이어도 회사·상품마다 포함 병원이 다를 수 있습니다.</li><li>보험금 청구 전 해당 약관의 용어 정의 조항에서 치료받은 병원이 포함되는지 확인하세요.</li></ul></div>
  ${myList("hosp","병원")}</div>`; }
function carer(){ const root=$("#cr-root"); if(!root) return;
  root.innerHTML=`<div class="ct"><div class="panel ct-box"><h3>간병인 없이 입원: 간호·간병통합서비스</h3><ul>
  <li>간호사·간호조무사가 24시간 돌보며, 사적 간병비 없이 건강보험 입원료 본인부담만 냅니다(1:1 간병은 아님).</li>
  <li>병원 찾기: 네이버지도·카카오맵에서 <b>'간호·간병'</b> 검색, 또는 국민건강보험공단 1577-1000</li>
  <li>입원 시 의사 의견서와 환자 동의서로 병원에 신청</li></ul>
  <a class="btn sm" href="https://map.naver.com/p/search/${encodeURIComponent("간호·간병통합서비스")}" target="_blank" rel="noopener" style="margin-top:8px;display:inline-block">가까운 병원 찾기</a></div>
  ${partner("carer","간병 업체")}${myList("carer","간병 업체")}
  <p class="note" style="margin:0 2px">간병비 보장(간병인 지원·간병인 사용 일당 등)은 고객 계약의 약관 조건을 확인하세요.</p></div>`; }
function adjuster(){ const root=$("#aj-root"); if(!root) return;
  root.innerHTML=`<div class="ct"><div class="panel ct-box"><h3>손해사정사 선임 전 확인</h3><ul>
  <li>보험계약자 등은 손해사정사를 따로 선임할 수 있습니다(보험업법 제185조 단서).</li>
  <li>보험회사가 동의하면 비용은 보험회사가 냅니다. 선임 전에 보험회사에 동의 여부를 먼저 확인하세요(보험업감독규정 제9-16조).</li>
  <li>등록된 손해사정사인지 금융감독원(1332)에서 확인할 수 있습니다.</li>
  <li>합의·소송 대행은 변호사 업무입니다. 손해사정사에게 맡길 수 없습니다(변호사법).</li></ul></div>
  ${partner("adjuster","손해사정사")}${myList("adjuster","손해사정사")}</div>`; }
const R={hosp,carer,adjuster};
function draw(){ css(); Object.keys(R).forEach(v=>{ const s=document.querySelector(`section[data-view="${v}"]`); if(s&&!s.hidden) R[v](); }); }
document.addEventListener("input",e=>{ if(e.target.id!=="ct-q") return; C.q=e.target.value; const p=e.target.selectionStart; hosp(); const i=$("#ct-q"); i.focus(); try{ i.setSelectionRange(p,p); }catch(_){} });
document.addEventListener("change",e=>{ if(e.target.id==="ct-r"){ C.r=e.target.value; hosp(); } });
document.addEventListener("click",e=>{ const t=e.target.closest&&e.target.closest("[data-ctt],[data-ctadd],[data-ctdel]"); if(!t) return;
  if(t.dataset.ctt!=null){ C.t=t.dataset.ctt; hosp(); return; }
  if(t.dataset.ctadd){ const k=t.dataset.ctadd, n=($("#ct-n-"+k).value||"").trim(); if(!n){ $("#ct-n-"+k).focus(); return; }
    const a=mine(k); a.push({n,tel:($("#ct-t-"+k).value||"").trim(),memo:($("#ct-m-"+k).value||"").trim()}); save(k,a); R[k](); return; }
  if(t.dataset.ctdel){ const [k,i]=t.dataset.ctdel.split(":"); const a=mine(k); a.splice(+i,1); save(k,a); R[k](); } });
new MutationObserver(m=>{ if(m.some(x=>x.target.matches&&x.target.matches('section[data-view="hosp"],section[data-view="carer"],section[data-view="adjuster"]')&&!x.target.hidden)) draw(); }).observe(document.body,{subtree:true,attributes:true,attributeFilter:["hidden"]});
window.CONTACTS={draw,H};
})();
