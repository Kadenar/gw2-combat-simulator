import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const API_ROOT = 'https://api.guildwars2.com/v2';
const WIKI_API = 'https://wiki.guildwars2.com/api.php';

const SOULBEAST_FAMILY_SKILL_IDS = Object.freeze({
  'aether hunter': [71282, 70889],
  'armor fish': [42717, 44885],
  bear: [43136, 43060],
  ursine: [43136, 43060],
  avian: [44991, 42042],
  bird: [44991, 42042],
  bristleback: [41206, 45479],
  canine: [43726, 42894],
  chak: [71499, 71546],
  devourer: [43068, 41461],
  drake: [41537, 41575],
  feline: [40625, 44514],
  'fanged iboga': [44384, 40111],
  jacaranda: [43788, 43701],
  jellyfish: [43186, 41837],
  moa: [44617, 43548],
  phoenix: [64038, 41908],
  porcine: [41406, 46432],
  'rock gazelle': [41524, 45743],
  shark: [42797, 44360],
  smokescale: [42907, 40255],
  spinegazer: [72851, 72636],
  spider: [44097, 43671],
  turtle: [64699, 66258],
  warclaw: [73733, 73938],
  wyvern: [46386, 41908],
  'janthiri bee': [75771, 75814],
  'raptor swiftwing': [79203, 78091],
  'river otter': [80035, 80031]
});

const SIMULATED_FAMILY_SKILL_IDS = Object.freeze({
  devourer: [12676, 12673],
  feline: [12655, 12694, 12657],
  'fanged iboga': [43734, 41864, 45262],
  spider: [12724]
});
const AUTONOMOUS_PET_SKILL_IDS = new Set([12655, 12657, 12676, 12673, 12694, 12703, 43734, 41864, 41156]);
const SIMULATED_SKILL_FALLBACKS = new Map([
  [
    12655,
    {
      id: 12655,
      name: 'Slash',
      description: 'Slash at your foe.',
      icon: 'https://wiki.guildwars2.com/images/c/c3/Maul_%28feline%29.png',
      recharge: 0,
      petNames: ['Tiger']
    }
  ],
  [
    12657,
    {
      id: 12657,
      name: 'Maul',
      description: 'Slash a foe multiple times and make them bleed.',
      icon: 'https://wiki.guildwars2.com/images/c/c3/Maul_%28feline%29.png',
      recharge: 16,
      petNames: ['Tiger']
    }
  ],
  [
    12673,
    {
      id: 12673,
      name: 'Tail Lash',
      description: 'Push back a foe with your tail.',
      icon: 'https://wiki.guildwars2.com/images/f/f5/Tail_Lash.png',
      recharge: 20,
      petNames: ['Carrion Devourer', 'Whiptail Devourer', 'Lashtail Devourer']
    }
  ],
  [
    12694,
    {
      id: 12694,
      name: 'Bite',
      description: 'Bite your foe for severe damage.',
      icon: 'https://wiki.guildwars2.com/images/c/c2/Bite_%28feline%29.png',
      recharge: 8,
      petNames: ['Tiger']
    }
  ],
  [
    43734,
    {
      id: 43734,
      name: 'Consuming Bite',
      description: 'Bite foes, dealing additional damage for each condition afflicting anyone struck.',
      icon: 'https://wiki.guildwars2.com/images/6/68/Consuming_Bite.png',
      recharge: 0,
      petNames: ['Fanged Iboga']
    }
  ],
  [
    41864,
    {
      id: 41864,
      name: 'Crippling Anguish',
      description: 'Launch a projectile that inflicts conditions.',
      icon: 'https://wiki.guildwars2.com/images/c/c8/Crippling_Anguish.png',
      recharge: 10,
      petNames: ['Fanged Iboga']
    }
  ],
  [
    45262,
    {
      id: 45262,
      name: 'Narcotic Spores',
      description: 'Spit a glob of confusing spores at a foe, inflicting confusion at that location.',
      icon: 'https://wiki.guildwars2.com/images/8/84/Narcotic_Spores.png',
      recharge: 15,
      petNames: ['Fanged Iboga']
    }
  ]
]);
const SIMULATED_SKILL_OVERRIDES = new Map([
  [
    12676,
    {
      icon: 'https://render.guildwars2.com/file/9D3C1CD36EAFF4F4F5E4EB7B41C318771E579C78/103583.png'
    }
  ],
  [12724, { icon: 'https://wiki.guildwars2.com/images/3/3a/Spit.png' }],
  ...SIMULATED_SKILL_FALLBACKS
]);
const SIMULATED_SKILL_KEY_OVERRIDES = new Map([
  [12655, 'FELINE_SLASH'],
  [12657, 'FELINE_MAUL'],
  [12673, 'PET_TAIL_LASH'],
  [12694, 'FELINE_BITE'],
  [41864, 'CRIPPLING_ANGUISH_PET'],
  [45262, 'NARCOTIC_SPORES_PET']
]);

const SOULBEAST_PET_FAMILY_OVERRIDES = Object.freeze({
  'Aether Hunter': 'aether hunter',
  'Armor Fish': 'armor fish',
  Bristleback: 'bristleback',
  'Fanged Iboga': 'fanged iboga',
  Jacaranda: 'jacaranda',
  'Janthiri Bee': 'janthiri bee',
  Phoenix: 'phoenix',
  'Raptor Swiftwing': 'raptor swiftwing',
  'River Otter': 'river otter',
  'Rock Gazelle': 'rock gazelle',
  'Siege Turtle': 'turtle',
  'Sky-Chak Striker': 'chak',
  Smokescale: 'smokescale',
  Spinegazer: 'spinegazer',
  Warclaw: 'warclaw'
});

