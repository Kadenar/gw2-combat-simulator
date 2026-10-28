import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeInputAnalysis } from '#gw2/app/input-profile/summary.js';
import { analyzeInputTrace } from '#gw2/input/analysis.js';
import { createInputProfile, validateInputProfile } from '#gw2/input/profile.js';
import { projectInputTrace } from '#gw2/platform/results/input-trace.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { controlOnSkillBar } from '#gw2/platform/skills/input-controls.js';
import { ENGINEER_SKILL_IDS as ENGINEER } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { RANGER_SKILL_IDS as RANGER } from '#gw2/professions/ranger/data/ids.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as REVENANT } from '#gw2/professions/revenant/data/ids.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { defineTestProfession } from '#tests/helpers/profession.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';

// Minimal synthetic inputs isolate input accounting, observation scope, and accounting from saved rotations.
function trace(entries, end = 60, start = 0) {
  return projectInputTrace(
    entries.map(([at, control], order) => ({
      activationId: `a:${order}`,
      rotationIndex: order,
      at,
      order,
      skillId: order,
      ...(control ? { control } : { control: null, unresolvedReason: 'Unknown live bar' })
    })),
    start,
    end
  );
}

const profile = () => createInputProfile();

// Synthetic traces make counts and timing independently checkable, without preset-specific expectations.
test('binding shares count all actions, group shared bindings, and keep modifiers separate from reach', () => {
  const p = profile();
  Object.assign(p.bindings, {
    'weapon-2': 'KeyQ',
    'weapon-3': 'KeyQ',
    'weapon-4': 'Shift+KeyB',
    'weapon-5': 'KeyP',
    dodge: 'ShiftLeft'
  });
  const input = trace(
    [
      [0, 'weapon-2'],
      [1, 'weapon-3'],
      [2, 'weapon-4'],
      [3, 'weapon-5'],
      [4, 'dodge'],
      [5, null]
    ],
    10
  );
  const analysis = analyzeInputTrace(input, p);
  const summary = summarizeInputAnalysis(input, analysis);
  assert.deepEqual(analysis.reachCounts, { near: 3, stretch: 1, far: 1, unknown: 1 });
  assert.equal(analysis.modifierActions, 2);
  assert.equal(summary.totalActions, 6);
  const key = summary.keys[0];
  assert.equal(key.binding, 'KeyQ');
  assert.equal(key.count, 2);
  assert.equal(key.share, 2 / 6);
  assert.deepEqual(key.controls, ['weapon-2', 'weapon-3']);
  assert.deepEqual(key.rotationIndices, [0, 1]);
  assert.equal(summary.keyUsage.get('ShiftLeft').count, 2);
});

test('activity samples and busy sections remain unchanged when bindings move or become unbound', () => {
  const input = trace(
    [
      [10, 'weapon-2'],
      [10.25, 'weapon-3'],
      [11, null],
      [16, 'weapon-2'],
      [20, 'weapon-3']
    ],
    20,
    10
  );
  const p = profile();
  const initial = summarizeInputAnalysis(input, analyzeInputTrace(input, p));
  Object.assign(p.bindings, { 'weapon-2': 'Ctrl+KeyP', 'weapon-3': '' });
  const editedAnalysis = analyzeInputTrace(input, p);
  const edited = summarizeInputAnalysis(input, editedAnalysis);
  assert.equal(edited.totalActions, 5);
  assert.deepEqual(edited.samples, initial.samples);
  assert.deepEqual(
    edited.sections.map(({ start, end, count, rate }) => ({ start, end, count, rate })),
    initial.sections.map(({ start, end, count, rate }) => ({ start, end, count, rate }))
  );
  assert.equal(editedAnalysis.reachCounts.unknown, 3);
  assert.equal(editedAnalysis.coverage.missing.length, 2);
  assert.ok(edited.sections.some((section) => section.rotationIndices.includes(2)));
});

test('transitions use adjacent inputs only, and unknown bindings break adjacency', () => {
  const p = profile();
  Object.assign(p.bindings, { 'weapon-2': 'KeyQ', 'weapon-3': 'KeyE', 'weapon-4': 'Shift+KeyQ', 'weapon-5': '' });
  const input = trace([
    [0, 'weapon-2'],
    [0.1, 'weapon-3'],
    [0.2, 'weapon-4'],
    [0.3, null],
    [0.4, 'weapon-2'],
    [0.5, 'weapon-5'],
    [0.6, 'weapon-4']
  ]);
  const result = summarizeInputAnalysis(input, analyzeInputTrace(input, p));
  const actions = analyzeInputTrace(input, p).actions;
  assert.deepEqual(
    actions.filter((action) => action.transition).map((action) => [action.transition.from.binding, action.binding]),
    [
      ['KeyQ', 'KeyE'],
      ['KeyE', 'Shift+KeyQ']
    ]
  );
  assert.deepEqual(result.transitions, []);
});

