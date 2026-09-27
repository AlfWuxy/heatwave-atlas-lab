import { useMemo, useState } from 'react';
import { CalendarDays, Download, MapPin } from 'lucide-react';
import { type Atlas, type City, type DailyData, coordinates, dateLabel, number, signed, useData } from '../lib/data';
import LineChart from './LineChart';
import SegmentedGroup from './SegmentedGroup';
import { DownloadLink, Loading } from './Shared';

const metricOptions = [
  { key: 'maxTmax', label: '年内最高温', unit: '°C', explanation: '这一年所有日最高温中的最大值，代表附近格点，不是城市官方纪录。' },
  { key: 'meanTmaxAnomaly', label: '日最高温平均异常', unit: '°C', explanation: '每日日最高温减去对应季节基准，再对全年取平均；不是年平均气温，也不是全球趋势。' },
  { key: 'hotSpellDays', label: '暖季高温过程日数', unit: '日', explanation: '规定暖季内，连续至少3个UTC日超过当季P90阈值的日数；属于本站自定义点位指标。' },
] as const;

export default function ClimateExplorer() {
  const request = useData<Atlas>('/data/atlas.json');
  const [cityId, setCityId] = useState('chongqing');
  return <section className="climate-page"><div className="page-intro"><h1>把一天的高温，<br className="mobile-break" />放进二十年里。</h1><p>六个地点的附近格点 · 2006—2025 · 三十年季节基准</p></div>
    {request.data ? <><div className="city-selector" aria-label="选择地点">{request.data.cities.map(city => <button key={city.id} className={cityId === city.id ? 'active' : ''} aria-pressed={cityId === city.id} onClick={() => setCityId(city.id)}><span>{city.name}</span><small>{city.country}</small></button>)}</div><CityHistory key={cityId} city={request.data.cities.find(city => city.id === cityId) ?? request.data.cities[0]} /></> : <Loading error={request.error} retry={request.reload} />}
  </section>;
}
function CityHistory({ city }: { city: City }) {
  const [metric, setMetric] = useState(0);
  const [year, setYear] = useState(city.id === 'chongqing' ? 2022 : city.id === 'portland' ? 2021 : 2025);
  const current = city.annual.find(row => row.year === year)!;
  const selection = metricOptions[metric];
  return <>
    <div className="section-heading"><div><h2>{city.name}<span className="city-english">{city.nameEn}</span></h2><p className="small muted"><MapPin size={13} />返回格点 {coordinates(city.gridLocation)} · ERA5 / Open-Meteo · UTC日</p></div><DownloadLink href={city.csvUrl}>下载20年 CSV</DownloadLink></div>
    <div className="climate-metrics"><div><span>{year} 年内最高温</span><strong>{number(current.maxTmax)}<small>°C</small></strong><p>{current.maxTmaxDate} · UTC日</p></div><div><span>全年日最高温平均异常</span><strong>{signed(current.meanTmaxAnomaly)}<small>°C</small></strong><p>相对1991—2020季节基准</p></div><div><span>暖季高温过程日数</span><strong>{number(current.hotSpellDays, 0)}<small>日</small></strong><p>{number(current.hotSpellCount, 0)}次过程在本年开始</p></div></div>
    <div className="chart-controls"><SegmentedGroup className="small-tabs" label="年度指标" selectedKey={metric}>{metricOptions.map((option, i) => <button key={option.key} className={metric === i ? 'active' : ''} aria-pressed={metric === i} onClick={() => setMetric(i)}>{option.label}</button>)}</SegmentedGroup><label className="year-select"><CalendarDays size={16} /><span className="sr-only">查看年份</span><select value={year} onChange={e => setYear(Number(e.target.value))}>{city.annual.map(row => <option key={row.year} value={row.year}>{row.year}年</option>)}</select></label></div>
    <LineChart points={city.annual.map(row => ({ label: `${row.year}`, value: row[selection.key] }))} selected={city.annual.findIndex(row => row.year === year)} onSelect={index => setYear(city.annual[index].year)} title={selection.label} unit={selection.unit} zero={metric === 1} height={255} />
    <p className="chart-explainer">{selection.explanation} 点击曲线上的年份，或使用年份选择框，查看下方逐日数据。</p>
    <DailyHistory key={`${city.id}-${year}`} city={city} year={year} />
    <details className="method-details"><summary>这些异常和高温过程，是怎样计算的？</summary><div><p>参考期为1991—2020年，每个日历日汇集前后各15日，共31日窗口的数据。日最高温异常是当天温度减去该窗口的平均值；P90是这个窗口的第90百分位。</p><p>本站仅在北半球5—9月、南半球11—3月识别连续至少3日严格超过P90的过程。固定季节可能遗漏其他月份的高温，例如印度春季事件。过程不等于官方预警，也不代表所在区域的整体热浪。</p><p>参考期与部分展示年份重叠；尚未做标准气候指数的样本内百分位自举校正，因此这些年际计数用于探索，不用于精确趋势归因。所有逐日值按UTC日聚合。</p><DownloadLink href={`/data/baseline-${city.id}-1991-2020.csv`}>下载30年基准资料</DownloadLink><DownloadLink href="/data-methods.md">下载完整口径说明</DownloadLink></div></details>
  </>;
}
function DailyHistory({ city, year }: { city: City; year: number }) {
  const request = useData<DailyData>(city.dailyUrl);
  const [dayIndex, setDayIndex] = useState(0);
  const rows = useMemo(() => request.data?.rows.filter(row => row.time.startsWith(`${year}-`)) ?? [], [request.data, year]);
  const selected = rows[Math.min(dayIndex, rows.length - 1)];
  const spells = city.events.filter(event => event.start.startsWith(`${year}`) || event.end.startsWith(`${year}`));
  if (!request.data) return <Loading error={request.error} retry={request.reload} />;
  if (!rows.length || !selected) return <Loading error="这一年没有完整的逐日记录。" />;
  return <section className="daily-section"><div className="section-heading"><div><h2>{year}，逐日展开</h2><p className="small muted">观察一年的温度变化，以及超过当季阈值的时段。</p></div><time>{selected.time} · UTC</time></div>
    <LineChart points={rows.map(row => ({ label: row.time, value: row.tmax }))} reference={{ points: rows.map(row => ({ label: row.time, value: row.p90Tmax })), label: '1991—2020 季节P90' }} selected={dayIndex} onSelect={setDayIndex} title="日最高温" formatX={dateLabel} height={235} />
    <div className="day-controls"><input type="range" aria-label="选择一年中的日期" min="0" max={rows.length - 1} value={dayIndex} aria-valuetext={selected.time} onChange={e => setDayIndex(Number(e.target.value))} /><div className="day-readout"><span>最高 <strong>{number(selected.tmax)}°C</strong></span><span>最低 <strong>{number(selected.tmin)}°C</strong></span><span>最高温异常 <strong>{signed(selected.tmaxAnomaly)}°C</strong></span></div></div>
    <div className="daily-bottom"><div><h3>温度异常的日历</h3><p className="small muted">每个方格是一天；橙色偏暖，蓝色偏凉。颜色表示日最高温异常。</p><div className="calendar-scroll"><svg viewBox="0 0 750 258" role="img" aria-label={`${year}年日最高温异常日历，逐日数值可通过上方日期滑块查看。`} className="anomaly-calendar"><text x="40" y="14" className="plot-label">1日</text><text x="358" y="14" className="plot-label">15日</text><text x="700" y="14" className="plot-label">31日</text>{Array.from({ length: 12 }, (_, month) => <text key={month} x="2" y={34 + month * 19} className="plot-label">{month + 1}月</text>)}{rows.map((row, index) => {
      const month = Number(row.time.slice(5, 7)) - 1, day = Number(row.time.slice(8, 10)) - 1;
      const value = row.tmaxAnomaly ?? 0, strength = Math.min(1, Math.abs(value) / 10);
      const fill = row.tmaxAnomaly == null ? '#d2d2d7' : value >= 0 ? `rgb(${Math.round(245 - strength * 54)},${Math.round(245 - strength * 173)},${Math.round(247 - strength * 247)})` : `rgb(${Math.round(245 - strength * 163)},${Math.round(245 - strength * 123)},${Math.round(247 - strength * 98)})`;
      return <rect key={row.time} x={40 + day * 22.5} y={22 + month * 19} width={19.5} height={15} rx={1.4} fill={fill} stroke={dayIndex === index ? 'var(--ink)' : 'none'} onClick={() => setDayIndex(index)}><title>{row.time}：最高温异常 {signed(row.tmaxAnomaly)}°C</title></rect>;
    })}</svg></div><div className="calendar-legend"><span>−10°C</span><i /><span>0</span><b /><span>+10°C</span></div></div><div className="spell-list"><h3>这一年的点位高温过程</h3><p className="small muted">{spells.length}次与本年相交 · 日期按UTC</p>{spells.length ? <ul>{spells.map(event => <li key={event.start}><button onClick={() => { const i = rows.findIndex(row => row.time === event.start); setDayIndex(Math.max(0, i)); }}><span>{dateLabel(event.start)} — {dateLabel(event.end)}</span><strong>{event.days}日</strong></button><small>过程最高 {number(event.peakTmax)}°C{event.touchesStudyBoundary ? ' · 接触资料边界' : ''}</small></li>)}</ul> : <p>这一年没有符合本站暖季定义的过程。</p>}<a className="text-button" href={city.csvUrl} download><Download size={15} />逐日值与阈值 CSV</a></div></div>
  </section>;
}
