import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { displayedWeaponSkills } from '#gw2/app/rotation/palette/model.js';
import { shatterResourceSpends } from '#gw2/app/rotation/timeline/model.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import { mesmerProfession } from '#gw2/professions/mesmer/definition.js';

test('Sharper Images uses deterministic expected-proc accumulation', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    selectedTraitIds: [TRAIT.SHARPER_IMAGES],
    initialResource: 0,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Pistol',
    stats: {
      ...defaultSimulationConfig().stats,
      precision: 1105
    },
    boons: {
      ...defaultSimulationConfig().boons,
      fury: false
    }
  });
  const first = simulateMesmer(['Phantasmal Duelist', { name: '__wait', waitMs: 1000 }], config);
  const second = simulateMesmer(
    ['Phantasmal Duelist', { name: '__wait', waitMs: 16000 }, 'Phantasmal Duelist', { name: '__wait', waitMs: 1000 }],
    config
  );

  assert.equal(first.procSteps.filter((proc) => proc.skill === 'Sharper Images').length, 0);
  assert.ok(second.procSteps.some((proc) => proc.skill === 'Sharper Images' && proc.detail === '1 critical-hit proc'));
  assert.equal(
    second.resolvedEvents.find((event) => event.type === 'condition' && event.name.includes('Sharper Images'))?.source,
    'Player'
  );
});

test('Mesmer allied boons prioritize players before active clones', () => {
  const result = simulateMesmer(
    ['Mind Slash'],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Sword',
      initialResource: 3,
      selectedTraitIds: [TRAIT.MASTER_FENCER],
      allies: { count: 2, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true,
      stats: { precision: 10000 }
    })
  );
  const alliedFury = result.events.find(
    (event) => event.type === 'buff' && event.skillName === 'Master Fencer' && event.audience?.recipients === 'party'
  );

  assert.ok(alliedFury);
  assert.equal(alliedFury.resolvedAudience.alliedPlayerCount, 2);
  assert.deepEqual(alliedFury.resolvedAudience.companionIds, ['mesmer.clone:1']);
  assert.equal(alliedFury.resolvedAudience.recipientCount, 4);
});

test('Illusionary Counter arms one Counterspell without generating clones itself', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Sword'
  });
  const counter = simulateMesmer(['Illusionary Counter'], config);

  assert.equal(counter.steps[0].end, 120);
  assert.equal(counter.steps[0].interrupted, true);
  assert.ok(counter.steps[0].fullCastMs > 120);
  assert.equal(
    counter.breakdown.some((entry) => entry.name === 'Illusionary Counter'),
    false
  );
  assert.equal(counter.endState.profession.resource, 0);
  assert.equal(counter.endState.profession.counterspellAvailable, true);
  assert.equal(
    counter.resolvedEvents.some(
      (event) =>
        event.type === 'condition' && event.skillName === 'Illusionary Counter' && event.condition === 'Torment'
    ),
    false
  );

  const unavailable = simulateMesmer(['Counterspell'], config);

  assert.equal(unavailable.steps.filter((step) => !step.invalid).length, 0);
  assert.match(unavailable.warnings[0], /Illusionary Counter is not active/);

  const flipped = simulateMesmer(['Illusionary Counter', 'Counterspell', 'Counterspell'], config);

  assert.equal(flipped.steps.filter((step) => !step.invalid).length, 2);
  assert.equal(flipped.steps[1].start, 120);
  assert.equal(flipped.endState.profession.resource, 1);
  assert.equal(flipped.endState.profession.counterspellAvailable, false);
  assert.ok(flipped.breakdown.some((entry) => entry.sourceSkill === 'Counterspell'));

  const interrupted = simulateMesmer(
    ['Illusionary Counter', { name: 'Counterspell', interruptMs: 360 }, 'Swap Weapons'],
    config
  );
  const counterspell = interrupted.steps.find((step) => step.skill === 'Counterspell');

  assert.equal(counterspell.end - counterspell.start, 360);
  assert.equal(interrupted.steps.find((step) => step.skill === 'Swap Weapons').start, counterspell.end);
  assert.equal(interrupted.endState.profession.resource, 1);
  assert.ok(
    interrupted.resolvedEvents.some(
      (event) => event.type === 'condition' && event.skillName === 'Counterspell' && event.condition === 'Confusion'
    )
  );
});

test('Ether Bolt and Ether Blast do not generate clones', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Sword'
  });
  const result = simulateMesmer(['Ether Bolt', 'Ether Blast'], config);

  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Ether Bolt', 'Ether Blast']
  );
  assert.equal(result.endState.profession.resource, 0);
});

test('Ether Clone creates a clone below cap and inflicts torment at cap', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Sword'
  });
  const belowCap = simulateMesmer(['Ether Bolt', 'Ether Blast', 'Ether Clone'], { ...config, initialResource: 2 });

  assert.equal(belowCap.steps[2].end - belowCap.steps[2].start, 840);
  assert.equal(belowCap.endState.profession.resource, 3);
  const cloneGain = belowCap.events.find((event) => event.type === 'resource' && event.reason === 'Ether Clone');
  assert.ok(cloneGain);
  assert.equal(Math.round(cloneGain.at * 1000 - belowCap.steps[2].start), 442);
  assert.equal(
    belowCap.events.some(
      (event) => event.type === 'condition' && event.skillName === 'Ether Clone' && event.condition === 'Torment'
    ),
    false
  );

  const atCap = simulateMesmer(['Ether Bolt', 'Ether Blast', 'Ether Clone'], {
    ...config,
    initialResource: 3
  });

  assert.equal(atCap.endState.profession.resource, 3);
  assert.equal(
    atCap.events.some((event) => event.type === 'resource' && event.reason === 'Ether Clone'),
    false
  );
  const maximumCloneTorment = atCap.events.find(
    (event) =>
      event.type === 'condition' &&
      event.skillName === 'Ether Clone' &&
      event.condition === 'Torment' &&
      event.duration === 9
  );
  assert.ok(maximumCloneTorment);
  assert.equal(Math.round(maximumCloneTorment.at * 1000 - atCap.steps[2].start), 442);
});

