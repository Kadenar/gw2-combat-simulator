import { scenarioSimulation } from '#gw2/app/boss-scenarios/simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { ENCOUNTER_TEMPLATES, encounterHealth } from '#gw2/app/boss-scenarios/catalog.js';
import { encounterPhasePlan } from '#gw2/app/boss-scenarios/phases.js';
import { ENCOUNTER_HEALTH } from '#gw2/app/boss-scenarios/health-data.js';
import { createBossScenario, selectScenarioEncounter, parseBossScenario } from '#gw2/app/boss-scenarios/model.js';
import { createDefaultBuild } from '#gw2/app/build/state/persistence.js';
import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';
import {
  combineEncounterHealth,
  extractEncounterHealth,
  runtimeEncounterHealth
} from '../../../../scripts/data/boss-health-evidence.mjs';

const adapter = await loadProfessionAppAdapter('engineer');
const makeDraft = () =>
  createBossScenario(
    '020102',
    { ...createDefaultBuild(adapter), rotation: [{ type: 'wait', durationMs: 1000 }] },
    'My build',
    'current',
    true
  );
const parse = (value) => parseBossScenario(value, 'engineer', adapter.toApplicationBuild);

// Boss mechanics own the sequence; authors supply only squad damage, split time, and a continuous rotation.
test('automatic splits and one continuous rotation round-trip independently of Golem', () => {
  const build = { ...createDefaultBuild(adapter), rotation: [{ type: 'wait', durationMs: 1000 }] };
  const draft = createBossScenario('020102', build, 'My build', 'current', true);
  assert.deepEqual(
    draft.phases.map((phase) => phase.kind),
    ['boss', 'split', 'boss', 'split', 'boss']
  );
  assert.deepEqual(
    encounterPhasePlan('020102', 'normal')
      .phases.filter((p) => p.kind === 'boss')
      .map((p) => p.endHealthPercent),
    [66, 33, 0]
  );
  draft.phases[0].groupDps = 180000;
  draft.phases[1].durationSeconds = 18.5;
  draft.build.rotation.push({ type: 'wait', durationMs: 2000 });
  const restored = parse(JSON.parse(JSON.stringify(draft)));
  assert.deepEqual(restored, draft);
  assert.doesNotMatch(JSON.stringify(restored), /https?:\/\//);
  assert.deepEqual(build.rotation, [{ type: 'wait', durationMs: 1000 }]);
  assert.equal(restored.health, encounterHealth('020102', 'normal').targets[0].health);
});

test('difficulty installs its phase plan and health without changing the authored rotation', () => {
  const draft = makeDraft();
  const rotation = structuredClone(draft.build.rotation);
  selectScenarioEncounter(draft, '040305', 'normal');
  const normal = draft.phases.length;
  selectScenarioEncounter(draft, '040305', 'challenge');
  assert.equal(draft.phases.length, normal - 2);
  assert.deepEqual(draft.build.rotation, rotation);
  assert.equal(draft.health, encounterHealth('040305', 'challenge').targets[0].health);
  assert.deepEqual(parse(draft), draft);
});

test('invalid imports cannot invent health, layouts, durations, or phase rotations', () => {
  for (const edit of [
    (draft) => {
      draft.version = 1;
    },
    (draft) => {
      draft.health = 22000000;
    },
    (draft) => {
      draft.profession = 'thief';
    },
    (draft) => {
      draft.phases[0].groupDps = -1;
    },
    (draft) => {
      draft.phases[0].groupDps = Infinity;
    },
    (draft) => {
      draft.phases[1].durationSeconds = -1;
    },
    (draft) => {
      draft.phases[1].durationSeconds = Infinity;
    },
    (draft) => {
      draft.phases[0].commands = [];
    },
    (draft) => {
      draft.phases.pop();
    },
    (draft) => {
      draft.phases[0].id = 'custom';
    },
    (draft) => {
      draft.build.rotation = [{ type: 'wait', durationMs: -1 }];
    },
    (draft) => {
      draft.difficulty = 'challenge';
    }
  ]) {
    const draft = makeDraft();
    edit(draft);
    assert.throws(() => parse(draft));
  }
});

test('every selectable boss and recorded difficulty has an automatic authoring plan', () => {
  for (const encounter of ENCOUNTER_TEMPLATES) {
    for (const mode of ['normal', 'challenge', 'legendary']) {
      if (mode !== 'normal' && !encounterHealth(encounter.id, mode)) continue;

      const draft = makeDraft();
      selectScenarioEncounter(draft, encounter.id, mode);
      const plan = encounterPhasePlan(encounter.id, mode);
      assert.ok(plan.source.startsWith('https://'));
      assert.ok(plan.phases.some((phase) => phase.kind === 'boss'));
      assert.equal(new Set(plan.phases.map((phase) => phase.id)).size, plan.phases.length);
      assert.deepEqual(parse(draft), draft);
    }
  }
});

// Coverage checks concern provenance and encounter identity, never a hard-coded copy of the numerical health table.
test('every raid-wing boss has exact EI evidence and each published observation has a manifest source', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../../../../data/gw2/encounters/health-sources.json', import.meta.url), 'utf8')
  );
  const ids = ENCOUNTER_TEMPLATES.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const entry of ENCOUNTER_TEMPLATES.filter((entry) => entry.id.startsWith('02') && entry.kind !== 'event')) {
    assert.ok(
      encounterHealth(entry.id, 'normal')?.targets.some((target) => target.health > 0),
      entry.name
    );
  }

  for (const evidence of ENCOUNTER_HEALTH) {
    assert.ok(ids.includes(evidence.encounterId));
    const source = manifest.encounters.find(
      (entry) => entry.encounterId === evidence.encounterId && entry.difficulty === evidence.difficulty
    );
    assert.ok(source, 'Each runtime encounter must have an offline source.');
    assert.deepEqual(Object.keys(evidence).sort(), ['difficulty', 'encounterId', 'targets']);
    assert.deepEqual(
      evidence.targets.map((target) => target.index),
      source.reports[0].primaryTargetIndexes
    );
    for (const target of evidence.targets)
      assert.ok(Number.isInteger(target.health) && (target.health > 0 || target.health === -1));
  }

  assert.equal(encounterHealth('020102', 'challenge'), undefined, 'NM values must not fill an unavailable CM');
  assert.ok(encounterHealth('020304', 'normal').targets[0].healthBars.length > 1);
});

