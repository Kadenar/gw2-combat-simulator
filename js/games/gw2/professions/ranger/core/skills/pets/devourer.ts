import { ACTOR, COMBO_FIELD, COMBO_FINISHER, CONTROL, CONDITION } from '#gw2/platform/constants.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-skill-timings.js';
/**
 * Owns Core Ranger pet skill fragments for the Devourer family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// CAdruid's opener lands 1,162 ms after the pet starts casting; use 1,160 ms as the fixed travel approximation.
const POISONOUS_CLOUD_PULSE_TIMES_MS = [1160, 2160, 3160, 4160, 5160, 6160];

// Share adjacent impact timing while preserving local payloads, attribution, and independent timelines.
export const RANGER_CORE_DEVOURER_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.POISONOUS_CLOUD]: {
    // In-game bug: both strikes and poison use Ranger stats instead of pet stats; preserve that behavior.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: POISONOUS_CLOUD_PULSE_TIMES_MS.map((atMs) => ({
          atMs,
          coefficient: 0.2,
          weaponStrength: 2880,
          independentSummonStrike: true,
          summonUsesProfessionModifiers: true,
          summonInheritsAttributes: true,
          summonInheritsCriticalAttributes: true
        })),
        source: 'ranger-pet',
        actorType: ACTOR.PLAYER
      },
      {
        // EVTC attributes both the command strike and its poison applications
        // to the Ranger even though the active Devourer executes the command.
        type: 'condition',
        ticks: POISONOUS_CLOUD_PULSE_TIMES_MS.map((atMs) => ({
          atMs,
          condition: CONDITION.POISONED,
          stacks: 1,
          duration: 6
        })),
        source: 'ranger',
        actorType: ACTOR.PLAYER
      }
    ]),
    // The unquickened pet animation occupies 1.8 s
    castTimeMs: 1800,
    quicknessCastTimeMs: 1800,
    comboFields: [
      {
        ownerId: 'ranger',
        fieldType: COMBO_FIELD.POISON,
        duration: 5,
        // The five-second field runs from the first fixed pulse through the sixth.
        startMs: POISONOUS_CLOUD_PULSE_TIMES_MS[0],
        startAnchor: 'castStart'
      }
    ],
    petSkill: true
  },
  [ID.POISON_BARBS]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.65,
        hits: 1,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 4,
        duration: 6,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ],
    quicknessCastTimeMs: 1667,
    petSkill: true
  },
  [ID.RENDING_BARBS]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 6,
        atMs: 0,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 6,
        duration: 8,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ],
    quicknessCastTimeMs: 2667,
    petSkill: true
  },
  [ID.TWIN_DARTS]: {
    // An interrupted autonomous windup must cancel its pending darts and their conditions together.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [840, 920].map((atMs) => ({ atMs, coefficient: 0.15 })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 0.2
          }
        ]
      },
      {
        // Each projectile applies one full four-second bleed; Arachnophobia's pet expertise extends it to five.
        type: 'condition',
        ticks: [840, 920].map((atMs) => ({
          atMs,
          condition: CONDITION.BLEEDING,
          stacks: 1,
          duration: 4
        })),
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      }
    ]),
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.TWIN_DARTS]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.PET_TAIL_LASH]: {
    effects: impactEffects({ atMs: 1280, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.5,
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'control',
        source: 'ranger-pet',
        actorType: ACTOR.SUMMON,
        controlKind: CONTROL.KNOCKBACK
      }
    ]),
    quicknessCastTimeMs: 1280,
    petSkill: true
  }
});
