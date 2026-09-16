/**
 * State mutations shared by the combat systems.
 *
 * Ports `utils/actor_utils.cpp`, `put_skill_on_cooldown`, the counter and
 * cooldown modifier helpers, and `apply_side_effects`. Registration order and
 * entity creation mirror the reference exactly (including holder entities for
 * empty modifier lists) because pool sizes decide which pool leads a view and
 * therefore the order side effects fire in.
 */
import { effectStacking, isDamagingEffect, maxEffectDuration } from '#gw2/platform/combat-engine/effect-rules.js';
import { findCounter, getSkill, getSkillEntity, isStageDependent } from '#gw2/platform/combat-engine/queries.js';
import {
  createEntity,
  createRotationComponent,
  entityName,
  markAttributesDirty,
  ownerOf,
  view
} from '#gw2/platform/combat-engine/registry.js';
import type {
  Condition,
  ConditionalSkillGroup,
  CooldownModifier,
  CounterModifier,
  Effect,
  SideEffects,
  Skill,
  UniqueEffect
} from '#gw2/platform/combat-engine/configuration.js';
import type { CounterState, Entity, Pool, Registry } from '#gw2/platform/combat-engine/registry.js';

/** Upstream permanent effects last 1,000,000,000 ms and are sourced by the encounter itself. */
export const PERMANENT_DURATION = 1_000_000_000;
export const CONSOLE_ENTITY: Entity = 0;

/** Creates a holder entity owned by `parent`, as `add_owner_based_component` does even for empty lists. */
function addHolder<T>(registry: Registry, pool: Pool<T>, value: T, parent: Entity): Entity {
  const holder = createEntity(registry, 'holder entity');
  registry.owner.emplace(holder, parent);
  pool.emplace(holder, value);
  return holder;
}

/** Registers side-effect holders in the reference order: conversions, modifiers, counters, cooldowns, removals, triggers. */
function addSideEffectHolders(registry: Registry, sideEffects: SideEffects, parent: Entity): void {
  addHolder(registry, registry.isAttributeConversion, sideEffects.attributeConversions, parent);
  addHolder(registry, registry.isAttributeModifier, sideEffects.attributeModifiers, parent);
  addHolder(registry, registry.isCounterModifier, sideEffects.counterModifiers, parent);
  addHolder(registry, registry.isCooldownModifier, sideEffects.cooldownModifiers, parent);
  addHolder(registry, registry.isEffectRemoval, sideEffects.effectRemovals, parent);
  for (const trigger of sideEffects.skillTriggers) {
    addHolder(registry, registry.isSkillTrigger, { skillTrigger: trigger, alreadyTriggered: false }, parent);
  }

  for (const trigger of sideEffects.unchainedSkillTriggers) {
    addHolder(registry, registry.isUnchainedSkillTrigger, trigger, parent);
  }

  for (const trigger of sideEffects.sourceActorSkillTriggers) {
    addHolder(registry, registry.isSourceActorSkillTrigger, trigger, parent);
  }
}

/**
 * Registers a skill for an actor once per key. Skill-level side effects are
 * owned by the actor, so they stay active for as long as the actor exists.
 */
export function addSkillToActor(registry: Registry, skill: Skill, actorEntity: Entity): Entity {
  for (const entity of view([registry.owner, registry.isSkill]).entities()) {
    if (registry.owner.get(entity) === actorEntity && registry.isSkill.get(entity).skillKey === skill.skillKey) {
      return entity;
    }
  }

  const skillEntity = createEntity(registry, `${skill.skillKey} skill holder entity`);
  registry.isSkill.emplace(skillEntity, skill);
  registry.owner.emplace(skillEntity, actorEntity);
  registry.ammo.emplace(skillEntity, { maxAmmo: skill.ammo, currentAmmo: skill.ammo });
  addHolder(registry, registry.isAttributeConversion, skill.attributeConversions, actorEntity);
  addHolder(registry, registry.isAttributeModifier, skill.attributeModifiers, actorEntity);
  addHolder(registry, registry.isCounterModifier, skill.counterModifiers, actorEntity);
  addHolder(registry, registry.isCooldownModifier, skill.cooldownModifiers, actorEntity);
  addHolder(registry, registry.isEffectRemoval, skill.effectRemovals, actorEntity);
  for (const trigger of skill.skillTriggers) {
    addHolder(registry, registry.isSkillTrigger, { skillTrigger: trigger, alreadyTriggered: false }, actorEntity);
  }

  for (const trigger of skill.unchainedSkillTriggers) {
    addHolder(registry, registry.isUnchainedSkillTrigger, trigger, actorEntity);
  }

  for (const trigger of skill.sourceActorSkillTriggers) {
    addHolder(registry, registry.isSourceActorSkillTrigger, trigger, actorEntity);
  }

  for (const childKey of skill.childSkillKeys) {
    addSkillToActor(registry, getSkill(registry, childKey, ownerOf(registry, actorEntity)), actorEntity);
  }

  return skillEntity;
}

