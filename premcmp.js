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
  .pc-r{display:grid;grid-template-columns:minmax(84px,7.5em) 1fr auto;gap:8px;align-items:center;font-size:14px}
  .pc-r i{display:block;height:10px;border-radius:3px;background:var(--accent);opacity:.35}.pc-r.best i{opacity:1}.pc-r.best b{color:var(--ok)}
  .pc-r b{font-variant-numeric:tabular-nums;white-space:nowrap}.pc-r.na{color:var(--muted)}
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
  let D=null, G="", ID="", SEX="M", AGE=null, SET=null, TAB="sales";
  function setTab(t){ TAB=t; tabs.querySelectorAll("[data-pct]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.pct===t)); box.hidden=t!=="sales"; grid.hidden=t==="sales"; if(ex&&t==="sales") ex.hidden=true; if(t==="mine"&&typeof window.renderQuote==="function") try{ window.renderQuote(); }catch(e){} }
  tabs.addEventListener("click",e=>{ const b=e.target.closest("[data-pct]"); if(b) setTab(b.dataset.pct); });
  async function load(){ if(D) return; try{ const r=await fetch("premcmp.json?v=1"); D=await r.json(); }catch(e){ box.innerHTML='<p class="note err" style="margin:0">자료를 불러오지 못했습니다. 새로고침 후 다시 열어 주세요.</p>'; return; }
    G=D[0].g; ID=D[0].id; draw(); }
  const won=n=>n==null?"자료 없음":n.toLocaleString()+"원";
  function draw(){ if(!D) return; if(TAB==="sales"&&ex) ex.hidden=true;
    const groups=[...new Set(D.map(t=>t.g))], tops=D.filter(t=>t.g===G), T=D.find(t=>t.id===ID)||tops[0]; ID=T.id;
    const sets=[...new Set(T.rows.map(r=>r.set))]; if(!sets.includes(SET)) SET=sets[0];
    const ages=[...new Set(T.rows.filter(r=>r.set===SET).map(r=>r.age))]; if(!ages.includes(AGE)) AGE=ages[0];
    const row=T.rows.find(r=>r.set===SET&&r.age===AGE&&r.sex===SEX);
    const items=T.cos.map((c,i)=>({c,v:row?row.v[i]:null})).sort((a,b)=>(a.v==null)-(b.v==null)||a.v-b.v);
    const mx=Math.max(...items.map(x=>x.v||0)), mn=Math.min(...items.filter(x=>x.v!=null).map(x=>x.v));
    box.innerHTML=`<div class="pc-chips">${groups.map(g=>`<button class="btn" type="button" data-pcg="${esc(g)}" aria-pressed="${g===G}">${esc(g)}</button>`).join("")}</div>
      ${tops.length>4?`<select id="pc-sel" style="margin-top:10px;width:100%;height:44px;border:1px solid var(--line);border-radius:10px;padding:0 10px;font:inherit;font-size:14px;background:var(--surface)">${tops.map(t=>`<option value="${t.id}" ${t.id===ID?"selected":""}>${esc(t.t)}</option>`).join("")}</select>`:`<div class="pc-tp">${tops.map(t=>`<button type="button" data-pci="${t.id}" aria-pressed="${t.id===ID}">${esc(t.t)}</button>`).join("")}</div>`}
      <div class="pc-ctl">
        <div class="seg">${[["M","남"],["F","여"]].map(([k,l])=>`<button class="btn" type="button" data-pcs="${k}" aria-pressed="${SEX===k}">${l}</button>`).join("")}</div>
        <div class="seg">${ages.map(a=>`<button class="btn" type="button" data-pca="${a}" aria-pressed="${AGE===a}">${a}세</button>`).join("")}</div>
        ${sets.length>1?`<div class="seg">${sets.map(s=>`<button class="btn" type="button" data-pcx="${esc(s)}" aria-pressed="${SET===s}">${esc(s)}</button>`).join("")}</div>`:""}
      </div>
      <div class="pc-list">${items.map(x=>`<div class="pc-r${x.v==null?" na":x.v===mn?" best":""}"><span>${esc(x.c)}</span><span>${x.v!=null?`<i style="width:${Math.max(4,Math.round(x.v/mx*100))}%"></i>`:""}</span><b>${won(x.v)}</b></div>`).join("")}</div>
      <div class="pc-meta">월 보험료 · ${SEX==="M"?"남":"여"} ${AGE}세 · ${esc(SET)}<br>조건: ${esc(T.cond)}${T.note?`<br>주의: ${esc(T.note)}`:""}<br>출처: ${esc(T.src)} p.${T.p} (09월 말 기준) · 판매자 교육용 자료 · 실제 보험료는 보험사 설계로 확인</div>`; }
  box.addEventListener("click",e=>{ const t=e.target.closest("button"); if(!t) return; const d=t.dataset;
    if(d.pcg){ G=d.pcg; ID=""; AGE=null; SET=null; } else if(d.pci){ ID=d.pci; AGE=null; SET=null; } else if(d.pcs) SEX=d.pcs; else if(d.pca) AGE=+d.pca; else if(d.pcx){ SET=d.pcx; AGE=null; } else return; draw(); });
  box.addEventListener("change",e=>{ if(e.target.id==="pc-sel"){ ID=e.target.value; AGE=null; SET=null; draw(); } });
  const obs=new MutationObserver(()=>{ if(!sec.hidden){ load(); if(TAB==="sales"){ grid.hidden=true; if(ex) ex.hidden=true; } } }); obs.observe(sec,{attributes:true,attributeFilter:["hidden"]});
  if(!sec.hidden) load();
})();
