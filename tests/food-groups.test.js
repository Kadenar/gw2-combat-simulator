import assert from "node:assert/strict";
import test from "node:test";
import {
  FOOD_DATA,
  FOOD_GROUPS,
  FOOD_NAMES,
} from "../js/platform/gw2/gear-data.js";

test("food exports retain a complete flat lookup and grouped display list", () => {
  const groupedNames = FOOD_GROUPS.flatMap(group => group.items);
  const sortNames = names => [...names].sort((left, right) =>
    left.localeCompare(right));

  assert.deepEqual(
    FOOD_GROUPS.map(group => group.label),
    ["Power", "Condition", "Hybrid", "Concentration", "All Stats"],
  );
  assert.deepEqual(FOOD_NAMES, sortNames(Object.keys(FOOD_DATA)));
  assert.equal(groupedNames.length, FOOD_NAMES.length);
  assert.equal(new Set(groupedNames).size, FOOD_NAMES.length);
  assert.deepEqual(sortNames(groupedNames), FOOD_NAMES);
  assert.ok(FOOD_GROUPS.every(group => group.items.length > 0));
  assert.ok(FOOD_NAMES.every(name => FOOD_DATA[name]));
});
