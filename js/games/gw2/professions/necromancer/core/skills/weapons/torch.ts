/** Canonical Core necromancer skill fragments grouped by their GW2 owner. */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

export const NECROMANCER_WEAPONS_TORCH_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.OPPRESSIVE_COLLAPSE]: {
    castTimeMs: 600,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 560, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 1.2 },
      { type: 'condition', condition: 'Torment', stacks: 2, duration: 9 },
      { type: 'control', controlKind: 'control' }
    ]),
    // Custom: Grants party Might scaled by the target's condition count; see `core/execution/torch.ts`.
    handlerId: 'necromancer.oppressive-collapse'
  },
  [ID.HARROWING_WAVE]: {
    castTimeMs: 440,
    // Share this impact's timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'cast' }, [
      { type: 'strike', coefficient: 0.8 },
      { type: 'condition', condition: 'Burning', stacks: 1, duration: 8 },
      { type: 'condition', condition: 'Torment', stacks: 2, duration: 6 }
    ]),
    lifeForceGain: 5
  }
});
