import assert from "node:assert/strict";
import test from "node:test";

import { createCanonicalCatalog } from "../../../js/platform/engine/catalog.js";
import { defineProfession } from "../../../js/platform/engine/profession.js";
import { createScheduler } from "../../../js/platform/engine/scheduler.js";
import { createGw2SchedulerPolicy } from "../../../js/platform/gw2/scheduler/policy.js";

function fixtureProfession(initialize, catalog = createCanonicalCatalog()) {
  return defineProfession({
    id: "combo-fixture",
    name: "Combo Fixture",
    catalog,
    resources: { createProfessionState: () => ({}) },
    schedulerHooks: { initialize },
  });
}

test("owned canonical descriptors produce shared combo events without a profession adapter", () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 1,
        name: "Canonical Fire Field",
        castTimeMs: 0,
        comboFields: [
          {
            ownerId: "combo-fixture",
            fieldType: "Fire",
            duration: 5,
            startAnchor: "castEnd",
          },
        ],
        effects: [],
      },
      {
        id: 2,
        name: "Canonical Blast",
        castTimeMs: 0,
        effects: [
          {
            type: "strike",
            coefficient: 1,
            comboFinishers: [
              {
                ownerId: "combo-fixture",
                finisherType: "Blast",
                ambiguousFieldSelection: "oldest",
              },
            ],
          },
        ],
      },
    ],
  });
  const profession = fixtureProfession(() => {}, catalog);
  const result = createScheduler({
    profession,
    schedulerPolicy: createGw2SchedulerPolicy(),
  }).run(["Canonical Fire Field", "Canonical Blast"]);

  const field = result.events.find((event) => event.type === "combo_field");
  const finisher = result.events.find(
    (event) => event.type === "combo_finisher",
  );
  const combo = result.events.find((event) => event.type === "combo");
  assert.equal(field.ownerId, "combo-fixture");
  assert.deepEqual(finisher.fieldBinding, {
    kind: "field-id",
    fieldId: field.fieldId,
  });
  assert.equal(combo.fieldId, field.fieldId);
  assert.equal(combo.finisherType, "Blast");
});

test("a later-authored owned field rebinds an already scheduled finisher", () => {
  const profession = fixtureProfession((context) => {
    context.emit({
      type: "damage",
      at: 1,
      source: "combo-fixture",
      sourceId: 2,
      actorType: "player",
      skillId: 2,
      skillName: "Scheduled Projectile",
      coefficient: 1,
      comboFinishers: [
        {
          ownerId: "combo-fixture",
          finisherType: "Projectile",
          ambiguousFieldSelection: "oldest",
        },
      ],
    });
    context.emit({
      type: "action",
      at: 0,
      endsAt: 0,
      source: "combo-fixture",
      sourceId: 1,
      actorType: "player",
      skillId: 1,
      skillName: "Later Authored Ice Field",
      comboFields: [
        {
          ownerId: "combo-fixture",
          fieldType: "Ice",
          duration: 2,
          startAnchor: "castEnd",
        },
      ],
    });
  });
  const result = createScheduler({
    profession,
    schedulerPolicy: createGw2SchedulerPolicy(),
  }).run([{ type: "wait", durationMs: 2000 }]);
  const field = result.events.find((event) => event.type === "combo_field");
  const finisher = result.events.find(
    (event) => event.type === "combo_finisher",
  );

  assert.deepEqual(finisher.fieldBinding, {
    kind: "field-id",
    fieldId: field.fieldId,
  });
  assert.equal(
    result.events.find((event) => event.type === "combo")?.fieldId,
    field.fieldId,
  );
});

test("the scheduler predicts a delayed combo result for later facts", () => {
  const profession = fixtureProfession((context) => {
    context.emit({
      type: "combo_field",
      at: 0,
      source: "Flame Field",
      sourceId: "field.skill",
      actorType: "effect",
      fieldId: "field:1",
      fieldType: "Fire",
      expiresAt: 5,
      ownerId: "combo-fixture",
      ownerActorType: "player",
    });
    context.emit({
      type: "combo_finisher",
      at: 1,
      effectAt: 2,
      source: "Blast",
      sourceId: "blast.skill",
      actorType: "player",
      skillName: "Blast",
      attemptId: "blast:1",
      finisherType: "Blast",
      fieldBinding: { kind: "field-id", fieldId: "field:1" },
      chance: 1,
      applications: 1,
      successfulCombos: 1,
    });
  });
  const scheduler = createScheduler({
    profession,
    schedulerPolicy: createGw2SchedulerPolicy(),
  });
  const result = scheduler.run([{ type: "wait", durationMs: 3000 }]);
  const combo = result.events.find((event) => event.type === "combo");
  const might = result.events.find(
    (event) =>
      event.type === "buff" &&
      event.kind === "might" &&
      event.schedulerPrediction === "combo-result",
  );

  assert.equal(combo.at, 2);
  assert.equal(combo.schedulerPrediction, "combo-result");
  assert.equal(might.at, 2);
  assert.equal(might.stacks, 3);
  assert.equal(scheduler.context.hasBuff("might", 2), true);
});

test("same-time fields register before finishers by default", () => {
  const profession = fixtureProfession((context) => {
    context.emit({
      type: "combo_finisher",
      at: 0,
      effectAt: 0,
      source: "Leap",
      sourceId: "leap.skill",
      actorType: "player",
      attemptId: "leap:1",
      finisherType: "Leap",
      fieldBinding: { kind: "field-id", fieldId: "field:same-time" },
      chance: 1,
      applications: 1,
      successfulCombos: 1,
    });
    context.emit({
      type: "combo_field",
      at: 0,
      source: "Ice Field",
      sourceId: "ice.field",
      actorType: "effect",
      fieldId: "field:same-time",
      fieldType: "Ice",
      expiresAt: 1,
      ownerId: "combo-fixture",
      ownerActorType: "player",
    });
  });
  const result = createScheduler({
    profession,
    schedulerPolicy: createGw2SchedulerPolicy(),
  }).run([{ type: "wait", durationMs: 1 }]);

  assert.equal(
    result.events.filter((event) => event.type === "combo").length,
    1,
  );
  assert.equal(
    result.events.find((event) => event.type === "aura")?.aura,
    "Frost Aura",
  );
});
