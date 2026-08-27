/**
 * Reproducible simulation randomness. Provides a seeded RNG in deterministic or
 * stochastic mode with independently keyed streams, so an unrelated feature
 * starting or stopping its own proc rolls does not perturb critical rolls
 * elsewhere in the same simulation.
 */
export interface SimulationRandomnessConfig {
  readonly mode?: 'deterministic' | 'stochastic';
  readonly seed?: number;
}

export interface SimulationRandom {
  readonly mode: 'deterministic' | 'stochastic';
  readonly seed: number;
  readonly stochastic: boolean;
  next(stream?: string): number;
  roll(probability: number, stream?: string): boolean;
}

export const SIMULATION_RANDOMNESS_MODES = Object.freeze({
  DETERMINISTIC: 'deterministic',
  STOCHASTIC: 'stochastic'
} as const);

export const MAX_SIMULATION_SEED = 0xffff_ffff;

export const DEFAULT_SIMULATION_RANDOMNESS = Object.freeze({
  mode: SIMULATION_RANDOMNESS_MODES.DETERMINISTIC,
  seed: 1
});

function normalizedSeed(value: unknown): number {
  const seed = Number(value);
  if (!Number.isFinite(seed)) return DEFAULT_SIMULATION_RANDOMNESS.seed;
  return Math.max(0, Math.min(MAX_SIMULATION_SEED, Math.trunc(seed)));
}

export function normalizeSimulationRandomness(
  value: SimulationRandomnessConfig = {}
): Readonly<Required<SimulationRandomnessConfig>> {
  return Object.freeze({
    mode:
      value?.mode === SIMULATION_RANDOMNESS_MODES.STOCHASTIC
        ? SIMULATION_RANDOMNESS_MODES.STOCHASTIC
        : SIMULATION_RANDOMNESS_MODES.DETERMINISTIC,
    seed: normalizedSeed(value?.seed)
  });
}

function streamSeed(seed: number, stream: string): number {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (const character of String(stream || 'default')) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash;
}

interface GeneratedRandomValue {
  readonly state: number;
  readonly value: number;
}

function nextValue(state: number): GeneratedRandomValue {
  const value = (state + 0x6d2b79f5) >>> 0;
  let mixed = value;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return {
    state: value,
    value: ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
  };
}

/**
 * Creates reproducible, independently keyed random streams for one simulation.
 *
 * Separate streams keep one roll stream stable when an unrelated feature starts
 * or stops consuming its own proc rolls.
 */
export function createSimulationRandom(value: SimulationRandomnessConfig = {}): Readonly<SimulationRandom> {
  const config = normalizeSimulationRandomness(value);
  const states = new Map<string, number>();

  function next(stream = 'default'): number {
    const key = String(stream || 'default');
    const current = states.has(key) ? states.get(key) : streamSeed(config.seed, key);
    const generated = nextValue(current as number);
    states.set(key, generated.state);
    return generated.value;
  }

  function roll(probability: number, stream = 'default'): boolean {
    const chance = Math.max(0, Math.min(1, Number(probability) || 0));
    if (chance <= 0) return false;
    if (chance >= 1) return true;
    return next(stream) < chance;
  }

  return Object.freeze({
    ...config,
    stochastic: config.mode === SIMULATION_RANDOMNESS_MODES.STOCHASTIC,
    next,
    roll
  });
}
