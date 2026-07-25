import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_ROOT = "https://api.guildwars2.com/v2";
const PROFESSION_ID = "Necromancer";
const OUTPUT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../js/professions/necromancer/data/necromancer-catalog.js",
);
const DAMAGING_CONDITIONS = new Set([
  "Bleeding",
  "Burning",
  "Confusion",
  "Poisoned",
  "Torment",
]);

async function api(pathname) {
  const response = await fetch(`${API_ROOT}${pathname}`);
  if (!response.ok) {
    throw new Error(
      `Guild Wars 2 API request failed (${response.status}): ${pathname}`,
    );
  }
  return response.json();
}

async function fetchMany(endpoint, ids) {
  const values = [];
  const unique = [...new Set(ids)].filter(Number.isFinite);
  for (let index = 0; index < unique.length; index += 100) {
    const batch = unique.slice(index, index + 100);
    values.push(...await api(`/${endpoint}?ids=${batch.join(",")}&lang=en`));
  }
  return values;
}

function traitSnapshot(trait, specialization) {
  return {
    id: trait.id,
    name: trait.name,
    description: trait.description,
    icon: trait.icon,
    specialization,
    tier: trait.tier,
    position: trait.slot === "Minor" ? 0 : trait.order + 1,
    slot: trait.slot,
    facts: (trait.facts || []).map(({
      icon: _icon,
      description: _description,
      ...fact
    }) => fact),
  };
}

function firstFact(skill, predicate) {
  return (skill.facts || []).find(predicate);
}

function skillSnapshot(skill, {
  weapon = "",
  specialization = "",
} = {}) {
  const recharge = firstFact(skill, fact => fact.type === "Recharge");
  const countRecharge = firstFact(
    skill,
    fact => fact.text === "Count Recharge",
  );
  const casts = firstFact(
    skill,
    fact => fact.text === "Number of Casts"
      || fact.text === "Maximum Count"
      || fact.text === "Casts",
  );
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description || "",
    icon: skill.icon || "",
    type: skill.type,
    weapon,
    slot: skill.slot,
    specialization,
    categories: skill.categories || [],
    flags: skill.flags || [],
    facts: (skill.facts || []).map(({
      icon: _icon,
      description: _description,
      ...fact
    }) => fact),
    recharge: Number(recharge?.value || 0),
    ammo: Number(casts?.value || 0),
    ammoRecharge: Number(countRecharge?.duration || 0),
    nextChainId: skill.next_chain ?? null,
    flipSkillId: skill.flip_skill ?? null,
    apiDamage: (skill.facts || [])
      .filter(fact =>
        fact.type === "Damage"
        && Number.isFinite(Number(fact.dmg_multiplier)))
      .map(fact => {
        const hits = Math.max(1, Number(fact.hit_count || 1));
        const coefficientPerHit = Number(fact.dmg_multiplier);
        return {
          coefficient: coefficientPerHit * hits,
          coefficientPerHit,
          hits,
          text: fact.text || "Damage",
        };
      }),
    apiConditions: (skill.facts || [])
      .filter(fact =>
        fact.type === "Buff"
        && DAMAGING_CONDITIONS.has(fact.status))
      .map(fact => ({
        condition: fact.status,
        duration: Number(fact.duration || 0),
        stacks: Math.max(1, Number(fact.apply_count || 1)),
        text: fact.text || "Apply Buff/Condition",
      })),
  };
}

function isTerrestrialSkill(skill, weapon = "") {
  if (!skill || skill.flags?.includes("Underwater")) return false;
  if (
    String(skill.slot || "").startsWith("Downed_")
    && Number(skill.id) < 29_000
    && !skill.flags?.includes("NoUnderwater")
  ) {
    return false;
  }
  if (weapon === "Spear") {
    return skill.flags?.includes("NoUnderwater");
  }
  return true;
}

