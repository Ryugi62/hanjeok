// UC-6 강수확률만 갱신 — 스냅샷의 격자마다 기상청 예보를 1회 조회해 rain만 바꾼다(집중률·유사지역은 손대지 않는다).
export async function refreshRain(snapshot, weather, { base = null } = {}) {
  const out = structuredClone(snapshot);
  const byGrid = new Map();
  for (const r of Object.values(out.regions)) {
    if (!r.grid) continue;
    const k = `${r.grid.nx},${r.grid.ny}`;
    if (!byGrid.has(k)) byGrid.set(k, []);
    byGrid.get(k).push(r);
  }
  const failures = (out.meta.failures || []).filter((f) => f.part !== 'weather');
  for (const regions of byGrid.values()) {
    const { nx, ny } = regions[0].grid;
    try {
      const rain = await weather.daily(nx, ny);
      const clean = rain.map((x) => ({ date: String(x.date), popMax: Number(x.popMax), rainy: Boolean(x.rainy) }));
      for (const r of regions) r.rain = clean;
    } catch (e) {
      for (const r of regions) failures.push({ code: r.code, part: 'weather', error: String(e && e.message ? e.message : e).slice(0, 200) });
    }
  }
  out.meta.failures = failures.sort((a, b) => a.code.localeCompare(b.code) || a.part.localeCompare(b.part));
  if (base) out.meta.weatherBase = base;
  return out;
}
