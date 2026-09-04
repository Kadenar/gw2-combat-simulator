/**
 * Owns Harbinger elixir skill fragments.
 * Blight state and trait-dependent ground effects remain under `mechanics/`.
 */
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { GW2_DAMAGING_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

/** Supplies Harbinger elixir fragments to specialization composition. */
export const HARBINGER_ELIXIR_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.ELIXIR_OF_BLISS]: {
    castTimeMs: 500,
    blightCost: 5,
    blightGain: 10,
    effects: [{ type: 'strike', coefficient: 0.8, hits: 1 }],
    // Custom: Materializes elixir boons, Blight, and trait-dependent ground effects; see `harbinger/mechanics/blight.ts`.
    handlerId: 'necromancer.elixir'
  },
  [ID.ELIXIR_OF_RISK]: {
    // Risk occupies the same 680 ms Quickness cast lane as the other thrown Harbinger elixirs.
    quicknessCastTimeMs: 680,
    // The projectile releases at 440 ms, so canceling the remaining animation retains its later impact.
    interruptCommitMs: 440,
    blightCost: 5,
    blightGain: 10,
    effects: [
      { type: 'strike', coefficient: 2, hits: 1 },
      { type: 'condition', condition: 'Torment', stacks: 3, duration: 5 },
      { type: 'condition', condition: 'Weakness', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'might', stacks: 10, duration: 10 },
      { type: 'boon', boon: 'fury', stacks: 1, duration: 10 }
    ],
    cooldown: 20,
    // Custom: Materializes elixir boons, Blight, and trait-dependent ground effects; see `harbinger/mechanics/blight.ts`.
    handlerId: 'necromancer.elixir'
  },
  [ID.ELIXIR_OF_IGNORANCE]: {
    castTimeMs: 500,
    blightCost: 5,
    blightGain: 10,
    effects: [
      { type: 'strike', coefficient: 0.8, hits: 1 },
      { type: 'blind', duration: 0 }
    ],
    // Custom: Materializes elixir boons, Blight, and trait-dependent ground effects; see `harbinger/mechanics/blight.ts`.
    handlerId: 'necromancer.elixir'
  },
  [ID.ELIXIR_OF_AMBITION]: {
    quicknessCastTimeMs: 680,
    // The thrown elixir commits on its 400 ms impact frame, allowing the remaining animation to be canceled.
    interruptCommitMs: 400,
    blightCost: 10,
    blightGain: 15,
    effects: [
      { type: 'strike', coefficient: 1.5, hits: 1 },
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
    ],
    // Custom: Materializes elixir boons, Blight, and trait-dependent ground effects; see `harbinger/mechanics/blight.ts`.
    handlerId: 'necromancer.elixir'
  },
  [ID.ELIXIR_OF_ANGUISH]: {
    quicknessCastTimeMs: 680,
    blightCost: 5,
    blightGain: 10,
    effects: [
      { type: 'strike', coefficient: 1, hits: 1 },
      // Anguish pairs enemy control with mobility; its empowered profile doubles these durations.
      { type: 'condition', condition: 'Crippled', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'quickness', stacks: 1, duration: 5 },
      { type: 'boon', boon: 'swiftness', stacks: 1, duration: 10 }
    ],
    // Custom: Materializes elixir boons, Blight, and trait-dependent ground effects; see `harbinger/mechanics/blight.ts`.
    handlerId: 'necromancer.elixir'
  },
  [ID.ELIXIR_OF_PROMISE]: {
    quicknessCastTimeMs: 680,
    blightCost: 5,
    blightGain: 10,
    effects: [
      { type: 'strike', coefficient: 0.8, hits: 1 },
      { type: 'condition', condition: 'Poisoned', stacks: 3, duration: 5 }
    ],
    // Custom: Materializes elixir boons, Blight, and trait-dependent ground effects; see `harbinger/mechanics/blight.ts`.
    handlerId: 'necromancer.elixir'
  }
});
