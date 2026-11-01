/** Canonical Core guardian skill definitions grouped by their GW2 owner. */
import { BOON, COMBO_FIELD, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects, strikeTimeline } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';

export const GUARDIAN_WEAPONS_GREATSWORD_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.GREAT_SWORD_STRIKE]: {
    name: 'Strike',
    description: 'Chain. Strike your foe.',
    icon: 'https://render.guildwars2.com/file/FC80059BFD4258212CAEB303099B0639AF0308CA/103162.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 400,
    // A committed cancel advances the chain and preserves the pending hit at its normal impact time.
    interruptCommitMs: 320,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 1 }],
        persistsAfterInterrupt: true,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.GREAT_SWORD_VENGEFUL_STRIKE]: {
    name: 'Vengeful Strike',
    description: 'Chain. Strike your foe again.',
    icon: 'https://render.guildwars2.com/file/009A1EFE24BB1DBFE44C04E6F0B7A44D9F27033B/103163.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 600,
    // The packet commits at 400 ms, but cancelling there retains the full
    // 600 ms action lockout observed in the combat log.
    interruptCommitMs: 400,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 1.1 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.GREAT_SWORD_WRATHFUL_STRIKE]: {
    name: 'Wrathful Strike',
    description: 'Attack with a final, powerful strike that applies might for each foe you strike.',
    icon: 'https://render.guildwars2.com/file/50B1BB27B4789637E5ADD30B29976D0D9A4E13E0/103164.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 680,
    // Damage lands at 440 ms; the 480 ms safe cancel still keeps the full
    // 680 ms Quickness action lane occupied.
    interruptCommitMs: 480,
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 440, coefficient: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ]
  },
  [ID.WHIRLING_WRATH]: {
    name: 'Whirling Wrath',
    description: 'Spin in place and swing your greatsword while hurling powerful projectiles.',
    icon: 'https://render.guildwars2.com/file/374A9BB028E19F0B5D04622A33B36FA67E0EC938/103574.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_2',
    cooldown: 8,
    // Store the measured effective action duration directly.
    castTimeMs: 1480,
    interruptMode: 'per-packet',
    // ponytail: land both hits at projectile arrival so cancellation uses one boundary per pair;
    // restore separate launch timing only if the 40 ms melee lead needs to be modeled.
    effects: [
      strikeTimeline(
        Array.from({ length: 7 }, (_, index) => [
          { atMs: 480 + index * 160, coefficient: 0.35 },
          { atMs: 480 + index * 160, projectile: true, coefficient: 0.275 }
        ]).flat(),
        {
          timingAnchor: 'castStart',
          timingScale: 'cast'
        }
      )
    ]
  },
  [ID.LEAP_OF_FAITH]: {
    name: 'Leap of Faith',
    description:
      'Leap at your foe. Inflicts blindness and heals you for each foe hit. Heal for a lesser amount for each target struck beyond the first.',
    icon: 'https://render.guildwars2.com/file/C6C1B00FD5191CB2AA311E2205A3D90D9907BB9E/103587.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_3',
    cooldown: 10,
    castTimeMs: 720,
    // Cancelling at or after 680 ms preserves the landing strike and blind.
    interruptCommitMs: 680,
    // Keep the landing strike and blind together, 80 ms before the animation ends.
    effects: impactEffects(
      {
        atMs: 640,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        persistsAfterInterrupt: true
      },
      [
        {
          type: 'strike',
          coefficient: 2,
          hits: 1,
          // Leap of Faith only creates combo effects when this packet resolves through an active field.
          comboFinishers: [
            {
              ownerId: 'guardian',
              finisherType: COMBO_FINISHER.LEAP
            }
          ]
        },
        {
          type: 'condition',
          condition: CONDITION.BLINDNESS,
          stacks: 1,
          duration: 3
        }
      ]
    )
  },
  [ID.SYMBOL_OF_RESOLUTION]: {
    name: 'Symbol of Resolution',
    description:
      'Symbol. Pierce the ground with a mystic symbol that damages foes while granting resolution to allies.',
    icon: 'https://render.guildwars2.com/file/B9FC18E67D7FEE5B64F60AB7700E5706CCB51DA6/103660.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_4',

    cooldown: 12,
    // Author symbol identity independently of the skill's display text.
    tags: ['symbol'],
    rechargeAnchor: 'castStart',
    castTimeMs: 320,
    defaultInterruptMs: 280,
    // The symbol commits at 240 ms but may occupy the action lane through 320 ms, so imported tick timings
    // between those bounds are safe interrupts and the committed symbol keeps pulsing afterward.
    interruptCommitMs: 240,
    comboFields: [
      {
        ownerId: 'guardian',
        fieldType: COMBO_FIELD.LIGHT,
        duration: 4,
        startMs: 200,
        startAnchor: 'castStart',
        // The final pulse can share a server timestamp with a successful finisher, so keep that boundary eligible.
        inclusiveExpiry: true
      }
    ],
    effects: [
      // Self Resolution follows each pulse even when the symbol misses. Only pulses after commitment persist.
      ...[
        { atMs: 200, persistsAfterInterrupt: false },
        { atMs: 1200, applications: 4, intervalMs: 1000, persistsAfterInterrupt: true }
      ].map((pulses) => ({
        type: 'boon' as const,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.RESOLUTION,
        duration: 1,
        stacks: 1,
        timingAnchor: 'castStart' as const,
        timingScale: 'fixed' as const,
        ...pulses
      })),
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        ticks: [{ atMs: 200, coefficient: 0.8 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Symbol of Resolution — Initial'
      },
      {
        type: 'strike',
        metadata: { guardianSymbol: true },
        coefficient: 2.6 / 4,
        atMs: 1200,
        applications: 4,
        intervalMs: 1000,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        name: 'Symbol of Resolution'
      }
    ]
  },
  [ID.BINDING_BLADE]: {
    name: 'Binding Blade',
    description:
      'Throw blades at your foes, causing damage over time. Bound foes can be pulled to you. The effect ends when a foe moves out of range.',
    icon: 'https://render.guildwars2.com/file/B975D6E5B32392524C034114E2A2201097BFDA35/103274.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_5',
    cooldown: 25,
    // Pull Self stays available for the tether's lifetime.
    flipDuration: 10,
    castTimeMs: 480,
    interruptCommitMs: 440,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 2.5 }],
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: Array.from({ length: 10 }, (_, index) => ({ atMs: 1000 + index * 1000, coefficient: 0 / 10 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Binding Blade — Tether',
        // Keep the tether's damage separate from the initial strike in the combat breakdown.
        damageBreakdownName: 'Binding Blade — Tether',
        canCrit: false,
        sourceId: 9148,
        // Tether pulses are non-critical power strikes, so they remain in strike totals.
        flatStrikeBase: 160,
        flatStrikePowerCoeff: 0.3
      }
    ],
    // Expose the follow-up on commitment; its declaration owns the window.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.PULL, expiryPriority: -220 } }]
  },
  [ID.PULL]: {
    name: 'Pull',
    description: 'Pull your foes to you.',
    icon: 'https://render.guildwars2.com/file/52060B4FF8B76A546473009232610BB21718C2A4/103586.png',
    type: 'Weapon',
    weapon: 'Greatsword',
    slot: 'Weapon_5',
    cooldown: 0,
    castTimeMs: 520,
    // Binding Blade only tethers; its armed Pull flip owns the control event that can trigger control relics.
    effects: [
      {
        type: 'control',
        controlKind: CONTROL.PULL
      }
    ],
    // A committed follow-up consumes its window and restores the parent.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipConsume', skillId: ID.PULL } }]
  }
});
