import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  loadProfession,
  loadProfessionAppAdapter,
  professionOptions,
  professionRegistry,
} from "../../../js/app/profession/registry.js";
import {
  PROFESSION_ROUTES,
  professionRoute,
} from "../../../js/app/profession/selector.js";
import {
  createElementalistBuildDefaults,
  migrateElementalistBuild,
  toApplicationBuild,
  validateElementalistBuild,
} from "../../../js/professions/elementalist/build.js";
import { elementalistCatalog } from "../../../js/professions/elementalist/catalog.js";
const professionRoot = new URL(
  "../../../js/professions/elementalist/",
  import.meta.url,
);

async function professionSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = new URL(
        entry.name + (entry.isDirectory() ? "/" : ""),
        directory,
      );
      if (entry.isDirectory()) return professionSourceFiles(target);
      return /\.(?:[cm]?js|ts)$/.test(entry.name) ? [target] : [];
    }),
  );
  return nested.flat();
}

async function accessSourceModule(target) {
  try {
    await access(target);
  } catch (error) {
    if (!target.pathname.endsWith(".js")) throw error;
    const typeScript = new URL(target);
    typeScript.pathname = typeScript.pathname.replace(/\.js$/, ".ts");
    try {
      await access(typeScript);
    } catch {
      const declaration = new URL(target);
      declaration.pathname = declaration.pathname.replace(/\.js$/, ".d.ts");
      await access(declaration);
    }
  }
}

test("profession selector exposes every ready application route", () => {
  assert.deepEqual(
    PROFESSION_ROUTES,
    Object.fromEntries(professionRegistry.map(({ id, route }) => [id, route])),
  );
  assert.equal(professionRoute("elementalist"), "elementalist.html");
  assert.equal(professionRoute("unknown"), "index.html");
  assert.deepEqual(
    professionOptions,
    professionRegistry.map(({ id, name }) => ({ id, name })),
  );
});

test("Elementalist is registered through the generic profession contract", async () => {
  const [profession, adapter] = await Promise.all([
    loadProfession("elementalist"),
    loadProfessionAppAdapter("elementalist"),
  ]);
  assert.equal(profession.id, "elementalist");
  assert.equal(profession.name, "Elementalist");
  assert.ok(profession.catalog.specializations.length >= 9);
  assert.ok(profession.catalog.traits.length > 0);
  assert.ok(profession.catalog.skills.every((skill) => skill.icon));
  assert.ok(profession.catalog.traits.every((trait) => trait.icon));
  assert.ok(
    profession.catalog.specializations.every(
      (specialization) => specialization.icon,
    ),
  );
  assert.equal(profession.simulation, null);
  assert.equal(adapter.id, "elementalist");
});

test("Elementalist build defaults and saved snapshots migrate explicitly", () => {
  const defaults = createElementalistBuildDefaults();
  assert.equal(defaults.profession, "elementalist");
  assert.equal(defaults.weapons[0], "Sword");
  assert.deepEqual(defaults.alternateWeapons, ["", ""]);
  assert.equal(defaults.startingWeaponSet, 1);
  assert.equal(defaults.assumptions.hitboxSize, "small");
  assert.equal(validateElementalistBuild(defaults).valid, true);
  assert.equal(elementalistCatalog.skillsByName.has("Swap Weapons"), false);

  const migrated = migrateElementalistBuild({
    weapons: ["Scepter", "Warhorn"],
    specializations: defaults.specializations,
  });
  assert.equal(migrated.profession, "elementalist");
  assert.deepEqual(migrated.weapons, ["Scepter", "Warhorn"]);
  assert.equal(validateElementalistBuild(migrated).valid, true);

  const migratedHitbox = migrateElementalistBuild({ hitboxSize: "small" });
  assert.equal(migratedHitbox.assumptions.hitboxSize, "small");

  const collapsed = migrateElementalistBuild({
    ...defaults,
    alternateWeapons: ["Staff", ""],
    startingWeaponSet: 2,
  });
  assert.deepEqual(collapsed.alternateWeapons, ["", ""]);
  assert.equal(collapsed.startingWeaponSet, 1);
  assert.equal(validateElementalistBuild(collapsed).valid, true);
  assert.equal(
    validateElementalistBuild({
      ...defaults,
      alternateWeapons: ["Staff", ""],
    }).valid,
    false,
  );
});

