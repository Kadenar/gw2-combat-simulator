import { GEAR_SLOTS, PREFIXES, INFUSION_STATS } from '#gw2/platform/equipment/gear/stats.js';
import { RUNE_NAMES } from '#gw2/platform/equipment/gear/runes.js';
import { FOOD_NAMES } from '#gw2/platform/equipment/consumables/food.js';
import { UTILITY_NAMES } from '#gw2/platform/equipment/consumables/utilities.js';
import { SIGIL_NAMES } from '#gw2/platform/equipment/sigils/data.js';
import { SIMULATION_RANDOMNESS_MODES } from '#kernel/core/simulation-random.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import type { Gw2AppAdapter, ProfessionAppState } from '#gw2/app/types.js';
import type { Gw2ApplicationBuild } from '#gw2/platform/builds/types.js';
import type { ObservationPolicy } from '#gw2/platform/engine/execution/types.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';
import type { Gw2SimulationResult } from '#gw2/platform/simulation/types.js';

export interface GearOptimizerSelections {
  prefixes?: string[];
  rune?: string[];
  relic?: string[];
  food?: string[];
  utility?: string[];
  sigils?: string[][][];
  infusionStats?: string[];
  infusionCount?: number;
  locks?: string[];
  minToughness?: number;
  maxToughness?: number;
  minBoonDuration?: number;
  minQuicknessDuration?: number;
}

export const OPTIMIZER_REQUIREMENTS = {
  minToughness: 'Minimum toughness',
  maxToughness: 'Maximum toughness',
  minBoonDuration: 'Minimum boon duration (%)',
  minQuicknessDuration: 'Minimum quickness duration (%)'
} as const;

export interface GearOptimizerRequest {
  readonly gameId: 'gw2';
  readonly contentId: string;
  readonly revision: number;
  readonly build: Gw2ApplicationBuild;
  readonly patchId: string;
  readonly patchValues: Gw2Config['patchValues'];
  readonly observationPolicy: ObservationPolicy;
  readonly selections: GearOptimizerSelections;
  readonly limit: number;
  readonly search?: 'exact' | 'fast';
}

export type OptimizerEquipment = Pick<
  Gw2ApplicationBuild,
  'gear' | 'alternateWeaponPrefixes' | 'weaponSigils' | 'rune' | 'relic' | 'food' | 'utility' | 'infusions'
>;

export interface OptimizerDimension {
  readonly key: string;
  readonly choices: readonly (string | string[] | Gw2ApplicationBuild['infusions'])[];
}

export interface OptimizerSpace {
  readonly request: GearOptimizerRequest;
  readonly dimensions: readonly OptimizerDimension[];
  readonly rawCount: bigint;
}

export type OptimizerScore = Pick<
  Gw2SimulationResult,
  | 'dps'
  | 'totalDamage'
  | 'strikeDamage'
  | 'conditionDamage'
  | 'duration'
  | 'dpsStartTime'
  | 'dpsWindow'
  | 'deathTime'
  | 'lastHitTime'
  | 'warnings'
>;

export interface OptimizerCandidate {
  readonly key: string;
  readonly equipment: OptimizerEquipment;
  readonly score: OptimizerScore;
  represented: string;
}

/** Freeze a clone so neither selector edits nor later build mutations alter a captured job. */
function freezeSnapshot<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeSnapshot);
    Object.freeze(value);
  }

  return value;
}

export function captureGearOptimizerRequest(
  app: ProfessionAppState,
  selections: GearOptimizerSelections,
  observationPolicy: ObservationPolicy = { kind: 'rotation' },
  search: 'exact' | 'fast' = 'exact'
): GearOptimizerRequest {
  const request: GearOptimizerRequest = structuredClone({
    gameId: 'gw2',
    contentId: app.contentId,
    revision: app.buildRevision,
    build: app.build,
    patchId: app.patchId,
    patchValues: app.profession.patchValuesFor?.(app.patchId) || {},
    observationPolicy,
    selections,
    limit: 20,
    search
  });
  // Resolve inherited alternate prefixes before any candidate can change the first set.
  request.build.alternateWeaponPrefixes = [0, 1].map(
    (slot) => request.build.alternateWeaponPrefixes?.[slot] || request.build.gear[`Weapon${slot + 1}`]
  );
  createOptimizerSpace(request, app.adapter);
  return freezeSnapshot(request);
}

