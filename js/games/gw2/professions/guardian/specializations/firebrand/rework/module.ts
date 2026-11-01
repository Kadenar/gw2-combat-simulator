import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { TRAIT_LINES } from '#gw2/professions/guardian/data/trait-lines.js';
import { FIREBRAND_SKILL_FIELDS } from '#gw2/professions/guardian/specializations/firebrand/catalog-fields.js';
import { firebrandHooks } from '#gw2/professions/guardian/specializations/firebrand/hooks.js';
import { FIREBRAND_REWORK_TRAIT_IDS as REWORK } from '#gw2/professions/guardian/specializations/firebrand/ids.js';
import { bindFirebrandUi } from '#gw2/professions/guardian/specializations/firebrand/presentation.js';
import { FIREBRAND_REWORK_PROFILE_FIELDS } from '#gw2/professions/guardian/specializations/firebrand/rework/catalog-fields.js';
import { firebrandReworkTraits } from '#gw2/professions/guardian/specializations/firebrand/rework/traits.js';
import { FIREBRAND_SKILL_MECHANICS } from '#gw2/professions/guardian/specializations/firebrand/skills/index.js';
import { GUARDIAN_FIREBRAND_SKILL_FLIPS } from '#gw2/professions/guardian/specializations/firebrand/skills/skill-flips.js';
import { ashesBurningSkill } from '#gw2/professions/guardian/specializations/firebrand/skills/tome-skills.js';
import {
  firebrandState,
  projectFirebrandPlanningState
} from '#gw2/professions/guardian/specializations/firebrand/state.js';
import type { GuardianSkill } from '#gw2/professions/guardian/types.js';

const live = TRAIT_LINES.find((traitLine) => traitLine.name === 'Firebrand')!;
const metadata = new Map([...live.minorTraits, ...live.majorTraits.flat()].map((trait) => [trait.id, trait]));

/** Preserve published identities while replacing obsolete descriptions and assigning the new legal trait choices. */
const description = {
  [TRAIT.UNRELENTING_CRITICISM]:
    'Increase bleeding duration and damage. Both bonuses are provisional; final values are unknown.',
  [TRAIT.IMBUED_HASTE]:
    'While affected by Quickness, increase outgoing condition damage and healing and reduce incoming damage. Provisional preview assumes the Quickness requirement remains with a provisional condition-damage bonus. Healing and incoming damage are outside simulation scope.',
  [REWORK.REVELATION]: 'Final mantra charges grant pages.',
  [REWORK.BASTION]: 'Protection has increased effectiveness on you. Incoming damage is outside simulation scope.',
  [REWORK.FERVID_CONVICTION]:
    'When Swift Scholar grants pages, grant Ashes of the Just to nearby allies. Charge count, lifetime, recipient count and internal cooldown are provisional; the preview assumes the player is included.',
  [TRAIT.STALWART_SPEED]:
    'When Swift Scholar grants pages, grant Quickness to nearby allies. Duration, recipient count and internal cooldown are provisional; the preview assumes the player is included.',
  [TRAIT.STOIC_DEMEANOR]:
    'Retain Tome of Courage passive while dormant. Disabling or immobilizing enemies reduces Unbroken Lines recharge. Recharge reduction and internal cooldown are provisional.',
  [REWORK.RIGHTEOUS_FLAMES]:
    'Retain Tome of Justice passive while dormant. Improve Ashes of the Just burning. Base burning duration and Burning stacks per charge are provisional.',
  [REWORK.DELIVERANCE]: 'Retain Tome of Resolve passive while dormant. Passive healing is outside simulation scope.'
};

function trait(id: number | string, name: string) {
  return {
    ...metadata.get(typeof id === 'number' ? id : TRAIT.LIBERATORS_VOW)!,
    id,
    name,
    description: description[id as keyof typeof description]
  };
}

const traitLine = {
  ...live,
  minorTraits: live.minorTraits.map((entry) =>
    entry.id === TRAIT.IMBUED_HASTE ? { ...entry, description: description[TRAIT.IMBUED_HASTE] } : entry
  ),
  majorTraits: [
    [
      trait(TRAIT.UNRELENTING_CRITICISM, 'Unrelenting Criticism'),
      trait(REWORK.REVELATION, 'Revelation'),
      trait(REWORK.BASTION, 'Bastion')
    ],
    [
      trait(REWORK.FERVID_CONVICTION, 'Fervid Conviction'),
      trait(TRAIT.STALWART_SPEED, 'Stalwart Speed'),
      metadata.get(TRAIT.LEGENDARY_LORE)!
    ],
    [
      trait(REWORK.RIGHTEOUS_FLAMES, 'Righteous Flames'),
      trait(TRAIT.STOIC_DEMEANOR, 'Stoic Demeanor'),
      trait(REWORK.DELIVERANCE, 'Deliverance')
    ]
  ]
};

/** Reworks replace executable declarations as a unit; ordinary preview edits still own every tunable number. */
export const firebrandReworkModule = defineNativeModule({
  id: 'Firebrand',
  // The rework replaces the module as a unit, so it declares the same Firebrand skill fields.
  data: createNativeModuleData<GuardianSkill>({
    id: 'Firebrand',
    traitLines: [traitLine],
    skillFlips: GUARDIAN_FIREBRAND_SKILL_FLIPS,
    profileFields: FIREBRAND_REWORK_PROFILE_FIELDS,
    skillMechanics: FIREBRAND_SKILL_MECHANICS,
    skillFields: FIREBRAND_SKILL_FIELDS,
    // The rework owns this complete replacement alongside its ordinary keyed skills.
    extraSkills: [
      {
        ...ashesBurningSkill,
        name: 'Ashes of the Just: Burning per charge (replaced when Righteous Flames is selected)',
        burningOverrideTrait: REWORK.RIGHTEOUS_FLAMES
      }
    ]
  }),
  state: {
    create: (config, { balanceContext }) =>
      firebrandState.create({ config, balanceProfile: (id) => balanceContext.catalog.balanceProfilesById.get(id) }),
    project: projectFirebrandPlanningState
  },
  traitDefinitions: firebrandReworkTraits,
  hooks: firebrandHooks,
  presentation: bindFirebrandUi
});
