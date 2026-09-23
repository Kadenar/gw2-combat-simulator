import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';

const wait = (waitMs) => ({ name: '__wait', waitMs });
const config = (overrides = {}) =>
  defaultSimulationConfig({
    specialization: 'Mirage',
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Focus',
    selectedTraitIds: [],
    initialResource: 0,
    selectedSkills: ['Mirage Advance', 'Crystal Sands', 'Jaunt'],
    ...overrides
  });
const procs = (result, name) => result.procSteps.filter((proc) => proc.skill === name);

// The actual debuff must exist without equipment, and blind consumers must observe it only once.
test('Mirage Advance applies one blind and disable at impact, with no invented interrupt', () => {
  for (const offTarget of [false, true]) {
    const result = simulateMesmer(
      [{ name: 'Mirage Advance', offTarget }, wait(1000)],
      config({
        selectedTraitIds: [TRAIT.INEPTITUDE, TRAIT.DAZZLING],
        relic: 'Aristocracy',
        target: { activatingSkills: false }
      })
    );
    const cast = result.events.find((event) => event.type === 'action');
    const blind = result.resolvedEvents.filter((event) => event.type === 'condition' && event.condition === 'Blinded');
    assert.equal(blind.length, offTarget ? 0 : 1);
    assert.equal(procs(result, 'Ineptitude').length, offTarget ? 0 : 1);
    assert.equal(procs(result, 'Relic of Aristocracy').length, offTarget ? 0 : 1);
    if (offTarget) continue;
    assert.equal(blind[0].duration, 5);
    assert.equal(blind[0].stacks, 1);
    assert.equal(blind[0].at, cast.endsAt);
    const dazzling = result.events.find((event) => event.type === 'condition' && event.sourceId === TRAIT.DAZZLING);
    assert.equal(dazzling.stacks, 5);
    assert.equal(dazzling.duration, 8);
    assert.equal(dazzling.actorType, 'effect');
    assert.equal(dazzling.ownerActorType, 'player');
    assert.equal(dazzling.activationId, cast.activationId);
  }

  const bare = simulateMesmer(['Mirage Advance', wait(1000)], config());
  assert.equal(bare.resolvedEvents.filter((event) => event.condition === 'Blinded').length, 1);
});

test('cancelled Mirage casts create neither hostile effects nor movement procs', () => {
  for (const name of ['Mirage Advance', 'Crystal Sands']) {
    const result = simulateMesmer([{ name, interruptMs: 100 }, wait(1500)], config({ relic: 'Peitha' }));
    assert.ok(result.events.find((event) => event.type === 'action').cancelled);
    assert.equal(result.events.filter((event) => ['peitha', 'control', 'condition'].includes(event.type)).length, 0);
    assert.equal(procs(result, 'Relic of Peitha').length, 0);
  }
});

test('mirror creation and pickup have separate state and effect requirements', () => {
  const settings = config({ relic: 'Aristocracy' });
  const created = simulateMesmer(['Crystal Sands', wait(1500)], settings);
  const picked = simulateMesmer(['Crystal Sands', 'Pick Up Mirage Mirror', wait(500)], settings);
  assert.equal(created.events.filter((event) => event.condition === 'Weakness').length, 0);
  assert.equal(procs(created, 'Relic of Aristocracy').length, 0);
  const weakness = picked.events.filter((event) => event.condition === 'Weakness');
  assert.equal(weakness.length, 1);
  assert.equal(weakness[0].duration, 4);
  assert.equal(weakness[0].stacks, 1);
  assert.equal(picked.planningState.profession.availableMirrors, 0);
  assert.equal(procs(picked, 'Relic of Aristocracy').length, 1);
  const missing = simulateMesmer(['Pick Up Mirage Mirror'], settings);
  assert.equal(missing.events.filter((event) => event.condition === 'Weakness').length, 0);
  assert.equal(procs(missing, 'Relic of Aristocracy').length, 0);
});

test('Rain of Swords conditions and Aristocracy follow surviving pulses', () => {
  for (const relic of ['', 'Aristocracy']) {
    const result = simulateMesmer(
      ['Rain of Swords', wait(5500)],
      config({
        specialization: 'Virtuoso',
        selectedSkills: ['Rain of Swords'],
        relic
      })
    );
    const hits = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Rain of Swords');
    const conditions = result.events.filter((event) => event.condition === 'Vulnerability');
    assert.deepEqual(
      conditions.map((event) => event.at),
      hits.map((event) => event.at)
    );
    assert.ok(conditions.every((event) => event.duration === 10 && event.stacks === 3));
    const reactions = procs(result, 'Relic of Aristocracy');
    assert.equal(reactions.length, relic ? 3 : 0);
    assert.ok(reactions.every((proc) => conditions.some((event) => Math.abs(event.at * 1000 - proc.start) < 1e-8)));
  }

  const missed = simulateMesmer(
    [{ name: 'Rain of Swords', offTarget: true }, wait(5500)],
    config({
      specialization: 'Virtuoso',
      selectedSkills: ['Rain of Swords'],
      relic: 'Aristocracy'
    })
  );
  assert.equal(procs(missed, 'Relic of Aristocracy').length, 0);
});

