import {
  requireBalanceProfileFromContext,
  balanceProfileNumber,
  requireEffect,
  effectNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
/** Owns imperative Core Necromancer Death Magic trait behavior for ordered dispatcher calls. */

import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';

import { NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { addCarapace } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import type {
  NecromancerResolverContext,
  NecromancerResolverEvent,
  NecromancerRuntime
} from '#gw2/professions/necromancer/types.js';

/** Completed heals grant Carapace and Protection together under one Dark Defense cooldown. */
export function applyDarkDefense(runtime: NecromancerRuntime, cast: RuntimeCast): void {
  if (cast.skill.type !== 'Heal' || !hasTrait(runtime, TRAIT.DARK_DEFENSE)) return;
  const profile = requireBalanceProfileFromContext(runtime, TRAIT.DARK_DEFENSE);
  if (!runtime.procs.claimCooldown('darkDefense', runtime.time, balanceProfileNumber(profile, 'internalCooldown')))
    return;
  addCarapace(
    runtime.profession.core,
    balanceProfileNumber(profile, 'resourceGain'),
    runtime.time,
    balanceProfileNumber(profile, 'duration')
  );
  const boon = requireEffect(profile, 'boon', 'protection');
  if (!boon) return;
  const event = {
    type: 'buff' as const,
    at: runtime.time,
    source: 'Trait',
    sourceId: TRAIT.DARK_DEFENSE,
    actorType: 'effect' as const,
    activationId: cast.id,
    triggeredBy: cast.skill.name,
    offTarget: cast.command.offTarget,
    skillName: profile.name,
    kind: String(boon.boon),
    stacks: effectNumber(profile, boon, 'stacks'),
    duration: effectNumber(profile, boon, 'duration')
  };
  queueResolverBoon(runtime, event, event);
}

export function applyCorruptorsFervor(context: NecromancerResolverContext, event: NecromancerResolverEvent): void {
  if (event.actorType === 'summon' || !hasTrait(context, TRAIT.CORRUPTERS_FERVOR)) return;
  addCarapace(
    professionCoreState(context),
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CORRUPTERS_FERVOR), 'resourceGain'),
    event.at,
    balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.CORRUPTERS_FERVOR), 'duration')
  );
}
