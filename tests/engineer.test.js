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
  createEngineerBuildDefaults,
  migrateEngineerBuild,
  toApplicationBuild,
  validateEngineerBuild,
} from "../js/professions/engineer/build.js";
import {
  ENGINEER_AUTOATTACK_CHAINS,
  engineerCatalog,
} from "../js/professions/engineer/catalog.js";
import {
  DATA_SNAPSHOT,
} from "../js/professions/engineer/data/engineer-api-metadata.js";
import {
  ENGINEER_SUPPLEMENTAL_SKILLS,
} from "../js/professions/engineer/data/engineer-supplemental-skills.js";
import {
  ENGINEER_TRAIT_COVERAGE,
} from "../js/professions/engineer/data/trait-coverage.js";
import {
  ENGINEER_TRAIT_IDS as TRAIT,
} from "../js/professions/engineer/data/ids.js";
import {
  ENGINEER_SKILL_MECHANICS,
} from "../js/professions/engineer/mechanics/skill-mechanics.js";
import {
  engineerProfession,
} from "../js/professions/engineer/definition.js";

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

function simulate(specialization, rotation, config = {}) {
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
  });
}

test("Engineer catalog pins API identity and explicit skill mechanics", () => {
  assert.equal(DATA_SNAPSHOT, "2026-07-28");
  assert.equal(engineerCatalog.specializations.length, 9);
  assert.equal(engineerCatalog.traits.length, 108);
  assert.ok(engineerCatalog.skills.length >= 330);
  assert.equal(engineerCatalog.skillsById.get(5842).name, "Bomb");
  assert.equal(engineerCatalog.skillsByName.get("Bomb").effects[0].coefficient, 1.2);
  assert.match(
    engineerCatalog.skillsById.get(5806).icon,
    /Special:Redirect\/file\/Poison_Grenade\.png$/,
  );
  assert.equal(
    engineerCatalog.skillsByName.get("Flame Jet").icon,
    "https://render.guildwars2.com/file/"
      + "2CDBD11894D945140B3480BFEC960800086352E5/103269.png",
  );
  assert.equal(
    engineerCatalog.skillsByName.get("Bandage Blast").icon,
    "https://render.guildwars2.com/file/"
      + "F473E7A5D7D301A3B813443812C73338C073ABB2/102898.png",
  );
  assert.equal(
    engineerCatalog.skillsByName.get("Stow Flamethrower").icon,
    "https://render.guildwars2.com/file/"
      + "7342BF326738A4C5132F42CE0915D3A2184E52FB/60975.png",
  );
  assert.equal(
    engineerCatalog.skillsByName.get("Jade Energy Shot").icon,
    "https://render.guildwars2.com/file/"
      + "73600241FA662501C5D617719A7B4792F30B2846/2503622.png",
  );
  assert.ok(engineerCatalog.skills
    .filter(skill =>
      skill.specialization === "Amalgam"
      && skill.categories?.includes("Morph"))
    .every(skill => skill.icon.startsWith("https://render.guildwars2.com/")));
  assert.equal(engineerCatalog.skillsById.has(6175), false);
  assert.equal(engineerCatalog.skillsById.has(58090), false);
  const poisonGrenade = ENGINEER_SKILL_MECHANICS[5806];
  assert.equal(poisonGrenade.castTimeMs, 500);
  assert.equal(poisonGrenade.quicknessCastTimeMs, 680);
  assert.equal(poisonGrenade.effects[0].coefficient, 2.25);
  assert.equal(poisonGrenade.effects[1].condition, "Poisoned");
  assert.ok(ENGINEER_SUPPLEMENTAL_SKILLS.every(skill =>
    !Object.hasOwn(skill, "effects")
    && !Object.hasOwn(skill, "cooldown")
    && !Object.hasOwn(skill, "recharge")));
});

