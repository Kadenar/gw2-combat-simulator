import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { TRAIT_LINES } from '#gw2/professions/necromancer/data/trait-lines.js';
import { NECROMANCER_REAPER_PROFILE_FIELDS } from '#gw2/professions/necromancer/specializations/reaper/catalog-fields.js';
import { bindReaperUi } from '#gw2/professions/necromancer/specializations/reaper/presentation.js';
import { NECROMANCER_REAPER_AUTOATTACK_CHAINS } from '#gw2/professions/necromancer/specializations/reaper/skills/autoattack-chains.js';
import { REAPER_BASE_SKILL_MECHANICS } from '#gw2/professions/necromancer/specializations/reaper/skills/index.js';
import { reaperShoutMeleeModifier } from '#gw2/professions/necromancer/specializations/reaper/skills/shout-skills.js';
import { NECROMANCER_REAPER_SKILL_FLIPS } from '#gw2/professions/necromancer/specializations/reaper/skills/skill-flips.js';
import { reaperState } from '#gw2/professions/necromancer/specializations/reaper/state.js';
import { necromancerReaperTraits } from '#gw2/professions/necromancer/specializations/reaper/traits/index.js';
import type { NecromancerSkill } from '#gw2/professions/necromancer/types.js';

export const reaperModule = defineNativeModule({
  traitDefinitions: necromancerReaperTraits,
  id: 'Reaper',
  data: createNativeModuleData<NecromancerSkill>({
    id: 'Reaper',
    traitLines: TRAIT_LINES,
    skillFlips: NECROMANCER_REAPER_SKILL_FLIPS,
    profileFields: NECROMANCER_REAPER_PROFILE_FIELDS,
    skillMechanics: REAPER_BASE_SKILL_MECHANICS,
    autoattackChains: NECROMANCER_REAPER_AUTOATTACK_CHAINS
  }),
  // One state factory supplies the live combat owner.
  state: { create: reaperState.create },

  // Preserve the shout rule's effective position in the composed profession modifiers.
  modifiers: [{ ...reaperShoutMeleeModifier, order: 0 }],
  presentation: bindReaperUi
});
