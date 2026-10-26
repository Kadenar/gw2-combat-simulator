import { SPECTER_GUILD_ATTACK_SKILLS } from '#gw2/professions/thief/specializations/specter/skills/guild-attacks.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { createThiefModuleData } from '#gw2/professions/thief/data/module-data.js';
import { specterHooks } from '#gw2/professions/thief/specializations/specter/hooks.js';
import { specterUi } from '#gw2/professions/thief/specializations/specter/presentation.js';
import { SPECTER_BALANCE_PROFILES } from '#gw2/professions/thief/specializations/specter/profiles.js';
import { SPECTER_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/specter/skills/index.js';
import { SPECTER_PUBLIC_STATE_PROJECTION, specterState } from '#gw2/professions/thief/specializations/specter/state.js';
import { specterTraits } from '#gw2/professions/thief/specializations/specter/traits/index.js';
import { SPECTER_SKILL_FIELDS } from '#gw2/professions/thief/specializations/specter/skill-fields.js';

export const specterModule = defineNativeModule({
  traitDefinitions: specterTraits,
  id: 'Specter',
  data: createThiefModuleData('Specter', {
    extraSkills: SPECTER_GUILD_ATTACK_SKILLS,
    skillFields: SPECTER_SKILL_FIELDS,
    skillMechanics: SPECTER_SKILL_MECHANICS,
    balanceProfiles: SPECTER_BALANCE_PROFILES
  }),
  state: { create: specterState.create, project: createPublicStateProjector(SPECTER_PUBLIC_STATE_PROJECTION) },
  hooks: specterHooks,
  presentation: specterUi
});
