import assert from "node:assert/strict";
import test from "node:test";

import {
  createCanonicalCatalog,
} from "../js/platform/engine/catalog.js";
import {
  defineProfession,
} from "../js/platform/engine/profession.js";
import {
  createScheduler,
} from "../js/platform/engine/scheduler.js";
import {
  createTaskQueue,
} from "../js/platform/engine/task-queue.js";

function temporalCatalog() {
  return createCanonicalCatalog({
    generated: [
      {
        id: 980001,
        name: "Long Cast",
        castTimeMs: 1000,
        effects: [],
      },
      {
        id: 980002,
        name: "Instant Cast",
        castTimeMs: 0,
        effects: [],
      },
      {
        id: 980003,
        name: "Gated Cast",
        castTimeMs: 0,
        effects: [],
      },
    ],
  });
}

test("tasks during a cast run before a later concurrent command", () => {
  const profession = defineProfession({
    id: "temporal-order",
    name: "Temporal Order",
    catalog: temporalCatalog(),
    resources: {
      createProfessionState: () => ({ log: [] }),
    },
    schedulerHooks: {
      initialize(context) {
        context.tasks.schedule({
          type: "fixture.record",
          at: 0.25,
          payload: { value: "task" },
        });
      },
      onCastStart(context, skill) {
        if (skill.name === "Instant Cast") {
          context.state.profession.log.push("concurrent-start");
        }
      },
      taskHandlers: {
        "fixture.record": (context, task) => {
          context.state.profession.log.push(task.payload.value);
        },
      },
    },
  });
  const scheduled = createScheduler({ profession }).run([
    "Long Cast",
    { name: "Instant Cast", offset: 500 },
  ]);

  assert.deepEqual(
    scheduled.state.profession.log,
    ["task", "concurrent-start"],
  );
  assert.deepEqual(scheduled.steps.map(step => step.start), [0, 500]);
});

test("an intermediate task can make a waiting cast available", () => {
  const profession = defineProfession({
    id: "temporal-readiness",
    name: "Temporal Readiness",
    catalog: temporalCatalog(),
    resources: {
      createProfessionState: () => ({ ready: false }),
    },
    castRules: {
      availability(context, skill) {
        if (skill.name !== "Gated Cast" || context.state.profession.ready) {
          return { ready: true };
        }
        return {
          ready: false,
          retryAt: 10,
          code: "fixture.waiting",
          reason: "Waiting for the readiness task.",
        };
      },
    },
    schedulerHooks: {
      initialize(context) {
        context.tasks.schedule({
          type: "fixture.ready",
          at: 2,
          payload: {},
        });
      },
      taskHandlers: {
        "fixture.ready": context => {
          context.state.profession.ready = true;
        },
      },
    },
  });
  const scheduled = createScheduler({ profession }).run(["Gated Cast"]);

  assert.equal(scheduled.steps[0].start, 2000);
  assert.deepEqual(scheduled.warnings, []);
});

test("a concurrent instant waits until its finite cooldown expires", () => {
  const profession = defineProfession({
    id: "temporal-concurrent-wait",
    name: "Temporal Concurrent Wait",
    catalog: temporalCatalog(),
    schedulerHooks: {
      initialize(context) {
        context.state.cooldowns.set(980002, context.config.readyAt);
      },
    },
  });
  const queued = createScheduler({
    profession,
    config: { readyAt: 0.6 },
  }).run([
    "Long Cast",
    { name: "Instant Cast", offset: 100 },
  ]);
  const afterParent = createScheduler({
    profession,
    config: { readyAt: 1.2 },
  }).run([
    "Long Cast",
    { name: "Instant Cast", offset: 100 },
    "Gated Cast",
  ]);

  assert.deepEqual(queued.steps.map(step => step.start), [0, 600]);
  assert.deepEqual(queued.warnings, []);
  assert.deepEqual(afterParent.steps.map(step => step.start), [0, 1200, 1200]);
  assert.deepEqual(afterParent.warnings, []);
});

test("interrupted casts complete at their effective end", () => {
  const profession = defineProfession({
    id: "temporal-interrupt",
    name: "Temporal Interrupt",
    catalog: temporalCatalog(),
    resources: {
      createProfessionState: () => ({ completions: [] }),
    },
    schedulerHooks: {
      onCastComplete(context, skill) {
        context.state.profession.completions.push({
          skill: skill.name,
          clock: context.state.time,
          effectiveEnd: context.effectiveEnd,
        });
      },
    },
  });
  const scheduled = createScheduler({ profession }).run([
    { name: "Long Cast", interruptMs: 250 },
  ]);

  assert.equal(scheduled.steps[0].end, 250);
  assert.equal(scheduled.steps[0].interrupted, true);
  assert.deepEqual(scheduled.state.profession.completions, [{
    skill: "Long Cast",
    clock: 0.25,
    effectiveEnd: 0.25,
  }]);
});

test("typed tasks order deterministically and reject zero-time loops", () => {
  const order = [];
  let queue;
  queue = createTaskQueue({
    safetyLimit: 5,
    handlers: {
      record: (_context, task) => order.push(task.payload),
      loop: (_context, task) => {
        queue.schedule({
          type: "loop",
          at: task.at,
          payload: {},
        });
      },
    },
  });
  queue.schedule({ type: "record", at: 1, priority: 0, payload: "first" });
  queue.schedule({ type: "record", at: 1, priority: -1, payload: "priority" });
  queue.schedule({ type: "record", at: 1, priority: 0, payload: "second" });
  queue.drainThrough(1, {});
  assert.deepEqual(order, ["priority", "first", "second"]);

  queue.schedule({ type: "loop", at: 2, payload: {} });
  assert.throws(
    () => queue.drainThrough(2, {}),
    /task safety limit|Zero-time scheduled task loop/,
  );
});

test("typed tasks require registered handlers and serializable payloads", () => {
  const queue = createTaskQueue({ handlers: { fixture: () => {} } });
  assert.throws(
    () => queue.schedule({ type: "missing", at: 0, payload: {} }),
    /No scheduled task handler/,
  );
  assert.throws(
    () => queue.schedule({ type: "fixture", at: 0, payload: { fn() {} } }),
    /serializable data/,
  );
});

test("owner cancellation removes queued work without banning future owners", () => {
  const seen = [];
  const queue = createTaskQueue({
    handlers: {
      fixture: (_context, task) => seen.push(task.payload),
    },
  });
  queue.schedule({
    type: "fixture",
    at: 1,
    ownerId: "reusable",
    payload: "cancelled",
  });
  queue.cancelOwner("reusable");
  queue.schedule({
    type: "fixture",
    at: 2,
    ownerId: "reusable",
    payload: "new",
  });
  queue.drainThrough(2, {});
  assert.deepEqual(seen, ["new"]);
});
