import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { createWarriorModuleData } from '#gw2/content/professions/warrior/catalog/module-data.js';
import { BLADESWORN_SKILL_MECHANICS } from '#gw2/content/professions/warrior/specializations/bladesworn/skills/index.js';
import { bladeswornSkillHandlers } from '#gw2/content/professions/warrior/specializations/bladesworn/skills/execution.js';
import {
  bladeswornAttributeRules,
  bladeswornCastRules,
  bladeswornSchedulerHooks,
  bladeswornSkillMechanicHandlers
} from '#gw2/content/professions/warrior/specializations/bladesworn/mechanics/gunsaber-and-trigger-rules.js';
import { bladeswornState } from '#gw2/content/professions/warrior/specializations/bladesworn/state.js';
import { bladeswornUi } from '#gw2/content/professions/warrior/specializations/bladesworn/presentation.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/content/professions/warrior/data/ids.js';
import { BLADESWORN_BALANCE_PROFILES } from '#gw2/content/professions/warrior/specializations/bladesworn/profiles.js';

export const bladeswornModule = defineNativeModule({
  id: 'Bladesworn',
  data: createWarriorModuleData('Bladesworn', {
    skillMechanics: BLADESWORN_SKILL_MECHANICS,
    balanceProfiles: BLADESWORN_BALANCE_PROFILES,
    autoattackChains: {
      additional: [[ID.SWIFT_CUT, ID.STEEL_DIVIDE, ID.EXPLOSIVE_THRUST]]
    }
  }),
  state: {
    scheduler: bladeswornState.create,
    resolver: bladeswornState.create
  },
  mechanics: {
    modifiers: bladeswornAttributeRules,
    execution: {
      skillHandlers: bladeswornSkillHandlers,
      castRules: bladeswornCastRules,
      skillMechanicHandlers: bladeswornSkillMechanicHandlers,
      hooks: bladeswornSchedulerHooks
    }
  },
  presentation: bladeswornUi
});
