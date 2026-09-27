import { useEffect, useId, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { dryAdiabaticParcel, partitionSurfaceEnergy, POISSON_EXPONENT } from '../lib/physics';
import type { AirParcelInput, AirParcelResult, SurfaceEnergyResult } from '../lib/physics';
import './heat-lab.css';

type Experiment = 'parcel' | 'surface';
const INITIAL_PARCEL: AirParcelInput = { initialTemperatureC: 20, initialPressureHpa: 850, finalPressureHpa: 1000 };
const signed = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}`;

type ParameterProps = {
  label: string;
  symbol: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  accent?: boolean;
  description?: string;
  onChange: (value: number) => void;
};

function Parameter({ label, symbol, value, min, max, step = 1, unit, accent, description, onChange }: ParameterProps) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const numeric = Number(draft);
  const invalid = draft.trim() === '' || !Number.isFinite(numeric) || numeric < min || numeric > max;
  const commit = () => {
    const next = draft.trim() === '' || !Number.isFinite(numeric) ? value : Math.min(max, Math.max(min, numeric));
    const rounded = Math.round(next / step) * step;
    onChange(rounded);
    setDraft(String(rounded));
  };
  return <div className={`lab-parameter${accent ? ' lab-parameter-accent' : ''}`}>
    <div className="lab-parameter-top">
      <label htmlFor={`${id}-range`}>{label} <span className="lab-symbol">{symbol}</span></label>
      <div className="lab-number-wrap">
        <input id={`${id}-number`} aria-label={`${label}数值`} type="number" min={min} max={max} step={step} value={draft}
          aria-invalid={invalid} aria-describedby={description ? `${id}-hint` : undefined}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            const parsed = Number(next);
            if (next.trim() !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max) onChange(parsed);
          }} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') { commit(); event.currentTarget.blur(); } }} />
        <span>{unit}</span>
      </div>
    </div>
    <input id={`${id}-range`} className="lab-slider" type="range" min={min} max={max} step={step} value={value}
      aria-describedby={description ? `${id}-hint` : undefined} aria-valuetext={`${value} ${unit}`}
      style={{ '--lab-progress': `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
      onChange={(event) => { const next = Number(event.target.value); onChange(next); setDraft(String(next)); }} />
    <div className="lab-range-limits" aria-hidden="true"><span>{min}</span><span>{max}</span></div>
    {description && <p className="lab-control-hint" id={`${id}-hint`}>{description}</p>}
  </div>;
}

