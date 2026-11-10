/* 보잇 · 보상청구 › 실손 계산기 (2026-11-10)
   가입일로 실손 세대를 나누고, 진료비 영수증 금액(급여 본인부담금·비급여)을 넣으면 대략의 보상액을 계산한다.
   근거:
   - 실손 세대별 변천표(대표 제공 정리표): 세대 구분, 보장비율, 통원 공제, 약제 공제, 본인부담 연 200만 한도, 통원 한도
   - 실손의료보험 길라잡이(금융감독원, 2015년판): 표준형 80%·선택형 90%, 통원 병원규모별 공제(의원 1만·병원 1.5만·종합 2만), 처방 8천원
   - 3세대(2017.4~2021.6): 금융위원회 2016.12 실손 개선방안 — 도수·체외충격파·증식 / 비급여주사 / MRI 특약 분리, 자기부담 30%,
     도수 연 350만·50회, 주사 연 250만·50회, MRI 연 300만. 통원 2만원과 30% 중 큰 금액(DB손보 교육자료 2023)
   - 4세대(2021.7~2026.5.5): 급여 20%, 비급여 30%, 통원 급여 max(1만·2만, 20%), 비급여·3대비급여 max(3만, 30%), 통원 회당 급여·비급여 각 20만
   - 5세대(2026.5.6~): 금융위원회 보도자료 2026.5.6 — 급여 통원 Max[건보 본인부담률, 20%, 1·2만], 특약1(중증) 입원 30%·통원 Max[30%,3만],
     특약2(비중증) 입원 50%·통원 Max[50%,5만]·통원 일당 20만·병의원 입원 회당 300만·연 1천만, 특약2에서 도수 등 근골격계 물리치료·체외충격파·비급여주사 제외
   상담용 대략 계산. 실제 보험금은 가입 상품의 약관·보험사 심사로 정해진다. */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const won=n=>Math.round(n).toLocaleString()+"원";
const num=v=>{ const n=Number(String(v==null?"":v).replace(/[^\d.]/g,"")); return isFinite(n)?n:0; };
const SCALE=[["c","의원"],["h","병원"],["g","종합병원"],["s","상급종합"]];
const KIND=[["out","외래"],["rx","약국(처방)"],["in","입원"]];

const S={ date:"", sub:"std", life:false, g1day:30, outLim:25, rxLim:5, sp3:true, t1:true, t2:true,
  rows:[{d:"",k:"out",sc:"c",p:"",n:"",ds:"",inj:"",mri:"",sev:false}] };

function gen(d){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  if(d<"2009-10-01") return {g:1,label:"1세대",per:"~2009.9 (표준화 이전)"};
  if(d<"2013-04-01") return {g:2,v:"a",label:"2세대",per:"2009.10~2013.3 (표준화)"};
  if(d<"2015-09-01") return {g:2,v:"b",label:"2세대",per:"2013.4~2015.8 (표준형·선택형)"};
  if(d<"2017-04-01") return {g:2,v:"c",label:"2세대",per:"2015.9~2017.3"};
  if(d<"2021-07-01") return {g:3,label:"3세대",per:"2017.4~2021.6 (착한실손)"};
  if(d<"2026-05-06") return {g:4,label:"4세대",per:"2021.7~2026.5.5"};
  return {g:5,label:"5세대",per:"2026.5.6~"};
}
const fix23=sc=>sc==="c"?10000:sc==="h"?15000:20000;   /* 2·3세대 통원 공제 */
const fix45=sc=>sc==="c"||sc==="h"?10000:20000;           /* 4·5세대 급여 통원 공제 */
const KBR={c:.3,h:.4,g:.5,s:.6};                          /* 건강보험 외래 본인부담률(5세대 연동) */

