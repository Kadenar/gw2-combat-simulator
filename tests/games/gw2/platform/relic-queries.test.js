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
import { createRelicRuntime, createRelicTimelineRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

// Absent relics and unimplemented contributions retain the neutral formula values.
test('relic queries return neutral contributions without an applicable rule', () => {
  for (const relic of [undefined, createRelicRuntime('')]) {
    const context = { relic, config: {}, totals: { strike: 0, condition: 0 } };
    const event = { type: 'damage', at: 0, actorType: 'player' };
    assert.equal(relicStrikeMultiplier(context, event), 1);
    assert.equal(relicOutgoingDamageBonus(context, 'strike', 0, event), 0);
    assert.equal(relicCriticalChanceBonus(context, event, 0), 0);
    assert.equal(relicConditionDurationBonus(context, 0), 0);
    assert.equal(relicConditionDamageBonus(context, 0), 0);
  }
});

// Live and historical attribute queries need configured observations, not an effect-emission service.
test('Thorns query wrappers preserve initial stacks and leave relic state unchanged', () => {
  for (const relic of [createRelicRuntime('Thorns'), createRelicTimelineRuntime('Thorns', [])]) {
    const context = { config: { initialThornsStacks: 2 }, relic };
    const before = structuredClone(relic.state);
    assert.equal(relicConditionDamageBonus(context, 3), 90);
    assert.equal(relicConditionDamageBonus(context, 0), 60);
    assert.deepEqual(relic.state, before);
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
