import assert from 'node:assert/strict';
import test from 'node:test';
import { displayedSkillTiles } from '#gw2/app/rotation/palette/model.js';
import { buildChartSeries } from '#gw2/app/results/model.js';
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

const PLAYER_AUDIENCE = Object.freeze({
  includesSelf: true,
  includesSummons: false,
  alliedPlayerCount: 0,
  companionIds: [],
  recipientCount: 1
});

test('committed disc cancellation preserves the illuminated shock wave', () => {
  // Verify persistence and enhancement on the same delayed packet, without pinning timing metadata.
  const disc = guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.GLEAMING_DISC);
  const run = (illuminated, interruptMs) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: [
        ...(illuminated ? ['Symbol of Luminance'] : []),
        { name: disc.name, interruptMs },
        { type: 'wait', durationMs: 1000 }
      ],
      config: { ...config, boons: { quickness: true } }
    });
  const result = run(true, disc.interruptCommitMs);
  const action = result.events.find((event) => event.type === 'action' && event.skillId === disc.id);
  const shock = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === disc.id && event.hitIndex === 2
  );
  const ordinary = run(false, disc.interruptCommitMs).resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillId === disc.id && event.hitIndex === 2
  );
  assert.ok(shock.at > action.endsAt);
  assert.ok(shock.coefficient > ordinary.coefficient);
  assert.deepEqual(result.warnings, []);
  assert.equal(
    run(true, 0).resolvedEvents.some((event) => event.type === 'damage' && event.skillId === disc.id),
    false
  );
});

test('a launched hammer still finishes its blast and supplies aura for the following Sovereign trigger', () => {
  // A committed cancel must preserve the combo-producing impact, not only the weapon flip state.
  const hammer = guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.DAZZLING_HAMMER);
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Symbol of Resolution',
      'Enter Radiant Forge',
      { name: hammer.name, interruptMs: hammer.interruptCommitMs },
      'Shining Spin'
    ],
    config: {
      ...config,
      specialization: 'Luminary',
      boons: { quickness: true },
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
    }
  });
  const action = result.events.find((event) => event.type === 'action' && event.skillId === hammer.id);
  const combo = result.resolvedEvents.find((event) => event.type === 'combo' && event.skillId === hammer.id);
  assert.ok(combo.at > action.endsAt);
  assert.ok(
    result.resolvedEvents.some((event) => event.name === 'Sovereign of Light' && event.triggeredBy === 'Shining Spin')
  );
  assert.deepEqual(result.warnings, []);
});

test('Luminary skill boons reach the effects chart with boon-duration scaling', () => {
  // Single casts cover each missing boon source without relying on a saved benchmark rotation.
  for (const [rotation, expected] of [
    [
      ['Enter Radiant Forge', 'Dazzling Hammer'],
      ['Might', 'Fury']
    ],
    [['Enter Radiant Forge', 'Luminous Staff'], ['Protection']],
    [['Radiant Courage'], ['Aegis', 'Resistance']],
    [['Enter Radiant Forge', 'Radiant Bulwark'], ['Aegis']],
    [['Radiant Resolve', 'Enter Radiant Forge', 'Luminous Staff'], ['Regeneration']],
    [['Enter Radiant Forge', 'Luminous Staff', 'Glaring Burst'], ['Regeneration']],
    [['Enter Radiant Forge', 'Radiant Bulwark', 'Glaring Burst'], ['Resolution']],
    [['Valorous Stance'], ['Stability', 'Protection']]
  ]) {
    const result = simulateGw2({
      profession: guardianProfession,
      rotation: [...rotation, { type: 'wait', durationMs: 1000 }],
      config: { ...config, specialization: 'Luminary', stats: { ...config.stats, concentration: 750 } }
    });
    const baseline = simulateGw2({
      profession: guardianProfession,
      rotation: [...rotation, { type: 'wait', durationMs: 1000 }],
      config: { ...config, specialization: 'Luminary' }
    });
    const series = buildChartSeries(result);
    assert.deepEqual(result.warnings, []);
    for (const name of expected) {
      const boon = result.resolvedEvents.find((event) => event.type === 'buff' && event.kind === name.toLowerCase());
      const unscaled = baseline.resolvedEvents.find(
        (event) => event.type === 'buff' && event.kind === name.toLowerCase()
      );
      assert.equal(boon.stacks, unscaled.stacks, name);
      assert.equal(boon.duration, unscaled.duration * 1.5, name);
      assert.equal(boon.resolvedAudience.includesSelf, true, name);
      assert.equal(series.effectTypes[name], 'boon', name);
      assert.ok(
        series.effects[name].some((point) => point.v > 0),
        name
      );
    }
  }
});

