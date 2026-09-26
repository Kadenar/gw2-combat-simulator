import { armSkillFlip } from '#gw2/platform/engine/skills/skill-flips.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { loadProfession, professionOptions } from '#gw2/app/profession-registry.js';
import { displayedSkillTiles } from '#gw2/app/rotation/palette/model.js';
import { paletteSkillView } from '#gw2/app/rotation/palette/model.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';

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
  const profession = defineProfession({
    id: 'palette-recharge',
    name: 'Palette Recharge',
    catalog: createCanonicalCatalog({
      generated: [{ id: 990020, name: 'Recharge', type: 'Utility', castTimeMs: 0, cooldown: 20, effects: [] }]
    })
  });
  const skill = profession.catalog.skillsById.get(990020);
  for (const [alacrity, label] of [
    [false, '20.00s'],
    [true, '16.00s']
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
    ['elementalist', 'Weaver', { perfectWeaveUntil: 30 }, ['Weave Self'], 'Tailored Victory']
  ];

  for (const [professionId, specialization, state, names, expected] of cases) {
    const profession = professions.get(professionId);
    const skills = names.map((name) => profession.catalog.skillsByName.get(name));
    assert.deepEqual(
      displayedSkillTiles(projectionApp(profession, { specialization, professionState: state }), skills).map(
        (skill) => skill.name
      ),
      [expected],
      `${professionId}: ${expected}`
    );
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
    assert.equal(view.cooldownLabel, '5.00s');
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
  assert.equal(view.cooldownLabel, '8.00s');
  assert.match(view.castDetails, /Remaining: 8\.00s/);
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

  assert.match(paletteSkillView(app, skill).castDetails, /Remaining: 8\.16s\nAvailable at: 13s/);
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

  assert.equal(locked.cooldownLabel, '1.25s');
  assert.equal(locked.disabled, true);
  assert.match(locked.castDetails, /Ammunition: 1\/2\nAvailable in: 1\.25s/);
  assert.equal(available.cooldownLabel, '1.75s');
  assert.equal(available.disabled, false);
  assert.match(available.castDetails, /Ammunition: 1\/2\nNext charge in: 1\.75s/);
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
