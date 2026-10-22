import {
  RANGER_PET_SKILL_IDS,
  SIMULATED_FAMILY_SKILL_IDS,
  SIMULATED_SKILL_FALLBACKS,
  SIMULATED_SKILL_OVERRIDES,
  AUTONOMOUS_PET_SKILL_IDS,
  SOULBEAST_FAMILY_SKILL_IDS,
  SOULBEAST_PET_SKILL_IDS,
  SOULBEAST_PET_FAMILY_OVERRIDES,
  SOULBEAST_ARCHETYPE_SKILL_IDS
} from './ranger-pet-skills.mjs';
import { fileURLToPath } from 'node:url';

import { mapConcurrent, serializeWithLocalImages } from './lib/generator-utils.mjs';
import { fetchManyGw2, isTerrestrialSkill } from './lib/gw2-profession-snapshot.mjs';

const WIKI_API = 'https://wiki.guildwars2.com/api.php';

async function fetchWikiPetMetadata(pet) {
  const query = new URLSearchParams({
    action: 'parse',
    prop: 'wikitext',
    format: 'json',
    formatversion: '2',
    page: pet.name
  });
  const response = await fetch(`${WIKI_API}?${query}`, {
    headers: { 'User-Agent': 'gw2-combat-simulator/2.0 Ranger generator' }
  });

  if (!response.ok) throw new Error(`${response.status} ${pet.name}`);

  const result = await response.json();
  const source = String(result.parse?.wikitext || '');

  return {
    family: String(source.match(/^\|\s*family\s*=\s*([^\n]+)/im)?.[1] || '').trim(),
    archetype: String(source.match(/^\|\s*archetype\s*=\s*([^\n]+)/im)?.[1] || '').trim()
  };
}

/** List one pet's natural attacks ahead of the commanded skills the API reports for it. */
function petSkillIds(pet, name, family) {
  return [
    ...(RANGER_PET_SKILL_IDS[name] || SIMULATED_FAMILY_SKILL_IDS[family] || []),
    ...pet.skills.map((skill) => skill.id)
  ];
}

/** Fetch the superset of commanded and autonomous pet skills once for both Ranger outputs. */
export async function fetchRangerPetSkills(pets) {
  const ids = [
    ...new Set([
      ...pets.flatMap((pet) => pet.skills.map((skill) => skill.id)),
      ...Object.values(SIMULATED_FAMILY_SKILL_IDS).flat(),
      ...Object.values(RANGER_PET_SKILL_IDS).flat()
    ])
  ];
  // Authored records never reach the API: it rejects their IDs, and a batch made only of rejected IDs fails outright.
  const fetchedSkills = await fetchManyGw2(
    'skills',
    ids.filter((id) => !SIMULATED_SKILL_FALLBACKS.has(id)),
    { preserveIdOrder: true }
  );
  const fetchedSkillById = new Map(fetchedSkills.map((skill) => [skill.id, skill]));
  const missing = [];
  const skills = ids.map((id) => {
    const authored = SIMULATED_SKILL_FALLBACKS.get(id);
    const fetched = fetchedSkillById.get(id);

    if (!authored && !fetched) missing.push(id);

    return authored ?? { ...fetched, ...SIMULATED_SKILL_OVERRIDES.get(id) };
  });

  if (missing.length) throw new Error(`Missing Ranger pet skill records: ${missing.join(', ')}`);

  return skills.filter((skill) => isTerrestrialSkill(skill));
}

/** Fetch wiki classifications independently from skill records while preserving pet order. */
export async function fetchRangerPetMetadata(pets) {
  return mapConcurrent(pets, 8, fetchWikiPetMetadata);
}

