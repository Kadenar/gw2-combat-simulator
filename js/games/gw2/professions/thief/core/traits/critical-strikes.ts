import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/combat/state/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { EPSILON, isInternalCooldownReady } from '#kernel/core/clock.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boon-duration.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { applyBoonExtension } from '#gw2/platform/combat/state/boon-extensions.js';
import {
  buffMatchesAudience,
  durationStackingBoonCapSeconds,
  remainingDurationStackSeconds
} from '#gw2/platform/combat/state/boons.js';
import { advanceScheduledCriticalProc } from '#gw2/platform/scheduler/critical-facts.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';
import type { ThiefSchedulerContext, ThiefSimulationEvent, ThiefScheduledTask } from '#gw2/professions/thief/types.js';
import type { Gw2SchedulerPolicy } from '#gw2/platform/scheduler/types.js';
import type { SchedulerContext } from '#gw2/platform/engine/execution/types.js';
import type { EffectAudience } from '#gw2/platform/engine/events/types.js';
import type { SkillId } from '#gw2/platform/engine/skills/types.js';
import type { ResolvedCriticalHitOptions } from '#gw2/platform/profession-definition/mechanics.js';
import type {
  ThiefResolverContext,
  ThiefResolverEvent,
  ThiefResolverReactionDetails
} from '#gw2/professions/thief/types.js';

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
    audience = { recipients: 'self' }
  }: {
    readonly traitId: SkillId;
    readonly traitName: string;
    readonly boon: string;
    readonly duration: number;
    readonly stacks?: number;
    readonly audience?: EffectAudience;
  }
): void {
  context.queue.enqueue({
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
    audience,
    triggeredBy: event.skillName
  });
}

