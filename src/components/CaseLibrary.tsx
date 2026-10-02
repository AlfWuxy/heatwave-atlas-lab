import { useId, useMemo, useState } from 'react';
import { ArrowUpRight, Download, Search } from 'lucide-react';
import { coordinates, useData } from '../lib/data';
import type { CaseMeta } from '../lib/data';
import { mergeReplayCases } from '../lib/case-catalog';
import { availableLibraryCases, caseLibraryLabels, filterLibraryCases, LIBRARY_CONTINENTS, LIBRARY_PAGE_SIZE } from '../lib/case-library';
import './case-library.css';

type LibraryCase = CaseMeta & {
  summary?: string;
  scopeNote?: string;
  eventEvidence?: { title: string; url: string; organisation?: string }[];
  available?: boolean;
  qualityStatus?: 'clean' | 'flagged';
  qualityWarnings?: { variable: string; count: number; min: number; max: number; message: string }[];
};
type CaseIndex = { cases: LibraryCase[] };

export default function CaseLibrary({ onReplay }: { onReplay: (id: string) => void }) {
  const original = useData<CaseIndex>('/data/cases.json');
  const extended = useData<CaseIndex>('/data/extended-cases.json');
  const expansion = useData<CaseIndex>('/data/expansion-cases.json');
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('all');
  const [continent, setContinent] = useState('all');
  const [limit, setLimit] = useState(LIBRARY_PAGE_SIZE);
  const titleId = useId();
  const searchId = useId();
  const yearId = useId();
  const continentId = useId();
  const listId = useId();
  const cases = useMemo(() => mergeReplayCases(
    availableLibraryCases(original.data), availableLibraryCases(extended.data), availableLibraryCases(expansion.data),
  ).sort((a, b) => b.start.localeCompare(a.start) || a.id.localeCompare(b.id)), [original.data, extended.data, expansion.data]);
  const years = useMemo(() => [...new Set(cases.map(item => caseLibraryLabels(item).year))].sort().reverse(), [cases]);
  const continents = useMemo(() => LIBRARY_CONTINENTS.filter(value => cases.some(item => caseLibraryLabels(item).continent === value)), [cases]);
  const matching = useMemo(() => filterLibraryCases(cases, { query, year, continent }), [cases, query, year, continent]);
  const visible = matching.slice(0, limit);
  const loading = [original, extended, expansion].some(index => !index.data && !index.error);
  const hasError = Boolean(original.error || extended.error || expansion.error);
  const hasFilters = Boolean(query || year !== 'all' || continent !== 'all');
  const clearFilters = () => { setQuery(''); setYear('all'); setContinent('all'); setLimit(LIBRARY_PAGE_SIZE); };

  return <section className="case-library" aria-labelledby={titleId}>
    <header className="case-library-header">
      <div>
        <p className="case-library-eyebrow">可回放资料</p>
        <h2 id={titleId}>走进真实的高温过程。</h2>
        <p className="case-library-intro">逐小时气温与风，配合地表观察。选一个地点，让时间开始流动。</p>
      </div>
      <p className="case-library-total" aria-live="polite"><strong>{cases.length}</strong><span>个已提供数据的地点</span></p>
    </header>
    <div className="case-library-controls">
      <label className="case-library-search" htmlFor={searchId}>
        <Search size={17} aria-hidden="true" />
        <span className="case-library-sr">搜索国家、城市或年份</span>
        <input id={searchId} type="search" value={query} onChange={event => { setQuery(event.target.value); setLimit(LIBRARY_PAGE_SIZE); }} placeholder="搜索国家、城市或年份" autoComplete="off" />
      </label>
      <label className="case-library-year" htmlFor={continentId}>
        <span>地区</span>
        <select id={continentId} value={continent} onChange={event => { setContinent(event.target.value); setLimit(LIBRARY_PAGE_SIZE); }}>
          <option value="all">全球</option>
          {continents.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="case-library-year" htmlFor={yearId}>
        <span>年份</span>
        <select id={yearId} value={year} onChange={event => { setYear(event.target.value); setLimit(LIBRARY_PAGE_SIZE); }}>
          <option value="all">全部年份</option>
          {years.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      {hasFilters && <button type="button" className="case-library-clear" onClick={clearFilters}>清除筛选</button>}
      <span className="case-library-count" role="status">{matching.length} 个匹配 · 已显示 {visible.length} 个</span>
    </div>
    {loading && <p className="case-library-message" role="status">正在读取可用资料…</p>}
    {hasError && <p className="case-library-message" role="status">部分资料目录暂时无法读取，已加载的地点仍可打开。<button type="button" onClick={() => { if (original.error) original.reload(); if (extended.error) extended.reload(); if (expansion.error) expansion.reload(); }}>重试</button></p>}
    <ul id={listId} className="case-library-list">
      {visible.map(item => {
        const evidence = item.eventEvidence?.[0];
        const labels = caseLibraryLabels(item);
        return <li key={item.id} className="case-library-card">
          <div className="case-library-card-heading">
            <h3>{item.title}</h3>
            <span className="case-library-duration">{Number.isInteger(item.hours / 24) ? item.hours / 24 : (item.hours / 24).toFixed(1)} 天</span>
          </div>
          <p className="case-library-location">{[labels.continent, labels.country, labels.name].filter(Boolean).join(' · ')}</p>
          <p className="case-library-window"><time dateTime={item.start}>{item.start.slice(0, 10)}</time><span aria-hidden="true"> — </span><time dateTime={item.end}>{item.end.slice(0, 10)}</time> <span>UTC</span></p>
          <p className="case-library-grid">{item.hours.toLocaleString('zh-CN')} 小时 · {coordinates(item.gridLocation)} · 附近格点</p>
          {item.qualityStatus === 'flagged' && <p className="case-library-quality" title={item.qualityWarnings?.map(warning => warning.message).join('；')}>土壤原值有质量标记</p>}
          <div className="case-library-actions">
            <button type="button" className="case-library-play" onClick={() => onReplay(item.id)} aria-label={`回放${item.title}`}>开始回放 <ArrowUpRight size={15} aria-hidden="true" /></button>
            <a href={item.csvUrl} download aria-label={`下载${item.title}小时CSV`}><Download size={13} aria-hidden="true" /> CSV</a>
            <a href={evidence?.url ?? item.source.datasetUrl} target="_blank" rel="noreferrer" aria-label={`${item.title}的${evidence ? '事件来源' : '数据来源'}`}>{evidence ? '事件来源' : '数据来源'} ↗</a>
          </div>
        </li>;
      })}
    </ul>
    {!loading && visible.length === 0 && <p className="case-library-empty">没有找到匹配地点。<button type="button" onClick={clearFilters}>清除筛选</button></p>}
    {visible.length < matching.length && <div className="case-library-more">
      <button type="button" aria-controls={listId} onClick={() => setLimit(value => value + LIBRARY_PAGE_SIZE)}>再显示 {Math.min(LIBRARY_PAGE_SIZE, matching.length - visible.length)} 个地点</button>
      <span>还有 {matching.length - visible.length} 个匹配地点</span>
    </div>}
    <p className="case-library-note">人工选择的观察窗口 · ERA5 格点再分析 · 不代表站点纪录或热浪完整边界。数据：<a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> / Copernicus · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>。</p>
  </section>;
}