test('Ether Clone grants its clone only when the 442 ms projectile packet commits', () => {
  const config = defaultSimulationConfig({
    specialization: 'Chronomancer',
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Pistol',
    initialResource: 2
  });
  const beforeHit = simulateMesmer(
    ['Ether Bolt', 'Ether Blast', { name: 'Ether Clone', interruptMs: 441 }, { name: 'Split Second', offset: 450 }],
    config
  );
  const onHit = simulateMesmer(
    ['Ether Bolt', 'Ether Blast', { name: 'Ether Clone', interruptMs: 442 }, { name: 'Split Second', offset: 450 }],
    config
  );

  assert.equal(shatterResourceSpends(beforeHit).get(3)?.count, 2);
  assert.equal(shatterResourceSpends(onHit).get(3)?.count, 3);
  assert.equal(
    beforeHit.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Ether Clone'),
    false
  );
  assert.equal(
    onHit.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Ether Clone'),
    true
  );
});

test('Ether Clone resolves its at-cap outcome from clone count at projectile time', () => {
  const config = defaultSimulationConfig({
    specialization: 'Chronomancer',
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Pistol',
    initialResource: 3
  });
  const resultAt = (offset) =>
    simulateMesmer(['Ether Bolt', 'Ether Blast', 'Ether Clone', { name: 'Split Second', offset }], config);
  const freedBeforePacket = resultAt(441);
  const freedAfterPacket = resultAt(443);
  const hasCloneGain = (result) =>
    result.events.some((event) => event.type === 'resource' && event.reason === 'Ether Clone');
  const hasMaximumTorment = (result) =>
    result.events.some(
      (event) => event.type === 'condition' && event.skillName === 'Ether Clone' && event.condition === 'Torment'
    );

  assert.equal(freedBeforePacket.endState.profession.resource, 1);
  assert.equal(hasCloneGain(freedBeforePacket), true);
  assert.equal(hasMaximumTorment(freedBeforePacket), false);
  assert.equal(freedAfterPacket.endState.profession.resource, 0);
  assert.equal(hasCloneGain(freedAfterPacket), false);
  assert.equal(hasMaximumTorment(freedAfterPacket), true);
});

test('autoattack chain steps unlock only after the preceding attack', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Sword'
  });
  const locked = simulateMesmer(['Ether Blast', 'Ether Clone'], config);

  assert.equal(locked.steps.filter((step) => !step.invalid).length, 0);
  assert.match(locked.warnings[0], /cast Ether Bolt first/);

  const skippedStep = simulateMesmer(['Ether Bolt', 'Ether Clone'], config);

  assert.deepEqual(
    skippedStep.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Ether Bolt']
  );
  assert.equal(skippedStep.endState.profession.autoattackChains[ID.ETHER_BOLT], ID.ETHER_BLAST);
  assert.match(skippedStep.warnings[0], /cast Ether Blast first/);

  const completed = simulateMesmer(['Ether Bolt', 'Ether Blast', 'Ether Clone'], config);

  assert.equal(completed.endState.profession.autoattackChains[ID.ETHER_BOLT], ID.ETHER_BOLT);
});

test('Scepter weapon skills preserve Ether Bolt chain progress', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Sword'
  });
  const result = simulateMesmer(['Ether Bolt', 'Confusing Images', 'Ether Blast'], config);

  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Ether Bolt', 'Confusing Images', 'Ether Blast']
  );
  assert.equal(result.endState.profession.autoattackChains[ID.ETHER_BOLT], ID.ETHER_CLONE);
});

test('Imaginary Axes preserves the axe auto chain but other skills reset it', () => {
  const config = defaultSimulationConfig({
    specialization: 'Mirage',
    initialResource: 0,
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Pistol'
  });
  const preserved = simulateMesmer(
    ['Lacerating Chop', 'Dodge / Mirage Cloak', 'Imaginary Axes', 'Ethereal Chop'],
    config
  );

  assert.deepEqual(
    preserved.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Lacerating Chop', 'Dodge / Mirage Cloak', 'Imaginary Axes', 'Ethereal Chop']
  );
  assert.equal(preserved.endState.profession.autoattackChains[ID.LACERATING_CHOP], ID.MIRROR_STRIKES);

  const interrupted = simulateMesmer(['Lacerating Chop', 'Lingering Thoughts', 'Ethereal Chop'], config);

  assert.deepEqual(
    interrupted.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Lacerating Chop', 'Lingering Thoughts']
  );
  assert.equal(interrupted.endState.profession.autoattackChains[ID.LACERATING_CHOP], ID.LACERATING_CHOP);
  assert.match(interrupted.warnings[0], /cast Lacerating Chop first/);
});

test('other auto chains reset on weapon skills and every chain resets on swap', () => {
  const swordConfig = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword'
  });
  const interrupted = simulateMesmer(['Mind Slash', 'Blurred Frenzy', 'Mind Gash'], swordConfig);

  assert.deepEqual(
    interrupted.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Mind Slash', 'Blurred Frenzy']
  );
  assert.equal(interrupted.endState.profession.autoattackChains[ID.MIND_SLASH], ID.MIND_SLASH);

  const scepterConfig = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Sword',
    weaponSet2Primary: 'Spear',
    weaponSet2Secondary: ''
  });
  const swapped = simulateMesmer(['Ether Bolt', 'Swap Weapons', 'Ether Blast'], scepterConfig);

  assert.deepEqual(
    swapped.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Ether Bolt', 'Swap Weapons']
  );
  assert.equal(swapped.endState.profession.autoattackChains[ID.ETHER_BOLT], ID.ETHER_BOLT);
});

test('short utility casts preserve spear autoattack-chain progress', () => {
  const result = simulateMesmer(
    ['Psycut', 'Well of Eternity', 'Psystrike'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 0,
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      selectedSkills: ['Well of Eternity']
    })
  );

  assert.deepEqual(
    result.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Psycut', 'Well of Eternity', 'Psystrike']
  );
});