test('EI importer rejects wrong modes and preserves conflicting observations without averaging', () => {
  const source = {
    encounterId: '020101',
    difficulty: 'normal',
    triggerId: 12,
    report: 'report-a',
    endpoint: 'endpoint-a',
    format: 'ei-html',
    primaryTargetIndexes: [0]
  };
  const raw = {
    logID: 0x020101,
    triggerID: 12,
    parser: 'Elite Insights test',
    gw2Build: 100,
    phases: [{ success: true, mode: 'Normal Mode', targets: [0], targetPriorities: [0] }],
    targets: [{ name: 'Target', health: 12345, hpBars: null }]
  };
  const first = extractEncounterHealth(raw, source);
  assert.equal(first.targets[0].health, 12345);
  assert.throws(() => extractEncounterHealth(raw, { ...source, difficulty: 'challenge' }), /difficulty/);
  assert.throws(
    () => extractEncounterHealth({ ...raw, targets: [{ name: 'Target', health: null }] }, source),
    /health/
  );
  const second = structuredClone(first);
  second.report = 'report-b';
  second.targets[0].health = 20000;
  const combined = combineEncounterHealth([first, second]);
  assert.equal(combined.targets[0].health, 12345);
  assert.deepEqual(combined.corroboratingReports, []);
  assert.deepEqual(combined.differingReports, ['report-b']);
  assert.deepEqual(runtimeEncounterHealth(combined), {
    encounterId: source.encounterId,
    difficulty: source.difficulty,
    targets: first.targets
  });
});

// Executable inputs must use verified health gates, never invent totals for multi-target or mechanic-driven fights.
test('scenario execution compiles health gates and exposes unsupported encounter mechanics', () => {
  const draft = makeDraft();
  draft.phases[0].groupDps = 200000;
  draft.phases[1].durationSeconds = 12;
  const compiled = scenarioSimulation(draft);
  assert.equal(compiled.reason, '');
  assert.equal(compiled.config.health, draft.health);
  assert.equal(compiled.config.phases[0].endHealthPercent, 66);
  assert.equal(compiled.config.phases[0].groupDps, 200000);
  assert.equal(compiled.config.phases[1].durationSeconds, 12);
  for (const id of ['020304', '020602', '040601']) {
    selectScenarioEncounter(draft, id, 'normal');
    const unsupported = scenarioSimulation(draft);
    assert.equal(unsupported.config, null);
    assert.ok(unsupported.reason);
  }
});
