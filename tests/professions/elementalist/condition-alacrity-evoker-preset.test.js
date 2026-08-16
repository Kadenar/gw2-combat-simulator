import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadProfessionAppAdapter } from "../../../js/app/profession/registry.js";

const repoUrl = (path) => new URL(`../../../${path}`, import.meta.url);
const entryName = (entry) => (typeof entry === "string" ? entry : entry?.name);

test("Condition Alacrity Evoker preserves its Elemental Balance build and EVTC rotation", async () => {
  const [savedBuild, savedRotation, adapter] = await Promise.all([
    readFile(
      repoUrl(
        "Builds/elementalist/b-condi-alac-evoker-pistol-warhorn-elemental-balance.json",
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      repoUrl(
        "Rotations/elementalist/r-condi-alac-evoker-pistol-warhorn-elemental-balance.json",
      ),
      "utf8",
    ).then(JSON.parse),
    loadProfessionAppAdapter("elementalist"),
  ]);

  assert.deepEqual(
    new Set(Object.values(savedBuild.gear)),
    new Set(["Viper's"]),
  );
  assert.deepEqual(savedBuild.weapons, ["Pistol", "Warhorn"]);
  assert.deepEqual(savedBuild.weaponSigils, [
    ["Bursting", "Agony"],
    ["Bursting", "Agony"],
  ]);
  assert.equal(savedBuild.food, "Cilantro and Cured Meat Flatbread");
  assert.equal(savedBuild.utility, "Toxic Tuning Crystal");
  assert.equal(savedBuild.relic, "Fractal");
  assert.deepEqual(savedBuild.infusions[0], {
    stat: "Condition Damage",
    count: 18,
  });
  assert.deepEqual(savedBuild.specializations, [
    { name: "Fire", traits: "1-1-2" },
    { name: "Earth", traits: "2-1-2" },
    { name: "Evoker", traits: "1-2-2" },
  ]);
  assert.deepEqual(savedBuild.selectedSkills, {
    Heal: "Rejuvenate",
    Utility1: "Signet of Earth",
    Utility2: "Toad's Fortitude",
    Utility3: "Signet of Fire",
    Elite: "Glyph of Elementals",
  });
  assert.deepEqual(savedBuild.pistolBullets, {
    Fire: true,
    Water: true,
    Air: true,
    Earth: true,
  });

  const names = savedRotation.rotation.map(entryName);
  assert.equal(savedRotation.metadata.source, "20260605-150808.zevtc");
  assert.equal(savedRotation.metadata.reconstructedActionCount, 272);
  assert.equal(savedRotation.rotation.length, 290);
  assert.deepEqual(names.slice(0, 4), [
    "Wildfire",
    "Flame Barrage",
    "Calcify",
    "__combat_start",
  ]);
  assert.equal(names.filter((name) => name === "Calcify").length, 21);
  assert.equal(names.filter((name) => name === "Flame Barrage").length, 8);

  const build = adapter.toApplicationBuild({
    ...savedBuild,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    adapter,
    profession: adapter.profession,
    skillByName: adapter.profession.catalog.skillsByName,
    skillById: adapter.profession.catalog.skillsById,
    attributeWeaponSet: 1,
  };
  adapter.recalculate(app);
  const result = adapter.runSimulation(app);

  assert.deepEqual(result.warnings, []);
  assert.equal(Math.round(result.dps), 40540);
});
