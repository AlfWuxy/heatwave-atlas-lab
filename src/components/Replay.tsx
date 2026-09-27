import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, Cloud, Droplets, Leaf, Pause, Play, Sun, Wind, ChevronRight } from 'lucide-react';
import { type CaseData, type CaseMeta, type HourRow, coordinates, number, timeLabel, useData } from '../lib/data';
import { globalEvents, mechanisms } from '../content/science';
import LineChart from './LineChart';
import MechanismScene from './MechanismScene';
import SegmentedGroup from './SegmentedGroup';
import { DownloadLink, Loading, Sources } from './Shared';

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
  { key: 'soil_moisture_0_to_7cm', title: '表层土壤水分', unit: 'm³/m³', color: 'var(--water)' },
  { key: 'cloud_cover', title: '总云量', unit: '%', color: 'var(--cloud)' },
];
export default function Replay({ caseId, onCase }: { caseId: string; onCase: (id: string) => void }) {
  const index = useData<{ cases: CaseMeta[] }>('/data/cases.json');
  return <section className="replay-page">
    <div className="page-intro"><h1>一场热浪，<br className="mobile-break" />是怎样形成的？</h1><p>沿着真实数据，回到高温发生之前。</p></div>
    <SegmentedGroup className="case-tabs" label="选择历史回放" selectedKey={caseId}>{[
      ['portland2021', '北美西北', '2021'], ['paris2019', '西欧', '2019'], ['chongqing2022', '长江流域', '2022'],
    ].map(([id, title, year]) => <button key={id} aria-pressed={caseId === id} className={caseId === id ? 'active' : ''} onClick={() => onCase(id)}>{title}<span> · {year}</span></button>)}</SegmentedGroup>
    {index.data ? <ReplayBody key={caseId} caseId={caseId} /> : <Loading error={index.error} retry={index.reload} />}
  </section>;
}
function ReplayBody({ caseId }: { caseId: string }) {
  const request = useData<CaseData>(`/data/case-${caseId}.json`);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [localTime, setLocalTime] = useState(false);
  const [mode, setMode] = useState('radiation');
  const [metric, setMetric] = useState(0);
  useEffect(() => {
    if (request.data) setPosition(Math.max(0, request.data.rows.findIndex(row => row.time === request.data!.peakTime)));
  }, [request.data]);
  useEffect(() => {
    if (!playing || !request.data) return;
    const timer = window.setInterval(() => setPosition(old => {
      if (old >= request.data!.rows.length - 1) { setPlaying(false); return old; }
      return Math.min(old + speed, request.data!.rows.length - 1);
    }), 450);
    return () => window.clearInterval(timer);
  }, [playing, speed, request.data]);
  if (!request.data) return <Loading error={request.error} retry={request.reload} />;
  const data = request.data, row = data.rows[Math.min(position, data.rows.length - 1)];
  if (!row) return <Loading error="此回放的数据为空。" retry={request.reload} />;
  const clockZone = localTime ? data.timezone : 'UTC';
  const mechanism = mechanisms.find(item => item.id === mode);
  const story = globalEvents.find(item => item.dataCaseId === caseId);
  const currentMetric = metrics[metric];
  const select = (value: number) => { setPosition(value); setPlaying(false); };
  return <>
    <Suspense fallback={<div className="regional-pending"><p>正在准备区域地图…</p></div>}><RegionalReplay data={data} position={position} playing={playing} speed={speed} onPosition={select} onPlaying={() => { if (position === data.rows.length - 1) setPosition(0); setPlaying(!playing); }} onSpeed={setSpeed} localTime={localTime} /></Suspense>
    <div className="replay-grid state-enter">
      <div className="replay-canvas">
        <MechanismScene mode={mode} />
        <div className="chart-controls"><SegmentedGroup className="small-tabs" label="选择曲线指标" selectedKey={metric}>{metrics.map((m, i) => <button key={m.key} aria-pressed={metric === i} className={metric === i ? 'active' : ''} onClick={() => setMetric(i)}>{m.title}</button>)}</SegmentedGroup><span className="muted small">{data.title} · 代表格点</span></div>
        <LineChart points={data.rows.map(r => ({ label: r.time, value: Number(r[currentMetric.key]) }))} selected={position} onSelect={select} title={currentMetric.title} unit={currentMetric.unit} color={currentMetric.color} formatX={value => timeLabel(value, clockZone).split(' ')[0]} />
        <div className="playback-controls">
          <button className="play-button" onClick={() => { if (position === data.rows.length - 1) setPosition(0); setPlaying(!playing); }} aria-label={playing ? '暂停回放' : '播放回放'}>{playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</button>
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
    <section className="event-context"><div><h2>把这一小时，放回事件里</h2><p>{story?.summary ?? '回放提供一个代表格点的逐小时记录。事件的空间范围和形成机制还需要区域资料与专题研究。'}</p>{story && <><p className="small muted">资料中的时段：{story.period}</p><Sources ids={story.sourceIds} /></>}</div><div className="data-note"><h3>这份数据的坐标</h3><p>请求位置：{coordinates(data.requestedLocation)}<br />返回格点：{coordinates(data.gridLocation)}</p><p className="small">网格值不等同于城市站点纪录。短波辐射为前一小时平均，其他字段的时次含义见数据说明。</p><DownloadLink href={data.csvUrl}>下载逐小时数据 CSV</DownloadLink></div></section>
  </>;
}
