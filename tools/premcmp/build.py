"""보잇 보험료 비교 자료 만들기 (매월)
사용: python3 build.py <월 YYYY-MM> <기준일 YYYY.MM.DD> <가이드북 쪽 폴더> <3대질병 쪽 폴더> <boit 폴더>
 - 쪽 폴더: 1.txt, 2.txt ... (쪽 번호.txt, PDF 글자층 또는 ai_docs 표 text 그대로)
 - 가이드북: '생명·손해보험 비교가이드북', 3대질병: '3대질병 진단비 보험료 비교'
 - 결과: premcov.json (담보 골라 비교), premcmp.json 안의 dx3_* 주제(3대질병 표)
 - 원칙: 칸 수가 회사 수와 다르면 버림, 3대질병은 '합계 = 담보 합(±30원)'이 아니면 버림. 두 자료가 겹치면 3대질병 자료 우선.
"""
import re, json, os, sys, glob

MONTH, BASE, GDIR, DDIR, BOIT = sys.argv[1:6]
LOG = []

def pages(d):
    out = {}
    for f in glob.glob(os.path.join(d, "*.txt")):
        try: out[int(os.path.basename(f)[:-4])] = open(f, encoding="utf-8").read()
        except ValueError: pass
    return out

def first(t):
    for l in t.split("\n"):
        if l.strip(): return re.sub(r"\s+", " ", l).strip()
    return ""

# ---------- 3대질병 ----------
NUM = re.compile(r"^(\d{1,3}(?:,\d{3})+|\d+|-)$")
def parse_dx3(P):
    res = {}
    for p, txt in sorted(P.items()):
        L = [re.sub(r"\s+", " ", l).strip() for l in txt.split("\n")]
        head = " ".join(L[:4])
        m = re.search(r"\((일반심사|건강고지|유병자)\)", head)
        if "3대질병" not in head or not m: continue
        kind = "손보" if "손해보험" in head else "생보"; typ = m.group(1)
        if typ == "일반심사": st = "일반심사"
        elif typ == "건강고지": st = "건강고지(10년)"
        else:
            m3 = re.search(r"(3\d5)", head); st = "간편 " + m3.group(1) if m3 else ("초경증 간편" if "초경증" in head else None)
        if not st: LOG.append(f"3대질병 p.{p}: 심사유형을 못 읽음"); continue
        labels, rows = [], []
        for l in L:
            mm = re.match(r"^(\d{1,2})세(?:\s+(.*))?$", l)
            if mm:
                labels.append(int(mm.group(1)))
                if not mm.group(2): continue
                l = mm.group(2)
            t = l.split(" ")
            if len(t) < 12: continue
            tail = t[-10:]
            if not all(NUM.match(x) for x in tail): continue
            rows.append((t[0], " ".join(t[1:-10]), [None if x == "-" else int(x.replace(",", "")) for x in tail]))
        blocks, cur = [], []
        for r in rows:
            if any(r[0] == x[0] for x in cur): blocks.append(cur); cur = []
            cur.append(r)
        if cur: blocks.append(cur)
        if len(blocks) != len(labels):
            LOG.append(f"3대질병 p.{p}: 나이 {labels} / 묶음 {len(blocks)}개 불일치 → 이 쪽 버림"); continue
        foot = [re.sub(r"\s+", " ", l).strip() for l in txt.split("\n") if l.strip().startswith("※") and "사내교육" not in l]
        for age, blk in zip(labels, blocks):
            for sex, off in (("M", 0), ("F", 5)):
                for co, prod, v in blk:
                    vv = v[off:off + 5]
                    if vv[0] is None or abs(vv[0] - sum(x for x in vv[1:] if x is not None)) > 30:
                        LOG.append(f"3대질병 p.{p} {kind} {st} {age}세 {'남' if sex=='M' else '여'} {co}: 합계≠담보합 또는 빈칸 → 제외 {vv}"); continue
                    res.setdefault((kind, st), []).append(dict(age=age, sex=sex, co=co, prod=prod, v=vv, pg=p))
        for kst in [(kind, st)]:
            res.setdefault(("_foot",) + kst, [])
            for f in foot:
                if f not in res[("_foot",) + kst]: res[("_foot",) + kst].append(f)
    return res

# ---------- 가이드북 ----------
CELL_NUM = re.compile(r"^([\d,]+)(\(.*\))?\*?$")
def cell(t):
    if t in ("-", ""): return None, None
    m = CELL_NUM.match(t)
    if m and re.match(r"^\d{1,3}(,\d{3})*$|^\d+$", m.group(1)):
        return int(m.group(1).replace(",", "")), (t if m.group(2) or t.endswith("*") else None)
    return None, t
