/* 보잇 · 고객 상담신청 링크 (설계사 화면)
   - 고객관리 › [상담신청 링크]: 내 링크·QR, 원수사 동의 링크(메리츠·KB·미래에셋생명) 설정
   - 고객이 boit.ai.kr/apply/?a=코드 에서 문자 인증까지 마치면 boit_leads 에 저장 → 여기서 1분마다 가져와 고객목록(구분: 가망)에 등록
   서버: server/apply.ts (Edge Function 'apply'), 표: server/apply.sql */
(function(){
  if(typeof CLOUD==="undefined") return;
  const BASE="https://boit.ai.kr/apply/?a=";
  const INS=[["mz","메리츠화재","조직코드(숫자) 또는 동의 링크"],["kb","KB손해보험","고객 동의 링크 (https://…kbinsure.co.kr…)"],["mi","미래에셋생명","고객 동의 링크 (https://…miraeasset.com…)"]];
  const HOSTS=/(^|\.)(meritzfire\.com|kbinsure\.co\.kr|miraeasset\.com)$/i;
  const q=s=>document.querySelector(s);
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  let ROW=null;
  function linkOk(k,v){ v=String(v||"").trim(); if(!v) return true; if(k==="mz"&&/^\d{6,12}$/.test(v)) return true;
    try{ const u=new URL(v); return u.protocol==="https:"&&HOSTS.test(u.hostname); }catch(e){ return false; } }
  function newCode(){ const a="abcdefghjkmnpqrstuvwxyz23456789"; return Array.from(crypto.getRandomValues(new Uint8Array(8)),x=>a[x%a.length]).join(""); }

  /* ---- 화면 ---- */
  const row=q("#btn-addcust")&&q("#btn-addcust").parentElement; if(!row) return;
  const btn=document.createElement("button"); btn.className="btn"; btn.id="btn-apl"; btn.textContent="상담신청 링크"; row.prepend(btn);
  const pn=document.createElement("div"); pn.className="panel"; pn.id="apl"; pn.hidden=true; pn.style.cssText="margin-top:14px;display:flex;flex-direction:column;gap:12px";
  pn.innerHTML=`<h2>고객 상담신청 링크</h2>
    <p class="note" style="margin:0">고객이 이 링크에서 이름·휴대폰·상품을 고르고 문자 인증까지 하면 <b>고객목록에 '가망'으로 자동 등록</b>되고 내 휴대폰으로 알림 문자가 옵니다. 주민등록번호는 받지 않습니다.</p>
    <div id="apl-body"><p class="note" style="margin:0">불러오는 중…</p></div>`;
  row.closest(".row.between").after(pn);
  btn.onclick=()=>{ ["f-cust","imp","bsc"].forEach(id=>{ const e=q("#"+id); if(e) e.hidden=true; }); pn.hidden=!pn.hidden; if(!pn.hidden){ pn.scrollIntoView({block:"nearest"}); load(); } };

  function bodyMsg(t){ q("#apl-body").innerHTML=`<p class="note err" style="margin:0">${esc(t)}</p>`; }
  async function load(){
    if(ME.demo||!CLOUD.user||!CLOUD.sb) return bodyMsg("로그인한 보잇 회원만 쓸 수 있습니다.");
    const u=CLOUD.user; if(!(u.phone&&u.phone_confirmed_at)) return bodyMsg("휴대폰 인증을 마친 회원만 링크를 만들 수 있습니다.");
    let {data,error}=await CLOUD.sb.from("boit_apply").select("*").eq("user_id",u.id).maybeSingle();
    if(error) return bodyMsg("불러오지 못했습니다: "+error.message);
    if(!data){ const org=[ME.company,ME.branch].filter(Boolean).join(" ");
      for(let i=0;i<3&&!data;i++){ const r=await CLOUD.sb.from("boit_apply").insert({user_id:u.id,code:newCode(),name:(ME.name||"").slice(0,20),org:org.slice(0,60),show:[]}).select().maybeSingle(); if(r.error&&!/duplicate|unique/i.test(r.error.message)) return bodyMsg("만들지 못했습니다: "+r.error.message); data=r.data; } }
    ROW=data; draw();
  }
  function draw(){
    const r=ROW, url=BASE+r.code, L=r.links||{}, S=r.show||[];
    q("#apl-body").innerHTML=`
      <div class="field"><label>내 신청 링크</label><div class="row" style="flex-wrap:wrap;gap:8px"><input id="apl-url" readonly value="${esc(url)}" style="flex:1;min-width:220px">
        <button class="btn primary" type="button" id="apl-copy">링크 복사</button><button class="btn" type="button" id="apl-qr">QR 보기</button><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">고객 화면 보기</a></div></div>
      <div id="apl-qrbox" hidden style="text-align:center"><div id="apl-qrc" style="display:inline-block;padding:10px;background:#fff"></div><div><button class="btn" type="button" id="apl-qrsave">QR 이미지 저장</button></div></div>
      <div class="fgrid2"><div class="field"><label for="apl-name">고객 화면에 보일 이름</label><input id="apl-name" maxlength="20" value="${esc(r.name)}"></div>
        <div class="field"><label for="apl-org">소속</label><input id="apl-org" maxlength="60" value="${esc(r.org)}" placeholder="예) 미래에셋금융서비스 그로우사업부 다온지사"></div></div>
      <div><b style="font-size:14px">신청 완료 화면에 보일 원수사 동의 버튼</b>
        ${INS.map(([k,n,ph])=>`<div class="row" style="gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap"><label style="min-width:130px;display:flex;gap:6px;align-items:center"><input type="checkbox" class="apl-show" data-k="${k}" ${S.includes(k)?"checked":""}>${n}</label>
          <input class="apl-link" data-k="${k}" style="flex:1;min-width:220px;height:42px;border:1px solid #D9DEE3;border-radius:10px;padding:0 12px;font-size:14px;background:#fff" placeholder="${esc(ph)}" value="${esc(L[k]||"")}"></div>`).join("")}
        <p class="note" style="margin:6px 0 0">체크한 보험사만 보입니다. 보험사 영업지원시스템에서 고객에게 보내는 동의 링크를 붙여넣으세요(메리츠는 조직코드만 넣어도 됩니다). 보안을 위해 메리츠화재·KB손해보험·미래에셋생명 공식 주소만 받습니다.</p></div>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="apl-on" ${r.active?"checked":""}>신청 받기 (끄면 링크가 잠시 멈춥니다)</label>
      <div class="row"><button class="btn primary" type="button" id="apl-save">저장</button><button class="btn" type="button" data-close="apl">닫기</button><span class="note" id="apl-msg"></span></div>`;
    q("#apl-copy").onclick=()=>{ const i=q("#apl-url"); i.select(); let ok=false; try{ ok=document.execCommand("copy"); }catch(e){} if(!ok&&navigator.clipboard) navigator.clipboard.writeText(i.value); q("#apl-msg").textContent="링크를 복사했습니다."; };
    q("#apl-qr").onclick=()=>{ const b=q("#apl-qrbox"); b.hidden=!b.hidden; if(!b.hidden) qr(url,"#apl-qrc",200); };
    q("#apl-qrsave").onclick=()=>qr(url,null,1000).then(c=>{ if(!c) return; const a=document.createElement("a"); a.href=c.toDataURL("image/png"); a.download="상담신청_QR_"+(r.name||"보잇")+".png"; document.body.appendChild(a); a.click(); a.remove(); });
    q("#apl-save").onclick=save;
  }
  function libQR(){ return window.QRCode?Promise.resolve():new Promise((ok,no)=>{ const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; s.onload=ok; s.onerror=no; document.head.appendChild(s); }); }
  function qr(text,sel,size){ return libQR().then(()=>{ const box=sel?q(sel):document.createElement("div"); box.innerHTML=""; if(!sel){ box.style.cssText="position:fixed;left:-9999px"; document.body.appendChild(box); }
      new QRCode(box,{text,width:size,height:size,correctLevel:QRCode.CorrectLevel.M});
      return new Promise(r=>setTimeout(()=>{ const c=box.querySelector("canvas"); if(!sel) box.remove(); r(c); },120)); })
    .catch(()=>{ q("#apl-msg").textContent="QR을 만들지 못했습니다. 새로고침 후 다시 시도하세요."; return null; }); }
  async function save(){
    const m=q("#apl-msg"), links={}, show=[]; let bad="";
    document.querySelectorAll(".apl-link").forEach(i=>{ const k=i.dataset.k, v=i.value.trim(); if(!linkOk(k,v)) bad=bad||INS.find(x=>x[0]===k)[1]; if(v) links[k]=v; });
    if(bad){ m.textContent=bad+" 링크가 공식 주소(https)가 아닙니다. 다시 확인해 주세요."; return; }
    document.querySelectorAll(".apl-show").forEach(c=>{ if(c.checked){ if(!links[c.dataset.k]){ bad=bad||INS.find(x=>x[0]===c.dataset.k)[1]; } else show.push(c.dataset.k); } });
    if(bad){ m.textContent=bad+"에 체크했지만 링크가 비어 있습니다."; return; }
    const name=q("#apl-name").value.trim(); if(name.length<2){ m.textContent="고객 화면에 보일 이름을 입력하세요."; return; }
    m.textContent="저장 중…";
    const {data,error}=await CLOUD.sb.from("boit_apply").update({name,org:q("#apl-org").value.trim(),links,show,active:q("#apl-on").checked,updated_at:new Date().toISOString()}).eq("user_id",CLOUD.user.id).select().maybeSingle();
    if(error){ m.textContent="저장하지 못했습니다: "+error.message; return; }
    ROW=data; draw(); q("#apl-msg").textContent="저장했습니다.";
  }

  /* ---- 신청 가져오기: 고객목록에 '가망'으로 등록 ---- */
  let pulling=false;
  async function pull(){
    if(pulling||ME.demo||!CLOUD.user||!CLOUD.sb) return; pulling=true;
    try{
      const {data,error}=await CLOUD.sb.from("boit_leads").select("id,name,phone,products,created_at").eq("taken",false).order("created_at").limit(100);
      if(error||!data||!data.length) return;
      let added=0, merged=0;
      for(const L of data){
        const d=String(L.phone).replace(/\D/g,""), day=String(L.created_at).slice(0,10), line=`상담신청 ${day}: ${(L.products||[]).join("·")}`;
        if(CUSTOMERS.some(c=>(c.leads||[]).includes(L.id))) continue;
        const c=CUSTOMERS.find(x=>String(x.phone||"").replace(/\D/g,"")===d);
        if(c){ c.memo=(c.memo?c.memo+"\n":"")+line; c.leads=(c.leads||[]).concat(L.id); merged++; }
        else { CUSTOMERS.unshift({id:nextCustId(),name:L.name,type:"가망",birth:"",phone:fmtPhone(d),addr1:"",addr2:"",memo:line,src:"상담신청",leads:[L.id]}); added++; }
      }
      if(added||merged){ await cloudSave(true); if(CLOUD.last!==JSON.stringify(cloudSnap())) return; } // 저장 실패·대기 → 다음 번에 다시
      await CLOUD.sb.from("boit_leads").update({taken:true}).in("id",data.map(x=>x.id));
      const dl=q("#dl-cust"); if(dl) dl.innerHTML="";
      if(q('[data-view="customers"]')&&!q('[data-view="customers"]').hidden&&typeof renderCustomers==="function") renderCustomers();
      if(added||merged) cloudBadge(`새 상담신청 ${added+merged}건 — 고객관리에 등록했습니다`);
    }catch(e){ /* 다음 번에 다시 */ } finally{ pulling=false; }
  }
  setInterval(pull,60000);
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden) pull(); });
  const t=setInterval(()=>{ if(CLOUD.user&&CLOUD.last){ clearInterval(t); pull(); } },2000);
  window.boitApplyPull=pull;
})();
