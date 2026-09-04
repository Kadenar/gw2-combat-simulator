/**
 * Effect materialization. Expands one canonical skill effect (strike,
 * condition, control, blind, boon/buff, or custom) into its ordered timed event
 * applications, resolving per-tick timing against the cast start or end. Cast
 * interruption and actual event emission remain scheduler concerns.
 */
import type { EffectMetadata, SimulationActorType, SimulationEventInput } from '#gw2/platform/engine/events/types.js';
import type { SchedulerRecord } from '#gw2/platform/engine/execution/types.js';
import type { Skill, SkillEffect, SkillId } from '#gw2/platform/engine/skills/types.js';

export interface EffectEventBase extends SchedulerRecord {
  readonly source: string;
  readonly sourceId: SkillId;
  readonly actorType?: SimulationActorType;
  readonly ownerActorType?: SimulationActorType;
  readonly summonKind?: string;
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

/** Preserves authored annotations as one nested runtime object, with tick values overriding effect defaults. */
function nestedEffectMetadata(
  effectMetadata?: EffectMetadata,
  tickMetadata?: EffectMetadata
): { readonly metadata: EffectMetadata } | Record<string, never> {
  if (!effectMetadata && !tickMetadata) return {};
  return { metadata: { ...effectMetadata, ...tickMetadata } };
}

/** Copies the strike formula fields that the numeric resolver consumes from each packet. */
function strikeEventFields(source: SchedulerRecord): SchedulerRecord {
  return {
    ...(source.name != null ? { name: String(source.name) } : {}),
    ...(source.weaponStrength != null ? { weaponStrength: Number(source.weaponStrength) } : {}),
    ...(source.independentSummonStrike != null ? { independentSummonStrike: source.independentSummonStrike } : {}),
    ...(source.summonUsesProfessionModifiers != null
      ? { summonUsesProfessionModifiers: source.summonUsesProfessionModifiers }
      : {}),
    ...(source.summonInheritsAttributes != null ? { summonInheritsAttributes: source.summonInheritsAttributes } : {}),
    ...(source.summonInheritsCriticalAttributes != null
      ? { summonInheritsCriticalAttributes: source.summonInheritsCriticalAttributes }
      : {}),
    ...(source.flatDamage != null ? { flatDamage: Number(source.flatDamage) } : {}),
    ...(source.flatStrikeBase != null ? { flatStrikeBase: Number(source.flatStrikeBase) } : {}),
    ...(source.flatStrikePowerCoeff != null ? { flatStrikePowerCoeff: Number(source.flatStrikePowerCoeff) } : {}),
    ...(source.flatStrikeMultiplier != null ? { flatStrikeMultiplier: Number(source.flatStrikeMultiplier) } : {}),
    ...(source.flatStrikeHealthThreshold != null
      ? { flatStrikeHealthThreshold: Number(source.flatStrikeHealthThreshold) }
      : {}),
    ...(source.flatStrikeThresholdMultiplier != null
      ? { flatStrikeThresholdMultiplier: Number(source.flatStrikeThresholdMultiplier) }
      : {}),
    ...(source.damageKind != null ? { damageKind: source.damageKind } : {}),
    ...(source.noCrit != null ? { noCrit: source.noCrit } : {}),
    ...(source.forceCrit != null ? { forceCrit: source.forceCrit } : {}),
    ...(source.projectile != null ? { projectile: source.projectile } : {})
  };
}

/** Resolves the first timestamp at which an effect should fire. */
export function effectFirstAt(start: number, fullEnd: number, effect: SkillEffect): number {
  const origin = effect.timingAnchor === 'castStart' ? start : fullEnd;
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
  // Summon subtype follows every packet so ownership and clone/phantasm identity remain separate.
  const effectBaseEvent = {
    ...baseEvent,
    ...(effect.summonKind != null ? { summonKind: String(effect.summonKind) } : {}),
    ...(effect.summonOwner != null ? { summonOwner: String(effect.summonOwner) } : {}),
    ...(effect.skillName != null ? { skillName: String(effect.skillName) } : {}),
    ...(effect.parentSkillName != null ? { parentSkillName: String(effect.parentSkillName) } : {}),
    ...(effect.icon != null ? { icon: String(effect.icon) } : {})
  };

  if (effect.type === 'strike') {
    const ticks = Array.isArray(effect.ticks) ? effect.ticks : null;
    const hits = ticks?.length || Math.max(1, Math.trunc(Number(effect.hits || 1)));
    const equalCoefficient = Number(effect.coefficient || 0) / hits;
    const origin = effect.timingAnchor === 'castStart' ? start : fullEnd;
    for (let hitIndex = 1; hitIndex <= hits; hitIndex += 1) {
      const tick = ticks?.[hitIndex - 1];
      const at = tick ? origin + Number(tick.atMs) / 1000 : firstAt;
      applications.push({
        at,
        event: {
          ...effectBaseEvent,
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
          ...strikeEventFields(effect),
          ...(tick ? strikeEventFields(tick) : {}),
          ...nestedEffectMetadata(effect.metadata, tick?.metadata),
          ...comboMetadata,
          ...comboFieldMetadata,
          ...(tick?.comboFinishers ? { comboFinishers: tick.comboFinishers } : {})
        }
      });
    }
  } else if (effect.type === 'condition') {
    if (Array.isArray(effect.ticks)) {
      const origin = effect.timingAnchor === 'castStart' ? start : fullEnd;
      const ticks = effect.ticks;
      for (let applicationIndex = 1; applicationIndex <= ticks.length; applicationIndex += 1) {
        const tick = ticks[applicationIndex - 1];
        const at = origin + Number(tick.atMs) / 1000;
        applications.push({
          at,
          event: {
            ...effectBaseEvent,
            at,
            type: 'condition',
            name: effect.name || `${skill.name} — ${tick.condition}`,
            condition: tick.condition,
            stacks: Number(tick.stacks),
            duration: Number(tick.duration),
            applicationIndex,
            totalApplications: ticks.length,
            ...(effect.damageKind != null ? { damageKind: effect.damageKind } : {}),
            ...(tick.damageKind != null ? { damageKind: tick.damageKind } : {}),
            ...(effect.projectile != null ? { projectile: effect.projectile } : {}),
            ...(tick.projectile != null ? { projectile: tick.projectile } : {}),
            ...(effect.target != null ? { target: effect.target } : {}),
            ...nestedEffectMetadata(effect.metadata, tick.metadata),
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
            ...effectBaseEvent,
            at,
            type: 'condition',
            name: effect.name || `${skill.name} — ${effect.condition}`,
            condition: effect.condition,
            stacks: Number(effect.stacks),
            duration: Number(effect.duration),
            applicationIndex,
            totalApplications: count,
            ...(effect.damageKind != null ? { damageKind: effect.damageKind } : {}),
            ...(effect.projectile != null ? { projectile: effect.projectile } : {}),
            ...(effect.target != null ? { target: effect.target } : {}),
            ...nestedEffectMetadata(effect.metadata),
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
          ...effectBaseEvent,
          at,
          type: effect.type,
          ...(effect.controlKind != null ? { controlKind: effect.controlKind } : {}),
          ...(effect.duration != null ? { duration: Number(effect.duration) } : {}),
          ...(effect.breakbar != null ? { breakbar: Number(effect.breakbar) } : {}),
          ...(effect.bonusDefianceBreak != null ? { bonusDefianceBreak: Number(effect.bonusDefianceBreak) } : {}),
          applicationIndex,
          totalApplications: count,
          ...nestedEffectMetadata(effect.metadata),
          ...comboMetadata,
          ...comboFieldMetadata
        }
      });
    }
  } else if (effect.type === 'boon' || effect.type === 'buff') {
    const count = Math.max(1, Math.trunc(Number(effect.applications || 1)));
    const interval = Math.max(0, Number(effect.intervalMs || 0)) / 1000;
    for (let applicationIndex = 1; applicationIndex <= count; applicationIndex += 1) {
      const at = firstAt + (applicationIndex - 1) * interval;
      applications.push({
        at,
        event: {
          ...effectBaseEvent,
          at,
          // Boons and generic positive statuses share the timed-buff runtime
          // event; the authored type still controls GW2 boon-duration scaling.
          type: 'buff',
          kind: String(effect.boon || effect.kind || effect.name || '').toLowerCase(),
          stacks: Math.max(1, Number(effect.stacks || 1)),
          duration: Math.max(0, Number(statusDuration ?? effect.duration ?? 0)),
          ...(count > 1 ? { applicationIndex, totalApplications: count } : {}),
          ...(effect.audience ? { audience: effect.audience } : {}),
          ...nestedEffectMetadata(effect.metadata),
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
          ...effectBaseEvent,
          at,
          ...effect.event,
          type: effect.eventType,
          applicationIndex,
          totalApplications: count,
          ...nestedEffectMetadata(effect.metadata),
          ...comboMetadata,
          ...comboFieldMetadata
        }
      });
    }
  }

  return applications;
}
