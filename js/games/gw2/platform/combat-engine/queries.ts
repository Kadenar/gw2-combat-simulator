/**
 * Read-only combat queries: condition evaluation, skill lookup, and castability.
 *
 * Ports `utils/condition_utils.cpp` and `utils/skill_utils.cpp`. Condition
 * evaluation and conditional skill-group lookup are mutually recursive in the
 * reference, so they share this module. Stage-dependent conditions (on strike,
 * on effect application, on cast begin/finish, on ammo gain) are satisfied only
 * by the hook that owns that stage; every other caller treats them as unmet.
 */
import { ownerOf, view } from '#gw2/platform/combat-engine/registry.js';
import { WEAPON_STRENGTH_RANGES } from '#gw2/platform/combat-engine/effect-rules.js';
import type { Condition, Effect, Skill, Threshold, WeaponType } from '#gw2/platform/combat-engine/configuration.js';
import type { CounterState, Entity, Registry, Strike } from '#gw2/platform/combat-engine/registry.js';

export interface ConditionResult {
  readonly satisfied: boolean;
  readonly reason: string;
}

const SATISFIED: ConditionResult = Object.freeze({ satisfied: true, reason: '' });
const unmet = (reason: string): ConditionResult => ({ satisfied: false, reason });

function thresholdSatisfied(threshold: Threshold, value: number): boolean {
  switch (threshold.thresholdType) {
    case 'equal':
      return value === threshold.thresholdValue;
    case 'upper_bound_exclusive':
      return value < threshold.thresholdValue;
    case 'upper_bound_inclusive':
      return value <= threshold.thresholdValue;
    case 'lower_bound_exclusive':
      return value > threshold.thresholdValue;
    case 'lower_bound_inclusive':
      return value >= threshold.thresholdValue;
  }
}

/** Counters are global by key; the reference keeps the last match when keys repeat. */
export function findCounter(registry: Registry, counterKey: string): CounterState | undefined {
  let found: CounterState | undefined;
  registry.isCounter.forEach((_, counter) => {
    if (counter.configuration.counterKey === counterKey) found = counter;
  });
  return found;
}

