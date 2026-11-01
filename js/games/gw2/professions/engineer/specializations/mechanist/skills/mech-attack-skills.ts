/**
 * Owns Mechanist autonomous and triggered mech attack identities.
 * User-issued mech commands and their cast-lane rules live in `mech-command-skills.ts`.
 */
import { ACTOR, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';

/** Measured basic animations and pre-aftercast impacts use explicit base/Quickness timings for replay and autonomous attacks. */
export const MECHANIST_MECH_ATTACK_SKILL_MECHANICS: Readonly<Record<string, SkillDefinition>> = Object.freeze({
  [ID.AERIAL_SUPPORT]: {
    name: 'Aerial Support',
    description: '...',
    icon: 'https://render.guildwars2.com/file/3C2B5C060DA920011A20ACDB96DB155D4BDE2A04/103434.png',
    type: 'Action',
    slot: 'Action',

    cooldown: 0,
    castTimeMs: 0,
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
    name: 'Rocket Punch (Mech)',
    description:
      'Your mech launches an explosive fist that detonates on hit, dealing defiance damage to enemies with active defiance bars. This skill is only used when you activate Skill 3 on your weapon.',
    icon: 'https://render.guildwars2.com/file/02DA2C9899B63DE522020824C67D05951F40CA4A/2503679.png',
    type: 'Action',
    slot: 'Action',

    cooldown: 5,
    castTimeMs: 500,
    quicknessCastTimeMs: 360,
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
    name: 'Heavy Smash (Mech)',
    description: 'Perform a second, powerful strike.',
    icon: new URL('@images/wiki/heavy-smash-mech.png', import.meta.url).href,
    type: 'Profession',
    slot: 'Action',

    cooldown: 0,
    castTimeMs: 1000,
    quicknessCastTimeMs: 680,
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
    name: 'Jade Energy Shot',
    description: '...',
    icon: 'https://render.guildwars2.com/file/73600241FA662501C5D617719A7B4792F30B2846/2503622.png',
    type: 'Profession',
    slot: 'Action',

    cooldown: 0,
    castTimeMs: 480,
    quicknessCastTimeMs: 320,
    // The first arm lands at the end of its windup, then immediately starts the second arm.
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', name: 'Jade Energy Shot', coefficient: 0.42, hits: 1, actorType: ACTOR.SUMMON }
    ])
  },
  [ID.TWIN_STRIKE_MECH]: {
    name: 'Twin Strike (Mech)',
    description: 'Strikes foes in front of you.',
    icon: new URL('@images/wiki/twin-strike-mech.png', import.meta.url).href,
    type: 'Profession',
    slot: 'Action',

    cooldown: 0,
    castTimeMs: 1520,
    quicknessCastTimeMs: 1040,
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
    name: 'Hard Strike',
    description: 'Strikes foes in front of you.',
    icon: new URL('@images/wiki/hard-strike.png', import.meta.url).href,
    type: 'Profession',
    slot: 'Action',

    cooldown: 0,
    castTimeMs: 480,
    quicknessCastTimeMs: 320,
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
    name: 'Jade Energy Shot',
    description: '...',
    icon: 'https://render.guildwars2.com/file/73600241FA662501C5D617719A7B4792F30B2846/2503622.png',
    type: 'Profession',
    slot: 'Action',

    cooldown: 0,
    castTimeMs: 1000,
    quicknessCastTimeMs: 680,
    // The second arm hits early but retains its remaining animation before another pair can start.
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      { type: 'strike', name: 'Jade Energy Shot', coefficient: 0.42, hits: 1, actorType: ACTOR.SUMMON }
    ])
  },
  [ID.JADE_BUSTER_CANNON]: {
    name: 'Jade Buster Cannon',
    description:
      'Fire the main cannon, obliterating targets in a line. The mech may swivel to track targets while firing the jade buster cannon, but it is unable to move.',
    icon: 'https://render.guildwars2.com/file/6493C9915A90E449EFE30323233F960B68C1BDF9/1770418.png',
    type: 'Elite',
    slot: 'Elite',
    simulatorExcluded: true,
    cooldown: 1,
    toolbeltParentId: ID.OVERCLOCK_SIGNET,
    // The cannon owns its burst schedule and the lane duration used by Overclock and replay.
    castTimeMs: 5040,
    quicknessCastTimeMs: 3360,
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
    ])
  }
});
