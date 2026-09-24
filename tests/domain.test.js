import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelOf, LEVELS } from '../src/domain/crowd.js';
import { weekdayOf, addDays, weekendWindows, daysBetween } from '../src/domain/calendar.js';
import { quietestDay, peakDay, expectedDrop, vsUsual, median } from '../src/domain/outlook.js';
import { alternativesOn, rankForDate } from '../src/domain/compare.js';
import { toGrid, summarizeRain } from '../src/domain/weather.js';

const d = (date, index) => ({ date, index });

test('AC-1 levelOf 경계값과 범위 밖 예외', () => {
  assert.equal(levelOf(0), LEVELS.QUIET);
  assert.equal(levelOf(39.99), LEVELS.QUIET);
  assert.equal(levelOf(40), LEVELS.NORMAL);
  assert.equal(levelOf(69.99), LEVELS.NORMAL);
  assert.equal(levelOf(70), LEVELS.BUSY);
  assert.equal(levelOf(100), LEVELS.BUSY);
  assert.throws(() => levelOf(-1));
  assert.throws(() => levelOf(101));
  assert.throws(() => levelOf(NaN));
  assert.equal(LEVELS.QUIET.label, '여유');
  assert.equal(LEVELS.BUSY.label, '붐빔');
});

test('AC-2 weekdayOf·addDays·daysBetween (UTC 기준, 시간대 무관)', () => {
  assert.equal(weekdayOf('20260926'), 6);
  assert.equal(weekdayOf('20260927'), 0);
  assert.equal(weekdayOf('20260924'), 4);
  assert.equal(addDays('20260930', 2), '20261002');
  assert.equal(addDays('20261231', 1), '20270101');
  assert.equal(daysBetween('20260924', '20261003'), 9);
  assert.throws(() => weekdayOf('2026-09-26'));
});

test('AC-3 weekendWindows — 목요일·토요일·일요일', () => {
  assert.deepEqual(weekendWindows('20260924'), [
    { name: '이번 주말', from: '20260926', to: '20260927' },
    { name: '다음 주말', from: '20261003', to: '20261004' },
  ]);
  assert.deepEqual(weekendWindows('20260926'), [
    { name: '이번 주말', from: '20260926', to: '20260927' },
    { name: '다음 주말', from: '20261003', to: '20261004' },
  ]);
  assert.deepEqual(weekendWindows('20260927'), [
    { name: '이번 주말', from: '20260927', to: '20260927' },
    { name: '다음 주말', from: '20261003', to: '20261004' },
  ]);
});

test('AC-4 quietestDay·peakDay — 최솟값, 동률은 이른 날, 기간 밖 무시, 빈 기간 null', () => {
  const days = [d('20260925', 90), d('20260926', 50), d('20260927', 50), d('20260928', 10)];
  assert.deepEqual(quietestDay(days, '20260926', '20260927'), d('20260926', 50));
  assert.deepEqual(quietestDay(days, '20260901', '20260930'), d('20260928', 10));
  assert.equal(quietestDay(days, '20261010', '20261011'), null);
  assert.deepEqual(peakDay(days, '20260925', '20260927'), d('20260925', 90));
});

test('AC-5 expectedDrop — 주말 창 peak − quietest, 한 날만 있으면 0', () => {
  const days = [d('20260926', 88.13), d('20260927', 69.44)];
  assert.equal(expectedDrop(days, { from: '20260926', to: '20260927' }), 18.69);
  assert.equal(expectedDrop([d('20260926', 50)], { from: '20260926', to: '20260927' }), 0);
  assert.equal(expectedDrop([], { from: '20260926', to: '20260927' }), null);
});

test('median·vsUsual — 30일 중앙값 대비 차이', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  const days = [d('20260924', 10), d('20260925', 20), d('20260926', 90)];
  assert.equal(vsUsual(days, '20260926'), 70);
  assert.equal(vsUsual(days, '20261201'), null);
});

const snapshot = {
  regions: {
    '48220': { code: '48220', name: '통영시', sido: '경상남도', days: [d('20260926', 88), d('20260927', 69)],
      similar: [{ code: '47170', name: '경상북도 안동시', similarity: 0.92 }, { code: '43150', name: '충청북도 제천시', similarity: 0.90 }, { code: '44180', name: '충청남도 보령시', similarity: 0.88 }] },
    '47170': { code: '47170', name: '안동시', sido: '경상북도', days: [d('20260926', 60), d('20260927', 30)], similar: [] },
    '43150': { code: '43150', name: '제천시', sido: '충청북도', days: [d('20260926', 95), d('20260927', 20)], similar: [] },
    '44180': { code: '44180', name: '보령시', sido: '충청남도', days: [], similar: [] },
  },
};

