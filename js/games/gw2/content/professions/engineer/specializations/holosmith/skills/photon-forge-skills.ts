/**
 * Owns Photon Forge skill fragments, heat variants, and forge-only actions.
 * Persistent heat and forge state live under `mechanics/photon-forge.ts`.
 */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/content/professions/engineer/data/ids.js';
import type { HolosmithSkillFragment } from '#gw2/content/professions/engineer/specializations/holosmith/types.js';

/** Supplies Photon Forge fragments to Holosmith module composition. */
export const HOLOSMITH_PHOTON_FORGE_SKILL_MECHANICS: Readonly<Record<string, HolosmithSkillFragment>> = Object.freeze({
  [ID.DEACTIVATE_PHOTON_FORGE]: {
    // Custom: Leaves Photon Forge and starts passive heat decay; see `holosmith/mechanics/photon-forge.ts`.
    handlerId: 'engineer.photon-forge-exit',
    castTimeMs: 0,
    cooldown: 6,
    heatGain: 15,
    effects: [],
    toolbeltParentName: 'Photon Projector',
    countsAsToolbeltSkill: false,
    mechanicSlot: 5
  },
  [ID.FLASH_CUTTER_STORM]: {
    // Custom: Adds skill heat and handles overheat transitions; see `holosmith/mechanics/photon-forge.ts`.
    handlerId: 'engineer.heat',
    quicknessCastTimeMs: 560,
    cooldown: 0,
    heatGain: 3,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Projectile',
        chance: 0.2,
        preferredFieldTypes: ['Fire'],
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 2 }, (_, index) => ({
          atMs: 186.666666666667 + index * 186.666666666667,
          coefficient: 1.6 / 2
        })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Flash Cutter—Storm',
        actorType: 'player',
        damageKind: 'explosion',
        projectile: true
      }
    ],
    forgeSkill: true
  },
  [ID.BRIGHT_SLASH_STORM]: {
    // Custom: Adds skill heat and handles overheat transitions; see `holosmith/mechanics/photon-forge.ts`.
    handlerId: 'engineer.heat',
    quicknessCastTimeMs: 520,
    cooldown: 0,
    heatGain: 3,
    interruptCommitMs: 280,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Projectile',
        chance: 0.2,
        preferredFieldTypes: ['Fire'],
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 320, coefficient: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        name: 'Bright Slash—Storm',
        actorType: 'player',
        damageKind: 'explosion',
        projectile: true
      }
    ],
    forgeSkill: true
  },
  [ID.HOLOGRAPHIC_SHOCKWAVE]: {
    // Custom: Adds skill heat and handles overheat transitions; see `holosmith/mechanics/photon-forge.ts`.
    handlerId: 'engineer.heat',
    castTimeMs: 750,
    cooldown: 15,
    heatGain: 25,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        name: 'Holographic Shockwave',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'launch',
        duration: 0
      }
    ],
    forgeSkill: true
  },
  [ID.ENGAGE_PHOTON_FORGE]: {
    // Custom: Enters Photon Forge and starts its heat lifecycle; see `holosmith/mechanics/photon-forge.ts`.
    handlerId: 'engineer.photon-forge-enter',
    castTimeMs: 0,
    cooldown: 1,
    heatGain: 2,
    effects: [],
    toolbeltParentName: 'Photon Projector',
    countsAsToolbeltSkill: false,
    mechanicSlot: 5
  },
  [ID.HOLO_LEAP]: {
    // Custom: Adds skill heat and handles overheat transitions; see `holosmith/mechanics/photon-forge.ts`.
    handlerId: 'engineer.heat',
    castTimeMs: 750,
    cooldown: 2,
    heatGain: 7,
    effects: [
      {
        type: 'strike',
        coefficient: 1.8,
        hits: 1,
        name: 'Holo Leap',
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 3,
        stacks: 1
      }
    ],
    forgeSkill: true
  },
  [ID.VENT_EXHAUST]: {
    castTimeMs: 0,
    cooldown: 0,
    // Vent Exhaust owns both its combat packets and the heat it vents; Thermal Release Valve only invokes it.
    heatLoss: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1,
        name: 'Vent Exhaust',
        actorType: 'player',
        canCrit: false,
        noCrit: true
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 2,
        duration: 6,
        actorType: 'player'
      }
    ]
  },
  [ID.OVERHEAT]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.LIGHT_STRIKE_STORM]: {
    // Custom: Adds skill heat and handles overheat transitions; see `holosmith/mechanics/photon-forge.ts`.
    handlerId: 'engineer.heat',
    quicknessCastTimeMs: 360,
    cooldown: 0,
    heatGain: 3,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Projectile',
        chance: 0.2,
        preferredFieldTypes: ['Fire'],
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Light Strike—Storm',
        actorType: 'player',
        damageKind: 'explosion',
        projectile: true
      }
    ],
    forgeSkill: true
  },
  [ID.HOLOFORGE_OVERHEATED]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.CORONA_BURST]: {
    // Custom: Adds skill heat and handles overheat transitions; see `holosmith/mechanics/photon-forge.ts`.
    handlerId: 'engineer.heat',
    quicknessCastTimeMs: 480,
    interruptCommitMs: 400,
    cooldown: 6,
    heatGain: 10,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 400, coefficient: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Initial Damage',
        actorType: 'player',
        persistsAfterInterrupt: true,
        damageKind: 'explosion'
      },
      {
        type: 'strike',
        ticks: [{ atMs: 1800, coefficient: 1.5 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Explosion Damage',
        actorType: 'player',
        persistsAfterInterrupt: true,
        damageKind: 'explosion'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 8,
        duration: 8,
        actorType: 'player',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 400, condition: 'Burning', stacks: 2, duration: 5 },
          { atMs: 1800, condition: 'Burning', stacks: 2, duration: 5 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player',
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 1,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 1,
        atMs: 760,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 1,
        atMs: 1120,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 1,
        atMs: 1480,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 1,
        atMs: 1800,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true
      }
    ],
    forgeSkill: true
  },
  [ID.LIGHT_STRIKE]: {
    // Custom: Adds skill heat and handles overheat transitions; see `holosmith/mechanics/photon-forge.ts`.
    handlerId: 'engineer.heat',
    quicknessCastTimeMs: 360,
    interruptCommitMs: 200,
    cooldown: 0,
    heatGain: 2,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 200, coefficient: 1 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        persistsAfterInterrupt: true,
        name: 'Light Strike',
        actorType: 'player'
      }
    ],
    forgeSkill: true
  },
  [ID.DEACTIVATE_PHOTON_FORGE_HOT]: {
    // Custom: Leaves Photon Forge and starts passive heat decay; see `holosmith/mechanics/photon-forge.ts`.
    handlerId: 'engineer.photon-forge-exit',
    castTimeMs: 0,
    cooldown: 6,
    heatGain: 15,
    effects: [],
    toolbeltParentName: 'Photon Projector',
    countsAsToolbeltSkill: false,
    mechanicSlot: 5
  },
  [ID.BRIGHT_SLASH]: {
    // Custom: Adds skill heat and handles overheat transitions; see `holosmith/mechanics/photon-forge.ts`.
    handlerId: 'engineer.heat',
    quicknessCastTimeMs: 520,
    cooldown: 0,
    heatGain: 2,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Bright Slash',
        actorType: 'player'
      }
    ],
    forgeSkill: true
  },
  [ID.PHOTON_BLITZ]: {
    // Custom: Adds skill heat and handles overheat transitions; see `holosmith/mechanics/photon-forge.ts`.
    handlerId: 'engineer.heat',
    quicknessCastTimeMs: 1320,
    cooldown: 10,
    heatGain: 16,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Projectile',
        chance: 0.2,
        preferredFieldTypes: ['Fire'],
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 280, coefficient: 0.64 },
          { atMs: 400, coefficient: 0.64 },
          { atMs: 480, coefficient: 0.64 },
          { atMs: 640, coefficient: 0.64 },
          { atMs: 720, coefficient: 0.64 },
          { atMs: 880, coefficient: 0.64 },
          { atMs: 960, coefficient: 0.64 },
          { atMs: 1120, coefficient: 0.64 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Photon Blitz',
        actorType: 'player',
        projectile: true
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 280, condition: 'Burning', stacks: 1, duration: 3 },
          { atMs: 400, condition: 'Burning', stacks: 1, duration: 3 },
          { atMs: 480, condition: 'Burning', stacks: 1, duration: 3 },
          { atMs: 640, condition: 'Burning', stacks: 1, duration: 3 },
          { atMs: 720, condition: 'Burning', stacks: 1, duration: 3 },
          { atMs: 880, condition: 'Burning', stacks: 1, duration: 3 },
          { atMs: 960, condition: 'Burning', stacks: 1, duration: 3 },
          { atMs: 1120, condition: 'Burning', stacks: 1, duration: 3 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ],
    forgeSkill: true
  },
  [ID.FLASH_CUTTER]: {
    // Custom: Adds skill heat and handles overheat transitions; see `holosmith/mechanics/photon-forge.ts`.
    handlerId: 'engineer.heat',
    quicknessCastTimeMs: 520,
    cooldown: 0,
    heatGain: 2,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 2 }, (_, index) => ({ atMs: 260 + index * 260, coefficient: 1.6 / 2 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Flash Cutter',
        actorType: 'player'
      }
    ],
    forgeSkill: true
  }
});
