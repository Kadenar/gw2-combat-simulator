import { impactEffects, strikeTimeline } from '#gw2/platform/effects/authoring.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

/** Invoked skills own their payloads and recharge; fixed pulse timelines preserve their independent impact timing. */
export const MESMER_CORE_TRAIT_SKILLS: readonly MesmerSkill[] = [
  {
    name: 'Lesser Chaos Storm',
    icon: 'https://render.guildwars2.com/file/B741282BD5EE93C9FC43AE417878953D50BB3974/103156.png',
    id: ID.LESSER_CHAOS_STORM,
    type: 'Proc',
    slot: 'Action',
    rotationInputExcluded: true,
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
];
