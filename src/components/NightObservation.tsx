import { useMemo, useState } from 'react';
import { collectNights, type NightSample } from '../lib/night-observation';
import { timeLabel } from '../lib/data';
import LineChart from './LineChart';
import '../replay-enhancements.css';
export default function NightObservation({ samples, timezone, locationLabel, onTime }: { samples: NightSample[]; timezone: string; locationLabel: string; onTime: (time: string) => void }) {
  const nights = useMemo(() => collectNights(samples, timezone), [samples, timezone]);
  const [date, setDate] = useState('');
  const night = nights.find(item => item.date === date) ?? nights[0];
  return <section className="night-observation" aria-labelledby="night-heading"><div className="replay-enhancement-heading"><div><span>EVENING TO MORNING</span><h3 id="night-heading">到了夜里，气温怎样变化？</h3><p>{locationLabel} · 当地钟表时间 · {timezone}</p></div>{night && <label>选择夜晚<select value={night.date} onChange={event => setDate(event.target.value)}>{nights.map(item => <option key={item.date} value={item.date}>{item.date} 晚</option>)}</select></label>}</div>
    {night ? <><div className="night-values"><div><span>18:00—次日05:59 最低值</span><strong>{night.minimum.toFixed(1)} <small>°C</small></strong></div><div><span>12个小时采样的均值</span><strong>{night.mean.toFixed(1)} <small>°C</small></strong></div><div><span>18:00到次日06:00 降幅</span><strong>{night.cooling === null ? '缺少06时数据' : `${night.cooling.toFixed(1)} °C`}</strong></div></div><LineChart title="当地夜间逐小时气温" points={night.samples.map(sample => ({ label: sample.time, value: sample.temperature }))} formatX={time => timeLabel(time, timezone)} height={185} onSelect={index => onTime(night.samples[index].time)} /><details><summary>查看逐小时数值与定位地图</summary><div className="night-samples">{night.samples.map(sample => <button key={sample.time} onClick={() => onTime(sample.time)}>{timeLabel(sample.time, timezone)} · {sample.temperature.toFixed(1)}°C</button>)}</div></details></> : <p>当前数据没有完整的当地18时至次日05时逐小时记录，暂不计算夜间统计。</p>}
    <p className="replay-science-note">这里采用固定钟表窗口，不等同于日落至日出。最低值来自小时采样；降幅为负表示06时比18时更热。这不是UTC日最低温，也没有使用日尺度常年值推算夜间异常或健康阈值。</p>
  </section>;
}
