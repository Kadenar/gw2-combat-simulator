import { generateProfessionIds, writeGeneratedFiles } from './lib/generator-utils.mjs';

// Disambiguate Nature by legend so regenerating API IDs preserves readable mechanic references.
const skillNames = {
  51667: 'True Nature Assassin',
  51675: 'True Nature Dwarf',
  51696: 'True Nature Dragon',
  51713: 'True Nature Centaur',
  51714: 'True Nature Demon'
};
// Synthetic actions plus the Cosmic Wisdom button identities. The snapshot canonicalizes those audited aliases
// (external-skill-ids.ts) to their Legendary Demon skills, so no API record supplies them; logs and rotations still do.
const FIXED_SKILLS = [
  { key: 'SWAP_LEGENDS', id: -4 },
  { key: 'PAIN_ABSORPTION_ID_78505', id: 78505, name: 'Pain Absorption' },
  { key: 'BANISH_ENCHANTMENT_ID_78587', id: 78587, name: 'Banish Enchantment' },
  { key: 'EMPOWERING_MISERY_ID_78681', id: 78681, name: 'Empowering Misery' }
];

// Generate identities from one snapshot and the authored supplemental records without compiled metadata.
export async function generateRevenantIds({ skills: apiSkills, specializations: apiSpecializations }) {
  const { REVENANT_SUPPLEMENTAL_SKILLS: supplementalSkills } =
    await import('../../js/games/gw2/professions/revenant/data/revenant-supplemental-skills.ts');
  return generateProfessionIds({
    profession: 'revenant',
    generator: 'generate-revenant-ids',
    skills: [
      ...apiSkills.map((skill) => ({ ...skill, name: skillNames[skill.id] ?? skill.name })),
      ...supplementalSkills
    ],
    specializations: apiSpecializations,
    fixedSkills: FIXED_SKILLS,
    extraSource: `export const REVENANT_LEGEND_IDS = Object.freeze({
      ASSASSIN: "LegendaryAssassin", DEMON: "LegendaryDemon", DWARF: "LegendaryDwarf", CENTAUR: "LegendaryCentaur",
      DRAGON: "LegendaryDragon", RENEGADE: "LegendaryRenegade", ALLIANCE: "LegendaryAlliance", ENTITY: "LegendaryEntity"
    });`
  });
}

// The direct developer command regenerates IDs from committed source; imports remain inert.
if (import.meta.main) {
  const { SKILLS, SPECIALIZATIONS } =
    await import('../../js/games/gw2/professions/revenant/data/revenant-api-metadata.ts');
  const generated = await generateRevenantIds({ skills: SKILLS, specializations: SPECIALIZATIONS });
  await writeGeneratedFiles(generated.files);
}
