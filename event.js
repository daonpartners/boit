/* 보잇 · 제안·영업 › 소개 이벤트 (2026-11-18 초안)
   설계사가 이벤트(주제·기간·내용·감사 선물)를 만들고 → 개인페이지에 반영 → 이벤트 링크·고객별 소개 링크·QR·공유 문구로 퍼뜨림.
   - 저장: ME.events (보잇 저장과 함께 클라우드 보관), 공개: boit_pages.data.events (개인페이지 공개 때 같이 올라감)
   - 고객 화면: p.html?u=주소&ev=이벤트&r=소개자코드 → 이벤트 카드 + '참여 신청'(설계사에게 문자) + '친구에게 전하기'
   - 소개받는 분이 직접 신청하는 방식(소개자가 남의 연락처를 대신 적지 않음)
   - 보험업법 제98조·시행령 제46조: 계약자에게 주는 금품은 최초 1년 보험료 10%와 3만원 중 적은 금액까지 → 계약 조건 선물 문구 막음 */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const G=n=>{ try{ return eval(n); }catch(_){ return null; } };
const today=()=>new Date(Date.now()+9*3600e3).toISOString().slice(0,10);
const addDays=(d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x.toISOString().slice(0,10); };
const fmtD=v=>{ const d=String(v||"").replace(/\D/g,""); return d.length===8?`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6)}`:v; };

const TPL=[
 {t:"가족 보험 무료 점검",sub:"우리 가족 보험, 겹치거나 빠진 곳 없을까요?",body:"가입하신 보험을 한 번에 모아 보장이 겹치거나 빠진 곳이 없는지 무료로 점검해 드립니다.\n보험을 새로 들라는 상담이 아니라, 지금 가진 보험을 제대로 아는 시간입니다.",gift:"점검 후 보장 정리표(PDF) 드림"},
 {t:"숨은 보험금 찾기",sub:"3년 안의 병원비, 아직 안 받은 보험금이 있을 수 있어요",body:"최근 3년 진료 기록과 가입 보험을 비교해 청구하지 않은 보험금이 있는지 찾아 드립니다.\n보험금 청구권은 3년이 지나면 사라집니다(상법 제662조).",gift:"청구 서류 준비 도움"},
 {t:"우리 가게 화재보험 점검",sub:"사장님 가게, 불나면 정말 다 보상될까요?",body:"가게 화재보험·배상책임보험의 가입금액과 보장 범위를 점검해 드립니다.\n의무보험(다중이용업소 화재배상책임 등) 가입 대상인지도 함께 확인합니다.",gift:"가게 보험 점검표 드림"},
 {t:"아이 보험 정리",sub:"태아·어린이 보험, 지금 구성 괜찮을까요?",body:"자녀 보험의 보장 구성과 만기, 갱신 여부를 정리해 드립니다.",gift:"자녀 보장 정리표 드림"},
 {t:"새해 보험 다이어트",sub:"보험료는 줄이고 보장은 지키기",body:"겹치는 보장과 꼭 필요한 보장을 구분해 보험료 부담을 줄일 방법을 함께 찾아 드립니다.\n해지·변경은 손해가 없는지 먼저 확인한 뒤 결정하세요.",gift:"보험료 정리표 드림"}
];
/* 계약 조건 선물·고액 금품 문구 검사 */
function warn(e){ const t=[e.title,e.sub,e.body,e.gift].join(" "), w=[];
  if(/(계약|가입|체결|청약)\s*(하시면|하면|시|고객|완료|조건|만\s*해도)/.test(t)&&/(드림|드려|증정|선물|지급|사은|혜택|상품권|현금|쿠폰)/.test(t)) w.push("‘가입하면 선물’처럼 계약을 조건으로 한 혜택은 특별이익 제공(보험업법 제98조)이 될 수 있습니다.");
  const won=[...t.matchAll(/(\d[\d,]*)\s*(만\s*원|만원|원)/g)].map(m=>{ const n=+m[1].replace(/,/g,""); return /만/.test(m[2])?n*10000:n; });
  if(won.some(n=>n>30000)) w.push("3만원을 넘는 금품은 쓸 수 없습니다(보험업법 시행령 제46조: 최초 1년 보험료 10%와 3만원 중 적은 금액).");
  if(/현금|보험료\s*(대납|지원|할인)|수수료\s*(나눔|환급)/.test(t)) w.push("현금·보험료 대납·할인·수수료 나눔은 금지된 특별이익입니다.");
  return w; }

const S={sel:null,ref:"",draft:null,tpl:null};
function EV(){ const M=G("ME"); if(!M) return []; if(!Array.isArray(M.events)) M.events=[]; return M.events; }
function save(){ if(S.draft) return; try{ const f=G("cloudSave"); if(f) f(true); }catch(_){} }
function base(){ try{ return (G("hpUrl")&&G("hpUrl")())||""; }catch(_){ return ""; } }
function link(e,ref){ const b=base(); if(!b) return ""; return b+"&ev="+encodeURIComponent(e.id)+(ref?"&r="+encodeURIComponent(ref):""); }
function state(e){ const d=today(); if(!e.on) return ["꺼짐","x"]; if(e.start&&d<e.start) return ["예정","y"]; if(e.end&&d>e.end) return ["종료","x"]; return ["진행 중","g"]; }
const refOf=c=>"c"+Number(String(c.id).replace(/\D/g,"")||0).toString(36);

