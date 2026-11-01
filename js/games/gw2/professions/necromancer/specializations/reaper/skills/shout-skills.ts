/**
 * Owns Reaper shout skill definitions.
 * Reaper Shroud skill definitions live in `shroud-skills.ts`.
 */
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

/** Supplies Reaper shout definitions to specialization composition. */
export const REAPER_SHOUT_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.YOU_ARE_ALL_WEAKLINGS]: {
    name: '"You Are All Weaklings!"',
    description:
      'Shout. Damage foes around you and gain boons. Inflict conditions on struck foes, and gain boons per foe struck. Deal additional damage and gain additional boons when striking foes within melee range.',
    icon: 'https://render.guildwars2.com/file/7F319A751466157F5496545D21C76161F0E752F6/1012951.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Shout',
    cooldown: 20,
    castTimeMs: 0,
    effects: [{ type: 'strike', coefficient: 2.5, hits: 1 }]
  },
  [ID.NOTHING_CAN_SAVE_YOU]: {
    name: '"Nothing Can Save You!"',
    description:
      'Shout. Damage foes around you, converting their boons into vulnerability. Your next few attacks become unblockable. Deal additional damage and gain additional unblockable attacks when striking foes within melee range.',
    icon: 'https://render.guildwars2.com/file/E45F03C3E0CDAD2FA832383105C5E8E2E5EFFDC3/1012939.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Shout',
    cooldown: 16,
    castTimeMs: 360,
    effects: [
      { type: 'strike', coefficient: 2, hits: 1 },
      { type: 'condition', condition: CONDITION.VULNERABILITY, duration: 10, stacks: 6 }
    ]
  },
  [ID.CHILLED_TO_THE_BONE]: {
    name: '"Chilled to the Bone!"',
    description:
      'Shout. Freeze all enemies around you, inflicting conditions on them. Gain boons for each foe you freeze. Deal additional damage and increased stun duration and gain additional boons when striking foes in melee range.',
    icon: 'https://render.guildwars2.com/file/7E2553D0EFDAE14CACCBC3089DBEA70E6CED2AF1/1012912.png',
    type: 'Elite',
    slot: 'Elite',
    skillFamily: 'Shout',
    cooldown: 30,
    castTimeMs: 680,
    effects: [
      { type: 'strike', coefficient: 3, hits: 1 },
      { type: 'control', controlKind: CONTROL.STUN },
      { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 4 }
    ]
  },
  [ID.YOUR_SOUL_IS_MINE]: {
    name: '"Your Soul Is Mine!"',
    description:
      'Shout. Heal yourself, gain life force, and strike foes around you, absorbing additional life force from each foe struck. Deal additional damage and gain bonus life force when striking foes in melee range.',
    icon: 'https://render.guildwars2.com/file/53CF76526440F5987FA3E2CCDC9A2F2799CB26A8/1012929.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Shout',
    cooldown: 16,
    castTimeMs: 680,
    effects: [
      {
        type: 'strike',
        // Accepted strikes apply their declared percentage through the shared resource owner.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 15 } })
          }
        ],
        coefficient: 0.5,
        hits: 1
      }
    ]
  },
  [ID.SUFFER]: {
    name: '"Suffer!"',
    description:
      'Shout. Damage foes around you and chill them. Transfer conditions to each foe you strike. Deal additional damage and transfer additional conditions to foes struck within melee range.',
    icon: 'https://render.guildwars2.com/file/E7D8759CBA4E41A03C4E466FDC1274A72D4CE862/1012950.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Shout',
    cooldown: 16,
    // The handler and tooltip share the maximum number of distinct self-condition types transferred.
    conditionsTransferred: 2,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        // The selected landed strike owns this skill-specific transaction.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'first',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: { type: 'necromancer.transfer' }
          }
        ],
        coefficient: 1.5,
        hits: 1
      },
      { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 3 }
    ]
  },
  [ID.RISE]: {
    name: '"Rise!"',
    description:
      'Shout. Damage foes around you. Summon a shambling horror plus additional horrors near each enemy struck. Deal additional damage and summon a second horror when striking foes within melee range. Shambling horrors absorb damage for their master as long as they are attacking.',
    icon: 'https://render.guildwars2.com/file/EE1C060DCC3E764730737C446408EF9DD813E7A6/1012949.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Shout',
    cooldown: 32,
    castTimeMs: 360,
    effects: [{ type: 'strike', coefficient: 0.8, hits: 1 }]
  }
});

/** Intrinsic impact-time formula; the existing modifier registry preserves its operation and ordering. */
export const reaperShoutMeleeModifier: Gw2ModifierRule = {
  // The simulator's target is always nearby, so player shout packets always receive the melee bonus.
  id: 'necromancer.reaper-shout-melee',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  factor: 2,
  // order: 100 places this after additive damage buckets so it multiplies the already-summed base.
  order: 100,
  when: (context) =>
    isGw2PlayerActorEvent(context.event) &&
    skillForEvent(context.profession?.catalog, context.event, context.skillId)?.skillFamily === 'Shout'
};
