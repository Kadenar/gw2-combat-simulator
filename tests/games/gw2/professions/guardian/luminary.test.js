import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { displayedSkillTiles } from '#gw2/app/rotation/palette/model.js';
import { buildChartSeries } from '#gw2/app/results/model.js';
import { createLiveProfessionSimulator, runtimeFor } from '#tests/helpers/live-runtime.js';
import { guardianCatalog, guardianProfession } from '#gw2/professions/guardian/profession.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { LUMINARY_INITIAL_STATE_SKILL_IDS } from '#gw2/professions/guardian/specializations/luminary/skills/index.js';

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

// The shared exit path exempts precombat manual exits and expiry, while preserving combat recharge.
test('Radiant Forge precombat exits leave entry ready', () => {
  const run = (rotation) =>
    createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Luminary' })(undefined, rotation);
  const precombat = run(['Enter Radiant Forge', 'Exit Radiant Forge', { type: 'combat-start' }, 'Enter Radiant Forge']);
  assert.deepEqual(precombat.warnings, []);
  assert.equal(
    precombat.steps.filter((step) => step.skill === 'Enter Radiant Forge').at(-1).start / 1000,
    precombat.combatStartTime
  );
  for (const prefix of [[], [{ type: 'combat-start' }]]) {
    const combat = run([...prefix, 'Enter Radiant Forge', 'Exit Radiant Forge']);
    assert.ok(combat.planningState.cooldowns['Enter Radiant Forge'].remaining > 0);
  }

  const expired = run(['Enter Radiant Forge', { type: 'wait', durationMs: 30000 }, { type: 'combat-start' }]);
  assert.equal(expired.planningState.cooldowns['Enter Radiant Forge'], undefined);
});

// Reductions cap at readiness and leave unrelated or already-ready cooldowns alone.
test('Illuminating Inspiration delegates capped reductions for the three radiant virtues', () => {
  const ids = GUARDIAN_SKILL_IDS;
  for (const enabled of [false, true]) {
    const result = runGuardian(
      ['Enter Radiant Forge', 'Dazzling Hammer', { type: 'wait', durationMs: 1 }],
      { specialization: 'Luminary', selectedTraitIds: enabled ? [GUARDIAN_TRAIT_IDS.ILLUMINATING_INSPIRATION] : [] },
      (runtime) => {
        for (const [id, work] of [
          [ids.RADIANT_JUSTICE, 20],
          [ids.RADIANT_RESOLVE, 2],
          [ids.RADIANT_COURAGE, 0],
          [ids.PIERCING_STANCE, 99]
        ]) {
          runtime.cooldowns.set(id, work);
          runtime.rechargeProgress.set(id, { startedAt: 0, work });
        }
      }
    );
    const runtime = runtimeFor(result);
    assert.ok(Math.abs(runtime.cooldowns.get(ids.RADIANT_JUSTICE) - (enabled ? 16 : 20)) < 1e-9);
    assert.equal(runtime.cooldowns.get(ids.RADIANT_RESOLVE), enabled ? runtime.time : 2);
    assert.equal(runtime.cooldowns.get(ids.RADIANT_COURAGE), 0);
    assert.equal(runtime.cooldowns.get(ids.PIERCING_STANCE), 99);
  }
});

test('committed disc cancellation preserves the illuminated shock wave', () => {
  // Verify persistence and enhancement on the same delayed packet, without pinning timing metadata.
  const disc = guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.GLEAMING_DISC);
  const run = (illuminated, interruptMs) =>
    createLiveProfessionSimulator(guardianProfession, { ...config, boons: { quickness: true } })(undefined, [
      ...(illuminated ? ['Symbol of Luminance'] : []),
      { name: disc.name, interruptMs },
      { type: 'wait', durationMs: 1000 }
    ]);
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
  const result = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    boons: { quickness: true },
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
  })(undefined, [
    'Symbol of Resolution',
    'Enter Radiant Forge',
    { name: hammer.name, interruptMs: hammer.interruptCommitMs },
    'Shining Spin'
  ]);
  const action = result.events.find((event) => event.type === 'action' && event.skillId === hammer.id);
  const combo = result.resolvedEvents.find((event) => event.type === 'combo' && event.skillId === hammer.id);
  assert.ok(combo.at > action.endsAt);
  assert.ok(
    result.resolvedEvents.some((event) => event.name === 'Sovereign of Light' && event.triggeredBy === 'Shining Spin')
  );
  assert.deepEqual(result.warnings, []);
});

