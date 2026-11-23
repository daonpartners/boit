/* 보잇 · 보상청구 › 예상 보험금 (2026-11-22)
   흐름: ① 고객 가입 보험(보장분석·내보험다보여로 고객관리에 저장된 계약, 없으면 보장분석 PDF 바로 올리기)
         ② 올린 서류 글자 읽기(기기 안 Tesseract, 서버로 안 보냄) → 영수증 금액(급여 본인부담·비급여)·진단코드·입원일수·수술/처치명
         ③ 회사별 예상 금액: 실손 = 실손 계산기(SILSON, 세대별 자기부담) / 정액 = 진단비·수술비·입원일당 (숨은보험금 찾기와 같은 판정: HM_MX·hmPx — 심평원 진료행위 이름 기준)
   상담용 대략 금액. 실제 지급은 약관·보험사 심사(면책·감액·보장개시일·고지 등). 1~5종 수술비는 회사별 수술분류표로 종을 정해야 해서 범위로만 표시. */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const dg=s=>String(s==null?"":s).replace(/\D/g,"");
const won=n=>Math.round(n).toLocaleString()+"원";
const num=v=>{ const n=Number(String(v==null?"":v).replace(/[^\d]/g,"")); return isFinite(n)?n:0; };
/* "3,000만원"·"1억"·"30만"·"300,000원" → 원 */
function amtWon(s){ s=String(s==null?"":s).replace(/[,\s]/g,""); if(!s) return 0; let m, v=0;
  if((m=s.match(/([\d.]+)억/))) v+=+m[1]*1e8; if((m=s.match(/([\d.]+)천만/))) v+=+m[1]*1e7; else if((m=s.match(/([\d.]+)백만/))) v+=+m[1]*1e6;
  if(!/천만|백만/.test(s)&&(m=s.match(/(?:억)?([\d.]+)만/))) v+=+m[1]*1e4;
  if(!v&&(m=s.match(/^([\d.]+)원?$/))) v=+m[1]; return v; }
const man=w=>w>=1e8?(w/1e8).toLocaleString()+"억원":w>=1e4?(w/1e4).toLocaleString()+"만원":won(w);

function st(){ if(!S.ce) S.ce={read:"",bills:[],dx:"",inDays:"",procs:"",msg:"",pdfIns:null}; return S.ce; }
function cust(){ const n=(S.cl.name||"").trim(); if(!n) return null; const p=dg(S.cl.phone);
  return (S.cl.custId&&CUSTOMERS.find(x=>x.id===S.cl.custId&&x.name===n))||(p.length>=10&&CUSTOMERS.find(x=>x.name===n&&dg(x.phone)===p))||null; }
function ins(){ const E=st(); if(E.pdfIns) return E.pdfIns; const c=cust(); return c&&typeof hmInsFromCust==="function"?hmInsFromCust(c.id):null; }
const ymd=d=>{ const x=dg(d); return x.length>=8?`${x.slice(0,4)}-${x.slice(4,6)}-${x.slice(6,8)}`:""; };
const live=c=>!/해지|만기|소멸|철회|실효/.test(c.status||"");
const accD=()=>S.acc.date||new Date().toISOString().slice(0,10);
/* 사고일에 이미 가입돼 있던 계약만 */
const inForce=c=>{ const s=ymd(c.start); return !s||s<=accD(); };

/* ---------- 서류 글자 읽기 ---------- */
async function ocrFull(o){ let src=o.url, cv;
  if(!src&&/pdf$/i.test(o.file.type||o.name)&&window.pdfjsLib){ const d=await pdfjsLib.getDocument({data:await o.file.arrayBuffer()}).promise, p=await d.getPage(1), v=p.getViewport({scale:2}); cv=document.createElement("canvas"); cv.width=v.width; cv.height=v.height; await p.render({canvasContext:cv.getContext("2d"),viewport:v}).promise; }
  else { if(!src) return ""; const im=await new Promise((r,j)=>{ const i=new Image(); i.onload=()=>r(i); i.onerror=j; i.src=src; }); const W=im.naturalWidth, H=im.naturalHeight, k=Math.min(1,1800/W); cv=document.createElement("canvas"); cv.width=Math.round(W*k); cv.height=Math.round(H*k); cv.getContext("2d").drawImage(im,0,0,cv.width,cv.height); }
  const w=await ocrWorker(); const r=await w.recognize(cv); return r.data.text||""; }
