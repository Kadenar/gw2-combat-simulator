import { canonicalTime, EPSILON } from '#kernel/core/clock.js';
import {
  requireBalanceProfileFromContext,
  requireEffect,
  effectNumber,
  balanceProfileNumber
} from '#gw2/platform/engine/skills/balance-profiles.js';
import { isGw2PlayerActorEvent } from '#gw2/platform/combat/state/event-ownership.js';
import { emitSkillBuff } from '#gw2/platform/execution/gw2-policy/skill-events.js';
import { buildGuardianStrike } from '#gw2/professions/guardian/core/mechanics/event-handlers.js';
import { GUARDIAN_SKILL_IDS } from '#gw2/professions/guardian/data/ids.js';
import { gw2EffectExpiresAt, projectCastRelativeEffectTimingMs } from '#gw2/platform/skills/timing.js';
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
import { boundedNumber } from '#kernel/core/numeric.js';

/** Applies cast-timed Luminary stance windows and schedules Effulgent resolution. */
export function processLuminaryStances(context: GuardianCastContext, skill: GuardianSkill): void {
  const state = luminaryState.from(context);
  if (skill.id === GUARDIAN_SKILL_IDS.PIERCING_STANCE) {
    const runtimeCastMs = Math.max(0, (context.fullEnd - context.start) * 1000);
    const at = canonicalTime(
      context.start + projectCastRelativeEffectTimingMs(skill, runtimeCastMs, PIERCING_STANCE_IMPACT_MS) / 1000
    );
    if (at > context.effectiveEnd + EPSILON) return;
    // Stack duration from the live remainder using the displayed buff's exclusive tick deadline.
    const duration = Math.max(0, state.piercingStanceUntil - at) + 8;
    state.piercingStanceUntil = gw2EffectExpiresAt(at, duration);
    emitSkillBuff(context, skill, {
      at,
      source: 'guardian',
      sourceId: skill.id,
      actorType: 'player',
      kind: 'guardian-piercing-stance',
      // Open the stance before its impact and aura detonation; resolver queries no longer read pending buffs.
      priority: -20,
      duration,
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
      { type: 'guardian.effulgent-detonate', at: canonicalTime(context.start + 4) }
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
    // Keep the observed duration, but share the emitted temporary buff's expiry clock.
    luminaryState.from(context).empoweredArmamentsUntil = gw2EffectExpiresAt(context.start, duration);
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
      initialStateDuration: duration,
      skillId: skill.id,
      skillName: skill.name
    });
  }
}

/** Counts damage packets inside Effulgent Stance's half-open activation window. */
export function reactToEffulgentStrike(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const state = luminaryState.from(context);
  const effulgentStanceProfile = requireBalanceProfileFromContext(context, PROFILE.effulgentStance);
  const maximumStacks = balanceProfileNumber(effulgentStanceProfile, 'maximumStacks');
  const guardianOwnedStrike =
    isGw2PlayerActorEvent(event) || (event.source === 'guardian' && event.actorType === 'effect');
  if (
    !guardianOwnedStrike ||
    !(Number(event.coefficient || 0) > 0) ||
    !(event.at < Number(state.effulgentActiveUntil || 0))
  ) {
    return;
  }

  state.effulgentStacks = Math.min(maximumStacks, Number(state.effulgentStacks || 0) + 1);
}

export function handleEffulgentActivated(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  // This is an exact detonation window, not a tick-rounded temporary buff.
  luminaryState.from(context).effulgentActiveUntil = canonicalTime(event.at + 4);
  luminaryState.from(context).effulgentStacks = 0;
}

/** Consumes Effulgent stacks to scale detonation damage and trigger the maximum-stack daze. */
export function handleEffulgentDetonate(context: GuardianResolverContext, event: GuardianResolverEvent): void {
  const state = luminaryState.from(context);

  const effulgentStanceProfile = requireBalanceProfileFromContext(context, PROFILE.effulgentStance);
  const strike = requireEffect(effulgentStanceProfile, 'strike', 'Strike');
  const control = requireEffect(effulgentStanceProfile, 'control', 'Control');
  const maximumStacks = balanceProfileNumber(effulgentStanceProfile, 'maximumStacks');
  const stacks = boundedNumber(state.effulgentStacks || 0, 0, 0, maximumStacks);
  state.effulgentActiveUntil = 0;
  state.effulgentStacks = 0;
  if (strike) {
    context.recordProc('skill', 'Effulgent Stance', event.at, 'Effulgent Stance', `${stacks}/10 stacks`);
    context.queue.enqueue(
      buildGuardianStrike({
        at: event.at,
        priority: 5,
        sourceId: GUARDIAN_SKILL_IDS.EFFULGENT_STANCE_DAMAGE,
        skillId: GUARDIAN_SKILL_IDS.EFFULGENT_STANCE_DAMAGE,
        skillName: 'Effulgent Stance',
        name: 'Effulgent Stance',
        coefficient:
          effectNumber(effulgentStanceProfile, strike, 'coefficient') +
          stacks * balanceProfileNumber(effulgentStanceProfile, 'damageIncreasePerStack'),
        weaponStrengthProfileId: 'nonweapon.unequipped'
      })
    );
  }
  if (control && stacks === maximumStacks) {
    context.queue.enqueue({
      type: 'control',
      at: event.at,
      priority: 6,
      source: 'guardian',
      sourceId: GUARDIAN_SKILL_IDS.EFFULGENT_STANCE_DAMAGE,
      actorType: 'player',
      skillId: GUARDIAN_SKILL_IDS.EFFULGENT_STANCE_DAMAGE,
      skillName: 'Effulgent Stance',
      controlKind: 'daze'
    });
  }
}
