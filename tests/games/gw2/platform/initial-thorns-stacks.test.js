import assert from 'node:assert/strict';
import test from 'node:test';

import { loadBuildContext } from '#gw2/build-context/load.js';
import { relicConditionDamageBonus } from '#gw2/platform/equipment/relics/query.js';
import { createRelicRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { professionRegistry } from '#gw2/profession-registry.js';

// Saved inputs become whole stacks within the relic cap before build validation and simulation.
test('starting Thorns stacks normalize saved input and validate canonical values', async () => {
  const module = await loadBuildContext('mesmer');
  const build = module.toApplicationBuild({});
  assert.equal(build.initialThornsStacks, 0);
  assert.equal(module.profession.validateBuild(build).valid, true);
  for (const [value, expected] of [
    [0, 0],
    [4, 4],
    [10, 10],
    [-1, 0],
    [12, 10],
    [4.9, 4],
    ['6', 6],
    ['invalid', 0]
  ]) {
    const normalized = module.toApplicationBuild({ ...build, initialThornsStacks: value });
    assert.equal(normalized.initialThornsStacks, expected);
    assert.deepEqual(module.profession.validateBuild(normalized).errors, []);
  }

  for (const value of [-1, 11, 0.5, '4', null, NaN, Infinity]) {
    assert.match(
      module.profession.validateBuild({ ...build, initialThornsStacks: value }).errors.join(),
      /initialThornsStacks/
    );
  }
});

// Every profession must carry the saved setting to runtime while unrelated relics remain unaffected.
test('starting Thorns stacks round-trip into every profession simulation config', async () => {
  for (const { id } of professionRegistry) {
    const module = await loadBuildContext(id);
    const configFor = (build) =>
      module
        .createBuildContext({
          build,
          patch: module.profession.resolvePatch(),
          transitionDelays: normalizeTransitionDelays()
        })
        .simulationConfig();
    const original = module.toApplicationBuild({});
    assert.equal(configFor(original).initialThornsStacks, 0, id);
    original.relic = 'Thorns';
    original.initialThornsStacks = 7;
    const build = module.toApplicationBuild(JSON.parse(JSON.stringify(original)));
    assert.equal(build.initialThornsStacks, 7, id);
    assert.equal(Object.hasOwn(build.assumptions, 'initialThornsStacks'), false, id);
    const config = configFor(build);
    assert.equal(config.initialThornsStacks, 7, id);
    assert.equal(relicConditionDamageBonus({ config, relic: createRelicRuntime(config.relic) }, 0), 210, id);
    build.initialThornsStacks = 0;
    assert.equal(config.initialThornsStacks, 7, id);
    assert.equal(configFor(build).initialThornsStacks, 0, id);
    build.initialThornsStacks = 10;
    build.relic = '';
    const unequipped = configFor(build);
    assert.equal(relicConditionDamageBonus({ config: unequipped, relic: createRelicRuntime('') }, 0), 0, id);
  }
});
