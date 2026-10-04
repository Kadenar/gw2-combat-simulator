/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Both Maul variants share their strike, timing, recharge, and vulnerability; their bonus recipients differ.
const maul: Partial<Skill> = {
  cooldown: 4,
  effects: [
    {
      type: 'strike',
      coefficient: 2.2,
      hits: 1,
      // Queue the recipient's next-attack buff after the current strike's existing charge is consumed.
      reactions: [
        {
          on: 'damage.resolved',
          actor: 'player',
          packets: 'each',
          when: (runtime, { event, skill }) =>
            Number(event.coefficient) > 0 &&
            event.source !== 'ranger-pet' &&
            skill.id === ID.MAUL_BASE &&
            runtime.profession.core.petActive,
          do: { type: 'ranger.maul-pet' }
        },
        {
          on: 'damage.resolved',
          actor: 'player',
          packets: 'each',
          when: (runtime, { event, skill }) =>
            Number(event.coefficient) > 0 &&
            event.source !== 'ranger-pet' &&
            skill.id === ID.MAUL_SOULBEAST &&
            runtime.profession.specialization.kind === 'Soulbeast' &&
            runtime.profession.specialization.state.beastmodeActive,
          do: { type: 'ranger.maul-player' }
        }
      ]
    },
    { type: 'condition', condition: 'Vulnerability', stacks: 5, duration: 8 }
  ],
  castTimeMs: 840
};

export const RANGER_CORE_GREATSWORD_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SLASH_ID_12474]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.88,
        hits: 1
      }
    ],
    castTimeMs: 400
  },
  [ID.HILT_BASH]: {
    // The completed activation refreshes its paired skill through the shared recharge owner.
    sideEffects: [{ on: 'castCommit', do: { type: 'rechargeReset', skillIds: [ID.MAUL_SOULBEAST, ID.MAUL_BASE] } }],
    cooldown: 20,

    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      },
      // Select one control packet at acceptance without rewriting effects in the Core hook.
      { type: 'control', controlKind: 'Daze', when: (runtime) => !runtime.config.target?.defiant },
      { type: 'control', controlKind: 'Stun', when: (runtime) => Boolean(runtime.config.target?.defiant) }
    ],
    castTimeMs: 640
  },
  [ID.SLICE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1
      }
    ],
    castTimeMs: 600
  },
  [ID.ENDURING_SWING]: {
    // Only a fully completed chain finisher grants the selected endurance reward.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'resourceGrant',
          resource: 'endurance',
          amount: { profile: ID.ENDURING_SWING, field: 'resourceGain' }
        }
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 1.76,
        hits: 1
      }
    ],
    castTimeMs: 800
  },
  [ID.SWOOP]: {
    cooldown: 10,
    evades: true,
    effects: [
      {
        type: 'strike',
        coefficient: 2.4,
        hits: 1,
        comboFinishers: [{ ownerId: 'ranger', finisherType: 'Leap', ambiguousFieldSelection: 'oldest' }]
      }
    ],
    castTimeMs: 500
  },
  [ID.COUNTERATTACK]: {
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.COUNTERATTACK_KICK, durationSec: 5 } }],
    effects: [],
    castTimeMs: 2000
  },
  [ID.COUNTERATTACK_KICK]: {
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.COUNTERATTACK_KICK } }],
    evades: true,
    // The PvE kick lands once and its knockback can trigger control reactions.
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1
      },
      { type: 'control', controlKind: 'Knockback' }
    ],
    castTimeMs: 333
  },
  [ID.MAUL_SOULBEAST]: maul,
  [ID.MAUL_BASE]: maul
});
