import assert from "node:assert/strict";
import test from "node:test";

import { simulationEventLogRows } from "../js/app/rotation-ui.js";
import {
  createFixedSlotLoadout,
} from "../js/app/profession-slot-loadout.js";
import {
  createProfessionAssumptionControls,
  normalizeProfessionAssumptions,
  STANDARD_POSITION_ASSUMPTION_CONTROLS,
  validateProfessionAssumptions,
} from "../js/app/profession-assumptions.js";
import { defineProfession } from "../js/platform/engine/profession.js";
import { createGw2CombatQuery } from "../js/platform/gw2/query.js";
import {
  canonicalTargetConditionName,
} from "../js/platform/gw2/target-state.js";
import {
  validateTraitCoverageManifest,
} from "../js/platform/gw2/trait-coverage.js";
import {
  defaultWeaponSkillMatchesSet,
} from "../js/platform/gw2/weapon-skill-matcher.js";
import {
  isGw2WeaponSkillEquipped,
} from "../js/platform/gw2/scheduler/policy.js";

const queryProfession = defineProfession({
  id: "query-fixture",
  name: "Query Fixture",
});

test("target-condition queries combine assumptions and chronological runtime state", () => {
  const query = createGw2CombatQuery({
    profession: queryProfession,
    config: {
      target: {
        conditions: {
          Cripple: true,
          Vulnerability: 2,
        },
      },
    },
  });
  const runtime = {
    conditionState: new Map([
      ["Poisoned", {
        stacks: [
          { appliedAt: 0, expiresAt: 2, weight: 2 },
          { appliedAt: 1, expiresAt: 3, weight: 3, removedAt: 2.5 },
        ],
      }],
      ["Chilled", {
        stacks: [{ appliedAt: 0.5, expiresAt: 1.5, weight: 1 }],
      }],
    ]),
    boons: new Map([
      ["target-vulnerability", [
        { at: 0, expiresAt: 2, stacks: 3 },
      ]],
    ]),
  };

  assert.equal(canonicalTargetConditionName("poison"), "Poisoned");
  assert.equal(canonicalTargetConditionName("cripple"), "Crippled");
  assert.equal(query.targetConditionStacks("Crippled", 1, runtime), 1);
  assert.equal(query.targetConditionStacks("Poison", 0.5, runtime), 2);
  assert.equal(query.targetConditionStacks("Poisoned", 1, runtime), 5);
  assert.equal(query.targetConditionStacks("Poisoned", 2, runtime), 3);
  assert.equal(query.targetConditionStacks("Poisoned", 2.5, runtime), 0);
  assert.equal(query.targetHasCondition("Chill", 1, runtime), true);
  assert.equal(query.targetHasCondition("Chilled", 1.5, runtime), false);
  assert.equal(query.targetConditionStacks("Vulnerability", 1, runtime), 5);
  assert.equal(query.targetConditionStacks("Vulnerability", 2, runtime), 2);
});

test("same-time target-condition visibility follows runtime insertion order", () => {
  const query = createGw2CombatQuery({
    profession: queryProfession,
    config: { target: { conditions: {} } },
  });
  const runtime = { conditionState: new Map(), boons: new Map() };

  assert.equal(query.targetHasCondition("Weakness", 1, runtime), false);
  runtime.conditionState.set("Weakness", {
    stacks: [{ appliedAt: 1, expiresAt: 3, weight: 1 }],
  });
  assert.equal(query.targetHasCondition("Weakness", 1, runtime), true);
  assert.equal(query.targetHasCondition("Weakness", 3, runtime), false);
});

test("trait coverage validates complete, behavioral, mixed-effect manifests", () => {
  const catalog = {
    traits: [
      { id: 1, name: "Mixed Trait" },
      { id: 2, name: "Support Trait" },
    ],
  };
  const coverage = validateTraitCoverageManifest(catalog, [
    {
      traitId: 1,
      status: "implemented",
      effects: [
        {
          description: "Increases strike damage while the target is poisoned.",
          status: "implemented",
        },
        {
          description: "Heals nearby allies when the damage bonus activates.",
          status: "out-of-model",
          reason: "Ally healing is outside the single-target damage model.",
        },
      ],
      tests: ["trait.mixed.poisoned-damage"],
      reason: null,
    },
    {
      traitId: 2,
      status: "out-of-model",
      effects: ["Revives and heals nearby allied players."],
      tests: [],
      reason: "Ally healing and revival are not represented by the simulator.",
    },
  ], { professionId: "fixture" });

  assert.equal(coverage.length, 2);
  assert.equal(Object.isFrozen(coverage), true);
  assert.equal(coverage[0].effects[1].status, "out-of-model");
});

