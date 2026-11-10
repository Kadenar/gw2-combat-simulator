import test from 'node:test';

import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';

import { assertManifestRegressions } from './preset-benchmark.js';

// Preserved Untamed rotations have documented ambush failures after the pet cooldown update.
const pendingWarnings = new Map([
  [
    'data/gw2/builds/ranger/b-power-untamed-hawk-beastmastery-hammer-sword-axe.json',
    new Set([
      'Relentless Whirl: Relentless Whirl is unavailable - unleash to make an ambush available.',
      'Deft Strike: Deft Strike is unavailable - unleash to make an ambush available.'
    ])
  ],
  [
    'data/gw2/builds/ranger/b-condi-quick-untamed-axe-dagger-dagger-torch.json',
    new Set(['Neurotoxin Burst: Neurotoxin Burst is unavailable - unleash to make an ambush available.'])
  ]
]);

test('Ranger presets retain scoped pending warnings and stay within 1% DPS', (t) =>
  assertManifestRegressions(
    'ranger',
    (adapter, rotation, config) =>
      runGw2Runtime({ profession: adapter.profession.runtimeFor(config), rotation, config }),
    { pendingWarnings, diagnostic: (message) => t.diagnostic(message) }
  ));
