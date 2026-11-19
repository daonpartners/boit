/* 보잇 · 제안·영업 › 영업자료 › 증권 속지 (2026-11-17)
   고객마다 A4 '보험 안내 파일'을 만들어 인쇄·PDF로 저장.
   - 감사 인사 · 표지(고객명·계약·전화번호·개인페이지 QR) · 이럴 때 연락 주세요 · 청구서류 한 장 표 · 보험사 대표번호 (11-19: 목차·담당 설계사 장 삭제, 전체 상하 가운데 정렬)
   - 청구서류: index.html CDOC·ITEM_DOCS (출처: DB손해보험·교보라이프플래닛 보험금 청구서류 안내) 그대로 사용
   - 보험사 대표번호: index.html INSURERS (보잇 원수사 정보)
   - 보험금 청구 기간: 상법 제662조(보험금청구권 소멸시효 3년) */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const G=n=>{ try{ return eval(n); }catch(_){ return null; } };   // index.html 전역 const 읽기 (INSURERS·CDOC 등)
/* 첫 장 감사 인사 — {이름}은 고객 이름으로 바뀜. 설계사가 고쳐 쓸 수 있음 */
const THANKS=[
`{이름} 고객님,

보험은 서류 한 장이 아니라
꼭 필요한 순간 곁에 있겠다는 약속이라고 생각합니다.

저를 믿고 맡겨 주셔서 진심으로 감사합니다.

이 파일을 펼칠 일이 없도록 늘 건강하시길 바랍니다.
그래도 혹시 그날이 오면,
이 파일보다 먼저 저를 찾아 주세요.`,
`{이름} 고객님,

수많은 설계사 중에 저를 선택해 주신 오늘을
오래 기억하겠습니다.

가입하는 날보다 보험금을 받는 날,
그 날 더 든든한 사람이 되겠습니다.

평생 고객님의 보험 담당자로 남겠습니다.`,
`{이름} 고객님,

소중한 가족과 일상을 지키는 일에
저를 함께하게 해 주셔서 감사합니다.

좋은 날엔 안부를, 힘든 날엔 해결을 드리겠습니다.

언제든 편하게 불러 주세요.
제 전화는 고객님을 위해 늘 켜져 있습니다.`];
const S={cust:"",name:"",thanks:THANKS[0],thx:0,ctrs:[{ins:"",prod:"",date:""}],groups:{silson:1,dx:1,surg:1,tooth:1,car:1,liab:1,disab:1,pet:1},theme:"green",kakao:""};

