import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { augmentSkillHandler, replaceSkillHandler } from '#gw2/platform/engine/skills/handlers.js';
import { createWarriorModuleData } from '#gw2/content/professions/warrior/catalog/module-data.js';
import { BLADESWORN_SKILL_MECHANICS } from '#gw2/content/professions/warrior/specializations/bladesworn/skills/index.js';
import {
  enterDragonTrigger,
  enterGunsaber,
  exitGunsaber,
  useArtillerySlash,
  useDragonSlash,
  useOverchargedCartridges
} from '#gw2/content/professions/warrior/specializations/bladesworn/mechanics/gunsaber-and-trigger.js';
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

/** Binds Gunsaber and Dragon Trigger transitions to their cast strategies. */
const bladeswornSkillHandlers = Object.freeze({
  'warrior.gunsaber-enter': augmentSkillHandler(enterGunsaber),
  'warrior.gunsaber-exit': augmentSkillHandler(exitGunsaber),
  'warrior.dragon-trigger': augmentSkillHandler(enterDragonTrigger),
  'warrior.dragon-slash': replaceSkillHandler(useDragonSlash),
  'warrior.artillery-slash': replaceSkillHandler(useArtillerySlash),
  'warrior.overcharged-cartridges': augmentSkillHandler(useOverchargedCartridges)
});

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
