import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { TRAIT_LINES } from '#gw2/professions/thief/data/trait-lines.js';
import {
  ANTIQUARY_SKILL_FIELDS,
  THIEF_ANTIQUARY_PROFILE_FIELDS
} from '#gw2/professions/thief/specializations/antiquary/catalog-fields.js';
import { antiquaryHooks } from '#gw2/professions/thief/specializations/antiquary/hooks.js';
import { antiquaryUi } from '#gw2/professions/thief/specializations/antiquary/presentation.js';
import { kryptisTurretModifiers } from '#gw2/professions/thief/specializations/antiquary/skills/artifact-actions.js';
import { ANTIQUARY_GUILD_ATTACK_SKILLS } from '#gw2/professions/thief/specializations/antiquary/skills/guild-attacks.js';
import { ANTIQUARY_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/antiquary/skills/index.js';
import { THIEF_ANTIQUARY_SKILL_FLIPS } from '#gw2/professions/thief/specializations/antiquary/skills/skill-flips.js';
import {
  antiquaryState,
  projectAntiquaryPlanningState
} from '#gw2/professions/thief/specializations/antiquary/state.js';
import { antiquaryTraits } from '#gw2/professions/thief/specializations/antiquary/traits/index.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

export const antiquaryModule = defineNativeModule({
  traitDefinitions: antiquaryTraits,
  id: 'Antiquary',
  data: createNativeModuleData<ThiefSkill>({
    id: 'Antiquary',
    traitLines: TRAIT_LINES,
    skillFlips: THIEF_ANTIQUARY_SKILL_FLIPS,
    profileFields: THIEF_ANTIQUARY_PROFILE_FIELDS,
    extraSkills: ANTIQUARY_GUILD_ATTACK_SKILLS,
    skillFields: ANTIQUARY_SKILL_FIELDS,
    skillMechanics: ANTIQUARY_SKILL_MECHANICS
  }),
  state: { create: antiquaryState.create, project: projectAntiquaryPlanningState },
  // Register the skill/mechanic-owned rules alongside trait declarations.
  modifiers: kryptisTurretModifiers,
  hooks: antiquaryHooks,
  presentation: antiquaryUi
});
