// UI 어댑터 — 스냅샷 1개를 받아 유스케이스(regionOutlook·rankForDate)를 화면에 옮긴다.
import { regionOutlook, isPreparing, PREPARING_NOTE } from './application/outlook.js';
import { rankForDate, alternativesOn, nearbyAlternativesOn, NEARBY_KM } from './domain/compare.js';
import { formatKo, weekdayOf, addDays, WEEKDAY_KO } from './domain/calendar.js';
import { levelOf } from './domain/crowd.js';
import { vsUsual } from './domain/outlook.js';

const $ = (id) => document.getElementById(id);
const SHORT = {
  서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천', 광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산',
  세종특별자치시: '세종', 경기도: '경기', 강원특별자치도: '강원', 충청북도: '충북', 충청남도: '충남', 전북특별자치도: '전북', 전라남도: '전남',
  경상북도: '경북', 경상남도: '경남', 제주특별자치도: '제주', 전남광주통합특별시: '전남광주',
};
const short = (sido) => SHORT[sido] || sido;
const label = (r) => (r.name.startsWith(short(r.sido)) ? r.name : `${short(r.sido)} ${r.name}`);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (Math.round(n * 10) / 10).toFixed(0);
const lvClass = (idx) => `lv-${levelOf(idx).key}`;