function ParcelDiagram({ input, result }: { input: AirParcelInput; result: AirParcelResult }) {
  const uniqueId = useId().replace(/:/g, '');
  const y = (pressure: number) => 108 + ((pressure - 500) / 550) * 222;
  const startY = y(input.initialPressureHpa);
  const endY = y(input.finalPressureHpa);
  const finalRadius = 48 * Math.cbrt(result.relativeVolume);
  const changeLabel = result.temperatureChangeC > 0.00001 ? '压缩之后' : result.temperatureChangeC < -0.00001 ? '膨胀之后' : '等压状态';
  const particles = [[-0.4, -0.2], [0.1, -0.45], [0.4, -0.05], [-0.05, 0.12], [-0.35, 0.42], [0.35, 0.42], [0.04, 0.58], [0.45, -0.4]];
  return <svg className="lab-parcel-diagram" viewBox="0 0 650 435" role="img" aria-labelledby={`${uniqueId}-title ${uniqueId}-desc`}>
    <title id={`${uniqueId}-title`}>气团在压力坐标中的初始与最终状态</title>
    <desc id={`${uniqueId}-desc`}>初始气压 {input.initialPressureHpa} hPa，温度 {input.initialTemperatureC} 摄氏度。最终气压 {input.finalPressureHpa} hPa，温度 {result.finalTemperatureC.toFixed(1)} 摄氏度。气压向下增大，不代表实际高度。圆半径按理想气团的相对体积调整。</desc>
    <defs>
      <radialGradient id={`${uniqueId}-initial`}><stop offset="0" stopColor="#eef6fc" /><stop offset="1" stopColor="#a7c9e1" /></radialGradient>
      <radialGradient id={`${uniqueId}-final`}><stop offset="0" stopColor="#fff4eb" /><stop offset="1" stopColor="#efb18c" /></radialGradient>
      <marker id={`${uniqueId}-arrow`} markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="#969ca6" strokeWidth="1.2" /></marker>
    </defs>
    <text x="22" y="32" className="lab-svg-axis-name">气压</text><text x="22" y="53" className="lab-svg-note">hPa</text>
    <line x1="77" y1="76" x2="77" y2="364" className="lab-svg-axis" markerEnd={`url(#${uniqueId}-arrow)`} />
    {[500, 650, 800, 950, 1050].map((pressure) => <g key={pressure}><line x1="71" y1={y(pressure)} x2="610" y2={y(pressure)} className="lab-svg-grid" /><text x="61" y={y(pressure) + 5} textAnchor="end" className="lab-svg-tick">{pressure}</text></g>)}
    <path d={`M ${207 + 58},${startY} C 335,${startY} 350,${endY} ${465 - finalRadius - 20},${endY}`} fill="none" stroke="#afb4bd" strokeWidth="1.6" strokeDasharray="5 5" markerEnd={`url(#${uniqueId}-arrow)`} />
    <g transform={`translate(207,${startY})`}>
      <text y="-78" textAnchor="middle" className="lab-svg-parcel-label">初始气团</text>
      <text y="-56" textAnchor="middle" className="lab-svg-note">{input.initialPressureHpa} hPa</text>
      <circle r="48" fill={`url(#${uniqueId}-initial)`} stroke="#b3cfe2" />
      {particles.map(([x, dy], index) => <circle key={index} cx={x * 48} cy={dy * 48} r="2.3" fill="#7ba8c8" />)}
      <rect x="-43" y="-11" width="86" height="28" rx="10" fill="#edf5fa" opacity="0.88" />
      <text y="9" textAnchor="middle" className="lab-svg-value">{input.initialTemperatureC.toFixed(1)} °C</text>
    </g>
    <g transform={`translate(465,${endY})`}>
      <text y={-finalRadius - 30} textAnchor="middle" className="lab-svg-parcel-label">{changeLabel}</text>
      <text y={-finalRadius - 10} textAnchor="middle" className="lab-svg-note">{input.finalPressureHpa} hPa</text>
      <circle r={finalRadius} fill={`url(#${uniqueId}-final)`} stroke="#e5ad8c" />
      {particles.map(([x, dy], index) => <circle key={index} cx={x * finalRadius} cy={dy * finalRadius} r="2.3" fill="#c9652d" />)}
      <rect x="-43" y="-11" width="86" height="28" rx="10" fill="#fff0e6" opacity="0.92" />
      <text y="9" textAnchor="middle" className="lab-svg-value lab-svg-warm">{result.finalTemperatureC.toFixed(1)} °C</text>
    </g>
    <text x="80" y="413" className="lab-svg-note">压力坐标 · 非实际高度</text>
  </svg>;
}

function ProcessCurve({ input }: { input: AirParcelInput }) {
  const id = useId();
  const steps = Array.from({ length: 51 }, (_, i) => {
    const pressure = 500 + i * 11;
    return { pressure, temperature: dryAdiabaticParcel({ ...input, finalPressureHpa: pressure }).finalTemperatureC };
  });
  const minimum = Math.floor(steps[0].temperature / 10) * 10;
  const maximum = Math.ceil(steps[50].temperature / 10) * 10;
  const px = (pressure: number) => 64 + ((pressure - 500) / 550) * 516;
  const py = (temperature: number) => 118 - ((temperature - minimum) / (maximum - minimum)) * 85;
  const line = steps.map((point, i) => `${i === 0 ? 'M' : 'L'}${px(point.pressure)},${py(point.temperature)}`).join(' ');
  const start = dryAdiabaticParcel({ ...input, finalPressureHpa: input.initialPressureHpa });
  const end = dryAdiabaticParcel(input);
  return <div className="lab-process-curve">
    <div className="lab-figure-caption"><span>沿同一条干绝热线</span><span>温度随气压的变化</span></div>
    <svg viewBox="0 0 650 170" role="img" aria-labelledby={id}>
      <title id={id}>固定初始状态的压力—温度曲线。蓝灰点是初始状态，橙点是最终状态。</title>
      {[minimum, (minimum + maximum) / 2, maximum].map((temperature) => <g key={temperature}><line x1="64" y1={py(temperature)} x2="580" y2={py(temperature)} className="lab-svg-grid" /><text x="52" y={py(temperature) + 4} textAnchor="end" className="lab-svg-tick">{temperature.toFixed(0)}°</text></g>)}
      <path d={line} fill="none" stroke="#b4bac3" strokeWidth="2" />
      <path d={steps.filter((point) => point.pressure >= Math.min(input.initialPressureHpa, input.finalPressureHpa) && point.pressure <= Math.max(input.initialPressureHpa, input.finalPressureHpa)).map((point, i) => `${i === 0 ? 'M' : 'L'}${px(point.pressure)},${py(point.temperature)}`).join(' ')} fill="none" stroke="#bf4800" strokeWidth="2.5" />
      <circle cx={px(input.initialPressureHpa)} cy={py(start.finalTemperatureC)} r="5" fill="#527a95" stroke="#ffffff" strokeWidth="2" />
      <circle cx={px(input.finalPressureHpa)} cy={py(end.finalTemperatureC)} r="5" fill="#bf4800" stroke="#ffffff" strokeWidth="2" />
      {[500, 750, 1050].map((pressure) => <text key={pressure} x={px(pressure)} y="144" textAnchor="middle" className="lab-svg-tick">{pressure}</text>)}
      <text x="604" y="144" className="lab-svg-note">hPa</text>
    </svg>
  </div>;
}