LEAD = {"암", "진", "단", "2", "대", "수", "술", "비", "기", "타", "N대", "간병인", "주", "치", "3"}
def header(L):
    for l in L:
        t = re.sub(r"\s+", " ", l).strip().split(" ")
        if t and t[0] == "보험사": return t[1:]
        if len(t) >= 8 and t[0] in ("삼성화재", "삼성생명"): return t
    return None
STD = [("ctxname", r"^담보명( -)?$#1"), ("c2name", r"^담보명( -)?$#2"), ("cancer", r"^((암 )?진단비|일반암) 1천$"), ("sim", r"^(유사암 진단비|유사암) 2백$"),
       ("ctx", r"^일반 1천$#1"), ("ctxh", r"^상급 일반 1천$"), ("brain", r"^뇌혈관(질환)? 1천$#1"), ("heart", r"^허혈성(심장)? 1천$#1"),
       ("c2", r"^일반 1천$#2"), ("c2h", r"^상급 1천$"), ("dsurg", r"^질병 20$"), ("isurg", r"^상해 1백$"),
       ("s5d", r"^질병 보험료 -$"), ("s5i", r"^상해 보험료 -$"), ("csurg", r"^1회한 1백$"),
       ("bsurg", r"^뇌혈관(질환)? 1천$#2"), ("hsurg", r"^허혈성(심장)? 1천$#2"), ("nsurg", r"^보험료 -$#1"),
       ("s5dlim", r"^5종 한도 -$#1"), ("s5ilim", r"^5종 한도 -$#2"), ("carelim", r"^한도 -$"),
       ("cared", r"^간병인 질병 -$|^질병 -$"), ("carei", r"^상해 -$"), ("chosp", r"^(암 )?일반 5$"), ("cout", r"^암통원\(상급\) 10$"), ("ddis", r"^질병장해\(80세\) 1천$")]
LIFE_OK = {"ctxname", "c2name", "cancer", "sim", "ctx", "ctxh", "brain", "heart", "c2", "c2h", "dsurg"}
RX2 = [("ctxname", r"^(암 )?담보명$"), ("c2name", r"^2대 담보명$"), ("cancer", r"^일반암 1천$"), ("sim", r"^유사암 2백$"), ("ctx", r"^일반$"), ("ctxh", r"^상급$"),
       ("brain", r"^뇌혈관 1천$#1"), ("heart", r"^허혈성 1천$#1"), ("c2pair", r"^(2대 담보명 )?(주치 )?일반/상급$"), ("dsurg", r"^질병 20$"), ("isurg", r"^상해 1백$"),
       ("bsurg", r"^뇌혈관 1천$#2"), ("hsurg", r"^허혈성 1천$#2"), ("cout", r"^암통원\(상급\) 10$")]
def guide_kind(title):
    """쪽 제목 → (kind, set, age, sex) 또는 나이별 쪽이면 (kind,set,age,None)"""
    t = title
    m = re.search(r"장기종합보험 무해약형보험료\((남자|여자)\)", t)
    if m: return ("손보", "일반심사", 40, "M" if m.group(1) == "남자" else "F", "std")
    m = re.search(r"장기종합보험 건강고지10년\((남자|여자)\)", t)
    if m: return ("손보", "건강고지(10년)", 40, "M" if m.group(1) == "남자" else "F", "std")
    m = re.search(r"장기종합보험 무해약형보험료\((\d+)세\)", t)
    if m: return ("손보", "일반심사", int(m.group(1)), None, "age")
    m = re.search(r"어린이보험료\((\d+)세(남|여)\)", t)
    if m: return ("손보", "어린이", int(m.group(1)), "M" if m.group(2) == "남" else "F", "std")
    m = re.search(r"건강보험 생명보험 보험료\((\d+)세(남|여)\)", t)
    if m: return ("생보", "일반심사", int(m.group(1)), "M" if m.group(2) == "남" else "F", "std")
    m = re.search(r"생명보험 355 간편보험-(남|여)", t)
    if m: return ("생보", "간편 355", 40, "M" if m.group(1) == "남" else "F", "std")
    m = re.search(r"생명보험 3\.10\.5 간편보험\((남|여)\)", t)
    if m: return ("생보", "초경증 간편", 40, "M" if m.group(1) == "남" else "F", "std")
    m = re.search(r"\(초경증간편보험료(\d+)세(남|여)\)", t)
    if m: return ("손보", "초경증 간편", int(m.group(1)), "M" if m.group(2) == "남" else "F", "std")
    m = re.search(r"\(355간편보험료(\d+)세(남|여)\)", t)
    if m: return ("손보", "간편 355", int(m.group(1)), "M" if m.group(2) == "남" else "F", "std")
    return None
