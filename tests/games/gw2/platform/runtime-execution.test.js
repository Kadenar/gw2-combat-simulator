import assert from 'node:assert/strict';
import test from 'node:test';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';
import { executeDamageOccurrence } from '#gw2/platform/skill-damage/run-occurrence.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';

// The real acceptance boundary reuses one context, reads replaced state, and keeps cached patch selections per run.
test('cast labels receive live profession data and the selected skill in combat and isolated runs', () => {
  let contexts;
  let labels;
  let owner;
  let selected;
  const family = withPatchPreview(
    fixture({
      skill: { cooldown: 1 },
      hooks: {
        initialize(runtime) {
          owner = runtime;
        },
        prepareDamageState(runtime) {
          runtime.profession.core.energy.value = 6;
        },
        castDetail(context, cast) {
          contexts.add(context);
          assert.deepEqual(Object.keys(context), ['readProfessionState']);
          assert.equal(Object.isFrozen(context), true);
          assert.equal(context.readProfessionState(), owner.profession);
          assert.equal(cast.skill, selected);
          const label = `${context.readProfessionState().core.energy.value}:${cast.skill.cooldown}`;
          labels.push(label);
          return label;
        },
        onCastStart(runtime) {
          const core = runtime.profession.core;
          runtime.profession = {
            ...runtime.profession,
            core: { ...core, energy: { ...core.energy, value: core.energy.value - 1 } }
          };
        }
      }
    }),
    {
      id: 'labels-preview',
      label: 'Labels preview',
      professions: { 'execution-test': { skills: { [skillId]: { fields: { cooldown: 2 } } } } }
    }
  );
  const allContexts = new Set();
  for (const patchId of ['current', 'labels-preview', 'current']) {
    const selectedConfig = { ...config, patchId };
    selected = family.runtimeFor(selectedConfig).catalog.skillsById.get(skillId);
    for (const output of ['detailed', 'score', 'damage']) {
      contexts = new Set();
      labels = [];
      const result =
        output === 'damage'
          ? executeDamageOccurrence(family, selectedConfig, occurrence)
          : combat(family, {
              config: selectedConfig,
              output,
              rotation: [
                { type: 'cast', skillId },
                { type: 'cast', skillId }
              ]
            });
      const cooldown = patchId === 'labels-preview' ? 2 : 1;
      assert.deepEqual(labels, output === 'damage' ? [`6:${cooldown}`] : [`10:${cooldown}`, `9:${cooldown}`]);
      assert.equal(contexts.size, 1);
      const context = [...contexts][0];
      assert.equal(allContexts.has(context), false);
      allContexts.add(context);
      if (output !== 'damage') assert.deepEqual(result.warnings, []);
      if (output === 'detailed')
        assert.deepEqual(
          result.steps.map((step) => step.detail),
          labels
        );
    }
  }
});

const skillId = 991001;

// Query families are bound at their actual selection, reservation and application phases, with no engine escape hatch.
test('identity, recharge-anchor and boon-duration policies receive only their declared queries', () => {
  const selections = new Set();
  const anchors = new Set();
  const durations = new Set();
  const reservations = [];
  const family = fixture({
    skill: { cooldown: 1, effects: [{ type: 'boon', boon: 'might', duration: 2, stacks: 1 }] },
    hooks: {
      modifySkillId(context, id) {
        selections.add(context);
        assert.deepEqual(Object.keys(context), ['hasTrait', 'readProfessionState']);
        assert.equal(context.hasTrait('test.trait'), true);
        return id;
      },
      rechargeStart(context, cast, at) {
        anchors.add(context);
        assert.deepEqual(Object.keys(context).sort(), ['requireBalanceProfile', 'time']);
        assert.equal(context.time, cast.start);
        return at + Number(context.requireBalanceProfile('test.proc').maximumStacks);
      },
      boonDuration(context, event, base, scaled) {
        durations.add(context);
        assert.equal(event.kind, 'might');
        assert.equal(base, 2);
        assert.deepEqual(Object.keys(context).sort(), ['hasTrait', 'requireBalanceProfile']);
        return context.hasTrait('test.trait')
          ? scaled * Number(context.requireBalanceProfile('test.proc').maximumStacks)
          : scaled;
      },
      onCastCommit(runtime, cast) {
        reservations.push(cast);
        assert.equal(runtime.cooldownController.rechargeFor(cast.skill.id).startedAt, cast.rechargeStart);
        assert.equal(runtime.cooldownController.rechargeFor(cast.skill.id).work, cast.rechargeWork);
      }
    }
  });
  const result = combat(family, {
    rotation: [
      { type: 'cast', skillId },
      { type: 'cast', skillId }
    ]
  });
  assert.deepEqual(result.warnings, []);
  for (const contexts of [selections, anchors, durations]) {
    assert.equal(contexts.size, 1);
    assert.equal(Object.isFrozen([...contexts][0]), true);
  }

  assert.ok(reservations[1].start > reservations[0].start);
  for (const cast of reservations) assert.equal(cast.rechargeStart, cast.effectiveEnd + 2);
  assert.ok(result.events.some((event) => event.kind === 'might' && event.duration === 4));
});

