import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, test } from 'node:test';
import { selectableSkillBarGroups, skillBarInspectionStacks } from '#gw2/app/build/panels/skills.js';
import { timelineWeaponRows } from '#gw2/app/rotation/timeline/model.js';
import { renderPalette } from '#gw2/app/rotation/palette/view.js';
import { loadProfession, loadProfessionAppAdapter, professionOptions } from '#gw2/app/profession/registry.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { createRangerBuildDefaults } from '#gw2/professions/ranger/build/build.js';
import { applyRangerBuildAttributeRules } from '#gw2/professions/ranger/build/attributes.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { RANGER_PETS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import { rangerProfession } from '#gw2/professions/ranger/definition.js';
import { druidAttributeRules } from '#gw2/professions/ranger/specializations/druid/mechanics/celestial-avatar-rules.js';
import { rangerCoreAttributeRules, rangerCoreModifierRules } from '#gw2/professions/ranger/core/traits/modifiers.js';
import {
  soulbeastAttributeRules,
  soulbeastModifierRules
} from '#gw2/professions/ranger/specializations/soulbeast/mechanics/beastmode.js';
import { rangerAppAdapter } from '#gw2/professions/ranger/app/app-definition.js';

// Attribute assertions use the same calculator composed into the Ranger adapter.
const calculateAttributes = createCalculateAttributes(applyRangerBuildAttributeRules);

const baseConfig = Object.freeze({
  initialAstralForce: 100,
  initialArrows: 8,
  selectedPet: 'Lynx',
  selectedPet2: 'Fanged Iboga',
  selectedHammerSkillIds: [ID.WILD_SWING, ID.OVERBEARING_SMASH, ID.SAVAGE_SHOCK_WAVE, ID.THUMP],
  professionAssumptions: {
    targetDefiant: true
  },
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  },
  target: {
    armor: 2597,
    defiant: true,
    conditions: { Vulnerability: 25 }
  }
});

function simulate(specialization, rotation, config = {}) {
  return simulateGw2({
    profession: rangerProfession,
    rotation,
    config: {
      ...baseConfig,
      ...config,
      specialization,
      professionAssumptions: {
        ...baseConfig.professionAssumptions,
        ...(config.professionAssumptions || {})
      },
      stats: { ...baseConfig.stats, ...(config.stats || {}) },
      target: { ...baseConfig.target, ...(config.target || {}) }
    }
  });
}

