/* 보잇 · AI 비서 '보잇' (2026-11-25 대표 지시)
   - 화면 오른쪽 아래 버튼 → 질문 창. 그로우 AI 보험비서와 같은 서버(n8n daon-ai-v2: 약관 저장소 + 판매·참고자료)
   - 보내기 전에 주민번호·전화·이메일·고객 이름(○○님/고객) 자동 삭제
   - 답의 **굵게**·==형광펜== 표시만 살리고 나머지는 글자 그대로 (HTML 실행 안 함) */
(function(){
"use strict";
const API="https://daonpartners.app.n8n.cloud/webhook/daon-ai-v2";
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const SURN="김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허유남심노하곽성차주우구민진나지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예봉경봉사부황보";
function mask(s){ s=String(s||"");
  s=s.replace(/\d{6}\s*-?\s*[1-8]\d{6}/g,"[주민번호 삭제]").replace(/01[016789][\s-]?\d{3,4}[\s-]?\d{4}/g,"[연락처 삭제]").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g,"[이메일 삭제]");
  try{ s=s.replace(new RegExp("(?<![가-힣])(?!고객|어머|아버|설계|보험|담당|사장)(["+SURN+"][가-힣]{1,2})(?=\\s?(고객님|고객|님|씨|어머님|아버님))","g"),"[이름 삭제]"); }catch(e){}
  return s; }
const H=[]; let busy=false;
function fmt(t){ return esc(String(t||"")).replace(/\*\*([^*\n]{1,200})\*\*/g,"<b>$1</b>").replace(/==([^=\n]{1,80})==/g,"<mark>$1</mark>").replace(/\n/g,"<br>"); }
function add(role,html){ const b=$("#bt-body"); const d=document.createElement("div"); d.className="bt-m "+role; d.innerHTML=html; b.appendChild(d); b.scrollTop=b.scrollHeight; return d; }
const EX=["교통사고처리지원금 6주 미만 보장하는 회사 알려줘","4세대 실손 도수치료 자기부담금은?","정육점은 일반보험 설계할 때 어떤 업종으로 봐야 해?","화재보험 급배수 누출 특약 보장개시일"];
function hello(){ $("#bt-body").innerHTML=`<div class="bt-hi"><b>안녕하세요, 보잇입니다.</b><span>약관·상품·보상 질문에 등록된 약관과 자료를 근거로 답합니다.</span><div class="bt-ex">${EX.map(q=>`<button type="button" data-btq="${esc(q)}">${esc(q)}</button>`).join("")}</div><small>고객 이름·연락처·주민번호는 자동으로 지우고 보냅니다. 답은 참고용이며, 최종 판단은 약관·원수사 확인이 기준입니다.</small></div>`; }
function open(){ $("#bt-box").hidden=false; $("#bt-fab").classList.add("on"); if(!$("#bt-body").children.length) hello(); setTimeout(()=>{ const i=$("#bt-in"); if(i) i.focus(); },30); }
function close(){ $("#bt-box").hidden=true; $("#bt-fab").classList.remove("on"); }
async function ask(q0){ if(busy) return; const q=mask(q0).trim().slice(0,500); if(!q) return;
  const hi=$("#bt-body .bt-hi"); if(hi) hi.remove();
  add("u",esc(q)); busy=true; $("#bt-in").disabled=true; $("#bt-send").disabled=true;
  const L=add("b wait","보잇이 약관·자료를 찾는 중… 0초"), t0=Date.now(), tk=setInterval(()=>{ L.textContent="보잇이 약관·자료를 찾는 중… "+Math.round((Date.now()-t0)/1000)+"초"; },1000);
  try{ const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:q,history:H.slice(-2),app:"boit"})}); const d=await r.json().catch(()=>({}));
    L.remove(); if(d.success&&d.answer){ H.push({q,a:String(d.answer).slice(0,1500)}); if(H.length>4) H.shift(); add("b",fmt(d.answer)); }
    else add("b",esc(d.answer||d.error||"답을 가져오지 못했습니다. 잠시 후 다시 물어봐 주세요.")); }
  catch(e){ L.remove(); add("b","인터넷 연결 문제로 답을 가져오지 못했습니다."); }
  finally{ clearInterval(tk); busy=false; $("#bt-in").disabled=false; $("#bt-send").disabled=false; $("#bt-in").focus(); } }

function mount(){ if($("#bt-fab")) return;
  const w=document.createElement("div"); w.innerHTML=`<button type="button" id="bt-fab" aria-label="AI 비서 보잇에게 물어보기"><span class="bt-ic">b</span><b>보잇에게 물어보기</b></button>
  <section id="bt-box" hidden role="dialog" aria-label="AI 비서 보잇"><header><span class="bt-ic">b</span><div><b>보잇</b><small>AI 비서 · 약관·자료 근거</small></div><button type="button" id="bt-new" title="새 질문">새 질문</button><button type="button" id="bt-x" aria-label="닫기">✕</button></header>
  <div id="bt-body"></div><form id="bt-f"><textarea id="bt-in" rows="2" placeholder="예: KB 운전자보험 변호사선임비용 경찰조사 단계도 되나요?"></textarea><button type="submit" id="bt-send" class="btn primary">보내기</button></form></section>`;
  document.body.append(...w.children); }
