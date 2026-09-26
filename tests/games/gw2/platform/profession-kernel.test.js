import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { followUpOf, weaponFlipBlock, weaponFollowUpOpen } from '#gw2/platform/engine/skills/skill-flips.js';
import { skillCostAvailability } from '#gw2/platform/execution/skill-cost.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { testProfession } from '#tests/fixtures/profession.js';
import { compileProfessionRules } from '#gw2/platform/profession-definition/trigger-rules.js';
import { applySkillPatch, applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { skillAuthoringReference } from '#gw2/integrations/patches/authoring/fields.js';

// Shared runtime contracts that profession mechanics build on: procedural emission, follow-up windows, declared
// costs, and authored skill tasks. Each scenario uses a minimal fixture profession rather than a saved rotation.
const catalog = createCanonicalCatalog({
  generated: [
    { id: 991001, name: 'Trigger', castTimeMs: 0, effects: [] },
    {
      id: 991002,
      name: 'Paid On Start',
      castTimeMs: 1000,
      resourceCost: 3,
      cost: { resource: 'energy' },
      effects: []
    },
    {
      id: 991003,
      name: 'Paid On Commit',
      castTimeMs: 1000,
      interruptCommitMs: 500,
      resourceCost: 4,
      cost: { resource: 'energy', spendOn: 'castCommit' },
      effects: []
    },
    {
      id: 991004,
      name: 'Tasked',
      castTimeMs: 1000,
      interruptCommitMs: 200,
      tasks: [
        { type: 'test.record-task', timingAnchor: 'castComplete' },
        { type: 'test.record-task', atMs: 500, timingAnchor: 'castEnd' }
      ],
      effects: []
    },
    {
      id: 991005,
      name: 'Rewards',
      castTimeMs: 1000,
      interruptCommitMs: 200,
      sideEffects: [
        { on: 'castStart', do: { type: 'resourceGrant', resource: 'energy', amount: 1 } },
        { on: 'castCommit', do: { type: 'resourceGrant', resource: 'energy', amount: 2 } },
        {
          on: 'castComplete',
          do: { type: 'resourceGrant', resource: 'energy', amount: { profile: 'test.proc', field: 'resourceGain' } }
        }
      ],
      effects: []
    },
    {
      id: 991006,
      name: 'Restore',
      castTimeMs: 0,
      sideEffects: [
        { on: 'castComplete', do: { type: 'rechargeReset', skillIds: [991007] } },
        { on: 'castComplete', do: { type: 'ammoRestore', skillIds: [991007], count: 1 } },
        { on: 'castComplete', do: { type: 'flipArm', skillId: 'flip', durationSec: 1 } },
        { on: 'castComplete', do: { type: 'emitProfile', profileId: 'test.proc' } }
      ],
      effects: []
    },
    { id: 991007, name: 'Ammo', castTimeMs: 0, ammo: 2, ammoRecharge: 10, cooldown: 10, effects: [] },
    {
      id: 991008,
      name: 'Variant',
      castTimeMs: 1000,
      cooldown: 0,
      effectVariants: [{ when: (runtime) => runtime.profession.selected, profileId: 'test.variant' }],
      effects: [{ type: 'custom', eventType: 'test.default', event: {} }]
    },
    { id: 991009, name: 'Recharge', castTimeMs: 0, cooldown: 10, weapon: 'Sword', effects: [] }
  ],
  balanceProfiles: [
    {
      id: 'test.proc',
      name: 'Test Proc',
      profileKind: 'trait',
      internalCooldown: 2,
      resourceGain: 3,
      rechargeMultiplier: 0.5,
      effects: [{ type: 'boon', boon: 'might', stacks: 1, duration: 3 }]
    },
    { id: 'test.other', name: 'Other Proc', profileKind: 'trait', internalCooldown: 2, effects: [] },
    {
      id: 'test.variant',
      name: 'Selected Variant',
      profileKind: 'skill-variant',
      effects: [
        { type: 'custom', eventType: 'test.selected', event: {}, when: (runtime) => runtime.profession.selected },
        { type: 'custom', eventType: 'test.excluded', event: {}, when: () => false }
      ]
    }
  ]
});
const config = {
  stats: { power: 1000, precision: 1000, ferocity: 0, conditionDamage: 0, expertise: 0 },
  target: { armor: 1000, health: 0, conditions: {} },
  randomness: { mode: 'expected', seed: 123 },
  selectedTraitIds: ['test.trait']
};
const cast = (skillId, extra = {}) => ({ type: 'cast', skillId, ...extra });
const wait = (durationMs) => ({ type: 'wait', durationMs });

function fixture(hooks = {}) {
  return {
    ...Object.fromEntries(
      [
        'modifyAttributes',
        'modifyCriticalChance',
        'modifyCriticalDamage',
        'modifyStrikeDamage',
        'modifyConditionDamage',
        'modifyConditionDuration',
        'modifyConditionBaseDuration'
      ].map((key) => [key, testProfession[key]])
    ),
    id: 'kernel-fixture',
    catalog,
    createState: () => ({
      core: { availableFlips: {} },
      energy: { value: 0, maximum: 10, updatedAt: 0, rate: 0 },
      log: []
    }),
    resources: {
      energy: {
        kind: 'continuous',
        state: (runtime) => runtime.profession.energy,
        maximum: () => 10,
        initial: () => 10,
        recovery: () => 0
      }
    },
    eventHandlers: Object.fromEntries(
      ['test.default', 'test.selected', 'test.excluded'].map((type) => [type, () => {}])
    ),
    ...compileProfessionRules(hooks),
    tasks: { 'test.check': (runtime, index) => checks[index](runtime), ...hooks.tasks }
  };
}

let checks = [];
function run(hooks, rotation, scheduled = []) {
  checks = scheduled.map((entry) => entry.run);
  return runGw2Runtime({
    profession: fixture({
      ...hooks,
      initialize(runtime) {
        hooks.initialize?.(runtime);
        for (const [index, entry] of scheduled.entries()) runtime.schedule('test.check', entry.at, index);
      }
    }),
    config,
    rotation
  });
}

test('procedural buffs wait for their own instant and owner-bound packets cancel with their owner', () => {
  const returned = [];
  const result = run(
    {
      onCastStart(runtime) {
        const base = { source: 'fixture', sourceId: 'proc', actorType: 'player' };
        returned.push(runtime.emitProcedural({ ...base, type: 'buff', at: 0, kind: 'might', stacks: 1, duration: 5 }));
        returned.push(runtime.emitProcedural({ ...base, type: 'buff', at: 2, kind: 'fury', stacks: 1, duration: 5 }));
        const owner = { id: 'fixture.owner', generation: 0 };
        returned.push(
          runtime.emitProcedural({ ...base, type: 'damage', at: 3, coefficient: 1, skillWeapon: '' }, { owner })
        );
        runtime.cancelOwner(owner);
      }
    },
    [cast(991001), wait(5000)]
  );
  assert.equal(returned[0].kind, 'might');
  assert.deepEqual(returned.slice(1), [null, null]);
  assert.deepEqual(
    result.events.filter((event) => event.sourceId === 'proc').map((event) => [event.type, event.at, event.kind]),
    [
      ['buff', 0, 'might'],
      ['buff', 2, 'fury']
    ]
  );
});

test('a follow-up window retires at its own deadline while a later rearm survives it', () => {
  const observed = [];
  run(
    {
      onCastStart(runtime) {
        runtime.armFlip('follow-up', { expiresAt: runtime.time + 2 });
      }
    },
    [cast(991001), wait(1000), cast(991001), wait(4000)],
    [
      { at: 2.5, run: (runtime) => observed.push(runtime.profession.core.availableFlips['follow-up']?.expiresAt) },
      { at: 3.5, run: (runtime) => observed.push(runtime.profession.core.availableFlips['follow-up']) }
    ]
  );
  assert.deepEqual(observed, [3, undefined]);
});

test('declared costs are paid on acceptance, or only by activations that pass their commit point', () => {
  const energy = [];
  run(
    {},
    [cast(991002), cast(991003, { interruptAfterMs: 100 }), cast(991003), wait(500)],
    [
      { at: 0.5, run: (runtime) => energy.push(runtime.resourceController.value('energy')) },
      { at: 2.2, run: (runtime) => energy.push(runtime.resourceController.value('energy')) }
    ]
  );
  // The interrupted activation stopped before its commit point, so only the completed one paid.
  assert.deepEqual(energy, [7, 3]);
});

test('an unaffordable declared cost waits for regeneration or rejects when no regeneration can cover it', () => {
  const skill = { name: 'Dodge', resourceCost: 50, cost: { resource: 'endurance' } };
  const runtime = (readyAt) => ({ time: 1, endurance: { readyAt: () => readyAt } });
  assert.equal(skillCostAvailability(runtime(1), skill), null);
  assert.deepEqual(skillCostAvailability(runtime(4), skill), {
    ready: false,
    retryAt: 4,
    code: 'gw2.insufficient-endurance',
    reason: 'Dodge is unavailable — requires 50 endurance.'
  });
  assert.equal(skillCostAvailability(runtime(null), skill).retryAt, null);
});

test('committed activations schedule their authored tasks after completion owners run', () => {
  const log = [];
  run(
    {
      onCastComplete: (runtime, activation) => log.push(['complete', runtime.time, activation.skill.name]),
      tasks: {
        'test.record-task': (runtime, data) => log.push(['task', runtime.time, data.cast.skill.name, data.trigger.atMs])
      }
    },
    // The first activation commits before its interruption; the second is cancelled before its commit point.
    [cast(991004, { interruptAfterMs: 800 }), cast(991004, { interruptAfterMs: 100 }), wait(2000)]
  );
  assert.deepEqual(log, [
    ['complete', 0.8, 'Tasked'],
    ['task', 0.8, 'Tasked', undefined],
    ['complete', 0.9, 'Tasked'],
    ['task', 1.5, 'Tasked', 500]
  ]);
});

test('the weapon follow-up rule hides a parent behind its open window and gates a closed follow-up', () => {
  const parent = { id: 1, name: 'Opener', type: 'Weapon', flipSkillId: 2 };
  const followUp = { id: 2, name: 'Follow-Up', type: 'Weapon', flipParentId: 1 };
  const chained = { id: 3, name: 'Chain', type: 'Weapon', flipSkillId: 4, nextChainId: 4 };
  const skillsById = new Map([parent, followUp, chained].map((skill) => [skill.id, skill]));
  const open = { 2: { identity: 1, visibleAt: 0, availableAt: 0, expiresAt: 5 } };

  assert.equal(followUpOf(skillsById, parent), followUp);
  assert.equal(followUpOf(skillsById, chained), undefined);
  assert.deepEqual(weaponFlipBlock({}, skillsById, followUp, 1), { kind: 'closed', parent });
  assert.equal(weaponFlipBlock(open, skillsById, followUp, 1), null);
  assert.deepEqual(weaponFlipBlock(open, skillsById, parent, 1), { kind: 'open' });
  assert.equal(weaponFollowUpOpen(open, parent, 5), false);
});

// Minimal activations distinguish acceptance, commitment, and full completion without asserting cast tuning.
test('side effects preserve phase gates and resolve profile amounts from the selected catalog', () => {
  for (const [interruptAfterMs, expected] of [
    [100, 1],
    [500, 3],
    [undefined, 7]
  ]) {
    const energy = [];
    const patched = applyBalanceProfilePatch(catalog, {
      balanceProfiles: { 'test.proc': { fields: { resourceGain: 4 } } }
    });
    run(
      {
        catalog: patched,
        initialize: (runtime) => runtime.resourceController.spend('energy', 10),
        onCastComplete: (runtime) => energy.push(runtime.resourceController.value('energy'))
      },
      [cast(991005, { interruptAfterMs })]
    );
    assert.deepEqual(energy, [expected]);
  }
});

test('declared reset, ammo, flip, and profile effects settle before completion hooks', () => {
  const observed = [];
  const result = run(
    {
      onCastComplete(runtime, activation) {
        if (activation.skill.id === 991006)
          observed.push([
            runtime.ammo.get(991007).charges,
            runtime.cooldowns.get(991007),
            runtime.profession.core.availableFlips.flip.expiresAt
          ]);
      }
    },
    [cast(991007), cast(991006), wait(1500)],
    [{ at: 1.1, run: (runtime) => observed.push(runtime.profession.core.availableFlips.flip) }]
  );
  assert.deepEqual(observed, [[2, undefined, 1], undefined]);
  assert.equal(result.events.filter((event) => event.sourceId === 'test.proc' && event.kind === 'might').length, 1);
});

test('proc claims share a profile deadline, isolate profiles and runs, and retain exclusive readiness', () => {
  const claims = [];
  const hooks = {
    onCastStart(runtime) {
      claims.push([
        runtime.procs.claim('test.proc'),
        runtime.procs.claim('test.proc'),
        runtime.procs.claim('test.other')
      ]);
    }
  };
  run(hooks, [cast(991001), wait(2000), cast(991001), wait(1), cast(991001)]);
  run(hooks, [cast(991001)]);
  assert.deepEqual(claims, [
    [true, false, true],
    [false, false, false],
    [true, false, true],
    [true, false, true]
  ]);
});

test('recharge rules compose with hooks and trait triggers claim before emitting in declaration order', () => {
  const observations = [];
  const result = run(
    {
      rechargeRules: [
        {
          trait: 'test.trait',
          when: (_runtime, skill) => skill.weapon === 'Sword',
          multiplier: { profile: 'test.proc', field: 'rechargeMultiplier' }
        }
      ],
      rechargeWork: (_runtime, _skill, work) => work - 1,
      traitTriggers: [
        {
          trait: 'test.trait',
          on: 'castComplete',
          when: () => true,
          emit: 'test.proc',
          icd: 'profile',
          attribution: { name: 'first' }
        },
        {
          trait: 'test.trait',
          on: 'castComplete',
          when: () => true,
          emit: 'test.proc',
          icd: 'profile',
          attribution: { name: 'suppressed' }
        }
      ],
      onCastComplete(runtime, activation) {
        observations.push([activation.rechargeWork, runtime.procs.readyAt['test.proc']]);
      }
    },
    [cast(991009), wait(1000)]
  );
  assert.deepEqual(observations, [[4, 2]]);
  assert.deepEqual(
    result.events.filter((event) => event.sourceId === 'test.trait').map((event) => event.name),
    ['first']
  );
});

test('patched variants retain executable predicates and snapshot eligibility before later state changes', () => {
  const patched = applySkillPatch(catalog, { skills: { 991008: { fields: { cooldown: 2 } } } });
  assert.equal(
    patched.skillsById.get(991008).effectVariants[0].when,
    catalog.skillsById.get(991008).effectVariants[0].when
  );
  assert.equal(skillAuthoringReference(patched.skillsById.get(991008)).effectVariants, undefined);
  const result = run(
    {
      catalog: patched,
      initialize(runtime) {
        runtime.profession.selected = true;
      }
    },
    [cast(991008)],
    [
      {
        at: 0.5,
        run(runtime) {
          runtime.profession.selected = false;
        }
      }
    ]
  );
  assert.deepEqual(
    result.events.filter((event) => event.type.startsWith('test.')).map((event) => event.type),
    ['test.selected']
  );
  assert.throws(
    () =>
      createCanonicalCatalog({
        generated: [
          { id: 1, name: 'Invalid', castTimeMs: 0, effects: [{ type: 'boon', boon: 'might', duration: 1, when: true }] }
        ]
      }),
    /predicate/
  );
});
