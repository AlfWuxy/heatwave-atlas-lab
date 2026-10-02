import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { REPLAY_CASES, isReplayCaseId, mergeReplayCases } from '../src/lib/case-catalog.ts';
const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
test('路由名单与原3例及十地冻结目录完全一致，无重复', () => {
  const original = read('../public/data/cases.json').cases;
  const frozen = read('../data/extended-cases/catalog.json').cases;
  const expected = [...original, ...frozen].map(item => item.id).sort();
  assert.deepEqual(REPLAY_CASES.map(item => item.id).sort(), expected);
  assert.equal(new Set(expected).size, 13);
  for (const bad of [null, '../secret', 'unknown2025', 'london2022/extra', 'LONDON2022']) assert.equal(isReplayCaseId(bad), false);
});
test('索引合并保持冻结顺序，过滤未知id且不会把未下载案例当可用', () => {
  const result = mergeReplayCases([{ id: 'portland2021', value: 1 }], [{ id: 'london2022', value: 2 }, { id: 'portland2021', value: 99 }, { id: 'arbitrary2025' }]);
  assert.deepEqual(result, [{ id: 'portland2021', value: 1 }, { id: 'london2022', value: 2 }]);
  assert.deepEqual(mergeReplayCases(), []);
});
test('已经发布的扩展索引条目均对应正确案例数据与事件证据', () => {
  const index = read('../public/data/extended-cases.json');
  assert.ok(index.cases.length > 0 && index.cases.length <= 10);
  for (const meta of index.cases) {
    assert.ok(isReplayCaseId(meta.id));
    const data = read(`../public${meta.dataUrl}`);
    assert.equal(data.id, meta.id); assert.ok(data.rows.length > 0);
    assert.equal(data.summary, meta.summary); assert.ok(data.scopeNote.includes('人工'));
    assert.ok(data.eventEvidence.length > 0);
    for (const source of data.eventEvidence) assert.ok(source.url.startsWith('https://'));
  }
  if (index.status === 'complete') assert.equal(index.cases.length, 10);
});
