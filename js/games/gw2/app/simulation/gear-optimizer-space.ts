import { GEAR_STATS, INFUSION_BONUS } from '#gw2/platform/equipment/gear/stats.js';
import { RUNE_DATA } from '#gw2/platform/equipment/gear/runes.js';
import { PRIMARY_ATTRIBUTES } from '#gw2/platform/builds/attributes.js';
import type { Gw2AppAdapter } from '#gw2/app/types.js';
import {
  assignOptimizerChoice,
  optimizerCardinality,
  optimizerWeaponSets,
  optimizerEquipment,
  createOptimizerSpace,
  createOptimizerEvaluator,
  optimizerScore,
  retainOptimizerCandidate,
  type GearOptimizerRequest,
  type OptimizerCandidate,
  type OptimizerEquipment,
  type OptimizerSpace,
  type OptimizerDimension
} from '#gw2/app/simulation/gear-optimizer.js';

const stats = GEAR_STATS as Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, number>>>>>>;
export interface GroupedOptimizerSpace {
  readonly ordinary: OptimizerSpace;
  readonly statDimensions: readonly OptimizerDimension[];
  readonly totals: readonly { path: string; represented: bigint }[];
  readonly upgrades: readonly OptimizerDimension[];
  readonly count: bigint;
}

const runes = RUNE_DATA as Readonly<
  Record<string, { stats: Readonly<Record<string, number>>; durations: Readonly<Record<string, number>> }>
>;
const runeDurations = [...new Set(Object.values(runes).flatMap((rune) => Object.keys(rune.durations)))].sort();

/** Gear, runes and infusions share the conversion pool; preserve every primary and rune duration on usable sets. */
function contribution(
  key: string,
  value: OptimizerDimension['choices'][number],
  space: OptimizerSpace,
  adapter: Gw2AppAdapter
): number[] {
  const alternate = key.startsWith('Alternate');
  const statSlot = alternate ? key.slice('Alternate'.length) : key;
  const weapons = alternate ? space.request.build.alternateWeapons : space.request.build.weapons;
  const effective = statSlot === 'Weapon1' && adapter.weaponData[weapons[0]]?.wielding === '2h' ? 'Weapon2H' : statSlot;
  const attributes = key === 'rune' ? runes[value as string]?.stats : stats[value as string]?.[effective];
  const primary = PRIMARY_ATTRIBUTES.map((name) =>
    key === 'infusions'
      ? (value as OptimizerEquipment['infusions']).reduce(
          (sum, infusion) => sum + (infusion.stat === name ? infusion.count * INFUSION_BONUS : 0),
          0
        )
      : attributes?.[name] || 0
  );
  const vectors = optimizerWeaponSets(space.request.build, adapter).flatMap((set) => {
    const included = alternate ? set === 1 : !key.includes('Weapon') || set === 0;
    return included ? primary : primary.map(() => 0);
  });
  return [
    ...vectors,
    ...runeDurations.map((name) => (key === 'rune' ? runes[value as string]?.durations[name] || 0 : 0))
  ];
}

/** A cheap upper bound keeps selector edits responsive; exact merging runs only in workers. */
export function estimateOptimizerCount(ordinary: OptimizerSpace, adapter: Gw2AppAdapter): bigint {
  const buckets = new Map<string, { slots: number; choices: number }>();
  for (const dimension of ordinary.dimensions) {
    const isGear = Object.hasOwn(ordinary.request.build.gear, dimension.key);
    const signature =
      isGear && !dimension.key.includes('Weapon')
        ? JSON.stringify(
            dimension.choices.map((prefix) => [
              prefix,
              contribution(dimension.key, prefix as string, ordinary, adapter)
            ])
          )
        : dimension.key;
    const bucket = buckets.get(signature) || { slots: 0, choices: dimension.choices.length };
    bucket.slots++;
    buckets.set(signature, bucket);
  }

  return optimizerCardinality(
    [...buckets.values()].map(({ slots, choices }) => {
      let count = 1n;
      for (let i = 1; i <= slots; i++) count = (count * BigInt(choices + i - 1)) / BigInt(i);
      return count;
    })
  );
}

