import type { SimulationEvent } from '#gw2/platform/engine/events/events.js';
import { eventReaction } from '#gw2/platform/profession-definition/mechanics.js';
import {
  emitSkillBuff,
  emitSkillCondition,
  emitSkillControl
} from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { renegadeState } from '#gw2/professions/revenant/specializations/renegade/state.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { consumeCharge } from '#gw2/platform/combat/resources/charges.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { hasTrait } from '#gw2/platform/combat/state/traits.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { tryConsumeProcCooldown } from '#gw2/platform/combat/procs.js';
import { professionCoreState } from '#gw2/platform/engine/profession/state.js';
import {
  grantKallasFervor,
  isBandTogetherReady
} from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import { RENEGADE_PROFILE_IDS } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { advanceScheduledCriticalProc } from '#gw2/platform/execution/gw2-policy/critical-facts.js';
import { gw2SchedulerBoonDuration } from '#gw2/platform/execution/gw2-policy/policy.js';
import type {
  RevenantCastContext,
  RevenantPrecastContext,
  RevenantRechargeContext,
  RevenantSchedulerContext,
  RevenantSkill
} from '#gw2/professions/revenant/types.js';

export const RENEGADE_CRITICAL_TRAITS_TASK = 'revenant.renegade-critical-traits';
export const RENEGADE_RAZORCLAW_PROC_TASK = 'revenant.razorclaw-proc';

function criticalCount(context: RevenantSchedulerContext, event: SimulationEvent): number {
  const state = renegadeState.from(context);
  const tracker = { progress: Number(state.renegadeCriticalProgress || 0), readyAt: 0 };
  const application = advanceScheduledCriticalProc(
    context,
    event,
    { id: 'revenant.renegade.critical-traits' },
    tracker
  );
  state.renegadeCriticalProgress = tracker.progress;
  return application?.quantity || 0;
}

function applyCriticalTraits(context: RevenantSchedulerContext, event: SimulationEvent): void {
  const ambush = hasTrait(context.config, TRAIT.AMBUSH_COMMANDER);
  const enmity = hasTrait(context.config, TRAIT.ENDLESS_ENMITY);
  if (!ambush && !enmity) return;
  const criticals = criticalCount(context, event);
  // Ambush Commander procs on any positional advantage OR any crit; both paths share the same grant.
  // Defiant is the positional proxy (a defiant golem never rotates, so flanking/behind always apply).
  const positionalTrigger = Boolean(context.config.target?.defiant);
  if (ambush && (positionalTrigger || criticals > 0)) {
    grantKallasFervor(context, event, {
      sourceId: TRAIT.AMBUSH_COMMANDER,
      sourceName: 'Ambush Commander'
    });
  }

  const state = renegadeState.from(context);
  if (!enmity || criticals <= 0 || !isInternalCooldownReady(event.at, Number(state.endlessEnmityReadyAt || 0))) {
    return;
  }

  const profile = context.catalog.balanceProfilesById.get(RENEGADE_PROFILE_IDS.endlessEnmity);
  const effect = profile?.effects?.find((candidate) => candidate.type === 'boon');
  if (!profile || !effect) return;
  const sourceSkill = { id: TRAIT.ENDLESS_ENMITY, name: 'Endless Enmity' } as RevenantSkill;
  state.endlessEnmityReadyAt = event.at + Math.max(0, Number(profile.cooldown || 0));
  emitSkillBuff(context, {
    cause: event,

    at: event.at,
    source: 'revenant',
    sourceId: TRAIT.ENDLESS_ENMITY,
    actorType: 'player',
    skillId: TRAIT.ENDLESS_ENMITY,
    skillName: 'Endless Enmity',
    name: 'Endless Enmity — fury',
    kind: 'fury',
    duration: gw2SchedulerBoonDuration(
      context,
      sourceSkill,
      String(effect.boon || effect.kind || 'fury'),
      Number(effect.duration || 0)
    ),
    stacks: Number(effect.stacks ?? 1),
    audience: effect.audience ?? { recipients: 'party', maximumRecipients: 5 }
  });
}

