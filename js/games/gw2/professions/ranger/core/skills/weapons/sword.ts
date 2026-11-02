/** Canonical Core ranger skill definitions grouped by their GW2 owner. */
import { MODIFIER_TARGET, type Gw2ModifierRule } from '#gw2/platform/combat/modifiers.js';
import { BOON, COMBO_FINISHER, CONDITION, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

// Measured with Quickness in 20261015-203144.zevtc, rounded to the 40 ms action grid.
// Apply each attack's hit rewards before recovery ends so completed impacts survive recovery cancellation.
export const RANGER_CORE_SWORD_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition>> = {
  [ID.SLASH]: {
    name: 'Slash',
    icon: 'https://render.guildwars2.com/file/905B29D0F09934F0FBD954675D1C0CBC37ECEFD8/103123.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 480,
    interruptCommitMs: 400,
    effects: impactEffects({ atMs: 400, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        // The live PvE skill fact is 0.9; 0.8 understates the opening chain strike.
        coefficient: 0.9,
        hits: 1
      }
    ])
  },
  [ID.CRIPPLING_THRUST]: {
    name: 'Crippling Thrust',
    icon: 'https://render.guildwars2.com/file/5D2F5316C846E2C4030837A25EFC98C31826390F/2207784.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 320,
    interruptCommitMs: 240,
    effects: impactEffects({ atMs: 240, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        // Match the live PvE chain coefficient.
        coefficient: 0.9,
        hits: 1
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 2
      }
    ])
  },
  [ID.PRECISION_SWIPE]: {
    name: 'Precision Swipe',
    icon: 'https://render.guildwars2.com/file/ABE517B7E57E1BE230BD56C3F93A46A0900AAD3E/2207785.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_1',
    cooldown: 0,
    autoattack: true,
    // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 600,
    interruptCommitMs: 520,
    retainsCastLockoutAfterInterrupt: true,
    effects: impactEffects({ atMs: 520, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 5,
        stacks: 1,
        audience: { recipients: RECIPIENT.SUMMONS, affectsSelf: false, maximumRecipients: 1 }
      }
    ])
  },
  [ID.POUNCE]: {
    name: 'Pounce',
    icon: 'https://render.guildwars2.com/file/CECBFA1662D837E8A526E475A1E701679A2662BA/103125.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_2',
    cooldown: 6,
    castTimeMs: 840,
    interruptCommitMs: 760,
    effects: impactEffects({ atMs: 760, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        damageKind: 'ranger-pounce-defiant',
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.LEAP
          }
        ]
      },
      {
        type: 'boon',
        boon: BOON.VIGOR,
        duration: 3,
        stacks: 1
      }
    ])
  },
  [ID.SERPENTS_STRIKE]: {
    name: "Serpent's Strike",
    icon: 'https://render.guildwars2.com/file/26B3CC91C193FDC30873937B2FB735E1B7C6A83A/103126.png',
    type: 'Weapon',
    weapon: 'Sword',
    slot: 'Weapon_3',
    cooldown: 8,
    evades: true,
    castTimeMs: 1000,
    interruptCommitMs: 800,
    retainsCastLockoutAfterInterrupt: true,
    effects: impactEffects({ atMs: 800, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.LEAP
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.CRIPPLED,
        stacks: 1,
        duration: 3
      },
      {
        type: 'condition',
        condition: CONDITION.POISONED,
        stacks: 1,
        duration: 6
      },
      {
        type: 'condition',
        condition: CONDITION.IMMOBILIZED,
        stacks: 1,
        duration: 3
      }
    ])
  }
};

/** Intrinsic live-impact policy stays beside its skill; the shared registry supplies resolution. */
export const rangerPounceModifier: Gw2ModifierRule = {
  id: 'ranger.pounce-defiant',
  target: MODIFIER_TARGET.STRIKE_DAMAGE,
  operation: 'multiply',
  factor: 1.2,
  when: (context) => context.event?.damageKind === 'ranger-pounce-defiant' && Boolean(context.config?.target?.defiant)
};