function calc(){
  const G=gen(S.date); if(!G) return null;
  const out=[]; let selfIn=0; const capSelf=2000000; const used={ds:0,inj:0,mri:0,t2:0};
  const LIM3={ds:3500000,inj:2500000,mri:3000000};
  const rows=S.rows.map((r,i)=>({i,k:r.k,sc:r.sc,d:r.d,P:num(r.p),N:num(r.n),ds:num(r.ds),inj:num(r.inj),mri:num(r.mri),sev:!!r.sev}))
    .filter(r=>r.P+r.N>0);
  rows.forEach(r=>{ const s3=Math.min(r.N,r.ds+r.inj+r.mri); r.s3=s3; r.Nb=r.N-s3; });
  /* 1·4·5세대: 같은 날 외래+약국은 1회로 합쳐 공제·한도 적용 */
  const groupVisit=G.g===1||G.g>=4;
  const visits=[];
  if(groupVisit){
    const map={};
    rows.forEach(r=>{ if(r.k==="in"){ visits.push({rows:[r],k:"in",sc:r.sc}); return; }
      const key=r.d?("d"+r.d):("x"+r.i); if(!map[key]){ map[key]={rows:[],k:"out",sc:r.sc}; visits.push(map[key]); }
      map[key].rows.push(r); if(r.k==="out") map[key].sc=r.sc; });
  } else rows.forEach(r=>visits.push({rows:[r],k:r.k==="in"?"in":r.k,sc:r.sc}));

  visits.forEach(v=>{
    const P=v.rows.reduce((a,r)=>a+r.P,0), N=v.rows.reduce((a,r)=>a+r.N,0);
    const ds=v.rows.reduce((a,r)=>a+Math.min(r.ds,r.N),0), inj=v.rows.reduce((a,r)=>a+Math.min(r.inj,r.N),0), mri=v.rows.reduce((a,r)=>a+Math.min(r.mri,r.N),0);
    const s3=Math.min(N,ds+inj+mri), Nb=N-s3, sev=v.rows.some(r=>r.sev);
    const isIn=v.k==="in", isRx=v.k==="rx";
    let pay=0, ded=0; const memo=[];
    const tot=P+N;
    if(G.g===1){
      if(S.life){ /* 생보 1세대: 80% */
        if(isIn){ pay=tot*.8; ded=tot-pay; memo.push("생보 1세대 80% 보상(상품별 차이)"); }
        else { const b=Math.max(0,tot-5000); pay=Math.min(b*.8,S.g1day*1e4); ded=tot-pay; memo.push("통원 5천원 공제 후 80%·1일 한도(상품별 차이)"); }
      } else {
        if(isIn){ pay=tot; memo.push("손보 1세대 입원 100%"); }
        else { const b=Math.max(0,tot-5000); pay=Math.min(b,S.g1day*1e4); ded=tot-pay; memo.push("통원 5천원 공제 · 1일 한도 "+S.g1day+"만원"); }
      }
    } else if(G.g===2||G.g===3){
      const sel=S.sub==="sel";
      const base3=G.g===3; /* 3세대는 3대 비급여를 기본형에서 빼고 특약으로 계산 */
      const bP=P, bN=base3?Nb:N;
      if(isIn){
        let self;
        if(G.v==="a") self=(bP+bN)*.1;
        else if(G.v==="b") self=(bP+bN)*(sel?.1:.2);
        else self=sel?(bP*.1+bN*.2):(bP+bN)*.2;
        const room=Math.max(0,capSelf-selfIn), s=Math.min(self,room); selfIn+=s;
        pay=bP+bN-s; ded=s; if(self>s) memo.push("입원 자기부담 연 200만원 한도 적용");
      } else {
        const fx=isRx?8000:fix23(v.sc), lim=(isRx?S.rxLim:S.outLim)*1e4;
        let d;
        if(G.v==="a") d=fx;
        else if(G.v==="b") d=sel?fx:Math.max(fx,(bP+bN)*.2);
        else d=sel?Math.max(fx,bP*.1+bN*.2):Math.max(fx,(bP+bN)*.2);
        const p0=Math.max(0,bP+bN-d); pay=Math.min(p0,lim); ded=bP+bN-pay;
        memo.push((isRx?"처방":"외래")+" 공제 "+won(Math.min(d,bP+bN))+(p0>lim?" · 1회 한도 "+(lim/1e4)+"만원":""));
      }
      if(base3&&s3>0){
        if(!S.sp3){ ded+=s3; memo.push("3대 비급여(도수·주사·MRI) 특약 미가입 → 보상 없음"); }
        else {
          [["ds",ds,"도수·체외충격파·증식"],["inj",inj,"비급여주사"],["mri",mri,"MRI/MRA"]].forEach(([key,a,lb])=>{ if(!a) return;
            let p=isIn?a*.7:Math.max(0,a-Math.max(20000,a*.3));
            const room=Math.max(0,LIM3[key]-used[key]); if(p>room){ p=room; memo.push(lb+" 연간 한도 도달"); }
            used[key]+=p; pay+=p; ded+=a-p; });
          memo.push("3대 비급여 특약: 자기부담 30%"+(isIn?"":"(통원 2만원과 30% 중 큰 금액)"));
        }
      }
    } else if(G.g===4){
      /* 급여 */
      if(P>0){
        if(isIn){ const self=P*.2, room=Math.max(0,capSelf-selfIn), s=Math.min(self,room); selfIn+=s; pay+=P-s; ded+=s; }
        else { const d=Math.max(fix45(v.sc),P*.2), p=Math.min(Math.max(0,P-d),200000); pay+=p; ded+=P-p; }
      }
      /* 비급여(3대 제외) */
      if(Nb>0){
        if(!S.t2){ ded+=Nb; memo.push("비급여 특약 미가입 → 비급여 보상 없음"); }
        else if(isIn){ pay+=Nb*.7; ded+=Nb*.3; }
        else { const p=Math.min(Math.max(0,Nb-Math.max(30000,Nb*.3)),200000); pay+=p; ded+=Nb-p; }
      }
      if(s3>0){
        if(!S.t2){ ded+=s3; }
        else [["ds",ds,"도수·체외충격파·증식"],["inj",inj,"비급여주사"],["mri",mri,"MRI/MRA"]].forEach(([key,a,lb])=>{ if(!a) return;
          let p=isIn?a*.7:Math.max(0,a-Math.max(30000,a*.3));
          const room=Math.max(0,LIM3[key]-used[key]); if(p>room){ p=room; memo.push(lb+" 연간 한도 도달"); }
          used[key]+=p; pay+=p; ded+=a-p; });
      }
      memo.push(isIn?"급여 20% · 비급여 30%":"급여 max(1·2만, 20%) · 비급여 max(3만, 30%)");
    } else {
      /* 5세대 급여 */
      if(P>0){
        if(isIn){ pay+=P*.8; ded+=P*.2; }
        else { const r=isRx?.3:KBR[v.sc]||.3, d=Math.max(P*Math.max(r,.2),fix45(v.sc)), p=Math.min(Math.max(0,P-d),200000); pay+=p; ded+=P-p;
          memo.push("급여 통원 자기부담 "+Math.round(Math.max(r,.2)*100)+"%(건보 본인부담률 연동)"); }
      }
      if(N>0){
        if(sev){
          if(!S.t1){ ded+=N; memo.push("특약1(중증) 미가입 → 비급여 보상 없음"); }
          else if(isIn){ pay+=N*.7; ded+=N*.3; memo.push("특약1(중증) 30%"); }
          else { const p=Math.max(0,N-Math.max(30000,N*.3)); pay+=p; ded+=N-p; memo.push("특약1(중증) max(3만, 30%)"); }
        } else {
          const ex=ds+inj, ok=N-ex;
          if(ex>0){ ded+=ex; memo.push("도수·체외충격파·비급여주사는 특약2 제외"); }
          if(ok>0){
            if(!S.t2){ ded+=ok; memo.push("특약2(비중증) 미가입 → 비급여 보상 없음"); }
            else {
              let p;
              if(isIn){ p=ok*.5; if(v.sc==="c"||v.sc==="h"){ if(p>3000000){ p=3000000; memo.push("병·의원 입원 회당 300만원 한도"); } } }
              else { p=Math.min(Math.max(0,ok-Math.max(50000,ok*.5)),200000); }
              const room=Math.max(0,10000000-used.t2); if(p>room){ p=room; memo.push("특약2 연 1천만원 한도 도달"); }
              used.t2+=p; pay+=p; ded+=ok-p; memo.push(isIn?"특약2(비중증) 50%":"특약2(비중증) max(5만, 50%)");
            }
          }
        }
      }
    }
    pay=Math.max(0,Math.round(pay));
    out.push({v,P,N,tot,pay,ded:Math.max(0,tot-pay),memo});
  });
  return {G,out,sum:out.reduce((a,x)=>a+x.pay,0),tot:out.reduce((a,x)=>a+x.tot,0)};
}

