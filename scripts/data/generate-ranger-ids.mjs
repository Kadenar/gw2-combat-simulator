import { generateProfessionIds } from './lib/generator-utils.mjs';
import { RANGER_PET_SKILL_KEYS } from './ranger-pet-skills.mjs';

// Synthetic actions and supported variants absent from both API and supplemental records.
const FIXED_SKILLS = [
  { key: 'LESSER_MUDDY_TERRAIN', id: 13938 },
  { key: 'LESSER_CALL_OF_THE_WILD', id: 29449 },
  { key: 'PET_SWAP', id: -4 },
  { key: 'PATH_OF_SCARS_MAX_RANGE', id: -1001 },
  { key: 'ONE_WOLF_PACK_STRIKE', id: 42145 },
  { key: 'LESSER_SIC_EM', id: 79348 },
  { key: 'OVERBEARING_SMASH_SECOND_STRIKE', id: 63201 },
  { key: 'OWLS_FLIGHT', id: 72913, name: "Owl's Flight" },
  { key: 'SPIDERS_WEB', id: 72993, name: "Spider's Web" },
  { key: 'WOLFS_ONSLAUGHT', id: 73030, name: "Wolf's Onslaught" },
  { key: 'PREDATORS_AMBUSH', id: 73150, name: "Predator's Ambush" },
  { key: 'BLACK_HOLE', id: 31436, name: 'Natural Convergence - Black Hole' }
];

// Authored player/pet distinctions remain rebuildable when a generated binding is removed or first introduced.
const SKILL_KEYS = {
  ...RANGER_PET_SKILL_KEYS,
  46629: 'MAUL_BASE',
  76807: 'QUARRYS_PERIL'
};

/** Allocate every player and pet identity once so pet data uses the exact same canonical keys. */
export async function generateRangerIds({ skills: apiSkills, specializations }, petSkills) {
  const { RANGER_SUPPLEMENTAL_SKILLS } =
    await import('../../js/games/gw2/professions/ranger/data/ranger-supplemental-skills.ts');
  return generateProfessionIds({
    profession: 'ranger',
    generator: 'generate-ranger-ids',
    skills: [
      ...apiSkills.filter((skill) => ![-3, -5].includes(Number(skill.id))),
      ...RANGER_SUPPLEMENTAL_SKILLS,
      ...petSkills
    ],
    specializations,
    fixedSkills: FIXED_SKILLS,
    skillKeys: SKILL_KEYS
  });
}
