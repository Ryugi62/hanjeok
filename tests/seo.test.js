import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { preparingSnapshot } from '../src/application/outlook.js';
import { SITE_URL, staticPages, renderRegionHtml, sitemapXml, robotsTxt } from '../src/application/seoPages.js';

// docs/SPEC-growth-foundation.md — AC-1~5
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const days = (from, n, f) => Array.from({ length: n }, (_, i) => {
  const d = new Date(Date.UTC(+from.slice(0, 4), +from.slice(4, 6) - 1, +from.slice(6, 8) + i));
  const p = (x) => String(x).padStart(2, '0');
  return { date: `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}`, index: f(i) };
});

const fixture = {
  meta: { baseDate: '20261001', status: 'ok' },
  regions: {
    '48220': { code: '48220', name: '통영<시>', sido: '경상남도', days: days('20261001', 30, (i) => (i === 7 ? 5.5 : i === 2 ? 95 : 50)) },
    '11110': { code: '11110', name: '종로구', sido: '서울특별시', days: [] },
  },
};

test('AC-1 준비 중이면 지역 페이지 0개, sitemap은 홈 1개', () => {
  assert.deepEqual(staticPages(preparingSnapshot('2026-09-29T16:20:00+09:00'), '20261002'), []);
  assert.deepEqual(locs(sitemapXml(['/'])), [`${SITE_URL}/`]);
});

test('AC-2 값이 있는 지역만 페이지가 되고 본문에 숫자·날짜가 있다', () => {
  const pages = staticPages(fixture, '20261002');
  assert.equal(pages.length, 1);
  const [p] = pages;
  assert.equal(p.path, '/r/48220');
  assert.match(p.title, /경상남도/);
  assert.match(p.title, /통영<시>/);
  assert.match(p.summaryHtml, /10월 8일\(목\)/); // 30일 중 가장 한적한 날(i=7)
  assert.match(p.summaryHtml, /6\b/); // 5.5 → 반올림 표기
  assert.equal((p.summaryHtml.match(/<li>/g) || []).length, 29); // 10/2~10/30 미래 29일
  assert.ok(!p.summaryHtml.includes('통영<시>'), '이스케이프 안 됨');
});

test('AC-3 정적 HTML — title·description·canonical·og:url·prerender', () => {
  const template = readFileSync('public/index.html', 'utf8');
  const [p] = staticPages(fixture, '20261002');
  const html = renderRegionHtml(template, p);
  const canon = html.match(/<link rel="canonical" href="([^"]+)">/g) || [];
  assert.equal(canon.length, 1);
  assert.ok(canon[0].includes(`${SITE_URL}/r/48220`));
  assert.equal((html.match(/property="og:url"/g) || []).length, 1);
  assert.ok(html.includes(`content="${SITE_URL}/r/48220"`));
  assert.ok(html.includes('<title>경상남도 통영&lt;시&gt;'));
  assert.ok(html.includes('id="prerender"'));
  assert.ok(!html.includes('통영<시>'));
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.equal((html.match(/name="description"/g) || []).length, 1);
});

test('AC-4 robots.txt — 전체 허용 + sitemap 절대 URL', () => {
  const r = robotsTxt();
  assert.match(r, /^User-agent: \*$/m);
  assert.match(r, /^Allow: \/$/m);
  assert.ok(r.includes(`Sitemap: ${SITE_URL}/sitemap.xml`));
});

test('AC-5 배포본 — sitemap·robots·홈 canonical·분석·prerender 제거', () => {
  assert.deepEqual(locs(readFileSync('public/sitemap.xml', 'utf8')), [`${SITE_URL}/`]);
  assert.equal(readFileSync('public/robots.txt', 'utf8'), robotsTxt());
  const index = readFileSync('public/index.html', 'utf8');
  assert.ok(index.includes(`<link rel="canonical" href="${SITE_URL}/">`));
  assert.ok(index.includes(`<meta property="og:url" content="${SITE_URL}/">`));
  assert.match(index, /<html lang="ko">/);
  const app = readFileSync('public/app.js', 'utf8');
  assert.ok(app.includes("'/_vercel/insights/script.js'"));
  assert.match(app, /prerender/);
});

test('AC-6 home head carries Google + Naver site verification once each', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const head = html.slice(0, html.indexOf('</head>'));
  const g = head.match(/<meta name="google-site-verification" content="([^"]+)">/g) || [];
  const n = head.match(/<meta name="naver-site-verification" content="([^"]+)">/g) || [];
  assert.deepEqual(g, ['<meta name="google-site-verification" content="vWRJGzCH_5XZF_hLdesHlikDxHZeJOmWcCKiOPM5_Uo">']);
  assert.deepEqual(n, ['<meta name="naver-site-verification" content="d58a87cedf2423949e97524436d874b2d4bba3db">']);
});
