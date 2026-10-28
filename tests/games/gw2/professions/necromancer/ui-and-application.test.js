import assert from 'node:assert/strict';
import test from 'node:test';

import { simulationEventLogRows } from '#gw2/app/results/event-log.js';
import { weaponSkills } from '#gw2/app/rotation/palette/model.js';
import { formatResourceValue } from '#gw2/app/rotation/palette/resource-view.js';
import { renderPalette } from '#gw2/app/rotation/palette/view.js';
import { rotationStateSnapshot } from '#gw2/app/rotation/state-snapshot/model.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { armSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import { createNecromancerBuildDefaults } from '#gw2/professions/necromancer/build/build.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerCatalog, necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { inertContainer } from '#tests/helpers/dom.js';
import { createObservedProfessionSimulator, planningFixture } from '#tests/helpers/observed-runtime.js';
import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';

const baseConfig = Object.freeze({
  attributeInputs: baseAttributeInputs({
    power: 2000,
    precision: 2000,
    ferocity: 500,
    conditionDamage: 1200,
    expertise: 0,
    vitality: 1000
  }),
  target: {
    armor: 2597,
    conditions: {
      Chilled: true,
      Vulnerability: 25
    }
  }
});

const simulate = createObservedProfessionSimulator(necromancerProfession, baseConfig);

// Cursor and end-state counters share combat observations, including expiry, minion eligibility, and patched caps.
test('Carapace state tracking follows the inspected observation across Necromancer specializations', () => {
  for (const maximumStacks of [30, 6]) {
    const family = withPatchPreview(necromancerProfession, {
      id: 'carapace-display',
      label: 'Carapace display',
      professions: {
        necromancer: { balanceProfiles: { [TRAIT.FLESH_OF_THE_MASTER]: { fields: { maximumStacks } } } }
      }
    });
    const patch = family.resolvePatch({ id: 'carapace-display' });
    for (const specialization of ['Core', 'Reaper', 'Scourge', 'Harbinger', 'Ritualist']) {
      for (const minionTraitSelected of [false, true]) {
        const planningState = planningFixture(
          family,
          {
            specialization,
            patchId: 'carapace-display',
            selectedTraitIds: minionTraitSelected ? [TRAIT.FLESH_OF_THE_MASTER] : []
          },
          (runtime) => {
            runtime.profession.core.carapaceExpiries = [0, 5, 10, 10];
            runtime.profession.core.activeMinions = { [ID.SUMMON_BONE_MINIONS]: 2 };
          }
        );
        const app = {
          profession: family,
          patch,
          build: {
            specializations: [{ name: 'Death Magic', traits: minionTraitSelected ? '1-1-1' : '2-1-1' }],
            rotation: [{ type: 'wait', durationMs: 10000 }]
          },
          results: { planningState: { ...planningState, atSeconds: 10 }, rotationEndTime: 10 },
          adapter: {
            eliteSpecialization: () => specialization,
            rotationPlanningStateAt: () => planningState
          },
          rotationInsertionIndex: 0
        };
        const carapace = () =>
          rotationStateSnapshot(app).items.find((item) => item.id === 'necromancer-deaths-carapace');
        const persistent = minionTraitSelected ? 4 : 0;
        assert.equal(carapace().value, `${Math.min(3 + persistent, maximumStacks)}/${maximumStacks}`);
        app.rotationInsertionIndex = null;
        assert.equal(carapace().value, `${persistent}/${maximumStacks}`);
        assert.equal(carapace().label, "Death's Carapace");
      }
    }
  }
});

// Keep zero visible for Death Magic builds while avoiding an unrelated counter on other builds.
test('Carapace state tracking is visible at zero only when Death Magic is equipped', () => {
  const context = {
    balanceContext: withPatchPreview(necromancerProfession).resolvePatch().balanceContext,
    specialization: 'Core',
    build: { specializations: [] }
  };
  assert.deepEqual(necromancerProfession.ui.rotationStateSnapshot(context), []);
  context.build.specializations = [{ name: 'Death Magic', traits: '1-1-1' }];
  assert.equal(necromancerProfession.ui.rotationStateSnapshot(context)[0].value, '0/30');
});

