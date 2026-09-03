import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillCondition } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import type { SkillId } from '#gw2/platform/engine/types.js';
import type { ThiefCastContext, ThiefResolverContext, ThiefResolverEvent } from '#gw2/professions/thief/types.js';

const VENOM_SKILL_IDS = new Set<number>([ID.SPIDER_VENOM, ID.SKALE_VENOM, ID.DEVOURER_VENOM]);

/** Applies Shadow Arts effects without owning the base venom packet that triggers them. */
export function applyHiddenThief(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.HIDDEN_THIEF)) return;
  const state = professionCoreState(context);
  const profile = balanceProfileFromContext(context, PROFILE.hiddenThief);
  const blindness = balanceProfileEffect(profile, 'condition', 0);
  const weakness = balanceProfileEffect(profile, 'condition', 1);
  const readyAt = Number(state.traitProcReadyAt[TRAIT.HIDDEN_THIEF] ?? 0);
  if (!isInternalCooldownReady(at, readyAt)) return;
  state.traitProcReadyAt[TRAIT.HIDDEN_THIEF] = at + Number(profile?.internalCooldown || 2);
  emitSkillCondition(context, {
    at,
    source: 'Trait',
    actorType: 'player',
    skillId: context.skill?.id ?? null,
    skillName: context.skill?.name ?? null,
    condition: 'Blindness',
    duration: Number(blindness?.duration || 3),
    stacks: Number(blindness?.stacks || 1),
    sourceId: TRAIT.HIDDEN_THIEF,
    name: 'Hidden Thief - Blindness'
  });
  emitSkillCondition(context, {
    at,
    source: 'Trait',
    actorType: 'player',
    skillId: context.skill?.id ?? null,
    skillName: context.skill?.name ?? null,
    condition: 'Weakness',
    duration: Number(weakness?.duration || 3),
    stacks: Number(weakness?.stacks || 1),
    sourceId: TRAIT.HIDDEN_THIEF,
    name: 'Hidden Thief - Weakness'
  });
}

function enqueueSiphon(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  sourceId: SkillId,
  name: string,
  coefficient: number
): void {
  enqueueOrdered(context.queue, {
    type: 'damage',
    at: event.at,
    source: 'Trait',
    sourceId,
    actorType: 'effect',
    skillId: sourceId,
    skillName: name,
    name,
    coefficient,
    hits: 1,
    canCrit: false,
    noCrit: true,
    lifeSiphon: true,
    triggeredBy: event.skillName
  });
}

export function applyLeechingVenoms(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (!hasTrait(context.config, TRAIT.LEECHING_VENOMS)) return;
  const strike = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.leechingVenoms), 'strike');
  enqueueSiphon(context, event, TRAIT.LEECHING_VENOMS, 'Leeching Venoms', Number(strike?.coefficient || 0.033));
}

export function applyAlliedLeechingVenoms(context: ThiefResolverContext, application: ThiefResolverEvent): void {
  if (
    !application.triggeredByAlly ||
    !VENOM_SKILL_IDS.has(Number(application.skillId)) ||
    Number(application.venomProcEffectIndex || 0) !== 0
  )
    return;
  applyLeechingVenoms(context, application);
}

export function applyShadowSiphoning(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    !hasTrait(context.config, TRAIT.SHADOW_SIPHONING)
  )
    return;
  const skill = event.skillId == null ? undefined : context.helpers.skillsById?.get(event.skillId);
  const namedSkill = event.skillName == null ? undefined : context.helpers.skillsByName?.get(event.skillName);
  if (!(skill || namedSkill)?.stealthAttack) return;
  const state = professionCoreState(context);
  const profile = balanceProfileFromContext(context, PROFILE.shadowSiphoning);
  const readyAt = Number(state.traitProcReadyAt[TRAIT.SHADOW_SIPHONING] || 0);
  if (!isInternalCooldownReady(event.at, readyAt)) return;
  state.traitProcReadyAt[TRAIT.SHADOW_SIPHONING] = event.at + Number(profile?.internalCooldown || 1);
  enqueueSiphon(
    context,
    event,
    TRAIT.SHADOW_SIPHONING,
    'Shadow Siphoning',
    Number(balanceProfileEffect(profile, 'strike')?.coefficient || 0.1)
  );
}

export function applyCloakedInShadow(context: ThiefResolverContext, application: ThiefResolverEvent): void {
  if (application.condition !== 'Blindness' || !hasTrait(context.config, TRAIT.CLOAKED_IN_SHADOW)) return;
  const strike = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.cloakedInShadow), 'strike');
  enqueueSiphon(
    context,
    application,
    TRAIT.CLOAKED_IN_SHADOW,
    'Cloaked in Shadow',
    Number(strike?.coefficient || 0.04)
  );
}
