import { defineNativeModule } from '#gw2/platform/profession-definition/profession.js';
import { createPublicStateProjector } from '#gw2/platform/profession-definition/state.js';
import { THIEF_CORE_BALANCE_PROFILES } from '#gw2/professions/thief/core/profiles.js';
import { thiefPassiveAttributes } from '#gw2/professions/thief/core/skills/attribute-passives.js';
import { THIEF_CORE_EXTRA_SKILLS, THIEF_CORE_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/index.js';
import { distractingThrowModifiers } from '#gw2/professions/thief/core/skills/weapons/spear.js';
import { coreTraits } from '#gw2/professions/thief/core/traits/index.js';
import { createThiefModuleData } from '#gw2/professions/thief/data/module-data.js';
import { SPECIALIZATIONS } from '#gw2/professions/thief/data/thief-api-metadata.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_REWORK_TRAIT_IDS as REWORK } from '#gw2/professions/thief/core/rework/ids.js';
import { thiefCoreReworkHooks } from '#gw2/professions/thief/core/rework/hooks.js';
import { thiefCoreReworkUi } from '#gw2/professions/thief/core/rework/presentation.js';
import {
  createThiefCoreReworkState,
  THIEF_CORE_REWORK_PUBLIC_STATE_PROJECTION
} from '#gw2/professions/thief/core/rework/state.js';
import { acrobaticsReworkTraits } from '#gw2/professions/thief/core/rework/traits/acrobatics.js';
import { twinFangsRework } from '#gw2/professions/thief/core/rework/traits/critical-strikes.js';

const data = createThiefModuleData('Core', {
  skillMechanics: THIEF_CORE_SKILL_MECHANICS,
  balanceProfiles: THIEF_CORE_BALANCE_PROFILES,
  extraSkills: THIEF_CORE_EXTRA_SKILLS
});
const descriptions: Record<string, string> = {
  [REWORK.DEFT_INITIATION]:
    'Your first direct strike in combat grants might and inflicts vulnerability. Completing movement or a shadowstep refreshes it. Payloads and no internal cooldown are provisional.',
  [TRAIT.FELINE_GRACE]:
    'Completing movement or a shadowstep grants swiftness. Duration and no internal cooldown are provisional. Improved movement speed is outside simulation scope.',
  [REWORK.OPPORTUNE_OPENING]:
    'Deft Initiation inflicts cripple. Deal increased strike damage against crippled, chilled, or immobilized targets. Strike-only multiplicative scaling is provisional; default target assumptions keep this active.',
  [REWORK.ENDURANCE_TRAINING]:
    'Gain vigor upon successfully evading an attack. Incoming attacks and successful evades are outside simulation scope.',
  [TRAIT.ASSASSINS_REWARD]:
    'Deft Initiation heals you. Healing is outside simulation scope; player health remains full.',
  [TRAIT.HARD_TO_CATCH]:
    'Completing a Steal or replacement grants resistance. Duration is provisional; its defensive effect is outside simulation scope.',
  [REWORK.SHARP_INITIATION]:
    'Deft Initiation deals an additional strike using the unequipped weapon-strength profile. Coefficient, critical-hit eligibility and strength profile are provisional.',
  [TRAIT.DONT_STOP]:
    'Receiving swiftness grants endurance. Amount and no internal cooldown are provisional. Removing conditions from the player is outside simulation scope.',
  [TRAIT.TWIN_FANGS]:
    'Gain critical damage. A direct hit against a defiant target grants a temporary critical-chance bonus to later hits. Duration is provisional.'
};

/** Replace the legal layout without interpreting existing Live positions as different preview choices. */
const specializations = SPECIALIZATIONS.filter((line) =>
  data.specializations!.some((entry) => entry.id === line.id)
).map((line) => {
  const describe = (trait: (typeof line.minorTraits)[number]) => ({
    ...trait,
    description: descriptions[trait.id] ?? trait.description
  });

  if (line.name === 'Critical Strikes')
    return { ...line, majorTraits: line.majorTraits.map((tier) => tier.map(describe)) };

  if (line.name !== 'Acrobatics') return line;

  const metadata = new Map([...line.minorTraits, ...line.majorTraits.flat()].map((trait) => [trait.id, trait]));
  const changed = (oldId: number, id: number | string, name: string, tier: number, position: number) => ({
    ...metadata.get(oldId)!,
    id,
    name,
    tier,
    position,
    description: descriptions[id]
  });
  return {
    ...line,
    minorTraits: line.minorTraits.map((trait) =>
      trait.id === TRAIT.EXPEDITIOUS_DODGER
        ? changed(trait.id, REWORK.DEFT_INITIATION, 'Deft Initiation', 1, 0)
        : describe(trait)
    ),
    majorTraits: [
      [
        changed(TRAIT.INSTANT_REFLEXES, REWORK.OPPORTUNE_OPENING, 'Opportune Opening', 1, 1),
        changed(TRAIT.PUMPING_UP, REWORK.ENDURANCE_TRAINING, 'Endurance Training', 1, 2),
        metadata.get(TRAIT.PAIN_RESPONSE)!
      ],
      [
        changed(TRAIT.ASSASSINS_REWARD, TRAIT.ASSASSINS_REWARD, "Assassin's Reward", 2, 1),
        metadata.get(TRAIT.SWINDLERS_EQUILIBRIUM)!,
        describe(metadata.get(TRAIT.HARD_TO_CATCH)!)
      ],
      [
        changed(TRAIT.ASSASSINS_REWARD, REWORK.SHARP_INITIATION, 'Sharp Initiation', 3, 1),
        metadata.get(TRAIT.UPPER_HAND)!,
        describe(metadata.get(TRAIT.DONT_STOP)!)
      ]
    ]
  };
});

const replaced = new Set<number | string>([TRAIT.PUMPING_UP, TRAIT.HARD_TO_CATCH, TRAIT.TWIN_FANGS]);

/** Recompile raw shared declarations with replacement traits, state, and presentation; Live remains independent. */
export const thiefCoreReworkModule = defineNativeModule({
  id: 'Core',
  attributes: thiefPassiveAttributes,
  data: {
    ...data,
    specializations,
    traits: specializations.flatMap((line) => [...line.minorTraits, ...line.majorTraits.flat()])
  },
  traitDefinitions: [
    ...coreTraits.filter((trait) => !replaced.has(trait.id)),
    ...acrobaticsReworkTraits,
    twinFangsRework
  ],
  state: {
    create: createThiefCoreReworkState,
    project: createPublicStateProjector(THIEF_CORE_REWORK_PUBLIC_STATE_PROJECTION)
  },
  modifiers: distractingThrowModifiers,
  hooks: thiefCoreReworkHooks,
  presentation: thiefCoreReworkUi
});
