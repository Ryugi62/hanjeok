// 한국관광 데이터랩 공식 「데이터 다운로드」 파일 어댑터(회원 로그인 후 화면의 다운로드 버튼으로 받은 zip).
// 데이터랩 고지: 「공식 제공되는 다운로드 이외의 방법에 의한 무단 수집이 금지」 — 이 서비스는 네트워크를 쓰지 않고 이 파일만 읽는다.
// 폴더: <코드>_1282.zip(향후 30일간 지역 집중률) · <코드>_1205.zip(AI 관광 분석 — 유사지역) · <코드>_1211.zip(인기관광지) · regions.json · manifest.json
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';

export const CID = Object.freeze({ CONCENTRATION_30D: '1282', AI_ANALYSIS: '1205', POPULAR_SPOTS: '1211' });

const utf8 = new TextDecoder('utf-8', { fatal: true });
const cp949 = new TextDecoder('euc-kr');

// UTF-8(BOM 제거)로 읽히면 UTF-8, 아니면 CP949.
export function decodeText(buf) {
  let s;
  try { s = utf8.decode(buf); } catch { s = cp949.decode(buf); }
  return s.replace(/^﻿/, '');
}

// 최소 zip 리더 — 중앙 디렉터리 기준, stored(0)·deflate(8)만.
export function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip 형식이 아님(끝 레코드 없음)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let k = 0; k < count; k += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip 중앙 디렉터리 손상');
    const flag = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28);
    const xlen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const loc = buf.readUInt32LE(p + 42);
    const rawName = buf.subarray(p + 46, p + 46 + nlen);
    const name = flag & 0x0800 ? rawName.toString('utf8') : decodeText(rawName);
    p += 46 + nlen + xlen + clen;
    if (name.endsWith('/')) continue;
    if (buf.readUInt32LE(loc) !== 0x04034b50) throw new Error('zip 로컬 헤더 손상');
    const start = loc + 30 + buf.readUInt16LE(loc + 26) + buf.readUInt16LE(loc + 28);
    const body = buf.subarray(start, start + csize);
    let data;
    if (method === 0) data = Buffer.from(body);
    else if (method === 8) data = inflateRawSync(body);
    else throw new Error(`zip 압축 방식 ${method} 미지원`);
    out.push({ name, data });
  }
  return out;
}

// RFC 4180 수준 CSV → 헤더 키 객체 배열(빈 줄 무시).
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; } else if (c === '"') q = false; else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const lines = rows.filter((r) => r.some((x) => x.trim() !== ''));
  if (!lines.length) return [];
  const head = lines[0].map((h) => h.trim());
  return lines.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const PERIOD = /(20\d{4})\s*[~\-_]\s*(20\d{4})/;
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();

export function createDownloadSource(folder) {
  const regions = JSON.parse(readFileSync(join(folder, 'regions.json'), 'utf8'));
  const manifestPath = join(folder, 'manifest.json');
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : [];
  const files = Array.isArray(manifest) ? manifest : manifest.files || [];
  // 이름 → 코드: 「시도 시군구」 우선, 시도 단독(세종), 그다음 시도가 바뀐 지역(2026-07 통합)을 위한 유일한 시군구명.
  const byFull = new Map();
  const byShort = new Map();
  for (const r of regions) {
    byFull.set(norm(`${r.sido} ${r.name}`), r.code);
    if (r.name === r.sido) byFull.set(norm(r.name), r.code);
    const k = norm(r.name);
    byShort.set(k, byShort.has(k) ? null : r.code);
  }
  const codeOf = (name) => byFull.get(name) || byShort.get(name.split(' ').slice(1).join(' ')) || byShort.get(name) || null;
  const fullName = (code) => {
    const r = regions.find((x) => String(x.code) === String(code));
    return r ? norm(r.name === r.sido ? r.name : `${r.sido} ${r.name}`) : null;
  };
  const periods = new Map();

  function csvOf(code, cid, pattern) {
    const path = join(folder, `${code}_${cid}.zip`);
    if (!existsSync(path)) return null;
    const entries = readZip(readFileSync(path));
    const e = entries.find((x) => pattern.test(x.name));
    if (!e) return null;
    const m = e.name.match(PERIOD);
    if (m) periods.set(`${m[1]}~${m[2]}`, (periods.get(`${m[1]}~${m[2]}`) || 0) + 1);
    return parseCsv(decodeText(e.data));
  }

  return {
    regions: { list: async () => regions.map((r) => ({ code: String(r.code), name: String(r.name), sido: String(r.sido) })) },
    concentration: {
      async forecast(code) {
        const rows = csvOf(code, CID.CONCENTRATION_30D, /집중률.*\.csv$/) || [];
        return rows
          .map((r) => { const v = Object.values(r); return { date: String(v[0]), index: Number(v[1]) }; })
          .filter((d) => /^\d{8}$/.test(d.date) && Number.isFinite(d.index))
          .sort((a, b) => a.date.localeCompare(b.date));
      },
    },
    similar: {
      async similar(code) {
        const rows = csvOf(code, CID.AI_ANALYSIS, /유사지역.*\.csv$/) || [];
        const self = fullName(code);
        const out = [];
        for (const r of rows) {
          const [a, b] = Object.values(r).map(norm);
          const name = b && b !== self ? b : a;
          if (!name || name === self || out.some((x) => x.name === name)) continue;
          const c = codeOf(name);
          out.push({ code: c ? String(c) : null, name, similarity: null });
        }
        return out.slice(0, 3);
      },
    },
    attractions: {
      async top(code) {
        const rows = csvOf(code, CID.POPULAR_SPOTS, /인기관광지_?전체.*\.csv$/) || [];
        return rows.map((r) => ({ rank: Number(r['순위']), name: String(r['관광지명']), category: String(r['분류'] || '') }))
          .filter((a) => Number.isFinite(a.rank) && a.name);
      },
    },
    // 유사지역·인기관광지 파일 기간(가장 많이 나온 것). 파일명에 없으면 manifest 파일명에서.
    period() {
      let best = [...periods.entries()].sort((a, b) => b[1] - a[1])[0];
      if (!best) {
        const m = files.map((f) => String(f.filename || '').match(PERIOD)).find(Boolean);
        if (m) best = [`${m[1]}~${m[2]}`];
      }
      if (!best) return null;
      const [from, to] = best[0].split('~');
      return { from, to };
    },
    info() {
      const zips = readdirSync(folder).filter((f) => /^\d{5}_\d{4}\.zip$/.test(f)).length;
      const times = files.map((f) => f.downloadedAt).filter(Boolean).sort();
      return { zips, regions: regions.length, downloadedAt: times[times.length - 1] || null };
    },
  };
}
