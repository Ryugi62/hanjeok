// 혼잡 단계 — 데이터랩 「향후 30일간 지역 집중률」 지수(0~100)를 3단계로 읽는다.
// 지수는 전년도 전체 지역 평균·표준편차 기반 누적분포확률(메타 원문)이라 지역 간 같은 잣대다.
export const LEVELS = Object.freeze({
  QUIET: Object.freeze({ key: 'quiet', label: '여유', max: 40 }),
  NORMAL: Object.freeze({ key: 'normal', label: '보통', max: 70 }),
  BUSY: Object.freeze({ key: 'busy', label: '붐빔', max: Infinity }),
});

export function levelOf(index) {
  if (typeof index !== 'number' || Number.isNaN(index) || index < 0 || index > 100) {
    throw new RangeError(`집중률은 0~100이어야 합니다: ${index}`);
  }
  if (index < LEVELS.QUIET.max) return LEVELS.QUIET;
  if (index < LEVELS.NORMAL.max) return LEVELS.NORMAL;
  return LEVELS.BUSY;
}
