import { ACTOR, CONTROL, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
/**
 * Owns user-issued mech command skill fragments.
 * Persistent mech state and autonomous behavior remain under `mechanics/mech.ts`.
 */
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

// F1-F3 commands execute on the mech's own serial cast lane so their animations
// can overlap the engineer without allowing non-instant mech commands to overlap.
function mechCommand(fragment: Partial<Skill>): Partial<Skill> {
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
export const MECHANIST_MECH_COMMAND_SKILL_MECHANICS: Readonly<Record<string, Partial<Skill>>> = Object.freeze({
  [ID.JADE_MORTAR]: mechCommand({
    quicknessCastTimeMs: 1080,
    // Issuing the command starts recharge even though the mech remains busy
    // on its independent lane for the measured animation.
    rechargeAnchor: 'castStart',
    cooldown: 20,
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
    ]),
    mechanicSlot: 3
  }),
  [ID.BARRIER_BURST]: mechCommand({
    // Reserve the entire observed channel so autonomous melee attacks cannot run between barrier pulses.
    castTimeMs: 4440,
    quicknessCastTimeMs: 4440,
    cooldown: 30,
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
    })),
    mechanicSlot: 3
  }),
  [ID.SPARK_REVOLVER]: mechCommand({
    castTimeMs: 2040,
    quicknessCastTimeMs: 1400,
    rechargeAnchor: 'castStart',
    cooldown: 20,
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
    ],
    mechanicSlot: 1
  }),
  [ID.SKY_CIRCUS]: mechCommand({
    // The jump and landing retain the same timings with and without Quickness.
    castTimeMs: 2120,
    quicknessCastTimeMs: 2120,
    cooldown: 30,
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
    ],
    mechanicSlot: 3
  }),
  [ID.CRISIS_ZONE]: mechCommand({
    castTimeMs: 0,
    cooldown: 30,
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
    ],
    mechanicSlot: 2
  }),
  [ID.ROLLING_SMASH]: mechCommand({
    // The mech remains occupied through the full slam animation before restarting its basic chain.
    castTimeMs: 1520,
    quicknessCastTimeMs: 1520,
    cooldown: 20,
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
    ]),
    mechanicSlot: 1
  }),
  [ID.CORE_REACTOR_SHOT]: mechCommand({
    castTimeMs: 1440,
    quicknessCastTimeMs: 1000,
    rechargeAnchor: 'castStart',
    cooldown: 25,
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
    ]),
    mechanicSlot: 2
  }),
  [ID.EXPLOSIVE_KNUCKLE]: mechCommand({
    castTimeMs: 1520,
    quicknessCastTimeMs: 1520,
    cooldown: 15,
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
    ]),
    mechanicSlot: 1
  }),
  [ID.DISCHARGE_ARRAY]: mechCommand({
    castTimeMs: 0,
    cooldown: 30,
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
    ]),
    mechanicSlot: 2
  })
});
