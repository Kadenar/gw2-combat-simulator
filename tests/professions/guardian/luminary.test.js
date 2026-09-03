import assert from 'node:assert/strict';
import test from 'node:test';
import { displayedSkillTiles } from '#gw2/app/rotation/palette/model.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { guardianProfession } from '#gw2/professions/guardian/definition.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { radiantForgeAvailability } from '#gw2/professions/guardian/specializations/luminary/mechanics/radiant-forge.js';
import { LUMINARY_INITIAL_STATE_SKILL_IDS } from '#gw2/professions/guardian/specializations/luminary/skills/index.js';
import { createLuminaryState } from '#gw2/professions/guardian/specializations/luminary/state.js';

const config = {
  stats: {
    power: 2000,
    precision: 1000,
    ferocity: 0,
    conditionDamage: 1000,
    vitality: 1000
  },
  target: { armor: 2597 }
};

test('Luminary Radiant Forge enforces entry and radiant weapon flips', () => {
  const unavailable = simulateGw2({
    profession: guardianProfession,
    rotation: ['Dazzling Hammer'],
    config: {
      ...config,
      specialization: 'Luminary',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
    }
  });
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Enter Radiant Forge', 'Dazzling Hammer', 'Shining Spin', 'Glaring Burst'],
    config: { ...config, specialization: 'Luminary' }
  });

  assert.match(unavailable.warnings.join(' '), /Dazzling Hammer is unavailable/);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.radiantForge, true);
  assert.equal(result.endState.profession.radiantWeapon, 'hammer');
  const glaring = result.resolvedEvents.find((event) => event.skillId === GUARDIAN_SKILL_IDS.GLARING_BURST);

  assert.equal(glaring.coefficient, 1);
  assert.equal(glaring.metadata?.radiantWeapon, 'hammer');
  assert.equal(Object.hasOwn(result.endState.cooldowns, 'Enter Radiant Forge'), false);
  assert.ok(result.totalDamage > 0);
});

test('Luminary Forge availability follows skill IDs after display labels change', () => {
  const state = createLuminaryState();
  state.radiantForge = true;
  const context = {
    config: { specialization: 'Luminary' },
    state: { profession: { specialization: { kind: 'Luminary', state } } }
  };
  const enter = {
    ...guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.ENTER_RADIANT_FORGE),
    name: 'Renamed forge entry'
  };
  const exit = {
    ...guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.EXIT_RADIANT_FORGE),
    name: 'Renamed forge exit'
  };

  assert.equal(radiantForgeAvailability(context, enter).code, 'guardian.radiant-forge-active');
  assert.deepEqual(radiantForgeAvailability(context, exit), { ready: true });
});

test('Guardian weapon and Radiant Forge flips occupy one live palette tile', () => {
  const app = {
    skills: guardianCatalog.skills,
    skillById: guardianCatalog.skillsById,
    profession: guardianProfession,
    results: null
  };
  const displayedIdsAfter = (rotation, skillIds, extraConfig = {}) => {
    app.results = simulateGw2({
      profession: guardianProfession,
      rotation,
      config: { ...config, ...extraConfig }
    });

    return displayedSkillTiles(
      app,
      skillIds.map((skillId) => guardianCatalog.skillsById.get(skillId))
    ).map((skill) => skill.id);
  };

  const hammerTwo = [GUARDIAN_SKILL_IDS.MIGHTY_BLOW, GUARDIAN_SKILL_IDS.GLACIAL_BLOW].map((skillId) =>
    guardianCatalog.skillsById.get(skillId)
  );

  assert.deepEqual(
    guardianProfession.ui.paletteWeaponSkills({ traits: new Set() }, hammerTwo).map((skill) => skill.id),
    [GUARDIAN_SKILL_IDS.MIGHTY_BLOW]
  );
  assert.deepEqual(
    guardianProfession.ui
      .paletteWeaponSkills({ traits: new Set([GUARDIAN_TRAIT_IDS.GLACIAL_HEART]) }, hammerTwo)
      .map((skill) => skill.id),
    [GUARDIAN_SKILL_IDS.GLACIAL_BLOW]
  );

  const shieldParent = GUARDIAN_SKILL_IDS.SHIELD_OF_ABSORPTION;
  const shieldChild = GUARDIAN_SKILL_IDS.SHIELD_OF_ABSORPTION_ID_9224;
  const shieldConfig = { primaryWeapon: 'Mace', secondaryWeapon: 'Shield' };

  assert.deepEqual(displayedIdsAfter([], [shieldParent], shieldConfig), [shieldParent]);
  assert.deepEqual(displayedIdsAfter([{ type: 'cast', skillId: shieldParent }], [shieldParent], shieldConfig), [
    shieldChild
  ]);
  assert.deepEqual(
    displayedIdsAfter(
      [
        { type: 'cast', skillId: shieldParent },
        { type: 'cast', skillId: shieldChild }
      ],
      [shieldParent],
      shieldConfig
    ),
    [shieldParent]
  );

  assert.deepEqual(
    displayedIdsAfter(["Zealot's Flame"], [GUARDIAN_SKILL_IDS.ZEALOTS_FLAME], {
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Torch'
    }),
    [GUARDIAN_SKILL_IDS.ZEALOTS_FIRE]
  );

  assert.deepEqual(
    displayedIdsAfter(
      ['Enter Radiant Forge', 'Dazzling Hammer'],
      [
        GUARDIAN_SKILL_IDS.DAZZLING_HAMMER,
        GUARDIAN_SKILL_IDS.LUMINOUS_STAFF,
        GUARDIAN_SKILL_IDS.GLEAMING_BLADE,
        GUARDIAN_SKILL_IDS.RADIANT_BULWARK
      ],
      { specialization: 'Luminary' }
    ),
    [
      GUARDIAN_SKILL_IDS.SHINING_SPIN,
      GUARDIAN_SKILL_IDS.LUMINOUS_STAFF,
      GUARDIAN_SKILL_IDS.GLEAMING_BLADE,
      GUARDIAN_SKILL_IDS.RADIANT_BULWARK
    ]
  );
  assert.deepEqual(
    displayedIdsAfter(
      ['Enter Radiant Forge', 'Dazzling Hammer', 'Luminous Staff'],
      [GUARDIAN_SKILL_IDS.DAZZLING_HAMMER, GUARDIAN_SKILL_IDS.LUMINOUS_STAFF],
      { specialization: 'Luminary' }
    ),
    [GUARDIAN_SKILL_IDS.DAZZLING_HAMMER, GUARDIAN_SKILL_IDS.RESTORATIVE_GLOW]
  );

  const forgeSkillIds = guardianProfession.ui.paletteGroups({ specialization: 'Luminary' })[1].skillIds;
  assert.equal(
    displayedIdsAfter(['Enter Radiant Forge'], forgeSkillIds, { specialization: 'Luminary' }).at(-1),
    GUARDIAN_SKILL_IDS.RADIANT_BULWARK
  );
  assert.equal(
    displayedIdsAfter(['Enter Radiant Forge', 'Radiant Bulwark'], forgeSkillIds, {
      specialization: 'Luminary'
    }).at(-1),
    GUARDIAN_SKILL_IDS.BRILLIANT_SLAM
  );
});

