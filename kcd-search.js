/* 보잇 · 고지의무 직접 입력 — 병명으로 상병코드 찾기 (2026-11-19)
   자료: 건강보험심사평가원_상병마스터 (공공데이터포털 15067467, 2026-03-31 기준) → kcd.json [[상병기호, 한글명], ...]
   병명 칸(#dsn-n)에 2글자 이상 치면 후보가 뜨고, 고르면 상병코드(#dsn-c)·병명이 함께 들어감 */
(function(){
"use strict";
let DATA=null, loading=null;
const load=()=>DATA?Promise.resolve(DATA):(loading=loading||fetch("kcd.json?v=20260331").then(r=>r.json()).then(a=>(DATA=a)));
/* 설계사·고객이 흔히 쓰는 말 → 상병코드 앞자리 (결과 이름은 심평원 공식 명칭으로 표시) */
const ALIAS={"디스크":["M51","M50"],"허리디스크":["M51"],"목디스크":["M50"],"오십견":["M750"],"대상포진":["B02"],"치질":["K64"],"치핵":["K64"],
 "용종":["K635","K621","K317","D12"],"대장용종":["K635","D12"],"위용종":["K317"],"위염":["K29"],"역류성식도염":["K21"],"식도염":["K20","K21"],
 "고지혈증":["E78"],"통풍":["M10"],"공황장애":["F410"],"우울증":["F32","F33"],"불면증":["G470","F510"],"비염":["J30","J31"],"축농증":["J32"],
 "손목터널증후군":["G560"],"족저근막염":["M722"],"하지정맥류":["I83"],"담석":["K80"],"요로결석":["N20"],"신장결석":["N200"],
 "충치":["K02"],"치주염":["K05"],"풍치":["K05"],"백내장":["H25","H26"],"녹내장":["H40"],"갑상선결절":["E041"],"자궁근종":["D25"],
 "고혈압":["I10"],"당뇨":["E11","E14"],"협심증":["I20"],"심근경색":["I21"],"뇌경색":["I63"],"뇌출혈":["I61"],"편두통":["G43"],
 "골다공증":["M80","M81"],"퇴행성관절염":["M17","M16","M19"],"무릎관절염":["M17"],"회전근개파열":["M751"],"테니스엘보":["M771"],"아토피":["L20"],"건선":["L40"]};
const dot=c=>c.length>3?c.slice(0,3)+"."+c.slice(3):c;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const norm=s=>String(s||"").replace(/\s+/g,"").toLowerCase();
function search(q){ const n=norm(q); if(n.length<2||!DATA) return [];
  const code=/^[a-z]\d/i.test(n)?n.toUpperCase().replace(/\./g,""):"";
  const al=Object.keys(ALIAS).filter(k=>k.startsWith(n)||n.startsWith(k)).flatMap(k=>ALIAS[k]);
  const hit=[]; for(const r of DATA){ const nm=norm(r[1]);
    let sc=code?(r[0].startsWith(code)?r[0].length:-1):(nm===n?0:nm.startsWith(n)?1:nm.includes(n)?2+nm.length/100:-1);
    if(sc<0&&al.length&&al.some(p=>r[0].startsWith(p))) sc=1.5+r[0].length/10;
    if(sc>=0) hit.push([sc,r]); }
  hit.sort((a,b)=>a[0]-b[0]||a[1][0].localeCompare(b[1][0]));
  const seen=new Set(), out=[]; for(const [,r] of hit){ const k=r[0]+"|"+r[1]; if(seen.has(k)) continue; seen.add(k); out.push(r); if(out.length>=30) break; }
  return out; }
let box=null, list=[], cur=-1;
function close(){ if(box) box.hidden=true; cur=-1; }
function show(inp){ if(!box){ box=document.createElement("div"); box.id="kcd-box"; box.setAttribute("role","listbox"); document.body.appendChild(box);
    box.addEventListener("mousedown",e=>{ const it=e.target.closest("[data-k]"); if(!it) return; e.preventDefault(); pick(+it.dataset.k); }); }
  const r=inp.getBoundingClientRect(); box.style.left=(r.left+scrollX)+"px"; box.style.top=(r.bottom+scrollY+2)+"px";
  box.innerHTML=list.length?list.map((x,i)=>`<div data-k="${i}" class="${i===cur?"on":""}"><b>${dot(x[0])}</b><span>${esc(x[1])}</span></div>`).join("")
    :`<p>${DATA?"맞는 병명이 없습니다. 그대로 입력해도 됩니다.":"병명 목록 불러오는 중…"}</p>`;
  box.hidden=false; }
function pick(i){ const x=list[i]; if(!x) return; const c=document.getElementById("dsn-c"), n=document.getElementById("dsn-n");
  if(c) c.value=dot(x[0]); if(n) n.value=x[1]; close(); const t=document.getElementById("dsn-t"); if(t) t.focus(); }
let tm=0;
document.addEventListener("input",e=>{ const t=e.target; if(t.id!=="dsn-n"&&t.id!=="dsn-c") return; clearTimeout(tm);
  tm=setTimeout(async()=>{ if(t.value.trim().length<2){ close(); return; } show(t); await load().catch(()=>null); list=search(t.value); cur=-1; if(document.activeElement===t) show(t); },150); });
document.addEventListener("keydown",e=>{ const t=e.target; if((t.id!=="dsn-n"&&t.id!=="dsn-c")||!box||box.hidden) return;
  if(e.key==="ArrowDown"){ cur=Math.min(list.length-1,cur+1); show(t); e.preventDefault(); }
  else if(e.key==="ArrowUp"){ cur=Math.max(0,cur-1); show(t); e.preventDefault(); }
  else if(e.key==="Enter"&&cur>=0){ pick(cur); e.preventDefault(); }
  else if(e.key==="Escape") close(); });
document.addEventListener("focusout",e=>{ if(e.target.id==="dsn-n"||e.target.id==="dsn-c") setTimeout(close,150); });
document.addEventListener("focusin",e=>{ if(e.target.id==="dsn-n") load().catch(()=>null); });
const st=document.createElement("style"); st.textContent=`
#kcd-box{position:absolute;z-index:9999;width:min(460px,92vw);max-height:320px;overflow:auto;background:var(--surface,#fff);color:var(--fg,#1F2A2A);border:1px solid var(--line,#DDE3E1);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.15);font-size:14px}
#kcd-box div{display:flex;gap:10px;padding:8px 12px;cursor:pointer;border-bottom:1px solid var(--line,#EEF1F0)}#kcd-box div:hover,#kcd-box div.on{background:var(--accent-soft,#E7F2EE)}
#kcd-box b{min-width:56px;color:var(--accent,#1F6F5C)}#kcd-box p{margin:0;padding:10px 12px;color:#7A8583}`;
document.head.appendChild(st);
})();
