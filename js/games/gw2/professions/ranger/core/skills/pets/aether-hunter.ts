/**
 * Owns Core Ranger pet skill fragments for the Aether Hunter family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const RANGER_CORE_AETHER_HUNTER_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.AETHER_HUNTER_BITE]: {
    // Each basic bite inflicts its own five-second bleed, independently of critical-hit trait procs.
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.5, source: 'ranger-pet', actorType: 'summon' },
      { type: 'condition', condition: 'Bleeding', stacks: 1, duration: 5, source: 'ranger-pet', actorType: 'summon' }
    ]),
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.AETHER_HUNTER_BITE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.AETHER_HUNTER_BITE]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.AETHER_HUNTER_LUNGE]: {
    // Lunge hits early in its recovery and applies the three-second cripple observed in the log.
    effects: impactEffects({ atMs: 160, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.8, source: 'ranger-pet', actorType: 'summon' },
      { type: 'condition', condition: 'Crippled', stacks: 1, duration: 3, source: 'ranger-pet', actorType: 'summon' }
    ]),
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.AETHER_HUNTER_LUNGE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.AETHER_HUNTER_LUNGE]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.AETHER_HUNTER_LEY_LINE_VORTEX]: {
    // The pet channels five paired strikes and torment applications; retirement cancels the remaining channel.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [0, 680, 1360, 2000, 2680].map((atMs) => ({ atMs, coefficient: 0.5 })),
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: [0, 680, 1360, 2000, 2680].map((atMs) => ({ atMs, condition: 'Torment', stacks: 1, duration: 8 })),
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ]),
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.AETHER_HUNTER_LEY_LINE_VORTEX]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.AETHER_HUNTER_LEY_LINE_VORTEX]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.DIMENSION_BREACH]: {
    // Breach's launch accompanies its resurfacing strike before the pet can resume basic attacks.
    // Retain the API coefficient: the unquickened sample's lower damage does not isolate a scaling change.
    effects: impactEffects({ atMs: 880, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.7,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      { type: 'control', controlKind: 'launch', source: 'ranger-pet', actorType: 'summon' }
    ]),
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.DIMENSION_BREACH]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.DIMENSION_BREACH]!.quicknessCastTimeMs,
    petSkill: true
  }
});
