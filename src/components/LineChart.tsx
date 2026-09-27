import { useEffect, useId, useRef, useState } from 'react';

export interface PlotPoint { label: string; value: number | null }
interface Props {
  points: PlotPoint[]; selected?: number; onSelect?: (index: number) => void; unit?: string;
  title: string; color?: string; height?: number; formatX?: (label: string) => string;
  reference?: { points: PlotPoint[]; label: string; color?: string }; zero?: boolean;
}
export default function LineChart({ points, selected, onSelect, unit = '°C', title, color = 'var(--heat)', height = 220, formatX, reference, zero = false }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const id = useId();
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(entries => setWidth(Math.max(270, entries[0].contentRect.width)));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const values = [...points, ...(reference?.points ?? [])].flatMap(p => p.value == null ? [] : [p.value]);
  if (!values.length) return <div className="empty-state">此指标暂时没有可用数据。</div>;
  const rawMin = Math.min(...values, ...(zero ? [0] : [])), rawMax = Math.max(...values, ...(zero ? [0] : []));
  const range = rawMax - rawMin;
  const decimalPlaces = unit === 'm³/m³' ? 3 : range < 5 ? 1 : 0;
  const pad = Math.max(range * .12, unit === 'm³/m³' ? .002 : .5);
  const min = rawMin - pad, max = rawMax + pad;
  const left = 43, right = 14, top = 27, bottom = 31;
  const x = (i: number) => left + i / Math.max(1, points.length - 1) * (width - left - right);
  const y = (v: number) => top + (max - v) / (max - min) * (height - top - bottom);
  function path(data: PlotPoint[]) {
    let penDown = false;
    return data.map((p, i) => {
      if (p.value == null || !Number.isFinite(p.value)) { penDown = false; return ''; }
      const command = penDown ? 'L' : 'M'; penDown = true;
      return `${command}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
    }).join(' ');
  }
  const ticks = width < 480 ? 3 : 5;
  const active = selected != null ? points[Math.max(0, Math.min(selected, points.length - 1))] : null;
  return <div className="line-chart" ref={container}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={id} onPointerDown={event => {
      if (!onSelect) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const index = Math.round(((event.clientX - rect.left) * width / rect.width - left) / (width - left - right) * (points.length - 1));
      onSelect(Math.min(points.length - 1, Math.max(0, index)));
    }} style={{ cursor: onSelect ? 'crosshair' : undefined }}>
      <title id={id}>{title}。横轴为日期，纵轴为{unit}。精确数据见下方数值或下载表格。</title>
      {[0, 1, 2, 3].map(t => {
        const value = min + (max - min) * t / 3;
        return <g key={t}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="plot-grid" /><text x={left - 9} y={y(value) + 4} textAnchor="end" className="plot-label">{value.toFixed(decimalPlaces)}</text></g>;
      })}
      {zero && <line x1={left} x2={width - right} y1={y(0)} y2={y(0)} stroke="var(--line)" strokeDasharray="4 4" />}
      {Array.from({ length: ticks }, (_, i) => Math.round(i * (points.length - 1) / (ticks - 1))).map((i, t) => <text key={t} x={x(i)} y={height - 8} textAnchor={t === 0 ? 'start' : t === ticks - 1 ? 'end' : 'middle'} className="plot-label">{formatX ? formatX(points[i].label) : points[i].label}</text>)}
      <text x={left} y={14} className="plot-label">{unit}</text>
      {reference && <path d={path(reference.points)} fill="none" stroke={reference.color ?? 'var(--water)'} strokeWidth="1.6" strokeDasharray="5 5" />}
      <path d={path(points)} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
      {active?.value != null && selected != null && <g><line x1={x(selected)} x2={x(selected)} y1={top} y2={height - bottom} stroke={color} strokeOpacity=".45" /><circle cx={x(selected)} cy={y(active.value)} r={5} fill={color} stroke="var(--surface)" strokeWidth="2" /><text x={Math.max(left + 20, Math.min(width - right - 32, x(selected)))} y={Math.max(19, y(active.value) - 12)} textAnchor="middle" fill={color} className="plot-value">{active.value.toFixed(unit === 'm³/m³' ? 3 : 1)}</text></g>}
    </svg>
    {reference && <div className="plot-legend"><span><i style={{ background: color }} />{title}</span><span><i className="dashed" style={{ borderColor: reference.color ?? 'var(--water)' }} />{reference.label}</span></div>}
  </div>;
}