test("Holosmith palette exposes tool-belt skills, forge, and replacement bars", () => {
  const build = createEngineerBuildDefaults();
  const groups = engineerProfession.ui.paletteGroups({
    build,
    specialization: "Holosmith",
    professionState: { photonForgeActive: false },
  });
  const profession = groups.find(group => group.id === "engineer-profession");
  const grenade = groups.find(group => group.label === "Gren");
  const forge = groups.find(group => group.id === "engineer-forge");
  const names = group => group.skillIds.map(id =>
    engineerCatalog.skillsById.get(id).name);

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
  assert.equal(forge.skillIds.length, 7);
  assert.ok(names(forge).every(name => !name.endsWith("—Storm")));
});

test("Engineer defaults migrate and validate morph branch choices", () => {
  const defaults = createEngineerBuildDefaults();
  assert.equal(defaults.assumptions.inDamagingField, false);
  assert.deepEqual(
    engineerProfession.ui.assumptionControls.find(
      control => control.key === "inDamagingField",
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
  assert.equal(validateEngineerBuild({
    ...defaults,
    selectedMorphSkillIds: [77103, 77203, 77285],
  }).valid, false);
  assert.equal(validateEngineerBuild({
    ...defaults,
    selectedMorphSkillIds: [77103, 76866, 76954],
  }).valid, false);
  assert.deepEqual(migrateEngineerBuild({
    ...defaults,
    selectedMorphSkillIds: [77103, 76866, 76954],
  }).selectedMorphSkillIds, [77103, 77203, 76954]);
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
  assert.ok(result.events.some(event => event.type === "sigil_swap"));

  const weaponDenied = simulate("Core", [
    "Grenade Kit",
    "Blunderbuss",
  ]);
  assert.match(weaponDenied.warnings[0], /active kit.*replaces weapon skills/);

  for (const exitSkill of ["Stow Grenade Kit", "Swap Weapons"]) {
    const exited = simulate("Core", [
      "Grenade Kit",
      exitSkill,
      "Blunderbuss",
    ]);
    assert.equal(exited.warnings.length, 0, exitSkill);
    assert.equal(exited.endState.profession.activeKit, "", exitSkill);
    assert.equal(exited.endState.activeWeaponSet, 1, exitSkill);
  }

  const swapDenied = simulate("Core", ["Swap Weapons"]);
  assert.match(swapDenied.warnings[0], /only to leave an active kit/);
});

test("Engineer kit palettes stack and include their linked stow skills", () => {
  const groups = engineerProfession.ui.paletteGroups({
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
  }).filter(group => group.stackId === "engineer-kits");
  const names = group => group.skillIds.map(id =>
    engineerCatalog.skillsById.get(id).name);

  assert.deepEqual(
    groups.map(group => group.label),
    ["Gren", "Flam", "Bomb", "Med", "Tool"],
  );
  assert.deepEqual(
    groups.map(group => names(group).at(-1)),
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
  const group = engineerProfession.ui.paletteGroups(context)
    .find(candidate => candidate.id === "engineer-profession");

  assert.equal(group.includeActionSkills, true);
  const expected = [
    "Regenerating Mist",
    "Grenade Barrage",
    "Mine Field",
    "Surprise Shot (engineer skill)",
    "Function Gyro",
  ];
  assert.deepEqual(group.skillIds.map(id =>
    engineerCatalog.skillsById.get(id).name), expected);
  const skillBarGroups = engineerProfession.ui.skillBarGroups(context);
  assert.deepEqual(skillBarGroups.map(candidate => candidate.label), [
    "F1",
    "F2",
    "F3",
    "F4",
    "F5",
  ]);
  assert.deepEqual(skillBarGroups.map(candidate =>
    engineerCatalog.skillsById.get(candidate.skillIds[0]).name), expected);
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
  assert.deepEqual(core.map(group =>
    engineerCatalog.skillsById.get(group.skillIds[0]).name), [
    "Regenerating Mist",
    "Grenade Barrage",
    "Mine Field",
    "Surprise Shot (engineer skill)",
    "Med Pack Drop",
  ]);

  const mechanist = engineerProfession.ui.skillBarGroups({
    specialization: "Mechanist",
    build: {
      selectedSkills,
      specializations: [{
        name: "Mechanist",
        traits: "3-2-2",
      }],
    },
    professionState: { mech: { active: true } },
  });
  assert.deepEqual(mechanist.map(group =>
    engineerCatalog.skillsById.get(group.skillIds[0]).name), [
    "Spark Revolver",
    "Crisis Zone",
    "Barrier Burst",
    "Recall Mech",
  ]);
});

test("Engineer slot selection excludes contextual and unsupported utilities", () => {
  const selectable = name => engineerProfession.ui.isSlotSkillSelectable(
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
});

test("detonating a turret cancels its remaining summoned attacks", () => {
  const config = {
    selectedSkills: [...baseConfig.selectedSkills, "Rifle Turret"],
  };
  const active = simulate("Core", [
    "Rifle Turret",
    { type: "wait", durationMs: 10000 },
  ], config);
  const detonated = simulate("Core", [
    "Rifle Turret",
    "Detonate Rifle Turret",
    { type: "wait", durationMs: 10000 },
  ], config);
  const turretHits = result => result.resolvedEvents.filter(event =>
    event.type === "damage"
    && event.name === "Rifle Turret"
    && event.actorType === "summon");
  assert.equal(turretHits(active).length, 5);
  assert.equal(turretHits(detonated).length, 1);
  assert.equal(
    detonated.resolvedEvents.filter(event =>
      event.type === "damage"
      && event.name === "Detonate Rifle Turret").length,
    1,
  );
});

test("Engineer contextual weapon follow-ups are not standalone selections", () => {
  const rifleGrenade = engineerCatalog.skillsByName.get(
    "Rifle Burst Grenade",
  );
  assert.equal(rifleGrenade.simulatorExcluded, true);
  assert.equal(
    ENGINEER_AUTOATTACK_CHAINS.some(chain =>
      chain.includes(rifleGrenade.id)),
    false,
  );

  const rifleBurst = simulate("Core", ["Rifle Burst"]);
  assert.equal(rifleBurst.warnings.length, 0);
  assert.ok(rifleBurst.resolvedEvents.some(event =>
    event.name === "Rifle Burst Grenade"));

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
    selectedSkills: ["Healing Turret", "Throw Mine", "Rifle Turret", "Supply Crate"],
  });
  assert.match(denied.warnings[0], /Grenade Kit is not equipped/);
});

test("Photon Forge heat generation and cooling use current piecewise rates", () => {
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
    { type: "wait", durationMs: 5000 },
  ]);
  assert.equal(cooled.endState.profession.heat, 0);
});

