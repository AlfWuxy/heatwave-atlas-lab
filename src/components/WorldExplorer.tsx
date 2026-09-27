import { useId, useMemo, useState } from 'react';
import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import atlas from 'world-atlas/countries-110m.json';
import { globalEvents, mechanisms, sources } from '../content/science';
import './world-explorer.css';

type WorldExplorerProps = { onReplay: (id: string) => void };
type PeriodFilter = 'all' | '2009–2018' | '2019–2022' | '2023–2025';

const periodFilters: { id: PeriodFilter; label: string; min: number; max: number }[] = [
  { id: 'all', label: '全部年份', min: 0, max: 9999 },
  { id: '2009–2018', label: '2009–2018', min: 2009, max: 2018 },
  { id: '2019–2022', label: '2019–2022', min: 2019, max: 2022 },
  { id: '2023–2025', label: '2023–2025', min: 2023, max: 2025 },
];

// 使用真实地理底图；颜色只用于区分陆地与背景，不承载气温信息。
const topology = atlas as unknown as Topology<{ countries: GeometryCollection }>;
const countries = feature(topology, topology.objects.countries);
const projection = geoNaturalEarth1().fitExtent([[20, 25], [960, 505]], { type: 'Sphere' });
const mapPath = geoPath(projection);
const graticule = geoGraticule10();

