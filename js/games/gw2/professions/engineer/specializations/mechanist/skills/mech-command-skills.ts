/**
 * Owns user-issued mech command skill definitions.
 * Persistent mech state and autonomous behavior remain under `mechanics/mech.ts`.
 */
import { ACTOR, BOON, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { MechanistSkill } from '#gw2/professions/engineer/specializations/mechanist/types.js';

// F1-F3 commands execute on the mech's own serial cast lane so their animations
// can overlap the engineer without allowing non-instant mech commands to overlap.
function mechCommand(fragment: Partial<SkillDefinition<MechanistSkill>>): Partial<SkillDefinition<MechanistSkill>> {
  const instant = (fragment.castTimeMs || 0) === 0 && fragment.quicknessCastTimeMs == null;
  return {
    ...fragment,
    // Mech commands retain the Tools interactions of the replaced tool-belt slots.
    countsAsToolbeltSkill: true,
    independentCast: true,
    ...(instant ? { independentCastCanOverlap: true } : {})
  };
}

/** Explicit base/Quickness pairs retain measured aftercasts, including commands that Quickness does not accelerate. */
export const MECHANIST_MECH_COMMAND_SKILL_MECHANICS: Readonly<Record<string, SkillDefinition<MechanistSkill>>> = {
  [ID.JADE_MORTAR]: {
    name: 'Jade Mortar',
    icon: 'https://render.guildwars2.com/file/BB3491B513007BC7109250054CC003B408E46D01/2503684.png',
    type: 'Profession',
    slot: 'Profession_3',

    ...mechCommand({
      // Issuing the command starts recharge even though the mech remains busy
      // on its independent lane for the measured animation.
      rechargeAnchor: 'castStart',
      cooldown: 20,
      mechanicSlot: 3,
      quicknessCastTimeMs: 1080,
      // Share one impact timing while preserving independent payloads and declaration order.
      effects: impactEffects({ atMs: 600, timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          type: 'strike',
          coefficient: 2.2,
          hits: 1,
          name: 'Jade Mortar',
          actorType: ACTOR.SUMMON
        },
        {
          type: 'condition',
          condition: CONDITION.BURNING,
          stacks: 3,
          duration: 6,
          actorType: ACTOR.SUMMON
        },
        {
          type: 'control',
          actorType: ACTOR.SUMMON,
          controlKind: CONTROL.DAZE
        }
      ])
    })
  },
  [ID.BARRIER_BURST]: {
    name: 'Barrier Burst',
    icon: 'https://render.guildwars2.com/file/BAF5BED745DABF5112014A7E2F5E29645FDBA6D3/2503685.png',
    type: 'Profession',
    slot: 'Profession_3',

    ...mechCommand({
      cooldown: 30,
      mechanicSlot: 3,
      // Reserve the entire observed channel so autonomous melee attacks cannot run between barrier pulses.
      castTimeMs: 4440,
      quicknessCastTimeMs: 4440,
      // Barrier and both boons pulse together; recipient resolution grants the mech its separate entitlement.
      effects: (
        [
          {
            type: 'buff',
            kind: 'barrier',
            duration: 5,
            stacks: 1
          },
          {
            type: 'boon',
            boon: BOON.MIGHT,
            duration: 20,
            stacks: 2
          },
          {
            type: 'boon',
            boon: BOON.FURY,
            duration: 3,
            stacks: 1
          }
        ] as const
      ).map((effect) => ({
        ...effect,
        actorType: ACTOR.SUMMON,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        applications: 5,
        atMs: 0,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }))
    })
  },
  [ID.SPARK_REVOLVER]: {
    name: 'Spark Revolver',
    icon: 'https://render.guildwars2.com/file/5F4E2699CF2750EA912E4D1303EB1EDF6AE30C3F/2503680.png',
    type: 'Profession',
    slot: 'Profession_1',

    ...mechCommand({
      rechargeAnchor: 'castStart',
      cooldown: 20,
      mechanicSlot: 1,
      castTimeMs: 2040,
      quicknessCastTimeMs: 1400,
      effects: [
        {
          type: 'strike',
          // Both arms hit together; the last projectiles land after the animation ends.
          ticks: [1000, 1200, 1440, 1680, 1920, 2160].flatMap((atMs) => [
            { atMs, coefficient: 0.176 },
            { atMs, coefficient: 0.176 }
          ]),
          timingAnchor: 'castStart',
          timingScale: 'fixed',
          name: 'Spark Revolver',
          actorType: ACTOR.SUMMON
        }
      ]
    })
  },
  [ID.SKY_CIRCUS]: {
    name: 'Sky Circus',
    icon: 'https://render.guildwars2.com/file/F5B22BC2DCE815FD124A1B25646606633A68D1F5/2503686.png',
    type: 'Profession',
    slot: 'Profession_3',

    ...mechCommand({
      cooldown: 30,
      mechanicSlot: 3,
      // The jump and landing retain the same timings with and without Quickness.
      castTimeMs: 2120,
      quicknessCastTimeMs: 2120,
      effects: [
        // Missiles carry Burning; the separate landing impact owns the knockback.
        ...impactEffects({ atMs: 0, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
          {
            type: 'strike',
            // One missile per nearby foe; "targets per missile: 3" is its cleave cap.
            coefficient: 0.6,
            hits: 1,
            name: 'Missile Damage',
            actorType: ACTOR.SUMMON
          },
          { type: 'condition', condition: CONDITION.BURNING, stacks: 1, duration: 5, actorType: ACTOR.SUMMON }
        ]),
        ...impactEffects({ atMs: 1320, timingAnchor: 'castStart', timingScale: 'fixed' }, [
          { type: 'strike', coefficient: 1.2, hits: 1, name: 'Landing Damage', actorType: ACTOR.SUMMON },
          { type: 'control', actorType: ACTOR.SUMMON, controlKind: CONTROL.KNOCKBACK }
        ])
      ]
    })
  },
  [ID.CRISIS_ZONE]: {
    name: 'Crisis Zone',
    icon: 'https://render.guildwars2.com/file/157891E17AB0EC5703BC5AF19F7A0E0CA27105A1/2503675.png',
    type: 'Profession',
    slot: 'Profession_2',

    ...mechCommand({
      cooldown: 30,
      mechanicSlot: 2,
      castTimeMs: 0,
      effects: [
        {
          type: 'boon',
          audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
          boon: BOON.AEGIS,
          duration: 3,
          stacks: 1
        },
        {
          type: 'boon',
          audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
          boon: BOON.STABILITY,
          duration: 6,
          stacks: 1
        },
        {
          type: 'boon',
          audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
          boon: BOON.PROTECTION,
          duration: 6,
          stacks: 1
        },
        {
          type: 'boon',
          audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
          boon: BOON.ALACRITY,
          duration: 6,
          stacks: 1
        }
      ]
    })
  },
  [ID.ROLLING_SMASH]: {
    name: 'Rolling Smash',
    icon: 'https://render.guildwars2.com/file/043E0C37A34EB862D81B3902EC7660392FE9D922/2503678.png',
    type: 'Profession',
    slot: 'Profession_1',

    ...mechCommand({
      cooldown: 20,
      mechanicSlot: 1,
      // The mech remains occupied through the full slam animation before restarting its basic chain.
      castTimeMs: 1520,
      quicknessCastTimeMs: 1520,
      effects: impactEffects({ atMs: 720, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 1.6,
          hits: 1,
          name: 'Rolling Smash',
          actorType: ACTOR.SUMMON
        },
        {
          type: 'condition',
          condition: CONDITION.BLEEDING,
          stacks: 4,
          duration: 8,
          actorType: ACTOR.SUMMON
        }
      ])
    })
  },
  [ID.CORE_REACTOR_SHOT]: {
    name: 'Core Reactor Shot',
    icon: 'https://render.guildwars2.com/file/7D28F26BB09378C256BAAE2F90DA1F3D6B5CCB71/2503683.png',
    type: 'Profession',
    slot: 'Profession_2',

    ...mechCommand({
      rechargeAnchor: 'castStart',
      cooldown: 25,
      mechanicSlot: 2,
      castTimeMs: 1440,
      quicknessCastTimeMs: 1000,
      // Use the close-range impact; explicit impact delays can account for additional projectile travel.
      effects: impactEffects({ atMs: 840, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 2.5,
          hits: 1,
          name: 'Core Reactor Shot',
          actorType: ACTOR.SUMMON
        },
        {
          type: 'control',
          actorType: ACTOR.SUMMON,
          controlKind: CONTROL.LAUNCH
        }
      ])
    })
  },
  [ID.EXPLOSIVE_KNUCKLE]: {
    name: 'Explosive Knuckle',
    icon: 'https://render.guildwars2.com/file/02DA2C9899B63DE522020824C67D05951F40CA4A/2503679.png',
    type: 'Profession',
    slot: 'Profession_1',

    ...mechCommand({
      cooldown: 15,
      mechanicSlot: 1,
      castTimeMs: 1520,
      quicknessCastTimeMs: 1520,
      effects: impactEffects({ atMs: 640, timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          coefficient: 1.8,
          hits: 1,
          name: 'Explosive Knuckle',
          actorType: ACTOR.SUMMON,
          damageKind: 'explosion'
        },
        {
          type: 'condition',
          condition: CONDITION.WEAKNESS,
          stacks: 1,
          duration: 5,
          actorType: ACTOR.SUMMON
        }
      ])
    })
  },
  [ID.DISCHARGE_ARRAY]: {
    name: 'Discharge Array',
    icon: 'https://render.guildwars2.com/file/604109FCDFB65446F2274106E7C113F75B111345/2503681.png',
    type: 'Profession',
    slot: 'Profession_2',

    ...mechCommand({
      cooldown: 30,
      mechanicSlot: 2,
      castTimeMs: 0,
      // The charged armor begins pulsing one second after activation; all conditions share its damage pulse.
      effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
        {
          type: 'strike',
          ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: (index + 1) * 1000, coefficient: 1.5 / 5 })),
          name: 'Discharge Array',
          actorType: ACTOR.SUMMON
        },
        {
          type: 'condition',
          ticks: Array.from({ length: 5 }, (_, index) => ({
            atMs: (index + 1) * 1000,
            condition: CONDITION.SLOW,
            stacks: 1,
            duration: 2
          })),
          actorType: ACTOR.SUMMON
        },
        {
          type: 'condition',
          ticks: Array.from({ length: 5 }, (_, index) => ({
            atMs: (index + 1) * 1000,
            condition: CONDITION.CONFUSION,
            stacks: 2,
            duration: 3
          })),
          actorType: ACTOR.SUMMON
        },
        {
          type: 'condition',
          ticks: Array.from({ length: 5 }, (_, index) => ({
            atMs: (index + 1) * 1000,
            condition: CONDITION.BURNING,
            stacks: 1,
            duration: 3
          })),
          actorType: ACTOR.SUMMON
        }
      ])
    })
  }
};
