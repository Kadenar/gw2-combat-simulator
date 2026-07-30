export const SIMULATION_RANDOMNESS_MODES = Object.freeze({
  DETERMINISTIC: "deterministic",
  STOCHASTIC: "stochastic",
});

export const MAX_SIMULATION_SEED = 0xffff_ffff;

export const DEFAULT_SIMULATION_RANDOMNESS = Object.freeze({
  mode: SIMULATION_RANDOMNESS_MODES.DETERMINISTIC,
  seed: 1,
});

function normalizedSeed(value) {
  const seed = Number(value);
  if (!Number.isFinite(seed)) return DEFAULT_SIMULATION_RANDOMNESS.seed;
  return Math.max(0, Math.min(MAX_SIMULATION_SEED, Math.trunc(seed)));
}

export function normalizeSimulationRandomness(value = {}) {
  return Object.freeze({
    mode:
      value?.mode === SIMULATION_RANDOMNESS_MODES.STOCHASTIC
        ? SIMULATION_RANDOMNESS_MODES.STOCHASTIC
        : SIMULATION_RANDOMNESS_MODES.DETERMINISTIC,
    seed: normalizedSeed(value?.seed),
  });
}

function streamSeed(seed, stream) {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (const character of String(stream || "default")) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function nextValue(state) {
  let value = (state + 0x6d2b79f5) >>> 0;
  let mixed = value;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  return {
    state: value,
    value: ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296,
  };
}

/**
 * Creates reproducible, independently keyed random streams for one simulation.
 *
 * Separate streams keep critical rolls stable when an unrelated trait starts
 * or stops consuming its own proc rolls.
 */
export function createSimulationRandom(value = {}) {
  const config = normalizeSimulationRandomness(value);
  const states = new Map();

  function next(stream = "default") {
    const key = String(stream || "default");
    const current = states.has(key)
      ? states.get(key)
      : streamSeed(config.seed, key);
    const generated = nextValue(current);
    states.set(key, generated.state);
    return generated.value;
  }

  function roll(probability, stream = "default") {
    const chance = Math.max(0, Math.min(1, Number(probability) || 0));
    if (chance <= 0) return false;
    if (chance >= 1) return true;
    return next(stream) < chance;
  }

  return Object.freeze({
    ...config,
    stochastic: config.mode === SIMULATION_RANDOMNESS_MODES.STOCHASTIC,
    next,
    roll,
  });
}