function optsHTML(G){
  if(!G) return `<p class="sl-hint">가입일을 8자리로 입력하면 세대가 자동으로 정해집니다. (예: 20190315)</p>`;
  const ck=(id,on,l)=>`<label class="sl-ck"><input type="checkbox" id="${id}" ${on?"checked":""}> ${l}</label>`;
  let h="";
  if(G.g===1) h=`<div class="sl-seg"><button type="button" data-slife="0" aria-pressed="${!S.life}">손해보험</button><button type="button" data-slife="1" aria-pressed="${S.life}">생명보험</button></div>
    <div class="field"><label for="sl-g1day">통원 1일 한도 (만원)</label><input id="sl-g1day" inputmode="numeric" value="${S.g1day}"></div>`;
  if(G.g===2||G.g===3){
    if(G.v!=="a") h+=`<div class="sl-seg"><button type="button" data-ssub="std" aria-pressed="${S.sub==="std"}">표준형 (자기부담 20%)</button><button type="button" data-ssub="sel" aria-pressed="${S.sub==="sel"}">선택형 (${G.v==="b"?"10%":"급여 10%·비급여 20%"})</button></div>`;
    h+=`<div class="field"><label for="sl-outlim">외래 1회 한도 (만원)</label><input id="sl-outlim" inputmode="numeric" value="${S.outLim}"></div>
      <div class="field"><label for="sl-rxlim">처방 1건 한도 (만원)</label><input id="sl-rxlim" inputmode="numeric" value="${S.rxLim}"></div>`;
    if(G.g===3) h+=ck("sl-sp3",S.sp3,"3대 비급여 특약 가입 (도수·주사·MRI)");
  }
  if(G.g===4) h+=ck("sl-t2",S.t2,"비급여 특약 가입");
  if(G.g===5) h+=ck("sl-t1",S.t1,"특약1 (중증 비급여) 가입")+ck("sl-t2",S.t2,"특약2 (비중증 비급여) 가입");
  return `<div class="sl-opts">${h}</div>`;
}

