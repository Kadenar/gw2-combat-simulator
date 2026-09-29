import assert from 'node:assert/strict';
import test from 'node:test';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { runMesmer } from '#tests/helpers/mesmer-simulation.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';

const config = {
  specialization: 'Core',
  primaryWeapon: 'Sword',
  initialResource: 0,
  stats: { power: 2000, precision: 3000, expertise: 0, concentration: 0 },
  boons: { might: 0, fury: false, quickness: false, alacrity: false, vigor: false },
  target: { armor: 2597, conditions: {} }
};
const simulate = createObservedProfessionSimulator(mesmerProfession, config);
const traitConditions = (result) =>
  result.resolvedEvents.filter((event) => event.type === 'condition' && event.sourceId === TRAIT.RENDING_SHATTER);

// Clone shatters include the player's own shatter, while repeated Split Second hits must not repeat the trait.
test('Rending Shatter counts clone shatter sources once, including control and defensive shatters', () => {
  for (const [specialization, skills] of [
    ['Core', ['Mind Wrack', 'Cry of Frustration', 'Diversion', 'Distortion']],
    ['Chronomancer', ['Split Second', 'Rewinder', 'Time Sink', 'Continuum Split']]
  ]) {
    for (const skill of skills) {
      for (const initialResource of [0, 1, 3]) {
        const result = simulate(specialization, [skill, { type: 'wait', durationMs: 2000 }], {
          initialResource,
          selectedTraitIds: [TRAIT.RENDING_SHATTER]
        });
        assert.deepEqual(result.warnings, [], skill);
        assert.equal(
          traitConditions(result).reduce((sum, event) => sum + event.stacks, 0),
          initialResource + 1,
          skill
        );
        assert.ok(
          traitConditions(result).every((event) => event.duration === 8),
          skill
        );
      }
    }
  }
});

// Blade counts remain independent of combined Dissonance/Distortion packets and extra Requiem pulses.
test('Rending Shatter applies one eight-second Vulnerability stack per blade spent', () => {
  for (const skill of [
    'Bladesong Harmony',
    'Bladesong Sorrow',
    'Bladesong Dissonance',
    'Bladesong Distortion',
    'Bladeturn Requiem'
  ]) {
    for (const initialResource of [1, 5]) {
      const result = simulate('Virtuoso', [skill, { type: 'wait', durationMs: 6500 }], {
        initialResource,
        selectedTraitIds: [TRAIT.RENDING_SHATTER, TRAIT.MASTER_OF_FRAGMENTATION]
      });
      assert.deepEqual(result.warnings, [], skill);
      const conditions = traitConditions(result);
      assert.equal(
        conditions.reduce((sum, event) => sum + event.stacks, 0),
        initialResource,
        skill
      );
      assert.ok(
        conditions.every((event) => event.duration === 8),
        skill
      );
      if (skill === 'Bladesong Harmony') {
        const impacts = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === skill);
        assert.deepEqual(
          conditions.map((event) => event.at),
          impacts.map((event) => event.at)
        );
      }
    }
  }
});

// Targeting and cancellation apply to trait conditions just as they do to the shatter that owns them.
test('Rending Shatter requires selection and an on-target shatter or instrument', () => {
  for (const [rotation, selectedTraitIds] of [
    [['Mind Wrack'], []],
    [[{ name: 'Mind Wrack', offTarget: true }], [TRAIT.RENDING_SHATTER]],
    [['Mind Slash'], [TRAIT.RENDING_SHATTER]],
    [[{ name: 'Bladesong Harmony', interruptAfterMs: 1 }], [TRAIT.RENDING_SHATTER]]
  ]) {
    const result = simulate(rotation[0]?.name === 'Bladesong Harmony' ? 'Virtuoso' : 'Core', rotation, {
      initialResource: 3,
      selectedTraitIds
    });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(traitConditions(result), []);
  }

  const instrument = simulate('Troubadour', ['Flustering Flute'], { selectedTraitIds: [TRAIT.RENDING_SHATTER] });
  assert.deepEqual(instrument.warnings, []);
  assert.deepEqual(
    traitConditions(instrument).map((event) => [event.stacks, event.duration]),
    [[1, 8]]
  );
});

