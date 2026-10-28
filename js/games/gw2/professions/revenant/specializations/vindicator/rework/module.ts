import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { createRevenantModuleData } from '#gw2/professions/revenant/data/module-data.js';
import { SPECIALIZATIONS } from '#gw2/professions/revenant/data/revenant-api-metadata.js';
import { VINDICATOR_DODGE_INPUT } from '#gw2/professions/revenant/data/vindicator-dodge.js';
import { vindicatorHooks } from '#gw2/professions/revenant/specializations/vindicator/hooks.js';
import { vindicatorUi } from '#gw2/professions/revenant/specializations/vindicator/presentation.js';
import { VINDICATOR_REWORK_TRAIT_IDS as REWORK } from '#gw2/professions/revenant/specializations/vindicator/rework/ids.js';
import { vindicatorReworkTraits } from '#gw2/professions/revenant/specializations/vindicator/rework/traits.js';
import { VINDICATOR_BASE_SKILL_MECHANICS } from '#gw2/professions/revenant/specializations/vindicator/skills/index.js';
import {
  projectVindicatorPlanningState,
  vindicatorState
} from '#gw2/professions/revenant/specializations/vindicator/state.js';

const live = SPECIALIZATIONS.find((specialization) => specialization.name === 'Vindicator')!;

/** Preserve moved identities so existing dodge and Energy Meld selectors follow the preview's legal choices. */
const specialization = {
  ...live,
  minorTraits: live.minorTraits.map((trait) => {
    if (trait.id === TRAIT.BALANCE_IN_DISCORD)
      return {
        ...trait,
        description:
          'Gain endurance when swapping legends. The amount is provisional. The Alliance Tactics trigger is deferred because Alliance stance switching is not implemented.'
      };

    if (trait.id === TRAIT.EMPIRE_DIVIDED)
      return {
        ...trait,
        id: REWORK.RISE_TO_THE_OCCASION,
        name: 'Rise to the Occasion',
        description:
          'Increase strike damage while endurance is below full. The percentage and multiplicative stacking are provisional. Outgoing healing is outside simulation scope.'
      };

    return trait;
  }),
  majorTraits: [
    live.majorTraits[1]!.map((trait) => ({ ...trait, tier: 1 })),
    live.majorTraits[2]!.map((trait) => ({ ...trait, tier: 2 })),
    [
      {
        id: REWORK.FRIEND_OF_THE_LUXONS,
        name: 'Friend of the Luxons',
        description: "Unlock Archemorus's Strike. Pending: the new skill is not implemented in this first pass."
      },
      {
        id: REWORK.HEATED_RIVALRY,
        name: 'Heated Rivalry',
        description:
          'Three Luxon or Kurzick skills recharge Alliance Tactics and refund the next opposite-faction skill. Deferred: Kurzick skills, Alliance Tactics, faction counters, and energy refunds are not implemented.'
      },
      {
        id: REWORK.FRIEND_OF_THE_KURZICKS,
        name: 'Friend of the Kurzicks',
        description:
          'Unlock Shield of Saint Viktor. Deferred: the skill is not implemented; ally barrier and projectile blocking are outside simulation scope.'
      }
    ].map((trait) => ({
      ...trait,
      tier: 3,
      slot: 'Major',
      specialization: 'Vindicator',
      icon: live.icon
    }))
  ]
};

/** Replace only the preview's trait layout and behavior, retaining the existing supported skill set. */
export const vindicatorReworkModule = defineNativeModule({
  id: 'Vindicator',
  data: {
    ...createRevenantModuleData('Vindicator', {
      skillMechanics: VINDICATOR_BASE_SKILL_MECHANICS,
      extraSkills: [VINDICATOR_DODGE_INPUT]
    }),
    traits: [...specialization.minorTraits, ...specialization.majorTraits.flat()],
    specializations: [specialization]
  },
  traitDefinitions: vindicatorReworkTraits,
  state: { create: vindicatorState.create, project: projectVindicatorPlanningState },
  hooks: vindicatorHooks,
  presentation: vindicatorUi
});
