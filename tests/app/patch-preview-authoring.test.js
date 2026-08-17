import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  compactPatchPreview,
  createEffectTemplate,
  generatePatchOverview,
  numericEditForValue,
  numericEditValue,
  patchSearchText,
} from "../../js/app/patch-preview/model.js";

test("patch authoring numeric controls preserve stale live-value checks", () => {
  assert.equal(numericEditValue(10, undefined), 10);
  assert.equal(numericEditValue(10, 12), 12);
  assert.equal(numericEditValue(10, { from: 10, to: 14 }), 14);
  assert.equal(numericEditValue(10, { multiply: 1.5 }), 15);
  assert.equal(numericEditValue(10, { add: -2 }), 8);
  assert.deepEqual(numericEditForValue(10, 14), { from: 10, to: 14 });
  assert.equal(numericEditForValue(10, 10), undefined);
});

test("patch authoring compacts empty edits without dropping numeric zero", () => {
  assert.deepEqual(
    compactPatchPreview({
      id: "august-preview",
      label: "August Preview",
      professions: {
        warrior: {
          skills: {
            empty: { fields: {} },
            changed: { fields: { cooldown: { from: 10, to: 0 } } },
          },
          modifierRules: {},
        },
        guardian: { skills: {} },
      },
    }),
    {
      id: "august-preview",
      label: "August Preview",
      professions: {
        warrior: {
          skills: {
            changed: { fields: { cooldown: { from: 10, to: 0 } } },
          },
        },
      },
    },
  );
});

test("patch authoring provides valid effect templates and normalized search", () => {
  assert.deepEqual(createEffectTemplate("strike"), {
    type: "strike",
    coefficient: 1,
    hits: 1,
    atMs: 0,
  });
  assert.deepEqual(createEffectTemplate("condition"), {
    type: "condition",
    condition: "Bleeding",
    stacks: 1,
    duration: 1,
    atMs: 0,
  });
  assert.equal(
    patchSearchText("Bloody Roar", ["strikeDamage", "multiply"]),
    "bloody roar strikedamage multiply",
  );
});

test("patch authoring generates an overview and discards manual notes", () => {
  const preview = generatePatchOverview(
    {
      id: "august-preview",
      label: "August Preview",
      notes: [
        {
          subject: "Global manual note",
          text: "This must be discarded.",
          status: "tracked",
        },
      ],
      professions: {
        necromancer: {
          notes: [
            {
              subject: "Legacy context",
              text: "Preserved for compatibility.",
              status: "tracked",
            },
          ],
          skills: {
            30670: {
              effects: [
                {
                  effectIndex: 0,
                  coefficient: { from: 1.5, to: 2 },
                  hits: { from: 1, to: 2 },
                },
              ],
            },
          },
          balanceProfiles: {
            "necromancer.fixture-profile": {
              effects: [
                {
                  effectIndex: 0,
                  duration: { from: 5, to: 6 },
                },
              ],
            },
          },
          modifierRules: {
            "necromancer.fixture-modifier": {
              factor: { from: 1.1, to: 1.2 },
              parameters: { threshold: { from: 90, to: 80 } },
            },
          },
        },
      },
    },
    [
      {
        professionId: "necromancer",
        professionName: "Necromancer",
        modules: [
          {
            id: "Core",
            traits: [],
            skills: [{ id: 30670, name: "Suffer!" }],
            balanceProfiles: [
              {
                id: "necromancer.fixture-profile",
                name: "Fixture profile",
              },
            ],
            modifierRules: [
              {
                id: "necromancer.fixture-modifier",
                label: "Fixture modifier",
              },
            ],
          },
        ],
      },
    ],
  );

  const overview = preview.professions.necromancer.overview;
  assert.equal(preview.notes, undefined);
  assert.equal(preview.professions.necromancer.notes, undefined);
  assert.equal(overview.length, 3);
  assert.deepEqual(overview[0], {
    subject: "Suffer!",
    text: "Effect 0 coefficient 1.5 → 2; effect 0 hits 1 → 2.",
    source: "skill-diff",
  });
  assert.deepEqual(overview[1], {
    subject: "Fixture profile",
    text: "Effect 0 duration 5 → 6.",
    source: "profile-diff",
  });
  assert.deepEqual(overview[2], {
    subject: "Fixture modifier",
    text: "Factor 1.1 → 1.2; parameter threshold 90 → 80.",
    source: "modifier-diff",
  });
});

test("patch authoring UI uses an official source and read-only overview", async () => {
  const source = await readFile(
    new URL("../../js/app/patch-preview/index.ts", import.meta.url),
    "utf8",
  );
  const simulatorSource = await readFile(
    new URL("../../js/app/simulation/patch-preview-view.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /data-select-section="overview"/);
  assert.match(source, /Official patch notes URL/);
  assert.match(source, /Generated from diff/);
  assert.doesNotMatch(source, /data-add-note/);
  assert.doesNotMatch(source, /data-note-field/);
  assert.match(simulatorSource, /Official patch notes/);
  assert.match(simulatorSource, /Change overview/);
});
