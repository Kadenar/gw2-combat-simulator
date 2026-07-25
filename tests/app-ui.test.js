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
import {
  getProfessionAppAdapter,
  professionOptions,
} from "../js/app/composition.js";
import {
  professionRoute,
} from "../js/app/profession-selector.js";
import {
  autoattackChainSkillAvailable,
  paletteActionSkills,
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
  const professionTerms = [
    "Mesmer",
    "Mirage",
    "Continuum",
    "Malicious Sorcery",
    "phantasm",
    "clone",
  ];

  for (const source of sources) {
    for (const term of professionTerms) {
      assert.equal(source.includes(term), false, term);
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
    (await getProfessionAppAdapter("guardian"))?.id,
    "guardian",
  );
  assert.match(guardianPage, /data-profession="guardian"/);
  assert.match(guardianPage, /data-active-profession="guardian"/);
});

test("the generic landing page and profession simulators have separate entries", async () => {
  const [landingPage, ...professionPages] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../mesmer.html", import.meta.url), "utf8"),
    readFile(new URL("../elementalist.html", import.meta.url), "utf8"),
    readFile(new URL("../guardian.html", import.meta.url), "utf8"),
    readFile(new URL("../necromancer.html", import.meta.url), "utf8"),
  ]);
  const [mesmerPage] = professionPages;

  assert.match(landingPage, /<body class="landing-page">/);
  assert.match(landingPage, /href="mesmer\.html"/);
  assert.match(landingPage, /href="elementalist\.html"/);
  assert.match(landingPage, /href="guardian\.html"/);
  assert.match(landingPage, /href="necromancer\.html"/);
  assert.doesNotMatch(landingPage, /js\/app\/app\.js/);
  assert.doesNotMatch(landingPage, /ARCHITECTURE\.md/);
  for (const professionPage of professionPages) {
    assert.match(
      professionPage,
      /<a class="home-link" href="index\.html">← All professions<\/a>/,
    );
  }
  assert.match(mesmerPage, /data-active-profession="mesmer"/);
  assert.match(mesmerPage, /js\/app\/app\.js/);
  assert.equal(professionRoute("mesmer"), "mesmer.html");
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
