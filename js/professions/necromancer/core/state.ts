import { professionStaticRulesApplied } from "../../../platform/gw2/attribute-provenance.js";
import { flattenProfessionState } from "../../../platform/engine/profession.js";
import { NECROMANCER_TRAIT_IDS } from "../data/ids.js";
import type { SkillId } from "../../../platform/engine/types.js";
import type {
  NecromancerConfig,
  NecromancerCoreState,
  NecromancerEndStateProjectionOptions,
  NecromancerState,
} from "../types.js";

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
      ? (configOrTraits as ReadonlySet<string | number>)
      : selectedNecromancerTraits(configOrTraits as NecromancerConfig);
  return traits.has(traitId) || traits.has(String(traitId));
}

function necromancerMaximumHealth(
  config: NecromancerConfig,
  traits: ReadonlySet<string | number>,
): number {
  let vitality = Number(
    config.stats?.vitality ?? config.attributes?.vitality ?? 1000,
  );
  if (!professionStaticRulesApplied(config)) {
    if (hasNecromancerTrait(traits, NECROMANCER_TRAIT_IDS.SPITEFUL_FORTITUDE)) {
      vitality +=
        Number(config.stats?.power ?? config.attributes?.power ?? 1000) * 0.1;
    }
    if (hasNecromancerTrait(traits, NECROMANCER_TRAIT_IDS.VITAL_PERSISTENCE)) {
      vitality += 180;
    }
    if (
      config.specialization === "Harbinger" ||
      hasNecromancerTrait(traits, NECROMANCER_TRAIT_IDS.ALCHEMIC_VIGOR)
    ) {
      vitality += 240;
    }
  }
  return NECROMANCER_BASE_HEALTH + Math.max(0, vitality) * 10;
}

export function normalizedNecromancerLifeForceCost(
  state: Partial<NecromancerCoreState>,
  baseHealthPercent: number,
): number {
  const actualCost =
    (NECROMANCER_BASE_HEALTH * Math.max(0, Number(baseHealthPercent || 0))) /
    100;
  const actualCapacity = Math.max(1, Number(state?.lifeForcePoolCapacity || 1));
  const normalizedCapacity = Math.max(
    1,
    Number(state?.maximumLifeForce || 100),
  );
  return (actualCost * normalizedCapacity) / actualCapacity;
}

export function actualNecromancerLifeForceCost(
  baseHealthPercent: number,
): number {
  return (
    (NECROMANCER_BASE_HEALTH * Math.max(0, Number(baseHealthPercent || 0))) /
    100
  );
}

export function syncNecromancerResources<
  TState extends NecromancerCoreState & {
    blight?: number;
    blightExpiries?: number[];
  },
>(state: TState): TState {
  state.lifeForce = Math.max(
    0,
    Math.min(
      Number(state.maximumLifeForce || 100),
      Number(state.lifeForce || 0),
    ),
  );
  state.resource = state.lifeForce;
  if (Object.hasOwn(state, "blightExpiries")) {
    state.blightExpiries = (state.blightExpiries || [])
      .sort((left, right) => left - right)
      .slice(-25);
    state.blight = state.blightExpiries.length;
  }
  state.soulShardExpiries = (state.soulShardExpiries || [])
    .sort((left, right) => left - right)
    .slice(-6);
  state.soulShards = state.soulShardExpiries.length;
  return state;
}

export function createNecromancerCoreState(
  config: NecromancerConfig = {},
): NecromancerCoreState {
  const traits = selectedNecromancerTraits(config);
  const soulBattery = hasNecromancerTrait(
    traits,
    NECROMANCER_TRAIT_IDS.SOUL_BATTERY,
  );
  const maximumLifeForce = soulBattery ? 120 : 100;
  const maximumHealth = necromancerMaximumHealth(config, traits);
  const lifeForcePoolCapacity = maximumHealth * 0.69 * (soulBattery ? 1.2 : 1);
  const configuredLifeForce = Number(config.initialResource ?? 100);
  const lifeForce =
    (maximumLifeForce * Math.max(0, Math.min(100, configuredLifeForce))) / 100;
  return syncNecromancerResources({
    lifeForce,
    resource: lifeForce,
    maximumLifeForce,
    maximumHealth,
    lifeForcePoolCapacity,
    activeShroud: "",
    shroudEnteredAt: 0,
    lastResourceAt: 0,
    soulShards: 0,
    soulShardExpiries: [],
    carapaceExpiries: [],
    activeMinions: {},
    minionGenerations: {},
    minionAttackGenerations: {},
    minionAttackAnchors: {},
    minionAttackCycleOffsets: {},
    availableFlips: {},
    autoattackChains: {},
    selfConditions: [],
    plagueSendingArmed: false,
    plagueSendingEntrySkillId: null,
    lichEndsAt: 0,
    signetNextLifeForceAt: 3,
    vampirismNextAt: 3,
    targetChilledUntil: 0,
    targetControlledUntil: 0,
    darkFieldUntil: 0,
    dreadUntil: 0,
    fearOfDeathReadyAt: 0,
    vampiricPresenceReadyAt: 0,
    barbedPrecisionProgress: 0.5,
    chillingNovaProgress: 0,
    demonicLoreReadyAt: 0,
    spitefulFortitudeLifeForce: 0,
    traitProcReadyAt: {},
  });
}

export function snapshotNecromancerState(state: unknown): NecromancerState {
  const flattened = flattenProfessionState(
    state,
  ) as unknown as NecromancerState;
  syncNecromancerResources(flattened);
  return structuredClone(flattened) as NecromancerState;
}

export const NECROMANCER_PUBLIC_END_STATE_KEYS: readonly (keyof NecromancerState)[] =
  Object.freeze([
    "lifeForce",
    "resource",
    "maximumLifeForce",
    "maximumHealth",
    "lifeForcePoolCapacity",
    "activeShroud",
    "shroudEnteredAt",
    "blight",
    "blightExpiries",
    "cascadingCorruptionStacks",
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

const NECROMANCER_PUBLIC_INACTIVE_STATE_DEFAULTS: Readonly<
  Partial<NecromancerState>
> = Object.freeze({
  blight: 0,
  blightExpiries: [],
  cascadingCorruptionStacks: 0,
  shades: [],
  activeSpirits: {},
  soulTwistingAvailable: false,
  meltdownUntil: 0,
});

export function projectNecromancerEndState({
  schedulerState,
  resolverState,
}: NecromancerEndStateProjectionOptions): Record<string, unknown> {
  const state = snapshotNecromancerState(schedulerState.profession);
  const projected = Object.fromEntries(
    NECROMANCER_PUBLIC_END_STATE_KEYS.map((key) => [
      key,
      structuredClone(
        state[key] ?? NECROMANCER_PUBLIC_INACTIVE_STATE_DEFAULTS[key],
      ),
    ]),
  ) as Record<string, unknown> & {
    lifeForce: number;
    maximumLifeForce: number;
    resource: number;
  };
  const resolver = flattenProfessionState(resolverState || {});
  const resolverLifeForce = Math.max(
    0,
    Number(resolver.spitefulFortitudeLifeForce || 0),
  );
  projected.lifeForce = Math.min(
    projected.maximumLifeForce,
    projected.lifeForce + resolverLifeForce,
  );
  projected.resource = projected.lifeForce;
  return projected;
}