test('shatter controls use the resources consumed by that activation', () => {
  for (const initialResource of [0, 1, 3]) {
    const result = simulateMesmer(['Time Sink'], config({ specialization: 'Chronomancer', initialResource }));
    const controls = result.events.filter((event) => event.type === 'control');
    assert.equal(controls.length, initialResource + 1);
    assert.ok(controls.every((event) => event.controlKind === 'daze'));
    assert.equal(result.events.filter((event) => event.condition === 'Slow').length, initialResource + 1);
  }

  for (const initialResource of [1, 5]) {
    const result = simulateMesmer(['Bladesong Dissonance'], config({ specialization: 'Virtuoso', initialResource }));
    const cast = result.events.find((event) => event.type === 'action');
    const controls = result.events.filter((event) => event.type === 'control');
    assert.equal(controls.length, 1);

    assert.ok(controls[0].at >= cast.endsAt);
    assert.equal(result.planningState.profession.resource, 0);
  }
});

test('Gravity Well controls occur once on each authored pulse and cancelled casts emit none', () => {
  for (const interrupted of [false, true]) {
    const result = simulateMesmer(
      [{ name: 'Gravity Well', ...(interrupted ? { interruptMs: 100 } : {}) }, wait(3500)],
      config({
        specialization: 'Chronomancer',
        selectedSkills: ['Gravity Well'],
        selectedTraitIds: [TRAIT.DAZZLING]
      })
    );
    const controls = result.events.filter((event) => event.type === 'control');
    assert.equal(controls.length, interrupted ? 0 : 3);
    const conditions = result.events.filter((event) => event.condition === 'Vulnerability');
    assert.deepEqual(
      conditions.map((event) => event.at),
      controls.map((event) => event.at)
    );
    if (!interrupted)
      assert.deepEqual(
        controls.map((event) => event.controlKind),
        ['knockdown', 'pull', 'float']
      );
  }
});

test('Mental Collapse requires Clarity consumed by its own accepted activation', () => {
  for (const empowered of [false, true]) {
    const result = simulateMesmer(
      [...(empowered ? ['Mind the Gap'] : []), 'Mental Collapse', wait(1000)],
      config({
        specialization: 'Core',
        primaryWeapon: 'Spear',
        secondaryWeapon: ''
      })
    );
    const controls = result.events.filter((event) => event.type === 'control');
    assert.equal(controls.length, empowered ? 1 : 0);
    if (empowered) {
      assert.equal(controls[0].controlKind, 'stun');
      assert.equal(
        controls[0].activationId,
        result.events.find((event) => event.type === 'action' && event.skillName === 'Mental Collapse').activationId
      );
    }
  }
});

test('phantasm controls follow their summon impacts and repeated attack cycles', () => {
  const result = simulateMesmer(
    ['Phantasmal Sharpshooter', wait(6000)],
    config({
      specialization: 'Chronomancer',
      primaryWeapon: 'Rifle',
      secondaryWeapon: '',
      selectedTraitIds: [TRAIT.CHRONOPHANTASMA]
    })
  );
  const controls = result.events.filter((event) => event.type === 'control');
  const hits = result.events.filter((event) => event.type === 'damage' && event.summonKind === 'phantasm');
  assert.deepEqual(
    controls.map((event) => event.at),
    hits.map((event) => event.at)
  );
  assert.equal(controls.length, 2);
  assert.ok(controls.every((event) => event.actorType === 'summon' && event.controlKind === 'stun'));
});

test('effect-driven relics agree in detailed and score execution across observation windows', () => {
  for (const [relic, rotation] of [
    ['Aristocracy', ['Mirage Advance', 'Mind Slash']],
    ['Peitha', ['Crystal Sands', 'Jaunt']]
  ]) {
    for (const durationMs of [0, 2000, 6000]) {
      const options = {
        profession: mesmerProfession,
        rotation,
        config: config({ relic }),
        observationPolicy: { kind: 'tail', durationMs }
      };
      const detailed = simulateGw2(options);
      const score = simulateGw2({ ...options, output: 'score' });
      assert.equal(score.totalDamage, detailed.totalDamage);
      assert.equal(score.dps, detailed.dps);
      const endTimeMs = Math.max(...detailed.steps.map((step) => step.end)) + durationMs;
      assert.ok(detailed.procSteps.every((proc) => proc.start <= endTimeMs));
    }
  }
});