function EnergyDiagram({ result }: { result: SurfaceEnergyResult }) {
  const id = useId().replace(/:/g, '');
  const flow = [
    { key: 'latent', x: 140, color: '#527a95', value: result.latentHeat, name: '潜热 LE', explanation: '蒸发所用的能量' },
    { key: 'sensible', x: 360, color: '#bf4800', value: result.sensibleHeat, name: '感热 H', explanation: '地表与空气的显热交换' },
  ];
  const parts = [
    { key: 'latent', name: '潜热 LE', value: result.latentHeat, color: '#7899b0' },
    { key: 'sensible', name: '感热 H', value: result.sensibleHeat, color: '#c87843' },
    { key: 'storage', name: '地面／储热 S', value: result.storage, color: '#b8bdc5' },
  ];
  let offset = 0;
  return <div className="lab-energy-visual">
    <svg className="lab-energy-diagram" viewBox="0 0 650 415" role="img" aria-labelledby={`${id}-title ${id}-desc`}>
      <title id={`${id}-title`}>理想化地表净辐射的能量分配</title>
      <desc id={`${id}-desc`}>净辐射 {result.netRadiation.toFixed(1)} 瓦每平方米；潜热 {result.latentHeat.toFixed(1)}，感热 {result.sensibleHeat.toFixed(1)}，地面或储热 {result.storage.toFixed(1)}。三个分项之和等于净辐射。</desc>
      <defs>{[...flow, { key: 'incoming', color: '#b8986c' }, { key: 'storage', color: '#9b9faa' }].map((item) => <marker key={item.key} id={`${id}-${item.key}`} markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke={item.color} strokeWidth="1.3" /></marker>)}</defs>
      <path d="M66,259 C172,247 232,267 318,259 S463,250 602,259" fill="none" stroke="#a5a9b1" strokeWidth="2" />
      <path d="M66,259 C172,247 232,267 318,259 S463,250 602,259 L602,319 L66,319 Z" fill="#e5e7eb" />
      <path d="M66,259 C172,247 232,267 318,259 S463,250 602,259" fill="none" stroke="#a5a9b1" strokeWidth="2" />
      <text x="540" y="56" textAnchor="middle" className="lab-svg-parcel-label">净辐射 Rₙ</text>
      <text x="540" y="82" textAnchor="middle" className="lab-svg-value">{result.netRadiation.toFixed(0)} W/m²</text>
      <line x1="540" y1="103" x2="540" y2="240" stroke="#b8986c" strokeWidth="5" markerEnd={`url(#${id}-incoming)`} />
      {flow.map((item) => <g key={item.key}>
        <text x={item.x} y="56" textAnchor="middle" className="lab-svg-parcel-label">{item.name}</text>
        <text x={item.x} y="82" textAnchor="middle" className="lab-svg-value" fill={item.color}>{item.value.toFixed(1)} W/m²</text>
        <text x={item.x} y="108" textAnchor="middle" className="lab-svg-note">{item.explanation}</text>
        {item.value > 0 ? <line x1={item.x} y1="242" x2={item.x} y2="140" stroke={item.color} strokeWidth={2 + (item.value / result.netRadiation) * 13} markerEnd={`url(#${id}-${item.key})`} /> : <line x1={item.x} y1="235" x2={item.x} y2="152" stroke={item.color} strokeWidth="1" strokeDasharray="4 6" />}
      </g>)}
      {result.storage > 0 && <line x1="292" y1="275" x2="292" y2="313" stroke="#9b9faa" strokeWidth={2 + (result.storage / result.netRadiation) * 10} markerEnd={`url(#${id}-storage)`} />}
      <text x="324" y="299" className="lab-svg-note">地面／储热 S</text>
      <text x="292" y="352" textAnchor="middle" className="lab-svg-value">{result.storage.toFixed(1)} W/m²</text>
      <text x="70" y="403" className="lab-svg-note">理想分配 · 非实测天气</text>
    </svg>
    <div className="lab-energy-budget">
      <div className="lab-figure-caption"><span>每一份能量，都有去向</span><span>总量 {result.netRadiation.toFixed(0)} W/m²</span></div>
      <svg viewBox="0 0 650 62" role="img" aria-label="分配条：蓝灰色为潜热，橙色为感热，灰色为地面和储热。数值见下方。">
        {parts.map((part) => {
          const x = offset;
          const width = (part.value / result.netRadiation) * 650;
          offset += width;
          return <rect key={part.key} x={x} y="15" width={width} height="30" fill={part.color} />;
        })}
      </svg>
      <dl className="lab-budget-legend">{parts.map((part) => <div key={part.key}><dt><i style={{ background: part.color }} aria-hidden="true" />{part.name}</dt><dd>{part.value.toFixed(1)} <span>W/m²</span></dd></div>)}</dl>
      <p className="lab-rounding-note">显示值经过四舍五入，闭合校验使用未舍入数值。</p>
    </div>
  </div>;
}

