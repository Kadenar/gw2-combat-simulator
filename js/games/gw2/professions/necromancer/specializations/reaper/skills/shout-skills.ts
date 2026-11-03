/**
 * Owns Reaper shout skill definitions.
 * Reaper Shroud skill definitions live in `shroud-skills.ts`.
 */
import { MODIFIER_TARGET } from '#gw2/platform/combat/modifiers.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { lifeForceGrant } from '#gw2/professions/necromancer/core/skills/life-force-grants.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Supplies Reaper shout definitions to specialization composition. */
export const REAPER_SHOUT_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<NecromancerSkill>>> = {
  [ID.YOU_ARE_ALL_WEAKLINGS]: {
    name: '"You Are All Weaklings!"',
    icon: 'https://render.guildwars2.com/file/7F319A751466157F5496545D21C76161F0E752F6/1012951.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Shout',
    cooldown: 20,
    castTimeMs: 0,
    // The nearby-target assumption grants this shout its melee strike multiplier.
    modifiers: [
      {
        // The simulator's target is always nearby, so player shout packets always receive the melee bonus.
        id: 'necromancer.you-are-all-weaklings-melee',
        label: 'Reaper shouts — melee bonus',
        order: 0,
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        factor: 2,
        when: (context) => isGw2PlayerActorEvent(context.event)
      }
    ],
    effects: [{ type: 'strike', coefficient: 2.5, hits: 1 }]
  },
  [ID.NOTHING_CAN_SAVE_YOU]: {
    name: '"Nothing Can Save You!"',
    icon: 'https://render.guildwars2.com/file/E45F03C3E0CDAD2FA832383105C5E8E2E5EFFDC3/1012939.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Shout',
    cooldown: 16,
    castTimeMs: 360,
    // The nearby-target assumption grants this shout its melee strike multiplier.
    modifiers: [
      {
        // The simulator's target is always nearby, so player shout packets always receive the melee bonus.
        id: 'necromancer.nothing-can-save-you-melee',
        label: 'Reaper shouts — melee bonus',
        order: 0,
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        factor: 2,
        when: (context) => isGw2PlayerActorEvent(context.event)
      }
    ],
    effects: [
      { type: 'strike', coefficient: 2, hits: 1 },
      { type: 'condition', condition: CONDITION.VULNERABILITY, duration: 10, stacks: 6 }
    ]
  },
  [ID.CHILLED_TO_THE_BONE]: {
    name: '"Chilled to the Bone!"',
    icon: 'https://render.guildwars2.com/file/7E2553D0EFDAE14CACCBC3089DBEA70E6CED2AF1/1012912.png',
    type: 'Elite',
    slot: 'Elite',
    skillFamily: 'Shout',
    cooldown: 30,
    castTimeMs: 680,
    // The nearby-target assumption grants this shout its melee strike multiplier.
    modifiers: [
      {
        // The simulator's target is always nearby, so player shout packets always receive the melee bonus.
        id: 'necromancer.chilled-to-the-bone-melee',
        label: 'Reaper shouts — melee bonus',
        order: 0,
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        factor: 2,
        when: (context) => isGw2PlayerActorEvent(context.event)
      }
    ],
    effects: [
      { type: 'strike', coefficient: 3, hits: 1 },
      { type: 'control', controlKind: CONTROL.STUN },
      { type: 'condition', condition: CONDITION.CHILLED, stacks: 1, duration: 4 }
    ]
  },
  [ID.YOUR_SOUL_IS_MINE]: {
    name: '"Your Soul Is Mine!"',
    icon: 'https://render.guildwars2.com/file/53CF76526440F5987FA3E2CCDC9A2F2799CB26A8/1012929.png',
    type: 'Heal',
    slot: 'Heal',
    skillFamily: 'Shout',
    cooldown: 16,
    castTimeMs: 680,
    // The nearby-target assumption grants this shout its melee strike multiplier.
    modifiers: [
      {
        // The simulator's target is always nearby, so player shout packets always receive the melee bonus.
        id: 'necromancer.your-soul-is-mine-melee',
        label: 'Reaper shouts — melee bonus',
        order: 0,
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        factor: 2,
        when: (context) => isGw2PlayerActorEvent(context.event)
      }
    ],
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
            do: [lifeForceGrant({ id: 'life-force', unit: 'hit', grant: { percent: 15 } })]
          }
        ],
        coefficient: 0.5,
        hits: 1
      }
    ]
  },
  [ID.SUFFER]: {
    name: '"Suffer!"',
    icon: 'https://render.guildwars2.com/file/E7D8759CBA4E41A03C4E466FDC1274A72D4CE862/1012950.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Shout',
    cooldown: 16,
    // The handler and tooltip share the maximum number of distinct self-condition types transferred.
    conditionsTransferred: 2,
    castTimeMs: 0,
    // The nearby-target assumption grants this shout its melee strike multiplier.
    modifiers: [
      {
        // The simulator's target is always nearby, so player shout packets always receive the melee bonus.
        id: 'necromancer.suffer-melee',
        label: 'Reaper shouts — melee bonus',
        order: 0,
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        factor: 2,
        when: (context) => isGw2PlayerActorEvent(context.event)
      }
    ],
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
            do: [{ type: 'necromancer.transfer' }]
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
    icon: 'https://render.guildwars2.com/file/EE1C060DCC3E764730737C446408EF9DD813E7A6/1012949.png',
    type: 'Utility',
    slot: 'Utility',
    skillFamily: 'Shout',
    cooldown: 32,
    castTimeMs: 360,
    // The nearby-target assumption grants this shout its melee strike multiplier.
    modifiers: [
      {
        // The simulator's target is always nearby, so player shout packets always receive the melee bonus.
        id: 'necromancer.rise-melee',
        label: 'Reaper shouts — melee bonus',
        order: 0,
        target: MODIFIER_TARGET.STRIKE_DAMAGE,
        operation: 'multiply',
        factor: 2,
        when: (context) => isGw2PlayerActorEvent(context.event)
      }
    ],
    effects: [{ type: 'strike', coefficient: 0.8, hits: 1 }]
  }
};