/** Validate rather than normalize: a malformed selection must never silently shrink the search. */
function choices(value: string[] | undefined, current: string, names: readonly string[], cap = Infinity): string[] {
  if (
    value !== undefined &&
    (!Array.isArray(value) || value.some((name) => typeof name !== 'string' || !names.includes(name)))
  ) {
    throw new TypeError('Unknown equipment selection.');
  }

  const selected = [...new Set(value?.length ? value : [current])].sort();
  if (selected.length > cap) throw new RangeError(`Select at most ${cap} choices.`);
  if (selected.some((name) => !names.includes(name))) throw new TypeError(`Unknown current equipment: ${current}.`);
  return selected;
}

/** Retain usable equipped sets; kit and Gunsaber builds use their starting normal weapon set. */
export function optimizerWeaponSets(build: Gw2ApplicationBuild, adapter: Gw2AppAdapter): number[] {
  if (adapter.profession.ui.weaponSwapChangesSet === false || adapter.eliteSpecialization(build) === 'Bladesworn')
    return [build.startingWeaponSet === 2 ? 1 : 0];
  return build.alternateWeapons[0] ? [0, 1] : [0];
}

/** Model actual weapon stat budgets; two-handed weapons have one prefix and two sigils. */
export function optimizerSlots(build: Gw2ApplicationBuild, adapter: Gw2AppAdapter): string[] {
  const slots = GEAR_SLOTS.filter((slot) => !slot.startsWith('Weapon'));
  for (const set of optimizerWeaponSets(build, adapter)) {
    const weapons = set === 0 ? build.weapons : build.alternateWeapons;
    slots.push(set === 0 ? 'Weapon1' : 'AlternateWeapon1');
    if (adapter.weaponData[weapons[0]]?.wielding !== '2h') slots.push(set === 0 ? 'Weapon2' : 'AlternateWeapon2');
  }

  return slots;
}

