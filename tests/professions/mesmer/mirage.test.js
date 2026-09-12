import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { displayedWeaponSkills } from '#gw2/app/rotation/palette/model.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import { mesmerProfession } from '#gw2/professions/mesmer/definition.js';

// Mirage tests cover endurance, cloak, ambushes, mirrors, and specialization traits.
test('Mirage dodge spends 50 endurance and waits for continuous regeneration', () => {
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
  assert.ok(result.endState.profession.endurance < 0.01);
  assert.equal(result.endState.profession.maximumEndurance, 100);
  assert.equal(result.endState.ammo['Dodge / Mirage Cloak'], undefined);
});

// Endurance grants preserve fractional regeneration and cap the total, independent of skill cooldown modifiers.
test('Mirage endurance preserves partial regeneration through Energy sigil grants and feeds its palette bar', () => {
  const config = {
    specialization: 'Mirage',
    initialResource: 0,
    boons: { vigor: false },
    sigilSets: [{ names: ['Energy'] }, { names: ['Energy'] }]
  };
  for (const [dodges, expected] of [
    [1, 100],
    [2, 55]
  ]) {
    const result = simulateMesmer(
      [
        '__combat_start',
        ...Array(dodges).fill('Dodge / Mirage Cloak'),
        { name: '__wait', waitMs: 1000 },
        'Swap Weapons'
      ],
      config
    );
    assert.ok(Math.abs(result.endState.profession.endurance - expected) < 0.01);
    assert.equal(result.endState.ammo['Dodge / Mirage Cloak'], undefined);
    const view = mesmerProfession.ui
      .resourceViews({ specialization: 'Mirage', professionState: result.endState.profession })
      .find((resource) => resource.id === 'endurance');
    assert.equal(view.value, result.endState.profession.endurance);
    assert.equal(view.maximum, 100);
    assert.equal(view.displayMode, 'bar');
    assert.equal(view.paletteSkillId, ID.DODGE_MIRAGE_CLOAK);
    assert.deepEqual(result.warnings, []);
  }
});

// Vigor contributes only while active, and continuous regeneration returns to base speed after expiry.
test("Nomad's Endurance accelerates dodge recovery across application and expiry", () => {
  const dodge = { type: 'cast', skillId: ID.DODGE_MIRAGE_CLOAK };
  const wait = (durationMs) => ({ type: 'wait', durationMs });
  for (const [label, rotation, expected, vigor] of [
    ['active at dodge', ['Mind Wrack', wait(100), dodge, dodge, dodge, dodge], [100, 100, 8650, 18650], false],
    ['gained during recovery', [dodge, dodge, wait(1000), 'Mind Wrack', dodge, dodge], [0, 0, 8500, 18500], false],
    [
      'stacked duration',
      [dodge, dodge, 'Mind Wrack', wait(1000), 'Cry of Frustration', dodge, dodge],
      [0, 0, 7000, 17000],
      false
    ],
    ['expired before dodge', ['Mind Wrack', wait(3100), dodge, dodge, dodge], [3100, 3100, 13100], false],
    [
      'long wait across expiry',
      [dodge, dodge, 'Mind Wrack', wait(20000), dodge, dodge, dodge],
      [0, 0, 20000, 20000, 30000],
      false
    ],
    ['permanent vigor', ['Mind Wrack', dodge, dodge, dodge, dodge], [0, 0, 10000 / 1.5, 20000 / 1.5], true]
  ]) {
    const result = simulateMesmer(rotation, {
      specialization: 'Mirage',
      initialResource: 3,
      selectedTraitIds: [TRAIT.NOMADS_ENDURANCE],
      boons: { vigor }
    });
    assert.deepEqual(result.warnings, [], label);
    const starts = result.steps.filter((step) => step.skillId === ID.DODGE_MIRAGE_CLOAK).map((step) => step.start);
    assert.deepEqual(starts, expected.map(Math.round), label);
  }
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

// Queueing through a cast lockout preserves a selected ambush; explicitly waiting afterward lets it expire.
test('Mirage can queue an ambush before its window closes without extending the idle window', () => {
  for (const waitMs of [0, 40]) {
    const result = simulateMesmer(
      [
        'Dodge / Mirage Cloak',
        { name: '__wait', waitMs: 1000 },
        'Mind the Gap',
        ...(waitMs ? [{ name: '__wait', waitMs }] : []),
        'Fractured Glass'
      ],
      defaultSimulationConfig({
        specialization: 'Mirage',
        primaryWeapon: 'Spear',
        secondaryWeapon: '',
        selectedTraitIds: []
      })
    );
    const ambush = result.steps.find((step) => step.skill === 'Fractured Glass');
    assert.equal(Boolean(ambush.invalid), waitMs > 0);
    if (!waitMs) {
      assert.equal(ambush.start, 1600);
      assert.deepEqual(result.warnings, []);
    } else {
      assert.deepEqual(result.warnings, ['Fractured Glass has no active Mirage Cloak ambush window.']);
    }
  }
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
  assert.ok(Math.abs(mirror.at - 1.16) < 0.00001);
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

test('False Oasis creates its Mirage Mirror three seconds after the first pulse', () => {
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
  assert.equal(falseOasis.end - falseOasis.start, 960);
  assert.ok(mirror);
  assert.ok(Math.abs(mirror.at - (falseOasis.start / 1000 + 3.24)) < 0.00001);
  assert.equal(result.endState.profession.availableMirrors, 0);
  assert.equal(result.endState.profession.endurance, 100, 'Picking up a mirror must not spend endurance');
});

test('Mirage Mirror palette availability follows active ground mirrors', () => {
  const mirror = mesmerCatalog.skillsById.get(ID.PICK_UP_MIRAGE_MIRROR);
  const unavailable = mesmerProfession.ui.paletteSkillAvailability(
    {
      specialization: 'Mirage',
      professionState: { availableMirrors: 0 }
    },
    mirror
  );
  const available = mesmerProfession.ui.paletteSkillAvailability(
    {
      specialization: 'Mirage',
      professionState: { availableMirrors: 1 }
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