const SOULBEAST_ARCHETYPE_SKILL_IDS = Object.freeze({
  stout: 45797,
  deadly: 40588,
  versatile: 43375,
  ferocious: 40729,
  supportive: 44626
});

async function fetchJson(pathname) {
  const response = await fetch(`${API_ROOT}${pathname}${pathname.includes('?') ? '&' : '?'}lang=en`);

  if (!response.ok) throw new Error(`${response.status} ${pathname}`);

  return response.json();
}

async function fetchMany(endpoint, ids) {
  const result = [];

  for (let index = 0; index < ids.length; index += 100) {
    result.push(...(await fetchJson(`/${endpoint}?ids=${ids.slice(index, index + 100).join(',')}`)));
  }

  return result;
}

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

async function mapConcurrent(values, limit, callback) {
  const output = new Array(values.length);
  let next = 0;

  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < values.length) {
        const index = next++;

        output[index] = await callback(values[index]);
      }
    })
  );

  return output;
}

function constantName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

// Generates pet records against the same fetched skill snapshot used by the
// rest of the Ranger refresh, avoiding an import of uncompiled TypeScript.
export async function generateRangerPetData({ skills: apiSkills }) {
  const usedNames = new Set();
  const keyById = new Map();

  function keyFor(skill) {
    const override = SIMULATED_SKILL_KEY_OVERRIDES.get(Number(skill.id));
    const base = override || constantName(skill.name);
    const key = usedNames.has(base) ? `${base}_ID_${skill.id}` : base;

    usedNames.add(base);
    keyById.set(skill.id, key);

    return key;
  }

  for (const skill of apiSkills) keyFor(skill);

  const petIds = await fetchJson('/pets');
  const pets = await fetchMany('pets', petIds);
  const wikiMetadata = await mapConcurrent(pets, 8, fetchWikiPetMetadata);
  const petSkillIds = [
    ...new Set([
      ...pets.flatMap((pet) => pet.skills.map((skill) => skill.id)),
      ...Object.values(SIMULATED_FAMILY_SKILL_IDS).flat()
    ])
  ];
  const fetchedSkills = await fetchMany('skills', petSkillIds);
  const fetchedSkillById = new Map(fetchedSkills.map((skill) => [skill.id, skill]));
  const skills = petSkillIds
    .map((id) => {
      const skill = fetchedSkillById.get(id) || SIMULATED_SKILL_FALLBACKS.get(id);
      const override = SIMULATED_SKILL_OVERRIDES.get(id);

      return skill ? { ...skill, ...override } : null;
    })
    .filter(Boolean);

  for (const skill of skills) keyFor(skill);
  const skillById = new Map(skills.map((skill) => [skill.id, skill]));

  const skillLines = skills.map((skill) => {
    const recharge = skill.recharge || skill.facts?.find((fact) => fact.type === 'Recharge')?.value || 0;
    const petNames =
      skill.petNames ||
      pets
        .filter((pet) => pet.skills.some((candidate) => candidate.id === skill.id))
        .map((pet) => pet.name.replace(/^Juvenile\s+/, ''));

    return `  {
    id: ID.${keyById.get(skill.id)},
    name: ${JSON.stringify(skill.name)},
    description: ${JSON.stringify(skill.description || '')},
    icon: ${JSON.stringify(skill.icon || '')},
    type: "Profession",
    slot: "Profession_2",
    categories: ["Pet"],
    specialization: "",
    recharge: ${Number(recharge)},
    cooldown: ${Number(recharge)},
    petSkill: true,
    petFamilySkill: ${AUTONOMOUS_PET_SKILL_IDS.has(skill.id)},
    petAutonomousSkill: ${AUTONOMOUS_PET_SKILL_IDS.has(skill.id)},
    petNames: ${JSON.stringify(petNames)},
  },`;
  });
  const petLines = pets.map((pet, index) => {
    const name = pet.name.replace(/^Juvenile\s+/, '');
    const metadata = wikiMetadata[index];
    const family = String(SOULBEAST_PET_FAMILY_OVERRIDES[name] || metadata.family).toLowerCase();
    const archetypeKey = metadata.archetype.toLowerCase();
    const archetype = archetypeKey ? `${archetypeKey[0].toUpperCase()}${archetypeKey.slice(1)}` : '';
    const beastmodeSkillIds = [
      ...(SOULBEAST_FAMILY_SKILL_IDS[family] || []),
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
    skillIds: [${[...(SIMULATED_FAMILY_SKILL_IDS[family] || []), ...pet.skills.map((skill) => skill.id)]
      .map((id) => `ID.${keyById.get(id)}`)
      .join(', ')}],
    beastmodeSkillIds: [${beastmodeSkillIds.map((id) => `ID.${keyById.get(id)}`).join(', ')}],
  },`;
  });

  const source = `// Generated by scripts/data/generate-ranger-pet-data.mjs.
// Pet identities are absent from the profession skill endpoint and are committed here.
import { RANGER_SKILL_IDS as ID } from "./ids.js";
import type { RangerPetDefinition, RangerSkill } from "../types.js";

export const RANGER_PET_SKILLS: readonly RangerSkill[] = Object.freeze([
${skillLines.join('\n')}
]);

export const RANGER_PETS: readonly RangerPetDefinition[] = Object.freeze([
${petLines.join('\n')}
]);
`;

  const target = fileURLToPath(new URL('../../js/professions/ranger/data/ranger-pet-data.ts', import.meta.url));

  await writeFile(target, source, 'utf8');
  console.log(`Wrote ${skills.length} Ranger pet skills and ${pets.length} pets.`);
}
