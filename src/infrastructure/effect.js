// 스냅샷 → 기대효과 리포트(UC-5) 재계산. 사용: node src/infrastructure/effect.js [snapshot.json] [today]
import { effectReport } from '../application/effect.js';
import { readJson, writeJson } from '../adapters/fileStore.js';

const path = process.argv[2] || 'public/data/snapshot.json';
const snap = await readJson(path);
const today = process.argv[3] || snap.meta.today || snap.meta.baseDate;
const rep = effectReport(snap, today);
await writeJson(path.replace(/snapshot\.json$/, 'effect.json'), rep, true);
console.log(JSON.stringify(rep, null, 1));
