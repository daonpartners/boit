#!/usr/bin/env python3
"""보잇 비서 약관 자동 수집 (2026-11-27)

GitHub Actions에서 실행한다 (.github/workflows/terms-collect.yml).
- list : 삼성화재·KB손보 공시실의 판매중·판매중지 상품 목록(상품명·판매기간·약관 PDF 주소)을 boit_terms_doc 에 저장
- body : 판매중 상품 중 실손·운전자·건강(암뇌심)·간병치매 약관 본문을 조항 단위로 boit_terms_chunk 에 저장
         + 보잇 비서가 '필요할 때 읽기'로 요청한 옛날 약관(body_status='queued')도 읽음

수집 원칙
- robots.txt 가 수집을 막은 보험사(DB손보 등)는 수집하지 않는다
- 요청 사이 간격을 두고 천천히 받는다 (REQ_GAP 초)
- 약관 본문은 판매중 4종 + 요청된 옛날 약관만. 나머지 판매중지 약관은 목록(주소)만 둔다

필요한 비밀값 (GitHub 저장소 Secrets): SUPABASE_SERVICE_ROLE_KEY
"""
import io, json, os, re, sys, time
from datetime import datetime, timezone

import requests
from pypdf import PdfReader

SB_URL = os.environ.get("SUPABASE_URL", "https://lobdowpxujgiadrtxklb.supabase.co")
SB_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
REQ_GAP = float(os.environ.get("REQ_GAP", "1.0"))
BODY_LIMIT = int(os.environ.get("BODY_LIMIT", "40"))        # 한 번 실행에 읽을 약관 수
MAX_TOTAL_MB = float(os.environ.get("MAX_TOTAL_MB", "350"))  # DB가 이 크기를 넘으면 본문 저장 중단 (무료 500MB)
# 새 형식 비밀키(sb_secret_…)는 apikey 머리글만, 예전 service_role(JWT)는 Authorization 도 함께
AUTH = {"apikey": SB_KEY} if SB_KEY.startswith("sb_") else {"apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY}
UA = {"User-Agent": "Mozilla/5.0 (compatible; BOIT-terms/1.0; +https://boit.ai.kr)"}

KIND_RULES = [
    ("실손", re.compile(r"실손")),
    ("운전자", re.compile(r"운전자")),
    ("간병치매", re.compile(r"간병|치매|요양")),
    ("건강", re.compile(r"건강|암|뇌|심장|3대|질병|종합|통합|어린이|자녀|유병|간편")),
]
BODY_KINDS = {"실손", "운전자", "간병치매", "건강"}


def kind_of(name, line):
    if line and not re.search(r"장기|통합|운전자|상해|질병|제휴|방카", line) and not re.search(r"실손", name):
        return "기타"
    for k, rx in KIND_RULES:
        if rx.search(name):
            return k
    return "기타"


def ymd(s):
    s = re.sub(r"\D", "", str(s or ""))
    if len(s) != 8 or s.startswith("0000") or s == "99991231":
        return None
    y, m, d = int(s[:4]), int(s[4:6]), int(s[6:])
    if not (1950 <= y <= 2100 and 1 <= m <= 12 and 1 <= d <= 31):
        return None
    import calendar
    d = min(d, calendar.monthrange(y, m)[1])  # 공시 자료의 '6월 31일' 같은 날짜는 그 달 말일로
    return f"{y:04d}-{m:02d}-{d:02d}"


def sb(method, path, **kw):
    h = {**AUTH, "Content-Type": "application/json"}
    h.update(kw.pop("headers", {}))
    r = requests.request(method, f"{SB_URL}/rest/v1/{path}", headers=h, timeout=60, **kw)
    if r.status_code >= 300:
        raise RuntimeError(f"supabase {method} {path} {r.status_code} {r.text[:300]}")
    return r.json() if r.text else None


def upsert_docs(rows):
    rows = list({(r["insurer"], r["prd_code"], r["ver"]): r for r in rows}.values())  # 같은 상품·차수 중복 제거
    for i in range(0, len(rows), 500):
        sb("POST", "boit_terms_doc?on_conflict=insurer,prd_code,ver",
           headers={"Prefer": "resolution=merge-duplicates,return=minimal"}, data=json.dumps(rows[i:i + 500]))


# ---------- 삼성화재: 보험상품공시 (robots.txt: Allow /) ----------
def list_samsung():
    r = requests.post("https://www.samsungfire.com/vh/data/VH.HDIF0103.do", data="{}", timeout=120,
                      headers={**UA, "Content-Type": "application/json"})
    r.raise_for_status()
    lst = r.json()["responseMessage"]["body"]["data"]["list"]
    rows = []
    for x in lst:
        if not x.get("prdfilename1"):
            continue
        code, jong, st = x.get("prdCode", ""), str(x.get("jongGb", "")), str(x.get("saleStDt", ""))
        end = str(x.get("saleEnDt", ""))
        name, line = (x.get("prdName") or "").strip(), x.get("prdGun") or ""
        rows.append({
            "insurer": "삼성화재", "prd_code": code, "ver": f"{jong}_{st}", "name": name, "line": line,
            "kind": kind_of(name, line), "sale_start": ymd(st), "sale_end": ymd(end), "on_sale": end == "99991231",
            "pdf_url": f"https://www.samsungfire.com/publication/pdf/{code}_{jong}_{st}_file1.pdf",
        })
    upsert_docs(rows)
    print(f"삼성화재 목록 {len(rows)}건 (판매중 {sum(r['on_sale'] for r in rows)})")


# ---------- KB손보: 상품목록(약관) (robots.txt: 금지 조항 없음) ----------
KB = "https://www.kbinsure.co.kr"


def kb_post(path, data):
    time.sleep(REQ_GAP)
    r = requests.post(KB + path, data=data, headers=UA, timeout=60)
    r.raise_for_status()
    if not r.encoding or r.encoding.lower() in ("iso-8859-1",):
        r.encoding = "euc-kr"
    return r.text


def strip(h):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", h)).strip()


def list_kb():
    base = {"devonOrderBy": "", "gubun": "", "goodsNm": "", "onsaleYn": "", "bojongNo": "", "bojongSeq": "",
            "search_onsale_yn": "", "search_bojong_no": "", "search_gubun": "", "search_goods_nm": ""}
    prods, row = [], 1
    while True:
        html = kb_post("/CG802030001.ec", {**base, "devonTargetRow": str(row)})
        found = 0
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S):
            m = re.search(r"detail\('([^']*)','([^']*)','([^']*)'\)", tr)
            if not m:
                continue
            tds = [strip(t) for t in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
            if len(tds) < 4:
                continue
            prods.append({"code": m.group(1), "gubun": m.group(2), "seq": m.group(3),
                          "onsale": tds[0].startswith("판매중") and "중지" not in tds[0], "line": tds[1], "name": tds[3]})
            found += 1
        if not found:
            break
        row += 10
        if row > 20000:
            break
    print(f"KB손보 상품 {len(prods)}개 — 판매기간별 약관 주소 확인 중")
    rows = []
    for p in prods:
        html = kb_post("/CG802030002.ec", {**base, "devonTargetRow": "1", "gubun": p["gubun"],
                                           "bojongNo": p["code"], "bojongSeq": p["seq"]})
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S):
            f = re.search(r"fileNm=([\w]+)_(\d+)_1\.pdf", tr)
            if not f:
                continue
            d = re.findall(r"(?:19|20)\d{6}", strip(tr))
            st, en = (d + [None, None])[:2]
            rows.append({
                "insurer": "KB손해보험", "prd_code": p["code"], "ver": f.group(2), "name": p["name"], "line": p["line"],
                "kind": kind_of(p["name"], p["line"]), "sale_start": ymd(st), "sale_end": ymd(en),
                "on_sale": p["onsale"] and not ymd(en),
                "pdf_url": f"{KB}/CG802030003.ec?fileNm={f.group(1)}_{f.group(2)}_1.pdf",
            })
        if len(rows) >= 500:
            upsert_docs(rows)
            rows = []
    upsert_docs(rows)
    print("KB손보 목록 저장 완료")


