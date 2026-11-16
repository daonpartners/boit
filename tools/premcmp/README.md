# 보험료 비교 월간 갱신
1. `python3 tools/premcmp/fetch.py 2026-12 /tmp/pc12` — GROW ON AI비서 자료(ai_docs)에서 이달 '생명·손해보험 비교가이드북', '3대질병 진단비 보험료 비교' 쪽 텍스트를 받음 (n8n 웹훅 `daon-ai-docs-export`)
2. `python3 tools/premcmp/build.py 2026-12 2026.12.04 /tmp/pc12/guide /tmp/pc12/dx3 .` — `premcov.json`, `premcmp.json`(3대질병 주제) 갱신. 기준일은 자료 각 쪽 아래 'U/W기준일'
3. 출력의 제외 목록 확인 → `index.html`의 `premcmp.js?v=` 올리고 커밋·푸시 → boit.ai.kr에서 확인
