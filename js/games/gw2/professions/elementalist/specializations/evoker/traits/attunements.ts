import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { denyCast } from '#gw2/platform/engine/skills/availability.js';
import {
  balanceProfileNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { gw2BaseRecharge } from '#gw2/platform/engine/skills/recharge.js';
import type { Skill } from '#gw2/platform/engine/skills/types.js';
import type { AvailabilityResult } from '#gw2/platform/execution/types.js';
import type { RuntimeCast } from '#gw2/platform/simulation/runtime-state.js';
import { gw2EffectExpiresAt } from '#gw2/platform/skills/timing.js';
import { emitElementalistBuff } from '#gw2/professions/elementalist/core/events.js';
import {
  targetAttunement,
  type ElementalistAttunementTraitTrigger
} from '#gw2/professions/elementalist/core/mechanics/attunements.js';
import { elementalistEventSkill, emitElementalistProc } from '#gw2/professions/elementalist/core/mechanics/effects.js';
import { type ElementalistAttunement } from '#gw2/professions/elementalist/core/state.js';
import {
  applyFreshAirSyntheticEntry,
  applyInscriptionAirEntry,
  applyOneWithAir,
  grantElementalistRockSolid,
  triggerEarthenBlast,
  triggerElectricDischarge
} from '#gw2/professions/elementalist/core/traits/attunements.js';
import { triggerSunspot } from '#gw2/professions/elementalist/core/traits/dispatch.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';
import {
  BASIC_FAMILIARS,
  FAMILIAR_ELEMENTS
} from '#gw2/professions/elementalist/specializations/evoker/mechanics/constants.js';
import { EVOKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';
import { evokerState } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import type { ElementalistRuntime } from '#gw2/professions/elementalist/types.js';

// Evocation's five-second trait ICD applies to some Fire and Earth entry effects
const EVOKER_ATTUNEMENT_TRAIT_ICD_PROFILES = new Set<Skill['id']>([
  TRAIT.SUNSPOT,
  TRAIT.PYROMANCERS_PUISSANCE,
  TRAIT.EARTHEN_BLAST,
  TRAIT.ROCK_SOLID
]);

// reports whether the trait may proc now, arming its next Evocation ICD window when it may
function consumeEvokerAttunementTraitCooldown(
  context: ElementalistRuntime,
  at: number,
  profileId: Skill['id']
): boolean {
  const evocationProfile = requireBalanceProfileFromContext(context, TRAIT.EVOCATION);
  // Both real and familiar-triggered entries share a per-profile claim before downstream effects.
  return context.procs.claimCooldown(String(profileId), at, balanceProfileNumber(evocationProfile, 'internalCooldown'));
}

/** Evocation claims a per-trait ICD only for entries into the selected familiar element. */
export function evocationAllowsAttunementTrait(
  context: ElementalistRuntime,
  at: number,
  { attunement, profileId }: ElementalistAttunementTraitTrigger
): boolean {
  return (
    !EVOKER_ATTUNEMENT_TRAIT_ICD_PROFILES.has(profileId) ||
    evokerState.from(context).element !== attunement ||
    consumeEvokerAttunementTraitCooldown(context, at, profileId)
  );
}

/** Accepted Burning in Fire consumes Ignite's existing pulse interval only when its Might packet survives. */
export function applyEvocationBurning(context: ElementalistRuntime, event: SimulationEvent): void {
  const state = evokerState.from(context);
  if (event.type === 'condition' && event.condition === 'Burning' && state.element === 'Fire') {
    const evocationProfile = requireBalanceProfileFromContext(context, TRAIT.EVOCATION);
    const might = requireEffect(evocationProfile, 'boon', 'Fire Familiar');
    const sourceId = event.skillId ?? event.sourceId;
    if (
      might &&
      context.procs.claimCooldown(
        'elementalist.evoker.ignitePassive',
        event.at,
        balanceProfileNumber(requireBalanceProfileFromContext(context, PROFILE.ignite), 'pulseInterval')
      )
    ) {
      emitElementalistBuff(context, {
        skill: elementalistEventSkill(context, 'Fire Familiar', sourceId),
        at: event.at,
        source: 'Fire Familiar',
        sourceId,
        actorType: 'player',
        kind: String(might.boon).toLowerCase(),
        stacks: Number(might.stacks),
        duration: might.duration,
        skillName: 'Fire Familiar'
      });
    }
  }
}

/** Elemental Balance arms before Dynamo adds charges on each accepted entry into the familiar element. */
export function applyEvokerEntryTraits(context: ElementalistRuntime, event: SimulationEvent): void {
  const state = evokerState.from(context);

  // everything past this point is an attunement-entry trait
  if (event.type !== 'elementalist.attunement' && event.type !== 'elementalist.attunement-enter') {
    return;
  }

  // only counts entering YOUR current element (Elemental Dynamo or Specialized Elements entry)
  if (event.to !== state.element) return;

  if (hasTrait(context, TRAIT.ELEMENTAL_BALANCE)) {
    state.elementalBalanceProgress += 1;
    const elementalBalanceProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_BALANCE);
    const threshold = balanceProfileNumber(elementalBalanceProfile, 'threshold');
    if (state.elementalBalanceProgress >= threshold) {
      // subtract rather than reset so any overflow from simultaneous gains isn't lost
      state.elementalBalanceProgress -= threshold;
      // Temporary-effect expiry uses the absolute combat tick, including patched durations.
      const duration = balanceProfileNumber(elementalBalanceProfile, 'durationMultiplier');
      state.elementalBalanceUntil = gw2EffectExpiresAt(event.at, duration);
      emitElementalistProc(context, {
        at: event.at,
        name: 'Elemental Balance',
        procType: 'skill',
        sourceId: event.skillId ?? event.sourceId,
        sourceSkill: event.skillName || event.source || '',
        detail: `CDR armed (${duration}s)`,
        icon: 'https://wiki.guildwars2.com/images/4/4c/Elemental_Balance.png'
      });
    }
  }

  // Elemental Dynamo turns each entry into familiar charges and reports the new total
  if (!hasTrait(context, TRAIT.ELEMENTAL_DYNAMO)) return;

  const elementalDynamoProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_DYNAMO);

  state.charges = Math.min(
    state.maximumCharges,
    state.charges + balanceProfileNumber(elementalDynamoProfile, 'resourceGain')
  );

  context.emitDerived(event, {
    type: 'resource',
    at: event.at,
    source: 'Elemental Dynamo',
    sourceId: event.sourceId,
    actorType: 'player',
    skillName: 'Elemental Dynamo',
    kind: 'evoker-charges',
    value: state.charges,
    maximum: state.maximumCharges,
    empowered: state.empowered
  });
}

