import assert from "node:assert/strict";
import test from "node:test";

import { paletteView } from "../../../js/platform/ui/palette.js";
import { elementalistAppAdapter } from "../../../js/professions/elementalist/app/app-definition.js";
import { ELEMENTALIST_WEAVER_SKILL_IDS } from "../../../js/professions/elementalist/data/ids.js";
import { elementalistProfession } from "../../../js/professions/elementalist/definition.js";

function weaverBuild(traits) {
  return elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    specializations: [
      { name: "Fire", traits: "1-1-1" },
      { name: "Air", traits: "1-1-1" },
      { name: "Weaver", traits },
    ],
  });
}

test("Elements of Rage exposes Unravel as Weaver F5", () => {
  const build = weaverBuild("1-1-1");
  const context = {
    specialization: "Weaver",
    build,
    catalog: elementalistProfession.catalog,
  };
  const paletteGroup = paletteView(elementalistProfession, context).find(
    (group) => group.id === "elementalist-weaver-unravel",
  );
  const skillBarGroup = elementalistProfession.ui
    .skillBarGroups(context)
    .find((group) => group.id === "elementalist-weaver-unravel");
  const skill = elementalistProfession.catalog.skillsById.get(
    ELEMENTALIST_WEAVER_SKILL_IDS.Unravel,
  );

  assert.ok(paletteGroup);
  assert.equal(paletteGroup.label, "F5");
  assert.deepEqual(paletteGroup.skillIds, [80231]);
  assert.ok(skillBarGroup);
  assert.deepEqual(skillBarGroup.skillIds, [80231]);
  assert.equal(skill.name, "Unravel");
  assert.equal(skill.type, "Profession");
  assert.equal(skill.slot, "Profession_5");
  assert.equal(skill.cooldown, 25);
});

test("Weaver hides Unravel without Elements of Rage", () => {
  const build = weaverBuild("1-1-2");
  const context = {
    specialization: "Weaver",
    build,
    catalog: elementalistProfession.catalog,
  };

  assert.equal(
    paletteView(elementalistProfession, context).some(
      (group) => group.id === "elementalist-weaver-unravel",
    ),
    false,
  );
  assert.equal(
    elementalistProfession.ui
      .skillBarGroups(context)
      .some((group) => group.id === "elementalist-weaver-unravel"),
    false,
  );
});