export function createOptimizerSpace(request: GearOptimizerRequest, adapter: Gw2AppAdapter): OptimizerSpace {
  if (request.search !== undefined && !['exact', 'fast'].includes(request.search))
    throw new TypeError('Invalid optimizer search mode.');
  if (
    request.gameId !== 'gw2' ||
    request.contentId !== adapter.id ||
    !Number.isSafeInteger(request.revision) ||
    request.revision < 0
  ) {
    throw new TypeError('Invalid optimizer identity or revision.');
  }

  if (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > 20)
    throw new RangeError('Invalid result limit.');
  if (request.patchId !== 'current' && request.patchId !== adapter.profession.preview?.id)
    throw new TypeError('Unknown patch.');
  if (
    JSON.stringify(request.patchValues) !== JSON.stringify(adapter.profession.patchValuesFor?.(request.patchId) || {})
  )
    throw new TypeError('Patch data changed; start a new search.');
  const policy = request.observationPolicy;
  const boundary = policy?.kind === 'tail' ? policy.durationMs : policy?.kind === 'absolute' ? policy.endTimeMs : 0;
  if (!policy || !['rotation', 'tail', 'absolute'].includes(policy.kind) || !Number.isFinite(boundary) || boundary < 0)
    throw new TypeError('Invalid observation policy.');
  const validation = adapter.profession.validateBuild(request.build);
  if (!validation.valid) throw new TypeError(validation.errors.join('\n'));
  const build = request.build;
  const selections = request.selections;
  if (
    !selections ||
    typeof selections !== 'object' ||
    Array.isArray(selections) ||
    Object.keys(selections).some(
      (key) =>
        ![
          'prefixes',
          'rune',
          'relic',
          'food',
          'utility',
          'sigils',
          'infusionStats',
          'infusionCount',
          'locks',
          ...Object.keys(OPTIMIZER_REQUIREMENTS)
        ].includes(key)
    )
  ) {
    throw new TypeError('Invalid optimizer selections.');
  }

  // Omitted requirements are unrestricted; reject malformed bounds before starting workers.
  for (const key of Object.keys(OPTIMIZER_REQUIREMENTS) as (keyof typeof OPTIMIZER_REQUIREMENTS)[]) {
    const value = selections[key];
    if (
      value !== undefined &&
      (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (key.endsWith('Duration') && value > 100))
    )
      throw new RangeError(`Invalid ${OPTIMIZER_REQUIREMENTS[key].toLowerCase()}.`);
  }

  if (
    selections.minToughness !== undefined &&
    selections.maxToughness !== undefined &&
    selections.minToughness > selections.maxToughness
  )
    throw new RangeError('Minimum toughness must not exceed maximum toughness.');

  if (
    build.infusions.some((entry) => typeof entry.count !== 'number') ||
    (selections.infusionCount !== undefined && typeof selections.infusionCount !== 'number')
  ) {
    throw new TypeError('Infusion counts must be numbers.');
  }

  const slots = optimizerSlots(build, adapter);
  const upgradeKeys = ['rune', 'relic', 'food', 'utility'] as const;
  const sigilKeys = [0, 1].flatMap((set) => [0, 1].map((slot) => `sigil${set + 1}-${slot + 1}`));
  const locks = selections.locks || [];
  if (
    !Array.isArray(locks) ||
    locks.some((key) => ![...slots, ...upgradeKeys, ...sigilKeys, 'infusions'].includes(key))
  )
    throw new TypeError('Unknown equipment lock.');
  const dimensions: OptimizerDimension[] = [];
  // Validate even locked or unused selectors so misspellings do not disappear from the request.
  if (selections.prefixes !== undefined) choices(selections.prefixes, build.gear.Helm, PREFIXES, 3);
  for (const slot of slots) {
    const current = slot.startsWith('Alternate')
      ? build.alternateWeaponPrefixes[Number(slot.at(-1)) - 1]
      : build.gear[slot];
    dimensions.push({
      key: slot,
      choices: choices(locks.includes(slot) ? [] : selections.prefixes, current, PREFIXES, 3)
    });
  }

  for (const key of upgradeKeys) {
    const names =
      key === 'rune' ? RUNE_NAMES : key === 'relic' ? adapter.relicNames : key === 'food' ? FOOD_NAMES : UTILITY_NAMES;
    const selected = choices(
      selections[key],
      build[key],
      ['', ...names],
      key === 'food' || key === 'utility' ? 3 : Infinity
    );
    dimensions.push({ key, choices: locks.includes(key) ? [build[key]] : selected });
  }

  if (
    selections.sigils &&
    (!Array.isArray(selections.sigils) ||
      selections.sigils.length > 2 ||
      selections.sigils.some((set) => !Array.isArray(set) || set.length > 2))
  )
    throw new TypeError('Invalid sigil lists.');
  for (const set of [0, 1]) {
    const lists = [0, 1].map((slot) => {
      const selected = choices(selections.sigils?.[set]?.[slot], build.weaponSigils[set][slot], SIGIL_NAMES);
      return locks.includes(`sigil${set + 1}-${slot + 1}`) ? [build.weaponSigils[set][slot]] : selected;
    });
    if (!optimizerWeaponSets(build, adapter).includes(set)) {
      if (selections.sigils?.[set]?.some((list) => list.length))
        throw new TypeError(`Weapon set ${set + 1} is not available for this build.`);
      continue;
    }

    const pairs = lists[0].flatMap((first) =>
      lists[1].filter((second) => first !== second).map((second) => [first, second])
    );
    if (!pairs.length) throw new TypeError('Sigil lists contain no legal pair.');
    dimensions.push({ key: `sigils${set + 1}`, choices: pairs });
  }

  const currentCount = build.infusions.reduce((sum, infusion) => sum + infusion.count, 0);
  const count = selections.infusionCount ?? currentCount;
  if (!Number.isInteger(count) || count < 0 || count > 18)
    throw new RangeError('Infusion count must be an integer from 0 to 18.');
  const stats = selections.infusionStats || [];
  if (!Array.isArray(stats) || stats.some((stat) => !INFUSION_STATS.includes(stat)) || new Set(stats).size > 2)
    throw new TypeError('Select up to two known infusion stats.');
  const selectedStats = [...new Set(stats)].sort();
  let splits: Gw2ApplicationBuild['infusions'][];
  if (locks.includes('infusions') || !selectedStats.length) {
    if (!locks.includes('infusions') && count !== currentCount)
      throw new TypeError('Select infusion stats to change the total count.');
    splits = [build.infusions];
  } else if (count === 0) splits = [[]];
  else if (selectedStats.length === 1) splits = [[{ stat: selectedStats[0], count }]];
  else
    splits = Array.from({ length: count + 1 }, (_, first) =>
      [
        { stat: selectedStats[0], count: first },
        { stat: selectedStats[1], count: count - first }
      ].filter((infusion) => infusion.count > 0)
    );
  dimensions.push({ key: 'infusions', choices: splits });
  return {
    request,
    dimensions,
    rawCount: optimizerCardinality(dimensions.map((dimension) => BigInt(dimension.choices.length)))
  };
}

