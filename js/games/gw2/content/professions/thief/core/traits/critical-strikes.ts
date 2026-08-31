import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boon-duration.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/content/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/content/professions/thief/core/profiles.js';
import type { SkillId } from '#gw2/platform/engine/types.js';
import type { ResolvedCriticalHitOptions } from '#gw2/integrations/patches/authoring/mechanics.js';
import type {
  ThiefResolverContext,
  ThiefResolverEvent,
  ThiefResolverReactionDetails
} from '#gw2/content/professions/thief/types.js';

type ThiefCriticalHitDefinition = ResolvedCriticalHitOptions<
  ThiefResolverContext,
  ThiefResolverEvent,
  ThiefResolverReactionDetails
>;

/** Queues Critical Strikes boon reactions while preserving live duration scaling and proc state. */
function queueThiefBoon(
  context: ThiefResolverContext,
  event: ThiefResolverEvent,
  {
    traitId,
    traitName,
    boon,
    duration,
    stacks = 1,
    recipients = 'self'
  }: {
    readonly traitId: SkillId;
    readonly traitName: string;
    readonly boon: string;
    readonly duration: number;
    readonly stacks?: number;
    readonly recipients?: 'self' | 'party';
  }
): void {
  enqueueOrdered(context.queue, {
    type: 'buff',
    at: event.at,
    source: 'Trait',
    sourceId: traitId,
    actorType: 'effect',
    skillId: traitId,
    skillName: traitName,
    name: `${traitName} - ${boon}`,
    kind: boon.toLowerCase(),
    duration: gw2ResolverBoonDuration(context, event, boon, duration),
    stacks,
    recipients,
    maximumRecipients: recipients === 'party' ? 5 : 1,
    triggeredBy: event.skillName
  });
}

function activeSelfFuryApplications(context: ThiefResolverContext, at: number) {
  return (context.boons.get('fury') || []).filter(
    (application) =>
      application.affectsSelf !== false && application.at <= at + EPSILON && application.expiresAt > at + EPSILON
  );
}

function extendActiveFury(context: ThiefResolverContext, event: ThiefResolverEvent, duration: number): void {
  const applications = context.boons.get('fury') || [];
  const active = new Set(activeSelfFuryApplications(context, event.at));
  if (!active.size) return;
  context.boons.set(
    'fury',
    applications.map((application) =>
      active.has(application) ? { ...application, expiresAt: application.expiresAt + duration } : application
    )
  );
  enqueueOrdered(context.queue, {
    type: 'proc',
    at: event.at,
    source: 'Trait',
    sourceId: TRAIT.NO_QUARTER,
    actorType: 'effect',
    skillId: TRAIT.NO_QUARTER,
    skillName: 'No Quarter',
    name: 'No Quarter - Fury Extension',
    duration,
    triggeredBy: event.skillName
  });
}

function traitCriticalProgress(context: ThiefResolverContext, traitId: SkillId): number {
  return Number(professionCoreState(context).traitProcProgress[String(traitId)] || 0);
}

function setTraitCriticalProgress(context: ThiefResolverContext, traitId: SkillId, value: number): void {
  professionCoreState(context).traitProcProgress[String(traitId)] = value;
}

