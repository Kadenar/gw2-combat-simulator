import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  groupedOptions,
  option,
  PERMANENT_TARGET_CONDITIONS,
  PRIMARY_ATTRIBUTES,
  STACKING_TARGET_CONDITIONS,
} from "../js/app/app-ui.js";
import { getBuildExportPayload } from "../js/app/app-io.js";
import {
  createDefaultBuild,
  replaceBuildConfiguration,
} from "../js/app/app-state.js";
import {
  loadProfessionAppAdapter,
  nativeProfessionRegistry,
  PROFESSION_APPLICATION_KINDS,
  professionOptions,
  professionRegistry,
} from "../js/app/profession-registry.js";
import {
  professionRoute,
} from "../js/app/profession-selector.js";
import {
  autoattackChainSkillAvailable,
  paletteActionSkills,
  resultSkillIcon,
  weaponPaletteSectionHtml,
  weaponPaletteStackHtml,
  weaponPaletteRows,
} from "../js/app/rotation-ui.js";
import {
  WEAPON_DATA,
  createProfessionWeaponData,
} from "../js/platform/gw2/gear-data.js";
import {
  createGuardianBuildDefaults,
} from "../js/professions/guardian/build.js";
import {
  guardianProfession,
} from "../js/professions/guardian/definition.js";
import {
  createMesmerBuildDefaults,
} from "../js/professions/mesmer/build.js";
import {
  mesmerProfession,
} from "../js/professions/mesmer/definition.js";
import {
  createDefaultConfig,
  simulateMesmer,
} from "./helpers/mesmer-simulation.js";

test("shared app options escape labels and preserve selection state", () => {
  assert.equal(
    option("a&b", "a&b", "<label>", true),
    '<option value="a&amp;b" selected disabled>&lt;label&gt;</option>',
  );
  assert.equal(
    groupedOptions(
      [{ label: "Damage & support", items: ["Power"] }],
      "Power",
      value => `${value} <stat>`,
    ),
    '<optgroup label="Damage &amp; support"><option value="Power" selected>Power &lt;stat&gt;</option></optgroup>',
  );
});

test("shared app metadata owns common attributes and target conditions", () => {
  assert.equal(PRIMARY_ATTRIBUTES.includes("Condition Damage"), true);
  assert.equal(PERMANENT_TARGET_CONDITIONS.includes("Vulnerability"), true);
  assert.equal(STACKING_TARGET_CONDITIONS.has("Vulnerability"), true);
  assert.equal(STACKING_TARGET_CONDITIONS.has("Burning"), false);
});

test("shared app runtime and platform rotation helpers are profession neutral", async () => {
  const sources = await Promise.all([
    readFile(new URL("../js/app/app-runtime.js", import.meta.url), "utf8"),
    readFile(new URL("../js/app/app-state.js", import.meta.url), "utf8"),
    readFile(new URL("../js/app/app.js", import.meta.url), "utf8"),
    readFile(
      new URL("../js/app/gw2-simulation-config.js", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../js/app/modifier-contributions-worker.js", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../js/platform/ui/rotation-results.js", import.meta.url), "utf8"),
  ]);
  const professionTerms = nativeProfessionRegistry.flatMap((entry) => [
    entry.id,
    entry.name,
  ]);

  for (const source of sources) {
    for (const term of professionTerms) {
      assert.equal(
        source.toLowerCase().includes(term.toLowerCase()),
        false,
        term,
      );
    }
  }
});

test("Guardian is exposed by the profession selector and app composition", async () => {
  const guardianPage = await readFile(
    new URL("../guardian.html", import.meta.url),
    "utf8",
  );
  assert.equal(
    professionOptions.some(option => option.id === "guardian"),
    true,
  );
  assert.equal(professionRoute("guardian"), "guardian.html");
  assert.equal(
    (await loadProfessionAppAdapter("guardian"))?.id,
    "guardian",
  );
  assert.match(guardianPage, /data-profession="guardian"/);
  assert.match(guardianPage, /data-active-profession="guardian"/);
});

