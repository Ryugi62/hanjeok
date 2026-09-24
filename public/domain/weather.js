// 기상청 단기예보 — 위경도 → LCC 격자 변환(기상청 공개 변환식)과 날짜별 강수 요약.
const RE = 6371.00877; // 지구 반경(km)
const GRID = 5.0; // 격자 간격(km)
const SLAT1 = 30.0;
const SLAT2 = 60.0;
const OLON = 126.0;
const OLAT = 38.0;
const XO = 43;
const YO = 136;

export function toGrid(lat, lon) {
  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;
  return {
    nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
    ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
  };
}

// items: 단기예보 item[] → [{date, popMax, rainy}] (날짜 오름차순)
export function summarizeRain(items) {
  const by = new Map();
  for (const it of items) {
    if (it.category !== 'POP' && it.category !== 'PTY') continue;
    const cur = by.get(it.fcstDate) || { date: it.fcstDate, popMax: 0, rainy: false };
    const v = Number(it.fcstValue);
    if (it.category === 'POP') cur.popMax = Math.max(cur.popMax, v);
    if (it.category === 'PTY' && v > 0) cur.rainy = true;
    by.set(it.fcstDate, cur);
  }
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date));
}
