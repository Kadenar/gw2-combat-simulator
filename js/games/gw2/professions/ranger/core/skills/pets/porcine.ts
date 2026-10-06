/**
 * Owns Core Ranger pet skill fragments for the Porcine family.
 * Pet identity and family membership remain in `data/ranger-pet-data.ts`.
 */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { RANGER_PET_SKILL_TIMINGS } from '#gw2/professions/ranger/core/mechanics/pet-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const RANGER_CORE_PORCINE_PET_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.PORCINE_JAB]: {
    // The tusk impact precedes recovery; pet ownership supplies independent stats and swap cancellation.
    effects: impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.41, source: 'ranger-pet', actorType: 'summon' }
    ]),
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PORCINE_JAB]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PORCINE_JAB]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.PORCINE_MAUL]: {
    // Both contacts apply two bleeds each; Quickness does not accelerate the measured Maul animation.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [600, 600].map((atMs) => ({ atMs, coefficient: 0.33 })),
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: [600, 600].map((atMs) => ({ atMs, condition: 'Bleeding', stacks: 2, duration: 6 })),
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ]),
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PORCINE_MAUL]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PORCINE_MAUL]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.PORCINE_BRUTAL_CHARGE]: {
    // Quickness leaves the charge unchanged; its leap and knockdown resolve with the landed strike.
    effects: impactEffects({ atMs: 1080, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.67,
        comboFinishers: [
          { ownerId: 'ranger', ownerActorType: 'summon', finisherType: 'Leap', ambiguousFieldSelection: 'oldest' }
        ],
        source: 'ranger-pet',
        actorType: 'summon'
      },
      { type: 'control', controlKind: 'knockdown', source: 'ranger-pet', actorType: 'summon' }
    ]),
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PORCINE_BRUTAL_CHARGE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.PORCINE_BRUTAL_CHARGE]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.VAMPIRIC_BITE]: {
    // The bite can crit; its healing does not add a separate life-siphon damage packet.
    effects: impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', coefficient: 0.42, source: 'ranger-pet', actorType: 'summon' }
    ]),
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.VAMPIRIC_BITE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.VAMPIRIC_BITE]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.WALLOW_MAUL]: {
    // Both hits land together, each applying two bleeding stacks.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: [680, 680].map((atMs) => ({ atMs, coefficient: 0.33 })),
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: [680, 680].map((atMs) => ({ atMs, condition: 'Bleeding', stacks: 2, duration: 6 })),
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ]),
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WALLOW_MAUL]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.WALLOW_MAUL]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.UNDEAD_PLAGUE_PET]: {
    interruptCommitMs: 640,
    // Once released, the cloud retains its pet owner and one-second pulses while the pet resumes attacking.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [640, 1640, 2640, 3640, 4640].map((atMs) => ({ atMs, coefficient: 0.2 })),
        // Register the field at the actual first impact, including the pet's current action rate.
        comboFields: [{ ownerId: 'ranger', ownerActorType: 'summon', fieldType: 'Poison', duration: 5 }],
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: [640, 1640, 2640, 3640, 4640].map((atMs) => ({ atMs, condition: 'Poisoned', stacks: 1, duration: 4 })),
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ]),
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.UNDEAD_PLAGUE_PET]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.UNDEAD_PLAGUE_PET]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.FORAGE_ROCK]: {
    // Foraging occupies the pet lane but creates no direct damage; picked-up bundle skills belong to the player.
    effects: [],
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FORAGE_ROCK]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.FORAGE_ROCK]!.quicknessCastTimeMs,
    petSkill: true
  },
  [ID.FORAGE_SCALE]: {
    effects: [],
    quicknessCastTimeMs: 667,
    petSkill: true
  },
  [ID.FORAGE_FEATHERS]: {
    effects: [],
    quicknessCastTimeMs: 667,
    petSkill: true
  },
  [ID.FORAGE_SWORD]: {
    effects: [],
    quicknessCastTimeMs: 667,
    petSkill: true
  },
  [ID.BLOODTHIRSTY_CHARGE]: {
    // The strike, bleed, and knockback land together before the charge's recovery finishes.
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 2,
        duration: 8,
        source: 'ranger-pet',
        actorType: 'summon'
      },
      {
        type: 'control',
        controlKind: 'knockback',
        source: 'ranger-pet',
        actorType: 'summon'
      }
    ]),
    castTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BLOODTHIRSTY_CHARGE]!.castTimeMs,
    quicknessCastTimeMs: RANGER_PET_SKILL_TIMINGS[ID.BLOODTHIRSTY_CHARGE]!.quicknessCastTimeMs,
    petSkill: true
  }
});