describe('Ranger skill-bar selections', () => {
  test('Soulbeast pet selections update merged Beast skills', () => {
    const build = createRangerBuildDefaults();
    const soulbeastContext = {
      build,
      specialization: 'Soulbeast',
      config: { specialization: 'Soulbeast', selectedPet: build.selectedPet },
      catalog: rangerCatalog,
      professionState: rangerProfession.resolveRuntime({ specialization: 'Soulbeast' }).createProfessionState({
        specialization: 'Soulbeast',
        selectedPet: build.selectedPet
      })
    };

    assert.equal(
      rangerProfession.ui.assumptionControls.some(
        (control) => control.key === 'selectedPet' || control.key === 'soulbeastArchetype'
      ),
      false
    );
    const petGroups = rangerProfession.ui
      .skillBarGroups(soulbeastContext)
      .filter((group) => group.id.startsWith('ranger-pet-'));
    const [pet1Group, pet2Group] = petGroups;

    assert.deepEqual(
      petGroups.map((group) => group.label),
      ['Pig', 'Lynx']
    );
    assert.deepEqual(
      petGroups.map((group) => group.className),
      ['ranger-pet ranger-pet-1', 'ranger-pet ranger-pet-2']
    );
    assert.equal(pet1Group.layout, 'ranger-mechanics ranger-soulbeast-mechanics');
    assert.equal(pet2Group.layout, 'ranger-mechanics ranger-soulbeast-mechanics');
    assert.equal(
      rangerProfession.ui.skillBarGroups(soulbeastContext).find((group) => group.id === 'ranger-soulbeast-f5')
        .className,
      'ranger-soulbeast-beastmode'
    );
    assert.equal(pet1Group.selections[0].selectionValue, 'Pig');
    assert.equal(pet2Group.selections[0].selectionValue, 'Lynx');
    assert.deepEqual(
      petGroups.map((group) => group.selections[0].filterPlaceholder),
      ['Filter pets...', 'Filter pets...']
    );
    assert.equal(pet1Group.selections[0].skillIds, undefined);
    assert.equal(pet2Group.selections[0].skillIds, undefined);
    assert.equal(pet1Group.selections[0].optionEntries.length, RANGER_PETS.length);
    assert.equal(
      rangerProfession.ui.updateSkillBarSelection(soulbeastContext, {
        key: 'selectedPet',
        index: 0,
        value: 'Smokescale'
      }),
      true
    );
    assert.equal(
      rangerProfession.ui.updateSkillBarSelection(soulbeastContext, {
        key: 'selectedPet2',
        index: 1,
        value: 'Fanged Iboga'
      }),
      true
    );
    assert.equal(build.selectedPet2, 'Fanged Iboga');
    const smokescale = RANGER_PETS.find((pet) => pet.name === 'Smokescale');
    const mergedPetGroups = rangerProfession.ui
      .skillBarGroups(soulbeastContext)
      .filter((group) => group.id.startsWith('ranger-pet-'));
    const fangedIboga = RANGER_PETS.find((pet) => pet.name === 'Fanged Iboga');

    assert.deepEqual(
      mergedPetGroups.map((group) => group.skillIds),
      [[], []]
    );
    // Pet cards use the selected pet as their heading without repeating its name or combat skills below.
    assert.deepEqual(
      mergedPetGroups.map((group) => group.label),
      ['Smokescale', 'Fanged Iboga']
    );
    assert.equal(mergedPetGroups[0].selections[0].leadingSkillIds, undefined);
    assert.equal(mergedPetGroups[1].selections[0].leadingSkillIds, undefined);
    assert.equal(mergedPetGroups[0].selections[0].typeLabel, undefined);
    assert.equal(mergedPetGroups[1].selections[0].typeLabel, undefined);
    assert.equal(mergedPetGroups[0].selections[0].skillIds, undefined);
    assert.equal(mergedPetGroups[1].selections[0].skillIds, undefined);
    const soulbeastGroups = rangerProfession.ui.skillBarGroups(soulbeastContext);
    // Both pets' merged Beast skills now live inside the Beastmode section beside the
    // toggle rather than in their own labeled rows.
    const beastmodeGroupSkillIds = soulbeastGroups.find((group) => group.id === 'ranger-soulbeast-f5').skillIds;

    assert.ok(smokescale.beastmodeSkillIds.every((id) => beastmodeGroupSkillIds.includes(id)));
    assert.ok(fangedIboga.beastmodeSkillIds.every((id) => beastmodeGroupSkillIds.includes(id)));
    assert.equal(
      soulbeastGroups.some((group) => String(group.id).startsWith('ranger-soulbeast-merged')),
      false
    );
    assert.equal(
      rangerProfession.ui.skillBarGroups(soulbeastContext).some((group) => group.id === 'ranger-beast-skills'),
      false
    );
    assert.equal(
      rangerProfession.ui
        .paletteGroups(soulbeastContext)
        .find((group) => group.id === 'ranger-soulbeast-profession')
        .skillIds.includes(ID.SMOKE_ASSAULT),
      true
    );
  });

  test('Untamed exposes pet and Hammer selections', () => {
    const build = createRangerBuildDefaults();
    const untamedContext = {
      build,
      specialization: 'Untamed',
      catalog: rangerCatalog,
      config: {
        specialization: 'Untamed',
        selectedHammerSkillIds: build.selectedHammerSkillIds,
        initialUntamedState: build.initialUntamedState
      },
      professionState: rangerProfession
        .resolveRuntime({ specialization: 'Untamed' })
        .createProfessionState({ specialization: 'Untamed' })
    };

    assert.equal(
      rangerProfession.ui.skillBarGroups(untamedContext).some((group) => group.id === 'ranger-untamed-start-state'),
      false
    );
    const untamedGroups = rangerProfession.ui.skillBarGroups(untamedContext);

    assert.deepEqual(
      selectableSkillBarGroups('ranger', untamedGroups).map((group) => group.id),
      ['ranger-pet-1-selection', 'ranger-pet-2-selection', 'ranger-hammer-selection']
    );
    assert.deepEqual(selectableSkillBarGroups('warrior', untamedGroups), []);
    assert.equal(
      untamedGroups.find((group) => group.id === 'ranger-pet-1-selection').layout,
      'ranger-mechanics ranger-untamed-mechanics'
    );
    assert.deepEqual(
      untamedGroups.filter((group) => group.id.startsWith('ranger-untamed-')).map((group) => group.className),
      ['ranger-untamed-unleash', 'ranger-untamed-pet-skills']
    );
    const untamedStartControl = rangerProfession.ui.startControls(untamedContext)[0];

    assert.equal(untamedStartControl.label, 'Start unleashed');
    assert.equal(untamedStartControl.buildKey, 'initialUntamedState');
    assert.equal(untamedStartControl.value, 'Pet');
    assert.deepEqual(
      untamedStartControl.options.map((entry) => entry.value),
      ['Pet', 'Ranger']
    );
    assert.equal(
      untamedStartControl.options.every((entry) => entry.icon),
      true
    );
    for (const specialization of ['Core', 'Druid', 'Soulbeast', 'Untamed', 'Galeshot']) {
      const runtime = rangerProfession.resolveRuntime({ specialization });
      const context = {
        build,
        specialization,
        config: {
          specialization,
          selectedHammerSkillIds: build.selectedHammerSkillIds
        },
        catalog: rangerCatalog,
        professionState: runtime.createProfessionState({ specialization })
      };
      const hammer = rangerProfession.ui
        .skillBarGroups(context)
        .find((group) => group.id === 'ranger-hammer-selection');

      assert.equal(hammer.label, 'Hammer', specialization);
      assert.equal(hammer.selections.length, 4, specialization);
    }

    const hammerGroup = rangerProfession.ui
      .skillBarGroups(untamedContext)
      .find((group) => group.id === 'ranger-hammer-selection');

    assert.deepEqual(
      hammerGroup.selections.map((selection) => selection.skillId),
      build.selectedHammerSkillIds
    );
    assert.equal(
      rangerProfession.ui
        .skillBarGroups({
          ...untamedContext,
          build: {
            ...build,
            weapons: ['Axe', 'Axe'],
            alternateWeapons: ['Longbow', '']
          }
        })
        .some((group) => group.id === 'ranger-hammer-selection'),
      false
    );
    assert.equal(
      rangerProfession.ui.weaponSkillMatchesSet(
        rangerCatalog.skillsById.get(ID.UNLEASHED_WILD_SWING),
        ['Hammer', ''],
        untamedContext
      ),
      true
    );
    assert.equal(
      rangerProfession.ui.updateSkillBarSelection(untamedContext, {
        key: 'selectedHammerSkillIds',
        index: 0,
        skillId: ID.UNLEASHED_WILD_SWING
      }),
      true
    );
    assert.equal(
      rangerProfession.ui.skillBarGroups(untamedContext).find((group) => group.id === 'ranger-hammer-selection')
        .selections[0].skillId,
      ID.UNLEASHED_WILD_SWING
    );
    assert.equal(
      rangerProfession.ui.paletteGroups(untamedContext).some((group) => group.id === 'ranger-hammer'),
      false
    );
  });
});

