/* 보잇 · 온라인 자동화 (2026-11-12)
   설계사 블로그·카페 운영을 돕는 자동화 모음. 지금 쓸 수 있는 것: 블로그 키워드 조사, 콘텐츠 계획.
   키워드 조사: n8n '보잇 키워드 조사 API' (POST boit-keyword {token, keywords[], related})
     - 월간 검색량: 네이버 검색광고 API (keywordstool)
     - 경쟁도: 네이버 API HUB 블로그 검색 상위 10개 중 제목에 키워드를 그대로 넣은 글 수, 상위글 나이(중앙값)
     - 검색 결과 글 본문은 저장하지 않고 AI에 넣지 않음 (NAVER API HUB 이용 조건)
   저장: ME.oa = {last, plan[]} (app_state 클라우드 저장에 포함)
   원칙: 보험 관련 글은 광고 → 회사 준법감시 심의 후 게시 (금융소비자보호법 제22조). 심의번호 없는 글은 '발행'으로 바꿀 수 없음.
*/
(function(){
"use strict";
const $=s=>document.querySelector(s);
const E=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const td=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const fmt=n=>Number(n||0).toLocaleString("ko-KR");
const API="https://daonpartners.app.n8n.cloud/webhook/boit-keyword";
function D(){ try{ if(!ME.oa||typeof ME.oa!=="object") ME.oa={}; if(!Array.isArray(ME.oa.plan)) ME.oa.plan=[]; return ME.oa; }catch(e){ window.__OA=window.__OA||{plan:[]}; return window.__OA; } }
let TAB="kw", BUSY=false;
const VC={"최적":"var(--ok)","가능":"var(--c2)","어려움":"var(--warn)","포화":"var(--bad)","허수":"var(--muted)"};
const ST=["예정","초안","심의중","발행"];

function root(){ return $("#oa-root"); }
function render(){
  const R=root(); if(!R) return;
  const T=[["kw","블로그 키워드 조사"],["plan","콘텐츠 계획 ("+D().plan.length+")"],["more","자동화 목록"]];
  R.innerHTML=`<div class="tabs">${T.map(([k,t])=>`<button class="btn" type="button" data-oat="${k}" aria-pressed="${TAB===k}">${t}</button>`).join("")}</div>
  <div class="oa-rule">보험 상품·보장 내용이 들어간 글은 <b>광고</b>입니다. 회사 준법감시 심의를 받은 뒤 게시하고, 글 끝에 심의필 문구를 넣으세요 (금융소비자보호법 제22조).</div>
  <div id="oa-body" style="margin-top:14px"></div>`;
  ({kw:vKw,plan:vPlan,more:vMore}[TAB]||vKw)();
}

/* ---------- 1. 블로그 키워드 조사 ---------- */
function vKw(){
  const B=$("#oa-body"), L=D().last;
  B.innerHTML=`<div class="panel">
    <h2 style="margin:0 0 4px">블로그 키워드 조사</h2>
    <p class="note" style="margin:0 0 12px">쓰고 싶은 주제의 키워드를 넣으면 네이버 월간 검색량과 블로그 상위 10개 글의 경쟁 정도를 보여 줍니다. 결과에서 쓸 키워드를 <b>계획에 담기</b>로 모아 두세요.</p>
    <div class="fgrid">
      <div class="field" style="grid-column:span 2"><label for="oa-k">키워드 <small>한 줄에 하나, 최대 20개</small></label><textarea id="oa-k" class="oa-ta" rows="4" maxlength="800" placeholder="음식점 화재보험&#10;소상공인 화재보험&#10;다중이용업소 화재배상책임보험">${E(L&&L.input||"")}</textarea></div>
      <div class="field"><label for="oa-r">연관 키워드 추가</label><select id="oa-r">${[0,5,10,20].map(n=>`<option value="${n}" ${(L&&L.related===n)||(!L&&n===10)?"selected":""}>${n?n+"개 더 찾기":"입력한 것만"}</option>`).join("")}</select></div>
    </div>
    <div class="row" style="margin-top:10px;gap:8px;align-items:center"><button class="btn primary" type="button" id="oa-go" ${BUSY?"disabled":""}>${BUSY?"조사 중… (10~30초)":"조사하기"}</button><span class="note" id="oa-msg"></span></div>
  </div>
  <div id="oa-res"></div>`;
  if(L&&Array.isArray(L.rows)) vRes(L);
}
function vRes(L){
  const R=$("#oa-res"); if(!R) return;
  const inPlan=k=>D().plan.some(p=>p.keyword===k);
  R.innerHTML=`<div class="panel" style="margin-top:14px">
    <div class="row between" style="flex-wrap:wrap;gap:8px"><h2 style="margin:0">조사 결과 <small class="note">${E((L.at||"").slice(0,10))} · ${L.rows.length}개</small></h2><button class="btn sm" type="button" id="oa-addall">최적·가능 모두 계획에 담기</button></div>
    <div class="tbl-wrap" style="margin-top:10px"><table class="oa-t"><thead><tr><th>키워드</th><th>월간 검색량</th><th>상위10 제목일치</th><th>상위글 나이</th><th>블로그 문서</th><th>판정</th><th></th></tr></thead><tbody>
    ${L.rows.map((r,i)=>`<tr><td><b>${E(r.keyword)}</b>${r.type==="연관"?` <span class="pill" style="background:var(--surface-2,#eef)">연관</span>`:""}</td><td class="num">${fmt(r.search)}</td><td class="num">${r.hits} / 10</td><td class="num">${fmt(r.age)}일</td><td class="num">${fmt(r.blog)}</td><td><b style="color:${VC[r.verdict]||"inherit"}">${E(r.verdict)}</b></td>
      <td>${inPlan(r.keyword)?`<span class="note">담김</span>`:`<button class="btn sm" type="button" data-oaadd="${i}">계획에 담기</button>`}</td></tr>`).join("")}
    </tbody></table></div>
    <details class="oa-help" style="margin-top:10px"><summary>판정 기준 보기</summary>
      <ul><li><b>최적</b>: 상위 10개 중 제목에 키워드를 그대로 넣은 글이 0~3개 (월 검색 100 이상) — 키워드를 정확히 노린 경쟁 글이 적음</li>
      <li><b>가능</b>: 4~6개 · <b>어려움</b>: 7~8개 · <b>포화</b>: 9~10개 · <b>허수</b>: 월 검색 20 이하</li>
      <li>상위글 나이가 길수록(오래된 글이 상위) 새 글로 교체될 여지가 큽니다.</li>
      <li>검색 API의 정확도순 기준이라 실제 네이버 검색 화면 순서와 완전히 같지는 않습니다. 우선순위 참고용입니다.</li></ul></details>
  </div>`;
}
async function runKw(){
  if(BUSY) return;
  const raw=($("#oa-k")||{}).value||"", rel=parseInt(($("#oa-r")||{}).value,10)||0;
  const kws=[...new Set(raw.split(/[\n,]+/).map(s=>s.trim()).filter(s=>s.length>=2))].slice(0,20);
  const msg=t=>{ const m=$("#oa-msg"); if(m) m.textContent=t; };
  if(!kws.length) return msg("키워드를 한 개 이상 입력하세요.");
  let tok=null; try{ tok=(typeof CLOUD!=="undefined"&&CLOUD.sb)?(await CLOUD.sb.auth.getSession()).data.session?.access_token:null; }catch(e){}
  if(!tok) return msg("보잇에 로그인해야 쓸 수 있습니다.");
  BUSY=true; vKw(); $("#oa-k").value=raw;
  let r;
  try{ const res=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:tok,keywords:kws,related:rel})});
    const t=await res.text(); try{ r=JSON.parse(t); }catch(e){ r={ok:false,error:"서버 응답을 읽지 못했습니다. ("+res.status+") 잠시 후 다시 눌러 주세요."}; } }
  catch(e){ r={ok:false,error:"연결에 실패했습니다. 인터넷 연결을 확인해 주세요."}; }
  BUSY=false;
  if(r&&r.ok&&Array.isArray(r.rows)){ D().last={input:raw,related:rel,at:r.at||new Date().toISOString(),rows:r.rows}; vKw(); }
  else { vKw(); $("#oa-k").value=raw; msg((r&&r.error)||"조사하지 못했습니다."); }
}
function addPlan(r){ const P=D().plan; if(P.some(p=>p.keyword===r.keyword)) return false;
  P.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),keyword:r.keyword,verdict:r.verdict,search:r.search,ch:"블로그",date:"",st:"예정",no:"",url:"",memo:"",added:td()}); return true; }

