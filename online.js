/* 보잇 · 온라인 자동화 (2026-11-12)
   설계사 블로그·카페 운영을 돕는 자동화 모음. 지금 쓸 수 있는 것: 블로그 키워드 조사, 콘텐츠 계획, 글 만들기(AI 글·정보 이미지·실사 사진·심의번호·배너), 필수기재 배너.
   키워드 조사: n8n '보잇 키워드 조사 API' (POST boit-keyword {token, keywords[], related})
     - 월간 검색량: 네이버 검색광고 API (keywordstool)
     - 경쟁도: 네이버 API HUB 블로그 검색 상위 10개 중 제목에 키워드를 그대로 넣은 글 수, 상위글 나이(중앙값)
     - 검색 결과 글 본문은 저장하지 않고 AI에 넣지 않음 (NAVER API HUB 이용 조건)
   필수기재 배너: 설계사별 배너 이미지(기본·태아어린이) 등록 → 글 끝에 붙일 때 이미지 복사/다운로드. ME.oa.banners {gen,kid} = {img:dataURL,name,at}
   저장: ME.oa = {last, plan[], banners} (app_state 클라우드 저장에 포함)
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
  const T=[["kw","블로그 키워드 조사"],["plan","콘텐츠 계획 ("+D().plan.length+")"],["write","글 만들기"],["banner","내 필수기재 배너"],["more","자동화 목록"]];
  R.innerHTML=`<div class="tabs">${T.map(([k,t])=>`<button class="btn" type="button" data-oat="${k}" aria-pressed="${TAB===k}">${t}</button>`).join("")}</div>
  <div class="oa-rule">보험 상품·보장 내용이 들어간 글은 <b>광고</b>입니다. 회사 준법감시 심의를 받은 뒤 게시하고, 글 끝에 심의필 문구를 넣으세요 (금융소비자보호법 제22조).</div>
  <div id="oa-body" style="margin-top:14px"></div>`;
  ({kw:vKw,plan:vPlan,write:vWrite,banner:vBanner,more:vMore}[TAB]||vKw)();
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
    ${P.length?`<div class="tbl-wrap" style="margin-top:12px"><table class="oa-t"><thead><tr><th>키워드</th><th>판정</th><th>채널</th><th>발행 예정일</th><th>상태</th><th>심의번호</th><th>발행 주소</th><th>글 끝 배너</th><th></th></tr></thead><tbody>
    ${P.map(p=>`<tr data-oap="${p.id}"><td><b>${E(p.keyword)}</b>${p.search?`<br><small class="note">월 ${fmt(p.search)}회</small>`:""}</td>
      <td>${p.verdict?`<b style="color:${VC[p.verdict]||"inherit"}">${E(p.verdict)}</b>`:"-"}</td>
      <td><select data-f="ch">${["블로그","카페"].map(c=>`<option ${p.ch===c?"selected":""}>${c}</option>`).join("")}</select></td>
      <td><input type="date" data-f="date" value="${E(p.date)}"></td>
      <td><select data-f="st">${ST.map(s=>`<option ${p.st===s?"selected":""}>${s}</option>`).join("")}</select></td>
      <td><input data-f="no" value="${E(p.no)}" placeholder="예) 2026-0806" maxlength="30" style="width:110px"></td>
      <td>${p.url?`<a href="${E(p.url)}" target="_blank" rel="noopener">열기</a> `:""}<input data-f="url" value="${E(p.url)}" placeholder="https://blog.naver.com/…" maxlength="300" style="width:150px"></td>
      <td><div class="row" style="gap:4px;flex-wrap:nowrap"><select data-f="bn">${BN.map(([k,t])=>`<option value="${k}" ${(p.bn||"gen")===k?"selected":""}>${t}</option>`).join("")}</select><button class="btn sm" type="button" data-oabc="${E(p.bn||"gen")}">복사</button></div></td>
      <td style="white-space:nowrap"><button class="btn sm primary" type="button" data-oaw="${p.id}">${p.post?"글 보기":"글 쓰기"}</button> <button class="btn sm" type="button" data-oadel="${p.id}" aria-label="삭제">삭제</button></td></tr>`).join("")}
    </tbody></table></div>`:`<p class="note" style="margin-top:12px">아직 계획이 없습니다. <b>블로그 키워드 조사</b>에서 키워드를 담아 오세요.</p>`}
  </div>`;
}

/* ---------- 3. 내 필수기재 배너 ---------- */
const BN=[["gen","기본 (일반·기업·리쿠르팅)"],["kid","태아·어린이·산모"]];
function BNS(){ const o=D(); if(!o.banners||typeof o.banners!=="object") o.banners={}; return o.banners; }
function vBanner(){
  const B=$("#oa-body"), S=BNS();
  B.innerHTML=`<div class="panel">
    <h2 style="margin:0 0 4px">내 필수기재 배너</h2>
    <p class="note" style="margin:0 0 12px">설계사 이름·등록번호·대리점 정보가 들어간 <b>회사에서 받은 배너 이미지</b>를 등록해 두세요. 블로그·카페 글을 올릴 때 글 맨 끝에 이 이미지를 붙입니다. 배너 문구를 고치면 다시 심의를 받아야 합니다.</p>
    <div class="oa-bgrid">${BN.map(([k,t])=>{ const b=S[k]; return `<div class="oa-bslot">
      <b>${t}</b>
      ${b&&b.img?`<img src="${b.img}" alt="${E(t)} 필수기재 배너"><small class="note">${E(b.name||"")} · ${E(b.at||"")}</small>
        <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn sm primary" type="button" data-oabc="${k}">이미지 복사</button><button class="btn sm" type="button" data-oabd="${k}">내려받기</button><label class="btn sm" style="cursor:pointer">바꾸기<input type="file" accept="image/png,image/jpeg,image/webp" data-oabu="${k}" hidden></label><button class="btn sm" type="button" data-oabx="${k}">삭제</button></div>`
      :`<label class="oa-bdrop">이미지 올리기 (PNG·JPG)<input type="file" accept="image/png,image/jpeg,image/webp" data-oabu="${k}" hidden></label>`}
    </div>`; }).join("")}</div>
    <span class="note" id="oa-bmsg"></span>
    <details class="oa-help" style="margin-top:12px"><summary>네이버 글에 붙이는 방법</summary>
      <ul><li>글 작성이 끝나면 <b>이미지 복사</b>를 누른 뒤, 네이버 글쓰기 화면 맨 끝을 클릭하고 <b>Ctrl+V</b>(휴대폰은 길게 눌러 붙여넣기)를 누르세요.</li>
      <li>붙여넣기가 안 되면 <b>내려받기</b>로 저장한 뒤 네이버 글쓰기의 사진 버튼으로 올리세요.</li>
      <li>콘텐츠 계획 표의 <b>글 끝 배너</b> 칸에서 글마다 기본/태아·어린이를 고르고 바로 복사할 수 있습니다.</li></ul></details>
  </div>`;
}
function loadImg(file){ return new Promise((ok,no)=>{ if(!file||!/^image\//.test(file.type)) return no(new Error("이미지 파일만 올릴 수 있습니다."));
  if(file.size>8*1024*1024) return no(new Error("8MB 이하 이미지만 올릴 수 있습니다."));
  const rd=new FileReader(); rd.onload=()=>{ const im=new Image(); im.onload=()=>{
      const W=Math.min(1200,im.naturalWidth), H=Math.round(im.naturalHeight*W/im.naturalWidth);
      const c=document.createElement("canvas"); c.width=W; c.height=H; const g=c.getContext("2d"); g.fillStyle="#fff"; g.fillRect(0,0,W,H); g.drawImage(im,0,0,W,H);
      let u=c.toDataURL("image/png"); if(u.length>900000) u=c.toDataURL("image/jpeg",0.92); if(u.length>1400000) u=c.toDataURL("image/jpeg",0.8);
      ok(u); }; im.onerror=()=>no(new Error("이미지를 읽지 못했습니다.")); im.src=rd.result; };
  rd.onerror=()=>no(new Error("파일을 읽지 못했습니다.")); rd.readAsDataURL(file); }); }
function toPng(u){ return new Promise((ok,no)=>{ const im=new Image(); im.onload=()=>{ const c=document.createElement("canvas"); c.width=im.naturalWidth; c.height=im.naturalHeight; c.getContext("2d").drawImage(im,0,0); c.toBlob(b=>b?ok(b):no(new Error("변환 실패")),"image/png"); }; im.onerror=()=>no(new Error("이미지 오류")); im.src=u; }); }
async function copyBanner(k,btn){
  const b=BNS()[k]; if(!b||!b.img){ alert("먼저 '내 필수기재 배너'에서 "+(k==="kid"?"태아·어린이·산모":"기본")+" 배너 이미지를 올려 주세요."); TAB="banner"; render(); return; }
  try{ if(!navigator.clipboard||!window.ClipboardItem) throw new Error("x"); const blob=await toPng(b.img); await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]);
    const o=btn.textContent; btn.textContent="복사됨 — 글 끝에 붙여넣기"; setTimeout(()=>btn.textContent=o,1800); }
  catch(e){ if(confirm("이 브라우저에서는 이미지 복사가 안 됩니다. 내려받아서 사진으로 올릴까요?")) dlBanner(k); }
}
function dlBanner(k){ const b=BNS()[k]; if(!b||!b.img) return; const a=document.createElement("a"); a.href=b.img; a.download="필수기재배너_"+(k==="kid"?"태아어린이":"기본")+(b.img.indexOf("image/png")>0?".png":".jpg"); document.body.appendChild(a); a.click(); a.remove(); }
window.OA_BANNER=k=>{ const b=BNS()[k||"gen"]; return b&&b.img||""; };