test('Dazzling Hammer grants precombat Light Aura for the next in-combat Sovereign detonation', () => {
  // Off-target setup must grant the hammer aura without recording its precombat damage.
  const result = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
  })(undefined, [
    'Enter Radiant Forge',
    { name: 'Luminous Staff', offTarget: true },
    { name: 'Dazzling Hammer', offTarget: true },
    { type: 'wait', durationMs: 500 },
    { type: 'combat-start' },
    'Daring Advance'
  ]);
  const combo = result.resolvedEvents.find(
    (event) => event.type === 'combo' && event.skillId === GUARDIAN_SKILL_IDS.DAZZLING_HAMMER
  );
  assert.ok(combo.at < result.combatStartTime);
  const detonation = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.name === 'Sovereign of Light' && event.triggeredBy === 'Daring Advance'
  );
  assert.ok(detonation.damage > 0);
  assert.ok(detonation.at >= result.combatStartTime);
  assert.ok(
    result.resolvedEvents
      .filter((event) => event.type === 'damage')
      .every((event) => event.at >= result.combatStartTime)
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
    const result = createLiveProfessionSimulator(guardianProfession, {
      ...config,
      specialization: 'Luminary',
      stats: { ...config.stats, concentration: 750 }
    })(undefined, [...rotation, { type: 'wait', durationMs: 1000 }]);
    const baseline = createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Luminary' })(
      undefined,
      [...rotation, { type: 'wait', durationMs: 1000 }]
    );
    const series = buildChartSeries(result);
    assert.deepEqual(result.warnings, []);
    for (const name of expected) {
      const boon = result.resolvedEvents.find((event) => event.type === 'buff' && event.kind === name.toLowerCase());
      const unscaled = baseline.resolvedEvents.find(
        (event) => event.type === 'buff' && event.kind === name.toLowerCase()
      );
      assert.equal(boon.stacks, unscaled.stacks, name);
      // Both runs round independently after scaling, allowing only their millisecond rounding difference.
      assert.ok(Math.abs(boon.duration - unscaled.duration * 1.5) < 0.001, name);
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
    const result = createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Luminary' })(
      undefined,
      [
        ...(empowered ? ['Radiant Resolve'] : []),
        'Enter Radiant Forge',
        'Dazzling Hammer',
        'Luminous Staff',
        'Restorative Glow',
        'Luminous Staff'
      ]
    );
    const regeneration = result.resolvedEvents.filter(
      (event) => event.type === 'buff' && event.kind === 'regeneration'
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(regeneration.length, empowered ? 1 : 0);
    assert.equal(result.planningState.profession.radiantResolveArmed, false);
  }

  const interrupted = createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Luminary' })(
    undefined,
    ['Radiant Resolve', 'Enter Radiant Forge', { name: 'Luminous Staff', interruptMs: 100 }]
  );
  assert.equal(interrupted.planningState.profession.radiantResolveArmed, true);
  assert.equal(
    interrupted.resolvedEvents.some((event) => event.type === 'buff' && event.kind === 'regeneration'),
    false
  );
});

test('Righteous Instincts Might continues across Resolution pulses without duplicating boundary ticks', () => {
  const result = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    primaryWeapon: 'Greatsword',
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS]
  })(undefined, ['Symbol of Resolution', { type: 'wait', durationMs: 2000 }]);
  const series = buildChartSeries(result, 500);
  const righteousMight = result.resolvedEvents.filter(
    (event) => event.type === 'buff' && event.skillName === 'Righteous Instincts'
  );
  assert.deepEqual(
    righteousMight.map((event) => event.at),
    [0.2, 1.2, 2.2]
  );
  assert.equal(series.effectTypes.Might, 'boon');
  assert.equal(series.effects.Might[0].v, 1);
  assert.equal(series.effects.Might[1].v, 1);
  assert.equal(series.effects.Resolution[0].v, 1);
});