/** Conditions that hold regardless of which combat stage asks. */
export function stageIndependentConditionsSatisfied(
  registry: Registry,
  condition: Condition,
  entity: Entity,
  targetEntity: Entity | null
): ConditionResult {
  const source = ownerOf(registry, entity);

  if (condition.weaponType !== undefined || condition.weaponPosition !== undefined) {
    const weapons = registry.equippedWeapons.tryGet(source);
    if (!weapons || !registry.currentWeaponSet.has(source)) return unmet('no weapon equipped');
    const currentSet = registry.currentWeaponSet.get(source);
    // An equipped bundle replaces the weapon bar, so weapon-type and position checks fail while one is held.
    const holdingBundle = registry.bundle.has(source);
    const matches = weapons.some(
      (weapon) =>
        weapon.set === currentSet &&
        (condition.weaponType === undefined || (!holdingBundle && weapon.type === condition.weaponType)) &&
        (condition.weaponPosition === undefined || (!holdingBundle && weapon.position === condition.weaponPosition))
    );
    if (!matches) return unmet('weapon condition not satisfied');
  }

  if (condition.weaponSet !== undefined) {
    if (!registry.currentWeaponSet.has(source)) return unmet('no weapon equipped');
    if (registry.currentWeaponSet.get(source) !== condition.weaponSet) return unmet('wrong weapon set');
  }

  if (condition.bundle !== undefined) {
    const bundle = registry.bundle.tryGet(source);
    if (bundle === undefined) return unmet('no bundle equipped');
    if (bundle !== condition.bundle) {
      return unmet(`wrong bundle equipped: ${bundle}, required bundle: ${condition.bundle}`);
    }
  }

  if (condition.uniqueEffectOnSource !== undefined) {
    if (!hasUniqueEffect(registry, condition.uniqueEffectOnSource, source, null)) {
      return unmet(`unique effect ${condition.uniqueEffectOnSource} not found on source`);
    }
  }

  if (condition.effectOnSource !== undefined) {
    if (countEffect(registry, condition.effectOnSource, source, 1) < 1) {
      return unmet(`effect "${condition.effectOnSource}" not found on source`);
    }
  }

  if (condition.uniqueEffectOnTarget !== undefined) {
    if (targetEntity == null) throw new Error('target_entity must be provided for unique_effect_on_target');
    if (!hasUniqueEffect(registry, condition.uniqueEffectOnTarget, targetEntity, null)) {
      return unmet(`unique effect ${condition.uniqueEffectOnTarget} not found on target`);
    }
  }

  if (condition.uniqueEffectOnTargetBySource !== undefined) {
    if (targetEntity == null) {
      throw new Error('target_entity must be provided for unique_effect_on_target_by_source');
    }

    if (!hasUniqueEffect(registry, condition.uniqueEffectOnTargetBySource, targetEntity, source)) {
      return unmet(`unique effect ${condition.uniqueEffectOnTargetBySource} not found on target by source`);
    }
  }

  if (condition.effectOnTarget !== undefined) {
    if (targetEntity == null) throw new Error('target_entity must be provided for effect_on_target');
    // The reference only reports success from inside a match, so at least one stack is always required.
    const required = Math.max(1, condition.stacksOfEffectOnTarget ?? 1);
    const stacks = countEffect(registry, condition.effectOnTarget, targetEntity, required);
    if (stacks < required) return unmet(`stacks of effect "${condition.effectOnTarget}" on target: ${stacks}`);
  }

  if (condition.dependsOnSkillOffCooldown !== undefined) {
    const skillEntity = getSkillEntity(registry, condition.dependsOnSkillOffCooldown, source);
    if (registry.cooldown.has(skillEntity)) return unmet('skill is on cooldown');
  }

  if (condition.threshold !== undefined) {
    const threshold = condition.threshold;
    if (threshold.generateRandomNumberSubjectToThreshold === true) {
      if (!thresholdSatisfied(threshold, registry.random.real(0, 100))) {
        return unmet('random number not in threshold');
      }
    }

    if (threshold.healthPctSubjectToThreshold === true) {
      // Reference shortcut: static max health, ignoring modifiers that raise it.
      const maximum = registry.staticAttributes.get(source).get('max_health') ?? 0;
      if (!thresholdSatisfied(threshold, registry.combatStats.get(source).health / maximum)) {
        return unmet('health pct not in threshold');
      }
    }

    if (targetEntity != null && threshold.targetHealthPctSubjectToThreshold === true) {
      const maximum = registry.staticAttributes.get(targetEntity).get('max_health') ?? 0;
      if (!thresholdSatisfied(threshold, registry.combatStats.get(targetEntity).health / maximum)) {
        return unmet('target health pct not in threshold');
      }
    }

    if (threshold.counterValueSubjectToThreshold !== undefined) {
      const counter = findCounter(registry, threshold.counterValueSubjectToThreshold);
      if (!counter) throw new Error(`counter with name ${threshold.counterValueSubjectToThreshold} not found`);
      if (!thresholdSatisfied(threshold, counter.value)) return unmet('counter value not in threshold');
    }
  }

  if (condition.not.length > 0) {
    // A "not" list passes when any nested condition fails, exactly as the reference's any_of.
    const passes = condition.not.some(
      (nested) => !stageIndependentConditionsSatisfied(registry, nested, entity, targetEntity).satisfied
    );
    if (!passes) return unmet('not condition satisfied');
  }

  if (condition.or.length > 0) {
    const reasons: string[] = [];
    const passes = condition.or.some((nested) => {
      const result = stageIndependentConditionsSatisfied(registry, nested, entity, targetEntity);
      if (!result.satisfied) reasons.push(result.reason);
      return result.satisfied;
    });
    if (!passes) return unmet(reasons.join('; '));
  }

  if (condition.and.length > 0) {
    for (const nested of condition.and) {
      const result = stageIndependentConditionsSatisfied(registry, nested, entity, targetEntity);
      if (!result.satisfied) return result;
    }
  }

  return SATISFIED;
}

