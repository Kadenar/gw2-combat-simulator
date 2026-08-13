import assert from "node:assert/strict";
import test from "node:test";

import { createCanonicalCatalog } from "../../../js/platform/engine/catalog.js";
import { createCooldownController } from "../../../js/platform/engine/cooldown-controller.js";
import { defineProfession } from "../../../js/platform/engine/profession.js";
import { createScheduler } from "../../../js/platform/engine/scheduler.js";
import { createTaskQueue } from "../../../js/platform/engine/task-queue.js";

test("ammo recharge reductions carry overflow until maximum charges", () => {
  const skill = { id: 980000, ammo: 3, ammoRecharge: 12 };
  const state = {
    time: 0,
    ammo: new Map(),
    cooldowns: new Map(),
  };
  const controller = createCooldownController({
    state,
    rechargeDuration: () => 12,
  });

  controller.spendAmmo(skill, 0);
  controller.spendAmmo(skill, 0);
  controller.spendAmmo(skill, 0);

  const zeroToOne = controller.reduceAmmoRecharge(skill, 1, 11.3);
  assert.equal(zeroToOne.reducedBy, 1);
  assert.deepEqual(state.ammo.get(skill.id), {
    charges: 1,
    maximum: 3,
    rechargeDuration: 12,
    nextRechargeAt: 23,
  });
  assert.equal(state.cooldowns.has(skill.id), false);

  const oneToTwo = controller.reduceAmmoRecharge(skill, 5, 20);
  assert.equal(oneToTwo.reducedBy, 5);
  assert.deepEqual(state.ammo.get(skill.id), {
    charges: 2,
    maximum: 3,
    rechargeDuration: 12,
    nextRechargeAt: 30,
  });

  const twoToThree = controller.reduceAmmoRecharge(skill, 5, 29);
  assert.equal(twoToThree.reducedBy, 1);
  assert.deepEqual(state.ammo.get(skill.id), {
    charges: 3,
    maximum: 3,
    rechargeDuration: 12,
    nextRechargeAt: null,
  });
});

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
        recharge: 10,
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

  assert.deepEqual(scheduled.state.profession.log, [
    "task",
    "concurrent-start",
  ]);
  assert.deepEqual(
    scheduled.steps.map((step) => step.start),
    [0, 500],
  );
});

test("concurrent siblings execute by offset while retaining rotation indices", () => {
  const profession = defineProfession({
    id: "temporal-sibling-order",
    name: "Temporal Sibling Order",
    catalog: temporalCatalog(),
  });
  const scheduled = createScheduler({ profession }).run([
    "Long Cast",
    { name: "Gated Cast", offset: 500 },
    { name: "Instant Cast", offset: 100 },
  ]);

  assert.deepEqual(
    scheduled.events
      .filter((event) => event.type === "action")
      .map((event) => [event.skillName, Math.round(event.at * 1000)]),
    [
      ["Long Cast", 0],
      ["Instant Cast", 100],
      ["Gated Cast", 500],
    ],
  );
  assert.deepEqual(
    scheduled.steps.map((step) => [step.ri, step.skill, step.start]),
    [
      [0, "Long Cast", 0],
      [1, "Gated Cast", 500],
      [2, "Instant Cast", 100],
    ],
  );
  assert.deepEqual(scheduled.warnings, []);
});

test("cooldown-delayed concurrent siblings execute at their earliest legal time", () => {
  const profession = defineProfession({
    id: "temporal-delayed-sibling-order",
    name: "Temporal Delayed Sibling Order",
    catalog: temporalCatalog(),
  });
  const scheduled = createScheduler({ profession }).run([
    "Instant Cast",
    "Long Cast",
    { name: "Instant Cast", offset: 0 },
    { name: "Gated Cast", offset: 500 },
  ]);

  assert.deepEqual(
    scheduled.events
      .filter((event) => event.type === "action")
      .map((event) => [event.skillName, Math.round(event.at * 1000)]),
    [
      ["Instant Cast", 0],
      ["Long Cast", 0],
      ["Gated Cast", 500],
      ["Instant Cast", 10000],
    ],
  );
  assert.deepEqual(
    scheduled.steps.map((step) => [step.ri, step.skill, step.start]),
    [
      [0, "Instant Cast", 0],
      [1, "Long Cast", 0],
      [2, "Instant Cast", 10000],
      [3, "Gated Cast", 500],
    ],
  );
  assert.deepEqual(scheduled.warnings, []);
});