test("trait coverage rejects gaps, unknown traits, names, and weak evidence", () => {
  const catalog = { traits: [{ id: 1, name: "Known Trait" }] };
  assert.throws(
    () => validateTraitCoverageManifest(catalog, []),
    /coverage is missing/,
  );
  assert.throws(
    () => validateTraitCoverageManifest(catalog, [{
      traitId: 2,
      status: "implemented",
      effects: ["Deals strike damage after using a tool-belt skill."],
      tests: ["trait.unknown"],
      reason: null,
    }]),
    /unknown trait 2/,
  );
  assert.throws(
    () => validateTraitCoverageManifest(catalog, [{
      traitId: 1,
      status: "implemented",
      effects: ["Known Trait"],
      tests: ["trait.known"],
      reason: null,
    }]),
    /not only its name/,
  );
  assert.throws(
    () => validateTraitCoverageManifest(catalog, [{
      traitId: 1,
      status: "implemented",
      effects: ["Deals strike damage after using a tool-belt skill."],
      tests: [],
      reason: null,
    }]),
    /behavioral test reference/,
  );
  assert.throws(
    () => validateTraitCoverageManifest(catalog, [{
      traitId: 1,
      status: "out-of-model",
      effects: ["Heals nearby allied players."],
      tests: [],
      reason: "unsupported",
    }]),
    /concrete reason/,
  );
});

test("profession event-log hooks present, hide, and diagnose custom events", () => {
  const result = {
    events: [
      { type: "engineer.kit-equipped", at: 1, kitName: "Grenade Kit" },
      { type: "engineer.state", at: 1, heat: 20 },
    ],
    resolvedEvents: [],
    endState: { profession: {} },
  };
  const profession = {
    ui: {
      eventLogRow(_context, event) {
        if (event.type === "engineer.state") return null;
        if (event.type === "engineer.kit-equipped") {
          return {
            type: "trigger",
            description: `KIT EQUIPPED ${event.kitName}`,
            className: "trigger",
            order: 20,
            flags: [],
          };
        }
        return undefined;
      },
    },
  };
  assert.deepEqual(
    simulationEventLogRows(result, null, profession)
      .map(row => row.description),
    ["KIT EQUIPPED Grenade Kit"],
  );

  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...values) => warnings.push(values);
  try {
    const [diagnostic] = simulationEventLogRows({
      events: [{ type: "engineer.unknown", at: 0 }],
      resolvedEvents: [],
      endState: { profession: {} },
    });
    assert.equal(
      diagnostic.description,
      "UNPRESENTED CUSTOM EVENT engineer.unknown",
    );
    assert.equal(warnings.length, 1);
  } finally {
    console.warn = originalWarn;
  }
});

test("fixed slot loadouts normalize, validate, render, and gate alternate bars", () => {
  const loadout = createFixedSlotLoadout({
    id: "test-legends",
    label: "Legends",
    entryLabel: "Legend",
    selectionKey: "selectedLegends",
    startingKey: "startingLegend",
    entries: [
      { id: "jalis", name: "Jalis", skillIds: [1, 2, 3, 4, 5] },
      { id: "mallyx", name: "Mallyx", skillIds: [6, 7, 8, 9, 10] },
      {
        id: "glint",
        name: "Glint",
        specialization: "Herald",
        skillIds: [11, 12, 13, 14, 15],
      },
    ],
    defaults: ["jalis", "mallyx"],
  });
  const normalized = loadout.normalizeBuild({
    selectedLegends: ["jalis", "jalis"],
    startingLegend: "missing",
  }, { specialization: "Core" });
  assert.deepEqual(normalized, {
    selectedLegends: ["jalis", "mallyx"],
    startingLegend: "jalis",
  });
  assert.deepEqual(
    loadout.validateBuild(normalized, { specialization: "Core" }),
    [],
  );
  assert.ok(loadout.validateBuild({
    selectedLegends: ["jalis", "glint"],
    startingLegend: "glint",
  }, { specialization: "Core" }).length > 0);

  const build = {
    selectedLegends: ["jalis", "mallyx"],
    startingLegend: "jalis",
  };
  let view = loadout.view({ build, specialization: "Core" });
  assert.deepEqual(view.activeBar.skillIds, [1, 2, 3, 4, 5]);
  assert.deepEqual(view.inactiveBars[0].skillIds, [6, 7, 8, 9, 10]);
  assert.match(
    loadout.unavailableReason({ id: 6 }, { build, specialization: "Core" }),
    /Swap to Mallyx/,
  );
  loadout.updateBuild(
    build,
    "startingLegend",
    "mallyx",
    { build, specialization: "Core" },
  );
  view = loadout.view({ build, specialization: "Core" });
  assert.equal(view.activeBar.id, "mallyx");
  assert.equal(
    loadout.paletteGroups({ build, specialization: "Core" }).length,
    2,
  );
});

