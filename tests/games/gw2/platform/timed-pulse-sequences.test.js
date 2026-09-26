import assert from 'node:assert/strict';
import test from 'node:test';
import { StableEventQueue } from '#kernel/events/queue.js';
import { resolverTimedEffect } from '#gw2/platform/profession-definition/mechanics.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { THIEF_SKILL_IDS as T } from '#gw2/professions/thief/data/ids.js';
import { GUARDIAN_SKILL_IDS as G } from '#gw2/professions/guardian/data/ids.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

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
  const observed = [];
  const observe = (runtime) =>
    observed.push([runtime.resourceController.value('initiative'), runtime.profession.core.infiltratorsSignetPulseAt]);
  const result = runThief(
    [
      "Infiltrator's Signet",
      { type: 'wait', durationMs: 1000 },
      { type: 'cooldown-reset' },
      { type: 'wait', durationMs: 10000 }
    ],
    { selectedSkills: ["Infiltrator's Signet"], initialInitiative: 0 },
    { probes: [0.5, 1.0005, 10, 11].map((at) => [at, observe]) }
  );
  assert.deepEqual(result.warnings, []);
  // Activation starts the twenty-second recharge, so the next pulse waits ten seconds past it.
  assert.equal(observed[0][1], 30);
  // The reset rearms the pulse from the reset instant.
  assert.equal(observed[1][1], 11);
  assert.equal(observed[3][0] - observed[2][0], 2, 'one second of regeneration plus one discrete pulse');
  assert.equal(observed[3][1], 21);
});

test('Forged Surfer replacement retires old bombs independently of the buff expiry', () => {
  // Swipe (0.2 s) and the dash (0.2 s) repeat, so the first sequence is replaced before its 1.4 s dash.
  const result = runThief(
    ['Skritt Swipe', 'Forged Surfer Dash', 'Skritt Swipe', 'Forged Surfer Dash', { type: 'wait', durationMs: 12000 }],
    { specialization: 'Antiquary' },
    { catalog: (live) => withSkill(live, T.SKRITT_SWIPE, { cooldown: 0 }) }
  );
  assert.deepEqual(result.warnings, []);
  const second = result.steps.filter((step) => step.skill === 'Forged Surfer Dash')[1].end / 1000;
  const surfer = result.events.filter((event) => event.type === 'damage' && event.skillId === T.FORGED_SURFER_DASH);
  assert.ok(surfer.length > 0);
  // Every packet belongs to the replacement: its dash one second after completion, then bombs every three seconds.
  for (const event of surfer) {
    const offset = event.at - second - 1;
    assert.ok(offset >= -1e-9 && Math.abs(offset / 3 - Math.round(offset / 3)) < 1e-9, String(event.at));
  }

  assert.ok(
    Math.abs(observedRuntime(result).profession.specialization.state.forgedSurferBombDropUntil - (second + 10)) < 1e-9
  );
});

test('Skritt assistants overlap and each retains its inclusive final pilfer', () => {
  const pilfers = [];
  const result = runThief(
    ['Skritt Scuffle', 'Skritt Scuffle', { type: 'wait', durationMs: 20000 }],
    { specialization: 'Antiquary', selectedSkills: ['Skritt Scuffle'] },
    {
      catalog: (live) => withSkill(live, T.SKRITT_SCUFFLE, { cooldown: 0 }),
      extend: (native) => ({
        tasks: {
          ...native.tasks,
          'thief.skritt-scuffle'(runtime, data) {
            pilfers.push(runtime.time);
            native.tasks['thief.skritt-scuffle'](runtime, data);
          }
        }
      })
    }
  );
  assert.deepEqual(result.warnings, []);
  const [first, second] = result.steps.map((step) => step.end / 1000);
  // Each assistant pilfers every three seconds through its own inclusive fifteen-second lifetime.
  const expected = [first, second]
    .flatMap((end) => [3, 6, 9, 12, 15].map((offset) => end + offset))
    .sort((left, right) => left - right);
  assert.equal(pilfers.length, expected.length);
  pilfers.forEach((at, index) => assert.ok(Math.abs(at - expected[index]) < 1e-9, `${at} != ${expected[index]}`));
});

test('Willbender fields overlap for the same virtue and cancel as a group when virtue changes', () => {
  const result = runGuardian(
    [
      G.FLOWING_RESOLVE,
      G.FLOWING_RESOLVE,
      { type: 'wait', durationMs: 1000 },
      G.CRASHING_COURAGE,
      { type: 'wait', durationMs: 6000 }
    ],
    { specialization: 'Willbender' }
  );
  assert.deepEqual(result.warnings, []);
  const resolve = result.events.filter((event) => event.type === 'damage' && event.skillId === G.WILLBENDER_FLAMES);
  assert.equal(new Set(resolve.map((event) => event.activationId)).size, 2);
  const courage = result.events.filter(
    (event) => event.type === 'damage' && event.skillId === G.WILLBENDER_FLAMES_COURAGE
  );
  assert.ok(courage.length > 0);
  const activation = result.events.find((event) => event.kind === 'willbender-courage').at;
  assert.ok(resolve.every((event) => event.at < activation));
  assert.ok(courage.every((event) => event.at >= activation));
});
