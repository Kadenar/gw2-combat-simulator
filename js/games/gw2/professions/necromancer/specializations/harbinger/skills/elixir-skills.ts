/**
 * Owns Harbinger elixir skill fragments.
 * Blight state and trait-dependent ground effects remain under `mechanics/`.
 */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { GW2_DAMAGING_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

/** Supplies Harbinger elixir fragments to specialization composition. */
export const HARBINGER_ELIXIR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.ELIXIR_OF_BLISS]: {
    castTimeMs: 360,
    blightCost: 5,
    blightGain: 10,
    // Unmeasured elixir packets currently share cast completion as their impact.
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.8, hits: 1 }
    ])
  },
  [ID.ELIXIR_OF_RISK]: {
    // Risk occupies the same 680 ms Quickness cast lane as the other thrown Harbinger elixirs.
    castTimeMs: 680,
    // Safe animation cancellation is independent of Blight consumption and projectile impact.
    interruptCommitMs: 440,
    blightCost: 5,
    blightGain: 10,
    effects: impactEffects(
      // The launched projectile survives an animation cancel and lands on its measured impact frame.
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 2, hits: 1 },
        { type: 'condition', condition: 'Torment', stacks: 3, duration: 5 },
        { type: 'condition', condition: 'Weakness', stacks: 1, duration: 5 },
        { type: 'boon', boon: 'might', stacks: 10, duration: 10 },
        { type: 'boon', boon: 'fury', stacks: 1, duration: 10 }
      ]
    ),
    cooldown: 20
  },
  [ID.ELIXIR_OF_IGNORANCE]: {
    castTimeMs: 360,
    blightCost: 5,
    blightGain: 10,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.8, hits: 1 },
      { type: 'blind', duration: 0 }
    ])
  },
  [ID.ELIXIR_OF_AMBITION]: {
    castTimeMs: 680,
    // Safe animation cancellation is independent of Blight consumption.
    interruptCommitMs: 400,
    blightCost: 10,
    blightGain: 15,
    effects: impactEffects(
      // The committed projectile lands independently of the cancelable remaining animation.
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 1.5, hits: 1 },
        // Only Burning needs individual applications; other conditions retain their bundled stacks.
        ...GW2_DAMAGING_CONDITIONS.flatMap((condition) =>
          Array.from({ length: condition === 'Burning' ? 3 : 1 }, () => ({
            type: 'condition' as const,
            condition,
            stacks: condition === 'Burning' ? 1 : 3,
            duration: 5
          }))
        ),
        { type: 'boon', boon: 'might', stacks: 25, duration: 5 },
        { type: 'boon', boon: 'fury', stacks: 1, duration: 5 },
        { type: 'boon', boon: 'quickness', stacks: 1, duration: 5 },
        { type: 'boon', boon: 'alacrity', stacks: 1, duration: 5 }
      ]
    )
  },
  [ID.ELIXIR_OF_ANGUISH]: {
    castTimeMs: 680,
    blightCost: 5,
    blightGain: 10,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1, hits: 1 },
      // Anguish pairs enemy control with mobility; its empowered profile doubles these durations.
      { type: 'condition', condition: 'Crippled', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'quickness', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'swiftness', stacks: 1, duration: 10 }
    ])
  },
  [ID.ELIXIR_OF_PROMISE]: {
    castTimeMs: 680,
    // Safe animation cancellation is independent of Blight consumption.
    interruptCommitMs: 400,
    blightCost: 5,
    blightGain: 10,
    effects: impactEffects(
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.8, hits: 1 },
        { type: 'condition', condition: 'Poisoned', stacks: 3, duration: 5 }
      ]
    )
  }
});
