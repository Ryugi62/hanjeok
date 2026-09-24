// 파일 읽기·쓰기 어댑터(합성 루트에서만 쓴다).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function writeJson(path, data, pretty = false) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, pretty ? JSON.stringify(data, null, 1) : JSON.stringify(data));
}

// 대표 좌표: tools/centroids.py 산출물 {code: {lat, lon, name}} → AnchorSource
export function createCentroidAnchor(centroids) {
  return {
    async anchor(code) {
      const c = centroids[code];
      return c ? { name: c.name, lat: c.lat, lon: c.lon } : null;
    },
  };
}
