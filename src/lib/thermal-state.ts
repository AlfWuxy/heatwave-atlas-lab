import type { ThermalPreset, ThermalSolver } from './thermal-solver';
import type { ParticleQuality, ThermalFrame } from './thermal-renderer';

export type ThermalSettings = { preset: ThermalPreset; buoyancy: boolean; strength: number; quality: ParticleQuality; field: boolean; seed: number; renderer: 'auto' | 'canvas' };
export type ThermalDiagnostics = ReturnType<ThermalSolver['diagnostics']>;
export type ThermalCommand = { id: number } & (
  | { type: 'init'; preset: ThermalPreset }
  | { type: 'reset'; preset: ThermalPreset }
  | { type: 'advance'; steps: number; buoyancy: boolean }
  | { type: 'heat'; x: number; y: number; amount: number }
  | { type: 'push'; x: number; y: number; dx: number; dy: number }
);
export type ThermalReply = { id: number; type: 'frame'; frame: ThermalFrame; diagnostics: ThermalDiagnostics; reset: boolean } | { id: number; type: 'error'; message: string };

export function readThermalSettings(hash = window.location.hash): ThermalSettings {
  const params = new URLSearchParams(hash.split('?')[1]);
  const preset = params.get('preset'), quality = params.get('quality');
  const number = (key: string, fallback: number) => { const value = params.get(key); return value !== null && value.trim() && Number.isFinite(Number(value)) ? Number(value) : fallback; };
  return {
    preset: preset === 'plume' || preset === 'cold' ? preset : 'meeting',
    buoyancy: params.get('buoyancy') !== '0',
    strength: Math.max(0.2, Math.min(1.5, number('strength', 0.8))),
    quality: quality === 'low' || quality === 'high' ? quality : quality === 'medium' ? 'medium' : window.innerWidth < 700 ? 'low' : 'medium',
    field: params.get('field') !== '0',
    seed: Math.max(1, Math.min(2147483647, Math.floor(number('seed', 42)))),
    renderer: params.get('renderer') === 'canvas' ? 'canvas' : 'auto',
  };
}

export function thermalHash(settings: ThermalSettings) {
  return '#particles?' + new URLSearchParams({ preset: settings.preset, buoyancy: settings.buoyancy ? '1' : '0', strength: String(settings.strength), quality: settings.quality, field: settings.field ? '1' : '0', seed: String(settings.seed), renderer: settings.renderer });
}
