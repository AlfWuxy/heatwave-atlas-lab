import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// 浮动选中面跟随实际按钮尺寸，换行或窄屏时仍与文字对齐。
export default function SegmentedGroup({ children, selectedKey, label, className = '' }: {
  children: ReactNode; selectedKey: string | number; label: string; className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const item = root.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (item) setSelection({ x: item.offsetLeft, y: item.offsetTop, width: item.offsetWidth, height: item.offsetHeight });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, [selectedKey]);
  return <div ref={root} className={`segmented-group ${className}`} role="group" aria-label={label}>
    {selection && <span className="segmented-selection" aria-hidden="true" style={{ width: selection.width, height: selection.height, transform: `translate(${selection.x}px, ${selection.y}px)` }} />}
    {children}
  </div>;
}
