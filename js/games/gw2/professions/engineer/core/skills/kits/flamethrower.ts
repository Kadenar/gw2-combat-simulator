/** Core Engineer Flamethrower skill mechanics. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/skills/types.js';

const NAPALM_TICK_OFFSETS_MS = [280, 440, 560, 680, 840, 960, 1080, 1240, 1360, 1480];

/** Defines the equip action, palette skills, stow action, and linked toolbelt skill for Flamethrower. */
export const ENGINEER_FLAMETHROWER_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  [ID.FLAMETHROWER]: {
    // Custom: Equips the kit and updates bundle/weapon state; see `core/mechanics/kits.ts`.
    handlerId: 'engineer.kit-equip',
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kitName: 'Flamethrower'
  },
  [ID.FLAME_JET]: {
    castTimeMs: 2570,
    cooldown: 0,
    effects: [
      {
        type: 'strike',
        ticks: [160, 360, 520, 680, 880, 1040, 1200, 1360, 1560, 1720].map((atMs) => ({ atMs, coefficient: 2.5 / 10 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Flame Jet',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 4,
        actorType: 'player'
      }
    ],
    kit: 'Flamethrower'
  },
  [ID.NAPALM]: {
    quicknessCastTimeMs: 1760,
    cooldown: 25,
    // Napalm fires independent volleys, so interruption retains only packets launched before the cutoff.
    interruptMode: 'per-packet',
    effects: [
      {
        type: 'strike',
        // The EVTC records five visual volleys as ten damage packets. Each
        // packet has a 0.5 coefficient and a matching Burning application.
        ticks: NAPALM_TICK_OFFSETS_MS.map((atMs) => ({ atMs, coefficient: 0.5 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Napalm',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: NAPALM_TICK_OFFSETS_MS.map((atMs) => ({ atMs, condition: 'Burning', stacks: 1, duration: 3.25 })),
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        actorType: 'player'
      }
    ],
    kit: 'Flamethrower'
  },
  [ID.AIR_BLAST]: {
    quicknessCastTimeMs: 360,
    cooldown: 15,
    effects: [
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 1,
        duration: 5,
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'knockback',
        duration: 400
      }
    ],
    kit: 'Flamethrower'
  },
  [ID.FLAME_BLAST]: {
    quicknessCastTimeMs: 800,
    cooldown: 6,
    // Flame Blast launches its blast finisher around 480 ms, but a committed cancel keeps the serial lane locked through the full animation.
    retainsCastLockoutAfterInterrupt: true,
    effects: [
      {
        type: 'strike',
        ticks: [{ atMs: 480, coefficient: 1.3 }],
        name: 'Flame Blast',
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        interruptCommitMs: 480,
        actorType: 'player',
        comboFinishers: [
          {
            ownerId: 'engineer',
            finisherType: 'Blast',
            ambiguousFieldSelection: 'oldest'
          }
        ],
        damageKind: 'explosion',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [{ atMs: 480, condition: 'Burning', stacks: 1, duration: 6 }],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        interruptCommitMs: 480,
        actorType: 'player',
        persistsAfterInterrupt: true
      }
    ],
    kit: 'Flamethrower'
  },
  [ID.STOW_FLAMETHROWER]: {
    // Custom: Stows the active kit and restores weapon state; see `core/mechanics/kits.ts`.
    handlerId: 'engineer.kit-stow',
    paletteFlip: false,
    castTimeMs: 0,
    cooldown: 0,
    effects: [],
    kit: 'Flamethrower'
  },
  [ID.SMOKE_VENT]: {
    castTimeMs: 0,
    cooldown: 15,
    effects: [
      {
        type: 'blind',
        actorType: 'player'
      }
    ],
    toolbeltParentName: 'Flamethrower'
  },
  [ID.STOKE_THE_FLAMES]: {
    quicknessCastTimeMs: 440,
    cooldown: 20,
    comboFields: [
      {
        ownerId: 'engineer',
        fieldType: 'Fire',
        duration: 1,
        startAnchor: 'castEnd',
        inclusiveExpiry: true
      }
    ],
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Stoke the Flames',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Burning',
        stacks: 2,
        duration: 6,
        actorType: 'player'
      },
      {
        type: 'boon',
        boon: 'quickness',
        duration: 5,
        stacks: 1
      },
      {
        type: 'boon',
        boon: 'might',
        duration: 8,
        stacks: 8
      }
    ],
    kit: 'Flamethrower'
  }
});
