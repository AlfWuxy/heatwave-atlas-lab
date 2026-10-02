import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateMechanismData, mechanismState, mechanismHash, previousRain, mechanismCSV, windPixelVelocity } from '../src/lib/europe-mechanism.ts';
const data = JSON.parse(readFileSync(new URL('../public/data/europe2019-mechanism.json', import.meta.url)));
test('机制页拒绝错误单位、不连续时刻与不完整数组', () => {
  assert.equal(validateMechanismData(data), true);
  for (const mutate of [d => d.units.temperatureC = 'K', d => d.sites[0].time[2] = d.sites[0].time[1], d => d.sites[0].soilMoisture.pop(), d => d.sites[0].temperatureC[1] = null]) {
    const copy = structuredClone(data); mutate(copy); assert.equal(validateMechanismData(copy), false);
  }
});
test('机制分享保留精确UTC、地点和土层，拒绝重复或过期时刻', () => {
  const site = data.sites[2];
  assert.deepEqual(mechanismState(mechanismHash(site, 78, true), data), { site: site.id, index: 78, deep: true, note: '' });
  for (const hash of ['#mechanism?site=paris&site=toulouse', '#mechanism?at=2020-01-01T00:00:00Z', '#mechanism?depth=unknown', '#mechanism?site=unknown']) assert.ok(mechanismState(hash, data).note);
});
test('24小时降雨只用24个完整前一小时量，CSV保持字段及单位次序', () => {
  const site = data.sites[0];
  assert.equal(previousRain(site, 22), null);
  assert.equal(previousRain(site, 23), site.precipitationMm.slice(0, 24).reduce((a,b) => a+b, 0));
  const rows = mechanismCSV(site).trim().split('\r\n');
  assert.equal(rows.length, 1465);
  const first = rows[1].split(',');
  assert.equal(first[0], site.time[0]); assert.equal(Number(first[3]), site.soilMoistureDeep[0]); assert.equal(Number(first[4]), site.precipitationMm[0]); assert.equal(Number(first[5]), site.shortwaveWm2[0]);
});
test('示意风使用同一像素尺度，北风向下、东风向左、45度两轴等幅', () => {
  const n = windPixelVelocity(2, 0), e = windPixelVelocity(2, 90), ne = windPixelVelocity(2, 45);
  assert.ok(Math.abs(n.x) < 1e-12); assert.equal(n.y, 16); assert.equal(e.x, -16); assert.ok(Math.abs(e.y) < 1e-12); assert.ok(Math.abs(ne.x + ne.y) < 1e-12);
});