describe('Galeshot Cyclone Bow', () => {
  test('uses measured Quickness cast times', () => {
    const expectedQuicknessCastTimes = new Map([
      ['Mistral', 320],
      ['Long Range Shot', 480],
      ['Rapid Fire', 1800],
      ["Hunter's Shot", 320],
      ['Point-Blank Shot', 360],
      ['Barrage', 1880],
      ['Keen Shot', 480],
      ['Hawkeye', 880],
      ['Bluster', 680],
      ['Fleeting Zephyr', 520],
      ["Quarry's Peril", 680],
      ['Pelt', 680],
      ['Supersonic Arrow', 1000],
      ['Piercing Gales', 640],
      ['Perfect Storm', 600]
    ]);

    for (const [name, castTimeMs] of expectedQuicknessCastTimes) {
      assert.equal(rangerCatalog.skillsByName.get(name).quicknessCastTimeMs, castTimeMs);
      assert.equal(castTimeMs % 40, 0);
    }
  });

  test('enforces replacement rules and consumes Bow resources', () => {
    const blocked = simulate('Galeshot', ['Bluster']);

    assert.match(blocked.warnings[0], /summon the Cyclone Bow/);

    const result = simulate(
      'Galeshot',
      ['Summon Cyclone Bow', 'Bluster', 'Fleeting Zephyr', 'Pelt', 'Supersonic Arrow', 'Hawkeye'],
      {
        selectedTraitIds: [TRAIT.PERILOUS_SKIES]
      }
    );

    assert.deepEqual(result.warnings, []);
    assert.equal(result.endState.profession.cycloneBowActive, true);
    assert.equal(result.endState.profession.windForce, 0);
    assert.equal(result.endState.profession.arrows < 8, true);
    assert.equal(result.totalDamage > 0, true);

    const keenBlocked = simulate('Galeshot', [
      'Summon Cyclone Bow',
      'Bluster',
      'Fleeting Zephyr',
      "Quarry's Peril",
      'Supersonic Arrow',
      'Keen Shot'
    ]);

    assert.match(keenBlocked.warnings[0], /Hawkeye replaces Keen Shot/);

    const weaponBlocked = simulate('Galeshot', ['Summon Cyclone Bow', 'Rapid Fire'], { primaryWeapon: 'Longbow' });

    assert.match(weaponBlocked.warnings[0], /replaces weapon skills/);
  });

  test('renders grouped Arrow and Wind Force controls with stateful availability', () => {
    const charged = simulate('Galeshot', [
      'Summon Cyclone Bow',
      'Bluster',
      'Fleeting Zephyr',
      "Quarry's Peril",
      'Supersonic Arrow'
    ]);
    const inactiveContext = {
      specialization: 'Galeshot',
      professionState: rangerProfession
        .resolveRuntime({ specialization: 'Galeshot' })
        .createProfessionState({ specialization: 'Galeshot' })
    };
    const untraitedBowGroup = rangerProfession.ui
      .skillBarGroups(inactiveContext)
      .find((group) => group.id === 'ranger-cyclone-bow');
    const traitedBowGroup = rangerProfession.ui
      .skillBarGroups({
        ...inactiveContext,
        traits: new Set([TRAIT.PERILOUS_SKIES])
      })
      .find((group) => group.id === 'ranger-cyclone-bow');

    // Perilous Skies owns the preview replacement just as it owns the runtime
    // replacement, so Pelt is never displayed beside Quarry's Peril.
    assert.equal(untraitedBowGroup.className, 'ranger-cyclone-bow-skills');
    assert.equal(untraitedBowGroup.skillIds.includes(ID.QUARRYS_PERIL), true);
    assert.equal(untraitedBowGroup.skillIds.includes(ID.PELT), false);
    assert.equal(traitedBowGroup.skillIds.includes(ID.QUARRYS_PERIL), false);
    assert.equal(traitedBowGroup.skillIds.includes(ID.PELT), true);
    assert.deepEqual(
      skillBarInspectionStacks(
        untraitedBowGroup.skillIds.map((skillId) => rangerCatalog.skillsById.get(skillId)),
        untraitedBowGroup.inspectionChainRoots
      ).map(({ root, children }) => [root.id, children.map((skill) => skill.id)]),
      [
        [ID.KEEN_SHOT, [ID.HAWKEYE]],
        [ID.BLUSTER, []],
        [ID.FLEETING_ZEPHYR, []],
        [ID.QUARRYS_PERIL, []],
        [ID.SUPERSONIC_ARROW, []]
      ]
    );
    const galeshotPaletteGroups = rangerProfession.ui.paletteGroups(inactiveContext);

    assert.deepEqual(
      galeshotPaletteGroups.map((group) => group.id),
      ['ranger-pet', 'ranger-galeshot-profession', 'ranger-cyclone-bow']
    );
    assert.equal(
      galeshotPaletteGroups.every((group) => group.stackId === 'ranger-galeshot'),
      true
    );
    const galeshotF5Group = galeshotPaletteGroups.find((group) => group.id === 'ranger-galeshot-profession');

    assert.equal(galeshotF5Group.className, 'ranger-galeshot-f5');
    assert.deepEqual(galeshotF5Group.resourceIds, ['arrows']);
    assert.equal(galeshotF5Group.resourcePlacement, 'beside');
    const cycloneBowGroup = galeshotPaletteGroups.find((group) => group.id === 'ranger-cyclone-bow');

    assert.equal(cycloneBowGroup.className, 'ranger-cyclone-bow-skills');
    assert.deepEqual(cycloneBowGroup.resourceIds, ['wind-force']);
    assert.equal(cycloneBowGroup.resourcePlacement, 'above');
    const galeshotResources = rangerProfession.ui.resourceViews(inactiveContext);

    assert.equal(galeshotResources.find((view) => view.id === 'wind-force').pipStyle, 'ranger-wind-force');
    assert.equal(
      galeshotResources
        .filter((view) => ['arrows', 'wind-force'].includes(view.id))
        .every((view) => view.showValue === false),
      true
    );
    const galeshotBuild = createRangerBuildDefaults();

    galeshotBuild.specializations[2] = {
      name: 'Galeshot',
      traits: '3-3-2'
    };
    const galeshotApp = {
      build: galeshotBuild,
      adapter: rangerAppAdapter,
      profession: rangerProfession,
      skills: rangerCatalog.skills,
      skillById: rangerCatalog.skillsById,
      skillByName: rangerCatalog.skillsByName,
      results: charged
    };
    const paletteElement = { innerHTML: '', querySelectorAll: () => [] };
    const previousDocument = globalThis.document;

    globalThis.document = {
      getElementById: (id) => (id === 'rotation-palette' ? paletteElement : null)
    };
    try {
      renderPalette(galeshotApp);
    } finally {
      globalThis.document = previousDocument;
    }

    assert.match(
      paletteElement.innerHTML,
      /profession-palette-resource-group resource-beside[\s\S]*ranger-galeshot-f5[\s\S]*data-resource-id="arrows"/
    );
    assert.match(
      paletteElement.innerHTML,
      /profession-palette-resource-group resource-above[\s\S]*data-resource-id="wind-force"[\s\S]*ranger-cyclone-bow-skills/
    );
    assert.doesNotMatch(paletteElement.innerHTML, />\d+\/(?:8|5)<\/strong>/);
    assert.doesNotMatch(paletteElement.innerHTML, /title="[^"]*(?:arrows|Wind Force): \d+\/(?:8|5)"/);
    const dismiss = rangerCatalog.skillsById.get(ID.DISMISS_CYCLONE_BOW);

    assert.equal(rangerProfession.ui.paletteSkillAvailability(inactiveContext, dismiss).available, false);
    const activeContext = {
      specialization: 'Galeshot',
      professionState: charged.endState.profession
    };

    assert.equal(
      rangerProfession.ui.paletteSkillAvailability(activeContext, rangerCatalog.skillsById.get(ID.KEEN_SHOT)).available,
      false
    );
    assert.equal(
      rangerProfession.ui.paletteSkillAvailability(activeContext, rangerCatalog.skillsById.get(ID.HAWKEYE)).available,
      true
    );
    assert.equal(
      rangerProfession.ui.paletteSkillAvailability(activeContext, rangerCatalog.skillsById.get(ID.RAPID_FIRE))
        .available,
      false
    );
  });

  test('resolves Hawkeye, Shrike, and Mistral replacement packets', () => {
    const result = simulate(
      'Galeshot',
      ['Summon Cyclone Bow', 'Bluster', 'Fleeting Zephyr', 'Pelt', 'Supersonic Arrow', 'Hawkeye'],
      {
        selectedTraitIds: [TRAIT.PERILOUS_SKIES]
      }
    );
    const hawkeyeHits = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillId === ID.HAWKEYE
    );

    assert.equal(hawkeyeHits.length, 5);
    assert.ok(Math.abs(hawkeyeHits.reduce((sum, event) => sum + event.coefficient, 0) - 6.8) < 1e-9);

    const shrike = simulate('Galeshot', ['Mistral', 'Rapid Fire', 'Long Range Shot', 'Long Range Shot'], {
      primaryWeapon: 'Longbow',
      selectedTraitIds: [TRAIT.SHRIKE]
    });

    assert.deepEqual(shrike.warnings, []);
    assert.equal(
      shrike.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === ID.MISTRAL).length,
      12
    );
    assert.equal(
      shrike.resolvedEvents.filter((event) => event.type === 'damage' && event.sourceId === TRAIT.SHRIKE).length,
      3
    );

    const barrage = simulate('Galeshot', ['Mistral', 'Barrage'], {
      primaryWeapon: 'Longbow'
    });

    assert.equal(
      barrage.resolvedEvents.some((event) => event.type === 'damage' && event.skillId === ID.MISTRAL),
      false
    );
  });
});