// Non-player critical hits and rejected hits cannot consume the shared ten-second cooldown.
test('Critical Infusion grants scaled Vigor only on player critical hits', () => {
  for (const precision of [1000, 3000]) {
    const result = runMesmer({
      config: {
        ...config,
        selectedTraitIds: [TRAIT.CRITICAL_INFUSION],
        stats: { ...config.stats, precision, concentration: 750 }
      },
      rotation: [{ type: 'wait', durationMs: 12000 }],
      initialize(runtime) {
        for (const [at, overrides] of [
          [0.1, { actorType: 'summon', summonKind: 'clone' }],
          [0.2, { actorType: 'summon', summonKind: 'phantasm' }],
          [0.3, { canCrit: false }],
          [0.4, { offTarget: true }],
          [1, {}],
          [1.1, {}],
          [10.99, {}],
          [11.01, {}]
        ])
          runtime.emit({
            type: 'damage',
            at,
            actorType: 'player',
            source: 'Player',
            sourceId: ID.MIND_SLASH,
            skillId: ID.MIND_SLASH,
            skillName: 'Mind Slash',
            coefficient: 1,
            ...overrides
          });
      }
    });
    assert.deepEqual(result.warnings, []);
    const vigor = result.resolvedEvents.filter(
      (event) => event.type === 'buff' && event.sourceId === TRAIT.CRITICAL_INFUSION
    );
    assert.deepEqual(
      vigor.map((event) => [event.at, event.kind, event.duration]),
      precision === 3000
        ? [
            [1, 'vigor', 7.5],
            [11.01, 'vigor', 7.5]
          ]
        : []
    );
  }
});

// Recharge work changes only for Focus skills and composes with the existing Alacrity rate.
test("Warden's Feedback reduces Focus recharge by twenty percent", () => {
  for (const skill of ['Temporal Curtain', 'Phantasmal Warden', 'Phantasmal Swordsman']) {
    for (const alacrity of [false, true]) {
      const run = (selected) =>
        simulate('Core', [skill], {
          selectedTraitIds: selected ? [TRAIT.WARDENS_FEEDBACK] : [],
          boons: { alacrity },
          secondaryWeapon: skill === 'Phantasmal Swordsman' ? 'Sword' : 'Focus'
        });
      const baseline = run(false);
      const traited = run(true);
      assert.deepEqual(traited.warnings, [], skill);
      const recharge = (result) => {
        const runtime = observedRuntime(result);
        const id = runtime.helpers.skillsByName.get(skill).id;
        return runtime.cooldowns.get(id) - result.steps[0].end / 1000;
      };

      assert.ok(
        Math.abs(recharge(traited) - recharge(baseline) * (skill === 'Phantasmal Swordsman' ? 1 : 0.8)) < 1e-9,
        skill
      );
    }
  }
});

// The same heal grants the selected specialization's resource through its normal capped lifecycle.
test('Ego Restoration creates clones, blades, and notes only from committed combat heals', () => {
  for (const [specialization, resource] of [
    ['Core', 'clones'],
    ['Chronomancer', 'clones'],
    ['Mirage', 'clones'],
    ['Virtuoso', 'blades'],
    ['Troubadour', 'notes']
  ]) {
    for (const [rotation, selected, expected] of [
      [['Ether Feast'], true, 1],
      [['Ether Feast'], false, 0],
      [[{ name: 'Ether Feast', interruptAfterMs: 1 }], true, 0],
      [['Ether Feast', { type: 'combat-start' }], true, 0],
      [['Mind Slash'], true, 0],
      [['Mantra of Recovery', 'Mantra of Recovery'], true, 2]
    ]) {
      const result = simulate(specialization, rotation, { selectedTraitIds: selected ? [TRAIT.EGO_RESTORATION] : [] });
      assert.deepEqual(result.warnings, [], specialization);
      const gains = result.events.filter((event) => event.type === 'resource' && event.amount > 0);
      assert.equal(
        gains.reduce((sum, event) => sum + event.amount, 0),
        expected,
        specialization
      );
      assert.ok(
        gains.every((event) => event.resource === resource),
        specialization
      );
    }
  }

  const tale = simulate('Troubadour', ['Tale of the Second Scion'], { selectedTraitIds: [TRAIT.EGO_RESTORATION] });
  assert.deepEqual(tale.warnings, []);
  assert.equal(tale.procSteps.filter((step) => step.skill === 'Ego Restoration').length, 1);
});
