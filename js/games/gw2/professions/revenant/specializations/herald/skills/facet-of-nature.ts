import { ACTOR, BOON, RECIPIENT } from '#gw2/platform/constants.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { buildResolverStrike } from '#gw2/platform/effects/packet-builders.js';
import type { EffectAudience } from '#gw2/platform/events/events.js';
import type { Gw2ResolverEvent } from '#gw2/platform/events/resolver-event.js';
import type { RuntimeCast } from '#gw2/platform/execution/cast-contracts.js';
import {
  effectNumber,
  requireEffect,
  requireSkillFromContext,
  skillNumber
} from '#gw2/platform/skills/balance-profiles.js';
import type { Skill } from '#gw2/platform/skills/types.js';
import type { RevenantRuntime } from '#gw2/professions/revenant/core/events.js';
import { activeRevenantUpkeep } from '#gw2/professions/revenant/core/mechanics/upkeep.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';
import { heraldFacetPassiveActive } from '#gw2/professions/revenant/specializations/herald/mechanics/facets.js';
import { heraldState } from '#gw2/professions/revenant/specializations/herald/state.js';
import { coreValueExtension } from '#gw2/professions/revenant/specializations/herald/traits/behavior.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

// Facet of Nature has one legend-dependent consume, but every variant occupies
// the same profession-mechanic tile as the activating facet.
const FACET_OF_NATURE_PALETTE_TILE = 'revenant-herald-facet-of-nature';
const TRUE_NATURE_SHARED_COOLDOWN = 20;

/** Nature variants share one facet, palette tile, and recharge while their authored effects remain legend-specific. */
export const HERALD_NATURE_SKILL_MECHANICS: Readonly<Record<number, Partial<Skill>>> = Object.freeze({
  [ID.FACET_OF_NATURE]: {
    cooldown: 0,
    paletteTileId: FACET_OF_NATURE_PALETTE_TILE,
    paletteTileOrder: 1,
    energyCost: 0,
    upkeepCost: 2,
    // Herald's F2 remains available outside Glint so the active legend can select its True Nature variant.
    facet: true,
    pulseInterval: 3,
    // Assassin siphons have an independent proc interval, not the facet recharge.
    internalCooldown: 0.52,
    upkeepConsumeByLegendId: {
      LegendaryAssassin: ID.TRUE_NATURE_ASSASSIN,
      LegendaryDwarf: ID.TRUE_NATURE_DWARF,
      LegendaryDragon: ID.TRUE_NATURE_DRAGON,
      LegendaryCentaur: ID.TRUE_NATURE_CENTAUR,
      LegendaryDemon: ID.TRUE_NATURE_DEMON
    },
    // Core upkeep owns Energy drain; Herald mechanics/facets.ts owns the passive lifecycle and boon pulses.
    castTimeMs: 0,
    effects: [],
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', do: { type: 'revenant.reserve-upkeep' } },
      { on: 'castCommit', do: { type: 'revenant.activate-upkeep' } },
      {
        on: 'castCommit',
        do: {
          type: 'revenant.start-facet',
          id: 'assassin-siphon',
          // natureSiphon consumes this component only while the Assassin passive is eligible.
          effects: [
            {
              name: 'Life Siphon',
              type: 'strike',
              coefficient: 0,
              damageKind: 'life-steal',
              flatStrikeBase: 53,
              flatStrikePowerCoeff: 0.0666,
              actorType: ACTOR.EFFECT
            }
          ]
        }
      }
    ]
  },
  [ID.TRUE_NATURE_ASSASSIN]: {
    paletteTileId: FACET_OF_NATURE_PALETTE_TILE,
    paletteTileOrder: 2,
    cooldown: TRUE_NATURE_SHARED_COOLDOWN,
    energyCost: 0,
    consume: true,
    // Herald mechanics/facets.ts ends the upkeep on accepted consume and applies recharge on completion.
    castTimeMs: 480,
    // Assassin's consume strikes with the currently equipped weapon's strength.
    effects: [
      {
        type: 'strike',
        coefficient: 1,
        hits: 1,
        name: 'True Nature (assassin)',
        actorType: ACTOR.PLAYER,
        weaponStrengthSource: 'equipped'
      }
    ],
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'revenant.start-consume' } },
      { on: 'castCommit', do: { type: 'revenant.complete-consume' } }
    ]
  },
  [ID.TRUE_NATURE_DWARF]: {
    paletteTileId: FACET_OF_NATURE_PALETTE_TILE,
    paletteTileOrder: 2,
    cooldown: TRUE_NATURE_SHARED_COOLDOWN,
    energyCost: 0,
    consume: true,
    // Herald mechanics/facets.ts ends the upkeep on accepted consume and applies recharge on completion.
    castTimeMs: 480,
    effects: [
      {
        type: 'boon',
        boon: BOON.STABILITY,
        duration: 4,
        stacks: 2,
        audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
      }
    ],
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'revenant.start-consume' } },
      { on: 'castCommit', do: { type: 'revenant.complete-consume' } }
    ]
  },
  [ID.TRUE_NATURE_DRAGON]: {
    paletteTileId: FACET_OF_NATURE_PALETTE_TILE,
    paletteTileOrder: 2,
    cooldown: TRUE_NATURE_SHARED_COOLDOWN,
    energyCost: 0,
    consume: true,
    // Herald mechanics/facets.ts ends the upkeep on accepted consume and applies recharge on completion.
    castTimeMs: 480,
    effects: [
      {
        type: 'custom',
        eventType: 'proc',
        event: {
          procType: 'boon-extension',
          name: 'True Nature (dragon) — Boon Extension',
          duration: 2,
          audience: { recipients: RECIPIENT.PARTY, maximumRecipients: 5 }
        }
      }
    ],
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'revenant.start-consume' } },
      { on: 'castCommit', do: { type: 'revenant.complete-consume' } },
      { on: 'castCommit', do: { type: 'revenant.true-nature-dragon' } }
    ]
  },
  [ID.TRUE_NATURE_CENTAUR]: {
    paletteTileId: FACET_OF_NATURE_PALETTE_TILE,
    paletteTileOrder: 2,
    cooldown: TRUE_NATURE_SHARED_COOLDOWN,
    energyCost: 0,
    consume: true,
    // Herald mechanics/facets.ts ends the upkeep on accepted consume and applies recharge on completion.
    castTimeMs: 480,
    effects: [],
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'revenant.start-consume' } },
      { on: 'castCommit', do: { type: 'revenant.complete-consume' } }
    ]
  },
  [ID.TRUE_NATURE_DEMON]: {
    paletteTileId: FACET_OF_NATURE_PALETTE_TILE,
    paletteTileOrder: 2,
    cooldown: TRUE_NATURE_SHARED_COOLDOWN,
    energyCost: 0,
    consume: true,
    // Herald mechanics/facets.ts ends the upkeep on accepted consume and applies recharge on completion.
    castTimeMs: 480,
    // Demon's condition transfer has no simulated effect; consuming still ends the upkeep.
    effects: [],
    // The declaration owns this activation; shared mechanics retain its live state.
    sideEffects: [
      { on: 'castStart', when: (_runtime, cast) => !cast.cancelled, do: { type: 'revenant.start-consume' } },
      { on: 'castCommit', do: { type: 'revenant.complete-consume' } }
    ]
  }
});

