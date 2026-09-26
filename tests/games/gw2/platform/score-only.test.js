import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadProfession } from '#gw2/app/profession-registry.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { createGw2ComboResolution } from '#gw2/platform/resolver/combo-resolution.js';
import { applyElementalistResolverAura } from '#gw2/professions/elementalist/core/mechanics/reactions.js';

test('combo and aura handlers skip score report rows while preserving state and reactions', () => {
  // Check the internal buffer: score output alone hides accidentally retained report rows.
  for (const reporting of [false, true]) {
    const dispatched = [];
    const context = {
      reporting,
      resolved: [],
      traits: new Set(),
      profession: { core: { activeAuras: [] } },
      dispatchReaction: (name, event) => dispatched.push([name, event])
    };
    const handlers = createGw2ComboResolution({
      reactions: { dispatch: (name, ctx, event) => ctx.dispatchReaction(name, event) }
    });
    const combo = { type: 'combo', at: 1 };
    const aura = { type: 'aura', at: 1 };
    const generatedAura = {
      type: 'elementalist.aura',
      at: 1,
      aura: 'Fire',
      duration: 4,
      skillName: 'Fixture Aura',
      elementalistResolverGeneratedAura: true
    };

    handlers.combo(context, combo);
    handlers.aura(context, aura);
    applyElementalistResolverAura(context, generatedAura);

    assert.deepEqual(context.resolved, reporting ? [combo, aura, generatedAura] : []);
    assert.deepEqual(dispatched, [
      ['combo.resolved', combo],
      ['aura.applied', aura],
      ['aura.applied', generatedAura]
    ]);
    assert.deepEqual(context.profession.core.activeAuras, [
      { type: 'Fire', appliedAt: 1, expiresAt: 5, skillName: 'Fixture Aura' }
    ]);
  }
});

test('score skips end-state projection for a custom profession without feedback', () => {
  let projections = 0;
  const profession = defineProfession({
    id: 'score-test',
    name: 'Score test',
    resources: {
      projectPlanningState() {
        projections += 1;
        return {};
      }
    }
  });
  // Only detailed output needs projections, regardless of the profession's identity.
  simulateGw2({ profession, rotation: [] });
  assert.equal(projections, 1);
  simulateGw2({ profession, rotation: [], output: 'score' });
  assert.equal(projections, 1);
});

// Short casts exercise profession reporting writers; exact parity covers every numeric score field.
async function parity(
  id,
  rotation,
  config,
  observationPolicy = { kind: 'tail', durationMs: 2500 },
  simulate = simulateGw2
) {
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
  const detailed = simulate(options);
  const score = simulate({ ...options, output: 'score' });
  for (const [key, value] of Object.entries(score)) {
    if (key !== 'output') assert.deepEqual(value, detailed[key], `${id}: ${key}`);
  }

  assert.equal('resolvedEvents' in score, false);
  assert.equal('planningState' in score, false);
  assert.ok(score.totalDamage > 0, `${id}: scenario must cause damage`);
  assert.ok(
    !score.warnings.some((warning) => /unknown|not found/i.test(warning)),
    `${id}: ${score.warnings.join(', ')}`
  );
  return { detailed, score };
}

for (const [id, skill, primaryWeapon, simulate] of [
  ['elementalist', 'Fireball', 'Staff', simulateGw2],
  ['engineer', 'Rifle Burst', 'Rifle', simulateGw2],
  ['guardian', 'Sword of Wrath', 'Sword'],
  ['mesmer', 'Mind Slash', 'Sword'],
  ['ranger', 'Splitblade', 'Axe', simulateGw2],
  ['revenant', 'Preparation Thrust', 'Sword'],
  ['thief', 'Heartseeker', 'Dagger'],
  ['warrior', 'Chop', 'Axe', simulateGw2]
]) {
  test(`score output preserves ${id} combat`, () => parity(id, [skill], { primaryWeapon }, undefined, simulate));
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
  const swap = await parity(
    'warrior',
    ['Chop', 'Swap Weapons', 'Chop'],
    {
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Axe',
      weaponSet2Primary: 'Axe',
      weaponSet2Secondary: 'Axe',
      sigilSets: [{ names: ['Force', 'Accuracy'] }, { names: ['Geomancy', 'Doom'] }]
    },
    undefined,
    simulateGw2
  );
  assert.ok(swap.score.conditionDamage > 0);
  assert.equal(swap.detailed.planningState.activeWeaponSet, 2);
});

test('Necromancer score retains live Gravedigger and condition/environment health outcomes', () =>
  parity(
    'necromancer',
    ['Nightfall', 'Gravedigger', 'Gravedigger'],
    {
      specialization: 'Reaper',
      primaryWeapon: 'Greatsword',
      target: { armor: 2597, health: 40000, startingHealthFraction: 0.6, conditions: { Bleeding: 10 } }
    },
    undefined,
    simulateGw2
  ));

test('Ranger retains live pet condition applications across swaps', async () => {
  const { detailed } = await parity(
    'ranger',
    ['Rending Pounce', { name: '__wait', waitMs: 2000 }, 'Swap Pets', { name: '__wait', waitMs: 2000 }],
    {
      primaryWeapon: 'Axe',
      selectedPet: 'Lynx',
      selectedPet2: 'Tiger'
    },
    undefined,
    simulateGw2
  );
  assert.ok(
    detailed.resolvedEvents.some(
      (event) => event.source === 'ranger-pet' && event.type === 'condition' && Number.isFinite(event.removedAt)
    )
  );
});
