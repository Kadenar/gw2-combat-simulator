import assert from "node:assert/strict";
import test from "node:test";

import {
  createMesmerEventMaterializer,
} from "js/professions/mesmer/core/event-materializer.js";

function createFixture() {
  const events = [];
  const materializer = createMesmerEventMaterializer({
    emit(event) {
      events.push(event);
      return event;
    },
    activePrimaryWeapon: () => "Sword",
    weaponStrength: {},
  });
  return { events, materializer };
}

test("Mesmer event materialization preserves computed identity defaults", () => {
  const { events, materializer } = createFixture();

  materializer.addEvent({
    type: "marker",
    at: 1,
    skillId: 123,
    source: undefined,
    sourceId: undefined,
  });
  materializer.addCondition(
    "Condition Skill",
    2,
    { name: "Bleeding", duration: 3 },
    "Clone",
    "",
    { source: undefined, sourceId: undefined },
  );
  materializer.addDamage(
    { id: 456, name: "Damage Skill" },
    3,
    {
      coefficient: 1,
      metadata: { source: undefined, sourceId: undefined },
    },
    { source: undefined, sourceId: undefined },
  );

  assert.deepEqual(
    events.map(({ source, sourceId }) => ({ source, sourceId })),
    [
      { source: "Mesmer", sourceId: 123 },
      { source: "Clone", sourceId: "Condition Skill" },
      { source: "Player", sourceId: 456 },
    ],
  );
});

test("Mesmer event materialization preserves explicit identity", () => {
  const { events, materializer } = createFixture();

  materializer.addEvent({
    type: "marker",
    at: 1,
    source: "Trait",
    sourceId: "explicit-event",
  });
  materializer.addCondition(
    "Condition Skill",
    2,
    { name: "Bleeding", duration: 3 },
    "Player",
    "",
    { source: "Phantasm", sourceId: "explicit-condition" },
  );
  materializer.addDamage(
    { id: 456, name: "Damage Skill" },
    3,
    { coefficient: 1 },
    { source: "Clone", sourceId: "explicit-damage" },
  );

  assert.deepEqual(
    events.map(({ source, sourceId }) => ({ source, sourceId })),
    [
      { source: "Trait", sourceId: "explicit-event" },
      { source: "Phantasm", sourceId: "explicit-condition" },
      { source: "Clone", sourceId: "explicit-damage" },
    ],
  );
});
