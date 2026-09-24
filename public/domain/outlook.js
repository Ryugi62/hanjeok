// 한 지역의 30일 집중률(DayIndex[])에서 한적한 날·붐비는 날·기대 감소폭을 읽는다.
const inRange = (from, to) => (x) => x.date >= from && x.date <= to;
const round2 = (n) => Math.round(n * 100) / 100;

export function quietestDay(days, from, to) {
  let best = null;
  for (const x of days.filter(inRange(from, to))) {
    if (best === null || x.index < best.index || (x.index === best.index && x.date < best.date)) best = x;
  }
  return best;
}

export function peakDay(days, from, to) {
  let best = null;
  for (const x of days.filter(inRange(from, to))) {
    if (best === null || x.index > best.index || (x.index === best.index && x.date < best.date)) best = x;
  }
  return best;
}

// 주말 창에서 가장 붐비는 날 대신 가장 한적한 날을 고르면 줄어드는 집중률(pt).
export function expectedDrop(days, span) {
  const q = quietestDay(days, span.from, span.to);
  const p = peakDay(days, span.from, span.to);
  if (!q || !p) return null;
  return round2(p.index - q.index);
}

export function median(values) {
  const s = [...values].sort((a, b) => a - b);
  if (s.length === 0) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// 그 지역 30일 중앙값과의 차이(pt) — 「평소보다 붐빔/한적」.
export function vsUsual(days, date) {
  const x = days.find((y) => y.date === date);
  if (!x) return null;
  return round2(x.index - median(days.map((y) => y.index)));
}
