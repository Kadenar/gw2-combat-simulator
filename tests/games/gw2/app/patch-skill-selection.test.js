import assert from 'node:assert/strict';
import test from 'node:test';

import { availableSlotSkills, swapSelectedSkillsForPatch } from '#gw2/app/build/state/skill-selection.js';
import { ProfessionApp } from '#gw2/app/profession-app.js';
import { resolveEntrySkill } from '#gw2/app/rotation/editing/actions.js';
import { MESMER_SKILL_IDS } from '#gw2/professions/mesmer/data/ids.js';
import { captureAnalysisFixture } from '#tests/helpers/analysis-requests.js';
import { patchSelectionFixture } from '#tests/helpers/patch-selection.js';
import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';

const utility = { type: 'Utility', slot: 'Utility', weapon: '' };
const focus = { type: 'Weapon', slot: 'Weapon_5', weapon: 'Focus' };
const catalog = (skills) => ({ skills, skillsById: new Map(skills.map((skill) => [skill.id, skill])) });
const live = catalog([
  { id: 1, ...utility },
  { id: 2, ...focus },
  { id: 3, ...utility }
]);
const preview = catalog([
  { id: 1, ...focus },
  { id: 2, ...utility },
  { id: 3, ...utility }
]);

// Direct Analysis and actual patch visits must simulate the same loadout despite reciprocal skill-role changes.
test('Mesmer comparison projects Warden and Disenchanter selections without mutating the displayed build', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { body: { dataset: { simulatorView: 'analysis' } } }
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  });
  const adapter = await loadProfessionAppAdapter('mesmer');
  const profession = adapter.profession;
  const build = adapter.toApplicationBuild(profession.createBuildDefaults());
  build.weapons = ['Sword', 'Focus'];
  build.selectedSkillIds.Utility1 = MESMER_SKILL_IDS.PHANTASMAL_DISENCHANTER;
  build.selectedSkillIds.Utility2 = null;
  build.selectedSkillIds.Utility3 = null;
  // Keep the observation window open for the summoned phantasm to deal damage.
  build.rotation = [
    { type: 'cast', skillId: MESMER_SKILL_IDS.PHANTASMAL_WARDEN },
    { type: 'wait', durationMs: 10000 }
  ];
  const app = {
    analysis: {
      needsPatchComparison: () => true,
      state: {
        results: null,
        buildRevision: 0,
        resultRevision: 0,
        simulationStatus: 'idle',
        simulationError: '',
        patchComparison: null
      }
    },
    adapter,
    profession,
    build,
    patch: profession.resolvePatch({ id: 'current' }),
    simulationSettings: {}
  };
  Object.defineProperty(app, 'activeCatalog', { get: () => app.patch.catalog });
  const original = structuredClone(build);
  const direct = adapter.calculateBaselineSimulation(
    captureAnalysisFixture(app, adapter).baseline({ collectChartData: false, comparePatch: true })
  );
  assert.deepEqual(build, original);
  assert.ok(direct.comparisonResult.result.dps > 0);
  assert.doesNotMatch(JSON.stringify(direct.comparisonResult.result.warnings), /not equipped/);

  const target = profession.resolvePatch({ id: profession.preview.id });
  swapSelectedSkillsForPatch(app, target.catalog);
  app.patch = target;
  assert.equal(build.selectedSkillIds.Utility1, MESMER_SKILL_IDS.PHANTASMAL_WARDEN);
  const visited = adapter.calculateBaselineSimulation(
    captureAnalysisFixture(app, adapter).baseline({ collectChartData: false, comparePatch: true })
  );
  assert.equal(visited.result.dps, direct.comparisonResult.result.dps);
  assert.equal(visited.comparisonResult.result.dps, direct.result.dps);
  assert.equal(build.selectedSkillIds.Utility1, MESMER_SKILL_IDS.PHANTASMAL_WARDEN);
});

// Reciprocal role changes retain the same utility position and leave other selections and empty slots intact.
test('patch role swaps preserve the selected utility slot in both directions', () => {
  for (const slot of ['Utility1', 'Utility2', 'Utility3']) {
    const selected = { Heal: null, Utility1: null, Utility2: null, Utility3: null, Elite: null, [slot]: 1 };
    const other = slot === 'Utility1' ? 'Utility2' : 'Utility1';
    selected[other] = 3;
    const app = {
      analysis: {
        needsPatchComparison: () => false,
        state: {
          results: null,
          buildRevision: 0,
          resultRevision: 0,
          simulationStatus: 'idle',
          simulationError: '',
          patchComparison: null
        }
      },
      activeCatalog: live,
      build: { selectedSkillIds: { ...selected } }
    };
    swapSelectedSkillsForPatch(app, preview);
    assert.deepEqual(app.build.selectedSkillIds, { ...selected, [slot]: 2 });
    app.activeCatalog = preview;
    swapSelectedSkillsForPatch(app, live);
    assert.deepEqual(app.build.selectedSkillIds, selected);
  }
});

