import { useEffect, useState } from 'react';

export interface Location { latitude: number; longitude: number; elevation?: number }
export interface Source { label: string; datasetUrl: string; documentationUrl: string; provider: string }
export interface CaseMeta {
  id: string; cityId: string; title: string; start: string; end: string; hours: number;
  peakTemperature: number; peakTime: string; timezone: string; dataUrl: string; csvUrl: string;
  requestedLocation: Location; gridLocation: Location; source: Source; retrievedAt: string; caveat: string;
}
export interface HourRow {
  time: string; temperature_2m: number; relative_humidity_2m: number; pressure_msl: number;
  cloud_cover: number; shortwave_radiation: number; wind_speed_10m: number;
  wind_direction_10m: number; soil_moisture_0_to_7cm: number; precipitation: number;
}
export interface CaseData extends CaseMeta { rows: HourRow[]; units: Record<string, string> }
export interface AnnualRow {
  year: number; days: number; maxTmax: number; maxTmaxDate: string; minTmin: number;
  meanTmax: number; meanTmin: number; meanTmaxAnomaly: number | null;
  hotSpellDays: number | null; hotSpellCount: number | null;
}
export interface HotSpell { start: string; end: string; days: number; peakTmax: number; peakDate: string; meanTmaxAnomaly: number; touchesStudyBoundary: boolean }
export interface City {
  id: string; name: string; nameEn: string; country: string; timezone: string;
  requestedLocation: Location; gridLocation: Location; timeBasis: string;
  annual: AnnualRow[]; baseline: { status: string; period: string; eventDefinition?: string; caveat?: string; warmSeasonMonths?: number[] };
  events: HotSpell[]; dailyUrl: string; csvUrl: string;
}
export interface Atlas { schemaVersion: string; generatedAt: string; source: Source; cities: City[] }
export interface DayRow { time: string; tmax: number; tmin: number; baselineTmax: number | null; baselineTmin: number | null; p90Tmax: number | null; tmaxAnomaly: number | null; isHotSpellDay: boolean }
export interface DailyData { cityId: string; rows: DayRow[] }

// 请求变化时取消旧请求，避免快速切换案例产生串页数据。
export function useData<T>(url: string) {
  const [state, setState] = useState<{ data: T | null; error: string | null; url: string }>({ data: null, error: null, url });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, error: null, url });
    fetch(url, { signal: controller.signal }).then(r => {
      if (!r.ok) throw new Error(`数据请求失败（${r.status}）`);
      if (!r.headers.get('content-type')?.includes('json')) throw new Error('返回的数据格式不正确');
      return r.json() as Promise<T>;
    }).then(data => setState({ data, error: null, url })).catch(e => {
      if (e.name !== 'AbortError') setState({ data: null, error: '暂时无法读取数据，请重试或下载原始表格。', url });
    });
    return () => controller.abort();
  }, [url, retry]);
  return { data: state.url === url ? state.data : null, error: state.url === url ? state.error : null, reload: () => setRetry(n => n + 1) };
}

export const number = (n: number | null | undefined, digits = 1) => n == null || !Number.isFinite(n) ? '—' : n.toFixed(digits);
export const signed = (n: number | null | undefined, digits = 1) => n == null ? '—' : `${n > 0 ? '+' : ''}${number(n, digits)}`;
export function timeLabel(time: string, timeZone = 'UTC') {
  return new Intl.DateTimeFormat('zh-CN', { timeZone, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(time));
}
export const dateLabel = (date: string) => date.slice(5).replace('-', '/');
export function coordinates(p: Location) { return `${Math.abs(p.latitude).toFixed(2)}°${p.latitude < 0 ? 'S' : 'N'}, ${Math.abs(p.longitude).toFixed(2)}°${p.longitude < 0 ? 'W' : 'E'}`; }