test('an interrupted Troubadour instrument still resets the spear autoattack chain', () => {
  const result = simulateMesmer(
    ['Psycut', { type: 'cast', skillId: ID.HARMONIOUS_HARP_ALTERNATE, interruptAfterMs: 480 }, 'Psycut'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      initialResource: 3,
      primaryWeapon: 'Spear',
      secondaryWeapon: ''
    })
  );

  assert.deepEqual(
    result.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Psycut', 'Harmonious Harp', 'Psycut']
  );
});

test('an interrupted spear autoattack leaves the same chain step active', () => {
  const result = simulateMesmer(
    ['Psycut', { type: 'cast', skillId: ID.PSYSTRIKE, interruptAfterMs: 132 }, 'Psystrike'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 0,
      primaryWeapon: 'Spear',
      secondaryWeapon: ''
    })
  );

  assert.deepEqual(
    result.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Psycut', 'Psystrike', 'Psystrike']
  );
  assert.equal(result.steps[1].interrupted, true);
});

test('a long utility cast resets ordinary spear autoattack-chain progress', () => {
  const result = simulateMesmer(
    ['Psycut', 'Well of Calamity', 'Psycut'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 0,
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      selectedSkills: ['Well of Calamity']
    })
  );

  assert.deepEqual(
    result.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Psycut', 'Well of Calamity', 'Psycut']
  );
});

test('sword, scepter, axe, and spear auto chains cast as separate attacks', () => {
  const chain = [
    'Mind Slash',
    'Mind Gash',
    'Mind Spike',
    'Ether Bolt',
    'Ether Blast',
    'Ether Clone',
    'Lacerating Chop',
    'Ethereal Chop',
    'Mirror Strikes',
    'Psycut',
    'Psystrike',
    'Mind Pierce'
  ];
  const result = simulateMesmer(
    chain,
    defaultSimulationConfig({
      specialization: 'Mirage',
      initialResource: 0,
      weaponmasterTraining: true,
      primaryWeapon: '',
      secondaryWeapon: '',
      weaponSet2Primary: '',
      weaponSet2Secondary: ''
    })
  );

  assert.deepEqual(
    result.steps.map((step) => step.skill),
    chain
  );
  assert.equal(result.casts.length, chain.length);
});

test('split autoattacks preserve each full-chain cadence', () => {
  const config = defaultSimulationConfig({
    specialization: 'Mirage',
    initialResource: 0,
    weaponmasterTraining: true,
    primaryWeapon: '',
    secondaryWeapon: '',
    weaponSet2Primary: '',
    weaponSet2Secondary: '',
    boons: {
      ...defaultSimulationConfig().boons,
      quickness: false
    }
  });
  const chains = [
    [['Mind Slash', 'Mind Gash', 'Mind Spike'], 2580],
    [['Ether Bolt', 'Ether Blast', 'Ether Clone'], 2700],
    [['Lacerating Chop', 'Ethereal Chop', 'Mirror Strikes'], 2520],
    [['Psycut', 'Psystrike', 'Mind Pierce'], 2220]
  ];

  for (const [skills, expectedTime] of chains) {
    assert.equal(simulateMesmer(skills, config).endState.time, expectedTime);
  }
});

test('requested weapon flips require and consume their parent sequence skill', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: '',
    secondaryWeapon: '',
    weaponSet2Primary: '',
    weaponSet2Secondary: ''
  });
  const pairs = [
    ['Singularity Shot', 'Dimensional Aperture'],
    ['Inspiring Imagery', 'Abstraction'],
    ['Temporal Curtain', 'Into the Void'],
    ['Illusionary Riposte', 'Counter Blade'],
    ['Illusionary Leap', 'Swap']
  ];

  for (const [parent, flip] of pairs) {
    const unavailable = simulateMesmer([flip], config);

    assert.equal(unavailable.steps.filter((step) => !step.invalid).length, 0, flip);
    assert.match(unavailable.warnings[0], new RegExp(parent), flip);

    const result = simulateMesmer([parent, flip, flip], config);

    assert.deepEqual(
      result.steps.filter((step) => !step.invalid).map((step) => step.skill),
      [parent, flip],
      flip
    );
    assert.equal(result.endState.profession.availableFlips[flip], undefined, flip);
  }
});

test('Illusionary Riposte defaults to a 120ms interrupt before Counter Blade', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword'
  });
  const result = simulateMesmer(['Illusionary Riposte', 'Counter Blade'], config);

  assert.equal(result.steps[0].end, 120);
  assert.equal(result.steps[0].interrupted, true);
  assert.ok(result.steps[0].fullCastMs > 120);
  assert.equal(result.steps[1].start, 120);
});

test('Into the Void waits for its one-second post-curtain delay', () => {
  const result = simulateMesmer(
    ['Temporal Curtain', 'Into the Void'],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: '',
      secondaryWeapon: ''
    })
  );

  assert.equal(result.steps[1].start, 1000);
});

test('Dimensional Aperture adds 50% to Singularity Shot recharge', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    primaryWeapon: '',
    secondaryWeapon: ''
  });
  const base = simulateMesmer(['Singularity Shot'], config);
  const aperture = simulateMesmer(['Singularity Shot', 'Dimensional Aperture'], config);

  assert.equal(base.endState.cooldowns['Singularity Shot'].readyAt, 16333);
  assert.equal(aperture.endState.cooldowns['Singularity Shot'].readyAt, 24333);
});

test('Abstraction records its detonation strike damage', () => {
  const result = simulateMesmer(
    ['Inspiring Imagery', 'Abstraction'],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: '',
      secondaryWeapon: ''
    })
  );

  assert.ok(result.breakdown.some((entry) => entry.sourceSkill === 'Abstraction' && entry.strikeDamage > 0));
});

test('Shatter Storm gives Split Second two ammo charges', () => {
  const result = simulateMesmer(
    ['Split Second', 'Split Second', 'Split Second'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedTraitIds: [TRAIT.SHATTER_STORM],
      initialResource: 3
    })
  );

  assert.equal(result.steps[0].start, 0);
  assert.equal(result.steps[1].start, 50);
  assert.equal(result.steps[2].start, 8000);
  assert.deepEqual(
    {
      charges: result.endState.ammo['Split Second'].charges,
      maximum: result.endState.ammo['Split Second'].maximum
    },
    { charges: 0, maximum: 2 }
  );
});

