import { BOON } from '#gw2/platform/effects/boons.js';
import { CONDITION } from '#gw2/platform/effects/conditions.js';
/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { rangerMerged } from '#gw2/professions/ranger/core/state.js';

export const RANGER_CORE_STAFF_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.SUBLIME_CONVERSION]: {
    effects: [
      {
        type: 'boon',
        audience: { recipients: 'party' as const, maximumRecipients: 5 },
        boon: BOON.REGENERATION,
        duration: 5,
        stacks: 1
      }
    ],
    castTimeMs: 333
  },
  [ID.ANCESTRAL_GRACE]: {
    // Beastmode transfers the pet's protection entitlement to the merged ranger.
    effectVariants: [
      {
        when: (runtime) => rangerMerged(runtime.profession),
        transform: (_runtime, _cast, effects) =>
          effects.map((effect) =>
            effect.type === 'boon' ? { ...effect, audience: { recipients: 'self' as const } } : effect
          )
      }
    ],
    effects: [
      {
        type: 'boon',
        audience: { recipients: 'summons' as const, affectsSelf: false, maximumRecipients: 1 },
        boon: BOON.PROTECTION,
        duration: 3,
        stacks: 1
      }
    ],
    castTimeMs: 833
  },
  [ID.VINE_SURGE]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1
      },
      // Each target is immobilized once by the advancing vines (wiki: Vine_Surge, PvE).
      { type: 'condition', condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 1.5 }
    ],
    castTimeMs: 500
  },
  [ID.SOLAR_BEAM]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    effects: [
      {
        type: 'strike',
        coefficient: 0.3,
        hits: 1
      }
    ],
    castTimeMs: 833
  },
  [ID.ASTRAL_WISP]: {
    effects: [],
    castTimeMs: 333
  }
});
