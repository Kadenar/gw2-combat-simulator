import test from 'node:test';

import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';

import { assertManifestRegressions } from './preset-benchmark.js';

// Preserved Antiquary rotations retain the stealth, artifact, and chain warnings documented for review.
const pendingWarnings = new Map([
  [
    'data/gw2/builds/thief/b-power-antiquary-sword-pistol.json',
    new Set(['Tactical Strike: Tactical Strike is unavailable - requires stealth.'])
  ],
  [
    'data/gw2/builds/thief/b-condi-antiquary-dagger-dagger.json',
    new Set(['Backstab: Backstab is unavailable - requires stealth.'])
  ],
  [
    'data/gw2/builds/thief/b-condi-antiquary-scepter-dagger.json',
    new Set([
      'Summon Kryptis Turret: Summon Kryptis Turret is unavailable - this artifact is not in an available artifact slot.',
      'Double Bolt: Double Bolt is unavailable - cast Shadow Bolt first.',
      'Triple Bolt: Triple Bolt is unavailable - cast Shadow Bolt first.'
    ])
  ],
  [
    'data/gw2/builds/thief/b-condi-alac-antiquary-scepter-dagger.json',
    new Set([
      'Chak Shield: Chak Shield is unavailable - this artifact is not in an available artifact slot.',
      'Triple Bolt: Triple Bolt is unavailable - cast Shadow Bolt first.',
      'Zephyrite Sun Crystal: Zephyrite Sun Crystal is unavailable - this artifact is not in an available artifact slot.',
      'Mistburn Mortar: Mistburn Mortar is unavailable - this artifact is not in an available artifact slot.'
    ])
  ]
]);

test('Thief presets retain scoped pending warnings and stay within 1% DPS', (t) =>
  assertManifestRegressions(
    'thief',
    (adapter, rotation, config) =>
      runGw2Runtime({ profession: adapter.profession.runtimeFor(config), config, rotation }),
    { pendingWarnings, diagnostic: (message) => t.diagnostic(message) }
  ));
