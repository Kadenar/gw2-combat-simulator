import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadProfession, loadProfessionAppAdapter, professionOptions } from '#gw2/app/profession/registry.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { formatResourceValue } from '#gw2/app/rotation/palette/resource-view.js';
import { simulationEventLogRows } from '#gw2/app/rotation/result/simulation-event-log.js';
import { weaponSkills } from '#gw2/app/rotation/palette/model.js';
import { renderPalette } from '#gw2/app/rotation/palette/view.js';
import {
  createNecromancerBuildDefaults,
  migrateNecromancerBuild,
  validateNecromancerBuild
} from '#gw2/professions/necromancer/build/build.js';
import { necromancerCatalog } from '#gw2/professions/necromancer/catalog.js';
import { necromancerProfession } from '#gw2/professions/necromancer/definition.js';
import { NECROMANCER_SKILL_IDS as ID } from '#gw2/professions/necromancer/data/ids.js';

const baseConfig = Object.freeze({
  stats: {
    power: 2000,
    precision: 2000,
    ferocity: 500,
    conditionDamage: 1200,
    expertise: 0,
    vitality: 1000
  },
  target: {
    armor: 2597,
    conditions: {
      Chilled: true,
      Vulnerability: 25
    }
  }
});

function simulate(specialization, rotation, config = {}, observationPolicy = undefined) {
  return simulateGw2({
    profession: necromancerProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization,
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) }
    },
    mode: 'sequence',
    observationPolicy
  });
}

