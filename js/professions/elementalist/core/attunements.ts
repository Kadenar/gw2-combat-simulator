import { emitSkillBuff } from '../../../platform/gw2/scheduler/skill-events.js';
import { hasTrait } from '../../../platform/gw2/combat/state/traits.js';
import { professionCoreState } from '../../../platform/engine/profession/state.js';
import type { Skill } from '../../../platform/engine/types.js';
import type {
  ElementalistCastContext as ElementalistLifecycleContext,
  ElementalistPrecastContext as ElementalistCastContext
} from '../types.js';
import { ELEMENTALIST_ATTUNEMENTS, setElementalistAttunementReadyAt, type ElementalistAttunement } from './state.js';
import { ATTUNEMENT_RECHARGE_SECONDS, OFF_ATTUNEMENT_RECHARGE_SECONDS } from './constants.js';
import { combatStarted, emitProfiledBuff, profiledEffect } from './mechanics.js';
import {
  grantElementalAttunementBoon,
  grantElementalistRockSolid,
  triggerBountifulPower,
  triggerEarthenBlast,
  triggerElectricDischarge,
  triggerFlameExpulsion,
  triggerSunspot
} from './traits.js';
import { inFlightAutoattackCarryover, progressedAutoattackCarryover } from './weapon-state.js';
import { ELEMENTALIST_CORE_BALANCE_PROFILE_IDS as PROFILE, elementalistBalanceValue } from './profiles.js';

export interface ElementalistAttunementTraitTrigger {
  readonly attunement: ElementalistAttunement;
  readonly profileId: Skill['id'];
}

export interface ElementalistAttunementTransition {
  readonly secondaryAttunement?: ElementalistAttunement | null;
  readonly rechargeDuration?: number;
  readonly shouldTriggerAttunementTrait?: (trigger: ElementalistAttunementTraitTrigger) => boolean;
}

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

export function targetAttunement(skill: Skill): ElementalistAttunement | null {
  const candidate = skill.name.replace(/ Attunement$/, '');
  return ELEMENTALIST_ATTUNEMENTS.includes(candidate as ElementalistAttunement)
    ? (candidate as ElementalistAttunement)
    : null;
}

export function elementalistAlacrityAdjustedDuration(context: ElementalistLifecycleContext, seconds: number): number {
  return context.config.boons?.alacrity ? seconds / 1.25 : seconds;
}

export function elementalistAttunementRechargeDuration(context: ElementalistLifecycleContext, seconds: number): number {
  let adjusted = seconds;
  if (hasTrait(context, 'Elemental Enchantment')) {
    adjusted *= elementalistBalanceValue(context, PROFILE.elementalEnchantment, 'rechargeMultiplier', 0.85);
  }

  return elementalistAlacrityAdjustedDuration(context, adjusted);
}

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
      if (attunement === 'Air' && hasTrait(context, 'Fresh Air')) {
        const freshAirReadyAt = projectedFreshAirReadyAt(context as unknown as ElementalistCastContext, nextReadyAt);
        if (freshAirReadyAt != null) {
          nextReadyAt = Math.min(nextReadyAt, freshAirReadyAt);
        }
      }

      setElementalistAttunementReadyAt(context, attunement, nextReadyAt);
    }
  }

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
  if (!combatStarted(context, at)) return;

  // Specializations can gate shared attunement-trait effects without Core inspecting specialization state or policy.
  const shouldTriggerAttunementTrait = (attunement: ElementalistAttunement, profileId: Skill['id']): boolean =>
    transition.shouldTriggerAttunementTrait?.({ attunement, profileId }) !== false;

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

  if (!dualAttunement || target !== previous) {
    grantElementalAttunementBoon(context, at, target, skill.id);
  }

  if (!dualAttunement) {
    triggerBountifulPower(context, at, 1, skill.id);
  }
}
