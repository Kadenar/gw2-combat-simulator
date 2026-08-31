import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import type { Skill } from '#gw2/platform/engine/types.js';
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistPrecastContext as ElementalistCastContext
} from '#gw2/content/professions/elementalist/types.js';
import {
  ELEMENTALIST_ATTUNEMENTS,
  setElementalistAttunementReadyAt,
  type ElementalistAttunement
} from '#gw2/content/professions/elementalist/core/state.js';
import {
  ATTUNEMENT_RECHARGE_SECONDS,
  OFF_ATTUNEMENT_RECHARGE_SECONDS
} from '#gw2/content/professions/elementalist/core/constants.js';
import {
  combatStarted,
  emitProfiledBuff,
  profiledEffect
} from '#gw2/content/professions/elementalist/core/mechanics/effects.js';
import {
  grantElementalAttunementBoon,
  grantElementalistRockSolid,
  triggerBountifulPower,
  triggerEarthenBlast,
  triggerElectricDischarge,
  triggerFlameExpulsion,
  triggerSunspot
} from '#gw2/content/professions/elementalist/core/traits/index.js';
import {
  inFlightAutoattackCarryover,
  progressedAutoattackCarryover
} from '#gw2/content/professions/elementalist/core/mechanics/weapon-state.js';
import {
  ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE,
  elementalistBalanceValue
} from '#gw2/content/professions/elementalist/core/profiles.js';

/** Identifies one shared attunement-entry trait effect so a specialization can veto it. */
export interface ElementalistAttunementTraitTrigger {
  readonly attunement: ElementalistAttunement;
  readonly profileId: Skill['id'];
}

/**
 * Specialization-supplied overrides for a single attunement swap: the secondary
 * attunement to report, a replacement recharge policy, and a trait-effect veto.
 */
export interface ElementalistAttunementTransition {
  readonly secondaryAttunement?: ElementalistAttunement | null;
  readonly rechargeDuration?: number;
  readonly shouldTriggerAttunementTrait?: (trigger: ElementalistAttunementTraitTrigger) => boolean;
}

/**
 * Looks ahead through queued Fresh Air critical candidates for the timestamp at
 * which their accumulated critical chance is expected to complete a proc and
 * reset Air. Returns null when the trait is unselected, Air is already the
 * primary attunement, or no candidate up to `upTo` completes a proc.
 */
export function projectedFreshAirReadyAt(context: ElementalistCastContext, upTo: number): number | null {
  if (!hasTrait(context, 'Fresh Air')) return null;
  const state = professionCoreState(context);
  if (state.primaryAttunement === 'Air') return null;
  let progress = state.freshAirProgress;
  const candidates = [...state.freshAirCandidates].sort((left, right) => left.at - right.at);
  for (const candidate of candidates) {
    if (candidate.at > upTo + context.epsilon) break;
    progress += candidate.criticalChance;
    if (progress + context.epsilon >= 1) return candidate.at;
  }

  return null;
}

/** Maps an attunement-swap skill to the attunement it enters, or null for any other skill. */
export function targetAttunement(skill: Skill): ElementalistAttunement | null {
  const candidate = skill.name.replace(/ Attunement$/, '');
  return ELEMENTALIST_ATTUNEMENTS.includes(candidate as ElementalistAttunement)
    ? (candidate as ElementalistAttunement)
    : null;
}

/** Applies alacrity's recharge scaling to an Elementalist mechanic duration. */
export function elementalistAlacrityAdjustedDuration(context: ElementalistLifecycleContext, seconds: number): number {
  return context.config.boons?.alacrity ? seconds / 1.25 : seconds;
}

/** Resolves the effective attunement recharge after Elemental Enchantment and alacrity. */
export function elementalistAttunementRechargeDuration(context: ElementalistLifecycleContext, seconds: number): number {
  let adjusted = seconds;
  if (hasTrait(context, 'Elemental Enchantment')) {
    adjusted *= elementalistBalanceValue(context, PROFILE.elementalEnchantment, 'rechargeMultiplier', 0.85);
  }

  return elementalistAlacrityAdjustedDuration(context, adjusted);
}

/**
 * Commits a completed attunement swap: carries autoattack chain progress across
 * the swap, arms the attunement recharges, publishes the attunement and sigil
 * swap events, and fires the shared on-entry trait effects once combat started.
 */
