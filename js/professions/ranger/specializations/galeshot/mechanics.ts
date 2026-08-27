import { emitSkillBuff, emitSkillCondition, emitSkillDamage } from '../../../../platform/gw2/scheduler/skill-events.js';
import { isInternalCooldownReady } from '../../../../platform/engine/core/clock.js';
import { hasTrait } from '../../../../platform/gw2/combat/state/traits.js';
import {
  GW2_ALACRITY_RECHARGE_RATE,
  gw2BuffActiveForAudience,
  gw2SchedulerBoonDuration
} from '../../../../platform/gw2/scheduler/policy.js';
import type { ScheduledTask, SimulationEvent } from '../../../../platform/engine/types.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '../../data/ids.js';
import type { RangerCastContext, RangerSchedulerContext, RangerSkill } from '../../types.js';
import { RANGER_PET_STRIKE_SCALING } from '../../core/pets.js';
import { galeshotState } from './state.js';
import { rangerBalanceProfile, rangerBalanceProfileEffect, rangerBalanceValue } from '../../core/profiles.js';
import { GALESHOT_BALANCE_PROFILE_IDS as PROFILE } from './profiles.js';

const MISSILE_SKILL_IDS = new Set<number>([
  ID.RICOCHET,
  ID.SPLITBLADE,
  ID.WINTERS_BITE,
  ID.PATH_OF_SCARS,
  ID.PATH_OF_SCARS_MAX_RANGE,
  ID.RAPID_FIRE,
  ID.LONG_RANGE_SHOT,
  ID.POINT_BLANK_SHOT,
  ID.HUNTERS_SHOT,
  ID.KEEN_SHOT,
  ID.HAWKEYE,
  ID.BLUSTER,
  ID.FLEETING_ZEPHYR,
  ID.QUARRYS_PERIL,
  ID.PELT,
  ID.SUPERSONIC_ARROW,
  ID.PIERCING_GALES
]);

export function advanceGaleshotArrows(context: RangerSchedulerContext, target: number): void {
  const state = galeshotState.from(context);
  if (target <= state.arrowsUpdatedAt) return;
  state.maximumArrows = rangerBalanceValue(context, PROFILE.resources, 'maximumStacks', 8);
  state.arrows = Math.min(state.maximumArrows, state.arrows);
  const rechargeRate = gw2BuffActiveForAudience(context, 'alacrity', target, 'self')
    ? Number(context.config.alacrityRechargeRate || GW2_ALACRITY_RECHARGE_RATE)
    : 1;
  const interval =
    rangerBalanceValue(context, PROFILE.resources, 'pulseInterval', 5) / Math.max(Number.EPSILON, rechargeRate);
  const generated = Math.floor((target - state.arrowsUpdatedAt) / interval);
  if (generated <= 0) return;
  state.arrows = Math.min(state.maximumArrows, state.arrows + generated);
  // Advance by whole intervals only so the fractional remainder carries forward
  // and isn't lost to floating-point truncation on the next advance call.
  state.arrowsUpdatedAt += generated * interval;
}

function restoreArrow(context: RangerSchedulerContext, amount = 1): void {
  const state = galeshotState.from(context);
  state.maximumArrows = rangerBalanceValue(context, PROFILE.resources, 'maximumStacks', 8);
  state.arrows = Math.min(state.maximumArrows, state.arrows + amount);
}

export function observeGaleshotEvent(context: RangerSchedulerContext, event: SimulationEvent): void {
  if (event.type === 'ranger.pet-swapped') {
    // Wuthering Wind targets the active pet; an unconsumed charge is lost on
    // swap rather than transferring to the incoming pet.
    galeshotState.from(context).wutheringWindReady = false;
  }

  if (
    event.type === 'damage' &&
    event.actorType === 'player' &&
    Number(event.coefficient) > 0 &&
    MISSILE_SKILL_IDS.has(Number(event.skillId ?? event.sourceId))
  ) {
    context.tasks.schedule({
      type: 'ranger.galeshot-missile-hit',
      at: event.at,
      priority: -40,
      payload: {
        skillName: event.skillName,
        activationId: event.activationId
      }
    });
  }

  if (
    event.type === 'damage' &&
    event.actorType === 'summon' &&
    event.source === 'ranger-pet' &&
    Number(event.coefficient) > 0
  ) {
    context.tasks.schedule({
      type: 'ranger.galeshot-pet-hit',
      at: event.at,
      priority: -40,
      payload: {
        skillName: event.skillName,
        activationId: event.activationId
      }
    });
  }

  if (event.type === 'control' && (event.actorType === 'player' || event.actorType === 'summon')) {
    context.tasks.schedule({
      type: 'ranger.galeshot-disable',
      at: event.at,
      priority: -40,
      payload: { skillName: event.skillName }
    });
  }
}

