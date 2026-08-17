import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  compactPatchPreview,
  createEffectTemplate,
  generatePatchOverview,
  groupPatchAuthoringSkills,
  numericEditForValue,
  numericEditValue,
  patchSearchText,
} from "../../js/app/patch-preview/model.js";
import { engineerProfession } from "../../js/professions/engineer/definition.js";
import { guardianProfession } from "../../js/professions/guardian/definition.js";
import { necromancerProfession } from "../../js/professions/necromancer/definition.js";
import { rangerProfession } from "../../js/professions/ranger/definition.js";
import { revenantProfession } from "../../js/professions/revenant/definition.js";
import { thiefProfession } from "../../js/professions/thief/definition.js";
import { warriorProfession } from "../../js/professions/warrior/definition.js";

test("patch authoring omits unused skills but retains indirect runtime skills", () => {
  const engineerSkills = engineerProfession.patchAuthoring.modules.flatMap(
    (module) => module.skills,
  );
  const engineerSkillIds = new Set(engineerSkills.map((entry) => entry.id));
  const engineerSkillNames = new Set(engineerSkills.map((entry) => entry.name));

  for (const unusedName of [
    "Elixir B",
    "Elixir C",
    "Detonate Elixir H",
    "Blessing of Dwayna",
    "Blessing of Kormir",
    "Blessing of Lyssa",
    "Eat Wurm Egg",
    "Eat Owl Egg",
  ]) {
    assert.equal(engineerSkillNames.has(unusedName), false, unusedName);
  }

  assert.equal(engineerSkillIds.has("engineer.turret.rifle.attack"), true);

  const lesserGrenadeBarrage = engineerSkills.find(
    (entry) => entry.name === "Lesser Grenade Barrage",
  );
  assert.match(
    lesserGrenadeBarrage.skill.icon,
    /^https:\/\/render\.guildwars2\.com\//,
  );

  const bandTogetherVariants = revenantProfession.patchAuthoring.modules
    .flatMap((module) => module.skills)
    .filter((entry) => entry.skill.variantBadge === "Band Together");
  assert.equal(bandTogetherVariants.length, 4);
});

test("patch authoring omits unreachable Thief skills but keeps live stolen and artifact skills", () => {
  const skills = thiefProfession.patchAuthoring.modules.flatMap(
    (module) => module.skills,
  );
  const ids = new Set(skills.map((entry) => entry.id));
  const names = new Set(skills.map((entry) => entry.name));

  for (const unusedName of [
    "Branch Leap",
    "Eat Egg",
    "Bone Crack",
    "Lesser Caltrops",
    "Antivenom Draught: Backfired",
  ]) {
    assert.equal(names.has(unusedName), false, unusedName);
  }
  for (const usedId of [1110, 1123, 1162, 76702]) {
    assert.equal(ids.has(usedId), true, String(usedId));
  }
});

test("patch authoring omits unreachable skills for the remaining professions", () => {
  const skillsFor = (profession) =>
    profession.patchAuthoring.modules.flatMap((module) => module.skills);
  const idsFor = (profession) =>
    new Set(skillsFor(profession).map((entry) => entry.id));
  const namesFor = (profession) =>
    new Set(skillsFor(profession).map((entry) => entry.name));

  const necromancerNames = namesFor(necromancerProfession);
  for (const unusedName of [
    "Consume Conditions",
    "Spectral Walk",
    "Weapon of Warding",
  ]) {
    assert.equal(necromancerNames.has(unusedName), false, unusedName);
  }

  const guardianNames = namesFor(guardianProfession);
  for (const unusedName of [
    '"Advance!"',
    "Mantra of Lore",
    "Opening Passage",
    "Clarified Conclusion",
    "Valorous Stance",
  ]) {
    assert.equal(guardianNames.has(unusedName), false, unusedName);
  }
  assert.equal(guardianNames.has("Chapter 1: Searing Spell"), true);

  const warriorIds = idsFor(warriorProfession);
  for (const unusedId of [14372, 14422, 14443, 30989, 39972, 62804]) {
    assert.equal(warriorIds.has(unusedId), false, String(unusedId));
  }
  assert.equal(warriorIds.has(14353), true, "canonical Eviscerate");

  const rangerIds = idsFor(rangerProfession);
  for (const unusedId of [42809, 59554, 64882, 67382]) {
    assert.equal(rangerIds.has(unusedId), false, String(unusedId));
  }
  for (const usedId of [40729, 63094, 63258]) {
    assert.equal(rangerIds.has(usedId), true, String(usedId));
  }

  const revenantIds = idsFor(revenantProfession);
  for (const unusedId of [27198, 34198, 48170, 71827, 73149]) {
    assert.equal(revenantIds.has(unusedId), false, String(unusedId));
  }
  for (const usedId of [62689, 77920]) {
    assert.equal(revenantIds.has(usedId), true, String(usedId));
  }
  assert.equal(revenantIds.has("revenant.renegade.razorclaws-rage-proc"), true);
});

test("patch authoring groups skills by weapon and slot type", () => {
  const entry = (id, name, skill) => ({
    id,
    name,
    moduleId: "Core",
    skill: { id, name, ...skill },
    patchableFields: {},
  });
  const groups = groupPatchAuthoringSkills([
    entry(1, "Rifle Burst", { type: "Weapon", weapon: "Rifle" }),
    entry(2, "Dagger Slash", { type: "Weapon", weapon: "Dagger" }),
    entry(3, "Healing Skill", { type: "Heal" }),
    entry(4, "Utility Skill", { type: "Utility" }),
    entry(5, "Elite Skill", { type: "Elite" }),
    entry(6, "Profession Skill", { type: "Profession" }),
    entry(7, "Triggered Skill", { type: "Action" }),
  ]);

  assert.deepEqual(
    groups.map((group) => group.label),
    [
      "Dagger weapon",
      "Rifle weapon",
      "Heal skills",
      "Utility skills",
      "Elite skills",
      "Profession skills",
      "Actions and triggered skills",
    ],
  );
});

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
  assert.match(source, /renderSelectedSkill\(\);\s*return;/);
  assert.doesNotMatch(source, /data-add-note/);
  assert.doesNotMatch(source, /data-note-field/);
  assert.match(simulatorSource, /Official patch notes/);
  assert.match(simulatorSource, /Change overview/);
});