export function optimizerCardinality(counts: readonly bigint[]): bigint {
  return counts.reduce((total, count) => total * count, 1n);
}

/** Copy only equipment so Apply cannot overwrite rotation, traits, assumptions, or weapon types. */
export function optimizerEquipment(build: Gw2ApplicationBuild): OptimizerEquipment {
  return structuredClone({
    gear: build.gear,
    alternateWeaponPrefixes: build.alternateWeaponPrefixes,
    weaponSigils: build.weaponSigils,
    rune: build.rune,
    relic: build.relic,
    food: build.food,
    utility: build.utility,
    infusions: build.infusions
  });
}

export function assignOptimizerChoice(
  equipment: OptimizerEquipment,
  key: string,
  value: OptimizerDimension['choices'][number]
): void {
  if (key === 'infusions') equipment.infusions = structuredClone(value as Gw2ApplicationBuild['infusions']);
  else if (key.startsWith('sigils')) equipment.weaponSigils[Number(key.at(-1)) - 1] = [...(value as string[])];
  else if (key.startsWith('Alternate')) equipment.alternateWeaponPrefixes[Number(key.at(-1)) - 1] = value as string;
  else if (['rune', 'relic', 'food', 'utility'].includes(key)) equipment[key as 'rune'] = value as string;
  else equipment.gear[key] = value as string;
}

/** Mixed-radix ordinals give the ordinary oracle an independent, exhaustive Cartesian traversal. */
export function ordinaryEquipmentAt(space: OptimizerSpace, ordinal: bigint): OptimizerEquipment {
  if (ordinal < 0n || ordinal >= space.rawCount) throw new RangeError('Candidate ordinal outside search.');
  const equipment = optimizerEquipment(space.request.build);
  for (const dimension of space.dimensions) {
    const radix = BigInt(dimension.choices.length);
    assignOptimizerChoice(equipment, dimension.key, dimension.choices[Number(ordinal % radix)]);
    ordinal /= radix;
  }

  return equipment;
}

