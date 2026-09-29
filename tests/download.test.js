// AC-11 공식 다운로드 어댑터 · AC-17 레포에 조회 엔드포인트 없음 · AC-18 refreshRain
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync, crc32 } from 'node:zlib';
import { mkdtempSync, writeFileSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readZip, decodeText, parseCsv, createDownloadSource } from '../src/adapters/datalabDownload.js';
import { refreshRain } from '../src/application/refreshRain.js';

// 최소 zip 작성기(테스트 전용): entries = [{ name: Buffer|string, data: Buffer|string, deflate, utf8Flag }]
function makeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.isBuffer(e.name) ? e.name : Buffer.from(e.name, 'utf8');
    const raw = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8');
    const body = e.deflate ? deflateRawSync(raw) : raw;
    const flag = e.utf8Flag ? 0x0800 : 0;
    const method = e.deflate ? 8 : 0;
    const crc = crc32(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(flag, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(flag, 8); ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, name, body);
    centrals.push(ch, name);
    offset += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const BOM = '﻿';
// CP949: 「유사지역」 / 「유사지역명,기준지역명\r\n경상남도 통영시,충청남도 보령시\r\n」
const CP949_SIMILAR_WORD = Buffer.from('c0afbbe7c1f6bfaa', 'hex');
const CP949_SIMILAR_CSV = Buffer.from('c0afbbe7c1f6bfaab8ed2cb1e2c1d8c1f6bfaab8ed0d0ab0e6bbf3b3b2b5b520c5ebbfb5bdc32cc3e6c3bbb3b2b5b520bab8b7c9bdc30d0a', 'hex');

test('AC-11a readZip — stored·deflate 항목, UTF-8 플래그 이름과 CP949 이름을 모두 해독', () => {
  const zip = makeZip([
    { name: '통영_향후 30일간 지역 집중률.csv', data: 'a,b\n1,2\n', utf8Flag: true },
    { name: Buffer.concat([Buffer.from('AI 관광 분석_'.replace(/[^\x00-\x7f]/g, ''), 'utf8'), CP949_SIMILAR_WORD, Buffer.from('.csv')]), data: CP949_SIMILAR_CSV, deflate: true },
  ]);
  const entries = readZip(zip);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].name, '통영_향후 30일간 지역 집중률.csv');
  assert.equal(entries[0].data.toString('utf8'), 'a,b\n1,2\n');
  assert.match(entries[1].name, /유사지역\.csv$/);
  assert.equal(entries[1].data.length, CP949_SIMILAR_CSV.length);
  assert.throws(() => readZip(Buffer.from('not a zip at all, definitely not')), /zip/);
});

test('AC-11b decodeText — UTF-8 BOM 제거, UTF-8이 아니면 CP949', () => {
  assert.equal(decodeText(Buffer.from(`${BOM}기준연월,방문비율(%)`, 'utf8')), '기준연월,방문비율(%)');
  assert.equal(decodeText(CP949_SIMILAR_CSV).split(/\r?\n/)[1], '경상남도 통영시,충청남도 보령시');
});

test('AC-11c parseCsv — 헤더 키 객체, 따옴표 안 쉼표·CRLF·빈 줄', () => {
  const rows = parseCsv('순위,관광지ID,관광지명,분류\r\n1,"A1","통영, 중앙시장",시장\r\n\r\n2,B2,동피랑,"문화 ""관광"""\r\n');
  assert.deepEqual(rows, [
    { 순위: '1', 관광지ID: 'A1', 관광지명: '통영, 중앙시장', 분류: '시장' },
    { 순위: '2', 관광지ID: 'B2', 관광지명: '동피랑', 분류: '문화 "관광"' },
  ]);
});

function makeFolder() {
  const dir = mkdtempSync(join(tmpdir(), 'hanjeok-dl-'));
  const regions = [
    { code: '48220', name: '통영시', sido: '경상남도', has: true },
    { code: '44180', name: '보령시', sido: '충청남도', has: true },
    { code: '36110', name: '세종특별자치시', sido: '세종특별자치시', has: true },
    { code: '28125', name: '제물포구', sido: '인천광역시', has: false },
  ];
  writeFileSync(join(dir, 'regions.json'), JSON.stringify(regions));
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify([
    { code: '48220', cid: '1282', status: 200, bytes: 1, filename: '통영시_향후 30일간 지역 집중률.zip', downloadedAt: '2026-09-29T14:40:00+09:00' },
    { code: '48220', cid: '1205', status: 200, bytes: 1, filename: '통영시_AI 관광 분석_202509~202608.zip', downloadedAt: '2026-09-29T14:41:00+09:00' },
  ]));
  writeFileSync(join(dir, '48220_1282.zip'), makeZip([{ name: '통영시_향후 30일간 지역 집중률.csv', utf8Flag: true, deflate: true,
    data: `${BOM}기준연월,방문비율(%)\r\n20260930,50.5\r\n20260929,44.73\r\n` }]));
  writeFileSync(join(dir, '48220_1205.zip'), makeZip([
    { name: 'AI 관광 분석_방문자.csv', utf8Flag: true, data: `${BOM}x,y\r\n1,2\r\n` },
    { name: Buffer.concat([Buffer.from('AI_'), CP949_SIMILAR_WORD, Buffer.from('_202509~202608.csv')]), data: Buffer.concat([
      CP949_SIMILAR_CSV,
      Buffer.from('bcbcc1bec6afbab0c0dac4a1bdc32cb0e6bbf3b3b2b5b520c5ebbfb5bdc30d0a', 'hex'), // 세종특별자치시,경상남도 통영시
      Buffer.from('bfdcb0e8c1f62cb0e6bbf3b3b2b5b520c5ebbfb5bdc30d0a', 'hex'), // 외계지,경상남도 통영시
    ]) },
  ]));
  writeFileSync(join(dir, '48220_1211.zip'), makeZip([{ name: '인기관광지_전체_202509~202608.csv', utf8Flag: true,
    data: `${BOM}순위,관광지ID,관광지명,분류\r\n1,T1,통영중앙전통시장,시장\r\n2,T2,통영여객선터미널,교통시설\r\n` }]));
  writeFileSync(join(dir, '44180_1282.zip'), Buffer.from('broken'));
  return dir;
}

