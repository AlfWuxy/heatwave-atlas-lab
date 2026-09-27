import { useId } from 'react';

export default function MechanismScene({ mode }: { mode: string }) {
  const id = useId().replace(/:/g, '');
  const captions: Record<string, [string, string]> = {
    radiation: ['太阳辐射到达地表', '地表吸收能量后，与空气和土壤交换热量'],
    advection: ['风可以输送温暖空气', '是否增暖，还取决于上游温度与空间梯度'],
    circulation: ['气团下沉，受到压缩', '干燥气团可在绝热条件下升温'],
    evaporation: ['同一份能量，不同的去向', '一部分用于蒸发，一部分成为感热'],
    'urban-night': ['地表与大气，持续交换能量', '夜间的热环境还受云、湿度与局地储热影响'],
  };
  const copy = captions[mode] ?? captions.radiation;
  const downward = mode === 'circulation';
  return <figure className="mechanism-scene">
    <img src="/images/landscape.png" alt="用于说明能量交换的通用地形插画，不对应实际观测地点" />
    <div className="scene-disclaimer">机制示意 · 非实测轨迹</div>
    <svg key={mode} className="scene-layer" viewBox="0 0 960 300" role="img" aria-label={`${copy[0]}。${copy[1]}`}>
      <defs><marker id={`${id}arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10" fill="none" stroke="var(--heat)" strokeWidth="1.8" /></marker><marker id={`${id}green`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10" fill="none" stroke="var(--water)" strokeWidth="1.8" /></marker></defs>
      {mode === 'radiation' && <g><circle cx="146" cy="93" r="30" fill="var(--sun)" />{Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return <line key={i} x1={146 + Math.cos(a) * 39} y1={93 + Math.sin(a) * 39} x2={146 + Math.cos(a) * 48} y2={93 + Math.sin(a) * 48} stroke="var(--sun)" strokeWidth="1.5" />; })}{[0, 1, 2].map(i => <path key={i} d={`M${182 + i * 24} 110 L${265 + i * 38} 219`} stroke="var(--heat)" strokeWidth="2" fill="none" markerEnd={`url(#${id}arrow)`} />)}</g>}
      {downward && <g><path d="M275 92 Q480 30 690 92" fill="none" stroke="var(--water)" strokeWidth="1.5" />{[385, 480, 575].map(x => <path key={x} d={`M${x} 105 Q${x - 14} 145 ${x} 195`} stroke="var(--heat)" strokeWidth="2" fill="none" markerEnd={`url(#${id}arrow)`} />)}<text x="480" y="44" textAnchor="middle">下沉与压缩</text></g>}
      {mode === 'advection' && <g>{[75, 113, 150].map((y, i) => <path key={y} d={`M130 ${y} Q320 ${y - 40} 470 ${y + 6} T760 ${y + 5}`} stroke={i === 1 ? 'var(--heat)' : 'var(--water)'} strokeWidth={i === 1 ? 2.7 : 1.5} fill="none" markerEnd={`url(#${id}${i === 1 ? 'arrow' : 'green'})`} />)}<text x="235" y="192">暖空气输送</text></g>}
      {mode === 'evaporation' && <g>{[0, 1, 2].map(i => <path key={i} d={`M${300 + i * 22} 215 Q${290 + i * 22} 155 ${310 + i * 22} 105`} stroke="var(--water)" strokeWidth="2" fill="none" markerEnd={`url(#${id}green)`} />)}{[0, 1, 2].map(i => <path key={i} d={`M${595 + i * 22} 220 Q${610 + i * 22} 165 ${595 + i * 22} 100`} stroke="var(--heat)" strokeWidth="2" fill="none" markerEnd={`url(#${id}arrow)`} />)}<text x="320" y="75" textAnchor="middle">潜热 · 蒸发</text><text x="618" y="75" textAnchor="middle">感热 · 加热空气</text></g>}
      {mode === 'urban-night' && <g><circle cx="170" cy="80" r="24" fill="#f6f4ef" />{[420, 520, 620].map(x => <path key={x} d={`M${x} 214 Q${x - 25} 165 ${x + 15} 125`} stroke="var(--heat)" strokeWidth="2" fill="none" markerEnd={`url(#${id}arrow)`} />)}<text x="520" y="92" textAnchor="middle">夜间热交换</text></g>}
      <text x="900" y="270" textAnchor="end" className="scene-caption-svg">概念插画，不表示实际地形</text>
    </svg>
    <figcaption><strong>{copy[0]}</strong><span>{copy[1]}</span></figcaption>
  </figure>;
}
