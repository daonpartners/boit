/* 보잇 · 청구 서류·주민등록번호 3개월 보관 (2026-11-23 대표 결정)
   팩스 발송이 되면 → 그 청구의 서류 원본 + 주민번호(암호화)를 보잇 서버(서울)에 90일 보관
   청구내역에서 [서류로 다시 청구] → 고객·주민번호·서류가 보상청구 화면에 채워짐 / [서류 파기] → 즉시 삭제
   90일 지나면 서버가 자동 삭제 (claim-link purge, 매일) */
(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const live=()=>typeof faxLive==="function"&&faxLive();
const KEPT=new Map(); let LOADED=0;
async function api(body){ const {data:{session}}=await CLOUD.sb.auth.getSession();
  try{ const r=await fetch(BOIT_CLOUD.url+"/functions/v1/claim-link",{method:"POST",headers:{"Content-Type":"application/json",apikey:BOIT_CLOUD.key,Authorization:"Bearer "+((session&&session.access_token)||"")},body:JSON.stringify(body)});
    return await r.json(); }catch(e){ return {error:"net",message:"서버에 연결하지 못했습니다."}; } }
async function list(){ if(!live()) return; const j=await api({action:"keep_list"}); if(!j.ok) return; KEPT.clear(); (j.rows||[]).forEach(r=>KEPT.set(r.gid,r)); LOADED=Date.now(); if(typeof renderHistory==="function"&&$("#histbody")) try{ renderHistory(); }catch(e){} }
const dLeft=g=>{ const r=KEPT.get(g); return r?Math.max(0,Math.ceil((new Date(r.expires).getTime()-Date.now())/864e5)):0; };

/* 보잇 서버가 받는 형식(JPEG·PNG·PDF, 10MB)으로 맞춤 */
async function fit(f){ const ok=/^(image\/jpeg|image\/png|application\/pdf)$/.test(f.type);
  if(ok&&f.size<=9.5*1048576) return f; if(f.type==="application/pdf") return null;
  const u=URL.createObjectURL(f);
  try{ const im=await new Promise((r,x)=>{ const i=new Image(); i.onload=()=>r(i); i.onerror=x; i.src=u; }); let w=im.naturalWidth,h=im.naturalHeight; const k=Math.min(1,2400/Math.max(w,h)); w=Math.round(w*k); h=Math.round(h*k);
    const cv=document.createElement("canvas"); cv.width=w; cv.height=h; const c=cv.getContext("2d"); c.fillStyle="#fff"; c.fillRect(0,0,w,h); c.drawImage(im,0,0,w,h);
    return await new Promise(r=>cv.toBlob(r,"image/jpeg",.85)); }catch(e){ return null; } finally{ URL.revokeObjectURL(u); } }
async function put(up,blob){ const fd=new FormData(); fd.append("cacheControl","60"); fd.append("",blob);
  const r=await fetch(`${BOIT_CLOUD.url}/storage/v1/object/upload/sign/boit-claim/${up.path.split("/").map(encodeURIComponent).join("/")}?token=${encodeURIComponent(up.token)}`,{method:"PUT",headers:{apikey:BOIT_CLOUD.key,"x-upsert":"true"},body:fd}); return r.ok; }

/* 발송 후 보관 */
async function keep(gid,snap){ try{
  const blobs=[]; for(const o of snap.docs){ if(!o.file) continue; const b=await fit(o.file); if(b) blobs.push({b,name:o.name||o.file.name||"서류"}); }
  if(!blobs.length) return;
  const j=await api({action:"keep_put",gid,rrn:snap.rrn,name:snap.name,phone:snap.phone,addr:snap.addr,ins:snap.ins,kind:snap.kind,files:blobs.map(x=>({type:x.b.type||"image/jpeg",name:x.name}))});
  if(!j.ok){ if(window.notify) notify("청구 서류를 3개월 보관하지 못했습니다: "+(j.message||""),"warn"); return; }
  let bad=0; for(let i=0;i<j.ups.length;i++){ let ok=false; for(let k=0;k<2&&!ok;k++) ok=await put(j.ups[i],blobs[i].b).catch(()=>false); if(!ok) bad++; }
  if(bad&&window.notify) notify(`청구 서류 ${bad}장을 보관하지 못했습니다. 다시 청구할 때는 그 서류를 새로 올려 주세요.`,"warn");
  KEPT.set(gid,{gid,n:j.ups.length-bad,expires:new Date(Date.now()+90*864e5).toISOString()}); }catch(e){} }
const origDone=window.sendDone;
if(typeof origDone==="function") window.sendDone=function(R){
  let snap=null; try{ if(live()) snap={docs:allFiles().slice(),rrn:S.cl.rrn,name:S.cl.name,phone:S.cl.phone,addr:S.cl.addr||"",ins:S.ins.map(id=>insBy(id).name),kind:(typeof catLabel==="function"?catLabel():"")+" · "+(S.acc.type||"")}; }catch(e){}
  const r=origDone.apply(this,arguments);
  try{ R=R||{}; if(snap&&S.lastGid&&S.ins.some(id=>!R[id]||R[id].res!=="bad")) keep(S.lastGid,snap); }catch(e){}
  return r; };

/* 청구내역: 보관 표시와 버튼 */
const origAct=window.histActions;
if(typeof origAct==="function") window.histActions=function(h,i){ let x=origAct.apply(this,arguments);
  if(!h||!h.gid||!KEPT.has(h.gid)) return x;
  x=x.replace('<span class="note">서류 파기됨</span>','');
  return x+`<div class="row" style="gap:4px;margin-top:4px"><span class="note">서류·주민번호 보관 D-${dLeft(h.gid)}</span><button class="btn sm primary" type="button" data-kre="${i}">서류로 다시 청구</button><button class="btn sm" type="button" data-kdel="${i}">서류 파기</button></div>`; };

document.addEventListener("click",async e=>{
  const re=e.target.closest("[data-kre]"); if(re){ e.stopPropagation(); const h=S.history[+re.dataset.kre]; if(!h) return;
    if(window.notify) notify("보관 서류 불러오는 중…","wait");
    const j=await api({action:"keep_get",gid:h.gid}); if(!j.ok){ if(window.notify) notify(j.message||"불러오지 못했습니다.","warn"); KEPT.delete(h.gid); try{ renderHistory(); }catch(_){} return; }
    const D=j.data||{}, files=[];
    for(const f of j.files||[]){ try{ const b=await (await fetch(f.url)).blob(); const ext=b.type==="application/pdf"?"pdf":b.type==="image/png"?"png":"jpg"; files.push(new File([b],(f.name||`서류_${files.length+1}`).replace(/\.[a-z0-9]+$/i,"")+"."+ext,{type:b.type||"image/jpeg"})); }catch(_){} }
    resetClaim(); S.cl.name=D.name||h.cust||""; if(D.rrn) S.cl.rrn=fmtRrn(D.rrn); S.cl.phone=fmtPhone(D.phone||h.phone||""); if(D.addr) S.cl.addr=D.addr;
    const c=CUSTOMERS.find(x=>x.name===S.cl.name&&digits(x.phone)===digits(S.cl.phone)); if(c){ S.cl.custId=c.id; S.cl.save=false; }
    const id=(INSURERS.find(x=>x.name===h.ins)||{}).id; if(id){ S.insMode="manual"; S.ins=[id]; }
    go("claim"); renderStep(); if(files.length) await addAllFiles(files); window.scrollTo(0,0);
    if(window.notify) notify(`${S.cl.name}님 보관 서류 ${files.length}장을 불러왔습니다. 서명을 받고 확인 후 발송하세요.`,"ok"); return; }
  const dl=e.target.closest("[data-kdel]"); if(dl){ e.stopPropagation(); const h=S.history[+dl.dataset.kdel]; if(!h) return;
    if(!window.confirm(`${h.cust}님 청구(${h.at})의 서류와 주민등록번호를 지금 파기할까요?\n같은 청구의 다른 보험사 건도 함께 지워지고, 되돌릴 수 없습니다.`)) return;
    const j=await api({action:"keep_del",gid:h.gid}); KEPT.delete(h.gid); try{ renderHistory(); }catch(_){}
    if(window.notify) notify(j.ok?"서류·주민번호를 파기했습니다.":(j.message||"파기하지 못했습니다."),j.ok?"ok":"warn"); return; }
  if(e.target.closest('[data-go="history"]')&&live()&&Date.now()-LOADED>30000) setTimeout(list,50);
},true);
setInterval(()=>{ if(live()&&!LOADED) list(); },5000);
})();
