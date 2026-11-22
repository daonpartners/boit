// AI 기능 국외이전 동의 (2026-11-23 대표 지시로 방식 변경)
// - 회원가입 화면 '[선택] 개인정보 국외 이전 동의 (AI 기능)'로 받음 (가입 정보 ai_ok에 시각 기록 → 계정 ME.aiOk)
// - 가입 때 동의하지 않은 회원(이미 가입한 회원 포함): AI 기능을 누를 때 짧은 동의 창을 띄워 체크 후 진행 (대표 지시 11-23)
// - 철회: 개인정보 보호책임자에게 요청 (처리방침 7항)
// - 보내기 전 브라우저에서 주민등록번호·휴대폰번호·이메일 형식을 가림, 체험 모드는 AI 전송 안 함
(function(){
  var AI_V = '2026-11-23';
  var HOST = 'daonpartners.app.n8n.cloud/webhook/';
  function me(){ try { return typeof ME !== 'undefined' ? ME : null; } catch (e) { return null; } }
  function cloud(){ try { return typeof CLOUD !== 'undefined' && CLOUD.user ? CLOUD : null; } catch (e) { return null; } }
  function ok(){ var m = me(); return !!(m && m.aiOk && !m.aiOk.off); }
  function setOk(on){
    var m = me(); if (!m) return; var at = new Date().toISOString();
    m.aiOk = on ? { v: AI_V, at: at } : { v: AI_V, at: at, off: true };
    m.aiOkLog = (Array.isArray(m.aiOkLog) ? m.aiOkLog : []).concat([{ v: AI_V, at: at, act: on ? '동의' : '철회' }]).slice(-20);
    try { if (typeof cloudSave === 'function') cloudSave(true); } catch (e) {}
  }
  function mask(t){
    return String(t)
      .replace(/(\d{2})(\d{4})\s*-\s*([1-8])\d{6}/g, '$1****-$3******')
      .replace(/\b(\d{6})([1-8])\d{6}\b/g, '******$2******')
      .replace(/(01[016789])\s*-?\s*\d{3,4}\s*-?\s*(\d{4})/g, '$1-****-$2')
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '(이메일 가림)');
  }
  function resp(msg){ return new Response(JSON.stringify({ ok: false, error: msg }), { status: 200, headers: { 'Content-Type': 'application/json' } }); }

  // 가입할 때 체크한 동의를 계정에 옮겨 적음 (가입 정보 ai_ok → ME.aiOk, 한 번만)
  setInterval(function(){
    var C = cloud(), m = me(); if (!C || !m || m.demo || m.aiOk) return;
    var at = C.user.user_metadata && C.user.user_metadata.ai_ok;
    if (at) { m.aiOk = { v: AI_V, at: at, how: '가입' }; m.aiOkLog = [{ v: AI_V, at: at, act: '동의(가입)' }]; try { cloudSave(true); } catch (e) {} }
  }, 2000);

  var of = window.fetch.bind(window);
  window.fetch = async function(input, init){
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf(HOST) < 0) return of(input, init);
    var m = me();
    if (m && m.demo) return resp('체험 모드에서는 AI 기능을 쓸 수 없습니다. 회원가입 후 사용하세요.');
    if (!ok()) { var yes = await ask(); if (!yes) return resp("AI 기능을 쓰려면 개인정보 국외 이전(AI)에 동의해야 합니다. 동의하지 않아도 다른 기능은 그대로 쓸 수 있습니다."); }
    if (init && typeof init.body === 'string') init = Object.assign({}, init, { body: mask(init.body) });
    return of(input, init);
  };

  // 동의 창 (짧게)
  var pending = null;
  function ask(){
    if (pending) return pending;
    pending = new Promise(function(res){
      var w = document.createElement('div'); w.id = 'aic'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', 'aic-h');
      w.innerHTML = '<div class="aic-b"><h2 id="aic-h">AI 기능 사용 동의</h2>'
        + '<p>AI 결과를 만들기 위해 설계서·보장분석 내용(상품·담보·금액, 적혀 있으면 피보험자 이름·나이·성별)을 <b>OpenAI(미국)</b>로 보냅니다. 중계 서버 n8n(독일)을 거치며, OpenAI는 최대 30일 뒤 삭제하고 학습에 쓰지 않습니다. 주민번호·휴대폰·이메일 형식은 보내기 전에 가립니다. '
        + '<a href="privacy.html" target="_blank" rel="noopener">자세히(처리방침 7항)</a></p>'
        + '<label class="aic-c"><input type="checkbox" id="aic-chk"> [선택] 개인정보 국외 이전에 동의합니다</label>'
        + '<div class="aic-a"><button type="button" class="n">취소</button><button type="button" class="y" disabled>동의하고 계속</button></div></div>';
      document.body.appendChild(w);
      var chk = w.querySelector('#aic-chk'), y = w.querySelector('.y'), n = w.querySelector('.n');
      function done(v){ w.remove(); pending = null; res(v); }
      chk.addEventListener('change', function(){ y.disabled = !chk.checked; });
      y.addEventListener('click', function(){ setOk(true); done(true); });
      n.addEventListener('click', function(){ done(false); });
      w.addEventListener('keydown', function(e){ if (e.key === 'Escape') done(false); });
      chk.focus();
    });
    return pending;
  }
  var css = document.createElement('style');
  css.textContent = '#aic{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(10,30,25,.45);padding:16px}'
    + '#aic .aic-b{background:#fff;color:#17211E;border-radius:16px;max-width:440px;width:100%;padding:20px 22px;box-shadow:0 20px 60px rgba(0,0,0,.25)}'
    + '#aic h2{margin:0 0 8px;font-size:18px}#aic p{margin:0 0 12px;font-size:13.5px;line-height:1.6;color:#3B524B;word-break:keep-all}'
    + '#aic .aic-c{display:flex;gap:8px;align-items:center;font-size:14px;font-weight:700;margin:0 0 14px}#aic .aic-c input{width:20px;height:20px}'
    + '#aic .aic-a{display:flex;gap:8px;justify-content:flex-end}#aic .aic-a button{font:inherit;font-weight:700;padding:10px 16px;border-radius:10px;border:1px solid #DDE3DF;background:#fff;cursor:pointer}'
    + '#aic .aic-a .y{background:linear-gradient(135deg,#0E8F6A,#0B7FA0);color:#fff;border:0}#aic .aic-a .y:disabled{opacity:.45;cursor:not-allowed}';
  document.head.appendChild(css);
})();