test("the generic landing page and profession simulators have separate entries", async () => {
  const landingPage = await readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  const professionPages = await Promise.all(
    professionRegistry.map(async (entry) => ({
      entry,
      source: await readFile(
        new URL(`../${entry.route}`, import.meta.url),
        "utf8",
      ),
    })),
  );

  assert.match(landingPage, /<body class="landing-page">/);
  assert.match(landingPage, /data-profession-grid/);
  assert.doesNotMatch(landingPage, /profession-card-mesmer/);
  assert.deepEqual(
    professionOptions,
    professionRegistry.map(({ id, name }) => ({ id, name })),
  );
  assert.equal(
    new Set(professionRegistry.map((entry) => entry.route)).size,
    professionRegistry.length,
  );
  assert.doesNotMatch(landingPage, /js\/app\/app\.js/);
  assert.doesNotMatch(landingPage, /ARCHITECTURE\.md/);
  for (const { entry, source } of professionPages) {
    assert.match(
      source,
      /<a class="home-link" href="index\.html">← All professions<\/a>/,
    );
    assert.equal(professionRoute(entry.id), entry.route);
    if (entry.applicationKind === PROFESSION_APPLICATION_KINDS.NATIVE) {
      assert.match(source, new RegExp(`data-profession="${entry.id}"`));
      assert.match(source, /js\/app\/app\.js/);
    }
  }
});

test("Mesmer default builds resolve without embedded rotations", async () => {
  const manifest = JSON.parse(await readFile(
    new URL("../Builds/mesmer-manifest.json", import.meta.url),
    "utf8",
  ));
  const adapter = await loadProfessionAppAdapter("mesmer");
  const presets = manifest.flatMap(section => section.presets);

  assert.deepEqual(
    presets.map(preset => preset.label),
    ["Power", "Condition", "Condition"],
  );
  for (const preset of presets) {
    const saved = JSON.parse(await readFile(
      new URL(`../${preset.build}`, import.meta.url),
      "utf8",
    ));
    const build = adapter.toApplicationBuild(saved);
    assert.equal(Object.hasOwn(saved, "rotation"), false);
    assert.equal(build.schemaVersion, 3);
    assert.equal(build.profession, "mesmer");
    assert.equal(build.specializations.length, 3);
  }
});

test("Necromancer Harbinger default builds resolve without rotations", async () => {
  const manifest = JSON.parse(await readFile(
    new URL("../Builds/necromancer-manifest.json", import.meta.url),
    "utf8",
  ));
  const adapter = await loadProfessionAppAdapter("necromancer");
  const presets = manifest.flatMap(section => section.presets);

  assert.deepEqual(manifest.map(section => section.section), ["Harbinger"]);
  assert.deepEqual(
    presets.map(preset => preset.label),
    ["Power", "Condition"],
  );
  for (const preset of presets) {
    const saved = JSON.parse(await readFile(
      new URL(`../${preset.build}`, import.meta.url),
      "utf8",
    ));
    const build = adapter.toApplicationBuild(saved);
    assert.equal(Object.hasOwn(saved, "rotation"), false);
    assert.equal(build.profession, "necromancer");
    assert.equal(build.specializations[2].name, "Harbinger");
    assert.equal(build.weapons.length, 2);
    assert.equal(build.alternateWeapons.length, 2);
  }
  const power = JSON.parse(await readFile(
    new URL(`../${presets[0].build}`, import.meta.url),
    "utf8",
  ));
  assert.deepEqual(power.weapons, ["Greatsword", ""]);
  assert.deepEqual(power.alternateWeapons, ["Spear", ""]);
  assert.equal(power.rune, "Dragonhunter");
  assert.deepEqual(power.weaponSigils, [
    ["Force", "Accuracy"],
    ["Force", "Accuracy"],
  ]);
  assert.equal(power.selectedSkills.Utility1, "Well of Suffering");
  assert.equal(power.selectedSkills.Utility2, "Well of Darkness");
});

