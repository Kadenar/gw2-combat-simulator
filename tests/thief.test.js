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
  createThiefBuildDefaults,
  migrateThiefBuild,
  validateThiefBuild,
} from "../js/professions/thief/build.js";
import {
  thiefCatalog,
  thiefWeaponSkillMatchesSet,
} from "../js/professions/thief/catalog.js";
import {
  DATA_SNAPSHOT,
} from "../js/professions/thief/data/thief-api-metadata.js";
import {
  THIEF_TRAIT_COVERAGE,
} from "../js/professions/thief/data/trait-coverage.js";
import {
  THIEF_TRAIT_IDS as TRAIT,
} from "../js/professions/thief/data/ids.js";
import {
  WIKI_SKILL_RESEARCH,
} from "../js/professions/thief/data/thief-wiki-skill-research.js";
import {
  thiefProfession,
} from "../js/professions/thief/definition.js";

const baseConfig = Object.freeze({
  selectedSkills: [
    "Hide in Shadows",
    "Assassin's Signet",
    "Shadow Flare",
    "Shadow Gust",
    "Thieves Guild",
  ],
  initialInitiative: 12,
  initialShadowForce: 0,
  primaryWeapon: "Dagger",
  secondaryWeapon: "Dagger",
  weaponSet2Primary: "Pistol",
  weaponSet2Secondary: "Pistol",
  deterministicChoices: {
    stolenSkillChoice: "throw-gunk",
    markedTargetChoice: "primary-target",
    artifactDrawSequence: "balanced",
    doubleEdgeOutcomeSequence: "alternate",
  },
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000,
  },
  target: {
    armor: 2597,
    defiant: true,
    conditions: { Vulnerability: 25 },
  },
});

function simulate(specialization, rotation, config = {}) {
  return simulateGw2({
    profession: thiefProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization,
      deterministicChoices: {
        ...baseConfig.deterministicChoices,
        ...(config.deterministicChoices || {}),
      },
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) },
    },
  });
}

test("Thief catalog pins current API identity and terrestrial Wiki mechanics", () => {
  assert.equal(DATA_SNAPSHOT, "2026-07-28");
  assert.equal(thiefCatalog.specializations.length, 9);
  assert.equal(thiefCatalog.traits.length, 108);
  assert.ok(thiefCatalog.skills.length >= 270);
  assert.ok(WIKI_SKILL_RESEARCH.length >= 270);
  assert.ok(WIKI_SKILL_RESEARCH.every(record =>
    record.sourceUrl && record.revisionId && record.revisionTimestamp));
  assert.equal(thiefCatalog.skillsById.has(76550), false);
  assert.equal(thiefCatalog.skillsByName.get("Death Blossom").initiativeCost, 4);
  assert.ok(
    thiefCatalog.skills
      .filter(skill => skill.type === "Weapon")
      .every(skill => Number.isFinite(Number(skill.initiativeCost))),
  );
});

test("Thief defaults migrate deterministic assumptions and validate bars", () => {
  const defaults = createThiefBuildDefaults();
  assert.deepEqual(validateThiefBuild(defaults), {
    valid: true,
    errors: [],
  });
  const migrated = migrateThiefBuild({
    ...defaults,
    assumptions: {
      ...defaults.assumptions,
      artifactDrawSequence: "reverse",
      doubleEdgeOutcomeSequence: "success",
    },
  });
  assert.equal(migrated.assumptions.artifactDrawSequence, "reverse");
  assert.equal(migrated.assumptions.doubleEdgeOutcomeSequence, "success");
  assert.equal(validateThiefBuild({
    ...defaults,
    weapons: ["Sword", "Sword"],
  }).valid, false);
});

test("every legal one-hand combination resolves one exact opening slot 3", () => {
  const expected = new Map([
    ["Dagger/Dagger", "Death Blossom"],
    ["Dagger/Pistol", "Shadow Shot"],
    ["Dagger/", "Twisting Fangs"],
    ["Pistol/Dagger", "Shadow Strike"],
    ["Pistol/Pistol", "Unload"],
    ["Pistol/", "Repeater"],
    ["Sword/Dagger", "Flanking Strike"],
    ["Sword/Pistol", "Flawless Execution"],
    ["Sword/", "Stab"],
    ["Scepter/Dagger", "Twilight Combo"],
    ["Scepter/Pistol", "Measured Shot"],
    ["Scepter/", "Triple Threat"],
    ["Axe/Dagger", "Harrowing Storm"],
    ["Axe/Pistol", "Orchestrated Assault"],
    ["Axe/", "Recall Axes"],
  ]);
  for (const [key, name] of expected) {
    const pair = key.split("/");
    const roots = thiefCatalog.skills.filter(skill =>
      skill.type === "Weapon"
      && skill.slot === "Weapon_3"
      && skill.flipParentId == null
      && thiefWeaponSkillMatchesSet(skill, pair, {
        catalog: thiefCatalog,
      }));
    assert.deepEqual(
      roots.map(skill => skill.name),
      [name],
      key,
    );
  }
  assert.equal(
    thiefCatalog.skills.some(skill =>
      skill.type === "Weapon"
      && skill.slot === "Weapon_3"
      && thiefWeaponSkillMatchesSet(skill, ["Sword", "Sword"], {
        catalog: thiefCatalog,
      })),
    false,
  );
});

