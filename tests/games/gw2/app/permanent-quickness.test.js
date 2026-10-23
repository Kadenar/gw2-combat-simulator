import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultBuild, replaceBuild } from '#gw2/app/build/state/persistence.js';
import { professionRegistry } from '#gw2/profession-registry.js';
import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';
import { profession, createBuildContext } from '#gw2/professions/guardian/build/context.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';

// All application entry paths must agree before attributes or simulations consume the build.
test('application builds enable permanent quickness and alacrity across professions and legacy assumptions', async () => {
  for (const { id } of professionRegistry) {
    const adapter = await loadProfessionAppAdapter(id);
    assert.equal(createDefaultBuild(adapter).assumptions.quickness, true, id);
    assert.equal(createDefaultBuild(adapter).assumptions.alacrity, true, id);
    for (const assumptions of [{}, { quickness: false, alacrity: false }, { quickness: true, alacrity: true }]) {
      const saved = { assumptions: { ...assumptions, fury: false } };
      const build = replaceBuild(saved, adapter);
      assert.equal(build.assumptions.quickness, true, id);
      assert.equal(build.assumptions.fury, false, id);
      assert.equal(build.assumptions.alacrity, true, id);
      assert.deepEqual(saved.assumptions, { ...assumptions, fury: false });
    }
  }
});

// Configuration also enforces the assumption when handed a build that has bypassed application loading.
test('application simulation config always supplies permanent quickness and alacrity', async () => {
  const adapter = await loadProfessionAppAdapter('guardian');
  const build = createDefaultBuild(adapter);
  for (const assumptions of [{}, { quickness: false, alacrity: false }, { quickness: true, alacrity: true }]) {
    build.assumptions = { ...assumptions, fury: false };
    const config = createBuildContext({
      build,
      transitionDelays: normalizeTransitionDelays(),
      patch: profession.resolvePatch({ id: 'current' })
    }).simulationConfig();
    assert.equal(config.boons.quickness, true);
    assert.equal(config.boons.fury, false);
    assert.equal(config.boons.alacrity, true);
  }
});
