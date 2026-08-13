import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  loadProfession,
  loadProfessionAppAdapter,
  professionRoute,
} from "../../../js/app/profession/registry.js";
import { assumptionControlsForSpecialization } from "../../../js/app/profession/assumptions.js";
import { weaponSkills } from "../../../js/app/rotation/palette-model.js";
import { simulateGw2 } from "../../../js/platform/gw2/simulate.js";
import { createGw2CombatQuery } from "../../../js/platform/gw2/query.js";
import { resolveProfessionRuntime } from "../../../js/platform/engine/profession.js";
import { normalizeRotation } from "../../../js/platform/engine/rotation-commands.js";
import { resourceDisplayViews } from "../../../js/platform/ui/resource-display.js";
import { skillBreakdownRows } from "../../../js/platform/ui/result-tables.js";
import {
  createThiefBuildDefaults,
  migrateThiefBuild,
  validateThiefBuild,
} from "../../../js/professions/thief/build.js";
import {
  thiefCatalog,
  thiefWeaponSkillMatchesSet,
} from "../../../js/professions/thief/catalog.js";
import { DATA_SNAPSHOT } from "../../../js/professions/thief/data/thief-api-metadata.js";
import { THIEF_SUPPLEMENTAL_SKILLS } from "../../../js/professions/thief/data/thief-supplemental-skills.js";
import { THIEF_TRAIT_COVERAGE } from "../../../js/professions/thief/data/trait-coverage.js";
import {
  THIEF_ARTIFACT_IDS,
  THIEF_SKILL_IDS as ID,
  THIEF_TRAIT_IDS as TRAIT,
} from "../../../js/professions/thief/data/ids.js";
import { THIEF_SKILL_MECHANICS } from "../../../js/professions/thief/mechanics/skill-mechanics.js";
import {
  recalculate,
  runSimulation,
  thiefAppAdapter,
} from "../../../js/professions/thief/app/app-definition.js";
import { thiefProfession } from "../../../js/professions/thief/definition.js";
import { daredevilModifierRules } from "../../../js/professions/thief/specializations/daredevil/rules.js";

const baseConfig = Object.freeze({
  selectedSkills: [
    "Hide in Shadows",
    "Assassin's Signet",
    "Shadow Flare",
    "Shadow Gust",
    "Thieves Guild",
  ],
  initialInitiative: 12,
  initialShadowForce: 0,
  primaryWeapon: "Dagger",
  secondaryWeapon: "Dagger",
  weaponSet2Primary: "Pistol",
  weaponSet2Secondary: "Pistol",
  deterministicChoices: {
    stolenSkillChoice: "throw-gunk",
    deadeyeStolenSkillChoice: "steal-time",
  },
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000,
  },
  target: {
    armor: 2597,
    defiant: true,
    conditions: { Vulnerability: 25 },
  },
});

function simulate(specialization, rotation, config = {}) {
  return simulateGw2({
    profession: thiefProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization,
      deterministicChoices: {
        ...baseConfig.deterministicChoices,
        ...(config.deterministicChoices || {}),
      },
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) },
    },
  });
}

test("Thief catalog pins API identity and explicit terrestrial mechanics", () => {
  assert.equal(DATA_SNAPSHOT, "2026-07-28");
  assert.equal(thiefCatalog.specializations.length, 9);
  assert.equal(thiefCatalog.traits.length, 108);
  assert.ok(thiefCatalog.skills.length >= 256);
  assert.equal(thiefCatalog.skillsById.has(76550), false);
  assert.equal(thiefCatalog.skillsById.has(40436), true);
  assert.equal(thiefCatalog.skillsById.has(80278), false);
  assert.equal(
    thiefCatalog.skillsByName.get("Death Blossom").initiativeCost,
    4,
  );
  assert.equal(THIEF_SKILL_MECHANICS[13006].castTimeMs, undefined);
  assert.equal(THIEF_SKILL_MECHANICS[13006].quicknessCastTimeMs, 1040);
  assert.equal(thiefCatalog.skillsById.get(13006).castTimeMs, 1560);
  assert.deepEqual(
    THIEF_SKILL_MECHANICS[13006].effects[0].ticks.map(
      ({ atMs, coefficient }) => [atMs, coefficient],
    ),
    [
      [840, 0.21],
      [960, 0.21],
      [1200, 0.21],
    ],
  );
  assert.deepEqual(
    THIEF_SKILL_MECHANICS[13006].effects[1].ticks.map(
      ({ atMs, condition, stacks, duration }) => [
        atMs,
        condition,
        stacks,
        duration,
      ],
    ),
    [
      [840, "Bleeding", 2, 6],
      [960, "Bleeding", 2, 6],
      [1200, "Bleeding", 2, 6],
    ],
  );
  for (const excludedName of [
    "Deadly Strike",
    "Malicious Deadly Strike",
    "Malicious Ripper",
    "Prepare Seal Area",
    "Prepare Shadow Portal",
    "Seal Area",
    "Shadow Portal",
    "Shadow Refuge",
    "Shadow Return",
    "Shadowstep",
    "Smoke Screen",
    "The Ripper",
  ]) {
    assert.equal(
      thiefCatalog.skillsByName.has(excludedName),
      false,
      excludedName,
    );
  }
  assert.ok(
    THIEF_SUPPLEMENTAL_SKILLS.every(
      (skill) =>
        !Object.hasOwn(skill, "effects") &&
        !Object.hasOwn(skill, "cooldown") &&
        !Object.hasOwn(skill, "recharge"),
    ),
  );
  assert.match(
    thiefCatalog.skillsById.get(41068).icon,
    /Special:Redirect\/file\/Free_Action\.png$/,
  );
  assert.ok(
    thiefCatalog.skills
      .filter((skill) => skill.type === "Weapon")
      .every((skill) => Number.isFinite(Number(skill.initiativeCost))),
  );
});

test("Thief defaults migrate deterministic assumptions and validate bars", () => {
  const defaults = createThiefBuildDefaults();
  assert.deepEqual(validateThiefBuild(defaults), {
    valid: true,
    errors: [],
  });
  const migrated = migrateThiefBuild({
    ...defaults,
    assumptions: {
      ...defaults.assumptions,
      markedTargetChoice: "unmarked",
      playerHealthPercent: 20,
      targetDistance: 1200,
      artifactDrawSequence: "reverse",
      doubleEdgeOutcomeSequence: "success",
      forgedSurferBombsHit: "2",
    },
  });
  assert.equal(
    Object.hasOwn(migrated.assumptions, "artifactDrawSequence"),
    false,
  );
  assert.equal(
    Object.hasOwn(migrated.assumptions, "doubleEdgeOutcomeSequence"),
    false,
  );
  assert.equal(migrated.assumptions.forgedSurferBombsHit, "2");
  assert.equal(
    Object.hasOwn(migrated.assumptions, "markedTargetChoice"),
    false,
  );
  assert.equal(
    Object.hasOwn(migrated.assumptions, "playerHealthPercent"),
    false,
  );
  assert.equal(Object.hasOwn(migrated.assumptions, "targetDistance"), false);
  assert.equal(
    thiefProfession.ui.assumptionControls.some(
      (control) => control.key === "markedTargetChoice",
    ),
    false,
  );
  const keysFor = (specialization) =>
    new Set(
      assumptionControlsForSpecialization(
        thiefProfession.ui.assumptionControls,
        specialization,
      ).map((control) => control.key),
    );
  assert.equal(keysFor("Core").has("stolenSkillChoice"), true);
  assert.equal(keysFor("Daredevil").has("stolenSkillChoice"), true);
  assert.equal(keysFor("Deadeye").has("deadeyeStolenSkillChoice"), true);
  assert.equal(keysFor("Deadeye").has("stolenSkillChoice"), false);
  for (const controlKey of ["stolenSkillChoice", "deadeyeStolenSkillChoice"]) {
    const control = thiefProfession.ui.assumptionControls.find(
      (candidate) => candidate.key === controlKey,
    );
    assert.ok(
      control.options.every(
        (option) =>
          Number.isFinite(option.skillId) &&
          Boolean(thiefCatalog.skillsById.get(option.skillId)?.icon),
      ),
    );
  }
  assert.equal(keysFor("Antiquary").has("forgedSurferBombsHit"), true);
  assert.deepEqual(
    thiefProfession.ui.assumptionControls
      .filter((control) => ["forgedSurferBombsHit"].includes(control.key))
      .map((control) => control.section),
    ["Antiquary"],
  );
  for (const specialization of ["Core", "Daredevil", "Deadeye", "Specter"]) {
    assert.equal(keysFor(specialization).has("forgedSurferBombsHit"), false);
  }
  for (const specialization of [
    "Core",
    "Daredevil",
    "Deadeye",
    "Specter",
    "Antiquary",
  ]) {
    assert.equal(keysFor(specialization).has("playerHealthPercent"), false);
    assert.equal(keysFor(specialization).has("targetDistance"), false);
  }
  assert.equal(
    validateThiefBuild({
      ...defaults,
      weapons: ["Sword", "Sword"],
    }).valid,
    false,
  );
});

test("Thief resources use profession-specific initiative and malice pips", () => {
  const resourceViews = (specialization, config = {}) =>
    thiefProfession.ui.resourceViews({
      specialization,
      config: { specialization, ...config },
      professionState: thiefProfession
        .resolveRuntime({
          specialization,
        })
        .createProfessionState({ specialization, ...config }),
    });

  const coreInitiative = resourceViews("Core")[0];
  assert.equal(coreInitiative.displayMode, "pips");
  assert.equal(coreInitiative.pipStyle, "thief-initiative");
  assert.equal(coreInitiative.pipRows, 2);
  assert.equal(coreInitiative.maximum, 12);

  const preparedInitiative = resourceViews("Core", {
    traitIds: [TRAIT.PREPAREDNESS],
  })[0];
  assert.equal(preparedInitiative.maximum, 15);
  assert.equal(preparedInitiative.pipRows, 2);

  const antiquaryInitiative = resourceViews("Antiquary")[0];
  assert.equal(antiquaryInitiative.pipStyle, "thief-initiative");
  assert.equal(antiquaryInitiative.pipRows, 3);

  const deadeyeMalice = resourceViews("Deadeye").find(
    (view) => view.id === "malice",
  );
  assert.equal(deadeyeMalice.displayMode, "pips");
  assert.equal(deadeyeMalice.pipStyle, "thief-malice");

  const coreEndurance = resourceViews("Core").find(
    (view) => view.id === "endurance",
  );
  assert.equal(coreEndurance.maximum, 100);
  assert.equal(coreEndurance.value, 100);
  assert.equal(coreEndurance.displayMode, "bar");
  assert.equal(coreEndurance.pipStyle, "endurance");
  assert.equal(coreEndurance.canStart, false);

  const daredevilEndurance = resourceViews("Daredevil").find(
    (view) => view.id === "endurance",
  );
  assert.equal(daredevilEndurance.maximum, 150);

  const displayedInitiative = resourceDisplayViews(thiefProfession, {
    specialization: "Core",
    professionState: {
      initiative: 4.9,
      maximumInitiative: 12,
    },
  })[0];
  assert.equal(displayedInitiative.value, 4);
});

test("Thief Dodge waits for endurance and Vigor accelerates the queue", () => {
  const withoutVigor = simulate("Core", ["Dodge", "Dodge", "Dodge"], {
    boons: { vigor: false },
  });
  const withVigor = simulate("Core", ["Dodge", "Dodge", "Dodge"], {
    boons: { vigor: true },
  });

  assert.deepEqual(withoutVigor.warnings, []);
  assert.deepEqual(
    withoutVigor.steps.map((step) => step.start),
    [0, 800, 10000],
  );
  assert.deepEqual(withVigor.warnings, []);
  assert.deepEqual(
    withVigor.steps.map((step) => step.start),
    [0, 800, 6667],
  );
});

test("every legal one-hand combination resolves one exact opening slot 3", () => {
  const expected = new Map([
    ["Dagger/Dagger", "Death Blossom"],
    ["Dagger/Pistol", "Shadow Shot"],
    ["Dagger/", "Twisting Fangs"],
    ["Pistol/Dagger", "Shadow Strike"],
    ["Pistol/Pistol", "Unload"],
    ["Pistol/", "Repeater"],
    ["Sword/Dagger", "Flanking Strike"],
    ["Sword/Pistol", "Flawless Execution"],
    ["Sword/", "Stab"],
    ["Scepter/Dagger", "Twilight Combo"],
    ["Scepter/Pistol", "Measured Shot"],
    ["Scepter/", "Triple Threat"],
    ["Axe/Dagger", "Harrowing Storm"],
    ["Axe/Pistol", "Orchestrated Assault"],
    ["Axe/", "Recall Axes"],
  ]);
  for (const [key, name] of expected) {
    const pair = key.split("/");
    const roots = thiefCatalog.skills.filter(
      (skill) =>
        skill.type === "Weapon" &&
        skill.slot === "Weapon_3" &&
        skill.flipParentId == null &&
        thiefWeaponSkillMatchesSet(skill, pair, {
          catalog: thiefCatalog,
        }),
    );
    assert.deepEqual(
      roots.map((skill) => skill.name),
      [name],
      key,
    );
  }
  assert.equal(
    thiefCatalog.skills.some(
      (skill) =>
        skill.type === "Weapon" &&
        skill.slot === "Weapon_3" &&
        thiefWeaponSkillMatchesSet(skill, ["Sword", "Sword"], {
          catalog: thiefCatalog,
        }),
    ),
    false,
  );
});

test("dual-wield follow-ups require and consume their opening skill", () => {
  const denied = simulate("Core", ["Larcenous Strike"], {
    primaryWeapon: "Sword",
    secondaryWeapon: "Dagger",
  });
  assert.match(denied.warnings[0], /opening dual-wield skill/);
  const result = simulate("Core", ["Flanking Strike", "Larcenous Strike"], {
    primaryWeapon: "Sword",
    secondaryWeapon: "Dagger",
  });
  assert.equal(result.warnings.length, 0);
  assert.ok(result.totalDamage > 0);
  assert.equal(result.endState.profession.availableFlips[13007], undefined);
});

