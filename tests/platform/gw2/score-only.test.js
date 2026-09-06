import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadProfession } from '#gw2/app/profession/registry.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';

// Short casts exercise profession reporting writers; exact parity covers every numeric score field.
async function parity(id, rotation, config, observationPolicy = { kind: 'tail', durationMs: 2500 }) {
  const profession = await loadProfession(id);
  const options = {
    profession,
    rotation,
    observationPolicy,
    config: {
      specialization: 'Core',
      stats: { power: 2000, precision: 3000, ferocity: 500, conditionDamage: 1000, expertise: 1500, vitality: 1000 },
      target: { armor: 2597, conditions: { Vulnerability: 25 } },
      ...config
    }
  };
  const detailed = simulateGw2(options);
  const score = simulateGw2({ ...options, output: 'score' });
  for (const [key, value] of Object.entries(score)) {
    if (key !== 'output') assert.deepEqual(value, detailed[key], `${id}: ${key}`);
  }

  assert.equal('resolvedEvents' in score, false);
  assert.equal('endState' in score, false);
  assert.ok(score.totalDamage > 0, `${id}: scenario must cause damage`);
  assert.ok(
    !score.warnings.some((warning) => /unknown|not found/i.test(warning)),
    `${id}: ${score.warnings.join(', ')}`
  );
  return { detailed, score };
}

for (const [id, skill, primaryWeapon] of [
  ['elementalist', 'Fireball', 'Staff'],
  ['engineer', 'Rifle Burst', 'Rifle'],
  ['guardian', 'Sword of Wrath', 'Sword'],
  ['mesmer', 'Mind Slash', 'Sword'],
  ['ranger', 'Splitblade', 'Axe'],
  ['revenant', 'Preparation Thrust', 'Sword'],
  ['thief', 'Heartseeker', 'Dagger'],
  ['warrior', 'Chop', 'Axe']
]) {
  test(`score output preserves ${id} combat`, () => parity(id, [skill], { primaryWeapon }));
}

test('score preserves fractional conditions, caps, on-crit procs, relic ICD and explicit DPS boundaries', async () => {
  await parity(
    'mesmer',
    ['__combat_start', 'Ether Bolt', { name: '__wait', waitMs: 1500 }, 'Ether Bolt'],
    {
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Pistol',
      sigilSets: [{ names: ['Earth', 'Torment'] }],
      relic: 'Fireworks',
      food: 'Spherified Cilantro Oyster Soup'
    },
    { kind: 'absolute', endTimeMs: 3750 }
  );
});

test('score preserves finite health, missing health and environment attribution', async () => {
  const { score } = await parity('mesmer', [{ name: '__wait', waitMs: 1000 }, 'Ether Bolt'], {
    primaryWeapon: 'Scepter',
    target: { armor: 2597, health: 10000, startingHealthFraction: 0.5, conditions: { Bleeding: 10 } }
  });
  assert.ok(score.environmentDamage > 0);
  assert.equal(score.totalDamage, score.strikeDamage + score.conditionDamage);
});

test('score preserves relic activation and weapon-swap condition procs', async () => {
  const relic = await parity('mesmer', ['Distortion', 'Mind Slash'], { primaryWeapon: 'Sword', relic: 'Fireworks' });
  assert.ok(relic.detailed.procSteps.some((step) => step.type === 'relic_proc'));
  const swap = await parity('warrior', ['Chop', 'Swap Weapons', 'Chop'], {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Axe',
    weaponSet2Primary: 'Axe',
    weaponSet2Secondary: 'Axe',
    sigilSets: [{ names: ['Force', 'Accuracy'] }, { names: ['Geomancy', 'Doom'] }]
  });
  assert.ok(swap.score.conditionDamage > 0);
  assert.equal(swap.detailed.endState.activeWeaponSet, 2);
});

test('score reschedules gear-dependent self-generated Quickness instead of reusing cast times', async () => {
  const rotation = ['"Feel My Wrath!"', { type: 'wait', durationMs: 7000 }, 'Sword of Wrath'];
  const config = {
    primaryWeapon: 'Sword',
    boons: { quickness: false, alacrity: false },
    stats: { power: 2000, precision: 1500, ferocity: 500, concentration: 0 }
  };
  const low = await parity('guardian', rotation, config);
  const high = await parity('guardian', rotation, { ...config, stats: { ...config.stats, concentration: 1500 } });
  assert.notEqual(low.detailed.duration, high.detailed.duration);
});

test('Necromancer retains ordinary feedback passes for Gravedigger and condition/environment health', () =>
  parity('necromancer', ['Nightfall', 'Gravedigger', 'Gravedigger'], {
    specialization: 'Reaper',
    primaryWeapon: 'Greatsword',
    target: { armor: 2597, health: 40000, startingHealthFraction: 0.6, conditions: { Bleeding: 10 } }
  }));

test('Ranger retains live pet condition applications across swaps', async () => {
  const { detailed } = await parity(
    'ranger',
    ['Rending Pounce', { name: '__wait', waitMs: 2000 }, 'Swap Pets', { name: '__wait', waitMs: 2000 }],
    {
      primaryWeapon: 'Axe',
      selectedPet: 'Lynx',
      selectedPet2: 'Tiger'
    }
  );
  assert.ok(
    detailed.resolvedEvents.some(
      (event) => event.source === 'ranger-pet' && event.type === 'condition' && Number.isFinite(event.removedAt)
    )
  );
});
