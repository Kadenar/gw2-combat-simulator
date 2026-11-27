import assert from 'node:assert/strict';
import test from 'node:test';

import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import {
  relicConditionDamageBonus,
  relicConditionDurationBonus,
  relicCriticalChanceBonus,
  relicOutgoingDamageBonus,
  relicStrikeMultiplier
} from '#gw2/platform/equipment/relics/query.js';
import {
  createAristocracyPreviewQueries,
  createRelicRuntime,
  createRelicTimelineQueries
} from '#gw2/platform/equipment/relics/runtime.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { createTestLiveEffects } from '#tests/helpers/live-effects.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

// A detached strike can use its own skill and a recorded buff, while a partial live query sees only applied grants.
test('detached strike queries combine an item trigger with an eligible recorded precast', () => {
  const trap = { id: 991001, name: 'Trap', skillFamily: 'Trap', effects: [] };
  const profession = defineTestProfession({
    id: 'trap-query',
    name: 'Trap query',
    catalog: createCanonicalCatalog({ skills: [trap] })
  });
  const query = createGw2CombatQuery({
    profession,
    config: { relic: 'Dragonhunter', precastRelics: ['Brawler'] },
    resolvedTimelineEvents: [
      { type: 'buff', kind: 'relic-brawler', at: 1, duration: 1, stacks: 1, resolvedAudience: { includesSelf: true } }
    ]
  });
  const player = { type: 'damage', actorType: 'player', skillId: trap.id, at: 0 };
  const trapOnly = query.strikeMultiplier(player, 0);
  assert.ok(trapOnly > 1);
  assert.ok(query.strikeMultiplier(player, 2) > trapOnly);
  assert.equal(query.strikeMultiplier(player, 2, {}), trapOnly);
  assert.equal(query.strikeMultiplier(player, 2.04), trapOnly);
  const summon = { ...player, actorType: 'summon', independentSummonStrike: true };
  assert.ok(query.strikeMultiplier(summon, 2) > 1);
  assert.equal(query.strikeMultiplier({ ...summon, summonUsesEquipmentModifiers: false }, 2), 1);
});

// A later self grant replaces the earlier window even if the earlier grant would have lasted longer.
test('a detached Peitha strike reads the latest self grant at the query time', () => {
  const profession = defineTestProfession({ id: 'window-query', name: 'Window query' });
  const grant = { type: 'buff', kind: 'relic-peitha', stacks: 1, resolvedAudience: { includesSelf: true } };
  const query = createGw2CombatQuery({
    profession,
    config: { relic: 'Peitha' },
    resolvedTimelineEvents: [
      { ...grant, at: 0, duration: 8 },
      { ...grant, at: 2, duration: 1 }
    ]
  });
  const hit = { type: 'damage', actorType: 'player', at: 0 };
  assert.ok(query.strikeMultiplier(hit, 3) > 1);
  assert.equal(query.strikeMultiplier(hit, 3.04), 1);
  assert.equal(query.strikeMultiplier(hit, 3, {}), 1);
});

// Recorded grants start on the live store's game tick, including off-tick starts and floating-point noise.
test('detached relic buff queries read recorded starts on the live store clock', () => {
  const profession = defineTestProfession({ id: 'tick-query', name: 'Tick query' });
  for (const [relic, kind] of [
    ['Brawler', 'relic-brawler'],
    ['Peitha', 'relic-peitha']
  ])
    for (const start of [1 + 1e-10, 1.01]) {
      const grant = { type: 'buff', kind, at: start, duration: 2, stacks: 1, resolvedAudience: { includesSelf: true } };
      const query = createGw2CombatQuery({ profession, config: { relic }, resolvedTimelineEvents: [grant] });
      const runtime = { liveEffects: createTestLiveEffects([[kind, [grant]]]) };
      for (const at of [1, 1.02, 1.04]) {
        const hit = { type: 'damage', actorType: 'player', at };
        assert.equal(
          query.strikeMultiplier(hit, at),
          query.strikeMultiplier(hit, at, runtime),
          `${relic} ${start} ${at}`
        );
      }

      assert.ok(query.strikeMultiplier({ type: 'damage', actorType: 'player', at: 1.04 }, 1.04) > 1);
    }
});