test('transition ordering uses median gap rather than one unusually fast occurrence', () => {
  const p = profile();
  Object.assign(p.bindings, { 'weapon-2': 'KeyQ', 'weapon-3': 'KeyE', 'weapon-4': 'KeyR' });
  const input = trace([
    [0, 'weapon-2'],
    [0.125, 'weapon-3'],
    [0.625, 'weapon-4'],
    [2, 'weapon-2'],
    [3, 'weapon-3'],
    [3.5, 'weapon-4'],
    [5, 'weapon-2'],
    [7, 'weapon-3'],
    [7.5, 'weapon-4']
  ]);
  const result = summarizeInputAnalysis(input, analyzeInputTrace(input, p));
  const pair = result.transitions.find((row) => row.fromBinding === 'KeyQ' && row.toBinding === 'KeyE');
  assert.equal(pair.count, 3);
  assert.equal(pair.closestGap, 0.125);
  assert.equal(pair.medianGap, 1);
  assert.equal(result.transitions[0].fromBinding, 'KeyE');
  assert.equal(result.transitions[0].medianGap, 0.5);
  assert.ok(result.transitions.every((row, index, rows) => !index || rows[index - 1].medianGap <= row.medianGap));
  const evenInput = trace([
    [0, 'weapon-2'],
    [0.25, 'weapon-3'],
    [2, 'weapon-2'],
    [2.75, 'weapon-3']
  ]);
  const even = summarizeInputAnalysis(evenInput, analyzeInputTrace(evenInput, p));
  assert.equal(even.transitions.find((row) => row.fromBinding === 'KeyQ').medianGap, 0.5);
});

test('distance is measured from key centres and is unknown for mouse transitions', () => {
  const p = profile();
  Object.assign(p.bindings, { 'weapon-2': 'KeyQ', 'weapon-3': 'KeyE', 'weapon-4': 'Mouse4' });
  const input = trace([
    [0, 'weapon-2'],
    [1, 'weapon-3'],
    [2, 'weapon-3'],
    [3, 'weapon-4']
  ]);
  const actions = analyzeInputTrace(input, p).actions;
  assert.equal(actions[1].transition.distance, 2);
  assert.equal(actions[2].transition.distance, 0);
  assert.equal(actions[2].transition.sameKey, true);
  assert.equal(actions[3].transition.distance, null);
});

test('busy sections use nonoverlapping five-second windows and preserve endpoint inputs', () => {
  const p = profile();
  const input = trace(
    [
      [0, 'weapon-2'],
      [1, 'weapon-2'],
      [5, 'weapon-2'],
      [6, 'weapon-2'],
      [10, 'weapon-2'],
      [11, 'weapon-2'],
      [12, 'weapon-2'],
      [20, 'weapon-2']
    ],
    20
  );
  const analysis = analyzeInputTrace(input, p);
  assert.equal(analysis.windows.length, 3);
  assert.deepEqual(analysis.windows[0], { start: 10, end: 15, count: 3, rate: 0.6 });
  const ordered = [...analysis.windows].sort((a, b) => a.start - b.start);
  assert.ok(ordered.every((window, index) => !index || ordered[index - 1].end <= window.start));
  const endpointInput = trace(
    [
      [5, 'weapon-2'],
      [10, 'weapon-2']
    ],
    10
  );
  const endpoint = analyzeInputTrace(endpointInput, p);
  assert.deepEqual(endpoint.windows[0], { start: 5, end: 10, count: 2, rate: 0.4 });
  const summary = summarizeInputAnalysis(endpointInput, endpoint);
  assert.equal(summary.sections[0].rotationIndices.length, 2);
  assert.equal(summary.samples.find((sample) => sample.at === 2.5).rate, 0);
  assert.equal(summary.samples.at(-1).rate, 2 / 5);
});

test('short, empty and zero-duration traces report activity without inventing busy sections', () => {
  const p = profile();
  for (const [input, totalActions] of [
    [trace([[0, 'weapon-2']], 4), 1],
    [trace([], 10), 0],
    [trace([], 0), 0]
  ]) {
    const analysis = analyzeInputTrace(input, p);
    const result = summarizeInputAnalysis(input, analysis);
    assert.equal(result.totalActions, totalActions);
    assert.deepEqual(result.sections, []);
    assert.equal(result.samples.length > 0, input.end > input.start);
  }
});

