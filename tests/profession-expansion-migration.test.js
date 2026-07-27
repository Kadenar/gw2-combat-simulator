import assert from "node:assert/strict";
import test from "node:test";

import { createCanonicalCatalog } from "../js/platform/engine/catalog.js";
import {
  custom,
  strikeTimeline,
} from "../js/platform/engine/effect-factories.js";
import { COMMON_EVENT_TYPES } from "../js/platform/engine/events.js";
import { defineProfession } from "../js/platform/engine/profession.js";
import { simulateGw2 } from "../js/platform/gw2/simulate.js";
import {
  nativeProfessionRegistry,
  professionRegistry,
  PROFESSION_ROUTES,
} from "../js/app/profession-registry.js";
import {
  createProfessionSnapshot,
  isTerrestrialSkill,
} from "../scripts/lib/gw2-profession-snapshot.mjs";

test("native profession registry entries conform to the shared contracts", async () => {
  const storageKeys = new Set();
  const filenames = new Set();
  for (const entry of nativeProfessionRegistry) {
    const [profession, adapter] = await Promise.all([
      entry.loadProfession(),
      entry.loadAppAdapter(),
    ]);
    assert.match(entry.id, /^[a-z][a-z0-9-]*$/);
    assert.equal(profession.id, entry.id);
    assert.equal(adapter.id, entry.id);
    assert.equal(PROFESSION_ROUTES[entry.id], entry.route);
    assert.ok(entry.themeClass);

    const ids = profession.catalog.skills.map(skill => skill.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const skill of profession.catalog.skills) {
      assert.equal(profession.catalog.skillsById.get(skill.id), skill);
      assert.ok(Number.isFinite(skill.castTimeMs), skill.name);
      assert.equal("activation" in skill, false, skill.name);
      assert.equal("castTime" in skill, false, skill.name);
      if (!skill.simulatorExcluded) {
        assert.equal(skill.implemented, true, skill.name);
      }
      if (skill.handlerId) {
        assert.equal(
          typeof profession.catalog.skillHandlers.get(skill.handlerId),
          "function",
          skill.handlerId,
        );
      }
    }
    for (const type of Object.keys(profession.eventHandlers)) {
      assert.equal(type.startsWith(`${entry.id}.`), true, type);
      assert.equal(COMMON_EVENT_TYPES.includes(type), false, type);
    }
    for (const type of Object.keys(profession.taskHandlers)) {
      assert.equal(type.startsWith(`${entry.id}.`), true, type);
    }

    const defaults = profession.createBuildDefaults();
    const migrated = profession.migrateBuild(defaults);
    assert.equal(profession.validateBuild(migrated).valid, true);
    assert.equal(migrated.profession, entry.id);
    assert.deepEqual(profession.migrateBuild(migrated), migrated);
    assert.throws(
      () => profession.migrateBuild({
        ...defaults,
        profession: "wrong-profession",
      }),
      /Cannot load/,
    );
    assert.throws(
      () => profession.migrateBuild({
        ...defaults,
        schemaVersion: defaults.schemaVersion + 1,
      }),
      /Unsupported build schema version/,
    );

    const result = simulateGw2({ profession, rotation: [], config: {} });
    assert.deepEqual(
      Object.keys(result.endState).sort(),
      ["activeWeaponSet", "ammo", "cooldowns", "profession", "time"].sort(),
    );
    assert.equal(typeof result.endState.profession, "object");

    const context = {
      catalog: profession.catalog,
      specialization: "Core",
      professionState: profession.createProfessionState({}),
    };
    const groups = profession.ui.paletteGroups(context);
    const views = profession.ui.resourceViews(context);
    assert.equal(Array.isArray(groups), true);
    assert.equal(Array.isArray(views), true);
    assert.equal(
      new Set(groups.map(group => group.id)).size,
      groups.length,
    );
    for (const group of groups) {
      assert.equal(Array.isArray(group.skillIds), true);
      for (const id of group.skillIds) {
        assert.equal(profession.catalog.skillsById.has(id), true, String(id));
      }
    }
    assert.equal(storageKeys.has(adapter.storageKey), false);
    storageKeys.add(adapter.storageKey);
    for (const filename of Object.values(adapter.filenames)) {
      assert.equal(filenames.has(filename), false);
      filenames.add(filename);
    }
  }
});

