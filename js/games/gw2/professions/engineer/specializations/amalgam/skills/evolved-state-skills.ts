/**
 * Owns Amalgam Evolve, locked-slot, and evolved-state skill fragments.
 * Persistent strain and morph state remain under `mechanics/evolved-form.ts`.
 */
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

const PLASMATIC_STATE_QUICKNESS_CAST_TIME_MS = 480 + 480;
const PLASMATIC_STATE_RECHARGE_OFFSET_MS = 480;

/** Supplies Evolve and its state-dependent action identities to specialization composition. */
export const AMALGAM_EVOLVED_STATE_SKILL_MECHANICS: Readonly<Record<string, SkillFragment>> = Object.freeze({
  [ID.SYMBIOTIC_SHIELDING]: {
    castTimeMs: 0,
    cooldown: 25,
    effects: [],
    toolbeltParentName: 'Mitotic State',
    mechanicSlot: 1
  },
  [ID.EVOLVE]: {
    countsAsToolbeltSkill: true,
    // Custom: Consumes the selected strain and enters Evolved form; see `amalgam/mechanics/evolved-form.ts`.
    handlerId: 'engineer.evolve',
    quicknessCastTimeMs: 640,
    cooldown: 40,
    effects: [],
    mechanicSlot: 5
  },
  [ID.EVOLVE_ID_76651]: {
    countsAsToolbeltSkill: true,
    // Custom: Consumes the selected strain and enters Evolved form; see `amalgam/mechanics/evolved-form.ts`.
    handlerId: 'engineer.evolve',
    quicknessCastTimeMs: 640,
    cooldown: 40,
    ammo: 2,
    effects: [],
    mechanicSlot: 5
  },
  [ID.MITOTIC_STATE]: {
    castTimeMs: 1000,
    cooldown: 20,
    effects: []
  },
  [ID.LOCKED]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.LIQUID_STATE]: {
    castTimeMs: 1500,
    cooldown: 20,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 4 }, (_, index) => ({ atMs: 250 + index * 250, coefficient: 3.2 / 4 })),
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Liquid State',
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Poisoned',
        stacks: 4,
        duration: 12,
        actorType: 'player'
      },
      {
        type: 'condition',
        condition: 'Crippled',
        stacks: 4,
        duration: 1,
        actorType: 'player'
      }
    ]
  },
  [ID.FLUX_STATE]: {
    quicknessCastTimeMs: 640,
    cooldown: 50,
    effects: [
      {
        type: 'strike',
        coefficient: 2,
        hits: 1,
        name: 'Flux State — Packet 1',
        actorType: 'player'
      },
      {
        type: 'strike',
        // EVTC field packets land on a measured ~520 ms cadence; preserving
        // it also prevents exact-boundary distortion for 0.5-second ICDs.
        ticks: Array.from({ length: 12 }, (_, index) => ({ atMs: 520 + index * 520, coefficient: 9 / 12 })),
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        name: 'Storm Damage',
        actorType: 'player'
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 520, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 1040, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 1560, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 2080, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 2600, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 3120, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 3640, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 4160, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 4680, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 5200, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 5720, condition: 'Bleeding', stacks: 1, duration: 5 },
          { atMs: 6240, condition: 'Bleeding', stacks: 1, duration: 5 }
        ],
        timingAnchor: 'castEnd',
        timingScale: 'fixed',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'pull',
        duration: 360
      }
    ]
  },
  [ID.SOLID_STATE]: {
    castTimeMs: 750,
    cooldown: 25,
    effects: [
      {
        type: 'strike',
        coefficient: 3,
        hits: 1,
        name: 'Solid State',
        actorType: 'player'
      },
      {
        type: 'control',
        actorType: 'player',
        controlKind: 'stun',
        duration: 2
      },
      {
        type: 'boon',
        boon: 'stability',
        duration: 5,
        stacks: 5
      }
    ]
  },
  [ID.LOCKED_ID_77107]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  },
  [ID.PLASMATIC_STATE]: {
    interruptCommitMs: 0,
    // Custom: Activates Plasmatic State and its duration/state event; see `amalgam/mechanics/evolved-form.ts`.
    handlerId: 'engineer.plasmatic-state',
    quicknessCastTimeMs: PLASMATIC_STATE_QUICKNESS_CAST_TIME_MS,
    cooldown: 25,
    rechargeAnchor: 'castStart',
    rechargeOffsetMs: PLASMATIC_STATE_RECHARGE_OFFSET_MS,
    effects: [
      {
        type: 'strike',
        ticks: [
          { atMs: 426.666666666667, coefficient: 2.25 },
          { atMs: 786.666666666667, coefficient: 2.25 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        name: 'Plasmatic State',
        actorType: 'player',
        persistsAfterInterrupt: true
      },
      {
        type: 'condition',
        ticks: [
          { atMs: 426.666666666667, condition: 'Burning', stacks: 2, duration: 5 },
          { atMs: 786.666666666667, condition: 'Burning', stacks: 2, duration: 5 }
        ],
        timingAnchor: 'castStart',
        timingScale: 'cast',
        actorType: 'player',
        persistsAfterInterrupt: true
      }
    ]
  },
  [ID.LOCKED_ID_77388]: {
    castTimeMs: 0,
    cooldown: 0,
    effects: []
  }
});
