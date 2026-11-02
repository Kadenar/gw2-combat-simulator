import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { TRAIT_LINES } from '#gw2/professions/necromancer/data/trait-lines.js';
import { RITUALIST_SKILL_FIELDS } from '#gw2/professions/necromancer/specializations/ritualist/catalog-fields.js';
import { ritualistHooks } from '#gw2/professions/necromancer/specializations/ritualist/hooks.js';
import { bindRitualistUi } from '#gw2/professions/necromancer/specializations/ritualist/presentation.js';
import {
  anguishConditionModifier,
  essenceBlastSpiritModifier,
  RITUALIST_SKILLS
} from '#gw2/professions/necromancer/specializations/ritualist/skills/index.js';
import { NECROMANCER_RITUALIST_SKILL_FLIPS } from '#gw2/professions/necromancer/specializations/ritualist/skills/skill-flips.js';
import { projectRitualistState, ritualistState } from '#gw2/professions/necromancer/specializations/ritualist/state.js';
import { necromancerRitualistTraits } from '#gw2/professions/necromancer/specializations/ritualist/traits/index.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

export const ritualistModule = defineNativeModule({
  traitDefinitions: necromancerRitualistTraits,
  id: 'Ritualist',
  data: createNativeModuleData<NecromancerSkill>({
    id: 'Ritualist',
    traitLines: TRAIT_LINES,
    skillFlips: NECROMANCER_RITUALIST_SKILL_FLIPS,

    skillFields: RITUALIST_SKILL_FIELDS,
    skills: RITUALIST_SKILLS
  }),
  // One state factory supplies the live combat owner.
  state: { create: ritualistState.create, project: projectRitualistState },
  hooks: ritualistHooks,
  // Retain the skill rules' established order relative to registered trait modifiers.
  modifiers: [
    { ...essenceBlastSpiritModifier, order: 0 },
    { ...anguishConditionModifier, order: 2 }
  ],
  presentation: bindRitualistUi
});
