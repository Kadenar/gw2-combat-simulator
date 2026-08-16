import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  loadProfession,
  loadProfessionAppAdapter,
  professionRoute,
} from "../../../js/app/profession/registry.js";
import { weaponSetLabelVisible } from "../../../js/app/build/skills-panel.js";
import { simulationEventLogRows } from "../../../js/app/rotation/event-log.js";
import { renderPalette } from "../../../js/app/rotation/palette-view.js";
import { skillBreakdownRows } from "../../../js/app/rotation/result-model.js";
import { simulateGw2 } from "../../../js/platform/gw2/simulate.js";
import {
  createEngineerBuildDefaults,
  migrateEngineerBuild,
  toApplicationBuild,
  validateEngineerBuild,
} from "../../../js/professions/engineer/build.js";
import { engineerCatalog } from "../../../js/professions/engineer/catalog.js";
import { DATA_SNAPSHOT } from "../../../js/professions/engineer/data/engineer-api-metadata.js";
import { ENGINEER_SUPPLEMENTAL_SKILLS } from "../../../js/professions/engineer/data/engineer-supplemental-skills.js";
import { ENGINEER_TRAIT_COVERAGE } from "../../../js/professions/engineer/data/trait-coverage.js";
import {
  ENGINEER_SKILL_IDS as ID,
  ENGINEER_TRAIT_IDS as TRAIT,
} from "../../../js/professions/engineer/data/ids.js";
import { ENGINEER_SKILL_MECHANICS } from "../../../js/professions/engineer/mechanics/skill-mechanics.js";
import { engineerProfession } from "../../../js/professions/engineer/definition.js";
import { engineerMechAttributes } from "../../../js/professions/engineer/specializations/mechanist/state.js";
import { engineerWeaponSkillMatchesSet } from "../../../js/professions/engineer/core/ui.js";
import {
  recalculate,
  runSimulation,
} from "../../../js/professions/engineer/app/app-definition.js";

const baseConfig = Object.freeze({
  selectedSkills: [
    "Healing Turret",
    "Grenade Kit",
    "Throw Mine",
    "Rifle Turret",
    "Supply Crate",
  ],
  selectedMorphSkillIds: [77103, 77203, 76954],
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
    conditions: { Vulnerability: 25 },
  },
});

function simulate(
  specialization,
  rotation,
  config = {},
  observationPolicy = undefined,
) {
  return simulateGw2({
    profession: engineerProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization,
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) },
    },
    observationPolicy,
  });
}

const observationTail = (durationMs) => ({ kind: "tail", durationMs });

function mechanic(name) {
  return engineerCatalog.skillsByName.get(name);
}

test("Engineer catalog pins API identity and explicit skill mechanics", () => {
  assert.equal(DATA_SNAPSHOT, "2026-07-28");
  assert.equal(engineerCatalog.specializations.length, 9);
  assert.equal(engineerCatalog.traits.length, 108);
  assert.ok(engineerCatalog.skills.length >= 330);
  assert.equal(engineerCatalog.skillsById.get(5842).name, "Bomb");
  assert.equal(
    engineerCatalog.skillsByName.get("Bomb").effects[0].coefficient,
    1.2,
  );
  assert.match(
    engineerCatalog.skillsById.get(5806).icon,
    /Special:Redirect\/file\/Poison_Grenade\.png$/,
  );
  assert.equal(
    engineerCatalog.skillsByName.get("Shrapnel Grenade").icon,
    "https://render.guildwars2.com/file/" +
      "467E6BF83D152F95BC5D0B3573F4D2D71F5A4BFA/102830.png",
  );
  assert.equal(
    engineerCatalog.skillsByName.get("Orbital Command Strike").icon,
    "https://render.guildwars2.com/file/" +
      "99CFD7B1B200DCC508172BC8A3C2EE970C06493E/1012854.png",
  );
  assert.equal(
    engineerCatalog.skillsByName.get("Flame Jet").icon,
    "https://render.guildwars2.com/file/" +
      "2CDBD11894D945140B3480BFEC960800086352E5/103269.png",
  );
  assert.equal(
    engineerCatalog.skillsByName.get("Bandage Blast").icon,
    "https://render.guildwars2.com/file/" +
      "F473E7A5D7D301A3B813443812C73338C073ABB2/102898.png",
  );
  assert.equal(
    engineerCatalog.skillsByName.get("Stow Flamethrower").icon,
    "https://render.guildwars2.com/file/" +
      "7342BF326738A4C5132F42CE0915D3A2184E52FB/60975.png",
  );
  assert.equal(
    engineerCatalog.skillsByName.get("Jade Energy Shot").icon,
    "https://render.guildwars2.com/file/" +
      "73600241FA662501C5D617719A7B4792F30B2846/2503622.png",
  );
  assert.equal(
    engineerCatalog.skillsById.get(ID.ROCKET_PUNCH_MECH).icon,
    "https://render.guildwars2.com/file/" +
      "02DA2C9899B63DE522020824C67D05951F40CA4A/2503679.png",
  );
  assert.ok(
    engineerCatalog.skills
      .filter(
        (skill) =>
          skill.specialization === "Amalgam" &&
          skill.categories?.includes("Morph"),
      )
      .every((skill) =>
        skill.icon.startsWith("https://render.guildwars2.com/"),
      ),
  );
  assert.equal(engineerCatalog.skillsById.has(6175), false);
  assert.equal(engineerCatalog.skillsById.has(58090), false);
  const poisonGrenade = ENGINEER_SKILL_MECHANICS[5806];
  assert.equal(poisonGrenade.castTimeMs, undefined);
  assert.equal(poisonGrenade.quicknessCastTimeMs, 680);
  assert.equal(engineerCatalog.skillsById.get(5806).castTimeMs, 1020);
  assert.equal(
    poisonGrenade.effects[0].ticks.reduce(
      (total, packet) => total + packet.coefficient,
      0,
    ),
    2.25,
  );
  assert.deepEqual(
    poisonGrenade.effects[1].ticks.map((packet) => [
      packet.atMs,
      packet.condition,
      packet.stacks,
    ]),
    [
      [400, "Poisoned", 3],
      [440, "Poisoned", 3],
      [440, "Poisoned", 3],
    ],
  );
  assert.ok(
    ENGINEER_SUPPLEMENTAL_SKILLS.every(
      (skill) =>
        !Object.hasOwn(skill, "effects") &&
        !Object.hasOwn(skill, "cooldown") &&
        !Object.hasOwn(skill, "recharge"),
    ),
  );
});

test("Engineer sword impacts use measured cast-start packet timing", () => {
  const expectedOffsets = new Map([
    [ID.SUN_EDGE, 350],
    [ID.SUN_EDGE_ID_70514, 350],
    [ID.SUN_RIPPER, 450],
    [ID.SUN_RIPPER_ID_69906, 450],
    [ID.GLEAM_SABER, 600],
    [ID.GLEAM_SABER_ID_70771, 600],
  ]);

  for (const [skillId, atMs] of expectedOffsets) {
    const skill = engineerCatalog.skillsById.get(skillId);
    const strike = skill.effects.find((effect) => effect.type === "strike");
    assert.deepEqual(
      {
        atMs: strike.atMs,
        timingAnchor: strike.timingAnchor,
        timingScale: strike.timingScale,
      },
      { atMs, timingAnchor: "castStart", timingScale: "fixed" },
    );
  }
});

test("Holosmith palette exposes tool-belt skills, forge, and replacement bars", () => {
  const build = createEngineerBuildDefaults();
  const groups = engineerProfession.ui.paletteGroups({
    build,
    specialization: "Holosmith",
    professionState: { photonForgeActive: false },
  });
  const profession = groups.find((group) => group.id === "engineer-profession");
  const grenade = groups.find((group) => group.label === "Gren");
  const forge = groups.find((group) => group.id === "engineer-forge");
  const names = (group) =>
    group.skillIds.map((id) => engineerCatalog.skillsById.get(id).name);

  assert.deepEqual(names(profession), [
    "Regenerating Mist",
    "Grenade Barrage",
    "Mine Field",
    "Surprise Shot (engineer skill)",
    "Engage Photon Forge",
  ]);
  assert.deepEqual(names(grenade), [
    "Grenade",
    "Shrapnel Grenade",
    "Flash Grenade",
    "Freeze Grenade",
    "Poison Grenade",
    "Stow Grenade Kit",
  ]);
  assert.equal(grenade.stackId, "engineer-kits");
  assert.equal(grenade.placement, "weapon-set-1");
  assert.match(profession.className, /compact-resource-palette/);
  assert.equal(profession.stackId, "holosmith-profession");
  assert.equal(forge.stackId, "holosmith-profession");
  assert.equal(forge.skillIds.length, 7);
  assert.ok(names(forge).every((name) => !name.endsWith("—Storm")));
});

test("Engineer renders Endurance only for Tools and uses a standard bar", () => {
  const build = createEngineerBuildDefaults();
  const state = engineerProfession
    .resolveRuntime({
      specialization: "Core",
    })
    .createProfessionState({ specialization: "Core" });
  const core = engineerProfession.ui.resourceViews({
    specialization: "Core",
    build,
    professionState: state,
  });
  assert.equal(
    core.some((view) => view.id === "endurance"),
    false,
  );

  const tools = engineerProfession.ui.resourceViews({
    specialization: "Core",
    build: {
      ...build,
      specializations: [
        { name: "Tools", traits: "1-2-3" },
        { name: "Explosives", traits: "3-2-3" },
        { name: "Firearms", traits: "1-2-3" },
      ],
    },
    professionState: state,
  });
  const endurance = tools.find((view) => view.id === "endurance");
  assert.equal(endurance.displayMode, "bar");
  assert.equal(Object.hasOwn(endurance, "pipStyle"), false);

  const holosmith = engineerProfession.ui.resourceViews({
    specialization: "Holosmith",
    build,
    professionState: engineerProfession
      .resolveRuntime({
        specialization: "Holosmith",
      })
      .createProfessionState({ specialization: "Holosmith" }),
  });
  assert.deepEqual(
    holosmith.map((view) => view.id),
    ["heat"],
  );
  assert.equal(
    holosmith[0].pipStyle,
    "compact-profession-resource-holosmith-heat",
  );
});

test("Engineer kits render beneath weapons while Holosmith mechanics stay grouped", async () => {
  const adapter = await loadProfessionAppAdapter("engineer");
  const canonicalBuild = createEngineerBuildDefaults();
  canonicalBuild.selectedSkills.Utility2 = "Flamethrower";
  canonicalBuild.selectedSkills.Utility3 = "Bomb Kit";
  const build = adapter.toApplicationBuild(canonicalBuild);
  const app = {
    build,
    adapter,
    profession: engineerProfession,
    skills: engineerCatalog.skills,
    skillById: engineerCatalog.skillsById,
    skillByName: engineerCatalog.skillsByName,
    weaponData: adapter.weaponData,
    results: null,
  };
  const palette = { innerHTML: "", querySelectorAll: () => [] };
  const previousDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => (id === "rotation-palette" ? palette : null),
  };
  try {
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }

  const html = palette.innerHTML;
  const holosmith = html.indexOf('data-palette-stack="holosmith-profession"');
  const profession = html.indexOf("engineer-profession-skills");
  const heat = html.indexOf('data-resource-id="heat"');
  const forge = html.indexOf("engineer-forge-skills");
  const weapons = html.indexOf('data-role="weapon-set-stack"');
  const grenade = html.indexOf('data-skill="Grenade"');
  const flamethrower = html.indexOf('data-skill="Flame Jet"');
  const bomb = html.indexOf('data-skill="Bomb"');
  const actions = html.indexOf("action-palette-group");
  assert.ok(holosmith >= 0);
  assert.ok(profession > holosmith);
  assert.ok(forge > profession);
  assert.ok(heat > forge);
  assert.ok(weapons > heat);
  assert.ok(grenade > weapons);
  assert.ok(flamethrower > grenade);
  assert.ok(bomb > flamethrower);
  assert.ok(actions > bomb);
  assert.match(html, /compact-profession-resource-holosmith-heat/);
});

test("Engineer event log exposes Heat only for Holosmith heat transitions", () => {
  const event = {
    type: "engineer.state",
    reason: "heat",
    state: { heat: 25 },
  };
  const eventLogRow = (specialization, value) => {
    const config = { specialization };
    const runtime = engineerProfession.resolveRuntime(config);
    return runtime.ui.eventLogRow(
      {
        config,
        state: { profession: runtime.createProfessionState(config) },
      },
      value,
    );
  };
  assert.equal(eventLogRow("Amalgam", event), null);
  assert.equal(
    eventLogRow("Holosmith", {
      ...event,
      reason: "equip-kit",
    }),
    null,
  );
  assert.equal(eventLogRow("Holosmith", event).description, "heat - Heat 25.0");
});

test("Engineer defaults migrate and validate morph branch choices", () => {
  const defaults = createEngineerBuildDefaults();
  assert.equal(defaults.assumptions.inDamagingField, false);
  assert.deepEqual(
    engineerProfession.ui.assumptionControls.find(
      (control) => control.key === "inDamagingField",
    ),
    {
      key: "inDamagingField",
      label: "In damaging field",
      type: "boolean",
      defaultValue: false,
      specializations: ["Amalgam"],
    },
  );
  assert.deepEqual(validateEngineerBuild(defaults), {
    valid: true,
    errors: [],
  });
  const migrated = migrateEngineerBuild({
    ...defaults,
    selectedMorphSkillIds: [77103, 77203, 76954],
  });
  assert.deepEqual(migrated.selectedMorphSkillIds, [77103, 77203, 76954]);
  assert.equal(
    validateEngineerBuild({
      ...defaults,
      selectedMorphSkillIds: [77103, 77203, 77285],
    }).valid,
    false,
  );
  assert.equal(
    validateEngineerBuild({
      ...defaults,
      selectedMorphSkillIds: [77103, 76866, 76954],
    }).valid,
    false,
  );
  assert.deepEqual(
    migrateEngineerBuild({
      ...defaults,
      selectedMorphSkillIds: [77103, 76866, 76954],
    }).selectedMorphSkillIds,
    [77103, 77203, 76954],
  );
});

test("power Mechanist benchmark builds are valid default selections", async () => {
  const [sword, rifle, swordRotation, rifleRotation, manifest] =
    await Promise.all([
      readFile(
        new URL(
          "../../../Builds/engineer/b-power-mechanist-sword-pistol.json",
          import.meta.url,
        ),
        "utf8",
      ).then(JSON.parse),
      readFile(
        new URL(
          "../../../Builds/engineer/b-power-mechanist-rifle.json",
          import.meta.url,
        ),
        "utf8",
      ).then(JSON.parse),
      readFile(
        new URL(
          "../../../Rotations/engineer/r-power-mechanist-sword-pistol-bench.json",
          import.meta.url,
        ),
        "utf8",
      ).then(JSON.parse),
      readFile(
        new URL(
          "../../../Rotations/engineer/r-power-mechanist-rifle-bench.json",
          import.meta.url,
        ),
        "utf8",
      ).then(JSON.parse),
      readFile(
        new URL("../../../Builds/engineer/manifest.json", import.meta.url),
        "utf8",
      ).then(JSON.parse),
    ]);

  for (const build of [sword, rifle]) {
    assert.deepEqual(validateEngineerBuild(build), {
      valid: true,
      errors: [],
    });
    assert.ok(
      Object.values(build.gear).every((stat) => stat === "Berserker's"),
    );
    assert.equal(build.rune, "Dragonhunter");
    assert.equal(build.food, "Cilantro Lime Sous-Vide Steak");
    assert.equal(build.utility, "Superior Sharpening Stone");
    assert.deepEqual(
      build.specializations.map((selection) => [
        selection.name,
        selection.traits,
      ]),
      [
        ["Explosives", "3-1-3"],
        ["Firearms", "3-3-1"],
        ["Mechanist", "3-3-1"],
      ],
    );
  }
  assert.deepEqual(sword.weapons, ["Sword", "Pistol"]);
  assert.deepEqual(sword.weaponSigils[0], ["Force", "Impact"]);
  assert.equal(sword.relic, "Bloodstone");
  assert.equal(sword.selectedSkills.Utility1, "Bomb Kit");
  assert.deepEqual(rifle.weapons, ["Rifle", ""]);
  assert.deepEqual(rifle.weaponSigils[0], ["Force", "Air"]);
  assert.equal(rifle.relic, "Thief");
  assert.equal(rifle.selectedSkills.Utility1, "Grenade Kit");

  const mechanist = manifest.find((section) => section.section === "Mechanist");
  assert.deepEqual(
    mechanist.presets.map((preset) => [
      preset.label,
      preset.rotation,
      preset.benchmarkDps,
    ]),
    [
      [
        "Power (Sword / Pistol)",
        "Rotations/engineer/r-power-mechanist-sword-pistol-bench.json",
        40896,
      ],
      [
        "Power (Rifle)",
        "Rotations/engineer/r-power-mechanist-rifle-bench.json",
        38513,
      ],
    ],
  );

  for (const [raw, savedRotation] of [
    [sword, swordRotation],
    [rifle, rifleRotation],
  ]) {
    for (const [index, entry] of savedRotation.rotation.entries()) {
      assert.notEqual(typeof entry, "number", `rotation entry ${index}`);
      const name = typeof entry === "string" ? entry : entry.name;
      if (String(name).startsWith("__")) continue;
      const skill =
        entry && typeof entry === "object" && entry.skillId != null
          ? engineerCatalog.skillsById.get(Number(entry.skillId))
          : engineerCatalog.skillsByName.get(String(name));
      assert.ok(skill, `unresolved rotation entry ${index}: ${name}`);
      assert.equal(skill.name, name, `rotation entry ${index}`);
    }
    const build = migrateEngineerBuild({
      ...raw,
      rotation: savedRotation.rotation,
    });
    const app = {
      build,
      skillByName: engineerCatalog.skillsByName,
      attributeWeaponSet: 1,
    };
    recalculate(app);
    const result = runSimulation(app);
    assert.deepEqual(result.warnings, []);
    assert.ok(result.dps > 0);
    const benchmarkDps = Number(savedRotation.metadata.benchmarkDps);
    assert.ok(
      Math.abs(result.dps - benchmarkDps) / benchmarkDps < 0.02,
      `${savedRotation.metadata.log}: simulated ${result.dps.toFixed(2)} ` +
        `DPS versus ${benchmarkDps.toFixed(2)} benchmark DPS`,
    );
    if (raw === rifle) {
      const damageHits = (name) =>
        result.resolvedEvents.filter(
          (event) => event.type === "damage" && event.name === name,
        ).length;
      assert.equal(damageHits("Core Reactor Shot"), 6);
      assert.equal(damageHits("Overcharged Shot"), 8);
      assert.equal(damageHits("Orbital Command Strike"), 6);
      assert.equal(damageHits("Maximum Damage"), 19);
    }
  }
});

test("Amalgam protocol IDs survive application build conversion", () => {
  const defaults = createEngineerBuildDefaults();
  const application = toApplicationBuild({
    ...defaults,
    selectedMorphSkillIds: [77103, 77104, 76705],
    rotation: [77103, 77104, 76705],
  });
  assert.deepEqual(application.rotation, [
    { name: "Offensive Protocol: Shred", skillId: 77103 },
    { name: "Defensive Protocol: Thorns", skillId: 77104 },
    { name: "Offensive Protocol: Obliterate", skillId: 76705 },
  ]);

  const legacyApplication = toApplicationBuild({
    ...defaults,
    selectedMorphSkillIds: [77103, 77104, 76705],
    rotation: [
      "Offensive Protocol: Shred",
      "Defensive Protocol: Thorns",
      "Offensive Protocol: Obliterate",
    ],
  });
  assert.deepEqual(legacyApplication.rotation, application.rotation);
});

test("kits replace the weapon bar and trigger swap procs", () => {
  const denied = simulate("Core", ["Grenade"]);
  assert.match(denied.warnings[0], /equip Grenade Kit first/);

  const result = simulate("Core", ["Grenade Kit", "Shrapnel Grenade"]);
  assert.equal(result.warnings.length, 0);
  assert.ok(result.totalDamage > 0);
  assert.equal(result.endState.profession.activeKit, "Grenade Kit");
  assert.ok(result.events.some((event) => event.type === "sigil_swap"));

  const weaponDenied = simulate("Core", ["Grenade Kit", "Blunderbuss"]);
  assert.match(weaponDenied.warnings[0], /active kit.*replaces weapon skills/);

  for (const exitSkill of ["Stow Grenade Kit", "Swap Weapons"]) {
    const exited = simulate("Core", ["Grenade Kit", exitSkill, "Blunderbuss"]);
    assert.equal(exited.warnings.length, 0, exitSkill);
    assert.equal(exited.endState.profession.activeKit, "", exitSkill);
    assert.equal(exited.endState.activeWeaponSet, 1, exitSkill);
  }

  const swapDenied = simulate("Core", ["Swap Weapons"]);
  assert.match(swapDenied.warnings[0], /only to leave an active kit/);
});

test("Photon Forge entry and exit start dedicated timeline rows", () => {
  const transition = engineerProfession.ui.timelineWeaponLineTransition;
  assert.equal(
    transition({
      skill: engineerCatalog.skillsByName.get("Engage Photon Forge"),
      weaponLine: null,
    }),
    "Photon Forge",
  );
  assert.equal(
    transition({
      skill: engineerCatalog.skillsByName.get("Deactivate Photon Forge"),
      weaponLine: "Photon Forge",
    }),
    null,
  );
});

test("Engineer kit palettes stack and include their linked stow skills", () => {
  const paletteGroups = engineerProfession.ui.paletteGroups({
    specialization: "Core",
    build: {
      selectedSkills: {
        Heal: "Med Kit",
        Utility1: "Grenade Kit",
        Utility2: "Flamethrower",
        Utility3: "Bomb Kit",
        Elite: "Tool Kit",
      },
    },
    professionState: { activeKit: "Grenade Kit" },
  });
  const groups = paletteGroups.filter(
    (group) => group.stackId === "engineer-kits",
  );
  const names = (group) =>
    group.skillIds.map((id) => engineerCatalog.skillsById.get(id).name);

  assert.deepEqual(
    groups.map((group) => group.label),
    ["Gren", "Flam", "Bomb", "Med", "Tool"],
  );
  assert.equal(paletteGroups.at(-1).id, "engineer-profession");
  assert.deepEqual(
    groups.map((group) => names(group).at(-1)),
    [
      "Stow Grenade Kit",
      "Stow Flamethrower",
      "Stow Bomb Kit",
      "Stow Med Kit",
      "Stow Tool Kit",
    ],
  );
});

test("Scrapper F skills follow selected skill-slot order", () => {
  const context = {
    specialization: "Scrapper",
    build: {
      selectedSkills: {
        Heal: "Healing Turret",
        Utility1: "Grenade Kit",
        Utility2: "Throw Mine",
        Utility3: "Rifle Turret",
        Elite: "Supply Crate",
      },
    },
    professionState: {},
  };
  const group = engineerProfession.ui
    .paletteGroups(context)
    .find((candidate) => candidate.id === "engineer-profession");

  assert.equal(group.includeActionSkills, true);
  const expected = [
    "Regenerating Mist",
    "Grenade Barrage",
    "Mine Field",
    "Surprise Shot (engineer skill)",
    "Function Gyro",
  ];
  assert.deepEqual(
    group.skillIds.map((id) => engineerCatalog.skillsById.get(id).name),
    expected,
  );
  const core = simulate("Core", ["Function Gyro"]);
  assert.match(core.warnings[0], /Unknown skill id Function Gyro/);
  const skillBarGroups = engineerProfession.ui.skillBarGroups(context);
  assert.deepEqual(
    skillBarGroups.map((candidate) => candidate.label),
    ["F Skills"],
  );
  assert.deepEqual(
    skillBarGroups.flatMap((candidate) =>
      candidate.skillIds.map((id) => engineerCatalog.skillsById.get(id).name),
    ),
    expected,
  );
});