export function handleGaleshotMissileHitTask(context: RangerSchedulerContext, task: ScheduledTask): void {
  const state = galeshotState.from(context);
  const payload = task.payload as {
    readonly skillName?: string;
    readonly activationId?: string;
  } | null;
  if (task.at <= state.mistralUntil + context.epsilon) {
    const profile = rangerBalanceProfile(context, PROFILE.mistral);
    const strike = rangerBalanceProfileEffect(profile, 'strike');
    const chilled = rangerBalanceProfileEffect(profile, 'condition');
    // Each missile-triggered Mistral is its own effect activation while its
    // strike and condition packets remain grouped under one identity.
    const activationId = context.createActivationId('effect');
    emitSkillDamage(context, {
      at: task.at,
      source: 'ranger',
      sourceId: ID.MISTRAL,
      actorType: 'player',
      skillId: ID.MISTRAL,
      skillName: 'Mistral',
      name: 'Mistral',
      coefficient: Number(strike?.coefficient ?? 0.3),
      hits: Number(strike?.hits ?? 1),
      canCrit: true,
      damageKind: 'galeshot-mistral',
      triggeredBy: payload?.skillName,
      activationId
    });
    emitSkillCondition(context, {
      at: task.at,
      source: 'ranger',
      sourceId: ID.MISTRAL,
      actorType: 'player',
      skillId: ID.MISTRAL,
      skillName: 'Mistral',
      name: 'Mistral - Chilled',
      condition: String(chilled?.condition || 'Chilled'),
      duration: Number(chilled?.duration ?? 1),
      stacks: Number(chilled?.stacks ?? 1),
      triggeredBy: payload?.skillName,
      activationId
    });
  }

  if (!hasTrait({ config: context.config }, TRAIT.SHRIKE)) return;
  const profile = rangerBalanceProfile(context, PROFILE.shrike);
  const threshold = Number(profile?.threshold ?? 12);
  const strike = rangerBalanceProfileEffect(profile, 'strike');
  state.missileHits += 1;
  if (state.missileHits < threshold) return;
  // Subtract rather than reset so any overshoot from burst windows is preserved.
  state.missileHits -= threshold;
  restoreArrow(context, Number(profile?.resourceGain ?? 1));
  const hits = Number(strike?.hits ?? 3);
  for (let hitIndex = 1; hitIndex <= hits; hitIndex += 1) {
    emitSkillDamage(context, {
      at: task.at,
      source: 'Trait',
      sourceId: TRAIT.SHRIKE,
      actorType: 'effect',
      skillId: TRAIT.SHRIKE,
      skillName: 'Shrike',
      name: 'Shrike',
      coefficient: Number(strike?.coefficient ?? 0.8),
      hits: 1,
      hitIndex,
      totalHits: hits,
      canCrit: true,
      damageKind: 'galeshot-shrike',
      triggeredBy: payload?.skillName
    });
  }
}