test('Resplendent Weaponry grants scaled party boons only on traited, completed weapon equips', () => {
  for (const traited of [false, true]) {
    for (const weapon of ['Dazzling Hammer', 'Luminous Staff', 'Gleaming Blade', 'Radiant Bulwark']) {
      const result = createLiveProfessionSimulator(guardianProfession, {
        ...config,
        specialization: 'Luminary',
        stats: { ...config.stats, concentration: 750 },
        allies: { count: 4 },
        selectedTraitIds: traited ? [GUARDIAN_TRAIT_IDS.RESPLENDENT_WEAPONRY] : []
      })(undefined, ['Enter Radiant Forge', weapon, { type: 'wait', durationMs: 1000 }]);
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
    const result = createLiveProfessionSimulator(guardianProfession, {
      ...config,
      specialization: 'Luminary',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.RESPLENDENT_WEAPONRY]
    })(undefined, rotation);
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
      rotationEndTime: 4,
      observationEndTime: 4,
      combatEndTime: 4,
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
  const unavailable = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
  })(undefined, ['Dazzling Hammer']);
  const result = createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Luminary' })(
    undefined,
    ['Enter Radiant Forge', 'Dazzling Hammer', 'Shining Spin', 'Glaring Burst']
  );

  assert.match(unavailable.warnings.join(' '), /Dazzling Hammer is unavailable/);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.radiantForge, true);
  assert.equal(result.planningState.profession.radiantWeapon, 'hammer');
  const glaring = result.resolvedEvents.find((event) => event.skillId === GUARDIAN_SKILL_IDS.GLARING_BURST);

  assert.equal(glaring.metadata?.radiantWeapon, 'hammer');
  assert.equal(Object.hasOwn(result.planningState.cooldowns, 'Enter Radiant Forge'), false);
  assert.ok(result.totalDamage > 0);
});

test('Luminary Forge availability follows skill IDs after display labels change', () => {
  const config = { specialization: 'Luminary' };
  const result = runGuardian(['Enter Radiant Forge'], config);
  const runtime = runtimeFor(result);
  const native = guardianProfession.liveRuntimeFor(config);
  const enter = {
    ...guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.ENTER_RADIANT_FORGE),
    name: 'Renamed forge entry'
  };
  const exit = { ...guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.EXIT_RADIANT_FORGE), name: 'Renamed forge exit' };
  assert.equal(native.availability(runtime, enter).code, 'guardian.radiant-forge-active');
  assert.deepEqual(native.availability(runtime, exit), { ready: true });
});

test('Guardian weapon and Radiant Forge flips occupy one live palette tile', () => {
  const app = {
    skills: guardianCatalog.skills,
    skillById: guardianCatalog.skillsById,
    profession: guardianProfession,
    results: null
  };
  const displayedIdsAfter = (rotation, skillIds, extraConfig = {}) => {
    app.results = createLiveProfessionSimulator(guardianProfession, { ...config, ...extraConfig })(undefined, rotation);

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
  const result = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    boons: { quickness: true }
  })(undefined, [
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
  ]);
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
  const result = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    primaryWeapon: 'Greatsword'
  })(undefined, ['Strike', 'Enter Radiant Forge', 'Exit Radiant Forge', 'Strike']);

  assert.deepEqual(result.warnings, []);
  assert.equal(result.events.filter((event) => event.type === 'action' && event.skillName === 'Strike').length, 2);
});

test('Radiant Forge strikes use its normalized transform weapon strength', () => {
  const result = createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Luminary' })(
    undefined,
    [
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
    ]
  );
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
    const result = createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Luminary' })(
      undefined,
      ['Enter Radiant Forge', ...radiantWeapons, 'Exit Radiant Forge', 'Enter Radiant Forge']
    );
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
    createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Luminary' })(undefined, rotation);
  const entered = run(['Enter Radiant Forge']);
  const expiresAt = entered.planningState.profession.radiantForgeEndsAt;
  const expired = run(['Enter Radiant Forge', { type: 'wait', durationMs: expiresAt * 1000 }]);
  const manual = run(['Enter Radiant Forge', 'Exit Radiant Forge']);
  const exit = expired.events.find((event) => event.type === 'weapon_set' && event.automatic);
  assert.deepEqual(expired.warnings, []);
  assert.equal(exit.at, expiresAt);
  assert.equal(expired.planningState.profession.radiantForge, false);
  assert.equal(
    expired.planningState.cooldowns['Enter Radiant Forge'].remaining,
    manual.planningState.cooldowns['Enter Radiant Forge'].remaining
  );
});