test('AC-6 alternativesOn — 같은 날 더 낮은 유사지역만 낮은 순, 값 없는 곳 제외', () => {
  assert.deepEqual(alternativesOn(snapshot, '48220', '20260926').map((a) => [a.code, a.index]), [['47170', 60]]);
  assert.deepEqual(alternativesOn(snapshot, '48220', '20260927').map((a) => a.code), ['43150', '47170']);
  assert.deepEqual(alternativesOn(snapshot, '99999', '20260926'), []);
});

test('AC-7 rankForDate — 시도 필터·오름차순·값 없는 지역 제외', () => {
  assert.deepEqual(rankForDate(snapshot, '20260927').map((r) => r.code), ['43150', '47170', '48220']);
  assert.deepEqual(rankForDate(snapshot, '20260927', '경상남도').map((r) => r.code), ['48220']);
  assert.equal(rankForDate(snapshot, '20260927')[0].level, LEVELS.QUIET);
});

test('AC-8 toGrid — 기상청 LCC 격자 기준값', () => {
  assert.deepEqual(toGrid(37.5665, 126.978), { nx: 60, ny: 127 });
  assert.deepEqual(toGrid(33.4996, 126.5312), { nx: 53, ny: 38 });
});

test('AC-9 summarizeRain — 날짜별 POP 최댓값, PTY>0이면 rainy', () => {
  const items = [
    { category: 'POP', fcstDate: '20260924', fcstValue: '20' },
    { category: 'POP', fcstDate: '20260924', fcstValue: '60' },
    { category: 'PTY', fcstDate: '20260924', fcstValue: '1' },
    { category: 'POP', fcstDate: '20260925', fcstValue: '10' },
    { category: 'PTY', fcstDate: '20260925', fcstValue: '0' },
    { category: 'TMP', fcstDate: '20260925', fcstValue: '27' },
  ];
  assert.deepEqual(summarizeRain(items), [
    { date: '20260924', popMax: 60, rainy: true },
    { date: '20260925', popMax: 10, rainy: false },
  ]);
});

import { nearbyAlternativesOn } from '../src/domain/compare.js';
import { haversineKm } from '../src/domain/geo.js';
import { pearson } from '../src/domain/stats.js';

test('haversineKm — 서울시청~부산시청 약 325km', () => {
  const km = haversineKm({ lat: 37.5665, lon: 126.978 }, { lat: 35.1796, lon: 129.0756 });
  assert.ok(km > 320 && km < 330, km);
});

test('nearbyAlternativesOn — 반경 안·더 한적한 곳만, 낮은 순, 최대 3', () => {
  const snap = { regions: {
    A: { code: 'A', name: 'A', sido: 'x', anchor: { lat: 35.0, lon: 128.0 }, days: [d('20260926', 80)] },
    B: { code: 'B', name: 'B', sido: 'x', anchor: { lat: 35.1, lon: 128.0 }, days: [d('20260926', 30)] }, // ~11km
    C: { code: 'C', name: 'C', sido: 'x', anchor: { lat: 35.2, lon: 128.0 }, days: [d('20260926', 90)] }, // 더 붐빔
    D: { code: 'D', name: 'D', sido: 'x', anchor: { lat: 36.0, lon: 128.0 }, days: [d('20260926', 10)] }, // ~111km
    E: { code: 'E', name: 'E', sido: 'x', anchor: { lat: 35.05, lon: 128.05 }, days: [d('20260926', 50)] },
  } };
  const r = nearbyAlternativesOn(snap, 'A', '20260926', 30);
  assert.deepEqual(r.map((x) => x.code), ['B', 'E']);
  assert.equal(r[0].drop, 50);
  assert.ok(r[0].km >= 10 && r[0].km <= 12);
  assert.deepEqual(nearbyAlternativesOn(snap, 'A', '20261231'), []);
});

test('pearson — 같이 움직이면 1, 반대면 −1, 공통 10일 미만 null', () => {
  const a = Array.from({ length: 12 }, (_, i) => d(`202610${String(i + 1).padStart(2, '0')}`, i));
  const b = a.map((x) => d(x.date, x.index * 2 + 3));
  const c = a.map((x) => d(x.date, -x.index));
  assert.ok(Math.abs(pearson(a, b) - 1) < 1e-9);
  assert.ok(Math.abs(pearson(a, c) + 1) < 1e-9);
  assert.equal(pearson(a.slice(0, 5), b.slice(0, 5)), null);
});
