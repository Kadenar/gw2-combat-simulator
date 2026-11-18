import { activeBuffStacks } from '#gw2/platform/combat/query/runtime-query.js';
import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { TRAIT_LINES } from '#gw2/professions/elementalist/data/trait-lines.js';
import { WEAVER_SKILL_FIELDS } from '#gw2/professions/elementalist/specializations/weaver/catalog-fields.js';
import { weaverHooks } from '#gw2/professions/elementalist/specializations/weaver/hooks.js';
import { weaverUi } from '#gw2/professions/elementalist/specializations/weaver/presentation.js';
import { WEAVER_SKILL_MECHANICS } from '#gw2/professions/elementalist/specializations/weaver/skills/index.js';
import { ELEMENTALIST_WEAVER_SKILL_FLIPS } from '#gw2/professions/elementalist/specializations/weaver/skills/skill-flips.js';
import { projectWeaverPlanningState, weaverState } from '#gw2/professions/elementalist/specializations/weaver/state.js';
import { weaverTraits } from '#gw2/professions/elementalist/specializations/weaver/traits/index.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';

/**
 * Weaver specialization module.
 *
 * Binds the dual-attunement mechanics, scheduler/resolver state factories, skill
 * catalog definitions and UI contract that the registry layers
 * on top of the shared Elementalist core.
 */
export const weaverModule = defineNativeModule({
  id: 'Weaver',
  data: createNativeModuleData<ElementalistSkill>({
    id: 'Weaver',
    traitLines: TRAIT_LINES,
    skillFlips: ELEMENTALIST_WEAVER_SKILL_FLIPS,
    skillFields: WEAVER_SKILL_FIELDS,
    skills: materializeSkillDefinitions(WEAVER_SKILL_MECHANICS)
  }),
  state: { create: weaverState.create, project: projectWeaverPlanningState },
  traitDefinitions: weaverTraits,
  // Woven Water adds percentage points through the shared boon-duration calculation and cap.
  attributes: (context) => [
    {
      traitDurations: {
        'Boon Duration':
          activeBuffStacks(context, 'weave self water', 1) > 0
            ? skillNumber(requireSkill(context.balanceContext.catalog, ID.WEAVE_SELF), 'weaverWaterBoonDuration')
            : 0
      }
    }
  ],
  hooks: weaverHooks,
  presentation: weaverUi
});
