import { selectedSkillIdSet } from '#gw2/platform/builds/selected-skills.js';
import type { AvailabilityResult } from '#gw2/platform/execution/availability.js';
import { denySkillCast as denyEngineerCast } from '#gw2/platform/execution/availability.js';
import { skillFlipReady } from '#gw2/platform/execution/skill-flips.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { engineerKitAvailability } from '#gw2/professions/engineer/core/mechanics/kits.js';
import { engineerSpearAvailability } from '#gw2/professions/engineer/core/mechanics/spear.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import type { EngineerRuntime, EngineerSkill } from '#gw2/professions/engineer/types.js';

/** Enforces Core Engineer resource, kit, flip, and toolbelt prerequisites after shared build eligibility. */
export function engineerCoreCastAvailability(
  context: MechanicQueriesOf<EngineerRuntime>,
  skill: EngineerSkill
): AvailabilityResult {
  const spear = engineerSpearAvailability(context, skill);

  if (!spear.ready) return spear;

  const kit = engineerKitAvailability(context, skill);

  if (!kit.ready) return kit;

  // Rocket Burst replaces the ordinary rifle attack until used or expired.
  if (skill.id === ID.RIFLE_BURST && skillFlipReady(context.flips[ID.ROCKET_BURST], context.time)) {
    return denyEngineerCast(skill, 'engineer.rocket-burst-ready', 'use Rocket Burst while its window is active.');
  }

  if (
    skill.requiresArmedFlip &&
    // The parent's handler opens the shared window; absence means the follow-up is not armed.
    !skillFlipReady(context.flips[skill.id], context.time)
  ) {
    const prerequisite =
      skill.id === ID.ROCKET_BURST
        ? 'Net Shot or Overcharged Shot'
        : (skill.flipParentId == null ? undefined : context.helpers.skillsById.get(skill.flipParentId)?.name) ||
          'its parent skill';
    return denyEngineerCast(skill, 'engineer.flip-inactive', `use ${prerequisite} first.`);
  }

  // Parent relationships use IDs; the selected loadout preserves canonical identity.
  const parent = skill.toolbeltParentId == null ? undefined : context.helpers.skillsById.get(skill.toolbeltParentId);

  if (
    context.config.selectedSkillIds !== undefined &&
    skill.toolbeltParentId &&
    skill.countsAsToolbeltSkill !== false &&
    (!parent || !selectedSkillIdSet(context.config.selectedSkillIds).has(parent.id))
  ) {
    return denyEngineerCast(skill, 'engineer.toolbelt-parent', `${parent?.name ?? 'Parent skill'} is not equipped.`);
  }

  return { ready: true };
}
