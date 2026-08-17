import assert from "node:assert/strict";
import test from "node:test";

import { elementalistCatalog } from "../../../js/professions/elementalist/catalog.js";
import { applyCatalystEmpowerment } from "../../../js/professions/elementalist/specializations/catalyst/resolver.js";
import { catalystAttributeRules } from "../../../js/professions/elementalist/specializations/catalyst/rules.js";
import { createCatalystState } from "../../../js/professions/elementalist/specializations/catalyst/state.js";

// These unit checks exercise Catalyst state and catalog behavior directly so
// their expectations do not depend on a saved full rotation.
test("Elemental Empowerment tracks all ten stacks in its timed pool", () => {
  const state = createCatalystState();
  const context = {
    profession: {
      specialization: { kind: "Catalyst", state },
    },
  };

  for (let index = 1; index <= 11; index += 1) {
    applyCatalystEmpowerment(context, {
      type: "buff",
      at: index,
      kind: "elemental empowerment",
      stacks: 1,
      duration: 20,
    });
  }

  assert.deepEqual(
    state.elementalEmpowermentExpiries,
    [22, 23, 24, 25, 26, 27, 28, 29, 30, 31],
  );

  const attributes = catalystAttributeRules.modifyAttributes(
    {
      traits: new Set(["Elemental Empowerment", "Empowered Empowerment"]),
      config: {
        catalystEmpowermentPool: {
          power: 1000,
          precision: 1000,
          ferocity: 1000,
          conditionDamage: 1000,
          expertise: 1000,
          concentration: 1000,
        },
      },
      runtime: {
        combatStartTime: 0,
        profession: {
          specialization: { kind: "Catalyst", state },
        },
      },
      time: 12,
    },
    {
      power: 1500,
      precision: 1500,
      ferocity: 1500,
      conditionDamage: 1500,
      expertise: 1500,
      concentration: 1500,
    },
  );

  assert.deepEqual(attributes, {
    power: 1700,
    precision: 1700,
    ferocity: 1700,
    conditionDamage: 1700,
    expertise: 1700,
    concentration: 1700,
  });
});

test("Catalyst zero-damage finishers preserve combo metadata", () => {
  const zeroCoefficientFinisher = (name, finisherType) =>
    elementalistCatalog.skillsByName
      .get(name)
      .effects.flatMap((effect) => effect.ticks || [])
      .some(
        (tick) =>
          tick.coefficient === 0 &&
          tick.comboFinishers?.some(
            (finisher) => finisher.finisherType === finisherType,
          ),
      );

  assert.equal(zeroCoefficientFinisher("Churning Earth", "Blast"), true);
  assert.equal(zeroCoefficientFinisher("Aerial Agility", "Leap"), true);
  assert.equal(zeroCoefficientFinisher("Aerial Agility (dash)", "Leap"), true);
});
