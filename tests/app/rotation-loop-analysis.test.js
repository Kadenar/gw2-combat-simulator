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

const elementalistSkills = [
  { id: 10, name: 'Filler Shot', type: 'Weapon', slot: 'Weapon_1', cooldown: 0 },
  { id: 11, name: 'Searing Salvo', type: 'Weapon', attunement: 'Fire', cooldown: 12 },
  { id: 12, name: 'Raging Ricochet', type: 'Weapon', attunement: 'Fire', cooldown: 6 },
  { id: 13, name: 'Wildfire', type: 'Weapon', attunement: 'Fire', cooldown: 30 },
  { id: 21, name: 'Frigid Flurry', type: 'Weapon', attunement: 'Water', cooldown: 5 },
  { id: 22, name: 'Frozen Fusillade', type: 'Weapon', attunement: 'Water', cooldown: 15 },
  { id: 31, name: 'Dazing Discharge', type: 'Weapon', attunement: 'Air', cooldown: 8 },
  { id: 32, name: 'Lightning Orb', type: 'Weapon', attunement: 'Air', cooldown: 25 },
  { id: 33, name: 'Cyclone', type: 'Weapon', attunement: 'Air', cooldown: 25 },
  { id: 41, name: 'Boulder Blast', type: 'Weapon', attunement: 'Earth', cooldown: 12 },
  { id: 42, name: 'Dust Storm', type: 'Weapon', attunement: 'Earth', cooldown: 30 },
  { id: 101, name: 'Fire Attunement', type: 'Profession', cooldown: 0 },
  { id: 102, name: 'Water Attunement', type: 'Profession', cooldown: 0 },
  { id: 103, name: 'Air Attunement', type: 'Profession', cooldown: 0 },
  { id: 104, name: 'Earth Attunement', type: 'Profession', cooldown: 0 }
];

/** Builds small attunement visits whose only variation is an intentional every-other-loop cooldown. */
function elementalistAlternatingLoopApp() {
  const skillByName = new Map(elementalistSkills.map((skill) => [skill.name, skill]));
  const names = [];
  for (let cycle = 0; cycle < 8; cycle += 1) {
    names.push(
      'Filler Shot',
      'Searing Salvo',
      cycle % 2 ? 'Wildfire' : 'Raging Ricochet',
      'Water Attunement',
      'Filler Shot',
      'Frigid Flurry'
    );

    if (cycle % 2 === 0) names.push('Frozen Fusillade');
    names.push(
      'Air Attunement',
      'Filler Shot',
      'Dazing Discharge',
      cycle % 2 ? 'Cyclone' : 'Lightning Orb',
      'Earth Attunement',
      'Filler Shot',
      'Boulder Blast'
    );

    if (cycle % 2 === 0) names.push('Dust Storm');
    names.push('Fire Attunement');
  }

  names.push('Filler Shot');
  const sequence = names.map((name) => skillByName.get(name).id);
  const rotation = sequence.map((skillId) => ({ skillId }));
  const events = sequence.map((skillId, index) => ({
    type: 'action',
    actorType: 'player',
    activationId: `elementalist-${index}`,
    skillId,
    skillName: elementalistSkills.find((skill) => skill.id === skillId).name,
    at: index,
    endsAt: index + 0.5
  }));
  const steps = sequence.map((_skillId, index) => ({
    activationId: `elementalist-${index}`,
    ri: index,
    start: index * 1000,
    end: index * 1000 + 500
  }));
  const skillById = new Map(elementalistSkills.map((skill) => [skill.id, skill]));

  return {
    adapter: { eliteSpecialization: () => 'Evoker' },
    profession: {
      ui: {
        timelineWeaponLineTransition: () => undefined,
        timelineSkillIcon: () => '',
        weaponSwapChangesSet: false
      }
    },
    activeCatalog: { skills: elementalistSkills, autoattackChains: [] },
    build: {
      profession: 'elementalist',
      rotation,
      startAttunement: 'Fire',
      startingWeaponSet: 1,
      weapons: ['Pistol', 'Warhorn'],
      alternateWeapons: []
    },
    skills: elementalistSkills,
    skillById,
    results: { events, steps }
  };
}

