/* 보잇 · 고객 '내 보험 불러오기' 링크 (설계사 화면)
   - 고객관리 › [내 보험 불러오기]: 고객에게 링크(boit.ai.kr/myins/?a=코드) 문자·카톡·QR로 보내기
   - 고객이 자기 휴대폰에서 내보험다보여 아이디·비밀번호를 직접 입력 → 결과(계약·담보·실손 지급내역·또래 통계)가 서버에 암호화 보관
   - 여기서 1분마다 '받은 보험 정보'를 확인 → [고객에 넣기]: 고객(이름+휴대폰으로 찾고 없으면 새로 등록) 계약·담보로 저장 → 서버 보관본 삭제
   서버: server/myins.ts (Edge Function 'myins'), 표: server/myins.sql · 링크 코드는 상담신청 링크와 같은 boit_apply.code */
(function(){
  if(typeof CLOUD==="undefined") return;
  const FN="https://lobdowpxujgiadrtxklb.supabase.co/functions/v1/myins", BASE="https://boit.ai.kr/myins/?a=";
  const q=s=>document.querySelector(s);
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const dg=s=>String(s||"").replace(/\D/g,"");
  const d10=s=>{ s=dg(s); return s.length===8?`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6)}`:""; };
  const won=v=>{ const n=+dg(v); return n?(n>=1e4?(n%1e4?(n/1e4).toFixed(1).replace(/\.0$/,""):n/1e4).toLocaleString()+"만원":n.toLocaleString()+"원"):String(v||""); };
  let CODE="", CNM="", CPH="", ROWS=[], OPEN=null;

  /* ---- 화면 ---- */
  const row=q("#btn-addcust")&&q("#btn-addcust").parentElement; if(!row) return;
  const btn=document.createElement("button"); btn.className="btn"; btn.id="btn-myins"; btn.textContent="내 보험 불러오기"; row.prepend(btn);
  const pn=document.createElement("div"); pn.className="panel"; pn.id="myins"; pn.hidden=true; pn.style.cssText="margin-top:14px;display:flex;flex-direction:column;gap:12px";
  pn.innerHTML=`<h2>내 보험 불러오기 (내보험다보여)</h2>
    <p class="note" style="margin:0">고객에게 링크를 보내면 고객이 자기 휴대폰에서 내보험다보여 아이디·비밀번호를 직접 입력합니다. 모든 보험사 계약·담보·실손 지급내역이 아래 <b>받은 보험 정보</b>로 들어옵니다. 고객 아이디·비밀번호는 설계사에게도 보이지 않고 저장되지 않습니다.</p>
    <div id="mi-send"></div><div id="mi-list"></div>`;
  row.closest(".row.between").after(pn);
  btn.onclick=()=>{ ["f-cust","imp","bsc","apl"].forEach(id=>{ const e=q("#"+id); if(e) e.hidden=true; }); pn.hidden=!pn.hidden; if(!pn.hidden){ pn.scrollIntoView({block:"nearest"}); start(); } };

  async function start(){
    const box=q("#mi-send");
    if(ME.demo||!CLOUD.user||!CLOUD.sb){ box.innerHTML='<p class="note err" style="margin:0">로그인한 보잇 회원만 쓸 수 있습니다.</p>'; q("#mi-list").innerHTML=""; return; }
    const u=CLOUD.user; if(!(u.phone&&u.phone_confirmed_at)){ box.innerHTML='<p class="note err" style="margin:0">휴대폰 인증을 마친 회원만 링크를 만들 수 있습니다.</p>'; return; }
    if(!CODE){ let {data}=await CLOUD.sb.from("boit_apply").select("code").eq("user_id",u.id).maybeSingle();
      if(!data){ const a="abcdefghjkmnpqrstuvwxyz23456789", org=[ME.company,ME.branch].filter(Boolean).join(" ");
        for(let i=0;i<3&&!data;i++){ const code=Array.from(crypto.getRandomValues(new Uint8Array(8)),x=>a[x%a.length]).join(""); const r=await CLOUD.sb.from("boit_apply").insert({user_id:u.id,code,name:(ME.name||"").slice(0,20),org:org.slice(0,60),show:[]}).select("code").maybeSingle(); data=r.data; } }
      CODE=data?data.code:""; }
    if(!CODE){ box.innerHTML='<p class="note err" style="margin:0">링크를 만들지 못했습니다. 새로고침 후 다시 시도하세요.</p>'; return; }
    drawSend(); pull();
  }
  const url=()=>BASE+CODE+(CNM?"&n="+encodeURIComponent(CNM):"");
  function msgText(){ const who=[ME.company,ME.branch].filter(Boolean).join(" ")+(ME.name?" "+ME.name+" 설계사":"");
    return `${CNM?CNM+"님, ":""}안녕하세요. ${who.trim()}입니다.\n가입하신 보험을 한 번에 확인해 드리려고 '내 보험 불러오기' 링크를 보내드립니다.\n내보험다보여(신용정보원) 아이디로 로그인하시면 됩니다. 아이디·비밀번호는 저장되지 않으며 저도 볼 수 없습니다.\n${url()}`; }
  function drawSend(){
    q("#mi-send").innerHTML=`<b style="font-size:14px">고객에게 링크 보내기</b>
      <div class="fgrid2" style="margin-top:8px"><div class="field"><label for="mi-cnm">고객 이름 (선택)</label><input id="mi-cnm" maxlength="20" value="${esc(CNM)}" list="dl-cust" autocomplete="off"></div>
        <div class="field"><label for="mi-cph">고객 휴대폰</label><input id="mi-cph" inputmode="tel" maxlength="13" placeholder="010-0000-0000" value="${esc(CPH)}" autocomplete="off"></div></div>
      <pre id="mi-pv" style="white-space:pre-wrap;word-break:break-all;background:#F4F6F8;border-radius:10px;padding:10px 12px;font:inherit;font-size:13.5px;margin:8px 0 0">${esc(msgText())}</pre>
      <div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn primary" type="button" id="mi-sms">문자 보내기</button><button class="btn" type="button" id="mi-copy">문구 복사 (카톡)</button><button class="btn" type="button" id="mi-lcopy">링크만 복사</button><button class="btn" type="button" id="mi-qr">QR 보기</button><a class="btn" href="${esc(url())}" target="_blank" rel="noopener">고객 화면 보기</a></div>
      <div id="mi-gate" class="note" style="margin:6px 0 0"></div><p class="note" id="mi-msg" style="margin:4px 0 0"></p>
      <div id="mi-qrbox" hidden style="text-align:center;margin-top:8px"><div id="mi-qrc" style="display:inline-block;padding:10px;background:#fff"></div></div>`;
    const pv=()=>{ q("#mi-pv").textContent=msgText(); };
    q("#mi-cnm").oninput=e=>{ CNM=e.target.value.trim(); const c=CUSTOMERS.find(x=>x.name===CNM&&x.phone); if(c&&!dg(CPH)){ CPH=fmtPhone(c.phone); q("#mi-cph").value=CPH; } pv(); };
    q("#mi-cph").oninput=e=>{ CPH=e.target.value; };
    const cp=(t,m)=>{ const ta=document.createElement("textarea"); ta.value=t; ta.style.cssText="position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); let ok=false; try{ ok=document.execCommand("copy"); }catch(e){} ta.remove(); if(!ok&&navigator.clipboard) navigator.clipboard.writeText(t); q("#mi-msg").textContent=m; };
    q("#mi-copy").onclick=()=>cp(msgText(),"문구를 복사했습니다. 카카오톡·문자에 붙여넣으세요.");
    q("#mi-lcopy").onclick=()=>cp(url(),"링크를 복사했습니다.");
    q("#mi-sms").onclick=()=>{ const ph=dg(CPH); if(!/^01\d{8,9}$/.test(ph)){ q("#mi-msg").textContent="고객 휴대폰번호를 입력하세요."; q("#mi-cph").focus(); return; }
      const g=q("#mi-gate"); g.innerHTML="";
      if(typeof smsGate==="function") smsGate({cost:(typeof SMS_PRICE!=="undefined"&&SMS_PRICE.lms)||45,memo:"내 보험 불러오기 링크",el:g,text:msgText(),phone:ph});
      else location.href=`sms:${ph}?body=${encodeURIComponent(msgText())}`; };
    q("#mi-qr").onclick=()=>{ const b=q("#mi-qrbox"); b.hidden=!b.hidden; if(b.hidden) return;
      const draw=()=>{ const c=q("#mi-qrc"); c.innerHTML=""; new QRCode(c,{text:url(),width:200,height:200,correctLevel:QRCode.CorrectLevel.M}); };
      if(window.QRCode) draw(); else { const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; s.onload=draw; document.head.appendChild(s); } };
  }

  /* ---- 받은 보험 정보 ---- */
  async function api(body){ const t=(await CLOUD.sb.auth.getSession()).data.session; if(!t) throw new Error("login");
    const r=await fetch(FN,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t.access_token},body:JSON.stringify(body)}); return r.json(); }
  let pulling=false;
  async function pull(){
    if(pulling||ME.demo||!CLOUD.user||!CLOUD.sb) return; pulling=true;
    try{ const j=await api({act:"list"}); if(j&&j.ok){ const had=ROWS.length; ROWS=j.rows||[]; drawList(); if(ROWS.length>had&&had>=0&&pn.hidden&&ROWS.length) cloudBadge(`받은 보험 정보 ${ROWS.length}건 — 고객관리 › 내 보험 불러오기`); } }
    catch(e){ /* 다음 번에 */ } finally{ pulling=false; }
  }
  const kindOf=c=>c.kind==="자동차"?"자동차":c.kind==="화재·특종"?"화재":"";
  const live=s=>!/해지|소멸|만기|철회|실효/.test(String(s||""));
  function drawList(){
    const box=q("#mi-list"); if(!box) return;
    if(!ROWS.length){ box.innerHTML='<b style="font-size:14px">받은 보험 정보</b><p class="note" style="margin:6px 0 0">아직 없습니다. 고객이 링크에서 불러오기를 마치면 1분 안에 여기에 나타납니다.</p>'; return; }
    box.innerHTML=`<b style="font-size:14px">받은 보험 정보 ${ROWS.length}건</b>`+ROWS.map(r=>{ const I=r.ins||{contracts:[]}, on=(I.contracts||[]).filter(c=>live(c.status)), at=new Date(new Date(r.at).getTime()+9*3600e3).toISOString().slice(0,16).replace("T"," ");
      const ex=CUSTOMERS.find(c=>dg(c.phone)&&dg(c.phone)===dg(r.phone));
      return `<div class="panel" style="margin-top:8px;padding:10px 12px"><div class="row between" style="gap:8px;flex-wrap:wrap;align-items:center">
        <div><b>${esc(r.name)}</b> <span class="note">${esc(r.phone)} · ${at} · 유지 계약 ${on.length}건${(I.contracts||[]).length>on.length?` (해지·만기 ${(I.contracts||[]).length-on.length}건)`:""}${(I.payments||[]).length?` · 실손 지급 ${(I.payments||[]).length}건`:""}${ex?` · 내 고객 ${esc(ex.name)}`:" · 새 고객"}</span></div>
        <div class="row" style="gap:6px"><button class="btn sm" type="button" data-miv="${r.id}">${OPEN===r.id?"접기":"보기"}</button><button class="btn sm primary" type="button" data-mii="${r.id}" ${r.ins?"":"disabled"}>고객에 넣기</button><button class="btn sm" type="button" data-mid="${r.id}">삭제</button></div></div>
        ${OPEN===r.id&&r.ins?detail(I):""}</div>`; }).join("")+'<p class="note" id="mi-out" style="margin:6px 0 0"></p>';
  }
  function detail(I){
    const C=(I.contracts||[]).filter(c=>live(c.status));
    const rows=C.map(c=>`<tr><td>${esc(c.kind)}</td><td>${esc(c.company)}</td><td>${esc(c.product)}</td><td>${esc(d10(c.start))}</td><td>${esc(/종신/.test(c.end)?"종신":d10(c.end))}</td><td style="text-align:right">${c.premium?(+c.premium).toLocaleString()+"원":""}</td><td style="text-align:right">${(c.covers||[]).length}</td></tr>`).join("");
    const st=(I.stats&&I.stats.flat||[]).filter(x=>x.name);
    const stHtml=st.length?`<b style="display:block;margin-top:10px;font-size:13px">또래 대비 보장금액 (신용정보원 분석통계, 단위 만원)</b><table class="tbl" style="width:100%;font-size:12.5px;margin-top:4px"><tr><th style="text-align:left">담보</th><th>본인</th><th>평균그룹</th></tr>${st.map(x=>{ const s=+dg(x.self), a=+dg(x.avg); return `<tr><td>${esc(x.name)}</td><td style="text-align:right;${a&&s<a?"color:#C4472F;font-weight:700":""}">${s.toLocaleString()}</td><td style="text-align:right">${a.toLocaleString()}</td></tr>`; }).join("")}</table><p class="note" style="margin:2px 0 0">빨간색 = 평균그룹보다 적은 담보</p>`:"";
    return `<div style="overflow:auto;margin-top:8px"><table class="tbl" style="width:100%;font-size:12.5px"><tr><th style="text-align:left">구분</th><th style="text-align:left">보험사</th><th style="text-align:left">상품</th><th>가입일</th><th>만기</th><th>보험료</th><th>담보</th></tr>${rows||'<tr><td colspan="7" class="note">유지 중인 계약이 없습니다.</td></tr>'}</table></div>${stHtml}`;
  }
  // 고객에 넣기: 이름+휴대폰으로 고객 찾기(없으면 새로) → 계약(같은 보험사·가입일은 담보만 갱신) → 실손 지급내역·통계는 고객정보에 암호화 보관
  async function importRow(r){
    const I=r.ins; if(!I) return;
    let c=CUSTOMERS.find(x=>dg(x.phone)&&dg(x.phone)===dg(r.phone))||CUSTOMERS.find(x=>x.name===r.name&&!dg(x.phone));
    let isNew=false; if(!c){ c={id:nextCustId(),name:r.name,type:"가망",birth:"",phone:fmtPhone(dg(r.phone)),addr1:"",addr2:"",memo:"",src:"내 보험 불러오기"}; CUSTOMERS.unshift(c); isNew=true; }
    let add=0, upd=0;
    (I.contracts||[]).filter(k=>live(k.status)).forEach(k=>{
      const start=d10(k.start), end=/종신/.test(k.end)?"":d10(k.end);
      const cov=(k.covers||[]).filter(v=>live(v.status)).map(v=>({name:v.name,amount:won(v.amount),kind:k.kind==="실손"?"실손":""}));
      const iid=insIdByName(k.company);
      const ex=CONTRACTS.find(x=>x.cust===c.id&&(x.start||"")===start&&(x.insurer===k.company||(iid&&insIdByName(x.insurer)===iid)));
      if(ex){ if(cov.length){ ex.cov=cov; ex.covAt=today(); ex.covSrc="내보험다보여"; } if(!ex.end&&end) ex.end=end; if(!ex.premium&&+k.premium) ex.premium=+k.premium; upd++; }
      else { addContract({cust:c.id,kind:kindOf(k),insurer:k.company,product:k.product,policyNo:k.policy||"",start,end,premium:+k.premium||0,carName:k.car||"",cov,covAt:today(),covSrc:"내보험다보여",src:"내보험다보여"}); add++; }
    });
    try{ if(typeof acctSeal==="function"&&((I.payments||[]).length||(I.stats&&(I.stats.flat||[]).length))) c.myins={at:today(),...(await acctSeal(JSON.stringify({payments:I.payments||[],stats:I.stats||{}})))}; }catch(e){}
    c.memo=(c.memo?c.memo+"\n":"")+`내 보험 불러오기 ${today()}: 계약 ${add}건 추가${upd?`, ${upd}건 담보 갱신`:""}`;
    await cloudSave(true);
    if(CLOUD.last!==JSON.stringify(cloudSnap())){ q("#mi-out").textContent="저장이 끝나지 않았습니다. 잠시 뒤 다시 눌러 주세요."; return; }
    await api({act:"del",ids:[r.id]}); ROWS=ROWS.filter(x=>x.id!==r.id);
    const dl=q("#dl-cust"); if(dl) dl.innerHTML=""; if(typeof renderCustomers==="function") renderCustomers();
    drawList(); const o=q("#mi-out"); if(o) o.textContent=`${c.name} 고객${isNew?"(새로 등록)":""}에 계약 ${add}건 추가${upd?`, ${upd}건 담보 갱신`:""}했습니다. 서버 보관본은 삭제했습니다.`;
  }
  pn.addEventListener("click",async e=>{
    const v=e.target.closest("[data-miv]"), i=e.target.closest("[data-mii]"), d=e.target.closest("[data-mid]");
    if(v){ const id=+v.dataset.miv; OPEN=OPEN===id?null:id; drawList(); }
    if(i){ i.disabled=true; const r=ROWS.find(x=>x.id===+i.dataset.mii); try{ await importRow(r); }catch(err){ i.disabled=false; const o=q("#mi-out"); if(o) o.textContent="넣지 못했습니다: "+(err.message||err); } }
    if(d){ const r=ROWS.find(x=>x.id===+d.dataset.mid); if(!r||!confirm(`${r.name}님의 받은 보험 정보를 삭제할까요? (고객에 넣지 않은 내용은 다시 받을 수 없습니다)`)) return;
      await api({act:"del",ids:[r.id]}); ROWS=ROWS.filter(x=>x.id!==r.id); drawList(); }
  });
  setInterval(pull,60000);
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden) pull(); });
  const t=setInterval(()=>{ if(CLOUD.user&&CLOUD.last){ clearInterval(t); pull(); } },2000);
})();
