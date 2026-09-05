import assert from 'node:assert/strict';
import test from 'node:test';
import { gw2BoonDurationMultiplier, gw2StaticAttributes } from '#gw2/platform/combat/query/runtime-rules.js';
import { gw2ResolverBoonDuration } from '#gw2/platform/resolver/boon-duration.js';
import { createGw2SchedulerPolicy, gw2SchedulerBoonDuration } from '#gw2/platform/scheduler/policy.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { replaceSkillHandler } from '#gw2/platform/engine/skills/handlers.js';

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

test('declarative boons can gate dynamic skill availability', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 920001,
        name: 'Grant Aegis',
        castTimeMs: 0,
        effects: [
          {
            type: 'boon',
            boon: 'aegis',
            duration: 2,
            stacks: 1
          }
        ]
      },
      {
        id: 920002,
        name: 'Aegis Strike',
        type: 'Utility',
        castTimeMs: 0,
        effects: [{ type: 'strike', coefficient: 1 }]
      }
    ]
  });
  const profession = defineProfession({
    id: 'boon-gated',
    name: 'Boon Gated',
    catalog,
    castRules: {
      availability: (context) =>
        context.skill.id !== 920002 || context.hasBuff('aegis')
          ? { ready: true }
          : {
              ready: false,
              retryAt: null,
              code: 'fixture.aegis-required',
              reason: 'Aegis Strike is unavailable — requires aegis.'
            }
    }
  });
  const available = simulateGw2({
    profession,
    rotation: ['Grant Aegis', 'Aegis Strike']
  });
  const expired = simulateGw2({
    profession,
    rotation: ['Grant Aegis', { type: 'wait', durationMs: 2100 }, 'Aegis Strike']
  });
  const extended = simulateGw2({
    profession,
    rotation: ['Grant Aegis', { type: 'wait', durationMs: 3100 }, 'Aegis Strike'],
    config: { stats: { concentration: 1500 } }
  });

  assert.ok(available.totalDamage > 0);
  assert.equal(expired.totalDamage, 0);
  assert.ok(extended.totalDamage > 0);
  assert.match(expired.warnings.join(' '), /unavailable/);
});

test('declarative generic buffs use shared timed state without boon-duration scaling', () => {
  let observedAsBuff = false;
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 920011,
        name: 'Grant Trait Buff',
        castTimeMs: 0,
        effects: [{ type: 'buff', kind: 'trait-charge', duration: 10, stacks: 3 }]
      },
      {
        id: 920012,
        name: 'Inspect Trait Buff',
        castTimeMs: 0,
        handlerId: 'fixture.inspect-buff',
        effects: []
      }
    ],
    skillHandlers: {
      'fixture.inspect-buff': replaceSkillHandler((context) => {
        observedAsBuff = context.hasBuff('trait-charge');
      })
    }
  });
  const profession = defineProfession({
    id: 'buff-state-fixture',
    name: 'Buff State Fixture',
    catalog
  });
  const result = simulateGw2({
    profession,
    rotation: ['Grant Trait Buff', 'Inspect Trait Buff'],
    config: { stats: { concentration: 1500 } }
  });
  const application = result.events.find((event) => event.type === 'buff' && event.kind === 'trait-charge');

  assert.equal(observedAsBuff, true);
  assert.equal(application?.duration, 10);
});

test('GW2 duration-stacks Quickness and Alacrity from repeated grants', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930024,
        name: 'Grant Quickness',
        castTimeMs: 0,
        effects: [{ type: 'boon', boon: 'Quickness', duration: 2, stacks: 1 }]
      },
      {
        id: 930025,
        name: 'Grant Alacrity',
        castTimeMs: 0,
        effects: [{ type: 'boon', boon: 'Alacrity', duration: 2, stacks: 1 }]
      },
      {
        id: 930026,
        name: 'Stacked Quickness Cast',
        castTimeMs: 600,
        effects: []
      },
      {
        id: 930027,
        name: 'Stacked Alacrity Cooldown',
        castTimeMs: 0,
        cooldown: 10,
        effects: []
      }
    ]
  });
  const profession = defineProfession({
    id: 'duration-stacking-boon-fixture',
    name: 'Duration Stacking Boon Fixture',
    catalog
  });
  const result = simulateGw2({
    profession,
    rotation: [
      'Grant Quickness',
      'Grant Alacrity',
      { type: 'wait', durationMs: 1000 },
      'Grant Quickness',
      'Grant Alacrity',
      { type: 'wait', durationMs: 2000 },
      'Stacked Quickness Cast',
      'Stacked Alacrity Cooldown'
    ]
  });
  const quicknessAction = result.events.find(
    (event) => event.type === 'action' && event.skillName === 'Stacked Quickness Cast'
  );

  assert.equal(quicknessAction.at, 3);
  assert.equal(quicknessAction.endsAt, 3.4);
  assert.equal(result.endState.cooldowns['Stacked Alacrity Cooldown'].readyAt, 11400);
});