/** Replaces one otherwise stable Fire action per visit to verify confidence uses the complete cohort. */
function elementalistInconsistentLoopApp() {
  const app = elementalistAlternatingLoopApp();
  const variableSkills = Array.from({ length: 8 }, (_value, index) => ({
    id: 200 + index,
    name: `Variable Fire Skill ${index + 1}`,
    type: 'Weapon',
    attunement: 'Fire',
    cooldown: 10
  }));
  let visit = 0;
  for (const event of app.results.events) {
    if (event.skillName !== 'Searing Salvo') continue;
    event.skillId = variableSkills[visit].id;
    event.skillName = variableSkills[visit].name;
    visit += 1;
  }

  const skills = [...elementalistSkills, ...variableSkills];
  app.skills = skills;
  app.activeCatalog = { skills, autoattackChains: [] };
  app.skillById = new Map(skills.map((skill) => [skill.id, skill]));
  return app;
}

/** Adds a real precast marker while preserving the same steady-state visits used by the cadence test. */
function elementalistPrecastLoopApp() {
  const app = elementalistAlternatingLoopApp();
  app.build.rotation = [app.build.rotation[0], { type: 'combat-start' }, ...app.build.rotation.slice(1)];
  for (const step of app.results.steps) {
    if (step.ri >= 1) step.ri += 1;
  }

  return app;
}

