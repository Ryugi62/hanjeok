# SPEC — 성장 바닥공사: 색인 가능한 지역 페이지 · sitemap · robots (2026-10-02)

## 목적
`/r/<시군구코드>` 지역 페이지는 CSR 셸(본문 0)이라 검색엔진엔 빈 페이지다. 빌드 때 지역별 정적 HTML을 미리 만들어(pre-render) 크롤러가 실제 숫자·날짜를 읽게 하고, sitemap·robots로 목록을 넘긴다. 측정은 기존 Vercel Web Analytics(`/_vercel/insights/script.js`, 9/24 활성) 유지.

## 성공 조건 (숫자)
- 데이터 있음: 집중률이 있는 지역 N곳 → `public/r/<코드>/index.html` **N개**, sitemap URL **N+1개**(홈 포함). 각 페이지 canonical 1개(절대 URL)·고유 title·description·본문에 30일 중 가장 한적한 날·가장 붐비는 날·일별 집중률 목록.
- 데이터 준비 중(2026-09-29~ 현재, 지역 0): 지역 페이지 **0개**(빈 껍데기 페이지를 만들지 않는다) · sitemap URL **1개**(홈).
- 라이브 `/robots.txt` 200(`Sitemap:` 절대 URL) · `/sitemap.xml` 200 · 홈 canonical·og:url·`lang="ko"` · `/_vercel/insights/script.js` 200.
- JS가 돌면 정적 요약(`#prerender`)은 지우고 기존 화면이 그린다(중복 표시 0).

## Given / When / Then
- AC-1: Given 준비 중 스냅샷, When `staticPages`, Then [] · `sitemapXml(['/'])` loc 1개.
- AC-2: Given 지역 2곳(값 있음 1·빈 값 1) 스냅샷, When `staticPages`, Then 1페이지 · path `/r/<코드>` · 제목에 시도·지역명 · 본문에 한적한 날(`formatKo`)·집중률·미래 일수만큼의 일별 행.
- AC-3: When `renderRegionHtml(template, page)`, Then title·description 교체 · canonical/og:url 절대 URL 1개씩 · `#prerender` 삽입 · 지역명 HTML 이스케이프.
- AC-4: `robotsTxt` = 전체 허용 + `Sitemap: <SITE_URL>/sitemap.xml`.
- AC-5: 배포본 `public/sitemap.xml`·`public/robots.txt`는 현재 스냅샷(준비 중)과 일치(loc 1개) · `index.html` canonical·og:url · `app.js`가 insights 스크립트를 싣고 `#prerender`를 지운다.

## 비목표
데이터 재적재(공식 다운로드 파일을 사람이 직접 받는 일 — 이 레포 밖) · 커스텀 도메인 · 서치콘솔 등록 · `/d/` 날짜 보기 사전 렌더.

## 추가 · 검색엔진 소유확인 (2026-10-02 18:xx)
- 목적: 구글 서치 콘솔·네이버 서치어드바이저 URL 접두어 속성 등록 + sitemap 제출.
- AC-6: Given `public/index.html`, Then `<head>` 안에 `<meta name="google-site-verification">`(구글 HTML 태그 토큰)·`<meta name="naver-site-verification">`(네이버 토큰)이 각 1개.
- 성공 조건: 라이브 홈 HTML에 두 메타 1개씩 · 서치 콘솔 「확인」 성공 · 네이버 「소유확인」 성공.