test('Necromancer resources and palette change with specialization state', () => {
  const harbingerResources = necromancerProfession.ui.resourceViews({
    specialization: 'Harbinger',
    professionState: {
      lifeForce: 80,
      maximumLifeForce: 100,
      lifeForcePoolCapacity: 13256.28,
      blight: 12,
      cascadingCorruptionStacks: 7
    }
  });
  const scourgeResources = necromancerProfession.ui.resourceViews({
    specialization: 'Scourge',
    build: {
      weapons: ['Spear', '']
    },
    professionState: {
      lifeForce: 80,
      maximumLifeForce: 100,
      soulShards: 4,
      shades: [10, 20]
    }
  });
  const reaperEntry = necromancerProfession.ui.paletteGroups({
    specialization: 'Reaper',
    professionState: {}
  })[0].skillIds;
  const reaperBar = necromancerProfession.ui.paletteGroups({
    specialization: 'Reaper',
    professionState: {
      activeShroud: 'reaper',
      availableFlips: { [ID.EXIT_REAPERS_SHROUD]: Infinity }
    }
  });
  const ritualistPalette = necromancerProfession.ui.paletteGroups({
    specialization: 'Ritualist',
    professionState: {
      activeShroud: '',
      activeSpirits: {}
    }
  });

  assert.deepEqual(
    harbingerResources.map((resource) => resource.id),
    ['life-force', 'blight', 'cascading-corruption']
  );
  assert.equal(harbingerResources[0].pipStyle, 'compact-profession-resource-necromancer-life-force');
  assert.equal(reaperBar[0].className, 'compact-resource-palette necromancer-f-skills');
  for (const specialization of ['Core', 'Reaper', 'Scourge', 'Harbinger', 'Ritualist']) {
    const mechanicGroup = necromancerProfession.ui.paletteGroups({ specialization })[0];

    assert.deepEqual(mechanicGroup.resourceIds, ['soul-shards'], specialization);
    assert.equal(mechanicGroup.resourcePlacement, 'beside', specialization);
  }

  assert.equal(harbingerResources[0].maximum, 13256);
  assert.equal(harbingerResources[0].value, 13256 * 0.8);
  assert.equal(harbingerResources[0].startMaximum, 100);
  assert.equal(harbingerResources[2].value, 7);
  assert.equal(harbingerResources[2].buildKey, 'initialCascadingCorruptionStacks');
  assert.equal(harbingerResources[1].showInPalette, false);
  assert.equal(harbingerResources[2].showInPalette, false);
  assert.deepEqual(
    scourgeResources.map((resource) => resource.id),
    ['life-force', 'soul-shards', 'active-shades']
  );
  assert.deepEqual(
    scourgeResources.slice(1).map((resource) => ({
      displayMode: resource.displayMode,
      pipStyle: resource.pipStyle,
      showValue: resource.showValue,
      value: resource.value
    })),
    [
      {
        displayMode: 'counter',
        pipStyle: 'necromancer-soul-shards',
        showValue: false,
        value: 4
      },
      {
        displayMode: 'counter',
        pipStyle: 'necromancer-scourge-shades',
        showValue: false,
        value: 2
      }
    ]
  );
  assert.deepEqual(
    necromancerProfession.ui.rotationStateSnapshot({
      specialization: 'Harbinger',
      build: {
        specializations: [{ name: 'Harbinger', traits: '3-3-1' }]
      },
      professionState: { blight: 12, cascadingCorruptionStacks: 7 }
    }),
    [
      {
        id: 'harbinger-blight',
        label: 'Blight',
        value: '12/25',
        title: 'Current Harbinger Blight stacks'
      },
      {
        id: 'cascading-corruption-stacks',
        label: 'Cascading Corruption',
        value: '7/20',
        title: 'Cascading Corruption stacks toward the next Meltdown'
      }
    ]
  );
  assert.deepEqual(
    necromancerProfession.ui
      .resourceViews({
        specialization: 'Harbinger',
        build: {
          weapons: ['Greatsword', ''],
          alternateWeapons: ['Spear', '']
        },
        professionState: {
          lifeForce: 80,
          maximumLifeForce: 100,
          blight: 12,
          soulShards: 4
        }
      })
      .map((resource) => resource.id),
    ['life-force', 'blight', 'cascading-corruption', 'soul-shards']
  );
  assert.deepEqual(reaperEntry, [ID.REAPERS_SHROUD, ID.EXIT_REAPERS_SHROUD]);
  assert.equal(reaperBar[0].skillIds.includes(ID.EXIT_REAPERS_SHROUD), true);
  assert.equal(reaperBar[1].skillIds.includes(ID.LIFE_REND), true);
  assert.deepEqual(
    reaperBar[1].skillIds.filter((id) => [ID.INFUSING_TERROR, ID.TERRIFY].includes(id)),
    [ID.INFUSING_TERROR, ID.TERRIFY]
  );
  assert.equal(reaperBar[0].stackId, 'reaper-profession');
  assert.equal(reaperBar[1].stackId, 'reaper-profession');
  assert.equal(ritualistPalette[0].stackId, 'ritualist-profession');
  assert.deepEqual(ritualistPalette[0].skillIds, [
    ID.RITUALISTS_SHROUD,
    ID.EXIT_RITUALISTS_SHROUD,
    ID.INNERVATE_ANGUISH,
    ID.INNERVATE_WANDERLUST,
    ID.INNERVATE_PRESERVATION
  ]);
  assert.equal(ritualistPalette[1].stackId, 'ritualist-profession');
  assert.equal(ritualistPalette[1].skillIds.includes(ID.SUMMON_SPIRITS), true);
  assert.equal(ritualistPalette[1].skillIds.includes(ID.INNERVATE_ANGUISH), false);
  assert.deepEqual(
    necromancerProfession.ui.paletteSkillAvailability(
      {
        specialization: 'Reaper',
        professionState: {}
      },
      necromancerCatalog.skillsById.get(ID.LIFE_REND)
    ),
    {
      available: false,
      message: 'Enter Reaper Shroud first'
    }
  );
  assert.equal(Object.hasOwn(necromancerProfession.ui, 'rotationSkillAvailability'), false);
  assert.equal(formatResourceValue(113.89999999999999), '113.9');
  assert.deepEqual(
    necromancerProfession.ui.targetHealthThresholds({
      specialization: 'Core',
      build: { weapons: ['Axe', 'Focus'], specializations: [] }
    }),
    []
  );
  assert.deepEqual(
    necromancerProfession.ui.targetHealthThresholds({
      specialization: 'Reaper',
      build: { weapons: ['Greatsword', ''], specializations: [] }
    }),
    [0.5]
  );
});

