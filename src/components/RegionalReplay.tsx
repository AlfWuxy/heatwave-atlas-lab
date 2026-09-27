import { useEffect, useMemo, useRef, useState } from 'react';
import { Map, Marker, NavigationControl, ScaleControl, setWorkerUrl, type StyleSpecification, type LngLatBoundsLike } from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { ArrowUpRight, Download, LocateFixed, Pause, Play, Wind } from 'lucide-react';
import { RegionalFlowLayer } from '../lib/regional-layer';
import { type RegionalField, sampleRegionalField } from '../lib/regional-field';
import { type CaseData, useData, timeLabel, coordinates } from '../lib/data';
import 'maplibre-gl/dist/maplibre-gl.css';
import './regional-replay.css';

// 显式打包地图工作线程，生产环境不依赖外部脚本或动态执行。
setWorkerUrl(mapWorkerUrl);
type RegionalData = {
  schemaVersion: string; caseId: string; title: string;
  grid: { nx: number; ny: number; lons: number[]; lats: number[]; spacing: number; crs: string; order: string };
  times: string[]; temperature: number[][]; u: number[][]; v: number[][];
  units: { temperature: string; wind: string }; retrievedAt: string;
  source: { label: string; documentationUrl: string; datasetUrl: string; attribution: string };
};
type Props = { data: CaseData; position: number; playing: boolean; speed: number; onPosition: (value: number) => void; onPlaying: () => void; onSpeed: (speed: number) => void; localTime: boolean };

function validate(data: RegionalData, caseData: CaseData) {
  if (data.caseId !== caseData.id || data.grid.crs !== 'EPSG:4326' || data.units.temperature !== '°C' || data.units.wind !== 'm/s') throw new Error('区域数据标识、坐标或单位不匹配。');
  const { nx, ny, lons, lats } = data.grid;
  if (nx !== lons.length || ny !== lats.length || nx < 2 || ny < 2 || data.grid.order !== 'south-to-north, west-to-east') throw new Error('区域格点排列不完整。');
  for (const axis of [lons, lats]) if (axis.some((n, i) => !Number.isFinite(n) || (i > 0 && Math.abs(n - axis[i - 1] - data.grid.spacing) > 1e-6))) throw new Error('区域坐标间距不一致。');
  if (data.times.length !== caseData.rows.length || data.times.some((time, i) => Date.parse(time) !== Date.parse(caseData.rows[i].time))) throw new Error('区域数据与案例小时不对齐。');
  for (const series of [data.temperature, data.u, data.v]) if (series.length !== data.times.length || series.some(row => row.length !== nx * ny || row.some(value => !Number.isFinite(value)))) throw new Error('区域数据含有缺测，不能继续插值。');
  return data;
}

export default function RegionalReplay(props: Props) {
  const request = useData<RegionalData>(`/data/regional-${props.data.id}.json`);
  const checked = useMemo(() => {
    if (!request.data) return { data: null, error: null };
    try { return { data: validate(request.data, props.data), error: null }; }
    catch (error) { return { data: null, error: error instanceof Error ? error.message : '区域资料未通过检查。' }; }
  }, [request.data, props.data]);
  if (!checked.data) return <section className="regional-pending"><h2>区域风温地图</h2><p>{checked.error || request.error || '正在载入逐小时区域风温格点…'}</p>{(checked.error || request.error) && <button onClick={request.reload}>重新读取区域数据</button>}<span>下面的代表格点曲线仍可独立查看。</span></section>;
  return <RegionalMap key={checked.data.caseId} {...props} region={checked.data} />;
}

