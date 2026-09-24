# 한적한 날 (hanjeok) — SPEC (SDD, v0.1 2026-09-24)

## 0. 한 줄
한국관광 데이터랩의 **「향후 30일간 지역 집중률」**을 전국 시군구 단위로 한 화면에 모아, 여행자가 **출발 전 5초 안에 "언제 가면 덜 붐비나 · 비슷한데 덜 붐비는 곳은 어디인가"**를 고르게 하는 웹서비스.
- 본질: '관광지 추천 사이트'가 아니라 **"방문 전에 혼잡을 피하는 상태"**. 데이터랩 안에서 지역을 하나씩 열어야 보이던 예측값을 **전국 비교·대안 제시·임베드**로 관광객 손까지 옮긴다.
- 사용자·장면: ① 주말·연휴 여행지를 정한 개인 여행자(폰, 5초) ② 지자체·관광지 운영자가 자기 지역 붐비는 날을 미리 보고 누리집에 위젯으로 안내 ③ 심사위원이 서식4의 URL을 연다.

## 1. 성공 조건 (숫자) · 마감 (상수) · 비목표
- 데이터(v1): 데이터랩이 집중률을 제공하는 시군구 **전부**(2026-09-24 실측 225곳 — 지역 목록 287 중 광주·전남 통합지역(2026-07)·인천/화성 신설구 62곳은 데이터랩이 빈 값)의 30일 집중률 적재, 기준일·수집 시각 화면 표기. 빈 값 지역은 `meta.empty`, 실패는 `meta.failures`에 계수하고 화면에서 이유를 말한다. 수집 하한 220(급감 감지).
- 기능(v1): 지역 1곳 선택 → (a) 30일 달력(단계 3색) (b) 이번 주말·다음 주말·30일 중 가장 한적한 날 (c) 같은 날 **유사지역 3곳** 집중률 비교 (d) 인기관광지 상위 5(내비게이션 검색건수) (e) 3일 강수확률(기상청). 날짜 1개 선택 → 시도·전국 한적한 지역 순위.
- 확산(v1): 지역별 임베드 위젯 `/embed.html?sgg=<코드>` — iframe 1줄로 지자체 누리집에 붙는다.
- 품질: `npm test` 전부 통과 · 390px 가로 스크롤 0 · 콘솔 에러 0 · 첫 화면 데이터 1개 파일(스냅샷) ≤ 600KB(원본) · 외부 CDN 0.
- 사용 로그: Vercel Web Analytics(쿠키 없음) 페이지뷰 — 지역 조회는 `/r/<코드>` 경로라 경로별 집계가 곧 지역 조회 수.
- 마감: 경진대회 제출 2026-09-30 14:00(내부 9/29 20:00) · 라이브 배포 목표 9/25 · 일일 갱신 06:30 KST.
- 비목표: 관광지(POI) 단위 집중률(데이터랩 지역 단위만 사용 — 공공데이터포털 「관광지 집중률 방문자 추이 예측」 API는 활용신청 후 v2) · 예측 방문자 수(데이터랩이 계약상 비공개 — **비공개 필드는 수집·표시하지 않는다**) · 로그인 · 개인정보 수집 · 실시간 인원 계수.

## 2. 제약
- 데이터 원천(모두 공개 화면 값):
  - 데이터랩 「지역별 관광 현황 > 지역 집중률 > 향후 30일간 지역 집중률」 — 메타 원문: 「과거 방문자 수를 기반으로 인공지능 기계학습을 활용하여 향후 30일간 해당 지역 방문자수를 예측 … 전년도 전체 지역 평균과 표준편차를 활용한 누적분포확률로 수치를 지수화」(활용데이터 이동통신 ㈜케이티). → **지역 간 같은 잣대로 비교 가능**(전년도 전체 지역 기준 정규화).
  - 데이터랩 「AI 관광 분석 > 유사지역」 — 「내비게이션 데이터를 기반으로 유사도 알고리즘을 활용하여 유사 지역 도출」(티맵모빌리티).
  - 데이터랩 「인기관광지 현황」 — 내비게이션 목적지 검색건수 순위(월).
  - 데이터랩 「중심관광지」 — 지역 대표 관광지 좌표(날씨 격자용 대표점).
  - 기상청 단기예보 조회서비스(공공데이터포털 15084084) — 강수확률(POP)·강수형태(PTY)·하늘상태(SKY). 인증키는 환경변수 `KMA_SERVICE_KEY`(코드·레포 포함 금지).
