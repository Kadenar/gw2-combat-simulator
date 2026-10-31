import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultBuild } from '#gw2/app/build/state/persistence.js';
import { palettePlanningResult, palettePlanningState, paletteProfessionState } from '#gw2/app/rotation/context.js';
import { paletteSkillView } from '#gw2/app/rotation/palette/model.js';
import { rotationStateSnapshot } from '#gw2/app/rotation/state-snapshot/model.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { professionRegistry } from '#gw2/profession-registry.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';

function planningState(overrides = {}) {
  return {
    atSeconds: 0,
    cooldowns: {},
    ammoBySkillId: {},
    activeWeaponSet: 1,
    profession: {},
    ...overrides
  };
}

test('palette state uses and caches the selected insertion checkpoint', () => {
  const finalState = planningState({
    atSeconds: 9,
    activeWeaponSet: 2,
    profession: { [STATE.RESOURCE]: 5 }
  });
  const checkpoint = planningState({
    atSeconds: 1.2,
    cooldowns: {
      1: { remaining: 3800, readyAt: 5000 }
    },
    profession: { [STATE.RESOURCE]: 2 }
  });
  let previewCount = 0;
  const app = {
    patch: { id: 'current' },
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
      rotationPreviewAt(_app, index) {
        previewCount += 1;
        assert.equal(index, 1);

        return { planningState: checkpoint, procSteps: [] };
      }
    }
  };

  assert.equal(palettePlanningState(app), checkpoint);
  assert.deepEqual(palettePlanningResult(app).procSteps, []);
  assert.deepEqual(paletteProfessionState(app), { [STATE.RESOURCE]: 2 });
  assert.equal(
    paletteSkillView(app, {
      id: 1,
      name: 'Test',
      icon: 'test.png',
      cooldown: 5
    }).cooldownLabel,
    '3.800s'
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

    assert.equal(typeof adapter.rotationPreviewAt, 'function', entry.id);
  }
});

// A same-time or overlapping future blast must not enter the cursor's accepted proc history.
test('Bloodstone appears only after the insertion prefix includes Detonate', async () => {
  const adapter = await loadProfessionAppAdapter('engineer');
  for (const concurrent of [false, true]) {
    const build = createDefaultBuild(adapter);
    build.relic = 'Bloodstone';
    build.targetHealth = 0;
    build.selectedSkillIds.Utility1 = 5812;
    build.selectedSkillIds.Utility2 = 6161;
    const cast = (name) => ({
      type: 'cast',
      skillId: adapter.profession.catalog.skills.find((skill) => skill.name === name).id
    });
    build.rotation = [
      cast('Bomb Kit'),
      cast('Fire Bomb'),
      { type: 'wait', durationMs: 1000 },
      cast('Throw Mine'),
      ...(concurrent ? [cast('Bomb')] : []),
      { ...cast('Detonate'), ...(concurrent ? { concurrentOffsetMs: 40 } : {}) },
      { type: 'wait', durationMs: 1000 }
    ];
    const app = {
      adapter,
      profession: adapter.profession,
      build,
      patch: adapter.profession.resolvePatch({ id: 'current' })
    };
    app.results = adapter.calculateBaselineSimulation(adapter.baselineSimulationRequest(app)).result;
    assert.deepEqual(app.results.warnings, []);
    const detonation = app.results.steps.find((step) => step.skill === 'Detonate');
    app.rotationInsertionIndex = detonation.ri;
    const before = rotationStateSnapshot(app);
    assert.ok(detonation.start <= before.timeMs, 'wall-clock filtering alone would admit this later input');
    assert.equal(
      before.items.some((item) => item.id === 'relic:Bloodstone Volatility'),
      false
    );
    app.rotationInsertionIndex = detonation.ri + 1;
    const after = rotationStateSnapshot(app);
    assert.equal(after.items.find((item) => item.id === 'relic:Bloodstone Volatility')?.value, '1/4 stacks');
  }
});

test('precombat insertion previews preserve Flow and the boundary inside an unfinished cast', async () => {
  const adapter = await loadProfessionAppAdapter('warrior');
  const build = createDefaultBuild(adapter);
  build.weapons = ['Axe', 'Axe'];
  build.initialResource = 0;
  build.specializations = [{ name: 'Bladesworn', traits: '1-2-2' }];
  build.assumptions.fury = false;
  build.selectedSkillIds.Utility2 = 62967;
  const cast = (name) => ({
    type: 'cast',
    skillId: adapter.profession.catalog.skills.find((candidate) => candidate.name === name).id
  });

  // Both a serial marker and one inside Chop must preserve prepull regeneration without counting prepull hits.
  for (const marker of [{ type: 'combat-start' }, { type: 'combat-start', concurrentOffsetMs: 200 }]) {
    build.rotation = [
      cast('Flow Stabilizer'),
      { type: 'wait', durationMs: 1000 },
      cast('Chop'),
      marker,
      { type: 'wait', durationMs: 1000 }
    ];
    const app = {
      patch: adapter.profession.resolvePatch({ id: 'current' }),
      adapter,
      build,
      activeCatalog: adapter.profession.catalog,
      attributeWeaponSet: 1,
      results: null
    };
    app.attributeData = adapter
      .createBuildContext({
        build: app.build,
        transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
        patch: adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
      })
      .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
    // Publish the baseline explicitly so insertion previews can reuse its planning state.
    const { result } = adapter.calculateBaselineSimulation(adapter.baselineSimulationRequest(app));
    app.results = result;
    assert.deepEqual(result.warnings, []);
    const beforeHit = adapter.rotationPreviewAt(app, 2).planningState;
    assert.equal(beforeHit.atSeconds, 1);
    assert.ok(Math.abs(beforeHit.profession[STATE.FLOW].value - 4) < 1e-9);
    const beforeMarker = adapter.rotationPreviewAt(app, 3).planningState;
    const afterMarker = adapter.rotationPreviewAt(app, 4).planningState;
    assert.equal(beforeMarker.atSeconds, afterMarker.atSeconds);
    assert.equal(beforeMarker.profession[STATE.FLOW].value, afterMarker.profession[STATE.FLOW].value);
    const expectedFlow = 4 * beforeMarker.atSeconds + 2 * (beforeMarker.atSeconds - result.combatStartTime);
    assert.ok(Math.abs(beforeMarker.profession[STATE.FLOW].value - expectedFlow) < 1e-9);
  }
});

