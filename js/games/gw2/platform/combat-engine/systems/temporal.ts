/**
 * Time progression: cast animations, recharge, effect lifetimes, and cast completion.
 *
 * Ports `system/temporal.cpp`. Progress is tracked as two counters, one for
 * ticks spent without quickness/alacrity and one with, and an action completes
 * when the two integer percentages sum to 100. Cast completion applies bundle
 * and weapon-set changes, fires on-finished-casting side effects, and spawns
 * the skill's child skills.
 */
import { intDivide } from '#gw2/platform/combat-engine/numeric.js';
import { applySideEffects, enqueueChildSkills, finishCastingSkill } from '#gw2/platform/combat-engine/mutations.js';
import { onFinishedCastingConditionsSatisfied } from '#gw2/platform/combat-engine/queries.js';
import { ownerOf, view } from '#gw2/platform/combat-engine/registry.js';
import type { Registry } from '#gw2/platform/combat-engine/registry.js';

export class BundleStateError extends Error {
  readonly code = 'engine.bundle-state';
}

/** Returns true when any animation advanced or any finished cast was processed, so the pass repeats. */
export function progressAnimations(registry: Registry): boolean {
  let progressed = false;
  view([registry.animation], [registry.alreadyPerformedAnimation]).forEach((entity) => {
    const animation = registry.animation.get(entity);
    registry.alreadyPerformedAnimation.emplace(entity, true);
    progressed = true;
    if (animation.duration[0] === 0) {
      registry.animationExpired.emplaceOrReplace(entity, true);
      finishCastingSkill(registry, animation.skillEntity, entity);
      return;
    }

    const quickened = registry.hasQuickness.has(ownerOf(registry, entity));
    animation.progress[0] += quickened ? 0 : registry.stepMs;
    animation.progress[1] += quickened ? registry.stepMs : 0;
    const percent =
      intDivide(animation.progress[0] * 100, animation.duration[0]) +
      intDivide(animation.progress[1] * 100, animation.duration[1]);
    if (percent >= 100) {
      registry.animationExpired.emplaceOrReplace(entity, true);
      finishCastingSkill(registry, animation.skillEntity, entity);
    }
  });

  registry.finishedCastingSkills.forEach((actorEntity, skillEntities) => {
    for (const skillEntity of skillEntities) {
      if (registry.alreadyFinishedCastingSkill.has(skillEntity)) continue;
      progressed = true;
      registry.alreadyFinishedCastingSkill.emplace(skillEntity, true);
      const skill = registry.isSkill.get(skillEntity);
      applyCastCompletionEquipment(registry, actorEntity, skill.weaponSwap, skill.equipBundle, skill.dropBundle);
      applySideEffects(registry, actorEntity, (condition) =>
        onFinishedCastingConditionsSatisfied(registry, condition, actorEntity, skill)
      );
      enqueueChildSkills(registry, actorEntity, `Temporary ${skill.skillKey} Entity`, skill.childSkillKeys);
    }
  });

  return progressed;
}

/** Equipping or dropping a bundle, or swapping weapon sets, happens when the cast completes. */
function applyCastCompletionEquipment(
  registry: Registry,
  actorEntity: number,
  weaponSwap: boolean,
  equipBundle: string,
  dropBundle: string
): void {
  if (equipBundle !== '') {
    registry.bundle.emplace(actorEntity, equipBundle);
    registry.equippedBundle.emplaceOrReplace(actorEntity, equipBundle);
    return;
  }

  if (dropBundle !== '') {
    const bundle = registry.bundle.tryGet(actorEntity);
    if (bundle === undefined) throw new BundleStateError('no bundle on entity');
    if (bundle !== '*' && bundle !== dropBundle) {
      throw new BundleStateError(`Tried to drop ${dropBundle} but ${bundle} equipped`);
    }

    registry.droppedBundle.emplaceOrReplace(actorEntity, bundle);
    registry.bundle.remove(actorEntity);
    return;
  }

  if (!weaponSwap) return;
  const bundle = registry.bundle.tryGet(actorEntity);
  if (bundle !== undefined) {
    // Weapon swap while holding a bundle only drops the bundle.
    registry.droppedBundle.emplaceOrReplace(actorEntity, bundle);
    registry.bundle.remove(actorEntity);
    return;
  }

  if (!registry.currentWeaponSet.has(actorEntity)) throw new BundleStateError('no equipped_weapon_set on entity');
  if (registry.equippedWeapons.get(actorEntity).length === 1) {
    throw new BundleStateError('cannot weapon swap when there is only 1 weapon set equipped');
  }

  const current = registry.currentWeaponSet.get(actorEntity);
  registry.currentWeaponSet.emplaceOrReplace(actorEntity, current === 'set_1' ? 'set_2' : 'set_1');
}

