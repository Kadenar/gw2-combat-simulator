import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { generatorPreload, importGeneratorSource, mockGeneratorFiles } from '../helpers/generator-fixtures.mjs';
import { writeGeneratedFiles } from '../../scripts/data/lib/generator-utils.mjs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('refresh imports are inert and each invocation completes the profession pipeline in order', async (context) => {
  const { writes, published, logs } = mockGeneratorFiles(context);
  const requests = [];
  const wikiIds = new Map();
  let invalidNames = false;
  let failedHost = null;
  context.mock.method(globalThis, 'fetch', async (request) => {
    const url = new URL(request);

    requests.push(url);
    if (url.hostname === failedHost) throw new Error('Fixture downstream unavailable');
    let value;

    if (url.pathname.startsWith('/v2/professions/')) {
      value = {
        id: url.pathname.split('/').at(-1),
        specializations: [],
        skills: [
          30185,
          62803,
          62857,
          43136,
          43060,
          45797,
          69565,
          51667,
          ...(invalidNames ? [90001, 90002, 90003] : [])
        ].map((id) => ({ id }))
      };
    } else if (url.pathname === '/v2/skills') {
      value = url.searchParams
        .get('ids')
        .split(',')
        .map(Number)
        .map((id) => ({
          id,
          name: { 90001: 'Twin', 90002: 'Twin', 90003: 'Twin ID 90002' }[id] ?? `Fixture ${id}`,
          type: 'Profession',
          facts: [],
          ...(id === 62803 ? { flip_skill: 62857 } : {})
        }));
    } else if (url.pathname === '/v2/pets') {
      value = url.searchParams.has('ids')
        ? [
            { id: 9, name: 'Juvenile Bear', skills: [{ id: 902 }] },
            { id: 14, name: 'Juvenile White Moa', skills: [{ id: 999 }] }
          ]
        : [9, 14];
    } else if (url.hostname === 'wiki.guildwars2.com' && url.pathname === '/api.php') {
      const page = url.searchParams.get('page');

      if (!wikiIds.has(page)) wikiIds.set(page, 80000 + wikiIds.size);
      value = {
        parse: { wikitext: `{{Skill infobox\n| id = ${wikiIds.get(page)}\n| family = bear\n| archetype = stout\n}}` }
      };
    } else {
      assert.fail(`Unexpected fixture request: ${url}`);
    }

    return { ok: true, json: async () => value };
  });
  const { updateProfessionData } = await import('../../scripts/data/update-profession-data.mjs');

  assert.equal(requests.length, 0);
  assert.equal(writes.length, 0);

  for (const [profession, outputs] of [
    ['Engineer', ['engineer-api-metadata.ts', 'ids.ts']],
    ['Revenant', ['revenant-api-metadata.ts', 'ids.ts']],
    ['Elementalist', ['elementalist-api-metadata.ts']],
    ['Ranger', ['ranger-api-metadata.ts', 'ids.ts', 'ranger-pet-data.ts']],
    ['Warrior', ['warrior-api-metadata.ts', 'ids.ts', 'warrior-supplemental-skills.ts']],
    ['Guardian', ['guardian-api-metadata.ts']]
  ]) {
    // A second successful call must refresh again even though the modules are already cached.
    for (let invocation = 0; invocation < 2; invocation += 1) {
      writes.length = 0;
      logs.length = 0;
      requests.length = 0;
      await updateProfessionData(['--profession', profession.toLowerCase()]);

      assert.equal(requests[0].pathname, `/v2/professions/${profession}`);
      assert.deepEqual(
        writes.map(({ file }) => file),
        outputs
      );
      const { SKILLS: skills } = await importGeneratorSource(writes[0].target, writes);
      assert.equal(logs.length, outputs.length);
      for (const [index, message] of logs.entries()) {
        assert.ok(message.includes(writes[index].target));
        assert.match(message, /Wrote \d+/);
      }

      if (outputs.includes('ids.ts')) {
        const generated = await importGeneratorSource(writes[1].target, writes);
        for (const identities of Object.values(generated)) {
          assert.ok(Object.keys(identities).every((key) => /^[A-Z_][A-Z0-9_]*$/.test(key)));
        }

        if (profession === 'Engineer') {
          assert.equal(generated.ENGINEER_SKILL_IDS.FIXTURE_69565_NON_HOLOSMITH, 69565);
          assert.equal(generated.ENGINEER_SKILL_IDS.STOW_ELITE_MORTAR_KIT, -301);
          assert.equal(generated.ENGINEER_SKILL_IDS.POISON_GRENADE, 5806);
        }

        if (profession === 'Revenant') {
          assert.equal(generated.REVENANT_SKILL_IDS.TRUE_NATURE_ASSASSIN, 51667);
          assert.equal(generated.REVENANT_SKILL_IDS.SWAP_LEGENDS, -4);
          assert.equal(generated.REVENANT_SKILL_IDS.LEGENDARY_DWARF_STANCE, 26650);
        }
      }

      if (profession === 'Ranger') {
        assert.equal(
          requests.filter((url) => url.pathname === '/v2/pets').length,
          2,
          'fetch pet IDs and records once per refresh'
        );
        assert.match(writes[1].source, /FIXTURE_902: 902/);
        assert.match(writes[2].source, /ID.FIXTURE_902/);
        assert.doesNotMatch(writes[1].source + writes[2].source, /: 999,|White Moa/);
      }

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

  // Validation failures leave the entire previously published generation intact and permit a clean retry.
  for (const profession of ['Engineer', 'Revenant', 'Ranger', 'Warrior']) {
    writes.length = 0;
    const before = new Map(published);
    invalidNames = true;
    await assert.rejects(updateProfessionData(['--profession', profession]), /duplicate key TWIN_ID_90002/);
    assert.equal(writes.length, 0);
    assert.deepEqual(published, before);
    invalidNames = false;
    await updateProfessionData(['--profession', profession]);
    assert.ok(writes.length >= 2);
  }

  // A late pet metadata failure must also leave metadata and the already prepared ID map unpublished.
  writes.length = 0;
  failedHost = 'wiki.guildwars2.com';
  const beforePetFailure = new Map(published);
  await assert.rejects(updateProfessionData(['--profession', 'Ranger']), /Fixture downstream unavailable/);
  assert.equal(writes.length, 0);
  assert.deepEqual(published, beforePetFailure);
  failedHost = null;

  // Metadata-only callers retain their logger option without duplicate console output.
  const { updateWarriorApiData } = await import('../../scripts/data/update-warrior-api-data.mjs');
  const messages = [];
  logs.length = 0;
  await updateWarriorApiData({ log: (message) => messages.push(message) });
  assert.equal(messages.length, 1);
  assert.match(messages[0], /Wrote \d+ skills.*warrior-api-metadata\.ts/);
  assert.equal(logs.length, 0);
  writes.length = 0;

  const failure = new Error('Fixture API unavailable');

  context.mock.method(globalThis, 'fetch', async () => {
    throw failure;
  });
  for (const profession of ['Ranger', 'Engineer', 'Revenant'])
    await assert.rejects(updateProfessionData(['--profession', profession]), (error) => error === failure);
  assert.equal(writes.length, 0, 'failed snapshots must not trigger dependent generation');
});

