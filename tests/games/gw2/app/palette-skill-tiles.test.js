import { planningFixture } from '#tests/helpers/observed-runtime.js';
import { armSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { loadProfession, loadProfessionAppAdapter, professionOptions } from '#gw2/profession-registry.js';
import { createDefaultBuild } from '#gw2/app/build/state/persistence.js';
import { renderPaletteMarkup } from '#tests/helpers/palette.js';
import { displayedSkillTiles } from '#gw2/app/rotation/palette/model.js';
import { paletteAvailability, paletteSkillView } from '#gw2/app/rotation/palette/model.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

function projectionApp(
  profession,
  {
    specialization = 'Core',
    professionState = {},
    time = 0,
    cooldowns = {},
    ammoBySkillId = {},
    useProfessionUi = true
  } = {}
) {
  const build = profession.createBuildDefaults?.() || {};
  return {
    build: {
      ...build,
      rotation: build.rotation || [],
      startingWeaponSet: build.startingWeaponSet || 1
    },
    adapter: { skillTooltip: () => ({ description: '', facts: [] }), eliteSpecialization: () => specialization },
    profession: useProfessionUi ? profession : { catalog: profession.catalog, ui: {} },
    activeCatalog: profession.catalog,
    skills: profession.catalog.skills,
    skillById: profession.catalog.skillsById,
    skillByName: profession.catalog.skillsByName,
    results: {
      planningState: {
        availability: {},
        atSeconds: time,
        activeWeaponSet: 1,
        cooldowns,
        ammoBySkillId,
        profession: professionState
      }
    }
  };
}

// The palette consumes projected deadlines while recharge storage remains in base seconds.
test('a used 20-second skill displays 16 seconds under Alacrity', () => {
  const profession = defineTestProfession({
    id: 'palette-recharge',
    name: 'Palette Recharge',
    catalog: createCanonicalCatalog({
      generated: [{ id: 990020, name: 'Recharge', type: 'Utility', castTimeMs: 0, cooldown: 20, effects: [] }]
    })
  });
  const skill = profession.catalog.skillsById.get(990020);
  for (const [alacrity, label] of [
    [false, '16.000s'],
    [true, '16.000s']
  ]) {
    const result = simulateGw2({ profession, rotation: [skill.name], config: { boons: { alacrity } } });
    const app = projectionApp(profession, {
      time: result.planningState.atSeconds,
      cooldowns: result.planningState.cooldowns
    });
    const view = paletteSkillView(app, skill, true);
    assert.equal(view.cooldownLabel, label);
    assert.equal(view.disabled, true);
    assert.equal(
      result.events.find((event) => event.type === 'action' && event.skillId === skill.id).rechargeProgress.work,
      20
    );
  }
});

// Tiny catalogs keep family expectations independent of the production grouping algorithm.
function catalogApp(skills, professionState = {}) {
  const catalog = {
    skills,
    skillsById: new Map(skills.map((skill) => [skill.id, skill])),
    skillsByName: new Map(skills.map((skill) => [skill.name, skill]))
  };
  return projectionApp({ catalog }, { professionState, useProfessionUi: false });
}

// Startup is unknown; once observed, a missing candidate is a contract failure rather than permission to insert.
test('palette distinguishes startup, missing verdicts, and runtime retry boundaries', () => {
  const skill = { id: 990001, name: 'Candidate', type: 'Utility', effects: [] };
  const app = catalogApp([skill]);
  app.profession.ui.resourceViews = () => [];
  const context = { specialization: 'Core' };
  const observation = app.results;
  app.results = null;
  assert.deepEqual(paletteAvailability(app, context, skill), {
    available: true,
    message: 'Runtime availability has not been evaluated yet.'
  });
  app.results = observation;
  assert.equal(paletteAvailability(app, context, skill).available, false);
  app.results.planningState.availability[skill.id] = {
    ready: false,
    code: 'fixture.wait',
    reason: 'Await a tick.',
    retryAt: 2
  };
  const availability = paletteAvailability(app, context, skill);
  const view = paletteSkillView(app, skill, availability.available, availability.message, availability.retryAt);
  assert.equal(view.contextDisabled, false);
  assert.equal(view.cooldownLabel, 'Retry 2.000s');
  assert.match(view.castDetails, /Retry in: 2\.000s/);
  assert.equal(paletteAvailability(app, context, { ...skill, specialization: 'Bladesworn' }).available, false);
});

// Every rendered surface must retain retry insertion, while weapon placement and loadout vetoes still block it.
test('weapon, action, loadout, and custom weapon tiles preserve runtime retries', async () => {
  for (const [id, name, config, rotation] of [
    ['thief', 'Heartseeker', { initialInitiative: 0, primaryWeapon: 'Dagger', secondaryWeapon: 'Dagger' }, []],
    ['thief', 'Dodge', {}, ['Dodge', 'Dodge']],
    [
      'revenant',
      'Phase Traversal',
      {
        initialEnergy: 0,
        selectedLegends: ['LegendaryAssassin', 'LegendaryDwarf'],
        startingLegend: 'LegendaryAssassin'
      },
      ['__combat_start']
    ],
    [
      'elementalist',
      'Dual Orbits: Fire and Water',
      { specialization: 'Weaver', primaryWeapon: 'Hammer', startAttunement: 'Fire', secondaryAttunement: 'Fire' },
      ['Flame Wheel', 'Water Attunement']
    ]
  ]) {
    const adapter = await loadProfessionAppAdapter(id);
    const profession = adapter.profession;
    const specialization = config.specialization || 'Core';
    const app = {
      ...projectionApp(profession, { specialization }),
      adapter,
      weaponData: adapter.weaponData,
      build: {
        ...createDefaultBuild(adapter),
        ...config,
        specializations: specialization === 'Core' ? [] : [{ name: specialization, traits: '1-1-1' }],
        weapons: [config.primaryWeapon || 'Dagger', config.secondaryWeapon || ''],
        alternateWeapons: ['Dagger', 'Dagger'],
        rotation: []
      },
      results: simulateGw2({ profession, config: { specialization, ...config }, rotation })
    };
    const skill = app.skillByName.get(name);
    const verdict = app.results.planningState.availability[skill.id];
    assert.equal(verdict.ready, false, name);
    assert.ok(verdict.retryAt > app.results.planningState.atSeconds, name);
    const tiles = () => [
      ...renderPaletteMarkup(app).matchAll(new RegExp(`<div[^>]*data-skill-id="${skill.id}"[^>]*>`, 'g'))
    ];
    const tile = tiles()[0]?.[0];
    assert.ok(tile, name);
    assert.doesNotMatch(tile, /pal-context-disabled/, name);
    assert.match(tile, /Retry in:/, name);
    if (name === 'Heartseeker') {
      assert.match(tiles()[1][0], /pal-context-disabled/);
      assert.doesNotMatch(tiles()[1][0], /Retry in:/);
    }

    if (id === 'revenant') {
      app.adapter = {
        ...adapter,
        slotLoadout: { ...adapter.slotLoadout, unavailableReason: () => 'Requires another loadout' }
      };
      assert.match(tiles()[0][0], /pal-context-disabled/);
      assert.doesNotMatch(tiles()[0][0], /Retry in:/);
    }
  }
});

// An active flip keeps its identity even when a resource gate denies its default command.
test('a denied follow-up stays in the shared palette slot', () => {
  const root = { id: 990010, name: 'Root', type: 'Weapon', flipSkillId: 990011 };
  const followup = { id: 990011, name: 'Follow-up', type: 'Weapon', flipParentId: 990010 };
  const app = catalogApp([root, followup], { availableFlips: { [followup.id]: armSkillFlip({}, 0, 0, 10) } });
  app.results.planningState.availability[followup.id] = {
    ready: false,
    code: 'fixture.cost',
    reason: 'Resource depleted.',
    retryAt: null
  };
  assert.deepEqual(
    displayedSkillTiles(app, [root, followup]).map((skill) => skill.id),
    [followup.id]
  );
});

// Command editors can expose valid lower-charge releases while the default maximum-charge command is denied.
test('Dragon Slash editor access is separate from its default verdict and requires an observed candidate', async () => {
  const profession = await loadProfession('warrior');
  const app = projectionApp(profession, { specialization: 'Bladesworn' });
  app.results.planningState = planningFixture(profession, { specialization: 'Bladesworn' }, (runtime) => {
    Object.assign(runtime.profession.specialization.state, {
      gunsaberActive: true,
      dragonTriggerActive: true,
      dragonCharges: 1,
      nextDragonChargeAt: 0
    });
  });
  const skill = profession.catalog.skills.find((skill) => skill.dragonSlash);
  const availability = paletteAvailability(
    app,
    { specialization: 'Bladesworn', professionState: app.results.planningState.profession },
    skill
  );
  assert.equal(availability.available, false);
  assert.equal(paletteSkillView(app, skill, false, availability.message).contextDisabled, false);
  delete app.results.planningState.availability[skill.id];
  assert.equal(paletteSkillView(app, skill, false).contextDisabled, true);
});

for (const [label, skills, states] of [
  [
    'flip pair',
    [
      { id: 1, name: 'Root', flipSkillId: 2 },
      { id: 2, name: 'Flip' }
    ],
    [
      [{}, [1]],
      [{ 2: armSkillFlip({}, 0, 0) }, [2]]
    ]
  ],
  [
    'reciprocal pair',
    [
      { id: 1, name: 'Root', nextChainId: 2 },
      { id: 2, name: 'Flip', nextChainId: 1 }
    ],
    [
      [{}, [1]],
      [{ 2: armSkillFlip({}, 0, 0) }, [2]]
    ]
  ],
  [
    'branching family',
    [
      { id: 1, name: 'Root', flipSkillId: 2 },
      { id: 2, name: 'Left', flipParentId: 1 },
      { id: 3, name: 'Right', flipParentId: 1 }
    ],
    [
      [{}, [1]],
      [{ 2: armSkillFlip({}, 0, 0) }, [2]],
      [{ 3: armSkillFlip({}, 0, 0) }, [3]]
    ]
  ]
]) {
  test(`shared ${label} selects one live tile from the full family or its root alone`, () => {
    for (const [availableFlips, expected] of states) {
      const app = catalogApp(skills, { availableFlips });
      for (const input of [skills, [skills[0]]]) {
        assert.deepEqual(
          displayedSkillTiles(app, input).map((skill) => skill.id),
          expected
        );
      }
    }
  });
}

test('autoattack links, replacements, and excluded flips never expand a root-only tile', () => {
  for (const [label, parent, child] of [
    ['autoattack chain', { chainRoot: 1 }, { chainRoot: 1 }],
    ['weapon bar chain', { weaponBarChainRootId: 1 }, { weaponBarChainRootId: 1 }],
    ['one-way next skill', { nextChainId: 2 }, {}],
    ['ambush', {}, { ambush: true }],
    ['stealth attack', {}, { stealthAttack: true, slot: 'Weapon_1' }],
    ['unleashed ambush', {}, { unleashedAmbushSkill: true }],
    ['parent opt-out', { paletteFlip: false }, {}],
    ['child opt-out', {}, { paletteFlip: false }],
    ['excluded weapon', {}, { simulatorExcluded: true, type: 'Weapon' }]
  ]) {
    const skills = [
      { id: 1, name: 'Root', flipSkillId: 2, ...parent },
      { id: 2, name: 'Excluded', flipParentId: 1, ...child }
    ];
    const app = catalogApp(skills, {
      availableFlips: { 2: armSkillFlip({}, 0, 0, Infinity) },
      autoattackChains: { 1: 2 }
    });
    assert.deepEqual(
      displayedSkillTiles(app, [skills[0]]).map((skill) => skill.id),
      [1],
      label
    );
  }
});

test('every profession catalog projects tiles and active autoattack stages', async () => {
  let autoattackFamilyCount = 0;

  for (const option of professionOptions) {
    const profession = await loadProfession(option.id);
    const baseApp = projectionApp(profession, { useProfessionUi: false });
    assert.ok(displayedSkillTiles(baseApp, profession.catalog.skills).length > 0, option.id);

    for (const chain of profession.catalog.autoattackChains) {
      const skills = chain.map((skillId) => profession.catalog.skillsById.get(skillId));
      assert.equal(displayedSkillTiles(baseApp, skills)[0].id, chain[0], `${option.id}: ${skills[0].name}`);
      for (const skill of skills) {
        const app = projectionApp(profession, {
          professionState: { autoattackChains: { [chain[0]]: skill.id } },
          useProfessionUi: false
        });
        assert.deepEqual(
          displayedSkillTiles(app, skills).map((candidate) => candidate.id),
          [skill.id],
          `${option.id}: ${skills[0].name} -> ${skill.name}`
        );
      }

      autoattackFamilyCount += 1;
    }
  }

  assert.ok(autoattackFamilyCount > 0);
});

test('UI-only tile declarations collapse through the same profession-neutral hook', async () => {
  let declaredFamilyCount = 0;

  for (const option of professionOptions) {
    const profession = await loadProfession(option.id);
    const families = new Map();
    for (const skill of profession.catalog.skills.filter((candidate) => candidate.paletteTileId != null)) {
      const tileId = String(skill.paletteTileId);
      families.set(tileId, [...(families.get(tileId) || []), skill]);
    }

    for (const [tileId, family] of families) {
      assert.ok(family.length > 1, `${option.id}: ${tileId}`);
      assert.equal(
        displayedSkillTiles(projectionApp(profession, { useProfessionUi: false }), family).length,
        1,
        `${option.id}: ${tileId}`
      );
      declaredFamilyCount += 1;
    }
  }

  assert.ok(declaredFamilyCount > 0);
});

test('stateful transforms select one live tile across professions', async () => {
  const professions = new Map(
    await Promise.all(professionOptions.map(async (option) => [option.id, await loadProfession(option.id)]))
  );
  const cases = [
    ['necromancer', 'Core', { activeShroud: '' }, ['Death Shroud', 'End Death Shroud'], 'Death Shroud'],
    ['necromancer', 'Core', { activeShroud: 'death' }, ['Death Shroud', 'End Death Shroud'], 'End Death Shroud'],
    [
      'warrior',
      'Bladesworn',
      { gunsaberActive: false },
      ['Unsheathe Gunsaber', 'Sheathe Gunsaber'],
      'Unsheathe Gunsaber'
    ],
    ['warrior', 'Bladesworn', { gunsaberActive: true }, ['Unsheathe Gunsaber', 'Sheathe Gunsaber'], 'Sheathe Gunsaber'],
    [
      'engineer',
      'Holosmith',
      { photonForgeActive: false },
      ['Engage Photon Forge', 'Deactivate Photon Forge'],
      'Engage Photon Forge'
    ],
    [
      'engineer',
      'Holosmith',
      { photonForgeActive: true },
      ['Engage Photon Forge', 'Deactivate Photon Forge'],
      'Deactivate Photon Forge'
    ],
    [
      'thief',
      'Specter',
      { shadowClock: { value: 100, maximum: 100, updatedAt: 0, rate: 0 }, shadowShroudActive: false },
      ['Enter Shadow Shroud'],
      'Enter Shadow Shroud'
    ],
    [
      'thief',
      'Specter',
      { shadowClock: { value: 100, maximum: 100, updatedAt: 0, rate: 0 }, shadowShroudActive: true },
      ['Enter Shadow Shroud'],
      'Exit Shadow Shroud'
    ],
    [
      'ranger',
      'Druid',
      { astralClock: { value: 100, maximum: 100, updatedAt: 0, rate: 0 }, celestialAvatarActive: false },
      ['Celestial Avatar'],
      'Celestial Avatar'
    ],
    [
      'ranger',
      'Druid',
      { astralClock: { value: 100, maximum: 100, updatedAt: 0, rate: 0 }, celestialAvatarActive: true },
      ['Celestial Avatar'],
      'Release Celestial Avatar'
    ],
    ['ranger', 'Untamed', { rangerUnleashed: false }, ['Unleash Ranger'], 'Unleash Ranger'],
    ['ranger', 'Untamed', { rangerUnleashed: true }, ['Unleash Ranger'], 'Unleash Pet'],
    ['ranger', 'Soulbeast', { beastmodeActive: false }, ['Beastmode'], 'Beastmode'],
    ['ranger', 'Soulbeast', { beastmodeActive: true }, ['Beastmode'], 'Leave Beastmode'],
    ['ranger', 'Galeshot', { cycloneBowActive: false }, ['Summon Cyclone Bow'], 'Summon Cyclone Bow'],
    ['ranger', 'Galeshot', { cycloneBowActive: true }, ['Summon Cyclone Bow'], 'Dismiss Cyclone Bow'],
    ['ranger', 'Galeshot', { cycloneBowActive: true, windForce: 0 }, ['Keen Shot'], 'Keen Shot'],
    ['ranger', 'Galeshot', { cycloneBowActive: true, windForce: 5 }, ['Keen Shot'], 'Hawkeye'],
    ['elementalist', 'Core', { primaryAttunement: 'Earth', availableFlips: {} }, ['Rock Barrier'], 'Rock Barrier'],
    [
      'elementalist',
      'Core',
      { primaryAttunement: 'Earth', availableFlips: { 5780: armSkillFlip({}, 0, 0, 30) } },
      ['Rock Barrier'],
      'Hurl'
    ],
    ['elementalist', 'Core', { primaryAttunement: 'Earth', activeAuras: [] }, ['Magnetic Aura'], 'Magnetic Aura'],
    [
      'elementalist',
      'Core',
      { primaryAttunement: 'Earth', activeAuras: [{ type: 'Magnetic Aura', expiresAt: 30 }] },
      ['Magnetic Aura'],
      'Transmute Earth'
    ],
    ['elementalist', 'Weaver', { perfectWeaveUntil: 0 }, ['Weave Self'], 'Weave Self'],
    ['elementalist', 'Weaver', { perfectWeaveUntil: 30 }, ['Weave Self'], 'Tailored Victory'],
    ['guardian', 'Luminary', { radiantForge: false }, ['Enter Radiant Forge'], 'Enter Radiant Forge'],
    ['guardian', 'Luminary', { radiantForge: true }, ['Enter Radiant Forge'], 'Exit Radiant Forge']
  ];

  for (const [professionId, specialization, state, names, expected] of cases) {
    const profession = professions.get(professionId);
    // Renamed labels must not change which skill ID occupies a stateful tile.
    const app = projectionApp(profession, { specialization, professionState: state });
    app.skills = app.skills.map((skill) => ({ ...skill, name: `Renamed ${skill.name}` }));
    const skills = names.map((name) =>
      app.skills.find((skill) => skill.id === profession.catalog.skillsByName.get(name).id)
    );
    assert.deepEqual(
      displayedSkillTiles(app, skills).map((skill) => skill.id),
      [profession.catalog.skillsByName.get(expected).id],
      `${professionId}: ${expected}`
    );
  }
});

test('Untamed ambush tiles glow only while their window is open and recharge is ready', async () => {
  const profession = await loadProfession('ranger');
  for (const name of ['Relentless Whirl', 'Deft Strike']) {
    const skill = profession.catalog.skillsByName.get(name);
    for (const [time, rangerUnleashed, remaining, expected] of [
      [3.999, true, 0, true],
      [4, true, 0, false],
      [3, false, 0, false],
      [3, true, 1000, false]
    ]) {
      const context = { specialization: 'Untamed', time, professionState: { rangerUnleashed, ambushReadyUntil: 4 } };
      const app = projectionApp(profession, { ...context, cooldowns: { [name]: { remaining, readyAt: 4000 } } });
      const planning = planningFixture(profession, { specialization: 'Untamed' }, (runtime) => {
        Object.assign(runtime.profession.specialization.state, { rangerUnleashed, ambushReadyUntil: time < 4 ? 4 : 0 });
      });
      const availability = planning.availability[skill.id];
      assert.equal(paletteSkillView(app, skill, availability.ready).highlighted, expected, name);
    }
  }
});

test('Gunsaber tile shows the shared cooldown after direct or Dragon Trigger entry from sword', async () => {
  const profession = await loadProfession('warrior');
  // Use real simulation state so the visible flip and its cooldown cannot drift apart.
  for (const entry of ['Unsheathe Gunsaber', 'Dragon Trigger']) {
    const result = simulateGw2({
      profession,
      rotation: ['__combat_start', entry],
      config: { specialization: 'Bladesworn', initialResource: 100, primaryWeapon: 'Sword' }
    });
    const app = projectionApp(profession, { specialization: 'Bladesworn' });
    app.results = result;
    const [skill] = displayedSkillTiles(app, [profession.catalog.skillsByName.get('Unsheathe Gunsaber')]);
    const view = paletteSkillView(app, skill);

    assert.deepEqual(result.warnings, []);
    assert.equal(skill.name, 'Sheathe Gunsaber');
    assert.equal(view.cooldownLabel, '4.000s');
    assert.equal(view.disabled, true);
  }
});

test('Rock Barrier tile shows the root cooldown after Hurl consumes the flip', async () => {
  const profession = await loadProfession('elementalist');
  const app = projectionApp(profession, {
    specialization: 'Core',
    professionState: { availableFlips: {} },
    time: 1,
    cooldowns: {
      'Rock Barrier': { remaining: 8000, readyAt: 9000 }
    }
  });
  const [skill] = displayedSkillTiles(app, [profession.catalog.skillsByName.get('Rock Barrier')]);
  const view = paletteSkillView(app, skill, true);

  assert.equal(skill.name, 'Rock Barrier');
  assert.equal(view.cooldownLabel, '8.000s');
  assert.match(view.castDetails, /Remaining: 8\.000s/);
  assert.equal(view.disabled, true);
});

test('cooldown tooltip reports availability relative to combat start', async () => {
  const profession = await loadProfession('necromancer');
  const skill = profession.catalog.skillsByName.get('Wanderlust');
  const app = projectionApp(profession, {
    time: 14.84,
    cooldowns: {
      Wanderlust: { remaining: 8160, readyAt: 23000 }
    }
  });
  app.results.events = [{ type: 'combat_start', at: 10 }];

  assert.match(paletteSkillView(app, skill).castDetails, /Remaining: 8\.160s\nAvailable at: 13\.000s/);
});

test('ammo tile shows its cast lockout before the next charge timer', async () => {
  const profession = await loadProfession('mesmer');
  const skill = profession.catalog.skillsByName.get('Split Second');
  const ammoBySkillId = {
    [skill.id]: { charges: 1, maximum: 2, rechargeWork: 8, nextRechargeAt: 8 }
  };
  const locked = paletteSkillView(
    projectionApp(profession, {
      specialization: 'Chronomancer',
      time: 5,
      cooldowns: {
        [skill.name]: { remaining: 1250, readyAt: 6250 }
      },
      ammoBySkillId
    }),
    skill,
    true
  );
  const available = paletteSkillView(
    projectionApp(profession, {
      specialization: 'Chronomancer',
      time: 6.25,
      ammoBySkillId
    }),
    skill,
    true
  );

  assert.equal(locked.cooldownLabel, '1.250s');
  assert.equal(locked.disabled, true);
  assert.match(locked.castDetails, /Ammunition: 1\/2\nAvailable in: 1\.250s/);
  assert.equal(available.cooldownLabel, '1.750s');
  assert.equal(available.disabled, false);
  assert.match(available.castDetails, /Ammunition: 1\/2\nNext charge in: 1\.750s/);
});

test('Holosmith Photon Forge autos are catalog autoattack chains', async () => {
  const profession = await loadProfession('engineer');
  const names = profession.catalog.autoattackChains.map((chain) =>
    chain.map((skillId) => profession.catalog.skillsById.get(skillId).name)
  );

  assert.ok(names.some((chain) => chain.join('|') === 'Light Strike|Bright Slash|Flash Cutter'));
  assert.ok(names.some((chain) => chain.join('|') === 'Light Strike—Storm|Bright Slash—Storm|Flash Cutter—Storm'));
});

test('Holosmith Forge tiles follow weapon slots for normal and Storm autos', async () => {
  const profession = await loadProfession('engineer');
  // Trait variants must preserve the same five-slot Forge layout after chain projection.
  for (const storm of [false, true]) {
    const app = projectionApp(profession, {
      specialization: 'Holosmith',
      professionState: { photonForgeActive: true }
    });
    app.build.specializations = [{ name: 'Holosmith', traits: storm ? '1-1-1' : '1-2-1' }];
    const group = profession.ui
      .paletteGroups({ specialization: 'Holosmith', build: app.build })
      .find((candidate) => candidate.id === 'engineer-forge');
    const tiles = displayedSkillTiles(
      app,
      group.skillIds.map((skillId) => profession.catalog.skillsById.get(skillId))
    );

    assert.deepEqual(
      tiles.map((skill) => skill.slot),
      ['Weapon_1', 'Weapon_2', 'Weapon_3', 'Weapon_4', 'Weapon_5']
    );
    assert.equal(tiles[0].name, storm ? 'Light Strike—Storm' : 'Light Strike');
  }
});

test('Herald legend-dependent True Nature variants use one shared Facet tile', async () => {
  const profession = await loadProfession('revenant');
  const project = (availableFlips) => {
    const professionState = {
      activeLegendId: 'LegendaryAssassin',
      availableFlips
    };
    const app = projectionApp(profession, {
      specialization: 'Herald',
      professionState
    });
    const group = profession.ui
      .paletteGroups({
        specialization: 'Herald',
        professionState,
        build: app.build,
        catalog: profession.catalog
      })
      .find((candidate) => candidate.id === 'revenant-profession');

    return displayedSkillTiles(
      app,
      group.skillIds.map((skillId) => profession.catalog.skillsById.get(skillId))
    ).map((skill) => skill.name);
  };

  assert.deepEqual(project({}), ['Facet of Nature']);
  assert.deepEqual(project({ 51667: armSkillFlip({}, 0, 0) }), ['True Nature']);
});
