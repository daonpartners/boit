// 첫 화면 움직임 (2026-11-22): 보상청구 미리보기 단계 자동 진행 + 스크롤하면 떠오르기
(function(){
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 스크롤하면 떠오르기
  var rv = document.querySelectorAll('.lp .rv');
  if (reduce || !('IntersectionObserver' in window)) { rv.forEach(function(e){ e.classList.add('in'); }); }
  else {
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.15 });
    rv.forEach(function(e){ io.observe(e); });
  }

  // 미리보기: 1 고객 → 2 서류 → 3 보험사 → 4 보내는 중 → 5 완료 → 처음부터
  var shot = document.getElementById('lp-shot');
  if (!shot) return;
  var cnt = document.getElementById('lp-cnt');
  var steps = shot.querySelectorAll('.ls-step b');
  var wait = [700, 1300, 1600, 1700, 1500, 2600];
  var n = 27, step = 0;
  function show(k){
    shot.setAttribute('data-step', k);
    steps.forEach(function(b){ var s = +b.getAttribute('data-s'); b.classList.toggle('on', s === Math.min(Math.max(k,1),4)); });
    if (k === 5 && cnt) { n++; cnt.textContent = n + '건'; cnt.classList.add('bump'); setTimeout(function(){ cnt.classList.remove('bump'); }, 400); }
    if (k === 0 && n > 34) { n = 27; if (cnt) cnt.textContent = '27건'; }
  }
  if (reduce) { show(5); return; }
  function tick(){
    var visible = shot.offsetParent !== null && !document.hidden;
    if (visible) { step = (step + 1) % 6; show(step); }
    setTimeout(tick, visible ? wait[step] : 1000);
  }
  show(0); setTimeout(tick, 500);
})();