function rowHTML(r,i,G){
  const sel=(cls,arr,v)=>`<select data-sr="${i}" data-f="${cls}">${arr.map(([k,l])=>`<option value="${k}" ${v===k?"selected":""}>${l}</option>`).join("")}</select>`;
  const inp=(f,v,ph)=>`<input data-sr="${i}" data-f="${f}" inputmode="numeric" value="${v?Number(v).toLocaleString():""}" placeholder="${ph}">`;
  return `<tr>
    <td data-l="진료일"><input data-sr="${i}" data-f="d" type="date" value="${esc(r.d)}"></td>
    <td data-l="구분">${sel("k",KIND,r.k)}</td><td data-l="병원 규모">${sel("sc",SCALE,r.sc)}</td>
    <td data-l="급여 본인부담금">${inp("p",r.p,"0")}</td><td data-l="비급여 합계">${inp("n",r.n,"0")}</td>
    <td data-l="그중 도수·체외충격파">${inp("ds",r.ds,"0")}</td><td data-l="그중 비급여주사">${inp("inj",r.inj,"0")}</td><td data-l="그중 MRI/MRA">${inp("mri",r.mri,"0")}</td>
    ${G&&G.g===5?`<td data-l="중증(산정특례)" style="text-align:center"><input type="checkbox" data-sr="${i}" data-f="sev" ${r.sev?"checked":""} title="중증(산정특례 대상) 질환"></td>`:""}
    <td><button type="button" class="sl-x" data-srdel="${i}" aria-label="삭제">✕</button></td></tr>`;
}

function shell(){
  const R=$("#sl-root"); if(!R) return;
  const G=gen(S.date);
  R.innerHTML=`
  <div class="panel sl-top">
    <div class="field"><label for="sl-date">실손 가입일</label><input id="sl-date" type="date" value="${esc(S.date)}"></div>
    <div class="sl-gen">${G?`<b>${G.label}</b><span>${G.per}</span>`:`<b>세대 미정</b><span>가입일 입력</span>`}</div>
    ${optsHTML(G)}
  </div>
  <div class="panel" style="margin-top:14px">
    <div class="row between"><h2>진료비 영수증</h2><button class="btn" type="button" id="sl-add">+ 영수증 추가</button></div>
    <p class="sl-hint">영수증의 <b>급여 본인부담금</b>과 <b>비급여</b> 합계를 원 단위로 넣으세요. 비급여 중 도수치료·주사·MRI는 오른쪽 칸에 따로 적습니다.${G&&(G.g===1||G.g>=4)?" 같은 날 외래와 약국은 1회 진료로 합쳐 계산합니다.":""}</p>
    <div class="tbl-wrap"><table class="sl-tbl"><thead><tr><th>진료일</th><th>구분</th><th>병원 규모</th><th>급여<br>본인부담금</th><th>비급여<br>합계</th><th>그중 도수·<br>체외충격파</th><th>그중<br>비급여주사</th><th>그중<br>MRI/MRA</th>${G&&G.g===5?"<th>중증<br>(산정특례)</th>":""}<th></th></tr></thead>
    <tbody id="sl-rows">${S.rows.map((r,i)=>rowHTML(r,i,G)).join("")}</tbody></table></div>
  </div>
  <div id="sl-res" style="margin-top:14px"></div>`;
  result();
}