export function addConditionalSkillGroupToActor(
  registry: Registry,
  group: ConditionalSkillGroup,
  actorEntity: Entity
): Entity {
  for (const entity of view([registry.owner, registry.isConditionalSkillGroup]).entities()) {
    if (
      registry.owner.get(entity) === actorEntity &&
      registry.isConditionalSkillGroup.get(entity).skillKey === group.skillKey
    ) {
      return entity;
    }
  }

  const groupEntity = createEntity(registry, `${group.skillKey} conditional skill group holder entity`);
  registry.isConditionalSkillGroup.emplace(groupEntity, group);
  registry.owner.emplace(groupEntity, actorEntity);
  for (const member of group.conditionalSkillKeys) {
    registry.isPartOfConditionalSkillGroup.emplace(getSkillEntity(registry, member.skillKey, actorEntity), groupEntity);
  }

  return groupEntity;
}

/**
 * Spawns a temporary child actor that casts the given skills once. Children
 * share the root owner's team, attribute everything to it, and are destroyed
 * after their queued rotation and active skills finish.
 */
export function enqueueChildSkills(
  registry: Registry,
  parentActor: Entity,
  childName: string,
  skillKeys: readonly string[]
): void {
  if (skillKeys.length === 0) return;
  const team = registry.team.get(parentActor);
  const child = createEntity(registry);
  // Names are never overwritten, matching `ctx().emplace_as` on a recycled identifier.
  if (!registry.names.has(child)) registry.names.set(child, `child_actor${child}-${childName}`);
  registry.isActor.emplace(child, true);
  registry.owner.emplace(child, ownerOf(registry, parentActor));
  registry.team.emplace(child, team);
  registry.destroyAfterRotation.emplace(child, true);
  registry.actorCreated.emplaceOrReplace(child, true);

  const rotation = registry.rotation.emplace(child, createRotationComponent(null));
  for (const skillKey of skillKeys) {
    // Resolution happens on the parent so conditional groups pick the member valid at trigger time.
    const skill = getSkill(registry, skillKey, parentActor);
    addSkillToActor(registry, skill, child);
    rotation.queuedRotation.push({ skill: skill.skillKey, castTimeMs: 0 });
  }
}

export function enqueueChildSkill(registry: Registry, skillKey: string, parentActor: Entity): void {
  enqueueChildSkills(registry, parentActor, `Temporary ${skillKey} Entity`, [skillKey]);
}

/** Queues a cast on the actor itself, creating a rotation component if the actor had none. */
export function enqueueSourceActorChildSkill(registry: Registry, skillKey: string, sourceActor: Entity): void {
  registry.rotation
    .getOrEmplace(sourceActor, () => createRotationComponent(null))
    .queuedRotation.push({ skill: skillKey, castTimeMs: 0 });
}

