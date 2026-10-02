import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Download, Link, Pause, Play, RotateCcw } from 'lucide-react';
import { number, signed, timeLabel, useData } from '../lib/data';
import { mechanismCSV, mechanismHash, mechanismState, previousRain, validateMechanismData, windPixelVelocity, type MechanismData, type MechanismSite } from '../lib/europe-mechanism';
import LineChart from './LineChart';
import { Loading } from './Shared';
import './europe-story.css';

const presets = [
  { at: '2019-06-24T14:00:00Z', label: '六月事件', caption: '6月24日—7月1日 · 文献事件窗' },
  { at: '2019-07-10T14:00:00Z', label: '事件之间', caption: '观察气温与土壤是否同步变化' },
  { at: '2019-07-25T14:00:00Z', label: '七月事件', caption: '7月23—26日 · 文献事件窗' },
];

// 风粒子只编码该格点当前小时的均匀风；天空、土层和光束均为变量示意。
function SurfaceScene({ site, index, deep, motion, soilVisible }: { site: MechanismSite; index: number; deep: boolean; motion: boolean; soilVisible: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const state = useRef({ site, index, deep, motion, soilVisible });
  const redraw = useRef<() => void>(() => {});
  state.current = { site, index, deep, motion, soilVisible };
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext('2d');
    if (!context) return;
    let width = 800, height = 340, frame = 0, phase = 0, last = 0, visible = true;
    const points = Array.from({ length: 300 }, (_, i) => ({ x: ((i * 73 + 17) % 307) / 307, y: ((i * 137 + 51) % 311) / 311 }));
    function schedule() { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(render); }
    function visibility() { if (!visible || document.hidden) { cancelAnimationFrame(frame); frame = 0; last = 0; } else schedule(); }
    redraw.current = schedule;
    function render(now: number) {
      frame = 0;
      if (!visible || document.hidden) { last = 0; return; }
      const { site: current, index: position, deep: lower, motion: animate, soilVisible: reveal } = state.current;
      const elapsed = last ? Math.min(.05, (now - last) / 1000) : 0;
      last = now;
      if (animate && visible && !document.hidden) phase += elapsed;
      const ctx = context!;
      const temperature = current.temperatureC[position], sw = Math.max(0, current.shortwaveWm2[position]);
      const water = (lower ? current.soilMoistureDeep : current.soilMoisture)[position];
      const moist = Math.max(0, Math.min(1, (water - .05) / .4));
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, '#101d30'); sky.addColorStop(.63, sw > 100 ? '#273244' : '#182535'); sky.addColorStop(1, '#111d29');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
      const sunX = width * .78, sunY = height * .2, glow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, width * .45);
      glow.addColorStop(0, `rgba(248,193,109,${Math.min(.35, sw / 2200)})`); glow.addColorStop(1, 'rgba(248,193,109,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height * .69);
      if (sw > 5) {
        ctx.fillStyle = `rgba(255,225,166,${Math.min(.95, .2 + sw / 1100)})`;
        ctx.beginPath(); ctx.arc(sunX, sunY, 12, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(247,197,112,${Math.min(.25, sw / 3800)})`;
        for (let i = 0; i < 15; i++) { const x = width * .36 + i * width * .041; ctx.beginPath(); ctx.moveTo(x, height * .15); ctx.lineTo(x - width * .13, height * .65); ctx.stroke(); }
      }
      const { x: vx, y: vy } = windPixelVelocity(current.windSpeedMs[position], current.windDirectionDeg[position]);
      const hue = Math.max(12, Math.min(215, 215 - (temperature - 12) / 30 * 203));
      points.forEach((point, i) => {
        const x = (((point.x + phase * vx / width) % 1) + 1) % 1 * width;
        const y = (.12 + (((point.y + phase * vy / (.48 * height)) % 1) + 1) % 1 * .48) * height;
        ctx.strokeStyle = `hsla(${hue},75%,77%,${.2 + (i % 7) * .065})`;
        ctx.lineWidth = i % 5 === 0 ? 1.5 : .8;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + vx * .3, y + vy * .3); ctx.stroke();
        ctx.fillStyle = `hsla(${hue},80%,80%,.55)`; ctx.fillRect(x, y, 1.2, 1.2);
      });
      const rain = Math.min(70, Math.round(current.precipitationMm[position] * 25));
      ctx.strokeStyle = 'rgba(158,207,243,.65)';
      for (let i = 0; i < rain; i++) { const x = ((i * 67) % 101) / 101 * width; const y = ((i * 31 + phase * 90) % 150) / 150 * height * .65; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 9); ctx.stroke(); }
      ctx.fillStyle = reveal ? `rgb(${Math.round(111 - moist * 45)},${Math.round(85 + moist * 11)},${Math.round(65 + moist * 64)})` : '#3b4652';
      ctx.fillRect(0, height * .67, width, height * .33);
      ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(0, height * .77, width, height * .23);
      ctx.strokeStyle = 'rgba(214,228,240,.3)'; ctx.beginPath(); ctx.moveTo(0, height * (lower ? .77 : .67)); ctx.lineTo(width, height * (lower ? .77 : .67)); ctx.stroke();
      if (reveal) for (let i = 0; i < 90; i++) {
        ctx.fillStyle = `rgba(150,202,224,${.08 + moist * .55})`;
        ctx.beginPath(); ctx.arc(((i * 79 + 17) % 97) / 97 * width, height * (.7 + ((i * 41) % 91) / 91 * .27), 1 + moist * 2, 0, Math.PI * 2); ctx.fill();
      }
      if (animate) schedule();
    }
    const resize = new ResizeObserver(entries => { width = Math.max(1, entries[0].contentRect.width); height = Math.max(1, entries[0].contentRect.height); const dpr = Math.min(window.devicePixelRatio || 1, 2); element.width = width * dpr; element.height = height * dpr; context.setTransform(dpr, 0, 0, dpr, 0, 0); schedule(); });
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; visibility(); });
    document.addEventListener('visibilitychange', visibility);
    resize.observe(element); observer.observe(element); schedule();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect(); document.removeEventListener('visibilitychange', visibility); redraw.current = () => {}; };
  }, []);
  useEffect(() => { redraw.current(); }, [site, index, deep, motion, soilVisible]);
  return <div className="story-scene">
    <canvas ref={canvas} aria-hidden="true" />
    <div className="story-scene-label"><span>单格点变量示意</span><strong>{site.name}附近</strong><small>粒子表示当前10米风 · 北向屏幕上方</small></div>
    <div className="story-scene-temperature"><strong>{number(site.temperatureC[index])}<small>°C</small></strong><span>2米气温</span></div>
    <div className="story-soil-label"><span>{deep ? '7—28 cm 土层' : '0—7 cm 土层'}</span><strong>{soilVisible ? `${number((deep ? site.soilMoistureDeep : site.soilMoisture)[index], 3)} m³/m³` : '水分证据已隐藏'}</strong></div>
    <span className="story-scene-note">光束、雨滴与土色编码数值 · 非真实地景或热收支模拟</span>
  </div>;
}

export default function EuropeStory({ initialHash }: { initialHash: string }) {
  const { data, error, reload } = useData<unknown>('/data/europe2019-mechanism.json');
  if (!data) return <Loading error={error} retry={reload} />;
  if (!validateMechanismData(data)) return <Loading error="机制资料未通过格式核验，暂不绘图。" retry={reload} />;
  return <Story data={data} initialHash={initialHash} />;
}

function Story({ data, initialHash }: { data: MechanismData; initialHash: string }) {
  const initial = useMemo(() => mechanismState(initialHash, data), [initialHash, data]);
  const [siteId, setSiteId] = useState(initial.site), [index, setIndex] = useState(initial.index), [deep, setDeep] = useState(initial.deep);
  const [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(3), [local, setLocal] = useState(true);
  const [motion, setMotion] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [soilVisible, setSoilVisible] = useState(true), [message, setMessage] = useState(initial.note);
  const site = data.sites.find(item => item.id === siteId)!;
  const soil = deep ? site.soilMoistureDeep : site.soilMoisture;
  const zone = local ? site.timezone : 'UTC';
  const soilPoints = useMemo(() => site.time.map((label, i) => ({ label, value: soil[i] })), [site, soil]);
  const tempPoints = useMemo(() => site.time.map((label, i) => ({ label, value: site.temperatureC[i] })), [site]);
  const rainPoints = useMemo(() => site.time.map((label, i) => ({ label, value: site.precipitationMm[i] })), [site]);
  const radiationPoints = useMemo(() => site.time.map((label, i) => ({ label, value: site.shortwaveWm2[i] })), [site]);
  useEffect(() => {
    const hide = () => { if (document.hidden) setPlaying(false); };
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduce = () => { if (preference.matches) { setMotion(false); setPlaying(false); } };
    document.addEventListener('visibilitychange', hide); preference.addEventListener('change', reduce);
    return () => { document.removeEventListener('visibilitychange', hide); preference.removeEventListener('change', reduce); };
  }, []);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setIndex(value => Math.min(value + 1, site.time.length - 1)), 1200 / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed, site.time.length]);
  useEffect(() => { if (index === site.time.length - 1) setPlaying(false); }, [index, site.time.length]);
  function select(value: number) { setPlaying(false); setIndex(Math.max(0, Math.min(site.time.length - 1, value))); }
  async function share() {
    const url = new URL(window.location.href); url.hash = mechanismHash(site, index, deep);
    try { await navigator.clipboard.writeText(url.href); setMessage('已复制地点、时刻与土层。打开链接后默认暂停。'); }
    catch { setMessage('自动复制不可用，可以从下面的当前状态链接打开或复制。'); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob(['\uFEFF', mechanismCSV(site)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `europe2019-${site.id}-hourly.csv`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('已生成该格点的完整逐小时CSV。单位与时段含义见列名。');
  }
  const rain24 = previousRain(site, index);
  const caption = (label: string) => label.slice(5, 10).replace('-', '/');
  return <section className="story-page">
    <div className="page-intro story-intro"><div><span className="story-eyebrow">EUROPE · JUNE — JULY 2019</span><h1>热浪过去，<br />土地还记得吗？</h1><p>沿着两个月的真实资料，看空气与土壤怎样变化。</p></div><div className="story-scope"><strong>4 个格点 · 61 天</strong><span>ERA5 再分析 · 逐小时</span><span>有限点位，非欧洲区域平均</span></div></div>
    <div className="story-site-tabs" role="group" aria-label="选择欧洲地点">{data.sites.map(item => <button key={item.id} aria-pressed={siteId === item.id} onClick={() => { setSiteId(item.id); setPlaying(false); }}><strong>{item.name}</strong><span>{item.gridLatitude.toFixed(2)}°N · {item.gridLongitude.toFixed(2)}°E</span></button>)}</div>
    <div className="story-stage">
      <SurfaceScene site={site} index={index} deep={deep} motion={motion} soilVisible={soilVisible} />
      <div className="story-evidence-values">
        <div><span>此前一小时降雨</span><strong>{number(site.precipitationMm[index], 2)}<small> mm</small></strong><p>此前24小时 {number(rain24, 2)} mm{rain24 === null ? ' · 窗口不完整' : ''}</p></div>
        <div><span>此前一小时平均向下短波</span><strong>{number(site.shortwaveWm2[index], 0)}<small> W/m²</small></strong><p>太阳辐射输入的一部分</p></div>
        <div><span>10米风速 / 总云量</span><strong>{number(site.windSpeedMs[index])}<small> m/s</small></strong><p>来向 {number(site.windDirectionDeg[index], 0)}° · 云量 {number(site.cloudCoverPct[index], 0)}%</p></div>
      </div>
      <div className="story-controls">
        <div className="story-transport"><button className="story-play" aria-label={playing ? '暂停地表资料回放' : '播放地表资料回放'} onClick={() => { if (index === site.time.length - 1) setIndex(0); setPlaying(!playing); }}>{playing ? <Pause size={17} /> : <Play size={17} />}{playing ? '暂停' : '播放'}</button><button disabled={index === 0} onClick={() => select(index - 1)} aria-label="前一小时"><ArrowLeft size={17} /></button><button disabled={index === site.time.length - 1} onClick={() => select(index + 1)} aria-label="后一小时"><ArrowRight size={17} /></button><select aria-label="地表回放速度" value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value="1">1×</option><option value="3">3×</option><option value="6">6×</option></select><time dateTime={site.time[index]}>{timeLabel(site.time[index], zone)} <small>{local ? '当地' : 'UTC'}</small></time></div>
        <input type="range" min={0} max={site.time.length - 1} value={index} onChange={event => select(Number(event.target.value))} aria-label="欧洲地表资料时刻" aria-valuetext={site.time[index]} />
        <div className="story-dates"><span>2019.06.01</span><span>逐小时资料 · UTC {site.time[index].slice(0, 16).replace('T', ' ')}</span><span>2019.07.31</span></div>
        <div className="story-jumps">{presets.map(preset => <button key={preset.at} onClick={() => select(site.time.indexOf(preset.at))}><strong>{preset.label}</strong><span>{preset.caption}</span></button>)}</div>
        <div className="story-options"><button disabled={index < 24} onClick={() => select(index - 24)}>前一天同时刻</button><button disabled={index > site.time.length - 25} onClick={() => select(index + 24)}>后一天同时刻</button><label><input type="checkbox" checked={local} onChange={event => setLocal(event.target.checked)} />当地时钟</label><label><input type="checkbox" checked={motion} onChange={event => setMotion(event.target.checked)} />画面动效</label><button onClick={() => { setSiteId(data.sites[0].id); select(data.sites[0].time.indexOf(presets[2].at)); setDeep(false); setSoilVisible(true); }}><RotateCcw size={14} />重置</button></div>
      </div>
    </div>
    <section className="story-plots" aria-labelledby="story-plots-title">
      <div className="story-section-heading"><div><h2 id="story-plots-title">把几条证据放在同一时刻。</h2><p>点击任意曲线或移动上方时间轴，其余读数会一起更新。</p></div><button className="story-evidence-toggle" aria-pressed={soilVisible} onClick={() => setSoilVisible(value => !value)}>{soilVisible ? '先只看气温' : '揭示水分证据'}</button></div>
      <div className="story-chart-grid">
        <article><header><h3>空气的变化</h3><span>2米气温 · {number(site.temperatureC[index])}°C</span></header><LineChart title="2米气温" points={tempPoints} selected={index} onSelect={select} formatX={caption} height={205} /><p>瞬时格点再分析。与24小时前相比 {index >= 24 ? `${signed(site.temperatureC[index] - site.temperatureC[index - 24])}°C` : '暂无完整对照'}。</p></article>
        <article><header><h3>土地的状态</h3><select aria-label="选择土壤深度" value={deep ? 'deep' : 'surface'} onChange={event => setDeep(event.target.value === 'deep')}><option value="surface">0—7 cm 表层</option><option value="deep">7—28 cm 次表层</option></select></header>{soilVisible ? <LineChart title="土壤体积含水率" unit="m³/m³" color="var(--water)" points={soilPoints} selected={index} onSelect={select} formatX={caption} height={205} /> : <div className="story-concealed"><p>气温下降，是否意味着土壤水分也回升了？</p><button onClick={() => setSoilVisible(true)}>看看真实记录 <ArrowUpRight size={15} /></button></div>}<p>体积含水率，不是干旱百分位。图示土色使用固定0.05—0.45 m³/m³范围，端点饱和。</p></article>
        <article><header><h3>水从哪里补充</h3><span>前一小时总降水 · mm</span></header>{soilVisible ? <LineChart title="前一小时降水" unit="mm" color="#437fac" points={rainPoints} selected={index} onSelect={select} formatX={caption} height={185} zero /> : <div className="story-concealed"><p>揭示水分证据后查看降雨。</p></div>}<p>雨量归于其结束时刻；显示的日期刻度使用UTC。</p></article>
        <article><header><h3>太阳能的输入</h3><span>前一小时平均向下短波 · W/m²</span></header><LineChart title="向下短波辐射" unit="W/m²" color="var(--radiation)" points={radiationPoints} selected={index} onSelect={select} formatX={caption} height={185} zero /><p>这不是净辐射，也不包括完整的地表能量去向。</p></article>
      </div>
    </section>
    <section className="story-reading"><div><span className="story-eyebrow">从看到变化，到解释变化</span><h2>相邻的曲线，<br />还不是因果答案。</h2></div><div><p>研究者比较过2019年六月与七月两次欧洲热浪，讨论暖空气输送、前期干燥与陆面反馈。这里新增的是四个格点的ERA5过程资料；区域、数据产品与分析方法都不同，不能视作原论文复现。</p><p>你可以观察土壤水分与温度何时变化。要计算“干土究竟让气温多升了几度”，还需要对照设计或相应模型；本页没有取得感热、潜热和高空场。</p><div className="story-reading-links"><a href="https://www.nature.com/articles/s43247-020-00048-9" target="_blank" rel="noreferrer">阅读两次热浪的原始研究 <ArrowUpRight size={15} /></a><a href="#lab">进入独立的能量分配实验 <ArrowUpRight size={15} /></a><a href="#replay?case=paris2019">回到巴黎区域风温地图 <ArrowUpRight size={15} /></a></div></div></section>
    <div className="story-export"><div><h3>带走这个时刻，或继续核对。</h3><p>数据：ECMWF / Copernicus ERA5，经 <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> 提供 · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></p></div><div><button onClick={share}><Link size={16} />复制当前状态</button><button onClick={download}><Download size={16} />下载本点CSV</button><a href="/data/europe2019-mechanism.json" download>四点完整JSON</a><a href="/europe-methods.md" download>来源与处理方法</a><a href={mechanismHash(site, index, deep)}>当前状态链接</a></div></div>
    <p className="story-status" role="status">{message}</p>
  </section>;
}
