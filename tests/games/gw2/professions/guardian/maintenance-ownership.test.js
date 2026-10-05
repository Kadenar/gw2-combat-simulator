import assert from 'node:assert/strict';
import test from 'node:test';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

/** Empty runs expose selected effect owners without involving skill animations or damage formulas. */
function initialized(specialization) {
  const config = { specialization };
  const profession = guardianProfession.runtimeFor(config);
  const result = observeGw2Runtime({ profession, config, rotation: [] });
  assert.deepEqual(result.warnings, []);
  return { profession, context: observedRuntime(result).mechanics };
}

test('Guardian composition installs each effect owner once and excludes inactive elite policies and observations', () => {
  const eliteKinds = {
    Firebrand: ['toughness', 'ashes-of-the-just'],
    Willbender: [
      'justice',
      'resolve',
      'courage',
      'willbender-justice',
      'willbender-resolve',
      'willbender-courage',
      'lethal-tempo'
    ],
    Luminary: [
      'guardian-daring-advance',
      'guardian-piercing-stance',
      'radiant-forge',
      'light-aura',
      'radiant-armaments',
      'guardian-radiant-armaments',
      'guardian-radiant-courage-sword',
      'guardian-empowered-armaments'
    ]
  };
  const eliteObservations = {
    Firebrand: ['ashes-of-the-just'],
    Willbender: ['lethal-tempo', 'willbender-justice', 'willbender-resolve', 'willbender-courage'],
    Luminary: [
      'guardian-radiant-armaments',
      'radiant-forge',
      'guardian-empowered-armaments',
      'guardian-piercing-stance',
      'light-aura'
    ]
  };
  for (const specialization of ['Core', 'Dragonhunter', ...Object.keys(eliteKinds)]) {
    const { profession, context } = initialized(specialization);
    const policies = profession.buffPolicies(context).map(({ kind }) => kind);
    const observations = profession.observeEffects(context.queries).map(({ kind }) => kind);
    assert.equal(new Set(policies).size, policies.length);
    assert.equal(new Set(observations).size, observations.length);
    assert.ok(policies.includes('symbolic-avenger'));
    assert.ok(observations.includes('symbolic-avenger'));
    for (const [owner, kinds] of Object.entries(eliteKinds)) {
      for (const kind of kinds) {
        assert.equal(policies.includes(kind), owner === specialization, `${specialization}: ${kind}`);
        if (owner !== specialization) assert.ok(!observations.includes(kind), `${specialization}: ${kind}`);
      }
    }

    for (const [owner, kinds] of Object.entries(eliteObservations))
      for (const kind of kinds)
        assert.equal(observations.includes(kind), owner === specialization, `${specialization}: ${kind}`);
  }
});