test("every terrestrial main hand exposes its normal stealth attack", () => {
  const expected = new Map([
    ["Dagger", "Backstab"],
    ["Pistol", "Sneak Attack"],
    ["Sword", "Tactical Strike"],
    ["Shortbow", "Surprise Shot"],
    ["Staff", "Hook Strike"],
    ["Rifle", "Death's Judgment"],
    ["Scepter", "Shadowsquall"],
    ["Axe", "Cunning Salvo"],
    ["Spear", "Ashen Assault"],
  ]);
  for (const [weapon, name] of expected) {
    assert.ok(
      thiefCatalog.skills.some(
        (skill) =>
          skill.name === name &&
          skill.stealthAttack &&
          !skill.malicious &&
          skill.requiredMainHand === weapon,
      ),
      weapon,
    );
  }
});

test("initiative regenerates at exact boundaries and ignores Alacrity", () => {
  const boundary = simulate("Core", ["Death Blossom"], {
    initialInitiative: 3,
  });
  assert.equal(boundary.warnings.length, 0);
  assert.equal(boundary.steps[0].start, 1000);
  assert.equal(boundary.endState.profession.initiative, 1.56);

  for (const alacrity of [false, true]) {
    const result = simulate("Core", [{ type: "wait", durationMs: 5000 }], {
      initialInitiative: 0,
      boons: { alacrity },
    });
    assert.equal(result.endState.profession.initiative, 5);
  }

  const kneeling = simulate(
    "Deadeye",
    ["Kneel", { type: "wait", durationMs: 3000 }],
    {
      initialInitiative: 1,
      primaryWeapon: "Rifle",
      secondaryWeapon: "",
    },
  );
  assert.equal(kneeling.warnings.length, 0);
  assert.ok(Math.abs(kneeling.endState.profession.initiative - 14 / 3) < 1e-9);
});

test("weapon swap preserves shared initiative", () => {
  const result = simulate("Core", ["Death Blossom", "Swap Weapons", "Unload"]);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.activeWeaponSet, 2);
  assert.ok(result.endState.profession.initiative < 9);
  assert.ok(result.events.some((event) => event.type === "weapon_set"));

  const resetChain = simulate(
    "Core",
    ["Double Strike", "Swap Weapons", "Double Strike"],
    {
      weaponSet2Primary: "Dagger",
      weaponSet2Secondary: "Dagger",
    },
  );
  assert.deepEqual(resetChain.warnings, []);
  assert.equal(
    resetChain.steps.filter((step) => step.skill === "Double Strike").length,
    2,
  );
});

test("stealth attacks remove stealth, apply Revealed, and block replacement", () => {
  const result = simulate("Core", [
    "Cloak and Dagger",
    "Backstab",
    "Cloak and Dagger",
    "Backstab",
  ]);
  assert.match(result.warnings.at(-1), /requires stealth/);
  assert.ok(result.endState.profession.revealedUntil > 0);
  assert.equal(
    result.endState.profession.stealthUntil <= result.duration,
    true,
  );
});

test("stealth replaces weapon skill 1 without a separate palette group", () => {
  const context = {
    specialization: "Core",
    time: 1,
    activeWeaponSet: 1,
    build: {
      weapons: ["Dagger", "Dagger"],
      alternateWeapons: ["Pistol", "Pistol"],
    },
    professionState: {
      stealthUntil: 4,
      revealedUntil: 0,
    },
  };
  const groups = thiefProfession.ui.paletteGroups(context);
  assert.equal(
    groups.some((group) => group.id === "thief-stealth-attacks"),
    false,
  );
  assert.equal(
    thiefProfession.ui.isPaletteSkillAvailable(
      context,
      thiefCatalog.skillsByName.get("Backstab"),
    ),
    true,
  );
  assert.equal(
    thiefProfession.ui.isPaletteSkillAvailable(
      context,
      thiefCatalog.skillsByName.get("Double Strike"),
    ),
    false,
  );
});

test("Deadeye palette uses malicious stealth attacks and one stateful rifle bar", () => {
  const deadeyesMark = thiefCatalog.skillsByName.get("Deadeye's Mark");
  assert.equal(deadeyesMark.flipParentId, null);

  const matchingNames = (pair, kneeling) =>
    thiefCatalog.skills
      .filter(
        (skill) =>
          skill.type === "Weapon" &&
          thiefWeaponSkillMatchesSet(skill, pair, {
            catalog: thiefCatalog,
            specialization: "Deadeye",
            professionState: { kneeling },
          }),
      )
      .map((skill) => skill.name);

  const dagger = matchingNames(["Dagger", "Dagger"], false);
  assert.ok(dagger.includes("Malicious Backstab"));
  assert.equal(dagger.includes("Backstab"), false);

  const standing = matchingNames(["Rifle", ""], false);
  assert.ok(standing.includes("Brutal Aim"));
  assert.ok(standing.includes("Double Tap"));
  assert.ok(standing.includes("Skirmisher's Shot"));
  assert.ok(standing.includes("Kneel"));
  assert.ok(standing.includes("Malicious Death's Judgment"));
  assert.equal(standing.includes("Deadly Aim"), false);
  assert.equal(standing.includes("Three Round Burst"), false);
  assert.equal(standing.includes("Spotter's Shot"), false);
  assert.equal(standing.includes("Free Action"), false);
  assert.equal(standing.includes("Death's Judgment"), false);

  const kneeling = matchingNames(["Rifle", ""], true);
  assert.ok(kneeling.includes("Deadly Aim"));
  assert.ok(kneeling.includes("Three Round Burst"));
  assert.ok(kneeling.includes("Spotter's Shot"));
  assert.ok(kneeling.includes("Free Action"));
  assert.equal(kneeling.includes("Brutal Aim"), false);
  assert.equal(kneeling.includes("Double Tap"), false);
  assert.equal(kneeling.includes("Skirmisher's Shot"), false);
  assert.equal(kneeling.includes("Kneel"), false);

  const paletteGroups = thiefProfession.ui.paletteGroups({
    specialization: "Deadeye",
    build: { weapons: ["Rifle", ""], alternateWeapons: ["Dagger", "Dagger"] },
    activeWeaponSet: 1,
    professionState: { kneeling: false },
  });
  assert.equal(
    paletteGroups.some((group) => group.id === "thief-rifle-stance"),
    false,
  );

  const professionGroup = thiefProfession.ui
    .paletteGroups({
      specialization: "Deadeye",
      professionState: {
        professionSkillId: ID.DEADEYES_MARK,
        storedStolenSkillId: ID.STEAL_TIME,
        storedStolenSkillCount: 1,
      },
    })
    .find((group) => group.id === "thief-profession");
  assert.deepEqual(professionGroup.skillIds, [ID.DEADEYES_MARK, ID.STEAL_TIME]);
  assert.equal(
    thiefProfession.ui.isPaletteSkillAvailable(
      {
        specialization: "Deadeye",
        professionState: {
          storedStolenSkillId: ID.STEAL_TIME,
          storedStolenSkillCount: 1,
        },
      },
      thiefCatalog.skillsById.get(ID.STEAL_TIME),
    ),
    true,
  );
});

test("Steal stores and consumes the deterministic raid-golem stolen skill", () => {
  const stored = simulate("Core", ["Steal"]);
  assert.equal(
    thiefCatalog.skillsById.get(stored.endState.profession.storedStolenSkillId)
      .name,
    "Throw Gunk",
  );
  const used = simulate("Core", ["Steal", "Throw Gunk"]);
  assert.equal(used.warnings.length, 0);
  assert.equal(used.endState.profession.storedStolenSkillId, null);
});

test("Daredevil capacity and every dodge replacement resolve explicitly", () => {
  const expectations = new Map([
    ["Lotus Training", "condition"],
    ["Bounding Dodger", "damage"],
    ["Unhindered Combatant", "boon"],
  ]);
  for (const [selectedDodge, eventType] of expectations) {
    const traitId =
      TRAIT[selectedDodge.toUpperCase().replace(/[^A-Z0-9]+/g, "_")];
    const result = simulate("Daredevil", ["Dodge"], {
      selectedDodge,
      selectedTraitIds: [traitId],
    });
    assert.equal(result.endState.profession.maximumEndurance, 150);
    assert.ok(result.events.some((event) => event.type === eventType));
    if (selectedDodge === "Bounding Dodger") {
      const stateIndex = result.events.findIndex(
        (event) =>
          event.type === "thief.state" && event.reason === "daredevil-dodge",
      );
      const boundIndex = result.events.findIndex(
        (event) => event.type === "damage" && event.name === "Bound",
      );
      assert.ok(stateIndex >= 0 && stateIndex < boundIndex);
    }
  }

  const impalingLotus = simulate("Daredevil", ["Dodge"], {
    selectedDodge: "Lotus Training",
    selectedTraitIds: [TRAIT.LOTUS_TRAINING],
  });
  assert.deepEqual(
    impalingLotus.events
      .filter(
        (event) =>
          event.type === "damage" && event.skillName === "Impaling Lotus",
      )
      .map(({ at, coefficient }) => [at, coefficient]),
    [
      [0.2, 0.1875],
      [0.36, 0.1875],
      [0.52, 0.1875],
    ],
  );
  assert.deepEqual(
    impalingLotus.events
      .filter(
        (event) =>
          event.type === "condition" && event.skillName === "Impaling Lotus",
      )
      .map(({ at, condition, stacks, duration }) => [
        at,
        condition,
        stacks,
        duration,
      ]),
    [
      [0.2, "Bleeding", 2, 4],
      [0.36, "Torment", 2, 4],
      [0.52, "Crippled", 1, 3],
    ],
  );
});

test("Exposed Weakness multiplies separately from additive strike bonuses", () => {
  const config = {
    selectedTraitIds: [TRAIT.EXPOSED_WEAKNESS],
    sigilSets: [
      { names: ["Test"], strike: 1.08, strikeAdd: 0.08 },
      { names: [], strike: 1, strikeAdd: 0 },
    ],
    target: {
      conditions: { Vulnerability: 25, Weakness: true },
    },
  };
  const exposed = simulate("Core", ["Double Strike"], config);
  const baseline = simulate("Core", ["Double Strike"], {
    ...config,
    selectedTraitIds: [],
  });
  const damage = (result) =>
    result.breakdown.find((entry) => entry.name === "Double Strike").damage;

  assert.ok(Math.abs(damage(exposed) / damage(baseline) - 1.04) < 1e-12);
});

test("Daredevil benchmark skills and endurance traits use supplied values", () => {
  const expectedQuicknessTimes = new Map([
    [ID.BACKSTAB, 320],
    [ID.FIST_FLURRY, 680],
    [ID.IMPAIRING_DAGGERS, 480],
    [ID.PALM_STRIKE, 480],
    [ID.CHANNELED_VIGOR, 480],
  ]);
  for (const [skillId, duration] of expectedQuicknessTimes) {
    assert.equal(
      thiefCatalog.skillsById.get(skillId).quicknessCastTimeMs,
      duration,
    );
  }
  const backstabStrike = thiefCatalog.skillsById
    .get(ID.BACKSTAB)
    .effects.find((effect) => effect.type === "strike");
  assert.deepEqual(
    [
      backstabStrike.atMs,
      backstabStrike.timingAnchor,
      backstabStrike.timingScale,
    ],
    [200, "castStart", "fixed"],
  );
  const interruptedBackstab = simulate(
    "Daredevil",
    ["Cloak and Dagger", { name: "Backstab", interruptMs: 280 }],
    { stats: { precision: 5000 } },
  );
  assert.equal(interruptedBackstab.steps[1].interrupted, true);
  assert.equal(
    interruptedBackstab.steps[1].end - interruptedBackstab.steps[1].start,
    280,
  );
  assert.equal(
    interruptedBackstab.breakdown.find(
      (entry) => entry.sourceSkill === "Backstab",
    ).hits,
    1,
  );
  assert.equal(thiefCatalog.skillsById.get(ID.DODGE).castTimeMs, 800);
  assert.equal(
    thiefCatalog.skillsById.get(ID.DODGE).quicknessCastTimeMs,
    undefined,
  );
  assert.equal(
    thiefCatalog.skillsById.get(ID.DODGE).unaffectedByQuickness,
    true,
  );
  assert.equal(
    thiefCatalog.skillsById.get(ID.CHANNELED_VIGOR).enduranceGain,
    125,
  );

  const totalCoefficient = (name) => {
    const strike = thiefCatalog.skillsByName
      .get(name)
      .effects.find((effect) => effect.type === "strike");
    return strike.ticks
      ? strike.ticks.reduce((sum, tick) => sum + tick.coefficient, 0)
      : strike.coefficient;
  };
  assert.equal(totalCoefficient("Fist Flurry"), 3.75);
  assert.equal(totalCoefficient("Impairing Daggers"), 2.5);
  assert.deepEqual(
    thiefCatalog.skillsByName
      .get("Impairing Daggers")
      .effects.find((effect) => effect.type === "strike")
      .ticks.map((tick) => tick.coefficient),
    [0.75, 0.75, 1],
  );

  const directPalm = simulate("Daredevil", ["Palm Strike"]);
  assert.match(directPalm.warnings[0], /Fist Flurry must connect/i);

  const traits = [
    TRAIT.BRAWLERS_TENACITY,
    TRAIT.WEAKENING_STRIKES,
    TRAIT.BOUNDING_DODGER,
  ];
  const skillSequence = [
    "Dodge",
    "Fist Flurry",
    "Palm Strike",
    { name: "__wait", waitMs: 2100 },
  ];
  const base = simulate("Daredevil", skillSequence, {
    selectedDodge: "Bounding Dodger",
    selectedTraitIds: traits.filter((id) => id !== TRAIT.BRAWLERS_TENACITY),
  });
  const brawler = simulate("Daredevil", skillSequence, {
    selectedDodge: "Bounding Dodger",
    selectedTraitIds: traits,
  });
  assert.deepEqual(brawler.warnings, []);
  assert.ok(
    Math.abs(
      brawler.endState.profession.endurance -
        base.endState.profession.endurance -
        15,
    ) < 1e-9,
  );
  assert.ok(
    brawler.resolvedEvents.some(
      (event) =>
        event.type === "condition" &&
        event.condition === "Weakness" &&
        event.sourceId === TRAIT.WEAKENING_STRIKES,
    ),
  );
  const palm = brawler.resolvedEvents.find(
    (event) => event.type === "damage" && event.name === "Palm Strike",
  );
  const pulmonary = brawler.resolvedEvents.filter(
    (event) => event.type === "damage" && event.name === "Pulmonary Impact",
  );
  assert.equal(pulmonary.length, 2);
  assert.ok(
    pulmonary.every(
      (event) =>
        event.canCrit === false && Math.abs(event.at - palm.at - 2) < 1e-9,
    ),
  );

  const withoutSteal = simulate("Daredevil", ["Dodge", "Dodge", "Steal"]);
  const withSteal = simulate("Daredevil", ["Dodge", "Dodge", "Steal"], {
    selectedTraitIds: [TRAIT.ENDURANCE_THIEF],
  });
  assert.ok(
    Math.abs(
      withSteal.endState.profession.endurance -
        withoutSteal.endState.profession.endurance -
        50,
    ) < 1e-9,
  );

  const havoc = daredevilModifierRules.find(
    (rule) => rule.id === "thief.havoc-specialist",
  );
  const weakening = daredevilModifierRules.find(
    (rule) => rule.id === "thief.weakening-strikes",
  );
  assert.equal(havoc.operation, "multiply");
  assert.equal(havoc.factor, 1.15);
  assert.equal(weakening.operation, "multiply");
  assert.equal(weakening.factor, 1.1);
});

