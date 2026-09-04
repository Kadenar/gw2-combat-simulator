import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { replaceSkill } from '#gw2/platform/profession-definition/mechanics.js';
import { createMesmerModuleData } from '#gw2/professions/mesmer/catalog/module-data.js';
import {
  mirageAttributeRules,
  mirageCastRules,
  mirageSchedulerHooks,
  mirageSkillMechanicHandlers
} from '#gw2/professions/mesmer/specializations/mirage/mechanics/ambush-rules.js';
import { mirageState } from '#gw2/professions/mesmer/specializations/mirage/state.js';
import { mirageUi } from '#gw2/professions/mesmer/specializations/mirage/presentation.js';
import {
  MESMER_MIRAGE_EXTRA_SKILLS,
  MESMER_MIRAGE_SKILL_MECHANICS,
  MESMER_MIRAGE_SUPPLEMENTAL_SKILL_MECHANICS
} from '#gw2/professions/mesmer/specializations/mirage/skills/index.js';
import { mesmerReplaceProfile } from '#gw2/professions/mesmer/core/execution/index.js';
import { withMesmerCastEmission } from '#gw2/professions/mesmer/core/execution/cast-lifecycle.js';
import { mirageControllerFor } from '#gw2/professions/mesmer/specializations/mirage/mechanics/runtime.js';
import { MIRAGE_BALANCE_PROFILES } from '#gw2/professions/mesmer/specializations/mirage/profiles.js';
import type { MesmerHandlerContext } from '#gw2/professions/mesmer/types.js';
import type { MesmerSkill } from '#gw2/professions/mesmer/data/types.js';

// Ambush packets register at cast start so overlapping actions observe them chronologically.
const mesmerAmbushProfile = replaceSkill<MesmerHandlerContext>({
  beforeEffects: (context, skill) =>
    withMesmerCastEmission(context, skill as MesmerSkill, () =>
      mirageControllerFor(context.mesmerRuntime).executePlayerAmbush(
        skill as MesmerSkill,
        context.fullEnd,
        context.start
      )
    )
});

export const mirageModule = defineNativeModule({
  id: 'Mirage',
  data: createMesmerModuleData('Mirage', {
    skillMechanics: MESMER_MIRAGE_SKILL_MECHANICS,
    supplementalSkillMechanics: MESMER_MIRAGE_SUPPLEMENTAL_SKILL_MECHANICS,
    extraSkills: MESMER_MIRAGE_EXTRA_SKILLS,
    balanceProfiles: MIRAGE_BALANCE_PROFILES
  }),
  state: {
    scheduler: mirageState.create,
    // Mirage has no resolver-local state; timeline events carry its resolver data.
    resolver: () => ({})
  },
  mechanics: {
    modifiers: mirageAttributeRules,
    execution: {
      // Mirage dodge and ambush replace their declarative profiles with stateful handlers.
      skillHandlers: Object.freeze({
        'mesmer.mirage-dodge': mesmerReplaceProfile,
        'mesmer.ambush': mesmerAmbushProfile
      }),
      castRules: mirageCastRules,
      skillMechanicHandlers: mirageSkillMechanicHandlers,
      hooks: mirageSchedulerHooks
    }
  },
  presentation: mirageUi
});
