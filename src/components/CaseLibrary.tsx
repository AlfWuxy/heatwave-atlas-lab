import { useId, useMemo, useState } from 'react';
import { ArrowUpRight, Download, Search } from 'lucide-react';
import { coordinates, useData } from '../lib/data';
import type { CaseMeta } from '../lib/data';
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

// 只展示索引里真正具备小时包的案例，两个目录有重叠时按 id 去重。
function availableCases(index: CaseIndex | null): LibraryCase[] {
  if (!Array.isArray(index?.cases)) return [];
  return index.cases.filter(item => item && item.available !== false && item.id && item.dataUrl && item.csvUrl && item.hours > 0);
}

export default function CaseLibrary({ onReplay }: { onReplay: (id: string) => void }) {
  const original = useData<CaseIndex>('/data/cases.json');
  const extended = useData<CaseIndex>('/data/extended-cases.json');
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('all');
  const titleId = useId();
  const searchId = useId();
  const yearId = useId();
  const cases = useMemo(() => {
    const merged = new Map([...availableCases(original.data), ...availableCases(extended.data)].map(item => [item.id, item]));
    return [...merged.values()].sort((a, b) => b.start.localeCompare(a.start) || a.id.localeCompare(b.id));
  }, [original.data, extended.data]);
  const years = useMemo(() => [...new Set(cases.map(item => item.start.slice(0, 4)))].sort().reverse(), [cases]);
  const visible = useMemo(() => {
    const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return cases.filter(item => (year === 'all' || item.start.startsWith(year)) && words.every(word => `${item.title} ${item.cityId} ${item.id} ${item.start}`.toLocaleLowerCase().includes(word)));
  }, [cases, query, year]);
  const loading = (!original.data && !original.error) || (!extended.data && !extended.error);
  const hasError = Boolean(original.error || extended.error);

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
        <span className="case-library-sr">搜索地名或年份</span>
        <input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索地名或年份" autoComplete="off" />
      </label>
      <label className="case-library-year" htmlFor={yearId}>
        <span>年份</span>
        <select id={yearId} value={year} onChange={event => setYear(event.target.value)}>
          <option value="all">全部年份</option>
          {years.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <span className="case-library-count" role="status">{visible.length} 个匹配</span>
    </div>
    {loading && <p className="case-library-message" role="status">正在读取可用资料…</p>}
    {hasError && <p className="case-library-message" role="status">部分资料目录暂时无法读取，已加载的地点仍可打开。<button type="button" onClick={() => { if (original.error) original.reload(); if (extended.error) extended.reload(); }}>重试</button></p>}
    <ul className="case-library-list">
      {visible.map(item => {
        const evidence = item.eventEvidence?.[0];
        return <li key={item.id} className="case-library-card">
          <div className="case-library-card-heading">
            <h3>{item.title}</h3>
            <span className="case-library-duration">{Number.isInteger(item.hours / 24) ? item.hours / 24 : (item.hours / 24).toFixed(1)} 天</span>
          </div>
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
    {!loading && visible.length === 0 && <p className="case-library-empty">没有找到匹配地点。<button type="button" onClick={() => { setQuery(''); setYear('all'); }}>清除筛选</button></p>}
    <p className="case-library-note">人工选择的观察窗口 · ERA5 格点再分析 · 不代表站点纪录或热浪完整边界。数据：<a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> / Copernicus · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>。</p>
  </section>;
}
