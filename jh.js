/* 보잇 · 일반보험 › 중대재해·위험성평가 (2026-11-25 쉬운 화면으로 개편)
   근거(이 파일의 문장은 아래 자료에 있는 내용만 씀)
   - 중대재해 처벌 등에 관한 법률 제2조·제3조·제4조·제6조·제7조 / 시행령 제4조
   - 고용노동부 「중대재해처벌법 시행 안내서」, 「경영책임자와 관리자가 알아야 할 중대재해처벌법 따라하기」(경영방침 예시, 7대 위험요소),
     「중소기업을 위한 안전보건관리 자율점검표」 음식점업·도매 및 소매업 (업종별 위험·대책 문구, 음식점 사고사망 통계 2016~2020)
   - 상시근로자 산정: 아르바이트 등 고용형태 불문 포함, 근로기준법상 근로자가 아닌 사업주·특고는 제외, 기업 전체 합산 (대표 강의자료 Q&A, 고용노동부 FAQ 인용)
   - 산업안전보건법 제36조(위험성평가). 2026.2.19. 공포 개정법: 미실시 1천만원 이하, 근로자대표 참여·주지 위반 500만원 이하 과태료 (법률신문 2026.2.23 해설)
   - 고용노동부 보도자료 2026.11.4 「사업장 위험성평가에 관한 지침」 전부개정고시: 과태료 적용 50인 이상(건설 50억 이상) 2027.1.1, 50인 미만 2028.1.1
   - 고용노동부 「새로운 위험성평가 안내서」(2023.5): 상·중·하 3단계 판단, 공유·기록 3년
   - 근재 가입률 13.2%, 기업중대사고 배상 3.2% (보험연구원 2024 중소 제조기업 조사) · 보험은 형사책임을 대신하지 않음 */
