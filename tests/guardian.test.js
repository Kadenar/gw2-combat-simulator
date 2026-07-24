import assert from "node:assert/strict";
import test from "node:test";

import { getProfession } from "../js/app/composition.js";
import { simulateGw2 } from "../js/platform/gw2/simulate.js";
import {
  createGuardianBuildDefaults,
  migrateGuardianBuild,
  validateGuardianBuild,
} from "../js/professions/guardian/build.js";
import {
  guardianProfession,
} from "../js/professions/guardian/definition.js";

const config = {
  stats: {
    power: 2000,
    precision: 1000,
    ferocity: 0,
    conditionDamage: 1000,
  },
  target: { armor: 2597 },
};

test("Guardian vertical slice resolves Justice burning through simulateGw2", () => {
  const withoutJustice = simulateGw2({
    profession: guardianProfession,
    rotation: ["True Strike"],
    config,
  });
  const withJustice = simulateGw2({
    profession: guardianProfession,
    rotation: [
      "Virtue of Justice",
      "True Strike",
      { type: "wait", durationMs: 2000 },
    ],
    config,
  });

  assert.equal(withoutJustice.conditionDamage, 0);
  assert.ok(withJustice.conditionDamage > 0);
  assert.equal(withJustice.endState.profession.justiceBurns, 1);
  assert.equal(withJustice.endState.profession.justiceArmed, false);
});

test("Guardian vertical slice swaps weapons and has no resource view", () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ["Swap Weapons"],
    config,
  });
  assert.equal(result.endState.activeWeaponSet, 2);
  assert.deepEqual(guardianProfession.ui.resourceViews({}), []);
  assert.deepEqual(
    guardianProfession.ui.paletteGroups({})[0].skillIds,
    [guardianProfession.catalog.skillsByName.get("Virtue of Justice").id],
  );
});

test("Guardian build defaults persist through the profession codec", () => {
  const defaults = createGuardianBuildDefaults();
  const migrated = migrateGuardianBuild({
    ...defaults,
    rotation: ["Virtue of Justice", "True Strike"],
  });
  assert.equal(validateGuardianBuild(migrated).valid, true);
  assert.deepEqual(
    migrated.rotation.map(command => command.skillId),
    [
      guardianProfession.catalog.skillsByName.get("Virtue of Justice").id,
      guardianProfession.catalog.skillsByName.get("True Strike").id,
    ],
  );
});

test("Guardian is registered at the profession composition boundary", async () => {
  assert.equal(await getProfession("guardian"), guardianProfession);
});
