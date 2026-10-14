import { fileURLToPath } from 'node:url';

import { mapConcurrent } from './lib/generator-utils.mjs';
import { fetchManyGw2 } from './lib/gw2-profession-snapshot.mjs';

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

// Natural attacks shared by every pet of a family; the API lists only each pet's commanded Beast skill.
const SIMULATED_FAMILY_SKILL_IDS = Object.freeze({
  devourer: [12676],
  'fanged iboga': [43734, 41864, 45262],
  spider: [12724]
});
// Modeled pets retain family membership while receiving their specific AI and merged overrides. A pet listed here
// replaces its family list, so only pets whose natural attacks were measured in logs gain autonomous skills.
const SIMULATED_PET_SKILL_IDS = Object.freeze({
  // Wallow uses its own AI skills while retaining the Porcine family for traits.
  Wallow: [64891, 67277, 67084],
  // Hawk exposes its bird AI separately from the commanded Beast skill.
  Hawk: [12682, 12719, 12720],
  Boar: [12735, 12734, 12738],
  'Aether Hunter': [69822, 70950, 70332],
  'Raptor Swiftwing': [78335, 78204, 77805],
  // Other felines keep only their Beast skill until their natural attacks are measured.
  Tiger: [12655, 12694, 12657],
  'Carrion Devourer': [12676, 12673],
  // Jacaranda's AI skills are separate identities from the Soulbeast merge skills of the same name.
  Jacaranda: [45990, 40487, 41710]
});
const SOULBEAST_PET_SKILL_IDS = Object.freeze({ Wallow: [41406, 64882] });
const AUTONOMOUS_PET_SKILL_IDS = new Set([
  // These API-omitted natural attacks become explicit commands on Untamed.
  12735, 12734, 12738, 69822, 70950, 70332, 78335, 78204, 77805, 12655, 12657, 12676, 12673, 12694, 12703, 43734, 41864,
  45262, 64891, 67277, 67084, 12682, 12719, 12720, 45990, 40487, 41710
]);
// Spit is a family attack rather than a Beast command, but the pet AI does not cast it in the simulation.
const FAMILY_ONLY_PET_SKILL_IDS = new Set([12724]);
// API-omitted pet skills reuse their verified Soulbeast CDN artwork where available. Every record here is authored in
// full because /v2/skills rejects its ID; recharges are the natural-attack intervals measured in unquickened pet logs.
const SIMULATED_SKILL_FALLBACKS = new Map([
  [
    12735,
    {
      id: 12735,
      name: 'Jab',
      description: 'Jab your foe with your tusks.',
      icon: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Jab_(porcine).png',
      recharge: 0,
      petNames: ['Boar']
    }
  ],
  [
    12734,
    {
      id: 12734,
      name: 'Maul',
      description: 'Maul your foes and make them bleed.',
      icon: 'https://render.guildwars2.com/file/24073F5A0566ABE32DFB74204E9FA01025D85D71/104055.png',
      recharge: 10,
      petNames: ['Boar']
    }
  ],
  [
    12738,
    {
      id: 12738,
      name: 'Brutal Charge',
      description: 'Charge your foes and knock them down.',
      icon: 'https://render.guildwars2.com/file/D89C043113B1B24AE538C6F5DC297924459E3EBA/104054.png',
      recharge: 24,
      petNames: ['Boar']
    }
  ],
  [
    69822,
    {
      id: 69822,
      name: 'Bite',
      description: 'Bite at your foe and inflict bleeding.',
      icon: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Bite_(aether_hunter).png',
      recharge: 0,
      petNames: ['Aether Hunter']
    }
  ],
  [
    70950,
    {
      id: 70950,
      name: 'Lunge',
      description: 'Lunge forward, crippling opponents in the path.',
      icon: 'https://render.guildwars2.com/file/B65ECEBB72F4F10C4144510777E899E477DEE5B2/3124960.png',
      recharge: 8,
      petNames: ['Aether Hunter']
    }
  ],
  [
    70332,
    {
      id: 70332,
      name: 'Ley-Line Vortex',
      description: 'Spin around, striking and tormenting nearby enemies.',
      icon: 'https://render.guildwars2.com/file/030E7AB1CB18A4B348FD17B54B2B68FDABDB1DBC/3124961.png',
      recharge: 20,
      petNames: ['Aether Hunter']
    }
  ],
  [
    78335,
    {
      id: 78335,
      name: 'Claw',
      description: 'Rake your enemy with sharp claws.',
      icon: 'https://wiki.guildwars2.com/wiki/Special:Redirect/file/Claw_(raptor_swiftwing).png',
      recharge: 0,
      petNames: ['Raptor Swiftwing']
    }
  ],
  [
    78204,
    {
      id: 78204,
      name: 'Saurian Might',
      description: 'Smash the ground before you with primal strength.',
      icon: 'https://render.guildwars2.com/file/6A21666A796F0FCC59C513DAEAF6073161034004/3713166.png',
      recharge: 10,
      petNames: ['Raptor Swiftwing']
    }
  ],
  [
    77805,
    {
      id: 77805,
      name: 'Leaping Lizard',
      description: 'Leap through the air, crippling enemies upon landing.',
      icon: 'https://render.guildwars2.com/file/4BACB4F4A1A9BABF560CDF59A9016CDEB516E571/3713167.png',
      recharge: 15,
      petNames: ['Raptor Swiftwing']
    }
  ],
  [
    12682,
    {
      id: 12682,
      name: 'Slash',
      description: 'Slash your foe.',
      icon: 'https://wiki.guildwars2.com/images/b/b6/Slash_%28bird%29.png',
      recharge: 0,
      petNames: ['Hawk']
    }
  ],
  [
    12719,
    {
      id: 12719,
      name: 'Swoop',
      description: 'Swoop at your foe, making them vulnerable.',
      icon: 'https://render.guildwars2.com/file/FCCA3C61C308E1D625C70BD4CCB9F05051AE6F6F/104047.png',
      recharge: 8,
      petNames: ['Hawk']
    }
  ],
  [
    12720,
    {
      id: 12720,
      name: 'Quickening Screech',
      description: 'Grant swiftness to nearby allies and remove movement-impairing conditions from them.',
      icon: 'https://render.guildwars2.com/file/69F1291534027E0937A5C020FFEBCC96F301EC54/104048.png',
      recharge: 20,
      petNames: ['Hawk']
    }
  ],
  [
    64891,
    {
      id: 64891,
      name: 'Vampiric Bite',
      description: 'Bite your foe, siphoning health.',
      icon: 'https://render.guildwars2.com/file/0901C0B004F60F4DB5B4B503BF35B09278AA4491/2604860.png',
      recharge: 0,
      petNames: ['Wallow']
    }
  ],
  [
    67277,
    {
      id: 67277,
      name: 'Maul',
      description: 'Maul your foes and make them bleed.',
      // Wallow shares the Porcine Maul artwork; there is no separate Wallow icon.
      icon: 'https://render.guildwars2.com/file/24073F5A0566ABE32DFB74204E9FA01025D85D71/104055.png',
      recharge: 12,
      petNames: ['Wallow']
    }
  ],
  [
    67084,
    {
      id: 67084,
      name: 'Undead Plague',
      description: 'Emit noxious fumes that poison foes. Poison duration is increased on disabled foes.',
      icon: 'https://render.guildwars2.com/file/28CBACDF0A6D07087766675435495E087F67BE6F/2604859.png',
      recharge: 20,
      petNames: ['Wallow']
    }
  ],
  [
    12655,
    {
      id: 12655,
      name: 'Slash',
      description: 'Slash at your foe.',
      icon: 'https://render.guildwars2.com/file/D5420B910EE4DA1D2F63AEC71F4DF862E414D6E1/103515.png',
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
      icon: 'https://render.guildwars2.com/file/D5420B910EE4DA1D2F63AEC71F4DF862E414D6E1/103515.png',
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
      icon: 'https://render.guildwars2.com/file/086363EFF41571AD74CD1B506DF2B2F6F1F038D1/104029.png',
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
      icon: 'https://render.guildwars2.com/file/520693759A79FD464CA7AD08947D10B4B50F7A96/103516.png',
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
      icon: 'https://render.guildwars2.com/file/DF000038FF639A0601ECBC46222467D6FECE7046/1770580.png',
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
      icon: 'https://render.guildwars2.com/file/510AE44E0E0452005337386A66526522F817424E/1770581.png',
      recharge: 15,
      petNames: ['Fanged Iboga']
    }
  ],
  [
    45990,
    {
      id: 45990,
      name: 'Root Slap',
      description: 'Strike your target with roots.',
      icon: 'https://wiki.guildwars2.com/images/7/7d/Root_Slap.png',
      recharge: 0,
      petNames: ['Jacaranda']
    }
  ],
  [
    40487,
    {
      id: 40487,
      name: 'Call Lightning',
      description: 'Call lightning to a small area.',
      // Jacaranda's shared skill artwork stays on ArenaNet's CDN.
      icon: 'https://render.guildwars2.com/file/731C0827CBB7E4015F3C45B4C49C58B42416BFA8/1770576.png',
      // An Untamed command with Pack Alpha repeats every 9.6 s in the pet-only log: 12 s before the trait.
      recharge: 12,
      petNames: ['Jacaranda']
    }
  ],
  [
    41710,
    {
      id: 41710,
      name: 'Photosynthesize',
      description: 'Restore health, gain regeneration, and remove conditions.',
      icon: 'https://render.guildwars2.com/file/976A0CC4EA0F36C8A4A705FDE22F03D65CD050D1/1770577.png',
      // The autonomous pet owns this recharge; the merged Soulbeast skill has a separate identity.
      recharge: 20,
      petNames: ['Jacaranda']
    }
  ]
]);
// Authored corrections layered over records the API does return.
const SIMULATED_SKILL_OVERRIDES = new Map([
  [
    12676,
    {
      icon: 'https://render.guildwars2.com/file/9D3C1CD36EAFF4F4F5E4EB7B41C318771E579C78/103583.png'
    }
  ],
  [12724, { icon: 'https://render.guildwars2.com/file/B7A1AB65571565525A5C35DBCBEF0326DF65C3FA/104050.png' }]
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
    ...(SIMULATED_PET_SKILL_IDS[name] || SIMULATED_FAMILY_SKILL_IDS[family] || []),
    ...pet.skills.map((skill) => skill.id)
  ];
}