async function main() {
  const profession = await api(`/professions/${PROFESSION_ID}?lang=en`);
  const specializationData = await fetchMany(
    "specializations",
    profession.specializations,
  );
  const traitIds = specializationData.flatMap(specialization => [
    ...specialization.minor_traits,
    ...specialization.major_traits,
  ]);
  const traitData = await fetchMany("traits", traitIds);
  const traitsById = new Map(traitData.map(trait => [trait.id, trait]));

  const specializations = specializationData.map(specialization => ({
    id: specialization.id,
    name: specialization.name,
    elite: Boolean(specialization.elite),
    icon: specialization.icon,
    background: specialization.background,
    minorTraits: specialization.minor_traits
      .map(id => traitsById.get(id))
      .filter(Boolean)
      .map(trait => traitSnapshot(trait, specialization.name)),
    majorTraits: [0, 1, 2].map(tier =>
      specialization.major_traits
        .slice(tier * 3, tier * 3 + 3)
        .map(id => traitsById.get(id))
        .filter(Boolean)
        .map(trait => traitSnapshot(trait, specialization.name))),
  }));
  const traits = specializations.flatMap(specialization => [
    ...specialization.minorTraits,
    ...specialization.majorTraits.flat(),
  ]);

  const specializationById = new Map(
    specializations.map(specialization => [
      specialization.id,
      specialization.name,
    ]),
  );
  const specializationBySkillId = new Map();
  const eliteSpecializations = new Set(
    specializations
      .filter(specialization => specialization.elite)
      .map(specialization => specialization.name),
  );
  for (const training of profession.training || []) {
    if (!eliteSpecializations.has(training.name)) continue;
    for (const entry of training.track || []) {
      if (entry.type === "Skill") {
        specializationBySkillId.set(entry.skill_id, training.name);
      }
    }
  }

  const professionSkillIds = new Set(
    profession.skills.map(skill => skill.id),
  );
  const weaponBySkillId = new Map();
  for (const [weapon, definition] of Object.entries(profession.weapons)) {
    if (weapon === "Trident") continue;
    for (const skill of definition.skills) {
      weaponBySkillId.set(skill.id, weapon);
      if (definition.specialization) {
        specializationBySkillId.set(
          skill.id,
          specializationById.get(definition.specialization) || "",
        );
      }
    }
  }

  const seedIds = [
    ...professionSkillIds,
    ...weaponBySkillId.keys(),
  ];
  const skillDataById = new Map(
    (await fetchMany("skills", seedIds)).map(skill => [skill.id, skill]),
  );
  const includedIds = new Set();
  for (const id of seedIds) {
    const skill = skillDataById.get(id);
    const weapon = weaponBySkillId.get(id);
    if (!isTerrestrialSkill(skill, weapon)) continue;
    includedIds.add(id);
  }

  let frontier = [...includedIds];
  while (frontier.length) {
    const references = [];
    for (const id of frontier) {
      const skill = skillDataById.get(id);
      for (const reference of [skill?.next_chain, skill?.flip_skill]) {
        if (reference && !skillDataById.has(reference)) references.push(reference);
      }
    }
    if (!references.length) break;
    const fetched = await fetchMany("skills", references);
    for (const skill of fetched) skillDataById.set(skill.id, skill);
    const next = [];
    for (const id of frontier) {
      const skill = skillDataById.get(id);
      const weapon = weaponBySkillId.get(id) || "";
      const specialization = specializationBySkillId.get(id) || "";
      for (const reference of [skill?.next_chain, skill?.flip_skill]) {
        const child = skillDataById.get(reference);
        if (
          !isTerrestrialSkill(child, weapon)
          || includedIds.has(reference)
        ) continue;
        includedIds.add(reference);
        if (weapon) weaponBySkillId.set(reference, weapon);
        if (specialization) {
          specializationBySkillId.set(reference, specialization);
        }
        next.push(reference);
      }
    }
    frontier = next;
  }

  const snapshots = [...includedIds]
    .map(id => skillSnapshot(skillDataById.get(id), {
      weapon: weaponBySkillId.get(id) || "",
      specialization: specializationBySkillId.get(id) || "",
    }));
  const byId = new Map(snapshots.map(skill => [skill.id, skill]));
  const skills = snapshots
    .map(skill => {
      const next = byId.get(skill.nextChainId);
      const flip = byId.get(skill.flipSkillId);
      return {
        ...skill,
        nextChainId:
          next?.name === skill.name ? null : skill.nextChainId,
        flipSkillId:
          flip?.name === skill.name ? null : skill.flipSkillId,
        modeAliasIds: snapshots
          .filter(candidate =>
            candidate.id !== skill.id
            && candidate.name === skill.name)
          .map(candidate => candidate.id)
          .sort((left, right) => left - right),
      };
    })
    .sort((left, right) => left.id - right.id);
  const snapshot = new Date().toISOString().slice(0, 10);
  const source = [
    "// Generated Guild Wars 2 API metadata and trait snapshot.",
    `// Snapshot: ${snapshot}. Run scripts/update-necromancer-api-data.mjs to refresh.`,
    "// Simulator mechanics are maintained in necromancer/mechanics.js.",
    "",
    `export const DATA_SNAPSHOT = ${JSON.stringify(snapshot)};`,
    `export const SPECIALIZATIONS = ${JSON.stringify(specializations, null, 2)};`,
    "export const TRAITS = SPECIALIZATIONS.flatMap(specialization => [",
    "  ...specialization.minorTraits,",
    "  ...specialization.majorTraits.flat(),",
    "]);",
    `export const SKILLS = ${JSON.stringify(skills, null, 2)};`,
    "",
  ].join("\n");
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, source, "utf8");
  console.log(
    `Wrote ${skills.length} skills, ${traits.length} traits, `
    + `${specializations.length} specializations to ${OUTPUT}.`,
  );
}

await main();
