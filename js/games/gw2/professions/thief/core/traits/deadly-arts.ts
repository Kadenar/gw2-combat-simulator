import { buildResolverCondition, buildResolverBuff } from '#gw2/platform/resolver/packets.js';
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { CANONICAL_TARGET_CONDITIONS } from '#gw2/platform/combat/state/targets.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { skillForEvent } from '#gw2/platform/combat/query/event-skill.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import type { ThiefResolverContext, ThiefResolverEvent } from '#gw2/professions/thief/types.js';

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

  const deadlyAmbitionProfile = requireBalanceProfileFromContext(context, PROFILE.deadlyAmbition);
  const poison = requireEffect(deadlyAmbitionProfile, 'condition', 'Poisoned');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!poison) return;
  state.traitProcProgress[activation] = 1;
  context.applyCondition(
    buildResolverCondition({
      at: event.at,
      source: 'Trait',
      actorType: 'player',
      skillId: TRAIT.DEADLY_AMBITION,
      skillName: 'Deadly Ambition',
      activationId: event.activationId,
      triggeredBy: event.skillName,
      condition: String(poison.condition),
      duration: effectNumber(deadlyAmbitionProfile, poison, 'duration'),
      stacks: hasTrait(context.config, TRAIT.POTENT_POISON)
        ? balanceProfileNumber(deadlyAmbitionProfile, 'playerStacks')
        : effectNumber(deadlyAmbitionProfile, poison, 'stacks'),
      sourceId: TRAIT.DEADLY_AMBITION,
      name: 'Deadly Ambition — Poison'
    })
  );
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

  const lotusPoisonProfile = requireBalanceProfileFromContext(context, PROFILE.lotusPoison);
  if (
    !tryConsumeProcCooldown(
      professionCoreState(context).traitProcReadyAt,
      TRAIT.LOTUS_POISON,
      event.at,
      balanceProfileNumber(lotusPoisonProfile, 'internalCooldown')
    )
  )
    return;
  const might = requireEffect(lotusPoisonProfile, 'boon', 'Might');
  if (might) {
    const boon = String(might.boon);
    queueResolverBoon(
      context,
      event,
      buildResolverBuff({
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
      })
    );
  }

  const weakness = requireEffect(lotusPoisonProfile, 'condition', 'Weakness');
  if (weakness)
    context.queue.enqueue(
      buildResolverCondition({
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
    );
}

function targetConditionCount(context: ThiefResolverContext, at: number): number {
  return CANONICAL_TARGET_CONDITIONS.filter((condition) => context.query?.targetHasCondition(condition, at, context))
    .length;
}

export function applyPanicStrike(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (event.actorType !== 'player' || !(Number(event.coefficient) > 0) || !hasTrait(context.config, TRAIT.PANIC_STRIKE))
    return;
  const state = professionCoreState(context);

  const panicStrikeProfile = requireBalanceProfileFromContext(context, PROFILE.panicStrike);
  if (targetConditionCount(context, event.at) < balanceProfileNumber(panicStrikeProfile, 'threshold')) return;
  const immobilized = requireEffect(panicStrikeProfile, 'condition', 'Immobilized');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!immobilized) return;
  // Claim this owner's ICD before effects or resource snapshots can re-enter the trait.
  if (
    !tryConsumeProcCooldown(
      state.traitProcReadyAt,
      TRAIT.PANIC_STRIKE,
      event.at,
      balanceProfileNumber(panicStrikeProfile, 'internalCooldown')
    )
  )
    return;
  context.applyCondition(
    buildResolverCondition({
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
  );
}

export function applyPanicStrikePoison(context: ThiefResolverContext, application: ThiefResolverEvent): void {
  if (
    application.condition !== 'Immobilized' ||
    application.actorType !== 'player' ||
    !hasTrait(context.config, TRAIT.PANIC_STRIKE)
  )
    return;

  const panicStrikeProfile = requireBalanceProfileFromContext(context, PROFILE.panicStrike);
  const poison = requireEffect(panicStrikeProfile, 'condition', 'Poisoned');
  // Explicit removal suppresses this packet without restoring baseline tuning.
  if (!poison) return;
  context.queue.enqueue(
    buildResolverCondition({
      at: application.at,
      source: 'Trait',
      sourceId: TRAIT.PANIC_STRIKE,
      actorType: 'player',
      skillId: TRAIT.PANIC_STRIKE,
      skillName: 'Panic Strike',
      name: 'Panic Strike - Poison',
      condition: String(poison.condition),
      stacks: hasTrait(context.config, TRAIT.POTENT_POISON)
        ? balanceProfileNumber(panicStrikeProfile, 'playerStacks')
        : effectNumber(panicStrikeProfile, poison, 'stacks'),
      duration: effectNumber(panicStrikeProfile, poison, 'duration'),
      activationId: application.activationId || `panic-strike:${application.at}`,
      triggeredBy: application.skillName
    })
  );
}