test('Cyclone Bow strikes use its normalized weapon strength', () => {
  for (const primaryWeapon of ['Axe', 'Longbow', 'Hammer']) {
    const result = simulate('Galeshot', ['Summon Cyclone Bow', 'Keen Shot'], {
      primaryWeapon
    });
    const hit = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.KEEN_SHOT);

    assert.equal(hit.weaponStrengthProfileId, 'transform.cyclone-bow');
    assert.equal(hit.resolvedWeaponStrength, 1015);
  }
});

test("Quarry's Peril commits at 320 ms and deals damage at 800 ms", () => {
  const rotation = (interruptAfterMs) => [
    'Summon Cyclone Bow',
    {
      name: "Quarry's Peril",
      ...(interruptAfterMs == null ? {} : { interruptAfterMs })
    },
    'Fleeting Zephyr',
    { type: 'wait', durationMs: 1000 }
  ];
  const config = { boons: { quickness: true } };
  const beforeCommit = simulate('Galeshot', rotation(319), config);
  const committed = simulate('Galeshot', rotation(320), config);
  const fullCast = simulate('Galeshot', rotation(), config);
  const quarryStep = (result) => result.steps.find((step) => step.skill === "Quarry's Peril");
  const quarryDamage = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.QUARRYS_PERIL);
  const quarryAction = (result) =>
    result.events.find((event) => event.type === 'action' && event.skillId === ID.QUARRYS_PERIL);
  const fleetingStep = (result) => result.steps.find((step) => step.skill === 'Fleeting Zephyr');

  assert.equal(rangerCatalog.skillsById.get(ID.QUARRYS_PERIL).interruptCommitMs, 320);
  assert.equal(rangerCatalog.skillsById.get(ID.QUARRYS_PERIL).retainsCastLockoutAfterInterrupt, true);
  assert.equal(quarryStep(fullCast).fullCastMs, 680);
  assert.equal(quarryStep(fullCast).end - quarryStep(fullCast).start, 680);
  assert.equal(quarryStep(committed).end - quarryStep(committed).start, 320);
  assert.equal(fleetingStep(committed).start - quarryStep(committed).start, 680);
  assert.equal(Math.round((quarryAction(committed).rechargeReadyAt - quarryAction(committed).at) * 1000), 12320);
  assert.equal(Math.round((quarryAction(fullCast).rechargeReadyAt - quarryAction(fullCast).at) * 1000), 12680);
  assert.equal(quarryDamage(beforeCommit), undefined);
  assert.equal(Math.round(quarryDamage(committed).at * 1000) - quarryStep(committed).start, 800);
  assert.equal(Math.round(quarryDamage(fullCast).at * 1000) - quarryStep(fullCast).start, 800);
});

