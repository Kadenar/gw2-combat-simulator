import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { loadScenarioLibrary, saveScenarioLibrary } from '#gw2/app/boss-scenarios/storage.js';
import { createEncounter } from '#gw2/platform/combat/state/encounter.js';
import { scenarioSimulation, withScenarioConfig } from '#gw2/app/boss-scenarios/simulation.js';
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
    'current'
  );
const parse = (value) => parseBossScenario(value, 'engineer', adapter.toApplicationBuild);

// Boss mechanics own the sequence; authors supply only squad damage, split time, and a continuous rotation.
test('automatic splits and one continuous rotation round-trip independently of Golem', () => {
  const build = { ...createDefaultBuild(adapter), rotation: [{ type: 'wait', durationMs: 1000 }] };
  const draft = createBossScenario('020102', build, 'My build', 'current');
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
      assert.ok(plan.phases.some((phase) => phase.kind === 'boss'));
      assert.equal(new Set(plan.phases.map((phase) => phase.id)).size, plan.phases.length);
      assert.deepEqual(parse(draft), draft);
    }
  }
});

// Coverage checks concern provenance and encounter identity, never a hard-coded copy of the numerical health table.
test('every selectable raid-wing boss has exact EI evidence and each published observation has a manifest source', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../../../../data/gw2/encounters/health-sources.json', import.meta.url), 'utf8')
  );
  const ids = ENCOUNTER_TEMPLATES.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const entry of ENCOUNTER_TEMPLATES.filter((entry) => entry.id.startsWith('02'))) {
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
    targets: [{ name: 'Target', tough: 687, health: 12345, hpBars: null }]
  };
  const first = extractEncounterHealth(raw, source);
  assert.equal(first.targets[0].health, 12345);
  assert.equal(first.targets[0].armor, 1910);
  assert.equal(
    extractEncounterHealth({ ...raw, targets: [{ ...raw.targets[0], tough: 0 }] }, source).targets[0].armor,
    1223
  );
  assert.throws(
    () => extractEncounterHealth({ ...raw, targets: [{ ...raw.targets[0], tough: undefined }] }, source),
    /toughness/
  );
  assert.throws(() => extractEncounterHealth(raw, { ...source, difficulty: 'challenge' }), /difficulty/);
  assert.throws(
    () => extractEncounterHealth({ ...raw, targets: [{ name: 'Target', tough: 687, health: null }] }, source),
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
test('scenario execution compiles health gates and phase inputs', () => {
  const draft = makeDraft();
  draft.phases[0].groupDps = 200000;
  draft.phases[1].durationSeconds = 12;
  const compiled = scenarioSimulation(draft);
  assert.equal(compiled.reason, '');
  assert.equal(compiled.config.phases[0].targets[0].maximumHealth, draft.health);
  assert.equal(compiled.config.phases[0].targets[0].endHealthPercent, 66);
  assert.equal(compiled.config.phases[0].targets[0].groupDps, 200000);
  assert.equal(compiled.config.phases[1].durationSeconds, 12);
});

// Excluded encounters cannot be reintroduced through imports or a health-data refresh.
test('excluded raid encounters are absent from authoring and health data', () => {
  for (const id of ['020104', '020202', '020301', '020303', '020502', '020503', '020504', '020505']) {
    assert.equal(
      ENCOUNTER_TEMPLATES.some((entry) => entry.id === id),
      false
    );
    assert.equal(encounterHealth(id, 'normal'), undefined);
    assert.throws(() => selectScenarioEncounter(makeDraft(), id, 'normal'), /supported boss/);
    assert.throws(() => encounterPhasePlan(id, 'normal'), /No encounter/);
  }
});

// Names follow boss and difficulty while stable IDs continue to own authored durations.
test('split names follow the selected boss and difficulty', () => {
  const splits = (id, mode) => encounterPhasePlan(id, mode).phases.filter((phase) => phase.kind === 'split');
  assert.deepEqual(
    splits('020103', 'normal').map((phase) => phase.label),
    ['Kernan', 'Knuckles', 'Karde']
  );
  assert.deepEqual(
    splits('020102', 'normal').map((phase) => phase.label),
    ['Charged Souls', 'Charged Souls']
  );
  assert.equal(splits('020801', 'normal')[0].label, 'Gree and Reeg');
  assert.equal(splits('020801', 'challenge')[0].label, 'Gree, Reeg and Ereg');
  assert.equal(splits('020801', 'challenge').at(-1).label, 'Proto-Greerlings');
});

// Every published mode must execute, including sequential targets, replacement bars, and timed cycles.
test('all selectable encounter modes execute to completion with their own target health', () => {
  for (const entry of ENCOUNTER_HEALTH) {
    const draft = makeDraft();
    selectScenarioEncounter(draft, entry.encounterId, entry.difficulty);
    for (const phase of draft.phases)
      if (phase.kind === 'boss')
        phase.groupDps =
          typeof phase.groupDps === 'number'
            ? 1e9
            : Object.fromEntries(Object.keys(phase.groupDps).map((key) => [key, 1e9]));
    const { config, reason } = scenarioSimulation(draft);
    assert.ok(config, `${entry.encounterId}: ${reason}`);
    const queue = [];
    const controller = createEncounter(config, (at, token) => queue.push({ at, token }));
    controller.begin(0);
    let count = 0;
    while (controller.deathTime === null && queue.length && count++ < 1000) {
      queue.sort((a, b) => a.at - b.at);
      const next = queue.shift();
      controller.wake(next.at, next.token);
    }

    assert.notEqual(controller.deathTime, null, `${entry.encounterId} ${entry.difficulty} did not finish`);
    assert.equal(controller.result(controller.deathTime).defeated, true);
  }
});

// Authoring keys refer to actual EI targets and survive a save/import round trip without distributing squad DPS.
test('Twin Largos authors separate rates and a player target only on parallel platforms', () => {
  const draft = makeDraft();
  selectScenarioEncounter(draft, '020602', 'normal');
  const phases = draft.phases.filter((phase) => phase.kind === 'boss');
  assert.equal(typeof phases[0].groupDps, 'number');
  assert.equal(typeof phases[1].groupDps, 'number');
  phases[2].groupDps = { 0: 120000, 1: 170000 };
  phases[2].playerTargetIndex = 1;
  const restored = parse(JSON.parse(JSON.stringify(draft)));
  const compiled = scenarioSimulation(restored).config.phases.filter((phase) => phase.kind === 'boss');
  assert.deepEqual(
    compiled.map((phase) => phase.targets.map((target) => target.id)),
    [['0'], ['1'], ['0', '1'], ['0', '1']]
  );
  assert.deepEqual(
    compiled[2].targets.map((target) => target.groupDps),
    [120000, 170000]
  );
  assert.equal(compiled[2].playerTargetId, '1');
  for (const rates of [100000, { 0: 100000 }, { 0: -1, 1: 100000 }, { 0: 1, 1: 1, 2: 1 }]) {
    const invalid = structuredClone(draft);
    invalid.phases.find((phase) => phase.id === phases[2].id).groupDps = rates;
    assert.throws(() => parse(invalid));
  }
});

// EI segmented bars determine both the physical health percentage and the remaining damage budget.
test('Xera uses the first and replacement EI bars around its floating-platform split', () => {
  const draft = makeDraft();
  selectScenarioEncounter(draft, '020304', 'normal');
  draft.phases[1].durationSeconds = 5;
  const { config } = scenarioSimulation(draft);
  const bars = encounterHealth('020304', 'normal').targets[0].healthBars;
  const queue = [];
  const controller = createEncounter(config, (at, token) => queue.push({ at, token }));
  controller.begin(0);
  assert.equal(controller.result(0).health, bars[0][2]);
  assert.equal(controller.damage(1e9, 'player', 1), bars[0][2] / 2);
  assert.equal(controller.result(1).phaseKind, 'split');
  assert.equal(controller.damage(1e9, 'player', 2), 0);
  controller.wake(queue[0].at, queue[0].token);
  assert.equal(controller.result(6).health, bars[1][2]);
  assert.equal(controller.remainingHealthFraction, 0.5);
  assert.equal(controller.damage(1e9, 'player', 7), bars[1][2] / 2);
  assert.equal(controller.deathTime, 7);
});

// CA's authored downtime breaks an arm; that mechanic changes boss HP but never inflates player DPS.
test('Conjured Amalgamate arm transitions and burn windows execute without inventing damage attribution', () => {
  const draft = makeDraft();
  selectScenarioEncounter(draft, '020601', 'normal');
  draft.phases[0].durationSeconds = 3;
  draft.phases[1].windowSeconds = 2;
  draft.phases[2].durationSeconds = 4;
  const { config } = scenarioSimulation(parse(draft));
  const queue = [];
  const controller = createEncounter(config, (at, token) => queue.push({ at, token }));
  controller.begin(0);
  const wake = () => {
    const event = queue.shift();
    controller.wake(event.at, event.token);
  };

  assert.equal(controller.result(0).phaseKind, 'split');
  wake();
  assert.equal(controller.remainingHealthFraction, 0.9);
  assert.equal(controller.result(3).phaseId, 'burn-0');
  wake();
  assert.equal(controller.result(5).phaseId, 'arms-1');
  wake();
  assert.equal(controller.remainingHealthFraction, 0.8);
  assert.equal(controller.result(9).overallDps, 0);
});

// Older documents must neither block current saving nor be read, converted, or overwritten.
test('obsolete stored scenarios do not block creating and reloading a current library', () => {
  const oldKey = 'gw2-boss-scenarios-engineer-v2';
  const oldDraft = { ...makeDraft(), version: 2 };
  const oldRaw = JSON.stringify({ version: 2, activeId: oldDraft.id, scenarios: [oldDraft] });
  const values = new Map([[oldKey, oldRaw]]);
  const storage = {
    getItem: (key) => {
      assert.notEqual(key, oldKey, 'The obsolete namespace must not be read');
      return values.get(key) ?? null;
    },
    setItem: (key, value) => values.set(key, value)
  };
  assert.equal(loadScenarioLibrary(storage, 'engineer', parse), null);
  const draft = makeDraft();
  const library = { activeId: draft.id, scenarios: [draft] };
  saveScenarioLibrary(storage, 'engineer', library);
  assert.deepEqual(loadScenarioLibrary(storage, 'engineer', parse), library);
  assert.equal(values.get(oldKey), oldRaw);
  assert.throws(() => parse(oldDraft), /version/);
  assert.equal(loadScenarioLibrary(storage, 'mesmer', parse), null);
});

// A real current-format load error remains visible rather than being silently discarded as old data.
test('current scenario storage rejects malformed libraries and invalid selection', () => {
  const draft = makeDraft();
  for (const raw of ['{', JSON.stringify({ version: draft.version, scenarios: [draft], activeId: 'missing' })]) {
    const storage = {
      getItem: () => raw,
      setItem: () => {
        throw new Error('Load must not write');
      }
    };
    assert.throws(() => loadScenarioLibrary(storage, 'engineer', parse));
  }
});

// Armor is derived at execution, so changing a boss cannot rewrite the saved build's Golem assumptions.
test('boss and difficulty selection supplies armor for every target without changing the build', () => {
  const draft = makeDraft();
  draft.build.targetArmor = 5346;
  const build = structuredClone(draft.build);
  for (const entry of ENCOUNTER_HEALTH) {
    selectScenarioEncounter(draft, entry.encounterId, entry.difficulty);
    const { config } = scenarioSimulation(draft);
    for (const phase of config.phases.filter((phase) => phase.kind === 'boss')) {
      for (const target of phase.targets) {
        assert.equal(target.armor, entry.targets.find((candidate) => String(candidate.index) === target.id).armor);
        assert.ok(Number.isSafeInteger(target.armor) && target.armor > 0);
      }
    }

    assert.deepEqual(draft.build, build);
  }

  assert.equal(encounterHealth('020101', 'normal').targets[0].armor, 1910);
  assert.equal(encounterHealth('020102', 'normal').targets[0].armor, 2597);
  assert.equal(encounterHealth('020601', 'normal').targets[0].armor, 1223);
});

// Analysis jobs must never silently replace a boss with the build's saved golem target.
test('baseline, RNG, and modifier requests share the encounter configuration', () => {
  const draft = makeDraft();
  draft.build.targetArmor = 5346;
  draft.build.assumptions.might = 25;
  draft.build.assumptions.alliedPlayerCount = 0;
  draft.build.assumptions.sharePlayerBoonsWithSummons = true;
  draft.phases[0].groupDps = 200000;
  draft.phases[1].durationSeconds = 12;
  const app = {
    build: draft.build,
    workspace: { scenario: draft },
    patch: adapter.profession.resolvePatch({ id: 'current' }),
    attributeData: { activeTraits: [] }
  };
  const baseline = adapter.baselineSimulationRequest(app).baseConfig;
  const random = adapter.randomDistributionRequest(app).baseConfig;
  const modifier = adapter.modifierContributionRequest(app);
  assert.ok(modifier.comparisons.length > 0);
  for (const config of [baseline, random, modifier.baseConfig, ...modifier.comparisons.map((entry) => entry.config)]) {
    assert.equal(config.allies.count, 4);
    assert.equal(config.sharePlayerBoonsWithSummons, false);
    assert.deepEqual(config.encounter, baseline.encounter);
    assert.equal(config.target.health, baseline.target.health);
    assert.equal(config.target.armor, baseline.target.armor);
  }

  assert.equal(draft.build.targetArmor, 5346);
  assert.equal(draft.build.assumptions.alliedPlayerCount, 0);
  assert.equal(draft.build.assumptions.sharePlayerBoonsWithSummons, true);
  app.workspace = undefined;
  assert.equal(adapter.baselineSimulationRequest(app).baseConfig.allies.count, 0);
  assert.equal(adapter.baselineSimulationRequest(app).baseConfig.sharePlayerBoonsWithSummons, true);
  assert.equal(adapter.baselineSimulationRequest(app).baseConfig.encounter, undefined);
  assert.equal(adapter.modifierContributionRequest(app).baseConfig.target.armor, 5346);
});

// Optional downtime is preserved by authoring without altering boss-owned split layouts or the rotation.
test('post-split intermissions round-trip and compile between the split and next damage phase', () => {
  const draft = makeDraft();
  const rotation = structuredClone(draft.build.rotation);
  const split = draft.phases.find((phase) => phase.kind === 'split');
  split.durationSeconds = 3;
  split.intermissionSeconds = 5;
  const restored = parse(JSON.parse(JSON.stringify(draft)));
  assert.deepEqual(restored, draft);
  const { config } = scenarioSimulation(restored);
  assert.deepEqual(
    config.phases.slice(0, 4).map((phase) => phase.kind),
    ['boss', 'split', 'intermission', 'boss']
  );
  assert.equal(config.phases[1].durationSeconds, 3);
  assert.equal(config.phases[2].durationSeconds, 5);
  assert.equal(new Set(config.phases.map((phase) => phase.id)).size, config.phases.length);
  assert.deepEqual(draft.build.rotation, rotation);
  split.intermissionSeconds = 0;
  assert.ok(scenarioSimulation(parse(draft)).config.phases.every((phase) => phase.kind !== 'intermission'));
  for (const value of [-1, Infinity, NaN, 86401, '5', null]) {
    split.intermissionSeconds = value;
    assert.throws(() => parse(draft), /intermissions/);
  }
});

// Encounter party assumptions block incidental summon sharing without suppressing explicit trait/skill pet grants.
test('boss boon audiences fill the subgroup and retain direct pet grants', () => {
  const golem = { allies: { count: 0, strikesPerSecond: 2 }, sharePlayerBoonsWithSummons: true };
  const config = withScenarioConfig(golem, makeDraft());
  assert.equal(withScenarioConfig(golem, undefined), golem);
  assert.equal(config.allies.strikesPerSecond, 2);
  const recipients = (audience) => gw2BoonApplicationRecipients(config, { actorType: 'player', audience });
  const party = recipients({ recipients: 'party', maximumRecipients: 5, eligibleCompanionIds: ['pet'] });
  assert.equal(party.recipientCount, 5);
  assert.equal(party.alliedPlayerCount, 4);
  assert.deepEqual(party.companionIds, []);
  const spareSlots = recipients({ recipients: 'party', maximumRecipients: 10, eligibleCompanionIds: ['pet'] });
  assert.deepEqual(spareSlots.companionIds, []);
  const direct = recipients({ recipients: 'summons', affectsSelf: false, eligibleCompanionIds: ['pet'] });
  assert.deepEqual(direct.companionIds, ['pet']);
  assert.equal(direct.includesSelf, false);
});
