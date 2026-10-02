import test from 'node:test';
import assert from 'node:assert/strict';
import { availableLibraryCases, caseLibraryLabels, filterLibraryCases } from '../src/lib/case-library.ts';
import { mergeReplayCases } from '../src/lib/case-catalog.ts';

const original = { id: 'paris2019', cityId: 'paris', title: '西欧 · 2019', start: '2019-07-18', hours: 384, dataUrl: '/data/case-paris2019.json', csvUrl: '/data/case-paris2019.csv' };
const extended = { ...original, id: 'london2022', cityId: 'london', title: '伦敦 · 2022', start: '2022-07-10', name: '伦敦', country: '英国', continent: '欧洲', year: 2022 };
const expansion = { ...original, id: 'rome2023', cityId: 'rome', title: '2023 罗马热浪', start: '2023-07-10', name: '罗马', country: '意大利', continent: '欧洲', year: 2023 };
const asian = { ...original, id: 'tokyo2018', cityId: 'tokyo', title: '东京 · 2018', start: '2018-07-10' };
const all = [original, extended, expansion, asian];
const filter = overrides => filterLibraryCases(all, { query: '', year: 'all', continent: 'all', ...overrides }).map(item => item.id);

test('国家、城市和年份的多词搜索取交集，忽略大小写与多余空白', () => {
  assert.deepEqual(filter({ query: '  意大利   ROME  2023  ' }), ['rome2023']);
  assert.deepEqual(filter({ query: '法国 巴黎 2019' }), ['paris2019']);
  assert.deepEqual(filter({ query: '英国 罗马' }), []);
  assert.deepEqual(filter({ query: '   ' }), all.map(item => item.id));
});

test('地区与年份进一步收窄结果，不覆盖关键词约束', () => {
  assert.deepEqual(filter({ continent: '亚洲' }), ['tokyo2018']);
  assert.deepEqual(filter({ continent: '欧洲', year: '2022', query: '英国' }), ['london2022']);
  assert.deepEqual(filter({ continent: '欧洲', year: '2022', query: '巴黎' }), []);
  assert.deepEqual(filter({ continent: '非洲' }), []);
});

test('旧索引缺失地域时从回放名单补足，元数据存在时保留原值', () => {
  assert.deepEqual(caseLibraryLabels(original), { name: '巴黎', country: '法国', continent: '欧洲', year: '2019' });
  assert.deepEqual(caseLibraryLabels({ ...original, name: '巴黎周边', country: 'France', continent: '欧洲', year: 2019 }), { name: '巴黎周边', country: 'France', continent: '欧洲', year: '2019' });
});

test('仅可用整点资料进入三索引合并，未知ID及重复ID不增加数量', () => {
  const unavailable = [null, { ...original, hours: 0 }, { ...original, hours: NaN }, { ...original, hours: 1.5 }, { ...original, dataUrl: '' }, { ...original, csvUrl: '' }, { ...original, available: false }];
  assert.deepEqual(availableLibraryCases({ cases: unavailable }), []);
  assert.deepEqual(availableLibraryCases(null), []);
  assert.deepEqual(availableLibraryCases({}), []);
  const merged = mergeReplayCases(availableLibraryCases({ cases: [original] }), availableLibraryCases({ cases: [extended, { ...original, title: '不要覆盖原版' }] }), availableLibraryCases({ cases: [expansion, { ...original, id: 'unknown2024' }] }));
  assert.equal(merged.length, 3);
  assert.equal(merged.find(item => item.id === original.id).title, original.title);
  assert.ok(merged.some(item => item.id === 'rome2023'));
});
