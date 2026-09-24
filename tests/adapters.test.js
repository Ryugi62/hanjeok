import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDatalabClient, QID } from '../src/adapters/datalabHttp.js';
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

test('AC-11 데이터랩 forecast — 응답 list → DayIndex[], qid·SGG_CD 전송', async () => {
  const f = fakeFetch(() => ({ json: { list: [{ BASE_DATE: '20260924', LRFRN_VISITR_ESTI_NUM: 91.61 }, { BASE_DATE: '20260925', LRFRN_VISITR_ESTI_NUM: 91.61 }] } }));
  const c = createDatalabClient({ fetchImpl: f, gapMs: 0 });
  const days = await c.forecast('48220');
  assert.deepEqual(days[0], { date: '20260924', index: 91.61 });
  assert.equal(f.calls[0].form.qid, QID.CONCENTRATION_30D);
  assert.equal(f.calls[0].form.SGG_CD, '48220');
  assert.match(f.calls[0].url, /getTempleteData\.do$/);
});

test('AC-11b 데이터랩 — HTTP 오류는 재시도 후 예외, list 없음도 예외', async () => {
  const f = fakeFetch(() => ({ status: 500, json: {} }));
  const c = createDatalabClient({ fetchImpl: f, gapMs: 0, retries: 1 });
  await assert.rejects(() => c.forecast('48220'), /HTTP 500/);
  assert.equal(f.calls.length, 2);
  const g = fakeFetch(() => ({ json: { nope: 1 } }));
  await assert.rejects(() => createDatalabClient({ fetchImpl: g, gapMs: 0, retries: 0 }).forecast('1'), /list/);
});

test('AC-11c 데이터랩 similar·top 매핑', async () => {
  const f = fakeFetch((url, init, n) => ({ json: { list: n === 1
    ? [{ CMPR_SGG_CD_2: '47170', SGG_NM: '경상북도 안동시', SIMIL_DGRE: 0.919 }]
    : [{ RK: 1, ITS_BRO_NM: '통영중앙전통시장', KTO_CATE_NAME_B: '시장', SRCH_CNT: 14231 }] } }));
  const c = createDatalabClient({ fetchImpl: f, gapMs: 0 });
  assert.deepEqual(await c.similar('48220', '202608'), [{ code: '47170', name: '경상북도 안동시', similarity: 0.919 }]);
  assert.deepEqual(await c.top('48220', '202608'), [{ rank: 1, name: '통영중앙전통시장', category: '시장', searchCount: 14231 }]);
  assert.equal(f.calls[1].form.BASE_YM1, '202608');
});

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
