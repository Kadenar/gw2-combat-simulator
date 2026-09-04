import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('refresh imports are inert and each invocation completes the profession pipeline in order', async (context) => {
  const writes = [];
  const requests = [];
  const wikiIds = new Map();

  // Run the real refresh and generator functions with in-memory I/O so checks cannot fetch or overwrite live data.
  context.mock.method(fs, 'mkdir', async () => {});
  context.mock.method(fs, 'writeFile', async (file, source) => {
    await Promise.resolve();
    writes.push({ file: path.basename(file), source });
  });
  context.mock.method(console, 'log', () => {});
  context.mock.method(globalThis, 'fetch', async (request) => {
    const url = new URL(request);

    requests.push(url);
    let value;

    if (url.pathname.startsWith('/v2/professions/')) {
      value = {
        id: url.pathname.split('/').at(-1),
        specializations: [],
        skills: [30185, 62803, 62857].map((id) => ({ id }))
      };
    } else if (url.pathname === '/v2/skills') {
      value = url.searchParams
        .get('ids')
        .split(',')
        .map(Number)
        .map((id) => ({
          id,
          name: `Fixture ${id}`,
          type: 'Profession',
          facts: [],
          ...(id === 62803 ? { flip_skill: 62857 } : {})
        }));
    } else if (url.pathname === '/v2/pets') {
      value = [];
    } else if (url.hostname === 'wiki.guildwars2.com' && url.pathname === '/api.php') {
      const page = url.searchParams.get('page');

      if (!wikiIds.has(page)) wikiIds.set(page, 80000 + wikiIds.size);
      value = { parse: { wikitext: `{{Skill infobox\n| id = ${wikiIds.get(page)}\n| activation = 0.5\n}}` } };
    } else {
      assert.fail(`Unexpected fixture request: ${url}`);
    }

    return { ok: true, json: async () => value };
  });
  syncBuiltinESMExports();
  context.after(() => {
    context.mock.restoreAll();
    syncBuiltinESMExports();
  });

  const { updateProfessionData } = await import('../../scripts/data/update-profession-data.mjs');

  assert.equal(requests.length, 0);
  assert.equal(writes.length, 0);

  for (const [profession, outputs] of [
    ['Elementalist', ['elementalist-api-metadata.ts']],
    ['Ranger', ['ranger-api-metadata.ts', 'ids.ts', 'ranger-pet-data.ts']],
    ['Warrior', ['warrior-api-metadata.ts', 'ids.ts', 'warrior-supplemental-skills.ts']],
    ['Guardian', ['guardian-api-metadata.ts']]
  ]) {
    // A second successful call must refresh again even though the modules are already cached.
    for (let invocation = 0; invocation < 2; invocation += 1) {
      writes.length = 0;
      requests.length = 0;
      await updateProfessionData(['--profession', profession.toLowerCase()]);

      assert.equal(requests[0].pathname, `/v2/professions/${profession}`);
      assert.deepEqual(
        writes.map(({ file }) => file),
        outputs
      );
      const skills = JSON.parse(writes[0].source.match(/export const SKILLS:[^\n]+ = ([\s\S]+);\n$/)[1]);

      if (profession === 'Elementalist') {
        assert.ok(
          skills.some(({ id }) => id === 29415),
          'supplemental Elementalist skills survive refresh'
        );
      }

      if (profession === 'Warrior') {
        assert.equal(skills.find(({ id }) => id === 62803).flipSkillId, null);
        assert.equal(
          skills.some(({ id }) => id === 62857),
          false
        );
      }
    }
  }

  writes.length = 0;
  const failure = new Error('Fixture API unavailable');

  context.mock.method(globalThis, 'fetch', async () => {
    throw failure;
  });
  await assert.rejects(updateProfessionData(['--profession', 'Ranger']), (error) => error === failure);
  assert.equal(writes.length, 0, 'failed snapshots must not trigger dependent generation');
});

test('specialized refresh files still execute when invoked directly', () => {
  // Stop at the first API request to check CLI guards without network traffic or generated-file writes.
  const preload = `data:text/javascript,${encodeURIComponent(
    "globalThis.fetch = async (url) => { throw new Error('Refresh requested: ' + url); };"
  )}`;

  for (const [profession, script] of [
    ['Elementalist', 'update-elementalist-api-data.mjs'],
    ['Ranger', 'update-ranger-data.mjs'],
    ['Warrior', 'update-warrior-data.mjs']
  ]) {
    const entry = fileURLToPath(new URL(`../../scripts/data/${script}`, import.meta.url));
    const result = spawnSync(process.execPath, ['--import', preload, entry], { encoding: 'utf8' });

    assert.equal(result.status, 1, result.stderr);
    assert.ok(result.stderr.includes(`Refresh requested: https://api.guildwars2.com/v2/professions/${profession}`));
  }
});
