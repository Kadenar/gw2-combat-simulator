import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { composeRuntimeHooks } from '#gw2/platform/profession-definition/runtime-hooks.js';
import { ashenAssaultLifecycle } from '#gw2/professions/thief/core/mechanics/spear.js';
import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { DEADEYE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/specializations/deadeye/profiles.js';
import { createThiefModuleData } from '#gw2/professions/thief/data/module-data.js';
import { deadeyeHooks } from '#gw2/professions/thief/specializations/deadeye/hooks.js';
import { deadeyeUi } from '#gw2/professions/thief/specializations/deadeye/presentation.js';
import { DEADEYE_BALANCE_PROFILES } from '#gw2/professions/thief/specializations/deadeye/profiles.js';
import { DEADEYE_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/deadeye/skills/index.js';
import { maliciousAttackModifiers } from '#gw2/professions/thief/specializations/deadeye/skills/malicious-attacks.js';
import { deadeyeSlotModifiers } from '#gw2/professions/thief/specializations/deadeye/skills/slot-skills.js';
import { DEADEYE_PUBLIC_STATE_PROJECTION, deadeyeState } from '#gw2/professions/thief/specializations/deadeye/state.js';
import { deadeyeTraits } from '#gw2/professions/thief/specializations/deadeye/traits/index.js';

export const deadeyeModule = defineNativeModule({
  traitDefinitions: deadeyeTraits,
  id: 'Deadeye',
  data: createThiefModuleData('Deadeye', {
    skillMechanics: DEADEYE_SKILL_MECHANICS,
    balanceProfiles: DEADEYE_BALANCE_PROFILES
  }),
  state: {
    create: () => deadeyeState.create(),
    project: createPublicStateProjector(DEADEYE_PUBLIC_STATE_PROJECTION)
  },
  // Skill owners declare the rules; the module registers them alongside selected traits.
  modifiers: [...deadeyeSlotModifiers, ...maliciousAttackModifiers],
  // The malicious variant uses the shared all-strikes refund contract with its own live tuning.
  hooks: composeRuntimeHooks([
    deadeyeHooks,
    ashenAssaultLifecycle(ID.MALICIOUS_ASHEN_ASSAULT, PROFILE.maliciousAshenAssault)
  ]),
  presentation: deadeyeUi
});
