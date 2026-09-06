import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { necromancerProfession } from '#gw2/professions/necromancer/definition.js';
import { engineerProfession } from '#gw2/professions/engineer/definition.js';
import { mesmerProfession } from '#gw2/professions/mesmer/definition.js';
import { warriorProfession } from '#gw2/professions/warrior/definition.js';
import { rangerProfession } from '#gw2/professions/ranger/definition.js';
import { thiefProfession } from '#gw2/professions/thief/definition.js';

const config = {
  specialization: 'Core',
  stats: { power: 2000, precision: 1000, vitality: 1000, conditionDamage: 1000 },
  target: { armor: 2597 }
};

// Single casts exercise selection independently of damage formulas and saved rotations.
for (const [profession, names] of [
  [necromancerProfession, ['Summon Blood Fiend', 'Blood Is Power', 'Lich Form']],
  [engineerProfession, ['Healing Turret', 'Throw Mine', 'Supply Crate']],
  [mesmerProfession, ['Ether Feast', 'Phantasmal Disenchanter', 'Time Warp']],
  [warriorProfession, ['Healing Signet', 'Throw Bolas', 'Signet of Rage']],
  [rangerProfession, ['Troll Unguent', 'Sharpening Stone', '"Strength of the Pack!"']],
  [thiefProfession, ['Hide in Shadows', 'Spider Venom', 'Thieves Guild']]
]) {
  test(`${profession.id} rejects removed heal, utility, and elite skills before emitting effects`, () => {
    for (const name of names) {
      const skill = profession.catalog.skillsByName.get(name);
      const other = names.find((candidate) => candidate !== name);
      for (const selectedSkills of [[], {}, [other], { Utility1: other }]) {
        const result = simulateGw2({
          profession,
          rotation: [name, { type: 'wait', durationMs: 5000 }],
          config: { ...config, selectedSkills }
        });
        assert.equal(result.steps[0].invalid, true, name);
        assert.match(result.warnings.join(' '), /is unavailable.*not equipped/, name);
        assert.equal(
          result.resolvedEvents.some((event) => event.skillId === skill.id),
          false,
          name
        );
      }

      for (const selectedSkills of [undefined, [name], { [skill.type]: { name } }]) {
        const result = simulateGw2({ profession, rotation: [name], config: { ...config, selectedSkills } });
        assert.deepEqual(result.warnings, [], name);
        assert.equal(Boolean(result.steps[0].invalid), false, name);
      }
    }
  });
}

// Replacement faces must stay usable through their equipped parent, never as independent slot choices.
for (const [profession, parent, child, specialization = 'Core'] of [
  [necromancerProfession, 'Summon Blood Fiend', 'Taste of Death'],
  [engineerProfession, 'Elite Mortar Kit', 'Stow Elite Mortar Kit'],
  [mesmerProfession, 'Mantra of Pain', 'Power Spike'],
  [rangerProfession, 'Water Spirit', 'Aqua Surge'],
  [thiefProfession, 'Prepare Thousand Needles', 'Thousand Needles'],
  [thiefProfession, 'Fist Flurry', 'Palm Strike', 'Daredevil']
]) {
  test(`${profession.id} ${child} inherits its parent's selection`, () => {
    const result = simulateGw2({
      profession,
      rotation: [parent, { type: 'wait', durationMs: 3000 }, child],
      config: { ...config, specialization, selectedSkills: [parent] }
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(Boolean(result.steps.at(-1).invalid), false);

    const removed = simulateGw2({
      profession,
      rotation: [child],
      config: { ...config, specialization, selectedSkills: [] }
    });
    assert.equal(removed.steps[0].invalid, true);
    assert.match(removed.warnings.join(' '), /is unavailable.*not equipped/);
  });
}
