import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  migrateNecromancerBuild,
} from "../js/professions/necromancer/build.js";
import {
  necromancerCatalog,
} from "../js/professions/necromancer/catalog.js";
import {
  recalculate,
  runSimulation,
} from "../js/professions/necromancer/app/app-definition.js";
import {
  recalculate as recalculateRevenant,
  runSimulation as runRevenantSimulation,
} from "../js/professions/revenant/app/app-definition.js";
import {
  migrateRevenantBuild,
} from "../js/professions/revenant/build.js";
import {
  revenantCatalog,
} from "../js/professions/revenant/catalog.js";

test("native build manifests and assets stay profession-scoped", async () => {
  const professions = [
    "engineer",
    "guardian",
    "mesmer",
    "necromancer",
    "revenant",
  ];

  for (const profession of professions) {
    const manifest = JSON.parse(await readFile(
      new URL(`../Builds/${profession}/manifest.json`, import.meta.url),
      "utf8",
    ));
    const presets = manifest.flatMap((section) => section.presets);

    assert.ok(presets.length > 0, profession);
    for (const preset of presets) {
      assert.match(
        preset.build,
        new RegExp(`^Builds/${profession}/[^/]+\\.json$`),
      );
      const build = JSON.parse(await readFile(
        new URL(`../${preset.build}`, import.meta.url),
        "utf8",
      ));
      if (build.profession) {
        assert.equal(build.profession, profession);
      }
      if (preset.rotation) {
        assert.match(
          preset.rotation,
          new RegExp(`^Rotations/${profession}/[^/]+\\.json$`),
        );
        const rotation = JSON.parse(await readFile(
          new URL(`../${preset.rotation}`, import.meta.url),
          "utf8",
        ));
        assert.ok(Array.isArray(rotation.rotation));
        assert.ok(rotation.rotation.length > 0);
      }
    }
  }
});

