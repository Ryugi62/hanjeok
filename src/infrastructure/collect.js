// 합성 루트 — 데이터랩·기상청 어댑터를 유스케이스에 꽂아 스냅샷을 만든다.
// 사용: KMA_SERVICE_KEY=... node src/infrastructure/collect.js   (키 없으면 날씨 없이 수집)
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { buildSnapshot } from '../application/buildSnapshot.js';
import { effectReport } from '../application/effect.js';
import { createDatalabClient, SIDO } from '../adapters/datalabHttp.js';
import { createKmaClient } from '../adapters/kmaHttp.js';
import { readJson, writeJson, createCentroidAnchor } from '../adapters/fileStore.js';
import { addDays } from '../domain/calendar.js';

function kstNow() {
  const t = new Date(Date.now() + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  const ymd = `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}`;
  return { ymd, hhmm: `${p(t.getUTCHours())}${p(t.getUTCMinutes())}`, iso: `${t.toISOString().slice(0, 19)}+09:00` };
}

function monthsBack(ymd, n) {
  let y = +ymd.slice(0, 4);
  let m = +ymd.slice(4, 6) - n;
  while (m <= 0) { m += 12; y -= 1; }
  return `${y}${String(m).padStart(2, '0')}`;
}

function loadKey() {
  if (process.env.KMA_SERVICE_KEY) return process.env.KMA_SERVICE_KEY;
  const f = join(homedir(), '.config/jarvis/env/datagokr.env');
  if (!existsSync(f)) return null;
  const m = readFileSync(f, 'utf8').match(/^KMA_SERVICE_KEY=(.+)$/m);
  return m ? m[1].trim() : null;
}

const EXTRA = [
  { code: '36110', name: '세종특별자치시', sido: '세종특별자치시' },
  { code: '41590', name: '화성시', sido: '경기도' },
];

async function main() {
  const now = kstNow();
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const datalab = createDatalabClient({ gapMs: 300 });
  let list = await datalab.regions(SIDO);
  for (const e of EXTRA) if (!list.some((r) => r.code === e.code)) list.push(e);
  if (only) list = list.filter((r) => only.includes(r.code));

  // 인기관광지 최신 월: 지난달부터 거꾸로 3개월까지 서울 종로구로 확인
  let ym = null;
  for (let k = 1; k <= 3 && !ym; k += 1) {
    const cand = monthsBack(now.ymd, k);
    const top = await datalab.top('11110', cand).catch(() => []);
    if (top.length) ym = cand;
  }

  const key = loadKey();
  const kma = key ? createKmaClient({ serviceKey: key, now, prevYmd: addDays(now.ymd, -1) }) : null;
  const centroids = await readJson('data/centroids.json');
  const ports = {
    regions: { list: async () => list },
    concentration: { forecast: (code) => datalab.forecast(code) },
    similar: { similar: (code) => datalab.similar(code, ym) },
    attractions: ym ? { top: (code) => datalab.top(code, ym) } : null,
    anchor: createCentroidAnchor(centroids),
    weather: kma,
  };
  const t0 = Date.now();
  const snap = await buildSnapshot(ports, {
    today: now.ymd,
    attractionsYm: ym,
    collectedAt: now.iso,
    concurrency: Number(process.env.CONCURRENCY || 3),
    onProgress: (i, n) => { if (i % 25 === 0 || i === n) process.stderr.write(`  ${i}/${n} ${Math.round((Date.now() - t0) / 1000)}s\n`); },
  });
  if (kma) snap.meta.weatherBase = kma.base;
  const effect = effectReport(snap, now.ymd);
  await writeJson(`data/raw/${now.ymd}/snapshot.json`, snap);
  await writeJson(`data/raw/${now.ymd}/effect.json`, effect, true);
  if (!only) {
    await writeJson('public/data/snapshot.json', snap);
    await writeJson('public/data/effect.json', effect);
  }
  const m = snap.meta;
  console.log(JSON.stringify({ today: now.ymd, baseDate: m.baseDate, attractionsYm: m.attractionsYm, coverage: m.coverage, empty: m.empty.length, failures: m.failures.length, weather: Boolean(kma), seconds: Math.round((Date.now() - t0) / 1000), effect: effect.windows }, null, 1));
  // 2026-09-24 실측: 데이터랩 집중률 제공 지역 225곳(광주·전남 통합지역·인천/화성 신설구는 빈 값). 급감하면 실패로 본다.
  if (!only && m.coverage.withIndex < 220) {
    console.error(`coverage ${m.coverage.withIndex} < 220`);
    process.exitCode = 2;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
