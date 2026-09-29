// 합성 루트 — 스냅샷의 강수확률만 기상청 오픈API로 갱신(UC-6). 데이터랩은 호출하지 않는다.
// 사용: KMA_SERVICE_KEY=... node src/infrastructure/refreshWeather.js
import { refreshRain } from '../application/refreshRain.js';
import { createKmaClient } from '../adapters/kmaHttp.js';
import { readJson, writeJson } from '../adapters/fileStore.js';
import { addDays } from '../domain/calendar.js';
import { kstNow, loadKmaKey } from './kst.js';

const key = loadKmaKey();
if (!key) { console.error('KMA_SERVICE_KEY 없음 — 갱신하지 않음'); process.exit(0); }
const now = kstNow();
const path = 'public/data/snapshot.json';
const snap = await readJson(path);
const kma = createKmaClient({ serviceKey: key, now, prevYmd: addDays(now.ymd, -1) });
const out = await refreshRain(snap, kma, { base: kma.base });
await writeJson(path, out);
const weatherFails = out.meta.failures.filter((f) => f.part === 'weather').length;
console.log(JSON.stringify({ weatherBase: out.meta.weatherBase, weatherFailures: weatherFails }));
