import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const GW2_API_ROOT = 'https://api.guildwars2.com/v2';
export const DEFAULT_TERRESTRIAL_WEAPON_EXCLUSIONS = Object.freeze(['Trident', 'Speargun']);
export const GW2_SKILL_FLAGS = Object.freeze({
  TERRESTRIAL_ONLY: 'NoUnderwater',
  UNDERWATER_ONLY: 'Underwater'
});

function englishPath(pathname) {
  return `${pathname}${pathname.includes('?') ? '&' : '?'}lang=en`;
}

// Fetches a Guild Wars 2 API object by its path, throwing an error if the request fails.
export async function fetchGw2Api(pathname, { fetchImpl = fetch, apiRoot = GW2_API_ROOT } = {}) {
  const response = await fetchImpl(`${apiRoot}${englishPath(pathname)}`);

  if (!response.ok) {
    throw new Error(`Guild Wars 2 API request failed (${response.status}): ${pathname}`);
  }

  return response.json();
}

// Fetches multiple Guild Wars 2 API objects by their IDs, batching requests to avoid exceeding the API limit.
export async function fetchManyGw2(endpoint, ids, options = {}) {
  const values = [];
  const unique = [...new Set(ids.map(Number))].filter(Number.isFinite).sort((left, right) => left - right);

  for (let index = 0; index < unique.length; index += 100) {
    const batch = unique.slice(index, index + 100);

    values.push(...(await fetchGw2Api(`/${endpoint}?ids=${batch.join(',')}`, options)));
  }

  return values;
}

// Creates a snapshot of a trait for use in the patch preview.
export function traitSnapshot(trait, specialization) {
  return {
    id: trait.id,
    name: trait.name,
    description: trait.description || '',
    icon: trait.icon || '',
    specialization,
    tier: trait.tier,
    position: trait.slot === 'Minor' ? 0 : Number(trait.order || 0) + 1,
    slot: trait.slot
  };
}

// Creates a snapshot of a specialization for use in the patch preview.
export function buildSpecializationSnapshots(specializationData, traitData) {
  const traitsById = new Map(traitData.map((trait) => [trait.id, trait]));

  return [...specializationData]
    .sort((left, right) => left.id - right.id)
    .map((specialization) => ({
      id: specialization.id,
      name: specialization.name,
      elite: Boolean(specialization.elite),
      icon: specialization.icon || '',
      background: specialization.background || '',
      minorTraits: specialization.minor_traits
        .map((id) => traitsById.get(id))
        .filter(Boolean)
        .map((trait) => traitSnapshot(trait, specialization.name)),
      majorTraits: [0, 1, 2].map((tier) =>
        specialization.major_traits
          .slice(tier * 3, tier * 3 + 3)
          .map((id) => traitsById.get(id))
          .filter(Boolean)
          .map((trait) => traitSnapshot(trait, specialization.name))
      )
    }));
}

function firstFact(skill, predicate) {
  return (skill.facts || []).find(predicate);
}

// Creates a snapshot of a skill for use in the patch preview.
export function skillSnapshot(skill, { weapon = '', specialization = '' } = {}) {
  const recharge = firstFact(skill, (fact) => fact.type === 'Recharge');
  const countRecharge = firstFact(skill, (fact) => fact.text === 'Count Recharge');
  const casts = firstFact(
    skill,
    (fact) => fact.text === 'Number of Casts' || fact.text === 'Maximum Count' || fact.text === 'Casts'
  );

  return {
    id: skill.id,
    name: skill.name,
    description: skill.description || '',
    icon: skill.icon || '',
    type: skill.type,
    weapon,
    slot: skill.slot,
    attunement: skill.attunement || '',
    specialization,
    categories: skill.categories || [],
    recharge: Number(recharge?.value || recharge?.duration || 0),
    ammo: Number(casts?.value || 0),
    ammoRecharge: Number(countRecharge?.duration || countRecharge?.value || 0),
    nextChainId: skill.next_chain ?? null,
    flipSkillId: skill.flip_skill ?? null
  };
}