test('Shining Spin strikes 400 ms into its quickened cast', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Enter Radiant Forge', 'Dazzling Hammer', 'Shining Spin'],
    config: {
      ...config,
      specialization: 'Luminary',
      boons: { quickness: true }
    }
  });
  const action = result.events.find((event) => event.type === 'action' && event.skillName === 'Shining Spin');
  const strike = result.resolvedEvents.find((event) => event.type === 'damage' && event.name === 'Shining Spin');

  assert.equal(Math.round((strike.at - action.at) * 1000), 400);
});

test('Radiant Forge damage packets use measured cast-start offsets', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Enter Radiant Forge',
      'Dazzling Hammer',
      'Shining Spin',
      { name: 'Glaring Burst', interruptMs: 520 },
      'Luminous Staff',
      'Gleaming Blade',
      'Lucent Thrust',
      { type: 'wait', durationMs: 4000 }
    ],
    config: { ...config, specialization: 'Luminary', boons: { quickness: true } }
  });
  const action = (skillName) => result.events.find((event) => event.type === 'action' && event.skillName === skillName);
  const offsets = (skillName) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillName === skillName)
      .map((event) => Math.round((event.at - action(skillName).at) * 1000));

  assert.deepEqual(offsets('Dazzling Hammer'), [440]);
  assert.deepEqual(offsets('Shining Spin'), [400]);
  assert.deepEqual(offsets('Glaring Burst'), [480]);
  assert.deepEqual(offsets('Luminous Staff'), [440, 1440, 2440, 3440]);
  assert.deepEqual(offsets('Gleaming Blade'), [760]);
  assert.deepEqual(offsets('Lucent Thrust'), [440, 480]);
  assert.equal(Math.round((action('Glaring Burst').endsAt - action('Glaring Burst').at) * 1000), 520);
  assert.equal(action('Glaring Burst').castLockoutEndsAt, undefined);
  assert.equal(Math.round((action('Luminous Staff').at - action('Glaring Burst').at) * 1000), 520);
  assert.deepEqual(result.warnings, []);
});

test('Sword Glaring Burst alternates its cadence and every weapon variant applies vulnerability', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Enter Radiant Forge',
      'Dazzling Hammer',
      'Glaring Burst',
      'Luminous Staff',
      'Glaring Burst',
      'Gleaming Blade',
      'Glaring Burst',
      'Glaring Burst',
      'Glaring Burst',
      'Radiant Bulwark',
      'Glaring Burst'
    ],
    config: { ...config, specialization: 'Luminary', boons: { quickness: true } }
  });
  const swordActions = result.events.filter(
    (event) =>
      event.type === 'action' &&
      event.skillName === 'Glaring Burst' &&
      event.at >= result.events.find((candidate) => candidate.skillName === 'Gleaming Blade').endsAt &&
      event.at < result.events.find((candidate) => candidate.skillName === 'Radiant Bulwark').at
  );
  const swordDamage = result.resolvedEvents.filter(
    (event) =>
      event.type === 'damage' &&
      event.skillId === GUARDIAN_SKILL_IDS.GLARING_BURST &&
      event.metadata?.radiantWeapon === 'blade'
  );
  const vulnerability = result.resolvedEvents.filter(
    (event) =>
      event.type === 'condition' &&
      event.skillId === GUARDIAN_SKILL_IDS.GLARING_BURST &&
      event.condition === 'Vulnerability'
  );
  const variants = result.events
    .filter((event) => event.type === 'action' && event.skillName === 'Glaring Burst')
    .map((event) => event.detail);

  assert.deepEqual(variants, [
    'Variant: Hammer',
    'Variant: Staff',
    'Variant: Sword (fast)',
    'Variant: Sword (slow)',
    'Variant: Sword (fast)',
    'Variant: Shield'
  ]);
  assert.deepEqual(
    swordActions.map((event) => Math.round((event.endsAt - event.at) * 1000)),
    [440, 680, 440]
  );
  assert.deepEqual(
    swordDamage.map((event, index) => Math.round((event.at - swordActions[index].at) * 1000)),
    [360, 440, 360]
  );
  assert.equal(vulnerability.length, 6);
  assert.ok(vulnerability.every((event) => event.stacks === 1 && event.duration === 8));
  assert.deepEqual(result.warnings, []);
});

test('Luminary Radiant Forge transitions reset weapon autoattack chains', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Strike', 'Enter Radiant Forge', 'Exit Radiant Forge', 'Strike'],
    config: {
      ...config,
      specialization: 'Luminary',
      primaryWeapon: 'Greatsword'
    }
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.events.filter((event) => event.type === 'action' && event.skillName === 'Strike').length, 2);
});

