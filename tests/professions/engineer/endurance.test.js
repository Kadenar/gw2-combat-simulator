import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceEngineerResources,
  engineerEnduranceReadyAt
} from '#gw2/professions/engineer/core/mechanics/resources.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { engineerProfession } from '#gw2/professions/engineer/definition.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

// Explicit recipients keep another actor's Vigor from changing player recovery.
const vigor = (at, duration, includesSelf = true) => ({
  type: 'buff',
  kind: 'vigor',
  at,
  duration,
  resolvedAudience: { includesSelf, includesSummons: !includesSelf, companionIds: [] }
});

function resourceContext(events, config = {}) {
  return {
    config,
    events,
    start: 0,
    epsilon: 1e-9,
    state: { profession: { core: { endurance: 0, enduranceUpdatedAt: 0, maximumEndurance: 100 } } },
    emit(event) {
      this.events.push(event);
      return event;
    }
  };
}

test('Engineer ignores cancelled Vigor grants and extensions in recovery and readiness', () => {
  // Shared replay must exclude cancelled effects without changing wait partitioning or snapshot timing.
  for (const cancelledType of ['buff', 'boon_extension']) {
    for (const targets of [[8], [2, 3, 4, 6, 8]]) {
      const context = resourceContext([
        vigor(0, 20, false),
        vigor(2, 2),
        { ...vigor(0, 20), cancelled: true },
        { type: 'boon_extension', at: 3, duration: 2, kind: 'vigor', cancelled: cancelledType === 'boon_extension' }
      ]);
      const readyAt = cancelledType === 'buff' ? 8 : 9;
      assert.equal(engineerEnduranceReadyAt(context, 50), readyAt);
      for (const at of targets) advanceEngineerResources(context, at);
      const state = context.state.profession.core;
      assert.equal(state.endurance, cancelledType === 'buff' ? 50 : 45);
      assert.equal(engineerEnduranceReadyAt({ ...context, start: 8 }, 50), readyAt);
      advanceEngineerResources(context, readyAt);
      assert.equal(state.endurance, 50);
      assert.equal(state.enduranceUpdatedAt, readyAt);
      assert.equal(context.events.at(-1).type, 'engineer.state');
      assert.equal(context.events.at(-1).at, readyAt);
    }
  }
});

test('Engineer recovery and dodge predictions cross self-Vigor applications and expiry', () => {
  const context = resourceContext([vigor(2, 2), vigor(0, 20, false)]);
  assert.equal(engineerEnduranceReadyAt(context, 20), 2 + 10 / 7.5);
  assert.equal(engineerEnduranceReadyAt(context, 50), 9);
  advanceEngineerResources(context, 6);
  assert.equal(context.state.profession.core.endurance, 35);
  advanceEngineerResources(context, 3);
  assert.equal(context.state.profession.core.endurance, 35);
  assert.equal(context.state.profession.core.enduranceUpdatedAt, 6);
});

test('Engineer Vigor pools duration and extensions while respecting the duration cap', () => {
  const context = resourceContext([
    vigor(3, 2),
    vigor(2, 2),
    { type: 'boon_extension', at: 4, duration: 1, kind: 'vigor' }
  ]);
  advanceEngineerResources(context, 8);
  assert.equal(context.state.profession.core.endurance, 52.5);

  const capped = resourceContext([vigor(0, 20), vigor(0, 20)]);
  capped.state.profession.core.enduranceUpdatedAt = 29;
  advanceEngineerResources(capped, 32);
  assert.equal(capped.state.profession.core.endurance, 17.5);
});

test('Engineer preserves Adrenal Implant, permanent Vigor and the endurance cap', () => {
  const context = resourceContext([vigor(2, 2)], { selectedTraitIds: [TRAIT.ADRENAL_IMPLANT] });
  assert.equal(engineerEnduranceReadyAt(context, 50), 7.2);
  advanceEngineerResources(context, 6);
  assert.equal(context.state.profession.core.endurance, 42.5);

  const permanent = resourceContext([vigor(2, 2)], {
    selectedTraitIds: [TRAIT.ADRENAL_IMPLANT],
    boons: { vigor: true }
  });
  assert.equal(engineerEnduranceReadyAt(permanent, 50), 50 / 8.75);
  advanceEngineerResources(permanent, 6);
  assert.equal(permanent.state.profession.core.endurance, 52.5);
  advanceEngineerResources(permanent, 30);
  assert.equal(permanent.state.profession.core.endurance, 100);
});

test('Engineer wait partitioning cannot change endurance or the next affordable dodge', () => {
  const simulate = createProfessionSimulator(engineerProfession, {
    selectedSkills: ['Healing Turret'],
    selectedTraitIds: [TRAIT.OPTIMIZED_ACTIVATION],
    target: { armor: 2597, conditions: {} }
  });
  for (const waits of [[6000], [3000, 3000], [4000, 2000]]) {
    const rotation = [
      'Dodge',
      'Dodge',
      'Regenerating Mist',
      ...waits.map((durationMs) => ({ type: 'wait', durationMs }))
    ];
    const recovery = simulate('Core', rotation);
    assert.deepEqual(recovery.warnings, []);
    // Eight endurance plus four Vigor seconds and two base seconds must always total 48.
    assert.ok(Math.abs(recovery.endState.profession.endurance - 48) < 1e-9);
    const retry = simulate('Core', [...rotation, 'Dodge']);
    assert.deepEqual(retry.warnings, []);
    assert.equal(retry.steps.filter((step) => step.skill === 'Dodge').at(-1).start, 8000);
  }

  const immediate = simulate('Core', ['Dodge', 'Dodge', 'Regenerating Mist', 'Dodge']);
  assert.deepEqual(immediate.warnings, []);
  assert.equal(immediate.steps.filter((step) => step.skill === 'Dodge').at(-1).start, 8000);
});
