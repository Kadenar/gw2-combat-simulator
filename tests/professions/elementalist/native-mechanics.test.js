import assert from "node:assert/strict";
import test from "node:test";

import { simulateGw2 } from "../../../js/platform/gw2/simulate.js";
import { timelineWeaponRows } from "../../../js/app/rotation/timeline-model.js";
import {
  paletteSkillView,
  renderPalette,
} from "../../../js/app/rotation/palette-view.js";
import { renderStartResource } from "../../../js/app/rotation/resource-view.js";
import {
  rotationSelectedSlotSkills,
  weaponPaletteRows,
} from "../../../js/app/rotation/palette-model.js";
import {
  elementalistAppAdapter,
  recalculate,
  simulationConfig,
} from "../../../js/professions/elementalist/app/app-definition.js";
import { elementalistCatalog } from "../../../js/professions/elementalist/catalog.js";
import { elementalistProfession } from "../../../js/professions/elementalist/definition.js";

test("all native Elementalist specializations use one weapon set", () => {
  assert.equal(elementalistProfession.ui.weaponSwapChangesSet, false);
  assert.equal(elementalistCatalog.skillsByName.has("Swap Weapons"), false);

  for (const specialization of [
    "Core",
    "Tempest",
    "Weaver",
    "Catalyst",
    "Evoker",
  ]) {
    const build = elementalistAppAdapter.toApplicationBuild({
      ...elementalistProfession.createBuildDefaults(),
      alternateWeapons: ["Staff", ""],
      startingWeaponSet: 2,
      specializations:
        specialization === "Core"
          ? [
              { name: "Fire", traits: "1-1-1" },
              { name: "Air", traits: "1-1-1" },
              { name: "Arcane", traits: "1-1-1" },
            ]
          : [
              { name: "Fire", traits: "1-1-1" },
              { name: "Air", traits: "1-1-1" },
              { name: specialization, traits: "1-1-1" },
            ],
    });

    assert.deepEqual(build.alternateWeapons, ["", ""], specialization);
    assert.equal(build.startingWeaponSet, 1, specialization);
  }
});

function canonicalRotation(rotation) {
  return rotation.map((entry) => {
    if (typeof entry === "number") {
      return { type: "wait", durationMs: entry };
    }
    if (entry && typeof entry === "object") return entry;
    return {
      type: "cast",
      skillId: elementalistCatalog.skillsByName.get(entry).id,
    };
  });
}

function runNative({ lines, rotation = [], ...extras }) {
  const commands = canonicalRotation(rotation);
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    specializations: lines.map(([name, traits = "1-1-1"]) => ({
      name,
      traits,
    })),
    rotation: commands,
    ...extras,
  });
  const app = {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    skillByName: elementalistCatalog.skillsByName,
    skillById: elementalistCatalog.skillsById,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  return simulateGw2({
    profession: elementalistProfession,
    rotation: commands,
    config: simulationConfig(app),
  });
}

test("Tempest mechanics execute through native hooks", () => {
  const result = runNative({
    lines: [["Fire"], ["Air"], ["Tempest"]],
    rotation: [6000, "Overload Fire", "Air Attunement", "Fire Attunement"],
    startAttunement: "Fire",
  });
  const overload = result.events.find(
    (event) => event.type === "action" && event.skillName === "Overload Fire",
  );
  const swaps = result.events.filter(
    (event) => event.type === "elementalist.attunement",
  );
  assert.ok(overload.rechargeReadyAt > overload.endsAt);
  assert.deepEqual(
    swaps.map((event) => event.to),
    ["Air", "Fire"],
  );
  assert.ok(swaps[1].at >= overload.rechargeReadyAt);
  assert.equal(result.endState.profession.primaryAttunement, "Fire");
});

test("Catalyst mechanics execute through native hooks", () => {
  const result = runNative({
    lines: [["Fire"], ["Air"], ["Catalyst"]],
    rotation: ["Deploy Jade Sphere (Fire)", "Arcane Wave", 1000],
    initialCatalystEnergy: 30,
  });
  assert.equal(result.endState.profession.energy, 20);
  assert.equal(result.endState.profession.maximumEnergy, 30);
  assert.equal(
    result.events.some(
      (event) => event.type === "buff" && event.source === "Combo (Fire/Blast)",
    ),
    true,
  );
});