test("dual-wield follow-ups require and consume their opening skill", () => {
  const denied = simulate("Core", ["Larcenous Strike"], {
    primaryWeapon: "Sword",
    secondaryWeapon: "Dagger",
  });
  assert.match(denied.warnings[0], /opening dual-wield skill/);
  const result = simulate("Core", [
    "Flanking Strike",
    "Larcenous Strike",
  ], {
    primaryWeapon: "Sword",
    secondaryWeapon: "Dagger",
  });
  assert.equal(result.warnings.length, 0);
  assert.ok(result.totalDamage > 0);
  assert.equal(result.endState.profession.availableFlips[13007], undefined);
});

test("every terrestrial main hand exposes its normal stealth attack", () => {
  const expected = new Map([
    ["Dagger", "Backstab"],
    ["Pistol", "Sneak Attack"],
    ["Sword", "Tactical Strike"],
    ["Shortbow", "Surprise Shot"],
    ["Staff", "Hook Strike"],
    ["Rifle", "Death's Judgment"],
    ["Scepter", "Shadowsquall"],
    ["Axe", "Cunning Salvo"],
    ["Spear", "Ashen Assault"],
  ]);
  for (const [weapon, name] of expected) {
    assert.ok(thiefCatalog.skills.some(skill =>
      skill.name === name
      && skill.stealthAttack
      && !skill.malicious
      && skill.requiredMainHand === weapon), weapon);
  }
});

test("initiative regenerates at exact boundaries and ignores Alacrity", () => {
  const boundary = simulate("Core", ["Death Blossom"], {
    initialInitiative: 3,
  });
  assert.equal(boundary.warnings.length, 0);
  assert.equal(boundary.steps[0].start, 1000);
  assert.equal(boundary.endState.profession.initiative, 0.5);

  for (const alacrity of [false, true]) {
    const result = simulate("Core", [
      { type: "wait", durationMs: 5000 },
    ], {
      initialInitiative: 0,
      boons: { alacrity },
    });
    assert.equal(result.endState.profession.initiative, 5);
  }
});

test("weapon swap preserves shared initiative", () => {
  const result = simulate("Core", [
    "Death Blossom",
    "Swap Weapons",
    "Unload",
  ]);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.activeWeaponSet, 2);
  assert.ok(result.endState.profession.initiative < 9);
  assert.ok(result.events.some(event => event.type === "weapon_set"));
});

test("stealth attacks remove stealth, apply Revealed, and block replacement", () => {
  const result = simulate("Core", [
    "Cloak and Dagger",
    "Backstab",
    "Cloak and Dagger",
    "Backstab",
  ]);
  assert.match(result.warnings.at(-1), /requires stealth/);
  assert.ok(result.endState.profession.revealedUntil > 0);
  assert.equal(result.endState.profession.stealthUntil <= result.duration, true);
});

test("Steal stores and consumes the deterministic raid-golem stolen skill", () => {
  const stored = simulate("Core", ["Steal"]);
  assert.equal(
    thiefCatalog.skillsById.get(stored.endState.profession.storedStolenSkillId)
      .name,
    "Throw Gunk",
  );
  const used = simulate("Core", ["Steal", "Throw Gunk"]);
  assert.equal(used.warnings.length, 0);
  assert.equal(used.endState.profession.storedStolenSkillId, null);
});

test("Daredevil capacity and every dodge replacement resolve explicitly", () => {
  const expectations = new Map([
    ["Lotus Training", "condition"],
    ["Bounding Dodger", "damage"],
    ["Unhindered Combatant", "boon"],
  ]);
  for (const [selectedDodge, eventType] of expectations) {
    const traitId = TRAIT[
      selectedDodge.toUpperCase().replace(/[^A-Z0-9]+/g, "_")
    ];
    const result = simulate("Daredevil", ["Dodge"], {
      selectedDodge,
      selectedTraitIds: [traitId],
    });
    assert.equal(result.endState.profession.maximumEndurance, 150);
    assert.ok(result.events.some(event => event.type === eventType));
  }
});

