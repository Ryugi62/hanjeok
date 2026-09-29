import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isPreparing, preparingSnapshot } from '../src/application/outlook.js';

// 2026-09-29 주최 회신(15:52): 자동 실행으로 받은 파일은 쓰지 않는다 → 직접 받은 파일로 교체될 때까지 「데이터 준비 중」.
test('준비 중 스냅샷은 지역·숫자가 없고 isPreparing이 참', () => {
  const s = preparingSnapshot('2026-09-29T16:20:00+09:00');
  assert.equal(isPreparing(s), true);
  assert.deepEqual(s.regions, {});
  assert.equal(s.meta.status, 'preparing');
});

test('지역이 있는 스냅샷은 준비 중이 아님', () => {
  assert.equal(isPreparing({ meta: { baseDate: '20261001' }, regions: { '48220': { days: [{ date: '20261001', index: 30 }] } } }), false);
  assert.equal(isPreparing(null), true);
});

test('배포 데이터(public/data)는 준비 중 상태이고 숫자를 싣지 않는다', () => {
  const snap = JSON.parse(readFileSync('public/data/snapshot.json', 'utf8'));
  assert.equal(isPreparing(snap), true);
  assert.equal(Object.keys(snap.regions).length, 0);
  const effect = JSON.parse(readFileSync('public/data/effect.json', 'utf8'));
  assert.equal(effect.status, 'preparing');
});
