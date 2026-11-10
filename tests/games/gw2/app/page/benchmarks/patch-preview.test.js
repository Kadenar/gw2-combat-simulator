import assert from 'node:assert/strict';
import test from 'node:test';

import {
  patchBenchmarks,
  patchProfessionSummary,
  sortPatchBenchmarks
} from '#gw2/app/page/benchmarks/patch-preview.js';
import { TARGET_HEALTH_BANDS } from '#gw2/app/results/summary-metrics.js';
import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import { validatePatchPreview } from '#gw2/integrations/patches/authoring/patches.js';
import { testPatchPreview } from '#tests/helpers/patch-preview.js';

import {
  serializeActivePatchPreview,
  validateAuthoringPreview
} from '../../../../../../scripts/patch-preview/patch-preview-authoring-api.mjs';

// Minimal measurements isolate pending eligibility and rankings from saved rotation results.
function build(profession, specialization, label = 'Condition', previewDps = 1100) {
  return {
    profession,
    professionName: profession,
    specialization,
    label,
    build: `${label}.json`,
    rotation: 'fixture.json',
    benchmarkDps: 1000,
    patchPreview: {
      patchId: testPatchPreview.id,
      benchmarkDps: previewDps,
      benchmarkDpsByHealth: Object.fromEntries(
        TARGET_HEALTH_BANDS.map(({ id }) => [id, { cumulative: 1000, phase: 1000 }])
      )
    }
  };
}

const longbowBerserker = () => ({
  ...build('warrior', 'Berserker'),
  build: 'data/gw2/builds/warrior/b-condi-berserker-longbow-sword-torch.json'
});

test('released professions no longer carry active preview blockers', () => {
  const rows = [
    build('revenant', 'Vindicator', 'Power'),
    build('revenant', 'Vindicator'),
    build('guardian', 'Firebrand', 'Power'),
    build('guardian', 'Firebrand'),
    longbowBerserker(),
    build('warrior', 'Berserker', 'Power'),
    build('warrior', 'Berserker', 'Condition without longbow'),
    build('guardian', 'Willbender'),
    build('engineer', 'Amalgam')
  ];
  assert.equal(activePatchPreview, null);
  assert.deepEqual(patchBenchmarks(rows, activePatchPreview), []);
  const results = patchBenchmarks(rows, testPatchPreview);
  assert.deepEqual(
    results.map(({ outcome }) => outcome),
    ['up', 'up', 'up', 'up', 'up', 'up', 'up', 'up', 'up']
  );
  assert.equal(patchBenchmarks(rows, null).length, 0);
  assert.ok(patchBenchmarks(rows, { id: testPatchPreview.id }).every(({ outcome }) => outcome === 'up'));
});

test('pending builds remain visible without captured results and never count as unchanged or extreme changes', () => {
  const pendingPreview = {
    id: testPatchPreview.id,
    pendingBenchmarks: [
      {
        profession: 'engineer',
        specialization: 'Amalgam',
        build: 'data/gw2/builds/engineer/b-power-amalgam-rifle-double-helix.json',
        reason: 'Fixture pending.'
      }
    ]
  };
  const pending = {
    ...build('engineer', 'Amalgam', 'Power (Rifle)'),
    build: 'data/gw2/builds/engineer/b-power-amalgam-rifle-double-helix.json'
  };
  delete pending.patchPreview;
  const rows = patchBenchmarks(
    [
      pending,
      build('engineer', 'Amalgam', 'Power', 1200),
      build('engineer', 'Amalgam', 'Power loss', 900),
      build('engineer', 'Amalgam', 'Power same', 1000)
    ],
    pendingPreview
  );
  const summary = patchProfessionSummary(rows);
  assert.deepEqual([summary.winners, summary.losers, summary.unchanged, summary.pending], [1, 1, 1, 1]);
  assert.equal(summary.largestGain.percent, 20);
  assert.equal(summary.largestLoss.percent, -10);
  for (const sort of ['gains', 'losses', 'change', 'dps'])
    assert.equal(sortPatchBenchmarks(rows, sort).at(-1).outcome, 'tbd');
  const onlyPending = patchProfessionSummary(rows.filter(({ outcome }) => outcome === 'tbd'));
  assert.equal(onlyPending.unchanged, 0);
  assert.equal(onlyPending.largestGain, undefined);
  assert.equal(onlyPending.largestLoss, undefined);
  assert.equal(patchBenchmarks([{ ...pending, rotation: undefined }], pendingPreview).length, 0);
});

test('authoring validates and preserves patch-scoped pending selectors when saving', () => {
  const preview = {
    id: 'fixture',
    label: 'Fixture',
    pendingBenchmarks: [
      { profession: 'mesmer', specialization: 'Chronomancer', damage: 'condi', reason: 'Fixture pending.' }
    ]
  };
  const saved = validateAuthoringPreview(preview, { professions: [], validatePatchPreview });
  assert.deepEqual(saved.pendingBenchmarks, preview.pendingBenchmarks);
  assert.match(serializeActivePatchPreview(saved), /"pendingBenchmarks"/);
  for (const pendingBenchmarks of [
    {},
    [null],
    [{ profession: 'warrior', specialization: 'Berserker', reason: '' }],
    [{ ...preview.pendingBenchmarks[0], damage: 'all' }],
    [{ ...preview.pendingBenchmarks[0], build: '' }],
    [{ ...preview.pendingBenchmarks[0], build: 123 }],
    [{ ...preview.pendingBenchmarks[0], obsolete: true }]
  ]) {
    assert.throws(() => validatePatchPreview({ ...preview, pendingBenchmarks }), /pending benchmark/);
  }
});