- 데이터랩 화면에서 숨긴 값(「예측 방문자 수」·「요일별 방문자 집중률 예측」 — 페이지에 `고객요청으로 미표시` 주석)은 쓰지 않는다.
- 수집 예절·약관: 동시 요청 ≤ 3, 요청 간격 ≥ 300ms, 하루 1회 · User-Agent에 서비스명 · robots.txt(9/24 실측) `User-agent: *`는 `/search/`만 금지 — 조회 경로 `/visualize/` 허용 · 이용약관 금지행위 8호 「공사의 동의 없이 영리를 목적으로 서비스를 사용하는 행위」 → 비영리·광고 없음 유지(원문: 볼트 raw/2026-09-24-datalab-집중률-실측).
- 비용 0: Vercel Hobby · GitHub Actions 무료분.
- 출처 표기: 화면 하단 「자료: 한국관광 데이터랩(한국관광공사) · 기상청 단기예보」.

## 3. 유비쿼터스 언어 (DDD 용어집) — 코드 식별자와 1:1
| 용어 | 뜻 | 코드 이름 |
|---|---|---|
| 지역 | 데이터랩 시군구(코드 5자리·이름·시도) | `Region {code, name, sido}` |
| 집중률 | 데이터랩 「향후 30일간 지역 집중률」 일별 지수 0~100 | `DayIndex {date, index}` · `concentration` |
| 혼잡 단계 | 여유(<40) · 보통(40~69.99) · 붐빔(≥70) | `CrowdLevel` · `levelOf(index)` |
| 평소 대비 | 그 지역 30일 중앙값과의 차이(pt) | `vsUsual(days, date)` |
| 한적한 날 | 기간 안에서 집중률이 가장 낮은 날(동률이면 이른 날) | `quietestDay(days, from, to)` |
| 가장 붐비는 날 | 기간 안 최댓값 | `peakDay(days, from, to)` |
| 주말 창 | 오늘 기준 이번 주말·다음 주말(토·일, 오늘이 일요일이면 오늘만) | `weekendWindows(today)` |
| 유사지역 | 데이터랩 유사지역 상위 3(유사도) | `Similar {code, name, similarity}` |
| 대안 | 같은 날 유사지역 중 대상보다 집중률이 낮은 곳(낮은 순) | `alternativesOn(snapshot, code, date)` |
| 이웃 대안 | 같은 날 대표점 30km 안에서 대상보다 낮은 곳(낮은 순, 최대 3) — 9/24 실측: 유사지역은 함께 붐비는 경향(30일 상관 평균 0.80 vs 전체 지역쌍 0.71)이라 대안 제시율이 59%에 그쳐 추가 | `nearbyAlternativesOn(snapshot, code, date, 30)` · `haversineKm` · `pearson` |
| 인기관광지 | 내비게이션 검색건수 순위 | `Attraction {rank, name, category, searchCount}` |
| 강수확률 | 단기예보 POP의 날짜별 최댓값 | `RainDay {date, popMax, rainy}` · `summarizeRain(items)` |
| 격자 | 기상청 LCC 5km 격자 | `toGrid(lat, lon) → {nx, ny}` |
| 스냅샷 | 수집 결과 JSON(기준일·수집시각·지역별 값·실패 목록) | `Snapshot` · `buildSnapshot()` |
| 커버리지 | 집중률이 있는 지역 수 / 지역 목록 수 | `coverage` |
| 기대 감소폭 | 주말 창 가장 붐비는 날 대비 한적한 날의 집중률 차(pt) | `expectedDrop(days, window)` |

## 4. 바운디드 컨텍스트 · 도메인 모델
- 컨텍스트 1개 `crowd-outlook`. 수집(collection)은 application 유스케이스, UI는 어댑터.
- 값 객체: `Region`, `DayIndex`, `Similar`, `Attraction`, `RainDay`. 애그리거트: `Snapshot`.
- 포트: `RegionSource.list()` · `ConcentrationSource.forecast(code)` · `SimilarSource.similar(code)` · `AttractionSource.top(code, ym)` · `AnchorSource.anchor(code)`(대표 좌표) · `WeatherSource.daily(nx, ny)` · `Clock.today()`.

## 5. 유스케이스 (application)
| UC | 입력 | 출력 | 규칙 |
|---|---|---|---|
| UC-1 buildSnapshot | 포트 6개 + today | Snapshot | 지역별 실패는 계수하고 계속 · 집중률 빈 목록 = `empty` · 커버리지 계산 · 비공개 필드 제거 |
| UC-2 regionOutlook | Snapshot + code + today | 달력 30칸·주말 창 추천·30일 최저/최고·대안·관광지 5·강수 | 과거 날짜 제외 · 데이터 없으면 `null` |
| UC-3 rankForDate | Snapshot + date + sido? | 한적한 순 지역 목록 | 시도 필터 · 값 없는 지역 제외 |
| UC-4 embedStrip | Snapshot + code + today | 7일 막대 + 한적한 날 1개 | UC-2 재사용 |
| UC-5 effectReport | Snapshot + today | 지역별 주말 창 기대 감소폭 분포(평균·중앙값) | 서식4 기대효과 숫자의 유일한 출처 |