/** Adds one boon/condition instance, honoring duration, intensity, and replace stacking. */
export function addEffectToActor(
  registry: Registry,
  effect: Effect,
  actorEntity: Entity,
  sourceActor: Entity,
  sourceSkill: string,
  duration: number,
  groupedWithNumStacks: number
): Entity {
  const stacking = effectStacking(effect);
  if (stacking !== 'intensity') {
    for (const entity of view([registry.isEffect, registry.owner]).entities()) {
      if (ownerOf(registry, registry.owner.get(entity)) !== actorEntity) continue;
      if (registry.isEffect.get(entity).effect !== effect) continue;
      const existing = registry.duration.get(entity);
      if (stacking === 'duration') {
        const remaining = existing.duration - existing.progress;
        existing.progress = 0;
        existing.duration = Math.min(remaining + duration, maxEffectDuration(effect));
        return entity;
      }

      if (existing.duration - existing.progress > duration) return entity;
      existing.progress = existing.duration;
      registry.destroyEntity.emplaceOrReplace(entity, true);
      break;
    }
  }

  const effectEntity = createEntity(registry, `"${effect}" effect holder entity`);
  registry.isEffect.emplace(effectEntity, { effect, groupedWithNumStacks });
  if (isDamagingEffect(effect)) registry.isDamagingEffect.emplace(effectEntity, true);
  registry.owner.emplace(effectEntity, actorEntity);
  registry.sourceActor.emplace(effectEntity, sourceActor);
  registry.sourceSkill.emplace(effectEntity, sourceSkill);
  registry.duration.emplace(effectEntity, { duration, progress: 0 });

  // Built-in boon and condition behavior is modeled as holders owned by the effect instance.
  if (effect === 'MIGHT') {
    addHolder(
      registry,
      registry.isAttributeConversion,
      [
        { condition: EMPTY, from: 'condition_damage', to: 'condition_damage', multiplier: 0, addend: 30 },
        { condition: EMPTY, from: 'power', to: 'power', multiplier: 0, addend: 30 }
      ],
      effectEntity
    );
  } else if (effect === 'FURY') {
    addHolder(
      registry,
      registry.isAttributeModifier,
      [{ condition: EMPTY, attribute: 'critical_chance_multiplier', multiplier: 1, addend: 0.25 }],
      effectEntity
    );
  } else if (effect === 'QUICKNESS') {
    registry.hasQuickness.emplaceOrReplace(actorEntity, true);
  } else if (effect === 'ALACRITY') {
    registry.hasAlacrity.emplaceOrReplace(actorEntity, true);
  } else if (effect === 'VULNERABILITY') {
    addHolder(
      registry,
      registry.isAttributeModifier,
      [
        { condition: EMPTY, attribute: 'incoming_strike_damage_multiplier_add_group', multiplier: 1, addend: 0.01 },
        { condition: EMPTY, attribute: 'incoming_condition_damage_multiplier_add_group', multiplier: 1, addend: 0.01 }
      ],
      effectEntity
    );
  }

  return effectEntity;
}

const EMPTY: Condition = Object.freeze({ not: [], or: [], and: [] });

/** Each stack is its own instance; damage rounding groups the stacks applied together. */
export function addEffectStacks(
  registry: Registry,
  effect: Effect,
  numStacks: number,
  duration: number,
  sourceSkill: string,
  sourceEntity: Entity,
  targetEntity: Entity
): void {
  for (let index = 0; index < numStacks; index += 1) {
    addEffectToActor(registry, effect, targetEntity, sourceEntity, sourceSkill, duration, numStacks);
  }
}

/** Adds one unique-effect instance; returns null when the stored-stack cap rejects it. */
export function addUniqueEffectToActor(
  registry: Registry,
  uniqueEffect: UniqueEffect,
  actorEntity: Entity,
  sourceActor: Entity,
  sourceSkill: string,
  duration: number
): Entity | null {
  const matches = () =>
    [...view([registry.isUniqueEffect, registry.owner]).entities()].filter(
      (entity) =>
        registry.owner.get(entity) === actorEntity &&
        registry.isUniqueEffect.get(entity).uniqueEffectKey === uniqueEffect.uniqueEffectKey
    );

  let stacksCount = 0;
  for (const entity of matches()) {
    stacksCount += 1;
    const existing = registry.duration.get(entity);
    if (uniqueEffect.stackingType === 'duration') {
      const remaining = existing.duration - existing.progress;
      existing.progress = 0;
      existing.duration = Math.min(remaining + duration, registry.isUniqueEffect.get(entity).maxDuration);
      return entity;
    }

    if (uniqueEffect.stackingType === 'replace') {
      if (existing.duration - existing.progress > duration) return entity;
      existing.progress = existing.duration;
      registry.destroyEntity.emplaceOrReplace(entity, true);
    }
  }

  if (stacksCount >= uniqueEffect.maxStoredStacks) return null;

  const existingStacks = matches();
  const uniqueEffectEntity = createEntity(registry, `${uniqueEffect.uniqueEffectKey} unique-effect holder entity`);
  registry.isUniqueEffect.emplace(uniqueEffectEntity, uniqueEffect);
  registry.owner.emplace(uniqueEffectEntity, actorEntity);
  registry.sourceActor.emplace(uniqueEffectEntity, sourceActor);
  registry.sourceSkill.emplace(uniqueEffectEntity, sourceSkill);
  registry.duration.emplace(uniqueEffectEntity, { duration, progress: 0 });
  addSideEffectHolders(registry, uniqueEffect, uniqueEffectEntity);

  if (uniqueEffect.refreshesOtherStacks && stacksCount > 0) {
    for (const entity of existingStacks) registry.duration.get(entity).progress = 0;
  }

  return uniqueEffectEntity;
}

