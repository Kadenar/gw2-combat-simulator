import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createRangerModuleData } from '#gw2/professions/ranger/data/module-data.js';
import { druidHooks } from '#gw2/professions/ranger/specializations/druid/hooks.js';
import { bindDruidUi } from '#gw2/professions/ranger/specializations/druid/presentation.js';
import { DRUID_BALANCE_PROFILES } from '#gw2/professions/ranger/specializations/druid/profiles.js';
import { DRUID_BASE_SKILL_MECHANICS } from '#gw2/professions/ranger/specializations/druid/skills/index.js';
import { DRUID_PUBLIC_STATE_PROJECTION, druidState } from '#gw2/professions/ranger/specializations/druid/state.js';
import { druidTraits } from '#gw2/professions/ranger/specializations/druid/traits/index.js';
import { modifyNaturalFortitudeAttributes } from '#gw2/professions/ranger/specializations/untamed/traits/behavior.js';

/** The module registers one live mechanic owner beside its existing data and modifier formulas. */
export const druidModule = defineNativeModule({
  id: 'Druid',
  traitDefinitions: druidTraits,
  data: createRangerModuleData('Druid', {
    skillMechanics: DRUID_BASE_SKILL_MECHANICS,
    balanceProfiles: DRUID_BALANCE_PROFILES
  }),
  state: { create: druidState.create, project: createPublicStateProjector(DRUID_PUBLIC_STATE_PROJECTION) },
  // Preserve the existing Druid-only runtime boundary for Untamed's Natural Fortitude.
  modifiers: { modifyAttributes: modifyNaturalFortitudeAttributes },
  hooks: druidHooks,
  presentation: bindDruidUi
});
