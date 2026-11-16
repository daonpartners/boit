/* 보잇 · 가설계 — 판매자료(보험사별 판매전략)에 실린 회사별 보험료 표
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
  .pc-cv{display:grid;grid-template-columns:auto 1fr 6.5em;gap:6px 10px;align-items:center}.pc-cv label{font-size:14px;line-height:1.3}.pc-cv input[type=checkbox]{width:20px;height:20px;margin:0}
  .pc-cv .amt{display:flex;align-items:center;gap:4px}.pc-cv .amt input{width:100%;min-width:0;height:38px;border:1px solid var(--line);border-radius:8px;padding:0 8px;text-align:right;font:inherit;font-size:15px;background:var(--surface)}.pc-cv .amt small,.pc-cv .lim{font-size:12px;color:var(--muted)}
  .pc-cv .off{opacity:.4}.pc-gh{grid-column:1/-1;font-size:12.5px;font-weight:700;color:var(--muted);margin-top:8px}
  .pc-meta{margin-top:12px;font-size:12.5px;color:var(--muted);line-height:1.6}`;
  document.head.appendChild(css);
  /* 화면 틀: 하나의 가설계 화면 (예전 '내 보험료표'는 숨김) */
  const grid=q(".qt-grid"); if(!grid) return;
  const h1=q("h1"); if(h1) h1.textContent="가설계";
  const box=document.createElement("div"); box.className="panel"; box.id="pc-box"; box.style.marginTop="14px";
  box.innerHTML='<p class="note" style="margin:0">불러오는 중…</p>'; grid.before(box);
  grid.hidden=true; const ex=q("#qt-ex"); if(ex) ex.hidden=true;
  let D=null, G="", ID="", SEX="M", AGE=null, SET=null, PART=0, MODE="pick";
  const K={birth:"",kind:"all",set:"일반심사",amt:{}};
  async function load(){ if(D) return; try{ const r=await fetch("premcmp.json?v="+Date.now().toString().slice(0,7)); D=await r.json(); }catch(e){ box.innerHTML='<p class="note err" style="margin:0">자료를 불러오지 못했습니다. 새로고침 후 다시 열어 주세요.</p>'; return; }
    G=D[0].g; ID=D[0].id; draw(); }
  const won=n=>n==null?"자료 없음":n.toLocaleString()+"원";
  function insAge(b){ const m=String(b||"").match(/^(\d{4})-?(\d{2})-?(\d{2})$/); if(!m) return null; const t=new Date(), y=+m[1], mo=+m[2], d=+m[3];
    let months=(t.getFullYear()-y)*12+(t.getMonth()+1-mo)-(t.getDate()<d?1:0); if(months<0||months>1200) return null; const full=Math.floor(months/12), rem=months%12; return {full,rem,ins:full+(rem>=6?1:0)}; }
  let CV=null; const CVK=()=>CV.keys;
  async function loadCV(){ if(CV) return; try{ const r=await fetch("premcov.json?v="+Date.now().toString().slice(0,7)); CV=await r.json(); }catch(e){ CV={keys:[],groups:[]}; } draw(); }
  const SETORD=["일반심사","건강고지(10년)","간편 305","간편 315","간편 325","간편 335","간편 355","초경증 간편","어린이"];
  const BASE=t=>{ const m=String(t).match(/^(\d+)(천|백|만)$/); return m?+m[1]*({천:1000,백:100,만:1}[m[2]]):null; };
  function pickRes(){
    const KEYS=CVK(), kname=k=>(KEYS.find(x=>x[0]===k)||[k,k])[1], base=k=>BASE((KEYS.find(x=>x[0]===k)||[])[2]);
    const sel=Object.keys(K.amt).filter(k=>K.amt[k]!=null&&(base(k)==null||K.amt[k]>0));
    const sc=(k,v)=>{ const b=base(k); return b==null?v:Math.round(v*K.amt[k]/b/10)*10; };
    const a=insAge(K.birth), want=a?a.ins:40, used=new Set(), res=[];
    ["손보","생보"].forEach(kind=>{ if(K.kind!=="all"&&K.kind!==(kind==="손보"?"nl":"lf")) return;
      const gs=CV.groups.filter(g=>g.kind===kind&&g.set===K.set&&g.sex===SEX); if(!gs.length) return;
      const ag=gs.map(g=>g.age).reduce((b,x)=>Math.abs(x-want)<Math.abs(b-want)?x:b,gs[0].age); used.add(ag);
      const G=gs.find(g=>g.age===ag);
      Object.entries(G.cos).forEach(([co,e])=>{ const has=sel.filter(k=>e.v[k]!=null), miss=sel.filter(k=>e.v[k]==null); if(!has.length) return;
        const parts=has.map(k=>[k,sc(k,e.v[k])]); res.push({co,p:e.p,sum:parts.reduce((t,x)=>t+x[1],0),miss,parts,x:e.x}); }); });
    res.sort((x,y)=>(x.miss.length>0)-(y.miss.length>0)||x.sum-y.sum);
    const full=res.filter(x=>!x.miss.length), mx=Math.max(1,...full.map(x=>x.sum)), mn=full.length?full[0].sum:0;
    const ageTxt=[...used].sort((x,y)=>x-y).map(x=>x+"세").join("·");
    const kAges=k=>[...new Set(CV.groups.filter(g=>g.set===K.set&&g.sex===SEX&&Object.values(g.cos).some(e=>e.v[k]!=null)).map(g=>g.age))].sort((x,y)=>x-y);
    const ageWarn=sel.map(k=>[k,kAges(k)]).filter(([k,ags])=>ags.length&&![...used].some(u=>ags.includes(u))).map(([k,ags])=>`${kname(k)}: ${ags.join("·")}세 자료만 있음`);
    const xnote=x=>{ const n=[]; if(sel.includes("ctx")&&x.x.ctxname) n.push("암주치 "+x.x.ctxname); if(sel.includes("c2")&&x.x.c2name) n.push("뇌심주치 "+x.x.c2name);
      if(sel.includes("s5d")&&x.x.s5dlim) n.push("질병5종 "+x.x.s5dlim); if(sel.includes("s5i")&&x.x.s5ilim) n.push("상해5종 "+x.x.s5ilim); if((sel.includes("cared")||sel.includes("carei"))&&x.x.carelim) n.push("간병인 "+x.x.carelim); return n.join(" · "); };
    return `<p class="note" style="margin:0">${a?`보험나이 ${a.ins}세 → `:"생년월일이 없으면 40세 기준 · "}자료에 있는 가장 가까운 나이 <b>${ageTxt||"-"}</b> 기준</p>
      ${ageWarn.length?`<p class="note err" style="margin:6px 0 0">${ageWarn.map(esc).join("<br>")}</p>`:""}
      ${!sel.length?'<p class="note err">담보를 하나 이상 고르세요.</p>':!res.length?'<p class="note">이 조건의 자료가 없습니다.</p>':`<div class="pc-list">${res.map(x=>`<div class="pc-r${x.miss.length?" na":x.sum===mn?" best":""}"><span>${esc(x.co)}${x.p?`<small class="pc-pr">${esc(x.p)}</small>`:""}<small class="pc-pr">${x.parts.map(([k,v])=>esc(kname(k))+(base(k)!=null?`(${K.amt[k].toLocaleString()}만)`:"")+" "+v.toLocaleString()+"원").join(" · ")}</small>${xnote(x)?`<small class="pc-pr">${esc(xnote(x))}</small>`:""}${x.miss.length?`<small class="pc-pr">자료 없음: ${x.miss.map(k=>kname(k)+(x.x[k]?` (원문 ${x.x[k]})`:"")).map(esc).join(", ")}</small>`:""}</span><span>${x.miss.length?"":`<i style="width:${Math.max(4,Math.round(x.sum/mx*100))}%"></i>`}</span><b>${x.sum.toLocaleString()}원</b></div>`).join("")}</div>`}`; }
  function drawPick(){
    if(!CV){ loadCV(); return '<p class="note">불러오는 중…</p>'; }
    const KEYS=CVK();
    const sets=SETORD.filter(x=>CV.groups.some(g=>g.set===x)); if(!sets.includes(K.set)) K.set=sets[0];
    if(!K.init){ K.init=1; ["cancer","sim","brain","heart"].forEach(k=>{ const r=KEYS.find(x=>x[0]===k); if(r) K.amt[k]=BASE(r[2]); }); }
    const avail=new Set(CV.groups.filter(g=>g.set===K.set&&g.sex===SEX&&(K.kind==="all"||g.kind===(K.kind==="nl"?"손보":"생보"))).flatMap(g=>Object.values(g.cos).flatMap(e=>Object.keys(e.v))));
    const grp=[...new Set(KEYS.map(k=>k[3]))];
    return `<div class="fgrid2"><div class="field"><label for="pc-birth">생년월일</label><input id="pc-birth" inputmode="numeric" maxlength="10" placeholder="예) 19850315" value="${esc(K.birth)}"></div>
      <div class="field"><label>성별</label><div class="seg">${[["M","남"],["F","여"]].map(([k,l])=>`<button class="btn" type="button" data-pcs="${k}" aria-pressed="${SEX===k}">${l}</button>`).join("")}</div></div></div>
      <div class="field" style="margin-top:10px"><label>심사 유형</label><div class="seg" style="flex-wrap:wrap">${sets.map(x=>`<button class="btn" type="button" data-pkset="${esc(x)}" aria-pressed="${K.set===x}">${esc(x.replace("일반심사","표준(일반심사)").replace("어린이","어린이(10세)"))}</button>`).join("")}</div></div>
      <div class="field" style="margin-top:10px"><label>보험사</label><div class="seg">${[["all","전체"],["nl","손해보험"],["lf","생명보험"]].map(([k,l])=>`<button class="btn" type="button" data-pkkind="${k}" aria-pressed="${K.kind===k}">${l}</button>`).join("")}</div></div>
      <div class="field" style="margin-top:12px"><label>담보 · 가입금액(만원)</label><div class="pc-cv">${grp.map(gn=>`<div class="pc-gh">${esc(gn)}</div>${KEYS.filter(k=>k[3]===gn).map(k=>{ const on=K.amt[k[0]]!=null, ok=avail.has(k[0]), b=BASE(k[2]);
        return `<input type="checkbox" id="pk-${k[0]}" data-pkcov="${k[0]}" ${on?"checked":""} ${ok?"":"disabled"} class="${ok?"":"off"}"><label for="pk-${k[0]}" class="${ok?"":"off"}">${esc(k[1])}</label>${b==null?`<span class="lim${ok?"":" off"}">회사별 한도</span>`:`<span class="amt${ok?"":" off"}"><input inputmode="numeric" data-pkamt="${k[0]}" value="${on?K.amt[k[0]]:""}" placeholder="${b}" ${on?"":"disabled"} aria-label="${esc(k[1])} 가입금액"><small>만</small></span>`}`; }).join("")}`).join("")}</div></div>
      <div id="pc-res" style="margin-top:12px">${pickRes()}</div>
      <div class="pc-meta">고른 담보만 더한 대략적인 월 보험료 (주계약·기본계약 제외). 판매자료의 기준 가입금액 보험료를 입력한 금액에 비례해 환산했습니다. '회사별 한도' 담보는 회사마다 가입금액이 달라 자료 금액 그대로입니다.<br>주의: 주요치료비는 회사마다 10년갱신·만기 등 구조가 달라 담보명을 함께 확인<br>조건: 20년납 100세만기 · 납입면제형(무해약형) · 1급 기준<br>출처: ${esc(CV.month)} 생명·손해보험 비교가이드북, 3대질병 진단비 보험료 비교 (보험료 기준일 ${esc(CV.base)}) · 판매자 교육용 자료 · 실제 보험료는 보험사 설계로 확인</div>
      <button class="btn sm" type="button" data-pcm="table" style="margin-top:10px">판매자료 표 보기</button>`; }
  function draw(){ if(!D) return;
    const mt=`<button class="btn sm" type="button" data-pcm="pick" style="margin-bottom:12px">← 가설계</button>`;
    if(MODE==="pick"){ box.innerHTML=drawPick(); return; }
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
      <div class="pc-meta">월 보험료 · ${SEX==="M"?"남":"여"} ${AGE}세 · ${esc(SET)}${T.parts?" · "+esc(T.parts[PART]):""}<br>조건: ${esc(T.cond)}${T.note?`<br>주의: ${esc(T.note)}`:""}${T.notes&&T.notes[SET]?`<br>${T.notes[SET].map(esc).join("<br>")}`:""}<br>출처: ${esc(T.src)} p.${row&&row.pg?row.pg:T.p} (${T.base?esc(T.base):"09월 말"} 기준) · 판매자 교육용 자료 · 실제 보험료는 보험사 설계로 확인</div>`; }
  box.addEventListener("click",e=>{ const t=e.target.closest("button"); if(!t) return; const d=t.dataset;
    if(d.pcm){ MODE=d.pcm; } else if(d.pkset){ K.set=d.pkset; } else if(d.pkkind){ K.kind=d.pkkind; } else if(d.pcg){ G=d.pcg; ID=""; AGE=null; SET=null; PART=0; } else if(d.pci){ ID=d.pci; AGE=null; SET=null; PART=0; } else if(d.pcs) SEX=d.pcs; else if(d.pca) AGE=+d.pca; else if(d.pcx){ SET=d.pcx; AGE=null; } else if(d.pcp){ PART=+d.pcp; } else return; draw(); });
  const res=()=>{ const r=box.querySelector("#pc-res"); if(r) r.innerHTML=pickRes(); };
  box.addEventListener("input",e=>{ const t=e.target;
    if(t.id==="pc-birth"){ const dg=t.value.replace(/\D/g,"").slice(0,8); t.value=dg.length>6?dg.slice(0,4)+"-"+dg.slice(4,6)+"-"+dg.slice(6):dg.length>4?dg.slice(0,4)+"-"+dg.slice(4):dg; if(dg.length===8){ K.birth=t.value; res(); } else if(!dg.length){ K.birth=""; res(); } return; }
    if(t.dataset.pkamt){ const v=t.value.replace(/\D/g,""); t.value=v; K.amt[t.dataset.pkamt]=+v||0; res(); } });
  box.addEventListener("change",e=>{ const t=e.target; if(!t.dataset||!t.dataset.pkcov) return; const k=t.dataset.pkcov, r=CVK().find(x=>x[0]===k), b=BASE(r[2]);
    if(t.checked) K.amt[k]=b; else delete K.amt[k];
    const i=box.querySelector(`[data-pkamt="${k}"]`); if(i){ i.disabled=!t.checked; i.value=t.checked?b:""; } res(); });
  box.addEventListener("change",e=>{ if(e.target.id==="pc-sel"){ ID=e.target.value; AGE=null; SET=null; PART=0; draw(); } if(e.target.id==="pc-set"){ SET=e.target.value; AGE=null; draw(); } });
  const obs=new MutationObserver(()=>{ if(!sec.hidden){ load(); grid.hidden=true; if(ex) ex.hidden=true; } }); obs.observe(sec,{attributes:true,attributeFilter:["hidden"]});
  if(!sec.hidden) load();
})();
