export type ThermalPreset = 'plume' | 'cold' | 'meeting';

const WIDTH = 1.6;
const HEIGHT = 1;
const VISCOSITY = 0.0002;
const DIFFUSIVITY = 0.00015;
const BUOYANCY = 0.28;

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const limitedSlope = (left: number, right: number) => left * right <= 0 ? 0
  : Math.sign(left) * Math.min(2 * Math.abs(left), 2 * Math.abs(right), 0.5 * Math.abs(left + right));

/**
 * 二维无量纲 Boussinesq 教学模型：宽 1.6、高 1，y 轴向上。
 * 速度采用 MAC 交错网格；四壁不可穿透、切向速度镜像实现无滑移。
 * 温度采用保守有限体积通量、MC 限制器与 SSP-RK2，四壁无热通量。
 * 速度半拉格朗日平流、显式黏性与压力投影均有数值误差；不添加装饰性涡旋或随机力。
 */
export class ThermalSolver {
  readonly nx: number;
  readonly ny: number;
  readonly temperature: Float32Array;
  readonly velocityX: Float32Array;
  readonly velocityY: Float32Array;
  time = 0;
  private readonly hx: number;
  private readonly hy: number;
  private readonly u: Float64Array;
  private readonly v: Float64Array;
  private readonly nextU: Float64Array;
  private readonly nextV: Float64Array;
  private readonly pressure: Float64Array;
  private readonly rhs: Float64Array;
  private readonly residual: Float64Array;
  private readonly direction: Float64Array;
  private readonly product: Float64Array;
  private readonly diagonal: Float64Array;
  private readonly slopeX: Float64Array;
  private readonly slopeY: Float64Array;
  private readonly stage: Float64Array;
  private readonly thermalRhs: Float64Array;
  private expectedTotal = 0;
  private maxU = 0;
  private maxV = 0;