const GROUPS=[
 {k:"silson",t:"실손의료비",sub:"병원비를 돌려받을 때",parts:[["입원했을 때",["dx","bill","detail"]],["통원·약국",["outdx","bill","pharm"]]]},
 {k:"dx",t:"암·뇌·심장 진단비",sub:"큰 병을 진단받았을 때",parts:[["암",["dx","biopsy"]],["뇌혈관질환",["dx","ctmri"]],["심장질환",["dx","heartt"]],["항암치료비(표적항암 포함)",["dx","target","chemorec","bill","detail"]]]},
 {k:"surg",t:"수술·입원·골절",sub:"수술하거나 입원했을 때",parts:[["수술비",["surgdoc","bill","detail"]],["입원일당",["adm"]],["골절",["dx","xray"]]]},
 {k:"tooth",t:"치아",sub:"치과 치료(보존·보철)를 받았을 때",parts:[["치아치료",["tooth","dentrec","dentx"]]]},
 {k:"car",t:"운전자·교통사고",sub:"교통사고로 다쳤을 때",parts:[["교통사고로 다친 경우",["dx","adm","bill","detail"]],["생명보험 재해 청구 시 추가",["accproof"]]],note:"벌금·변호사선임비·형사합의금은 사건마다 서류가 달라요. 담당 설계사에게 먼저 연락 주세요."},
 {k:"liab",t:"일상배상·누수",sub:"남에게 피해를 줬을 때",parts:[["누수 피해",["story","photo","leaktech","est","recp","reg","famreg","lease"]],["물건 피해(대물)",["story","photo","lossl","est","recp","agree","vid"]],["사람 피해(대인)",["story","vbill","vdx","agree","vid"]]]},
 {k:"disab",t:"후유장해·사망",sub:"장해가 남거나 사망했을 때",parts:[["후유장해",["disabdx"]],["사망",["deathc","basic","heir"]]]},
 {k:"pet",t:"펫보험",sub:"반려동물이 아플 때",parts:[["입원·통원·수술",["petid","petdx","petbill","petrec","petx"]],["장례비",["petdeath"]]]}
];
const WHEN=[
 ["🏥","입원·수술을 하게 됐을 때","퇴원 전에 필요한 서류를 한 번에 떼면 다시 병원에 가지 않아도 돼요."],
 ["🩺","큰 병을 진단받았을 때","암·뇌·심장 등 진단비는 진단서 내용이 중요해요. 떼기 전에 연락 주세요."],
 ["🚗","다치거나 교통사고가 났을 때","치료비 외에 운전자·상해 보험에서 받을 수 있는 것이 있는지 함께 봐요."],
 ["💧","누수·화재로 남에게 피해를 줬을 때","수리 전에 사진부터 찍어 두세요. 일상배상 청구에 필요해요."],
 ["🏠","주소·연락처·계좌가 바뀌었을 때","안내문과 보험금 입금이 늦어지지 않게 바꿔 드려요."],
 ["💳","보험료 내기가 어려워졌을 때","해지하기 전에 먼저 연락 주세요. 상품마다 방법이 있는지 확인해 드려요."],
 ["🔁","만기·갱신 안내를 받았을 때","갱신 보험료와 보장을 함께 확인해 드려요."],
 ["📝","다른 보험 가입을 권유받았을 때","지금 보험과 겹치는지, 바꾸면 손해는 없는지 비교해 드려요."]
];
const THEMES={green:{c:"#1F6F5C",l:"#E7F2EE",a:"#B7E04A"},navy:{c:"#1B2D4F",l:"#E8EDF5",a:"#F2A33A"},warm:{c:"#8A4B2A",l:"#F6ECE4",a:"#E6B24C"}};

function insList(){ return (G("INSURERS")||[]).filter(i=>i.cs); }
function custList(){ return G("CUSTOMERS")||[]; }
function me(){ const M=G("ME")||{}; let u=""; try{ u=(G("hpUrl")&&G("hpUrl")())||""; }catch(_){} return {name:M.name||"",phone:M.phone||"",org:[M.company,M.branch].filter(Boolean).join(" "),email:M.email||"",page:S.page||u}; }
const tel=p=>String(p||"").replace(/[^\d+]/g,"");

/* ===== QR ===== */
function libQR(){ return window.QRCode?Promise.resolve():new Promise((ok,no)=>{ const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; s.onload=ok; s.onerror=no; document.head.appendChild(s); }); }
function qrData(text){ const d=document.createElement("div"); new window.QRCode(d,{text,width:256,height:256,correctLevel:window.QRCode.CorrectLevel.M}); const c=d.querySelector("canvas"); return c?c.toDataURL("image/png"):(d.querySelector("img")||{}).src||""; }

