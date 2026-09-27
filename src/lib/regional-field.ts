/** 格点为真实经纬度节点；数组按从南到北、从西到东排列。 */
export type RegionalField = {
  nx: number;
  ny: number;
  lons: number[];
  lats: number[];
  temperature: number[] | Float32Array;
  u: number[] | Float32Array;
  v: number[] | Float32Array;
};

export type RegionalSample = { temperature: number; u: number; v: number };
export const EARTH_RADIUS_M = 6_371_008.8;
export const MAX_MERCATOR_LAT = 85.0511287798066;
export const REGIONAL_SECONDS_PER_DISPLAY_SECOND = 7_200;
export const REGIONAL_TEMPERATURE_STOPS = [12, 27, 42] as const;
const RAD = Math.PI / 180;

export function validateRegionalField(field: RegionalField): void {
  if (!Number.isInteger(field.nx) || !Number.isInteger(field.ny)
    || field.nx < 2 || field.ny < 2 || field.nx > 4096 || field.ny > 4096
    || field.lons.length !== field.nx || field.lats.length !== field.ny) {
    throw new RangeError('区域风温场的经纬度维度不完整。');
  }
  for (const axis of [field.lons, field.lats]) {
    if (axis.some((value, i) => !Number.isFinite(value) || (i > 0 && value <= axis[i - 1]))) {
      throw new RangeError('经纬度节点须为有限值，并且严格递增。');
    }
  }
  if (field.lons[0] < -180 || field.lons.at(-1)! > 180
    || field.lats[0] < -MAX_MERCATOR_LAT || field.lats.at(-1)! > MAX_MERCATOR_LAT) {
    throw new RangeError('区域须位于有效的 Web Mercator 范围内，并且不跨越日期变更线。');
  }
  for (const values of [field.temperature, field.u, field.v]) {
    if (values.length !== field.nx * field.ny || values.some(value => !Number.isFinite(value))) {
      throw new RangeError('温度和风分量须包含每个经纬度节点的有限数值。');
    }
  }
}

/** 来向使用气象约定：0° 北风向南吹，90° 东风向西吹；速度单位 m/s。 */
export function windFromDirectionToUV(speed: number, direction: number): { u: number; v: number } {
  if (!Number.isFinite(speed) || speed < 0 || !Number.isFinite(direction)) {
    throw new RangeError('风速须非负，风速和来向须为有限数值。');
  }
  return { u: -speed * Math.sin(direction * RAD), v: -speed * Math.cos(direction * RAD) };
}

function bracket(axis: number[], value: number): [number, number] {
  let lower = 0;
  let upper = axis.length - 1;
  while (upper - lower > 1) {
    const middle = (lower + upper) >> 1;
    if (axis[middle] <= value) lower = middle;
    else upper = middle;
  }
  return [lower, (value - axis[lower]) / (axis[lower + 1] - axis[lower])];
}

/** 双线性插值直接使用节点位置，允许不等距节点；域外不外推。 */
export function sampleRegionalField(field: RegionalField, lon: number, lat: number): RegionalSample | null {
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || lon < field.lons[0]
    || lon > field.lons[field.nx - 1] || lat < field.lats[0] || lat > field.lats[field.ny - 1]) return null;
  const [i, x] = bracket(field.lons, lon);
  const [j, y] = bracket(field.lats, lat);
  const index = j * field.nx + i;
  const interpolate = (values: number[] | Float32Array) => {
    const south = values[index] * (1 - x) + values[index + 1] * x;
    const north = values[index + field.nx] * (1 - x) + values[index + field.nx + 1] * x;
    return south * (1 - y) + north * y;
  };
  return { temperature: interpolate(field.temperature), u: interpolate(field.u), v: interpolate(field.v) };
}

/** 在球面近似下把东西/南北 m/s 转为经纬度位移；经度使用中点纬度的 cos 修正。 */
export function advectLonLat(lon: number, lat: number, u: number, v: number, seconds: number): [number, number] {
  if (![lon, lat, u, v, seconds].every(Number.isFinite) || Math.abs(lat) > MAX_MERCATOR_LAT) {
    throw new RangeError('经纬度与风速必须有效。');
  }
  const nextLat = lat + v * seconds / EARTH_RADIUS_M / RAD;
  if (Math.abs(nextLat) > MAX_MERCATOR_LAT) throw new RangeError('位移超出 Web Mercator 纬度范围。');
  const middleLat = (lat + nextLat) / 2;
  return [lon + u * seconds / (EARTH_RADIUS_M * Math.cos(middleLat * RAD)) / RAD, nextLat];
}

export function lonLatToMercator(lon: number, lat: number): [number, number] {
  if (![lon, lat].every(Number.isFinite) || Math.abs(lat) > MAX_MERCATOR_LAT) {
    throw new RangeError('无法投影此经纬度。');
  }
  return [(lon + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + lat * RAD / 2)) / Math.PI) / 2];
}

export function mercatorToLonLat(x: number, y: number): [number, number] {
  if (![x, y].every(Number.isFinite)) throw new RangeError('墨卡托坐标必须有效。');
  return [x * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) / RAD];
}

/** 色标使用摄氏度，12/27/42°C 为固定节点；超出端点的颜色饱和。 */
export function regionalTemperatureColor(temperature: number): [number, number, number] {
  const fraction = Math.min(1, Math.abs(temperature - 27) / 15);
  const neutral = [212, 222, 231];
  const endpoint = temperature < 27 ? [55, 157, 255] : [255, 77, 63];
  return neutral.map((value, index) => Math.round(value + (endpoint[index] - value) * fraction)) as [number, number, number];
}