// Missing, unrelated, or ambiguous placement edits do not establish a replacement relationship.
test('patch switching only remaps a unique reciprocal placement swap', () => {
  for (const [previous, next] of [
    [live, live],
    [
      live,
      catalog([
        { id: 1, ...focus },
        { id: 3, ...utility }
      ])
    ],
    [
      live,
      catalog([
        { id: 2, ...utility },
        { id: 3, ...utility }
      ])
    ],
    [catalog([...live.skills, { id: 4, ...focus }]), catalog([...preview.skills, { id: 4, ...utility }])]
  ]) {
    const app = {
      analysis: {
        needsPatchComparison: () => false,
        state: {
          results: null,
          buildRevision: 0,
          resultRevision: 0,
          simulationStatus: 'idle',
          simulationError: '',
          patchComparison: null
        }
      },
      activeCatalog: previous,
      build: { selectedSkillIds: { Utility2: 1 } }
    };
    swapSelectedSkillsForPatch(app, next);
    assert.equal(app.build.selectedSkillIds.Utility2, 1);
  }
});

// Remap selections against the outgoing catalog before refresh consumers read the incoming patch.
test('patch selection refreshes skill lists and ID lookups from the new catalog', () => {
  const catalogs = Object.fromEntries(
    [
      ['current', live],
      ['preview', preview]
    ].map(([id, source]) => {
      const skills = source.skills.map((skill) => ({ ...skill, name: `Skill ${skill.id}` }));
      return [
        id,
        {
          skills,
          skillsById: new Map(skills.map((skill) => [skill.id, skill]))
        }
      ];
    })
  );
  const refreshed = [];
  let cancelled = 0;
  const app = Object.assign(Object.create(ProfessionApp.prototype), {
    analysis: {
      suspend() {
        cancelled++;
      },
      needsPatchComparison: () => false,
      state: {
        results: null,
        buildRevision: 0,
        resultRevision: 0,
        simulationStatus: 'idle',
        simulationError: '',
        patchComparison: null
      }
    },
    patch: patchSelectionFixture(catalogs.current),

    profession: {
      catalog: catalogs.current,
      resolvePatch({ id }) {
        if (!Object.hasOwn(catalogs, id)) throw new TypeError(`Unknown patch ${id}.`);

        return patchSelectionFixture(catalogs[id], { id });
      },
      // No trait selects another skill identity in this fixture.
      runtimeFor: () => ({}),
      ui: {}
    },
    adapter: {
      eliteSpecialization: () => 'Core',
      isSkillAvailable: () => true,
      createBuildContext: () => ({ simulationConfig: () => ({ selectedTraitIds: [] }) })
    },
    build: { selectedSkillIds: { Utility1: 1 } },
    baselineSimulationRunner: {
      cancel() {
        cancelled++;
      }
    },
    changed(_static, _gear, options) {
      assert.equal(options.patchSwitch, true);
      const selected = this.activeCatalog.skillsById.get(this.build.selectedSkillIds.Utility1);
      assert.equal(resolveEntrySkill(this, { type: 'cast', skillId: selected.id }), selected);
      assert.deepEqual(
        availableSlotSkills(this, 'Utility'),
        this.activeCatalog.skills.filter((skill) => skill.type === 'Utility')
      );
      refreshed.push([this.patch.id, selected.id]);
    }
  });
  app.selectPatch('preview');
  app.selectPatch('preview');
  assert.equal(cancelled, 1, 'reselecting the active patch does not restart its simulation');
  // Rejected patch IDs must not mutate the active patch, selection, or displayed catalog.
  assert.throws(() => app.selectPatch('removed-preview'), /Unknown patch/);
  assert.equal(app.patch.id, 'preview');
  assert.equal(app.activeCatalog, catalogs.preview);
  assert.equal(app.build.selectedSkillIds.Utility1, 2);
  app.selectPatch('current');
  assert.equal(cancelled, 2);
  assert.deepEqual(refreshed, [
    ['preview', 2],
    ['current', 1]
  ]);
});