test('Shatter Storm initializes Split Second ammo before first cast', () => {
  const result = simulateMesmer(
    [],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedTraitIds: [TRAIT.SHATTER_STORM],
      initialResource: 0
    })
  );

  assert.deepEqual(
    {
      charges: result.endState.ammo['Split Second'].charges,
      maximum: result.endState.ammo['Split Second'].maximum
    },
    { charges: 2, maximum: 2 }
  );
});

test('Power Spike opens with two charges and reverts to Mantra of Pain when spent', () => {
  const result = simulateMesmer(
    ['Power Spike', 'Power Spike', 'Power Spike'],
    defaultSimulationConfig({ specialization: 'Core' })
  );

  // The third cast has no charges left, so the flip reverts to its parent.
  assert.deepEqual(
    result.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Power Spike', 'Power Spike']
  );
  assert.equal(result.steps[0].start, 0);
  assert.equal(result.steps[1].start, 0);
  assert.equal(result.endState.profession.availableFlips['Power Spike'], undefined);
  assert.equal(result.endState.ammo['Power Spike'], undefined);
  assert.match(result.warnings.at(-1), /Mantra of Pain is not active/);
});

test('dodge uses two endurance charges and recharges one charge every ten seconds', () => {
  const result = simulateMesmer(
    ['Dodge / Mirage Cloak', 'Dodge / Mirage Cloak', 'Dodge / Mirage Cloak'],
    defaultSimulationConfig({
      specialization: 'Mirage',
      initialResource: 0,
      boons: {
        ...defaultSimulationConfig().boons,
        vigor: false
      }
    })
  );

  assert.deepEqual(
    result.steps.map((step) => step.start),
    [0, 0, 10000]
  );
  assert.deepEqual(
    {
      charges: result.endState.ammo['Dodge / Mirage Cloak'].charges,
      maximum: result.endState.ammo['Dodge / Mirage Cloak'].maximum
    },
    { charges: 0, maximum: 2 }
  );
});

test('Mirage Cloak enables an explicit ambush instead of auto-casting it', () => {
  const config = defaultSimulationConfig({
    specialization: 'Mirage',
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Pistol',
    initialResource: 0
  });
  const cloakOnly = simulateMesmer(['Dodge / Mirage Cloak'], config);

  assert.equal(
    cloakOnly.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Imaginary Axes'),
    false
  );
  assert.equal(cloakOnly.endState.profession.availableAmbush.name, 'Imaginary Axes');
  assert.equal(cloakOnly.endState.profession.availableAmbush.source, 'Dodge / Mirage Cloak');
  const axeSkillOne = mesmerCatalog.skills.filter(
    (skill) => skill.type === 'Weapon' && skill.weapon === 'Axe' && skill.slot === 'Weapon_1'
  );
  const paletteApp = {
    build: { rotation: [], weapons: ['Axe', 'Pistol'], alternateWeapons: ['', ''], startingWeaponSet: 1 },
    skills: mesmerCatalog.skills,
    skillById: mesmerCatalog.skillsById,
    profession: mesmerProfession,
    results: cloakOnly
  };

  assert.deepEqual(
    displayedWeaponSkills(paletteApp, axeSkillOne).map((skill) => skill.name),
    ['Imaginary Axes']
  );

  const used = simulateMesmer(['Dodge / Mirage Cloak', 'Imaginary Axes'], config);

  assert.deepEqual(
    used.steps.map((step) => step.skill),
    ['Dodge / Mirage Cloak', 'Imaginary Axes']
  );
  assert.ok(
    used.resolvedEvents.some(
      (event) => event.type === 'damage' && event.skillName === 'Imaginary Axes' && event.source === 'Player'
    )
  );
  assert.equal(used.endState.profession.availableAmbush, null);
  paletteApp.results = used;
  assert.deepEqual(
    displayedWeaponSkills(paletteApp, axeSkillOne).map((skill) => skill.name),
    ['Lacerating Chop']
  );
});

test('ambush skills cannot be cast without an active ambush window', () => {
  const result = simulateMesmer(
    ['Phantom Razor'],
    defaultSimulationConfig({
      specialization: 'Mirage',
      primaryWeapon: 'Dagger',
      secondaryWeapon: 'Sword',
      initialResource: 0
    })
  );

  assert.equal(result.steps.filter((step) => !step.invalid).length, 0);
  assert.match(result.warnings[0], /no active Mirage Cloak ambush window/);
});

test('all terrestrial Mirage weapons execute their correct ambush', () => {
  const pairs = [
    ['Axe', 'Imaginary Axes'],
    ['Dagger', 'Phantom Razor'],
    ['Greatsword', 'Split Surge'],
    ['Rifle', 'Effervescence'],
    ['Scepter', 'Ether Barrage'],
    ['Spear', 'Fractured Glass'],
    ['Staff', 'Chaos Vortex'],
    ['Sword', 'Mirage Thrust']
  ];

  for (const [weapon, ambush] of pairs) {
    const result = simulateMesmer(
      ['Dodge / Mirage Cloak', ambush],
      defaultSimulationConfig({
        specialization: 'Mirage',
        primaryWeapon: weapon,
        secondaryWeapon: '',
        initialResource: 0
      })
    );

    assert.deepEqual(
      result.steps.map((step) => step.skill),
      ['Dodge / Mirage Cloak', ambush],
      weapon
    );
    assert.ok(
      result.resolvedEvents.some(
        (event) => event.type === 'damage' && event.skillName === ambush && event.source === 'Player'
      ),
      weapon
    );
  }
});

test('a weapon swap after Fractured Glass packets keeps the spear ambush', () => {
  const result = simulateMesmer(
    [
      'Dodge / Mirage Cloak',
      { name: '__wait', waitMs: 200 },
      'Fractured Glass',
      { name: '__wait', waitMs: 171 },
      'Swap Weapons'
    ],
    defaultSimulationConfig({
      specialization: 'Mirage',
      initialResource: 0,
      primaryWeapon: 'Greatsword',
      secondaryWeapon: '',
      weaponSet2Primary: 'Spear',
      weaponSet2Secondary: '',
      startingWeaponSet: 2
    })
  );

  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Fractured Glass').length,
    7
  );
});

