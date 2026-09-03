/** Core Engineer Flamethrower skill mechanics. */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

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
        ticks: Array.from({ length: 10 }, (_, index) => ({ atMs: 172 + index * 172, coefficient: 2.5 / 10 })),
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
        ticks: [
          { atMs: 280, coefficient: 0.5 },
          { atMs: 441, coefficient: 0.5 },
          { atMs: 560, coefficient: 0.5 },
          { atMs: 679, coefficient: 0.5 },
          { atMs: 842, coefficient: 0.5 },
          { atMs: 955, coefficient: 0.5 },
          { atMs: 1077, coefficient: 0.5 },
          { atMs: 1240, coefficient: 0.5 },
          { atMs: 1361, coefficient: 0.5 },
          { atMs: 1482, coefficient: 0.5 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'fixed',
        name: 'Napalm',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 280, condition: 'Burning', stacks: 1, duration: 3.25 },
          { atMs: 441, condition: 'Burning', stacks: 1, duration: 3.25 },
          { atMs: 560, condition: 'Burning', stacks: 1, duration: 3.25 },
          { atMs: 679, condition: 'Burning', stacks: 1, duration: 3.25 },
          { atMs: 842, condition: 'Burning', stacks: 1, duration: 3.25 },
          { atMs: 955, condition: 'Burning', stacks: 1, duration: 3.25 },
          { atMs: 1077, condition: 'Burning', stacks: 1, duration: 3.25 },
          { atMs: 1240, condition: 'Burning', stacks: 1, duration: 3.25 },
          { atMs: 1361, condition: 'Burning', stacks: 1, duration: 3.25 },
          { atMs: 1482, condition: 'Burning', stacks: 1, duration: 3.25 }
        ],
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
