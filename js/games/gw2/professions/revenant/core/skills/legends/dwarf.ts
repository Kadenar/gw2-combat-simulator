/** Owns Legendary Dwarf Stance skill definitions and their alternate identities. */
import { ACTOR, BOON, CONDITION, CONTROL, RECIPIENT } from '#gw2/platform/constants.js';
import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { SkillDefinition } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';
import { canonicalTime } from '#kernel/core/clock.js';

export const REVENANT_DWARF_SKILL_MECHANICS: Readonly<Record<number, SkillDefinition<RevenantSkill>>> = {
  [ID.VENGEFUL_HAMMERS]: {
    name: 'Vengeful Hammers',
    icon: 'https://render.guildwars2.com/file/04E220E8A8B4BD682B6A7D780D98B80FEDF5B410/961436.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 0,
    energyCost: 5,
    upkeepCost: 6,
    pulseInterval: 1 / 3,
    legendId: 'LegendaryDwarf',
    // The upkeep lifecycle owns drain and scheduling; this legend owns the pulse payload below.
    castTimeMs: 0,
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
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } }
    ]
  },
  [ID.FORCED_ENGAGEMENT]: {
    name: 'Forced Engagement',
    icon: 'https://render.guildwars2.com/file/B244F19EA9F09D96D175BC0C2BC402A23D0EEFA5/961439.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 15,
    energyCost: 10,
    legendId: 'LegendaryDwarf',
    castTimeMs: 360,
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
        controlKind: CONTROL.TAUNT
      }
    ]
  },
  [ID.RELEASE_HAMMERS]: {
    name: 'Release Hammers',
    icon: 'https://render.guildwars2.com/file/727BD7D6B693C1DB70D62A09E8B06C746CCD48BF/961441.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 0,
    energyCost: 0,
    legendId: 'LegendaryDwarf',
    // Custom: Releases the active upkeep skill and exposes its parent again; see `core/mechanics/upkeep.ts`.
    castTimeMs: 0,
    effects: [],
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [{ on: 'castCommit', do: { type: 'revenant.release-upkeep' } }]
  },
  [ID.SOOTHING_STONE]: {
    name: 'Soothing Stone',
    icon: 'https://render.guildwars2.com/file/6B0331B3BBEB4603BA7780911C950401E498B294/961448.png',
    type: 'Heal',
    slot: 'Heal',

    cooldown: 30,
    energyCost: 5,
    legendId: 'LegendaryDwarf',
    castTimeMs: 680,
    effects: [
      {
        type: 'boon',
        boon: BOON.RESOLUTION,
        duration: 5,
        stacks: 1
      }
    ]
  },
  [ID.RITE_OF_THE_GREAT_DWARF]: {
    name: 'Rite of the Great Dwarf',
    icon: 'https://render.guildwars2.com/file/D8AEB219F1A057F3F4E47E5E54A12BBABFC8474F/961437.png',
    type: 'Elite',
    slot: 'Elite',

    cooldown: 0,
    energyCost: 40,
    legendId: 'LegendaryDwarf',
    castTimeMs: 840,
    effects: []
  },
  [ID.INSPIRING_REINFORCEMENT]: {
    name: 'Inspiring Reinforcement',
    icon: 'https://render.guildwars2.com/file/6405B93907AE1B1EEBB752AE52BE4280246ED3C4/961457.png',
    type: 'Utility',
    slot: 'Utility',

    cooldown: 10,
    energyCost: 30,
    legendId: 'LegendaryDwarf',
    castTimeMs: 200,
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
    ]
  }
};

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
        name: `Vengeful Hammers - Hammer ${index}`,
        coefficient: (strike.coefficient || 0) / hammers,
        hitIndex: index,
        totalHits: hammers,
        skillWeapon: 'Unequipped'
      })
    });
}
