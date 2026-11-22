// 가입·결제 화면의 약관 '보기' (2026-11-22 대표 지시): 새 창 대신 체크칸 아래 작은 글씨 상자로 펼쳐 스크롤해서 읽기
(function(){
  var cache = {};
  var css = document.createElement('style');
  css.textContent = '.lgl-box{margin:6px 0 10px;max-height:200px;overflow-y:auto;overscroll-behavior:contain;border:1px solid var(--line,#dfe6e3);border-radius:10px;background:var(--surface,#fff);padding:10px 12px;font-size:12px;line-height:1.6;color:var(--muted,#5b6b66);word-break:keep-all}'
    + '.lgl-box h1{font-size:14px!important;line-height:1.4;margin:6px 0 2px!important;color:var(--fg,#1d2522)}.lgl-box h3{font-size:12.5px!important;margin:12px 0 2px!important;color:var(--fg,#1d2522)}.lgl-box p,.lgl-box li{font-size:12px;margin:4px 0}'
    + '.lgl-box table{border-collapse:collapse;width:100%;font-size:11.5px;margin:6px 0}.lgl-box th,.lgl-box td{border:1px solid var(--line,#dfe6e3);padding:4px 6px;text-align:left;vertical-align:top}'
    + '.lgl-box .notice{font-size:11.5px;background:#fff8e6;border-radius:8px;padding:6px 8px}.lgl-box .lgl-full{display:inline-block;margin-top:6px;font-size:12px}';
  document.head.appendChild(css);
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href$="terms.html"],a[href$="privacy.html"],a[href$="refund.html"]');
    if (!a) return;
    var lab = a.closest('label'); if (!lab) return; // 화면 맨 아래 링크는 그대로 새 창
    e.preventDefault(); e.stopPropagation();
    var href = a.getAttribute('href');
    var box = lab.parentNode.querySelector('.lgl-box[data-href="' + href + '"]');
    if (box) { box.hidden = !box.hidden; return; }
    box = document.createElement('div'); box.className = 'lgl-box'; box.dataset.href = href; box.tabIndex = 0;
    box.setAttribute('role', 'region'); box.setAttribute('aria-label', a.textContent + ' 전문');
    box.textContent = '불러오는 중…';
    lab.insertAdjacentElement('afterend', box);
    (cache[href] ? Promise.resolve(cache[href]) : fetch(href, { cache: 'no-cache' }).then(function(r){ return r.text(); }).then(function(t){
      var m = t.match(/<main>([\s\S]*?)<\/main>/i); cache[href] = m ? m[1] : ''; return cache[href];
    })).then(function(html){
      box.innerHTML = html + '<a class="lgl-full" href="' + href + '" target="_blank" rel="noopener">새 창에서 크게 보기</a>';
    }).catch(function(){ box.innerHTML = '불러오지 못했습니다. <a href="' + href + '" target="_blank" rel="noopener">새 창에서 보기</a>'; });
  }, true);
})();
