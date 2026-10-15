import assert from 'node:assert/strict';
import test from 'node:test';
import { importGeneratorSource, mockGeneratorFiles } from '../helpers/generator-fixtures.mjs';
import { writeGeneratedFiles } from '../../scripts/data/lib/generator-utils.mjs';
import { ESLint } from 'eslint';
import { check, resolveConfig } from 'prettier';
import { RANGER_PET_AUTHORED_SKILLS } from '../../scripts/data/ranger-pet-skills.mjs';
import { generateRangerIds } from '../../scripts/data/generate-ranger-ids.mjs';
import { fetchRangerPetSkills, generateRangerPetData } from '../../scripts/data/generate-ranger-pet-data.mjs';
import { generateWarriorData } from '../../scripts/data/generate-warrior-data.mjs';

// API-omitted records must come from authored inputs; the mocked endpoint rejects them.
const API_REJECTED_PET_SKILL_IDS = new Set(RANGER_PET_AUTHORED_SKILLS.map((skill) => skill.id));
// Family attacks the endpoint serves although no pet record lists them.
const API_UNLISTED_FAMILY_SKILL_IDS = new Set([12676, 12724]);

/** Present the committed pets the way the API does: pet records list commanded skills only and rejected IDs fail. */
function mockRangerPetApi(context, { RANGER_PETS, RANGER_PET_SKILLS }) {
  const committed = new Map(RANGER_PET_SKILLS.map((skill) => [skill.id, skill]));
  context.mock.method(globalThis, 'fetch', async (request) => {
    const url = new URL(request);
    assert.equal(url.pathname, '/v2/skills');
    const served = url.searchParams
      .get('ids')
      .split(',')
      .map(Number)
      .filter((id) => !API_REJECTED_PET_SKILL_IDS.has(id));
    // The endpoint drops rejected IDs from a mixed batch and fails a batch that contains nothing else.
    if (!served.length) return { ok: false, status: 404 };
    return {
      ok: true,
      json: async () =>
        served.map((id) => {
          const { name, description, icon, cooldown } = committed.get(id);
          return { id, name, description, icon, facts: [{ type: 'Recharge', value: cooldown }] };
        })
    };
  });
  return RANGER_PETS.map((pet) => ({
    id: pet.id,
    name: `Juvenile ${pet.name}`,
    icon: pet.icon,
    description: pet.description,
    skills: pet.skillIds
      .filter((id) => !API_REJECTED_PET_SKILL_IDS.has(id) && !API_UNLISTED_FAMILY_SKILL_IDS.has(id))
      .map((id) => ({ id }))
  }));
}

/** Compare pet skills by identity; an omitted flag and an explicit false mean the same to every consumer. */
function petSkillsById(skills) {
  return new Map(
    skills.map((skill) => [
      skill.id,
      {
        ...skill,
        petFamilySkill: Boolean(skill.petFamilySkill),
        petAutonomousSkill: Boolean(skill.petAutonomousSkill)
      }
    ])
  );
}

// Check the public identity contract with committed fixtures, reordered inputs, and new same-name API records.
test('Warrior refresh preserves committed bindings and API-omitted mechanics identities', async (context) => {
  const { SKILLS, SPECIALIZATIONS } =
    await import('../../js/games/gw2/professions/warrior/data/warrior-api-metadata.ts');
  const { WARRIOR_SUPPLEMENTAL_SKILLS } =
    await import('../../js/games/gw2/professions/warrior/data/warrior-supplemental-skills.ts');
  const expected = await import('../../js/games/gw2/professions/warrior/data/ids.ts');
  const { writes } = mockGeneratorFiles(context, { emptyIdentities: false });
  context.mock.method(globalThis, 'fetch', async (request) => {
    const url = new URL(request);
    if (url.hostname === 'wiki.guildwars2.com') {
      const skill = WARRIOR_SUPPLEMENTAL_SKILLS.find(({ name }) => name === url.searchParams.get('page'));
      assert.ok(skill, url.href);
      return { ok: true, json: async () => ({ parse: { wikitext: `{{Skill infobox\n| id = ${skill.id}\n}}` } }) };
    }

    // The snapshot already carries every API skill, so only supplemental wiki identities are requested.
    return assert.fail(`Unexpected request: ${url}`);
  });
  const skills = [{ id: 73006, name: "Harrier's Toss" }, ...SKILLS.toReversed()];
  const generated = await generateWarriorData({ skills, specializations: SPECIALIZATIONS.toReversed() });
  assert.equal(writes.length, 0, 'preparation must not publish files');
  const actual = await importGeneratorSource(generated.files[0].target, generated.files);
  for (const [name, identities] of Object.entries(expected)) {
    for (const [key, id] of Object.entries(identities)) assert.equal(actual[name][key], id, `${name}.${key}`);
  }

  assert.equal(actual.WARRIOR_SKILL_IDS.HARRIERS_TOSS, 73024);
  assert.equal(actual.WARRIOR_SKILL_IDS.HARRIERS_TOSS_ID_73006, 73006);
});

