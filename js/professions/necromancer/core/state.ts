import { professionStaticRulesApplied } from '../../../platform/gw2/builds/attribute-provenance.js';
import { NECROMANCER_TRAIT_IDS } from '../data/ids.js';
import type { SkillId } from '../../../platform/engine/types.js';
import type { NecromancerConfig, NecromancerCoreState } from '../types.js';

export const NECROMANCER_BASE_HEALTH = 9212;

export function hasNecromancerTrait(traits: ReadonlySet<string | number>, traitId: SkillId): boolean {
  return traits.has(traitId) || traits.has(String(traitId));
}

function necromancerMaximumHealth(config: NecromancerConfig, traits: ReadonlySet<string | number>): number {
  let vitality = Number(config.stats?.vitality ?? config.attributes?.vitality ?? 1000);
  if (!professionStaticRulesApplied(config)) {
    if (hasNecromancerTrait(traits, NECROMANCER_TRAIT_IDS.SPITEFUL_FORTITUDE)) {
      vitality += Number(config.stats?.power ?? config.attributes?.power ?? 1000) * 0.1;
    }

    if (hasNecromancerTrait(traits, NECROMANCER_TRAIT_IDS.VITAL_PERSISTENCE)) {
      vitality += 180;
    }
  }

  return NECROMANCER_BASE_HEALTH + Math.max(0, vitality) * 10;
}

export function normalizedNecromancerLifeForceCost(
  state: Partial<NecromancerCoreState>,
  baseHealthPercent: number
): number {
  const actualCost = (NECROMANCER_BASE_HEALTH * Math.max(0, Number(baseHealthPercent || 0))) / 100;
  const actualCapacity = Math.max(1, Number(state?.lifeForcePoolCapacity || 1));
  const normalizedCapacity = Math.max(1, Number(state?.maximumLifeForce || 100));
  return (actualCost * normalizedCapacity) / actualCapacity;
}

export function actualNecromancerLifeForceCost(baseHealthPercent: number): number {
  return (NECROMANCER_BASE_HEALTH * Math.max(0, Number(baseHealthPercent || 0))) / 100;
}

export function syncNecromancerResources<TState extends NecromancerCoreState>(state: TState): TState {
  state.lifeForce = Math.max(0, Math.min(Number(state.maximumLifeForce || 100), Number(state.lifeForce || 0)));
  state.resource = state.lifeForce;
  state.soulShardExpiries = (state.soulShardExpiries || []).sort((left, right) => left - right).slice(-6);
  state.soulShards = state.soulShardExpiries.length;
  return state;
}

export function createNecromancerCoreState(config: NecromancerConfig = {}): NecromancerCoreState {
  // Normalize canonical selected IDs once for all initial state calculations.
  const traits = new Set(
    (config.selectedTraitIds || []).map((value) => (Number.isFinite(Number(value)) ? Number(value) : value))
  );
  const soulBattery = hasNecromancerTrait(traits, NECROMANCER_TRAIT_IDS.SOUL_BATTERY);
  const maximumLifeForce = soulBattery ? 120 : 100;
  const maximumHealth = necromancerMaximumHealth(config, traits);
  const lifeForcePoolCapacity = maximumHealth * 0.69 * (soulBattery ? 1.2 : 1);
  const configuredLifeForce = Number(config.initialResource ?? 100);
  const lifeForce = (maximumLifeForce * Math.max(0, Math.min(100, configuredLifeForce))) / 100;
  return syncNecromancerResources({
    lifeForce,
    resource: lifeForce,
    maximumLifeForce,
    maximumHealth,
    lifeForcePoolCapacity,
    activeShroud: '',
    activeShroudEntryId: null,
    activeShroudExitId: null,
    activeShroudProfileId: '',
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
    dreadUntil: 0,
    fearOfDeathReadyAt: 0,
    vampiricPresenceReadyAt: 0,
    barbedPrecisionProgress: 0.5,
    spitefulFortitudeLifeForce: 0,
    traitProcReadyAt: {},
    tasteForBloodBuffs: {}
  });
}
