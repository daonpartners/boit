// AI 기능 국외이전 동의 (2026-11-23 대표 지시로 방식 변경)
// - 회원가입 화면 '[선택] 개인정보 국외 이전 동의 (AI 기능)'로 받음 (가입 정보 ai_ok에 시각 기록 → 계정 ME.aiOk)
// - 이미 가입한 회원: 마이페이지 › 회원 정보의 같은 체크칸 한 줄로 동의·철회 (별도 팝업·상자 없음)
// - 동의하지 않은 회원이 AI 버튼을 누르면 AI 요청만 막고 안내 문구를 돌려줌
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
    if (at) { m.aiOk = { v: AI_V, at: at, how: '가입' }; m.aiOkLog = [{ v: AI_V, at: at, act: '동의(가입)' }]; try { cloudSave(true); } catch (e) {} paint(); }
  }, 2000);

  var of = window.fetch.bind(window);
  window.fetch = async function(input, init){
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf(HOST) < 0) return of(input, init);
    var m = me();
    if (m && m.demo) return resp('체험 모드에서는 AI 기능을 쓸 수 없습니다. 회원가입 후 사용하세요.');
    if (!ok()) return resp("AI 기능은 '개인정보 국외 이전 동의(AI)'를 한 회원만 쓸 수 있습니다. 마이페이지 › 회원 정보에서 체크하면 바로 쓸 수 있습니다.");
    if (init && typeof init.body === 'string') init = Object.assign({}, init, { body: mask(init.body) });
    return of(input, init);
  };

  // 마이페이지 › 회원 정보: 체크칸 한 줄
  function paint(){
    var f = document.getElementById('f-me'); if (!f) return;
    var row = document.getElementById('mp-ai-row');
    if (!row) {
      row = document.createElement('label'); row.id = 'mp-ai-row'; row.className = 'note';
      row.style.cssText = 'display:flex;gap:8px;align-items:flex-start;margin:0';
      row.innerHTML = '<input type="checkbox" id="mp-ai" style="margin-top:3px"><span>[선택] 개인정보 국외 이전 동의 (AI 비교제안서·설계서 읽기·온라인 자동화: OpenAI·미국, n8n·독일) <a href="privacy.html" target="_blank" rel="noopener">보기</a> <span id="mp-ai-at"></span></span>';
      var rows = f.querySelectorAll(':scope > .row'), last = rows[rows.length - 1];
      f.insertBefore(row, last || null);
      row.querySelector('#mp-ai').addEventListener('change', function(e){
        setOk(e.target.checked); paint();
        if (typeof window.notify === 'function') window.notify(e.target.checked ? 'AI 기능 국외 이전에 동의했습니다.' : '동의를 철회했습니다. AI 기능으로 정보를 보내지 않습니다.', 'ok');
      });
    }
    var m = me() || {}, on = ok();
    row.querySelector('#mp-ai').checked = on;
    row.querySelector('#mp-ai-at').textContent = m.aiOk && m.aiOk.at ? '· ' + (on ? '동의' : '철회') + ' ' + new Date(m.aiOk.at).toLocaleDateString('ko-KR') : '';
  }
  document.addEventListener('click', function(e){ if (e.target.closest && e.target.closest('[data-go="mypage"],[data-mp="info"]')) setTimeout(paint, 60); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paint); else paint();
})();
