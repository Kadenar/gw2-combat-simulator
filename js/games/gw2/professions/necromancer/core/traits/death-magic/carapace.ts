import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import {
  cloneNecromancerAttributes,
  necromancerRuntimeCoreState
} from '#gw2/professions/necromancer/core/mechanics/modifier-queries.js';
import { addCarapace } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** Completed heals grant Carapace and Protection together under one Dark Defense cooldown. */
export function applyDarkDefense(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
  if (cast.skill.type !== 'Heal' || !hasTrait(runtime, TRAIT.DARK_DEFENSE)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.DARK_DEFENSE);
  if (!runtime.procs.claimCooldown('darkDefense', runtime.time, balanceProfileNumber(profile, 'internalCooldown')))
    return;
  addCarapace(
    runtime.profession.core,
    balanceProfileNumber(profile, 'resourceGain'),
    runtime.time,
    balanceProfileNumber(profile, 'duration')
  );
  const boon = requireEffect(profile, 'boon', 'protection');
  if (!boon) return;
  const event = {
    type: 'buff' as const,
    at: runtime.time,
    source: 'Trait',
    sourceId: TRAIT.DARK_DEFENSE,
    actorType: 'effect' as const,
    activationId: cast.id,
    triggeredBy: cast.skill.name,
    offTarget: cast.command.offTarget,
    skillName: profile.name,
    kind: String(boon.boon),
    stacks: effectNumber(profile, boon, 'stacks'),
    duration: effectNumber(profile, boon, 'duration')
  };
  runtime.effects.emit({ kind: 'packet', event: event, durationContext: event });
}

export function applyCorruptorsFervor(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.actorType === 'summon' || !hasTrait(context, TRAIT.CORRUPTERS_FERVOR)) return;
  addCarapace(
    professionCoreState(context),
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CORRUPTERS_FERVOR), 'resourceGain'),
    event.at,
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CORRUPTERS_FERVOR), 'duration')
  );
}

/** Applies Deadly Strength at the original attribute-conversion position. */
export function modifyDeadlyStrengthAttributes(
  context: Gw2ModifierContext,
  result: ReturnType<typeof cloneNecromancerAttributes>
): void {
  // Attribute reads count live stacks without rebuilding or mutating the runtime pool.
  const timedCarapace = activeStackCount(necromancerRuntimeCoreState(context).carapaceExpiries || [], context.time);
  const minionCarapace = hasTrait(context, TRAIT.FLESH_OF_THE_MASTER)
    ? Object.values(necromancerRuntimeCoreState(context).activeMinions || {}).reduce(
        (total: number, count: number) =>
          total +
          (count || 0) *
            balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FLESH_OF_THE_MASTER), 'resourceGain'),
        0
      )
    : 0;
  const carapace = Math.min(
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.FLESH_OF_THE_MASTER), 'maximumStacks'),
    timedCarapace + minionCarapace
  );

  if (hasTrait(context, TRAIT.DEADLY_STRENGTH) && carapace > 0) {
    const deadlyStrengthProfile = requireBalanceProfileFromContext(context, TRAIT.DEADLY_STRENGTH);
    const perStack = balanceProfileNumber(deadlyStrengthProfile, 'attributePerStack');
    result.power += carapace * perStack;
    result.conditionDamage += carapace * perStack;
  }
}

/** Applies soul comprehension before shroud entry mutates the form. */
export function prepareSoulComprehension(runtime: NecromancerRuntime): void {
  const state = runtime.profession.core;
  if (hasTrait(runtime, TRAIT.SOUL_COMPREHENSION)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.SOUL_COMPREHENSION);
    const minionStacks = hasTrait(runtime, TRAIT.FLESH_OF_THE_MASTER)
      ? Object.values(state.activeMinions).reduce((sum, count) => sum + count * 2, 0)
      : 0;
    grantNecromancerLifeForce(
      runtime,
      Math.min(
        balanceProfileNumber(profile, 'maximumStacks'),
        activeStackCount(state.carapaceExpiries, runtime.time) + minionStacks
      ) * balanceProfileNumber(profile, 'lifeForcePerStack')
    );
  }
}

/** Applies armored shroud before shroud entry mutates the form. */
export function prepareArmoredShroud(runtime: NecromancerRuntime): void {
  const state = runtime.profession.core;
  if (hasTrait(runtime, TRAIT.ARMORED_SHROUD)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.ARMORED_SHROUD);
    addCarapace(
      state,
      balanceProfileNumber(profile, 'resourceGain'),
      runtime.time,
      balanceProfileNumber(profile, 'duration')
    );
  }
}

/** Applies shrouded removal before shroud entry mutates the form. */
export function prepareShroudedRemoval(runtime: NecromancerRuntime): void {
  const state = runtime.profession.core;
  if (hasTrait(runtime, TRAIT.SHROUDED_REMOVAL)) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.SHROUDED_REMOVAL);
    const removed = state.selfConditions.splice(0, balanceProfileNumber(profile, 'maximumConditions'));
    if (removed.length)
      addCarapace(
        state,
        removed.length * balanceProfileNumber(profile, 'resourceGain'),
        runtime.time,
        balanceProfileNumber(profile, 'duration')
      );
  }
}

/** Minion-owned strikes sample Necromantic Corruption before applying other creature multipliers. */
export function necromanticCorruptionMultiplier(runtime: NecromancerRuntime): number {
  return hasTrait(runtime, TRAIT.NECROMANTIC_CORRUPTION)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.NECROMANTIC_CORRUPTION), 'damageMultiplier')
    : 1;
}