export default function HeatLab() {
  const [active, setActive] = useState<Experiment>('parcel');
  const [input, setInput] = useState<AirParcelInput>(INITIAL_PARCEL);
  const [radiation, setRadiation] = useState(500);
  const [storage, setStorage] = useState(15);
  const [evaporation, setEvaporation] = useState(55);
  const [resetCount, setResetCount] = useState(0);
  const parcel = dryAdiabaticParcel(input);
  const energy = partitionSurfaceEnergy({ netRadiation: radiation, storageFraction: storage / 100, evaporativeFraction: evaporation / 100 });
  const id = useId();
  const updateParcel = (key: keyof AirParcelInput, value: number) => setInput((current) => ({ ...current, [key]: value }));
  const switchWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next: Experiment = event.key === 'Home' ? 'parcel' : event.key === 'End' ? 'surface' : active === 'parcel' ? 'surface' : 'parcel';
    setActive(next);
    document.getElementById(`${id}-${next}-tab`)?.focus();
  };
  const reset = () => {
    if (active === 'parcel') setInput(INITIAL_PARCEL);
    else { setRadiation(500); setStorage(15); setEvaporation(55); }
    setResetCount((current) => current + 1);
  };
  return <section className="lab-root" aria-labelledby={`${id}-heading`}>
    <header className="lab-heading">
      <h1 id={`${id}-heading`}>改变一个条件，<wbr />看热量如何变化。</h1>
      <p>理想化实验，帮助理解机制。<a className="inline-link" href="#particles">打开粒子热场 ↗</a></p>
    </header>
    <div className="lab-tabs" role="tablist" aria-label="选择热量实验">
      {([['parcel', '气团压缩'], ['surface', '地表能量分配']] as const).map(([key, label]) => <button key={key} type="button" role="tab" id={`${id}-${key}-tab`} aria-selected={active === key} aria-controls={`${id}-${key}-panel`} tabIndex={active === key ? 0 : -1} className={`lab-tab${active === key ? ' lab-tab-active' : ''}`} onKeyDown={switchWithKeyboard} onClick={() => setActive(key)}>{label}</button>)}
    </div>
    <div key={active} className="state-enter" role="tabpanel" id={`${id}-${active}-panel`} aria-labelledby={`${id}-${active}-tab`}>
      <div className="lab-workspace">
        <div className="lab-figure-column">
          {active === 'parcel' ? <><ParcelDiagram input={input} result={parcel} /><ProcessCurve input={input} /></> : <EnergyDiagram result={energy} />}
        </div>
        <div className="lab-controls" key={`${active}-${resetCount}`}>
          {active === 'parcel' ? <>
            <Parameter label="初始温度" symbol="T₁" value={input.initialTemperatureC} min={-30} max={40} unit="°C" onChange={(value) => updateParcel('initialTemperatureC', value)} />
            <Parameter label="初始气压" symbol="p₁" value={input.initialPressureHpa} min={500} max={1050} unit="hPa" onChange={(value) => updateParcel('initialPressureHpa', value)} />
            <Parameter label="最终气压" symbol="p₂" value={input.finalPressureHpa} min={500} max={1050} unit="hPa" accent onChange={(value) => updateParcel('finalPressureHpa', value)} />
            <div className="lab-result" aria-live="polite" aria-atomic="true">
              <span className="lab-result-label">理想化最终温度</span>
              <output className="lab-result-number">{parcel.finalTemperatureC.toFixed(1)} <span>°C</span></output>
              <div className="lab-result-secondary"><span>温度变化 <strong>{signed(parcel.temperatureChangeC)} °C</strong></span><span>位温 <strong>{parcel.finalPotentialTemperatureK.toFixed(1)} K</strong><small>过程前后保持不变</small></span></div>
            </div>
            <p className="lab-formula">T₂ = T₁ × (p₂ / p₁)<sup>{POISSON_EXPONENT.toFixed(3)}</sup><span>公式中的温度使用 K 计算。</span></p>
          </> : <>
            <Parameter label="净辐射" symbol="Rₙ" value={radiation} min={100} max={800} step={10} unit="W/m²" onChange={setRadiation} description="手动设定的净能量输入，已包含入射与出射辐射。" />
            <Parameter label="地面／储热份额" symbol="s" value={storage} min={0} max={40} unit="%" onChange={setStorage} description="占净辐射的份额，其余用于感热和潜热交换。" />
            <Parameter label="蒸发份额" symbol="EF" value={evaporation} min={0} max={100} unit="%" accent onChange={setEvaporation} description="占剩余可用能量 H + LE 的份额，不是土壤湿度。" />
            <div className="lab-result" aria-live="polite" aria-atomic="true">
              <span className="lab-result-label">分配给感热 H 的能量</span>
              <output className="lab-result-number lab-result-energy">{energy.sensibleHeat.toFixed(1)} <span>W/m²</span></output>
              <div className="lab-result-secondary"><span>可用能量 <strong>{energy.availableEnergy.toFixed(1)} W/m²</strong></span><span>闭合残差 <strong>{Math.abs(energy.closureResidual).toFixed(1)} W/m²</strong></span></div>
            </div>
            <p className="lab-formula">Rₙ = H + LE + S<span>本实验不把能量通量换算为近地面气温。</span></p>
          </>}
          <div className="lab-reset-row"><button className="lab-reset" type="button" onClick={reset}><svg width="15" height="15" viewBox="0 0 18 18" aria-hidden="true"><path d="M3.2 6A6.2 6.2 0 1 1 2.8 11M3.2 2.5V6h3.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>重置参数</button></div>
        </div>
      </div>
      <div className="lab-explanations">
        <div><h2>实验告诉我们什么</h2>{active === 'parcel' ? <p>当气团被压缩时，外界对它做功，温度可以在没有热量传入的情况下上升。反过来，气团膨胀做功会降温。在这里设定的干绝热过程中，位温保持不变。把最终气压调低，可以观察同一个原理的另一面。</p> : <p>净辐射和地面／储热固定时，分配给蒸发的能量越多，留给感热的能量就越少。这个能量约束帮助我们理解：水分是否可用于蒸发，为什么会影响地表与空气之间的热交换。</p>}</div>
        <div><h2>实验没有包含什么</h2>{active === 'parcel' ? <p>这里假定理想干空气、恒定比热、可逆且无热交换，未考虑凝结、辐射、混合和地表交换。气压不是高度的直接替代；该实验也不能计算某场热浪中下沉贡献了多少摄氏度。</p> : <p>蒸发份额是手动输入，不由土壤湿度、植被或空气湿度推算。这里没有求解完整的地表温度、空气运动或边界层过程，所以无法预测浇水后的实际降温，也不输出 2 米气温。</p>}
          <details className="lab-sources"><summary>来源与公式</summary>{active === 'parcel' ? <div><p>使用泊松关系，R<sub>d</sub> = 287.05 J/(kg·K)，c<sub>p</sub> = 1004 J/(kg·K)，θ = T × (1000 / p)<sup>R<sub>d</sub>/c<sub>p</sub></sup>。T 为 K，p 为 hPa；图中相对体积按固定质量下 V ∝ T/p 计算。</p><ul><li><a href="https://glossary.ametsoc.org/wiki/potential-temperature/" target="_blank" rel="noreferrer">AMS：位温与泊松关系</a></li><li><a href="https://doi.org/10.1038/s41467-023-36289-3" target="_blank" rel="noreferrer">White 等（2023）：北美太平洋西北地区热浪的多种形成过程</a></li></ul></div> : <div><p>令 S = Rₙ × s，A = Rₙ − S，LE = A × EF，H = A × (1 − EF)。这里将地面通量和储热合并为 S，采用正净输入、向外感热与潜热的记号。白天正通量的简化分配不等于完整地表模型，也未运行 Penman–Monteith 方程。</p><ul><li><a href="https://www.fao.org/4/X0490E/x0490e04.htm" target="_blank" rel="noreferrer">FAO Irrigation and Drainage Paper 56：地表能量平衡</a></li></ul></div>}</details>
        </div>
      </div>
    </div>
  </section>;
}
