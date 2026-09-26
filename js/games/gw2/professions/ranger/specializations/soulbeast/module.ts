import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRangerModuleData } from '#gw2/professions/ranger/data/module-data.js';
import { soulbeastAttributeRules } from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode.js';
import { soulbeastLive } from '#gw2/professions/ranger/specializations/soulbeast/live.js';
import { SOULBEAST_BASE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/soulbeast/skills/index.js';
import { SOULBEAST_BALANCE_PROFILES } from '#gw2/professions/ranger/specializations/soulbeast/profiles.js';
import { soulbeastState } from '#gw2/professions/ranger/specializations/soulbeast/state.js';
import { bindSoulbeastUi } from '#gw2/professions/ranger/specializations/soulbeast/presentation.js';

/** The module registers one live mechanic owner beside its existing data and modifier formulas. */
export const soulbeastModule = defineNativeModule({
  id: 'Soulbeast',
  data: createRangerModuleData('Soulbeast', {
    skillMechanics: SOULBEAST_BASE_SKILL_MECHANICS,
    balanceProfiles: SOULBEAST_BALANCE_PROFILES
  }),
  state: { create: soulbeastState.create },
  mechanics: { modifiers: soulbeastAttributeRules, live: soulbeastLive },
  presentation: bindSoulbeastUi
});