test('Necromancer renders life force above its F-skills', async () => {
  const adapter = await loadProfessionAppAdapter('necromancer');
  const build = adapter.toApplicationBuild(createNecromancerBuildDefaults());
  const app = {
    build,
    adapter,
    profession: necromancerProfession,
    skills: necromancerCatalog.skills,
    skillById: necromancerCatalog.skillsById,
    skillByName: necromancerCatalog.skillsByName,
    weaponData: adapter.weaponData,
    results: null
  };
  const palette = { innerHTML: '', querySelectorAll: () => [] };
  const previousDocument = globalThis.document;

  globalThis.document = {
    getElementById: (id) => (id === 'rotation-palette' ? palette : null)
  };
  try {
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }

  const html = palette.innerHTML;
  const mechanic = html.indexOf('compact-resource-palette necromancer-f-skills');
  const resource = html.indexOf('data-resource-id="life-force"');

  assert.ok(mechanic >= 0);
  assert.ok(resource > mechanic);
  assert.match(html, /compact-profession-resource-necromancer-life-force/);
  assert.match(html, /<strong>100\/100<\/strong>/);
  assert.equal(html.match(/data-resource-id="life-force"/g)?.length, 1);
  assert.doesNotMatch(html, /data-resource-id="blight"/);
  assert.doesNotMatch(html, /data-resource-id="cascading-corruption"/);

  app.build.weapons = ['Spear', ''];
  app.build.specializations[2] = {
    name: 'Scourge',
    traits: '1-1-2'
  };
  app.results = {
    endState: {
      profession: {
        lifeForce: 80,
        maximumLifeForce: 100,
        soulShards: 0,
        shades: [10, 20]
      }
    }
  };
  globalThis.document = {
    getElementById: (id) => (id === 'rotation-palette' ? palette : null)
  };
  try {
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }

  assert.match(
    palette.innerHTML,
    /data-resource-id="soul-shards"[\s\S]*data-resource-count="0"[\s\S]*necromancer-soul-shards/
  );
  assert.match(
    palette.innerHTML,
    /profession-palette-resource-group resource-beside[\s\S]*necromancer-f-skills[\s\S]*data-resource-id="soul-shards"/
  );
  app.results.endState.profession.soulShards = 4;
  globalThis.document = {
    getElementById: (id) => (id === 'rotation-palette' ? palette : null)
  };
  try {
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }

  assert.match(
    palette.innerHTML,
    /data-resource-id="soul-shards"[\s\S]*data-resource-count="4"[\s\S]*necromancer-soul-shards/
  );
  assert.match(
    palette.innerHTML,
    /data-resource-id="active-shades"[\s\S]*data-resource-count="2"[\s\S]*necromancer-scourge-shades/
  );
});

test('Necromancer shroud transitions stay adjacent and toggle availability', () => {
  for (const [specialization, shroud, entryId, exitId] of [
    ['Core', 'death', ID.DEATH_SHROUD, ID.END_DEATH_SHROUD],
    ['Reaper', 'reaper', ID.REAPERS_SHROUD, ID.EXIT_REAPERS_SHROUD],
    ['Harbinger', 'harbinger', ID.HARBINGER_SHROUD, ID.EXIT_HARBINGER_SHROUD],
    ['Ritualist', 'ritualist', ID.RITUALISTS_SHROUD, ID.EXIT_RITUALISTS_SHROUD]
  ]) {
    const inactiveContext = {
      specialization,
      professionState: { activeShroud: '' }
    };
    const activeContext = {
      specialization,
      professionState: { activeShroud: shroud }
    };

    for (const context of [inactiveContext, activeContext]) {
      assert.deepEqual(
        necromancerProfession.ui.paletteGroups(context)[0].skillIds.slice(0, 2),
        [entryId, exitId],
        specialization
      );
    }

    assert.equal(
      necromancerProfession.ui.isPaletteSkillAvailable(inactiveContext, necromancerCatalog.skillsById.get(entryId)),
      true,
      specialization
    );
    assert.equal(
      necromancerProfession.ui.isPaletteSkillAvailable(inactiveContext, necromancerCatalog.skillsById.get(exitId)),
      false,
      specialization
    );
    assert.equal(
      necromancerProfession.ui.isPaletteSkillAvailable(activeContext, necromancerCatalog.skillsById.get(entryId)),
      false,
      specialization
    );
    assert.equal(
      necromancerProfession.ui.isPaletteSkillAvailable(activeContext, necromancerCatalog.skillsById.get(exitId)),
      true,
      specialization
    );
  }
});