test('Cyclone Bow transitions trigger swap sigils and dedicated weapon lines', () => {
  const result = simulate(
    'Galeshot',
    ['__combat_start', 'Summon Cyclone Bow', { type: 'wait', durationMs: 10000 }, 'Dismiss Cyclone Bow'],
    {
      sigilSets: [
        { names: ['Hydromancy'], strike: 1, condition: 1 },
        { names: [], strike: 1, condition: 1 }
      ]
    }
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.procSteps.filter((step) => step.skill === 'Sigil of Hydromancy').map((step) => step.sourceSkill),
    ['Summon Cyclone Bow', 'Dismiss Cyclone Bow']
  );

  const transition = rangerProfession.ui.timelineWeaponLineTransition;
  const rotation = ['Long Range Shot', 'Summon Cyclone Bow', 'Keen Shot', 'Dismiss Cyclone Bow', 'Long Range Shot'];
  const rows = timelineWeaponRows(rotation, {
    startingWeaponSet: 1,
    weaponLineTransition(entry, current) {
      const name = typeof entry === 'string' ? entry : entry.name;

      return transition({
        entry: { name },
        skill: rangerCatalog.skillsByName.get(name),
        specialization: 'Galeshot',
        ...current
      });
    }
  });

  assert.deepEqual(
    rows.map((row) => row.weaponLine),
    [null, 'Cyclone Bow', null]
  );
  assert.deepEqual(
    rows.map((row) => row.skills.map((skill) => skill.index)),
    [[0, 1], [2, 3], [4]]
  );
});