test('Radiant Forge strikes use its normalized transform weapon strength', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Enter Radiant Forge',
      'Dazzling Hammer',
      'Shining Spin',
      'Glaring Burst',
      'Luminous Staff',
      'Glaring Burst',
      'Gleaming Blade',
      'Glaring Burst',
      'Lucent Thrust',
      'Radiant Bulwark',
      'Brilliant Slam'
    ],
    config: { ...config, specialization: 'Luminary' }
  });
  const hitsFor = (skillName) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === skillName);
  const assertProfile = (skillName, profileId, strength) => {
    const hits = hitsFor(skillName);

    assert.ok(hits.length > 0, skillName);
    assert.ok(
      hits.every((event) => event.weaponStrengthProfileId === profileId && event.resolvedWeaponStrength === strength),
      skillName
    );
  };

  for (const skillName of [
    'Dazzling Hammer',
    'Shining Spin',
    'Luminous Staff',
    'Gleaming Blade',
    'Lucent Thrust',
    'Brilliant Slam'
  ]) {
    assertProfile(skillName, 'transform.radiant-forge', 1015);
  }

  assert.deepEqual(
    hitsFor('Glaring Burst').map((event) => [
      event.metadata?.radiantWeapon,
      event.weaponStrengthProfileId,
      event.resolvedWeaponStrength
    ]),
    [
      ['hammer', 'transform.radiant-forge', 1015],
      ['blade', 'transform.radiant-forge', 1015]
    ]
  );
  assert.deepEqual(result.warnings, []);
});

test('Radiant Forge recharge is reduced when at most one weapon is used', () => {
  const rechargeAfter = (radiantWeapons) => {
    const result = simulateGw2({
      profession: guardianProfession,
      rotation: ['Enter Radiant Forge', ...radiantWeapons, 'Exit Radiant Forge', 'Enter Radiant Forge'],
      config: { ...config, specialization: 'Luminary' }
    });
    const exit = result.steps.find((step) => step.skill === 'Exit Radiant Forge');
    const reentry = result.steps.filter((step) => step.skill === 'Enter Radiant Forge')[1];

    return reentry.start - exit.start;
  };

  assert.equal(rechargeAfter([]), 5000);
  assert.equal(rechargeAfter(['Dazzling Hammer']), 5000);
  assert.equal(rechargeAfter(['Dazzling Hammer', 'Luminous Staff']), 10000);
});

test('Radiant Forge automatically exits after 20 seconds and starts its reduced recharge', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Enter Radiant Forge', { type: 'wait', durationMs: 21000 }, 'Enter Radiant Forge'],
    config: { ...config, specialization: 'Luminary' }
  });

  const automaticExit = result.events.find(
    (event) => event.type === 'weapon_set' && event.skillName === 'Exit Radiant Forge' && event.automatic
  );

  assert.equal(automaticExit.at, 20);
  assert.equal(result.steps.filter((step) => step.skill === 'Enter Radiant Forge')[1].start, 25000);
});

test('Radiant Forge transitions emit the current set and trigger swap sigils', () => {
  const outOfCombat = simulateGw2({
    profession: guardianProfession,
    rotation: ['Enter Radiant Forge', { type: 'wait', durationMs: 1000 }],
    config: {
      ...config,
      specialization: 'Luminary',
      sigilSets: [
        {
          names: ['Hydromancy', 'Geomancy'],
          strike: 1,
          condition: 1
        },
        { names: [], strike: 1, condition: 1 }
      ]
    }
  });

  assert.equal(
    outOfCombat.procSteps.some((step) => step.type === 'sigil_proc'),
    false
  );

  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Daring Advance',
      'Piercing Stance',
      'Enter Radiant Forge',
      'Exit Radiant Forge',
      'Enter Radiant Forge',
      'Exit Radiant Forge',
      'Enter Radiant Forge',
      { type: 'wait', durationMs: 9000 }
    ],
    config: {
      ...config,
      specialization: 'Luminary',
      sigilSets: [
        {
          names: ['Hydromancy', 'Geomancy'],
          strike: 1,
          condition: 1
        },
        { names: [], strike: 1, condition: 1 }
      ]
    }
  });
  const procTimes = (name) =>
    result.procSteps.filter((step) => step.skill === `Sigil of ${name}`).map((step) => step.start);
  const applications = (condition) =>
    result.resolvedEvents.filter(
      (event) =>
        event.skillName === `Sigil of ${condition === 'Chilled' ? 'Hydromancy' : 'Geomancy'}` &&
        event.condition === condition
    );

  assert.deepEqual(procTimes('Hydromancy'), [1300, 11300]);
  assert.deepEqual(procTimes('Geomancy'), [1300, 11300]);
  assert.deepEqual(
    result.events.filter((event) => event.type === 'weapon_set').map((event) => [event.skillName, event.weaponSet]),
    [
      ['Enter Radiant Forge', 1],
      ['Exit Radiant Forge', 1],
      ['Enter Radiant Forge', 1],
      ['Exit Radiant Forge', 1],
      ['Enter Radiant Forge', 1]
    ]
  );
  assert.ok(
    result.procSteps
      .filter((step) => ['Sigil of Hydromancy', 'Sigil of Geomancy'].includes(step.skill))
      .every(
        (step) =>
          step.sourceSkill === 'Enter Radiant Forge' && step.icon.startsWith('https://render.guildwars2.com/file/')
      )
  );
  assert.equal(
    result.resolvedEvents.filter((event) => event.skillName === 'Sigil of Hydromancy' && event.type === 'damage')
      .length,
    2
  );
  assert.equal(applications('Chilled').length, 2);
  assert.equal(applications('Bleeding').length, 2);
  assert.ok(applications('Bleeding').every((application) => application.damage > 0));

  const manualExit = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Daring Advance',
      'Piercing Stance',
      'Enter Radiant Forge',
      { type: 'wait', durationMs: 10000 },
      'Exit Radiant Forge',
      { type: 'wait', durationMs: 1000 }
    ],
    config: {
      ...config,
      specialization: 'Luminary',
      sigilSets: [
        {
          names: ['Hydromancy', 'Geomancy'],
          strike: 1,
          condition: 1
        },
        { names: [], strike: 1, condition: 1 }
      ]
    }
  });

  assert.deepEqual(
    manualExit.procSteps
      .filter((step) => step.skill === 'Sigil of Hydromancy')
      .map((step) => [step.start, step.sourceSkill]),
    [
      [1300, 'Enter Radiant Forge'],
      [11300, 'Exit Radiant Forge']
    ]
  );

  const automaticExit = simulateGw2({
    profession: guardianProfession,
    rotation: ['Daring Advance', 'Piercing Stance', 'Enter Radiant Forge', { type: 'wait', durationMs: 21000 }],
    config: {
      ...config,
      specialization: 'Luminary',
      sigilSets: [
        {
          names: ['Hydromancy', 'Geomancy'],
          strike: 1,
          condition: 1
        },
        { names: [], strike: 1, condition: 1 }
      ]
    }
  });

  assert.deepEqual(
    automaticExit.procSteps
      .filter((step) => step.skill === 'Sigil of Geomancy')
      .map((step) => [step.start, step.sourceSkill]),
    [
      [1300, 'Enter Radiant Forge'],
      [21300, 'Exit Radiant Forge']
    ]
  );
  assert.deepEqual(
    automaticExit.events
      .filter((event) => event.type === 'weapon_set')
      .map((event) => [event.skillName, event.weaponSet, Boolean(event.automatic)]),
    [
      ['Enter Radiant Forge', 1, false],
      ['Exit Radiant Forge', 1, true]
    ]
  );

  const radiantWeapon = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Daring Advance',
      'Piercing Stance',
      'Enter Radiant Forge',
      { type: 'wait', durationMs: 10000 },
      'Dazzling Hammer',
      'Shining Spin',
      { type: 'wait', durationMs: 1000 }
    ],
    config: {
      ...config,
      specialization: 'Luminary',
      sigilSets: [
        {
          names: ['Hydromancy', 'Geomancy'],
          strike: 1,
          condition: 1
        },
        { names: [], strike: 1, condition: 1 }
      ]
    }
  });

  assert.deepEqual(
    radiantWeapon.procSteps
      .filter((step) => step.skill === 'Sigil of Hydromancy')
      .map((step) => [step.start, step.sourceSkill]),
    [
      [1300, 'Enter Radiant Forge'],
      [12020, 'Dazzling Hammer']
    ]
  );
  assert.equal(
    radiantWeapon.procSteps.some((step) => step.skill === 'Sigil of Hydromancy' && step.sourceSkill === 'Shining Spin'),
    false
  );
});

