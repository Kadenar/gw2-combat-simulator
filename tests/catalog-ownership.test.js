import assert from "node:assert/strict";
import test from "node:test";

import {
  defineCatalogOwnership,
} from "../js/platform/engine/catalog-ownership.js";
import { createCanonicalCatalog } from "../js/platform/engine/catalog.js";

const replaceHandler = Object.freeze({
  mode: "replace",
  beforeEffects: () => undefined,
});

function ownershipCatalog(skills = [
  {
    id: 1,
    name: "Core Weapon",
    type: "Weapon",
    handlerId: "test.core",
    implemented: true,
    castTimeMs: 0,
    effects: [],
  },
  {
    id: 2,
    name: "Elite Skill",
    specialization: "Elite",
    handlerId: "test.elite",
    implemented: true,
    castTimeMs: 0,
    effects: [],
  },
  {
    id: 3,
    name: "Elite Mechanic Weapon",
    type: "Weapon",
    specialization: "Elite",
    handlerId: "test.elite",
    implemented: true,
    castTimeMs: 0,
    effects: [],
  },
]) {
  return createCanonicalCatalog({
    generated: skills,
    skillHandlers: {
      "test.core": replaceHandler,
      "test.elite": replaceHandler,
    },
    traits: [
      { id: 10, name: "Core Trait", specialization: "Core Line" },
      { id: 11, name: "Elite Trait", specialization: "Elite" },
    ],
    specializations: [
      { id: 20, name: "Core Line", elite: false },
      { id: 21, name: "Elite", elite: true },
    ],
    weapons: ["Sword"],
    weaponHands: { Sword: "mh" },
  });
}

test("catalog ownership materializes cached, disjoint runtime fragments", () => {
  const catalog = ownershipCatalog();
  const ownership = defineCatalogOwnership({
    catalog,
    modules: ["Core", "Elite"],
    skillOverrides: { 3: "Elite" },
    handlerOwners: { "test.elite": "Elite" },
    core: { ownsWeapons: true },
  });

  const core = ownership.fragment("Core");
  const elite = ownership.fragment("Elite");
  assert.equal(core, ownership.fragment("Core"));
  assert.deepEqual(core.skills.map((skill) => skill.id), [1]);
  assert.deepEqual(elite.skills.map((skill) => skill.id), [2, 3]);
  assert.deepEqual(core.traits.map((trait) => trait.id), [10]);
  assert.deepEqual(elite.traits.map((trait) => trait.id), [11]);
  assert.deepEqual(core.specializations.map((line) => line.id), [20]);
  assert.deepEqual(elite.specializations.map((line) => line.id), [21]);
  assert.deepEqual([...core.skillHandlers.keys()], ["test.core"]);
  assert.deepEqual([...elite.skillHandlers.keys()], ["test.elite"]);
  assert.deepEqual(core.weapons, ["Sword"]);
  assert.equal(core.weaponHands.get("Sword"), "mh");
  assert.throws(() => ownership.fragment("Missing"), /Unknown catalog module/);
});

test("catalog ownership rejects incomplete and unknown owners", () => {
  const catalog = ownershipCatalog();
  assert.throws(
    () => defineCatalogOwnership({
      catalog,
      modules: ["Core", "Elite"],
      defaultSkillOwner: () => undefined,
    }),
    /Skill 1 has no owner/,
  );
  assert.throws(
    () => defineCatalogOwnership({
      catalog,
      modules: ["Core", "Elite"],
      defaultSkillOwner: () => "Missing",
    }),
    /Skill 1 has unknown owner "Missing"/,
  );
  assert.throws(
    () => defineCatalogOwnership({
      catalog,
      modules: ["Core", "Elite"],
      skillOverrides: { 999: "Core" },
    }),
    /Unknown skill ownership override 999/,
  );
});

test("catalog ownership rejects duplicate claims and fragment drift", () => {
  const catalog = ownershipCatalog();
  const base = {
    catalog,
    modules: ["Core", "Elite"],
    skillOverrides: { 3: "Elite" },
    handlerOwners: { "test.elite": "Elite" },
  };
  assert.throws(
    () => defineCatalogOwnership({
      ...base,
      moduleFragments: {
        Elite: { skills: [catalog.skillsById.get(1)] },
      },
    }),
    /Skill 1 is claimed by Core and Elite/,
  );
  assert.throws(
    () => defineCatalogOwnership({
      ...base,
      moduleFragments: {
        Elite: {
          skills: [{
            id: 999,
            name: "Foreign Skill",
            implemented: true,
            castTimeMs: 0,
            effects: [],
          }],
        },
      },
    }),
    /Skill fragment union contains unknown entity 999/,
  );
});

test("catalog ownership validates handler and Weaponmaster registration", () => {
  const catalog = ownershipCatalog();
  assert.throws(
    () => defineCatalogOwnership({
      catalog,
      modules: ["Core", "Elite"],
      skillOverrides: { 3: "Elite" },
      core: { ownsWeapons: true },
    }),
    /Handler test\.elite is registered by Core/,
  );
  assert.throws(
    () => defineCatalogOwnership({
      catalog,
      modules: ["Core", "Elite"],
      defaultSkillOwner: () => "Elite",
      handlerOwners: {
        "test.core": "Elite",
        "test.elite": "Elite",
      },
      core: { ownsWeapons: true },
    }),
    /Weaponmaster skill 1 must be Core-owned or explicitly overridden/,
  );
});