function result(){
  const B=$("#sl-res"); if(!B) return; const C=calc();
  if(!C){ B.innerHTML=""; return; }
  if(!C.out.length){ B.innerHTML=`<div class="panel"><p class="sl-hint" style="margin:0">영수증 금액을 넣으면 예상 보상액이 나옵니다.</p></div>`; return; }
  const kl=v=>v.k==="in"?"입원":v.rows.length>1?"외래+약국":v.k==="rx"?"약국":"외래";
  B.innerHTML=`<div class="sl-sum"><div><span>청구 대상 진료비</span><b>${won(C.tot)}</b></div><div class="hi"><span>예상 보상액 (${C.G.label})</span><b>${won(C.sum)}</b></div><div><span>본인 부담(공제·미보상)</span><b>${won(C.tot-C.sum)}</b></div></div>
  <div class="panel" style="margin-top:14px"><div class="row between"><h2>영수증별 계산</h2><button class="btn" type="button" id="sl-copy">결과 복사</button></div>
  <div class="tbl-wrap" style="margin-top:8px"><table class="sl-tbl"><thead><tr><th>진료일</th><th>구분</th><th>진료비</th><th>예상 보상</th><th>계산 기준</th></tr></thead><tbody>
  ${C.out.map(o=>`<tr><td data-l="진료일">${esc(o.v.rows[0].d||"-")}</td><td data-l="구분">${kl(o.v)}</td><td data-l="진료비" class="r">${won(o.tot)}</td><td data-l="예상 보상" class="r"><b>${won(o.pay)}</b></td><td data-l="계산 기준" class="m" style="grid-column:1/-1">${o.memo.map(esc).join("<br>")}</td></tr>`).join("")}
  </tbody></table></div>
  <p class="sl-note">상담용 대략 계산입니다. 실제 보험금은 가입 상품의 약관·보험사 심사로 정해집니다. 반영하지 않은 것: 질병·상해 구분 한도, 연간 통원 횟수(3대 비급여 50회 등), 상급병실료 차액, 다른 실손과의 비례보상, 면책기간, 보상하지 않는 사항(미용·건강검진 등).${C.G.g===1?" 1세대는 회사·상품마다 보장비율·한도가 달라 증권 확인이 꼭 필요합니다.":""}${C.G.g===5?" 5세대 급여 통원 자기부담은 금융위원회 발표(건보 본인부담률 연동) 기준으로 계산했습니다.":""}</p></div>`;
}

function copyText(){
  const C=calc(); if(!C) return "";
  return `[실손 예상 보상액 · ${C.G.label} ${C.G.per}]\n`+C.out.map(o=>`${o.v.rows[0].d||"-"} 진료비 ${won(o.tot)} → 예상 ${won(o.pay)}`).join("\n")+`\n합계: 진료비 ${won(C.tot)} / 예상 보상 ${won(C.sum)}\n※ 대략 계산이며 실제 보험금은 약관·보험사 심사로 정해집니다.`;
}

