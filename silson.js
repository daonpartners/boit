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
   - 노후실손: 삼성화재 노후실손의료비보험 약관(2026.7) — 입원 30만·통원 3만 우선공제(비급여에서 먼저) 후 급여 20%·비급여 30%,
     통원 회(건)당 100만, 연 1억 이내, 입원 본인부담 연 500만 초과분 보상, 상급병실료 차액보장B 특약 50%·1일 평균 10만·연 2천만 이내
     (금융위원회 보도참고 2014.6.18: 노후실손 2014.8 출시)
   - 유병력자 실손: 금융위원회 2018.1.16·3.30 보도자료 + 삼성화재 다이렉트 유병력자 실손 약관 — 입원 Max(10만, 30%), 통원 Max(2만, 30%),
     통원 회당 20만·연 180회, 입원 5천만 이내, 처방조제비·도수·체외충격파·증식·비급여주사(항암제 등 제외)·MRI 보상 안 함
   - 상급병실료 차액(2009.10 표준화 이후 2~4세대·유병력자): 비급여 병실료의 50%, 1일 평균 10만원 한도(차액 전체 ÷ 총 입원일수).
     1세대·5세대는 확인된 기준이 없어 계산에서 뺌
   상담용 대략 계산. 실제 보험금은 가입 상품의 약관·보험사 심사로 정해진다. */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const won=n=>Math.round(n).toLocaleString()+"원";
const num=v=>{ const n=Number(String(v==null?"":v).replace(/[^\d.]/g,"")); return isFinite(n)?n:0; };
const SCALE=[["c","의원"],["h","병원"],["g","종합병원"],["s","상급종합"]];
const KIND=[["out","외래"],["rx","약국(처방)"],["in","입원"]];

const S={ mode:"calc", pc:"", pn:"", dr:"", dm:"", n1:true, n2:true, prod:"gen", nhRoom:true, date:"", sub:"std", life:false, g1day:30, outLim:25, rxLim:5, sp3:true, t1:true, t2:true,
  rows:[{d:"",k:"out",sc:"c",p:"",n:"",ds:"",inj:"",mri:"",rm:"",dy:"",cnt:"",sev:false}] };
const EMPTY=()=>({d:"",k:"out",sc:"c",p:"",n:"",ds:"",inj:"",mri:"",rm:"",dy:"",cnt:"",sev:false});

