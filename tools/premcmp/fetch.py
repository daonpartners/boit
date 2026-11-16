"""n8n 웹훅에서 이달 판매자료 쪽 텍스트를 받아 폴더에 쪽별 txt로 저장
사용: python3 fetch.py <YYYY-MM> <저장폴더>  →  <저장폴더>/guide, <저장폴더>/dx3
"""
import json, os, sys, urllib.parse, urllib.request
URL = "https://daonpartners.app.n8n.cloud/webhook/daon-ai-docs-export"
month, out = sys.argv[1], sys.argv[2]
for sub, src in (("guide", "손해보험 비교가이드북"), ("dx3", "3대질병 진단비 보험료 비교")):
    q = urllib.parse.urlencode({"month": month, "src": src})
    with urllib.request.urlopen(f"{URL}?{q}", timeout=120) as r:
        d = json.load(r)
    pages = d.get("pages") or []
    os.makedirs(os.path.join(out, sub), exist_ok=True)
    for p in pages:
        open(os.path.join(out, sub, f"{int(p['page'])}.txt"), "w", encoding="utf-8").write(p.get("text") or "")
    print(sub, src, len(pages), "쪽", sorted({p["src"] for p in pages}))
