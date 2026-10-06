import type { SkillEffect, StrikeEffect, StrikeTick } from '#gw2/platform/effects/types.js';
import type { SimulationActorType } from '#gw2/platform/events/actors.js';
import type { EffectMetadata, SimulationEventBase } from '#gw2/platform/events/events.js';
import type { Skill, SkillId } from '#gw2/platform/skills/types.js';
/**
 * Effect materialization. Expands one canonical skill effect (strike,
 * condition, control, boon/buff, or custom) into its ordered timed event
 * applications, resolving per-tick timing against the cast start or end. Cast
 * interruption and actual event emission remain scheduler concerns.
 */

export interface EffectEventBase {
  readonly metadata?: EffectMetadata;
  readonly triggeredBy?: string;
  readonly source: string;
  readonly sourceId: SkillId;
  /** Materialized packets inherit the producer's declared actor. */
  readonly actorType: SimulationActorType;
  readonly ownerActorType?: SimulationActorType;
  readonly summonKind?: string;
  readonly skillId?: SkillId | null;
  readonly skillName?: string;
  readonly activationId?: string;
}

interface MaterializedEffectApplication {
  readonly at: number;
  readonly event: SimulationEventBase;
}

interface MaterializeSkillEffectOptions {
  readonly reactionGroup?: number;
  readonly skill: Skill;
  readonly effect: SkillEffect;
  readonly start: number;
  readonly fullEnd: number;
  readonly baseEvent: EffectEventBase;
  readonly skillWeaponFallback?: string;
}

/** Preserves authored annotations as one nested runtime object, with tick values overriding effect and base defaults. */
function nestedEffectMetadata(
  baseMetadata?: EffectMetadata,
  effectMetadata?: EffectMetadata,
  tickMetadata?: EffectMetadata
): { readonly metadata: EffectMetadata } | Record<string, never> {
  if (!baseMetadata && !effectMetadata && !tickMetadata) return {};
  return { metadata: { ...baseMetadata, ...effectMetadata, ...tickMetadata } };
}