test("Photon Forge overheats at its trait-adjusted maximum", () => {
  const core = simulate("Holosmith", [
    "Engage Photon Forge",
    { type: "wait", durationMs: 50000 },
  ]);
  assert.equal(core.endState.profession.heat, 100);
  assert.equal(core.endState.profession.overheated, true);
  assert.equal(core.endState.profession.photonForgeActive, false);

  const enhanced = simulate("Holosmith", [], {
    initialHeat: 149,
    selectedTraitIds: [TRAIT.ENHANCED_CAPACITY_STORAGE_UNIT],
  });
  assert.equal(enhanced.endState.profession.maximumHeat, 150);
  assert.equal(enhanced.endState.profession.heat, 149);
});

test("Mechanist commands are selected by traits and mech attacks persist", () => {
  const result = simulate("Mechanist", [
    "Spark Revolver",
    { type: "wait", durationMs: 1500 },
  ], {
    selectedTraitIds: [
      TRAIT.MECH_ARMS_JADE_CANNONS,
      TRAIT.MECH_FRAME_CHANNELING_CONDUITS,
      TRAIT.MECH_CORE_BARRIER_ENGINE,
    ],
  });
  assert.equal(result.warnings.length, 0);
  assert.deepEqual(
    result.profession.mech.commandSkillIds.map(id =>
      engineerCatalog.skillsById.get(id).name),
    ["Spark Revolver", "Crisis Zone", "Barrier Burst"],
  );
  assert.ok(result.resolvedEvents.some(event =>
    event.skillName === "Jade Energy Shot" && event.actorType === "summon"));
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
  assert.deepEqual(groups.map(group => group.label), [
    "F1",
    "F2 Protocol",
    "F3 Protocol",
    "F4 Protocol",
    "F5",
  ]);
  assert.deepEqual(groups.map(group =>
    engineerCatalog.skillsById.get(group.skillIds[0]).name), [
    "Regenerating Mist",
    "Offensive Protocol: Shred",
    "Defensive Protocol: Protect",
    "Offensive Protocol: Demolish",
    "Evolve",
  ]);
  const protocolGroups = groups.filter(group => group.optionSkillIds);
  assert.ok(protocolGroups.every(group =>
    group.selectionKey === "selectedMorphSkillIds"
    && group.optionSkillIds.length === 7));
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
  assert.deepEqual(build.selectedMorphSkillIds, [
    76959,
    76866,
    76954,
  ]);
  assert.deepEqual(build.selectedMorphSkillIds.map(id =>
    engineerCatalog.skillsById.get(id).name), [
    "Defensive Protocol: Protect",
    "Offensive Protocol: Shred",
    "Offensive Protocol: Demolish",
  ]);

  assert.equal(select(1, 76693), true);
  assert.deepEqual(build.selectedMorphSkillIds, [
    76959,
    76693,
    76568,
  ]);
  assert.equal(new Set(build.selectedMorphSkillIds.map(id =>
    engineerCatalog.skillsById.get(id).name)).size, 3);
});

