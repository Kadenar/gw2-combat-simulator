import { loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';
import { normalizeRotation } from '#gw2/platform/engine/execution/rotation.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { getRotationItems } from '#gw2/app/build/io/files.js';
import { digest, SCHEMA } from './storage.mjs';

export const MAX_COMMANDS = 2000;
const TOLERANCE = 0.00001;

export async function prepareBuild(saved) {
  if (!saved || typeof saved.profession !== 'string')
    throw new Error('Build JSON must be a simulator Export Build file with a profession.');
  const adapter = await loadProfessionAppAdapter(saved.profession);
  if (!adapter) throw new Error(`Unknown profession: ${saved.profession}`);
  // Fixed-window training uses an immortal target; preserve all other build assumptions.
  const build = adapter.toApplicationBuild({ ...saved, targetHealth: 0, rotation: [] });
  build.assumptions = { ...build.assumptions, simulationMode: 'deterministic' };
  const catalog = adapter.profession.catalog;
  const app = {
    build,
    adapter,
    profession: adapter.profession,
    activeCatalog: catalog,
    patchId: 'current',
    skillByName: catalog.skillsByName,
    skillById: catalog.skillsById,
    attributeWeaponSet: build.startingWeaponSet,
    results: null
  };
  adapter.recalculate(app);
  const config = { ...adapter.simulationConfig(app), randomness: { mode: 'deterministic', seed: 1 } };
  return { build, config, profession: adapter.profession, catalog };
}

export function commandsFrom(payload, catalog) {
  const items = getRotationItems(payload);
  if (!items?.length) throw new Error('Rotation JSON must contain a nonempty rotation array (or be an array).');
  if (items.length > MAX_COMMANDS) throw new Error(`Rotation exceeds ${MAX_COMMANDS} commands.`);
  const commands = normalizeRotation(items, catalog, { strict: true });
  for (const command of commands) {
    if (command.type === 'cast' && !catalog.skillsById.has(command.skillId))
      throw new Error(`Unknown skill: ${command.skillId}`);
  }

  return commands;
}

export function splitRotation(commands) {
  const markers = commands.filter((command) => command.type === 'combat-start');
  if (markers.length > 1) throw new Error('Use exactly one Combat Start marker.');
  const index = commands.findIndex((command) => command.type === 'combat-start');
  const prefix = index < 0 ? [{ type: 'combat-start' }] : commands.slice(0, index + 1);
  const rotation = commands.slice(index + 1);
  validateBody(rotation);
  return { prefix, rotation };
}

/** Artificial state initialization and forced RNG outcomes are never search actions. */
export function validateBody(rotation) {
  if (!Array.isArray(rotation) || !rotation.length || rotation.length > MAX_COMMANDS)
    throw new Error(`Candidate must have 1–${MAX_COMMANDS} commands.`);
  for (const command of rotation) {
    if (!command || !['cast', 'wait'].includes(command.type))
      throw new Error('Combat Start and cooldown resets belong only in the locked precast prefix.');
    if (command.initialStateDurationMs != null || command.doubleEdgeOutcome != null || command.offTarget) {
      throw new Error('Mutable combat commands cannot initialize state, force RNG outcomes, or cast off target.');
    }

    if (command.type === 'wait' && (!Number.isFinite(command.durationMs) || command.durationMs < 0))
      throw new Error('Invalid wait duration.');
  }
}

export function summarize(result, seconds) {
  return {
    totalDamage: result.totalDamage,
    fixedWindowDps: result.totalDamage / seconds,
    simulatorDps: result.dps,
    duration: result.duration,
    dpsWindow: result.dpsWindow,
    strikeDamage: result.strikeDamage,
    conditionDamage: result.conditionDamage,
    combatStartTime: result.combatStartTime,
    deathTime: result.deathTime,
    warnings: result.warnings
  };
}

export async function createEvaluator(scenario) {
  const adapter = await loadProfessionAppAdapter(scenario.profession);
  const profession = adapter.profession;
  function run(rotation, { detailed = false, mode = 'deterministic', seed = 1 } = {}) {
    return simulateGw2({
      profession,
      config: { ...scenario.config, randomness: { mode, seed } },
      rotation,
      output: detailed ? 'detailed' : 'score'
    });
  }

  function evaluate(rotation, options = {}) {
    const id = digest(rotation);
    const rejected = (reason) => ({ id, rotation, valid: false, reason });
    try {
      validateBody(rotation);
      if (scenario.prefix.length + rotation.length + 1 > MAX_COMMANDS)
        return rejected('Too many commands including precast and final wait.');
      const commands = [...scenario.prefix, ...rotation];
      const initial = run(commands, options);
      if (initial.warnings.length) return rejected(initial.warnings.join('; '));
      if (initial.duration > scenario.endTime + TOLERANCE) return rejected('Rotation exceeds the fixed time window.');
      const wait = Math.max(0, scenario.endTime - initial.duration) * 1000;
      const padded = wait > 0 ? [...commands, { type: 'wait', durationMs: wait }] : commands;
      // Explicit final wait makes ordinary browser replay use the identical observation boundary.
      const result = run(padded, options);
      if (result.warnings.length) return rejected(result.warnings.join('; '));
      if (
        Math.abs(result.duration - scenario.endTime) > TOLERANCE ||
        Math.abs(result.combatStartTime - scenario.combatStart) > TOLERANCE
      ) {
        return rejected('Combat timing changed after padding; this candidate cannot be scored at the fixed boundary.');
      }

      if (result.deathTime != null) return rejected('Target died before the observation boundary.');
      if (!Number.isFinite(result.totalDamage) || result.totalDamage < 0)
        return rejected('Simulator returned invalid damage.');
      return {
        id,
        rotation,
        valid: true,
        score: result.totalDamage,
        metrics: summarize(result, scenario.seconds),
        ...(options.detailed ? { exportedRotation: padded } : {})
      };
    } catch (error) {
      return rejected(`Simulation error: ${error.message}`);
    }
  }

  /** Fit demonstrations once. Search candidates that overrun are rejected, never silently repaired. */
  function fit(rotation) {
    let retained = [...rotation];
    while (retained.length) {
      const result = run([...scenario.prefix, ...retained], { detailed: true });
      if (result.duration <= scenario.endTime + TOLERANCE) return retained;
      const firstOverrun = result.steps.find(
        (step) => step.end / 1000 > scenario.endTime + TOLERANCE && step.ri >= scenario.prefix.length
      );
      const length = firstOverrun ? firstOverrun.ri - scenario.prefix.length : retained.length - 1;
      retained = retained.slice(0, Math.min(retained.length - 1, length));
    }

    throw new Error('No combat action fits the selected time window. Increase --seconds.');
  }

  return { evaluate, fit, catalog: profession.catalog, run };
}

export async function makeScenario(saved, seed, seconds, engine) {
  const prepared = await prepareBuild(saved);
  const { prefix, rotation } = splitRotation(commandsFrom(seed, prepared.catalog));
  const initial = simulateGw2({ profession: prepared.profession, config: prepared.config, rotation: prefix });
  if (initial.warnings.length) throw new Error(`Precast warnings: ${initial.warnings.join('; ')}`);
  const payload = {
    schema: SCHEMA,
    engine,
    profession: saved.profession,
    build: prepared.build,
    config: prepared.config,
    objective: 'fixed-window-player-damage',
    seconds,
    prefix,
    combatStart: initial.combatStartTime,
    endTime: initial.combatStartTime + seconds
  };
  // Store only serializable config values; worker and main-process execution receive identical input.
  const serialized = JSON.parse(JSON.stringify(payload));
  const scenario = { ...serialized, id: digest(serialized) };
  const evaluator = await createEvaluator(scenario);
  const fitted = evaluator.fit(rotation);
  const baseline = evaluator.evaluate(fitted);
  if (!baseline.valid || baseline.score <= 0)
    throw new Error(`Seed cannot be used: ${baseline.reason || 'No damage in the selected window.'}`);
  return { scenario, baseline, originalCommands: rotation.length, evaluator };
}
