import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { rangerProfession } from '#gw2/professions/ranger/profession.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';

const config = {
  specialization: 'Core',
  attributeInputs: baseAttributeInputs({ power: 2000, precision: 1000, vitality: 1000, conditionDamage: 1000 }),
  target: { armor: 2597 }
};

// Migrated families exercise selection on their actual live owners.
const simulateRuntime = ({ profession, config, rotation }) =>
  runGw2Runtime({ profession: profession.runtimeFor(config), config, rotation });

// Public and direct entry points share strict ID validation and explicit empty-loadout semantics.
test('simulation entry points validate IDs before running selected skills', () => {
  const profession = warriorProfession;
  const skill = profession.catalog.skillsById.get(14389);
  for (const simulate of [simulateGw2, simulateRuntime]) {
    for (const selection of [{ Heal: skill.id }, [skill.name], [null], [99999999]]) {
      assert.throws(
        () => simulate({ profession, config: { ...config, selectedSkillIds: selection }, rotation: [] }),
        TypeError
      );
    }

    assert.throws(
      () => simulate({ profession, config: { ...config, selectedSkills: [skill.name] }, rotation: [] }),
      TypeError
    );
    for (const selectedSkillIds of [undefined, [], [skill.id]]) {
      const result = simulate({
        profession,
        config: { ...config, selectedSkillIds },
        // A valid canonical cast isolates loadout validation from command-shape validation.
        rotation: [{ type: 'cast', skillId: skill.id }]
      });
      assert.equal(Boolean(result.steps[0].invalid), selectedSkillIds?.length === 0);
    }
  }
});

// Single casts exercise selection independently of damage formulas and saved rotations.
for (const [profession, names, simulate = simulateGw2] of [
  [necromancerProfession, ['Summon Blood Fiend', 'Blood Is Power', 'Lich Form'], simulateRuntime],
  [engineerProfession, ['Healing Turret', 'Throw Mine', 'Supply Crate'], simulateRuntime],
  [mesmerProfession, ['Ether Feast', 'Phantasmal Disenchanter', 'Time Warp'], simulateRuntime],
  [warriorProfession, ['Healing Signet', 'Throw Bolas', 'Signet of Rage'], simulateRuntime],
  [rangerProfession, ['Troll Unguent', 'Sharpening Stone', '"Strength of the Pack!"'], simulateRuntime],
  [thiefProfession, ['Hide in Shadows', 'Spider Venom', 'Thieves Guild'], simulateRuntime]
]) {
  test(`${profession.id} rejects removed heal, utility, and elite skills before emitting effects`, () => {
    for (const name of names) {
      const skill = profession.catalog.skills.find((candidate) => candidate.name === name);
      const other = profession.catalog.skills.find(
        (candidate) => candidate.name === names.find((candidate) => candidate !== name)
      ).id;
      for (const selectedSkillIds of [[], [other]]) {
        const result = simulate({
          profession,
          rotation: [
            { type: 'cast', skillId: skill.id },
            { type: 'wait', durationMs: 5000 }
          ],
          config: { ...config, selectedSkillIds }
        });
        assert.equal(result.steps[0].invalid, true, name);
        assert.match(result.warnings.map(({ message }) => message).join(' '), /is unavailable.*not equipped/, name);
        assert.equal(
          result.resolvedEvents.some((event) => event.skillId === skill.id),
          false,
          name
        );
      }

      for (const selectedSkillIds of [undefined, [skill.id]]) {
        const result = simulate({
          profession,
          rotation: [{ type: 'cast', skillId: profession.catalog.skills.find((skill) => skill.name === name).id }],
          config: { ...config, selectedSkillIds }
        });
        assert.deepEqual(result.warnings, [], name);
        assert.equal(Boolean(result.steps[0].invalid), false, name);
      }
    }
  });
}

// Replacement faces must stay usable through their equipped parent, never as independent slot choices.
for (const [profession, parent, child, specialization = 'Core', simulate = simulateGw2, opening = [parent]] of [
  [necromancerProfession, 'Summon Blood Fiend', 'Taste of Death', 'Core', simulateRuntime],
  [engineerProfession, 'Elite Mortar Kit', 'Stow Elite Mortar Kit', 'Core', simulateRuntime],
  // Power Spike starts prepared and blocks its parent, so the opener spends both charges before re-preparing.
  [
    mesmerProfession,
    'Mantra of Pain',
    'Power Spike',
    'Core',
    simulateRuntime,
    ['Power Spike', 'Power Spike', 'Mantra of Pain']
  ],
  [rangerProfession, 'Water Spirit', 'Aqua Surge', 'Core', simulateRuntime],
  [thiefProfession, 'Prepare Thousand Needles', 'Thousand Needles', 'Core', simulateRuntime],
  [thiefProfession, 'Fist Flurry', 'Palm Strike', 'Daredevil', simulateRuntime]
]) {
  test(`${profession.id} ${child} inherits its parent's selection`, () => {
    const result = simulate({
      profession,
      rotation: [...opening, { type: 'wait', durationMs: 3000 }, child],
      config: {
        ...config,
        specialization,
        selectedSkillIds: [profession.catalog.skills.find((candidate) => candidate.name === parent).id]
      }
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(Boolean(result.steps.at(-1).invalid), false);

    const removed = simulate({
      profession,
      rotation: [child],
      config: { ...config, specialization, selectedSkillIds: [] }
    });
    assert.equal(removed.steps[0].invalid, true);
    assert.match(removed.warnings.map(({ message }) => message).join(' '), /is unavailable.*not equipped/);
  });
}
