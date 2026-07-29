import assert from "node:assert/strict";
import {
  access,
  mkdtemp,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { replaceBuild } from "../js/app/app-state.js";
import { createCanonicalCatalog } from "../js/platform/engine/catalog.js";
import {
  custom,
  strikeTimeline,
} from "../js/platform/engine/effect-factories.js";
import { COMMON_EVENT_TYPES } from "../js/platform/engine/events.js";
import { defineProfession } from "../js/platform/engine/profession.js";
import { SKILL_HANDLER_MODES } from "../js/platform/engine/skill-handlers.js";
import { simulateGw2 } from "../js/platform/gw2/simulate.js";
import {
  nativeProfessionRegistry,
  PROFESSION_APPLICATION_KINDS,
  professionRegistry,
  PROFESSION_ROUTES,
  standaloneProfessionRegistry,
  validateProfessionRegistryEntries,
} from "../js/app/profession-registry.js";
import {
  createProfessionSnapshot,
  DEFAULT_TERRESTRIAL_WEAPON_EXCLUSIONS,
  fetchProfessionSnapshot,
  GW2_SKILL_FLAGS,
  isTerrestrialSkill,
  serializeProfessionSnapshot,
} from "../scripts/lib/gw2-profession-snapshot.mjs";
import {
  updateProfessionApiData,
} from "../scripts/update-profession-api-data.mjs";

const apiFixture = JSON.parse(
  await readFile(
    new URL(
      "./fixtures/gw2-api/profession-snapshot.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

function createFixtureFetch(requests = []) {
  return async (requestUrl) => {
    const url = new URL(requestUrl);
    requests.push(url);
    const ids = String(url.searchParams.get("ids") || "")
      .split(",")
      .filter(Boolean)
      .map(Number);
    let value;
    if (url.pathname.startsWith("/v2/professions/")) {
      value = apiFixture.profession;
    } else if (url.pathname === "/v2/specializations") {
      value = apiFixture.specializations.filter((entry) =>
        ids.includes(entry.id),
      );
    } else if (url.pathname === "/v2/traits") {
      value = apiFixture.traits.filter((entry) => ids.includes(entry.id));
    } else if (url.pathname === "/v2/skills") {
      value = apiFixture.skills.filter((entry) => ids.includes(entry.id));
    } else {
      return {
        ok: false,
        status: 404,
        json: async () => ({}),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => structuredClone(value),
    };
  };
}

function assertCatalogMetadata(entry, catalog) {
  const traitById = new Map(catalog.traits.map((trait) => [trait.id, trait]));
  const referencedTraitIds = new Set();
  const specializationNames = new Set(
    catalog.specializations.map((specialization) => specialization.name),
  );
  for (const weapon of catalog.weapons) {
    assert.match(
      String(catalog.weaponHands.get(weapon) || ""),
      /^(?:mh|oh|mh\+oh|2h|-)$/,
      `${entry.id} ${weapon}`,
    );
  }
  for (const specialization of catalog.specializations) {
    assert.equal(specialization.minorTraits.length, 3, specialization.name);
    assert.equal(specialization.majorTraits.length, 3, specialization.name);
    for (const tier of specialization.majorTraits) {
      assert.equal(tier.length, 3, specialization.name);
    }
    for (const trait of [
      ...specialization.minorTraits,
      ...specialization.majorTraits.flat(),
    ]) {
      assert.equal(traitById.has(trait.id), true, trait.name);
      referencedTraitIds.add(trait.id);
    }
  }
  for (const trait of catalog.traits) {
    assert.equal(referencedTraitIds.has(trait.id), true, trait.name);
    assert.equal(
      specializationNames.has(trait.specialization),
      true,
      trait.name,
    );
    assert.equal(Number.isInteger(Number(trait.position)), true, trait.name);
    assert.equal(Number(trait.position) >= 0, true, trait.name);
    assert.equal(Number(trait.position) <= 3, true, trait.name);
  }
}

function assertUiContracts(entry, profession, specialization) {
  const context = {
    catalog: profession.catalog,
    specialization,
    config: { specialization },
    professionState: profession.createProfessionState({ specialization }),
  };
  const groups = profession.ui.paletteGroups(context);
  const views = profession.ui.resourceViews(context);
  assert.equal(Array.isArray(groups), true);
  assert.equal(Array.isArray(views), true);
  assert.equal(
    new Set(groups.map((group) => group.id)).size,
    groups.length,
  );
  assert.equal(
    groups.filter((group) => group.resourceAnchor).length,
    1,
    `${entry.id} profession resource anchor`,
  );
  for (const group of groups) {
    assert.match(String(group.id || ""), /^[a-z][a-z0-9-]*$/);
    assert.equal(Array.isArray(group.skillIds), true);
    assert.equal(new Set(group.skillIds).size, group.skillIds.length);
    for (const id of group.skillIds) {
      assert.equal(profession.catalog.skillsById.has(id), true, String(id));
    }
  }
  assert.equal(
    new Set(views.map((view) => view.id)).size,
    views.length,
  );
  for (const view of views) {
    assert.match(String(view.id || ""), /^[a-z][a-z0-9-]*$/);
    assert.ok(String(view.singular || "").trim(), `${entry.id} singular`);
    assert.ok(String(view.plural || "").trim(), `${entry.id} plural`);
    assert.ok(Number.isFinite(Number(view.maximum)), `${entry.id} maximum`);
    assert.ok(Number(view.maximum) > 0, `${entry.id} maximum`);
    assert.ok(Number.isFinite(Number(view.value)), `${entry.id} value`);
    assert.ok(Number(view.value) >= 0, `${entry.id} value`);
    assert.ok(
      Number(view.value) <= Number(view.maximum),
      `${entry.id} value`,
    );
    assert.equal(typeof view.canStart, "boolean", `${entry.id} canStart`);
    assert.ok(String(view.shortLabel || "").trim(), `${entry.id} shortLabel`);
    assert.ok(
      String(view.statusLabel || "").trim(),
      `${entry.id} statusLabel`,
    );
  }
}

test("native profession registry entries conform to the shared contracts", async () => {
  const storageKeys = new Set();
  const filenames = new Set();
  for (const entry of nativeProfessionRegistry) {
    assert.equal(
      entry.applicationKind,
      PROFESSION_APPLICATION_KINDS.NATIVE,
    );
    await access(new URL(`../${entry.route}`, import.meta.url));
    const [profession, adapter] = await Promise.all([
      entry.loadProfession(),
      entry.loadAppAdapter(),
    ]);
    assert.match(entry.id, /^[a-z][a-z0-9-]*$/);
    assert.equal(profession.id, entry.id);
    assert.equal(adapter.id, entry.id);
    assert.equal(PROFESSION_ROUTES[entry.id], entry.route);
    assert.ok(entry.themeClass);
    assertCatalogMetadata(entry, profession.catalog);

    const ids = profession.catalog.skills.map((skill) => skill.id);
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
        const handler = profession.catalog.skillHandlers.get(skill.handlerId);
        assert.equal(
          typeof handler,
          "object",
          skill.handlerId,
        );
        assert.equal(
          Object.values(SKILL_HANDLER_MODES).includes(handler.mode),
          true,
          `${skill.handlerId} mode`,
        );
        assert.equal(
          ["beforeEffects", "afterEffect", "afterEffects"]
            .some((phase) => typeof handler[phase] === "function"),
          true,
          `${skill.handlerId} phases`,
        );
      }
      for (const effect of skill.effects) {
        if (effect.type !== "custom") continue;
        assert.equal(
          effect.eventType.startsWith(`${entry.id}.`),
          true,
          effect.eventType,
        );
        assert.equal(
          typeof profession.eventHandlers[effect.eventType],
          "function",
          effect.eventType,
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
    const oneWeaponSet = profession.migrateBuild({
      ...defaults,
      alternateWeapons: ["", ""],
      startingWeaponSet: 2,
    });
    assert.deepEqual(oneWeaponSet.alternateWeapons, ["", ""]);
    assert.equal(oneWeaponSet.startingWeaponSet, 1);
    assert.equal(profession.validateBuild(oneWeaponSet).valid, true);
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
    const unknown = simulateGw2({
      profession,
      rotation: [{ type: "cast", skillId: -999 }],
      config: {},
    });
    assert.match(unknown.warnings.join(" "), /Unknown skill id -999/);

    for (const specialization of [
      "Core",
      ...profession.catalog.specializations.map((value) => value.name),
    ]) {
      assertUiContracts(entry, profession, specialization);
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
  const elementalist = professionRegistry.find(
    (entry) => entry.id === "elementalist",
  );
  assert.ok(elementalist);
  assert.equal(
    elementalist.applicationKind,
    PROFESSION_APPLICATION_KINDS.STANDALONE,
  );
  assert.equal(elementalist.loadAppAdapter, null);
  assert.equal(standaloneProfessionRegistry.includes(elementalist), true);
  assert.equal(
    nativeProfessionRegistry.some((entry) => entry.id === "elementalist"),
    false,
  );
});

test("registry application kinds cannot bypass native adapter conformance", () => {
  const base = {
    id: "fixture",
    name: "Fixture",
    route: "fixture.html",
    themeClass: "",
    specializationSummary: "Core",
    loadProfession: async () => ({}),
  };
  assert.throws(
    () =>
      validateProfessionRegistryEntries([
        {
          ...base,
          applicationKind: PROFESSION_APPLICATION_KINDS.NATIVE,
          loadAppAdapter: null,
        },
      ]),
    /native applications require an adapter/,
  );
  assert.throws(
    () =>
      validateProfessionRegistryEntries([
        {
          ...base,
          applicationKind: PROFESSION_APPLICATION_KINDS.STANDALONE,
          loadAppAdapter: async () => ({}),
        },
      ]),
    /standalone applications cannot register an adapter/,
  );
  assert.equal(
    validateProfessionRegistryEntries([
      {
        ...base,
        applicationKind: PROFESSION_APPLICATION_KINDS.NATIVE,
        loadAppAdapter: async () => ({}),
      },
    ]),
    true,
  );
});

test("native build codecs share version, schema, and sanitization behavior", async () => {
  for (const entry of nativeProfessionRegistry) {
    const [profession, adapter] = await Promise.all([
      entry.loadProfession(),
      entry.loadAppAdapter(),
    ]);
    const defaults = profession.createBuildDefaults();
    assert.throws(
      () =>
        replaceBuild(
          { ...defaults, profession: "wrong-profession" },
          adapter,
        ),
      /Cannot load/,
    );
    assert.throws(
      () =>
        replaceBuild(
          { ...defaults, schemaVersion: defaults.schemaVersion + 1 },
          adapter,
        ),
      /Unsupported build schema version/,
    );
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

    for (const field of ["rune", "food", "utility"]) {
      const invalidValue = `Unknown ${field}`;
      const invalidBuild = { ...defaults, [field]: invalidValue };
      assert.equal(profession.validateBuild(invalidBuild).valid, false);
      assert.equal(
        profession.migrateBuild(invalidBuild)[field],
        defaults[field],
      );
    }
    assert.equal(
      profession.validateBuild({
        ...defaults,
        jadeBotCore: "yes",
      }).valid,
      false,
    );
    assert.equal(
      profession.migrateBuild({
        ...defaults,
        jadeBotCore: "yes",
      }).jadeBotCore,
      defaults.jadeBotCore,
    );

    for (const rotation of [
      [{ type: "wait", durationMs: -1 }],
      [{
        type: "cast",
        skillId: profession.catalog.skills[0].id,
        concurrentOffsetMs: -1,
      }],
      [{ type: "combat-start", interruptAfterMs: 1 }],
    ]) {
      assert.equal(
        profession.validateBuild({ ...defaults, rotation }).valid,
        false,
      );
    }

    const selectedSpecializations = new Set(
      defaults.specializations.map((specialization) => specialization.name),
    );
    const lockedSlotSkill = profession.catalog.skills.find(
      (skill) =>
        ["Heal", "Utility", "Elite"].includes(skill.type) &&
        skill.implemented &&
        !skill.simulatorExcluded &&
        skill.flipParentId == null &&
        skill.specialization &&
        !selectedSpecializations.has(skill.specialization),
    );
    if (lockedSlotSkill && !adapter.slotLoadout) {
      const slot =
        lockedSlotSkill.type === "Heal"
          ? "Heal"
          : lockedSlotSkill.type === "Elite"
            ? "Elite"
            : "Utility1";
      const lockedBuild = {
        ...defaults,
        selectedSkills: {
          ...defaults.selectedSkills,
          [slot]: lockedSlotSkill.name,
        },
      };
      assert.equal(profession.validateBuild(lockedBuild).valid, false);
      const migrated = profession.migrateBuild(lockedBuild);
      assert.notEqual(migrated.selectedSkills[slot], lockedSlotSkill.name);
      assert.equal(profession.validateBuild(migrated).valid, true);
    }

    if (!adapter.slotLoadout) {
      const duplicateUtility = {
        ...defaults,
        selectedSkills: {
          ...defaults.selectedSkills,
          Utility2: defaults.selectedSkills.Utility1,
        },
      };
      assert.equal(profession.validateBuild(duplicateUtility).valid, false);
      const normalizedUtilities = profession.migrateBuild(duplicateUtility);
      assert.equal(
        new Set([
          normalizedUtilities.selectedSkills.Utility1,
          normalizedUtilities.selectedSkills.Utility2,
          normalizedUtilities.selectedSkills.Utility3,
        ]).size,
        3,
      );
    }

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
    if (flip && !adapter.slotLoadout) {
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
    const normalizedRotation = profession.migrateBuild({
      ...defaults,
      rotation: [firstSkill.name],
    });
    assert.deepEqual(normalizedRotation.rotation, [{
      type: "cast",
      skillId: firstSkill.id,
    }]);
    const applicationBuild = adapter.toApplicationBuild({
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

test("API snapshot transforms chains, filtering, and ordering", () => {
  const snapshot = createProfessionSnapshot({
    profession: apiFixture.profession,
    specializationData: apiFixture.specializations,
    traitData: apiFixture.traits,
    skillData: apiFixture.skills,
  });
  const reordered = createProfessionSnapshot({
    profession: {
      ...apiFixture.profession,
      skills: [...apiFixture.profession.skills].reverse(),
    },
    specializationData: [...apiFixture.specializations].reverse(),
    traitData: [...apiFixture.traits].reverse(),
    skillData: [...apiFixture.skills].reverse(),
  });
  assert.deepEqual(reordered, snapshot);
  assert.deepEqual(
    snapshot.skills.map((value) => value.id),
    [10, 11, 12, 20, 21, 40],
  );
  assert.equal(
    snapshot.skills.find((value) => value.id === 10).nextChainId,
    11,
  );
  assert.equal(
    snapshot.skills.find((value) => value.id === 11).flipSkillId,
    12,
  );
  assert.equal(
    snapshot.skills.find((value) => value.id === 20).flipSkillId,
    null,
  );
  assert.equal(
    snapshot.skills.some((value) =>
      "canonicalAliasId" in value
      || "modeAliasIds" in value
      || "flags" in value),
    false,
  );
  assert.equal(
    snapshot.skills.find((value) => value.id === 40).specialization,
    "Elite",
  );
  assert.equal(
    snapshot.skills.some(
      (value) => "facts" in value || "coefficient" in value,
    ),
    false,
  );
  assert.equal(
    snapshot.skills.some(
      (value) =>
        value.flags?.includes(GW2_SKILL_FLAGS.TERRESTRIAL_ONLY),
    ),
    false,
  );
  assert.equal(
    isTerrestrialSkill(
      {
        id: 60,
        name: "Wet Spear",
        slot: "Weapon_1",
        flags: [],
      },
      "Spear",
    ),
    false,
  );
  assert.deepEqual(
    DEFAULT_TERRESTRIAL_WEAPON_EXCLUSIONS,
    ["Trident", "Speargun"],
  );
  assert.equal(
    isTerrestrialSkill(
      {
        id: 61,
        name: "Trident Attack",
        slot: "Weapon_1",
        flags: [GW2_SKILL_FLAGS.TERRESTRIAL_ONLY],
      },
      "Trident",
    ),
    false,
  );
  assert.equal(
    isTerrestrialSkill(
      {
        id: 64,
        name: "Aquatic Skill",
        slot: "Weapon_1",
        flags: [GW2_SKILL_FLAGS.UNDERWATER_ONLY],
      },
      "",
    ),
    false,
  );
  assert.equal(
    isTerrestrialSkill(
      {
        id: 62,
        name: "Speargun Attack",
        slot: "Weapon_1",
        flags: [GW2_SKILL_FLAGS.TERRESTRIAL_ONLY],
      },
      "Speargun",
    ),
    false,
  );
  assert.equal(
    isTerrestrialSkill(
      {
        id: 63,
        name: "Land Spear",
        slot: "Weapon_1",
        flags: [GW2_SKILL_FLAGS.TERRESTRIAL_ONLY],
      },
      "Spear",
    ),
    true,
  );
  assert.equal(
    serializeProfessionSnapshot({
      professionName: "Fixture",
      snapshotDate: "2026-07-27",
      ...snapshot,
    }),
    serializeProfessionSnapshot({
      professionName: "Fixture",
      snapshotDate: "2026-07-27",
      ...reordered,
    }),
  );
});

test("API snapshot fetches are English, fixture-backed, and profession-generic", async () => {
  const requests = [];
  const fetchImpl = createFixtureFetch(requests);
  const snapshot = await fetchProfessionSnapshot({
    professionName: "Warrior",
    fetchImpl,
  });
  assert.deepEqual(
    snapshot.skills.map((skill) => skill.id),
    [10, 11, 12, 20, 21, 40],
  );
  assert.ok(requests.length > 0);
  assert.equal(
    requests.every((request) => request.searchParams.get("lang") === "en"),
    true,
  );
  const directory = await mkdtemp(
    path.join(tmpdir(), "gw2-profession-snapshot-"),
  );
  const output = path.join(directory, "warrior-api-metadata.js");
  try {
    const result = await updateProfessionApiData("warrior", {
      fetchImpl: createFixtureFetch(),
      snapshotDate: "2026-07-27",
      output,
      log: () => {},
    });
    assert.equal(result.output, path.resolve(output));
    const source = await readFile(output, "utf8");
    assert.match(source, /Generated Guild Wars 2 API metadata for warrior/);
    assert.match(source, /export const DATA_SNAPSHOT = "2026-07-27"/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
