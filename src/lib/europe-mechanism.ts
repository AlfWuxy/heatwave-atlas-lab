export interface MechanismSite {
  id: string; name: string; latitude: number; longitude: number;
  gridLatitude: number; gridLongitude: number; timezone: string; time: string[];
  temperatureC: number[]; soilMoisture: number[]; soilMoistureDeep: number[];
  precipitationMm: number[]; shortwaveWm2: number[]; windSpeedMs: number[];
  windDirectionDeg: number[]; cloudCoverPct: number[];
}
export interface MechanismData {
  schemaVersion: number; id: string; title: string;
  period: { start: string; end: string; timeBasis: string };
  source: { name: string; url: string; documentationUrl: string; licenseUrl: string; model: string; retrievedAt?: string; attribution?: string };
  units: Record<string, string>; sites: MechanismSite[];
}
const fields = ['temperatureC', 'soilMoisture', 'soilMoistureDeep', 'precipitationMm', 'shortwaveWm2', 'windSpeedMs', 'windDirectionDeg', 'cloudCoverPct'] as const;

// 前端也核验数组和时间轴，避免错误文件生成看似连续的科学图。
export function validateMechanismData(value: unknown): value is MechanismData {
  if (!value || typeof value !== 'object') return false;
  const data = value as MechanismData;
  if (data.schemaVersion !== 1 || data.id !== 'europe2019-mechanism' || data.period?.timeBasis !== 'UTC' || !Array.isArray(data.sites) || data.sites.length !== 4) return false;
  const expectedUnits = { temperatureC: '°C', soilMoisture: 'm³/m³', soilMoistureDeep: 'm³/m³', precipitationMm: 'mm', shortwaveWm2: 'W/m²', windSpeedMs: 'm/s', windDirectionDeg: '°', cloudCoverPct: '%' };
  if (!data.source || !data.units || Object.entries(expectedUnits).some(([key, unit]) => data.units[key] !== unit)) return false;
  const identities = new Set<string>();
  for (const site of data.sites) {
    if (!site || typeof site.id !== 'string' || identities.has(site.id) || typeof site.name !== 'string' || !Number.isFinite(site.gridLatitude) || !Number.isFinite(site.gridLongitude)) return false;
    identities.add(site.id);
    if (!Array.isArray(site.time) || site.time.length !== 1464 || site.time[0] !== data.period.start || site.time.at(-1) !== data.period.end) return false;
    if (site.time.some((time, i) => typeof time !== 'string' || !time.endsWith('Z') || !Number.isFinite(Date.parse(time)) || (i > 0 && Date.parse(time) - Date.parse(site.time[i - 1]) !== 3_600_000))) return false;
    if (fields.some(field => !Array.isArray(site[field]) || site[field].length !== site.time.length || !site[field].every(Number.isFinite))) return false;
    if (site.soilMoisture.some(v => v < 0 || v > 1) || site.soilMoistureDeep.some(v => v < 0 || v > 1) || site.precipitationMm.some(v => v < 0) || site.windSpeedMs.some(v => v < 0) || site.cloudCoverPct.some(v => v < 0 || v > 100)) return false;
    try { new Intl.DateTimeFormat('en', { timeZone: site.timezone }); } catch { return false; }
  }
  return true;
}

export function mechanismState(hash: string, data: MechanismData) {
  const params = new URLSearchParams(hash.split('?')[1]);
  const defaultIndex = data.sites[0].time.indexOf('2019-07-25T14:00:00Z');
  const defaultState = { site: data.sites[0].id, index: Math.max(0, defaultIndex), deep: false, note: '' };
  if (hash.length > 1800 || ['site', 'at', 'depth'].some(key => params.getAll(key).length > 1)) return { ...defaultState, note: '分享参数无效，已恢复默认时刻。' };
  const site = data.sites.find(item => item.id === params.get('site')) ?? data.sites[0];
  const index = params.has('at') ? site.time.indexOf(params.get('at')!) : defaultState.index;
  const invalid = (params.has('site') && site.id !== params.get('site')) || index < 0 || (params.has('depth') && !['surface', 'deep'].includes(params.get('depth')!));
  return { site: site.id, index: index < 0 ? defaultState.index : index, deep: params.get('depth') === 'deep', note: invalid ? '部分分享参数不匹配，已使用可用地点或默认时刻。' : '' };
}

export function mechanismHash(site: MechanismSite, index: number, deep: boolean) {
  return `#mechanism?${new URLSearchParams({ site: site.id, at: site.time[index], depth: deep ? 'deep' : 'surface' })}`;
}

// 降水值代表此前一小时；24个完整值组成截至当前时刻的24小时累计。
export function previousRain(site: MechanismSite, index: number): number | null {
  return index < 23 ? null : site.precipitationMm.slice(index - 23, index + 1).reduce((sum, value) => sum + value, 0);
}

export function mechanismCSV(site: MechanismSite) {
  const header = ['time_utc', 'temperature_C', 'soil_water_0_7cm_m3_m3', 'soil_water_7_28cm_m3_m3', 'precipitation_previous_hour_mm', 'shortwave_previous_hour_W_m2', 'wind_10m_m_s', 'wind_from_deg', 'cloud_pct'];
  return [header.join(','), ...site.time.map((time, i) => [time, ...fields.map(field => site[field][i])].join(','))].join('\r\n') + '\r\n';
}

// 屏幕北向上，两轴用同一像素速度尺度，避免宽画布扭曲风向。
export function windPixelVelocity(speed: number, fromDegrees: number) {
  const angle = fromDegrees * Math.PI / 180;
  return { x: -Math.sin(angle) * speed * 8, y: Math.cos(angle) * speed * 8 };
}