test("queued concurrent siblings cast at the current clock after an availability wait", () => {
  const profession = defineProfession({
    id: "temporal-queued-sibling",
    name: "Temporal Queued Sibling",
    catalog: temporalCatalog(),
    castRules: {
      availability(context, skill) {
        if (skill.name !== "Gated Cast" || context.start >= 0.6) {
          return { ready: true };
        }
        return {
          ready: false,
          retryAt: 0.6,
          code: "fixture.waiting",
          reason: "Waiting for the gate.",
        };
      },
    },
  });
  const scheduled = createScheduler({ profession }).run([
    "Long Cast",
    { name: "Gated Cast", offset: 100 },
    { name: "Instant Cast", offset: 200 },
  ]);

  assert.deepEqual(
    scheduled.steps.map((step) => [step.skill, step.start]),
    [
      ["Long Cast", 0],
      ["Gated Cast", 600],
      ["Instant Cast", 600],
    ],
  );
  assert.deepEqual(scheduled.warnings, []);
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
        "fixture.ready": (context) => {
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
  }).run(["Long Cast", { name: "Instant Cast", offset: 100 }]);
  const afterParent = createScheduler({
    profession,
    config: { readyAt: 1.2 },
  }).run(["Long Cast", { name: "Instant Cast", offset: 100 }, "Gated Cast"]);

  assert.deepEqual(
    queued.steps.map((step) => step.start),
    [0, 600],
  );
  assert.deepEqual(queued.warnings, []);
  assert.deepEqual(
    afterParent.steps.map((step) => step.start),
    [0, 1200, 1200],
  );
  assert.deepEqual(afterParent.warnings, []);
});

test("skill-group lockouts block only skills in the same group", () => {
  const lockouts = [{ group: "fixture.shatter", durationMs: 50 }];
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 980010,
        name: "Shatter One",
        castTimeMs: 0,
        lockouts,
        effects: [],
      },
      {
        id: 980011,
        name: "Unrelated Instant",
        castTimeMs: 0,
        effects: [],
      },
      {
        id: 980012,
        name: "Shatter Two",
        castTimeMs: 0,
        lockouts,
        effects: [],
      },
    ],
  });
  const profession = defineProfession({
    id: "temporal-group-lockout",
    name: "Temporal Group Lockout",
    catalog,
  });

  const scheduled = createScheduler({ profession }).run([
    "Shatter One",
    "Unrelated Instant",
    "Shatter Two",
  ]);

  assert.deepEqual(
    scheduled.steps.map((step) => ({
      skill: step.skill,
      start: step.start,
      end: step.end,
      fullCastMs: step.fullCastMs,
    })),
    [
      {
        skill: "Shatter One",
        start: 0,
        end: 0,
        fullCastMs: 0,
      },
      {
        skill: "Unrelated Instant",
        start: 0,
        end: 0,
        fullCastMs: 0,
      },
      {
        skill: "Shatter Two",
        start: 50,
        end: 50,
        fullCastMs: 0,
      },
    ],
  );
  assert.equal(scheduled.state.lockouts.get("fixture.shatter"), 0.1);
  assert.deepEqual(scheduled.warnings, []);
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
  assert.deepEqual(scheduled.state.profession.completions, [
    {
      skill: "Long Cast",
      clock: 0.25,
      effectiveEnd: 0.25,
    },
  ]);
});