test("Daredevil Staff skills use supplied coefficients and effects", () => {
  const expected = [
    ["Staff Strike", 0.85, 1, 0],
    ["Staff Bash", 0.9, 1, 0],
    ["Punishing Strikes", 2.1, 4, 0],
    ["Hook Strike", 0.65, 1, 0],
    ["Weakening Whirl", 2.22, 3, 3],
    ["Debilitating Arc", 1, 1, 3],
    ["Helmet Breaker", 1.25, 1, 1],
    ["Dust Strike", 1.8, 3, 4],
    ["Vault", 2.25, 1, 5],
  ];
  for (const [name, coefficient, hits, initiativeCost] of expected) {
    const skill = thiefCatalog.skillsByName.get(name);
    const strike = skill.effects.find((effect) => effect.type === "strike");
    assert.equal(skill.weapon, "Staff", name);
    assert.equal(strike.coefficient, coefficient, name);
    assert.equal(strike.hits, hits, name);
    assert.equal(skill.initiativeCost, initiativeCost, name);
  }

  const expectedQuicknessTimes = [
    ["Staff Strike", 360],
    ["Staff Bash", 360],
    ["Punishing Strikes", 760],
    ["Weakening Whirl", 720],
    ["Debilitating Arc", 200],
    ["Hook Strike", 640],
  ];
  for (const [name, quicknessCastTimeMs] of expectedQuicknessTimes) {
    const skill = thiefCatalog.skillsByName.get(name);
    assert.equal(skill.quicknessCastTimeMs, quicknessCastTimeMs, name);
    assert.equal(skill.castTimeMs, quicknessCastTimeMs * 1.5, name);
  }

  for (const name of ["Punishing Strikes", "Weakening Whirl"]) {
    const skill = thiefCatalog.skillsByName.get(name);
    assert.equal(skill.finisherType, "Whirl", name);
    assert.equal(skill.finisherValue, 1, name);
  }

  const impalingLotus = thiefCatalog.skillsByName.get("Impaling Lotus");
  assert.equal(impalingLotus.finisherType, "Whirl");
  assert.equal(impalingLotus.finisherValue, 1);

  const punishing = thiefCatalog.skillsByName.get("Punishing Strikes");
  const vulnerability = punishing.effects.find(
    (effect) => effect.type === "condition",
  );
  assert.deepEqual(
    [vulnerability.condition, vulnerability.stacks, vulnerability.duration],
    ["Vulnerability", 4, 8],
  );

  const weakening = thiefCatalog.skillsByName.get("Weakening Whirl");
  const weakness = weakening.effects.find(
    (effect) => effect.type === "condition",
  );
  assert.deepEqual(
    [weakness.condition, weakness.stacks, weakness.duration],
    ["Weakness", 1, 2],
  );

  const arc = thiefCatalog.skillsByName.get("Debilitating Arc");
  const cripple = arc.effects.find((effect) => effect.type === "condition");
  assert.deepEqual(
    [cripple.condition, cripple.stacks, cripple.duration],
    ["Crippled", 1, 6],
  );

  const hook = thiefCatalog.skillsByName.get("Hook Strike");
  const hookControl = hook.effects.find((effect) => effect.type === "control");
  assert.equal(hook.stealthAttack, true);
  assert.equal(hookControl.metadata.controlKind, "knockdown");

  const helmet = thiefCatalog.skillsByName.get("Helmet Breaker");
  const helmetControl = helmet.effects.find(
    (effect) => effect.type === "control",
  );
  assert.equal(helmetControl.metadata.controlKind, "daze");

  const dust = thiefCatalog.skillsByName.get("Dust Strike");
  const blind = dust.effects.find((effect) => effect.type === "blind");
  assert.equal(blind.metadata.duration, 1);
});

test("Deadeye cantrips, malice, stolen skills, and traits are stateful", () => {
  const deadeyeTraits = [
    TRAIT.MALICIOUS_INTENT,
    TRAIT.ONE_IN_THE_CHAMBER,
    TRAIT.FIRE_FOR_EFFECT,
  ];
  const result = simulate("Deadeye", ["Deadeye's Mark", "Death Blossom"], {
    selectedTraitIds: deadeyeTraits,
    stats: { precision: 5000 },
  });
  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.profession.markedTargetId, "primary-target");
  assert.equal(result.endState.profession.storedStolenSkillId, ID.STEAL_TIME);
  assert.equal(result.endState.profession.storedStolenSkillCount, 1);
  assert.equal(result.endState.profession.malice, 5);
  assert.ok(
    result.resolvedEvents.filter(
      (event) => event.skillName === "Death Blossom" && event.type === "damage",
    ).length > 1,
  );

  const consumed = simulate(
    "Deadeye",
    [
      "Deadeye's Mark",
      "Death Blossom",
      "Cloak and Dagger",
      "Malicious Backstab",
    ],
    {
      selectedTraitIds: [TRAIT.MALICIOUS_INTENT],
      stats: { precision: 5000 },
    },
  );
  assert.equal(consumed.warnings.length, 0);
  assert.equal(consumed.endState.profession.malice, 0);

  const noMaliceStealth = simulate(
    "Deadeye",
    ["Deadeye's Mark", "Steal Defenses"],
    {
      deterministicChoices: {
        deadeyeStolenSkillChoice: "steal-defenses",
      },
    },
  );
  assert.equal(noMaliceStealth.warnings.length, 0);
  assert.equal(noMaliceStealth.endState.profession.storedStolenSkillId, null);
  assert.equal(noMaliceStealth.endState.profession.stealthUntil, 0);

  const stolen = simulate(
    "Deadeye",
    ["Deadeye's Mark", "Death Blossom", "Steal Time"],
    {
      selectedTraitIds: deadeyeTraits,
      stats: { precision: 5000 },
    },
  );
  assert.equal(stolen.warnings.length, 0);
  assert.ok(stolen.endState.profession.stealthUntil > stolen.duration);
  assert.ok(
    stolen.events.some(
      (event) =>
        event.name?.includes("Fire for Effect") && event.boon === "Might",
    ),
  );

  const improvised = simulate(
    "Deadeye",
    ["Deadeye's Mark", "Steal Time", "Steal Time"],
    { selectedTraitIds: [TRAIT.IMPROVISATION] },
  );
  assert.equal(improvised.warnings.length, 0);
  assert.equal(improvised.endState.profession.storedStolenSkillId, null);
  assert.equal(improvised.endState.profession.storedStolenSkillCount, 0);

  const mercy = simulate(
    "Deadeye",
    ["Deadeye's Mark", "Death Blossom", "Mercy", "Deadeye's Mark"],
    {
      selectedTraitIds: deadeyeTraits,
      selectedSkills: ["Mercy"],
      stats: { precision: 5000 },
    },
  );
  assert.equal(mercy.warnings.length, 0);
  assert.equal(mercy.endState.profession.markGeneration, 2);
  assert.equal(mercy.endState.profession.malice, 2);

  const chamber = simulate("Deadeye", ["Shadow Flare"], {
    selectedTraitIds: [TRAIT.ONE_IN_THE_CHAMBER],
    selectedSkills: ["Shadow Flare"],
  });
  assert.equal(chamber.endState.profession.storedStolenSkillId, ID.STEAL_TIME);

  const expired = simulate(
    "Deadeye",
    ["Deadeye's Mark", { type: "wait", durationMs: 30_001 }],
    { selectedTraitIds: [TRAIT.MALICIOUS_INTENT] },
  );
  assert.equal(expired.endState.profession.markedTargetId, null);
  assert.equal(expired.endState.profession.malice, 0);
});

test("Deadeye strike modifiers, grandmasters, and stealth attacks use supplied values", () => {
  const skillDamage = (result, name) =>
    result.breakdown.find(
      (entry) => entry.sourceSkill === name || entry.name === name,
    )?.damage || 0;
  const ratio = (withEffect, withoutEffect, skill) =>
    skillDamage(withEffect, skill) / skillDamage(withoutEffect, skill);
  const fullCrit = { stats: { precision: 5000 } };

  const plainFlare = simulate("Deadeye", ["Shadow Flare"], {
    ...fullCrit,
    selectedSkills: ["Shadow Flare"],
  });
  const markedFlare = simulate("Deadeye", ["Deadeye's Mark", "Shadow Flare"], {
    ...fullCrit,
    selectedSkills: ["Shadow Flare"],
  });
  assert.ok(
    Math.abs(ratio(markedFlare, plainFlare, "Shadow Flare") - 1.5) < 1e-9,
  );
  assert.ok(
    markedFlare.endState.profession.availableFlips[ID.SHADOW_SWAP] >
      markedFlare.duration,
  );

  const plainStolen = simulate(
    "Deadeye",
    ["Deadeye's Mark", "Steal Time"],
    fullCrit,
  );
  const stealTimeStrike = thiefCatalog.skillsByName
    .get("Steal Time")
    .effects.find((effect) => effect.type === "strike");
  const plainStealTimeEvent = plainStolen.resolvedEvents.find(
    (event) => event.skillName === "Steal Time" && event.type === "damage",
  );
  assert.equal(stealTimeStrike.coefficient, 1);
  assert.equal(plainStealTimeEvent.weaponStrengthProfileId, "weapon.dagger");
  const chamberStolen = simulate("Deadeye", ["Deadeye's Mark", "Steal Time"], {
    ...fullCrit,
    selectedTraitIds: [TRAIT.ONE_IN_THE_CHAMBER],
  });
  assert.ok(
    Math.abs(ratio(chamberStolen, plainStolen, "Steal Time") - 1.25) < 1e-9,
  );

  const markedSword = simulate("Deadeye", ["Deadeye's Mark", "Slice"], {
    ...fullCrit,
    primaryWeapon: "Sword",
    secondaryWeapon: "Pistol",
  });
  const ironSight = simulate("Deadeye", ["Deadeye's Mark", "Slice"], {
    ...fullCrit,
    primaryWeapon: "Sword",
    secondaryWeapon: "Pistol",
    selectedTraitIds: [TRAIT.IRON_SIGHT],
  });
  assert.ok(Math.abs(ratio(ironSight, markedSword, "Slice") - 1.1) < 1e-9);

  const plainCantrip = simulate("Deadeye", ["Mercy", "Slice"], {
    ...fullCrit,
    primaryWeapon: "Sword",
    secondaryWeapon: "Pistol",
    selectedSkills: ["Mercy"],
  });
  const relicCantrip = simulate("Deadeye", ["Mercy", "Slice"], {
    ...fullCrit,
    primaryWeapon: "Sword",
    secondaryWeapon: "Pistol",
    selectedSkills: ["Mercy"],
    relic: "Deadeye",
  });
  assert.ok(Math.abs(ratio(relicCantrip, plainCantrip, "Slice") - 1.1) < 1e-9);

  const boonConfig = {
    ...fullCrit,
    primaryWeapon: "Sword",
    secondaryWeapon: "Pistol",
    boons: { fury: true, quickness: true, vigor: true },
  };
  const plainBoonStrike = simulate("Deadeye", ["Slice"], boonConfig);
  const premeditated = simulate("Deadeye", ["Slice"], {
    ...boonConfig,
    selectedTraitIds: [TRAIT.PREMEDITATION],
  });
  const premeditationRatio = ratio(premeditated, plainBoonStrike, "Slice");
  assert.ok(Math.abs(premeditationRatio - 1.03) < 1e-9, premeditationRatio);

  const quickKiller = simulate("Deadeye", ["Slice"], {
    ...boonConfig,
    selectedTraitIds: [TRAIT.BE_QUICK_OR_BE_KILLED],
  });
  const quickKillerRatio = ratio(quickKiller, plainBoonStrike, "Slice");
  assert.ok(Math.abs(quickKillerRatio - 2380 / 2180) < 1e-9, quickKillerRatio);
  const markedKiller = simulate("Deadeye", ["Deadeye's Mark"], {
    selectedTraitIds: [TRAIT.BE_QUICK_OR_BE_KILLED],
  });
  assert.ok(
    markedKiller.events.some(
      (event) => event.boon === "Quickness" && event.duration === 4,
    ),
  );

  const seven = simulate(
    "Deadeye",
    ["Deadeye's Mark", "Death Blossom", "Death Blossom", "Death Blossom"],
    {
      ...fullCrit,
      selectedTraitIds: [TRAIT.MALICIOUS_INTENT, TRAIT.MALEFICENT_SEVEN],
    },
  );
  assert.equal(seven.warnings.length, 0);
  assert.equal(seven.endState.profession.maximumMalice, 7);
  assert.equal(seven.endState.profession.malice, 7);
  assert.ok(
    seven.events.some((event) => event.name?.includes("Maleficent Seven")),
  );

  const silent = simulate(
    "Deadeye",
    [
      "Deadeye's Mark",
      "Death Blossom",
      "Death Blossom",
      "Dodge",
      "Malicious Backstab",
    ],
    { ...fullCrit, selectedTraitIds: [TRAIT.SILENT_SCOPE] },
  );
  assert.equal(silent.warnings.length, 0);
  assert.equal(silent.endState.profession.stealthAttackCharges, 0);

  const sneak = thiefCatalog.skillsByName.get("Malicious Sneak Attack");
  const sneakStrike = sneak.effects.find((effect) => effect.type === "strike");
  const sneakTorment = sneak.effects.find(
    (effect) => effect.type === "condition" && effect.condition === "Torment",
  );
  assert.deepEqual([sneakStrike.coefficient, sneakStrike.hits], [1.8, 5]);
  assert.deepEqual([sneakTorment.stacks, sneakTorment.duration], [1, 1]);

  for (const [name, quicknessCastTimeMs] of [
    ["Deadly Aim", 600],
    ["Three Round Burst", 840],
    ["Steal Time", 280],
    ["Shadow Flare", 480],
    ["Shadow Meld", 440],
    ["Malicious Death's Judgment", 600],
    ["Malicious Tactical Strike", 440],
  ]) {
    assert.equal(
      thiefCatalog.skillsByName.get(name).quicknessCastTimeMs,
      quicknessCastTimeMs,
      name,
    );
  }

  const threeRoundBurst = thiefCatalog.skillsByName.get("Three Round Burst");
  assert.deepEqual(
    threeRoundBurst.effects
      .filter((effect) => effect.type === "strike")
      .map((effect) => [effect.coefficient, effect.hits]),
    [[2.25, 3]],
  );

  const maliciousSneak = simulate(
    "Deadeye",
    ["Deadeye's Mark", "Unload", "Steal Time", "Malicious Sneak Attack"],
    {
      ...fullCrit,
      primaryWeapon: "Pistol",
      secondaryWeapon: "Pistol",
      selectedTraitIds: [TRAIT.MALICIOUS_INTENT],
    },
  );
  assert.equal(maliciousSneak.warnings.length, 0);
  assert.equal(
    maliciousSneak.events.find(
      (event) =>
        event.skillName === "Malicious Sneak Attack" &&
        event.condition === "Torment",
    ).duration,
    11,
  );
  assert.equal(
    maliciousSneak.resolvedEvents.filter(
      (event) =>
        event.skillName === "Malicious Sneak Attack" && event.type === "damage",
    ).length,
    5,
  );
});

