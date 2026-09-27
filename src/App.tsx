import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, ArrowUpRight, Menu, X } from 'lucide-react';
import Replay from './components/Replay';
import { Loading } from './components/Shared';

const ClimateExplorer = lazy(() => import('./components/ClimateExplorer'));
const HeatLab = lazy(() => import('./components/HeatLab'));
const WorldExplorer = lazy(() => import('./components/WorldExplorer'));
const Methods = lazy(() => import('./components/Methods'));
const ThermalParticles = lazy(() => import('./components/ThermalParticles'));
const pages = [{ id: 'particles', label: '粒子热场' }, { id: 'replay', label: '事件回放' }, { id: 'climate', label: '二十年气温' }, { id: 'lab', label: '热量实验室' }, { id: 'world', label: '世界案例' }, { id: 'methods', label: '数据与方法' }];
function readRoute() {
  const [path, query] = window.location.hash.slice(1).split('?');
  const page = pages.some(item => item.id === path) ? path : 'replay';
  const candidate = new URLSearchParams(query).get('case');
  const caseId = candidate && ['portland2021', 'paris2019', 'chongqing2022'].includes(candidate) ? candidate : 'portland2021';
  return { page, caseId };
}
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className="loading-state"><h2>页面暂时没有载入成功</h2><p>你可以重新载入，或者直接下载公开的数据。</p><button className="text-button" onClick={() => window.location.reload()}>重新载入</button><a href="/data/annual-summary.csv" download>下载年度汇总</a></div>;
    return this.props.children;
  }
}
export default function App() {
  const [route, setRoute] = useState(readRoute);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { const handle = () => { setRoute(readRoute()); setMenuOpen(false); }; window.addEventListener('hashchange', handle); return () => window.removeEventListener('hashchange', handle); }, []);
  useEffect(() => { document.title = `${pages.find(item => item.id === route.page)?.label} · 热浪解剖室`; window.scrollTo({ top: 0, behavior: 'instant' }); }, [route.page]);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); } };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);
  const openCase = (id: string) => { window.location.hash = `replay?case=${encodeURIComponent(id)}`; };
  return <><a className="skip-link" href="#main" onClick={e => { e.preventDefault(); document.getElementById('main')?.focus(); }}>跳到主要内容</a><header className="site-header"><a className="brand" href="#replay" aria-label="热浪解剖室首页"><strong>热浪解剖室</strong><span>HEAT ATLAS</span></a><button ref={menuButton} className="menu-toggle" aria-label={menuOpen ? '关闭导航' : '打开导航'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button><nav onClick={() => setMenuOpen(false)} aria-label="主导航" className={menuOpen ? 'is-open' : ''}>{pages.map(page => <a key={page.id} href={`#${page.id}`} className={route.page === page.id ? 'active' : ''} aria-current={route.page === page.id ? 'page' : undefined}>{page.label}</a>)}</nav><a className="header-about" href="#methods" aria-label="查看数据与方法"><ArrowUpRight size={22} /></a></header>
    <main id="main" tabIndex={-1}><ErrorBoundary key={route.page}><Suspense fallback={<Loading />}><div key={route.page} className="page-transition">{route.page === 'particles' && <ThermalParticles />}{route.page === 'replay' && <Replay caseId={route.caseId} onCase={openCase} />}{route.page === 'climate' && <ClimateExplorer />}{route.page === 'lab' && <HeatLab />}{route.page === 'world' && <WorldExplorer onReplay={openCase} />}{route.page === 'methods' && <Methods />}</div></Suspense></ErrorBoundary></main>
    <footer className="site-footer"><div><strong>热浪解剖室</strong><p>理解高温，也理解证据的边界。</p></div><div><span>ERA5 · Open-Meteo · 官方资料与原始研究</span><a href="#methods">数据、方法与署名 <ArrowUpRight size={14} /></a><a href="https://yilaoweather.org/">返回宜老天气通 <ArrowUpRight size={14} /></a><a href="https://github.com/AlfWuxy/heatwave-atlas-lab" target="_blank" rel="noreferrer">开源代码 <ArrowUpRight size={14} /></a></div><button className="back-top" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })} aria-label="返回顶部"><ArrowUp size={19} /></button></footer></>;
}