test("Core and Mechanist skill bars expose their derived F skills", () => {
  const selectedSkills = {
    Heal: "Healing Turret",
    Utility1: "Grenade Kit",
    Utility2: "Throw Mine",
    Utility3: "Rifle Turret",
    Elite: "Supply Crate",
  };
  const core = engineerProfession.ui.skillBarGroups({
    specialization: "Core",
    build: { selectedSkills },
    professionState: {},
  });
  assert.deepEqual(
    core.map((group) => group.label),
    ["F Skills"],
  );
  assert.deepEqual(
    core.flatMap((group) =>
      group.skillIds.map((id) => engineerCatalog.skillsById.get(id).name),
    ),
    [
      "Regenerating Mist",
      "Grenade Barrage",
      "Mine Field",
      "Surprise Shot (engineer skill)",
      "Med Pack Drop",
    ],
  );

  const mechanist = engineerProfession.ui.skillBarGroups({
    specialization: "Mechanist",
    build: {
      selectedSkills,
      specializations: [
        {
          name: "Mechanist",
          traits: "3-2-2",
        },
      ],
    },
    professionState: { mech: { active: true } },
  });
  assert.deepEqual(
    mechanist.map((group) => group.label),
    ["F Skills"],
  );
  assert.deepEqual(
    mechanist.flatMap((group) =>
      group.skillIds.map((id) => engineerCatalog.skillsById.get(id).name),
    ),
    ["Spark Revolver", "Crisis Zone", "Barrier Burst", "Recall Mech"],
  );

  const holosmith = engineerProfession.ui.skillBarGroups({
    specialization: "Holosmith",
    build: { selectedSkills },
    professionState: {},
  });
  assert.deepEqual(
    holosmith.map((group) => group.label),
    ["F Skills", "Photon Forge"],
  );
  assert.deepEqual(
    holosmith[0].skillIds.map((id) => engineerCatalog.skillsById.get(id).name),
    [
      "Regenerating Mist",
      "Grenade Barrage",
      "Mine Field",
      "Surprise Shot (engineer skill)",
      "Engage Photon Forge",
    ],
  );
  assert.equal(holosmith.at(-1).label, "Photon Forge");
  assert.deepEqual(
    holosmith
      .at(-1)
      .skillIds.map((id) => engineerCatalog.skillsById.get(id).name),
    [
      "Light Strike",
      "Holo Leap",
      "Corona Burst",
      "Photon Blitz",
      "Holographic Shockwave",
    ],
  );
});

test("Engineer always labels its single weapon set", () => {
  assert.equal(weaponSetLabelVisible("engineer", false), true);
  assert.equal(weaponSetLabelVisible("engineer", true), true);
  assert.equal(weaponSetLabelVisible("guardian", false), false);
});

test("Engineer slot selection excludes contextual and unsupported utilities", () => {
  const selectable = (name) =>
    engineerProfession.ui.isSlotSkillSelectable(
      {},
      engineerCatalog.skillsByName.get(name),
    );
  for (const name of [
    "Elixir B",
    "Elixir C",
    "Elixir S",
    "Elixir U",
    "Elixir R",
    "Utility Goggles",
    "Rocket Boots",
    "Stow Grenade Kit",
    "Stow Flamethrower",
    "Detonate",
    "Detonate Thumper Turret",
    "Detonate Rifle Turret",
  ]) {
    assert.equal(selectable(name), false, name);
  }
  for (const name of [
    "Grenade Kit",
    "Flamethrower",
    "Bomb Kit",
    "Med Kit",
    "Tool Kit",
    "Throw Mine",
    "Rifle Turret",
  ]) {
    assert.equal(selectable(name), true, name);
  }
});

test("Engineer build validation matches unsupported slot filtering", () => {
  const defaults = createEngineerBuildDefaults();
  for (const name of ["Elixir B", "Harpoon Turret"]) {
    const build = {
      ...defaults,
      selectedSkills: {
        ...defaults.selectedSkills,
        Utility1: name,
      },
    };
    const validation = validateEngineerBuild(build);
    assert.equal(validation.valid, false, name);
    assert.match(validation.errors.join(" "), /available Utility skill/);
  }
});

test("Engineer mine and turret detonations are armed by their parent skills", () => {
  for (const [parent, flip] of [
    ["Throw Mine", "Detonate"],
    ["Rifle Turret", "Detonate Rifle Turret"],
    ["Flame Turret", "Detonate Flame Turret"],
    ["Net Turret", "Detonate Net Turret"],
    ["Thumper Turret", "Detonate Thumper Turret"],
    ["Healing Turret", "Detonate Healing Turret"],
    ["Rocket Turret", "Detonate Rocket Turret"],
  ]) {
    const config = {
      selectedSkills: [...baseConfig.selectedSkills, parent],
    };
    const denied = simulate("Core", [flip], config);
    assert.match(denied.warnings[0], new RegExp(`use ${parent} first`));

    const result = simulate("Core", [parent, flip], config);
    assert.equal(result.warnings.length, 0, `${parent} -> ${flip}`);
    assert.equal(
      result.endState.profession.availableFlips[
        engineerCatalog.skillsByName.get(flip).id
      ],
      false,
    );
  }

  const mineConfig = {
    selectedSkills: [...baseConfig.selectedSkills, "Throw Mine"],
  };
  const throwStarts = (rotation) =>
    simulate("Core", rotation, mineConfig)
      .steps.filter((step) => step.skill === "Throw Mine")
      .map((step) => step.start);
  assert.equal(
    engineerCatalog.skillsByName.get("Throw Mine").rechargeAnchor,
    "castStart",
  );
  assert.deepEqual(
    throwStarts([
      "Throw Mine",
      { type: "wait", durationMs: 11500 },
      "Throw Mine",
    ]),
    [0, 12000],
  );
  assert.deepEqual(
    throwStarts([
      "Throw Mine",
      "Detonate",
      { type: "wait", durationMs: 11500 },
      "Throw Mine",
    ]),
    [0, 12000],
  );
});

test("detonating a turret cancels its remaining summoned attacks", () => {
  const config = {
    selectedSkills: [...baseConfig.selectedSkills, "Rifle Turret"],
  };
  const active = simulate(
    "Core",
    ["Rifle Turret", { type: "wait", durationMs: 10000 }],
    config,
  );
  const detonated = simulate(
    "Core",
    [
      "Rifle Turret",
      "Detonate Rifle Turret",
      { type: "wait", durationMs: 10000 },
    ],
    config,
  );
  const turretHits = (result) =>
    result.resolvedEvents.filter(
      (event) =>
        event.type === "damage" &&
        event.name === "Rifle Turret" &&
        event.actorType === "summon",
    );
  assert.equal(turretHits(active).length, 5);
  assert.equal(turretHits(detonated).length, 1);
  assert.equal(
    detonated.resolvedEvents.filter(
      (event) =>
        event.type === "damage" && event.name === "Detonate Rifle Turret",
    ).length,
    1,
  );
});

test("Engineer contextual weapon follow-ups are not standalone selections", () => {
  const rifleGrenade = engineerCatalog.skillsByName.get("Rifle Burst Grenade");
  assert.equal(rifleGrenade.simulatorExcluded, true);
  assert.equal(
    engineerCatalog.autoattackChains.some((chain) =>
      chain.includes(rifleGrenade.id),
    ),
    false,
  );

  const rifleBurst = simulate("Core", ["Rifle Burst"]);
  assert.equal(rifleBurst.warnings.length, 0);
  assert.ok(
    rifleBurst.resolvedEvents.some(
      (event) => event.name === "Rifle Burst Grenade",
    ),
  );

  const deniedGrenade = simulate("Core", ["Rifle Burst Grenade"]);
  assert.match(deniedGrenade.warnings[0], /activates automatically/);

  for (const [parent, flip] of [
    ["Magnetic Shield", "Magnetic Inversion"],
    ["Static Shield", "Throw Shield"],
  ]) {
    const denied = simulate("Core", [flip]);
    assert.match(denied.warnings[0], new RegExp(`use ${parent} first`));

    const used = simulate("Core", [parent, flip]);
    assert.equal(used.warnings.length, 0, flip);
    assert.equal(
      used.endState.profession.availableFlips[
        engineerCatalog.skillsByName.get(flip).id
      ],
      false,
      flip,
    );
  }
});

test("tool-belt skills derive from selected slot skills", () => {
  const available = simulate("Core", ["Grenade Barrage"]);
  assert.equal(available.warnings.length, 0);
  assert.ok(available.totalDamage > 0);

  const denied = simulate("Core", ["Grenade Barrage"], {
    selectedSkills: [
      "Healing Turret",
      "Throw Mine",
      "Rifle Turret",
      "Supply Crate",
    ],
  });
  assert.match(denied.warnings[0], /Grenade Kit is not equipped/);
});

test("Photon Forge heat generation and cooling use current piecewise rates", () => {
  const preheatedGrace = simulate(
    "Holosmith",
    [{ type: "wait", durationMs: 3000 }],
    {
      initialHeat: 100,
      selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
    },
  );
  assert.equal(preheatedGrace.endState.profession.heat, 100);

  const preheatedCooling = simulate(
    "Holosmith",
    [{ type: "wait", durationMs: 5200 }],
    {
      initialHeat: 100,
      selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
    },
  );
  assert.equal(preheatedCooling.endState.profession.heat, 89);

  const hot = simulate("Holosmith", [
    "Engage Photon Forge",
    { type: "wait", durationMs: 5000 },
    "Deactivate Photon Forge",
    { type: "wait", durationMs: 3000 },
  ]);
  assert.equal(hot.endState.profession.heat, 10);
  assert.equal(hot.endState.profession.photonForgeActive, false);

  const cooled = simulate("Holosmith", [
    "Engage Photon Forge",
    { type: "wait", durationMs: 5000 },
    "Deactivate Photon Forge",
    { type: "wait", durationMs: 11500 },
  ]);
  assert.equal(cooled.endState.profession.heat, 0);

  const amplified = simulate(
    "Holosmith",
    ["Engage Photon Forge", { type: "wait", durationMs: 1000 }],
    {
      selectedTraitIds: [TRAIT.LIGHT_DENSITY_AMPLIFIER],
    },
  );
  assert.equal(amplified.endState.profession.heat, 3);
});

test("Corona Burst heat persists outside Forge without causing Overheat", () => {
  const outside = simulate(
    "Holosmith",
    [
      "Engage Photon Forge",
      { type: "wait", durationMs: 5500 },
      "Corona Burst",
      "Deactivate Photon Forge",
      { type: "wait", durationMs: 3000 },
    ],
    {
      initialHeat: 135,
      selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
    },
  );
  assert.ok(
    outside.events.some(
      (event) =>
        event.type === "engineer.state" &&
        Number(event.state?.heat || 0) >= 150 - 1e-9,
    ),
  );
  assert.ok(outside.endState.profession.heat <= 150);
  assert.equal(outside.endState.profession.overheated, false);
  assert.equal(outside.endState.profession.photonForgeActive, false);

  const inside = simulate(
    "Holosmith",
    ["Engage Photon Forge", "Corona Burst", { type: "wait", durationMs: 1000 }],
    {
      initialHeat: 145,
      selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
    },
  );
  assert.equal(inside.endState.profession.heat, 150);
  assert.equal(inside.endState.profession.overheated, true);
  assert.equal(inside.endState.profession.photonForgeActive, false);
});

test("Photon Blitz gains two heat for each completed projectile", () => {
  const partial = simulate("Holosmith", [
    "Engage Photon Forge",
    { name: "Photon Blitz", interruptMs: 600 },
  ]);
  assert.ok(Math.abs(partial.endState.profession.heat - 7.2) < 1e-9);

  const full = simulate("Holosmith", ["Engage Photon Forge", "Photon Blitz"]);
  assert.equal(full.endState.profession.heat, 19.96);
});

test("Photon Forge overheats at its trait-adjusted maximum", () => {
  const core = simulate(
    "Holosmith",
    ["Engage Photon Forge", { type: "wait", durationMs: 5000 }],
    {
      initialHeat: 90,
    },
  );
  assert.equal(core.endState.profession.heat, 100);
  assert.equal(core.endState.profession.overheated, true);
  assert.equal(core.endState.profession.photonForgeActive, false);

  const enhanced = simulate("Holosmith", [], {
    initialHeat: 149,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
  });
  assert.equal(enhanced.endState.profession.maximumHeat, 150);
  assert.equal(enhanced.endState.profession.heat, 149);

  const fullyCooled = simulate(
    "Holosmith",
    [
      "Engage Photon Forge",
      { type: "wait", durationMs: 5000 },
      { type: "wait", durationMs: 15520 },
    ],
    {
      initialHeat: 90,
    },
  );
  assert.equal(fullyCooled.endState.profession.heat, 0);
  assert.equal(fullyCooled.endState.profession.overheated, false);
});

test("Holosmith offensive traits consume forge heat and attack charges", () => {
  const laserBase = simulate(
    "Holosmith",
    ["Engage Photon Forge", "Light Strike"],
    {
      initialHeat: 50,
      stats: { precision: 1000, ferocity: 0 },
    },
  );
  const laser = simulate("Holosmith", ["Engage Photon Forge", "Light Strike"], {
    initialHeat: 50,
    stats: { precision: 1000, ferocity: 0 },
    selectedTraitIds: [TRAIT.LASERS_EDGE],
  });
  assert.ok(
    Math.abs(laser.strikeDamage / laserBase.strikeDamage - 1.075) < 1e-12,
  );
  const glassLaser = simulate(
    "Holosmith",
    ["Engage Photon Forge", "Light Strike"],
    {
      initialHeat: 50,
      stats: { precision: 1000, ferocity: 0 },
      selectedTraitIds: [TRAIT.GLASS_CANNON, TRAIT.LASERS_EDGE],
    },
  );
  assert.ok(
    Math.abs(glassLaser.strikeDamage / laserBase.strikeDamage - 1.07 * 1.075) <
      1e-12,
  );

  const solar = simulate(
    "Holosmith",
    ["Engage Photon Forge", "Light Strike", "Bright Slash"],
    {
      stats: { precision: 1000, ferocity: 0 },
      selectedTraitIds: [TRAIT.SOLAR_FOCUSING_LENS],
    },
  );
  const solarStrikes = solar.resolvedEvents.filter(
    (event) => event.type === "damage" && event.solarFocusingLens === true,
  );
  const solarBurns = solar.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.name === "Solar Focusing Lens — Burning",
  );
  assert.equal(solarStrikes.length, 2);
  assert.equal(solarBurns.length, 2);
  assert.ok(
    solarBurns.every((event) => event.stacks === 1 && event.duration === 3),
  );
  assert.equal(solar.endState.profession.solarFocusingLensStacks, 0);

  const storm = simulate(
    "Holosmith",
    [
      "Engage Photon Forge",
      ID.LIGHT_STRIKE_STORM,
      ID.BRIGHT_SLASH_STORM,
      ID.FLASH_CUTTER_STORM,
    ],
    {
      selectedTraitIds: [TRAIT.CRYSTAL_CONFIGURATION_STORM],
    },
  );
  assert.equal(storm.warnings.length, 0);
  const stormPackets = storm.events.filter(
    (event) => event.type === "damage" && event.projectile === true,
  );
  assert.deepEqual(
    stormPackets.map((event) => event.coefficient),
    [1, 1, 0.8, 0.8],
  );
  assert.ok(stormPackets.every((event) => event.damageKind === "explosion"));
});

test("Thermal Release Valve, ECSU, and PBM materialize their heat effects", () => {
  const vented = simulate("Holosmith", ["Dodge"], {
    initialHeat: 50,
    selectedTraitIds: [TRAIT.THERMAL_RELEASE_VALVE],
  });
  assert.equal(vented.endState.profession.heat, 35);
  const vent = vented.events.find(
    (event) => event.type === "damage" && event.name === "Vent Exhaust",
  );
  assert.equal(vent.coefficient, 1.1);
  assert.equal(vent.noCrit, true);
  assert.ok(
    vented.events.some(
      (event) =>
        event.type === "buff" && event.kind === "vigor" && event.duration === 3,
    ),
  );
  assert.ok(
    vented.events.some(
      (event) =>
        event.type === "condition" &&
        event.name === "Vent Exhaust — Burning" &&
        event.stacks === 2 &&
        event.duration === 6,
    ),
  );

  const enhanced = simulate(
    "Holosmith",
    ["Engage Photon Forge", { type: "wait", durationMs: 3000 }],
    {
      initialHeat: 99,
      selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
    },
  );
  const mightPulses = enhanced.events.filter(
    (event) =>
      event.type === "buff" &&
      event.name === "Enhanced Capacity Storage Unit — might",
  );
  assert.equal(mightPulses.length, 3);
  assert.ok(
    mightPulses.every((event) => event.stacks === 2 && event.duration === 6),
  );

  const swordChain = ["Sun Edge", "Sun Ripper", "Gleam Saber"];
  const tierBase = simulate("Holosmith", swordChain, {
    initialHeat: 99,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
    stats: { precision: 1000, ferocity: 0 },
  });
  const tiered = simulate("Holosmith", swordChain, {
    initialHeat: 100,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
    stats: { precision: 1000, ferocity: 0 },
  });
  const baseSunEdge = tierBase.resolvedEvents.find(
    (event) => event.type === "damage" && event.name === "Sun Edge",
  );
  const tieredSunEdge = tiered.resolvedEvents.find(
    (event) => event.type === "damage" && event.name === "Sun Edge",
  );
  assert.ok(
    Math.abs(tieredSunEdge.damage / baseSunEdge.damage - 1.3 / 1.2) < 1e-12,
  );

  const blasting = simulate(
    "Holosmith",
    ["Engage Photon Forge", { type: "wait", durationMs: 6600 }],
    {
      initialHeat: 90,
      selectedTraitIds: [TRAIT.PHOTONIC_BLASTING_MODULE],
    },
  );
  const blast = blasting.events.find(
    (event) =>
      event.type === "damage" && event.name === "Photonic Blasting Module",
  );
  assert.equal(blast.coefficient, 5);
  assert.equal(blast.explosion, true);
  assert.equal(blast.comboFinishers[0].finisherType, "Blast");
  assert.equal(
    blasting.events.find(
      (event) => event.type === "proc" && event.name === "Overheat",
    ).initialBaseHealthDamage,
    0,
  );

  const heatLocked = simulate(
    "Holosmith",
    [
      "Engage Photon Forge",
      { type: "wait", durationMs: 1000 },
      "Deactivate Photon Forge",
      { type: "wait", durationMs: 10000 },
    ],
    {
      selectedTraitIds: [TRAIT.PHOTONIC_BLASTING_MODULE],
    },
  );
  assert.equal(heatLocked.endState.profession.heat, 2);
});

test("Prime Light Beam creates its damaging field only above 50 heat", () => {
  const selectedSkills = [
    "Healing Turret",
    "Grenade Kit",
    "Throw Mine",
    "Rifle Turret",
    "Prime Light Beam",
  ];
  const cast = (initialHeat) =>
    simulate(
      "Holosmith",
      [
        "Engage Photon Forge",
        "Prime Light Beam",
        { type: "wait", durationMs: 9000 },
      ],
      {
        initialHeat,
        selectedSkills,
      },
    );
  const beamDamage = (result) =>
    result.resolvedEvents.filter(
      (event) =>
        event.type === "damage" && event.skillName === "Prime Light Beam",
    );
  const beamBurning = (result) =>
    result.resolvedEvents.filter(
      (event) =>
        event.type === "condition" &&
        event.skillName === "Prime Light Beam" &&
        event.condition === "Burning",
    );

  assert.equal(beamDamage(cast(0)).length, 1);
  const hot = cast(60);
  assert.equal(beamDamage(hot).length, 11);
  assert.equal(beamBurning(hot).length, 10);
  assert.ok(beamDamage(hot).every((event) => event.damageKind === "explosion"));
});

