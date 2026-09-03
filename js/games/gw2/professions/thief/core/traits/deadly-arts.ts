import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { CANONICAL_TARGET_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import type {
  ThiefCastContext,
  ThiefResolverContext,
  ThiefResolverEvent,
  ThiefSkill
} from '#gw2/professions/thief/types.js';

/** Applies Deadly Arts effects at their existing steal, cast, and resolver boundaries. */
export function applySerpentsTouch(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.SERPENTS_TOUCH)) return;
  const profile = balanceProfileFromContext(context, PROFILE.serpentsTouch);
  const poison = balanceProfileEffect(profile, 'condition');
  emitSkillCondition(context, {
    at,
    source: 'Trait',
    actorType: 'player',
    skillId: context.skill?.id ?? null,
    skillName: context.skill?.name ?? null,
    condition: String(poison?.condition || 'Poisoned'),
    duration: Number(poison?.duration || 10),
    stacks: hasTrait(context.config, TRAIT.POTENT_POISON)
      ? Number(profile?.playerStacks || 3)
      : Number(poison?.stacks || 2),
    sourceId: TRAIT.SERPENTS_TOUCH,
    name: "Serpent's Touch — Poison"
  });
}

export function applyMug(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.MUG)) return;
  const strike = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.mug), 'strike');
  emitSkillDamage(context, {
    at,
    source: 'Trait',
    sourceId: TRAIT.MUG,
    actorType: 'player',
    skillId: context.skill?.id,
    skillName: context.skill?.name,
    name: 'Mug',
    coefficient: Number(strike?.coefficient || 1.5),
    hits: Number(strike?.hits || 1),
    canCrit: false
  });
}

export function applyEvenTheOdds(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.EVEN_THE_ODDS)) return;
  const vulnerability = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.evenTheOdds), 'condition');
  emitSkillCondition(context, {
    at,
    source: 'Trait',
    actorType: 'player',
    skillId: context.skill?.id ?? null,
    skillName: context.skill?.name ?? null,
    condition: String(vulnerability?.condition || 'Vulnerability'),
    duration: Number(vulnerability?.duration || 10),
    stacks: Number(vulnerability?.stacks || 10),
    sourceId: TRAIT.EVEN_THE_ODDS,
    name: 'Even the Odds — Vulnerability'
  });
}

export function applyDeadlyAmbition(context: ThiefCastContext, skill: ThiefSkill, at: number): void {
  const isDualWieldAttack =
    skill.categories?.includes('DualWield') ||
    Boolean(skill.requiredMainHand && typeof skill.requiredOffHand === 'string');
  if (!isDualWieldAttack || !hasTrait(context.config, TRAIT.DEADLY_AMBITION)) return;
  const profile = balanceProfileFromContext(context, PROFILE.deadlyAmbition);
  const poison = balanceProfileEffect(profile, 'condition');
  emitSkillCondition(context, {
    at,
    source: 'Trait',
    actorType: 'player',
    skillId: context.skill?.id ?? null,
    skillName: context.skill?.name ?? null,
    condition: String(poison?.condition || 'Poisoned'),
    duration: Number(poison?.duration || 3),
    stacks: hasTrait(context.config, TRAIT.POTENT_POISON)
      ? Number(profile?.playerStacks || 2)
      : Number(poison?.stacks || 1),
    sourceId: TRAIT.DEADLY_AMBITION,
    name: 'Deadly Ambition — Poison'
  });
}

function targetConditionCount(context: ThiefResolverContext, at: number): number {
  return CANONICAL_TARGET_CONDITIONS.filter((condition) => context.query?.targetHasCondition(condition, at, context))
    .length;
}

export function applyPanicStrike(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    !hasTrait(context.config, TRAIT.PANIC_STRIKE) ||
    targetConditionCount(context, event.at) <
      Number(balanceProfileFromContext(context, PROFILE.panicStrike)?.threshold || 3)
  )
    return;
  const state = professionCoreState(context);
  const profile = balanceProfileFromContext(context, PROFILE.panicStrike);
  const immobilized = balanceProfileEffect(profile, 'condition', 0);
  const readyAt = Number(state.traitProcReadyAt[TRAIT.PANIC_STRIKE] || 0);
  if (!isInternalCooldownReady(event.at, readyAt)) return;
  state.traitProcReadyAt[TRAIT.PANIC_STRIKE] = event.at + Number(profile?.internalCooldown || 20);
  context.applyCondition({
    type: 'condition',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.PANIC_STRIKE,
    actorType: 'player',
    skillId: TRAIT.PANIC_STRIKE,
    skillName: 'Panic Strike',
    name: 'Panic Strike - Immobilized',
    condition: String(immobilized?.condition || 'Immobilized'),
    stacks: Number(immobilized?.stacks || 1),
    duration: Number(immobilized?.duration || 2.5),
    activationId: `panic-strike:${event.at}`,
    triggeredBy: event.skillName
  });
}

export function applyPanicStrikePoison(context: ThiefResolverContext, application: ThiefResolverEvent): void {
  if (
    application.condition !== 'Immobilized' ||
    application.actorType !== 'player' ||
    !hasTrait(context.config, TRAIT.PANIC_STRIKE)
  )
    return;
  const profile = balanceProfileFromContext(context, PROFILE.panicStrike);
  const poison = balanceProfileEffect(profile, 'condition', 1);
  enqueueOrdered(context.queue, {
    type: 'condition',
    at: application.at,
    source: 'Trait',
    sourceId: TRAIT.PANIC_STRIKE,
    actorType: 'player',
    skillId: TRAIT.PANIC_STRIKE,
    skillName: 'Panic Strike',
    name: 'Panic Strike - Poison',
    condition: String(poison?.condition || 'Poisoned'),
    stacks: hasTrait(context.config, TRAIT.POTENT_POISON)
      ? Number(profile?.playerStacks || 2)
      : Number(poison?.stacks || 1),
    duration: Number(poison?.duration || 4),
    activationId: application.activationId || `panic-strike:${application.at}`,
    triggeredBy: application.skillName
  });
}
