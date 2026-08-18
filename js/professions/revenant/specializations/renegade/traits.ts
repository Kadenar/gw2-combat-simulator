import { renegadeState } from './state.js';
import { professionCoreState } from '../../../../platform/engine/profession.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { hasRevenantTrait } from '../../core/state.js';
import { activeKallasFervorStacks, grantKallasFervor, isBandTogetherReady } from './renegade.js';
import { RENEGADE_PROFILE_IDS } from './skills.js';
import type {
  RevenantPrecastContext,
  RevenantRechargeContext,
  RevenantScheduledTask,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill
} from '../../types.js';

export const RENEGADE_CRITICAL_TRAITS_TASK = 'revenant.renegade-critical-traits';

function scaledBoonDuration(context: RevenantSchedulerContext, boon: string, duration: number): number {
  // Trait-triggered boons have no cast skill, so identify Endless Enmity explicitly
  // when applying shared boon-duration rules.
  const skill = {
    id: TRAIT.ENDLESS_ENMITY,
    name: 'Endless Enmity'
  } as RevenantSkill;
  return (
    context.schedulerPolicy.effectDuration?.(context, skill, { type: 'boon', boon, duration }, duration) ?? duration
  );
}

function criticalCount(context: RevenantSchedulerContext, event: RevenantSimulationEvent): number {
  if (context.config.randomness?.mode === 'stochastic') {
    // In stochastic mode the crit outcome was sampled earlier and stored on the event; requireCriticalFacts() guarantees didCrit is present for every tracked hit
    if (typeof event.didCrit !== 'boolean') {
      throw new Error(
        `Missing sampled critical outcome for Renegade event ${String(
          event.skillName || event.name || event.sourceId
        )}.`
      );
    }
    return event.didCrit ? 1 : 0;
  }
  // Deterministic mode: accumulate fractional crit probability across events so that the expected number of procs over the full simulation equals (sum of crit chances)
  const state = renegadeState.from(context);
  const chance = Number(context.schedulerPolicy.critical?.(context, event)?.chance || 0);
  state.renegadeCriticalProgress = Number(state.renegadeCriticalProgress || 0) + chance;
  // 1e-9 tolerance prevents floating-point drift from suppressing procs at exactly 1.0
  const count = Math.floor(state.renegadeCriticalProgress + 1e-9);
  if (count > 0) state.renegadeCriticalProgress -= count;
  return count;
}

function applyCriticalTraits(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  const ambush = hasRevenantTrait(context.config, TRAIT.AMBUSH_COMMANDER);
  const enmity = hasRevenantTrait(context.config, TRAIT.ENDLESS_ENMITY);
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
  const state = professionCoreState(context);
  if (!enmity || criticals <= 0 || event.at + context.epsilon < Number(state.traitProcReadyAt.endlessEnmity || 0)) {
    return;
  }
  const profile = context.catalog.balanceProfilesById.get(RENEGADE_PROFILE_IDS.endlessEnmity);
  const effect = profile?.effects?.find((candidate) => candidate.type === 'boon');
  if (!profile || !effect) return;
  state.traitProcReadyAt.endlessEnmity = event.at + Math.max(0, Number(profile.cooldown || 0));
  context.emitDerived(event, {
    type: 'buff',
    at: event.at,
    source: 'revenant',
    sourceId: TRAIT.ENDLESS_ENMITY,
    actorType: 'player',
    skillId: TRAIT.ENDLESS_ENMITY,
    skillName: 'Endless Enmity',
    name: 'Endless Enmity — fury',
    kind: 'fury',
    duration: scaledBoonDuration(context, String(effect.boon || effect.kind || 'fury'), Number(effect.duration || 0)),
    stacks: Number(effect.stacks || 1),
    recipients: effect.recipients || 'party'
  });
}