/* ---------- 3-1. 글 만들기 (AI 보험 블로그 글 + 정보 이미지 + 실사 사진) ----------
   흐름: 주제·스타일 → AI 글·이미지 생성 → 심의용 복사 → 심의번호 입력 → 하단 배너 붙여 최종글 복사
   서버: n8n '보잇 보험 블로그 글 AI' (POST boit-blog-write {token, action write|photo}) · 설계사별 하루 글 5편·사진 12장
   저장: ME.oa.posts[] (글·이미지 설계만, 최근 30편) / AI 사진은 이 기기 IndexedDB(boit-oa) — 다른 기기에서는 다시 만들어야 함
   원칙: 이미지 안에 회사·지점·상품명 넣지 않음. 심의번호 없이는 최종글 복사 불가. */
const WAPI="https://daonpartners.app.n8n.cloud/webhook/boit-blog-write";
const GENS=["여성","남성"];
const TYPES=[["전문형","약관·제도 근거 해설"],["상담사례형","상담에서 자주 받는 질문 중심"],["강의형","단계별로 가르치듯"],["친근형","이웃에게 말하듯 쉽게"],["뉴스해설형","제도 변경·발표 풀이"]];
const THEMES={navy:["네이비","#1f3a68","#2c5aa0","#f08a24","#f3f6fb"],green:["그린","#1d5c4a","#2f8a6c","#f2b134","#eef7f2"],coral:["코랄","#a8474a","#df7a68","#ffcf66","#fdf1ee"],purple:["퍼플","#4b3a8c","#7a5cc8","#ffb547","#f4f1fb"],pink:["로즈","#a3445f","#d9789a","#ffd27a","#fcf0f4"],brown:["브라운","#5e4634","#9a7655","#e7b765","#f8f3ec"],charcoal:["차콜","#262a31","#4a515c","#e9b44c","#f2f3f5"]};
const DISC="※ 이 글은 보험설계사(모집종사자)의 개인 의견이며, 구체적인 보장 내용은 해당 상품의 약관과 상품설명서를 반드시 확인하시기 바랍니다.";
let WCUR=null, WBUSY=false, PHB={};
function POSTS(){ const o=D(); if(!Array.isArray(o.posts)) o.posts=[]; return o.posts; }
function curPost(){ return POSTS().find(p=>p.id===WCUR)||null; }
/* IndexedDB (사진) */
const IDB={db:null,open(){ if(this.db) return Promise.resolve(this.db); return new Promise((ok,no)=>{ try{ const r=indexedDB.open("boit-oa",1); r.onupgradeneeded=()=>r.result.createObjectStore("ph"); r.onsuccess=()=>{ this.db=r.result; ok(this.db); }; r.onerror=()=>no(r.error); }catch(e){ no(e); } }); },
  put(k,v){ return this.open().then(db=>new Promise(ok=>{ const t=db.transaction("ph","readwrite"); t.objectStore("ph").put(v,k); t.oncomplete=()=>ok(true); t.onerror=()=>ok(false); })).catch(()=>false); },
  get(k){ return this.open().then(db=>new Promise(ok=>{ const r=db.transaction("ph").objectStore("ph").get(k); r.onsuccess=()=>ok(r.result||null); r.onerror=()=>ok(null); })).catch(()=>null); },
  del(k){ return this.open().then(db=>{ db.transaction("ph","readwrite").objectStore("ph").delete(k); }).catch(()=>{}); } };
async function loadPhotos(p){ if(!p||!p.out) return; for(let n=1;n<=(p.out.photos||[]).length;n++){ const k=p.id+"_"+n; if(!PHB[k]){ const v=await IDB.get(k); if(v) PHB[k]=v; } } }