test("build import and export leave rotation state separate", async () => {
  const adapter = await loadProfessionAppAdapter("mesmer");
  const current = createDefaultBuild(adapter);
  current.rotation = ["Keep this rotation"];
  const imported = {
    ...createDefaultBuild(adapter),
    rune: "Krait",
    rotation: ["Do not import this rotation"],
  };

  const loaded = replaceBuildConfiguration(imported, current, adapter);
  const exported = getBuildExportPayload(loaded);

  assert.deepEqual(loaded.rotation, ["Keep this rotation"]);
  assert.equal(loaded.rune, "Krait");
  assert.equal(Object.hasOwn(exported, "rotation"), false);
  assert.deepEqual(current.rotation, ["Keep this rotation"]);
});

test("Mesmer and Guardian palettes retain both weapon-set rows", () => {
  const appFor = (profession, build) => ({
    profession,
    build,
    skills: profession.catalog.skills,
    adapter: {
      eliteSpecialization: () => "",
      isSkillAvailable: () => true,
    },
    weaponData: createProfessionWeaponData(
      profession.catalog,
      { weaponData: WEAPON_DATA },
    ),
  });
  for (const app of [
    appFor(mesmerProfession, createMesmerBuildDefaults()),
    appFor(guardianProfession, createGuardianBuildDefaults()),
  ]) {
    const setOne = weaponPaletteRows(app, 1);
    const setTwo = weaponPaletteRows(app, 2);
    assert.deepEqual(setOne.map(row => row.label), ["W1", "W2"]);
    assert.deepEqual(setTwo.map(row => row.label), ["W1", "W2"]);
    assert.deepEqual(setOne.map(row => row.active), [true, false]);
    assert.deepEqual(setTwo.map(row => row.active), [false, true]);
    assert.equal(setOne.every(row => row.skills.length > 0), true);
  }
});

test("Mesmer palette advances through autoattack chain skills", () => {
  const config = {
    ...createDefaultConfig(),
    specialization: "Core",
    primaryWeapon: "Sword",
    secondaryWeapon: "Focus",
    initialResource: 0,
  };
  const skill = name => mesmerProfession.catalog.skillsByName.get(name);
  const availabilityAfter = rotation => {
    const result = simulateMesmer(rotation, config);
    const chainState = result.endState.profession.autoattackChains;
    return ["Mind Slash", "Mind Gash", "Mind Spike"].map(name =>
      autoattackChainSkillAvailable(skill(name), chainState));
  };

  assert.deepEqual(availabilityAfter(["Mind Slash"]), [false, true, false]);
  assert.deepEqual(
    availabilityAfter(["Mind Slash", "Mind Gash"]),
    [false, false, true],
  );
});

test("damage result rows reuse the icons shown for generated procs", () => {
  const earthIcon = "earth.png";
  const nourishmentIcon = "nourishment.png";
  const phantasmalBladesIcon = "phantasmal-blades.png";
  const meltdownIcon = "meltdown.png";
  const explicitIcon = "soul-shards.png";
  const app = {
    attributeData: {
      activeTraits: [{
        name: "Phantasmal Blades",
        icon: phantasmalBladesIcon,
      }],
    },
    results: {
      procSteps: [
        {
          type: "sigil_proc",
          skill: "Sigil of Earth",
          sourceSkill: "Bladecall",
          icon: earthIcon,
        },
        {
          type: "food_proc",
          skill: "Nourishment",
          sourceSkill: "Bladecall",
          icon: nourishmentIcon,
        },
        {
          type: "trait_proc",
          skill: "Phantasmal Blades",
          sourceSkill: "Phantasmal Lancer",
        },
        {
          type: "trait_proc",
          skill: "Meltdown",
          sourceSkill: "Devouring Cut",
          icon: meltdownIcon,
        },
      ],
    },
    skillByName: new Map(),
    skills: [],
  };

  assert.equal(
    resultSkillIcon(app, { name: "Sigil of Earth" }),
    earthIcon,
  );
  assert.equal(
    resultSkillIcon(app, { name: "Nourishment" }),
    nourishmentIcon,
  );
  assert.equal(
    resultSkillIcon(app, { name: "Phantasmal Blade" }),
    phantasmalBladesIcon,
  );
  assert.equal(
    resultSkillIcon(app, { name: "Cascading Corruption" }),
    meltdownIcon,
  );
  assert.equal(
    resultSkillIcon(app, { name: "Soul Shards", icon: explicitIcon }),
    explicitIcon,
  );
});