const CSS=`
.sl-top{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end}
.sl-top>.field{min-width:180px}
.sl-gen{display:flex;flex-direction:column;justify-content:center;padding:8px 16px;border-radius:10px;background:color-mix(in srgb,var(--c4) 14%,var(--surface));border:1px solid color-mix(in srgb,var(--c4) 40%,transparent);min-width:160px}
.sl-gen b{font-size:20px;color:var(--c4)}.sl-gen span{font-size:12.5px;color:var(--muted)}
.sl-opts{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;flex:1 1 100%}
.sl-opts .field{width:150px}
.sl-seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.sl-seg button{border:0;background:var(--surface);color:var(--fg);padding:9px 14px;font:inherit;cursor:pointer}
.sl-seg button[aria-pressed="true"]{background:var(--c4);color:#fff;font-weight:700}
.sl-ck{display:inline-flex;gap:6px;align-items:center;padding:9px 12px;border:1px solid var(--line);border-radius:10px;cursor:pointer}
.sl-hint{font-size:13px;color:var(--muted);margin:6px 0 10px}
.sl-tbl{width:100%;border-collapse:collapse}
.sl-tbl th{font-size:12px;white-space:nowrap;text-align:left;padding:6px;color:var(--muted)}
.sl-tbl td{padding:4px 6px;vertical-align:middle;font-size:13.5px}
.sl-tbl input:not([type=checkbox]),.sl-tbl select{width:100%;min-width:84px;box-sizing:border-box;padding:7px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--fg);font:inherit;text-align:right}
.sl-tbl select,.sl-tbl input[type=date]{text-align:left}
.sl-tbl td.r{text-align:right;white-space:nowrap}.sl-tbl td.m{font-size:12.5px;color:var(--muted)}
.sl-x{border:0;background:none;color:var(--muted);cursor:pointer;font-size:14px}
.sl-sum{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.sl-sum>div{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:16px}
.sl-sum span{display:block;font-size:12.5px;color:var(--muted)}.sl-sum b{font-size:22px}
.sl-sum .hi{border-color:var(--c4);background:color-mix(in srgb,var(--c4) 10%,var(--surface))}.sl-sum .hi b{color:var(--c4);font-size:26px}
.sl-note{font-size:12.5px;color:var(--muted);margin:12px 0 0;line-height:1.6}
@media(max-width:720px){.sl-sum{grid-template-columns:1fr}.sl-tbl thead{display:none}.sl-tbl,.sl-tbl tbody{display:block;width:100%;min-width:0}.sl-tbl td{min-width:0;display:block}.sl-tbl input:not([type=checkbox]),.sl-tbl select{min-width:0}.sl-tbl tr{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px;padding:10px 0;border-bottom:1px solid var(--line)}.sl-tbl td[data-l]::before{content:attr(data-l);display:block;font-size:11.5px;color:var(--muted);margin-bottom:3px;text-align:left}.sl-tbl td.r{text-align:left}}
`;
const st=document.createElement("style"); st.textContent=CSS; document.head.appendChild(st);

const val=id=>{ const n=document.getElementById(id); return n?n.value:""; };
document.addEventListener("click",e=>{
  if(!e.target.closest("#sl-root")) return;
  const a=e.target.closest("[data-slife]"); if(a){ S.life=a.dataset.slife==="1"; shell(); return; }
  const b=e.target.closest("[data-ssub]"); if(b){ S.sub=b.dataset.ssub; shell(); return; }
  if(e.target.closest("#sl-add")){ const last=S.rows[S.rows.length-1]||{}; S.rows.push({d:last.d||"",k:"out",sc:last.sc||"c",p:"",n:"",ds:"",inj:"",mri:"",sev:false}); shell(); return; }
  const d=e.target.closest("[data-srdel]"); if(d){ S.rows.splice(+d.dataset.srdel,1); if(!S.rows.length) S.rows.push({d:"",k:"out",sc:"c",p:"",n:"",ds:"",inj:"",mri:"",sev:false}); shell(); return; }
  if(e.target.closest("#sl-copy")){ const t=copyText(); const btn=e.target.closest("#sl-copy");
    (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>{ btn.textContent="복사됨"; setTimeout(()=>btn.textContent="결과 복사",1500); }).catch(()=>{ window.prompt("복사하세요",t); }); }
});
function onEdit(e){
  const t=e.target; if(!t.closest||!t.closest("#sl-root")) return;
  if(t.id==="sl-date"){ const v=t.value; if(/^\d{4}-\d{2}-\d{2}$/.test(v)&&v!==S.date){ S.date=v; shell(); } return; }
  if(t.id==="sl-g1day"){ S.g1day=num(t.value)||30; result(); return; }
  if(t.id==="sl-outlim"){ S.outLim=num(t.value)||25; result(); return; }
  if(t.id==="sl-rxlim"){ S.rxLim=num(t.value)||5; result(); return; }
  if(t.id==="sl-sp3"){ S.sp3=t.checked; result(); return; }
  if(t.id==="sl-t1"){ S.t1=t.checked; result(); return; }
  if(t.id==="sl-t2"){ S.t2=t.checked; result(); return; }
  if(t.dataset&&t.dataset.sr!=null){ const r=S.rows[+t.dataset.sr]; if(!r) return; const f=t.dataset.f;
    if(f==="sev") r.sev=t.checked;
    else if(f==="k"||f==="sc"||f==="d") r[f]=t.value;
    else { const raw=t.value.replace(/[^\d]/g,""); r[f]=raw; t.value=raw?Number(raw).toLocaleString():""; }
    result(); }
}
document.addEventListener("input",onEdit); document.addEventListener("change",onEdit);

window.SILSON={init:shell,calc,S,gen};
if(document.readyState!=="loading") shell(); else document.addEventListener("DOMContentLoaded",shell);
})();
