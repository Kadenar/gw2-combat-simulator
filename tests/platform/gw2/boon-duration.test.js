import assert from 'node:assert/strict';
import test from 'node:test';

import { gw2BoonDurationMultiplier, gw2StaticAttributes } from '../../../js/platform/gw2/combat/query/runtime-rules.js';
import { gw2ResolverBoonDuration } from '../../../js/platform/gw2/resolver/boon-duration.js';
import { createGw2SchedulerPolicy, gw2SchedulerBoonDuration } from '../../../js/platform/gw2/scheduler/policy.js';

test('the shared boon multiplier combines concentration, global, named, and sigil bonuses', () => {
  const stats = {
    concentration: 300,
    boonDurationBonus: 10,
    boonDurationBonuses: { Might: 15 }
  };

  assert.equal(gw2BoonDurationMultiplier('might', stats, { boonDurationBonus: 5 }), 1.5);
  assert.equal(gw2BoonDurationMultiplier('might', { concentration: 3000 }), 2);
  assert.equal(gw2BoonDurationMultiplier('might', { concentration: -3000 }), 1);
});

test('static attribute snapshots preserve global and named boon-duration bonuses', () => {
  const stats = gw2StaticAttributes({
    stats: {
      concentration: 300,
      boonDurationBonus: 10,
      boonDurationBonuses: { Might: 15 }
    }
  });

  assert.equal(stats.boonDurationBonus, 10);
  assert.deepEqual(stats.boonDurationBonuses, { Might: 15 });
  assert.ok(Math.abs(gw2BoonDurationMultiplier('might', stats) - 1.45) < 1e-12);
});

test('scheduler-owned boons use live profession stats and the active weapon-set sigils', () => {
  const config = {
    stats: {
      concentration: 0,
      boonDurationBonus: 10,
      boonDurationBonuses: { Might: 10 }
    },
    weaponSetStats: [{}, { concentration: 300 }],
    sigilSets: [{ boonDurationBonus: 0 }, { boonDurationBonus: 10 }]
  };
  const schedulerPolicy = createGw2SchedulerPolicy(config);
  const context = {
    schedulerPolicy,
    state: { activeWeaponSet: 2, time: 4, profession: {} },
    events: [],
    combatStartTime: 0,
    profession: {
      // Simulates a live profession attribute modifier layered over configured weapon-set stats.
      modifyAttributes(_context, stats) {
        return { ...stats, concentration: Number(stats.concentration || 0) + 150 };
      }
    }
  };
  const skill = { id: 1, name: 'Fixture boon source' };

  assert.equal(gw2SchedulerBoonDuration(context, skill, 'might', 5), 8);
  assert.equal(gw2SchedulerBoonDuration(context, skill, 'profession-specific-buff', 5), 5);
  assert.equal(gw2SchedulerBoonDuration(context, skill, 'might', 5, { fixedDuration: true }), 5);
});

test('resolver-owned boons sample timestamp stats and the currently active sigils', () => {
  const observations = [];
  const context = {
    activeWeaponSet: 2,
    config: {
      sigilSets: [{ boonDurationBonus: 0 }, { boonDurationBonus: 5 }]
    },
    query: {
      statsAt(at, event, runtime) {
        observations.push({ at, event, runtime });
        return {
          concentration: 300,
          boonDurationBonus: 10,
          boonDurationBonuses: { Might: 15 }
        };
      }
    }
  };
  const event = { type: 'damage', at: 7, skillId: 2 };

  assert.equal(gw2ResolverBoonDuration(context, event, 'might', 4), 6);
  assert.equal(observations.length, 1);
  assert.equal(observations[0].at, 7);
  assert.equal(observations[0].event.type, 'buff');
  assert.equal(observations[0].event.kind, 'might');
  assert.equal(observations[0].runtime, context);

  assert.equal(gw2ResolverBoonDuration(context, event, 'profession-specific-buff', 4), 4);
  assert.equal(gw2ResolverBoonDuration(context, event, 'might', 4, { fixedDuration: true }), 4);
  assert.equal(observations.length, 1);
});