function kstToday() {
  const t = new Date(Date.now() + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}`;
}

// 유사지역·인기관광지 분석 기간(공식 다운로드 파일명 기준).
const periodKo = () => {
  const p = snap && snap.meta.period;
  if (!p) return '최근 12개월';
  return `${p.from.slice(0, 4)}년 ${+p.from.slice(4)}월~${p.to.slice(0, 4)}년 ${+p.to.slice(4)}월`;
};

let snap = null;
let today = kstToday();
let current = null; // { code, outlook, selected }

async function load() {
  const res = await fetch('/data/snapshot.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`스냅샷을 불러오지 못했어요 (${res.status})`);
  snap = await res.json();
  if (isPreparing(snap)) {
    // 숫자 없이 중립 상태만 — 직접 받은 공식 다운로드 파일로 교체될 때까지.
    $('hint').textContent = PREPARING_NOTE;
    $('q').disabled = true;
    $('q').placeholder = '데이터 준비 중';
    $('tab-date').disabled = true;
    $('foot-meta').textContent = '데이터 준비 중 · 자료: 한국관광 데이터랩 공식 「데이터 다운로드」(직접 받은 파일로 교체 중)';
    snap = null;
    return;
  }
  // 스냅샷이 오늘보다 앞선 날짜로 시작하면(갱신 전 새벽) 기준일부터 보여준다.
  const first = snap.meta.baseDate;
  if (first && first > today) today = first;
  const regions = Object.values(snap.regions);
  const dl = snap.meta.download;
  $('foot-meta').textContent = `데이터 기준일 ${formatKo(snap.meta.baseDate)} · 지역 ${regions.length}곳 · 데이터랩 공식 다운로드${dl ? ` 파일 ${dl.files}개` : ''}${snap.meta.collectedAt ? ` (${snap.meta.collectedAt.slice(0, 10)})` : ''}`;
  initSearch(regions);
  initDateView(regions);
  route();
}

function route() {
  const m = location.pathname.match(/^\/r\/(\d{5})/) || location.search.match(/[?&]sgg=(\d{5})/);
  if (location.pathname.startsWith('/d/') || /[?&]view=date/.test(location.search)) return showTab('date');
  if (m && snap.regions[m[1]]) showRegion(m[1], false);
}

// ---------- 검색 ----------
function initSearch(regions) {
  const input = $('q');
  const list = $('suggest');
  const items = regions.map((r) => ({ code: r.code, text: label(r), hay: `${r.sido} ${short(r.sido)} ${r.name}`.replace(/\s+/g, '') }));
  const gaps = (snap.meta.emptyRegions || []).map((r) => ({ text: label(r), sido: r.sido, hay: `${r.sido} ${short(r.sido)} ${r.name}`.replace(/\s+/g, '') }));
  let active = -1;
  let shown = [];
  const render = () => {
    const v = input.value.replace(/\s+/g, '');
    if (!v) { list.hidden = true; return; }
    shown = items.filter((it) => it.hay.includes(v)).slice(0, 8);
    active = shown.length ? 0 : -1;
    const gapHits = gaps.filter((g) => g.hay.includes(v)).slice(0, 3);
    list.innerHTML = shown.map((it, i) => `<li role="option" data-code="${it.code}" aria-selected="${i === active}">${esc(it.text)}<span class="s-sido">${esc(snap.regions[it.code].sido)}</span></li>`).join('')
      + gapHits.map((g) => `<li aria-disabled="true">${esc(g.text)}<span class="s-sido">2026년 행정구역이 바뀌어 데이터랩 30일 집중률이 아직 없어요</span></li>`).join('')
      || '<li aria-disabled="true">찾는 시군구가 없어요. 시·군·구 이름으로 적어 주세요.</li>';
    list.hidden = false;
  };
  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (list.hidden || !shown.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length;
      [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(shown[active].code);
    } else if (e.key === 'Escape') list.hidden = true;
  });
  list.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-code]');
    if (li) pick(li.dataset.code);
  });
  const pick = (code) => {
    list.hidden = true;
    input.value = label(snap.regions[code]);
    input.blur();
    showRegion(code, true);
  };
}

// ---------- 지역 결과 ----------
function showRegion(code, push) {
  showTab('region', false);
  const o = regionOutlook(snap, code, today);
  if (!o) return;
  const r = snap.regions[code];
  if (push) history.pushState({ code }, '', `/r/${code}`);
  document.title = `${label(r)} — 한적한 날`;
  $('q').value = label(r);
  $('hint').hidden = true;
  const pre = $('prerender'); // 빌드 때 심은 색인용 정적 요약 — 화면이 그려지면 지운다(중복 표시 0).
  if (pre) pre.remove();
  $('result').hidden = false;
  // 첫 추천: 이번 주말 중 한적한 날(없으면 30일 최저)
  const w = o.windows[0];
  const pickDate = (w.quiet && w.quiet.date) || (o.best30 && o.best30.date);
  current = { code, outlook: o, selected: pickDate };
  renderTide();
  renderSelected();
  const b = o.best30;
  $('best30').textContent = b ? `30일 중 가장 한적한 날은 ${formatKo(b.date)}, 집중률 ${fmt(b.index)}(${levelOf(b.index).label})이에요.` : '';
  renderSpots(o);
  $('meta').textContent = `데이터 기준일 ${formatKo(snap.meta.baseDate)}. 인기관광지·유사지역은 ${periodKo()} 데이터랩 분석이에요.`;
  const url = `${location.origin}/embed.html?sgg=${code}`;
  $('embed-code').textContent = `<iframe src="${url}" title="${label(r)} 7일 혼잡 예보" width="100%" height="180" style="border:0" loading="lazy"></iframe>`;
  $('cta').hidden = false;
  window.scrollTo({ top: 0 });
}

function renderTide() {
  const { outlook } = current;
  const tide = $('tide');
  const axis = $('tide-axis');
  const n = outlook.calendar.length;
  tide.style.setProperty('--n', n);
  axis.style.setProperty('--n', n);
  tide.innerHTML = outlook.calendar.map((c) => {
    const we = c.weekday === 0 || c.weekday === 6;
    const rain = c.rain && c.rain.popMax >= 60 ? `<span class="rain" title="강수확률 ${c.rain.popMax}%">☂</span>` : '';
    return `<button class="col${we ? ' we' : ''}" role="option" data-date="${c.date}" aria-selected="${c.date === current.selected}" aria-label="${formatKo(c.date)} 집중률 ${fmt(c.index)} ${c.level.label}">${rain}<i class="bar ${c.level.key}" style="height:${Math.max(3, c.index)}%"></i></button>`;
  }).join('');
  axis.innerHTML = outlook.calendar.map((c, i) => {
    const we = c.weekday === 0 || c.weekday === 6;
    const show = i === 0 || c.weekday === 6 || c.date.endsWith('01');
    return `<span class="${we ? 'we' : ''}">${show ? (c.date.endsWith('01') && i ? `${+c.date.slice(4, 6)}/1` : +c.date.slice(6)) : ''}</span>`;
  }).join('');
  tide.onclick = (e) => {
    const col = e.target.closest('.col');
    if (!col) return;
    current.selected = col.dataset.date;
    [...tide.children].forEach((b) => b.setAttribute('aria-selected', String(b.dataset.date === current.selected)));
    renderSelected();
  };
}

function renderSelected() {
  const { code, outlook, selected } = current;
  const day = outlook.calendar.find((c) => c.date === selected);
  if (!day) return;
  const w = outlook.windows.find((x) => selected >= x.from && selected <= x.to);
  $('lead-when').textContent = `${label(snap.regions[code])}, ${formatKo(selected)}`;
  $('lead-num').textContent = fmt(day.index);
  $('lead-num').className = lvClass(day.index);
  let verdict = `${day.level.label}`;
  if (w && w.peak && w.quiet && w.peak.date !== w.quiet.date) {
    if (selected === w.quiet.date) verdict += ` — ${WEEKDAY_KO[weekdayOf(w.peak.date)]}요일보다 ${fmt(w.peak.index - w.quiet.index)} 낮아요`;
    else if (selected === w.peak.date) verdict += ` — ${WEEKDAY_KO[weekdayOf(w.quiet.date)]}요일이 ${fmt(w.peak.index - w.quiet.index)} 더 한적해요`;
  } else {
    const u = vsUsual(outlook.calendar, selected);
    if (u !== null) verdict += u <= -5 ? ` — 이 지역 평소보다 ${fmt(-u)} 낮아요` : u >= 5 ? ` — 이 지역 평소보다 ${fmt(u)} 높아요` : ' — 이 지역 평소 수준이에요';
  }
  if (day.rain) verdict += `, 강수확률 ${day.rain.popMax}%`;
  $('lead-verdict').textContent = verdict;
  $('lead-verdict').className = `lead-verdict ${lvClass(day.index)}`;
  renderAlts(code, selected, day.index);
  $('cta-btn').textContent = `${formatKo(selected)}로 캘린더에 넣기`;
  $('cta-btn').onclick = () => {
    downloadIcs(code, selected, day.index);
    // 방문일 결정 전환 집계: 쿠키 없는 페이지뷰로만 남긴다(/r/<코드>/saved). 개인 식별 정보 없음.
    history.pushState({ code }, '', `/r/${code}/saved`);
  };
}

function renderAlts(code, date, baseIndex) {
  const r = snap.regions[code];
  const sims = (r.similar || []).map((s) => {
    const t = snap.regions[s.code];
    const x = t && t.days.find((d) => d.date === date);
    return { ...s, region: t, index: x ? x.index : null };
  });
  const lower = new Set(alternativesOn(snap, code, date).map((a) => a.code));
  $('alt-title').textContent = `${formatKo(date)}, 비슷한 여행지`;
  $('alts').innerHTML = sims.length ? sims.map((s) => {
    if (!s.region || s.index === null) return `<li><span class="name">${esc(s.name)}<small>집중률 자료 없음</small></span></li>`;
    const diff = s.index - baseIndex;
    const note = lower.has(s.code) ? `<small class="lv-quiet">${fmt(-diff)} 더 한적</small>` : `<small>${diff === 0 ? '같음' : `${fmt(diff)} 더 붐빔`}</small>`;
    return `<li><a class="name" href="/r/${s.code}" data-code="${s.code}">${esc(label(s.region))}<small>데이터랩 유사지역</small></a><span class="val"><b class="${lvClass(s.index)}">${fmt(s.index)}</b>${note}</span></li>`;
  }).join('') : '<li><span class="name">유사지역 자료 없음<small>이번 공식 다운로드 파일에 이 지역 유사지역이 없어요</small></span></li>';
  const near = nearbyAlternativesOn(snap, code, date);
  $('near-title').textContent = `${formatKo(date)}, ${NEARBY_KM}km 안에서 더 한적한 곳`;
  $('nears').innerHTML = near.length
    ? near.map((n) => `<li><a class="name" href="/r/${n.code}" data-code="${n.code}">${esc(label(n))}<small>약 ${n.km}km</small></a><span class="val"><b class="${lvClass(n.index)}">${fmt(n.index)}</b><small class="lv-quiet">${fmt(n.drop)} 더 한적</small></span></li>`).join('')
    : `<li><span class="name">${NEARBY_KM}km 안에 이날 더 한적한 시군구가 없어요<small>날짜를 바꿔 보세요</small></span></li>`;
  $('nears').onclick = (e) => {
    const a = e.target.closest('a[data-code]');
    if (!a) return;
    e.preventDefault();
    showRegion(a.dataset.code, true);
  };
  $('alts').onclick = (e) => {
    const a = e.target.closest('a[data-code]');
    if (!a) return;
    e.preventDefault();
    showRegion(a.dataset.code, true);
  };
}

function renderSpots(o) {
  $('spot-block').hidden = !o.attractions.length;
  $('spot-sub').textContent = `데이터랩 인기관광지 순위(${periodKo()})예요. 붐비는 날엔 이런 곳부터 붐벼요.`;
  $('spots').innerHTML = o.attractions.map((a) => `<li><span class="name">${esc(a.name)}<small>${esc(a.category)}</small></span><span class="val"><small>${a.rank}위</small></span></li>`).join('');
}

function downloadIcs(code, date, index) {
  const r = snap.regions[code];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//hanjeok//KO', 'BEGIN:VEVENT',
    `UID:${code}-${date}@hanjeok`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${addDays(date, 1)}`,
    `SUMMARY:${label(r)} 여행 (한적한 날)`,
    `DESCRIPTION:데이터랩 향후 30일 지역 집중률 ${fmt(index)} (${levelOf(index).label}). 기준일 ${snap.meta.baseDate}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `hanjeok-${code}-${date}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- 날짜 보기 ----------
function initDateView(regions) {
  const chips = $('date-chips');
  const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i)).filter((d) => regions.some((r) => r.days.some((x) => x.date === d)));
  let date = dates.find((d) => weekdayOf(d) === 6) || dates[0];
  chips.innerHTML = dates.map((d) => `<button role="radio" data-date="${d}" aria-checked="${d === date}">${+d.slice(4, 6)}/${+d.slice(6)} ${WEEKDAY_KO[weekdayOf(d)]}</button>`).join('');
  const sidos = [...new Set(regions.map((r) => r.sido))];
  $('sido').innerHTML = '<option value="">전국</option>' + sidos.map((s) => `<option>${esc(s)}</option>`).join('');
  const render = () => {
    const sido = $('sido').value;
    const rows = rankForDate(snap, date, sido || undefined);
    $('rank-sub').textContent = `${formatKo(date)} ${sido || '전국'} ${rows.length}곳 중 한적한 순서예요. 누르면 그 지역 30일을 볼 수 있어요.`;
    $('rank').innerHTML = rows.slice(0, 30).map((x, i) => `<li data-code="${x.code}"><span class="name">${i + 1}. ${esc(label(x))}</span><span class="val"><b class="lv-${x.level.key}">${fmt(x.index)}</b><span class="meter"><i class="bar ${x.level.key}" style="width:${Math.max(3, x.index)}%"></i></span></span></li>`).join('');
  };
  chips.onclick = (e) => {
    const b = e.target.closest('button[data-date]');
    if (!b) return;
    date = b.dataset.date;
    [...chips.children].forEach((c) => c.setAttribute('aria-checked', String(c.dataset.date === date)));
    render();
  };
  $('sido').onchange = render;
  $('rank').onclick = (e) => {
    const li = e.target.closest('li[data-code]');
    if (li) showRegion(li.dataset.code, true);
  };
  render();
}

