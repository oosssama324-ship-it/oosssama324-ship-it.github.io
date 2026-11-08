#!/usr/bin/env node
/*
  مولّد مستويات «وَصلة» من المعجم
  التشغيل:  node gen_levels.js
  المدخل:   ../dict/ar-common.tsv  (من build_dict.py)
  المخرج:   ../levels-gen.js

  الفكرة: نأخذ كلمة شائعة «بذرة»، حروفها تصبح حروف العجلة، ثم نستخرج أشهر الكلمات
  التي يمكن تكوينها من هذه الحروف، ونبني لها شبكة متقاطعة. نرتّب المستويات من الأسهل للأصعب.
*/
const fs = require("fs"), path = require("path");
const { normalize, canBuild, buildCrossword } = require("../engine.js");
const BLOCK = new Set(fs.readFileSync(path.join(__dirname, "blocklist.txt"), "utf8")
  .split("\n").map(l => normalize(l.split("#")[0])).filter(Boolean));

// كم مستوى من كل طول، وحدود عدد الكلمات
const PLAN = [
  { letters: 4, count: 50,  minLen: 2, minWords: 3, maxWords: 5 },
  { letters: 5, count: 100, minLen: 3, minWords: 4, maxWords: 6 },
  { letters: 6, count: 100, minLen: 3, minWords: 5, maxWords: 7 },
  { letters: 7, count: 50,  minLen: 3, minWords: 6, maxWords: 8 }
];
const POOL_SIZE = 7000; // نختار الكلمات المطلوبة من أشهر 7000 كلمة فقط

const rows = fs.readFileSync(path.join(__dirname, "../dict/ar-common.tsv"), "utf8").trim().split("\n")
  .map(l => l.split("\t")).map(([w, f]) => [normalize(w), +f]).filter(([w]) => w && !BLOCK.has(w));
const pool = rows.slice(0, POOL_SIZE);
const rank = new Map(pool.map(([w], i) => [w, i]));

// كلمات المستويات اليدوية حتى لا نكرر نفس الحروف
const HAND = require("../levels.js");
const usedKeys = new Set(HAND.map(l => l.letters.map(normalize).sort().join("")));

const out = [];
for (const stage of PLAN) {
  const seeds = pool.filter(([w]) => w.length === stage.letters);
  const cands = [];
  for (const [seed] of seeds) {
    const letters = [...seed];
    const key = [...letters].sort().join("");
    if (usedKeys.has(key)) continue;
    const words = pool.map(([w]) => w)
      .filter(w => w.length >= stage.minLen && canBuild(w, letters))
      .slice(0, stage.maxWords + 3); // نأخذ بعض الاحتياط لما لا يدخل الشبكة
    if (!words.includes(seed)) words.unshift(seed);
    if (words.length < stage.minWords) continue;
    const layout = buildCrossword(words);
    let placed = layout.words.map(p => p.word);
    if (placed.length > stage.maxWords) {
      placed = placed.sort((a, b) => (a === seed ? -1 : b === seed ? 1 : rank.get(a) - rank.get(b))).slice(0, stage.maxWords);
      const re = buildCrossword(placed); placed = re.words.map(p => p.word);
    }
    if (placed.length < stage.minWords || !placed.includes(seed)) continue;
    // الصعوبة: متوسط ندرة الكلمات (رتبة أعلى = أندر)
    const rarity = placed.reduce((s, w) => s + rank.get(w), 0) / placed.length;
    cands.push({ key, letters, words: placed, rarity });
    usedKeys.add(key);
  }
  cands.sort((a, b) => a.rarity - b.rarity);
  const picked = cands.slice(0, stage.count).sort((a, b) => a.rarity - b.rarity || a.words.length - b.words.length);
  console.log(`${stage.letters} حروف: ${cands.length} مرشّح، أُخذ ${picked.length}`);
  for (const c of picked) out.push({ l: c.letters.join(""), w: c.words });
}

const header = `/* ملف مولَّد تلقائيًا بواسطة tools/gen_levels.js — لا تعدّله يدويًا.
   الكلمات من معجم Arramooz (GPL-3.0). */\n`;
const body = "(function(root){const G=" + JSON.stringify(out) +
  ";if(typeof module!=='undefined'&&module.exports)module.exports=G;else root.LEVELS_GEN=G;})(typeof self!=='undefined'?self:this);\n";
fs.writeFileSync(path.join(__dirname, "../levels-gen.js"), header + body);
console.log(`المجموع: ${out.length} مستوى مولّد`);
