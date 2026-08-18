/** Renegade runtime state machines backed by declarative skill profiles. */
import { materializeSkillEffectApplications } from '../../../../platform/engine/effect-materializer.js';
import { professionCoreState } from '../../../../platform/engine/profession.js';
import { gw2AlliedPlayerAssumptions, gw2AlliedPlayerProcTimeline } from '../../../../platform/gw2/allied-players.js';
import { emitRevenantState } from '../../core/shared.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import { hasRevenantTrait } from '../../core/state.js';
import { renegadeState } from './state.js';
import { RENEGADE_ENHANCED_SKILL_BY_ID, RENEGADE_PROFILE_IDS } from './skills.js';
import type {
  BalanceProfile,
  SimulationEvent,
  Skill,
  SkillEffect,
  SkillId
} from '../../../../platform/engine/types.js';
import type {
  RenegadeState,
  RevenantCastContext,
  RevenantSchedulerContext,
  RevenantSimulationEvent,
  RevenantSkill
} from '../../types.js';

export interface BandTogetherState {
  readonly enhanced: boolean;
  readonly profileSkillId: SkillId;
}

function hasTrait(context: RevenantSchedulerContext, traitId: SkillId): boolean {
  return hasRevenantTrait(context.config, traitId);
}

function skillById(context: RevenantSchedulerContext, skillId: SkillId): RevenantSkill | undefined {
  return context.catalog.skillsById.get(skillId);
}

function balanceProfileById(context: RevenantSchedulerContext, profileId: SkillId): BalanceProfile | undefined {
  return context.catalog.balanceProfilesById.get(profileId);
}

function effectByType(
  skill: RevenantSkill | BalanceProfile | undefined,
  type: SkillEffect['type']
): SkillEffect | undefined {
  return skill?.effects?.find((effect) => effect.type === type);
}

function kallasFervorProfile(context: RevenantSchedulerContext): BalanceProfile | undefined {
  return balanceProfileById(
    context,
    hasTrait(context, TRAIT.LASTING_LEGACY)
      ? RENEGADE_PROFILE_IDS.kallasFervorLastingLegacy
      : RENEGADE_PROFILE_IDS.kallasFervor
  );
}

function emitProfileEffects(
  context: RevenantCastContext,
  eventSkill: RevenantSkill | BalanceProfile,
  profileSkill: RevenantSkill | BalanceProfile,
  effects: readonly SkillEffect[] = profileSkill.effects || []
): void {
  for (const effect of effects) {
    const baseDuration =
      effect.type === 'boon' || effect.type === 'buff' ? Math.max(0, Number(effect.duration || 0)) : undefined;
    const statusDuration =
      baseDuration == null
        ? undefined
        : (context.schedulerPolicy.effectDuration?.(context, eventSkill as Skill, effect, baseDuration) ??
          baseDuration);
    const applications = materializeSkillEffectApplications({
      skill: profileSkill as BalanceProfile & Skill,
      effect,
      start: context.start,
      fullEnd: context.effectiveEnd,
      baseEvent: {
        source: 'revenant',
        sourceId: eventSkill.id,
        actorType: effect.actorType || 'player',
        skillId: eventSkill.id,
        skillName: eventSkill.name
      },
      skillWeaponFallback: 'Unequipped',
      statusDuration
    });
    for (const application of applications) {
      const emitted = context.emit(application.event);
      if (eventSkill.id === ID.RAZORCLAWS_RAGE && emitted.type === 'buff' && emitted.kind === 'razorclaws-rage') {
        context.replaceEvent(emitted, {
          recipientCount: gw2AlliedPlayerAssumptions(context.config).count + 1
        });
      }
    }
  }
}

/** Returns whether the one-use Band Together enhancement is active at `at`. */
export function isBandTogetherReady(state: Partial<RenegadeState>, at: number): boolean {
  return Boolean(state.bandTogetherReady) && Number(state.bandTogetherExpiresAt || 0) > at;
}

function enhancedSkill(context: RevenantSchedulerContext, skill: RevenantSkill): RevenantSkill | undefined {
  const enhancedId = RENEGADE_ENHANCED_SKILL_BY_ID[Number(skill.id)];
  return enhancedId == null ? undefined : skillById(context, enhancedId);
}

function replacesBandTogetherEffects(context: RevenantCastContext, skill: RevenantSkill): boolean {
  return isBandTogetherReady(renegadeState.from(context), context.start) && enhancedSkill(context, skill) != null;
}