test("Kneel replaces the rifle bar until Free Action or weapon swap", () => {
  const result = simulate(
    "Deadeye",
    ["Kneel", "Three Round Burst", "Free Action", "Double Tap"],
    {
      primaryWeapon: "Rifle",
      secondaryWeapon: "",
    },
  );
  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.profession.kneeling, false);
  assert.ok(result.totalDamage > 0);
});

test("Deadeye rifle stance rejects every inactive replacement", () => {
  const rifle = {
    primaryWeapon: "Rifle",
    secondaryWeapon: "",
  };
  for (const skill of [
    "Deadly Aim",
    "Three Round Burst",
    "Spotter's Shot",
    "Free Action",
  ]) {
    const result = simulate("Deadeye", [skill], rifle);
    assert.match(result.warnings[0], /kneel/i, skill);
  }
  for (const skill of [
    "Brutal Aim",
    "Double Tap",
    "Skirmisher's Shot",
    "Kneel",
  ]) {
    const result = simulate("Deadeye", ["Kneel", skill], rifle);
    assert.match(result.warnings[0], /kneel|rifle skill/i, skill);
  }
});

test("Specter Siphon, initiative spending, and Shadow Shroud share force", () => {
  const inactiveGroups = thiefProfession.ui.paletteGroups({
    specialization: "Specter",
    professionState: {
      shadowForce: 0,
      shadowShroudActive: false,
    },
  });
  assert.deepEqual(
    inactiveGroups
      .find((group) => group.id === "thief-shadow-shroud")
      .skillIds.map((id) => thiefCatalog.skillsById.get(id)?.name),
    [
      "Haunt Shot",
      "Grasping Shadows",
      "Dawn's Repose",
      "Eternal Night",
      "Mind Shock",
    ],
  );
  assert.equal(
    thiefProfession.ui.isPaletteSkillAvailable(
      {
        specialization: "Specter",
        professionState: {
          shadowForce: 0,
          shadowShroudActive: false,
        },
      },
      thiefCatalog.skillsByName.get("Enter Shadow Shroud"),
    ),
    false,
  );

  const result = simulate(
    "Specter",
    ["Siphon", "Enter Shadow Shroud", "Haunt Shot", "Exit Shadow Shroud"],
    {
      primaryWeapon: "Scepter",
      secondaryWeapon: "Pistol",
    },
  );
  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.profession.shadowShroudActive, false);
  assert.equal(result.endState.profession.storedStolenSkillId, null);
  assert.ok(result.endState.profession.shadowForce > 0);
  assert.equal(
    result.events.filter((event) => event.type === "sigil_swap").length,
    0,
  );
  assert.equal(
    result.events.filter(
      (event) => event.type === "weapon_set" && event.shroudSwap,
    ).length,
    2,
  );
});

test("Specter automatically leaves Shadow Shroud when shadow force depletes", () => {
  const result = simulate(
    "Specter",
    ["Enter Shadow Shroud", { type: "wait", durationMs: 1000 }],
    {
      initialShadowForce: 1,
    },
  );
  assert.equal(result.endState.profession.shadowShroudActive, false);
  assert.equal(result.endState.profession.shadowForce, 0);
  assert.equal(
    result.events.filter(
      (event) => event.type === "weapon_set" && event.shroudSwap,
    ).length,
    2,
  );
});

test("Specter shadow force is 69% of health and drains 2% per second", () => {
  const capacity = simulate("Specter", [], {
    stats: { vitality: 1000 },
  }).endState.profession;
  const drained = simulate(
    "Specter",
    [
      "Enter Shadow Shroud",
      { type: "wait", durationMs: 1000 },
      "Exit Shadow Shroud",
    ],
    {
      initialShadowForce: 100,
      stats: { vitality: 1000 },
    },
  ).endState.profession;

  assert.equal(capacity.maximumHealth, 11645);
  assert.equal(capacity.shadowForcePoolCapacity, 11645 * 0.69);
  assert.equal(drained.shadowForce, 98);
});

test("Dagger uses the supplied Quickness timings and total multi-hit coefficients", () => {
  const expectedQuicknessTimes = new Map([
    [ID.DOUBLE_STRIKE, 360],
    [ID.WILD_STRIKE, 400],
    [ID.LOTUS_STRIKE, 440],
    [ID.HEARTSEEKER, 600],
    [ID.DEATH_BLOSSOM, 1040],
    [ID.DANCING_DAGGER, 500],
    [ID.CLOAK_AND_DAGGER, 600],
    [ID.MALICIOUS_BACKSTAB, 440],
  ]);
  for (const [skillId, quicknessTime] of expectedQuicknessTimes) {
    const skill = thiefCatalog.skillsById.get(skillId);
    assert.equal(skill.quicknessCastTimeMs, quicknessTime, skill.name);
    assert.equal(skill.castTimeMs, quicknessTime * 1.5, skill.name);
  }

  const expectedPackets = [
    ["Double Strike", 2, 0.8],
    ["Twisting Fangs", 2, 0.63],
    ["Death Blossom", 3, 0.63],
  ];
  for (const [name, hits, totalCoefficient] of expectedPackets) {
    const strike = thiefCatalog.skillsByName
      .get(name)
      .effects.find((effect) => effect.type === "strike");
    assert.equal(strike.ticks?.length || strike.hits, hits, name);
    assert.equal(
      strike.ticks
        ? strike.ticks.reduce((sum, tick) => sum + tick.coefficient, 0)
        : strike.coefficient,
      totalCoefficient,
      name,
    );
  }

  const heartseeker = thiefCatalog.skillsByName.get("Heartseeker");
  const heartseekerStrike = heartseeker.effects.find(
    (effect) => effect.type === "strike",
  );
  assert.equal(heartseekerStrike.coefficient, 1);
  assert.deepEqual(heartseekerStrike.coefficientModifiers, [
    { kind: "target-health-below", threshold: 0.25, multiplier: 2.22 },
    { kind: "target-health-below", threshold: 0.5, multiplier: 1.6 },
  ]);

  const deathBlossom = thiefCatalog.skillsByName.get("Death Blossom");
  assert.equal(deathBlossom.finisherType, "Whirl");
  assert.equal(deathBlossom.finisherValue, 1);
  const backstab = thiefCatalog.skillsByName.get("Backstab");
  const malicious = thiefCatalog.skillsByName.get("Malicious Backstab");
  assert.equal(backstab.effects[0].coefficient, 1.5);
  assert.equal(malicious.effects[0].coefficient, 1.5);
  assert.equal(backstab.cooldown, 1);
  assert.equal(malicious.cooldown, 1);
});

test("Dagger runtime applies endurance, shadowstep, and per-packet mechanics", () => {
  const chain = simulate(
    "Core",
    ["Dodge", "Double Strike", "Wild Strike", "Lotus Strike"],
    {
      boons: { quickness: true },
    },
  );
  assert.deepEqual(
    chain.steps.slice(1).map((step) => step.fullCastMs),
    [360, 400, 440],
  );
  const thiefStates = chain.events.filter(
    (event) => event.type === "thief.state",
  );
  const wildStrikeStateIndex = thiefStates.findIndex(
    (event) => event.reason === "Wild Strike",
  );
  const beforeWildStrike = thiefStates
    .slice(0, wildStrikeStateIndex)
    .filter((event) => event.at <= chain.steps[2].start / 1000 + 1e-9)
    .at(-1);
  assert.equal(
    thiefStates[wildStrikeStateIndex].state.endurance -
      beforeWildStrike.state.endurance,
    10,
  );
  const doubleStrikeHits = chain.events.filter(
    (event) => event.type === "damage" && event.skillName === "Double Strike",
  );
  assert.deepEqual(
    doubleStrikeHits.map((event) => event.coefficient),
    [0.4, 0.4],
  );

  const shadowShot = simulate("Core", ["Shadow Shot"], {
    primaryWeapon: "Dagger",
    secondaryWeapon: "Pistol",
    relic: "Peitha",
  });
  assert.ok(
    shadowShot.events.some(
      (event) => event.type === "peitha" && event.skillName === "Shadow Shot",
    ),
  );
  assert.equal(
    shadowShot.events.find(
      (event) => event.type === "blind" && event.skillName === "Shadow Shot",
    ).duration,
    5,
  );
});

test("Malicious stealth attacks use their supplied coefficients and malice scaling", () => {
  const front = simulate("Core", ["Cloak and Dagger", "Backstab"], {
    target: { defiant: false, behind: false },
  });
  const behind = simulate("Core", ["Cloak and Dagger", "Backstab"], {
    target: { defiant: false, behind: true },
  });
  const skillDamage = (result, name) =>
    result.breakdown.find((entry) => entry.sourceSkill === name)?.damage || 0;
  assert.ok(
    Math.abs(
      skillDamage(behind, "Backstab") / skillDamage(front, "Backstab") - 2,
    ) < 1e-9,
  );

  const unmarked = simulate(
    "Deadeye",
    ["Cloak and Dagger", "Malicious Backstab"],
    { stats: { precision: 5000 } },
  );
  const marked = simulate(
    "Deadeye",
    [
      "Deadeye's Mark",
      "Death Blossom",
      "Cloak and Dagger",
      "Malicious Backstab",
    ],
    {
      selectedTraitIds: [TRAIT.MALICIOUS_INTENT],
      stats: { precision: 5000 },
    },
  );
  const maliciousRatio =
    skillDamage(marked, "Malicious Backstab") /
    skillDamage(unmarked, "Malicious Backstab");
  assert.ok(Math.abs(maliciousRatio - 1.5) < 1e-9, maliciousRatio);
  assert.equal(marked.endState.profession.malice, 0);

  const deathsJudgment = thiefCatalog.skillsByName.get(
    "Malicious Death's Judgment",
  );
  assert.deepEqual(
    deathsJudgment.effects
      .filter((effect) => effect.type === "strike")
      .map((effect) => [effect.coefficient, effect.hits]),
    [[2.67, 1]],
  );

  const rifleConfig = {
    primaryWeapon: "Rifle",
    secondaryWeapon: "",
    stats: { precision: 5000 },
  };
  const unmarkedRifle = simulate(
    "Deadeye",
    ["Kneel", "Three Round Burst", "Shadow Meld", "Malicious Death's Judgment"],
    rifleConfig,
  );
  const markedRifle = simulate(
    "Deadeye",
    [
      "Deadeye's Mark",
      "Kneel",
      "Three Round Burst",
      "Shadow Meld",
      "Malicious Death's Judgment",
    ],
    {
      ...rifleConfig,
      selectedTraitIds: [TRAIT.MALICIOUS_INTENT],
    },
  );
  const deathsJudgmentRatio =
    skillDamage(markedRifle, "Malicious Death's Judgment") /
    skillDamage(unmarkedRifle, "Malicious Death's Judgment");
  assert.ok(Math.abs(deathsJudgmentRatio - 1.5) < 1e-9, deathsJudgmentRatio);
  assert.equal(markedRifle.endState.profession.malice, 0);
});