export function addUniqueEffectStacks(
  registry: Registry,
  uniqueEffect: UniqueEffect,
  numStacks: number,
  duration: number,
  sourceSkill: string,
  sourceEntity: Entity,
  targetEntity: Entity
): void {
  for (let remaining = numStacks; remaining > 0; remaining -= 1) {
    addUniqueEffectToActor(registry, uniqueEffect, targetEntity, sourceEntity, sourceSkill, duration);
  }
}

export class CooldownStateError extends Error {
  readonly code = 'engine.cooldown-state';
}

/** Spends one ammo and starts recharge; forced calls (resets by other skills) may run with no ammo left. */
export function putSkillOnCooldown(registry: Registry, skillEntity: Entity, force = false): void {
  const skill = registry.isSkill.get(skillEntity);
  if (skill.cooldown[0] === 0) return;
  const ammo = registry.ammo.get(skillEntity);
  if (ammo.currentAmmo <= 0 && !force) {
    // Experimental coarse steps can resolve two independently gated procs in one step before either
    // records its recharge. The reference (1 ms) treats this as corrupt state; coarse steps let it pass.
    if (registry.stepMs > 1) return;
    throw new CooldownStateError(
      `put_skill_on_cooldown: actor ${entityName(registry, registry.owner.get(skillEntity))} skill ${skill.skillKey} doesn't have any more ammo.`
    );
  }

  ammo.currentAmmo = Math.max(ammo.currentAmmo - 1, 0);
  if (!registry.cooldown.has(skillEntity)) {
    registry.cooldown.emplace(skillEntity, { duration: skill.cooldown, progress: [0, 0] });
  }
}

/** Conditional-group members share one recharge, so finishing any member recharges them all. */
function putSkillOnCooldownForActor(registry: Registry, skillEntity: Entity, skill: Skill, actorEntity: Entity): void {
  const groupEntity = registry.isPartOfConditionalSkillGroup.tryGet(skillEntity);
  const forceLinked = () => {
    for (const linked of skill.skillsToPutOnCooldown) {
      putSkillOnCooldown(registry, getSkillEntity(registry, linked, actorEntity), true);
    }
  };

  if (groupEntity === undefined) {
    putSkillOnCooldown(registry, skillEntity);
    forceLinked();
    return;
  }

  for (const member of registry.isConditionalSkillGroup.get(groupEntity).conditionalSkillKeys) {
    putSkillOnCooldown(registry, getSkillEntity(registry, member.skillKey, actorEntity));
    forceLinked();
  }
}

/**
 * Completes a cast. Recharge commits here, and a temporary child actor's cast
 * recharges the root owner's copy of the skill so procs respect shared cooldowns.
 */
export function finishCastingSkill(registry: Registry, skillEntity: Entity, actorEntity: Entity): void {
  registry.finishedCastingSkills.getOrEmplace(actorEntity, () => []).push(skillEntity);
  const skill = registry.isSkill.get(skillEntity);
  // Swapping away a held bundle only drops it, so it neither spends ammo nor recharges.
  if (skill.weaponSwap && registry.bundle.has(actorEntity)) return;

  const owner = ownerOf(registry, actorEntity);
  if (owner !== actorEntity) {
    putSkillOnCooldownForActor(registry, getSkillEntity(registry, skill.skillKey, owner), skill, owner);
  } else {
    putSkillOnCooldownForActor(registry, skillEntity, skill, actorEntity);
  }
}

