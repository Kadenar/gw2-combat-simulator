/**
 * Owns user-issued mech command skill fragments.
 * Persistent mech state and autonomous behavior remain under `mechanics/mech.ts`.
 */
import { impactEffects } from '#gw2/platform/engine/effects/factories.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';
import { MECHANIST_COMMAND_DURATIONS } from '#gw2/professions/engineer/specializations/mechanist/mechanics/constants.js';

// F1-F3 commands execute on the mech's own serial cast lane so their animations
// can overlap the engineer without allowing non-instant mech commands to overlap.
function mechCommand(fragment: SkillFragment): SkillFragment {
  const instant = Number(fragment.castTimeMs || 0) === 0 && fragment.quicknessCastTimeMs == null;
  return {
    ...fragment,
    // Mech commands retain the Tools interactions of the replaced tool-belt slots.
    countsAsToolbeltSkill: true,
    independentCast: true,
    ...(instant ? { independentCastCanOverlap: true } : {})
  };
}

/** Supplies command fragments and their independent cast-lane metadata. */
export const MECHANIST_MECH_COMMAND_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  [ID.JADE_MORTAR]: mechCommand({
    quicknessCastTimeMs: MECHANIST_COMMAND_DURATIONS[ID.JADE_MORTAR] * 1000,
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
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 3,
        duration: 6,
        actorType: 'summon'
      },
      {
        type: 'control',
        actorType: 'summon',
        controlKind: 'daze'
      }
    ]),
    mechanicSlot: 3
  }),
  [ID.BARRIER_BURST]: mechCommand({
    castTimeMs: 3750,
    cooldown: 30,
    effects: [
      {
        type: 'boon',
        boon: 'might',
        duration: 20,
        stacks: 2
      },
      {
        type: 'boon',
        boon: 'fury',
        duration: 3,
        stacks: 1
      }
    ],
    mechanicSlot: 3
  }),
  [ID.SPARK_REVOLVER]: mechCommand({
    quicknessCastTimeMs: MECHANIST_COMMAND_DURATIONS[ID.SPARK_REVOLVER] * 1000,
    rechargeAnchor: 'castStart',
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 720, coefficient: 0.176 },
          { atMs: 720, coefficient: 0.176 },
          { atMs: 840, coefficient: 0.176 },
          { atMs: 840, coefficient: 0.176 },
          { atMs: 1000, coefficient: 0.176 },
          { atMs: 1000, coefficient: 0.176 },
          { atMs: 1160, coefficient: 0.176 },
          { atMs: 1160, coefficient: 0.176 },
          { atMs: 1320, coefficient: 0.176 },
          { atMs: 1320, coefficient: 0.176 },
          { atMs: 1480, coefficient: 0.176 },
          { atMs: 1480, coefficient: 0.176 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Spark Revolver',
        actorType: 'summon'
      }
    ],
    mechanicSlot: 1
  }),
  [ID.SKY_CIRCUS]: mechCommand({
    // Four logged Quickness animations last ~2120 ms; landing damage occurs at ~1320 ms.
    quicknessCastTimeMs: 2120,
    cooldown: 30,
    effects: [
      {
        type: 'strike',
        // One missile per nearby foe; "targets per missile: 3" is its cleave cap.
        coefficient: 0.6,
        hits: 1,
        atMs: 0,
        name: 'Missile Damage',
        actorType: 'summon'
      },
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        atMs: 1320,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Landing Damage',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 5,
        actorType: 'summon'
      },
      {
        type: 'control',
        actorType: 'summon',
        atMs: 1320,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        controlKind: 'knockback'
      }
    ],
    mechanicSlot: 3
  }),
  [ID.CRISIS_ZONE]: mechCommand({
    castTimeMs: 0,
    cooldown: 30,
    effects: [
      {
        type: 'boon',
        boon: 'aegis',
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 6,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'alacrity',
        duration: 6,
        stacks: 1
      }
    ],
    mechanicSlot: 2
  }),
  [ID.ROLLING_SMASH]: mechCommand({
    castTimeMs: 750,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 1,
        name: 'Rolling Smash',
        actorType: 'summon'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 4,
        duration: 8,
        actorType: 'summon'
      }
    ],
    mechanicSlot: 1
  }),
  [ID.CORE_REACTOR_SHOT]: mechCommand({
    quicknessCastTimeMs: MECHANIST_COMMAND_DURATIONS[ID.CORE_REACTOR_SHOT] * 1000,
    rechargeAnchor: 'castStart',
    cooldown: 25,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 680, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Core Reactor Shot',
        actorType: 'summon'
      },
      {
        type: 'control',
        actorType: 'summon',
        controlKind: 'launch'
      }
    ]),
    mechanicSlot: 2
  }),
  [ID.EXPLOSIVE_KNUCKLE]: mechCommand({
    castTimeMs: 500,
    cooldown: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        name: 'Explosive Knuckle',
        actorType: 'summon',
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        condition: 'Weakness',
        stacks: 1,
        duration: 5,
        actorType: 'summon'
      }
    ],
    mechanicSlot: 1
  }),
  [ID.DISCHARGE_ARRAY]: mechCommand({
    castTimeMs: 0,
    cooldown: 30,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 0 + index * 1000, coefficient: 1.5 / 5 })),
        name: 'Discharge Array',
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: 0 + index * 1000,
          condition: 'Slow',
          stacks: 1,
          duration: 2
        })),
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: 0 + index * 1000,
          condition: 'Confusion',
          stacks: 2,
          duration: 3
        })),
        actorType: 'summon'
      },
      {
        type: 'condition',
        ticks: Array.from({ length: 5 }, (_, index) => ({
          atMs: 0 + index * 1000,
          condition: 'Burning',
          stacks: 1,
          duration: 3
        })),
        actorType: 'summon'
      }
    ]),
    mechanicSlot: 2
  })
});