/** True Nature (Dragon) extends boons when its authored proc lands; Core Value adds its patched extension. */
export function trueNatureDragon(runtime: RevenantRuntime, cast: RuntimeCast<RevenantSkill>): void {
  const proc = cast.skill.effects?.find(
    (effect) =>
      effect.type === 'custom' && (effect.event as { procType?: string } | undefined)?.procType === 'boon-extension'
  );
  const authored =
    proc?.type === 'custom' ? (proc.event as { name?: string; duration?: number; audience?: EffectAudience }) : null;

  if (!authored) return;

  const extension = Math.max(0, authored.duration || 0) + coreValueExtension(runtime);

  if (extension <= 0) return;

  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'boon_extension',
      at: runtime.time,
      source: 'revenant',
      sourceId: cast.skill.id,
      actorType: ACTOR.PLAYER,
      skillId: cast.skill.id,
      skillName: cast.skill.name,
      activationId: cast.id,
      procType: 'boon-extension',
      name: authored.name,
      duration: extension,
      ...(authored.audience ? { audience: authored.audience } : {}),
      extensionAudience: 'all'
    }
  });
}

/** Landed player strikes under Assassin Nature (active or retained) siphon once per cooldown; siphons never recurse. */
export function natureSiphon(runtime: RevenantRuntime, event: Gw2ResolverEvent): void {
  if (event.actorType !== ACTOR.PLAYER || !(Number(event.coefficient) > 0)) return;

  const core = runtime.profession.core;
  const state = heraldState.from(runtime);
  const active = activeRevenantUpkeep(runtime, ID.FACET_OF_NATURE);
  const legend = active ? core.activeLegendId : state.lingeringFacets[ID.FACET_OF_NATURE]?.legendId;

  if (legend !== LEGEND.ASSASSIN || !heraldFacetPassiveActive(core, state, ID.FACET_OF_NATURE, runtime.time)) return;

  const profile = requireSkillFromContext(runtime, ID.FACET_OF_NATURE);
  const action = requireSkillAction(profile, 'assassin-siphon');
  const strike = requireEffect(profile, 'strike', 'Life Siphon', action);

  // The cooldown gates only the siphon, so a removed strike leaves it ready.
  if (!strike) return;

  if (
    !runtime.procs.claimCooldown('revenant.herald.natureSiphon', runtime.time, skillNumber(profile, 'internalCooldown'))
  )
    return;

  runtime.effects.emit({
    kind: 'packet',
    cause: event,
    event: buildResolverStrike({
      at: runtime.time,
      source: 'revenant',
      sourceId: ID.FACET_OF_NATURE,
      skillId: ID.FACET_OF_NATURE,
      skillName: profile.name,
      name: 'Facet of Nature — Life Siphon',
      actorType: ACTOR.EFFECT,
      ownerActorType: ACTOR.PLAYER,
      coefficient: 0,
      canCrit: false,
      damageKind: 'life-steal',
      flatStrikeBase: effectNumber(profile, strike, 'flatStrikeBase'),
      flatStrikePowerCoeff: effectNumber(profile, strike, 'flatStrikePowerCoeff'),
      skillWeapon: 'Unequipped',
      triggeredBy: event.skillName
    })
  });
}
