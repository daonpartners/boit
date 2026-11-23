/* 보잇 · 제안·영업 › AI 비교제안서 (2026-11-20)
   ① 보장분석 PDF → 해지할 계약 선택  ② 신규 설계서 전체 PDF 여러 개  ③ AI 비교제안서 만들기
   → 고객에게 드릴 A4 세로 문서(한눈에 요약·계약 변경·핵심 담보 비교·치료비 요점·신규 특징·줄어드는 담보·가입 전 확인)
   - 계약·보험료·담보 금액: 리모델링 비교표(remodel.js)와 같은 읽기·계산 (보장분석·설계서 숫자 그대로)
   - 문안·치료비 요점표: n8n '보잇 AI 비교제안서' (POST boit-compare-doc) — 설계서 원문에 적힌 것만
   - 문서는 눌러서 바로 고칠 수 있고, 인쇄(PDF 저장)·워드(.docx) 받기 */
(function(){
"use strict";
const API="https://daonpartners.app.n8n.cloud/webhook/boit-compare-doc";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const won=n=>Math.round(+n||0).toLocaleString("ko-KR");
const RM=()=>window.REMODEL;
const A={busy:false,msg:"",res:null,html:"",ed:false};

/* 만원 → 문서 표기 (1억 5,000 / 500 / 2.5) */
function man(v){ if(v==null||isNaN(v)) return ""; v=Math.round(v*10)/10; if(v>=10000){ const e=Math.floor(v/10000), r=Math.round((v-e*10000)*10)/10; return e+"억"+(r?" "+r.toLocaleString("ko-KR"):""); } return v.toLocaleString("ko-KR"); }
const cut=(s,n)=>{ s=String(s||"").replace(/\s+/g," ").trim(); return s.length>n?s.slice(0,n-1)+"…":s; };
const renewOf=d=>(d.items||[]).some(i=>/갱신/.test(i.name)&&!/비갱신/.test(i.name));
async function tok(){ try{ return (typeof CLOUD!=="undefined"&&CLOUD.sb)?(await CLOUD.sb.auth.getSession()).data.session?.access_token:null; }catch(e){ return null; } }
function me(){ try{ return typeof ME!=="undefined"&&ME?ME:{}; }catch(_){ return {}; } }

/* ---------- 계약·담보 숫자 (리모델링 비교표 계산 그대로) ---------- */
function facts(){
  const S=RM().S, T=RM().table();
  const cancel=S.cur.filter(d=>!d.on), keep=S.cur.filter(d=>d.on), add=S.prop.filter(d=>d.on);
  const cellTxt=(x,yn)=>!x?"":yn?String(RM().ynTxt(x)).replace(/(\d)만(?=\s|\)|$|·)/g,"$1"):man(x.amt);
  const LK=RM().LISTK||{}, lt=x=>String(RM().listTxt(x)).replace(/(\d)만(?=,|\s|$)/g,"$1");
  const rows=T.rows.filter(r=>r.before||r.after).map(r=>{ const yn=!!r.c.yn, isL=!!LK[r.c.k], b=isL?(r.before?lt(r.before):""):cellTxt(r.before,yn), a=isL?(r.after?lt(r.after):""):cellTxt(r.after,yn);
    let ch; if(yn&&RM().SURG[r.c.k]) ch=RM().surgChg(r.before,r.after).tag||"유지"; else if(yn) ch=!r.before&&r.after?"신규":r.before&&!r.after?"없어짐":b!==a?"바뀜":"유지"; else { const d=Math.round(((r.after?r.after.amt:0)-(r.before?r.before.amt:0))*10)/10; ch=!r.before?"신규":!r.after?"없어짐":isL?(d>0?"최고 +"+man(d):d<0?"최고 −"+man(-d):b===a?"같음":"구성 바뀜"):d>0?"+"+man(d):d<0?"−"+man(-d):"같음"; }
    let bb=b||"—", aa=a||"—";
    /* 넓은 진단비로 보장되는 좁은 진단비: '없어짐' 대신 (금액은 분류표 기준이라 더하지 않음) */
    const cn=x=>String(x||"").replace(/\(.*$/,"");
    if(!yn&&r.before&&!(r.after&&r.after.amt>0)&&r.covA&&r.covA.length){ aa=`${cn(r.covA[r.covA.length-1])}로 보장`; ch="상위 진단비로 보장"; }
    if(!yn&&!r.before&&r.after&&r.covB&&r.covB.length){ bb=`${cn(r.covB[r.covB.length-1])}로 보장`; ch="+"+man(r.after.amt)+" (별도 담보)"; }
    if(r.c.k==="circ_thr"&&r.covA&&r.covA.length&&r.after){ aa+=" · 순환계 통합치료비에도 포함"; if(/^−/.test(ch)) ch+=" (순환계 통합치료비 별도)"; }
    if(r.spB) bb+=` · 산정특례 ${man(r.spB)}(조건부)`; if(r.spA) aa+=` · 산정특례 ${man(r.spA)}(조건부)`;
    return {k:r.c.k,t:r.c.t,before:bb,after:aa,change:ch,total:!!r.c.total}; });
  const pCancel=cancel.reduce((s,d)=>s+(d.prem||0),0), pKeep=keep.reduce((s,d)=>s+(d.prem||0),0), pAdd=add.reduce((s,d)=>s+(d.prem||0),0);
  return {S,T,cancel,keep,add,rows,prem:{before:T.pBefore,after:T.pAfter,cancel:pCancel,keep:pKeep,add:pAdd,diff:T.pAfter-T.pBefore}};
}

/* AI 없이도 만드는 기본 문안 (AI 실패·응답 전) */
function fallback(F){
  const up=F.rows.filter(r=>!r.total&&(r.change==="신규"||/^\+|확대/.test(r.change))), dn=F.rows.filter(r=>!r.total&&(r.change==="없어짐"||/^−/.test(r.change)));
  return {good:up.slice(0,5).map(r=>`${r.t.replace(/\s*\(.*$/,"")} ${r.change==="신규"?"신규":"확대"}`), bad:dn.slice(0,4).map(r=>`${r.t} ${r.change==="없어짐"?"없어짐":"감소"}`), addTag:[], tx:[], main:[],
    reduce:dn.slice(0,5).map(r=>({t:`${r.t} ${r.before} → ${r.after}`,text:"필요하면 증액 설계 검토"})), checks:[]};
}

/* ---------- 문서 ---------- */
function buildDoc(F,R){
  const S=F.S, m=me(), ymd=new Date(Date.now()+9*3600e3).toISOString().slice(0,10);
  const nm=S.cname?esc(S.cname)+" 고객님":"고객님", P=F.prem, dsg=P.diff>0?"+":P.diff<0?"−":"";
  const who=[ymd,[m.company,m.branch].filter(Boolean).join(" "),m.name].filter(Boolean).map(esc).join(" · ");
  const li=(b,t)=>`<li><b>${esc(b)}</b>: ${esc(t)}</li>`;
  let h=`<h1>${nm} 보장비교 제안서</h1><p class="ad-meta">${who}</p>`;
  /* 한눈에 요약 */
  h+=`<h2>한눈에 요약</h2><p class="ad-big"><b>월 보험료 ${won(P.before)}원 → ${won(P.after)}원 (${dsg}${won(Math.abs(P.diff))}원)</b></p><ul>`;
  if(F.cancel.length){ const rn=F.cancel.filter(renewOf).length; h+=li("정리",`기존 ${F.cancel.length}건${rn?`(갱신형 ${rn}건 포함)`:""} 월 ${won(P.cancel)}원`); }
  if(F.add.length) h+=li("새로 가입",F.add.map(d=>`${d.co} ${won(d.prem)}원`).join(" · "));
  if(R.good.length) h+=li("좋아지는 점",R.good.join(", "));
  if(R.bad.length) h+=li("줄어드는 점",R.bad.join(", "));
  h+=`</ul>`;
  /* 1. 계약 변경 */
  const tag=(i)=>R.addTag&&R.addTag[i]?` (${R.addTag[i]})`:"";
  h+=`<h2>1. 계약 변경</h2><table class="ad-t" data-w="13,62,25"><thead><tr><th>구분</th><th>보험</th><th>월 보험료(원)</th></tr></thead><tbody>`;
  F.cancel.forEach(d=>{ h+=`<tr><td class="c">해지</td><td>${esc(d.co)} ${esc(cut(d.prod,34))}${renewOf(d)?" (갱신형 포함)":""}</td><td class="n">${won(d.prem)}</td></tr>`; });
  if(F.keep.length) h+=`<tr><td class="c">유지</td><td>${esc(F.keep.map(d=>`${d.co} ${cut(d.prod,14)}`).join(" · "))}</td><td class="n">${won(P.keep)}</td></tr>`;
  F.add.forEach((d,i)=>{ h+=`<tr><td class="c">신규</td><td>${esc(d.co)} ${esc(cut(d.prod,34))}${esc(tag(i))}</td><td class="n">${won(d.prem)}</td></tr>`; });
  h+=`<tr class="tot"><td class="c">변경 후</td><td>유지 ${won(P.keep)} + 신규 ${won(P.add)}</td><td class="n">${won(P.after)}</td></tr></tbody></table>`;
  /* 2. 핵심 담보 비교 */
  const rows=F.rows.filter(r=>r.before!=="—"||r.after!=="—");
  if(rows.length){
    /* 칸 안 줄바꿈은 항목 사이(, · /)에서만: '산정특례 500(조건부)'·'중상해 2억'이 중간에서 잘리지 않게 */
    const nb=t=>String(t).split(/( · |, | \/ )/).map((p,i)=>i%2?esc(p):`<span class="nb">${esc(p)}</span>`).join("");
    h+=`<h2>2. 핵심 담보 비교 <small>(단위: 만원)</small></h2><table class="ad-t" data-w="25,26,27,22"><thead><tr><th>담보</th><th>지금</th><th>변경 후</th><th>변화</th></tr></thead><tbody>`;
    rows.forEach(r=>{ const cls=r.change==="신규"||/^\+|확대/.test(r.change)?"up":r.change==="없어짐"||/^−/.test(r.change)?"dn":""; h+=`<tr${r.total?' class="tot"':""}><td>${esc(r.t)}</td><td class="c">${nb(r.before)}</td><td class="c">${nb(r.after)}</td><td class="c ${cls}">${esc(r.change)}</td></tr>`; });
    h+=`</tbody></table>`;
  }
  /* 3. 치료비 요점 */
  if(R.tx.length){
    h+=`<h2>3. 치료비 요점 <small>(단위: 만원)</small></h2>`;
    R.tx.forEach(t=>{ const n=t.cols.length, first=n<=2?60:34, rest=Math.floor((100-first)/Math.max(1,n-1));
      const hc=c=>esc(c).replace(/\(/g,"<br>(");
      h+=`<h3>${esc(t.title)}</h3><table class="ad-t ad-tx" data-dw="${[first,...Array(n-1).fill(rest)].join(",")}"><thead><tr>${t.cols.map((c,j)=>`<th>${j?hc(c):esc(c)}</th>`).join("")}</tr></thead><tbody>`;
      t.rows.forEach(r=>{ const last=/합계/.test(t.cols[n-1]||""); h+=`<tr${/총한도|한도/.test(r[0]||"")?' class="tot"':""}>${t.cols.map((c,j)=>`<td class="${j?"c":""}">${j&&j===n-1&&last?"<b>"+esc(r[j]||"")+"</b>":esc(r[j]||"")}</td>`).join("")}</tr>`; });
      h+=`</tbody></table>${t.note?`<p class="ad-note">${esc(t.note)}</p>`:""}`; });
  }
  let no=R.tx.length?4:3;
  /* 4. 신규 계약 특징 */
  if(R.main.length){ h+=`<h2>${no++}. 새 계약의 특징</h2>`; R.main.forEach(x=>{ h+=`<h3>${esc(x.title)}</h3><ul>${x.points.map(p=>`<li>${esc(p)}</li>`).join("")}</ul>`; }); }
  /* 5. 줄어드는 담보 */
  if(R.reduce.length){ h+=`<h2>${no++}. 줄어드는 담보</h2><ul>${R.reduce.map(x=>li(x.t,x.text)).join("")}</ul>`; }
  /* 6. 가입 전 확인 */
  const ck=["새 계약 인수(가입) 확정 후 기존 계약 해지"].concat(R.checks,["기존·신규 계약 비교안내 확인서 자필서명 (보험업법 제97조)"]);
  h+=`<h2>${no++}. 가입 전 확인</h2><ul>${ck.map(c=>`<li>${esc(c)}</li>`).join("")}</ul>`;
  if(F.rows.some(r=>/상위 진단비로 보장|조건부|별도 담보/.test(r.change+r.before+r.after))) h+=`<p class="ad-note">뇌출혈·뇌졸중은 뇌혈관질환진단비, 급성심근경색·허혈성심장질환은 심장질환진단비 범위 안에서도 보장될 수 있습니다. 실제 지급 여부와 금액은 각 약관의 질병분류표를 따릅니다. 산정특례 보장은 건강보험 산정특례 대상으로 등록되는 등 약관의 조건을 채운 경우에만 지급됩니다.</p>`;
  h+=`<p class="ad-src">자료: 보장분석 · ${esc(F.add.map(d=>`${d.co} ${cut(d.prod,24)}`).join(" · "))} 설계서. 금액은 가입금액 기준이며, 보장 내용과 지급 조건은 각 보험사 약관을 따릅니다.</p>`;
  return h;
}

/* 설계서 원문에는 있는데 담보표 읽기에서 빠진 주요 담보 (예: 순환계 통합치료비·종수술비) — 설계사가 바로 알 수 있게 */
const CHK=[["circ",/순환계|2대질병|뇌심|심뇌/,"순환계(뇌·심장) 치료비"],["dtype",/[1-9]\s*[~\-]\s*[1-9]\s*종\s*수술/,"종수술비"],["ctx",/암.{0,6}(통합|주요)치료/,"암 통합·주요치료비"],["care",/간병인/,"간병인"]];
/* 2026-11-23: 설계서 뒤쪽 '특약 안내·유의사항'에는 가입하지 않은 특약 이름도 나와서 잘못 경고함
   → 담보표 줄(같은 줄에 '1천만원'처럼 가입금액이 있는 짧은 줄)에서만 찾음 */
const AMT=/\d[\d,.]*\s*(억|천만|백만|십만|만)\s*원/;
function covLines(t){ return String(t).split(/\n/).filter(l=>l.length<=120&&AMT.test(l)&&!/합니다|경우|적용|예시|지급합|※|주\d\)/.test(l)).join("\n"); }
function miss(d){ const t=covLines(d.txt||""); if(!t) return "";
  const has=k=>d.items.some(i=>i.cat===k||(k==="dtype"&&i.cat==="itype"));
  const m=CHK.filter(([k,re])=>re.test(t)&&!has(k)).map(x=>x[2]);
  return m.length?`<em style="color:#c0392b">설계서에 ${esc(m.join("·"))}가 보이는데 담보표에서 못 읽었습니다. 리모델링 비교표 6번 '담보 분류 확인'에서 확인하세요.</em>`:""; }

/* ---------- 화면 ---------- */
function draw(){
  const R0=$("#ad-root"); if(!R0||!RM()) return;
  const S=RM().S, F=S.cur.length||S.prop.length?facts():null;
  R0.innerHTML=`
  <div class="rm-steps">
    <div class="panel rm-step"><h3><span>1</span>기존 보험 · 해지할 계약 고르기</h3>
      <div class="rm-btns"><label class="btn primary" style="cursor:pointer">보장분석 PDF 올리기<input id="ad-cov" type="file" accept="application/pdf,.pdf" multiple hidden></label></div>
      <p class="rm-hint">메리츠 간편보장분석 · 신용정보원 보장분석 PDF. 해지할 계약은 눌러서 '해지'로 바꾸세요.</p>
      ${S.cur.length?`<ul class="rm-list">${S.cur.map(d=>`<li class="${d.on?"":"off"}"><label class="rm-sw"><input type="checkbox" data-adon="${d.id}" ${d.on?"checked":""}><span>${d.on?"유지":"해지"}</span></label><div><b>${esc(d.co)}</b> ${esc(cut(d.prod,40))}<em>월 ${won(d.prem)}원${renewOf(d)?" · 갱신형 포함":""}</em></div></li>`).join("")}</ul>`:""}
    </div>
    <div class="panel rm-step"><h3><span>2</span>신규 설계서 (전체 PDF)</h3>
      <div class="rm-btns"><label class="btn primary" style="cursor:pointer">설계서 PDF 올리기 (여러 개)<input id="ad-prop" type="file" accept="application/pdf,.pdf" multiple hidden></label></div>
      <p class="rm-hint">보험사 상품제안서·가입설계서 전체 PDF (특약 안내 쪽까지 있어야 치료비 요점을 만듭니다)</p>
      ${S.prop.length?`<ul class="rm-list">${S.prop.map(d=>`<li class="${d.on?"":"off"}"><label class="rm-sw p"><input type="checkbox" data-adpon="${d.id}" ${d.on?"checked":""}><span>${d.on?"가입":"제외"}</span></label><div><b>${esc(d.co)}</b> ${esc(cut(d.prod,40))}<em>월 ${won(d.prem)}원 · 담보 ${d.items.length}개${d.txt?"":" · 원문 글자 없음"}</em>${miss(d)}</div><button type="button" class="rm-colx" style="position:static;opacity:.7" data-addel="${d.id}" title="빼기">✕</button></li>`).join("")}</ul>`:""}
    </div>
  </div>
  <div class="panel" style="margin-top:12px"><h3 class="rm-h3" style="margin:0 0 8px"><span>3</span>AI 비교제안서 만들기</h3>
    <div class="ad-go"><label>고객 이름<input id="ad-cname" value="${esc(S.cname||"")}" placeholder="예: 최은희"></label>
      ${F?`<div class="ad-pv"><span>지금 <b>${won(F.prem.before)}원</b></span><span>→ 변경 후 <b>${won(F.prem.after)}원</b></span><span class="${F.prem.diff>0?"dn":"up"}">${F.prem.diff>0?"+":F.prem.diff<0?"−":""}${won(Math.abs(F.prem.diff))}원</span></div>`:""}
      <button class="btn primary" type="button" id="ad-make" ${A.busy||!S.prop.some(d=>d.on)?"disabled":""}>${A.busy?"AI가 만드는 중… (30초~1분)":A.html?"다시 만들기":"AI 비교제안서 만들기"}</button></div>
    <p class="rm-msg" id="ad-msg">${esc(A.msg||S.msg||"")}</p>
  </div>
  ${A.html?`<div class="panel" style="margin-top:12px">
    <div class="row between" style="flex-wrap:wrap;gap:8px"><h3 class="rm-h3" style="margin:0">고객용 비교제안서 <small>글자를 눌러 바로 고칠 수 있습니다</small></h3>
      <div class="rm-btns"><button class="btn" type="button" id="ad-print">인쇄 · PDF 저장</button><button class="btn primary" type="button" id="ad-word">워드(.docx) 받기</button></div></div>
    <div class="ad-bar" role="toolbar" aria-label="문서 고치기">
      <span class="ad-g"><b>글씨</b>${[["#1d2420","검정"],["#c0392b","빨강"],["#1d4ed8","파랑"],["#0b7a4b","초록"],["#d97706","주황"]].map(([c,t])=>`<button type="button" class="ad-sw" data-adcmd="foreColor" data-v="${c}" title="글씨 ${t}" style="background:${c}"></button>`).join("")}<button type="button" class="ad-tb" data-adcmd="bold" title="굵게"><b>B</b></button></span>
      <span class="ad-g"><b>형광펜</b>${[["#fff176","노랑"],["#b9f6ca","연두"],["#ffcdd2","분홍"],["#bbdefb","하늘"]].map(([c,t])=>`<button type="button" class="ad-sw" data-adcmd="hiliteColor" data-v="${c}" title="형광펜 ${t}" style="background:${c}"></button>`).join("")}<button type="button" class="ad-tb" data-adcmd="hiliteColor" data-v="transparent" title="형광펜 지우기">지우기</button></span>
      <span class="ad-g"><b>표</b><button type="button" class="ad-tb" data-adrow="above">위에 줄 넣기</button><button type="button" class="ad-tb" data-adrow="below">아래에 줄 넣기</button><button type="button" class="ad-tb" data-adrow="del">줄 삭제</button></span>
      <span class="ad-g"><button type="button" class="ad-tb" data-adcmd="removeFormat" title="고른 글자의 색·굵기 없애기">서식 지우기</button><button type="button" class="ad-tb" data-adcmd="undo">되돌리기</button><button type="button" class="ad-tb" data-adcmd="redo">다시</button></span>
    </div>
    <p class="ad-tip">글자를 끌어서 고른 뒤 색·형광펜을 누르세요. 표 줄 넣기·삭제는 그 줄의 칸을 한 번 누른 뒤 누르세요. 표 밖에서 '줄 삭제'를 누르면 그 문단(목록 한 줄)을 지웁니다.</p>
    <div class="ad-desk"><div class="ad-paper" id="ad-paper" contenteditable="true" spellcheck="false">${A.html}</div></div>
  </div>`:""}`;
  const pp=$("#ad-paper"); if(pp) colgroup(pp);
}

async function make(){
  const S=RM().S; if(A.busy) return;
  const cn=$("#ad-cname"); if(cn) S.cname=cn.value.trim();
  const add=S.prop.filter(d=>d.on); if(!add.length){ A.msg="신규 설계서를 먼저 올려 주세요."; draw(); return; }
  const F=facts(); let R=fallback(F);
  const t0=await tok(); if(!t0){ A.msg="다시 로그인해 주세요. (AI 문안 없이 숫자 부분만 만들었습니다)"; A.html=buildDoc(F,R); draw(); return; }
  A.busy=true; A.msg="AI가 설계서 원문을 읽고 문안을 만드는 중입니다… (30초~1분)"; draw();
  const body={token:t0,
    cancel:F.cancel.map(d=>({co:d.co,prod:d.prod,prem:d.prem,renew:renewOf(d)})), keep:F.keep.map(d=>({co:d.co,prod:d.prod,prem:d.prem})),
    prem:F.prem, rows:F.rows.map(r=>({t:r.t,before:r.before,after:r.after,change:r.change})),
    props:add.map(d=>({co:d.co,prod:d.prod,prem:d.prem,text:d.txt||d.items.map(i=>`${i.name} ${i.raw||(i.amt!=null?i.amt+"만원":"")}`).join("\n")}))};
  let j=null; try{ const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); j=JSON.parse(await r.text()); }catch(e){ j=null; }
  A.busy=false;
  if(j&&j.ok){ R={good:j.good&&j.good.length?j.good:R.good,bad:j.bad&&j.bad.length?j.bad:R.bad,addTag:j.addTag||[],tx:j.tx||[],main:j.main||[],reduce:j.reduce&&j.reduce.length?j.reduce:R.reduce,checks:j.checks||[]};
    A.msg=`비교제안서를 만들었습니다. 금액·조건은 설계서 원본과 꼭 대조하세요.${j.left!=null?` (오늘 남은 횟수 ${j.left}회)`:""}`; }
  else A.msg=((j&&j.error)||"AI 문안을 받지 못했습니다.")+" 숫자 부분(계약 변경·담보 비교)만 먼저 만들었습니다. 다시 눌러 보세요.";
  A.res=R; A.html=buildDoc(F,R); draw();
  const pp=$("#ad-paper"); if(pp) pp.scrollIntoView({behavior:"smooth",block:"start"});
}

/* ---------- 인쇄 · 워드 ---------- */
const DOC_CSS=`
@page{size:A4;margin:14mm 15mm}
.ad-paper{font-family:Pretendard,"Malgun Gothic","Apple SD Gothic Neo",sans-serif;color:#1d2420;font-size:10.5pt;line-height:1.55;word-break:keep-all;overflow-wrap:break-word}
.ad-paper h1{font-size:19pt;margin:0 0 2px;letter-spacing:-.3px}
.ad-paper .ad-meta{margin:0 0 6px;color:#666;font-size:9pt}
.ad-paper h2{font-size:13pt;color:#1d5c4a;margin:16px 0 6px;padding-bottom:3px;border-bottom:1.5px solid #1d5c4a;break-after:avoid;page-break-after:avoid}
.ad-paper h2 small{font-weight:400;color:#666;font-size:9.5pt}
.ad-paper h3{font-size:11pt;margin:10px 0 4px;break-after:avoid;page-break-after:avoid}
.ad-paper p{margin:4px 0}.ad-paper .ad-big{font-size:12pt;margin:6px 0}
.ad-paper ul{margin:4px 0 4px;padding-left:18px}.ad-paper li{margin:2px 0}
.ad-paper table{width:100%;border-collapse:collapse;table-layout:auto;margin:4px 0 6px;font-size:9.5pt;break-inside:auto}
.ad-paper table[data-w]{table-layout:fixed}
.ad-paper tr{break-inside:avoid;page-break-inside:avoid}
.ad-paper th,.ad-paper td{border:1px solid #c9d1cc;padding:4px 7px;vertical-align:middle;text-align:left;word-break:keep-all;overflow-wrap:normal;line-height:1.4}
.ad-paper .nb{white-space:nowrap}.ad-paper td.c,.ad-paper td.n{white-space:nowrap}.ad-paper table[data-w] td.c{white-space:normal}
.ad-paper th{background:#e7f1fb;font-weight:700;text-align:center}
.ad-paper td.c{text-align:center}.ad-paper td.n{text-align:right;font-variant-numeric:tabular-nums}
.ad-paper td.up{color:#0b7a4b;font-weight:700}.ad-paper td.dn{color:#c0392b;font-weight:700}
.ad-paper tr.tot td{background:#f0efec;font-weight:700}
.ad-paper .ad-note{font-size:9pt;color:#555;margin:2px 0 8px}
.ad-paper .ad-src{margin-top:14px;font-size:8.5pt;color:#777;border-top:1px solid #ddd;padding-top:6px}
`;
function colgroup(root){ root.querySelectorAll("table[data-w]").forEach(t=>{ if(t.querySelector("colgroup")) return; const cg=document.createElement("colgroup"); t.dataset.w.split(",").forEach(w=>{ const c=document.createElement("col"); c.style.width=w+"%"; cg.appendChild(c); }); t.insertBefore(cg,t.firstChild); }); }
function paperHtml(){ const p=$("#ad-paper"); return p?p.innerHTML:A.html; }
function fname(ext){ const S=RM().S, d=new Date(Date.now()+9*3600e3).toISOString().slice(0,10).replace(/-/g,""); return `${S.cname?S.cname.replace(/[\\/:*?"<>|\s]/g,"")+"_":""}보장비교제안서_${d}.${ext}`; }
function printIt(){
  const w=window.open("","_blank"); if(!w){ A.msg="팝업이 막혀 인쇄 창을 열지 못했습니다. 팝업을 허용해 주세요."; draw(); return; }
  w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(fname("pdf").replace(/\.pdf$/,""))}</title><style>body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}${DOC_CSS}@media screen{body{background:#eee}.ad-paper{background:#fff;width:210mm;margin:10px auto;padding:14mm 15mm;box-sizing:border-box}}</style></head><body><div class="ad-paper">${paperHtml()}</div></body></html>`);
  w.document.close(); colgroup(w.document); setTimeout(()=>{ w.focus(); w.print(); },400);
}
function loadDocx(){ return window.docx?Promise.resolve(window.docx):new Promise((ok,no)=>{ const s=document.createElement("script"); s.src="vendor/docx.iife.js?v=9.8.1"; s.onload=()=>window.docx?ok(window.docx):no(new Error("docx")); s.onerror=()=>no(new Error("docx")); document.head.appendChild(s); }); }
async function wordIt(){
  const btn=$("#ad-word"); if(btn){ btn.disabled=true; btn.textContent="워드 만드는 중…"; }
  try{
    const D=await loadDocx(), F="Malgun Gothic", W=9638;
    const {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,ShadingType,AlignmentType,LevelFormat,BorderStyle,HeadingLevel,VerticalAlign}=D;
    const bd={style:BorderStyle.SINGLE,size:4,color:"C9D1CC"}, borders={top:bd,bottom:bd,left:bd,right:bd};
    /* 글자 색·형광펜·굵게(문서에서 고친 것)도 워드로 */
    const hex=v=>{ if(!v) return null; v=String(v).trim(); if(/^#[0-9a-f]{6}$/i.test(v)) return v.slice(1).toUpperCase(); const m=v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/); if(!m||(m[4]!=null&&+m[4]===0)) return null; return [m[1],m[2],m[3]].map(x=>(+x).toString(16).padStart(2,"0")).join("").toUpperCase(); };
    const runsOf=(el,o={})=>{ const out=[]; const walk=(n,st)=>{ n.childNodes.forEach(c=>{ if(c.nodeType===3){ const t=c.textContent.replace(/\s+/g," "); if(t) out.push(new TextRun({text:t,bold:st.b||o.bold,font:F,size:o.size||20,color:st.color||o.color,shading:st.fill?{type:ShadingType.CLEAR,fill:st.fill,color:"auto"}:undefined})); } else if(c.nodeType===1){ if(c.tagName==="BR") out.push(new TextRun({text:"",break:1,font:F})); else { const s=c.style||{}, fw=s.fontWeight; walk(c,{b:st.b||/^(B|STRONG)$/.test(c.tagName)||fw==="bold"||+fw>=600,color:hex(s.color)||(c.tagName==="FONT"&&hex(c.getAttribute("color")))||st.color,fill:hex(s.backgroundColor)||st.fill}); } } }); }; walk(el,{b:false,color:null,fill:null}); return out; };
    const kids=[], root=document.createElement("div"); root.innerHTML=paperHtml();
    root.childNodes.forEach(n=>{ if(n.nodeType!==1){ const t=(n.textContent||"").trim(); if(t) kids.push(new Paragraph({children:[new TextRun({text:t,font:F,size:20})]})); return; }
      const tg=n.tagName;
      if(tg==="H1") kids.push(new Paragraph({heading:HeadingLevel.TITLE,children:runsOf(n,{size:36,bold:true})}));
      else if(tg==="H2") kids.push(new Paragraph({heading:HeadingLevel.HEADING_2,border:{bottom:{style:BorderStyle.SINGLE,size:8,color:"1D5C4A",space:2}},children:runsOf(n,{size:26,bold:true,color:"1D5C4A"})}));
      else if(tg==="H3") kids.push(new Paragraph({heading:HeadingLevel.HEADING_3,children:runsOf(n,{size:21,bold:true})}));
      else if(tg==="UL"||tg==="OL") n.querySelectorAll(":scope>li").forEach(li=>kids.push(new Paragraph({numbering:{reference:"b",level:0},spacing:{after:40},children:runsOf(li)})));
      else if(tg==="TABLE"){ const trs=[...n.querySelectorAll("tr")]; if(!trs.length) return; const ncol=Math.max(...trs.map(r=>r.children.length));
        let ws=(n.dataset.w||n.dataset.dw||"").split(",").map(Number).filter(x=>x>0); if(ws.length!==ncol) ws=Array(ncol).fill(100/ncol); const sum=ws.reduce((a,b)=>a+b,0), cw=ws.map(x=>Math.floor(W*x/sum)); cw[cw.length-1]+=W-cw.reduce((a,b)=>a+b,0);
        kids.push(new Table({width:{size:W,type:WidthType.DXA},columnWidths:cw,rows:trs.map((tr,ri)=>{ const head=tr.parentElement.tagName==="THEAD", tot=tr.classList.contains("tot");
          return new TableRow({tableHeader:head,cantSplit:true,children:[...tr.children].map((td,j)=>{ const al=head||td.classList.contains("c")?AlignmentType.CENTER:td.classList.contains("n")?AlignmentType.RIGHT:AlignmentType.LEFT;
            const col=td.classList.contains("up")?"0B7A4B":td.classList.contains("dn")?"C0392B":undefined;
            return new TableCell({borders,width:{size:cw[j]||cw[0],type:WidthType.DXA},verticalAlign:VerticalAlign.CENTER,margins:{top:50,bottom:50,left:100,right:100},
              shading:head?{type:ShadingType.CLEAR,fill:"E7F1FB",color:"auto"}:tot?{type:ShadingType.CLEAR,fill:"F0EFEC",color:"auto"}:undefined,
              children:[new Paragraph({alignment:al,children:runsOf(td,{size:18,bold:head||tot||!!col,color:col})})]}); })}); })}));
        kids.push(new Paragraph({children:[],spacing:{after:60}})); }
      else { const cls=n.className||""; kids.push(new Paragraph({spacing:{after:80},children:runsOf(n,/ad-src/.test(cls)?{size:16,color:"777777"}:/ad-note/.test(cls)?{size:18,color:"555555"}:/ad-meta/.test(cls)?{size:18,color:"666666"}:/ad-big/.test(cls)?{size:24}:{})})); }
    });
    const doc=new Document({styles:{default:{document:{run:{font:F,size:20}}},
        title:{run:{font:F,size:36,bold:true},paragraph:{spacing:{before:0,after:80},keepNext:true}},
        heading2:{run:{font:F,size:26,bold:true,color:"1D5C4A"},paragraph:{spacing:{before:280,after:100},keepNext:true}},
        heading3:{run:{font:F,size:21,bold:true},paragraph:{spacing:{before:160,after:60},keepNext:true}}},
      numbering:{config:[{reference:"b",levels:[{level:0,format:LevelFormat.BULLET,text:"•",alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:360,hanging:240}}}}]}]},
      sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,bottom:1134,left:1134,right:1134}}},children:kids}]});
    const blob=await Packer.toBlob(doc), name=fname("docx");
    let dl=null; try{ dl=typeof DL!=="undefined"?DL:null; }catch(_){}
    if(dl&&dl.save) await dl.save({filename:name,data:blob});
    else { const u=URL.createObjectURL(blob),a=document.createElement("a"); a.href=u; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),3000); }
    A.msg="워드 파일을 저장했습니다.";
  }catch(e){ A.msg=e&&e.code==="declined"?"저장을 취소했습니다.":"워드 파일을 만들지 못했습니다. 새로고침 후 다시 시도하세요."; }
  A.html=paperHtml(); draw();
}

