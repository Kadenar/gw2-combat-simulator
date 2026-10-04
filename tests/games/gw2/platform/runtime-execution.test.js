import assert from 'node:assert/strict';
import test from 'node:test';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { executeDamageOccurrence } from '#gw2/platform/skill-damage/execute.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

const skillId = 991001;
const config = {
  stats: { power: 1000, precision: 1000, ferocity: 0, conditionDamage: 0, expertise: 0 },
  target: { armor: 1000, health: 0, conditions: {} },
  randomness: { mode: 'expected', seed: 123 },
  selectedTraitIds: ['test.trait']
};
const occurrence = {
  id: 'measured',
  effect: { kind: 'skill', id: skillId },
  name: 'Measured',
  source: 'Skill',
  unit: 'activation',
  icon: ''
};

// Native composition exercises the same cached hook selection used by every shipped profession.
function fixture({ skill = {}, hooks = {} } = {}) {
  return defineNativeProfession({
    id: 'execution-test',
    name: 'Execution test',
    modules: [
      defineNativeModule({
        id: 'Core',
        data: {
          generatedSkills: [
            {
              id: skillId,
              name: 'Measured',
              castTimeMs: 100,
              effects: [{ type: 'strike', coefficient: 1, weaponStrength: 1000 }],
              ...skill
            }
          ],
          balanceProfiles: [{ id: 'test.proc', name: 'Proc', profileKind: 'trait', effects: [] }]
        },
        state: { create: () => ({ energy: { value: 0, maximum: 10, updatedAt: 0, rate: 0 } }) },
        hooks: {
          resources: {
            energy: {
              kind: 'continuous',
              state: (runtime) => runtime.profession.core.energy,
              maximum: () => 10,
              initial: () => 10,
              recovery: () => 0
            }
          },
          ...hooks
        }
      })
    ]
  });
}

function combat(profession, options = {}) {
  return simulateGw2({
    profession,
    config,
    rotation: [{ type: 'cast', skillId }],
    ...options
  });
}

test('isolated casts preserve resources at acceptance and commit while combat pays at the declared phase', () => {
  for (const spendOn of ['castStart', 'castCommit']) {
    const balances = [];
    const profession = fixture({
      skill: { resourceCost: 3, cost: { resource: 'energy', spendOn } },
      hooks: {
        onCastStart: (runtime) => balances.push(runtime.profession.core.energy.value),
        onCastCommit: (runtime) => balances.push(runtime.profession.core.energy.value)
      }
    });
    executeDamageOccurrence(profession, config, occurrence);
    assert.deepEqual(balances, [10, 10]);
    balances.length = 0;
    const result = combat(profession);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(balances, spendOn === 'castStart' ? [7, 7] : [10, 7]);
  }
});

test('occurrence setup settles assumptions before starting exactly one cast and creates fresh state for each run', () => {
  const observed = [];
  const profession = fixture({
    hooks: {
      prepareDamageState(runtime) {
        runtime.profession.core.prepared = true;
      },
      onCastStart(runtime) {
        observed.push({
          prepared: runtime.profession.core.prepared,
          might: runtime.query.timeline.buffStacksAt('might', runtime.time, 0, 25)
        });
        runtime.profession.core.prepared = false;
      }
    }
  });
  const assumptions = { ...config, initialBuffs: [{ kind: 'might', stacks: 2, duration: 30 }] };
  executeDamageOccurrence(profession, assumptions, occurrence);
  executeDamageOccurrence(profession, assumptions, occurrence);
  assert.deepEqual(observed, [
    { prepared: true, might: 2 },
    { prepared: true, might: 2 }
  ]);
});

test('trait trigger registration stays isolated across cached preview and combat compositions', () => {
  const triggers = [];
  const stages = ['castStart', 'castCommit', 'buff.applied', 'damage.resolved'];
  const profession = fixture({
    hooks: {
      traitTriggers: stages.map((on) => ({
        on,
        trait: 'test.trait',
        emit: 'test.proc',
        when() {
          triggers.push(on);
          return false;
        }
      }))
    }
  });
  const assumptions = { ...config, initialBuffs: [{ kind: 'might', stacks: 1, duration: 30 }] };
  // Both cache orders must keep combat triggers installed and preview predicates completely uninvoked.
  for (let iteration = 0; iteration < 2; iteration++) {
    executeDamageOccurrence(profession, assumptions, occurrence);
    assert.deepEqual(triggers, []);
    const result = combat(profession, { config: assumptions });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(new Set(triggers), new Set(stages));
    triggers.length = 0;
  }
});

test('isolated damage retains authored hit reactions without starting combat or invoking profession hit producers', () => {
  const calls = [];
  const profession = fixture({
    skill: {
      effects: [
        {
          type: 'strike',
          coefficient: 1,
          weaponStrength: 1000,
          reactions: [{ on: 'damage.resolved', actor: 'player', packets: 'each', do: { type: 'test.authored' } }]
        }
      ]
    },
    hooks: {
      sideEffectHandlers: { 'test.authored': () => calls.push('authored') },
      onCombatStart: () => calls.push('combat'),
      reactions: {
        'damage.resolved': () => {
          calls.push('profession');
        }
      }
    }
  });
  executeDamageOccurrence(profession, config, occurrence);
  assert.deepEqual(calls, ['authored']);
  calls.length = 0;
  const result = combat(profession);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(calls, ['combat', 'authored', 'profession']);
});

// Delayed work runs once in the existing scheduler; preview calculation never asks for chart observations.
test('finite occurrence completes delayed work once without collecting effect histories', () => {
  let starts = 0;
  let initialized = 0;
  const profession = fixture({
    hooks: {
      initialize(runtime) {
        initialized++;
        assert.equal(runtime.effectRecorder, null);
      },
      onCastStart() {
        starts++;
      },
      onCastCommit(runtime) {
        runtime.schedule('test.delayed', runtime.time + 2, null);
      },
      tasks: {
        'test.delayed'(runtime) {
          runtime.effects.emit({
            kind: 'packet',
            event: {
              type: 'condition',
              at: runtime.time,
              source: 'execution-test',
              sourceId: skillId,
              actorType: 'player',
              skillId,
              skillName: 'Measured',
              condition: 'Bleeding',
              stacks: 1,
              duration: 4
            }
          });
        }
      },
      observeEffects() {
        throw new Error('Preview must not observe chart effects.');
      },
      buffPolicies() {
        throw new Error('Preview must not collect chart policies.');
      }
    }
  });
  const result = executeDamageOccurrence(profession, config, occurrence);
  const application = result.events.find((event) => event.condition === 'Bleeding' && event.effectiveDuration != null);
  assert.equal(initialized, 1);
  assert.equal(starts, 1);
  assert.equal(application.effectiveDuration, 4);
  assert.ok(application.damage > 0);
});

test('an occurrence beyond the finite guard fails instead of returning a partial calculation', () => {
  const profession = fixture({
    skill: { effects: [{ type: 'condition', condition: 'Bleeding', stacks: 1, duration: 121 }] }
  });
  assert.throws(
    () => executeDamageOccurrence(profession, config, occurrence),
    (error) => error.status === 'unsupported' && error.message.includes('finite calculation window')
  );
});
