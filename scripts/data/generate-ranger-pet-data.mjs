import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { SKILLS } from "../../js/professions/ranger/data/ranger-api-metadata.js";

const API_ROOT = "https://api.guildwars2.com/v2";
const WIKI_API = "https://wiki.guildwars2.com/api.php";

const SOULBEAST_FAMILY_SKILL_IDS = Object.freeze({
  "aether hunter": [71282, 70889],
  "armor fish": [42717, 44885],
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
  "fanged iboga": [44384, 40111],
  jacaranda: [43788, 43701],
  jellyfish: [43186, 41837],
  moa: [44617, 43548],
  phoenix: [64038, 41908],
  porcine: [41406, 46432],
  "rock gazelle": [41524, 45743],
  shark: [42797, 44360],
  smokescale: [42907, 40255],
  spinegazer: [72851, 72636],
  spider: [44097, 43671],
  turtle: [64699, 66258],
  warclaw: [73733, 73938],
  wyvern: [46386, 41908],
  "janthiri bee": [75771, 75814],
  "raptor swiftwing": [79203, 78091],
  "river otter": [80035, 80031],
});

const SOULBEAST_PET_FAMILY_OVERRIDES = Object.freeze({
  "Aether Hunter": "aether hunter",
  "Armor Fish": "armor fish",
  Bristleback: "bristleback",
  "Fanged Iboga": "fanged iboga",
  Jacaranda: "jacaranda",
  "Janthiri Bee": "janthiri bee",
  Phoenix: "phoenix",
  "Raptor Swiftwing": "raptor swiftwing",
  "River Otter": "river otter",
  "Rock Gazelle": "rock gazelle",
  "Siege Turtle": "turtle",
  "Sky-Chak Striker": "chak",
  Smokescale: "smokescale",
  Spinegazer: "spinegazer",
  Warclaw: "warclaw",
});

const SOULBEAST_ARCHETYPE_SKILL_IDS = Object.freeze({
  stout: 45797,
  deadly: 40588,
  versatile: 43375,
  ferocious: 40729,
  supportive: 44626,
});

async function fetchJson(pathname) {
  const response = await fetch(
    `${API_ROOT}${pathname}${pathname.includes("?") ? "&" : "?"}lang=en`,
  );
  if (!response.ok) throw new Error(`${response.status} ${pathname}`);
  return response.json();
}

async function fetchMany(endpoint, ids) {
  const result = [];
  for (let index = 0; index < ids.length; index += 100) {
    result.push(
      ...(await fetchJson(
        `/${endpoint}?ids=${ids.slice(index, index + 100).join(",")}`,
      )),
    );
  }
  return result;
}

async function fetchWikiPetMetadata(pet) {
  const query = new URLSearchParams({
    action: "parse",
    prop: "wikitext",
    format: "json",
    formatversion: "2",
    page: pet.name,
  });
  const response = await fetch(`${WIKI_API}?${query}`, {
    headers: { "User-Agent": "gw2-combat-simulator/2.0 Ranger generator" },
  });
  if (!response.ok) throw new Error(`${response.status} ${pet.name}`);
  const result = await response.json();
  const source = String(result.parse?.wikitext || "");
  return {
    family: String(
      source.match(/^\|\s*family\s*=\s*([^\n]+)/im)?.[1] || "",
    ).trim(),
    archetype: String(
      source.match(/^\|\s*archetype\s*=\s*([^\n]+)/im)?.[1] || "",
    ).trim(),
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
    }),
  );
  return output;
}

function constantName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

const usedNames = new Set();
const keyById = new Map();
function keyFor(skill) {
  const base = constantName(skill.name);
  const key = usedNames.has(base) ? `${base}_ID_${skill.id}` : base;
  usedNames.add(base);
  keyById.set(skill.id, key);
  return key;
}

for (const skill of SKILLS) keyFor(skill);

const petIds = await fetchJson("/pets");
const pets = await fetchMany("pets", petIds);
const wikiMetadata = await mapConcurrent(pets, 8, fetchWikiPetMetadata);
const petSkillIds = [
  ...new Set(pets.flatMap((pet) => pet.skills.map((skill) => skill.id))),
];
const skills = await fetchMany("skills", petSkillIds);
for (const skill of skills) keyFor(skill);
const skillById = new Map(skills.map((skill) => [skill.id, skill]));

const skillLines = skills.map((skill) => {
  const recharge =
    skill.facts?.find((fact) => fact.type === "Recharge")?.value || 0;
  const petNames = pets
    .filter((pet) => pet.skills.some((candidate) => candidate.id === skill.id))
    .map((pet) => pet.name.replace(/^Juvenile\s+/, ""));
  return `  {
    id: ID.${keyById.get(skill.id)},
    name: ${JSON.stringify(skill.name)},
    description: ${JSON.stringify(skill.description || "")},
    icon: ${JSON.stringify(skill.icon || "")},
    type: "Profession",
    slot: "Profession_2",
    categories: ["Pet"],
    specialization: "",
    recharge: ${Number(recharge)},
    cooldown: ${Number(recharge)},
    petSkill: true,
    petNames: ${JSON.stringify(petNames)},
  },`;
});
const petLines = pets.map((pet, index) => {
  const name = pet.name.replace(/^Juvenile\s+/, "");
  const metadata = wikiMetadata[index];
  const family = String(
    SOULBEAST_PET_FAMILY_OVERRIDES[name] || metadata.family,
  ).toLowerCase();
  const archetypeKey = metadata.archetype.toLowerCase();
  const archetype = archetypeKey
    ? `${archetypeKey[0].toUpperCase()}${archetypeKey.slice(1)}`
    : "";
  const beastmodeSkillIds = [
    ...(SOULBEAST_FAMILY_SKILL_IDS[family] || []),
    SOULBEAST_ARCHETYPE_SKILL_IDS[archetypeKey],
  ].filter((id) => keyById.has(id));
  if (beastmodeSkillIds.length !== 3) {
    console.warn(
      `Expected three Soulbeast skills for ${name}; received ${beastmodeSkillIds.join(", ") || "none"}.`,
    );
  }
  return `  {
    id: ${pet.id},
    name: ${JSON.stringify(name)},
    icon: ${JSON.stringify(pet.icon || "")},
    description: ${JSON.stringify(pet.description || "")},
    family: ${JSON.stringify(family)},
    archetype: ${JSON.stringify(archetype)},
    skillIds: [${pet.skills.map((skill) => `ID.${keyById.get(skill.id)}`).join(", ")}],
    beastmodeSkillIds: [${beastmodeSkillIds.map((id) => `ID.${keyById.get(id)}`).join(", ")}],
  },`;
});

const source = `// Generated by scripts/data/generate-ranger-pet-data.mjs.
// Pet identities are absent from the profession skill endpoint and are committed here.
import { RANGER_SKILL_IDS as ID } from "./ids.js";
import type { RangerPetDefinition, RangerSkill } from "../types.js";

export const RANGER_PET_SKILLS: readonly RangerSkill[] = Object.freeze([
${skillLines.join("\n")}
]);

export const RANGER_PETS: readonly RangerPetDefinition[] = Object.freeze([
${petLines.join("\n")}
]);
`;

const target = fileURLToPath(
  new URL(
    "../../js/professions/ranger/data/ranger-pet-data.ts",
    import.meta.url,
  ),
);
await writeFile(target, source, "utf8");
console.log(
  `Wrote ${skills.length} Ranger pet skills and ${pets.length} pets.`,
);
