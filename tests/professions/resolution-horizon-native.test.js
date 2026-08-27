import assert from 'node:assert/strict';
import test from 'node:test';

import { simulateGw2 } from '../../js/games/gw2/platform/simulation/simulate.js';
import { necromancerProfession } from '../../js/games/gw2/content/professions/necromancer/definition.js';
import { NECROMANCER_SKILL_IDS as NECRO_SKILL } from '../../js/games/gw2/content/professions/necromancer/data/ids.js';
import { revenantProfession } from '../../js/games/gw2/content/professions/revenant/definition.js';
import { REVENANT_LEGEND_IDS as LEGEND } from '../../js/games/gw2/content/professions/revenant/data/ids.js';

const target = Object.freeze({ armor: 2597, health: 1_000_000_000 });
const attributes = Object.freeze({
  power: 2000,
  precision: 2000,
  ferocity: 500,
  conditionDamage: 1500,
  expertise: 500,
  vitality: 1000
});

function simulateNecromancer(specialization, rotation, config = {}, observationPolicy = { kind: 'rotation' }) {
  return simulateGw2({
    profession: necromancerProfession,
    rotation,
    config: {
      specialization,
      stats: attributes,
      target,
      ...config
    },
    observationPolicy
  });
}

test('native wells, projectiles, and interrupted channels obey caller observation', () => {
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
  assert.ok(well.dpsWindow > well.duration);

  const projectile = simulateNecromancer(
    'Reaper',
    [{ name: 'Grasping Darkness', interruptAfterMs: 120 }, 'Death Spiral', 'Gravedigger'],
    { primaryWeapon: 'Greatsword', boons: { quickness: true } }
  );
  const projectileHit = projectile.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === NECRO_SKILL.GRASPING_DARKNESS
  );

  assert.ok(projectileHit);
  assert.ok(projectileHit.at > projectile.steps[1].start / 1000);
  assert.ok(projectileHit.at <= projectile.duration);

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
    12
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
    summonAttacks.every((event) => event.at <= summon.duration + 7),
    true
  );

  const condition = simulateNecromancer(
    'Core',
    ['Blood Is Power'],
    { selectedSkills: ['Blood Is Power'] },
    { kind: 'tail', durationMs: 10_000 }
  );

  assert.ok(condition.conditionDamage > 0);
  assert.ok(condition.dpsWindow > condition.duration);
  assert.equal(
    condition.resolvedEvents.every((event) => event.at <= condition.duration + 10),
    true
  );
});

test('native upkeep recurrence terminates at starvation inside a finite tail', () => {
  const result = simulateGw2({
    profession: revenantProfession,
    rotation: ['Impossible Odds'],
    config: {
      specialization: 'Core',
      selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
      startingLegend: LEGEND.ASSASSIN,
      initialEnergy: 50,
      stats: attributes,
      target
    },
    observationPolicy: { kind: 'tail', durationMs: 50_000 }
  });

  assert.equal(result.endState.profession.activeUpkeeps.length, 0);
  assert.ok(Math.abs(result.endState.profession.energy - 25) < 0.01);
  assert.ok(result.dpsWindow > result.duration);
  assert.equal(
    result.events.every((event) => event.at <= result.duration + 50),
    true
  );
});
