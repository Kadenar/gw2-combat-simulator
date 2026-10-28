import assert from 'node:assert/strict';
import test from 'node:test';

import { createWorkspacePresentation } from '#gw2/app/presentation/workspace.js';
import { rotationStateSnapshot } from '#gw2/app/rotation/state-snapshot/model.js';
import { timelineRowsView } from '#gw2/app/rotation/timeline/rows.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
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
    const app = {
      profession,
      patch,
      activeCatalog: patch.catalog,
      adapter: { eliteSpecialization: () => specialization },
      build: { rotation: [], specializations: [selection] },
      results: null
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

// Rendering real timeline rows protects the catalog handoff as well as each profession's threshold hook.
test('Spite minors and Swift Termination add the 50% target-health timeline marker', () => {
  for (const profession of [necromancerProfession, revenantProfession]) {
    const catalog = profession.catalog;
    const build = {
      rotation: [],
      weapons: [],
      alternateWeapons: [],
      startingWeaponSet: 1,
      targetHealth: 1000,
      specializations: [
        profession === necromancerProfession
          ? { name: 'Spite', traits: '0-0-0' }
          : selectTrait(catalog, 'Swift Termination')
      ]
    };
    const app = { profession, activeCatalog: catalog, adapter: { eliteSpecialization: () => 'Core' } };
    const result = {
      steps: [],
      resolvedEvents: [{ type: 'damage', at: 1, damage: 600 }],
      rotationEndTime: 1,
      planningState: { atSeconds: 1 }
    };
    const html = () =>
      timelineRowsView(
        app,
        build,
        result,
        false,
        new Set(),
        false,
        createWorkspacePresentation(app).timeline(app, build, result)
      )
        .rows.map((row) => row.html)
        .join('');
    assert.match(html(), /50%/, profession.id);
    build.specializations = [];
    assert.doesNotMatch(html(), /50%/, `${profession.id} without threshold traits`);
  }
});
