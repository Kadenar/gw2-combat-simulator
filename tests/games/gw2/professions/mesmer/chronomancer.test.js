import assert from 'node:assert/strict';
import test from 'node:test';

import { simulationEventLogRows } from '#gw2/app/results/event-log.js';
import { mechanicResourceSpends } from '#gw2/app/rotation/timeline/model.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

// Neither exit rewinds chain progress, restores a completed chain, or erases a chain started during Split.
test('manual and automatic Continuum exits leave autoattack chains at their live step', () => {
  for (const [primaryWeapon, root, first, second, third] of [
    ['Sword', ID.MIND_SLASH, 'Mind Slash', 'Mind Gash', 'Mind Spike'],
    ['Spear', ID.PSYCUT, 'Psycut', 'Psystrike', 'Mind Pierce']
  ]) {
    const config = defaultSimulationConfig({ specialization: 'Chronomancer', primaryWeapon, initialResource: 3 });
    for (const rotation of [
      [first, 'Continuum Split', second],
      [first, 'Continuum Split', second, third],
      ['Continuum Split', first]
    ]) {
      const before = simulateMesmer(rotation, config);
      assert.deepEqual(before.warnings, []);
      for (const exit of [['Continuum Shift'], [{ type: 'wait', durationMs: 7000 }]]) {
        const after = simulateMesmer([...rotation, ...exit], config);
        assert.deepEqual(after.warnings, []);
        assert.equal(after.planningState.profession[STATE.CONTINUUM_ACTIVE], false);
        assert.equal(
          after.planningState.profession[STATE.AUTOATTACK_CHAINS][root],
          before.planningState.profession[STATE.AUTOATTACK_CHAINS][root]
        );
      }
    }
  }
});

// Neither exit may erase Mimic used inside Split or rewind progress and utility surcharges from before it.
test('manual and automatic Continuum exits preserve Mimic recharge and its utility surcharge', () => {
  const config = { specialization: 'Chronomancer', initialResource: 3, selectedTraitIds: [] };
  for (const prefix of [
    ['Continuum Split', 'Mimic'],
    ['Mimic', 'Continuum Split'],
    ['Continuum Split', 'Mimic', 'Signet of Midnight'],
    ['Mimic', 'Continuum Split', 'Signet of Midnight'],
    ['Mimic', 'Signet of Midnight', 'Continuum Split']
  ]) {
    const before = simulateMesmer(prefix, config);
    assert.deepEqual(before.warnings, []);
    assert.ok(before.planningState.cooldownsBySkillId[ID.MIMIC]);
    for (const exit of [[{ name: '__wait', waitMs: 1000 }, 'Continuum Shift'], [{ name: '__wait', waitMs: 8000 }]]) {
      const after = simulateMesmer([...prefix, ...exit], config);
      assert.deepEqual(after.warnings, []);
      assert.ok(after.events.some((event) => event.type === 'marker' && event.name === 'Continuum Shift'));
      assert.equal(
        after.planningState.cooldownsBySkillId[ID.MIMIC].readyAtMs,
        before.planningState.cooldownsBySkillId[ID.MIMIC].readyAtMs
      );
    }
  }
});

test('Continuum restoration projects ammo without checkpoint-relative fields', () => {
  // Both named and ID-based public ammo projections expose only live state after a rewind.
  const result = simulateMesmer(
    ['Power Spike', 'Continuum Split', 'Continuum Shift'],
    defaultSimulationConfig({ specialization: 'Chronomancer', initialResource: 3 })
  );
  assert.deepEqual(result.warnings, []);
  assert.ok(result.planningState.ammoBySkillId[10212]);
  for (const ammo of [
    ...Object.values(result.planningState.ammoBySkillId),
    ...Object.values(result.planningState.ammoBySkillId)
  ]) {
    assert.equal(Object.hasOwn(ammo, 'nextRechargeRemaining'), false);
    assert.equal(Object.hasOwn(ammo, 'lockoutRemaining'), false);
  }
});

// Chronomancer clone refunds, phantasm repeats, and Continuum snapshots retain their timing contracts.
test('Illusionary Reversion refunds one clone only after shattering three', () => {
  const config = defaultSimulationConfig({
    specialization: 'Chronomancer',
    selectedTraitIds: [TRAIT.ILLUSIONARY_REVERSION]
  });
  const fullShatter = simulateMesmer(['Split Second'], {
    ...config,
    initialResource: 3
  });
  const partialShatter = simulateMesmer(['Split Second'], {
    ...config,
    initialResource: 2
  });
  const continuumSplit = simulateMesmer(['Continuum Split'], {
    ...config,
    initialResource: 3
  });

  assert.equal(fullShatter.planningState.profession[STATE.RESOURCE], 1);
  assert.equal(partialShatter.planningState.profession[STATE.RESOURCE], 0);
  assert.equal(continuumSplit.planningState.profession[STATE.RESOURCE], 1);
  assert.ok(
    simulationEventLogRows(fullShatter).some((event) =>
      event.description.includes('CLONE SPAWNED x1 → 1/3 [Illusionary Reversion] (Clone #4 [Dagger])')
    )
  );
});