/* ---------- 2. 콘텐츠 계획 ---------- */
function vPlan(){
  const B=$("#oa-body"), P=D().plan;
  const cnt=s=>P.filter(p=>p.st===s).length;
  P.sort((a,b)=>(ST.indexOf(a.st)-ST.indexOf(b.st))||String(a.date||"9").localeCompare(String(b.date||"9")));
  B.innerHTML=`<div class="oa-kpis">${ST.map(s=>`<div class="kpi"><span>${s}</span><b>${cnt(s)}<small>편</small></b></div>`).join("")}</div>
  <div class="panel" style="margin-top:14px">
    <h2 style="margin:0 0 4px">콘텐츠 계획</h2>
    <p class="note" style="margin:0 0 10px">예정 → 초안 → 심의중 → 발행 순서로 관리합니다. <b>심의번호를 넣어야 발행으로 바꿀 수 있습니다.</b> 같은 주제를 꾸준히 쓰면 블로그 주제 신뢰도(C-Rank)가 쌓입니다.</p>
    <div class="row" style="gap:8px;flex-wrap:wrap"><input id="oa-nk" placeholder="직접 추가할 키워드" maxlength="30" style="flex:1;min-width:180px"><button class="btn" type="button" id="oa-nadd">추가</button></div>
    ${P.length?`<div class="tbl-wrap" style="margin-top:12px"><table class="oa-t"><thead><tr><th>키워드</th><th>판정</th><th>채널</th><th>발행 예정일</th><th>상태</th><th>심의번호</th><th>발행 주소</th><th></th></tr></thead><tbody>
    ${P.map(p=>`<tr data-oap="${p.id}"><td><b>${E(p.keyword)}</b>${p.search?`<br><small class="note">월 ${fmt(p.search)}회</small>`:""}</td>
      <td>${p.verdict?`<b style="color:${VC[p.verdict]||"inherit"}">${E(p.verdict)}</b>`:"-"}</td>
      <td><select data-f="ch">${["블로그","카페"].map(c=>`<option ${p.ch===c?"selected":""}>${c}</option>`).join("")}</select></td>
      <td><input type="date" data-f="date" value="${E(p.date)}"></td>
      <td><select data-f="st">${ST.map(s=>`<option ${p.st===s?"selected":""}>${s}</option>`).join("")}</select></td>
      <td><input data-f="no" value="${E(p.no)}" placeholder="예) 2026-0806" maxlength="30" style="width:110px"></td>
      <td>${p.url?`<a href="${E(p.url)}" target="_blank" rel="noopener">열기</a> `:""}<input data-f="url" value="${E(p.url)}" placeholder="https://blog.naver.com/…" maxlength="300" style="width:150px"></td>
      <td><button class="btn sm" type="button" data-oadel="${p.id}" aria-label="삭제">삭제</button></td></tr>`).join("")}
    </tbody></table></div>`:`<p class="note" style="margin-top:12px">아직 계획이 없습니다. <b>블로그 키워드 조사</b>에서 키워드를 담아 오세요.</p>`}
  </div>`;
}

