import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runThief } from '#tests/helpers/thief-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import { createThiefBuildDefaults, validateThiefBuild } from '#gw2/professions/thief/build/build.js';
import { thiefAppAdapter } from '#gw2/professions/thief/app/app-definition.js';
import { resourceDisplayViews } from '#gw2/app/rotation/palette/resource-view.js';

const axeConfig = { primaryWeapon: 'Axe', secondaryWeapon: 'Pistol' };
const returned = (result, type) =>
  result.events.filter((event) => event.type === type && event.metadata?.recallSkillId);

// Axe follows the shared chain contract: alternate on success and reset when another strike skill interrupts it.
test('Spinning Axe alternates and uses normal autoattack chain resets', () => {
  const opener = ID.SPINNING_AXE_ID_71967;
  const followup = ID.SPINNING_AXE;
  for (const [rotation, next] of [
    [[opener], followup],
    [[opener, followup], opener],
    [[opener, ID.VENOMOUS_VOLLEY], opener],
    [[opener, ID.STEAL], followup],
    [[opener, { type: 'cast', skillId: followup, interruptAfterMs: 1 }], followup]
  ]) {
    const result = runThief(rotation, axeConfig);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.autoattackChains[opener] ?? opener, next);
  }
});

// Revealed Training excludes the initial stealth attack, but includes its later return only while Revealed lasts.
test('recalled Salvo receives live Revealed Training power without empowering the revealing hit', () => {
  for (const [specialization, skillId] of [
    ['Core', ID.CUNNING_SALVO],
    ['Deadeye', ID.MALICIOUS_CUNNING_SALVO]
  ]) {
    for (const expireRevealed of [false, true]) {
      const rotation = [
        skillId,
        ...(expireRevealed ? [{ type: 'wait', durationMs: 4000 }] : []),
        ID.ORCHESTRATED_ASSAULT,
        { type: 'wait', durationMs: 1000 }
      ];
      const simulate = (selectedTraitIds) =>
        runThief(
          rotation,
          {
            ...axeConfig,
            specialization,
            selectedTraitIds,
            attributeInputs: baseAttributeInputs({ power: 2000, precision: 1000, criticalChanceBonus: -100 })
          },
          {
            initialize(runtime) {
              runtime.profession.core.stealthUntil = 10;
            }
          }
        );
      const baseline = simulate([]);
      const traited = simulate([TRAIT.REVEALED_TRAINING]);
      assert.deepEqual(baseline.warnings, []);
      assert.deepEqual(traited.warnings, []);
      const hits = (result, recall) =>
        result.resolvedEvents.find(
          (event) =>
            event.type === 'damage' && event.skillId === skillId && Boolean(event.metadata?.recallSkillId) === recall
        );
      assertFlooredDamageMultiplier(hits(traited, false).damage, hits(baseline, false).damage, 2080 / 2000);
      assertFlooredDamageMultiplier(
        hits(traited, true).damage,
        hits(baseline, true).damage,
        (expireRevealed ? 2080 : 2200) / 2000
      );
    }
  }
});