/** Counts unexpired Kalla's Fervor applications. */
export function activeKallasFervorStacks(
  state: RenegadeState,
  at: number,
  maximumStacks = state.kallasFervorMaximumStacks
): number {
  return Math.min(
    Math.max(1, Number(maximumStacks)),
    (state.kallasFervor || []).filter(
      (application) => Number(application.at || 0) <= at && Number(application.expiresAt || 0) > at
    ).length
  );
}

function pruneKallasFervor(state: RenegadeState, at: number): void {
  state.kallasFervor = (state.kallasFervor || []).filter((application) => Number(application.expiresAt || 0) > at);
}

/** Adds one Kalla's Fervor application and emits its causal state. */
export function grantKallasFervor(
  context: RevenantSchedulerContext,
  cause: SimulationEvent,
  {
    at = cause.at,
    sourceId = cause.sourceId,
    sourceName = cause.skillName || cause.name || "Kalla's Fervor"
  }: {
    at?: number;
    sourceId?: SkillId;
    sourceName?: string;
  } = {}
): boolean {
  const state = renegadeState.from(context);
  const profile = kallasFervorProfile(context);
  const effect = effectByType(profile, 'buff');
  if (!profile || !effect) return false;
  const maximumStacks = Math.max(1, Number(profile.maximumStacks || 1));
  state.kallasFervorMaximumStacks = maximumStacks;
  pruneKallasFervor(state, at);
  if (activeKallasFervorStacks(state, at, maximumStacks) >= maximumStacks) {
    return false;
  }
  const duration = Math.max(0, Number(effect.duration || 0));
  state.kallasFervor.push({ at, expiresAt: at + duration });
  context.emitDerived(cause, {
    type: 'buff',
    at,
    source: 'revenant',
    sourceId,
    actorType: effect.actorType || 'player',
    skillId: sourceId,
    skillName: sourceName,
    name: `${sourceName} — Kalla's Fervor`,
    kind: String(effect.kind || 'kallas-fervor'),
    duration,
    stacks: Number(effect.stacks || 1)
  });
  emitRevenantState(context, at, 'kallas-fervor');
  return true;
}

function refreshKallasFervor(context: RevenantSchedulerContext, at: number): number {
  const state = renegadeState.from(context);
  const profile = kallasFervorProfile(context);
  const effect = effectByType(profile, 'buff');
  if (!profile || !effect) return 0;
  state.kallasFervorMaximumStacks = Math.max(1, Number(profile.maximumStacks || 1));
  pruneKallasFervor(state, at);
  const duration = Math.max(0, Number(effect.duration || 0));
  for (const application of state.kallasFervor) {
    if (Number(application.at || 0) <= at) {
      application.expiresAt = at + duration;
    }
  }
  if (state.kallasFervor.length) {
    emitRevenantState(context, at, 'kallas-fervor-refreshed');
  }
  return activeKallasFervorStacks(state, at, Math.max(1, Number(profile.maximumStacks || 1)));
}

/** Refreshes current Fervor and materializes Heroic Command's selected profile. */
export function castHeroicCommand(context: RevenantCastContext, skill: RevenantSkill): void {
  if (context.effectiveEnd < context.fullEnd - context.epsilon) return;
  const stacks = refreshKallasFervor(context, context.effectiveEnd);
  if (!stacks) return;
  const profile = hasTrait(context, TRAIT.LASTING_LEGACY)
    ? balanceProfileById(context, RENEGADE_PROFILE_IDS.heroicCommandLastingLegacy)
    : skill;
  const effect = effectByType(profile, 'boon');
  if (!profile || !effect) return;
  emitProfileEffects(context, skill, profile, [
    { ...effect, stacks: Math.max(1, Number(effect.stacks || 1)) * stacks }
  ]);
}

/** Materializes the normal or Righteous Rebel Orders from Above profile. */
export function castOrdersFromAbove(context: RevenantCastContext, skill: RevenantSkill): void {
  const profile = hasTrait(context, TRAIT.RIGHTEOUS_REBEL)
    ? balanceProfileById(context, RENEGADE_PROFILE_IDS.ordersFromAboveRighteousRebel)
    : skill;
  if (profile) emitProfileEffects(context, skill, profile);
}

