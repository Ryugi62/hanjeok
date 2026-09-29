import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot } from '../src/application/buildSnapshot.js';
import { regionOutlook, embedStrip } from '../src/application/outlook.js';
import { effectReport } from '../src/application/effect.js';

const days = (pairs) => pairs.map(([date, index]) => ({ date, index }));

function fakePorts() {
  const calls = { forecast: 0 };
  return {
    calls,
    regions: { list: async () => [
      { code: '48220', name: '통영시', sido: '경상남도' },
      { code: '47170', name: '안동시', sido: '경상북도' },
      { code: '28125', name: '제물포구', sido: '인천광역시' },
    ] },
    concentration: { forecast: async (code) => {
      calls.forecast += 1;
      if (code === '28125') return [];
      // 어댑터가 실수로 비공개 필드를 넘겨도 스냅샷엔 남지 않아야 한다.
      return [{ date: '20260924', index: 91.61, LRFRN_VISITR_ESTI_NUM: 91.61, TOU_NUM: 1 }, { date: '20260926', index: 88.13 }];
    } },
    similar: { similar: async (code) => {
      if (code === '47170') throw new Error('timeout');
      return [{ code: '47170', name: '경상북도 안동시', similarity: 0.919 }];
    } },
    attractions: { top: async () => [{ rank: 1, name: '통영중앙전통시장', category: '시장', searchCount: 14231 }, { rank: 2, name: '통영여객선터미널', category: '교통시설', searchCount: 4187 }] },
    anchor: { anchor: async (code) => (code === '48220' ? { name: '통영중앙전통시장', lat: 34.8452, lon: 128.4241 } : null) },
    weather: { daily: async () => [{ date: '20260924', popMax: 20, rainy: false }] },
  };
}

test('AC-10 buildSnapshot — 실패는 계수하고 계속, 빈 목록은 empty, 비공개 필드 제거, 커버리지', async () => {
  const ports = fakePorts();
  const snap = await buildSnapshot(ports, { today: '20260924', attractionsYm: '202608', collectedAt: '2026-09-24T06:30:00+09:00' });
  assert.deepEqual(Object.keys(snap.regions).sort(), ['47170', '48220']);
  assert.deepEqual(snap.meta.coverage, { withIndex: 2, listed: 3 });
  assert.deepEqual(snap.meta.empty, ['28125']);
  assert.deepEqual(snap.meta.emptyRegions, [{ code: '28125', name: '제물포구', sido: '인천광역시' }]);
  assert.ok(snap.meta.failures.some((f) => f.code === '47170' && f.part === 'similar'));
  assert.deepEqual(snap.regions['48220'].days[0], { date: '20260924', index: 91.61 });
  assert.equal(JSON.stringify(snap).includes('TOU_NUM'), false);
  assert.equal(JSON.stringify(snap).includes('LRFRN_VISITR_ESTI_NUM'), false);
  assert.deepEqual(snap.regions['48220'].anchor, { name: '통영중앙전통시장', lat: 34.8452, lon: 128.4241 });
  assert.deepEqual(snap.regions['48220'].grid, { nx: 86, ny: 68 });
  assert.equal(snap.regions['48220'].rain.length, 1);
  assert.equal(snap.regions['47170'].rain, undefined);
  assert.equal(snap.meta.baseDate, '20260924');
  assert.equal(snap.meta.attractionsYm, '202608');
  assert.deepEqual(snap.regions['48220'].attractions.map((a) => a.name), ['통영중앙전통시장']);
  assert.equal(snap.regions['48220'].similar[0].similarity, 0.919);
});

test('AC-10b buildSnapshot — 집중률 호출이 예외면 그 지역만 failures', async () => {
  const ports = fakePorts();
  ports.concentration.forecast = async (code) => { if (code === '48220') throw new Error('HTTP 500'); return [{ date: '20260924', index: 10 }]; };
  const snap = await buildSnapshot(ports, { today: '20260924', attractionsYm: '202608', collectedAt: 'x' });
  assert.ok(snap.meta.failures.some((f) => f.code === '48220' && f.part === 'concentration'));
  assert.equal(snap.regions['48220'], undefined);
  assert.ok(snap.regions['47170']);
});

const snapshot = {
  meta: { baseDate: '20260924' },
  regions: {
    '48220': {
      code: '48220', name: '통영시', sido: '경상남도',
      days: days([['20260923', 99], ['20260924', 91.61], ['20260925', 91.61], ['20260926', 88.13], ['20260927', 69.44], ['20260928', 25.32], ['20261003', 80], ['20261004', 60]]),
      similar: [{ code: '47170', name: '경상북도 안동시', similarity: 0.919 }],
      attractions: [1, 2, 3, 4, 5, 6, 7].map((r) => ({ rank: r, name: `곳${r}`, category: r === 2 ? '교통시설' : '관광', searchCount: 100 - r })),
      rain: [{ date: '20260926', popMax: 60, rainy: true }],
    },
    '47170': { code: '47170', name: '안동시', sido: '경상북도', days: days([['20260926', 50], ['20260927', 40], ['20261003', 90], ['20261004', 95]]), similar: [] },
  },
};

