// 지역 간 비교 — 지수가 전년도 전체 지역 기준으로 정규화돼 있어 같은 날 서로 비교할 수 있다.
import { levelOf } from './crowd.js';
import { haversineKm } from './geo.js';

export const NEARBY_KM = 30;

const indexOn = (region, date) => {
  const x = region && region.days.find((y) => y.date === date);
  return x ? x.index : null;
};

// 같은 날, 대상보다 집중률이 낮은 유사지역(낮은 순).
export function alternativesOn(snapshot, code, date) {
  const target = snapshot.regions[code];
  if (!target) return [];
  const base = indexOn(target, date);
  if (base === null) return [];
  return (target.similar || [])
    .map((s) => ({ ...s, index: indexOn(snapshot.regions[s.code], date) }))
    .filter((s) => s.index !== null && s.index < base)
    .map((s) => ({ ...s, level: levelOf(s.index), drop: Math.round((base - s.index) * 100) / 100 }))
    .sort((a, b) => a.index - b.index);
}

// 날짜 하나에서 한적한 지역 순위(시도 필터 선택).
export function rankForDate(snapshot, date, sido) {
  return Object.values(snapshot.regions)
    .filter((r) => !sido || r.sido === sido)
    .map((r) => ({ code: r.code, name: r.name, sido: r.sido, index: indexOn(r, date) }))
    .filter((r) => r.index !== null)
    .map((r) => ({ ...r, level: levelOf(r.index) }))
    .sort((a, b) => a.index - b.index || a.code.localeCompare(b.code));
}

// 같은 날, 대표점 반경 radiusKm 안에서 대상보다 집중률이 낮은 이웃(낮은 순, 최대 limit).
// 9/24 실측: 유사지역은 붐비는 날도 함께 붐비는 경향(상관 평균 0.80)이라 가까운 이웃을 함께 보여준다.
export function nearbyAlternativesOn(snapshot, code, date, radiusKm = NEARBY_KM, limit = 3) {
  const target = snapshot.regions[code];
  if (!target || !target.anchor) return [];
  const base = indexOn(target, date);
  if (base === null) return [];
  return Object.values(snapshot.regions)
    .filter((r) => r.code !== code && r.anchor)
    .map((r) => ({ code: r.code, name: r.name, sido: r.sido, km: Math.round(haversineKm(target.anchor, r.anchor)), index: indexOn(r, date) }))
    .filter((r) => r.km <= radiusKm && r.index !== null && r.index < base)
    .map((r) => ({ ...r, level: levelOf(r.index), drop: Math.round((base - r.index) * 100) / 100 }))
    .sort((a, b) => a.index - b.index || a.km - b.km)
    .slice(0, limit);
}