test("Necromancer rotation presets stay separate from Elementalist presets", async () => {
  const [necromancerManifest, elementalistManifest] = await Promise.all([
    readFile(
      new URL("../Builds/necromancer/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../Builds/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ]);
  const presets = necromancerManifest.flatMap((section) =>
    section.presets.map((preset) => ({
      section: section.section,
      label: preset.label,
      build: preset.build,
      rotation: preset.rotation,
    })),
  );

  assert.deepEqual(
    presets.map(({ section, label, rotation }) => ({
      section,
      label,
      rotation,
    })),
    [
      {
        section: "Scourge",
        label: "Condition",
        rotation: "Rotations/necromancer/r-condi-scourge-bench.json",
      },
      {
        section: "Reaper",
        label: "Power",
        rotation: "Rotations/necromancer/r-power-reaper-bench.json",
      },
      {
        section: "Reaper",
        label: "Condition",
        rotation: "Rotations/necromancer/r-condi-reaper-bench.json",
      },
      {
        section: "Ritualist",
        label: "Power (Greatsword / Spear)",
        rotation: "Rotations/necromancer/r-power-ritualist-bench.json",
      },
      {
        section: "Harbinger",
        label: "Power",
        rotation: "Rotations/necromancer/r-power-harbinger-bench.json",
      },
      {
        section: "Harbinger",
        label: "Condition",
        rotation: "Rotations/necromancer/r-condi-harbinger-bench.json",
      },
    ],
  );

  const elementalistPresetPaths = new Set(
    elementalistManifest.flatMap((section) =>
      section.presets.flatMap((preset) =>
        [preset.build, preset.rotation].filter(Boolean),
      ),
    ),
  );
  for (const preset of presets) {
    assert.equal(elementalistPresetPaths.has(preset.build), false);
    assert.equal(elementalistPresetPaths.has(preset.rotation), false);

    const savedRotation = JSON.parse(await readFile(
      new URL(`../${preset.rotation}`, import.meta.url),
      "utf8",
    ));
    assert.ok(Array.isArray(savedRotation.rotation));
    assert.ok(savedRotation.rotation.length > 0);
  }
});

test("new Necromancer rotation presets execute without warnings", async () => {
  const presets = [
    ["b-power-reaper.json", "r-power-reaper-bench.json"],
    ["b-power-harbinger.json", "r-power-harbinger-bench.json"],
    ["b-condi-harbinger.json", "r-condi-harbinger-bench.json"],
  ];

  for (const [buildFile, rotationFile] of presets) {
    const [savedBuild, savedRotation] = await Promise.all([
      readFile(
        new URL(`../Builds/necromancer/${buildFile}`, import.meta.url),
        "utf8",
      ).then(JSON.parse),
      readFile(
        new URL(`../Rotations/necromancer/${rotationFile}`, import.meta.url),
        "utf8",
      ).then(JSON.parse),
    ]);
    const build = migrateNecromancerBuild({
      ...savedBuild,
      rotation: savedRotation.rotation,
    });
    if (buildFile === "b-condi-harbinger.json") {
      assert.deepEqual(build.weaponSigils, [
        ["Demons", "Torment"],
        ["Demons", "Bursting"],
      ]);
    }
    const app = {
      build,
      skillByName: necromancerCatalog.skillsByName,
      attributeWeaponSet: 1,
    };

    recalculate(app);
    const result = runSimulation(app);

    assert.deepEqual(result.warnings, [], rotationFile);
    assert.ok(result.dps > 0, rotationFile);
  }
});

test("all Revenant default rotations are surfaced from its own directory", async () => {
  const manifest = JSON.parse(await readFile(
    new URL("../Builds/revenant/manifest.json", import.meta.url),
    "utf8",
  ));
  const presets = manifest.flatMap((section) =>
    section.presets
      .filter((preset) => preset.rotation)
      .map((preset) => ({
        section: section.section,
        label: preset.label,
        rotation: preset.rotation,
      })),
  );

  assert.deepEqual(presets, [
    {
      section: "Renegade",
      label: "Condition (Shortbow / Mace-Axe)",
      rotation:
        "Rotations/revenant/r-condi-renegade-shortbow-mace-axe-benchmark.json",
    },
    {
      section: "Renegade",
      label: "Condition (Mace-Axe / Spear)",
      rotation:
        "Rotations/revenant/r-condi-renegade-spear-mace-axe-benchmark.json",
    },
    {
      section: "Herald",
      label: "Condition Quickness (Shortbow / Mace-Axe)",
      rotation:
        "Rotations/revenant/r-condi-quick-herald-shortbow-mace-axe-benchmark.json",
    },
    {
      section: "Vindicator",
      label: "Power (Greatsword / SwSw - Energy)",
      rotation:
        "Rotations/revenant/r-power-vindicator-greatsword-benchmark.json",
    },
    {
      section: "Conduit",
      label: "Power (Greatsword / SwSw)",
      rotation: "Rotations/revenant/r-power-conduit-bench.json",
    },
    {
      section: "Conduit",
      label: "Condition (Mistfire)",
      rotation:
        "Rotations/revenant/r-condi-conduit-mistfire-benchmark.json",
    },
  ]);

  for (const preset of presets) {
    const savedRotation = JSON.parse(await readFile(
      new URL(`../${preset.rotation}`, import.meta.url),
      "utf8",
    ));
    assert.ok(Array.isArray(savedRotation.rotation));
    assert.ok(savedRotation.rotation.length > 0);
  }
});

test("Power Conduit preset executes without warnings", async () => {
  const [savedBuild, savedRotation] = await Promise.all([
    readFile(
      new URL(
        "../Builds/revenant/b-power-conduit.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../Rotations/revenant/r-power-conduit-bench.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
  ]);
  const build = migrateRevenantBuild({
    ...savedBuild,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    skillByName: revenantCatalog.skillsByName,
    attributeWeaponSet: 1,
  };

  recalculateRevenant(app);
  const result = runRevenantSimulation(app);

  assert.deepEqual(result.warnings, []);
  assert.ok(result.dps > 0);
});

test("Guardian and Mesmer rotations are paired with their build templates", async () => {
  const [guardianManifest, mesmerManifest] = await Promise.all([
    readFile(
      new URL("../Builds/guardian/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../Builds/mesmer/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ]);
  const templates = (manifest) =>
    manifest.flatMap((section) =>
      section.presets.map((preset) => ({
        section: section.section,
        label: preset.label,
        rotation: preset.rotation,
      })),
    );
  const guardianTemplates = templates(guardianManifest);
  const mesmerTemplates = templates(mesmerManifest);

  assert.deepEqual(guardianTemplates, [
    {
      section: "Luminary",
      label: "Power",
      rotation: "Rotations/guardian/r-power-luminary-bench.json",
    },
  ]);
  assert.deepEqual(
    mesmerTemplates,
    [
      {
        section: "Chronomancer",
        label: "Power",
        rotation: "Rotations/mesmer/r-power-chronomancer-bench.json",
      },
      {
        section: "Chronomancer",
        label: "Condition",
        rotation: "Rotations/mesmer/r-condi-chronomancer-bench.json",
      },
      {
        section: "Virtuoso",
        label: "Condition",
        rotation: "Rotations/mesmer/r-condi-virtuoso-bench.json",
      },
    ],
  );

  const allPaths = [
    ...guardianTemplates.map((preset) => preset.rotation),
    ...mesmerTemplates.map((preset) => preset.rotation),
  ];
  for (const rotationPath of allPaths) {
    const savedRotation = JSON.parse(await readFile(
      new URL(`../${rotationPath}`, import.meta.url),
      "utf8",
    ));
    assert.ok(Array.isArray(savedRotation.rotation));
    assert.ok(savedRotation.rotation.length > 0);
  }
});
