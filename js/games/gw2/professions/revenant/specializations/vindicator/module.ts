import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { VINDICATOR_JUMP_SKILL } from '#gw2/professions/revenant/data/vindicator-jump.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/data/module-data.js';
import { vindicatorAttributeRules } from '#gw2/professions/revenant/specializations/vindicator/mechanics/alliance-and-dodge-rules.js';
import { vindicatorState } from '#gw2/professions/revenant/specializations/vindicator/state.js';
import { vindicatorUi } from '#gw2/professions/revenant/specializations/vindicator/presentation.js';
import { VINDICATOR_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/vindicator/skills/index.js';
import { VINDICATOR_BALANCE_PROFILES } from '#gw2/professions/revenant/specializations/vindicator/profiles.js';
import { vindicatorHooks } from '#gw2/professions/revenant/specializations/vindicator/hooks.js';

// One live declaration owns this slice's transitions; the catalog and modifier formulas remain shared.
export const vindicatorModule = defineNativeModule({
  id: 'Vindicator',
  data: createRevenantModuleData('Vindicator', {
    skillMechanics: VINDICATOR_BASE_SKILL_MECHANICS,
    extraSkills: [VINDICATOR_JUMP_SKILL],
    balanceProfiles: VINDICATOR_BALANCE_PROFILES
  }),
  state: { create: vindicatorState.create },
  modifiers: vindicatorAttributeRules,
  hooks: vindicatorHooks,
  presentation: vindicatorUi
});