test('Split Surge resolves its three beam packets with per-hit Might and Vulnerability', () => {
  const result = simulateMesmer(
    ['Dodge / Mirage Cloak', 'Split Surge', { name: 'Signet of Midnight', offset: 700 }],
    defaultSimulationConfig({
      specialization: 'Mirage',
      primaryWeapon: 'Greatsword',
      secondaryWeapon: '',
      selectedSkills: ['Signet of Midnight'],
      initialResource: 0
    })
  );
  const cast = result.steps.find((step) => step.skill === 'Split Surge');
  const packet = (event) => Math.round((event.at - cast.start / 1000) * 1000);
  const damage = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Split Surge' && event.source === 'Player'
  );
  const might = result.events.filter(
    (event) => event.type === 'buff' && event.sourceSkill === 'Split Surge' && event.kind === 'might'
  );
  const vulnerability = result.events.filter(
    (event) => event.type === 'condition' && event.skillName === 'Split Surge' && event.condition === 'Vulnerability'
  );

  assert.equal(cast.end - cast.start, 960);
  assert.deepEqual(
    damage.map((event) => [packet(event), event.coefficient]),
    [
      [360, 1.0625],
      [520, 1.0625],
      [680, 1.0625]
    ]
  );
  assert.deepEqual(
    might.map((event) => [packet(event), event.stacks, event.duration]),
    [
      [360, 2, 5],
      [520, 2, 5],
      [680, 2, 5]
    ]
  );
  assert.deepEqual(
    vulnerability.map((event) => [packet(event), event.stacks, event.duration]),
    [
      [360, 2, 5],
      [520, 2, 5],
      [680, 2, 5]
    ]
  );
  assert.ok(
    vulnerability.every(
      (event) =>
        event.name === 'Split Surge — Vulnerability' &&
        event.sourceId === ID.SPLIT_SURGE &&
        event.skillId === ID.SPLIT_SURGE &&
        event.applicationIndex === 1 &&
        event.totalApplications === 1
    )
  );
  const overlappingAction = result.events.find(
    (event) => event.type === 'action' && event.skillName === 'Signet of Midnight'
  );

  assert.ok(vulnerability.at(-1).at < overlappingAction.at);
  assert.ok(vulnerability.at(-1).eventOrder < overlappingAction.eventOrder);
});

test('Fractured Glass resolves seven measured packets with per-hit Vulnerability', () => {
  const result = simulateMesmer(
    ['Dodge / Mirage Cloak', 'Fractured Glass', 'Sand through Glass', 'Fractured Glass'],
    defaultSimulationConfig({
      specialization: 'Mirage',
      selectedSkills: ['Sand through Glass'],
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      initialResource: 0,
      boons: {
        ...defaultSimulationConfig().boons,
        alacrity: false
      }
    })
  );
  const casts = result.steps.filter((step) => step.skill === 'Fractured Glass');
  const firstCastStart = casts[0].start / 1000;
  const damage = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Fractured Glass' && event.source === 'Player'
  );
  const vulnerability = result.events.filter(
    (event) =>
      event.type === 'condition' && event.skillName === 'Fractured Glass' && event.condition === 'Vulnerability'
  );

  assert.equal(casts[0].end - casts[0].start, 880);
  assert.equal(casts[1].start - casts[0].end, 1000);
  assert.deepEqual(
    damage.slice(0, 7).map((event) => [Math.round((event.at - firstCastStart) * 1000), event.coefficient]),
    [
      [400, 0.45],
      [480, 0.45],
      [520, 0.45],
      [560, 0.45],
      [640, 0.45],
      [720, 0.45],
      [760, 0.45]
    ]
  );
  assert.deepEqual(
    vulnerability
      .slice(0, 7)
      .map((event) => [Math.round((event.at - firstCastStart) * 1000), event.stacks, event.duration]),
    [
      [400, 1, 6],
      [480, 1, 6],
      [520, 1, 6],
      [560, 1, 6],
      [640, 1, 6],
      [720, 1, 6],
      [760, 1, 6]
    ]
  );
});

test('Mirage self-Might triggers Relic of Mistburn', () => {
  const result = simulateMesmer(
    ['Dodge / Mirage Cloak', 'Split Surge'],
    defaultSimulationConfig({
      specialization: 'Mirage',
      primaryWeapon: 'Greatsword',
      secondaryWeapon: '',
      initialResource: 0,
      relic: 'Mistburn',
      boons: {
        ...defaultSimulationConfig().boons,
        might: 0
      }
    })
  );
  const bonusMight = result.events.filter((event) => event.sourceId === 'relic.mistburn');

  assert.deepEqual(
    bonusMight.map((event) => ({
      duration: event.duration,
      stacks: event.stacks,
      triggeredBy: event.triggeredBy
    })),
    [{ duration: 8, stacks: 1, triggeredBy: 'Split Surge' }]
  );
});

test('Riddle of Sand applies to the first ambush and refreshes on shatter', () => {
  const result = simulateMesmer(
    ['Dodge / Mirage Cloak', 'Imaginary Axes', 'Mind Wrack', 'Sand through Glass', 'Imaginary Axes'],
    defaultSimulationConfig({
      specialization: 'Mirage',
      selectedTraitIds: [TRAIT.RIDDLE_OF_SAND],
      selectedSkills: ['Sand through Glass'],
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Pistol',
      initialResource: 0
    })
  );
  const riddles = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.name.includes('Riddle of Sand')
  );

  assert.equal(riddles.length, 2);
  assert.ok(riddles.every((event) => event.condition === 'Confusion' && event.stacks === 2 && event.duration === 4));
});

