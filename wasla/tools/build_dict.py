#!/usr/bin/env python3
"""
بناء معجم «وَصلة» من قاعدة Arramooz (رخصة GPL-3.0، المؤلف: Taha Zerrouki)
https://github.com/linuxscout/arramooz

التشغيل:
    pip install arramooz-pysqlite
    python3 build_dict.py

المخرجات (في wasla/dict/):
    ar-words.txt   كل الكلمات الصحيحة (للتحقق وكلمات المكافأة)
    ar-common.tsv  الكلمات الشائعة مع تكرارها (لتوليد المستويات)
"""
import os, re, sqlite3, sys

try:
    import arramooz
    DATA = os.path.join(os.path.dirname(arramooz.__file__), "data")
except ImportError:
    DATA = sys.argv[1] if len(sys.argv) > 1 else sys.exit("ثبّت arramooz-pysqlite أو مرّر مسار مجلد data")

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dict")
HERE = os.path.dirname(os.path.abspath(__file__))

DIAC = re.compile("[ً-ْٰـ]")
ARABIC_ONLY = re.compile("^[ء-غف-ي]+$")

def normalize(w):
    w = DIAC.sub("", w or "").strip()
    return re.sub("[أإآٱ]", "ا", w)

def ok(w):
    return 2 <= len(w) <= 7 and ARABIC_ONLY.match(w) and not w.startswith("ال")

def load_list(name):
    path = os.path.join(HERE, name)
    if not os.path.exists(path):
        return set()
    with open(path, encoding="utf-8") as f:
        return {normalize(l.split("#")[0]) for l in f if l.split("#")[0].strip()}

BLOCK = load_list("blocklist.txt")      # كلمات نستبعدها تمامًا
EXTRA = load_list("extra-words.txt")    # كلمات صحيحة نضيفها يدويًا

# أنواع الكلمات المسموح بها هدفًا في المستويات (بدون أسماء أعلام واختصارات)
TARGET_TYPES = {"noun", "adj", "verb", "adj_comp", "noun_quant", "adv"}
SKIP_TYPES = {"noun_prop", "abbrev"}

words, common = set(), {}

wf = sqlite3.connect(os.path.join(DATA, "wordfreq.sqlite"))
for unv, wtype, freq in wf.execute("select unvocalized, word_type, freq from wordfreq"):
    w = normalize(unv)
    if not ok(w) or wtype in SKIP_TYPES or w in BLOCK:
        continue
    words.add(w)
    if wtype in TARGET_TYPES and len(w) >= 2:
        common[w] = max(common.get(w, 0), int(freq or 0))

dic = sqlite3.connect(os.path.join(DATA, "arabicdictionary.sqlite"))
for (unv,) in dic.execute("select unvocalized from nouns"):
    w = normalize(unv)
    if ok(w) and w not in BLOCK:
        words.add(w)
for (unv,) in dic.execute("select unvocalized from verbs"):
    w = normalize(unv)
    if ok(w) and w not in BLOCK:
        words.add(w)

words |= {w for w in EXTRA if ok(w)}

os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, "ar-words.txt"), "w", encoding="utf-8") as f:
    f.write("\n".join(sorted(words)) + "\n")
with open(os.path.join(OUT, "ar-common.tsv"), "w", encoding="utf-8") as f:
    for w, fr in sorted(common.items(), key=lambda x: -x[1]):
        f.write(f"{w}\t{fr}\n")

print(f"ar-words.txt: {len(words)} كلمة | ar-common.tsv: {len(common)} كلمة شائعة")