test("interrupted casts can retain their original cast-lane lockout", () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 980010,
        name: "Retained Aftercast",
        castTimeMs: 1000,
        cooldown: 10,
        retainsCastLockoutAfterInterrupt: true,
        effects: [],
      },
      {
        id: 980011,
        name: "Following Cast",
        castTimeMs: 0,
        effects: [],
      },
    ],
  });
  const profession = defineProfession({
    id: "temporal-retained-aftercast",
    name: "Temporal Retained Aftercast",
    catalog,
  });
  const scheduled = createScheduler({ profession }).run([
    { name: "Retained Aftercast", interruptMs: 400 },
    "Following Cast",
  ]);
  const uninterrupted = createScheduler({ profession }).run([
    "Retained Aftercast",
  ]);
  const interruptedAction = scheduled.events.find(
    (event) =>
      event.type === "action" && event.skillName === "Retained Aftercast",
  );
  const followingAction = scheduled.events.find(
    (event) => event.type === "action" && event.skillName === "Following Cast",
  );
  const uninterruptedAction = uninterrupted.events.find(
    (event) =>
      event.type === "action" && event.skillName === "Retained Aftercast",
  );

  assert.equal(interruptedAction.endsAt, 0.4);
  assert.equal(interruptedAction.castLockoutEndsAt, 1);
  assert.equal(interruptedAction.rechargeReadyAt, 10.4);
  assert.equal(scheduled.state.cooldowns.get(980010), 10.4);
  assert.equal(scheduled.steps[0].end, 400);
  assert.equal(followingAction.at, 1);
  assert.equal(scheduled.steps[1].start, 1000);
  assert.equal(uninterruptedAction.endsAt, 1);
  assert.equal(uninterruptedAction.rechargeReadyAt, 11);
});

test("scheduler policies own chronological tasks and causal derivatives", () => {
  const profession = defineProfession({
    id: "temporal-policy",
    name: "Temporal Policy",
    catalog: temporalCatalog(),
    resources: {
      createProfessionState: () => ({ lifecycle: [] }),
    },
    schedulerHooks: {
      initialize(context) {
        context.state.profession.lifecycle.push("profession");
      },
      onCastStart(context) {
        context.emit({
          type: "marker",
          at: context.start,
          source: "fixture",
          sourceId: "fixture.original",
          name: "original-after-action",
        });
      },
    },
  });
  const schedulerPolicy = {
    initialize(context) {
      context.state.profession.lifecycle.push("policy");
    },
    onEventScheduled(context, event) {
      if (event.type !== "action") return;
      context.tasks.schedule({
        type: "fixture.policy-observation",
        at: event.at,
        priority: -10,
        payload: { event },
      });
    },
    taskHandlers: {
      "fixture.policy-observation": (context, task) => {
        for (const name of ["derived-one", "derived-two"]) {
          context.emitDerived(task.payload.event, {
            type: "marker",
            at: task.at,
            source: "fixture",
            sourceId: `fixture.${name}`,
            name,
          });
        }
      },
    },
  };
  const scheduled = createScheduler({
    profession,
    schedulerPolicy,
  }).run(["Long Cast"]);

  assert.deepEqual(scheduled.state.profession.lifecycle, [
    "policy",
    "profession",
  ]);
  assert.deepEqual(
    scheduled.events
      .filter((event) => event.at === 0)
      .map((event) => event.name),
    ["Long Cast", "derived-one", "derived-two", "original-after-action"],
  );
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
  const seen = [];
  const queue = createTaskQueue({
    handlers: { fixture: (_context, task) => seen.push(task.payload) },
  });
  assert.throws(
    () => queue.schedule({ type: "missing", at: 0, payload: {} }),
    /No scheduled task handler/,
  );
  assert.throws(
    () => queue.schedule({ type: "fixture", at: 0, payload: { fn() {} } }),
    /serializable data/,
  );

  const payload = { nested: { value: "scheduled" } };
  queue.schedule({ type: "fixture", at: 1, payload });
  payload.nested.value = "mutated";
  queue.drainThrough(1, {});
  assert.deepEqual(seen, [{ nested: { value: "scheduled" } }]);
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