test('Infinite Horizon commands active clones to ambush when cloak is gained', () => {
  const result = simulateMesmer(
    ['Dodge / Mirage Cloak'],
    defaultSimulationConfig({
      specialization: 'Mirage',
      selectedTraitIds: [TRAIT.INFINITE_HORIZON],
      primaryWeapon: 'Staff',
      secondaryWeapon: '',
      initialResource: 3
    })
  );
  const cloneHits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Chaos Vortex' && event.source === 'Clone'
  );

  assert.equal(cloneHits.length, 3);
  assert.equal(
    result.resolvedEvents.some(
      (event) => event.type === 'damage' && event.skillName === 'Chaos Vortex' && event.source === 'Player'
    ),
    false
  );
});

test('Chaos Vortex selects clone boon recipients when its boon packet lands', () => {
  const result = simulateMesmer(
    ['Dodge / Mirage Cloak', 'Chaos Vortex', { name: 'Phase Retreat', offset: 120 }],
    defaultSimulationConfig({
      specialization: 'Mirage',
      primaryWeapon: 'Staff',
      secondaryWeapon: '',
      initialResource: 0,
      sharePlayerBoonsWithSummons: true
    })
  );
  const boons = result.events.filter((event) => event.type === 'buff' && event.skillName === 'Chaos Vortex');

  assert.equal(boons.length, 2);
  assert.ok(boons.every((event) => event.at === 0.72));
  assert.ok(boons.every((event) => event.resolvedAudience.companionIds.includes('mesmer.clone:1')));
});

test('Deceptive Evasion clone immediately ambushes with Infinite Horizon', () => {
  const result = simulateMesmer(
    ['Dodge / Mirage Cloak'],
    defaultSimulationConfig({
      specialization: 'Mirage',
      selectedTraitIds: [TRAIT.DECEPTIVE_EVASION, TRAIT.INFINITE_HORIZON],
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Sword',
      initialResource: 0
    })
  );

  assert.equal(result.endState.profession.resource, 1);
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.type === 'damage' && event.skillName === 'Mirage Thrust' && event.source === 'Clone'
    )
  );
});

test('Self-Deception creates a clone only when another clone is active', () => {
  const config = defaultSimulationConfig({
    specialization: 'Mirage',
    selectedTraitIds: [TRAIT.SELF_DECEPTION],
    selectedSkills: ['Crystal Sands'],
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Pistol'
  });
  const activeClone = simulateMesmer(['Crystal Sands'], {
    ...config,
    initialResource: 1
  });
  const noClone = simulateMesmer(['Crystal Sands'], {
    ...config,
    initialResource: 0
  });

  assert.equal(activeClone.endState.profession.resource, 2);
  assert.equal(noClone.endState.profession.resource, 0);
});

test('Desert Distortion and Dune Cloak grant their shatter ambush windows', () => {
  const distortion = simulateMesmer(
    ['Distortion'],
    defaultSimulationConfig({
      specialization: 'Mirage',
      selectedTraitIds: [TRAIT.DESERT_DISTORTION],
      initialResource: 2
    })
  );

  assert.equal(distortion.endState.profession.availableAmbush.source, 'Desert Distortion');
  assert.equal(distortion.endState.profession.availableMirrors, 2);
  assert.ok(distortion.procSteps.some((proc) => proc.skill === 'Desert Distortion'));

  const dune = simulateMesmer(
    ['Mind Wrack'],
    defaultSimulationConfig({
      specialization: 'Mirage',
      selectedTraitIds: [TRAIT.DUNE_CLOAK],
      initialResource: 3,
      boons: {
        ...defaultSimulationConfig().boons,
        alacrity: false
      }
    })
  );

  assert.equal(dune.endState.profession.availableAmbush.source, 'Dune Cloak');
  assert.equal(dune.endState.cooldowns['Mind Wrack'].readyAt, 11000);

  const twoClones = simulateMesmer(
    ['Mind Wrack'],
    defaultSimulationConfig({
      specialization: 'Mirage',
      selectedTraitIds: [TRAIT.DUNE_CLOAK],
      initialResource: 2
    })
  );

  assert.equal(twoClones.endState.profession.availableAmbush, null);
});

test('Infinite Horizon axe clones each apply one 4-second Torment', () => {
  const result = simulateMesmer(
    ['Dodge / Mirage Cloak', { name: '__wait', waitMs: 1200 }],
    defaultSimulationConfig({
      specialization: 'Mirage',
      selectedTraitIds: [TRAIT.INFINITE_HORIZON],
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Torch',
      initialResource: 3
    })
  );
  const torment = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName.startsWith('Imaginary Axes') && event.source === 'Clone'
  );

  assert.equal(torment.length, 3);
  assert.ok(torment.every((event) => event.stacks === 1 && event.duration === 4));
});

test('Mesmer Peitha triggers share cast-start ICD logic with measured travel delays', () => {
  const cases = [
    ['Phase Retreat', ID.PHASE_RETREAT, 'Staff', 856],
    ['Crystal Sands', ID.CRYSTAL_SANDS, 'Axe', 241],
    ['Jaunt', ID.JAUNT, 'Axe', 241],
    ['Axes of Symmetry', ID.AXES_OF_SYMMETRY, 'Axe', 519],
    ['Mental Collapse', ID.MENTAL_COLLAPSE, 'Spear', 800]
  ];

  for (const [skillName, skillId, primaryWeapon, delayMs] of cases) {
    const result = simulateMesmer(
      [{ name: skillName, skillId }],
      defaultSimulationConfig({
        specialization: 'Mirage',
        selectedSkills: ['Crystal Sands', 'Jaunt'],
        primaryWeapon,
        secondaryWeapon: primaryWeapon === 'Axe' ? 'Torch' : '',
        initialResource: 0,
        relic: 'Peitha'
      })
    );
    const cast = result.steps.find((step) => step.skill === skillName);
    const peitha = result.events.find((event) => event.type === 'peitha' && event.skillName === skillName);
    const torment = result.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillName === 'Relic of Peitha' && event.condition === 'Torment'
    );

    assert.ok(peitha, `${skillName} trigger event`);
    assert.ok(torment, `${skillName} Peitha Torment`);
    assert.equal(peitha.at * 1000, cast.start, `${skillName} trigger`);
    assert.equal(peitha.projectileDelay * 1000, delayMs, skillName);
    assert.ok(Math.abs(torment.at * 1000 - cast.start - delayMs) < 1e-9, `${skillName} impact`);
  }
});

