import { soulbeastModule } from '#gw2/professions/ranger/specializations/soulbeast/module.js';
import { elementalistCoreModule } from '#gw2/professions/elementalist/core/module.js';
import { ELEMENTALIST_TRAIT_IDS } from '#gw2/professions/elementalist/data/ids.js';
import { weaverModule } from '#gw2/professions/elementalist/specializations/weaver/module.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { engineerCoreModifiers } from '#gw2/professions/engineer/core/modifiers.js';
import { engineerCoreModule } from '#gw2/professions/engineer/core/module.js';
import { ENGINEER_TRAIT_IDS } from '#gw2/professions/engineer/data/ids.js';
import { amalgamModule } from '#gw2/professions/engineer/specializations/amalgam/module.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/catalog.js';
import { modifyNecromancerCoreAttributes } from '#gw2/professions/necromancer/core/modifiers.js';
import { reaperModifierRules } from '#gw2/professions/necromancer/specializations/reaper/modifiers.js';
import { rangerCoreModule } from '#gw2/professions/ranger/core/module.js';
import { RANGER_TRAIT_IDS } from '#gw2/professions/ranger/data/ids.js';
import { galeshotModule } from '#gw2/professions/ranger/specializations/galeshot/module.js';

import { revenantCoreModule } from '#gw2/professions/revenant/core/module.js';
import { REVENANT_TRAIT_IDS } from '#gw2/professions/revenant/data/ids.js';
import { thiefCoreModule } from '#gw2/professions/thief/core/module.js';
import { THIEF_TRAIT_IDS } from '#gw2/professions/thief/data/ids.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const OWNERSHIP_CASES = Object.freeze([
  ['player actor', { actorType: 'player' }, true],
  ['source without actor', { source: 'Player' }, false],
  ['player-owned effect', { actorType: 'effect', ownerActorType: 'player' }, true],
  ['explicitly player-owned summon', { actorType: 'summon', ownerActorType: 'player' }, true],
  ['unowned effect', { actorType: 'effect' }, false],
  ['summon-owned effect', { actorType: 'effect', ownerActorType: 'summon' }, false],
  ['environment actor', { actorType: 'environment' }, false],
  ['unknown actor', { actorType: 'unknown' }, false],
  ['summon actor', { actorType: 'summon' }, false]
]);

function modifierRule(rules, id) {
  const rule = rules.find((candidate) => candidate.id === id);
  assert.ok(rule?.when, `${id} must expose an ownership predicate`);
  return rule;
}

const elementalistStormsoul = modifierRule(elementalistCoreModule.modifiers.modifierRules, 'elementalist.stormsoul');
const weaverSuperiorElements = modifierRule(weaverModule.modifiers.modifierRules, 'elementalist.superior-elements');
const rangerSurvivalInstincts = modifierRule(rangerCoreModule.modifiers.modifierRules, 'ranger.survival-instincts');
const soulbeastLoudWhistle = modifierRule(soulbeastModule.modifiers.modifierRules, 'ranger.loud-whistle-player');
const galeshotBirdOfPrey = modifierRule(galeshotModule.modifiers.modifierRules, 'ranger.bird-of-prey');
const amalgamWillingHost = modifierRule(amalgamModule.modifiers.modifierRules, 'engineer.willing-host');
const reaperShout = modifierRule(reaperModifierRules, 'necromancer.reaper-shout-melee');
const engineerHighCaliber = modifierRule(engineerCoreModule.modifiers.modifierRules, 'engineer.high-caliber');
const revenantFerociousAggression = modifierRule(
  revenantCoreModule.modifiers.modifierRules,
  'revenant.ferocious-aggression'
);
const thiefExposedWeakness = modifierRule(thiefCoreModule.modifiers.modifierRules, 'thief.exposed-weakness');