/* ===== 페이지 만들기 ===== */
function docRows(keys){ const C=G("CDOC")||{}; return keys.map(k=>C[k]).filter(Boolean); }
function pages(Q){
  const m=me(), T=THEMES[S.theme]||THEMES.green, ctrs=S.ctrs.filter(c=>c.ins||c.prod);
  const gs=GROUPS.filter(g=>S.groups[g.k]);
  const foot=(n)=>`<div class="sj-ft"><span>${esc(S.name||"고객")}님의 보험 안내 파일</span><span>${n}</span><span>${esc(m.name)} ${esc(m.phone)}</span></div>`;
  const P=[];
  // 0. 감사 인사 (첫 장)
  const today=new Date(), dstr=`${today.getFullYear()}. ${today.getMonth()+1}. ${today.getDate()}.`;
  P.push(`<div class="sj-thx"><div class="sj-thx-mark">“</div><div class="sj-thx-t">${esc((S.thanks||"").replace(/\{이름\}/g,S.name||"고객")).replace(/\n/g,"<br>")}</div>
    <div class="sj-thx-sign"><span>${dstr}</span><b>${esc(m.name||"담당 설계사")}</b> 드림</div><div class="sj-thx-line"></div><div class="sj-thx-ft">${esc(S.name||"고객")}님의 든든한 보험 담당자 · ${esc(m.phone||"")}</div></div>`);
  // 1. 표지
  P.push(`<div class="sj-cover"><div><div class="sj-k">${esc(S.name||"고객")} 님의</div><h1>보험 안내 파일</h1>
    <table class="sj-ct">${ctrs.length?ctrs.map(c=>`<tr><td>${esc(c.ins)}</td><td><b>${esc(c.prod)}</b></td><td>${esc(c.date)}</td></tr>`).join(""):`<tr><td colspan="3">가입 계약을 입력하세요</td></tr>`}</table></div>
    <div class="sj-ico">📁</div></div>
    <div class="sj-box sj-qrbox"><div><b>궁금한 일이 생기면, 병원 가시기 전, 다녀오신 후 보험 청구 시</b><div class="sj-hl">먼저 저에게 연락 주세요</div>${m.phone?`<div class="sj-tel">${esc(m.phone)}</div>`:""}<p>${m.page?"QR을 휴대폰 카메라로 비추면 제 페이지에서 청구 서류 보내기·상담 신청을 할 수 있어요.":"전화 · 문자 모두 편하게 주세요."}</p></div>
    <div class="sj-qrs">${m.page?`<figure><img src="${Q.page}" alt=""><figcaption>내 담당 설계사</figcaption></figure>`:""}</div></div>`);
  // 2. 이럴 때 연락 주세요
  P.push(`<h2 class="sj-h2">이럴 때<br><span>연락 주세요</span></h2><div class="sj-when">${WHEN.map(w=>`<div><i>${w[0]}</i><b>${esc(w[1])}</b><p>${esc(w[2])}</p></div>`).join("")}</div>
    <div class="sj-box"><b>보험금은 3년 안에 청구하세요</b><p>보험금을 청구할 수 있는 권리는 3년 동안 행사하지 않으면 사라져요. (상법 제662조) 오래된 병원비도 3년이 안 지났다면 지금 청구할 수 있어요.</p></div>`);
  // 3. 청구 서류 — 한 장 표
  if(gs.length){
    const nm=keys=>docRows(keys).map(d=>esc(d[0])).join(" · ");
    const rows=gs.map(g=>g.parts.map(([t,keys],j)=>`<tr>${j?"":`<th rowspan="${g.parts.length}">${esc(g.t)}</th>`}<td class="sj-sit"><b>${esc(t)}</b></td><td>${nm(keys)}</td></tr>`).join("")).join("");
    const notes=gs.filter(g=>g.note).map(g=>`<p>${esc(g.note)}</p>`).join("");
    P.push(`<h2 class="sj-h2">보험금 청구<br><span>필요한 서류</span></h2>
      <table class="sj-cl"><thead><tr><th>구분</th><th>이럴 때</th><th>필요한 서류</th></tr></thead><tbody>${rows}
      <tr class="sj-cm"><th>모든 청구 공통</th><td class="sj-sit"><b>함께 준비</b></td><td>보험금 청구서(담당 설계사가 대신 작성) · 신분증 사본 · 통장 사본(계좌를 처음 알려 주거나 바꿀 때) · 미성년 자녀는 가족관계증명서 + 법정대리인 신분증 사본</td></tr></tbody></table>
      ${notes?`<div class="sj-box">${notes}</div>`:""}
      <p class="sj-src">출처: DB손해보험·교보라이프플래닛 보험금 청구서류 안내 · 보험사·상품·청구 금액에 따라 필요한 서류가 다를 수 있어요.</p>`);
  }
  // 4. 보험사 대표번호
  const mine=new Set(ctrs.map(c=>c.ins)), L=insList();
  const tbl=(k,t)=>{ const a=L.filter(i=>i.k===k); return `<table class="sj-tt"><thead><tr><th colspan="2">${t}</th></tr></thead><tbody>${a.map(i=>`<tr class="${mine.has(i.name)?"on":""}"><td>${esc(i.name)}</td><td>${esc(i.cs)}</td></tr>`).join("")}</tbody></table>`; };
  const card=`<div class="sj-card"><div class="sj-card-l"><div class="sj-card-k">내 보험 담당자</div><div class="sj-card-n">${esc(m.name||"담당 설계사")}<small>보험설계사</small></div>${m.org?`<div class="sj-card-o">${esc(m.org)}</div>`:""}
    <div class="sj-card-c">${m.phone?`<div><i>전화</i>${esc(m.phone)}</div>`:""}${m.email?`<div><i>메일</i>${esc(m.email)}</div>`:""}</div></div>
    ${Q.page?`<figure><img src="${Q.page}" alt=""><figcaption>내 담당 설계사</figcaption></figure>`:""}</div>`;
  P.push(`<div class="sj-telp"><h2 class="sj-h2">보험사<br><span>대표번호</span></h2>${mine.size?`<p class="sj-lead">색으로 표시된 곳이 가입하신 보험사예요.</p>`:""}
    <div class="sj-tts">${tbl("son","손해보험")}${tbl("life","생명보험")}</div></div>${card}`);
  return P.map((h,i)=>`<section class="sj-page${i?"":" sj-p0"}" style="--sc:${T.c};--sl:${T.l};--sa:${T.a}">${h}${i>1?foot(i+1):""}</section>`).join("");
}