test('Axes and Crystal Sands share Peitha trigger-time cooldown state', () => {
  const result = simulateMesmer(
    [
      { name: 'Axes of Symmetry', skillId: ID.AXES_OF_SYMMETRY },
      { name: '__wait', waitMs: 3001 },
      { name: 'Crystal Sands', skillId: ID.CRYSTAL_SANDS }
    ],
    defaultSimulationConfig({
      specialization: 'Mirage',
      selectedSkills: ['Crystal Sands'],
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Torch',
      initialResource: 0,
      relic: 'Peitha'
    })
  );

  assert.deepEqual(
    result.procSteps.filter((step) => step.skill === 'Relic of Peitha').map((step) => step.sourceSkill),
    ['Axes of Symmetry', 'Crystal Sands']
  );
});

test('The Prestige has a 40ms quickness activation and explodes 3s later', () => {
  const result = simulateMesmer(
    ['The Prestige', { name: '__wait', waitMs: 3100 }],
    defaultSimulationConfig({
      specialization: 'Mirage',
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Torch',
      initialResource: 0
    })
  );
  const cast = result.steps.find((step) => step.skill === 'The Prestige');
  const strike = result.events.find((event) => event.type === 'damage' && event.skillName === 'The Prestige');
  const burning = result.events.find(
    (event) => event.type === 'condition' && event.skillName === 'The Prestige' && event.condition === 'Burning'
  );

  assert.equal(cast.end - cast.start, 40);
  assert.equal(strike.at * 1000 - cast.start, 3000);
  assert.equal(burning.at, strike.at);
});

test('Mirage support and cloak traits emit their current effects', () => {
  const result = simulateMesmer(
    ['Dodge / Mirage Cloak', 'Effervescence'],
    defaultSimulationConfig({
      specialization: 'Mirage',
      selectedTraitIds: [TRAIT.MIRAGE_MANTLE, TRAIT.RENEWING_OASIS, TRAIT.ELUSIVE_MIND],
      primaryWeapon: 'Rifle',
      secondaryWeapon: '',
      initialResource: 0,
      allies: { count: 4, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true
    })
  );

  assert.ok(
    result.events.some((event) => event.type === 'buff' && event.kind === 'regeneration' && event.duration === 4)
  );
  assert.ok(result.events.some((event) => event.type === 'buff' && event.kind === 'alacrity' && event.duration === 4));
  assert.ok(!result.events.some((event) => event.type === 'buff' && event.kind === 'vigor' && event.duration === 3));
  const alacrity = result.events.find((event) => event.type === 'buff' && event.kind === 'alacrity');

  assert.equal(alacrity.audience.recipients, 'party');
  assert.equal(alacrity.resolvedAudience.recipientCount, 5);
  assert.equal(alacrity.resolvedAudience.includesSummons, false);
  assert.ok(result.procSteps.some((proc) => proc.skill === 'Elusive Mind'));
});

test("Nomad's Endurance and Phantom Pain add together while excluding phantasm strikes", () => {
  const run = (selectedTraitIds) =>
    simulateMesmer(
      ['Mind Wrack', 'Phantasmal Mage', { name: '__wait', waitMs: 4000 }],
      defaultSimulationConfig({
        specialization: 'Mirage',
        selectedTraitIds,
        initialResource: 3,
        primaryWeapon: 'Axe',
        secondaryWeapon: 'Torch',
        relic: '',
        modifiers: { strike: 1, condition: 1 },
        boons: { vigor: true }
      })
    );
  const baseline = run([]);
  const modified = run([TRAIT.NOMADS_ENDURANCE, TRAIT.PHANTOM_PAIN]);
  const damage = (result, source) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillName === 'Phantasmal Mage' && event.source === source)
      .reduce((sum, event) => sum + event.damage, 0);

  assert.ok(Math.abs(damage(modified, 'Player') / damage(baseline, 'Player') - 1.35) < 1e-12);
  assert.equal(damage(modified, 'Phantasm'), damage(baseline, 'Phantasm'));

  const conditionDamage = (result) =>
    result.breakdown
      .filter(
        (entry) => entry.sourceSkill === 'Phantasmal Mage' && entry.source === 'Phantasm' && entry.conditionDamage > 0
      )
      .reduce((sum, entry) => sum + entry.conditionDamage, 0);
  assert.ok(Math.abs(conditionDamage(modified) / conditionDamage(baseline) - 1.25) < 1e-12);
});

test('Crystal Sands creates a collectible Mirage Mirror with delayed damage', () => {
  const result = simulateMesmer(
    ['Crystal Sands', 'Pick Up Mirage Mirror'],
    defaultSimulationConfig({
      specialization: 'Mirage',
      selectedSkills: ['Crystal Sands'],
      selectedTraitIds: [TRAIT.DUNE_CLOAK],
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Torch',
      initialResource: 0,
      relic: 'Peitha'
    })
  );
  const crystal = result.events.find((event) => event.type === 'damage' && event.skillName === 'Crystal Sands');
  const mirror = result.events.find((event) => event.type === 'damage' && event.skillName === 'Mirage Mirror');
  const confusion = result.resolvedEvents.find(
    (event) => event.type === 'condition' && event.skillName === 'Crystal Sands' && event.condition === 'Confusion'
  );

  assert.deepEqual(result.warnings, []);
  assert.ok(Math.abs(crystal.at - 0.691) < 0.00001);
  assert.ok(Math.abs(mirror.at - 0.691) < 0.00001);
  assert.equal(confusion.at, crystal.at);
  assert.equal(confusion.stacks, 6);
  assert.equal(confusion.duration, 4);
  assert.equal(mirror.coefficient, 0.6);
  assert.equal(result.endState.profession.availableMirrors, 0);
  assert.equal(result.endState.profession.availableAmbush.source, 'Pick Up Mirage Mirror');
  assert.deepEqual(
    result.events.filter((event) => event.type === 'peitha').map((event) => event.skillName),
    ['Crystal Sands']
  );
});