test('transition ranks exclude single occurrences and report same-instant pairs separately', () => {
  const p = profile();
  Object.assign(p.bindings, { 'weapon-2': 'KeyQ', 'weapon-3': 'KeyE', 'weapon-4': 'KeyR' });
  const input = trace([
    [0, 'weapon-2'],
    [0, 'weapon-3'],
    [1, 'weapon-2'],
    [1, 'weapon-3'],
    [2, 'weapon-2'],
    [2.25, 'weapon-3'],
    [3, 'weapon-2'],
    [3.5, 'weapon-3'],
    [4, 'weapon-4']
  ]);
  const summary = summarizeInputAnalysis(input, analyzeInputTrace(input, p));
  assert.equal(summary.sameInstantTransitions, 2);
  const pair = summary.transitions.find((row) => row.fromBinding === 'KeyQ');
  assert.equal(pair.count, 2);
  assert.equal(pair.medianGap, 0.375);
  assert.equal(pair.closestGap, 0.25);
  assert.deepEqual(pair.rotationIndices, [4, 5, 6, 7]);
  assert.ok(summary.transitions.every((row) => row.count >= 2 && row.medianGap > 0));
  assert.ok(!summary.transitions.some((row) => row.toBinding === 'KeyR'));
});

test('activity curve uses complete windows at both edges and one whole window for short rotations', () => {
  const p = profile();
  const input = trace(
    [
      [0, 'weapon-2'],
      [1, 'weapon-2'],
      [8, 'weapon-2'],
      [10, 'weapon-2']
    ],
    10
  );
  const summary = summarizeInputAnalysis(input, analyzeInputTrace(input, p));
  assert.equal(summary.samples[0].rate, 2 / 5);
  assert.equal(summary.samples.find((sample) => sample.at === 2.5).rate, 2 / 5);
  assert.equal(summary.samples.at(-1).rate, 2 / 5);
  const short = trace(
    [
      [0, 'weapon-2'],
      [3, 'weapon-2']
    ],
    3
  );
  const shortSummary = summarizeInputAnalysis(short, analyzeInputTrace(short, p));
  assert.ok(shortSummary.samples.every((sample) => sample.rate === 2 / 3));
});

test('profile schema rejects unsupported versions and physical keys', () => {
  const p = profile();
  assert.deepEqual(validateInputProfile(p), p);
  for (const value of [
    { ...p, version: 2 },
    { ...p, bindings: { ...p.bindings, 'weapon-2': 'Ctrl+UnrecognizedKey' } }
  ])
    assert.throws(() => validateInputProfile(value), /Reset|reset/);
});

const catalog = createCanonicalCatalog({
  generated: [
    { id: 990001, name: 'Manual', slot: 'Weapon_2', castTimeMs: 100 },
    { id: 990002, name: 'Auto', slot: 'Weapon_1', autoattack: true, castTimeMs: 100 },
    { id: 990003, name: 'Utility', type: 'Utility', castTimeMs: 0 },
    { id: 990004, name: 'Flip', flipParentId: 990003, castTimeMs: 0 },
    { id: 990005, name: 'Bar change', slot: 'Profession_1', castTimeMs: 0 }
  ]
});
const bars = [
  { id: 'first', slots: { 'slot-7': 990003 } },
  { id: 'second', slots: { 'slot-9': 990003 } }
];
const profession = defineTestProfession({
  id: 'input-fixture',
  name: 'Input fixture',
  catalog,
  hooks: {
    createState() {
      return { bar: 0 };
    },
    resolveInputControl(context, skill) {
      const control = controlOnSkillBar(catalog, skill, bars[context.profession.bar]);
      return control ? { control } : undefined;
    },
    onCastStart(runtime, cast) {
      if (cast.skill.id === 990005) runtime.profession.bar = 1;
    }
  }
});

test('accepted controls follow the live loadout before mutations and retain flip ancestry', () => {
  const result = simulateGw2({ profession, rotation: ['Utility', 'Bar change', 'Utility'] });
  assert.deepEqual(
    result.inputTrace.actions.map((a) => a.control),
    ['slot-7', 'profession-1', 'slot-9']
  );
  assert.equal(controlOnSkillBar(catalog, catalog.skillsById.get(990004), bars[1]), 'slot-9');
  assert.deepEqual(
    result.inputTrace.actions.map((a) => a.order),
    [0, 1, 2]
  );
  assert.equal(new Set(result.inputTrace.actions.map((a) => a.activationId)).size, 3);
});

