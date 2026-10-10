import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2Stats } from '#gw2/platform/combat/stats.js';
import type { MechanicContext } from '#gw2/platform/profession-definition/mechanic-context.js';
import { balanceProfileNumber, requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

type Runtime = MechanicContext<WarriorRuntimeState, WarriorSkill>;

export function modifyParagonAttributes(context: Gw2ModifierContext, attributes: Gw2Stats): Gw2Stats {
  // Skip when attributes have already been pre-computed in the static pass to
  // prevent the concentration bonus from being applied twice.
  if (!hasTrait(context, TRAIT.INSPIRING_IMPLEMENTS) || professionStaticRulesApplied(context.config)) {
    return attributes;
  }

  const inspiringImplementsProfile = requireBalanceProfileFromContext(context, TRAIT.INSPIRING_IMPLEMENTS);
  return {
    ...attributes,
    concentration: (attributes.concentration || 0) + balanceProfileNumber(inspiringImplementsProfile, 'attributeBonus')
  };
}

/** Enduring Refrain scales Might only; other packets retain their original stacks. */
export function enduringRefrainMultiplier(runtime: Runtime): number {
  return hasTrait(runtime, TRAIT.ENDURING_REFRAIN)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.ENDURING_REFRAIN), 'stackMultiplier')
    : 1;
}

/** Chant entry adds the selected trait's Motivation before opening boons. */
export function enduringRefrainMotivation(runtime: Runtime): number {
  return hasTrait(runtime, TRAIT.ENDURING_REFRAIN)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.ENDURING_REFRAIN), 'resourceGain')
    : 0;
}

/** Echo counts are fixed at command admission and survive later trait changes. */
export function reverberationEchoCount(runtime: Runtime): number {
  return hasTrait(runtime, TRAIT.REVERBERATION)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.REVERBERATION), 'maximumStacks')
    : 1;
}