function applyVindication(context: RevenantSchedulerContext, event: SimulationEvent): void {
  if (
    event.skillId !== ID.CITADEL_BOMBARDMENT ||
    // Citadel Bombardment is multi-hit; Vindication daze fires only on the first impact
    Number(event.hitIndex || 1) !== 1 ||
    !hasTrait(context.config, TRAIT.VINDICATION)
  ) {
    return;
  }

  const profile = context.catalog.balanceProfilesById.get(RENEGADE_PROFILE_IDS.vindication);
  const effect = profile?.effects?.find((candidate) => candidate.type === 'control');
  if (!profile || !effect) return;
  emitSkillControl(context, {
    cause: event,

    at: event.at,
    source: 'revenant',
    sourceId: TRAIT.VINDICATION,
    actorType: 'player',
    skillId: TRAIT.VINDICATION,
    skillName: 'Vindication',
    name: 'Vindication — Daze',
    metadata: effect.metadata,
    controlKind: String(effect.controlKind || 'daze')
  });
}

export function initializeRenegadeTraits(context: RevenantSchedulerContext): void {
  const fervorProfile = context.catalog.balanceProfilesById.get(
    hasTrait(context.config, TRAIT.LASTING_LEGACY)
      ? RENEGADE_PROFILE_IDS.kallasFervorLastingLegacy
      : RENEGADE_PROFILE_IDS.kallasFervor
  );
  renegadeState.from(context).kallasFervorMaximumStacks = Math.max(1, Number(fervorProfile?.maximumStacks ?? 1));
  if (hasTrait(context.config, TRAIT.AMBUSH_COMMANDER) || hasTrait(context.config, TRAIT.ENDLESS_ENMITY)) {
    // Tells the materializer to sample and record didCrit on every damage event so that the deferred critical-traits task can read a concrete boolean in stochastic mode
    context.schedulerPolicy.requireCriticalFacts?.();
  }
}

export const renegadeCriticalReaction = eventReaction<RevenantSchedulerContext, SimulationEvent>({
  id: RENEGADE_CRITICAL_TRAITS_TASK,
  missingEvent: 'error',
  select(context, event) {
    if (!(hasTrait(context.config, TRAIT.AMBUSH_COMMANDER) || hasTrait(context.config, TRAIT.ENDLESS_ENMITY)))
      return null;
    return {
      at: Math.max(context.state.time, event.at),
      priority: -40,
      payload: { eventOrder: Number(event.eventOrder) }
    };
  },
  execute: applyCriticalTraits
});

function applyRazorclawProc(context: RevenantSchedulerContext, event: SimulationEvent): void {
  const razorclaw = renegadeState.from(context).razorclawsRage;
  // Keep activation and same-timestamp gating even when the profile has zero ICD.
  if (!isInternalCooldownReady(event.at, razorclaw.readyAt)) return;

  const profile = context.catalog.skillsById.get(RENEGADE_PROFILE_IDS.razorclawsRageProc);
  const effect = profile?.effects?.find((candidate) => candidate.type === 'condition');
  if (!profile || !effect) return;
  const cooldown = Math.max(0, Number(profile.cooldown || 0));
  if (!consumeCharge(razorclaw, event.at, cooldown)) return;
  if (cooldown === 0) razorclaw.readyAt = event.at;
  emitSkillCondition(context, {
    cause: event,
    at: event.at,
    skillId: ID.RAZORCLAWS_RAGE,
    skillName: "Razorclaw's Rage",
    name: "Razorclaw's Rage — Bleeding",
    condition: String(effect.condition || 'Bleeding'),
    stacks: Number(effect.stacks ?? 1),
    duration: Number(effect.duration || 0)
  });
}

/** Resolves a hit-triggered Razorclaw charge when the scheduler reaches the hit timestamp. */
export const razorclawReaction = eventReaction<RevenantSchedulerContext, SimulationEvent>({
  id: RENEGADE_RAZORCLAW_PROC_TASK,
  missingEvent: 'error',
  select(context, event) {
    if (!(event.skillId !== ID.RAZORCLAWS_RAGE)) return null;
    return {
      at: Math.max(context.state.time, event.at),
      id: `${RENEGADE_RAZORCLAW_PROC_TASK}:${event.eventOrder}`,
      payload: { eventOrder: Number(event.eventOrder) }
    };
  },
  execute: applyRazorclawProc
});

export function modifyRenegadeCastDuration(context: RevenantPrecastContext, duration: number): number {
  // Empowered Band Together is instant-cast (0 duration) so no animation lane is reserved; normal summons keep their full cast time
  return context.skill?.handlerId === 'revenant.band-together' &&
    isBandTogetherReady(renegadeState.from(context), context.start)
    ? 0
    : duration;
}