const PLAYER_MODIFIER_PREDICATES = Object.freeze([
  [
    'Elementalist core',
    (event) => elementalistStormsoul.when({ time: 1, event, traits: new Set([ELEMENTALIST_TRAIT_IDS.STORMSOUL]) })
  ],
  [
    'Weaver',
    (event) =>
      weaverSuperiorElements.when({
        time: 1,
        event,
        traits: new Set([ELEMENTALIST_TRAIT_IDS.SUPERIOR_ELEMENTS]),
        query: { targetHasCondition: () => true }
      })
  ],
  [
    'Engineer core',
    (event) => engineerHighCaliber.when({ time: 1, event, traits: new Set([ENGINEER_TRAIT_IDS.HIGH_CALIBER]) })
  ],
  [
    'Engineer Sharpshooter',
    (event) => {
      const attributes = engineerCoreModifiers.modifyConditionAttributes(
        {
          catalog: engineerCatalog,
          time: 1,
          event: { ...event, condition: 'Bleeding' },
          traits: new Set([ENGINEER_TRAIT_IDS.SHARPSHOOTER])
        },
        { power: 150, conditionDamage: 0 }
      );
      return attributes.conditionDamage === 100;
    }
  ],
  [
    'Amalgam',
    (event) =>
      amalgamWillingHost.when({
        time: 1,
        event,
        traits: new Set([ENGINEER_TRAIT_IDS.WILLING_HOST]),
        runtime: {
          profession: {
            specialization: { kind: 'Amalgam', state: { willingHostUntil: 2 } }
          }
        }
      })
  ],
  [
    'Necromancer core',
    (event) =>
      modifyNecromancerCoreAttributes(
        {
          catalog: necromancerCatalog,
          time: 1,
          event: event ?? {},
          actorType: event?.actorType,
          config: { selectedSkillIds: [10622] }
        },
        { power: 0 }
      ).power === 180
  ],
  [
    'Ranger core',
    (event) =>
      rangerSurvivalInstincts.when({
        time: 1,
        event,
        traits: new Set([RANGER_TRAIT_IDS.SURVIVAL_INSTINCTS])
      })
  ],
  [
    'Soulbeast',
    (event) =>
      soulbeastLoudWhistle.when({
        time: 1,
        event,
        traits: new Set([RANGER_TRAIT_IDS.LOUD_WHISTLE]),
        runtime: {
          profession: {
            specialization: { kind: 'Soulbeast', state: { beastmodeActive: true } }
          }
        }
      })
  ],
  [
    'Galeshot',
    (event) =>
      galeshotBirdOfPrey.when({
        time: 1,
        event,
        traits: new Set([RANGER_TRAIT_IDS.BIRD_OF_PREY]),
        config: { boons: { swiftness: true } }
      })
  ],
  [
    'Revenant',
    (event) =>
      revenantFerociousAggression.when({
        time: 1,
        event,
        traits: new Set([REVENANT_TRAIT_IDS.FEROCIOUS_AGGRESSION]),
        config: { boons: { fury: true } }
      })
  ],
  [
    'Thief',
    (event) => thiefExposedWeakness.when({ time: 1, event, traits: new Set([THIEF_TRAIT_IDS.EXPOSED_WEAKNESS]) })
  ]
]);

// Each selected rule has only its non-ownership prerequisites enabled so these cases isolate attribution behavior.
for (const [profession, predicate] of PLAYER_MODIFIER_PREDICATES) {
  test(`${profession} player modifiers use explicit event ownership`, () => {
    for (const [label, event, expected] of OWNERSHIP_CASES) {
      assert.equal(Boolean(predicate(event)), expected, label);
    }

    assert.equal(Boolean(predicate(undefined)), false, 'missing event');
  });
}

test('actual-player skill modifiers do not follow modifier ownership', () => {
  const context = {
    time: 1,
    profession: {
      catalog: { skillsById: new Map([[1, { id: 1, categories: ['Shout'] }]]) }
    }
  };

  assert.equal(reaperShout.when({ ...context, event: { actorType: 'player', skillId: 1 } }), true);
  assert.equal(
    reaperShout.when({ ...context, event: { actorType: 'effect', ownerActorType: 'player', skillId: 1 } }),
    false
  );
  assert.equal(
    modifyNecromancerCoreAttributes(
      { catalog: necromancerCatalog, time: 1, config: { selectedSkillIds: [10622] } },
      { power: 0 }
    ).power,
    180,
    'eventless player attribute query'
  );
});