test("Core mechanics execute through native hooks", () => {
  const result = runNative({
    lines: [["Fire"], ["Air", "1-1-2"], ["Arcane"]],
    rotation: ["Fire Attunement", "Flame Uprising", "Ring of Fire"],
    startAttunement: "Air",
  });
  const proc = result.events.find(
    (event) => event.type === "elementalist.fresh-air",
  );
  assert.ok(proc);
  assert.equal(result.endState.profession.attunementReadyAt.Air, proc.at);
});

test("Fresh Air resets both Air Attunement and Overload Air", () => {
  const result = runNative({
    lines: [["Fire"], ["Air", "1-1-2"], ["Tempest"]],
    rotation: [
      6000,
      "Overload Air",
      "Fire Attunement",
      "Flame Uprising",
      "Ring of Fire",
    ],
    startAttunement: "Air",
  });
  const proc = result.events.find(
    (event) => event.type === "elementalist.fresh-air",
  );

  assert.ok(proc);
  assert.equal(result.endState.profession.attunementReadyAt.Air, proc.at);
  assert.equal(result.endState.cooldowns["Air Attunement"], undefined);
  assert.equal(result.endState.cooldowns["Overload Air"], undefined);
});

test("attunement swaps start labeled rotation timeline rows", () => {
  const transition = elementalistProfession.ui.timelineWeaponLineTransition;
  const rotation = [
    "Flame Uprising",
    "Air Attunement",
    "Lightning Strike",
    "Water Attunement",
    "Water Trident",
  ];
  const build = { startAttunement: "Fire" };
  const rows = timelineWeaponRows(rotation, {
    startingWeaponLine: transition({
      initial: true,
      specialization: "Core",
      build,
    }),
    weaponSwapChangesSet: false,
    weaponLineTransition(entry, current) {
      const name = typeof entry === "string" ? entry : entry.name;
      return transition({
        entry: { name },
        skill: elementalistCatalog.skillsByName.get(name),
        specialization: "Core",
        build,
        ...current,
      });
    },
  });

  assert.deepEqual(
    rows.map((row) => row.weaponLine),
    ["Fire", "Air", "Water"],
  );
  assert.deepEqual(
    rows.map((row) => row.skills.map((skill) => skill.index)),
    [[0, 1], [2, 3], [4]],
  );
});

test("Weaver timeline rows show both active attunements", () => {
  const transition = elementalistProfession.ui.timelineWeaponLineTransition;
  const build = {
    startAttunement: "Fire",
    secondaryAttunement: "Air",
  };
  const rows = timelineWeaponRows(
    ["Water Attunement", "Air Attunement", "Earth Attunement"],
    {
      startingWeaponLine: transition({
        initial: true,
        specialization: "Weaver",
        build,
      }),
      weaponSwapChangesSet: false,
      weaponLineTransition(entry, current) {
        const name = typeof entry === "string" ? entry : entry.name;
        return transition({
          entry: { name },
          skill: elementalistCatalog.skillsByName.get(name),
          specialization: "Weaver",
          build,
          ...current,
        });
      },
    },
  );

  assert.deepEqual(
    rows.map((row) => row.weaponLine),
    ["F/A", "W/F", "A/W"],
  );
});