test('AC-11d~h createDownloadSource — 집중률·유사지역·인기관광지·기간·빈 값·깨진 zip', async () => {
  const src = createDownloadSource(makeFolder());
  const list = await src.regions.list();
  assert.equal(list.length, 4);
  assert.deepEqual(list[0], { code: '48220', name: '통영시', sido: '경상남도' });
  assert.deepEqual(await src.concentration.forecast('48220'), [{ date: '20260929', index: 44.73 }, { date: '20260930', index: 50.5 }]);
  assert.deepEqual(await src.concentration.forecast('28125'), []); // zip 없음 = 빈 값 지역
  await assert.rejects(() => src.concentration.forecast('44180'), /zip/);
  const sim = await src.similar.similar('48220');
  // 두 열 중 대상 지역(「경상남도 통영시」)이 아닌 쪽이 유사지역 — 실제 파일은 둘째 열이 유사지역
  assert.deepEqual(sim, [
    { code: '44180', name: '충청남도 보령시', similarity: null },
    { code: '36110', name: '세종특별자치시', similarity: null },
    { code: null, name: '외계지', similarity: null },
  ]);
  assert.deepEqual(await src.similar.similar('28125'), []);
  const top = await src.attractions.top('48220');
  assert.deepEqual(top[0], { rank: 1, name: '통영중앙전통시장', category: '시장' });
  assert.equal('searchCount' in top[0], false);
  assert.deepEqual(src.period(), { from: '202509', to: '202608' });
  const info = src.info();
  assert.equal(info.zips, 4);
  assert.equal(info.regions, 4);
  assert.equal(info.downloadedAt, '2026-09-29T14:41:00+09:00');
});

test('AC-17 레포에 데이터랩 조회 엔드포인트 호출 코드가 없다(src·public·.github)', () => {
  const walk = (d) => readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
  const files = [...walk('src'), ...walk('.github'), ...walk('public').filter((p) => p.endsWith('.js') || p.endsWith('.html'))];
  for (const f of files) {
    const s = readFileSync(f, 'utf8');
    assert.ok(!/getTempleteData|getSggCdMappingList|datalab\.visitkorea\.or\.kr\/visualize/.test(s), `${f}에 조회 엔드포인트`);
  }
});

test('AC-18 refreshRain — 같은 격자는 1회 조회, 실패 격자는 이전 값 유지', async () => {
  const snap = { meta: { failures: [] }, regions: {
    A: { code: 'A', grid: { nx: 1, ny: 1 }, rain: [{ date: '1', popMax: 0, rainy: false }] },
    B: { code: 'B', grid: { nx: 1, ny: 1 } },
    C: { code: 'C', grid: { nx: 2, ny: 2 }, rain: [{ date: 'old', popMax: 5, rainy: false }] },
    D: { code: 'D' },
  } };
  const calls = [];
  const weather = { daily: async (nx, ny) => { calls.push(`${nx},${ny}`); if (nx === 2) throw new Error('resultCode 22'); return [{ date: '2', popMax: 70, rainy: true }]; } };
  const out = await refreshRain(snap, weather, { base: { base_date: '20260930', base_time: '0500' } });
  assert.deepEqual(calls.sort(), ['1,1', '2,2']);
  assert.deepEqual(out.regions.A.rain, [{ date: '2', popMax: 70, rainy: true }]);
  assert.deepEqual(out.regions.B.rain, [{ date: '2', popMax: 70, rainy: true }]);
  assert.deepEqual(out.regions.C.rain, [{ date: 'old', popMax: 5, rainy: false }]);
  assert.equal(out.regions.D.rain, undefined);
  assert.ok(out.meta.failures.some((f) => f.code === 'C' && f.part === 'weather'));
  assert.deepEqual(out.meta.weatherBase, { base_date: '20260930', base_time: '0500' });
  assert.equal(snap.regions.A.rain[0].date, '1'); // 입력 불변
});
