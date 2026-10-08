import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type {
  NecromancerResolverEvent,
  NecromancerRuntime,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** Own Soul Reaping resource rewards and passive readiness while shared mechanics retain pool accounting. */

/** The first accepted player strike of a mark contributes to the shared percentage grant. */
export function soulMarksLifeForce(
  runtime: NecromancerRuntime,
  skill: NecromancerSkill,
  event: NecromancerResolverEvent
): number {
  return Number(event.hitIndex ?? 1) === 1 && skill.categories?.includes('Mark') && hasTrait(runtime, TRAIT.SOUL_MARKS)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.SOUL_MARKS), 'lifeForceGain')
    : 0;
}

/** Accepted non-summon fear grants life force under one cooldown; missed and travelling packets grant nothing. */
export function applyFearOfDeath(runtime: NecromancerRuntime, event: NecromancerResolverEvent): void {
  if (
    event.condition !== 'Fear' ||
    event.actorType === 'summon' ||
    !hasTrait(runtime, TRAIT.FEAR_OF_DEATH) ||
    !runtime.procs.claim(TRAIT.FEAR_OF_DEATH, 'necromancer.core.fearOfDeath', runtime.time)
  )
    return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.FEAR_OF_DEATH);
  grantNecromancerLifeForce(runtime, balanceProfileNumber(profile, 'lifeForceGain'));
}

/** A granted Eternal Life pulse samples the live shroud and caps its gain at the trait threshold. */
export function applyEternalLifePulse(runtime: NecromancerRuntime): void {
  const state = runtime.profession.core;
  if (state.activeShroud) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.ETERNAL_LIFE);
  const missing = Math.max(
    0,
    state.lifeForce.maximum * balanceProfileNumber(profile, 'threshold') - state.lifeForce.value
  );
  runtime.resourceController.grant(
    'lifeForce',
    Math.min(missing, (state.lifeForce.maximum * balanceProfileNumber(profile, 'lifeForceGain')) / 100)
  );
}

/** Initialization selects the trait producer; already-scheduled pulses keep their original lifetime. */
export function eternalLifePassive(runtime: NecromancerRuntime) {
  return ['eternal-life', hasTrait(runtime, TRAIT.ETERNAL_LIFE), TRAIT.ETERNAL_LIFE] as const;
}

/** Readiness advertises only the actual next pulse when its threshold can cover the cost. */
export function eternalLifeReadyAt(runtime: NecromancerRuntime, cost: number): number {
  const state = runtime.profession.core;
  const eternal = state.passiveNextAt['eternal-life'];
  const threshold =
    eternal == null
      ? 0
      : state.lifeForce.maximum *
        balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.ETERNAL_LIFE), 'threshold');
  return !state.activeShroud && cost <= threshold ? (eternal ?? Infinity) : Infinity;
}