/**
 * Spends an armed Elemental Balance window on the next non-autoattack weapon
 * skill, scaling its recharge by the profile multiplier. The window is
 * single-use and is cleared here as soon as one skill consumes it.
 */
export function commitRechargeDuration(context: ElementalistRuntime, skill: Skill, duration: number): number {
  // Weapon_1 excluded — auto-attacks don't benefit from Elemental Balance CDR
  if (skill.type !== 'Weapon' || String(skill.slot) === 'Weapon_1' || !hasTrait(context, TRAIT.ELEMENTAL_BALANCE)) {
    return duration;
  }

  const state = evokerState.from(context);
  if (state.elementalBalanceUntil <= context.time) {
    return duration;
  }

  state.elementalBalanceUntil = 0; // single-use window; next arm cycle starts fresh
  const elementalBalanceProfile = requireBalanceProfileFromContext(context, TRAIT.ELEMENTAL_BALANCE);
  return duration * balanceProfileNumber(elementalBalanceProfile, 'rechargeMultiplier');
}

// fires the attunement-enter effects for Specialized Elements without actually swapping attunement
export function triggerSpecializedElementEntry(
  context: ElementalistRuntime,
  cast: RuntimeCast,
  skill: Skill,
  element: ElementalistAttunement
): void {
  const at = cast.effectiveEnd;
  const procReady = (profileId: Skill['id']): boolean =>
    hasTrait(context, profileId) && consumeEvokerAttunementTraitCooldown(context, at, profileId);

  context.emit({
    type: 'elementalist.attunement-enter',
    at,
    source: skill.name,
    sourceId: skill.id,
    actorType: 'player',
    skillName: skill.name,
    to: element
  });
  if (element === 'Fire') {
    if (procReady(TRAIT.SUNSPOT)) {
      triggerSunspot(context, at, skill.id);
    }
  } else if (element === 'Air') {
    triggerElectricDischarge(context, at, skill.id);
    // Synthetic entry shares the Air grants; Fresh Air below has its own entry semantics.
    applyOneWithAir(context, at, skill);
    applyInscriptionAirEntry(context, at, skill);
    applyFreshAirSyntheticEntry(context, at, skill);
  } else if (element === 'Earth') {
    if (procReady(TRAIT.EARTHEN_BLAST)) {
      triggerEarthenBlast(context, at, skill.id);
    }

    if (procReady(TRAIT.ROCK_SOLID)) {
      grantElementalistRockSolid(context, at, skill.id);
    }
  }
}

