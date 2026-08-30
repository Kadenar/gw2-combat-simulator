import assert from 'node:assert/strict';
import test from 'node:test';

import { elementalistCoreModifierRules } from '../../js/games/gw2/content/professions/elementalist/core/traits/modifiers.js';
import { weaverModifierRules } from '../../js/games/gw2/content/professions/elementalist/specializations/weaver/traits/modifiers.js';
import { ENGINEER_TRAIT_IDS } from '../../js/games/gw2/content/professions/engineer/data/ids.js';
import {
  applyEngineerSharpshooterConditionDamage,
  engineerCoreModifierRules
} from '../../js/games/gw2/content/professions/engineer/core/traits/modifiers.js';
import { amalgamModifierRules } from '../../js/games/gw2/content/professions/engineer/specializations/amalgam/mechanics/evolved-form-rules.js';
import { modifyNecromancerCoreAttributes } from '../../js/games/gw2/content/professions/necromancer/core/traits/modifiers.js';
import { reaperModifierRules } from '../../js/games/gw2/content/professions/necromancer/specializations/reaper/mechanics/reaper-shroud.js';
import { RANGER_TRAIT_IDS } from '../../js/games/gw2/content/professions/ranger/data/ids.js';
import { rangerCoreModifierRules } from '../../js/games/gw2/content/professions/ranger/core/traits/modifiers.js';
import { galeshotModifierRules } from '../../js/games/gw2/content/professions/ranger/specializations/galeshot/mechanics/cyclone-bow-rules.js';
import { soulbeastModifierRules } from '../../js/games/gw2/content/professions/ranger/specializations/soulbeast/mechanics/beastmode.js';
import { REVENANT_TRAIT_IDS } from '../../js/games/gw2/content/professions/revenant/data/ids.js';
import { revenantCoreModifierRules } from '../../js/games/gw2/content/professions/revenant/core/traits/modifiers.js';
import { THIEF_TRAIT_IDS } from '../../js/games/gw2/content/professions/thief/data/ids.js';
import { thiefCoreModifierRules } from '../../js/games/gw2/content/professions/thief/core/traits/modifiers.js';

const OWNERSHIP_CASES = Object.freeze([
  ['player actor', { actorType: 'player' }, true],
  ['legacy player source', { source: 'Player' }, true],
  ['player-owned effect', { actorType: 'effect', ownerActorType: 'player' }, true],
  ['explicitly player-owned summon', { actorType: 'summon', ownerActorType: 'player' }, true],
  ['legacy unowned effect', { actorType: 'effect' }, true],
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

const elementalistStormsoul = modifierRule(elementalistCoreModifierRules, 'elementalist.stormsoul');
const weaverSuperiorElements = modifierRule(weaverModifierRules, 'elementalist.superior-elements');
const rangerSurvivalInstincts = modifierRule(rangerCoreModifierRules, 'ranger.survival-instincts');
const soulbeastLoudWhistle = modifierRule(soulbeastModifierRules, 'ranger.loud-whistle-player');
const galeshotBirdOfPrey = modifierRule(galeshotModifierRules, 'ranger.bird-of-prey');
const amalgamWillingHost = modifierRule(amalgamModifierRules, 'engineer.willing-host');
const reaperShout = modifierRule(reaperModifierRules, 'necromancer.reaper-shout-melee');
const engineerHighCaliber = modifierRule(engineerCoreModifierRules, 'engineer.high-caliber');
const revenantFerociousAggression = modifierRule(revenantCoreModifierRules, 'revenant.ferocious-aggression');
const thiefExposedWeakness = modifierRule(thiefCoreModifierRules, 'thief.exposed-weakness');

const PLAYER_MODIFIER_PREDICATES = Object.freeze([
  ['Elementalist core', (event) => elementalistStormsoul.when({ time: 1, event, traits: new Set(['Stormsoul']) })],
  [
    'Weaver',
    (event) =>
      weaverSuperiorElements.when({
        time: 1,
        event,
        traits: new Set(['Superior Elements']),
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
      const attributes = { power: 150, conditionDamage: 0 };
      applyEngineerSharpshooterConditionDamage(
        { time: 1, event: { ...event, condition: 'Bleeding' }, traits: new Set([ENGINEER_TRAIT_IDS.SHARPSHOOTER]) },
        attributes
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
          time: 1,
          event: event ?? {},
          actorType: event?.actorType,
          config: { selectedSkills: ['Signet of Spite'] }
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
  test(`${profession} player modifiers use compatible event ownership`, () => {
    for (const [label, event, expected] of OWNERSHIP_CASES) {
      assert.equal(Boolean(predicate(event)), expected, label);
    }

    assert.equal(Boolean(predicate(undefined)), false, 'missing event');
  });
}

test('actual-player skill modifiers do not follow modifier ownership', () => {
  const context = {
    time: 1,
    config: { target: { nearby: true } },
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
    modifyNecromancerCoreAttributes({ time: 1, config: { selectedSkills: ['Signet of Spite'] } }, { power: 0 }).power,
    180,
    'eventless player attribute query'
  );
});
