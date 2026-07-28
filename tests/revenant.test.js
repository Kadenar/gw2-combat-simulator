import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  loadProfession,
  loadProfessionAppAdapter,
  professionRoute,
} from "../js/app/profession-registry.js";
import { simulateGw2 } from "../js/platform/gw2/simulate.js";
import {
  createRevenantBuildDefaults,
  migrateRevenantBuild,
  validateRevenantBuild,
} from "../js/professions/revenant/build.js";
import { revenantCatalog } from "../js/professions/revenant/catalog.js";
import {
  DATA_SNAPSHOT,
} from "../js/professions/revenant/data/revenant-api-metadata.js";
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_TRAIT_IDS as TRAIT,
} from "../js/professions/revenant/data/ids.js";
import {
  REVENANT_TRAIT_COVERAGE,
} from "../js/professions/revenant/data/trait-coverage.js";
import {
  WIKI_SKILL_RESEARCH,
} from "../js/professions/revenant/data/revenant-wiki-skill-research.js";
import {
  revenantProfession,
} from "../js/professions/revenant/definition.js";
import { REVENANT_LEGENDS } from "../js/professions/revenant/legend-loadout.js";

const baseConfig = Object.freeze({
  selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
  startingLegend: LEGEND.ASSASSIN,
  initialEnergy: 50,
  selectedDodge: "Death Drop",
  allianceSide: "luxon",
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000,
  },
  target: { armor: 2597, conditions: { Vulnerability: 25 } },
});

function simulate(specialization, rotation, config = {}) {
  return simulateGw2({
    profession: revenantProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization,
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) },
    },
  });
}

test("Revenant catalog pins current API and Wiki mechanics", () => {
  assert.equal(DATA_SNAPSHOT, "2026-07-28");
  assert.equal(revenantCatalog.specializations.length, 9);
  assert.equal(revenantCatalog.traits.length, 108);
  assert.ok(revenantCatalog.skills.length >= 210);
  assert.equal(REVENANT_LEGENDS.length, 8);
  assert.ok(REVENANT_LEGENDS.every(legend => legend.skillIds.length === 5));
  assert.ok(WIKI_SKILL_RESEARCH.length >= 180);
  const jadeWinds = revenantCatalog.skillsById.get(28406);
  assert.equal(jadeWinds.energyCost, 35);
  assert.equal(jadeWinds.effects[0].coefficient, 3);
});

test("legend loadout validation requires two legal distinct legends", () => {
  const defaults = createRevenantBuildDefaults();
  assert.deepEqual(validateRevenantBuild(defaults), {
    valid: true,
    errors: [],
  });
  assert.equal(validateRevenantBuild({
    ...defaults,
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ASSASSIN],
  }).valid, false);
  assert.equal(validateRevenantBuild({
    ...defaults,
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.RENEGADE],
    startingLegend: LEGEND.RENEGADE,
  }).valid, false);
  const migrated = migrateRevenantBuild({
    ...defaults,
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DRAGON],
    startingLegend: "missing",
  });
  assert.equal(migrated.startingLegend, LEGEND.ASSASSIN);
});

test("energy regenerates continuously and every skill pays its explicit cost", () => {
  const result = simulate("Core", [
    "Phase Traversal",
    { type: "wait", durationMs: 1000 },
  ]);
  // 50 - 30 + 2.5 during the half-second cast + 5 during the wait.
  assert.equal(result.endState.profession.energy, 27.5);
  const denied = simulate("Core", ["Jade Winds"], { initialEnergy: 34 });
  assert.match(denied.warnings[0], /requires 35 energy/);
});

test("legend swap replaces the fixed bar, resets energy, and triggers sigils", () => {
  const result = simulate("Core", [
    "Phase Traversal",
    "Swap Legends",
    "Banish Enchantment",
  ]);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.profession.activeLegendId, LEGEND.DEMON);
  assert.ok(result.events.some(event => event.type === "sigil_swap"));
  assert.ok(result.endState.profession.legendSwapReadyAt >= 10);
  assert.ok(result.totalDamage > 0);

  const unavailable = simulate("Core", [
    "Swap Legends",
    "Swap Legends",
  ]);
  assert.equal(unavailable.warnings.length, 0);
  assert.ok(unavailable.duration >= 10);
  assert.equal(
    unavailable.casts.find(cast => cast.name === "Swap Legends")?.count,
    2,
  );
});