test('Radiant Resolve empowers only the next completed staff equip', () => {
  for (const empowered of [false, true]) {
    const result = simulateGw2({
      profession: guardianProfession,
      rotation: [
        ...(empowered ? ['Radiant Resolve'] : []),
        'Enter Radiant Forge',
        'Dazzling Hammer',
        'Luminous Staff',
        'Restorative Glow',
        'Luminous Staff'
      ],
      config: { ...config, specialization: 'Luminary' }
    });
    const regeneration = result.resolvedEvents.filter(
      (event) => event.type === 'buff' && event.kind === 'regeneration'
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(regeneration.length, empowered ? 1 : 0);
    assert.equal(result.endState.profession.radiantResolveArmed, false);
  }

  const interrupted = simulateGw2({
    profession: guardianProfession,
    rotation: ['Radiant Resolve', 'Enter Radiant Forge', { name: 'Luminous Staff', interruptMs: 100 }],
    config: { ...config, specialization: 'Luminary' }
  });
  assert.equal(interrupted.endState.profession.radiantResolveArmed, true);
  assert.equal(
    interrupted.resolvedEvents.some((event) => event.type === 'buff' && event.kind === 'regeneration'),
    false
  );
});

test('Righteous Instincts Might reaches the chart without duplicating scheduled Resolution', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Symbol of Resolution', { type: 'wait', durationMs: 2000 }],
    config: {
      ...config,
      specialization: 'Luminary',
      primaryWeapon: 'Greatsword',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS]
    }
  });
  const series = buildChartSeries(result, 500);
  assert.equal(series.effectTypes.Might, 'boon');
  assert.equal(series.effects.Might[0].v, 1);
  assert.equal(series.effects.Might[1].v, 1);
  assert.equal(series.effects.Resolution[0].v, 1);
});