test('Forge transitions and weapon equips trigger swap sigils only in combat', () => {
  // Entry, manual/automatic exit, and weapon equip count as swaps; flip attacks do not.
  const run = (rotation) =>
    createLiveProfessionSimulator(guardianProfession, {
      ...config,
      specialization: 'Luminary',
      sigilSets: [{ names: ['Hydromancy', 'Geomancy'] }, { names: [] }]
    })(undefined, rotation);
  const idle = run(['Enter Radiant Forge']);
  assert.equal(
    idle.procSteps.some((step) => step.type === 'sigil_proc'),
    false
  );
  const expiryMs = idle.planningState.profession.radiantForgeEndsAt * 1000;
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
  const empowered = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS]
  })(undefined, rotation);
  const armaments = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS, GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS]
  })(undefined, rotation);
  const damage = (result, name) => result.resolvedEvents.find((event) => event.name === name);
  const dazzling = damage(armaments, 'Dazzling Hammer');
  const shining = damage(armaments, 'Shining Spin');
  const defiantAfterDaze = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    target: { ...config.target, defiant: true }
  })(undefined, ['Enter Radiant Forge', 'Dazzling Hammer', 'Shining Spin']);
  const ordinaryAfterDaze = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary'
  })(undefined, ['Enter Radiant Forge', 'Dazzling Hammer', 'Shining Spin']);

  assertFlooredDamageMultiplier(
    damage(defiantAfterDaze, 'Shining Spin').damage,
    damage(ordinaryAfterDaze, 'Shining Spin').damage,
    1.2
  );
  // Hammer gains its armament before the first impact; selecting staff removes it before any staff pulse.
  assertFlooredDamageMultiplier(dazzling.damage, damage(empowered, 'Dazzling Hammer').damage, 1.07);
  assertFlooredDamageMultiplier(shining.damage, damage(empowered, 'Shining Spin').damage, 1.17 / 1.1);
  const armamentStaff = armaments.resolvedEvents.filter((event) => event.name === 'Luminous Staff — Symbol Damage');
  const empoweredStaff = empowered.resolvedEvents.filter((event) => event.name === 'Luminous Staff — Symbol Damage');

  assert.equal(
    armamentStaff.every((event, index) => Math.abs(event.damage / empoweredStaff[index].damage - 1) < 1e-9),
    true
  );
  assert.ok(armamentStaff.length > 0);
  assert.deepEqual(
    armaments.procSteps.filter((step) => step.skill === 'Empowered Armaments').map((step) => step.detail),
    ['Radiant weapon equipped', 'Radiant weapon equipped']
  );
  assert.equal(armaments.procSteps.filter((step) => step.skill === 'Radiant Armaments')[1].detail, 'staff');
});

test('Radiant-weapon traits require a committed equip cast', () => {
  const run = (radiantWeapon) =>
    createLiveProfessionSimulator(guardianProfession, {
      ...config,
      specialization: 'Luminary',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS, GUARDIAN_TRAIT_IDS.RADIANT_ARMAMENTS]
    })(undefined, ['Enter Radiant Forge', radiantWeapon, { type: 'wait', durationMs: 10 }]);
  const completed = run('Dazzling Hammer');
  const interrupted = run({ name: 'Dazzling Hammer', interruptMs: 1 });

  assert.equal(completed.procSteps.filter((step) => step.skill === 'Empowered Armaments').length, 1);
  assert.equal(interrupted.procSteps.filter((step) => step.skill === 'Empowered Armaments').length, 0);
  assert.equal(completed.procSteps.filter((step) => step.skill === 'Radiant Armaments').length, 1);
  assert.equal(interrupted.procSteps.filter((step) => step.skill === 'Radiant Armaments').length, 0);
  assert.deepEqual(completed.planningState.profession.radiantWeaponsUsed, { hammer: true });
  assert.deepEqual(interrupted.planningState.profession.radiantWeaponsUsed, {});
});