document.addEventListener("click",e=>{ const t=e.target;
  if(t.closest("#bt-fab")){ $("#bt-box").hidden?open():close(); return; }
  if(t.closest("#bt-x")){ close(); return; }
  if(t.closest("#bt-new")){ H.length=0; hello(); return; }
  const x=t.closest("[data-btq]"); if(x){ ask(x.dataset.btq); return; } });
document.addEventListener("submit",e=>{ if(e.target.id!=="bt-f") return; e.preventDefault(); const i=$("#bt-in"), v=i.value; i.value=""; ask(v); });
document.addEventListener("keydown",e=>{ if(e.target.id==="bt-in"&&e.key==="Enter"&&!e.shiftKey&&!e.isComposing){ e.preventDefault(); $("#bt-f").requestSubmit(); } if(e.key==="Escape"&&$("#bt-box")&&!$("#bt-box").hidden) close(); });

const st=document.createElement("style"); st.textContent=`
#bt-fab{position:fixed;right:22px;bottom:22px;z-index:900;display:flex;align-items:center;gap:8px;border:0;border-radius:99px;padding:10px 16px 10px 10px;background:linear-gradient(135deg,#0E7A5F,#0B6E8F);color:#fff;font:inherit;font-size:14px;cursor:pointer;box-shadow:0 6px 18px rgba(14,122,95,.35)}
#bt-fab:hover{filter:brightness(1.08)}#bt-fab.on{opacity:.85}
.bt-ic{width:30px;height:30px;border-radius:50%;background:#fff;color:#0E7A5F;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;font-family:inherit;flex:none}
#bt-box{position:fixed;right:22px;bottom:80px;z-index:901;width:min(420px,calc(100vw - 24px));height:min(620px,calc(100vh - 110px));background:var(--surface,#fff);border:1px solid var(--line,#dfe5e2);border-radius:16px;box-shadow:0 16px 40px rgba(0,0,0,.18);display:flex;flex-direction:column;overflow:hidden}
#bt-box[hidden]{display:none}
#bt-box header{display:flex;align-items:center;gap:10px;padding:10px 12px;background:linear-gradient(135deg,#0E7A5F,#0B6E8F);color:#fff}#bt-box header div{flex:1;display:flex;flex-direction:column}#bt-box header small{opacity:.85;font-size:11.5px}
#bt-box header button{border:1px solid rgba(255,255,255,.5);background:transparent;color:#fff;border-radius:8px;padding:4px 9px;font:inherit;font-size:12.5px;cursor:pointer}
#bt-body{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px;background:#F5F8F7}
.bt-m{max-width:92%;padding:9px 12px;border-radius:12px;font-size:13.5px;line-height:1.6;word-break:keep-all;overflow-wrap:anywhere}.bt-m.u{align-self:flex-end;background:#0E7A5F;color:#fff;border-bottom-right-radius:4px}
.bt-m.b{align-self:flex-start;background:#fff;border:1px solid #E1E8E5;border-bottom-left-radius:4px;color:#18221F}.bt-m.wait{color:#6B7773}.bt-m mark{background:#FFF176;padding:0 2px;border-radius:2px}
.bt-hi{display:flex;flex-direction:column;gap:6px;background:#fff;border:1px solid #E1E8E5;border-radius:12px;padding:12px;font-size:13.5px}.bt-hi small{color:#6B7773;font-size:11.5px;line-height:1.5}
.bt-ex{display:flex;flex-direction:column;gap:5px;margin:4px 0}.bt-ex button{text-align:left;border:1.5px solid #B7E1CF;background:#F0F8F5;color:#0B5C47;border-radius:8px;padding:6px 9px;font:inherit;font-size:12.5px;cursor:pointer}.bt-ex button:hover{background:#E2F1EB}
#bt-f{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line,#dfe5e2);background:var(--surface,#fff)}#bt-in{flex:1;resize:none;border:1.5px solid #B7E1CF;border-radius:10px;padding:8px 10px;font:inherit;font-size:13.5px}#bt-in:focus{outline:none;border-color:#0E7A5F}
@media(max-width:700px){#bt-fab b{display:none}#bt-fab{padding:8px;right:14px;bottom:14px}#bt-box{right:12px;bottom:64px}}
@media print{#bt-fab,#bt-box{display:none!important}}`;
document.head.appendChild(st);
if(document.readyState!=="loading") mount(); else document.addEventListener("DOMContentLoaded",mount);
window.BOTI={open,ask};
})();