test("the standalone Elementalist manifest entry has no native adapter", () => {
  const elementalist = professionRegistry.find(entry =>
    entry.id === "elementalist");
  assert.ok(elementalist);
  assert.equal(elementalist.loadAppAdapter, null);
  assert.equal(
    nativeProfessionRegistry.some(entry => entry.id === "elementalist"),
    false,
  );
});

test("native build codecs share version, schema, and sanitization behavior", async () => {
  for (const entry of nativeProfessionRegistry) {
    const profession = await entry.loadProfession();
    const defaults = profession.createBuildDefaults();
    for (let version = 0; version <= defaults.schemaVersion; version += 1) {
      const migrated = profession.migrateBuild({
        ...defaults,
        schemaVersion: version,
      });
      assert.equal(migrated.schemaVersion, 3, `${entry.id} v${version}`);
      assert.equal(profession.validateBuild(migrated).valid, true);
    }

    const legacySigils = profession.migrateBuild({
      ...defaults,
      schemaVersion: 0,
      weaponSigils: undefined,
      sigils: ["Force", "Impact"],
    });
    assert.deepEqual(legacySigils.weaponSigils, [
      ["Force", "Impact"],
      ["Force", "Impact"],
    ]);
    assert.equal("sigils" in legacySigils, false);

    const twoHanded = [...profession.catalog.weaponHands]
      .find(([, hand]) => hand === "2h")?.[0];
    if (twoHanded) {
      const migrated = profession.migrateBuild({
        ...defaults,
        weapons: [twoHanded, defaults.weapons[1] || "invalid"],
      });
      assert.deepEqual(migrated.weapons, [twoHanded, ""]);
    }

    const invalid = {
      ...defaults,
      gear: {
        ...defaults.gear,
        Helm: "Unknown Prefix",
      },
      relic: "Unknown Relic",
      rotation: [{ type: "cast", skillId: -999 }],
      specializations: [
        defaults.specializations[0],
        defaults.specializations[0],
        defaults.specializations[0],
      ],
    };
    assert.equal(profession.validateBuild(invalid).valid, false);
    const sanitized = profession.migrateBuild(invalid);
    assert.equal(sanitized.relic, defaults.relic);
    assert.equal(sanitized.gear.Helm, defaults.gear.Helm);
    assert.deepEqual(sanitized.specializations, defaults.specializations);
    assert.equal(
      profession.validateBuild(sanitized).errors.some(error =>
        error.includes("unknown skill")),
      true,
    );

    const flip = profession.catalog.skills.find(skill =>
      skill.flipParentId != null
      && ["Heal", "Utility", "Elite"].includes(skill.type)
    );
    if (flip) {
      const slot = flip.type === "Heal"
        ? "Heal"
        : flip.type === "Elite"
          ? "Elite"
          : "Utility1";
      const withFlip = {
        ...defaults,
        selectedSkills: {
          ...defaults.selectedSkills,
          [slot]: flip.name,
        },
      };
      assert.equal(profession.validateBuild(withFlip).valid, false);
      assert.equal(
        profession.migrateBuild(withFlip).selectedSkills[slot],
        defaults.selectedSkills[slot],
      );
    }

    const firstSkill = profession.catalog.skills[0];
    const applicationBuild = (
      await entry.loadAppAdapter()
    ).toApplicationBuild({
      ...defaults,
      rotation: [{ type: "cast", skillId: firstSkill.id }],
    });
    assert.equal(applicationBuild.rotation[0].name, firstSkill.name);
  }
});