/* 정보 이미지 (캔버스) — 회사명 없음, 색상 테마 */
const CF='Pretendard,"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
function wl(x,t,w){ const out=[]; String(t||"").split("\n").forEach(par=>{ let cur=""; Array.from(par).forEach(ch=>{ const s=cur+ch; if(x.measureText(s).width>w&&cur){ const sp=cur.lastIndexOf(" "); if(sp>0&&cur.length-sp<10){ out.push(cur.slice(0,sp)); cur=cur.slice(sp+1)+ch; } else { out.push(cur); cur=ch; } } else cur=s; }); out.push(cur); }); return out; }
function dt(x,t,X,Y,w,lh,max){ let ls=wl(x,t,w); if(max&&ls.length>max){ ls=ls.slice(0,max); ls[max-1]=ls[max-1].slice(0,-1)+"…"; } ls.forEach((l,i)=>x.fillText(l,X,Y+i*lh)); return ls.length*lh; }
function rr(x,X,Y,w,h,r){ x.beginPath(); x.moveTo(X+r,Y); x.arcTo(X+w,Y,X+w,Y+h,r); x.arcTo(X+w,Y+h,X,Y+h,r); x.arcTo(X,Y+h,X,Y,r); x.arcTo(X,Y,X+w,Y,r); x.closePath(); }
function card(spec,th){ const T=THEMES[th]||THEMES.navy, A=T[1],B=T[2],O=T[3],S=T[4], INK="#1b2333", MU="#5b6577";
  const c=document.createElement("canvas"); c.width=1080; c.height=1080; const x=c.getContext("2d"); const k=spec.kind; const it=(spec.items||[]).slice(0,6);
  if(k==="thumb"||k==="cta"){ const g=x.createLinearGradient(0,0,1080,1080); g.addColorStop(0,A); g.addColorStop(1,B); x.fillStyle=g; x.fillRect(0,0,1080,1080);
    x.fillStyle="rgba(255,255,255,.07)"; x.beginPath(); x.arc(930,170,260,0,7); x.fill(); x.beginPath(); x.arc(120,980,180,0,7); x.fill();
    if(spec.label){ x.fillStyle=O; x.font="700 34px "+CF; x.fillText(spec.label,80,250); }
    x.fillStyle=O; x.fillRect(80,290,120,12);
    x.fillStyle="#fff"; x.font="800 "+(k==="thumb"?80:68)+"px "+CF; let y=420+dt(x,spec.title,80,420,920,k==="thumb"?100:86,4)+16;
    if(spec.sub){ x.fillStyle="rgba(255,255,255,.88)"; x.font="500 38px "+CF; y+=dt(x,spec.sub,80,y,920,54,3)+18; }
    if(k==="cta"&&it.length){ x.font="600 34px "+CF; it.slice(0,3).forEach(s=>{ x.fillStyle="rgba(255,255,255,.15)"; rr(x,80,y,920,76,38); x.fill(); x.fillStyle="#fff"; x.fillText("✓  "+s,116,y+50); y+=96; }); }
    return c; }
  x.fillStyle="#fff"; x.fillRect(0,0,1080,1080); x.fillStyle=A; x.fillRect(0,0,1080,230); x.fillStyle=O; x.fillRect(0,230,1080,10);
  x.fillStyle="#fff"; x.font="800 54px "+CF; dt(x,spec.title,80,125,920,66,2);
  const top=300;
  if(k==="checklist"){ const gap=Math.min(150,Math.floor(700/Math.max(it.length,1)));
    it.forEach((s,i)=>{ const y=top+i*gap, h=gap-20, cy=y+h/2; x.fillStyle=S; rr(x,80,y,920,h,18); x.fill(); x.fillStyle=O; x.beginPath(); x.arc(135,cy,26,0,7); x.fill();
      x.strokeStyle="#fff"; x.lineWidth=6; x.lineCap="round"; x.beginPath(); x.moveTo(123,cy+1); x.lineTo(132,cy+11); x.lineTo(149,cy-10); x.stroke();
      x.fillStyle=INK; x.font="600 36px "+CF; dt(x,s,185,cy+13,790,42,1); }); }
  else if(k==="steps"){ const g=Math.min(165,Math.floor(690/Math.max(it.length,1)));
    x.strokeStyle="#e3e8f0"; x.lineWidth=6; x.beginPath(); x.moveTo(130,top+30); x.lineTo(130,top+30+(it.length-1)*g); x.stroke();
    it.forEach((s,i)=>{ const y=top+i*g; x.fillStyle=i===it.length-1?O:A; x.beginPath(); x.arc(130,y+30,32,0,7); x.fill(); x.fillStyle="#fff"; x.font="800 32px "+CF; x.textAlign="center"; x.fillText(String(i+1),130,y+41); x.textAlign="left";
      const pr=String(s).split(/\s+[—-]\s+/); x.fillStyle=INK; x.font="700 36px "+CF; x.fillText(pr[0],190,y+32); if(pr[1]){ x.fillStyle=MU; x.font="400 29px "+CF; dt(x,pr[1],190,y+74,820,36,1); } }); }
  else if(k==="compare"){ [spec.left||{},spec.right||{}].forEach((col,ci)=>{ const cx=80+ci*470, cc=ci?O:A;
      x.fillStyle=cc; rr(x,cx,top,450,92,18); x.fill(); x.fillStyle="#fff"; x.font="700 36px "+CF; x.textAlign="center"; x.fillText(col.title||"",cx+225,top+59); x.textAlign="left";
      x.fillStyle=S; rr(x,cx,top+112,450,600,18); x.fill(); let y=top+180; x.fillStyle=INK; x.font="500 32px "+CF; (col.items||[]).slice(0,5).forEach(s=>{ y+=dt(x,"· "+s,cx+30,y,390,42,2)+30; }); }); }
  else { it.slice(0,4).forEach((s,i)=>{ const cx=80+(i%2)*470, cy=top+Math.floor(i/2)*350, pr=String(s).split(/\s+[—-]\s+/);
      x.fillStyle=S; rr(x,cx,cy,450,330,22); x.fill(); x.fillStyle=O; x.fillRect(cx+30,cy+40,60,8);
      x.fillStyle=A; x.font="800 37px "+CF; const hh=dt(x,pr[0],cx+30,cy+108,390,46,2); if(pr[1]){ x.fillStyle=INK; x.font="400 29px "+CF; dt(x,pr[1],cx+30,cy+108+hh+16,390,40,3); } }); }
  return c; }
function cardURL(p,n){ const s=(p.out.images||[])[n-1]; return s?card(s,p.style.theme).toDataURL("image/png"):""; }

