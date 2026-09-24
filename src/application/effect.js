// UC-5 기대효과 — 서식4 「기대효과」 숫자의 유일한 출처. 사람이 숫자를 타이핑하지 않는다.
import { weekendWindows, weekdayOf, addDays } from '../domain/calendar.js';
import { levelOf } from '../domain/crowd.js';
import { alternativesOn, nearbyAlternativesOn, NEARBY_KM } from '../domain/compare.js';
import { pearson } from '../domain/stats.js';
import { expectedDrop, median } from '../domain/outlook.js';

const round2 = (n) => Math.round(n * 100) / 100;

// 유사지역끼리 30일 집중률이 얼마나 함께 움직이는지 — 전체 지역쌍 평균과 비교(대안 설계 근거).
function correlationReport(snapshot) {
  const regions = Object.values(snapshot.regions);
  const mean = (xs) => (xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const sim = [];
  for (const r of regions) {
    for (const s of r.similar || []) {
      const t = snapshot.regions[s.code];
      const v = t ? pearson(r.days, t.days) : null;
      if (v !== null) sim.push(v);
    }
  }
  const all = [];
  for (let i = 0; i < regions.length; i += 1) {
    for (let j = i + 1; j < regions.length; j += 1) {
      const v = pearson(regions[i].days, regions[j].days);
      if (v !== null) all.push(v);
    }
  }
  return { similarPairs: sim.length, similarMean: mean(sim), allPairs: all.length, allMean: mean(all) };
}

export function effectReport(snapshot, today) {
  const windows = weekendWindows(today).map((w) => {
    const drops = Object.values(snapshot.regions)
      .map((r) => expectedDrop(r.days, w))
      .filter((x) => x !== null);
    const n = drops.length;
    return {
      name: w.name,
      from: w.from,
      to: w.to,
      n,
      mean: n ? round2(drops.reduce((a, b) => a + b, 0) / n) : null,
      median: n ? round2(median(drops)) : null,
      shareAtLeast10: n ? round2(drops.filter((x) => x >= 10).length / n) : null,
      max: n ? round2(Math.max(...drops)) : null,
    };
  });
  const regions = Object.values(snapshot.regions);

  // 30일 안의 모든 주말(토·일 둘 다 값이 있는 경우) × 지역
  const drops = [];
  for (const r of regions) {
    const future = r.days.filter((d) => d.date >= today);
    for (const d of future) {
      if (weekdayOf(d.date) !== 6) continue;
      const sun = addDays(d.date, 1);
      if (!future.some((x) => x.date === sun)) continue;
      drops.push(expectedDrop(future, { from: d.date, to: sun }));
    }
  }
  const stat = (xs) => ({
    n: xs.length,
    mean: xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : null,
    median: xs.length ? round2(median(xs)) : null,
    shareAtLeast10: xs.length ? round2(xs.filter((x) => x >= 10).length / xs.length) : null,
  });

  // 붐빔(≥70) 지역-일 중 같은 날 10 이상 한적한 유사지역이 있는 비율
  let busyDays = 0;
  let withQuieterSimilar = 0;
  let withQuieterNearby = 0;
  let withEither = 0;
  const bestDrops = [];
  const dist = { quiet: 0, normal: 0, busy: 0 };
  for (const r of regions) {
    for (const d of r.days.filter((x) => x.date >= today)) {
      dist[levelOf(d.index).key] += 1;
      if (d.index < 70) continue;
      busyDays += 1;
      const alts = alternativesOn(snapshot, r.code, d.date).filter((a) => a.drop >= 10);
      const near = nearbyAlternativesOn(snapshot, r.code, d.date, NEARBY_KM, 1000).filter((a) => a.drop >= 10);
      if (alts.length) {
        withQuieterSimilar += 1;
        bestDrops.push(Math.max(...alts.map((a) => a.drop)));
      }
      if (near.length) withQuieterNearby += 1;
      if (alts.length || near.length) withEither += 1;
    }
  }
  const n = dist.quiet + dist.normal + dist.busy;
  return {
    today,
    baseDate: snapshot.meta && snapshot.meta.baseDate,
    regions: regions.length,
    windows,
    allWeekends: stat(drops),
    alternatives: {
      busyDays,
      withQuieterSimilar,
      share: busyDays ? round2(withQuieterSimilar / busyDays) : null,
      meanBestDrop: stat(bestDrops).mean,
      nearbyKm: NEARBY_KM,
      withQuieterNearby,
      shareNearby: busyDays ? round2(withQuieterNearby / busyDays) : null,
      withEither,
      shareEither: busyDays ? round2(withEither / busyDays) : null,
    },
    correlation: correlationReport(snapshot),
    distribution: { n, ...dist, shareQuiet: n ? round2(dist.quiet / n) : null, shareBusy: n ? round2(dist.busy / n) : null },
    regionsWithQuietDay: regions.filter((r) => r.days.some((d) => d.date >= today && d.index < 40)).length,
  };
}