test("clone attack damage rows use their weapon skill icons", () => {
  const windsIcon = "winds-of-chaos.png";
  const etherBoltIcon = "ether-bolt.png";
  const app = {
    attributeData: { activeTraits: [] },
    results: { procSteps: [] },
    skillByName: new Map([
      ["Winds of Chaos", { icon: windsIcon }],
      ["Ether Bolt", { icon: etherBoltIcon }],
    ]),
    skills: [],
  };

  assert.equal(
    resultSkillIcon(app, { name: "Clone: Winds of Chaos" }),
    windsIcon,
  );
  assert.equal(
    resultSkillIcon(app, { name: "Clone: Ether Bolt" }),
    etherBoltIcon,
  );
});

test("Mesmer weapon palette orders autoattack chains by chain step", () => {
  const build = createMesmerBuildDefaults();
  build.specializations[2] = { name: "Mirage", traits: "1-1-1" };
  build.weapons = ["Axe", "Sword"];
  const app = {
    profession: mesmerProfession,
    build,
    skills: mesmerProfession.catalog.skills,
    adapter: {
      eliteSpecialization: () => "Mirage",
      isSkillAvailable: () => true,
    },
    weaponData: createProfessionWeaponData(
      mesmerProfession.catalog,
      { weaponData: WEAPON_DATA },
    ),
  };

  assert.deepEqual(
    weaponPaletteRows(app, 1)[0].skills
      .filter(skill => skill.chainRoot === 44791)
      .map(skill => skill.name),
    ["Lacerating Chop", "Ethereal Chop", "Mirror Strikes"],
  );
});

test("weapon-set palette groups render vertically in set order", () => {
  const html = weaponPaletteStackHtml([
    '<div data-weapon-set="1">W1</div>',
    '<div data-weapon-set="2">W2</div>',
  ]);
  assert.match(html, /data-role="weapon-set-stack"/);
  assert.match(html, /flex-direction:column/);
  assert.equal(
    html.indexOf('data-weapon-set="1"') < html.indexOf('data-weapon-set="2"'),
    true,
  );
});

test("weapon actions stay ordered beside the stacked weapon sets", () => {
  const mesmer = {
    profession: mesmerProfession,
    build: createMesmerBuildDefaults(),
    skills: mesmerProfession.catalog.skills,
    adapter: {
      eliteSpecialization: () => "Mirage",
      isSkillAvailable: () => true,
    },
  };
  const guardian = {
    profession: guardianProfession,
    build: createGuardianBuildDefaults(),
    skills: guardianProfession.catalog.skills,
    adapter: {
      eliteSpecialization: () => "Firebrand",
      isSkillAvailable: () => true,
    },
  };
  assert.deepEqual(
    paletteActionSkills(mesmer).map(skill => skill.name),
    ["Dodge / Mirage Cloak", "Swap Weapons"],
  );
  assert.deepEqual(
    paletteActionSkills(guardian).map(skill => skill.name),
    ["Swap Weapons"],
  );

  const html = weaponPaletteSectionHtml(["<div>W1</div>", "<div>W2</div>"], "<div>Act</div>");
  assert.match(html, /data-role="weapon-palette-section"/);
  assert.equal(html.indexOf("weapon-set-stack") < html.indexOf("Act"), true);
});