function hasUniqueEffect(registry: Registry, key: string, ownerEntity: Entity, source: Entity | null): boolean {
  const required =
    source == null
      ? [registry.isUniqueEffect, registry.owner]
      : [registry.isUniqueEffect, registry.owner, registry.sourceActor];
  for (const entity of view(required).entities()) {
    if (registry.isUniqueEffect.get(entity).uniqueEffectKey !== key) continue;
    if (registry.owner.get(entity) !== ownerEntity) continue;
    if (source != null && registry.sourceActor.get(entity) !== source) continue;
    return true;
  }

  return false;
}

/** Counts matching effect stacks, stopping once `enough` are found as the reference loop does. */
function countEffect(registry: Registry, effect: Effect, ownerEntity: Entity, enough: number): number {
  let stacks = 0;
  for (const entity of view([registry.isEffect, registry.owner]).entities()) {
    if (registry.isEffect.get(entity).effect !== effect || registry.owner.get(entity) !== ownerEntity) continue;
    stacks += 1;
    if (stacks >= enough) break;
  }

  return stacks;
}

/** Shared stage classification lets hook indexes exclude predicates that cannot fire on ordinary ticks. */
export function isStageDependent(condition: Condition): boolean {
  return (
    condition.onlyAppliesOnStrikes === true ||
    condition.onlyAppliesOnEffectApplication === true ||
    condition.onlyAppliesOnFinishedCasting === true ||
    condition.onlyAppliesOnBegunCasting === true ||
    condition.onlyAppliesOnAmmoGainOfSkill !== undefined
  );
}

/** Conditions evaluated outside any hook stage; stage-bound conditions never pass here. */
export function independentConditionsSatisfied(
  registry: Registry,
  condition: Condition,
  entity: Entity,
  targetEntity: Entity | null
): ConditionResult {
  if (isStageDependent(condition)) return unmet('stage dependent condition');
  return stageIndependentConditionsSatisfied(registry, condition, entity, targetEntity);
}

export function onBegunCastingConditionsSatisfied(
  registry: Registry,
  condition: Condition,
  entity: Entity,
  skill: Skill
): boolean {
  return (
    condition.onlyAppliesOnBegunCasting === true &&
    (condition.onlyAppliesOnBegunCastingSkill === undefined ||
      condition.onlyAppliesOnBegunCastingSkill === skill.skillKey) &&
    (condition.onlyAppliesOnBegunCastingSkillWithTag === undefined ||
      skill.tags.includes(condition.onlyAppliesOnBegunCastingSkillWithTag)) &&
    stageIndependentConditionsSatisfied(registry, condition, entity, null).satisfied
  );
}

export function onFinishedCastingConditionsSatisfied(
  registry: Registry,
  condition: Condition,
  entity: Entity,
  skill: Skill
): boolean {
  return (
    condition.onlyAppliesOnFinishedCasting === true &&
    (condition.onlyAppliesOnFinishedCastingSkill === undefined ||
      condition.onlyAppliesOnFinishedCastingSkill === skill.skillKey) &&
    (condition.onlyAppliesOnFinishedCastingSkillWithTag === undefined ||
      skill.tags.includes(condition.onlyAppliesOnFinishedCastingSkillWithTag)) &&
    stageIndependentConditionsSatisfied(registry, condition, entity, null).satisfied
  );
}

