import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { loadScenarioLibrary, saveScenarioLibrary } from '#gw2/app/boss-scenarios/storage.js';
import { createEncounter } from '#gw2/platform/combat/state/encounter.js';
import { scenarioSimulation, withScenarioConfig } from '#gw2/app/boss-scenarios/simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ENCOUNTER_TEMPLATES, encounterHealth } from '#gw2/app/boss-scenarios/catalog.js';
import { encounterPhasePlan, encounterExecutionPhases } from '#gw2/app/boss-scenarios/phases.js';
import { encounterAnalysisPhases } from '#gw2/app/boss-scenarios/analysis-model.js';
import { encounterTimelineMarkers } from '#gw2/app/rotation/timeline/encounter.js';
import { ENCOUNTER_HEALTH } from '#gw2/app/boss-scenarios/health-data.js';
import {
  createBossScenario,
  selectScenarioEncounter,
  selectScenarioTarget,
  parseBossScenario
} from '#gw2/app/boss-scenarios/model.js';
import { createDefaultBuild } from '#gw2/app/build/state/persistence.js';
import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { defineTestProfession } from '#tests/helpers/profession.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

const adapter = await loadProfessionAppAdapter('engineer');
const makeDraft = () =>
  createBossScenario(
    '020102',
    { ...createDefaultBuild(adapter), rotation: [{ type: 'wait', durationMs: 1000 }] },
    'My build',
    'current'
  );
const parse = (value) => parseBossScenario(value, 'engineer', adapter.toApplicationBuild);

// Boss data owns target size and defiance independently of the copied build's hidden Golem assumptions.
test('scenario configs use per-target hitbox metadata and remove the Golem hitbox choice', () => {
  for (const encounter of ENCOUNTER_HEALTH) {
    assert.ok(encounter.targets.every((target) => Number.isSafeInteger(target.hitboxWidth) && target.hitboxWidth > 0));
  }

  const draft = makeDraft();
  selectScenarioEncounter(draft, '040202', 'normal');
  const config = withScenarioConfig(
    { professionAssumptions: { hitboxSize: 'large', inDamagingField: true }, target: { defiant: false } },
    draft
  );
  assert.equal(config.professionAssumptions.hitboxSize, undefined);
  assert.equal(config.professionAssumptions.inDamagingField, true);
  assert.equal(config.target.defiant, true);
  const widths = config.encounter.phases
    .filter((phase) => phase.kind === 'boss')
    .map((phase) => phase.targets.find((target) => target.id === phase.playerTargetId).hitboxWidth);
  assert.ok(widths.includes(48));
  assert.ok(widths.includes(720));
});

test('scenario documents require valid independent simulation settings', () => {
  for (const settings of [undefined, {}, { transitionDelays: { weaponSwapMs: -1 } }]) {
    const draft = makeDraft();
    draft.simulationSettings = settings;
    assert.throws(() => parse(draft), /Invalid scenario/);
  }

  const draft = makeDraft();
  draft.simulationSettings.transitionDelays.weaponSwapMs = 250;
  assert.deepEqual(parse(draft).simulationSettings, draft.simulationSettings);
});

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

