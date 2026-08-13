import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { migrateNecromancerBuild } from "../../js/professions/necromancer/build.js";
import { necromancerCatalog } from "../../js/professions/necromancer/catalog.js";
import {
  recalculate,
  runSimulation,
} from "../../js/professions/necromancer/app/app-definition.js";
import {
  recalculate as recalculateRevenant,
  runSimulation as runRevenantSimulation,
} from "../../js/professions/revenant/app/app-definition.js";
import { migrateRevenantBuild } from "../../js/professions/revenant/build.js";
import { revenantCatalog } from "../../js/professions/revenant/catalog.js";

test("native build manifests and assets stay profession-scoped", async () => {
  const professions = [
    "engineer",
    "elementalist",
    "guardian",
    "mesmer",
    "necromancer",
    "ranger",
    "revenant",
    "thief",
  ];

  for (const profession of professions) {
    const manifest = JSON.parse(
      await readFile(
        new URL(`../../Builds/${profession}/manifest.json`, import.meta.url),
        "utf8",
      ),
    );
    const presets = manifest.flatMap((section) => section.presets);

    assert.ok(presets.length > 0, profession);
    for (const preset of presets) {
      assert.match(
        preset.build,
        new RegExp(`^Builds/${profession}/[^/]+\\.json$`),
      );
      const build = JSON.parse(
        await readFile(
          new URL(`../../${preset.build}`, import.meta.url),
          "utf8",
        ),
      );
      if (build.profession) {
        assert.equal(build.profession, profession);
      }
      if (preset.rotation) {
        assert.match(
          preset.rotation,
          new RegExp(`^Rotations/${profession}/[^/]+\\.json$`),
        );
        const rotation = JSON.parse(
          await readFile(
            new URL(`../../${preset.rotation}`, import.meta.url),
            "utf8",
          ),
        );
        assert.ok(Array.isArray(rotation.rotation));
        assert.ok(rotation.rotation.length > 0);
      }
    }
  }
});

