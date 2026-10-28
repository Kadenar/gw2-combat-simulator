import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  committedIdentities,
  constantName,
  declarations,
  generateProfessionIds,
  mapConcurrent,
  stableEntries,
  traitIdentities,
  writeGeneratedFiles
} from '../../scripts/data/lib/generator-utils.mjs';
import { mockGeneratorFiles } from '../helpers/generator-fixtures.mjs';

// Resolve the virtual identity file the way the generator does, so the tests pass from any working directory.
const rangerIdsTarget = fileURLToPath(new URL('../../js/games/gw2/professions/ranger/data/ids.ts', import.meta.url));

// API/supplemental overlap must not create aliases or treat a suffixed identity differently from a bare one.
test('identity allocation deduplicates overlapping bare and suffixed records', () => {
  assert.deepEqual(
    stableEntries(
      [
        ['Twin', 1],
        ['Twin', 2],
        ['Twin', 1],
        ['Twin', 2]
      ],
      {}
    ),
    [
      { key: 'TWIN', id: 1, name: 'Twin' },
      { key: 'TWIN_ID_2', id: 2, name: 'Twin' }
    ]
  );
});

test('committed identity bindings survive reordered and newly inserted same-name records', () => {
  const committed = { FORCEFUL_SHOT: 14544, HARRIERS_TOSS: 73024, MAUL_SOULBEAST: 41800 };
  const inputs = [
    ['Forceful Shot', 14469],
    ['Forceful Shot', 14544],
    ["Harrier's Toss", 73006],
    ["Harrier's Toss", 73024],
    ['Maul', 41800],
    ['Maul', 9]
  ];
  for (const records of [inputs, inputs.toReversed()]) {
    const entries = stableEntries(records, committed);
    const ids = Object.fromEntries(entries.map(({ key, id }) => [key, id]));
    assert.equal(ids.FORCEFUL_SHOT, 14544);
    assert.equal(ids.FORCEFUL_SHOT_ID_14469, 14469);
    assert.equal(ids.HARRIERS_TOSS, 73024);
    assert.equal(ids.HARRIERS_TOSS_ID_73006, 73006);
    assert.equal(ids.MAUL_SOULBEAST, 41800);
    assert.equal(ids.MAUL, 9);
    assert.doesNotThrow(() => declarations([{ name: 'IDS', entries, committed }]));
  }
});

test('named declaration validation reports all ambiguous, invalid, missing, and retargeted keys', () => {
  for (const records of [
    [
      ['Twin', 1],
      ['Twin ID 2', 3],
      ['Twin', 2]
    ],
    [
      ['Twin', 1],
      ['Twin', 2],
      ['Twin ID 2', 3]
    ]
  ])
    assert.throws(
      () => declarations([{ name: 'SKILLS', entries: stableEntries(records, {}), committed: {} }]),
      /SKILLS: duplicate key TWIN_ID_2/
    );
  assert.throws(
    () =>
      declarations([
        {
          name: 'SKILLS',
          entries: [
            { key: 'FIXED', id: 1 },
            { key: 'FIXED', id: 2 },
            { key: '1_INVALID', id: 3 },
            { key: 'OTHER', id: 4 }
          ],
          committed: { FIXED: 1, MISSING: 5 }
        }
      ]),
    (error) => {
      for (const text of [
        'SKILLS:',
        'duplicate key FIXED',
        'invalid key 1_INVALID',
        'retargeted key FIXED',
        'missing committed key MISSING'
      ])
        assert.ok(error.message.includes(text), error.message);
      return true;
    }
  );
});

test('fixed identities survive missing API records and exact overlap without creating aliases', () => {
  const fixed = [
    { key: 'PET_SWAP', id: -4 },
    { key: 'BLACK_HOLE', id: 31436 }
  ];
  const entries = stableEntries([['Black Hole', 31436]], { PET_SWAP: -4, BLACK_HOLE: 31436 }, fixed);
  assert.deepEqual(entries, fixed);
  assert.deepEqual(stableEntries([['Evolve', 1]], {}, [{ key: 'EVOLVE_BASE', id: 1 }]), [
    { key: 'EVOLVE_BASE', id: 1 }
  ]);
  assert.equal(stableEntries([['Reserved', 2]], {}, [{ key: 'RESERVED', id: 1 }])[1].key, 'RESERVED_ID_2');
});

test('all generators share digit-leading names and trait flattening', () => {
  assert.equal(constantName('123 Strike'), 'SKILL_123_STRIKE');
  assert.equal(stableEntries([['123 Strike', 1]], {})[0].key, 'SKILL_123_STRIKE');
  assert.deepEqual(
    traitIdentities([{ minorTraits: [{ name: 'Minor', id: 1 }], majorTraits: [[{ name: 'Major', id: 2 }]] }]),
    [
      ['Minor', 1],
      ['Major', 2]
    ]
  );
});

