// 로컬 검증용 정적 서버 — vercel.json의 rewrites(/r/:code, /d/)를 흉내 낸다. 127.0.0.1에만 바인딩.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const port = Number(process.argv[2] || 4173);
// 검증 스크립트용: 세 번째 인자(초)가 있으면 그 시간 뒤 스스로 끝난다(손으로 프로세스를 끝내지 않게).
const ttl = Number(process.argv[3] || 0);
if (ttl > 0) setTimeout(() => process.exit(0), ttl * 1000).unref();
createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (/^\/r\/\d{5}(\/saved)?\/?$/.test(p) || /^\/d\/?$/.test(p) || p === '/') p = '/index.html';
  const file = normalize(join('public', p));
  if (!file.startsWith('public')) { res.writeHead(403); res.end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}`));
