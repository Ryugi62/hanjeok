// 상관 — 두 지역의 날짜별 집중률 시계열이 함께 움직이는 정도(공통 날짜만, 10일 미만·분산 0이면 null).
export function pearson(a, b) {
  const bm = new Map(b.map((d) => [d.date, d.index]));
  const pairs = a.filter((d) => bm.has(d.date)).map((d) => [d.index, bm.get(d.date)]);
  if (pairs.length < 10) return null;
  const mx = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
  const my = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}
