import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { eventSkill, targetConditionActive } from '#gw2/platform/combat/query/runtime-query.js';
import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { warriorBoonActive } from '#gw2/professions/warrior/core/traits/modifier-queries.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';

/** Owns this trait's tuning and selected contributions. */
export const mercilessHammer = defineTrait({
  id: TRAIT.MERCILESS_HAMMER,
  name: 'Merciless Hammer',
  balance: {
    resourceGain: 7
  },
  modifierRules: [
    {
      id: 'warrior.merciless-hammer',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.25,
      order: 94,
      when: (context) =>
        ['Hammer', 'Mace'].includes(
          String(context.event?.skillWeapon || eventSkill(context)?.skillWeapon || eventSkill(context)?.weapon || '')
        ) && Boolean(context.config?.target?.defiant)
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const stalwartStrength = defineTrait({
  id: TRAIT.STALWART_STRENGTH,
  name: 'Stalwart Strength',
  balance: {
    internalCooldown: 0.32,
    effects: [{ name: 'stability', type: 'boon', boon: 'stability', stacks: 1, duration: 5 }]
  },
  modifierRules: [
    {
      id: 'warrior.stalwart-strength',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      order: 95,
      when: (context) => warriorBoonActive(context, 'stability')
    }
  ],
  triggers: [
    {
      order: 0,

      on: 'control.resolved',
      when: (_runtime, event) => event.actorType === 'player',
      emit: TRAIT.STALWART_STRENGTH,
      icd: 'profile',
      attribution: { priority: 5 }
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const cullTheWeak = defineTrait({
  id: TRAIT.CULL_THE_WEAK,
  name: 'Cull the Weak',
  balance: {
    internalCooldown: 5,
    effects: [{ name: 'Weakness', type: 'condition', condition: 'Weakness', duration: 3.5, stacks: 1 }]
  },
  modifierRules: [
    {
      id: 'warrior.cull-the-weak',
      target: MODIFIER_TARGET.STRIKE_DAMAGE,
      operation: 'multiply',
      factor: 1.1,
      order: 93,
      when: (context) => targetConditionActive(context, 'Weakness')
    }
  ]
});

/** Owns this trait's tuning and selected contributions. */
export const thickSkin = defineTrait({
  id: TRAIT.THICK_SKIN,
  name: 'Thick Skin',
  balance: {
    effects: [{ name: 'protection', type: 'boon', boon: 'protection', stacks: 1, duration: 3 }]
  },
  triggers: [
    {
      order: 6,

      on: 'castStart',
      when: (_runtime, cast) => cast.skill.type === 'Heal',
      emit: TRAIT.THICK_SKIN,
      attribution: { name: 'Thick Skin', priority: 0 }
    }
  ]
});
