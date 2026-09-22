import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultBuild } from '#gw2/app/build/state/persistence.js';
import { loadProfessionAppAdapter, professionRegistry } from '#gw2/app/profession-registry.js';
import { palettePlanningState, paletteProfessionState } from '#gw2/app/rotation/context.js';
import { paletteSkillView } from '#gw2/app/rotation/palette/model.js';

function planningState(overrides = {}) {
  return {
    atSeconds: 0,
    cooldowns: {},
    ammo: {},
    activeWeaponSet: 1,
    profession: {},
    ...overrides
  };
}

test('palette state uses and caches the selected insertion checkpoint', () => {
  const finalState = planningState({
    atSeconds: 9,
    activeWeaponSet: 2,
    profession: { resource: 5 }
  });
  const checkpoint = planningState({
    atSeconds: 1.2,
    cooldowns: {
      Test: { remaining: 3800, readyAt: 5000 }
    },
    profession: { resource: 2 }
  });
  let previewCount = 0;
  const app = {
    build: {
      rotation: [
        { type: 'cast', skillId: 'First' },
        { type: 'cast', skillId: 'Second' }
      ]
    },
    rotationInsertionIndex: 1,
    results: { planningState: finalState },
    adapter: {
      skillTooltip: () => ({ description: '', facts: [] }),
      rotationPlanningStateAt(_app, index) {
        previewCount += 1;
        assert.equal(index, 1);

        return checkpoint;
      }
    }
  };

  assert.equal(palettePlanningState(app), checkpoint);
  assert.deepEqual(paletteProfessionState(app), { resource: 2 });
  assert.equal(
    paletteSkillView(app, {
      id: 1,
      name: 'Test',
      icon: 'test.png',
      cooldown: 5
    }).cooldownLabel,
    '3.80s'
  );
  assert.equal(previewCount, 1);

  app.rotationInsertionIndex = 2;
  assert.equal(palettePlanningState(app), finalState);
  app.rotationInsertionIndex = null;
  assert.equal(palettePlanningState(app), finalState);
  assert.equal(previewCount, 1);
});

test('every profession adapter exposes insertion-state previews', async () => {
  for (const entry of professionRegistry) {
    const adapter = await loadProfessionAppAdapter(entry.id);

    assert.equal(typeof adapter.rotationPlanningStateAt, 'function', entry.id);
  }
});

test('native insertion previews project weapon set and cooldown state', async () => {
  const adapter = await loadProfessionAppAdapter('mesmer');
  const build = createDefaultBuild(adapter);

  build.weapons = ['Greatsword', ''];
  build.alternateWeapons = ['Sword', 'Sword'];
  build.startingWeaponSet = 1;
  build.rotation = ['Phantasmal Berserker', 'Swap Weapons', 'Blurred Frenzy'].map((name) => ({
    type: 'cast',
    skillId: adapter.profession.catalog.skillsByName.get(name).id
  }));
  const app = {
    adapter,
    build,
    skillByName: adapter.profession.catalog.skillsByName,
    attributeWeaponSet: 1,
    results: null
  };

  adapter.recalculate(app);
  const result = adapter.runSimulation(app);
  const initial = adapter.rotationPlanningStateAt(app, 0);
  const afterFirstSkill = adapter.rotationPlanningStateAt(app, 1);
  const afterFirstSwap = adapter.rotationPlanningStateAt(app, 2);

  assert.equal(initial.activeWeaponSet, 1);
  assert.ok(afterFirstSkill.cooldowns['Phantasmal Berserker'].remaining > 0);
  assert.equal(afterFirstSwap.activeWeaponSet, 2);
  assert.ok(afterFirstSwap.cooldowns['Phantasmal Berserker'].remaining > 0);
  assert.equal(adapter.rotationPlanningStateAt(app, 3), result.planningState);

  // Reusing a tailed result would make recovered cooldowns available too early when appending.
  app.results = adapter.simulateBuild(build.rotation, adapter.simulationConfig(app), {
    kind: 'tail',
    durationMs: 20000
  });
  assert.ok(app.results.planningState.atSeconds * 1000 > result.planningState.atSeconds * 1000);
  assert.deepEqual(adapter.rotationPlanningStateAt(app, 3), result.planningState);
  for (const insertionIndex of [null, build.rotation.length]) {
    app.rotationInsertionIndex = insertionIndex;
    assert.deepEqual(palettePlanningState(app), result.planningState);
  }

  // Target death clips reporting, but appending still uses the complete planned weapon/cooldown state.
  const config = adapter.simulationConfig(app);
  app.results = adapter.simulateBuild(build.rotation, {
    ...config,
    target: { ...config.target, health: 1 }
  });
  assert.ok(app.results.combatEndTime < app.results.rotationEndTime);
  assert.equal(app.results.planningState.atSeconds, app.results.rotationEndTime);
  assert.equal(palettePlanningState(app), app.results.planningState);
  assert.equal(palettePlanningState(app).activeWeaponSet, 2);
});
