#!/bin/bash
# 첫 배포(메인 세션 실행용) — 테스트 → UI 물리 검증 → GitHub 공개 레포 → Vercel → Actions 시크릿.
# 공개 게시·계정 행위가 들어 있어 서브에이전트는 실행하지 않았다.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/node/bin:$PATH"
npm test
node src/infrastructure/buildPublic.js
node tools/dev-server.js 4174 90 &   # 90초 뒤 스스로 종료
sleep 1
python3 tools/verify_ui.py http://127.0.0.1:4174 tmp | tail -1
# 1) 커밋 — Vercel은 커밋 author가 팀 검증 이메일이어야 배포한다(playbook-vercel-cli 9/19 함정)
git add -A
git -c user.name=Ryugi62 -c user.email=66805752+Ryugi62@users.noreply.github.com commit -m "feat: 한적한 날 v1 — 데이터랩 30일 지역 집중률 혼잡 회피 서비스

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01DVYQqJnmspk1rzi7RaC9Mi"
git branch -M main
# 2) 공개 레포 + 푸시
gh repo create Ryugi62/hanjeok --public --source . --push --description "한적한 날 — 한국관광 데이터랩 향후 30일 지역 집중률로 덜 붐비는 날·곳 안내"
# 3) Actions 시크릿(기상청 키 — 값은 출력하지 않는다)
KEY=$(grep '^KMA_SERVICE_KEY=' "$HOME/.config/jarvis/env/datagokr.env" | cut -d= -f2-); printf '%s' "$KEY" | gh secret set KMA_SERVICE_KEY -R Ryugi62/hanjeok; unset KEY
# 4) Vercel 연결·배포(깃 연동 → 매일 데이터 커밋마다 자동 재배포)
vercel link --yes --project hanjeok
vercel deploy --prod --yes | tee tmp/deploy.txt
# 5) 라이브 물리 검증
URL=$(grep -Eo 'https://[a-z0-9.-]+\.vercel\.app' tmp/deploy.txt | tail -1)
curl -s -o /dev/null -w "live %{http_code}\n" "$URL/r/48220"
python3 tools/verify_ui.py "$URL" tmp | tail -1
echo "배포 URL: $URL — handoff/drop/tourism-datalab/ops.json의 url·launch·repo에 기록"
# 남은 브라우저 몫: Vercel 대시보드 → hanjeok → Analytics → Enable(Web Analytics, 쿠키 없음)
