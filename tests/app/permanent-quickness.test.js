import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultBuild, replaceBuild } from '#gw2/app/build/state/persistence.js';
import { loadProfessionAppAdapter, professionRegistry } from '#gw2/app/profession/registry.js';
import { createGw2SimulationConfig } from '#gw2/app/simulation/config.js';

// All application entry paths must agree before attributes or simulations consume the build.
test('application builds enable permanent quickness across professions and legacy assumptions', async () => {
  for (const { id } of professionRegistry) {
    const adapter = await loadProfessionAppAdapter(id);
    assert.equal(createDefaultBuild(adapter).assumptions.quickness, true, id);
    for (const assumptions of [{}, { quickness: false }, { quickness: true }]) {
      const saved = { assumptions: { ...assumptions, fury: false, alacrity: false } };
      const build = replaceBuild(saved, adapter);
      assert.equal(build.assumptions.quickness, true, id);
      assert.equal(build.assumptions.fury, false, id);
      assert.equal(build.assumptions.alacrity, false, id);
      assert.deepEqual(saved.assumptions, { ...assumptions, fury: false, alacrity: false });
    }
  }
});

// Configuration also enforces the assumption when handed a build that has bypassed application loading.
test('application simulation config always supplies permanent quickness', async () => {
  const adapter = await loadProfessionAppAdapter('guardian');
  const build = createDefaultBuild(adapter);
  for (const assumptions of [{}, { quickness: false }, { quickness: true }]) {
    build.assumptions = { ...assumptions, fury: false, alacrity: false };
    const config = createGw2SimulationConfig({
      app: { build, adapter: { assumptionControls: [] }, skillById: new Map() },
      attributeData: { attributes: {} },
      specialization: 'Core'
    });
    assert.equal(config.boons.quickness, true);
    assert.equal(config.boons.fury, false);
    assert.equal(config.boons.alacrity, false);
  }
});