test("Revealed Training does not empower the stealth attack that reveals the thief", () => {
  const rotation = ["Cloak and Dagger", "Backstab", "Double Strike"];
  const config = {
    selectedSkills: [],
    stats: { power: 2000, precision: 5000 },
  };
  const baseline = simulate("Core", rotation, config);
  const trained = simulate("Core", rotation, {
    ...config,
    selectedTraitIds: [TRAIT.REVEALED_TRAINING],
  });
  const damage = (result, name) =>
    result.breakdown.find((entry) => entry.sourceSkill === name)?.damage || 0;

  assert.ok(
    Math.abs(
      damage(trained, "Backstab") / damage(baseline, "Backstab") - 1.04,
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(
      damage(trained, "Double Strike") / damage(baseline, "Double Strike") -
        1.1,
    ) < 1e-9,
  );
});

test("Specter uses the supplied measured Quickness cast times", () => {
  const expected = new Map([
    [ID.SIPHON, 520],
    [ID.HAUNT_SHOT, 640],
    [ID.GRASPING_SHADOWS, 240],
    [ID.DAWNS_REPOSE, 520],
    [ID.ETERNAL_NIGHT, 740],
    [ID.MIND_SHOCK, 360],
    [ID.SHADOW_BOLT, 520],
    [ID.DOUBLE_BOLT, 640],
    [ID.TRIPLE_BOLT, 1080],
    [ID.SHADOWSQUALL, 1960],
    [ID.SHADOW_SAP, 600],
    [ID.TWILIGHT_COMBO, 760],
    [ID.MEASURED_SHOT, 560],
    [ID.ENDLESS_NIGHT, 1920],
    [ID.WELL_OF_BOUNTY, 400],
    [ID.WELL_OF_SORROW, 600],
    [ID.WELL_OF_TEARS, 600],
  ]);
  for (const [skillId, duration] of expected) {
    const skill = thiefCatalog.skillsById.get(skillId);
    assert.equal(skill.quicknessCastTimeMs, duration, skill.name);
    assert.equal(skill.castTimeMs, duration * 1.5, skill.name);
  }

  const quickSiphon = simulate("Specter", ["Siphon"], {
    boons: { quickness: true },
  });
  assert.equal(quickSiphon.steps[0].fullCastMs, 520);
});

test("Specter scepter and shroud packets apply their conditions per hit", () => {
  const expectedPackets = [
    ["Double Bolt", 2, 0.375, "Torment"],
    ["Triple Bolt", 3, 0.45, "Torment"],
    ["Triple Threat", 3, 0.45, "Torment"],
    ["Shadowsquall", 8, 0.2, "Poisoned"],
    ["Endless Night", 7, 0.33, "Torment"],
  ];
  for (const [name, count, coefficient, condition] of expectedPackets) {
    const skill = thiefCatalog.skillsByName.get(name);
    const strikes = skill.effects.filter((effect) => effect.type === "strike");
    const applications = skill.effects.find(
      (effect) => effect.type === "condition" && Array.isArray(effect.ticks),
    );
    const hits = strikes.reduce((sum, strike) => sum + strike.hits, 0);
    const totalCoefficient = strikes.reduce(
      (sum, strike) => sum + strike.coefficient,
      0,
    );
    assert.equal(hits, count, name);
    assert.ok(Math.abs(totalCoefficient / count - coefficient) < 1e-12, name);
    assert.equal(applications.ticks.length, count, name);
    assert.ok(
      applications.ticks.every((tick) => tick.condition === condition),
      name,
    );
  }

  const twilight = simulate("Specter", ["Twilight Combo"], {
    primaryWeapon: "Scepter",
    secondaryWeapon: "Dagger",
    boons: { quickness: true },
  });
  assert.equal(twilight.steps[0].fullCastMs, 760);
  assert.deepEqual(
    twilight.events
      .filter(
        (event) =>
          event.type === "damage" && event.skillName === "Twilight Combo",
      )
      .map((event) => [event.at, event.name]),
    [
      [0.64, "Initial Attack"],
      [0.8, "Secondary Attack"],
    ],
  );
  assert.deepEqual(
    twilight.events
      .filter(
        (event) =>
          event.type === "condition" && event.skillName === "Twilight Combo",
      )
      .map((event) => [event.at, event.condition, event.stacks]),
    [
      [0.64, "Chilled", 1],
      [0.64, "Poisoned", 1],
      [0.8, "Torment", 3],
    ],
  );

  const deadlyAmbition = simulate("Specter", ["Twilight Combo"], {
    primaryWeapon: "Scepter",
    secondaryWeapon: "Dagger",
    selectedTraitIds: [TRAIT.DEADLY_AMBITION],
    boons: { quickness: true },
  });
  const deadlyAmbitionPoisons = deadlyAmbition.events.filter(
    (event) =>
      event.type === "condition" &&
      event.sourceId === TRAIT.DEADLY_AMBITION &&
      event.skillName === "Twilight Combo",
  );
  assert.ok(
    thiefCatalog.skillsByName
      .get("Twilight Combo")
      .categories.includes("DualWield"),
  );
  assert.equal(deadlyAmbitionPoisons.length, 1);
  assert.equal(deadlyAmbitionPoisons[0].condition, "Poisoned");
  assert.equal(deadlyAmbitionPoisons[0].stacks, 1);

  const eternal = simulate(
    "Specter",
    ["Enter Shadow Shroud", "Eternal Night"],
    {
      initialShadowForce: 100,
      boons: { quickness: true },
    },
  );
  const eternalHits = eternal.events.filter(
    (event) => event.type === "damage" && event.skillName === "Eternal Night",
  );
  assert.deepEqual(
    eternalHits.map((event) => Number(event.at.toFixed(2))),
    [0.36, 0.68],
  );
  assert.ok(eternalHits.every((event) => event.coefficient === 1.75));
  const eternalConditions = eternal.events.filter(
    (event) =>
      event.type === "condition" && event.skillName === "Eternal Night",
  );
  assert.deepEqual(
    eternalConditions.map((event) => [event.at, event.condition, event.stacks]),
    [
      [0.36, "Chilled", 1],
      [0.36, "Poisoned", 2],
      [0.68, "Weakness", 1],
      [0.68, "Poisoned", 2],
    ],
  );

  const mindShock = simulate("Specter", ["Enter Shadow Shroud", "Mind Shock"], {
    initialShadowForce: 100,
    boons: { quickness: true },
  });
  assert.equal(mindShock.steps[1].fullCastMs, 360);
  assert.equal(
    mindShock.events.find(
      (event) => event.type === "buff" && event.kind === "stability",
    ).at,
    0.36,
  );
  assert.equal(
    mindShock.events.find(
      (event) => event.type === "damage" && event.skillName === "Mind Shock",
    ).at,
    3.36,
  );
  const stun = mindShock.events.find(
    (event) => event.type === "control" && event.skillName === "Mind Shock",
  );
  assert.equal(stun.at, 3.36);
  assert.equal(stun.controlKind, "stun");
});

test("Specter EVTC packet offsets match scepter and shroud impacts", () => {
  const packetOffsets = (result, skillName) => {
    const step = result.steps.find((entry) => entry.skill === skillName);
    return result.events
      .filter(
        (event) => event.type === "damage" && event.skillName === skillName,
      )
      .map((event) => Number((event.at - step.start / 1000).toFixed(3)));
  };

  const bolts = simulate(
    "Specter",
    ["Shadow Bolt", "Double Bolt", "Triple Bolt"],
    {
      primaryWeapon: "Scepter",
      secondaryWeapon: "Dagger",
      boons: { quickness: true },
    },
  );
  assert.deepEqual(packetOffsets(bolts, "Shadow Bolt"), [0.52]);
  assert.deepEqual(packetOffsets(bolts, "Double Bolt"), [0.32, 0.6]);
  assert.deepEqual(packetOffsets(bolts, "Triple Bolt"), [0.32, 0.64, 1.04]);

  const shroud = simulate(
    "Specter",
    ["Enter Shadow Shroud", "Grasping Shadows", "Eternal Night", "Haunt Shot"],
    {
      initialShadowForce: 100,
      boons: { quickness: true },
    },
  );
  assert.deepEqual(packetOffsets(shroud, "Grasping Shadows"), [1.24]);
  assert.deepEqual(packetOffsets(shroud, "Eternal Night"), [0.36, 0.68]);
  assert.deepEqual(packetOffsets(shroud, "Haunt Shot"), [0.567]);

  const needles = simulate(
    "Specter",
    [
      "Prepare Thousand Needles",
      { name: "__wait", waitMs: 3000 },
      "Thousand Needles",
      { name: "__wait", waitMs: 4000 },
    ],
    {
      selectedSkills: ["Prepare Thousand Needles"],
      boons: { quickness: true },
    },
  );
  assert.deepEqual(packetOffsets(needles, "Thousand Needles"), [0, 1, 2, 3, 4]);
});

test("Specter wells preserve one-second pulse intervals and ordered effects", () => {
  const sorrow = simulate("Specter", ["Well of Sorrow"], {
    selectedSkills: ["Well of Sorrow"],
    boons: { quickness: true },
  });
  assert.equal(sorrow.steps[0].fullCastMs, 600);
  assert.deepEqual(
    sorrow.events
      .filter(
        (event) =>
          event.type === "damage" && event.skillName === "Well of Sorrow",
      )
      .map((event) => [event.at, Number(event.coefficient.toFixed(3))]),
    [
      [1, 0.222],
      [2, 0.222],
      [3, 0.222],
      [4, 0.222],
      [5, 0.222],
    ],
  );
  assert.deepEqual(
    sorrow.events
      .filter(
        (event) =>
          event.type === "condition" && event.skillName === "Well of Sorrow",
      )
      .map((event) => [event.at, event.condition, event.stacks]),
    [
      [1, "Torment", 2],
      [2, "Bleeding", 3],
      [3, "Torment", 2],
      [4, "Poisoned", 3],
      [5, "Torment", 2],
    ],
  );

  const tears = simulate("Specter", ["Well of Tears"], {
    selectedSkills: ["Well of Tears"],
    boons: { quickness: true },
  });
  assert.deepEqual(
    tears.events
      .filter(
        (event) =>
          event.type === "damage" && event.skillName === "Well of Tears",
      )
      .map((event) => [event.at, event.coefficient]),
    [
      [0.6, 1],
      [1.6, 1],
      [2.6, 1],
      [3.6, 1],
      [4.6, 1],
    ],
  );

  const bounty = simulate("Specter", ["Well of Bounty"], {
    selectedSkills: ["Well of Bounty"],
    boons: { quickness: true },
  });
  assert.deepEqual(
    bounty.events
      .filter(
        (event) =>
          event.type === "buff" && event.skillName === "Well of Bounty",
      )
      .map((event) => [event.at, event.kind, event.stacks, event.duration]),
    [
      [0.4, "stability", 2, 5],
      [1.4, "might", 8, 15],
      [2.4, "fury", 1, 5],
      [3.4, "vigor", 1, 8],
      [4.4, "regeneration", 1, 12],
    ],
  );
});

test("Specter shadow-force and recharge traits use supplied values", () => {
  const baseline = simulate("Specter", ["Siphon"]);
  const amplified = simulate("Specter", ["Siphon"], {
    selectedTraitIds: [TRAIT.AMPLIFIED_SIPHONING],
  });
  assert.equal(baseline.endState.profession.shadowForce, 25);
  assert.equal(amplified.endState.profession.shadowForce, 27.5);

  const initiative = simulate("Specter", ["Shadow Sap"], {
    primaryWeapon: "Scepter",
    secondaryWeapon: "Dagger",
  });
  assert.equal(initiative.endState.profession.shadowForce, 4);

  const reduced = simulate("Specter", ["Siphon"], {
    selectedTraitIds: [TRAIT.LEAD_ATTACKS, TRAIT.SLEIGHT_OF_HAND],
  });
  assert.equal(reduced.endState.cooldowns.Siphon.remaining, 11700);

  const larcenous = simulate("Specter", ["Twilight Combo"], {
    initialShadowForce: 0,
    primaryWeapon: "Scepter",
    secondaryWeapon: "Dagger",
    selectedTraitIds: [TRAIT.LARCENOUS_TORMENT],
    boons: { quickness: true },
  });
  assert.equal(larcenous.profession.shadowForce, 5.5);
  assert.equal(
    larcenous.resolvedEvents.filter(
      (event) =>
        event.type === "damage" && event.skillName === "Larcenous Torment",
    ).length,
    3,
  );
});

test("Specter attribute, ally, and shadowstep traits resolve explicitly", () => {
  const attributeConfig = {
    specialization: "Specter",
    primaryWeapon: "Scepter",
    secondaryWeapon: "Dagger",
    selectedTraitIds: [TRAIT.SECOND_OPINION, TRAIT.STRENGTH_OF_SHADOWS],
    stats: {
      conditionDamage: 1000,
      healingPower: 100,
      vitality: 1000,
      expertise: 0,
    },
  };
  const query = createGw2CombatQuery({
    profession: resolveProfessionRuntime(thiefProfession, attributeConfig),
    config: attributeConfig,
  });
  const stats = query.statsAt(0);
  assert.equal(stats.conditionDamage, 1180);
  assert.equal(stats.healingPower, 170);
  assert.equal(stats.expertise, 130);

  const allies = simulate(
    "Specter",
    ["Enter Shadow Shroud", "Dawn's Repose", { name: "__wait", waitMs: 1000 }],
    {
      initialShadowForce: 100,
      selectedTraitIds: [TRAIT.SHADESTEP],
      allies: { count: 2, strikesPerSecond: 1 },
      boons: { quickness: true },
    },
  );
  const protection = allies.events.find(
    (event) =>
      event.type === "buff" &&
      event.skillName === "Dawn's Repose" &&
      event.kind === "protection",
  );
  assert.equal(protection.duration, 5);
  assert.equal(protection.recipientCount, 3);
  const barrier = allies.events.find(
    (event) =>
      event.type === "buff" &&
      event.skillName === "Enter Shadow Shroud" &&
      event.kind === "barrier",
  );
  assert.equal(barrier.recipientCount, 1);
  const dawnBarrier = allies.events.find(
    (event) =>
      event.type === "buff" &&
      event.skillName === "Dawn's Repose" &&
      event.kind === "barrier",
  );
  assert.equal(dawnBarrier.recipientCount, 2);
  assert.deepEqual(
    allies.events
      .filter(
        (event) => event.type === "buff" && event.kind === "rot-wallow-venom",
      )
      .map((event) => [event.at, event.duration, event.recipientCount]),
    [
      [0, 10, 1],
      [0.52, 10, 1],
    ],
  );
  assert.equal(
    allies.events.filter(
      (event) =>
        event.type === "condition" &&
        event.skillName === "Rot Wallow Venom" &&
        event.condition === "Torment",
    ).length,
    2,
  );

  const peitha = simulate("Specter", ["Well of Tears"], {
    selectedSkills: ["Well of Tears"],
    relic: "Peitha",
    boons: { quickness: true },
  });
  assert.ok(
    peitha.events.some(
      (event) => event.type === "peitha" && event.skillName === "Well of Tears",
    ),
  );
});

test("Spear slots 2 and 3 shift through lead, follow-up, and finisher skills", () => {
  const chainSkills = [
    "Mantis Sting",
    "Entangling Asp",
    "Falling Spider",
    "Unsuspecting Strike",
    "Vampiric Slash",
    "Shattering Assault",
  ].map((name) => thiefCatalog.skillsByName.get(name));
  const visibleAtStage = (stage) =>
    chainSkills
      .filter((skill) =>
        thiefWeaponSkillMatchesSet(skill, ["Spear", ""], {
          catalog: thiefCatalog,
          professionState: { spearChainStage: stage },
        }),
      )
      .map((skill) => skill.name);
  const paletteAtStage = (stage) =>
    weaponSkills({
      build: {
        ...createThiefBuildDefaults(),
        weapons: ["Spear", ""],
        alternateWeapons: ["Spear", ""],
      },
      adapter: thiefAppAdapter,
      profession: thiefProfession,
      skills: thiefCatalog.skills,
      weaponData: thiefAppAdapter.weaponData,
      results: {
        endState: {
          activeWeaponSet: 1,
          profession: { spearChainStage: stage },
        },
      },
    })
      .filter((skill) =>
        [2, 3].includes(Number(String(skill.slot).split("_").at(-1))),
      )
      .map((skill) => skill.name);

  assert.deepEqual(visibleAtStage(0), ["Mantis Sting", "Unsuspecting Strike"]);
  assert.deepEqual(visibleAtStage(1), ["Entangling Asp", "Vampiric Slash"]);
  assert.deepEqual(visibleAtStage(2), ["Falling Spider", "Shattering Assault"]);
  assert.deepEqual(
    chainSkills
      .filter((skill) =>
        thiefWeaponSkillMatchesSet(skill, ["Spear", ""], {
          catalog: thiefCatalog,
          professionState: { spearChainStage: 0 },
          weaponBarPreview: true,
        }),
      )
      .map((skill) => [skill.name, skill.weaponBarChainStep]),
    [
      ["Mantis Sting", 1],
      ["Entangling Asp", 2],
      ["Falling Spider", 3],
      ["Unsuspecting Strike", 1],
      ["Vampiric Slash", 2],
      ["Shattering Assault", 3],
    ],
  );
  assert.deepEqual(paletteAtStage(0), ["Mantis Sting", "Unsuspecting Strike"]);
  assert.deepEqual(paletteAtStage(1), ["Entangling Asp", "Vampiric Slash"]);
  assert.deepEqual(paletteAtStage(2), ["Falling Spider", "Shattering Assault"]);
  assert.equal(
    thiefProfession.ui.paletteSkillAvailability(
      { professionState: { spearChainStage: 0 } },
      thiefCatalog.skillsByName.get("Entangling Asp"),
    ).available,
    false,
  );
  assert.equal(
    thiefProfession.ui.paletteSkillAvailability(
      { professionState: { spearChainStage: 1 } },
      thiefCatalog.skillsByName.get("Entangling Asp"),
    ).available,
    true,
  );
});

test("Spider Venom grants six independent charges to the player and allies", () => {
  const result = simulate("Core", ["Spider Venom", "Heartseeker"], {
    selectedSkills: ["Hide in Shadows", "Spider Venom"],
    allies: { count: 4, strikesPerSecond: 1 },
  });
  const partyBuff = result.events.find(
    (event) => event.type === "buff" && event.kind === "spider-venom",
  );
  assert.equal(partyBuff.stacks, 6);
  assert.equal(partyBuff.duration, 24);
  assert.equal(partyBuff.recipientCount, 5);

  const allyPoisons = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillId === ID.SPIDER_VENOM &&
      event.triggeredByAlly,
  );
  assert.equal(allyPoisons.length, 24);
  assert.deepEqual(
    [...new Set(allyPoisons.map((event) => event.triggeredByAlly))],
    [1, 2, 3, 4],
  );
  assert.ok(
    allyPoisons.every(
      (event) =>
        event.stacks === 1 &&
        Math.abs(event.naturalExpiresAt - event.at - 3) < 1e-9,
    ),
  );

  const personalPoisons = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillId === ID.SPIDER_VENOM &&
      !event.triggeredByAlly,
  );
  assert.equal(personalPoisons.length, 1);
});