function extendActiveFury(context: ThiefResolverContext, event: ThiefResolverEvent, duration: number): void {
  // Add one self-only duration delta at the hit time, retaining the shared expiry tolerance.
  if (
    remainingDurationStackSeconds(context.boons.get('fury') || [], event.at + EPSILON, {
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
  applyBoonExtension(context.boons, extension);
  if (context.reporting) context.resolved.push(extension);
  context.queue.enqueue({
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

/** Predict Fury-producing critical traits chronologically; resolution recomputes them from surviving hits. */
export function observeThiefCriticalBoons(context: ThiefSchedulerContext, event: ThiefSimulationEvent): void {
  if (
    event.type !== 'damage' ||
    event.actorType !== 'player' ||
    !(Number(event.coefficient) > 0) ||
    (!event.forceCrit && (event.noCrit || event.canCrit === false)) ||
    missesTarget(event) ||
    ![TRAIT.NO_QUARTER, TRAIT.UNRELENTING_STRIKES].some((trait) => hasTrait(context.config, trait))
  )
    return;
  context.tasks.schedule({
    type: 'thief.critical-boons',
    at: event.at,
    priority: -60,
    payload: { eventOrder: event.eventOrder }
  });
}

export function materializeThiefCriticalBoons(context: ThiefSchedulerContext, task: ThiefScheduledTask): void {
  const event = context.eventByOrder(Number(task.payload.eventOrder));
  if (!event || missesTarget(event)) return;
  const state = professionCoreState(context);
  // Snapshot before Unrelenting Strikes emits Fury: the current hit cannot use its own newly granted boon.
  const hadFury =
    (context.schedulerPolicy as Gw2SchedulerPolicy).critical(context as unknown as SchedulerContext, event)
      .furyActive === true;
  for (const [traitId, profileId, name] of [
    [TRAIT.UNRELENTING_STRIKES, PROFILE.unrelentingStrikes, 'Unrelenting Strikes'],
    [TRAIT.NO_QUARTER, PROFILE.noQuarter, 'No Quarter']
  ] as const) {
    if (!hasTrait(context.config, traitId) || (traitId === TRAIT.NO_QUARTER && !hadFury)) continue;
    const profile = balanceProfileFromContext(context, profileId);
    const tracker = {
      progress: Number(state.traitProcProgress[traitId] || 0),
      readyAt: Number(state.traitProcReadyAt[traitId] || 0)
    };
    const proc = advanceScheduledCriticalProc(
      context,
      event,
      {
        id: traitId === TRAIT.NO_QUARTER ? 'thief.no-quarter' : 'thief.unrelenting-strikes',
        internalCooldown: Number(profile?.internalCooldown ?? (traitId === TRAIT.NO_QUARTER ? 2 : 8))
      },
      tracker
    );
    state.traitProcProgress[traitId] = tracker.progress;
    state.traitProcReadyAt[traitId] = tracker.readyAt;
    if (!proc) continue;
    const effect = balanceProfileEffect(profile, 'boon');
    const duration = Number(effect?.duration ?? (traitId === TRAIT.NO_QUARTER ? 2 : 4));
    context.emitDerived(event, {
      type: traitId === TRAIT.NO_QUARTER ? 'boon_extension' : 'buff',
      at: event.at,
      source: 'Trait',
      sourceId: traitId,
      actorType: 'effect',
      skillId: traitId,
      skillName: name,
      kind: 'fury',
      schedulerBoonPrediction: true,
      duration:
        traitId === TRAIT.NO_QUARTER
          ? duration
          : gw2SchedulerBoonDuration(context, { id: traitId, name }, 'fury', duration),
      stacks: Number(effect?.stacks ?? 1),
      audience: { recipients: traitId === TRAIT.NO_QUARTER ? 'self' : 'party' }
    });
  }
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
      Number(balanceProfileFromContext(context, PROFILE.unrelentingStrikes)?.internalCooldown ?? 8),
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
    // One invocation shares authored effects; each queued boon still samples live duration scaling.
    const fury = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.unrelentingStrikes), 'boon');
    for (let proc = 0; proc < application.quantity; proc += 1) {
      queueThiefBoon(context, event, {
        traitId: TRAIT.UNRELENTING_STRIKES,
        traitName: 'Unrelenting Strikes',
        boon: String(fury?.boon || 'Fury'),
        duration: Number(fury?.duration ?? 4),
        stacks: Number(fury?.stacks ?? 1),
        audience: { recipients: 'party' as const }
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
      Number(balanceProfileFromContext(context, PROFILE.noQuarter)?.internalCooldown ?? 2),
    readyAt: (context: ThiefResolverContext) =>
      Number(professionCoreState(context).traitProcReadyAt[TRAIT.NO_QUARTER] || 0),
    setReadyAt: (context: ThiefResolverContext, readyAt: number) => {
      professionCoreState(context).traitProcReadyAt[TRAIT.NO_QUARTER] = readyAt;
    }
  },
  attribution: { kind: 'trait' as const, id: TRAIT.NO_QUARTER },
  handler: (context, event, _details, application) => {
    // Reuse authored duration within this batch while extending the live pool for each proc.
    const fury = balanceProfileEffect(balanceProfileFromContext(context, PROFILE.noQuarter), 'boon');
    for (let proc = 0; proc < application.quantity; proc += 1) {
      extendActiveFury(context, event, Number(fury?.duration ?? 2));
    }
  }
} satisfies ThiefCriticalHitDefinition);

export function applyAssassinsFury(context: ThiefResolverContext, event: ThiefResolverEvent): void {
  if (
    String(event.kind || '').toLowerCase() !== 'fury' ||
    !event.resolvedAudience?.includesSelf ||
    !hasTrait(context.config, TRAIT.ASSASSINS_FURY)
  )
    return;
  const state = professionCoreState(context);
  const profile = balanceProfileFromContext(context, PROFILE.assassinsFury);
  const might = balanceProfileEffect(profile, 'boon');
  const readyAt = Number(state.traitProcReadyAt[TRAIT.ASSASSINS_FURY] || 0);
  if (!isInternalCooldownReady(event.at, readyAt)) return;
  state.traitProcReadyAt[TRAIT.ASSASSINS_FURY] = event.at + Number(profile?.internalCooldown ?? 2);
  queueThiefBoon(context, event, {
    traitId: TRAIT.ASSASSINS_FURY,
    traitName: "Assassin's Fury",
    boon: String(might?.boon || 'Might'),
    duration: Number(might?.duration ?? 8),
    stacks: Number(might?.stacks ?? 3)
  });
}
