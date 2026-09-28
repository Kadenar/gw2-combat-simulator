/**
 * Owns Harbinger elixir skill fragments.
 * Impact hooks read Blight gain from the mapped empowered balance profile for both impact variants.
 */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { GW2_DAMAGING_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

/** Supplies Harbinger elixir fragments to specialization composition. */
export const HARBINGER_ELIXIR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.ELIXIR_OF_BLISS]: {
    // The launch task samples live Blight before the separately timed impact.
    sideEffects: [{ on: 'castStart', do: { type: 'harbinger.elixir-launch' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 360,
    // Unmeasured elixir packets currently share cast completion as their impact.
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.8, hits: 1 }
    ])
  },
  [ID.ELIXIR_OF_RISK]: {
    // The launch task samples live Blight before the separately timed impact.
    sideEffects: [{ on: 'castStart', do: { type: 'harbinger.elixir-launch' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    // Risk occupies the same 680 ms Quickness cast lane as the other thrown Harbinger elixirs.
    castTimeMs: 680,
    // Safe animation cancellation is independent of Blight consumption and projectile impact.
    interruptCommitMs: 440,
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
    // The launch task samples live Blight before the separately timed impact.
    sideEffects: [{ on: 'castStart', do: { type: 'harbinger.elixir-launch' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 360,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.8, hits: 1 },
      { type: 'blind', duration: 0 }
    ])
  },
  [ID.ELIXIR_OF_AMBITION]: {
    // The launch task samples live Blight before the separately timed impact.
    sideEffects: [{ on: 'castStart', do: { type: 'harbinger.elixir-launch' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 680,
    // Safe animation cancellation is independent of Blight consumption.
    interruptCommitMs: 400,
    effects: impactEffects(
      // The committed projectile lands independently of the cancelable remaining animation.
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 1.5, hits: 1 },
        // Each condition carries its total; the resolver splits Burning for application reactions.
        ...GW2_DAMAGING_CONDITIONS.map((condition) => ({
          type: 'condition' as const,
          condition,
          stacks: 3,
          duration: 5
        })),
        { type: 'boon', boon: 'might', stacks: 25, duration: 5 },
        { type: 'boon', boon: 'fury', stacks: 1, duration: 5 },
        { type: 'boon', boon: 'quickness', stacks: 1, duration: 5 },
        { type: 'boon', boon: 'alacrity', stacks: 1, duration: 5 }
      ]
    )
  },
  [ID.ELIXIR_OF_ANGUISH]: {
    // The launch task samples live Blight before the separately timed impact.
    sideEffects: [{ on: 'castStart', do: { type: 'harbinger.elixir-launch' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 680,
    effects: impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 1, hits: 1 },
      // Anguish pairs enemy control with mobility; its empowered profile doubles these durations.
      { type: 'condition', condition: 'Crippled', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'quickness', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'swiftness', stacks: 1, duration: 10 }
    ])
  },
  [ID.ELIXIR_OF_PROMISE]: {
    // The launch task samples live Blight before the separately timed impact.
    sideEffects: [{ on: 'castStart', do: { type: 'harbinger.elixir-launch' } }],
    effectVariants: [{ when: () => true, transform: () => [] }],
    castTimeMs: 680,
    // Safe animation cancellation is independent of Blight consumption.
    interruptCommitMs: 400,
    effects: impactEffects(
      { atMs: 400, timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true },
      [
        { type: 'strike', coefficient: 0.8, hits: 1 },
        { type: 'condition', condition: 'Poisoned', stacks: 3, duration: 5 }
      ]
    )
  }
});
