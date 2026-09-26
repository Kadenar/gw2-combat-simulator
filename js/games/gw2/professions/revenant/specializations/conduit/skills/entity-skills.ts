/**
 * Owns Conduit entity-legend weapon and stance skill fragments.
 * Cast behavior is routed through `conduit/live.ts`.
 */
import { impactEffects } from '#gw2/platform/engine/effects/authoring.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';

// Both API identities represent the same skill, so one fragment keeps their simulation behavior synchronized.
const BEGUILING_HAZE_SKILL: Partial<Skill> = {
  // Custom: Selects initial/follow-up packets and charge state from affinity; see `conduit/live.ts`.
  // Relic of Peitha impacts 320 ms after the strike, which lands 40 ms before either variant's cast end.
  shadowstepSkill: true,
  peithaImpactAnchor: 'castEnd',
  peithaImpactDelayMs: 280,
  castTimeMs: 200,
  cooldown: 10,
  ammoCastLockout: 0,
  ammo: 1,
  ammoRecharge: 10,
  energyCost: 20,
  effects: [
    {
      type: 'strike',
      name: 'Beguiling Haze',
      actorType: 'player',
      ticks: [{ atMs: 520, coefficient: 2.2 }],
      timingAnchor: 'castStart',
      timingScale: 'fixed'
    }
  ],
  legendId: 'LegendaryEntity'
};

// Both API identities represent the same skill, so one fragment keeps their simulation behavior synchronized.
const TWIN_MOON_SWEEP_SKILL: Partial<Skill> = {
  // Custom: Materializes affinity-dependent strikes and state changes; see `conduit/live.ts`.
  castTimeMs: 920,
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
  // Share timing defaults while preserving each packet, effect order, and local schedule.
  effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
    {
      type: 'strike',
      ticks: [{ atMs: 880, coefficient: 2.5 }],
      name: 'Twin Moon Sweep — Player',
      actorType: 'player',
      metadata: { affinityOnHit: true }
    },
    {
      type: 'strike',
      ticks: [{ atMs: 880, coefficient: 2.5 }],
      name: 'Twin Moon Sweep — Fragment',
      actorType: 'player'
    },
    {
      type: 'condition',
      ticks: Array.from({ length: 2 }, (_, index) => ({
        atMs: 880 + index * 0,
        condition: 'Bleeding',
        stacks: 2,
        duration: 3
      })),
      actorType: 'player'
    },
    {
      type: 'boon',
      boon: 'might',
      stacks: 2,
      duration: 8,
      applications: 2,
      intervalMs: 0,
      atMs: 880
    },
    {
      type: 'condition',
      ticks: [{ atMs: 880, condition: 'Immobilized', stacks: 1, duration: 2 }],
      actorType: 'player',
      metadata: { legendId: LEGEND.ASSASSIN }
    },
    {
      type: 'strike',
      coefficient: 0.4,
      hits: 2,
      atMs: 1400,
      name: 'Twin Moon Sweep — Shatter',
      actorType: 'player',
      metadata: { legendId: LEGEND.DEMON }
    },
    {
      type: 'condition',
      ticks: Array.from({ length: 2 }, (_, index) => ({
        atMs: 1400 + index * 0,
        condition: 'Confusion',
        stacks: 3,
        duration: 3
      })),
      actorType: 'player',
      metadata: { legendId: LEGEND.DEMON }
    }
  ]),
  legendId: 'LegendaryEntity'
};

// Align measured impacts and their attached effects on the nearest 40 ms action tick.
export const CONDUIT_ENTITY_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.BEGUILING_HAZE_ID_76805]: BEGUILING_HAZE_SKILL,
  [ID.TWIN_MOON_SWEEP]: TWIN_MOON_SWEEP_SKILL,
  [ID.TWIN_MOON_SWEEP_ID_77001]: TWIN_MOON_SWEEP_SKILL,
  [ID.BEGUILING_HAZE]: BEGUILING_HAZE_SKILL,
  [ID.HEX_EATER_VORTEX]: {
    // Custom: Materializes affinity-dependent pulses and charge consumption; see `conduit/live.ts`.
    castTimeMs: 520,
    cooldown: 5,
    energyCost: 15,
    // Keep each projectile's strike and Torment on the same fixed impact tick.
    // Share timing defaults while preserving each packet, effect order, and local schedule.
    effects: impactEffects({ timingAnchor: 'castStart', timingScale: 'fixed' }, [
      {
        type: 'strike',
        name: 'Hex-Eater Vortex',
        actorType: 'player',
        ticks: [440, 560, 680, 800, 920, 1040].map((atMs) => ({
          atMs,
          coefficient: 0.2
        }))
      },
      {
        type: 'condition',
        name: 'Hex-Eater Vortex',
        actorType: 'player',
        ticks: [440, 560, 680, 800, 920, 1040].map((atMs) => ({
          atMs,
          condition: 'Torment',
          stacks: 1,
          duration: 1.5
        }))
      }
    ]),
    legendId: 'LegendaryEntity'
  },
  [ID.GLADIATORS_DEFENSE]: {
    // Custom: Materializes affinity-dependent packets and defense state; see `conduit/live.ts`.
    // The stunbreak commits before the remaining animation, which the default input cancels.
    castTimeMs: 240,
    interruptCommitMs: 40,
    defaultInterruptMs: 40,
    cooldown: 5,
    energyCost: 10,
    effects: [
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
    ],
    legendId: 'LegendaryEntity'
  },
  [ID.LEGENDARY_ENTITY_STANCE]: {
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: []
  }
});