export const unrelentingStrikesCriticalReaction = Object.freeze({
  id: 'thief.unrelenting-strikes',
  order: 10,
  materialization: 'threshold',
  actorTypes: ['player'] as const,
  when: (context: ThiefResolverContext, event: ThiefResolverEvent, details: ThiefResolverReactionDetails) =>
    Boolean(details.hitContext?.critEligible) &&
    Number(event.coefficient) > 0 &&
    hasTrait(context.config, TRAIT.UNRELENTING_STRIKES),
  expectedProgress: {
    get: (context: ThiefResolverContext) => traitCriticalProgress(context, TRAIT.UNRELENTING_STRIKES),
    set: (context: ThiefResolverContext, value: number) =>
      setTraitCriticalProgress(context, TRAIT.UNRELENTING_STRIKES, value)
  },
  internalCooldown: {
    duration: (context: ThiefResolverContext) =>
      Number(balanceProfileFromContext(context, PROFILE.unrelentingStrikes)?.internalCooldown || 8),
    readyAt: (context: ThiefResolverContext) =>
      Number(professionCoreState(context).traitProcReadyAt[TRAIT.UNRELENTING_STRIKES] || 0),
    setReadyAt: (context: ThiefResolverContext, readyAt: number) => {
      professionCoreState(context).traitProcReadyAt[TRAIT.UNRELENTING_STRIKES] = readyAt;
    }
  },
  attribution: {
    kind: 'trait' as const,
    id: TRAIT.UNRELENTING_STRIKES
  },
  handler: (context, event, _details, application) => {
    for (let proc = 0; proc < application.quantity; proc += 1) {
      const fury = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.unrelentingStrikes), 'boon');
      queueThiefBoon(context, event, {
        traitId: TRAIT.UNRELENTING_STRIKES,
        traitName: 'Unrelenting Strikes',
        boon: String(fury?.boon || 'Fury'),
        duration: Number(fury?.duration || 4),
        stacks: Number(fury?.stacks || 1),
        recipients: 'party'
      });
    }
  }
} satisfies ThiefCriticalHitDefinition);

export const noQuarterCriticalReaction = Object.freeze({
  id: 'thief.no-quarter',
  order: 20,
  materialization: 'threshold',
  actorTypes: ['player'] as const,
  when: (context: ThiefResolverContext, event: ThiefResolverEvent, details: ThiefResolverReactionDetails) =>
    Boolean(details.hitContext?.critEligible) &&
    Number(event.coefficient) > 0 &&
    hasTrait(context.config, TRAIT.NO_QUARTER) &&
    context.query.furyActiveAt(event.at, context, event),
  expectedProgress: {
    get: (context: ThiefResolverContext) => traitCriticalProgress(context, TRAIT.NO_QUARTER),
    set: (context: ThiefResolverContext, value: number) => setTraitCriticalProgress(context, TRAIT.NO_QUARTER, value)
  },
  internalCooldown: {
    duration: (context: ThiefResolverContext) =>
      Number(balanceProfileFromContext(context, PROFILE.noQuarter)?.internalCooldown || 2),
    readyAt: (context: ThiefResolverContext) =>
      Number(professionCoreState(context).traitProcReadyAt[TRAIT.NO_QUARTER] || 0),
    setReadyAt: (context: ThiefResolverContext, readyAt: number) => {
      professionCoreState(context).traitProcReadyAt[TRAIT.NO_QUARTER] = readyAt;
    }
  },
  attribution: { kind: 'trait' as const, id: TRAIT.NO_QUARTER },
  handler: (context, event, _details, application) => {
    for (let proc = 0; proc < application.quantity; proc += 1) {
      const fury = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.noQuarter), 'boon');
      extendActiveFury(context, event, Number(fury?.duration || 2));
    }
  }
} satisfies ThiefCriticalHitDefinition);

export function applyAssassinsFury(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (
    String(event.kind || '').toLowerCase() !== 'fury' ||
    event.affectsSelf === false ||
    !hasTrait(context.config, TRAIT.ASSASSINS_FURY)
  )
    return;
  const state = professionCoreState(context);
  const profile = balanceProfileFromContext(context, PROFILE.assassinsFury);
  const might = balanceProfileEffect(profile, 'boon');
  const readyAt = Number(state.traitProcReadyAt[TRAIT.ASSASSINS_FURY] || 0);
  if (!isInternalCooldownReady(event.at, readyAt)) return;
  state.traitProcReadyAt[TRAIT.ASSASSINS_FURY] = event.at + Number(profile?.internalCooldown || 2);
  queueThiefBoon(context, event, {
    traitId: TRAIT.ASSASSINS_FURY,
    traitName: "Assassin's Fury",
    boon: String(might?.boon || 'Might'),
    duration: Number(might?.duration || 8),
    stacks: Number(might?.stacks || 3)
  });
}