// A phantasm must finish attacking before conversion, including its Chronophantasma repeat.
test('Phantasmal Lancer attacks before conversion and Chronophantasma repeats before final conversion', () => {
  const rotation = ['Phantasmal Lancer', { name: '__wait', waitMs: 5000 }];
  const baseConfig = {
    initialResource: 0,
    primaryWeapon: 'Spear',
    secondaryWeapon: ''
  };
  const normal = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      ...baseConfig,
      specialization: 'Virtuoso',
      selectedTraitIds: []
    })
  );
  const chronophantasma = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      ...baseConfig,
      specialization: 'Chronomancer',
      selectedTraitIds: [TRAIT.CHRONOPHANTASMA]
    })
  );
  const normalCastEnd = normal.steps.find((step) => step.skillName === 'Phantasmal Lancer').end / 1000;
  const chronoCastEnd = chronophantasma.steps.find((step) => step.skillName === 'Phantasmal Lancer').end / 1000;
  const normalDamage = normal.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Phantasmal Lancer' && event.source === 'Phantasm'
  );
  const normalConversion = normal.events.find((event) => event.reason === 'Phantasmal Lancer phantasm conversion');
  const chronoDamage = chronophantasma.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Phantasmal Lancer' && event.source === 'Phantasm'
  );
  const resummon = chronophantasma.events.find(
    (event) => event.type === 'mesmer.phantasm-resummoned' && event.name === 'Phantasmal Lancer'
  );
  const repeatDamage = chronophantasma.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Phantasmal Lancer - Chronophantasma'
  );
  const chronoConversion = chronophantasma.events.find(
    (event) => event.reason === 'Phantasmal Lancer phantasm conversion'
  );

  assert.ok(normalDamage.at >= normalCastEnd);
  assert.ok(normalConversion.at > normalDamage.at);
  assert.ok(chronoDamage.at >= chronoCastEnd);
  assert.ok(resummon.at > chronoDamage.at);
  assert.ok(repeatDamage.at >= resummon.at);
  assert.ok(chronoConversion.at > repeatDamage.at);
});

test('Chronophantasma conversions preserve clone spends across a Continuum Split boundary', () => {
  const result = simulateMesmer(
    [
      'Phantasmal Berserker',
      'Swap Weapons',
      'Phantasmal Disenchanter',
      { name: '__wait', waitMs: 3980 },
      'Continuum Split',
      { name: '__wait', waitMs: 150 },
      'Time Sink',
      'Rewinder',
      'Mirror Images',
      { name: '__wait', waitMs: 300 },
      'Continuum Shift',
      'Rewinder'
    ],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedTraitIds: [TRAIT.BOUNTIFUL_BLADES, TRAIT.CHRONOPHANTASMA],
      selectedSkillIds: [10202],
      primaryWeapon: 'Greatsword',
      secondaryWeapon: '',
      weaponSet2Primary: 'Dagger',
      weaponSet2Secondary: 'Focus',
      initialResource: 2
    })
  );
  assert.deepEqual(result.warnings, []);
  const spends = result.events
    .filter((event) => event.type === 'resource' && event.reason === 'profession mechanic')
    .map((event) => [result.steps.find((step) => step.activationId === event.activationId)?.skillName, -event.amount]);

  assert.deepEqual(spends, [
    ['Continuum Split', 2],
    ['Time Sink', 1],
    ['Rewinder', 0],
    ['Rewinder', 3]
  ]);
});

test('concurrent Continuum Split excludes the still-casting skill from its snapshot', () => {
  const result = simulateMesmer(
    ['Phantasmal Warlock', { name: 'Continuum Split', offset: 100 }, 'Continuum Shift', 'Phantasmal Warlock'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 3,
      primaryWeapon: 'Staff',
      secondaryWeapon: ''
    })
  );

  assert.ok(result.steps[0].end > result.steps[1].start);
  assert.equal(result.steps[1].start, 120);
  assert.equal(result.steps[3].start, result.steps[2].end);
});