function gen(d){
  if(S.prod==="old") return {g:"old",label:"노후실손",per:"2014.8~ · 현행 약관 기준"};
  if(S.prod==="sick") return {g:"sick",label:"유병력자 실손",per:"2018.4~ · 현행 약관 기준"};
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
const KBR={c:.3,h:.4,g:.5,s:.6};
/* 금융위원회 보도자료 「5월 6일부터 … 5세대 실손의료보험이 새롭게 출시·판매됩니다」(2026.5.6) 표 정리 */
const FSC_HTML=`<div class="panel"><div class="row between"><h2>5세대 실손 기준 (금융위원회 발표)</h2><a class="btn" href="https://www.fsc.go.kr/no010101/86831" target="_blank" rel="noopener">원문 보기</a></div>
<p class="sl-hint">금융위원회 보도자료 2026.5.6 · 급여는 중증·비중증 구분 없음, 비급여만 특약1(중증)·특약2(비중증)로 나뉨</p>
<div class="tbl-wrap"><table class="sl-fsc"><thead><tr><th>급여</th><th>현행(4세대)</th><th>5세대</th></tr></thead><tbody>
<tr><td>입원</td><td>20%</td><td>20% (현행 유지)</td></tr>
<tr><td>통원(외래)</td><td>Max[20%, 1·2만원]</td><td>Max[건강보험 본인부담률, 20%, 1·2만원]<br>최소 자기부담: 병·의원+약국 1만원, 종합·상급종합+약국 2만원</td></tr>
<tr><td>신규 보장</td><td>-</td><td>임신·출산, 발달장애 급여 의료비</td></tr></tbody></table></div>
<div class="tbl-wrap" style="margin-top:10px"><table class="sl-fsc"><thead><tr><th>비급여</th><th>특약1 (중증)</th><th>특약2 (비중증)</th></tr></thead><tbody>
<tr><td>대상</td><td>산정특례 질환(암·뇌혈관·심장질환·희귀난치성질환 등)과 명확한 인과관계가 있는 합병증 치료</td><td>특약1 외 비급여 치료</td></tr>
<tr><td>보상한도</td><td>연간 5천만원 (현행 유지)</td><td>연간 1천만원, 통원 일당 20만원, 입원(병·의원) 회당 300만원</td></tr>
<tr><td>입원 자기부담</td><td>30% (현행 유지)</td><td>50%</td></tr>
<tr><td>통원 자기부담</td><td>Max[30%, 3만원] (현행 유지)</td><td>Max[50%, 5만원]</td></tr>
<tr><td>연간 자기부담 상한</td><td>상급종합·종합병원 입원 연 500만원 (초과분 보장)</td><td>없음</td></tr>
<tr><td>보상 제외</td><td>미용·성형 등</td><td>미용·성형 등, 미등재 신의료기술, 근골격계 물리치료·체외충격파·비급여 주사제 등</td></tr>
<tr><td>할인·할증</td><td>적용 제외</td><td>적용</td></tr></tbody></table></div>
<p class="sl-hint" style="margin-top:8px">두 특약 모두 건강보험 재평가 'D등급(권고하지 않음)' 치료는 보장 제외 · 비급여 특약은 골라서 가입 가능</p></div>`;                          /* 건강보험 외래 본인부담률(5세대 연동) */

function calc(){
  const G=gen(S.date); if(!G) return null;
  const out=[]; let selfIn=0; const capSelf=G.g==="old"?5000000:2000000; const used={ds:0,inj:0,mri:0,t2:0,t1:0,sevSelf:0,old:0,sickIn:0,room:0};
  const LIM3={ds:3500000,inj:2500000,mri:3000000};
  const rows=[];
  S.rows.forEach((r,i)=>{ const N0=num(r.n), rm=r.k==="in"?Math.min(num(r.rm),N0):0, n=Math.max(1,Math.min(366,num(r.cnt)||1));
      const o={i,k:r.k,sc:r.sc,d:r.d,dz:num(r.dz)||1,P:num(r.p),N:N0-rm,rm,dy:r.k==="in"?num(r.dy):0,ds:num(r.ds),inj:num(r.inj),mri:num(r.mri),sev:!!r.sev};
      if(o.P+o.N+o.rm<=0) return;
      for(let k=0;k<n;k++) rows.push(Object.assign({},o,{rep:k})); });
  rows.forEach(r=>{ const s3=Math.min(r.N,r.ds+r.inj+r.mri); r.s3=s3; r.Nb=r.N-s3; });
  /* 같은 날·같은 질병(상해) 통원 묶기 — 약관 조항
     4세대(2021.7~): 같은 의료기관 같은 날 외래+처방은 통원 1회(처방일자 기준), 하루에 같은 치료 목적으로 2회 이상 통원(외래·처방 합산)은 1회 통원,
       공제금액은 중복방문 의료기관 중 가장 높은 금액 (예: 롯데손보 let:care 실손Ⅳ(2209), 에이비엘생명 급여실손 약관). 5세대도 같은 방식으로 계산(5세대 약관 원문 확인 전)
     2·3세대: 하루에 같은 치료 목적으로 의료기관 2회 이상 통원 → 1회의 외래, 약국 2회 이상 처방 → 1건의 처방(외래·처방은 따로),
       공제금액은 중복방문 의료기관 중 가장 높은 금액 (예: 삼성화재 실손의료비보험(2101.6), DB손보 프로미라이프 실손(2101))
     1세대: 통원 1일 기준으로 묶음(상품별 차이). 노후·유병력자: 조항 확인 전이라 영수증마다 따로 계산 */
  const RANK={c:1,h:2,g:3,s:4};
  const mode=(G.g===1||G.g===4||G.g===5)?"all":(G.g===2||G.g===3)?"sep":"none";
  const visits=[];
  if(mode!=="none"){
    const map={};
    rows.forEach(r=>{ if(r.k==="in"||!r.d){ visits.push({rows:[r],k:r.k,sc:r.sc}); return; }
      const kk=mode==="all"?"o":(r.k==="rx"?"rx":"out");
      const key=r.d+"#"+r.rep+"#"+(r.dz||1)+"#"+kk;
      if(!map[key]){ map[key]={rows:[],k:kk==="o"?"out":kk,sc:r.sc}; visits.push(map[key]); }
      const m=map[key]; m.rows.push(r);
      if(mode==="all"&&r.k==="out"&&!m.hasOut){ m.sc=r.sc; m.hasOut=true; }
      else if((mode!=="all"||r.k==="out")&&RANK[r.sc]>RANK[m.sc]) m.sc=r.sc;
      if(mode==="all"&&m.rows.length===1&&r.k==="rx") m.k="rx"; else if(mode==="all") m.k=m.rows.some(x=>x.k==="out")?"out":"rx";
    });
  } else rows.forEach(r=>visits.push({rows:[r],k:r.k,sc:r.sc}));

  visits.forEach(v=>{
    const P=v.rows.reduce((a,r)=>a+r.P,0), N=v.rows.reduce((a,r)=>a+r.N,0);
    const ds=v.rows.reduce((a,r)=>a+Math.min(r.ds,r.N),0), inj=v.rows.reduce((a,r)=>a+Math.min(r.inj,r.N),0), mri=v.rows.reduce((a,r)=>a+Math.min(r.mri,r.N),0);
    const s3=Math.min(N,ds+inj+mri), Nb=N-s3, sev=v.rows.some(r=>r.sev);
    const isIn=v.k==="in", isRx=v.k==="rx";
    let pay=0, ded=0; const memo=[];
    const rm=v.rows.reduce((a,r)=>a+r.rm,0), dy=v.rows.reduce((a,r)=>a+r.dy,0);
    const tot=P+N+rm;
    if(G.g==="old"){
      if(isIn){
        const d0=300000, nAfter=Math.max(0,N-d0), pAfter=Math.max(0,P-Math.max(0,d0-N));
        const self=(P+N-nAfter-pAfter)+pAfter*.2+nAfter*.3;
        const room=Math.max(0,capSelf-selfIn), s=Math.min(self,room); selfIn+=s;
        pay=P+N-s; memo.push("입원 30만원 우선공제(비급여부터) 후 급여 20%·비급여 30%");
        if(self>s) memo.push("입원 본인부담 연 500만원 초과분 보상");
      } else {
        const d0=30000, nAfter=Math.max(0,N-d0), pAfter=Math.max(0,P-Math.max(0,d0-N));
        const self=(P+N-nAfter-pAfter)+pAfter*.2+nAfter*.3, p0=Math.max(0,P+N-self);
        pay=Math.min(p0,1000000); memo.push("통원 3만원 우선공제(비급여부터) 후 급여 20%·비급여 30%"+(p0>1000000?" · 회당 100만원 한도":""));
      }
      const room=Math.max(0,1e8-used.old); if(pay>room){ pay=room; memo.push("연간 1억원 한도 도달"); } used.old+=pay;
    } else if(G.g==="sick"){
      if(isRx){ memo.push("처방조제비(약국)는 보상하지 않음"); }
      else {
        const base=P+Nb;
        if(s3>0) memo.push("도수·체외충격파·증식·비급여주사·MRI는 보상하지 않음(항암제·항생제·희귀의약품 주사는 예외)");
        if(isIn){ const self=Math.max(100000,base*.3); let p=Math.max(0,base-self);
          const room=Math.max(0,5e7-used.sickIn); if(p>room){ p=room; memo.push("입원 5천만원 한도 도달"); } used.sickIn+=p; pay=p;
          memo.push("입원 자기부담 Max(10만원, 30%)"); }
        else { const self=Math.max(20000,base*.3), p0=Math.max(0,base-self); pay=Math.min(p0,200000);
          memo.push("통원 자기부담 Max(2만원, 30%)"+(p0>200000?" · 회당 20만원 한도":"")); }
      }
    } else if(G.g===1){
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
        pay=bP+bN-s; ded=s; memo.push("입원 자기부담 "+(G.v==="a"?"10%":G.v==="b"?(sel?"10%":"20%"):(sel?"급여 10%·비급여 20%":"20%"))); if(self>s) memo.push("입원 자기부담 연 200만원 한도 적용");
      } else {
        const fx=isRx?8000:fix23(v.sc), lim=(isRx?S.rxLim:S.outLim)*1e4;
        let d;
        if(G.v==="a") d=fx;
        else if(G.v==="b") d=sel?fx:Math.max(fx,(bP+bN)*.2);
        else d=sel?Math.max(fx,bP*.1+bN*.2):Math.max(fx,(bP+bN)*.2);
        const p0=Math.max(0,bP+bN-d); pay=Math.min(p0,lim); ded=bP+bN-pay;
        memo.push((isRx?"처방":"외래")+" 공제 "+won(Math.min(d,bP+bN))+(v.rows.length>1?" (같은 날 "+v.rows.length+"곳 → 1회, 가장 높은 공제)":"")+(p0>lim?" · 1회 한도 "+(lim/1e4)+"만원":""));
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
      memo.push(isIn?"급여 20% · 비급여 30%":"급여 max(1·2만, 20%) · 비급여 max(3만, 30%)"+(v.rows.length>1?" (같은 날 "+v.rows.length+"건 → 통원 1회)":""));
    } else {
      /* 5세대 급여 */
      if(P>0){
        if(isIn){ pay+=P*.8; ded+=P*.2; memo.push("급여 입원 자기부담 20%"); }
        else { const byRate=v.rows.reduce((a,x)=>a+x.P*(x.k==="rx"?.3:(KBR[x.sc]||.3)),0), fx=fix45(v.sc), d=Math.max(byRate,P*.2,fx), p=Math.min(Math.max(0,P-d),200000); pay+=p; ded+=P-p;
          memo.push("급여 통원 공제 "+won(Math.min(d,P))+" = Max[건보 본인부담률분 "+won(byRate)+", 20% "+won(P*.2)+", "+won(fx)+"]"); }
      }
      if(N>0){
        if(sev){
          if(!S.t1){ ded+=N; memo.push("특약1(중증) 미가입 → 비급여 보상 없음"); }
          else {
            let p, self;
            if(isIn){ self=N*.3; if(v.sc==="g"||v.sc==="s"){ const room=Math.max(0,5000000-used.sevSelf); if(self>room){ self=room; memo.push("중증 상급·종합병원 입원 자기부담 연 500만원 상한 도달 → 초과분 보상"); } used.sevSelf+=self; } p=N-self; memo.push("특약1(중증) 30%"); }
            else { p=Math.max(0,N-Math.max(30000,N*.3)); memo.push("특약1(중증) max(3만, 30%)"); }
            const room=Math.max(0,5e7-used.t1); if(p>room){ p=room; memo.push("특약1 연 5천만원 한도 도달"); } used.t1+=p; pay+=p; ded+=N-p;
          }
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
    /* 상급병실료 차액 */
    if(isIn&&rm>0){
      const std=(G.g===2||G.g===3||G.g==="sick"||(G.g===4&&S.t2)||(G.g==="old"&&S.nhRoom));
      if(G.g===1) memo.push("상급병실료 차액: 1세대는 상품마다 달라 계산 제외(증권 확인)");
      else if(G.g===5) memo.push("상급병실료 차액: 5세대 기준 확인 전이라 계산 제외(약관 확인)");
      else if(!std) memo.push(G.g==="old"?"상급병실료 차액보장 특약 미가입 → 보상 없음":"비급여 특약 미가입 → 상급병실료 차액 보상 없음");
      else {
        let p=rm*.5; const cap=dy>0?dy*100000:Infinity;
        if(p>cap) p=cap;
        if(G.g==="old"){ const room=Math.max(0,2e7-used.room); if(p>room){ p=room; memo.push("상급병실료 특약 연 2천만원 한도 도달"); } used.room+=p; }
        pay+=p;
        memo.push("상급병실료 차액 50%"+(dy>0?" · 1일 평균 10만원 한도("+dy+"일)":" · 입원일수를 넣으면 1일 평균 10만원 한도 적용"));
      }
    }
    pay=Math.max(0,Math.round(pay));
    out.push({v,P,N,tot,pay,ded:Math.max(0,tot-pay),memo});
  });
  return {G,out,sum:out.reduce((a,x)=>a+x.pay,0),tot:out.reduce((a,x)=>a+x.tot,0)};
}

function prodHTML(){
  return `<div class="sl-prod"><div class="sl-seg"><button type="button" data-sprod="gen" aria-pressed="${S.prod==="gen"}">일반 실손</button><button type="button" data-sprod="old" aria-pressed="${S.prod==="old"}">노후실손</button><button type="button" data-sprod="sick" aria-pressed="${S.prod==="sick"}">유병력자 실손</button></div></div>`;
}
function optsHTML(G){
  if(G&&G.g==="old") return `<div class="sl-opts"><label class="sl-ck"><input type="checkbox" id="sl-nhroom" ${S.nhRoom?"checked":""}> 상급병실료 차액보장 특약 가입</label></div>`;
  if(G&&G.g==="sick") return "";
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
    <td data-l="횟수"><input data-sr="${i}" data-f="cnt" inputmode="numeric" value="${esc(r.cnt)}" placeholder="1"></td>
    <td data-l="구분">${sel("k",KIND,r.k)}</td><td data-l="질병 구분">${sel("dz",[["1","질병①"],["2","질병②"],["3","질병③"]],String(r.dz||1))}</td><td data-l="병원 규모">${sel("sc",SCALE,r.sc)}</td>
    <td data-l="급여 본인부담금">${inp("p",r.p,"0")}</td><td data-l="비급여 합계">${inp("n",r.n,"0")}</td>
    <td data-l="그중 상급병실료 차액">${r.k==="in"?inp("rm",r.rm,"0"):`<span class="sl-na">입원만</span>`}</td><td data-l="입원일수">${r.k==="in"?`<input data-sr="${i}" data-f="dy" inputmode="numeric" value="${esc(r.dy)}" placeholder="일">`:`<span class="sl-na">-</span>`}</td>
    <td data-l="그중 도수·체외충격파">${inp("ds",r.ds,"0")}</td><td data-l="그중 비급여주사">${inp("inj",r.inj,"0")}</td><td data-l="그중 MRI/MRA">${inp("mri",r.mri,"0")}</td>
    ${G&&(G.g===5||S.mode==="sw")?`<td data-l="중증(산정특례)" style="text-align:center"><input type="checkbox" data-sr="${i}" data-f="sev" ${r.sev?"checked":""} title="중증(산정특례 대상) 질환"></td>`:""}
    <td><button type="button" class="sl-x" data-srdel="${i}" aria-label="삭제">✕</button></td></tr>`;
}

function shell(){
  const R=$("#sl-root"); if(!R) return;
  const G=gen(S.date);
  R.innerHTML=`
  <div class="sl-seg sl-mode"><button type="button" data-smode="calc" aria-pressed="${S.mode==="calc"}">보상 계산</button><button type="button" data-smode="sw" aria-pressed="${S.mode==="sw"}">5세대 전환 손익 비교</button></div>
  ${S.mode==="sw"?FSC_HTML:""}
  ${S.mode==="sw"?`<h3 class="sl-h3">현재 가입한 실손</h3>`:""}
  <div class="panel sl-top">
    ${prodHTML()}
    ${S.prod==="gen"?`<div class="field"><label for="sl-date">실손 가입일</label><input id="sl-date" type="date" value="${esc(S.date)}"></div>`:""}
    <div class="sl-gen">${G?`<b>${G.label}</b><span>${G.per}</span>`:`<b>세대 미정</b><span>가입일 입력</span>`}</div>
    ${optsHTML(G)}
  </div>
  ${S.mode==="sw"?swInHTML(G):""}
  <div class="panel" style="margin-top:14px">
    <div class="row between"><h2>${S.mode==="sw"?"1년 진료 예상 (영수증 기준)":"진료비 영수증"}</h2><button class="btn" type="button" id="sl-add">+ 영수증 추가</button></div>
    <p class="sl-hint">영수증의 <b>급여 본인부담금</b>과 <b>비급여</b> 합계를 원 단위로 넣으세요. 비급여 중 상급병실료 차액(입원)·도수치료·주사·MRI는 오른쪽 칸에 따로 적습니다. 같은 진료를 여러 번 받았으면 횟수를 넣으세요. 같은 날 같은 질병으로 여러 곳(병원·약국)을 갔으면 진료일과 질병 구분을 같게 넣으면 약관대로 1회로 묶어 계산합니다. 다른 질병이면 질병 구분을 다르게 고르세요.${S.mode==="sw"?" 암·뇌혈관·심장질환·희귀난치성질환 등 산정특례 대상이면 중증에 체크하세요.":""}${G&&(G.g===4||G.g===5)?" (4·5세대: 외래+약국 합쳐 통원 1회)":G&&(G.g===2||G.g===3)?" (2·3세대: 외래는 외래끼리 1회, 약국은 약국끼리 1건)":""}</p>
    <div class="tbl-wrap"><table class="sl-tbl"><thead><tr><th>진료일</th><th>같은 진료<br>횟수</th><th>구분</th><th>질병<br>구분</th><th>병원 규모</th><th>급여<br>본인부담금</th><th>비급여<br>합계</th><th>그중 상급<br>병실료 차액</th><th>입원<br>일수</th><th>그중 도수·<br>체외충격파</th><th>그중<br>비급여주사</th><th>그중<br>MRI/MRA</th>${G&&(G.g===5||S.mode==="sw")?"<th>중증<br>(산정특례)</th>":""}<th></th></tr></thead>
    <tbody id="sl-rows">${S.rows.map((r,i)=>rowHTML(r,i,G)).join("")}</tbody></table></div>
  </div>
  <div id="sl-res" style="margin-top:14px"></div>`;
  result();
}

function agg(out){
  const m=new Map(); out.forEach(o=>{ const r=o.v.rows[0], k=r.i+"|"+o.v.rows.map(x=>x.i).join(","); let a=m.get(k);
    if(!a){ a={v:o.v,tot:0,pay:0,memo:o.memo,n:0}; m.set(k,a); } a.tot+=o.tot; a.pay+=o.pay; a.n++;
    o.memo.forEach(t=>{ if(a.memo.indexOf(t)<0) a.memo=a.memo.concat([t]); }); });
  return [...m.values()];
}
const kl=v=>v.k==="in"?"입원":v.rows.length>1?"외래+약국":v.k==="rx"?"약국":"외래";
function calcAs(over){
  const keys=Object.keys(over), bak={}; keys.forEach(k=>bak[k]=S[k]); Object.assign(S,over);
  try{ return calc(); } finally { Object.assign(S,bak); }
}
const G5={prod:"gen",date:"2026-06-01"};
function swCalc(){
  const cur=calc(); if(!cur) return null;
  const nx=calcAs(Object.assign({t1:S.n1,t2:S.n2},G5));
  const allN=calcAs(Object.assign({t1:S.n1,t2:S.n2,rows:S.rows.map(r=>Object.assign({},r,{sev:false}))},G5));
  const allS=calcAs(Object.assign({t1:S.n1,t2:S.n2,rows:S.rows.map(r=>Object.assign({},r,{sev:true}))},G5));
  const pc=num(S.pc), pn=num(S.pn), dr=Math.min(100,num(S.dr)), dm=Math.min(12,num(S.dm));
  const yc=pc*12, yn=pn*12-Math.round(pn*dr/100)*dm;
  return {cur,nx,allN,allS,pc,pn,dr,dm,yc,yn,save:yc-yn,loss:cur.sum-nx.sum};
}
function swInHTML(G){
  const f=(id,l,v,ph)=>`<div class="field"><label for="${id}">${l}</label><input id="${id}" inputmode="numeric" value="${v?Number(v).toLocaleString():""}" placeholder="${ph}"></div>`;
  return `<h3 class="sl-h3">보험료 · 5세대 가입 조건</h3><div class="panel sl-top">
    ${f("sl-pc","현재 실손 월보험료 (원)",S.pc,"0")}${f("sl-pn","5세대 전환 월보험료 (원, 보험사 안내)",S.pn,"0")}
    ${f("sl-dr","계약전환 할인율 (%)",S.dr,"없으면 비움")}${f("sl-dm","할인 기간 (개월, 1년 중)",S.dm,"없으면 비움")}
    <div class="sl-opts"><label class="sl-ck"><input type="checkbox" id="sl-n1" ${S.n1?"checked":""}> 5세대 특약1 (중증 비급여) 가입</label><label class="sl-ck"><input type="checkbox" id="sl-n2" ${S.n2?"checked":""}> 5세대 특약2 (비중증 비급여) 가입</label></div>
    ${G&&G.g===5?`<p class="sl-hint" style="flex:1 1 100%;color:var(--c4)">현재 실손이 이미 5세대입니다. 비교 대상이 같습니다.</p>`:""}
  </div>`;
}
function swResult(B){
  const W=swCalc(); if(!W){ B.innerHTML=""; return; }
  if(!W.cur.out.length){ B.innerHTML=`<div class="panel"><p class="sl-hint" style="margin:0">진료 금액을 넣으면 현재 실손과 5세대 보상액을 비교합니다.</p></div>`; return; }
  const sg=n=>(n>0?"+":n<0?"−":"")+won(Math.abs(n));
  const net=W.save-W.loss, hasP=W.pc>0&&W.pn>0;
  const A=agg(W.cur.out), Bn=agg(W.nx.out);
  const rowsH=A.map((a,i)=>{ const b=Bn[i]||{pay:0,memo:[]}; return `<tr><td data-l="진료">${esc(a.v.rows[0].d||"-")} ${kl(a.v)}${a.n>1?" ×"+a.n+"회":""}</td><td data-l="진료비" class="r">${won(a.tot)}</td><td data-l="현재 보상" class="r">${won(a.pay)}</td><td data-l="5세대 보상" class="r">${won(b.pay)}</td><td data-l="차이" class="r"><b>${sg(b.pay-a.pay)}</b></td><td data-l="계산 기준" class="m" style="grid-column:1/-1"><b>현재</b> ${a.memo.map(esc).join(" · ")}<br><b>5세대</b> ${b.memo.map(esc).join(" · ")}</td></tr>`; }).join("");
  const verdict=!hasP?"보험료 두 칸을 넣으면 1년 손익이 나옵니다.":net>0?`이 진료량이면 <b>5세대 전환이 1년에 ${won(net)} 유리</b>`:net<0?`이 진료량이면 <b>현재 실손 유지가 1년에 ${won(-net)} 유리</b>`:"1년 손익이 같습니다.";
  B.innerHTML=`<div class="sl-sum"><div><span>1년 보험료 절감 (전환 시)</span><b>${hasP?sg(W.save):"-"}</b>${hasP?`<small>현재 ${won(W.yc)} → 5세대 ${won(W.yn)}${W.dr&&W.dm?` (할인 ${W.dr}%·${W.dm}개월 반영)`:""}</small>`:""}</div>
    <div><span>보상 변화 (전환 시)</span><b>${sg(-W.loss)}</b><small>현재 ${won(W.cur.sum)} → 5세대 ${won(W.nx.sum)}</small></div>
    <div class="hi"><span>1년 손익 (전환 시)</span><b>${hasP?sg(net):"-"}</b></div></div>
  <div class="panel sl-verdict" style="margin-top:14px">${verdict}
    <div class="sl-hint" style="margin:8px 0 0">같은 진료가 모두 <b>비중증</b>이면 5세대 보상 ${won(W.allN.sum)}${hasP?` (손익 ${sg(W.save-(W.cur.sum-W.allN.sum))})`:""} · 모두 <b>중증(산정특례)</b>이면 ${won(W.allS.sum)}${hasP?` (손익 ${sg(W.save-(W.cur.sum-W.allS.sum))})`:""}</div></div>
  <div class="panel" style="margin-top:14px"><div class="row between"><h2>진료별 비교</h2><button class="btn" type="button" id="sl-copy">결과 복사</button></div>
  <div class="tbl-wrap" style="margin-top:8px"><table class="sl-tbl"><thead><tr><th>진료</th><th>진료비</th><th>현재 보상<br>(${W.cur.G.label})</th><th>5세대 보상</th><th>차이</th><th>계산 기준</th></tr></thead><tbody>${rowsH}</tbody></table></div>
  <p class="sl-note">미반영: 갱신 때 보험료 인상, 5세대 특약2 비급여 이용량에 따른 할인·할증, 질병·상해 구분 한도, 보상하지 않는 사항, 건강보험 재평가 D등급 치료 제외. 5세대 상급병실료 차액은 기준 확인 전이라 계산에서 뺐습니다. 5세대 급여 입원은 금융위 발표대로 20%로 계산했습니다(연간 상한 여부는 5세대 약관 확인 필요). 전환 보험료·할인율은 보험사 안내 금액을 넣으세요.</p></div>`;
}

function result(){
  const B=$("#sl-res"); if(!B) return;
  if(S.mode==="sw") return swResult(B);
  const C=calc();
  if(!C){ B.innerHTML=""; return; }
  if(!C.out.length){ B.innerHTML=`<div class="panel"><p class="sl-hint" style="margin:0">영수증 금액을 넣으면 예상 보상액이 나옵니다.</p></div>`; return; }
  B.innerHTML=`<div class="sl-sum"><div><span>청구 대상 진료비</span><b>${won(C.tot)}</b></div><div class="hi"><span>예상 보상액 (${C.G.label})</span><b>${won(C.sum)}</b></div><div><span>본인 부담(공제·미보상)</span><b>${won(C.tot-C.sum)}</b></div></div>
  <div class="panel" style="margin-top:14px"><div class="row between"><h2>영수증별 계산</h2><button class="btn" type="button" id="sl-copy">결과 복사</button></div>
  <div class="tbl-wrap" style="margin-top:8px"><table class="sl-tbl"><thead><tr><th>진료일</th><th>구분</th><th>진료비</th><th>예상 보상</th><th>계산 기준</th></tr></thead><tbody>
  ${agg(C.out).map(o=>`<tr><td data-l="진료일">${esc(o.v.rows[0].d||"-")}</td><td data-l="구분">${kl(o.v)}${o.n>1?" ×"+o.n+"회":""}</td><td data-l="진료비" class="r">${won(o.tot)}</td><td data-l="예상 보상" class="r"><b>${won(o.pay)}</b></td><td data-l="계산 기준" class="m" style="grid-column:1/-1">${o.memo.map(esc).join("<br>")}</td></tr>`).join("")}
  </tbody></table></div>
  <p class="sl-note">미반영: 질병·상해 구분 한도, 연간 통원 횟수, 비례보상, 면책기간, 보상하지 않는 사항.${C.G.g==="old"||C.G.g==="sick"?" 노후·유병력자 실손은 현행 약관 기준이며, 가입 시기·회사별 약관에 따라 다를 수 있습니다.":""}${C.G.g===1?" 1세대는 회사·상품마다 보장비율·한도가 달라 증권 확인이 꼭 필요합니다.":""}${C.G.g===5?" 5세대 급여 통원 자기부담은 금융위원회 발표(건보 본인부담률 연동) 기준으로 계산했습니다.":""}</p></div>`;
}

function copyText(){
  if(S.mode==="sw"){ const W=swCalc(); if(!W) return ""; const sg=n=>(n>0?"+":n<0?"-":"")+won(Math.abs(n));
    return `[실손 5세대 전환 손익 비교 · 현재 ${W.cur.G.label} ${W.cur.G.per}]\n1년 진료비 ${won(W.cur.tot)}\n보상: 현재 ${won(W.cur.sum)} → 5세대 ${won(W.nx.sum)} (${sg(-W.loss)})\n`+(W.pc&&W.pn?`보험료(1년): 현재 ${won(W.yc)} → 5세대 ${won(W.yn)} (${sg(W.save)})\n1년 손익(전환 시): ${sg(W.save-W.loss)}\n`:"")+`※ 금융위원회 5세대 발표(2026.5.6) 기준 대략 계산이며, 실제 보험금·보험료는 약관·보험사 심사로 정해집니다.`; }
  const C=calc(); if(!C) return "";
  return `[실손 예상 보상액 · ${C.G.label} ${C.G.per}]\n`+agg(C.out).map(o=>`${o.v.rows[0].d||"-"}${o.n>1?" ×"+o.n+"회":""} 진료비 ${won(o.tot)} → 예상 ${won(o.pay)}`).join("\n")+`\n합계: 진료비 ${won(C.tot)} / 예상 보상 ${won(C.sum)}\n※ 대략 계산이며 실제 보험금은 약관·보험사 심사로 정해집니다.`;
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
.sl-tbl input[data-f=cnt],.sl-tbl input[data-f=dy]{min-width:52px}
.sl-tbl input:not([type=checkbox]),.sl-tbl select{width:100%;min-width:84px;box-sizing:border-box;padding:7px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--fg);font:inherit;text-align:right}
.sl-tbl select,.sl-tbl input[type=date]{text-align:left}
.sl-tbl td.r{text-align:right;white-space:nowrap}.sl-tbl td.m{font-size:12.5px;color:var(--muted)}
.sl-prod{flex:1 1 100%}.sl-na{font-size:12px;color:var(--muted)}
.sl-mode{margin-bottom:14px}.sl-h3{font-size:15px;margin:16px 0 8px}
.sl-sum small{display:block;font-size:12px;color:var(--muted);margin-top:4px}
.sl-verdict{font-size:15px}.sl-verdict b{color:var(--c4)}
.sl-fsc{width:100%;border-collapse:collapse;font-size:13px}.sl-fsc th,.sl-fsc td{border:1px solid var(--line);padding:7px 8px;text-align:left;vertical-align:top}
.sl-fsc th{background:color-mix(in srgb,var(--c4) 10%,var(--surface));white-space:nowrap}.sl-fsc td:first-child{white-space:nowrap;font-weight:600}
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
  const md=e.target.closest("[data-smode]"); if(md){ S.mode=md.dataset.smode; shell(); return; }
  const pr=e.target.closest("[data-sprod]"); if(pr){ S.prod=pr.dataset.sprod; shell(); return; }
  const b=e.target.closest("[data-ssub]"); if(b){ S.sub=b.dataset.ssub; shell(); return; }
  if(e.target.closest("#sl-add")){ const last=S.rows[S.rows.length-1]||{}; S.rows.push(Object.assign(EMPTY(),{d:last.d||"",sc:last.sc||"c"})); shell(); return; }
  const d=e.target.closest("[data-srdel]"); if(d){ S.rows.splice(+d.dataset.srdel,1); if(!S.rows.length) S.rows.push(EMPTY()); shell(); return; }
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
  if(t.id==="sl-nhroom"){ S.nhRoom=t.checked; result(); return; }
  if(t.id==="sl-n1"){ S.n1=t.checked; result(); return; }
  if(t.id==="sl-n2"){ S.n2=t.checked; result(); return; }
  if(/^sl-(pc|pn|dr|dm)$/.test(t.id)){ const raw=t.value.replace(/[^\d]/g,""); S[t.id.slice(3)]=raw; t.value=raw?Number(raw).toLocaleString():""; result(); return; }
  if(t.dataset&&t.dataset.sr!=null){ const r=S.rows[+t.dataset.sr]; if(!r) return; const f=t.dataset.f;
    if(f==="sev") r.sev=t.checked;
    else if(f==="k"){ r.k=t.value; if(e.type==="change") shell(); else result(); return; }
    else if(f==="sc"||f==="d"||f==="dz") r[f]=t.value;
    else { const raw=t.value.replace(/[^\d]/g,""); r[f]=raw; t.value=raw?Number(raw).toLocaleString():""; }
    result(); }
}
document.addEventListener("input",onEdit); document.addEventListener("change",onEdit);

window.SILSON={init:shell,calc,S,gen};
if(document.readyState!=="loading") shell(); else document.addEventListener("DOMContentLoaded",shell);
})();
