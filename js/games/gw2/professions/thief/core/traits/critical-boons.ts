import { professionStaticRulesApplied } from '#gw2/platform/builds/attribute-provenance.js';
import {
  buffMatchesAudience,
  durationStackingBoonCapSeconds,
  remainingDurationStackSeconds
} from '#gw2/platform/combat/boons.js';
import type { Gw2ModifierContext } from '#gw2/platform/combat/modifiers.js';
import type { Gw2ResolvedStats } from '#gw2/platform/combat/query/combat-query.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import {
  balanceProfileNumber,
  effectNumber,
  requireBalanceProfileFromContext,
  requireEffect
} from '#gw2/platform/engine/skills/balance-profiles.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { ResolvedCriticalHitOptions } from '#gw2/platform/profession-definition/mechanics.js';
import { criticalProcHandler } from '#gw2/platform/profession-definition/mechanics.js';
import type { NativeResolvedDamageDetails } from '#gw2/platform/profession-definition/module-types.js';
import { buildResolverBuff } from '#gw2/platform/resolver/packets.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import type { ThiefResolverContext, ThiefResolverEvent } from '#gw2/professions/thief/types.js';

export type ThiefCriticalHitDefinition = ResolvedCriticalHitOptions<
  ThiefResolverContext,
  ThiefResolverEvent,
  NativeResolvedDamageDetails
>;

/** Removed boons are omitted; surviving tuning is read from the selected profile. */
export function criticalBoonDefinition(context: unknown, traitId: SkillId) {
  const selectedProfile = requireBalanceProfileFromContext(context, traitId);
  const effect = requireEffect(selectedProfile, 'boon', 'Fury');
  if (!effect) return null;
  return {
    boon: String(effect.boon),
    duration: effectNumber(selectedProfile, effect, 'duration'),
    stacks: effectNumber(selectedProfile, effect, 'stacks')
  };
}

/** Shared eligibility excludes non-player, missed, cancelled and flat life-steal packets. */
export function criticalBoonEligible(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  traitId: SkillId
): boolean {
  return (
    event.type === 'damage' &&
    event.actorType === 'player' &&
    Number(event.coefficient) > 0 &&
    event.cancelled !== true &&
    !missesTarget(event) &&
    event.canCrit !== false &&
    !Number.isFinite(event.flatDamage) &&
    !Number.isFinite(event.flatStrikeBase) &&
    !Number.isFinite(event.flatStrikePowerCoeff) &&
    hasTrait(context.config, traitId) &&
    criticalBoonDefinition(context, traitId) !== null
  );
}

export const unrelentingStrikesCriticalReaction = Object.freeze({
  id: 'thief.unrelenting-strikes',
  actorTypes: ['player'] as const,
  when: (context: ThiefResolverContext, event: ThiefResolverEvent, details: NativeResolvedDamageDetails) =>
    Boolean(details.hitContext?.critEligible) && criticalBoonEligible(context, event, TRAIT.UNRELENTING_STRIKES),
  internalCooldown: {
    duration: (context: ThiefResolverContext) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.UNRELENTING_STRIKES), 'internalCooldown'),
    readyAt: (context: ThiefResolverContext) => context.procs.deadline(TRAIT.UNRELENTING_STRIKES) || 0,
    setReadyAt: (context: ThiefResolverContext, readyAt: number) => {
      context.procs.setDeadline(TRAIT.UNRELENTING_STRIKES, readyAt);
    }
  },
  handler: (context, event, _details, application) => {
    // One invocation shares authored effects; each queued boon still samples live duration scaling.
    const definition = criticalBoonDefinition(context, TRAIT.UNRELENTING_STRIKES);
    if (!definition) return;
    const { boon, duration, stacks } = definition;
    for (let proc = 0; proc < application.quantity; proc += 1) {
      context.effects.emit({
        kind: 'packet',
        event: buildResolverBuff({
          at: event.at,
          source: 'Trait',
          sourceId: TRAIT.UNRELENTING_STRIKES,
          actorType: 'effect',
          skillId: TRAIT.UNRELENTING_STRIKES,
          skillName: 'Unrelenting Strikes',
          name: `Unrelenting Strikes - ${boon}`,
          kind: boon.toLowerCase(),
          duration,
          stacks,
          audience: { recipients: 'party' },
          triggeredBy: event.skillName
        }),
        durationContext: event
      });
    }
  }
} satisfies ThiefCriticalHitDefinition);