# ---------- 약관 본문 ----------
ART = re.compile(r"(?m)^\s*(제\s*\d+\s*조(?:의\s*\d+)?\s*[\(（][^)）\n]{1,40}[\)）])")


def chunks_of(pages):
    out, cur_t, cur, cur_p = [], "", [], 1
    for pno, text in enumerate(pages, 1):
        for part in re.split(r"(?=^\s*제\s*\d+\s*조(?:의\s*\d+)?\s*[\(（])", text, flags=re.M):
            m = ART.match(part)
            if m and cur:
                out.append((cur_p, cur_t, "\n".join(cur).strip()))
                cur, cur_t, cur_p = [], m.group(1).strip(), pno
            elif m:
                cur_t, cur_p = m.group(1).strip(), pno
            cur.append(part)
            if sum(len(c) for c in cur) > 3000:  # 너무 긴 조항은 나눔
                out.append((cur_p, cur_t, "\n".join(cur).strip()))
                cur, cur_p = [], pno
    if cur:
        out.append((cur_p, cur_t, "\n".join(cur).strip()))
    return [c for c in out if len(c[2]) > 40]


def db_mb():
    r = requests.post(f"{SB_URL}/rest/v1/rpc/boit_db_mb", headers={**AUTH, "Content-Type": "application/json"}, data="{}", timeout=30)
    return float(r.json()) if r.ok else 0.0


