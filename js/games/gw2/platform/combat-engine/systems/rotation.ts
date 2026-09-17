/**
 * Rotation execution: turns queued and scheduled casts into active skills.
 *
 * Ports `system/rotation.cpp`. Each actor may start at most one cast per pass;
 * the loop re-runs this system with animation progress until neither makes
 * progress, so chains of instant casts resolve within one tick. A rotation
 * entry that is due but cannot be cast is a hard failure rather than a skipped
 * command, matching the reference.
 */
import { cancelSkill, finishCastingSkill } from '#gw2/platform/combat-engine/mutations.js';
import { canCastSkill, getSkillEntity, weaponStrength } from '#gw2/platform/combat-engine/queries.js';
import { entityName, view } from '#gw2/platform/combat-engine/registry.js';
import type { Registry } from '#gw2/platform/combat-engine/registry.js';

export class RotationCastError extends Error {
  readonly code = 'rotation.cannot-cast';
  readonly tick: number;

  constructor(message: string, tick: number) {
    super(message);
    this.tick = tick;
  }
}

/** Returns true when any actor started a cast, so the caller repeats the pass. */
export function performRotations(registry: Registry): boolean {
  let performed = false;
  view([registry.rotation], [registry.noMoreRotation]).forEach((entity) => {
    const rotation = registry.rotation.get(entity);
    const alreadyPerformed = registry.alreadyPerformedRotation.has(entity);
    if (!alreadyPerformed) registry.alreadyPerformedRotation.emplace(entity, true);
    const hasQueued = rotation.queuedRotation.length > 0;
    // Scheduled casts start once per tick; queued trigger casts may keep chaining.
    if (!hasQueued && alreadyPerformed) return;

    const tick = registry.tick;
    if (rotation.currentIndex >= rotation.rotation.skillCasts.length && !hasQueued) {
      if (rotation.repeat) {
        rotation.currentIndex = 0;
        rotation.tickOffset = tick;
      } else {
        registry.noMoreRotation.emplace(entity, true);
        return;
      }
    }

    const next = hasQueued ? rotation.queuedRotation[0] : rotation.rotation.skillCasts[rotation.currentIndex];
    if (tick < next.castTimeMs + rotation.tickOffset) return;

    const skillEntity = getSkillEntity(registry, next.skill, entity);
    const skill = registry.isSkill.get(skillEntity);
    const isInstant = skill.castDuration[0] === 0;
    if ((!isInstant || skill.instantCastOnlyWhenNotInAnimation) && registry.animation.has(entity)) return;
    if (!registry.encounter.requireAfkSkills) {
      // Without explicit AFK entries, a cast waits for ammo instead of failing.
      if (registry.ammo.get(skillEntity).currentAmmo <= 0 && !(skill.weaponSwap && registry.bundle.has(entity))) {
        return;
      }
    }

    performed = true;
    const castability = canCastSkill(registry, skillEntity);
    if (!castability.canCast) {
      throw new RotationCastError(
        `[${tick}] ${entityName(registry, entity)}: cannot cast skill ${skill.skillKey}. Reason: ${castability.reason}`,
        tick
      );
    }

    for (const skillToCancel of skill.skillsToCancel) cancelSkill(registry, entity, skillToCancel);

    // One roll per cast is shared by every legacy strike and by skill ticks in roll group 0.
    const hasStrikes =
      skill.skillTicks.some((skillTick) => skillTick.strike) ||
      skill.strikeOnTickList[0].length > 0 ||
      skill.strikeOnTickList[1].length > 0;
    const roll = hasStrikes ? weaponStrength(registry, entity, skill.weaponType) : 0;

    registry.skillsTicksTracker
      .getOrEmplace(entity, () => [])
      .push({
        skillEntity,
        skillTickProgress: 0,
        nextSkillTickIndex: 0,
        weaponStrengthRollByGroup: new Map([[0, roll]])
      });
    registry.skillsActions
      .getOrEmplace(entity, () => [])
      .push({
        skillEntity,
        actionProgress: [0, 0],
        nextStrikeIndex: 0,
        nextPulseIndex: 0,
        nextWhirlIndex: 0,
        weaponStrengthRoll: roll
      });
    registry.begunCastingSkills.getOrEmplace(entity, () => []).push(skillEntity);

    if (hasQueued) rotation.queuedRotation.shift();
    else rotation.currentIndex += 1;

    if (isInstant) {
      finishCastingSkill(registry, skillEntity, entity);
    } else {
      registry.animation.emplace(entity, { skillEntity, duration: skill.castDuration, progress: [0, 0] });
    }
  });

  return performed;
}

/** Temporary child actors are destroyed once their queue and every active skill have finished. */
export function destroyActorsWithNoRotation(registry: Registry): void {
  view(
    [registry.destroyAfterRotation, registry.noMoreRotation],
    [
      registry.skillsTicksTracker,
      registry.skillsActions,
      registry.destroySkillsTicksTracker,
      registry.finishedSkillsActions
    ]
  ).forEach((entity) => {
    registry.destroyEntity.emplaceOrReplace(entity, true);
  });
}
