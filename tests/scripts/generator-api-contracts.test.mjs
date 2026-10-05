import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { generateRangerIds } from '../../scripts/data/generate-ranger-ids.mjs';
import { generateRangerPetData } from '../../scripts/data/generate-ranger-pet-data.mjs';
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
  const writes = [];
  const requests = [];
  const wikiIds = new Map();
  // Unsorted pets and duplicate names expose changes to generation order without writing real catalogs.
  const pets = [
    { id: 9, name: 'Juvenile Bear', skills: [{ id: 902 }, { id: 901 }] },
    { id: 2, name: 'Juvenile Bear Cub', skills: [{ id: 900 }] },
    { id: 14, name: 'Juvenile White Moa', skills: [{ id: 999 }] }
  ];
  context.mock.method(fs, 'writeFile', async (file, source) => writes.push({ file: path.basename(file), source }));
  context.mock.method(console, 'log', () => {});
  context.mock.method(console, 'warn', (message) => assert.fail(message));
  context.mock.method(globalThis, 'fetch', async (request, options) => {
    const url = new URL(request);
    requests.push({ url, options });
    const ids = url.searchParams.get('ids')?.split(',').map(Number);
    let value;
    if (url.pathname === '/v2/pets') {
      value = ids ? ids.map((id) => pets.find((pet) => pet.id === id)) : pets.map((pet) => pet.id);
    } else if (url.pathname === '/v2/skills') {
      value = ids.map((id) => ({ id, name: id < 1000 ? 'Shared Bite' : `Skill ${id}` }));
    } else if (url.hostname === 'wiki.guildwars2.com') {
      const page = url.searchParams.get('page');
      if (!wikiIds.has(page)) wikiIds.set(page, 80000 + wikiIds.size);
      value = {
        parse: { wikitext: `{{Skill infobox\n| id = ${wikiIds.get(page)}\n| family = bear\n| archetype = stout\n}}` }
      };
    } else assert.fail(`Unexpected request: ${url}`);
    return { ok: true, json: async () => value };
  });
  syncBuiltinESMExports();
  context.after(() => {
    context.mock.restoreAll();
    syncBuiltinESMExports();
  });

  const snapshot = {
    skills: [43136, 43060, 45797].map((id) => ({ id, name: `Skill ${id}` })),
    specializations: []
  };
  await generateRangerIds(snapshot);
  await generateRangerPetData(snapshot);
  assert.match(writes[0].source, /SHARED_BITE: 902/);
  assert.match(writes[0].source, /SHARED_BITE_ID_901: 901/);
  assert.doesNotMatch(writes[0].source, /999/);
  // Presence must be established before comparing positions; a missing token otherwise sorts before real output.
  const bearIndex = writes[1].source.indexOf('name: "Bear"');
  const cubIndex = writes[1].source.indexOf('name: "Bear Cub"');
  assert.ok(bearIndex >= 0, 'generated pet data contains Bear');
  assert.ok(cubIndex >= 0, 'generated pet data contains Bear Cub');
  assert.ok(bearIndex < cubIndex);
  assert.match(writes[1].source, /id: ID.SHARED_BITE,/);
  assert.doesNotMatch(writes[1].source, /White Moa/);

  requests.length = 0;
  await generateWarriorData(snapshot);
  // Header checks must exercise a real request rather than passing an empty iteration.
  assert.ok(requests.length > 0, 'Warrior generation requests supplemental data');
  for (const { url, options } of requests) {
    assert.equal(options.headers['User-Agent'], 'gw2-combat-simulator/2.0 Warrior generator');
    if (url.hostname === 'api.guildwars2.com') {
      assert.equal(url.searchParams.get('lang'), 'en');
      assert.equal(url.searchParams.get('ids'), '43136,43060,45797');
    }
  }
});