// Replaying committed source snapshots detects accidental renames without fetching live API data or writing files.
test('Engineer and Revenant generators preserve every committed identity and formatted source', async (context) => {
  const { writes } = mockGeneratorFiles(context, { emptyIdentities: false });
  const { readFile } = await import('node:fs/promises');
  const { generateEngineerIds } = await import('../../scripts/data/generate-engineer-ids.mjs');
  const { generateRevenantIds } = await import('../../scripts/data/generate-revenant-ids.mjs');
  for (const [profession, generate] of [
    ['engineer', generateEngineerIds],
    ['revenant', generateRevenantIds]
  ]) {
    const directory = `../../js/games/gw2/professions/${profession}/data`;
    const { SKILLS, SPECIALIZATIONS } = await import(`${directory}/${profession}-api-metadata.ts`);
    const {
      files: [{ target, source }]
    } = await generate({ skills: SKILLS, specializations: SPECIALIZATIONS });
    const actual = await importGeneratorSource(target, [{ target, source }]);
    const expected = await import(`${directory}/ids.ts`);
    assert.deepEqual({ ...actual }, { ...expected });
    const committed = await readFile(target, 'utf8');
    await writeGeneratedFiles([{ target, source }]);
    // Check publication directly while ignoring checkout-specific Windows line endings.
    assert.equal(writes.at(-1).source, committed.replace(/\r\n/g, '\n'));
  }
});