async function build(){
  const m=me(), Q={};
  try{ await libQR(); if(m.page) Q.page=qrData(m.page); }catch(_){ }
  return pages(Q);
}

/* ===== 화면 ===== */
function draw(){
  const sec=document.querySelector('section[data-view="materials"]'); if(!sec) return;
  const m=me(), L=insList(), CU=custList();
  sec.innerHTML=`<div class="row between"><div><h1>증권 속지</h1><p class="note" style="margin:2px 0 0">고객마다 A4 보험 안내 파일 · 인쇄하거나 PDF로 저장해 증권과 함께 전달</p></div></div>
  <div class="panel sj-form">
    <div class="grid3">
      <div class="field"><label for="sj-cust">고객</label><select id="sj-cust" class="need"><option value="">고객 고르기</option>${CU.map(c=>`<option value="${esc(c.id)}" ${String(S.cust)===String(c.id)?"selected":""}>${esc(c.name)} · ${esc((c.phone||"").slice(-4))}</option>`).join("")}</select></div>
      <div class="field"><label for="sj-name">표지 이름</label><input id="sj-name" value="${esc(S.name)}" placeholder="예: 고객1"></div>
      <div class="field"><label>개인페이지 QR</label><div style="padding:9px 0" class="note">${m.page?"넣음 · "+esc(m.page.replace(/^https?:\/\//,"")):'<b style="color:#B4472F">개인페이지를 공개해야 들어갑니다</b> <button class="lnk" type="button" data-go="homepage">개인페이지 열기</button>'}</div></div>
    </div>
    <h3 class="sj-fh">첫 장 감사 인사 <span class="note" style="font-weight:400">{이름}은 고객 이름으로 바뀝니다</span></h3>
    <textarea id="sj-thanks" rows="9" style="width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit;line-height:1.6;background:var(--surface);color:var(--fg)">${esc(S.thanks)}</textarea>
    <div class="row" style="gap:6px;margin-top:6px">${THANKS.map((_,i)=>`<button class="btn sm${S.thx===i?" primary":""}" type="button" data-thx="${i}">문구 ${i+1}</button>`).join("")}</div>
    <h3 class="sj-fh">가입 계약</h3>
    <div id="sj-ctrs">${S.ctrs.map((c,i)=>`<div class="sj-crow"><select data-ct="${i}:ins"><option value="">보험사</option>${L.map(x=>`<option ${c.ins===x.name?"selected":""}>${esc(x.name)}</option>`).join("")}</select><input data-ct="${i}:prod" value="${esc(c.prod)}" placeholder="상품명"><input data-ct="${i}:date" value="${esc(c.date)}" placeholder="가입일 20261116" inputmode="numeric"><button class="btn sm" type="button" data-ctdel="${i}" ${S.ctrs.length<2?"disabled":""}>빼기</button></div>`).join("")}</div>
    <button class="btn sm" type="button" id="sj-addct">＋ 계약 추가</button>
    <h3 class="sj-fh">넣을 청구 서류</h3>
    <div class="checks">${GROUPS.map(g=>`<label><input type="checkbox" data-sjg="${g.k}" ${S.groups[g.k]?"checked":""}> ${esc(g.t)}</label>`).join("")}</div>
    <h3 class="sj-fh">디자인</h3>
    <div class="checks">${[["green","그린"],["navy","네이비"],["warm","웜"]].map(([k,t])=>`<label><input type="radio" name="sj-th" value="${k}" ${S.theme===k?"checked":""}> ${t}</label>`).join("")}</div>
    <div class="row" style="gap:8px;margin-top:14px"><button class="btn primary" type="button" id="sj-prev">미리보기</button><button class="btn hot" type="button" id="sj-print">인쇄 · PDF 저장</button><span class="note" id="sj-msg"></span></div>
    ${!m.phone?'<p class="note" style="color:#B4472F">마이페이지에 휴대폰 번호를 넣어야 전화번호가 들어갑니다.</p>':""}
  </div>
  <div class="sj-prevbox" id="sj-out"></div>`;
}
const fmtD=v=>{ const d=String(v||"").replace(/\D/g,""); return d.length===8?`${d.slice(0,4)}.${d.slice(4,6)}.${d.slice(6)}`:v; };
document.addEventListener("input",e=>{ const t=e.target; if(!t.closest||!t.closest('section[data-view="materials"]')) return;
  if(t.id==="sj-name") S.name=t.value; if(t.id==="sj-thanks") S.thanks=t.value;
  if(t.dataset.ct){ const [i,f]=t.dataset.ct.split(":"); S.ctrs[+i][f]=f==="date"?fmtD(t.value):t.value; } });
