import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, Cloud, Droplets, Leaf, Pause, Play, Sun, Wind, ChevronRight } from 'lucide-react';
import { type CaseData, type CaseMeta, type HourRow, coordinates, number, timeLabel, useData } from '../lib/data';
import { globalEvents, mechanisms } from '../content/science';
import LineChart from './LineChart';
import MechanismScene from './MechanismScene';
import SegmentedGroup from './SegmentedGroup';
import { DownloadLink, Loading, Sources } from './Shared';
import { parseReplayState, serializeReplayState, type ReplayPoint } from '../lib/replay-state';
import '../replay-enhancements.css';
import { REPLAY_CASES, REPLAY_CONTINENTS, mergeReplayCases } from '../lib/case-catalog';

const RegionalReplay = lazy(() => import('./RegionalReplay'));

const views = [
  { key: 'radiation', label: '输入', description: '辐射怎样进入地表', icon: Sun },
  { key: 'advection', label: '输送', description: '空气从哪里移动而来', icon: Wind },
  { key: 'circulation', label: '压缩', description: '下沉气团如何升温', icon: ArrowDown },
  { key: 'evaporation', label: '分配', description: '地表能量有哪些去向', icon: Leaf },
];
const metrics: { key: keyof HourRow; title: string; unit: string; color: string }[] = [
  { key: 'temperature_2m', title: '近地面气温', unit: '°C', color: 'var(--heat)' },
  { key: 'shortwave_radiation', title: '向下短波辐射', unit: 'W/m²', color: 'var(--radiation)' },
  { key: 'soil_moisture_0_to_7cm', title: '土壤水分 0—7cm', unit: 'm³/m³', color: 'var(--water)' },
  { key: 'cloud_cover', title: '总云量', unit: '%', color: 'var(--cloud)' },
  { key: 'soil_moisture_7_to_28cm', title: '土壤水分 7—28cm', unit: 'm³/m³', color: 'var(--water)' },
  { key: 'relative_humidity_2m', title: '2米相对湿度', unit: '%', color: 'var(--water)' },
  { key: 'pressure_msl', title: '海平面气压', unit: 'hPa', color: 'var(--cloud)' },
  { key: 'wind_speed_10m', title: '10米风速', unit: 'm/s', color: 'var(--blue)' },
  { key: 'wind_direction_10m', title: '10米风来向', unit: '°', color: 'var(--blue)' },
  { key: 'precipitation', title: '前一小时降水', unit: 'mm', color: 'var(--water)' },
];
export default function Replay({ caseId, onCase, replayHash = window.location.hash }: { caseId: string; onCase: (id: string) => void; replayHash?: string }) {
  const index = useData<{ cases: CaseMeta[] }>('/data/cases.json');
  const extended = useData<{ cases: CaseMeta[]; status?: string }>('/data/extended-cases.json');
  const expansion = useData<{ cases: CaseMeta[]; status?: string }>('/data/expansion-cases.json');
  const available = mergeReplayCases(index.data?.cases, extended.data?.cases, expansion.data?.cases);
  const selected = REPLAY_CASES.find(item => item.id === caseId);
  const current = available.find(item => item.id === caseId);
  const activeRequest = selected?.collection === 'original' ? index : selected?.collection === 'expansion' ? expansion : extended;
  return <section className="replay-page">
    <div className="page-intro"><h1>一场热浪，<br className="mobile-break" />是怎样形成的？</h1><p>沿着真实数据，回到高温发生之前。</p></div>
    <SegmentedGroup key={`quick-${caseId}`} className="case-tabs" label="选择历史回放" selectedKey={caseId}>{[
      ['portland2021', '北美西北', '2021'], ['paris2019', '西欧', '2019'], ['chongqing2022', '长江流域', '2022'],
    ].map(([id, title, year]) => <button key={id} aria-pressed={caseId === id} className={caseId === id ? 'active' : ''} onClick={() => onCase(id)}>{title}<span> · {year}</span></button>)}</SegmentedGroup>
    <div className="replay-case-picker"><label htmlFor="all-replay-cases">选择城市与事件<select id="all-replay-cases" value={caseId} onChange={event => onCase(event.target.value)}>{REPLAY_CONTINENTS.map(continent => <optgroup key={continent} label={continent}>{REPLAY_CASES.filter(item => item.continent === continent).map(item => <option key={item.id} value={item.id} disabled={!available.some(meta => meta.id === item.id)}>{item.title} · {item.country}{available.some(meta => meta.id === item.id) ? '' : '（资料准备中）'}</option>)}</optgroup>)}</select></label><div><strong>当前：{current?.title ?? selected?.title ?? '未知案例'}</strong><p>已载入 {available.length} 个案例目录 · 每个案例为人工选定观察窗</p></div></div>
    {extended.error && <p className="replay-catalog-notice">扩展案例目录暂时无法读取，原有回放仍可使用。<button onClick={extended.reload}>重试扩展目录</button></p>}
    {expansion.error && <p className="replay-catalog-notice">三十地资料目录暂时无法读取，已载入的回放仍可使用。<button onClick={expansion.reload}>重试三十地目录</button></p>}
    {current ? <ReplayBody key={caseId + replayHash} caseId={caseId} replayHash={replayHash} /> : activeRequest.data ? <div className="loading-state"><h2>{selected?.title ?? '案例'}的资料准备中</h2><p>该案例尚未进入已发布的数据索引。不会用其他城市的数据替代。</p><button className="text-button" onClick={activeRequest.reload}>重新检查案例目录</button></div> : <Loading error={activeRequest.error} retry={activeRequest.reload} />}
  </section>;
}
function ReplayBody({ caseId, replayHash }: { caseId: string; replayHash: string }) {
  const request = useData<CaseData>(`/data/case-${caseId}.json`);
  if (!request.data) return <Loading error={request.error} retry={request.reload} />;
  if (!request.data.rows.length) return <Loading error="此回放的数据为空。" retry={request.reload} />;
  return <LoadedReplay data={request.data} replayHash={replayHash} />;
}
function LoadedReplay({ data, replayHash }: { data: CaseData; replayHash: string }) {
  const caseId = data.id;
  const [initial] = useState(() => parseReplayState(replayHash, caseId, data.rows.map(row => row.time), data.peakTime, { lon: data.gridLocation.longitude, lat: data.gridLocation.latitude }));
  const [basePosition, setPosition] = useState(initial.position);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [localTime, setLocalTime] = useState(initial.localTime);
  const [mode, setMode] = useState('radiation');
  const [metric, setMetric] = useState(0);
  const [compare, setCompare] = useState(initial.compare);
  const [a, setA] = useState(initial.a);
  const [b, setB] = useState(initial.b);
  const [side, setSide] = useState<'A' | 'B'>(initial.side);
  const [point, setPoint] = useState<ReplayPoint>(initial.point);
  const [temperature, setTemperature] = useState(initial.temperature);
  const [wind, setWind] = useState(initial.wind);
  const [shareMessage, setShareMessage] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const position = compare ? (side === 'A' ? a : b) : basePosition;
  const row = data.rows[position];
  useEffect(() => {
    const pause = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', pause);
    return () => document.removeEventListener('visibilitychange', pause);
  }, []);
  useEffect(() => {
    if (!playing || compare || document.hidden) return;
    const timer = window.setInterval(() => setPosition(old => {
      if (old >= data.rows.length - 1) { setPlaying(false); return old; }
      return Math.min(old + speed, data.rows.length - 1);
    }), 450);
    return () => window.clearInterval(timer);
  }, [playing, speed, data, compare]);
  function togglePlaying() {
    if (compare) { setPosition(position); setCompare(false); }
    if (position === data.rows.length - 1) setPosition(0);
    setPlaying(value => !value);
  }
  function reset() {
    setPlaying(false); setCompare(false); setPosition(Math.max(0, data.rows.findIndex(row => row.time === data.peakTime)));
    const peak = Math.max(0, data.rows.findIndex(row => row.time === data.peakTime)); setA(Math.max(0, peak - 24)); setB(peak); setSide('B'); setPoint({ lon: data.gridLocation.longitude, lat: data.gridLocation.latitude }); setTemperature(true); setWind(true); setShareMessage('已恢复峰值时刻与代表格点。');
  }
  async function share() {
    const hash = serializeReplayState(caseId, data.rows.map(row => row.time), { position, a, b, compare, side, localTime, temperature, wind, point, warnings: [] });
    const url = new URL(window.location.href); url.hash = hash;
    setShareUrl(url.toString());
    try { await navigator.clipboard.writeText(url.toString()); setShareMessage('已复制：时刻、A/B、原始格点与图层。接收者打开时暂停。'); }
    catch { setShareMessage('未能自动复制，请选中下方链接手动复制。'); }
  }
  const clockZone = localTime ? data.timezone : 'UTC';
  const mechanism = mechanisms.find(item => item.id === mode);
  const story = globalEvents.find(item => item.dataCaseId === caseId);
  const availableMetrics = metrics.filter(item => data.rows.some(r => typeof r[item.key] === 'number' && Number.isFinite(r[item.key])));
  const currentMetric = availableMetrics[metric] ?? availableMetrics[0];
  const select = (value: number) => { if (compare) { if (side === 'A') setA(value); else setB(value); } else setPosition(value); setPlaying(false); };
  return <>
    {data.qualityWarnings?.length ? <aside className="replay-data-quality" role="note"><strong>这份资料含质量标记</strong>{data.qualityWarnings.map(warning => <p key={warning.variable}>{warning.message}<span>{warning.variable} · {warning.count}个采样 · 最小值 {warning.min}</span></p>)}<p>曲线保留原始数值；标记值不能解释为物理有效的负含水量。</p></aside> : null}
    <div className="replay-enhancements">
      {initial.warnings.length > 0 && <p role="status" className="replay-state-warning">{initial.warnings.join(' ')}</p>}
      <div className="replay-action-row"><button aria-pressed={compare} onClick={() => { setPlaying(false); if (!compare) { setA(Math.max(0, position - 24)); setB(position); setSide('B'); } else setPosition(position); setCompare(!compare); }}>{compare ? '退出同点A/B比较' : '同点A/B比较'}</button><button disabled={position === 0} onClick={() => select(position - 1)}>前一小时</button><button disabled={position === data.rows.length - 1} onClick={() => select(position + 1)}>后一小时</button><button onClick={reset}>重置观察</button><button onClick={share}>复制观察链接</button></div>
      {compare && <div className="replay-compare-controls"><p>固定同一镜头、格点与色标，手动切换两个小时。下方曲线与地图同步显示当前所选侧。</p><div className="replay-compare-pickers">{(['A', 'B'] as const).map(label => <div key={label}><button aria-pressed={side === label} onClick={() => { setSide(label); setPlaying(false); }}>显示 {label}</button><label><span className="sr-only">{label}时刻（UTC）</span><select value={label === 'A' ? a : b} onChange={event => { const value = Number(event.target.value); if (label === 'A') setA(value); else setB(value); setPlaying(false); }}>{data.rows.map((r, index) => <option value={index} key={r.time}>{r.time.replace('T', ' ').replace('Z', '')} UTC</option>)}</select></label></div>)}</div><button disabled={a + 24 >= data.rows.length} onClick={() => { setB(a + 24); setSide('B'); }}>B设为A后24小时</button><span className="replay-science-note">事件窗口内无夏令时切换时，对应相同当地钟点；这不等于排除了其他天气差异。</span></div>}
      <p role="status">{shareMessage}</p>{shareUrl && <input className="replay-share-url" aria-label="最近生成的观察分享链接" readOnly value={shareUrl} onFocus={event => event.currentTarget.select()} />}
    </div>
    <Suspense fallback={<div className="regional-pending"><p>正在准备区域地图…</p></div>}><RegionalReplay data={data} position={position} playing={playing} speed={speed} onPosition={select} onPlaying={togglePlaying} onSpeed={setSpeed} localTime={localTime} selected={point} onSelected={setPoint} showTemperature={temperature} onTemperature={setTemperature} showParticles={wind} onParticles={setWind} compare={compare ? { a, b, side } : null} /></Suspense>
    <div className="replay-grid state-enter">
      <div className="replay-canvas">
        <MechanismScene mode={mode} />
        <div className="chart-controls"><label className="replay-metric-picker">观察变量<select aria-label="选择曲线指标" value={metric} onChange={event => setMetric(Number(event.target.value))}>{availableMetrics.map((m, i) => <option key={m.key} value={i}>{m.title}</option>)}</select></label><span className="muted small">{data.title} · 代表格点</span></div>
        <LineChart points={data.rows.map(r => ({ label: r.time, value: typeof r[currentMetric.key] === 'number' && Number.isFinite(r[currentMetric.key]) ? Number(r[currentMetric.key]) : null }))} selected={position} onSelect={select} title={currentMetric.title} unit={currentMetric.unit} color={currentMetric.color} formatX={value => timeLabel(value, clockZone).split(' ')[0]} />
        {currentMetric.key === 'wind_direction_10m' && <p className="replay-science-note">风来向按北0°、东90°计。0°与360°相接，曲线跨越零度的跳变不代表风突然大幅转向。</p>}
        {currentMetric.key.startsWith('soil_moisture') && data.qualityWarnings?.some(warning => warning.variable === currentMetric.key) && <p className="replay-science-note">本土壤变量含原始质量标记，曲线未截断或补零。请结合上方提示解读。</p>}
        <div className="playback-controls">
          <button className="play-button" onClick={togglePlaying} aria-label={playing ? '暂停回放' : '播放回放'}>{playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</button>
          <input type="range" min={0} max={data.rows.length - 1} value={position} aria-label="回放时刻" aria-valuetext={`${timeLabel(row.time, clockZone)} ${localTime ? '当地时间' : 'UTC'}`} onChange={e => select(Number(e.target.value))} />
          <div className="playback-time"><time dateTime={row.time}>{timeLabel(row.time, clockZone)}</time><button className="clock-switch" onClick={() => setLocalTime(!localTime)} aria-label="切换UTC与当地时间">{localTime ? '当地时间' : 'UTC'}<ChevronRight size={12} /></button></div>
          <label className="speed-label"><span className="sr-only">回放速度</span><select value={speed} onChange={e => setSpeed(Number(e.target.value))}><option value={1}>1×</option><option value={3}>3×</option><option value={6}>6×</option></select></label>
        </div>
        <div className="window-note">回放窗口 {data.start} — {data.end} · {data.hours}小时<br /><span>窗口由人工选取，不等于算法识别的热浪起止。切换时钟仅改变小时标签。</span></div>
      </div>
      <aside className="reading-rail">
        <div className="rail-title"><h2>此刻的数据</h2><span>{data.title}</span></div>
        <div className="temperature-number">{number(row.temperature_2m)}<span>°C</span></div>
        <p className="temperature-caption">近地面气温（2米）<span>ERA5 再分析</span></p>
        <dl className="weather-list">
          <div><dt><Droplets />相对湿度</dt><dd>{number(row.relative_humidity_2m, 0)} <small>%</small></dd></div>
          <div><dt><Cloud />总云量</dt><dd>{number(row.cloud_cover, 0)} <small>%</small></dd></div>
          <div><dt><Sun />向下短波辐射</dt><dd>{number(row.shortwave_radiation, 0)} <small>W/m²</small></dd></div>
          <div><dt><Leaf />土壤水分 <small>0—7cm</small></dt><dd>{number(row.soil_moisture_0_to_7cm, 3)} <small>m³/m³</small></dd></div>
          <div><dt><Wind />10米风速</dt><dd>{number(row.wind_speed_10m)} <small>m/s</small></dd></div>
        </dl>
        <div className="reading-note"><h3>看见什么，能说明什么</h3><p>曲线记录同一格点的天气变化。上方示意图解释一般物理过程；当前数据没有提供高空下沉、感热与潜热的完整证据，无法直接分解本次高温的成因贡献。</p><a className="inline-link" href={data.source.documentationUrl} target="_blank" rel="noreferrer">数据：ERA5 / Open-Meteo<ArrowUpRight size={14} /></a></div>
      </aside>
    </div>
    <section className="mechanisms-section" aria-labelledby="mechanism-heading"><h2 id="mechanism-heading">沿着四个过程理解高温</h2><div className="mechanism-tabs">{views.map(view => <button className={mode === view.key ? 'active' : ''} key={view.key} aria-pressed={mode === view.key} onClick={() => setMode(view.key)}><view.icon size={27} /><span><strong>{view.label}</strong><small>{view.description}</small></span><ChevronRight size={16} /></button>)}</div>{mechanism && <div key={mode} className="mechanism-explanation state-enter"><div><h3>{mechanism.title}</h3><p>{mechanism.summary}</p></div><div><ol>{mechanism.steps.map((step, i) => <li key={i}>{step}</li>)}</ol><p className="caution-text">{mechanism.caution}</p><Sources ids={mechanism.sourceIds} /></div></div>}</section>
    {caseId === 'paris2019' && <p className="replay-mechanism-link"><a href="#mechanism">继续探索：欧洲2019两次热浪与土壤水分 →</a></p>}
    <section className="event-context"><div><h2>把这一小时，放回事件里</h2><p>{data.summary ?? story?.summary ?? '回放提供一个代表格点的逐小时记录。事件的空间范围和形成机制还需要区域资料与专题研究。'}</p>{data.eventEvidence?.length ? <div className="replay-event-evidence"><h3>事件来源与核查范围</h3><ul>{data.eventEvidence.filter(item => item.url.startsWith('https://')).map(item => <li key={item.url}><a href={item.url} target="_blank" rel="noreferrer">{item.title} <ArrowUpRight size={13} /></a><span>{item.organisation}</span>{item.evidenceNote && <details><summary>阅读范围与证据边界</summary><p>{item.evidenceNote}</p>{item.verifiedOn && <small>核查日期：{item.verifiedOn}</small>}</details>}</li>)}</ul></div> : story && <><p className="small muted">资料中的时段：{story.period}</p><Sources ids={story.sourceIds} /></>}
      <p className="replay-event-scope">{data.scopeNote ?? data.caveat}</p></div><div className="data-note"><h3>这份数据的坐标</h3><p>请求位置：{coordinates(data.requestedLocation)}<br />返回格点：{coordinates(data.gridLocation)}</p><p className="small">网格值不等同于城市站点纪录。短波辐射为前一小时平均，其他字段的时次含义见数据说明。</p><DownloadLink href={data.csvUrl}>下载逐小时数据 CSV</DownloadLink></div></section>
  </>;
}
