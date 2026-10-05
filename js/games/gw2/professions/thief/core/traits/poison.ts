import { claimActivation } from '#gw2/platform/combat/activation-claims.js';
import { skillForEvent } from '#gw2/platform/combat/query/runtime-query.js';
import { CANONICAL_TARGET_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { professionCoreState } from '#gw2/platform/profession-definition/state.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/skills/balance-profiles.js';
import type { BalanceProfile } from '#gw2/platform/skills/types.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { buildResolverBuff, buildResolverCondition } from '#gw2/platform/resolver/packets.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefResolverContext, ThiefResolverEvent } from '#gw2/professions/thief/types.js';

/** The first landed strike of each dual attack applies poison, even when its cast is interrupted later. */
export function applyDeadlyAmbition(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0)) return;
  const skill = skillForEvent(context.helpers, event);
  if (!skill || event.sourceId !== skill.id) return;
  const isDualWieldAttack =
    skill.categories?.includes('DualWield') ||
    Boolean(skill.requiredMainHand && typeof skill.requiredOffHand === 'string');
  if (!isDualWieldAttack || !hasTrait(context.traits, TRAIT.DEADLY_AMBITION)) return;
  const state = professionCoreState(context);

  const deadlyAmbitionProfile = requireBalanceProfileFromContext(context, TRAIT.DEADLY_AMBITION);
  const poison = requireEffect(deadlyAmbitionProfile, 'condition', 'Poisoned');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!poison) return;
  // Preserve the local identity rule for packets without an activation ID.
  const activation = event.activationId || `${skill.id}:${event.at}`;
  if (!claimActivation(state.activationClaims, 'thief.deadly-ambition', activation)) return;
  context.effects.emit({
    kind: 'packet',
    settlement: 'reaction',
    event: buildResolverCondition({
      at: event.at,
      source: 'Trait',
      actorType: 'player',
      skillId: TRAIT.DEADLY_AMBITION,
      skillName: 'Deadly Ambition',
      activationId: event.activationId,
      triggeredBy: event.skillName,
      condition: String(poison.condition),
      duration: effectNumber(deadlyAmbitionProfile, poison, 'duration'),
      stacks: potentPoisonStacks(context.config, deadlyAmbitionProfile, poison),
      sourceId: TRAIT.DEADLY_AMBITION,
      name: 'Deadly Ambition — Poison'
    })
  });
}

/** Player-applied poison grants self Might and target Weakness once per shared ten-second cooldown. */
export function applyLotusPoison(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (
    event.condition !== 'Poisoned' ||
    event.actorType !== 'player' ||
    (event.metadata?.triggeredByAlly || 0) > 0 ||
    !hasTrait(context.traits, TRAIT.LOTUS_POISON)
  )
    return;

  const lotusPoisonProfile = requireBalanceProfileFromContext(context, TRAIT.LOTUS_POISON);
  if (
    !context.procs.claimCooldown(
      TRAIT.LOTUS_POISON,
      event.at,
      balanceProfileNumber(lotusPoisonProfile, 'internalCooldown')
    )
  )
    return;
  const might = requireEffect(lotusPoisonProfile, 'boon', 'Might');
  if (might) {
    const boon = String(might.boon);
    context.effects.emit({
      kind: 'packet',
      event: buildResolverBuff({
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.LOTUS_POISON,
        actorType: 'effect',
        skillId: TRAIT.LOTUS_POISON,
        skillName: 'Lotus Poison',
        name: `Lotus Poison - ${boon}`,
        kind: boon.toLowerCase(),
        stacks: effectNumber(lotusPoisonProfile, might, 'stacks'),
        duration: effectNumber(lotusPoisonProfile, might, 'duration'),
        audience: { recipients: 'self' },
        triggeredBy: event.skillName
      }),
      durationContext: event
    });
  }

  const weakness = requireEffect(lotusPoisonProfile, 'condition', 'Weakness');
  if (weakness)
    context.effects.emit({
      kind: 'packet',
      event: buildResolverCondition({
        at: event.at,
        source: 'Trait',
        sourceId: TRAIT.LOTUS_POISON,
        actorType: 'player',
        skillId: TRAIT.LOTUS_POISON,
        skillName: 'Lotus Poison',
        name: 'Lotus Poison - Weakness',
        condition: String(weakness.condition),
        stacks: effectNumber(lotusPoisonProfile, weakness, 'stacks'),
        duration: effectNumber(lotusPoisonProfile, weakness, 'duration'),
        activationId: event.activationId,
        triggeredBy: event.skillName
      })
    });
}

export function applyPanicStrike(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0) || !hasTrait(context.traits, TRAIT.PANIC_STRIKE))
    return;

  const panicStrikeProfile = requireBalanceProfileFromContext(context, TRAIT.PANIC_STRIKE);
  if (targetConditionCount(context, event.at) < balanceProfileNumber(panicStrikeProfile, 'threshold')) return;
  const immobilized = requireEffect(panicStrikeProfile, 'condition', 'Immobilized');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!immobilized) return;
  // Claim this owner's ICD before effects or resource snapshots can re-enter the trait.
  if (
    !context.procs.claimCooldown(
      TRAIT.PANIC_STRIKE,
      event.at,
      balanceProfileNumber(panicStrikeProfile, 'internalCooldown')
    )
  )
    return;
  context.effects.emit({
    kind: 'packet',
    settlement: 'reaction',
    event: buildResolverCondition({
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.PANIC_STRIKE,
      actorType: 'player',
      skillId: TRAIT.PANIC_STRIKE,
      skillName: 'Panic Strike',
      name: 'Panic Strike - Immobilized',
      condition: String(immobilized.condition),
      stacks: effectNumber(panicStrikeProfile, immobilized, 'stacks'),
      duration: effectNumber(panicStrikeProfile, immobilized, 'duration'),
      activationId: `panic-strike:${event.at}`,
      triggeredBy: event.skillName
    })
  });
}

export function applyPanicStrikePoison(context: ThiefResolverContext, application: ThiefResolverEvent): void {
  if (
    application.condition !== 'Immobilized' ||
    application.actorType !== 'player' ||
    !hasTrait(context.traits, TRAIT.PANIC_STRIKE)
  )
    return;

  const panicStrikeProfile = requireBalanceProfileFromContext(context, TRAIT.PANIC_STRIKE);
  const poison = requireEffect(panicStrikeProfile, 'condition', 'Poisoned');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!poison) return;
  context.effects.emit({
    kind: 'packet',
    event: buildResolverCondition({
      at: application.at,
      source: 'Trait',
      sourceId: TRAIT.PANIC_STRIKE,
      actorType: 'player',
      skillId: TRAIT.PANIC_STRIKE,
      skillName: 'Panic Strike',
      name: 'Panic Strike - Poison',
      condition: String(poison.condition),
      stacks: potentPoisonStacks(context.config, panicStrikeProfile, poison),
      duration: effectNumber(panicStrikeProfile, poison, 'duration'),
      activationId: application.activationId || `panic-strike:${application.at}`,
      triggeredBy: application.skillName
    })
  });
}

function targetConditionCount(context: ThiefResolverContext, at: number): number {
  return CANONICAL_TARGET_CONDITIONS.filter((condition) => context.combat.targetHasCondition(condition, at)).length;
}

/** Poison-producing traits share the selected stack override while retaining their own profile tuning. */
export function potentPoisonStacks(context: unknown, profile: BalanceProfile, effect: SkillEffect): number {
  return hasTrait(context, TRAIT.POTENT_POISON)
    ? balanceProfileNumber(profile, 'playerStacks')
    : effectNumber(profile, effect, 'stacks');
}