/** Fetch the superset of commanded and autonomous pet skills once for both Ranger outputs. */
export async function fetchRangerPetSkills(pets) {
  const ids = [
    ...new Set([
      ...pets.flatMap((pet) => pet.skills.map((skill) => skill.id)),
      ...Object.values(SIMULATED_FAMILY_SKILL_IDS).flat(),
      ...Object.values(SIMULATED_PET_SKILL_IDS).flat()
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
  return skills;
}

/** Fetch wiki classifications independently from skill records while preserving pet order. */
export async function fetchRangerPetMetadata(pets) {
  return mapConcurrent(pets, 8, fetchWikiPetMetadata);
}

/** Render pet references exclusively from the validated ID map produced by generateRangerIds. */
export async function generateRangerPetData({ pets, skills, keyById, wikiMetadata }) {
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
      skillIds: petSkillIds(pet, name, family)
    };
  });
  const skillLines = skills.map((skill) => {
    const recharge = skill.recharge || skill.facts?.find((fact) => fact.type === 'Recharge')?.value || 0;
    // Family attacks belong to every pet that receives them, not only pets whose API record lists the skill.
    const petNames =
      skill.petNames || petProfiles.filter(({ skillIds }) => skillIds.includes(skill.id)).map(({ name }) => name);

    return `  {
    id: ID.${keyFor(skill.id)},
    name: ${JSON.stringify(skill.name)},
    description: ${JSON.stringify(skill.description || '')},
    icon: ${JSON.stringify(skill.icon || '')},
    type: "Profession",
    slot: "Profession_2",
    categories: ["Pet"],
    specialization: "",
    cooldown: ${Number(recharge)},
    petSkill: true,
    petFamilySkill: ${AUTONOMOUS_PET_SKILL_IDS.has(skill.id) || FAMILY_ONLY_PET_SKILL_IDS.has(skill.id)},
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
