import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { defineTrait, traitAttributeEffects } from '#gw2/platform/profession-definition/traits.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { quantizeGw2ActionDurationUp } from '#gw2/platform/skills/timing.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { applyOverflowingThirstCast } from '#gw2/professions/necromancer/core/traits/life-steal.js';

/** Grant Last Rites' full-health Healing Power once in either build or raw runtime attributes. */
export const lastRites = defineTrait({
  id: TRAIT.LAST_RITES,
  name: 'Last Rites',
  balance: { attributeBonus: 150 },
  buildAttributes: traitAttributeEffects(TRAIT.LAST_RITES, [
    { kind: 'flat', to: 'Healing Power', field: 'attributeBonus', feedsConversions: true }
  ]),
  modifierRules: [
    {
      id: 'necromancer.last-rites-healing-power',
      target: MODIFIER_TARGET.ATTRIBUTE_HEALING_POWER,
      operation: 'add',
      amount: (context) =>
        balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.LAST_RITES), 'attributeBonus'),
      when: (context) => !professionStaticRulesApplied(context.config)
    }
  ]
});

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

/** A completed combat dodge triggers its mark at the landing position, without an internal cooldown. */
export const markOfEvasion = defineTrait({
  id: TRAIT.MARK_OF_EVASION,
  name: 'Mark of Evasion',
  balance: {
    effects: [
      { name: 'Strike', type: 'strike', coefficient: 0.33, hits: 1 },
      { name: 'Bleeding', type: 'condition', condition: 'Bleeding', stacks: 2, duration: 8 },
      {
        name: 'Regeneration',
        type: 'boon',
        boon: 'regeneration',
        stacks: 1,
        duration: 5,
        audience: { recipients: 'party', maximumRecipients: 5 }
      }
    ]
  },
  triggers: [
    {
      on: 'castCommit',
      when: (runtime, cast) => cast.skill.id === SHARED_SKILL_IDS.DODGE && runtime.combatStartedAt(),
      emit: TRAIT.MARK_OF_EVASION,
      attribution: (_runtime, cast) => ({
        skillId: undefined,
        skillName: 'Lesser Mark of Blood',
        name: 'Lesser Mark of Blood',
        skillWeapon: 'Unequipped',
        triggeredBy: cast.skill.name,
        offTarget: cast.command.offTarget
      })
    }
  ]
});

/** Extend the swarm and its swiftness while increasing siphon base damage, leaving Power scaling unchanged. */
export const bansheesWail = defineTrait({
  id: TRAIT.BANSHEES_WAIL,
  name: "Banshee's Wail",
  balance: { durationMultiplier: 1.5 },
  hooks: {
    modifyEffects(runtime, cast, effects) {
      if (cast.skill.id !== ID.LOCUST_SWARM || !hasTrait(runtime, TRAIT.BANSHEES_WAIL)) return effects;
      const multiplier = balanceProfileNumber(
        requireBalanceProfileFromContext(runtime, TRAIT.BANSHEES_WAIL),
        'durationMultiplier'
      );
      return effects.map((effect) => {
        if (effect.type === 'boon') return { ...effect, duration: effect.duration * multiplier };
        if (effect.type !== 'strike' || !effect.ticks?.length) return effect;
        const ticks = effect.ticks;
        const last = ticks[ticks.length - 1]!;
        return {
          ...effect,
          flatStrikeBase: Math.floor((effect.flatStrikeBase ?? 0) * multiplier),
          ticks: Array.from(
            { length: Math.round(ticks.length * multiplier) },
            (_, index) => ticks[index] ?? { ...last, atMs: quantizeGw2ActionDurationUp(index * 500) }
          )
        };
      });
    }
  }
});

export const bloodMagicTraits = [
  markOfEvasion,
  lastRites,
  vampiric,
  vampiricPresence,
  overflowingThirst,
  bansheesWail,
  transfusion
];
