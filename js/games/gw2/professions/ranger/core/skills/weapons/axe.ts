/** Canonical Core ranger skill fragments grouped by their GW2 owner. */
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// The channel's strikes, Vulnerability applications, and whirl attempts share the same packet grid.
const WHIRLING_DEFENSE_TICK_OFFSETS_MS = [200, 360, 600, 840, 1040, 1280, 1520, 1680, 1920, 2160, 2360, 2600] as const;

// Share adjacent impact timing while preserving local payloads, attribution, and independent timelines.
export const RANGER_CORE_AXE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.RICOCHET]: {
    autoattack: true, // Ordinary repeatable attack; excluded from player-input metrics.
    interruptCommitMs: 320,
    effects: impactEffects({ atMs: 320, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 0.9,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 5,
        stacks: 1
      }
    ]),
    castTimeMs: 600,
    missileHits: 1
  },
  [ID.SPLITBLADE]: {
    interruptCommitMs: 480,
    effects: impactEffects({ atMs: 480, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 5,
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Projectile',
            chance: 0.2,
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 5,
        duration: 6
      }
    ]),
    // Match the observed median Quickness animation, rounded to the 40 ms action tick.
    castTimeMs: 560,
    missileHits: 5
  },
  [ID.WINTERS_BITE]: {
    interruptCommitMs: 360,
    effects: impactEffects({ atMs: 360, timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        coefficient: 1.8
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 3,
        duration: 12
      },
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 4
      }
    ]),
    castTimeMs: 520,
    // Custom: Arms the Winter's Bite follow-up state; see `core/live.ts`.

    missileHits: 1
  },
  [ID.PATH_OF_SCARS]: {
    interruptCommitMs: 360,
    // Both range variants share the same weapon-slot recharge after completion.

    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
        ticks: [
          { atMs: 400, coefficient: 1.2 },
          // Use the short return window for normal, close-range throws.
          { atMs: 480, coefficient: 1.2 }
        ],
        comboFinishers: [
          {
            ownerId: 'ranger',
            finisherType: 'Projectile',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'control',
        // Pull and Claw activation belong to the returning contact.
        atMs: 480,
        controlKind: 'pull'
      }
    ]),
    castTimeMs: 440,
    missileHits: 2
  },
  [ID.WHIRLING_DEFENSE]: {
    interruptMode: 'per-packet',
    effects: [
      // Each landed channel tick applies one stack and attempts a whirl; interruption drops the remaining pairs.
      ...impactEffects({ timingAnchor: 'castStart', timingScale: 'cast' }, [
        {
          type: 'strike',
          ticks: WHIRLING_DEFENSE_TICK_OFFSETS_MS.map((atMs) => ({
            atMs,
            coefficient: 0.66,
            comboFinishers: [{ ownerId: 'ranger', finisherType: 'Whirl', ambiguousFieldSelection: 'oldest' }]
          }))
        },
        {
          type: 'condition',
          ticks: WHIRLING_DEFENSE_TICK_OFFSETS_MS.map((atMs) => ({
            atMs,
            condition: 'Vulnerability',
            stacks: 1,
            duration: 10
          }))
        }
      ]),
      {
        type: 'boon',
        boon: 'resolution',
        duration: 4,
        stacks: 1
      }
    ],
    castTimeMs: 2720
  }
});

/** Owns the max-range Path of Scars identity beside the canonical Axe fragment. */
export const RANGER_CORE_AXE_EXTRA_SKILLS: readonly Skill[] = Object.freeze([
  {
    id: ID.PATH_OF_SCARS_MAX_RANGE,
    interruptCommitMs: 360,
    name: 'Path of Scars (Max Range)',
    description: 'Throw your axe from maximum range so its returning strike lands later.',
    icon: 'https://render.guildwars2.com/file/B5B27723701C39327D2145DEE76579FB007F9344/103903.png',
    variantBadge: 'MAX',
    type: 'Weapon',
    weapon: 'Axe',
    slot: 'Weapon_4',
    castTimeMs: 440,
    rechargeAnchor: 'castStart',
    cooldown: 15,
    missileHits: 2,
    // Both range variants share the same weapon-slot recharge after completion.

    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
      {
        type: 'strike',
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
            finisherType: 'Projectile',
            ambiguousFieldSelection: 'oldest'
          }
        ]
      },
      {
        type: 'control',
        // Keep the pull on the return contact, including when the player has already swapped weapons.
        atMs: 1920,
        controlKind: 'pull'
      }
    ])
  }
]);