/** Render pet references exclusively from the validated ID map produced by generateRangerIds. */
export async function generateRangerPetData({ pets, skills, keyById, wikiMetadata }) {
  // Pet API lists mix land and underwater commands; references must use only the filtered skill inventory.
  const landSkillIds = new Set(skills.map((skill) => skill.id));
  const keyFor = (id) => {
    const key = keyById.get(id);

    if (!key) throw new Error(`Ranger pet data references missing skill ID ${id}`);

    return key;
  };

  const petProfiles = pets.map((pet, index) => {
    const name = pet.name.replace(/^Juvenile\s+/, '');
    const metadata = wikiMetadata[index];
    const family = String(SOULBEAST_PET_FAMILY_OVERRIDES[name] || metadata.family).toLowerCase();

    return {
      pet,
      name,
      family,
      archetypeKey: metadata.archetype.toLowerCase(),
      skillIds: petSkillIds(pet, name, family).filter((id) => landSkillIds.has(id))
    };
  });
  const skillLines = skills.map((skill) => {
    const recharge = skill.recharge || skill.facts?.find((fact) => fact.type === 'Recharge')?.value || 0;
    // Family attacks belong to every pet that receives them, not only pets whose API record lists the skill.
    const petNames = [
      ...new Set([
        ...(skill.petNames || []),
        ...petProfiles.filter(({ skillIds }) => skillIds.includes(skill.id)).map(({ name }) => name)
      ])
    ];

    return `  {
    id: ID.${keyFor(skill.id)},
    name: ${JSON.stringify(skill.name)},
    description: ${JSON.stringify(skill.description || '')},
    icon: ${serializeWithLocalImages(skill.icon || '')},
    type: "Profession",
    slot: "Profession_2",
    categories: ["Pet"],
    specialization: "",
    cooldown: ${Number(recharge)},
    petSkill: true,
    petFamilySkill: ${AUTONOMOUS_PET_SKILL_IDS.has(skill.id)},
    petAutonomousSkill: ${AUTONOMOUS_PET_SKILL_IDS.has(skill.id)},
    petNames: ${JSON.stringify(petNames)},
  },`;
  });
  const petLines = petProfiles.map(({ pet, name, family, archetypeKey, skillIds }) => {
    const archetype = archetypeKey ? `${archetypeKey[0].toUpperCase()}${archetypeKey.slice(1)}` : '';
    // A merge skill the profession snapshot does not expose yet is dropped with the warning below instead of
    // aborting the refresh; every reference that is emitted still resolves through the validated ID map.
    const beastmodeSkillIds = [
      ...(SOULBEAST_PET_SKILL_IDS[name] || SOULBEAST_FAMILY_SKILL_IDS[family] || []),
      SOULBEAST_ARCHETYPE_SKILL_IDS[archetypeKey]
    ].filter((id) => keyById.has(id));

    if (beastmodeSkillIds.length !== 3) {
      console.warn(`Expected three Soulbeast skills for ${name}; received ${beastmodeSkillIds.join(', ') || 'none'}.`);
    }

    return `  {
    id: ${pet.id},
    name: ${JSON.stringify(name)},
    icon: ${JSON.stringify(pet.icon || '')},
    description: ${JSON.stringify(pet.description || '')},
    family: ${JSON.stringify(family)},
    archetype: ${JSON.stringify(archetype)},
    skillIds: [${skillIds.map((id) => `ID.${keyFor(id)}`).join(', ')}],
    beastmodeSkillIds: [${beastmodeSkillIds.map((id) => `ID.${keyFor(id)}`).join(', ')}],
  },`;
  });

  const source = `// Generated by scripts/data/generate-ranger-pet-data.mjs.
// Pet identities are absent from the profession skill endpoint and are committed here.
import { RANGER_SKILL_IDS as ID } from "#gw2/professions/ranger/data/ids.js";
import type { RangerPetDefinition, RangerSkill } from "#gw2/professions/ranger/types.js";

export const RANGER_PET_SKILLS: readonly RangerSkill[] = Object.freeze([
${skillLines.join('\n')}
]);

export const RANGER_PETS: readonly RangerPetDefinition[] = Object.freeze([
${petLines.join('\n')}
]);
`;

  const target = fileURLToPath(
    new URL('../../js/games/gw2/professions/ranger/data/ranger-pet-data.ts', import.meta.url)
  );

  return { files: [{ target, source, summary: `${skills.length} pet skills and ${pets.length} pets` }] };
}