## 6. 수용 기준 (Given/When/Then) — 각 항목 테스트 1개 이상
- AC-1: levelOf(39.99)=여유 · levelOf(40)=보통 · levelOf(70)=붐빔 · 범위 밖(−1, 101, NaN) → 예외.
- AC-2: weekdayOf('20260926')=6(토) · addDays('20260930', 2)='20261002'.
- AC-3: weekendWindows('20260924'(목)) = [{26,27},{10/3,10/4}] · 일요일이면 이번 주말 = 오늘 하루.
- AC-4: quietestDay — 기간 안 최솟값, 동률이면 이른 날, 기간 밖 무시, 빈 기간 → null.
- AC-5: expectedDrop = peak − quietest (주말 창 2일 기준), 한쪽만 있으면 0.
- AC-6: alternativesOn — 같은 날 대상보다 낮은 유사지역만, 낮은 순, 값 없는 유사지역 제외.
- AC-7: rankForDate — 시도 필터·오름차순·값 없는 지역 제외.
- AC-8: toGrid(37.5665, 126.9780)=(60,127)(서울) · toGrid(33.4996, 126.5312)=(53,38)(제주시) — 기상청 격자 변환식 기준값.
- AC-9: summarizeRain — POP 날짜별 최댓값, PTY>0 한 번이라도 있으면 rainy.
- AC-10: buildSnapshot — 가짜 포트 3지역(성공 2·빈 1)과 유사지역 실패 1 → coverage 2/3, failures에 기록, 예측 방문자 수 필드 없음.
- AC-11: 데이터랩 어댑터 — 응답 `{"list":[{"BASE_DATE","LRFRN_VISITR_ESTI_NUM"}]}` → DayIndex[] (가짜 fetch) · HTTP 오류는 예외.
- AC-12: 기상청 어댑터 — base_date/base_time 계산(06:30 KST 실행 → 당일 0500) · resultCode≠00 예외.
- AC-13: regionOutlook — 과거 날짜 제외, 달력 칸 수 = 오늘 이후 값 수, 추천 = quietestDay.
- AC-14 (UI 물리): 라이브/로컬 390·1280 가로 스크롤 0 · 콘솔 에러 0 · `/r/48220` 진입 시 통영시 선택 상태 · 임베드 200.
- AC-16: nearbyAlternativesOn — 반경 안·더 한적한 곳만 낮은 순 최대 3, 대표점 없으면 [] · haversineKm 서울–부산 320~330km · pearson ±1·10일 미만 null.
- AC-15 (물리): 실데이터 스냅샷 coverage ≥ 220(9/24 실측 225) · 실패 0 · 기준일 = 수집일.

## 7. 아키텍처 (Clean) — 의존성은 안쪽으로만
```
src/domain/ ← src/application/ ← src/adapters/(datalabHttp · kmaHttp · fileStore) ← src/infrastructure/(collect.js 합성 루트 · buildPublic.js)
public/ (UI 어댑터: app.js·embed.js가 public/domain 복사본을 import — 빌드가 복사)
```
- `src/domain/*.js`: 순수 함수, import는 domain 내부만(테스트가 검사).
- `src/application/*.js`: domain만 import, I/O는 포트 인자로.
- 레이어 위반 검사: `tests/layers.test.js`.

## 8. UI 수용기준 (notes/원칙-디자인 체크리스트 10 구체화)
1. 모바일 퍼스트: 390px 가로 스크롤 0 · 1280px 중앙 560px 컬럼.
2. 한 화면 한 질문: 첫 질문 「어디 가세요?」 입력 1개(지역 검색) → 결과. 날짜 순위는 탭 2.
3. 타이포: 제목 24px/800 · 본문 16px · 보조 13px.
4. 여백: 섹션 간 24px · 카드 라운드 16px · 그림자 없음(선 1px).
5. 하단 고정 CTA: 결과 화면 「이 날로 정하기(캘린더에 추가)」 ≥52px 전폭 — .ics 다운로드(서버 없음).
6. 숫자 먼저: 결과 카드 첫 요소 = 추천일 집중률 큰 숫자 ≥ 32px + 「토요일보다 −31」 판정 1줄.
7. 근거 접힘: 산출식·출처는 `<details>` 기본 닫힘.
8. 마이크로카피: "집중률 40 미만이면 여유예요" 식 1줄 풀이, 전문어(누적분포확률)는 details 안에서만.
9. 색: 흰 배경 + 블루 #3182F6 1색 + 상태 3색(여유 #1FA463 · 보통 #F2A100 · 붐빔 #F04452), 본문 대비 ≥ 4.5:1.
10. 성능·의존: 외부 폰트·CDN 0(시스템 폰트), 스냅샷 1회 fetch, 스켈레톤.

## 9. 운영
- 일일 갱신: GitHub Actions `daily.yml`(06:30 KST) → `npm run collect` → `public/data/snapshot.json` 커밋 → Vercel 재배포. KMA 키는 Actions 시크릿.
- 원 로그: Vercel Web Analytics(대시보드 활성화 필요 — 메인/Aside 1회).