test('Luminary weapon coefficients, disables, and armament buffs resolve', () => {
  const rotation = [
    'Enter Radiant Forge',
    'Dazzling Hammer',
    'Shining Spin',
    'Luminous Staff',
    { type: 'wait', durationMs: 3500 }
  ];
  const empowered = simulateGw2({
    profession: guardianProfession,
    rotation,
    config: {
      ...config,
      specialization: 'Luminary',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS]
    }
  });
  const armaments = simulateGw2({
    profession: guardianProfession,
    rotation,
    config: {
      ...config,
      specialization: 'Luminary',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS, GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS]
    }
  });
  const damage = (result, name) => result.resolvedEvents.find((event) => event.name === name);
  const dazzling = damage(armaments, 'Dazzling Hammer');
  const shining = damage(armaments, 'Shining Spin');
  const defiantAfterDaze = simulateGw2({
    profession: guardianProfession,
    rotation: ['Enter Radiant Forge', 'Dazzling Hammer', 'Shining Spin'],
    config: {
      ...config,
      specialization: 'Luminary',
      target: { ...config.target, defiant: true }
    }
  });
  const ordinaryAfterDaze = simulateGw2({
    profession: guardianProfession,
    rotation: ['Enter Radiant Forge', 'Dazzling Hammer', 'Shining Spin'],
    config: {
      ...config,
      specialization: 'Luminary'
    }
  });

  assert.equal(dazzling.coefficient, 1.2);
  assert.equal(shining.coefficient, 1.25);
  assert.ok(shining.damage > dazzling.damage);
  assert.ok(
    Math.abs(damage(defiantAfterDaze, 'Shining Spin').damage / damage(ordinaryAfterDaze, 'Shining Spin').damage - 1) <
      1e-9
  );
  assert.ok(Math.abs(dazzling.damage / damage(empowered, 'Dazzling Hammer').damage - 1) < 1e-9);
  assert.ok(Math.abs(shining.damage / damage(empowered, 'Shining Spin').damage - 1.17 / 1.1) < 1e-9);
  const armamentStaff = armaments.resolvedEvents.filter((event) => event.name === 'Luminous Staff — Symbol Damage');
  const empoweredStaff = empowered.resolvedEvents.filter((event) => event.name === 'Luminous Staff — Symbol Damage');

  assert.ok(Math.abs(armamentStaff[0].damage / empoweredStaff[0].damage - 1.17 / 1.1) < 1e-9);
  assert.equal(
    armamentStaff
      .slice(1)
      .every((event, index) => Math.abs(event.damage / empoweredStaff[index + 1].damage - 1) < 1e-9),
    true
  );
  assert.equal(armaments.resolvedEvents.filter((event) => event.name === 'Luminous Staff — Symbol Damage').length, 4);
  assert.deepEqual(
    armaments.procSteps.filter((step) => step.skill === 'Empowered Armaments').map((step) => step.detail),
    ['triggered', 'refreshed']
  );
  assert.equal(
    armaments.procSteps.filter((step) => step.skill === 'Radiant Armaments')[1].detail,
    'staff: hammer bonus removed'
  );

  const justice = simulateGw2({
    profession: guardianProfession,
    rotation: ['Radiant Justice', 'Enter Radiant Forge', 'Dazzling Hammer', { type: 'wait', durationMs: 1000 }],
    config: { ...config, specialization: 'Luminary' }
  });
  const hammerPackets = justice.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.DAZZLING_HAMMER
  );

  assert.deepEqual(
    hammerPackets.map((event) => event.coefficient),
    [1.2, 1.5]
  );
  assert.ok(Math.abs(hammerPackets[1].at - hammerPackets[0].at - 0.75) < 1e-9);

  const gleaming = (selectedTraitIds) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: [...(selectedTraitIds ? ['Radiant Courage'] : []), 'Enter Radiant Forge', 'Gleaming Blade'],
      config: { ...config, specialization: 'Luminary' }
    });
  const normalBlade = damage(gleaming(false), 'Gleaming Blade');
  const empoweredBlade = damage(gleaming(true), 'Gleaming Blade');

  assert.ok(Math.abs(empoweredBlade.damage / normalBlade.damage - 1.5) < 1e-9);
});

