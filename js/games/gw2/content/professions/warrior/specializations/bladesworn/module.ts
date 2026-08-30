import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createWarriorModuleData } from '../../data/catalog.js';
import { BLADESWORN_SKILL_MECHANICS } from './skills/index.js';
import { bladeswornSkillHandlers } from './skills/handlers.js';
import {
  bladeswornAttributeRules,
  bladeswornCastRules,
  bladeswornSchedulerHooks,
  bladeswornSkillMechanicHandlers
} from './mechanics/gunsaber-and-trigger-rules.js';
import { bladeswornState } from './state.js';
import { bladeswornUi } from './presentation.js';
import { WARRIOR_SKILL_IDS as ID } from '../../data/ids.js';
import { BLADESWORN_BALANCE_PROFILES } from './profiles.js';

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
