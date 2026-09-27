import { ArrowUpRight, RefreshCw, Download } from 'lucide-react';
import { sources } from '../content/science';

export function Sources({ ids }: { ids: string[] }) {
  const selected = sources.filter(s => ids.includes(s.id));
  return <div className="source-links">{selected.map(s => <a key={s.id} href={s.url} target="_blank" rel="noreferrer">{s.organisation} · {s.title}<ArrowUpRight size={13} aria-hidden="true" /></a>)}</div>;
}
export function Loading({ error, retry }: { error?: string | null; retry?: () => void }) {
  return <div className="loading-state" role="status"><span>{error ?? '正在读取经过核验的数据…'}</span>{error && retry && <button className="text-button" onClick={retry}><RefreshCw size={16} />重新读取</button>}</div>;
}
export function DownloadLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="text-button" href={href} download><Download size={16} aria-hidden="true" />{children}</a>;
}
