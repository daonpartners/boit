// 문서 보관함 (2026-11-23 대표 결정): 제안서·리포트를 저장(PDF·워드)할 때 서버에 7일 보관
// - 저장 위치: Supabase Storage 'boit-docs'(비공개, 본인 폴더만) + 목록 표 boit_docs
// - 7일 뒤 자동 삭제(서버 docs-purge 매일 + 이 화면이 로그인 때 자기 만료분 정리)
// - 삭제 2일 전부터 로그인할 때 "내려받으세요" 알림, 목록에 남은 날 표시
// - 찾는 곳: 왼쪽 메뉴 제안·영업 > 문서 보관함 (2026-11-24 이동), 고객 상세 '만든 문서'
(function(){
  var DAYS = 7, WARN_DAYS = 2, BUCKET = 'boit-docs';
  var MIME = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  function g(n){ try { return eval(n); } catch (e) { return undefined; } }
  function cloud(){ var C = g('CLOUD'); return C && C.sb && C.user ? C : null; }
  function me(){ return g('ME') || {}; }
  function custs(){ return g('CUSTOMERS') || []; }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function note(t, k){ if (typeof window.notify === 'function') window.notify(t, k || 'info'); }
  function left(exp){ return Math.max(0, Math.ceil((new Date(exp) - Date.now()) / 864e5)); }
  function ymd(d){ d = new Date(d); return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0'); }

  // 어떤 파일을 보관할지: PDF·워드 중 이름에 '제안서'·'리포트'가 있는 것
  function kindOf(name){
    if (!/\.(pdf|docx)$/i.test(name) || !/(제안서|리포트)/.test(name)) return '';
    if (/보장비교제안서/.test(name)) return 'AI 비교제안서';
    if (/^제안서_/.test(name)) return '제안서 꾸미기';
    var m = name.match(/[가-힣]*(제안서|리포트)/); return m ? m[0] : '문서';
  }
  function custOf(name){
    var best = null;
    custs().forEach(function(c){ if (c && c.name && c.name.length >= 2 && name.indexOf(c.name) >= 0 && (!best || c.name.length > best.name.length)) best = c; });
    if (best) return { id: String(best.id), name: best.name };
    var seg = name.replace(/\.(pdf|docx)$/i, '').split('_').filter(function(s){ return s && !/(제안서|리포트|^\d{6,8}$)/.test(s); });
    return { id: '', name: seg[0] || '' };
  }

  var SKIP = false;
  async function keep(filename, blob){
    var C = cloud(), M = me(); if (!C || M.demo || SKIP) return;
    var kind = kindOf(filename); if (!kind || !blob || !blob.size) return;
    var ext = filename.match(/\.(pdf|docx)$/i)[1].toLowerCase();
    var id = (crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, function(c){ return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16); }));
    var path = C.user.id + '/' + id + '.' + ext, cu = custOf(filename);
    try {
      var up = await C.sb.storage.from(BUCKET).upload(path, blob, { contentType: MIME[ext], upsert: false });
      if (up.error) throw up.error;
      var ins = await C.sb.from('boit_docs').insert({ id: id, path: path, filename: filename, kind: kind, cust_name: cu.name, cust_id: cu.id, size: blob.size,
        expires_at: new Date(Date.now() + DAYS * 864e5).toISOString() });
      if (ins.error) { await C.sb.storage.from(BUCKET).remove([path]); throw ins.error; }
      note('문서 보관함에 ' + DAYS + '일 동안 보관했습니다. (' + kind + (cu.name ? ' · ' + cu.name : '') + ')', 'ok');
      if (VIS()) render();
    } catch (e) { note('문서 보관함 저장에 실패했습니다. 내려받은 파일은 그대로 있습니다.', 'warn'); }
  }

  // DL.save 를 감싸서, 저장에 성공한 제안서·리포트만 보관
  function wrap(){
    var D = g('DL'); if (!D || D.__vault || typeof D.save !== 'function') return;
    var orig = D;
    var W = { __vault: true, save: async function(a){ var r = await orig.save(a); try { if (a && a.filename) keep(a.filename, a.data); } catch (e) {} return r; } };
    for (var k in orig) if (!(k in W)) W[k] = orig[k];
    try { DL = W; } catch (e) {}
  }
  setInterval(wrap, 1500); wrap();

  async function list(custId, custName){
    var C = cloud(); if (!C) return null;
    var q = C.sb.from('boit_docs').select('id,path,filename,kind,cust_name,cust_id,size,created_at,expires_at').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(300);
    if (custId) q = q.or('cust_id.eq.' + custId + (custName ? ',cust_name.eq.' + custName : ''));
    var r = await q; return r.error ? null : r.data;
  }
  async function getFile(row){
    var C = cloud(); if (!C) return;
    var r = await C.sb.storage.from(BUCKET).download(row.path);
    if (r.error || !r.data) { note('파일을 받지 못했습니다. 이미 삭제됐을 수 있습니다.', 'warn'); return; }
    var D = g('DL'); SKIP = true;
    try { if (D && D.save) await D.save({ filename: row.filename, data: r.data }); note('내려받았습니다: ' + row.filename, 'ok'); }
    catch (e) { if (!(e && e.code === 'declined')) note('저장하지 못했습니다.', 'warn'); }
    finally { SKIP = false; }
  }
  async function del(row){
    if (!confirm('"' + row.filename + '"을(를) 보관함에서 지울까요? 되돌릴 수 없습니다.')) return;
    var C = cloud(); if (!C) return;
    await C.sb.storage.from(BUCKET).remove([row.path]);
    var r = await C.sb.from('boit_docs').delete().eq('id', row.id);
    note(r.error ? '삭제하지 못했습니다.' : '보관함에서 지웠습니다.', r.error ? 'warn' : 'ok');
  }
  function table(rows){
    if (!rows || !rows.length) return '<p class="note" style="margin:6px 0 0">보관된 문서가 없습니다. 제안서·리포트를 PDF·워드로 저장하면 여기에 ' + DAYS + '일 동안 보관됩니다.</p>';
    return '<div class="dv-list">' + rows.map(function(r){
      var d = left(r.expires_at);
      return '<div class="dv-row' + (d <= WARN_DAYS ? ' soon' : '') + '"><div class="dv-m"><b>' + esc(r.kind) + (r.cust_name ? ' · ' + esc(r.cust_name) : '') + '</b><small>' + esc(r.filename) + ' · ' + ymd(r.created_at) + ' 만듦</small></div>'
        + '<span class="dv-d">' + (d <= 0 ? '오늘 삭제' : d + '일 남음') + '</span>'
        + '<button type="button" class="btn sm primary" data-dvget="' + r.id + '">내려받기</button><button type="button" class="btn sm" data-dvdel="' + r.id + '">삭제</button></div>';
    }).join('') + '</div>';
  }
  var ROWS = {};
  function remember(rows){ (rows || []).forEach(function(r){ ROWS[r.id] = r; }); }
  document.addEventListener('click', async function(e){
    var a = e.target.closest && e.target.closest('[data-dvget],[data-dvdel],[data-go="vault"]');
    if (!a) return;
    if (a.dataset.dvget) { var r = ROWS[a.dataset.dvget]; if (r) getFile(r); }
    else if (a.dataset.dvdel) { var r2 = ROWS[a.dataset.dvdel]; if (r2) { await del(r2); render(); custPanel(); } }
    else setTimeout(render, 30);
  });

  // 문서 보관함 화면
  function VIS(){ var s = document.querySelector('section[data-view="vault"]'); return s && !s.hidden; }
  async function render(){
    var box = document.getElementById('dv-root'); if (!box) return;
    if (me().demo || !cloud()) { box.innerHTML = '<p class="note">문서 보관함은 회원가입·로그인 후 쓸 수 있습니다.</p>'; return; }
    box.innerHTML = '<p class="note">불러오는 중…</p>';
    var rows = await list(); remember(rows);
    box.innerHTML = rows === null ? '<p class="note err">목록을 불러오지 못했습니다.</p>' : table(rows);
  }
  // 고객 상세 '만든 문서'
  async function custPanel(){
    var sec = document.querySelector('section[data-view="cust"]'); if (!sec || sec.hidden) return;
    var cur = g('CUR'), c = custs().find(function(x){ return x.id === cur; }); if (!c) return;
    var p = document.getElementById('dv-cust');
    if (!p) { p = document.createElement('div'); p.id = 'dv-cust'; p.className = 'panel'; p.style.marginTop = '14px'; sec.appendChild(p); }
    if (me().demo || !cloud()) { p.innerHTML = '<h2>만든 문서</h2><p class="note" style="margin:6px 0 0">회원가입 후 이 고객에게 만든 제안서·리포트가 ' + DAYS + '일 동안 여기에 보관됩니다.</p>'; return; }
    p.innerHTML = '<h2>만든 문서 <small class="note">(' + DAYS + '일 보관 후 자동 삭제)</small></h2><p class="note">불러오는 중…</p>';
    var rows = await list(String(c.id), c.name); remember(rows);
    p.innerHTML = '<h2>만든 문서 <small class="note">(' + DAYS + '일 보관 후 자동 삭제)</small></h2>' + (rows === null ? '<p class="note err">불러오지 못했습니다.</p>' : table(rows));
  }
  new MutationObserver(function(ms){
    ms.forEach(function(m){ if (m.attributeName === 'hidden' && !m.target.hidden) {
      if (m.target.dataset.view === 'vault') render();
      if (m.target.dataset.view === 'cust') custPanel();
    } });
  }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['hidden'] });

  // 로그인 뒤 1번: 만료분 정리 + 삭제 임박 알림
  var done = false;
  async function onLogin(){
    var C = cloud(); if (done || !C || me().demo) return; done = true;
    try {
      var ex = await C.sb.from('boit_docs').select('id,path').lt('expires_at', new Date().toISOString()).limit(200);
      if (ex.data && ex.data.length) { await C.sb.storage.from(BUCKET).remove(ex.data.map(function(r){ return r.path; })); await C.sb.from('boit_docs').delete().in('id', ex.data.map(function(r){ return r.id; })); }
      var soon = await C.sb.from('boit_docs').select('id,expires_at').gt('expires_at', new Date().toISOString()).lt('expires_at', new Date(Date.now() + WARN_DAYS * 864e5).toISOString());
      var n = soon.data ? soon.data.length : 0;
      var key = 'boit_dv_warn_' + new Date().toISOString().slice(0, 10);
      if (n && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        var w = document.createElement('div'); w.className = 'dv-warn'; w.setAttribute('role', 'alertdialog');
        w.innerHTML = '<div><b>보관 문서 ' + n + '건이 곧 삭제됩니다</b><p>문서 보관함의 제안서·리포트는 만든 날부터 ' + DAYS + '일 뒤 자동으로 지워집니다. 필요한 문서는 지금 내려받으세요.</p>'
          + '<div class="row"><button type="button" class="btn primary" data-go="vault">보관함 열기</button><button type="button" class="btn" data-dvx="1">나중에</button></div></div>';
        document.body.appendChild(w);
        w.addEventListener('click', function(e){ if (e.target.closest('[data-go],[data-dvx]')) w.remove(); });
      }
    } catch (e) {}
  }
  setInterval(onLogin, 3000);

  var css = document.createElement('style');
  css.textContent = '.dv-list{display:flex;flex-direction:column;gap:6px;margin-top:8px}.dv-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:8px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}'
    + '.dv-row.soon{border-color:#F3B26B;background:#FFF8EF}.dv-m b{display:block;font-size:14.5px}.dv-m small{color:var(--muted);font-size:12px;word-break:break-all}.dv-d{font-size:12.5px;font-weight:700;color:var(--accent);white-space:nowrap}.dv-row.soon .dv-d{color:#B4610A}'
    + '@media(max-width:640px){.dv-row{grid-template-columns:minmax(0,1fr) auto}.dv-row .dv-d{grid-column:2;grid-row:1}.dv-row .btn{grid-row:2}}'
    + '.dv-warn{position:fixed;inset:0;z-index:9998;display:grid;place-items:center;background:rgba(10,30,25,.4);padding:16px}.dv-warn>div{background:#fff;border-radius:16px;max-width:420px;padding:20px 22px;box-shadow:0 20px 60px rgba(0,0,0,.25)}.dv-warn b{font-size:17px}.dv-warn p{font-size:14px;color:#3B524B;margin:8px 0 14px}.dv-warn .row{display:flex;gap:8px;justify-content:flex-end}';
  document.head.appendChild(css);
})();
