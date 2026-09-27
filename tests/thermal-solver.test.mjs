import test from 'node:test';
import assert from 'node:assert/strict';
import { ThermalSolver } from '../src/lib/thermal-solver.ts';

const close = (actual, expected, tolerance, message) => {
  assert.ok(Math.abs(actual - expected) < tolerance, `${message}: ${actual} 与 ${expected}`);
};
const evolve = (solver, duration, dt = 1 / 60, buoyancy = true) => {
  for (let i = 0; i < Math.round(duration / dt); i++) solver.step(dt, buoyancy);
  return solver.diagnostics();
};

test('均匀温差在封闭域中静止，常量浮力由静水压平衡', () => {
  const solver = new ThermalSolver(32, 20);
  solver.temperature.fill(0.7);
  const before = solver.temperature[0];
  const state = evolve(solver, 1);
  close(state.maxSpeed, 0, 1e-12, '均温不应自发产生环流');
  for (const value of solver.temperature) close(value, before, 1e-7, '常量场保持不变');
});

test('关闭浮力时热团只扩散，不凭空生成速度或涡旋', () => {
  const solver = new ThermalSolver(48, 30);
  const before = solver.diagnostics();
  const after = evolve(solver, 3, 1 / 60, false);
  close(after.maxSpeed, 0, 1e-12, '无外力时速度应为零');
  close(after.total, before.total, 2e-7, '扩散应保持温差域积分');
  assert.ok(after.max < before.max * 0.95, '扩散应降低热团峰值');
  assert.ok(after.min >= -1e-7, '扩散不应产生新的负温差');
  assert.ok(after.budgetError < 2e-7, '热量预算应闭合');
});

test('暖团上升、冷团下沉，符号对称初态产生镜像重心', () => {
  const hot = new ThermalSolver(48, 30);
  const cold = new ThermalSolver(48, 30); cold.reset('cold');
  const warmState = evolve(hot, 6);
  const coldState = evolve(cold, 6);
  assert.ok(warmState.hotHeight > 0.58, '暖团的温差重心应明显上升');
  assert.ok(coldState.coldHeight < 0.42, '冷团的温差重心应明显下降');
  close(warmState.hotHeight + coldState.coldHeight, 1, 3e-5, '上下反射并变号应保持对称');
  assert.ok(warmState.divergence < 2e-5 && coldState.divergence < 2e-5, '投影后应近似不可压缩');
});

test('相遇预设与边界附近注入均按有符号积分记账', () => {
  const solver = new ThermalSolver(48, 30); solver.reset('meeting');
  solver.addHeat(0.015, 0.02, 1.4);
  solver.addHeat(0.98, 0.97, -0.9);
  const before = solver.diagnostics();
  solver.push(0.45, 0.45, 0.4, -0.2);
  const after = evolve(solver, 5);
  close(after.total, before.total, 2e-7, '封闭壁面不应漏出热量');
  assert.ok(after.budgetError < 2e-7, '初态与每次输入均纳入预算');
  assert.ok(after.divergence < 2e-5, '注入冲量后仍应满足散度约束');
});

test('压力投影保留不可穿透壁，长时间演化数值有限且不超调', () => {
  const solver = new ThermalSolver(32, 20); solver.reset('meeting');
  solver.push(0.02, 0.03, -0.8, -0.5);
  const state = evolve(solver, 16, 1 / 30);
  for (const values of [solver.temperature, solver.velocityX, solver.velocityY]) {
    assert.ok([...values].every(Number.isFinite), '网格值须全部有限');
  }
  assert.ok(state.max <= 1.001 && state.min >= -1.001, '无额外热源不应放大初始温差极值');
  assert.ok(state.divergence < 2e-5, '投影残差须受控');
  // 直接核对物理壁面上的法向速度，而不是要求半格内中心速度为零。
  const u = Reflect.get(solver, 'u'), v = Reflect.get(solver, 'v');
  for (let j = 0; j < solver.ny; j++) {
    assert.equal(u[j * (solver.nx + 1)], 0);
    assert.equal(u[j * (solver.nx + 1) + solver.nx], 0);
  }
  for (let i = 0; i < solver.nx; i++) {
    assert.equal(v[i], 0);
    assert.equal(v[solver.ny * solver.nx + i], 0);
  }
});

test('将时间步减半时暖团重心差收缩，验证时间离散收敛趋势', () => {
  const heights = [1 / 30, 1 / 60, 1 / 120].map(dt => evolve(new ThermalSolver(32, 20), 2, dt).hotHeight);
  const coarseDifference = Math.abs(heights[0] - heights[1]);
  const fineDifference = Math.abs(heights[1] - heights[2]);
  assert.ok(coarseDifference > 1e-5, '所选实验须对时间步有可分辨差异');
  assert.ok(fineDifference < coarseDifference * 0.75, `减半时间步后差异应缩小：${heights}`);
});

test('加密三层网格时暖团重心差收缩，不声称完整湍流解已收敛', () => {
  const heights = [24, 48, 96].map(nx => evolve(new ThermalSolver(nx, nx * 5 / 8), 2, 1 / 120).hotHeight);
  const coarseDifference = Math.abs(heights[0] - heights[1]);
  const fineDifference = Math.abs(heights[1] - heights[2]);
  assert.ok(fineDifference < coarseDifference * 0.6, `网格加密后重心差应缩小：${heights}`);
});

test('预设重置清空运动与时间，重复实验可复现', () => {
  const solver = new ThermalSolver(32, 20);
  const initial = Array.from(solver.temperature);
  solver.addHeat(0.5, 0.5, 1); solver.push(0.5, 0.5, 0.6, -0.3);
  evolve(solver, 0.5);
  solver.reset('plume');
  assert.deepEqual(Array.from(solver.temperature), initial);
  assert.equal(solver.time, 0); assert.equal(solver.diagnostics().maxSpeed, 0);
  assert.equal(solver.diagnostics().budgetError, 0);
  const copy = new ThermalSolver(32, 20);
  evolve(solver, 0.5); evolve(copy, 0.5);
  assert.deepEqual(Array.from(solver.temperature), Array.from(copy.temperature));
});

test('域积分与面积平均定义一致，异常参数明确拒绝', () => {
  const solver = new ThermalSolver(32, 20), state = solver.diagnostics();
  close(state.total, state.mean * 1.6, 1e-12, '域面积为 1.6');
  for (const dimensions of [[0, 20], [32.5, 20], [32, 0], [300, 20]]) assert.throws(() => new ThermalSolver(...dimensions), RangeError);
  for (const dt of [-1, 0.3, NaN, Infinity]) assert.throws(() => solver.step(dt, true), RangeError);
  assert.throws(() => solver.addHeat(-0.1, 0.5, 1), RangeError);
  assert.throws(() => solver.addHeat(0.5, 0.5, Infinity), RangeError);
  assert.throws(() => solver.addHeat(0.5, 0.5, 1, 0), RangeError);
  assert.throws(() => solver.push(0.5, 0.5, 1, NaN), RangeError);
});
