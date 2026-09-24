import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecastStability } from '../src/application/stability.js';

const snap = (today, days) => ({ meta: { today }, regions: { A: { code: 'A', days: days.map(([date, index]) => ({ date, index })) } } });

test('forecastStability — 같은 날짜 예측의 최초·최근 차이, 지난 날짜 제외, 스냅샷 1개면 pairs 0', () => {
  const s1 = snap('20260924', [['20260924', 90], ['20260926', 80], ['20260927', 50]]);
  const s2 = snap('20260925', [['20260924', 10], ['20260926', 70], ['20260927', 55]]);
  const r = forecastStability([s2, s1]);
  assert.equal(r.pairs, 2); // 9/26(−10), 9/27(+5) — 9/24는 s2에서 지난 날짜
  assert.equal(r.meanAbs, 7.5);
  assert.equal(r.shareWithin10, 1);
  assert.equal(forecastStability([s1]).pairs, 0);
});
