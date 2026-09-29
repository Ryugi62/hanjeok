// 임베드 위젯 — 지자체 누리집 iframe용 7일 띠(UC-4).
import { embedStrip } from './application/outlook.js';
import { formatKo, WEEKDAY_KO, weekdayOf } from './domain/calendar.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const t = new Date(Date.now() + 9 * 3600 * 1000);
const p = (n) => String(n).padStart(2, '0');
let today = `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}`;
const code = (location.search.match(/[?&]sgg=(\d{5})/) || [])[1];
const w = document.getElementById('w');

fetch('/data/snapshot.json', { cache: 'no-cache' }).then((r) => r.json()).then((snap) => {
  if (snap.meta.baseDate > today) today = snap.meta.baseDate;
  const e = code && embedStrip(snap, code, today);
  if (!e || !e.days.length) { w.innerHTML = '<p class="s">이 지역의 집중률 자료가 없어요.</p>'; return; }
  const name = e.region.name;
  w.innerHTML = `<div class="h"><b>${esc(name)} 7일 혼잡 예보</b><a href="/r/${code}" target="_blank" rel="noopener">한적한 날에서 30일 보기</a></div>
  <div class="strip">${e.days.map((d) => `<div class="d${e.best && d.date === e.best.date ? ' best' : ''}"><div class="bx ${d.level.key}" title="${d.level.label}">${Math.round(d.index)}</div>${+d.date.slice(6)}일 ${WEEKDAY_KO[weekdayOf(d.date)]}</div>`).join('')}</div>
  <p class="s">${e.best ? `이번 7일 중 ${formatKo(e.best.date)}이 가장 한적해요.` : ''} 자료: 한국관광 데이터랩 공식 다운로드 「향후 30일간 지역 집중률」(0~100, 40 미만 여유·70 이상 붐빔).</p>`;
}).catch(() => { w.innerHTML = '<p class="s">예보를 불러오지 못했어요.</p>'; });
