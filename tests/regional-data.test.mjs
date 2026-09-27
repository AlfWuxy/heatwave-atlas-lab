import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const cases = [
  { id: 'chongqing2022', nx: 25, ny: 17, bounds: [103, 28, 109, 32], frames: 456, first: '2022-08-10T00:00:00Z', last: '2022-08-28T23:00:00Z' },
  { id: 'paris2019', nx: 25, ny: 21, bounds: [-1, 46, 5, 51], frames: 312, first: '2019-07-18T00:00:00Z', last: '2019-07-30T23:00:00Z' },
  { id: 'portland2021', nx: 25, ny: 21, bounds: [-125, 43, -119, 48], frames: 384, first: '2021-06-20T00:00:00Z', last: '2021-07-05T23:00:00Z' },
];
const available = cases.filter(({ id }) => existsSync(path.join(root, `public/data/regional-${id}.json`)));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('三个案例的区域数据均已完整交付，不能静默漏掉案例', () => {
  assert.equal(available.length, cases.length);
});

for (const expected of available) {
  const bytes = readFileSync(path.join(root, `public/data/regional-${expected.id}.json`));
  const data = JSON.parse(bytes);
  const manifest = JSON.parse(readFileSync(path.join(root, `data/regional/${expected.id}/manifest.json`)));

  test(`${expected.id}：完整规则网格、逐小时 UTC 和无缺失有限字段`, () => {
    assert.equal(data.schemaVersion, '1');
    assert.equal(data.caseId, expected.id);
    assert.equal(data.grid.nx, expected.nx);
    assert.equal(data.grid.ny, expected.ny);
    assert.equal(data.grid.crs, 'EPSG:4326');
    assert.equal(data.grid.order, 'south-to-north, west-to-east');
    assert.deepEqual([data.grid.lons[0], data.grid.lats[0], data.grid.lons.at(-1), data.grid.lats.at(-1)], expected.bounds);
    assert.equal(data.times.length, expected.frames);
    assert.equal(data.times[0], expected.first);
    assert.equal(data.times.at(-1), expected.last);
    assert.deepEqual(data.units, { temperature: '°C', wind: 'm/s' });
    for (let t = 1; t < data.times.length; t++) {
      assert.equal(Date.parse(data.times[t]) - Date.parse(data.times[t - 1]), 3_600_000);
    }
    for (const axis of [data.grid.lons, data.grid.lats]) {
      assert.equal(new Set(axis).size, axis.length);
      for (let i = 1; i < axis.length; i++) assert.equal(axis[i] - axis[i - 1], 0.25);
    }
    for (const field of ['temperature', 'u', 'v']) {
      assert.equal(data[field].length, expected.frames);
      for (const frame of data[field]) {
        assert.equal(frame.length, expected.nx * expected.ny);
        assert.ok(frame.every(Number.isFinite));
      }
    }
    assert.equal(data.validation.passed, true);
    assert.equal(data.validation.interpolationApplied, false);
    assert.equal(manifest.status, 'complete');
    assert.equal(manifest.artifact.sha256, hash(bytes));
    assert.equal(manifest.artifact.bytes, bytes.length);
    // 与已有曲线做独立交叉检查，防止地图接入了同名但时刻或位置不同的数据。
    const point = JSON.parse(readFileSync(path.join(root, `public/data/case-${expected.id}.json`)));
    const i = data.grid.lons.indexOf(point.gridLocation.longitude);
    const j = data.grid.lats.indexOf(point.gridLocation.latitude);
    assert.ok(i >= 0 && j >= 0);
    for (let t = 0; t < expected.frames; t++) {
      const k = j * expected.nx + i;
      assert.equal(Date.parse(data.times[t]), Date.parse(point.rows[t].time));
      assert.equal(data.temperature[t][k], point.rows[t].temperature_2m);
      assert.ok(Math.abs(Math.hypot(data.u[t][k], data.v[t][k]) - point.rows[t].wind_speed_10m) < 0.000001);
    }
  });

  test(`${expected.id}：原始响应哈希、坐标、温度和风向转换可逐值复核`, () => {
    const locations = [];
    for (const request of manifest.requests) {
      assert.ok(request.requestedGrid.length <= 25);
      const url = new URL(request.url);
      assert.equal(url.origin, 'https://archive-api.open-meteo.com');
      assert.equal(url.searchParams.get('models'), 'era5');
      assert.equal(url.searchParams.get('timezone'), 'UTC');
      assert.equal(url.searchParams.get('cell_selection'), 'nearest');
      assert.equal(url.searchParams.get('wind_speed_unit'), 'ms');
      assert.deepEqual(url.searchParams.get('elevation').split(','), request.requestedGrid.map(() => 'nan'));
      const rawBytes = readFileSync(path.join(root, request.path));
      assert.equal(hash(rawBytes), request.sha256);
      const raw = JSON.parse(rawBytes);
      assert.equal(raw.length, request.requestedGrid.length);
      for (let position = 0; position < raw.length; position++) {
        const point = raw[position];
        const requested = request.requestedGrid[position];
        assert.equal(point.longitude, requested.longitude);
        assert.equal(point.latitude, requested.latitude);
        assert.equal(point.utc_offset_seconds, 0);
        assert.deepEqual(point.hourly_units, {
          time: 'iso8601', temperature_2m: '°C', wind_speed_10m: 'm/s', wind_direction_10m: '°',
        });
        locations.push(point);
      }
    }
    assert.equal(locations.length, expected.nx * expected.ny);
    for (let index = 0; index < locations.length; index++) {
      const row = locations[index];
      assert.equal(row.longitude, data.grid.lons[index % expected.nx]);
      assert.equal(row.latitude, data.grid.lats[Math.floor(index / expected.nx)]);
      for (let t = 0; t < expected.frames; t++) {
        assert.equal(`${row.hourly.time[t]}:00Z`, data.times[t]);
        assert.equal(row.hourly.temperature_2m[t], data.temperature[t][index]);
        // 以原始来向复核东西、南北分量，容差只覆盖六位小数输出舍入。
        const angle = row.hourly.wind_direction_10m[t] * Math.PI / 180;
        const speed = row.hourly.wind_speed_10m[t];
        assert.ok(Math.abs(data.u[t][index] + speed * Math.sin(angle)) <= 0.00000051);
        assert.ok(Math.abs(data.v[t][index] + speed * Math.cos(angle)) <= 0.00000051);
        assert.ok(Math.abs(Math.hypot(data.u[t][index], data.v[t][index]) - speed) <= 0.00000072);
      }
    }
  });
}