// Determines if a skill is land-based, based on its properties and the provided exclusions.
export function isTerrestrialSkill(
  skill,
  weapon = '',
  { excludedIds = [], weaponExclusions = DEFAULT_TERRESTRIAL_WEAPON_EXCLUSIONS, filterSkill = null } = {}
) {
  const excludesId = excludedIds instanceof Set ? excludedIds.has(skill?.id) : excludedIds.includes(skill?.id);
  const excludesWeapon =
    weaponExclusions instanceof Set ? weaponExclusions.has(weapon) : weaponExclusions.includes(weapon);

  if (!skill || excludesId) return false;

  if (excludesWeapon) return false;

  if (skill.flags?.includes(GW2_SKILL_FLAGS.UNDERWATER_ONLY)) return false;

  if (
    String(skill.slot || '').startsWith('Downed_') &&
    Number(skill.id) < 29_000 &&
    !skill.flags?.includes(GW2_SKILL_FLAGS.TERRESTRIAL_ONLY)
  ) {
    return false;
  }

  if (weapon === 'Spear' && !skill.flags?.includes(GW2_SKILL_FLAGS.TERRESTRIAL_ONLY)) {
    return false;
  }

  return typeof filterSkill === 'function' ? filterSkill(skill, { weapon }) !== false : true;
}

// Builds associations between skills and their respective professions, specializations, and weapons.
export function professionSkillAssociations(
  profession,
  specializationData,
  { weaponExclusions = DEFAULT_TERRESTRIAL_WEAPON_EXCLUSIONS, extraSkillIds = [] } = {}
) {
  const specializationById = new Map(
    specializationData.map((specialization) => [specialization.id, specialization.name])
  );
  const specializationBySkillId = new Map();
  const eliteSpecializations = new Set(
    specializationData.filter((specialization) => specialization.elite).map((specialization) => specialization.name)
  );

  for (const training of profession.training || []) {
    if (!eliteSpecializations.has(training.name)) continue;

    for (const entry of training.track || []) {
      if (entry.type === 'Skill') {
        specializationBySkillId.set(entry.skill_id, training.name);
      }
    }
  }

  const weaponBySkillId = new Map();

  for (const [weapon, definition] of Object.entries(profession.weapons || {})) {
    if (weaponExclusions instanceof Set ? weaponExclusions.has(weapon) : weaponExclusions.includes(weapon)) continue;

    for (const skill of definition.skills || []) {
      weaponBySkillId.set(skill.id, weapon);

      if (definition.specialization) {
        specializationBySkillId.set(skill.id, specializationById.get(definition.specialization) || '');
      }
    }
  }

  const seedIds = [...(profession.skills || []).map((skill) => skill.id), ...weaponBySkillId.keys(), ...extraSkillIds];

  return {
    seedIds: [...new Set(seedIds)].sort((left, right) => left - right),
    weaponBySkillId,
    specializationBySkillId
  };
}

function linkedSkillIds(skill) {
  return [skill?.next_chain, skill?.flip_skill].filter(Number.isFinite);
}

// Builds a snapshot of all skills for a profession, including linked skills, based on the provided skill data and associations.
export function buildSkillSnapshots({ profession, specializationData, skillData, config = {} }) {
  const normalizedSkillData = skillData.map((skill) => {
    const override = config.skillOverrides?.[skill.id] || {};
    const normalized = { ...skill, ...override };

    return typeof config.repairSkill === 'function' ? config.repairSkill(normalized) || normalized : normalized;
  });
  const { seedIds, weaponBySkillId, specializationBySkillId } = professionSkillAssociations(
    profession,
    specializationData,
    config
  );
  const skillDataById = new Map(normalizedSkillData.map((skill) => [skill.id, skill]));
  const includedIds = new Set();
  const queue = [...seedIds];

  while (queue.length) {
    const id = queue.shift();

    if (includedIds.has(id)) continue;

    const skill = skillDataById.get(id);
    const weapon = weaponBySkillId.get(id) || '';

    if (!isTerrestrialSkill(skill, weapon, config)) continue;

    includedIds.add(id);
    for (const reference of linkedSkillIds(skill)) {
      if (includedIds.has(reference)) continue;

      const child = skillDataById.get(reference);

      if (!child) continue;

      if (weapon) weaponBySkillId.set(reference, weapon);

      const specialization = specializationBySkillId.get(id);

      if (specialization) {
        specializationBySkillId.set(reference, specialization);
      }

      queue.push(reference);
    }
  }

  const snapshots = [...includedIds]
    .map((id) =>
      skillSnapshot(skillDataById.get(id), {
        weapon: weaponBySkillId.get(id) || '',
        specialization: specializationBySkillId.get(id) || ''
      })
    )
    .sort((left, right) => left.id - right.id);
  const byId = new Map(snapshots.map((skill) => [skill.id, skill]));

  return snapshots.map((skill) => {
    const next = byId.get(skill.nextChainId);
    const flip = byId.get(skill.flipSkillId);

    return {
      ...skill,
      nextChainId: next?.name === skill.name ? null : skill.nextChainId,
      flipSkillId: flip?.name === skill.name ? null : skill.flipSkillId
    };
  });
}