/* ---------- 이벤트 ---------- */
document.addEventListener("change",async e=>{
  const t=e.target; if(!t.closest||!t.closest("#ad-root")) return;
  const S=RM().S;
  if(t.id==="ad-cov"&&t.files.length){ const fs=[...t.files]; t.value=""; A.msg=""; await RM().addCover(fs); A.msg=S.msg; draw(); return; }
  if(t.id==="ad-prop"&&t.files.length){ const fs=[...t.files]; t.value=""; A.msg="설계서 읽는 중… (AI가 읽는 회사는 10~20초)"; draw(); await RM().addProp(fs); A.msg=S.msg; draw(); return; }
  if(t.dataset.adon){ const d=S.cur.find(x=>x.id===+t.dataset.adon); if(d){ d.on=t.checked; RM().draw(); draw(); } return; }
  if(t.dataset.adpon){ const d=S.prop.find(x=>x.id===+t.dataset.adpon); if(d){ d.on=t.checked; RM().draw(); draw(); } return; }
  if(t.id==="ad-cname"){ S.cname=t.value.trim(); return; }
});
/* 문서 고치기 도구 (2026-11-20): 글씨 색·굵게·형광펜·표 줄 넣기/삭제·되돌리기 */
let LAST=null; /* 문서 안에서 마지막으로 누른 위치 */
document.addEventListener("selectionchange",()=>{ const sel=window.getSelection(), p=$("#ad-paper"); if(sel&&sel.rangeCount&&p&&p.contains(sel.anchorNode)) LAST=sel.getRangeAt(0).cloneRange(); });
document.addEventListener("mousedown",e=>{ if(e.target.closest&&e.target.closest(".ad-bar button")) e.preventDefault(); });
function restore(){ const p=$("#ad-paper"); if(!p) return null; const sel=window.getSelection(); if(LAST&&p.contains(LAST.startContainer)&&!(sel.rangeCount&&p.contains(sel.anchorNode))){ sel.removeAllRanges(); sel.addRange(LAST); } return p; }
function rowOp(kind){ const p=restore(); if(!p) return; const sel=window.getSelection(); let n=sel.rangeCount?sel.anchorNode:null; if(!n||!p.contains(n)){ A.msg="먼저 문서에서 줄을 한 번 눌러 주세요."; draw(); return; }
  n=n.nodeType===3?n.parentElement:n; const tr=n.closest("tr");
  if(tr&&p.contains(tr)){
    if(kind==="del"){ if(tr.parentElement.tagName==="THEAD"){ A.msg="표 머리 줄은 지울 수 없습니다."; draw(); return; } tr.remove(); }
    else { const nr=tr.cloneNode(true); nr.classList.remove("tot"); nr.querySelectorAll("td,th").forEach(c=>{ c.innerHTML="&nbsp;"; c.className=c.className.replace(/\b(up|dn)\b/g,""); });
      if(tr.parentElement.tagName==="THEAD"){ const tb=tr.closest("table").querySelector("tbody"); if(tb) tb.insertBefore(nr,tb.firstChild); } else tr.parentElement.insertBefore(nr,kind==="above"?tr:tr.nextSibling);
      const c=nr.querySelector("td,th"); if(c){ const r=document.createRange(); r.selectNodeContents(c); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); } }
  } else {
    const blk=n.closest("li,p,h1,h2,h3"); if(!blk||!p.contains(blk)) return;
    if(kind==="del") blk.remove();
    else { const nb=document.createElement(blk.tagName); nb.innerHTML="&nbsp;"; if(blk.className) nb.className=blk.className; blk.parentElement.insertBefore(nb,kind==="above"?blk:blk.nextSibling); const r=document.createRange(); r.selectNodeContents(nb); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); }
  }
  A.html=p.innerHTML; }
