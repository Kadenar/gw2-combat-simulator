/**
 * Owns Core Ranger pet skill fragments for the Devourer family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

export const RANGER_CORE_DEVOURER_PET_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.POISONOUS_CLOUD]: {
    interruptCommitMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [1000, 2000, 3000, 4000, 5000, 6000].map((atMs) => ({
          atMs,
          coefficient: 0.2,
          weaponStrength: 2880,
          independentSummonStrike: true,
          summonUsesProfessionModifiers: true,
          summonInheritsAttributes: true,
          summonInheritsCriticalAttributes: true
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        source: 'ranger-pet',
        actorType: 'player'
      },
      {
        // EVTC attributes both the command strike and its poison applications
        // to the Ranger even though the active Devourer executes the command.
        type: 'condition',
        ticks: [1000, 2000, 3000, 4000, 5000, 6000].map((atMs) => ({
          atMs,
          condition: 'Poisoned',
          stacks: 1,
          duration: 6
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        source: 'ranger',
        actorType: 'player'
      }
    ],
    // Match the commanded pet animation measured in the benchmark EVTC.
    quicknessCastTimeMs: 1800,
    comboFields: [
      {
        ownerId: 'ranger',
        fieldType: 'Poison',
        duration: 5,
        // The five-second field runs from the first fixed pulse through the sixth.
        startMs: 1000,
        startAnchor: 'castStart'
      }
    ],
    petSkill: true
  },
  [ID.REGENERATE]: {
    effects: [
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 15,
        stacks: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.POISON_CLOUD_ID_12702]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.2,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 1,
        duration: 2,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.POISON_BARBS]: {
    effects: [
      {
        type: 'strike',
        coefficient: 0.65,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 4,
        duration: 6,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 1667,
    petSkill: true
  },
  [ID.LASHTAIL_VENOM]: {
    effects: [],
    quicknessCastTimeMs: 333,
    petSkill: true
  },
  [ID.RENDING_BARBS]: {
    effects: [
      {
        type: 'strike',
        coefficient: 1.7999999999999998,
        hits: 6,
        atMs: 0,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 6,
        duration: 8,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 2667,
    petSkill: true
  },
  [ID.TWIN_DARTS]: {
    interruptCommitMs: 0,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 840, coefficient: 0.15 },
          { atMs: 920, coefficient: 0.15 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        source: 'ranger-pet',
        actorType: 'summon',
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        // Each projectile applies the tooltip's two Bleeding stacks.
        type: 'condition',
        ticks: [840, 920].map((atMs) => ({
          atMs,
          condition: 'Bleeding',
          stacks: 2,
          duration: 2
        })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ],
    quicknessCastTimeMs: 880,
    petSkill: true
  },
  [ID.PET_TAIL_LASH]: {
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 1280, coefficient: 0.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'control',
        atMs: 1280,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        source: 'ranger-pet',
        actorType: 'summon',
        controlKind: 'knockback'
      }
    ],
    quicknessCastTimeMs: 1280,
    petSkill: true
  }
});