const SCALE=t=>/상급종합|대학교병원|대학병원/.test(t)?"s":/종합병원|의료원/.test(t)?"g":/병원/.test(t)&&!/의원/.test(t)?"h":"c";
function parseBill(t,isRx){ const flat=t.replace(/[ \t]+/g," "), L=flat.split(/\n/), nums=l=>(l.replace(/20\d{2}[.\-\/]\d{1,2}[.\-\/]\d{1,2}/g,"").match(/\d{1,3}(?:,\d{3})+|\d+/g)||[]).map(x=>+x.replace(/,/g,""));
  let P=0,N=0,tot=0, ok=false;
  const sum=L.find(l=>/^\s*합\s*계/.test(l)||/합계\s*[\d,]/.test(l));
  if(sum){ const n=nums(sum); if(n.length>=5){ P=n[0]+n[2]; N=n[3]+n[4]; ok=true; } else if(n.length>=3){ P=n[0]+(n.length>3?n[2]:0); N=n.length>3?n[n.length-1]:0; ok=true; } }
  const tl=L.find(l=>/환자\s*부담\s*총액|본인\s*부담\s*총액/.test(l)); if(tl){ const n=nums(tl); if(n.length) tot=n[n.length-1]; }
  if(!ok&&tot){ P=tot; N=0; }
  const nb=L.find(l=>/비\s*급\s*여/.test(l)&&nums(l).length); if(!ok&&nb&&tot){ const n=nums(nb); const v=n[n.length-1]; if(v<tot){ N=v; P=tot-v; } }
  const ds=(flat.match(/20\d{2}[.\-\/년 ]\s*\d{1,2}[.\-\/월 ]\s*\d{1,2}/g)||[]).map(x=>{ const m=x.match(/(20\d{2})\D+(\d{1,2})\D+(\d{1,2})/); return m?`${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`:""; }).filter(Boolean).sort();
  const inpt=/입원/.test(flat)&&/퇴원/.test(flat);
  return {d:ds[0]||accD(),k:isRx?"rx":inpt?"in":"out",sc:SCALE(flat),p:P,n:N,src:ok?"합계 줄":tot?"환자부담 총액":"못 읽음"}; }
function parseDx(t){ const codes=[...new Set((t.toUpperCase().replace(/[Oo](?=\d)/g,"0").match(/\b[A-TV-Z]\d{2}(?:\.\d{1,2})?\b/g)||[]))];
  let days=0; const m=t.replace(/\s+/g,"").match(/(20\d{2})\D(\d{1,2})\D(\d{1,2})\D{0,6}?[~∼-]\D{0,3}(20\d{2})\D(\d{1,2})\D(\d{1,2})/);
  if(m&&/입원/.test(t)){ const a=new Date(+m[1],+m[2]-1,+m[3]), b=new Date(+m[4],+m[5]-1,+m[6]); days=Math.round((b-a)/864e5)+1; if(days<1||days>365) days=0; }
  return {codes,days}; }
function parseProcs(t){ return [...new Set(t.split(/\n/).map(l=>l.replace(/^[\s\dA-Z\-.:*]+/,"").replace(/\s{2,}.*/,"").trim()).filter(l=>l.length>=3&&l.length<=40&&typeof hmPx==="function"&&hmPx(l)))]; }

