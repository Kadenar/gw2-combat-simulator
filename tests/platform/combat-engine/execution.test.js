import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

import { roundHalfEven } from '#gw2/platform/combat-engine/numeric.js';
import { Pool } from '#gw2/platform/combat-engine/registry.js';
import { prepareEncounter, runCombatEngine } from '#gw2/platform/combat-engine/run.js';
import { encounter, flatStrike, skill } from '../../fixtures/combat-engine.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(here, '../../../js/games/gw2/platform/combat-engine');

const procEncounter = () =>
  encounter({
    skills: [flatStrike('Proc', 100, { cooldown: [2000, 2000] }), flatStrike('Hit', 1000)],
    casts: ['Hit', ['Hit', 1000], ['Hit', 2500]],
    playerBuild: {
      permanent_unique_effects: [
        {
          unique_effect_key: 'Proc Trait',
          skill_triggers: [
            { condition: { only_applies_on_strikes: true, depends_on_skill_off_cooldown: 'Proc' }, skill_key: 'Proc' }
          ]
        }
      ]
    }
  });

/** Many half-chance critical strikes in rolled mode, so different seeds produce different totals. */
const rolledEncounter = () =>
  encounter({
    skills: [
      skill('Flurry', {
        weapon_type: 'empty_handed',
        damage_coefficient: 1,
        strike_on_tick_list: [Array(40).fill(0), Array(40).fill(0)]
      })
    ],
    casts: ['Flurry'],
    playerAttributes: [['precision', 1945]],
    critical_strike_mode: 'RANDOM'
  });

// Score mode may omit histories, but it must not change combat execution.
test('score and detailed output accumulate identical results', () => {
  const detailed = runCombatEngine({ encounter: procEncounter() });
  const score = runCombatEngine({ encounter: procEncounter(), output: 'score' });

  assert.deepEqual(
    [score.totalDamage, score.dps, score.endTick, score.terminatedBy],
    [detailed.totalDamage, detailed.dps, detailed.endTick, detailed.terminatedBy]
  );
  assert.deepEqual(score.damageBySourceActor, detailed.damageBySourceActor);
  assert.equal(score.events, undefined);
  assert.equal(score.identity.mode, 'score');
  assert.ok(detailed.events.length > 0);
});

// Prepared content is immutable and reusable; live state must never cross runs.
test('a prepared encounter produces isolated, reproducible runs', () => {
  const prepared = prepareEncounter(procEncounter());
  const first = runCombatEngine({ encounter: prepared });
  const second = runCombatEngine({ encounter: prepared });

  assert.equal(prepareEncounter(prepared), prepared);
  assert.ok(Object.isFrozen(prepared.actors[0].build.skills[0]));
  assert.deepEqual(second.events, first.events);
});

test('random draw sites are reproducible per seed and independent across seeds', () => {
  const totals = [1, 2, 3, 4, 5].map((seed) => runCombatEngine({ encounter: rolledEncounter(), seed }).totalDamage);
  const repeat = runCombatEngine({ encounter: rolledEncounter(), seed: 1 });

  assert.equal(repeat.totalDamage, totals[0]);
  assert.ok(new Set(totals).size > 1, 'different seeds should roll different critical strikes');
});

test('a run that never meets a termination condition fails instead of reporting a partial score', () => {
  const result = runCombatEngine({
    encounter: encounter({ terminationConditions: [{ type: 'TIME', time: 1000 }] }),
    tickLimit: 10
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'loop.tick-limit');
});

test('the engine runs in a worker thread with the same result', async () => {
  const request = { encounter: procEncounter() };
  const workerResult = await new Promise((resolve, reject) => {
    const worker = new Worker(path.resolve(here, '../../fixtures/combat-engine-worker.js'), { workerData: request });
    worker.once('message', resolve);
    worker.once('error', reject);
  });

  assert.equal(workerResult.totalDamage, runCombatEngine(request).totalDamage);
});

// Reference iteration order: newest entries first, removal swaps the last entry into the freed slot.
test('pools iterate newest-first with swap-and-pop removal', () => {
  const pool = new Pool();
  for (const entity of [1, 2, 3, 4]) pool.emplace(entity, entity * 10);
  pool.remove(2);
  const visited = [];
  pool.forEach((entity) => {
    visited.push(entity);
    if (entity === 3) pool.emplace(5, 50);
  });

  assert.deepEqual(visited, [3, 4, 1]);
  assert.deepEqual(
    [...pool.entries()].map(([entity]) => entity),
    [5, 3, 4, 1]
  );
});

test("rounding follows the reference banker's rounding", () => {
  assert.deepEqual([0.5, 1.5, 2.5, -2.5, 2.4, 2.6].map(roundHalfEven), [0, 2, 2, -2, 2, 3]);
});

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory() ? sourceFiles(path.join(directory, entry.name)) : [path.join(directory, entry.name)]
    )
  );
  return nested.flat().filter((file) => file.endsWith('.ts'));
}

// Headless execution: the new runtime may not reach browser globals, application code, or profession content.
test('combat-engine sources stay headless and profession neutral', async () => {
  const files = await sourceFiles(sourceRoot);

  assert.ok(files.length > 0);
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const code = source.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/\/\/[^\n]*/g, '');
    const imports = [...source.matchAll(/from '([^']+)'/g)].map(([, specifier]) => specifier);

    for (const specifier of imports) {
      assert.ok(specifier.startsWith('#gw2/platform/combat-engine/'), `${file} imports ${specifier}`);
    }

    assert.equal(/\b(?:window|document|navigator|localStorage)\b/.test(code), false, `${file} uses a browser global`);
  }
});
