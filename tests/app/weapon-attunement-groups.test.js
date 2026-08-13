import assert from "node:assert/strict";
import test from "node:test";

import {
  groupWeaponSkillsByAttunement,
  weaponBarSkillStacks,
} from "../../js/app/profession/weapon-attunement-groups.js";

const skill = (id, name, slot, attunement, chainStep = null) => ({
  id,
  name,
  slot: `Weapon_${slot}`,
  attunement,
  chainStep,
});

test("weapon skills render in separate elemental rows with local cascades", () => {
  const skills = [
    skill(1, "Fire auto 1", 1, "Fire", 1),
    skill(2, "Fire auto 2", 1, "Fire", 2),
    skill(3, "Fire skill 2", 2, "Fire"),
    skill(4, "Earth auto 1", 1, "Earth", 1),
    skill(5, "Earth auto 2", 1, "Earth", 2),
    skill(6, "Earth skill 2", 2, "Earth"),
    skill(7, "Water auto", 1, "Water"),
    skill(8, "Air auto", 1, "Air"),
  ];

  const groups = groupWeaponSkillsByAttunement(skills, "Tempest");

  assert.deepEqual(
    groups.map((group) => group.attunement),
    ["Fire", "Water", "Air", "Earth"],
  );
  assert.deepEqual(
    groups
      .find((group) => group.attunement === "Fire")
      ?.skills.map((entry) => entry.name),
    ["Fire auto 1", "Fire auto 2", "Fire skill 2"],
  );
  assert.deepEqual(
    groups
      .find((group) => group.attunement === "Earth")
      ?.skills.map((entry) => entry.name),
    ["Earth auto 1", "Earth auto 2", "Earth skill 2"],
  );
});

test("ordinary weapon bars stay in one unlabeled row", () => {
  const skills = [skill(1, "Strike", 1), skill(2, "Slash", 2)];

  assert.deepEqual(groupWeaponSkillsByAttunement(skills, "Core"), [
    { attunement: null, skills },
  ]);
});

test("Weaver dual attacks follow the four elemental rows", () => {
  const skills = [
    skill(1, "Fire", 1, "Fire"),
    skill(2, "Water", 1, "Water"),
    skill(3, "Air", 1, "Air"),
    skill(4, "Earth", 1, "Earth"),
    skill(5, "Twin Strike", 3, "Fire+Water"),
    skill(6, "Pyro Vortex", 3, "Fire+Air"),
  ];

  assert.deepEqual(
    groupWeaponSkillsByAttunement(skills, "Weaver").map(
      (group) => group.attunement,
    ),
    ["Fire", "Water", "Air", "Earth", "Dual"],
  );

  const dualSkills = groupWeaponSkillsByAttunement(skills, "Weaver").find(
    (group) => group.attunement === "Dual",
  )?.skills;
  assert.deepEqual(
    weaponBarSkillStacks(dualSkills || [], true).map((stack) =>
      stack.map((entry) => entry.name),
    ),
    [["Twin Strike"], ["Pyro Vortex"]],
  );
});