async function readDocs(){ const E=st(); const groups=Object.entries(S.docs||{}); if(!groups.length){ E.msg="먼저 아래 서류를 올려 주세요."; draw(); return; }
  E.read="run"; E.msg="예상 보험금 계산용으로 서류를 읽는 중입니다 · 기다리지 않고 계속 작성하셔도 됩니다"; draw();
  const bills=[], codes=new Set(); let days=0; const procs=new Set(); let n=0;
  for(const [k,fs] of groups) for(const f of fs){ if(!f.file) continue; n++; E.msg=`예상 보험금 계산용으로 서류를 읽는 중 (${n}장째) · 계속 작성하셔도 됩니다`; drawMsg();
    let t=""; try{ t=await Promise.race([ocrFull(f),new Promise((_,j)=>setTimeout(()=>j(new Error("timeout")),60000))]); }catch(e){ continue; }
    const kk=/^(bill|pharm)$/.test(k)?k:/진료비\s*(계산서|영수증)|약제비/.test(t)?(/약국|약제비/.test(t)?"pharm":"bill"):k;
    if(kk==="bill"||kk==="pharm"){ const b=parseBill(t,kk==="pharm"); if(b.p+b.n>0) bills.push(b); }
    if(/^(dx|adm|outdx|surgdoc|disabdx|detail|etc)$/.test(kk)){ const d=parseDx(t); d.codes.forEach(c=>codes.add(c)); if(d.days>days) days=d.days; }
    if(/^(detail|surgdoc|dx|etc)$/.test(kk)) parseProcs(t).forEach(p=>procs.add(p)); }
  E.read="done"; if(bills.length) E.bills=bills; if(codes.size) E.dx=[...codes].join(", "); if(days) E.inDays=String(days); if(procs.size) E.procs=[...procs].join("\n");
  E.msg=`읽기 끝 · 영수증 ${bills.length}장 · 진단코드 ${codes.size}개 · 수술·처치 ${procs.size}개 — 아래 숫자가 서류와 맞는지 확인하세요 (사진 글자는 틀리게 읽힐 수 있음)`; if(typeof renderStep==="function"&&!S.sent&&!S.sending){ const y=window.scrollY; S.cpKey=""; renderStep(); window.scrollTo(0,y); } else draw(); }

