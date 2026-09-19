/**
 * Owns Core Ranger pet skill fragments for the Fanged Iboga family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

// Share adjacent impact timing while preserving local payloads, attribution, and independent timelines.
export const RANGER_CORE_FANGED_IBOGA_PET_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.FANG_GRAPPLE]: {
    effects: impactEffects({ atMs: 1040, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.2,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Immobilized',
        stacks: 1,
        duration: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'control',
        source: 'ranger-pet',
        actorType: 'summon',
        controlKind: 'pull'
      }
    ]),
    quicknessCastTimeMs: 1000,
    petSkill: true
  },
  [ID.CONSUMING_BITE]: {
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 0.45 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 480,
    petSkill: true
  },
  [ID.CRIPPLING_ANGUISH_PET]: {
    effects: impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.3,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Confusion',
        stacks: 4,
        duration: 8,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Torment',
        stacks: 3,
        duration: 10,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ]),
    quicknessCastTimeMs: 600,
    petSkill: true
  },
  [ID.NARCOTIC_SPORES_PET]: {
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [720, 1720, 2720, 3720, 4720, 5720].map((atMs) => ({
          atMs,
          coefficient: 0.1
        })),
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: [720, 1720, 2720, 3720, 4720, 5720].map((atMs) => ({
          atMs,
          condition: 'Confusion',
          stacks: 1,
          duration: 8
        })),
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ]),
    quicknessCastTimeMs: 720,
    comboFields: [
      {
        ownerId: 'ranger',
        fieldType: 'Ethereal',
        duration: 6,
        startAnchor: 'castEnd'
      }
    ],
    petSkill: true
  }
});
