/** Exercise prepared preview calculations through the same detached-fact interface used by the application. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { ATTRIBUTE_KEYS, baseAttributeInputs, CONDITION_DURATION_KEYS } from '#gw2/platform/attributes/inputs.js';
import { createGw2CombatQuery } from '#gw2/platform/combat-calculation/combat-query.js';
import { gw2BoonDurationMultiplier } from '#gw2/platform/combat/boons.js';
import { playerHealthFraction, targetHealthBelow } from '#gw2/platform/combat/query/runtime-query.js';
import { BOON, CONDITION } from '#gw2/platform/constants.js';
import { gw2SigilSet } from '#gw2/platform/equipment/sigils/loadout.js';
import { queryDamagePreview } from '#gw2/platform/skill-damage/query-preview.js';
import { executeDamageOccurrence } from '#gw2/platform/skill-damage/run-occurrence.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

// Preparation and assumption reactions must settle before the generic player calculation samples state.
test('preview calculations observe prepared state and settled assumptions without a skill override', () => {
  const profession = defineTestProfession({
    id: 'prepared-preview',
    name: 'Prepared preview',
    resources: { createState: () => ({ factor: 1 }) },
    hooks: {
      prepareDamageState(runtime, skill, inputs) {
        assert.equal(skill, undefined);
        runtime.profession.factor = Number(inputs.factor);
      },
      reactions: {
        'buff.applied'(runtime, event) {
          if (event.kind === 'held') runtime.profession.factor += 1;
        }
      }
    },
    modifiers: {
      modifierRules: [
        {
          id: 'prepared-factor',
          target: 'strikeDamage',
          operation: 'multiply',
          factor(context) {
            assert.equal(context.event.type, 'action');
            assert.equal(context.event.actorType, 'player');
            assert.equal(context.event.skillId, undefined);
            assert.equal(context.event.damageKind, undefined);
            assert.equal(playerHealthFraction(context), 1);
            return context.runtime.profession.factor * (targetHealthBelow(context, 0.5) ? 2 : 1);
          }
        }
      ]
    }
  });
  const config = {
    attributeInputs: baseAttributeInputs({ power: 1000 }),
    initialBuffs: [{ kind: 'held', stacks: 1, duration: 30 }],
    target: { health: 0, fixedHealthFraction: 0.25 }
  };
  const inputs = { factor: 2 };
  const saved = structuredClone({ config, inputs });
  const first = queryDamagePreview(profession, config, inputs);
  assert.equal(first.stats.power, config.attributeInputs.weaponSets[0].commonTotals.power);
  assert.equal(first.strikeMultiplier, 6);
  const changed = queryDamagePreview(profession, config, { factor: 4 });
  assert.equal(changed.strikeMultiplier, 10);
  assert.equal(first.strikeMultiplier, 6);

  // Even untyped consumers changing returned data must not change inputs or the next calculation.
  first.stats.power = -1;
  first.conditionDurationMultipliers[CONDITION.POISONED] = -1;
  const repeated = queryDamagePreview(profession, config, inputs);
  assert.equal(repeated.stats.power, config.attributeInputs.weaponSets[0].commonTotals.power);
  assert.equal(repeated.strikeMultiplier, 6);
  assert.equal(repeated.conditionDurationMultipliers[CONDITION.POISONED], 1);
  assert.deepEqual({ config, inputs }, saved);
});

// The display needs uncapped critical chance and resolved duration factors, not percentages or raw duration bonuses.
test('preview facts retain uncapped critical chance and canonical condition durations', () => {
  const profession = defineTestProfession({ id: 'preview-facts', name: 'Preview facts' });
  const config = {
    attributeInputs: baseAttributeInputs({
      precision: 3100,
      ferocity: 300,
      expertise: 150,
      concentration: 450,
      conditionDurationBonuses: { [CONDITION.POISONED]: 20, [CONDITION.BURNING]: 150 }
    }),
    boons: { fury: true },
    criticalDamageMode: 'averaged',
    modifiers: { strike: 1.2, condition: 1.3 }
  };
  const facts = queryDamagePreview(profession, config, {});
  const query = createGw2CombatQuery({ profession, config });
  const event = { type: 'action', at: 0, actorType: 'player', source: 'Player', sourceId: 'stat-preview' };
  const stats = query.statsAt(event.at, event);
  const critical = query.critical(event, event.at, null, stats);
  for (const key of Object.values(ATTRIBUTE_KEYS)) assert.equal(facts.stats[key], stats[key]);
  close(facts.criticalChanceBeforeCap, critical.chanceBeforeCap ?? critical.chance);
  assert.ok(facts.criticalChanceBeforeCap > critical.chance);
  close(facts.criticalDamageMultiplier, critical.damage);
  close(facts.boonDurationMultiplier, gw2BoonDurationMultiplier(null, stats, gw2SigilSet(config)));
  close(facts.conditionDurationMultiplier, query.conditionDurationMultiplier('', event.at, stats, event));
  for (const condition of Object.values(CONDITION_DURATION_KEYS))
    close(
      facts.conditionDurationMultipliers[condition],
      query.conditionDurationMultiplier(condition, event.at, stats, event)
    );
  close(facts.strikeMultiplier, query.strikeMultiplier(event, event.at));
  close(facts.conditionMultiplier, query.conditionMultiplier('', event.at, event));
  assert.doesNotThrow(() => structuredClone(facts));
});

// Generic preview duration must agree with an emitted boon after live bonuses and active-set sigils resolve.
test('boon duration facts include prepared bonuses, caps and active sigils without named boon bonuses', () => {
  const skillId = 991001;
  const profession = defineTestProfession({
    id: 'boon-preview',
    name: 'Boon preview',
    catalog: createCanonicalCatalog({
      skills: [
        {
          id: skillId,
          name: 'Grant',
          castTimeMs: 0,
          effects: [{ type: 'boon', boon: BOON.SWIFTNESS, stacks: 1, duration: 1, audience: { recipients: 'self' } }]
        }
      ]
    }),
    resources: { createState: () => ({ bonus: 0 }) },
    hooks: {
      prepareDamageState(runtime, _skill, inputs) {
        runtime.profession.bonus = Number(inputs.bonus);
      }
    },
    attributeContributions: (context) => [
      {
        traitDurations: { 'Boon Duration': context.runtime.profession.bonus, 'Might Duration': 90 },
        uncappedBoonDuration: 7
      }
    ]
  });
  for (const startingWeaponSet of [1, 2]) {
    for (const bonus of [0, 20, 200]) {
      const config = {
        attributeInputs: baseAttributeInputs({ concentration: 0 }),
        sigilSets: [{ boonDurationBonus: 0 }, { boonDurationBonus: 10 }],
        startingWeaponSet
      };
      const inputs = { bonus };
      const facts = queryDamagePreview(profession, config, inputs);
      const occurrence = executeDamageOccurrence(
        profession,
        config,
        {
          id: 'grant',
          effect: { kind: 'skill', id: skillId },
          name: 'Grant',
          source: 'Skill',
          icon: '',
          unit: 'activation'
        },
        inputs
      );
      const grant = occurrence.events.find((event) => event.kind === BOON.SWIFTNESS);
      assert.ok(grant);
      close(facts.boonDurationMultiplier, grant.duration);
    }
  }
});