test("Engineer benchmark packets use total coefficients and measured cadence", () => {
  const mechanic = name => engineerCatalog.skillsByName.get(name);
  assert.equal(mechanic("Shrapnel Grenade").quicknessCastTimeMs, 680);
  assert.equal(mechanic("Poison Grenade").quicknessCastTimeMs, 680);
  assert.equal(mechanic("Freeze Grenade").quicknessCastTimeMs, 680);
  assert.equal(mechanic("Flame Jet").castTimeMs, 2570);
  assert.equal(mechanic("Flame Jet").effects[0].coefficient, 2.5);
  assert.equal(mechanic("Napalm").effects[0].coefficient, 5);
  assert.equal(mechanic("Napalm").quicknessCastTimeMs, 1760);
  assert.equal(mechanic("Napalm").cooldown, 25);
  assert.equal(mechanic("Napalm").effects[1].ticks.length, 10);
  assert.equal(mechanic("Flame Blast").cooldown, 6);
  assert.equal(mechanic("Flame Blast").quicknessCastTimeMs, 780);
  assert.equal(mechanic("Flame Blast").measuredCancelMs, 480);
  assert.equal(mechanic("Air Blast").quicknessCastTimeMs, 360);
  assert.equal(mechanic("Puncturing Jab").quicknessCastTimeMs, 440);
  assert.equal(mechanic("Rending Strike").quicknessCastTimeMs, 520);
  assert.equal(mechanic("Amplifying Slice").quicknessCastTimeMs, 640);
  assert.equal(mechanic("Lightning Rod").quicknessCastTimeMs, 400);
  assert.equal(mechanic("Conduit Surge").quicknessCastTimeMs, 520);
  assert.equal(mechanic("Electric Artillery").quicknessCastTimeMs, 520);
  assert.equal(mechanic("Stoke the Flames").quicknessCastTimeMs, 440);
  assert.equal(mechanic("Evolve").quicknessCastTimeMs, 640);

  const shredSkill = mechanic("Offensive Protocol: Shred");
  const shred = shredSkill.effects[0];
  assert.equal(shredSkill.quicknessCastTimeMs, 760);
  assert.deepEqual(
    shred.ticks.map(packet => packet.coefficient),
    [0.96, 0.96, 0.96],
  );
  assert.deepEqual(
    shred.ticks.map(packet => packet.atMs),
    [840, 900, 960],
  );
  assert.equal(shredSkill.effects[1].condition, "Immobilized");
  assert.equal(shredSkill.effects[1].duration, 3);

  const demolish = mechanic("Offensive Protocol: Demolish");
  assert.equal(demolish.quicknessCastTimeMs, 1000);
  assert.ok(Math.abs(demolish.effects[0].coefficient - 8.1) < 1e-12);
  assert.equal(demolish.effects[0].hits, 3);
  assert.equal(demolish.effects[1].coefficient, 2.25);
  assert.equal(demolish.effects.some(effect => effect.boon === "stability"), false);
  assert.equal(
    mechanic("Offensive Protocol: Obliterate").quicknessCastTimeMs,
    800,
  );

  const flux = mechanic("Flux State");
  assert.equal(flux.quicknessCastTimeMs, 640);
  assert.equal(flux.effects[1].coefficient, 9);
  assert.equal(flux.effects[1].hits, 12);
  assert.equal(flux.effects[1].atMs, 500);
  assert.equal(flux.effects[1].intervalMs, 500);
  assert.equal(flux.effects[2].ticks.length, 12);

  const plasmatic = mechanic("Plasmatic State");
  assert.equal(plasmatic.castTimeMs, 720);
  assert.equal(plasmatic.quicknessCastTimeMs, 480);
  assert.equal(
    plasmatic.effects[0].ticks.reduce(
      (sum, packet) => sum + packet.coefficient,
      0,
    ),
    4.5,
  );
  assert.equal(plasmatic.effects[1].ticks.length, 2);

  const spark = mechanic("Spark Revolver").effects[0];
  assert.equal(spark.coefficient, 2.112);
  assert.equal(spark.actorType, "summon");
});