test("Holosmith exceed packets use their heat tiers and conditions", () => {
  const selectedSkills = [
    "A.E.D.",
    "Grenade Kit",
    "Photon Wall",
    "Laser Disk",
    "Prime Light Beam",
  ];
  const run = (rotation, initialHeat, selectedTraitIds = []) =>
    simulate("Holosmith", rotation, {
      initialHeat,
      selectedSkills,
      selectedTraitIds,
      stats: { precision: 1000, ferocity: 0 },
      target: { conditions: {} },
    });
  const skillEvents = (result, type, skillName) =>
    result.resolvedEvents.filter(
      (event) => event.type === type && event.skillName === skillName,
    );

  const coldDisk = run(["Laser Disk", { type: "wait", durationMs: 7000 }], 0);
  const hotDisk = run(["Laser Disk", { type: "wait", durationMs: 10000 }], 60);
  const enhancedDisk = run(
    ["Laser Disk", { type: "wait", durationMs: 10000 }],
    100,
    [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
  );
  const hotDiskDamage = skillEvents(hotDisk, "damage", "Laser Disk");
  const enhancedDiskDamage = skillEvents(enhancedDisk, "damage", "Laser Disk");
  assert.equal(skillEvents(coldDisk, "damage", "Laser Disk").length, 12);
  assert.equal(hotDiskDamage.length, 18);
  assert.equal(enhancedDiskDamage.length, 18);
  assert.equal(skillEvents(hotDisk, "condition", "Laser Disk").length, 18);
  assert.ok(hotDiskDamage.every((event) => event.coefficient === 0.5));
  assert.ok(
    skillEvents(hotDisk, "condition", "Laser Disk").every(
      (event) => event.condition === "Bleeding" && event.duration === 2,
    ),
  );
  assert.ok(
    enhancedDiskDamage.every(
      (event, index) =>
        event.enhancedCapacityTier === true &&
        Math.abs(event.damage / hotDiskDamage[index].damage - 1.35) < 1e-12,
    ),
  );

  const coldWall = run(
    ["Photon Wall", "Launch Wall", { type: "wait", durationMs: 1000 }],
    0,
  );
  const hotWall = run(
    ["Photon Wall", "Launch Wall", { type: "wait", durationMs: 1000 }],
    60,
  );
  assert.equal(skillEvents(coldWall, "damage", "Launch Wall").length, 1);
  assert.equal(skillEvents(hotWall, "damage", "Launch Wall").length, 3);
  assert.ok(
    skillEvents(hotWall, "damage", "Launch Wall").every(
      (event) => event.coefficient === 1.5 && event.damageKind === "explosion",
    ),
  );
  assert.ok(
    skillEvents(hotWall, "condition", "Launch Wall").every(
      (event) =>
        event.condition === "Vulnerability" &&
        event.stacks === 3 &&
        event.duration === 5,
    ),
  );

  const blades = (initialHeat) =>
    run(
      ["Refraction Cutter", { type: "wait", durationMs: 1000 }],
      initialHeat,
      [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
    );
  assert.deepEqual(
    [0, 60, 100].map(
      (heat) =>
        skillEvents(blades(heat), "damage", "Refraction Cutter").filter(
          (event) => event.name === "Refraction Cutter Blade",
        ).length,
    ),
    [1, 3, 5],
  );

  const beam = run(
    ["Prime Light Beam", { type: "wait", durationMs: 11000 }],
    100,
    [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
  );
  const field = skillEvents(beam, "damage", "Prime Light Beam").filter(
    (event) => event.name === "Field Damage",
  );
  const burning = skillEvents(beam, "condition", "Prime Light Beam");
  assert.equal(field.length, 10);
  assert.ok(
    field.every(
      (event) => event.coefficient === 0.5 && event.damageKind === "explosion",
    ),
  );
  assert.equal(burning.length, 10);
  assert.ok(
    burning.every(
      (event) =>
        event.condition === "Burning" &&
        event.duration === 3 &&
        event.effectiveDuration === 4.5,
    ),
  );
});

test("Relic of Fireworks accepts weapon-strength profession mechanics", () => {
  const selectedSkills = [
    "A.E.D.",
    "Grenade Kit",
    "Photon Wall",
    "Laser Disk",
    "Prime Light Beam",
  ];
  const result = simulate(
    "Holosmith",
    [
      "Blade Burst",
      "Grenade Barrage",
      "Static Shock",
      { type: "wait", durationMs: 1000 },
    ],
    {
      selectedSkills,
      relic: "Fireworks",
    },
  );
  const procs = result.procSteps.filter(
    (step) => step.skill === "Relic of Fireworks",
  );
  assert.deepEqual(
    new Set(procs.map((step) => step.sourceSkill)),
    new Set(["Blade Burst", "Grenade Barrage", "Static Shock"]),
  );
  assert.equal(procs.length, 8);

  const utility = simulate(
    "Holosmith",
    ["Laser Disk", { type: "wait", durationMs: 1000 }],
    {
      selectedSkills,
      relic: "Fireworks",
    },
  );
  assert.equal(
    utility.procSteps.some((step) => step.skill === "Relic of Fireworks"),
    false,
  );
});

test("Mechanist commands are selected by traits and mech attacks persist", () => {
  const result = simulate(
    "Mechanist",
    ["Spark Revolver", { type: "wait", durationMs: 2000 }],
    {
      selectedTraitIds: [
        TRAIT.MECH_ARMS_JADE_CANNONS,
        TRAIT.MECH_FRAME_CHANNELING_CONDUITS,
        TRAIT.MECH_CORE_BARRIER_ENGINE,
      ],
    },
  );
  assert.equal(result.warnings.length, 0);
  assert.deepEqual(
    result.profession.mech.commandSkillIds.map(
      (id) => engineerCatalog.skillsById.get(id).name,
    ),
    ["Spark Revolver", "Crisis Zone", "Barrier Burst"],
  );
  assert.ok(
    result.resolvedEvents.some(
      (event) =>
        event.skillName === "Jade Energy Shot" && event.actorType === "summon",
    ),
  );
});

test("Amalgam exposes only persisted F2-F4 morph choices", () => {
  const selected = simulate("Amalgam", [77103], {
    selectedMorphSkillIds: [77103, 77203, 76954],
  });
  assert.equal(selected.warnings.length, 0);
  assert.ok(selected.totalDamage > 0);

  const denied = simulate("Amalgam", [76568], {
    selectedMorphSkillIds: [77103, 77203, 76954],
  });
  assert.match(denied.warnings[0], /another morph is selected/);

  const groups = engineerProfession.ui.skillBarGroups({
    specialization: "Amalgam",
    build: {
      selectedSkills: {
        Heal: "Healing Turret",
      },
      selectedMorphSkillIds: [77103, 77203, 76954],
    },
  });
  assert.deepEqual(
    groups.map((group) => group.label),
    ["F Skills", "Protocols"],
  );
  assert.deepEqual(
    groups[0].skillIds.map((id) => engineerCatalog.skillsById.get(id).name),
    ["Regenerating Mist", "Evolve"],
  );
  const protocolSelections = groups[1].selections;
  assert.deepEqual(
    protocolSelections.map(
      (selection) => engineerCatalog.skillsById.get(selection.skillId).name,
    ),
    [
      "Offensive Protocol: Shred",
      "Defensive Protocol: Protect",
      "Offensive Protocol: Demolish",
    ],
  );
  assert.equal(groups[1].className, "engineer-amalgam-protocols");
  assert.deepEqual(
    protocolSelections.map((selection) => [
      selection.keyLabel,
      selection.typeLabel,
    ]),
    [
      ["F2", "Protocol"],
      ["F3", "Protocol"],
      ["F4", "Protocol"],
    ],
  );
  assert.ok(
    protocolSelections.every(
      (selection) =>
        selection.selectionKey === "selectedMorphSkillIds" &&
        selection.optionSkillIds.length === 7,
    ),
  );
});

test("Amalgam protocol selection swaps conflicting protocol names", () => {
  const build = {
    selectedMorphSkillIds: [77103, 77203, 76954],
  };
  const select = (index, skillId) =>
    engineerProfession.ui.updateSkillBarSelection(
      { specialization: "Amalgam", build },
      {
        key: "selectedMorphSkillIds",
        index,
        skillId,
      },
    );

  assert.equal(select(0, 76959), true);
  assert.deepEqual(build.selectedMorphSkillIds, [76959, 76866, 76954]);
  assert.deepEqual(
    build.selectedMorphSkillIds.map(
      (id) => engineerCatalog.skillsById.get(id).name,
    ),
    [
      "Defensive Protocol: Protect",
      "Offensive Protocol: Shred",
      "Offensive Protocol: Demolish",
    ],
  );

  assert.equal(select(1, 76693), true);
  assert.deepEqual(build.selectedMorphSkillIds, [76959, 76693, 76568]);
  assert.equal(
    new Set(
      build.selectedMorphSkillIds.map(
        (id) => engineerCatalog.skillsById.get(id).name,
      ),
    ).size,
    3,
  );
});

test("Engineer benchmark packets use total coefficients and measured cadence", () => {
  const mechanic = (name) => engineerCatalog.skillsByName.get(name);
  assert.equal(mechanic("Shrapnel Grenade").quicknessCastTimeMs, 680);
  assert.equal(mechanic("Poison Grenade").quicknessCastTimeMs, 680);
  assert.equal(mechanic("Freeze Grenade").quicknessCastTimeMs, 680);
  assert.equal(mechanic("Flame Jet").castTimeMs, 2570);
  assert.equal(mechanic("Flame Jet").effects[0].coefficient, 2.5);
  assert.equal(
    mechanic("Napalm").effects[0].ticks.reduce(
      (total, packet) => total + packet.coefficient,
      0,
    ),
    5,
  );
  assert.equal(mechanic("Napalm").quicknessCastTimeMs, 1760);
  assert.equal(mechanic("Napalm").cooldown, 25);
  assert.deepEqual(
    mechanic("Napalm").effects[0].ticks.map((packet) => packet.atMs),
    [280, 441, 560, 679, 842, 955, 1077, 1240, 1361, 1482],
  );
  assert.equal(mechanic("Napalm").effects[1].ticks.length, 10);
  assert.deepEqual(
    mechanic("Napalm").effects[1].ticks.map((packet) => packet.atMs),
    mechanic("Napalm").effects[0].ticks.map((packet) => packet.atMs),
  );
  assert.equal(mechanic("Flame Blast").cooldown, 6);
  assert.equal(mechanic("Flame Blast").quicknessCastTimeMs, 800);
  assert.equal(mechanic("Flame Blast").measuredCancelMs, 480);
  assert.equal(
    mechanic("Flame Blast").effects[0].metadata.damageKind,
    "explosion",
  );
  assert.deepEqual(
    [
      "Fragmentation Shot",
      "Poison Dart Volley",
      "Static Shot",
      "Glue Shot",
      "Blowtorch",
      "Prime Light Beam",
      "Corona Burst",
      "Photon Blitz",
    ].map((name) => [name, mechanic(name).quicknessCastTimeMs]),
    [
      ["Fragmentation Shot", 520],
      ["Poison Dart Volley", 840],
      ["Static Shot", 320],
      ["Glue Shot", 560],
      ["Blowtorch", 560],
      ["Prime Light Beam", 1160],
      ["Corona Burst", 480],
      ["Photon Blitz", 1320],
    ],
  );
  assert.equal(mechanic("Poison Dart Volley").effects[0].coefficient, 2);
  assert.equal(mechanic("Poison Dart Volley").effects[1].ticks.length, 5);
  assert.equal(mechanic("Static Shot").effects[1].stacks, 3);
  assert.equal(mechanic("Static Shot").effects[1].duration, 5);
  assert.equal(mechanic("Glue Shot").effects[0].coefficient, 2.5);
  assert.equal(mechanic("Blowtorch").effects[0].coefficient, 2);
  assert.deepEqual(
    mechanic("Corona Burst")
      .effects.filter((effect) => effect.type === "strike")
      .map((effect) => effect.coefficient),
    [1.5, 1.5],
  );
  assert.ok(
    mechanic("Corona Burst")
      .effects.filter((effect) => effect.type === "strike")
      .every((effect) => effect.metadata.damageKind === "explosion"),
  );
  assert.equal(
    mechanic("Photon Blitz").effects[0].ticks.reduce(
      (total, tick) => total + tick.coefficient,
      0,
    ),
    5.12,
  );
  assert.deepEqual(
    ["Laser Disk", "Photon Wall", "Launch Wall", "Prime Light Beam"].map(
      (name) => [
        name,
        mechanic(name).cooldown,
        mechanic(name).quicknessCastTimeMs,
      ],
    ),
    [
      ["Laser Disk", 30, 960],
      ["Photon Wall", 25, 400],
      ["Launch Wall", 0.5, 520],
      ["Prime Light Beam", 60, 1160],
    ],
  );
  assert.equal(mechanic("Prime Light Beam").effects[0].coefficient, 3);
  assert.equal(
    mechanic("Prime Light Beam").effects[0].metadata.damageKind,
    "explosion",
  );
  assert.equal(
    mechanic("Prime Light Beam").effects[2].metadata.controlKind,
    "launch",
  );
  assert.equal(
    mechanic("Grenade Barrage").effects[0].weapon,
    "Profession mechanic",
  );
  assert.equal(
    mechanic("Blade Burst").effects[0].weapon,
    "Profession mechanic",
  );
  assert.equal(
    mechanic("Particle Accelerator").effects[0].weapon,
    "Profession mechanic",
  );
  assert.equal(
    mechanic("Static Shock").effects[0].weapon,
    "Profession mechanic",
  );
  assert.equal(
    mechanic("Prime Light Beam").effects[1].eventType,
    "engineer.prime-light-beam-field",
  );
  assert.equal(
    mechanic("Grenade Barrage").effects[0].metadata.damageKind,
    "explosion",
  );
  assert.equal(mechanic("Air Blast").quicknessCastTimeMs, 360);
  assert.equal(mechanic("Puncturing Jab").quicknessCastTimeMs, 440);
  assert.equal(mechanic("Rending Strike").quicknessCastTimeMs, 520);
  assert.equal(mechanic("Amplifying Slice").quicknessCastTimeMs, 640);
  assert.equal(mechanic("Lightning Rod").castTimeMs, 400);
  assert.equal(mechanic("Lightning Rod").unaffectedByQuickness, true);
  assert.equal(mechanic("Conduit Surge").castTimeMs, 520);
  assert.equal(mechanic("Conduit Surge").unaffectedByQuickness, true);
  assert.equal(mechanic("Electric Artillery").quicknessCastTimeMs, 520);
  assert.equal(mechanic("Stoke the Flames").quicknessCastTimeMs, 440);
  assert.equal(mechanic("Evolve").quicknessCastTimeMs, 640);
  assert.equal(mechanic("Devastator").castTimeMs, 1000);
  assert.equal(mechanic("Devastator").unaffectedByQuickness, true);

  const shredSkill = mechanic("Offensive Protocol: Shred");
  const shred = shredSkill.effects[0];
  assert.equal(shredSkill.quicknessCastTimeMs, 760);
  assert.deepEqual(
    shred.ticks.map((packet) => packet.coefficient),
    [0.96, 0.96, 0.96],
  );
  assert.deepEqual(
    shred.ticks.map((packet) => packet.atMs),
    [957.6, 1026, 1094.4],
  );
  assert.equal(shredSkill.effects[1].condition, "Immobilized");
  assert.equal(shredSkill.effects[1].duration, 3);

  const demolish = mechanic("Offensive Protocol: Demolish");
  assert.equal(demolish.castTimeMs, 2340);
  assert.equal(demolish.quicknessCastTimeMs, 1000 + 560);
  assert.equal(demolish.rechargeAnchor, "castStart");
  assert.equal(demolish.rechargeOffsetMs, 1000);
  assert.ok(Math.abs(demolish.effects[0].coefficient - 2.7) < 1e-12);
  assert.equal(demolish.effects[0].hits, 3);
  assert.equal(demolish.effects[1].coefficient, 2.25);
  assert.equal(
    demolish.effects.some((effect) => effect.boon === "stability"),
    false,
  );
  const obliterate = mechanic("Offensive Protocol: Obliterate");
  assert.equal(obliterate.quicknessCastTimeMs, 800);
  assert.equal(obliterate.effects[0].coefficient, 2.88);
  assert.equal(obliterate.effects[0].atMs, 640);
  assert.equal(obliterate.effects[0].timingAnchor, "castStart");
  assert.equal(obliterate.effects[1].condition, "Bleeding");
  assert.equal(obliterate.effects[1].stacks, 8);
  assert.equal(obliterate.effects[1].duration, 6);
  assert.equal(obliterate.effects[1].atMs, 640);

  const flux = mechanic("Flux State");
  assert.equal(flux.quicknessCastTimeMs, 640);
  assert.equal(flux.effects[1].coefficient, 9);
  assert.equal(flux.effects[1].hits, 12);
  assert.equal(flux.effects[1].atMs, 500);
  assert.equal(flux.effects[1].intervalMs, 500);
  assert.equal(flux.effects[2].ticks.length, 12);

  const plasmatic = mechanic("Plasmatic State");
  assert.equal(plasmatic.castTimeMs, 1440);
  assert.equal(plasmatic.quicknessCastTimeMs, 480 + 480);
  assert.equal(plasmatic.rechargeAnchor, "castStart");
  assert.equal(plasmatic.rechargeOffsetMs, 480);
  assert.equal(
    plasmatic.effects[0].ticks.reduce(
      (sum, packet) => sum + packet.coefficient,
      0,
    ),
    4.5,
  );
  assert.equal(plasmatic.effects[1].ticks.length, 2);

  const spark = mechanic("Spark Revolver").effects[0];
  assert.ok(
    Math.abs(
      spark.ticks.reduce((sum, packet) => sum + packet.coefficient, 0) - 2.112,
    ) < 1e-12,
  );
  assert.equal(spark.ticks.length, 12);
  assert.equal(spark.actorType, "summon");
});

test("Mechanist sword uses the non-heat skill set and complete packets", () => {
  const skill = (id) => engineerCatalog.skillsById.get(id);
  const swordContext = {
    specialization: "Mechanist",
    catalog: engineerCatalog,
  };
  assert.equal(
    engineerWeaponSkillMatchesSet(
      skill(ID.GLEAM_SABER),
      ["Sword", "Pistol"],
      swordContext,
    ),
    false,
  );
  assert.equal(
    engineerWeaponSkillMatchesSet(
      skill(ID.GLEAM_SABER_ID_70771),
      ["Sword", "Pistol"],
      swordContext,
    ),
    true,
  );

  assert.equal(skill(ID.SUN_EDGE_ID_70514).effects[0].coefficient, 0.96);
  assert.equal(skill(ID.SUN_RIPPER_ID_69906).effects[0].coefficient, 1.02);
  assert.equal(skill(ID.GLEAM_SABER_ID_70771).effects[0].coefficient, 1.65);
  assert.equal(skill(ID.RADIANT_ARC_ID_69565).effects[0].coefficient, 2.5);
  assert.equal(skill(ID.RADIANT_ARC_ID_69565).cooldown, 14);
  assert.equal(
    skill(ID.RADIANT_ARC_ID_69565).comboFinishers[0].finisherType,
    "Leap",
  );

  const refraction = skill(ID.REFRACTION_CUTTER_ID_71121);
  assert.equal(refraction.cooldown, 6);
  assert.equal(refraction.effects[0].coefficient, 1.4);
  assert.equal(refraction.effects[1].coefficient, 0.8);
  assert.equal(refraction.effects[1].hits, 2);
  assert.equal(refraction.effects[2].applications, 2);

  const result = simulate("Mechanist", [
    { type: "cast", skillId: ID.REFRACTION_CUTTER_ID_71121 },
    { type: "cast", skillId: ID.SUN_EDGE_ID_70514 },
    { type: "cast", skillId: ID.SUN_RIPPER_ID_69906 },
    { type: "cast", skillId: ID.GLEAM_SABER_ID_70771 },
    { type: "wait", durationMs: 200 },
  ]);
  const blades = result.resolvedEvents.filter(
    (event) =>
      event.type === "damage" && event.name === "Refraction Cutter Blade",
  );
  const bleeds = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Refraction Cutter" &&
      event.condition === "Bleeding",
  );
  assert.deepEqual(
    blades.map((event) => event.coefficient),
    [0.4, 0.4],
  );
  assert.equal(bleeds.length, 2);
  assert.ok(
    result.procSteps.some(
      (step) =>
        step.skill === "Gleam Saber — Sword Recharge" &&
        step.cooldownReduction === 1,
    ),
  );
});

test("Mechanist rifle uses live close-range packets and measured cadence", () => {
  const skill = (name) => engineerCatalog.skillsByName.get(name);
  const burst = skill("Rifle Burst");
  assert.equal(burst.castTimeMs, 1252.5);
  assert.equal(burst.quicknessCastTimeMs, 835);
  assert.deepEqual(
    burst.effects.map((effect) => [effect.coefficient, effect.atMs]),
    [
      [0.6, 318],
      [0.8, 602],
    ],
  );
  assert.equal(burst.effects[0].comboFinishers[0].chance, 0.2);
  assert.equal(burst.effects[1].metadata.damageKind, "explosion");

  const blunderbuss = skill("Blunderbuss");
  assert.equal(blunderbuss.cooldown, 6);
  assert.equal(blunderbuss.effects[0].coefficient, 2.2);
  assert.deepEqual(
    blunderbuss.effects
      .filter((effect) => effect.condition === "Bleeding")
      .map((effect) => [effect.stacks, effect.duration]),
    [[3, 9]],
  );

  const net = skill("Net Shot");
  assert.equal(net.cooldown, 9);
  assert.equal(net.effects[0].coefficient, 1.25);
  assert.ok(
    net.effects.some(
      (effect) => effect.condition === "Immobilized" && effect.duration === 4,
    ),
  );
  assert.ok(
    net.effects.some(
      (effect) =>
        effect.condition === "Vulnerability" &&
        effect.stacks === 8 &&
        effect.duration === 8,
    ),
  );

  const overcharged = skill("Overcharged Shot");
  assert.equal(overcharged.cooldown, 14);
  assert.equal(overcharged.effects[0].coefficient, 1);
  assert.equal(overcharged.effects[1].metadata.controlKind, "launch");

  const result = simulate("Mechanist", ["Rifle Burst"], {
    boons: { quickness: true },
  });
  assert.deepEqual(
    result.events
      .filter(
        (event) =>
          event.type === "damage" &&
          ["Rifle Burst", "Rifle Burst Grenade"].includes(event.name),
      )
      .map((event) => [event.name, event.at, event.coefficient]),
    [
      ["Rifle Burst", 0.318, 0.6],
      ["Rifle Burst Grenade", 0.602, 0.8],
    ],
  );
});

test("Engineer hammer skills use the requested packets and field cadence", () => {
  const skill = (name) => engineerCatalog.skillsByName.get(name);
  assert.equal(skill("Positive Strike").quicknessCastTimeMs, 480);
  assert.equal(skill("Positive Strike").effects[0].coefficient, 0.7);
  assert.deepEqual(skill("Positive Strike").effects[1], {
    type: "boon",
    boon: "might",
    duration: 8,
    stacks: 1,
    atMs: 360,
    timingAnchor: "castStart",
    timingScale: "fixed",
  });
  assert.equal(skill("Negative Bash").quicknessCastTimeMs, 640);
  assert.equal(skill("Negative Bash").effects[0].coefficient, 1);
  assert.equal(skill("Negative Bash").effects[1].duration, 8);
  assert.equal(skill("Equalizing Blow").quicknessCastTimeMs, 440);
  assert.equal(skill("Equalizing Blow").effects[0].coefficient, 1.4);
  assert.equal(skill("Equalizing Blow").effects[1].stacks, 3);
  assert.equal(skill("Equalizing Blow").effects[2].stacks, 3);

  const electro = skill("Electro-whirl");
  assert.equal(electro.cooldown, 6);
  assert.equal(electro.effects[0].coefficient, 3);
  assert.equal(electro.effects[0].hits, 2);
  assert.equal(electro.effects[0].metadata.damageKind, "explosion");
  assert.equal(electro.comboFinishers[0].finisherType, "Whirl");

  const rocket = skill("Rocket Charge");
  assert.equal(rocket.castTimeMs, 1920);
  assert.equal(rocket.quicknessCastTimeMs, undefined);
  assert.equal(rocket.unaffectedByQuickness, true);
  assert.equal(rocket.cooldown, 12);
  assert.deepEqual(rocket.effects[0].ticks, [
    { atMs: 640, coefficient: 1.2 },
    { atMs: 1240, coefficient: 1.2 },
    { atMs: 1920, coefficient: 1.2 },
  ]);

  const hammerTiming = simulate(
    "Core",
    ["Positive Strike", "Negative Bash", "Equalizing Blow", "Rocket Charge"],
    { boons: { quickness: true } },
  );
  assert.deepEqual(
    hammerTiming.steps.map((step) => step.end - step.start),
    [480, 640, 440, 1920],
  );
  assert.deepEqual(
    hammerTiming.events
      .filter(
        (event) =>
          event.type === "damage" &&
          [
            "Positive Strike",
            "Negative Bash",
            "Equalizing Blow",
            "Rocket Charge",
          ].includes(event.name),
      )
      .map((event) => [event.name, Number(event.at.toFixed(2))]),
    [
      ["Positive Strike", 0.36],
      ["Negative Bash", 0.8],
      ["Equalizing Blow", 1.44],
      ["Rocket Charge", 2.2],
      ["Rocket Charge", 2.8],
      ["Rocket Charge", 3.48],
    ],
  );

  const shield = skill("Shock Shield");
  assert.equal(shield.cooldown, 18);
  assert.equal(shield.blockDuration, 2);
  assert.equal(shield.effects[0].coefficient, 1.25);
  assert.equal(shield.effects[0].hits, 5);
  assert.equal(shield.effects[1].stacks, 10);
  assert.equal(shield.effects[1].duration, 5);

  const thunder = simulate("Core", [
    "Thunderclap",
    { type: "wait", durationMs: 5000 },
  ]);
  const thunderDamage = thunder.events.filter(
    (event) => event.type === "damage" && event.name === "Thunderclap",
  );
  const thunderVulnerability = thunder.events.filter(
    (event) =>
      event.type === "condition" &&
      event.name === "Thunderclap — Vulnerability",
  );
  const thunderControl = thunder.events.find(
    (event) => event.type === "control" && event.skillName === "Thunderclap",
  );
  assert.deepEqual(
    thunderDamage.map((event) => event.at),
    [1.75, 2.75, 3.75, 4.75, 5.75],
  );
  assert.ok(thunderDamage.every((event) => event.coefficient === 0.8));
  assert.equal(thunderVulnerability.length, 5);
  assert.ok(
    thunderVulnerability.every(
      (event) => event.stacks === 1 && event.duration === 8,
    ),
  );
  assert.equal(thunderControl.at, 0.75);
  assert.equal(thunderControl.controlKind, "stun");
  assert.equal(skill("Thunderclap").comboFields[0].fieldType, "Lightning");

  const quickThunder = simulate(
    "Core",
    ["Thunderclap", { type: "wait", durationMs: 5000 }],
    { boons: { quickness: true } },
  );
  assert.equal(quickThunder.steps[0].end, 520);
  assert.deepEqual(
    quickThunder.events
      .filter(
        (event) => event.type === "damage" && event.name === "Thunderclap",
      )
      .map((event) => Number(event.at.toFixed(2))),
    [1.52, 2.52, 3.52, 4.52, 5.52],
  );
});

test("Bomb Kit packets honor fuses, explosions, fields, and finishers", () => {
  const selectedSkills = [
    "Healing Turret",
    "Bomb Kit",
    "Grenade Kit",
    "Rifle Turret",
    "Supply Crate",
  ];
  const waitForBombPackets = () => ({ type: "wait", durationMs: 5000 });
  const bombSkills = engineerCatalog.skills.filter(
    (candidate) =>
      candidate.kit === "Bomb Kit" &&
      candidate.effects.some((effect) => effect.type === "strike"),
  );
  assert.ok(
    bombSkills.every((candidate) =>
      candidate.effects
        .filter((effect) => effect.type === "strike")
        .every((effect) => effect.metadata?.damageKind === "explosion"),
    ),
  );

  const bomb = simulate("Core", ["Bomb Kit", "Bomb", waitForBombPackets()], {
    selectedSkills,
  });
  const bombHit = bomb.events.find(
    (event) => event.type === "damage" && event.name === "Bomb",
  );
  assert.equal(bombHit.at, 1);
  assert.equal(bombHit.coefficient, 1.2);
  assert.equal(bombHit.damageKind, "explosion");

  const fire = simulate(
    "Core",
    ["Bomb Kit", "Fire Bomb", waitForBombPackets()],
    { selectedSkills },
  );
  const fireHits = fire.events.filter(
    (event) => event.type === "damage" && event.name === "Fire Bomb",
  );
  const fireBurns = fire.events.filter(
    (event) =>
      event.type === "condition" && event.name === "Fire Bomb — Burning",
  );
  assert.deepEqual(
    fireHits.map((event) => Number(event.at.toFixed(2))),
    [1.66, 2.66, 3.66, 4.66],
  );
  assert.ok(fireHits.every((event) => event.coefficient === 0.25));
  assert.deepEqual(
    fireBurns.map((event) => [
      Number(event.at.toFixed(2)),
      event.stacks,
      event.duration,
    ]),
    [
      [1.66, 2, 5],
      [2.66, 1, 2],
      [3.66, 1, 2],
      [4.66, 1, 2],
    ],
  );
  assert.equal(
    engineerCatalog.skillsByName.get("Fire Bomb").quicknessCastTimeMs,
    600,
  );
  assert.equal(
    engineerCatalog.skillsByName.get("Fire Bomb").interruptCommitMs,
    400,
  );
  const interruptedFire = (interruptMs) =>
    simulate(
      "Core",
      ["Bomb Kit", { name: "Fire Bomb", interruptMs }, waitForBombPackets()],
      {
        selectedSkills,
        boons: { quickness: true },
      },
    ).events.filter(
      (event) => event.type === "damage" && event.name === "Fire Bomb",
    );
  assert.equal(interruptedFire(399).length, 0);
  assert.equal(interruptedFire(400).length, 4);
  assert.equal(
    engineerCatalog.skillsByName.get("Fire Bomb").comboFields[0].fieldType,
    "Fire",
  );
  assert.equal(
    engineerCatalog.skillsByName.get("Fire Bomb").comboFields[0].duration,
    3,
  );

  const galvanic = simulate(
    "Core",
    ["Bomb Kit", "Galvanic Bomb", waitForBombPackets()],
    { selectedSkills },
  );
  assert.ok(
    galvanic.events.some(
      (event) =>
        event.type === "damage" &&
        Math.abs(event.at - 1.66) < 1e-12 &&
        event.coefficient === 2.5,
    ),
  );
  assert.ok(
    galvanic.events.some(
      (event) =>
        event.type === "condition" &&
        event.condition === "Confusion" &&
        event.stacks === 6 &&
        event.duration === 8,
    ),
  );
  assert.ok(
    galvanic.events.some(
      (event) =>
        event.type === "control" &&
        event.controlKind === "daze" &&
        event.duration === 1,
    ),
  );
  assert.equal(
    engineerCatalog.skillsByName.get("Galvanic Bomb").comboFinishers[0]
      .finisherType,
    "Blast",
  );
  assert.equal(
    engineerCatalog.skillsByName.get("Galvanic Bomb").quicknessCastTimeMs,
    600,
  );

  const magnetic = engineerCatalog.skillsByName.get("Magnetic Bomb");
  assert.equal(magnetic.effects[0].coefficient, 1.5);
  assert.equal(magnetic.effects[1].metadata.controlKind, "pull");
  assert.equal(magnetic.quicknessCastTimeMs, 600);
  const magneticResult = simulate(
    "Core",
    ["Bomb Kit", "Magnetic Bomb", waitForBombPackets()],
    {
      selectedSkills,
      boons: { quickness: true },
    },
  );
  assert.ok(
    magneticResult.events.some(
      (event) =>
        event.type === "damage" &&
        event.name === "Magnetic Bomb" &&
        Math.abs(event.at - 2.36) < 1e-12,
    ),
  );
  assert.ok(
    magneticResult.events.some(
      (event) =>
        event.type === "control" &&
        event.skillName === "Magnetic Bomb" &&
        Math.abs(event.at - 2.36) < 1e-12,
    ),
  );

  const big = simulate(
    "Core",
    ["Bomb Kit", "Big Ol' Bomb", waitForBombPackets()],
    { selectedSkills },
  );
  assert.ok(
    big.events.some(
      (event) =>
        event.type === "damage" &&
        Math.abs(event.at - 3.66) < 1e-12 &&
        event.coefficient === 3,
    ),
  );
  assert.ok(
    big.events.some(
      (event) =>
        event.type === "control" &&
        Math.abs(event.at - 3.66) < 1e-12 &&
        event.controlKind === "knockdown",
    ),
  );
  assert.equal(
    engineerCatalog.skillsByName.get("Big Ol' Bomb").comboFinishers[0]
      .successfulCombos,
    2,
  );
  assert.equal(
    engineerCatalog.skillsByName.get("Big Ol' Bomb").quicknessCastTimeMs,
    600,
  );

  const quickDamageTimes = (name) =>
    simulate("Core", ["Bomb Kit", name, waitForBombPackets()], {
      selectedSkills,
      boons: { quickness: true },
    })
      .events.filter((event) => event.type === "damage" && event.name === name)
      .map((event) => Number(event.at.toFixed(2)));
  assert.deepEqual(quickDamageTimes("Fire Bomb"), [1.36, 2.36, 3.36, 4.36]);
  assert.deepEqual(quickDamageTimes("Galvanic Bomb"), [1.36]);
  assert.deepEqual(quickDamageTimes("Magnetic Bomb"), [2.36]);
  assert.deepEqual(quickDamageTimes("Big Ol' Bomb"), [3.36]);

  const doubleBlast = simulate(
    "Core",
    [
      "Bomb Kit",
      "Big Ol' Bomb",
      "Fire Bomb",
      "Galvanic Bomb",
      "Stow Bomb Kit",
      "Glue Shot",
      { type: "wait", durationMs: 5000 },
    ],
    {
      selectedSkills,
      weapons: ["Pistol", "Pistol"],
      relic: "Bloodstone",
    },
  );
  assert.ok(
    doubleBlast.resolvedEvents.some(
      (event) =>
        event.type === "damage" && event.name === "Bloodstone Explosion",
    ),
  );
  assert.ok(
    doubleBlast.procSteps.some(
      (step) =>
        step.skill === "Relic of Bloodstone" &&
        step.sourceSkill === "Big Ol' Bomb",
    ),
  );

  const unboundBlasts = simulate(
    "Core",
    [
      "Bomb Kit",
      "Big Ol' Bomb",
      "Galvanic Bomb",
      { type: "wait", durationMs: 5000 },
    ],
    { selectedSkills, relic: "Bloodstone" },
  );
  assert.equal(
    unboundBlasts.procSteps.some(
      (step) =>
        step.skill === "Bloodstone Volatility" ||
        step.skill === "Relic of Bloodstone",
    ),
    false,
  );
});

test("Grenade Kit emits three explosive grenade packets", () => {
  const profiles = [
    ["Grenade", 0, 0.33, null],
    ["Shrapnel Grenade", 5, 0.63, "Bleeding"],
    ["Flash Grenade", 10, 0.1, "Blind"],
    ["Freeze Grenade", 20, 0.75, "Chilled"],
    ["Poison Grenade", 20, 0.75, "Poisoned"],
  ];
  for (const [name, cooldown, coefficient, secondary] of profiles) {
    const candidate = engineerCatalog.skillsByName.get(name);
    const strike = candidate.effects.find((effect) => effect.type === "strike");
    assert.equal(candidate.cooldown, cooldown, name);
    const packetCoefficients = strike.ticks
      ? strike.ticks.map((packet) => packet.coefficient)
      : Array(strike.hits).fill(strike.coefficient / strike.hits);
    assert.equal(packetCoefficients.length, 3, name);
    assert.ok(
      packetCoefficients.every(
        (packetCoefficient) =>
          Math.abs(packetCoefficient - coefficient) < 1e-12,
      ),
      name,
    );
    assert.equal(strike.metadata.damageKind, "explosion", name);
    if (secondary === "Blind") {
      assert.equal(
        candidate.effects.find((effect) => effect.type === "blind").metadata
          .duration,
        5,
      );
    } else if (secondary) {
      assert.ok(
        candidate.effects[1].ticks.every(
          (packet) => packet.condition === secondary,
        ),
        name,
      );
    }
  }
  const shrapnel = engineerCatalog.skillsByName.get("Shrapnel Grenade");
  assert.equal(
    shrapnel.effects[1].ticks.reduce(
      (total, packet) => total + packet.stacks,
      0,
    ),
    3,
  );
  assert.ok(shrapnel.effects[1].ticks.every((packet) => packet.duration === 7));

  const result = simulate("Core", ["Grenade Kit", "Shrapnel Grenade"]);
  const packets = result.events.filter(
    (event) => event.type === "damage" && event.name === "Shrapnel Grenade",
  );
  assert.equal(packets.length, 3);
  assert.ok(
    packets.every(
      (event) =>
        Math.abs(event.coefficient - 0.63) < 1e-12 &&
        event.damageKind === "explosion",
    ),
  );
  assert.deepEqual(
    packets.map((event) => event.at),
    [0.4, 0.44, 0.44],
  );
  const bleeding = result.events.filter(
    (event) =>
      event.type === "condition" && event.skillName === "Shrapnel Grenade",
  );
  assert.deepEqual(
    bleeding.map((event) => [event.at, event.stacks, event.duration]),
    [
      [0.4, 1, 7],
      [0.44, 1, 7],
      [0.44, 1, 7],
    ],
  );

  const grenade = simulate("Core", ["Grenade Kit", "Grenade"]);
  assert.deepEqual(
    grenade.events
      .filter((event) => event.type === "damage" && event.name === "Grenade")
      .map((event) => [event.at, event.coefficient]),
    [
      [0.4, 0.33],
      [0.44, 0.33],
      [0.44, 0.33],
    ],
  );
  const cancelled = simulate("Core", [
    "Grenade Kit",
    { name: "Grenade", interruptMs: 281 },
  ]);
  assert.equal(
    cancelled.events.some(
      (event) => event.type === "damage" && event.name === "Grenade",
    ),
    false,
  );
});

test("Shred fires three Burning Bolts through Stoke the Flames", () => {
  const stoke = engineerCatalog.skillsByName.get("Stoke the Flames");
  const shred = engineerCatalog.skillsById.get(77103);
  assert.equal(stoke.comboFields[0].fieldType, "Fire");
  assert.equal(stoke.comboFields[0].duration, 1);
  assert.equal(shred.comboFinishers[0].finisherType, "Projectile");
  assert.equal(shred.comboFinishers[0].chance, 1);

  const config = {
    boons: { quickness: true },
    selectedSkills: [
      "Healing Turret",
      "Grenade Kit",
      "Flamethrower",
      "Rifle Turret",
      "Supply Crate",
    ],
    selectedMorphSkillIds: [77103, 77104, 76705],
  };
  const result = simulate(
    "Amalgam",
    [
      "Flamethrower",
      "Stoke the Flames",
      { name: "Offensive Protocol: Shred", skillId: 77103 },
    ],
    config,
  );
  const combos = result.resolvedEvents.filter(
    (event) =>
      event.type === "combo" &&
      event.skillName === "Offensive Protocol: Shred" &&
      event.fieldType === "Fire" &&
      event.finisherType === "Projectile",
  );
  assert.equal(combos.length, 3);
  assert.ok(
    combos.every(
      (event) =>
        event.outcome.condition === "Burning" &&
        event.outcome.stacks === 1 &&
        event.outcome.duration === 1,
    ),
  );

  const withoutField = simulate(
    "Amalgam",
    [{ name: "Offensive Protocol: Shred", skillId: 77103 }],
    config,
  );
  assert.equal(
    withoutField.resolvedEvents.some(
      (event) =>
        event.type === "combo" &&
        event.skillName === "Offensive Protocol: Shred",
    ),
    false,
  );
});

test("measured Quickness animations and Flame Blast cancellation drive steps", () => {
  const grenades = simulate("Amalgam", ["Grenade Kit", "Shrapnel Grenade"], {
    boons: { quickness: true },
    selectedMorphSkillIds: [77103, 77104, 76705],
  });
  const shrapnel = grenades.steps.find(
    (step) => step.skill === "Shrapnel Grenade",
  );
  assert.equal(shrapnel.end - shrapnel.start, 680);

  const flamethrower = simulate(
    "Amalgam",
    [
      "Flamethrower",
      { name: "Flame Blast", interruptAfterMs: 480 },
      { type: "wait", durationMs: 500 },
    ],
    {
      boons: { quickness: true },
      selectedSkills: [
        "Healing Turret",
        "Grenade Kit",
        "Flamethrower",
        "Rifle Turret",
        "Supply Crate",
      ],
      selectedMorphSkillIds: [77103, 77104, 76705],
    },
  );
  const flameBlast = flamethrower.steps.find(
    (step) => step.skill === "Flame Blast",
  );
  assert.equal(flameBlast.end - flameBlast.start, 480);
  assert.equal(flameBlast.fullCastMs, 800);
  assert.equal(flameBlast.interrupted, true);
  assert.equal(
    flamethrower.resolvedEvents.filter(
      (event) => event.type === "damage" && event.name === "Flame Blast",
    ).length,
    1,
  );

  const full = simulate("Amalgam", ["Flamethrower", "Flame Blast"], {
    boons: { quickness: true },
    selectedSkills: [
      "Healing Turret",
      "Grenade Kit",
      "Flamethrower",
      "Rifle Turret",
      "Supply Crate",
    ],
    selectedMorphSkillIds: [77103, 77104, 76705],
  });
  const fullFlameBlast = full.steps.find(
    (step) => step.skill === "Flame Blast",
  );
  assert.equal(fullFlameBlast.end - fullFlameBlast.start, 800);
  assert.equal(fullFlameBlast.interrupted, false);

  const demolish = simulate("Amalgam", [76927], {
    boons: { quickness: true },
    selectedMorphSkillIds: [76927, 77104, 76705],
  });
  const demolishStep = demolish.steps.find(
    (step) => step.skill === "Offensive Protocol: Demolish",
  );
  assert.equal(demolishStep.end - demolishStep.start, 1000 + 560);
  const smash = demolish.resolvedEvents.find(
    (event) => event.type === "damage" && event.name === "Smash Damage",
  );
  assert.equal(Math.round((smash.at - demolishStep.start / 1000) * 1000), 1560);
});

test("Flame Jet gains ten percent strike damage against burning targets", () => {
  const config = {
    selectedSkills: [
      "Healing Turret",
      "Grenade Kit",
      "Flamethrower",
      "Rifle Turret",
      "Supply Crate",
    ],
    selectedMorphSkillIds: [77103, 77104, 76705],
  };
  const withoutBurning = simulate("Amalgam", ["Flamethrower", "Flame Jet"], {
    ...config,
    target: { conditions: { Vulnerability: 25 } },
  });
  const withBurning = simulate("Amalgam", ["Flamethrower", "Flame Jet"], {
    ...config,
    target: { conditions: { Vulnerability: 25, Burning: 1 } },
  });
  const firstPacket = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === "damage" && event.name === "Flame Jet",
    );
  assert.ok(
    Math.abs(
      firstPacket(withBurning).damage / firstPacket(withoutBurning).damage -
        1.1,
    ) < 1e-12,
  );
});

test("Engineer spear focus selects one branch and Lightning Rod pulses eight times", () => {
  const focused = simulate(
    "Amalgam",
    [
      "Conduit Surge",
      "Lightning Rod",
      "Electric Artillery",
      { type: "wait", durationMs: 4000 },
    ],
    {
      selectedMorphSkillIds: [77103, 77104, 76705],
    },
  );
  assert.equal(focused.warnings.length, 0);
  const lightning = focused.resolvedEvents.filter(
    (event) => event.type === "damage" && event.name === "Lightning Rod",
  );
  assert.equal(lightning.length, 8);
  assert.ok(lightning.every((event) => event.coefficient === 0.3));
  assert.deepEqual(
    lightning
      .slice(1)
      .map((event, index) =>
        Number((event.at - lightning[index].at).toFixed(3)),
      ),
    Array(7).fill(0.5),
  );
  const rodStep = focused.steps.find((step) => step.skill === "Lightning Rod");
  const artilleryStep = focused.steps.find(
    (step) => step.skill === "Electric Artillery",
  );
  assert.equal(artilleryStep.start - rodStep.start, 4200);
  assert.equal(
    focused.events.find((event) => event.type === "engineer.electric-artillery")
      .charges,
    8,
  );
  const immobilize = focused.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Lightning Rod" &&
      event.condition === "Immobilized",
  );
  assert.equal(immobilize.length, 1);
  assert.equal(immobilize[0].duration, 2);
  assert.equal(
    focused.resolvedEvents.filter(
      (event) => event.type === "damage" && event.name === "Conduit Surge",
    ).length,
    1,
  );
  assert.equal(
    focused.resolvedEvents.filter(
      (event) => event.type === "damage" && event.name === "Electric Artillery",
    ).length,
    1,
  );
  const artilleryBurn = focused.resolvedEvents.find(
    (event) =>
      event.type === "condition" &&
      event.name === "Electric Artillery — Burning",
  );
  assert.equal(artilleryBurn.stacks, 2);
  assert.equal(artilleryBurn.duration, 7);

  const unfocused = simulate(
    "Amalgam",
    ["Lightning Rod", "Electric Artillery"],
    {
      selectedMorphSkillIds: [77103, 77104, 76705],
    },
  );
  const unfocusedHits = unfocused.resolvedEvents.filter(
    (event) => event.type === "damage" && event.name === "Lightning Rod",
  );
  assert.equal(unfocusedHits.length, 8);
  assert.ok(unfocusedHits.every((event) => event.coefficient === 0.17));
  assert.equal(
    unfocused.resolvedEvents.find(
      (event) => event.type === "damage" && event.name === "Electric Artillery",
    ).coefficient,
    1,
  );
  assert.equal(
    unfocused.resolvedEvents.find(
      (event) =>
        event.type === "condition" &&
        event.skillName === "Electric Artillery" &&
        event.condition === "Burning",
    ).duration,
    5,
  );
  assert.deepEqual(
    unfocused.endState.profession.lightningRodChargeExpiries,
    [],
  );
  assert.equal(unfocused.endState.profession.electricArtilleryAvailable, false);
});