test("weapon palette rows group Elementalist skills by attunement and slot", () => {
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    alternateWeapons: ["", ""],
    specializations: [
      { name: "Fire", traits: "1-1-1" },
      { name: "Air", traits: "1-1-1" },
      { name: "Arcane", traits: "1-1-1" },
    ],
  });
  const app = {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    skills: elementalistCatalog.skills,
    skillByName: elementalistCatalog.skillsByName,
    skillById: elementalistCatalog.skillsById,
    weaponData: elementalistAppAdapter.weaponData,
  };
  const rows = weaponPaletteRows(app, 1);

  assert.deepEqual(
    rows.map((row) => row.label),
    ["Fire", "Water", "Air", "Earth"],
  );
  for (const row of rows) {
    const slots = row.skills.map((skill) => Number(skill.slot.split("_")[1]));
    assert.deepEqual(
      slots,
      [...slots].sort((left, right) => left - right),
    );
    assert.deepEqual([...new Set(slots)], [1, 2, 3, 4, 5]);
  }

  app.build.weapons = ["Pistol", "Dagger"];
  assert.deepEqual(
    weaponPaletteRows(app, 1).map((row) => row.label),
    ["Fire", "Water", "Air", "Earth", "Special"],
  );

  app.build.weapons = ["Sword", "Warhorn"];
  app.build.specializations[2] = { name: "Weaver", traits: "1-1-1" };
  const weaverRows = weaponPaletteRows(app, 1);
  assert.deepEqual(
    weaverRows.map((row) => row.label),
    ["Fire", "Water", "Air", "Earth", "Dual"],
  );
  const dual = weaverRows.find((row) => row.label === "Dual");
  assert.equal(dual.skills.length, 6);
  assert.equal(
    dual.skills.every((skill) => skill.slot === "Weapon_3"),
    true,
  );
});

test("weapon bar excludes dual attacks outside Weaver", () => {
  const dual = elementalistCatalog.skillsByName.get("Twin Strike");
  const matches = elementalistProfession.ui.weaponSkillMatchesSet;

  assert.equal(
    matches(dual, ["Sword", "Warhorn"], {
      specialization: "Tempest",
      build: {},
    }),
    false,
  );
  assert.equal(
    matches(dual, ["Sword", "Warhorn"], {
      specialization: "Weaver",
      build: {},
    }),
    true,
  );
});

test("starting attunement controls render catalog icons", () => {
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    specializations: [
      { name: "Fire", traits: "1-1-1" },
      { name: "Air", traits: "1-1-1" },
      { name: "Weaver", traits: "1-1-1" },
    ],
  });
  const app = {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    results: null,
    changed() {},
  };
  const selector = { innerHTML: "", querySelectorAll: () => [] };
  const previousDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => (id === "start-att-selector" ? selector : null),
  };
  try {
    renderStartResource(app);
  } finally {
    globalThis.document = previousDocument;
  }

  for (const name of ["Fire", "Water", "Air", "Earth"]) {
    const icon = elementalistCatalog.skillsByName.get(
      `${name} Attunement`,
    ).icon;
    assert.ok(icon);
    assert.equal(selector.innerHTML.split(icon).length - 1, 1);
  }
  assert.doesNotMatch(selector.innerHTML, /Start off-hand/);
});

test("rotation palette exposes each attunement as an action", () => {
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    alternateWeapons: ["", ""],
    specializations: [
      { name: "Fire", traits: "1-1-1" },
      { name: "Air", traits: "1-1-1" },
      { name: "Arcane", traits: "1-1-1" },
    ],
  });
  const app = {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    skills: elementalistCatalog.skills,
    skillByName: elementalistCatalog.skillsByName,
    skillById: elementalistCatalog.skillsById,
    weaponData: elementalistAppAdapter.weaponData,
    results: null,
  };
  const palette = { innerHTML: "", querySelectorAll: () => [] };
  const previousDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => (id === "rotation-palette" ? palette : null),
  };
  try {
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }

  assert.match(palette.innerHTML, />Attune</);
  for (const [name, badge] of [
    ["Fire", "F"],
    ["Water", "W"],
    ["Air", "A"],
    ["Earth", "E"],
  ]) {
    assert.match(
      palette.innerHTML,
      new RegExp(`data-skill="${name} Attunement"`),
    );
    assert.match(
      palette.innerHTML,
      new RegExp(
        `data-skill="${name} Attunement"[\\s\\S]*?pal-variant-badge">${badge}<`,
      ),
    );
  }
  assert.match(
    palette.innerHTML,
    /data-skill="Air Attunement"[^>]*draggable="true"/,
  );

  app.build.specializations[2] = { name: "Tempest", traits: "1-1-1" };
  globalThis.document = {
    getElementById: (id) => (id === "rotation-palette" ? palette : null),
  };
  try {
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }
  assert.ok(
    palette.innerHTML.indexOf('data-skill="Air Attunement"') <
      palette.innerHTML.indexOf('data-skill="Overload Air"'),
  );
});

