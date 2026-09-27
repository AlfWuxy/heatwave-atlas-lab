import test from 'node:test';
import assert from 'node:assert/strict';
import { dryAdiabaticParcel, partitionSurfaceEnergy, potentialTemperatureK } from '../src/lib/physics.ts';

const close = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} 与 ${expected} 不一致`);
};

test('等压干绝热过程不改变温度或体积', () => {
  const result = dryAdiabaticParcel({ initialTemperatureC: 20, initialPressureHpa: 850, finalPressureHpa: 850 });
  close(result.finalTemperatureC, 20);
  close(result.temperatureChangeC, 0);
  close(result.relativeVolume, 1);
});

test('默认压缩实验温度约 33.94℃，气团体积减小', () => {
  const result = dryAdiabaticParcel({ initialTemperatureC: 20, initialPressureHpa: 850, finalPressureHpa: 1000 });
  close(result.finalTemperatureC, 33.94, 0.005);
  assert.ok(result.relativeVolume < 1);
});

test('膨胀降温，逆转过程恢复初始状态', () => {
  const expansion = dryAdiabaticParcel({ initialTemperatureC: 30, initialPressureHpa: 1000, finalPressureHpa: 600 });
  assert.ok(expansion.temperatureChangeC < 0);
  assert.ok(expansion.relativeVolume > 1);
  const inverse = dryAdiabaticParcel({ initialTemperatureC: expansion.finalTemperatureC, initialPressureHpa: 600, finalPressureHpa: 1000 });
  close(inverse.finalTemperatureC, 30);
  close(inverse.relativeVolume * expansion.relativeVolume, 1);
});

test('不同初温与压力组合均保持位温', () => {
  for (const initialTemperatureC of [-30, 0, 20, 40]) {
    for (const initialPressureHpa of [500, 850, 1050]) {
      for (const finalPressureHpa of [500, 1000, 1050]) {
        const result = dryAdiabaticParcel({ initialTemperatureC, initialPressureHpa, finalPressureHpa });
        close(result.initialPotentialTemperatureK, result.finalPotentialTemperatureK);
      }
    }
  }
  close(potentialTemperatureK(20, 1000), 293.15);
});

test('默认地表能量分配产生可核对的三个通量', () => {
  const result = partitionSurfaceEnergy({ netRadiation: 500, storageFraction: 0.15, evaporativeFraction: 0.55 });
  close(result.storage, 75);
  close(result.availableEnergy, 425);
  close(result.latentHeat, 233.75);
  close(result.sensibleHeat, 191.25);
  close(result.closureResidual, 0);
});

test('净辐射在边界与常见份额下闭合，包括全部储热', () => {
  for (const netRadiation of [0, 100, 500, 800]) {
    for (const storageFraction of [0, 0.15, 0.4, 1]) {
      for (const evaporativeFraction of [0, 0.55, 1]) {
        const result = partitionSurfaceEnergy({ netRadiation, storageFraction, evaporativeFraction });
        close(result.storage + result.sensibleHeat + result.latentHeat, netRadiation);
        assert.ok(result.sensibleHeat >= 0 && result.latentHeat >= 0);
      }
    }
  }
});

test('增加蒸发份额等量减少感热，不凭空产生能量', () => {
  const first = partitionSurfaceEnergy({ netRadiation: 500, storageFraction: 0.15, evaporativeFraction: 0.3 });
  const second = partitionSurfaceEnergy({ netRadiation: 500, storageFraction: 0.15, evaporativeFraction: 0.7 });
  close(second.latentHeat - first.latentHeat, first.sensibleHeat - second.sensibleHeat);
  close(first.storage, second.storage);
});

test('非有限数值、非物理压力和越界份额明确拒绝', () => {
  for (const invalid of [0, -10, Number.NaN, Infinity]) {
    assert.throws(() => dryAdiabaticParcel({ initialTemperatureC: 20, initialPressureHpa: invalid, finalPressureHpa: 1000 }), RangeError);
  }
  assert.throws(() => dryAdiabaticParcel({ initialTemperatureC: -273.15, initialPressureHpa: 850, finalPressureHpa: 1000 }), RangeError);
  assert.throws(() => partitionSurfaceEnergy({ netRadiation: 500, storageFraction: 0.1, evaporativeFraction: 1.1 }), RangeError);
  assert.throws(() => partitionSurfaceEnergy({ netRadiation: -100, storageFraction: 0.1, evaporativeFraction: 0.5 }), RangeError);
});
