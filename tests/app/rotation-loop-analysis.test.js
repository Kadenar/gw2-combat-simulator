import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeRotationLoops } from '../../js/app/rotation/result/loop-analysis.js';

const skills = [
  { id: 1, name: 'Grasping Dead', type: 'Weapon' },
  { id: 2, name: 'Ghastly Claws', type: 'Weapon' },
  { id: 3, name: 'Soul Grasp', type: 'Weapon' },
  { id: 100, name: 'Death Shroud', shroudEntry: 'death' },
  { id: 101, name: 'Life Blast', shroud: 'death' },
  { id: 102, name: 'Dark Path', shroud: 'death' },
  { id: 103, name: 'End Death Shroud', shroudExit: 'death' }
];

function necromancerLoopApp() {
  const sequence = [1, 2, 3, 100, 101, 102, 103, 1, 2, 3, 100, 101, 102, 103, 1, 2, 3, 100, 101, 102, 103];
  const rotation = sequence.map((skillId) => ({ skillId }));
  const events = sequence.map((skillId, index) => ({
    type: 'action',
    actorType: 'player',
    activationId: `activation-${index}`,
    skillId,
    skillName: skills.find((skill) => skill.id === skillId).name,
    at: index,
    endsAt: index + 0.5
  }));
  const steps = sequence.map((_skillId, index) => ({
    activationId: `activation-${index}`,
    ri: index,
    start: index * 1000,
    end: index * 1000 + 500
  }));
  const skillById = new Map(skills.map((skill) => [skill.id, skill]));

  return {
    adapter: { eliteSpecialization: () => 'Core' },
    profession: {
      ui: {
        timelineWeaponLineTransition: () => undefined,
        timelineSkillIcon: () => '',
        weaponSwapChangesSet: true
      }
    },
    activeCatalog: { skills, autoattackChains: [] },
    build: {
      profession: 'necromancer',
      rotation,
      startingWeaponSet: 1,
      weapons: ['Scepter', 'Focus'],
      alternateWeapons: []
    },
    skills,
    skillById,
    results: { events, steps }
  };
}

test('Necromancer loop analysis separates shroud visits from weapon visits', () => {
  // Shroud is a recurring transform phase, so its casts must not dilute the surrounding weapon consensus.
  const analysis = analyzeRotationLoops(necromancerLoopApp());
  const weaponLoop = analysis.loops.find((loop) => loop.label === 'Scepter / Focus Loop');
  const shroudLoop = analysis.loops.find((loop) => loop.label === 'Death Shroud Loop');

  assert.ok(weaponLoop);
  assert.ok(shroudLoop);
  assert.deepEqual(
    weaponLoop.steps.map((step) => step.name),
    ['Grasping Dead', 'Ghastly Claws', 'Soul Grasp']
  );
  assert.deepEqual(
    shroudLoop.steps.map((step) => step.name),
    ['Death Shroud', 'Life Blast', 'Dark Path', 'End Death Shroud']
  );
  assert.equal(weaponLoop.occurrences.length, 3);
  assert.equal(shroudLoop.occurrences.length, 3);
});
