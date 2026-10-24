import { encounterPhasePlan } from '#gw2/app/boss-scenarios/phases.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { encounterTimelineMarkers, encounterStepContext } from '#gw2/app/rotation/timeline/encounter.js';
import { timelineRowsView } from '#gw2/app/rotation/timeline/rows.js';
import { normalizeProfessionUi } from '#gw2/platform/profession-presentation/contract.js';

const definitions = encounterPhasePlan('020102', 'normal').phases;

// Synthetic action spans protect phase attribution and transition placement, independent of skill packet timing.
function fixture() {
  return {
    steps: [
      { ri: 0, start: 1000, end: 3000, skill: 'Wait' },
      { ri: 1, start: 3000, end: 6000, skill: 'Wait' },
      { ri: 2, start: 6000, end: 7000, skill: 'Wait' },
      { ri: 3, start: 7000, end: 9000, skill: 'Wait' }
    ],
    events: [{ type: 'combat_start', at: 2 }],
    encounter: {
      defeated: false,
      phases: [
        { id: 'boss-0', kind: 'boss', start: 2, end: 4 },
        { id: 'split-0', kind: 'split', start: 4, end: 7 },
        { id: 'boss-1', kind: 'boss', start: 7, end: null }
      ]
    }
  };
}

test('encounter boundaries use observed times and the next authored command without mutating results', () => {
  const result = fixture();
  const before = structuredClone(result);
  const markers = encounterTimelineMarkers(result, 4, definitions);
  assert.deepEqual(
    markers.map(({ label, start, insertionIndex }) => [label, start, insertionIndex]),
    [
      ['Phase 1', 2000, 1],
      ['Split 1: Charged Souls', 4000, 2],
      ['Phase 2', 7000, 3]
    ]
  );
  assert.deepEqual(
    markers.map(({ duringAction }) => duringAction),
    [true, true, false]
  );
  assert.deepEqual(result, before);
  assert.deepEqual(encounterTimelineMarkers(null, 4, definitions), []);
  assert.deepEqual(encounterTimelineMarkers({ steps: result.steps }, 4, definitions), []);
});

test('action context distinguishes precombat, split starts, and transitions inside an action', () => {
  const result = fixture();
  const markers = encounterTimelineMarkers(result, 4, definitions);
  const contexts = result.steps.map((step) => encounterStepContext(step, markers));
  assert.equal(contexts[0].phase, undefined);
  assert.equal(contexts[0].crossings[0].label, 'Phase 1');
  assert.equal(contexts[1].phase.label, 'Phase 1');
  assert.equal(contexts[1].crossings[0].label, 'Split 1: Charged Souls');
  assert.equal(contexts[2].phase.kind, 'split');
  assert.deepEqual(contexts[2].crossings, []);
  assert.equal(contexts[3].phase.label, 'Phase 2');
  assert.equal(encounterStepContext({ ...result.steps[2], invalid: true }, markers).phase, undefined);
});

test('zero-duration splits remain ordered and defeat appears only after the observed final phase', () => {
  const result = fixture();
  result.encounter.phases[1].end = 4;
  result.encounter.phases[2].start = 4;
  result.encounter.phases[2].end = 8;
  result.encounter.defeated = true;
  const markers = encounterTimelineMarkers(result, 4, definitions);
  assert.deepEqual(
    markers.slice(1).map(({ label, start }) => [label, start]),
    [
      ['Split 1: Charged Souls', 4000],
      ['Phase 2', 4000],
      ['Boss defeated', 8000]
    ]
  );
  assert.equal(encounterStepContext({ start: 4000, end: 5000 }, markers).phase.label, 'Phase 2');
  assert.equal(markers.at(-1).insertionIndex, 4);
  assert.equal(encounterStepContext({ start: 8500, end: 9000 }, markers).phase.kind, 'defeated');
});

test('encounter phases render as separate full-width rows while keeping their commands editable', () => {
  const result = fixture();
  const build = {
    rotation: result.steps.map((step) => ({ type: 'wait', durationMs: step.end - step.start })),
    startingWeaponSet: 1,
    weapons: [],
    alternateWeapons: []
  };
  const app = {
    build,
    workspace: { scenario: { encounterId: '020102', difficulty: 'normal' } },
    activeCatalog: { skills: [], skillsById: new Map() },
    adapter: { eliteSpecialization: () => '' },
    profession: { ui: normalizeProfessionUi('fixture', {}) }
  };
  for (const readOnly of [false, true]) {
    const render = (results) =>
      timelineRowsView(app, build, results, readOnly, new Set(), false)
        .rows.map((row) => row.html)
        .join('');
    const rows = timelineRowsView(app, build, result, readOnly, new Set(), false).rows;
    const html = render(result);
    // A transition closes the preceding weapon row even when both sides use the same weapon set.
    for (const [label, commandIndex] of [
      ['Phase 1', 1],
      ['Split 1: Charged Souls', 2],
      ['Phase 2', 3]
    ]) {
      const headerIndex = rows.findIndex((row) => row.key === `encounter:${label}`);
      assert.ok(headerIndex >= 0);
      assert.match(rows[headerIndex].html, /^<div class="rot-encounter-marker"/);
      assert.doesNotMatch(rows[headerIndex].html, /data-idx=/);
      const commands = rows[headerIndex + 1].html;
      assert.match(commands, new RegExp(`aria-label="${label}: Weapon set 1`));
      assert.match(commands, new RegExp(`data-idx="${commandIndex}"`));
      assert.doesNotMatch(commands, new RegExp(`data-idx="${commandIndex - 1}"`));
    }

    assert.equal(new Set(rows.map((row) => row.key)).size, rows.length);
    assert.equal((html.match(/class="rot-encounter-marker"/g) ?? []).length, 3);
    assert.match(html, /Phase 1: Damageable[\s\S]*Starts at 0.000s/);
    assert.match(html, /data-idx="2"[^>]*data-encounter-kind="split"/);
    assert.match(html, /Split 1: Charged Souls starts during this action at 2.000s/);
    assert.equal((html.match(/class="rot-skill"/g) ?? []).length, build.rotation.length);
    assert.equal(html.includes('rot-edit-wait'), !readOnly);
    assert.doesNotMatch(render(null), /rot-encounter-marker|data-encounter-kind/);
    assert.doesNotMatch(render({ ...result, encounter: undefined }), /rot-encounter-marker|data-encounter-kind/);
  }
});