test("Electric Artillery is unavailable until Lightning Rod creates its flip", () => {
  const result = simulate("Amalgam", ["Electric Artillery"], {
    selectedMorphSkillIds: [77103, 77104, 76705],
  });
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Lightning Rod has not finished charging/);
  assert.equal(
    result.resolvedEvents.some(
      (event) => event.type === "damage" && event.name === "Electric Artillery",
    ),
    false,
  );
});

test("Lightning Rod exposes Electric Artillery after charging", () => {
  const charging = simulate("Amalgam", ["Lightning Rod"], {
    selectedMorphSkillIds: [77103, 77104, 76705],
  });
  const charged = simulate(
    "Amalgam",
    ["Lightning Rod", { type: "wait", durationMs: 4000 }],
    {
      selectedMorphSkillIds: [77103, 77104, 76705],
    },
  );
  const chargingContext = {
    professionState: charging.endState.profession,
    time: charging.duration,
  };
  const chargedContext = {
    professionState: charged.endState.profession,
    time: charged.duration,
  };
  const rod = engineerCatalog.skillsByName.get("Lightning Rod");
  const artillery = engineerCatalog.skillsByName.get("Electric Artillery");
  assert.equal(
    engineerProfession.ui.isPaletteSkillAvailable(chargingContext, rod),
    false,
  );
  assert.equal(
    engineerProfession.ui.isPaletteSkillAvailable(chargingContext, artillery),
    false,
  );
  assert.equal(
    engineerProfession.ui.isPaletteSkillAvailable(chargedContext, artillery),
    true,
  );
  assert.equal(
    charging.endState.profession.availableFlips[artillery.id],
    false,
  );
  assert.equal(charged.endState.profession.availableFlips[artillery.id], true);
});

test("Roiling Skies changes control branch with focus and always cripples", () => {
  const unfocused = simulate("Amalgam", ["Roiling Skies"], {
    selectedMorphSkillIds: [77103, 77104, 76705],
  });
  const focused = simulate("Amalgam", ["Conduit Surge", "Roiling Skies"], {
    selectedMorphSkillIds: [77103, 77104, 76705],
  });
  assert.equal(
    unfocused.events.find(
      (event) =>
        event.type === "control" && event.skillName === "Roiling Skies",
    ).controlKind,
    "stun",
  );
  assert.equal(
    focused.events.find(
      (event) =>
        event.type === "control" && event.skillName === "Roiling Skies",
    ).controlKind,
    "launch",
  );
  assert.equal(
    focused.resolvedEvents.find(
      (event) =>
        event.type === "condition" &&
        event.skillName === "Roiling Skies" &&
        event.condition === "Crippled",
    ).duration,
    5,
  );
});

test("focused Devastator completes its full cast and triggers six hits", () => {
  const result = simulate(
    "Amalgam",
    ["Conduit Surge", "Devastator", { type: "wait", durationMs: 2000 }],
    {
      selectedMorphSkillIds: [77103, 77104, 76705],
    },
  );
  assert.equal(result.warnings.length, 0);
  assert.equal(
    result.steps.find((step) => step.skill === "Devastator").end -
      result.steps.find((step) => step.skill === "Devastator").start,
    1000,
  );
  assert.equal(
    result.resolvedEvents.filter(
      (event) => event.type === "damage" && event.name === "Devastator",
    ).length,
    1,
  );
  const focused = result.resolvedEvents.filter(
    (event) => event.type === "damage" && event.name === "Focused Devastation",
  );
  assert.equal(focused.length, 6);
  assert.ok(focused.every((event) => event.coefficient === 0.2));
  assert.ok(focused.every((event) => event.skillId === 73064));
  assert.ok(focused.every((event) => event.sourceId === 73064));
  assert.equal(new Set(focused.map((event) => event.activationId)).size, 1);
  assert.notEqual(
    focused[0].activationId,
    result.resolvedEvents.find((event) => event.name === "Devastator")
      .activationId,
  );
  assert.ok(
    focused.every(
      (event) =>
        event.weaponStrengthProfileId === "nonweapon.unequipped" &&
        event.resolvedWeaponStrength === 690.5,
    ),
  );
  assert.ok(
    result.resolvedEvents
      .filter((event) => event.name === "Devastator")
      .every((event) => event.skillId === 72974),
  );
  assert.equal(
    result.resolvedEvents.filter(
      (event) =>
        event.type === "condition" &&
        event.name === "Focused Devastation — Burning",
    ).length,
    6,
  );
  assert.ok(
    result.resolvedEvents
      .filter(
        (event) =>
          event.type === "condition" &&
          event.name === "Focused Devastation — Burning",
      )
      .every((event) => event.skillId === 73064 && event.sourceId === 73064),
  );
  assert.equal(
    result.breakdown.find((entry) => entry.name === "Devastator").skillId,
    72974,
  );
  assert.equal(
    result.breakdown.find((entry) => entry.name === "Focused Devastation")
      .skillId,
    73064,
  );

  const stochastic = simulate(
    "Amalgam",
    ["Conduit Surge", "Devastator", { type: "wait", durationMs: 2000 }],
    {
      selectedMorphSkillIds: [77103, 77104, 76705],
      randomness: { mode: "stochastic", seed: 73064 },
    },
  );
  const stochasticStrengths = new Set(
    stochastic.resolvedEvents
      .filter(
        (event) =>
          event.type === "damage" && event.name === "Focused Devastation",
      )
      .map((event) => event.resolvedWeaponStrength),
  );
  assert.equal(stochasticStrengths.size, 1);
  assert.ok([...stochasticStrengths][0] >= 656);
  assert.ok([...stochasticStrengths][0] < 725);
});

