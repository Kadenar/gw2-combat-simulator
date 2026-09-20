import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import { emitSkillCondition, emitSkillDamage } from '#gw2/platform/scheduler/skill-events.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { CANONICAL_TARGET_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { skillForEvent } from '#gw2/platform/combat/query/event-skill.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { queueThiefBoon } from '#gw2/professions/thief/core/traits/critical-strikes.js';
import type { ThiefCastContext, ThiefResolverContext, ThiefResolverEvent } from '#gw2/professions/thief/types.js';

/** Attribute on-steal poison to Serpent's Touch while retaining the triggering skill. */
export function applySerpentsTouch(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.SERPENTS_TOUCH)) return;
  const profile = balanceProfileFromContext(context, PROFILE.serpentsTouch);
  const poison = balanceProfileEffect(profile, 'condition');
  emitSkillCondition(context, {
    at,
    source: 'Trait',
    skillId: TRAIT.SERPENTS_TOUCH,
    skillName: "Serpent's Touch",
    triggeredBy: context.skill?.name,
    condition: String(poison?.condition || 'Poisoned'),
    duration: Number(poison?.duration ?? 10),
    stacks: hasTrait(context.config, TRAIT.POTENT_POISON)
      ? Number(profile?.playerStacks ?? 3)
      : Number(poison?.stacks ?? 2),
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
    coefficient: Number(strike?.coefficient ?? 1.5),
    hits: Number(strike?.hits ?? 1),
    canCrit: false
  });
}

export function applyEvenTheOdds(context: ThiefCastContext, at: number): void {
  if (!hasTrait(context.config, TRAIT.EVEN_THE_ODDS)) return;
  const vulnerability = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.evenTheOdds), 'condition');
  emitSkillCondition(context, {
    at,
    source: 'Trait',
    skillId: context.skill?.id ?? null,
    skillName: context.skill?.name ?? null,
    condition: String(vulnerability?.condition || 'Vulnerability'),
    duration: Number(vulnerability?.duration ?? 10),
    stacks: Number(vulnerability?.stacks ?? 10),
    sourceId: TRAIT.EVEN_THE_ODDS,
    name: 'Even the Odds — Vulnerability'
  });
}

/** The first landed strike of each dual attack applies poison, even when its cast is interrupted later. */
export function applyDeadlyAmbition(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
  const skill = skillForEvent(context.helpers, event);
  if (!skill || event.sourceId !== skill.id) return;
  const isDualWieldAttack =
    skill.categories?.includes('DualWield') ||
    Boolean(skill.requiredMainHand && typeof skill.requiredOffHand === 'string');
  if (!isDualWieldAttack || !hasTrait(context.config, TRAIT.DEADLY_AMBITION)) return;
  const state = professionCoreState(context);
  const activation = `deadly-ambition:${event.activationId || `${skill.id}:${event.at}`}`;
  if (state.traitProcProgress[activation]) return;
  state.traitProcProgress[activation] = 1;
  const profile = balanceProfileFromContext(context, PROFILE.deadlyAmbition);
  const poison = balanceProfileEffect(profile, 'condition');
  context.applyCondition({
    type: 'condition',
    at: event.at,
    source: 'Trait',
    actorType: 'player',
    skillId: TRAIT.DEADLY_AMBITION,
    skillName: 'Deadly Ambition',
    activationId: event.activationId,
    triggeredBy: event.skillName,
    condition: String(poison?.condition || 'Poisoned'),
    duration: Number(poison?.duration ?? 3),
    stacks: hasTrait(context.config, TRAIT.POTENT_POISON)
      ? Number(profile?.playerStacks ?? 2)
      : Number(poison?.stacks ?? 1),
    sourceId: TRAIT.DEADLY_AMBITION,
    name: 'Deadly Ambition — Poison'
  });
}

/** Player-applied poison grants self Might and target Weakness once per shared ten-second cooldown. */
export function applyLotusPoison(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (
    event.condition !== 'Poisoned' ||
    event.actorType !== 'player' ||
    Number(event.metadata?.triggeredByAlly || 0) > 0 ||
    !hasTrait(context.config, TRAIT.LOTUS_POISON)
  )
    return;
  const profile = balanceProfileFromContext(context, PROFILE.lotusPoison);
  if (
    !tryConsumeProcCooldown(
      professionCoreState(context).traitProcReadyAt,
      TRAIT.LOTUS_POISON,
      event.at,
      Number(profile?.internalCooldown ?? 10)
    )
  )
    return;
  const might = balanceProfileEffect(profile, 'boon');
  queueThiefBoon(context, event, {
    traitId: TRAIT.LOTUS_POISON,
    traitName: 'Lotus Poison',
    boon: String(might?.boon || 'Might'),
    stacks: Number(might?.stacks ?? 3),
    duration: Number(might?.duration ?? 10)
  });
  const weakness = balanceProfileEffect(profile, 'condition');
  context.queue.enqueue({
    type: 'condition',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.LOTUS_POISON,
    actorType: 'player',
    skillId: TRAIT.LOTUS_POISON,
    skillName: 'Lotus Poison',
    name: 'Lotus Poison - Weakness',
    condition: String(weakness?.condition || 'Weakness'),
    stacks: Number(weakness?.stacks ?? 1),
    duration: Number(weakness?.duration ?? 4),
    activationId: event.activationId,
    triggeredBy: event.skillName
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
      Number(balanceProfileFromContext(context, PROFILE.panicStrike)?.threshold ?? 3)
  )
    return;
  const state = professionCoreState(context);
  const profile = balanceProfileFromContext(context, PROFILE.panicStrike);
  const immobilized = balanceProfileEffect(profile, 'condition', 0);
  // Claim this owner's ICD before effects or resource snapshots can re-enter the trait.
  if (
    !tryConsumeProcCooldown(
      state.traitProcReadyAt,
      TRAIT.PANIC_STRIKE,
      event.at,
      Number(profile?.internalCooldown ?? 20)
    )
  )
    return;
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
    stacks: Number(immobilized?.stacks ?? 1),
    duration: Number(immobilized?.duration ?? 2.5),
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
  context.queue.enqueue({
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
      ? Number(profile?.playerStacks ?? 2)
      : Number(poison?.stacks ?? 1),
    duration: Number(poison?.duration ?? 4),
    activationId: application.activationId || `panic-strike:${application.at}`,
    triggeredBy: application.skillName
  });
}
