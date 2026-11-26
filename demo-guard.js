// 체험 모드 막기 (2026-11-22 대표 지시): 체험 설계사는 메뉴만 둘러보고, 사진 올리기·글 입력/수정은 못 하게 함
// 결제 전 무료 회원도 같은 잠금 + 저장·다운로드·출력·발송·AI 질문 막기 (2026-11-26 대표 지시: 결제 전 = 열람만)
// 검색칸(고객 찾기·보험사 검색)과 가입·로그인 화면은 그대로 둠
(function(){
  function isDemo(){ try { return (typeof ME !== 'undefined' && !!ME.demo) || window.BOIT_LOCKED === true; } catch (e) { return false; } }
  function isPaidLock(){ try { return !(typeof ME !== 'undefined' && ME.demo) && window.BOIT_LOCKED === true; } catch (e) { return false; } }
  var MSG0 = '체험 모드에서는 메뉴만 둘러볼 수 있습니다. 사진 올리기·글 입력은 회원가입 후 사용하세요.';
  var MSG1 = '결제 전에는 열람만 가능합니다. 입력·저장·다운로드·발송은 이용권 결제 후 사용하세요. (마이페이지 → 이용권 결제)';
  var last = 0;
  function warn(){
    if (Date.now() - last < 1500) return; last = Date.now();
    var MSG = isPaidLock() ? MSG1 : MSG0;
    if (typeof window.notify === 'function') window.notify(MSG, 'info'); else alert(MSG);
  }
  function allowed(el){
    if (!el || !el.closest) return false;
    if (el.closest('#pre, .hsearch, .mf-q, [data-demo-ok]')) return true;
    if (isPaidLock() && el.closest('section[data-view="mypage"], #pay, #paybox, .pay-modal')) return true;
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

  // 결제 전 회원: 저장·다운로드·출력·발송·청구서 미리보기·AI 질문 막기 (메뉴 이동·탭·펼치기는 그대로)
  var ACT = /저장|보내기|발송|다운로드|내려받|출력|인쇄|등록|추가|만들기|올리기|복사|PDF|엑셀|신청|생성|전송|청구하기|미리보기|불러오기|조회|가져오기|공유|QR/;
  function okArea(el){ return !!el.closest('#pre, section[data-view="mypage"], [data-demo-ok], .hsearch, .mf-q, #lock-bar, nav, aside'); }
  document.addEventListener('click', function(e){
    if (!isPaidLock()) return;
    var t = e.target && e.target.closest ? e.target : null; if (!t) return;
    var a = t.closest('a[download], a[href^="blob:"], a[href^="data:"]');
    if (a && !okArea(a)) { e.preventDefault(); e.stopPropagation(); warn(); return; }
    if (t.closest('#bt-send, #bt-body button, #bt-f button, .bt-ex')) { e.preventDefault(); e.stopPropagation(); warn(); return; }
    var b = t.closest('button, [role="button"], input[type="submit"], input[type="button"]');
    if (!b || okArea(b) || b.hasAttribute('data-go')) return;
    var txt = (b.innerText || b.value || b.getAttribute('aria-label') || '').trim();
    if (ACT.test(txt)) { e.preventDefault(); e.stopPropagation(); warn(); }
  }, true);
  document.addEventListener('submit', function(e){
    if (!isPaidLock()) return; var f = e.target;
    if (f && f.closest && !f.closest('#pre, section[data-view="mypage"], [data-demo-ok]')) { e.preventDefault(); e.stopPropagation(); warn(); }
  }, true);
  var op = window.print; window.print = function(){ if (isPaidLock()) { warn(); return; } return op.apply(window, arguments); };
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