def occ_parse(lines, rules, N, emit):
    seen = {}
    for t in lines:
        if len(t) < N + 1: continue
        cells, lab = t[-N:], " ".join(t[:-N]); c = None
        for key, rx in rules:
            r, _, occ = rx.partition("#")
            if re.match(r, lab):
                if c is None: c = seen.get(r, 0) + 1; seen[r] = c
                if occ and int(occ) != c: continue
                emit(key, cells); break
def parse_guide(P):
    recs = []
    for p, txt in sorted(P.items()):
        info = guide_kind(first(txt))
        if not info: continue
        kind, st, age, sex, mode = info
        L = txt.split("\n"); cos = header(L)
        if not cos: LOG.append(f"가이드북 p.{p}: 보험사 줄을 못 찾음"); continue
        N = len(cos)
        if mode == "std":
            got = set()
            def emit(key, cells):
                if key in got or (kind == "생보" and key not in LIFE_OK): return
                got.add(key)
                for co, tk in zip(cos, cells):
                    v, raw = cell(tk); recs.append(dict(k=key, kind=kind, set=st, age=age, sex=sex, co=co, v=v, raw=raw, pg=p))
            lines = []
            for l in L:
                t = re.sub(r"\s+", " ", l).strip().split(" ")
                while t and t[0] in LEAD and len(t) > 3: t = t[1:]
                lines.append(t)
            occ_parse(lines, STD, N, emit)
        else:
            parts = {"M": [], "F": []}; sx = "M"
            for l in L:
                s = re.sub(r"\s+", " ", l).strip()
                if s.startswith("여자 "): sx = "F"; continue
                t = s.split(" ")
                while t and t[0] in LEAD and len(t) > N + 1: t = t[1:]
                parts[sx].append(t)
            def nn(x):
                x = re.sub(r"\(.*\)", "", x)
                return int(x.replace(",", "")) if re.match(r"^\d{1,3}(,\d{3})*$", x) else None
            for sx, lines in parts.items():
                def emit(key, cells, sx=sx):
                    for co, tk in zip(cos, cells):
                        if key in ("ctx", "ctxh"): recs.append(dict(k=key, kind=kind, set=st, age=age, sex=sx, co=co, v=nn(tk.split("/")[0]), raw=None, pg=p))
                        elif key == "c2pair":
                            pr = tk.split("/")
                            recs.append(dict(k="c2", kind=kind, set=st, age=age, sex=sx, co=co, v=nn(pr[0]), raw=None, pg=p))
                            recs.append(dict(k="c2h", kind=kind, set=st, age=age, sex=sx, co=co, v=nn(pr[1]) if len(pr) > 1 else None, raw=None, pg=p))
                        else:
                            v, raw = cell(tk); recs.append(dict(k=key, kind=kind, set=st, age=age, sex=sx, co=co, v=v, raw=raw, pg=p))
                occ_parse(lines, RX2, N, emit)
    return recs

GP, DP = pages(GDIR), pages(DDIR)
DX = parse_dx3(DP); GR = parse_guide(GP)
if not DX and not GR: print("자료 없음"); sys.exit(2)

# ---------- premcmp.json 의 3대질병 주제 ----------
pm_path = os.path.join(BOIT, "premcmp.json"); PM = json.load(open(pm_path, encoding="utf-8"))
PM = [t for t in PM if not t["id"].startswith("dx3_")]
topics = []
for kind, kid in (("손보", "dx3_nl"), ("생보", "dx3_lf")):
    keys = [k for k in DX if k[0] == kind and len(k) == 2]
    if not keys: continue
    T = {"id": kid, "g": "3대질병", "t": f"3대질병 진단비 ({'손해보험' if kind=='손보' else '생명보험'})", "src": f"{MONTH} 3대질병 진단비 보험료 비교",
         "cond": "20년납 100세만기 · 납입면제형 · 암·뇌혈관·허혈성 각 1천만원, " + ("유사암" if kind == "손보" else "소액암") + " 2백만원",
         "base": BASE, "parts": ["합계", "암", "유사암" if kind == "손보" else "소액암", "뇌혈관", "허혈성"], "cos": [], "rows": [], "notes": {}, "p": None}
    for (_, st) in keys:
        T["notes"][st] = DX.get(("_foot", kind, st), [])
        grp = {}
        for r in DX[(kind, st)]:
            if r["co"] not in T["cos"]: T["cos"].append(r["co"])
            g = grp.setdefault((r["age"], r["sex"]), {"set": st, "age": r["age"], "sex": r["sex"], "v": {}, "p": {}, "pg": r["pg"]})
            g["v"][r["co"]] = r["v"]; g["p"][r["co"]] = r["prod"]
            T["p"] = r["pg"] if T["p"] is None else min(T["p"], r["pg"])
        T["rows"] += list(grp.values())
    for r in T["rows"]:
        r["v"] = [r["v"].get(c) for c in T["cos"]]; r["p"] = [r["p"].get(c, "") for c in T["cos"]]
    topics.append(T)
