import assert from 'node:assert/strict';
import test from 'node:test';

import { createLiveProfessionSimulator } from '#tests/helpers/live-runtime.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_SKILL_IDS as NECRO_SKILL } from '#gw2/professions/necromancer/data/ids.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { REVENANT_LEGEND_IDS as LEGEND } from '#gw2/professions/revenant/data/ids.js';

const target = Object.freeze({ armor: 2597, health: 1_000_000_000 });
const attributes = Object.freeze({
  power: 2000,
  precision: 2000,
  ferocity: 500,
  conditionDamage: 1500,
  expertise: 500,
  vitality: 1000
});

// Native recurrence and interrupted packets must observe the same caller-owned endpoint.
const simulateNecromancer = createLiveProfessionSimulator(necromancerProfession, { stats: attributes, target });

test('native wells and uncommitted interrupted effects obey caller observation', () => {
  const well = simulateNecromancer(
    'Core',
    ['Well of Suffering'],
    { selectedSkills: ['Well of Suffering'] },
    { kind: 'tail', durationMs: 6000 }
  );

  assert.equal(
    well.resolvedEvents.filter((event) => event.type === 'damage' && event.name === 'Well of Suffering').length,
    6
  );
  assert.ok(well.dpsWindow > well.rotationEndTime);

  const projectile = simulateNecromancer(
    'Reaper',
    [{ name: 'Grasping Darkness', interruptAfterMs: 100 }, 'Death Spiral', 'Gravedigger'],
    { primaryWeapon: 'Greatsword', boons: { quickness: true } }
  );
  const projectileHit = projectile.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === NECRO_SKILL.GRASPING_DARKNESS
  );

  assert.equal(projectileHit, undefined);

  const channel = simulateNecromancer(
    'Reaper',
    ["Reaper's Shroud", { name: 'Soul Spiral', interruptAfterMs: 120 }],
    { boons: { quickness: true } },
    { kind: 'tail', durationMs: 2500 }
  );

  assert.equal(channel.steps[1].interrupted, true);
  assert.equal(
    channel.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === NECRO_SKILL.SOUL_SPIRAL)
      .length,
    0
  );
});

test('native summons and condition builds stop at the observation boundary', () => {
  const summon = simulateNecromancer(
    'Core',
    ['Summon Blood Fiend'],
    { selectedSkills: ['Summon Blood Fiend'] },
    { kind: 'tail', durationMs: 7000 }
  );
  const summonAttacks = summon.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Summon Blood Fiend - Minion Attack'
  );

  assert.ok(summonAttacks.length >= 2);
  assert.equal(
    summonAttacks.every((event) => event.at <= summon.rotationEndTime + 7),
    true
  );

  const condition = simulateNecromancer(
    'Core',
    ['Blood Is Power'],
    { selectedSkills: ['Blood Is Power'] },
    { kind: 'tail', durationMs: 10_000 }
  );

  assert.ok(condition.conditionDamage > 0);
  assert.ok(condition.dpsWindow > condition.rotationEndTime);
  assert.equal(
    condition.resolvedEvents.every((event) => event.at <= condition.rotationEndTime + 10),
    true
  );
});

test('native upkeep recurrence terminates at starvation inside a finite tail', () => {
  // The registered live family owns upkeep drain and starvation inside the caller's observation tail.
  const result = createLiveProfessionSimulator(revenantProfession, {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 50,
    stats: attributes,
    target
  })('Core', ['Impossible Odds'], {}, { kind: 'tail', durationMs: 50_000 });

  assert.equal(result.planningState.profession.activeUpkeeps.length, 0);
  assert.ok(Math.abs(result.planningState.profession.energy.value - 25) < 0.01);
  assert.ok(result.dpsWindow > result.rotationEndTime);
  assert.equal(
    result.events.every((event) => event.at <= result.rotationEndTime + 50),
    true
  );
});
