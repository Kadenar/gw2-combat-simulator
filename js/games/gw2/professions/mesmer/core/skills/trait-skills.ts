import { impactEffects, strikeTimeline } from '#gw2/platform/effects/authoring.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

/** Invoked skills own their payloads and recharge; fixed pulse timelines preserve their independent impact timing. */
export const MESMER_CORE_TRAIT_SKILLS: readonly MesmerSkill[] = Object.freeze([
  {
    name: 'Lesser Chaos Storm',
    id: ID.LESSER_CHAOS_STORM,
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    cooldown: 28,
    castTimeMs: 0,
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      strikeTimeline(
        Array.from({ length: 6 }, (_, index) => ({ atMs: index * 1000, coefficient: 0.33 })),
        { name: 'Strike', weaponStrengthProfileId: 'nonweapon.unequipped' }
      )
    ])
  }
]);
