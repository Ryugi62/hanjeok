// 브라우저가 import할 수 있게 domain과 application/outlook.js를 public/ 아래로 복사한다(단일 진실 = src/).
import { cp, rm, mkdir } from 'node:fs/promises';

await rm('public/domain', { recursive: true, force: true });
await rm('public/application', { recursive: true, force: true });
await cp('src/domain', 'public/domain', { recursive: true });
await mkdir('public/application', { recursive: true });
await cp('src/application/outlook.js', 'public/application/outlook.js');
console.log('public/domain + public/application/outlook.js 복사 완료');
