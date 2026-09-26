import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRangerModuleData } from '#gw2/professions/ranger/data/module-data.js';
import { untamedAttributeRules } from '#gw2/professions/ranger/specializations/untamed/mechanics/unleash.js';
import { untamedLive } from '#gw2/professions/ranger/specializations/untamed/live.js';
import { UNTAMED_BASE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/untamed/skills/index.js';
import { UNTAMED_BALANCE_PROFILES } from '#gw2/professions/ranger/specializations/untamed/profiles.js';
import { untamedState } from '#gw2/professions/ranger/specializations/untamed/state.js';
import { bindUntamedUi } from '#gw2/professions/ranger/specializations/untamed/presentation.js';

/** The module registers one live mechanic owner beside its existing data and modifier formulas. */
export const untamedModule = defineNativeModule({
  id: 'Untamed',
  data: createRangerModuleData('Untamed', {
    skillMechanics: UNTAMED_BASE_SKILL_MECHANICS,
    balanceProfiles: UNTAMED_BALANCE_PROFILES
  }),
  state: { create: untamedState.create },
  mechanics: { modifiers: untamedAttributeRules, live: untamedLive },
  presentation: bindUntamedUi
});