test("benchmark Amalgam traits activate on morph and Evolve chronology", () => {
  const result = simulate(
    "Amalgam",
    [77103, 77104, 76705, "Evolve", "Grenade Kit", "Shrapnel Grenade"],
    {
      selectedSkills: [
        "Healing Turret",
        "Grenade Kit",
        "Flamethrower",
        "Plasmatic State",
        "Flux State",
      ],
      selectedMorphSkillIds: [77103, 77104, 76705],
      selectedTraitIds: [
        TRAIT.WILLING_HOST,
        TRAIT.HARDENED_CHROME,
        TRAIT.CARBOLIC_COMPOSITION,
        TRAIT.NEW_GENES,
      ],
    },
  );
  assert.equal(result.warnings.length, 0);
  assert.ok(result.profession.willingHostUntil > 0);
  assert.ok(result.profession.evolvedUntil > 0);
  assert.equal(
    result.profession.rapaciousUntil,
    result.profession.evolvedUntil,
  );
  assert.equal(result.profession.predatorUntil, result.profession.evolvedUntil);
  assert.equal(result.profession.titanicUntil, result.profession.evolvedUntil);
  assert.equal(
    result.events.filter(
      (event) =>
        event.type === "buff" &&
        event.kind === "alacrity" &&
        event.skillName === "New Genes",
    ).length,
    3,
  );
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.type === "damage" && event.name === "Rapacious Strain",
    ),
  );
  assert.ok(
    result.resolvedEvents.some(
      (event) =>
        event.type === "condition" &&
        event.name === "Carbolic Composition — Poisoned",
    ),
  );
});

test("Evolve raises attributes by ten percent for eight seconds", () => {
  const neutralMorphs = [76815, 77285, 77358];
  const config = {
    selectedMorphSkillIds: neutralMorphs,
    stats: {
      power: 2000,
      precision: 0,
      ferocity: 0,
      conditionDamage: 1000,
    },
  };
  const baseline = simulate(
    "Amalgam",
    [{ type: "wait", durationMs: 750 }, "Puncturing Jab"],
    config,
  );
  const evolved = simulate("Amalgam", ["Evolve", "Puncturing Jab"], config);
  const puncture = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === "damage" && event.name === "Puncturing Jab",
    );
  assert.ok(
    Math.abs(puncture(evolved).damage / puncture(baseline).damage - 1.1) <
      1e-12,
  );
  assert.equal(evolved.endState.profession.evolvedUntil, 8.78);
});

test("Evolve cannot raise condition duration above the global cap", () => {
  const result = simulate(
    "Amalgam",
    [
      "Evolve",
      "Grenade Kit",
      "Shrapnel Grenade",
      { type: "wait", durationMs: 13000 },
    ],
    {
      selectedSkills: [
        "Healing Turret",
        "Grenade Kit",
        "Flamethrower",
        "Bomb Kit",
        "Flux State",
      ],
      selectedMorphSkillIds: [77103, 77104, 76705],
      selectedTraitIds: [TRAIT.SERRATED_STEEL],
      stats: { expertise: 1500 },
      target: { conditions: {} },
    },
  );
  const directBleeds = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Shrapnel Grenade" &&
      event.condition === "Bleeding",
  );

  assert.equal(directBleeds.length, 3);
  assert.ok(
    directBleeds.every(
      (event) => Math.abs(event.effectiveDuration - 14) < 1e-12,
    ),
  );
});

test("Evolve grants each selected protocol strain without leaking it to casts", () => {
  const result = simulate("Amalgam", ["Evolve"], {
    selectedMorphSkillIds: [77103, 77203, 76954],
  });
  const berserker = result.events.find(
    (event) =>
      event.type === "buff" &&
      event.skillName === "Berserker Strain" &&
      event.kind === "stability",
  );
  assert.equal(berserker.stacks, 5);
  assert.equal(berserker.duration, 8);
  assert.equal(
    result.endState.profession.berserkerUntil,
    result.endState.profession.evolvedUntil,
  );

  const demolish = simulate("Amalgam", [76954], {
    selectedMorphSkillIds: [77103, 77203, 76954],
  });
  assert.equal(
    demolish.events.some(
      (event) => event.type === "buff" && event.kind === "stability",
    ),
    false,
  );
});

test("Hardened Chrome and New Genes grant the requested morph boons", () => {
  const protocols = [
    [76959, "protection", 4, 1],
    [76798, "aegis", 4, 1],
    [77163, "stability", 4, 2],
    [76815, "vigor", 4, 1],
    [76806, "might", 12, 5],
    [77103, "fury", 6, 1],
    [76927, "swiftness", 6, 1],
  ];
  const defaults = new Map([
    [2, 77103],
    [3, 77203],
    [4, 76954],
  ]);

  for (const [skillId, kind, duration, stacks] of protocols) {
    const skill = engineerCatalog.skillsById.get(skillId);
    const selected = new Map(defaults);
    selected.set(Number(skill.mechanicSlot), skillId);
    const result = simulate("Amalgam", [skillId], {
      selectedMorphSkillIds: [...selected.values()],
      selectedTraitIds: [TRAIT.HARDENED_CHROME, TRAIT.NEW_GENES],
    });
    const hardened = result.events.find(
      (event) =>
        event.type === "buff" && event.sourceId === TRAIT.HARDENED_CHROME,
    );
    assert.equal(hardened.kind, "protection");
    assert.equal(hardened.duration, 2.5);

    const newGenes = result.events.filter(
      (event) => event.type === "buff" && event.sourceId === TRAIT.NEW_GENES,
    );
    assert.ok(
      newGenes.some(
        (event) =>
          event.kind === "alacrity" &&
          event.duration === 5 &&
          event.stacks === 1,
      ),
    );
    assert.ok(
      newGenes.some(
        (event) =>
          event.kind === "might" && event.duration === 12 && event.stacks === 4,
      ),
    );
    assert.ok(
      newGenes.some(
        (event) =>
          event.kind === kind &&
          event.duration === duration &&
          event.stacks === stacks,
      ),
    );
  }

  const evolve = simulate("Amalgam", ["Evolve"], {
    selectedTraitIds: [TRAIT.HARDENED_CHROME],
  });
  const protection = evolve.events.find(
    (event) =>
      event.type === "buff" && event.sourceId === TRAIT.HARDENED_CHROME,
  );
  assert.equal(protection.duration, 4);
});

test("Carbolic Composition poisons only Amalgam skill hits", () => {
  const result = simulate("Amalgam", [77103, "Puncturing Jab"], {
    selectedMorphSkillIds: [77103, 77203, 76954],
    selectedTraitIds: [TRAIT.CARBOLIC_COMPOSITION],
    target: { conditions: {} },
  });
  const poison = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" && event.skillName === "Carbolic Composition",
  );
  assert.equal(poison.length, 3);
  assert.ok(
    poison.every(
      (event) =>
        event.triggeredBy === "Offensive Protocol: Shred" &&
        Math.abs(event.naturalExpiresAt - event.at - 3.99) < 1e-12,
    ),
  );
  assert.equal(
    poison.some((event) => event.triggeredBy === "Puncturing Jab"),
    false,
  );

  const strain = simulate("Amalgam", ["Evolve", "Puncturing Jab"], {
    selectedMorphSkillIds: [77103, 77104, 76705],
    selectedTraitIds: [TRAIT.CARBOLIC_COMPOSITION],
    stats: { precision: 4000, ferocity: 0 },
    target: { conditions: {} },
  });
  const rapacious = strain.resolvedEvents.find(
    (event) => event.type === "damage" && event.name === "Rapacious Strain",
  );
  assert.equal(rapacious.criticalChance, 1);
  assert.ok(
    strain.resolvedEvents.some(
      (event) =>
        event.type === "condition" &&
        event.skillName === "Carbolic Composition" &&
        event.triggeredBy === "Rapacious Strain",
    ),
  );

  const inherited = simulate(
    "Amalgam",
    ["Flux State", { type: "wait", durationMs: 7000 }],
    {
      selectedTraitIds: [TRAIT.CARBOLIC_COMPOSITION, TRAIT.EXPLOSIVE_ENTRANCE],
      target: { conditions: {} },
    },
  );
  assert.equal(
    inherited.resolvedEvents.some(
      (event) =>
        event.type === "condition" &&
        event.skillName === "Carbolic Composition" &&
        event.triggeredBy === "Explosive Entrance",
    ),
    false,
  );
});

test("Silver Lining moves strain activation from Evolve to each morph", () => {
  const selectedMorphSkillIds = [76959, 76866, 76954];
  const baseMorph = simulate("Amalgam", [76959], {
    selectedMorphSkillIds,
  });
  assert.equal(
    baseMorph.events.some(
      (event) =>
        event.type === "buff" && event.skillName === "Resiliant Strain",
    ),
    false,
  );

  const baseEvolve = simulate("Amalgam", ["Evolve"], {
    selectedMorphSkillIds,
  });
  assert.ok(
    baseEvolve.events.some(
      (event) =>
        event.type === "buff" &&
        event.skillName === "Resiliant Strain" &&
        event.kind === "resistance" &&
        event.duration === 8,
    ),
  );

  const silverMorph = simulate("Amalgam", [76959], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SILVER_LINING],
  });
  assert.ok(
    silverMorph.events.some(
      (event) =>
        event.type === "buff" &&
        event.skillName === "Resiliant Strain" &&
        event.kind === "resistance" &&
        event.duration === 8,
    ),
  );

  const silverEvolve = simulate("Amalgam", ["Evolve"], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SILVER_LINING],
  });
  assert.equal(
    silverEvolve.events.some(
      (event) =>
        event.type === "buff" &&
        ["Resiliant Strain", "Predator Strain", "Berserker Strain"].includes(
          event.skillName,
        ),
    ),
    false,
  );
});

test("Mercurial Tendencies reduces Evolve once per quarter-second", () => {
  const selectedMorphSkillIds = [76815, 76866, 76954];
  const baseline = simulate("Amalgam", ["Evolve", 76815, "Evolve"], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SILVER_LINING],
  });
  const reduced = simulate("Amalgam", ["Evolve", 76815, "Evolve"], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SILVER_LINING, TRAIT.MERCURIAL_TENDENCIES],
  });
  const evolveStart = (result) =>
    result.steps.filter((step) => step.skill === "Evolve")[1].start;
  assert.equal(evolveStart(baseline) - evolveStart(reduced), 2500);
  const procs = reduced.events.filter(
    (event) => event.type === "proc" && event.name === "Mercurial Tendencies",
  );
  assert.equal(procs.length, 1);
  assert.equal(procs[0].cooldownReduction, 2.5);
});

test("Willing Host and Symbiotic Synergy apply their damage windows", () => {
  const selectedMorphSkillIds = [76815, 76866, 76954];
  const baselineMorph = simulate("Amalgam", [76815], {
    selectedMorphSkillIds,
    target: { conditions: {} },
  });
  const symbioticMorph = simulate("Amalgam", [76815], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SYMBIOTIC_SYNERGY],
    target: { conditions: {} },
  });
  const pierceDamage = (result) =>
    result.resolvedEvents.find(
      (event) =>
        event.type === "damage" && event.name === "Offensive Protocol: Pierce",
    ).damage;
  assert.ok(
    Math.abs(
      pierceDamage(symbioticMorph) / pierceDamage(baselineMorph) - 1.33,
    ) < 1e-12,
  );

  const baselineFollowup = simulate("Amalgam", [76815, "Puncturing Jab"], {
    selectedMorphSkillIds,
    target: { conditions: {} },
  });
  const willingFollowup = simulate("Amalgam", [76815, "Puncturing Jab"], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.WILLING_HOST],
    target: { conditions: {} },
  });
  const punctureDamage = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === "damage" && event.name === "Puncturing Jab",
    ).damage;
  assert.ok(
    Math.abs(
      punctureDamage(willingFollowup) / punctureDamage(baselineFollowup) - 1.05,
    ) < 1e-12,
  );

  const reset = simulate("Amalgam", [76815, "Evolve", 76815], {
    selectedMorphSkillIds,
    selectedTraitIds: [TRAIT.SYMBIOTIC_SYNERGY],
  });
  const morphSteps = reset.steps.filter(
    (step) => step.skill === "Offensive Protocol: Pierce",
  );
  const evolveStep = reset.steps.find((step) => step.skill === "Evolve");
  assert.equal(morphSteps[1].start, evolveStep.end);
});

test("Double Helix gives Evolve two charges and doubles its attribute bonus", () => {
  const config = {
    selectedMorphSkillIds: [76815, 77285, 77358],
    selectedTraitIds: [TRAIT.DOUBLE_HELIX],
    stats: {
      power: 2000,
      precision: 0,
      ferocity: 0,
      conditionDamage: 1000,
    },
    target: { conditions: {} },
  };
  const charges = simulate("Amalgam", ["Evolve", "Evolve"], config);
  const evolveSteps = charges.steps.filter((step) => step.skill === "Evolve");
  assert.equal(evolveSteps.length, 2);
  assert.equal(evolveSteps[1].start, evolveSteps[0].end);

  const baseline = simulate(
    "Amalgam",
    [{ type: "wait", durationMs: 750 }, "Puncturing Jab"],
    config,
  );
  const evolved = simulate("Amalgam", ["Evolve", "Puncturing Jab"], config);
  const puncture = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === "damage" && event.name === "Puncturing Jab",
    );
  assert.ok(
    Math.abs(puncture(evolved).damage / puncture(baseline).damage - 1.2) <
      1e-12,
  );
});

test("Thorns damaging-field assumption creates six one-second retaliations", () => {
  const selectedMorphSkillIds = [77103, 77104, 76705];
  const inactive = simulate("Amalgam", [77104], {
    selectedMorphSkillIds,
  });
  assert.equal(
    inactive.resolvedEvents.some(
      (event) => event.type === "damage" && event.name === "Thorns Retaliation",
    ),
    false,
  );

  const active = simulate(
    "Amalgam",
    ["Evolve", 77104],
    {
      selectedMorphSkillIds,
      professionAssumptions: { inDamagingField: true },
    },
    observationTail(6000),
  );
  const retaliation = active.resolvedEvents.filter(
    (event) => event.type === "damage" && event.name === "Thorns Retaliation",
  );
  assert.equal(retaliation.length, 6);
  assert.ok(retaliation.every((event) => event.coefficient === 0.5));
  assert.deepEqual(
    retaliation
      .slice(1)
      .map((event, index) =>
        Number((event.at - retaliation[index].at).toFixed(3)),
      ),
    Array(5).fill(1),
  );
  assert.equal(
    active.resolvedEvents.filter(
      (event) => event.type === "damage" && event.name === "Rapacious Strain",
    ).length,
    6,
  );
  assert.equal(
    active.endState.profession.thornsUntil,
    active.steps.find((step) => step.skill === "Defensive Protocol: Thorns")
      .end /
      1000 +
      6,
  );
});

test("Plasmatic State models both phases as one cast", () => {
  const result = simulate("Amalgam", ["Plasmatic State", "Puncturing Jab"], {
    boons: { quickness: true },
    selectedSkills: [
      "Healing Turret",
      "Grenade Kit",
      "Flamethrower",
      "Plasmatic State",
      "Flux State",
    ],
    selectedMorphSkillIds: [77103, 77104, 76705],
  });
  const step = result.steps.find((step) => step.skill === "Plasmatic State");
  const following = result.steps.find(
    (step) => step.skill === "Puncturing Jab",
  );
  assert.equal(step.end - step.start, 960);
  assert.equal(following.start - step.start, 960);
  const action = result.events.find(
    (event) => event.type === "action" && event.skillName === "Plasmatic State",
  );
  assert.equal(Math.round((action.rechargeReadyAt - action.at) * 1000), 25_480);
  assert.equal(
    result.resolvedEvents.filter(
      (event) => event.type === "damage" && event.name === "Plasmatic State",
    ).length,
    2,
  );
  assert.deepEqual(
    result.resolvedEvents
      .filter(
        (event) => event.type === "damage" && event.name === "Plasmatic State",
      )
      .map((event) => Math.round((event.at - step.start / 1000) * 1000)),
    [427, 787],
  );
  const firstPacket = result.resolvedEvents.find(
    (event) => event.type === "damage" && event.name === "Plasmatic State",
  );
  assert.ok(
    Math.abs(
      result.endState.profession.plasmaticStateUntil - firstPacket.at - 6,
    ) < 1e-12,
  );
});

test("benchmark Explosives and Firearms traits materialize offensive effects", () => {
  const result = simulate("Amalgam", ["Grenade Kit", "Shrapnel Grenade"], {
    selectedMorphSkillIds: [77103, 77104, 76705],
    stats: {
      precision: 2500,
      expertise: 0,
    },
    boons: { fury: true },
    selectedTraitIds: [
      TRAIT.EXPLOSIVE_ENTRANCE,
      TRAIT.STEEL_PACKED_POWDER,
      TRAIT.AIM_ASSISTED_ROCKET,
      TRAIT.SHRAPNEL,
      TRAIT.SERRATED_STEEL,
      TRAIT.HEMATIC_FOCUS,
      TRAIT.CHEMICAL_ROUNDS,
      TRAIT.THERMAL_VISION,
      TRAIT.MODIFIED_AMMUNITION,
      TRAIT.INCENDIARY_POWDER,
    ],
  });
  assert.equal(result.warnings.length, 0);
  assert.equal(
    result.resolvedEvents.filter(
      (event) => event.type === "damage" && event.name === "Explosive Entrance",
    ).length,
    1,
  );
  assert.equal(
    result.resolvedEvents.filter(
      (event) =>
        event.type === "damage" && event.name === "Aim-Assisted Rocket",
    ).length,
    1,
  );
  assert.ok(
    result.resolvedEvents.some(
      (event) =>
        event.type === "condition" && event.name === "Shrapnel — Bleeding",
    ),
  );
  assert.ok(
    result.resolvedEvents.some(
      (event) =>
        event.type === "condition" &&
        event.name === "Incendiary Powder — Burning",
    ),
  );
  assert.ok(result.profession.traitProcReadyAt.thermalVisionUntil > 0);
});

test("Explosives traits use the requested packets, gates, and health modifiers", () => {
  const grenadier = simulate("Core", ["Healing Turret"], {
    selectedTraitIds: [TRAIT.GRENADIER],
  });
  const lesserBarrage = grenadier.resolvedEvents.filter(
    (event) =>
      event.type === "damage" && event.name === "Lesser Grenade Barrage",
  );
  assert.equal(lesserBarrage.length, 6);
  assert.ok(
    lesserBarrage.every(
      (event) =>
        event.coefficient === 0.5 &&
        event.totalHits === 6 &&
        event.explosion === true,
    ),
  );

  const entrance = simulate(
    "Core",
    ["Grenade Kit", "Grenade", "Dodge", "Grenade"],
    {
      selectedTraitIds: [TRAIT.EXPLOSIVE_ENTRANCE, TRAIT.GRAND_ENTRANCE],
    },
  );
  assert.equal(
    entrance.resolvedEvents.filter(
      (event) => event.type === "damage" && event.name === "Explosive Entrance",
    ).length,
    2,
  );
  assert.ok(entrance.procSteps.some((step) => step.skill === "Grand Entrance"));

  const explosionTraits = simulate(
    "Core",
    [
      "Grenade Kit",
      "Grenade",
      "Shrapnel Grenade",
      { type: "wait", durationMs: 100 },
    ],
    {
      selectedTraitIds: [
        TRAIT.SHORT_FUSE,
        TRAIT.STEEL_PACKED_POWDER,
        TRAIT.EXPLOSIVE_TEMPER,
        TRAIT.SHRAPNEL,
      ],
      stats: { precision: 1000, ferocity: 0 },
      target: { conditions: {} },
    },
  );
  assert.equal(
    explosionTraits.procSteps.filter((step) => step.skill === "Short Fuse")
      .length,
    1,
  );
  assert.ok(
    explosionTraits.procSteps.filter(
      (step) => step.skill === "Explosive Temper",
    ).length >= 3,
  );
  assert.ok(
    explosionTraits.resolvedEvents.some(
      (event) =>
        event.type === "condition" &&
        event.condition === "Bleeding" &&
        event.skillName === "Shrapnel",
    ),
  );
  const grenadePackets = explosionTraits.resolvedEvents.filter(
    (event) => event.type === "damage" && event.name === "Grenade",
  );
  assert.equal(grenadePackets[0].criticalDamage, 1.5);
  assert.equal(grenadePackets[1].criticalDamage, 1.5 + 20 / 1500);

  const noModifiers = simulate("Core", ["Puncturing Jab"], {
    stats: { precision: 1000, ferocity: 0 },
    playerHealthFraction: 0.8,
    targetHealthFraction: 0.5,
    target: { conditions: { Vulnerability: 10 } },
  });
  const modifiers = simulate("Core", ["Puncturing Jab"], {
    selectedTraitIds: [
      TRAIT.GLASS_CANNON,
      TRAIT.SHAPED_CHARGE,
      TRAIT.BIG_BOOMER,
    ],
    stats: { precision: 1000, ferocity: 0 },
    playerHealthFraction: 0.8,
    targetHealthFraction: 0.5,
    target: { conditions: { Vulnerability: 10 } },
  });
  const firstStrike = (result) =>
    result.resolvedEvents.find((event) => event.type === "damage");
  assert.ok(
    Math.abs(
      firstStrike(modifiers).damage / firstStrike(noModifiers).damage -
        1.07 * 1.05 * 1.15,
    ) < 1e-12,
  );
});

