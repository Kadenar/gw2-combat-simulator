import { defineNativeModule } from '../../../../../integrations/patches/authoring/profession.js';
import { createWarriorModuleData } from '../../catalog-data.js';
import { BLADESWORN_SKILL_MECHANICS } from './skills.js';
import { bladeswornSkillHandlers } from './handlers.js';
import {
  bladeswornAttributeRules,
  bladeswornCastRules,
  bladeswornSchedulerHooks,
  bladeswornSkillMechanicHandlers
} from './rules.js';
import { bladeswornState } from './state.js';
import { bladeswornUi } from './ui.js';
import { WARRIOR_SKILL_IDS as ID } from '../../data/ids.js';
import { BLADESWORN_BALANCE_PROFILES } from './profiles.js';

export const bladeswornModule = defineNativeModule({
  id: 'Bladesworn',
  data: createWarriorModuleData('Bladesworn', {
    skillMechanics: BLADESWORN_SKILL_MECHANICS,
    balanceProfiles: BLADESWORN_BALANCE_PROFILES,
    handlers: bladeswornSkillHandlers,
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
    castRules: bladeswornCastRules,
    skillMechanicHandlers: bladeswornSkillMechanicHandlers,
    schedulerHooks: bladeswornSchedulerHooks
  },
  presentation: bladeswornUi
});