// Authored pet records, per-pet attack lists, and flags live in the generator; a refresh must rebuild the committed
// pet data from them plus the API's view, so hand edits to the generated file cannot be silently reverted.
test('Ranger refresh rebuilds committed bindings and pet data from API records and authored inputs', async (context) => {
  const { SKILLS, SPECIALIZATIONS } = await import('../../js/games/gw2/professions/ranger/data/ranger-api-metadata.ts');
  const committedPetData = await importGeneratorSource(
    new URL('../../js/games/gw2/professions/ranger/data/ranger-pet-data.ts', import.meta.url)
  );
  const { RANGER_PET_SKILLS, RANGER_PETS } = committedPetData;
  const expected = await import('../../js/games/gw2/professions/ranger/data/ids.ts');
  const { writes } = mockGeneratorFiles(context, { emptyIdentities: false });
  context.mock.method(console, 'warn', (message) => assert.fail(message));
  const pets = mockRangerPetApi(context, committedPetData);
  const petSkills = await fetchRangerPetSkills(pets);
  context.mock.method(globalThis, 'fetch', () => assert.fail('rendering uses the already fetched snapshot'));
  const identities = await generateRangerIds(
    { skills: SKILLS.toReversed(), specializations: SPECIALIZATIONS.toReversed() },
    petSkills.toReversed()
  );
  const actual = await importGeneratorSource(identities.files[0].target, identities.files);
  assert.deepEqual({ ...actual }, { ...expected });
  const petData = await generateRangerPetData({
    pets,
    skills: petSkills,
    keyById: identities.keyById,
    wikiMetadata: RANGER_PETS
  });
  assert.equal(writes.length, 0, 'preparation must not publish files');
  await writeGeneratedFiles([...identities.files, ...petData.files]);
  const loaded = await importGeneratorSource(petData.files[0].target, writes);
  assert.deepEqual(loaded.RANGER_PETS, RANGER_PETS);
  assert.deepEqual(petSkillsById(loaded.RANGER_PET_SKILLS), petSkillsById(RANGER_PET_SKILLS));
  const lint = new ESLint();
  for (const file of writes) {
    assert.equal(await check(file.source, { ...(await resolveConfig(file.target)), filepath: file.target }), true);
    const [result] = await lint.lintText(file.source, { filePath: file.target });
    assert.deepEqual(result.messages, []);
  }

  for (const [, key] of petData.files[0].source.matchAll(/ID\.([A-Z_][A-Z_0-9]*)/g))
    assert.ok(Object.hasOwn(actual.RANGER_SKILL_IDS, key), `missing pet reference ${key}`);
  for (const skill of RANGER_PET_SKILLS)
    assert.equal(actual.RANGER_SKILL_IDS[identities.keyById.get(skill.id)], skill.id);
  await assert.rejects(
    generateRangerPetData({ pets: [], skills: [{ id: 123, name: 'Unallocated' }], keyById: identities.keyById }),
    /missing skill ID 123/
  );

  // A merge skill the snapshot does not expose yet is reported and dropped instead of aborting the refresh.
  const warnings = [];
  context.mock.method(console, 'warn', (message) => warnings.push(message));
  const [unreleasedMergeId] = RANGER_PETS[0].beastmodeSkillIds;
  const partial = await generateRangerPetData({
    pets: [pets[0]],
    skills: [],
    keyById: new Map([...identities.keyById].filter(([id]) => id !== unreleasedMergeId)),
    wikiMetadata: [RANGER_PETS[0]]
  });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Expected three Soulbeast skills/);
  assert.equal(partial.files[0].source.includes(`ID.${identities.keyById.get(unreleasedMergeId)}`), false);
});

// Authored distinctions and supplemental records must rebuild even when no generated bindings remain.
test('Ranger rebuilds authored player and pet keys from generator inputs', async (context) => {
  const { SKILLS, SPECIALIZATIONS } = await import('../../js/games/gw2/professions/ranger/data/ranger-api-metadata.ts');
  const committedPetData = await importGeneratorSource(
    new URL('../../js/games/gw2/professions/ranger/data/ranger-pet-data.ts', import.meta.url)
  );
  const { RANGER_SUPPLEMENTAL_SKILLS } =
    await import('../../js/games/gw2/professions/ranger/data/ranger-supplemental-skills.ts');
  mockGeneratorFiles(context);
  const petSkills = await fetchRangerPetSkills(mockRangerPetApi(context, committedPetData));
  const result = await generateRangerIds({ skills: SKILLS, specializations: SPECIALIZATIONS }, petSkills);
  for (const [id, key] of [
    [12525, 'MAUL_SOULBEAST'],
    [46629, 'MAUL_BASE'],
    [12682, 'BIRD_SLASH'],
    [12655, 'FELINE_SLASH'],
    [12734, 'PORCINE_MAUL'],
    [41710, 'JACARANDA_PHOTOSYNTHESIZE'],
    [69822, 'AETHER_HUNTER_BITE'],
    [78335, 'RAPTOR_SWIFTWING_CLAW'],
    [67277, 'WALLOW_MAUL']
  ])
    assert.equal(result.keyById.get(id), key);
  for (const { id } of RANGER_SUPPLEMENTAL_SKILLS) assert.ok(result.keyById.has(id), `supplemental skill ${id}`);
});