/* ---------- 계산 ---------- */
function estimate(){ const E=st(), I=ins(); if(!I) return null;
  const C=(I.contracts||[]).filter(c=>live(c)&&inForce(c)), out=[];
  /* 실손 */
  const sil=C.filter(c=>c.kind==="실손"), bills=E.bills.filter(b=>num(b.p)+num(b.n)>0);
  if(sil.length&&bills.length&&window.SILSON){ const SS=SILSON.S, keep=JSON.stringify(SS); const res=[];
    sil.forEach(c=>{ const d=ymd(c.start)||""; SS.date=d; SS.life=/생명|라이프/.test(c.company); SS.rows=bills.map(b=>({d:b.d,k:b.k,sc:b.sc,p:String(num(b.p)),n:String(num(b.n)),ds:"",inj:"",mri:"",sev:false}));
      const r=SILSON.calc(); res.push({c,r}); });
    Object.assign(SS,JSON.parse(keep));
    const tot=bills.reduce((a,b)=>a+num(b.p)+num(b.n),0), sumPay=res.reduce((a,x)=>a+(x.r?x.r.sum:0),0);
    res.forEach(({c,r})=>{ if(!r){ out.push({co:c.company,cov:"실손의료비",v:null,why:"가입일이 없어 세대를 알 수 없음 — 실손 계산기에서 확인"}); return; }
      let v=r.sum, why=`${r.G.label} · 병원비 ${won(tot)} 중`; if(res.length>1&&sumPay>tot){ v=Math.round(r.sum*tot/sumPay); why+=` · 실손 ${res.length}곳 중복 → 비례보상`; }
      out.push({co:c.company,cov:"실손의료비 ("+r.G.label+")",v,why}); }); }
  else if(sil.length&&!bills.length) sil.forEach(c=>out.push({co:c.company,cov:"실손의료비",v:null,why:"영수증 금액을 넣으면 계산"}));
  /* 정액 — 숨은보험금 찾기와 같은 판정(HM_MX) */
  const codes=String(E.dx||"").toUpperCase().split(/[,\s]+/).filter(Boolean), days=num(E.inDays), procs=String(E.procs||"").split(/\n/).map(x=>x.trim()).filter(Boolean);
  const type=S.acc.type||"", t=days>0||/입원/.test(type)?"입원":"외래";
  const rows=(codes.length?codes:[/상해|재해/.test(type)?"S00":"R69"]).map((c,i)=>({d:accD(),c,n:"",t,k:i===0?days:0,proc:i===0?procs.join(", "):"",s:false}));
  const fixed=C.filter(c=>c.kind==="정액");
  if(typeof HM_MX!=="undefined") HM_MX.forEach(m=>{ const hit=rows.filter(r=>m.re(hmCode(r.c).replace(".",""),r)); if(!hit.length) return;
    fixed.forEach(ct=>(ct.covers||[]).forEach(v=>{ if(/해지|소멸|만기/.test(v.status||"")) return; const ok=hit.filter(r=>m.cov(v.name,hmCode(r.c).replace(".",""))); if(!ok.length) return;
      if(out.some(x=>x.co===ct.company&&x.cov===v.name)) return; const a=amtWon(v.amount);
      let val=a, why=m.lab;
      if(m.k==="입원"){ if(/간병/.test(v.name)&&!/일당/.test(v.name)){ val=null; why="간병 — 사용 일수·한도 확인"; } else if(days){ val=a*days; why=`입원 ${days}일 × ${man(a)}`+(/(\d+)일이상/.test(v.name)?" (약관의 입원일수 조건 확인)":""); } else { val=null; why="입원일수를 넣으면 계산"; } }
      if(m.k==="수술확인"){ why="수술 해당 여부 확인 (절개·배농·냉동·소작 등 보험사 판단이 갈림) · 인정되면 이 금액"; }
      if(/[1-5]\s*[~-]\s*[1-5]\s*종|종\s*수술/.test(v.name)){ val=null; why=(m.k==="수술확인"?"수술 해당 여부 확인 후 · ":"")+"몇 종인지 회사 수술분류표 확인 필요"+(a?` · 가입금액(최대) ${man(a)}`:""); }
      if(m.k==="암"||m.k==="유사암") why+=" · 최초 1회·감액기간 확인";
      out.push({co:ct.company,cov:v.name,v:val,why,warn:m.k==="수술확인"}); })); });
  const pk=procs.map(p=>({p,k:typeof hmPx==="function"?hmPx(p):""}));
  return {out,C,pk,codes}; }

/* ---------- 화면 ---------- */
function resHTML(){ const E=st(), I=ins(), R=estimate();
  if(!I) return "";
  if(!R||!R.out.length) return `<p class="note" style="margin:4px 0 0">${!docKey()?"서류를 올리면 계산합니다.":R&&R.C.length?"맞는 가입 담보를 찾지 못했습니다.":"사고일에 유지 중인 계약이 없습니다."}</p>`;
  const sel=new Set(S.ins), idOf=co=>typeof insIdByName==="function"?insIdByName(co):null;
  const byCo=new Map(); R.out.forEach(x=>{ const a=byCo.get(x.co)||[]; a.push(x); byCo.set(x.co,a); });
  const tot=R.out.reduce((a,x)=>a+(x.v||0),0);
  return `<div class="tbl-wrap" style="margin-top:8px"><table class="ce-t"><thead><tr><th>보험사</th><th>담보</th><th class="r">예상 금액</th><th class="ce-wd">근거</th></tr></thead><tbody>
    ${[...byCo.entries()].map(([co,L])=>{ const id=idOf(co), on=id&&sel.has(id); return L.map((x,i)=>`<tr${x.warn?' class="w"':""}>${i===0?`<td rowspan="${L.length}"><b>${esc(co)}</b><br>${id?(on?'<span class="pill ok">청구 선택됨</span>':`<button class="btn sm primary" type="button" data-ins="${id}">청구에 넣기</button>`):'<span class="note">보험사 직접 선택</span>'}</td>`:""}<td>${esc(x.cov)}<small class="ce-wm">${esc(x.why)}</small></td><td class="r num">${x.v==null?'<span class="note">확인 필요</span>':won(x.v)}</td><td class="note ce-wd">${esc(x.why)}</td></tr>`).join(""); }).join("")}
    </tbody><tfoot><tr><td colspan="2"><b>금액이 나온 것 합계</b></td><td class="r num"><b>${won(tot)}</b></td><td class="note ce-wd">확인 필요 항목 제외</td></tr></tfoot></table></div>
    ${R.pk.length?`<p class="note" style="margin:6px 0 0">수술·처치 판정 (심평원 진료행위 이름 기준): ${R.pk.map(x=>`${esc(x.p)} → <b>${esc({수술:"수술",확인:"수술 여부 확인",치아:"치아보험 확인",치과처치:"수술비 어려움",제외:"약관상 수술 아님"}[x.k]||"-")}</b>`).join(" · ")}</p>`:""}`; }