test('Radiant-weapon traits activate only after a completed equip cast', () => {
  const run = (radiantWeapon) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: ['Enter Radiant Forge', radiantWeapon, { type: 'wait', durationMs: 10 }],
      config: {
        ...config,
        specialization: 'Luminary',
        selectedTraitIds: [GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS]
      }
    });
  const completed = run('Dazzling Hammer');
  const interrupted = run({ name: 'Dazzling Hammer', interruptMs: 1 });

  assert.equal(completed.procSteps.filter((step) => step.skill === 'Empowered Armaments').length, 1);
  assert.equal(interrupted.procSteps.filter((step) => step.skill === 'Empowered Armaments').length, 0);
  assert.deepEqual(completed.endState.profession.radiantWeaponsUsed, { hammer: true });
  assert.deepEqual(interrupted.endState.profession.radiantWeaponsUsed, {});
});

test('Radiant weapon equips replace the prior flip and preserve its parent cooldown', () => {
  const weapons = [
    ['Dazzling Hammer', GUARDIAN_SKILL_IDS.SHINING_SPIN],
    ['Luminous Staff', GUARDIAN_SKILL_IDS.RESTORATIVE_GLOW],
    ['Gleaming Blade', GUARDIAN_SKILL_IDS.LUCENT_THRUST],
    ['Radiant Bulwark', GUARDIAN_SKILL_IDS.BRILLIANT_SLAM]
  ];

  for (const [index, [parent, flip]] of weapons.entries()) {
    const [nextParent, nextFlip] = weapons[(index + 1) % weapons.length];
    const result = simulateGw2({
      profession: guardianProfession,
      rotation: ['Enter Radiant Forge', parent, nextParent],
      config: { ...config, specialization: 'Luminary' }
    });

    assert.equal(result.endState.profession.availableFlips[flip], undefined, parent);
    assert.ok(result.endState.profession.availableFlips[nextFlip], nextParent);
    assert.ok(result.endState.cooldowns[parent].remaining > 0, parent);
  }

  const glaringBurst = simulateGw2({
    profession: guardianProfession,
    rotation: ['Enter Radiant Forge', 'Dazzling Hammer', 'Glaring Burst'],
    config: { ...config, specialization: 'Luminary' }
  });

  assert.ok(glaringBurst.endState.profession.availableFlips[GUARDIAN_SKILL_IDS.SHINING_SPIN]);
});

test('Guardian armaments share the additive sigil bucket', () => {
  const rotation = ['Enter Radiant Forge', 'Dazzling Hammer', 'Shining Spin'];
  const run = ({ selectedTraitIds = [], sigilSets = undefined, burning = false } = {}) =>
    simulateGw2({
      profession: guardianProfession,
      rotation,
      config: {
        ...config,
        specialization: 'Luminary',
        selectedTraitIds,
        sigilSets,
        target: {
          ...config.target,
          conditions: burning ? { Burning: true } : {}
        }
      }
    });
  const shining = (result) => result.resolvedEvents.find((event) => event.name === 'Shining Spin').damage;
  const baseline = run();
  const sigils = run({
    sigilSets: [{ names: ['Force', 'Impact'], strikeAdd: 0.08, strike: 1.08 }, {}]
  });
  const armaments = run({
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS, GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS],
    sigilSets: [{ names: ['Force', 'Impact'], strikeAdd: 0.08, strike: 1.08 }, {}]
  });
  const conditional = run({
    selectedTraitIds: [
      GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS,
      GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS,
      GUARDIAN_TRAIT_IDS.FIERY_WRATH
    ],
    sigilSets: [{ names: ['Force', 'Impact'], strikeAdd: 0.08, strike: 1.08 }, {}],
    burning: true
  });

  assert.ok(Math.abs(shining(sigils) / shining(baseline) - 1.08) < 1e-9);
  assert.ok(Math.abs(shining(armaments) / shining(baseline) - 1.25) < 1e-9);
  assert.ok(Math.abs(shining(conditional) / shining(armaments) - 1.05) < 1e-9);
});

test('Radiant virtues grant one-use hammer and sword empowerments', () => {
  const armedHammer = simulateGw2({
    profession: guardianProfession,
    rotation: ['Radiant Justice'],
    config: { ...config, specialization: 'Luminary' }
  });
  const hammer = simulateGw2({
    profession: guardianProfession,
    rotation: ['Radiant Justice', 'Enter Radiant Forge', 'Dazzling Hammer', 'Dazzling Hammer'],
    config: { ...config, specialization: 'Luminary' }
  });
  const armedSword = simulateGw2({
    profession: guardianProfession,
    rotation: ['Radiant Courage'],
    config: { ...config, specialization: 'Luminary' }
  });
  const sword = simulateGw2({
    profession: guardianProfession,
    rotation: ['Radiant Courage', 'Enter Radiant Forge', 'Gleaming Blade', 'Gleaming Blade'],
    config: { ...config, specialization: 'Luminary' }
  });
  const bladeHits = sword.resolvedEvents.filter((event) => event.name === 'Gleaming Blade');

  assert.equal(armedHammer.endState.profession.radiantJusticeArmed, true);
  assert.equal(
    hammer.resolvedEvents.filter((event) => event.name === 'Dazzling Hammer — Radiant Justice Impact').length,
    1
  );
  assert.equal(hammer.endState.profession.radiantJusticeArmed, false);
  assert.ok(
    hammer.procSteps.some(
      (step) =>
        step.type === 'skill_proc' && step.skill === 'Empowered Hammer' && step.sourceSkill === 'Radiant Justice'
    )
  );

  assert.equal(armedSword.endState.profession.radiantCourageSwordArmed, true);
  assert.equal(bladeHits.length, 2);
  assert.ok(Math.abs(bladeHits[0].damage / bladeHits[1].damage - 1.5) < 1e-9);
  assert.equal(sword.endState.profession.radiantCourageSwordArmed, false);
  assert.ok(
    sword.procSteps.some(
      (step) => step.type === 'skill_proc' && step.skill === 'Empowered Sword' && step.sourceSkill === 'Radiant Courage'
    )
  );
});

