import { BOON } from '#gw2/platform/constants.js';
import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { requireSkill, skillNumber } from '#gw2/platform/skills/balance-profiles.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { activeBoonStacks } from '#gw2/professions/engineer/core/traits/query-helpers.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { TRAIT_LINES } from '#gw2/professions/engineer/data/trait-lines.js';
import { AMALGAM_SKILL_FIELDS } from '#gw2/professions/engineer/specializations/amalgam/catalog-fields.js';
import { amalgamHooks } from '#gw2/professions/engineer/specializations/amalgam/hooks.js';
import { activeAmalgamState } from '#gw2/professions/engineer/specializations/amalgam/mechanics/modifier-queries.js';
import { bindAmalgamUi } from '#gw2/professions/engineer/specializations/amalgam/presentation.js';
import { AMALGAM_SKILL_MECHANICS } from '#gw2/professions/engineer/specializations/amalgam/skills/index.js';
import { amalgamState, projectAmalgamPlanningState } from '#gw2/professions/engineer/specializations/amalgam/state.js';
import {
  amalgamTraits,
  evolveAttributeFactor
} from '#gw2/professions/engineer/specializations/amalgam/traits/index.js';
import type { EngineerSkill } from '#gw2/professions/engineer/types.js';

// Evolved adds 10% of its eligible stat pool, or 20% with Double Helix.
// Round attribute conversions before deriving armor, critical chance, and duration percentages.
const EVOLVE_ATTRIBUTES = Object.freeze([
  'Power',
  'Precision',
  'Toughness',
  'Vitality',
  'Ferocity',
  'Condition Damage',
  'Expertise',
  'Concentration',
  'Healing Power'
] as const);

// Compose cast-time protocol state with resolver-side reactions: handlers establish
// strains and Evolve state, while resolved hits drive Rapacious and Carbolic procs.
export const amalgamModule = defineNativeModule({
  id: 'Amalgam',
  data: createNativeModuleData<EngineerSkill>({
    id: 'Amalgam',
    traitLines: TRAIT_LINES,
    skillFields: AMALGAM_SKILL_FIELDS,
    skills: materializeSkillDefinitions(AMALGAM_SKILL_MECHANICS)
  }),
  state: { create: amalgamState.create, project: projectAmalgamPlanningState },
  traitDefinitions: amalgamTraits,
  /** Evolve scales conversion-eligible flat traits with equipment; Might and Titanic stay outside that pool. */
  attributes: (context) => {
    const evolved = activeAmalgamState(context, 'evolvedUntil');
    const factor = evolved ? evolveAttributeFactor(context) - 1 : 0;
    const titanic = activeAmalgamState(context, 'titanicUntil')
      ? activeBoonStacks(context, BOON.MIGHT) *
        skillNumber(
          requireSkill(context.balanceContext.catalog, ID.OFFENSIVE_PROTOCOL_OBLITERATE),
          'titanicAttributePerStack'
        )
      : 0;
    return [
      {
        attributeEffects: [
          ...EVOLVE_ATTRIBUTES.map((name) => ({
            kind: 'conversion' as const,
            from: name,
            to: name,
            multiplier: factor,
            input: 'eligible' as const,
            rounding: 'round' as const
          })),
          ...['Power', 'Condition Damage'].map((to) => ({
            kind: 'flat' as const,
            to,
            amount: titanic,
            feedsConversions: 'none' as const
          }))
        ]
      }
    ];
  },
  hooks: amalgamHooks,
  presentation: bindAmalgamUi
});
