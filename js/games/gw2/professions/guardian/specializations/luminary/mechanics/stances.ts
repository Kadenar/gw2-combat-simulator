import { EPSILON } from '#kernel/core/clock.js';
import { enqueueOrdered } from '#kernel/events/queue.js';
import { balanceProfileEffect, balanceProfileFromContext } from '#gw2/platform/combat/state/balance-profiles.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { emitSkillBuff } from '#gw2/platform/scheduler/skill-events.js';
import { buildGuardianStrike } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { GUARDIAN_SKILL_IDS } from '#gw2/professions/guardian/data/ids.js';
import { projectCastRelativeEffectTimingMs } from '#gw2/platform/skills/timing.js';
import { radiantWeaponImpactAt } from '#gw2/professions/guardian/specializations/luminary/mechanics/radiant-forge.js';
import { LUMINARY_INITIAL_STATE_SKILL_IDS } from '#gw2/professions/guardian/specializations/luminary/skills/radiant-forge-skills.js';
import { PIERCING_STANCE_IMPACT_MS } from '#gw2/professions/guardian/specializations/luminary/skills/stance-skills.js';
import { LUMINARY_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/guardian/specializations/luminary/profiles.js';
import { luminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';
import type {
  GuardianCastContext,
  GuardianResolverContext,
  GuardianResolverEvent,
  GuardianSkill
} from '#gw2/professions/guardian/types.js';

/** Applies cast-timed Luminary stance windows and schedules Effulgent resolution. */
export function processLuminaryStances(context: GuardianCastContext, skill: GuardianSkill): void {
  const state = luminaryState.from(context);
  if (skill.id === GUARDIAN_SKILL_IDS.PIERCING_STANCE) {
    const runtimeCastMs = Math.max(0, (context.fullEnd - context.start) * 1000);
    const at =
      context.start + projectCastRelativeEffectTimingMs(skill, runtimeCastMs, PIERCING_STANCE_IMPACT_MS) / 1000;
    if (at > context.effectiveEnd + context.epsilon) return;
    const wasActive = Number(state.piercingStanceUntil || 0) > at + context.epsilon;
    state.piercingStanceUntil = wasActive ? state.piercingStanceUntil + 8 : at + 8;
    emitSkillBuff(context, skill, {
      at,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      kind: 'guardian-piercing-stance',
      duration: state.piercingStanceUntil - at,
      stacks: 1
    });
  } else if (skill.id === GUARDIAN_SKILL_IDS.DARING_ADVANCE) {
    emitSkillBuff(context, skill, {
      at: radiantWeaponImpactAt(context, skill),
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      kind: 'guardian-daring-advance',
      duration: 8,
      stacks: 1
    });
  }

  if (skill.id === GUARDIAN_SKILL_IDS.EFFULGENT_STANCE) {
    // Fixed activation/detonation boundaries keep resolver playback deterministic.
    for (const { type, at } of [
      { type: 'guardian.effulgent-activated', at: context.start },
      { type: 'guardian.effulgent-detonate', at: context.start + 4 }
    ]) {
      context.emit({
        type,
        at,
        priority: type === 'guardian.effulgent-activated' ? -40 : 0,
        source: 'guardian',
        sourceId: skill.id,
        actorType: 'player',
        skillId: skill.id,
        skillName: skill.name
      });
    }
  }
}

/** Replays only the remaining duration ArcDPS observed at the EVTC boundary. */
export function replayInitialLuminaryState(context: GuardianCastContext, skill: GuardianSkill): void {
  const duration = Math.max(0, Number(context.command.initialStateDurationMs || 0)) / 1000;
  if (!(duration > 0)) return;
  const common = {
    at: context.start,
    source: 'guardian',
    sourceId: skill.id,
    actorType: 'player' as const,
    duration,
    stacks: 1
  };
  if (skill.id === LUMINARY_INITIAL_STATE_SKILL_IDS.resolution) {
    emitSkillBuff(context, skill, { ...common, kind: 'resolution' });
  } else if (skill.id === LUMINARY_INITIAL_STATE_SKILL_IDS.empoweredArmaments) {
    luminaryState.from(context).empoweredArmamentsUntil = context.start + duration;
    emitSkillBuff(context, skill, { ...common, kind: 'guardian-empowered-armaments' });
  } else if (skill.id === LUMINARY_INITIAL_STATE_SKILL_IDS.radiantHammer) {
    emitSkillBuff(context, skill, {
      ...common,
      kind: 'guardian-radiant-armaments',
      metadata: { radiantWeapon: 'hammer' }
    });
  } else if (skill.id === LUMINARY_INITIAL_STATE_SKILL_IDS.claw) {
    context.emit({
      ...common,
      type: 'control',
      controlKind: 'initial-state',
      duration: 0,
      initialStateDuration: duration,
      skillId: skill.id,
      skillName: skill.name
    });
  }
}

/** Counts damage packets inside Effulgent Stance's half-open activation window. */
export function reactToEffulgentStrike(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const state = luminaryState.from(context);
  const maximumStacks = Number(balanceProfileFromContext(context, PROFILE.effulgentStance)?.maximumStacks ?? 10);
  const guardianOwnedStrike =
    isGw2PlayerActorEvent(event) || (event.source === 'guardian' && event.actorType === 'effect');
  if (
    !guardianOwnedStrike ||
    !(Number(event.coefficient || 0) > 0) ||
    !(event.at < Number(state.effulgentActiveUntil || 0) - Number(context.epsilon ?? EPSILON))
  ) {
    return;
  }

  state.effulgentStacks = Math.min(maximumStacks, Number(state.effulgentStacks || 0) + 1);
}

export function handleEffulgentActivated(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  luminaryState.from(context).effulgentActiveUntil = event.at + 4;
  luminaryState.from(context).effulgentStacks = 0;
}

/** Resolves Effulgent Stance damage and its maximum-stack daze. */
export function handleEffulgentDetonate(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const state = luminaryState.from(context);
  const profile = balanceProfileFromContext(context, PROFILE.effulgentStance);
  const strike = balanceProfileEffect(profile, 'strike');
  const control = balanceProfileEffect(profile, 'control');
  const maximumStacks = Number(profile?.maximumStacks ?? 10);
  const stacks = Math.max(0, Math.min(maximumStacks, Number(state.effulgentStacks || 0)));
  state.effulgentActiveUntil = 0;
  state.effulgentStacks = 0;
  context.recordProc('skill', 'Effulgent Stance', event.at, 'Effulgent Stance', `${stacks}/10 stacks`);
  enqueueOrdered(
    context.queue,
    buildGuardianStrike({
      at: event.at,
      priority: 5,
      sourceId: GUARDIAN_SKILL_IDS.EFFULGENT_STANCE_DAMAGE,
      skillId: GUARDIAN_SKILL_IDS.EFFULGENT_STANCE_DAMAGE,
      skillName: 'Effulgent Stance',
      name: 'Effulgent Stance',
      coefficient: Number(strike?.coefficient ?? 0.5) + stacks * Number(profile?.damageIncreasePerStack ?? 0.35),
      weaponStrengthProfileId: 'nonweapon.unequipped',
      stackCount: stacks
    })
  );
  if (stacks === maximumStacks) {
    enqueueOrdered(context.queue, {
      type: 'control',
      at: event.at,
      priority: 6,
      source: 'guardian',
      sourceId: GUARDIAN_SKILL_IDS.EFFULGENT_STANCE_DAMAGE,
      actorType: 'player',
      skillId: GUARDIAN_SKILL_IDS.EFFULGENT_STANCE_DAMAGE,
      skillName: 'Effulgent Stance',
      controlKind: 'daze',
      duration: Number(control?.duration ?? 2)
    });
  }
}
