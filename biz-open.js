/* 보잇 · 소상공인 개척 (2026-11-11)
   설계사가 동네 사장님을 만나 마케팅 도움으로 신뢰를 쌓고, 사업장 위험 점검으로 이어가는 도구 모음.
   탭: 개척 가게 / 가게 진단 리포트 / 소식글·리뷰 답글 / 리뷰 요청 QR / 접촉 문구 / 지원사업 바로가기
   저장: ME.bo (app_state 클라우드 저장에 포함)
   원칙
   - 진단 숫자는 설계사가 휴대폰으로 확인한 값(또는 사장님 응답)을 넣는다. 네이버 자동 수집은 하지 않는다.
   - 허위·대가성 리뷰는 만들지 않는다. 리뷰 요청은 실제 손님에게만, 좋은 리뷰를 조건으로 혜택을 걸지 않는다.
   - 마케팅 도움을 보험 가입 조건으로 제공하지 않는다 (보험업법 제98조 특별이익 제공 금지).
*/
(function(){
"use strict";
const $=s=>document.querySelector(s);
const E=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const td=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const N=v=>{const n=parseInt(String(v==null?"":v).replace(/[^\d]/g,""),10);return isNaN(n)?null:n;};
const daysAgo=d=>{ if(!/^\d{4}-\d{2}-\d{2}$/.test(d||"")) return null; return Math.round((new Date(td())-new Date(d))/864e5); };
const meName=()=>{ try{ return (ME&&ME.name)||"담당 설계사"; }catch(e){ return "담당 설계사"; } };
const mePhone=()=>{ try{ return (ME&&ME.phone)||""; }catch(e){ return ""; } };

const STAGES=[
  ["후보","찾아갈 가게"],["진단 전달","리포트 드림"],["도움 진행","첫 달 도움"],["관리 중","계속 관리"],["사업장 점검","보험 점검 상담"],["소개","다른 가게 소개"],["보류","지금은 아님"]
];
const BIZ=["식당·카페","미용·네일·피부","학원·교육","인테리어·청소","병의원·약국","판매·서비스","숙박","제조·공장","기타"];
const INFO=[["hours","영업시간·휴무일"],["menu","메뉴·가격"],["photo","최근 사진(3개월 이내)"],["book","예약·톡톡·주문 연결"],["news","소식글(최근 2주)"],["cat","업종 카테고리 구체적"]];

function D(){ try{ if(!ME.bo||!Array.isArray(ME.bo.shops)) ME.bo={shops:[]}; return ME.bo; }catch(e){ window.__BO=window.__BO||{shops:[]}; return window.__BO; } }
const shopBy=id=>D().shops.find(s=>s.id===id);
let TAB="shops", CUR=null, DI=null; /* DI: 진단 입력 중인 가게 id */

/* ---------- 틀 ---------- */
function root(){ return $("#bo-root"); }
function render(){
  const R=root(); if(!R) return;
  const T=[["shops","개척 가게"],["diag","가게 진단 리포트"],["write","소식글·리뷰 답글"],["qr","리뷰 요청 QR"],["talk","접촉 문구"],["fund","지원사업 바로가기"]];
  R.innerHTML=`<div class="tabs">${T.map(([k,t])=>`<button class="btn" type="button" data-bot="${k}" aria-pressed="${TAB===k}">${t}</button>`).join("")}</div>
  <div class="bo-rule">마케팅 도움은 <b>보험 가입과 무관하게</b> 드립니다. 가입을 조건으로 무료 도움·혜택을 약속하면 특별이익 제공(보험업법 제98조)이 될 수 있습니다. · 가짜 리뷰는 만들지 않습니다.</div>
  <div id="bo-body" style="margin-top:14px"></div>`;
  ({shops:vShops,diag:vDiag,write:vWrite,qr:vQr,talk:vTalk,fund:vFund}[TAB]||vShops)();
}

/* ---------- 1. 개척 가게 ---------- */
function vShops(){
  const B=$("#bo-body"), L=D().shops;
  const cnt=k=>L.filter(s=>s.stage===k).length;
  if(CUR&&shopBy(CUR)) return vShop(shopBy(CUR));
  B.innerHTML=`<div class="bo-kpis">${STAGES.slice(0,6).map(([k,d])=>`<div class="kpi"><span>${k}</span><b>${cnt(k)}<small>곳</small></b></div>`).join("")}</div>
  <div class="panel" style="margin-top:14px">
    <h2 style="margin:0 0 10px">가게 추가</h2>
    <div class="fgrid">
      <div class="field"><label for="bo-n">상호</label><input id="bo-n" placeholder="예) 다온식당" maxlength="40"></div>
      <div class="field"><label for="bo-b">업종</label><select id="bo-b">${BIZ.map(b=>`<option>${b}</option>`).join("")}</select></div>
      <div class="field"><label for="bo-a">지역·주소</label><input id="bo-a" placeholder="예) 아산시 탕정면" maxlength="80"></div>
      <div class="field"><label for="bo-o">사장님 이름</label><input id="bo-o" maxlength="20" placeholder="선택"></div>
      <div class="field"><label for="bo-p">사장님 연락처</label><input id="bo-p" inputmode="tel" maxlength="13" placeholder="선택"></div>
      <div class="field"><label for="bo-u">네이버 플레이스 주소</label><input id="bo-u" placeholder="선택" maxlength="300"></div>
    </div>
    <div class="row" style="margin-top:10px;gap:8px"><button class="btn primary" type="button" id="bo-add">추가</button><span class="note" id="bo-msg"></span></div>
    <p class="note" style="margin:10px 0 0">처음엔 내 생활권 2km 안, 사장님이 직접 계산대를 보는 가게 5곳부터 시작하는 것이 좋습니다.</p>
  </div>
  <div class="panel" style="margin-top:14px">
    <div class="row between"><h2 style="margin:0">개척 가게 ${L.length}곳</h2><input id="bo-q" placeholder="상호·지역 검색" style="max-width:220px;border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:var(--surface)"></div>
    <div class="tbl-wrap" style="margin-top:10px"><table><thead><tr><th>상호</th><th>업종</th><th>지역</th><th>단계</th><th>진단</th><th>최근 기록</th></tr></thead><tbody id="bo-list"></tbody></table></div>
  </div>`;
  list();
}
function list(){
  const q=(($("#bo-q")||{}).value||"").trim(), L=D().shops.filter(s=>!q||(s.name+" "+(s.area||"")).includes(q));
  const tb=$("#bo-list"); if(!tb) return;
  tb.innerHTML=L.length?L.map(s=>{ const lg=(s.log||[])[0];
    return `<tr><td><button class="lnk" type="button" data-boopen="${s.id}"><b>${E(s.name)}</b></button></td><td>${E(s.biz)}</td><td>${E(s.area||"")}</td><td><span class="pill ${s.stage==="보류"?"ex":s.stage==="후보"?"warn":"ok"}">${E(s.stage)}</span></td><td class="num">${(s.diag||[]).length}회</td><td class="note">${lg?E(lg.date+" "+lg.text):""}</td></tr>`; }).join("")
    :`<tr><td colspan="6" class="empty">아직 가게가 없습니다. 위에서 추가하세요.</td></tr>`;
}
function addShop(){
  const n=$("#bo-n").value.trim(); if(!n){ $("#bo-msg").textContent="상호를 입력하세요."; return; }
  const s={id:"s"+Date.now().toString(36),name:n,biz:$("#bo-b").value,area:$("#bo-a").value.trim(),owner:$("#bo-o").value.trim(),phone:$("#bo-p").value.trim(),place:$("#bo-u").value.trim(),stage:"후보",created:td(),diag:[],log:[{date:td(),text:"후보 등록"}]};
  D().shops.unshift(s); $("#bo-msg").textContent=n+" 추가됨"; ["#bo-n","#bo-a","#bo-o","#bo-p","#bo-u"].forEach(x=>$(x).value=""); list(); vShopsKpi();
}
function vShopsKpi(){ if(TAB==="shops"&&!CUR) vShops(); }

function vShop(s){
  const B=$("#bo-body"); const dg=s.diag||[];
  B.innerHTML=`<div class="row" style="gap:8px"><button class="btn sm" type="button" id="bo-back">← 목록</button></div>
  <div class="panel" style="margin-top:12px">
    <div class="row between" style="align-items:flex-start;flex-wrap:wrap;gap:10px">
      <div><h2 style="margin:0">${E(s.name)}</h2><p class="note" style="margin:4px 0 0">${E(s.biz)} · ${E(s.area||"지역 미입력")}${s.owner?" · 사장님 "+E(s.owner):""}${s.phone?` · <a href="tel:${E(s.phone.replace(/\D/g,""))}">${E(s.phone)}</a>`:""}${s.place?` · <a href="${E(s.place)}" target="_blank" rel="noopener">플레이스 열기</a>`:""}</p></div>
      <div class="row" style="gap:6px;flex-wrap:wrap">
        <button class="btn primary sm" type="button" data-bodiag="${s.id}">진단 입력</button>
        ${dg.length?`<button class="btn sm" type="button" data-boprint="${s.id}">리포트 출력</button>`:""}
        <button class="btn sm" type="button" data-boqr="${s.id}">리뷰 QR</button>
        <button class="btn sm" type="button" data-bocust="${s.id}">고객(가망) 등록</button>
        <button class="btn sm" type="button" data-boliab="1">사업장 보험 점검</button>
        <button class="btn sm" type="button" data-bodel="${s.id}" style="color:var(--bad)">삭제</button>
      </div>
    </div>
    <div style="margin-top:14px"><div class="note" style="margin-bottom:6px">단계</div><div class="seg">${STAGES.map(([k,d])=>`<button class="btn sm" type="button" data-bostage="${k}" aria-pressed="${s.stage===k}" title="${d}">${k}</button>`).join("")}</div></div>
  </div>
  <div class="panel" style="margin-top:14px">
    <h2 style="margin:0 0 10px">진단 기록</h2>
    ${dg.length?`<div class="tbl-wrap"><table><thead><tr><th>날짜</th><th>대표 키워드 순위</th><th>방문자 리뷰</th><th>블로그 리뷰</th><th>기본정보</th></tr></thead><tbody>${dg.map((d,i)=>`<tr><td>${E(d.date)}${i===0&&dg.length>1?' <span class="pill ok">최근</span>':""}</td><td>${(d.kw||[]).filter(k=>k.k).map(k=>E(k.k)+" "+(k.r?k.r+"위":"순위밖")).join(" · ")||"-"}</td><td class="num">${d.rv&&d.rv.visit!=null?d.rv.visit:"-"}</td><td class="num">${d.rv&&d.rv.blog!=null?d.rv.blog:"-"}</td><td>${infoScore(d)}/${INFO.length}</td></tr>`).join("")}</tbody></table></div>`:`<p class="note" style="margin:0">아직 진단 기록이 없습니다. [진단 입력]으로 시작하세요.</p>`}
  </div>
  <div class="panel" style="margin-top:14px">
    <h2 style="margin:0 0 10px">활동 기록</h2>
    <div class="row" style="gap:8px"><input id="bo-lg" placeholder="예) 진단 리포트 전달, 3일 뒤 재방문" style="flex:1;border:1px solid var(--line);border-radius:8px;padding:9px 11px;background:var(--surface)"><button class="btn" type="button" id="bo-lgadd">기록</button></div>
    <ul class="bo-log">${(s.log||[]).map(l=>`<li><span class="num">${E(l.date)}</span> ${E(l.text)}</li>`).join("")}</ul>
  </div>`;
}
const infoScore=d=>INFO.filter(([k])=>d.info&&d.info[k]==="있음").length;

/* ---------- 2. 진단 리포트 ---------- */
function vDiag(){
  const B=$("#bo-body"), L=D().shops;
  if(!L.length){ B.innerHTML=`<div class="panel"><p class="note" style="margin:0">먼저 [개척 가게]에서 가게를 추가하세요.</p></div>`; return; }
  const s=shopBy(DI)||L[0]; DI=s.id; const last=(s.diag||[])[0]||{};
  const kw=(last.kw||[]).concat([{},{},{}]).slice(0,3), comp=(last.comp||[]).concat([{},{},{}]).slice(0,3);
  B.innerHTML=`<div class="panel">
    <div class="fgrid"><div class="field"><label for="dg-shop">진단할 가게</label><select id="dg-shop">${L.map(x=>`<option value="${x.id}" ${x.id===s.id?"selected":""}>${E(x.name)} (${E(x.biz)})</option>`).join("")}</select></div>
    <div class="field"><label for="dg-date">확인한 날짜</label><input id="dg-date" value="${td()}" data-date maxlength="10"></div></div>
    <p class="note" style="margin:10px 0 0">휴대폰 네이버 앱에서 키워드를 검색해 <b>플레이스 목록에서 몇 번째인지</b> 세어 적으세요. 광고 표시가 붙은 칸은 빼고 셉니다. 20위 밖이면 비워두세요.</p>
  </div>
  <div class="panel" style="margin-top:14px"><h2 style="margin:0 0 10px">① 검색 순위 (손님이 찾는 키워드 3개)</h2>
    ${kw.map((k,i)=>`<div class="fgrid2" style="margin-top:${i?8:0}px"><div class="field"><label>키워드 ${i+1}</label><input data-kw="${i}" value="${E(k.k||"")}" placeholder="${i===0?"예) 탕정 파스타":i===1?"예) 아산 맛집":"예) 탕정 데이트"}"></div><div class="field"><label>몇 번째</label><input data-kwr="${i}" inputmode="numeric" value="${k.r||""}" placeholder="순위"></div></div>`).join("")}
  </div>
  <div class="panel" style="margin-top:14px"><h2 style="margin:0 0 10px">② 리뷰 현황</h2>
    <div class="fgrid"><div class="field"><label for="dg-v">우리 가게 방문자 리뷰</label><input id="dg-v" inputmode="numeric" value="${last.rv&&last.rv.visit!=null?last.rv.visit:""}"></div><div class="field"><label for="dg-b">우리 가게 블로그 리뷰</label><input id="dg-b" inputmode="numeric" value="${last.rv&&last.rv.blog!=null?last.rv.blog:""}"></div><div class="field"><label for="dg-l">가장 최근 리뷰 날짜</label><input id="dg-l" data-date maxlength="10" value="${E(last.rv&&last.rv.last||"")}" placeholder="20261101"></div></div>
    <p class="note" style="margin:12px 0 6px">비교할 근처 가게 (키워드 1의 상위 가게)</p>
    ${comp.map((c,i)=>`<div class="fgrid" style="margin-top:${i?6:0}px"><div class="field"><input data-cn="${i}" value="${E(c.name||"")}" placeholder="경쟁 가게 ${i+1} 이름"></div><div class="field"><input data-cv="${i}" inputmode="numeric" value="${c.visit!=null?c.visit:""}" placeholder="방문자 리뷰"></div><div class="field"><input data-cb="${i}" inputmode="numeric" value="${c.blog!=null?c.blog:""}" placeholder="블로그 리뷰"></div></div>`).join("")}
  </div>
  <div class="panel" style="margin-top:14px"><h2 style="margin:0 0 10px">③ 기본 정보 · ④ 광고</h2>
    ${INFO.map(([k,t])=>`<div class="row between bo-chk"><span>${t}</span><div class="seg">${["있음","없음","모름"].map(v=>`<button class="btn sm" type="button" data-info="${k}" data-v="${v}" aria-pressed="${((last.info||{})[k]||"")===v}">${v}</button>`).join("")}</div></div>`).join("")}
    <div class="row between bo-chk"><span>네이버 검색광고(파워링크·플레이스광고)</span><div class="seg">${["하는 중","안 함","모름"].map(v=>`<button class="btn sm" type="button" data-ad="${v}" aria-pressed="${(last.ad||"")===v}">${v}</button>`).join("")}</div></div>
    <div class="field" style="margin-top:10px"><label for="dg-note">눈에 띈 점 (선택)</label><textarea id="dg-note" rows="2" placeholder="예) 대표 사진이 어둡고 겨울 메뉴 사진 없음">${E(last.note||"")}</textarea></div>
  </div>
  <div class="row" style="margin-top:14px;gap:8px"><button class="btn primary" type="button" id="dg-save">저장하고 리포트 보기</button><span class="note" id="dg-msg"></span></div>
  <div id="dg-out" style="margin-top:14px"></div>`;
  DG.info=Object.assign({},last.info||{}); DG.ad=last.ad||"";
  if((s.diag||[]).length) $("#dg-out").innerHTML=reportHTML(s,true);
}
const DG={info:{},ad:""};
function saveDiag(){
  const s=shopBy($("#dg-shop").value); if(!s) return;
  const kw=[0,1,2].map(i=>({k:($(`[data-kw="${i}"]`).value||"").trim(),r:N($(`[data-kwr="${i}"]`).value)})).filter(k=>k.k);
  if(!kw.length){ $("#dg-msg").textContent="키워드를 하나 이상 넣으세요."; return; }
  const comp=[0,1,2].map(i=>({name:($(`[data-cn="${i}"]`).value||"").trim(),visit:N($(`[data-cv="${i}"]`).value),blog:N($(`[data-cb="${i}"]`).value)})).filter(c=>c.name);
  const d={date:$("#dg-date").value||td(),kw,rv:{visit:N($("#dg-v").value),blog:N($("#dg-b").value),last:$("#dg-l").value||""},comp,info:Object.assign({},DG.info),ad:DG.ad,note:$("#dg-note").value.trim()};
  s.diag=s.diag||[]; s.diag.unshift(d); s.log=s.log||[]; s.log.unshift({date:td(),text:(s.diag.length>1?"애프터":"첫")+" 진단 기록"});
  $("#dg-msg").textContent="저장됨"; $("#dg-out").innerHTML=reportHTML(s,true);
  $("#dg-out").scrollIntoView({behavior:"smooth"});
}
const avg=a=>{ const v=a.filter(x=>x!=null); return v.length?Math.round(v.reduce((p,c)=>p+c,0)/v.length):null; };
function advice(d,s){
  const out=[]; const best=Math.min(...(d.kw||[]).map(k=>k.r||99));
  const cv=avg((d.comp||[]).map(c=>c.visit)), cb=avg((d.comp||[]).map(c=>c.blog));
  const miss=INFO.filter(([k])=>d.info&&d.info[k]==="없음").map(([,t])=>t);
  const lastAgo=daysAgo(d.rv&&d.rv.last);
  if(miss.length) out.push(["기본 정보부터 채우기",`${miss.join(", ")} 항목이 비어 있습니다. 정보가 빠진 가게는 손님이 그냥 지나칩니다. 오늘 바로 채울 수 있는 가장 쉬운 개선입니다.`]);
  if(cv!=null&&d.rv&&d.rv.visit!=null&&d.rv.visit<cv) out.push(["실제 손님 리뷰가 쌓이는 동선 만들기",`방문자 리뷰가 근처 가게 평균(${cv}개)보다 ${cv-d.rv.visit}개 적습니다. 계산대·테이블에 리뷰 요청 QR을 두고, 리뷰마다 답글을 달아 주세요. 좋은 리뷰를 조건으로 혜택을 주지는 않습니다.`]);
  if(lastAgo!=null&&lastAgo>30) out.push(["리뷰가 멈춘 가게로 보이지 않게",`가장 최근 리뷰가 ${lastAgo}일 전입니다. 최근 리뷰가 없으면 손님은 영업을 안 하는 가게로 느낍니다. 소식글을 주 1회 올리고 리뷰 요청을 시작하세요.`]);
  if(best>5) out.push(["대표 키워드에서 눈에 띄기",best===99?"넣은 키워드에서 20위 안에 보이지 않습니다. 업종 카테고리를 구체적으로 바꾸고(예: 음식점 → 파스타 전문점), 메뉴명에 손님이 검색하는 말을 넣어 보세요.":`대표 키워드 최고 순위가 ${best}위입니다. 업종 카테고리·메뉴명·소식글에 손님이 검색하는 말을 꾸준히 넣으면 노출에 도움이 됩니다.`]);
  if(cb!=null&&d.rv&&d.rv.blog!=null&&d.rv.blog<cb) out.push(["블로그에서 우리 가게 이야기 늘리기",`블로그 리뷰가 근처 평균(${cb}개)보다 적습니다. 가게 소개 글을 직접 올리거나, 체험 협찬을 할 때는 글 첫머리에 '광고·협찬' 표시를 꼭 넣게 하세요.`]);
  if(d.ad==="안 함"&&best>3) out.push(["소액 검색광고 검토","하루 몇천 원 단위의 소액으로 핵심 키워드 노출을 시험해 볼 수 있습니다. 광고 계정과 결제는 사장님 명의로 합니다."]);
  if(d.ad==="하는 중") out.push(["광고 키워드 점검","광고를 하고 있다면 실제 문의로 이어지지 않는 키워드에 돈이 새고 있지 않은지 함께 점검해 보세요."]);
  if(!out.length) out.push(["지금 상태 유지하기","기본이 잘 되어 있습니다. 소식글과 리뷰 답글을 꾸준히 이어가는 것이 가장 중요합니다."]);
  return out.slice(0,3);
}
function reportHTML(s,screen){
  const d=s.diag[0], prev=s.diag[1]; const cv=avg((d.comp||[]).map(c=>c.visit)), cb=avg((d.comp||[]).map(c=>c.blog));
  const cmp=(a,b)=>prev&&a!=null&&b!=null?(a===b?"":` <small style="color:${a>b?"#1E9E5A":"#D93A3F"}">(${a>b?"+":""}${a-b})</small>`):"";
  const pkw=k=>prev&&(prev.kw||[]).find(x=>x.k===k.k);
  const adv=advice(d,s);
  const body=`<div class="bo-a4">
    <div class="bo-h"><div><small>가게 진단 리포트${prev?" · 전후 비교":""}</small><h1>${E(s.name)}</h1><p>${E(s.biz)} · ${E(s.area||"")} · 확인일 ${E(d.date)}${prev?` (이전 ${E(prev.date)})`:""}</p></div></div>
    <h3>① 손님이 검색할 때 우리 가게는 몇 번째?</h3>
    <table><tr><th>키워드</th><th>순위</th>${prev?"<th>이전</th>":""}</tr>${(d.kw||[]).map(k=>{const p=pkw(k);return `<tr><td>${E(k.k)}</td><td><b>${k.r?k.r+"위":"20위 밖"}</b></td>${prev?`<td>${p?(p.r?p.r+"위":"20위 밖"):"-"}</td>`:""}</tr>`;}).join("")}</table>
    <h3>② 리뷰는 근처 가게와 비교해 어떤가?</h3>
    <table><tr><th></th><th>방문자 리뷰</th><th>블로그 리뷰</th></tr>
      <tr class="mine"><td><b>${E(s.name)}</b></td><td><b>${d.rv.visit!=null?d.rv.visit:"-"}</b>${prev?cmp(d.rv.visit,prev.rv&&prev.rv.visit):""}</td><td><b>${d.rv.blog!=null?d.rv.blog:"-"}</b>${prev?cmp(d.rv.blog,prev.rv&&prev.rv.blog):""}</td></tr>
      ${(d.comp||[]).map(c=>`<tr><td>${E(c.name)}</td><td>${c.visit!=null?c.visit:"-"}</td><td>${c.blog!=null?c.blog:"-"}</td></tr>`).join("")}
      ${cv!=null||cb!=null?`<tr><td>근처 평균</td><td>${cv!=null?cv:"-"}</td><td>${cb!=null?cb:"-"}</td></tr>`:""}
    </table>
    ${d.rv.last?`<p class="sm">가장 최근 리뷰: ${E(d.rv.last)}${daysAgo(d.rv.last)!=null?` (${daysAgo(d.rv.last)}일 전)`:""}</p>`:""}
    <h3>③ 손님이 보는 기본 정보</h3>
    <div class="chips">${INFO.map(([k,t])=>{const v=(d.info||{})[k]||"모름";return `<span class="${v==="있음"?"y":v==="없음"?"n":"u"}">${v==="있음"?"✓":v==="없음"?"✕":"?"} ${t}</span>`;}).join("")}</div>
    <h3>④ 광고</h3><p class="sm">네이버 검색광고: <b>${E(d.ad||"모름")}</b></p>
    ${d.note?`<p class="sm">눈에 띈 점: ${E(d.note)}</p>`:""}
    <h3>바로 할 수 있는 개선 ${adv.length}가지</h3>
    <ol class="adv">${adv.map(([t,x])=>`<li><b>${E(t)}</b><span>${E(x)}</span></li>`).join("")}</ol>
    <div class="bo-f">사장님 가게가 지금 놓치고 있는 기회를 정리했습니다. 이 리포트는 무료이며, 받아보신 뒤 아무것도 하지 않으셔도 됩니다. 궁금한 점은 편하게 연락 주세요.<br><b>${E(meName())}</b>${mePhone()?" · "+E(mePhone()):""}<br><small>순위·리뷰 수는 확인일 기준 휴대폰 검색 결과이며 시간·위치에 따라 달라질 수 있습니다.</small></div>
  </div>`;
  return screen?`<div class="panel"><div class="row between"><h2 style="margin:0">리포트 미리보기</h2><div class="row" style="gap:6px"><button class="btn primary sm" type="button" data-boprint="${s.id}">A4 출력·PDF 저장</button><button class="btn sm" type="button" data-bocopy="${s.id}">카톡용 요약 복사</button></div></div><div class="bo-prev">${body}</div></div>`:body;
}
const A4CSS=`*{box-sizing:border-box}body{margin:0;font-family:"Pretendard",-apple-system,"Malgun Gothic",sans-serif;color:#191F28;background:#fff}
.bo-a4{width:190mm;margin:0 auto;padding:6mm 0;font-size:12.5px;line-height:1.55}
.bo-h{border-bottom:3px solid #0B1E42;padding-bottom:8px;margin-bottom:6px}.bo-h small{color:#A85F6C;font-weight:700}.bo-h h1{margin:2px 0;font-size:24px;color:#0B1E42}.bo-h p{margin:0;color:#4E5968}
h3{font-size:14px;margin:14px 0 6px;color:#0B1E42}table{width:100%;border-collapse:collapse}th,td{border:1px solid #E5E8EB;padding:5px 8px;text-align:left}th{background:#F3F4F7;font-weight:700}tr.mine td{background:#FBEFF1}
.sm{margin:6px 0 0;font-size:12px;color:#4E5968}.chips{display:flex;flex-wrap:wrap;gap:6px}.chips span{border-radius:99px;padding:3px 10px;font-size:12px;border:1px solid #E5E8EB}.chips .y{background:#EAF7F0;color:#1E9E5A}.chips .n{background:#FDECEC;color:#D93A3F}.chips .u{color:#8B95A1}
.adv{margin:0;padding-left:18px}.adv li{margin:0 0 7px}.adv b{display:block;color:#0B1E42}.adv span{color:#4E5968}
.bo-f{margin-top:14px;padding:10px 12px;background:#F3F4F7;border-radius:8px;font-size:12px;color:#4E5968}.bo-f b{color:#191F28}
@page{size:A4;margin:10mm}`;
function printHTML(title,html){
  const w=window.open("","_blank"); if(!w){ alert("팝업이 막혔습니다. 브라우저에서 팝업을 허용하세요."); return; }
  w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${E(title)}</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"><style>${A4CSS}</style></head><body>${html}<script>setTimeout(function(){print()},600)<\/script></body></html>`);
  w.document.close();
}
function summaryText(s){
  const d=s.diag[0]; const adv=advice(d,s);
  return `[${s.name} 가게 진단 요약 · ${d.date}]\n`+
    (d.kw||[]).map(k=>`· '${k.k}' 검색 ${k.r?k.r+"위":"20위 밖"}`).join("\n")+
    `\n· 방문자 리뷰 ${d.rv.visit!=null?d.rv.visit:"-"}개 / 블로그 리뷰 ${d.rv.blog!=null?d.rv.blog:"-"}개\n\n바로 할 수 있는 개선\n`+adv.map((a,i)=>`${i+1}. ${a[0]}`).join("\n")+
    `\n\n자세한 리포트는 따로 드릴게요. 비용 없고, 보시기만 하셔도 됩니다.\n${meName()}${mePhone()?" "+mePhone():""}`;
}

