/* 보잇 · 고객 상담신청 링크 (설계사 화면)
   - 고객관리 › [상담신청 링크]: 보험사(메리츠·KB·미래에셋생명) 골라 고객에게 링크 문자·카톡·QR 보내기, 동의 링크 설정
   - 고객 링크: boit.ai.kr/apply/?a=코드&i=mz|kb|mi
   - 고객이 boit.ai.kr/apply/?a=코드&i=보험사 에서 신청하면 boit_leads 에 저장(문자 없음) → 보험사 공식 인증 화면으로 이동
   - 설계사 보잇: 1분마다 가져와 '상담접수 DB'(LEADS, 고객목록과 별도)에 추가 · 추가/수정/삭제/고객으로 등록 → 여기서 1분마다 가져와 고객목록(구분: 가망)에 등록
   서버: server/apply.ts (Edge Function 'apply'), 표: server/apply.sql */
(function(){
  if(typeof CLOUD==="undefined") return;
  const BASE="https://boit.ai.kr/apply/?a=";
  const INS=[["mz","메리츠화재","조직코드(숫자) 또는 동의 링크"],["kb","KB손해보험","설계사(LC) 코드 또는 동의 링크"],["mi","미래에셋생명","설계사 코드 (동의 화면 주소 확인 중)"]];
  const HOSTS=/(^|\.)(meritzfire\.com|kbinsure\.co\.kr|miraeasset\.com)$/i;
  const q=s=>document.querySelector(s);
  const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  let ROW=null;
  function linkOk(k,v){ v=String(v||"").trim(); if(!v) return true; if(k==="mz"&&/^\d{6,12}$/.test(v)) return true; if((k==="kb"||k==="mi")&&/^[a-z]?\d{6,8}$/i.test(v)) return true;
    try{ const u=new URL(v); return u.protocol==="https:"&&HOSTS.test(u.hostname); }catch(e){ return false; } }
  function newCode(){ const a="abcdefghjkmnpqrstuvwxyz23456789"; return Array.from(crypto.getRandomValues(new Uint8Array(8)),x=>a[x%a.length]).join(""); }

  /* ---- 화면 ---- */
  const row=q("#btn-addcust")&&q("#btn-addcust").parentElement; if(!row) return;
  const btn=document.createElement("button"); btn.className="btn"; btn.id="btn-apl"; btn.textContent="상담신청 링크"; row.prepend(btn);
  const pn=document.createElement("div"); pn.className="panel"; pn.id="apl"; pn.hidden=true; pn.style.cssText="margin-top:14px;display:flex;flex-direction:column;gap:12px";
  pn.innerHTML=`<h2>고객 상담신청 링크</h2>
    <p class="note" style="margin:0">보험사를 골라 고객에게 링크를 보내면, 고객은 그 보험사 상담 신청 화면에서 이름·휴대폰·상품 입력 → [신청하고 인증하기] → 그 보험사 공식 인증·동의 화면으로 바로 넘어갑니다. 신청은 아래 <b>상담접수 DB</b>에 자동으로 쌓입니다 (보잇이 보내는 문자 없음 · 비용 0원). 주민등록번호는 받지 않습니다.</p>
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
  let PICK="", CPH="", CNM="";
  const urlOf=k=>BASE+ROW.code+(k?"&i="+k:"");
  const insName=k=>(INS.find(x=>x[0]===k)||[])[1]||"";
  // 보낼 수 있는 보험사: 메리츠(조직코드·링크), KB(LC 코드·링크), 미래에셋생명(공식 링크만 — 코드용 동의 화면 주소 확인 전)
  const usable=(k,v)=>{ v=String(v||"").trim(); if(!v) return false; if(k==="mi") return /^https:/i.test(v); return true; };
  function msgText(){ const r=ROW, who=[r.org,r.name?r.name+" 설계사":""].filter(Boolean).join(" ");
    return `${CNM?CNM+"님, ":""}안녕하세요. ${who}입니다.\n${insName(PICK)} 보장분석 상담 신청 링크를 보내드립니다.\n이름·휴대폰 입력 후 보험사 인증만 하시면 됩니다.\n${urlOf(PICK)}`; }
  function draw(){
    const r=ROW, L=r.links||{};
    if(PICK&&!usable(PICK,L[PICK])) PICK="";
    if(!PICK){ const f=INS.find(x=>usable(x[0],L[x[0]])); PICK=f?f[0]:""; }
    q("#apl-body").innerHTML=`
      <div><b style="font-size:14px">1. 보낼 보험사 고르기</b>
        <div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap">${INS.map(([k,n])=>`<button type="button" class="btn ${PICK===k?"primary":""}" data-apk="${k}" ${usable(k,L[k])?"":"disabled"}>${n}${usable(k,L[k])?"":L[k]?" (동의 화면 주소 확인 중)":" (미등록)"}</button>`).join("")}</div></div>
      ${PICK?`<div><b style="font-size:14px">2. 고객에게 보내기</b>
        <div class="fgrid2" style="margin-top:8px"><div class="field"><label for="apl-cnm">고객 이름 (선택)</label><input id="apl-cnm" maxlength="20" value="${esc(CNM)}" list="dl-cust" autocomplete="off"></div>
          <div class="field"><label for="apl-cph">고객 휴대폰</label><input id="apl-cph" inputmode="tel" maxlength="13" placeholder="010-0000-0000" value="${esc(CPH)}" autocomplete="off"></div></div>
        <pre id="apl-pv" style="white-space:pre-wrap;word-break:break-all;background:#F4F6F8;border-radius:10px;padding:10px 12px;font:inherit;font-size:13.5px;margin:8px 0 0">${esc(msgText())}</pre>
        <div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn primary" type="button" id="apl-send">문자 보내기</button><button class="btn" type="button" id="apl-copy">문구 복사 (카톡)</button><button class="btn" type="button" id="apl-lcopy">링크만 복사</button><button class="btn" type="button" id="apl-qr">QR 보기</button><a class="btn" id="apl-open" href="${esc(urlOf(PICK))}" target="_blank" rel="noopener">고객 화면 보기</a></div>
        <div id="apl-gate" class="note" style="margin:6px 0 0"></div>
        <div id="apl-qrbox" hidden style="text-align:center;margin-top:8px"><div id="apl-qrc" style="display:inline-block;padding:10px;background:#fff"></div><div><button class="btn" type="button" id="apl-qrsave">QR 이미지 저장</button></div></div></div>`
      :`<p class="note err" style="margin:0">아래 설정에서 보험사 동의 링크를 하나 이상 등록하면 보낼 수 있습니다.</p>`}
      <details ${PICK?"":"open"} style="border-top:1px solid #E4E7EB;padding-top:10px"><summary style="cursor:pointer;font-weight:700;font-size:14px">설정 (고객 화면 이름·소속, 보험사 동의 링크)</summary>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
        <div class="fgrid2"><div class="field"><label for="apl-name">고객 화면에 보일 이름</label><input id="apl-name" maxlength="20" value="${esc(r.name)}"></div>
          <div class="field"><label for="apl-org">소속</label><input id="apl-org" maxlength="60" value="${esc(r.org)}" placeholder="예) 미래에셋금융서비스 그로우사업부 다온지사"></div></div>
        ${INS.map(([k,n,ph])=>`<div class="row" style="gap:8px;align-items:center;flex-wrap:wrap"><span style="min-width:110px;font-weight:600">${n}</span>
          <input class="apl-link" data-k="${k}" style="flex:1;min-width:220px;height:42px;border:1px solid #D9DEE3;border-radius:10px;padding:0 12px;font-size:14px;background:#fff" placeholder="${esc(ph)}" value="${esc(L[k]||"")}"></div>`).join("")}
        <p class="note" style="margin:0">메리츠는 조직코드, KB손해보험은 설계사(LC) 코드만 넣어도 됩니다 (KB는 고객이 가입설계 동의 화면에서 코드를 직접 입력 — 신청 완료 화면에 코드가 크게 보이고 복사됩니다). 미래에셋생명은 동의 화면 주소가 확인되면 연결됩니다. 보안을 위해 메리츠화재·KB손해보험·미래에셋생명 공식 주소만 받습니다.</p>
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="apl-on" ${r.active?"checked":""}>신청 받기 (끄면 내 링크가 모두 잠시 멈춥니다)</label>
        <div class="row"><button class="btn primary" type="button" id="apl-save">설정 저장</button><button class="btn" type="button" data-close="apl">닫기</button></div></div></details>
      <span class="note" id="apl-msg"></span>`;
    document.querySelectorAll("[data-apk]").forEach(b=>b.onclick=()=>{ PICK=b.dataset.apk; keep(); draw(); });
    q("#apl-save").onclick=save;
    if(!PICK) return;
    const pv=()=>{ q("#apl-pv").textContent=msgText(); };
    q("#apl-cph").oninput=e=>{ e.target.value=fmtPhone(e.target.value); CPH=e.target.value; };
    q("#apl-cnm").oninput=e=>{ CNM=e.target.value.trim(); const c=CUSTOMERS.find(x=>x.name===CNM&&x.phone); if(c&&!digits(CPH)){ CPH=fmtPhone(c.phone); q("#apl-cph").value=CPH; } pv(); };
    const cp=(t,m)=>{ const ta=document.createElement("textarea"); ta.value=t; ta.style.cssText="position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); let ok=false; try{ ok=document.execCommand("copy"); }catch(e){} ta.remove(); if(!ok&&navigator.clipboard) navigator.clipboard.writeText(t); q("#apl-msg").textContent=m; };
    q("#apl-copy").onclick=()=>cp(msgText(),"문구를 복사했습니다. 카카오톡·문자에 붙여넣으세요.");
    q("#apl-lcopy").onclick=()=>cp(urlOf(PICK),"링크를 복사했습니다.");
    q("#apl-send").onclick=()=>{ const ph=digits(CPH); if(!/^01\d{8,9}$/.test(ph)){ q("#apl-msg").textContent="고객 휴대폰번호를 입력하세요."; q("#apl-cph").focus(); return; }
      const g=q("#apl-gate"); g.innerHTML="";
      if(typeof smsGate==="function") smsGate({cost:(typeof SMS_PRICE!=="undefined"&&SMS_PRICE.lms)||45,memo:`상담신청 링크(${insName(PICK)})`,el:g,text:msgText(),phone:ph});
      else location.href=`sms:${ph}?body=${encodeURIComponent(msgText())}`; };
    q("#apl-qr").onclick=()=>{ const b=q("#apl-qrbox"); b.hidden=!b.hidden; if(!b.hidden) qr(urlOf(PICK),"#apl-qrc",200); };
    q("#apl-qrsave").onclick=()=>qr(urlOf(PICK),null,1000).then(c=>{ if(!c) return; const a=document.createElement("a"); a.href=c.toDataURL("image/png"); a.download=`상담신청_${insName(PICK)}_${ROW.name||"보잇"}.png`; document.body.appendChild(a); a.click(); a.remove(); });
  }
  function keep(){ const a=q("#apl-cph"), b=q("#apl-cnm"); if(a) CPH=a.value; if(b) CNM=b.value.trim(); }
  function libQR(){ return window.QRCode?Promise.resolve():new Promise((ok,no)=>{ const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; s.onload=ok; s.onerror=no; document.head.appendChild(s); }); }
  function qr(text,sel,size){ return libQR().then(()=>{ const box=sel?q(sel):document.createElement("div"); box.innerHTML=""; if(!sel){ box.style.cssText="position:fixed;left:-9999px"; document.body.appendChild(box); }
      new QRCode(box,{text,width:size,height:size,correctLevel:QRCode.CorrectLevel.M});
      return new Promise(r=>setTimeout(()=>{ const c=box.querySelector("canvas"); if(!sel) box.remove(); r(c); },120)); })
    .catch(()=>{ q("#apl-msg").textContent="QR을 만들지 못했습니다. 새로고침 후 다시 시도하세요."; return null; }); }
  async function save(){
    const m=q("#apl-msg"), links={}; let bad="";
    document.querySelectorAll(".apl-link").forEach(i=>{ const k=i.dataset.k, v=i.value.trim(); if(!linkOk(k,v)) bad=bad||insName(k); if(v) links[k]=v; });
    if(bad){ m.textContent=bad+" 링크가 공식 주소(https)가 아닙니다. 다시 확인해 주세요."; return; }
    const name=q("#apl-name").value.trim(); if(name.length<2){ m.textContent="고객 화면에 보일 이름을 입력하세요."; return; }
    keep(); m.textContent="저장 중…";
    const {data,error}=await CLOUD.sb.from("boit_apply").update({name,org:q("#apl-org").value.trim(),links,show:Object.keys(links),active:q("#apl-on").checked,updated_at:new Date().toISOString()}).eq("user_id",CLOUD.user.id).select().maybeSingle();
    if(error){ m.textContent="저장하지 못했습니다: "+error.message; return; }
    ROW=data; draw(); q("#apl-msg").textContent="설정을 저장했습니다.";
  }
  /* ---- 상담접수 DB: 고객목록과 따로 관리 (추가·수정·삭제·고객으로 등록) ---- */
  const PRODS=["간병인","치매치료","치아","펫","암","건강종합","어린이","운전자","화재","연금"];
  const LSTAT=["신규","연락함","상담중","고객등록","보류"];
  const LSEL=new Set(); let LEDIT=null, LQ="";
  const nextLeadId=()=>LEADS.reduce((m,x)=>Math.max(m,+x.id||0),0)+1;
  const lp=document.createElement("div"); lp.className="panel"; lp.id="leads"; lp.style.cssText="margin-top:14px";
  const listPanel=q("#cm-list")&&q("#cm-list").closest(".panel"); if(listPanel) listPanel.before(lp); else pn.after(lp);
  function drawLeads(){
    const qd=LQ.replace(/\D/g,""), list=LEADS.filter(x=>!LQ||x.name.includes(LQ)||(qd&&String(x.phone).replace(/\D/g,"").includes(qd)));
    const nNew=LEADS.filter(x=>x.status==="신규").length, n=LSEL.size;
    const f=LEDIT?(LEDIT==="new"?{name:"",phone:"",products:[],ins:"",status:"신규",memo:"",date:today()}:LEADS.find(x=>x.id===LEDIT)):null;
    lp.innerHTML=`<div class="row between" style="flex-wrap:wrap;gap:8px"><h2 style="margin:0">상담접수 DB <span class="note">전체 ${LEADS.length}건${nNew?` · 신규 ${nNew}건`:""}</span></h2>
        <div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn" type="button" data-ld="add">추가</button><button class="btn" type="button" data-ld="tocust" ${n?"":"disabled"}>선택 고객으로 등록</button><button class="btn" type="button" data-ld="del" ${n?"":"disabled"} style="color:#b42318">선택 삭제</button></div></div>
      <p class="note" style="margin:6px 0 8px">상담신청 링크로 들어온 신청이 여기에 쌓입니다. 고객목록에는 [고객으로 등록]을 눌러야 들어갑니다.</p>
      ${f?`<div class="panel" style="margin:0 0 10px;background:#F7F9FA;display:flex;flex-direction:column;gap:10px"><b>${LEDIT==="new"?"상담접수 추가":"상담접수 수정"}</b>
        <div class="fgrid"><div class="field"><label for="ld-name">이름</label><input id="ld-name" maxlength="20" value="${esc(f.name)}"></div>
          <div class="field"><label for="ld-phone">휴대폰</label><input id="ld-phone" inputmode="tel" maxlength="13" value="${esc(f.phone)}"></div>
          <div class="field"><label for="ld-date">접수일</label><input id="ld-date" type="date" value="${esc(f.date)}"></div>
          <div class="field"><label for="ld-status">상태</label><select id="ld-status">${LSTAT.map(s=>`<option ${s===f.status?"selected":""}>${s}</option>`).join("")}</select></div></div>
        <div class="field"><label>상담 상품</label><div class="row" style="gap:10px;flex-wrap:wrap">${PRODS.map(p=>`<label style="display:flex;gap:4px;align-items:center"><input type="checkbox" class="ld-p" value="${p}" ${(f.products||[]).includes(p)?"checked":""}>${p}</label>`).join("")}</div></div>
        <div class="fgrid2"><div class="field"><label for="ld-ins">보험사</label><select id="ld-ins">${["","메리츠화재","KB손해보험","미래에셋생명"].map(s=>`<option value="${s}" ${s===(f.ins||"")?"selected":""}>${s||"선택 안 함"}</option>`).join("")}</select></div>
          <div class="field"><label for="ld-memo">메모</label><input id="ld-memo" maxlength="200" value="${esc(f.memo||"")}"></div></div>
        <div class="row"><button class="btn primary" type="button" data-ld="save">저장</button><button class="btn" type="button" data-ld="cancel">취소</button><span class="note err" id="ld-msg"></span></div></div>`:""}
      <div class="field" style="margin-bottom:8px;max-width:320px"><input id="ld-q" placeholder="이름 · 전화번호 뒷자리 검색" value="${esc(LQ)}" autocomplete="off"></div>
      ${list.length?`<div class="tbl-wrap scrollbox"><table><thead><tr><th style="width:34px"><input type="checkbox" data-ld="all" aria-label="모두 선택" ${list.every(x=>LSEL.has(x.id))?"checked":""}></th><th>접수일</th><th>이름</th><th>휴대폰</th><th>상담 상품</th><th>보험사</th><th>상태</th><th>메모</th><th></th></tr></thead>
        <tbody>${list.map(x=>`<tr class="${LSEL.has(x.id)?"sel":""}"><td><input type="checkbox" data-lsel="${x.id}" ${LSEL.has(x.id)?"checked":""} aria-label="${esc(x.name)} 선택"></td><td class="num">${esc(x.date)}</td><td><b>${esc(x.name)}</b></td><td class="num">${esc(x.phone)}</td><td>${esc((x.products||[]).join("·"))}</td><td>${esc(x.ins||"")}</td>
          <td><span class="tag">${esc(x.status)}</span></td><td style="max-width:220px;white-space:normal">${esc(x.memo||"")}</td><td style="white-space:nowrap"><button class="lnk" type="button" data-ledit="${x.id}">수정</button> · <button class="lnk" type="button" data-ldel="${x.id}">삭제</button></td></tr>`).join("")}</tbody></table></div>`
      :`<p class="note" style="margin:0">${LEADS.length?"검색 결과가 없습니다.":"아직 접수된 신청이 없습니다. 위 [상담신청 링크]로 고객에게 링크를 보내 보세요."}</p>`}
      <span class="note" id="ld-out"></span>`;
    const qi=q("#ld-q"); if(qi) qi.oninput=e=>{ LQ=e.target.value.trim(); const p=e.target.selectionStart; drawLeads(); const n2=q("#ld-q"); n2.focus(); try{ n2.setSelectionRange(p,p); }catch(_){} };
    const ph=q("#ld-phone"); if(ph) ph.oninput=e=>{ e.target.value=fmtPhone(e.target.value); };
  }
  function delLeads(ids){ const names=LEADS.filter(x=>ids.includes(x.id)).map(x=>x.name);
    if(!names.length||!confirm(`${names.slice(0,3).join(", ")}${names.length>3?` 외 ${names.length-3}명`:""} 상담접수를 삭제할까요? 되돌릴 수 없습니다.`)) return;
    const k=LEADS.filter(x=>!ids.includes(x.id)); LEADS.splice(0,LEADS.length,...k); ids.forEach(i=>LSEL.delete(i)); if(ids.includes(LEDIT)) LEDIT=null; drawLeads(); }
  function toCustomers(ids){ let add=0, upd=0;
    LEADS.filter(x=>ids.includes(x.id)).forEach(x=>{ const d=String(x.phone).replace(/\D/g,""), line=`상담접수 ${x.date}${x.ins?"("+x.ins+")":""}: ${(x.products||[]).join("·")}${x.memo?" / "+x.memo:""}`;
      const c=d&&CUSTOMERS.find(c=>String(c.phone||"").replace(/\D/g,"")===d);
      if(c){ c.memo=(c.memo?c.memo+"\n":"")+line; upd++; } else { CUSTOMERS.unshift({id:nextCustId(),name:x.name,type:"가망",birth:"",phone:fmtPhone(d),addr1:"",addr2:"",memo:line,src:"상담접수"}); add++; }
      x.status="고객등록"; });
    LSEL.clear(); const dl=q("#dl-cust"); if(dl) dl.innerHTML=""; if(typeof renderCustomers==="function") renderCustomers(); else drawLeads();
    const o=q("#ld-out"); if(o) o.textContent=`고객목록에 새로 ${add}명 등록${upd?`, 기존 고객 ${upd}명은 메모에 추가`:""}했습니다.`; }
  lp.addEventListener("change",e=>{ const c=e.target.closest("[data-lsel]"); if(c){ const id=+c.dataset.lsel; c.checked?LSEL.add(id):LSEL.delete(id); drawLeads(); return; }
    if(e.target.closest('[data-ld="all"]')){ const on=e.target.checked; lp.querySelectorAll("[data-lsel]").forEach(x=>{ const id=+x.dataset.lsel; on?LSEL.add(id):LSEL.delete(id); }); drawLeads(); } });
  lp.addEventListener("click",e=>{ const b=e.target.closest("[data-ld],[data-ledit],[data-ldel]"); if(!b||b.matches('[data-ld="all"]')) return;
    if(b.dataset.ledit){ LEDIT=+b.dataset.ledit; drawLeads(); return; }
    if(b.dataset.ldel){ delLeads([+b.dataset.ldel]); return; }
    const a=b.dataset.ld;
    if(a==="add"){ LEDIT="new"; drawLeads(); q("#ld-name").focus(); }
    else if(a==="cancel"){ LEDIT=null; drawLeads(); }
    else if(a==="del") delLeads([...LSEL]);
    else if(a==="tocust") toCustomers([...LSEL]);
    else if(a==="save"){ const nm=q("#ld-name").value.trim(), ph=q("#ld-phone").value, m=q("#ld-msg");
      if(nm.length<2){ m.textContent="이름을 입력하세요."; return; } if(ph&&!/^01\d{8,9}$/.test(ph.replace(/\D/g,""))){ m.textContent="휴대폰번호를 확인하세요."; return; }
      const v={name:nm,phone:fmtPhone(ph),date:q("#ld-date").value||today(),status:q("#ld-status").value,products:[...lp.querySelectorAll(".ld-p:checked")].map(x=>x.value),ins:q("#ld-ins").value,memo:q("#ld-memo").value.trim()};
      if(LEDIT==="new") LEADS.unshift({id:nextLeadId(),src:"직접입력",...v}); else Object.assign(LEADS.find(x=>x.id===LEDIT)||{},v);
      LEDIT=null; drawLeads(); } });
  if(typeof renderCustomers==="function"){ const orig=renderCustomers; window.renderCustomers=renderCustomers=function(){ orig.apply(this,arguments); drawLeads(); }; }
  drawLeads();

  /* ---- 신청 가져오기: 상담접수 DB에 추가 (고객목록에는 자동으로 넣지 않음) ---- */
  let pulling=false;
  async function pull(){
    if(pulling||ME.demo||!CLOUD.user||!CLOUD.sb) return; pulling=true;
    try{
      const {data,error}=await CLOUD.sb.from("boit_leads").select("id,name,phone,products,ins,created_at").eq("taken",false).order("created_at").limit(100);
      if(error||!data||!data.length) return;
      let added=0;
      for(const L of data){
        if(LEADS.some(x=>x.srv===L.id)) continue;
        const day=new Date(new Date(L.created_at).getTime()+9*3600e3).toISOString().slice(0,10);
        LEADS.unshift({id:nextLeadId(),srv:L.id,name:L.name,phone:fmtPhone(String(L.phone)),products:L.products||[],ins:L.ins||"",date:day,status:"신규",memo:"",src:"상담신청 링크"}); added++;
      }
      if(added){ await cloudSave(true); if(CLOUD.last!==JSON.stringify(cloudSnap())) return; } // 저장 실패·대기 → 다음 번에 다시
      await CLOUD.sb.from("boit_leads").update({taken:true}).in("id",data.map(x=>x.id));
      drawLeads();
      if(added) cloudBadge(`새 상담접수 ${added}건 — 고객관리 › 상담접수 DB`);
    }catch(e){ /* 다음 번에 다시 */ } finally{ pulling=false; }
  }
  setInterval(pull,60000);
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden) pull(); });
  const t=setInterval(()=>{ if(CLOUD.user&&CLOUD.last){ clearInterval(t); pull(); drawLeads(); } },2000);
  window.boitApplyPull=pull;
})();
