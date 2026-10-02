import { isReplayCaseId } from './case-catalog.ts';
export type ReplayPoint = { lon: number; lat: number };
export type ReplayState = { position: number; a: number; b: number; compare: boolean; side: 'A' | 'B'; localTime: boolean; temperature: boolean; wind: boolean; point: ReplayPoint; warnings: string[] };

const KEYS = ['v', 'case', 'at', 'a', 'b', 'cmp', 'side', 'clock', 'temp', 'wind', 'lon', 'lat'];
export function parseReplayState(hash: string, caseId: string, times: string[], peakTime: string, point: ReplayPoint): ReplayState {
  const peak = Math.max(0, times.indexOf(peakTime));
  const state: ReplayState = { position: peak, a: Math.max(0, peak - 24), b: peak, compare: false, side: 'B', localTime: false, temperature: true, wind: true, point, warnings: [] };
  if (hash.length > 2048) { state.warnings.push('分享参数过长，已恢复默认回放。'); return state; }
  const params = new URLSearchParams(hash.split('?')[1] ?? '');
  const warn = (key: string) => state.warnings.push(`分享参数 ${key} 无效，已使用默认值。`);
  if (KEYS.some(key => params.getAll(key).length > 1)) { state.warnings.push('分享链接含重复参数，已恢复默认回放。'); return state; }
  if ((params.has('v') && params.get('v') !== '1') || (params.has('case') && (params.get('case') !== caseId || !isReplayCaseId(params.get('case'))))) { state.warnings.push('分享链接的版本或案例不匹配，已恢复默认回放。'); return state; }
  for (const [key, field] of [['at', 'position'], ['a', 'a'], ['b', 'b']] as const) {
    if (!params.has(key)) continue;
    const raw = params.get(key)!;
    const index = /^\d{4}-\d{2}-\d{2}T\d{2}:00(?::00(?:\.000)?)?Z$/.test(raw) ? times.findIndex(time => Date.parse(time) === Date.parse(raw) && new Date(time).toISOString().slice(0, 16) === raw.slice(0, 16)) : -1;
    if (index < 0) warn(key); else state[field] = index;
  }
  for (const [key, field] of [['cmp', 'compare'], ['temp', 'temperature'], ['wind', 'wind']] as const) {
    if (!params.has(key)) continue;
    if (!['0', '1'].includes(params.get(key)!)) warn(key); else state[field] = params.get(key) === '1';
  }
  if (params.has('side')) { if (!['A', 'B'].includes(params.get('side')!)) warn('side'); else state.side = params.get('side') as 'A' | 'B'; }
  if (params.has('clock')) { if (!['utc', 'local'].includes(params.get('clock')!)) warn('clock'); else state.localTime = params.get('clock') === 'local'; }
  if (params.has('lon') || params.has('lat')) {
    const lonText = params.get('lon'), latText = params.get('lat');
    const lon = Number(lonText), lat = Number(latText);
    if (!lonText?.trim() || !latText?.trim() || !Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) warn('lon/lat'); else state.point = { lon, lat };
  }
  if (state.compare) {
    const active = state.side === 'A' ? state.a : state.b;
    if (params.has('at') && state.position !== active) state.warnings.push('分享时刻与A/B所选侧不一致，已按A/B所选侧显示。');
    state.position = active;
  }
  return state;
}
// 仅保存白名单状态；播放状态不进入链接，接收者始终从暂停画面开始。
export function serializeReplayState(caseId: string, times: string[], state: ReplayState): string {
  if (!Number.isFinite(state.point.lon) || !Number.isFinite(state.point.lat) || Math.abs(state.point.lon) > 180 || Math.abs(state.point.lat) > 90) throw new Error('不能分享无效格点坐标。');
  if (!isReplayCaseId(caseId) || [state.position, state.a, state.b].some(index => !Number.isInteger(index) || index < 0 || index >= times.length)) throw new Error('不能分享无效回放时刻。');
  const params = new URLSearchParams({ v: '1', case: caseId, at: new Date(times[state.position]).toISOString(), a: new Date(times[state.a]).toISOString(), b: new Date(times[state.b]).toISOString(), cmp: state.compare ? '1' : '0', side: state.side, clock: state.localTime ? 'local' : 'utc', temp: state.temperature ? '1' : '0', wind: state.wind ? '1' : '0', lon: String(state.point.lon), lat: String(state.point.lat) });
  return `#replay?${params}`;
}
export function snapReplayPoint(point: ReplayPoint, lons: number[], lats: number[]): ReplayPoint | null {
  if (!Number.isFinite(point.lon) || !Number.isFinite(point.lat) || point.lon < lons[0] || point.lon > lons.at(-1)! || point.lat < lats[0] || point.lat > lats.at(-1)!) return null;
  const closest = (axis: number[], value: number) => axis.reduce((best, next) => Math.abs(next - value) < Math.abs(best - value) ? next : best);
  return { lon: closest(lons, point.lon), lat: closest(lats, point.lat) };
}
