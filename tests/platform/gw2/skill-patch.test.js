import assert from "node:assert/strict";
import test from "node:test";

import { createCanonicalCatalog } from "../../../js/platform/engine/catalog.js";
import {
  applyNumEdit,
  applySkillPatch,
  patchRuntimeValue,
} from "../../../js/platform/gw2/skill-patch.js";
import {
  defineNativeModule,
  defineNativeProfession,
} from "../../../js/platform/gw2/native-profession.js";
import { simulateGw2 } from "../../../js/platform/gw2/simulate.js";

function fixtureCatalog() {
  return createCanonicalCatalog({
    generated: [
      {
        id: 1,
        name: "Aggregate Skill",
        implemented: true,
        castTimeMs: 1000,
        cooldown: 10,
        effects: [
          { type: "strike", coefficient: 2, hits: 2, name: "Initial" },
          {
            type: "condition",
            condition: "Burning",
            stacks: 2,
            duration: 5,
          },
          { type: "boon", boon: "quickness", stacks: 1, duration: 2 },
        ],
      },
      {
        id: 2,
        name: "Timeline Skill",
        implemented: true,
        castTimeMs: 1000,
        effects: [
          {
            type: "strike",
            ticks: [
              { atMs: 100, coefficient: 0.5 },
              { atMs: 200, coefficient: 1 },
            ],
            timingAnchor: "castStart",
            timingScale: "fixed",
          },
          {
            type: "condition",
            ticks: [
              {
                atMs: 100,
                condition: "Burning",
                stacks: 1,
                duration: 3,
              },
              {
                atMs: 200,
                condition: "Burning",
                stacks: 2,
                duration: 4,
              },
            ],
            timingAnchor: "castStart",
            timingScale: "fixed",
          },
        ],
      },
      {
        id: 3,
        name: "Untouched Skill",
        implemented: true,
        castTimeMs: 0,
        effects: [],
      },
    ],
  });
}

test("numeric patch edits support absolute, from/to, multiply, and add", () => {
  assert.equal(applyNumEdit(2, 4), 4);
  assert.equal(applyNumEdit(2, { from: 2, to: 3 }), 3);
  assert.equal(applyNumEdit(2, { multiply: 1.5 }), 3);
  assert.equal(applyNumEdit(2, { add: 0.25 }), 2.25);
  assert.throws(
    () => applyNumEdit(2, { from: 3, to: 4 }, "fixture"),
    /expected live value 3, received 2/,
  );
});

test("skill patches target fields, effects, and individual timeline ticks", () => {
  const live = fixtureCatalog();
  const preview = applySkillPatch(live, {
    skills: {
      1: {
        fields: { cooldown: { from: 10, to: 8 } },
        effects: [
          {
            effectIndex: 0,
            type: "strike",
            name: "Initial",
            coefficient: { multiply: 0.5 },
          },
          {
            type: "condition",
            condition: "Burning",
            duration: { add: 1 },
          },
          {
            type: "boon",
            boon: "quickness",
            duration: 3,
          },
        ],
      },
      "Timeline Skill": {
        effects: [
          {
            effectIndex: 0,
            type: "strike",
            tickIndex: "all",
            coefficient: { add: 0.1 },
          },
          {
            effectIndex: 1,
            type: "condition",
            condition: "Burning",
            tickIndex: 1,
            duration: { from: 4, to: 7 },
          },
        ],
      },
    },
  });

  assert.notEqual(preview, live);
  assert.equal(live.skillsById.get(1).cooldown, 10);
  assert.equal(preview.skillsById.get(1).cooldown, 8);
  assert.equal(preview.skillsById.get(1).effects[0].coefficient, 1);
  assert.equal(preview.skillsById.get(1).effects[1].duration, 6);
  assert.equal(preview.skillsById.get(1).effects[2].duration, 3);
  assert.deepEqual(
    preview.skillsById.get(2).effects[0].ticks.map((tick) => tick.coefficient),
    [0.6, 1.1],
  );
  assert.deepEqual(
    preview.skillsById.get(2).effects[1].ticks.map((tick) => tick.duration),
    [3, 7],
  );
  assert.equal(preview.skillsById.get(3), live.skillsById.get(3));
  assert.equal(Object.isFrozen(preview.skillsById.get(1)), true);
});