export function modifyRenegadeRechargeDuration(context: RevenantRechargeContext, duration: number): number {
  // Cast preparation queries recharge while Band Together is still ready; beforeEffects consumes the window afterward.
  const allForOne = context.catalog.balanceProfilesById.get(RENEGADE_PROFILE_IDS.allForOne);
  return context.skill?.handlerId === 'revenant.band-together' &&
    isBandTogetherReady(
      renegadeState.from(context),
      // context.start is preferred; context.at is the fallback for recharge-only contexts
      Number(context.start ?? context.at)
    ) &&
    hasTrait(context.config, TRAIT.ALL_FOR_ONE)
    ? duration * Math.max(0, Number(allForOne?.rechargeMultiplier ?? 1))
    : duration;
}

/** Grants Ashen Demeanor's self boons and Fervor once per healing-skill ICD. */
export function applyAshenDemeanor(context: RevenantCastContext, skill: RevenantSkill): void {
  if (skill.slot !== 'Heal' || !hasTrait(context.config, TRAIT.ASHEN_DEMEANOR)) return;
  const profile = context.catalog.balanceProfilesById.get(RENEGADE_PROFILE_IDS.ashenDemeanor);
  if (
    !profile ||
    !tryConsumeProcCooldown(
      professionCoreState(context).traitProcReadyAt,
      'ashenDemeanor',
      context.effectiveEnd,
      Number(profile.cooldown || 0)
    )
  ) {
    return;
  }

  for (let stack = 0; stack < Math.max(0, Number(profile.fervorStacks || 0)); stack += 1) {
    grantKallasFervor(context, context.action, {
      at: context.effectiveEnd,
      sourceId: TRAIT.ASHEN_DEMEANOR,
      sourceName: profile.name
    });
  }

  for (const effect of profile.effects?.filter((candidate) => candidate.type === 'boon') || []) {
    emitSkillBuff(context, profile as RevenantSkill, {
      cause: context.action,
      at: context.effectiveEnd,
      sourceId: TRAIT.ASHEN_DEMEANOR,
      skillId: TRAIT.ASHEN_DEMEANOR,
      skillName: profile.name,
      name: `${profile.name} — ${String(effect.boon)}`,
      kind: String(effect.boon),
      duration: Number(effect.duration),
      stacks: Number(effect.stacks ?? 1),
      audience: effect.audience ?? { recipients: 'self' }
    });
  }
}

export function observeRenegadeTraits(context: RevenantSchedulerContext, event: SimulationEvent): void {
  const state = renegadeState.from(context);
  // Brutal Momentum reacts to received Fury from any source, including outside combat, but never ally-only grants.
  if (
    event.type === 'buff' &&
    event.kind === 'fury' &&
    hasTrait(context, TRAIT.BRUTAL_MOMENTUM) &&
    gw2BoonApplicationRecipients(context.config, event).includesSelf &&
    isInternalCooldownReady(event.at, state.brutalMomentumReadyAt)
  ) {
    const profile = context.catalog.balanceProfilesById.get(RENEGADE_PROFILE_IDS.brutalMomentum);
    const effect = profile?.effects?.find((candidate) => candidate.type === 'boon');
    if (profile && effect) {
      state.brutalMomentumReadyAt = event.at + Math.max(0, Number(profile.cooldown || 0));
      emitSkillBuff(context, profile as RevenantSkill, {
        cause: event,
        sourceId: TRAIT.BRUTAL_MOMENTUM,
        at: event.at,
        kind: String(effect.boon),
        duration: Number(effect.duration),
        stacks: Number(effect.stacks)
      });
    }
  }

  if (
    event.type === 'buff' &&
    String(event.kind || '').toLowerCase() === 'fury' &&
    hasTrait(context.config, TRAIT.BLOOD_FURY) &&
    isInternalCooldownReady(event.at, Number(state.bloodFuryReadyAt || 0))
  ) {
    const profile = context.catalog.balanceProfilesById.get(RENEGADE_PROFILE_IDS.bloodFury);
    state.bloodFuryReadyAt = event.at + Math.max(0, Number(profile?.cooldown || 0));
    grantKallasFervor(context, event, {
      sourceId: TRAIT.BLOOD_FURY,
      sourceName: 'Blood Fury'
    });
  }

  if (event.type === 'damage') {
    applyVindication(context, event);
  }

  if (event.type !== 'damage' || event.actorType !== 'player' || Number(event.coefficient || 0) <= 0) {
    return;
  }

  renegadeCriticalReaction.onEventScheduled.handler(context, event);
  razorclawReaction.onEventScheduled.handler(context, event);
}