/* QR */
function libQR(){ return window.QRCode?Promise.resolve():new Promise((ok,no)=>{ const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; s.onload=ok; s.onerror=no; document.head.appendChild(s); }); }
async function drawQR(box,text){ box.innerHTML=""; if(!text) return; try{ await libQR(); new window.QRCode(box,{text,width:150,height:150,correctLevel:window.QRCode.CorrectLevel.M}); }catch(_){ box.textContent="QR을 만들지 못했습니다"; } }

function shareText(e,url){ const M=G("ME")||{}; return `[${e.title}]\n${e.sub||""}\n\n${(e.body||"").split("\n")[0]}\n${e.start||e.end?`기간: ${e.start||""} ~ ${e.end||""}\n`:""}\n신청·문의: ${url}\n\n${M.name||""} ${M.phone||""}`.replace(/\n{3,}/g,"\n\n"); }

function cur(){ return EV().find(x=>x.id===S.sel)||S.draft||null; }
function pgd(){ try{ const f=G("pgData"); if(f) return f(); }catch(_){} const M=G("ME")||{}; return {name:M.name||"",company:M.company||"",branch:M.branch||"",phone:M.phone||""}; }
/* 오른쪽 미리보기: 개인페이지에 걸릴 이벤트 카드 + 공유 문구 (저장 전 내용 그대로) */
function pvHTML(e){ const d=pgd(), u=link(e,S.ref)||"(개인페이지 주소)", c=d.color||"#0E7A5F";
  return `<div class="evp" style="--hpc:${esc(c)}"><div class="evp-top"><span class="av">${d.photo&&/^(data:image\/|https:)/.test(d.photo)?`<img src="${esc(d.photo)}" alt="">`:esc((d.name||"?").slice(0,1))}</span><span><b>${esc(d.name||"")} 설계사</b><small>${esc([d.company,d.branch].filter(Boolean).join(" "))}</small></span></div>
    <div class="ev"><span class="lb">진행 중인 이벤트</span><h4>${esc(e.title||"(제목)")}</h4>${e.sub?`<p class="sb">${esc(e.sub)}</p>`:""}
    ${String(e.body||"").split("\n").filter(Boolean).map(t=>`<p>${esc(t)}</p>`).join("")}
    ${(e.imgs||[]).map(s=>`<img class="ei" src="${s}" alt="">`).join("")}
    ${e.gift?`<div class="gf">🎁 ${esc(e.gift)}</div>`:""}${e.start||e.end?`<div class="dt">기간 ${esc(e.start||"")} ~ ${esc(e.end||"")}</div>`:""}
    <div class="two"><span class="cta">${esc(e.cta||"참여 신청하기")}</span><span class="cta" style="background:#fff;color:var(--hpc);border:1px solid currentColor">친구에게 전하기</span></div></div>
    <p class="evp-n">참여 신청을 누르면 이름·휴대폰·개인정보 동의 칸이 열리고, 신청은 신청 DB로 들어옵니다.</p></div>
  <b style="font-size:13px;display:block;margin:12px 0 4px">공유 문구 (카톡·문자)</b><div class="evp-bub">${esc(shareText(e,u))}</div>`; }
function pvUpd(){ const e=cur(), x=$("#ev-pv"); if(e&&x) x.innerHTML=pvHTML(e); }
function stepNo(e){ if(!e) return 1; if(S.draft) return 2; return e.pub?4:3; }
function canPub(e){ return !!base()&&!warn(e).length; }
/* 4단계: 보내기 — 휴대폰에서는 카톡·문자앱이 바로 열리고, PC에서는 문구를 복사해 카카오톡 PC에 붙여넣기 (연결·가입 필요 없음) */
function sendBox(e){ const CU=G("CUSTOMERS")||[], u=e.pub?link(e,S.ref):"";
  return `<div class="ev-send${u?"":" off"}"><b style="font-size:14px">4. 고객에게 보내기</b>
    ${u?`<div class="field" style="margin-top:6px"><label for="ev-ref">누구에게 보내나요?</label><select id="ev-ref"><option value="">아무나 (기본 링크)</option>${CU.map(c=>`<option value="${esc(refOf(c))}" ${S.ref===refOf(c)?"selected":""}>${esc(c.name)} 님 (이분이 소개하면 표시됨)</option>`).join("")}</select></div>
    <div class="ev-sbtn"><button class="btn primary" type="button" id="ev-kakao">카카오톡으로 보내기</button><button class="btn primary" type="button" id="ev-smsb">문자로 보내기</button><button class="btn" type="button" id="ev-copy">링크만 복사</button><button class="btn" type="button" id="ev-qrb">QR</button></div>
    <p class="note" id="ev-smsg" style="margin:6px 0 0">${isMob()?"누르면 카카오톡·문자앱이 열리고 문구가 들어가 있습니다. 받는 사람만 고르세요.":"PC: 누르면 문구가 복사됩니다 → 카카오톡 대화창에 붙여넣기(Ctrl+V). 휴대폰에서 누르면 카톡·문자앱이 바로 열립니다."}</p>
    <div id="ev-qrw" hidden style="text-align:center;margin-top:8px"><div id="ev-qr" class="ev-qr" style="display:inline-block"></div><p class="note" style="margin:4px 0 0">명함·매장에 붙이거나 휴대폰 카메라로 찍게 하세요</p></div>`
    :`<p class="note" style="margin:6px 0 0">3단계 [저장하고 개인페이지에 올리기]를 마치면 여기서 카카오톡·문자로 바로 보낼 수 있습니다.</p>`}</div>`; }