function billRows(){ const E=st(); const opt=(v,L)=>L.map(([k,t])=>`<option value="${k}" ${v===k?"selected":""}>${t}</option>`).join("");
  return `<div class="tbl-wrap"><table class="ce-t ce-in"><thead><tr><th>진료일</th><th>구분</th><th>병원 규모</th><th class="r">급여 본인부담</th><th class="r">비급여</th><th></th></tr></thead><tbody>
  ${E.bills.map((b,i)=>`<tr><td><input type="date" data-ceb="${i}:d" value="${esc(b.d)}"></td><td><select data-ceb="${i}:k">${opt(b.k,[["out","외래"],["rx","약국"],["in","입원"]])}</select></td><td><select data-ceb="${i}:sc">${opt(b.sc,[["c","의원"],["h","병원"],["g","종합병원"],["s","상급종합"]])}</select></td>
    <td class="r"><input inputmode="numeric" data-ceb="${i}:p" value="${num(b.p)?num(b.p).toLocaleString():""}" placeholder="0"></td><td class="r"><input inputmode="numeric" data-ceb="${i}:n" value="${num(b.n)?num(b.n).toLocaleString():""}" placeholder="0"></td><td><button class="lnk" type="button" data-cebdel="${i}">빼기</button></td></tr>`).join("")}
  </tbody></table></div><button class="btn sm" type="button" id="ce-badd" style="margin-top:6px">영수증 줄 추가</button>`; }
/* 2026-11-23 대표 지시: 입력 칸·설명 박스는 빼고 예상액 표만. 서류가 올라오면 기기 안에서 자동으로 글자를 읽어 계산 */
const docKey=()=>Object.values(S.docs||{}).flat().map(f=>f.name+":"+((f.file&&f.file.size)||0)).join("|");
function html(){ if(S.cat==="pet"||S.cat==="liab") return "";
  const E=st(), I=ins(); if(!I) return "";
  const k=docKey(); if(k&&E.readKey!==k&&E.read!=="run"){ E.readKey=k; setTimeout(readDocs,0); }
  const run=E.read==="run";
  return `<section class="fsec" id="ce-sec"><h3><i>★</i>예상 보험금 <small class="note" style="font-weight:400">· 여기 나온 보험사를 3번에 자동으로 넣습니다</small></h3>
    ${run?`<p class="note" id="ce-status" style="margin:0 0 6px">${esc(E.msg||"서류 읽는 중…")}</p>`:""}
    <div id="ce-res">${resHTML()}</div>
    <p class="ce-disc">위 금액은 올린 서류와 가입 담보로 계산한 <b>예시 금액</b>입니다. 실제 지급액은 약관과 보험사 심사(면책·감액기간, 보장개시일, 고지 여부, 중복 실손 비례보상 등)에 따라 달라질 수 있으니 참고만 하세요.</p></section>`; }
function draw(){ const s=$("#ce-sec"); if(!s) return; const y=window.scrollY; s.outerHTML=html(); window.scrollTo(0,y); }
function drawMsg(){ const m=$("#ce-status"); if(m) m.textContent=st().msg; }
function drawRes(){ const r=$("#ce-res"); if(r) r.innerHTML=ins()?resHTML():""; }

