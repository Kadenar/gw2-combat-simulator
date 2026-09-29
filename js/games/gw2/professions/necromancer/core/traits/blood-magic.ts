import { defineTrait } from '#gw2/platform/profession-definition/traits.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { applyOverflowingThirstCast } from '#gw2/professions/necromancer/core/traits/life-steal.js';

/** Owns Vampiric tuning and behavior at its existing execution boundaries. */
export const vampiric = defineTrait({
  id: TRAIT.VAMPIRIC,
  name: 'Vampiric',
  balance: {
    effects: [
      {
        name: 'player',
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 38,
        flatStrikePowerCoeff: 0.003,
        actorType: 'effect',
        packetLabel: 'player',
        canCrit: false,
        damageKind: 'life-steal'
      },
      {
        name: 'minion',
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 50,
        flatStrikePowerCoeff: 0.0213,
        actorType: 'effect',
        packetLabel: 'minion',
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  }
});

/** Owns Vampiric Presence tuning and behavior at its existing execution boundaries. */
export const vampiricPresence = defineTrait({
  id: TRAIT.VAMPIRIC_PRESENCE,
  name: 'Vampiric Presence',
  balance: {
    cooldown: 0.5,
    effects: [
      {
        name: 'base',
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 65,
        flatStrikePowerCoeff: 0.0333,
        actorType: 'effect',
        packetLabel: 'base',
        canCrit: false,
        damageKind: 'life-steal'
      },
      {
        name: 'shroud',
        type: 'strike',
        coefficient: 0,
        hits: 1,
        flatStrikeBase: 129,
        flatStrikePowerCoeff: 0.0666,
        actorType: 'effect',
        packetLabel: 'shroud',
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  }
});

/** Owns Overflowing Thirst tuning and behavior at its existing execution boundaries. */
export const overflowingThirst = defineTrait({
  id: TRAIT.OVERFLOWING_THIRST,
  name: 'Overflowing Thirst',
  balance: {
    effects: [
      {
        name: 'taste-for-blood',
        type: 'buff',
        kind: 'taste-for-blood',
        stacks: 3,
        duration: 10,
        actorType: 'player'
      },
      {
        name: 'Strike',
        type: 'strike',
        coefficient: 0,
        flatStrikeBase: 375,
        flatStrikePowerCoeff: 0.05,
        hits: 1,
        actorType: 'effect',
        canCrit: false,
        damageKind: 'life-steal'
      }
    ]
  },
  hooks: { onCastStart: applyOverflowingThirstCast }
});

/** Owns Transfusion tuning and behavior at its existing execution boundaries. */
export const transfusion = defineTrait({
  id: TRAIT.TRANSFUSION,
  name: 'Transfusion',
  balance: {
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 1.8, hits: 1 },
      { name: 'Poisoned', type: 'condition', condition: 'Poisoned', stacks: 2, duration: 4 },
      { name: 'Chilled', type: 'condition', condition: 'Chilled', stacks: 1, duration: 2 }
    ]
  },
  triggers: [
    ...(['Strike', 'Poisoned', 'Chilled'] as const).map<
      Extract<
        NonNullable<import('#gw2/platform/profession-definition/traits.js').TraitDefinition['triggers']>[number],
        { on: 'castCommit' }
      >
    >((name) => ({
      order: 2,
      on: 'castCommit' as const,
      when: (_runtime, cast) => cast.skill.shroudSlot === 4,
      emit: TRAIT.TRANSFUSION,
      effects: (effect) => effect.type === (name === 'Strike' ? 'strike' : 'condition') && effect.name === name,
      attribution: (runtime, cast) => ({
        skillId: ID.LESSER_CHILBLAINS,
        skillName: 'Lesser Chilblains',
        name: name === 'Strike' ? 'Lesser Chilblains' : `Lesser Chilblains — ${name}`,
        parentSkillName: cast.skill.name,
        icon: runtime.helpers.skillsById.get(ID.CHILLBLAINS)?.icon,
        triggeredBy: cast.skill.name,
        offTarget: cast.command.offTarget,
        skillWeapon: 'Unequipped'
      })
    }))
  ]
});

export const bloodMagicTraits = [vampiric, vampiricPresence, overflowingThirst, transfusion];
