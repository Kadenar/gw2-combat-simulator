import { ACTOR, RECIPIENT, BOON, CONDITION } from '#gw2/platform/constants.js';
import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime } from '#kernel/core/clock.js';
/** Owns Legendary Dwarf Stance skill fragments and their alternate identities. */
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { Skill } from '#gw2/platform/skills/types.js';

export const REVENANT_DWARF_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.VENGEFUL_HAMMERS]: {
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } }
    ],
    // Shared upkeep owns the drain; upkeep-pulses.ts schedules the legend-owned payload below.
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 5,
    upkeepCost: 6,
    pulseInterval: 1 / 3,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 3,
        atMs: 0,
        name: 'Vengeful Hammers',
        actorType: ACTOR.EFFECT
      }
    ],
    legendId: 'LegendaryDwarf'
  },
  [ID.FORCED_ENGAGEMENT]: {
    castTimeMs: 360,
    cooldown: 15,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Forced Engagement',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.SLOW,
        stacks: 1,
        duration: 4,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONDITION.TAUNT.toLowerCase()
      }
    ],
    legendId: 'LegendaryDwarf'
  },
  [ID.RELEASE_HAMMERS]: {
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [{ on: 'castCommit', do: { type: 'revenant.release-upkeep' } }],
    // Custom: Releases the active upkeep skill and exposes its parent again; see `core/mechanics/upkeep.ts`.
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 0,
    effects: [],
    legendId: 'LegendaryDwarf'
  },
  [ID.SOOTHING_STONE]: {
    castTimeMs: 680,
    cooldown: 30,
    energyCost: 5,
    effects: [
      {
        type: 'boon',
        boon: BOON.RESOLUTION,
        duration: 5,
        stacks: 1
      }
    ],
    legendId: 'LegendaryDwarf'
  },
  [ID.RITE_OF_THE_GREAT_DWARF]: {
    castTimeMs: 840,
    cooldown: 0,
    energyCost: 40,
    effects: [],
    legendId: 'LegendaryDwarf'
  },
  [ID.INSPIRING_REINFORCEMENT]: {
    castTimeMs: 200,
    cooldown: 10,
    energyCost: 30,
    effects: [
      {
        type: 'strike',
        coefficient: 1.5,
        hits: 1,
        name: 'Inspiring Reinforcement',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 6,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.STABILITY,
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.STABILITY,
        duration: 3,
        stacks: 1,
        applications: 5,
        atMs: 520,
        intervalMs: 1000,
        timingAnchor: 'castEnd',
        timingScale: 'fixed'
      }
    ],
    legendId: 'LegendaryDwarf'
  },
  [ID.SOOTHING_STONE_ID_56661]: {
    castTimeMs: 680,
    cooldown: 30,
    energyCost: 5,
    effects: [
      {
        type: 'boon',
        boon: BOON.RESOLUTION,
        duration: 5,
        stacks: 1
      }
    ],
    legendId: 'LegendaryDwarf'
  },
  [ID.FORCED_ENGAGEMENT_ID_56662]: {
    castTimeMs: 360,
    cooldown: 15,
    energyCost: 10,
    effects: [
      {
        type: 'strike',
        coefficient: 0.5,
        hits: 1,
        name: 'Forced Engagement',
        actorType: ACTOR.PLAYER
      },
      {
        type: 'condition',
        condition: CONDITION.SLOW,
        stacks: 1,
        duration: 4,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'control',
        actorType: ACTOR.PLAYER,
        controlKind: CONDITION.TAUNT.toLowerCase()
      }
    ],
    legendId: 'LegendaryDwarf'
  },
  [ID.VENGEFUL_HAMMERS_ID_56752]: {
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } }
    ],
    // Shared upkeep owns the drain; upkeep-pulses.ts schedules the legend-owned payload below.
    castTimeMs: 0,
    cooldown: 0,
    energyCost: 5,
    upkeepCost: 6,
    pulseInterval: 1 / 3,
    effects: [
      {
        type: 'strike',
        coefficient: 0.6,
        hits: 3,
        atMs: 0,
        name: 'Vengeful Hammers',
        actorType: ACTOR.EFFECT
      }
    ],
    legendId: 'LegendaryDwarf'
  },
  [ID.RITE_OF_THE_GREAT_DWARF_ID_56773]: {
    castTimeMs: 840,
    cooldown: 0,
    energyCost: 40,
    effects: [],
    legendId: 'LegendaryDwarf'
  },
  [ID.INSPIRING_REINFORCEMENT_ID_56841]: {
    castTimeMs: 200,
    cooldown: 10,
    energyCost: 30,
    effects: [
      {
        type: 'strike',
        ticks: Array.from({ length: 5 }, (_, index) => ({ atMs: 40 + index * 40, coefficient: 7.5 / 5 })),
        name: 'Inspiring Reinforcement',
        actorType: ACTOR.PLAYER,
        timingAnchor: 'castStart',
        timingScale: 'cast'
      },
      {
        type: 'condition',
        condition: CONDITION.WEAKNESS,
        stacks: 1,
        duration: 6,
        actorType: ACTOR.PLAYER
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.STABILITY,
        duration: 3,
        stacks: 1
      },
      {
        type: 'boon',
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 },
        boon: BOON.STABILITY,
        duration: 3,
        stacks: 1
      }
    ],
    legendId: 'LegendaryDwarf'
  }
});

/** Vengeful Hammers divides one pulse's coefficient across its simultaneous hammers. */
export function hammerPulse(runtime: RevenantRuntime, skill: RevenantSkill, at: number): void {
  const strike = skill.effects?.find((effect) => effect.type === 'strike');

  if (strike?.type !== 'strike') throw new Error('Vengeful Hammers is missing its strike effect.');

  const hammers = Math.max(1, Math.trunc(strike.hits ?? 1));

  if (!(Number(strike.atMs) >= 0))
    throw new Error('Vengeful Hammers requires one explicit simultaneous-hit timestamp.');

  for (let index = 1; index <= hammers; index += 1)
    runtime.effects.emit({
      kind: 'packet',
      event: buildResolverStrike({
        at: canonicalTime(at + Number(strike.atMs) / 1000),
        source: 'revenant',
        sourceId: skill.id,
        actorType: ACTOR.PLAYER,
        skillId: skill.id,
        skillName: skill.name,
        name: `Vengeful Hammers — Hammer ${index}`,
        coefficient: (strike.coefficient || 0) / hammers,
        hitIndex: index,
        totalHits: hammers,
        skillWeapon: 'Unequipped'
      })
    });
}