export function onStrikeConditionsSatisfied(
  registry: Registry,
  condition: Condition,
  entity: Entity,
  targetEntity: Entity,
  isCritical: boolean,
  strike: Strike,
  skill: Skill
): boolean {
  return (
    condition.onlyAppliesOnStrikes === true &&
    (condition.onlyAppliesOnCriticalStrikes === undefined || (condition.onlyAppliesOnCriticalStrikes && isCritical)) &&
    (condition.onlyAppliesOnStrikesBySkill === undefined || condition.onlyAppliesOnStrikesBySkill === skill.skillKey) &&
    (condition.onlyAppliesOnStrikesBySkillWithTag === undefined ||
      strike.tags.includes(condition.onlyAppliesOnStrikesBySkillWithTag)) &&
    stageIndependentConditionsSatisfied(registry, condition, entity, targetEntity).satisfied
  );
}

export function onEffectApplicationConditionsSatisfied(
  registry: Registry,
  condition: Condition,
  entity: Entity,
  targetEntity: Entity,
  effect: Effect
): boolean {
  return (
    condition.onlyAppliesOnEffectApplication === true &&
    (condition.onlyAppliesOnEffectApplicationOfType === undefined ||
      condition.onlyAppliesOnEffectApplicationOfType === effect) &&
    stageIndependentConditionsSatisfied(registry, condition, entity, targetEntity).satisfied
  );
}

export function onAmmoGainConditionsSatisfied(
  registry: Registry,
  condition: Condition,
  entity: Entity,
  skill: Skill
): boolean {
  return (
    condition.onlyAppliesOnAmmoGainOfSkill !== undefined &&
    condition.onlyAppliesOnAmmoGainOfSkill === skill.skillKey &&
    stageIndependentConditionsSatisfied(registry, condition, entity, null).satisfied
  );
}

export class SkillLookupError extends Error {
  readonly code = 'engine.unknown-skill';
}

const directSkillIndexes = new WeakMap<
  Registry,
  {
    skillRevision: number;
    ownershipRevision: number;
    byActor: Map<Entity, Map<string, Entity>>;
  }
>();

/** Cache direct skills by their immediate owner and key, retaining the first match in reference view order. */
export function findDirectSkillEntity(registry: Registry, skillKey: string, actorEntity: Entity): Entity | undefined {
  let index = directSkillIndexes.get(registry);
  if (
    !index ||
    index.skillRevision !== registry.isSkill.revision ||
    index.ownershipRevision !== registry.owner.revision
  ) {
    const byActor = new Map<Entity, Map<string, Entity>>();
    view([registry.owner, registry.isSkill]).forEach((entity) => {
      const actor = registry.owner.get(entity);
      const skills = byActor.get(actor) ?? new Map<string, Entity>();
      const key = registry.isSkill.get(entity).skillKey;
      if (!skills.has(key)) skills.set(key, entity);
      byActor.set(actor, skills);
    });
    index = { skillRevision: registry.isSkill.revision, ownershipRevision: registry.owner.revision, byActor };
    directSkillIndexes.set(registry, index);
  }

  return index.byActor.get(actorEntity)?.get(skillKey);
}

/**
 * Resolves a skill key for an actor. A conditional skill group resolves to its
 * first member whose condition currently holds, so the same key can cast
 * different skills as state changes.
 */
export function getSkillEntity(registry: Registry, skillKey: string, actorEntity: Entity): Entity {
  const direct = findDirectSkillEntity(registry, skillKey, actorEntity);
  if (direct !== undefined) return direct;

  let failure = `skill ${skillKey} not found for actor ${registry.names.get(actorEntity) ?? 'temporary_entity'}`;
  for (const groupEntity of view([registry.owner, registry.isConditionalSkillGroup]).entities()) {
    const group = registry.isConditionalSkillGroup.get(groupEntity);
    if (registry.owner.get(groupEntity) !== actorEntity || group.skillKey !== skillKey) continue;
    failure = `no condition satisfied in conditional skill group ${skillKey} for actor ${registry.names.get(actorEntity) ?? 'temporary_entity'}`;
    for (const member of group.conditionalSkillKeys) {
      const memberEntity = getSkillEntity(registry, member.skillKey, actorEntity);
      if (independentConditionsSatisfied(registry, member.condition, actorEntity, null).satisfied) return memberEntity;
    }
  }

  throw new SkillLookupError(failure);
}

