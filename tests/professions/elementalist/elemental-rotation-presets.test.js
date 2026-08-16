import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadProfessionAppAdapter } from "../../../js/app/profession/registry.js";

const GLYPH = "Glyph of Elementals";
const BARRAGE = "Flame Barrage";
const ALACRITY_RECHARGE_MS = 12_000;
const ELEMENTAL_LIFETIME_MS = 120_000;
const MAXIMUM_AVAILABILITY_DELAY_MS = 1_000;
const BARRAGE_TIMING_EXCEPTIONS = new Map([
  ["Catalyst: Condi Quickness (P/Wh)", 1_500],
  ["Evoker: Condi Alacrity Elemental Balance (P/Wh)", 3_000],
]);
const BARRAGE_COUNT_EXCEPTIONS = new Map([
  ["Evoker: Condi Alacrity Elemental Balance (P/Wh)", 8],
]);

const root = new URL("../../../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

function entryName(entry) {
  return typeof entry === "string" ? entry : entry?.name;
}

test("every Glyph preset automatically summons its Fire Elemental and commands it off cooldown", async () => {
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
      const combatStart = result.steps.find(
        (step) => step.skill === "Combat Start",
      );
      const firstPlayerAction = result.events.find(
        (event) => event.type === "action" && event.actorType === "player",
      );
      assert.equal(
        savedRotation.rotation.some((entry) => entryName(entry) === GLYPH),
        false,
        `${label}: explicit Glyph command`,
      );
      assert.equal(
        result.steps.some((step) => step.skill === GLYPH),
        false,
        `${label}: user-cast Glyph step`,
      );
      assert.notEqual(
        firstPlayerAction,
        undefined,
        `${label}: first player action`,
      );
      assert.ok(
        result.endState.profession.summonedElemental.summonGeneration > 0,
        `${label}: automatic Fire Elemental summon`,
      );
      const summonAt = Math.round(firstPlayerAction.at * 1000);
      const barrages = result.steps.filter((step) => step.skill === BARRAGE);
      const firstReadyAt = Math.min(
        barrages[0]?.start ?? Number.POSITIVE_INFINITY,
        Math.max(summonAt, combatStart?.start ?? summonAt),
      );
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
      const invalidBarrages = barrages.filter((step) => step.invalid);

      assert.equal(
        barrages.length,
        BARRAGE_COUNT_EXCEPTIONS.get(label) ?? expectedCastTimes.length,
        `${label}: Flame Barrage count`,
      );
      assert.equal(
        invalidBarrages.length,
        0,
        `${label}: invalid Flame Barrage count`,
      );
      for (let index = 0; index < barrages.length; index += 1) {
        if (barrages[index].invalid) continue;
        const delay = barrages[index].start - expectedCastTimes[index];
        const maximumDelay =
          BARRAGE_TIMING_EXCEPTIONS.get(label) ?? MAXIMUM_AVAILABILITY_DELAY_MS;
        assert.ok(
          delay >= 0 && delay <= maximumDelay,
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

  assert.equal(glyphPresetCount, 30);
});
