/**
 * Owns Photon Forge skill fragments, heat variants, and forge-only actions.
 * Persistent heat and forge state live under `mechanics/photon-forge.ts`.
 */
import { ACTOR, BOON, COMBO_FINISHER, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { impactEffects } from '#gw2/platform/effects/authoring.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { HolosmithSkillFragment } from '#gw2/professions/engineer/specializations/holosmith/types.js';

/** Supplies Photon Forge fragments to Holosmith module composition. */
export const HOLOSMITH_PHOTON_FORGE_SKILL_MECHANICS: Readonly<Record<string, HolosmithSkillFragment>> = Object.freeze({
  [ID.DEACTIVATE_PHOTON_FORGE]: {
    // Custom: Leaves Photon Forge and starts passive heat decay; see `holosmith/mechanics/photon-forge.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    cooldown: 6,
    countsAsToolbeltSkill: false,
    mechanicSlot: 5,

    castTimeMs: 0,
    effects: [],
    // Commit voluntary exit without replacing an overheat-owned Lens grant.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.exit-forge' } }]
  },
  [ID.LIGHT_STRIKE_STORM]: {
    cooldown: 0,
    heatGain: 3,
    forgeSkill: true,
    // Custom: Adds skill heat and handles overheat transitions; see `holosmith/mechanics/photon-forge.ts`.

    castTimeMs: 360,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 0.2
      }
    ],
    effects: [
      {
        weaponStrengthProfileId: 'transform.photon-forge',
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Light Strike—Storm',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion',
        projectile: true
      }
    ],
    // Schedule the authored heat at semantic completion through the shared overheat-aware owner.
    sideEffects: [{ on: 'castStart', do: { type: 'engineer.forge-heat' } }]
  },
  [ID.BRIGHT_SLASH_STORM]: {
    cooldown: 0,
    heatGain: 3,
    forgeSkill: true,
    // Custom: Adds skill heat and handles overheat transitions; see `holosmith/mechanics/photon-forge.ts`.

    castTimeMs: 520,
    interruptCommitMs: 280,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 0.2
      }
    ],
    effects: [
      {
        weaponStrengthProfileId: 'transform.photon-forge',
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        name: 'Bright Slash—Storm',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion',
        projectile: true
      }
    ],
    // Schedule the authored heat at semantic completion through the shared overheat-aware owner.
    sideEffects: [{ on: 'castStart', do: { type: 'engineer.forge-heat' } }]
  },
  [ID.FLASH_CUTTER_STORM]: {
    cooldown: 0,
    heatGain: 3,
    forgeSkill: true,
    // Custom: Adds skill heat and handles overheat transitions; see `holosmith/mechanics/photon-forge.ts`.

    castTimeMs: 560,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 0.2
      }
    ],
    effects: [
      {
        weaponStrengthProfileId: 'transform.photon-forge',
        type: 'strike',
        ticks: [200, 360].map((atMs) => ({ atMs, coefficient: 1.6 / 2 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Flash Cutter—Storm',
        actorType: ACTOR.PLAYER,
        damageKind: 'explosion',
        projectile: true
      }
    ],
    // Schedule the authored heat at semantic completion through the shared overheat-aware owner.
    sideEffects: [{ on: 'castStart', do: { type: 'engineer.forge-heat' } }]
  },
  [ID.ENGAGE_PHOTON_FORGE]: {
    // Intrinsic tuning follows this selected skill through patches and deferred work.
    kitLockoutDuration: 6,
    // Custom: Enters Photon Forge and starts its heat lifecycle; see `holosmith/mechanics/photon-forge.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    cooldown: 1,
    countsAsToolbeltSkill: false,
    mechanicSlot: 5,

    castTimeMs: 0,
    effects: [],

    // Commit the bar transition; shared heat cadence and Lens lifetime retain their mechanic owner.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.enter-forge' } }]
  },
  [ID.LIGHT_STRIKE]: {
    cooldown: 0,
    heatGain: 2,
    forgeSkill: true,
    // Custom: Adds skill heat and handles overheat transitions; see `holosmith/mechanics/photon-forge.ts`.

    castTimeMs: 360,
    interruptCommitMs: 200,
    effects: [
      {
        weaponStrengthProfileId: 'transform.photon-forge',
        type: 'strike',
        ticks: [{ atMs: 200, coefficient: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        name: 'Light Strike',
        actorType: ACTOR.PLAYER
      }
    ],
    // Schedule the authored heat at semantic completion through the shared overheat-aware owner.
    sideEffects: [{ on: 'castStart', do: { type: 'engineer.forge-heat' } }]
  },
  [ID.VENT_EXHAUST]: {
    cooldown: 0,
    // Vent Exhaust owns both its combat packets and the heat it vents; Thermal Release Valve only invokes it.
    heatLoss: 15,
    castTimeMs: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1,
        name: 'Vent Exhaust',
        actorType: ACTOR.PLAYER,
        canCrit: false
      },
      {
        type: 'condition',
        condition: CONDITION.BURNING,
        stacks: 2,
        duration: 6,
        actorType: ACTOR.PLAYER
      }
    ]
  },
  [ID.OVERHEAT]: {
    cooldown: 0,
    castTimeMs: 0,
    effects: []
  },
  [ID.BRIGHT_SLASH]: {
    cooldown: 0,
    heatGain: 2,
    forgeSkill: true,
    // Custom: Adds skill heat and handles overheat transitions; see `holosmith/mechanics/photon-forge.ts`.

    castTimeMs: 520,
    // The report's shortest successful cast is 441 ms (440 on the replay grid); hit timing alone is not a cutoff.
    interruptCommitMs: 440,
    effects: [
      {
        weaponStrengthProfileId: 'transform.photon-forge',
        type: 'strike',
        ticks: [{ atMs: 280, coefficient: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Bright Slash',
        actorType: ACTOR.PLAYER
      }
    ],
    // Schedule the authored heat at semantic completion through the shared overheat-aware owner.
    sideEffects: [{ on: 'castStart', do: { type: 'engineer.forge-heat' } }]
  },
  [ID.HOLOFORGE_OVERHEATED]: {
    cooldown: 0,
    castTimeMs: 0,
    effects: []
  },
  [ID.FLASH_CUTTER]: {
    cooldown: 0,
    heatGain: 2,
    forgeSkill: true,
    // Custom: Adds skill heat and handles overheat transitions; see `holosmith/mechanics/photon-forge.ts`.

    castTimeMs: 520,
    interruptCommitMs: 480,
    effects: [
      {
        weaponStrengthProfileId: 'transform.photon-forge',
        type: 'strike',
        // The second impact precedes the aftercast; shortening it must not stretch or drop either strike.
        ticks: [280, 440].map((atMs) => ({ atMs, coefficient: 1.6 / 2 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Flash Cutter',
        actorType: ACTOR.PLAYER
      }
    ],
    // Schedule the authored heat at semantic completion through the shared overheat-aware owner.
    sideEffects: [{ on: 'castStart', do: { type: 'engineer.forge-heat' } }]
  },
  [ID.HOLO_LEAP]: {
    cooldown: 2,
    heatGain: 7,
    forgeSkill: true,
    // Custom: Adds skill heat and handles overheat transitions; see `holosmith/mechanics/photon-forge.ts`.

    castTimeMs: 520,
    effects: [
      {
        weaponStrengthProfileId: 'transform.photon-forge',
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        name: 'Holo Leap',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 3 },
        boon: BOON.SWIFTNESS,
        duration: 3,
        stacks: 1
      }
    ],
    // Schedule the authored heat at semantic completion through the shared overheat-aware owner.
    sideEffects: [{ on: 'castStart', do: { type: 'engineer.forge-heat' } }]
  },
  [ID.DEACTIVATE_PHOTON_FORGE_HOT]: {
    // Custom: Leaves Photon Forge and starts passive heat decay; see `holosmith/mechanics/photon-forge.ts`.
    inputCategory: 'bar-swap', // Count the explicit bar-changing input in effort summaries.
    cooldown: 6,
    countsAsToolbeltSkill: false,
    mechanicSlot: 5,

    castTimeMs: 0,
    effects: [],
    // Commit voluntary exit without replacing an overheat-owned Lens grant.
    sideEffects: [{ on: 'castCommit', do: { type: 'engineer.exit-forge' } }]
  },
  [ID.CORONA_BURST]: {
    cooldown: 6,
    heatGain: 10,
    forgeSkill: true,
    // Custom: Schedules committed heat pulses that persist after Forge exit; see `holosmith/mechanics/photon-forge.ts`.

    castTimeMs: 480,
    interruptCommitMs: 400,
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: [
      ...impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
        {
          weaponStrengthProfileId: 'transform.photon-forge',
          type: 'strike',
          ticks: [{ atMs: 400, coefficient: 1.5 }],
          name: 'Initial Damage',
          actorType: ACTOR.PLAYER,
          damageKind: 'explosion'
        },
        {
          weaponStrengthProfileId: 'transform.photon-forge',
          type: 'strike',
          ticks: [{ atMs: 1800, coefficient: 1.5 }],
          name: 'Explosion Damage',
          actorType: ACTOR.PLAYER,
          damageKind: 'explosion'
        }
      ]),
      {
        type: 'condition',
        condition: CONDITION.VULNERABILITY,
        stacks: 8,
        duration: 8,
        actorType: ACTOR.PLAYER,
        persistsAfterInterrupt: true
      },
      ...impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed', persistsAfterInterrupt: true }, [
        {
          type: 'condition',
          ticks: [400, 1800].map((atMs) => ({ atMs, condition: CONDITION.BURNING, stacks: 2, duration: 5 })),
          actorType: ACTOR.PLAYER
        },
        {
          type: 'boon',
          boon: BOON.MIGHT,
          duration: 8,
          stacks: 1,
          atMs: 400
        },
        {
          type: 'boon',
          boon: BOON.MIGHT,
          duration: 8,
          stacks: 1,
          atMs: 760
        },
        {
          type: 'boon',
          boon: BOON.MIGHT,
          duration: 8,
          stacks: 1,
          atMs: 1120
        },
        {
          type: 'boon',
          boon: BOON.MIGHT,
          duration: 8,
          stacks: 1,
          atMs: 1480
        },
        {
          type: 'boon',
          boon: BOON.MIGHT,
          duration: 8,
          stacks: 1,
          atMs: 1800
        }
      ])
    ],
    // A released Corona owns its complete heat pulse sequence, including after Forge exit.
    sideEffects: [{ on: 'castStart', do: { type: 'engineer.corona-heat' } }]
  },
  [ID.PHOTON_BLITZ]: {
    cooldown: 10,
    heatGain: 16,
    forgeSkill: true,
    // Custom: Adds heat per completed projectile launch; see `holosmith/mechanics/photon-forge.ts`.

    castTimeMs: 1320,
    // Each launched projectile and matching burn survive independently when the channel ends early.
    interruptMode: 'per-packet',
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: COMBO_FINISHER.PROJECTILE,
        chance: 0.2
      }
    ],
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        weaponStrengthProfileId: 'transform.photon-forge',
        type: 'strike',
        ticks: [240, 400, 480, 640, 720, 880, 960, 1120].map((atMs) => ({ atMs, coefficient: 0.64 })),
        name: 'Photon Blitz',
        actorType: ACTOR.PLAYER,
        projectile: true
      },
      {
        type: 'condition',
        ticks: [240, 400, 480, 640, 720, 880, 960, 1120].map((atMs) => ({
          atMs,
          condition: CONDITION.BURNING,
          stacks: 1,
          duration: 3
        })),
        actorType: ACTOR.PLAYER
      }
    ]),
    // Only projectiles launched before interruption schedule their heat.
    sideEffects: [{ on: 'castStart', do: { type: 'engineer.blitz-heat' } }]
  },
  [ID.HOLOGRAPHIC_SHOCKWAVE]: {
    cooldown: 15,
    heatGain: 25,
    forgeSkill: true,
    // Custom: Adds skill heat and handles overheat transitions; see `holosmith/mechanics/photon-forge.ts`.

    castTimeMs: 520,
    // Shockwave always critically strikes and blasts the active combo field.
    comboFinishers: [{ ownerId: 'engineer', finisherType: COMBO_FINISHER.BLAST }],
    effects: [
      {
        weaponStrengthProfileId: 'transform.photon-forge',
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        name: 'Holographic Shockwave',
        forceCrit: true,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.LAUNCH
      }
    ],
    // Schedule the authored heat at semantic completion through the shared overheat-aware owner.
    sideEffects: [{ on: 'castStart', do: { type: 'engineer.forge-heat' } }]
  }
});