// Creates a snapshot of a profession's data for use in the patch preview.
export function createProfessionSnapshot({ profession, specializationData, traitData, skillData, config = {} }) {
  return {
    specializations: buildSpecializationSnapshots(specializationData, traitData),
    skills: buildSkillSnapshots({
      profession,
      specializationData,
      skillData,
      config
    })
  };
}

// Fetches a snapshot of a profession's data from the GW2 API for use in the patch preview.
export async function fetchProfessionSnapshot({
  professionName,
  config = {},
  fetchImpl = fetch,
  apiRoot = GW2_API_ROOT
}) {
  const options = { fetchImpl, apiRoot };
  const profession = await fetchGw2Api(`/professions/${professionName}`, options);
  const specializationData = await fetchManyGw2('specializations', profession.specializations || [], options);
  const traitData = await fetchManyGw2(
    'traits',
    specializationData.flatMap((specialization) => [...specialization.minor_traits, ...specialization.major_traits]),
    options
  );
  const associations = professionSkillAssociations(profession, specializationData, config);
  const skillDataById = new Map(
    (await fetchManyGw2('skills', associations.seedIds, options)).map((skill) => [skill.id, skill])
  );
  let frontier = [...associations.seedIds];

  while (frontier.length) {
    const references = [...new Set(frontier.flatMap((id) => linkedSkillIds(skillDataById.get(id))))].filter(
      (id) => !skillDataById.has(id)
    );

    if (!references.length) break;

    const fetched = await fetchManyGw2('skills', references, options);

    for (const skill of fetched) skillDataById.set(skill.id, skill);
    frontier = fetched.map((skill) => skill.id);
  }

  return createProfessionSnapshot({
    profession,
    specializationData,
    traitData,
    skillData: [...skillDataById.values()],
    config
  });
}

// Creates a checked TypeScript module for a profession snapshot while keeping
// the large generated arrays widened to their public contracts.
export function serializeProfessionSnapshot({ professionName, snapshotDate, specializations, skills, refreshCommand }) {
  const id = professionName.toLowerCase();
  const command = refreshCommand || `node scripts/data/update-profession-api-data.mjs --profession ${professionName}`;

  return [
    `// Generated Guild Wars 2 API metadata for ${id}.`,
    `// Snapshot: ${snapshotDate}. Run ${command} to refresh.`,
    `// Simulator mechanics are maintained under ${id}/mechanics/.`,
    '',
    `import type { Gw2ApiSpecialization, Gw2ApiTrait } from "../../../platform/gw2/authoring/api-metadata-types.js";`,
    `import type { ${professionName}Skill } from "../types.js";`,
    '',
    `export type ${professionName}ApiTrait = Gw2ApiTrait;`,
    `export type ${professionName}ApiSpecialization = Gw2ApiSpecialization;`,
    '',
    `export const DATA_SNAPSHOT: string = ${JSON.stringify(snapshotDate)};`,
    `export const SPECIALIZATIONS: readonly ${professionName}ApiSpecialization[] = ${JSON.stringify(specializations, null, 2)};`,
    `export const SKILLS: readonly ${professionName}Skill[] = ${JSON.stringify(skills, null, 2)};`,
    ''
  ].join('\n');
}

// Writes a profession snapshot to a TypeScript file, creating the necessary directories if they do not exist.
export async function writeProfessionSnapshot({
  output,
  professionName,
  snapshotDate = new Date().toISOString().slice(0, 10),
  specializations,
  skills,
  refreshCommand
}) {
  const source = serializeProfessionSnapshot({
    professionName,
    snapshotDate,
    specializations,
    skills,
    refreshCommand
  });

  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, source, 'utf8');

  return source;
}
