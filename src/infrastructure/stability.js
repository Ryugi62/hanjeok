// data/raw/<날짜>/snapshot.json 누적 → 예측 안정성 리포트. 사용: node src/infrastructure/stability.js
import { readdirSync, existsSync } from 'node:fs';
import { forecastStability } from '../application/stability.js';
import { readJson, writeJson } from '../adapters/fileStore.js';

const dirs = readdirSync('data/raw').filter((d) => /^\d{8}$/.test(d) && existsSync(`data/raw/${d}/snapshot.json`)).sort();
const snaps = [];
for (const d of dirs) {
  const s = await readJson(`data/raw/${d}/snapshot.json`);
  s.meta.today = s.meta.today || d;
  snaps.push(s);
}
const rep = forecastStability(snaps);
await writeJson('public/data/stability.json', rep, true);
console.log(JSON.stringify(rep, null, 1));