// Without a runtime, a relic duration rule reads the same recorded grant as its strike rule.
test('detached condition-duration queries read recorded relic grants', () => {
  const profession = defineTestProfession({ id: 'duration-query', name: 'Duration query' });
  const query = createGw2CombatQuery({
    profession,
    config: { relic: 'Dragonhunter' },
    resolvedTimelineEvents: [
      {
        type: 'buff',
        kind: 'relic-dragonhunter',
        at: 1,
        duration: 5,
        stacks: 1,
        resolvedAudience: { includesSelf: true }
      }
    ]
  });
  const event = { type: 'condition', actorType: 'player', at: 2 };
  const stats = query.statsAt(2, event);
  const detached = query.conditionDurationMultiplier('Bleeding', 2, stats, event);
  assert.ok(detached > query.conditionDurationMultiplier('Bleeding', 0, stats, event));
  assert.ok(detached > query.conditionDurationMultiplier('Bleeding', 2, stats, event, {}));
});

// Absent relics and unimplemented contributions retain the neutral formula values.
test('relic queries return neutral contributions without an applicable rule', () => {
  for (const relic of [undefined, createRelicRuntime('')]) {
    const context = { relic, config: {}, totals: { strike: 0, condition: 0 } };
    const event = { type: 'damage', at: 0, actorType: 'player' };
    assert.equal(relicStrikeMultiplier(context, event), 1);
    assert.equal(relicOutgoingDamageBonus(context, 0), 0);
    assert.equal(relicCriticalChanceBonus(context, event, 0), 0);
    assert.equal(relicConditionDurationBonus(context, 0), 0);
    assert.equal(relicConditionDamageBonus(context, 0), 0);
  }
});

// Live and historical attribute queries need configured observations, not an effect-emission service.
test('Thorns query wrappers preserve initial stacks and leave relic state unchanged', () => {
  for (const relic of [createRelicRuntime('Thorns'), createRelicTimelineQueries('Thorns', [])]) {
    const context = { config: { initialThornsStacks: 2 }, relic };
    assert.equal(relicConditionDamageBonus(context, 3), 90);
    assert.equal(relicConditionDamageBonus(context, 0), 60);
    assert.equal(relicConditionDamageBonus(context, 3), 90);
    assert.equal('state' in relic, false);
  }
});

// The combat query supplies configuration even when the live observation contains only relic state.
test('combat attribute queries supply Thorns configuration for live and historical state', () => {
  const profession = defineTestProfession({
    id: 'relic-query-fixture',
    name: 'Relic Query Fixture',
    catalog: createCanonicalCatalog({ skills: [] })
  }).runtimeFor();
  const config = { relic: 'Thorns', initialThornsStacks: 2 };
  const query = createGw2CombatQuery({ profession, config });
  const baseline = createGw2CombatQuery({ profession }).statsAt(0).conditionDamage;
  const runtime = { relic: createRelicRuntime('Thorns') };
  for (const [at, bonus] of [
    [0, 60],
    [3, 90]
  ]) {
    assert.equal(query.statsAt(at).conditionDamage, baseline + bonus);
    assert.equal(query.statsAt(at, null, runtime).conditionDamage, baseline + bonus);
  }
});

// Hypothetical attribute stacks stay separate from fresh live and detached historical observations.
test('Aristocracy preview queries own their assumed window without changing live state', () => {
  const preview = createAristocracyPreviewQueries(3);
  const live = createRelicRuntime('Aristocracy');
  const historical = createRelicTimelineQueries('Aristocracy', []);
  for (const owner of [preview, historical]) {
    assert.equal('state' in owner, false);
    assert.equal('completed' in owner, false);
  }

  assert.equal(relicConditionDurationBonus({ relic: preview }, 1), 0.09);
  assert.equal(relicConditionDurationBonus({ relic: preview }, 60.000001), 0);
  assert.equal(relicConditionDurationBonus({ relic: preview }, 1), 0.09);
  assert.equal(relicConditionDurationBonus({ relic: live }, 1), 0);
  assert.equal(relicConditionDurationBonus({ relic: historical }, 1), 0);
});
