/**
 * Active-skill execution: timed skill ticks and legacy strike/pulse lists.
 *
 * Ports `system/skill.cpp`. Skill ticks advance one millisecond per tick from
 * the cast start regardless of quickness. The legacy `*_on_tick_list` actions
 * instead track cast progress on both quickness tracks and fire when the
 * combined percentage passes each listed offset. Both paths only enqueue
 * outgoing strikes and effects; damage and application happen later in the tick.
 */
import { roundDown } from '#gw2/platform/combat-engine/numeric.js';
import { ownerOf } from '#gw2/platform/combat-engine/registry.js';
import {
  cancelSkill,
  enqueueChildSkill,
  enqueueChildSkills,
  putSkillOnCooldown
} from '#gw2/platform/combat-engine/mutations.js';
import { getSkillEntity, independentConditionsSatisfied, weaponStrength } from '#gw2/platform/combat-engine/queries.js';
import type { EffectApplication, Skill } from '#gw2/platform/combat-engine/configuration.js';
import type {
  Entity,
  PendingEffectApplication,
  Registry,
  SkillActionState
} from '#gw2/platform/combat-engine/registry.js';

/** Stamps configured applications with the skill that emits them. */
export function pendingApplications(
  applications: readonly EffectApplication[],
  sourceSkill: string
): PendingEffectApplication[] {
  return applications.map((application) => ({ ...application, sourceSkill }));
}

/**
 * Whirl combo: the finisher resolves against the combo field that has been
 * active longest across every actor (as upstream scans all active skills), and
 * spawns the skill the finisher owner's content maps to that field, if any.
 */
function triggerWhirlFinisher(registry: Registry, entity: Entity): void {
  let earliestField: Skill['comboField'] = null;
  let mostTicks = 0;
  registry.skillsActions.forEach((_, states) => {
    for (const state of states) {
      const field = registry.isSkill.get(state.skillEntity).comboField;
      if (field == null) continue;
      const ticks = state.actionProgress[0] + state.actionProgress[1];
      if (ticks > mostTicks) {
        mostTicks = ticks;
        earliestField = field;
      }
    }
  });

  if (earliestField == null) return;
  const skillKey = registry.whirlFinisherSkills.tryGet(ownerOf(registry, entity))?.get(earliestField);
  if (skillKey !== undefined) enqueueChildSkill(registry, skillKey, entity);
}

export function performSkillTicks(registry: Registry): void {
  registry.skillsTicksTracker.forEach((entity, states) => {
    for (const state of states) {
      const skill = registry.isSkill.get(state.skillEntity);
      if (state.nextSkillTickIndex >= skill.skillTicks.length) {
        registry.destroySkillsTicksTracker.getOrEmplace(entity, () => []).push(state.skillEntity);
        continue;
      }

      while (
        state.nextSkillTickIndex < skill.skillTicks.length &&
        state.skillTickProgress >= skill.skillTicks[state.nextSkillTickIndex].onTick
      ) {
        const skillTick = skill.skillTicks[state.nextSkillTickIndex];
        if (!independentConditionsSatisfied(registry, skillTick.tickCondition, entity, null).satisfied) {
          state.nextSkillTickIndex += 1;
          continue;
        }

        if (skillTick.strike) {
          const outgoing = registry.outgoingStrikes.getOrEmplace(entity, () => []);
          const type = skillTick.weaponType ?? skill.weaponType;
          // Each roll group draws once per cast so grouped hits share a weapon strength.
          if (!state.weaponStrengthRollByGroup.has(skillTick.weaponStrengthRollGroup)) {
            state.weaponStrengthRollByGroup.set(
              skillTick.weaponStrengthRollGroup,
              weaponStrength(registry, entity, type)
            );
          }

          outgoing.push({
            skillEntity: state.skillEntity,
            numTargets: skillTick.numTargets,
            flatDamage: skillTick.flatDamage,
            weaponStrength: state.weaponStrengthRollByGroup.get(skillTick.weaponStrengthRollGroup) ?? 0,
            damageCoefficient: skillTick.damageCoefficient,
            canCriticalStrike: skillTick.canCriticalStrike,
            onStrikeEffectApplications: skillTick.onStrikeEffectApplications,
            tags: skillTick.inheritTags ? skill.tags : skillTick.tags
          });
        }

        if (skillTick.pulse) {
          registry.outgoingEffects
            .getOrEmplace(entity, () => [])
            .push(...pendingApplications(skillTick.onPulseEffectApplications, skill.skillKey));
        }

        if (skillTick.whirlFinisher) triggerWhirlFinisher(registry, entity);

        for (const linked of skillTick.skillsToPutOnCooldown) {
          putSkillOnCooldown(registry, getSkillEntity(registry, linked, entity), true);
        }

        for (const skillToCancel of skillTick.skillsToCancel) cancelSkill(registry, entity, skillToCancel);
        enqueueChildSkills(registry, entity, `Temporary ${skill.skillKey} Entity`, skillTick.childSkillKeys);
        state.nextSkillTickIndex += 1;
      }

      if (state.nextSkillTickIndex >= skill.skillTicks.length) {
        registry.destroySkillsTicksTracker.getOrEmplace(entity, () => []).push(state.skillEntity);
      }
    }
  });
}

