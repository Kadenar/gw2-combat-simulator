/**
 * Owns Conduit entity-legend weapon and stance skill fragments.
 * Cast behavior is routed through `execution/entities.ts`.
 */
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as ID } from '#gw2/content/professions/revenant/data/ids.js';
import type { SkillFragment } from '#gw2/platform/engine/types.js';

const BEGUILING_HAZE_EFFECTS = Object.freeze([
  {
    type: 'strike',
    name: 'Beguiling Haze',
    actorType: 'player',
    ticks: [{ atMs: 522, coefficient: 2.2 }],
    timingAnchor: 'castStart',
    timingScale: 'fixed'
  }
] as const);

const HEX_EATER_VORTEX_EFFECTS = Object.freeze([
  {
    type: 'strike',
    name: 'Hex-Eater Vortex',
    actorType: 'player',
    ticks: [443, 562, 682, 802, 920, 1039].map((atMs) => ({
      atMs,
      coefficient: 0.2
    })),
    timingAnchor: 'castStart',
    timingScale: 'fixed'
  },
  {
    type: 'condition',
    name: 'Hex-Eater Vortex',
    actorType: 'player',
    ticks: [443, 562, 682, 802, 920, 1039].map((atMs) => ({
      atMs,
      condition: 'Torment',
      stacks: 1,
      duration: 1.5
    })),
    timingAnchor: 'castStart',
    timingScale: 'fixed'
  }
] as const);

const GLADIATORS_DEFENSE_EFFECTS = Object.freeze([
  {
    type: 'strike',
    coefficient: 1.5,
    hits: 1,
    name: "Gladiator's Defense",
    actorType: 'player'
  },
  {
    type: 'condition',
    condition: 'Weakness',
    stacks: 1,
    duration: 5,
    actorType: 'player'
  },
  { type: 'boon', boon: 'resolution', duration: 3, stacks: 1 },
  { type: 'boon', boon: 'resistance', duration: 3, stacks: 1 }
] as const);

const TWIN_MOON_SWEEP_EFFECTS = Object.freeze([
  {
    type: 'strike',
    ticks: [{ atMs: 880, coefficient: 2.5 }],
    name: 'Twin Moon Sweep — Player',
    actorType: 'player',
    timingAnchor: 'castStart',
    timingScale: 'fixed',
    metadata: { affinityOnHit: true }
  },
  {
    type: 'strike',
    ticks: [{ atMs: 880, coefficient: 2.5 }],
    name: 'Twin Moon Sweep — Fragment',
    actorType: 'player',
    timingAnchor: 'castStart',
    timingScale: 'fixed'
  },
  {
    type: 'condition',
    ticks: Array.from({ length: 2 }, (_, index) => ({
      atMs: 880 + index * 0,
      condition: 'Bleeding',
      stacks: 2,
      duration: 3
    })),
    actorType: 'player',
    timingAnchor: 'castStart',
    timingScale: 'fixed'
  },
  {
    type: 'boon',
    boon: 'might',
    stacks: 2,
    duration: 8,
    applications: 2,
    intervalMs: 0,
    atMs: 880,
    timingAnchor: 'castStart',
    timingScale: 'fixed'
  },
  {
    type: 'condition',
    ticks: [{ atMs: 880, condition: 'Immobilized', stacks: 1, duration: 2 }],
    actorType: 'player',
    timingAnchor: 'castStart',
    timingScale: 'fixed',
    metadata: { legendId: LEGEND.ASSASSIN }
  },
  {
    type: 'strike',
    coefficient: 0.4,
    hits: 2,
    atMs: 1402,
    name: 'Twin Moon Sweep — Shatter',
    actorType: 'player',
    timingAnchor: 'castStart',
    timingScale: 'fixed',
    metadata: { legendId: LEGEND.DEMON }
  },
  {
    type: 'condition',
    ticks: Array.from({ length: 2 }, (_, index) => ({
      atMs: 1402 + index * 0,
      condition: 'Confusion',
      stacks: 3,
      duration: 3
    })),
    actorType: 'player',
    timingAnchor: 'castStart',
    timingScale: 'fixed',
    metadata: { legendId: LEGEND.DEMON }
  }
] as const);

export const CONDUIT_ENTITY_SKILL_MECHANICS: Readonly<Record<number, SkillFragment>> = Object.freeze({
  [ID.BEGUILING_HAZE_ID_76805]: {
    // Custom: Selects initial/follow-up packets and charge state from affinity; see `execution/entities.ts`.
    handlerId: 'revenant.beguiling-haze',
    castTimeMs: 250,
    cooldown: 10,
    recharge: 0,
    ammo: 1,
    ammoRecharge: 10,
    energyCost: 20,
    effects: BEGUILING_HAZE_EFFECTS,
    legendId: 'LegendaryEntity'
  },
  [ID.TWIN_MOON_SWEEP]: {
    // Custom: Materializes affinity-dependent strikes and state changes; see `execution/entities.ts`.
    handlerId: 'revenant.twin-moon-sweep',
    quicknessCastTimeMs: 920,
    cooldown: 3,
    energyCost: 25,
    affinityOnHit: true,
    comboFinishers: [
      {
        ownerId: 'revenant',
        finisherType: 'Whirl',
        applications: 2,
        effectDelay: 0.04,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: TWIN_MOON_SWEEP_EFFECTS,
    legendId: 'LegendaryEntity'
  },
  [ID.TWIN_MOON_SWEEP_ID_77001]: {
    // Custom: Materializes affinity-dependent strikes and state changes; see `execution/entities.ts`.
    handlerId: 'revenant.twin-moon-sweep',
    quicknessCastTimeMs: 920,
    cooldown: 3,
    energyCost: 25,
    affinityOnHit: true,
    comboFinishers: [
      {
        ownerId: 'revenant',
        finisherType: 'Whirl',
        applications: 2,
        effectDelay: 0.04,
        ambiguousFieldSelection: 'oldest'
      }
    ],
    effects: TWIN_MOON_SWEEP_EFFECTS,
    legendId: 'LegendaryEntity'
  },
  [ID.BEGUILING_HAZE]: {
    // Custom: Selects initial/follow-up packets and charge state from affinity; see `execution/entities.ts`.
    handlerId: 'revenant.beguiling-haze',
    castTimeMs: 250,
    cooldown: 10,
    recharge: 0,
    ammo: 1,
    ammoRecharge: 10,
    energyCost: 20,
    effects: BEGUILING_HAZE_EFFECTS,
    legendId: 'LegendaryEntity'
  },
  [ID.HEX_EATER_VORTEX]: {
    // Custom: Materializes affinity-dependent pulses and charge consumption; see `execution/entities.ts`.
    handlerId: 'revenant.hex-eater-vortex',
    quicknessCastTimeMs: 526,
    cooldown: 5,
    energyCost: 15,
    effects: HEX_EATER_VORTEX_EFFECTS,
    legendId: 'LegendaryEntity'
  },
  [ID.GLADIATORS_DEFENSE]: {
    // Custom: Materializes affinity-dependent packets and defense state; see `execution/entities.ts`.
    handlerId: 'revenant.gladiators-defense',
    castTimeMs: 40,
    defaultInterruptMs: 40,
    cooldown: 5,
    energyCost: 10,
    effects: GLADIATORS_DEFENSE_EFFECTS,
    legendId: 'LegendaryEntity'
  },
  [ID.LEGENDARY_ENTITY_STANCE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  }
});