// Catalog coverage keeps boss selection valid without duplicating the numerical health table.
test('every selectable raid-wing boss has health data and each catalog entry belongs to a supported encounter', () => {
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
    assert.deepEqual(Object.keys(evidence).sort(), ['difficulty', 'encounterId', 'targets']);
    for (const target of evidence.targets)
      assert.ok(Number.isInteger(target.health) && (target.health > 0 || target.health === -1));
  }

  assert.equal(encounterHealth('020102', 'challenge'), undefined, 'NM values must not fill an unavailable CM');
  assert.ok(encounterHealth('020304', 'normal').targets[0].healthBars.length > 1);
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

// Fixed openings prepare both health pools; one shared selection determines the final two phases without parallel DPS.
test('Twin Largos opens on Nikare then Kenut and keeps the selected boss for phases 3 and 4 after reload', () => {
  const draft = makeDraft();
  selectScenarioEncounter(draft, '020602', 'normal');
  assert.equal(draft.targetIndex, 0);
  for (const phase of draft.phases) {
    if (phase.kind === 'boss') phase.groupDps = 120000;
    else phase.durationSeconds = 5;
  }

  const inputs = structuredClone(draft.phases);
  for (const targetIndex of [1, 0]) {
    selectScenarioTarget(draft, targetIndex);
    assert.deepEqual(draft.phases, inputs);
    const restored = parse(JSON.parse(JSON.stringify(draft)));
    const compiled = scenarioSimulation(restored).config;
    const damagePhases = compiled.phases.filter((phase) => phase.kind === 'boss');
    assert.ok(damagePhases.every((phase) => phase.targets.length === 1));
    assert.deepEqual(
      damagePhases.map((phase) => phase.playerTargetId),
      ['0', '1', String(targetIndex), String(targetIndex)]
    );
    assert.ok(damagePhases.every((phase) => phase.targets[0].groupDps === 120000));
    assert.deepEqual(
      damagePhases.map((phase) => phase.targets[0].endHealthPercent),
      [50, 50, 25, 0]
    );
    const expected = encounterHealth('020602', 'normal').targets.find((target) => target.index === targetIndex);
    const nikare = encounterHealth('020602', 'normal').targets.find((target) => target.index === 0);
    assert.equal(restored.health, nikare.health);
    const queue = [];
    const controller = createEncounter(compiled, (at, token) => queue.push({ at, token }));
    controller.begin(0);
    const entries = [[controller.result(0).targetName, controller.remainingHealthFraction]];
    let previousPhase = controller.result(0).phaseId;
    let wakes = 0;
    while (controller.deathTime === null && queue.length && wakes++ < 1000) {
      queue.sort((left, right) => left.at - right.at);
      const event = queue.shift();
      controller.wake(event.at, event.token);
      const result = controller.result(event.at);

      if (result.phaseKind === 'boss' && result.phaseId !== previousPhase) {
        entries.push([result.targetName, controller.remainingHealthFraction]);
        previousPhase = result.phaseId;
      }
    }

    assert.deepEqual(entries, [
      ['Nikare', 1],
      ['Kenut', 1],
      [expected.name, 0.5],
      // Encounter gates use whole HP, so a quarter of an indivisible maximum rounds down.
      [expected.name, Math.floor(expected.health / 4) / expected.health]
    ]);
    assert.notEqual(controller.deathTime, null);
    assert.equal(controller.maximumHealth, expected.health);
  }

  for (const edit of [
    (draft) => delete draft.targetIndex,
    (draft) => {
      draft.targetIndex = 9;
    },
    (draft) => {
      draft.phases[0].groupDps = { 0: 120000, 1: 170000 };
    },
    (draft) => {
      draft.phases[0].playerTargetIndex = 1;
    }
  ]) {
    const invalid = structuredClone(draft);
    edit(invalid);
    assert.throws(() => parse(invalid));
  }

  selectScenarioTarget(draft, 1);
  selectScenarioEncounter(draft, '020602', 'challenge');
  assert.equal(draft.targetIndex, 1);
  assert.equal(
    draft.health,
    encounterHealth('020602', 'challenge').targets.find((target) => target.index === 0).health
  );
  selectScenarioEncounter(draft, '020304', 'normal');
  assert.equal(draft.targetIndex, undefined);
  assert.doesNotThrow(() => parse(draft));
});

// CM barriers interrupt HP damage for five seconds without changing the four authored platform targets or rates.
test('Twin Largos CM pauses at 80/60/40/20 percent and resumes the same bar after each five-second barrier', () => {
  for (const targetIndex of [0, 1]) {
    const draft = makeDraft();
    selectScenarioEncounter(draft, '020602', 'challenge');
    selectScenarioTarget(draft, targetIndex);
    for (const phase of draft.phases) if (phase.kind === 'split') phase.durationSeconds = 1;

    assert.equal(draft.phases.filter((phase) => phase.kind === 'boss').length, 4);
    const config = scenarioSimulation(parse(draft)).config;
    const gates = config.phases.filter((phase) => phase.kind === 'boss');
    assert.deepEqual(
      gates.map((phase) => phase.targets[0].endHealthPercent),
      [80, 60, 50, 80, 60, 50, 40, 25, 20, 0]
    );
    assert.deepEqual(
      gates.map((phase) => phase.playerTargetId),
      ['0', '0', '0', '1', '1', '1', ...Array(4).fill(String(targetIndex))]
    );
    const queue = [];
    const controller = createEncounter(config, (at, token) => queue.push({ at, token }));
    controller.begin(0);
    let at = 0;
    let transitions = 0;
    while (controller.deathTime === null && transitions++ < 30) {
      at += 0.1;
      controller.damage(1e9, 'player', at);

      if (controller.deathTime !== null) break;

      assert.equal(controller.damageable, false);
      const split = controller.result(at);
      const pause = config.phases.find((phase) => phase.id === split.phaseId);
      const health = controller.remainingHealth;
      assert.equal(controller.damage(1e9, 'player', at + pause.durationSeconds / 2), 0);
      assert.equal(controller.damage(1e9, 'group', at + pause.durationSeconds / 2), 0);
      assert.equal(controller.remainingHealth, health);
      const wake = queue.shift();
      assert.equal(wake.at, Math.round((at + pause.durationSeconds) * 1e6) / 1e6);
      controller.wake(wake.at, wake.token);
      at = wake.at;
      assert.equal(controller.damageable, true);

      if (pause.id.includes('-barrier-')) {
        assert.equal(pause.kind, 'intermission');
        assert.equal(pause.durationSeconds, 5);
        assert.equal(controller.remainingHealth, health);
      }
    }

    assert.notEqual(controller.deathTime, null);
    const result = { encounter: controller.result(at), dpsStartTime: 0, combatEndTime: at, steps: [] };
    const definitions = encounterExecutionPhases(encounterPhasePlan('020602', 'challenge').phases);
    const analysis = encounterAnalysisPhases(result, definitions);
    assert.deepEqual(
      analysis.filter((phase) => phase.kind === 'boss').map((phase) => phase.label),
      [
        'Phase 1 · 100–80%',
        'Phase 1 · 80–60%',
        'Phase 1 · 60–50%',
        'Phase 2 · 100–80%',
        'Phase 2 · 80–60%',
        'Phase 2 · 60–50%',
        'Phase 3 · 50–40%',
        'Phase 3 · 40–25%',
        'Phase 4 · 25–20%',
        'Phase 4 · 20–0%'
      ]
    );
    const barriers = encounterTimelineMarkers(result, 0, definitions).filter((marker) =>
      marker.label.includes('Barrier at')
    );
    assert.deepEqual(
      encounterTimelineMarkers(result, 0, definitions)
        .filter((marker) => marker.kind === 'boss')
        .map((marker) => marker.label),
      analysis.filter((phase) => phase.kind === 'boss').map((phase) => phase.label)
    );
    assert.equal(barriers.length, 6);
    assert.ok(barriers.every((marker) => marker.kind === 'intermission' && marker.end - marker.start === 5000));
    assert.ok(
      result.encounter.phases
        .filter((phase) => phase.kind !== 'boss')
        .every((phase) => phase.playerDamage === 0 && phase.groupDamage === 0)
    );
    selectScenarioEncounter(draft, '020602', 'normal');
    assert.equal(scenarioSimulation(draft).config.phases.filter((phase) => phase.kind === 'boss').length, 4);
    assert.ok(!scenarioSimulation(draft).config.phases.some((phase) => phase.id.includes('-barrier-')));
  }
});

// The compiled CM plan must pause real command admission, not merely suppress damage from a continuing rotation.
test('Twin Largos barrier intermissions hold rotation commands and resume after all six pauses', () => {
  const profession = defineTestProfession({
    id: 'largos-intermission',
    name: 'Largos intermission',
    catalog: createCanonicalCatalog({
      generated: [
        {
          id: 990301,
          name: 'Continue rotation',
          castTimeMs: 1000,
          effects: [{ type: 'strike', coefficient: 0.001, weaponStrength: 1000 }]
        }
      ]
    })
  });
  for (const targetIndex of [0, 1]) {
    const draft = makeDraft();
    selectScenarioEncounter(draft, '020602', 'challenge');
    selectScenarioTarget(draft, targetIndex);
    for (const phase of draft.phases) if (phase.kind === 'boss') phase.groupDps = 100000000;

    const result = simulateGw2({
      profession,
      config: { encounter: scenarioSimulation(draft).config },
      rotation: Array.from({ length: 100 }, () => ({ type: 'cast', skillId: 990301 }))
    });
    const barriers = result.encounter.phases.filter((phase) => phase.id.includes('-barrier-'));
    assert.equal(barriers.length, 6);
    assert.equal(result.encounter.defeated, true);
    for (const pause of barriers) {
      assert.equal(pause.kind, 'intermission');
      assert.equal(pause.end - pause.start, 5);
      assert.ok(result.steps.every((step) => step.start < pause.start * 1000 || step.start >= pause.end * 1000));
      assert.ok(result.steps.some((step) => !step.invalid && step.start >= pause.end * 1000));
      assert.equal(pause.playerDamage, 0);
      assert.equal(pause.groupDamage, 0);
    }
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
  assert.deepEqual(loadScenarioLibrary(storage, 'engineer', parse), { ...library, recovered: false });
  assert.equal(values.get(oldKey), oldRaw);
  assert.throws(() => parse(oldDraft), /version/);
  assert.equal(loadScenarioLibrary(storage, 'mesmer', parse), null);
});

// Corrupt libraries are backed up before replacement, and a bad active draft cannot strand otherwise valid work.
test('current scenario storage recovers malformed libraries and invalid selection without blocking saves', () => {
  const draft = makeDraft();
  for (const raw of ['{', JSON.stringify({ version: draft.version, scenarios: [draft], activeId: 'missing' })]) {
    const key = `gw2-boss-scenarios-engineer-v${draft.version}`;
    const values = new Map([[key, raw]]);
    const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const loaded = loadScenarioLibrary(storage, 'engineer', parse);
    assert.equal(loaded.recovered, true);
    assert.equal(loaded.activeId, raw === '{' ? '' : draft.id);
    assert.deepEqual(loaded.scenarios, raw === '{' ? [] : [draft]);
    assert.deepEqual(JSON.parse(values.get(key)), {
      version: draft.version,
      activeId: loaded.activeId,
      scenarios: loaded.scenarios
    });
    const backup = [...values.keys()].find((candidate) => candidate.startsWith(`${key}-recovery-`));
    assert.equal(values.get(backup), raw);
    // Reloading without an editor mutation must read the repaired library and leave the one backup untouched.
    const recoveredValues = [...values];
    for (let reload = 0; reload < 3; reload++) {
      assert.deepEqual(loadScenarioLibrary(storage, 'engineer', parse), { ...loaded, recovered: false });
      assert.deepEqual([...values], recoveredValues);
    }

    const newDraft = makeDraft();
    const library = { activeId: newDraft.id, scenarios: [...loaded.scenarios, newDraft] };
    saveScenarioLibrary(storage, 'engineer', library);
    assert.deepEqual(loadScenarioLibrary(storage, 'engineer', parse), { ...library, recovered: false });
    assert.equal(values.get(backup), raw);
  }
});

test('one invalid saved scenario leaves valid drafts loadable and new work persistent', () => {
  const catalog = createCanonicalCatalog();
  const parseKnownSkills = (value) => parseBossScenario(value, 'engineer', adapter.toApplicationBuild, catalog);
  const valid = makeDraft();
  const invalid = makeDraft();
  invalid.build.rotation = [{ type: 'cast', skillId: 999999999 }];
  const key = `gw2-boss-scenarios-engineer-v${valid.version}`;
  const raw = JSON.stringify({ version: valid.version, scenarios: [invalid, valid], activeId: invalid.id });
  const values = new Map([[key, raw]]);
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const loaded = loadScenarioLibrary(storage, 'engineer', parseKnownSkills);
  assert.deepEqual(loaded, { activeId: valid.id, scenarios: [valid], recovered: true });
  const recoveredValues = [...values];
  assert.deepEqual(loadScenarioLibrary(storage, 'engineer', parseKnownSkills), { ...loaded, recovered: false });
  assert.deepEqual([...values], recoveredValues);
  const newDraft = makeDraft();
  saveScenarioLibrary(storage, 'engineer', { activeId: newDraft.id, scenarios: [...loaded.scenarios, newDraft] });
  assert.deepEqual(loadScenarioLibrary(storage, 'engineer', parseKnownSkills), {
    activeId: newDraft.id,
    scenarios: [valid, newDraft],
    recovered: false
  });
  assert.ok([...values].some(([name, value]) => name.startsWith(`${key}-recovery-`) && value === raw));
});

test('recovery does not permit overwriting unreadable data when its backup cannot be saved', () => {
  const storage = {
    getItem: () => '{',
    setItem: () => {
      throw new Error('Storage full');
    }
  };
  assert.throws(() => loadScenarioLibrary(storage, 'engineer', parse), /Storage full/);
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
  // Comparisons reuse a supplied baseline score and carry encounter settings in each omission config.
  const modifier = adapter.modifierContributionRequest(app, 0);
  assert.equal(modifier.baselineDps, 0);
  assert.ok(modifier.comparisons.length > 0);
  for (const config of [baseline, random, ...modifier.comparisons.map((entry) => entry.config)]) {
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
  assert.equal(adapter.modifierContributionRequest(app, 0).comparisons[0].config.target.armor, 5346);
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