test("standalone Elementalist snapshot fields migrate into the native schema", () => {
  const defaults = createElementalistBuildDefaults();
  const snapshot = {
    build: {
      ...defaults,
      profession: undefined,
      schemaVersion: undefined,
    },
    selectedSkills: {
      heal: "Signet of Restoration",
      util1: "Arcane Blast",
      util2: "Signet of Fire",
      util3: "Arcane Wave",
      elite: "Weave Self",
    },
    activeAttunement: "Water",
    secondaryAttunement: "Earth",
    evokerElement: "Air",
    evokerStartCharges: 4,
    evokerStartEmpowered: 2,
    permaBoons: {
      Might: 17,
      Fury: true,
      Burning: true,
      Vulnerability: 12,
    },
    rotation: [
      "Fire Attunement",
      { name: "__wait", waitMs: 420 },
      "__combat_start",
      { name: "Arcane Blast", offset: 120, interruptMs: 250 },
    ],
  };

  const migrated = migrateElementalistBuild(snapshot);
  assert.equal(validateElementalistBuild(migrated).valid, true);
  assert.deepEqual(migrated.selectedSkills, {
    Heal: "Signet of Restoration",
    Utility1: "Arcane Blast",
    Utility2: "Signet of Fire",
    Utility3: "Arcane Wave",
    Elite: "Weave Self",
  });
  assert.equal(migrated.startAttunement, "Water");
  assert.equal(migrated.secondaryAttunement, "Earth");
  assert.equal(migrated.evokerElement, "Air");
  assert.equal(migrated.initialEvokerCharges, 4);
  assert.equal(migrated.initialEvokerEmpowered, 2);
  assert.equal(migrated.assumptions.might, 17);
  assert.equal(migrated.assumptions.fury, true);
  assert.equal(migrated.assumptions.quickness, false);
  assert.deepEqual(migrated.assumptions.targetConditions, {
    Burning: true,
    Vulnerability: 12,
  });
  assert.equal(migrated.rotation.length, snapshot.rotation.length);
  assert.ok(
    migrated.rotation
      .filter((command) => command.type === "cast")
      .every((command) => elementalistCatalog.skillsById.has(command.skillId)),
  );
  assert.deepEqual(
    toApplicationBuild(snapshot).rotation.map((entry) =>
      typeof entry === "string" ? entry : entry.name,
    ),
    ["Fire Attunement", "__wait", "__combat_start", "Arcane Blast"],
  );
});

test("all Elementalist build and rotation assets migrate through the native codec", async () => {
  const root = new URL("../../../", import.meta.url);
  const manifest = JSON.parse(
    await readFile(new URL("Builds/elementalist/manifest.json", root), "utf8"),
  );
  const presets = manifest.flatMap((section) =>
    section.presets.map((preset) => ({ ...preset, section: section.section })),
  );
  const buildFiles = (await readdir(new URL("Builds/elementalist/", root)))
    .filter((name) => name.startsWith("b-") && name.endsWith(".json"))
    .sort();
  const rotationFiles = (
    await readdir(new URL("Rotations/elementalist/", root))
  )
    .filter((name) => name.startsWith("r-") && name.endsWith(".json"))
    .sort();

  assert.equal(presets.length, 40);
  assert.deepEqual(
    [...new Set(presets.map((preset) => path.basename(preset.build)))].sort(),
    buildFiles,
  );
  assert.deepEqual(
    [
      ...new Set(presets.map((preset) => path.basename(preset.rotation))),
    ].sort(),
    rotationFiles,
  );

  for (const preset of presets) {
    const [savedBuild, savedRotation] = await Promise.all([
      readFile(new URL(preset.build, root), "utf8").then(JSON.parse),
      readFile(new URL(preset.rotation, root), "utf8").then(JSON.parse),
    ]);
    const build = migrateElementalistBuild({
      ...savedBuild,
      rotation: savedRotation.rotation,
    });
    const validation = validateElementalistBuild(build);
    const equipsGlyphOfElementals = Object.values(
      savedBuild.selectedSkills,
    ).includes("Glyph of Elementals");
    const prescribesFlameBarrage = savedRotation.rotation.some((entry) =>
      typeof entry === "string"
        ? entry === "Flame Barrage"
        : entry.name === "Flame Barrage" || entry.skillId === 2662,
    );

    assert.equal(
      validation.valid,
      true,
      `${preset.section}: ${preset.label}: ${validation.errors.join("; ")}`,
    );
    assert.equal(build.rotation.length, savedRotation.rotation.length);
    assert.equal(
      Object.hasOwn(savedBuild.assumptions, "elementalSimulationProfile"),
      false,
      `${preset.section}: ${preset.label}: retired elemental profile`,
    );
    assert.equal(
      Object.hasOwn(savedBuild.assumptions, "glyphBoonedElementals"),
      false,
      `${preset.section}: ${preset.label}: retired elemental boon flag`,
    );
    if (equipsGlyphOfElementals) {
      assert.equal(
        prescribesFlameBarrage,
        true,
        `${preset.section}: ${preset.label}: Flame Barrage rotation command`,
      );
    }
    assert.ok(
      build.rotation
        .filter((command) => command.type === "cast")
        .every((command) =>
          elementalistCatalog.skillsById.has(command.skillId),
        ),
      `${preset.section}: ${preset.label}`,
    );
  }
});

test("every relative import in the Elementalist package resolves", async () => {
  const files = await professionSourceFiles(professionRoot);
  assert.ok(files.length > 30);

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const imports = source.matchAll(/(?:from\s+|import\s*)["'](\.[^"']+)["']/g);
    for (const match of imports) {
      const specifier = match[1].split("?")[0];
      const target = new URL(specifier, file);
      await assert.doesNotReject(
        accessSourceModule(target),
        `${path.relative(process.cwd(), file.pathname)} -> ${specifier}`,
      );
    }
  }
});

test("native Elementalist has no standalone, CSV, or optimizer dependency", async () => {
  const files = await professionSourceFiles(professionRoot);
  assert.ok(files.length > 30);

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const relative = path.relative(process.cwd(), file.pathname);
    assert.doesNotMatch(
      source,
      /(?:[\\/]|["'])legacy(?:[\\/]|["'])/i,
      relative,
    );
    assert.doesNotMatch(source, /\bcsv\b/i, relative);
    assert.doesNotMatch(
      source,
      /\boptimizer\b|effectivePower|effective power/i,
      relative,
    );
  }
});