test('a committed radiant weapon cancel arms and consumes its flip while an uncommitted attempt does not', () => {
  // Exercise the state transition using the catalog's cutoff, without pinning its numerical tuning.
  const hammer = guardianCatalog.skillsById.get(GUARDIAN_SKILL_IDS.DAZZLING_HAMMER);
  const run = (interruptMs) =>
    createLiveProfessionSimulator(guardianProfession, {
      ...config,
      specialization: 'Luminary',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.EMPOWERED_ARMAMENTS]
    })(undefined, ['Enter Radiant Forge', { name: hammer.name, interruptMs }, 'Shining Spin']);
  const committed = run(hammer.interruptCommitMs);
  assert.deepEqual(committed.warnings, []);
  assert.equal(committed.planningState.profession.radiantWeapon, 'hammer');
  assert.equal(committed.planningState.profession.radiantWeaponsUsed.hammer, true);
  assert.equal(committed.planningState.profession.availableFlips[GUARDIAN_SKILL_IDS.SHINING_SPIN], undefined);
  assert.ok(committed.procSteps.some((step) => step.skill === 'Empowered Armaments'));
  assert.ok(committed.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Shining Spin'));
  const cancelled = run(0);
  assert.ok(cancelled.warnings.some((warning) => warning.includes('Shining Spin')));
  assert.equal(cancelled.planningState.profession.radiantWeaponsUsed.hammer, undefined);
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
    const result = createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Luminary' })(
      undefined,
      ['Enter Radiant Forge', parent, nextParent]
    );

    assert.equal(result.planningState.profession.availableFlips[flip], undefined, parent);
    assert.ok(result.planningState.profession.availableFlips[nextFlip], nextParent);
    assert.ok(result.planningState.cooldowns[parent].remaining > 0, parent);
  }

  const glaringBurst = createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Luminary' })(
    undefined,
    ['Enter Radiant Forge', 'Dazzling Hammer', 'Glaring Burst']
  );

  assert.ok(glaringBurst.planningState.profession.availableFlips[GUARDIAN_SKILL_IDS.SHINING_SPIN]);
});

test('Guardian armaments share the additive sigil bucket', () => {
  const rotation = ['Enter Radiant Forge', 'Dazzling Hammer', 'Shining Spin'];
  const run = ({ selectedTraitIds = [], sigilSets = undefined, burning = false } = {}) =>
    createLiveProfessionSimulator(guardianProfession, {
      ...config,
      specialization: 'Luminary',
      selectedTraitIds,
      sigilSets,
      target: {
        ...config.target,
        conditions: burning ? { Burning: true } : {}
      }
    })(undefined, rotation);
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

  assertFlooredDamageMultiplier(shining(sigils), shining(baseline), 1.08);
  assertFlooredDamageMultiplier(shining(armaments), shining(baseline), 1.25);
  assertFlooredDamageMultiplier(shining(conditional), shining(armaments), 1.05);
});

test('Radiant virtues grant one-use hammer and sword empowerments', () => {
  const armedHammer = createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Luminary' })(
    undefined,
    ['Radiant Justice']
  );
  const hammer = createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Luminary' })(
    undefined,
    ['Radiant Justice', 'Enter Radiant Forge', 'Dazzling Hammer', 'Dazzling Hammer']
  );
  const armedSword = createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Luminary' })(
    undefined,
    ['Radiant Courage']
  );
  const sword = createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Luminary' })(
    undefined,
    ['Radiant Courage', 'Enter Radiant Forge', 'Gleaming Blade', 'Gleaming Blade']
  );
  const bladeHits = sword.resolvedEvents.filter((event) => event.name === 'Gleaming Blade');

  assert.equal(armedHammer.planningState.profession.radiantJusticeArmed, true);
  assert.equal(
    hammer.resolvedEvents.filter((event) => event.name === 'Dazzling Hammer — Radiant Justice Impact').length,
    1
  );
  assert.equal(hammer.planningState.profession.radiantJusticeArmed, false);
  assert.ok(
    hammer.procSteps.some(
      (step) =>
        step.type === 'skill_proc' && step.skill === 'Empowered Hammer' && step.sourceSkill === 'Radiant Justice'
    )
  );

  assert.equal(armedSword.planningState.profession.radiantCourageSwordArmed, true);
  assert.equal(bladeHits.length, 2);
  assertFlooredDamageMultiplier(bladeHits[0].damage, bladeHits[1].damage, 1.5);
  assert.equal(sword.planningState.profession.radiantCourageSwordArmed, false);
  assert.ok(
    sword.procSteps.some(
      (step) => step.type === 'skill_proc' && step.skill === 'Empowered Sword' && step.sourceSkill === 'Radiant Courage'
    )
  );
});