/* 화면 */
function vWrite(){
  const B=$("#oa-body"), p=curPost(), L=POSTS();
  const pre=window.__OAKW||{}; window.__OAKW=null;
  const st=(p&&p.style)||D().wstyle||{gender:"여성",type:"전문형",theme:"navy"};
  const chip=(f,v,t,on)=>`<button type="button" class="oa-chip${on?" on":""}" data-ws="${f}" data-v="${E(v)}">${t}</button>`;
  B.innerHTML=`<div class="panel">
    <h2 style="margin:0 0 4px">글 만들기</h2>
    <p class="note" style="margin:0 0 12px">주제를 넣고 스타일을 고르면 네이버 상위노출 기준에 맞춘 <b>심의 제출용 원고</b>와 정보 이미지가 만들어집니다. 이미지에는 회사·지점·상품명이 들어가지 않습니다. 하루 글 5편·사진 12장까지.</p>
    <div class="oa-steps"><span class="${!p||!p.out?"on":""}">① 주제·스타일</span><span class="${p&&p.out&&p.st==="초안"?"on":""}">② 글·이미지 확인</span><span class="${p&&p.st==="심의중"?"on":""}">③ 심의</span><span class="${p&&p.st==="완료"?"on":""}">④ 최종글 복사</span></div>
    <div class="oa-wgrid">
      <label>주제 키워드 <small class="note">(필수)</small><input id="ow-kw" maxlength="30" value="${E(p?p.kw:(pre.kw||""))}" placeholder="예) 70대 간병인보험"></label>
      <label>보조 키워드 <small class="note">(쉼표로)</small><input id="ow-kw2" maxlength="120" value="${E(p?p.kw2:"")}" placeholder="예) 간병인 비용, 간병보험 가입 나이"></label>
      <label style="grid-column:1/-1">내가 확인한 사실·강조할 점 <small class="note">(선택 · 적은 내용만 사실로 씁니다)</small><textarea id="ow-facts" class="oa-ta" rows="2" maxlength="1500" placeholder="예) 상담 오면 간병인 사용일당과 간병비 실손을 헷갈려하는 분이 많음">${E(p?p.facts:"")}</textarea></label>
      <label>주요 독자 <small class="note">(선택)</small><input id="ow-tg" maxlength="120" value="${E(p?p.target:"")}" placeholder="예) 부모님 간병이 걱정되는 40~50대 자녀"></label>
    </div>
    <div class="oa-srow"><b>설계사</b>${GENS.map(g=>chip("gender",g,g+" 설계사",st.gender===g)).join("")}</div>
    <div class="oa-srow"><b>글 유형</b>${TYPES.map(([t,d])=>chip("type",t,`${t} <small>${d}</small>`,st.type===t)).join("")}</div>
    <div class="oa-srow"><b>이미지 색상</b>${Object.entries(THEMES).map(([k,v])=>`<button type="button" class="oa-sw${st.theme===k?" on":""}" data-ws="theme" data-v="${k}" title="${v[0]}" style="--a:${v[1]};--b:${v[2]};--o:${v[3]}"><i></i>${v[0]}</button>`).join("")}</div>
    <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn primary" type="button" id="ow-go" ${WBUSY?"disabled":""}>${WBUSY?"글 쓰는 중… (1분 안팎)":(p&&p.out?"이 설정으로 다시 쓰기":"글 만들기")}</button>${p?`<button class="btn" type="button" id="ow-new">새 글</button>`:""}<span class="note" id="ow-msg"></span></div>
  </div>
  ${p&&p.out?vPost(p):""}
  ${L.length?`<div class="panel" style="margin-top:14px"><h2 style="margin:0 0 8px">내가 만든 글 <small class="note">${L.length}편</small></h2><div class="tbl-wrap"><table class="oa-t"><thead><tr><th>날짜</th><th>제목</th><th>상태</th><th>심의번호</th><th></th></tr></thead><tbody>
    ${L.slice().reverse().map(x=>`<tr><td>${E(x.at)}</td><td>${E((x.out&&x.out.title)||x.kw)}</td><td>${E(x.st)}</td><td>${E(x.no||"-")}</td><td><button class="btn sm" type="button" data-owo="${x.id}">${x.id===WCUR?"보는 중":"열기"}</button> <button class="btn sm" type="button" data-owd="${x.id}">삭제</button></td></tr>`).join("")}
  </tbody></table></div></div>`:""}`;
  if(p&&p.out){ drawPost(p); loadPhotos(p).then(()=>{ if(TAB==="write"&&WCUR===p.id) drawPost(p); }); }
}
function vPost(p){
  const o=p.out, bn=BNS();
  return `<div class="panel" style="margin-top:14px">
    ${(o.warn||[]).length?`<div class="oa-rule" style="margin:0 0 10px">${o.warn.map(E).join("<br>")}</div>`:""}
    <div class="row between" style="flex-wrap:wrap;gap:8px"><h2 style="margin:0">② 글·이미지 확인</h2><small class="note">본문 ${fmt(o.stat&&o.stat.chars)}자 · 키워드 ${o.stat&&o.stat.kwCount||0}회 · ${E(p.style.gender)} · ${E(p.style.type)} · ${E((THEMES[p.style.theme]||THEMES.navy)[0])}</small></div>
    <label style="display:block;margin-top:10px">제목<input id="ow-title" value="${E(o.title)}" maxlength="80" style="width:100%"></label>
    ${(o.titles_alt||[]).length?`<small class="note">다른 제목: ${o.titles_alt.map(E).join(" / ")}</small>`:""}
    <p class="note" style="margin:10px 0 0">본문은 바로 고칠 수 있습니다(문단을 눌러 수정). 고친 내용은 자동 저장됩니다.</p>
    <div class="oa-post" id="ow-body"></div>
    ${(o.tags||[]).length?`<p class="note">태그: ${o.tags.map(t=>"#"+E(t)).join(" ")}</p>`:""}
    ${(o.checklist||[]).length?`<details class="oa-help" open><summary>심의 전에 확인할 것</summary><ul>${o.checklist.map(c=>`<li>${E(c)}</li>`).join("")}</ul></details>`:""}
    <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="btn" type="button" data-owc="review">심의용 원고 복사</button>
      <button class="btn" type="button" id="ow-dlall">이미지 전체 받기</button>
      ${p.st==="초안"?`<button class="btn primary" type="button" data-owst="심의중">심의 올렸음</button>`:""}
    </div>
  </div>
  <div class="panel" style="margin-top:14px;${p.st==="초안"?"opacity:.55":""}">
    <h2 style="margin:0 0 4px">③ 심의번호 · ④ 최종글</h2>
    <p class="note" style="margin:0 0 10px">회사 준법감시 심의를 받은 뒤 심의번호를 넣으면 글 끝에 심의필 문구와 필수기재 배너가 붙은 최종글을 복사할 수 있습니다. 심의 후에는 글을 고치지 마세요(고치면 재심의).</p>
    <div class="oa-wgrid">
      <label>심의번호<input id="ow-no" value="${E(p.no||"")}" maxlength="40" placeholder="예) 준법감시인 심의필 제2026-1234호"></label>
      <label>심의필 문구 <small class="note">(회사 양식대로)</small><input id="ow-notxt" value="${E(p.noText||"")}" maxlength="160" placeholder="예) 준법감시인 심의필 제2026-1234호 (2026.11.13~2027.11.12)"></label>
      <label>글 끝 배너<select id="ow-bn">${BN.map(([k,t])=>`<option value="${k}" ${(p.bn||"gen")===k?"selected":""}>${t}${bn[k]&&bn[k].img?"":" (미등록)"}</option>`).join("")}</select></label>
    </div>
    <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="btn primary" type="button" data-owc="final">최종글 복사 (이미지 포함)</button>
      <button class="btn" type="button" data-owc="text">본문만 복사</button>
      <button class="btn" type="button" data-owc="title">제목 복사</button>
      <span class="note" id="ow-cmsg"></span>
    </div>
    <details class="oa-help" style="margin-top:10px"><summary>네이버 블로그에 붙이는 방법</summary><ul>
      <li>네이버 글쓰기에서 제목 칸에 <b>제목 복사</b>를 붙이고, 본문 칸을 누른 뒤 <b>최종글 복사</b> → Ctrl+V.</li>
      <li>이미지가 함께 안 붙으면 <b>본문만 복사</b>로 붙인 뒤 <b>이미지 전체 받기</b>로 받은 파일을 [이미지 N]·[사진 N] 자리에 올리세요. 글 끝 배너는 <b>내 필수기재 배너</b>에서 복사.</li>
      <li>AI 사진은 이 기기에만 저장됩니다. 다른 기기에서는 사진을 다시 만들어야 합니다.</li></ul></details>
  </div>`;
}
function drawPost(p){
  const W=$("#ow-body"); if(!W) return; const o=p.out;
  W.innerHTML="";
  o.blocks.forEach((b,i)=>{
    if(b.t==="h"||b.t==="p"){ const e=document.createElement(b.t==="h"?"h3":"p"); e.textContent=b.text; e.contentEditable=p.st==="초안"?"true":"false"; e.dataset.owb=i; W.appendChild(e); }
    else if(b.t==="table"){ const w=document.createElement("div"); w.innerHTML=`${b.caption?`<div class="oa-cap">${E(b.caption)}</div>`:""}<table class="oa-pt"><tr>${(b.head||[]).map(h=>`<th>${E(h)}</th>`).join("")}</tr>${(b.rows||[]).map(r=>`<tr>${r.map(c=>`<td>${E(c)}</td>`).join("")}</tr>`).join("")}</table>`; W.appendChild(w); }
    else if(b.t==="img"){ const s=(o.images||[])[b.n-1]; if(!s) return; const f=document.createElement("figure"); f.className="oa-fig"; const c=card(s,p.style.theme); c.style.width="100%"; c.style.maxWidth="420px"; f.appendChild(c); const cap=document.createElement("figcaption"); cap.textContent="이미지 "+b.n; f.appendChild(cap); W.appendChild(f); }
    else if(b.t==="photo"){ const ph=(o.photos||[])[b.n-1]; if(!ph) return; const k=p.id+"_"+b.n, u=PHB[k]; const f=document.createElement("figure"); f.className="oa-fig oa-ph";
      f.innerHTML=u?`<img src="${u}" alt="${E(ph.ko)}"><figcaption>사진 ${b.n} · AI 생성 · ${E(ph.ko)} <button class="btn sm" type="button" data-owp="${b.n}">다시 만들기</button> <button class="btn sm" type="button" data-owpd="${b.n}">받기</button></figcaption>`
        :`<div class="oa-phslot"><b>사진 ${b.n}</b> ${E(ph.ko)}<textarea class="oa-ta" rows="2" data-owpe="${b.n}" maxlength="900">${E(ph.en)}</textarea><div class="row" style="gap:6px"><button class="btn sm primary" type="button" data-owp="${b.n}">실사 사진 만들기 (40초 안팎)</button><span class="note" data-owpm="${b.n}"></span></div></div>`;
      W.appendChild(f); }
  });
  const d=document.createElement("p"); d.className="note"; d.textContent=DISC; W.appendChild(d);
}
async function tok(){ try{ return (typeof CLOUD!=="undefined"&&CLOUD.sb)?(await CLOUD.sb.auth.getSession()).data.session?.access_token:null; }catch(e){ return null; } }
async function callW(body){ const t=await tok(); if(!t) return {ok:false,error:"보잇에 로그인해야 쓸 수 있습니다."};
  try{ const r=await fetch(WAPI,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.assign({token:t},body))}); const x=await r.text(); try{ return JSON.parse(x); }catch(e){ return {ok:false,error:"서버 응답을 읽지 못했습니다. ("+r.status+") 잠시 후 다시 눌러 주세요."}; } }
  catch(e){ return {ok:false,error:"연결에 실패했습니다. 인터넷 연결을 확인해 주세요."}; } }
