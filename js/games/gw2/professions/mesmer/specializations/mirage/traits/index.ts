import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { illusionSource, timedStacks } from '#gw2/professions/mesmer/core/mechanics/modifier-queries.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

/** Nomad's Endurance owns tuning consumed at the ordered cloak, ambush, or shatter boundary. */
export const nomadsEndurance = defineTrait<MesmerSkill>({
  id: TRAIT.NOMADS_ENDURANCE,
  name: "Nomad's Endurance",
  balance: {
    effects: [{ name: 'vigor', type: 'boon', boon: 'vigor', duration: 3, stacks: 1 }]
  },
  modifierRules: [
    {
      id: 'mesmer.nomads-endurance',
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      parameters: {
        strikeBonus: 0.1,
        conditionBonus: 0.05
      },
      amount: (context, target, parameters) => {
        // Illusion strikes do not inherit personal strike bonuses, while their conditions remain owner-resolved.
        if (target === MODIFIER_TARGET.STRIKE_DAMAGE && illusionSource(context)) return 0;
        return target === MODIFIER_TARGET.STRIKE_DAMAGE ? parameters.strikeBonus : parameters.conditionBonus;
      },
      when: (context) => Boolean(context.timeline?.vigorActiveAt(context.time))
    }
  ]
});

/** Renewing Oasis owns tuning consumed at the ordered cloak, ambush, or shatter boundary. */
export const renewingOasis = defineTrait<MesmerSkill>({
  id: TRAIT.RENEWING_OASIS,
  name: 'Renewing Oasis',
  balance: {
    effects: [{ name: 'regeneration', type: 'boon', boon: 'regeneration', duration: 4, stacks: 1 }]
  }
});

/** Riddle of Sand owns tuning consumed at the ordered cloak, ambush, or shatter boundary. */
export const riddleOfSand = defineTrait<MesmerSkill>({
  id: TRAIT.RIDDLE_OF_SAND,
  name: 'Riddle of Sand',
  balance: {
    effects: [{ name: 'Confusion', type: 'condition', condition: 'Confusion', duration: 4, stacks: 2 }]
  }
});

/** Desert Distortion owns tuning consumed at the ordered cloak, ambush, or shatter boundary. */
export const desertDistortion = defineTrait<MesmerSkill>({
  id: TRAIT.DESERT_DISTORTION,
  name: 'Desert Distortion',
  balance: {
    resourceGain: 1
  }
});

/** Mirage Mantle owns tuning consumed at the ordered cloak, ambush, or shatter boundary. */
export const mirageMantle = defineTrait<MesmerSkill>({
  id: TRAIT.MIRAGE_MANTLE,
  name: 'Mirage Mantle',
  balance: {
    effects: [{ name: 'alacrity', type: 'boon', boon: 'alacrity', duration: 4, stacks: 1 }]
  }
});

/** Phantom Pain owns tuning consumed at the ordered cloak, ambush, or shatter boundary. */
export const phantomPain = defineTrait<MesmerSkill>({
  id: TRAIT.PHANTOM_PAIN,
  name: 'Phantom Pain',
  balance: {
    maximumStacks: 4,
    durationMultiplier: 10
  },
  modifierRules: [
    {
      id: 'mesmer.phantom-pain',
      requiresSelection: false,
      target: [MODIFIER_TARGET.STRIKE_DAMAGE, MODIFIER_TARGET.CONDITION_DAMAGE],
      operation: 'damage-additive',
      parameters: {
        duration: 10,
        maximumStacks: 4,
        strikePerStack: 0.0625,
        conditionPerStack: 0.05
      },
      amount: (context, target, parameters) => {
        // Phantom Pain joins other additive outgoing-damage bonuses; phantasm
        // conditions use owner modifiers, but phantasm strikes use summon ownership.
        if (target === MODIFIER_TARGET.STRIKE_DAMAGE && illusionSource(context)) return 0;
        return (
          timedStacks(context, 'phantom-pain', parameters.duration, parameters.maximumStacks) *
          (target === MODIFIER_TARGET.CONDITION_DAMAGE ? parameters.conditionPerStack : parameters.strikePerStack)
        );
      }
    }
  ]
});

/** Dune Cloak owns tuning consumed at the ordered cloak, ambush, or shatter boundary. */
export const duneCloak = defineTrait<MesmerSkill>({
  id: TRAIT.DUNE_CLOAK,
  name: 'Dune Cloak',
  balance: {
    threshold: 3,
    rechargeReduction: 1,
    durationMultiplier: 1
  }
});

/** Clone ambush execution stays mechanical; its selection, lifetime, and gain reactions belong here. */
export const infiniteHorizon = defineTrait<MesmerSkill>({ id: TRAIT.INFINITE_HORIZON, name: 'Infinite Horizon' });

/** Self-Deception owns tuning consumed at the ordered cloak, ambush, or shatter boundary. */
export const selfDeception = defineTrait<MesmerSkill>({
  id: TRAIT.SELF_DECEPTION,
  name: 'Self-Deception',
  balance: {
    resourceGain: 1
  }
});

/** Collect Mirage traits while retaining shared cloak, mirror, endurance, and ambush state. */
export const mirageTraits = [
  nomadsEndurance,
  selfDeception,
  renewingOasis,
  riddleOfSand,
  desertDistortion,
  mirageMantle,
  phantomPain,
  duneCloak,
  infiniteHorizon
];
