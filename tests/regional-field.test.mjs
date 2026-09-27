import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EARTH_RADIUS_M, REGIONAL_SECONDS_PER_DISPLAY_SECOND,
  advectLonLat, lonLatToMercator, mercatorToLonLat, regionalTemperatureColor,
  sampleRegionalField, validateRegionalField, windFromDirectionToUV,
} from '../src/lib/regional-field.ts';

const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`);
const fixture = {
  nx: 3, ny: 3, lons: [100, 102, 105], lats: [20, 21, 24],
  temperature: [20, 24, 30, 23, 27, 33, 32, 36, 42],
  u: [1, 3, 6, 1, 3, 6, 1, 3, 6], v: [0, 0, 0, 1, 1, 1, 4, 4, 4],
};

test('气象风来向转换：北风向南，东风向西，西南风向东北', () => {
  for (const [direction, u, v] of [[0, 0, -10], [90, -10, 0], [180, 0, 10], [270, 10, 0]]) {
    const wind = windFromDirectionToUV(10, direction);
    close(wind.u, u); close(wind.v, v);
  }
  const southwest = windFromDirectionToUV(10, 225);
  close(southwest.u, Math.sqrt(50)); close(southwest.v, Math.sqrt(50));
  assert.throws(() => windFromDirectionToUV(-1, 90), RangeError);
});

test('不等距经纬节点与边界原值准确，插值没有半格偏移', () => {
  validateRegionalField(fixture);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const sample = sampleRegionalField(fixture, fixture.lons[i], fixture.lats[j]);
    close(sample.temperature, fixture.temperature[j * 3 + i]);
    close(sample.u, fixture.u[j * 3 + i]); close(sample.v, fixture.v[j * 3 + i]);
  }
  const middle = sampleRegionalField(fixture, 103.5, 22.5);
  close(middle.temperature, 34.5); close(middle.u, 4.5); close(middle.v, 2.5);
  assert.deepEqual(sampleRegionalField(fixture, 101, 20.5), { temperature: 23.5, u: 2, v: 0.5 });
});

test('域外明确为空，不制造数据范围之外的温度或风', () => {
  for (const [lon, lat] of [[99.99, 22], [105.01, 22], [102, 19.99], [102, 24.01], [NaN, 22]]) {
    assert.equal(sampleRegionalField(fixture, lon, lat), null);
  }
});

test('球面东西风位移含 cos 纬度，固定压缩倍率有明确物理秒数', () => {
  const equator = advectLonLat(0, 0, 10, 0, 3600);
  const high = advectLonLat(0, 60, 10, 0, 3600);
  close(high[0], 2 * equator[0]); close(high[1], 60);
  close(equator[0] * Math.PI / 180 * EARTH_RADIUS_M, 36_000);
  assert.equal(REGIONAL_SECONDS_PER_DISPLAY_SECOND, 7200);
  close(advectLonLat(0, 0, 10, 0, REGIONAL_SECONDS_PER_DISPLAY_SECOND)[0] / equator[0], 2);
});

test('北向风令真实纬度升高而屏幕墨卡托 y 下降，高纬依然一致', () => {
  const initial = [104, 80];
  const next = advectLonLat(...initial, 0, 10, 3600);
  assert.ok(next[1] > initial[1]); close(next[0], initial[0]);
  assert.ok(lonLatToMercator(...next)[1] < lonLatToMercator(...initial)[1]);
  close((next[1] - initial[1]) * Math.PI / 180 * EARTH_RADIUS_M, 36_000, 1e-8);
  const southwest = advectLonLat(104, 30, -2, -4, 3600);
  assert.ok(southwest[0] < 104 && southwest[1] < 30);
});

test('真实纬度到墨卡托往返一致，不能用地图 y 线性代替纬度', () => {
  for (const position of [[0, 0], [104, 30], [-120, 60], [12, -60], [179, 80]]) {
    const result = mercatorToLonLat(...lonLatToMercator(...position));
    close(result[0], position[0]); close(result[1], position[1]);
  }
  const south = lonLatToMercator(0, 20)[1];
  const north = lonLatToMercator(0, 60)[1];
  assert.ok(Math.abs(mercatorToLonLat(0.5, (south + north) / 2)[1] - 40) > 2);
});

test('色标固定为摄氏度，端点饱和，不随每帧数据范围漂移', () => {
  assert.deepEqual(regionalTemperatureColor(12), [55, 157, 255]);
  assert.deepEqual(regionalTemperatureColor(27), [212, 222, 231]);
  assert.deepEqual(regionalTemperatureColor(42), [255, 77, 63]);
  assert.deepEqual(regionalTemperatureColor(-20), regionalTemperatureColor(12));
  assert.deepEqual(regionalTemperatureColor(60), regionalTemperatureColor(42));
});

test('数据维度、倒置经纬轴、缺测值和不可投影区域明确拒绝', () => {
  for (const invalid of [
    { ...fixture, nx: 2 }, { ...fixture, lats: [24, 21, 20] },
    { ...fixture, temperature: [...fixture.temperature.slice(0, -1), NaN] },
    { ...fixture, lons: [179, 181, 182] }, { ...fixture, lats: [84, 85, 86] },
  ]) assert.throws(() => validateRegionalField(invalid), RangeError);
  assert.throws(() => advectLonLat(0, 85, 0, 100, 86_400), RangeError);
});
