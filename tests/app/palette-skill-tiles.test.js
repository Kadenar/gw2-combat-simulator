import assert from 'node:assert/strict';
import test from 'node:test';

import { loadProfession, professionOptions } from '#gw2/app/profession/registry.js';
import { displayedSkillTiles } from '#gw2/app/rotation/palette/model.js';
import { paletteSkillView } from '#gw2/app/rotation/palette/model.js';

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
    adapter: { eliteSpecialization: () => specialization },
    profession: useProfessionUi ? profession : { catalog: profession.catalog, ui: {} },
    activeCatalog: profession.catalog,
    skills: profession.catalog.skills,
    skillById: profession.catalog.skillsById,
    skillByName: profession.catalog.skillsByName,
    results: {
      endState: {
        time: time * 1000,
        activeWeaponSet: 1,
        cooldowns,
        ammoBySkillId,
        profession: professionState
      }
    }
  };
}

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
      [{ 2: true }, [2]]
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
      [{ 2: true }, [2]]
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
      [{ 2: true }, [2]],
      [{ 3: true }, [3]]
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
    const app = catalogApp(skills, { availableFlips: { 2: true }, autoattackChains: { 1: 2 } });
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
    ['engineer', 'Mechanist', { mech: { active: false } }, ['Crash Down'], 'Crash Down'],
    ['engineer', 'Mechanist', { mech: { active: true } }, ['Crash Down'], 'Recall Mech'],
    [
      'thief',
      'Specter',
      { shadowForce: 100, shadowShroudActive: false },
      ['Enter Shadow Shroud'],
      'Enter Shadow Shroud'
    ],
    ['thief', 'Specter', { shadowForce: 100, shadowShroudActive: true }, ['Enter Shadow Shroud'], 'Exit Shadow Shroud'],
    ['ranger', 'Druid', { astralForce: 100, celestialAvatarActive: false }, ['Celestial Avatar'], 'Celestial Avatar'],
    [
      'ranger',
      'Druid',
      { astralForce: 100, celestialAvatarActive: true },
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
    ['elementalist', 'Core', { primaryAttunement: 'Earth', rockBarrierExpiresAt: 0 }, ['Rock Barrier'], 'Rock Barrier'],
    ['elementalist', 'Core', { primaryAttunement: 'Earth', rockBarrierExpiresAt: 30 }, ['Rock Barrier'], 'Hurl'],
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

test('Rock Barrier tile shows the root cooldown after Hurl consumes the flip', async () => {
  const profession = await loadProfession('elementalist');
  const app = projectionApp(profession, {
    specialization: 'Core',
    professionState: { rockBarrierExpiresAt: 0 },
    time: 1,
    cooldowns: {
      'Rock Barrier': { remaining: 8000, readyAt: 9000 }
    }
  });
  const [skill] = displayedSkillTiles(app, [profession.catalog.skillsByName.get('Rock Barrier')]);
  const view = paletteSkillView(app, skill, true);

  assert.equal(skill.name, 'Rock Barrier');
  assert.equal(view.cooldownLabel, '8.00s');
  assert.match(view.title, /Remaining: 8\.00s/);
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

  assert.match(paletteSkillView(app, skill).title, /Remaining: 8\.16s · available at 13s/);
});

test('ammo tile shows its cast lockout before the next charge timer', async () => {
  const profession = await loadProfession('mesmer');
  const skill = profession.catalog.skillsByName.get('Split Second');
  const ammoBySkillId = {
    [skill.id]: { charges: 1, maximum: 2, rechargeDuration: 8, nextRechargeAt: 8 }
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
  assert.match(locked.title, /1\/2 ammo · available in 1\.25s/);
  assert.equal(available.cooldownLabel, '1.75s');
  assert.equal(available.disabled, false);
  assert.match(available.title, /1\/2 ammo · next charge in 1\.75s/);
});

test('Holosmith Photon Forge autos are catalog autoattack chains', async () => {
  const profession = await loadProfession('engineer');
  const names = profession.catalog.autoattackChains.map((chain) =>
    chain.map((skillId) => profession.catalog.skillsById.get(skillId).name)
  );

  assert.ok(names.some((chain) => chain.join('|') === 'Light Strike|Bright Slash|Flash Cutter'));
  assert.ok(names.some((chain) => chain.join('|') === 'Light Strike—Storm|Bright Slash—Storm|Flash Cutter—Storm'));
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
  assert.deepEqual(project({ 51667: true }), ['True Nature']);
});