json.dump(topics + PM, open(pm_path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

# ---------- premcov.json ----------
alias = {"메리츠": "메리츠화재", "NH농협손보": "농협손보", "미래에셋생명": "미래에셋"}
G = {}
def grp(kind, st, age, sex): return G.setdefault((kind, st, age, sex), {"kind": kind, "set": st, "age": age, "sex": sex, "cos": {}, "src": set()})
for key, rows in DX.items():
    if key[0] == "_foot": continue
    kind, st = key
    for r in rows:
        g = grp(kind, st, r["age"], r["sex"]); e = g["cos"].setdefault(r["co"], {"p": r["prod"], "v": {}, "x": {}})
        for j, k in enumerate(["cancer", "sim", "brain", "heart"]):
            if r["v"][j + 1] is not None: e["v"][k] = r["v"][j + 1]
        g["src"].add(f"3대질병 p.{r['pg']}")
conf = 0
for x in GR:
    co = alias.get(x["co"], x["co"]); g = grp(x["kind"], x["set"], x["age"], x["sex"])
    e = g["cos"].setdefault(co, {"p": "", "v": {}, "x": {}}); k = x["k"]; g["src"].add(f"비교가이드북 p.{x['pg']}")
    if k in ("ctxname", "c2name", "s5dlim", "s5ilim", "carelim"):
        if x["raw"] or x["v"] is not None: e["x"][k] = x["raw"] if x["raw"] else str(x["v"])
        continue
    if k in e["v"]:
        if x["v"] is not None and e["v"][k] != x["v"]: conf += 1
        continue
    if x["v"] is not None: e["v"][k] = x["v"]
    if x["raw"]: e["x"][k] = x["raw"]
out = []
for key in sorted(G):
    g = G[key]; g["src"] = sorted(g["src"]); out.append(g)
KEYS = [["cancer","암 진단비","1천","진단"],["sim","유사암(소액암) 진단비","2백","진단"],["brain","뇌혈관 진단비","1천","진단"],["heart","허혈성심장 진단비","1천","진단"],
 ["ctx","암 주요치료비","1천","치료비"],["ctxh","상급병원 암주요치료비","1천","치료비"],["c2","뇌·심 주요치료비","1천","치료비"],["c2h","상급병원 뇌·심 주요치료비","1천","치료비"],
 ["dsurg","질병수술비","20만","수술"],["isurg","상해수술비","1백","수술"],["s5d","질병 1~5종 수술비","회사 한도","수술"],["s5i","상해 1~5종 수술비","회사 한도","수술"],
 ["csurg","암수술비(1회)","1백","수술"],["bsurg","뇌혈관 수술비","1천","수술"],["hsurg","허혈성심장 수술비","1천","수술"],["nsurg","N대 수술비","회사 한도","수술"],
 ["cared","간병인 사용일당(질병)","회사 한도","간병·기타"],["carei","간병인 사용일당(상해)","회사 한도","간병·기타"],["chosp","암 입원일당","5만","간병·기타"],["cout","상급병원 암통원","10만","간병·기타"],["ddis","질병후유장해 3%↑","1천","간병·기타"]]
json.dump({"month": MONTH, "base": BASE, "keys": KEYS, "groups": out}, open(os.path.join(BOIT, "premcov.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"3대질병 {sum(len(v) for k,v in DX.items() if k[0]!='_foot')}칸, 가이드북 {len(GR)}칸, 묶음 {len(out)}개, 두 자료 불일치 {conf}건(3대질병 우선)")
print("\n".join(LOG) if LOG else "제외 없음")
