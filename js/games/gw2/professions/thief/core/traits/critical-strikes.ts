import { buildResolverBuff } from '#gw2/platform/resolver/packets.js';
import { eventReaction } from '#gw2/platform/profession-definition/mechanics.js';
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { balanceProfileFromContext, balanceProfileEffect } from '#gw2/platform/engine/skills/balance-profiles.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { queueResolverBoon } from '#gw2/platform/resolver/boons.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';
import { applyBoonExtension } from '#gw2/platform/combat/boons.js';
import {
  buffMatchesAudience,
  durationStackingBoonCapSeconds,
  remainingDurationStackSeconds
} from '#gw2/platform/combat/boons.js';
import { advanceScheduledCriticalProc } from '#gw2/platform/execution/gw2-policy/critical-facts.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import { missesTarget } from '#gw2/platform/combat/state/targets.js';
import type { ThiefSchedulerContext, ThiefSimulationEvent } from '#gw2/professions/thief/types.js';
import type { Gw2SchedulerPolicy } from '#gw2/platform/execution/gw2-policy/types.js';
import type { SchedulerContext } from '#gw2/platform/execution/types.js';
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

const CRITICAL_BOONS = [
  {
    traitId: TRAIT.UNRELENTING_STRIKES,
    profileId: PROFILE.unrelentingStrikes,
    id: 'thief.unrelenting-strikes',
    name: 'Unrelenting Strikes',
    duration: 4,
    internalCooldown: 8
  },
  {
    traitId: TRAIT.NO_QUARTER,
    profileId: PROFILE.noQuarter,
    id: 'thief.no-quarter',
    name: 'No Quarter',
    duration: 2,
    internalCooldown: 2
  }
] as const;

/** Both phases read the same patched effects and defaults, while each applies its own boon duration. */
function criticalBoonDefinition(context: unknown, traitId: SkillId) {
  const rule = CRITICAL_BOONS.find((rule) => rule.traitId === traitId)!;
  const profile = balanceProfileFromContext(context, rule.profileId);
  const effect = balanceProfileEffect(profile, 'boon');
  return {
    ...rule,
    boon: String(effect?.boon || 'Fury'),
    duration: Number(effect?.duration ?? rule.duration),
    stacks: Number(effect?.stacks ?? 1),
    internalCooldown: Number(profile?.internalCooldown ?? rule.internalCooldown)
  };
}

/** Eligibility uses the hit's pre-reaction Fury fact in both phase adapters. */
function criticalBoonEligible(
  context: ThiefSchedulerContext | ThiefResolverContext,
  event: ThiefSimulationEvent,
  traitId: SkillId,
  hadFury: boolean
): boolean {
  return (
    event.type === 'damage' &&
    event.actorType === 'player' &&
    Number(event.coefficient) > 0 &&
    event.cancelled !== true &&
    !missesTarget(event) &&
    !event.noCrit &&
    event.canCrit !== false &&
    !Number.isFinite(event.flatDamage) &&
    !Number.isFinite(event.flatStrikeBase) &&
    !Number.isFinite(event.flatStrikePowerCoeff) &&
    hasTrait(context.config, traitId) &&
    (traitId !== TRAIT.NO_QUARTER || hadFury)
  );
}