test('Radiant Justice selects the first committed hammer impact after activation', () => {
  const run = (rotation) =>
    createLiveProfessionSimulator(guardianProfession, {
      ...config,
      specialization: 'Luminary',
      boons: { quickness: true }
    })(undefined, rotation);
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
    assert.equal(result.planningState.profession.radiantJusticeArmed, false);
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
  const missedExtra = offTarget.resolvedEvents.find(
    (event) => event.name === 'Dazzling Hammer — Radiant Justice Impact'
  );
  assert.equal(missedExtra, undefined);
  assert.equal(
    offTarget.resolvedEvents.some(
      (event) => event.name === 'Dazzling Hammer — Radiant Justice Impact' && event.damage > 0
    ),
    false
  );
  assert.equal(offTarget.planningState.profession.radiantJusticeArmed, false);
});

test('Guardian strike modifiers use their tested additive and mult buckets', () => {
  const run = (selectedTraitIds) =>
    createLiveProfessionSimulator(guardianProfession, {
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
    })(undefined, ['Symbol of Resolution', { type: 'wait', durationMs: 1500 }]);
  const pulse = (result) => result.resolvedEvents.filter((event) => event.name === 'Symbol of Resolution')[0].damage;
  const baseline = run([]);
  const conditional = run([
    GUARDIAN_TRAIT_IDS.FIERY_WRATH,
    GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS,
    GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE,
    GUARDIAN_TRAIT_IDS.RETRIBUTION
  ]);

  assertFlooredDamageMultiplier(pulse(conditional), pulse(baseline), (1.25 / 1.05) * 1.05 * 1.05);
});

test('Piercing Stance applies its bonus to its first strike without stacking damage on refresh', () => {
  // Compare the skill's own formula with the bonus, both before and after an existing stance application.
  const result = createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Luminary' })(
    undefined,
    ['Piercing Stance', 'Piercing Stance']
  );
  const hits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.PIERCING_STANCE
  );
  assert.equal(hits.length, 2);
  for (const hit of hits) {
    const unmodified =
      ((hit.coefficient * config.stats.power * hit.resolvedWeaponStrength) / config.target.armor) *
      (1 + hit.criticalChance * (hit.criticalDamage - 1));
    assertFlooredDamageMultiplier(hit.damage, unmodified, 1.1);
  }

  assert.deepEqual(result.warnings, []);
});

test('Luminary stances apply modifiers, combos, delayed damage, and control', () => {
  const piercing = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    relic: 'Claw'
  })(undefined, ['Piercing Stance', 'Piercing Stance', { type: 'wait', durationMs: 1000 }]);
  const daring = createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Luminary' })(
    undefined,
    ['Daring Advance', { type: 'wait', durationMs: 1000 }]
  );
  const daringThenPiercing = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary'
  })(undefined, ['Daring Advance', 'Piercing Stance', { type: 'wait', durationMs: 1000 }]);
  const quickPiercing = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    boons: { quickness: true }
  })(undefined, ['Piercing Stance']);
  const effulgent = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    primaryWeapon: 'Greatsword',
    relic: 'Claw'
  })(undefined, ['Effulgent Stance', 'Whirling Wrath', { type: 'wait', durationMs: 4000 }]);
  const effulgentWithGuardianProcs = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
  })(undefined, ['Effulgent Stance', 'Enter Radiant Forge', 'Dazzling Hammer', { type: 'wait', durationMs: 4000 }]);
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
  assert.equal(daringImpact.damage, Math.floor(unmodifiedDaringDamage));
  assert.ok(piercing.procSteps.some((step) => step.skill === 'Relic of the Claw'));
  assert.equal(
    daring.events.some((event) => event.type === 'control' && event.skillName === 'Daring Advance'),
    false
  );
  assert.equal(daringBuff.duration, 8);
  const stance = effulgent.events.find((event) => event.type === 'action' && event.skillName === 'Effulgent Stance');
  assert.ok(effulgentDamage.at > stance.endsAt);
  assert.equal(effulgentDamage.coefficient, 4);
  assert.equal(effulgentDamage.weaponStrengthProfileId, 'nonweapon.unequipped');
  assert.equal(effulgentDamage.weaponStrengthSampled, false);
  assert.ok(Math.abs(procChargedEffulgent.coefficient - 1.2) < 1e-9);
  assert.ok(
    effulgent.procSteps.some(
      (step) => step.skill === 'Relic of the Claw' && step.start === Math.round(effulgentDamage.at * 1000)
    )
  );
});

