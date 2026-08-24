/**
 * Effect materialization. Expands one canonical skill effect (strike,
 * condition, control, blind, boon/buff/effect, or custom) into its ordered timed event
 * applications, resolving per-tick timing against the cast start or end. Cast
 * interruption and actual event emission remain scheduler concerns.
 */
import type {
  SchedulerRecord,
  SimulationActorType,
  SimulationEventInput,
  Skill,
  SkillEffect,
  SkillId
} from '../types.js';

export interface EffectEventBase extends SchedulerRecord {
  readonly source: string;
  readonly sourceId: SkillId;
  readonly actorType?: SimulationActorType;
  readonly ownerActorType?: SimulationActorType;
  readonly skillId?: SkillId | null;
  readonly skillName?: string;
  readonly activationId?: string;
}

export interface MaterializedEffectApplication {
  readonly at: number;
  readonly event: SimulationEventInput;
}

export interface MaterializeSkillEffectOptions {
  readonly skill: Skill;
  readonly effect: SkillEffect;
  readonly start: number;
  readonly fullEnd: number;
  readonly baseEvent: EffectEventBase;
  readonly skillWeaponFallback?: string;
  readonly statusDuration?: number;
}

/** Resolves the first timestamp at which an effect should fire. */
export function effectFirstAt(start: number, fullEnd: number, effect: SkillEffect): number {
  const origin = effect.timingAnchor === 'castEnd' ? fullEnd : start;
  if (Array.isArray(effect.ticks) && effect.ticks.length) {
    return origin + Number(effect.ticks[0].atMs) / 1000;
  }

  if (effect.atMs != null) return origin + Number(effect.atMs) / 1000;
  return fullEnd;
}

/**
 * Expands one canonical skill effect into its ordered event applications.
 * Cast interruption and actual event emission remain scheduler concerns.
 */
