import assert from 'node:assert/strict';
import test from 'node:test';

import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';

import { assertManifestRegressions } from './preset-benchmark.js';

const deadeyeStealthWarning =
  "Malicious Death's Judgment: Malicious Death's Judgment is unavailable - requires stealth.";

// Preserved rotations retain only the preset-specific warnings documented for review.
const pendingWarnings = new Map([
  [
    // Faster kills stop malice gains before the saved rotation's final stealth attack.
    'data/gw2/builds/thief/b-power-quick-deadeye-rifle.json',
    new Set([deadeyeStealthWarning])
  ],
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
    (adapter, rotation, config) => {
      const result = runGw2Runtime({ profession: adapter.profession.runtimeFor(config), config, rotation });
      // The preset exception must never permit missing stealth while the target is alive.
      for (const warning of result.warnings.filter(({ message }) => message === deadeyeStealthWarning))
        assert.ok(
          result.deathTime != null && warning.at > result.deathTime,
          'Deadeye warning must follow target death'
        );

      return result;
    },
    { pendingWarnings, diagnostic: (message) => t.diagnostic(message) }
  ));
