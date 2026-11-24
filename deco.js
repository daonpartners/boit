/* 제안서 꾸미기 (보잇 메뉴 '제안서 꾸미기', 옛 이름 보상제안서) — 2026-11-17
   - 설계서 PDF를 올리면 원본 장을 그대로 화면에 보여 줌
   - 설계사가 원본 위에 형광펜·글자(색·크기)·손글씨 펜·특수문자·그림문자를 넣음
   - AI 기본 꾸미기: 중심 담보 줄 끝에 담보명에 없는 내용(어떤 수술·진단이면 얼마, 등급별 금액, 한도)만 메모 — 금액만 되풀이하는 메모는 넣지 않음(2026-11-24) + 형광펜은 '연간 1회'·'최초 1회'·'회당' 같은 횟수 포인트에만
   - 담보 설명 넣기: 약관사전(grow report/bosang.js)에 있는 회사는 약관 별표·질병코드 범위를 글상자로 넣음
   - 담보 읽기·금액 계산은 grow.ai.kr/report/bosang.js(BOSANG) 그대로 사용, 이 파일은 화면·꾸미기만 담당
   - 꾸민 내용은 이 화면에서만 (저장 안 함). PDF 다운로드·바로 출력에 그대로 들어감
   - 2026-11-24 대표 지시: 색상 메모지 · 말풍선 · 도형(네모·동그라미·선·화살표) · 선 굵기 · 글꼴 고르기 추가. 메모지·말풍선·그림·도형은 크기 조절 */