/** Use the runtime's lower-level path; no presentation, persistence, or secondary analyses run here. */
export function createOptimizerEvaluator(request: GearOptimizerRequest, adapter: Gw2AppAdapter) {
  createOptimizerSpace(request, adapter);
  const activeCatalog = adapter.profession.catalogFor?.(request.patchId) || adapter.profession.catalog;
  function prepare(equipment: OptimizerEquipment): Gw2Config;
  function prepare(equipment: OptimizerEquipment, enforceRequirements: true): Gw2Config | null;
  function prepare(equipment: OptimizerEquipment, enforceRequirements = false): Gw2Config | null {
    // The runtime preparation seam reads only these fields; UI methods are deliberately unavailable headlessly.
    const app = {
      build: { ...request.build, ...equipment },
      adapter,
      profession: adapter.profession,
      activeCatalog,
      patchId: request.patchId,
      skillByName: activeCatalog.skillsByName,
      skillById: activeCatalog.skillsById,
      attributeWeaponSet: request.build.startingWeaponSet,
      results: null
    } as ProfessionAppState;
    adapter.recalculate(app);
    // Reject candidates using finalized build attributes on every usable set before creating a combat simulation.
    const limits = request.selections;
    if (
      enforceRequirements &&
      Object.keys(OPTIMIZER_REQUIREMENTS).some(
        (key) => limits[key as keyof typeof OPTIMIZER_REQUIREMENTS] !== undefined
      )
    ) {
      const startingAttributes = app.attributeData;
      for (const set of optimizerWeaponSets(request.build, adapter)) {
        app.attributeWeaponSet = set + 1;
        if (app.attributeWeaponSet === request.build.startingWeaponSet) app.attributeData = startingAttributes;
        else adapter.recalculate(app);
        const attributes = app.attributeData!.attributes;
        const toughness = attributes.Toughness.final;
        const boonDuration = attributes['Boon Duration']?.final || 0;
        const quicknessDuration = boonDuration + (attributes['Quickness Duration']?.final || 0);
        if (
          (limits.minToughness !== undefined && toughness < limits.minToughness) ||
          (limits.maxToughness !== undefined && toughness > limits.maxToughness) ||
          (limits.minBoonDuration !== undefined && Math.min(100, boonDuration) < limits.minBoonDuration) ||
          (limits.minQuicknessDuration !== undefined && Math.min(100, quicknessDuration) < limits.minQuicknessDuration)
        )
          return null;
      }

      app.attributeWeaponSet = request.build.startingWeaponSet;
      app.attributeData = startingAttributes;
    }

    const config = adapter.simulationConfig(app);
    return {
      ...config,
      patchValues: request.patchValues,
      randomness: { ...config.randomness, mode: SIMULATION_RANDOMNESS_MODES.DETERMINISTIC }
    };
  }

  const evaluate = (equipment: OptimizerEquipment): Gw2SimulationResult =>
    adapter.simulateBuild(request.build.rotation, prepare(equipment), request.observationPolicy);
  const score = (equipment: OptimizerEquipment): OptimizerScore | null => {
    const config = prepare(equipment, true);
    if (!config) return null;
    return simulateGw2({
      profession: adapter.profession,
      rotation: request.build.rotation,
      config,
      observationPolicy: request.observationPolicy,
      output: 'score'
    });
  };

  return { prepare, evaluate, score };
}

/** Retain just ranking fields and reject invalid arithmetic instead of treating errors as zero damage. */
export function optimizerScore(result: OptimizerScore): OptimizerScore {
  const {
    dps,
    totalDamage,
    strikeDamage,
    conditionDamage,
    duration,
    dpsStartTime,
    dpsWindow,
    deathTime,
    lastHitTime,
    warnings
  } = result;
  if (
    [dps, totalDamage, strikeDamage, conditionDamage, duration, dpsStartTime, dpsWindow, deathTime, lastHitTime].some(
      (value) => value !== null && !Number.isFinite(value)
    )
  )
    throw new TypeError('Optimizer simulation produced a non-finite score.');
  return {
    dps,
    totalDamage,
    strikeDamage,
    conditionDamage,
    duration,
    dpsStartTime,
    dpsWindow,
    deathTime,
    lastHitTime,
    warnings: [...warnings]
  };
}

