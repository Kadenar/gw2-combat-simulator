import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { Gw2Stats } from '#gw2/platform/combat/types.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { Gw2Runtime, RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { grantWarriorAdrenaline } from '#gw2/professions/warrior/core/mechanics/adrenaline.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { gainMotivation } from '#gw2/professions/warrior/specializations/paragon/mechanics/refrains.js';
import type { WarriorRuntimeState } from '#gw2/professions/warrior/types.js';

type Runtime = Gw2Runtime<WarriorRuntimeState>;

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

/** Swaps reward resources only after committed bursts consume pending echoes. */
export function applyInspiringImplements(runtime: Runtime, cast: RuntimeCast): void {
  if (
    cast.skill.inputCategory === 'weapon-swap' &&
    hasTrait(runtime, TRAIT.INSPIRING_IMPLEMENTS) &&
    runtime.procs.claim(TRAIT.INSPIRING_IMPLEMENTS, 'warrior.paragon.inspiringImplements', runtime.time)
  ) {
    const profile = requireBalanceProfileFromContext(runtime, TRAIT.INSPIRING_IMPLEMENTS);
    grantWarriorAdrenaline(runtime, balanceProfileNumber(profile, 'resourceGain'));
    gainMotivation(runtime, balanceProfileNumber(profile, 'minimumStacks'));
  }
}

/** Chant entry reduces the other chants only after opening packets and refrain scheduling. */
export function applyFeverishPulse(runtime: Runtime, cast: RuntimeCast): void {
  if (!hasTrait(runtime, TRAIT.FEVERISH_PULSE)) return;
  const feverish = requireBalanceProfileFromContext(runtime, TRAIT.FEVERISH_PULSE);
  for (const id of CHANTS) {
    const skill = runtime.helpers.skillsById.get(id);
    if (skill && id !== cast.skill.id)
      runtime.cooldownController.reduceSkillRecharge(
        skill,
        balanceProfileNumber(feverish, 'rechargeReduction'),
        runtime.time
      );
  }
}

const CHANTS = [ID.CHANT_OF_ACTION, ID.CHANT_OF_RECUPERATION, ID.CHANT_OF_FREEDOM];

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

/** Only Motivation actually spent earns adrenaline. */
export function applyInvigoratingTempo(runtime: Runtime, spent: number): void {
  if (hasTrait(runtime, TRAIT.INVIGORATING_TEMPO))
    grantWarriorAdrenaline(
      runtime,
      spent * balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.INVIGORATING_TEMPO), 'resourceGain')
    );
}

/** Echo counts are fixed at command admission and survive later trait changes. */
export function reverberationEchoCount(runtime: Runtime): number {
  return hasTrait(runtime, TRAIT.REVERBERATION)
    ? balanceProfileNumber(requireBalanceProfileFromContext(runtime, TRAIT.REVERBERATION), 'maximumStacks')
    : 1;
}
