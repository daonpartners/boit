// AI 기능 국외이전 안내·동의 (2026-11-23 대표 지시: 보픽 방식으로 위험 최소화)
// 1) AI 서버(n8n → OpenAI)로 가는 모든 요청 앞에서 'AI로 보내는 정보' 안내 → 동의해야 전송
// 2) 동의는 계정에 저장(서버 app_state.me.aiOk) + 기록(aiOkLog), 마이페이지에서 언제든 거두기
// 3) 보내기 전 브라우저에서 주민등록번호·휴대폰번호·이메일 형식을 가림
// 4) 체험 모드는 AI 전송 안 함
(function(){
  var AI_V = '2026-11-23';
  var HOST = 'daonpartners.app.n8n.cloud/webhook/';
  function me(){ try { return typeof ME !== 'undefined' ? ME : null; } catch (e) { return null; } }
  function ok(){ var m = me(); return !!(m && m.aiOk && m.aiOk.v === AI_V && !m.aiOk.off); }
  function save(){ try { if (typeof cloudSave === 'function') cloudSave(true); } catch (e) {} }
  function setOk(on){
    var m = me(); if (!m) return;
    var at = new Date().toISOString();
    m.aiOk = on ? { v: AI_V, at: at } : { v: AI_V, at: at, off: true };
    m.aiOkLog = (Array.isArray(m.aiOkLog) ? m.aiOkLog : []).concat([{ v: AI_V, at: at, act: on ? '동의' : '거둠' }]).slice(-20);
    save(); paintMy();
  }
  function mask(t){
    return String(t)
      .replace(/(\d{2})(\d{4})\s*-\s*([1-8])\d{6}/g, '$1****-$3******')
      .replace(/\b(\d{6})([1-8])\d{6}\b/g, '******$2******')
      .replace(/(01[016789])\s*-?\s*\d{3,4}\s*-?\s*(\d{4})/g, '$1-****-$2')
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '(이메일 가림)');
  }
  function resp(msg){ return new Response(JSON.stringify({ ok: false, error: msg }), { status: 200, headers: { 'Content-Type': 'application/json' } }); }

  var INFO = ''
    + '<div class="aic-t"><div class="k">받는 곳</div><div class="v"><b>OpenAI, L.L.C.</b> (미국) — AI 문안·표 정리<br>중계: <b>n8n GmbH</b> (독일 프랑크푸르트 서버)</div>'
    + '<div class="k">보내는 때</div><div class="v">AI 버튼을 누를 때만, 암호화 통신(HTTPS)으로</div>'
    + '<div class="k">보내는 항목</div><div class="v"><b>AI 비교제안서·설계서 담보표 읽기</b>: 설계서·보장분석의 상품명·담보·가입금액·보험료와 설계서 본문 글자(피보험자 이름·나이·성별이 적혀 있으면 함께 전송)<br>'
    + '<b>온라인 자동화</b>(블로그 글·키워드·사업장 글): 회원이 입력한 키워드·글감·사업장 정보</div>'
    + '<div class="k">가리는 것</div><div class="v">주민등록번호·휴대폰번호·이메일 형식은 <b>보내기 전에 이 화면에서 가립니다</b></div>'
    + '<div class="k">보관 기간</div><div class="v">OpenAI: 최대 30일 뒤 삭제, AI 학습에 쓰지 않음 (API 기본 정책) · n8n: 실행 기록 보관 기간 뒤 삭제</div>'
    + '<div class="k">근거</div><div class="v">개인정보 보호법 제28조의8 ①3호 가목(미국), ①5호(독일 — EU 동등성 인정) · <a href="privacy.html" target="_blank" rel="noopener">개인정보처리방침 7항</a></div>'
    + '<div class="k">동의하지 않으면</div><div class="v">AI 기능만 쓸 수 없고, 고객관리·청구·문자 등 나머지는 그대로 쓸 수 있습니다. 마이페이지에서 언제든 거둘 수 있습니다</div></div>'
    + '<p class="aic-w">고객의 건강정보나 고객이 동의하지 않은 정보가 담긴 설계서는 올리지 마세요. 고객정보 처리 책임은 회원(설계사)에게 있습니다(이용약관 제10조).</p>';

  var css = document.createElement('style');
  css.textContent = '#aic{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(10,30,25,.45);padding:16px}'
    + '#aic .aic-b{background:#fff;color:#17211E;border-radius:16px;max-width:560px;width:100%;max-height:90vh;overflow:auto;padding:20px 22px;box-shadow:0 20px 60px rgba(0,0,0,.25)}'
    + '#aic h2{margin:0 0 4px;font-size:19px}#aic .aic-s{margin:0 0 12px;color:#5E6B66;font-size:13.5px}'
    + '.aic-t{display:grid;grid-template-columns:100px minmax(0,1fr);font-size:13px;line-height:1.55}.aic-t>div{padding:7px 0;border-bottom:1px solid #E1EAE6;min-width:0;white-space:normal;word-break:break-all;overflow-wrap:anywhere}.aic-t .k{color:#0A6B52;font-weight:700;padding-right:8px;word-break:keep-all}'
    + '.aic-w{background:#FFF8E6;border:1px solid #F3D38A;border-radius:10px;padding:8px 10px;font-size:12.5px;margin:12px 0}'
    + '#aic label.aic-c{display:flex;gap:8px;align-items:flex-start;font-size:14px;font-weight:600;margin:6px 0 14px}#aic label.aic-c input{width:20px;height:20px;margin-top:1px}'
    + '#aic .aic-a{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}#aic .aic-a button{font:inherit;font-weight:700;padding:11px 18px;border-radius:10px;border:1px solid #DDE3DF;background:#fff;cursor:pointer}'
    + '#aic .aic-a .y{background:linear-gradient(135deg,#0E8F6A,#0B7FA0);color:#fff;border:0}#aic .aic-a .y:disabled{opacity:.45;cursor:not-allowed}'
    + '#aic-my{margin-top:14px;max-width:720px}#aic-my h2{font-size:17px;margin:0 0 6px}#aic-my .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}';
  document.head.appendChild(css);

  var pending = null;
  function ask(viewOnly){
    if (pending && !viewOnly) return pending;
    var p = new Promise(function(res){
      var w = document.createElement('div'); w.id = 'aic'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-labelledby', 'aic-h');
      w.innerHTML = '<div class="aic-b"><h2 id="aic-h">AI로 보내는 정보</h2><p class="aic-s">AI 기능은 아래 업체로 정보를 보내 결과를 만듭니다. 처음 한 번 확인하고 동의해 주세요.</p>' + INFO
        + (viewOnly ? '<div class="aic-a"><button type="button" class="n">닫기</button></div>'
          : '<label class="aic-c"><input type="checkbox" id="aic-chk"> 위 내용(국외 이전 포함)을 확인했고, AI 기능 사용에 동의합니다</label><div class="aic-a"><button type="button" class="n">동의하지 않음</button><button type="button" class="y" disabled>동의하고 계속</button></div>')
        + '</div>';
      document.body.appendChild(w);
      var chk = w.querySelector('#aic-chk'), y = w.querySelector('.y'), n = w.querySelector('.n');
      function done(v){ w.remove(); pending = null; res(v); }
      if (chk) chk.addEventListener('change', function(){ y.disabled = !chk.checked; });
      if (y) y.addEventListener('click', function(){ setOk(true); done(true); });
      n.addEventListener('click', function(){ done(false); });
      w.addEventListener('keydown', function(e){ if (e.key === 'Escape') done(false); });
      (chk || n).focus();
    });
    if (!viewOnly) pending = p;
    return p;
  }

  var of = window.fetch.bind(window);
  window.fetch = async function(input, init){
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf(HOST) < 0) return of(input, init);
    var m = me();
    if (m && m.demo) return resp('체험 모드에서는 AI 기능을 쓸 수 없습니다. 회원가입 후 사용하세요.');
    if (!ok()) {
      var yes = await ask(false);
      if (!yes) return resp("AI 기능을 쓰려면 'AI로 보내는 정보'에 동의해야 합니다. 동의하지 않아도 다른 기능은 그대로 쓸 수 있습니다.");
    }
    if (init && typeof init.body === 'string') init = Object.assign({}, init, { body: mask(init.body) });
    return of(input, init);
  };

  // 마이페이지: 동의 상태 보기·거두기
  function paintMy(){
    var sec = document.querySelector('section[data-view="mypage"]'); if (!sec) return;
    var box = document.getElementById('aic-my');
    if (!box) { box = document.createElement('div'); box.id = 'aic-my'; box.className = 'panel'; sec.appendChild(box); }
    var m = me(), on = ok(), at = m && m.aiOk && m.aiOk.at ? new Date(m.aiOk.at).toLocaleString('ko-KR') : '';
    box.innerHTML = '<h2>AI로 보내는 정보 · 동의 관리</h2><p class="note" style="margin:0 0 10px">'
      + (on ? '동의함 (' + at + ') — AI 비교제안서·설계서 읽기·온라인 자동화에서 OpenAI(미국)로 정보를 보냅니다.'
            : (m && m.aiOk && m.aiOk.off ? '동의를 거둔 상태입니다 (' + at + '). AI 기능을 누르면 다시 안내합니다.' : '아직 동의하지 않았습니다. AI 기능을 처음 누를 때 안내합니다.'))
      + '</p><div class="row"><button type="button" class="btn" id="aic-view">보내는 정보 보기</button>'
      + (on ? '<button type="button" class="btn" id="aic-off">동의 거두기</button>' : '') + '</div>';
    box.querySelector('#aic-view').onclick = function(){ ask(true); };
    var off = box.querySelector('#aic-off');
    if (off) off.onclick = function(){ setOk(false); if (typeof window.notify === 'function') window.notify('AI 기능 동의를 거뒀습니다. 이제 AI 정보는 보내지 않습니다.', 'ok'); };
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-go="mypage"]');
    if (b) setTimeout(paintMy, 50);
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintMy); else paintMy();
})();