test("Evoker selects its familiar in the skill bar and derives F5", () => {
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    evokerElement: "Air",
    initialEvokerEmpowered: 0,
    specializations: [
      { name: "Fire", traits: "1-1-1" },
      { name: "Air", traits: "1-1-1" },
      { name: "Evoker", traits: "1-1-1" },
    ],
  });
  const context = {
    build,
    specialization: "Evoker",
    professionState: { element: "Air", empowered: 0 },
    catalog: elementalistCatalog,
  };
  const familiar = elementalistProfession.ui
    .skillBarGroups(context)
    .find((group) => group.id === "elementalist-evoker-familiar");
  const selection = familiar.selections[0];

  assert.deepEqual(familiar.skillIds, []);
  assert.equal(selection.selectionKey, "evokerElement");
  assert.equal(selection.selectionValue, "Air");
  assert.deepEqual(
    selection.optionEntries.map((option) => option.value),
    ["Fire", "Water", "Air", "Earth"],
  );
  assert.equal(
    selection.optionEntries.every((option) => option.icon),
    true,
  );

  const f5 = (professionState) =>
    elementalistProfession.ui
      .paletteGroups({ ...context, professionState })
      .find((group) => group.id === "elementalist-evoker-familiars");
  assert.deepEqual(f5({ element: "Air", empowered: 0 }).skillIds, [
    elementalistCatalog.skillsByName.get("Zap").id,
  ]);
  assert.deepEqual(f5({ element: "Air", empowered: 3 }).skillIds, [
    elementalistCatalog.skillsByName.get("Lightning Blitz").id,
  ]);

  assert.equal(
    elementalistProfession.ui.updateSkillBarSelection(context, {
      key: "evokerElement",
      index: 0,
      value: "Earth",
    }),
    true,
  );
  assert.equal(build.evokerElement, "Earth");
  assert.deepEqual(f5({}).skillIds, [
    elementalistCatalog.skillsByName.get("Calcify").id,
  ]);
  assert.equal(
    elementalistProfession.ui
      .startControls(context)
      .some((control) => control.label === "Familiar"),
    false,
  );
});

test("core attunements enforce and report their individual recharge", () => {
  const result = runNative({
    lines: [["Fire"], ["Air"], ["Arcane"]],
    rotation: ["Air Attunement", "Water Attunement", "Fire Attunement"],
    startAttunement: "Fire",
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      alacrity: false,
    },
  });
  const swaps = result.steps.filter((step) =>
    String(step.skill).endsWith(" Attunement"),
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    swaps.map((step) => step.start),
    [0, 1275, 8500],
  );
  assert.equal(result.endState.profession.primaryAttunement, "Fire");
  assert.ok(result.endState.cooldowns["Air Attunement"].remaining > 1000);
  assert.ok(result.endState.cooldowns["Water Attunement"].remaining > 1000);
  const waterView = paletteSkillView(
    {
      build: elementalistProfession.createBuildDefaults(),
      adapter: elementalistAppAdapter,
      profession: elementalistProfession,
      skillById: elementalistCatalog.skillsById,
      skillByName: elementalistCatalog.skillsByName,
      results: result,
    },
    elementalistCatalog.skillsByName.get("Water Attunement"),
  );
  assert.equal(waterView.disabled, true);
  assert.equal(waterView.cooldownLabel, "8.5s");
});

test("Ride the Lightning receives its on-hit cooldown reduction", () => {
  const result = runNative({
    lines: [["Fire"], ["Earth"], ["Arcane"]],
    rotation: ["Ride the Lightning"],
    startAttunement: "Air",
    weapons: ["Sword", "Dagger"],
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      alacrity: false,
    },
  });
  const action = result.events.find(
    (event) =>
      event.type === "action" && event.skillName === "Ride the Lightning",
  );

  assert.ok(action);
  assert.equal(action.rechargeReadyAt - action.endsAt, 10);
});

