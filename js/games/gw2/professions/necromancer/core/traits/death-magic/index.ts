import { onTriggerPoint } from '#gw2/platform/profession-definition/trigger-rules.js';
import { emitTraitProfile } from '#gw2/platform/profession-definition/trait-emission.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import type { TriggerPointInput } from '#gw2/platform/profession-definition/trigger-points.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { necromancerConditionApplied } from '#gw2/professions/necromancer/core/mechanics/combat-boundaries.js';
import { shroudEntering } from '#gw2/professions/necromancer/core/mechanics/forms.js';
import { grantNecromancerLifeForce } from '#gw2/professions/necromancer/core/mechanics/life-force.js';
import { addCarapace } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime,
  NecromancerSkill
} from '#gw2/professions/necromancer/types.js';

/** Owns Necromantic Corruption tuning and behavior at its existing execution boundaries. */
export const necromanticCorruption = defineTrait({
  id: TRAIT.NECROMANTIC_CORRUPTION,
  name: 'Necromantic Corruption',
  balance: { damageMultiplier: 1.25 },
  modifierRules: [
    {
      order: 109,
      id: 'necromancer.necromantic-corruption',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: (context) =>
        balanceProfileNumber(
          requireBalanceProfileFromContext(context, TRAIT.NECROMANTIC_CORRUPTION),
          'damageMultiplier'
        ),
      when: (context) => context.event?.summonKind === 'minion'
    }
  ]
});

/** Owns Flesh of the Master tuning and behavior at its existing execution boundaries. */
export const fleshOfTheMaster = defineTrait({
  id: TRAIT.FLESH_OF_THE_MASTER,
  name: 'Flesh of the Master',
  balance: {
    resourceGain: 2,
    maximumStacks: 30
  }
});

/** Owns Deadly Strength tuning and behavior at its existing execution boundaries. */
export const deadlyStrength = defineTrait({
  id: TRAIT.DEADLY_STRENGTH,
  name: 'Deadly Strength',
  balance: { attributePerStack: 10 }
});

/** Owns Corrupter's Fervor tuning and behavior at its existing execution boundaries. */
export const corruptersFervor = defineTrait({
  triggers: [
    onTriggerPoint(necromancerConditionApplied, {
      run: (runtime: NecromancerRuntime, input: TriggerPointInput<typeof necromancerConditionApplied>) =>
        applyCorruptorsFervor(runtime, input.event)
    })
  ],
  id: TRAIT.CORRUPTERS_FERVOR,
  name: "Corrupter's Fervor",
  balance: { resourceGain: 1, duration: 10 }
});

/** Owns Dark Defense tuning and behavior at its existing execution boundaries. */
export const darkDefense = defineTrait({
  id: TRAIT.DARK_DEFENSE,
  name: 'Dark Defense',
  balance: {
    resourceGain: 10,
    duration: 10,
    internalCooldown: 5,
    effects: [{ name: 'protection', type: 'boon', boon: 'protection', stacks: 1, duration: 3 }]
  },
  triggers: [{ on: 'castCommit', run: applyDarkDefense }]
});

/** Owns Shrouded Removal tuning and behavior at its existing execution boundaries. */
export const shroudedRemoval = defineTrait({
  triggers: [onTriggerPoint(shroudEntering, { run: prepareShroudedRemoval })],
  id: TRAIT.SHROUDED_REMOVAL,
  name: 'Shrouded Removal',
  balance: { maximumConditions: 1, resourceGain: 3, duration: 10 }
});

/** Owns Soul Comprehension tuning and behavior at its existing execution boundaries. */
export const soulComprehension = defineTrait({
  triggers: [onTriggerPoint(shroudEntering, { run: prepareSoulComprehension })],
  id: TRAIT.SOUL_COMPREHENSION,
  name: 'Soul Comprehension',
  balance: { lifeForcePerStack: 0.5, maximumStacks: 30 }
});

/** Owns Armored Shroud tuning and behavior at its existing execution boundaries. */
export const armoredShroud = defineTrait({
  triggers: [onTriggerPoint(shroudEntering, { run: prepareArmoredShroud })],
  id: TRAIT.ARMORED_SHROUD,
  name: 'Armored Shroud',
  balance: { resourceGain: 5, duration: 10 }
});

/** Owns Putrid Defense tuning and behavior at its existing execution boundaries. */
export const putridDefense = defineTrait({
  id: TRAIT.PUTRID_DEFENSE,
  name: 'Putrid Defense',
  modifierRules: [
    {
      order: 110,
      id: 'necromancer.putrid-defense',
      target: MODIFIER_TARGET.CONDITION_DAMAGE,
      operation: 'multiply',
      factor: 1.15,
      when: (context) => context.condition === 'Poisoned'
    }
  ]
});

/** Compiled heal admission grants Carapace and independent Protection under one Dark Defense cooldown. */
function applyDarkDefense(runtime: NecromancerRuntime, cast: RuntimeCast<NecromancerSkill>): void {
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
  // Carapace has already been granted; removal affects only this ordinary Protection payload.
  emitTraitProfile(runtime, TRAIT.DARK_DEFENSE, TRAIT.DARK_DEFENSE, undefined, {
    at: runtime.time,
    effect: { type: 'boon', name: 'protection' },
    activationId: cast.id,
    attribution: { skillName: profile.name, triggeredBy: cast.skill.name, offTarget: cast.command.offTarget }
  });
}

function applyCorruptorsFervor(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.actorType === 'summon') return;
  addCarapace(
    professionCoreState(context),
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CORRUPTERS_FERVOR), 'resourceGain'),
    event.at,
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CORRUPTERS_FERVOR), 'duration')
  );
}

/** Applies soul comprehension before shroud entry mutates the form. */
function prepareSoulComprehension(runtime: NecromancerRuntime): void {
  const state = runtime.profession.core;
  {
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
function prepareArmoredShroud(runtime: NecromancerRuntime): void {
  const state = runtime.profession.core;
  {
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
function prepareShroudedRemoval(runtime: NecromancerRuntime): void {
  const state = runtime.profession.core;
  {
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
