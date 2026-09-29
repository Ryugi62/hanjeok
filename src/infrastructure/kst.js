// 합성 루트 공용 — KST 현재 시각·기상청 키 로드(파일은 레포 밖).
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function kstNow() {
  const t = new Date(Date.now() + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  const ymd = `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}`;
  return { ymd, hhmm: `${p(t.getUTCHours())}${p(t.getUTCMinutes())}`, iso: `${t.toISOString().slice(0, 19)}+09:00` };
}

export function loadKmaKey() {
  if (process.env.KMA_SERVICE_KEY) return process.env.KMA_SERVICE_KEY;
  const f = join(homedir(), '.config/jarvis/env/datagokr.env');
  if (!existsSync(f)) return null;
  const m = readFileSync(f, 'utf8').match(/^KMA_SERVICE_KEY=(.+)$/m);
  return m ? m[1].trim() : null;
}
