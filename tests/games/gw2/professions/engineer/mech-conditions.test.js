import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { mechanistHooks } from '#gw2/professions/engineer/specializations/mechanist/hooks.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';

const simulate = createObservedProfessionSimulator(engineerProfession, {});

// Command identity alone cannot grant mech bonuses or dispatch mech-only strike rewards.
test('mech consumers require explicit event or condition-application ownership', () => {
  const config = {
    specialization: 'Mechanist',
    selectedTraitIds: [TRAIT.MECH_ARMS_JADE_CANNONS, TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR]
  };
  const profession = engineerProfession.runtimeFor(config);
  for (const [ownership, owned] of [
    [{}, false],
    [{ metadata: { engineerMech: false }, summonOwner: 'another-summon' }, false],
    [{ metadata: { engineerMech: true } }, true],
    [{ application: { metadata: { engineerMech: true } } }, true]
  ]) {
    const event = { type: 'damage', actorType: 'summon', skillId: ID.SPARK_REVOLVER, coefficient: 1, ...ownership };
    const context = {
      config,
      catalog: profession.catalog,
      profession: { catalog: profession.catalog },
      event,
      time: 0
    };
    assert.ok(Math.abs(profession.modifyCriticalChance(context, 0.1) - (owned ? 0.3 : 0.1)) < 1e-12);
    const rewards = [];
    mechanistHooks.reactions['damage.resolved']({ fireTrigger: (...args) => rewards.push(args) }, event, {});
    assert.equal(rewards.length, owned ? 1 : 0);
  }
});

// Native commands and derived trait conditions must share the companion's stats and Firearms duration bonuses.
for (const panelCalculated of [false, true]) {
  test(`mech conditions retain ownership with ${panelCalculated ? 'panel-calculated' : 'raw'} attributes`, () => {
    const result = simulate('Mechanist', ['Rolling Smash', 'Jade Mortar', { type: 'wait', durationMs: 4000 }], {
      selectedSkillIds: [ID.SHIFT_SIGNET],
      selectedTraitIds: [
        TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
        TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
        TRAIT.MECH_CORE_JADE_DYNAMO,
        TRAIT.SERRATED_STEEL,
        TRAIT.INCENDIARY_POWDER
      ],
      attributeInputs: baseAttributeInputs({
        power: 2000,
        precision: 1000,
        conditionDamage: 3000,
        expertise: 300,
        conditionDurationBonus: 10,
        conditionDurationBonuses: panelCalculated ? { Bleeding: 33, Burning: 33 } : {}
      }),
      boons: { might: 25 },
      target: { conditions: {} }
    });
    const conditions = result.resolvedEvents.filter(
      (event) =>
        event.type === 'condition' && event.actorType === 'summon' && ['Bleeding', 'Burning'].includes(event.condition)
    );
    assert.ok(conditions.some((event) => event.sourceId === TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS));
    assert.ok(conditions.some((event) => event.skillId === ID.JADE_MORTAR));
    for (const event of conditions) {
      assert.equal(event.metadata.engineerMech, true);
      assert.equal(event.summonOwner, 'engineer.mech');
      assert.equal(event.independentConditionOwner, true);
      assert.equal(event.summonInheritsAttributes, true);
      // Only inherited Expertise and selected Firearms traits extend mech conditions; player gear duration does not.
      assert.ok(Math.abs(event.effectiveDuration / event.duration - 1.53) < 0.001, event.name);
    }

    assert.deepEqual(result.warnings, []);
  });
}
