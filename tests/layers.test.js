import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const importsOf = (dir) => readdirSync(dir).filter((f) => f.endsWith('.js')).flatMap((f) => {
  const src = readFileSync(join(dir, f), 'utf8');
  return [...src.matchAll(/^\s*import[^'"]*['"]([^'"]+)['"]/gm)].map((m) => ({ file: f, spec: m[1] }));
});

test('레이어 — domain은 domain만, application은 domain만 import (Clean Architecture)', () => {
  for (const { file, spec } of importsOf('src/domain')) {
    assert.ok(spec.startsWith('./'), `domain/${file} → ${spec}`);
  }
  for (const { file, spec } of importsOf('src/application')) {
    assert.ok(spec.startsWith('../domain/') || spec.startsWith('./'), `application/${file} → ${spec}`);
  }
  for (const { file, spec } of importsOf('src/adapters')) {
    assert.ok(!spec.includes('infrastructure') && !spec.includes('application'), `adapters/${file} → ${spec}`);
  }
});

test('레이어 — domain은 node:·fetch·document 같은 I/O를 모른다', () => {
  for (const f of readdirSync('src/domain')) {
    const src = readFileSync(join('src/domain', f), 'utf8');
    assert.ok(!/node:|fetch\(|document\.|window\./.test(src), `domain/${f}에 I/O`);
  }
});