test('a cooldown-delayed Continuum Split still excludes a skill that remains in flight', () => {
  const result = simulateMesmer(
    [
      'Continuum Split',
      { name: '__wait', waitMs: 1 },
      'Continuum Shift',
      { name: '__wait', waitMs: 69199 },
      'Phantasmal Swordsman',
      { name: 'Continuum Split', offset: 100 },
      'Continuum Shift',
      'Phantasmal Swordsman'
    ],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 3,
      primaryWeapon: 'Dagger',
      secondaryWeapon: 'Sword'
    })
  );
  const delayedSplit = result.steps.find((step) => step.rotationCommandIndex === 5);
  const firstSwordsman = result.steps.find((step) => step.rotationCommandIndex === 4);
  const restoredSwordsman = result.steps.find((step) => step.rotationCommandIndex === 7);

  assert.equal(delayedSplit.start, 70040);
  assert.equal(restoredSwordsman.start, firstSwordsman.end);
});

test('Mind the Gap grants its clone before a concurrent two-clone Continuum Split snapshot', () => {
  const result = simulateMesmer(
    ['Mind the Gap', { name: 'Continuum Split', offset: 560 }, 'Continuum Shift', 'Mind the Gap'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 1,
      primaryWeapon: 'Spear',
      secondaryWeapon: ''
    })
  );
  const clone = result.events.find((event) => event.type === 'resource' && event.reason === 'Mind the Gap');

  assert.ok(clone.at * 1000 <= result.steps[1].start);
  assert.deepEqual(mechanicResourceSpends(result).get(1), {
    count: 2,
    resource: 'clones',
    event: result.events.find(
      (event) =>
        event.type === 'resource' &&
        event.reason === 'profession mechanic' &&
        event.activationId === result.steps[1].activationId
    )
  });
  assert.equal(result.steps[1].start, 560);
  assert.equal(result.steps[3].start, 600);
});

test('mid-rotation concurrent Continuum Split does not restore expired cooldowns', () => {
  const result = simulateMesmer(
    [
      'Chaos Storm',
      { name: '__wait', waitMs: 14000 },
      'Phantasmal Warlock',
      { name: 'Continuum Split', offset: 100 },
      'Continuum Shift',
      'Chaos Storm'
    ],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 3,
      primaryWeapon: 'Staff',
      secondaryWeapon: ''
    })
  );

  assert.equal(result.steps.find((step) => step.skillName === 'Continuum Split').start, 14600);
  assert.equal(result.steps.at(-1).start, result.steps.at(-2).end);
});

test('Split Second shatter traits affect only the first strike from each source', () => {
  const rotation = ['Split Second', { name: '__wait', waitMs: 2000 }];
  const config = defaultSimulationConfig({
    // Isolate shatter eligibility from critical rolls and compare each floored strike separately.
    criticalDamageMode: 'averaged',
    specialization: 'Chronomancer',
    initialResource: 3,
    relic: '',
    modifiers: { strike: 1, condition: 1 }
  });
  const baseline = simulateMesmer(rotation, config);
  const timeCatchesUp = simulateMesmer(rotation, {
    ...config,
    selectedTraitIds: [TRAIT.TIME_CATCHES_UP]
  });
  const mentalAnguish = simulateMesmer(rotation, {
    ...config,
    selectedTraitIds: [TRAIT.MENTAL_ANGUISH]
  });
  const maim = simulateMesmer(rotation, {
    ...config,
    selectedTraitIds: [TRAIT.MAIM_THE_DISILLUSIONED]
  });
  const packets = (result) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Split Second');
  const baselinePackets = packets(baseline);
  const timeCatchesUpPackets = packets(timeCatchesUp);
  const mentalAnguishPackets = packets(mentalAnguish);
  const torment = maim.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Split Second' && event.condition === 'Torment'
  );

  const eligible = baselinePackets.filter((packet) => packet.metadata?.shatterTraitEligible);
  const ineligible = baselinePackets.filter((packet) => !packet.metadata?.shatterTraitEligible);
  assert.ok(eligible.length > 0);
  assert.ok(ineligible.length > 0);
  assert.ok(Math.max(...eligible.map((packet) => packet.at)) < Math.min(...ineligible.map((packet) => packet.at)));
  for (const [enhanced, multiplier] of [
    [timeCatchesUpPackets, 1.1],
    [mentalAnguishPackets, 1.25]
  ]) {
    assert.equal(enhanced.length, baselinePackets.length);
    for (const [index, packet] of baselinePackets.entries()) {
      assert.equal(enhanced[index].metadata?.shatterTraitEligible, packet.metadata?.shatterTraitEligible);

      if (packet.metadata?.shatterTraitEligible)
        assertFlooredDamageMultiplier(enhanced[index].damage, packet.damage, multiplier);
      else assert.equal(enhanced[index].damage, packet.damage);
    }
  }

  assert.equal(
    torment.reduce((sum, event) => sum + event.stacks, 0),
    4
  );
  assert.equal(torment[0].at, baselinePackets[0].at);
  assert.ok(torment.every((event) => event.stacks === 1));
  assert.equal(torment[0].metadata?.shatterTraitEligible, true);
});
