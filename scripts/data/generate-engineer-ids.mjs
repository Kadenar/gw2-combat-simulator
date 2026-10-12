import { generateProfessionIds, writeGeneratedFiles } from './lib/generator-utils.mjs';

// Distinguish non-Holosmith sword variants that share API names with Holosmith skills.
const NON_HOLOSMITH_SWORD_IDS = new Set([69565, 69906, 70514, 70771, 71121]);

// Preserve the authored non-Holosmith naming policy independently of API display names.
function skillName(skill) {
  if (NON_HOLOSMITH_SWORD_IDS.has(Number(skill.id))) return `${skill.name} Non Holosmith`;
  return skill.name;
}

// Generate identities from one snapshot and the authored supplemental records without compiled metadata.
export async function generateEngineerIds({ skills: apiSkills, specializations: apiSpecializations }) {
  const { ENGINEER_SUPPLEMENTAL_SKILLS: supplementalSkills } =
    await import('../../js/games/gw2/professions/engineer/data/engineer-supplemental-skills.ts');
  return generateProfessionIds({
    profession: 'engineer',
    generator: 'generate-engineer-ids',
    skills: [...apiSkills, ...supplementalSkills].map((skill) => ({ ...skill, name: skillName(skill) })),
    specializations: apiSpecializations,
    fixedSkills: [
      { key: 'STOW_ELITE_MORTAR_KIT', id: -301 },
      { key: 'EVOLVE_BASE', id: 76642 },
      { key: 'EVOLVE_DOUBLE_HELIX', id: 76651 }
    ]
  });
}

// The direct developer command regenerates IDs from committed source; imports remain inert.
if (import.meta.main) {
  const { SKILLS, SPECIALIZATIONS } =
    await import('../../js/games/gw2/professions/engineer/data/engineer-api-metadata.ts');
  const generated = await generateEngineerIds({ skills: SKILLS, specializations: SPECIALIZATIONS });
  await writeGeneratedFiles(generated.files);
}
