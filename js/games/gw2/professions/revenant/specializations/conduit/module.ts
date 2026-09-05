import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { augmentSkill, replaceSkill } from '#gw2/platform/profession-definition/mechanics.js';
import type { SkillHandlerPhase } from '#gw2/platform/engine/execution/types.js';
import type { RevenantCastContext } from '#gw2/professions/revenant/types.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/catalog/module-data.js';
import { revenantConduitSkillHandlers } from '#gw2/professions/revenant/specializations/conduit/execution/index.js';
import {
  conduitAttributeRules,
  conduitCastRules,
  conduitSchedulerHooks
} from '#gw2/professions/revenant/specializations/conduit/mechanics/affinity-rules.js';
import { conduitState } from '#gw2/professions/revenant/specializations/conduit/state.js';
import { conduitUi } from '#gw2/professions/revenant/specializations/conduit/presentation.js';
import { CONDUIT_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/conduit/skills/index.js';
import { CONDUIT_BALANCE_PROFILES } from '#gw2/professions/revenant/specializations/conduit/profiles.js';

/** Selects Conduit packets from live legend and affinity state at cast time. */
const conduitHandlers = Object.freeze({
  'revenant.beguiling-haze': replaceSkill<RevenantCastContext>({
    beforeEffects: revenantConduitSkillHandlers['revenant.beguiling-haze'] as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.gladiators-defense': replaceSkill<RevenantCastContext>({
    beforeEffects: revenantConduitSkillHandlers['revenant.gladiators-defense'] as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.hex-eater-vortex': replaceSkill<RevenantCastContext>({
    beforeEffects: revenantConduitSkillHandlers['revenant.hex-eater-vortex'] as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.twin-moon-sweep': replaceSkill<RevenantCastContext>({
    beforeEffects: revenantConduitSkillHandlers['revenant.twin-moon-sweep'] as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.release-potential': replaceSkill<RevenantCastContext>({
    beforeEffects: revenantConduitSkillHandlers['revenant.release-potential'] as SkillHandlerPhase<RevenantCastContext>
  }),
  'revenant.cosmic-wisdom': augmentSkill<RevenantCastContext>({
    afterEffects: revenantConduitSkillHandlers['revenant.cosmic-wisdom'] as SkillHandlerPhase<RevenantCastContext>
  })
});

const conduitSkillHandlers = new Map(Object.entries(conduitHandlers));

export const conduitModule = defineNativeModule({
  id: 'Conduit',
  data: createRevenantModuleData('Conduit', {
    skillMechanics: CONDUIT_BASE_SKILL_MECHANICS,
    balanceProfiles: CONDUIT_BALANCE_PROFILES
  }),
  // Scheduler and resolver each get their own independent copy of ConduitState so they never share mutable affinity.
  state: { scheduler: conduitState.create, resolver: conduitState.create },
  mechanics: {
    modifiers: conduitAttributeRules,
    execution: {
      skillHandlers: conduitSkillHandlers,
      castRules: conduitCastRules,
      hooks: conduitSchedulerHooks
    }
  },
  presentation: conduitUi
});