/** Removes queued ticks and actions of a skill for every casting entity that shares the caster's owner. */
export function cancelSkill(registry: Registry, casterEntity: Entity, skillKey: string): void {
  const casterOwner = ownerOf(registry, casterEntity);
  registry.skillsTicksTracker.forEach((castingEntity, states) => {
    if (ownerOf(registry, castingEntity) !== casterOwner) return;
    eraseWhileIterating(states, (state) => {
      if (registry.isSkill.get(state.skillEntity).skillKey !== skillKey) return -1;
      const cancelEntity = getSkillEntity(registry, skillKey, castingEntity);
      return states.findIndex((candidate) => candidate.skillEntity === cancelEntity);
    });
  });
  registry.skillsActions.forEach((castingEntity, states) => {
    if (ownerOf(registry, castingEntity) !== casterOwner) return;
    eraseWhileIterating(states, (state) => {
      if (registry.isSkill.get(state.skillEntity).skillKey !== skillKey) return -1;
      const cancelEntity = getSkillEntity(registry, skillKey, castingEntity);
      return states.findIndex((candidate) => candidate.skillEntity === cancelEntity);
    });
  });
}

/**
 * The reference erases from a vector inside a range-for over it, so the element
 * after an erased one is skipped. This reproduces that skip without reading past
 * the shrunken end.
 */
function eraseWhileIterating<T>(items: T[], positionToErase: (item: T) => number): void {
  const end = items.length;
  for (let index = 0; index < end && index < items.length; index += 1) {
    const position = positionToErase(items[index]);
    if (position !== -1) items.splice(position, 1);
  }
}

function applyCounterModification(registry: Registry, counter: CounterState, modifier: CounterModifier): void {
  if (modifier.operation === 'RESET') {
    counter.value = counter.configuration.initialValue;
    return;
  }

  const operate = (operand: number) => {
    if (modifier.operation === 'ADD') counter.value += operand;
    else if (modifier.operation === 'SUBTRACT') counter.value -= operand;
    else if (modifier.operation === 'SET') counter.value = operand;
  };

  if (modifier.counterValue !== undefined) {
    registry.isCounter.forEach((_, referenced) => {
      if (referenced.configuration.counterKey === modifier.counterValue) operate(referenced.value);
    });
  }

  if (modifier.value !== undefined) operate(modifier.value);
}

/** Cooldown modifiers move recharge progress; "ADD" lengthens the remaining recharge. */
function applyCooldownModification(registry: Registry, actorEntity: Entity, modifier: CooldownModifier): void {
  const cooldown = registry.cooldown.tryGet(getSkillEntity(registry, modifier.skillKey, actorEntity));
  if (!cooldown) return;
  switch (modifier.operation) {
    case 'ADD':
      cooldown.progress[0] -= modifier.value;
      break;
    case 'SUBTRACT':
      cooldown.progress[0] += modifier.value;
      break;
    case 'SET':
      cooldown.progress[0] = modifier.value;
      cooldown.progress[1] = 0;
      break;
    case 'RESET':
      cooldown.progress[0] = cooldown.duration[0];
      cooldown.progress[1] = 0;
      break;
  }
}

class CounterLookupError extends Error {
  readonly code = 'engine.unknown-counter';
}

const tickHookIndexes = new WeakMap<
  Pool<unknown>,
  {
    revision: number;
    ownershipRevision: number;
    byActor: Map<Entity, Entity[]>;
  }
>();

/** Index eligible tick holders in pool order, rebuilding after holder or ownership changes, never evaluating predicates early. */
function tickHookHolders<T>(
  registry: Registry,
  pool: Pool<T>,
  actor: Entity,
  eligible: (value: T) => boolean
): readonly Entity[] {
  let index = tickHookIndexes.get(pool);
  if (!index || index.revision !== pool.revision || index.ownershipRevision !== registry.owner.revision) {
    const byActor = new Map<Entity, Entity[]>();
    index = { revision: pool.revision, ownershipRevision: registry.owner.revision, byActor };
    pool.forEach((holder, value) => {
      if (!eligible(value)) return;
      const owner = ownerOf(registry, holder);
      const holders = byActor.get(owner) ?? [];
      holders.push(holder);
      byActor.set(owner, holders);
    });
    tickHookIndexes.set(pool, index);
  }

  return index.byActor.get(actor) ?? [];
}

/**
 * Fires every side effect owned by the source's root actor whose condition the
 * current stage accepts: counters, cooldowns, removals, then the three trigger kinds.
 */
