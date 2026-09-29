// 합성 루트 — 데이터랩 공식 「데이터 다운로드」 폴더 → public/data/snapshot.json·effect.json.
// 네트워크로 데이터랩을 조회하지 않는다(데이터랩 고지: 공식 다운로드 이외 방법의 수집 금지). 기상청 강수확률만 오픈API.
// 사용: node src/infrastructure/fromDownloads.js <다운로드 폴더> [오늘 YYYYMMDD]   (KMA_SERVICE_KEY 없으면 강수 제외)
import { basename, dirname } from 'node:path';
import { buildSnapshot } from '../application/buildSnapshot.js';
import { refreshRain } from '../application/refreshRain.js';
import { effectReport } from '../application/effect.js';
import { createDownloadSource } from '../adapters/datalabDownload.js';
import { createKmaClient } from '../adapters/kmaHttp.js';
import { readJson, writeJson, createCentroidAnchor } from '../adapters/fileStore.js';
import { addDays } from '../domain/calendar.js';
import { kstNow, loadKmaKey } from './kst.js';

const folder = process.argv[2];
if (!folder) { console.error('사용: node src/infrastructure/fromDownloads.js <다운로드 폴더> [YYYYMMDD]'); process.exit(64); }
const now = kstNow();
const today = process.argv[3] || now.ymd;
const dot = (ymd) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;

const src = createDownloadSource(folder);
const info = src.info();
const centroids = await readJson('data/centroids.json');
let snap = await buildSnapshot({
  regions: src.regions,
  concentration: src.concentration,
  similar: src.similar,
  attractions: src.attractions,
  anchor: createCentroidAnchor(centroids),
  weather: null,
}, { today, collectedAt: info.downloadedAt, concurrency: 4 });
const period = src.period();
const base = snap.meta.baseDate;
snap.meta.period = period;
snap.meta.download = {
  folder: `${basename(dirname(folder.replace(/\/$/, '')))}/${basename(folder.replace(/\/$/, ''))}`,
  files: info.zips,
  regions: info.regions,
  baseDate: base,
  downloadedAt: info.downloadedAt,
};
snap.meta.sources = [
  `한국관광 데이터랩 공식 데이터 다운로드(회원 로그인) · 기준일 ${base ? dot(base) : '미상'} — 향후 30일간 지역 집중률 · AI 관광 분석(유사지역) · 인기관광지${period ? `(${period.from.slice(0, 4)}.${period.from.slice(4)}~${period.to.slice(0, 4)}.${period.to.slice(4)})` : ''}`,
  '통계청 SGIS 행정경계(vuski/admdongkor 가공본, CC BY 4.0) — 시군구 대표점',
  '기상청 단기예보 조회서비스(공공데이터포털 15084084) — 강수확률',
];

const key = loadKmaKey();
if (key) {
  const kma = createKmaClient({ serviceKey: key, now, prevYmd: addDays(now.ymd, -1) });
  snap = await refreshRain(snap, kma, { base: kma.base });
}
const effect = effectReport(snap, today);
await writeJson('public/data/snapshot.json', snap);
await writeJson('public/data/effect.json', effect);
const m = snap.meta;
console.log(JSON.stringify({ today, baseDate: m.baseDate, period: m.period, download: m.download, coverage: m.coverage, empty: m.empty.length, failures: m.failures.length, weather: Boolean(key), unmappedSimilar: Object.values(snap.regions).flatMap((r) => r.similar.filter((s) => !s.code).map((s) => `${r.code}:${s.name}`)).slice(0, 20), effect: effect.windows }, null, 1));
if (m.coverage.withIndex < 220) { console.error(`coverage ${m.coverage.withIndex} < 220`); process.exitCode = 2; }
