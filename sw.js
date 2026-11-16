/* 보잇 앱 설치용 서비스워커 — 화면·자료를 저장해 두지 않고 항상 최신본을 인터넷에서 받음 (휴대폰이 10분간 옛 화면을 쓰지 않도록 매번 새로 확인) */
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{
  if(e.request.mode!=="navigate") return;
  e.respondWith(fetch(e.request.url,{cache:"no-cache",credentials:"same-origin"}).catch(()=>fetch(e.request)).catch(()=>new Response('<meta charset="utf-8"><meta name="viewport" content="width=device-width"><p style="font:16px sans-serif;padding:24px">인터넷에 연결되지 않았습니다. 연결 후 다시 열어 주세요.</p>',{headers:{"Content-Type":"text/html; charset=utf-8"}})));
});