test("Deadeye Mark grants malice once per initiative skill use", () => {
  const result = simulate("Deadeye", [
    "Deadeye's Mark",
    "Death Blossom",
  ]);
  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.profession.markedTargetId, "primary-target");
  assert.equal(result.endState.profession.malice, 1);
  assert.ok(result.resolvedEvents.filter(event =>
    event.skillName === "Death Blossom" && event.type === "damage").length > 1);

  const consumed = simulate("Deadeye", [
    "Deadeye's Mark",
    "Death Blossom",
    "Cloak and Dagger",
    "Malicious Backstab",
  ]);
  assert.equal(consumed.warnings.length, 0);
  assert.equal(consumed.endState.profession.malice, 0);
});

test("Kneel replaces the rifle bar until Free Action or weapon swap", () => {
  const result = simulate("Deadeye", [
    "Kneel",
    "Three Round Burst",
    "Free Action",
    "Double Tap",
  ], {
    primaryWeapon: "Rifle",
    secondaryWeapon: "",
  });
  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.profession.kneeling, false);
  assert.ok(result.totalDamage > 0);
});

test("Specter Siphon, initiative spending, and Shadow Shroud share force", () => {
  const result = simulate("Specter", [
    "Siphon",
    "Enter Shadow Shroud",
    "Haunt Shot",
    "Exit Shadow Shroud",
  ], {
    primaryWeapon: "Scepter",
    secondaryWeapon: "Pistol",
  });
  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.profession.shadowShroudActive, false);
  assert.ok(result.endState.profession.shadowForce > 0);
  assert.equal(
    result.events.filter(event => event.type === "sigil_swap").length,
    2,
  );
});

test("Antiquary artifacts, Reshuffle, Double Edge, and summons are deterministic", () => {
  const artifact = simulate("Antiquary", [
    "Skritt Swipe",
    "Forged Surfer Dash",
  ], {
    primaryWeapon: "Axe",
    secondaryWeapon: "Dagger",
  });
  assert.equal(artifact.warnings.length, 0);
  assert.equal(artifact.endState.profession.artifactUsesRemaining, 0);
  assert.ok(artifact.totalDamage > 0);

  const reshuffled = simulate("Antiquary", [
    "Skritt Swipe",
    "Reshuffle",
  ], {
    primaryWeapon: "Axe",
    secondaryWeapon: "Dagger",
  });
  assert.deepEqual(
    reshuffled.endState.profession.artifactSlots.map(slot => slot.skillId),
    [76582, 76702],
  );

  const doubleEdge = simulate("Antiquary", [
    "Stone Summit Cannon",
    { type: "wait", durationMs: 16000 },
    "Stone Summit Cannon",
  ], {
    primaryWeapon: "Axe",
    secondaryWeapon: "Dagger",
  });
  assert.ok(doubleEdge.endState.profession.backfireState[76725]);

  const guild = simulate("Antiquary", [
    "Thieves Guild",
    { type: "wait", durationMs: 2100 },
  ], {
    primaryWeapon: "Axe",
    secondaryWeapon: "Dagger",
  });
  assert.ok(guild.resolvedEvents.some(event =>
    event.actorType === "summon"
    && event.skillName === "Thieves Guild — Skritt"));
});

test("trait-coverage manifest covers all Thief traits", () => {
  assert.equal(THIEF_TRAIT_COVERAGE.length, thiefCatalog.traits.length);
  assert.ok(THIEF_TRAIT_COVERAGE.every(entry => entry.effects.length > 0));
});

test("Thief is a loadable native application", async () => {
  assert.equal(professionRoute("thief"), "thief.html");
  assert.equal((await loadProfession("thief")).id, "thief");
  const adapter = await loadProfessionAppAdapter("thief");
  assert.equal(adapter.profession.id, "thief");
  assert.equal(adapter.weaponSkillMatchesSet, thiefWeaponSkillMatchesSet);
  assert.ok(adapter.assumptionControls.length >= 7);
  const html = await readFile(new URL("../thief.html", import.meta.url), "utf8");
  assert.match(html, /data-profession="thief"/);
  assert.match(html, /Thief<\/span> Rotation Simulator/);
});