/* ---------- 3. 소식글·리뷰 답글 (문장 틀) ---------- */
const NEWS={
  "신메뉴":(n,x)=>[`[신메뉴] ${x||"새 메뉴"}가 나왔습니다 🍽\n${n}에서 오래 준비한 메뉴예요. 처음 드셔 보시는 분들 의견을 듣고 싶습니다. 방문하시면 직원에게 편하게 말씀 주세요.`,`${n} 새 소식 ✨\n이번 주부터 ${x||"새 메뉴"}를 시작합니다. 재료부터 직접 고르고 준비했어요. 맛있게 드시고 솔직한 후기 남겨 주시면 큰 힘이 됩니다.`],
  "이벤트":(n,x)=>[`[이벤트] ${x||"이번 달 이벤트"} 🎁\n${n}을 찾아 주시는 손님께 감사한 마음을 담았습니다. 자세한 내용은 매장에서 안내해 드려요.`,`${n} 이벤트 안내\n${x||"이벤트 내용"}\n기간·조건은 매장 안내문을 확인해 주세요. 늘 찾아 주셔서 감사합니다.`],
  "계절 인사":(n,x)=>[`날이 많이 ${x||"추워졌어요"} ☕\n${n}에서 따뜻하게 쉬어 가세요. 이번 주도 정성껏 준비하겠습니다.`,`${x||"계절이 바뀌었습니다"}.\n${n}은 이번 주도 변함없이 문을 엽니다. 오시는 길 조심히 오세요.`],
  "영업시간 안내":(n,x)=>[`[영업 안내] ${x||"이번 주 영업시간"}\n${n} 방문 전 참고해 주세요. 변동이 있으면 바로 소식으로 알려 드리겠습니다.`],
  "감사 인사":(n,x)=>[`${n}을 찾아 주신 모든 손님께 감사드립니다 🙏\n${x||"남겨 주신 리뷰 하나하나 다 읽고 있어요."} 더 좋은 맛과 서비스로 보답하겠습니다.`]
};
function replies(star,txt,tone,n,sign){
  const pol=tone==="친근"; const s=sign?`\n- ${sign}`:"";
  const mention="";
  if(star>=4) return [
    pol?`와 좋은 리뷰 정말 감사해요! ${mention?mention+" 좋아해 주셔서 기뻐요. ":""}다음에 오시면 더 맛있게 준비해 둘게요 😊${s}`:`소중한 리뷰 감사합니다. ${mention?mention+"을(를) 좋게 봐주셔서 기쁩니다. ":""}다음 방문 때도 만족하실 수 있도록 정성껏 준비하겠습니다.${s}`,
    pol?`찾아와 주시고 후기까지 남겨 주셔서 감사합니다! 덕분에 오늘 하루 힘이 나네요. 또 뵐게요 🙌${s}`:`${n}을 찾아 주셔서 감사합니다. 남겨 주신 말씀이 저희에게 큰 힘이 됩니다. 또 뵙기를 바랍니다.${s}`];
  if(star===3) return [
    `방문해 주시고 솔직한 의견 남겨 주셔서 감사합니다. 아쉬우셨던 부분은 꼭 살펴서 다음엔 더 만족하실 수 있게 하겠습니다.${s}`,
    `소중한 후기 감사합니다. 말씀해 주신 점 직원들과 함께 확인하고 고치겠습니다. 다시 한번 기회를 주시면 더 나은 모습 보여드리겠습니다.${s}`];
  return [
    `불편을 드려 정말 죄송합니다. 말씀해 주신 부분은 바로 확인해서 고치겠습니다. 괜찮으시다면 매장으로 연락 주시면 직접 사과드리고 자세히 듣고 싶습니다.${s}`,
    `기대하고 오셨을 텐데 실망을 드려 죄송합니다. 남겨 주신 내용 그대로 받아들이고 개선하겠습니다. 다음에 다시 찾아 주신다면 꼭 달라진 모습 보여드리겠습니다.${s}`];
}
function vWrite(){
  const B=$("#bo-body"); const L=D().shops; const s=shopBy(CUR)||L[0];
  B.innerHTML=`<div class="bo-two">
  <div class="panel"><h2 style="margin:0 0 10px">플레이스 소식글</h2>
    <div class="fgrid"><div class="field"><label for="nw-n">상호</label><input id="nw-n" value="${E(s?s.name:"")}"></div><div class="field"><label for="nw-t">종류</label><select id="nw-t">${Object.keys(NEWS).map(k=>`<option>${k}</option>`).join("")}</select></div></div>
    <div class="field" style="margin-top:10px"><label for="nw-x">넣을 내용</label><input id="nw-x" placeholder="예) 굴국밥 / 12월 매주 화요일 음료 서비스 / 추워졌어요"></div>
    <button class="btn primary" type="button" id="nw-go" style="margin-top:10px">소식글 만들기</button>
    <div id="nw-out" class="bo-outs"></div>
  </div>
  <div class="panel"><h2 style="margin:0 0 10px">리뷰 답글</h2>
    <div class="field"><label for="rp-t">손님 리뷰 붙여넣기</label><textarea id="rp-t" rows="3" placeholder="리뷰 내용을 그대로 붙여넣으세요"></textarea></div>
    <div class="fgrid" style="margin-top:10px"><div class="field"><label>별점·느낌</label><div class="seg" id="rp-s">${[["5","좋음"],["3","보통"],["1","불만"]].map(([v,t],i)=>`<button class="btn sm" type="button" data-rps="${v}" aria-pressed="${i===0}">${t}</button>`).join("")}</div></div>
    <div class="field"><label>말투</label><div class="seg" id="rp-o">${["정중","친근"].map((t,i)=>`<button class="btn sm" type="button" data-rpo="${t}" aria-pressed="${i===0}">${t}</button>`).join("")}</div></div>
    <div class="field"><label for="rp-g">서명</label><input id="rp-g" value="${E(s?s.name+" 사장 드림":"")}"></div></div>
    <button class="btn primary" type="button" id="rp-go" style="margin-top:10px">답글 만들기</button>
    <div id="rp-out" class="bo-outs"></div>
  </div></div>
  <p class="note" style="margin-top:10px">문장 틀로 만든 초안입니다. 가게 사정에 맞게 고친 뒤 [복사]해서 스마트플레이스·배달앱에 붙여넣으세요. 사장님 계정 비밀번호는 받지 않습니다.</p>`;
}
const RP={s:5,o:"정중"};
function outs(id,arr){ $(id).innerHTML=arr.map((t,i)=>`<div class="bo-o"><textarea rows="4" data-oi="${id}${i}">${E(t)}</textarea><button class="btn sm" type="button" data-bocp="${id}${i}">복사</button></div>`).join(""); }

