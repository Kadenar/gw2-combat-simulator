import { denySkillCast, type AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { necromancerMinionAvailability } from '#gw2/professions/necromancer/core/mechanics/minions.js';
import { NECROMANCER_LICH_SKILL_IDS } from '#gw2/professions/necromancer/core/skills/index.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Follow-up skills require an armed window; shroud exits and autoattack chains own their own gates. */
function weaponFlipAvailability(
  runtime: MechanicQueriesOf<NecromancerRuntime>,
  skill: NecromancerSkill
): AvailabilityResult | undefined {
  if (
    skill.flipParentId != null &&
    !skill.shroudExit &&
    !runtime.helpers.autoattackChainPositions.has(Number(skill.id)) &&
    !skillFlipReady(runtime.profession.core.availableFlips[skill.id], runtime.time)
  )
    return denySkillCast(skill, 'necromancer.flip-not-armed', 'not currently armed.');

  return undefined;
}

/** Lich owns its replacement bar and bypasses the life-force shroud restrictions. */
function lichAvailability(
  runtime: MechanicQueriesOf<NecromancerRuntime>,
  skill: NecromancerSkill
): AvailabilityResult | undefined {
  if (!NECROMANCER_LICH_SKILL_IDS.includes(skill.id)) return undefined;

  return runtime.profession.core.activeShroud === 'lich'
    ? { ready: true }
    : denySkillCast(skill, 'necromancer.not-in-lich', 'Lich Form is not active.');
}

/** Entry checks mode and specialization before consulting life force, preserving the first denial and retry time. */
function shroudEntryAvailability(
  runtime: MechanicQueriesOf<NecromancerRuntime>,
  skill: NecromancerSkill
): AvailabilityResult | undefined {
  if (!skill.shroudEntry) return undefined;

  const state = runtime.profession.core;

  if (state.activeShroud)
    return denySkillCast(skill, 'necromancer.in-shroud', `already in ${state.activeShroud} shroud.`);

  if ((skill.specialization || 'Core') !== (runtime.config.specialization || 'Core'))
    return denySkillCast(skill, 'necromancer.wrong-specialization', 'requires its matching specialization.');

  const minimum = (state.lifeForce.maximum * (skill.minimumShroudLifeForcePercent ?? 10)) / 100;

  if (runtime.resourceController.value('lifeForce') < minimum)
    return denySkillCast(
      skill,
      'necromancer.insufficient-life-force',
      'requires more life force.',
      runtime.resourceController.readyAt('lifeForce', minimum)
    );

  return { ready: true };
}

/** Exits match the active form; attacks require their shroud or explicit permission to cast inside it. */
function shroudSkillAvailability(
  runtime: MechanicQueriesOf<NecromancerRuntime>,
  skill: NecromancerSkill
): AvailabilityResult {
  const state = runtime.profession.core;

  if (skill.shroudExit) {
    if (state.activeShroud !== skill.shroudExit)
      return denySkillCast(skill, 'necromancer.not-in-shroud', 'the matching shroud is not active.');
  } else if (skill.shroud && state.activeShroud !== skill.shroud)
    return denySkillCast(skill, 'necromancer.wrong-shroud', `requires ${skill.shroud} shroud.`);
  else if (!skill.shroud && state.activeShroud && !skill.usableInShroud)
    return denySkillCast(skill, 'necromancer.in-shroud', 'cannot cast in shroud.');

  return { ready: true };
}

/** Preserve minion, flip, and form precedence, including successful Lich and shroud-entry short circuits. */
export function necromancerAvailability(
  runtime: MechanicQueriesOf<NecromancerRuntime>,
  skill: NecromancerSkill
): AvailabilityResult {
  return (
    necromancerMinionAvailability(runtime, skill) ??
    weaponFlipAvailability(runtime, skill) ??
    lichAvailability(runtime, skill) ??
    shroudEntryAvailability(runtime, skill) ??
    shroudSkillAvailability(runtime, skill)
  );
}
