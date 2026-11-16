/* 보잇 · 보험료 비교 — 판매자료(보험사별 판매전략)에 실린 회사별 보험료 표
   데이터: premcmp.json (2026-10 보험사별 판매전략, 09월 말 기준). 원문 표에서 칸 수가 맞는 것만 옮김. */
(function(){
  const sec=document.querySelector('section[data-view="quote"]'); if(!sec) return;
  const q=s=>sec.querySelector(s), esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const css=document.createElement("style"); css.textContent=`
  .pc-tabs{display:flex;gap:6px;margin-top:12px}.pc-tabs .btn[aria-pressed="true"]{background:var(--accent);color:#fff;border-color:var(--accent)}
  .pc-chips{display:flex;gap:6px;flex-wrap:wrap}.pc-chips .btn{padding:7px 12px}.pc-chips .btn[aria-pressed="true"]{background:var(--accent-soft);border-color:var(--accent);color:var(--ok)}
  .pc-tp{display:flex;flex-direction:column;gap:6px;margin-top:10px}.pc-tp button{all:unset;cursor:pointer;border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--surface);font-size:14px}
  .pc-tp button[aria-pressed="true"]{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent-soft);font-weight:700}
  .pc-ctl{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.pc-ctl .seg .btn{padding:7px 12px}
  .pc-list{margin-top:12px;display:flex;flex-direction:column;gap:6px}
  .pc-r{display:grid;grid-template-columns:7em 1fr auto;gap:8px;align-items:center;font-size:14px}
  .pc-r i{display:block;height:10px;border-radius:3px;background:var(--accent);opacity:.35}.pc-r.best i{opacity:1}.pc-r.best b{color:var(--ok)}
  .pc-r>span:first-child{white-space:nowrap}.pc-r b{font-variant-numeric:tabular-nums;white-space:nowrap}.pc-r.na{color:var(--muted)}
  .pc-pr{display:block;font-size:11px;color:var(--muted);font-weight:400;white-space:normal;line-height:1.3}
  .pc-meta{margin-top:12px;font-size:12.5px;color:var(--muted);line-height:1.6}`;
  document.head.appendChild(css);
  /* 화면 틀: 제목 아래 탭, 기존 가설계는 '내 보험료표'로 */
  const grid=q(".qt-grid"); if(!grid) return;
  const h1=q("h1"); if(h1) h1.textContent="보험료 비교";
  const tabs=document.createElement("div"); tabs.className="pc-tabs";
  tabs.innerHTML='<button class="btn" type="button" data-pct="sales" aria-pressed="true">판매자료 비교</button><button class="btn" type="button" data-pct="mine" aria-pressed="false">내 보험료표</button>';
  grid.before(tabs);
  const box=document.createElement("div"); box.className="panel"; box.id="pc-box"; box.style.marginTop="14px";
  box.innerHTML='<p class="note" style="margin:0">불러오는 중…</p>'; tabs.after(box);
  grid.hidden=true; const ex=q("#qt-ex"); 
  let D=null, G="", ID="", SEX="M", AGE=null, SET=null, TAB="sales", PART=0, MODE="pick";
  const K={birth:"",kind:"all",set:"일반심사",cov:[1,3,4]};
  function setTab(t){ TAB=t; tabs.querySelectorAll("[data-pct]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.pct===t)); box.hidden=t!=="sales"; grid.hidden=t==="sales"; if(ex&&t==="sales") ex.hidden=true; if(t==="mine"&&typeof window.renderQuote==="function") try{ window.renderQuote(); }catch(e){} }
  tabs.addEventListener("click",e=>{ const b=e.target.closest("[data-pct]"); if(b) setTab(b.dataset.pct); });
  async function load(){ if(D) return; try{ const r=await fetch("premcmp.json?v="+Date.now().toString().slice(0,7)); D=await r.json(); }catch(e){ box.innerHTML='<p class="note err" style="margin:0">자료를 불러오지 못했습니다. 새로고침 후 다시 열어 주세요.</p>'; return; }
    G=D[0].g; ID=D[0].id; draw(); }
  const won=n=>n==null?"자료 없음":n.toLocaleString()+"원";
  function insAge(b){ const m=String(b||"").match(/^(\d{4})-?(\d{2})-?(\d{2})$/); if(!m) return null; const t=new Date(), y=+m[1], mo=+m[2], d=+m[3];
    let months=(t.getFullYear()-y)*12+(t.getMonth()+1-mo)-(t.getDate()<d?1:0); if(months<0||months>1200) return null; const full=Math.floor(months/12), rem=months%12; return {full,rem,ins:full+(rem>=6?1:0)}; }
  function drawPick(){
    const dx=D.filter(t=>t.parts), nl=dx.find(t=>t.id==="dx3_nl"), lf=dx.find(t=>t.id==="dx3_lf");
    const kinds=K.kind==="all"?[nl,lf]:[K.kind==="nl"?nl:lf];
    const allSets=[...new Set(dx.flatMap(t=>t.rows.map(r=>r.set)))]; if(!allSets.includes(K.set)) K.set=allSets[0];
    const a=insAge(K.birth), want=a?a.ins:40;
    const COV=["암 진단비 1천","유사암·소액암 2백","뇌혈관 진단비 1천","허혈성 진단비 1천"];
    const res=[]; let used=new Set();
    kinds.forEach(T=>{ if(!T) return; const rows=T.rows.filter(r=>r.set===K.set&&r.sex===SEX); if(!rows.length) return;
      const ages=[...new Set(rows.map(r=>r.age))]; const ag=ages.reduce((b,x)=>Math.abs(x-want)<Math.abs(b-want)?x:b,ages[0]); used.add(ag);
      const row=rows.find(r=>r.age===ag);
      T.cos.forEach((c,i)=>{ const v=row.v[i]; if(!v) return; const parts=K.cov.map(k=>v[k]); const miss=parts.some(x=>x==null);
        res.push({c,pr:row.p[i],sum:parts.reduce((t,x)=>t+(x||0),0),miss,kind:T.id==="dx3_nl"?"손보":"생보",ag,pg:row.pg}); }); });
    res.sort((x,y)=>x.miss-y.miss||x.sum-y.sum); const ok=res.filter(x=>!x.miss), mx=Math.max(1,...ok.map(x=>x.sum)), mn=ok.length?ok[0].sum:0;
    const ageTxt=[...used].sort((x,y)=>x-y).map(x=>x+"세").join("·");
    return `<div class="fgrid2"><div class="field"><label for="pc-birth">생년월일</label><input id="pc-birth" inputmode="numeric" maxlength="10" placeholder="예) 19780621" value="${esc(K.birth)}"></div>
      <div class="field"><label>성별</label><div class="seg">${[["M","남"],["F","여"]].map(([k,l])=>`<button class="btn" type="button" data-pcs="${k}" aria-pressed="${SEX===k}">${l}</button>`).join("")}</div></div></div>
      <p class="note" style="margin:4px 0 0">${a?`보험나이 ${a.ins}세 → 자료에 있는 가장 가까운 나이 <b>${ageTxt}</b> 보험료로 비교`:"생년월일을 넣지 않으면 40세 기준"}</p>
      <div class="field" style="margin-top:10px"><label>심사 유형</label><div class="seg" style="flex-wrap:wrap">${allSets.map(x=>`<button class="btn" type="button" data-pkset="${esc(x)}" aria-pressed="${K.set===x}">${esc(x.replace("일반심사","표준(일반심사)"))}</button>`).join("")}</div></div>
      <div class="field" style="margin-top:10px"><label>보험사</label><div class="seg">${[["all","전체"],["nl","손해보험"],["lf","생명보험"]].map(([k,l])=>`<button class="btn" type="button" data-pkkind="${k}" aria-pressed="${K.kind===k}">${l}</button>`).join("")}</div></div>
      <div class="field" style="margin-top:10px"><label>담보 (여러 개 선택)</label><div class="pc-chips">${COV.map((t,i)=>`<button class="btn" type="button" data-pkcov="${i+1}" aria-pressed="${K.cov.includes(i+1)}">${t}</button>`).join("")}</div></div>
      ${!K.cov.length?'<p class="note err">담보를 하나 이상 고르세요.</p>':!res.length?'<p class="note">이 조건의 자료가 없습니다.</p>':`<div class="pc-list">${res.map(x=>`<div class="pc-r${x.miss?" na":x.sum===mn?" best":""}"><span>${esc(x.c)}<small class="pc-pr">${esc(x.pr)}</small></span><span>${x.miss?"":`<i style="width:${Math.max(4,Math.round(x.sum/mx*100))}%"></i>`}</span><b>${x.miss?"선택 담보 없음":x.sum.toLocaleString()+"원"}</b></div>`).join("")}</div>`}
      <div class="pc-meta">고른 담보만 더한 대략적인 월 보험료입니다 (주계약·기본계약 보험료 제외)<br>조건: 20년납 100세만기 · 납입면제형 · 암·뇌·심 각 1천만원, 유사암(소액암) 2백만원${K.set!=="일반심사"&&K.set!=="건강고지(10년)"?" · 70세는 회사별로 뇌·허 1백만원 등 예외 있음":""}<br>출처: 2026-11 3대질병 진단비 보험료 비교 (2026.11.04 기준) · 판매자 교육용 자료 · 실제 보험료는 보험사 설계로 확인</div>`; }
  function draw(){ if(!D) return;
    const mt=`<div class="pc-tabs" style="margin-top:0;margin-bottom:12px"><button class="btn sm" type="button" data-pcm="pick" aria-pressed="${MODE==="pick"}">담보 골라 비교</button><button class="btn sm" type="button" data-pcm="table" aria-pressed="${MODE==="table"}">주제별 표 보기</button></div>`;
    if(MODE==="pick"){ box.innerHTML=mt+drawPick(); return; } if(TAB==="sales"&&ex) ex.hidden=true;
    const groups=[...new Set(D.map(t=>t.g))], tops=D.filter(t=>t.g===G), T=D.find(t=>t.id===ID)||tops[0]; ID=T.id;
    const sets=[...new Set(T.rows.map(r=>r.set))]; if(!sets.includes(SET)) SET=sets[0];
    const ages=[...new Set(T.rows.filter(r=>r.set===SET).map(r=>r.age))]; if(!ages.includes(AGE)) AGE=ages[0];
    const row=T.rows.find(r=>r.set===SET&&r.age===AGE&&r.sex===SEX);
    const val=x=>x==null?null:Array.isArray(x)?x[PART]:x;
    const items=T.cos.map((c,i)=>({c,v:row?val(row.v[i]):null,pr:row&&row.p?row.p[i]:"",part:row&&Array.isArray(row.v[i])&&PART===0&&row.v[i].slice(1).some(z=>z==null)})).filter(x=>!(T.parts&&x.v==null&&!(row&&row.v[T.cos.indexOf(x.c)]))).sort((a,b)=>(a.v==null)-(b.v==null)||a.v-b.v);
    const mx=Math.max(...items.map(x=>x.v||0)), mn=Math.min(...items.filter(x=>x.v!=null).map(x=>x.v));
    box.innerHTML=mt+`<div class="pc-chips">${groups.map(g=>`<button class="btn" type="button" data-pcg="${esc(g)}" aria-pressed="${g===G}">${esc(g)}</button>`).join("")}</div>
      ${tops.length>4?`<select id="pc-sel" style="margin-top:10px;width:100%;height:44px;border:1px solid var(--line);border-radius:10px;padding:0 10px;font:inherit;font-size:14px;background:var(--surface)">${tops.map(t=>`<option value="${t.id}" ${t.id===ID?"selected":""}>${esc(t.t)}</option>`).join("")}</select>`:`<div class="pc-tp">${tops.map(t=>`<button type="button" data-pci="${t.id}" aria-pressed="${t.id===ID}">${esc(t.t)}</button>`).join("")}</div>`}
      <div class="pc-ctl">
        <div class="seg">${[["M","남"],["F","여"]].map(([k,l])=>`<button class="btn" type="button" data-pcs="${k}" aria-pressed="${SEX===k}">${l}</button>`).join("")}</div>
        <div class="seg">${ages.map(a=>`<button class="btn" type="button" data-pca="${a}" aria-pressed="${AGE===a}">${a}세</button>`).join("")}</div>
        ${sets.length>1?(sets.length>4?`<select id="pc-set" style="height:40px;border:1px solid var(--line);border-radius:10px;padding:0 10px;font:inherit;font-size:14px;background:var(--surface)">${sets.map(s=>`<option ${SET===s?"selected":""}>${esc(s)}</option>`).join("")}</select>`:`<div class="seg">${sets.map(s=>`<button class="btn" type="button" data-pcx="${esc(s)}" aria-pressed="${SET===s}">${esc(s)}</button>`).join("")}</div>`):""}
        ${T.parts?`<div class="seg">${T.parts.map((t,i)=>`<button class="btn" type="button" data-pcp="${i}" aria-pressed="${PART===i}">${esc(t)}</button>`).join("")}</div>`:""}
      </div>
      <div class="pc-list">${items.map(x=>`<div class="pc-r${x.v==null?" na":x.v===mn?" best":""}"><span>${esc(x.c)}${x.pr?`<small class="pc-pr">${esc(x.pr)}</small>`:""}</span><span>${x.v!=null?`<i style="width:${Math.max(4,Math.round(x.v/mx*100))}%"></i>`:""}</span><b>${won(x.v)}${x.part?'<small class="pc-pr">일부 담보 없음</small>':""}</b></div>`).join("")}</div>
      <div class="pc-meta">월 보험료 · ${SEX==="M"?"남":"여"} ${AGE}세 · ${esc(SET)}${T.parts?" · "+esc(T.parts[PART]):""}<br>조건: ${esc(T.cond)}${T.note?`<br>주의: ${esc(T.note)}`:""}${T.notes&&T.notes[SET]?`<br>${T.notes[SET].map(esc).join("<br>")}`:""}<br>출처: ${esc(T.src)} p.${row&&row.pg?row.pg:T.p} (${T.src.startsWith("2026-10")?"09월 말":"2026.11.04"} 기준) · 판매자 교육용 자료 · 실제 보험료는 보험사 설계로 확인</div>`; }
  box.addEventListener("click",e=>{ const t=e.target.closest("button"); if(!t) return; const d=t.dataset;
    if(d.pcm){ MODE=d.pcm; } else if(d.pkset){ K.set=d.pkset; } else if(d.pkkind){ K.kind=d.pkkind; } else if(d.pkcov){ const v=+d.pkcov; K.cov=K.cov.includes(v)?K.cov.filter(x=>x!==v):[...K.cov,v].sort(); } else if(d.pcg){ G=d.pcg; ID=""; AGE=null; SET=null; PART=0; } else if(d.pci){ ID=d.pci; AGE=null; SET=null; PART=0; } else if(d.pcs) SEX=d.pcs; else if(d.pca) AGE=+d.pca; else if(d.pcx){ SET=d.pcx; AGE=null; } else if(d.pcp){ PART=+d.pcp; } else return; draw(); });
  box.addEventListener("input",e=>{ if(e.target.id==="pc-birth"){ const dg=e.target.value.replace(/\D/g,"").slice(0,8); e.target.value=dg.length>6?dg.slice(0,4)+"-"+dg.slice(4,6)+"-"+dg.slice(6):dg; if(dg.length===8){ K.birth=e.target.value; draw(); const i=box.querySelector("#pc-birth"); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length); } } else if(!dg.length){ K.birth=""; draw(); } } });
  box.addEventListener("change",e=>{ if(e.target.id==="pc-sel"){ ID=e.target.value; AGE=null; SET=null; PART=0; draw(); } if(e.target.id==="pc-set"){ SET=e.target.value; AGE=null; draw(); } });
  const obs=new MutationObserver(()=>{ if(!sec.hidden){ load(); if(TAB==="sales"){ grid.hidden=true; if(ex) ex.hidden=true; } } }); obs.observe(sec,{attributes:true,attributeFilter:["hidden"]});
  if(!sec.hidden) load();
})();
