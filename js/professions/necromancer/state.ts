import {
  professionStaticRulesApplied,
} from "../../platform/gw2/attribute-provenance.js";
import { NECROMANCER_TRAIT_IDS } from "./data/ids.js";
import type {
  SkillId,
} from "../../platform/engine/types.js";
import type {
  NecromancerConfig,
  NecromancerEndStateProjectionOptions,
  NecromancerState,
} from "./types.js";

export const NECROMANCER_BASE_HEALTH = 9212;

export function selectedNecromancerTraits(
  config: NecromancerConfig = {},
): Set<string | number> {
  return new Set(
    [
      ...(config.traitIds || []),
      ...(config.selectedTraitIds || []),
      ...(config.selectedTraits || []),
    ].map((value) => (Number.isFinite(Number(value)) ? Number(value) : value)),
  );
}

export function hasNecromancerTrait(
  configOrTraits: NecromancerConfig | ReadonlySet<string | number>,
  traitId: SkillId,
): boolean {
  const traits =
    typeof (configOrTraits as ReadonlySet<string | number>).has === "function"
      ? configOrTraits as ReadonlySet<string | number>
      : selectedNecromancerTraits(configOrTraits as NecromancerConfig);
  return traits.has(traitId) || traits.has(String(traitId));
}

function necromancerMaximumHealth(
  config: NecromancerConfig,
  traits: ReadonlySet<string | number>,
): number {
  let vitality = Number(
    config.stats?.vitality
    ?? config.attributes?.vitality
    ?? 1000,
  );
  if (!professionStaticRulesApplied(config)) {
    if (hasNecromancerTrait(traits, NECROMANCER_TRAIT_IDS.SPITEFUL_FORTITUDE)) {
      vitality += Number(
        config.stats?.power
        ?? config.attributes?.power
        ?? 1000,
      ) * 0.1;
    }
    if (hasNecromancerTrait(traits, NECROMANCER_TRAIT_IDS.VITAL_PERSISTENCE)) {
      vitality += 180;
    }
    if (
      config.specialization === "Harbinger"
      || hasNecromancerTrait(traits, NECROMANCER_TRAIT_IDS.ALCHEMIC_VIGOR)
    ) {
      vitality += 240;
    }
  }
  return NECROMANCER_BASE_HEALTH + Math.max(0, vitality) * 10;
}

export function normalizedNecromancerLifeForceCost(
  state: Partial<NecromancerState>,
  baseHealthPercent: number,
): number {
  const actualCost =
    NECROMANCER_BASE_HEALTH * Math.max(0, Number(baseHealthPercent || 0)) / 100;
  const actualCapacity = Math.max(
    1,
    Number(state?.lifeForcePoolCapacity || 1),
  );
  const normalizedCapacity = Math.max(
    1,
    Number(state?.maximumLifeForce || 100),
  );
  return actualCost * normalizedCapacity / actualCapacity;
}

export function actualNecromancerLifeForceCost(
  baseHealthPercent: number,
): number {
  return NECROMANCER_BASE_HEALTH
    * Math.max(0, Number(baseHealthPercent || 0))
    / 100;
}

export function syncNecromancerResources(
  state: NecromancerState,
): NecromancerState {
  state.lifeForce = Math.max(
    0,
    Math.min(
      Number(state.maximumLifeForce || 100),
      Number(state.lifeForce || 0),
    ),
  );
  state.resource = state.lifeForce;
  state.blightExpiries = (state.blightExpiries || [])
    .sort((left, right) => left - right)
    .slice(-25);
  state.blight = state.blightExpiries.length;
  state.soulShardExpiries = (state.soulShardExpiries || [])
    .sort((left, right) => left - right)
    .slice(-6);
  state.soulShards = state.soulShardExpiries.length;
  return state;
}

