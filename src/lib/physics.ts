/** 理想化干空气实验的常量；比热按常数处理，不代表真实天气模型。 */
export const DRY_AIR_GAS_CONSTANT = 287.05;
export const DRY_AIR_CP = 1004;
export const POISSON_EXPONENT = DRY_AIR_GAS_CONSTANT / DRY_AIR_CP;
export const CELSIUS_OFFSET = 273.15;

export type AirParcelInput = {
  initialTemperatureC: number;
  initialPressureHpa: number;
  finalPressureHpa: number;
};

export type AirParcelResult = {
  finalTemperatureC: number;
  temperatureChangeC: number;
  initialPotentialTemperatureK: number;
  finalPotentialTemperatureK: number;
  relativeVolume: number;
};

export type SurfaceEnergyInput = {
  netRadiation: number;
  storageFraction: number;
  evaporativeFraction: number;
};

export type SurfaceEnergyResult = {
  netRadiation: number;
  storage: number;
  availableEnergy: number;
  sensibleHeat: number;
  latentHeat: number;
  closureResidual: number;
};

function requireFinite(value: number, name: string) {
  if (!Number.isFinite(value)) throw new RangeError(`${name}必须是有限数值`);
}

function requirePositive(value: number, name: string) {
  requireFinite(value, name);
  if (value <= 0) throw new RangeError(`${name}必须大于零`);
}

/** 气压使用同一单位，公式中的比值不受 hPa 或 Pa 选择影响。 */
export function potentialTemperatureK(temperatureC: number, pressureHpa: number): number {
  requireFinite(temperatureC, '温度');
  requirePositive(temperatureC + CELSIUS_OFFSET, '绝对温度');
  requirePositive(pressureHpa, '气压');
  return (temperatureC + CELSIUS_OFFSET) * (1000 / pressureHpa) ** POISSON_EXPONENT;
}

/** 泊松关系：理想、可逆、无相变的干绝热过程。 */
export function dryAdiabaticParcel(input: AirParcelInput): AirParcelResult {
  const { initialTemperatureC, initialPressureHpa, finalPressureHpa } = input;
  requireFinite(initialTemperatureC, '初始温度');
  requirePositive(initialTemperatureC + CELSIUS_OFFSET, '初始绝对温度');
  requirePositive(initialPressureHpa, '初始气压');
  requirePositive(finalPressureHpa, '最终气压');
  const initialK = initialTemperatureC + CELSIUS_OFFSET;
  const finalK = initialK * (finalPressureHpa / initialPressureHpa) ** POISSON_EXPONENT;
  const finalTemperatureC = finalK - CELSIUS_OFFSET;
  return {
    finalTemperatureC,
    temperatureChangeC: finalTemperatureC - initialTemperatureC,
    initialPotentialTemperatureK: potentialTemperatureK(initialTemperatureC, initialPressureHpa),
    finalPotentialTemperatureK: potentialTemperatureK(finalTemperatureC, finalPressureHpa),
    // 固定质量的理想气体体积与 T/p 成正比。
    relativeVolume: (finalK / initialK) * (initialPressureHpa / finalPressureHpa),
  };
}

/** 手动分配净辐射，所有通量单位均为 W/m²，份额取值 0—1。 */
export function partitionSurfaceEnergy(input: SurfaceEnergyInput): SurfaceEnergyResult {
  const { netRadiation, storageFraction, evaporativeFraction } = input;
  requireFinite(netRadiation, '净辐射');
  if (netRadiation < 0) throw new RangeError('本白天地表模型要求净辐射不小于零');
  for (const [name, value] of [['储热份额', storageFraction], ['蒸发份额', evaporativeFraction]] as const) {
    requireFinite(value, name);
    if (value < 0 || value > 1) throw new RangeError(`${name}必须在0—1之间`);
  }
  const storage = netRadiation * storageFraction;
  const availableEnergy = netRadiation - storage;
  const latentHeat = availableEnergy * evaporativeFraction;
  const sensibleHeat = availableEnergy * (1 - evaporativeFraction);
  return {
    netRadiation,
    storage,
    availableEnergy,
    sensibleHeat,
    latentHeat,
    closureResidual: netRadiation - storage - latentHeat - sensibleHeat,
  };
}
