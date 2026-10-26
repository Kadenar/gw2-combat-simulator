import { ACTOR, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import { boonKey } from '#gw2/platform/combat/boons.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import { requireBalanceProfileFromContext } from '#gw2/platform/skills/balance-profiles.js';
import { RENEGADE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/renegade/profiles.js';

/** Adds protection only for the selected enhancement, retaining the order's pulse cadence. */
const boldReversalOrderEffects: NonNullable<NonNullable<Skill['effectVariants']>[number]['transform']> = (
  runtime,
  _cast,
  effects
) =>
  hasTrait(runtime, TRAIT.BOLD_REVERSAL)
    ? [...effects, ...(requireBalanceProfileFromContext(runtime, PROFILE.boldReversalRighteousRebel).effects ?? [])]
    : effects;

/** Supplies Orders from Above's trait-selected pulse variant at skill materialization. */
const righteousRebelOrderVariants: NonNullable<Skill['effectVariants']> = [
  {
    when: (runtime) => hasTrait(runtime, TRAIT.RIGHTEOUS_REBEL),
    profileId: PROFILE.ordersFromAboveRighteousRebel,
    transform: boldReversalOrderEffects
  }
];

// Each impact applies strike damage and Burning at the same offset after cast completion.
const BOMBARDMENT_IMPACT_MS = [640, 800, 920, 1000, 1040, 1160, 1240, 1400, 1480, 1720];

export const RENEGADE_ORDER_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.CITADEL_BOMBARDMENT]: {
    cooldown: 15,
    energyCost: 35,
    // Quantize the pooled Hibernus/Seatek impact estimates to 40 ms after cast completion; exclude incomplete volleys.
    castTimeMs: 600,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        name: 'Citadel Bombardment',
        actorType: ACTOR.PLAYER,
        ticks: BOMBARDMENT_IMPACT_MS.map((atMs) => ({ atMs, coefficient: 0.6 }))
      },
      {
        type: 'condition',
        actorType: ACTOR.PLAYER,
        ticks: BOMBARDMENT_IMPACT_MS.map((atMs) => ({
          atMs,
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 1
        }))
      }
    ])
  },
  [ID.HEROIC_COMMAND]: {
    cooldown: 10,
    energyCost: 10,
    castTimeMs: 480,
    effects: [
      {
        name: boonKey(BOON.MIGHT),
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 8,
        stacks: 2,
        actorType: ACTOR.PLAYER
      }
    ],
    // The cast emits nothing itself: `heroic-command.ts` scales this Might payload by live Fervor at commitment.
    effectVariants: [{ when: () => true, transform: () => [] }],
    // Skill-owned triggers delegate shared state transitions to the registered mechanic.
    sideEffects: [{ on: 'castCommit', do: { type: 'revenant.heroic-command' } }]
  },
  [ID.ORDERS_FROM_ABOVE]: {
    cooldown: 20,
    energyCost: 20,
    castTimeMs: 0,
    effects: [
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.ALACRITY,
        duration: 2,
        stacks: 1,
        applications: 4,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: ACTOR.PLAYER
      }
    ],
    // These trait-selected pulses need no live Fervor state; normal scheduling preserves their fixed cadence.
    effectVariants: righteousRebelOrderVariants
  }
});