  constructor(nx = 96, ny = 60) {
    if (!Number.isInteger(nx) || !Number.isInteger(ny) || nx < 8 || ny < 8 || nx > 256 || ny > 256) {
      throw new RangeError('网格每边须为 8–256 的整数');
    }
    this.nx = nx; this.ny = ny;
    this.hx = WIDTH / nx; this.hy = HEIGHT / ny;
    const size = nx * ny;
    this.temperature = new Float32Array(size);
    this.velocityX = new Float32Array(size);
    this.velocityY = new Float32Array(size);
    this.u = new Float64Array((nx + 1) * ny);
    this.v = new Float64Array(nx * (ny + 1));
    this.nextU = new Float64Array(this.u.length);
    this.nextV = new Float64Array(this.v.length);
    this.pressure = new Float64Array(size);
    this.rhs = new Float64Array(size);
    this.residual = new Float64Array(size);
    this.direction = new Float64Array(size);
    this.product = new Float64Array(size);
    this.diagonal = new Float64Array(size);
    this.slopeX = new Float64Array(size);
    this.slopeY = new Float64Array(size);
    this.stage = new Float64Array(size);
    this.thermalRhs = new Float64Array(size);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      this.diagonal[j * nx + i] = ((i > 0 ? 1 : 0) + (i < nx - 1 ? 1 : 0)) / this.hx ** 2
        + ((j > 0 ? 1 : 0) + (j < ny - 1 ? 1 : 0)) / this.hy ** 2;
    }
    this.reset('plume');
  }

  reset(preset: ThermalPreset): void {
    if (!['plume', 'cold', 'meeting'].includes(preset)) throw new RangeError('未知的热对流预设');
    this.temperature.fill(0); this.u.fill(0); this.v.fill(0); this.pressure.fill(0);
    this.time = 0; this.expectedTotal = 0;
    if (preset === 'plume') this.addHeat(0.46, 0.17, 1, 0.085);
    if (preset === 'cold') this.addHeat(0.54, 0.83, -1, 0.085);
    if (preset === 'meeting') {
      this.addHeat(0.39, 0.17, 1, 0.085);
      this.addHeat(0.61, 0.83, -1, 0.085);
    }
    this.syncVelocity();
  }

  /** x、y 为归一化位置；radius 以域高度计，amount 为峰值温差增量。 */
  addHeat(x: number, y: number, amount: number, radius = 0.06): void {
    this.validateInput(x, y, amount, radius);
    const cx = x * WIDTH, cy = y * HEIGHT, denominator = 2 * radius * radius;
    let added = 0;
    for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
      const index = j * this.nx + i;
      const distance = ((i + 0.5) * this.hx - cx) ** 2 + ((j + 0.5) * this.hy - cy) ** 2;
      const before = this.temperature[index];
      this.temperature[index] += amount * Math.exp(-distance / denominator);
      added += this.temperature[index] - before;
    }
    // 按实际存入 Float32 网格的热输入记账，避免把舍入当作输入误差。
    this.expectedTotal += added * this.hx * this.hy;
  }

  /** dx、dy 是局部无量纲速度冲量；施加后立即投影，不能制造体积源。 */
  push(x: number, y: number, dx: number, dy: number, radius = 0.08): void {
    this.validateInput(x, y, dx, radius);
    if (!Number.isFinite(dy)) throw new RangeError('速度冲量须为有限数');
    const cx = x * WIDTH, cy = y * HEIGHT, denominator = 2 * radius * radius;
    const {nx, ny, hx, hy} = this;
    for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) {
      const distance = (i * hx - cx) ** 2 + ((j + 0.5) * hy - cy) ** 2;
      this.u[j * (nx + 1) + i] += dx * Math.exp(-distance / denominator);
    }
    for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) {
      const distance = ((i + 0.5) * hx - cx) ** 2 + (j * hy - cy) ** 2;
      this.v[j * nx + i] += dy * Math.exp(-distance / denominator);
    }
    this.project(); this.syncVelocity();
  }

  step(dt: number, buoyancy: boolean): void {
    if (!Number.isFinite(dt) || dt < 0 || dt > 0.25) throw new RangeError('时间步须在 0–0.25 之间');
    let remaining = dt;
    while (remaining > 1e-12) {
      // 包含浮力的速度上界，避免静止初始状态漏掉随后产生的 CFL 约束。
      let maxTemperature = 0;
      for (const value of this.temperature) maxTemperature = Math.max(maxTemperature, Math.abs(value));
      const velocityRate = this.maxU / this.hx + (this.maxV + BUOYANCY * maxTemperature * remaining) / this.hy;
      const diffusionRate = 2 * Math.max(VISCOSITY, DIFFUSIVITY) * (1 / this.hx ** 2 + 1 / this.hy ** 2);
      const substep = Math.min(remaining, 0.45 / Math.max(velocityRate + diffusionRate, 1e-12));
      this.advanceVelocity(substep, buoyancy);
      this.advanceTemperature(substep);
      this.time += substep;
      remaining -= substep;
      this.syncVelocity();
    }
  }

  diagnostics(): {time: number; min: number; max: number; mean: number; total: number; budgetError: number; divergence: number; maxSpeed: number; hotHeight: number; coldHeight: number} {
    let sum = 0, min = Infinity, max = -Infinity, maxSpeed = 0, divergenceSquared = 0;
    let hotMass = 0, coldMass = 0, hotMoment = 0, coldMoment = 0;
    for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
      const k = j * this.nx + i, value = this.temperature[k], height = (j + 0.5) / this.ny;
      sum += value; min = Math.min(min, value); max = Math.max(max, value);
      maxSpeed = Math.max(maxSpeed, Math.hypot(this.velocityX[k], this.velocityY[k]));
      if (value > 0) { hotMass += value; hotMoment += value * height; }
      if (value < 0) { coldMass -= value; coldMoment -= value * height; }
      const divergence = (this.u[j * (this.nx + 1) + i + 1] - this.u[j * (this.nx + 1) + i]) / this.hx
        + (this.v[(j + 1) * this.nx + i] - this.v[j * this.nx + i]) / this.hy;
      divergenceSquared += divergence * divergence;
    }
    const total = sum * this.hx * this.hy;
    // total 为有符号温差域积分，mean 为 total / 1.6；均不是现实焦耳量。
    return { time: this.time, min, max, mean: sum / this.temperature.length, total,
      budgetError: Math.abs(total - this.expectedTotal), divergence: Math.sqrt(divergenceSquared / this.temperature.length),
      maxSpeed, hotHeight: hotMass > 1e-12 ? hotMoment / hotMass : 0.5,
      coldHeight: coldMass > 1e-12 ? coldMoment / coldMass : 0.5 };
  }

  private validateInput(x: number, y: number, amount: number, radius: number): void {
    if (![x, y, amount, radius].every(Number.isFinite) || x < 0 || x > 1 || y < 0 || y > 1 || radius <= 0 || radius > 1) {
      throw new RangeError('输入须有限，位置在 0–1，半径在 0–1 内且大于零');
    }
  }

  private sampleU(x: number, y: number): number {
    const gx = clamp(x / this.hx, 0, this.nx), gy = clamp(y / this.hy, 0, this.ny) - 0.5;
    const i = Math.min(Math.floor(gx), this.nx - 1), j = Math.floor(gy), fx = gx - i, fy = gy - j;
    const bottom = clamp(j, 0, this.ny - 1) * (this.nx + 1) + i;
    const top = clamp(j + 1, 0, this.ny - 1) * (this.nx + 1) + i;
    const lower = ((1 - fx) * this.u[bottom] + fx * this.u[bottom + 1]) * (j < 0 ? -1 : 1);
    const upper = ((1 - fx) * this.u[top] + fx * this.u[top + 1]) * (j + 1 >= this.ny ? -1 : 1);
    return (1 - fy) * lower + fy * upper;
  }

  private sampleV(x: number, y: number): number {
    const gx = clamp(x / this.hx, 0, this.nx) - 0.5, gy = clamp(y / this.hy, 0, this.ny);
    const i = Math.floor(gx), j = Math.min(Math.floor(gy), this.ny - 1), fx = gx - i, fy = gy - j;
    const left = j * this.nx + clamp(i, 0, this.nx - 1);
    const right = j * this.nx + clamp(i + 1, 0, this.nx - 1);
    const lower = (1 - fx) * this.v[left] * (i < 0 ? -1 : 1) + fx * this.v[right] * (i + 1 >= this.nx ? -1 : 1);
    const upper = (1 - fx) * this.v[left + this.nx] * (i < 0 ? -1 : 1) + fx * this.v[right + this.nx] * (i + 1 >= this.nx ? -1 : 1);
    return (1 - fy) * lower + fy * upper;
  }

  private advanceVelocity(dt: number, buoyancy: boolean): void {
    const {nx, ny, hx, hy, u, v, nextU, nextV} = this, stride = nx + 1;
    const ix2 = 1 / (hx * hx), iy2 = 1 / (hy * hy);
    let mean = 0;
    if (buoyancy) { for (const value of this.temperature) mean += value; mean /= this.temperature.length; }
    for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) {
      const k = j * stride + i, x = i * hx, y = (j + 0.5) * hy;
      const mx = x - 0.5 * dt * u[k], my = y - 0.5 * dt * this.sampleV(x, y);
      const backX = x - dt * this.sampleU(mx, my), backY = y - dt * this.sampleV(mx, my);
      const laplacian = (u[k - 1] - 2 * u[k] + u[k + 1]) * ix2
        + ((j > 0 ? u[k - stride] : -u[k]) - 2 * u[k] + (j < ny - 1 ? u[k + stride] : -u[k])) * iy2;
      nextU[k] = this.sampleU(backX, backY) + dt * VISCOSITY * laplacian;
    }
    for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, x = (i + 0.5) * hx, y = j * hy;
      const mx = x - 0.5 * dt * this.sampleU(x, y), my = y - 0.5 * dt * v[k];
      const backX = x - dt * this.sampleU(mx, my), backY = y - dt * this.sampleV(mx, my);
      const laplacian = ((i > 0 ? v[k - 1] : -v[k]) - 2 * v[k] + (i < nx - 1 ? v[k + 1] : -v[k])) * ix2
        + (v[k - nx] - 2 * v[k] + v[k + nx]) * iy2;
      // 减去域平均只移除可由静水压平衡的恒定项，不改变局部浮力环流。
      const force = buoyancy ? BUOYANCY * (0.5 * (this.temperature[k - nx] + this.temperature[k]) - mean) : 0;
      nextV[k] = this.sampleV(backX, backY) + dt * (VISCOSITY * laplacian + force);
    }
    u.set(nextU); v.set(nextV);
    this.project();
  }

  private multiplyPressure(input: Float64Array, output: Float64Array): void {
    const {nx, ny, hx, hy} = this, ix2 = 1 / (hx * hx), iy2 = 1 / (hy * hy);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, center = input[k];
      output[k] = ((i > 0 ? center - input[k - 1] : 0) + (i < nx - 1 ? center - input[k + 1] : 0)) * ix2
        + ((j > 0 ? center - input[k - nx] : 0) + (j < ny - 1 ? center - input[k + nx] : 0)) * iy2;
    }
  }

  private project(): void {
    const {nx, ny, hx, hy, rhs, pressure, residual, direction, product, diagonal} = this;
    const size = nx * ny;
    let mean = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      rhs[k] = -(this.u[j * (nx + 1) + i + 1] - this.u[j * (nx + 1) + i]) / hx
        - (this.v[(j + 1) * nx + i] - this.v[j * nx + i]) / hy;
      mean += rhs[k];
    }
    mean /= size;
    this.multiplyPressure(pressure, product);
    let rz = 0, residualSquared = 0;
    for (let k = 0; k < size; k++) {
      residual[k] = rhs[k] - mean - product[k];
      direction[k] = residual[k] / diagonal[k];
      rz += residual[k] * direction[k];
      residualSquared += residual[k] * residual[k];
    }
    // Neumann Poisson 方程保留常数零空间，PCG 在零均值兼容右端上求解。
    const tolerance = size * 1e-12;
    for (let iteration = 0; iteration < 3 * Math.max(nx, ny) && residualSquared > tolerance; iteration++) {
      this.multiplyPressure(direction, product);
      let pap = 0;
      for (let k = 0; k < size; k++) pap += direction[k] * product[k];
      if (pap <= 1e-30) break;
      const alpha = rz / pap;
      let newRz = 0; residualSquared = 0;
      for (let k = 0; k < size; k++) {
        pressure[k] += alpha * direction[k];
        residual[k] -= alpha * product[k];
        newRz += residual[k] * residual[k] / diagonal[k];
        residualSquared += residual[k] * residual[k];
      }
      const beta = newRz / rz;
      for (let k = 0; k < size; k++) direction[k] = residual[k] / diagonal[k] + beta * direction[k];
      rz = newRz;
    }
    let pressureMean = 0;
    for (const value of pressure) pressureMean += value;
    pressureMean /= size;
    for (let k = 0; k < size; k++) pressure[k] -= pressureMean;
    for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) {
      this.u[j * (nx + 1) + i] -= (pressure[j * nx + i] - pressure[j * nx + i - 1]) / hx;
    }
    for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) {
      this.v[j * nx + i] -= (pressure[j * nx + i] - pressure[(j - 1) * nx + i]) / hy;
    }
  }

  private temperatureDerivative(field: Float32Array | Float64Array, output: Float64Array): void {
    const {nx, ny, hx, hy, slopeX, slopeY} = this;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      slopeX[k] = i > 0 && i < nx - 1 ? limitedSlope(field[k] - field[k - 1], field[k + 1] - field[k]) : 0;
      slopeY[k] = j > 0 && j < ny - 1 ? limitedSlope(field[k] - field[k - nx], field[k + nx] - field[k]) : 0;
      output[k] = 0;
    }
    // 每个内面只计算一次通量，并以等量异号写入相邻单元，边界通量恒为零。
    for (let j = 0; j < ny; j++) for (let i = 1; i < nx; i++) {
      const right = j * nx + i, left = right - 1, speed = this.u[j * (nx + 1) + i];
      const advected = speed >= 0 ? field[left] + 0.5 * slopeX[left] : field[right] - 0.5 * slopeX[right];
      const flux = (speed * advected - DIFFUSIVITY * (field[right] - field[left]) / hx) / hx;
      output[left] -= flux; output[right] += flux;
    }
    for (let j = 1; j < ny; j++) for (let i = 0; i < nx; i++) {
      const top = j * nx + i, bottom = top - nx, speed = this.v[j * nx + i];
      const advected = speed >= 0 ? field[bottom] + 0.5 * slopeY[bottom] : field[top] - 0.5 * slopeY[top];
      const flux = (speed * advected - DIFFUSIVITY * (field[top] - field[bottom]) / hy) / hy;
      output[bottom] -= flux; output[top] += flux;
    }
  }

  private advanceTemperature(dt: number): void {
    this.temperatureDerivative(this.temperature, this.thermalRhs);
    for (let k = 0; k < this.temperature.length; k++) this.stage[k] = this.temperature[k] + dt * this.thermalRhs[k];
    this.temperatureDerivative(this.stage, this.thermalRhs);
    for (let k = 0; k < this.temperature.length; k++) {
      this.temperature[k] = 0.5 * (this.temperature[k] + this.stage[k] + dt * this.thermalRhs[k]);
    }
  }

  private syncVelocity(): void {
    const {nx, ny} = this;
    this.maxU = 0; this.maxV = 0;
    for (const value of this.u) this.maxU = Math.max(this.maxU, Math.abs(value));
    for (const value of this.v) this.maxV = Math.max(this.maxV, Math.abs(value));
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      this.velocityX[k] = 0.5 * (this.u[j * (nx + 1) + i] + this.u[j * (nx + 1) + i + 1]);
      this.velocityY[k] = 0.5 * (this.v[k] + this.v[k + nx]);
    }
  }
}
