import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKmaClient, baseDateTime } from '../src/adapters/kmaHttp.js';

function fakeFetch(responder) {
  const calls = [];
  const f = async (url, init = {}) => {
    calls.push({ url, init, form: init.body ? Object.fromEntries(new URLSearchParams(init.body)) : null });
    const { status = 200, json } = responder(url, init, calls.length);
    return { ok: status >= 200 && status < 300, status, json: async () => json };
  };
  f.calls = calls;
  return f;
}

test('AC-12 기상청 baseDateTime — 발표+10분 규칙', () => {
  assert.deepEqual(baseDateTime({ ymd: '20260924', hhmm: '0630' }, '20260923'), { base_date: '20260924', base_time: '0500' });
  assert.deepEqual(baseDateTime({ ymd: '20260924', hhmm: '0205' }, '20260923'), { base_date: '20260923', base_time: '2300' });
  assert.deepEqual(baseDateTime({ ymd: '20260924', hhmm: '2359' }, '20260923'), { base_date: '20260924', base_time: '2300' });
});

test('AC-12b 기상청 daily — resultCode≠00 예외, 정상은 날짜별 요약', async () => {
  const bad = fakeFetch(() => ({ json: { response: { header: { resultCode: '30', resultMsg: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR' } } } }));
  const k1 = createKmaClient({ serviceKey: 'K', fetchImpl: bad, now: { ymd: '20260924', hhmm: '0630' }, prevYmd: '20260923' });
  await assert.rejects(() => k1.daily(60, 127), /resultCode 30/);
  const ok = fakeFetch(() => ({ json: { response: { header: { resultCode: '00' }, body: { items: { item: [
    { category: 'POP', fcstDate: '20260924', fcstValue: '30' }, { category: 'PTY', fcstDate: '20260924', fcstValue: '0' },
  ] } } } } }));
  const k2 = createKmaClient({ serviceKey: 'K', fetchImpl: ok, now: { ymd: '20260924', hhmm: '0630' }, prevYmd: '20260923' });
  assert.deepEqual(await k2.daily(60, 127), [{ date: '20260924', popMax: 30, rainy: false }]);
  assert.match(ok.calls[0].url, /base_date=20260924&base_time=0500/);
  assert.throws(() => createKmaClient({ serviceKey: '', now: { ymd: '1', hhmm: '1' } }), /KMA_SERVICE_KEY/);
});