/* ---------- 4. 리뷰 요청 QR ---------- */
function vQr(){
  const B=$("#bo-body"); const s=shopBy(CUR)||D().shops[0];
  B.innerHTML=`<div class="panel">
    <div class="fgrid"><div class="field"><label for="qr-n">상호</label><input id="qr-n" value="${E(s?s.name:"")}"></div>
    <div class="field" style="grid-column:span 2"><label for="qr-u">리뷰 남기는 주소</label><input id="qr-u" value="${E(s&&s.place||"")}" placeholder="네이버 플레이스 주소 (리뷰 탭 주소면 더 좋습니다)"></div></div>
    <div class="field" style="margin-top:10px"><label for="qr-m">안내 문구</label><input id="qr-m" value="오늘 식사 어떠셨나요? 솔직한 리뷰가 저희에게 큰 힘이 됩니다."></div>
    <div class="row" style="gap:8px;margin-top:10px"><button class="btn primary" type="button" id="qr-go">QR 만들기</button><button class="btn" type="button" id="qr-pr">안내문 출력 (A5 2장)</button></div>
    <p class="note" style="margin:10px 0 0">좋은 리뷰를 조건으로 혜택을 주면 안 됩니다. 혜택을 걸 때는 '리뷰 작성' 자체에만 연결하세요(별점 무관).</p>
    <div id="qr-box" style="margin-top:14px;display:flex;justify-content:center"></div>
  </div>`;
}
function loadQR(cb){ if(window.QRCode) return cb(); const sc=document.createElement("script"); sc.src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; sc.onload=cb; sc.onerror=()=>alert("QR 도구를 불러오지 못했습니다."); document.head.appendChild(sc); }
function makeQR(target,url,size){ target.innerHTML=""; new window.QRCode(target,{text:url,width:size,height:size,correctLevel:window.QRCode.CorrectLevel.M}); }
function qrGo(print){
  const u=$("#qr-u").value.trim(); if(!/^https?:\/\//.test(u)&&!/^naver\.me\//.test(u)){ alert("리뷰 남기는 주소(https://...)를 넣어 주세요."); return; }
  const url=/^https?:/.test(u)?u:"https://"+u;
  loadQR(()=>{ const box=$("#qr-box"); makeQR(box,url,220);
    if(!print) return;
    setTimeout(()=>{ const img=box.querySelector("img")||box.querySelector("canvas"); const src=img.tagName==="CANVAS"?img.toDataURL():img.src;
      const card=`<div class="qc"><b>${E($("#qr-n").value)}</b><img src="${src}"><p>${E($("#qr-m").value)}</p><small>휴대폰 카메라로 비춰 주세요</small></div>`;
      const w=window.open("","_blank"); if(!w) return alert("팝업이 막혔습니다.");
      w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>리뷰 요청 안내문</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"><style>body{margin:0;font-family:Pretendard,sans-serif}.pg{display:grid;grid-template-rows:1fr 1fr;height:277mm}.qc{display:flex;flex-direction:column;align-items:center;justify-content:center;border-bottom:1px dashed #ccc;text-align:center;padding:10mm}.qc b{font-size:30px;color:#0B1E42}.qc img{width:70mm;height:70mm;margin:8mm 0}.qc p{font-size:18px;margin:0 0 4mm;max-width:150mm}.qc small{color:#888;font-size:13px}@page{size:A4;margin:10mm}</style></head><body><div class="pg">${card}${card}</div><script>setTimeout(function(){print()},500)<\/script></body></html>`);
      w.document.close(); },300);
  });
}

/* ---------- 5. 접촉 문구 ---------- */
function vTalk(){
  const s=shopBy(CUR)||D().shops[0]; const shop=s?s.name:"○○", me=meName(), ph=mePhone();
  const T=[
    ["첫 방문 인사 (말로)",`사장님, 잠깐 괜찮으세요? 이 동네에서 일하는 ${me}입니다. 요즘 동네 가게들 네이버 상태를 봐 드리고 있는데, ${shop} 검색해 보다가 눈에 띄는 게 있어서 한 장으로 정리해 왔어요. 그냥 드리는 거고 따로 하실 건 없습니다. 보시고 궁금한 것만 물어봐 주세요.`],
    ["카톡·문자 첫 연락",`사장님 안녕하세요, 이 동네에서 일하는 ${me}입니다. ${shop}을 네이버에서 찾아보다가 손님들이 보는 정보 중 아쉬운 부분이 보여서 연락드렸어요. 정리한 진단 내용을 보내드려도 될까요? 비용은 없고, 보시기만 하셔도 됩니다.${ph?"\n"+ph:""}`],
    ["진단 리포트 전달",`사장님, 말씀드린 ${shop} 진단 내용 보내드립니다. 숫자는 오늘 휴대폰으로 직접 확인한 거예요. 이 중에 바로 하실 수 있는 건 맨 아래 개선 3가지예요. 도움이 필요하시면 편하게 말씀 주세요.`],
    ["'뭐 파는 거 아니에요?' 물으면",`솔직히 말씀드리면 저는 보험 일을 합니다. 그래도 이건 보험이랑 상관없이 동네 사장님들 알고 지내려고 드리는 거예요. 보험 얘기는 사장님이 먼저 물어보시기 전에는 꺼내지 않겠습니다.`],
    ["한 달 뒤 변화 보고",`사장님, 한 달 전이랑 비교해 봤어요. 숫자로 정리한 전후 비교 보내드립니다. 앞으로 직접 하셔도 되고, 계속 봐 드리길 원하시면 그것도 괜찮습니다. 편하게 정하세요.`],
    ["사업장 위험 점검 제안",`사장님, 가게를 한 달 넘게 보다 보니 하나 여쭤보고 싶은 게 있어요. 혹시 화재보험이나 손님이 다쳤을 때 배상해 주는 보험은 어떻게 되어 있으세요? 업종·면적에 따라 법으로 꼭 들어야 하는 보험도 있어서요. 마케팅 진단처럼 지금 비어 있는 게 있는지만 확인해 드릴게요. 가입하시라는 얘기는 아닙니다.`],
    ["소개 부탁",`사장님 덕분에 일이 재밌습니다. 혹시 주변에 네이버 때문에 고민하시는 사장님 계시면 소개해 주세요. 똑같이 무료로 진단해 드릴게요.`]
  ];
  $("#bo-body").innerHTML=`<p class="note" style="margin:0 0 10px">${E(shop)} · ${E(me)} 기준으로 바뀌어 나옵니다. 상황에 맞게 고쳐 쓰세요. 보험 가입을 조건으로 무료 도움을 약속하는 말은 하지 않습니다.</p>
  <div class="bo-two">${T.map(([t,x],i)=>`<div class="panel"><h2 style="margin:0 0 8px;font-size:16px">${t}</h2><textarea rows="5" class="bo-ta" data-oi="tk${i}">${E(x)}</textarea><button class="btn sm" type="button" data-bocp="tk${i}" style="margin-top:6px">복사</button></div>`).join("")}</div>`;
}

/* ---------- 6. 지원사업 바로가기 ---------- */
function vFund(){
  const L=[["소상공인24","https://www.sbiz24.kr","소진공 지원사업 공고 조회·신청 (바우처·교육·고용보험료 지원 등)"],
    ["소상공인 정책자금","https://ols.semas.or.kr","경영안정자금 등 정책자금 융자 온라인 접수"],
    ["기업마당","https://www.bizinfo.go.kr","중기부 등 정부 지원사업 공고 모음"],
    ["소상공인시장진흥공단","https://www.semas.or.kr","정책자금 금리·공지, 지역센터 안내"],
    ["희망리턴패키지","https://hope.sbiz.or.kr","폐업·재기 지원 (사업정리 컨설팅·채무조정 등)"]];
  $("#bo-body").innerHTML=`<div class="bo-two">${L.map(([t,u,d])=>`<a class="panel bo-link" href="${u}" target="_blank" rel="noopener"><b>${t}</b><span>${d}</span><small>${u.replace("https://","")}</small></a>`).join("")}</div>
  <p class="note" style="margin-top:10px">지원 조건·기간은 해마다 바뀝니다. 사장님께는 공고 원문 링크를 함께 보내 드리세요. 신청 대행이 아니라 안내만 합니다.</p>`;
}

/* ---------- 이벤트 ---------- */
document.addEventListener("click",e=>{
  const t=e.target; if(!t.closest) return;
  const nav=t.closest('[data-go="bizopen"]'); if(nav){ setTimeout(render,0); return; }
  if(!t.closest("#bo-root")) return;
  const b=t.closest("[data-bot]"); if(b){ if(b.dataset.bot==="shops"&&TAB==="shops") CUR=null; TAB=b.dataset.bot; render(); return; }
  if(t.closest("#bo-add")) return addShop();
  const o=t.closest("[data-boopen]"); if(o){ CUR=o.dataset.boopen; vShops(); return; }
  if(t.closest("#bo-back")){ CUR=null; vShops(); return; }
  const st=t.closest("[data-bostage]"); if(st){ const s=shopBy(CUR); if(s&&s.stage!==st.dataset.bostage){ s.stage=st.dataset.bostage; s.log=s.log||[]; s.log.unshift({date:td(),text:"단계 → "+s.stage}); vShop(s);} return; }
  if(t.closest("#bo-lgadd")){ const s=shopBy(CUR), v=$("#bo-lg").value.trim(); if(s&&v){ s.log.unshift({date:td(),text:v}); vShop(s);} return; }
  const dl=t.closest("[data-bodel]"); if(dl){ const s=shopBy(dl.dataset.bodel); if(s&&confirm(s.name+" 가게를 삭제할까요?")){ D().shops.splice(D().shops.indexOf(s),1); CUR=null; vShops(); } return; }
  const dg=t.closest("[data-bodiag]"); if(dg){ DI=dg.dataset.bodiag; TAB="diag"; render(); return; }
  const pr=t.closest("[data-boprint]"); if(pr){ const s=shopBy(pr.dataset.boprint); if(s&&s.diag&&s.diag.length) printHTML(s.name+" 가게 진단 리포트",reportHTML(s,false)); return; }
  const cp=t.closest("[data-bocopy]"); if(cp){ const s=shopBy(cp.dataset.bocopy); copy(summaryText(s),cp); return; }
  const qr=t.closest("[data-boqr]"); if(qr){ CUR=qr.dataset.boqr; TAB="qr"; render(); return; }
  if(t.closest("[data-boliab]")){ try{ go("liab"); }catch(x){} return; }
  const cu=t.closest("[data-bocust]"); if(cu){ toCustomer(shopBy(cu.dataset.bocust)); return; }
  if(t.closest("#dg-save")) return saveDiag();
  const inf=t.closest("[data-info]"); if(inf){ DG.info[inf.dataset.info]=inf.dataset.v; inf.parentNode.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===inf)); return; }
  const ad=t.closest("[data-ad]"); if(ad){ DG.ad=ad.dataset.ad; ad.parentNode.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===ad)); return; }
  if(t.closest("#nw-go")){ const n=$("#nw-n").value.trim()||"저희 가게"; outs("#nw-out",NEWS[$("#nw-t").value](n,$("#nw-x").value.trim())); return; }
  const rs=t.closest("[data-rps]"); if(rs){ RP.s=+rs.dataset.rps; rs.parentNode.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===rs)); return; }
  const ro=t.closest("[data-rpo]"); if(ro){ RP.o=ro.dataset.rpo; ro.parentNode.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===ro)); return; }
  if(t.closest("#rp-go")){ { const sh=shopBy(CUR)||D().shops[0]; outs("#rp-out",replies(RP.s,$("#rp-t").value,RP.o,sh?sh.name:"저희 가게",$("#rp-g").value.trim())); } return; }
  const c2=t.closest("[data-bocp]"); if(c2){ const ta=document.querySelector(`[data-oi="${c2.dataset.bocp}"]`); if(ta) copy(ta.value,c2); return; }
  if(t.closest("#qr-go")) return qrGo(false);
  if(t.closest("#qr-pr")) return qrGo(true);
});
document.addEventListener("change",e=>{ if(e.target&&e.target.id==="dg-shop"){ DI=e.target.value; vDiag(); } });
document.addEventListener("input",e=>{ const t=e.target; if(!t||!t.closest||!t.closest("#bo-root")) return;
  if(t.id==="bo-q") list();
  if(t.id==="bo-p"){ const d=t.value.replace(/\D/g,"").slice(0,11); t.value=d.length>=8?d.replace(/(\d{3})(\d{3,4})(\d{4})/,"$1-$2-$3"):d; }
  if(t.matches("[data-date]")){ const d=t.value.replace(/\D/g,""); if(d.length===8&&t.value.replace(/[\d\-]/g,"")==="") t.value=d.slice(0,4)+"-"+d.slice(4,6)+"-"+d.slice(6,8); }
});
function copy(text,btn){ const done=()=>{ const o=btn.textContent; btn.textContent="복사됨"; setTimeout(()=>btn.textContent=o,1400); };
  (navigator.clipboard?navigator.clipboard.writeText(text):Promise.reject()).then(done).catch(()=>window.prompt("복사하세요",text)); }