/* 포스터(A4)·QR: 이미지 저장 · PDF 저장 · 출력 — 매장·명함·단톡방에 쓰기 */
function outBox(e){ const u=link(e,S.ref);
  return `<div class="ev-out"><b style="font-size:14px">포스터 · QR 내려받기 / 출력</b>
    <p class="note" style="margin:4px 0 8px">${u?"이벤트 내용·사진·QR(찍으면 신청 화면)·내 연락처가 A4 한 장에 들어갑니다.":"QR은 개인페이지에 올린 뒤 들어갑니다. 지금은 QR 없이 만들어집니다."}</p>
    <div class="ev-sbtn"><button class="btn" type="button" id="ev-png">이미지 저장</button><button class="btn" type="button" id="ev-pdf">PDF 저장</button><button class="btn primary" type="button" id="ev-print">출력</button><button class="btn" type="button" id="ev-qrdl" ${u?"":"disabled"}>QR만 저장</button></div>
    <p class="note" id="ev-omsg" style="margin:6px 0 0"></p></div>`; }
function posterHTML(e,u){ const d=pgd(), c=d.color||"#0E7A5F";
  return `<div class="evpo" style="--hpc:${esc(c)}"><div class="evpo-h"><span class="evpo-lb">EVENT</span><h1>${esc(e.title||"")}</h1>${e.sub?`<p class="evpo-sb">${esc(e.sub)}</p>`:""}</div>
    <div class="evpo-b">${String(e.body||"").split("\n").filter(Boolean).map(t=>`<p>${esc(t)}</p>`).join("")}
    ${(e.imgs||[]).length?`<div class="evpo-im n${Math.min(4,(e.imgs||[]).length)}">${(e.imgs||[]).map(s=>`<img src="${s}" alt="">`).join("")}</div>`:""}
    ${e.gift?`<div class="evpo-gf">🎁 ${esc(e.gift)}</div>`:""}${e.start||e.end?`<div class="evpo-dt">기간 ${esc(e.start||"")} ~ ${esc(e.end||"")}</div>`:""}</div>
    <div class="evpo-f"><div class="evpo-me"><b>${esc(d.name||"")} 설계사</b><span>${esc([d.company,d.branch].filter(Boolean).join(" "))}</span><span class="evpo-ph">${esc(d.phone||"")}</span></div>
    ${u?`<div class="evpo-q"><div id="evpo-qr"></div><small>휴대폰 카메라로 찍으면<br>신청 화면이 열립니다</small></div>`:""}</div></div>`; }
async function posterCanvas(e){ const u=link(e,S.ref); let host=$("#evpo-host"); if(!host){ host=document.createElement("div"); host.id="evpo-host"; document.body.appendChild(host); }
  host.innerHTML=posterHTML(e,u); if(u){ const q=$("#evpo-qr"); await drawQR(q,u); }
  await Promise.all([...host.querySelectorAll("img")].map(im=>im.complete?0:new Promise(r=>{ im.onload=im.onerror=r; })));
  if(document.fonts&&document.fonts.ready) await document.fonts.ready;
  if(!window.html2canvas) throw new Error("tool");
  const cv=await window.html2canvas(host.firstElementChild,{scale:2,backgroundColor:"#ffffff",useCORS:true}); host.innerHTML=""; return cv; }
