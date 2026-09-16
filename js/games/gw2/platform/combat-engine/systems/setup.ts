/**
 * Encounter initialization.
 *
 * Ports `system/encounter.cpp`. Entity 0 is the encounter itself ("Console"),
 * which sources permanent effects such as a golem's preloaded conditions.
 * Each actor then registers recipes before its own build items, in the
 * reference order: counters, permanent effects, permanent unique effects,
 * skills, and conditional skill groups. A skill's child skills must already be
 * registered, because registration resolves them by key.
 */
import {
  CONSOLE_ENTITY,
  PERMANENT_DURATION,
  addConditionalSkillGroupToActor,
  addEffectToActor,
  addSkillToActor,
  addUniqueEffectToActor
} from '#gw2/platform/combat-engine/mutations.js';
import { DEFAULT_ATTRIBUTES } from '#gw2/platform/combat-engine/configuration.js';
import { createEntity, createRotationComponent, entityName } from '#gw2/platform/combat-engine/registry.js';
import type { Recipe } from '#gw2/platform/combat-engine/configuration.js';
import type { Entity, Registry } from '#gw2/platform/combat-engine/registry.js';

export class DuplicateCounterError extends Error {
  readonly code = 'configuration.duplicate-counter';
}

function addRecipeItems(registry: Registry, recipe: Recipe, actorEntity: Entity): void {
  for (const counter of recipe.counters) {
    registry.isCounter.forEach((_, existing) => {
      if (existing.configuration.counterKey === counter.counterKey) {
        throw new DuplicateCounterError('multiple counters with the same name are not allowed');
      }
    });

    const counterEntity = createEntity(registry);
    registry.owner.emplace(counterEntity, actorEntity);
    registry.isCounter.emplace(counterEntity, { value: counter.initialValue, configuration: counter });
    const holder = createEntity(registry, 'counter modifier holder entity');
    registry.owner.emplace(holder, actorEntity);
    registry.isCounterModifier.emplace(holder, counter.counterModifiers);
  }

  for (const effect of recipe.permanentEffects) {
    addEffectToActor(registry, effect, actorEntity, CONSOLE_ENTITY, '', PERMANENT_DURATION, 1);
  }

  for (const uniqueEffect of recipe.permanentUniqueEffects) {
    addUniqueEffectToActor(registry, uniqueEffect, actorEntity, CONSOLE_ENTITY, '', PERMANENT_DURATION);
  }

  for (const skill of recipe.skills) addSkillToActor(registry, skill, actorEntity);
  for (const group of recipe.conditionalSkillGroups) addConditionalSkillGroupToActor(registry, group, actorEntity);
}

function recordCreated(registry: Registry, actorEntity: Entity): void {
  // Setup records creation unconditionally, independent of the audit configuration.
  if (registry.detailed) {
    registry.auditEvents.push({
      timeMs: registry.tick,
      actor: entityName(registry, actorEntity),
      type: 'actor_created'
    });
  }
}

export function setupEncounter(registry: Registry): void {
  const encounterEntity = createEntity(registry, 'Console');
  if (encounterEntity !== CONSOLE_ENTITY) throw new Error('The encounter entity must be created first.');
  registry.isActor.emplace(encounterEntity, true);
  registry.staticAttributes.emplace(encounterEntity, DEFAULT_ATTRIBUTES);
  recordCreated(registry, encounterEntity);

  for (const actor of registry.encounter.actors) {
    const { build } = actor;
    const actorEntity = createEntity(registry, actor.name);
    registry.isActor.emplace(actorEntity, true);
    registry.team.emplace(actorEntity, actor.team);
    registry.baseClass.emplace(actorEntity, build.baseClass);
    registry.profession.emplace(actorEntity, build.profession);
    registry.currentWeaponSet.emplace(actorEntity, build.initialWeaponSet);
    registry.staticAttributes.emplace(actorEntity, build.attributes);
    registry.equippedWeapons.emplace(
      actorEntity,
      build.weapons.map((weapon) => ({ type: weapon.type, position: weapon.position, set: weapon.set }))
    );

    for (const recipe of build.recipes) addRecipeItems(registry, recipe, actorEntity);
    addRecipeItems(registry, build, actorEntity);
    registry.whirlFinisherSkills.emplace(
      actorEntity,
      new Map(
        [...build.recipes, build].flatMap((recipe) =>
          recipe.whirlFinisherSkills.map((entry) => [entry.comboField, entry.skillKey] as const)
        )
      )
    );

    if (actor.rotation.skillCasts.length > 0) {
      registry.rotation.emplace(actorEntity, createRotationComponent(actor.rotation));
    }

    recordCreated(registry, actorEntity);
  }
}
