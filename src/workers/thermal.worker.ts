import { ThermalSolver } from '../lib/thermal-solver';
import type { ThermalCommand, ThermalReply } from '../lib/thermal-state';

// 模型独立于主线程；传输副本，保留求解器自己的数组。
const scope = self as unknown as { onmessage: ((event: MessageEvent<ThermalCommand>) => void) | null; postMessage: (message: ThermalReply, transfer?: Transferable[]) => void };
let solver: ThermalSolver | undefined;
scope.onmessage = ({ data }) => {
  try {
    if (data.type === 'init') solver = new ThermalSolver(96, 60);
    if (!solver) throw new Error('模拟器尚未初始化');
    if (data.type === 'init' || data.type === 'reset') solver.reset(data.preset);
    if (data.type === 'advance') for (let step = 0; step < Math.min(4, Math.max(0, data.steps)); step++) solver.step(1 / 60, data.buoyancy);
    if (data.type === 'heat') solver.addHeat(data.x, data.y, data.amount);
    if (data.type === 'push') solver.push(data.x, data.y, data.dx, data.dy);
    const frame = { nx: solver.nx, ny: solver.ny, temperature: solver.temperature.slice(), velocityX: solver.velocityX.slice(), velocityY: solver.velocityY.slice() };
    scope.postMessage({ type: 'frame', id: data.id, frame, diagnostics: solver.diagnostics(), reset: data.type === 'reset' || data.type === 'init' }, [frame.temperature.buffer, frame.velocityX.buffer, frame.velocityY.buffer]);
  } catch (error) {
    scope.postMessage({ type: 'error', id: data.id, message: error instanceof Error ? error.message : '计算失败' });
  }
};