test('Resplendent Weaponry grants scaled party boons only on traited, completed weapon equips', () => {
  for (const traited of [false, true]) {
    for (const weapon of ['Dazzling Hammer', 'Luminous Staff', 'Gleaming Blade', 'Radiant Bulwark']) {
      const result = simulateGw2({
        profession: guardianProfession,
        rotation: ['Enter Radiant Forge', weapon, { type: 'wait', durationMs: 1000 }],
        config: {
          ...config,
          specialization: 'Luminary',
          stats: { ...config.stats, concentration: 750 },
          allies: { count: 4 },
          selectedTraitIds: traited ? [GUARDIAN_TRAIT_IDS.RESPLENDENT_WEAPONRY] : []
        }
      });
      const boons = result.resolvedEvents.filter(
        (event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.RESPLENDENT_WEAPONRY
      );
      assert.deepEqual(
        boons.map((event) => [event.kind, event.stacks, event.duration]),
        traited
          ? [
              ['alacrity', 1, 6],
              ['might', 1, 12],
              ['fury', 1, 7.5]
            ]
          : [],
        weapon
      );
      assert.ok(
        boons.every((event) => event.resolvedAudience.recipientCount === 5),
        weapon
      );
      const series = buildChartSeries(result);
      assert.equal(series.effectTypes.Alacrity, traited ? 'boon' : undefined, weapon);
      if (traited)
        assert.ok(
          series.effects.Alacrity.some((point) => point.v > 0),
          weapon
        );
    }
  }

  // Flip attacks reuse the equipped weapon; cancelled casts never finish equipping it.
  for (const rotation of [
    ['Enter Radiant Forge', 'Dazzling Hammer', 'Shining Spin'],
    ['Enter Radiant Forge', { name: 'Dazzling Hammer', interruptMs: 100 }]
  ]) {
    const result = simulateGw2({
      profession: guardianProfession,
      rotation,
      config: { ...config, specialization: 'Luminary', selectedTraitIds: [GUARDIAN_TRAIT_IDS.RESPLENDENT_WEAPONRY] }
    });
    assert.equal(
      result.events.filter((event) => event.type === 'buff' && event.kind === 'alacrity').length,
      rotation.length === 3 ? 1 : 0
    );
  }
});

test('Luminary chart labels radiant weapons and replaces the previous armament', () => {
  const radiantBuff = (at, radiantWeapon) => ({
    type: 'buff',
    at,
    kind: 'guardian-radiant-armaments',
    metadata: { radiantWeapon },
    duration: 10,
    resolvedAudience: PLAYER_AUDIENCE
  });
  const effectPresentations = guardianProfession.ui.effectPresentations({
    specialization: 'Luminary',
    catalog: guardianProfession.catalog
  });
  const series = buildChartSeries(
    {
      duration: 4,
      events: [radiantBuff(0, 'hammer'), radiantBuff(2, 'staff')]
    },
    1000,
    effectPresentations
  );

  assert.equal(series.effects['Radiant Armaments (Hammer)'][0].v, 1);
  assert.equal(series.effects['Radiant Armaments (Hammer)'][2].v, 0);
  assert.equal(series.effects['Radiant Armaments (Staff)'][2].v, 1);
});

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
  // Sword alternates fast/slow/fast; the cadence is independent of its numerical cast tuning.
  const durations = swordActions.map((event) => event.endsAt - event.at);
  assert.ok(durations[0] < durations[1]);
  assert.ok(Math.abs(durations[0] - durations[2]) < 1e-9);
  assert.ok(
    swordDamage.every((event, index) => event.at >= swordActions[index].at && event.at <= swordActions[index].endsAt)
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
  const assertProfile = (skillName, profileId) => {
    const hits = hitsFor(skillName);

    assert.ok(hits.length > 0, skillName);
    assert.ok(
      hits.every((event) => event.weaponStrengthProfileId === profileId),
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
    assertProfile(skillName, 'transform.radiant-forge');
  }

  assertProfile('Glaring Burst', 'transform.radiant-forge');
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

  // Reduced recharge applies to both an unused Forge and a single equipped weapon.
  const unused = rechargeAfter([]);
  const single = rechargeAfter(['Dazzling Hammer']);
  const multiple = rechargeAfter(['Dazzling Hammer', 'Luminous Staff']);
  assert.ok(unused > 0);
  assert.equal(unused, single);
  assert.ok(single < multiple);
});

test('Radiant Forge expiry starts the same reduced recharge as manual exit', () => {
  const run = (rotation) =>
    simulateGw2({ profession: guardianProfession, rotation, config: { ...config, specialization: 'Luminary' } });
  const entered = run(['Enter Radiant Forge']);
  const expiresAt = entered.endState.profession.radiantForgeEndsAt;
  const expired = run(['Enter Radiant Forge', { type: 'wait', durationMs: expiresAt * 1000 }]);
  const manual = run(['Enter Radiant Forge', 'Exit Radiant Forge']);
  const exit = expired.events.find((event) => event.type === 'weapon_set' && event.automatic);
  assert.deepEqual(expired.warnings, []);
  assert.equal(exit.at, expiresAt);
  assert.equal(expired.endState.profession.radiantForge, false);
  assert.equal(
    expired.endState.cooldowns['Enter Radiant Forge'].remaining,
    manual.endState.cooldowns['Enter Radiant Forge'].remaining
  );
});

test('Forge transitions and weapon equips trigger swap sigils only in combat', () => {
  // Entry, manual/automatic exit, and weapon equip count as swaps; flip attacks do not.
  const run = (rotation) =>
    simulateGw2({
      profession: guardianProfession,
      rotation,
      config: {
        ...config,
        specialization: 'Luminary',
        sigilSets: [{ names: ['Hydromancy', 'Geomancy'] }, { names: [] }]
      }
    });
  const idle = run(['Enter Radiant Forge']);
  assert.equal(
    idle.procSteps.some((step) => step.type === 'sigil_proc'),
    false
  );
  const expiryMs = idle.endState.profession.radiantForgeEndsAt * 1000;
  for (const [rotation, expectedSources] of [
    [
      ['Enter Radiant Forge', 'Exit Radiant Forge', 'Enter Radiant Forge', 'Exit Radiant Forge', 'Enter Radiant Forge'],
      ['Enter Radiant Forge', 'Enter Radiant Forge']
    ],
    [
      ['Enter Radiant Forge', { type: 'wait', durationMs: 10000 }, 'Exit Radiant Forge'],
      ['Enter Radiant Forge', 'Exit Radiant Forge']
    ],
    [
      ['Enter Radiant Forge', { type: 'wait', durationMs: expiryMs }],
      ['Enter Radiant Forge', 'Exit Radiant Forge']
    ],
    [
      ['Enter Radiant Forge', { type: 'wait', durationMs: 10000 }, 'Dazzling Hammer', 'Shining Spin'],
      ['Enter Radiant Forge', 'Dazzling Hammer']
    ]
  ]) {
    const result = run(['__combat_start', ...rotation, { type: 'wait', durationMs: 1000 }]);
    const swaps = result.events.filter((event) => event.type === 'weapon_set' || event.type === 'sigil_swap');
    assert.deepEqual(result.warnings, []);
    assert.ok(swaps.length > 0);
    assert.ok(swaps.every((event) => event.weaponSet === 1));
    for (const name of ['Hydromancy', 'Geomancy']) {
      const procs = result.procSteps.filter((step) => step.skill === `Sigil of ${name}`);
      assert.deepEqual(
        procs.map((step) => step.sourceSkill),
        expectedSources
      );
      assert.ok(
        procs.every((proc) =>
          swaps.some((event) => event.skillName === proc.sourceSkill && Math.abs(event.at * 1000 - proc.start) <= 1)
        )
      );
    }

    assert.ok(
      result.resolvedEvents.some(
        (event) => event.skillName === 'Sigil of Geomancy' && event.condition === 'Bleeding' && event.damage > 0
      )
    );
  }
});

test('Radiant Armaments enhances hammer strikes and is replaced by staff', () => {
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

  assert.ok(
    Math.abs(damage(defiantAfterDaze, 'Shining Spin').damage / damage(ordinaryAfterDaze, 'Shining Spin').damage - 1) <
      1e-9
  );
  // Hammer gains its armament before the first impact; selecting staff removes it before any staff pulse.
  assert.ok(Math.abs(dazzling.damage / damage(empowered, 'Dazzling Hammer').damage - 1.07) < 1e-9);
  assert.ok(Math.abs(shining.damage / damage(empowered, 'Shining Spin').damage - 1.17 / 1.1) < 1e-9);
  const armamentStaff = armaments.resolvedEvents.filter((event) => event.name === 'Luminous Staff — Symbol Damage');
  const empoweredStaff = empowered.resolvedEvents.filter((event) => event.name === 'Luminous Staff — Symbol Damage');

  assert.equal(
    armamentStaff.every((event, index) => Math.abs(event.damage / empoweredStaff[index].damage - 1) < 1e-9),
    true
  );
  assert.ok(armamentStaff.length > 0);
  assert.deepEqual(
    armaments.procSteps.filter((step) => step.skill === 'Empowered Armaments').map((step) => step.detail),
    ['triggered', 'refreshed']
  );
  assert.equal(
    armaments.procSteps.filter((step) => step.skill === 'Radiant Armaments')[1].detail,
    'staff: hammer bonus removed'
  );
});

test('Radiant-weapon traits require a committed equip cast', () => {
  const run = (radiantWeapon) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: ['Enter Radiant Forge', radiantWeapon, { type: 'wait', durationMs: 10 }],
      config: {
        ...config,
        specialization: 'Luminary',
        selectedTraitIds: [GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS, GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS]
      }
    });
  const completed = run('Dazzling Hammer');
  const interrupted = run({ name: 'Dazzling Hammer', interruptMs: 1 });

  assert.equal(completed.procSteps.filter((step) => step.skill === 'Empowered Armaments').length, 1);
  assert.equal(interrupted.procSteps.filter((step) => step.skill === 'Empowered Armaments').length, 0);
  assert.equal(completed.procSteps.filter((step) => step.skill === 'Radiant Armaments').length, 1);
  assert.equal(interrupted.procSteps.filter((step) => step.skill === 'Radiant Armaments').length, 0);
  assert.deepEqual(completed.endState.profession.radiantWeaponsUsed, { hammer: true });
  assert.deepEqual(interrupted.endState.profession.radiantWeaponsUsed, {});
});

