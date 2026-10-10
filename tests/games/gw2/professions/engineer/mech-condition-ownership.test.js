import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';

const simulate = createObservedProfessionSimulator(engineerProfession, {});

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
