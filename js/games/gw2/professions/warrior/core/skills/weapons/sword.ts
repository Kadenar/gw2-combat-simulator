/** Canonical Core warrior skill definitions grouped by their GW2 owner. */
import { BOON, COMBO_FINISHER, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import type { WarriorRuntimeState, WarriorSkill } from '#gw2/professions/warrior/types.js';

export const WARRIOR_WEAPONS_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = Object.freeze({
  [ID.SEVER_ARTERY]: {
    name: 'Sever Artery',
    description: 'Chain. Bleed your foe with a slash.',
    icon: 'https://render.guildwars2.com/file/3040B9E8344BF32EA5ADB3FB632C4F01BFD0927D/103003.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    dualWieldEffectOffsetsMs: { 200: 160 },
    castTimeMs: 360,
    dualWieldCastTimeMs: 280,
    // Require the slash to commit before an interrupted cast can deal damage.
    interruptCommitMs: 320,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 200, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0.8
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 6
      }
    ])
  },
  [ID.GASH]: {
    name: 'Gash',
    description: 'Chain. Bleed your foe with a gash.',
    icon: 'https://render.guildwars2.com/file/44563D2C3BDCEB1524D2DB0F23713347CDE93D32/103004.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    dualWieldEffectOffsetsMs: { 280: 240 },
    castTimeMs: 520,
    dualWieldCastTimeMs: 360,
    interruptCommitMs: 360,
    retainsCastLockoutAfterInterrupt: true,
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects({ atMs: 280, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 0.8
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 6
      }
    ])
  },
  [ID.HAMSTRING]: {
    name: 'Hamstring',
    description: 'Cripple your foe with a precise slash.',
    icon: 'https://render.guildwars2.com/file/E2DF06E072A837280306F7A7DA2FEA399ABAAEC7/104137.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 400,
    dualWieldCastTimeMs: 320,
    // Dual Wielding advances the slash's commit point when its offhand requirement is met.
    interruptCommitMs: 320,
    dualWieldInterruptCommitMs: 200,
    // The slash and its conditions precede full recovery by 160 ms at either attack speed.
    effects: impactEffects({ atMs: -160, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.2
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 6
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 1
      }
    ])
  },
  [ID.SAVAGE_LEAP]: {
    name: 'Savage Leap',
    description: 'Lunge at your foe and strike them with your sword.',
    icon: 'https://render.guildwars2.com/file/F47AFFCAC1475EB0086C32AAB5AA1A6048F52A08/102778.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_2',
    cooldown: 8,
    // Movement classification drives completed Brave Stride rewards.
    movementSkill: true,
    castTimeMs: 1000,
    interruptMode: 'commit',
    // Preserve the landing effects once the leap commits, even if the cast is interrupted.
    interruptCommitMs: 960,
    // Retain a field crossed during the leap even when it expires before landing.
    comboFinishers: [
      {
        ownerId: 'warrior',
        finisherType: COMBO_FINISHER.LEAP,
        fieldSelectionAnchor: 'castStart'
      }
    ],
    // Share impact timing while preserving independent payloads and declaration order.
    effects: impactEffects(
      { atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true },
      [
        {
          type: 'strike',
          coefficient: 2
        },
        {
          type: 'condition',
          condition: CONDITION.CRIPPLED,
          stacks: 1,
          duration: 3
        },
        {
          type: 'condition',
          condition: CONDITION.BLEEDING,
          stacks: 3,
          duration: 5
        }
      ]
    )
  },
  [ID.REND]: {
    name: 'Rend',
    description:
      'Maim your target with an immobilizing strike, then deliver a devastating blow that inflicts heavy bleeding.',
    icon: 'https://render.guildwars2.com/file/959E954064FEA5F0E8753D43D50BB67D0CBD3FA7/3790493.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_3',
    cooldown: 12,
    dualWieldEffectOffsetsMs: { 440: 320 },
    castTimeMs: 960,
    dualWieldCastTimeMs: 720,
    // Interrupted replay keeps every Rend packet after its two-part attack commits.
    interruptCommitMs: 920,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'cast', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [{ atMs: 440, coefficient: 0.5 }]
      },
      {
        type: 'strike',
        // The follow-up retains 80 ms of recovery with either attack speed, preserving its buff-expiry ordering.
        atMs: -80,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        coefficient: 2.5,
        name: 'Rend — Follow-Up Damage'
      },
      {
        type: 'condition',
        ticks: [{ atMs: 440, condition: CONDITION.IMMOBILIZED, stacks: 1, duration: 2 }]
      },
      {
        type: 'condition',
        atMs: -80,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        condition: CONDITION.BLEEDING,
        stacks: 6,
        duration: 6
      }
    ])
  },
  [ID.IMPALE]: {
    name: 'Impale',
    description: 'Throw your sword at your foe to impale them.',
    icon: 'https://render.guildwars2.com/file/4876CF1E0673120898A5EEFE9D2409741E182EAE/103060.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_4',
    cooldown: 15,
    // Use the reviewed cast durations, with the shorter recovery selected by Dual Wielding.
    castTimeMs: 440,
    dualWieldCastTimeMs: 360,
    // The projectile and its immediate payload precede full recovery; later cripple pulses retain their own schedule.
    effects: impactEffects({ atMs: -40, timingAnchor: 'castEnd', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.TORMENT,
        stacks: 5,
        duration: 8
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 1,
        applications: 5,
        atMs: 0,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ]),
    // Expose Rip for the embedded sword's lifetime, independently of Impale's recharge.
    sideEffects: [{ on: 'castCommit', do: { type: 'flipArm', skillId: ID.RIP, durationSec: 4 } }]
  },
  [ID.RIP]: {
    name: 'Rip',
    description: 'Rip your sword from your foe for extra damage.',
    icon: 'https://render.guildwars2.com/file/173047947C1C46C658999645D878E6F9B12D754A/104138.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_4',
    cooldown: 1,
    dualWieldEffectOffsetsMs: { 440: 320 },
    castTimeMs: 680,
    dualWieldCastTimeMs: 420,
    // Rip's impact is measured separately from its user-selected cast duration.
    effects: impactEffects({ atMs: 440, timingAnchor: 'castStart', timingScale: 'cast' }, [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.MIGHT,
        duration: 5,
        stacks: 10
      }
    ]),
    // Accepting the follow-up restores Impale's tile even when Rip is subsequently canceled.
    sideEffects: [{ on: 'castStart', do: { type: 'flipConsume', skillId: ID.RIP } }]
  },
  [ID.RIPOSTE]: {
    name: 'Riposte',
    description:
      'Block the next attack. Riposte and bleed your foe if you block a melee attack. Gain adrenaline if you are not attacked.',
    icon: 'https://render.guildwars2.com/file/51163210A4C4A224903D14057C0018C91580FBA8/103099.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_5',
    cooldown: 15,
    castTimeMs: 2400,
    // Release the block early by default so its follow-up can be selected within the original channel window.
    defaultInterruptMs: 200,
    interruptCommitMs: 80,
    effects: [],
    sideEffects: [
      {
        on: 'castCommit',
        when: (runtime, cast) => runtime.time < cast.fullEnd,
        do: { type: 'warrior.riposte-arm' }
      }
    ]
  },
  [ID.ADRENALINE_RUSH]: {
    name: 'Adrenaline Rush',
    description: 'Stop blocking and swing out with an attack.',
    icon: 'https://render.guildwars2.com/file/F6D809292BC50B03A8E3A5F6C04201DE09A02C08/103221.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_5',
    cooldown: 0,
    // Adrenaline Rush instantly grants its resource without striking the target.
    castTimeMs: 0,
    effects: [],
    sideEffects: [
      { on: 'castStart', do: { type: 'flipConsume', skillId: ID.ADRENALINE_RUSH } },
      { on: 'castCommit', do: { type: 'warrior.grant-combat-resource', amount: 3 } }
    ]
  }
});

/** Riposte arms its follow-up for the block window; Core Warrior admission enforces every weapon follow-up window. */
export const swordFlipLifecycle: RuntimeHooks<WarriorRuntimeState, WarriorSkill> = {
  sideEffectHandlers: {
    'warrior.riposte-arm'(runtime, context) {
      if (context.kind === 'cast') runtime.armFlip(ID.ADRENALINE_RUSH, { expiresAt: context.cast.fullEnd });
    }
  }
};