test("Fresh Air grants ferocity when entering Air, not when resetting it", () => {
  const result = runNative({
    lines: [["Fire"], ["Air", "1-1-2"], ["Arcane"]],
    rotation: ["Air Attunement", 6000],
    startAttunement: "Fire",
  });
  const freshAir = result.events.filter(
    (event) => event.type === "buff" && event.kind === "fresh air",
  );

  assert.equal(freshAir.length, 1);
  assert.equal(freshAir[0].duration, 5);
});

test("Weaver attunements use the shared four-second recharge", () => {
  const result = runNative({
    lines: [["Fire"], ["Air"], ["Weaver"]],
    rotation: ["Water Attunement", "Air Attunement"],
    startAttunement: "Fire",
    secondaryAttunement: "Fire",
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      alacrity: false,
    },
  });
  const swaps = result.steps.filter((step) =>
    String(step.skill).endsWith(" Attunement"),
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    swaps.map((step) => step.start),
    [0, 4000],
  );
});

test("cooldown reset also resets native attunement recharge", () => {
  const result = runNative({
    lines: [["Fire"], ["Air"], ["Arcane"]],
    rotation: ["Air Attunement", { type: "cooldown-reset" }, "Fire Attunement"],
    startAttunement: "Fire",
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      alacrity: false,
    },
  });
  const fire = result.steps.find((step) => step.skill === "Fire Attunement");

  assert.deepEqual(result.warnings, []);
  assert.equal(fire.start, 0);
});

test("autoattack chains carry across attunements until their third strike", () => {
  const fireRoot = elementalistCatalog.skillsByName.get("Fire Strike").id;
  const fireSecond = elementalistCatalog.skillsByName.get("Fire Swipe");
  const airRoot = elementalistCatalog.skillsByName.get("Charged Strike").id;
  assert.deepEqual(
    elementalistCatalog.autoattackChains
      .find((chain) => chain[0] === fireRoot)
      .map((id) => elementalistCatalog.skillsById.get(id).name),
    ["Fire Strike", "Fire Swipe", "Searing Slash"],
  );

  const carried = runNative({
    lines: [["Fire"], ["Air"], ["Arcane"]],
    rotation: ["Fire Strike", "Air Attunement"],
    startAttunement: "Fire",
    weapons: ["Sword", "Dagger"],
  });
  assert.deepEqual(carried.warnings, []);
  assert.deepEqual(carried.endState.profession.autoattackCarryover, {
    root: fireRoot,
    attunement: "Fire",
  });
  assert.equal(
    carried.endState.profession.autoattackChains[fireRoot],
    fireSecond.id,
  );
  assert.equal(
    elementalistProfession.ui.paletteSkillAvailability(
      {
        specialization: "Core",
        professionState: carried.endState.profession,
        time: carried.endState.time / 1000,
        catalog: elementalistCatalog,
        build: { startAttunement: "Fire" },
      },
      fireSecond,
    ).available,
    true,
  );

  const completed = runNative({
    lines: [["Fire"], ["Air"], ["Arcane"]],
    rotation: [
      "Fire Strike",
      "Air Attunement",
      "Fire Swipe",
      "Searing Slash",
      "Charged Strike",
    ],
    startAttunement: "Fire",
    weapons: ["Sword", "Dagger"],
  });
  assert.deepEqual(completed.warnings, []);
  assert.equal(completed.endState.profession.autoattackCarryover, null);
  assert.equal(
    completed.endState.profession.autoattackChains[airRoot],
    elementalistCatalog.skillsByName.get("Polaric Slash").id,
  );
});

test("a skill in the new attunement interrupts autoattack carryover", () => {
  const result = runNative({
    lines: [["Fire"], ["Air"], ["Arcane"]],
    rotation: ["Fire Strike", "Air Attunement", "Polaric Leap", "Fire Swipe"],
    startAttunement: "Fire",
    weapons: ["Sword", "Dagger"],
  });

  assert.equal(result.endState.profession.autoattackCarryover, null);
  assert.equal(
    result.events.some(
      (event) => event.type === "action" && event.skillName === "Fire Swipe",
    ),
    false,
  );
  assert.equal(
    result.warnings.some((warning) => warning.includes("Fire Swipe")),
    true,
  );
});