export function handleGaleshotPetHitTask(context: RangerSchedulerContext, task: ScheduledTask): void {
  const state = galeshotState.from(context);
  const payload = task.payload as {
    readonly skillName?: string;
    readonly activationId?: string;
  } | null;
  const activationId = String(payload?.activationId || '');
  if (
    !hasTrait({ config: context.config }, TRAIT.WUTHERING_WIND) ||
    !state.wutheringWindReady ||
    task.at + context.epsilon < state.wutheringWindReadyAt ||
    (activationId && state.wutheringWindActivationIds[activationId])
  ) {
    return;
  }

  state.wutheringWindReady = false;
  if (activationId) state.wutheringWindActivationIds[activationId] = true;
  const strike = rangerBalanceProfileEffect(rangerBalanceProfile(context, PROFILE.wutheringWind), 'strike');
  context.emit({
    type: 'proc',
    at: task.at,
    source: 'Trait',
    sourceId: TRAIT.WUTHERING_WIND,
    actorType: 'effect',
    skillId: ID.WUTHERING_WIND,
    skillName: 'Wuthering Wind',
    name: 'Wuthering Wind',
    procType: 'trait',
    sourceSkill: payload?.skillName,
    detail: 'activated'
  });
  emitSkillDamage(context, {
    at: task.at,
    source: 'Trait',
    sourceId: TRAIT.WUTHERING_WIND,
    actorType: 'effect',
    skillId: ID.WUTHERING_WIND,
    skillName: 'Wuthering Wind',
    name: 'Wuthering Wind',
    coefficient: Number(strike?.coefficient ?? 2),
    hits: Number(strike?.hits ?? 1),
    canCrit: true,
    damageKind: 'galeshot-wuthering-wind',
    triggeredBy: payload?.skillName,
    // Trait proc uses pet power scaling, not the player's weapon strength;
    // profession modifiers (e.g. Flock Together) still apply via the flags below.
    independentSummonStrike: true,
    summonUsesProfessionModifiers: true,
    summonBasePower: RANGER_PET_STRIKE_SCALING.basePower,
    summonBaseConditionDamage: RANGER_PET_STRIKE_SCALING.baseConditionDamage,
    summonInheritsCriticalAttributes: true
  });
}

export function handleGaleshotDisableTask(context: RangerSchedulerContext, _task: ScheduledTask): void {
  const state = galeshotState.from(context);
  if (
    !hasTrait({ config: context.config }, TRAIT.THRILL_OF_THE_CATCH) ||
    !isInternalCooldownReady(context.state.time, state.thrillOfTheCatchReadyAt)
  ) {
    return;
  }

  // 0.25 s ICD prevents one multi-hit ability from restoring more than one arrow.
  const profile = rangerBalanceProfile(context, PROFILE.thrillOfTheCatch);
  state.thrillOfTheCatchReadyAt = context.state.time + Number(profile?.internalCooldown ?? 0.25);
  restoreArrow(context, Number(profile?.resourceGain ?? 1));
}

function isBeastSkill(skill: RangerSkill): boolean {
  return Boolean(
    // petFamilySkills are passive and never cast by the player, so they don't
    // count. BEASTMODE / LEAVE_BEASTMODE are the mode-switch commands, not
    // actual pet abilities, so they're excluded as well.
    (skill.petSkill && !skill.petFamilySkill) ||
    (skill.beastmodeSkill && skill.id !== ID.BEASTMODE && skill.id !== ID.LEAVE_BEASTMODE)
  );
}

// Commit Galeshot resource spending, Wind Force transitions, Cyclone Bow state,
// and completed-skill trait effects from one activation.
export function completeGaleshotSkill(context: RangerCastContext, skill: RangerSkill): void {
  const state = galeshotState.from(context);
  if (
    !hasTrait(context, TRAIT.FLOCK_TOGETHER) ||
    !isBeastSkill(skill) ||
    !isInternalCooldownReady(context.effectiveEnd, state.flockTogetherReadyAt)
  ) {
    return;
  }

  const profile = rangerBalanceProfile(context, PROFILE.flockTogether);
  const quickness = rangerBalanceProfileEffect(profile, 'boon');
  state.flockTogetherReadyAt = context.effectiveEnd + Number(profile?.internalCooldown ?? 20);
  emitSkillBuff(context, {
    at: context.effectiveEnd,
    source: 'Trait',
    sourceId: TRAIT.FLOCK_TOGETHER,
    actorType: 'effect',
    skillId: TRAIT.FLOCK_TOGETHER,
    skillName: 'Flock Together',
    kind: String(quickness?.boon || 'quickness'),
    boon: String(quickness?.boon || 'quickness'),
    duration: gw2SchedulerBoonDuration(
      context,
      skill,
      String(quickness?.boon || 'quickness'),
      Number(quickness?.duration ?? 5)
    ),
    stacks: Number(quickness?.stacks ?? 1),
    recipients: 'party',
    affectsSummons: true,
    maximumRecipients: 5,
    triggeredBy: skill.name
  });
}
