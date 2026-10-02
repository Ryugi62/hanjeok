// 색인용 정적 페이지 — 스냅샷만 읽는 순수 함수(docs/SPEC-growth-foundation.md).
// 빌드(infrastructure/buildPublic.js)가 이 결과를 public/r/<코드>/index.html·sitemap.xml·robots.txt로 쓴다.
import { formatKo } from '../domain/calendar.js';
import { levelOf } from '../domain/crowd.js';
import { regionOutlook, isPreparing } from './outlook.js';

export const SITE_URL = 'https://hanjeok-iota.vercel.app';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (Math.round(n * 10) / 10).toFixed(0);
const dayText = (d) => `${formatKo(d.date)} 집중률 ${fmt(d.index)}(${levelOf(d.index).label})`;

export function regionPage(snapshot, code, today) {
  const o = regionOutlook(snapshot, code, today);
  if (!o) return null;
  const { sido, name } = o.region;
  const place = `${sido} ${name}`;
  const title = `${place} 언제 덜 붐빌까 — 앞으로 30일 혼잡 예보 | 한적한 날`;
  const best = o.best30;
  const peak = o.peak30;
  const description = `${place}의 향후 30일 지역 집중률(한국관광 데이터랩). 가장 한적한 날 ${formatKo(best.date)}(${fmt(best.index)}), 가장 붐비는 날 ${formatKo(peak.date)}(${fmt(peak.index)}).`;
  const weekend = o.windows
    .map((w, i) => (w.quiet ? `<p>${i === 0 ? '이번' : '다음'} 주말 덜 붐비는 날: ${esc(dayText(w.quiet))}</p>` : ''))
    .join('');
  const others = [...o.alternatives, ...o.nearby]
    .map((a) => a.name)
    .filter((n, i, all) => n && all.indexOf(n) === i);
  const alt = others.length
    ? `<p>${esc(formatKo(o.alternativesDate))}에 더 한적한 비슷한·가까운 곳: ${others.map(esc).join(', ')}</p>`
    : '';
  const summaryHtml = [
    '<article class="prerender" id="prerender">',
    `<h2>${esc(place)} — 앞으로 30일 혼잡 예보</h2>`,
    `<p>한국관광 데이터랩 「향후 30일간 지역 집중률」(0~100, 낮을수록 한적)${o.baseDate ? ` · 데이터 기준일 ${esc(formatKo(o.baseDate))}` : ''}</p>`,
    `<p>가장 한적한 날: ${esc(dayText(best))}</p>`,
    `<p>가장 붐비는 날: ${esc(dayText(peak))}</p>`,
    weekend,
    alt,
    `<ul>${o.calendar.map((d) => `<li>${esc(dayText(d))}</li>`).join('')}</ul>`,
    '</article>',
  ].join('\n');
  return { code, path: `/r/${code}`, title, description, summaryHtml };
}

export function staticPages(snapshot, today) {
  if (isPreparing(snapshot)) return [];
  return Object.keys(snapshot.regions)
    .sort()
    .map((code) => regionPage(snapshot, code, today))
    .filter(Boolean);
}

function swap(html, re, replacement, what) {
  if (!re.test(html)) throw new Error(`템플릿에 ${what} 없음`);
  return html.replace(re, replacement);
}

export function renderRegionHtml(template, page) {
  const url = `${SITE_URL}${page.path}`;
  let html = template;
  html = swap(html, /<title>[^<]*<\/title>/, `<title>${esc(page.title)}</title>`, 'title');
  html = swap(html, /<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(page.description)}">`, 'description');
  html = swap(html, /<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(page.title)}">`, 'og:title');
  html = swap(html, /<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(page.description)}">`, 'og:description');
  html = swap(html, /<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`, 'og:url');
  html = swap(html, /<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`, 'canonical');
  html = swap(html, /(<p class="hint" id="hint">[^<]*<\/p>)/, `$1\n${page.summaryHtml}`, 'hint');
  return html;
}

export function sitemapXml(paths) {
  const urls = paths.map((p) => `  <url><loc>${SITE_URL}${p}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function robotsTxt() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;
}
