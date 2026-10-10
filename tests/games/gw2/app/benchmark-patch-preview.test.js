import assert from 'node:assert/strict';
import test from 'node:test';
import { patchBenchmarks, patchProfessionSummary, sortPatchBenchmarks } from '#gw2/app/page/benchmark-patch-preview.js';
import { TARGET_HEALTH_BANDS } from '#gw2/app/results/summary-metrics.js';
import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import { validatePatchPreview, applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { loadEditorPayload, editorState, setNumericEdit } from '#gw2/integrations/patches/app/editor-state.js';
import {
  validateAuthoringPreview,
  serializeActivePatchPreview
} from '../../../../scripts/patch-preview/patch-preview-authoring-api.mjs';

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
      patchId: activePatchPreview.id,
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

test('active reworks cover Vindicator and Firebrand but only the longbow Berserker build', () => {
  const rows = [
    build('revenant', 'Vindicator', 'Power'),
    build('revenant', 'Vindicator'),
    build('guardian', 'Firebrand', 'Power'),
    build('guardian', 'Firebrand'),
    longbowBerserker(),
    build('warrior', 'Berserker', 'Power'),
    build('warrior', 'Berserker', 'Condition without longbow'),
    build('guardian', 'Willbender')
  ];
  const results = patchBenchmarks(rows, activePatchPreview);
  assert.deepEqual(
    results.map(({ outcome }) => outcome),
    ['tbd', 'tbd', 'tbd', 'tbd', 'tbd', 'up', 'up', 'up']
  );
  for (const row of results.filter(({ outcome }) => outcome === 'tbd')) {
    assert.equal('previewDps' in row, false);
    assert.match(row.reason, /rework pending/);
  }

  assert.equal(patchBenchmarks(rows, null).length, 0);
  assert.ok(patchBenchmarks(rows, { id: activePatchPreview.id }).every(({ outcome }) => outcome === 'up'));
});

test('pending builds remain visible without captured results and never count as unchanged or extreme changes', () => {
  const pending = longbowBerserker();
  delete pending.patchPreview;
  const rows = patchBenchmarks(
    [
      pending,
      build('warrior', 'Berserker', 'Power', 1200),
      build('warrior', 'Berserker', 'Power loss', 900),
      build('warrior', 'Berserker', 'Power same', 1000)
    ],
    activePatchPreview
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
  assert.equal(patchBenchmarks([{ ...pending, rotation: undefined }], activePatchPreview).length, 0);
});

// Pending trait and weapon changes should not hide unaffected specializations, damage types, or weapons.
test('rework warnings cover affected Mesmer presets, rifle Amalgam, and Soulbeast without widening their scope', () => {
  const rifle = {
    ...build('engineer', 'Amalgam', 'Power (Rifle)'),
    build: 'data/gw2/builds/engineer/b-power-amalgam-rifle-double-helix.json'
  };
  const rows = [
    build('mesmer', 'Chronomancer'),
    build('mesmer', 'Chronomancer', 'Power'),
    build('mesmer', 'Virtuoso', 'Power'),
    build('mesmer', 'Virtuoso'),
    build('mesmer', 'Mirage'),
    rifle,
    { ...rifle, build: 'data/gw2/builds/engineer/b-power-amalgam-hammer-double-helix.json' },
    build('ranger', 'Soulbeast', 'Power'),
    build('ranger', 'Soulbeast'),
    build('ranger', 'Druid')
  ];
  const results = patchBenchmarks(rows, activePatchPreview);
  assert.deepEqual(
    results.map(({ outcome }) => outcome),
    ['tbd', 'tbd', 'tbd', 'up', 'up', 'tbd', 'up', 'tbd', 'tbd', 'up']
  );
  // Preserve the separate condition-Chrono warning while identifying the power builds' role-swap rework.
  assert.match(results[0].reason, /Chronophantasma/);
  for (const row of results.filter(({ build }) => build.profession === 'mesmer' && build.label === 'Power')) {
    assert.match(row.reason, /Disenchanter\/Warden rework/);
    assert.equal('previewDps' in row, false);
  }
});

test('authoring validates and preserves patch-scoped pending selectors when saving', () => {
  const preview = { id: 'fixture', label: 'Fixture', pendingBenchmarks: activePatchPreview.pendingBenchmarks };
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

// An uncertain percentage must remain qualified through authoring saves and disappear when its edit is reset.
test('Grenadier retains its provisional 10% assumption through generated notes and authoring', () => {
  const id = 514;
  const edit = activePatchPreview.professions.engineer.balanceProfiles[id];
  const catalog = createCanonicalCatalog({
    balanceProfiles: [{ id, name: 'Grenadier', profileKind: 'trait', damageMultiplier: 1, effects: [] }]
  });
  const preview = { id: 'fixture', label: 'Fixture', professions: { engineer: { balanceProfiles: { [id]: edit } } } };
  const profession = {
    patchAuthoring: { professionId: 'engineer', professionName: 'Engineer', modules: [] },
    validatePatch: (patch) => applyBalanceProfilePatch(catalog, patch)
  };
  const saved = validateAuthoringPreview(preview, { validatePatchPreview, professions: [profession] });
  assert.equal(
    applyBalanceProfilePatch(catalog, saved.professions.engineer).balanceProfilesById.get(id).damageMultiplier,
    1.1
  );
  assert.match(saved.professions.engineer.overview[0].text, /TBD:.*10% assumed/);
  assert.equal(saved.professions.engineer.balanceProfiles[id].assumption, edit.assumption);
  for (const assumption of ['', 10])
    assert.throws(
      () => applyBalanceProfilePatch(catalog, { balanceProfiles: { [id]: { ...edit, assumption } } }),
      /assumption/
    );
  loadEditorPayload({ preview: saved, professions: [profession.patchAuthoring], sourceFile: 'fixture.ts' });
  setNumericEdit({ entity: 'balance-profile', id, field: 'damageMultiplier', current: 1, next: 1 });
  assert.equal(editorState.draft.professions?.engineer?.balanceProfiles?.[id], undefined);
});