test('Guardian strike modifiers use their tested additive and mult buckets', () => {
  const run = (selectedTraitIds) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: ['Symbol of Resolution', { type: 'wait', durationMs: 1500 }],
      config: {
        ...config,
        boons: { fury: true },
        primaryWeapon: 'Greatsword',
        selectedTraitIds,
        sigilSets: [{ names: ['Force'], strikeAdd: 0.05, strike: 1.05 }, {}],
        target: {
          ...config.target,
          conditions: {
            Burning: true,
            Vulnerability: 25
          }
        }
      }
    });
  const pulse = (result) => result.resolvedEvents.filter((event) => event.name === 'Symbol of Resolution')[0].damage;
  const baseline = run([]);
  const conditional = run([
    GUARDIAN_TRAIT_IDS.FIERY_WRATH,
    GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS,
    GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
    GUARDIAN_TRAIT_IDS.RETRIBUTION
  ]);

  assert.ok(Math.abs(pulse(conditional) / pulse(baseline) - (1.25 / 1.05) * 1.05 * 1.05) < 1e-9);
});

test('Luminary stances apply modifiers, combos, delayed damage, and control', () => {
  const piercing = simulateGw2({
    profession: guardianProfession,
    rotation: ['Piercing Stance', 'Piercing Stance', { type: 'wait', durationMs: 1000 }],
    config: {
      ...config,
      specialization: 'Luminary',
      relic: 'Claw'
    }
  });
  const daring = simulateGw2({
    profession: guardianProfession,
    rotation: ['Daring Advance', { type: 'wait', durationMs: 1000 }],
    config: { ...config, specialization: 'Luminary' }
  });
  const daringThenPiercing = simulateGw2({
    profession: guardianProfession,
    rotation: ['Daring Advance', 'Piercing Stance', { type: 'wait', durationMs: 1000 }],
    config: { ...config, specialization: 'Luminary' }
  });
  const quickPiercing = simulateGw2({
    profession: guardianProfession,
    rotation: ['Piercing Stance'],
    config: {
      ...config,
      specialization: 'Luminary',
      boons: { quickness: true }
    }
  });
  const effulgent = simulateGw2({
    profession: guardianProfession,
    rotation: ['Effulgent Stance', 'Whirling Wrath', { type: 'wait', durationMs: 4000 }],
    config: {
      ...config,
      specialization: 'Luminary',
      primaryWeapon: 'Greatsword',
      relic: 'Claw'
    }
  });
  const effulgentWithGuardianProcs = simulateGw2({
    profession: guardianProfession,
    rotation: ['Effulgent Stance', 'Enter Radiant Forge', 'Dazzling Hammer', { type: 'wait', durationMs: 4000 }],
    config: {
      ...config,
      specialization: 'Luminary',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
    }
  });
  const effulgentDamage = effulgent.resolvedEvents.find((event) => event.name === 'Effulgent Stance');
  const procChargedEffulgent = effulgentWithGuardianProcs.resolvedEvents.find(
    (event) => event.name === 'Effulgent Stance'
  );
  const piercingBuffs = piercing.events.filter((event) => event.kind === 'guardian-piercing-stance');
  const quickPiercingAction = quickPiercing.events.find(
    (event) => event.type === 'action' && event.skillName === 'Piercing Stance'
  );
  const quickPiercingBuff = quickPiercing.events.find((event) => event.kind === 'guardian-piercing-stance');
  const quickPiercingPackets = quickPiercing.events.filter(
    (event) => ['damage', 'control'].includes(event.type) && event.skillName === 'Piercing Stance'
  );
  const daringImpact = daring.resolvedEvents.find((event) => event.skillName === 'Daring Advance');
  const daringBuff = daring.events.find((event) => event.kind === 'guardian-daring-advance');
  const unmodifiedDaringDamage =
    ((daringImpact.coefficient * config.stats.power * daringImpact.resolvedWeaponStrength) / config.target.armor) *
    (1 + daringImpact.criticalChance * (daringImpact.criticalDamage - 1));

  assert.equal(
    piercing.events.find((event) => event.type === 'control' && event.skillName === 'Piercing Stance').controlKind,
    'daze'
  );
  assert.equal(piercingBuffs[0].duration, 8);
  assert.ok(Math.abs(piercingBuffs[1].at + piercingBuffs[1].duration - 16.24) < 1e-9);
  assert.equal(quickPiercingAction.endsAt - quickPiercingAction.at, 0.2);
  assert.ok(Math.abs(quickPiercingBuff.at - quickPiercingAction.at - 0.16) < 1e-9);
  assert.ok(quickPiercingPackets.every((event) => Math.abs(event.at - quickPiercingBuff.at) < 1e-9));
  assert.equal(
    daringThenPiercing.resolvedEvents.find((event) => event.skillName === 'Daring Advance').damage,
    daringImpact.damage
  );
  assert.equal(daringImpact.at, 0.68);
  assert.equal(daringBuff.at, daringImpact.at);
  assert.equal(daringImpact.damage, unmodifiedDaringDamage);
  assert.ok(piercing.procSteps.some((step) => step.skill === 'Relic of the Claw'));
  assert.equal(
    daring.events.some((event) => event.type === 'control' && event.skillName === 'Daring Advance'),
    false
  );
  assert.equal(daringBuff.duration, 8);
  assert.equal(effulgentDamage.at, 4);
  assert.equal(effulgentDamage.stackCount, 10);
  assert.equal(effulgentDamage.coefficient, 4);
  assert.equal(effulgentDamage.weaponStrengthProfileId, 'nonweapon.unequipped');
  assert.equal(effulgentDamage.resolvedWeaponStrength, 690.5);
  assert.equal(effulgentDamage.weaponStrengthSampled, false);
  assert.equal(procChargedEffulgent.stackCount, 2);
  assert.ok(Math.abs(procChargedEffulgent.coefficient - 1.2) < 1e-9);
  assert.deepEqual(
    effulgent.procSteps
      .filter((step) => step.type === 'skill_proc' && step.skill === 'Effulgent Stance')
      .map((step) => [step.start, step.sourceSkill, step.detail]),
    [[4000, 'Effulgent Stance', '10/10 stacks']]
  );
  assert.ok(effulgent.procSteps.some((step) => step.skill === 'Relic of the Claw' && step.start === 4000));
});

