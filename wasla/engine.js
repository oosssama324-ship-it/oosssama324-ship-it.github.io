/*
  وَصلة — محرك اللعبة (منطق بحت بدون واجهة، قابل للاختبار)
  يحتوي على:
   1) توحيد الحروف العربية (normalize)
   2) مولّد شبكة الكلمات المتقاطعة (buildCrossword)
   3) متتبّع السحب على عجلة الحروف (SwipeTracker)
   4) التحقق من الكلمة (checkWord)
*/
(function (root) {
  "use strict";

  // ---------- 1) توحيد الحروف ----------
  // نزيل التشكيل والتطويل، ونوحّد أشكال الألف، حتى تُقبل "أمل" و"امل" ككلمة واحدة.
  // نُبقي "ى" حرفًا مستقلًا حتى تظهر كلمات مثل "أخرى" صحيحة في الشبكة.
  const DIACRITICS = /[ً-ْٰـ]/g; // فتحة، ضمة، كسرة، سكون، شدة، تنوين، ألف خنجرية، تطويل
  function normalize(word) {
    return String(word)
      .replace(DIACRITICS, "")
      .replace(/[أإآٱ]/g, "ا")
      .trim();
  }

  // هل يمكن تكوين الكلمة من حروف العجلة؟ (كل حرف يُستخدم مرة واحدة)
  function canBuild(word, letters) {
    const pool = {};
    for (const l of letters) { const k = normalize(l); pool[k] = (pool[k] || 0) + 1; }
    for (const ch of normalize(word)) { if (!pool[ch]) return false; pool[ch]--; }
    return true;
  }

  // ---------- 2) مولّد الكلمات المتقاطعة ----------
  // الإحداثيات منطقية: c يزيد باتجاه القراءة العربية (من اليمين لليسار)،
  // والواجهة تعرض الشبكة بـ direction: rtl فتظهر الكلمات الأفقية صحيحة.
  // الخوارزمية: نضع أطول كلمة أفقيًا، ثم نحاول تقاطع كل كلمة تالية مع حرف مشترك
  // بالاتجاه المعاكس، ونختار الموضع الذي يُبقي الشبكة أصغر ما يمكن.
  function buildCrossword(words) {
    const list = [...new Set(words.map(normalize))].sort((a, b) => b.length - a.length);
    const cells = new Map(); // "r,c" -> { ch, dirs:Set }
    const placed = [];
    const key = (r, c) => r + "," + c;

    function fits(w, r, c, dir) {
      const dr = dir === "v" ? 1 : 0, dc = dir === "h" ? 1 : 0;
      // الخانة قبل الكلمة وبعدها يجب أن تكون فارغة
      if (cells.has(key(r - dr, c - dc)) || cells.has(key(r + dr * w.length, c + dc * w.length))) return false;
      let crosses = 0;
      for (let i = 0; i < w.length; i++) {
        const rr = r + dr * i, cc = c + dc * i, cell = cells.get(key(rr, cc));
        if (cell) {
          if (cell.ch !== w[i] || cell.dirs.has(dir)) return false;
          crosses++;
        } else {
          // لا نسمح بملامسة جانبية تكوّن كلمات عشوائية
          const s1 = key(rr + dc, cc + dr), s2 = key(rr - dc, cc - dr);
          if (cells.has(s1) || cells.has(s2)) return false;
        }
      }
      return crosses > 0 || placed.length === 0;
    }

    function put(w, r, c, dir) {
      const dr = dir === "v" ? 1 : 0, dc = dir === "h" ? 1 : 0;
      for (let i = 0; i < w.length; i++) {
        const k = key(r + dr * i, c + dc * i);
        const cell = cells.get(k) || { ch: w[i], dirs: new Set() };
        cell.dirs.add(dir); cells.set(k, cell);
      }
      placed.push({ word: w, r, c, dir });
    }

    function area(extra) {
      let r0 = Infinity, r1 = -Infinity, c0 = Infinity, c1 = -Infinity;
      const all = [...cells.keys()].map(k => k.split(",").map(Number)).concat(extra);
      for (const [r, c] of all) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
      const h = r1 - r0 + 1, w = c1 - c0 + 1;
      return h * w + Math.abs(h - w) * 2; // نفضّل الشكل المربع
    }

    const unplaced = [];
    for (const w of list) {
      if (!placed.length) { put(w, 0, 0, "h"); continue; }
      let best = null;
      for (const p of placed) {
        const dir = p.dir === "h" ? "v" : "h";
        for (let i = 0; i < p.word.length; i++) {
          for (let j = 0; j < w.length; j++) {
            if (p.word[i] !== w[j]) continue;
            const pr = p.r + (p.dir === "v" ? i : 0), pc = p.c + (p.dir === "h" ? i : 0);
            const r = dir === "v" ? pr - j : pr, c = dir === "h" ? pc - j : pc;
            if (!fits(w, r, c, dir)) continue;
            const ext = [...w].map((_, k) => [r + (dir === "v" ? k : 0), c + (dir === "h" ? k : 0)]);
            const score = area(ext);
            if (!best || score < best.score) best = { r, c, dir, score };
          }
        }
      }
      if (best) put(w, best.r, best.c, best.dir); else unplaced.push(w);
    }

    // نقل الإحداثيات لتبدأ من (0,0)
    let r0 = Infinity, c0 = Infinity, r1 = -Infinity, c1 = -Infinity;
    for (const k of cells.keys()) { const [r, c] = k.split(",").map(Number); r0 = Math.min(r0, r); c0 = Math.min(c0, c); r1 = Math.max(r1, r); c1 = Math.max(c1, c); }
    return {
      rows: r1 - r0 + 1, cols: c1 - c0 + 1,
      words: placed.map(p => ({ ...p, r: p.r - r0, c: p.c - c0 })),
      unplaced
    };
  }

  // خانات كلمة معيّنة في الشبكة
  function cellsOf(p) {
    return [...p.word].map((ch, i) => ({ r: p.r + (p.dir === "v" ? i : 0), c: p.c + (p.dir === "h" ? i : 0), ch }));
  }

  // ---------- 3) متتبّع السحب ----------
  // يستقبل مراكز الحروف على العجلة، ويحوّل حركة الإصبع إلى مسار حروف:
  //  - يضيف الحرف عند المرور فوقه (إن لم يُستخدم)
  //  - يتراجع خطوة إذا عاد الإصبع إلى الحرف السابق (Backtrack)
  class SwipeTracker {
    constructor(nodes, hitRadius) { this.nodes = nodes; this.hit = hitRadius; this.path = []; }
    nodeAt(x, y) {
      for (let i = 0; i < this.nodes.length; i++) {
        const n = this.nodes[i];
        if ((n.x - x) ** 2 + (n.y - y) ** 2 <= this.hit ** 2) return i;
      }
      return -1;
    }
    start(x, y) { this.path = []; const i = this.nodeAt(x, y); if (i >= 0) this.path.push(i); return i >= 0; }
    move(x, y) {
      const i = this.nodeAt(x, y);
      if (i < 0) return false;
      const p = this.path;
      if (p.length >= 2 && i === p[p.length - 2]) { p.pop(); return true; }   // تراجع
      if (!p.includes(i)) { p.push(i); return true; }                         // حرف جديد
      return false;
    }
    word(letters) { return this.path.map(i => letters[i]).join(""); }
    end() { const p = this.path; this.path = []; return p; }
  }

  // ---------- 4) التحقق من الكلمة ----------
  // النتيجة: target (كلمة مطلوبة جديدة) | repeat (وُجدت سابقًا) | bonus (كلمة صحيحة إضافية)
  //          | bonusRepeat | short | invalid
  function checkWord(raw, level, state, dictionary) {
    const w = normalize(raw);
    if (w.length < 2) return { type: "short", word: w };
    const targets = level.layout.words.map(p => p.word);
    if (targets.includes(w)) return { type: state.found.has(w) ? "repeat" : "target", word: w };
    const isWord = (level.bonus || []).map(normalize).includes(w) || level.layout.unplaced.includes(w) || (dictionary && dictionary.has(w));
    if (isWord && canBuild(w, level.letters)) return { type: state.bonus.has(w) ? "bonusRepeat" : "bonus", word: w };
    return { type: "invalid", word: w };
  }

  const api = { normalize, canBuild, buildCrossword, cellsOf, SwipeTracker, checkWord };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Wasla = api;
})(typeof self !== "undefined" ? self : this);
