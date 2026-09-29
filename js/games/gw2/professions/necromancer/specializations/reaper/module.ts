import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';
import { createNecromancerModuleData } from '#gw2/professions/necromancer/data/module-data.js';
import { reaperModifiers } from '#gw2/professions/necromancer/specializations/reaper/modifiers.js';
import { bindReaperUi } from '#gw2/professions/necromancer/specializations/reaper/presentation.js';
import { REAPER_BALANCE_PROFILES } from '#gw2/professions/necromancer/specializations/reaper/profiles.js';
import { REAPER_BASE_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/reaper/skills/index.js';
import { reaperState } from '#gw2/professions/necromancer/specializations/reaper/state.js';
import { necromancerReaperTraits } from '#gw2/professions/necromancer/specializations/reaper/traits/index.js';

export const reaperModule = defineNativeModule({
  traitDefinitions: necromancerReaperTraits,
  id: 'Reaper',
  data: createNecromancerModuleData('Reaper', {
    skillMechanics: REAPER_BASE_SKILL_MECHANICS,
    balanceProfiles: REAPER_BALANCE_PROFILES,
    // Shroud autoattack chain runs separately from the out-of-shroud chain; both must be registered.
    autoattackChains: {
      additional: [[ID.LIFE_REND, ID.LIFE_SLASH, ID.LIFE_REAP]]
    }
  }),
  // One state factory supplies the live combat owner.
  state: { create: reaperState.create },

  modifiers: reaperModifiers,
  presentation: bindReaperUi
});
