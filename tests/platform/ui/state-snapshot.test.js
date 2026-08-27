import assert from 'node:assert/strict';
import test from 'node:test';

import { criticalChanceTooltip } from '../../../js/games/gw2/app/presentation/rotation/state-snapshot.js';

test('critical chance tooltips list contributors and cap behavior', () => {
  const event = {
    type: 'damage',
    at: 1,
    actorType: 'player',
    criticalChance: 1,
    criticalChanceBeforeCap: 1.0371,
    criticalChanceContributors: [
      { id: 'precision', label: 'Precision', amount: 0.4371 },
      { id: 'fury', label: 'Fury', amount: 0.25 },
      {
        id: 'necromancer.death-perception-critical-chance',
        label: 'Death Perception',
        amount: 0.15
      },
      {
        id: 'necromancer.target-the-weak-critical-chance',
        label: 'Target the Weak',
        amount: 0.2
      }
    ]
  };

  assert.equal(
    criticalChanceTooltip(event, 'Critical strike chance'),
    [
      'Critical strike chance',
      'Precision: 43.71%',
      'Fury: +25%',
      'Death Perception: +15%',
      'Target the Weak: +20%',
      'Before cap: 103.71%',
      'Final: 100%'
    ].join('\n')
  );
});