(function () {
  "use strict";
  const $ = q => document.querySelector(q), $$ = q => [...document.querySelectorAll(q)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const B = () => window.BOSANG;
  const TOUCH = matchMedia("(pointer:coarse)").matches;
  /* 휴대폰: 처음엔 '선택·이동'(손가락으로 화면 내리기 가능). 형광펜 등 그리기 도구를 고르면 그 동안은 화면이 안 내려감 (2026-11-24 대표: 내리다가 형광펜이 칠해짐) */
  const S = { mini: matchMedia("(max-width:760px)").matches, docs: [], tool: TOUCH ? "move" : "hl", hl: "#ffe066", color: "#d6336c", size: 2.0, guide: false, undo: [], memo: "#fff3a8", shape: "rect", lw: 0.35, font: "" };
  const MEMOC = [["#fff3a8", "노랑"], ["#ffd6e7", "분홍"], ["#d3f9d8", "연두"], ["#d0ebff", "하늘"], ["#ffe8cc", "주황"], ["#e5dbff", "보라"]];
  const SHAPES = [["rowbox", "▤ 줄 감싸기"], ["rect", "▭ 네모"], ["ell", "◯ 동그라미"], ["line", "╱ 선"], ["arrow", "→ 화살표"]];
  const LWS = [[0.2, "가늘게"], [0.35, "보통"], [0.6, "굵게"], [1, "아주 굵게"]];
  const FONTS = [["", "기본"], ["'Gowun Batang'", "명조"], ["'Nanum Pen Script'", "손글씨"], ["'Black Han Sans'", "굵은 제목"], ["'Jua'", "둥근"], ["'Nanum Gothic Coding'", "타자체"]];
  (function () { if (document.getElementById("dc-fonts")) return; const l = document.createElement("link"); l.id = "dc-fonts"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&family=Black+Han+Sans&family=Jua&family=Nanum+Gothic+Coding&display=swap"; document.head.appendChild(l); })();
  const HLC = [["#ffe066", "노랑"], ["#a9e34b", "연두"], ["#8ce99a", "초록"], ["#faa2c1", "분홍"], ["#74c0fc", "하늘"], ["#d0bfff", "보라"], ["#ffc078", "주황"]];
  const TXC = [["#d6336c", "빨강"], ["#1c7ed6", "파랑"], ["#2b8a3e", "초록"], ["#e8590c", "주황"], ["#7048e8", "보라"], ["#111111", "검정"]];
  const SIZES = [[1.5, "작게"], [2.0, "보통"], [2.8, "크게"], [3.8, "아주 크게"], [5.2, "제목"]];
  const SYM = "★☆✔✓●○◎◆◇■□▲△▶▷→←↑↓⇒※①②③④⑤⑥⑦⑧⑨⑩♥♡☎✚＋－×÷＝％￦【】「」『』〈〉·…".split("");
  const EMO = ["👍", "✅", "⭐", "🔥", "💡", "💰", "💵", "🏥", "💊", "🩺", "🚗", "🚑", "❤️", "😊", "🙏", "💪", "📌", "⚠️", "❗", "🎯", "👉", "👆", "📞", "🛡️"];
  const GNOTE = { dx: "진단 시", txc: "치료 시", txb: "치료 시", dem: "해당 시", surg: "수술 시", care: "간병인 사용 1일", drv: "한도", base: "" };

  /* ---------- 화면 틀 ---------- */
  function shell() {
    const sec = $('section[data-view="bosang"]'); if (!sec || sec.dataset.dc) return; sec.dataset.dc = "1";
    sec.innerHTML = `<div class="row between"><div><h1>제안서 꾸미기</h1></div><button class="lnk" type="button" data-go="proposal">담보 전후 비교 제안서</button></div>
    <div class="panel docbar" style="margin-top:14px">
      <label class="btn primary" style="cursor:pointer">설계서 PDF 올리기<input id="dc-file" type="file" accept="application/pdf,.pdf" multiple hidden></label>
      <button class="btn" id="dc-pdf" type="button" disabled>PDF 다운로드</button>
      <button class="btn" id="dc-print" type="button" disabled>바로 출력</button>
      <label class="note" style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="dc-guide"> 보험금예상안내서 2장도 붙이기</label>
      <span class="note" id="dc-msg" style="flex-basis:100%">설계서를 올리면 원본이 그대로 나오고, AI가 중심 담보 옆에 보상금액을 적고, 형광펜은 '연간 1회' 같은 횟수 포인트에만 칠합니다. 더 강조할 곳은 형광펜으로 직접 그으세요. 그 위에 자유롭게 꾸미세요.</span>
    </div>
    <div class="panel" id="dc-list" style="margin-top:12px"></div>
    <div class="dc-work"><div class="dc-bar" id="dc-bar" hidden></div>
    <div class="dc-sheets" id="dc-sheets"></div></div>`;
  }
  function bar() {
    const b = $("#dc-bar"); if (!b) return; b.hidden = !S.docs.length;
    const T = [["move", "✋ 선택·이동"], ["hl", "🖍 형광펜"], ["text", "T 글자"], ["memo", "🗒 메모지"], ["bubble", "💬 말풍선"], ["shape", "⬜ 도형"], ["pen", "✏ 펜"], ["erase", "⌫ 지우개"]];
    b.innerHTML = `<div class="dc-row">${T.map(([k, t]) => `<button type="button" class="dc-t${S.tool === k ? " on" : ""}" data-dct="${k}">${t}</button>`).join("")}
      <label class="dc-t" style="cursor:pointer">🖼 그림 넣기<input id="dc-img" type="file" accept="image/*" multiple hidden></label>
      <span class="dc-sep"></span><button type="button" class="dc-t" id="dc-undo">↶ 되돌리기</button>${TOUCH && S.tool !== "move" ? `<button type="button" class="dc-t dc-lock" data-dct="move">🔒 그리는 중 · 화면 내리기 ✋</button>` : ""}<button type="button" class="dc-t dc-minib" data-dcmini="1">${S.mini ? "🎨 색·크기·도형 ▾" : "접기 ▴"}</button></div>
    <div class="dc-optbox${S.mini ? " mini" : ""}">
    <div class="dc-row"><span class="dc-lb">형광펜</span>${HLC.map(([c, n]) => `<button type="button" class="dc-sw${S.hl === c ? " on" : ""}" data-dch="${c}" title="${n}" style="background:${c}"></button>`).join("")}
      <span class="dc-sep"></span><span class="dc-lb">글자·펜 색</span>${TXC.map(([c, n]) => `<button type="button" class="dc-sw${S.color === c ? " on" : ""}" data-dcc="${c}" title="${n}" style="background:${c}"></button>`).join("")}<input type="color" id="dc-cpick" value="${S.color}" title="다른 색">
      <span class="dc-sep"></span><span class="dc-lb">크기</span>${SIZES.map(([v, n]) => `<button type="button" class="dc-t sm${S.size === v ? " on" : ""}" data-dcs="${v}">${n}</button>`).join("")}
      <button type="button" class="dc-t sm" data-dcfmt="bold"><b>굵게</b></button><button type="button" class="dc-t sm" data-dcfmt="underline"><u>밑줄</u></button><button type="button" class="dc-t sm" data-dcfmt="strikeThrough"><s>취소선</s></button><button type="button" class="dc-t sm" data-dcbox="1">▭ 테두리 글상자</button></div>
    <div class="dc-row"><span class="dc-lb">글꼴</span>${FONTS.map(([f, n]) => `<button type="button" class="dc-t sm${S.font === f ? " on" : ""}" data-dcf="${esc(f)}" style="${f ? `font-family:${esc(f)};font-size:14px` : ""}">${n}</button>`).join("")}
      <span class="dc-sep"></span><span class="dc-lb">메모지</span>${MEMOC.map(([c, n]) => `<button type="button" class="dc-sw sq${S.memo === c ? " on" : ""}" data-dcm="${c}" title="${n} 메모지" style="background:${c}"></button>`).join("")}</div>
    <div class="dc-row"><span class="dc-lb">도형</span>${SHAPES.map(([k, n]) => `<button type="button" class="dc-t sm${S.tool === "shape" && S.shape === k ? " on" : ""}" data-dcsh="${k}">${n}</button>`).join("")}
      <span class="dc-sep"></span><span class="dc-lb">선 굵기 (펜·도형)</span>${LWS.map(([v, n]) => `<button type="button" class="dc-t sm${S.lw === v ? " on" : ""}" data-dclw="${v}">${n}</button>`).join("")}</div>
    <details class="dc-row dc-more"><summary>특수문자 · 그림문자 <small class="note">글자 칸을 누른 뒤 고르면 그 자리에 들어가고, 아니면 새 글자 칸이 생깁니다</small></summary>
      <div class="dc-pal">${SYM.map(c => `<button type="button" data-dcins="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <div class="dc-pal dc-emo">${EMO.map(c => `<button type="button" data-dcins="${c}">${c}</button>`).join("")}</div></details>
    <details class="dc-row dc-more"><summary>담보 설명 넣기 <small class="note">담보를 누르면 그 줄 아래에 설명 글상자가 생깁니다 (약관 등록 회사는 약관 별표 범위 포함)</small></summary><div class="dc-cov">${covList()}</div></details>
    <div class="dc-row"><button type="button" class="dc-t sm" id="dc-ai">AI 기본 꾸미기 다시</button><button type="button" class="dc-t sm" id="dc-clear">꾸민 것 모두 지우기</button><span class="note" id="dc-tip">${tip()}</span></div></div>`;
  }
  const tip = () => (TOUCH && S.tool !== "move" ? "✋ 선택·이동을 누르면 손가락으로 화면을 내릴 수 있습니다. 지금은 그리기 상태라 화면이 안 내려갑니다. " : "") + ({ move: "글상자·형광펜의 ⠿ 손잡이를 끌어 옮기고, × 로 지웁니다. 그림·도형은 그대로 끌어 옮기고, 파란 모서리로 크기를 바꿉니다.", hl: "강조할 곳을 끌어서 칠하세요. 글줄 위에 대충 그어도 줄 높이에 맞춰집니다.", text: "글을 넣을 곳을 누르세요.", memo: "메모지를 붙일 곳을 누르고 글을 쓰세요. 파란 모서리로 폭을 바꿉니다.", bubble: "말풍선을 넣을 곳을 누르고 글을 쓰세요. 테두리 색은 '글자·펜 색'을 따릅니다.", shape: S.shape === "rowbox" ? "감쌀 줄들을 위에서 아래로 끌면 그 줄들에 딱 맞는 네모가 생깁니다." : "도형을 고르고 끌어서 그리세요. 색은 '글자·펜 색', 두께는 '선 굵기'.", pen: "손가락·마우스로 그리세요.", erase: "지울 형광펜·글자를 누르세요. 펜은 그은 곳을 문지르면 지워집니다." })[S.tool];
  function covList() {
    return S.docs.map((d, di) => `<div><b>${esc(d.M.p.insured || "고객")} · ${esc(d.M.p.company)}</b><div class="dc-chips">${d.M.p.items.filter(i => !i.group).map((it, ii) => `<button type="button" data-dccov="${di}:${ii}">${esc(it.name)}${it.amt != null ? ` <small>${esc(B().fmt(it.amt))}</small>` : ""}</button>`).join("")}</div></div>`).join("");
  }

  /* ---------- PDF → 장 그림 + 글자 위치 ---------- */
  async function loadPages(file) {
    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await window.pdfjsLib.getDocument({ data, isEvalSupported: false }).promise, pages = [];
    const n = Math.min(doc.numPages, 30);
    for (let i = 1; i <= n; i++) {
      const pg = await doc.getPage(i), v1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: 2 });
      const cv = document.createElement("canvas"); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
      const cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height);
      await pg.render({ canvasContext: cx, viewport: vp }).promise;
      const tc = await pg.getTextContent(), rows = [];
      for (const it of tc.items) {
        const s = it.str; if (!s || !s.trim()) continue;
        const x = it.transform[4], y = it.transform[5], h = Math.abs(it.transform[3]) || 8, w = it.width || s.length * 5;
        let r = rows.find(r => Math.abs(r.y - y) < 2.5); if (!r) { r = { y, h, x0: x, x1: x + w, t: [] }; rows.push(r); }
        r.x0 = Math.min(r.x0, x); r.x1 = Math.max(r.x1, x + w); r.h = Math.max(r.h, h); r.t.push([x, s, w]);
      }
      rows.forEach(r => { r.t.sort((a, b) => a[0] - b[0]); r.s = r.t.map(t => t[1]).join("").replace(/\s+/g, ""); });
      rows.sort((a, b) => b.y - a.y);
      pages.push({ src: cv.toDataURL("image/jpeg", 0.9), ar: vp.height / vp.width, W: v1.width, H: v1.height, rows, hide: false, ann: [], pen: [] });
    }
    return pages;
  }

  /* ---------- 그리기 ---------- */
  const pct = v => (Math.round(v * 100) / 100) + "%";
  function annHtml(a, k) {
    const tools = `<span class="dc-h" data-dcmv="${k}" title="옮기기">⠿</span><span class="dc-x" data-dcx="${k}" title="지우기">×</span>`;
    if (a.t === "im") return `<div class="dc-a dc-im" data-dck="${k}" style="left:${pct(a.x)};top:${pct(a.y)};width:${pct(a.w)}"><img src="${a.src}" alt="" draggable="false">${tools}<span class="dc-rs" data-dcrs="${k}" title="크기 조절"></span></div>`;
    if (a.t === "sh") return shapeHtml(a, k, tools);
    if (a.t === "hl") return `<div class="dc-a dc-hl" data-dck="${k}" style="left:${pct(a.x)};top:${pct(a.y)};width:${pct(a.w)};height:${pct(a.h)};background:${a.c}">${tools}</div>`;
    const box = a.memo || a.bub;
    return `<div class="dc-a dc-tx${a.ai ? " ai" : ""}${a.cov ? " cov" : ""}${a.memo ? " memo" : ""}${a.bub ? " bub" : ""}" data-dck="${k}" style="left:${pct(a.x)};top:${pct(a.y)};${a.r != null ? `right:${pct(a.r)};left:auto;` : ""}${a.w ? `width:${pct(a.w)};` : ""}color:${a.c};font-size:${a.s}cqw;${a.bg ? `background:${a.bg};` : ""}${a.f ? `font-family:${a.f};` : ""}${a.bc ? `border-color:${a.bc};--bc:${a.bc};` : ""}${a.bd ? `border:.28cqw solid ${a.bd};padding:.25em .5em;background:${a.bg || "#fff"};` : ""}"><div class="dc-ed" contenteditable="true" spellcheck="false">${a.html}</div>${tools}${box ? `<span class="dc-rs" data-dcrs="${k}" title="크기 조절"></span>` : ""}</div>`;
  }
  /* 도형: 네모·동그라미는 상자, 선·화살표는 시작점(x,y)→끝점(x2,y2). 굵기 a.lw = 장 폭의 % (cqw) */
  function shapeHtml(a, k, tools) {
    if (a.k === "line" || a.k === "arrow") {
      const ar = shapeAr(k), dx = a.x2 - a.x, dy = (a.y2 - a.y) * ar, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
      const head = a.k === "arrow" ? `<i class="dc-ah" style="border-left:${(a.lw * 4.2).toFixed(2)}cqw solid ${a.c};border-top:${(a.lw * 2.4).toFixed(2)}cqw solid transparent;border-bottom:${(a.lw * 2.4).toFixed(2)}cqw solid transparent;margin-top:-${(a.lw * 2.4).toFixed(2)}cqw"></i>` : "";
      return `<div class="dc-a dc-sh ln" data-dck="${k}" style="left:${pct(a.x)};top:${pct(a.y)};width:${pct(len)};transform:rotate(${ang.toFixed(2)}deg)"><i class="dc-lb2" style="height:${a.lw}cqw;margin-top:-${(a.lw / 2).toFixed(3)}cqw;background:${a.c};${a.k === "arrow" ? `right:${(a.lw * 3.6).toFixed(2)}cqw` : ""}"></i>${head}${tools}</div>`;
    }
    return `<div class="dc-a dc-sh box" data-dck="${k}" style="left:${pct(a.x)};top:${pct(a.y)};width:${pct(a.w)};height:${pct(a.h)}"><i class="dc-sb" style="border:${a.lw}cqw solid ${a.c};${a.k === "ell" ? "border-radius:50%;" : "border-radius:.4cqw;"}"></i>${tools}<span class="dc-rs" data-dcrs="${k}" data-two="1" title="크기 조절"></span></div>`;
  }
  function shapeAr(k) { const [di, pi] = String(k).split(":").map(Number); const P = S.docs[di] && S.docs[di].pages[pi]; return P ? P.ar : 1.414; }
  function pageHtml(d, di, p, pi) {
    return `<div class="dc-pw${p.hide ? " off" : ""}" data-dcp="${di}:${pi}">
      <div class="dc-ph"><span>${esc(d.M.p.insured || "고객")} · ${esc(d.file)} · ${pi + 1}/${d.pages.length}장</span><button type="button" class="dc-t sm" data-dchide="${di}:${pi}">${p.hide ? "이 장 넣기" : "이 장 빼기"}</button></div>
      ${p.hide ? "" : `<div class="a4 dc-page" style="aspect-ratio:1/${p.ar.toFixed(4)}"><img src="${p.src}" alt="설계서 ${pi + 1}장" draggable="false"><canvas class="dc-pen"></canvas><img class="dc-penimg" alt=""><div class="dc-ov tool-${S.tool}">${p.ann.map((a, ai) => annHtml(a, `${di}:${pi}:${ai}`)).join("")}</div></div>`}</div>`;
  }
  function draw() {
    const box = $("#dc-sheets"), list = $("#dc-list"); if (!box || !list) return;
    const me = meInfo();
    box.innerHTML = S.docs.map((d, di) => d.pages.map((p, pi) => pageHtml(d, di, p, pi)).join("") + (S.guide ? `<div class="dc-guide">${B().render2(d.M, { agent: me, insured: d.M.p.insured })}</div>` : "")).join("");
    if (S.guide) B().reflow(box);
    $$(".dc-pw").forEach(w => { const pg = w.querySelector(".dc-page"); if (pg) penInit(w, pg); });
    list.innerHTML = S.docs.map((d, i) => `<div class="bsrow"><span><b>${esc(d.M.p.insured || "고객")}</b> · ${esc(d.M.p.company)} ${esc(d.M.p.product || d.file)} · 담보 ${d.M.p.items.filter(x => !x.group).length}개${d.source === "ai" ? " · AI 읽기" : ""}</span><span><button class="btn" type="button" data-dcdel="${i}">빼기</button></span></div>`).join("") || `<p class="note" style="margin:0">보험사 설계서(가입제안서) PDF를 올리세요. 전 보험사 가능합니다.</p>`;
    $("#dc-pdf").disabled = $("#dc-print").disabled = !S.docs.length;
    bar();
  }
  function meInfo() { try { const m = window.BOIT_ME ? window.BOIT_ME() : {}; return { name: m.name || "", title: "", org: [m.company, m.branch].filter(Boolean).join(" ") }; } catch (e) { return {}; } }
  const pgOf = key => { const [di, pi] = key.split(":").map(Number); return S.docs[di] && S.docs[di].pages[pi]; };

  /* ---------- 펜 (캔버스) ---------- */
  function penInit(w, pg) {
    const key = w.dataset.dcp, P = pgOf(key), cv = pg.querySelector(".dc-pen");
    const r = pg.getBoundingClientRect(); cv.width = Math.round(r.width * 2); cv.height = Math.round(r.height * 2);
    penPaint(cv, P);
  }
  function penPaint(cv, P) {
    const x = cv.getContext("2d"); x.clearRect(0, 0, cv.width, cv.height); x.lineCap = x.lineJoin = "round";
    for (const s of P.pen) { if (s.pts.length < 2) continue; x.strokeStyle = s.c; x.lineWidth = s.w * cv.width / 1000; x.beginPath(); s.pts.forEach(([a, b], i) => { const X = a * cv.width / 100, Y = b * cv.height / 100; i ? x.lineTo(X, Y) : x.moveTo(X, Y); }); x.stroke(); }
    const im = cv.nextElementSibling; if (im) im.src = P.pen.length ? cv.toDataURL("image/png") : "";
  }

  /* ---------- AI 기본 꾸미기 ---------- */
  const norm = s => String(s || "").replace(/\s+/g, "").replace(/[ⅠⅡⅢⅣ]/g, m => ({ "Ⅰ": "I", "Ⅱ": "II", "Ⅲ": "III", "Ⅳ": "IV" }[m]));
  function findRow(d, name) {
    const k = norm(name).slice(0, 12); if (k.length < 3) return null;
    for (let pi = 0; pi < d.pages.length; pi++) { const P = d.pages[pi]; for (const r of P.rows) { if (!r.used && norm(r.s).indexOf(k) !== -1) return { pi, P, r }; } }
    return null;
  }
  const termOf = (d, it) => (d && d.M.p.company === "KB손해보험" && B().kbTerm) ? B().kbTerm(it.name) : null;
  const won = v => B().fmt(v) + "원";
  // 빨간 메모 (2026-11-24 대표 지시): 앞 칸 가입금액을 되풀이하는 "수술 시 10만원" 같은 메모는 넣지 않음.
  // 담보명에 없는 내용(어떤 수술·어떤 진단이면 얼마, 등급·구간별 금액, 한도 개념)만 넣고, 근거는 회사 약관 자료(BOSANG 팩·KB 약관)에 있는 것만 씀
  const SURG_LB = { cat: "백내장", disc: "디스크(추간판)", hemo: "치핵", gall: "담낭", tonsil: "편도", appx: "충수(맹장)" };
  const surgTbl = n => /1[-~]8종/.test(n) ? "1-8" : /1[-~]7종/.test(n) ? "1-7" : /1[-~]5종/.test(n) ? "1-5" : "";
  const surgCls = n => { const m = n.replace(/1[-~][578]종/g, "").match(/([1-8])종/); return m ? +m[1] : 0; };
  function surgNote(it, d, a) {
    const n = norm(it.name), tb = surgTbl(n), k = surgCls(n); if (!tb || !k) return "";
    if (!/질병/.test(n) || /상해/.test(n.replace(/\[상해\d종\]/g, ""))) return ""; // 예시 수술(백내장·치핵 등)은 질병 수술이라 상해수술비에는 안 붙임
    const pk = B().packOf && B().packOf(d.M.p), T = pk && pk.surg && pk.surg[tb]; if (!T) return "";
    const ex = Object.keys(SURG_LB).filter(key => T[key] && T[key][0] === k && !/단,|이면/.test(T[key][1])).map(key => SURG_LB[key]);
    return ex.length ? `${k}종 예: ${ex.join("·")} 수술 시 ${a}` : "";
  }
  function noteFor(it, g, d) {
    const T = termOf(d, it);
    if (T && T.pay && it.amt != null) { const P = T.pay(it.amt); if (P.length > 1 && P.length <= 3) return P.map(([k, v]) => `${k} ${won(v)}`).join(" · "); }
    const a = B().fmt(it.amt) + "원";
    const n = norm(it.name);
    if (g === "surg") return surgNote(it, d, a);
    if (g === "dx") { const sc = scopeOf(d, it); return sc && sc[0] && sc[0].length <= 45 ? `대상: ${sc[0]}` : ""; }
    if (g === "drv" && /후유장해/.test(n)) return `장해율만큼 최대 ${a}`;
    if (g === "drv" && /부상/.test(n)) return `부상 등급별 최대 ${a}`;
    if (g === "drv") return /벌금/.test(n) ? `벌금 ${a} 한도` : /변호사/.test(n) ? `변호사비 ${a} 한도` : /교통사고처리|형사합의/.test(n) ? `형사합의금 ${a} 한도` : "";
    if (g === "base") return /후유장해/.test(n) ? `장해율만큼 최대 ${a}` : "";
    return "";
  }
  function aiDecorate(d) {
    d.pages.forEach(P => { P.ann = P.ann.filter(a => !a.ai); P.rows.forEach(r => { r.used = false; }); });
    let n = 0;
    for (const it of d.M.p.items) {
      if (it.group || it.amt == null) continue;
      const g = B().genClass(it.name).g; if (!g) continue;
      const f = findRow(d, it.name); if (!f) continue; f.r.used = true;
      const txt = noteFor(it, g, d); if (!txt) continue;
      const { P, r } = f, top = (P.H - r.y - r.h * 1.05) / P.H * 100, hh = r.h * 1.5 / P.H * 100;
      P.ann.push({ t: "tx", ai: 1, x: 0, r: 100 - r.x1 / P.W * 100, y: top - 0.25, c: "#d6336c", s: Math.max(1.1, Math.min(1.5, r.h / P.W * 100 * 1.05)), bg: "rgba(255,255,255,.92)", html: "<b>" + esc(txt) + "</b>" });
      n++;
    }
    // 형광펜은 횟수·기간 같은 핵심 포인트에만 (2026-11-19 대표 지시: 담보 줄 전체에 긋지 않음)
    d.pages.forEach(P => P.rows.forEach(r => {
      const top = (P.H - r.y - r.h * 1.05) / P.H * 100, hh = r.h * 1.5 / P.H * 100;
      r.t.forEach(([x, str, w]) => { if (!w || !str) return; KEYP.lastIndex = 0; let m;
        while ((m = KEYP.exec(str))) { const L = str.length, a = x + w * m.index / L, b = x + w * (m.index + m[0].length) / L;
          P.ann.push({ t: "hl", ai: 1, x: a / P.W * 100 - 0.2, y: top - 0.15, w: (b - a) / P.W * 100 + 0.4, h: hh, c: "#ffe066" }); } });
    }));
    return n;
  }
  const KEYP = /(?:연간|매년|년|연)\s*\d+\s*회(?:\s*한도?|한)?|최초\s*\d*\s*회(?:\s*한도?|한)?|평생\s*\d*\s*회|\d+\s*회\s*(?:한도|한|限)|회당|1\s*회한|연간\s*한도/g;
  function scopeOf(d, it) {
    const nm = norm(it.name), Bo = B();
    const T = termOf(d, it); if (T) return [T.t, T.b, T.pay && it.amt != null ? T.pay(it.amt) : null];
    if (d.M.D && d.M.D.rules) { const r = d.M.D.rules.find(([, re]) => re.test(nm)); if (r && d.M.D.scope && d.M.D.scope[r[0]]) return [d.M.D.scope[r[0]], d.M.D.basis]; }
    const pk = Bo.packOf && Bo.packOf(d.M.p); if (pk) { const s = pk.scope.find(([re]) => re.test(nm)); if (s) return [s[1], pk.basis]; }
    return null;
  }
  function covNote(d, it) {
    const g = B().genClass(it.name).g, sc = scopeOf(d, it);
    const lines = [`<b>${esc(it.name)}</b>`];
    if (sc && sc[2] && sc[2].length) lines.push("이 설계 기준: " + sc[2].map(([k, v]) => `${esc(k)} <b>${esc(won(v))}</b>`).join(" · "));
    else if (it.amt != null && noteFor(it, g || "", d)) lines.push(esc(noteFor(it, g || "", d)));
    if (sc) lines.push(`${sc[2] !== undefined ? "약관" : "보장 범위"}: ${esc(sc[0])}`, `<small>근거: ${esc(sc[1])}</small>`);
    else lines.push(`<small>보장 범위·지급 조건은 이 상품 약관에서 확인 후 적어 주세요.</small>`);
    return lines.join("<br>");
  }

  /* ---------- 올리기 ---------- */
  async function addFiles(files) {
    const msg = $("#dc-msg");
    if (!window.pdfjsLib || !B()) { msg.textContent = "PDF 도구를 불러오지 못했습니다. 새로고침 후 다시 시도하세요."; return; }
    for (const f of files) {
      msg.textContent = `${f.name} 읽는 중… (AI가 읽는 회사는 10~20초 걸립니다)`;
      try {
        const r = await B().readProposal(f, window.pdfjsLib), pages = await loadPages(f);
        const d = { file: f.name, M: B().build2(r.p), source: r.source, pages };
        S.docs.push(d); const n = aiDecorate(d);
        msg.textContent = `${f.name}: 담보 ${r.p.items.filter(i => !i.group).length}개를 읽고, 중심 담보 ${n}개에 보상금액을 적었습니다. 형광펜은 횟수 포인트에만 칠했으니 더 필요한 곳은 직접 그으세요.`;
      } catch (e) { msg.textContent = `${f.name}: ${e && e.msg ? e.msg : "PDF를 읽지 못했습니다" + (e && /password/i.test(e.name || e.message || "") ? " (암호가 걸린 PDF)" : "") + "."}`; }
    }
    S.undo = []; draw();
  }

  /* ---------- 꾸미기 조작 ---------- */
  let ACT = null; // 현재 끌기 {mode, ...}
  let LASTED = null; // 마지막으로 누른 글자 칸
  function relPos(pg, e) { const r = pg.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 100, (e.clientY - r.top) / r.height * 100]; }
  function syncText(el) { const k = el.closest(".dc-a").dataset.dck.split(":").map(Number), a = S.docs[k[0]].pages[k[1]].ann[k[2]]; if (a) a.html = el.innerHTML; }
  function addAnn(key, a, focus) {
    const P = pgOf(key); P.ann.push(a); S.undo.push({ key, kind: "ann", a });
    redrawPage(key);
    if (focus) { const els = $$(`.dc-pw[data-dcp="${key}"] .dc-ed`); const el = els[els.length - 1]; if (el) { el.focus(); LASTED = el; } }
  }
  function redrawPage(key) {
    const w = $(`.dc-pw[data-dcp="${key}"]`); if (!w) return draw();
    const [di, pi] = key.split(":").map(Number);
    w.outerHTML = pageHtml(S.docs[di], di, S.docs[di].pages[pi], pi);
    const nw = $(`.dc-pw[data-dcp="${key}"]`), pg = nw && nw.querySelector(".dc-page"); if (pg) penInit(nw, pg);
  }
  /* 그림 넣기: 줄여서(긴 변 1400px) 지금 보이는 장 가운데에 넣음. 붙여넣기(Ctrl+V)도 가능 */
  function shrink(file) { return new Promise(ok => { const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onload = () => { const m = 1400, r = Math.min(1, m / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * r); c.height = Math.round(im.height * r); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); const png = /png|gif|webp/.test(file.type); ok({ src: c.toDataURL(png ? "image/png" : "image/jpeg", .88), ar: c.height / c.width }); }; im.onerror = () => ok(null); im.src = fr.result; }; fr.onerror = () => ok(null); fr.readAsDataURL(file); }); }
  async function addImages(files) {
    const L = [...files].filter(f => /^image\//.test(f.type)); if (!L.length) return;
    const w = $$(".dc-pw:not(.off)").find(x => { const r = x.getBoundingClientRect(); return r.bottom > 160 && r.top < innerHeight; }) || $(".dc-pw:not(.off)"); if (!w) return;
    const r = w.querySelector(".dc-page").getBoundingClientRect(); let y = Math.max(2, Math.min(80, (Math.max(r.top, 160) - r.top + 40) / r.height * 100));
    for (const f of L) { const o = await shrink(f); if (!o) continue; addAnn(w.dataset.dcp, { t: "im", x: 35, y, w: 30, src: o.src }); y = Math.min(85, y + 8); }
    if (S.tool !== "move") { S.tool = "move"; $$(".dc-ov").forEach(o => { o.className = "dc-ov tool-move"; }); $$("[data-dct]").forEach(b => b.classList.toggle("on", b.dataset.dct === "move")); }
    const tp = $("#dc-tip"); if (tp) tp.textContent = "그림을 끌어서 옮기고, 오른쪽 아래 모서리를 끌어 크기를 바꾸세요.";
  }
  document.addEventListener("paste", e => { if (!$("#dc-sheets") || !S.docs.length || $('section[data-view="bosang"]').hidden) return; if (e.target.closest && e.target.closest(".dc-ed")) { const fs = [...(e.clipboardData && e.clipboardData.files || [])]; if (!fs.length) return; e.preventDefault(); addImages(fs); return; } const fs = [...(e.clipboardData && e.clipboardData.files || [])]; if (fs.length) { e.preventDefault(); addImages(fs); } });
  function insertAtCursor(txt) {
    const sel = window.getSelection();
    if (LASTED && document.contains(LASTED) && sel.rangeCount && LASTED.contains(sel.anchorNode)) { document.execCommand("insertText", false, txt); syncText(LASTED); return; }
    if (LASTED && document.contains(LASTED)) { LASTED.focus(); const r = document.createRange(); r.selectNodeContents(LASTED); r.collapse(false); sel.removeAllRanges(); sel.addRange(r); document.execCommand("insertText", false, txt); syncText(LASTED); return; }
    const w = $$(".dc-pw:not(.off)").find(x => { const r = x.getBoundingClientRect(); return r.bottom > 120 && r.top < innerHeight; }); if (!w) return;
    const r = w.querySelector(".dc-page").getBoundingClientRect(), y = Math.max(3, Math.min(90, (Math.max(r.top, 140) - r.top + 60) / r.height * 100));
    addAnn(w.dataset.dcp, { t: "tx", x: 8, y, c: S.color, s: S.size * 1.4, f: S.font, html: esc(txt) }, true);
  }

  document.addEventListener("pointerdown", e => {
    const t = e.target; if (!t.closest || !t.closest("#dc-sheets")) return;
    const pg = t.closest(".dc-page"); if (!pg) return;
    const key = t.closest(".dc-pw").dataset.dcp;
    const x = t.closest("[data-dcx]"); if (x) { e.preventDefault(); delAnn(x.dataset.dcx); return; }
    if (S.tool === "move" && !t.closest(".dc-h,.dc-rs")) { $$(".dc-a.sel").forEach(o => o.classList.remove("sel")); const sa = t.closest(".dc-a"); if (sa) sa.classList.add("sel"); }
    const rs = t.closest("[data-dcrs]"); if (rs) { e.preventDefault(); const el = rs.closest(".dc-a"); const [px, py] = relPos(pg, e); ACT = { mode: "resize", pg, key, k: rs.dataset.dcrs, el, px, py, ow: parseFloat(el.style.width) || el.getBoundingClientRect().width / pg.getBoundingClientRect().width * 100, oh: parseFloat(el.style.height), two: !!rs.dataset.two }; return; }
    const mv = t.closest("[data-dcmv]") || (S.tool !== "erase" && t.closest(".dc-im,.dc-sh") ? { dataset: { dcmv: t.closest(".dc-im,.dc-sh").dataset.dck } } : null);
    if (mv || (S.tool === "move" && t.closest(".dc-hl"))) { e.preventDefault(); const k = (mv ? mv.dataset.dcmv : t.closest(".dc-a").dataset.dck); const el = $(`[data-dck="${k}"]`); const [px, py] = relPos(pg, e); ACT = { mode: "move", pg, key, k, el, px, py, ox: parseFloat(el.style.left), oy: parseFloat(el.style.top), rgt: el.style.left === "auto" }; if (ACT.rgt) { const rr = el.getBoundingClientRect(), pr = pg.getBoundingClientRect(); ACT.ox = (rr.left - pr.left) / pr.width * 100; el.style.right = "auto"; el.style.left = pct(ACT.ox); } return; }
    if (t.closest(".dc-ed")) { LASTED = t.closest(".dc-ed"); if (S.tool !== "erase") return; }
    const a = t.closest(".dc-a");
    if (S.tool === "erase") { if (a) { e.preventDefault(); delAnn(a.dataset.dck); return; } e.preventDefault(); ACT = { mode: "erase", pg, key, cv: pg.querySelector(".dc-pen") }; eraseAt(e); return; }
    if (a) return;
    const [px, py] = relPos(pg, e);
    if (S.tool === "hl") { e.preventDefault(); const el = document.createElement("div"); el.className = "dc-a dc-hl"; el.style.cssText = `left:${pct(px)};top:${pct(py)};width:0;height:0;background:${S.hl}`; pg.querySelector(".dc-ov").appendChild(el); ACT = { mode: "hl", pg, key, el, px, py }; return; }
    if (S.tool === "memo") { e.preventDefault(); addAnn(key, { t: "tx", memo: 1, x: Math.min(px, 76), y: py, w: 22, c: "#222222", s: S.size, bg: S.memo, f: S.font, html: "" }, true); return; }
    if (S.tool === "bubble") { e.preventDefault(); addAnn(key, { t: "tx", bub: 1, x: Math.min(px, 74), y: py, w: 24, c: "#222222", s: S.size, bg: "#ffffff", bc: S.color, f: S.font, html: "" }, true); return; }
    if (S.tool === "shape") { e.preventDefault(); const tmp = document.createElement("div"); tmp.className = "dc-tmp"; pg.querySelector(".dc-ov").appendChild(tmp); ACT = { mode: "shape", pg, key, tmp, px, py }; return; }
    if (S.tool === "pen") { e.preventDefault(); const cv = pg.querySelector(".dc-pen"); const s = { c: S.color, w: S.lw * 10, pts: [[px, py]] }; pgOf(key).pen.push(s); S.undo.push({ key, kind: "pen" }); ACT = { mode: "pen", pg, key, cv, s }; return; }
    if (S.tool === "text") { e.preventDefault(); addAnn(key, { t: "tx", x: px, y: Math.max(0, py - S.size * 0.8), c: S.color, s: S.size, f: S.font, html: "" }, true); return; }
  });
  document.addEventListener("pointermove", e => {
    if (!ACT) return; const [x, y] = relPos(ACT.pg, e);
    if (ACT.mode === "hl") { const el = ACT.el; el.style.left = pct(Math.min(x, ACT.px)); el.style.top = pct(Math.min(y, ACT.py)); el.style.width = pct(Math.abs(x - ACT.px)); el.style.height = pct(Math.abs(y - ACT.py)); }
    else if (ACT.mode === "pen") { ACT.s.pts.push([x, y]); penPaint(ACT.cv, pgOf(ACT.key)); }
    else if (ACT.mode === "move") { ACT.el.style.left = pct(ACT.ox + x - ACT.px); ACT.el.style.top = pct(ACT.oy + y - ACT.py); }
    else if (ACT.mode === "resize") { ACT.el.style.width = pct(Math.max(4, Math.min(100, ACT.ow + x - ACT.px))); if (ACT.two) ACT.el.style.height = pct(Math.max(1, Math.min(100, ACT.oh + y - ACT.py))); }
    else if (ACT.mode === "shape") { const a = shapeOf(ACT, x, y); ACT.tmp.innerHTML = a ? shapeHtml(a, ACT.key + ":t", "") : ""; }
    else if (ACT.mode === "erase") eraseAt(e);
  });
  document.addEventListener("pointerup", () => {
    if (!ACT) return; const A = ACT; ACT = null;
    if (A.mode === "hl") { const w = parseFloat(A.el.style.width); let h = parseFloat(A.el.style.height), y = parseFloat(A.el.style.top); A.el.remove();
      const b = bandAt(pgOf(A.key), y + h / 2); if (b && h < b.h * 2.6) { y = b.top; h = b.h; } /* 글줄 높이에 맞춤 (대충 그어도 칸에 딱 맞게) */
      if (w > 0.6 && h > 0.3) addAnn(A.key, { t: "hl", x: parseFloat(A.el.style.left), y, w, h, c: S.hl }); }
    else if (A.mode === "move") { const k = A.k.split(":").map(Number), a = S.docs[k[0]].pages[k[1]].ann[k[2]]; if (a) { const nx = parseFloat(A.el.style.left), ny = parseFloat(A.el.style.top); if (a.x2 != null) { a.x2 += nx - a.x; a.y2 += ny - a.y; } a.x = nx; a.y = ny; delete a.r; } }
    else if (A.mode === "resize") { const k = A.k.split(":").map(Number), a = S.docs[k[0]].pages[k[1]].ann[k[2]]; if (a) { a.w = parseFloat(A.el.style.width); if (A.two) a.h = parseFloat(A.el.style.height); } }
    else if (A.mode === "shape") { A.tmp.remove(); const a = A.last; if (a) addAnn(A.key, a); }
    else if (A.mode === "pen") { const P = pgOf(A.key); if (A.s.pts.length < 2) { P.pen.pop(); S.undo.pop(); } }
  });
  /* 설계서 글줄 위치(%) — 형광펜 줄 맞춤·줄 감싸기에 씀 */
  function bands(P) { return (P.rows || []).map(r => { const top = (P.H - r.y - r.h * 1.05) / P.H * 100, h = r.h * 1.5 / P.H * 100; return { top: top - 0.15, h: h + 0.3, x0: r.x0 / P.W * 100, x1: r.x1 / P.W * 100 }; }); }
  function bandAt(P, cy) { return bands(P).find(b => cy >= b.top && cy <= b.top + b.h) || null; }
  /* 끄는 동안 도형 만들기 (너무 작으면 안 만듦) */
  function shapeOf(A, x, y) {
    const P = pgOf(A.key); let a;
    if (S.shape === "rowbox") { const y1 = Math.min(y, A.py), y2 = Math.max(y, A.py), L = bands(P).filter(b => b.top + b.h > y1 && b.top < y2);
      if (!L.length) { A.last = null; return null; }
      const x0 = Math.max(0, Math.min(...L.map(b => b.x0)) - 0.8), x1 = Math.min(100, Math.max(...L.map(b => b.x1)) + 0.8), t0 = Math.min(...L.map(b => b.top)) - 0.2, t1 = Math.max(...L.map(b => b.top + b.h)) + 0.2;
      a = { t: "sh", k: "rect", x: x0, y: t0, w: x1 - x0, h: t1 - t0, c: S.color, lw: S.lw }; A.last = a; return a; }
    if (S.shape === "line" || S.shape === "arrow") { const len = Math.hypot(x - A.px, (y - A.py) * P.ar); a = len < 1.5 ? null : { t: "sh", k: S.shape, x: A.px, y: A.py, x2: x, y2: y, c: S.color, lw: S.lw }; }
    else { const w = Math.abs(x - A.px), h = Math.abs(y - A.py); a = (w < 1 || h < 0.6) ? null : { t: "sh", k: S.shape, x: Math.min(x, A.px), y: Math.min(y, A.py), w, h, c: S.color, lw: S.lw }; }
    A.last = a; return a;
  }
  function eraseAt(e) {
    const P = pgOf(ACT.key), [x, y] = relPos(ACT.pg, e), before = P.pen.length;
    P.pen = P.pen.filter(s => !s.pts.some(([a, b]) => Math.abs(a - x) < 1.2 && Math.abs(b - y) < 0.9));
    if (P.pen.length !== before) penPaint(ACT.cv, P);
  }
  function delAnn(k) { const [di, pi, ai] = k.split(":").map(Number), P = S.docs[di].pages[pi]; P.ann.splice(ai, 1); redrawPage(di + ":" + pi); }
  document.addEventListener("input", e => { const el = e.target.closest && e.target.closest("#dc-sheets .dc-ed"); if (el) syncText(el); });
  document.addEventListener("focusout", e => { const el = e.target.closest && e.target.closest("#dc-sheets .dc-ed"); if (el) { syncText(el); if (!el.textContent.trim() && !el.querySelector("img")) { const k = el.closest(".dc-a").dataset.dck; setTimeout(() => { const cur = $(`[data-dck="${k}"] .dc-ed`); if (cur && !cur.textContent.trim() && document.activeElement !== cur) delAnn(k); }, 150); } } });
  document.addEventListener("mousedown", e => { if (e.target.closest && e.target.closest("#dc-bar button,#dc-bar .dc-sw")) e.preventDefault(); }); // 도구 눌러도 글자 칸 선택 유지

  document.addEventListener("click", e => {
    const t = e.target; if (!t.closest) return;
    const del = t.closest("[data-dcdel]"); if (del) { S.docs.splice(+del.dataset.dcdel, 1); S.undo = []; draw(); return; }
    if (!t.closest("#dc-bar, #dc-sheets")) return;
    const tl = t.closest("[data-dct]"); if (tl) { S.tool = tl.dataset.dct; if (TOUCH) { pickTool(S.tool); return; } $$(".dc-ov").forEach(o => { o.className = "dc-ov tool-" + S.tool; }); $$("[data-dct]").forEach(b => b.classList.toggle("on", b === tl)); const tp = $("#dc-tip"); if (tp) tp.textContent = tip(); return; }
    const h = t.closest("[data-dch]"); if (h) { S.hl = h.dataset.dch; if (S.tool !== "hl") { S.tool = "hl"; draw(); } else $$("[data-dch]").forEach(b => b.classList.toggle("on", b === h)); return; }
    const c = t.closest("[data-dcc]"); if (c) { setColor(c.dataset.dcc); return; }
    const sz = t.closest("[data-dcs]"); if (sz) { S.size = +sz.dataset.dcs; $$("[data-dcs]").forEach(b => b.classList.toggle("on", b === sz)); if (LASTED && document.contains(LASTED)) { const a = LASTED.closest(".dc-a"); a.style.fontSize = S.size + "cqw"; const k = a.dataset.dck.split(":").map(Number), o = S.docs[k[0]].pages[k[1]].ann[k[2]]; if (o) o.s = S.size; } return; }
    if (t.closest("[data-dcmini]")) { S.mini = !S.mini; bar(); return; }
    const fm = t.closest("[data-dcfmt]"); if (fm) { if (LASTED && document.contains(LASTED)) { const sel = window.getSelection(); if (!sel.rangeCount || sel.isCollapsed || !LASTED.contains(sel.anchorNode)) { const r = document.createRange(); r.selectNodeContents(LASTED); sel.removeAllRanges(); sel.addRange(r); } document.execCommand(fm.dataset.dcfmt); syncText(LASTED); } return; }
    if (t.closest("[data-dcbox]")) { if (!LASTED || !document.contains(LASTED)) { const tp = $("#dc-tip"); if (tp) tp.textContent = "테두리를 넣을 글상자를 먼저 누르세요."; return; } const a = LASTED.closest(".dc-a"), o = annOf(a); if (!o || o.memo || o.bub) return; if (o.bd) delete o.bd; else o.bd = S.color; const [di, pi] = a.dataset.dck.split(":"); redrawPage(di + ":" + pi); return; }
    const fo = t.closest("[data-dcf]"); if (fo) { setFont(fo.dataset.dcf); return; }
    const mm = t.closest("[data-dcm]"); if (mm) { S.memo = mm.dataset.dcm; if (LASTED && document.contains(LASTED) && LASTED.closest(".memo")) { const a = LASTED.closest(".dc-a"); a.style.background = S.memo; const o = annOf(a); if (o) o.bg = S.memo; } if (S.tool !== "memo") pickTool("memo"); else $$("[data-dcm]").forEach(b => b.classList.toggle("on", b === mm)); return; }
    const sh = t.closest("[data-dcsh]"); if (sh) { S.shape = sh.dataset.dcsh; pickTool("shape"); return; }
    const lw = t.closest("[data-dclw]"); if (lw) { S.lw = +lw.dataset.dclw; $$("[data-dclw]").forEach(b => b.classList.toggle("on", b === lw)); return; }
    const ins = t.closest("[data-dcins]"); if (ins) { insertAtCursor(ins.dataset.dcins); return; }
    const cov = t.closest("[data-dccov]"); if (cov) { const [di, ii] = cov.dataset.dccov.split(":").map(Number), d = S.docs[di], it = d.M.p.items.filter(i => !i.group)[ii]; const f = findRowAny(d, it.name); const pi = f ? f.pi : d.pages.findIndex(p => !p.hide); if (pi < 0) return; const P = d.pages[pi]; const y = f ? Math.min(92, (P.H - f.r.y) / P.H * 100 + 1.2) : 10; addAnn(di + ":" + pi, { t: "tx", x: f ? Math.max(4, f.r.x0 / P.W * 100) : 6, y, c: "#1c3d5a", s: 1.35, bg: "rgba(231,245,255,.95)", cov: 1, html: covNote(d, it) }, false); const w = $(`.dc-pw[data-dcp="${di}:${pi}"]`); if (w) w.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const hd = t.closest("[data-dchide]"); if (hd) { const P = pgOf(hd.dataset.dchide); P.hide = !P.hide; redrawPage(hd.dataset.dchide); return; }
    if (t.closest("#dc-undo")) { const u = S.undo.pop(); if (!u) return; const P = pgOf(u.key); if (!P) return; if (u.kind === "pen") P.pen.pop(); else { const i = P.ann.indexOf(u.a); if (i >= 0) P.ann.splice(i, 1); } redrawPage(u.key); return; }
    if (t.closest("#dc-ai")) { let n = 0; S.docs.forEach(d => { n += aiDecorate(d); }); draw(); $("#dc-msg").textContent = `AI 기본 꾸미기를 다시 했습니다 (중심 담보 ${n}개). 직접 넣은 꾸미기는 그대로 둡니다.`; return; }
    if (t.closest("#dc-clear")) { if (!confirm("이 화면의 형광펜·글자·펜을 모두 지울까요? (AI 표시 포함)")) return; S.docs.forEach(d => d.pages.forEach(P => { P.ann = []; P.pen = []; })); S.undo = []; draw(); return; }
  });
  function annOf(el) { const k = el.dataset.dck.split(":").map(Number); return S.docs[k[0]] && S.docs[k[0]].pages[k[1]].ann[k[2]]; }
  function pickTool(k) { S.tool = k; bar(); $$(".dc-ov").forEach(o => { o.className = "dc-ov tool-" + S.tool; }); }
  /* 글꼴: 글자를 골라 두었으면 그 부분만, 아니면 지금 글상자 전체 + 앞으로 만들 글상자 */
  function setFont(f) {
    if (f && document.fonts && document.fonts.load) document.fonts.load("20px " + f).catch(() => { });
    S.font = f; $$("[data-dcf]").forEach(b => b.classList.toggle("on", b.dataset.dcf === f));
    if (!LASTED || !document.contains(LASTED)) return;
    const sel = window.getSelection();
    if (sel.rangeCount && !sel.isCollapsed && LASTED.contains(sel.anchorNode)) { document.execCommand("styleWithCSS", false, true); document.execCommand("fontName", false, f ? f.replace(/'/g, "") : "IBM Plex Sans KR"); syncText(LASTED); }
    else { const a = LASTED.closest(".dc-a"); a.style.fontFamily = f; const o = annOf(a); if (o) o.f = f; }
  }
  function findRowAny(d, name) { const k = norm(name).slice(0, 12); for (let pi = 0; pi < d.pages.length; pi++) { const P = d.pages[pi]; if (P.hide) continue; const r = P.rows.find(r => norm(r.s).indexOf(k) !== -1); if (r) return { pi, P, r }; } return null; }
  function setColor(c) {
    S.color = c; $$("[data-dcc]").forEach(b => b.classList.toggle("on", b.dataset.dcc === c)); const p = $("#dc-cpick"); if (p) p.value = c;
    const sel = window.getSelection();
    if (LASTED && document.contains(LASTED)) {
      if (sel.rangeCount && !sel.isCollapsed && LASTED.contains(sel.anchorNode)) { document.execCommand("styleWithCSS", false, true); document.execCommand("foreColor", false, c); syncText(LASTED); }
      else { const a = LASTED.closest(".dc-a"), o = annOf(a); if (a.classList.contains("bub")) { a.style.borderColor = c; a.style.setProperty("--bc", c); if (o) o.bc = c; } else { a.style.color = c; if (o) o.c = c; } }
    }
  }
  document.addEventListener("change", e => { if (e.target.id === "dc-img") { const fs = [...e.target.files]; e.target.value = ""; addImages(fs); } });
  document.addEventListener("change", e => {
    if (e.target.id === "dc-file") { const fs = [...e.target.files]; e.target.value = ""; addFiles(fs); }
    else if (e.target.id === "dc-cpick") setColor(e.target.value);
    else if (e.target.id === "dc-guide") { S.guide = e.target.checked; draw(); }
  });
  window.addEventListener("resize", () => { $$(".dc-pw").forEach(w => { const pg = w.querySelector(".dc-page"); if (pg) penInit(w, pg); }); });

  /* ---------- 출력·PDF ---------- */
  function outPages() { return [...$("#dc-sheets").querySelectorAll(".dc-page, .dc-guide .a4")]; }
  function prep(on) { document.body.classList.toggle("dc-out", on); if (on && document.activeElement && document.activeElement.blur) document.activeElement.blur(); }
  async function savePdf() {
    const msg = $("#dc-msg"), b = $("#dc-pdf");
    if (!window.html2canvas || !window.jspdf) { msg.textContent = "PDF 도구를 불러오지 못했습니다."; return; }
    let dl = null; try { dl = typeof DL !== "undefined" ? DL : null; } catch (e) { }
    if (!dl) { msg.textContent = "이 화면에서는 파일 저장을 지원하지 않습니다."; return; }
    b.disabled = true; prep(true);
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const pages = outPages(), pdf = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
      for (let i = 0; i < pages.length; i++) {
        msg.textContent = `PDF를 만드는 중… ${i + 1}/${pages.length}장`;
        const cv = await window.html2canvas(pages[i], { scale: 2, backgroundColor: "#ffffff" });
        if (i) pdf.addPage();
        const r = cv.height / cv.width, h = Math.min(297, 210 * r), w = h / r;
        pdf.addImage(cv.toDataURL("image/jpeg", .9), "JPEG", (210 - w) / 2, 0, w, h);
      }
      const nm = (S.docs[0] && S.docs[0].M.p.insured) || "고객", d = new Date(), ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
      await dl.save({ filename: `제안서_${nm}_${ymd}.pdf`, data: pdf.output("blob") });
      msg.textContent = "저장했습니다.";
    } catch (e) { msg.textContent = e && e.code === "declined" ? "저장을 취소했습니다." : "PDF 저장에 실패했습니다. 다시 시도해 주세요."; }
    finally { prep(false); b.disabled = !S.docs.length; }
  }
  function print() {
    prep(true);
    const host = document.createElement("div"); outPages().forEach(p => host.appendChild(p.cloneNode(true)));
    host.querySelectorAll(".dc-pen").forEach(c => c.remove()); host.querySelectorAll(".dc-h,.dc-x,.dc-rs").forEach(c => c.remove());
    host.querySelectorAll("[contenteditable]").forEach(c => c.removeAttribute("contenteditable"));
    prep(false);
    const nm = (S.docs[0] && S.docs[0].M.p.insured) || "고객";
    if (!B().printPages(host, `제안서_${nm}`)) $("#dc-msg").textContent = "출력할 장이 없습니다.";
  }
  document.addEventListener("click", e => { if (!e.target.closest) return; if (e.target.closest("#dc-pdf")) savePdf(); else if (e.target.closest("#dc-print")) print(); });

  const css = document.createElement("style"); css.textContent = `
.dc-bar{position:sticky;top:0;z-index:20;background:var(--surface,#fff);border:1px solid var(--line,#e5e5e5);border-radius:12px;padding:8px 10px;margin-top:12px;display:flex;flex-direction:column;gap:6px;box-shadow:0 2px 10px rgba(0,0,0,.06)}
.dc-row{display:flex;flex-wrap:wrap;gap:5px;align-items:center}.dc-lb{font-size:12px;color:var(--muted,#666);margin-right:2px}.dc-sep{width:1px;height:20px;background:var(--line,#e5e5e5);margin:0 4px}
.dc-t{font:inherit;font-size:13px;border:1px solid var(--line,#ddd);background:#fff;border-radius:8px;padding:5px 10px;cursor:pointer}.dc-t.sm{font-size:12px;padding:3px 8px}.dc-t.on{background:var(--accent-soft,#e6f4f1);border-color:var(--accent,#0f766e);color:var(--accent,#0f766e);font-weight:700}
.dc-sw{width:24px;height:24px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #ccc;cursor:pointer;padding:0}.dc-sw.on{box-shadow:0 0 0 2px var(--accent,#0f766e)}#dc-cpick{width:28px;height:26px;border:0;padding:0;background:none;cursor:pointer}
.dc-more{display:block}.dc-more summary{cursor:pointer;font-size:13px;font-weight:600}.dc-pal{display:flex;flex-wrap:wrap;gap:3px;margin-top:6px}.dc-pal button{font:inherit;font-size:16px;min-width:32px;height:32px;border:1px solid var(--line,#ddd);background:#fff;border-radius:6px;cursor:pointer}.dc-pal.dc-emo button{font-size:19px}
.dc-cov{display:flex;flex-direction:column;gap:8px;margin-top:6px;max-height:240px;overflow:auto}.dc-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}.dc-chips button{font:inherit;font-size:12px;border:1px solid var(--line,#ddd);background:#fff;border-radius:14px;padding:3px 9px;cursor:pointer}.dc-chips small{color:var(--muted,#888)}
/* 넓은 화면: 꾸미기 도구를 오른쪽에 좁고 길게 붙임 (2026-11-25 대표 지시) */
@media (min-width:1200px){.dc-work{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start;margin-top:12px}.dc-work .dc-sheets{grid-column:1;grid-row:1;margin-top:0}
.dc-work .dc-bar{grid-column:2;grid-row:1;margin-top:0;position:sticky;top:10px;max-height:calc(100vh - 20px);overflow-y:auto;padding:10px;gap:8px}
.dc-work .dc-bar .dc-sep{display:none}.dc-work .dc-bar .dc-lb{flex-basis:100%;margin:4px 0 0;font-weight:600}.dc-work .dc-bar .dc-row>.dc-t:not(.sm){flex:1 1 calc(50% - 5px);text-align:left}.dc-work .dc-bar .dc-minib{display:none}
.dc-work .dc-bar .dc-optbox{display:flex!important;flex-direction:column;gap:8px;border-top:1px solid var(--line,#e5e5e5);padding-top:8px}.dc-work .dc-bar #dc-tip{flex-basis:100%;font-size:12px}}
.dc-sheets{display:flex;flex-direction:column;align-items:center;gap:14px;margin-top:14px}
.dc-pw{width:100%;max-width:820px}.dc-pw.off{opacity:.6}.dc-ph{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--muted,#777);margin-bottom:4px}
.a4.dc-page{position:relative;width:100%;height:auto;min-height:0;padding:0!important;background:#fff;container-type:inline-size;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.12);user-select:none;-webkit-user-select:none}
.dc-page>img{display:block;width:100%;height:100%;pointer-events:none}.dc-pen,.dc-penimg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}.dc-penimg{display:none}.dc-penimg[src=""]{visibility:hidden}
.dc-ov{position:absolute;inset:0}.dc-ov.tool-hl,.dc-ov.tool-pen,.dc-ov.tool-erase{touch-action:none;cursor:crosshair}.dc-ov.tool-text{cursor:text}
.dc-a{position:absolute}.dc-hl{mix-blend-mode:multiply;opacity:.55;border-radius:2px}.dc-ov.tool-move .dc-hl{cursor:move}
.dc-tx{line-height:1.3;white-space:pre-wrap;min-width:2em;padding:0 .2em;border-radius:3px;max-width:96%}.dc-tx.ai{white-space:nowrap}.dc-tx.cov{max-width:62%;padding:.3em .5em;border:1px solid #a5d8ff}
.dc-ed{outline:none;min-height:1.2em;user-select:text;-webkit-user-select:text;cursor:text}.dc-tx:focus-within{outline:1.5px dashed #74c0fc}
.dc-h,.dc-x{display:none;position:absolute;top:-16px;width:16px;height:16px;line-height:15px;font-size:12px;text-align:center;border-radius:4px;background:#343a40;color:#fff;cursor:pointer;font-weight:700;touch-action:none}.dc-h{left:-2px;cursor:move}.dc-x{right:-2px;background:#e03131}
.dc-a:hover>.dc-h,.dc-a:hover>.dc-x,.dc-a:focus-within>.dc-h,.dc-a:focus-within>.dc-x{display:block}
.dc-out .dc-h,.dc-out .dc-x{display:none!important}.dc-out .dc-tx:focus-within{outline:none}
.dc-im{touch-action:none;cursor:move}.dc-im>img{display:block;width:100%;height:auto;pointer-events:none}.dc-im:hover{outline:1.5px dashed #74c0fc}
.dc-rs{display:none;position:absolute;right:-7px;bottom:-7px;width:14px;height:14px;border-radius:3px;background:#1c7ed6;border:2px solid #fff;cursor:nwse-resize;touch-action:none}.dc-im:hover>.dc-rs{display:block}.dc-out .dc-rs,.dc-out .dc-im{outline:none!important}.dc-out .dc-rs{display:none!important}
@media (max-width:700px){.dc-rs{display:block;width:20px;height:20px}}
.dc-sw.sq{border-radius:5px}.dc-lock{order:-2;background:#fff4e6!important;border-color:#f59f00!important;color:#b45309;font-weight:700}.dc-optbox{display:flex;flex-direction:column;gap:6px}.dc-minib{display:none}
@media (max-width:760px){.dc-bar{padding:6px 8px;gap:4px;max-height:55vh;overflow-y:auto;top:56px}.dc-minib{display:inline-block;font-weight:700;order:-1;background:var(--accent-soft,#e6f4f1)}
.dc-optbox.mini{display:none}.dc-row{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:2px}.dc-row::-webkit-scrollbar{display:none}
.dc-row>*{flex:none}.dc-more,.dc-more summary{white-space:normal}.dc-more{flex-wrap:wrap}.dc-sw{width:26px;height:26px}#dc-tip{white-space:normal;flex:1 0 100%}.dc-optbox .dc-row:last-child{flex-wrap:wrap}}
.dc-tx.memo{padding:.5em .7em;border-radius:.3em;box-shadow:0 .25cqw .9cqw rgba(0,0,0,.18);max-width:none;min-height:2.2em}
.dc-tx.bub{padding:.5em .8em;border-radius:1.1em;border:.3cqw solid #d6336c;max-width:none;--bc:#d6336c}
.dc-tx.bub::after{content:"";position:absolute;left:1.4em;bottom:-.95em;border-style:solid;border-width:1em .55em 0 .25em;border-color:var(--bc) transparent transparent transparent}
.dc-tx.memo:hover>.dc-rs,.dc-tx.bub:hover>.dc-rs,.dc-tx.memo:focus-within>.dc-rs,.dc-tx.bub:focus-within>.dc-rs,.dc-sh:hover>.dc-rs{display:block}
.dc-sh{pointer-events:none}.dc-ov.tool-move .dc-sh,.dc-ov.tool-erase .dc-sh{pointer-events:auto;cursor:move}.dc-sh .dc-h,.dc-sh .dc-x,.dc-sh .dc-rs{pointer-events:auto}
.dc-sh.box .dc-sb{position:absolute;inset:0;box-sizing:border-box}.dc-sh.ln{height:0;transform-origin:0 0}.dc-sh.ln:hover{outline:none}
.dc-sh.ln .dc-lb2{position:absolute;left:0;right:0;top:0}.dc-sh.ln .dc-ah{position:absolute;right:0;top:0;width:0;height:0}
.dc-ov.tool-move .dc-sh.ln::before,.dc-ov.tool-erase .dc-sh.ln::before{content:"";position:absolute;left:0;right:0;top:-1.2cqw;height:2.4cqw}
.dc-ov.tool-shape,.dc-ov.tool-memo,.dc-ov.tool-bubble{touch-action:none;cursor:crosshair}.dc-tmp{position:absolute;inset:0;pointer-events:none}
.dc-out .dc-tx.memo:focus-within,.dc-out .dc-tx.bub:focus-within{outline:none}
.dc-guide{width:100%;display:flex;flex-direction:column;align-items:center;gap:14px}
@media (max-width:700px){.dc-t{font-size:12px;padding:4px 8px}.dc-h,.dc-x{width:22px;height:22px;line-height:21px;top:-22px}.dc-tx.ai{white-space:normal}}
.dc-a.sel>.dc-h,.dc-a.sel>.dc-x,.dc-a.sel>.dc-rs{display:block}.dc-a.sel{outline:1.5px dashed #1c7ed6}.dc-out .dc-a.sel{outline:none}
@media (pointer:coarse){.dc-a:hover>.dc-h,.dc-a:hover>.dc-x,.dc-im:hover>.dc-rs,.dc-sh:hover>.dc-rs{display:none}.dc-a.sel>.dc-h,.dc-a.sel>.dc-x,.dc-a.sel>.dc-rs,.dc-a:focus-within>.dc-h,.dc-a:focus-within>.dc-x{display:block}}
@media print{.dc-penimg{display:block}}
.pp .dc-penimg{display:block}.pp .dc-page{box-shadow:none;width:190mm}`;
  document.head.appendChild(css);

  function init() { shell(); draw(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
