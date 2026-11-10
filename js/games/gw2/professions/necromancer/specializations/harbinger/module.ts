import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { TRAIT_LINES } from '#gw2/professions/necromancer/data/trait-lines.js';
import {
  HARBINGER_SKILL_FIELDS,
  NECROMANCER_HARBINGER_PROFILE_FIELDS
} from '#gw2/professions/necromancer/specializations/harbinger/catalog-fields.js';
import { harbingerHooks } from '#gw2/professions/necromancer/specializations/harbinger/hooks.js';
import { bindHarbingerUi } from '#gw2/professions/necromancer/specializations/harbinger/presentation.js';
import { HARBINGER_BASE_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/harbinger/skills/index.js';
import { NECROMANCER_HARBINGER_SKILL_FLIPS } from '#gw2/professions/necromancer/specializations/harbinger/skills/skill-flips.js';
import {
  harbingerState,
  projectHarbingerPlanningState
} from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import { necromancerHarbingerTraits } from '#gw2/professions/necromancer/specializations/harbinger/traits/index.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

export const harbingerModule = defineNativeModule({
  id: 'Harbinger',
  data: createNativeModuleData<NecromancerSkill>({
    id: 'Harbinger',
    traitLines: TRAIT_LINES,
    skillFlips: NECROMANCER_HARBINGER_SKILL_FLIPS,
    profileFields: NECROMANCER_HARBINGER_PROFILE_FIELDS,
    skillFields: HARBINGER_SKILL_FIELDS,
    skills: materializeSkillDefinitions(HARBINGER_BASE_SKILL_MECHANICS)
  }),
  // One state factory supplies the live combat owner.
  state: { create: harbingerState.create, project: projectHarbingerPlanningState },
  traitDefinitions: necromancerHarbingerTraits,
  hooks: harbingerHooks,
  presentation: bindHarbingerUi
});