test("Aim-Assisted Rocket calls an orbital strike after four rockets", () => {
  const result = simulate(
    "Core",
    [
      "Grenade Kit",
      "Grenade",
      { type: "wait", durationMs: 2500 },
      "Grenade",
      { type: "wait", durationMs: 2500 },
      "Grenade",
      { type: "wait", durationMs: 2500 },
      "Grenade",
      { type: "wait", durationMs: 2500 },
      "Grenade",
      { type: "wait", durationMs: 3000 },
    ],
    {
      selectedTraitIds: [TRAIT.AIM_ASSISTED_ROCKET],
      target: { conditions: {} },
    },
  );
  const rockets = result.resolvedEvents.filter(
    (event) => event.type === "damage" && event.name === "Aim-Assisted Rocket",
  );
  const orbital = result.resolvedEvents.find(
    (event) =>
      event.type === "damage" && event.name === "Orbital Command Strike",
  );
  assert.equal(rockets.length, 4);
  assert.ok(
    rockets.every(
      (event) =>
        event.coefficient === 1 &&
        event.explosion === true &&
        event.actorType === "effect" &&
        event.sourceId === ID.AIM_ASSISTED_ROCKET_TRAIT_SKILL &&
        event.weaponStrengthProfileId === "nonweapon.unequipped" &&
        event.resolvedWeaponStrength === 690.5,
    ),
  );
  assert.equal(orbital.coefficient, 1.92);
  assert.equal(orbital.comboFinishers[0].ownerId, "engineer");
  assert.equal(orbital.comboFinishers[0].finisherType, "Blast");
  assert.equal(orbital.comboFinishers[0].chance, 1);
  assert.equal(orbital.explosion, false);
  assert.equal(orbital.actorType, "effect");
  assert.equal(orbital.sourceId, ID.ORBITAL_COMMAND_STRIKE);
  assert.equal(orbital.weaponStrengthProfileId, "nonweapon.unequipped");
  assert.equal(orbital.resolvedWeaponStrength, 690.5);

  const rifleProjectiles = simulate(
    "Core",
    [
      "Overcharged Shot",
      { type: "wait", durationMs: 2440 },
      "Rifle Burst",
      { type: "wait", durationMs: 4000 },
    ],
    {
      selectedTraitIds: [TRAIT.AIM_ASSISTED_ROCKET],
      target: { conditions: {} },
    },
  );
  const overcharged = rifleProjectiles.resolvedEvents.find(
    (event) => event.type === "damage" && event.name === "Overcharged Shot",
  );
  const rifleGrenade = rifleProjectiles.resolvedEvents.find(
    (event) => event.type === "damage" && event.name === "Rifle Burst Grenade",
  );
  const rifleRockets = rifleProjectiles.resolvedEvents.filter(
    (event) => event.type === "damage" && event.name === "Aim-Assisted Rocket",
  );
  assert.equal(rifleRockets.length, 2);
  assert.ok(Math.abs(rifleRockets[0].at - overcharged.at - 0.04) < 1e-12);
  assert.ok(Math.abs(rifleRockets[1].at - rifleGrenade.at - 0.04) < 1e-12);

  for (const command of [
    "Spark Revolver",
    "Core Reactor Shot",
    "Jade Mortar",
  ]) {
    const mechProjectile = simulate(
      "Mechanist",
      [command, { type: "wait", durationMs: 4000 }],
      {
        selectedTraitIds: [
          TRAIT.AIM_ASSISTED_ROCKET,
          TRAIT.MECH_ARMS_JADE_CANNONS,
          TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
          TRAIT.MECH_CORE_JADE_DYNAMO,
        ],
        target: { conditions: {} },
      },
    );
    const rocket = mechProjectile.resolvedEvents.find(
      (event) =>
        event.type === "damage" && event.name === "Aim-Assisted Rocket",
    );
    assert.equal(
      rocket,
      undefined,
      `${command} must not trigger the player-owned trait proc`,
    );
  }

  const fielded = simulate(
    "Core",
    [
      "Grenade Kit",
      "Grenade",
      { type: "wait", durationMs: 2500 },
      "Grenade",
      { type: "wait", durationMs: 2500 },
      "Grenade",
      { type: "wait", durationMs: 2500 },
      "Grenade",
      { type: "wait", durationMs: 2500 },
      "Bomb Kit",
      "Fire Bomb",
      "Grenade Kit",
      "Grenade",
      { type: "wait", durationMs: 4000 },
    ],
    {
      selectedTraitIds: [TRAIT.AIM_ASSISTED_ROCKET],
      selectedSkills: [
        "Healing Turret",
        "Bomb Kit",
        "Grenade Kit",
        "Rifle Turret",
        "Supply Crate",
      ],
      relic: "Bloodstone",
      target: { conditions: {} },
    },
  );
  assert.ok(
    fielded.procSteps.some(
      (step) =>
        step.skill === "Bloodstone Volatility" &&
        step.sourceSkill === "Orbital Command Strike",
    ),
  );
});

test("Firearms traits apply critical tiers, durations, procs, and Power bleeding", () => {
  const heavy = [0.8, 0.7, 0.4, 0.2].map((targetHealthFraction) => {
    const result = simulate("Core", ["Puncturing Jab"], {
      selectedTraitIds: [TRAIT.HIGH_CALIBER, TRAIT.HEAVY_METAL],
      stats: { precision: 1000, ferocity: 0 },
      targetHealthFraction,
      target: { conditions: {} },
    });
    const hit = result.resolvedEvents.find((event) => event.type === "damage");
    return [hit.criticalChance, hit.criticalDamage];
  });
  assert.deepEqual(heavy, [
    [0.2, 1.5],
    [0.25, 1.5750000000000002],
    [0.30000000000000004, 1.6500000000000001],
    [0.35, 1.7249999999999999],
  ]);

  const bleed = (selectedTraitIds) =>
    simulate("Core", ["Puncturing Jab", { type: "wait", durationMs: 2000 }], {
      selectedTraitIds,
      stats: {
        power: 2000,
        precision: 1000,
        ferocity: 0,
        conditionDamage: 1000,
        expertise: 0,
      },
      target: { conditions: {} },
    }).resolvedEvents.find(
      (event) =>
        event.type === "condition" &&
        event.condition === "Bleeding" &&
        event.skillName === "Puncturing Jab",
    );
  const baseBleed = bleed([]);
  const serratedBleed = bleed([TRAIT.SERRATED_STEEL]);
  const powerBleed = bleed([TRAIT.SHARPSHOOTER]);
  assert.ok(
    Math.abs(
      (serratedBleed.naturalExpiresAt - serratedBleed.at) /
        (baseBleed.naturalExpiresAt - baseBleed.at) -
        1.33,
    ) < 1e-12,
  );
  assert.equal(baseBleed.damageTicks[0].damage, 82);
  assert.ok(Math.abs(powerBleed.damageTicks[0].damage - 102) < 1e-12);

  const noScope = simulate(
    "Core",
    ["Grenade Kit", "Grenade", { type: "wait", durationMs: 100 }],
    {
      selectedTraitIds: [TRAIT.NO_SCOPE],
      stats: { precision: 4000, ferocity: 0 },
      target: { conditions: {} },
    },
  );
  const noScopeHits = noScope.resolvedEvents.filter(
    (event) => event.type === "damage" && event.name === "Grenade",
  );
  assert.equal(
    noScope.procSteps.filter((step) => step.skill === "No Scope").length,
    1,
  );
  assert.equal(noScopeHits[0].criticalDamage, 1.5);
  assert.equal(noScopeHits[1].criticalDamage, 1.6);

  const bloodTraits = simulate(
    "Core",
    ["Grenade Kit", "Shrapnel Grenade", { type: "wait", durationMs: 100 }],
    {
      selectedTraitIds: [TRAIT.SANGUINE_ARRAY, TRAIT.HEMATIC_FOCUS],
    },
  );
  assert.ok(
    bloodTraits.procSteps.some((step) => step.skill === "Sanguine Array"),
  );
  assert.equal(
    bloodTraits.procSteps.filter((step) => step.skill === "Hematic Focus")
      .length,
    1,
  );

  const pistolBurn = (selectedTraitIds) =>
    simulate("Core", ["Blowtorch", { type: "wait", durationMs: 1500 }], {
      selectedTraitIds,
      stats: {
        precision: 1000,
        conditionDamage: 1000,
        expertise: 0,
      },
      target: { conditions: {} },
    }).resolvedEvents.find(
      (event) => event.type === "condition" && event.condition === "Burning",
    );
  const baseBurn = pistolBurn([]);
  const chemicalBurn = pistolBurn([TRAIT.CHEMICAL_ROUNDS]);
  const thermalBurn = pistolBurn([TRAIT.THERMAL_VISION]);
  assert.ok(
    Math.abs(
      (chemicalBurn.naturalExpiresAt - chemicalBurn.at) /
        (baseBurn.naturalExpiresAt - baseBurn.at) -
        1.2,
    ) < 1e-12,
  );
  assert.ok(
    Math.abs(
      thermalBurn.damageTicks[0].damage / baseBurn.damageTicks[0].damage - 1.05,
    ) < 1e-12,
  );

  const ammunitionBase = simulate("Core", ["Puncturing Jab"], {
    target: {
      conditions: { Bleeding: 1, Burning: 1, Poisoned: 1 },
    },
  });
  const ammunition = simulate("Core", ["Puncturing Jab"], {
    selectedTraitIds: [TRAIT.MODIFIED_AMMUNITION],
    target: {
      conditions: { Bleeding: 1, Burning: 1, Poisoned: 1 },
    },
  });
  assert.ok(
    Math.abs(
      ammunition.resolvedEvents.find((event) => event.type === "damage")
        .damage /
        ammunitionBase.resolvedEvents.find((event) => event.type === "damage")
          .damage -
        1.03,
    ) < 1e-12,
  );
});

test("Incendiary Powder tracks player and mech cooldowns independently", () => {
  const result = simulate(
    "Mechanist",
    ["Grenade Kit", "Grenade", { type: "wait", durationMs: 2500 }],
    {
      selectedSkills: [
        "Rectifier Signet",
        "Grenade Kit",
        "Throw Mine",
        "Rifle Turret",
        "Overclock Signet",
      ],
      selectedTraitIds: [
        TRAIT.INCENDIARY_POWDER,
        TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
        TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
        TRAIT.MECH_CORE_JADE_DYNAMO,
      ],
      stats: { precision: 4000, expertise: 0 },
      target: { conditions: {} },
    },
  );
  const burning = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.condition === "Burning" &&
      event.skillName === "Incendiary Powder",
  );
  assert.deepEqual(
    burning.map((event) => event.actorType),
    ["effect", "summon"],
  );
  assert.ok(
    burning.every(
      (event) => Math.abs(event.naturalExpiresAt - event.at - 10.64) < 1e-12,
    ),
  );
});

test("Tools traits materialize tool-belt, dodge, kit, and battery behavior", () => {
  const toolbelt = simulate(
    "Core",
    [
      "Regenerating Mist",
      "Grenade Barrage",
      "Mine Field",
      "Surprise Shot (engineer skill)",
      "Med Pack Drop",
    ],
    {
      selectedTraitIds: [
        TRAIT.OPTIMIZED_ACTIVATION,
        TRAIT.STATIC_DISCHARGE,
        TRAIT.KINETIC_BATTERY,
      ],
      stats: { precision: 4000, ferocity: 0 },
      target: { conditions: {} },
    },
  );
  assert.equal(
    toolbelt.events.filter(
      (event) => event.type === "buff" && event.kind === "vigor",
    ).length,
    5,
  );
  assert.equal(
    toolbelt.resolvedEvents.filter(
      (event) => event.type === "damage" && event.name === "Static Discharge",
    ).length,
    5,
  );
  const discharge = toolbelt.resolvedEvents.find(
    (event) => event.type === "damage" && event.name === "Static Discharge",
  );
  assert.equal(discharge.coefficient, 0.33);
  assert.equal(discharge.weaponStrengthProfileId, "nonweapon.unequipped");
  assert.equal(discharge.resolvedWeaponStrength, 690.5);
  assert.equal(discharge.weaponStrengthSampled, false);
  assert.equal(discharge.criticalDamage, 2.5);
  assert.ok(
    toolbelt.events.some(
      (event) =>
        event.type === "buff" &&
        event.kind === "kinetic-battery" &&
        event.duration === 5,
    ),
  );
  assert.ok(
    toolbelt.events.some(
      (event) =>
        event.type === "buff" &&
        event.kind === "quickness" &&
        event.duration === 5,
    ),
  );
  assert.equal(toolbelt.endState.profession.kineticCharges, 0);

  const wrench = simulate("Core", ["Supply Crate", "Dodge"], {
    selectedTraitIds: [TRAIT.POWER_WRENCH],
  });
  assert.equal(wrench.endState.cooldowns["Supply Crate"].readyAt, 73000);

  const adrenal = simulate(
    "Core",
    ["Grenade Barrage", "Dodge", { type: "wait", durationMs: 1000 }],
    {
      selectedTraitIds: [TRAIT.MECHANIZED_DEPLOYMENT, TRAIT.ADRENAL_IMPLANT],
      boons: { vigor: true },
    },
  );
  assert.equal(adrenal.endState.cooldowns["Grenade Barrage"].readyAt, 21270);
  assert.equal(adrenal.endState.profession.endurance, 65.75);

  const streamlined = simulate("Core", ["Grenade Kit"], {
    selectedTraitIds: [TRAIT.STREAMLINED_KITS],
  });
  const mine = streamlined.resolvedEvents.find(
    (event) => event.type === "damage" && event.name === "Drop Mine",
  );
  assert.equal(mine.coefficient, 1.75);
  assert.equal(mine.explosion, true);
  assert.ok(
    streamlined.events.some(
      (event) =>
        event.type === "buff" &&
        event.kind === "swiftness" &&
        event.duration === 20,
    ),
  );
});

test("Scrapper traits apply gyro control, superspeed, boons, and charges", () => {
  const result = simulate(
    "Scrapper",
    [
      "Med Kit",
      "Bandage Self",
      "Function Gyro",
      "Function Gyro",
      { type: "wait", durationMs: 2100 },
    ],
    {
      selectedSkills: [
        "Med Kit",
        "Grenade Kit",
        "Throw Mine",
        "Rifle Turret",
        "Supply Crate",
      ],
      selectedTraitIds: [
        TRAIT.SPEED_OF_SYNERGY,
        TRAIT.GYROSCOPIC_ACCELERATION,
        TRAIT.SYSTEM_SHOCKER,
        TRAIT.MASS_MOMENTUM,
        TRAIT.OBJECT_IN_MOTION,
        TRAIT.EX_MACHINA,
        TRAIT.APPLIED_FORCE,
      ],
      boons: { might: 10 },
    },
  );
  assert.equal(result.warnings.length, 0);
  assert.equal(
    result.events.filter(
      (event) =>
        event.type === "buff" && event.name === "Speed of Synergy — superspeed",
    ).length,
    1,
  );
  assert.ok(
    result.events.some(
      (event) =>
        event.type === "buff" &&
        event.name === "Speed of Synergy — superspeed" &&
        event.duration === 10,
    ),
  );
  assert.ok(
    result.events.some(
      (event) =>
        event.type === "buff" &&
        event.name === "Gyroscopic Acceleration — superspeed" &&
        event.duration === 5,
    ),
  );
  assert.equal(
    result.events.filter(
      (event) => event.type === "control" && event.controlKind === "daze",
    ).length,
    2,
  );
  assert.ok(
    result.events.some(
      (event) =>
        event.type === "buff" &&
        event.kind === "stability" &&
        event.duration === 3,
    ),
  );
  assert.ok(
    result.procSteps.filter((step) => step.skill === "Mass Momentum").length >=
      3,
  );
  assert.ok(result.procSteps.some((step) => step.skill === "Applied Force"));
  assert.equal(result.endState.ammo["Function Gyro"].maximum, 2);

  const base = simulate("Scrapper", ["Puncturing Jab"], {
    target: { conditions: {} },
  });
  const moving = simulate("Scrapper", ["Puncturing Jab"], {
    selectedTraitIds: [TRAIT.OBJECT_IN_MOTION],
    boons: {
      stability: true,
      swiftness: true,
      superspeed: true,
    },
    target: { conditions: {} },
  });
  assert.ok(
    Math.abs(
      moving.resolvedEvents.find((event) => event.type === "damage").damage /
        base.resolvedEvents.find((event) => event.type === "damage").damage -
        1.05 ** 3,
    ) < 1e-12,
  );

  const appliedForce = simulate("Scrapper", ["Puncturing Jab"], {
    selectedTraitIds: [TRAIT.APPLIED_FORCE],
    boons: { might: 25 },
    stats: { power: 2000 },
    target: { conditions: {} },
  });
  const withoutAppliedForce = simulate("Scrapper", ["Puncturing Jab"], {
    boons: { might: 25 },
    stats: { power: 2000 },
    target: { conditions: {} },
  });
  assert.ok(
    Math.abs(
      appliedForce.resolvedEvents.find((event) => event.type === "damage")
        .damage /
        withoutAppliedForce.resolvedEvents.find(
          (event) => event.type === "damage",
        ).damage -
        3500 / 2750,
    ) < 1e-12,
  );
});

test("Mine Field materializes five mines plus detonation with cripple", () => {
  const mineField = mechanic("Mine Field");
  const detonation = mechanic("Detonate Mine Field");
  assert.equal(mineField.cooldown, 17);
  assert.equal(mineField.effects[0].coefficient, 3.85);
  assert.equal(mineField.effects[0].hits, 5);
  assert.equal(detonation.effects[0].coefficient, 0.77);
  assert.equal(detonation.effects[0].hits, 1);

  const result = simulate("Core", ["Mine Field", "Detonate Mine Field"]);
  assert.equal(result.warnings.length, 0);
  const mines = result.resolvedEvents.filter(
    (event) => event.type === "damage" && event.name === "Damage per Mine",
  );
  assert.equal(mines.length, 6);
  assert.ok(mines.every((event) => event.coefficient === 0.77));

  const cripple = result.resolvedEvents.filter(
    (event) => event.type === "condition" && event.condition === "Crippled",
  );
  assert.equal(cripple.length, 6);
  assert.ok(cripple.every((event) => event.duration === 2.5));
});

test("power Scrapper toolbelt skills use their per-hit and control facts", () => {
  const orbitalStrike = mechanic("Orbital Strike");
  assert.equal(orbitalStrike.cooldown, 40);
  assert.equal(orbitalStrike.effects[0].coefficient, 1.33);
  assert.equal(orbitalStrike.comboFinishers[0].finisherType, "Blast");

  const grenadeBarrage = mechanic("Grenade Barrage");
  assert.equal(grenadeBarrage.cooldown, 25);
  assert.equal(grenadeBarrage.effects[0].coefficient, 3.6);
  assert.equal(grenadeBarrage.effects[0].hits, 6);

  const staticShock = mechanic("Static Shock");
  assert.equal(staticShock.cooldown, 20);
  assert.equal(staticShock.effects[0].coefficient, 1);
  assert.equal(staticShock.effects[1].metadata.controlKind, "daze");

  const result = simulate("Core", ["Grenade Barrage"]);
  const grenades = result.resolvedEvents.filter(
    (event) => event.type === "damage" && event.name === "Grenade Barrage",
  );
  assert.equal(grenades.length, 6);
  assert.ok(grenades.every((event) => event.coefficient === 0.6));
});

test("Medic Gyro and Reconstruction Field expose their water fields", () => {
  const reconstructionField = mechanic("Reconstruction Field");
  assert.equal(reconstructionField.cooldown, 25);
  assert.equal(reconstructionField.comboFields[0].fieldType, "Water");
  assert.equal(reconstructionField.comboFields[0].duration, 2);
  assert.deepEqual(reconstructionField.effects[0], {
    type: "boon",
    boon: "protection",
    duration: 2,
    stacks: 1,
  });

  const medicGyro = mechanic("Medic Gyro");
  assert.equal(medicGyro.cooldown, 20);
  assert.equal(medicGyro.comboFields[0].fieldType, "Water");
  assert.equal(medicGyro.comboFields[0].duration, 5);
});

test("Poison Gas Shell pulses its five-second poison field", () => {
  const poisonGasShell = mechanic("Poison Gas Shell");
  assert.equal(poisonGasShell.comboFields[0].fieldType, "Poison");
  assert.equal(poisonGasShell.comboFields[0].duration, 5);
  assert.equal(poisonGasShell.effects[1].condition, "Poisoned");
  assert.equal(poisonGasShell.effects[1].duration, 3);
  assert.equal(poisonGasShell.effects[1].applications, 5);
  assert.equal(poisonGasShell.effects[1].intervalMs, 1000);

  const result = simulate(
    "Core",
    [
      "Elite Mortar Kit",
      "Poison Gas Shell",
      { type: "wait", durationMs: 5000 },
    ],
    {
      selectedSkills: [
        "Healing Turret",
        "Grenade Kit",
        "Throw Mine",
        "Rifle Turret",
        "Elite Mortar Kit",
      ],
    },
  );
  const poison = result.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Poison Gas Shell" &&
      event.condition === "Poisoned",
  );
  assert.equal(poison.length, 5);
  assert.deepEqual(
    poison.map((event) => event.at - poison[0].at),
    [0, 1, 2, 3, 4],
  );
  assert.ok(poison.every((event) => event.duration === 3));
});

test("Mechanical Genius gives the jade mech independent inherited attributes", () => {
  const player = {
    power: 2000,
    precision: 1500,
    toughness: 1200,
    vitality: 1300,
    ferocity: 600,
    conditionDamage: 1000,
    expertise: 300,
    concentration: 400,
    healingPower: 500,
  };
  const base = engineerMechAttributes({ specialization: "Mechanist" }, player);
  assert.deepEqual(base, {
    power: 2000,
    precision: 1,
    toughness: 2200,
    vitality: 2300,
    ferocity: 300,
    conditionDamage: 500,
    expertise: 150,
    concentration: 200,
    healingPower: 250,
  });
  assert.equal(
    engineerMechAttributes(
      {
        specialization: "Mechanist",
        selectedTraitIds: [TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS],
      },
      player,
    ).conditionDamage,
    1000,
  );
  assert.equal(
    engineerMechAttributes(
      {
        specialization: "Mechanist",
        selectedTraitIds: [TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS],
      },
      player,
    ).expertise,
    300,
  );
  assert.equal(
    engineerMechAttributes(
      {
        specialization: "Mechanist",
        selectedTraitIds: [TRAIT.MECH_FRAME_CHANNELING_CONDUITS],
      },
      player,
    ).concentration,
    400,
  );
  assert.equal(
    engineerMechAttributes(
      {
        specialization: "Mechanist",
        selectedTraitIds: [TRAIT.MECH_FRAME_CHANNELING_CONDUITS],
      },
      player,
    ).healingPower,
    500,
  );
  assert.equal(
    engineerMechAttributes(
      {
        specialization: "Mechanist",
        selectedTraitIds: [TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR],
      },
      player,
    ).precision,
    1501,
  );

  const uncapped = {
    power: 10000,
    precision: 10000,
    toughness: 10000,
    vitality: 10000,
    ferocity: 10000,
    conditionDamage: 10000,
    expertise: 10000,
    concentration: 10000,
    healingPower: 10000,
  };
  const cappedBase = engineerMechAttributes(
    {
      specialization: "Mechanist",
    },
    uncapped,
  );
  assert.equal(cappedBase.power, 2250);
  assert.equal(cappedBase.ferocity, 750);
  assert.equal(cappedBase.conditionDamage, 750);
  assert.equal(cappedBase.expertise, 750);
  assert.equal(cappedBase.concentration, 750);
  assert.equal(cappedBase.healingPower, 750);
  assert.equal(
    engineerMechAttributes(
      {
        specialization: "Mechanist",
        selectedTraitIds: [TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR],
      },
      uncapped,
    ).precision,
    2500,
  );
  const cappedConductive = engineerMechAttributes(
    {
      specialization: "Mechanist",
      selectedTraitIds: [TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS],
    },
    uncapped,
  );
  assert.equal(cappedConductive.conditionDamage, 1500);
  assert.equal(cappedConductive.expertise, 1500);
  const cappedChanneling = engineerMechAttributes(
    {
      specialization: "Mechanist",
      selectedTraitIds: [TRAIT.MECH_FRAME_CHANNELING_CONDUITS],
    },
    uncapped,
  );
  assert.equal(cappedChanneling.concentration, 1500);
  assert.equal(cappedChanneling.healingPower, 1500);
  const copiedMightAfterCaps = engineerProfession
    .resolveRuntime({
      specialization: "Mechanist",
    })
    .modifyAttributes(
      {
        config: {
          specialization: "Mechanist",
          selectedSkills: ["Shift Signet"],
          boons: { might: 25 },
        },
        event: {
          actorType: "summon",
          engineerMech: true,
        },
      },
      {
        ...uncapped,
        power: uncapped.power + 750,
        conditionDamage: uncapped.conditionDamage + 750,
      },
    );
  assert.equal(copiedMightAfterCaps.power, 3000);
  assert.equal(copiedMightAfterCaps.conditionDamage, 1500);

  const firearms = simulate(
    "Mechanist",
    ["Spark Revolver", { type: "wait", durationMs: 1500 }],
    {
      stats: {
        power: 2811,
        precision: 1960,
        ferocity: 1480,
      },
      boons: { fury: true },
      attributeProvenance: {
        professionStaticRulesApplied: true,
      },
      selectedTraitIds: [
        TRAIT.HEMATIC_FOCUS,
        TRAIT.NO_SCOPE,
        TRAIT.MECH_ARMS_JADE_CANNONS,
        TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
        TRAIT.MECH_CORE_JADE_DYNAMO,
      ],
      target: { conditions: {} },
    },
  );
  const mechStrike = firearms.resolvedEvents.find(
    (event) => event.type === "damage" && event.name === "Spark Revolver",
  );
  assert.ok(Math.abs(mechStrike.criticalChance - 0.9576190476190476) < 1e-12);
  assert.ok(Math.abs(mechStrike.criticalDamage - 1.9433333333333334) < 1e-12);
});

