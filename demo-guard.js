// 체험 모드 막기 (2026-11-22 대표 지시): 체험 설계사는 메뉴만 둘러보고, 사진 올리기·글 입력/수정은 못 하게 함
// 검색칸(고객 찾기·보험사 검색)과 가입·로그인 화면은 그대로 둠
(function(){
  function isDemo(){ try { return typeof ME !== 'undefined' && !!ME.demo; } catch (e) { return false; } }
  var MSG = '체험 모드에서는 메뉴만 둘러볼 수 있습니다. 사진 올리기·글 입력은 회원가입 후 사용하세요.';
  var last = 0;
  function warn(){
    if (Date.now() - last < 1500) return; last = Date.now();
    if (typeof window.notify === 'function') window.notify(MSG, 'info'); else alert(MSG);
  }
  function allowed(el){
    if (!el || !el.closest) return false;
    if (el.closest('#pre, .hsearch, .mf-q, [data-demo-ok]')) return true;
    if (el.type === 'search' || el.hasAttribute('list')) return true;
    return /검색|이름 또는|전화번호 뒷자리/.test(el.getAttribute('placeholder') || '');
  }
  function editable(el){
    if (!el) return false;
    if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
    return el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|reset|range|color|file|hidden|image)$/.test(el.type);
  }
  // 글 입력·수정 막기
  document.addEventListener('beforeinput', function(e){
    if (!isDemo()) return; var t = e.target;
    if (editable(t) && !allowed(t)) { e.preventDefault(); warn(); }
  }, true);
  document.addEventListener('paste', function(e){
    if (!isDemo()) return; var t = e.target;
    if (editable(t) && !allowed(t)) { e.preventDefault(); warn(); }
  }, true);
  // 사진·파일 올리기 막기 (파일 선택 창, 끌어다 놓기, 코드에서 여는 파일 창 모두)
  document.addEventListener('click', function(e){
    if (!isDemo()) return;
    var t = e.target && e.target.closest ? e.target.closest('input[type="file"], label') : null;
    var inp = t && t.tagName === 'LABEL' ? t.control : t;
    if (inp && inp.type === 'file' && !allowed(inp)) { e.preventDefault(); e.stopPropagation(); warn(); }
  }, true);
  ['dragover', 'drop'].forEach(function(ev){
    document.addEventListener(ev, function(e){
      if (!isDemo() || !e.dataTransfer || [].indexOf.call(e.dataTransfer.types || [], 'Files') < 0) return;
      if (e.target && e.target.closest && e.target.closest('#pre')) return;
      e.preventDefault(); e.stopPropagation(); if (ev === 'drop') warn();
    }, true);
  });
  var oc = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function(){
    if (this.type === 'file' && isDemo() && !allowed(this)) { warn(); return; }
    return oc.apply(this, arguments);
  };
  if (HTMLInputElement.prototype.showPicker) {
    var sp = HTMLInputElement.prototype.showPicker;
    HTMLInputElement.prototype.showPicker = function(){
      if (this.type === 'file' && isDemo() && !allowed(this)) { warn(); return; }
      return sp.apply(this, arguments);
    };
  }
})();