export function getSkill(registry: Registry, skillKey: string, actorEntity: Entity): Skill {
  return registry.isSkill.get(getSkillEntity(registry, skillKey, actorEntity));
}

/** Weapon types that never require a matching equipped weapon. */
const WEAPONLESS_TYPES = new Set(['empty_handed', 'main_hand', 'kit_conjure', 'tome']);

export interface Castability {
  readonly canCast: boolean;
  readonly reason: string;
}

export function canCastSkill(registry: Registry, skillEntity: Entity): Castability {
  const actorEntity = registry.owner.get(skillEntity);
  if (registry.owner.has(actorEntity)) return { canCast: true, reason: 'child actor skills are always castable' };

  const bundle = registry.bundle.tryGet(actorEntity);
  const ammo = registry.ammo.get(skillEntity);
  const skill = registry.isSkill.get(skillEntity);
  if (ammo.currentAmmo <= 0 && !(skill.weaponSwap && bundle !== undefined)) {
    return {
      canCast: false,
      reason: ammo.maxAmmo > 1 ? "skill doesn't have any more ammo" : 'skill is on cooldown'
    };
  }

  if (skill.requiredBundle === '') {
    if (skill.weaponType != null && !WEAPONLESS_TYPES.has(skill.weaponType)) {
      const currentSet = registry.currentWeaponSet.get(actorEntity);
      const available = registry.equippedWeapons
        .get(actorEntity)
        .some((weapon) => weapon.set === currentSet && weapon.type === skill.weaponType);
      if (!available) return { canCast: false, reason: 'skill not available on this weapon set' };
    }
  } else if (bundle === undefined) {
    return { canCast: false, reason: `skill requires bundle ${skill.requiredBundle}` };
  } else if (bundle !== skill.requiredBundle) {
    return { canCast: false, reason: `skill requires bundle ${skill.requiredBundle}, but currently have ${bundle}` };
  }

  const condition = independentConditionsSatisfied(registry, skill.castCondition, actorEntity, null);
  if (!condition.satisfied) {
    return { canCast: false, reason: `skill cast condition not satisfied: ${condition.reason}` };
  }

  return { canCast: true, reason: '' };
}

/**
 * Weapon strength for a strike. "main_hand" resolves through the current
 * weapon set; the encounter mode picks the mean, a uniform roll, or an extreme.
 */
export function weaponStrength(registry: Registry, actorEntity: Entity, type: WeaponType | null): number {
  if (type == null) throw new Error('invalid weapon_type');
  let effectiveType: WeaponType | null = type;
  if (type === 'main_hand') {
    const weapons = registry.equippedWeapons.tryGet(actorEntity);
    if (!weapons) throw new Error(`actor ${actorEntity} does not have equipped_weapons`);
    if (!registry.currentWeaponSet.has(actorEntity)) {
      throw new Error(`actor ${actorEntity} does not have current_weapon_set`);
    }

    const currentSet = registry.currentWeaponSet.get(actorEntity);
    const mainHand = weapons.find(
      (weapon) => weapon.set === currentSet && (weapon.position === 'main_hand' || weapon.position === 'two_handed')
    );
    if (!mainHand) throw new Error('no main-hand weapon equipped in the current weapon set');
    effectiveType = mainHand.type;
  }

  const range = effectiveType == null ? ([0, 0] as const) : WEAPON_STRENGTH_RANGES[effectiveType];
  if (!range) throw new Error(`no weapon strength range for ${String(effectiveType)}`);
  switch (registry.encounter.weaponStrengthMode) {
    case 'MEAN':
      return (range[0] + range[1]) / 2;
    case 'RANDOM':
      return registry.random.integer(range[0], range[1]);
    case 'LOWEST':
      return range[0];
    case 'HIGHEST':
      return range[1];
  }
}
