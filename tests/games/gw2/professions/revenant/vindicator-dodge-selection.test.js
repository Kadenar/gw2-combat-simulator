import assert from 'node:assert/strict';
import test from 'node:test';
import { loadBuild } from '#gw2/app/build/state/persistence.js';
import { resolveEntrySkill } from '#gw2/app/rotation/editing/actions.js';
import { revenantAppAdapter as adapter } from '#gw2/professions/revenant/app/app-definition.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { selectedTraits } from '#gw2/professions/shared/trait-data.js';
import { runRevenant } from '#tests/helpers/revenant-simulation.js';

const profession = adapter.profession;
const command = { type: 'cast', skillId: 23275 };

// Restoring a saved Jump retains its ID while both rulesets resolve the current trait-selected dodge behavior.
test('stored Vindicator Jump resolves in display and execution without rewriting the saved rotation', (t) => {
  const saved = profession.createBuildDefaults();
  saved.specializations = [{ name: 'Vindicator', traits: '1-1-1' }];
  saved.selectedLegends = ['LegendaryAssassin', 'LegendaryAlliance'];
  saved.startingLegend = 'LegendaryAssassin';
  saved.rotation = [command];
  const serialized = JSON.stringify(saved);
  let storageWrites = 0;
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => (key === adapter.storageKey ? serialized : null),
      setItem: () => {
        storageWrites += 1;
      }
    }
  });
  t.after(() => {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
  });
  const build = loadBuild(adapter);
  assert.equal(storageWrites, 0, 'Loading this build must not rewrite its rotation.');
  assert.deepEqual(build.rotation, [command]);
  assert.deepEqual(profession.validateBuild(build), { valid: true, errors: [] });
  const app = { adapter, profession, build };

  for (const patchId of ['current', profession.preview.id]) {
    const patch = profession.resolvePatch({ id: patchId });
    Object.assign(app, { patch, activeCatalog: patch.catalog });
    for (const [choice, landing] of [
      [1, 'Death Drop'],
      [2, 'Imperial Impact'],
      [3, "Saint's Shield"],
      [1, 'Death Drop']
    ]) {
      build.specializations = [
        {
          name: 'Vindicator',
          traits: `0-0-${choice}`,
          patchTraits: { [profession.preview.id]: `0-${choice}-0` }
        }
      ];
      const skill = resolveEntrySkill(app, command);
      assert.equal(skill.id, SHARED_SKILL_IDS.DODGE);
      assert.ok(adapter.skillTooltip(skill, patch, build).description.includes(landing));
      const config = {
        specialization: 'Vindicator',
        patchId,
        selectedTraitIds: selectedTraits(patch.catalog, build.specializations).map(({ id }) => id)
      };
      const result = runRevenant(build.rotation, config, { profession });
      const shared = runRevenant([SHARED_SKILL_IDS.DODGE], config, { profession });
      assert.deepEqual(result.warnings, []);
      assert.equal(result.steps[0].skillId, SHARED_SKILL_IDS.DODGE);
      assert.ok(result.events.some((event) => event.skillName === landing));
      assert.deepEqual(result.planningState.profession.endurance, shared.planningState.profession.endurance);
      assert.deepEqual(build.rotation, [command]);
      assert.deepEqual(adapter.toApplicationBuild(JSON.parse(JSON.stringify(build))).rotation, [command]);
    }
  }
});

test('retained Dodge Jump belongs only to Vindicator and is not a second authored action', () => {
  for (const specialization of ['Core', 'Herald', 'Renegade', 'Conduit']) {
    const runtime = profession.runtimeFor({ specialization });
    assert.equal(runtime.catalog.skillsById.has(command.skillId), false);
    assert.equal(runtime.modifySkillId?.({}, command.skillId) ?? command.skillId, command.skillId);
  }

  const module = profession.patchAuthoring.modules.find(({ id }) => id === 'Vindicator');
  assert.ok(!module.skills.some(({ id }) => id === command.skillId));
});