test("Charged Mists uses the low-energy legend reset", () => {
  const normal = simulate("Core", ["Swap Legends"], { initialEnergy: 5 });
  assert.equal(normal.endState.profession.energy, 50);
  const charged = simulate("Core", ["Swap Legends"], {
    initialEnergy: 5,
    selectedTraitIds: [TRAIT.CHARGED_MISTS],
  });
  assert.equal(charged.endState.profession.energy, 75);
});

test("upkeep drains net energy and cancels exactly on starvation", () => {
  const draining = simulate("Core", [
    "Impossible Odds",
    { type: "wait", durationMs: 20000 },
  ]);
  assert.equal(draining.endState.profession.energy, 25);
  assert.equal(draining.endState.profession.activeUpkeeps.length, 1);

  const starved = simulate("Core", [
    "Impossible Odds",
    { type: "wait", durationMs: 50000 },
  ]);
  assert.equal(starved.endState.profession.activeUpkeeps.length, 0);
  assert.equal(starved.endState.profession.energy, 25);
});

test("Herald facets expose and consume their active flips", () => {
  const result = simulate("Herald", [
    "Facet of Strength",
    "Burst of Strength",
  ], {
    selectedLegends: [LEGEND.DRAGON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DRAGON,
    initialEnergy: 100,
  });
  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.profession.activeUpkeeps.length, 0);
  assert.ok(result.totalDamage > 0);
});

test("Renegade warband packets retain summon ownership", () => {
  const result = simulate("Renegade", ["Icerazor's Ire"], {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    initialEnergy: 100,
  });
  assert.ok(result.totalDamage > 0);
  assert.ok(result.resolvedEvents
    .filter(event => event.skillName === "Icerazor's Ire")
    .every(event => event.actorType === "summon"));
});

test("Alliance Tactics switches the legal Vindicator skill side", () => {
  const result = simulate("Vindicator", [
    "Nomad's Advance",
    "Alliance Tactics",
    "Tree Song",
  ], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ALLIANCE,
    initialEnergy: 100,
  });
  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.profession.allianceSide, "kurzick");
});

test("Conduit affinity scales Release Potential and Cosmic Wisdom state", () => {
  const result = simulate("Conduit", [
    "Phase Traversal",
    "Release Potential: Assassin",
    "Cosmic Wisdom",
  ], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100,
  });
  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.profession.affinity, 0);
  assert.equal(result.endState.profession.conduitForm, "Assassin");
  assert.ok(result.endState.profession.cosmicWisdomUntil > 0);
});

test("Alacrity changes cooldowns but never passive energy regeneration", () => {
  const rotation = [{ type: "wait", durationMs: 5000 }];
  const without = simulate("Core", rotation, {
    initialEnergy: 0,
    boons: { alacrity: false },
  });
  const withAlacrity = simulate("Core", rotation, {
    initialEnergy: 0,
    boons: { alacrity: true },
  });
  assert.equal(without.endState.profession.energy, 25);
  assert.equal(withAlacrity.endState.profession.energy, 25);
});

test("trait-coverage manifest covers all Revenant traits", () => {
  assert.equal(REVENANT_TRAIT_COVERAGE.length, revenantCatalog.traits.length);
  assert.ok(REVENANT_TRAIT_COVERAGE.every(entry => entry.effects.length > 0));
});

test("Revenant is a loadable native fixed-bar application", async () => {
  assert.equal(professionRoute("revenant"), "revenant.html");
  assert.equal((await loadProfession("revenant")).id, "revenant");
  const adapter = await loadProfessionAppAdapter("revenant");
  assert.equal(adapter.profession.id, "revenant");
  assert.equal(adapter.slotLoadout.id, "revenant-legends");
  const html = await readFile(new URL("../revenant.html", import.meta.url), "utf8");
  assert.match(html, /data-profession="revenant"/);
});