def read_body(doc):
    time.sleep(REQ_GAP)
    r = requests.get(doc["pdf_url"], headers=UA, timeout=180)
    r.raise_for_status()
    if not r.content.startswith(b"%PDF"):
        raise RuntimeError("PDF 아님")
    pdf = PdfReader(io.BytesIO(r.content))
    pages = [(p.extract_text() or "") for p in pdf.pages]
    chunks = chunks_of(pages)
    if not chunks:
        raise RuntimeError("글자 없음(스캔본)")
    sb("DELETE", f"boit_terms_chunk?doc_id=eq.{doc['id']}")
    rows = [{"doc_id": doc["id"], "seq": i, "page": p, "title": t[:120], "body": b[:6000]} for i, (p, t, b) in enumerate(chunks)]
    for i in range(0, len(rows), 300):
        sb("POST", "boit_terms_chunk", headers={"Prefer": "return=minimal"}, data=json.dumps(rows[i:i + 300]))
    sb("PATCH", f"boit_terms_doc?id=eq.{doc['id']}", headers={"Prefer": "return=minimal"},
       data=json.dumps({"body_status": "done", "pages": len(pages), "chars": sum(len(x) for x in pages),
                        "err": None, "body_at": datetime.now(timezone.utc).isoformat()}))
    return len(pages), len(rows)


def body():
    queued = sb("GET", "boit_terms_doc?select=id,name,pdf_url&body_status=eq.queued&order=id&limit=50") or []
    kinds = ",".join(BODY_KINDS)
    todo = sb("GET", f"boit_terms_doc?select=id,name,pdf_url&on_sale=eq.true&body_status=eq.list"
                     f"&kind=in.({kinds})&order=insurer,id&limit={BODY_LIMIT}") or []
    n = 0
    for doc in queued + todo:
        if db_mb() > MAX_TOTAL_MB:
            print(f"DB 크기 {MAX_TOTAL_MB}MB 넘음 — 본문 저장 중단 (Pro 전환 후 계속)")
            break
        try:
            pg, ch = read_body(doc)
            n += 1
            print(f"  본문 {doc['name']} — {pg}쪽, 조항 {ch}개")
        except Exception as e:
            sb("PATCH", f"boit_terms_doc?id=eq.{doc['id']}", headers={"Prefer": "return=minimal"},
               data=json.dumps({"body_status": "error", "err": str(e)[:300]}))
            print(f"  실패 {doc['name']}: {e}")
    print(f"본문 {n}건 저장 · DB {db_mb():.1f}MB")


if __name__ == "__main__":
    if not SB_KEY:
        print("SUPABASE_SERVICE_ROLE_KEY 비밀값이 없어 건너뜀")
        sys.exit(0)
    mode = (sys.argv[1] if len(sys.argv) > 1 else "all").lower()
    if mode in ("all", "list", "list_samsung"):
        list_samsung()
    if mode in ("all", "list", "list_kb"):
        list_kb()
    if mode in ("all", "body"):
        body()