document.addEventListener("click",e=>{ const b=e.target.closest&&e.target.closest(".ad-bar button"); if(!b) return;
  if(b.dataset.adrow){ rowOp(b.dataset.adrow); return; }
  const p=restore(); if(!p) return; p.focus({preventScroll:true}); if(LAST){ const s=window.getSelection(); s.removeAllRanges(); s.addRange(LAST); }
  const c=b.dataset.adcmd, v=b.dataset.v||null;
  try{ document.execCommand("styleWithCSS",false,true); }catch(_){}
  if(c==="hiliteColor"&&v==="transparent"){ document.execCommand("hiliteColor",false,"transparent"); document.execCommand("backColor",false,"transparent"); }
  else if(!document.execCommand(c,false,v)&&c==="hiliteColor") document.execCommand("backColor",false,v);
  A.html=p.innerHTML; });
document.addEventListener("input",e=>{ if(e.target&&e.target.id==="ad-paper") A.html=e.target.innerHTML; });
document.addEventListener("click",e=>{
  const t=e.target; if(!t.closest||!t.closest("#ad-root")) return;
  if(t.closest("#ad-make")){ make(); return; }
  if(t.closest("#ad-print")){ A.html=paperHtml(); printIt(); return; }
  if(t.closest("#ad-word")){ A.html=paperHtml(); wordIt(); return; }
  const x=t.closest("[data-addel]"); if(x){ const S=RM().S, i=S.prop.findIndex(d=>d.id===+x.dataset.addel); if(i>=0){ S.prop.splice(i,1); RM().draw(); draw(); } return; }
});