test("Mechanist arm traits alter mech hits and their command skills", () => {
  const singleEdge = simulate(
    "Mechanist",
    ["Rolling Smash", { type: "wait", durationMs: 1500 }],
    {
      selectedTraitIds: [
        TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
        TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
        TRAIT.MECH_CORE_J_DRIVE,
      ],
      target: { conditions: {} },
    },
  );
  const rolling = singleEdge.resolvedEvents.find(
    (event) => event.type === "damage" && event.name === "Rolling Smash",
  );
  assert.equal(rolling.actorType, "summon");
  assert.equal(rolling.coefficient, 1.6);
  const rollingBleeds = singleEdge.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.condition === "Bleeding" &&
      ["Rolling Smash", "Mech Arms: Single-Edge Cutters"].includes(
        event.skillName,
      ),
  );
  assert.ok(
    rollingBleeds.some(
      (event) =>
        event.skillName === "Rolling Smash" &&
        event.stacks === 4 &&
        event.duration === 8,
    ),
  );
  const cutterBleeds = rollingBleeds.filter(
    (event) => event.skillName === "Mech Arms: Single-Edge Cutters",
  );
  assert.equal(cutterBleeds.length, 2);
  assert.ok(
    cutterBleeds.every((event) => event.stacks === 1 && event.duration === 3),
  );
  assert.ok(cutterBleeds[1].at - cutterBleeds[0].at >= 1);

  const highImpact = simulate(
    "Mechanist",
    ["Explosive Knuckle", { type: "wait", durationMs: 1500 }],
    {
      selectedTraitIds: [
        TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS,
        TRAIT.MECH_FRAME_CHANNELING_CONDUITS,
        TRAIT.MECH_CORE_J_DRIVE,
      ],
      target: { conditions: {} },
    },
  );
  const knuckle = highImpact.resolvedEvents.find(
    (event) => event.type === "damage" && event.name === "Explosive Knuckle",
  );
  assert.equal(knuckle.actorType, "summon");
  assert.equal(knuckle.coefficient, 1.8);
  assert.equal(knuckle.damageKind, "explosion");
  assert.equal(knuckle.weaponStrengthProfileId, "summon.weapon-type-2");
  assert.equal(knuckle.resolvedWeaponStrength, 2878);
  assert.ok(
    highImpact.resolvedEvents.some(
      (event) =>
        event.type === "condition" &&
        event.condition === "Weakness" &&
        event.duration === 5,
    ),
  );
  const highImpactProcs = highImpact.procSteps.filter(
    (step) => step.skill === "Mech Arms: High-Impact Drivers",
  );
  assert.equal(highImpactProcs.length, 2);
  assert.ok(highImpactProcs[1].start - highImpactProcs[0].start >= 1);

  const jadeCannons = simulate(
    "Mechanist",
    ["Spark Revolver", { type: "wait", durationMs: 2300 }],
    {
      selectedTraitIds: [
        TRAIT.MECH_ARMS_JADE_CANNONS,
        TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
        TRAIT.MECH_CORE_J_DRIVE,
      ],
      stats: { precision: 4000 },
      target: { conditions: {} },
    },
  );
  const spark = jadeCannons.resolvedEvents.filter(
    (event) => event.type === "damage" && event.name === "Spark Revolver",
  );
  assert.equal(spark.length, 12);
  assert.ok(
    spark.every(
      (event) =>
        event.actorType === "summon" &&
        Math.abs(event.coefficient - 0.176) < 1e-12 &&
        event.weaponStrengthProfileId === "summon.weapon-type-2" &&
        event.resolvedWeaponStrength === 2878,
    ),
  );
  const autos = jadeCannons.resolvedEvents.filter(
    (event) => event.type === "damage" && event.name === "Jade Energy Shot",
  );
  assert.ok(autos.length >= 2);
  assert.ok(spark.every((event) => event.criticalChance === 0.25));
  assert.deepEqual(
    autos
      .slice(0, 2)
      .map((event) => [
        event.skillId,
        event.coefficient,
        event.criticalChance,
        event.weaponStrengthProfileId,
        event.resolvedWeaponStrength,
      ]),
    [
      [ID.JADE_ENERGY_SHOT, 0.42, 0.25, "summon.weapon-type-1", 2553.5],
      [
        ID.JADE_ENERGY_SHOT_ID_63348,
        0.42,
        0.25,
        "summon.weapon-type-1",
        2553.5,
      ],
    ],
  );
  assert.ok(
    jadeCannons.resolvedEvents.some(
      (event) =>
        event.type === "condition" &&
        event.skillName === "Mech Arms: Jade Cannons" &&
        event.condition === "Vulnerability" &&
        event.duration === 6,
    ),
  );

  const meleeChain = simulate(
    "Mechanist",
    [{ type: "wait", durationMs: 3000 }],
    {
      selectedTraitIds: [
        TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
        TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
        TRAIT.MECH_CORE_J_DRIVE,
      ],
      target: { conditions: {} },
    },
  ).resolvedEvents.filter(
    (event) =>
      event.type === "damage" &&
      ["Hard Strike", "Heavy Smash (Mech)", "Twin Strike (Mech)"].includes(
        event.name,
      ),
  );
  assert.deepEqual(
    [...new Set(meleeChain.map((event) => event.name))],
    ["Hard Strike", "Heavy Smash (Mech)", "Twin Strike (Mech)"],
  );
  assert.ok(
    meleeChain.every(
      (event) =>
        event.weaponStrengthProfileId === "summon.weapon-type-2" &&
        event.resolvedWeaponStrength === 2878,
    ),
  );
});

test("Mechanist frame commands use mech stats and requested pulse profiles", () => {
  const conductive = simulate(
    "Mechanist",
    ["Discharge Array", { type: "wait", durationMs: 5000 }],
    {
      selectedTraitIds: [
        TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
        TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
        TRAIT.MECH_CORE_J_DRIVE,
      ],
      target: { conditions: {} },
    },
  );
  const discharge = conductive.resolvedEvents.filter(
    (event) => event.type === "damage" && event.name === "Discharge Array",
  );
  assert.equal(discharge.length, 5);
  assert.ok(
    discharge.every(
      (event, index) =>
        event.actorType === "summon" &&
        event.coefficient === 0.3 &&
        event.at === index,
    ),
  );
  for (const [condition, stacks, duration] of [
    ["Slow", 1, 2],
    ["Confusion", 2, 3],
    ["Burning", 1, 3],
  ]) {
    const applications = conductive.resolvedEvents.filter(
      (event) =>
        event.type === "condition" &&
        event.skillName === "Discharge Array" &&
        event.condition === condition,
    );
    assert.equal(applications.length, 5);
    assert.ok(
      applications.every(
        (event) => event.stacks === stacks && event.duration === duration,
      ),
    );
  }

  const variable = simulate(
    "Mechanist",
    ["Core Reactor Shot", { type: "wait", durationMs: 700 }],
    {
      selectedTraitIds: [
        TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
        TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
        TRAIT.MECH_CORE_J_DRIVE,
      ],
      target: { conditions: {} },
    },
  );
  const reactor = variable.resolvedEvents.find(
    (event) => event.type === "damage" && event.name === "Core Reactor Shot",
  );
  assert.equal(reactor.actorType, "summon");
  assert.equal(reactor.coefficient, 2.5);
  assert.equal(reactor.weaponStrengthProfileId, "summon.weapon-type-1");
  assert.equal(reactor.resolvedWeaponStrength, 2553.5);
  assert.ok(
    variable.events.some(
      (event) =>
        event.type === "control" &&
        event.skillName === "Core Reactor Shot" &&
        event.controlKind === "launch",
    ),
  );
});

test("Mech Fighter, Jade Dynamo, and J-Drive add their active effects", () => {
  const fighter = simulate("Mechanist", ["Lightning Rod"], {
    selectedTraitIds: [
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
      TRAIT.MECH_CORE_J_DRIVE,
    ],
    target: { conditions: {} },
  });
  const punch = fighter.resolvedEvents.find(
    (event) => event.type === "damage" && event.name === "Rocket Punch (Mech)",
  );
  assert.equal(punch.actorType, "summon");
  assert.equal(punch.coefficient, 1);
  assert.equal(punch.explosion, true);
  assert.equal(punch.weaponStrengthProfileId, "summon.weapon-type-1");
  assert.equal(punch.resolvedWeaponStrength, 2553.5);
  const punchBreakdown = fighter.breakdown.find(
    (entry) => entry.name === "Rocket Punch (Mech)",
  );
  assert.equal(punchBreakdown.skillId, ID.ROCKET_PUNCH_MECH);
  assert.equal(punchBreakdown.actorType, "summon");
  const punchRow = skillBreakdownRows(fighter).find(
    (row) => row.name === "Rocket Punch (Mech)",
  );
  assert.equal(punchRow.skillId, ID.ROCKET_PUNCH_MECH);
  assert.equal(punchRow.actorType, "summon");
  assert.equal(punchRow.group, "Entities");
  assert.ok(
    fighter.resolvedEvents.some(
      (event) =>
        event.type === "condition" &&
        event.skillName === "Rocket Punch (Mech)" &&
        event.condition === "Burning" &&
        event.duration === 5,
    ),
  );
  assert.ok(
    fighter.events.some(
      (event) =>
        event.type === "control" &&
        event.skillName === "Rocket Punch (Mech)" &&
        event.controlKind === "defiance" &&
        event.duration === 100,
    ),
  );

  const dynamo = simulate("Mechanist", ["Jade Mortar", "Jade Mortar"], {
    selectedTraitIds: [
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
      TRAIT.MECH_CORE_JADE_DYNAMO,
    ],
    target: { conditions: {} },
  });
  const mortarSteps = dynamo.steps.filter(
    (step) => step.skill === "Jade Mortar",
  );
  assert.equal(mortarSteps[0].start, mortarSteps[0].end);
  assert.equal(mortarSteps[1].start - mortarSteps[0].end, 16000);
  assert.equal(
    dynamo.events.filter(
      (event) =>
        event.type === "buff" &&
        event.kind === "quickness" &&
        event.duration === 2.5,
    ).length,
    2,
  );
  const mortar = dynamo.resolvedEvents.find(
    (event) => event.type === "damage" && event.name === "Jade Mortar",
  );
  assert.equal(mortar.actorType, "summon");
  assert.equal(mortar.coefficient, 2.2);
  assert.equal(mortar.weaponStrengthProfileId, "summon.weapon-type-2");
  assert.equal(mortar.resolvedWeaponStrength, 2878);

  const overclock = simulate(
    "Mechanist",
    ["Overclock Signet", { type: "wait", durationMs: 4000 }],
    {
      selectedSkills: [
        "Rectifier Signet",
        "Grenade Kit",
        "Shift Signet",
        "Force Signet",
        "Overclock Signet",
      ],
      selectedTraitIds: [
        TRAIT.MECH_ARMS_JADE_CANNONS,
        TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
        TRAIT.MECH_CORE_JADE_DYNAMO,
      ],
      target: { conditions: {} },
    },
  );
  const buster = overclock.resolvedEvents.filter(
    (event) => event.type === "damage" && event.name === "Jade Buster Cannon",
  );
  const busterBurns = overclock.resolvedEvents.filter(
    (event) =>
      event.type === "condition" &&
      event.skillName === "Jade Buster Cannon" &&
      event.condition === "Burning",
  );
  assert.equal(buster.length, 5);
  assert.ok(
    buster.every(
      (event) =>
        event.actorType === "summon" &&
        event.coefficient === 0.95 &&
        event.weaponStrengthProfileId === "summon.weapon-type-3" &&
        event.resolvedWeaponStrength === 2749,
    ),
  );
  assert.equal(new Set(buster.map((event) => event.activationId)).size, 1);
  assert.equal(busterBurns.length, 5);
  assert.ok(
    busterBurns.every((event) => event.stacks === 1 && event.duration === 6),
  );
  const stochasticBuster = simulate(
    "Mechanist",
    ["Overclock Signet", { type: "wait", durationMs: 4000 }],
    {
      selectedSkills: [
        "Rectifier Signet",
        "Grenade Kit",
        "Shift Signet",
        "Force Signet",
        "Overclock Signet",
      ],
      selectedTraitIds: [
        TRAIT.MECH_ARMS_JADE_CANNONS,
        TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
        TRAIT.MECH_CORE_JADE_DYNAMO,
      ],
      randomness: { mode: "stochastic", seed: 63374 },
      target: { conditions: {} },
    },
  ).resolvedEvents.filter(
    (event) => event.type === "damage" && event.name === "Jade Buster Cannon",
  );
  const stochasticStrengths = [
    ...new Set(stochasticBuster.map((event) => event.resolvedWeaponStrength)),
  ];
  assert.equal(stochasticStrengths.length, 1);
  assert.ok(stochasticStrengths[0] >= 2448 && stochasticStrengths[0] < 3050);
  assert.ok(
    stochasticBuster.every((event) => event.weaponStrengthSampled === true),
  );

  const jDriveConfig = {
    selectedSkills: [
      "Rectifier Signet",
      "Grenade Kit",
      "Force Signet",
      "Superconducting Signet",
      "Overclock Signet",
    ],
    selectedTraitIds: [
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
      TRAIT.MECH_CORE_J_DRIVE,
    ],
    target: { conditions: {} },
  };
  const sky = simulate("Mechanist", ["Sky Circus"], jDriveConfig);
  const missiles = sky.resolvedEvents.filter(
    (event) => event.type === "damage" && event.name === "Missile Damage",
  );
  assert.equal(missiles.length, 3);
  assert.ok(
    missiles.every(
      (event) => event.actorType === "summon" && event.coefficient === 0.6,
    ),
  );
  assert.equal(
    sky.resolvedEvents.find(
      (event) => event.type === "damage" && event.name === "Landing Damage",
    ).coefficient,
    1.2,
  );
  assert.ok(
    sky.events.some(
      (event) =>
        event.type === "control" &&
        event.skillName === "Sky Circus" &&
        event.controlKind === "knockdown",
    ),
  );

  const base = simulate("Mechanist", ["Puncturing Jab"], {
    target: { conditions: {} },
  });
  const standardSignetConfig = {
    selectedSkills: [
      "Rectifier Signet",
      "Grenade Kit",
      "Force Signet",
      "Shift Signet",
      "Overclock Signet",
    ],
    selectedTraitIds: [
      TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
      TRAIT.MECH_FRAME_CONDUCTIVE_ALLOYS,
      TRAIT.MECH_CORE_BARRIER_ENGINE,
    ],
    target: { conditions: {} },
  };
  const standardSigned = simulate(
    "Mechanist",
    ["Puncturing Jab"],
    standardSignetConfig,
  );
  const signed = simulate("Mechanist", ["Puncturing Jab"], jDriveConfig);
  const strike = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === "damage" && event.name === "Puncturing Jab",
    );
  assert.ok(
    Math.abs(strike(standardSigned).damage / strike(base).damage - 1.15) <
      1e-12,
  );
  assert.ok(
    Math.abs(strike(signed).damage / strike(base).damage - 1.18) < 1e-12,
  );

  const mechWithoutShift = simulate(
    "Mechanist",
    ["Core Reactor Shot", { type: "wait", durationMs: 1000 }],
    {
      ...standardSignetConfig,
      selectedTraitIds: [
        TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
        TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
        TRAIT.MECH_CORE_BARRIER_ENGINE,
      ],
      selectedSkills: standardSignetConfig.selectedSkills.filter(
        (skill) => skill !== "Shift Signet",
      ),
      boons: { might: 25 },
    },
  );
  const mechWithShift = simulate(
    "Mechanist",
    ["Core Reactor Shot", { type: "wait", durationMs: 1000 }],
    {
      ...standardSignetConfig,
      selectedTraitIds: [
        TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS,
        TRAIT.MECH_FRAME_VARIABLE_MASS_DISTRIBUTOR,
        TRAIT.MECH_CORE_BARRIER_ENGINE,
      ],
      boons: { might: 25 },
    },
  );
  const mechStrike = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === "damage" && event.name === "Core Reactor Shot",
    );
  assert.ok(
    Math.abs(
      mechStrike(mechWithShift).damage / mechStrike(mechWithoutShift).damage -
        1.375,
    ) < 1e-12,
  );
  assert.equal(
    engineerProfession
      .resolveRuntime({
        specialization: "Mechanist",
      })
      .modifyConditionDamage(
        {
          config: jDriveConfig,
          time: 0,
        },
        1,
      ),
    1.12,
  );

  const signetRecharge = simulate(
    "Mechanist",
    ["Force Signet", "Force Signet"],
    jDriveConfig,
  );
  const signetSteps = signetRecharge.steps.filter(
    (step) => step.skill === "Force Signet",
  );
  assert.equal(signetSteps[1].start - signetSteps[0].end, 22800);
});

test("Energy Amplifier adds Power and Healing Power during regeneration", () => {
  const context = {
    config: {
      traitIds: [TRAIT.ENERGY_AMPLIFIER],
      boons: { regeneration: true },
    },
    time: 0,
  };
  const attributes = engineerProfession
    .resolveRuntime({
      specialization: "Core",
    })
    .modifyAttributes(context, {
      power: 2000,
      precision: 1000,
      toughness: 1000,
      vitality: 1000,
      ferocity: 0,
      conditionDamage: 0,
      expertise: 0,
      concentration: 0,
      healingPower: 500,
    });
  assert.equal(attributes.power, 2250);
  assert.equal(attributes.healingPower, 750);
});

test("trait-coverage manifest covers all Engineer traits", () => {
  assert.equal(ENGINEER_TRAIT_COVERAGE.length, engineerCatalog.traits.length);
  assert.ok(ENGINEER_TRAIT_COVERAGE.every((entry) => entry.effects.length > 0));
  const coverage = (name) => {
    const trait = engineerCatalog.traits.find((entry) => entry.name === name);
    return ENGINEER_TRAIT_COVERAGE.find((entry) => entry.traitId === trait.id);
  };
  assert.equal(coverage("Aim-Assisted Rocket").status, "implemented");
  assert.equal(coverage("Carbolic Composition").status, "implemented");
  assert.equal(coverage("Grenadier").status, "implemented");
  assert.equal(coverage("Static Discharge").status, "implemented");
  assert.equal(coverage("Object in Motion").status, "implemented");
  assert.equal(
    ENGINEER_TRAIT_COVERAGE.some((entry) => entry.status === "pending"),
    false,
  );
});

