/**
 * Owns Holosmith slot, toolbelt, and palette-follow-up skill fragments.
 * Persistent heat and forge state live under `mechanics/photon-forge.ts`.
 */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { HolosmithSkillFragment } from '#gw2/professions/engineer/specializations/holosmith/types.js';

/** Supplies Holosmith slot-skill fragments to Holosmith module composition. */
export const HOLOSMITH_SLOT_SKILL_MECHANICS: Readonly<Record<string, HolosmithSkillFragment>> = Object.freeze({
  [ID.COOLANT_BLAST]: {
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
    // Custom: Consumes the armed follow-up flip and related trait effects; see `core/mechanics/skill-flips.ts`.
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
  [ID.PRIME_LIGHT_BEAM]: {
    quicknessCastTimeMs: 1160,
    cooldown: 60,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Prime Light Beam — Packet 1',
        actorType: 'player',
        damageKind: 'explosion'
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
        controlKind: 'launch',
        duration: 240
      }
    ]
  },
  [ID.LASER_DISK]: {
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
  [ID.PHOTON_WALL]: {
    // Custom: Arms this skill's follow-up palette flip; see `core/mechanics/skill-flips.ts`.
    handlerId: 'engineer.arm-flip',
    quicknessCastTimeMs: 400,
    cooldown: 25,
    paletteFlipSkillId: ID.LAUNCH_WALL,
    effects: []
  },
  [ID.BLADE_BURST]: {
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
  [ID.CAUTERIZE]: {
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