export function onAttunementComplete(
  context: ElementalistLifecycleContext,
  skill: Skill,
  target: ElementalistAttunement,
  transition: ElementalistAttunementTransition = {}
): void {
  const state = professionCoreState(context);
  const at = context.effectiveEnd;
  const previous = state.primaryAttunement;
  const attunementReadyAtBefore = { ...state.attunementReadyAt };
  // Preserve chain progress for the attunement being left; a cast still in flight
  // is only held as pending until it commits.
  state.autoattackCarryover = progressedAutoattackCarryover(context, state, previous);
  state.pendingAutoattackCarryover = state.autoattackCarryover ? null : inFlightAutoattackCarryover(context, previous);
  // Specializations may supply their own transition and recharge policy while Core keeps shared entry effects here.
  const dualAttunement = transition.rechargeDuration != null;
  if (dualAttunement) {
    state.primaryAttunement = target;
    const recharge = Number(transition.rechargeDuration);
    for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
      setElementalistAttunementReadyAt(context, attunement, at + recharge);
    }
  } else {
    state.primaryAttunement = target;
    // Single swap: the attunement just left takes the full recharge, while the two
    // untouched attunements only serve the short off-attunement delay.
    setElementalistAttunementReadyAt(
      context,
      previous,
      Math.max(
        state.attunementReadyAt[previous],
        at +
          elementalistAttunementRechargeDuration(
            context,
            elementalistBalanceValue(context, PROFILE.resources, 'recharge', ATTUNEMENT_RECHARGE_SECONDS)
          )
      )
    );
    for (const attunement of ELEMENTALIST_ATTUNEMENTS) {
      if (attunement === target || attunement === previous) continue;
      const existingReadyAt = state.attunementReadyAt[attunement];
      const defaultReadyAt =
        at +
        elementalistAttunementRechargeDuration(
          context,
          elementalistBalanceValue(context, PROFILE.resources, 'initialDelay', OFF_ATTUNEMENT_RECHARGE_SECONDS)
        );
      let nextReadyAt = Math.max(existingReadyAt, defaultReadyAt);
      // Fresh Air can pull Air's ready time in ahead of its scheduled recharge.
      if (attunement === 'Air' && hasTrait(context, 'Fresh Air')) {
        const freshAirReadyAt = projectedFreshAirReadyAt(context as unknown as ElementalistCastContext, nextReadyAt);
        if (freshAirReadyAt != null) {
          nextReadyAt = Math.min(nextReadyAt, freshAirReadyAt);
        }
      }

      setElementalistAttunementReadyAt(context, attunement, nextReadyAt);
    }
  }

  // Publish the swap for the resolver and presentation, then trigger weapon sigils.
  state.attunementEnteredAt = at;
  context.emit({
    type: 'elementalist.attunement',
    at,
    priority: -20,
    source: skill.name,
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name,
    commandIndex: context.commandIndex,
    from: previous,
    to: target,
    secondaryAttunement: transition.secondaryAttunement ?? null,
    attunementReadyAtBefore
  });
  context.emit({
    type: 'sigil_swap',
    at,
    source: skill.name,
    sourceId: skill.id,
    actorType: 'player',
    skillId: skill.id,
    skillName: skill.name
  });
  // Pre-combat swaps still move state and timers but grant no trait effects.
  if (!combatStarted(context, at)) return;

  // Specializations can gate shared attunement-trait effects without Core inspecting specialization state or policy.
  const shouldTriggerAttunementTrait = (attunement: ElementalistAttunement, profileId: Skill['id']): boolean =>
    transition.shouldTriggerAttunementTrait?.({ attunement, profileId }) !== false;

  // Attunement-exit and attunement-entry trait effects follow, each of them
  // vetoable by the specialization's transition policy.
  if (previous === 'Fire' && target !== 'Fire' && shouldTriggerAttunementTrait('Fire', PROFILE.pyromancersPuissance)) {
    triggerFlameExpulsion(context, at, skill.id);
  }

  if (target === 'Fire' && shouldTriggerAttunementTrait('Fire', PROFILE.sunspot)) {
    triggerSunspot(context, at, skill.id);
  }

  if (target === 'Air') {
    if (shouldTriggerAttunementTrait('Air', PROFILE.electricDischarge)) {
      triggerElectricDischarge(context, at, skill.id);
    }

    if (previous !== 'Air' && hasTrait(context, 'Fresh Air')) {
      state.freshAirLastResetAt = at;
      const freshAir = profiledEffect(context, PROFILE.freshAir, 'buff');
      emitSkillBuff(context, skill, {
        at,
        source: skill.name,
        sourceId: skill.id,
        actorType: 'player',
        kind: 'fresh air',
        stacks: Number(freshAir?.stacks ?? 1),
        duration: Number(freshAir?.duration ?? 5),
        skillName: skill.name,
        priority: -10
      });
    }

    if (hasTrait(context, 'One with Air')) {
      emitProfiledBuff(context, at, PROFILE.oneWithAir, 'Superspeed', 'Superspeed', 1, 3, skill.name, skill.id);
    }

    if (hasTrait(context, 'Inscription')) {
      emitProfiledBuff(context, at, PROFILE.inscription, 'Air Entry', 'Resistance', 1, 3, skill.name, skill.id);
    }
  }

  if (target === 'Earth') {
    if (shouldTriggerAttunementTrait('Earth', PROFILE.earthenBlast)) {
      triggerEarthenBlast(context, at, skill.id);
    }

    if (shouldTriggerAttunementTrait('Earth', PROFILE.rockSolid)) {
      grantElementalistRockSolid(context, at, skill.id);
    }
  }

  if (hasTrait(context, 'Arcane Prowess')) {
    emitProfiledBuff(context, at, PROFILE.arcaneProwess, 'Might', 'Might', 1, 8, 'Arcane Prowess', skill.id);
  }

  // Re-entering the same element through a dual attunement does not re-grant the
  // entry boon, and Bountiful Power only counts single-attunement swaps.
  if (!dualAttunement || target !== previous) {
    grantElementalAttunementBoon(context, at, target, skill.id);
  }

  if (!dualAttunement) {
    triggerBountifulPower(context, at, 1, skill.id);
  }
}