test("Necromancer skill bar exposes each specialization's shroud abilities", () => {
  const groups = (specialization) =>
    necromancerProfession.ui.skillBarGroups({
      specialization,
      professionState: {}
    });

  assert.deepEqual(
    groups('Core').map((group) => [group.label, group.skillIds]),
    [
      ['F Keys', [ID.DEATH_SHROUD, ID.END_DEATH_SHROUD]],
      ['Death Shroud', [ID.LIFE_BLAST, ID.DARK_PATH, ID.DOOM, ID.LIFE_TRANSFER, ID.TAINTED_SHACKLES]]
    ]
  );
  assert.deepEqual(
    groups('Reaper').map((group) => [group.label, group.skillIds]),
    [
      ['F Keys', [ID.REAPERS_SHROUD, ID.EXIT_REAPERS_SHROUD]],
      ["Reaper's Shroud", [ID.LIFE_REND, ID.DEATHS_CHARGE, ID.INFUSING_TERROR, ID.SOUL_SPIRAL, ID.EXECUTIONERS_SCYTHE]]
    ]
  );
  assert.deepEqual(
    groups('Harbinger').map((group) => [group.label, group.skillIds]),
    [
      ['F Keys', [ID.HARBINGER_SHROUD, ID.EXIT_HARBINGER_SHROUD]],
      ['Harbinger Shroud', [ID.TAINTED_BOLTS, ID.DARK_BARRAGE, ID.DEVOURING_CUT, ID.VORACIOUS_ARC, ID.VITAL_DRAW]]
    ]
  );
  assert.deepEqual(
    groups('Ritualist').map((group) => [group.label, group.skillIds]),
    [
      [
        'F Keys',
        [
          ID.RITUALISTS_SHROUD,
          ID.EXIT_RITUALISTS_SHROUD,
          ID.INNERVATE_ANGUISH,
          ID.INNERVATE_WANDERLUST,
          ID.INNERVATE_PRESERVATION
        ]
      ],
      ["Ritualist's Shroud", [ID.ESSENCE_BLAST, ID.ANGUISH, ID.WANDERLUST, ID.PRESERVATION, ID.SUMMON_SPIRITS]]
    ]
  );

  const scourge = necromancerProfession.ui.skillBarGroups({
    specialization: 'Scourge',
    build: {
      specializations: [{ name: 'Scourge', traits: '1-3-3' }]
    },
    professionState: {}
  });

  assert.deepEqual(
    scourge.map((group) => group.label),
    ['F Keys']
  );
  assert.deepEqual(scourge[0].skillIds, [
    ID.MANIFEST_SAND_SHADE,
    ID.NEFARIOUS_FAVOR,
    ID.SAND_CASCADE,
    ID.GARISH_PILLAR,
    ID.SANDSTORM_SHROUD
  ]);
});

test('Necromancer state events have a real event-log presentation', () => {
  const rows = simulationEventLogRows(
    {
      events: [
        {
          type: 'necromancer.state',
          at: 1,
          reason: 'shroud-enter',
          state: {
            lifeForce: 82.5,
            activeShroud: 'reaper',
            blight: 3,
            soulShards: 2
          }
        }
      ],
      resolvedEvents: [],
      endState: { profession: {} }
    },
    null,
    necromancerProfession
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].type, 'necromancer.state');
  assert.match(rows[0].description, /shroud-enter.*Life force 82\.5.*Shroud reaper.*Blight 3.*Soul shards 2/);
  assert.doesNotMatch(rows[0].description, /UNPRESENTED CUSTOM EVENT/);
});

test('Necromancer siphon bookkeeping events stay out of the event log', () => {
  const rows = simulationEventLogRows(
    {
      events: [
        { type: 'necromancer.taste-for-blood-grant', at: 0, stacks: 3, duration: 10 },
        { type: 'necromancer.taste-for-blood-allied-hit', at: 1, allyIndex: 1 },
        { type: 'necromancer.vampiric-presence-allied-hit', at: 1, allyIndex: 1 }
      ],
      resolvedEvents: [],
      endState: { profession: {} }
    },
    null,
    necromancerProfession
  );

  assert.deepEqual(rows, []);
});

test('slot skills are inaccessible in transformed shrouds', () => {
  const slotSkill = necromancerCatalog.skillsById.get(ID.BLOOD_IS_POWER);

  for (const [specialization, shroud, entry] of [
    ['Core', 'death', 'Death Shroud'],
    ['Reaper', 'reaper', "Reaper's Shroud"],
    ['Harbinger', 'harbinger', 'Harbinger Shroud'],
    ['Ritualist', 'ritualist', "Ritualist's Shroud"]
  ]) {
    assert.equal(
      necromancerProfession.ui.isPaletteSkillAvailable(
        {
          specialization,
          professionState: { activeShroud: shroud }
        },
        slotSkill
      ),
      false,
      specialization
    );
    const result = simulate(specialization, [entry, 'Blood Is Power'], {
      initialResource: 100,
      selectedSkills: ['Blood Is Power']
    });

    assert.match(result.warnings.join(' '), /Blood Is Power is unavailable/, specialization);
  }

  assert.equal(
    necromancerProfession.ui.isPaletteSkillAvailable(
      {
        specialization: 'Scourge',
        professionState: { activeShroud: '' }
      },
      slotSkill
    ),
    true
  );
});