test("power Holosmith sword-pistol preset preserves the supplied build", async () => {
  const [raw, savedRotation, manifest] = await Promise.all([
    readFile(
      new URL(
        "../../../Builds/engineer/b-power-holosmith-sword-pistol.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../../../Rotations/engineer/r-power-holosmith-sword-pistol-bench.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../../../Builds/engineer/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ]);

  assert.deepEqual(raw.specializations, [
    { name: "Explosives", traits: "3-2-3" },
    { name: "Firearms", traits: "3-3-1" },
    { name: "Holosmith", traits: "3-2-2" },
  ]);
  assert.ok(
    Object.entries(raw.gear).every(
      ([slot, prefix]) =>
        prefix ===
        (["Leggins", "Back"].includes(slot) ? "Dragon's" : "Berserker's"),
    ),
  );
  assert.deepEqual(raw.weapons, ["Sword", "Pistol"]);
  assert.equal(raw.rune, "Scholar");
  assert.deepEqual(raw.weaponSigils[0], ["Force", "Impact"]);
  assert.equal(raw.relic, "Fireworks");
  assert.equal(raw.food, "Cilantro Lime Sous-Vide Steak");
  assert.equal(raw.utility, "Superior Sharpening Stone");
  assert.deepEqual(raw.infusions, [
    { stat: "Power", count: 18 },
    { stat: "Precision", count: 0 },
    { stat: "Condition Damage", count: 0 },
  ]);
  assert.deepEqual(raw.selectedSkills, {
    Heal: "A.E.D.",
    Utility1: "Grenade Kit",
    Utility2: "Photon Wall",
    Utility3: "Laser Disk",
    Elite: "Prime Light Beam",
  });
  assert.equal(raw.initialHeat, 100);

  const preset = manifest
    .find((section) => section.section === "Holosmith")
    .presets.find(
      (entry) =>
        entry.build === "Builds/engineer/b-power-holosmith-sword-pistol.json",
    );
  assert.equal(
    preset.rotation,
    "Rotations/engineer/r-power-holosmith-sword-pistol-bench.json",
  );
  assert.equal(preset.benchmarkDps, 41663);
  assert.equal(preset.upToDate, true);
  assert.equal(savedRotation.metadata.benchmarkDurationSeconds, 95.28);
  assert.equal(savedRotation.metadata.benchmarkDamage, 3966303);
  assert.ok(
    Math.abs(savedRotation.metadata.benchmarkDps - 41627.86523929471) < 1e-9,
  );
  assert.ok(
    savedRotation.rotation.every(
      (entry) =>
        typeof entry === "string" ||
        ["interruptMs", "waitMs", "offset"].every(
          (key) => entry[key] == null || entry[key] % 40 === 0,
        ),
    ),
  );

  const build = migrateEngineerBuild({
    ...raw,
    rotation: savedRotation.rotation,
  });
  assert.equal(validateEngineerBuild(build).valid, true);
  const app = {
    build,
    skillByName: engineerCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);

  assert.deepEqual(result.warnings, []);
  assert.ok(Math.abs(result.dps - savedRotation.metadata.benchmarkDps) < 1500);
  assert.ok(Math.abs(result.strikeDamage - 3591298) < 100000);
  assert.ok(Math.abs(result.conditionDamage - 375005) < 35000);
  const packet = (name) =>
    result.breakdown.find((entry) => entry.name === name);
  for (const [name, hits, logDamage, tolerance] of [
    ["Laser Disk", 72, 302744, 5000],
    ["Shrapnel Grenade", 42, 220274, 2000],
    ["Particle Accelerator", 14, 190025, 3000],
    ["Refraction Cutter Blade", 80, 263142, 10000],
  ]) {
    assert.equal(packet(name).hits, hits, name);
    assert.ok(Math.abs(packet(name).damage - logDamage) < tolerance, name);
  }
  for (const [skill, count] of [
    ["Laser Disk", 4],
    ["Photon Wall", 5],
    ["Launch Wall", 5],
    ["Prime Light Beam", 2],
    ["Photon Blitz", 6],
    ["Corona Burst", 12],
    ["Grenade Barrage", 5],
    ["Refraction Cutter", 17],
    ["Particle Accelerator", 14],
    ["Blade Burst", 6],
  ]) {
    assert.equal(
      result.steps.filter((step) => step.skill === skill).length,
      count,
      skill,
    );
  }
});

test("condition Holosmith pistol benchmark preserves the supplied log", async () => {
  const [raw, savedRotation, manifest] = await Promise.all([
    readFile(
      new URL(
        "../../../Builds/engineer/b-condi-holosmith-pistol-pistol.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../../../Rotations/engineer/r-condi-holosmith-pistol-pistol-bench.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../../../Builds/engineer/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ]);

  assert.deepEqual(raw.specializations, [
    { name: "Explosives", traits: "3-1-2" },
    { name: "Firearms", traits: "1-2-3" },
    { name: "Holosmith", traits: "3-1-3" },
  ]);
  assert.ok(
    Object.entries(raw.gear).every(
      ([slot, prefix]) => prefix === (slot === "Back" ? "Sinister" : "Viper's"),
    ),
  );
  assert.deepEqual(raw.weapons, ["Pistol", "Pistol"]);
  assert.equal(raw.rune, "Trapper");
  assert.deepEqual(raw.weaponSigils[0], ["Bursting", "Earth"]);
  assert.equal(raw.relic, "Fractal");
  assert.equal(raw.food, "Cilantro and Cured Meat Flatbread");
  assert.equal(raw.utility, "Toxic Tuning Crystal");
  assert.deepEqual(raw.infusions, [
    { stat: "Power", count: 0 },
    { stat: "Precision", count: 0 },
    { stat: "Condition Damage", count: 18 },
  ]);
  assert.deepEqual(raw.selectedSkills, {
    Heal: "Healing Turret",
    Utility1: "Grenade Kit",
    Utility2: "Bomb Kit",
    Utility3: "Flamethrower",
    Elite: "Prime Light Beam",
  });
  assert.equal(raw.initialHeat, 79);

  const preset = manifest
    .find((section) => section.section === "Holosmith")
    .presets.find(
      (entry) =>
        entry.build === "Builds/engineer/b-condi-holosmith-pistol-pistol.json",
    );
  assert.equal(
    preset.rotation,
    "Rotations/engineer/r-condi-holosmith-pistol-pistol-bench.json",
  );
  assert.equal(preset.benchmarkDps, 42974);
  assert.equal(preset.upToDate, true);
  assert.equal(savedRotation.metadata.benchmarkDurationSeconds, 91.997);
  assert.equal(savedRotation.metadata.benchmarkDamage, 3950966);
  assert.ok(
    Math.abs(savedRotation.metadata.benchmarkDps - 42946.6830440123) < 1e-9,
  );
  assert.equal(savedRotation.rotation.length, 207);
  assert.ok(
    savedRotation.rotation.every(
      (entry) =>
        typeof entry !== "object" ||
        entry.interruptMs == null ||
        entry.interruptMs % 40 === 0,
    ),
  );

  const build = migrateEngineerBuild({
    ...raw,
    rotation: savedRotation.rotation,
  });
  assert.equal(validateEngineerBuild(build).valid, true);
  const app = {
    build,
    skillByName: engineerCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);

  assert.deepEqual(result.warnings, []);
  assert.ok(Math.abs(result.dps - 42946.6830440123) < 500);
  assert.ok(Math.abs(result.strikeDamage - 831540) < 25000);
  for (const [skill, count] of [
    ["Corona Burst", 9],
    ["Photon Blitz", 6],
    ["Poison Dart Volley", 11],
    ["Static Shot", 8],
    ["Blowtorch", 8],
    ["Prime Light Beam", 2],
    ["Shrapnel Grenade", 14],
    ["Poison Grenade", 5],
    ["Flame Blast", 10],
    ["Fire Bomb", 11],
    ["Grenade Barrage", 4],
  ]) {
    assert.equal(
      result.steps.filter((step) => step.skill === skill).length,
      count,
      skill,
    );
  }

  const applications = (condition, skillName) =>
    result.resolvedEvents.filter(
      (event) =>
        event.type === "condition" &&
        event.comboId == null &&
        event.condition === condition &&
        event.skillName === skillName &&
        event.sourceId === engineerCatalog.skillsByName.get(skillName).id,
    );
  assert.equal(applications("Poisoned", "Poison Dart Volley").length, 55);
  assert.equal(applications("Burning", "Photon Blitz").length, 48);
  assert.equal(applications("Burning", "Corona Burst").length, 17);
  assert.ok(
    applications("Burning", "Corona Burst").every(
      (event) => event.stacks === 2 && event.duration === 5,
    ),
  );
  assert.equal(applications("Burning", "Prime Light Beam").length, 20);
  assert.equal(applications("Burning", "Blowtorch").length, 8);
  assert.ok(
    applications("Burning", "Blowtorch").every(
      (event) => event.stacks === 3 && event.duration === 4.5,
    ),
  );
  assert.equal(applications("Bleeding", "Shrapnel Grenade").length, 42);
  assert.equal(applications("Bleeding", "Fragmentation Shot").length, 5);

  const conditionDamage = (condition) =>
    result.resolvedEvents
      .filter(
        (event) => event.type === "condition" && event.condition === condition,
      )
      .flatMap((event) => event.damageTicks || [])
      .reduce((total, tick) => total + Number(tick.damage || 0), 0);
  assert.ok(Math.abs(conditionDamage("Burning") - 1883855) < 15000);
  assert.ok(Math.abs(conditionDamage("Poisoned") - 374154) < 15000);
  // The log rolled 15 more stochastic bleed proc applications than the
  // deterministic expectation; direct bleed applications match exactly.
  assert.ok(Math.abs(conditionDamage("Bleeding") - 654168) < 45000);
  assert.ok(Math.abs(conditionDamage("Torment") - 69357) < 2500);
  assert.ok(Math.abs(conditionDamage("Confusion") - 137892) < 5000);
});

test("power Amalgam hammer Symbiotic preset preserves supplied build and log", async () => {
  const [raw, savedRotation, manifest] = await Promise.all([
    readFile(
      new URL(
        "../../../Builds/engineer/b-power-amalgam-hammer-symbiotic.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../../../Rotations/engineer/r-power-amalgam-hammer-symbiotic-bench.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../../../Builds/engineer/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ]);

  assert.ok(
    Object.values(raw.gear).every((prefix) => prefix === "Berserker's"),
  );
  assert.deepEqual(raw.weapons, ["Hammer", ""]);
  assert.equal(raw.rune, "Scholar");
  assert.deepEqual(raw.weaponSigils[0], ["Force", "Impact"]);
  assert.equal(raw.relic, "Bloodstone");
  assert.equal(raw.food, "Cilantro Lime Sous-Vide Steak");
  assert.equal(raw.utility, "Superior Sharpening Stone");
  assert.deepEqual(raw.infusions, [
    { stat: "Power", count: 18 },
    { stat: "Precision", count: 0 },
    { stat: "Condition Damage", count: 0 },
  ]);
  assert.deepEqual(raw.specializations, [
    { name: "Explosives", traits: "3-2-3" },
    { name: "Firearms", traits: "3-3-2" },
    { name: "Amalgam", traits: "2-2-1" },
  ]);
  assert.deepEqual(raw.selectedSkills, {
    Heal: "A.E.D.",
    Utility1: "Grenade Kit",
    Utility2: "Bomb Kit",
    Utility3: "Throw Mine",
    Elite: "Flux State",
  });
  assert.deepEqual(raw.selectedMorphSkillIds, [76927, 77104, 76705]);
  assert.equal(raw.initialHeat, 100);
  assert.equal(raw.targetHealth, 3966303);

  const preset = manifest
    .find((section) => section.section === "Amalgam")
    .presets.find(
      (entry) =>
        entry.build === "Builds/engineer/b-power-amalgam-hammer-symbiotic.json",
    );
  assert.equal(preset.label, "Power (Hammer - Symbiotic)");
  assert.equal(
    preset.rotation,
    "Rotations/engineer/r-power-amalgam-hammer-symbiotic-bench.json",
  );
  assert.equal(
    preset.dpsReportUrl,
    "https://dps.report/sVjd-poweramalgamsymbiotic_golem",
  );
  assert.equal(preset.benchmarkDps, 42201);
  assert.equal(preset.upToDate, true);
  assert.equal(savedRotation.metadata.benchmarkDurationSeconds, 94.202);
  assert.equal(savedRotation.metadata.benchmarkDamage, 3973116);
  assert.ok(
    Math.abs(savedRotation.metadata.benchmarkDps - 42176.556761002954) < 1e-9,
  );
  assert.equal(savedRotation.rotation.length, 197);
  assert.deepEqual(savedRotation.rotation.slice(0, 5), [
    "Throw Mine",
    { name: "__wait", waitMs: 5000 },
    "Bomb Kit",
    "Big Ol' Bomb",
    "Magnetic Bomb",
  ]);
  assert.equal(
    savedRotation.rotation.filter(
      (entry) => typeof entry === "object" && entry.interruptMs != null,
    ).length,
    1,
  );

  const build = migrateEngineerBuild({
    ...raw,
    rotation: savedRotation.rotation,
  });
  assert.equal(validateEngineerBuild(build).valid, true);
  const app = {
    build,
    skillByName: engineerCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);

  assert.deepEqual(result.warnings, []);
  assert.ok(
    Math.abs(result.dps - savedRotation.metadata.benchmarkDps) /
      savedRotation.metadata.benchmarkDps <
      0.05,
    `${result.dps} vs ${savedRotation.metadata.benchmarkDps}`,
  );
  const steps = (name) => result.steps.filter((step) => step.skill === name);
  const packet = (name) =>
    result.breakdown.find((entry) => entry.name === name);
  assert.equal(steps("Offensive Protocol: Demolish").length, 10);
  assert.equal(steps("Offensive Protocol: Obliterate").length, 10);
  assert.equal(steps("Defensive Protocol: Thorns").length, 10);
  assert.equal(steps("Evolve").length, 5);
  assert.equal(steps("Flux State").length, 3);
  assert.equal(packet("Rapacious Strain").hits, 54);
  assert.ok(
    result.resolvedEvents
      .filter(
        (event) => event.type === "damage" && event.name === "Rapacious Strain",
      )
      .every((event) => event.coefficient === 0.3),
  );
  assert.ok(
    Math.abs(steps("Combat Start")[0].start / 1000 - result.dpsStartTime) <
      1e-9,
  );
  assert.ok(
    steps("Offensive Protocol: Demolish").every(
      (step) => step.end - step.start === 1560,
    ),
  );
  const smashes = result.resolvedEvents.filter(
    (event) => event.type === "damage" && event.name === "Smash Damage",
  );
  assert.deepEqual(
    smashes.map((event, index) =>
      Math.round(
        (event.at - steps("Offensive Protocol: Demolish")[index].start / 1000) *
          1000,
      ),
    ),
    Array(10).fill(1560),
  );
});

test("condition alacrity Amalgam benchmark preset preserves supplied build", async () => {
  const [raw, savedRotation, manifest] = await Promise.all([
    readFile(
      new URL(
        "../../../Builds/engineer/b-condi-alac-amalgam-2kit.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../../../Rotations/engineer/r-condi-alac-amalgam-2kit-bench.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../../../Builds/engineer/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ]);
  assert.deepEqual(raw.specializations, [
    { name: "Explosives", traits: "3-1-2" },
    { name: "Firearms", traits: "1-2-3" },
    { name: "Amalgam", traits: "3-1-2" },
  ]);
  assert.deepEqual(raw.selectedMorphSkillIds, [77103, 77104, 76705]);
  assert.equal(raw.gear.Gloves, "Sinister");
  assert.equal(raw.gear.Boots, "Sinister");
  assert.equal(raw.gear.Back, "Sinister");
  assert.equal(raw.gear.Weapon1, "Viper's");
  assert.equal(raw.rune, "Trapper");
  assert.deepEqual(raw.weaponSigils[0], ["Doom", "Earth"]);
  assert.equal(raw.relic, "Fractal");
  assert.equal(raw.assumptions.inDamagingField, false);
  assert.deepEqual(raw.infusions, [
    { stat: "Power", count: 0 },
    { stat: "Precision", count: 0 },
    { stat: "Condition Damage", count: 18 },
  ]);
  const preset = manifest[0].presets.find(
    (entry) => entry.build === "Builds/engineer/b-condi-alac-amalgam-2kit.json",
  );
  assert.equal(
    preset.rotation,
    "Rotations/engineer/r-condi-alac-amalgam-2kit-bench.json",
  );
  assert.equal(savedRotation.rotation.length, 248);

  const build = migrateEngineerBuild({
    ...raw,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    skillByName: engineerCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);

  assert.deepEqual(result.warnings, []);
  assert.ok(Math.abs(result.dps - 35922) < 500);
  assert.equal(
    result.steps.filter((step) => step.skill === "Shrapnel Grenade").length,
    21,
  );
  assert.equal(
    result.steps.filter((step) => step.skill === "Defensive Protocol: Thorns")
      .length,
    7,
  );
  assert.equal(
    result.procSteps.filter((step) => step.skill === "Rapacious Strain").length,
    44,
  );
  assert.ok(
    result.procSteps
      .filter((step) => step.skill === "Rapacious Strain")
      .every(
        (step) =>
          step.icon ===
          "https://render.guildwars2.com/file/" +
            "5B565BA46C111902EE65AB4592590442A5A6E754/3680135.png",
      ),
  );
  // Devastator is a core Engineer spear skill, so its six casts do not trigger
  // Carbolic Composition's Amalgam-skill poison. The 44 Rapacious hits do.
  assert.equal(
    result.resolvedEvents.filter(
      (event) =>
        event.type === "condition" &&
        event.skillName === "Carbolic Composition",
    ).length,
    124,
  );
  assert.equal(
    result.resolvedEvents.some(
      (event) =>
        event.skillName === "Carbolic Composition" &&
        event.triggeredBy === "Devastator",
    ),
    false,
  );
  assert.equal(
    result.resolvedEvents.filter(
      (event) =>
        event.type === "condition" &&
        event.skillName === "Offensive Protocol: Shred" &&
        event.condition === "Burning" &&
        event.comboId != null,
    ).length,
    18,
  );
  const bleedingDamage = result.breakdown
    .filter((entry) => entry.name.endsWith("— Bleeding"))
    .reduce((total, entry) => total + entry.damage, 0);
  assert.ok(
    Math.abs(bleedingDamage - 928772.9) < 2,
    `Unexpected bleeding damage: ${bleedingDamage}`,
  );
  const conduit = result.breakdown.find(
    (entry) => entry.name === "Conduit Surge",
  );
  assert.equal(conduit.hits, 22);
  assert.ok(
    Math.abs(conduit.damage - 78385.39) < 2,
    `Unexpected Conduit Surge damage: ${conduit.damage}`,
  );
});

test("condition Amalgam three-kit benchmark preserves the supplied log", async () => {
  const [raw, savedRotation, manifest] = await Promise.all([
    readFile(
      new URL(
        "../../../Builds/engineer/b-condi-amalgam-3kit.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../../../Rotations/engineer/r-condi-amalgam-3kit-bench.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../../../Builds/engineer/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ]);

  assert.deepEqual(raw.specializations, [
    { name: "Explosives", traits: "3-1-2" },
    { name: "Firearms", traits: "1-2-3" },
    { name: "Amalgam", traits: "2-1-3" },
  ]);
  assert.ok(
    Object.entries(raw.gear).every(
      ([slot, prefix]) => prefix === (slot === "Back" ? "Sinister" : "Viper's"),
    ),
  );
  assert.equal(raw.rune, "Trapper");
  assert.deepEqual(raw.weaponSigils[0], ["Bursting", "Earth"]);
  assert.equal(raw.relic, "Fractal");
  assert.equal(raw.food, "Cilantro and Cured Meat Flatbread");
  assert.deepEqual(raw.infusions, [
    { stat: "Power", count: 0 },
    { stat: "Precision", count: 0 },
    { stat: "Condition Damage", count: 18 },
  ]);
  assert.deepEqual(raw.selectedMorphSkillIds, [77103, 77104, 76705]);
  assert.deepEqual(raw.selectedSkills, {
    Heal: "Healing Turret",
    Utility1: "Grenade Kit",
    Utility2: "Flamethrower",
    Utility3: "Bomb Kit",
    Elite: "Flux State",
  });
  assert.equal(raw.assumptions.inDamagingField, false);

  const preset = manifest[0].presets.find(
    (entry) => entry.build === "Builds/engineer/b-condi-amalgam-3kit.json",
  );
  assert.equal(
    preset.rotation,
    "Rotations/engineer/r-condi-amalgam-3kit-bench.json",
  );
  assert.equal(preset.benchmarkDps, 43687);
  assert.equal(preset.upToDate, true);
  assert.equal(savedRotation.metadata.benchmarkDurationSeconds, 91.196);
  assert.equal(savedRotation.metadata.benchmarkDamage, 3975477);
  assert.ok(
    Math.abs(savedRotation.metadata.benchmarkDps - 43592.66853809378) < 1e-9,
  );
  assert.equal(savedRotation.rotation.length, 213);

  const rotationName = (entry) =>
    typeof entry === "string" ? entry : entry.name;
  const devastatorIndexes = savedRotation.rotation
    .map((entry, index) => [rotationName(entry), index])
    .filter(([name]) => name === "Devastator")
    .map(([, index]) => index);
  assert.equal(devastatorIndexes.length, 6);
  assert.ok(
    devastatorIndexes.every((index) =>
      rotationName(savedRotation.rotation[index - 1]).startsWith("Stow "),
    ),
  );

  const build = migrateEngineerBuild({
    ...raw,
    rotation: savedRotation.rotation,
  });
  const app = {
    build,
    skillByName: engineerCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const result = runSimulation(app);

  assert.deepEqual(result.warnings, []);
  const serratedSteelSources = new Set(
    result.procSteps
      .filter((step) => step.skill === "Serrated Steel")
      .map((step) => step.sourceSkill),
  );
  for (const source of [
    "Rapacious Strain",
    "Aim-Assisted Rocket",
    "Orbital Command Strike",
  ]) {
    assert.equal(serratedSteelSources.has(source), true, source);
  }
  assert.equal(
    simulationEventLogRows(result, build, engineerProfession).some((row) =>
      row.description.includes("Heat"),
    ),
    false,
  );
  assert.ok(Math.abs(result.dps - 43766) < 750);
  for (const [skill, count] of [
    ["Shrapnel Grenade", 16],
    ["Fire Bomb", 11],
    ["Galvanic Bomb", 6],
    ["Big Ol' Bomb", 6],
    ["Magnetic Bomb", 3],
    ["Defensive Protocol: Thorns", 6],
    ["Offensive Protocol: Obliterate", 6],
    ["Devastator", 6],
  ]) {
    assert.equal(
      result.steps.filter((step) => step.skill === skill).length,
      count,
      skill,
    );
  }
  assert.equal(
    result.breakdown.find((entry) => entry.name === "Magnetic Bomb").hits,
    3,
  );
  const obliterateHits = result.resolvedEvents.filter(
    (event) =>
      event.type === "damage" &&
      event.name === "Offensive Protocol: Obliterate",
  );
  const obliterateSteps = result.steps.filter(
    (step) => step.skill === "Offensive Protocol: Obliterate",
  );
  assert.equal(obliterateHits.length, 6);
  assert.deepEqual(
    obliterateHits.map((event, index) =>
      Math.round((event.at - obliterateSteps[index].start / 1000) * 1000),
    ),
    Array(6).fill(640),
  );
});

test("power Scrapper hammer preset preserves the supplied build and log", async () => {
  const [raw, savedRotation, manifest] = await Promise.all([
    readFile(
      new URL(
        "../../../Builds/engineer/b-power-scrapper-hammer.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL(
        "../../../Rotations/engineer/r-power-scrapper-hammer-bench.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse),
    readFile(
      new URL("../../../Builds/engineer/manifest.json", import.meta.url),
      "utf8",
    ).then(JSON.parse),
  ]);

  assert.deepEqual(raw.specializations, [
    { name: "Explosives", traits: "3-2-3" },
    { name: "Firearms", traits: "3-3-1" },
    { name: "Scrapper", traits: "1-3-3" },
  ]);
  const dragonSlots = new Set([
    "Leggins",
    "Ring1",
    "Ring2",
    "Accessory1",
    "Back",
  ]);
  assert.ok(
    Object.entries(raw.gear).every(
      ([slot, prefix]) =>
        prefix === (dragonSlots.has(slot) ? "Dragon's" : "Berserker's"),
    ),
  );
  assert.deepEqual(raw.weapons, ["Hammer", ""]);
  assert.equal(raw.rune, "Dragonhunter");
  assert.deepEqual(raw.weaponSigils[0], ["Force", "Impact"]);
  assert.equal(raw.relic, "Bloodstone");
  assert.equal(raw.food, "Cilantro Lime Sous-Vide Steak");
  assert.equal(raw.utility, "Superior Sharpening Stone");
  assert.deepEqual(raw.infusions, [
    { stat: "Power", count: 18 },
    { stat: "Precision", count: 0 },
    { stat: "Condition Damage", count: 0 },
  ]);
  assert.deepEqual(raw.selectedSkills, {
    Heal: "Medic Gyro",
    Utility1: "Grenade Kit",
    Utility2: "Throw Mine",
    Utility3: "Bomb Kit",
    Elite: "Elite Mortar Kit",
  });

  const preset = manifest
    .find((section) => section.section === "Scrapper")
    .presets.find(
      (entry) => entry.build === "Builds/engineer/b-power-scrapper-hammer.json",
    );
  assert.equal(
    preset.rotation,
    "Rotations/engineer/r-power-scrapper-hammer-bench.json",
  );
  assert.equal(
    preset.dpsReportUrl,
    "https://dps.report/55xd-20260422-192633_golem",
  );
  assert.equal(preset.benchmarkDps, 41446);
  assert.equal(preset.upToDate, true);
  assert.equal(savedRotation.metadata.benchmarkDurationSeconds, 94.247);
  assert.equal(savedRotation.metadata.benchmarkDamage, 3977935);
  assert.ok(
    Math.abs(savedRotation.metadata.benchmarkDps - 42207.55037295617) < 1e-9,
  );
  assert.equal(savedRotation.rotation.length, 239);
  assert.equal(
    savedRotation.rotation.some(
      (entry) =>
        typeof entry === "object" &&
        entry.name === "Positive Strike" &&
        entry.interruptMs != null,
    ),
    false,
  );

  const build = migrateEngineerBuild({
    ...raw,
    rotation: savedRotation.rotation,
  });
  assert.equal(validateEngineerBuild(build).valid, true);
  const app = {
    build,
    skillByName: engineerCatalog.skillsByName,
    attributeWeaponSet: 1,
  };
  recalculate(app);
  const activeTraitNames = new Set(
    app.attributeData.activeTraits.map((trait) => trait.name),
  );
  assert.equal(activeTraitNames.has("Explosive Temper"), true);
  assert.equal(activeTraitNames.has("Big Boomer"), true);
  assert.equal(activeTraitNames.has("Blast Shield"), false);
  const result = runSimulation(app);

  assert.deepEqual(result.warnings, []);
  assert.ok(Math.abs(result.dpsWindow - 94.247) < 0.75);
  assert.ok(Math.abs(result.dps - savedRotation.metadata.benchmarkDps) < 1500);
  assert.ok(Math.abs(result.strikeDamage - 3766547) < 150000);
  assert.ok(Math.abs(result.conditionDamage - 222207) < 10000);
  for (const [name, logDamage, tolerance] of [
    ["Electro-whirl", 638776, 25000],
    ["Shrapnel Grenade", 349341, 10000],
    ["Thunderclap", 308032, 15000],
    ["Bloodstone Explosion", 142345, 5000],
  ]) {
    const packet = result.breakdown.find((entry) => entry.name === name);
    assert.ok(Math.abs(packet.damage - logDamage) < tolerance, name);
  }
  assert.equal(
    result.breakdown
      .filter(
        (entry) =>
          entry.name === "Damage per Mine" &&
          entry.sourceSkill === "Mine Field",
      )
      .reduce((hits, entry) => hits + entry.hits, 0),
    30,
  );
  const mineRows = skillBreakdownRows(result).filter(
    (row) => row.name === "Mine Field" || row.name === "Detonate Mine Field",
  );
  assert.equal(mineRows.length, 1);
  assert.equal(mineRows[0].name, "Mine Field");
  assert.equal(mineRows[0].hits, 30);
  assert.equal(
    result.breakdown.find((entry) => entry.name === "Bloodstone Explosion")
      .hits,
    6,
  );
  for (const [skill, count] of [
    ["Electro-whirl", 17],
    ["Shrapnel Grenade", 17],
    ["Poison Gas Shell", 7],
    ["Mine Field", 5],
    ["Detonate Mine Field", 5],
    ["Medic Gyro", 5],
    ["Function Gyro", 4],
    ["Grenade Barrage", 4],
  ]) {
    assert.equal(
      result.steps.filter((step) => step.skill === skill).length,
      count,
      skill,
    );
  }
});

test("Engineer is a loadable native application", async () => {
  assert.equal(professionRoute("engineer"), "engineer.html");
  assert.equal((await loadProfession("engineer")).id, "engineer");
  assert.equal(
    (await loadProfessionAppAdapter("engineer")).profession.id,
    "engineer",
  );
  const html = await readFile(
    new URL("../../../engineer.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /data-profession="engineer"/);
  assert.match(html, /Engineer<\/span> Rotation Simulator/);
});