const fname=(e,ext)=>`이벤트_${String(e.title||"").replace(/[\\/:*?"<>|\s]+/g,"_").slice(0,30)}.${ext}`;
async function saveBlob(blob,name){ const D=G("DL"); if(D&&D.save){ await D.save({filename:name,data:blob}); return; } const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000); }
function shrinkImg(file){ return new Promise(ok=>{ const fr=new FileReader(); fr.onload=()=>{ const im=new Image(); im.onload=()=>{ const m=900, r=Math.min(1,m/Math.max(im.width,im.height)), c=document.createElement("canvas"); c.width=Math.round(im.width*r); c.height=Math.round(im.height*r); const x=c.getContext("2d"); x.fillStyle="#fff"; x.fillRect(0,0,c.width,c.height); x.drawImage(im,0,0,c.width,c.height); ok(c.toDataURL("image/jpeg",.82)); }; im.onerror=()=>ok(null); im.src=fr.result; }; fr.onerror=()=>ok(null); fr.readAsDataURL(file); }); }
const isMob=()=>/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
function draw(){
  const sec=document.querySelector('section[data-view="event"]'); if(!sec) return;
  const L=EV(), e=cur(), b=base();
  sec.innerHTML=`<div class="row between" style="margin-top:12px"><div><h2 style="margin:0">이벤트 페이지 <span class="note" style="font-weight:400">내 개인페이지 안에 이벤트 칸이 하나 더 붙습니다 · 신청은 신청 DB로</span></h2></div><div class="row" style="gap:6px">${b?`<a class="btn sm" href="${esc(b)}" target="_blank" rel="noopener">내 개인페이지 보기 ↗</a>`:""}<button class="btn sm" type="button" data-go="homepage">개인페이지 고치기</button></div></div>
  <div class="ev-steps">${["주제 고르기","내용 고치기","저장하고 개인페이지에 올리기","고객에게 보내기 (카톡·문자)"].map((t,i)=>`<span class="${i+1<stepNo(e)?"done":i+1===stepNo(e)?"on":""}"><b>${i+1}</b>${t}</span>`).join("")}</div>
  ${!b?`<div class="panel" style="border:2px solid #E09A12;background:#FFF3D1;margin-top:12px"><b>먼저 개인페이지를 만들어 주세요.</b> 이벤트는 내 개인페이지 안에 올라갑니다. 개인페이지가 있어야 고객에게 이벤트 링크를 보낼 수 있습니다. <button class="btn hot sm" type="button" data-go="homepage">개인페이지 만들기</button></div>`:""}
  ${L.length?`<div style="margin-top:12px"><b style="font-size:14px">내 이벤트</b><div class="ev-row">${L.map(x=>{ const s=state(x); return `<button type="button" class="ev-it${x.id===S.sel?" on":""}" data-evsel="${esc(x.id)}"><b>${esc(x.title||"(제목 없음)")}</b><span class="hm-flag ${s[1]}" style="margin:0">${s[0]}</span><small>${esc(x.start||"")} ~ ${esc(x.end||"")}</small></button>`; }).join("")}</div></div>`:""}
  <div style="margin-top:12px"><b style="font-size:14px">${L.length?"새 이벤트 — 주제 고르기":"이벤트 주제 고르기"}</b><div class="ev-row">${TPL.map((t,i)=>`<button type="button" class="ev-tp${S.draft&&S.tpl===i?" on":""}" data-evtpl="${i}"><b>${esc(t.t)}</b><span>${esc(t.sub)}</span></button>`).join("")}<button type="button" class="ev-tp${S.draft&&S.tpl===-1?" on":""}" data-evtpl="-1"><b>직접 만들기</b><span>주제와 내용을 처음부터 씁니다</span></button></div></div>
  ${e?`<div class="ev-2col"><div class="ev-main">${editor(e)}</div><div class="ev-pvw">${e.pub&&!S.draft?sendBox(e).replace('class="ev-send','style="margin:0 0 12px" class="ev-send'):""}<b style="font-size:13px">미리보기 — 개인페이지에서 고객이 보는 화면</b><div class="ev-phone" id="ev-pv">${pvHTML(e)}</div>${e.pub&&!S.draft?"":sendBox(e)}${outBox(e)}</div></div>`
    :`<p class="note" style="margin-top:14px">위에서 이벤트나 주제를 누르세요.</p>`}`;
}
function wbox(W){ return W.length?`<div class="ev-warn">${W.map(x=>`<div>⚠ ${esc(x)}</div>`).join("")}</div>`:""; }
function editor(e){
  const W=warn(e), u=link(e,S.ref), CU=G("CUSTOMERS")||[], s=state(e);
  return `<div class="panel"><div class="row between"><h2 style="font-size:16px;margin:0">이벤트 내용 <span class="hm-flag ${s[1]}" style="margin-left:6px">${s[0]}</span></h2><div class="row" style="gap:6px"><label style="display:flex;gap:5px;align-items:center;font-size:13px"><input type="checkbox" data-evf="on" ${e.on?"checked":""}> 개인페이지에 보이기</label>${S.draft?`<button class="btn sm" type="button" id="ev-del">닫기</button>`:`<button class="btn sm" type="button" id="ev-del">삭제</button>`}</div></div>
    <p class="note" style="margin:4px 0 0">2. 내용 고치기 — 고치면 오른쪽 미리보기가 바로 바뀝니다${S.draft?" · 아직 저장 전":""}</p>
    <div class="grid3" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:10px">
      <div class="field" style="grid-column:1/-1"><label>제목</label><input data-evf="title" value="${esc(e.title)}" placeholder="예: 가족 보험 무료 점검"></div>
      <div class="field" style="grid-column:1/-1"><label>한 줄 소개</label><input data-evf="sub" value="${esc(e.sub)}"></div>
      <div class="field" style="grid-column:1/-1"><label>내용</label><textarea data-evf="body" rows="4" style="border:1px solid var(--line);border-radius:8px;padding:9px 11px;font:inherit;background:var(--surface);color:var(--fg)">${esc(e.body)}</textarea></div>
      <div class="field" style="grid-column:1/-1"><label>사진·그림 (선택 · 최대 4장 · 내용 아래에 들어갑니다)</label><div class="ev-imgs">${(e.imgs||[]).map((s,i)=>`<span class="ev-th"><img src="${s}" alt=""><button type="button" data-evimgx="${i}" title="빼기">×</button></span>`).join("")}${(e.imgs||[]).length<4?`<label class="btn sm ev-add" style="cursor:pointer">+ 사진 넣기<input type="file" id="ev-img" accept="image/*" multiple hidden></label>`:""}</div></div>
      <div class="field"><label>시작일</label><input data-evf="start" value="${esc(e.start)}" placeholder="20261118" inputmode="numeric"></div>
      <div class="field"><label>종료일</label><input data-evf="end" value="${esc(e.end)}" placeholder="20261231" inputmode="numeric"></div>
      <div class="field" style="grid-column:1/-1"><label>신청해 주신 분께 드리는 것 (선택)</label><input data-evf="gift" value="${esc(e.gift)}" placeholder="예: 보장 정리표(PDF), 3만원 이하 소정의 감사 선물"></div>
      <div class="field" style="grid-column:1/-1"><label>신청 버튼 글자</label><input data-evf="cta" value="${esc(e.cta||"무료 점검 신청하기")}"></div>
    </div>
    <div id="ev-wb">${wbox(W)}</div>
  </div>
  <div class="panel ev-step3" style="margin-top:12px"><b style="font-size:14px">3. 저장하고 개인페이지에 올리기</b>
    <p class="note" id="ev-pmsg" style="margin:4px 0 8px">${!base()?"저장은 됩니다. 다만 고객에게 보내려면 개인페이지를 먼저 만들어(공개해) 주세요.":warn(e).length?"위 경고 문구를 고쳐야 올릴 수 있습니다.":e.pub?`올림: ${esc(e.pub)} · 내용을 고쳤다면 다시 누르세요`:"누르면 개인페이지에 이벤트가 걸리고, 오른쪽에서 바로 보낼 수 있습니다."}</p>
    <button class="btn primary" type="button" id="ev-pub" style="width:100%">${S.draft?"저장하고 개인페이지에 올리기":e.pub?"고친 내용 다시 올리기":"개인페이지에 올리기"}</button>
    ${!base()?`<button class="btn" type="button" data-go="homepage" style="width:100%;margin-top:6px">개인페이지 만들러 가기</button>`:""}</div>`;
}