test('Harbinger can equip torch skills through Weaponmaster Training', async () => {
  const adapter = await loadProfessionAppAdapter('necromancer');
  const skills = weaponSkills({
    adapter,
    skills: necromancerCatalog.skills,
    build: {
      specialization: 'Harbinger',
      weapons: ['Pistol', 'Torch'],
      alternateWeapons: ['Scepter', 'Dagger'],
      specializations: [
        { name: 'Curses', traits: '1-1-3' },
        { name: 'Harbinger', traits: '3-3-1' }
      ]
    },
    weaponData: {
      Pistol: { wielding: '1h' },
      Torch: { wielding: '1h' },
      Scepter: { wielding: '1h' },
      Dagger: { wielding: '1h' }
    }
  });

  assert.equal(
    skills.some((skill) => skill.name === 'Harrowing Wave'),
    true
  );
  assert.equal(
    skills.some((skill) => skill.name === 'Oppressive Collapse'),
    true
  );
  const scepterSkills = weaponSkills(
    {
      adapter,
      skills: necromancerCatalog.skills,
      build: {
        specialization: 'Harbinger',
        weapons: ['Pistol', 'Torch'],
        alternateWeapons: ['Scepter', 'Dagger'],
        specializations: [{ name: 'Curses', traits: '1-1-3' }]
      },
      weaponData: {
        Pistol: { wielding: '1h' },
        Torch: { wielding: '1h' },
        Scepter: { wielding: '1h' },
        Dagger: { wielding: '1h' }
      }
    },
    2
  );

  assert.equal(
    scepterSkills.some((skill) => skill.name === 'Devouring Darkness'),
    true
  );
  assert.equal(
    scepterSkills.some((skill) => skill.name === 'Feast of Corruption'),
    false
  );
  assert.equal(
    adapter.isSkillAvailable(necromancerCatalog.skillsById.get(ID.FEAST_OF_CORRUPTION), {
      specialization: 'Harbinger',
      build: { specializations: [] }
    }),
    true
  );
  assert.equal(
    adapter.isSkillAvailable(necromancerCatalog.skillsById.get(ID.DEVOURING_DARKNESS), {
      specialization: 'Harbinger',
      build: { specializations: [] }
    }),
    false
  );
  const torchRotation = simulate(
    'Harbinger',
    ['Harrowing Wave', 'Oppressive Collapse', { type: 'wait', durationMs: 4100 }],
    {
      primaryWeapon: 'Pistol',
      secondaryWeapon: 'Torch',
      allies: { count: 4, strikesPerSecond: 1 },
      sharePlayerBoonsWithSummons: true
    }
  );

  assert.deepEqual(torchRotation.warnings, []);
  assert.equal(
    torchRotation.breakdown.some((entry) => entry.name === 'Harrowing Wave'),
    true
  );
  assert.equal(
    torchRotation.breakdown.some((entry) => entry.name === 'Oppressive Collapse'),
    true
  );
  const oppressiveMight = torchRotation.events.find(
    (event) => event.type === 'buff' && event.skillId === ID.OPPRESSIVE_COLLAPSE && event.kind === 'might'
  );

  assert.equal(oppressiveMight.audience.recipients, 'party');
  assert.equal(oppressiveMight.resolvedAudience.includesSummons, false);
});

test('Necromancer builds migrate and validate against canonical metadata', () => {
  const defaults = createNecromancerBuildDefaults();

  assert.deepEqual(validateNecromancerBuild(defaults), {
    valid: true,
    errors: []
  });
  const migrated = migrateNecromancerBuild({
    weapons: ['Greatsword', 'Focus'],
    initialResource: 500,
    initialBlight: -4,
    initialCascadingCorruptionStacks: 30,
    selectedSkillIds: [ID.SUMMON_BLOOD_FIEND, ID.BLOOD_IS_POWER, ID.LICH_FORM]
  });

  assert.deepEqual(migrated.weapons, ['Greatsword', '']);
  assert.equal(migrated.initialResource, 100);
  assert.equal(migrated.initialBlight, 0);
  assert.equal(migrated.initialCascadingCorruptionStacks, 19);
  assert.equal(migrated.selectedSkills.Heal, 'Summon Blood Fiend');
  assert.equal(migrated.selectedSkills.Elite, 'Lich Form');
  assert.deepEqual(validateNecromancerBuild(migrated), {
    valid: true,
    errors: []
  });
  assert.throws(() => migrateNecromancerBuild({ profession: 'guardian' }), /Cannot load guardian build as Necromancer/);
});

test('Necromancer is wired through the selector and application adapter', async () => {
  const page = await readFile(new URL('../../../necromancer.html', import.meta.url), 'utf8');

  assert.equal(
    professionOptions.some((option) => option.id === 'necromancer'),
    true
  );
  assert.equal((await loadProfession('necromancer'))?.id, 'necromancer');
  assert.equal((await loadProfessionAppAdapter('necromancer'))?.id, 'necromancer');
  assert.match(page, /data-profession="necromancer"/);
});
