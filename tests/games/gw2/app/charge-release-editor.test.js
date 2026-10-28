import assert from 'node:assert/strict';
import test from 'node:test';

import { createDefaultBuild } from '#gw2/app/build/state/persistence.js';
import { chargeReleaseRowLabel } from '#gw2/app/rotation/editing/charge-release-editor.js';
import { mechanicResourceSpends } from '#gw2/app/rotation/timeline/model.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { dragonChargeReleaseProjection } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/charge-release.js';
import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';

// The Bladesworn Dragon Slash release editor labels each projected charge outcome.
test('charge release rows expose time, Flow, and coefficient', () => {
  assert.equal(
    chargeReleaseRowLabel({
      charges: 3,
      at: 12.75,
      delta: 0.75,
      flowAfter: 7.5,
      coefficient: 5.435
    }),
    '3 charges · 12.750s (+0.750s) · 7.50 Flow · 5.43 coefficient'
  );
});

// Release times share the timeline's combat-relative clock, so precombat setup does not inflate them.
test('charge release row times are relative to the combat-start marker', () => {
  assert.equal(
    chargeReleaseRowLabel({ charges: 10, at: 27.24, delta: 2.48, flowAfter: 44.72, coefficient: 20.4 }, 3960),
    '10 charges · 23.280s (+2.480s) · 44.72 Flow · 20.40 coefficient'
  );
});

// Rejected candidates expose availability without presenting placeholder simulation values.
test('unreachable charge release rows show no invented time or Flow', () => {
  assert.equal(
    chargeReleaseRowLabel({ charges: 5, at: 0, delta: 0, flowAfter: null, coefficient: 0, disabled: true }),
    '5 charges · unavailable'
  );
});

test('Dragon Slash editor choices execute prefix candidates through the application adapter', async () => {
  const adapter = await loadProfessionAppAdapter('warrior');
  const build = createDefaultBuild(adapter);
  build.weapons = ['Sword', 'Pistol'];
  build.initialResource = 100;
  build.specializations = [{ name: 'Bladesworn', traits: '1-2-2' }];
  const skills = adapter.profession.catalog.skills;
  const skill = skills.find((skill) => skill.name === 'Dragon Slash—Force');
  build.rotation = [
    { type: 'cast', skillId: skills.find((skill) => skill.name === 'Dragon Trigger').id },
    { type: 'wait', durationMs: 1000 },
    { type: 'combat-start' }
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
      patch: app.patch
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
  const preview = (command) => adapter.rotationPreviewAt(app, 1, command ? [command] : []);
  const prefix = preview();
  assert.equal(prefix.planningState.atSeconds, 0);
  assert.equal(prefix.combatStartTime, 1);
  const projection = dragonChargeReleaseProjection({ skill, preview });
  assert.equal(projection.unavailableMessage, undefined);
  assert.ok(projection.rows.length > 0);
  const row = projection.rows.at(-1);
  const actual = preview({ type: 'cast', skillId: skill.id, releaseAtCharges: row.charges });
  assert.deepEqual(actual.warnings, []);
  const release = actual.events.find(
    (event) => event.reason === 'profession mechanic' && event.resource === 'dragon charges'
  );
  assert.equal(row.at, release.at);
  assert.equal(row.flowAfter, release.flowAfter);
  assert.equal(row.coefficient, release.coefficient);
  assert.equal(
    dragonChargeReleaseProjection({ skill, preview: () => adapter.rotationPreviewAt(app, 0) }).unavailableMessage,
    'Enter Dragon Trigger before using this skill.'
  );
});

test('Dragon Slash resource spends preserve charge outcome details', () => {
  const spends = mechanicResourceSpends({
    steps: [{ ri: 4, activationId: 'slash', skill: 'Dragon Slash—Force' }],
    events: [
      {
        type: 'resource',
        reason: 'profession mechanic',
        activationId: 'slash',
        amount: -4,
        resource: 'dragon charges',
        skillName: 'Dragon Slash—Force',
        maximumCharges: 10,
        chargesReached: 4,
        chargingSeconds: 0.75,
        flowSpent: 10
      }
    ]
  });

  assert.deepEqual(spends.get(4), {
    count: 4,
    resource: 'dragon charges',
    maximumCharges: 10,
    chargesReached: 4,
    chargingSeconds: 0.75,
    flowSpent: 10
  });
});