export default function WorldExplorer({ onReplay }: WorldExplorerProps) {
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [selectedId, setSelectedId] = useState(globalEvents[0]?.id ?? '');
  const mapTitleId = useId();
  const mapDescriptionId = useId();
  const detailTitleId = useId();

  const visibleEvents = useMemo(() => {
    const range = periodFilters.find((item) => item.id === period) ?? periodFilters[0];
    return globalEvents.filter((event) => event.year >= range.min && event.year <= range.max);
  }, [period]);
  const selectedEvent = visibleEvents.find((event) => event.id === selectedId) ?? visibleEvents[0];
  const selectedMechanisms = selectedEvent
    ? mechanisms.filter((mechanism) => selectedEvent.mechanismIds.includes(mechanism.id))
    : [];
  const selectedSources = selectedEvent
    ? sources.filter((source) => selectedEvent.sourceIds.includes(source.id))
    : [];

  function changePeriod(nextPeriod: PeriodFilter) {
    setPeriod(nextPeriod);
    const range = periodFilters.find((item) => item.id === nextPeriod) ?? periodFilters[0];
    const matching = globalEvents.filter((event) => event.year >= range.min && event.year <= range.max);
    if (!matching.some((event) => event.id === selectedId)) {
      setSelectedId(matching[0]?.id ?? '');
    }
  }

  return (
    <section className="world-page" aria-labelledby="world-heading">
      <header className="world-heading-block">
        <h1 id="world-heading">每场热浪，都有自己的故事。</h1>
        <p className="world-intro">从官方报告出发，比较不同地方的高温过程。</p>
        <p className="world-scope">这里收录 {globalEvents.length} 个精选事件，便于追溯与比较；它们不构成全球所有热浪的完整清单。</p>
      </header>

      <div className="world-filter-bar">
        <span className="world-filter-label" id="world-period-label">按年份浏览</span>
        <div className="world-filters" role="group" aria-labelledby="world-period-label">
          {periodFilters.map((filter) => (
            <button
              className={`world-filter${period === filter.id ? ' world-filter-active' : ''}`}
              type="button"
              key={filter.id}
              aria-pressed={period === filter.id}
              onClick={() => changePeriod(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <span className="world-event-count" aria-live="polite">{visibleEvents.length} 个事件</span>
      </div>

      <div className="world-explorer-layout">
        <figure className="world-map-figure">
          <svg
            className="world-map"
            viewBox="0 0 980 540"
            role="img"
            aria-labelledby={`${mapTitleId} ${mapDescriptionId}`}
          >
            <title id={mapTitleId}>全球精选热浪事件位置</title>
            <desc id={mapDescriptionId}>自然地球投影地图，圆点标记当前筛选的 {visibleEvents.length} 场事件的代表位置。下方事件目录提供相同的选择功能。地图不展示温度或事件边界。</desc>
            <path className="world-map-sphere" d={mapPath({ type: 'Sphere' }) ?? ''} />
            <path className="world-map-graticule" d={mapPath(graticule) ?? ''} />
            {countries.features.map((country, index) => (
              <path className="world-map-country" key={country.id ?? index} d={mapPath(country) ?? ''} />
            ))}
            {visibleEvents.map((event) => {
              const point = projection(event.coordinates as [number, number]);
              if (!point) return null;
              const selected = event.id === selectedEvent?.id;
              return (
                <g
                  className={`world-map-marker${selected ? ' world-map-marker-selected' : ''}`}
                  key={event.id}
                  transform={`translate(${point[0]}, ${point[1]})`}
                  onClick={() => setSelectedId(event.id)}
                  aria-hidden="true"
                >
                  <title>{event.year} · {event.name}</title>
                  <circle className="world-marker-hit" r="16" />
                  {selected && <circle className="world-marker-halo" r="17" />}
                  <circle className="world-marker-dot" r={selected ? 7 : 5} />
                </g>
              );
            })}
          </svg>
          <figcaption className="world-map-caption">
            <span className="world-map-legend"><span className="world-legend-dot" aria-hidden="true" />事件代表点 · 不表示影响边界</span>
            <span>底图：<a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noreferrer">Natural Earth</a>（公共领域）· world-atlas</span>
          </figcaption>
          <p className="world-map-hint">点击地图上的圆点，或从下方目录选择一个事件。</p>
        </figure>

        {selectedEvent ? (
          <aside className="world-detail" aria-labelledby={detailTitleId}>
            <div className="world-detail-reading" aria-live="polite" aria-atomic="true">
              <div key={selectedEvent.id} className="state-enter">
              <p className="world-detail-region">{selectedEvent.region}</p>
              <p className="world-detail-year">{selectedEvent.year}</p>
              <h2 id={detailTitleId}>{selectedEvent.name}</h2>
              <p className="world-detail-period">{selectedEvent.period}</p>
              <p className="world-detail-summary">{selectedEvent.summary}</p>
              <div className="world-process-note">
                <h3>理解这场高温</h3>
                {selectedMechanisms.length > 0 ? (
                  <>
                    <p>相关过程线索</p>
                    <ul className="world-mechanism-list">
                      {selectedMechanisms.map((mechanism) => <li key={mechanism.id}>{mechanism.title}</li>)}
                    </ul>
                    <p className="world-interpretation-note">这些线索用于引导阅读，不能据此量化各机制的贡献。</p>
                  </>
                ) : (
                  <p className="world-interpretation-note">现有来源以事件记录为主，形成机制仍需专题研究。</p>
                )}
              </div>
              </div>
            </div>
            {selectedEvent.dataCaseId && (
              <button className="world-replay-button" type="button" onClick={() => onReplay(selectedEvent.dataCaseId!)}>
                查看对应地点的数据回放 <span aria-hidden="true">↗</span>
              </button>
            )}
            <div className="world-source-block">
              <h3>回到原始来源</h3>
              <ul className="world-source-list">
                {selectedSources.map((source) => (
                  <li key={source.id}>
                    <a href={source.url} target="_blank" rel="noreferrer">
                      <span>{source.title}</span><span aria-hidden="true">↗</span>
                    </a>
                    <span className="world-source-organisation">{source.organisation}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        ) : (
          <p className="world-empty-state">这一时间段暂无收录事件。</p>
        )}
      </div>

      <section className="world-directory" aria-labelledby="world-directory-heading">
        <div className="world-directory-heading">
          <h2 id="world-directory-heading">沿着时间，重新看见高温</h2>
          <span>精选事件目录</span>
        </div>
        <ol className="world-event-list">
          {visibleEvents.map((event, index) => (
            <li key={event.id}>
              <button
                type="button"
                className={`world-event-row${selectedEvent?.id === event.id ? ' world-event-row-selected' : ''}`}
                aria-pressed={selectedEvent?.id === event.id}
                onClick={() => setSelectedId(event.id)}
              >
                <span className="world-event-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span className="world-event-name">{event.name}<span className="world-event-region">{event.region}</span></span>
                <span className="world-event-year">{event.year}</span>
                <span className="world-event-arrow" aria-hidden="true">↗</span>
              </button>
            </li>
          ))}
        </ol>
      </section>
      <p className="world-footer-note">不同报告可能采用不同的热浪定义、时段与地理范围。比较之前，请先核对各事件的来源和统计口径。</p>
    </section>
  );
}
