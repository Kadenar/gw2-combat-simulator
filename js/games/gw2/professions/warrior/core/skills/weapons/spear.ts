/** Core Warrior spear packets use nearest-40 ms offsets to remove false timing precision. */
import { COMBO_FINISHER, CONDITION, CONTROL } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorSkill } from '#gw2/professions/warrior/types.js';

export const WARRIOR_WEAPONS_SPEAR_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<WarriorSkill>>> = {
  [ID.MIGHTY_THROW]: {
    name: 'Mighty Throw',
    icon: 'https://render.guildwars2.com/file/F02129C7049F590E00BB7B09EDC1B258655D9459/3379199.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 640,
    interruptMode: 'commit',
    // Once the throw commits, its effects survive interruption.
    interruptCommitMs: 600,
    // Both impact packets count as explosions; shards still require a secondary target.
    effects: impactEffects({ persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 1.2 }],
        name: 'Mighty Throw — Spear Damage',
        damageKind: 'explosion',
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 0.9 }],
        name: 'Mighty Throw — Shard Damage',
        damageKind: 'explosion',
        // Single-target suppression follows this stable packet identity rather than the display label.
        metadata: { packetKind: 'warrior.mighty-throw-shard' },
        when: () => false, // Shards require a secondary target; this simulation has one target.
        timingAnchor: 'castStart',
        timingScale: 'cast'
      }
    ])
  },
  [ID.MAIMING_SPEAR]: {
    name: 'Maiming Spear',
    icon: 'https://render.guildwars2.com/file/AB9C0E53733CDA025F4B7EB813C8AEF932F4E74F/3379200.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_2',
    cooldown: 5,
    castTimeMs: 480,
    interruptMode: 'commit',
    // Committed throws preserve their effects and hold the cast lane through the remaining animation.
    interruptCommitMs: 400,
    retainsCastLockoutAfterInterrupt: true,
    effects: impactEffects({ persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [{ atMs: 1000, coefficient: 1.1 }],
        name: 'Maiming Spear — Initial Strike Damage',
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      },
      {
        type: 'strike',
        // The single target receives the epicenter bonus on the aftershock only.
        modifiers: [
          {
            id: 'warrior.maiming-spear-epicenter',
            label: 'Maiming Spear - epicenter',
            target: 'strikeDamage',
            operation: 'multiply',
            factor: 1.5
          }
        ],
        ticks: [{ atMs: 1520, coefficient: 0.75 }],
        name: 'Maiming Spear — Aftershock Damage',
        // Only the delayed aftershock counts as an explosion for explosion-triggered effects.
        damageKind: 'explosion',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: COMBO_FINISHER.BLAST
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 3
      }
    ])
  },
  [ID.DISRUPTING_THROW]: {
    name: 'Disrupting Throw',
    icon: 'https://render.guildwars2.com/file/6AC359F6D6C8D8F11372EE01FBB09D9CE25D767D/3379202.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_3',
    cooldown: 10,
    castTimeMs: 520,
    interruptMode: 'commit',
    // Committed throws preserve their effects and hold the cast lane through the remaining animation.
    interruptCommitMs: 400,
    retainsCastLockoutAfterInterrupt: true,
    effects: impactEffects({ persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 2 }],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        comboFinishers: [
          {
            ownerId: 'warrior',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 1
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 2
      },
      {
        type: 'control',
        controlKind: CONTROL.DAZE
      }
    ])
  },
  [ID.SPEARMARSHALS_SUPPORT]: {
    name: "Spearmarshal's Support",
    icon: 'https://render.guildwars2.com/file/43132DEC934F072272F14B19FC03FB62111502FB/3379203.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_4',
    cooldown: 15,
    castTimeMs: 520,
    interruptMode: 'commit',
    // Once support commits, its delayed strikes survive interruption.
    interruptCommitMs: 480,
    effects: impactEffects({ persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [
          { atMs: 960, coefficient: 0.5 },
          { atMs: 1160, coefficient: 0.5 },
          { atMs: 1360, coefficient: 0.5 },
          { atMs: 1560, coefficient: 0.5 },
          { atMs: 1760, coefficient: 0.5 },
          { atMs: 1960, coefficient: 0.5 },
          { atMs: 2160, coefficient: 0.5 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed'
      }
    ])
  },
  [ID.SPEAR_SWIPE]: {
    name: 'Spear Swipe',
    icon: 'https://render.guildwars2.com/file/EB6D03527064DF984CA10F08426765070948A9E3/3379201.png',
    type: 'Weapon',
    weapon: 'Spear',
    slot: 'Weapon_5',
    cooldown: 20,
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    castTimeMs: 1240,
    effects: [
      {
        type: 'control',
        controlKind: CONTROL.LAUNCH
      },
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      }
    ]
  }
};