/**
 * Converts dual-track progress into an effective millisecond offset on the
 * unaccelerated timeline. The span covers the whole cast even when the last
 * listed action is earlier, so quickness compresses every offset uniformly.
 */
function effectiveProgress(
  state: SkillActionState,
  lists: readonly [readonly number[], readonly number[]],
  castDuration: readonly [number, number]
): { readonly tick: number; readonly percent: number } {
  const normalSpan = Math.max(lists[0].length === 0 ? 0 : lists[0][lists[0].length - 1], castDuration[0]);
  const quickSpan = Math.max(lists[1].length === 0 ? 0 : lists[1][lists[1].length - 1], castDuration[1]);
  const normalPercent = normalSpan === 0 ? 100 : (state.actionProgress[0] * 100) / normalSpan;
  const quickPercent = quickSpan === 0 ? 100 : (state.actionProgress[1] * 100) / quickSpan;
  const percent = normalPercent + quickPercent;
  return { tick: roundDown((normalSpan * percent) / 100), percent };
}

export function performSkills(registry: Registry): void {
  registry.skillsActions.forEach((entity, states) => {
    for (const state of states) {
      const skill = registry.isSkill.get(state.skillEntity);

      const pulse = effectiveProgress(state, skill.pulseOnTickList, skill.castDuration);
      while (
        state.nextPulseIndex < skill.pulseOnTickList[0].length &&
        pulse.tick >= skill.pulseOnTickList[0][state.nextPulseIndex]
      ) {
        registry.outgoingEffects
          .getOrEmplace(entity, () => [])
          .push(...pendingApplications(skill.onPulseEffectApplications, skill.skillKey));
        state.nextPulseIndex += 1;
      }

      const strike = effectiveProgress(state, skill.strikeOnTickList, skill.castDuration);
      while (
        state.nextStrikeIndex < skill.strikeOnTickList[0].length &&
        strike.tick >= skill.strikeOnTickList[0][state.nextStrikeIndex]
      ) {
        registry.outgoingStrikes
          .getOrEmplace(entity, () => [])
          .push({
            skillEntity: state.skillEntity,
            numTargets: skill.numTargets,
            flatDamage: skill.flatDamage,
            weaponStrength: state.weaponStrengthRoll,
            damageCoefficient: skill.damageCoefficient,
            canCriticalStrike: skill.canCriticalStrike,
            onStrikeEffectApplications: skill.onStrikeEffectApplications,
            tags: skill.tags
          });
        state.nextStrikeIndex += 1;
      }

      const whirl = effectiveProgress(state, skill.whirlFinisherOnTickList, skill.castDuration);
      while (
        state.nextWhirlIndex < skill.whirlFinisherOnTickList[0].length &&
        whirl.tick >= skill.whirlFinisherOnTickList[0][state.nextWhirlIndex]
      ) {
        triggerWhirlFinisher(registry, entity);
        state.nextWhirlIndex += 1;
      }

      if (strike.percent >= 100 && pulse.percent >= 100 && whirl.percent >= 100) {
        registry.finishedSkillsActions.getOrEmplace(entity, () => []).push(state.skillEntity);
      }
    }
  });
}

/** Drops finished skill-tick trackers after the tick's audit has observed them. */
export function cleanupSkillTicksTracker(registry: Registry): void {
  registry.destroySkillsTicksTracker.forEach((entity, finished) => {
    const states = registry.skillsTicksTracker.tryGet(entity);
    if (!states) return;
    for (const skillEntity of finished) {
      const index = states.findIndex((state) => state.skillEntity === skillEntity);
      if (index !== -1) states.splice(index, 1);
    }

    if (states.length === 0) registry.skillsTicksTracker.remove(entity);
    registry.destroySkillsTicksTracker.remove(entity);
  });
}

export function cleanupSkillActions(registry: Registry): void {
  registry.finishedSkillsActions.forEach((entity, finished) => {
    const states = registry.skillsActions.tryGet(entity);
    if (!states) return;
    for (const skillEntity of finished) {
      const index = states.findIndex((state) => state.skillEntity === skillEntity);
      if (index !== -1) states.splice(index, 1);
    }

    if (states.length === 0) registry.skillsActions.remove(entity);
    registry.finishedSkillsActions.remove(entity);
  });
}