/** Merge equal integer totals after each slot, retaining coverage and the smallest representative assignment. */
export function groupOptimizerSpace(ordinary: OptimizerSpace, adapter: Gw2AppAdapter): GroupedOptimizerSpace {
  // Follow the equipment object's serialization order so ties preserve the ordinary oracle's representative.
  const slotOrder = [
    ...Object.keys(ordinary.request.build.gear),
    'AlternateWeapon1',
    'AlternateWeapon2',
    'rune',
    'infusions'
  ];
  const statDimensions = ordinary.dimensions
    .filter(({ key }) => slotOrder.includes(key))
    .sort((a, b) => slotOrder.indexOf(a.key) - slotOrder.indexOf(b.key))
    .map((dimension) => ({
      ...dimension,
      choices: [...dimension.choices].sort((a, b) =>
        JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0
      )
    }));
  const contributions = statDimensions.map((dimension) =>
    dimension.choices.map((value) => contribution(dimension.key, value, ordinary, adapter))
  );
  // Constant attributes cannot distinguish candidates; compact keys and choice-index paths avoid storing full builds.
  const varying = Array.from({ length: contributions[0][0].length }, (_, i) => i).filter((i) =>
    contributions.some((choices) => choices.some((choice) => choice[i] !== choices[0][i]))
  );
  let totals = new Map<string, { path: string; represented: bigint }>([
    [varying.map(() => 0).join(','), { path: '', represented: 1n }]
  ]);
  for (const choices of contributions) {
    if (choices.length === 1) {
      for (const total of totals.values()) total.path += String.fromCharCode(0);
      continue;
    }

    const next: typeof totals = new Map();
    for (const [key, total] of totals) {
      const vector = key ? key.split(',').map(Number) : [];
      choices.forEach((addition, index) => {
        const key = varying.map((attribute, i) => vector[i] + addition[attribute]).join(',');
        const path = total.path + String.fromCharCode(index);
        const previous = next.get(key);
        if (previous) {
          previous.represented += total.represented;
          if (path < previous.path) previous.path = path;
        } else next.set(key, { path, represented: total.represented });
      });
    }

    totals = next;
  }

  // Foods, utilities, relics and ordered sigils retain their identities because their behavior can differ.
  const upgrades = ordinary.dimensions.filter(({ key }) => !slotOrder.includes(key));
  return {
    ordinary,
    statDimensions,
    totals: [...totals.values()],
    upgrades,
    count: BigInt(totals.size) * optimizerCardinality(upgrades.map(({ choices }) => BigInt(choices.length)))
  };
}

/** Each ordinal selects a unique stat total and upgrade tuple, allowing disjoint work across the worker pool. */
export function groupedEquipmentAt(
  space: GroupedOptimizerSpace,
  ordinal: bigint
): { equipment: OptimizerEquipment; represented: bigint } {
  if (ordinal < 0n || ordinal >= space.count) throw new RangeError('Candidate ordinal outside grouped search.');
  const equipment = optimizerEquipment(space.ordinary.request.build);
  const radix = BigInt(space.totals.length);
  const total = space.totals[Number(ordinal % radix)];
  ordinal /= radix;
  space.statDimensions.forEach((dimension, index) =>
    assignOptimizerChoice(equipment, dimension.key, dimension.choices[total.path.charCodeAt(index)])
  );
  for (const dimension of space.upgrades) {
    const radix = BigInt(dimension.choices.length);
    assignOptimizerChoice(equipment, dimension.key, dimension.choices[Number(ordinal % radix)]);
    ordinal /= radix;
  }

  return { equipment, represented: total.represented };
}

/** Compare combined converted stats and rune durations while retaining independent proc and consumable identities. */
export function optimizerEquivalenceKey(
  equipment: OptimizerEquipment,
  space: OptimizerSpace,
  adapter: Gw2AppAdapter
): string {
  let vector: number[] = [];
  for (const dimension of space.dimensions) {
    const key = dimension.key;
    const value =
      key === 'rune' || key === 'infusions'
        ? equipment[key]
        : key.startsWith('Alternate')
          ? equipment.alternateWeaponPrefixes[Number(key.at(-1)) - 1]
          : equipment.gear[key];
    if (value === undefined) continue;
    const addition = contribution(key, value, space, adapter);
    vector = addition.map((value, index) => value + (vector[index] || 0));
  }

  return JSON.stringify([
    vector,
    equipment.relic,
    equipment.food,
    equipment.utility,
    optimizerWeaponSets(space.request.build, adapter).map((set) => equipment.weaponSigils[set])
  ]);
}

/** Unique ordinals belong to one worker range, so no score cache or repeat simulations are needed. */
export function createGroupedOptimizer(request: GearOptimizerRequest, adapter: Gw2AppAdapter) {
  const ordinary = createOptimizerSpace(request, adapter);
  // ponytail: workers rebuild this index; share a packed index if preparation becomes the bottleneck.
  const space = groupOptimizerSpace(ordinary, adapter);
  const evaluator = createOptimizerEvaluator(request, adapter);
  const evaluateRange = (start: bigint, end: bigint) => {
    if (start < 0n || end > space.count || end <= start) throw new RangeError('Invalid optimizer chunk.');
    const winners: OptimizerCandidate[] = [];
    let represented = 0n;
    let simulations = 0n;
    const warnings = new Map<string, number>();
    for (let ordinal = start; ordinal < end; ordinal++) {
      const candidate = groupedEquipmentAt(space, ordinal);
      const key = optimizerEquivalenceKey(candidate.equipment, ordinary, adapter);
      const score = optimizerScore(evaluator.score(candidate.equipment));
      simulations++;

      for (const warning of score.warnings) {
        const category =
          warnings.has(warning) || warnings.size < 32 ? warning : 'Additional warnings (see retained candidates)';
        warnings.set(category, (warnings.get(category) || 0) + 1);
      }

      represented += candidate.represented;
      retainOptimizerCandidate(
        winners,
        { key, equipment: candidate.equipment, score, represented: candidate.represented.toString() },
        request.limit
      );
    }

    return {
      winners,
      represented: represented.toString(),
      simulations: simulations.toString(),
      warnings: [...warnings]
    };
  };

  return { space, evaluator, evaluateRange };
}
