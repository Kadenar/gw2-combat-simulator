import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { mesmerMechanicsFor } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

/** Focus recharge reduction applies through the shared cooldown controller, including Alacrity. */
export const wardensFeedback = defineTrait({
  id: TRAIT.WARDENS_FEEDBACK,
  name: "Warden's Feedback",
  balance: { rechargeMultiplier: 0.8 },
  rechargeRules: [
    {
      when: (_runtime, skill) => skill.weapon === 'Focus',
      multiplier: { profile: TRAIT.WARDENS_FEEDBACK, field: 'rechargeMultiplier' }
    }
  ]
});

/** Committed combat heals use the shared resource owner to create a clone, stock a blade, or grant a note. */
export const egoRestoration = defineTrait({
  id: TRAIT.EGO_RESTORATION,
  name: 'Ego Restoration',
  hooks: {
    onCastCommit(runtime, cast) {
      if (!hasTrait(runtime, TRAIT.EGO_RESTORATION) || !runtime.combatStartedAt() || cast.skill.type !== 'Heal') return;
      const mechanics = mesmerMechanicsFor(runtime);
      mechanics.resources.gainResources(runtime.time, 1, mechanics.activePrimaryWeapon(), cast.skill.name, {
        kind: 'trait',
        sourceSkillId: cast.skill.id,
        traitId: TRAIT.EGO_RESTORATION,
        traitName: 'Ego Restoration'
      });
    }
  }
});

export const mesmerInspirationTraits = [wardensFeedback, egoRestoration];
