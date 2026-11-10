import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { TRAIT_LINES } from '#gw2/professions/revenant/data/trait-lines.js';
import { vindicatorHooks } from '#gw2/professions/revenant/specializations/vindicator/hooks.js';
import { vindicatorUi } from '#gw2/professions/revenant/specializations/vindicator/presentation.js';
import { VINDICATOR_REWORK_TRAIT_IDS as REWORK } from '#gw2/professions/revenant/specializations/vindicator/rework/ids.js';
import { vindicatorReworkTraits } from '#gw2/professions/revenant/specializations/vindicator/rework/traits.js';
import { VINDICATOR_SKILLS } from '#gw2/professions/revenant/specializations/vindicator/skills/index.js';
import {
  projectVindicatorPlanningState,
  vindicatorState
} from '#gw2/professions/revenant/specializations/vindicator/state.js';
import type { RevenantSkill } from '#gw2/professions/revenant/types.js';

const live = TRAIT_LINES.find((traitLine) => traitLine.name === 'Vindicator')!;

/** Preserve moved identities so existing dodge and Energy Meld selectors follow the preview's legal choices. */
const traitLine = {
  ...live,
  minorTraits: live.minorTraits.map((trait) =>
    trait.id === TRAIT.EMPIRE_DIVIDED
      ? { ...trait, id: REWORK.RISE_TO_THE_OCCASION, name: 'Rise to the Occasion' }
      : trait
  ),
  majorTraits: [
    live.majorTraits[1]!,
    live.majorTraits[2]!,
    [
      { id: REWORK.FRIEND_OF_THE_LUXONS, name: 'Friend of the Luxons' },
      { id: REWORK.HEATED_RIVALRY, name: 'Heated Rivalry' },
      { id: REWORK.FRIEND_OF_THE_KURZICKS, name: 'Friend of the Kurzicks' }
    ].map((trait) => ({
      ...trait,
      icon: live.icon
    }))
  ]
};

/** Replace only the preview's trait layout and behavior, retaining the existing supported skill set. */
export const vindicatorReworkModule = defineNativeModule({
  id: 'Vindicator',
  data: createNativeModuleData<RevenantSkill>({
    id: 'Vindicator',
    traitLines: [traitLine],
    skills: VINDICATOR_SKILLS
  }),
  state: { create: vindicatorState.create, project: projectVindicatorPlanningState },
  traitDefinitions: vindicatorReworkTraits,
  hooks: vindicatorHooks,
  presentation: vindicatorUi
});
