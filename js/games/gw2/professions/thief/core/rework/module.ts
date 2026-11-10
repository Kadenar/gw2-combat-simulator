import { createNativeModuleData } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { THIEF_CORE_PROFILE_FIELDS, THIEF_CORE_SKILL_FIELDS } from '#gw2/professions/thief/core/catalog-fields.js';
import { thiefCoreModule } from '#gw2/professions/thief/core/module.js';
import { thiefCoreReworkHooks } from '#gw2/professions/thief/core/rework/hooks.js';
import { THIEF_CORE_REWORK_TRAIT_IDS as REWORK } from '#gw2/professions/thief/core/rework/ids.js';
import { thiefCoreReworkUi } from '#gw2/professions/thief/core/rework/presentation.js';
import { createThiefCoreReworkState } from '#gw2/professions/thief/core/rework/state.js';
import { acrobaticsReworkTraits } from '#gw2/professions/thief/core/rework/traits/acrobatics.js';
import { twinFangsRework } from '#gw2/professions/thief/core/rework/traits/critical-strikes.js';
import { thiefPassiveAttributes } from '#gw2/professions/thief/core/skills/attribute-passives.js';
import { THIEF_CORE_AUTOATTACK_CHAINS } from '#gw2/professions/thief/core/skills/autoattack-chains.js';
import { THIEF_CORE_SKILLS } from '#gw2/professions/thief/core/skills/index.js';
import { THIEF_CORE_SKILL_FLIPS } from '#gw2/professions/thief/core/skills/skill-flips.js';
import { projectThiefCorePlanningState } from '#gw2/professions/thief/core/state.js';
import { coreTraits } from '#gw2/professions/thief/core/traits/index.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { TRAIT_LINES } from '#gw2/professions/thief/data/trait-lines.js';
import type { ThiefSkill } from '#gw2/professions/thief/types.js';

// This trait rework replaces Core as a unit, retaining its skill chains, follow-up admission, and fields.
/** Replace the legal Acrobatics layout without interpreting existing Live positions as different preview choices. */
const traitLines = TRAIT_LINES.filter((line) => !line.elite).map((line) => {
  if (line.name !== 'Acrobatics') return line;

  const metadata = new Map([...line.minorTraits, ...line.majorTraits.flat()].map((trait) => [trait.id, trait]));
  // A replacement keeps the moved trait's artwork under its preview identity and name.
  const changed = (oldId: number, id: number | string, name: string) => ({ ...metadata.get(oldId)!, id, name });
  return {
    ...line,
    minorTraits: line.minorTraits.map((trait) =>
      trait.id === TRAIT.EXPEDITIOUS_DODGER ? changed(trait.id, REWORK.DEFT_INITIATION, 'Deft Initiation') : trait
    ),
    majorTraits: [
      [
        changed(TRAIT.INSTANT_REFLEXES, REWORK.OPPORTUNE_OPENING, 'Opportune Opening'),
        changed(TRAIT.PUMPING_UP, REWORK.ENDURANCE_TRAINING, 'Endurance Training'),
        metadata.get(TRAIT.PAIN_RESPONSE)!
      ],
      [
        metadata.get(TRAIT.ASSASSINS_REWARD)!,
        metadata.get(TRAIT.SWINDLERS_EQUILIBRIUM)!,
        metadata.get(TRAIT.HARD_TO_CATCH)!
      ],
      [
        changed(TRAIT.ASSASSINS_REWARD, REWORK.SHARP_INITIATION, 'Sharp Initiation'),
        metadata.get(TRAIT.UPPER_HAND)!,
        metadata.get(TRAIT.DONT_STOP)!
      ]
    ]
  };
});

const replaced = new Set<number | string>([TRAIT.PUMPING_UP, TRAIT.HARD_TO_CATCH, TRAIT.TWIN_FANGS]);

/** Recompile raw shared declarations with replacement traits, state, and presentation; Live remains independent. */
export const thiefCoreReworkModule = defineNativeModule({
  id: 'Core',
  data: createNativeModuleData<ThiefSkill>({
    id: 'Core',
    traitLines,
    weapons: thiefCoreModule.data.weapons,
    weaponHands: thiefCoreModule.data.weaponHands,
    autoattackChains: THIEF_CORE_AUTOATTACK_CHAINS,
    skillFlips: THIEF_CORE_SKILL_FLIPS,
    profileFields: THIEF_CORE_PROFILE_FIELDS,
    skillFields: THIEF_CORE_SKILL_FIELDS,
    skills: THIEF_CORE_SKILLS
  }),
  state: {
    create: createThiefCoreReworkState,
    // Rework-only combat bookkeeping stays private; both Core variants expose the same observations.
    project: projectThiefCorePlanningState
  },
  traitDefinitions: [
    ...coreTraits.filter((trait) => !replaced.has(trait.id)),
    ...acrobaticsReworkTraits,
    twinFangsRework
  ],
  attributes: thiefPassiveAttributes,
  hooks: thiefCoreReworkHooks,
  presentation: thiefCoreReworkUi
});