/* ---------- 3. 자동화 목록 ---------- */
function vMore(){
  const B=$("#oa-body");
  const L=[
    ["블로그 키워드 조사","네이버 월간 검색량 + 블로그 상위글 경쟁도로 쓸 키워드 고르기","사용 중","kw"],
    ["콘텐츠 계획","키워드별 발행일·심의번호·발행 주소 관리","사용 중","plan"],
    ["AI 블로그 초안","키워드로 네이버 상위노출·AI 브리핑 기준에 맞춘 심의 제출용 원고 만들기 (약관·공식자료 근거 표기)","준비중"],
    ["카페 글","블로그 글을 카페용(질문·후기형 금지, 정보형)으로 다시 쓰기","준비중"],
    ["이미지·썸네일","글 내용에 맞는 썸네일·본문 이미지, 끝에 필수기재 배너 자동 삽입","준비중"],
    ["발행 후 순위 확인","발행한 글이 키워드 검색에서 몇 위인지 주기적으로 확인","준비중"],
    ["네이버 로직 점검","2주마다 네이버 검색 정책·공지 변화를 확인해 글쓰기 기준 갱신","준비중"],
    ["인스타·쇼츠","블로그 글을 인스타 글·쇼츠 대본으로 바꾸기","준비중"]];
  B.innerHTML=`<div class="oa-grid">${L.map(([t,d,s,go])=>`<div class="panel oa-card"><div class="row between"><b>${t}</b><span class="pill" style="background:${s==="사용 중"?"var(--accent-soft)":"var(--surface-2,#f1f1f1)"};color:${s==="사용 중"?"var(--ok)":"var(--muted)"}">${s}</span></div><p class="note" style="margin:6px 0 0">${d}</p>${go?`<button class="btn sm" type="button" data-oat="${go}" style="margin-top:10px;align-self:flex-start">열기</button>`:""}</div>`).join("")}</div>`;
}

/* ---------- 이벤트 ---------- */
document.addEventListener("click",e=>{ const t=e.target; if(!t||!t.closest||!t.closest("#oa-root")) return;
  const tb=t.closest("[data-oat]"); if(tb){ TAB=tb.dataset.oat; render(); return; }
  if(t.closest("#oa-go")){ runKw(); return; }
  const a=t.closest("[data-oaadd]"); if(a){ const r=(D().last||{}).rows||[]; const x=r[+a.dataset.oaadd]; if(x){ addPlan(x); render(); } return; }
  if(t.closest("#oa-addall")){ const r=(D().last||{}).rows||[]; let n=0; r.filter(x=>x.verdict==="최적"||x.verdict==="가능").forEach(x=>{ if(addPlan(x)) n++; }); render(); const m=$("#oa-msg"); if(m) m.textContent=n?n+"개를 계획에 담았습니다.":"새로 담을 키워드가 없습니다."; return; }
  if(t.closest("#oa-nadd")){ const k=($("#oa-nk").value||"").trim().slice(0,30); if(k.length>=2){ addPlan({keyword:k,verdict:"",search:0}); render(); } return; }
  const d=t.closest("[data-oadel]"); if(d){ if(confirm("이 계획을 삭제할까요?")){ const P=D().plan; const i=P.findIndex(p=>p.id===d.dataset.oadel); if(i>=0) P.splice(i,1); render(); } return; }
});
document.addEventListener("change",e=>{ const t=e.target; if(!t||!t.closest) return; const tr=t.closest("[data-oap]"); if(!tr||!t.dataset.f) return;
  const p=D().plan.find(x=>x.id===tr.dataset.oap); if(!p) return; const f=t.dataset.f; let v=String(t.value||"").trim();
  if(f==="url"&&v&&!/^https?:\/\//.test(v)){ alert("주소는 https:// 로 시작해야 합니다."); t.value=p.url; return; }
  if(f==="st"&&v==="발행"&&!p.no){ alert("심의번호를 먼저 넣어 주세요. 보험 광고는 심의 후 게시해야 합니다."); t.value=p.st; return; }
  p[f]=v; if(f==="st"||f==="date") vPlan();
});
document.addEventListener("keydown",e=>{ if(e.key==="Enter"&&e.target&&e.target.id==="oa-nk"){ e.preventDefault(); const b=$("#oa-nadd"); if(b) b.click(); } });

const css=document.createElement("style"); css.textContent=`
.nav .grp[data-g="7"]{--g:var(--c5)}
.oa-rule{margin-top:12px;padding:10px 14px;border-radius:10px;background:var(--warn-soft);color:var(--warn);font-size:13.5px}.oa-rule b{color:inherit}
.oa-ta{width:100%;border:1px solid var(--line);border-radius:8px;padding:9px 11px;background:var(--surface);font:inherit;resize:vertical}
.oa-t td,.oa-t th{white-space:nowrap;vertical-align:middle}.oa-t td.num{text-align:right}
.oa-t input,.oa-t select{font:inherit;font-size:13.5px;padding:4px 6px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:inherit}
.oa-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.oa-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.oa-card{display:flex;flex-direction:column}
.oa-help summary{cursor:pointer;color:var(--muted);font-size:13.5px}.oa-help ul{margin:8px 0 0;padding-left:18px;font-size:13.5px;color:var(--muted);display:flex;flex-direction:column;gap:4px}
`; document.head.appendChild(css);

window.ONLINE={render};
if(document.readyState!=="loading") render(); else document.addEventListener("DOMContentLoaded",render);
})();