function toCustomer(s){
  if(!s) return; if(!s.owner||!s.phone){ alert("사장님 이름과 연락처가 있어야 고객으로 등록할 수 있습니다. 가게 정보를 다시 추가해 주세요."); return; }
  try{
    const ph=s.phone.replace(/\D/g,""); const ex=CUSTOMERS.find(c=>String(c.phone||"").replace(/\D/g,"")===ph);
    if(ex){ alert(s.owner+" 사장님은 이미 고객 목록에 있습니다."); return; }
    const id=nextCustId(); CUSTOMERS.unshift({id,name:s.owner,type:"가망",birth:"",phone:fmtPhone(ph),addr1:s.area||"",addr2:"",job:s.biz+" 사장 ("+s.name+")",memo:"소상공인 개척 · "+s.name,src:"소상공인 개척"});
    const dl=document.getElementById("dl-cust"); if(dl) dl.innerHTML="";
    s.log.unshift({date:td(),text:"고객(가망) 등록"}); alert(s.owner+" 사장님을 가망고객으로 등록했습니다. 고객관리에서 확인하세요.");
  }catch(x){ alert("고객 등록에 실패했습니다."); }
}

/* 스타일 */
const css=document.createElement("style"); css.textContent=`
.nav .grp[data-g="6"]{--g:var(--c4)}
.bo-rule{margin-top:12px;padding:10px 14px;border-radius:10px;background:var(--warn-soft);color:var(--warn);font-size:13.5px}
.bo-rule b{color:inherit}
.bo-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}
@media(max-width:900px){.bo-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
.bo-log{margin:10px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px;font-size:14px}
.bo-log li{padding:6px 0;border-bottom:1px solid var(--line)}
.bo-chk{padding:8px 0;border-bottom:1px solid var(--line);gap:10px;flex-wrap:wrap}
.bo-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px}
.bo-outs{display:flex;flex-direction:column;gap:8px;margin-top:12px}
.bo-o{display:flex;gap:6px;align-items:flex-start}.bo-o textarea,.bo-ta{flex:1;width:100%;border:1px solid var(--line);border-radius:8px;padding:9px 11px;background:var(--surface);font:inherit;resize:vertical}
.bo-link{display:flex;flex-direction:column;gap:4px;text-decoration:none;color:inherit}.bo-link:hover{border-color:var(--accent)}.bo-link b{font-size:16px}.bo-link span{color:var(--muted);font-size:14px}.bo-link small{color:var(--accent)}
.bo-prev{margin-top:12px;background:#fff;color:#191F28;border-radius:8px;padding:14px;overflow:auto}
.bo-prev ${""}.bo-a4{width:auto;padding:0}
${A4CSS.replace(/@page[^}]*}/,"").replace(/(^|})\s*([^{}@]+)\{/g,(m,a,sel)=>a+sel.split(",").map(x=>".bo-prev "+x.trim()).join(",")+"{")}
`; document.head.appendChild(css);

window.BIZOPEN={render};
if(document.readyState!=="loading") render(); else document.addEventListener("DOMContentLoaded",render);
})();