test('off-target Luminary precasts retain setup without damaging the target', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Enter Radiant Forge',
      { name: 'Luminous Staff', offTarget: true },
      { name: 'Dazzling Hammer', offTarget: true },
      { type: 'wait', durationMs: 4000 }
    ],
    config: { ...config, specialization: 'Luminary' }
  });
  const precastSkillIds = new Set([GUARDIAN_SKILL_IDS.LUMINOUS_STAFF, GUARDIAN_SKILL_IDS.DAZZLING_HAMMER]);

  assert.equal(
    result.resolvedEvents.some((event) => precastSkillIds.has(event.skillId) && event.type === 'damage'),
    false
  );
  assert.equal(
    result.resolvedEvents.some((event) => event.name === 'Sovereign of Light'),
    false
  );
  assert.equal(
    result.events.filter((event) => event.kind === 'resolution' && event.skillId === GUARDIAN_SKILL_IDS.LUMINOUS_STAFF)
      .length,
    4
  );
  assert.equal(result.endState.profession.radiantWeapon, 'hammer');
  assert.ok(result.endState.profession.lightAuraUntil > 0);
});

test('Luminary hidden actions replay exact EVTC opening-state durations', () => {
  const durations = {
    resolution: 9_280,
    claw: 8_000,
    empoweredArmaments: 14_514,
    radiantHammer: 7_320
  };
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: Object.entries(LUMINARY_INITIAL_STATE_SKILL_IDS).map(([kind, skillId]) => ({
      type: 'cast',
      skillId,
      initialStateDurationMs: durations[kind]
    })),
    config: { ...config, specialization: 'Luminary', relic: 'Claw' }
  });
  const buffDuration = (kind) => result.events.find((event) => event.type === 'buff' && event.kind === kind).duration;
  const claw = result.procSteps.find((step) => step.skill === 'Relic of the Claw');

  assert.equal(buffDuration('resolution'), 9.28);
  assert.equal(buffDuration('guardian-empowered-armaments'), 14.514);
  assert.equal(buffDuration('guardian-radiant-armaments'), 7.32);
  assert.equal(claw.expiresAt, 8_000);
  assert.equal(result.events.find((event) => event.controlKind === 'initial-state').duration, 0);
});

test('Luminary Light Aura follows resolved combos instead of hardcoded leap casts', () => {
  const simulate = (rotation, selectedTraitIds = []) =>
    simulateGw2({
      profession: guardianProfession,
      rotation,
      config: {
        ...config,
        specialization: 'Luminary',
        primaryWeapon: 'Greatsword',
        selectedTraitIds
      }
    });
  const combo = (result, skillName) =>
    result.resolvedEvents.find((event) => event.type === 'combo' && event.skillName === skillName);
  const unbound = simulate(['Leap of Faith', 'Piercing Stance'], [GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]);
  const bound = simulate(
    ['Symbol of Resolution', 'Leap of Faith', 'Piercing Stance'],
    [GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
  );
  const daring = simulate(['Daring Advance']);
  const gleaming = simulate(['Symbol of Resolution', 'Enter Radiant Forge', 'Gleaming Blade']);
  const dazzlingUnbound = simulate(['Enter Radiant Forge', 'Dazzling Hammer']);
  const dazzlingBound = simulate(['Symbol of Resolution', 'Enter Radiant Forge', 'Dazzling Hammer']);

  assert.equal(unbound.events.find((event) => event.type === 'blind').duration, 3);
  assert.equal(combo(unbound, 'Leap of Faith'), undefined);
  assert.equal(
    unbound.resolvedEvents.some((event) => event.name === 'Sovereign of Light'),
    false
  );
  assert.deepEqual(
    [
      combo(bound, 'Leap of Faith'),
      combo(daring, 'Daring Advance'),
      combo(gleaming, 'Gleaming Blade'),
      combo(dazzlingBound, 'Dazzling Hammer')
    ].map((event) => [event.fieldType, event.finisherType, event.outcome.name]),
    [
      ['Light', 'Leap', 'Light Aura'],
      ['Light', 'Leap', 'Light Aura'],
      ['Light', 'Leap', 'Light Aura'],
      ['Light', 'Blast', 'Area Cleanse']
    ]
  );
  assert.equal(
    bound.resolvedEvents.find((event) => event.name === 'Sovereign of Light').triggeredBy,
    'Piercing Stance'
  );
  assert.equal(dazzlingUnbound.endState.profession.lightAuraUntil, 0);
  assert.ok(dazzlingBound.endState.profession.lightAuraUntil > 0);
});

test('Sovereign of Light ignores a core leap that refreshes Light Aura', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Radiant Justice', 'Leap of Faith'],
    config: {
      ...config,
      specialization: 'Luminary',
      primaryWeapon: 'Greatsword',
      selectedTraitIds: [
        GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS,
        GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND,
        GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT
      ]
    }
  });

  // Justice is Blind supplies the first aura; the Light-field leap may refresh it but cannot detonate Sovereign.
  assert.ok(result.resolvedEvents.some((event) => event.type === 'aura' && event.skillName === 'Leap of Faith'));
  assert.equal(
    result.resolvedEvents.some((event) => event.name === 'Sovereign of Light'),
    false
  );
  assert.ok(result.endState.profession.lightAuraUntil > 0);
});