document.addEventListener("change",e=>{ const t=e.target; if(!t.closest||!t.closest('section[data-view="materials"]')) return;
  if(t.id==="sj-cust"){ S.cust=t.value; const c=custList().find(x=>String(x.id)===t.value); if(c){ S.name=c.name; const K=(G("CONTRACTS")||[]).filter(k=>String(k.cust)===String(c.id)&&!/해지|소멸|만기/.test(k.status||"")); if(K.length) S.ctrs=K.slice(0,8).map(k=>({ins:k.insurer||"",prod:k.product||"",date:fmtD(k.start||"")})); } draw(); }
  if(t.dataset.ct){ const [i,f]=t.dataset.ct.split(":"); S.ctrs[+i][f]=f==="date"?fmtD(t.value):t.value; if(f==="date") t.value=S.ctrs[+i][f]; }
  if(t.dataset.sjg) S.groups[t.dataset.sjg]=t.checked?1:0;
  if(t.name==="sj-th") S.theme=t.value; });
document.addEventListener("click",async e=>{ const t=e.target.closest&&e.target.closest("button"); if(!t||!t.closest('section[data-view="materials"]')) return;
  if(t.dataset.thx!=null){ S.thx=+t.dataset.thx; S.thanks=THANKS[S.thx]; draw(); return; }
  if(t.id==="sj-addct"){ S.ctrs.push({ins:"",prod:"",date:""}); draw(); return; }
  if(t.dataset.ctdel){ S.ctrs.splice(+t.dataset.ctdel,1); draw(); return; }
  if(t.id==="sj-prev"||t.id==="sj-print"){
    const msg=$("#sj-msg"); if(!S.name.trim()){ msg.textContent="고객을 고르거나 표지 이름을 넣어 주세요."; return; }
    msg.textContent="만드는 중…"; const html=await build(); msg.textContent="";
    $("#sj-out").innerHTML=html;
    if(t.id==="sj-print"){ let P=document.getElementById("sj-printbox"); if(!P){ P=document.createElement("div"); P.id="sj-printbox"; document.body.appendChild(P); }
      P.innerHTML=html; document.body.classList.add("sj-printing"); setTimeout(()=>{ window.print(); setTimeout(()=>document.body.classList.remove("sj-printing"),500); },300); }
    else $("#sj-out").scrollIntoView({behavior:"smooth",block:"start"});
  } });