/** Recharge progress; alacrity ticks count toward the accelerated duration. Ammo skills recharge one charge at a time. */
export function progressCooldowns(registry: Registry): void {
  registry.cooldown.forEach((entity, cooldown) => {
    if (cooldown.duration[0] === 0) {
      const ammo = registry.ammo.tryGet(entity);
      if (ammo) {
        ammo.currentAmmo = ammo.maxAmmo;
        registry.ammoGained.emplace(entity, true);
      }

      registry.cooldownExpired.emplace(entity, true);
      return;
    }

    const accelerated = registry.hasAlacrity.has(ownerOf(registry, entity));
    cooldown.progress[0] += accelerated ? 0 : registry.stepMs;
    cooldown.progress[1] += accelerated ? registry.stepMs : 0;
    const percent =
      intDivide(cooldown.progress[0] * 100, cooldown.duration[0]) +
      intDivide(cooldown.progress[1] * 100, cooldown.duration[1]);
    if (percent < 100) return;

    const ammo = registry.ammo.tryGet(entity);
    if (!ammo) {
      registry.cooldownExpired.emplace(entity, true);
      return;
    }

    ammo.currentAmmo += 1;
    registry.ammoGained.emplace(entity, true);
    if (ammo.currentAmmo === ammo.maxAmmo) registry.cooldownExpired.emplace(entity, true);
    else cooldown.progress = [0, 0];
  });
}

export function progressDurations(registry: Registry): void {
  registry.duration.forEach((entity, duration) => {
    duration.progress += registry.stepMs;
    if (duration.progress >= duration.duration) registry.durationExpired.emplace(entity, true);
  });
}

export function progressCastingSkillTicks(registry: Registry): void {
  registry.skillsTicksTracker.forEach((_, states) => {
    for (const state of states) state.skillTickProgress += registry.stepMs;
  });
}

/** Skill actions advance on the quickness track only when the casting entity itself has quickness. */
export function progressCastingSkills(registry: Registry): void {
  view([registry.skillsActions], [registry.hasQuickness]).forEach((entity) => {
    for (const state of registry.skillsActions.get(entity)) state.actionProgress[0] += registry.stepMs;
  });
  view([registry.skillsActions, registry.hasQuickness]).forEach((entity) => {
    for (const state of registry.skillsActions.get(entity)) state.actionProgress[1] += registry.stepMs;
  });
}

/** Removes finished animations and recharges, and marks expired effects for destruction. */
export function cleanupExpiredComponents(registry: Registry): void {
  registry.animationExpired.forEach((entity) => registry.animation.remove(entity));
  registry.cooldownExpired.forEach((entity) => registry.cooldown.remove(entity));
  registry.durationExpired.forEach((entity) => {
    const effect = registry.isEffect.tryGet(entity);
    if (effect?.effect === 'QUICKNESS') registry.hasQuickness.remove(ownerOf(registry, entity));
    else if (effect?.effect === 'ALACRITY') registry.hasAlacrity.remove(ownerOf(registry, entity));
    registry.destroyEntity.emplaceOrReplace(entity, true);
  });
}
