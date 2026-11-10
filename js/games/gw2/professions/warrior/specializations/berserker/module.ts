import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { ownerAttributeBonusNumber, requireBalanceProfile } from '#gw2/platform/skills/balance-profiles.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { TRAIT_LINES } from '#gw2/professions/warrior/data/trait-lines.js';
import { BERSERKER_SKILL_FIELDS } from '#gw2/professions/warrior/specializations/berserker/catalog-fields.js';
import { berserkerHooks } from '#gw2/professions/warrior/specializations/berserker/hooks.js';
import { berserkerUi } from '#gw2/professions/warrior/specializations/berserker/presentation.js';
import { BERSERKER_SKILL_MECHANICS } from '#gw2/professions/warrior/specializations/berserker/skills/index.js';
import {
  berserkerState,
  projectBerserkerPlanningState
} from '#gw2/professions/warrior/specializations/berserker/state.js';
import { active } from '#gw2/professions/warrior/specializations/berserker/traits/behavior.js';
import { warriorBerserkerTraits } from '#gw2/professions/warrior/specializations/berserker/traits/index.js';
import type { WarriorSkill } from '#gw2/professions/warrior/types.js';

export const berserkerModule = defineNativeModule({
  id: 'Berserker',
  data: createNativeModuleData<WarriorSkill>({
    id: 'Berserker',
    traitLines: TRAIT_LINES,
    skillFields: BERSERKER_SKILL_FIELDS,
    skills: materializeSkillDefinitions(BERSERKER_SKILL_MECHANICS)
  }),
  state: { create: berserkerState.create, project: projectBerserkerPlanningState },
  traitDefinitions: warriorBerserkerTraits,
  /** Berserk grants final Power and Condition Damage without feeding ordinary trait conversions. */
  attributes: (context) => {
    if (!active(context)) return [];

    const profile = requireBalanceProfile(context.balanceContext.catalog, TRAIT.FATAL_FRENZY);
    const power = ownerAttributeBonusNumber(profile, 'power');
    return [
      {
        attributeEffects: [
          { kind: 'flat', to: 'Power', amount: power, feedsConversions: 'none' },
          {
            kind: 'flat',
            to: 'Condition Damage',
            amount: ownerAttributeBonusNumber(profile, 'conditionDamage'),
            feedsConversions: 'none'
          }
        ]
      }
    ];
  },
  hooks: berserkerHooks,
  presentation: berserkerUi
});