// Specialized Elements removes the profiled fraction of each weapon skill's base recharge.
function applyWeaponSkillRechargeMultiplier(context: ElementalistRuntime, cast: RuntimeCast, multiplier: number): void {
  const at = cast.effectiveEnd;
  for (const candidate of context.helpers.skills) {
    if (candidate.type !== 'Weapon') continue;
    const reduction = gw2BaseRecharge(candidate) * Math.max(0, 1 - multiplier);
    context.cooldownController.reduceSkillRecharge(candidate, reduction, at);
  }
}

export function applySpecializedElementsTrait(context: ElementalistRuntime, cast: RuntimeCast, skill: Skill): void {
  const familiarElement = FAMILIAR_ELEMENTS.get(skill.id);
  // Basic familiars retain 90% weapon recharge; empowered familiars retain
  // 67% and trigger the elemental entry effects.
  if (familiarElement && hasTrait(context, TRAIT.SPECIALIZED_ELEMENTS)) {
    const basic = BASIC_FAMILIARS.has(skill.id);
    applyWeaponSkillRechargeMultiplier(
      context,
      cast,
      balanceProfileNumber(
        requireBalanceProfileFromContext(
          context,
          basic ? SPECIALIZED_ELEMENTS_PROFILE_IDS.basicRecharge : SPECIALIZED_ELEMENTS_PROFILE_IDS.empoweredRecharge
        ),
        'rechargeMultiplier'
      )
    );
    if (!basic) {
      triggerSpecializedElementEntry(context, cast, skill, familiarElement);
    }
  }
}

/** Specialized Elements selects the active charge cap and matching-element gain from its own profile. */
export function evokerChargeProfile(context: unknown) {
  return requireBalanceProfileFromContext(
    context,
    hasTrait(context, TRAIT.SPECIALIZED_ELEMENTS) ? TRAIT.SPECIALIZED_ELEMENTS : PROFILE.resources
  );
}

/** Pin Core's element after the resource initializer has clamped its seeded charges. */
export function initializeSpecializedElements(context: ElementalistRuntime): void {
  if (hasTrait(context, TRAIT.SPECIALIZED_ELEMENTS))
    professionCoreState(context).primaryAttunement = evokerState.from(context).element;
}

/** A selected fixed element rejects manual attunement swaps before familiar availability checks. */
export function specializedElementsAvailability(context: ElementalistRuntime, skill: Skill): AvailabilityResult {
  return targetAttunement(skill) && hasTrait(context, TRAIT.SPECIALIZED_ELEMENTS)
    ? denyCast(
        'elementalist.specialized-elements',
        `${skill.name} is unavailable - attunement swapping is disabled by Specialized Elements.`
      )
    : { ready: true };
}

/** Retain each existing percentage-recharge patch identity under its trait owner. */
export const SPECIALIZED_ELEMENTS_PROFILE_IDS = Object.freeze({
  basicRecharge: 'elementalist.evoker.specialized-elements.basic-recharge',
  empoweredRecharge: 'elementalist.evoker.specialized-elements.empowered-recharge'
});