test('False Oasis creates its Mirage Mirror three seconds after cast completion', () => {
  const result = simulateMesmer(
    ['False Oasis', 'Pick Up Mirage Mirror'],
    defaultSimulationConfig({
      specialization: 'Mirage',
      selectedSkills: ['False Oasis'],
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Torch',
      initialResource: 0
    })
  );
  const falseOasis = result.steps.find((step) => step.skill === 'False Oasis');
  const mirror = result.events.find((event) => event.type === 'damage' && event.skillName === 'Mirage Mirror');

  assert.deepEqual(result.warnings, []);
  assert.ok(falseOasis);
  assert.ok(mirror);
  assert.ok(Math.abs(mirror.at - (falseOasis.end / 1000 + 3)) < 0.00001);
  assert.equal(result.endState.profession.availableMirrors, 0);
});

test('Mirage Mirror palette availability follows active ground mirrors', () => {
  const mirror = mesmerCatalog.skillsById.get(ID.PICK_UP_MIRAGE_MIRROR);
  const unavailable = mesmerProfession.ui.paletteSkillAvailability(
    {
      specialization: 'Mirage',
      professionState: { availableMirrors: 0 },
      build: { weaponmasterTraining: true }
    },
    mirror
  );
  const available = mesmerProfession.ui.paletteSkillAvailability(
    {
      specialization: 'Mirage',
      professionState: { availableMirrors: 1 },
      build: { weaponmasterTraining: true }
    },
    mirror
  );

  assert.deepEqual(unavailable, {
    available: false,
    message: 'No Mirage Mirror is active on the ground.'
  });
  assert.deepEqual(available, { available: true, message: '' });
});

test('Sigil of Energy restores one Mirage dodge charge on weapon swap', () => {
  const result = simulateMesmer(
    ['__combat_start', 'Dodge / Mirage Cloak', 'Dodge / Mirage Cloak', 'Swap Weapons', 'Dodge / Mirage Cloak'],
    defaultSimulationConfig({
      specialization: 'Mirage',
      primaryWeapon: 'Staff',
      secondaryWeapon: '',
      weaponSet2Primary: 'Axe',
      weaponSet2Secondary: 'Torch',
      sigilSets: [{ names: ['Energy'] }, { names: ['Energy'] }],
      initialResource: 0
    })
  );
  const dodges = result.steps.filter((step) => step.skill === 'Dodge / Mirage Cloak' && !step.invalid);
  const energy = result.events.find((event) => event.type === 'proc' && event.sourceId === 'sigil.energy');

  assert.deepEqual(result.warnings, []);
  assert.equal(dodges.length, 3);
  assert.ok(energy);
  assert.equal(dodges[2].start, energy.at * 1000);
});

test("Nomad's Endurance grants vigor on shatter and uses it for damage", () => {
  const baseConfig = defaultSimulationConfig({
    specialization: 'Mirage',
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword',
    initialResource: 0,
    boons: {
      ...defaultSimulationConfig().boons,
      vigor: false
    }
  });
  const without = simulateMesmer(['Mind Wrack', 'Mind Slash'], baseConfig);
  const withTrait = simulateMesmer(['Mind Wrack', 'Mind Slash'], {
    ...baseConfig,
    selectedTraitIds: [TRAIT.NOMADS_ENDURANCE]
  });

  assert.ok(withTrait.strikeDamage > without.strikeDamage);
  assert.ok(withTrait.events.some((event) => event.type === 'buff' && event.kind === 'vigor' && event.duration === 3));
});

test('Re-channeling Mantra of Pain refills Power Spike to two charges', () => {
  const result = simulateMesmer(
    ['Power Spike', 'Power Spike', 'Mantra of Pain', 'Power Spike'],
    defaultSimulationConfig({ specialization: 'Core' })
  );

  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Power Spike', 'Power Spike', 'Mantra of Pain', 'Power Spike']
  );
  assert.ok(result.endState.profession.availableFlips['Power Spike']);
  assert.equal(result.endState.profession.availableFlips['Power Spike'].persistent, true);
  assert.deepEqual(
    {
      charges: result.endState.ammo['Power Spike'].charges,
      maximum: result.endState.ammo['Power Spike'].maximum
    },
    { charges: 1, maximum: 2 }
  );
});

test('Power Spike records its strike damage', () => {
  const result = simulateMesmer(['Power Spike'], defaultSimulationConfig({ specialization: 'Core' }));

  assert.ok(result.breakdown.some((entry) => entry.sourceSkill === 'Power Spike' && entry.strikeDamage > 0));
});

test('Power Spike woven into the Mantra of Pain channel is invalid and unsimulated', () => {
  const result = simulateMesmer(
    ['Power Spike', 'Power Spike', 'Mantra of Pain', { name: 'Power Spike', offset: 100 }],
    defaultSimulationConfig({ specialization: 'Core' })
  );
  const woven = result.steps.find((step) => step.ri === 3);

  assert.equal(woven.invalid, true);
  // Only the two opener spikes are simulated; the woven one is skipped, so the
  // refilled mantra keeps both charges.
  assert.equal(result.steps.filter((step) => step.skill === 'Power Spike' && !step.invalid).length, 2);
  assert.equal(result.endState.profession.availableFlips['Power Spike'].persistent, true);
  assert.equal(result.endState.ammo['Power Spike'].charges, 2);
  assert.match(result.warnings.at(-1), /Mantra of Pain is still channeling/);
});

test('Power Spike stays invalid even when another instant is chained into the channel first', () => {
  // Weaving an instant (Feedback) into the channel and then Power Spike after it
  // must still be caught: the flip is not armed until the channel completes,
  // regardless of the immediately preceding command.
  const result = simulateMesmer(
    [
      'Power Spike',
      'Power Spike',
      'Mantra of Pain',
      { name: 'Feedback', offset: 100 },
      { name: 'Power Spike', offset: 100 }
    ],
    defaultSimulationConfig({ specialization: 'Core' })
  );
  const woven = result.steps.find((step) => step.ri === 4);

  assert.equal(woven.invalid, true);
  assert.equal(result.steps.filter((step) => step.skill === 'Power Spike' && !step.invalid).length, 2);
  assert.equal(result.endState.ammo['Power Spike'].charges, 2);
});