test('Ranger trait rules affect their owned damage and attributes', () => {
  const coreOperations = new Map(rangerCoreModifierRules.map((rule) => [rule.id, rule.operation]));
  const soulbeastOperations = new Map(soulbeastModifierRules.map((rule) => [rule.id, rule.operation]));

  for (const id of [
    'ranger.remorseless',
    'ranger.predators-onslaught-player',
    'ranger.predators-onslaught-pet',
    'ranger.wolfsong',
    'ranger.farsighted',
    'ranger.hunters-tactics-damage',
    'ranger.light-on-your-feet',
    'ranger.bountiful-hunter-player',
    'ranger.bountiful-hunter-pet'
  ]) {
    assert.equal(coreOperations.get(id), 'multiply', id);
  }

  for (const id of ['ranger.loud-whistle-player', 'ranger.sic-em-player', 'ranger.oppressive-superiority']) {
    assert.equal(soulbeastOperations.get(id), 'multiply', id);
  }

  assert.equal(coreOperations.has('ranger.loud-whistle-player'), false);

  const baseAttributes = { power: 0, precision: 0, conditionDamage: 0, toughness: 0, vitality: 1000, ferocity: 0 };
  const druidContext = { config: {}, traits: new Set([TRAIT.NATURAL_FORTITUDE]) };
  const druidAttributes = druidAttributeRules.modifyAttributes(druidContext, baseAttributes);
  const coreAttributes = rangerCoreAttributeRules.modifyAttributes(druidContext, baseAttributes);

  assert.equal(druidAttributes.vitality, 1240);
  assert.equal(coreAttributes.vitality, 1000);

  const soulbeastAttributes = soulbeastAttributeRules.modifyAttributes(
    {
      config: { selectedPet: 'Pig' },
      traits: new Set([TRAIT.PACK_ALPHA, TRAIT.PETS_PROWESS]),
      runtime: {
        profession: {
          core: { activePet: 'Pig' },
          specialization: { kind: 'Soulbeast', state: { beastmodeActive: true } }
        }
      }
    },
    baseAttributes
  );

  assert.equal(soulbeastAttributes.power, 300);
  assert.equal(soulbeastAttributes.ferocity, 400);
  assert.equal(soulbeastAttributes.toughness, 150);
  assert.equal(soulbeastAttributes.vitality, 1150);

  for (const id of ['ranger.furious-strength', 'ranger.twice-as-vicious-strike', 'ranger.twice-as-vicious-condition']) {
    assert.equal(soulbeastOperations.get(id), 'damage-additive', id);
  }

  const baseline = simulate('Core', ['Rapid Fire'], {
    primaryWeapon: 'Longbow'
  });
  const farsighted = simulate('Core', ['Rapid Fire'], {
    primaryWeapon: 'Longbow',
    selectedTraitIds: [TRAIT.FARSIGHTED]
  });

  assert.equal(farsighted.totalDamage > baseline.totalDamage, true);

  const dodgeBaseline = simulate('Core', ['Dodge', 'Rapid Fire'], {
    primaryWeapon: 'Longbow'
  });
  const lightOnYourFeet = simulate('Core', ['Dodge', 'Rapid Fire'], {
    primaryWeapon: 'Longbow',
    selectedTraitIds: [TRAIT.LIGHT_ON_YOUR_FEET]
  });

  assert.ok(Math.abs(lightOnYourFeet.totalDamage / dodgeBaseline.totalDamage - 1.1) < 1e-9);

  const cycloneRotation = ['Summon Cyclone Bow', 'Bluster', 'Fleeting Zephyr', "Quarry's Peril", 'Pelt'];
  const cyclone = simulate('Galeshot', cycloneRotation);
  const farsightedCyclone = simulate('Galeshot', cycloneRotation, {
    selectedTraitIds: [TRAIT.FARSIGHTED]
  });

  assert.equal(farsightedCyclone.totalDamage, cyclone.totalDamage);

  const boonConfig = {
    primaryWeapon: 'Longbow',
    boons: { alacrity: true, fury: true, regeneration: true }
  };
  const boonBaseline = simulate('Core', ['Rapid Fire'], boonConfig);
  const bountiful = simulate('Core', ['Rapid Fire'], {
    ...boonConfig,
    selectedTraitIds: [TRAIT.BOUNTIFUL_HUNTER]
  });

  assert.ok(Math.abs(bountiful.totalDamage / boonBaseline.totalDamage - 1.03) < 1e-9);

  const survival = simulate('Core', ['Rapid Fire'], {
    primaryWeapon: 'Longbow',
    selectedTraitIds: [TRAIT.SURVIVAL_INSTINCTS]
  });
  const predator = simulate('Core', ['Rapid Fire'], {
    primaryWeapon: 'Longbow',
    selectedTraitIds: [TRAIT.PREDATORS_ONSLAUGHT]
  });
  const wolfsong = simulate('Core', ['Rapid Fire'], {
    primaryWeapon: 'Longbow',
    selectedTraitIds: [TRAIT.WOLFSONG]
  });

  assert.ok(Math.abs(survival.totalDamage / baseline.totalDamage - 1.15) < 1e-9);
  assert.ok(Math.abs(predator.totalDamage / baseline.totalDamage - 1.1) < 1e-9);
  assert.ok(Math.abs(wolfsong.totalDamage / baseline.totalDamage - 1.1) < 1e-9);

  const daggerBaseline = simulate('Core', ['Double Arc'], {
    primaryWeapon: 'Dagger'
  });
  const ambidexterity = simulate('Core', ['Double Arc'], {
    primaryWeapon: 'Dagger',
    selectedTraitIds: [TRAIT.AMBIDEXTERITY]
  });

  assert.ok(
    ambidexterity.endState.cooldowns['Double Arc'].readyAt < daggerBaseline.endState.cooldowns['Double Arc'].readyAt
  );

  const poisonBaseline = simulate('Core', ['Poison Volley', { type: 'wait', durationMs: 10000 }], {
    primaryWeapon: 'Shortbow'
  });
  const strongerPoison = simulate('Core', ['Poison Volley', { type: 'wait', durationMs: 10000 }], {
    primaryWeapon: 'Shortbow',
    selectedTraitIds: [TRAIT.POISON_MASTER]
  });

  assert.ok(Math.abs(strongerPoison.conditionDamage / poisonBaseline.conditionDamage - 1.25) < 1e-9);

  const skirmishing = simulate('Soulbeast', ['__combat_start', 'Swap Weapons', 'Whirling Defense'], {
    selectedPet: 'Pig',
    primaryWeapon: 'Hammer',
    weaponSet2Primary: 'Axe',
    weaponSet2Secondary: 'Axe',
    boons: { fury: true, quickness: true, alacrity: true },
    selectedTraitIds: [
      TRAIT.TAIL_WIND,
      TRAIT.FURIOUS_GRIP,
      TRAIT.SHARPENED_EDGES,
      TRAIT.HUNTERS_TACTICS,
      TRAIT.VICIOUS_QUARRY
    ]
  });

  assert.deepEqual(skirmishing.warnings, []);
  assert.equal(
    skirmishing.events.some((event) => event.type === 'buff' && event.kind === 'swiftness'),
    true
  );
  assert.equal(
    skirmishing.events.some((event) => event.type === 'buff' && event.kind === 'fury'),
    true
  );
  assert.equal(
    skirmishing.breakdown.some((entry) => entry.name === 'Sharpened Edges — Bleeding' && entry.damage > 0),
    true
  );
});

test('Ranger Nature Magic traits grant support and scale with boons', () => {
  const healing = simulate('Core', ['Troll Unguent', "Hunter's Call", { type: 'wait', durationMs: 10000 }], {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Warhorn',
    selectedTraitIds: [TRAIT.WELLSPRING, TRAIT.CHILD_OF_EARTH, TRAIT.WINDBORNE_NOTES, TRAIT.LINGERING_MAGIC]
  });
  const wells = healing.events.find((event) => event.sourceId === TRAIT.WELLSPRING);
  const notes = healing.events.find((event) => event.sourceId === TRAIT.WINDBORNE_NOTES);

  assert.equal(wells.kind, 'regeneration');
  assert.equal(notes.kind, 'regeneration');
  assert.ok(Math.abs(wells.duration - 6.96) < 1e-9);
  assert.ok(Math.abs(notes.duration - 6.96) < 1e-9);
  assert.equal(
    healing.events.filter((event) => event.sourceId === TRAIT.CHILD_OF_EARTH && event.condition === 'Crippled').length,
    5
  );
  assert.equal(
    healing.events.filter((event) => event.sourceId === TRAIT.CHILD_OF_EARTH && event.condition === 'Slow').length,
    5
  );
  assert.equal(
    healing.events.filter((event) => event.sourceId === TRAIT.CHILD_OF_EARTH && event.condition === 'Immobilized')
      .length,
    1
  );

  const beast = simulate('Core', ['Intimidating Howl'], {
    selectedPet: 'Krytan Drakehound',
    selectedTraitIds: [TRAIT.REJUVENATION, TRAIT.WOLFSONG, TRAIT.LINGERING_MAGIC]
  });
  const rejuvenation = beast.events.find((event) => event.sourceId === TRAIT.REJUVENATION);

  assert.ok(Math.abs(rejuvenation.duration - 11.6) < 1e-9);
  assert.equal(
    beast.events.some(
      (event) =>
        event.sourceId === TRAIT.WOLFSONG &&
        event.type === 'condition' &&
        event.condition === 'Vulnerability' &&
        event.stacks === 6 &&
        event.duration === 6
    ),
    true
  );

  const petBoonBaseline = simulate('Core', ['Call of the Wild', 'Intimidating Howl'], {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Warhorn',
    selectedPet: 'Krytan Drakehound'
  });
  const petBountiful = simulate('Core', ['Call of the Wild', 'Intimidating Howl'], {
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Warhorn',
    selectedPet: 'Krytan Drakehound',
    selectedTraitIds: [TRAIT.BOUNTIFUL_HUNTER]
  });
  const petHit = (result) => result.resolvedEvents.find((event) => event.skillId === ID.INTIMIDATING_HOWL).damage;

  assert.ok(
    Math.abs(petHit(petBountiful) / petHit(petBoonBaseline) - 1.03) < 1e-9,
    JSON.stringify({
      baseline: petHit(petBoonBaseline),
      bountiful: petHit(petBountiful),
      ratio: petHit(petBountiful) / petHit(petBoonBaseline)
    })
  );
});

