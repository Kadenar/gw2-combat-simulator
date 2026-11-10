import { ownerAttributeEffects } from '#gw2/platform/attributes/passives.js';
import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { requireSkill } from '#gw2/platform/skills/balance-profiles.js';
import {
  ELEMENTALIST_CORE_PROFILE_FIELDS,
  ELEMENTALIST_CORE_SKILL_FIELDS
} from '#gw2/professions/elementalist/core/catalog-fields.js';
import { elementalistCoreHooks } from '#gw2/professions/elementalist/core/hooks.js';
import { wieldedConjure } from '#gw2/professions/elementalist/core/mechanics/modifier-queries.js';
import { bindElementalistCoreUi } from '#gw2/professions/elementalist/core/presentation.js';
import { elementalistPassiveAttributes } from '#gw2/professions/elementalist/core/skills/attribute-passives.js';
import { ELEMENTALIST_CORE_AUTOATTACK_CHAINS } from '#gw2/professions/elementalist/core/skills/autoattack-chains.js';
import { ELEMENTALIST_CORE_SKILLS } from '#gw2/professions/elementalist/core/skills/index.js';
import { ELEMENTALIST_CORE_SKILL_FLIPS } from '#gw2/professions/elementalist/core/skills/skill-flips.js';
import {
  createElementalistCoreState,
  projectElementalistCorePlanningState
} from '#gw2/professions/elementalist/core/state.js';
import { elementalistCoreTraits } from '#gw2/professions/elementalist/core/traits/index.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { TRAIT_LINES } from '#gw2/professions/elementalist/data/trait-lines.js';
import type { ElementalistSkill } from '#gw2/professions/elementalist/types.js';
import { defineProfessionWeapons } from '#gw2/professions/shared/catalog-data.js';

// Core owns the profession-wide weapon equipment choices.
const WEAPON_DATA = defineProfessionWeapons({
  Dagger: 'mh+oh',
  Focus: 'oh',
  Hammer: '2h',
  Pistol: 'mh',
  Scepter: 'mh',
  Spear: '2h',
  Staff: '2h',
  Sword: 'mh',
  Warhorn: 'oh'
});

/**
 * Core Elementalist module: binds the shared attunement/endurance state, its
 * live cast and impact hooks, and the Core UI into one registration
 * that every Elementalist specialization builds on.
 */
export const elementalistCoreModule = defineNativeModule({
  canSwapWeaponSetsInCombat: false,
  id: 'Core',
  data: createNativeModuleData<ElementalistSkill>({
    id: 'Core',
    traitLines: TRAIT_LINES,
    ...WEAPON_DATA,
    skillFlips: ELEMENTALIST_CORE_SKILL_FLIPS,
    autoattackChains: ELEMENTALIST_CORE_AUTOATTACK_CHAINS,
    profileFields: ELEMENTALIST_CORE_PROFILE_FIELDS,
    skillFields: ELEMENTALIST_CORE_SKILL_FIELDS,
    skills: ELEMENTALIST_CORE_SKILLS
  }),
  state: {
    create: createElementalistCoreState,
    project: projectElementalistCorePlanningState
  },
  traitDefinitions: elementalistCoreTraits,
  /** Conjure grants use the currently held weapon so dropping it also updates lingering attacks. */
  attributes: (context) => {
    const weapon = wieldedConjure(context);
    // Holding the bundle is the eligibility rule; the conjure skill owns which attributes it grants.
    const skillId =
      weapon === 'Fiery Greatsword'
        ? ID.CONJURE_FIERY_GREATSWORD
        : weapon === 'Lightning Hammer'
          ? ID.CONJURE_LIGHTNING_HAMMER
          : null;
    const effects = skillId ? ownerAttributeEffects(requireSkill(context.balanceContext.catalog, skillId)) : [];

    return [...elementalistPassiveAttributes(context), { attributeEffects: effects }];
  },
  hooks: elementalistCoreHooks,
  presentation: bindElementalistCoreUi
});