const st=document.createElement("style"); st.textContent=DOC_CSS+`
.ad-go{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}.ad-go label{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--muted)}
.ad-go input{padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--fg);font:inherit;font-size:14px;width:180px}
.ad-pv{display:flex;gap:10px;align-items:center;font-size:13.5px;padding:8px 12px;border:1px solid var(--line);border-radius:10px}.ad-pv .up{color:#0b7a4b;font-weight:700}.ad-pv .dn{color:#c0392b;font-weight:700}
.ad-bar{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin-top:10px;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface);position:sticky;top:0;z-index:5}
.ad-g{display:inline-flex;gap:4px;align-items:center}.ad-g>b{font-size:12px;color:var(--muted);margin-right:2px}
.ad-sw{width:22px;height:22px;border-radius:5px;border:1px solid rgba(0,0,0,.2);cursor:pointer;padding:0}
.ad-tb{padding:4px 9px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--fg);font:inherit;font-size:12.5px;cursor:pointer}.ad-tb:hover,.ad-sw:hover{outline:2px solid var(--c4)}
.ad-tip{font-size:12px;color:var(--muted);margin:6px 2px 0}
.ad-desk{margin-top:12px;background:#e9ecef;border-radius:10px;padding:16px;overflow:auto}
.ad-desk .ad-paper{background:#fff;color:#1d2420;width:210mm;max-width:100%;min-height:297mm;margin:0 auto;padding:14mm 15mm;box-sizing:border-box;box-shadow:0 2px 10px rgba(0,0,0,.12);outline:none}
.ad-desk .ad-paper:focus{box-shadow:0 0 0 2px var(--c4),0 2px 10px rgba(0,0,0,.12)}
@media(max-width:700px){.ad-desk{padding:6px}.ad-desk .ad-paper{padding:6mm;min-height:0}}
`; document.head.appendChild(st);
window.AIDOC={draw};
if(document.readyState!=="loading") draw(); else document.addEventListener("DOMContentLoaded",draw);
})();