document.addEventListener("click",e=>{ if(!e.target.closest("#ce-sec")) return;
  if(e.target.closest("#ce-read")){ readDocs(); return; }
  if(e.target.closest("#ce-badd")){ st().bills.push({d:accD(),k:"out",sc:"c",p:0,n:0}); draw(); return; }
  const d=e.target.closest("[data-cebdel]"); if(d){ st().bills.splice(+d.dataset.cebdel,1); draw(); return; } });
document.addEventListener("input",e=>{ const t=e.target; if(!t.closest||!t.closest("#ce-sec")) return; const E=st();
  if(t.dataset.ceb){ const [i,f]=t.dataset.ceb.split(":"); const b=E.bills[+i]; if(!b) return; if(f==="p"||f==="n"){ const v=num(t.value); b[f]=v; t.value=v?v.toLocaleString():""; } else b[f]=t.value; drawRes(); return; }
  if(t.id==="ce-dx") E.dx=t.value; else if(t.id==="ce-days") E.inDays=t.value.replace(/\D/g,""); else if(t.id==="ce-procs") E.procs=t.value; else return; drawRes(); });
document.addEventListener("change",async e=>{ const t=e.target; if(t.dataset&&t.dataset.ceb){ const [i,f]=t.dataset.ceb.split(":"); const b=st().bills[+i]; if(b){ b[f]=t.value; drawRes(); } return; }
  if(t.id!=="ce-pdf"&&t.id!=="cp-pdf") return; const fromCp=t.id==="cp-pdf"; if(fromCp&&window.notify) notify("보장분석 PDF 읽는 중…","wait"); const f=t.files[0]; t.value=""; if(!f) return; const E=st(); E.msg="보장분석 PDF 읽는 중…"; drawMsg();
  try{ const r=await bsReadPdf(f); if(!r.ctrs||!r.ctrs.length) throw new Error("담보 표를 찾지 못했습니다");
    const c=cust();
    if(c&&!ME.demo&&typeof bsSaveToCust==="function"){ bsSaveToCust(c.id,r.ctrs,r.src); E.pdfIns=null; E.msg=`보장분석 계약 ${r.ctrs.length}건을 읽어 ${c.name} 고객관리에 저장했습니다`; }
    else { const isSil=x=>window.isMedSil?isMedSil(x.name):/실손|의료비|실비/.test(x.name), C=[];
      r.ctrs.forEach(o=>{ const st=dg(o.from), sil=o.items.filter(isSil), fl=o.items.filter(x=>!isSil(x)), cv=L=>L.map(x=>({name:x.name,amount:typeof manTxt==="function"?manTxt(x.amt):x.amt}));
        if(sil.length) C.push({kind:"실손",company:o.co,product:o.prod||"",status:"정상",start:st,covers:cv(sil)}); if(fl.length) C.push({kind:"정액",company:o.co,product:o.prod||"",status:"정상",start:st,covers:cv(fl)}); });
      E.pdfIns={contracts:C,from:r.src}; E.msg=`보장분석 계약 ${r.ctrs.length}건을 읽었습니다 (이 청구에만 사용${c?"":" — 고객을 내 고객에서 고르면 저장됩니다"})`; } }
  catch(err){ E.msg="보장분석을 읽지 못했습니다: "+(err.message||err); } if(fromCp&&window.notify) notify(E.msg,/못/.test(E.msg)?"warn":"ok"); if(fromCp&&typeof renderStep==="function"){ const y=window.scrollY; renderStep(); window.scrollTo(0,y); } else draw(); });
{ const c=document.createElement("style"); c.textContent=".ce-disc{margin:8px 0 0;padding:8px 10px;border-radius:8px;background:#FFF7ED;color:#9A3412;font-size:12px;line-height:1.55}"; document.head.appendChild(c); }
window.CE={html,estimate,ins:()=>ins(),live,inForce};
})();
