// 예측 안정성 — 같은 지역·같은 날짜에 대한 예측이 수집일마다 얼마나 바뀌는지(최초 vs 최근 수집, 절대 차 pt).
// 데이터랩 예측을 믿고 날짜를 정해도 되는지 보는 품질 지표(9/24부터 매일 스냅샷 누적).
import { median } from '../domain/outlook.js';

const round2 = (n) => Math.round(n * 100) / 100;

export function forecastStability(snapshots) {
  const ordered = [...snapshots].sort((a, b) => a.meta.today.localeCompare(b.meta.today));
  if (ordered.length < 2) return { snapshots: ordered.length, pairs: 0, meanAbs: null, medianAbs: null, shareWithin10: null };
  const first = new Map();
  const last = new Map();
  for (const s of ordered) {
    for (const r of Object.values(s.regions)) {
      for (const d of r.days) {
        if (d.date < s.meta.today) continue;
        const k = `${r.code}|${d.date}`;
        if (!first.has(k)) first.set(k, { v: d.index, at: s.meta.today });
        last.set(k, { v: d.index, at: s.meta.today });
      }
    }
  }
  const diffs = [];
  for (const [k, f] of first) {
    const l = last.get(k);
    if (l.at !== f.at) diffs.push(Math.abs(l.v - f.v));
  }
  const n = diffs.length;
  return {
    snapshots: ordered.length,
    from: ordered[0].meta.today,
    to: ordered[ordered.length - 1].meta.today,
    pairs: n,
    meanAbs: n ? round2(diffs.reduce((a, b) => a + b, 0) / n) : null,
    medianAbs: n ? round2(median(diffs)) : null,
    shareWithin10: n ? round2(diffs.filter((x) => x <= 10).length / n) : null,
  };
}