test('AC-13 regionOutlook — 과거 제외·주말 창 추천·대안·관광지 5·강수 결합', () => {
  const o = regionOutlook(snapshot, '48220', '20260924');
  assert.equal(o.calendar[0].date, '20260924');
  assert.equal(o.calendar.length, 7);
  assert.equal(o.calendar.find((c) => c.date === '20260926').rain.popMax, 60);
  assert.equal(o.windows[0].quiet.date, '20260927');
  assert.equal(o.windows[0].peak.date, '20260926');
  assert.equal(o.windows[0].drop, 18.69);
  assert.equal(o.windows[1].quiet.date, '20261004');
  assert.equal(o.best30.date, '20260928');
  assert.equal(o.attractions.length, 5);
  assert.equal(o.attractions.some((a) => a.category === '교통시설'), false);
  assert.deepEqual(o.alternatives.map((a) => a.code), ['47170']);
  assert.equal(o.alternativesDate, '20260926');
  assert.equal(regionOutlook(snapshot, '00000', '20260924'), null);
});

test('AC-4b embedStrip — 오늘부터 7일, 그중 한적한 날', () => {
  const e = embedStrip(snapshot, '48220', '20260924');
  assert.equal(e.days.length, 5);
  assert.equal(e.best.date, '20260928');
  assert.equal(e.region.name, '통영시');
});

test('UC-5 effectReport — 지역별 주말 창 감소폭의 평균·중앙값·10pt 이상 비율', () => {
  const r = effectReport(snapshot, '20260924');
  const w0 = r.windows[0];
  assert.equal(w0.name, '이번 주말');
  assert.equal(w0.n, 2);
  assert.equal(w0.mean, 14.35); // (18.69 + 10) / 2 = 14.345 → 14.35
  assert.equal(w0.median, 14.35);
  assert.equal(w0.shareAtLeast10, 1);
  assert.equal(r.windows[1].n, 2);
});

test('UC-5b effectReport — 30일 안 주말 전체·유사지역 대안·단계 분포', () => {
  const r = effectReport(snapshot, '20260924');
  // 주말 2개(9/26~27, 10/3~4) × 지역 2 = 4사례: 통영 18.69·20, 안동 10·5
  assert.equal(r.allWeekends.n, 4);
  assert.equal(r.allWeekends.mean, 13.42);
  assert.equal(r.allWeekends.shareAtLeast10, 0.75);
  // 붐빔(≥70) 지역-일: 통영 9/24·9/25·9/26·10/3, 안동 10/3·10/4 = 6. 10 이상 한적한 유사지역이 있는 것: 통영 9/26(안동 50) = 1 (9/24·25·10/3은 안동 값 없음 또는 더 붐빔)
  assert.equal(r.alternatives.busyDays, 6);
  assert.equal(r.alternatives.withQuieterSimilar, 1);
  assert.equal(r.distribution.n, 11);
  assert.equal(r.distribution.quiet + r.distribution.normal + r.distribution.busy, 11);
  // 대표점이 없으면 이웃 대안 0 → either = similar
  assert.equal(r.alternatives.withQuieterNearby, 0);
  assert.equal(r.alternatives.withEither, 1);
  assert.equal(r.correlation.similarPairs, 0); // 공통 날짜 10일 미만
  assert.equal(r.alternatives.nearbyKm, 30);
});

test('AC-10c buildSnapshot — 공식 다운로드처럼 유사도·검색건수가 없으면 null/생략(0으로 만들지 않음), sources·extraMeta 반영', async () => {
  const ports = fakePorts();
  ports.similar.similar = async () => [{ code: '47170', name: '경상북도 안동시', similarity: null }, { code: null, name: '외계지', similarity: null }];
  ports.attractions.top = async () => [{ rank: 1, name: '통영중앙전통시장', category: '시장' }];
  const snap = await buildSnapshot(ports, { today: '20260924', collectedAt: 'x', sources: ['공식 다운로드'], extraMeta: { period: { from: '202509', to: '202608' } } });
  assert.deepEqual(snap.regions['48220'].similar, [{ code: '47170', name: '경상북도 안동시', similarity: null }, { code: null, name: '외계지', similarity: null }]);
  assert.deepEqual(snap.regions['48220'].attractions, [{ rank: 1, name: '통영중앙전통시장', category: '시장' }]);
  assert.deepEqual(snap.meta.sources, ['공식 다운로드']);
  assert.deepEqual(snap.meta.period, { from: '202509', to: '202608' });
  assert.equal(snap.meta.attractionsYm, null);
});