test('Ranger prefix simulations keep precast traps armed until the inherited boundary', async () => {
  const adapter = await loadProfessionAppAdapter('ranger');
  const build = createDefaultBuild(adapter);
  build.selectedSkillIds.Utility1 = 12492;
  build.rotation = [
    { type: 'cast', skillId: adapter.profession.catalog.skillsById.get(12492).id },
    { type: 'wait', durationMs: 1000 },
    { type: 'combat-start' },
    { type: 'wait', durationMs: 1000 }
  ];
  const app = {
    patch: adapter.profession.resolvePatch({ id: 'current' }),
    adapter,
    build,
    activeCatalog: adapter.profession.catalog,
    attributeWeaponSet: 1,
    results: null
  };
  app.attributeData = adapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
  // Publish the baseline explicitly so insertion previews can reuse its planning state.
  const { result } = adapter.calculateBaselineSimulation(adapter.baselineSimulationRequest(app));
  app.results = result;
  assert.deepEqual(result.warnings, []);
  // A future boundary must remain pending: publishing its timestamp early would trigger the trap immediately.
  const prefix = (length) =>
    simulateGw2({
      profession: adapter.profession,
      rotation: build.rotation.slice(0, length),
      config: adapter
        .createBuildContext({
          build: app.build,
          transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
          patch: adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
        })
        .simulationConfig(),
      combatStartTime: result.combatStartTime
    });
  const armed = prefix(1);
  assert.ok(armed.planningState.atSeconds < result.combatStartTime);
  assert.equal(
    armed.resolvedEvents.some((event) => event.type === 'condition' && event.condition === 'Chilled'),
    false
  );
  const triggered = prefix(2);
  assert.ok(triggered.resolvedEvents.some((event) => event.type === 'condition' && event.condition === 'Chilled'));
});

test('native insertion previews project weapon set and cooldown state', async () => {
  const adapter = await loadProfessionAppAdapter('mesmer');
  const build = createDefaultBuild(adapter);

  build.weapons = ['Greatsword', ''];
  build.alternateWeapons = ['Sword', 'Sword'];
  build.startingWeaponSet = 1;
  build.rotation = ['Phantasmal Berserker', 'Swap Weapons', 'Blurred Frenzy'].map((name) => ({
    type: 'cast',
    skillId: adapter.profession.catalog.skills.find((candidate) => candidate.name === name).id
  }));
  const app = {
    patch: adapter.profession.resolvePatch({ id: 'current' }),
    adapter,
    build,
    activeCatalog: adapter.profession.catalog,
    attributeWeaponSet: 1,
    results: null
  };

  app.attributeData = adapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
  // Publish the baseline explicitly so insertion previews can reuse its planning state.
  const { result } = adapter.calculateBaselineSimulation(adapter.baselineSimulationRequest(app));
  app.results = result;
  const initial = adapter.rotationPreviewAt(app, 0).planningState;
  const afterFirstSkill = adapter.rotationPreviewAt(app, 1).planningState;
  const afterFirstSwap = adapter.rotationPreviewAt(app, 2).planningState;

  assert.equal(initial.activeWeaponSet, 1);
  assert.ok(afterFirstSkill.cooldowns[10221].remaining > 0);
  assert.equal(afterFirstSwap.activeWeaponSet, 2);
  assert.ok(afterFirstSwap.cooldowns[10221].remaining > 0);
  assert.deepEqual(adapter.rotationPreviewAt(app, 3).planningState, result.planningState);

  // Reusing a tailed result would make recovered cooldowns available too early when appending.
  app.results = simulateGw2({
    profession: adapter.profession,
    rotation: build.rotation,
    config: adapter
      .createBuildContext({
        build: app.build,
        transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
        patch: adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
      })
      .simulationConfig(),
    observationPolicy: { kind: 'tail', durationMs: 20000 }
  });
  assert.ok(app.results.planningState.atSeconds * 1000 > result.planningState.atSeconds * 1000);
  assert.deepEqual(adapter.rotationPreviewAt(app, 3).planningState, result.planningState);
  for (const insertionIndex of [null, build.rotation.length]) {
    app.rotationInsertionIndex = insertionIndex;
    assert.deepEqual(palettePlanningState(app), result.planningState);
  }

  // Target death clips reporting, but appending still uses the complete planned weapon/cooldown state.
  const config = adapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: adapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
    })
    .simulationConfig();
  app.results = simulateGw2({
    profession: adapter.profession,
    rotation: build.rotation,
    config: {
      ...config,
      target: { ...config.target, health: 1 }
    }
  });
  assert.ok(app.results.combatEndTime < app.results.rotationEndTime);
  assert.equal(app.results.planningState.atSeconds, app.results.rotationEndTime);
  assert.equal(palettePlanningState(app), app.results.planningState);
  assert.equal(palettePlanningState(app).activeWeaponSet, 2);
});