test("Antiquary artifacts, per-cast Double Edge, and summons are deterministic", () => {
  assert.ok(
    thiefCatalog.skills
      .filter((skill) => skill.handlerId === "thief.double-edge")
      .every((skill) => skill.usableWhileRecharging === true),
  );
  const artifact = simulate(
    "Antiquary",
    ["Skritt Swipe", "Forged Surfer Dash", { type: "wait", durationMs: 1200 }],
    {
      primaryWeapon: "Axe",
      secondaryWeapon: "Dagger",
    },
  );
  assert.equal(artifact.warnings.length, 0);
  assert.equal(artifact.endState.profession.artifactUsesRemaining, 0);
  assert.ok(artifact.totalDamage > 0);

  const reshuffled = simulate("Antiquary", ["Skritt Swipe", "Reshuffle"], {
    primaryWeapon: "Axe",
    secondaryWeapon: "Dagger",
  });
  assert.deepEqual(
    reshuffled.endState.profession.artifactSlots.map((slot) => slot.skillId),
    [...THIEF_ARTIFACT_IDS.OFFENSIVE, ...THIEF_ARTIFACT_IDS.DEFENSIVE],
  );

  const doubleEdge = simulate(
    "Antiquary",
    [
      "Stone Summit Cannon",
      {
        name: "Stone Summit Cannon",
        doubleEdgeOutcome: "backfire",
      },
    ],
    {
      primaryWeapon: "Axe",
      secondaryWeapon: "Dagger",
    },
  );
  assert.equal(doubleEdge.warnings.length, 0);
  assert.ok(doubleEdge.endState.profession.backfireState[76725]);

  const doubleEdgeSuccess = simulate(
    "Antiquary",
    [
      "Stone Summit Cannon",
      {
        name: "Stone Summit Cannon",
        doubleEdgeOutcome: "success",
      },
    ],
    {
      primaryWeapon: "Axe",
      secondaryWeapon: "Dagger",
    },
  );
  assert.equal(doubleEdgeSuccess.warnings.length, 0);
  assert.equal(
    doubleEdgeSuccess.endState.profession.backfireState[76725],
    undefined,
  );

  const guild = simulate(
    "Antiquary",
    ["Thieves Guild", { type: "wait", durationMs: 2100 }],
    {
      primaryWeapon: "Axe",
      secondaryWeapon: "Dagger",
    },
  );
  assert.ok(
    guild.resolvedEvents.some(
      (event) =>
        event.actorType === "summon" &&
        event.skillName === "Thieves Guild — Sword/Dagger Skritt",
    ),
  );
});

test("Thieves Guild summons three specialization-specific thieves for 24 seconds", () => {
  assert.equal(thiefCatalog.skillsByName.get("Thieves Guild").cooldown, 120);
  assert.equal(
    thiefCatalog.skillsByName.get("Thieves Guild").summonAttack.duration,
    24,
  );
  const expectedThirdSummon = new Map([
    ["Core", "Sword Thief"],
    ["Daredevil", "Staff Daredevil"],
    ["Deadeye", "Rifle Deadeye"],
    ["Specter", "Scepter Specter"],
    ["Antiquary", "Sword/Dagger Skritt"],
  ]);
  for (const [specialization, thirdSummon] of expectedThirdSummon) {
    const result = simulate(specialization, [
      "Thieves Guild",
      { type: "wait", durationMs: 1800 },
    ]);
    assert.deepEqual(
      [
        ...new Set(
          result.resolvedEvents
            .filter(
              (event) =>
                event.type === "damage" &&
                event.actorType === "summon" &&
                event.sourceId === "thief.thieves-guild",
            )
            .map((event) => event.skillName),
        ),
      ].sort(),
      [
        "Thieves Guild — Male Dual-Pistol Thief",
        "Thieves Guild — Female Dual-Dagger Thief",
        `Thieves Guild — ${thirdSummon}`,
      ].sort(),
      specialization,
    );
  }

  const lifetime = simulate("Specter", [
    "Thieves Guild",
    { type: "wait", durationMs: 26000 },
  ]);
  const summonPackets = lifetime.resolvedEvents.filter(
    (event) =>
      event.type === "damage" &&
      event.actorType === "summon" &&
      event.sourceId === "thief.thieves-guild",
  );
  assert.equal(summonPackets.length, 52);
  assert.equal(lifetime.endState.profession.activeThievesGuild, null);
  assert.deepEqual(
    [...new Set(summonPackets.map((event) => event.skillWeapon))].sort(),
    ["Pistol", "Dagger", "Scepter"].sort(),
  );
  const entityRows = skillBreakdownRows(lifetime).filter(
    (row) => row.parentSkill === "Thieves Guild",
  );
  assert.ok(entityRows.length > 0);
  assert.ok(
    entityRows.every((row) => !row.name.startsWith("Thieves Guild \u2014 ")),
  );
  assert.ok(entityRows.some((row) => row.name === "Thief \u2014 Unload"));
  assert.ok(
    entityRows.some((row) => row.name === "Specter \u2014 Basic Attack"),
  );
  const scorpionWire = entityRows.find(
    (row) => row.name === "Thief \u2014 Scorpion Wire",
  );
  assert.ok(scorpionWire.strike > 0);
  assert.ok(scorpionWire.condition > 0);
  assert.ok(entityRows.every((row) => !row.name.endsWith(" \u2014 Poisoned")));
});

test("Thieves Guild uses independent summon weapons and attack profiles", () => {
  const rotation = ["Thieves Guild", { type: "wait", durationMs: 26000 }];
  const result = simulate("Daredevil", rotation);
  const strikes = result.resolvedEvents.filter(
    (event) =>
      event.type === "damage" &&
      event.actorType === "summon" &&
      event.sourceId === "thief.thieves-guild",
  );
  const profile = (name) =>
    strikes.filter((event) => event.skillName.includes(name));
  const entityRowNames = skillBreakdownRows(result)
    .filter((row) => row.parentSkill === "Thieves Guild")
    .map((row) => row.name);
  assert.ok(entityRowNames.includes("Thief \u2014 Unload"));
  assert.ok(entityRowNames.includes("Daredevil \u2014 Vault"));
  const impairingDaggers = skillBreakdownRows(result).find(
    (row) => row.name === "Daredevil \u2014 Impairing Daggers",
  );
  assert.ok(impairingDaggers.strike > 0);
  assert.ok(impairingDaggers.condition > 0);
  assert.ok(
    entityRowNames.every(
      (name) =>
        !name.startsWith("Male ") &&
        !name.startsWith("Female ") &&
        !name.startsWith("Staff "),
    ),
  );
  const summarize = (name) => {
    const events = profile(name);
    return {
      coefficient: Number(
        events
          .reduce((total, event) => total + Number(event.coefficient || 0), 0)
          .toFixed(3),
      ),
      hits: events.reduce((total, event) => total + Number(event.hits || 0), 0),
      weaponStrengthProfiles: [
        ...new Set(events.map((event) => event.weaponStrengthProfileId)),
      ],
    };
  };

  assert.deepEqual(summarize("Male Dual-Pistol Thief"), {
    coefficient: 9.2,
    hits: 49,
    weaponStrengthProfiles: ["weapon.pistol"],
  });
  assert.deepEqual(summarize("Female Dual-Dagger Thief"), {
    coefficient: 43.9,
    hits: 33,
    weaponStrengthProfiles: ["weapon.dagger"],
  });
  assert.deepEqual(summarize("Staff Daredevil"), {
    coefficient: 10.95,
    hits: 17,
    weaponStrengthProfiles: ["weapon.staff"],
  });
  assert.ok(
    strikes.every(
      (event) =>
        event.independentSummonStrike === true &&
        event.summonBasePower === 1750 &&
        event.criticalChance === 0.2 &&
        event.criticalDamage === 1.5,
    ),
  );

  const summonStrikeDamage = (simulation) =>
    simulation.resolvedEvents
      .filter(
        (event) =>
          event.type === "damage" &&
          event.actorType === "summon" &&
          event.sourceId === "thief.thieves-guild",
      )
      .reduce((total, event) => total + Number(event.damage || 0), 0);
  const lowPower = simulate("Daredevil", rotation, {
    stats: { power: 1000, precision: 1000, ferocity: 0 },
  });
  const highPower = simulate("Daredevil", rotation, {
    stats: { power: 4000, precision: 3000, ferocity: 1500 },
  });
  assert.equal(summonStrikeDamage(lowPower), summonStrikeDamage(highPower));
});

test("Antiquary exposes every artifact from Swipe and Scuffle", () => {
  const expectedArtifactIds = [
    ...THIEF_ARTIFACT_IDS.OFFENSIVE,
    ...THIEF_ARTIFACT_IDS.DEFENSIVE,
  ];
  const config = {
    primaryWeapon: "Axe",
    secondaryWeapon: "Dagger",
  };

  const swipe = simulate("Antiquary", ["Skritt Swipe"], config);
  assert.deepEqual(
    swipe.endState.profession.artifactSlots.map((slot) => slot.skillId),
    expectedArtifactIds,
  );
  const paletteGroups = thiefProfession.ui.paletteGroups({
    specialization: "Antiquary",
    professionState: swipe.endState.profession,
    build: { assumptions: {} },
  });
  assert.deepEqual(
    paletteGroups.find((group) => group.id === "thief-artifacts-offensive")
      .skillIds,
    THIEF_ARTIFACT_IDS.OFFENSIVE,
  );
  assert.deepEqual(
    paletteGroups.find((group) => group.id === "thief-artifacts-defensive")
      .skillIds,
    THIEF_ARTIFACT_IDS.DEFENSIVE,
  );
  assert.deepEqual(
    paletteGroups
      .filter((group) => group.id.startsWith("thief-artifacts-"))
      .map((group) => group.stackId),
    ["thief-artifacts", "thief-artifacts"],
  );
  assert.equal(
    paletteGroups
      .find((group) => group.id === "thief-profession")
      .skillIds.includes(ID.RESHUFFLE),
    false,
  );

  const picked = simulate(
    "Antiquary",
    ["Skritt Swipe", "Mistburn Mortar"],
    config,
  );
  assert.equal(picked.warnings.length, 0);
  assert.equal(picked.endState.profession.artifactUsesRemaining, 0);
  assert.equal(
    thiefProfession.ui
      .paletteGroups({
        specialization: "Antiquary",
        professionState: picked.endState.profession,
        build: { assumptions: {} },
      })
      .filter((group) => group.id.startsWith("thief-artifacts-"))
      .every(
        (group) =>
          group.skillIds.length === 0 &&
          group.className.includes("pal-group-concealed"),
      ),
    true,
  );

  const scuffle = simulate(
    "Antiquary",
    ["Skritt Scuffle", { type: "wait", durationMs: 5200 }],
    config,
  );
  assert.deepEqual(
    scuffle.endState.profession.artifactSlots.map((slot) => slot.skillId),
    expectedArtifactIds,
  );
});

