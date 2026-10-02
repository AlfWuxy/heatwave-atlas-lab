import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { REPLAY_CASES } from '../src/lib/case-catalog.ts';
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
test('43个实际案例均有完整当地夜晚，半小时时区不会被丢弃', () => {
  for (const { id: name } of REPLAY_CASES) {
    const data = JSON.parse(fs.readFileSync(new URL(`../public/data/case-${name}.json`, import.meta.url)));
    const nights = collectNights(data.rows.map(row => ({ time: row.time, temperature: row.temperature_2m })), data.timezone);
    assert.ok(nights.length >= 10, `${name}: 应存在至少10个完整当地夜晚`);
    for (const night of nights) { assert.equal(night.samples.length, 12); assert.ok(night.minimum <= night.mean); }
  }
});

test('艾哈迈达巴德与阿德莱德保留当地半点的12个原始采样，不插值', () => {
  const cases = [
    ['Asia/Kolkata', '2024-05-20T13:00:00Z', '2024-05-20'],
    ['Australia/Adelaide', '2019-01-23T08:00:00Z', '2019-01-23'],
  ];
  for (const [timezone, start, date] of cases) {
    const samples = fixture(start);
    const [night] = collectNights(samples, timezone);
    assert.ok(night, timezone);
    assert.equal(night.date, date);
    assert.equal(night.startClock, '18:30');
    assert.equal(night.lastClock, '05:30');
    assert.equal(night.morningClock, '06:30');
    assert.deepEqual(night.samples, samples.slice(0, 12));
    assert.equal(night.minimum, 19);
    assert.equal(night.mean, 24.5);
    assert.equal(night.cooling, 12);
    assert.equal(night.endTime, samples[12].time);
    const [withoutMorning] = collectNights(samples.slice(0, 12), timezone);
    assert.equal(withoutMorning.cooling, null);
    assert.equal(withoutMorning.endTime, null);
    assert.equal(withoutMorning.morningClock, '06:30');
    assert.deepEqual(collectNights(samples.filter((_, index) => index !== 7), timezone), []);
  }
});

test('阿德莱德半小时时区在夏令时跳过或重复当地小时的夜晚拒绝统计', () => {
  assert.deepEqual(collectNights(fixture('2024-10-05T09:00:00Z', 15), 'Australia/Adelaide'), []);
  assert.deepEqual(collectNights(fixture('2024-04-06T08:00:00Z', 15), 'Australia/Adelaide'), []);
});
