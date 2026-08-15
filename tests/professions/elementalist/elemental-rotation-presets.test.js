import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadProfessionAppAdapter } from "../../../js/app/profession/registry.js";

const GLYPH = "Glyph of Elementals";
const BARRAGE = "Flame Barrage";
const ALACRITY_RECHARGE_MS = 12_000;
const ELEMENTAL_LIFETIME_MS = 120_000;
const MAXIMUM_AVAILABILITY_DELAY_MS = 1_000;

const root = new URL("../../../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

function entryName(entry) {
  return typeof entry === "string" ? entry : entry?.name;
}

test("every Glyph preset precasts its native Fire Elemental and commands it off cooldown", async () => {
  const [manifest, adapter] = await Promise.all([
    readJson("Builds/elementalist/manifest.json"),
    loadProfessionAppAdapter("elementalist"),
  ]);
  let glyphPresetCount = 0;

  for (const section of manifest) {
    for (const preset of section.presets) {
      const [savedBuild, savedRotation] = await Promise.all([
        readJson(preset.build),
        readJson(preset.rotation),
      ]);
      if (!Object.values(savedBuild.selectedSkills || {}).includes(GLYPH)) {
        continue;
      }
      glyphPresetCount += 1;
      const label = `${section.section}: ${preset.label}`;
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
      const glyph = result.steps.find((step) => step.skill === GLYPH);
      const combatStart = result.steps.find(
        (step) => step.skill === "Combat Start",
      );
      const combatAt =
        combatStart?.start ?? Math.round(result.dpsStartTime * 1000);
      assert.equal(
        entryName(savedRotation.rotation[0]),
        GLYPH,
        `${label}: first rotation command`,
      );
      assert.notEqual(glyph, undefined, `${label}: Glyph cast`);
      assert.equal(glyph.ri, 0, `${label}: Glyph simulation step`);
      assert.ok(
        glyph.end <= combatAt,
        `${label}: Glyph ends at ${glyph.end}ms after combat starts at ${combatAt}ms`,
      );
      const summonAt = glyph.end;
      const firstReadyAt = Math.max(summonAt, combatStart?.start ?? 0);
      const rotationEnd = Math.max(
        ...result.steps
          .filter((step) => step.skill !== BARRAGE)
          .map((step) => step.end),
      );
      const expectedCastTimes = [];
      for (
        let at = firstReadyAt;
        at <= rotationEnd && at < summonAt + ELEMENTAL_LIFETIME_MS;
        at += ALACRITY_RECHARGE_MS
      ) {
        expectedCastTimes.push(at);
      }
      const barrages = result.steps.filter((step) => step.skill === BARRAGE);

      assert.equal(
        barrages.length,
        expectedCastTimes.length,
        `${label}: Flame Barrage count`,
      );
      assert.equal(
        barrages.every((step) => !step.invalid),
        true,
        `${label}: Flame Barrage validity`,
      );
      for (let index = 0; index < barrages.length; index += 1) {
        const delay = barrages[index].start - expectedCastTimes[index];
        assert.ok(
          delay >= 0 && delay <= MAXIMUM_AVAILABILITY_DELAY_MS,
          `${label}: Flame Barrage ${index + 1} availability delay ${delay}ms`,
        );
      }
      assert.equal(
        result.events.some(
          (event) => event.type === "damage" && event.skillName === GLYPH,
        ),
        false,
        `${label}: fixed Glyph damage packets`,
      );
      assert.equal(
        result.events.some(
          (event) =>
            event.type === "action" &&
            event.actorType === "summon" &&
            ["Fireball", "Flame Burst"].includes(event.skillName),
        ),
        true,
        `${label}: autonomous Fire Elemental action`,
      );
    }
  }

  assert.equal(glyphPresetCount, 29);
});