function extendActiveFury(context: ThiefResolverContext, event: ThiefResolverEvent, duration: number): void {
  // Extend Fury only while its canonical half-open window is active at the hit time.
  if (
    remainingDurationStackSeconds(context.boons.get('fury') || [], event.at, {
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
/** Selects observed candidates and applies the local reaction using canonical impact facts. */
export const thiefCriticalBoonReaction = eventReaction<ThiefSchedulerContext, ThiefSimulationEvent>({
  id: 'thief.critical-boons',
  order: 30,
  missingEvent: 'skip',
  select(context, event) {
    if (!CRITICAL_BOONS.some(({ traitId }) => criticalBoonEligible(context, event, traitId, true))) return null;
    return {
      at: event.at,
      priority: -60,
      payload: { eventOrder: Number(event.eventOrder) }
    };
  },
  execute(context, event) {
    if (missesTarget(event)) return;
    const state = professionCoreState(context);
    // Snapshot before Unrelenting Strikes emits Fury: the current hit cannot use its own newly granted boon.
    const hadFury =
      (context.schedulerPolicy as Gw2SchedulerPolicy).critical(context as unknown as SchedulerContext, event)
        .furyActive === true;
    for (const { traitId } of CRITICAL_BOONS) {
      if (!criticalBoonEligible(context, event, traitId, hadFury)) continue;
      const { id, name, boon, duration, stacks, internalCooldown } = criticalBoonDefinition(context, traitId);
      const tracker = {
        progress: Number(state.traitProcProgress[traitId] || 0),
        readyAt: Number(state.traitProcReadyAt[traitId] || 0)
      };
      const proc = advanceScheduledCriticalProc(context, event, { id, internalCooldown }, tracker);
      state.traitProcProgress[traitId] = tracker.progress;
      state.traitProcReadyAt[traitId] = tracker.readyAt;
      if (!proc) continue;
      context.emitDerived(event, {
        type: traitId === TRAIT.NO_QUARTER ? 'boon_extension' : 'buff',
        at: event.at,
        source: 'Trait',
        sourceId: traitId,
        actorType: 'effect',
        skillId: traitId,
        skillName: name,
        kind: boon.toLowerCase(),
        schedulerBoonPrediction: true,
        duration:
          traitId === TRAIT.NO_QUARTER
            ? duration
            : gw2SchedulerBoonDuration(context, { id: traitId, name }, boon, duration),
        stacks,
        audience: { recipients: traitId === TRAIT.NO_QUARTER ? 'self' : 'party' }
      });
    }
  }
});

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
    criticalBoonEligible(context, event, TRAIT.UNRELENTING_STRIKES, details.hitContext?.critical?.furyActive === true),
  expectedProgress: {
    get: (context: ThiefResolverContext) => traitCriticalProgress(context, TRAIT.UNRELENTING_STRIKES),
    set: (context: ThiefResolverContext, value: number) =>
      setTraitCriticalProgress(context, TRAIT.UNRELENTING_STRIKES, value)
  },
  internalCooldown: {
    duration: (context: ThiefResolverContext) =>
      criticalBoonDefinition(context, TRAIT.UNRELENTING_STRIKES).internalCooldown,
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
    const { boon, duration, stacks } = criticalBoonDefinition(context, TRAIT.UNRELENTING_STRIKES);
    for (let proc = 0; proc < application.quantity; proc += 1) {
      queueResolverBoon(
        context,
        event,
        buildResolverBuff({
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
        })
      );
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
    criticalBoonEligible(context, event, TRAIT.NO_QUARTER, details.hitContext?.critical?.furyActive === true),
  expectedProgress: {
    get: (context: ThiefResolverContext) => traitCriticalProgress(context, TRAIT.NO_QUARTER),
    set: (context: ThiefResolverContext, value: number) => setTraitCriticalProgress(context, TRAIT.NO_QUARTER, value)
  },
  internalCooldown: {
    duration: (context: ThiefResolverContext) => criticalBoonDefinition(context, TRAIT.NO_QUARTER).internalCooldown,
    readyAt: (context: ThiefResolverContext) =>
      Number(professionCoreState(context).traitProcReadyAt[TRAIT.NO_QUARTER] || 0),
    setReadyAt: (context: ThiefResolverContext, readyAt: number) => {
      professionCoreState(context).traitProcReadyAt[TRAIT.NO_QUARTER] = readyAt;
    }
  },
  attribution: { kind: 'trait' as const, id: TRAIT.NO_QUARTER },
  handler: (context, event, _details, application) => {
    // Reuse authored duration within this batch while extending the live pool for each proc.
    const { duration } = criticalBoonDefinition(context, TRAIT.NO_QUARTER);
    for (let proc = 0; proc < application.quantity; proc += 1) {
      extendActiveFury(context, event, duration);
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
  // Claim this owner's ICD before effects or resource snapshots can re-enter the trait.
  if (
    !tryConsumeProcCooldown(
      state.traitProcReadyAt,
      TRAIT.ASSASSINS_FURY,
      event.at,
      Number(profile?.internalCooldown ?? 2)
    )
  )
    return;
  // Keep the self boon attributed to this trait while shared queueing applies live duration scaling.
  const boon = String(might?.boon || 'Might');
  queueResolverBoon(
    context,
    event,
    buildResolverBuff({
      at: event.at,
      source: 'Trait',
      sourceId: TRAIT.ASSASSINS_FURY,
      actorType: 'effect',
      skillId: TRAIT.ASSASSINS_FURY,
      skillName: "Assassin's Fury",
      name: `Assassin's Fury - ${boon}`,
      kind: boon.toLowerCase(),
      duration: Number(might?.duration ?? 8),
      stacks: Number(might?.stacks ?? 3),
      audience: { recipients: 'self' },
      triggeredBy: event.skillName
    })
  );
}
