import { hasTrait } from '#gw2/platform/builds/selected-traits.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import { denySkillCast } from '#gw2/platform/execution/availability.js';
import type { MechanicQueriesOf } from '#gw2/platform/profession-definition/mechanic-context.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import type { NecromancerRuntime, NecromancerSkill } from '#gw2/professions/necromancer/types.js';

/** Select Curses skill replacements and added self-conditions before shared skill execution. */

/** Resolves the scepter trait replacement before other Core availability gates. */
export function lingeringCurseAvailability(runtime: MechanicQueriesOf<NecromancerRuntime>, skill: NecromancerSkill) {
  if (skill.id === ID.DEVOURING_DARKNESS && !hasTrait(runtime, TRAIT.LINGERING_CURSE))
    return denySkillCast(skill, 'necromancer.trait-locked', 'requires Lingering Curse.');
  if (skill.id === ID.FEAST_OF_CORRUPTION && hasTrait(runtime, TRAIT.LINGERING_CURSE))
    return denySkillCast(
      skill,
      'necromancer.trait-replacement',
      'Devouring Darkness replaces it while Lingering Curse is selected.'
    );
  return undefined;
}

/** Additional self-condition for this Corruption skill; the materializer retains the skill's delivery timing. */
export const masterOfCorruptionBloodIsPower: SkillEffect = {
  name: 'Self Torment',
  type: 'condition',
  condition: 'Torment',
  stacks: 2,
  duration: 10,
  target: 'self',
  requiredTrait: TRAIT.MASTER_OF_CORRUPTION,
  packetLabel: 'additional with Master of Corruption'
};

/** Additional self-condition for this Corruption skill; the materializer retains the skill's delivery timing. */
export const masterOfCorruptionConsumeConditions: SkillEffect = {
  name: 'Master of Corruption Vulnerability',
  type: 'condition',
  condition: 'Vulnerability',
  stacks: 5,
  duration: 4,
  target: 'self',
  requiredTrait: TRAIT.MASTER_OF_CORRUPTION,
  packetLabel: 'additional with Master of Corruption'
};

/** Additional self-condition for this Corruption skill; the materializer retains the skill's delivery timing. */
export const masterOfCorruptionPlaguelands: SkillEffect = {
  name: 'Self Poisoned',
  type: 'condition',
  condition: 'Poisoned',
  stacks: 1,
  duration: 4,
  target: 'self',
  requiredTrait: TRAIT.MASTER_OF_CORRUPTION,
  packetLabel: 'additional with Master of Corruption'
};

/** Additional self-condition for this Corruption skill; the materializer retains the skill's delivery timing. */
export const masterOfCorruptionCorrosivePoisonCloud: SkillEffect = {
  name: 'Self Crippled',
  type: 'condition',
  condition: 'Crippled',
  stacks: 1,
  duration: 2,
  target: 'self',
  requiredTrait: TRAIT.MASTER_OF_CORRUPTION,
  packetLabel: 'additional with Master of Corruption'
};