// Recall can intercept an outgoing axe without replacing a ground slot or later resurrecting that projectile.
test('recall consumes grounded and outbound axes once; landing alone enforces the shared cap', () => {
  for (const waitForLanding of [false, true]) {
    const result = runThief(
      [
        ID.MALICIOUS_CUNNING_SALVO,
        ...(waitForLanding ? [{ type: 'wait', durationMs: 1000 }] : []),
        ID.ORCHESTRATED_ASSAULT,
        { type: 'wait', durationMs: 1500 }
      ],
      { ...axeConfig, specialization: 'Deadeye' },
      {
        initialize(runtime) {
          runtime.profession.core.stealthUntil = 10;
          runtime.profession.core.spinningAxes = Array.from({ length: 6 }, () => ({
            skillId: ID.VENOMOUS_VOLLEY,
            expiresAt: 10
          }));
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const hits = returned(result, 'damage');
    assert.equal(hits.filter((event) => event.skillId === ID.VENOMOUS_VOLLEY).length, waitForLanding ? 5 : 6);
    assert.equal(hits.filter((event) => event.skillId === ID.MALICIOUS_CUNNING_SALVO).length, 1);
    assert.deepEqual(observedRuntime(result).profession.core.spinningAxes, []);
    assert.deepEqual(observedRuntime(result).profession.core.outboundAxes, []);
  }
});

// Return damage is queued independently, so a following throw builds the next pool instead of replacing returns.
test('a new Volley cannot replace recalled axes still travelling back', () => {
  let duringReturn;
  const result = runThief(
    [ID.ORCHESTRATED_ASSAULT, ID.VENOMOUS_VOLLEY, { type: 'wait', durationMs: 1500 }],
    { ...axeConfig, initialSpinningAxes: 6 },
    {
      probes: [
        [
          0.6,
          (runtime) => {
            duringReturn = runtime.profession.core.spinningAxes.length;
          }
        ]
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(duringReturn, 0);
  assert.equal(returned(result, 'damage').length, 6);
  assert.ok(returned(result, 'damage').every((event) => event.at > 0.6));
  assert.deepEqual(
    observedRuntime(result).profession.core.spinningAxes.map((axe) => axe.skillId),
    Array(3).fill(ID.VENOMOUS_VOLLEY)
  );
  assert.deepEqual(observedRuntime(result).profession.core.outboundAxes, []);
});

// Saved starting axes must reach both the starting-resource control and the first recall without casting an opener.
test('precast autoattack axes survive build loading and initialize a recallable pool', () => {
  const saved = {
    ...createThiefBuildDefaults(),
    weapons: ['Axe', 'Pistol'],
    initialSpinningAxes: 4,
    initialInitiative: 7
  };
  assert.equal(validateThiefBuild(saved).valid, true);
  const build = thiefAppAdapter.toApplicationBuild(JSON.parse(JSON.stringify(saved)));
  const profession = thiefAppAdapter.profession;
  const app = {
    build,
    adapter: thiefAppAdapter,
    profession,
    skillByName: profession.catalog.skillsByName,
    skillById: profession.catalog.skillsById,
    attributeWeaponSet: 1
  };
  thiefAppAdapter.recalculate(app);
  const config = thiefAppAdapter.simulationConfig(app);
  assert.equal(config.initialSpinningAxes, 4);
  const initial = runThief([], config);
  const core = observedRuntime(initial).profession.core;
  assert.equal(core.initiative.value, 7);
  assert.deepEqual(core.spinningAxes, Array(4).fill({ skillId: ID.SPINNING_AXE, expiresAt: Infinity }));
  assert.equal(initial.events.filter((event) => event.type === 'damage').length, 0);
  const control = resourceDisplayViews(profession, {
    build,
    config,
    professionState: initial.planningState.profession
  }).find((view) => view.id === 'spinning-axes');
  assert.equal(control.buildKey, 'initialSpinningAxes');
  assert.equal(control.maximum, 6);
  assert.equal(control.canStart, true);
  assert.equal(control.value, 4);

  const recalled = runThief(['Orchestrated Assault', { type: 'wait', durationMs: 1000 }], config);
  assert.deepEqual(recalled.warnings, []);
  assert.equal(returned(recalled, 'damage').length, 4);
  assert.deepEqual(observedRuntime(recalled).profession.core.spinningAxes, []);
  const expired = runThief(
    [{ type: 'combat-start' }, { type: 'wait', durationMs: 10000 }, 'Orchestrated Assault'],
    config
  );
  assert.equal(returned(expired, 'damage').length, 0);
});

// Opener waits never age starting or newly thrown axes; only combat entry starts their expiry clock.
test('starting and precombat axes survive long setup and expire ten seconds into combat', () => {
  for (const precast of [false, true]) {
    const setup = [
      ...(precast ? [{ type: 'cast', skillId: ID.VENOMOUS_VOLLEY, offTarget: true }] : []),
      { type: 'wait', durationMs: 30000 },
      { type: 'combat-start' }
    ];
    const config = { ...axeConfig, initialSpinningAxes: precast ? 0 : 3 };
    const live = runThief([...setup, ID.ORCHESTRATED_ASSAULT, { type: 'wait', durationMs: 1000 }], config);
    assert.deepEqual(live.warnings, []);
    assert.equal(returned(live, 'damage').length, 3);
    assert.ok(
      returned(live, 'damage').every((event) => event.skillId === (precast ? ID.VENOMOUS_VOLLEY : ID.SPINNING_AXE))
    );
    assert.equal(
      live.resolvedEvents.filter((event) => event.type === 'damage' && !event.metadata?.recallSkillId).length,
      0
    );
    const expired = runThief([...setup, { type: 'wait', durationMs: 10000 }, ID.ORCHESTRATED_ASSAULT], config);
    assert.deepEqual(expired.warnings, []);
    assert.equal(returned(expired, 'damage').length, 0);
  }
});

test('starting axes default to zero and accept only whole counts within the shared cap', () => {
  const defaults = createThiefBuildDefaults();
  assert.equal(defaults.initialSpinningAxes, 0);
  for (const initialSpinningAxes of [-1, 1.5, 7]) {
    assert.equal(validateThiefBuild({ ...defaults, initialSpinningAxes }).valid, false);
  }

  for (const [initialSpinningAxes, count] of [
    [undefined, 0],
    [-1, 0],
    [2.9, 2],
    [99, 6],
    [NaN, 0]
  ]) {
    const result = runThief([], { ...axeConfig, initialSpinningAxes });
    assert.equal(observedRuntime(result).profession.core.spinningAxes.length, count);
  }
});

// Replacement is shared across axe types and never refreshes a protected axe's lifetime.
test('the shared six-axe pool protects Salvo and Volley axes from lower-priority throws', () => {
  for (const [specialization, salvo] of [
    ['Core', ID.CUNNING_SALVO],
    ['Deadeye', ID.MALICIOUS_CUNNING_SALVO]
  ]) {
    const protectedIds = [salvo, ID.VENOMOUS_VOLLEY, salvo, ID.VENOMOUS_VOLLEY, salvo, ID.VENOMOUS_VOLLEY];
    const mixedIds = [salvo, ID.VENOMOUS_VOLLEY, ID.SPINNING_AXE, ID.SPINNING_AXE_ID_71967, salvo, ID.VENOMOUS_VOLLEY];
    for (const [skillId, poolIds, retainedIndices, added] of [
      [ID.SPINNING_AXE, protectedIds, [0, 1, 2, 3, 4, 5], 0],
      [ID.SPINNING_AXE_ID_71967, protectedIds, [0, 1, 2, 3, 4, 5], 0],
      [ID.SPINNING_AXE, mixedIds, [0, 1, 3, 4, 5], 1],
      [ID.SPINNING_AXE_ID_71967, mixedIds, [0, 1, 3, 4, 5], 1],
      [ID.VENOMOUS_VOLLEY, mixedIds, [0, 4, 5], 3],
      [ID.VENOMOUS_VOLLEY, protectedIds, [0, 2, 4], 3],
      [ID.VENOMOUS_VOLLEY, Array(6).fill(salvo), [0, 1, 2, 3, 4, 5], 0],
      [ID.VENOMOUS_VOLLEY, [...Array(5).fill(salvo), ID.SPINNING_AXE], [0, 1, 2, 3, 4], 1],
      [salvo, protectedIds, [0, 2, 3, 4, 5], 1],
      [salvo, protectedIds.toReversed(), [1, 2, 3, 4, 5], 1],
      [salvo, mixedIds, [0, 1, 3, 4, 5], 1],
      [salvo, Array(6).fill(ID.SPINNING_AXE), [1, 2, 3, 4, 5], 1]
    ]) {
      const prior = Object.freeze(poolIds.map((id, index) => Object.freeze({ skillId: id, expiresAt: 10 + index })));
      const result = runThief(
        [skillId, { type: 'wait', durationMs: 1000 }],
        { ...axeConfig, specialization },
        {
          initialize(runtime) {
            runtime.profession.core.spinningAxes = prior;
            // Isolate each replacement formula with its tested autoattack stage already available.
            if (skillId === ID.SPINNING_AXE)
              runtime.profession.core.autoattackChains[ID.SPINNING_AXE_ID_71967] = skillId;
            if (skillId === salvo) runtime.profession.core.stealthUntil = 10;
          }
        }
      );
      assert.deepEqual(result.warnings, []);
      const runtime = observedRuntime(result);
      const axes = runtime.profession.core.spinningAxes;
      assert.deepEqual(
        axes.slice(0, retainedIndices.length),
        retainedIndices.map((index) => prior[index])
      );
      assert.deepEqual(
        axes.slice(retainedIndices.length).map((axe) => axe.skillId),
        Array(added).fill(skillId)
      );
      assert.ok(
        axes
          .slice(retainedIndices.length)
          .every((axe) => axe.expiresAt > runtime.time && axe.expiresAt <= runtime.time + 10)
      );
      assert.equal(prior.length, 6);
    }
  }
});

test('an expired protected axe frees a slot for an autoattack before replacement is considered', () => {
  const result = runThief([ID.SPINNING_AXE_ID_71967, { type: 'wait', durationMs: 1000 }], axeConfig, {
    initialize(runtime) {
      runtime.profession.core.spinningAxes = Array.from({ length: 6 }, (_, index) => ({
        skillId: ID.VENOMOUS_VOLLEY,
        expiresAt: index === 0 ? 0 : 10
      }));
    }
  });
  assert.deepEqual(result.warnings, []);
  const axes = observedRuntime(result).profession.core.spinningAxes;
  assert.equal(axes.length, 6);
  assert.equal(axes.at(-1).skillId, ID.SPINNING_AXE_ID_71967);
});

// Small scenarios verify projectile formulas and live pool transitions independently of the supplied benchmark.
test('Volley divides its coefficient across three poisonous axes and recall repeats each projectile once', () => {
  const result = runThief(['Venomous Volley', 'Orchestrated Assault', { type: 'wait', durationMs: 1000 }], axeConfig);
  assert.deepEqual(result.warnings, []);
  const outgoing = result.events.filter((event) => event.type === 'damage' && !event.metadata?.recallSkillId);
  assert.equal(outgoing.length, 3);
  assert.ok(outgoing.every((event) => Math.abs(event.coefficient - 0.4) < 1e-12));
  assert.equal(returned(result, 'damage').length, 3);
  assert.ok(returned(result, 'damage').every((event) => Math.abs(event.coefficient - 0.4 * 1.33) < 1e-12));
  assert.deepEqual(
    returned(result, 'condition').map(({ condition, stacks, duration }) => [condition, stacks, duration]),
    Array(3).fill(['Poisoned', 1, 2])
  );
  assert.deepEqual(observedRuntime(result).profession.core.spinningAxes, []);
  assert.equal(result.events.filter((event) => event.type === 'condition' && event.condition === 'Weakness').length, 3);
});

test('recall excludes expired axes, preserves axe identity, and immobilizes once after five returns', () => {
  for (const [secondaryWeapon, recall, multiplier, extraCondition] of [
    ['Pistol', 'Orchestrated Assault', 1.33, 'Weakness'],
    ['', 'Recall Axes', 1.33, 'Weakness'],
    ['Dagger', 'Harrowing Storm', 1, 'Torment']
  ]) {
    const result = runThief(
      [recall, { type: 'wait', durationMs: 1000 }],
      { ...axeConfig, secondaryWeapon },
      {
        initialize(runtime) {
          runtime.profession.core.spinningAxes = [
            { skillId: ID.MALICIOUS_CUNNING_SALVO, expiresAt: 0 },
            ...Array.from({ length: 6 }, () => ({ skillId: ID.SPINNING_AXE, expiresAt: 10 }))
          ];
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(returned(result, 'damage').length, 6);
    assert.ok(returned(result, 'damage').every((event) => Math.abs(event.coefficient - 0.8 * multiplier) < 1e-12));
    assert.equal(
      result.events.filter((event) => event.type === 'condition' && event.condition === extraCondition).length,
      6
    );
    assert.equal(
      result.events.filter((event) => event.type === 'condition' && event.condition === 'Immobilized').length,
      1
    );
  }

  const empty = runThief(['Orchestrated Assault'], axeConfig);
  assert.equal(empty.events.filter((event) => ['damage', 'condition'].includes(event.type)).length, 0);
});

test('Salvo refunds on impact and recalled malicious axes use base poison without consuming malice', () => {
  for (const [specialization, skillId] of [
    ['Core', ID.CUNNING_SALVO],
    ['Deadeye', ID.MALICIOUS_CUNNING_SALVO]
  ]) {
    const result = runThief(
      [skillId],
      { ...axeConfig, specialization, initialInitiative: 0, boons: { alacrity: true } },
      {
        initialize(runtime) {
          runtime.profession.core.stealthUntil = 10;
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.ok(observedRuntime(result).resourceController.value('initiative') >= 2);
    const runtime = observedRuntime(result);
    assert.ok(Math.abs(runtime.cooldownController.readyAt(skillId) - runtime.time - 1) < 1e-9);
    const miss = runThief(
      [{ skillId, offTarget: true }],
      { ...axeConfig, specialization, initialInitiative: 0 },
      {
        initialize(runtime) {
          runtime.profession.core.stealthUntil = 10;
        }
      }
    );
    assert.deepEqual(miss.warnings, []);
    assert.ok(observedRuntime(miss).resourceController.value('initiative') < 2);
  }

  const result = runThief(
    ['Orchestrated Assault', { type: 'wait', durationMs: 1000 }],
    { ...axeConfig, specialization: 'Deadeye', initialInitiative: 4 },
    {
      initialize(runtime) {
        runtime.profession.core.spinningAxes = [{ skillId: ID.MALICIOUS_CUNNING_SALVO, expiresAt: 10 }];
        runtime.resourceController.replace('malice', 4);
        Object.assign(runtime.profession.specialization.state, {
          markedTargetId: 'primary-target',
          markExpiresAt: 30
        });
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(returned(result, 'condition').find((event) => event.condition === 'Poisoned').duration, 1);
  assert.equal(observedRuntime(result).profession.specialization.state.malice.value, 5);
  assert.ok(observedRuntime(result).resourceController.value('initiative') >= 2);
});

test('outgoing malicious poison lasts exactly the consumed malice and is absent without a mark', () => {
  for (const marked of [false, true]) {
    const result = runThief(
      [ID.MALICIOUS_CUNNING_SALVO],
      { ...axeConfig, specialization: 'Deadeye' },
      {
        initialize(runtime) {
          runtime.profession.core.stealthUntil = 10;
          runtime.resourceController.replace('malice', 4);
          Object.assign(runtime.profession.specialization.state, {
            markedTargetId: marked ? 'primary-target' : null,
            markExpiresAt: 30
          });
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const poison = result.events.find((event) => event.type === 'condition' && event.condition === 'Poisoned');
    assert.equal(poison?.duration, marked ? 4 : undefined);
  }
});
