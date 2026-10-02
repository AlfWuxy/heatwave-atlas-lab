import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { collectNights } from '../src/lib/night-observation.ts';
const fixture = (start, count = 13) => Array.from({ length: count }, (_, index) => ({ time: new Date(Date.parse(start) + index * 3600000).toISOString(), temperature: 30 - index }));
test('当地18到05统计12个采样，仅06端点完整才有降幅', () => {
  const samples = fixture('2021-06-25T10:00:00Z');
  const [night] = collectNights(samples, 'Asia/Shanghai');
  assert.equal(night.date, '2021-06-25'); assert.equal(night.samples.length, 12);
  assert.equal(night.minimum, 19); assert.equal(night.mean, 24.5); assert.equal(night.cooling, 12);
  assert.equal(collectNights(samples.slice(0, 12), 'Asia/Shanghai')[0].cooling, null);
  assert.equal(collectNights(samples.slice(0, 11), 'Asia/Shanghai').length, 0);
});
test('丢失小时、重复小时及NaN均不得成为完整夜晚', () => {
  const samples = fixture('2021-06-25T18:00:00Z');
  assert.equal(collectNights(samples.filter((_, i) => i !== 5), 'UTC').length, 0);
  assert.equal(collectNights(samples.map((sample, i) => i === 5 ? samples[4] : sample), 'UTC').length, 0);
  assert.equal(collectNights(samples.map((sample, i) => i === 5 ? { ...sample, temperature: NaN } : sample), 'UTC').length, 0);
});
test('夏令时跳时窗口不会冒充完整12小时', () => {
  assert.equal(collectNights(fixture('2021-03-14T02:00:00Z', 15), 'America/Los_Angeles').length, 0);
  assert.equal(collectNights(fixture('2021-11-07T01:00:00Z', 15), 'America/Los_Angeles').length, 0);
});
test('三个实际案例按当地夜晚计算，与UTC日切片分开', () => {
  for (const name of ['portland2021', 'paris2019', 'chongqing2022']) {
    const data = JSON.parse(fs.readFileSync(new URL(`../public/data/case-${name}.json`, import.meta.url)));
    const nights = collectNights(data.rows.map(row => ({ time: row.time, temperature: row.temperature_2m })), data.timezone);
    assert.ok(nights.length > 5);
    for (const night of nights) { assert.equal(night.samples.length, 12); assert.ok(night.minimum <= night.mean); }
  }
});
