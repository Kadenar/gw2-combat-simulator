import assert from 'node:assert/strict';
import test from 'node:test';
import { benchmarkBuildPreview } from '#gw2/app/page/benchmark-build-preview.js';
import { benchmarkPreviewPath, validateBenchmarkPreview } from '#gw2/app/page/benchmark-preview-data.js';
import { createBenchmarkPreview } from '#gw2/app/page/benchmark-preview-generation.js';
import { revenantAppAdapter } from '#gw2/professions/revenant/app/app-definition.js';
import { createRevenantBuildDefaults } from '#gw2/professions/revenant/build/build.js';

const build = 'data/gw2/builds/revenant/test-preview.json';
const data = {
  build,
  equipment: [{ label: 'Weapons', value: 'Hammer' }],
  specializations: [],
  skills: []
};

// Preview URLs stay relative for hosted subdirectories and cannot escape the generated asset directory.
test('preview paths and validation reject mismatched or malformed assets', () => {
  assert.equal(benchmarkPreviewPath(build), 'data/gw2/benchmark-previews/revenant/test-preview.json');
  assert.throws(() => benchmarkPreviewPath('data/gw2/builds/revenant/../manifest.json'));
  assert.throws(() => benchmarkPreviewPath('https://example.com/build.json'));
  assert.equal(validateBenchmarkPreview(data, build), data);
  for (const invalid of [
    null,
    {},
    { ...data, build: 'another.json' },
    { ...data, skills: [null] },
    {
      ...data,
      specializations: [{ name: 'Core', majorTraits: [[{ name: 'Trait', selected: 'yes' }]] }]
    }
  ])
    assert.throws(() => validateBenchmarkPreview(invalid, build), /Invalid benchmark preview/);
});

// Legend-based loadouts and trait choices must retain the canonical codec's display representation.
test('generation preserves canonical legends and selected traits without persisting runtime state', () => {
  const candidate = createRevenantBuildDefaults();
  const before = structuredClone(candidate);
  const normalized = revenantAppAdapter.toApplicationBuild(candidate);
  const preview = createBenchmarkPreview(revenantAppAdapter, candidate, build);
  assert.deepEqual(candidate, before);
  assert.deepEqual(candidate.selectedSkillIds, {});
  assert.equal(
    preview.equipment.find(({ label }) => label === 'Legends').value,
    normalized.selectedLegends.join(' / ')
  );
  assert.deepEqual(
    preview.skills.map(({ name }) => name),
    Object.values(normalized.selectedSkillIds)
      .filter((id) => id !== null)
      .map((id) => revenantAppAdapter.profession.catalog.skillsById.get(id).name)
  );
  for (const [index, spec] of preview.specializations.entries()) {
    assert.deepEqual(
      spec.majorTraits.map((tier) => tier.findIndex(({ selected }) => selected) + 1),
      normalized.specializations[index].traits.split('-').map(Number)
    );
  }

  assert.equal(validateBenchmarkPreview(preview, build), preview);
  assert.equal('assumptions' in preview, false);
});

// Concurrent inspectors share one fetch, failed assets can retry, and every generated string is escaped.
test('preview loader shares requests, retries failures, and escapes display text', async (t) => {
  let calls = 0;
  const payload = {
    ...data,
    equipment: [{ label: '<label>', value: '<script>bad</script>' }],
    skills: [{ name: '<skill>', icon: '" onerror="bad' }]
  };
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url, benchmarkPreviewPath(build));
    calls += 1;
    return new Response(JSON.stringify(calls === 1 ? {} : payload));
  });
  const row = { profession: 'revenant', build };
  await assert.rejects(benchmarkBuildPreview(row), /Invalid benchmark preview/);
  const first = benchmarkBuildPreview(row);
  assert.equal(first, benchmarkBuildPreview(row));
  const markup = await first;
  assert.match(markup, /&lt;script&gt;bad&lt;\/script&gt;/);
  assert.match(markup, /&lt;label&gt;/);
  assert.match(markup, /&quot; onerror=&quot;bad/);
  assert.equal(calls, 2);
});