test("measured Quickness animations and Flame Blast cancellation drive steps", () => {
  const grenades = simulate("Amalgam", [
    "Grenade Kit",
    "Shrapnel Grenade",
  ], {
    boons: { quickness: true },
    selectedMorphSkillIds: [77103, 77104, 76705],
  });
  const shrapnel = grenades.steps.find(
    step => step.skill === "Shrapnel Grenade",
  );
  assert.equal(shrapnel.end - shrapnel.start, 680);

  const flamethrower = simulate("Amalgam", [
    "Flamethrower",
    { name: "Flame Blast", interruptAfterMs: 480 },
  ], {
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
  const flameBlast = flamethrower.steps.find(
    step => step.skill === "Flame Blast",
  );
  assert.equal(flameBlast.end - flameBlast.start, 480);
  assert.equal(flameBlast.fullCastMs, 780);
  assert.equal(flameBlast.interrupted, true);
  assert.equal(
    flamethrower.resolvedEvents.filter(event =>
      event.type === "damage" && event.name === "Flame Blast").length,
    1,
  );

  const full = simulate("Amalgam", [
    "Flamethrower",
    "Flame Blast",
  ], {
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
    step => step.skill === "Flame Blast",
  );
  assert.equal(fullFlameBlast.end - fullFlameBlast.start, 780);
  assert.equal(fullFlameBlast.interrupted, false);
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
  const withoutBurning = simulate("Amalgam", [
    "Flamethrower",
    "Flame Jet",
  ], {
    ...config,
    target: { conditions: { Vulnerability: 25 } },
  });
  const withBurning = simulate("Amalgam", [
    "Flamethrower",
    "Flame Jet",
  ], {
    ...config,
    target: { conditions: { Vulnerability: 25, Burning: 1 } },
  });
  const firstPacket = result => result.resolvedEvents.find(event =>
    event.type === "damage" && event.name === "Flame Jet");
  assert.ok(
    Math.abs(
      firstPacket(withBurning).damage
      / firstPacket(withoutBurning).damage
      - 1.1,
    ) < 1e-12,
  );
});

test("Engineer spear focus selects one branch and Lightning Rod pulses eight times", () => {
  const focused = simulate("Amalgam", [
    "Conduit Surge",
    "Lightning Rod",
    "Electric Artillery",
    { type: "wait", durationMs: 4000 },
  ], {
    selectedMorphSkillIds: [77103, 77104, 76705],
  });
  assert.equal(focused.warnings.length, 0);
  const lightning = focused.resolvedEvents.filter(event =>
    event.type === "damage" && event.name === "Lightning Rod");
  assert.equal(lightning.length, 8);
  assert.ok(lightning.every(event => event.coefficient === 0.3));
  assert.deepEqual(
    lightning.slice(1).map((event, index) =>
      Number((event.at - lightning[index].at).toFixed(3))),
    Array(7).fill(0.5),
  );
  const rodStep = focused.steps.find(step => step.skill === "Lightning Rod");
  const artilleryStep = focused.steps.find(
    step => step.skill === "Electric Artillery",
  );
  assert.ok(artilleryStep.start - rodStep.start >= 4000);
  assert.ok(artilleryStep.start - rodStep.start <= 4100);
  assert.equal(
    focused.events.find(
      event => event.type === "engineer.electric-artillery",
    ).charges,
    8,
  );
  const immobilize = focused.resolvedEvents.filter(event =>
    event.type === "condition"
    && event.skillName === "Lightning Rod"
    && event.condition === "Immobilized");
  assert.equal(immobilize.length, 1);
  assert.equal(immobilize[0].duration, 2);
  assert.equal(
    focused.resolvedEvents.filter(event =>
      event.type === "damage" && event.name === "Conduit Surge").length,
    1,
  );
  assert.equal(
    focused.resolvedEvents.filter(event =>
      event.type === "damage" && event.name === "Electric Artillery").length,
    1,
  );
  const artilleryBurn = focused.resolvedEvents.find(event =>
    event.type === "condition"
    && event.name === "Electric Artillery — Burning");
  assert.equal(artilleryBurn.stacks, 2);
  assert.equal(artilleryBurn.duration, 7);

  const unfocused = simulate("Amalgam", [
    "Lightning Rod",
    "Electric Artillery",
  ], {
    selectedMorphSkillIds: [77103, 77104, 76705],
  });
  const unfocusedHits = unfocused.resolvedEvents.filter(event =>
    event.type === "damage" && event.name === "Lightning Rod");
  assert.equal(unfocusedHits.length, 8);
  assert.ok(unfocusedHits.every(event => event.coefficient === 0.17));
  assert.equal(
    unfocused.resolvedEvents.find(event =>
      event.type === "damage"
      && event.name === "Electric Artillery").coefficient,
    1,
  );
  assert.equal(
    unfocused.resolvedEvents.find(event =>
      event.type === "condition"
      && event.skillName === "Electric Artillery"
      && event.condition === "Burning").duration,
    5,
  );
  assert.deepEqual(unfocused.endState.profession.lightningRodChargeExpiries, []);
  assert.equal(
    unfocused.endState.profession.electricArtilleryAvailable,
    false,
  );
});

test("Electric Artillery is unavailable until Lightning Rod creates its flip", () => {
  const result = simulate("Amalgam", ["Electric Artillery"], {
    selectedMorphSkillIds: [77103, 77104, 76705],
  });
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /Lightning Rod has not finished charging/);
  assert.equal(
    result.resolvedEvents.some(event =>
      event.type === "damage" && event.name === "Electric Artillery"),
    false,
  );
});

test("Lightning Rod arms Electric Artillery for the rotation palette", () => {
  const result = simulate("Amalgam", ["Lightning Rod"], {
    selectedMorphSkillIds: [77103, 77104, 76705],
  });
  const context = {
    professionState: result.endState.profession,
    time: result.duration,
  };
  const rod = engineerCatalog.skillsByName.get("Lightning Rod");
  const artillery = engineerCatalog.skillsByName.get("Electric Artillery");
  assert.equal(
    engineerProfession.ui.isPaletteSkillAvailable(context, rod),
    false,
  );
  assert.equal(
    engineerProfession.ui.isPaletteSkillAvailable(context, artillery),
    true,
  );
  assert.equal(
    result.endState.profession.availableFlips[artillery.id],
    true,
  );
});

test("Roiling Skies changes control branch with focus and always cripples", () => {
  const unfocused = simulate("Amalgam", ["Roiling Skies"], {
    selectedMorphSkillIds: [77103, 77104, 76705],
  });
  const focused = simulate("Amalgam", [
    "Conduit Surge",
    "Roiling Skies",
  ], {
    selectedMorphSkillIds: [77103, 77104, 76705],
  });
  assert.equal(
    unfocused.events.find(event =>
      event.type === "control" && event.skillName === "Roiling Skies")
      .controlKind,
    "stun",
  );
  assert.equal(
    focused.events.find(event =>
      event.type === "control" && event.skillName === "Roiling Skies")
      .controlKind,
    "launch",
  );
  assert.equal(
    focused.resolvedEvents.find(event =>
      event.type === "condition"
      && event.skillName === "Roiling Skies"
      && event.condition === "Crippled").duration,
    5,
  );
});

test("focused Devastator completes its full cast and triggers six hits", () => {
  const result = simulate("Amalgam", [
    "Conduit Surge",
    "Devastator",
    { type: "wait", durationMs: 2000 },
  ], {
    selectedMorphSkillIds: [77103, 77104, 76705],
  });
  assert.equal(result.warnings.length, 0);
  assert.equal(
    result.steps.find(step => step.skill === "Devastator").end
      - result.steps.find(step => step.skill === "Devastator").start,
    1000,
  );
  assert.equal(
    result.resolvedEvents.filter(event =>
      event.type === "damage" && event.name === "Devastator").length,
    1,
  );
  const focused = result.resolvedEvents.filter(event =>
    event.type === "damage" && event.name === "Focused Devastation");
  assert.equal(focused.length, 6);
  assert.ok(focused.every(event => event.coefficient === 0.2));
  assert.equal(
    result.resolvedEvents.filter(event =>
      event.type === "condition"
      && event.name === "Focused Devastation — Burning").length,
    6,
  );
});

test("benchmark Amalgam traits activate on morph and Evolve chronology", () => {
  const result = simulate("Amalgam", [
    77103,
    77104,
    76705,
    "Evolve",
    "Grenade Kit",
    "Shrapnel Grenade",
  ], {
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
  });
  assert.equal(result.warnings.length, 0);
  assert.ok(result.profession.willingHostUntil > 0);
  assert.ok(result.profession.evolvedUntil > 0);
  assert.equal(
    result.profession.rapaciousUntil,
    result.profession.evolvedUntil,
  );
  assert.equal(
    result.profession.predatorUntil,
    result.profession.evolvedUntil,
  );
  assert.equal(
    result.profession.titanicUntil,
    result.profession.evolvedUntil,
  );
  assert.equal(
    result.events.filter(event =>
      event.type === "buff"
      && event.kind === "alacrity"
      && event.skillName === "New Genes").length,
    3,
  );
  assert.ok(result.resolvedEvents.some(event =>
    event.type === "damage" && event.name === "Rapacious Strain"));
  assert.ok(result.resolvedEvents.some(event =>
    event.type === "condition"
    && event.name === "Carbolic Composition — Poisoned"));
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
  const baseline = simulate("Amalgam", [
    { type: "wait", durationMs: 750 },
    "Puncturing Jab",
  ], config);
  const evolved = simulate("Amalgam", [
    "Evolve",
    "Puncturing Jab",
  ], config);
  const puncture = result => result.resolvedEvents.find(event =>
    event.type === "damage" && event.name === "Puncturing Jab");
  assert.ok(
    Math.abs(puncture(evolved).damage / puncture(baseline).damage - 1.1)
      < 1e-12,
  );
  assert.equal(evolved.endState.profession.evolvedUntil, 8.75);
});

test("Evolve grants each selected protocol strain without leaking it to casts", () => {
  const result = simulate("Amalgam", ["Evolve"], {
    selectedMorphSkillIds: [77103, 77203, 76954],
  });
  const berserker = result.events.find(event =>
    event.type === "buff"
    && event.skillName === "Berserker Strain"
    && event.kind === "stability");
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
    demolish.events.some(event =>
      event.type === "buff" && event.kind === "stability"),
    false,
  );
});

test("Thorns damaging-field assumption creates six one-second retaliations", () => {
  const selectedMorphSkillIds = [77103, 77104, 76705];
  const inactive = simulate("Amalgam", [77104], {
    selectedMorphSkillIds,
  });
  assert.equal(
    inactive.resolvedEvents.some(event =>
      event.type === "damage" && event.name === "Thorns Retaliation"),
    false,
  );

  const active = simulate("Amalgam", ["Evolve", 77104], {
    selectedMorphSkillIds,
    professionAssumptions: { inDamagingField: true },
  });
  const retaliation = active.resolvedEvents.filter(event =>
    event.type === "damage" && event.name === "Thorns Retaliation");
  assert.equal(retaliation.length, 6);
  assert.ok(retaliation.every(event => event.coefficient === 0.5));
  assert.deepEqual(
    retaliation.slice(1).map((event, index) =>
      Number((event.at - retaliation[index].at).toFixed(3))),
    Array(5).fill(1),
  );
  assert.equal(
    active.resolvedEvents.filter(event =>
      event.type === "damage" && event.name === "Rapacious Strain").length,
    6,
  );
  assert.equal(
    active.endState.profession.thornsUntil,
    active.steps.find(step =>
      step.skill === "Defensive Protocol: Thorns").end / 1000 + 6,
  );
});

test("Plasmatic State applies two packets, its buff, and measured aftercast", () => {
  const result = simulate("Amalgam", [
    "Plasmatic State",
    "Puncturing Jab",
  ], {
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
  const step = result.steps.find(step => step.skill === "Plasmatic State");
  const following = result.steps.find(step => step.skill === "Puncturing Jab");
  assert.equal(step.end - step.start, 480);
  assert.equal(following.start - step.start, 920);
  assert.equal(
    result.resolvedEvents.filter(event =>
      event.type === "damage" && event.name === "Plasmatic State").length,
    2,
  );
  const firstPacket = result.resolvedEvents.find(event =>
    event.type === "damage" && event.name === "Plasmatic State");
  assert.ok(
    Math.abs(
      result.endState.profession.plasmaticStateUntil - firstPacket.at - 6,
    ) < 1e-12,
  );
});

test("benchmark Explosives and Firearms traits materialize offensive effects", () => {
  const result = simulate("Amalgam", [
    "Grenade Kit",
    "Shrapnel Grenade",
  ], {
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
    result.resolvedEvents.filter(event =>
      event.type === "damage" && event.name === "Explosive Entrance").length,
    1,
  );
  assert.equal(
    result.resolvedEvents.filter(event =>
      event.type === "damage" && event.name === "Aim-Assisted Rocket").length,
    1,
  );
  assert.ok(result.resolvedEvents.some(event =>
    event.type === "condition" && event.name === "Shrapnel — Bleeding"));
  assert.ok(result.resolvedEvents.some(event =>
    event.type === "condition"
    && event.name === "Incendiary Powder — Burning"));
  assert.ok(
    result.profession.traitProcReadyAt.thermalVisionUntil > 0,
  );
});

test("trait-coverage manifest covers all Engineer traits", () => {
  assert.equal(ENGINEER_TRAIT_COVERAGE.length, engineerCatalog.traits.length);
  assert.ok(ENGINEER_TRAIT_COVERAGE.every(entry => entry.effects.length > 0));
  const coverage = name => {
    const trait = engineerCatalog.traits.find(entry => entry.name === name);
    return ENGINEER_TRAIT_COVERAGE.find(entry =>
      entry.traitId === trait.id);
  };
  assert.equal(coverage("Aim-Assisted Rocket").status, "implemented");
  assert.equal(coverage("Carbolic Composition").status, "implemented");
  assert.equal(coverage("Grenadier").status, "pending");
  assert.equal(
    ENGINEER_TRAIT_COVERAGE.some(entry =>
      entry.status === "out-of-model"),
    false,
  );
});

test("condition alacrity Amalgam benchmark preset preserves supplied build", async () => {
  const raw = JSON.parse(await readFile(
    new URL(
      "../Builds/b-condi-alac-amalgam-2kit.json",
      import.meta.url,
    ),
    "utf8",
  ));
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
});

test("Engineer is a loadable native application", async () => {
  assert.equal(professionRoute("engineer"), "engineer.html");
  assert.equal((await loadProfession("engineer")).id, "engineer");
  assert.equal((await loadProfessionAppAdapter("engineer")).profession.id, "engineer");
  const html = await readFile(new URL("../engineer.html", import.meta.url), "utf8");
  assert.match(html, /data-profession="engineer"/);
  assert.match(html, /Engineer<\/span> Rotation Simulator/);
});
