import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { landedChannelRefundLifecycle } from '#gw2/professions/thief/core/mechanics/channel-refund.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { TRAIT_LINES } from '#gw2/professions/thief/data/trait-lines.js';
import { DEADEYE_SKILL_FIELDS } from '#gw2/professions/thief/specializations/deadeye/catalog-fields.js';
import { deadeyeHooks } from '#gw2/professions/thief/specializations/deadeye/hooks.js';
import { deadeyeUi } from '#gw2/professions/thief/specializations/deadeye/presentation.js';
import { DEADEYE_SKILLS } from '#gw2/professions/thief/specializations/deadeye/skills/index.js';
import { maliciousAttackModifiers } from '#gw2/professions/thief/specializations/deadeye/skills/malicious-attacks.js';
import { THIEF_DEADEYE_SKILL_FLIPS } from '#gw2/professions/thief/specializations/deadeye/skills/skill-flips.js';
import { deadeyeSlotModifiers } from '#gw2/professions/thief/specializations/deadeye/skills/slot-skills.js';
import { deadeyeState, projectDeadeyePlanningState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import { deadeyeTraits } from '#gw2/professions/thief/specializations/deadeye/traits/index.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

export const deadeyeModule = defineNativeModule({
  traitDefinitions: deadeyeTraits,
  id: 'Deadeye',
  data: createNativeModuleData<ThiefSkill>({
    id: 'Deadeye',
    traitLines: TRAIT_LINES,
    skillFlips: THIEF_DEADEYE_SKILL_FLIPS,

    skillFields: DEADEYE_SKILL_FIELDS,
    skills: DEADEYE_SKILLS
  }),
  state: {
    create: () => deadeyeState.create(),
    project: projectDeadeyePlanningState
  },
  // Skill owners declare the rules; the module registers them alongside selected traits.
  modifiers: [...deadeyeSlotModifiers, ...maliciousAttackModifiers],
  // The malicious variant uses the shared all-strikes refund contract with its own live tuning.
  hooks: composeRuntimeHooks([deadeyeHooks, landedChannelRefundLifecycle(ID.MALICIOUS_ASHEN_ASSAULT)]),
  presentation: deadeyeUi
});