test('off-target Luminary precasts retain setup without damaging the target', () => {
  const result = createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Luminary' })(
    undefined,
    [
      'Enter Radiant Forge',
      { name: 'Luminous Staff', offTarget: true },
      { name: 'Dazzling Hammer', offTarget: true },
      { type: 'wait', durationMs: 4000 }
    ]
  );
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
  assert.equal(result.planningState.profession.radiantWeapon, 'hammer');
  assert.ok(result.combatState.profession.lightAuraUntil > 0);
});

test('Luminary hidden actions restore supplied opening-state durations', () => {
  const durations = {
    resolution: 9_280,
    claw: 8_000,
    empoweredArmaments: 14_514,
    radiantHammer: 7_320
  };
  const result = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    relic: 'Claw'
  })(
    undefined,
    Object.entries(LUMINARY_INITIAL_STATE_SKILL_IDS).map(([kind, skillId]) => ({
      type: 'cast',
      skillId,
      initialStateDurationMs: durations[kind]
    }))
  );
  const buffDuration = (kind) => result.events.find((event) => event.type === 'buff' && event.kind === kind).duration;
  const claw = result.procSteps.find((step) => step.skill === 'Relic of the Claw');

  assert.equal(buffDuration('resolution'), durations.resolution / 1000);
  assert.equal(buffDuration('guardian-empowered-armaments'), durations.empoweredArmaments / 1000);
  assert.equal(buffDuration('guardian-radiant-armaments'), durations.radiantHammer / 1000);
  assert.equal(claw.expiresAt, durations.claw);
});

test('Luminary Light Aura follows resolved combos instead of hardcoded leap casts', () => {
  const simulate = (rotation, selectedTraitIds = []) =>
    createLiveProfessionSimulator(guardianProfession, {
      ...config,
      specialization: 'Luminary',
      primaryWeapon: 'Greatsword',
      selectedTraitIds
    })(undefined, rotation);
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
  assert.equal(dazzlingUnbound.combatState.profession.lightAuraUntil, 0);
  // Daring's field remains available to a subsequent finisher, while its own leap needs another field.
  assert.equal(combo(daring, 'Daring Advance'), undefined);
  assert.equal(combo(daring, 'Leap of Faith').fieldSourceId, GUARDIAN_SKILL_IDS.DARING_ADVANCE);
  assert.ok(dazzlingBound.combatState.profession.lightAuraUntil > 0);
});

test('Dazzling Hammer combos at the Symbol of Resolution expiry boundary', () => {
  const run = (waitMs) =>
    createLiveProfessionSimulator(guardianProfession, {
      ...config,
      specialization: 'Luminary',
      primaryWeapon: 'Greatsword',
      boons: { quickness: true }
    })(undefined, [
      'Symbol of Resolution',
      { type: 'wait', durationMs: waitMs },
      'Enter Radiant Forge',
      'Dazzling Hammer'
    ]);
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
  const result = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    primaryWeapon: 'Greatsword',
    selectedTraitIds: [
      GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS,
      GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND,
      GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT
    ]
  })(undefined, ['Radiant Justice', 'Leap of Faith']);

  // Justice is Blind supplies the first aura; the Light-field leap may refresh it but cannot detonate Sovereign.
  assert.ok(result.resolvedEvents.some((event) => event.type === 'aura' && event.skillName === 'Leap of Faith'));
  assert.equal(
    result.resolvedEvents.some((event) => event.name === 'Sovereign of Light'),
    false
  );
  assert.ok(result.combatState.profession.lightAuraUntil > 0);
});

