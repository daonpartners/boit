/* 고지의무 자동화 — 고지유형별·질병별·질문별 보기, 회사별 예외질환·심사 안내
   질문 문구 출처: 흥국생명 GA소식지 2026-10 p.11·p.15 / 2026-11 p.17, NH농협손보 2026-10 p.11
   회사별 표: 2026-10 보험사별 판매전략 p.114(생명)·p.115(손해) — 09월 말 기준, 판매자 교육용 */
(function(){
const X=window.DSX; if(!X) return; const {DS,dsCalc,dsQs,DS_SIX,DS_DIS}=X, dsResult=X.refresh;
const CSS=`.d2-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 8px}
.d2-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));gap:8px}
.d2-c{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--surface);cursor:pointer;text-align:left;font:inherit;color:var(--ink);display:flex;flex-direction:column;gap:6px}
.d2-c[aria-pressed="true"]{outline:2px solid var(--ink)}
.d2-c.off{opacity:.38}
.d2-c h4{margin:0;font-size:14px;display:flex;justify-content:space-between;gap:6px;align-items:center}
.d2-c ul{margin:0;padding:0;list-style:none;font-size:12px;display:flex;flex-direction:column;gap:3px}
.d2-c li{display:flex;justify-content:space-between;gap:6px}
.d2-c li span:first-child{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.d2-b{font-size:11px;font-weight:700;padding:2px 7px;border-radius:99px;white-space:nowrap}
.d2-ok{background:var(--accent-soft);color:var(--ok)}.d2-ck{background:var(--warn-soft);color:var(--warn)}.d2-no{background:var(--bad-soft);color:var(--bad)}.d2-ex{background:#e8eefc;color:#2f55b5}
.d2-box{border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-top:10px}
.d2-q{border-top:1px solid var(--line);padding:10px 0}.d2-q:first-of-type{border-top:0}
.d2-g{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-top:8px}
.d2-g.hot{border-color:var(--bad);background:var(--bad-soft)}
.d2-chips{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}
.d2-t{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}.d2-t th,.d2-t td{border-bottom:1px solid var(--line);padding:4px 6px;text-align:left;vertical-align:top}
.d2-co td:first-child{white-space:nowrap;font-weight:600}
textarea.d2-ta{width:100%;min-height:70px;border:1px solid var(--line);border-radius:8px;padding:8px;font:inherit;font-size:13px}`;
const st=document.createElement("style"); st.textContent=CSS; document.head.appendChild(st);

/* ── 회사 정보 (판매자료 표 그대로) ── */
const S10="2026-10 판매전략 p.115(손해) · 09월 말 기준", L10="2026-10 판매전략 p.114(생명) · 09월 말 기준";
const NON=["3.1.5","3.2.5","3.3.5","3.4.5","3.5.5","3.6.5","3.7.5","3.8.5","3.9.5","3.10.5"];
const CO={
 "삼성화재":{g:"손보",five:"5대질병",exc:"KCD기준 4,806여개 (3개월 내 인수 3N5: 290여개)",max:"무제한",N:[0,1,2,3,4,5,6,7,8,9,10],etc:"3.1.1 운영 · 3.7.5~3.9.5는 표에 (◯) 표기",src:S10},
 "현대해상":{g:"손보",five:"6대질병",exc:"194개",max:"5개",N:[0,1,2,3,4,5,6,7,8,9],etc:"3.10.10 운영(3.10.5 아님) · 3.1.5~3.4.5 ◯* 표기",src:S10},
 "DB손보":{g:"손보",five:"6대질병",exc:"500개",max:"5개",N:[0,1,2,3,4,5,6,8],etc:"3.1.1 운영 · 3.10.5 표에 '-'",src:S10},
 "KB손보":{g:"손보",five:"6대질병",exc:"333개",max:"5개",N:[0,1,2,3,4,5,6,7,8,9,10],etc:"3.1.0 운영",src:S10},
 "메리츠화재":{g:"손보",five:"6대질병",exc:"163개",max:"5개",N:[0,1,2,3,4,5,6,7,8,9,10],etc:"3.1.0 운영",src:S10},
 "한화손보":{g:"손보",five:"6대질병",exc:"3천여개",max:"4개",N:[0,1,2,3,4,5,6,8,10],etc:"3.1.1 운영",src:S10},
 "흥국화재":{g:"손보",five:"6대질병",exc:"3N5: 3,500개 / 325: 3,634개",max:"5개/3개",N:[0,1,2,3,4,5,6,10],etc:"",src:S10},
 "롯데손보":{g:"손보",five:"6대질병",exc:"5년초과 6,584개",max:"5개",N:[0,1,2,3,4,5,6,7,8,9],etc:"3.10.10 운영",src:S10},
 "NH농협손보":{g:"손보",five:"6대질병",exc:"경증예외질환 558개 (뉴헤아림 558개/1,159개) · 간편실손은 없음",max:"5개",N:[3,5],etc:"3.10.10 운영. 3.10.5 고당지·3.10.10+뇌·허·3.3.5·3.2.5(굿패스) 라인업 (NH 2026-10 소식지 p.11)",src:S10+" · NH 소식지 2026-10 p.11"},
 "하나손보":{g:"손보",five:"6대질병",exc:"135개 · 경증 291종 · 405개 (표 표기 그대로)",max:"5개",N:[1,2,3,4,5,6,7,8,9,10],etc:"",src:S10},
 "삼성생명":{g:"생보",five:"6대질병",exc:"11,364개 (간편 3.1.5~3.10.5 동일 적용)",max:"7개",N:[0,1,2,5,10],etc:"예외질환이면 입원·수술 횟수가 많아도 즉시 인수 (2026-11 소식지 p.3). 암PASS플랜 예외: I20 협심증·I21 급성심근경색·I49.8 부정맥·I63 뇌경색·I65 뇌동맥협착·I70.8 죽상경화 (2026-10 소식지 p.6, 조기종료 가능)",src:L10+" · 삼성생명 소식지"},
 "한화생명":{g:"생보",five:"7대질병",exc:"판매자료 표 정렬 불명확 → 회사 자료 확인",max:"5개",N:[0,1,2,3,4,5,10],etc:"",src:L10},
 "신한라이프":{g:"생보",five:"7대질병",exc:"판매자료 표 정렬 불명확 → 회사 자료 확인",max:"무제한",N:[1,3,5,10],etc:"간편 예외질환: 치료 완료 후 즉시 또는 1개월 경과 후 가입 (위염·치질·담석증/담낭염·부비동염/편도염 등, 조건 충족 시 · 간편예외질환 Board 확인). 종신 표준체: 고혈압·당뇨·내당능장애·B형간염·뇌동맥류·뇌전증·류마티스관절염·경동맥협착·상심실성빈맥·천식은 할증 대신 삭감 인수(3케어리워드종신 제외) (2026-10 소식지 p.14)",src:L10+" · 신한라이프 소식지"},
 "미래에셋생명":{g:"생보",five:"7대질병",exc:"7,147개 (건강급부 기준)",max:"무제한",N:[0,1,2,3,4,5,10],etc:"백내장 예외질환 보류기간 3년 → 1년 단축. 표준체 고혈압 유병자 뇌심담보 할증 50%→25% (2026-11 소식지 p.16)",src:L10+" · 미래에셋 소식지 2026-11"},
 "동양생명":{g:"생보",five:"7대질병",exc:"판매자료 표 정렬 불명확 → 회사 자료 확인",max:"무제한",N:[0,1,2,3,4,5,6],etc:"",src:L10},
 "KB라이프":{g:"생보",five:"6대질병",exc:"판매자료 표 정렬 불명확 → 회사 자료 확인",max:"무제한",N:[1,3,5,10],etc:"",src:L10},
 "흥국생명":{g:"생보",five:"6대질병",exc:"N년 입원·수술 문항에 예외질환 운영",max:"3개",N:[1,2,3,4,5,10],etc:"추가 고지형: 3.6.5.1 원플러스(1년 All-risk) · 3.8.5.5 투플러스(5년 뇌혈관·허혈심장) · 3.10.5.5 고당플러스(5년 고혈압·당뇨). 사례: 2개월 전 대장용종 수술(간편 예외질환)은 N년 입원·수술 PASS (2026-10 소식지 p.6·p.11)",src:L10+" · 흥국생명 소식지"},
 "DB생명":{g:"생보",five:"7대질병",exc:"판매자료 표 정렬 불명확 → 회사 자료 확인",max:"3개",N:[0,1,2,3,4,5,7,10],etc:"",src:L10},
 "ABL생명":{g:"생보",five:"7대질병",exc:"판매자료 표 정렬 불명확 → 회사 자료 확인",max:"10개",N:[0,1,2,3,4,5,10],etc:"",src:L10},
 "라이나생명":{g:"생보",five:"6대질병",exc:"판매자료 표 정렬 불명확 → 회사 자료 확인",max:"무제한",N:[2,5,10],etc:"",src:L10}
};
const EXTRA_CO={"흥국생명":["3651","3855","31055"]};

/* ── 예외질환 목록 (회사별, 이 기기에 저장) ── */
const EK="boit_exc_v1";
const excAll=()=>{ try{ return JSON.parse(localStorage.getItem(EK)||"{}"); }catch(e){ return {}; } };
const excSet=(co,txt)=>{ const a=excAll(); a[co]=txt; try{ localStorage.setItem(EK,JSON.stringify(a)); }catch(e){} };
const excList=co=>String(excAll()[co]||"").toUpperCase().split(/[^A-Z0-9.]+/).map(s=>s.replace(/\./g,"")).filter(s=>/^[A-Z]\d/.test(s));
const isExc=(co,cc)=>{ if(!co) return false; const c=String(cc||"").replace(/\./g,""); return excList(co).some(p=>c.startsWith(p)); };

/* ── 판정 도우미 ── */
const CANCER=/^C[0-8]\d|^C9[0-7]/, LEUK=/^C9[1-5]/, BRAIN=/^I6\d/, HEART=/^I2[0-5]/, HTDM=/^I1[0-5]|^E1[0-4]/;
const uniq=a=>a.filter((x,i)=>a.findIndex(y=>y.i===x.i)===i);
function grp(rows){ const g={}; rows.forEach(x=>{ const k=x.cc||x.n; const o=(g[k]=g[k]||{days:new Set(),drug:0,rows:[]}); o.days.add(x.d); o.drug+=+x.r||0; o.rows.push(x); }); return Object.values(g); }
const long=rows=>uniq(grp(rows).filter(g=>g.days.size>=7||g.drug>=30).flatMap(g=>g.rows));
const admSurg=rows=>rows.filter(x=>x.t==="입원"||x.s);
/* 질문 정의: [id, 문구, 판정종류(hard=고지 필요 / soft=고객 확인), 예외질환 적용, 근거행 함수] */
function Qs(R,key){ const W=m=>R.rs.filter(x=>x.m<m), M=m=>W(m).filter(x=>!x.auto);
  const q1=["k1","최근 3개월 이내 입원필요·수술필요·추가(재)검사필요 소견, 질병확정진단, 질병의심소견","soft",0,M(3)];
  const six=["k3","최근 5년 이내 암(백혈병 포함)·협심증·심근경색·심장판막증·간경화증·뇌졸중증(뇌출혈·뇌경색) 진단·입원·수술","hard",0,R.six];
  const nyr=n=>["k2",`최근 ${n}년 이내 질병·사고로 입원 또는 수술 (예외질환 운영)`,"hard",1,admSurg(W(n*12))];
  if(key==="std"){ const s=dsQs(R).std; return [
    [s[0][0],s[0][1],"hard",0,s[0][2]],[s[1][0],s[1][1],"soft",0,s[1][2]],[s[2][0],s[2][1],"soft",0,s[2][2]],[s[3][0],s[3][1],"hard",0,s[3][2]],[s[4][0],s[4][1],"hard",0,s[4][2]]]; }
  if(key==="silson") return [q1,
    ["r2","최근 2년 이내 질병·사고로 입원 또는 수술(제왕절개 포함)","hard",0,admSurg(W(24))],
    ["r3","최근 5년 이내 암(백혈병 제외) 진단·입원·수술·치료","hard",0,M(60).filter(x=>CANCER.test(x.cc)&&!LEUK.test(x.cc))]];
  if(key==="3651") return [q1,nyr(6),six,["k4","[추가] 최근 1년 이내 입원·수술·계속 7일 이상 치료·계속 30일 이상 투약 (예외질환 운영)","hard",1,uniq([...admSurg(W(12)),...long(M(12))])]];
  if(key==="3855") return [q1,nyr(8),six,["k4","[추가] 최근 5년 이내 뇌혈관질환·허혈심장질환으로 입원·수술·계속 7일 이상 치료·계속 30일 이상 투약","hard",0,(()=>{ const v=M(60).filter(x=>BRAIN.test(x.cc)||HEART.test(x.cc)); return uniq([...admSurg(v),...long(v)]); })()]];
  if(key==="31055") return [q1,nyr(10),six,["k4","[추가] 최근 5년 이내 고혈압·당뇨병 진단·입원·수술·투약·치료","hard",0,M(60).filter(x=>HTDM.test(x.cc))]];
  const n=+key.slice(1); return n?[q1,nyr(n),six]:[q1,six]; }
const TYPES=[["std","표준체 (건강고지)"],...[10,9,8,7,6,5,4,3,2,1,0].map(n=>["n"+n,`간편 3.${n}.5`]),["3651","간편 3.6.5.1 (1년 추가)"],["3855","간편 3.8.5.5 (뇌·심 추가)"],["31055","간편 3.10.5.5 (고·당 추가)"],["silson","유병자 실손 (3·2·5)"]];
function avail(key,co){ if(!co) return true; const c=CO[co]; if(key==="std") return true;
  if(key==="silson") return c.g==="손보"; if(/^(3651|3855|31055)$/.test(key)) return (EXTRA_CO[co]||[]).includes(key);
  return c.N.includes(+key.slice(1)); }
/* 질문별 결과: hits(고지 대상) · ex(예외질환으로 빠진 행) · state */
function judge(q,co){ const [,,kind,exOK,rows]=q; let hits=rows, ex=[];
  if(exOK&&co){ ex=rows.filter(x=>isExc(co,x.cc)); hits=rows.filter(x=>!isExc(co,x.cc)); }
  const state=!hits.length?"ok":kind==="hard"?"no":"ck"; return {hits,ex,state}; }
const BADGE={ok:["d2-ok","해당없음"],ck:["d2-ck","확인 필요"],no:["d2-no","고지 필요"]};
function verdict(js){ if(js.some(j=>j.state==="no")) return ["d2-no","심사 필요"]; if(js.some(j=>j.state==="ck")) return ["d2-ck","확인 후 가능"]; return ["d2-ok","가입 가능"]; }

/* ── 화면 ── */
const li=x=>`${x.d} · ${esc(x.cc||"")} ${esc(x.n||"")} · ${x.auto?"자동차 ":""}${x.t}${x.k?` ${x.k}일`:""}${x.r?` · 투약 ${x.r}일`:""}${x.s?" · 수술":x.proc?` · 처치 ${esc(x.proc)}`:""}${x.h?` · ${esc(x.h)}`:""}`;
function byDis(rows){ const g={}; rows.forEach(x=>{ const k=(x.cc||"")+"|"+(x.n||""); (g[k]=g[k]||[]).push(x); }); return Object.entries(g).sort((a,b)=>b[1].length-a[1].length); }
function cards(R,co){ const sel=DS.d2sel||"std";
  return `<div class="d2-grid">${TYPES.slice().sort((a,b)=>avail(b[0],co)-avail(a[0],co)).filter(([k])=>!co||DS.d2all||avail(k,co)).map(([k,t])=>{ const Q=Qs(R,k), J=Q.map(q=>judge(q,co)), [vc,vt]=verdict(J), off=!avail(k,co);
   return `<button type="button" class="d2-c${off?" off":""}" data-d2t="${k}" aria-pressed="${sel===k}"><h4>${t}<span class="d2-b ${off?"":vc}">${off?"판매 안 함":vt}</span></h4>
    <ul>${Q.map((q,i)=>{ const j=J[i], [bc,bt]=BADGE[j.state]; return `<li><span>${i+1}. ${shortQ(q[1])}</span><span class="d2-b ${bc}">${j.hits.length?j.hits.length+"건 ":""}${bt}${j.ex.length?` · 예외 ${j.ex.length}`:""}</span></li>`; }).join("")}</ul></button>`; }).join("")}</div>${co?`<button class="lnk" type="button" id="d2-all" style="margin-top:6px">${DS.d2all?"판매 유형만 보기":`${co}에서 판매 안 하는 유형도 보기`}</button>`:""}`; }
function shortQ(s){ return s.replace(/^\[추가\] /,"추가 ").replace(/최근 /,"").replace(/\(.*?\)/g,"").slice(0,22); }
function detail(R,co){ const k=DS.d2sel||"std", t=(TYPES.find(x=>x[0]===k)||[])[1], Q=Qs(R,k);
  return `<div class="d2-box"><div class="row between" style="flex-wrap:wrap;gap:6px"><b>${t} · 질문별 해당 치료</b>${co?`<span class="note">${co} 예외질환 목록 ${excList(co).length?excList(co).length+"개 등록":"미등록"}</span>`:""}</div>
   ${Q.map((q,i)=>{ const j=judge(q,co), [bc,bt]=BADGE[j.state];
    return `<div class="d2-q"><div class="row between" style="gap:8px;align-items:flex-start"><div style="flex:1;min-width:0"><span class="note">${i+1}번</span> ${q[1]}</div><span class="d2-b ${bc}">${j.hits.length?j.hits.length+"건 · ":""}${bt}</span></div>
     ${q[3]?`<p class="note" style="margin:4px 0 0">${co&&!excList(co).length?`${co} 예외질환 목록 미등록`:""}</p>`:""}
     ${j.hits.length?byDis(j.hits).map(([kk,a])=>`<details style="margin-top:4px"><summary style="cursor:pointer;font-size:13px"><b>${esc(a[0].cc||"")} ${esc(a[0].n||"")}</b> · ${a.length}건</summary><ul class="ds-t" style="margin:4px 0 0;padding-left:18px">${a.map(x=>`<li>${li(x)}</li>`).join("")}</ul></details>`).join(""):""}
     ${j.ex.length?`<p style="margin:6px 0 0"><span class="d2-b d2-ex">예외질환 ${j.ex.length}건</span> <span class="note">${byDis(j.ex).map(([kk,a])=>esc((a[0].cc||"")+" "+(a[0].n||""))).join(", ")}</span></p>`:""}</div>`; }).join("")}</div>`; }
function diseases(R,co){ const k=DS.d2sel||"std", Q=Qs(R,k), J=Q.map(q=>({q,j:judge(q,co)}));
  const rows=R.in60; if(!rows.length) return '<p class="note">5년 이내 진료가 없습니다.</p>';
  const gs=byDis(rows).map(([kk,a])=>{ const cc=a[0].cc||"", days=new Set(a.map(x=>x.d)).size, adm=a.filter(x=>x.t==="입원").reduce((s,x)=>s+(+x.k||1),0), drug=a.reduce((s,x)=>s+(+x.r||0),0), surg=a.filter(x=>x.s).length,
     ds=a.map(x=>x.d).sort(), tags=[]; const six=DS_SIX.find(([,re])=>re.test(cc)), ten=DS_DIS.find(([,re])=>re.test(cc));
     if(six) tags.push(["d2-no",six[0]+" (6대)"]); else if(ten) tags.push(["d2-no",ten[0]+" (10대)"]);
     if(BRAIN.test(cc)) tags.push(["d2-ck","뇌혈관"]); if(HEART.test(cc)) tags.push(["d2-ck","허혈심장"]);
     if(days>=7) tags.push(["d2-ck",`진료 ${days}일`]); if(drug>=30) tags.push(["d2-ck",`투약 ${drug}일`]);
     if(co&&isExc(co,cc)) tags.push(["d2-ex",co+" 예외질환"]);
     const qs=J.map(({q,j},i)=>j.hits.some(h=>a.some(x=>x.i===h.i))?i+1:0).filter(Boolean);
     return {a,cc,days,adm,drug,surg,ds,tags,qs,hot:qs.length>0}; }).sort((x,y)=>y.hot-x.hot||y.a.length-x.a.length);
  return gs.map(g=>`<div class="d2-g${g.hot?" hot":""}"><div class="row between" style="gap:8px;flex-wrap:wrap"><b>${esc(g.cc)} ${esc(g.a[0].n||"")}</b><span class="note">${g.ds[0]} ~ ${g.ds[g.ds.length-1]}</span></div>
   <div class="note" style="margin-top:3px">진료일 ${g.days}일${g.adm?` · 입원 ${g.adm}일`:""}${g.drug?` · 투약 합계 ${g.drug}일`:""}${g.surg?` · 수술 ${g.surg}건`:""}${g.a.some(x=>x.auto)?" · 자동차보험 포함":""}</div>
   <div class="d2-chips">${g.qs.length?g.qs.map(n=>`<span class="d2-b d2-no">${n}번 질문 해당</span>`).join(""):`<span class="d2-b d2-ok">선택한 유형 질문 해당 없음</span>`}${g.tags.map(([c,t])=>`<span class="d2-b ${c}">${esc(t)}</span>`).join("")}</div>
   <details style="margin-top:4px"><summary class="note" style="cursor:pointer">치료 ${g.a.length}건 보기</summary><ul class="ds-t" style="margin:4px 0 0;padding-left:18px">${g.a.map(x=>`<li>${li(x)}</li>`).join("")}</ul></details></div>`).join(""); }
function company(co){ const names=Object.keys(CO);
  const tbl=`<div class="tbl-wrap"><table class="d2-t d2-co"><thead><tr><th>회사</th><th>5년 고지</th><th>예외질환 (판매자료)</th><th>최대인수</th><th>내 목록</th></tr></thead><tbody>${names.map(n=>{ const c=CO[n]; return `<tr${n===co?' style="background:var(--warn-soft)"':""}><td>${n}</td><td>${c.five}</td><td>${esc(c.exc)}</td><td>${c.max}</td><td>${excList(n).length?excList(n).length+"개":"–"}</td></tr>`; }).join("")}</tbody></table></div>`;
  if(!co) return `${tbl}<p class="note">출처: ${S10} / ${L10}</p>`;
  const c=CO[co];
  return `<div class="d2-box"><b>${co} 심사 안내</b>
   <table class="d2-t d2-co"><tbody><tr><td>판매 간편 유형</td><td>${c.N.map(n=>`3.${n}.5`).join(" · ")||"–"}${(EXTRA_CO[co]||[]).length?" · 3.6.5.1 · 3.8.5.5 · 3.10.5.5":""}</td></tr>
   <tr><td>5년 고지 질병</td><td>${c.five}${c.five!=="6대질병"?" — 6대와 다르므로 상품 질문표 문구 확인":""}</td></tr>
   <tr><td>예외질환</td><td>${esc(c.exc)}</td></tr><tr><td>최대인수</td><td>${c.max}</td></tr>${c.etc?`<tr><td>별도 안내</td><td>${esc(c.etc)}</td></tr>`:""}<tr><td>출처</td><td class="note">${esc(c.src)}</td></tr></tbody></table>
   <div style="margin-top:12px"><b>${co} 예외질환 목록 등록</b>
   <textarea class="d2-ta" id="d2-exc" placeholder="예) K29, K21.0, K80, J32, I84">${esc(excAll()[co]||"")}</textarea>
   <div class="row" style="gap:6px;margin-top:6px"><button class="btn sm primary" type="button" id="d2-exc-save">저장하고 다시 판정</button><span class="note">${excList(co).length}개 등록됨</span></div></div></div>${tbl}`; }
function render(){ const el=$("#ds-res"); if(!el||!DS.rows.length) return; const R=dsCalc(), co=DS.d2co||"", tab=DS.d2tab||"type";
  const box=document.createElement("div"); box.id="d2";
  box.innerHTML=`<div class="row between" style="margin-top:16px;flex-wrap:wrap;gap:8px"><b style="font-size:15px">고지유형별 자동 판정</b>
   <select id="d2-co" style="width:auto"><option value="">회사 선택 (예외질환·판매유형 반영)</option><optgroup label="손해보험">${Object.keys(CO).filter(n=>CO[n].g==="손보").map(n=>`<option ${n===co?"selected":""}>${n}</option>`).join("")}</optgroup><optgroup label="생명보험">${Object.keys(CO).filter(n=>CO[n].g==="생보").map(n=>`<option ${n===co?"selected":""}>${n}</option>`).join("")}</optgroup></select></div>
   ${cards(R,co)}
   <div class="d2-tabs seg"><button class="btn sm" type="button" data-d2b="type" aria-pressed="${tab==="type"}">질문별 해당 치료</button><button class="btn sm" type="button" data-d2b="dis" aria-pressed="${tab==="dis"}">질병별 치료</button><button class="btn sm" type="button" data-d2b="co" aria-pressed="${tab==="co"}">회사별 안내·예외질환</button></div>
   ${tab==="type"?detail(R,co):tab==="dis"?diseases(R,co):company(co)}
`;
  const top=el.querySelector(".ds-top"); if(top) top.after(box); else el.prepend(box); }
window.dsAfter=render;
document.addEventListener("click",e=>{ const t=e.target.closest("[data-d2t]"); if(t){ DS.d2sel=t.dataset.d2t; if(DS.d2tab==="co") DS.d2tab="type"; dsResult(); return; }
  const b=e.target.closest("[data-d2b]"); if(b){ DS.d2tab=b.dataset.d2b; dsResult(); return; }
  if(e.target.id==="d2-all"){ DS.d2all=!DS.d2all; dsResult(); return; }
  if(e.target.id==="d2-exc-save"){ const co=DS.d2co; if(co){ excSet(co,($("#d2-exc")||{}).value||""); dsResult(); } } });
document.addEventListener("change",e=>{ if(e.target.id==="d2-co"){ DS.d2co=e.target.value; dsResult(); } });
if(DS.rows.length) dsResult();
})();