test('generator helpers normalize names and preserve order across concurrent work', async () => {
  assert.equal(constantName('Dragon Slash\u2014Force\u2019s 2'), 'DRAGON_SLASH_FORCES_2');

  let active = 0;
  let peak = 0;
  const result = await mapConcurrent([30, 5, 15], 2, async (delay) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, delay));
    active -= 1;
    return delay;
  });

  assert.deepEqual(result, [30, 5, 15]);
  assert.equal(peak, 2);
});

// Name availability must not change an existing binding, and new collisions must have deterministic ownership.
test('blank names retain committed IDs and new names allocate independently of input order', () => {
  const committed = { KEPT: 1, SYMBOLS: 2 };
  const entries = stableEntries(
    [
      ['', 1],
      ['!!!', 2]
    ],
    committed
  );
  assert.doesNotThrow(() => declarations([{ name: 'IDS', entries, committed }]));
  const records = [
    ['New', 4],
    ['New', 3],
    ['Other', 4]
  ];
  const map = (input) => Object.fromEntries(stableEntries(input, {}).map(({ key, id }) => [key, id]));
  assert.deepEqual(map(records), map(records.toReversed()));
  assert.deepEqual(map(records), { NEW_ID_4: 4, NEW: 3 });
});

test('missing committed exports fail explicitly before any generation', async (context) => {
  assert.throws(() => stableEntries([], undefined), /required committed identity map/);
  assert.throws(
    () => declarations([{ name: 'IDS', entries: [], committed: undefined }]),
    /IDS: required committed identity map/
  );
  const { published, writes } = mockGeneratorFiles(context);
  published.set(rangerIdsTarget, 'export const RENAMED_SKILL_IDS = {}; export const RANGER_TRAIT_IDS = {};');
  await assert.rejects(
    generateProfessionIds({ profession: 'ranger', generator: 'fixture', skills: [], specializations: [] }),
    /RANGER_SKILL_IDS: required committed identity map/
  );
  assert.equal(writes.length, 0);
});

// One run must surface every affected map, because each retry repeats the full API snapshot.
test('profession ID generation reports skill and trait problems together with removal guidance', async (context) => {
  const { published } = mockGeneratorFiles(context);
  published.set(
    rangerIdsTarget,
    'export const RANGER_SKILL_IDS = { GONE: 1 }; export const RANGER_TRAIT_IDS = { ALSO_GONE: 2 };'
  );
  await assert.rejects(
    generateProfessionIds({ profession: 'ranger', generator: 'fixture', skills: [], specializations: [] }),
    (error) => {
      for (const text of [
        'RANGER_SKILL_IDS: missing committed key GONE: 1',
        'RANGER_TRAIT_IDS: missing committed key ALSO_GONE: 2',
        'author the identity in the generator'
      ])
        assert.ok(error.message.includes(text), error.message);
      return true;
    }
  );
});

// Load real TypeScript through its path so syntax, relative imports, and subsequent edits all remain supported.
test('committed identity loading supports TypeScript and fresh revisions', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'generator-identities-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const target = path.join(directory, 'ids.ts');
  await fs.writeFile(path.join(directory, 'value.ts'), 'export const value = 7 as const;');
  await fs.writeFile(
    target,
    "import { value } from './value.ts'; export const IDS = { KEPT: value } as const satisfies Record<string, number>;"
  );
  assert.deepEqual((await committedIdentities(target)).IDS, { KEPT: 7 });
  await fs.writeFile(target, 'export const IDS = { KEPT: 8 } as const;');
  assert.deepEqual((await committedIdentities(target)).IDS, { KEPT: 8 });
});

test('formatting validates every artifact before publication and forwards the requested logger', async (context) => {
  const { writes, logs } = mockGeneratorFiles(context);
  const messages = [];
  const target = rangerIdsTarget;
  // The failure names the artifact, since Prettier alone reports only a position.
  await assert.rejects(
    writeGeneratedFiles([
      { target, source: 'export const OK = 1;' },
      { target, source: 'export const =' }
    ]),
    (error) => error.message.includes(target) && error.cause instanceof Error
  );
  assert.equal(writes.length, 0);
  await writeGeneratedFiles([{ target, source: 'export const IDS={KEY:1,};', summary: '1 skill ID' }], {
    log: (message) => messages.push(message)
  });
  assert.equal(writes[0].source, 'export const IDS = { KEY: 1 };\n');
  assert.deepEqual(messages, [`Wrote 1 skill ID to ${target}.`]);
  assert.equal(logs.length, 0);
});