// Runtime and presentation share point capacity; starting input remains a percentage.
test('Necromancer stores and displays life-force points while starting settings remain percentages', () => {
  for (const [specialization, vitality, battery, expectedCapacity] of [
    ['Core', 1000, false, 13601.28],
    ['Scourge', 1000, true, 16321.536],
    ['Scourge', 2000, false, 20846.28],
    ['Harbinger', 1000, false, 15340.08]
  ]) {
    const state = simulate(specialization, [], {
      initialResource: 80,
      attributeInputs: baseAttributeInputs({ vitality }),
      selectedTraitIds: [
        ...(battery ? [TRAIT.SOUL_BATTERY] : []),
        ...(specialization === 'Harbinger' ? [TRAIT.ALCHEMIC_VIGOR] : [])
      ]
    }).planningState.profession;
    const view = necromancerProfession.ui.resourceViews({
      catalog: necromancerProfession.catalog,
      specialization,
      professionState: state
    })[0];
    assert.equal(view.maximum, Math.round(expectedCapacity), specialization);
    assert.equal(view.value, Math.round(expectedCapacity * 0.8), specialization);
    assert.equal(view.startMaximum, 100);
    assert.ok(Math.abs(state[STATE.LIFE_FORCE].maximum - expectedCapacity) < 1e-8);
    assert.ok(Math.abs(state[STATE.LIFE_FORCE].value - expectedCapacity * 0.8) < 1e-8);
  }
});

