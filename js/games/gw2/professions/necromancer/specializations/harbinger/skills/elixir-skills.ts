/**
 * Owns Harbinger elixir skill fragments.
 * Impact hooks read skill-owned Blight gain for both impact variants.
 */
import { boonKey } from '#gw2/platform/combat/boons.js';
import { GW2_DAMAGING_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import { ACTOR, BOON, CONDITION } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

/** Supplies Harbinger elixir fragments to specialization composition. */
export const HARBINGER_ELIXIR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.ELIXIR_OF_BLISS]: {
    // Empowerment spends this skill's Blight independently of its removable payload.
    blightCost: 5,
    blightGain: 10,
    castTimeMs: 360,
    // Unmeasured elixir packets currently share cast completion as their impact.
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.8, hits: 1 }
    ]),
    effectVariants: [{ when: () => true, transform: () => [] }],
    // The launch task samples live Blight before the separately timed impact.
    sideEffects: [
      {
        on: 'castStart',
        do: {
          type: 'harbinger.elixir-launch',
          id: 'empowered',
          effects: [{ name: 'Strike', type: 'strike', coefficient: 1.6, hits: 1, actorType: ACTOR.PLAYER }]
        }
      }
    ]
  },
  [ID.ELIXIR_OF_RISK]: {
    // Empowerment spends this skill's Blight independently of its removable payload.
    blightCost: 5,
    blightGain: 10,
    cooldown: 20,
    // Risk occupies the same 680 ms Quickness cast lane as the other thrown Harbinger elixirs.
    castTimeMs: 680,
    // Safe animation cancellation is independent of Blight consumption and projectile impact.
    interruptCommitMs: 440,
    effects: impactEffects(
      // The launched projectile survives an animation cancel and lands on its measured impact frame.
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 2, hits: 1 },
        { type: 'condition', condition: CONDITION.TORMENT, stacks: 3, duration: 5 },
        { type: 'condition', condition: CONDITION.WEAKNESS, stacks: 1, duration: 5 },
        { type: 'boon', boon: BOON.MIGHT, stacks: 10, duration: 10 },
        { type: 'boon', boon: BOON.FURY, stacks: 1, duration: 10 }
      ]
    ),
    effectVariants: [{ when: () => true, transform: () => [] }],
    // The launch task samples live Blight before the separately timed impact.
    sideEffects: [
      {
        on: 'castStart',
        do: {
          type: 'harbinger.elixir-launch',
          id: 'empowered',
          effects: [
            { name: 'Strike', type: 'strike', coefficient: 4, hits: 1, actorType: ACTOR.PLAYER },
            {
              name: CONDITION.TORMENT,
              type: 'condition',
              condition: CONDITION.TORMENT,
              stacks: 3,
              duration: 10,
              actorType: ACTOR.PLAYER
            },
            {
              name: CONDITION.WEAKNESS,
              type: 'condition',
              condition: CONDITION.WEAKNESS,
              stacks: 1,
              duration: 10,
              actorType: ACTOR.PLAYER
            },
            {
              name: boonKey(BOON.MIGHT),
              type: 'boon',
              boon: BOON.MIGHT,
              stacks: 10,
              duration: 10,
              actorType: ACTOR.PLAYER
            },
            {
              name: boonKey(BOON.FURY),
              type: 'boon',
              boon: BOON.FURY,
              stacks: 1,
              duration: 10,
              actorType: ACTOR.PLAYER
            }
          ]
        }
      }
    ]
  },
  [ID.ELIXIR_OF_IGNORANCE]: {
    // Empowerment spends this skill's Blight independently of its removable payload.
    blightCost: 5,
    blightGain: 10,
    castTimeMs: 360,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.8, hits: 1 },
      {
        type: 'condition',
        condition: CONDITION.BLINDNESS,
        stacks: 1,
        duration: 2
      }
    ]),
    effectVariants: [{ when: () => true, transform: () => [] }],
    // The launch task samples live Blight before the separately timed impact.
    sideEffects: [
      {
        on: 'castStart',
        do: {
          type: 'harbinger.elixir-launch',
          id: 'empowered',
          effects: [{ name: 'Strike', type: 'strike', coefficient: 1.6, hits: 1, actorType: ACTOR.PLAYER }]
        }
      }
    ]
  },
  [ID.ELIXIR_OF_AMBITION]: {
    // Empowerment spends this skill's Blight independently of its removable payload.
    blightCost: 10,
    blightGain: 15,
    castTimeMs: 680,
    // Safe animation cancellation is independent of Blight consumption.
    interruptCommitMs: 400,
    effects: impactEffects(
      // The committed projectile lands independently of the cancelable remaining animation.
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 1.5, hits: 1 },
        // Each condition carries its total; the resolver splits stacks for application reactions.
        ...GW2_DAMAGING_CONDITIONS.map((condition) => ({
          type: 'condition' as const,
          condition,
          stacks: 3,
          duration: 5
        })),
        { type: 'boon', boon: BOON.MIGHT, stacks: 25, duration: 5 },
        { type: 'boon', boon: BOON.FURY, stacks: 1, duration: 5 },
        { type: 'boon', boon: BOON.QUICKNESS, stacks: 1, duration: 5 },
        { type: 'boon', boon: BOON.ALACRITY, stacks: 1, duration: 5 }
      ]
    ),
    effectVariants: [{ when: () => true, transform: () => [] }],
    // The launch task samples live Blight before the separately timed impact.
    sideEffects: [
      {
        on: 'castStart',
        do: {
          type: 'harbinger.elixir-launch',
          id: 'empowered',
          effects: [
            { name: 'Strike', type: 'strike', coefficient: 3, hits: 1, actorType: ACTOR.PLAYER },
            // Profile totals stay editable as one effect; resolution owns Burning stack expansion.
            ...GW2_DAMAGING_CONDITIONS.map((condition) => ({
              name: condition,
              type: 'condition' as const,
              condition,
              stacks: 3,
              duration: 10,
              actorType: ACTOR.PLAYER
            })),
            {
              name: boonKey(BOON.MIGHT),
              type: 'boon',
              boon: BOON.MIGHT,
              stacks: 25,
              duration: 5,
              actorType: ACTOR.PLAYER
            },
            {
              name: boonKey(BOON.FURY),
              type: 'boon',
              boon: BOON.FURY,
              stacks: 1,
              duration: 5,
              actorType: ACTOR.PLAYER
            },
            {
              name: boonKey(BOON.QUICKNESS),
              type: 'boon',
              boon: BOON.QUICKNESS,
              stacks: 1,
              duration: 5,
              actorType: ACTOR.PLAYER
            },
            {
              name: boonKey(BOON.ALACRITY),
              type: 'boon',
              boon: BOON.ALACRITY,
              stacks: 1,
              duration: 5,
              actorType: ACTOR.PLAYER
            }
          ]
        }
      }
    ]
  },
  [ID.ELIXIR_OF_ANGUISH]: {
    // Empowerment spends this skill's Blight independently of its removable payload.
    blightCost: 5,
    blightGain: 10,
    castTimeMs: 680,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1, hits: 1 },
      // Anguish pairs enemy control with mobility; its empowered component doubles these durations.
      { type: 'condition', condition: CONDITION.CRIPPLED, stacks: 1, duration: 5 },
      { type: 'boon', boon: BOON.QUICKNESS, stacks: 1, duration: 5 },
      { type: 'boon', boon: BOON.SWIFTNESS, stacks: 1, duration: 10 }
    ]),
    effectVariants: [{ when: () => true, transform: () => [] }],
    // The launch task samples live Blight before the separately timed impact.
    sideEffects: [
      {
        on: 'castStart',
        do: {
          type: 'harbinger.elixir-launch',
          id: 'empowered',
          effects: [
            { name: 'Strike', type: 'strike', coefficient: 2, hits: 1, actorType: ACTOR.PLAYER },
            {
              name: CONDITION.CRIPPLED,
              type: 'condition',
              condition: CONDITION.CRIPPLED,
              stacks: 1,
              duration: 10,
              actorType: ACTOR.PLAYER
            },
            {
              name: boonKey(BOON.QUICKNESS),
              type: 'boon',
              boon: BOON.QUICKNESS,
              stacks: 1,
              duration: 10,
              actorType: ACTOR.PLAYER
            },
            {
              name: boonKey(BOON.SWIFTNESS),
              type: 'boon',
              boon: BOON.SWIFTNESS,
              stacks: 1,
              duration: 20,
              actorType: ACTOR.PLAYER
            }
          ]
        }
      }
    ]
  },
  [ID.ELIXIR_OF_PROMISE]: {
    // Empowerment spends this skill's Blight independently of its removable payload.
    blightCost: 5,
    blightGain: 10,
    castTimeMs: 680,
    // Safe animation cancellation is independent of Blight consumption.
    interruptCommitMs: 400,
    effects: impactEffects(
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.8, hits: 1 },
        { type: 'condition', condition: CONDITION.POISONED, stacks: 3, duration: 5 }
      ]
    ),
    effectVariants: [{ when: () => true, transform: () => [] }],
    // The launch task samples live Blight before the separately timed impact.
    sideEffects: [
      {
        on: 'castStart',
        do: {
          type: 'harbinger.elixir-launch',
          id: 'empowered',
          effects: [
            { name: 'Strike', type: 'strike', coefficient: 1.6, hits: 1, actorType: ACTOR.PLAYER },
            {
              name: CONDITION.POISONED,
              type: 'condition',
              condition: CONDITION.POISONED,
              stacks: 3,
              duration: 10,
              actorType: ACTOR.PLAYER
            }
          ]
        }
      }
    ]
  }
});