export function materializeSkillEffectApplications({
  skill,
  effect,
  start,
  fullEnd,
  baseEvent,
  skillWeaponFallback = '',
  statusDuration
}: MaterializeSkillEffectOptions): readonly MaterializedEffectApplication[] {
  const firstAt = effectFirstAt(start, fullEnd, effect);
  const applications: MaterializedEffectApplication[] = [];
  const comboMetadata = effect.comboFinishers ? { comboFinishers: effect.comboFinishers } : {};
  const comboFieldMetadata = effect.comboFields ? { comboFields: effect.comboFields } : {};
  const flatStrikeMetadata = {
    ...(effect.flatDamage != null ? { flatDamage: Number(effect.flatDamage) } : {}),
    ...(effect.flatStrikeBase != null ? { flatStrikeBase: Number(effect.flatStrikeBase) } : {}),
    ...(effect.flatStrikePowerCoeff != null ? { flatStrikePowerCoeff: Number(effect.flatStrikePowerCoeff) } : {})
  };

  if (effect.type === 'strike') {
    const ticks = Array.isArray(effect.ticks) ? effect.ticks : null;
    const hits = ticks?.length || Math.max(1, Math.trunc(Number(effect.hits || 1)));
    const equalCoefficient = Number(effect.coefficient || 0) / hits;
    const interval = Math.max(0, Number(effect.intervalMs || 0)) / 1000;
    const origin = effect.timingAnchor === 'castEnd' ? fullEnd : start;
    for (let hitIndex = 1; hitIndex <= hits; hitIndex += 1) {
      const tick = ticks?.[hitIndex - 1];
      const at = tick ? origin + Number(tick.atMs) / 1000 : firstAt + (hitIndex - 1) * interval;
      applications.push({
        at,
        event: {
          ...baseEvent,
          type: 'damage',
          at,
          name: effect.name || skill.name,
          coefficient: tick ? Number(tick.coefficient) : equalCoefficient,
          hits: 1,
          hitIndex,
          totalHits: hits,
          skillWeapon: effect.weapon || skill.weapon || skill.skillWeapon || skillWeaponFallback,
          weaponStrength: effect.weaponStrength,
          weaponStrengthProfileId: effect.weaponStrengthProfileId,
          weaponStrengthSource: effect.weaponStrengthSource,
          canCrit: effect.canCrit !== false,
          ...(effect.coefficientModifiers ? { coefficientModifiers: effect.coefficientModifiers } : {}),
          ...(effect.metadata || {}),
          ...(tick?.metadata || {}),
          ...flatStrikeMetadata,
          ...comboMetadata,
          ...comboFieldMetadata,
          ...(tick?.comboFinishers ? { comboFinishers: tick.comboFinishers } : {})
        }
      });
    }
  } else if (effect.type === 'condition') {
    if (Array.isArray(effect.ticks)) {
      const origin = effect.timingAnchor === 'castEnd' ? fullEnd : start;
      const ticks = effect.ticks;
      for (let applicationIndex = 1; applicationIndex <= ticks.length; applicationIndex += 1) {
        const tick = ticks[applicationIndex - 1];
        const at = origin + Number(tick.atMs) / 1000;
        applications.push({
          at,
          event: {
            ...baseEvent,
            at,
            type: 'condition',
            name: effect.name || `${skill.name} — ${tick.condition}`,
            condition: tick.condition,
            stacks: Number(tick.stacks),
            duration: Number(tick.duration),
            applicationIndex,
            totalApplications: ticks.length,
            ...(effect.metadata || {}),
            ...(tick.metadata || {}),
            ...comboMetadata,
            ...comboFieldMetadata,
            ...(tick.comboFinishers ? { comboFinishers: tick.comboFinishers } : {})
          }
        });
      }
    } else {
      const count = Math.max(1, Math.trunc(Number(effect.applications || 1)));
      const interval = Math.max(0, Number(effect.intervalMs || 0)) / 1000;
      for (let applicationIndex = 1; applicationIndex <= count; applicationIndex += 1) {
        const at = firstAt + (applicationIndex - 1) * interval;
        applications.push({
          at,
          event: {
            ...baseEvent,
            at,
            type: 'condition',
            name: effect.name || `${skill.name} — ${effect.condition}`,
            condition: effect.condition,
            stacks: Number(effect.stacks),
            duration: Number(effect.duration),
            applicationIndex,
            totalApplications: count,
            ...(effect.metadata || {}),
            ...comboMetadata,
            ...comboFieldMetadata
          }
        });
      }
    }
  } else if (effect.type === 'control' || effect.type === 'blind') {
    const count = Math.max(1, Math.trunc(Number(effect.applications || 1)));
    const interval = Math.max(0, Number(effect.intervalMs || 0)) / 1000;
    for (let applicationIndex = 1; applicationIndex <= count; applicationIndex += 1) {
      const at = firstAt + (applicationIndex - 1) * interval;
      applications.push({
        at,
        event: {
          ...baseEvent,
          at,
          type: effect.type,
          ...(effect.duration != null ? { duration: Number(effect.duration) } : {}),
          applicationIndex,
          totalApplications: count,
          ...(effect.metadata || {}),
          ...comboMetadata,
          ...comboFieldMetadata
        }
      });
    }
  } else if (effect.type === 'boon' || effect.type === 'buff' || effect.type === 'effect') {
    const recipientMetadata = {
      ...(effect.recipients != null ? { recipients: effect.recipients } : {}),
      ...(effect.affectsSelf != null ? { affectsSelf: effect.affectsSelf } : {}),
      ...(effect.affectsSummons != null ? { affectsSummons: effect.affectsSummons } : {}),
      ...(effect.maximumRecipients != null ? { maximumRecipients: effect.maximumRecipients } : {}),
      ...(effect.targetCap != null ? { targetCap: effect.targetCap } : {}),
      ...(effect.companionIds != null ? { companionIds: effect.companionIds } : {})
    };
    const count = Math.max(1, Math.trunc(Number(effect.applications || 1)));
    const interval = Math.max(0, Number(effect.intervalMs || 0)) / 1000;
    for (let applicationIndex = 1; applicationIndex <= count; applicationIndex += 1) {
      const at = firstAt + (applicationIndex - 1) * interval;
      applications.push({
        at,
        event: {
          ...baseEvent,
          at,
          // Effects remain reporting-only instead of entering the shared boon
          // state; boons and legacy buffs retain their existing runtime event.
          type: effect.type === 'effect' ? 'effect' : 'buff',
          kind: String(effect.boon || effect.kind || effect.name || '').toLowerCase(),
          stacks: Math.max(1, Number(effect.stacks || 1)),
          duration: Math.max(0, Number(statusDuration ?? effect.duration ?? 0)),
          ...(count > 1 ? { applicationIndex, totalApplications: count } : {}),
          ...recipientMetadata,
          ...(effect.metadata || {}),
          ...comboMetadata,
          ...comboFieldMetadata
        }
      });
    }
  } else if (effect.type === 'custom') {
    const count = Math.max(1, Math.trunc(Number(effect.applications || 1)));
    const interval = Math.max(0, Number(effect.intervalMs || 0)) / 1000;
    for (let applicationIndex = 1; applicationIndex <= count; applicationIndex += 1) {
      const at = firstAt + (applicationIndex - 1) * interval;
      applications.push({
        at,
        event: {
          ...baseEvent,
          at,
          ...effect.event,
          type: effect.eventType,
          applicationIndex,
          totalApplications: count,
          ...comboMetadata,
          ...comboFieldMetadata
        }
      });
    }
  }

  return applications;
}
