/**
 * Stage hooks that fire side effects outside strikes and effect application.
 *
 * Ports the ammo-gain, begun-casting, and every-tick hooks from
 * `system/hooks.cpp`. Each hook passes a stage-specific condition predicate to
 * the shared side-effect dispatcher, so only side effects authored for that
 * stage (or stage-independent ones, for the every-tick hook) can fire.
 */
import { applySideEffects } from '#gw2/platform/combat-engine/mutations.js';
import {
  independentConditionsSatisfied,
  onAmmoGainConditionsSatisfied,
  onBegunCastingConditionsSatisfied
} from '#gw2/platform/combat-engine/queries.js';
import { ownerOf, view } from '#gw2/platform/combat-engine/registry.js';
import type { Registry } from '#gw2/platform/combat-engine/registry.js';

export function onAmmoGainedHooks(registry: Registry): void {
  view([registry.isSkill, registry.ammoGained]).forEach((skillEntity) => {
    const skill = registry.isSkill.get(skillEntity);
    const actorEntity = ownerOf(registry, skillEntity);
    applySideEffects(registry, actorEntity, (condition) =>
      onAmmoGainConditionsSatisfied(registry, condition, actorEntity, skill)
    );
  });
}

export function onBegunCastingSkillsHooks(registry: Registry): void {
  registry.begunCastingSkills.forEach((actorEntity, skillEntities) => {
    for (const skillEntity of skillEntities) {
      const skill = registry.isSkill.get(skillEntity);
      applySideEffects(registry, actorEntity, (condition) =>
        onBegunCastingConditionsSatisfied(registry, condition, actorEntity, skill)
      );
    }
  });
}

/** Stage-independent side effects are re-evaluated for every root actor on every tick. */
export function onEveryTickHooks(registry: Registry): void {
  view([registry.isActor], [registry.owner]).forEach((actorEntity) => {
    applySideEffects(
      registry,
      actorEntity,
      (condition) => independentConditionsSatisfied(registry, condition, actorEntity, null).satisfied,
      true
    );
  });
}