function RegionalMap({ data, region, position, playing, speed, onPosition, onPlaying, onSpeed, localTime }: Props & { region: RegionalData }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const flow = useRef<RegionalFlowLayer | null>(null);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState('');
  const [tileWarning, setTileWarning] = useState(false);
  const [showTemperature, setShowTemperature] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [animate, setAnimate] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [count, setCount] = useState(0);
  const [selected, setSelected] = useState({ lon: data.gridLocation.longitude, lat: data.gridLocation.latitude });
  const [status, setStatus] = useState('点击地图，读取最近的原始格点。');
  const visible = useRef(true);
  const index = Math.max(0, Math.min(region.times.length - 1, position));
  const field = useMemo<RegionalField>(() => ({ nx: region.grid.nx, ny: region.grid.ny, lons: region.grid.lons, lats: region.grid.lats, temperature: region.temperature[index], u: region.u[index], v: region.v[index] }), [region, index]);
  const current = useRef({ field, animate, showTemperature, showParticles });
  current.current = { field, animate, showTemperature, showParticles };
  const clock = region.times[index];
  const zone = localTime ? data.timezone : 'UTC';
  const bounds = useMemo<LngLatBoundsLike>(() => [[region.grid.lons[0], region.grid.lats[0]], [region.grid.lons.at(-1)!, region.grid.lats.at(-1)!]], [region]);
  const chosen = sampleRegionalField(field, selected.lon, selected.lat);
  const min = Math.min(...field.temperature), max = Math.max(...field.temperature);

  function selectGrid(lon: number, lat: number) {
    const { lons, lats, spacing } = region.grid;
    if (lon < lons[0] || lon > lons.at(-1)! || lat < lats[0] || lat > lats.at(-1)!) { setStatus('这里位于本次下载范围之外，没有区域气象值。'); return; }
    const i = Math.max(0, Math.min(lons.length - 1, Math.round((lon - lons[0]) / spacing)));
    const j = Math.max(0, Math.min(lats.length - 1, Math.round((lat - lats[0]) / spacing)));
    setSelected({ lon: lons[i], lat: lats[j] });
    setStatus(`已选择 ${coordinates({ latitude: lats[j], longitude: lons[i] })} 的原始格点。`);
  }

  useEffect(() => {
    if (!container.current) return;
    let map: Map | null = null, anchorMarker: Marker | null = null, disposed = false;
    const abort = new AbortController();
    const resize = new ResizeObserver(() => map?.resize());
    resize.observe(container.current);
    const visibility = () => flow.current?.setOptions({ animate: current.current.animate && visible.current && !document.hidden });
    const observer = new IntersectionObserver(([entry]) => { visible.current = entry.isIntersecting; visibility(); }, { threshold: 0.03 });
    observer.observe(container.current);
    document.addEventListener('visibilitychange', visibility);
    fetch('/map-style.json', { signal: abort.signal }).then(response => { if (!response.ok) throw new Error('地图样式无法读取。'); return response.json() as Promise<StyleSpecification>; }).then(style => {
      if (disposed || !container.current) return;
      map = new Map({ container: container.current, style, bounds, fitBoundsOptions: { padding: { top: 80, bottom: 40, left: 36, right: 36 }, duration: 0 }, maxZoom: 9, minZoom: 3, pitch: 0, bearing: 0, maxPitch: 0, dragRotate: false, touchPitch: false, cooperativeGestures: true, renderWorldCopies: false, attributionControl: { compact: false }, canvasContextAttributes: { antialias: true } });
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');
      map.on('error', () => setTileWarning(true));
      map.on('webglcontextlost', () => { setReady(false); setFailure('图形上下文暂时中断，正在等待浏览器恢复。'); });
      map.on('click', event => selectGrid(event.lngLat.lng, event.lngLat.lat));
      map.on('style.load', () => {
        if (!map || disposed) return;
        try {
          // 恢复上下文时普通源可能已由地图重建；只替换自己的 GPU 层。
          if (map.getLayer('regional-weather')) map.removeLayer('regional-weather');
          else flow.current?.dispose();
          const layer = new RegionalFlowLayer('regional-weather', window.innerWidth < 680 ? 8192 : 32768);
          layer.setField(current.current.field, true);
          layer.setOptions({ animate: current.current.animate && visible.current && !document.hidden, showTemperature: current.current.showTemperature, showParticles: current.current.showParticles });
          map.addLayer(layer, map.getLayer('weather-extent') ? 'weather-extent' : undefined);
          flow.current = layer; setCount(layer.count);
          const west = region.grid.lons[0], east = region.grid.lons.at(-1)!, south = region.grid.lats[0], north = region.grid.lats.at(-1)!;
          const lines: [number, number][][] = [];
          for (let lat = Math.ceil(south); lat <= north; lat++) lines.push([[west, lat], [east, lat]]);
          for (let lon = Math.ceil(west); lon <= east; lon++) lines.push([[lon, south], [lon, north]]);
          if (!map.getSource('weather-extent')) map.addSource('weather-extent', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[west, south], [east, south], [east, north], [west, north], [west, south]] } } });
          if (!map.getLayer('weather-extent')) map.addLayer({ id: 'weather-extent', type: 'line', source: 'weather-extent', paint: { 'line-color': '#f0f3f7', 'line-opacity': 0.75, 'line-width': 1.1, 'line-dasharray': [4, 4] } });
          if (!map.getSource('weather-grid')) map.addSource('weather-grid', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: lines } } });
          if (!map.getLayer('weather-grid')) map.addLayer({ id: 'weather-grid', type: 'line', source: 'weather-grid', paint: { 'line-color': '#dae4f4', 'line-opacity': 0.12, 'line-width': 0.6 } });
          const anchor = document.createElement('span'); anchor.className = 'regional-anchor'; anchor.textContent = `${data.title.split(' · ')[0]} · 曲线代表格点`;
          anchorMarker?.remove();
          anchorMarker = new Marker({ element: anchor, anchor: 'bottom' }).setLngLat([data.gridLocation.longitude, data.gridLocation.latitude]).addTo(map);
          setFailure(''); setReady(true);
        } catch (error) { setFailure(error instanceof Error ? error.message : '图形图层未能启动。'); }
      });
    }).catch(error => { if (!disposed && error.name !== 'AbortError') setFailure('交互地图无法载入。可以继续查看下方曲线与下载区域格点。'); });
    return () => { disposed = true; abort.abort(); resize.disconnect(); observer.disconnect(); document.removeEventListener('visibilitychange', visibility); map?.remove(); mapRef.current = null; flow.current = null; };
  }, [data, region, bounds]);

  useEffect(() => { flow.current?.setField(field, true); }, [field]);
  useEffect(() => { flow.current?.setOptions({ animate: animate && visible.current && !document.hidden, showTemperature, showParticles }); }, [animate, showTemperature, showParticles]);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handle = () => { if (preference.matches) setAnimate(false); };
    preference.addEventListener('change', handle);
    return () => preference.removeEventListener('change', handle);
  }, []);
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const dot = document.createElement('span'); dot.className = 'regional-selected-point';
    const marker = new Marker({ element: dot }).setLngLat([selected.lon, selected.lat]).addTo(mapRef.current);
    return () => { marker.remove(); };
  }, [selected, ready]);

  const windSpeed = chosen ? Math.hypot(chosen.u, chosen.v) : null;
  const windFrom = chosen && windSpeed! > 0.05 ? (Math.atan2(-chosen.u, -chosen.v) * 180 / Math.PI + 360) % 360 : null;
  return <section className="regional-section" aria-labelledby="regional-heading">
    <div className="regional-heading"><div><span>REAL-WORLD REPLAY</span><h2 id="regional-heading">回到热浪发生的地方。</h2></div><p>区域近地面风温 · ERA5 再分析</p></div>
    <div className="regional-shell">
      <div className="regional-map-top"><strong>{region.title}</strong><span>{timeLabel(clock, zone)} {localTime ? '当地时间' : 'UTC'}</span></div>
      <div className="regional-map-wrap">
        <div ref={container} className="regional-map" role="region" aria-label="真实案例区域风温地图" data-ready={ready} data-case={data.id} data-hour={clock} data-particles={count} />
        {(!ready || failure) && <div className="regional-map-message">{failure || '正在准备地理底图与风温图层…'}</div>}
        <div className="regional-probe"><span>选中原始格点 · 2米气温</span><strong>{chosen?.temperature.toFixed(1) ?? '—'}<small>°C</small></strong><p><Wind size={13} />{windSpeed?.toFixed(1) ?? '—'} m/s <span>10米风{windFrom == null ? '' : ` · 来向${windFrom.toFixed(0)}°`}</span></p><small>{Math.abs(selected.lat).toFixed(2)}°{selected.lat >= 0 ? 'N' : 'S'} · {Math.abs(selected.lon).toFixed(2)}°{selected.lon >= 0 ? 'E' : 'W'}</small></div>
        <button className="regional-reset" onClick={() => mapRef.current?.fitBounds(bounds, { padding: { top: 85, bottom: 40, left: 36, right: 36 }, duration: 0 })}><LocateFixed size={15} />回到数据范围</button>
      </div>
      <div className="regional-legend"><span>12°C</span><div aria-label="固定温度色标12至42摄氏度，低温蓝色，高温红色"><i /><span>2米气温 · 摄氏度 · 固定色标</span></div><span>42°C</span><p>此刻区域格点 {min.toFixed(1)}–{max.toFixed(1)}°C</p></div>
      <div className="regional-time"><button onClick={onPlaying} aria-label={playing ? '暂停地图时间回放' : '播放地图时间回放'}>{playing ? <Pause size={17} /> : <Play size={17} />}</button><input type="range" min={0} max={region.times.length-1} value={index} aria-label="地图回放时刻" aria-valuetext={clock} onChange={event => onPosition(Number(event.target.value))} /><label><span className="sr-only">地图时间回放速度</span><select value={speed} onChange={event => onSpeed(Number(event.target.value))}><option value={1}>1×</option><option value={3}>3×</option><option value={6}>6×</option></select></label><time dateTime={clock}>{timeLabel(clock, zone)}</time></div>
      <div className="regional-tools"><label><input type="checkbox" checked={showTemperature} onChange={event => setShowTemperature(event.target.checked)} />温度色面</label><label><input type="checkbox" checked={showParticles} onChange={event => setShowParticles(event.target.checked)} />风向粒子</label><button aria-pressed={animate} onClick={() => setAnimate(value => !value)}>{animate ? <Pause size={13} /> : <Play size={13} />}{animate ? '暂停风场动画' : '播放风场动画'}</button><button onClick={() => { const center = mapRef.current?.getCenter(); if (center) selectGrid(center.lng, center.lat); }}>读取地图中心</button><button onClick={() => selectGrid(data.gridLocation.longitude, data.gridLocation.latitude)}>读取曲线格点</button><span>{count.toLocaleString()} 粒子</span></div>
    </div>
    {tileWarning && <p className="regional-network">地图载入出现问题；气象数据与经纬网来自本地文件，可继续查看下方曲线与下载格点。</p>}
    <div className="regional-notes"><p>粒子跟随<strong>所选小时的10米风</strong>，颜色取当前位置的<strong>2米气温</strong>。风场动画独立于日期播放，约1显示秒表示2小时的位移；不是气块携带热量的历史轨迹。</p><p>虚线是下载范围。气象格点间距0.25°，放大不会增加原始分辨率。颜色显示气温，蓝色不代表低于气候常年值；超过12–42°C的颜色会饱和。底图为当前地理背景。<a href="/regional-methods.md" download>模型与资料说明 <ArrowUpRight size={12} /></a></p></div>
    <p className="regional-status" aria-live="polite">{status}</p>
    <div className="regional-downloads"><a href={`/data/regional-${data.id}.json`} download><Download size={13} />下载区域风温格点</a><a href={`/data/regional-${data.id}-manifest.json`} download><Download size={13} />来源与校验清单</a><a href={region.source.documentationUrl} target="_blank" rel="noreferrer">ERA5 / Open-Meteo 来源 <ArrowUpRight size={12} /></a><span>{region.grid.nx} × {region.grid.ny} 格点 · {region.times.length} 小时</span></div>
  </section>;
}
