// 빌드(합성 루트) — ① 브라우저가 import할 수 있게 domain과 application/outlook.js를 public/ 아래로 복사(단일 진실 = src/)
// ② 색인용 정적 지역 페이지 public/r/<코드>/index.html + sitemap.xml + robots.txt (docs/SPEC-growth-foundation.md).
import { cp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { kstNow } from './kst.js';
import { staticPages, renderRegionHtml, sitemapXml, robotsTxt } from '../application/seoPages.js';

await rm('public/domain', { recursive: true, force: true });
await rm('public/application', { recursive: true, force: true });
await cp('src/domain', 'public/domain', { recursive: true });
await mkdir('public/application', { recursive: true });
await cp('src/application/outlook.js', 'public/application/outlook.js');
console.log('public/domain + public/application/outlook.js 복사 완료');

const snapshot = JSON.parse(await readFile('public/data/snapshot.json', 'utf8'));
const template = await readFile('public/index.html', 'utf8');
let today = kstNow().ymd;
if (snapshot.meta && snapshot.meta.baseDate && snapshot.meta.baseDate > today) today = snapshot.meta.baseDate;
const pages = staticPages(snapshot, today);
await rm('public/r', { recursive: true, force: true });
for (const p of pages) {
  await mkdir(`public${p.path}`, { recursive: true });
  await writeFile(`public${p.path}/index.html`, renderRegionHtml(template, p));
}
await writeFile('public/sitemap.xml', sitemapXml(['/', ...pages.map((p) => p.path)]));
await writeFile('public/robots.txt', robotsTxt());
console.log(`정적 지역 페이지 ${pages.length}개 · sitemap URL ${pages.length + 1}개 · robots.txt`);
