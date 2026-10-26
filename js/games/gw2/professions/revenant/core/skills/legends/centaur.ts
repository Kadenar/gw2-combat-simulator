import { ACTOR, CONTROL, RECIPIENT, BOON } from '#gw2/platform/constants.js';
/** Owns Legendary Centaur Stance skill fragments and their alternate identities. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const REVENANT_CENTAUR_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.PROTECTIVE_SOLACE]: {
    // The parent recharges when its shield is released, rather than while it is active.
    cooldown: 0,
    manualReleaseCooldown: 5,
    energyCost: 5,
    upkeepCost: 8,
    pulseInterval: 1,
    legendId: 'LegendaryCentaur',
    // Custom: Starts/stops upkeep drain and schedules upkeep pulses; see `core/mechanics/upkeep.ts`.
    castTimeMs: 0,
    effects: [],
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } }
    ]
  },
  [ID.NATURAL_HARMONY]: {
    cooldown: 2,
    energyCost: 20,
    legendId: 'LegendaryCentaur',
    castTimeMs: 0,
    effects: []
  },
  [ID.ENERGY_EXPULSION]: {
    cooldown: 2,
    energyCost: 35,
    legendId: 'LegendaryCentaur',
    castTimeMs: 0,
    effects: [
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONTROL.KNOCKDOWN
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.STABILITY,
        duration: 5,
        stacks: 3
      }
    ]
  },
  [ID.DIMINISH_SOLACE]: {
    cooldown: 0,
    energyCost: 0,
    // Reuse upkeep teardown and availability checks for the matching active shield.
    castTimeMs: 0,
    effects: [],
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [{ on: 'castCommit', do: { type: 'revenant.release-upkeep' } }]
  },
  [ID.PURIFYING_ESSENCE]: {
    cooldown: 5,
    energyCost: 25,
    legendId: 'LegendaryCentaur',
    castTimeMs: 0,
    effects: []
  },
  [ID.VENTARIS_WILL]: {
    cooldown: 0.25,
    energyCost: 0,
    legendId: 'LegendaryCentaur',
    castTimeMs: 0,
    effects: []
  },
  [ID.PROJECT_TRANQUILITY]: {
    cooldown: 2,
    energyCost: 0,
    legendId: 'LegendaryCentaur',
    castTimeMs: 0,
    effects: []
  },
  [ID.PROTECTIVE_SOLACE_ID_29310]: {
    cooldown: 5,
    energyCost: 5,
    upkeepCost: 8,
    pulseInterval: 1,
    legendId: 'LegendaryCentaur',
    // Custom: Starts/stops upkeep drain and schedules upkeep pulses; see `core/mechanics/upkeep.ts`.
    castTimeMs: 0,
    effects: [],
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } }
    ]
  }
});