test('Ranger pet-swap and Marksmanship traits resolve at their combat timings', () => {
  const swapped = simulate('Core', ['__combat_start', 'Swap Pets'], {
    selectedPet: 'Carrion Devourer',
    selectedPet2: 'Fanged Iboga',
    selectedTraitIds: [TRAIT.SPIRITED_ARRIVAL, TRAIT.CLARION_BOND]
  });

  assert.deepEqual(swapped.warnings, []);
  assert.equal(swapped.endState.profession.petSwapCount, 1);
  assert.equal(swapped.endState.profession.activePetSlot, 2);
  assert.equal(swapped.endState.profession.activePet, 'Fanged Iboga');
  assert.deepEqual(swapped.endState.profession.petNames, ['Carrion Devourer', 'Fanged Iboga']);
  assert.equal(swapped.endState.profession.activePetSkillIds.includes(ID.CONSUMING_BITE), true);
  assert.equal(
    swapped.events.some(
      (event) =>
        event.sourceId === TRAIT.SPIRITED_ARRIVAL &&
        event.kind === 'might' &&
        event.stacks === 6 &&
        event.duration === 12
    ),
    true
  );
  assert.equal(
    swapped.events.some(
      (event) => event.sourceId === TRAIT.SPIRITED_ARRIVAL && event.kind === 'fury' && event.duration === 8
    ),
    true
  );
  assert.equal(
    swapped.resolvedEvents.some((event) => event.sourceId === TRAIT.CLARION_BOND && event.type === 'combo'),
    false
  );
  assert.equal(
    swapped.events.some(
      (event) => event.sourceId === TRAIT.CLARION_BOND && event.condition === 'Weakness' && event.duration === 5
    ),
    true
  );

  const opening = simulate('Core', ['Rapid Fire'], {
    primaryWeapon: 'Longbow',
    selectedTraitIds: [TRAIT.OPENING_STRIKE, TRAIT.ALPHA_FOCUS, TRAIT.PRECISE_STRIKE, TRAIT.REMORSELESS]
  });
  const rapidHits = opening.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillId === ID.RAPID_FIRE
  );

  assert.equal(rapidHits[0].criticalChance, 1);
  assert.equal(rapidHits[1].criticalChance < 1, true);
  assert.equal(
    opening.resolvedEvents.some(
      (event) => event.sourceId === TRAIT.OPENING_STRIKE && event.condition === 'Vulnerability' && event.stacks === 5
    ),
    true
  );

  const openingWithoutRemorseless = simulate('Core', ['Rapid Fire'], {
    primaryWeapon: 'Longbow',
    selectedTraitIds: [TRAIT.OPENING_STRIKE, TRAIT.PRECISE_STRIKE]
  });
  const firstOpeningHit = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.RAPID_FIRE).damage;

  assert.ok(Math.abs(firstOpeningHit(opening) / firstOpeningHit(openingWithoutRemorseless) - 1.25) < 1e-9);

  const rearmed = simulate('Core', ['Rapid Fire', 'Swap Weapons', 'Call of the Wild', "Winter's Bite"], {
    primaryWeapon: 'Longbow',
    weaponSet2Primary: 'Axe',
    weaponSet2Secondary: 'Warhorn',
    selectedTraitIds: [TRAIT.OPENING_STRIKE, TRAIT.REMORSELESS]
  });

  assert.equal(rearmed.resolvedEvents.filter((event) => event.sourceId === TRAIT.OPENING_STRIKE).length, 2);
  assert.equal(
    opening.resolvedEvents.some((event) => event.sourceId === TRAIT.ALPHA_FOCUS && event.condition === 'Crippled'),
    true
  );

  const gaze = simulate('Core', ['Rapid Fire'], {
    primaryWeapon: 'Longbow',
    target: { health: 1 },
    selectedTraitIds: [TRAIT.HUNTERS_GAZE]
  });
  const gazeApplications = gaze.procSteps.filter((step) => step.skill === "Hunter's Gaze");

  assert.equal(gazeApplications.length, 1);
  assert.equal(gazeApplications[0].detail, '3 might');
});

