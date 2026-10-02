import { REPLAY_CASES, REPLAY_CONTINENTS } from './case-catalog.ts';

export const LIBRARY_PAGE_SIZE = 12;
export const LIBRARY_CONTINENTS = REPLAY_CONTINENTS;
export type LibraryFilters = { query: string; year: string; continent: string };
export type SearchableCase = {
  id: string; cityId: string; title: string; start: string;
  name?: string; country?: string; continent?: string; year?: number;
};

// 旧索引没有地域字段时，使用同一份回放白名单补足，不据经纬度猜测所属地区。
export function caseLibraryLabels(item: SearchableCase) {
  const entry = REPLAY_CASES.find(candidate => candidate.id === item.id);
  return {
    name: item.name || entry?.city || item.title,
    country: item.country || entry?.country || '',
    continent: item.continent || entry?.continent || '',
    year: item.year == null ? item.start.slice(0, 4) : String(item.year),
  };
}

export function availableLibraryCases<T extends { id: string; dataUrl: string; csvUrl: string; hours: number; available?: boolean }>(index: { cases: T[] } | null): T[] {
  if (!Array.isArray(index?.cases)) return [];
  return index.cases.filter(item => item && item.available !== false && typeof item.id === 'string'
    && typeof item.dataUrl === 'string' && item.dataUrl.length > 0
    && typeof item.csvUrl === 'string' && item.csvUrl.length > 0
    && Number.isInteger(item.hours) && item.hours > 0);
}

export function filterLibraryCases<T extends SearchableCase>(cases: readonly T[], filters: LibraryFilters): T[] {
  const words = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return cases.filter(item => {
    const labels = caseLibraryLabels(item);
    if (filters.year !== 'all' && labels.year !== filters.year) return false;
    if (filters.continent !== 'all' && labels.continent !== filters.continent) return false;
    const searchable = `${item.title} ${item.cityId} ${item.id} ${labels.name} ${labels.country} ${labels.continent} ${labels.year}`.toLocaleLowerCase();
    return words.every(word => searchable.includes(word));
  });
}