(function(){
"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const td=()=>new Date(Date.now()+9*3600e3).toISOString().slice(0,10);

/* 사장님이 할 일 — 시행령 제4조 9가지를 쉬운 말로 (k: 원래 호, how: 이렇게, keep: 남길 기록) */
const TODO=[
 {k:"1호",t:"안전 약속 정하고 붙이기",how:"‘직원 안전을 가장 먼저 챙긴다’는 경영방침과 올해 목표를 한 장으로 정하고 가게에 붙입니다.",keep:"경영방침 1장 (점검표 3쪽에 예시 있음)"},
 {k:"2호",t:"안전 전담 부서 두기",how:"상시근로자 500명 이상 등 큰 기업만 해당합니다.",keep:"",big:500},
 {k:"3호",t:"위험 찾고 고치기 (반기 1회 이상)",how:"직원과 함께 다칠 수 있는 곳을 찾고 고칩니다. 위험성평가를 하고 그 절차대로 개선하면 이 의무를 한 것으로 봅니다.",keep:"위험성평가표 (③ 위험 찾기에서 작성)"},
 {k:"4호",t:"안전에 돈 쓰기",how:"찾은 위험을 고치는 데 필요한 예산을 정하고 씁니다. 금액보다 ‘위험을 고치는 데 썼는지’가 중요합니다.",keep:"미끄럼방지 매트·소화기·보호구 등 구입 영수증"},
 {k:"5호",t:"관리자에게 맡기고 반기 1회 평가",how:"점장·실장 등 안전을 챙길 사람을 정하고 권한·예산을 주고, 잘하고 있는지 반기 1회 평가합니다.",keep:"담당자 지정·평가 기록"},
 {k:"6호",t:"안전관리자·보건관리자 배치",how:"산업안전보건법상 두어야 하는 사업장만 해당합니다(업종·규모 기준).",keep:"",mid:true},
 {k:"7호",t:"직원 의견 듣기 (반기 1회)",how:"건의함, 단체 대화방, 작업 전 짧은 회의 등으로 ‘위험하다’는 의견을 받고 고쳤는지 확인합니다.",keep:"의견·조치 메모"},
 {k:"8호",t:"사고 나면 할 일 정해두기 (반기 1회 점검)",how:"작업 중지 → 직원 대피 → 위험요인 제거 → 다친 사람 구호 → 추가 피해 방지 순서를 정해 직원이 알게 합니다.",keep:"비상시 행동요령 1장 (점검표 3쪽)"},
 {k:"9호",t:"일 맡기는 업체 안전 확인",how:"배달대행·청소·인테리어 등 일을 맡길 때 그 업체의 안전관리 능력과 비용·기간 기준을 정합니다.",keep:"업체 선정 기준 메모",opt:true}];

/* 업종별로 흔한 위험 (고용노동부 업종별 자율점검표·따라하기 7대 위험요소의 문구를 줄여 씀) */
const BIZ={
 food:{n:"음식점·카페",note:"음식점 사고사망 109명 중 92명이 배달 이륜차 사고였습니다(2016~2020, 고용노동부 음식점업 자율점검표).",
  hz:[["조리실 바닥","물·기름에 미끄러져 넘어짐","미끄럼방지화 착용, 배수로 청소, ‘바닥 미끄럼주의’ 표지"],
   ["배달 이륜차","교통사고","안전모 지급·착용, 면허 확인, 음주·과로 시 운행 금지, 악천후 운행 제한"],
   ["가스레인지","가스 누출·화재","가스경보기·자동차단기 작동 확인, 호스 고정"],
   ["튀김기·국솥","화상","차열판 설치, 고정장치·가스 연결 상태 확인"],
   ["절단·혼합기 등 식품기계","끼임·베임","덮개(가드) 벗기지 않기, 운전 중 청소 금지, 헐거운 장갑 금지"],
   ["식기세척기","끼임·감전","비상정지 스위치·누전차단기 작동 확인, 주변 물기 제거"],
   ["배기후드 청소","떨어짐·감전","전원 차단 후 작업, 안전한 발판 사용, 2인 1조"]]},
 shop:{n:"마트·편의점·도소매",note:"도소매업 사망사고는 높은 곳 정리 중 떨어짐, 지게차·화물차 충돌, 사다리, 화물용 승강기 끼임이 주로 발생합니다(고용노동부 도소매업 자율점검표).",
  hz:[["진열대 높은 곳 정리","떨어짐","사다리 2인 1조, 미끄럼방지 사다리 사용, 안전모 착용"],
   ["물건 나르기","허리 부상","5kg 이상 물건에 ‘중량물 취급주의’ 표지, 올바른 들기 방법 교육"],
   ["지게차","부딪힘","운전 자격 확인, 후진경보기·경광등 점검, 작업 반경 출입 금지"],
   ["화물용 리프트","끼임·떨어짐","사람 탑승 금지, 안전문 연동장치 확인, 대상이면 정기 안전검사"],
   ["통로","걸려 넘어짐","통로에 물건 쌓지 않기, 밝게 유지, 통로 표시"],
   ["육절기 등 식품기계","끼임·베임","덮개 유지, 운전 중 청소 금지, 비상정지장치 확인"]]},
 svc:{n:"미용·서비스·사무실",note:"업종과 관계없이 상시근로자 5명 이상이면 적용됩니다.",
  hz:[["매장·사무실 바닥","미끄러져 넘어짐","바닥 물기 바로 닦기, 미끄럼주의 표지"],
   ["전기 콘센트","감전·화재","멀티탭을 오래 이어 쓰지 않기, 누전차단기 확인"],
   ["약품(염색약·세제 등)","피부·눈 손상, 흡입","무슨 물질인지 알고 쓰기, 장갑·환기"],
   ["사다리·의자 딛고 작업","떨어짐","의자 대신 사다리 사용, 2인 1조"],
   ["무거운 물건","허리 부상","나눠 들기, 올바른 들기 방법 교육"]]},
 mfg:{n:"제조·공장",note:"고용노동부는 고소작업, 시설관리, 전기, 지게차 등 기계, 정비 시 잠금, 화학물질, 밀폐공간을 흔한 7대 위험으로 꼽습니다.",
  hz:[["기계 정비·청소","끼임","운전을 멈추고 전원 잠금·‘작업 중’ 표지 후 작업"],
   ["회전·절단 기계","끼임·베임","덮개·울 설치, 방호장치 임의 해제 금지"],
   ["지게차","부딪힘","운전 자격 확인, 후진경보기, 작업 반경 출입 금지"],
   ["화학물질","중독·화상","무슨 물질인지 목록으로 관리, 보호구·환기"],
   ["높은 곳 작업","떨어짐","안전난간 설치, 안전모·안전대 착용"],
   ["전기 작업","감전","전원 차단 후 작업, 누전차단기 확인"]]},
 con:{n:"건설·인테리어",note:"2024.1.27.부터 공사금액과 관계없이 상시근로자 5명 이상이면 적용됩니다(본사와 모든 현장 합산).",
  hz:[["높은 곳·개구부","떨어짐","안전난간·덮개 설치, 안전모·안전대 착용"],
   ["사다리","떨어짐","2인 1조, 수평·견고한 바닥에 설치, 겹쳐 이어 쓰지 않기"],
   ["전동공구·전선","감전","누전차단기 사용, 피복 손상 전선 교체"],
   ["굴착기 등 장비","부딪힘·끼임","작업 반경 출입 금지, 신호수 배치"],
   ["자재 운반","허리 부상·맞음","나눠 들기, 적재물 고정"]]},
 etc:{n:"기타",note:"업종과 관계없이 상시근로자 5명 이상이면 적용됩니다.",hz:[]}};

const J={n:"",biz:"",bk:"food",staff:"",build:false,amt:"",st:{},sp:{},tab:1,rows:[]};
const ROW=()=>({w:"",h:"",c:"",lv:"",fix:"",who:"",due:""});

function judge(){
  const n=+String(J.staff).replace(/\D/g,"")||0, big=n>=50||(J.bk==="con"&&J.build&&(+J.amt||0)>=50), out=[];
  if(!J.staff) return null;
  out.push(n<5?["n","중대재해처벌법","직원 5명 미만이라 적용되지 않습니다(법 제3조)."]:["y","중대재해처벌법",`직원 ${n}명 — 적용 대상입니다. 5~49명 사업장도 2024.1.27.부터 적용되고 있습니다.`]);
  out.push(n>=1?["y","위험성평가",`직원이 있으면 인원과 관계없이 해야 합니다(산업안전보건법 제36조). 안 하면 과태료(1천만원 이하)가 ${big?"2027.1.1.":"2028.1.1."}부터 부과됩니다.`]:["q","위험성평가","직원이 없으면 해당 여부를 확인하세요."]);
  return {n,big,out};
}
const need=(x,n)=>x.big?n>=x.big:true;
const doneN=()=>{ const n=judge()?judge().n:0; return TODO.filter((x,i)=>need(x,n)&&J.sp[i]).length; };
const totN=()=>{ const n=judge()?judge().n:0; return TODO.filter(x=>need(x,n)).length; };

const css=`#jh-root{display:flex;flex-direction:column;gap:12px}
.jh-top{display:grid;grid-template-columns:1.1fr 1fr;gap:12px}.jh-top>.panel{margin:0}@media(max-width:1000px){.jh-top{grid-template-columns:1fr}}
.jh-in{display:grid;grid-template-columns:1.2fr 1fr .8fr;gap:8px}.jh-in label{font-size:12.5px;color:var(--muted);display:block;margin-bottom:3px}.jh-in input,.jh-in select{width:100%;box-sizing:border-box}
.jh-v{border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;font-size:14px}.jh-v.y{background:#FDECEC;border:1px solid #F3B9B9}.jh-v.n{background:#EAF6EF;border:1px solid #B5DEC5}.jh-v.q{background:#F3F5F7;border:1px solid var(--line)}
.jh-v b.big{font-size:19px}.jh-v p{margin:0;line-height:1.6}.jh-faq{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}.jh-faq span{font-size:12px;background:#fff;border:1px solid var(--line);border-radius:999px;padding:3px 9px}
.jh-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.jh-steps button{display:flex;align-items:center;gap:8px;border:1.5px solid var(--line);background:#fff;border-radius:12px;padding:10px 12px;text-align:left;cursor:pointer;font-size:14px}.jh-steps button i{font-style:normal;width:26px;height:26px;flex:none;border-radius:50%;background:#E4E9F2;color:#1F3A68;font-weight:700;display:inline-flex;align-items:center;justify-content:center}.jh-steps button small{display:block;color:var(--muted);font-size:11.5px}.jh-steps button[aria-pressed=true]{border-color:#1F3A68;background:#F2F5FB}.jh-steps button[aria-pressed=true] i{background:#1F3A68;color:#fff}
@media(max-width:800px){.jh-steps{grid-template-columns:1fr 1fr}}
.jh-todo{display:grid;grid-template-columns:1fr 1fr;gap:8px}@media(max-width:1000px){.jh-todo{grid-template-columns:1fr}}
.jh-todo label{display:grid;grid-template-columns:24px 1fr;gap:8px;border:1px solid var(--line);border-radius:12px;padding:10px 12px;cursor:pointer;background:#fff}.jh-todo label:has(input:checked){background:#EEF6F1;border-color:#9FD0B3}.jh-todo label.na{opacity:.55;cursor:default}
.jh-todo b{font-size:14.5px}.jh-todo p{margin:3px 0 0;font-size:12.5px;color:var(--ink2,#4b5260);line-height:1.55}.jh-todo em{font-style:normal;font-size:11.5px;color:var(--muted);margin-left:4px}.jh-todo .keep{display:inline-block;margin-top:5px;font-size:12px;color:#1F6B47;background:#E6F4EC;border-radius:6px;padding:2px 7px}.jh-todo input{width:18px;height:18px;margin-top:1px}
.jh-hz{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}.jh-hz button{border:1px solid var(--line);background:#fff;border-radius:12px;padding:10px 12px;text-align:left;cursor:pointer;font-size:13px;line-height:1.5}.jh-hz button b{display:block;font-size:14px}.jh-hz button span{color:var(--muted)}.jh-hz button.on{background:#EEF6F1;border-color:#9FD0B3}.jh-hz button.on b::after{content:" ✓ 추가됨";color:#1F6B47;font-size:12px}
.jh-flow{display:flex;flex-wrap:wrap;gap:6px;font-size:12.5px}.jh-flow span{background:#F2F5FB;border-radius:8px;padding:5px 9px}.jh-flow span b{color:#1F3A68}
.jh-tbl{overflow:auto}.jh-tbl table{width:100%;border-collapse:collapse;min-width:720px}.jh-tbl th{font-size:12px;color:var(--muted);text-align:left;padding:4px}.jh-tbl td{padding:3px;vertical-align:middle}.jh-tbl input{width:100%;padding:7px;font-size:13px;box-sizing:border-box}
.jh-lv{display:flex;gap:3px}.jh-lv button{flex:1;border:1px solid var(--line);background:#fff;border-radius:7px;padding:6px 0;font-size:12.5px;cursor:pointer}.jh-lv button.on[data-v="상"]{background:#D6453D;color:#fff;border-color:#D6453D}.jh-lv button.on[data-v="중"]{background:#E8A33D;color:#fff;border-color:#E8A33D}.jh-lv button.on[data-v="하"]{background:#3D9A6B;color:#fff;border-color:#3D9A6B}
.jh-x{border:0;background:none;color:var(--muted);cursor:pointer;font-size:16px}
.jh-pen{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.jh-pen div{border:1px solid var(--line);border-radius:10px;padding:10px;font-size:13px;background:#fff}.jh-pen b{display:block;font-size:14px;margin-bottom:2px}@media(max-width:900px){.jh-pen{grid-template-columns:1fr}}
.jh-nav{display:flex;justify-content:space-between;gap:8px;margin-top:4px}
.jh-pv{border:1px solid var(--line);border-radius:12px;background:#E9EDEB;padding:8px;overflow:auto;max-height:640px}.jh-pv .sheets{display:flex;flex-direction:row;flex-wrap:wrap;gap:14px;align-items:flex-start}body:not(.cap) .jh-pv .sheets{zoom:.5;margin:0}
.a4.jh h3{margin:0;font-size:23px}.a4.jh .ck{display:grid;grid-template-columns:22px 1fr;gap:4px 6px;font-size:12.5px;align-items:start}.a4.jh table.rt td,.a4.jh table.rt th{border:1px solid var(--pline);padding:6px 7px;font-size:12px;vertical-align:top;text-align:left}.a4.jh table.rt{border-collapse:collapse;width:100%}.a4.jh table.rt td{height:34px}.a4.jh .box{border:1px solid var(--pline);border-radius:8px;padding:12px 14px;font-size:13px;line-height:1.7}.a4.jh ol{margin:4px 0 0;padding-left:20px}`;

function render(){
  const root=$("#jh-root"); if(!root) return;
  if(!$("#jh-css")){ const s=document.createElement("style"); s.id="jh-css"; s.textContent=css; document.head.appendChild(s); }
  const T=[[1,"해당될까?","직원 수로 확인"],[2,"사장님이 할 일",`${doneN()}/${totN()||9} 완료`],[3,"위험 찾기",`${J.rows.filter(r=>r.h).length}개 작성`],[4,"점검표 받기","출력·PDF·문자"]];
  root.innerHTML=`
  <div class="jh-top">
    <div class="panel" style="display:flex;flex-direction:column;gap:10px">
      <h2 style="margin:0;font-size:16px">사업장 정보</h2>
      <div class="jh-in">
        <div><label>상호</label><input data-jh="n" value="${esc(J.n)}" placeholder="예: 행복분식" autocomplete="off"></div>
        <div><label>업종</label><select data-jhk>${Object.entries(BIZ).map(([k,v])=>`<option value="${k}"${J.bk===k?" selected":""}>${v.n}</option>`).join("")}</select></div>
        <div><label>직원 수 (알바 포함)</label><input data-jh="staff" inputmode="numeric" value="${esc(J.staff)}" placeholder="예: 7"></div>
      </div>
      ${J.bk==="con"?`<div class="row" style="gap:10px;flex-wrap:wrap;font-size:13px"><label class="row" style="gap:6px"><input type="checkbox" data-jhb="build" ${J.build?"checked":""}> 공사금액 확인</label>${J.build?`<label class="row" style="gap:6px">공사금액 <input data-jh="amt" inputmode="numeric" value="${esc(J.amt)}" style="width:80px" placeholder="억원"> 억원</label>`:""}</div>`:""}
      <div class="jh-faq"><span>알바·단시간·기간제 모두 포함</span><span>매장 여러 곳이면 모두 합산</span><span>사장님 본인·특고는 제외</span></div>
    </div>
    <div id="jh-res"></div>
  </div>
  <div class="jh-steps">${T.map(([k,t,s])=>`<button type="button" data-jht="${k}" aria-pressed="${J.tab===k}"><i>${k}</i><span>${t}<small>${s}</small></span></button>`).join("")}</div>
  <div class="panel" id="jh-body" style="display:flex;flex-direction:column;gap:12px;margin:0"></div>
  <p class="note" style="margin:0">기준: 중대재해처벌법·시행령, 산업안전보건법 제36조, 고용노동부 중대재해처벌법 시행 안내서·따라하기·업종별 자율점검표, 위험성평가 안내서(2023.5)·지침 전부개정 발표(2026.11.4.). 법적 판단이 아닌 점검용 자료입니다.</p>`;
  body(); verdict();
}
function verdict(){
  const r=judge(), el=$("#jh-res"); if(!el) return;
  if(!r){ el.innerHTML=`<div class="jh-v q" style="height:100%;box-sizing:border-box;justify-content:center"><b class="big">직원 수를 넣어 주세요</b><p>알바까지 포함한 직원 수만 넣으면 바로 적용 여부가 나옵니다.</p></div>`; return; }
  const y=r.n>=5;
  el.innerHTML=`<div class="jh-v ${y?"y":"n"}" style="height:100%;box-sizing:border-box">
    <b class="big">${y?"⚠ 중대재해처벌법 적용 대상입니다":"중대재해처벌법은 적용되지 않습니다"}</b>
    ${r.out.map(([s,n,t])=>`<p><b>${n}</b> · ${esc(t)}</p>`).join("")}
    ${y?`<p style="font-size:13px">사고가 나도 ‘할 일’을 미리 해 두었다면 처벌받지 않습니다. 아래 ② 사장님이 할 일을 하나씩 체크하세요.</p>`:""}</div>`;
}
function body(){
  const B=$("#jh-body"); if(!B) return; const r=judge(), n=r?r.n:0, bz=BIZ[J.bk]||BIZ.etc;
  const nav=(p,x)=>`<div class="jh-nav">${p?`<button class="btn" type="button" data-jht="${p}">← 이전</button>`:"<span></span>"}${x?`<button class="btn primary" type="button" data-jht="${x}">다음 →</button>`:""}</div>`;
  if(J.tab===1){
    B.innerHTML=`<h2 style="margin:0;font-size:16px">이 법, 왜 중요할까요?</h2>
    <div class="jh-pen">
      <div><b>사망 사고</b>대표(경영책임자) 1년 이상 징역 또는 10억원 이하 벌금 · 법인 50억원 이하 벌금 <span class="note">(법 제6조·제7조)</span></div>
      <div><b>6개월 이상 치료 부상자 2명 이상</b>7년 이하 징역 또는 1억원 이하 벌금 · 법인 10억원 이하 벌금 <span class="note">(같은 사고 기준, 법 제2조·제6조)</span></div>
      <div><b>위험성평가 안 하면</b>과태료 1천만원 이하 · 근로자대표 참여·결과 알림을 안 하면 500만원 이하 <span class="note">(개정 산업안전보건법)</span></div>
    </div>
    <div class="banner" style="display:flex;flex-direction:column;gap:6px"><b>핵심: 처벌은 ‘사고’가 아니라 ‘미리 할 일을 안 한 것’에 대한 것입니다</b><span style="font-size:13px;line-height:1.6">사장님이 해야 할 일(②)을 갖추고 실제로 했다면 사고가 나도 처벌받지 않습니다. 보험은 벌금·형사책임을 대신하지 못하고, 직원 사고의 <b>손해배상</b>을 준비하는 것입니다 — 산재보험과 함께 <b>근재보험(사용자배상책임)</b>을 점검하세요. 중소 제조기업 근재 가입률은 13.2%입니다(보험연구원 2024 조사).</span>
      <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn primary sm" type="button" id="jh-gi">근재 견적 요청서 만들기</button><a class="btn sm" href="https://www.koshasafety.co.kr/" target="_blank" rel="noopener">고용노동부 중대재해처벌법 자료실</a></div></div>
    ${nav(0,2)}`;
  } else if(J.tab===2){
    B.innerHTML=`<div class="row between"><h2 style="margin:0;font-size:16px">사장님이 할 일 <span class="note">${doneN()}/${totN()} 완료 · 한 것은 체크</span></h2><span class="note">중대재해처벌법 시행령 제4조</span></div>
    <div class="jh-todo">${TODO.map((x,i)=>{ const na=!need(x,n); return `<label class="${na?"na":""}"><input type="checkbox" data-jhsp="${i}" ${J.sp[i]&&!na?"checked":""} ${na?"disabled":""}><span><b>${esc(x.t)}</b><em>${x.k}${na?" · 해당 없음":x.mid?" · 대상일 때만":x.opt?" · 맡기는 일이 있을 때":""}</em><p>${esc(x.how)}</p>${x.keep&&!na?`<span class="keep">남길 기록: ${esc(x.keep)}</span>`:""}</span></label>`; }).join("")}</div>
    <p class="note" style="margin:0">‘반기 1회’ 항목은 점검했다는 기록(날짜·내용)을 남겨야 인정받습니다.</p>
    ${nav(1,3)}`;
  } else if(J.tab===3){
    const has=new Set(J.rows.map(r=>r.w+"|"+r.h));
    B.innerHTML=`<div class="row between"><h2 style="margin:0;font-size:16px">위험 찾기 — ${esc(bz.n)}</h2><span class="note">눌러서 평가표에 넣고, 위험도만 고르면 됩니다</span></div>
    <div class="jh-flow"><span><b>1</b> 직원과 함께 다칠 수 있는 곳 찾기</span><span><b>2</b> 위험도 상·중·하 고르기</span><span><b>3</b> ‘상’부터 작업 전에 고치기</span><span><b>4</b> 결과 붙이고 직원에게 알리기 · 3년 보관</span></div>
    ${bz.note?`<p class="note" style="margin:0">${esc(bz.note)}</p>`:""}
    ${bz.hz.length?`<div class="jh-hz">${bz.hz.map((h,i)=>`<button type="button" data-jhz="${i}" class="${has.has(h[0]+"|"+h[1])?"on":""}"><b>${esc(h[0])}</b><span>${esc(h[1])}</span><br>→ ${esc(h[2])}</button>`).join("")}</div>`:""}
    <div class="row between"><b style="font-size:14px">우리 가게 위험성평가표</b><button class="btn sm" type="button" id="jh-add">+ 직접 추가</button></div>
    ${J.rows.length?`<div class="jh-tbl"><table><thead><tr><th style="width:17%">어디서·무슨 일</th><th style="width:20%">어떤 위험</th><th style="width:15%">위험도</th><th style="width:30%">이렇게 고친다</th><th style="width:13%">언제까지</th><th style="width:5%"></th></tr></thead>
    <tbody>${J.rows.map((r,i)=>`<tr><td><input data-jhr="${i}:w" value="${esc(r.w)}" placeholder="예: 주방"></td><td><input data-jhr="${i}:h" value="${esc(r.h)}" placeholder="예: 미끄러짐"></td><td><div class="jh-lv">${["상","중","하"].map(v=>`<button type="button" data-jhl="${i}" data-v="${v}" class="${r.lv===v?"on":""}">${v}</button>`).join("")}</div></td><td><input data-jhr="${i}:fix" value="${esc(r.fix)}" placeholder="예: 미끄럼방지 매트"></td><td><input data-jhr="${i}:due" value="${esc(r.due)}" placeholder="예: 12/10"></td><td><button class="jh-x" type="button" data-jhdel="${i}" title="삭제">×</button></td></tr>`).join("")}</tbody></table></div>`:`<p class="note" style="margin:0">위 카드를 누르거나 ‘직접 추가’로 시작하세요.</p>`}
    <p class="note" style="margin:0">위험도: <b>상</b> 받아들일 수 없음(작업 전 바로 개선) · <b>중</b> 개선 계획 세우기 · <b>하</b> 지금처럼 관리. 더 자세히 하려면 <a href="https://kras.kosha.or.kr/" target="_blank" rel="noopener">안전보건공단 위험성평가 지원시스템(KRAS)</a>을 이용하세요.</p>
    ${nav(2,4)}`;
  } else {
    B.innerHTML=`<div class="row between" style="flex-wrap:wrap;gap:8px"><h2 style="margin:0;font-size:16px">사장님께 드릴 점검표 (A4 3장)</h2><div class="row" style="gap:6px"><button class="btn sm" type="button" id="jh-copy">안내 문자 복사</button><button class="btn" type="button" id="jh-print">출력</button><button class="btn primary" type="button" id="jh-pdf">PDF 다운로드</button></div></div>
    <p class="note" style="margin:0">1쪽 적용 여부·할 일 점검 · 2쪽 위험성평가표(서명란) · 3쪽 가게에 붙일 안전 경영방침과 비상시 행동요령</p>
    <span class="note" id="pdfmsg-jh"></span>
    <div class="jh-pv"><div class="sheets" id="sheets-jh"></div></div>
    ${nav(3,0)}`;
    sheet();
  }
}
function sheet(){
  const s=$("#sheets-jh"); if(!s) return;
  const r=judge(), me=typeof ME!=="undefined"?ME:{}, nm=J.n||"사업장", ck=v=>v?"☑":"☐", n=r?r.n:0;
  const rows=J.rows.filter(x=>Object.values(x).some(Boolean)), blank=Math.max(0,10-rows.length);
  const p1=`<div class="a4 jh"><div class="ph"><b>중대재해·위험성평가 점검표</b><span>${td()} 기준 · 1/3</span></div>
   <div><div style="font-size:11px;letter-spacing:.12em;color:var(--ink2)">SAFETY CHECK</div><h3>${esc(nm)} 안전보건 점검표</h3><p style="margin:4px 0 0;font-size:12.5px;color:var(--ink2)">${esc((BIZ[J.bk]||{}).n||"")}${J.staff?` · 직원 ${esc(J.staff)}명`:""} · 담당 ${esc(me.name||"")} ${esc(me.phone||"")}</p></div>
   <div class="sec"><div class="st">적용 여부</div>${r?r.out.map(([s2,nn,t])=>`<p class="pt"><b>${nn}: ${s2==="y"?"적용":s2==="q"?"확인 필요":"적용 제외"}</b> — ${esc(t)}</p>`).join(""):'<p class="pt">직원 수(알바 포함) 확인 필요</p>'}</div>
   <div class="sec"><div class="st">사장님이 할 일 (중대재해처벌법 시행령 제4조) <span>${doneN()}/${totN()}</span></div><div class="ck">${TODO.map((x,i)=>{ const na=!need(x,n); return `<span>${na?"－":ck(J.sp[i])}</span><span><b>${esc(x.t)}</b> (${x.k})${na?" · 해당 없음":` — ${esc(x.how)}`}</span>`; }).join("")}</div></div>
   <div class="sec"><div class="st">알아두세요</div>
    <p class="pt">사망사고 시 대표(경영책임자) 1년 이상 징역 또는 10억원 이하 벌금, 법인 50억원 이하 벌금(중대재해처벌법 제6조·제7조). 할 일을 미리 갖추고 실제로 했다면 처벌받지 않습니다.</p>
    <p class="pt">위험성평가를 하지 않으면 과태료(1천만원 이하)가 ${r?(r.big?"2027.1.1.":"2028.1.1."):"규모에 따라 2027.1.1. 또는 2028.1.1."}부터 부과됩니다.</p>
    <p class="pt">보험은 벌금·형사책임을 대신하지 못합니다. 직원 사고의 손해배상은 산재보험과 근재(사용자배상책임)보험으로 준비합니다.</p></div>
   <p style="margin:auto 0 0;font-size:10.5px;color:var(--ink2)">본 점검표는 입력 내용을 바탕으로 한 점검 자료이며 법적 판단이 아닙니다. 기준: 관계 법령, 고용노동부 안내서·업종별 자율점검표·위험성평가 안내서.</p></div>`;
  const p2=`<div class="a4 jh"><div class="ph"><b>위험성평가표</b><span>${td()} 기준 · 2/3</span></div>
   <div class="row between"><h3 style="font-size:20px">${esc(nm)} 위험성평가표</h3><span style="font-size:12px;color:var(--ink2)">평가일 ______ · 참여 직원 ____________</span></div>
   <table class="rt"><thead><tr><th style="width:17%">어디서·무슨 일</th><th style="width:23%">어떤 위험</th><th style="width:8%">위험도</th><th style="width:30%">이렇게 고친다</th><th style="width:10%">담당</th><th style="width:12%">언제까지</th></tr></thead>
   <tbody>${rows.map(x=>`<tr>${["w","h","lv","fix","who","due"].map(k=>`<td>${esc(x[k])}</td>`).join("")}</tr>`).join("")}${Array(blank).fill("<tr>"+"<td></td>".repeat(6)+"</tr>").join("")}</tbody></table>
   <p style="margin:0;font-size:11.5px;color:var(--ink2)">위험도: 상 = 받아들일 수 없음(작업 전 개선) · 중 = 개선 계획 · 하 = 지금처럼 관리 · 결과는 게시하고 작업 전 회의로 알리며, 새로 온 직원·작업이 바뀐 직원에게 작업 전에 알립니다 · 기록 3년 보관 · 반기 1회 이상 다시 점검</p>
   <div class="row between" style="margin-top:auto;font-size:12.5px"><span>대표 ____________ (서명)</span><span>근로자대표 ____________ (서명)</span></div></div>`;
  const p3=`<div class="a4 jh"><div class="ph"><b>안전 경영방침 · 비상시 행동요령</b><span>${td()} 기준 · 3/3</span></div>
   <h3 style="font-size:21px;text-align:center">${esc(nm)} 안전보건 경영방침</h3>
   <div class="box">${esc(nm)}은(는) 직원의 생명과 안전을 가장 먼저 생각하며, 법을 지키는 안전보건관리체계를 갖추어 모든 직원이 안전하게 일할 수 있도록 다음을 실천합니다.
    <ol><li>대표는 ‘직원의 생명 보호’와 ‘안전한 작업환경’을 경영의 최우선 목표로 삼습니다.</li><li>위험요인을 없애고 줄이는 데 필요한 사람과 예산을 지원합니다.</li><li>안전 목표를 정하고 실행 계획을 세워 지킵니다.</li><li>직원과 함께 위험요인을 찾고, 찾은 위험은 반드시 고치고 교육으로 알립니다.</li><li>일을 맡기는 업체도 우리 안전 기준을 지키도록 합니다.</li></ol>
    <p style="margin:10px 0 0">올해 안전 목표: ________________________________</p>
    <p style="margin:8px 0 0;text-align:right">${td().slice(0,4)}년 ___월 ___일 · 대표 ____________ (서명)</p></div>
   <h3 style="font-size:18px;margin-top:6px">사고가 나면 이렇게 합니다</h3>
   <div class="box"><ol style="margin:0"><li><b>작업을 멈춥니다</b></li><li><b>직원을 대피시킵니다</b></li><li><b>위험요인을 없앱니다</b></li><li><b>다친 사람을 구호합니다</b> — 119 신고</li><li><b>추가 피해를 막습니다</b></li></ol>
    <p style="margin:8px 0 0;font-size:12px">중대재해가 발생하면 지체 없이 관할 지방고용노동관서에 보고합니다(산업안전보건법 제54조).</p>
    <p style="margin:10px 0 0">대표 ____________ ☎ ______________ · 담당 ____________ ☎ ______________</p>
    <p style="margin:4px 0 0">가까운 병원 ______________ ☎ ______________</p></div>
   <p style="margin:auto 0 0;font-size:10.5px;color:var(--ink2)">경영방침은 고용노동부 「중대재해처벌법 따라하기」 예시를 줄여 쓴 것입니다. 사업장에 맞게 고쳐 쓰고 직원이 보는 곳에 붙이세요. 비상시 행동요령은 반기 1회 이상 점검합니다(시행령 제4조 제8호).</p></div>`;
  s.innerHTML=p1+p2+p3;
}
function paint(){ verdict(); const tb=$$("#jh-root .jh-steps small"); if(tb.length===4){ tb[1].textContent=`${doneN()}/${totN()} 완료`; tb[2].textContent=`${J.rows.filter(r=>r.h).length}개 작성`; } if(J.tab===4) sheet(); }
function smsText(){ const r=judge(), me=typeof ME!=="undefined"?ME:{};
  return `${J.n?J.n+" ":""}사장님, 위험성평가 안내드립니다.\n직원이 있는 사업장은 위험성평가가 의무이고, ${r?(r.big?"2027.1.1.":"2028.1.1."):"규모에 따라 2027·2028년"}부터 안 하면 과태료(1천만원 이하)가 부과됩니다.${r&&r.n>=5?"\n직원 5명 이상이라 중대재해처벌법도 적용됩니다. 미리 할 일을 갖춰 두면 사고가 나도 처벌받지 않습니다.":""}\n점검표와 평가표 작성을 도와드리겠습니다.\n${me.name||""} ${me.phone||""}`.trim(); }
const msg=t=>{ const m=$("#pdfmsg-jh"); if(m) m.textContent=t; };
const cap=(el)=>(typeof capCanvas==="function"?capCanvas:html2canvas)(el,{scale:2,backgroundColor:"#ffffff",useCORS:true});

document.addEventListener("input",e=>{ const t=e.target; if(!t.closest||!t.closest("#jh-root")) return;
  if(t.dataset.jh){ J[t.dataset.jh]=t.value; if(t.dataset.jh==="staff"&&J.tab===2) body(); paint(); return; }
  if(t.dataset.jhr){ const [i,k]=t.dataset.jhr.split(":"); J.rows[+i][k]=t.value; paint(); return; } });
document.addEventListener("change",e=>{ const t=e.target; if(!t.closest||!t.closest("#jh-root")) return;
  if(t.dataset.jhk!=null){ J.bk=t.value; render(); return; }
  if(t.dataset.jhb){ J[t.dataset.jhb]=t.checked; render(); return; }
  if(t.dataset.jhsp!=null){ J.sp[t.dataset.jhsp]=t.checked; body(); paint(); return; } });
document.addEventListener("click",async e=>{ const t=e.target;
  if(t.closest&&t.closest('[data-lb="sapa"]')){ if(!$("#jh-root").children.length) render(); return; }
  if(!t.closest||!t.closest("#jh-root")) return;
  const tb=t.closest("[data-jht]"); if(tb){ J.tab=+tb.dataset.jht; render(); return; }
  const hz=t.closest("[data-jhz]"); if(hz){ const h=(BIZ[J.bk]||BIZ.etc).hz[+hz.dataset.jhz]; const k=J.rows.findIndex(r=>r.w===h[0]&&r.h===h[1]);
    if(k>=0) J.rows.splice(k,1); else J.rows.push(Object.assign(ROW(),{w:h[0],h:h[1],fix:h[2]})); body(); paint(); return; }
  const lv=t.closest("[data-jhl]"); if(lv){ const r=J.rows[+lv.dataset.jhl]; r.lv=r.lv===lv.dataset.v?"":lv.dataset.v; body(); paint(); return; }
  const dl=t.closest("[data-jhdel]"); if(dl){ J.rows.splice(+dl.dataset.jhdel,1); body(); paint(); return; }
  if(t.closest("#jh-add")){ J.rows.push(ROW()); body(); paint(); return; }
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