test("Necromancer rotation presets stay separate from Elementalist presets", async () => {
  const [necromancerManifest, elementalistManifest] = await Promise.all([
    readFile(
      new URL("../../Builds/necromancer/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../../Builds/elementalist/manifest.json", import.meta.url),
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
        label: "Condition (Pistol / Torch + Scepter / Torch)",
        rotation: "Rotations/necromancer/r-condi-scourge-bench.json",
      },
      {
        section: "Reaper",
        label: "Power (Greatsword / Spear)",
        rotation: "Rotations/necromancer/r-power-reaper-bench.json",
      },
      {
        section: "Reaper",
        label: "Condition (Dagger / Sword + Spear)",
        rotation: "Rotations/necromancer/r-condi-reaper-bench.json",
      },
      {
        section: "Reaper",
        label: "Condition (Fields - Pistol / Torch + Greatsword)",
        rotation: "Rotations/necromancer/r-condi-fields-reaper-bench.json",
      },
      {
        section: "Ritualist",
        label: "Power (Greatsword / Spear)",
        rotation: "Rotations/necromancer/r-power-ritualist-bench.json",
      },
      {
        section: "Harbinger",
        label: "Power (Greatsword / Spear)",
        rotation: "Rotations/necromancer/r-power-harbinger-bench.json",
      },
      {
        section: "Harbinger",
        label: "Condition (Pistol / Torch + Scepter / Dagger)",
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

    const savedRotation = JSON.parse(
      await readFile(
        new URL(`../../${preset.rotation}`, import.meta.url),
        "utf8",
      ),
    );
    assert.ok(Array.isArray(savedRotation.rotation));
    assert.ok(savedRotation.rotation.length > 0);
  }
});

test("Necromancer and Thief displayed benchmark DPS stays current", async () => {
  const [necromancerManifest, thiefManifest] = await Promise.all([
    readFile(
      new URL("../../Builds/necromancer/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../../Builds/thief/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ]);
  const necromancerDps = new Map(
    necromancerManifest.flatMap((section) =>
      section.presets.map((preset) => [
        `${section.section}:${preset.label}`,
        preset.benchmarkDps,
      ]),
    ),
  );

  assert.equal(
    necromancerDps.get("Scourge:Condition (Pistol / Torch + Scepter / Torch)"),
    39419,
  );
  assert.equal(necromancerDps.get("Reaper:Power (Greatsword / Spear)"), 43427);
  assert.equal(
    necromancerDps.get("Reaper:Condition (Dagger / Sword + Spear)"),
    43982,
  );
  assert.equal(
    necromancerDps.get("Ritualist:Power (Greatsword / Spear)"),
    42901,
  );
  assert.equal(
    necromancerDps.get("Harbinger:Power (Greatsword / Spear)"),
    43617,
  );
  assert.deepEqual(
    thiefManifest
      .flatMap((section) => section.presets)
      .map((preset) => preset.benchmarkDps),
    [43248, 40790, 36275, 43036],
  );
});

test("new Necromancer rotation presets execute without warnings", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../../Builds/necromancer/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  const conditionHarbinger = manifest
    .find((section) => section.section === "Harbinger")
    ?.presets.find(
      (preset) =>
        preset.label === "Condition (Pistol / Torch + Scepter / Dagger)",
    );
  assert.equal(conditionHarbinger?.benchmarkDps, 45253);

  const presets = [
    ["b-power-reaper.json", "r-power-reaper-bench.json"],
    ["b-power-harbinger.json", "r-power-harbinger-bench.json"],
    ["b-condi-harbinger.json", "r-condi-harbinger-bench.json"],
  ];

  for (const [buildFile, rotationFile] of presets) {
    const [savedBuild, savedRotation] = await Promise.all([
      readFile(
        new URL(`../../Builds/necromancer/${buildFile}`, import.meta.url),
        "utf8",
      ).then(JSON.parse),
      readFile(
        new URL(`../../Rotations/necromancer/${rotationFile}`, import.meta.url),
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
      const darkBarrages = savedRotation.rotation.filter(
        (step) =>
          (typeof step === "string" ? step : step.name) === "Dark Barrage",
      );
      assert.equal(darkBarrages[6].interruptMs, 800);
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
  const manifest = JSON.parse(
    await readFile(
      new URL("../../Builds/revenant/manifest.json", import.meta.url),
      "utf8",
    ),
  );
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
      label: "Power Alacrity (Sword / Sword)",
      rotation:
        "Rotations/revenant/r-power-alac-renegade-sword-sword-benchmark.json",
    },
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
      rotation: "Rotations/revenant/r-condi-conduit-mistfire-benchmark.json",
    },
  ]);

  for (const preset of presets) {
    const savedRotation = JSON.parse(
      await readFile(
        new URL(`../../${preset.rotation}`, import.meta.url),
        "utf8",
      ),
    );
    assert.ok(Array.isArray(savedRotation.rotation));
    assert.ok(savedRotation.rotation.length > 0);
  }
});

test("Power Alacrity Sword Renegade preset executes without warnings", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../../Builds/revenant/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  const preset = manifest
    .find((section) => section.section === "Renegade")
    ?.presets.find(
      (candidate) => candidate.label === "Power Alacrity (Sword / Sword)",
    );
  const [savedBuild, savedRotation] = await Promise.all([
    readFile(new URL(`../../${preset.build}`, import.meta.url), "utf8").then(
      JSON.parse,
    ),
    readFile(new URL(`../../${preset.rotation}`, import.meta.url), "utf8").then(
      JSON.parse,
    ),
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

  assert.equal(preset.benchmarkDps, 34194);
  assert.equal(savedRotation.rotation.length, 262);
  assert.deepEqual(build.weapons, ["Sword", "Sword"]);
  assert.equal(build.specializations[2].name, "Renegade");
  assert.deepEqual(result.warnings, []);
  assert.equal(Math.round(result.dps), preset.benchmarkDps);
  assert.equal(
    result.events.filter(
      (event) =>
        event.type === "action" && event.skillName === "Shackling Wave",
    ).length,
    8,
  );
  assert.equal(
    result.resolvedEvents.filter(
      (event) =>
        event.type === "damage" &&
        event.skillName === "Shackling Wave" &&
        event.damage > 0,
    ).length,
    48,
  );
});

test("Power Conduit preset executes without warnings", async () => {
  const [savedBuild, savedRotation] = await Promise.all([
    readFile(
      new URL("../../Builds/revenant/b-power-conduit.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../../Rotations/revenant/r-power-conduit-bench.json",
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

test("Condition Conduit Mistfire preset matches its benchmark", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../../Builds/revenant/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  const preset = manifest
    .find((section) => section.section === "Conduit")
    ?.presets.find((candidate) => candidate.label === "Condition (Mistfire)");
  const [savedBuild, savedRotation] = await Promise.all([
    readFile(new URL(`../../${preset.build}`, import.meta.url), "utf8").then(
      JSON.parse,
    ),
    readFile(new URL(`../../${preset.rotation}`, import.meta.url), "utf8").then(
      JSON.parse,
    ),
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

  assert.equal(preset.benchmarkDps, 39937);
  assert.equal(preset.upToDate, true);
  assert.deepEqual(result.warnings, []);
  assert.equal(Math.round(result.dps), preset.benchmarkDps);
});

test("Guardian and Mesmer rotations are paired with their build templates", async () => {
  const [guardianManifest, mesmerManifest] = await Promise.all([
    readFile(
      new URL("../../Builds/guardian/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../../Builds/mesmer/manifest.json", import.meta.url),
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
      section: "Dragonhunter",
      label: "Power (Spear / Greatsword)",
      rotation:
        "Rotations/guardian/r-power-dragonhunter-spear-greatsword-bench.json",
    },
    {
      section: "Luminary",
      label: "Power",
      rotation: "Rotations/guardian/r-power-luminary-bench.json",
    },
    {
      section: "Luminary",
      label: "Power Alacrity (Greatsword / Spear)",
      rotation: "Rotations/guardian/r-power-alac-luminary-bench.json",
    },
  ]);
  assert.deepEqual(mesmerTemplates, [
    {
      section: "Chronomancer",
      label: "Power",
      rotation: "Rotations/mesmer/r-power-chronomancer-evtc-rebuild.json",
    },
    {
      section: "Chronomancer",
      label: "Condition",
      rotation: "Rotations/mesmer/r-condi-chronomancer-bench.json",
    },
    {
      section: "Mirage",
      label: "Condition - Dune Cloak",
      rotation: "Rotations/mesmer/r-condi-mirage-dune-cloak-bench.json",
    },
    {
      section: "Virtuoso",
      label: "Condition",
      rotation: "Rotations/mesmer/r-condi-virtuoso-bench.json",
    },
    {
      section: "Troubadour",
      label: "Power (Dagger-Sword / Spear)",
      rotation: "Rotations/mesmer/r-power-troubadour-bench.json",
    },
  ]);

  const allPaths = [
    ...guardianTemplates.map((preset) => preset.rotation),
    ...mesmerTemplates.map((preset) => preset.rotation),
  ];
  for (const rotationPath of allPaths) {
    const savedRotation = JSON.parse(
      await readFile(new URL(`../../${rotationPath}`, import.meta.url), "utf8"),
    );
    assert.ok(Array.isArray(savedRotation.rotation));
    assert.ok(savedRotation.rotation.length > 0);
    if (rotationPath.endsWith("r-power-chronomancer-evtc-rebuild.json")) {
      assert.equal(
        savedRotation.rotation.some((step) => step.name === "__wait"),
        false,
      );
    }
  }
});
