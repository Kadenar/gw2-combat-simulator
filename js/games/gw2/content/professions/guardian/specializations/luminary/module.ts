import { defineNativeModule } from '#gw2/integrations/patches/authoring/profession.js';
import { augmentSkill, onResolvedDamage, replaceSkill } from '#gw2/integrations/patches/authoring/mechanics.js';
import { createGuardianModuleData } from '#gw2/content/professions/guardian/catalog/module-data.js';
import { guardianRadiantForgeSkillHandlers } from '#gw2/content/professions/guardian/specializations/luminary/mechanics/radiant-forge.js';
import {
  luminaryEventHandlers,
  luminaryEventReactions
} from '#gw2/content/professions/guardian/specializations/luminary/mechanics/radiant-forge-effects.js';
import {
  luminaryAttributeRules,
  luminaryCastRules,
  luminarySchedulerHooks,
  luminarySkillMechanicHandlers
} from '#gw2/content/professions/guardian/specializations/luminary/mechanics/radiant-forge-rules.js';
import {
  LUMINARY_EXTRA_SKILLS,
  LUMINARY_SKILL_MECHANICS
} from '#gw2/content/professions/guardian/specializations/luminary/skills/index.js';
import { luminaryState } from '#gw2/content/professions/guardian/specializations/luminary/state.js';
import { luminaryUi } from '#gw2/content/professions/guardian/specializations/luminary/presentation.js';
import { LUMINARY_BALANCE_PROFILES } from '#gw2/content/professions/guardian/specializations/luminary/profiles.js';

/** Applies Radiant Forge state changes at each skill's required lifecycle phase. */
const luminarySkillHandlers = Object.freeze({
  'guardian.radiant-forge': replaceSkill({
    beforeEffects: guardianRadiantForgeSkillHandlers['guardian.radiant-forge']
  }),
  'guardian.radiant-weapon': augmentSkill({
    beforeEffects: guardianRadiantForgeSkillHandlers['guardian.radiant-weapon']
  }),
  'guardian.glaring-burst': replaceSkill({
    beforeEffects: guardianRadiantForgeSkillHandlers['guardian.glaring-burst']
  })
});

export const luminaryModule = defineNativeModule({
  id: 'Luminary',
  data: createGuardianModuleData('Luminary', {
    skillMechanics: LUMINARY_SKILL_MECHANICS,
    extraSkills: LUMINARY_EXTRA_SKILLS,
    balanceProfiles: LUMINARY_BALANCE_PROFILES
  }),
  state: {
    // Both scheduler and resolver get independent state instances; the resolver
    // rebuilds its view by replaying timeline events rather than sharing a
    // reference with the scheduler.
    scheduler: luminaryState.create,
    resolver: luminaryState.create
  },
  mechanics: {
    modifiers: luminaryAttributeRules,
    execution: {
      skillHandlers: luminarySkillHandlers,
      castRules: luminaryCastRules,
      skillMechanicHandlers: luminarySkillMechanicHandlers,
      hooks: luminarySchedulerHooks
    },
    resolution: {
      // .map(onResolvedDamage) wraps each reaction so it only fires after damage
      // has been numerically resolved rather than at raw event time.
      reactions: luminaryEventReactions.damage.map(onResolvedDamage),
      hooks: { eventHandlers: luminaryEventHandlers }
    }
  },
  presentation: luminaryUi
});