test('input traces exclude precasts, autos, waits and invalid commands but retain interrupted inputs', () => {
  const result = simulateGw2({
    profession,
    rotation: [
      'Manual',
      '__combat_start',
      'Auto',
      { name: 'Manual', interruptMs: 0 },
      'Unknown',
      '__cooldown_reset',
      { type: 'wait', durationMs: 6000 }
    ],
    observationPolicy: { kind: 'tail', durationMs: 10000 }
  });
  assert.equal(result.inputTrace.start, result.combatStartTime);
  assert.equal(result.inputTrace.end, result.rotationEndTime);
  assert.deepEqual(
    result.inputTrace.actions.map((a) => a.skillId),
    [990001]
  );
  assert.equal(result.inputTrace.actions[0].rotationIndex, 3);
  const detached = projectInputTrace(
    [...result.inputTrace.actions, ...result.inputTrace.actions],
    result.inputTrace.start,
    result.inputTrace.end
  );
  assert.equal(detached.actions.length, 1);
  detached.actions[0].skillId = 990002;
  assert.equal(result.inputTrace.actions[0].skillId, 990001);
});

test('kit entry, kit weapon skills, toolbelt, swap-to-stow and dodge inputs retain distinct controls', () => {
  const result = simulateGw2({
    profession: engineerProfession,
    config: {
      specialization: 'Core',
      selectedSkillIds: [ENGINEER.GRENADE_KIT],
      skillInputBars: [{ id: 'selected', slots: { 'slot-8': ENGINEER.GRENADE_KIT } }]
    },
    rotation: [ENGINEER.GRENADE_KIT, ENGINEER.SHRAPNEL_GRENADE, 'Swap Weapons', ENGINEER.GRENADE_BARRAGE, 'Dodge']
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.inputTrace.actions.map((a) => a.control),
    ['slot-8', 'weapon-2', 'weapon-swap', 'profession-3', 'dodge']
  );
});

test('movement-only profession commands execute without adding a key input', () => {
  const result = simulateMesmer(['Crystal Sands', 'Pick Up Mirage Mirror'], {
    specialization: 'Mirage',
    selectedSkillIds: [41065],
    skillInputBars: [{ id: 'selected', slots: { 'slot-7': 41065 } }]
  });
  assert.deepEqual(result.warnings, []);
  assert.ok(result.steps.some((step) => step.skill === 'Pick Up Mirage Mirror'));
  assert.equal(result.rotationApm.actionCount, result.inputTrace.actions.length);
  assert.equal(result.rotationApm.actionCount, 1);
  assert.equal(result.rotationApm.apm, 60 / (result.inputTrace.end - result.inputTrace.start));
  assert.deepEqual(
    result.inputTrace.actions.map((action) => action.skillId),
    [41065]
  );
});

test('queued pet commands count once at input acceptance rather than at the later companion animation', () => {
  const result = runRanger(
    [
      '__combat_start',
      RANGER.FELINE_BITE,
      RANGER.FURIOUS_POUNCE,
      RANGER.FELINE_MAUL,
      { type: 'wait', durationMs: 10000 }
    ],
    { specialization: 'Untamed', selectedPet: 'Tiger', initialUntamedState: 'Ranger' }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.inputTrace.actions.map((a) => a.control),
    ['profession-1', 'profession-2', 'profession-3']
  );
  const second = result.inputTrace.actions[1];
  const executed = result.events.find(
    (e) => e.type === 'action' && e.actorType === 'summon' && e.activationId === second.activationId
  );
  assert.ok(executed.at > second.at);
  assert.equal(new Set(result.inputTrace.actions.map((a) => a.activationId)).size, 3);
  assert.ok(
    result.events.some(
      (e) => e.type === 'action' && !result.inputTrace.actions.some((a) => a.activationId === e.activationId)
    )
  );
});

test('legend-specific utility bars are selected at acceptance rather than from the final legend', () => {
  const result = runRevenant([REVENANT.PHASE_TRAVERSAL, 'Swap Legends', REVENANT.BANISH_ENCHANTMENT], {
    skillInputBars: [
      { id: LEGEND.ASSASSIN, slots: { 'slot-8': REVENANT.PHASE_TRAVERSAL } },
      { id: LEGEND.DEMON, slots: { 'slot-7': REVENANT.BANISH_ENCHANTMENT } }
    ]
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.inputTrace.actions.map((a) => a.control),
    ['slot-8', 'profession-1', 'slot-7']
  );
});