// The cooldown owner queries one narrow capability in every mode, including initialization and replaced mechanic state.
test('ammunition capacity uses per-run state and selected balance profiles at the cooldown boundary', () => {
  let owner;
  let contexts;
  let states;
  let selected;
  const family = withPatchPreview(
    fixture({
      skill: { ammo: 2, cooldown: 5 },
      hooks: {
        initialize(runtime) {
          owner = runtime;
          runtime.cooldownController.ensureAmmo(selected);
        },
        maximumAmmo(context, skill, maximum) {
          contexts.add(context);
          states.add(context.readProfessionState().core.energy.value);
          assert.equal(skill, selected);
          assert.equal(Object.isFrozen(context), true);
          assert.deepEqual(Object.keys(context).sort(), ['hasTrait', 'readProfessionState', 'requireBalanceProfile']);
          assert.equal(context.readProfessionState(), owner.profession);
          return context.hasTrait('test.trait')
            ? Number(context.requireBalanceProfile('test.proc').maximumStacks)
            : maximum;
        },
        onCastStart(runtime) {
          const core = runtime.profession.core;
          runtime.profession = { ...runtime.profession, core: { ...core, energy: { ...core.energy, value: 9 } } };
          runtime.cooldownController.ensureAmmo(selected);
        }
      }
    }),
    {
      id: 'ammo-preview',
      label: 'Ammo preview',
      professions: { 'execution-test': { balanceProfiles: { 'test.proc': { fields: { maximumStacks: 3 } } } } }
    }
  );
  const previousContexts = new Set();
  for (const patchId of ['current', 'ammo-preview', 'current']) {
    const selectedConfig = { ...config, patchId };
    selected = family.runtimeFor(selectedConfig).catalog.skillsById.get(skillId);
    for (const output of ['detailed', 'score', 'damage']) {
      contexts = new Set();
      states = new Set();
      const result =
        output === 'damage'
          ? executeDamageOccurrence(family, selectedConfig, occurrence)
          : combat(family, { config: selectedConfig, output });
      if (output !== 'damage') assert.deepEqual(result.warnings, []);
      assert.deepEqual(states, new Set([10, 9]));
      assert.equal(owner.cooldownController.readAmmo(skillId).maximum, patchId === 'ammo-preview' ? 3 : 2);
      assert.equal(contexts.size, 1);
      const [context] = contexts;
      assert.equal(previousContexts.has(context), false);
      previousContexts.add(context);
    }
  }
});

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

// The actual callback receives one reusable capability object, with no access to live runtime stores.
test('effect lifetime selection receives only selected-catalog queries', () => {
  const contexts = new Set();
  const profession = fixture({
    hooks: {
      effectOwner(context, event) {
        contexts.add(context);
        assert.deepEqual(Object.keys(context), ['skillFor']);
        assert.equal(context.skillFor(skillId).id, skillId);
        if (event.type === 'damage') return { id: 'fixture-impact', generation: 0 };
        return undefined;
      }
    }
  });
  assert.ok(combat(profession).totalDamage > 0);
  assert.equal(contexts.size, 1);
});

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
          balanceProfiles: [{ id: 'test.proc', name: 'Proc', profileKind: 'trait', maximumStacks: 2, effects: [] }]
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
          might: runtime.combat.timeline.buffStacksAt('might', runtime.time, 0, 25)
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
        assert.equal('effectRecorder' in runtime, false);
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