/** The damage dispatcher invokes this after stealth breaking and before No Quarter, sharing the resolved critical fact. */
export const applyUnrelentingStrikes = criticalProcHandler(unrelentingStrikesCriticalReaction);

/** Reconcile this trait's live bonus at its original attribute phase. */
export function applyNoQuarterAttributes(
  context: Gw2ModifierContext,
  result: { -readonly [K in keyof Gw2ResolvedStats]: Gw2ResolvedStats[K] }
): void {
  const staticRulesApplied = professionStaticRulesApplied(context.config);
  if (
    hasTrait(context, TRAIT.NO_QUARTER) &&
    context.query?.furyActiveAt(context.time, context.runtime, context.event) &&
    !(staticRulesApplied && Boolean((context.config?.boons as Record<string, unknown>).fury))
  ) {
    const noQuarterProfile = requireBalanceProfileFromContext(context, TRAIT.NO_QUARTER);
    result.ferocity += balanceProfileNumber(noQuarterProfile, 'attributeBonus');
  }
}

export function extendActiveFury(context: ThiefResolverContext, event: ThiefResolverEvent, duration: number): void {
  // Extend Fury only while its canonical half-open window is active at the hit time.
  if (
    remainingDurationStackSeconds(context.combat.boonApplications('fury'), event.at, {
      includes: (application) => buffMatchesAudience(application, 'all'),
      maximum: durationStackingBoonCapSeconds('fury')
    }) <= 0
  )
    return;
  const extension: ThiefResolverEvent = {
    type: 'boon_extension',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.NO_QUARTER,
    actorType: 'effect',
    skillId: TRAIT.NO_QUARTER,
    skillName: 'No Quarter',
    kind: 'fury',
    duration
  };
  // Extension settles in the hit transaction before subsequent critical reactions inspect Fury.
  context.effects.emit({ kind: 'packet', event: extension, cause: event, settlement: 'reaction' });
  context.effects.emit({
    kind: 'announcement',
    cause: event,
    log: true,
    attribution: {
      source: 'Trait',
      sourceId: TRAIT.NO_QUARTER,
      actorType: 'effect',
      skillId: TRAIT.NO_QUARTER,
      skillName: 'No Quarter'
    },
    announcement: {
      type: 'trait',
      name: 'No Quarter - Fury Extension',
      at: event.at,
      sourceSkill: event.skillName,
      detail: `Fury extended by ${duration}s`
    }
  });
}

export const noQuarterCriticalReaction = Object.freeze({
  id: 'thief.no-quarter',
  actorTypes: ['player'] as const,
  when: (context: ThiefResolverContext, event: ThiefResolverEvent, details: NativeResolvedDamageDetails) =>
    Boolean(details.hitContext?.critEligible) &&
    criticalBoonEligible(context, event, TRAIT.NO_QUARTER) &&
    details.hitContext?.critical.furyActive === true,
  internalCooldown: {
    duration: (context: ThiefResolverContext) =>
      balanceProfileNumber(requireBalanceProfileFromContext(context, TRAIT.NO_QUARTER), 'internalCooldown'),
    readyAt: (context: ThiefResolverContext) => context.procs.deadline(TRAIT.NO_QUARTER) || 0,
    setReadyAt: (context: ThiefResolverContext, readyAt: number) => {
      context.procs.setDeadline(TRAIT.NO_QUARTER, readyAt);
    }
  },
  handler: (context, event, _details, application) => {
    // Reuse authored duration within this batch while extending the live pool for each proc.
    const definition = criticalBoonDefinition(context, TRAIT.NO_QUARTER);
    if (!definition) return;
    const { duration } = definition;
    for (let proc = 0; proc < application.quantity; proc += 1) {
      extendActiveFury(context, event, duration);
    }
  }
} satisfies ThiefCriticalHitDefinition);
