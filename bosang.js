/* 보잇 · 보상제안서 (상품제안서 PDF → 회사 약관 기준 '아프면 실제로 얼마를 받는가' 안내서)
   - 상품제안서 PDF는 브라우저에서 글자만 읽음 (서버로 보내지 않음, 저장하지 않음)
   - 금액은 제안서의 가입금액 × 상품 보장 사전(약관에서 뽑은 지급 규칙)으로만 계산. 사전에 없는 담보는 '약관 확인 필요'로 표시
   - 상품 보장 사전: KB손해보험 건강보험 공통 (기준 약관: KB 5.10.10 플러스 건강보험(세만기)(무배당)(26.09), 2026-10-01 적용)
*/
(function (G) {
  "use strict";

  /* ---------------- 1. PDF → 줄 ---------------- */
  async function pdfLines(lib, data) {
    const doc = await lib.getDocument({ data, isEvalSupported: false }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const pg = await doc.getPage(p), tc = await pg.getTextContent();
      const rows = [];
      for (const it of tc.items) {
        const s = it.str; if (!s || !s.trim()) continue;
        const x = it.transform[4], y = it.transform[5], w = it.width || s.length * 5;
        let r = rows.find(r => Math.abs(r.y - y) < 2.5);
        if (!r) { r = { y, parts: [] }; rows.push(r); }
        r.parts.push({ x, w, s });
      }
      rows.sort((a, b) => b.y - a.y);
      pages.push(rows.map(r => {
        r.parts.sort((a, b) => a.x - b.x);
        let out = "", end = null;
        for (const t of r.parts) { if (end !== null && t.x - end > 6) out += "  "; else if (end !== null && t.x - end > 1.5) out += " "; out += t.s; end = t.x + t.w; }
        return out.replace(/\s+$/, "");
      }));
    }
    return pages;
  }

  /* ---------------- 2. 금액 ---------------- */
  // "4천만원"=4000, "1백50만원"=150, "1억5천만원"=15000, "30만원"=30  (단위: 만원)
  function man(t) {
    t = String(t || "").replace(/[,\s]/g, "");
    const m = t.match(/^(?:(\d+)억)?(?:(\d+)천)?(?:(\d+)백)?(\d+)?만?원$/); if (!m) return null;
    const [, e, c, b, r] = m; const v = (+e || 0) * 10000 + (+c || 0) * 1000 + (+b || 0) * 100 + (+r || 0);
    if (!e && !c && !b && !r) return null; return v;
  }
  const AMT = "((?:\\d+억)?(?:\\d+천)?(?:\\d+백)?\\d*만원|\\d+억원)";
  const fmt = v => v == null ? "" : v >= 10000 ? (v % 10000 ? (v / 10000).toFixed(1).replace(/\.0$/, "") + "억" : v / 10000 + "억") : v.toLocaleString("ko-KR") + "만";
  const won = v => fmt(v) + (v >= 10000 ? "" : "원");

  /* ---------------- 3. KB 상품제안서 읽기 ---------------- */
  const unbalanced = s => (String(s).match(/\(/g) || []).length > (String(s).match(/\)/g) || []).length;
  function parseKB(pages) {
    const all = pages.flat();
    const txt = all.join("\n");
    const out = { company: "KB손해보험", product: "", code: "", insured: "", age: null, sex: "", premium: null, no: "", issued: "", items: [], warn: [] };
    const pm = txt.match(/(KB[^\n]*?건강보험[^\n]*?\(\d\d\.\d\d\))(?:_[^\n]*?)?(?:\s|$)/); if (pm) out.product = pm[1].trim();
    const cm = txt.match(/해약환급금[^\n(]*\((\d{5})\)/) || txt.match(/장기 \d\d-(\d{5})-/); if (cm) out.code = cm[1];
    const im = txt.match(/([가-힣]{2,5})\s*피보험자님의 가입내용\s*\((\d{1,3})세\s*\|\s*(남|여)/); if (im) { out.insured = im[1]; out.age = +im[2]; out.sex = im[3]; }
    const no = txt.match(/청약번호\s*:?\s*(RQ[\d-]+)/) || txt.match(/(RQ\d\d-\d{6,})/); if (no) out.no = no[1];
    const iss = txt.match(/발급일시\s*:?\s*(\d{4}-\d\d-\d\d)/); if (iss) out.issued = iss[1];
    const pr = txt.match(/보험료\s*:\s*([\d,]+)원/) || txt.match(/1회 보험료\s*([\d,]+)원/); if (pr) out.premium = +pr[1].replace(/,/g, "");
    const rowRe = new RegExp("^\\s*(?:(\\d{1,3})\\s+|┖\\s*)?(.*?)\\s*" + AMT + "\\s+([\\d,]+)\\s+[\\d.]+\\s*(.*)$");
    const sumRe = /^\s*(\d{1,3})\s+(.*?)\s*가입\s*합계\s*[\d,]+/;
    let pend = "", pendNo = null, pendSub = false, last = null, inTable = false;
    for (const raw of all) {
      const l = raw.replace(/ /g, " ");
      if (/보장명\s+가입금액/.test(l)) { inTable = true; continue; }
      if (!inTable) continue;
      if (/보험료비중:|주의사항|상품제안서_116대|고객콜센터/.test(l)) { inTable = /보험료비중/.test(l) ? false : inTable; pend = ""; last = null; if (/보험료비중|상품제안서_116대/.test(l)) inTable = false; continue; }
      if (/^\s*RQ\d|장기 \d\d-\d{5}|\[계약자용\]|^\s*\(상담 및 문의\)|^\s*1544-|홈페이지/.test(l)) { last = null; continue; }
      const sm = l.match(sumRe);
      if (sm) { last = { no: +sm[1], name: (pend + sm[2]).trim(), amt: null, group: true, open: true }; out.items.push(last); pend = ""; continue; }
      const m = l.match(rowRe);
      if (m && man(m[3]) != null) {
        const isSub = /┖/.test(l) || pendSub;
        const name = (pend + " " + (m[2] || "")).replace(/┖/g, "").replace(/\s+/g, " ").trim();
        last = { no: m[1] ? +m[1] : (pendNo || null), name, amt: man(m[3]), prem: +m[4].replace(/,/g, ""), term: (m[5] || "").trim(), sub: isSub };
        out.items.push(last); pend = ""; pendNo = null; pendSub = false; continue;
      }
      let t = l.trim(); if (!t) continue;
      const TERM = /\s+(\d+년\/\d+년갱신|\(갱신종료:\d+세\)|\d+년\/\d+세|\d+년\/\d+년)\s*$/;
      while (TERM.test(t)) { const tm = t.match(TERM)[1]; if (last) last.term = (last.term + " " + tm).trim(); t = t.replace(TERM, "").trim(); }
      if (/^(\d+년\/|\(갱신종료|\d+년갱신)/.test(t)) { if (last) last.term = (last.term + " " + t).trim(); continue; }
      if (/^\d{1,3}\s/.test(t) || /^┖/.test(t)) { pendNo = /^\d/.test(t) ? +t.match(/^\d+/)[0] : null; pendSub = /^┖/.test(t); pend = t.replace(/^\d{1,3}\s+/, "").replace(/^┖\s*/, ""); last = null; continue; }
      // 앞 담보 이름의 괄호가 아직 안 닫혔으면 이어지는 줄, 닫혔으면 다음 담보의 첫 줄
      if (last && unbalanced(last.name) && !/^\d/.test(t)) { last.name = (last.name + t).replace(/\s+보장$/, "").trim(); continue; }
      if (pend && unbalanced(pend)) { pend += t; continue; }
      if (/^보장$/.test(t)) continue;
      pend = t; last = null;
    }
    out.items.forEach(i => { i.name = i.name.replace(/\s*보장$/, "").replace(/\s+/g, " ").trim(); });
    if (!out.items.length) out.warn.push("가입담보 표를 찾지 못했습니다. KB손해보험 '상품제안서_가입담보' PDF인지 확인하세요.");
    return out;
  }

  /* ---------------- 4. 상품 보장 사전 (KB손해보험 건강보험) ---------------- */
  // k: 담보 키, re: 제안서 보장명(공백 제거) 패턴. 금액은 가입금액 그대로(정액) — 통합치료비는 TIER 표 사용
  const KB_RULES = [
    ["cancer", /^암진단비\(유사암제외\)/], ["simcancer", /^유사암진단비/],
    ["ic_digest", /통합암진단비.*\(소화기관암진단비/], ["ic_lung", /통합암진단비.*\(폐암진단비/], ["ic_liver", /통합암진단비.*\(간암,?담낭암/],
    ["ic_blood", /통합암진단비.*\(혈액암진단비/], ["ic_head", /통합암진단비.*\(두경부암진단비/], ["ic_11", /통합암진단비.*\(11대특정암진단비/],
    ["ic_3high", /통합암진단비.*\(3대특정고액암진단비/], ["ic_genito", /통합암진단비.*\(생식기암및비뇨기관암/], ["ic_small", /통합암진단비.*\(특정소액암진단비/],
    ["brain", /^뇌혈관질환진단비/], ["heart1", /^심장질환\(특정Ⅰ\)진단비/], ["heart2", /^심장질환\(특정Ⅱ\)진단비/], ["arrhy", /^부정맥질환\(Ⅰ49\)진단비|^부정맥질환\(I49\)진단비/],
    ["benignbrain", /^양성뇌종양진단비/],
    ["frac", /^골절진단비\(치아파절포함\)/], ["frac2", /^골절진단비Ⅱ/], ["frac5", /^5대골절진단비/], ["cast", /^깁스치료비/],
    ["tbi", /^외상성특정뇌손상진단비/], ["tbleed", /^외상성특정뇌출혈진단비/], ["burn", /^화상진단비/],
    ["dsurg", /^질병수술비\(/],
    ["d1", /^질병1~5종수술비Ⅱ\(매회지급\).*_1종$/], ["d2", /^질병1~5종수술비Ⅱ\(매회지급\).*_2종$/], ["d3", /^질병1~5종수술비Ⅱ\(매회지급\).*_3종$/], ["d4", /^질병1~5종수술비Ⅱ\(매회지급\).*_4종$/], ["d5", /^질병1~5종수술비Ⅱ\(매회지급\).*_5종$/],
    ["s116_1", /^116대질병수술비Ⅰ\(/], ["s116_2", /^116대질병수술비Ⅱ\(/], ["s116_3", /^116대질병수술비Ⅲ\(/], ["s116_4", /^116대질병수술비Ⅳ\(/], ["s116_5", /^116대질병수술비Ⅴ\(/], ["s116_6", /^116대질병수술비Ⅵ\(/],
    ["ben4", /^특정양성종양수술비Ⅳ/], ["ben3", /^특정양성종양수술비Ⅲ/], ["ben2", /^특정양성종양수술비Ⅱ/], ["ben1", /^특정양성종양수술비Ⅰ/],
    ["isurg", /^상해수술비\(/],
    ["i1", /^상해1~5종수술비\(매회지급\)_1종/], ["i2", /^상해1~5종수술비\(매회지급\)_2종/], ["i3", /^상해1~5종수술비\(매회지급\)_3종/], ["i4", /^상해1~5종수술비\(매회지급\)_4종/], ["i5", /^상해1~5종수술비\(매회지급\)_5종/],
    ["robot", /^다빈치로봇암수술비\(갑상선암및전립선암제외\)/], ["robot_thy", /^다빈치로봇갑상선암및전립선암수술비/],
    ["rad", /^항암방사선치료비\(/], ["chemo", /^항암약물치료비\(/], ["thy_horm", /^갑상선암호르몬약물허가치료비/], ["cart", /^카티\(CAR-T\)/],
    ["ci_hi", /^암통합치료비Plus\(종합병원\)\(고급형\)/], ["ci_np", /^비급여\(전액본인부담포함\)암통합치료비Plus\(종합병원\)/], ["circ", /^신특정순환계질환통합치료비Plus\(맞춤고지\)|^신특정순환계질환통합치료비Plus\(감액없음\)/],
    ["flu", /^독감\(인플루엔자\)항바이러스제치료비/], ["icu_d", /^질병중환자실입원일당/], ["icu_i", /^상해중환자실입원일당/],
    ["base", /^\[기본계약\]|^\[2종의무부가특약\]|보험료납입면제대상보장/],
  ];
  const IC_NAME = { ic_digest: "소화기관암", ic_lung: "폐암", ic_liver: "간·담낭·담도·췌장암", ic_blood: "혈액암", ic_head: "두경부암", ic_11: "11대특정암", ic_3high: "3대특정고액암", ic_genito: "생식기·비뇨기관암", ic_small: "특정소액암" };

  // 통합치료비 세부보장 지급금액 (보험계약일부터 1년이상 기준, 만원). 약관 특별약관 제1조 지급금액 표에서 옮김
  // ci_hi: 248. 암 통합치료비Plus(종합병원)(고급형) / ci_np: 251. 비급여(전액본인부담 포함) 암 통합치료비Plus(종합병원) / circ: 153. 신특정순환계질환 통합치료비Plus
  const TIER = {
    ci_hi: {
      5000: { mri: 5, pet: 5, ct: 5, us: 5, endo: 5, gene: 5, biopsy: 10, ngs: 100, surg: 500, simsurg: 100, rad: 500, simrad: 100, chemo: 500, simchemo: 100, horm: 50, simhorm: 10, icu: 250, simicu: 50, imrt: 500,
        np_surg: 500, np_surg_thy: 100, np_rad: 500, np_chemo: 500, np_robot: 500, np_robot_thy: 100, np_target: 1000, np_immune: 1000, np_proton: 1000, pain: 30, rehab: 2 },
      10000: { mri: 10, pet: 5, ct: 5, us: 5, endo: 5, gene: 5, biopsy: 20, ngs: 100, surg: 1000, simsurg: 200, rad: 1000, simrad: 200, chemo: 1000, simchemo: 200, horm: 100, simhorm: 20, icu: 500, simicu: 100, imrt: 750,
        np_surg: 1000, np_surg_thy: 200, np_rad: 1000, np_chemo: 1000, np_robot: 1000, np_robot_thy: 200, np_target: 2000, np_immune: 2000, np_proton: 2000, pain: 40, rehab: 2 },
    },
    ci_np: {
      8000: { np_surg: 1000, np_surg_thy: 200, np_rad: 1000, np_rad_thy: 200, np_chemo: 1000, np_chemo_thy: 200, np_robot: 1000, np_robot_thy: 200, np_target: 2000, np_immune: 2000, np_proton: 2000 },
    },
    circ: {
      5000: { mri: 5, ct: 5, pet: 5, crrt: 200, vent: 100, hypo: 100, ecmo: 1000, surg: 1000, thromb: 1000, lysis_b: 1000, lysis_h: 1000, icu: 500, rehab: 2, anticoag: 50, antiplt: 50 },
      8000: { mri: 10, ct: 5, pet: 5, crrt: 300, vent: 150, hypo: 100, ecmo: 1500, surg: 1500, thromb: 1500, lysis_b: 1500, lysis_h: 1500, icu: 750, rehab: 2, anticoag: 50, antiplt: 100 },
      10000: { mri: 10, ct: 5, pet: 5, crrt: 500, vent: 200, hypo: 100, ecmo: 2000, surg: 2000, thromb: 2000, lysis_b: 2000, lysis_h: 2000, icu: 1000, rehab: 2, anticoag: 50, antiplt: 100 },
    },
  };

  const KB_DICT = {
    company: "KB손해보험",
    basis: "KB 5.10.10 플러스 건강보험(세만기)(무배당)(26.09) 약관 (2026-10-01 적용)",
    match: p => /KB/.test(p.product || "") || p.company === "KB손해보험",
    rules: KB_RULES, tier: TIER,
    // 1~5종수술Ⅲ 분류표(【별표55-1】) · 116대질병 분류표(【별표17】~) 근거 문구
    ref: {
      t88_2: "1~5종수술Ⅲ 분류표 88-2: 대장 용종·양성신생물 내시경 절제는 1종",
      t88_2b: "1~5종수술Ⅲ 분류표 88-2: 복부장기 내시경 수술 2종",
      t57: "1~5종수술Ⅲ 분류표 57: 갑상선 관혈수술 3종",
      t9: "1~5종수술Ⅲ 분류표 9: 추간판 관혈수술 3종 (내시경·경피적이면 88-2 2종)",
      t36: "1~5종수술Ⅲ 분류표 36: 담낭·담도 관혈수술 3종 (복강경은 해당 부위 수술로 적용)",
      t15: "1~5종수술Ⅲ 분류표 15·17: 만성부비강염 근본수술·편도 절제 1종",
      t34: "1~5종수술Ⅲ 분류표 34: 기타 위 관혈수술 3종 · 33: 위 절제수술 4종",
      t44: "1~5종수술Ⅲ 분류표 44: 치핵·치루 근본수술 1종",
      t87: "1~5종수술Ⅲ 분류표 87: 체외충격파쇄석술 2종 (116대질병수술비는 쇄석술 제외)",
      t88_3: "1~5종수술Ⅲ 분류표 88-3: 비뇨기 내시경 수술 1종",
      t88_1: "1~5종수술Ⅲ 분류표 88-1: 뇌·심장 내시경·카테터 수술 3종",
      tc1: "1~5종수술Ⅲ 분류표 악성신생물 1: 관혈적 근치수술 5종 · 2: 내시경·카테터 수술 3종",
    },
  };
  const DICTS = [KB_DICT];

  /* ---------------- 5. 제안서 + 사전 → 금액 ---------------- */
  function build(p) {
    const D = DICTS.find(d => d.match(p));
    const A = {}, unknown = [], used = [];
    if (D) for (const it of p.items) {
      if (it.group || it.amt == null) continue;
      const nm = it.name.replace(/\s+/g, "");
      const r = D.rules.find(([, re]) => re.test(nm));
      if (r) { if (r[0] !== "base") { A[r[0]] = (A[r[0]] || 0) + it.amt; used.push(it.name); } }
      else unknown.push(it);
    }
    const tierOf = k => { if (!D || !A[k]) return null; const t = D.tier[k] || {}; return t[A[k]] || null; };
    return { p, D, A, unknown, used, T: { ci_hi: tierOf("ci_hi"), ci_np: tierOf("ci_np"), circ: tierOf("circ") }, tierMissing: ["ci_hi", "ci_np", "circ"].filter(k => A[k] && !tierOf(k)) };
  }

  /* ---------------- 6. 안내서 그리기 ---------------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function render(M, agent) {
    const { p, A, T, D } = M; if (!D) return `<div class="a4 bs"><h3>이 회사 상품은 아직 상품 보장 사전이 없습니다</h3><p>약관을 등록하면 자동 계산됩니다. (현재 등록: KB손해보험)</p></div>`;
    const has = k => A[k] > 0, v = k => A[k] || 0;
    const sum = a => a.reduce((x, y) => x + (y || 0), 0);
    const L = (txt, amt, opt = {}) => ({ txt, amt, ...opt });
    const pageHead = (n) => `<div class="bs-top"><span>보장보상 안내서 · ${esc(p.insured)} 고객님</span><span>${n}/4</span></div>`;
    const foot = `<div class="bs-foot"><span>${agent}</span><span>${esc(D.company)} · 기준 약관: ${esc(D.basis)}</span></div>`;
    const rowCase = (title, lines, total, note) => `<tr><td class="bs-c">${title}</td><td>${lines.filter(Boolean).map(l => `<div>${l}</div>`).join("")}${note ? `<div class="bs-n">${note}</div>` : ""}</td><td class="bs-amt">${total}</td></tr>`;
    const part = (k, label) => has(k) ? `${label} ${fmt(v(k))}` : "";
    const join = arr => arr.filter(Boolean).join(" + ");
    const R = D.ref;

    /* --- 01 생활 속 사례 --- */
    const cases = [];
    const dsum = (...ks) => sum(ks.map(v));
    if (has("dsurg") || has("d1")) {
      const t = dsum("dsurg", "d1");
      cases.push(rowCase("대장용종 제거<br><small>건강검진 내시경 중</small>", [join([part("dsurg", "질병수술비"), part("d1", "1종")]) + ` <span class="bs-r">(${R.t88_2}) 회당</span>`, has("ben1") ? `첫 수술 시 특정양성종양Ⅰ(결장의 용종) ${fmt(v("ben1"))} 최초1회 추가` : ""], `${fmt(t)}${has("ben1") ? `<small>첫 회 ${fmt(t + v("ben1"))}</small>` : ""}`));
    }
    if (has("d2")) {
      const t = dsum("dsurg", "d2");
      cases.push(rowCase("위·십이지장 용종 제거", [join([part("dsurg", "질병수술비"), part("d2", "2종")]) + ` <span class="bs-r">(${R.t88_2b}) 회당</span>`, has("ben2") ? `첫 수술 시 특정양성종양Ⅱ(위·십이지장 용종) ${fmt(v("ben2"))} 최초1회 추가` : ""], `${fmt(t)}${has("ben2") ? `<small>첫 회 ${fmt(t + v("ben2"))}</small>` : ""}`));
    }
    if (has("d3") || has("s116_3")) {
      const t = dsum("s116_3", "dsurg", "d3");
      cases.push(rowCase("갑상선 결절(양성) 수술", [join([part("s116_3", "116대질병수술Ⅲ(갑상선 양성종양)"), part("dsurg", "질병수술비"), part("d3", "3종")]) + ` <span class="bs-r">(${R.t57})</span>`, has("ben1") ? `첫 수술 시 특정양성종양Ⅰ ${fmt(v("ben1"))} 최초1회 추가` : ""], `${fmt(t)}${has("ben1") ? `<small>첫 회 ${fmt(t + v("ben1"))}</small>` : ""}`));
      const t2 = dsum("s116_3", "dsurg", "d2");
      cases.push(rowCase("허리·목 디스크 수술", [join([part("s116_3", "116대질병수술Ⅲ(추간판장애)"), part("dsurg", "질병수술비"), part("d3", "3종")]) + ` <span class="bs-r">(${R.t9})</span>`], t2 !== t ? `${fmt(Math.min(t, t2))}~${fmt(Math.max(t, t2))}` : fmt(t)));
    }
    if (has("s116_4") || has("d3")) cases.push(rowCase("담석 · 담낭 수술", [join([part("s116_4", "116대질병수술Ⅳ(담석증·담낭담도질환)"), part("dsurg", "질병수술비"), part("d3", "3종")]) + ` <span class="bs-r">(${R.t36})</span>`], fmt(dsum("s116_4", "dsurg", "d3"))));
    if (has("s116_4") || has("d1")) cases.push(rowCase("축농증 · 편도 수술", [join([part("s116_4", "116대질병수술Ⅳ(축농증·편도염)"), part("dsurg", "질병수술비"), part("d1", "1종")]) + ` <span class="bs-r">(${R.t15})</span>`], fmt(dsum("s116_4", "dsurg", "d1"))));
    if (has("s116_2") || has("d3")) cases.push(rowCase("위·십이지장 궤양 수술", [join([part("s116_2", "116대질병수술Ⅱ"), part("dsurg", "질병수술비"), part("d3", "3종")]) + ` <span class="bs-r">(${R.t34})</span>`, has("d4") ? `위 절제수술이면 종수술비 4종 ${fmt(v("d4"))}` : ""], fmt(dsum("s116_2", "dsurg", "d3")) + (has("d4") && v("d4") > v("d3") ? "~" : "")));
    if (has("s116_6") || has("d1")) cases.push(rowCase("치핵(치질) · 치루 수술", [join([part("s116_6", "116대질병수술Ⅵ"), part("dsurg", "질병수술비"), part("d1", "1종")]) + ` <span class="bs-r">(${R.t44})</span>`], fmt(dsum("s116_6", "dsurg", "d1"))));
    if (has("d2") || has("s116_6")) { const a = v("d2"), b = dsum("s116_6", "dsurg", "d1"); cases.push(rowCase("요로 · 신장 결석", [`체외충격파 쇄석술: ${part("d2", "2종")}만 지급 <span class="bs-r">(${R.t87})</span>`, `요관 내시경 수술: ${join([part("s116_6", "116대Ⅵ"), part("dsurg", "질병수술비"), part("d1", "1종")])} <span class="bs-r">(${R.t88_3})</span>`], `${fmt(Math.min(a, b))}~${fmt(Math.max(a, b))}`)); }
    if (has("flu")) cases.push(rowCase("독감 (인플루엔자)", ["항바이러스제 처방 시 연1회 · 갱신형"], fmt(v("flu"))));
    if (has("frac") || has("frac2") || has("cast")) cases.push(rowCase("다쳐서 뼈가 부러지면", [join([part("frac", "골절진단"), part("frac2", "골절진단Ⅱ"), part("cast", "깁스")]) + (has("frac5") ? ` · 척추·골반·대퇴골 등 5대골절이면 ${fmt(v("frac5"))} 추가` : ""), has("isurg") ? `수술 시 상해수술비 ${fmt(v("isurg"))} + 1~5종 ${fmt(v("i1"))}~${fmt(v("i5"))}` : ""], fmt(dsum("frac", "frac2", "cast")) + "~"));
    const typeLine = ["d1", "d2", "d3", "d4", "d5"].some(has) ? `합계에는 약관 1~5종수술Ⅲ 분류표에 따른 종수술비(${[1, 2, 3, 4, 5].filter(i => has("d" + i)).map(i => `${i}종 ${fmt(v("d" + i))}`).join("·")}, 수술 1회당)가 포함돼 있습니다.` : "";

    /* --- 상단 요약 --- */
    const icParts = Object.keys(IC_NAME).filter(has);
    const cancerTop = v("cancer") + (has("ic_digest") ? v("ic_digest") : icParts.length ? v(icParts[0]) : 0);
    const ciLimit = v("ci_hi") + v("ci_np");
    const kpi = (t, big, sub) => `<div class="bs-k"><span>${t}</span><b>${big}</b><small>${sub}</small></div>`;
    const kpis = [
      has("cancer") ? kpi("일반암 진단 시", fmt(cancerTop), `암진단 ${fmt(v("cancer"))}${icParts.length ? " + 부위별 통합암 " + fmt(v(has("ic_digest") ? "ic_digest" : icParts[0])) : ""}`) : "",
      ciLimit ? kpi("암 치료비 (매년)", "최대 " + fmt(ciLimit), [has("ci_hi") ? `암통합치료 연 ${fmt(v("ci_hi"))} 한도` : "", has("ci_np") ? `비급여 암통합 연 ${fmt(v("ci_np"))} 한도` : ""].filter(Boolean).join(" + ")) : "",
      has("brain") || has("heart1") ? kpi("뇌혈관·심장 진단 시", `${fmt(v("brain"))} / ${fmt(v("heart1"))}`, "뇌혈관질환 / 심장질환(특정Ⅰ)") : "",
      has("circ") ? kpi("뇌·심장 치료비 (매년)", "최대 " + fmt(v("circ")), "순환계 통합치료 연 한도") : "",
    ].join("");

    const p1 = `<div class="a4 bs">${pageHead(1)}
      <div class="bs-h"><div><div class="bs-kk">COVERAGE &amp; CLAIM GUIDE</div><h2>보장보상 안내서</h2></div><div class="bs-who"><b>${esc(p.insured)} 고객님</b>${p.sex ? " · " + esc(p.sex) : ""}${p.age ? " " + p.age + "세" : ""}<br><span>${esc(p.product)}</span></div></div>
      <p class="bs-lead">"아프면 실제로 얼마를 받는가"만 정리했습니다. 자주 생기는 검진·수술 사례와 큰 병(암·뇌·심장)이 생겼을 때의 지급 흐름입니다. 금액은 이 설계 기준 <b>가입 1년 이후 지급액</b>입니다.</p>
      <div class="bs-kpis">${kpis}</div>
      <h4 class="bs-sec"><span>01</span> 검진·생활 속에서 자주 받는 보험금</h4>
      ${typeLine ? `<p class="bs-small">${typeLine}</p>` : ""}
      <table class="bs-t"><thead><tr><th style="width:22%">이런 일이 생기면</th><th>받는 보험금</th><th style="width:14%">합계</th></tr></thead><tbody>${cases.join("") || `<tr><td colspan="3">수술·진단 담보가 없습니다.</td></tr>`}</tbody></table>
      ${foot}</div>`;

    /* --- 02 암 --- */
    const H = T.ci_hi || {}, N = T.ci_np || {};
    const step = (no, title, sub, lines, total, totSub) => `<div class="bs-step"><div class="bs-sn"><b>${no} ${title}</b><small>${sub}</small></div><div class="bs-sl">${lines.filter(Boolean).map(l => `<div><span>${l[0]}</span><b>${l[1]}</b></div>`).join("")}</div><div class="bs-st"><b>${total}</b><small>${totSub || ""}</small></div></div>`;
    const icFirst = has("ic_digest") ? "ic_digest" : icParts[0];
    const examSum = H.mri != null ? H.mri + H.pet + H.ct + H.us + H.endo + H.gene + H.biopsy : 0;
    const surgSum = (H.surg || 0) + (H.np_surg || 0) + (N.np_surg || 0) + v("dsurg") + v("d5");
    const robotSum = v("robot") + (H.np_robot || 0) + (N.np_robot || 0);
    const cancerDx = v("cancer") + (icFirst ? v(icFirst) : 0);
    const tierNote = M.tierMissing.length ? `<p class="bs-warn">통합치료비 가입금액(${M.tierMissing.map(k => fmt(A[k])).join(", ")})의 세부 지급표가 사전에 없어 세부 금액을 비웠습니다. 약관 확인 후 등록하겠습니다.</p>` : "";
    const p2body = has("cancer") || has("ci_hi") ? `
      <h4 class="bs-sec"><span>02</span> 암 — 진단부터 매년 치료까지</h4>
      <p class="bs-small">예: 위암·대장암(소화기관암) 진단 시. 치료비 항목은 매년 다시 지급됩니다(연간 1회 항목).</p>${tierNote}
      ${step("①", "진단", "암 확정 즉시", [has("cancer") ? ["암진단비 (유사암 제외)", fmt(v("cancer"))] : null, icFirst ? [`통합암진단비 · ${IC_NAME[icFirst]} (부위별)`, fmt(v(icFirst))] : null, icFirst ? ["다른 부위로 전이되면 (간·폐 등) 부위마다", "+" + fmt(v(icFirst))] : null, ["이후 보험료", "납입면제"]], fmt(cancerDx), "일시금")}
      ${H.mri != null ? step("②", "검사", "종합병원 · 연1회", [[`MRI·PET·CT·초음파·내시경·유전자검사 각 ${fmt(H.mri)}, 조직병리 ${fmt(H.biopsy)}`, fmt(examSum)], ["특정 NGS 유전자패널검사", fmt(H.ngs)]], fmt(examSum + H.ngs), "매년") : ""}
      ${step("③", "수술", "수술할 때마다", [H.surg ? ["암 수술 (급여)", fmt(H.surg)] : null, (H.np_surg || N.np_surg) ? ["비급여(전액본인부담) 암수술 · 두 특약 합산", [H.np_surg, N.np_surg].filter(Boolean).map(fmt).join("+")] : null, has("robot") ? ["로봇(다빈치) 수술 시 · 로봇암수술비 최초1회 갱신형", fmt(v("robot"))] : null, (H.np_robot || N.np_robot) ? ["비급여 로봇수술 · 두 특약 합산", [H.np_robot, N.np_robot].filter(Boolean).map(fmt).join("+")] : null, has("dsurg") ? ["질병수술비", fmt(v("dsurg"))] : null, has("d5") ? [`종수술비 · 관혈적 근치수술 5종${has("d3") ? ` (내시경 절제는 3종 ${fmt(v("d3"))})` : ""}`, fmt(v("d5"))] : null], fmt(surgSum), robotSum ? `로봇수술 시 +${fmt(robotSum)}` : "")}
      ${step("④", "항암치료", "매년 1회씩", [H.chemo ? [`항암약물 (급여)${has("chemo") ? ` · 첫 치료 시 ${fmt(v("chemo"))} 추가` : ""}`, fmt(H.chemo)] : null, H.rad ? [`항암방사선 (급여)${has("rad") ? ` · 첫 치료 시 ${fmt(v("rad"))} 추가` : ""}`, fmt(H.rad)] : null, H.imrt ? ["항암세기조절방사선(IMRT)", fmt(H.imrt)] : null, has("d3") ? ["근치 방사선(5,000Rad 이상) 종수술비 3종 · 60일마다", fmt(v("d3"))] : null, (H.np_chemo || N.np_chemo) ? ["비급여 항암약물 / 비급여 항암방사선 (각각)", fmt((H.np_chemo || 0) + (N.np_chemo || 0))] : null, (H.np_target || N.np_target) ? ["표적항암제 (비급여 · 허가치료)", fmt((H.np_target || 0) + (N.np_target || 0))] : null, (H.np_immune || N.np_immune) ? ["면역항암제 (비급여 · 허가치료)", fmt((H.np_immune || 0) + (N.np_immune || 0))] : null, (H.np_proton || N.np_proton) ? ["양성자 방사선 (비급여)", fmt((H.np_proton || 0) + (N.np_proton || 0))] : null, has("cart") ? ["카티(CAR-T) 치료 (혈액암 등 적응증) 갱신형", fmt(v("cart"))] : null], ciLimit ? "최대 " + fmt(ciLimit) : "", "연간 한도 합")}
      ${step("⑤", "입원·회복", "매년", [H.icu ? ["암 중환자실 치료", fmt(H.icu)] : null, has("icu_d") ? [`질병 중환자실 입원 1일당 (최대 180일)`, fmt(v("icu_d"))] : null, H.pain ? [`통증완화치료 ${fmt(H.pain)} · 항암호르몬 ${fmt(H.horm)} · 재활 1일 ${fmt(H.rehab)}(연 30회)`, "~" + fmt(H.pain + H.horm + H.rehab * 30)] : null], H.icu ? "~" + fmt(H.icu + v("icu_d") * 15) : "", "매년")}
      <div class="bs-lim"><b>암 연간 보장 한도 · 매년 새로 채워집니다</b><div>${has("ci_hi") ? `<p><b>① 암통합치료비 — 연 ${fmt(v("ci_hi"))}원 한도</b><br>검사, 급여 수술·항암약물·방사선·IMRT, 중환자실, 통증완화, 항암호르몬, 재활 + 비급여 치료의 앞 금액</p>` : ""}${has("ci_np") ? `<p><b>② 비급여 암통합치료비 — 연 ${fmt(v("ci_np"))}원 한도</b><br>비급여 수술·로봇수술·항암약물·방사선, 표적·면역항암, 양성자의 뒤 금액</p>` : ""}</div>
      <p class="bs-small">한도와 별도로 지급: 암 진단비 · 항암약물/방사선치료비 첫 회 · 로봇암수술비 · CAR-T · 질병수술비 · 종수술비 · 질병중환자실 일당</p></div>` : `<p>암 관련 담보가 없습니다.</p>`;
    const thy = has("simcancer") ? `<div class="bs-box"><b>갑상선암 (유사암)인 경우</b>
      <div><span>유사암 진단비</span><b>${fmt(v("simcancer"))}</b></div>
      ${H.simsurg ? `<div><span>수술: ${join([`유사암수술 ${fmt(H.simsurg)}`, part("s116_4", "116대Ⅳ"), part("dsurg", "질병수술"), part("d5", "5종")])}</span><b>${fmt(H.simsurg + v("s116_4") + v("dsurg") + v("d5"))}</b></div>` : ""}
      ${(H.np_surg_thy || N.np_surg_thy) ? `<div><span>비급여 수술 시 (두 특약 합산)</span><b>+${fmt((H.np_surg_thy || 0) + (N.np_surg_thy || 0))}</b></div>` : ""}
      ${has("robot_thy") ? `<div><span>로봇수술 시 (갑상선 로봇 ${fmt(v("robot_thy"))} + 비급여 로봇 ${fmt((H.np_robot_thy || 0) + (N.np_robot_thy || 0))})</span><b>+${fmt(v("robot_thy") + (H.np_robot_thy || 0) + (N.np_robot_thy || 0))}</b></div>` : ""}
      ${has("thy_horm") ? `<div><span>호르몬약 처방 (최초 ${fmt(v("thy_horm"))}${H.simhorm ? " + 매년 " + fmt(H.simhorm) : ""})</span><b>${fmt(v("thy_horm") + (H.simhorm || 0))}</b></div>` : ""}</div>` : "";
    const notice = `<div class="bs-box"><b>꼭 알아두실 점</b><p>암 보장은 계약일부터 90일이 지난 다음날부터 시작합니다 (유사암은 계약일부터).</p>${has("ci_np") || has("ci_hi") ? "<p>통합치료비는 가입 1년 미만이면 각 항목 50% 지급합니다.</p>" : ""}${["s116_1", "s116_2", "s116_3", "s116_4", "s116_5", "s116_6"].some(has) ? "<p>116대질병수술비는 가입 1년 미만 50% 지급합니다.</p>" : ""}<p>유사암(갑상선암 등)은 보험료 납입면제 대상이 아닙니다.</p></div>`;
    const p2 = `<div class="a4 bs">${pageHead(2)}${p2body}${foot}</div>`;

    /* --- 03 뇌경색 · 04 협심증 --- */
    const C = T.circ || {};
    const brainStep = has("brain") || has("circ") ? `
      <h4 class="bs-sec"><span>03</span> 뇌경색 — 응급실에서 재활까지</h4><p class="bs-small">뇌경색·뇌출혈 등 뇌혈관질환으로 응급 이송된 경우의 흐름입니다.</p>
      ${step("①", "진단", "뇌혈관질환 확정", [has("brain") ? ["뇌혈관질환 진단비", fmt(v("brain"))] : null, ["이후 보험료", "납입면제"]], fmt(v("brain")), "일시금")}
      ${C.lysis_b ? step("②", "응급실", "골든타임", [["혈전용해제 투여 (뇌혈관 혈전용해치료)", fmt(C.lysis_b)], [`MRI ${fmt(C.mri)} · CT ${fmt(C.ct)} · PET ${fmt(C.pet)}`, fmt(C.mri + C.ct + C.pet)]], fmt(C.lysis_b + C.mri + C.ct + C.pet), "연1회") : ""}
      ${C.icu ? step("③", "중환자실", "입실 시", [["종합병원 중환자실 치료", fmt(C.icu)], has("icu_d") ? ["질병 중환자실 입원 1일당 (최대 180일)", fmt(v("icu_d"))] : null, [`에크모 ${fmt(C.ecmo)} · 투석(CRRT) ${fmt(C.crrt)} · 인공호흡기 ${fmt(C.vent)} · 저체온치료 ${fmt(C.hypo)}`, "해당 시"]], fmt(C.icu) + "+", "일당 별도") : ""}
      ${step("④", "시술·수술", "할 때마다", [C.thromb ? ["혈전제거술", fmt(C.thromb)] : null, C.surg ? ["그 밖의 수술 (혈전제거술 제외)", fmt(C.surg)] : null, has("d3") ? [`종수술비 · 카테터 혈전제거 3종${has("d5") ? ` (개두술이면 5종 ${fmt(v("d5"))})` : ""}`, fmt(v("d3"))] : null, (has("s116_1") || has("dsurg")) ? [`116대질병수술Ⅰ(뇌혈관질환) + 질병수술비 · 약관상 수술 해당 시`, fmt(v("s116_1") + v("dsurg"))] : null], C.thromb ? fmt(C.thromb) + "~" : fmt(v("d3")), "회당")}
      ${C.anticoag ? step("⑤", "약·재활", "퇴원 후", [[`항응고제 ${fmt(C.anticoag)} · 항혈소판제 ${fmt(C.antiplt)} (연1회)`, fmt(C.anticoag + C.antiplt)], [`재활치료 1일 ${fmt(C.rehab)} (입원·통원 연 20회)`, fmt(C.rehab * 20)]], fmt(C.anticoag + C.antiplt + C.rehab * 20), "매년") : ""}
      ${C.lysis_b ? `<div class="bs-ex">예시: 응급실 혈전용해 → 중환자실 7일 → 혈전제거술 → 약 처방<br>진단 ${fmt(v("brain"))} + 혈전용해 ${fmt(C.lysis_b)} + 검사 ${fmt(C.mri + C.ct + C.pet)} + 중환자실 ${fmt(C.icu)} + 일당 ${fmt(v("icu_d") * 7)} + 혈전제거 ${fmt(C.thromb)} + 종수술 3종 ${fmt(v("d3"))} + 약 ${fmt(C.anticoag + C.antiplt)}<b>${fmt(v("brain") + C.lysis_b + C.mri + C.ct + C.pet + C.icu + v("icu_d") * 7 + C.thromb + v("d3") + C.anticoag + C.antiplt)}</b></div>` : ""}
      ${has("circ") ? `<div class="bs-lim"><b>뇌·심장 연간 보장 한도 · 매년 새로 채워집니다</b><p>신특정순환계질환 통합치료비 — 연 ${fmt(v("circ"))}원 한도. 뇌와 심장이 같은 특약이라 한 해 합산 ${fmt(v("circ"))}원입니다. 진단비·질병중환자실 일당·종수술비·116대질병수술비·질병수술비는 한도와 별도입니다.</p></div>` : ""}` : "";
    const heartStep = has("heart1") || has("circ") ? `
      <h4 class="bs-sec"><span>04</span> 협심증 — 응급실에서 재활까지</h4><p class="bs-small">가슴 통증으로 응급실에 가서 협심증 진단 후 스텐트를 넣는 경우의 흐름입니다.</p>
      ${step("①", "진단", "협심증 확정", [has("heart1") ? ["심장질환(특정Ⅰ) 진단비 · 협심증·심방세동·심부전 등", fmt(v("heart1"))] : null, has("heart2") ? ["심근경색으로 진행되면 심장질환(특정Ⅱ) 진단비 추가", "+" + fmt(v("heart2"))] : null, ["이후 보험료 (허혈성심장질환)", "납입면제"]], fmt(v("heart1")), "일시금")}
      ${C.mri != null ? step("②", "응급실", "검사·응급치료", [[`MRI ${fmt(C.mri)} · CT ${fmt(C.ct)} · PET ${fmt(C.pet)}`, fmt(C.mri + C.ct + C.pet)], ["혈전용해제 투여 (허혈성심장질환 혈전용해치료) · 해당 시", fmt(C.lysis_h)]], fmt(C.mri + C.ct + C.pet) + "~", "연1회") : ""}
      ${step("③", "시술·수술", "할 때마다", [has("d3") ? [`스텐트 시술 · 종수술비 3종 <span class="bs-r">(${R.t88_1})</span>`, fmt(v("d3"))] : null, C.surg ? ["순환계 통합치료 수술 · 약관상 수술 해당 시", fmt(C.surg)] : null, (has("s116_1") || has("dsurg")) ? ["116대질병수술Ⅰ(심장질환) + 질병수술비 · 약관상 수술 해당 시", fmt(v("s116_1") + v("dsurg"))] : null, has("d5") ? ["관상동맥 우회술(개흉)이면 종수술비 5종", fmt(v("d5"))] : null], fmt(v("d3")) + "~", "회당")}
      ${C.anticoag ? step("④", "약·재활", "퇴원 후", [[`항혈소판제 ${fmt(C.antiplt)} (스텐트 후 복용) · 항응고제 ${fmt(C.anticoag)} (연1회)`, fmt(C.antiplt) + "~" + fmt(C.antiplt + C.anticoag)], [`재활치료 1일 ${fmt(C.rehab)} (입원·통원 연 20회)`, fmt(C.rehab * 20)]], fmt(C.antiplt + C.anticoag + C.rehab * 20), "매년") : ""}
      ${C.icu ? `<div class="bs-ex">예시: 응급실 검사 → 협심증 진단 → 스텐트 → 중환자실 2일 → 항혈소판제<br>진단 ${fmt(v("heart1"))} + 검사 ${fmt(C.mri + C.ct + C.pet)} + 스텐트 3종 ${fmt(v("d3"))} + 중환자실 ${fmt(C.icu)} + 일당 ${fmt(v("icu_d") * 2)} + 항혈소판 ${fmt(C.antiplt)} · 순환계 수술로 인정되면 +${fmt(C.surg)}<b>${fmt(v("heart1") + C.mri + C.ct + C.pet + v("d3") + C.icu + v("icu_d") * 2 + C.antiplt)}</b></div>` : ""}
      <div class="bs-box"><b>심장 진단비 한눈에</b>${has("heart1") ? `<div><span>협심증 · 심방세동 · 심부전 등 (특정Ⅰ)</span><b>${fmt(v("heart1"))}</b></div>` : ""}${has("heart2") ? `<div><span>급성 심근경색 · 심정지 소생 (특정Ⅱ)</span><b>${fmt(v("heart2"))}</b></div>` : ""}${has("arrhy") ? `<div><span>부정맥 (I49)</span><b>${fmt(v("arrhy"))}</b></div>` : ""}<div><span>각각 별도 · 각 최초 1회</span><b>최대 ${fmt(v("heart1") + v("heart2") + v("arrhy"))}</b></div></div>` : "";
    const unknown = M.unknown.length ? `<div class="bs-warn"><b>사전에 없어 계산에서 뺀 담보 ${M.unknown.length}개</b> — ${M.unknown.slice(0, 12).map(i => esc(i.name.replace(/\(맞춤고지\)/g, ""))).join(", ")}${M.unknown.length > 12 ? " 외" : ""}. 약관 확인 후 사전에 추가합니다.</div>` : "";
    const common = `<p class="bs-common">공통 안내 · 금액은 ${esc(D.company)} 상품제안서(${p.no ? "청약번호 " + esc(p.no) + ", " : ""}${p.issued ? esc(p.issued) + " 발급" : ""})의 가입금액과 ${esc(D.basis)}의 지급 기준(가입 1년 이후)으로 계산했습니다. 종수술비는 약관 【별표55-1】 1~5종수술Ⅲ 분류표 기준입니다. 실제 지급 여부와 금액은 진단명·질병코드·수술 분류에 따라 달라지며, 약관이 우선합니다. 가입 전 상품설명서와 약관을 반드시 확인하시기 바랍니다.</p>`;
    const p3 = `<div class="a4 bs">${pageHead(3)}${thy ? `<div class="bs-2col">${thy}${notice}</div>` : notice}${brainStep}${foot}</div>`;
    const p4 = `<div class="a4 bs">${pageHead(4)}${heartStep}${common}${foot}</div>`;
    return p1 + p2 + p3 + p4;
  }


  /* ---------------- 7. 화면 (보잇 index.html 의 보상제안서 메뉴) ---------------- */
  const CSS = `
.a4.bs{padding:34px 40px 28px;gap:10px;font-size:11.5px;line-height:1.5}
.bs-top{display:flex;justify-content:space-between;font-size:10.5px;color:var(--ink2);border-bottom:1px solid var(--pline);padding-bottom:6px}
.bs-h{display:flex;justify-content:space-between;align-items:flex-end;gap:16px}
.bs-kk{font-size:10px;letter-spacing:.18em;color:var(--pacc);font-weight:700}
.bs-h h2{margin:2px 0 0;font-size:26px;color:var(--ink)}
.bs-who{text-align:right;font-size:13px}.bs-who span{font-size:11px;color:var(--ink2)}
.bs-lead{margin:0;color:var(--ink2);font-size:11.5px}
.bs-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.bs-k{border:1px solid var(--pline);border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:2px}
.bs-k span{font-size:10.5px;color:var(--ink2)}.bs-k b{font-size:17px;color:var(--pacc);line-height:1.2;white-space:nowrap}.bs-k small{font-size:10px;color:var(--ink2)}
.bs-sec{display:flex;gap:8px;align-items:center;font-size:15px;margin:6px 0 0;color:var(--ink)}.bs-sec span{background:var(--pacc);color:#fff;border-radius:4px;padding:0 6px;font-size:12px}
.bs-small{margin:0;font-size:10.5px;color:var(--ink2)}
.bs-t{width:100%;border-collapse:collapse}.bs-t th{text-align:left;font-size:10.5px;padding:4px 6px}.bs-t td{padding:5px 6px;vertical-align:top;font-size:11px}
.bs-c{font-weight:600}.bs-c small{font-weight:400;color:var(--ink2)}
.bs-amt{text-align:right;font-weight:700;color:var(--pacc);white-space:nowrap}.bs-amt small{display:block;font-weight:500;color:var(--ink2);font-size:10px}
.bs-r{color:var(--ink2);font-size:10px}.bs-n{color:var(--ink2);font-size:10px}
.bs-step{display:grid;grid-template-columns:92px 1fr 92px;gap:8px;border-bottom:1px solid var(--pline);padding:5px 0}
.bs-sn b{display:block;font-size:12px}.bs-sn small{color:var(--ink2);font-size:10px}
.bs-sl div{display:flex;justify-content:space-between;gap:10px;font-size:11px}.bs-sl div b{white-space:nowrap;font-weight:600}
.bs-st{text-align:right}.bs-st b{display:block;font-size:14px;color:var(--pacc);white-space:nowrap}.bs-st small{font-size:10px;color:var(--ink2)}
.bs-lim,.bs-box,.bs-ex{border:1px solid var(--pline);border-radius:8px;padding:8px 10px;font-size:10.8px}
.bs-lim p,.bs-box p{margin:3px 0}.bs-box>div{display:flex;justify-content:space-between;gap:10px}.bs-box>div b{color:var(--pacc);white-space:nowrap}
.bs-ex{background:var(--pacc-soft)}.bs-ex b{float:right;font-size:14px;color:var(--pacc)}
.bs-2col{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.bs-warn{border:1px solid var(--pwarn);background:var(--pwarn-soft);border-radius:8px;padding:6px 10px;font-size:10.5px;margin:0}
.bs-common{margin:0;font-size:10px;color:var(--ink2)}
.bs-foot{margin-top:auto;border-top:1px solid var(--pline);padding-top:6px;font-size:9.5px;color:var(--ink2);display:flex;justify-content:space-between;gap:12px}
#bs-list .bsrow{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid var(--line,#e5e5e5);padding:6px 0;font-size:13px}`;
  const S = { docs: [] };
  const $ = q => document.querySelector(q);
  const agentText = () => { try { return typeof agentLine === "function" ? agentLine().replace(/<[^>]+>/g, "") : ""; } catch (e) { return ""; } };
  function draw() {
    const box = $("#sheets-bosang"), list = $("#bs-list"); if (!box) return;
    box.innerHTML = S.docs.map(d => render(d.M, esc(agentText()))).join("");
    list.innerHTML = S.docs.map((d, i) => `<div class="bsrow"><span><b>${esc(d.M.p.insured || "고객")}</b> · ${esc(d.M.p.product || d.file)}</span><span>${d.M.D ? `계산한 담보 ${d.M.used.length}개${d.M.unknown.length ? ` · <span style="color:var(--warn,#b45309)">사전에 없는 담보 ${d.M.unknown.length}개(안내서에서 제외)</span>` : ""}` : `<span style="color:var(--bad,#b91c1c)">상품 보장 사전 없음</span>`} <button class="btn" type="button" data-bsdel="${i}">빼기</button></span></div>`).join("") || `<p class="note" style="margin:0">회사별로 설계한 상품제안서 PDF를 올리면 고객용 안내서(A4 4장)가 만들어집니다. PDF는 이 기기에서만 읽고 저장하지 않습니다.</p>`;
    const un = S.docs.flatMap(d => d.M.unknown.map(u => u.name));
    $("#bs-unknown").innerHTML = un.length ? `<details><summary>사전에 없는 담보 ${un.length}개 보기 (설계사용 · 고객 안내서에는 나오지 않음)</summary><p class="note">${un.map(esc).join("<br>")}</p></details>` : "";
    $("#bs-pdf").disabled = !S.docs.length;
  }
  async function addFiles(files) {
    const msg = $("#bs-msg");
    if (!G.pdfjsLib) { msg.textContent = "PDF 도구를 불러오지 못했습니다. 새로고침 후 다시 시도하세요."; return; }
    for (const f of files) {
      msg.textContent = `${f.name} 읽는 중…`;
      try {
        const pages = await pdfLines(G.pdfjsLib, new Uint8Array(await f.arrayBuffer()));
        const p = parseKB(pages);
        if (!p.items.length) { msg.textContent = `${f.name}: ${p.warn[0] || "담보를 찾지 못했습니다."}`; continue; }
        S.docs.push({ file: f.name, M: build(p) });
        msg.textContent = `${f.name}: 담보 ${p.items.filter(i => !i.group).length}개를 읽었습니다.`;
      } catch (e) { msg.textContent = `${f.name}: PDF를 읽지 못했습니다${e && /password/i.test(e.name || e.message || "") ? " (암호가 걸린 PDF)" : ""}.`; }
    }
    draw();
  }
  async function savePdf() {
    const msg = $("#bs-msg"), b = $("#bs-pdf");
    if (!G.html2canvas || !G.jspdf) { msg.textContent = "PDF 도구를 불러오지 못했습니다."; return; }
    let dl = null; try { dl = typeof DL !== "undefined" ? DL : null; } catch (e) { }
    if (!dl) { msg.textContent = "이 화면에서는 파일 저장을 지원하지 않습니다."; return; }
    b.disabled = true;
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const pages = [...$("#sheets-bosang").querySelectorAll(".a4")], pdf = new G.jspdf.jsPDF({ unit: "mm", format: "a4" });
      for (let i = 0; i < pages.length; i++) {
        msg.textContent = `PDF를 만드는 중… ${i + 1}/${pages.length}장`;
        const cv = await G.html2canvas(pages[i], { scale: 2, backgroundColor: "#ffffff" });
        if (i) pdf.addPage(); pdf.addImage(cv.toDataURL("image/jpeg", .92), "JPEG", 0, 0, 210, 297);
      }
      const nm = (S.docs[0] && S.docs[0].M.p.insured) || "고객";
      const d = new Date(), ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
      await dl.save({ filename: `보상제안서_${nm}_${ymd}.pdf`, data: pdf.output("blob") });
      msg.textContent = "저장했습니다.";
    } catch (e) { msg.textContent = e && e.code === "declined" ? "저장을 취소했습니다." : "PDF 저장에 실패했습니다. 다시 시도해 주세요."; }
    finally { b.disabled = !S.docs.length; }
  }
  function init() {
    if (!document.getElementById("bs-style")) { const st = document.createElement("style"); st.id = "bs-style"; st.textContent = CSS; document.head.appendChild(st); }
    const inp = $("#bs-file"); if (!inp) return;
    inp.addEventListener("change", e => { const fs = [...e.target.files]; e.target.value = ""; addFiles(fs); });
    $("#bs-pdf").addEventListener("click", savePdf);
    document.addEventListener("click", e => { const d = e.target.closest("[data-bsdel]"); if (d) { S.docs.splice(+d.dataset.bsdel, 1); draw(); } });
    draw();
  }
  if (typeof document !== "undefined") { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init(); }

  G.BOSANG = { pdfLines, parseKB, build, render, man, fmt, DICTS };
})(typeof window !== "undefined" ? window : globalThis);
