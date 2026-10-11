import assert from 'node:assert/strict';
import test from 'node:test';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { ELEMENTALIST_TRAIT_IDS } from '#gw2/professions/elementalist/data/ids.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { ENGINEER_TRAIT_IDS } from '#gw2/professions/engineer/data/ids.js';
import { defineTestProfession } from '#tests/helpers/profession.js';
import { resolveTestGw2Events } from '#tests/helpers/gw2-resolver.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';

// Both traits must use final Power once per application, without altering other conditions or independent owners.
for (const [name, catalog, modifiers, trait, condition, other, damage, coefficient] of [
  [
    'Inferno',
    elementalistCatalog,
    elementalistProfession.runtimeFor({}),
    ELEMENTALIST_TRAIT_IDS.INFERNO,
    'Burning',
    'Bleeding',
    592 + 658 + 284 + 262,
    0.0825 / 0.155
  ],
  [
    'Sharpshooter',
    engineerCatalog,
    engineerProfession.runtimeFor({}),
    ENGINEER_TRAIT_IDS.SHARPSHOOTER,
    'Bleeding',
    'Burning',
    204 + 236 + 882 + 44,
    2 / 3
  ]
]) {
  test(`${name} shares the final condition-attribute conversion contract`, () => {
    // This formula-only runtime needs the trait's tuning, not unrelated profession skills and resource grants.
    const selectedCatalog = createCanonicalCatalog({ balanceProfiles: [catalog.balanceProfilesById.get(trait)] });
    for (const output of ['detailed', 'score']) {
      const reads = new Map();
      const profession = defineTestProfession({
        id: 'power-condition',
        name,
        catalog: selectedCatalog,
        modifiers: {
          modifyConditionAttributes: modifiers.modifyConditionAttributes,
          modifyAttributes(context, attributes) {
            if (context.time > 0) {
              const key = `${context.time}:${context.event.sourceId}`;
              reads.set(key, (reads.get(key) || 0) + 1);
            }

            return {
              ...attributes,
              power: context.time < 2 ? 2000 : 2400,
              conditionDamage: context.event.condition === other ? 2000 : 1000
            };
          }
        }
      });
      const config = { selectedTraitIds: [trait], target: { conditions: {} } };
      const application = {
        type: 'condition',
        at: 0,
        actorType: 'player',
        source: 'Player',
        sourceId: 'primary',
        condition,
        stacks: 1,
        duration: 2,
        fixedDuration: true
      };
      const summon = {
        ...application,
        actorType: 'summon',
        source: 'Minion',
        sourceId: 'summon',
        summonOwner: 'minion',
        independentSummonStrike: true,
        summonBasePower: 3000,
        summonBaseConditionDamage: 0
      };
      const events = [
        { type: 'damage', at: 0, actorType: 'player', source: 'Player', sourceId: 'opener', flatDamage: 1 },
        application,
        summon,
        { ...application, sourceId: 'other', condition: other },
        { ...summon, sourceId: 'independent', independentConditionOwner: true }
      ];
      const result = resolveTestGw2Events({ profession, config, events, endTime: 2, output });
      assert.deepEqual(result.warnings, []);
      assert.equal(result.conditionDamage, damage);
      assert.equal(reads.size, 8);
      for (const [key, count] of reads) assert.equal(count, 1, `Duplicate attribute calculation for ${key}`);

      reads.clear();
      const query = createGw2CombatQuery({ profession, config });
      assert.equal(query.conditionMultiplier(condition, 1, application), 1);
      assert.equal(reads.size, 0, 'Damage multipliers must not resolve attributes');
      const relic = { name: 'test', state: {}, rules: { conditionDamageBonus: () => 300 } };
      assert.equal(query.statsAt(1, application, { relic }).conditionDamage, 2000 * coefficient);
      assert.equal(query.statsAt(1, events[3], { relic }).conditionDamage, 2300);
      assert.equal(query.statsAt(1, events[0], { relic }).conditionDamage, 1300);
      const unselected = createGw2CombatQuery({ profession, config: { ...config, selectedTraitIds: [] } });
      assert.equal(unselected.statsAt(1, application).conditionDamage, 1000);
      const patched = createGw2CombatQuery({
        profession: { ...profession, catalog: withProfile(selectedCatalog, trait, { coefficientMultiplier: 0.5 }) },
        config
      });
      assert.equal(patched.statsAt(1, application).conditionDamage, 1000);
    }
  });
}