/** Copies the strike formula fields that the numeric resolver consumes from each packet. */
function strikeEventFields(source: StrikeEffect | StrikeTick) {
  return {
    ...(source.name != null ? { name: source.name } : {}),
    // Explicit packet labels let the breakdown separate effects while retaining their casting skill.
    ...(source.damageBreakdownName != null ? { damageBreakdownName: String(source.damageBreakdownName) } : {}),
    ...(source.weaponStrength != null ? { weaponStrength: source.weaponStrength } : {}),
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
    ...(source.canCrit != null ? { canCrit: source.canCrit } : {}),
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

  if (effect.atMs != null) return origin + effect.atMs / 1000;
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
  reactionGroup
}: MaterializeSkillEffectOptions): readonly MaterializedEffectApplication[] {
  const firstAt = effectFirstAt(start, fullEnd, effect);
  const applications: MaterializedEffectApplication[] = [];
  const comboMetadata = effect.comboFinishers ? { comboFinishers: effect.comboFinishers } : {};
  const comboFieldMetadata = effect.comboFields ? { comboFields: effect.comboFields } : {};
  // Summon subtype follows every packet so ownership and clone/phantasm identity remain separate.
  const effectBaseEvent = {
    ...baseEvent,
    ...(effect.summonKind != null ? { summonKind: effect.summonKind } : {}),
    ...(effect.summonOwner != null ? { summonOwner: effect.summonOwner } : {}),
    ...(effect.skillName != null ? { skillName: effect.skillName } : {}),
    ...(effect.parentSkillName != null ? { parentSkillName: effect.parentSkillName } : {}),
    ...(effect.icon != null ? { icon: effect.icon } : {})
  };

  if (effect.type === 'strike') {
    const ticks = Array.isArray(effect.ticks) ? effect.ticks : null;
    const hits = ticks?.length || Math.max(1, Math.trunc(effect.hits || 1));
    const equalCoefficient = (effect.coefficient || 0) / hits;
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
          ...nestedEffectMetadata(baseEvent.metadata, effect.metadata, tick?.metadata),
          ...comboMetadata,
          ...comboFieldMetadata,
          ...(tick?.comboFinishers ? { comboFinishers: tick.comboFinishers } : {})
        }
      });
    }
  } else if (effect.type === 'condition') {
    // Both authoring forms share packet construction; untimed repetitions still begin at cast completion.
    const ticks = Array.isArray(effect.ticks) ? effect.ticks : null;
    const count = ticks?.length ?? Math.max(1, Math.trunc(effect.applications || 1));
    const interval = Math.max(0, effect.intervalMs || 0) / 1000;
    const origin = effect.timingAnchor === 'castStart' ? start : fullEnd;
    for (let applicationIndex = 1; applicationIndex <= count; applicationIndex += 1) {
      const tick = ticks?.[applicationIndex - 1];
      const packet = tick ?? effect;
      const at = tick ? origin + Number(tick.atMs) / 1000 : firstAt + (applicationIndex - 1) * interval;
      applications.push({
        at,
        event: {
          ...effectBaseEvent,
          at,
          type: 'condition',
          name: effect.name || `${skill.name} — ${packet.condition}`,
          condition: packet.condition,
          stacks: Number(packet.stacks),
          duration: Number(packet.duration),
          applicationIndex,
          totalApplications: count,
          ...(effect.damageKind != null ? { damageKind: effect.damageKind } : {}),
          ...(tick?.damageKind != null ? { damageKind: tick.damageKind } : {}),
          ...(effect.projectile != null ? { projectile: effect.projectile } : {}),
          ...(tick?.projectile != null ? { projectile: tick.projectile } : {}),
          ...(effect.target != null ? { target: effect.target } : {}),
          ...nestedEffectMetadata(baseEvent.metadata, effect.metadata, tick?.metadata),
          ...comboMetadata,
          ...comboFieldMetadata,
          ...(tick?.comboFinishers ? { comboFinishers: tick.comboFinishers } : {})
        }
      });
    }
  } else if (effect.type === 'control') {
    const count = Math.max(1, Math.trunc(effect.applications || 1));
    const interval = Math.max(0, effect.intervalMs || 0) / 1000;
    for (let applicationIndex = 1; applicationIndex <= count; applicationIndex += 1) {
      const at = firstAt + (applicationIndex - 1) * interval;
      applications.push({
        at,
        event: {
          ...effectBaseEvent,
          at,
          type: effect.type,
          ...(effect.controlKind != null ? { controlKind: effect.controlKind } : {}),
          applicationIndex,
          totalApplications: count,
          ...nestedEffectMetadata(baseEvent.metadata, effect.metadata),
          ...comboMetadata,
          ...comboFieldMetadata
        }
      });
    }
  } else if (effect.type === 'boon' || effect.type === 'buff') {
    const count = Math.max(1, Math.trunc(effect.applications || 1));
    const interval = Math.max(0, effect.intervalMs || 0) / 1000;
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
          kind: (effect.boon || effect.kind || effect.name || '').toLowerCase(),
          stacks: Math.max(1, effect.stacks || 1),
          duration: Math.max(0, effect.duration),
          ...(effect.maximumDuration == null ? {} : { maximumDuration: effect.maximumDuration }),
          ...(count > 1 ? { applicationIndex, totalApplications: count } : {}),
          ...(effect.audience ? { audience: effect.audience } : {}),
          ...nestedEffectMetadata(baseEvent.metadata, effect.metadata),
          ...comboMetadata,
          ...comboFieldMetadata
        }
      });
    }
    // StatusEffect groups boon/buff discriminants, so TypeScript still needs this check to narrow the custom payload.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  } else if (effect.type === 'custom') {
    const count = Math.max(1, Math.trunc(effect.applications || 1));
    const interval = Math.max(0, effect.intervalMs || 0) / 1000;
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
          ...nestedEffectMetadata(baseEvent.metadata, effect.metadata),
          ...comboMetadata,
          ...comboFieldMetadata
        }
      });
    }
  }

  // Packet identity is authored before interruption and targeting filter out any applications.
  if (reactionGroup !== undefined)
    return applications.map((application, index) => ({
      ...application,
      event: { ...application.event, effectReaction: { group: reactionGroup, packet: index + 1 } }
    }));
  return applications;
}