function showTab(which, push = true) {
  const isRegion = which === 'region';
  $('tab-region').setAttribute('aria-selected', String(isRegion));
  $('tab-date').setAttribute('aria-selected', String(!isRegion));
  $('view-region').hidden = !isRegion;
  $('view-date').hidden = isRegion;
  $('cta').hidden = !isRegion || $('result').hidden;
  if (push && !isRegion && location.pathname !== '/d/') history.pushState({ view: 'date' }, '', '/d/');
}

$('tab-region').onclick = () => { showTab('region', false); if (current) history.pushState({ code: current.code }, '', `/r/${current.code}`); else history.pushState({}, '', '/'); };
$('tab-date').onclick = () => showTab('date');
$('copy-embed').onclick = async () => {
  try { await navigator.clipboard.writeText($('embed-code').textContent); $('copy-embed').textContent = '복사했어요'; } catch { $('copy-embed').textContent = '길게 눌러 복사해 주세요'; }
};
window.addEventListener('popstate', () => { if (snap) route(); });

// 쿠키 없는 방문 집계(Vercel Web Analytics) — 배포 도메인에서만 불러온다.
if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  window.va = window.va || function va() { (window.vaq = window.vaq || []).push(arguments); };
  const s = document.createElement('script');
  s.defer = true;
  s.src = '/_vercel/insights/script.js';
  document.head.appendChild(s);
}

load().catch((e) => {
  $('hint').textContent = `${e.message}. 잠시 뒤 새로고침해 주세요.`;
});
