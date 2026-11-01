/* 보잇 · 주민등록번호 뒷자리 보관·보기 (2026-11-01, 대표 지시 — 출시 전 변호사 검토 대상)
   - 설계사가 정한 '보안 비밀번호'(8자 이상, 영문+숫자)로 브라우저에서 암호화(PBKDF2 310,000회 → AES-GCM 256) → 고객정보에는 암호문만 저장
   - 보안 비밀번호는 어디에도 저장하지 않음 → 다온파트너스 서버·관리자도 뒷자리를 볼 수 없음. 잊으면 복구 불가(재설정 시 저장된 뒷자리 모두 삭제)
   - [뒷자리 보기]: 30초 표시 후 다시 가림. 잠금 해제는 5분 유지. 보기·저장·청구 자동입력·삭제는 열람 기록(ME.rrnLog)에 남김
   - 처음 켤 때 이용 규정 동의(날짜 기록)
   저장 위치: 고객 c.rrnB={enc,iv} (뒷자리 7자리 암호문), 설계사 ME.rrnLock={salt,chk,agreedAt,v}, ME.rrnLog=[{at,cust,name,act}] */
(function(){
  if(typeof ME==="undefined"||typeof CUSTOMERS==="undefined") return;
  const q=s=>document.querySelector(s);
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const dg=s=>String(s||"").replace(/\D/g,"");
  const te=new TextEncoder(), td=new TextDecoder();
  const b64e=a=>btoa(String.fromCharCode(...new Uint8Array(a))), b64d=x=>Uint8Array.from(atob(x),c=>c.charCodeAt(0));
  const ITER=310000, CHK="boit-rrn-ok", UNLOCK_MS=5*60e3, SHOW_MS=30e3;
  let KEY=null, KEY_AT=0;
  const uid=()=>(typeof CLOUD!=="undefined"&&CLOUD.user&&CLOUD.user.id)||"demo";

  /* ---- 저장: 설계사 설정을 클라우드 스냅샷에 포함 ---- */
  if(typeof cloudSnap==="function"){ const orig=cloudSnap; window.cloudSnap=cloudSnap=function(){ const s=orig.apply(this,arguments); if(s&&s.me){ s.me.rrnLock=ME.rrnLock||null; s.me.rrnLog=(ME.rrnLog||[]).slice(-500); } return s; }; }
  const save=()=>{ if(typeof cloudSave==="function") try{ cloudSave(true); }catch(_){} };
  function log(c,act){ (ME.rrnLog=ME.rrnLog||[]).push({at:new Date().toISOString(),cust:c?c.id:null,name:c?c.name:"",act}); if(ME.rrnLog.length>500) ME.rrnLog.splice(0,ME.rrnLog.length-500); }

  /* ---- 암호 ---- */
  async function derive(pin,salt){ const base=await crypto.subtle.importKey("raw",te.encode(pin),"PBKDF2",false,["deriveKey"]);
    return crypto.subtle.deriveKey({name:"PBKDF2",salt:te.encode(uid()+":"+salt),iterations:ITER,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]); }
  async function enc(key,txt){ const iv=crypto.getRandomValues(new Uint8Array(12)); const ct=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,te.encode(txt)); return {enc:b64e(ct),iv:b64e(iv)}; }
  async function dec(key,o){ return td.decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:b64d(o.iv)},key,b64d(o.enc))); }
  const unlocked=()=>KEY&&Date.now()-KEY_AT<UNLOCK_MS;

  /* ---- 창 ---- */
  function modal(html){ let m=q("#rrn-modal"); if(!m){ m=document.createElement("div"); m.id="rrn-modal"; m.style.cssText="position:fixed;inset:0;background:rgba(10,20,16,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px"; document.body.appendChild(m); }
    m.innerHTML=`<div class="panel" role="dialog" aria-modal="true" style="max-width:460px;width:100%;max-height:90vh;overflow:auto;display:flex;flex-direction:column;gap:10px">${html}</div>`; m.hidden=false; m.onclick=e=>{ if(e.target===m) close(); }; return m; }
  function close(){ const m=q("#rrn-modal"); if(m) m.hidden=true; }
  const RULES=`<div class="note" style="margin:0;max-height:220px;overflow:auto;line-height:1.65">
    <b>주민등록번호 뒷자리 보관 이용 규정</b><br>
    1. 이 기능은 보험 계약 관리·보험금 청구 등 보험 업무에 필요한 범위에서만 사용합니다.<br>
    2. 고객에게 주민등록번호 보관 목적·기간을 알리고 동의를 받은 경우에만 저장합니다. 고객이 삭제를 원하면 바로 삭제합니다.<br>
    3. 주민등록번호의 처리 근거(법령)와 고객 동의 확인 책임은 고객정보를 처리하는 설계사(및 소속 회사)에게 있습니다. 다온파트너스는 암호화된 값을 보관만 하며 내용을 볼 수 없습니다.<br>
    4. 보안 비밀번호는 다른 사람에게 알려 주지 않습니다. 잊으면 저장된 뒷자리를 되살릴 수 없습니다.<br>
    5. 보기·저장·청구 자동입력·삭제는 열람 기록으로 남습니다.<br>
    6. 이 기능은 시범 운영 중이며, 관련 법령 검토 결과에 따라 변경되거나 중단될 수 있습니다.</div>`;

  // 잠금 해제(없으면 처음 설정) → key
  function unlock(){ return new Promise(res=>{
    if(unlocked()){ KEY_AT=Date.now(); return res(KEY); }
    const L=ME.rrnLock;
    if(!L){ // 처음 설정
      modal(`<h2 style="margin:0">주민번호 뒷자리 보관 켜기</h2>${RULES}
        <label class="row note" style="gap:8px;margin:0"><input type="checkbox" id="rl-ag"> 위 이용 규정을 읽고 동의합니다</label>
        <div class="field"><label for="rl-p1">보안 비밀번호 (8자 이상, 영문+숫자)</label><input id="rl-p1" type="password" autocomplete="new-password" maxlength="40"></div>
        <div class="field"><label for="rl-p2">보안 비밀번호 확인</label><input id="rl-p2" type="password" autocomplete="new-password" maxlength="40"></div>
        <p class="note" style="margin:0">로그인 비밀번호와 다른 것으로 정하세요. 보잇·다온파트너스도 이 비밀번호를 모르며, 잊으면 저장한 뒷자리를 다시 볼 수 없습니다.</p>
        <p class="note err" id="rl-msg" style="margin:0"></p>
        <div class="row" style="gap:8px"><button class="btn primary" type="button" id="rl-ok">켜기</button><button class="btn" type="button" id="rl-x">취소</button></div>`);
      q("#rl-x").onclick=()=>{ close(); res(null); };
      q("#rl-ok").onclick=async()=>{ const p1=q("#rl-p1").value, p2=q("#rl-p2").value, m=q("#rl-msg");
        if(!q("#rl-ag").checked){ m.textContent="이용 규정에 동의해 주세요."; return; }
        if(p1.length<8||!/[A-Za-z]/.test(p1)||!/\d/.test(p1)){ m.textContent="8자 이상, 영문과 숫자를 섞어 주세요."; return; }
        if(p1!==p2){ m.textContent="두 번 입력한 비밀번호가 다릅니다."; return; }
        m.textContent="설정 중…"; const salt=b64e(crypto.getRandomValues(new Uint8Array(16))); const k=await derive(p1,salt);
        ME.rrnLock={v:1,salt,chk:await enc(k,CHK),agreedAt:new Date().toISOString()}; log(null,"보관 켜기·규정 동의"); save();
        KEY=k; KEY_AT=Date.now(); close(); res(k); };
      return;
    }
    modal(`<h2 style="margin:0">보안 비밀번호</h2>
      <div class="field"><label for="rl-p">주민번호 뒷자리를 열려면 보안 비밀번호를 넣으세요</label><input id="rl-p" type="password" autocomplete="current-password" maxlength="40"></div>
      <p class="note err" id="rl-msg" style="margin:0"></p>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn primary" type="button" id="rl-ok">확인</button><button class="btn" type="button" id="rl-x">취소</button><button class="lnk" type="button" id="rl-reset" style="margin-left:auto">비밀번호를 잊었어요</button></div>`);
    const inp=q("#rl-p"); inp.focus();
    const go=async()=>{ const m=q("#rl-msg"); m.textContent="확인 중…";
      try{ const k=await derive(inp.value,L.salt); if(await dec(k,L.chk)!==CHK) throw 0; KEY=k; KEY_AT=Date.now(); close(); res(k); }
      catch(e){ m.textContent="보안 비밀번호가 맞지 않습니다."; } };
    q("#rl-ok").onclick=go; inp.onkeydown=e=>{ if(e.key==="Enter") go(); };
    q("#rl-x").onclick=()=>{ close(); res(null); };
    q("#rl-reset").onclick=()=>{ const n=CUSTOMERS.filter(c=>c.rrnB).length;
      if(!confirm(`보안 비밀번호를 새로 정하면 지금까지 저장한 뒷자리 ${n}명분이 모두 삭제됩니다 (다시 볼 방법이 없기 때문). 계속할까요?`)) return;
      CUSTOMERS.forEach(c=>{ delete c.rrnB; }); ME.rrnLock=null; KEY=null; log(null,`비밀번호 재설정·뒷자리 ${n}명 삭제`); save(); close(); unlock().then(res); };
  }); }

  /* ---- 고객 기본정보 표: [뒷자리 보기 / 저장 / 삭제] ---- */
  if(typeof renderCInfo==="function"){ const orig=renderCInfo; window.renderCInfo=renderCInfo=function(c){ orig.apply(this,arguments);
      const dd=[...document.querySelectorAll("#cd-info dt")].find(x=>x.textContent==="주민등록번호"); if(!dd||!dd.nextElementSibling) return; const cell=dd.nextElementSibling;
      const r7=dg(c.rrn7||"");
      cell.insertAdjacentHTML("beforeend",` <span class="row" style="display:inline-flex;gap:6px;margin-left:6px;vertical-align:middle">${c.rrnB?`<button class="btn sm" type="button" data-rrnv="${c.id}">뒷자리 보기</button><button class="lnk" type="button" data-rrnd="${c.id}">삭제</button>`:`<button class="btn sm" type="button" data-rrns="${c.id}">뒷자리 저장</button>`}${ME.rrnLock?`<button class="lnk" type="button" data-rrnlog="1">열람 기록</button>`:""}</span>${c.rrnB?"":(r7.length===7?"":' <span class="note">(앞 7자리를 먼저 넣으면 함께 확인할 수 있습니다)</span>')}`);
    }; }
  async function view(c,btn){ const k=await unlock(); if(!k) return;
    try{ const back=await dec(k,c.rrnB); const front=dg(c.rrn7||"").slice(0,6)||dg(c.birth||"").slice(2,8); log(c,"보기"); save();
      const cell=btn.closest("dd"), span=cell.querySelector(".num"); const old=span?span.textContent:"";
      if(span){ span.textContent=`${front}-${back}`; span.style.color="var(--bad)"; }
      btn.disabled=true; btn.textContent="30초 뒤 가림";
      setTimeout(()=>{ if(span){ span.textContent=old; span.style.color=""; } btn.disabled=false; btn.textContent="뒷자리 보기"; },SHOW_MS);
    }catch(e){ alert("이 고객의 뒷자리를 열지 못했습니다. 다른 보안 비밀번호로 저장된 값일 수 있습니다."); } }
  function askBack(c){ return new Promise(res=>{
    const r7=dg(c.rrn7||"");
    modal(`<h2 style="margin:0">${esc(c.name)} 고객 주민번호 뒷자리 저장</h2>
      <div class="field"><label for="rl-b">주민등록번호 뒷자리 7자리</label><input id="rl-b" inputmode="numeric" maxlength="7" autocomplete="off" placeholder="${r7.length===7?r7[6]+"******":"0000000"}"></div>
      <label class="row note" style="gap:8px;margin:0"><input type="checkbox" id="rl-cag"> 고객에게 보관 목적(보험 계약 관리·보험금 청구)과 기간을 알리고 동의를 받았습니다</label>
      <p class="note err" id="rl-msg" style="margin:0"></p>
      <div class="row" style="gap:8px"><button class="btn primary" type="button" id="rl-ok">암호화해서 저장</button><button class="btn" type="button" id="rl-x">취소</button></div>`);
    q("#rl-b").focus(); q("#rl-x").onclick=()=>{ close(); res(null); };
    q("#rl-ok").onclick=()=>{ const v=dg(q("#rl-b").value), m=q("#rl-msg");
      if(v.length!==7){ m.textContent="뒷자리 7자리를 입력하세요."; return; }
      if(r7.length===7&&v[0]!==r7[6]){ m.textContent=`앞 7자리의 성별 숫자(${r7[6]})와 뒷자리 첫 숫자가 다릅니다.`; return; }
      if(!q("#rl-cag").checked){ m.textContent="고객 동의를 확인해 주세요."; return; }
      close(); res(v); };
  }); }
  async function store(c){ const k=await unlock(); if(!k) return; const v=await askBack(c); if(!v) return;
    c.rrnB=await enc(k,v); c.rrnAgree=new Date().toISOString().slice(0,10); if(!dg(c.rrn7||"")&&dg(c.birth||"").length===8) c.rrn7=dg(c.birth).slice(2,8)+v[0];
    log(c,"저장"); save(); if(typeof renderCust==="function") renderCust(); }
  document.addEventListener("click",e=>{
    const v=e.target.closest("[data-rrnv]"), s=e.target.closest("[data-rrns]"), d=e.target.closest("[data-rrnd]");
    const c=CUSTOMERS.find(x=>x.id===+((v||s||d||{}).dataset||{})[v?"rrnv":s?"rrns":"rrnd"]);
    if(v&&c) view(c,v); if(s&&c) store(c);
    if(d&&c&&confirm(`${c.name} 고객의 저장된 주민번호 뒷자리를 삭제할까요?`)){ delete c.rrnB; delete c.rrnAgree; log(c,"삭제"); save(); if(typeof renderCust==="function") renderCust(); }
  });

  /* ---- 보상청구: 고객을 고르면 [저장된 주민번호 넣기] ---- */
  function claimBtn(){ const inp=q("#cl-rrn"); if(!inp||q("#rrn-fill")) return;
    const c=(typeof S!=="undefined"&&S.cl&&S.cl.custId)?CUSTOMERS.find(x=>x.id===S.cl.custId):null; if(!c||!c.rrnB) return;
    const b=document.createElement("button"); b.type="button"; b.id="rrn-fill"; b.className="btn sm"; b.textContent="저장된 주민번호 넣기"; b.style.marginTop="6px";
    inp.insertAdjacentElement("afterend",b);
    b.onclick=async()=>{ const k=await unlock(); if(!k) return; try{ const back=await dec(k,c.rrnB), front=dg(c.rrn7||"").slice(0,6)||dg(c.birth||"").slice(2,8);
        inp.value=`${front}-${back}`; inp.dispatchEvent(new Event("input",{bubbles:true})); log(c,"청구 자동입력"); save(); b.remove(); }
      catch(e){ alert("저장된 뒷자리를 열지 못했습니다."); } }; }
  new MutationObserver(claimBtn).observe(document.body,{childList:true,subtree:true});

  /* ---- 열람 기록 보기 (마이페이지 등에서 window.boitRrnLog() 호출) ---- */
  window.boitRrnLog=function(){ const L=(ME.rrnLog||[]).slice().reverse().slice(0,100);
    modal(`<h2 style="margin:0">주민번호 열람 기록 (최근 ${L.length}건)</h2>
      <div style="max-height:50vh;overflow:auto"><table class="tbl" style="width:100%;font-size:13px"><tr><th style="text-align:left">일시</th><th style="text-align:left">고객</th><th style="text-align:left">내용</th></tr>${L.map(x=>`<tr><td class="num">${esc(new Date(new Date(x.at).getTime()+9*3600e3).toISOString().slice(0,16).replace("T"," "))}</td><td>${esc(x.name||"-")}</td><td>${esc(x.act)}</td></tr>`).join("")||'<tr><td colspan="3" class="note">기록 없음</td></tr>'}</table></div>
      ${ME.rrnLock?`<p class="note" style="margin:0">이용 규정 동의: ${esc(String(ME.rrnLock.agreedAt||"").slice(0,10))}</p>`:""}
      <div><button class="btn" type="button" id="rl-x">닫기</button></div>`); q("#rl-x").onclick=close; };
  document.addEventListener("click",e=>{ if(e.target.closest("[data-rrnlog]")) window.boitRrnLog(); });
})();