document.addEventListener("click",async ev=>{ const t=ev.target.closest&&ev.target.closest("button,a"); if(!t||!t.closest('section[data-view="event"]')) return;
  const L=EV(), e=cur();
  if(t.dataset.evsel){ S.sel=t.dataset.evsel; S.draft=null; S.ref=""; draw(); return; }
  if(t.dataset.evtpl!=null){ const i=+t.dataset.evtpl, p=TPL[i]||{t:"",sub:"",body:"",gift:""};
    const n={id:Date.now().toString(36),title:p.t,sub:p.sub,body:p.body,gift:p.gift,cta:"무료 점검 신청하기",start:today(),end:addDays(today(),30),on:true,ok:false,pub:""};
    S.draft=n; S.tpl=i; S.sel=null; draw(); return; }
  if(t.id==="ev-pub"&&S.draft){ const n=S.draft; S.draft=null; S.tpl=null; L.unshift(n); S.sel=n.id; save();
    if(!canPub(n)){ draw(); const m=$("#ev-pmsg"); if(m) m.innerHTML="<b>저장했습니다.</b> "+m.innerHTML; return; } draw(); const b2=$("#ev-pub"); if(b2) b2.click(); return; }
  if(t.id==="ev-del"&&S.draft){ S.draft=null; S.tpl=null; draw(); return; }
  if(!e) return;
  if(t.id==="ev-del"){ if(!confirm("이 이벤트를 삭제할까요?")) return; L.splice(L.indexOf(e),1); S.sel=null; save(); draw(); return; }
  const u=link(e,S.ref);
  if(t.id==="ev-pub"&&!canPub(e)){ const m=$("#ev-pmsg"); if(m){ m.style.color="#b42318"; m.textContent=!base()?"개인페이지를 먼저 만들어 주세요 (아래 버튼).":"위 경고 문구를 고쳐 주세요."; } return; }
  if(t.id==="ev-pub"){ const M=G("ME"), C=G("CLOUD"), pg=G("pgData"), P=G("PGo")&&G("PGo")();
    if(!M||M.demo||!C||!C.user||!C.sb||!P||!P.slug){ alert("로그인한 계정에서 개인페이지를 공개한 뒤 반영할 수 있습니다."); return; }
    t.disabled=true; t.textContent="반영 중…";
    let error=null; try{ ({error}=await C.sb.from("boit_pages").upsert({slug:P.slug,user_id:C.user.id,data:pg(),updated_at:new Date().toISOString()},{onConflict:"user_id"})); }catch(err){ error=err; }
    if(error){ t.disabled=false; t.textContent="개인페이지에 반영"; alert("반영하지 못했습니다: "+(error.message||"연결 오류")); return; }
    L.forEach(x=>{ if(x.on) x.pub=today(); }); save(); draw(); const sb=$(".ev-send"); if(sb){ sb.classList.add("flash"); sb.scrollIntoView({block:"nearest",behavior:"smooth"}); } return; }
  const sm=$("#ev-smsg"), txt=u?shareText(e,u):"";
  const copy=async(v,msg)=>{ let ok=false; try{ await navigator.clipboard.writeText(v); ok=true; }catch(_){ const ta=document.createElement("textarea"); ta.value=v; ta.style.cssText="position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); try{ ok=document.execCommand("copy"); }catch(__){} ta.remove(); } if(sm){ sm.style.color=""; sm.innerHTML=ok?msg:"복사하지 못했습니다. 링크를 길게 눌러 복사해 주세요."; } };
  if(t.id==="ev-kakao"&&u){ if(isMob()&&navigator.share){ try{ await navigator.share({text:txt}); }catch(_){} return; } copy(txt,"<b>문구를 복사했습니다.</b> 카카오톡에서 보낼 대화방을 열고 붙여넣기(Ctrl+V) → 전송"); return; }
  if(t.id==="ev-smsb"&&u){ if(isMob()){ location.href="sms:"+(/iPhone|iPad|iPod/i.test(navigator.userAgent)?"&":"?")+"body="+encodeURIComponent(txt); return; } copy(txt,"<b>문구를 복사했습니다.</b> PC에서는 문자앱이 열리지 않습니다. 휴대폰 보잇에서 [문자로 보내기]를 누르거나, 카카오톡에 붙여넣어 보내세요."); return; }
  if(t.id==="ev-copy"&&u){ copy(u,"링크를 복사했습니다. 블로그·인스타·명함 등에 붙여넣으세요."); return; }
  if(t.dataset.evimgx!=null){ e.imgs.splice(+t.dataset.evimgx,1); save(); draw(); return; }
  if(/^ev-(png|pdf|print|qrdl)$/.test(t.id)){ const om=$("#ev-omsg"), set=v=>{ if(om) om.textContent=v; };
    const win=t.id==="ev-print"?window.open("","_blank"):null;
    try{ set("만드는 중…");
      if(t.id==="ev-qrdl"){ const box=document.createElement("div"); await drawQR(box,u); const c=box.querySelector("canvas"); if(!c) throw 0; const big=document.createElement("canvas"); big.width=big.height=600; const x=big.getContext("2d"); x.fillStyle="#fff"; x.fillRect(0,0,600,600); x.imageSmoothingEnabled=false; x.drawImage(c,40,40,520,520);
        await saveBlob(await new Promise(r=>big.toBlob(r,"image/png")),fname(e,"qr.png")); set("QR을 저장했습니다."); return; }
      const cv=await posterCanvas(e);
      if(t.id==="ev-png"){ await saveBlob(await new Promise(r=>cv.toBlob(r,"image/png")),fname(e,"png")); set("이미지를 저장했습니다."); return; }
      if(t.id==="ev-pdf"){ if(!window.jspdf) throw 0; const pdf=new window.jspdf.jsPDF({unit:"mm",format:"a4"}); const r=cv.height/cv.width, h=Math.min(297,210*r), w=h/r; pdf.addImage(cv.toDataURL("image/jpeg",.92),"JPEG",(210-w)/2,0,w,h); await saveBlob(pdf.output("blob"),fname(e,"pdf")); set("PDF를 저장했습니다."); return; }
      if(win){ win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(e.title||"이벤트")}</title><style>@page{size:A4;margin:0}body{margin:0}img{width:100%;display:block}</style></head><body><img src="${cv.toDataURL("image/png")}" onload="setTimeout(()=>{print()},200)"></body></html>`); win.document.close(); set("출력 창을 열었습니다."); }
      else set("팝업이 막혀 출력 창을 열지 못했습니다. [PDF 저장] 후 출력해 주세요.");
    }catch(err){ if(win) win.close(); set(err&&err.code==="declined"?"저장을 취소했습니다.":"만들지 못했습니다. 새로고침 후 다시 시도해 주세요."); }
    return; }
  if(t.id==="ev-qrb"&&u){ const w=$("#ev-qrw"); w.hidden=!w.hidden; if(!w.hidden) drawQR($("#ev-qr"),u); return; }
});
document.addEventListener("input",ev=>{ const t=ev.target; if(!t.closest||!t.closest('section[data-view="event"]')) return;
  const e=cur(); if(!e||!t.dataset.evf||t.type==="checkbox") return; e[t.dataset.evf]=t.value; pvUpd(); });
document.addEventListener("change",async ev=>{ const t=ev.target; if(!t.closest||!t.closest('section[data-view="event"]')) return;
  const e=cur();
  if(t.id==="ev-ref"){ S.ref=t.value; draw(); return; }
  if(t.id==="ev-img"&&e){ const fs=[...t.files].filter(f=>/^image\//.test(f.type)); t.value=""; e.imgs=e.imgs||[]; for(const f of fs){ if(e.imgs.length>=4) break; const s=await shrinkImg(f); if(s) e.imgs.push(s); } save(); draw(); return; }
  if(!e||!t.dataset.evf) return;
  if(t.type==="checkbox") e[t.dataset.evf]=t.checked; else if(/start|end/.test(t.dataset.evf)) e[t.dataset.evf]=t.value=fmtD(t.value); else e[t.dataset.evf]=t.value;
  save();
  if(t.type==="checkbox"){ draw(); return; }
  /* 글자 칸은 화면을 다시 그리지 않음 → 바로 누른 버튼(저장 등)이 한 번에 눌림 */
  const W=warn(e), wb=$("#ev-wb"); if(wb) wb.innerHTML=wbox(W); pvUpd(); });
new MutationObserver(()=>{ const s=document.querySelector('section[data-view="event"]'); if(s&&!s.hidden&&!s.dataset.evDrawn){ s.dataset.evDrawn=1; draw(); } if(s&&s.hidden) delete s.dataset.evDrawn; })
  .observe(document.body,{subtree:true,attributes:true,attributeFilter:["hidden"]});

const CSS=`
.ev-wrap{display:grid;grid-template-columns:260px minmax(0,1fr);gap:12px;margin-top:12px;align-items:start}
.ev-it{display:grid;grid-template-columns:1fr auto;gap:2px 6px;width:100%;text-align:left;border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:9px 10px;margin-bottom:6px;font:inherit;color:var(--fg);cursor:pointer}
.ev-it small{grid-column:1/-1;color:var(--muted);font-size:11.5px}.ev-it.on{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 25%,transparent)}
.ev-tpl{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
.ev-tp{text-align:left;border:1px solid var(--line);background:var(--surface);border-radius:12px;padding:14px;font:inherit;color:var(--fg);cursor:pointer}.ev-tp:hover{border-color:var(--accent)}
.ev-tp b{display:block;font-size:15px;margin-bottom:4px}.ev-tp span{font-size:12.5px;color:var(--muted);line-height:1.45}
.ev-warn{margin-top:10px;background:#FBE3D9;color:#8E3420;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.6}
.ev-link{display:flex;gap:16px;align-items:flex-start}.ev-qr{width:150px;height:150px;flex:none;background:#fff;border:1px solid var(--line);border-radius:10px;padding:6px;box-sizing:content-box}
.ev-url{font-size:12.5px;word-break:break-all;background:var(--surface-2,#F3F5F4);border-radius:8px;padding:8px 10px;margin-top:6px}
.ev-pre{white-space:pre-wrap;font:inherit;font-size:13px;background:var(--surface-2,#F3F5F4);border-radius:10px;padding:12px;margin:0;line-height:1.6}
.ev-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;padding:6px 2px 4px}.ev-row .ev-it,.ev-row .ev-tp{margin:0;padding:10px 12px}
.ev-tp.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,var(--surface));box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 25%,transparent)}
.ev-2col{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px;margin-top:12px;align-items:start}.ev-pvw{position:sticky;top:12px}
.ev-phone{margin-top:6px;border:1px solid #E4E7EB;border-radius:22px;padding:12px;background:#F4F6F8;max-height:calc(100vh - 80px);overflow:auto}
.evp{background:#F6F8F7;border-radius:14px;overflow:hidden;border:1px solid #E1E6E3;color:#18221F}.evp-top{display:flex;gap:10px;align-items:center;padding:12px 14px;background:var(--hpc);color:#fff}
.evp-top .av{width:38px;height:38px;border-radius:50%;background:#fff;color:var(--hpc);display:flex;align-items:center;justify-content:center;font-weight:800}.evp-top b{display:block;font-size:14px}.evp-top small{font-size:11.5px;opacity:.85}
.evp .ev{margin:12px;border:2px solid var(--hpc);border-radius:14px;padding:14px 14px 12px;background:#fff}.evp .lb{display:inline-block;font-size:11.5px;font-weight:700;color:#fff;background:var(--hpc);border-radius:99px;padding:2px 9px}
.evp h4{margin:8px 0 4px;font-size:17px}.evp .sb{margin:0 0 8px;font-size:13.5px;color:#4A5753}.evp .ev p{font-size:13px;line-height:1.65;margin:0 0 6px;color:#2A3532}
.evp .gf{font-size:12.5px;background:#F0F3F1;border-radius:8px;padding:7px 9px;margin:6px 0}.evp .dt{font-size:12px;color:#7A8682}.evp .two{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.evp .cta{display:block;text-align:center;margin-top:8px;background:var(--hpc);color:#fff;border-radius:9px;padding:10px;font-weight:700;font-size:13px}.evp-n{font-size:11.5px;color:#7A8682;margin:0 14px 12px;line-height:1.5}
.evp-bub{background:#fff;border-radius:14px 14px 14px 4px;padding:10px 12px;font-size:12.5px;line-height:1.55;white-space:pre-wrap;word-break:break-all;box-shadow:0 1px 2px rgba(0,0,0,.06)}
@media(max-width:900px){.ev-2col{grid-template-columns:1fr}.ev-pvw{position:static}}
.ev-steps{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}.ev-steps span{flex:1;min-width:150px;display:flex;gap:8px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:13px;color:var(--muted);background:var(--surface)}
.ev-steps b{width:22px;height:22px;border-radius:50%;background:#E4E7EB;color:#555;display:flex;align-items:center;justify-content:center;font-size:12px;flex:none}
.ev-steps .on{border-color:var(--accent);color:var(--fg);font-weight:700}.ev-steps .on b{background:var(--accent);color:#fff}.ev-steps .done b{background:#2F9E6B;color:#fff}
.ev-send{margin-top:12px;border:2px solid var(--accent);border-radius:14px;padding:12px;background:var(--surface)}.ev-send.off{border:1px dashed var(--line)}.ev-send.flash{box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 30%,transparent)}
.ev-sbtn{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}.evp-top .av img{width:100%;height:100%;object-fit:cover;border-radius:50%}.evp-top .av{overflow:hidden}
@media(max-width:900px){.ev-wrap{grid-template-columns:1fr}.ev-link{flex-direction:column}}
.ev-imgs{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.ev-th{position:relative;width:84px;height:84px;border-radius:8px;overflow:hidden;border:1px solid var(--line)}.ev-th img{width:100%;height:100%;object-fit:cover}
.ev-th button{position:absolute;top:2px;right:2px;width:22px;height:22px;border-radius:50%;border:0;background:rgba(0,0,0,.6);color:#fff;cursor:pointer;line-height:20px}
.evp .ei{display:block;width:100%;border-radius:8px;margin:6px 0}
.ev-out{margin-top:12px;border:1px solid var(--line);border-radius:14px;padding:12px;background:var(--surface)}
#evpo-host{position:fixed;left:-10000px;top:0}
.evpo{width:794px;min-height:1123px;box-sizing:border-box;background:#fff;color:#18221F;font-family:var(--f-ui);display:flex;flex-direction:column}
.evpo-h{background:var(--hpc);color:#fff;padding:56px 60px 44px}.evpo-lb{display:inline-block;font-size:14px;font-weight:800;letter-spacing:.2em;border:2px solid rgba(255,255,255,.8);border-radius:99px;padding:4px 14px}
.evpo-h h1{font-size:46px;line-height:1.25;margin:18px 0 10px;word-break:keep-all}.evpo-sb{font-size:21px;margin:0;opacity:.92;line-height:1.5;word-break:keep-all}
.evpo-b{flex:1;padding:40px 60px 20px;font-size:19px;line-height:1.75}.evpo-b p{margin:0 0 10px;word-break:keep-all}
.evpo-im{display:grid;gap:12px;margin:18px 0}.evpo-im.n1{grid-template-columns:1fr}.evpo-im.n2,.evpo-im.n4{grid-template-columns:1fr 1fr}.evpo-im.n3{grid-template-columns:1fr 1fr 1fr}
.evpo-im img{width:100%;border-radius:12px;display:block;max-height:420px;object-fit:cover}.evpo-im.n1 img{max-height:520px;object-fit:contain}
.evpo-gf{font-size:20px;font-weight:700;background:#F2F5F3;border-radius:12px;padding:14px 18px;margin:16px 0 10px}.evpo-dt{font-size:17px;color:#55625D}
.evpo-f{display:flex;align-items:center;gap:24px;justify-content:space-between;border-top:3px solid var(--hpc);margin:0 60px;padding:26px 0 46px}
.evpo-me{display:flex;flex-direction:column;gap:4px}.evpo-me b{font-size:24px}.evpo-me span{font-size:16px;color:#55625D}.evpo-me .evpo-ph{font-size:24px;font-weight:800;color:var(--hpc)}
.evpo-q{text-align:center}.evpo-q small{display:block;font-size:13px;color:#55625D;margin-top:6px;line-height:1.4}#evpo-qr{display:inline-block;padding:6px;background:#fff;border:1px solid #DDE3E0;border-radius:10px}
`;
const st=document.createElement("style"); st.textContent=CSS; document.head.appendChild(st);
window.BOIT_EVENT={draw,warn};
})();