test("weapon-set matching supports exact dual-wield and empty-offhand bars", () => {
  const context = {
    catalog: {
      weaponHands: new Map([
        ["Dagger", "mh+oh"],
        ["Pistol", "mh+oh"],
        ["Shortbow", "2h"],
      ]),
    },
  };
  const cases = [
    {
      skill: {
        type: "Weapon",
        weapon: "Dagger",
        slot: "Weapon_3",
        requiredMainHand: "Dagger",
        requiredOffHand: "Pistol",
      },
      valid: [["Dagger", "Pistol"]],
      invalid: [["Dagger", "Dagger"], ["Dagger", ""], ["Pistol", "Dagger"]],
    },
    {
      skill: {
        type: "Weapon",
        weapon: "Dagger",
        slot: "Weapon_3",
        requiredMainHand: "Dagger",
        requiredOffHand: false,
      },
      valid: [["Dagger", ""]],
      invalid: [["Dagger", "Pistol"], ["Dagger", "Dagger"]],
    },
    {
      skill: { type: "Weapon", weapon: "Shortbow", slot: "Weapon_5" },
      valid: [["Shortbow", ""]],
      invalid: [["Dagger", "Pistol"]],
    },
  ];
  for (const fixture of cases) {
    for (const pair of fixture.valid) {
      assert.equal(
        defaultWeaponSkillMatchesSet(fixture.skill, pair, context),
        true,
        `${pair.join("/")} should match`,
      );
    }
    for (const pair of fixture.invalid) {
      assert.equal(
        defaultWeaponSkillMatchesSet(fixture.skill, pair, context),
        false,
        `${pair.join("/")} should not match`,
      );
    }
  }

  const exactMatcher = (skill, pair) =>
    skill.combo === `${pair[0] || "none"}/${pair[1] || "none"}`;
  assert.equal(isGw2WeaponSkillEquipped({
    config: { primaryWeapon: "Dagger", secondaryWeapon: "Pistol" },
    state: { activeWeaponSet: 1 },
  }, {
    type: "Weapon",
    weapon: "Dagger",
    combo: "Dagger/Pistol",
  }, exactMatcher), true);
  assert.equal(isGw2WeaponSkillEquipped({
    config: { primaryWeapon: "Dagger", secondaryWeapon: "" },
    state: { activeWeaponSet: 1 },
  }, {
    type: "Weapon",
    weapon: "Dagger",
    combo: "Dagger/Pistol",
  }, exactMatcher), false);
});

test("profession assumption controls normalize and validate deterministic inputs", () => {
  const controls = createProfessionAssumptionControls([
    ...STANDARD_POSITION_ASSUMPTION_CONTROLS,
    {
      key: "stolenSkillChoice",
      label: "Stolen skill",
      type: "select",
      defaultValue: "golem",
      options: [
        { value: "golem", label: "Raid golem" },
        { value: "boon", label: "Boon target" },
      ],
    },
  ]);
  const assumptions = normalizeProfessionAssumptions({
    flanking: 1,
    behind: false,
    targetDistance: 9999,
    playerHealthPercent: -5,
    targetDefiant: false,
    stolenSkillChoice: "missing",
  }, controls);
  assert.deepEqual(assumptions, {
    flanking: true,
    behind: false,
    targetDistance: 2000,
    playerHealthPercent: 0,
    targetDefiant: false,
    stolenSkillChoice: "golem",
  });
  assert.deepEqual(validateProfessionAssumptions(assumptions, controls), []);
  assert.ok(validateProfessionAssumptions({
    ...assumptions,
    targetDistance: -1,
    stolenSkillChoice: "missing",
  }, controls).length >= 2);
});