/** Consumes Band Together and materializes the selected enhanced profile. */
export function beginBandTogether(context: RevenantCastContext, skill: RevenantSkill): BandTogetherState {
  const state = renegadeState.from(context);
  const enhanced = isBandTogetherReady(state, context.start);
  const profile = enhanced ? enhancedSkill(context, skill) : undefined;
  state.bandTogetherReady = false;
  state.bandTogetherExpiresAt = 0;
  if (enhanced && hasTrait(context, TRAIT.ALL_FOR_ONE)) {
    const allForOne = balanceProfileById(context, RENEGADE_PROFILE_IDS.allForOne);
    const core = professionCoreState(context);
    core.energy = Math.min(core.maximumEnergy, core.energy + Math.max(0, Number(allForOne?.resourceGain || 0)));
    emitRevenantState(context, context.start, 'all-for-one');
  }
  if (profile) emitProfileEffects(context, skill, profile);
  return { enhanced, profileSkillId: profile?.id || skill.id };
}

/** Adds dynamic recipient information to the declarative Razorclaw buff. */
export function observeBandTogetherEffect(
  context: RevenantCastContext,
  skill: RevenantSkill,
  event: RevenantSimulationEvent
): void {
  if (skill.id === ID.RAZORCLAWS_RAGE && event.type === 'buff' && event.kind === 'razorclaws-rage') {
    context.replaceEvent(event, {
      recipientCount: gw2AlliedPlayerAssumptions(context.config).count + 1
    });
  }
}

function grantRazorclawsRage(context: RevenantCastContext, skill: RevenantSkill, profile: RevenantSkill): void {
  const buff = profile.effects?.find((effect) => effect.type === 'buff' && effect.kind === 'razorclaws-rage');
  const proc = skillById(context, RENEGADE_PROFILE_IDS.razorclawsRageProc);
  const bleed = effectByType(proc, 'condition');
  if (!buff || !proc || !bleed) return;
  const at = context.effectiveEnd;
  const duration = Math.max(0, Number(buff.duration || 0));
  const charges = Math.max(0, Math.trunc(Number(buff.stacks || 0)));
  renegadeState.from(context).razorclawsRage = {
    charges,
    expiresAt: at + duration,
    readyAt: at
  };
  const alliedProcs = gw2AlliedPlayerProcTimeline(context.config, {
    start: at,
    duration,
    maximumPerAlly: charges,
    internalCooldown: Math.max(0, Number(proc.cooldown || 0))
  });
  for (const alliedProc of alliedProcs) {
    context.emit({
      type: 'condition',
      at: alliedProc.at,
      source: 'revenant',
      sourceId: skill.id,
      actorType: bleed.actorType || 'player',
      skillId: skill.id,
      skillName: skill.name,
      name: `${skill.name} — Ally ${alliedProc.allyIndex} Bleeding`,
      condition: String(bleed.condition || ''),
      stacks: Number(bleed.stacks || 0),
      duration: Number(bleed.duration || 0),
      triggeredByAlly: alliedProc.allyIndex
    });
  }
}

/** Commits summon state after its declarative effects have been emitted. */
export function completeBandTogether(
  context: RevenantCastContext,
  skill: RevenantSkill,
  state: BandTogetherState
): void {
  const profile = skillById(context, state.profileSkillId) || skill;
  if (skill.id === ID.RAZORCLAWS_RAGE) {
    grantRazorclawsRage(context, skill, profile);
  }
  if (state.enhanced) return;
  const bandTogether = balanceProfileById(context, RENEGADE_PROFILE_IDS.bandTogether);
  const effect = effectByType(bandTogether, 'buff');
  if (!bandTogether || !effect) return;
  const profession = renegadeState.from(context);
  profession.bandTogetherReady = true;
  profession.bandTogetherExpiresAt = context.effectiveEnd + Math.max(0, Number(effect.duration || 0));
  emitProfileEffects(context, bandTogether, bandTogether);
  emitRevenantState(context, context.effectiveEnd, 'band-together');
}

/** Raw Renegade callbacks consumed by the module handler registry. */
export const revenantAssassinRenegadeSkillHandlers = Object.freeze({
  'revenant.heroic-command': castHeroicCommand,
  'revenant.orders-from-above': castOrdersFromAbove,
  'revenant.band-together': Object.freeze({
    beforeEffects: beginBandTogether,
    replacesEffects: replacesBandTogetherEffects,
    afterEffect: observeBandTogetherEffect,
    afterEffects: completeBandTogether
  })
});
