import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, Expand, Flame, Link, Move, Pause, Play, RotateCcw, SkipForward, Snowflake } from 'lucide-react';
import { createThermalRenderer, type ThermalFrame, type ThermalRenderer } from '../lib/thermal-renderer';
import { readThermalSettings, thermalHash, type ThermalCommand, type ThermalDiagnostics, type ThermalReply, type ThermalSettings } from '../lib/thermal-state';
import type { ThermalPreset } from '../lib/thermal-solver';
import './thermal-particles.css';

type Tool = 'heat' | 'cold' | 'push';
type CommandBody = ThermalCommand extends infer C ? C extends { id: number } ? Omit<C, 'id'> : never : never;
const scenes: { id: ThermalPreset; name: string; description: string }[] = [
  { id: 'plume', name: '热羽流', description: '下部的一团暖流，逐渐上升、卷入周围流体。' },
  { id: 'cold', name: '冷团下沉', description: '上部的一团冷流，向下沉降，周围流体随之补位。' },
  { id: 'meeting', name: '冷热相遇', description: '一暖一冷，从两端出发。在相遇中看见热的输送。' },
];
const signed = (number: number) => `${number >= 0 ? '+' : ''}${number.toFixed(2)}`;

export default function ThermalParticles() {
  const [settings, setSettings] = useState(readThermalSettings);
  const [playing, setPlaying] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [tool, setTool] = useState<Tool>('heat');
  const [diagnostics, setDiagnostics] = useState<ThermalDiagnostics | null>(null);
  const [backend, setBackend] = useState<{ kind: string; count: number }>({ kind: 'loading', count: 0 });
  const [fallback, setFallback] = useState(false);
  const [message, setMessage] = useState('点击画布加入温度扰动，也可以使用下方按钮。');
  const [failure, setFailure] = useState('');
  const [probe, setProbe] = useState({ x: 0.5, y: 0.5, visible: false });
  const [fieldAtProbe, setFieldAtProbe] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const fullPanel = useRef<HTMLDivElement>(null);
  const worker = useRef<Worker | null>(null);
  const renderer = useRef<ThermalRenderer | null>(null);
  const frame = useRef<ThermalFrame | null>(null);
  const current = useRef({ settings, playing, tool });
  current.current = { settings, playing, tool };
  const sequence = useRef(0);
  const busy = useRef<number | null>(null);
  const particleTime = useRef(0);
  const modelTime = useRef(0);
  const previousPaint = useRef(0);
  const visible = useRef(true);
  const pointer = useRef<{ x: number; y: number; stamp: number } | null>(null);
  const inputPending = useRef<number | null>(null);
  const initialized = useRef(false);
  const probeLocation = useRef(probe);
  probeLocation.current = probe;

  function sampleProbe(field: ThermalFrame, x: number, y: number) {
    const gx = Math.max(0, Math.min(field.nx - 1, x * field.nx - 0.5));
    const gy = Math.max(0, Math.min(field.ny - 1, y * field.ny - 0.5));
    const i = Math.floor(gx), j = Math.floor(gy), k = Math.min(i + 1, field.nx - 1), l = Math.min(j + 1, field.ny - 1);
    const lower = field.temperature[j * field.nx + i] * (1 - gx + i) + field.temperature[j * field.nx + k] * (gx - i);
    const upper = field.temperature[l * field.nx + i] * (1 - gx + i) + field.temperature[l * field.nx + k] * (gx - i);
    setFieldAtProbe(lower * (1 - gy + j) + upper * (gy - j));
  }

  function post(body: CommandBody) {
    if (!worker.current) return -1;
    const id = ++sequence.current;
    worker.current.postMessage({ ...body, id });
    return id;
  }
  function reset(preset = current.current.settings.preset) {
    particleTime.current = 0;
    post({ type: 'reset', preset });
    setMessage('实验已重置，温度与流场从初始状态重新开始。');
  }
  function update(patch: Partial<ThermalSettings>) { setSettings(previous => ({ ...previous, ...patch })); }
  function chooseScene(preset: ThermalPreset) { update({ preset }); reset(preset); }
  function togglePlaying() { setPlaying(value => !value); }
  function perturb(kind: Tool, x: number, y: number, dx = 0, dy = 0, dragging = false) {
    if (!initialized.current || inputPending.current !== null || failure) return;
    const strength = current.current.settings.strength;
    inputPending.current = kind === 'push'
      ? post({ type: 'push', x, y, dx: Math.max(-0.4, Math.min(0.4, dx * 3)) * strength, dy: Math.max(-0.4, Math.min(0.4, dy * 3)) * strength })
      : post({ type: 'heat', x, y, amount: (kind === 'heat' ? 1 : -1) * strength * (dragging ? 0.12 : 0.65) });
  }

  useEffect(() => {
    const simulation = new Worker(new URL('../workers/thermal.worker.ts', import.meta.url), { type: 'module' });
    worker.current = simulation;
    simulation.onmessage = ({ data }: MessageEvent<ThermalReply>) => {
      if (busy.current === data.id) busy.current = null;
      if (inputPending.current === data.id) inputPending.current = null;
      if (data.type === 'error') { setFailure(data.message); setPlaying(false); return; }
      frame.current = data.frame;
      if (data.reset) {
        renderer.current?.reset(current.current.settings.seed);
        particleTime.current = 0;
      } else particleTime.current += Math.max(0, data.diagnostics.time - modelTime.current);
      modelTime.current = data.diagnostics.time;
      initialized.current = true;
      const now = performance.now();
      if (data.reset || !current.current.playing || now - previousPaint.current > 180) {
        setDiagnostics(data.diagnostics); previousPaint.current = now;
        if (probeLocation.current.visible) sampleProbe(data.frame, probeLocation.current.x, probeLocation.current.y);
      }
    };
    simulation.onerror = () => { setFailure('后台计算未能运行，请重新载入页面。'); setPlaying(false); };
    post({ type: 'init', preset: current.current.settings.preset });
    return () => { simulation.terminate(); worker.current = null; initialized.current = false; busy.current = null; inputPending.current = null; };
  }, []);

  useEffect(() => {
    window.history.replaceState(null, '', thermalHash(settings));
    renderer.current?.setQuality(settings.quality);
    if (renderer.current) setBackend({ kind: renderer.current.kind, count: renderer.current.count });
  }, [settings]);

  useEffect(() => {
    const restore = () => {
      if (!window.location.hash.startsWith('#particles')) return;
      const restored = readThermalSettings();
      setSettings(restored); reset(restored.preset);
    };
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduce = () => { if (motion.matches) setPlaying(false); };
    window.addEventListener('hashchange', restore);
    motion.addEventListener('change', reduce);
    return () => { window.removeEventListener('hashchange', restore); motion.removeEventListener('change', reduce); };
  }, []);

  useEffect(() => {
    if (!canvas.current || !stage.current) return;
    let active: ThermalRenderer;
    try {
      active = createThermalRenderer(canvas.current, current.current.settings.quality, current.current.settings.seed, fallback || settings.renderer === 'canvas');
    } catch {
      if (!fallback && settings.renderer !== 'canvas') {
        setFallback(true); setMessage('图形加速不可用，已切换为兼容粒子显示。');
      } else { setFailure('浏览器无法创建画布，请尝试更新浏览器后重新载入。'); setPlaying(false); }
      return;
    }
    renderer.current = active;
    setBackend({ kind: active.kind, count: active.count });
    let raf = 0, last = 0, accumulator = 0, stopped = false;
    const resize = new ResizeObserver(([entry]) => active.resize(entry.contentRect.width, entry.contentRect.height, Math.min(window.devicePixelRatio || 1, 1.5)));
    resize.observe(stage.current);
    const observer = new IntersectionObserver(([entry]) => { visible.current = entry.isIntersecting; }, { threshold: 0.05 });
    observer.observe(stage.current);
    const tick = (now: number) => {
      if (stopped) return;
      const elapsed = last ? Math.min((now - last) / 1000, 0.07) : 0;
      last = now;
      const running = current.current.playing && visible.current && !document.hidden && initialized.current;
      if (running) accumulator = Math.min(0.07, accumulator + elapsed);
      else accumulator = 0;
      if (running && busy.current === null && accumulator >= 1 / 30) {
        const steps = Math.min(4, Math.floor(accumulator * 60));
        accumulator -= steps / 60;
        busy.current = post({ type: 'advance', steps, buoyancy: current.current.settings.buoyancy });
      }
      if (frame.current && visible.current && !document.hidden) {
        try {
          active.draw(frame.current, Math.min(particleTime.current, 0.1), current.current.settings.field);
          particleTime.current = 0;
        } catch {
          stopped = true; setPlaying(false);
          if (active.kind === 'webgl2') { setFallback(true); setMessage('图形上下文中断，已启用兼容显示。点击播放继续。'); }
          else setFailure('粒子显示中断，请重新载入页面。');
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { stopped = true; cancelAnimationFrame(raf); resize.disconnect(); observer.disconnect(); active.destroy(); renderer.current = null; };
  }, [fallback, settings.renderer]);

  function locate(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0.02, Math.min(0.98, (event.clientX - rect.left) / rect.width)), y: Math.max(0.02, Math.min(0.98, 1 - (event.clientY - rect.top) / rect.height)) };
  }
  function showProbe(x: number, y: number) {
    setProbe({ x, y, visible: true });
    const field = frame.current;
    if (field) sampleProbe(field, x, y);
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = locate(event);
    pointer.current = { ...point, stamp: performance.now() };
    showProbe(point.x, point.y);
    if (tool !== 'push') perturb(tool, point.x, point.y);
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const point = locate(event);
    showProbe(point.x, point.y);
    const previous = pointer.current, now = performance.now();
    if (!previous || now - previous.stamp < 40) return;
    perturb(tool, point.x, point.y, point.x - previous.x, point.y - previous.y, true);
    pointer.current = { ...point, stamp: now };
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === ' ') { event.preventDefault(); togglePlaying(); }
    else if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      showProbe(Math.max(0.03, Math.min(0.97, probe.x + (event.key === 'ArrowRight' ? 0.04 : event.key === 'ArrowLeft' ? -0.04 : 0))), Math.max(0.03, Math.min(0.97, probe.y + (event.key === 'ArrowUp' ? 0.04 : event.key === 'ArrowDown' ? -0.04 : 0))));
    } else if (event.key === 'Enter') {
      event.preventDefault(); perturb(tool, probe.x, probe.y, tool === 'push' ? 0.08 : 0, 0);
      setMessage(`已在光标处${tool === 'heat' ? '加入热扰动' : tool === 'cold' ? '加入冷扰动' : '向右轻推流体'}。`);
    }
  }
  function step() { if (busy.current === null && initialized.current) busy.current = post({ type: 'advance', steps: 1, buoyancy: settings.buoyancy }); }
  async function share() {
    try { await navigator.clipboard.writeText(window.location.href); setMessage('初始设置链接已复制。链接不包含这次的笔触或演化进度。'); }
    catch { setMessage('当前地址栏已保存初始设置，可以直接复制网址。'); }
  }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await fullPanel.current?.requestFullscreen(); }
    catch { setMessage('此浏览器未提供全屏模式，可以放大窗口观看。'); }
  }
  const scene = scenes.find(item => item.id === settings.preset)!;

  return <section className="thermal-page">
    <div className="page-intro thermal-intro"><div><h1>让热的流动，变得可见。</h1><p>一个局部扰动，怎样带动整个流场？</p></div><span className="thermal-type">交互实验 · 二维热对流</span></div>
    <div className="thermal-studio">
      <div className="thermal-main" ref={fullPanel}>
        <div className="thermal-stage-heading"><div><span className="thermal-live-dot" data-playing={playing} /><strong>{scene.name}</strong><span className="thermal-clock">t = {diagnostics?.time.toFixed(2) ?? '0.00'}</span></div><button onClick={fullscreen} aria-label="全屏观看"><Expand size={17} /></button></div>
        <div ref={stage} className={`thermal-stage tool-${tool}`} tabIndex={0} role="group" aria-label="热对流交互画布" aria-describedby="thermal-keyboard" onKeyDown={keyDown} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { pointer.current = null; }} onPointerCancel={() => { pointer.current = null; }} onPointerLeave={() => { if (!pointer.current) setProbe(previous => ({ ...previous, visible: false })); }} data-renderer={backend.kind} data-count={backend.count} data-ready={!!diagnostics} data-time={diagnostics?.time ?? 0}>
          <canvas ref={canvas} key={`${fallback}-${settings.renderer}`} aria-hidden="true" />
          {!diagnostics && !failure && <div className="thermal-loading">正在准备温度场…</div>}
          {failure && <div className="thermal-loading thermal-error"><strong>{failure}</strong><button onClick={() => window.location.reload()}>重新载入</button></div>}
          <span className="thermal-up" aria-hidden="true">高度 <ArrowUp size={12} /></span>
          <span className="thermal-bottom" aria-hidden="true">封闭实验箱</span>
          {probe.visible && <span className="thermal-probe" style={{ left: `${probe.x * 100}%`, top: `${(1 - probe.y) * 100}%` }}><i /><span>T′ {signed(fieldAtProbe)}</span></span>}
        </div>
        <div className="thermal-color-key" aria-label="固定温度色标：蓝色负一，灰色零，红色正一"><span>冷 <b>−1</b></span><div><i /><span>归一化温度异常 T′ · 固定色标</span></div><span><b>+1</b> 热</span></div>
        <div className="thermal-transport"><div><button className="thermal-play" disabled={!diagnostics || !!failure} onClick={togglePlaying} aria-label={playing ? '暂停模拟' : '播放模拟'}>{playing ? <Pause size={17} /> : <Play size={17} />}{playing ? '暂停' : '播放'}</button><button onClick={step} disabled={playing || !diagnostics || !!failure}><SkipForward size={16} />单步</button><button onClick={() => reset()} disabled={!diagnostics || !!failure}><RotateCcw size={15} />重置</button></div><span>{backend.count.toLocaleString()} 粒子 <b>·</b> {backend.kind === 'webgl2' ? 'GPU' : backend.kind === 'canvas2d' ? '兼容显示' : '准备中'}</span></div>
      </div>
      <aside className="thermal-controls" aria-label="实验控制">
        <fieldset><legend>从一个场景开始</legend><div className="thermal-presets">{scenes.map(item => <button key={item.id} onClick={() => chooseScene(item.id)} aria-pressed={settings.preset === item.id}>{item.name}</button>)}</div><p className="thermal-scene-description">{scene.description}</p></fieldset>
        <fieldset><legend>在画布上留下扰动</legend><div className="thermal-tools">{([{ id: 'heat', name: '加热', icon: Flame }, { id: 'cold', name: '冷却', icon: Snowflake }, { id: 'push', name: '搅动', icon: Move }] as const).map(item => <button key={item.id} onClick={() => setTool(item.id)} aria-pressed={tool === item.id}><item.icon size={18} />{item.name}</button>)}</div><label className="thermal-strength">扰动强度 <output>{settings.strength.toFixed(1)}</output><input aria-label="扰动强度" type="range" min="0.2" max="1.5" step="0.1" value={settings.strength} onChange={event => update({ strength: Number(event.target.value) })} /></label></fieldset>
        <div className="thermal-buoyancy"><label><span>温度驱动浮力</span><input type="checkbox" role="switch" checked={settings.buoyancy} onChange={event => update({ buoyancy: event.target.checked })} /></label><p>{settings.buoyancy ? '暖流上升，冷流下沉。流动再把温度带向周围。' : '已停止温度驱动力。已有流动会逐渐衰减，不会立即消失。'}</p><button onClick={() => { update({ buoyancy: false }); reset(); setMessage('已从静止开始纯扩散对照。温度扩散，但不会自行产生流动。'); }}>从静止看纯扩散 <ArrowUpRight size={14} /></button></div>
        <div className="thermal-quick-inputs"><button disabled={!diagnostics || !!failure} onClick={() => { perturb('heat', 0.35, 0.2); setMessage('已在左下部加入热扰动。'); }}><ArrowUp size={14} />加入热扰动</button><button disabled={!diagnostics || !!failure} onClick={() => { perturb('cold', 0.65, 0.8); setMessage('已在右上部加入冷扰动。'); }}><ArrowDown size={14} />加入冷扰动</button></div>
        <details className="thermal-display"><summary>显示与分享</summary><label>显示温度底图<input type="checkbox" checked={settings.field} onChange={event => update({ field: event.target.checked })} /></label><label>粒子密度<select value={settings.quality} onChange={event => update({ quality: event.target.value as ThermalSettings['quality'] })}><option value="low">轻盈</option><option value="medium">细腻</option><option value="high">密集</option></select></label><label>显示模式<select value={settings.renderer} onChange={event => { setFallback(false); update({ renderer: event.target.value as ThermalSettings['renderer'] }); }}><option value="auto">自动 · GPU 优先</option><option value="canvas">兼容 · Canvas 2D</option></select></label><button onClick={share}><Link size={14} />复制实验链接</button><p>分享初始设置，不含笔触和进度。粒子数量不改变计算结果。</p></details>
      </aside>
    </div>
    <div className="thermal-caption"><p>每一粒光点是流动的示踪点，颜色来自它所在位置的温度。红暖蓝冷，零异常为灰色。</p><span>理想化机制实验 · 非历史天气重建</span></div>
    <p className="thermal-action-status" aria-live="polite">{message}</p>
    <div className="thermal-reading"><div><h2>先改变一处，<br />再看周围如何回应。</h2><p>试着在下部加热：暖区产生向上的浮力，带动周围流体补入。流动把温度搬运到新的位置，扩散再慢慢抹平差异。</p><p>点击“从静止看纯扩散”，就能比较：没有温度驱动的运动，同一团热会怎样变化。</p><a href="#replay?case=chongqing2022" className="inline-link">回到真实热浪，看地图上的风与温度 <ArrowUpRight size={15} /></a><br /><a href="#lab" className="inline-link">继续探索下沉增温与地表能量 <ArrowUpRight size={15} /></a></div><div className="thermal-evidence"><h3>计算也要经得起检查。</h3><dl><div><dt>最低 / 最高温度异常</dt><dd>{diagnostics ? `${signed(diagnostics.min)} / ${signed(diagnostics.max)}` : '—'}</dd></div><div><dt>热异常积分误差</dt><dd>{diagnostics?.budgetError.toExponential(2) ?? '—'}</dd></div><div><dt>流场散度 · RMS</dt><dd>{diagnostics?.divergence.toExponential(2) ?? '—'}</dd></div><div><dt>计算网格 / 固定时间步</dt><dd>96 × 60 / 1⁄60</dd></div></dl><p>无量纲时间与温度；误差是相对初始状态和已记录输入的绝对积分差。色标在 ±1 饱和，实际极值见上方。</p></div></div>
    <details className="thermal-method"><summary>模型假设、操作与来源</summary><div><p>这是一个宽 1.6、高 1 的二维封闭流体箱。Boussinesq 近似把温度异常耦合到浮力；四壁不可穿透、无滑移且无热通量。温度由保守有限体积方法推进，速度由平流、黏性与压力投影更新。初始冷热团和每次点击都是有限扰动，不是持续加热器。</p><p>粒子只显示计算结果，不参与热量收支；搅动工具加入机械动量。此模型没有大气压缩、辐射、地形和陆面水分过程，不能用来归因某次热浪，也不能代替已有的干绝热实验。页面不可见时停止推进，不补算离开期间的时间。</p><p id="thermal-keyboard">鼠标或手指可点击、拖动画布。键盘聚焦画布后，用方向键移动光标，Enter 施加当前扰动（搅动模式向右轻推），空格播放或暂停。开启系统“减少动态效果”时默认暂停，可以手动播放或逐步查看。</p><p><a href="/thermal-methods.md" download>下载完整模型说明</a> · <a href="https://github.com/DedalusProject/dedalus/blob/master/examples/ivp_2d_rayleigh_benard/rayleigh_benard.py" target="_blank" rel="noreferrer">Dedalus 热对流方程参考</a> · <a href="https://developer.nvidia.com/gpugems/gpugems/part-vi-beyond-triangles/chapter-38-fast-fluid-dynamics-simulation-gpu" target="_blank" rel="noreferrer">GPU Gems 流体数值方法</a></p></div></details>
  </section>;
}
