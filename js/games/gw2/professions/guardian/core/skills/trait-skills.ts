import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

import { impactEffects, strikeTimeline } from '#gw2/platform/effects/authoring.js';

/** Invoked skills own their payloads and recharge; fixed pulse timelines preserve their independent impact timing. */
export const GUARDIAN_CORE_TRAIT_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.LESSER_SYMBOL_OF_BLADES,
    name: 'Lesser Symbol of Blades',
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    castTimeMs: 0,
    cooldown: 10,
    duration: 4,
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      strikeTimeline(
        Array.from({ length: 5 }, (_, index) => ({ atMs: index * 1000, coefficient: 0.65 })),
        {
          name: 'Strike',
          actorType: 'player',
          weaponStrengthProfileId: 'nonweapon.unequipped',
          metadata: { guardianSymbol: true }
        }
      )
    ])
  },
  {
    id: ID.LESSER_SYMBOL_OF_PROTECTION,
    name: 'Lesser Symbol of Protection',
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    castTimeMs: 0,
    cooldown: 20,
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      strikeTimeline(
        Array.from({ length: 3 }, (_, index) => ({ atMs: index * 1000, coefficient: 0.6 })),
        {
          name: 'Strike',
          actorType: 'player',
          weaponStrengthProfileId: 'nonweapon.unequipped',
          metadata: { guardianSymbol: true }
        }
      ),
      {
        type: 'boon',
        audience: { recipients: 'party' },
        name: 'protection',
        boon: 'protection',
        duration: 1,
        stacks: 1,
        applications: 3,
        intervalMs: 1000
      }
    ])
  },
  {
    id: ID.LESSER_SYMBOL_OF_RESOLUTION,
    name: 'Lesser Symbol of Resolution',
    type: 'Proc',
    slot: 'Action',
    simulatorExcluded: true,
    slotSelectable: false,
    castTimeMs: 0,
    cooldown: 30,
    effects: impactEffects({ timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      strikeTimeline(
        Array.from({ length: 5 }, (_, index) => ({ atMs: index * 1000, coefficient: 0.5 })),
        {
          name: 'Strike',
          actorType: 'player',
          weaponStrengthProfileId: 'nonweapon.unequipped',
          metadata: { guardianSymbol: true }
        }
      ),
      {
        type: 'boon',
        name: 'resolution',
        boon: 'resolution',
        stacks: 1,
        duration: 2,
        applications: 5,
        intervalMs: 1000,
        actorType: 'player'
      }
    ])
  }
]);