// 고객 목록이 로그인 뒤에 들어오므로 화면이 열릴 때마다 다시 그림
new MutationObserver(()=>{ const s=document.querySelector('section[data-view="materials"]'); if(s&&!s.hidden&&!s.dataset.sjDrawn){ s.dataset.sjDrawn=1; draw(); } if(s&&s.hidden) delete s.dataset.sjDrawn; })
  .observe(document.body,{subtree:true,attributes:true,attributeFilter:["hidden"]});

const CSS=`
.sj-fh{font-size:14px;margin:14px 0 6px}.sj-crow{display:grid;grid-template-columns:180px minmax(0,1fr) 150px auto;gap:6px;margin-bottom:6px}
.sj-crow select,.sj-crow input{padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--fg);font:inherit}
.sj-prevbox{display:flex;flex-direction:column;align-items:center;gap:14px;margin-top:16px}.sj-prevbox .sj-page{zoom:.62;box-shadow:0 4px 20px rgba(0,0,0,.15)}
.sj-page{width:210mm;height:297mm;overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding:16mm 15mm 20mm;box-sizing:border-box;background:#fff;color:#1F2A2A;font-family:'Pretendard','Noto Sans KR',sans-serif;position:relative;page-break-after:always;break-after:page}
.sj-page:last-child{page-break-after:auto;break-after:auto}
.sj-cover{display:flex;justify-content:space-between;gap:16px;margin-bottom:8mm}.sj-k{font-size:20px;font-weight:700}.sj-cover h1{font-size:38px;color:var(--sc);margin:4px 0 14px;letter-spacing:-.02em}
.sj-ico{font-size:90px;line-height:1;opacity:.9}.sj-ct{border-collapse:collapse;font-size:14px}.sj-ct td{padding:4px 12px 4px 0;color:#55605E}.sj-ct td b{color:#1F2A2A}
.sj-box{background:var(--sl);border-radius:12px;padding:14px 18px;margin:10px 0;font-size:14px;line-height:1.6}.sj-box p{margin:4px 0 0;color:#45514F}
.sj-cl{width:100%;border-collapse:collapse;font-size:12.5px;line-height:1.45}.sj-cl th,.sj-cl td{border:1px solid #DDE3E1;padding:5px 7px;vertical-align:middle;text-align:center;word-break:keep-all}
.sj-cl thead th{background:var(--sc);color:#fff;font-size:13px}.sj-cl tbody th{background:var(--sl);color:var(--sc);width:23mm;font-size:13px}.sj-cl td.sj-sit{white-space:nowrap;width:1%}.sj-cl tr.sj-cm th,.sj-cl tr.sj-cm td{background:#F6F8F7}
.sj-hl{color:var(--sc);font-weight:800;font-size:17px}.sj-tel{font-size:20px;font-weight:800;letter-spacing:.5px;margin:6px 0 2px}.sj-qrbox{display:flex;justify-content:space-between;align-items:center;gap:14px}
.sj-qrs{display:flex;gap:12px}.sj-qrs figure,.sj-vc figure{margin:0;text-align:center}.sj-qrs img{width:110px;height:110px;background:#fff;padding:6px;border-radius:8px}
figcaption{margin-top:6px;background:var(--sc);color:#fff;border-radius:999px;font-size:12px;font-weight:700;padding:4px 10px}
.sj-h3{font-size:17px;margin:12mm 0 4mm}.sj-toc{list-style:none;padding:0;margin:0;columns:2;column-gap:12mm}.sj-toc li{padding:7px 0;border-bottom:1px solid #E5E9E8;font-size:14.5px;break-inside:avoid}
.sj-toc span{display:inline-block;width:28px;color:var(--sc);font-weight:800}
.sj-h2{font-size:28px;line-height:1.3;margin:0 0 8mm;letter-spacing:-.02em}.sj-h2 span{color:var(--sc)}
.sj-when{display:grid;grid-template-columns:1fr 1fr;gap:10px}.sj-when div{border:1px solid #E1E7E5;border-radius:12px;padding:12px 14px}.sj-when i{font-style:normal;font-size:22px}
.sj-when b{display:block;font-size:15px;margin:4px 0}.sj-when p{margin:0;font-size:13px;color:#55605E;line-height:1.5}
.sj-sec{margin-bottom:7mm}.sj-sec h4{font-size:16px;margin:0 0 6px;padding-left:10px;border-left:4px solid var(--sc)}
.sj-dt{width:100%;border-collapse:collapse;font-size:14px}.sj-dt td{padding:7px 6px;border-bottom:1px solid #E8ECEB;vertical-align:top}.sj-dt td:first-child{width:22px;color:var(--sc);font-weight:800}
.sj-dt td:nth-child(2){width:46%}.sj-dt td:last-child{color:#5A6563;font-size:12.5px}.sj-src{font-size:11px;color:#7A8583;margin-top:6mm}.sj-lead{font-size:13px;color:#55605E;margin:-4mm 0 4mm}
.sj-two{display:grid;grid-template-columns:1fr 1fr;gap:10mm}.sj-two h4{margin:0 0 4px;font-size:15px;color:var(--sc)}
.sj-tel{width:100%;border-collapse:collapse;font-size:12.5px}.sj-tel td{padding:3.5px 6px;border-bottom:1px solid #EEF1F0}.sj-tel td:last-child{text-align:right;font-weight:700}
.sj-th4{margin:4mm 0 2mm;font-size:15px;color:var(--sc)}.sj-telg{display:grid;grid-template-columns:repeat(3,1fr);gap:0 6mm}
.sj-telg div{display:flex;justify-content:space-between;gap:6px;padding:4px 6px;border-bottom:1px solid #EEF1F0;font-size:12px;break-inside:avoid}.sj-telg b{white-space:nowrap}
.sj-telg div.on{background:var(--sl);color:var(--sc);font-weight:800}
.sj-me{display:flex;gap:18px;align-items:center}.sj-av{width:72px;height:72px;border-radius:50%;background:var(--sc);color:#fff;font-size:30px;font-weight:800;display:flex;align-items:center;justify-content:center}
.sj-vc{display:flex;gap:18px;align-items:center;margin:8mm 0}.sj-vc img{width:130px;height:130px}.sj-big{font-size:30px;font-weight:900;color:var(--sc);margin:4px 0}.sj-vc p{margin:0;color:#55605E;font-size:13.5px}
.sj-ol{margin:6px 0 0;padding-left:20px}.sj-ol li{margin:3px 0}
.sj-ft{position:absolute;left:15mm;right:15mm;bottom:9mm;display:flex;justify-content:space-between;font-size:10.5px;color:#8A9492;border-top:1px solid #E5E9E8;padding-top:4px}
.sj-p0{background:linear-gradient(180deg,var(--sl) 0%,#fff 55%);display:flex;flex-direction:column;justify-content:center;padding:28mm 24mm}
.sj-thx{position:relative}.sj-thx-mark{font-family:Georgia,'Noto Serif KR',serif;font-size:120px;line-height:.8;color:var(--sc);opacity:.25;margin-bottom:6mm}
.sj-thx-t{font-family:'Noto Serif KR','Nanum Myeongjo',Georgia,serif;font-size:22px;line-height:2;color:#24302E;letter-spacing:-.01em;word-break:keep-all}
.sj-thx-sign{margin-top:16mm;text-align:right;font-size:16px;color:#55605E}.sj-thx-sign span{display:block;font-size:13px;margin-bottom:4px}.sj-thx-sign b{font-size:24px;color:var(--sc);font-family:'Noto Serif KR',Georgia,serif}
.sj-thx-line{height:3px;width:42mm;background:var(--sc);margin:18mm 0 4mm;border-radius:2px}.sj-thx-ft{font-size:12px;color:#7A8583}
.sj-page:has(.sj-telp){justify-content:flex-start}
.sj-tts{display:grid;grid-template-columns:1fr 1fr;gap:10mm;align-items:start}
.sj-tt{width:100%;border-collapse:collapse;font-size:12.5px}.sj-tt th{background:var(--sc);color:#fff;font-size:14px;padding:7px;text-align:center}
.sj-tt td{border-bottom:1px solid #E5E9E8;padding:6px 8px;vertical-align:middle}.sj-tt td:last-child{text-align:right;font-weight:800;white-space:nowrap}
.sj-tt tr.on td{background:var(--sl);color:var(--sc);font-weight:800}
.sj-card{margin-top:auto;margin-bottom:2mm;display:flex;justify-content:space-between;align-items:center;gap:14px;border:1.5px solid var(--sc);border-radius:14px;padding:12px 18px;background:linear-gradient(135deg,#fff 60%,var(--sl))}
.sj-card-k{font-size:11.5px;color:var(--sc);font-weight:700;letter-spacing:.05em}.sj-card-n{font-size:22px;font-weight:900;margin:2px 0}.sj-card-n small{font-size:13px;font-weight:700;color:var(--sc);margin-left:8px}
.sj-card-o{font-size:13px;color:#55605E}.sj-card-c{margin-top:6px;font-size:14px;font-weight:700}.sj-card-c i{font-style:normal;display:inline-block;width:34px;font-size:11.5px;color:#7A8583;font-weight:600}
.sj-card figure{margin:0;text-align:center}.sj-card img{width:92px;height:92px}
#sj-printbox{display:none}
@media print{ @page{size:A4;margin:0} body.sj-printing>*:not(#sj-printbox){display:none!important} body.sj-printing #sj-printbox{display:block!important}
  body.sj-printing{background:#fff!important} #sj-printbox .sj-page{zoom:1;box-shadow:none;-webkit-print-color-adjust:exact;print-color-adjust:exact} }
@media(max-width:900px){.sj-crow{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.sj-crow>*{min-width:0}.sj-crow select{order:1}.sj-crow input[data-ct$=":date"]{order:2}.sj-crow input[data-ct$=":prod"]{grid-column:1/-1;order:3}.sj-crow button{order:4;grid-column:1/-1}.sj-prevbox .sj-page{zoom:.42}}
`;
const st=document.createElement("style"); st.textContent=CSS; document.head.appendChild(st);
window.SOKJI={draw,S,build};
if(document.readyState!=="loading") draw(); else document.addEventListener("DOMContentLoaded",draw);
})();