export function applySideEffects(
  registry: Registry,
  sourceEntity: Entity,
  accepts: (condition: Condition) => boolean,
  everyTick = false
): void {
  const sourceOwner = ownerOf(registry, sourceEntity);
  const visit = <T>(pool: Pool<T>, eligible: (value: T) => boolean, apply: (holder: Entity, value: T) => void) => {
    if (!everyTick) {
      pool.forEach(apply);
      return;
    }

    for (const holder of tickHookHolders(registry, pool, sourceOwner, eligible)) apply(holder, pool.get(holder));
  };

  const independent = (entries: readonly { readonly condition: Condition }[]) =>
    entries.some((entry) => !isStageDependent(entry.condition));

  // Empty holders preserve reference pool ordering, but need no ownership walk or predicate evaluation.
  // Keep stage-bound counter holders indexed too: missing counter references must still fail before stage gating.
  visit(
    registry.isCounterModifier,
    (entries) => entries.length > 0,
    (holder, modifiers) => {
      if (modifiers.length === 0 || ownerOf(registry, holder) !== sourceOwner) return;
      for (const modifier of modifiers) {
        const counter = findCounter(registry, modifier.counterKey);
        if (!counter) throw new CounterLookupError(`Counter with key ${modifier.counterKey} not found`);
        if (accepts(modifier.condition)) {
          const previous = counter.value;
          applyCounterModification(registry, counter, modifier);
          // Counters mutate in place, so notify attribute predicates when their input actually changes.
          if (counter.value !== previous && registry.attributeDependencies.has('counter')) {
            markAttributesDirty(registry);
          }
        }
      }
    }
  );

  visit(registry.isCooldownModifier, independent, (holder, modifiers) => {
    if (modifiers.length === 0) return;
    const ownerActor = ownerOf(registry, holder);
    if (ownerActor !== sourceOwner) return;
    for (const modifier of modifiers) {
      if (accepts(modifier.condition)) applyCooldownModification(registry, ownerActor, modifier);
    }
  });

  visit(registry.isEffectRemoval, independent, (holder, removals) => {
    if (removals.length === 0 || ownerOf(registry, holder) !== sourceOwner) return;
    for (const removal of removals) {
      if (!accepts(removal.condition)) continue;
      if (removal.effect != null) {
        let remaining = removal.numStacks ?? 5000;
        view([registry.isEffect, registry.owner]).forEach((entity) => {
          if (registry.owner.get(entity) !== sourceOwner || registry.isEffect.get(entity).effect !== removal.effect)
            return;
          if (remaining <= 0) return;
          remaining -= 1;
          registry.destroyEntity.emplaceOrReplace(entity, true);
        });
      }

      if (removal.uniqueEffect !== '') {
        let remaining = removal.numStacks ?? 5000;
        view([registry.isUniqueEffect, registry.owner]).forEach((entity) => {
          if (
            registry.owner.get(entity) !== sourceOwner ||
            registry.isUniqueEffect.get(entity).uniqueEffectKey !== removal.uniqueEffect
          ) {
            return;
          }

          if (remaining <= 0) return;
          remaining -= 1;
          registry.destroyEntity.emplaceOrReplace(entity, true);
        });
      }
    }
  });

  // Chained triggers fire at most once per tick; the flag resets with the tick's temporary state.
  visit(
    registry.isSkillTrigger,
    (trigger) => !isStageDependent(trigger.skillTrigger.condition),
    (holder, trigger) => {
      if (ownerOf(registry, holder) !== sourceOwner) return;
      if (!trigger.alreadyTriggered && accepts(trigger.skillTrigger.condition)) {
        trigger.alreadyTriggered = true;
        enqueueChildSkill(registry, trigger.skillTrigger.skillKey, sourceOwner);
      }
    }
  );

  visit(
    registry.isUnchainedSkillTrigger,
    (trigger) => !isStageDependent(trigger.condition),
    (holder, trigger) => {
      if (ownerOf(registry, holder) !== sourceOwner) return;
      if (accepts(trigger.condition)) enqueueChildSkill(registry, trigger.skillKey, sourceOwner);
    }
  );

  visit(
    registry.isSourceActorSkillTrigger,
    (trigger) => !isStageDependent(trigger.condition),
    (holder, trigger) => {
      const ownerActor = ownerOf(registry, holder);
      if (ownerActor !== sourceOwner) return;
      if (accepts(trigger.condition)) enqueueSourceActorChildSkill(registry, trigger.skillKey, ownerActor);
    }
  );
}
