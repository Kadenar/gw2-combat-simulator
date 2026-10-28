import { patchSelectionFixture } from '#tests/helpers/patch-selection.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { planningFixture } from '#tests/helpers/observed-runtime.js';
import { ENGINEER_SKILL_IDS } from '#gw2/professions/engineer/data/ids.js';
import { armSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import { SHARED_SKILL_IDS } from '#gw2/platform/skills/shared-actions.js';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { skillBarDisplaySkill } from '#gw2/app/build/panels/skills.js';
import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';
import {
  displayedSkillTiles,
  displayedWeaponSkills,
  paletteActionSkills,
  weaponSkills,
  weaponPaletteRows
} from '#gw2/app/rotation/palette/model.js';
import { autoattackChainSkillAvailable } from '#gw2/platform/execution/autoattack-chains.js';
import { weaponPaletteSectionHtml, weaponPaletteStackHtml } from '#gw2/app/rotation/palette/view.js';
import { ACTION_ICONS, resolveProcIcon } from '#gw2/app/shared/icons.js';
import { resultSkillIcon } from '#gw2/app/results/skill-icons.js';
import { createProfessionWeaponData } from '#gw2/platform/equipment/weapons/data.js';
import { createGuardianBuildDefaults } from '#gw2/professions/guardian/build/build.js';
import { createEngineerBuildDefaults } from '#gw2/professions/engineer/build/build.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { createMesmerBuildDefaults } from '#gw2/professions/mesmer/build/build.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { createDefaultConfig, simulateMesmer } from '#tests/helpers/mesmer-simulation.js';

test('Mesmer and Guardian palettes show only equipped weapon-set rows', () => {
  const appFor = (profession, build) => ({
    profession,
    build,
    activeCatalog: profession.catalog,
    adapter: {
      eliteSpecialization: () => '',
      isSkillAvailable: () => true
    },
    weaponData: createProfessionWeaponData(profession.catalog)
  });

  for (const app of [
    appFor(mesmerProfession, createMesmerBuildDefaults()),
    appFor(guardianProfession, createGuardianBuildDefaults())
  ]) {
    const setOne = weaponPaletteRows(app, 1);
    const setTwo = weaponPaletteRows(app, 2);

    assert.deepEqual(
      setOne.map((row) => row.label),
      ['W1', 'W2']
    );
    assert.deepEqual(
      setTwo.map((row) => row.label),
      ['W1', 'W2']
    );
    assert.deepEqual(
      setOne.map((row) => row.active),
      [true, false]
    );
    assert.deepEqual(
      setTwo.map((row) => row.active),
      [false, true]
    );
    assert.equal(
      setOne.every((row) => row.skills.length > 0),
      true
    );

    app.build.alternateWeapons = ['', ''];
    assert.deepEqual(
      weaponPaletteRows(app, 1).map((row) => row.label),
      ['W1']
    );
    assert.equal(
      paletteActionSkills(app).some((skill) => skill.name === 'Swap Weapons'),
      false
    );
  }
});

test('Mesmer palette advances through autoattack chain skills', () => {
  const config = {
    ...createDefaultConfig(),
    specialization: 'Core',
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Focus',
    initialResource: 0
  };
  const skill = (name) => mesmerProfession.catalog.skills.find((candidate) => candidate.name === name);
  const availabilityAfter = (rotation) => {
    const result = simulateMesmer(rotation, config);
    const chainState = result.planningState.profession.autoattackChains;

    return ['Mind Slash', 'Mind Gash', 'Mind Spike'].map((name) =>
      autoattackChainSkillAvailable(skill(name), chainState)
    );
  };

  assert.deepEqual(availabilityAfter(['Mind Slash']), [false, true, false]);
  assert.deepEqual(availabilityAfter(['Mind Slash', 'Mind Gash']), [false, false, true]);
});

test('weapon palette families display one live autoattack or flip skill', () => {
  const autoRoot = { id: 1, name: 'First Strike', chainRoot: 1 };
  const autoSecond = { id: 2, name: 'Second Strike', chainRoot: 1 };
  const flipRoot = { id: 3, name: 'Counter Stance', flipSkillId: 4 };
  const flip = { id: 4, name: 'Counter Attack', flipParentId: 3 };
  const skills = [autoRoot, autoSecond, flipRoot, flip];
  const skillById = new Map(skills.map((skill) => [skill.id, skill]));
  const app = {
    patch: patchSelectionFixture({ skills, skillsById: skillById }),
    build: { rotation: [] },
    activeCatalog: { skills, skillsById: skillById },
    profession: { catalog: { skillsById: skillById } },
    results: {
      planningState: {
        availability: {},
        profession: {
          autoattackChains: { 1: 2 },
          availableFlips: { 4: armSkillFlip({}, 0, 0, Infinity) }
        }
      }
    }
  };

  assert.deepEqual(
    displayedWeaponSkills(app, skills).map((skill) => skill.name),
    ['Second Strike', 'Counter Attack']
  );

  app.results.planningState.profession = { autoattackChains: {}, availableFlips: {} };
  assert.deepEqual(
    displayedWeaponSkills(app, skills).map((skill) => skill.name),
    ['First Strike', 'Counter Stance']
  );
});

test('palette flip projection infers catalog children and honors timed expiry', () => {
  const parent = { id: 10, name: 'Opening Skill', flipSkillId: 11 };
  const child = { id: 11, name: 'Follow-up Skill' };
  const skills = [parent, child];
  const skillsById = new Map(skills.map((skill) => [skill.id, skill]));
  const app = {
    patch: patchSelectionFixture({ skills, skillsById }),
    activeCatalog: { skills, skillsById },
    profession: { catalog: { skills, skillsById } },
    results: {
      planningState: {
        availability: {},
        atSeconds: 1.5,
        profession: { availableFlips: { 11: armSkillFlip({}, 0, 0, 2) } }
      }
    }
  };

  assert.deepEqual(
    displayedSkillTiles(app, [parent]).map((skill) => skill.name),
    ['Follow-up Skill']
  );

  app.results.planningState.atSeconds = 2;
  assert.deepEqual(
    displayedSkillTiles(app, [parent]).map((skill) => skill.name),
    ['Opening Skill']
  );
});

test('Mesmer weapon flips replace and restore their parent palette tile', () => {
  const config = {
    ...createDefaultConfig(),
    specialization: 'Core',
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Sword',
    initialResource: 0
  };
  const parent = mesmerProfession.catalog.skillsById.get(10276);
  const flip = mesmerProfession.catalog.skillsById.get(10314);
  const app = {
    patch: patchSelectionFixture(mesmerProfession.catalog),
    build: { rotation: [] },
    activeCatalog: mesmerProfession.catalog,
    profession: mesmerProfession,
    results: null
  };
  const displayedAfter = (rotation) => {
    app.results = simulateMesmer(rotation, config);

    return displayedWeaponSkills(app, [parent, flip]).map((skill) => skill.name);
  };

  assert.deepEqual(displayedAfter([]), ['Illusionary Counter']);
  assert.deepEqual(displayedAfter(['Illusionary Counter']), ['Counterspell']);
  assert.deepEqual(displayedAfter(['Illusionary Counter', 'Counterspell']), ['Illusionary Counter']);
});

test('Mesmer weapon palette displays only the current autoattack chain step', () => {
  const build = createMesmerBuildDefaults();

  build.specializations[2] = { name: 'Mirage', traits: '1-1-1' };
  build.weapons = ['Axe', 'Sword'];
  const app = {
    patch: patchSelectionFixture(mesmerProfession.catalog),
    profession: mesmerProfession,
    build,
    activeCatalog: mesmerProfession.catalog,
    adapter: {
      eliteSpecialization: () => 'Mirage',
      isSkillAvailable: () => true
    },
    weaponData: createProfessionWeaponData(mesmerProfession.catalog)
  };

  assert.deepEqual(
    weaponPaletteRows(app, 1)[0]
      .skills.filter((skill) => skill.chainRoot === 44791)
      .map((skill) => skill.name),
    ['Lacerating Chop']
  );
});

test('weapon-set palette groups render side by side in set order', () => {
  const html = weaponPaletteStackHtml(['<div data-weapon-set="1">W1</div>', '<div data-weapon-set="2">W2</div>']);

  assert.match(html, /data-role="weapon-set-stack"/);
  assert.equal(html.indexOf('data-weapon-set="1"') < html.indexOf('data-weapon-set="2"'), true);
});

test('weapon actions stay ordered beside the stacked weapon sets', () => {
  const mesmer = {
    profession: mesmerProfession,
    build: createMesmerBuildDefaults(),
    activeCatalog: mesmerProfession.catalog,
    adapter: {
      eliteSpecialization: () => 'Mirage',
      isSkillAvailable: () => true
    }
  };
  const guardian = {
    profession: guardianProfession,
    build: createGuardianBuildDefaults(),
    activeCatalog: guardianProfession.catalog,
    adapter: {
      eliteSpecialization: () => 'Firebrand',
      isSkillAvailable: () => true
    }
  };
  const mesmerActions = paletteActionSkills(mesmer);

  assert.deepEqual(
    mesmerActions.map((skill) => skill.name),
    ['Dodge / Mirage Cloak', 'Pick Up Mirage Mirror', 'Swap Weapons']
  );
  const mirrorIcon = 'https://render.guildwars2.com/file/7F3FA1CD20D930E7EEC75459E7206979DD0AD016/1770518.png';

  assert.equal(mesmerActions.find((skill) => skill.name === 'Pick Up Mirage Mirror')?.icon, mirrorIcon);
  assert.equal(ACTION_ICONS['Pick Up Mirage Mirror'], mirrorIcon);
  assert.equal(ACTION_ICONS['Mirage Mirror'], mirrorIcon);
  assert.equal(resultSkillIcon(mesmer, { name: 'Mirage Mirror', skillId: 44677 }), mirrorIcon);
  const troubadour = {
    ...mesmer,
    adapter: {
      ...mesmer.adapter,
      eliteSpecialization: () => 'Troubadour'
    }
  };

  assert.deepEqual(
    paletteActionSkills(troubadour).map((skill) => skill.name),
    ['Dodge', 'Swap Weapons']
  );
  assert.deepEqual(
    paletteActionSkills(guardian).map((skill) => skill.name),
    ['Swap Weapons']
  );

  const html = weaponPaletteSectionHtml(['<div>W1</div>', '<div>W2</div>'], '<div>Act</div>');

  assert.match(html, /data-role="weapon-palette-section"/);
  assert.equal(html.indexOf('weapon-set-stack') < html.indexOf('Act'), true);
});

test('Engineer swap action changes from precombat equipment swapping to a live kit exit', async () => {
  const adapter = await loadProfessionAppAdapter('engineer');
  const engineer = {
    patch: adapter.profession.resolvePatch(),
    profession: adapter.profession,
    build: createEngineerBuildDefaults(),
    activeCatalog: adapter.profession.catalog,
    adapter
  };

  assert.equal(
    paletteActionSkills(engineer).some((skill) => skill.name === 'Swap Weapons'),
    true
  );
  const swapWeapons = engineer.activeCatalog.skillsById.get(-3);

  assert.equal(
    engineer.adapter.isSkillAvailable(engineer.activeCatalog.skillsById.get(68079), {
      specialization: 'Core'
    }),
    false
  );
  assert.equal(
    planningFixture(engineer.profession, { weaponSet2Primary: 'Pistol' }).availability[swapWeapons.id].ready,
    true
  );
  // The swap stays beside Dodge without an alternate set; availability disables it when no kit can be stowed.
  engineer.build = { ...engineer.build, alternateWeapons: ['', ''] };
  const actionIds = paletteActionSkills(engineer).map((skill) => skill.id);
  assert.equal(actionIds[actionIds.indexOf(SHARED_SKILL_IDS.DODGE) + 1], swapWeapons.id);
  assert.equal(planningFixture(engineer.profession).availability[swapWeapons.id].ready, false);
  const combatSwapReady = (rotation) => {
    const config = { specialization: 'Core', primaryWeapon: 'Rifle', weaponSet2Primary: 'Pistol' };
    return runGw2Runtime({
      profession: engineer.profession.runtimeFor(config),
      config,
      rotation: [{ type: 'combat-start' }, ...rotation]
    }).planningState.availability[swapWeapons.id].ready;
  };

  assert.equal(combatSwapReady([]), false);
  assert.equal(combatSwapReady([{ type: 'cast', skillId: ENGINEER_SKILL_IDS.GRENADE_KIT }]), true);
  engineer.results = {
    planningState: { availability: {}, profession: { activeKit: ENGINEER_SKILL_IDS.GRENADE_KIT } }
  };
  // Swap Weapons and the kit's stow are separate in-game inputs, so the swap stays in the action row
  // while the stow remains owned by its kit group.
  const kitActions = paletteActionSkills(engineer).map((skill) => skill.id);
  assert.equal(kitActions.includes(swapWeapons.id), true);
  assert.equal(kitActions.includes(ENGINEER_SKILL_IDS.STOW_GRENADE_KIT), false);
  assert.equal(
    planningFixture(engineer.profession, {}, (runtime) => {
      runtime.profession.core.activeKit = ENGINEER_SKILL_IDS.GRENADE_KIT;
    }).availability[swapWeapons.id].ready,
    true
  );
  assert.equal(
    resultSkillIcon(engineer, { name: 'Jade Energy Shot' }),
    'https://render.guildwars2.com/file/' + '73600241FA662501C5D617719A7B4792F30B2846/2503622.png'
  );
  assert.equal(
    resultSkillIcon(engineer, {
      name: 'Mech trait strike',
      skillId: 63185
    }),
    'https://render.guildwars2.com/file/' + '02DA2C9899B63DE522020824C67D05951F40CA4A/2503679.png'
  );
  assert.equal(
    resultSkillIcon(engineer, {
      name: 'Bloodstone Explosion',
      sourceId: `relic.${RELIC_IDS.BLOODSTONE}`
    }),
    'https://render.guildwars2.com/file/' + 'A7327A7EDB4705EA05261110526D72AFEAF7DAB4/3629397.png'
  );
  engineer.results = {
    ...engineer.results,
    procSteps: [
      {
        type: 'trait_proc',
        skill: 'Orbital Command Strike',
        sourceSkill: 'Shrapnel Grenade'
      }
    ]
  };
  assert.equal(
    resultSkillIcon(engineer, { name: 'Orbital Command Strike' }),
    engineer.activeCatalog.skillsById.get(41612).icon
  );
  assert.notEqual(
    resultSkillIcon(engineer, { name: 'Orbital Command Strike' }),
    engineer.activeCatalog.skillsById.get(5807).icon
  );
  assert.equal(
    resolveProcIcon(engineer, {
      type: 'trait_proc',
      skill: 'Rapacious Strain',
      sourceSkill: 'Flux State',
      icon: 'https://render.guildwars2.com/file/' + '5B565BA46C111902EE65AB4592590442A5A6E754/3680135.png'
    }),
    'https://render.guildwars2.com/file/' + '5B565BA46C111902EE65AB4592590442A5A6E754/3680135.png'
  );
  for (const [parentName, flipName] of [
    ['Throw Mine', 'Detonate'],
    ['Healing Turret', 'Detonate Healing Turret']
  ]) {
    const parent = engineer.activeCatalog.skills.find((candidate) => candidate.name === parentName);
    const flip = engineer.activeCatalog.skills.find((candidate) => candidate.name === flipName);
    engineer.results.planningState.profession.availableFlips = { [flip.id]: armSkillFlip({}, 0, 0) };
    assert.equal(displayedSkillTiles(engineer, [parent])[0]?.name, flipName, parentName);
  }

  const grenadeKit = engineer.activeCatalog.skillsById.get(5805);
  engineer.results.planningState.profession.availableFlips = {};
  assert.equal(displayedSkillTiles(engineer, [grenadeKit])[0]?.name, 'Grenade Kit');
});

test('Firebrand mantra flips replace their selected skill-bar parent', async () => {
  const adapter = await loadProfessionAppAdapter('guardian');
  const skillById = adapter.profession.catalog.skillsById;
  const catalogSkills = adapter.profession.catalog.skills;
  const parent = catalogSkills.find((skill) => skill.name === 'Mantra of Flame');
  const normal = catalogSkills.find((skill) => skill.name === 'Flame Rush');
  const final = catalogSkills.find((skill) => skill.name === 'Flame Surge');
  const app = {
    patch: patchSelectionFixture({ skillsById: skillById }),
    activeCatalog: { skillsById: skillById },
    results: { planningState: { availability: {}, profession: { availableFlips: {} } } }
  };

  assert.equal(skillBarDisplaySkill(app, parent), parent);
  app.results.planningState.profession.availableFlips[normal.id] = armSkillFlip({}, 0, 0, Infinity);
  assert.equal(skillBarDisplaySkill(app, parent), normal);
  delete app.results.planningState.profession.availableFlips[normal.id];
  app.results.planningState.profession.availableFlips[final.id] = armSkillFlip({}, 0, 0, Infinity);
  assert.equal(skillBarDisplaySkill(app, parent), final);
  delete app.results.planningState.profession.availableFlips[final.id];
  assert.equal(skillBarDisplaySkill(app, parent), parent);
});

test('shared palettes reject supplemental effects from weapon and action rows', () => {
  const app = {
    patch: patchSelectionFixture({
      skills: [
        {
          id: 1,
          name: 'Rifle Shot',
          type: 'Weapon',
          slot: 'Weapon_1',
          weapon: 'Rifle'
        },
        {
          id: 2,
          name: 'Temporary Bundle Shot',
          type: 'Weapon',
          slot: 'Weapon_1',
          weapon: ''
        },
        {
          id: 3,
          name: 'Trait Proc',
          type: 'Action',
          slot: 'Action'
        },
        {
          id: -3,
          inputCategory: 'weapon-swap',
          name: 'Swap Weapons',
          type: 'Action',
          slot: 'Action'
        }
      ]
    }),
    profession: {
      catalog: {
        weaponHands: new Map([['Rifle', '2h']])
      }
    },
    build: {
      weapons: ['Rifle', ''],
      alternateWeapons: ['', '']
    },
    activeCatalog: {
      skills: [
        {
          id: 1,
          name: 'Rifle Shot',
          type: 'Weapon',
          slot: 'Weapon_1',
          weapon: 'Rifle'
        },
        {
          id: 2,
          name: 'Temporary Bundle Shot',
          type: 'Weapon',
          slot: 'Weapon_1',
          weapon: ''
        },
        {
          id: 3,
          name: 'Trait Proc',
          type: 'Action',
          slot: 'Action'
        },
        {
          id: -3,
          inputCategory: 'weapon-swap',
          name: 'Swap Weapons',
          type: 'Action',
          slot: 'Action'
        }
      ]
    },
    adapter: {
      eliteSpecialization: () => 'Core',
      isSkillAvailable: () => true
    }
  };

  assert.deepEqual(
    weaponSkills(app).map((skill) => skill.name),
    ['Rifle Shot']
  );
  assert.deepEqual(
    paletteActionSkills(app).map((skill) => skill.name),
    []
  );
});

test("weaponmaster palettes keep the active spec's weapon-skill variant", () => {
  // Both Bladecall variants share a slot and pass availability under
  // weaponmaster training; the off-spec Troubadour rework (62560) sorts first
  // in catalog order but is absent from a non-Troubadour runtime catalog, so it
  // must not win its authored family and poison the rotation with an unknown id.
  const skills = [
    {
      id: 62560,
      weaponVariantRootId: 69311,
      name: 'Renamed Bladecall',
      type: 'Weapon',
      slot: 'Weapon_2',
      weapon: 'Dagger',
      specialization: 'Troubadour'
    },
    {
      id: 69311,
      name: 'Bladecall',
      type: 'Weapon',
      slot: 'Weapon_2',
      weapon: 'Dagger',
      specialization: ''
    }
  ];
  const makeApp = (specialization) => ({
    profession: { catalog: { weaponHands: new Map([['Dagger', 'mh']]) } },
    build: { weapons: ['Dagger', ''], alternateWeapons: ['', ''] },
    activeCatalog: { skills },
    adapter: {
      eliteSpecialization: () => specialization,
      isSkillAvailable: () => true
    }
  });

  assert.deepEqual(
    weaponSkills(makeApp('Chronomancer')).map((skill) => skill.id),
    [69311]
  );
  assert.deepEqual(
    weaponSkills(makeApp('Troubadour')).map((skill) => skill.id),
    [62560]
  );
});