test('Necromancer resources and palette change with specialization state', () => {
  const harbingerResources = necromancerProfession.ui.resourceViews({
    catalog: necromancerProfession.catalog,
    specialization: 'Harbinger',
    professionState: {
      [STATE.LIFE_FORCE]: { value: 80, maximum: 100, updatedAt: 0, rate: 0 },

      [STATE.BLIGHT]: 12,
      [STATE.CASCADING_CORRUPTION_STACKS]: 7
    }
  });
  const scourgeResources = necromancerProfession.ui.resourceViews({
    catalog: necromancerProfession.catalog,
    specialization: 'Scourge',
    build: {
      weapons: ['Spear', '']
    },
    professionState: {
      [STATE.LIFE_FORCE]: { value: 80, maximum: 100, updatedAt: 0, rate: 0 },

      [STATE.SOUL_SHARD_GRANT]: { charges: 4, expiresAt: 10 },
      [STATE.SHADES]: [10, 20]
    }
  });
  const reaperEntry = necromancerProfession.ui.paletteGroups({
    specialization: 'Reaper',
    professionState: {}
  })[0].skillIds;
  const reaperBar = necromancerProfession.ui.paletteGroups({
    specialization: 'Reaper',
    professionState: {
      [STATE.ACTIVE_SHROUD]: 'reaper',
      [STATE.AVAILABLE_FLIPS]: { [ID.EXIT_REAPERS_SHROUD]: armSkillFlip({}, 0, 0, Infinity) }
    }
  });
  const ritualistPalette = necromancerProfession.ui.paletteGroups({
    specialization: 'Ritualist',
    professionState: {
      [STATE.ACTIVE_SHROUD]: '',
      [STATE.ACTIVE_SPIRITS]: {}
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

  assert.equal(harbingerResources[0].maximum, 100);
  assert.equal(harbingerResources[0].value, 80);
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
      balanceContext: withPatchPreview(necromancerProfession).resolvePatch({ id: 'current' }).balanceContext,
      specialization: 'Harbinger',
      build: {
        specializations: [{ name: 'Harbinger', traits: '3-3-1' }]
      },
      professionState: { [STATE.BLIGHT]: 12, [STATE.CASCADING_CORRUPTION_STACKS]: 7 }
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
        catalog: necromancerProfession.catalog,
        specialization: 'Harbinger',
        build: {
          weapons: ['Greatsword', ''],
          alternateWeapons: ['Spear', '']
        },
        professionState: {
          [STATE.LIFE_FORCE]: { value: 80, maximum: 100, updatedAt: 0, rate: 0 },

          [STATE.BLIGHT]: 12,
          [STATE.SOUL_SHARD_GRANT]: { charges: 4, expiresAt: 10 }
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
  assert.equal(
    planningFixture(necromancerProfession, { specialization: 'Reaper' }).availability[ID.LIFE_REND].ready,
    false
  );
  assert.equal(Object.hasOwn(necromancerProfession.ui, 'rotationSkillAvailability'), false);
  assert.equal(formatResourceValue(113.89999999999999), '113.9');
  assert.deepEqual(
    necromancerProfession.ui.targetHealthThresholds({
      catalog: necromancerCatalog,
      specialization: 'Core',
      build: { weapons: ['Axe', 'Focus'], specializations: [] }
    }),
    []
  );
  assert.deepEqual(
    necromancerProfession.ui.targetHealthThresholds({
      catalog: necromancerCatalog,
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
    patch: adapter.profession.resolvePatch(),
    build,
    adapter,
    profession: necromancerProfession,

    // Match application initialization so resource-only planning still has a catalog for palette availability.
    activeCatalog: necromancerCatalog,
    weaponData: adapter.weaponData,
    results: null
  };
  const palette = inertContainer();
  const previousDocument = globalThis.document;

  globalThis.document = {
    querySelector: () => null,
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
    planningState: {
      availability: {},
      // Resource-only fixtures retain the shared planning fields consumed by the palette.
      atSeconds: 0,
      activeWeaponSet: 1,
      cooldowns: {},
      ammoBySkillId: {},
      profession: {
        [STATE.LIFE_FORCE]: { value: 80, maximum: 100, updatedAt: 0, rate: 0 },

        [STATE.SOUL_SHARD_GRANT]: { charges: 0, expiresAt: 10 },
        [STATE.SHADES]: [10, 20]
      }
    }
  };
  globalThis.document = {
    querySelector: () => null,
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
  app.results.planningState.profession[STATE.SOUL_SHARD_GRANT].charges = 4;
  globalThis.document = {
    querySelector: () => null,
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
      professionState: { [STATE.ACTIVE_SHROUD]: '' }
    };
    const activeContext = {
      specialization,
      professionState: { [STATE.ACTIVE_SHROUD]: shroud }
    };

    for (const context of [inactiveContext, activeContext]) {
      assert.deepEqual(
        necromancerProfession.ui.paletteGroups(context)[0].skillIds.slice(0, 2),
        [entryId, exitId],
        specialization
      );
    }

    assert.equal(
      necromancerProfession.ui.paletteOverride(inactiveContext, necromancerCatalog.skillsById.get(entryId)).tileActive,
      true,
      specialization
    );
    assert.equal(
      necromancerProfession.ui.paletteOverride(inactiveContext, necromancerCatalog.skillsById.get(exitId)).tileActive,
      false,
      specialization
    );
    assert.equal(
      necromancerProfession.ui.paletteOverride(activeContext, necromancerCatalog.skillsById.get(entryId)).tileActive,
      false,
      specialization
    );
    assert.equal(
      necromancerProfession.ui.paletteOverride(activeContext, necromancerCatalog.skillsById.get(exitId)).tileActive,
      true,
      specialization
    );
  }
});

// The log presents actual casts and transitions without synthetic resource snapshots.
test('Necromancer live transitions have an event-log presentation', () => {
  const result = simulate('Core', ['Death Shroud', 'End Death Shroud'], { initialResource: 100 });
  assert.deepEqual(result.warnings, []);
  const rows = simulationEventLogRows(result, null, withPatchPreview(necromancerProfession));
  assert.ok(rows.some((row) => row.description.includes('Death Shroud')));
  assert.ok(rows.every((row) => !row.description.includes('UNPRESENTED CUSTOM EVENT')));
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
      planningFixture(necromancerProfession, { specialization, initialResource: 100 }, (runtime) => {
        runtime.profession.core.activeShroud = shroud;
      }).availability[slotSkill.id].ready,
      false,
      specialization
    );
    const result = simulate(specialization, [entry, 'Blood Is Power'], {
      initialResource: 100,
      selectedSkillIds: [10544]
    });

    assert.match(
      result.warnings.map(({ message }) => message).join(' '),
      /Blood Is Power is unavailable/,
      specialization
    );
  }

  assert.equal(
    planningFixture(necromancerProfession, { specialization: 'Scourge' }).availability[slotSkill.id].ready,
    true
  );
});

test('Harbinger can equip torch skills through Weaponmaster Training', async () => {
  const adapter = await loadProfessionAppAdapter('necromancer');
  const skills = weaponSkills({
    patch: adapter.profession.resolvePatch(),
    adapter,
    activeCatalog: necromancerCatalog,
    build: {
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
      patch: adapter.profession.resolvePatch(),
      adapter,
      activeCatalog: necromancerCatalog,
      build: {
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
      catalog: necromancerCatalog,
      specialization: 'Harbinger',
      build: { specializations: [] }
    }),
    true
  );
  assert.equal(
    adapter.isSkillAvailable(necromancerCatalog.skillsById.get(ID.DEVOURING_DARKNESS), {
      catalog: necromancerCatalog,
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