test('a committed radiant weapon cancel arms and consumes its flip while an uncommitted attempt does not', () => {
  // Exercise the state transition using the catalog's cutoff, without pinning its numerical tuning.
  const hammer = guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.DAZZLING_HAMMER);
  const run = (interruptMs) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: ['Enter Radiant Forge', { name: hammer.name, interruptMs }, 'Shining Spin'],
      config: { ...config, specialization: 'Luminary', selectedTraitIds: [GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS] }
    });
  const committed = run(hammer.interruptCommitMs);
  assert.deepEqual(committed.warnings, []);
  assert.equal(committed.endState.profession.radiantWeapon, 'hammer');
  assert.equal(committed.endState.profession.radiantWeaponsUsed.hammer, true);
  assert.equal(committed.endState.profession.availableFlips[GUARDIAN_SKILL_IDS.SHINING_SPIN], undefined);
  assert.ok(committed.procSteps.some((step) => step.skill === 'Empowered Armaments'));
  assert.ok(committed.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Shining Spin'));
  const cancelled = run(0);
  assert.ok(cancelled.warnings.some((warning) => warning.includes('Shining Spin')));
  assert.equal(cancelled.endState.profession.radiantWeaponsUsed.hammer, undefined);
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

test('Radiant Justice selects the first committed hammer impact after activation', () => {
  const run = (rotation) =>
    simulateGw2({
      profession: guardianProfession,
      rotation,
      config: { ...config, specialization: 'Luminary', boons: { quickness: true } }
    });
  const baseline = run(['Enter Radiant Forge', 'Dazzling Hammer']);
  const primary = baseline.resolvedEvents.find((event) => event.name === 'Dazzling Hammer');
  const action = baseline.events.find(
    (event) => event.type === 'action' && event.skillId === GUARDIAN_SKILL_IDS.DAZZLING_HAMMER
  );
  const impactOffsetMs = Math.round((primary.at - action.at) * 1000);
  // Exercise both sides of impact, including Justice used after impact but before the cast finishes.
  for (const [offset, selectedIndex] of [
    [impactOffsetMs - 80, 0],
    [impactOffsetMs + 20, 1]
  ]) {
    const result = run([
      'Enter Radiant Forge',
      'Dazzling Hammer',
      { name: 'Radiant Justice', offset },
      { type: 'wait', durationMs: 1000 },
      'Dazzling Hammer',
      { type: 'wait', durationMs: 1000 }
    ]);
    const primaries = result.resolvedEvents.filter((event) => event.name === 'Dazzling Hammer');
    const extras = result.resolvedEvents.filter((event) => event.name === 'Dazzling Hammer — Radiant Justice Impact');
    assert.equal(extras.length, 1);
    assert.equal(extras[0].activationId, primaries[selectedIndex].activationId);
    assert.ok(extras[0].at > primaries[selectedIndex].at);
    assert.equal(result.endState.profession.radiantJusticeArmed, false);
    assert.deepEqual(result.warnings, []);
  }

  const cancelled = run([
    'Radiant Justice',
    'Enter Radiant Forge',
    { name: 'Dazzling Hammer', interruptMs: 0 },
    'Dazzling Hammer',
    { type: 'wait', durationMs: 1000 }
  ]);
  const committed = cancelled.resolvedEvents.find((event) => event.name === 'Dazzling Hammer');
  const extra = cancelled.resolvedEvents.find((event) => event.name === 'Dazzling Hammer — Radiant Justice Impact');
  assert.equal(extra.activationId, committed.activationId);
  // A miss still spends the one-use empowerment; deferred emission must retain the off-target cast's ownership.
  const offTarget = run([
    'Radiant Justice',
    'Enter Radiant Forge',
    { name: 'Dazzling Hammer', offTarget: true },
    'Dazzling Hammer',
    { type: 'wait', durationMs: 1000 }
  ]);
  const missedExtra = offTarget.events.find((event) => event.name === 'Dazzling Hammer — Radiant Justice Impact');
  assert.equal(missedExtra.offTarget, true);
  assert.equal(
    offTarget.resolvedEvents.some((event) => event.name === missedExtra.name && event.damage > 0),
    false
  );
  assert.equal(offTarget.endState.profession.radiantJusticeArmed, false);
});

test('Guardian strike modifiers use their tested additive and mult buckets', () => {
  const run = (selectedTraitIds) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: ['Symbol of Resolution', { type: 'wait', durationMs: 1500 }],
      config: {
        ...config,
        // Keep both boon-gated modifiers active so this test isolates damage bucket arithmetic from application order.
        boons: { fury: true, resolution: true },
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

test('Piercing Stance applies its bonus to its first strike without stacking damage on refresh', () => {
  // Compare the skill's own formula with the bonus, both before and after an existing stance application.
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Piercing Stance', 'Piercing Stance'],
    config: { ...config, specialization: 'Luminary' }
  });
  const hits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.PIERCING_STANCE
  );
  assert.equal(hits.length, 2);
  for (const hit of hits) {
    const unmodified =
      ((hit.coefficient * config.stats.power * hit.resolvedWeaponStrength) / config.target.armor) *
      (1 + hit.criticalChance * (hit.criticalDamage - 1));
    assert.ok(Math.abs(hit.damage / unmodified - 1.1) < 1e-9);
  }

  assert.deepEqual(result.warnings, []);
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
  // Refresh adds another full duration to the existing expiry instead of resetting it.
  assert.ok(
    Math.abs(piercingBuffs[1].at + piercingBuffs[1].duration - (piercingBuffs[0].at + 2 * piercingBuffs[0].duration)) <
      1e-9
  );
  assert.ok(piercingBuffs[1].at > piercingBuffs[0].at);
  assert.ok(quickPiercingBuff.at >= quickPiercingAction.at && quickPiercingBuff.at <= quickPiercingAction.endsAt);
  assert.ok(quickPiercingPackets.every((event) => Math.abs(event.at - quickPiercingBuff.at) < 1e-9));
  assert.equal(
    daringThenPiercing.resolvedEvents.find((event) => event.skillName === 'Daring Advance').damage,
    daringImpact.damage
  );
  assert.equal(daringBuff.at, daringImpact.at);
  assert.equal(daringImpact.damage, unmodifiedDaringDamage);
  assert.ok(piercing.procSteps.some((step) => step.skill === 'Relic of the Claw'));
  assert.equal(
    daring.events.some((event) => event.type === 'control' && event.skillName === 'Daring Advance'),
    false
  );
  assert.equal(daringBuff.duration, 8);
  const stance = effulgent.events.find((event) => event.type === 'action' && event.skillName === 'Effulgent Stance');
  assert.ok(effulgentDamage.at > stance.endsAt);
  assert.equal(effulgentDamage.stackCount, 10);
  assert.equal(effulgentDamage.coefficient, 4);
  assert.equal(effulgentDamage.weaponStrengthProfileId, 'nonweapon.unequipped');
  assert.equal(effulgentDamage.weaponStrengthSampled, false);
  assert.equal(procChargedEffulgent.stackCount, 2);
  assert.ok(Math.abs(procChargedEffulgent.coefficient - 1.2) < 1e-9);
  assert.ok(
    effulgent.procSteps.some(
      (step) => step.skill === 'Relic of the Claw' && step.start === Math.round(effulgentDamage.at * 1000)
    )
  );
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

test('Luminary hidden actions restore supplied opening-state durations', () => {
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

  assert.equal(buffDuration('resolution'), durations.resolution / 1000);
  assert.equal(buffDuration('guardian-empowered-armaments'), durations.empoweredArmaments / 1000);
  assert.equal(buffDuration('guardian-radiant-armaments'), durations.radiantHammer / 1000);
  assert.equal(claw.expiresAt, durations.claw);
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
  const daring = simulate(['Daring Advance', 'Leap of Faith']);
  const daringBound = simulate(['Symbol of Resolution', 'Daring Advance']);
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
      combo(daringBound, 'Daring Advance'),
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
  // Daring's field remains available to a subsequent finisher, while its own leap needs another field.
  assert.equal(combo(daring, 'Daring Advance'), undefined);
  assert.equal(combo(daring, 'Leap of Faith').fieldSourceId, GUARDIAN_SKILL_IDS.DARING_ADVANCE);
  assert.ok(dazzlingBound.endState.profession.lightAuraUntil > 0);
});

test('Dazzling Hammer combos at the Symbol of Resolution expiry boundary', () => {
  const run = (waitMs) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: [
        'Symbol of Resolution',
        { type: 'wait', durationMs: waitMs },
        'Enter Radiant Forge',
        'Dazzling Hammer'
      ],
      config: { ...config, specialization: 'Luminary', primaryWeapon: 'Greatsword', boons: { quickness: true } }
    });
  const baseline = run(0);
  const field = baseline.events.find((event) => event.type === 'combo_field');
  const impact = baseline.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Dazzling Hammer'
  );
  // Schedule impact on the final whole millisecond of the field's active window.
  const result = run(Math.floor((field.expiresAt - impact.at) * 1000));
  const combo = result.resolvedEvents.find((event) => event.type === 'combo' && event.skillName === 'Dazzling Hammer');
  assert.deepEqual(result.warnings, []);
  assert.ok(Math.abs(combo.at - field.expiresAt) < 0.001);
  assert.deepEqual([combo.fieldType, combo.finisherType], ['Light', 'Blast']);
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

test('Sovereign of Light receives fresh Piercing Stance but not fresh Daring Advance', () => {
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
  // Piercing's buff precedes its aura detonation; refreshing the stance must not multiply its bonus again.
  assert.ok(Math.abs(sovereignDamage(freshPiercing) / unmodifiedDamage - 1.1) < 1e-12);
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

  // Lesser Symbol of Blades appears during Hammer's cast, supplying its impact aura for Resolve.
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'combo' && event.skillName === 'Dazzling Hammer'),
    true
  );
  assert.deepEqual(
    result.resolvedEvents.filter((event) => event.name === 'Sovereign of Light').map((event) => event.triggeredBy),
    ['Effulgent Stance', 'Radiant Justice', 'Dazzling Hammer', 'Radiant Resolve', 'Shining Spin']
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

  // Each trait shortens the intended family's wait without asserting its current base cooldown.
  const secondCast = (result, name) => result.steps.filter((step) => step.skill === name)[1].start;
  for (const result of [withMaster, withoutMaster, withInspiration, withoutInspiration])
    assert.deepEqual(result.warnings, []);
  assert.ok(secondCast(withMaster, 'Dazzling Hammer') < secondCast(withoutMaster, 'Dazzling Hammer'));
  assert.ok(secondCast(withInspiration, 'Radiant Justice') < secondCast(withoutInspiration, 'Radiant Justice'));
});
