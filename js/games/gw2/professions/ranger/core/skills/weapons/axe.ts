/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { BOON, COMBO_FINISHER, CONDITION, CONTROL, WEAPON } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import type { RuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import type { RangerRuntime, RangerRuntimeState, RangerSkill } from '#gw2/professions/ranger/types.js';

// The channel's strikes, Vulnerability applications, and whirl attempts share the same packet grid.
const WHIRLING_DEFENSE_TICK_OFFSETS_MS = [200, 360, 600, 840, 1040, 1280, 1520, 1680, 1920, 2160, 2360, 2600] as const;

// Share adjacent impact timing while preserving local payloads, attribution, and independent timelines.
// Projectile flags belong to strikes so Mistral and Shrike count impacts independently of combo success.
export const RANGER_CORE_AXE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.RICOCHET]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    castTimeMs: 600,
    interruptCommitMs: 320,
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        projectile: true,
        coefficient: 0.9,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 0.2
          }
        ]
      },
      {
        type: 'boon',
        boon: BOON.MIGHT,
        duration: 5,
        stacks: 1
      }
    ])
  },
  [ID.SPLITBLADE]: {
    // Match the observed median Quickness animation, rounded to the 40 ms action tick.
    castTimeMs: 560,
    interruptCommitMs: 480,
    retainsCastLockoutAfterInterrupt: true,
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        projectile: true,
        coefficient: 2.5,
        hits: 5,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.PROJECTILE,
            chance: 0.2
          }
        ]
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 5,
        duration: 6
      }
    ])
  },
  [ID.WINTERS_BITE]: {
    castTimeMs: 520,
    interruptCommitMs: 360,
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        projectile: true,
        coefficient: 1.8
      },
      {
        type: 'condition',
        condition: CONDITION.BLEEDING,
        stacks: 3,
        duration: 12
      },
      {
        type: 'condition',
        condition: CONDITION.CHILLED,
        stacks: 1,
        duration: 4
      }
    ]),
    // Arm subsequent qualifying hits only on semantic commitment.
    sideEffects: [
      {
        on: 'castCommit',
        do: {
          type: 'ranger.winter-bite',
          id: 'beastmode-weakness',
          effects: [
            { name: CONDITION.WEAKNESS, type: 'condition', condition: CONDITION.WEAKNESS, duration: 10, stacks: 1 }
          ]
        }
      }
    ]
  },
  [ID.PATH_OF_SCARS]: {
    castTimeMs: 440,
    interruptCommitMs: 360,
    // Both range variants share the same weapon-slot recharge after completion.

    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        projectile: true,
        ticks: [
          { atMs: 400, coefficient: 1.2 },
          // Use the short return window for normal, close-range throws.
          { atMs: 480, coefficient: 1.2 }
        ],
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      {
        type: 'control',
        // Pull and Claw activation belong to the returning contact.
        atMs: 480,
        controlKind: CONTROL.PULL
      }
    ])
  },
  [ID.WHIRLING_DEFENSE]: {
    castTimeMs: 2720,
    interruptMode: 'per-packet',
    effects: [
      // Each landed channel tick applies one stack and attempts a whirl; interruption drops the remaining pairs.
      ...impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          type: 'strike',
          ticks: WHIRLING_DEFENSE_TICK_OFFSETS_MS.map((atMs) => ({
            atMs,
            coefficient: 0.66,
            comboFinishers: [{ ownerId: 'ranger', finisherType: COMBO_FINISHER.WHIRL }]
          }))
        },
        {
          type: 'condition',
          ticks: WHIRLING_DEFENSE_TICK_OFFSETS_MS.map((atMs) => ({
            atMs,
            condition: CONDITION.VULNERABILITY,
            stacks: 1,
            duration: 10
          }))
        }
      ]),
      {
        type: 'boon',
        boon: BOON.RESOLUTION,
        duration: 4,
        stacks: 1
      }
    ]
  }
});

/** Owns the max-range Path of Scars identity beside the canonical Axe fragment. */
export const RANGER_CORE_AXE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  {
    name: 'Path of Scars (Max Range)',
    id: ID.PATH_OF_SCARS_MAX_RANGE,
    description: 'Throw your axe from maximum range so its returning strike lands later.',
    icon: 'https://render.guildwars2.com/file/B5B27723701C39327D2145DEE76579FB007F9344/103903.png',
    variantBadge: 'MAX',
    type: 'Weapon',
    weapon: WEAPON.AXE,
    slot: 'Weapon_4',
    rechargeAnchor: 'castStart',
    cooldown: 15,
    castTimeMs: 440,
    interruptCommitMs: 360,
    // Both range variants share the same weapon-slot recharge after completion.

    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        projectile: true,
        // Range changes the return timing, but both variants belong to the same damage breakdown row.
        damageBreakdownName: 'Path of Scars',
        ticks: [
          { atMs: 400, coefficient: 1.2 },
          // Maximum range uses the long return window; the pull waits for this contact.
          { atMs: 1920, coefficient: 1.2 }
        ],
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: COMBO_FINISHER.PROJECTILE
          }
        ]
      },
      {
        type: 'control',
        // Keep the pull on the return contact, including when the player has already swapped weapons.
        atMs: 1920,
        controlKind: CONTROL.PULL
      }
    ])
  }
]);

/** Both throw distances keep the source's live recharge even when the attempt is interrupted. */
function synchronizePathOfScarsRecharge(runtime: RangerRuntime, cast: RuntimeCast<RangerSkill>): void {
  if (cast.skill.id !== ID.PATH_OF_SCARS && cast.skill.id !== ID.PATH_OF_SCARS_MAX_RANGE) return;

  runtime.cooldownController.copy(cast.skill.id, ID.PATH_OF_SCARS);
  runtime.cooldownController.copy(cast.skill.id, ID.PATH_OF_SCARS_MAX_RANGE);
}

/** Winter's Bite arms its merged follow-up on commit; Path of Scars shares recharge across commit and cancel. */
export const axeLifecycle = {
  sideEffectHandlers: {
    'ranger.winter-bite'(runtime) {
      runtime.profession.core.winterBiteReady = true;
    }
  },
  onCastCommit: synchronizePathOfScarsRecharge,
  onCastCancel: synchronizePathOfScarsRecharge
} satisfies RuntimeHooks<RangerRuntimeState, RangerSkill>;