function applyVindication(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  if (
    event.skillId !== ID.CITADEL_BOMBARDMENT ||
    // Citadel Bombardment is multi-hit; Vindication daze fires only on the first impact
    Number(event.hitIndex || 1) !== 1 ||
    !hasRevenantTrait(context.config, TRAIT.VINDICATION)
  ) {
    return;
  }
  const profile = context.catalog.balanceProfilesById.get(RENEGADE_PROFILE_IDS.vindication);
  const effect = profile?.effects?.find((candidate) => candidate.type === 'control');
  if (!profile || !effect) return;
  const duration = Number(effect.duration || effect.metadata?.duration || 0);
  context.emitDerived(event, {
    type: 'control',
    at: event.at,
    source: 'revenant',
    sourceId: TRAIT.VINDICATION,
    actorType: 'player',
    skillId: TRAIT.VINDICATION,
    skillName: 'Vindication',
    name: 'Vindication — Daze',
    ...(effect.metadata || {}),
    controlKind: effect.metadata?.controlKind || 'daze',
    duration,
    breakbar: Number(effect.metadata?.breakbar ?? duration * 100)
  });
}

function applyKallasFervorLifeSiphon(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  // Only flat-strike events carry the life-siphon formula; coefficient-only hits are not siphons
  if (!Number.isFinite(Number(event.flatStrikeBase)) && !Number.isFinite(Number(event.flatStrikePowerCoeff))) {
    return;
  }
  // Name-based guard distinguishes Soulcleave's life-siphon packet from other flat-strike effects
  if (!/siphon/i.test(`${event.name || ''} ${event.skillName || ''}`)) return;
  const stacks = activeKallasFervorStacks(renegadeState.from(context), event.at);
  if (!stacks) return;
  const profile = context.catalog.balanceProfilesById.get(
    hasRevenantTrait(context.config, TRAIT.LASTING_LEGACY)
      ? RENEGADE_PROFILE_IDS.kallasFervorLastingLegacy
      : RENEGADE_PROFILE_IDS.kallasFervor
  );
  const perStack = Number(profile?.lifeSiphonDamagePerStack || 0);
  context.replaceEvent(event, {
    flatStrikeMultiplier: Number(event.flatStrikeMultiplier ?? 1) * (1 + stacks * perStack)
  });
}

export function initializeRenegadeTraits(context: RevenantSchedulerContext): void {
  const fervorProfile = context.catalog.balanceProfilesById.get(
    hasRevenantTrait(context.config, TRAIT.LASTING_LEGACY)
      ? RENEGADE_PROFILE_IDS.kallasFervorLastingLegacy
      : RENEGADE_PROFILE_IDS.kallasFervor
  );
  renegadeState.from(context).kallasFervorMaximumStacks = Math.max(1, Number(fervorProfile?.maximumStacks || 1));
  if (
    hasRevenantTrait(context.config, TRAIT.AMBUSH_COMMANDER) ||
    hasRevenantTrait(context.config, TRAIT.ENDLESS_ENMITY)
  ) {
    // Tells the materializer to sample and record didCrit on every damage event so that the deferred critical-traits task can read a concrete boolean in stochastic mode
    context.schedulerPolicy.requireCriticalFacts?.();
  }
}

export function handleRenegadeCriticalTraitsTask(
  context: RevenantSchedulerContext,
  task: RevenantScheduledTask<{ readonly eventOrder: number }>
): void {
  const eventOrder = Number(task.payload?.eventOrder);
  const event = context.events.find((candidate) => candidate.__order === eventOrder) as
    RevenantSimulationEvent | undefined;
  if (!event) {
    throw new Error(`Missing Renegade critical event ${String(eventOrder)}.`);
  }
  applyCriticalTraits(context, event);
}

export function modifyRenegadeCastDuration(context: RevenantPrecastContext, duration: number): number {
  // Empowered Band Together is instant-cast (0 duration) so no animation lane is reserved; normal summons keep their full cast time
  return context.skill?.handlerId === 'revenant.band-together' &&
    isBandTogetherReady(renegadeState.from(context), context.start)
    ? 0
    : duration;
}