export function compareOptimizerCandidates(a: OptimizerCandidate, b: OptimizerCandidate): number {
  return b.score.dps - a.score.dps || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}

export function retainOptimizerCandidate(
  winners: OptimizerCandidate[],
  candidate: OptimizerCandidate,
  limit = 20
): void {
  const previous = winners.find((winner) => winner.key === candidate.key);
  if (previous) {
    previous.represented = (BigInt(previous.represented) + BigInt(candidate.represented)).toString();
    // Completion order must not choose a different representative for an equal combat vector.
    if (JSON.stringify(candidate.equipment) < JSON.stringify(previous.equipment)) {
      Object.assign(previous, { equipment: candidate.equipment });
    }

    return;
  }

  winners.push(candidate);
  winners.sort(compareOptimizerCandidates);
  if (winners.length > limit) winners.pop();
}

/** A fast/full discrepancy fails the entire search; reranking finalists cannot recover a discarded winner. */
export function verifyOptimizerScore(expected: OptimizerScore, actual: OptimizerScore): void {
  for (const key of Object.keys(expected) as (keyof OptimizerScore)[]) {
    if (JSON.stringify(expected[key]) !== JSON.stringify(actual[key]))
      throw new Error(`Optimizer correctness failure: ${key} differs during detailed verification.`);
  }
}

const optimizerApplications = new WeakMap<
  ProfessionAppState,
  { request: GearOptimizerRequest; revision: number; candidate: OptimizerCandidate }
>();

/** Only this search's own Apply operations advance its accepted revision; unrelated edits still invalidate results. */
export function isOptimizerRequestCurrent(app: ProfessionAppState, request: GearOptimizerRequest): boolean {
  const applied = optimizerApplications.get(app);
  const revision = applied?.request === request ? applied.revision : request.revision;
  return app.buildRevision === revision && app.contentId === request.contentId && app.patchId === request.patchId;
}

/** The pinned comparison follows the last applied result without modifying the immutable search snapshot. */
export function optimizerAppliedCandidate(
  app: ProfessionAppState,
  request: GearOptimizerRequest
): OptimizerCandidate | null {
  const applied = optimizerApplications.get(app);
  return applied?.request === request && isOptimizerRequestCurrent(app, request) ? applied.candidate : null;
}

/** Apply through normal persistence, then accept the resulting revision so other results can be tried. */
export function applyOptimizerCandidate(
  app: ProfessionAppState,
  request: GearOptimizerRequest,
  candidate: OptimizerCandidate
): void {
  if (!isOptimizerRequestCurrent(app, request)) throw new Error('This optimizer result is stale. Run a new search.');
  Object.assign(app.build, structuredClone(candidate.equipment));
  app.changed();
  optimizerApplications.set(app, { request, revision: app.buildRevision, candidate });
}

/** Small-search reference: every legal assignment gets its own ordinary build and detailed simulation. */
export function runOrdinaryOptimizer(request: GearOptimizerRequest, adapter: Gw2AppAdapter): OptimizerCandidate[] {
  const space = createOptimizerSpace(request, adapter);
  const evaluator = createOptimizerEvaluator(request, adapter);
  const winners: OptimizerCandidate[] = [];
  for (let ordinal = 0n; ordinal < space.rawCount; ordinal++) {
    const equipment = ordinaryEquipmentAt(space, ordinal);
    const config = evaluator.prepare(equipment, true);
    if (!config) continue;
    retainOptimizerCandidate(
      winners,
      {
        key: JSON.stringify(equipment),
        equipment,
        score: optimizerScore(adapter.simulateBuild(request.build.rotation, config, request.observationPolicy)),
        represented: '1'
      },
      request.limit
    );
  }

  return winners;
}
