import assert from 'node:assert/strict';
import test from 'node:test';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { coldShoulder } from '#gw2/professions/necromancer/specializations/reaper/traits/index.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';

// One guaranteed critical strike tests both consumers before Nova can extend the target's Chill lifetime.
function checkChilled({ conditions = {}, applications = [], at = 1, removedAt, expected }) {
  const config = {
    specialization: 'Reaper',
    selectedTraitIds: [TRAIT.COLD_SHOULDER, TRAIT.CHILLING_NOVA],
    stats: { power: 2000, precision: 3000, ferocity: 0, expertise: 0 },
    target: { armor: 2597, conditions }
  };
  const native = necromancerProfession.runtimeFor(config);
  let engine;
  let checked = false;
  const result = observeGw2Runtime({
    profession: {
      ...native,
      tasks: {
        ...native.tasks,
        'test.remove-chill'() {
          // Exercise the resolver's existing removal marker; no profession-owned deadline should outlive it.
          const stacks = engine.conditionState.get('Chilled').stacks;
          assert.ok(stacks.length > 0);
          for (const stack of stacks) stack.removedAt = removedAt;
        },
        'test.probe'(context) {
          assert.equal(context.combat.targetHasCondition('Chilled', at), expected);
          assert.equal(
            coldShoulder.modifierRules[0].when({ config, time: at, query: engine.query, runtime: engine }),
            expected
          );
          context.effects.emit({
            kind: 'packet',
            event: {
              type: 'damage',
              at,
              source: 'Player',
              sourceId: ID.GRAVEDIGGER,
              skillId: ID.GRAVEDIGGER,
              skillName: 'Chilled eligibility probe',
              name: 'Chilled eligibility probe',
              actorType: 'player',
              coefficient: 1,
              hits: 1,
              skillWeapon: 'Greatsword'
            }
          });
          checked = true;
        }
      }
    },
    config,
    rotation: [{ type: 'wait', durationMs: (at + 0.1) * 1000 }],
    engineInitialize(runtime) {
      engine = runtime;
      for (const application of applications) {
        runtime.effects.emit({
          kind: 'packet',
          event: {
            type: 'condition',
            source: 'Player',
            sourceId: ID.SPINAL_SHIVERS,
            skillId: ID.SPINAL_SHIVERS,
            skillName: 'Chill setup',
            actorType: 'player',
            condition: 'Chilled',
            stacks: 1,
            ...application
          }
        });
      }

      if (removedAt != null) runtime.schedule('test.remove-chill', removedAt);
      runtime.schedule('test.probe', at, null, undefined, 1);
    }
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(checked, true);
  assert.ok(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.name === 'Chilled eligibility probe')
  );
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.sourceId === TRAIT.CHILLING_NOVA),
    expected
  );
}

test('Reaper proc and modifier gates share configured Chilled presence and normalized names', () => {
  for (const conditions of [{}, { Chilled: false }, { Chilled: true }, { ' chilled ': 1 }]) {
    checkChilled({ conditions, expected: Object.values(conditions).some(Boolean) });
  }
});

test('Reaper Chilled gates see only accepted target applications', () => {
  for (const [application, expected] of [
    [{ at: 0, duration: 2 }, true],
    [{ at: 0, duration: 2, condition: ' chilled ' }, true],
    [{ at: 0, duration: 2, offTarget: true }, false]
  ]) {
    checkChilled({ applications: [application], expected });
  }
});

test('Reaper Chilled gates share reapplication and exclusive expiry', () => {
  for (const [at, expected] of [
    [0.999999, true],
    [1, false]
  ]) {
    checkChilled({ applications: [{ at: 0, duration: 1 }], at, expected });
  }

  for (const [at, expected] of [
    [1, true],
    [2.499999, true],
    [2.5, false]
  ]) {
    checkChilled({
      applications: [
        { at: 0, duration: 1 },
        { at: 0.5, duration: 2 }
      ],
      at,
      expected
    });
  }
});

test('Reaper Chilled gates respect removal while permanent assumptions remain active', () => {
  for (const [at, expected] of [
    [0.499999, true],
    [0.5, false],
    [1, false]
  ]) {
    checkChilled({ applications: [{ at: 0, duration: 2 }], removedAt: 0.5, at, expected });
  }

  checkChilled({
    conditions: { Chilled: true },
    applications: [{ at: 0, duration: 2 }],
    removedAt: 0.5,
    expected: true
  });
});