export function createNecromancerState(
  config: NecromancerConfig = {},
): NecromancerState {
  const traits = selectedNecromancerTraits(config);
  const soulBattery = hasNecromancerTrait(
    traits,
    NECROMANCER_TRAIT_IDS.SOUL_BATTERY,
  );
  const maximumLifeForce = soulBattery ? 120 : 100;
  const maximumHealth = necromancerMaximumHealth(config, traits);
  const lifeForcePoolCapacity =
    maximumHealth * 0.69 * (soulBattery ? 1.2 : 1);
  const configuredLifeForce = Number(config.initialResource ?? 100);
  const lifeForce =
    maximumLifeForce
    * Math.max(0, Math.min(100, configuredLifeForce))
    / 100;
  const initialBlight = Math.max(
    0,
    Math.min(25, Math.trunc(Number(config.initialBlight || 0))),
  );
  const blightExpiries = Array.from({ length: initialBlight }, () => 25);
  return syncNecromancerResources({
    lifeForce,
    resource: lifeForce,
    maximumLifeForce,
    maximumHealth,
    lifeForcePoolCapacity,
    activeShroud: "",
    shroudEnteredAt: 0,
    lastResourceAt: 0,
    nextBlightAt: Number.POSITIVE_INFINITY,
    blight: initialBlight,
    blightExpiries,
    soulShards: 0,
    soulShardExpiries: [],
    carapaceExpiries: [],
    shades: [],
    activeMinions: {},
    minionGenerations: {},
    minionAttackGenerations: {},
    activeSpirits: {},
    spiritGenerations: {},
    spiritInitialUntil: {},
    spiritBusyUntil: {},
    spiritAutoAnchorAt: Number.NaN,
    weaponSpells: {},
    availableFlips: {},
    autoattackChains: {},
    selfConditions: [],
    plagueSendingArmed: false,
    plagueSendingEntrySkillId: null,
    lichEndsAt: 0,
    soulTwistingAvailable: false,
    signetNextLifeForceAt: 3,
    vampirismNextAt: 3,
    cascadingCorruptionStacks: 0,
    meltdownUntil: 0,
    targetChilledUntil: 0,
    targetControlledUntil: 0,
    painfulBondUntil: 0,
    painfulBondPulseAnchorAt: Number.NaN,
    dreadUntil: 0,
    fearOfDeathReadyAt: 0,
    vampiricPresenceReadyAt: 0,
    // Center expected-proc rounding so discrete Barbed Precision applications
    // stay within half a proc of the cumulative expectation instead of always
    // flooring it. Keeping whole applications preserves downstream on-apply
    // behavior for relics and traits.
    barbedPrecisionProgress: 0.5,
    chillingNovaProgress: 0,
    demonicLoreReadyAt: 0,
    spitefulFortitudeLifeForce: 0,
    traitProcReadyAt: {},
  });
}

// The Necromancer resolver starts from a fresh *full* state rather than a minimal
// one. Although the resolver reactions only mutate proc counters, target state,
// and Spiteful Fortitude's resolved life-force gain, the resolver also:
//   - reads shroud/blight/spirits/shades/meltdown off the profession state in
//     attribute-rules.js (e.g. Wicked Corruption scales with `blight`), which
//     must reflect config.initialBlight etc. before the first state event, and
//   - replays `necromancer.state` events that wipe and re-Object.assign the whole
//     state shape (mechanics/handlers.js), preserving only the resolver-owned
//     fields.
// Recreating the full state is the cheapest correct way to guarantee every field
// exists and starts clean; a minimal shape would zero `blight` (and friends)
// before the first state replay and change DPS on builds that seed them.
export function createNecromancerResolverState(
  config: NecromancerConfig = {},
): NecromancerState {
  return createNecromancerState(config);
}

export function snapshotNecromancerState(
  state: NecromancerState,
): NecromancerState {
  return structuredClone(syncNecromancerResources(state));
}

export const NECROMANCER_PUBLIC_END_STATE_KEYS: readonly (
  keyof NecromancerState
)[] = Object.freeze([
  "lifeForce",
  "resource",
  "maximumLifeForce",
  "maximumHealth",
  "lifeForcePoolCapacity",
  "activeShroud",
  "shroudEnteredAt",
  "blight",
  "blightExpiries",
  "soulShards",
  "soulShardExpiries",
  "carapaceExpiries",
  "shades",
  "activeMinions",
  "activeSpirits",
  "availableFlips",
  "autoattackChains",
  "selfConditions",
  "lichEndsAt",
  "soulTwistingAvailable",
  "meltdownUntil",
  "dreadUntil",
]);

export function projectNecromancerEndState({
  schedulerState,
  resolverState,
}: NecromancerEndStateProjectionOptions): Record<string, unknown> {
  const state = snapshotNecromancerState(schedulerState.profession);
  const projected = Object.fromEntries(
    NECROMANCER_PUBLIC_END_STATE_KEYS.map((key) => [
      key,
      structuredClone(state[key]),
    ]),
  ) as Record<string, unknown> & {
    lifeForce: number;
    maximumLifeForce: number;
    resource: number;
  };
  const resolverLifeForce = Math.max(
    0,
    Number(resolverState?.spitefulFortitudeLifeForce || 0),
  );
  projected.lifeForce = Math.min(
    projected.maximumLifeForce,
    projected.lifeForce + resolverLifeForce,
  );
  projected.resource = projected.lifeForce;
  return projected;
}