export function modifyRenegadeRechargeDuration(context: RevenantRechargeContext, duration: number): number {
  // All for One halves Band Together's recharge only when the empowered version was just used; checking the state here (before the window clears) is safe because the window was consumed in beforeEffects, which runs before the recharge hook fires
  const allForOne = context.catalog.balanceProfilesById.get(RENEGADE_PROFILE_IDS.allForOne);
  return context.skill?.handlerId === 'revenant.band-together' &&
    isBandTogetherReady(
      renegadeState.from(context),
      // context.start is preferred; context.at is the fallback for recharge-only contexts
      Number(context.start ?? context.at)
    ) &&
    hasRevenantTrait(context.config, TRAIT.ALL_FOR_ONE)
    ? duration * Math.max(0, Number(allForOne?.rechargeMultiplier ?? 1))
    : duration;
}

export function observeRenegadeTraits(context: RevenantSchedulerContext, event: RevenantSimulationEvent): void {
  const state = renegadeState.from(context);
  const coreState = professionCoreState(context);
  if (
    event.type === 'buff' &&
    String(event.kind || '').toLowerCase() === 'fury' &&
    hasRevenantTrait(context.config, TRAIT.BLOOD_FURY) &&
    event.at + context.epsilon >= Number(coreState.traitProcReadyAt.bloodFury || 0)
  ) {
    const profile = context.catalog.balanceProfilesById.get(RENEGADE_PROFILE_IDS.bloodFury);
    coreState.traitProcReadyAt.bloodFury = event.at + Math.max(0, Number(profile?.cooldown || 0));
    grantKallasFervor(context, event, {
      sourceId: TRAIT.BLOOD_FURY,
      sourceName: 'Blood Fury'
    });
  }
  if (event.type === 'damage') {
    applyVindication(context, event);
    applyKallasFervorLifeSiphon(context, event);
  }
  if (event.type !== 'damage' || event.actorType !== 'player' || Number(event.coefficient || 0) <= 0) {
    return;
  }
  const tracksCriticalTraits =
    hasRevenantTrait(context.config, TRAIT.AMBUSH_COMMANDER) || hasRevenantTrait(context.config, TRAIT.ENDLESS_ENMITY);
  if (tracksCriticalTraits) {
    if (context.config.randomness?.mode === 'stochastic') {
      // Shared critical materialization runs at priority -60. Resolve
      // Renegade's scheduler effects afterwards using that same hit fact.
      context.tasks.schedule({
        type: RENEGADE_CRITICAL_TRAITS_TASK,
        at: Math.max(context.state.time, event.at),
        // Priority -40 fires after priority -60 (lower = later), ensuring didCrit is populated first
        priority: -40,
        payload: { eventOrder: Number(event.__order) }
      });
    } else {
      applyCriticalTraits(context, event);
    }
  }
  const razorclaw = state.razorclawsRage;
  if (
    // Skip the Razorclaw's Rage hit itself to avoid infinite recursion
    event.skillId === ID.RAZORCLAWS_RAGE ||
    Number(razorclaw?.charges || 0) <= 0 ||
    event.at >= Number(razorclaw.expiresAt || 0) ||
    // readyAt enforces the 1-second internal cooldown between player-hit-triggered bleeds
    event.at + context.epsilon < Number(razorclaw.readyAt || 0)
  ) {
    return;
  }
  const profile = context.catalog.skillsById.get(RENEGADE_PROFILE_IDS.razorclawsRageProc);
  const effect = profile?.effects?.find((candidate) => candidate.type === 'condition');
  if (!profile || !effect) return;
  razorclaw.charges -= 1;
  razorclaw.readyAt = event.at + Math.max(0, Number(profile.cooldown || 0));
  context.emitDerived(event, {
    type: 'condition',
    at: event.at,
    source: 'revenant',
    sourceId: ID.RAZORCLAWS_RAGE,
    actorType: 'player',
    skillId: ID.RAZORCLAWS_RAGE,
    skillName: "Razorclaw's Rage",
    name: "Razorclaw's Rage — Bleeding",
    condition: String(effect.condition || 'Bleeding'),
    stacks: Number(effect.stacks || 1),
    duration: Number(effect.duration || 0)
  });
}
