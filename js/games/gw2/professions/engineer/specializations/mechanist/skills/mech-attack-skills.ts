import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
/**
 * Owns Mechanist autonomous, triggered, and supplemental mech attack identities.
 * User-issued mech commands and their cast-lane rules live in `mech-command-skills.ts`.
 */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

/** Measured basic animations and pre-aftercast impacts use explicit base/Quickness timings for replay and autonomous attacks. */
export const MECHANIST_MECH_ATTACK_SKILL_MECHANICS: Readonly<Record<string, Partial<Skill>>> = Object.freeze({
  [ID.AERIAL_SUPPORT]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Aerial Support',
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.ROCKET_PUNCH_MECH]: {
    castTimeMs: 500,
    quicknessCastTimeMs: 360,
    cooldown: 5,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Rocket Punch (Mech)',
        actorType: ACTOR.SUMMON,
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 1,
        duration: 5,
        actorType: ACTOR.SUMMON
      },
      {
        type: 'control',
        actorType: ACTOR.SUMMON,
        controlKind: CONTROL.STUN
      }
    ]
  },
  [ID.HEAVY_SMASH_MECH]: {
    castTimeMs: 1000,
    quicknessCastTimeMs: 680,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1,
        name: 'Heavy Smash (Mech)',
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  [ID.JADE_ENERGY_SHOT]: {
    castTimeMs: 480,
    quicknessCastTimeMs: 320,
    cooldown: 0,
    // The first arm lands at the end of its windup, then immediately starts the second arm.
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', name: 'Jade Energy Shot', coefficient: 0.42, hits: 1, actorType: ACTOR.SUMMON }
    ])
  },
  [ID.TWIN_STRIKE_MECH]: {
    castTimeMs: 1520,
    quicknessCastTimeMs: 1040,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        // Both arms form one damaging strike, so critical and on-hit reactions get one opportunity.
        coefficient: 0.8,
        hits: 1,
        name: 'Twin Strike (Mech)',
        atMs: 520,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  [ID.HARD_STRIKE]: {
    castTimeMs: 480,
    quicknessCastTimeMs: 320,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.45,
        hits: 1,
        name: 'Hard Strike',
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: ACTOR.SUMMON
      }
    ]
  },
  [ID.JADE_ENERGY_SHOT_ID_63348]: {
    castTimeMs: 1000,
    quicknessCastTimeMs: 680,
    cooldown: 0,
    // The second arm hits early but retains its remaining animation before another pair can start.
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', name: 'Jade Energy Shot', coefficient: 0.42, hits: 1, actorType: ACTOR.SUMMON }
    ])
  },
  [ID.JADE_BUSTER_CANNON]: {
    simulatorExcluded: true,
    // The cannon owns its burst schedule and the lane duration used by Overclock and replay.
    castTimeMs: 5040,
    quicknessCastTimeMs: 3360,
    cooldown: 1,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 880 + index * 360, coefficient: 4.75 / 5 })),
        name: 'Jade Buster Cannon',
        actorType: ACTOR.SUMMON
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: 880 + index * 360,
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 6
        })),
        actorType: ACTOR.SUMMON
      }
    ]),
    toolbeltParentId: ID.OVERCLOCK_SIGNET
  }
});