test("a concurrent attunement swap preserves the in-flight auto chain", () => {
  const airAttunement = elementalistCatalog.skillsByName.get("Air Attunement");
  const result = runNative({
    lines: [["Fire"], ["Air"], ["Arcane"]],
    rotation: [
      "Fire Strike",
      {
        type: "cast",
        skillId: airAttunement.id,
        concurrentOffsetMs: 100,
      },
      "Fire Swipe",
    ],
    startAttunement: "Fire",
    weapons: ["Sword", "Dagger"],
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some(
      (event) => event.type === "action" && event.skillName === "Fire Swipe",
    ),
    true,
  );
});

test("rotation palette resolves equipped glyphs to the active attunement", () => {
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    selectedSkills: {
      ...elementalistProfession.createBuildDefaults().selectedSkills,
      Utility2: "Glyph of Storms (Fire)",
    },
  });
  const app = {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    skills: elementalistCatalog.skills,
    skillByName: elementalistCatalog.skillsByName,
    skillById: elementalistCatalog.skillsById,
    results: {
      endState: { profession: { primaryAttunement: "Air" } },
    },
  };

  assert.equal(
    rotationSelectedSlotSkills(app).some(
      (skill) => skill.name === "Glyph of Storms (Air)",
    ),
    true,
  );
  assert.equal(
    elementalistProfession.ui.paletteSkillAvailability(
      {
        build,
        specialization: "Weaver",
        professionState: { primaryAttunement: "Air" },
      },
      elementalistCatalog.skillsByName.get("Glyph of Storms (Air)"),
    ).available,
    true,
  );
});

