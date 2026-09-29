// UC-2 지역 전망 · UC-4 임베드 띠 — 스냅샷만 읽는 순수 유스케이스(브라우저에서도 그대로 돈다).
import { levelOf } from '../domain/crowd.js';
import { weekdayOf, weekendWindows, addDays } from '../domain/calendar.js';
import { quietestDay, peakDay, expectedDrop, vsUsual } from '../domain/outlook.js';
import { alternativesOn, nearbyAlternativesOn } from '../domain/compare.js';

// 내비게이션 목적지 순위에는 터미널 같은 교통시설이 섞인다 — 가볼 곳 목록에서는 뺀다.
const NON_SPOT = new Set(['교통시설']);

export function regionOutlook(snapshot, code, today) {
  const r = snapshot.regions[code];
  if (!r) return null;
  const future = r.days.filter((d) => d.date >= today);
  if (future.length === 0) return null;
  const last = future[future.length - 1].date;
  const rainBy = new Map((r.rain || []).map((x) => [x.date, x]));
  const calendar = future.map((d) => ({
    date: d.date,
    index: d.index,
    level: levelOf(d.index),
    weekday: weekdayOf(d.date),
    vsUsual: vsUsual(future, d.date),
    rain: rainBy.get(d.date) || null,
  }));
  const windows = weekendWindows(today).map((w) => ({
    ...w,
    quiet: quietestDay(future, w.from, w.to),
    peak: peakDay(future, w.from, w.to),
    drop: expectedDrop(future, w),
  }));
  const anchorDate = (windows[0].peak && windows[0].peak.date) || future[0].date;
  return {
    region: { code: r.code, name: r.name, sido: r.sido },
    baseDate: snapshot.meta && snapshot.meta.baseDate,
    calendar,
    windows,
    best30: quietestDay(future, today, last),
    peak30: peakDay(future, today, last),
    alternativesDate: anchorDate,
    alternatives: alternativesOn(snapshot, code, anchorDate),
    nearby: nearbyAlternativesOn(snapshot, code, anchorDate),
    similar: r.similar || [],
    attractions: (r.attractions || []).filter((a) => !NON_SPOT.has(a.category)).slice(0, 5),
    anchor: r.anchor || null,
  };
}

export function embedStrip(snapshot, code, today) {
  const r = snapshot.regions[code];
  if (!r) return null;
  const end = addDays(today, 6);
  const days = r.days.filter((d) => d.date >= today && d.date <= end).map((d) => ({ ...d, level: levelOf(d.index) }));
  return { region: { code: r.code, name: r.name, sido: r.sido }, days, best: quietestDay(days, today, end) };
}

// 「데이터 준비 중」 — 주최 안내(2026-09-29 15:52)에 따라 자동 실행으로 받은 파일을 내리고,
// 사람이 직접 받은 공식 다운로드 파일로 교체될 때까지 숫자 없이 보여 준다.
export const PREPARING_NOTE = '데이터 준비 중 — 한국관광 데이터랩 공식 「데이터 다운로드」로 직접 받은 파일로 교체하고 있어요.';

export function preparingSnapshot(since) {
  return {
    meta: {
      service: 'hanjeok',
      status: 'preparing',
      since,
      note: PREPARING_NOTE,
      baseDate: null,
      coverage: { withIndex: 0, listed: 0 },
      empty: [],
      emptyRegions: [],
      failures: [],
      sources: ['한국관광 데이터랩 공식 「데이터 다운로드」(직접 받은 파일로 교체 중)', '기상청 단기예보 조회서비스(공공데이터포털)'],
    },
    regions: {},
  };
}

export function isPreparing(snapshot) {
  if (!snapshot || !snapshot.meta) return true;
  if (snapshot.meta.status === 'preparing') return true;
  return !snapshot.regions || Object.keys(snapshot.regions).length === 0;
}
