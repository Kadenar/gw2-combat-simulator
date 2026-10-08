import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { requireBalanceProfileFromContext, requireEffect } from '#gw2/platform/skills/balance-profiles.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

/** Owns Cloaked in Shadow tuning and behavior at the existing execution boundaries. */
export const cloakedInShadow = defineTrait({
  id: TRAIT.CLOAKED_IN_SHADOW,
  name: 'Cloaked in Shadow',
  balance: {
    effects: [
      {
        type: 'strike',
        name: 'Cloaked in Shadow',
        // Keep the siphon's flat Power formula and breakdown separate from the triggering skill.
        coefficient: 0,
        flatStrikeBase: 130,
        flatStrikePowerCoeff: 0.04,
        damageBreakdownName: 'Life Siphon - Cloaked in Shadow',
        hits: 1,
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  },
  triggers: [
    {
      emit: TRAIT.CLOAKED_IN_SHADOW,
      on: 'condition.applied',
      when: (_runtime, event) => event.condition === 'Blindness',
      effects: (effect) => effect.type === 'strike' && effect.name === 'Cloaked in Shadow',
      attribution: (_runtime, event) => ({
        skillId: TRAIT.CLOAKED_IN_SHADOW,
        skillName: 'Cloaked in Shadow',
        triggeredBy: event.skillName
      })
    }
  ]
});

/** Owns Hidden Thief tuning and behavior at the existing execution boundaries. */
export const hiddenThief = defineTrait({
  id: TRAIT.HIDDEN_THIEF,
  name: 'Hidden Thief',
  balance: {
    internalCooldown: 2,
    effects: [
      { type: 'condition', name: 'Blindness', condition: 'Blindness', stacks: 1, duration: 3 },
      { type: 'condition', name: 'Weakness', condition: 'Weakness', stacks: 1, duration: 3 }
    ]
  }
});

/** Owns Leeching Venoms tuning and behavior at the existing execution boundaries. */
export const leechingVenoms = defineTrait({
  id: TRAIT.LEECHING_VENOMS,
  name: 'Leeching Venoms',
  balance: {
    maximumStacks: 6,
    resourceGain: 3,
    durationMultiplier: 24,
    // Leeching Venoms owns a flat life-steal formula, independent of weapon damage.
    effects: [{ type: 'strike', name: 'Leeching Venoms', flatStrikeBase: 320, flatStrikePowerCoeff: 0.033, hits: 1 }]
  }
});

/** Owns Shadow Siphoning tuning and behavior at the existing execution boundaries. */
export const shadowSiphoning = defineTrait({
  id: TRAIT.SHADOW_SIPHONING,
  name: 'Shadow Siphoning',
  balance: {
    internalCooldown: 1,
    effects: [
      {
        type: 'strike',
        name: 'Shadow Siphoning',
        // Keep the siphon's flat Power formula and breakdown separate from the stealth attack.
        coefficient: 0,
        flatStrikeBase: 412,
        flatStrikePowerCoeff: 0.1,
        damageBreakdownName: 'Life Siphon - Shadow Siphoning',
        hits: 1,
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  },
  triggers: [
    {
      emit: TRAIT.SHADOW_SIPHONING,
      on: 'damage.resolved',
      icd: 'profile',
      when: (runtime, event) =>
        event.actorType === 'player' &&
        Number(event.coefficient) > 0 &&
        Boolean(runtime.helpers.skillsById.get(event.skillId!)?.stealthAttack) &&
        Boolean(
          requireEffect(requireBalanceProfileFromContext(runtime, TRAIT.SHADOW_SIPHONING), 'strike', 'Shadow Siphoning')
        ),
      effects: (effect) => effect.type === 'strike' && effect.name === 'Shadow Siphoning',
      attribution: (_runtime, event) => ({
        skillId: TRAIT.SHADOW_SIPHONING,
        skillName: 'Shadow Siphoning',
        triggeredBy: event.skillName
      })
    }
  ]
});

/** Owns Shadow's Rejuvenation tuning and behavior at the existing execution boundaries. */
export const shadowsRejuvenation = defineTrait({
  id: TRAIT.SHADOWS_REJUVENATION,
  name: "Shadow's Rejuvenation",
  balance: { resourceGain: 1 }
});