test("equipped glyphs remain available across attunement variants", () => {
  const result = runNative({
    lines: [["Fire"], ["Air"], ["Arcane"]],
    rotation: ["Air Attunement", "Glyph of Storms (Air)"],
    startAttunement: "Fire",
    selectedSkills: {
      Heal: "Glyph of Elemental Harmony",
      Utility1: "Arcane Blast",
      Utility2: "Glyph of Storms (Fire)",
      Utility3: "Arcane Wave",
      Elite: "Glyph of Elementals",
    },
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some(
      (event) =>
        event.type === "action" && event.skillName === "Glyph of Storms (Air)",
    ),
    true,
  );
});

test("attunement variants of an equipped glyph share their cooldown", () => {
  const result = runNative({
    lines: [["Fire"], ["Air"], ["Arcane"]],
    rotation: [
      "Air Attunement",
      "Glyph of Storms (Air)",
      10000,
      "Fire Attunement",
      "Glyph of Storms (Fire)",
    ],
    startAttunement: "Fire",
    selectedSkills: {
      Heal: "Glyph of Elemental Harmony",
      Utility1: "Arcane Blast",
      Utility2: "Glyph of Storms (Fire)",
      Utility3: "Arcane Wave",
      Elite: "Glyph of Elementals",
    },
  });
  const casts = result.steps.filter((step) =>
    String(step.skill).startsWith("Glyph of Storms"),
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(casts.length, 2);
  assert.ok(casts[1].start - casts[0].start >= 48000);
});

test("Primordial Stance variants share charges and count recharge", () => {
  const result = runNative({
    lines: [["Fire"], ["Air"], ["Weaver"]],
    rotation: [
      "Primordial Stance (Fire)",
      "Air Attunement",
      "Primordial Stance (Air)",
      "Earth Attunement",
      "Primordial Stance (Earth)",
    ],
    startAttunement: "Fire",
    secondaryAttunement: "Fire",
    selectedSkills: {
      Heal: "Glyph of Elemental Harmony",
      Utility1: "Primordial Stance (Fire)",
      Utility2: "Glyph of Storms (Fire)",
      Utility3: "Arcane Wave",
      Elite: "Weave Self",
    },
  });
  const casts = result.steps.filter((step) =>
    String(step.skill).startsWith("Primordial Stance"),
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(casts.length, 3);
  assert.ok(casts[2].start - casts[0].start >= 16000);
});

test("Evasive Arcana uses the active attunement's native trait skill", () => {
  const result = runNative({
    lines: [["Fire"], ["Air"], ["Arcane", "1-1-1"]],
    rotation: ["Dodge", 1000],
    startAttunement: "Fire",
  });
  assert.equal(result.endState.profession.endurance, 57.5);
  assert.equal(
    result.resolvedEvents.some(
      (event) =>
        event.type === "damage" && event.skillName === "Flame Burst (trait)",
    ),
    true,
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === "condition" &&
        event.skillName === "Flame Burst (trait)" &&
        event.condition === "Burning" &&
        event.stacks === 3,
    ),
    true,
  );
});

test("Weaver mechanics execute through native hooks", () => {
  const result = runNative({
    lines: [["Fire"], ["Air"], ["Weaver"]],
    rotation: [
      "Weave Self",
      "Water Attunement",
      "Air Attunement",
      "Earth Attunement",
      "Tailored Victory",
    ],
    startAttunement: "Fire",
    secondaryAttunement: "Fire",
    selectedSkills: {
      Heal: "Glyph of Elemental Harmony",
      Utility1: "Arcane Blast",
      Utility2: "Signet of Fire",
      Utility3: "Arcane Wave",
      Elite: "Weave Self",
    },
  });
  assert.equal(
    result.events.some(
      (event) => event.type === "buff" && event.kind === "perfect weave",
    ),
    true,
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === "action" && event.skillName === "Tailored Victory",
    ),
    true,
  );
  assert.equal(result.endState.profession.perfectWeaveUntil, 0);
});

test("Evoker mechanics execute through native hooks", () => {
  const result = runNative({
    lines: [["Fire"], ["Air"], ["Evoker"]],
    rotation: ["Lightning Blitz", 4000],
    evokerElement: "Air",
    initialEvokerCharges: 6,
    initialEvokerEmpowered: 3,
  });
  assert.equal(result.endState.profession.maximumCharges, 6);
  assert.equal(result.endState.profession.empowered, 0);
  assert.equal(
    result.resolvedEvents.filter(
      (event) =>
        event.type === "damage" && event.skillName === "Electric Enchantment",
    ).length,
    3,
  );
});

test("Evoker weapon skills build familiar charges", () => {
  const result = runNative({
    lines: [["Fire"], ["Air"], ["Evoker"]],
    rotation: ["Flame Uprising"],
    startAttunement: "Fire",
    weapons: ["Sword", "Dagger"],
    evokerElement: "Fire",
    initialEvokerCharges: 0,
  });
  const charge = result.events.find(
    (event) =>
      event.type === "resource" &&
      event.kind === "evoker-charges" &&
      event.source === "Flame Uprising",
  );

  assert.ok(charge);
  assert.equal(charge.change, 2);
  assert.equal(result.endState.profession.charges, 2);
});

test("Specialized Elements forces and locks the selected attunement", () => {
  const result = runNative({
    lines: [["Fire"], ["Air"], ["Evoker", "1-1-3"]],
    rotation: ["Fire Attunement"],
    startAttunement: "Fire",
    evokerElement: "Air",
  });

  assert.equal(result.endState.profession.primaryAttunement, "Air");
  assert.equal(
    result.events.some((event) => event.type === "elementalist.attunement"),
    false,
  );
  assert.equal(
    result.warnings.some((warning) =>
      String(warning).includes(
        "attunement swapping is disabled by Specialized Elements",
      ),
    ),
    true,
  );
});

test("Zap grants its five-second strike-damage buff", () => {
  const result = runNative({
    lines: [["Fire"], ["Air"], ["Evoker"]],
    rotation: ["Zap"],
    evokerElement: "Air",
    initialEvokerCharges: 6,
  });

  assert.equal(
    result.events.some(
      (event) =>
        event.type === "buff" &&
        event.kind === "zap buff" &&
        event.duration === 5,
    ),
    true,
  );
});
