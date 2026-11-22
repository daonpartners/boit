import markdown, re, pathlib
BIZ = {"상호":"다온파트너스","대표":"김화진","사업자등록번호":"기재 예정","통신판매업 신고번호":"신고 진행 중 (2026년 12월 기재)","주소":"기재 예정","고객센터":"기재 예정","이메일":"기재 예정"}
NAV=[("terms.html","이용약관"),("privacy.html","개인정보처리방침"),("refund.html","환불규정")]
CSS="""*{box-sizing:border-box}body{margin:0;font-family:Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1d2522;background:#f5f7f6;line-height:1.75;word-break:keep-all}
header{background:#0f7a5c;color:#fff;padding:14px 20px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}header a{color:#fff;text-decoration:none}header .lg{font-weight:800;font-size:18px;margin-right:auto}
nav a{display:inline-block;padding:6px 12px;border-radius:999px;margin:2px;font-size:14px}nav a[aria-current]{background:#fff;color:#0f7a5c;font-weight:700}
main{max-width:860px;margin:24px auto;background:#fff;border-radius:16px;padding:28px clamp(18px,4vw,44px);box-shadow:0 1px 3px rgba(0,0,0,.06)}
h1{font-size:26px;margin:0 0 4px}h1+p{color:#5b6b66;margin-top:0}h3{font-size:17px;margin:28px 0 6px;color:#0f5c46}
table{border-collapse:collapse;width:100%;font-size:14.5px;margin:8px 0}th,td{border:1px solid #dfe6e3;padding:8px 10px;text-align:left;vertical-align:top}th{background:#eef5f2}
.biz{max-width:860px;margin:0 auto 40px;padding:0 20px;font-size:13px;color:#5b6b66}.notice{background:#fff8e6;border:1px solid #f3d38a;border-radius:10px;padding:10px 14px;font-size:14px}
@media print{header,.biz nav{display:none}main{box-shadow:none}}"""
for src,(href,title) in zip(["terms.md","privacy.md","refund.md"],NAV):
    body=markdown.markdown(pathlib.Path(src).read_text(),extensions=["tables","nl2br"])
    nav="".join(f'<a href="{h}"{" aria-current=\"page\"" if h==href else ""}>{t}</a>' for h,t in NAV)
    biz=" · ".join(f"{k} {v}" for k,v in BIZ.items())
    html=f"""<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} · 보잇 BOIT</title><style>{CSS}</style></head><body>
<header><a class="lg" href="./">보잇 BOIT</a><nav>{nav}</nav></header>
<main><p class="notice">2027년 1월 3일 유료 서비스 시작에 맞춰 미리 알려드립니다. 시행 전 내용이 바뀌면 이 페이지에 다시 게시합니다.</p>{body}</main>
<div class="biz">{biz}</div></body></html>"""
    pathlib.Path("../"+href).write_text(html)
print("built")