test("resolver profession state changes are chronological and preserve counters", () => {
  const catalog = createCanonicalCatalog({
    generated: [{
      id: 980001,
      name: "Chronology Fixture",
      castTimeMs: 0,
      effects: [
        strikeTimeline([
          { atMs: 1000, coefficient: 1 },
          { atMs: 5000, coefficient: 1 },
          { atMs: 6000, coefficient: 1 },
        ], {
          timingAnchor: "castStart",
          timingScale: "fixed",
        }),
        custom(
          "chronology-fixture.state",
          5000,
          { active: true, priority: -10 },
          {
            timingAnchor: "castStart",
            timingScale: "fixed",
          },
        ),
      ],
    }],
  });
  const profession = defineProfession({
    id: "chronology-fixture",
    name: "Chronology Fixture",
    catalog,
    resources: {
      createProfessionState: config => ({
        active: Boolean(config.initialActive),
        hitCount: 0,
      }),
      createResolverState: config => ({
        active: Boolean(config.initialActive),
        hitCount: 0,
      }),
      projectEndState: ({ resolverState }) => ({
        active: resolverState.active,
      }),
    },
    attributeRules: {
      modifyStrikeDamage(context, value) {
        return context.runtime.profession.active ? value * 2 : value;
      },
    },
    resolverHooks: {
      eventHandlers: {
        "chronology-fixture.state": (context, event) => {
          context.profession.active = event.active;
        },
      },
      eventReactions: {
        damage: context => {
          context.profession.hitCount += 1;
        },
      },
    },
  });
  const result = simulateGw2({
    profession,
    rotation: [
      "Chronology Fixture",
      { type: "wait", durationMs: 6000 },
    ],
  });
  const hits = result.resolvedEvents.filter(event => event.type === "damage");
  assert.equal(Math.round(hits[1].damage / hits[0].damage), 2);
  assert.equal(Math.round(hits[2].damage / hits[0].damage), 2);
  assert.equal(result.profession.hitCount, 3);
  assert.deepEqual(result.endState.profession, { active: true });

  const configured = simulateGw2({
    profession,
    rotation: [
      "Chronology Fixture",
      { type: "wait", durationMs: 6000 },
    ],
    config: { initialActive: true },
  });
  const configuredHits = configured.resolvedEvents.filter(
    event => event.type === "damage",
  );
  assert.equal(
    Math.round(configuredHits[2].damage / configuredHits[0].damage),
    1,
  );
});

test("API snapshot transforms chains, aliases, filtering, and ordering", () => {
  const profession = {
    skills: [{ id: 20 }, { id: 10 }, { id: 40 }],
    specializations: [2],
    training: [{
      name: "Elite",
      track: [{ type: "Skill", skill_id: 40 }],
    }],
    weapons: {
      Sword: {
        specialization: 2,
        skills: [{ id: 10 }],
      },
      Spear: {
        skills: [{ id: 30 }],
      },
    },
  };
  const specializationData = [{
    id: 2,
    name: "Elite",
    elite: true,
    icon: "elite.png",
    background: "elite-bg.png",
    minor_traits: [2],
    major_traits: [3, 4, 5, 6, 7, 8, 9, 10, 11],
  }];
  const traitData = Array.from({ length: 10 }, (_, index) => ({
    id: index + 2,
    name: `Trait ${index + 2}`,
    slot: index === 0 ? "Minor" : "Major",
    tier: Math.max(1, Math.ceil(index / 3)),
    order: index % 3,
  }));
  const skill = (id, name, fields = {}) => ({
    id,
    name,
    type: "Weapon",
    slot: "Weapon_1",
    flags: ["NoUnderwater"],
    facts: [],
    ...fields,
  });
  const snapshot = createProfessionSnapshot({
    profession,
    specializationData,
    traitData,
    skillData: [
      skill(10, "Chain", { next_chain: 11 }),
      skill(11, "Chain Two", { flip_skill: 12 }),
      skill(12, "Flip"),
      skill(20, "Alias", { flip_skill: 21 }),
      skill(21, "Alias"),
      skill(30, "Land Spear"),
      skill(40, "Elite Skill"),
      skill(50, "Underwater", { flags: ["Underwater"] }),
    ],
  });
  assert.deepEqual(
    snapshot.skills.map(value => value.id),
    [10, 11, 12, 20, 21, 30, 40],
  );
  assert.equal(snapshot.skills.find(value => value.id === 10).nextChainId, 11);
  assert.equal(snapshot.skills.find(value => value.id === 11).flipSkillId, 12);
  assert.equal(snapshot.skills.find(value => value.id === 20).flipSkillId, null);
  assert.equal(
    snapshot.skills.find(value => value.id === 20).canonicalAliasId,
    20,
  );
  assert.deepEqual(
    snapshot.skills.find(value => value.id === 20).modeAliasIds,
    [21],
  );
  assert.equal(
    snapshot.skills.find(value => value.id === 40).specialization,
    "Elite",
  );
  assert.equal(
    snapshot.skills.some(value =>
      "facts" in value || "coefficient" in value),
    false,
  );
  assert.equal(
    isTerrestrialSkill(
      skill(60, "Wet Spear", { flags: [] }),
      "Spear",
    ),
    false,
  );
});