test("skill patches add and remove complete condition effects", () => {
  const live = fixtureCatalog();
  const preview = applySkillPatch(live, {
    skills: {
      1: {
        removeEffects: [
          {
            effectIndex: 1,
            type: "condition",
            condition: "Burning",
          },
        ],
        addEffects: [
          {
            type: "condition",
            condition: "Bleeding",
            stacks: 3,
            duration: 6,
          },
        ],
      },
    },
  });

  assert.equal(live.skillsById.get(1).effects[1].condition, "Burning");
  assert.equal(
    preview.skillsById
      .get(1)
      .effects.some((effect) => effect.condition === "Burning"),
    false,
  );
  assert.deepEqual(preview.skillsById.get(1).effects.at(-1), {
    type: "condition",
    condition: "Bleeding",
    stacks: 3,
    duration: 6,
  });
});

test("patch authoring rejects unknown, ambiguous, and stale targets", () => {
  const live = fixtureCatalog();
  assert.throws(
    () => applySkillPatch(live, { skills: { Missing: { cooldown: 2 } } }),
    /unknown skill Missing/,
  );
  assert.throws(
    () =>
      applySkillPatch(live, {
        skills: {
          1: { coefficient: { from: 99, to: 1 } },
        },
      }),
    /expected live value 99/,
  );
  assert.throws(
    () =>
      applySkillPatch(live, {
        skills: {
          1: {
            effects: [{ duration: 1 }],
          },
        },
      }),
    /matched 3 effects/,
  );
});

test("native professions keep live and lazy preview catalogs side by side", () => {
  const core = defineNativeModule({
    id: "Core",
    data: {
      generatedSkills: [
        {
          id: 1,
          name: "Previewed Skill",
          implemented: true,
          castTimeMs: 0,
          effects: [{ type: "strike", coefficient: 1, hits: 1 }],
        },
      ],
    },
    state: { scheduler: () => ({}) },
  });
  const family = defineNativeProfession({
    id: "fixture",
    name: "Fixture",
    modules: [core],
    patchPreview: {
      id: "fixture-preview",
      label: "Fixture Preview",
      constants: { "shared.factor": { from: 2, to: 3 } },
      professions: {
        fixture: {
          skills: {
            1: { coefficient: { from: 1, to: 2 } },
          },
          constants: { "fixture.factor": { add: 1 } },
        },
      },
    },
  });

  const live = family.catalogFor();
  const preview = family.catalogFor("fixture-preview");
  assert.equal(family.catalog, live);
  assert.equal(live.skillsById.get(1).effects[0].coefficient, 1);
  assert.equal(preview.skillsById.get(1).effects[0].coefficient, 2);
  assert.equal(family.catalogFor("fixture-preview"), preview);
  assert.equal(
    family.resolveRuntime({ specialization: "Core" }).catalog.skillsById.get(1)
      .effects[0].coefficient,
    1,
  );
  assert.equal(
    family
      .resolveRuntime({
        specialization: "Core",
        patchId: "fixture-preview",
      })
      .catalog.skillsById.get(1).effects[0].coefficient,
    2,
  );
  const values = family.patchValuesFor("fixture-preview");
  assert.equal(patchRuntimeValue(values, "shared.factor", 2), 3);
  assert.equal(patchRuntimeValue(values, "fixture.factor", 4), 5);
  assert.equal(patchRuntimeValue(values, "missing", 4), 4);
  assert.throws(() => family.catalogFor("missing"), /Unknown Fixture patch/);

  const config = {
    specialization: "Core",
    stats: {
      power: 1000,
      precision: 0,
      ferocity: 0,
      conditionDamage: 0,
      expertise: 0,
      concentration: 0,
    },
    target: { armor: 1000 },
  };
  const currentResult = simulateGw2({
    profession: family,
    rotation: [1],
    config: { ...config, patchId: "current" },
  });
  const previewResult = simulateGw2({
    profession: family,
    rotation: [1],
    config: { ...config, patchId: "fixture-preview" },
  });
  assert.equal(previewResult.totalDamage, currentResult.totalDamage * 2);
});
