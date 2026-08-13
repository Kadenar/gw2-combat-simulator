import assert from "node:assert/strict";
import test from "node:test";

import { availableSlotSkills } from "../../../js/app/build/skills-panel.js";
import { elementalistAppAdapter } from "../../../js/professions/elementalist/app/app-definition.js";
import { elementalistCatalog } from "../../../js/professions/elementalist/catalog.js";
import { elementalistProfession } from "../../../js/professions/elementalist/definition.js";

function weaverApp(selectedSkills = {}) {
  const defaults = elementalistProfession.createBuildDefaults();
  const build = elementalistAppAdapter.toApplicationBuild({
    ...defaults,
    selectedSkills: { ...defaults.selectedSkills, ...selectedSkills },
  });
  return {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    skills: elementalistCatalog.skills,
    skillByName: elementalistCatalog.skillsByName,
    skillById: elementalistCatalog.skillsById,
  };
}

test("attunement-dependent slot skills have one selectable entry", () => {
  const utilities = availableSlotSkills(weaverApp(), "Utility");
  const labels = utilities.map((skill) => skill.displayName || skill.name);

  for (const name of [
    "Glyph of Elemental Power",
    "Glyph of Storms",
    "Primordial Stance",
  ]) {
    assert.equal(labels.filter((label) => label === name).length, 1, name);
  }
});

test("Tailored Victory is a chain skill, not an elite selection", () => {
  const elites = availableSlotSkills(weaverApp(), "Elite");

  assert.equal(
    elites.some((skill) => skill.name === "Tailored Victory"),
    false,
  );
  assert.equal(
    elites.some((skill) => skill.name === "Weave Self"),
    true,
  );
  assert.equal(
    elementalistCatalog.skillsByName.get("Tailored Victory").slotSelectable,
    false,
  );
});

test("existing builds retain any stored attunement variant", () => {
  const app = weaverApp({
    Utility1: "Glyph of Elemental Power (Air)",
    Utility2: "Primordial Stance (Earth)",
  });

  assert.equal(
    app.build.selectedSkills.Utility1,
    "Glyph of Elemental Power (Air)",
  );
  assert.equal(app.build.selectedSkills.Utility2, "Primordial Stance (Earth)");
});