function wStyle(){ const s=Object.assign({gender:"여성",type:"전문형",theme:"navy"},D().wstyle||{}); $$(".oa-chip.on,.oa-sw.on").forEach(b=>{ s[b.dataset.ws]=b.dataset.v; }); return s; }
const $$=s=>Array.from(document.querySelectorAll(s));
async function runWrite(){
  if(WBUSY) return; const kw=($("#ow-kw").value||"").trim(); const msg=t=>{ const m=$("#ow-msg"); if(m) m.textContent=t; };
  if(kw.length<2) return msg("주제 키워드를 적어 주세요.");
  const inp={kw, kw2:($("#ow-kw2").value||"").trim(), facts:($("#ow-facts").value||"").trim(), target:($("#ow-tg").value||"").trim()}; const style=wStyle(); D().wstyle=style;
  WBUSY=true; const keep=Object.assign({},inp); vWrite(); ["kw","kw2","facts","tg"].forEach(k=>{ const e=$("#ow-"+k); if(e) e.value=keep[k==="tg"?"target":k]||""; });
  const r=await callW({action:"write",kw:inp.kw,kw2:inp.kw2,facts:inp.facts,target:inp.target,gender:style.gender,type:style.type});
  WBUSY=false;
  if(r&&r.ok){ let p=curPost(); if(!p||p.st!=="초안"){ p={id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),at:td(),st:"초안",no:"",noText:"",bn:"gen"}; POSTS().push(p); }
    Object.assign(p,inp,{style,out:{title:r.title,titles_alt:r.titles_alt,summary:r.summary,keywords:r.keywords,blocks:r.blocks,images:r.images,photos:r.photos,tags:r.tags,checklist:r.checklist,warn:r.warn,stat:r.stat}});
    WCUR=p.id; const P=POSTS(); if(P.length>30) P.splice(0,P.length-30);
    const pl=D().plan.find(x=>x.keyword===kw); if(pl){ pl.post=p.id; if(pl.st==="예정") pl.st="초안"; }
    vWrite(); const m=$("#ow-msg"); if(m) m.textContent="글을 만들었습니다."+(r.left!=null?" (오늘 남은 횟수 "+r.left+"회)":""); }
  else { vWrite(); msg((r&&r.error)||"글을 만들지 못했습니다."); }
}
async function runPhoto(n,btn){
  const p=curPost(); if(!p) return; const ph=(p.out.photos||[])[n-1]; if(!ph) return;
  const ta=document.querySelector(`[data-owpe="${n}"]`); if(ta){ const v=ta.value.trim(); if(v.length>=20) ph.en=v.slice(0,900); }
  const m=document.querySelector(`[data-owpm="${n}"]`); btn.disabled=true; btn.textContent="만드는 중…";
  const r=await callW({action:"photo",prompt:ph.en});
  if(r&&r.ok&&r.img){ const k=p.id+"_"+n; PHB[k]=r.img; await IDB.put(k,r.img); drawPost(p); }
  else { btn.disabled=false; btn.textContent="실사 사진 만들기"; if(m) m.textContent=(r&&r.error)||"사진을 만들지 못했습니다."; else alert((r&&r.error)||"사진을 만들지 못했습니다."); }
}
function dlURL(u,name){ const a=document.createElement("a"); a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove(); }
function safe(s){ return String(s||"").replace(/[\\/:*?"<>|\n]/g," ").trim().slice(0,30); }
function dlAll(p){ let i=0; p.out.blocks.forEach(b=>{ if(b.t==="img"){ const u=cardURL(p,b.n); if(u) setTimeout(()=>dlURL(u,`${safe(p.out.title)}_이미지${b.n}.png`),(i++)*400); } else if(b.t==="photo"){ const u=PHB[p.id+"_"+b.n]; if(u) setTimeout(()=>dlURL(u,`${safe(p.out.title)}_사진${b.n}.jpg`),(i++)*400); } }); if(!i) alert("받을 이미지가 없습니다."); }
function postParts(p,mode){ // mode: review | text | final
  const o=p.out, H=[], T=[];
  o.blocks.forEach(b=>{
    if(b.t==="h"){ H.push(`<h3>${E(b.text)}</h3>`); T.push("■ "+b.text); }
    else if(b.t==="p"){ H.push(`<p>${E(b.text)}</p>`); T.push(b.text); }
    else if(b.t==="table"){ H.push((b.caption?`<p><b>${E(b.caption)}</b></p>`:"")+`<table border="1" cellpadding="6" style="border-collapse:collapse">${[`<tr>${(b.head||[]).map(h=>`<th>${E(h)}</th>`).join("")}</tr>`].concat((b.rows||[]).map(r=>`<tr>${r.map(c=>`<td>${E(c)}</td>`).join("")}</tr>`)).join("")}</table>`); T.push((b.caption?b.caption+"\n":"")+[b.head||[]].concat(b.rows||[]).map(r=>"| "+r.join(" | ")+" |").join("\n")); }
    else if(b.t==="img"){ const s=(o.images||[])[b.n-1]; if(!s) return; if(mode==="final"){ H.push(`<p><img src="${cardURL(p,b.n)}" width="540"></p>`); } else { H.push(`<p style="color:#c2410c">[이미지 ${b.n}: ${E(s.title)}]</p>`); } T.push(`[이미지 ${b.n}: ${s.title}]`); }
    else if(b.t==="photo"){ const ph=(o.photos||[])[b.n-1]; if(!ph) return; const u=PHB[p.id+"_"+b.n]; if(mode==="final"&&u){ H.push(`<p><img src="${u}" width="720"></p>`); } else { H.push(`<p style="color:#c2410c">[사진 ${b.n}: ${E(ph.ko)}]</p>`); } T.push(`[사진 ${b.n}: ${ph.ko}]`); }
  });
  H.push(`<p>${E(DISC)}</p>`); T.push(DISC);
  if(mode!=="review"){ const nt=p.noText||p.no; if(nt){ H.push(`<p>${E(nt)}</p>`); T.push(nt); } if(mode==="final"){ const bu=(BNS()[p.bn||"gen"]||{}).img; if(bu) H.push(`<p><img src="${bu}" width="720"></p>`); else T.push("[필수기재 배너]"); } else T.push("[필수기재 배너]"); }
  return {html:H.join(""),text:T.join("\n\n")};
}
async function copyPost(p,mode,btn){
  const msg=t=>{ const m=$("#ow-cmsg"); if(m) m.textContent=t; };
  if(mode==="title"){ try{ await navigator.clipboard.writeText(p.out.title); msg("제목을 복사했습니다."); }catch(e){ msg("복사하지 못했습니다."); } return; }
  if((mode==="final"||mode==="text")&&!p.no){ alert("심의번호를 먼저 넣어 주세요. 보험 광고는 심의 후 게시해야 합니다 (금융소비자보호법 제22조)."); return; }
  if(mode==="final"&&!(BNS()[p.bn||"gen"]||{}).img&&!confirm("글 끝 필수기재 배너가 등록되지 않았습니다. 배너 없이 복사할까요?")) return;
  const pt=postParts(p,mode==="review"?"review":mode);
  try{ if(navigator.clipboard&&window.ClipboardItem) await navigator.clipboard.write([new ClipboardItem({"text/html":new Blob([pt.html],{type:"text/html"}),"text/plain":new Blob([pt.text],{type:"text/plain"})})]); else await navigator.clipboard.writeText(pt.text);
    const o=btn.textContent; btn.textContent="복사됨"; setTimeout(()=>btn.textContent=o,1600);
    if(mode==="final"){ p.st="완료"; const pl=D().plan.find(x=>x.post===p.id||x.keyword===p.kw); if(pl){ pl.no=p.no; pl.post=p.id; } msg("네이버 글쓰기 본문에 붙여넣으세요. 발행 후 콘텐츠 계획에 발행 주소를 넣어 두세요."); }
    else if(mode==="review") msg("심의 제출 양식에 붙여넣으세요. 이미지는 '이미지 전체 받기'로 함께 제출합니다.");
  }catch(e){ msg("이 브라우저에서는 복사가 안 됩니다. 다른 브라우저(크롬)로 열어 주세요."); }
}

/* ---------- 4. 자동화 목록 ---------- */
function vMore(){
  const B=$("#oa-body");
  const L=[
    ["블로그 키워드 조사","네이버 월간 검색량 + 블로그 상위글 경쟁도로 쓸 키워드 고르기","사용 중","kw"],
    ["콘텐츠 계획","키워드별 발행일·심의번호·발행 주소 관리","사용 중","plan"],
    ["글 만들기","키워드·스타일(설계사 성별·글 유형·색상)로 심의 제출용 원고 + 정보 이미지 + AI 실사 사진 → 심의번호·배너 붙여 최종글 복사","사용 중","write"],
    ["카페 글","블로그 글을 카페용(질문·후기형 금지, 정보형)으로 다시 쓰기","준비중"],
    ["내 필수기재 배너","설계사별 등록번호 배너를 등록해 두고 글 끝에 복사해 붙이기","사용 중","banner"],
    ["이미지·썸네일","글 만들기 안에서 정보 이미지 6장·실사 사진 2장 자동 생성","사용 중","write"],
    ["발행 후 순위 확인","발행한 글이 키워드 검색에서 몇 위인지 주기적으로 확인","준비중"],
    ["네이버 로직 점검","2주마다 네이버 검색 정책·공지 변화를 확인해 글쓰기 기준 갱신","준비중"],
    ["인스타·쇼츠","블로그 글을 인스타 글·쇼츠 대본으로 바꾸기","준비중"]];
  B.innerHTML=`<div class="oa-grid">${L.map(([t,d,s,go])=>`<div class="panel oa-card"><div class="row between"><b>${t}</b><span class="pill" style="background:${s==="사용 중"?"var(--accent-soft)":"var(--surface-2,#f1f1f1)"};color:${s==="사용 중"?"var(--ok)":"var(--muted)"}">${s}</span></div><p class="note" style="margin:6px 0 0">${d}</p>${go?`<button class="btn sm" type="button" data-oat="${go}" style="margin-top:10px;align-self:flex-start">열기</button>`:""}</div>`).join("")}</div>`;
}

/* ---------- 이벤트 ---------- */
document.addEventListener("click",e=>{ const t=e.target; if(!t||!t.closest||!t.closest("#oa-root")) return;
  const tb=t.closest("[data-oat]"); if(tb){ TAB=tb.dataset.oat; render(); return; }
  if(t.closest("#oa-go")){ runKw(); return; }
  const ws=t.closest("[data-ws]"); if(ws){ const f=ws.dataset.ws, v=ws.dataset.v; $$(`[data-ws="${f}"]`).forEach(b=>b.classList.toggle("on",b===ws)); const st=D().wstyle=Object.assign({gender:"여성",type:"전문형",theme:"navy"},D().wstyle||{}); st[f]=v; const p=curPost(); if(p&&p.out&&f==="theme"){ if(p.st==="초안"){ p.style.theme=v; drawPost(p); } else alert("심의에 올린 뒤에는 이미지를 바꾸면 다시 심의를 받아야 합니다."); } return; }
  if(t.closest("#ow-go")){ runWrite(); return; }
  if(t.closest("#ow-new")){ WCUR=null; vWrite(); return; }
  const wo=t.closest("[data-owo]"); if(wo){ WCUR=wo.dataset.owo; vWrite(); return; }
  const wd=t.closest("[data-owd]"); if(wd){ if(confirm("이 글을 삭제할까요?")){ const P=POSTS(); const i=P.findIndex(x=>x.id===wd.dataset.owd); if(i>=0){ const x=P[i]; (x.out&&x.out.photos||[]).forEach((_,j)=>{ IDB.del(x.id+"_"+(j+1)); delete PHB[x.id+"_"+(j+1)]; }); P.splice(i,1); } if(WCUR===wd.dataset.owd) WCUR=null; vWrite(); } return; }
  const wp=t.closest("[data-owp]"); if(wp){ runPhoto(+wp.dataset.owp,wp); return; }
  const wpd=t.closest("[data-owpd]"); if(wpd){ const p=curPost(); const u=p&&PHB[p.id+"_"+wpd.dataset.owpd]; if(u) dlURL(u,`${safe(p.out.title)}_사진${wpd.dataset.owpd}.jpg`); return; }
  const wc=t.closest("[data-owc]"); if(wc){ const p=curPost(); if(p&&p.out) copyPost(p,wc.dataset.owc,wc); return; }
  if(t.closest("#ow-dlall")){ const p=curPost(); if(p&&p.out) dlAll(p); return; }
  const wst=t.closest("[data-owst]"); if(wst){ const p=curPost(); if(p){ p.st=wst.dataset.owst; const pl=D().plan.find(x=>x.post===p.id); if(pl&&pl.st!=="발행") pl.st="심의중"; vWrite(); } return; }
  const aw=t.closest("[data-oaw]"); if(aw){ const pl=D().plan.find(x=>x.id===aw.dataset.oaw); if(pl){ if(pl.post&&POSTS().some(x=>x.id===pl.post)) WCUR=pl.post; else { WCUR=null; window.__OAKW={kw:pl.keyword}; } TAB="write"; render(); } return; }
  const a=t.closest("[data-oaadd]"); if(a){ const r=(D().last||{}).rows||[]; const x=r[+a.dataset.oaadd]; if(x){ addPlan(x); render(); } return; }
  if(t.closest("#oa-addall")){ const r=(D().last||{}).rows||[]; let n=0; r.filter(x=>x.verdict==="최적"||x.verdict==="가능").forEach(x=>{ if(addPlan(x)) n++; }); render(); const m=$("#oa-msg"); if(m) m.textContent=n?n+"개를 계획에 담았습니다.":"새로 담을 키워드가 없습니다."; return; }
  if(t.closest("#oa-nadd")){ const k=($("#oa-nk").value||"").trim().slice(0,30); if(k.length>=2){ addPlan({keyword:k,verdict:"",search:0}); render(); } return; }
  const bc=t.closest("[data-oabc]"); if(bc){ const tr=bc.closest("[data-oap]"); let k=bc.dataset.oabc; if(tr){ const sel=tr.querySelector('[data-f="bn"]'); if(sel) k=sel.value; } copyBanner(k,bc); return; }
  const bd=t.closest("[data-oabd]"); if(bd){ dlBanner(bd.dataset.oabd); return; }
  const bx=t.closest("[data-oabx]"); if(bx){ if(confirm("이 배너 이미지를 삭제할까요?")){ delete BNS()[bx.dataset.oabx]; render(); } return; }
  const d=t.closest("[data-oadel]"); if(d){ if(confirm("이 계획을 삭제할까요?")){ const P=D().plan; const i=P.findIndex(p=>p.id===d.dataset.oadel); if(i>=0) P.splice(i,1); render(); } return; }
});
document.addEventListener("change",e=>{ const t=e.target; if(!t||!t.closest) return;
  if(t.id==="ow-title"||t.id==="ow-no"||t.id==="ow-notxt"||t.id==="ow-bn"){ const p=curPost(); if(!p) return; const v=String(t.value||"").trim();
    if(t.id==="ow-title"){ if(p.st!=="초안"&&v!==p.out.title&&!confirm("심의 후 제목을 바꾸면 다시 심의를 받아야 합니다. 바꿀까요?")){ t.value=p.out.title; return; } p.out.title=v.slice(0,80); }
    if(t.id==="ow-no"){ p.no=v.slice(0,40); if(v&&p.st==="초안") p.st="심의중"; if(!p.noText&&v){ p.noText=/심의필/.test(v)?v:"준법감시인 심의필 제"+v+"호"; const n2=$("#ow-notxt"); if(n2) n2.value=p.noText; } }
    if(t.id==="ow-notxt") p.noText=v.slice(0,160);
    if(t.id==="ow-bn") p.bn=v;
    return; }
  if(t.dataset&&t.dataset.oabu&&t.closest("#oa-root")){ const k=t.dataset.oabu, f=t.files&&t.files[0]; if(!f) return;
    loadImg(f).then(u=>{ BNS()[k]={img:u,name:String(f.name||"").slice(0,60),at:td()}; render(); }).catch(er=>{ const m=$("#oa-bmsg"); if(m) m.textContent=er.message; else alert(er.message); }); return; }
  const tr=t.closest("[data-oap]"); if(!tr||!t.dataset.f) return;
  const p=D().plan.find(x=>x.id===tr.dataset.oap); if(!p) return; const f=t.dataset.f; let v=String(t.value||"").trim();
  if(f==="url"&&v&&!/^https?:\/\//.test(v)){ alert("주소는 https:// 로 시작해야 합니다."); t.value=p.url; return; }
  if(f==="st"&&v==="발행"&&!p.no){ alert("심의번호를 먼저 넣어 주세요. 보험 광고는 심의 후 게시해야 합니다."); t.value=p.st; return; }
  p[f]=v; if(f==="st"||f==="date") vPlan();
});
document.addEventListener("input",e=>{ const t=e.target; if(!t||!t.dataset||t.dataset.owb==null) return; const p=curPost(); if(!p||!p.out) return; const b=p.out.blocks[+t.dataset.owb]; if(b) b.text=t.innerText.replace(/\n+/g," ").trim(); });
document.addEventListener("keydown",e=>{ if(e.key==="Enter"&&e.target&&e.target.id==="oa-nk"){ e.preventDefault(); const b=$("#oa-nadd"); if(b) b.click(); } });

const css=document.createElement("style"); css.textContent=`
.nav .grp[data-g="7"]{--g:var(--c5)}
.oa-rule{margin-top:12px;padding:10px 14px;border-radius:10px;background:var(--warn-soft);color:var(--warn);font-size:13.5px}.oa-rule b{color:inherit}
.oa-ta{width:100%;border:1px solid var(--line);border-radius:8px;padding:9px 11px;background:var(--surface);font:inherit;resize:vertical}
.oa-t td,.oa-t th{white-space:nowrap;vertical-align:middle}.oa-t td.num{text-align:right}
.oa-t input,.oa-t select{font:inherit;font-size:13.5px;padding:4px 6px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:inherit}
.oa-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.oa-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.oa-card{display:flex;flex-direction:column}
.oa-bgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.oa-bslot{border:1px solid var(--line);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px}
.oa-bslot img{width:100%;border-radius:6px;border:1px solid var(--line);background:#fff}
.oa-bdrop{display:flex;align-items:center;justify-content:center;min-height:110px;border:2px dashed var(--line);border-radius:8px;color:var(--muted);cursor:pointer;font-size:14px}.oa-bdrop:hover{border-color:var(--accent);color:var(--accent)}
.oa-steps{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}.oa-steps span{font-size:13px;padding:5px 10px;border-radius:999px;background:var(--surface-2,#f1f1f1);color:var(--muted)}.oa-steps span.on{background:var(--accent);color:#fff;font-weight:700}
.oa-wgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}.oa-wgrid label{display:flex;flex-direction:column;gap:4px;font-size:13.5px;font-weight:600}.oa-wgrid input,.oa-wgrid select{font:inherit;font-weight:400;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:inherit}
.oa-srow{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:10px}.oa-srow>b{font-size:13.5px;min-width:80px}
.oa-chip{font:inherit;font-size:13.5px;padding:6px 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:inherit;cursor:pointer}.oa-chip small{color:var(--muted);font-size:11.5px;margin-left:4px}.oa-chip.on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent);font-weight:700}
.oa-sw{font:inherit;font-size:13px;display:inline-flex;align-items:center;gap:6px;padding:5px 10px 5px 6px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:inherit;cursor:pointer}.oa-sw i{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,var(--a) 0 55%,var(--o) 55%)}.oa-sw.on{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft);font-weight:700}
.oa-post{margin-top:12px;border:1px solid var(--line);border-radius:12px;padding:20px 22px;background:#fff;color:#222;max-width:760px;line-height:1.85}.oa-post p{margin:0 0 14px;font-size:15.5px}.oa-post h3{font-size:18px;margin:24px 0 10px;padding-left:10px;border-left:4px solid var(--accent)}.oa-post [contenteditable="true"]:focus{outline:2px dashed var(--accent);outline-offset:3px}
.oa-fig{margin:16px 0}.oa-fig img{width:100%;max-width:640px;border-radius:8px;display:block}.oa-fig figcaption{font-size:12px;color:#888;margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.oa-phslot{border:2px dashed #f0c48a;background:#fff8ef;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;font-size:13.5px;color:#7a4a10}
.oa-cap{font-weight:700;font-size:14px;margin:8px 0 6px}.oa-pt{width:100%;border-collapse:collapse;font-size:14px;margin-bottom:14px}.oa-pt th,.oa-pt td{border:1px solid #ddd;padding:7px 9px;text-align:left}.oa-pt th{background:#f6f7f8}
.oa-help summary{cursor:pointer;color:var(--muted);font-size:13.5px}.oa-help ul{margin:8px 0 0;padding-left:18px;font-size:13.5px;color:var(--muted);display:flex;flex-direction:column;gap:4px}
`; document.head.appendChild(css);

window.ONLINE={render};
if(document.readyState!=="loading") render(); else document.addEventListener("DOMContentLoaded",render);
})();
