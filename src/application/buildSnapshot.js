// UC-1 스냅샷 수집 — 포트만 알고 I/O는 모른다. 지역 하나가 실패해도 나머지는 계속한다.
import { toGrid } from '../domain/weather.js';

const pickDay = (x) => ({ date: String(x.date), index: Number(x.index) });
const pickSimilar = (x) => ({ code: String(x.code), name: String(x.name), similarity: Math.round(Number(x.similarity) * 1000) / 1000 });
// 내비게이션 목적지 순위에는 터미널 같은 교통시설이 섞인다 — 가볼 곳 5개만 남긴다.
export const NON_SPOT = new Set(['교통시설']);
const pickAttraction = (x) => ({ rank: Number(x.rank), name: String(x.name), category: String(x.category || ''), searchCount: Number(x.searchCount) });

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function buildSnapshot(ports, opts) {
  const { today, attractionsYm, collectedAt, concurrency = 3, onProgress } = opts;
  const list = await ports.regions.list();
  const failures = [];
  const empty = [];
  const regions = {};
  const attempt = async (code, part, fn) => {
    try {
      return await fn();
    } catch (e) {
      failures.push({ code, part, error: String(e && e.message ? e.message : e).slice(0, 200) });
      return undefined;
    }
  };

  await mapLimit(list, concurrency, async (r, i) => {
    const raw = await attempt(r.code, 'concentration', () => ports.concentration.forecast(r.code));
    if (raw === undefined) return;
    if (raw.length === 0) {
      empty.push({ code: r.code, name: r.name, sido: r.sido });
      return;
    }
    const region = { code: r.code, name: r.name, sido: r.sido, days: raw.map(pickDay).sort((a, b) => a.date.localeCompare(b.date)) };
    const similar = await attempt(r.code, 'similar', () => ports.similar.similar(r.code));
    region.similar = (similar || []).map(pickSimilar);
    if (ports.attractions) {
      const top = await attempt(r.code, 'attractions', () => ports.attractions.top(r.code, attractionsYm));
      region.attractions = (top || []).map(pickAttraction).filter((a) => !NON_SPOT.has(a.category)).slice(0, 5);
    }
    if (ports.anchor) {
      const a = await attempt(r.code, 'anchor', () => ports.anchor.anchor(r.code));
      region.anchor = a ? { name: String(a.name), lat: Number(a.lat), lon: Number(a.lon) } : null;
      if (region.anchor) region.grid = toGrid(region.anchor.lat, region.anchor.lon);
    }
    if (ports.weather && region.grid) {
      const rain = await attempt(r.code, 'weather', () => ports.weather.daily(region.grid.nx, region.grid.ny));
      if (rain) region.rain = rain.map((x) => ({ date: String(x.date), popMax: Number(x.popMax), rainy: Boolean(x.rainy) }));
    }
    regions[r.code] = region;
    if (onProgress) onProgress(i + 1, list.length, r);
  });

  const firstDates = Object.values(regions).map((r) => r.days[0] && r.days[0].date).filter(Boolean).sort();
  return {
    meta: {
      service: 'hanjeok',
      collectedAt,
      today,
      baseDate: firstDates[0] || null,
      attractionsYm: attractionsYm || null,
      coverage: { withIndex: Object.keys(regions).length, listed: list.length },
      empty: empty.map((e) => e.code).sort(),
      emptyRegions: empty.sort((a, b) => a.code.localeCompare(b.code)),
      failures: failures.sort((a, b) => a.code.localeCompare(b.code) || a.part.localeCompare(b.part)),
      sources: [
        '한국관광 데이터랩 — 지역별 관광 현황 > 지역 집중률(향후 30일간 지역 집중률)',
        '한국관광 데이터랩 — AI 관광 분석 > 유사지역(내비게이션 검색 유형 유사도)',
        '한국관광 데이터랩 — 인기관광지 현황(내비게이션 검색건수)',
        '한국관광 데이터랩 — 중심관광지(대표 좌표)',
        '기상청 단기예보 조회서비스(공공데이터포털 15084084)',
      ],
    },
    regions,
  };
}
