import { setResource } from '#gw2/platform/combat/resources/resource-policy.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { StableEventQueue } from '#kernel/events/queue.js';
import { resolverTimedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import { createScheduler } from '#gw2/platform/execution/scheduler.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { THIEF_SKILL_IDS as T } from '#gw2/professions/thief/data/ids.js';
import { GUARDIAN_SKILL_IDS as G } from '#gw2/professions/guardian/data/ids.js';
import {
  completeForgedSurfer,
  completeSkrittScuffle,
  forgedSurfer,
  skrittScuffle
} from '#gw2/professions/thief/specializations/antiquary/mechanics/artifacts.js';
import {
  restartInfiltratorsSignetPassive,
  infiltratorsSignetPassive
} from '#gw2/professions/thief/core/mechanics/resources.js';

// Exercise resolver queue identity directly so replacement and horizon behavior cannot depend on profession state.
test('resolver recurrence ignores retired work, isolates queues, and stops at the horizon', () => {
  const pulses = resolverTimedEffect({
    id: 'test.pulse',
    priority: -10,
    interval: () => 2,
    effectsAt(context, at, captured) {
      context.observed.push([at, captured.label]);
    }
  });
  const context = { queue: new StableEventQueue(), horizon: 5, observed: [] };
  const other = { queue: new StableEventQueue(), horizon: 5, observed: [] };
  pulses.start(context, { key: 'window', at: 1, captured: { label: 'retired' } });
  pulses.start(context, { key: 'window', at: 2, captured: { label: 'current' } });
  pulses.start(other, { key: 'window', at: 1, captured: { label: 'other' } });
  for (const runtime of [context, other]) {
    while (runtime.queue.length) {
      const event = runtime.queue.dequeue();
      assert.equal(event.priority, -10);
      pulses.eventHandlers[event.type](runtime, event);
    }

    assert.equal(pulses.nextAt(runtime), Infinity);
  }

  assert.deepEqual(context.observed, [
    [2, 'current'],
    [4, 'current']
  ]);
  assert.deepEqual(other.observed, [
    [1, 'other'],
    [3, 'other'],
    [5, 'other']
  ]);
});

test('resolver zero interval permits the opening pulse without recurrence', () => {
  const pulses = resolverTimedEffect({
    id: 'test.zero',
    interval: () => 0,
    effectsAt(context) {
      context.count++;
    }
  });
  const context = { queue: new StableEventQueue(), horizon: 10, count: 0 };
  pulses.start(context, { key: 'window', at: 1, captured: {} });
  const event = context.queue.dequeue();
  pulses.eventHandlers[event.type](context, event);
  pulses.eventHandlers[event.type](context, event);
  assert.equal(context.count, 1);
  assert.equal(context.queue.length, 0);
});

test('Infiltrator signet rearm replaces the pending resource pulse and follows cooldown resets', () => {
  const scheduler = createScheduler({
    profession: thiefProfession,
    config: { selectedSkills: { utility1: "Infiltrator's Signet" } }
  });
  const { context, state } = scheduler;
  setResource(context, 'initiative', 0);
  state.cooldowns.set(T.INFILTRATORS_SIGNET, 20);
  restartInfiltratorsSignetPassive(context);
  assert.equal(infiltratorsSignetPassive.nextAt(context), 30);
  state.cooldowns.delete(T.INFILTRATORS_SIGNET);
  scheduler.advanceTo(1);
  restartInfiltratorsSignetPassive(context);
  assert.equal(infiltratorsSignetPassive.nextAt(context), 11);
  scheduler.advanceTo(10);
  const before = state.profession.core.initiative.value;
  scheduler.advanceTo(11);
  assert.equal(
    state.profession.core.initiative.value - before,
    2,
    'one second of regeneration plus one discrete pulse'
  );
  assert.equal(infiltratorsSignetPassive.nextAt(context), 21);
});

test('Forged Surfer replacement retires old bombs independently of the buff expiry', () => {
  const scheduler = createScheduler({ profession: thiefProfession, config: { specialization: 'Antiquary' } });
  const { context, state } = scheduler;
  const skill = context.catalog.skillsById.get(T.FORGED_SURFER_DASH);
  completeForgedSurfer({ ...context, effectiveEnd: 0 }, skill);
  scheduler.advanceTo(1);
  const oldNext = forgedSurfer.nextAt(context);
  completeForgedSurfer({ ...context, effectiveEnd: 1 }, skill);
  scheduler.advanceTo(2);
  const before = scheduler.events.filter((event) => event.type === 'damage').length;
  scheduler.advanceTo(oldNext);
  assert.equal(scheduler.events.filter((event) => event.type === 'damage').length, before);
  assert.equal(forgedSurfer.nextAt(context), 5);
  assert.equal(state.profession.specialization.state.forgedSurferBombDropUntil, 11);
});

test('Skritt assistants overlap and each retains its inclusive final pilfer', () => {
  const scheduler = createScheduler({ profession: thiefProfession, config: { specialization: 'Antiquary' } });
  const { context } = scheduler;
  const skill = context.catalog.skillsByName.get('Skritt Scuffle');
  completeSkrittScuffle({ ...context, effectiveEnd: 0 }, skill);
  scheduler.advanceTo(1);
  completeSkrittScuffle({ ...context, effectiveEnd: 1 }, skill);
  scheduler.advanceTo(15);
  const pilfers = () => scheduler.events.filter((event) => event.reason === 'skritt-scuffle-artifact');
  assert.ok(pilfers().some((event) => event.at === 3));
  assert.ok(pilfers().some((event) => event.at === 4));
  assert.ok(pilfers().some((event) => event.at === 15));
  assert.equal(skrittScuffle.nextAt(context), 16);
  scheduler.advanceTo(16);
  assert.equal(pilfers().at(-1).at, 16);
  assert.equal(skrittScuffle.nextAt(context), Infinity);
});

test('Willbender fields overlap for the same virtue and cancel as a group when virtue changes', () => {
  const scheduler = createScheduler({ profession: guardianProfession, config: { specialization: 'Willbender' } });
  const { context } = scheduler;
  const activate = (at, virtue, flameId, offTarget = false) =>
    context.tasks.schedule({
      type: 'guardian.willbender-flame-activate',
      at,
      priority: -10,
      payload: { virtue, flameId, offTarget }
    });
  activate(0, 'justice', G.WILLBENDER_FLAMES_ID_62618, true);
  activate(0.5, 'justice', G.WILLBENDER_FLAMES_ID_62618);
  scheduler.advanceTo(1.5);
  const flames = () => scheduler.events.filter((event) => event.willbenderFlames);
  const activations = new Set(flames().map((event) => event.activationId));
  assert.equal(activations.size, 2);
  assert.ok(flames().some((event) => event.at > 0.5 && event.offTarget === true));
  activate(1.5, 'courage', G.WILLBENDER_FLAMES_COURAGE);
  scheduler.advanceTo(8);
  assert.ok(flames().some((event) => event.at > 1.5));
  assert.ok(
    flames()
      .filter((event) => event.at > 1.5)
      .every((event) => !activations.has(event.activationId))
  );
});