test('Sovereign of Light consumes combo and trait-granted light auras', () => {
  const sovereignJustice = simulateGw2({
    profession: guardianProfession,
    rotation: ['Enter Radiant Forge', 'Dazzling Hammer'],
    config: {
      ...config,
      specialization: 'Luminary',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
    }
  });
  const activationJustice = simulateGw2({
    profession: guardianProfession,
    rotation: ['Effulgent Stance', 'Radiant Justice'],
    config: {
      ...config,
      specialization: 'Luminary',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND, GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
    }
  });
  const combo = simulateGw2({
    profession: guardianProfession,
    rotation: ['Symbol of Resolution', 'Leap of Faith', 'Enter Radiant Forge', 'Dazzling Hammer'],
    config: {
      ...config,
      specialization: 'Luminary',
      primaryWeapon: 'Greatsword',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
    }
  });
  const justice = simulateGw2({
    profession: guardianProfession,
    rotation: ['Piercing Stance', 'Radiant Justice', 'Piercing Stance'],
    config: {
      ...config,
      specialization: 'Luminary',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND, GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
    }
  });
  const justiceWithClaw = simulateGw2({
    profession: guardianProfession,
    rotation: ['Piercing Stance', 'Radiant Justice', 'Piercing Stance'],
    config: {
      ...config,
      specialization: 'Luminary',
      relic: 'Claw',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND, GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
    }
  });
  const sovereignHits = combo.resolvedEvents.filter((event) => event.name === 'Sovereign of Light');
  const sovereignProcs = combo.procSteps.filter((step) => step.skill === 'Sovereign of Light');

  assert.equal(sovereignHits.length, 1);
  assert.deepEqual(
    sovereignHits.map((event) => event.triggeredBy),
    ['Dazzling Hammer']
  );
  assert.equal(
    sovereignHits.every((event) => event.coefficient === 1.5),
    true
  );
  assert.equal(
    sovereignHits.every((event) => event.skillWeapon === 'Unequipped'),
    true
  );
  assert.equal(sovereignProcs.length, 1);
  assert.equal(
    sovereignProcs.every((step) => step.type === 'trait_proc'),
    true
  );
  assert.equal(
    sovereignProcs.every((step) => Boolean(step.icon)),
    true
  );
  assert.ok(justice.events.some((event) => event.type === 'blind' && event.skillName === 'Justice is Blind'));
  assert.equal(justice.resolvedEvents.filter((event) => event.name === 'Sovereign of Light').length, 1);
  assert.equal(activationJustice.endState.profession.justiceHitCount, 1);
  const justiceSovereign = justice.resolvedEvents.find((event) => event.name === 'Sovereign of Light');
  const clawSovereign = justiceWithClaw.resolvedEvents.find((event) => event.name === 'Sovereign of Light');

  assert.equal(sovereignJustice.endState.profession.justiceHitCount, 2);
  assert.deepEqual(
    {
      actorType: clawSovereign.actorType,
      ownerActorType: clawSovereign.ownerActorType
    },
    { actorType: 'effect', ownerActorType: 'player' }
  );
  assert.ok(Math.abs(clawSovereign.damage / justiceSovereign.damage - 1.07) < 1e-12);
});

test('Sovereign of Light ignores fresh stance modifiers but retains an active Piercing Stance', () => {
  const simulate = (rotation) =>
    simulateGw2({
      profession: guardianProfession,
      rotation,
      config: {
        ...config,
        specialization: 'Luminary',
        selectedTraitIds: [GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
      }
    });
  const sovereignDamage = (result) => result.resolvedEvents.find((event) => event.name === 'Sovereign of Light').damage;
  const freshDaring = simulate(['Enter Radiant Forge', 'Exit Radiant Forge', 'Daring Advance']);
  const freshPiercing = simulate(['Enter Radiant Forge', 'Exit Radiant Forge', 'Piercing Stance']);
  const activePiercing = simulate(['Piercing Stance', 'Enter Radiant Forge', 'Exit Radiant Forge', 'Piercing Stance']);
  const unmodifiedDamage = ((1.5 * config.stats.power * 690.5) / config.target.armor) * (1 + 0.05 * (1.5 - 1));

  assert.equal(sovereignDamage(freshDaring), unmodifiedDamage);
  assert.equal(sovereignDamage(freshPiercing), unmodifiedDamage);
  assert.ok(Math.abs(sovereignDamage(activePiercing) / unmodifiedDamage - 1.1) < 1e-12);
});

test('Sovereign of Light resolves overlapping aura grants and finishers chronologically', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Enter Radiant Forge',
      'Dazzling Hammer',
      { name: 'Effulgent Stance', offset: 240 },
      { name: 'Radiant Justice', offset: 40 },
      'Shining Spin',
      { name: 'Radiant Resolve', offset: 80 }
    ],
    config: {
      ...config,
      boons: { quickness: true },
      specialization: 'Luminary',
      selectedTraitIds: [
        GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS,
        GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND,
        GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT
      ]
    }
  });

  assert.deepEqual(
    result.resolvedEvents
      .filter((event) => event.name === 'Sovereign of Light')
      .map((event) => [Math.round(event.at * 1000), event.triggeredBy]),
    [
      [240, 'Effulgent Stance'],
      [280, 'Radiant Justice'],
      [440, 'Dazzling Hammer'],
      [560, 'Radiant Resolve'],
      [880, 'Shining Spin']
    ]
  );
});

test('Luminary recharge traits alter the intended cooldown families', () => {
  const masterRotation = [
    'Enter Radiant Forge',
    'Dazzling Hammer',
    'Exit Radiant Forge',
    'Radiant Justice',
    'Enter Radiant Forge',
    'Dazzling Hammer'
  ];
  const withMaster = simulateGw2({
    profession: guardianProfession,
    rotation: masterRotation,
    config: {
      ...config,
      specialization: 'Luminary',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.MASTER_AT_ARMS]
    }
  });
  const withoutMaster = simulateGw2({
    profession: guardianProfession,
    rotation: masterRotation,
    config: { ...config, specialization: 'Luminary' }
  });
  const inspirationRotation = [
    'Radiant Justice',
    'Enter Radiant Forge',
    'Dazzling Hammer',
    'Exit Radiant Forge',
    'Radiant Justice'
  ];
  const withInspiration = simulateGw2({
    profession: guardianProfession,
    rotation: inspirationRotation,
    config: {
      ...config,
      specialization: 'Luminary',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.ILLUMINATING_INSPIRATION]
    }
  });
  const withoutInspiration = simulateGw2({
    profession: guardianProfession,
    rotation: inspirationRotation,
    config: { ...config, specialization: 'Luminary' }
  });

  assert.equal(withMaster.steps.filter((step) => step.skill === 'Dazzling Hammer')[1].start, 5720);
  assert.equal(withoutMaster.steps.filter((step) => step.skill === 'Dazzling Hammer')[1].start, 7720);
  assert.equal(withInspiration.steps.filter((step) => step.skill === 'Radiant Justice')[1].start, 16000);
  assert.equal(withoutInspiration.steps.filter((step) => step.skill === 'Radiant Justice')[1].start, 20000);
});
