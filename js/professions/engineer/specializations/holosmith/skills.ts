/** Holosmith-only Engineer mechanics, including the heat-aware sword variants. */
import { ENGINEER_SKILL_IDS as ID } from '../../data/ids.js';
import type { SkillFragment } from '../../../../platform/engine/types.js';
export const HOLOSMITH_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  // Holosmith owns the original sword IDs; Core owns the non-heat Weaponmaster variants.
  [ID.RADIANT_ARC]: {
    implemented: true,
    quicknessCastTimeMs: 840,
    cooldown: 12,
    comboFinishers: [
      {
        ownerId: 'engineer',
        finisherType: 'Leap',
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 2.5,
        hits: 1,
        name: 'Radiant Arc',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      },
      {
        type: 'custom',
        eventType: 'engineer.radiant-arc-quickness',
        event: {
          name: 'Radiant Arc - quickness'
        },
        actorType: 'player'
      }
    ]
  },
  [ID.SUN_EDGE]: {
    implemented: true,
    quicknessCastTimeMs: 440,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.88,
        hits: 1,
        name: 'Sun Edge',
        atMs: 350,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 10,
        atMs: 350,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.REFRACTION_CUTTER]: {
    implemented: true,
    quicknessCastTimeMs: 520,
    cooldown: 6,
    effects: [
      {
        type: 'strike',
        coefficient: 1.4,
        hits: 1,
        atMs: 320,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Refraction Cutter - Packet 1',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Refraction Cutter Blade',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Projectile',
            preferredFieldTypes: ['Fire'],
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {
          projectile: true
        }
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4,
        atMs: 360,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'custom',
        eventType: 'engineer.refraction-cutter-extra-blades',
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        event: {
          name: 'Refraction Cutter extra blades'
        },
        actorType: 'player'
      }
    ]
  },
  [ID.REFRACTION_CUTTER_BLADE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.4,
        hits: 1,
        name: 'Refraction Cutter Blade',
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Projectile',
            preferredFieldTypes: ['Fire'],
            ambiguousFieldSelection: 'oldest'
          }
        ],
        metadata: {
          projectile: true
        }
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.SUN_RIPPER]: {
    implemented: true,
    quicknessCastTimeMs: 480,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 0.93,
        hits: 1,
        name: 'Sun Ripper',
        atMs: 450,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Vulnerability',
        stacks: 1,
        duration: 10,
        atMs: 450,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.GLEAM_SABER]: {
    implemented: true,
    handlerId: 'engineer.gleam-saber',
    quicknessCastTimeMs: 720,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Gleam Saber',
        atMs: 600,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ]
  },
  [ID.COOLANT_BLAST]: {
    implemented: true,
    castTimeMs: 750,
    cooldown: 20,
    effects: [
      {
        type: 'condition',
        condition: 'Chilled',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ]
  },
  [ID.LAUNCH_WALL]: {
    implemented: true,
    handlerId: 'engineer.consume-flip',
    quicknessCastTimeMs: 520,
    cooldown: 0.5,
    flipParentName: 'Photon Wall',
    effects: [
      {
        type: 'custom',
        eventType: 'engineer.launch-wall',
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        event: {
          name: 'Launch Wall'
        },
        actorType: 'player'
      }
    ]
  },
  [ID.DEACTIVATE_PHOTON_FORGE]: {
    implemented: true,
    handlerId: 'engineer.photon-forge-exit',
    castTimeMs: 0,
    cooldown: 6,
    heatGain: 15,
    effects: [],
    toolbeltParentName: 'Photon Projector',
    countsAsToolbeltSkill: false,
    mechanicSlot: 5
  },
  [ID.SPECTRUM_SHIELD]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'boon',
        boon: 'stability',
        duration: 4,
        stacks: 6
      }
    ]
  },
  [ID.FLASH_CUTTER_STORM]: {
    implemented: true,
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
        coefficient: 1.6,
        hits: 2,
        atMs: 280,
        intervalMs: 280,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Flash Cutter—Storm',
        actorType: 'player',
        metadata: {
          damageKind: 'explosion',
          projectile: true
        }
      }
    ],
    forgeSkill: true
  },
  [ID.PRIME_LIGHT_BEAM]: {
    implemented: true,
    quicknessCastTimeMs: 1160,
    cooldown: 60,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Prime Light Beam — Packet 1',
        actorType: 'player',
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'custom',
        eventType: 'engineer.prime-light-beam-field',
        atMs: 0,
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        event: {
          name: 'Prime Light Beam — field'
        },
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'launch',
          duration: 240
        }
      }
    ]
  },
  [ID.BRIGHT_SLASH_STORM]: {
    implemented: true,
    handlerId: 'engineer.heat',
    quicknessCastTimeMs: 520,
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
        name: 'Bright Slash—Storm',
        actorType: 'player',
        metadata: {
          damageKind: 'explosion',
          projectile: true
        }
      }
    ],
    forgeSkill: true
  },
  [ID.HOLOGRAPHIC_SHOCKWAVE]: {
    implemented: true,
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
        metadata: {
          controlKind: 'launch',
          duration: 0
        }
      }
    ],
    forgeSkill: true
  },
  [ID.LASER_DISK]: {
    implemented: true,
    quicknessCastTimeMs: 960,
    cooldown: 30,
    effects: [
      {
        type: 'custom',
        eventType: 'engineer.laser-disk',
        atMs: 0,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        event: {
          name: 'Laser Disk'
        },
        actorType: 'player'
      }
    ]
  },
  [ID.ENGAGE_PHOTON_FORGE]: {
    implemented: true,
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
    implemented: true,
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
    implemented: true,
    handlerId: 'engineer.heat',
    castTimeMs: 0,
    cooldown: 0,
    heatGain: 15,
    effects: [
      {
        type: 'strike',
        coefficient: 1.1,
        hits: 1,
        name: 'Vent Exhaust',
        actorType: 'player',
        metadata: {
          noCrit: true
        }
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
  [ID.PHOTON_WALL]: {
    implemented: true,
    handlerId: 'engineer.arm-flip',
    quicknessCastTimeMs: 400,
    cooldown: 25,
    paletteFlipSkillId: ID.LAUNCH_WALL,
    effects: []
  },
  [ID.OVERHEAT]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.LIGHT_STRIKE_STORM]: {
    implemented: true,
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
        metadata: {
          damageKind: 'explosion',
          projectile: true
        }
      }
    ],
    forgeSkill: true
  },
  [ID.HOLOFORGE_OVERHEATED]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.CORONA_BURST]: {
    implemented: true,
    handlerId: 'engineer.heat',
    quicknessCastTimeMs: 480,
    interruptCommitMs: 400,
    cooldown: 6,
    heatGain: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        atMs: 400,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Initial Damage',
        actorType: 'player',
        persistsAfterInterrupt: true,
        metadata: {
          damageKind: 'explosion'
        }
      },
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        atMs: 1800,
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Explosion Damage',
        actorType: 'player',
        persistsAfterInterrupt: true,
        metadata: {
          damageKind: 'explosion'
        }
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
    implemented: true,
    handlerId: 'engineer.heat',
    quicknessCastTimeMs: 360,
    cooldown: 0,
    heatGain: 2,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Light Strike',
        actorType: 'player'
      }
    ],
    forgeSkill: true
  },
  [ID.HARD_LIGHT_ARENA]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 35,
    effects: [
      {
        type: 'boon',
        boon: 'fury',
        duration: 2,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'protection',
        duration: 2,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'regeneration',
        duration: 2,
        stacks: 1
      }
    ]
  },
  [ID.DEACTIVATE_PHOTON_FORGE_HOT]: {
    implemented: true,
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
    implemented: true,
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
    implemented: true,
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
          { atMs: 240, coefficient: 0.64 },
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
        metadata: {
          projectile: true
        }
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 240, condition: 'Burning', stacks: 1, duration: 3 },
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
    implemented: true,
    handlerId: 'engineer.heat',
    quicknessCastTimeMs: 520,
    cooldown: 0,
    heatGain: 2,
    effects: [
      {
        type: 'strike',
        coefficient: 1.6,
        hits: 2,
        atMs: 390,
        intervalMs: 390,
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Flash Cutter',
        actorType: 'player'
      }
    ],
    forgeSkill: true
  },
  [ID.PRISMATIC_SINGULARITY]: {
    implemented: true,
    castTimeMs: 500,
    cooldown: 30,
    effects: [
      {
        type: 'strike',
        coefficient: 0.1,
        hits: 1,
        name: 'Pull Damage',
        actorType: 'player'
      },
      {
        type: 'strike',
        coefficient: 1.2,
        hits: 1,
        name: 'Explosion Damage',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        metadata: {
          controlKind: 'pull',
          duration: 240
        }
      }
    ],
    toolbeltParentName: 'Hard Light Arena'
  },
  [ID.BLADE_BURST]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        coefficient: 0.8,
        hits: 1,
        name: 'Blade Burst',
        weapon: 'Profession mechanic',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Bleeding',
        stacks: 1,
        duration: 6,
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Laser Disk'
  },
  [ID.FLASH_SPARK]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 25,
    effects: [
      {
        type: 'blind',
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Spectrum Shield'
  },
  [ID.CAUTERIZE]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 30,
    effects: [
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Coolant Blast',
    mechanicSlot: 1
  },
  [ID.PARTICLE_ACCELERATOR]: {
    implemented: true,
    castTimeMs: 0,
    cooldown: 8,
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'Particle Accelerator',
        weapon: 'Profession mechanic',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 1,
        duration: 3,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'swiftness',
        duration: 3,
        stacks: 1
      }
    ],
    toolbeltParentName: 'Photon Wall'
  }
});
