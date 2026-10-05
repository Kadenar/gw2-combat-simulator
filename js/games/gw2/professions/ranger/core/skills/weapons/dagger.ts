import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { targetHasCondition } from '#gw2/platform/combat/state/targets.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { requireBalanceProfileFromContext, balanceProfileNumber } from '#gw2/platform/skills/balance-profiles.js';
import { RANGER_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/ranger/core/profiles.js';
import { stalkersStrikeTargetImpaired } from '#gw2/professions/ranger/core/mechanics/resolution-helpers.js';
/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// Projectile flags belong to strikes so Mistral and Shrike count impacts independently of combo success.
export const RANGER_CORE_DAGGER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.CRIPPLING_TALON]: {
    effects: [
      {
        type: 'strike',
        projectile: true,
        coefficient: 0.9,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Projectile',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 6
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4
      }
    ],
    castTimeMs: 360
  },
  [ID.STALKERS_STRIKE]: {
    evades: true,
    effects: [
      {
        type: 'strike',
        // The strike owns only its impaired-target bonus; the base poison remains independent.
        reactions: [
          {
            on: 'damage.resolved',
            actor: 'player',
            packets: 'each',
            when: (runtime, { event }) =>
              Number(event.coefficient) > 0 &&
              event.source !== 'ranger-pet' &&
              stalkersStrikeTargetImpaired((condition) => runtime.combat.targetHasCondition(condition, event.at)),
            do: { type: 'ranger.stalkers-poison' }
          }
        ],
        coefficient: 0.6,
        hits: 1
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 3,
        duration: 8
      }
    ],
    // Movement impairment adds the remaining strike and Poison bonuses during resolution.
    castTimeMs: 760
  },
  [ID.LEADING_SWIPE]: {
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4
      },
      {
        type: 'strike',
        coefficient: 0.42,
        hits: 1
      }
    ],
    castTimeMs: 320
  },
  [ID.SERPENT_STAB]: {
    effects: [
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 4
      },
      {
        type: 'strike',
        coefficient: 0.44,
        hits: 1
      }
    ],
    castTimeMs: 280
  },
  [ID.DOUBLE_ARC]: {
    // Arm subsequent qualifying hits only on semantic commitment.
    sideEffects: [{ on: 'castCommit', do: { type: 'ranger.poisonous-strikes' } }],
    effects: [
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 6,
        duration: 6
      },
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 2,
        atMs: 0
      }
    ],

    cooldown: 6,
    castTimeMs: 600
    // Double Arc arms the pet's next two attacks; the weapon hit does not poison directly.
  },
  [ID.DEADLY_DELIVERY]: {
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 4
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 4
      },
      {
        type: 'strike',
        coefficient: 0.88,
        hits: 1
      }
    ],
    castTimeMs: 440
  },
  [ID.GROUNDWORK_GOUGE]: {
    effects: [
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 4
      },
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1
      }
    ],
    castTimeMs: 280
  },
  [ID.INSTINCTIVE_ENGAGE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Leap',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 3,
        stacks: 1
      },
      {
        type: 'condition',
        condition: 'Slow',
        stacks: 1,
        duration: 2
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 4,
        duration: 8
      }
    ],

    cooldown: 12,
    castTimeMs: 840
  }
});

/** Intrinsic live-impact policy stays beside its skill; the shared registry supplies resolution. */
export const rangerStalkersStrikeModifier: Gw2ModifierRule = {
  id: 'ranger.stalkers-strike-movement-impaired',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  factor: (context) =>
    balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.stalkersStrikeImpaired), 'damageMultiplier'),
  // Double only this skill's strike when Cripple, Slow, or Immobilize is active.
  when: (context) =>
    skillForEvent(context.profession?.catalog, context.event, context.skillId)?.id === ID.STALKERS_STRIKE &&
    stalkersStrikeTargetImpaired((condition) =>
      targetHasCondition(context.config ?? {}, condition, context.time, context.runtime)
    )
};