test("Meticulous Custodian upgrades artifact packets and effect durations", () => {
  const config = {
    primaryWeapon: "Sword",
    secondaryWeapon: "Pistol",
    deterministicChoices: { forgedSurferBombsHit: "1" },
  };
  const artifact = (name, meticulous = false) =>
    simulate(
      "Antiquary",
      ["Skritt Swipe", name, { type: "wait", durationMs: 6000 }],
      {
        ...config,
        traitIds: meticulous ? [TRAIT.METICULOUS_CUSTODIAN] : [],
      },
    );
  const damage = (result, match) =>
    result.breakdown.find((entry) =>
      typeof match === "function" ? match(entry) : entry.name === match,
    )?.damage || 0;
  const ratio = (name, rowName = name) => {
    const base = artifact(name);
    const meticulous = artifact(name, true);
    return damage(meticulous, rowName) / damage(base, rowName);
  };

  assert.ok(
    Math.abs(
      ratio(
        "Metal Legion Guitar",
        (entry) =>
          entry.sourceSkill === "Metal Legion Guitar" &&
          entry.name.endsWith("Packet 1"),
      ) - 1.5,
    ) < 1e-9,
  );
  assert.ok(Math.abs(ratio("Metal Legion Guitar", "Final Smash") - 1.2) < 1e-9);
  assert.ok(Math.abs(ratio("Mistburn Mortar") - 1.2) < 1e-9);
  assert.ok(Math.abs(ratio("Summon Kryptis Turret") - 3.84 / 2.8) < 1e-9);
  assert.ok(Math.abs(ratio("Chak Shield") - 1.2) < 1e-9);
  assert.ok(Math.abs(ratio("Holo-Dancer Decoy") - 1.5) < 1e-9);

  const mortar = artifact("Mistburn Mortar", true);
  const turret = artifact("Summon Kryptis Turret", true);
  const sunCrystal = artifact("Zephyrite Sun Crystal", true);
  const chakShield = artifact("Chak Shield", true);
  assert.equal(
    chakShield.breakdown.find((entry) => entry.name === "Chak Shield").hits,
    6,
  );
  assert.equal(mortar.endState.profession.mistburnExpiresAt, 12.95);
  assert.equal(turret.endState.profession.kryptisDamageUntil, 10.66);
  assert.ok(
    sunCrystal.conditionDamage >
      artifact("Zephyrite Sun Crystal").conditionDamage * 1.8,
  );
});

test("Antiquary skill bar previews wiki-categorized artifacts", () => {
  const groups = thiefProfession.ui.skillBarGroups({
    specialization: "Antiquary",
  });
  assert.deepEqual(
    groups.map((group) => ({
      label: group.label,
      names: group.skillIds.map((id) => thiefCatalog.skillsById.get(id)?.name),
    })),
    [
      {
        label: "Offensive Artifacts",
        names: [
          "Forged Surfer Dash",
          "Metal Legion Guitar",
          "Mistburn Mortar",
          "Summon Kryptis Turret",
        ],
      },
      {
        label: "Defensive Artifacts",
        names: [
          "Chak Shield",
          "Exalted Hammer",
          "Holo-Dancer Decoy",
          "Zephyrite Sun Crystal",
        ],
      },
    ],
  );
  const specter = thiefProfession.ui.skillBarGroups({
    specialization: "Specter",
  });
  assert.deepEqual(
    specter.map((group) => group.label),
    ["F Keys", "Shadow Shroud"],
  );
  assert.deepEqual(
    specter[1].skillIds.map((id) => thiefCatalog.skillsById.get(id)?.name),
    [
      "Haunt Shot",
      "Grasping Shadows",
      "Dawn's Repose",
      "Eternal Night",
      "Mind Shock",
    ],
  );
});