test('refresh files execute when invoked directly', () => {
  // Stop at the first API request to check CLI guards without network traffic or generated-file writes.
  const preload = generatorPreload(
    "globalThis.fetch = async (url) => { throw new Error('Refresh requested: ' + url); };"
  );

  for (const [profession, script, args = []] of [
    ['Guardian', 'update-profession-data.mjs', ['--profession', 'Guardian']],
    ['Guardian', 'update-profession-api-data.mjs', ['--profession', 'Guardian']],
    ['Elementalist', 'update-elementalist-api-data.mjs'],
    ['Ranger', 'update-ranger-data.mjs'],
    ['Warrior', 'update-warrior-data.mjs'],
    ['Warrior', 'update-warrior-api-data.mjs']
  ]) {
    const entry = fileURLToPath(new URL(`../../scripts/data/${script}`, import.meta.url));
    const result = spawnSync(process.execPath, ['--import', preload, entry, ...args], { encoding: 'utf8' });

    assert.equal(result.status, 1, result.stderr);
    assert.ok(result.stderr.includes(`Refresh requested: https://api.guildwars2.com/v2/professions/${profession}`));
  }
});

test('direct ID generation loads committed source without compilation or network I/O', () => {
  // Abort at the write boundary so the real CLI can load source data without altering committed IDs.
  const preload = generatorPreload(`
    import fs from 'node:fs/promises';
    import { syncBuiltinESMExports } from 'node:module';
    fs.writeFile = async (file) => { throw new Error('Generated IDs: ' + file); };
    globalThis.fetch = async () => { throw new Error('Unexpected network request'); };
    syncBuiltinESMExports();
  `);
  for (const profession of ['engineer', 'revenant']) {
    const entry = fileURLToPath(new URL(`../../scripts/data/generate-${profession}-ids.mjs`, import.meta.url));
    const result = spawnSync(process.execPath, ['--import', preload, entry], { encoding: 'utf8' });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /Generated IDs:.*ids\.ts/);
    assert.doesNotMatch(result.stderr, /Unexpected network request/);
  }
});

// A Guardian refresh must not evaluate another profession's supplemental TypeScript or identity declarations.
test('unrelated profession source cannot break a Guardian refresh', () => {
  const preload = generatorPreload(`
    import { registerHooks } from 'node:module';
    registerHooks({ resolve(specifier, context, nextResolve) {
      if (/professions\\/(engineer|revenant)\\/data/.test(specifier)) throw new Error('Unrelated source loaded');
      return nextResolve(specifier, context);
    } });
    globalThis.fetch = async () => { throw new Error('Guardian reached API'); };
  `);
  const entry = fileURLToPath(new URL('../../scripts/data/update-profession-data.mjs', import.meta.url));
  const result = spawnSync(process.execPath, ['--import', preload, entry, '--profession', 'Guardian'], {
    encoding: 'utf8'
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Guardian reached API/);
  assert.doesNotMatch(result.stderr, /Unrelated source loaded/);
});
