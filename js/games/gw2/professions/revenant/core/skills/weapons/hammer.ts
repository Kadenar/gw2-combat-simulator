// Name packets independently for patch deletion while preserving their shared attribution.
/** Canonical Core revenant skill definitions grouped by their GW2 owner. */
import { ACTOR, BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';

// Snap measured impact offsets to 40 ms action ticks instead of retaining EVTC timestamp jitter.
export const REVENANT_WEAPONS_HAMMER_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.HAMMER_BOLT]: {
    name: 'Hammer Bolt',
    description: 'Hurl your weapon at enemies, striking foes in its path.',
    icon: 'https://render.guildwars2.com/file/C6A83F71A055385DEA0A20DE4DD99FED07D2CD6D/961480.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_1',
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    cooldown: 0,
    energyCost: 0,
    castTimeMs: 560,
    // The projectile launches around 440 ms; cancelling recovery cannot recall it.
    interruptCommitMs: 440,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 560, coefficient: 0.9 }],
        name: 'Hammer Bolt',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        comboFinishers: [
          {
            ownerId: 'revenant',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 1
          }
        ]
      }
    ]
  },
  [ID.COALESCENCE_OF_RUIN]: {
    name: 'Coalescence of Ruin',
    description: 'Slam the ground with your hammer, creating a cascading eruption of energy.',
    icon: 'https://render.guildwars2.com/file/48731D970B1F37F42A091E3028F86E37D6E90421/961476.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_2',
    cooldown: 4,
    energyCost: 5,
    castTimeMs: 720,
    interruptCommitMs: 600,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        // Each cascade region uses the same 2.3 PvE coefficient, including repeat hits on large targets.
        ticks: [{ atMs: 560, coefficient: 2.3 }],
        name: 'Coalescence of Ruin - First Cascade',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        // Large targets intersect a second cascade region about 0.96 seconds after the first impact.
        type: 'strike',
        ticks: [{ atMs: 1520, coefficient: 2.3 }],
        name: 'Coalescence of Ruin - Second Cascade',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        when: (runtime) => runtime.combat.targetHitboxSize() === 'large'
      }
    ]
  },
  [ID.PHASE_SMASH]: {
    name: 'Phase Smash',
    description:
      'Leap through the Mists to the target area. When you land, damage and chill foes in an area, then teleport back to your previous location.',
    icon: 'https://render.guildwars2.com/file/70B93CAE02ACD667CEECE90D4B56674E734EEC77/961473.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_3',
    shadowstepSkill: true,
    peithaImpactDelayMs: 840,
    cooldown: 8,
    energyCost: 5,
    castTimeMs: 840,
    effects: [
      {
        type: 'strike',
        coefficient: 2.22,
        hits: 1,
        name: 'Phase Smash',
        actorType: ACTOR.PLAYER,
        comboFinishers: [
          {
            ownerId: 'revenant',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 2,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.FIELD_OF_THE_MISTS]: {
    name: 'Field of the Mists',
    description:
      'Create a field from the Mists that blocks incoming projectiles in front of you, then fire bolts at foes around your target.',
    icon: 'https://render.guildwars2.com/file/06CBE0372AFC3AA3077DF9E57093724149EF54BA/961469.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_4',
    cooldown: 12,
    energyCost: 10,
    // Measured Quickness animations include recovery time beyond the tooltip cast.
    castTimeMs: 600,
    comboFields: [
      {
        ownerId: 'revenant',
        fieldType: COMBO_FIELD.DARK,
        duration: 6,
        startMs: 680,
        startAnchor: 'castStart'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 680, coefficient: 1.8 }],
        name: 'Field of the Mists',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'fixed',

        comboFinishers: [
          {
            ownerId: 'revenant',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 1
          }
        ]
      },
      {
        type: 'boon',
        boon: BOON.AEGIS,
        duration: 2,
        stacks: 1
      }
    ]
  },
  [ID.DROP_THE_HAMMER]: {
    name: 'Drop the Hammer',
    description:
      'Summon a massive hammer from the Mists to strike the ground. Recharge Coalescence of Ruin if you strike an enemy.',
    icon: 'https://render.guildwars2.com/file/79B637C1950F37239C3D3ED91F0B665CAA4D1728/961474.png',
    type: 'Weapon',
    weapon: 'Hammer',
    slot: 'Weapon_5',
    cooldown: 15,
    energyCost: 15,
    castTimeMs: 480,
    // Share one impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 1640, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        // The accepted authored strike owns the recharge reward.
        reactions: [
          {
            on: 'damage.resolved',
            actor: ACTOR.PLAYER,
            packets: 'each',
            when: (_runtime, { event }) => Number(event.coefficient) > 0,
            do: { type: 'rechargeReset', skillIds: [ID.COALESCENCE_OF_RUIN] }
          }
        ],
        coefficient: 3.2,
        hits: 1,
        name: 'Drop the Hammer',
        actorType: ACTOR.PLAYER,

        comboFinishers: [
          {
            ownerId: 'revenant',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.KNOCKDOWN
      }
    ])
  }
});