test('Sovereign of Light consumes combo and trait-granted light auras', () => {
  const sovereignJustice = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
  })(undefined, ['Enter Radiant Forge', 'Dazzling Hammer']);
  const activationJustice = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND, GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
  })(undefined, ['Effulgent Stance', 'Radiant Justice', { type: 'wait', durationMs: 4000 }]);
  const combo = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    primaryWeapon: 'Greatsword',
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
  })(undefined, ['Symbol of Resolution', 'Leap of Faith', 'Enter Radiant Forge', 'Dazzling Hammer']);
  const justice = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND, GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
  })(undefined, ['Piercing Stance', 'Radiant Justice', 'Piercing Stance']);
  const justiceWithClaw = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    relic: 'Claw',
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND, GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
  })(undefined, ['Piercing Stance', 'Radiant Justice', 'Piercing Stance']);
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
  // Activating Radiant Justice disables its passive counter until recharge completes.
  assert.equal(activationJustice.combatState.profession.justiceHitCount, 0);
  const justiceSovereign = justice.resolvedEvents.find((event) => event.name === 'Sovereign of Light');
  const clawSovereign = justiceWithClaw.resolvedEvents.find((event) => event.name === 'Sovereign of Light');

  assert.equal(sovereignJustice.combatState.profession.justiceHitCount, 2);
  assert.deepEqual(
    {
      actorType: clawSovereign.actorType,
      ownerActorType: clawSovereign.ownerActorType
    },
    { actorType: 'effect', ownerActorType: 'player' }
  );
  assertFlooredDamageMultiplier(clawSovereign.damage, justiceSovereign.damage, 1.07);
});

test('Sovereign of Light receives fresh Piercing Stance but not fresh Daring Advance', () => {
  const simulate = (rotation) =>
    createLiveProfessionSimulator(guardianProfession, {
      ...config,
      specialization: 'Luminary',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT]
    })(undefined, rotation);
  const sovereignDamage = (result) => result.resolvedEvents.find((event) => event.name === 'Sovereign of Light').damage;
  const freshDaring = simulate(['Enter Radiant Forge', 'Exit Radiant Forge', 'Daring Advance']);
  const freshPiercing = simulate(['Enter Radiant Forge', 'Exit Radiant Forge', 'Piercing Stance']);
  const activePiercing = simulate(['Piercing Stance', 'Enter Radiant Forge', 'Exit Radiant Forge', 'Piercing Stance']);
  const unmodifiedDamage = ((1.5 * config.stats.power * 690.5) / config.target.armor) * (1 + 0.05 * (1.5 - 1));

  assert.equal(sovereignDamage(freshDaring), Math.floor(unmodifiedDamage));
  // Piercing's buff precedes its aura detonation; refreshing the stance must not multiply its bonus again.
  assertFlooredDamageMultiplier(sovereignDamage(freshPiercing), unmodifiedDamage, 1.1);
  assertFlooredDamageMultiplier(sovereignDamage(activePiercing), unmodifiedDamage, 1.1);
});

test('Sovereign of Light resolves overlapping aura grants and finishers chronologically', () => {
  const result = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    boons: { quickness: true },
    specialization: 'Luminary',
    selectedTraitIds: [
      GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS,
      GUARDIAN_TRAIT_IDS.JUSTICE_IS_BLIND,
      GUARDIAN_TRAIT_IDS.SOVEREIGN_OF_LIGHT
    ]
  })(undefined, [
    'Enter Radiant Forge',
    'Dazzling Hammer',
    { name: 'Effulgent Stance', offset: 240 },
    { name: 'Radiant Justice', offset: 40 },
    'Shining Spin',
    { name: 'Radiant Resolve', offset: 80 }
  ]);

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
  const withMaster = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.MASTER_AT_ARMS]
  })(undefined, masterRotation);
  const withoutMaster = createLiveProfessionSimulator(guardianProfession, { ...config, specialization: 'Luminary' })(
    undefined,
    masterRotation
  );
  const inspirationRotation = [
    'Radiant Justice',
    'Enter Radiant Forge',
    'Dazzling Hammer',
    'Exit Radiant Forge',
    'Radiant Justice'
  ];
  const withInspiration = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary',
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.ILLUMINATING_INSPIRATION]
  })(undefined, inspirationRotation);
  const withoutInspiration = createLiveProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Luminary'
  })(undefined, inspirationRotation);

  // Each trait shortens the intended family's wait without asserting its current base cooldown.
  const secondCast = (result, name) => result.steps.filter((step) => step.skill === name)[1].start;
  for (const result of [withMaster, withoutMaster, withInspiration, withoutInspiration])
    assert.deepEqual(result.warnings, []);
  assert.ok(secondCast(withMaster, 'Dazzling Hammer') < secondCast(withoutMaster, 'Dazzling Hammer'));
  assert.ok(secondCast(withInspiration, 'Radiant Justice') < secondCast(withoutInspiration, 'Radiant Justice'));
});
