import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { GW2_SKILL_ID_ALIASES as RUNTIME_SKILL_ID_ALIASES } from '#gw2/platform/skills/aliases.js';
import {
  createProfessionSnapshot,
  DEFAULT_TERRESTRIAL_WEAPON_EXCLUSIONS,
  fetchProfessionSnapshot,
  GW2_SKILL_FLAGS,
  GW2_SKILL_ID_ALIASES,
  isTerrestrialSkill,
  serializeProfessionSnapshot,
  skillSnapshot
} from '../../scripts/data/lib/gw2-profession-snapshot.mjs';
import { updateProfessionApiData } from '../../scripts/data/update-profession-api-data.mjs';

// Fixture-backed API refreshes preserve canonical records and generated metadata without network access.
const apiFixture = JSON.parse(
  await readFile(new URL('../fixtures/gw2-api/profession-snapshot.json', import.meta.url), 'utf8')
);

function createFixtureFetch(requests = [], fixture = apiFixture) {
  return async (requestUrl) => {
    const url = new URL(requestUrl);

    requests.push(url);
    const ids = String(url.searchParams.get('ids') || '')
      .split(',')
      .filter(Boolean)
      .map(Number);
    let value;

    if (url.pathname.startsWith('/v2/professions/')) {
      value = fixture.profession;
    } else if (url.pathname === '/v2/specializations') {
      value = fixture.specializations.filter((entry) => ids.includes(entry.id));
    } else if (url.pathname === '/v2/traits') {
      value = fixture.traits.filter((entry) => ids.includes(entry.id));
    } else if (url.pathname === '/v2/skills') {
      value = fixture.skills.filter((entry) => ids.includes(entry.id));
    } else {
      return {
        ok: false,
        status: 404,
        json: async () => ({})
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => structuredClone(value)
    };
  };
}

test('API snapshot transforms chains, filtering, and ordering', () => {
  const snapshot = createProfessionSnapshot({
    profession: apiFixture.profession,
    specializationData: apiFixture.specializations,
    traitData: apiFixture.traits,
    skillData: apiFixture.skills
  });
  const reordered = createProfessionSnapshot({
    profession: {
      ...apiFixture.profession,
      skills: [...apiFixture.profession.skills].reverse()
    },
    specializationData: [...apiFixture.specializations].reverse(),
    traitData: [...apiFixture.traits].reverse(),
    skillData: [...apiFixture.skills].reverse()
  });

  assert.deepEqual(reordered, snapshot);
  assert.deepEqual(
    snapshot.skills.map((value) => value.id),
    [10, 11, 12, 20, 21, 40]
  );
  assert.equal(snapshot.skills.find((value) => value.id === 10).nextChainId, 11);
  assert.equal(snapshot.skills.find((value) => value.id === 11).flipSkillId, 12);
  assert.equal(snapshot.skills.find((value) => value.id === 20).flipSkillId, null);
  assert.equal(
    snapshot.skills.some((value) => 'canonicalAliasId' in value || 'modeAliasIds' in value || 'flags' in value),
    false
  );
  assert.equal(snapshot.skills.find((value) => value.id === 40).specialization, 'Elite');
  assert.equal(
    snapshot.skills.some((value) => 'facts' in value || 'coefficient' in value),
    false
  );
  assert.equal(
    snapshot.skills.some((value) => value.flags?.includes(GW2_SKILL_FLAGS.TERRESTRIAL_ONLY)),
    false
  );
  assert.equal(
    isTerrestrialSkill(
      {
        id: 60,
        name: 'Wet Spear',
        slot: 'Weapon_1',
        flags: []
      },
      'Spear'
    ),
    false
  );
  assert.deepEqual(DEFAULT_TERRESTRIAL_WEAPON_EXCLUSIONS, ['Trident', 'Speargun']);
  assert.equal(
    isTerrestrialSkill(
      {
        id: 61,
        name: 'Trident Attack',
        slot: 'Weapon_1',
        flags: [GW2_SKILL_FLAGS.TERRESTRIAL_ONLY]
      },
      'Trident'
    ),
    false
  );
  assert.equal(
    isTerrestrialSkill(
      {
        id: 64,
        name: 'Aquatic Skill',
        slot: 'Weapon_1',
        flags: [GW2_SKILL_FLAGS.UNDERWATER_ONLY]
      },
      ''
    ),
    false
  );
  assert.equal(
    isTerrestrialSkill(
      {
        id: 62,
        name: 'Speargun Attack',
        slot: 'Weapon_1',
        flags: [GW2_SKILL_FLAGS.TERRESTRIAL_ONLY]
      },
      'Speargun'
    ),
    false
  );
  assert.equal(
    isTerrestrialSkill(
      {
        id: 63,
        name: 'Land Spear',
        slot: 'Weapon_1',
        flags: [GW2_SKILL_FLAGS.TERRESTRIAL_ONLY]
      },
      'Spear'
    ),
    true
  );
  assert.equal(
    serializeProfessionSnapshot({
      professionName: 'Fixture',
      snapshotDate: '2026-07-27',
      ...snapshot
    }),
    serializeProfessionSnapshot({
      professionName: 'Fixture',
      snapshotDate: '2026-07-27',
      ...reordered
    })
  );
});

test('API snapshots emit canonical records for reviewed aliases only', () => {
  const snapshot = createProfessionSnapshot({
    profession: {
      id: 'Fixture',
      skills: [{ id: 42297 }, { id: 68666 }, { id: 9224 }, { id: 99999 }]
    },
    specializationData: [],
    traitData: [],
    skillData: [
      { id: 42297, name: 'Manifest Sand Shade', type: 'Profession', slot: 'Profession_1', facts: [] },
      {
        id: 44946,
        name: 'Manifest Sand Shade',
        type: 'Profession',
        slot: 'Profession_1',
        facts: [],
        flip_skill: 42297
      },
      { id: 68666, name: 'Renewed Focus', type: 'Elite', slot: 'Elite', facts: [] },
      { id: 9154, name: 'Renewed Focus', type: 'Elite', slot: 'Elite', facts: [] },
      { id: 9224, name: 'Shield of Absorption', type: 'Weapon', slot: 'Weapon_5', facts: [] },
      { id: 99999, name: 'Renewed Focus', type: 'Elite', slot: 'Elite', facts: [] }
    ]
  });

  assert.deepEqual(GW2_SKILL_ID_ALIASES, RUNTIME_SKILL_ID_ALIASES);
  assert.equal(GW2_SKILL_ID_ALIASES[42297], 44946);
  assert.equal(GW2_SKILL_ID_ALIASES[68666], 9154);
  assert.equal(
    snapshot.skills.some((skill) => Object.hasOwn(skill, 'attunement')),
    false
  );
  assert.equal(
    skillSnapshot({
      id: 1,
      name: 'Flame Burst',
      type: 'Weapon',
      slot: 'Weapon_1',
      attunement: 'Fire',
      facts: []
    }).attunement,
    'Fire'
  );
  assert.deepEqual(
    snapshot.skills.map((skill) => skill.id),
    [9154, 9224, 44946, 99999]
  );
  assert.equal(snapshot.skills.find((skill) => skill.id === 44946).flipSkillId, null);
});

test('API snapshot fetches are English, fixture-backed, and profession-generic', async () => {
  const requests = [];
  const fetchImpl = createFixtureFetch(requests);
  const snapshot = await fetchProfessionSnapshot({
    professionName: 'Warrior',
    fetchImpl
  });

  assert.deepEqual(
    snapshot.skills.map((skill) => skill.id),
    [10, 11, 12, 20, 21, 40]
  );
  assert.ok(requests.length > 0);
  assert.equal(
    requests.every((request) => request.searchParams.get('lang') === 'en'),
    true
  );
  const directory = await mkdtemp(path.join(tmpdir(), 'gw2-profession-snapshot-'));
  const output = path.join(directory, 'warrior-api-metadata.ts');

  try {
    const result = await updateProfessionApiData('warrior', {
      fetchImpl: createFixtureFetch(),
      snapshotDate: '2026-07-27',
      output,
      log: () => {}
    });

    assert.equal(result.output, path.resolve(output));
    const source = await readFile(output, 'utf8');

    assert.match(source, /Generated Guild Wars 2 API metadata for warrior/);
    assert.match(source, /npm run update:profession-data -- --profession Warrior/);
    assert.match(source, /warrior\/core\/ and warrior\/specializations\//);
    assert.doesNotMatch(source, /warrior\/mechanics\//);
    assert.match(source, /import type \{ Gw2ApiSpecialization, Gw2ApiTrait \}/);
    assert.match(source, /export const DATA_SNAPSHOT: string = "2026-07-27"/);
    assert.match(source, /export const SPECIALIZATIONS: readonly WarriorApiSpecialization\[]/);
    assert.match(source, /export const SKILLS: readonly WarriorSkill\[]/);

    const thiefRequests = [];

    await updateProfessionApiData('thief', {
      fetchImpl: createFixtureFetch(thiefRequests),
      snapshotDate: '2026-07-27',
      output: path.join(directory, 'thief-api-metadata.ts'),
      log: () => {}
    });
    const requestedThiefSkillIds = thiefRequests
      .filter((request) => request.pathname === '/v2/skills')
      .flatMap((request) =>
        String(request.searchParams.get('ids') || '')
          .split(',')
          .map(Number)
      );

    assert.equal(
      [76633, 76674, 76702].every((skillId) => requestedThiefSkillIds.includes(skillId)),
      true
    );

    const omittedProfessionFixture = (skillIds, professionName) => ({
      ...apiFixture,
      profession: {
        ...apiFixture.profession,
        skills: [...apiFixture.profession.skills, ...skillIds.map((id) => ({ id }))]
      },
      skills: [
        ...apiFixture.skills,
        ...skillIds.map((id) => ({
          id,
          name: `${professionName} skill ${id}`,
          type: 'Utility',
          slot: 'Utility',
          facts: []
        }))
      ]
    });
    const omittedSkillsByProfession = Object.freeze({
      engineer: [
        5811, 5818, 5821, 5825, 5832, 5834, 5836, 5837, 5838, 5860, 5861, 5862, 5865, 5893, 5900, 5904, 5910, 5912,
        5913, 5960, 5968, 6113, 29739, 30101, 41218, 44646, 77018
      ],
      guardian: [9150, 9182, 9245, 29786, 30461, 30871, 41571, 68676],
      mesmer: [10197, 10200, 10201, 10203, 10236, 62573],
      necromancer: [10612, 40274, 42917],
      ranger: [12494, 12500, 12502, 12542, 12550, 31582, 31746, 34309, 45142, 45789, 45970, 63195, 63256],
      thief: [13020, 13035, 13096, 76784, 76808, 76879, 77361],
      warrior: [14368, 14403, 14413, 14479, 76769, 76934]
    });

    // The profession updater owns these exclusions so refreshing generated data cannot restore unsupported skills.
    for (const [professionName, skillIds] of Object.entries(omittedSkillsByProfession)) {
      const snapshot = await updateProfessionApiData(professionName, {
        fetchImpl: createFixtureFetch([], omittedProfessionFixture(skillIds, professionName)),
        snapshotDate: '2026-07-27',
        output: path.join(directory, `${professionName}-api-metadata.ts`),
        log: () => {}
      });

      assert.equal(
        snapshot.skills.some((skill) => skillIds.includes(skill.id)),
        false,
        professionName
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