test('Ranger Wilderness Survival traits cover endurance, poison, and disables', () => {
  const baseDodge = simulate('Core', ['Dodge', 'Dodge', 'Dodge']);
  const naturalVigor = simulate('Core', ['Dodge', 'Dodge', 'Dodge'], {
    selectedTraitIds: [TRAIT.NATURAL_VIGOR]
  });

  assert.equal(naturalVigor.steps[2].start < baseDodge.steps[2].start, true);

  const carnivore = simulate('Core', ['Concussion Shot'], {
    primaryWeapon: 'Shortbow',
    selectedTraitIds: [TRAIT.CARNIVORE]
  });
  const stolen = carnivore.resolvedEvents.find((event) => event.sourceId === TRAIT.CARNIVORE);

  assert.equal(stolen.damageKind, 'life-steal');
  assert.equal(stolen.coefficient, 0.05);

  const spider = simulate('Core', ['Spit', { type: 'wait', durationMs: 4000 }], {
    selectedPet: 'Forest Spider',
    selectedTraitIds: [TRAIT.ARACHNOPHOBIA]
  });
  const devourer = simulate('Core', ['__combat_start', { type: 'wait', durationMs: 4000 }], {
    selectedPet: 'Carrion Devourer',
    selectedTraitIds: [TRAIT.ARACHNOPHOBIA]
  });

  for (const [result, duration, effectiveDuration] of [
    [spider, 3, 3.75],
    [devourer, 1.5, 1.875]
  ]) {
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.resolvedEvents.some(
        (event) =>
          event.sourceId === TRAIT.ARACHNOPHOBIA &&
          event.condition === 'Torment' &&
          event.stacks === 1 &&
          event.duration === duration &&
          event.effectiveDuration === effectiveDuration &&
          event.summonBaseExpertise === 375
      ),
      true
    );
  }

  const twinDartsBleeding = rangerCatalog.skillsById
    .get(ID.TWIN_DARTS)
    .effects.find(({ type, condition, ticks }) =>
      type === 'condition' ? condition === 'Bleeding' || ticks?.some((tick) => tick.condition === 'Bleeding') : false
    );

  assert.deepEqual(
    twinDartsBleeding.ticks.map(({ stacks, duration }) => [stacks, duration]),
    [
      [2, 2],
      [2, 2]
    ]
  );

  const familyAttackDoesNotArmPoisonMaster = simulate(
    'Core',
    ['__combat_start', 'Spit', { type: 'wait', durationMs: 4000 }],
    {
      selectedPet: 'Forest Spider',
      selectedTraitIds: [TRAIT.POISON_MASTER]
    }
  );

  assert.equal(
    familyAttackDoesNotArmPoisonMaster.resolvedEvents.some((event) => event.sourceId === TRAIT.POISON_MASTER),
    false
  );
  const armedSpider = simulate('Core', ['__combat_start', 'Deadly Venom', 'Spit', { type: 'wait', durationMs: 8000 }], {
    selectedPet: 'Forest Spider',
    selectedTraitIds: [TRAIT.POISON_MASTER]
  });

  assert.equal(
    armedSpider.resolvedEvents.some(
      (event) => event.sourceId === TRAIT.POISON_MASTER && event.condition === 'Poisoned' && event.stacks === 2
    ),
    true
  );

  const poisonMaster = simulate(
    'Core',
    ['__combat_start', 'Intimidating Howl', { type: 'wait', durationMs: 20500 }, 'Intimidating Howl'],
    {
      selectedPet: 'Krytan Drakehound',
      selectedTraitIds: [TRAIT.POISON_MASTER]
    }
  );

  assert.equal(
    poisonMaster.resolvedEvents.some(
      (event) =>
        event.sourceId === TRAIT.POISON_MASTER &&
        event.condition === 'Poisoned' &&
        event.stacks === 2 &&
        event.duration === 8
    ),
    true
  );

  const build = createRangerBuildDefaults();

  build.specializations = [
    { name: 'Nature Magic', traits: '2-1-1' },
    { name: 'Wilderness Survival', traits: '3-1-1' }
  ];
  build.weapons = ['Dagger', 'Torch'];
  const attributes = calculateAttributes(build).attributes;
  const withoutWellspring = calculateAttributes(build, [], 1, 'Wellspring').attributes;
  const withoutArachnophobia = calculateAttributes(build, [], 1, 'Arachnophobia').attributes;
  const withoutAmbidexterity = calculateAttributes(build, [], 1, 'Ambidexterity').attributes;

  assert.equal(attributes.Expertise.final - withoutArachnophobia.Expertise.final, 150);
  assert.equal(attributes['Condition Damage'].final - withoutAmbidexterity['Condition Damage'].final, 240);
  assert.equal(
    attributes['Healing Power'].final - withoutWellspring['Healing Power'].final,
    (attributes.Power.base +
      attributes.Power.gear +
      attributes.Power.runes +
      attributes.Power.food +
      attributes.Power.infusions +
      attributes.Power.jbc) *
      0.07
  );

  const petTraitContext = {
    config: { selectedPet: 'Forest Spider', stats: { power: 2000 } },
    traits: new Set([TRAIT.ARACHNOPHOBIA, TRAIT.LINGERING_MAGIC, TRAIT.WELLSPRING]),
    event: {
      actorType: 'summon',
      source: 'ranger-pet',
      summonBasePower: 1500
    },
    time: 0,
    runtime: { activeWeaponSet: 1 },
    query: { mightStacksAt: () => 0 }
  };
  const petAttributes = rangerCoreAttributeRules.modifyAttributes(petTraitContext, {
    power: 2000,
    precision: 1000,
    toughness: 1000,
    vitality: 1000,
    ferocity: 0,
    conditionDamage: 1000,
    expertise: 0,
    concentration: 0,
    healingPower: 0
  });

  assert.equal(petAttributes.expertise, 375);
  assert.equal(petAttributes.concentration, 240);
  assert.ok(Math.abs(petAttributes.healingPower - 105) < 1e-9);
});

test('Ranger is wired through the selector and application adapter', async () => {
  const page = await readFile(new URL('../../../ranger.html', import.meta.url), 'utf8');

  assert.equal(
    professionOptions.some((option) => option.id === 'ranger'),
    true
  );
  assert.equal((await loadProfession('ranger'))?.id, 'ranger');
  assert.equal((await loadProfessionAppAdapter('ranger'))?.id, 'ranger');
  assert.match(page, /data-profession="ranger"/);
});
