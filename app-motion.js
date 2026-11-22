// 앱 홈 숫자 올라가기 (2026-11-22): 가망·관리·전체 고객 수가 0부터 올라감
(function(){
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var busy = {};
  function run(el){
    var to = parseInt(String(el.textContent).replace(/[^\d]/g,''), 10);
    if (!to || to < 2 || busy[el.id]) return;
    busy[el.id] = true;
    var t0 = performance.now(), dur = 700;
    (function step(t){
      var k = Math.min(1, (t - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - k, 3)));
      el.textContent = v;
      if (k < 1) requestAnimationFrame(step); else { el.textContent = to; setTimeout(function(){ busy[el.id] = false; }, 50); }
    })(t0);
  }
  ['h-pros','h-mng','h-all'].forEach(function(id){
    var el = document.getElementById(id); if (!el) return;
    new MutationObserver(function(){ if (!busy[id]) run(el); }).observe(el, { childList: true, characterData: true, subtree: true });
  });
})();