/** Builds a reset-only burst followed by stable Fire/Air visits with state-gated zero-recharge flips. */
function elementalistStatefulOpenerApp() {
  const skills = [
    { id: 301, name: 'Opening Burst One', type: 'Utility', attunement: 'Fire', cooldown: 90 },
    { id: 302, name: 'Opening Burst Two', type: 'Utility', attunement: 'Fire', cooldown: 90 },
    { id: 303, name: 'Opening Burst Three', type: 'Utility', attunement: 'Fire', cooldown: 90 },
    { id: 311, name: 'Fire Core', type: 'Weapon', attunement: 'Fire', cooldown: 8 },
    {
      id: 312,
      name: 'Etching: Volcano',
      type: 'Weapon',
      attunement: 'Fire',
      cooldown: 25,
      elementalistStateMachine: 'spear-etching'
    },
    {
      id: 313,
      name: 'Volcano',
      type: 'Weapon',
      attunement: 'Fire',
      cooldown: 0,
      elementalistStateMachine: 'spear-etching'
    },
    { id: 321, name: 'Air Core', type: 'Weapon', attunement: 'Air', cooldown: 8 },
    {
      id: 322,
      name: 'Etching: Derecho',
      type: 'Weapon',
      attunement: 'Air',
      cooldown: 25,
      elementalistStateMachine: 'spear-etching'
    },
    {
      id: 323,
      name: 'Derecho',
      type: 'Weapon',
      attunement: 'Air',
      cooldown: 0,
      elementalistStateMachine: 'spear-etching'
    },
    { id: 391, name: 'Fire Attunement', type: 'Profession', cooldown: 0 },
    { id: 392, name: 'Air Attunement', type: 'Profession', cooldown: 0 }
  ];
  const skillByName = new Map(skills.map((skill) => [skill.name, skill]));
  const names = [];
  for (let cycle = 0; cycle < 5; cycle += 1) {
    if (cycle === 0) names.push('Opening Burst One', 'Opening Burst Two', 'Opening Burst Three');
    names.push(
      'Fire Core',
      'Etching: Volcano',
      'Volcano',
      'Air Attunement',
      'Air Core',
      'Etching: Derecho',
      'Derecho',
      'Fire Attunement'
    );
  }

  const sequence = names.map((name) => skillByName.get(name).id);
  const rotation = sequence.map((skillId) => ({ skillId }));
  const events = sequence.map((skillId, index) => ({
    type: 'action',
    actorType: 'player',
    activationId: `stateful-elementalist-${index}`,
    skillId,
    skillName: skills.find((skill) => skill.id === skillId).name,
    at: index,
    endsAt: index + 0.5
  }));
  const steps = sequence.map((_skillId, index) => ({
    activationId: `stateful-elementalist-${index}`,
    ri: index,
    start: index * 1000,
    end: index * 1000 + 500
  }));
  const skillById = new Map(skills.map((skill) => [skill.id, skill]));

  return {
    adapter: { eliteSpecialization: () => 'Catalyst' },
    profession: {
      ui: {
        timelineWeaponLineTransition: () => undefined,
        timelineSkillIcon: () => '',
        weaponSwapChangesSet: false
      }
    },
    activeCatalog: { skills, autoattackChains: [] },
    build: {
      profession: 'elementalist',
      rotation,
      startAttunement: 'Fire',
      startingWeaponSet: 1,
      weapons: ['Spear', ''],
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

test('Elementalist loop analysis retains alternating cooldown skills and removes filler', () => {
  // Alternating lane skills are part of the repeat contract even though each appears in only half of the visits.
  const analysis = analyzeRotationLoops(elementalistAlternatingLoopApp());
  const loops = new Map(analysis.loops.map((loop) => [loop.label, loop]));

  assert.deepEqual(
    loops
      .get('Fire Attunement Loop')
      .steps.map((step) => step.name)
      .sort(),
    ['Raging Ricochet', 'Searing Salvo', 'Wildfire']
  );
  assert.deepEqual(
    loops.get('Water Attunement Loop').steps.map((step) => step.name),
    ['Frigid Flurry', 'Frozen Fusillade']
  );
  assert.deepEqual(
    loops
      .get('Air Attunement Loop')
      .steps.map((step) => step.name)
      .sort(),
    ['Cyclone', 'Dazing Discharge', 'Lightning Orb']
  );
  assert.deepEqual(
    loops.get('Earth Attunement Loop').steps.map((step) => step.name),
    ['Boulder Blast', 'Dust Storm']
  );
  assert.ok(analysis.loops.every((loop) => loop.occurrences.length === 8));
  assert.ok(analysis.loops.every((loop) => loop.steps.every((step) => step.name !== 'Filler Shot')));

  for (const name of ['Raging Ricochet', 'Wildfire', 'Frozen Fusillade', 'Cyclone', 'Lightning Orb', 'Dust Storm']) {
    const step = analysis.loops.flatMap((loop) => loop.steps).find((candidate) => candidate.name === name);
    assert.equal(step.repeatInterval, 2, name);
    assert.equal(step.repeatRegularity, 1, name);
  }
});

test('Boundary-loop confidence evaluates every completed visit', () => {
  // A stable subset must not manufacture high confidence while half of each visit remains unexplained.
  const analysis = analyzeRotationLoops(elementalistInconsistentLoopApp());
  const fire = analysis.loops.find((loop) => loop.label === 'Fire Attunement Loop');

  assert.ok(fire);
  assert.equal(fire.occurrences.length, 8);
  assert.notEqual(fire.confidence, 'high');
});

test('Precast structural visits remain opener actions without losing consensus evidence', () => {
  // The first visit of each lane teaches the pattern, but the repeating body starts after the precast ramp completes.
  const analysis = analyzeRotationLoops(elementalistPrecastLoopApp());
  const firstLoopStartMs = Math.min(...analysis.loops.flatMap((loop) => loop.occurrences.map((item) => item.startMs)));

  assert.equal(analysis.openerActionCount, 12);
  assert.equal(analysis.openerSteps.at(-1).name, 'Earth Attunement');
  assert.equal(firstLoopStartMs, 12_000);
  assert.equal(
    analysis.loops.find((loop) => loop.label === 'Fire Attunement Loop').steps.find((step) => step.name === 'Wildfire')
      .repeatInterval,
    2
  );
});

test('Exceptional first structural pass becomes an opener and stateful flips remain loop steps', () => {
  // Reset-only actions identify the first pass as an opener without a combat-start marker.
  const analysis = analyzeRotationLoops(elementalistStatefulOpenerApp());
  const loops = new Map(analysis.loops.map((loop) => [loop.label, loop]));
  const firstLoopStartMs = Math.min(...analysis.loops.flatMap((loop) => loop.occurrences.map((item) => item.startMs)));

  assert.equal(analysis.openerActionCount, 11);
  assert.equal(analysis.openerSteps.at(-1).name, 'Fire Attunement');
  assert.equal(firstLoopStartMs, 11_000);
  assert.ok(loops.get('Fire Attunement Loop').steps.some((step) => step.name === 'Volcano'));
  assert.ok(loops.get('Air Attunement Loop').steps.some((step) => step.name === 'Derecho'));
});
