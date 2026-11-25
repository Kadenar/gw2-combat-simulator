import assert from 'node:assert/strict';
import test from 'node:test';

import { rotationStateSnapshot } from '#gw2/app/rotation/state-snapshot/model.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';

// Select a single major trait so unrelated defaults cannot make a missing display pass.
function selectTrait(catalog, name) {
  const line = catalog.specializations.find((line) => line.majorTraits.flat().some((trait) => trait.name === name));
  assert.ok(line, name);
  return {
    name: line.name,
    traits: line.majorTraits.map((tier) => tier.findIndex((trait) => trait.name === name) + 1).join('-')
  };
}

// Exercise the app wrapper: snapshots receive balanceContext, never a separate catalog field.
test('trait-dependent state rows use the snapshot balance catalog', () => {
  for (const [profession, specialization, trait, rowId] of [
    [engineerProfession, 'Core', 'Kinetic Battery', 'engineer-kinetic-charges'],
    [necromancerProfession, 'Harbinger', 'Cascading Corruption', 'cascading-corruption-stacks'],
    [thiefProfession, 'Antiquary', 'Prodigious Pincher', 'antiquary-prodigious-pincher']
  ]) {
    const patch = withPatchPreview(profession, null).resolvePatch();
    const selection = selectTrait(patch.catalog, trait);
    // Snapshot rows require an accepted observation; an empty rotation reads the baseline's rotation-end state.
    const results = {
      steps: [],
      resolvedEvents: [],
      rotationEndTime: 0,
      planningState: {
        combatActive: false,
        effects: [],
        availability: {},
        atSeconds: 0,
        cooldownsBySkillId: {},
        ammoBySkillId: {},
        activeWeaponSet: 1,
        profession: {}
      }
    };
    const app = {
      profession,
      patch,
      activeCatalog: patch.catalog,
      adapter: { eliteSpecialization: () => specialization },
      build: { rotation: [], specializations: [selection] },
      analysis: {
        state: {
          buildRevision: 0,
          resultRevision: 0,
          simulationStatus: 'idle',
          simulationError: '',
          patchComparison: null,
          results
        }
      }
    };
    assert.ok(
      rotationStateSnapshot(app).items.some((row) => row.id === rowId),
      trait
    );
    app.build.specializations = [];
    assert.ok(!rotationStateSnapshot(app).items.some((row) => row.id === rowId), `${trait} unselected`);

    // The same saved position must stop activating the trait when the selected patch moves it.
    app.build.specializations = [selection];
    const catalog = {
      ...patch.catalog,
      specializations: patch.catalog.specializations.map((line) =>
        line.name === selection.name
          ? { ...line, majorTraits: line.majorTraits.map((tier) => [...tier.slice(1), tier[0]]) }
          : line
      )
    };
    app.patch = { ...patch, catalog, balanceContext: { ...patch.balanceContext, catalog } };
    app.activeCatalog = catalog;
    assert.ok(!rotationStateSnapshot(app).items.some((row) => row.id === rowId), `${trait} moved`);
  }
});
