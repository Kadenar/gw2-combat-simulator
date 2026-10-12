import assert from 'node:assert/strict';
import { importGeneratorSource, mockGeneratorFiles } from '../helpers/generator-fixtures.mjs';
import test from 'node:test';
import { updateRangerData } from '../../scripts/data/update-ranger-data.mjs';
import { generateWarriorData } from '../../scripts/data/generate-warrior-data.mjs';
import { fetchManyGw2 } from '../../scripts/data/lib/gw2-profession-snapshot.mjs';

test('API batches normalize IDs, preserve requested ordering, and reject failed requests', async () => {
  // Exercise the batch boundary in both ordering modes with duplicate and invalid inputs.
  const ids = Array.from({ length: 101 }, (_, index) => 101 - index);
  for (const preserveIdOrder of [false, true]) {
    const batches = [];
    const result = await fetchManyGw2('skills', [...ids, '101', NaN], {
      preserveIdOrder,
      fetchImpl: async (request) => {
        const url = new URL(request);
        assert.equal(url.searchParams.get('lang'), 'en');
        const batch = url.searchParams.get('ids').split(',').map(Number);
        batches.push(batch);
        return { ok: true, json: async () => batch };
      }
    });
    assert.deepEqual(
      batches.map((batch) => batch.length),
      [100, 1]
    );
    assert.deepEqual(result, preserveIdOrder ? ids : ids.toReversed());
  }

  await assert.rejects(
    fetchManyGw2('skills', [1], { fetchImpl: async () => ({ ok: false, status: 503 }) }),
    /request failed \(503\)/
  );
});

test('generators preserve pet ordering, collision names, and Warrior request headers', async (context) => {
  const { writes } = mockGeneratorFiles(context);
  const requests = [];
  const wikiIds = new Map();
  const wikiStarted = Promise.withResolvers();
  // Unsorted pets and duplicate names expose changes to generation order without writing real catalogs.
  const pets = [
    { id: 9, name: 'Juvenile Bear', skills: [{ id: 902 }, { id: 901 }] },
    { id: 2, name: 'Juvenile Bear Cub', skills: [{ id: 900 }] },
    { id: 14, name: 'Juvenile White Moa', skills: [{ id: 999 }] }
  ];
  context.mock.method(console, 'warn', (message) => assert.fail(message));
  context.mock.method(globalThis, 'fetch', async (request, options) => {
    const url = new URL(request);
    requests.push({ url, options });
    const ids = url.searchParams.get('ids')?.split(',').map(Number);
    let value;
    if (url.pathname === '/v2/professions/Ranger') {
      value = { id: 'Ranger', specializations: [], skills: [43136, 43060, 45797].map((id) => ({ id })) };
    } else if (url.pathname === '/v2/pets') {
      value = ids ? ids.map((id) => pets.find((pet) => pet.id === id)) : pets.map((pet) => pet.id);
    } else if (url.pathname === '/v2/skills') {
      // Wiki work must start while the independent pet-skill request is still pending.
      if (ids.includes(902)) {
        let timeout;
        try {
          await Promise.race([
            wikiStarted.promise,
            new Promise((_, reject) => {
              timeout = setTimeout(() => reject(new Error('Pet wiki fetch did not start concurrently')), 2000);
            })
          ]);
        } finally {
          clearTimeout(timeout);
        }
      }

      value = ids.map((id) => ({ id, name: id < 1000 ? 'Shared Bite' : `Skill ${id}`, type: 'Profession', facts: [] }));
    } else if (url.hostname === 'wiki.guildwars2.com') {
      wikiStarted.resolve();
      const page = url.searchParams.get('page');
      if (!wikiIds.has(page)) wikiIds.set(page, 80000 + wikiIds.size);
      value = {
        parse: { wikitext: `{{Skill infobox\n| id = ${wikiIds.get(page)}\n| family = bear\n| archetype = stout\n}}` }
      };
    } else assert.fail(`Unexpected request: ${url}`);
    return { ok: true, json: async () => value };
  });
  const snapshot = {
    skills: [43136, 43060, 45797].map((id) => ({ id, name: `Skill ${id}` })),
    specializations: []
  };
  await updateRangerData();
  assert.deepEqual(
    requests.filter(({ url }) => url.pathname === '/v2/pets').map(({ url }) => url.searchParams.get('ids')),
    [null, '9,2,14']
  );
  const skillRequests = requests
    .filter(({ url }) => url.pathname === '/v2/skills')
    .flatMap(({ url }) => url.searchParams.get('ids').split(',').map(Number));
  for (const petSkillId of [902, 901, 900, 12676, 12724])
    assert.equal(skillRequests.filter((id) => id === petSkillId).length, 1, `pet skill ${petSkillId} is fetched once`);
  // The API rejects authored pet skills, so requesting them could fail a whole batch.
  for (const authoredSkillId of [12655, 12735, 45990])
    assert.equal(skillRequests.includes(authoredSkillId), false, `authored skill ${authoredSkillId} is not requested`);
  assert.equal(skillRequests.includes(999), false);
  assert.match(writes[1].source, /SHARED_BITE: 900/);
  assert.match(writes[1].source, /SHARED_BITE_ID_901: 901/);
  assert.doesNotMatch(writes[1].source, /: 999,/);
  // The orchestrator's unmodified pet order controls output; the test never filters the API response itself.
  const bearIndex = writes[2].source.indexOf("name: 'Bear'");
  const cubIndex = writes[2].source.indexOf("name: 'Bear Cub'");
  assert.ok(bearIndex >= 0);
  assert.ok(cubIndex > bearIndex);
  const { RANGER_SKILL_IDS: ids } = await importGeneratorSource(writes[1].target, writes);
  for (const [, key] of writes[2].source.matchAll(/ID\.([A-Z_][A-Z_0-9]*)/g))
    assert.ok(Object.hasOwn(ids, key), `pet reference ${key} is declared`);
  assert.match(writes[2].source, /id: ID.SHARED_BITE,/);
  assert.doesNotMatch(writes[2].source, /White Moa/);

  requests.length = 0;
  const generated = await generateWarriorData({
    ...snapshot,
    skills: snapshot.skills.map((skill, index) => (index === 0 ? { ...skill, name: '123 Strike' } : skill))
  });
  assert.match(generated.files[0].source, /SKILL_123_STRIKE: 43136/);
  // Header checks must exercise a real request rather than passing an empty iteration.
  assert.ok(requests.length > 0, 'Warrior generation requests supplemental data');
  for (const { url, options } of requests) {
    // Supplemental identities come from the wiki; the snapshot already holds every API skill.
    assert.equal(url.hostname, 'wiki.guildwars2.com');
    assert.equal(options.headers['User-Agent'], 'gw2-combat-simulator/2.0 Warrior generator');
  }
});
