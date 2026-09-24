// 기상청 단기예보 조회서비스 어댑터. 인증키는 호출자가 넘긴다(코드·레포에 없음).
import { summarizeRain } from '../domain/weather.js';

const URL_BASE = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';
const BASE_TIMES = ['0200', '0500', '0800', '1100', '1400', '1700', '2000', '2300'];

// 발표시각 +10분 이후에 조회 가능. now = {ymd:'YYYYMMDD', hhmm:'HHMM'}(KST), prevYmd = 전날.
export function baseDateTime(now, prevYmd) {
  const cur = Number(now.hhmm);
  let pick = null;
  for (const bt of BASE_TIMES) if (cur >= Number(bt) + 10) pick = bt;
  if (pick === null) return { base_date: prevYmd, base_time: '2300' };
  return { base_date: now.ymd, base_time: pick };
}

export function createKmaClient({ serviceKey, fetchImpl = globalThis.fetch, now, prevYmd, timeoutMs = 30000 }) {
  if (!serviceKey) throw new Error('KMA_SERVICE_KEY 없음');
  const { base_date, base_time } = baseDateTime(now, prevYmd);
  return {
    base: { base_date, base_time },
    async daily(nx, ny) {
      const q = new URLSearchParams({ pageNo: '1', numOfRows: '1000', dataType: 'JSON', base_date, base_time, nx: String(nx), ny: String(ny) });
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const res = await fetchImpl(`${URL_BASE}?serviceKey=${serviceKey}&${q}`, { signal: ctl.signal });
        if (!res.ok) throw new Error(`KMA HTTP ${res.status}`);
        const json = await res.json();
        const h = json && json.response && json.response.header;
        if (!h || h.resultCode !== '00') throw new Error(`KMA resultCode ${h ? h.resultCode : '?'} ${h ? h.resultMsg : ''}`);
        return summarizeRain(json.response.body.items.item || []);
      } finally {
        clearTimeout(t);
      }
    },
  };
}