test("Power quickness Deadeye sword-pistol preset runs the supplied EVTC profile", async () => {
  const savedBuild = JSON.parse(
    await readFile(
      new URL(
        "../../../Builds/thief/b-power-quick-deadeye-sword-pistol.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const savedRotation = JSON.parse(
    await readFile(
      new URL(
        "../../../Rotations/thief/r-power-quick-deadeye-sword-pistol-bench.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const build = migrateThiefBuild({
    ...savedBuild,
    rotation: savedRotation.rotation,
  });
  assert.doesNotThrow(() =>
    normalizeRotation(savedRotation.rotation, thiefCatalog, { strict: true }),
  );
  const app = {
    build,
    adapter: thiefAppAdapter,
    profession: thiefProfession,
    skillById: thiefCatalog.skillsById,
    skillByName: thiefCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);
  const castCount = (name) =>
    result.steps.filter((step) => step.skill === name && !step.invalid).length;
  const skillRows = (name) =>
    result.breakdown.filter(
      (entry) => entry.sourceSkill === name || entry.name === name,
    );
  const skillDamage = (name) =>
    skillRows(name).reduce((sum, entry) => sum + entry.damage, 0);
  const skillHits = (name) =>
    skillRows(name).reduce((sum, entry) => sum + entry.hits, 0);
  const assertBenchmarkDamage = (name, benchmarkDamage) => {
    const simulatedDamage = skillDamage(name);
    assert.ok(
      Math.abs(simulatedDamage / benchmarkDamage - 1) < 0.03,
      JSON.stringify({ name, simulatedDamage, benchmarkDamage }),
    );
  };

  assert.deepEqual(
    result.warnings,
    [],
    JSON.stringify(
      result.steps
        .map((step, index) => ({
          index,
          skill: step.skill,
          invalid: step.invalid,
        }))
        .filter((step) => step.invalid),
    ),
  );
  assert.deepEqual(build.weapons, ["Sword", "Pistol"]);
  assert.equal(build.relic, "Deadeye");
  assert.equal(castCount("Flawless Execution"), 42);
  assert.equal(castCount("Malicious Tactical Strike"), 18);
  assert.equal(castCount("Steal Time"), 29);
  assert.equal(castCount("Shadow Flare"), 7);
  assert.equal(castCount("Shadow Swap"), 7);
  assert.equal(build.assumptions.aegis, true);
  assert.equal(skillHits("Steal Time"), 29);
  assert.ok(
    result.resolvedEvents
      .filter(
        (event) => event.skillName === "Steal Time" && event.type === "damage",
      )
      .every((event) => event.weaponStrengthProfileId === "weapon.sword"),
  );
  assert.equal(skillHits("Malicious Tactical Strike"), 18);
  assert.equal(skillHits("Flawless Execution"), 420);
  assertBenchmarkDamage("Malicious Tactical Strike", 387598);
  assertBenchmarkDamage("Flawless Execution", 2140771);
  assert.ok(
    Math.abs(result.totalDamage - savedRotation.metadata.benchmarkDamage) /
      savedRotation.metadata.benchmarkDamage <
      0.08,
  );
  assert.ok(
    Math.abs(
      result.duration - savedRotation.metadata.benchmarkDurationSeconds,
    ) /
      savedRotation.metadata.benchmarkDurationSeconds <
      0.08,
    JSON.stringify({ duration: result.duration, dps: result.dps }),
  );
  assert.ok(
    Math.abs(result.dps - savedRotation.metadata.benchmarkDps) /
      savedRotation.metadata.benchmarkDps <
      0.12,
    JSON.stringify({ duration: result.duration, dps: result.dps }),
  );
});

test("Power quickness Deadeye rifle preset runs the supplied EVTC profile", async () => {
  const [savedBuild, referenceBuild, savedRotation] = await Promise.all([
    readFile(
      new URL(
        "../../../Builds/thief/b-power-quick-deadeye-rifle.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../../../Builds/thief/b-power-quick-deadeye-sword-pistol.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../../../Rotations/thief/r-power-quick-deadeye-rifle-bench.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
  ]);

  for (const field of [
    "gear",
    "rune",
    "weaponSigils",
    "relic",
    "food",
    "utility",
    "jadeBotCore",
    "infusions",
    "specializations",
    "selectedSkills",
    "selectedDodge",
    "assumptions",
  ]) {
    assert.deepEqual(savedBuild[field], referenceBuild[field], field);
  }
  assert.deepEqual(savedBuild.weapons, ["Rifle", ""]);
  assert.deepEqual(savedBuild.alternateWeapons, ["Rifle", ""]);
  assert.deepEqual(savedBuild.weaponSigils, [
    ["Force", "Impact"],
    ["Force", "Impact"],
  ]);
  assert.doesNotThrow(() =>
    normalizeRotation(savedRotation.rotation, thiefCatalog, { strict: true }),
  );

  const build = migrateThiefBuild({
    ...savedBuild,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    adapter: thiefAppAdapter,
    profession: thiefProfession,
    skillById: thiefCatalog.skillsById,
    skillByName: thiefCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);
  const castCount = (name) =>
    result.steps.filter((step) => step.skill === name && !step.invalid).length;
  const skillRows = (name) =>
    result.breakdown.filter(
      (entry) => entry.sourceSkill === name || entry.name === name,
    );
  const skillDamage = (name) =>
    skillRows(name).reduce((sum, entry) => sum + entry.damage, 0);
  const skillHits = (name) =>
    skillRows(name).reduce((sum, entry) => sum + entry.hits, 0);

  assert.deepEqual(result.warnings, []);
  assert.equal(castCount("Kneel"), 1);
  assert.equal(castCount("Deadly Aim"), 64);
  assert.equal(castCount("Three Round Burst"), 47);
  assert.equal(castCount("Malicious Death's Judgment"), 28);
  assert.equal(castCount("Deadeye's Mark"), 10);
  assert.equal(castCount("Steal Time"), 29);
  assert.equal(castCount("Shadow Flare"), 7);
  assert.equal(castCount("Shadow Swap"), 7);
  assert.equal(castCount("Mercy"), 6);
  assert.equal(castCount("Shadow Meld"), 6);
  assert.equal(castCount("Assassin's Signet"), 1);
  assert.equal(skillHits("Three Round Burst"), 138);
  for (const [name, evtcDamage] of [
    ["Three Round Burst", 1285384],
    ["Malicious Death's Judgment", 1205356],
    ["Deadly Aim", 882238],
    ["Steal Time", 431606],
  ]) {
    const simulatedDamage = skillDamage(name);
    assert.ok(
      Math.abs(simulatedDamage / evtcDamage - 1) < 0.05,
      JSON.stringify({ name, simulatedDamage, evtcDamage }),
    );
  }
  assert.ok(
    Math.abs(result.totalDamage - savedRotation.metadata.benchmarkDamage) /
      savedRotation.metadata.benchmarkDamage <
      0.03,
    JSON.stringify({
      totalDamage: result.totalDamage,
      benchmarkDamage: savedRotation.metadata.benchmarkDamage,
    }),
  );
});

test("Power Antiquary benchmark preset matches the supplied EVTC", async () => {
  const savedBuild = JSON.parse(
    await readFile(
      new URL(
        "../../../Builds/thief/b-power-antiquary-sword-pistol.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const savedRotation = JSON.parse(
    await readFile(
      new URL(
        "../../../Rotations/thief/r-power-antiquary-sword-pistol-bench.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const build = migrateThiefBuild({
    ...savedBuild,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    adapter: thiefAppAdapter,
    profession: thiefProfession,
    skillById: thiefCatalog.skillsById,
    skillByName: thiefCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);
  const row = (name) => result.breakdown.find((entry) => entry.name === name);
  const cannonBackfire = result.breakdown.find(
    (entry) =>
      entry.sourceSkill === "Stone Summit Cannon" &&
      entry.name.endsWith("Backfire"),
  );
  const relativeError = (actual, expected) =>
    Math.abs(actual - expected) / expected;

  assert.deepEqual(result.warnings, []);
  assert.equal(Object.hasOwn(build.assumptions, "artifactDrawSequence"), false);
  assert.equal(
    Object.hasOwn(build.assumptions, "doubleEdgeOutcomeSequence"),
    false,
  );
  assert.equal(row("Stone Summit Cannon").hits, 18);
  assert.equal(cannonBackfire.hits, 6);
  assert.equal(row("Tactical Strike").hits, 9);
  assert.equal(row("Summon Kryptis Turret").hits, 56);
  assert.deepEqual(
    result.steps
      .filter((step) => step.skill === "Canach-Coin Toss")
      .map((step) => step.start),
    [4300, 18000, 35641, 37041, 67241, 68641, 79161],
  );
  assert.ok(
    relativeError(result.totalDamage, savedRotation.metadata.benchmarkDamage) <
      0.02,
  );
  assert.ok(
    relativeError(result.dps, savedRotation.metadata.benchmarkDps) < 0.01,
  );
});

test("Power Daredevil dagger-dagger preset matches the supplied EVTC", async () => {
  const savedBuild = JSON.parse(
    await readFile(
      new URL(
        "../../../Builds/thief/b-power-daredevil-dagger-dagger.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const savedRotation = JSON.parse(
    await readFile(
      new URL(
        "../../../Rotations/thief/r-power-daredevil-dagger-dagger-bench.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const build = migrateThiefBuild({
    ...savedBuild,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    adapter: thiefAppAdapter,
    profession: thiefProfession,
    skillById: thiefCatalog.skillsById,
    skillByName: thiefCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);
  const castCount = (name) =>
    result.steps.filter((step) => step.skill === name && !step.invalid).length;
  const hitCount = (name) =>
    result.breakdown
      .filter((entry) => entry.name === name)
      .reduce((sum, entry) => sum + entry.hits, 0);
  const strikeDamage = (name) =>
    result.breakdown
      .filter((entry) =>
        name === "Backstab"
          ? entry.sourceSkill === "Backstab"
          : entry.name === name,
      )
      .reduce((sum, entry) => sum + entry.strikeDamage, 0);
  const relativeError = (actual, expected) =>
    Math.abs(actual - expected) / expected;

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(build.weapons, ["Dagger", "Dagger"]);
  assert.equal(build.relic, "Eagle");
  assert.equal(castCount("Dodge"), 30);
  assert.equal(castCount("Fist Flurry"), 7);
  assert.equal(castCount("Impairing Daggers"), 7);
  assert.equal(castCount("Palm Strike"), 7);
  assert.equal(castCount("Cloak and Dagger"), 19);
  assert.equal(castCount("Backstab"), 19);
  assert.equal(castCount("Double Strike"), 33);
  assert.equal(castCount("Wild Strike"), 33);
  assert.equal(castCount("Lotus Strike"), 32);
  assert.equal(hitCount("Bound"), 30);
  assert.equal(hitCount("Pulmonary Impact"), 14);
  assert.deepEqual(
    result.steps
      .filter((step) => step.skill === "Backstab" && step.interrupted)
      .map((step) => step.end - step.start),
    Array(6).fill(280),
  );
  assert.equal(
    result.steps.findLast((step) => step.skill === "Wild Strike").end -
      result.steps.findLast((step) => step.skill === "Wild Strike").start,
    240,
  );
  for (const [name, evtcDamage] of [
    ["Bound", 918693],
    ["Backstab", 697659],
    ["Cloak and Dagger", 373707],
    ["Double Strike", 337476],
    ["Wild Strike", 333090],
    ["Lotus Strike", 483628],
    ["Fist Flurry", 228523],
    ["Impairing Daggers", 149319],
    ["Palm Strike", 104821],
    ["Pulmonary Impact", 131561],
    ["Heartseeker", 67276],
  ]) {
    assert.ok(
      relativeError(strikeDamage(name), evtcDamage) < 0.03,
      JSON.stringify({ name, simulated: strikeDamage(name), evtcDamage }),
    );
  }
  const thievesGuildStrikeDamage = result.breakdown
    .filter((entry) => entry.parentSkill === "Thieves Guild")
    .reduce((sum, entry) => sum + entry.strikeDamage, 0);
  assert.ok(relativeError(thievesGuildStrikeDamage, 60772) < 0.02);
  assert.ok(
    relativeError(
      result.dpsWindow,
      savedRotation.metadata.benchmarkDurationSeconds,
    ) < 0.001,
  );
  assert.ok(
    relativeError(result.totalDamage, savedRotation.metadata.benchmarkDamage) <
      0.01,
  );
  assert.ok(
    relativeError(result.dps, savedRotation.metadata.benchmarkDps) < 0.01,
  );
});

test("Condition Daredevil dagger-dagger preset matches the supplied EVTC", async () => {
  const savedBuild = JSON.parse(
    await readFile(
      new URL(
        "../../../Builds/thief/b-condi-daredevil-dagger-dagger.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const savedRotation = JSON.parse(
    await readFile(
      new URL(
        "../../../Rotations/thief/r-condi-daredevil-dagger-dagger-bench.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const build = migrateThiefBuild({
    ...savedBuild,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    adapter: thiefAppAdapter,
    profession: thiefProfession,
    skillById: thiefCatalog.skillsById,
    skillByName: thiefCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);
  const castCount = (name) =>
    result.steps.filter((step) => step.skill === name && !step.invalid).length;
  const hitCount = (name) =>
    result.breakdown
      .filter((entry) => entry.sourceSkill === name || entry.name === name)
      .reduce((sum, entry) => sum + entry.hits, 0);
  const relativeError = (actual, expected) =>
    Math.abs(actual - expected) / expected;

  assert.ok(Object.values(build.gear).every((stat) => stat === "Viper's"));
  assert.deepEqual(build.weapons, ["Dagger", "Dagger"]);
  assert.deepEqual(build.alternateWeapons, ["Dagger", "Dagger"]);
  assert.equal(build.rune, "Trapper");
  assert.deepEqual(build.weaponSigils, [
    ["Agony", "Doom"],
    ["Agony", "Doom"],
  ]);
  assert.equal(build.relic, "Fractal");
  assert.equal(build.food, "Plate of Kimchi Pancakes");
  assert.equal(build.utility, "Toxic Tuning Crystal");
  assert.deepEqual(build.infusions, [
    { stat: "Condition Damage", count: 18 },
    { stat: "Power", count: 0 },
    { stat: "Precision", count: 0 },
  ]);
  assert.deepEqual(
    build.specializations.map(({ name, traits }) => [name, traits]),
    [
      ["Deadly Arts", "3-2-1"],
      ["Trickery", "1-1-3"],
      ["Daredevil", "1-2-1"],
    ],
  );
  assert.deepEqual(build.selectedSkills, {
    Heal: "Channeled Vigor",
    Utility1: "Caltrops",
    Utility2: "Spider Venom",
    Utility3: "Prepare Thousand Needles",
    Elite: "Thieves Guild",
  });
  assert.equal(build.selectedDodge, "Lotus Training");
  assert.deepEqual(result.warnings, []);
  assert.equal(castCount("Steal"), 6);
  assert.equal(castCount("Dodge"), 37);
  assert.equal(castCount("Death Blossom"), 32);
  assert.equal(castCount("Double Strike"), 33);
  assert.equal(castCount("Wild Strike"), 30);
  assert.equal(castCount("Lotus Strike"), 30);
  assert.equal(castCount("Channeled Vigor"), 6);
  assert.equal(castCount("Caltrops"), 5);
  assert.equal(castCount("Spider Venom"), 5);
  assert.equal(
    result.resolvedEvents.filter(
      (event) =>
        event.type === "condition" &&
        event.skillId === ID.SPIDER_VENOM &&
        !event.triggeredByAlly,
    ).length,
    30,
  );
  assert.equal(castCount("Prepare Thousand Needles"), 6);
  assert.equal(castCount("Thousand Needles"), 5);
  assert.equal(castCount("Swap Weapons"), 11);
  assert.equal(castCount("Thieves Guild"), 0);
  assert.equal(hitCount("Death Blossom"), 93);
  assert.equal(hitCount("Impaling Lotus"), 111);
  assert.equal(hitCount("Thousand Needles"), 25);
  assert.ok(
    relativeError(result.totalDamage, savedRotation.metadata.benchmarkDamage) <
      0.01,
  );
  assert.ok(
    relativeError(result.dps, savedRotation.metadata.benchmarkDps) < 0.02,
  );
});

test("Condition Antiquary dagger-dagger preset matches the supplied EVTC", async () => {
  const savedBuild = JSON.parse(
    await readFile(
      new URL(
        "../../../Builds/thief/b-condi-antiquary-dagger-dagger.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const savedRotation = JSON.parse(
    await readFile(
      new URL(
        "../../../Rotations/thief/r-condi-antiquary-dagger-dagger-bench.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const build = migrateThiefBuild({
    ...savedBuild,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    adapter: thiefAppAdapter,
    profession: thiefProfession,
    skillById: thiefCatalog.skillsById,
    skillByName: thiefCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);
  const castCount = (name) =>
    result.steps.filter((step) => step.skill === name && !step.invalid).length;
  const relativeError = (actual, expected) =>
    Math.abs(actual - expected) / expected;

  assert.deepEqual(build.weapons, ["Dagger", "Dagger"]);
  assert.deepEqual(build.weaponSigils, [
    ["Agony", "Earth"],
    ["Agony", "Earth"],
  ]);
  assert.equal(build.relic, "Fractal");
  assert.equal(build.food, "Plate of Kimchi Pancakes");
  assert.equal(build.utility, "Toxic Tuning Crystal");
  assert.deepEqual(
    build.specializations.map(({ name, traits }) => [name, traits]),
    [
      ["Deadly Arts", "3-2-1"],
      ["Trickery", "2-1-3"],
      ["Antiquary", "3-2-3"],
    ],
  );
  assert.equal(build.assumptions.forgedSurferBombsHit, "4");
  assert.deepEqual(result.warnings, []);
  assert.equal(castCount("Death Blossom"), 40);
  assert.equal(castCount("Double Strike"), 28);
  assert.equal(castCount("Wild Strike"), 24);
  assert.equal(castCount("Lotus Strike"), 22);
  assert.equal(castCount("Thousand Needles"), 5);
  assert.equal(castCount("Caltrops"), 6);
  assert.equal(castCount("Spider Venom"), 5);
  assert.ok(
    relativeError(result.totalDamage, savedRotation.metadata.benchmarkDamage) <
      0.01,
  );
  assert.ok(
    relativeError(result.dps, savedRotation.metadata.benchmarkDps) < 0.02,
  );
});

test("Condition Antiquary spear preset matches the supplied EVTC", async () => {
  const savedBuild = JSON.parse(
    await readFile(
      new URL(
        "../../../Builds/thief/b-condi-antiquary-spear.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const savedRotation = JSON.parse(
    await readFile(
      new URL(
        "../../../Rotations/thief/r-condi-antiquary-spear-bench.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const build = migrateThiefBuild({
    ...savedBuild,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    adapter: thiefAppAdapter,
    profession: thiefProfession,
    skillById: thiefCatalog.skillsById,
    skillByName: thiefCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);
  const castCount = (name) =>
    result.steps.filter((step) => step.skill === name && !step.invalid).length;
  const relativeError = (actual, expected) =>
    Math.abs(actual - expected) / expected;

  assert.deepEqual(result.warnings, []);
  assert.equal(Object.hasOwn(build.assumptions, "artifactDrawSequence"), false);
  assert.equal(castCount("Ashen Assault"), 10);
  assert.equal(castCount("Entangling Asp"), 40);
  assert.equal(castCount("Falling Spider"), 32);
  assert.equal(castCount("Distracting Throw"), 31);
  assert.equal(castCount("Chak Shield"), 2);
  assert.equal(
    result.breakdown.find((entry) => entry.name === "Chak Shield").hits,
    12,
  );
  assert.ok(
    relativeError(result.totalDamage, savedRotation.metadata.benchmarkDamage) <
      0.02,
  );
  assert.ok(
    relativeError(result.dps, savedRotation.metadata.benchmarkDps) < 0.01,
  );
});

test("Condition Specter scepter-dagger preset matches the supplied EVTC", async () => {
  const savedBuild = JSON.parse(
    await readFile(
      new URL(
        "../../../Builds/thief/b-condi-specter-scepter-dagger.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const savedRotation = JSON.parse(
    await readFile(
      new URL(
        "../../../Rotations/thief/r-condi-specter-scepter-dagger-bench.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const build = migrateThiefBuild({
    ...savedBuild,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    adapter: thiefAppAdapter,
    profession: thiefProfession,
    skillById: thiefCatalog.skillsById,
    skillByName: thiefCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);
  const castCount = (name) =>
    result.steps.filter((step) => step.skill === name && !step.invalid).length;
  const hitCount = (sourceSkill) =>
    result.breakdown
      .filter((entry) => entry.sourceSkill === sourceSkill)
      .reduce((sum, entry) => sum + entry.hits, 0);
  const relativeError = (actual, expected) =>
    Math.abs(actual - expected) / expected;

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(build.weapons, ["Scepter", "Dagger"]);
  assert.deepEqual(build.alternateWeapons, ["Scepter", "Dagger"]);
  assert.deepEqual(build.weaponSigils, [
    ["Doom", "Earth"],
    ["Torment", "Geomancy"],
  ]);
  assert.equal(build.initialShadowForce, 100);
  assert.equal(castCount("Cooldown Reset"), 1);
  assert.equal(castCount("Twilight Combo"), 34);
  assert.equal(castCount("Enter Shadow Shroud"), 11);
  assert.equal(castCount("Exit Shadow Shroud"), 11);
  assert.equal(castCount("Thousand Needles"), 6);
  assert.equal(castCount("Well of Sorrow"), 7);
  assert.equal(hitCount("Thousand Needles"), 30);
  assert.equal(hitCount("Well of Sorrow"), 35);
  assert.ok(
    relativeError(result.totalDamage, savedRotation.metadata.benchmarkDamage) <
      0.02,
  );
  assert.ok(
    relativeError(result.dps, savedRotation.metadata.benchmarkDps) < 0.01,
  );

  const alliedBuild = migrateThiefBuild({
    ...savedBuild,
    assumptions: {
      ...savedBuild.assumptions,
      alliedPlayerCount: 4,
    },
    rotation: savedRotation.rotation,
  });
  const alliedApp = {
    ...app,
    build: alliedBuild,
  };
  recalculate(alliedApp);
  const alliedResult = runSimulation(alliedApp);
  const allySpiderPoisons = alliedResult.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Spider Venom" &&
      event.triggeredByAlly,
  );
  const allySpiderCounts = [1, 2, 3, 4].map(
    (allyIndex) =>
      allySpiderPoisons.filter((event) => event.triggeredByAlly === allyIndex)
        .length,
  );
  const rotWallowTorments = alliedResult.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Rot Wallow Venom" &&
      event.condition === "Torment",
  );
  const rotWallowIcon =
    "https://render.guildwars2.com/file/0F0B6509C8D5023D949153929E02FD2195AF63FE/2503654.png";
  const rotWallowBreakdown = alliedResult.breakdown.filter(
    (entry) => entry.sourceSkill === "Rot Wallow Venom",
  );

  assert.deepEqual(alliedResult.warnings, []);
  assert.deepEqual(allySpiderCounts, [28, 28, 28, 28]);
  assert.equal(rotWallowTorments.length, 10);
  assert.ok(rotWallowTorments.every((event) => event.icon === rotWallowIcon));
  assert.ok(rotWallowBreakdown.length > 0);
  assert.ok(rotWallowBreakdown.every((entry) => entry.icon === rotWallowIcon));
  assert.ok(relativeError(alliedResult.dps, 38396.86446449375) < 0.01);
});

test("Thief skill bar previews specialization-specific stolen skills", () => {
  const namesFor = (specialization) =>
    thiefProfession.ui
      .skillBarGroups({ specialization })
      .flatMap((group) => group.skillIds)
      .map((id) => thiefCatalog.skillsById.get(id)?.name);

  assert.deepEqual(namesFor("Core"), [
    "Throw Gunk",
    "Consume Plasma",
    "Whirling Axe",
  ]);
  assert.deepEqual(namesFor("Daredevil"), namesFor("Core"));
  assert.deepEqual(namesFor("Deadeye"), [
    "Steal Time",
    "Steal Warmth",
    "Steal Resistance",
    "Steal Precision",
    "Steal Health",
    "Steal Strength",
    "Steal Durability",
    "Steal Defenses",
    "Steal Mobility",
  ]);
});

test("trait-coverage manifest covers all Thief traits", () => {
  assert.equal(THIEF_TRAIT_COVERAGE.length, thiefCatalog.traits.length);
  assert.ok(THIEF_TRAIT_COVERAGE.every((entry) => entry.effects.length > 0));
});

test("Thief is a loadable native application", async () => {
  assert.equal(professionRoute("thief"), "thief.html");
  assert.equal((await loadProfession("thief")).id, "thief");
  const adapter = await loadProfessionAppAdapter("thief");
  assert.equal(adapter.profession.id, "thief");
  assert.equal(adapter.weaponSkillMatchesSet, thiefWeaponSkillMatchesSet);
  assert.ok(adapter.assumptionControls.length >= 7);
  const html = await readFile(
    new URL("../../../thief.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /data-profession="thief"/);
  assert.match(html, /Thief<\/span> Rotation Simulator/);
});
