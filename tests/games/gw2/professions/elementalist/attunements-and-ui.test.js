import { planningFixture } from '#tests/helpers/observed-runtime.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import assert from 'node:assert/strict';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import test from 'node:test';
import { runNative, resolvedAndScheduledEvents } from '#tests/helpers/elementalist-simulation.js';
import { timelineWeaponRows } from '#gw2/app/rotation/timeline/model.js';
import { paletteSkillView } from '#gw2/app/rotation/palette/model.js';
import { renderPalette } from '#gw2/app/rotation/palette/view.js';
import { activeResourceGroup, renderStartResource } from '#gw2/app/rotation/palette/resource-view.js';
import { weaponPaletteRows } from '#gw2/app/rotation/palette/model.js';
import { elementalistAppAdapter } from '#gw2/professions/elementalist/app/app-definition.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { FIRE_ELEMENTAL_EVTC_PROFILE } from '#gw2/professions/elementalist/core/mechanics/elementals/profiles.js';
import { createElementalistCoreState } from '#gw2/professions/elementalist/core/state.js';
import { elementalistCoreHooks } from '#gw2/professions/elementalist/core/hooks.js';
import { projectedFreshAirReadyAt } from '#gw2/professions/elementalist/core/traits/critical-procs.js';
import { ELEMENTALIST_TRAIT_IDS as TRAIT } from '#gw2/professions/elementalist/data/ids.js';

test('Fresh Air keeps only future strike wakes for selected builds', () => {
  // Wakes are candidates, including cancellable strikes; only resolved criticals reset recharge.
  for (const selected of [false, true]) {
    const core = createElementalistCoreState();
    const runtime = { profession: { core }, time: 1, config: {}, traits: new Set(selected ? [TRAIT.FRESH_AIR] : []) };
    const prepare = (at, overrides = {}) =>
      elementalistCoreHooks.prepareEvent(runtime, {
        type: 'damage',
        actorType: 'player',
        coefficient: 1,
        at,
        ...overrides
      });
    for (const at of [9, 3, 6, 3]) prepare(at);
    prepare(1);
    prepare(2, { actorType: 'summon' });
    prepare(2, { coefficient: 0 });
    prepare(2, { type: 'condition' });
    prepare(4, { cancelled: true });
    if (!selected) {
      assert.deepEqual(core.freshAirCandidates, []);
      assert.equal(projectedFreshAirReadyAt(runtime, 10), null);
      continue;
    }

    assert.deepEqual(core.freshAirCandidates, [9, 3, 6, 3, 4]);
    assert.equal(projectedFreshAirReadyAt(runtime, 2), null);
    assert.equal(projectedFreshAirReadyAt(runtime, 3), 3);
    runtime.time = 3;
    assert.equal(projectedFreshAirReadyAt(runtime, 4), 4);
    assert.deepEqual(core.freshAirCandidates, [9, 3, 6, 3, 4]);
    runtime.time = 4;
    prepare(8);
    assert.deepEqual(core.freshAirCandidates, [9, 6, 8]);
    core.primaryAttunement = 'Air';
    assert.equal(projectedFreshAirReadyAt(runtime, 10), null);
    core.primaryAttunement = 'Fire';
    assert.equal(projectedFreshAirReadyAt(runtime, 10), 6);
    runtime.time = 9;
    assert.equal(projectedFreshAirReadyAt(runtime, 20), null);
    assert.deepEqual(core.freshAirCandidates, [9, 6, 8]);
  }
});

test('all native Elementalist specializations retain two equipped sets without combat swapping', () => {
  assert.equal(elementalistProfession.resolveProfession().canSwapWeaponSetsInCombat, false);
  assert.equal(elementalistCatalog.skillsByName.has('Swap Weapons'), true);

  for (const specialization of ['Core', 'Tempest', 'Weaver', 'Catalyst', 'Evoker']) {
    const build = elementalistAppAdapter.toApplicationBuild({
      ...elementalistProfession.createBuildDefaults(),
      alternateWeapons: ['Staff', ''],
      startingWeaponSet: 2,
      specializations:
        specialization === 'Core'
          ? [
              { name: 'Fire', traits: '1-1-1' },
              { name: 'Air', traits: '1-1-1' },
              { name: 'Arcane', traits: '1-1-1' }
            ]
          : [
              { name: 'Fire', traits: '1-1-1' },
              { name: 'Air', traits: '1-1-1' },
              { name: specialization, traits: '1-1-1' }
            ]
    });

    assert.deepEqual(build.alternateWeapons, ['Staff', ''], specialization);
    assert.equal(build.startingWeaponSet, 2, specialization);
  }
});

test('Tempest mechanics execute through native hooks', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Tempest']],
    rotation: [6000, 'Overload Fire', 'Air Attunement', 'Fire Attunement'],
    startAttunement: 'Fire'
  });
  const overload = result.events.find((event) => event.type === 'action' && event.skillName === 'Overload Fire');
  const swaps = result.events.filter((event) => event.type === 'elementalist.attunement');

  assert.ok(observedRuntime(result).cooldownController.readyAt(overload.skillId) > overload.endsAt);
  assert.deepEqual(
    swaps.map((event) => event.to),
    ['Air', 'Fire']
  );
  assert.ok(swaps[1].at >= observedRuntime(result).cooldownController.readyAt(overload.skillId));
  assert.equal(result.planningState.profession.primaryAttunement, 'Fire');
});

test('Tempest overloads activate Relic of Fireworks as profession mechanics', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Tempest']],
    rotation: ['Overload Air'],
    startAttunement: 'Air',
    targetHealth: 0
  });

  assert.equal(
    result.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Overload Air')
      .every((event) => event.skillWeapon === 'Profession mechanic'),
    true
  );
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Relic of Fireworks'),
    true
  );
});

test("Updraft's 0-damage hit activates Relic of Fireworks", () => {
  const result = runNative({
    lines: [['Air'], ['Fire'], ['Arcane']],
    rotation: ['Updraft', 3000],
    startAttunement: 'Air'
  });
  const procs = result.procSteps.filter((step) => step.skill === 'Relic of Fireworks');

  assert.ok(procs.length > 0);
  assert.ok(procs.every((step) => step.sourceSkill === 'Updraft'));
});

test('Catalyst mechanics execute through native hooks', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Catalyst']],
    rotation: ['Deploy Jade Sphere (Fire)', 'Arcane Wave', 1000],
    initialCatalystEnergy: 30
  });

  assert.equal(result.planningState.profession.catalystEnergy.value, 20);
  assert.equal(result.planningState.profession.catalystEnergy.maximum, 30);
  assert.equal(
    resolvedAndScheduledEvents(result).some(
      (event) => event.type === 'combo' && event.fieldType === 'Fire' && event.finisherType === 'Blast'
    ),
    true
  );
});

test('a Fulgor recast replaces the pending secondary action pulses', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Catalyst']],
    rotation: ['Fulgor', 1600, 'Elemental Celerity', 'Fulgor', 6000],
    startAttunement: 'Air',
    weapons: ['Spear', ''],
    selectedSkillIds: { Elite: 62725 },
    targetHealth: 0
  });
  const secondary = result.events.filter(
    (event) => event.type === 'damage' && event.skillName === 'Fulgor' && event.actorType === 'effect'
  );
  const activePulses = secondary.filter((event) => event.type === 'damage');
  const casts = result.events.filter((event) => event.type === 'action' && event.skillName === 'Fulgor');
  assert.ok(activePulses.some((event) => event.activationId === casts[0].activationId));
  assert.ok(activePulses.some((event) => event.activationId === casts[1].activationId));
  assert.ok(activePulses.every((event) => event.activationId !== casts[0].activationId || event.at <= casts[1].endsAt));
});

test('Tempest party boons affect the summoned elemental', () => {
  const simulateSharing = (sharePlayerBoonsWithSummons) =>
    runNative({
      lines: [['Fire'], ['Air'], ['Tempest', '1-1-1']],
      rotation: ['Glyph of Elementals', 'Feel the Burn!', 1000, 'Flame Barrage', 3000],
      startAttunement: 'Fire',
      selectedSkillIds: { Heal: 34743, Utility1: 30662, Utility2: 5542, Utility3: 5638, Elite: 25488 },
      assumptions: {
        ...elementalistProfession.createBuildDefaults().assumptions,
        might: 0,
        fury: false,
        quickness: false,
        alacrity: false,
        sharePlayerBoonsWithSummons
      }
    });
  const shared = simulateSharing(true);
  const isolated = simulateSharing(false);
  const feelTheBurnBoons = shared.events.filter(
    (event) =>
      event.type === 'buff' &&
      event.skillName === 'Feel the Burn!' &&
      (event.kind === 'might' || (event.kind === 'fury' && event.duration > 10))
  );

  assert.deepEqual(feelTheBurnBoons.map((event) => [event.kind, event.stacks]).sort(), [
    ['fury', 1],
    ['might', 2],
    ['might', 8]
  ]);
  assert.ok(
    feelTheBurnBoons.every(
      (event) =>
        event.audience?.recipients === 'party' &&
        event.audience.maximumRecipients === 5 &&
        event.resolvedAudience.includesSummons === true &&
        event.resolvedAudience.companionIds.length === 1 &&
        event.resolvedAudience.companionIds[0].startsWith('elementalist-elemental:')
    )
  );
  assert.ok(
    isolated.events
      .filter(
        (event) =>
          event.type === 'buff' &&
          event.skillName === 'Feel the Burn!' &&
          (event.kind === 'might' || (event.kind === 'fury' && event.duration > 10))
      )
      .every(
        (event) => event.resolvedAudience.includesSummons === false && event.resolvedAudience.companionIds.length === 0
      )
  );

  // Both projectile and explosion branches receive pet Might and Fury through the same damage contract.
  for (const hitIndex of [1, 4]) {
    const barrage = (result) =>
      result.resolvedEvents.find(
        (event) => event.type === 'damage' && event.skillName === 'Flame Barrage' && event.hitIndex === hitIndex
      );
    const sharedBarrage = barrage(shared);
    const isolatedBarrage = barrage(isolated);
    assertFlooredDamageMultiplier(
      sharedBarrage.damage,
      isolatedBarrage.damage,
      // The shared ten Might adds 300 pet Power; shared Fury independently changes the expected crit multiplier.
      ((1 + 300 / FIRE_ELEMENTAL_EVTC_PROFILE.basePower) * (1 + sharedBarrage.criticalChance * 0.5)) /
        (1 + isolatedBarrage.criticalChance * 0.5)
    );
    assert.ok(sharedBarrage.criticalChance > isolatedBarrage.criticalChance);
  }
});

test('overload boons are party-scoped', () => {
  const fire = runNative({
    lines: [['Fire'], ['Air'], ['Tempest']],
    rotation: ['Overload Fire', 10000],
    startAttunement: 'Fire'
  });
  const air = runNative({
    lines: [['Fire'], ['Air'], ['Tempest']],
    rotation: ['Overload Air', 10000],
    startAttunement: 'Air'
  });
  const fireMight = fire.events.filter(
    (event) => event.type === 'buff' && event.skillName === 'Overload Fire' && event.kind === 'might'
  );
  const airFury = air.events.filter(
    (event) => event.type === 'buff' && event.skillName === 'Overload Air' && event.kind === 'fury'
  );

  assert.equal(fireMight.length, 10);
  assert.ok(
    fireMight.every(
      (event) =>
        event.stacks === 2 &&
        event.audience?.recipients === 'party' &&
        event.audience.maximumRecipients === 5 &&
        event.resolvedAudience.includesSummons === true
    )
  );
  assert.equal(airFury.length, 14);
  assert.ok(
    airFury.every((event) => event.audience?.recipients === 'party' && event.resolvedAudience.includesSummons === true)
  );
});

test("Fox's Fury and catalyst spheres grant their boons to the party", () => {
  const evoker = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ["Fox's Fury"],
    evokerElement: 'Fire',
    selectedSkillIds: { Heal: 34743, Utility1: 76711, Utility2: 5542, Utility3: 5638, Elite: 25488 }
  });
  const foxBoons = evoker.events.filter(
    (event) => event.type === 'buff' && event.skillName === "Fox's Fury" && ['might', 'fury'].includes(event.kind)
  );

  assert.deepEqual(
    foxBoons.map((event) => [event.kind, event.stacks, event.duration]),
    [
      ['might', 11, 10],
      ['fury', 1, 10]
    ]
  );
  assert.ok(
    foxBoons.every(
      (event) =>
        event.audience?.recipients === 'party' &&
        event.audience.maximumRecipients === 5 &&
        event.resolvedAudience.includesSummons === true
    )
  );

  const catalyst = runNative({
    lines: [['Fire'], ['Air'], ['Catalyst', '1-3-1']],
    rotation: ['Deploy Jade Sphere (Fire)', 5000],
    initialCatalystEnergy: 30
  });
  const sphereBoons = catalyst.events.filter(
    (event) =>
      event.type === 'buff' &&
      event.skillName === 'Deploy Jade Sphere (Fire)' &&
      ['might', 'quickness'].includes(event.kind)
  );

  assert.equal(sphereBoons.filter((event) => event.kind === 'might').length, 7);
  assert.equal(sphereBoons.filter((event) => event.kind === 'quickness').length, 1);
  assert.ok(
    sphereBoons.every(
      (event) =>
        event.audience?.recipients === 'party' &&
        event.audience.maximumRecipients === 5 &&
        event.resolvedAudience.includesSummons === true
    )
  );
});

test('Core mechanics execute through native hooks', () => {
  const result = runNative({
    lines: [['Fire'], ['Air', '1-1-2'], ['Arcane']],
    rotation: [{ type: 'combat-start' }, 'Fire Attunement', 'Flame Uprising', 'Ring of Fire'],
    startAttunement: 'Air'
  });
  const proc = result.events.find((event) => event.type === 'elementalist.fresh-air');

  assert.ok(proc);
  assert.equal(
    observedRuntime(result).cooldownController.readyAt(elementalistCatalog.skillsByName.get('Air Attunement').id),
    undefined
  );
});

test('Fresh Air resets both Air Attunement and Overload Air', () => {
  const result = runNative({
    lines: [['Fire'], ['Air', '1-1-2'], ['Tempest']],
    rotation: [6000, 'Overload Air', 'Fire Attunement', 'Flame Uprising', 'Ring of Fire'],
    startAttunement: 'Air'
  });
  const proc = result.events.find((event) => event.type === 'elementalist.fresh-air');

  assert.ok(proc);
  assert.equal(
    observedRuntime(result).cooldownController.readyAt(elementalistCatalog.skillsByName.get('Air Attunement').id),
    undefined
  );
  assert.equal(result.planningState.cooldowns[5494], undefined);
  assert.equal(result.planningState.cooldowns[29719], undefined);
});

test('Fresh Air consumes sampled criticals after scheduled strikes in RNG mode', () => {
  // No critical-triggered equipment should be needed to sample Fresh Air's hits.
  const result = runNative({
    lines: [['Fire'], ['Air', '1-1-2'], ['Tempest']],
    rotation: [6000, 'Overload Air', 'Fire Attunement', 'Flame Uprising', 'Ring of Fire'],
    startAttunement: 'Air',
    sigils: ['', ''],
    food: '',
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      simulationMode: 'stochastic'
    }
  });
  const procs = result.events.filter((event) => event.type === 'elementalist.fresh-air');

  assert.equal(result.randomness.mode, 'stochastic');
  assert.ok(procs.length > 0);
  for (const proc of procs) {
    assert.ok(
      result.resolvedEvents.some(
        (event) =>
          event.type === 'damage' &&
          event.at === proc.at &&
          event.skillName === proc.sourceSkill &&
          event.didCrit === true
      )
    );
  }

  assert.equal(
    observedRuntime(result).cooldownController.readyAt(elementalistCatalog.skillsByName.get('Air Attunement').id),
    undefined
  );
  assert.equal(result.planningState.cooldowns[5494], undefined);
  assert.equal(result.planningState.cooldowns[29719], undefined);
});

test('Fresh Air resolves a queued critical after an intervening attunement', () => {
  const result = runNative({
    lines: [['Fire'], ['Air', '3-3-2'], ['Tempest', '3-1-2']],
    weapons: ['Hammer', ''],
    rotation: [{ type: 'combat-start' }, 'Earth Attunement', 'Rocky Loop', 'Water Attunement', 'Air Attunement'],
    startAttunement: 'Air',
    targetHealth: 0
  });
  const air = result.steps.find((step) => step.skill === 'Air Attunement');
  const reset = result.events.find(
    (event) => event.type === 'elementalist.fresh-air' && event.sourceSkill === 'Rocky Loop'
  );

  const hit = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Rocky Loop' && event.didCrit
  );
  assert.equal(reset.at, hit.at);
  assert.ok(air.start >= Math.round(reset.at * 1000));
});

test('attunement swaps start labeled rotation timeline rows', () => {
  const transition = elementalistProfession.ui.timelineWeaponLineTransition;
  const rotation = ['Flame Uprising', 'Air Attunement', 'Lightning Strike', 'Water Attunement', 'Water Trident'];
  const build = { startAttunement: 'Fire' };
  const rows = timelineWeaponRows(rotation, {
    startingWeaponLine: transition({
      initial: true,
      specialization: 'Core',
      build
    }),
    isWeaponSwap: () => false,
    weaponLineTransition(entry, current) {
      const name = typeof entry === 'string' ? entry : entry.name;

      return transition({
        entry: { name },
        skill: elementalistCatalog.skillsByName.get(name),
        specialization: 'Core',
        build,
        ...current
      });
    }
  });

  assert.deepEqual(
    rows.map((row) => row.weaponLine),
    ['Fire', 'Air', 'Water']
  );
  assert.deepEqual(
    rows.map((row) => row.skills.map((skill) => skill.index)),
    [[0, 1], [2, 3], [4]]
  );
});

test('Weaver timeline rows show both active attunements', () => {
  const transition = elementalistProfession.ui.timelineWeaponLineTransition;
  const build = {
    startAttunement: 'Fire',
    secondaryAttunement: 'Air'
  };
  const rows = timelineWeaponRows(['Water Attunement', 'Air Attunement', 'Earth Attunement'], {
    startingWeaponLine: transition({
      initial: true,
      specialization: 'Weaver',
      build
    }),
    isWeaponSwap: () => false,
    weaponLineTransition(entry, current) {
      const name = typeof entry === 'string' ? entry : entry.name;

      return transition({
        entry: { name },
        skill: elementalistCatalog.skillsByName.get(name),
        specialization: 'Weaver',
        build,
        ...current
      });
    }
  });

  assert.deepEqual(
    rows.map((row) => row.weaponLine),
    ['F/A', 'W/F', 'A/W']
  );
});

test('Unravel starts a fully attuned Weaver timeline row', () => {
  const transition = elementalistProfession.ui.timelineWeaponLineTransition;
  const build = {
    startAttunement: 'Air',
    secondaryAttunement: 'Fire'
  };
  const rows = timelineWeaponRows(['Pyro Vortex', 'Unravel', 'Polaric Leap'], {
    startingWeaponLine: transition({
      initial: true,
      specialization: 'Weaver',
      build
    }),
    isWeaponSwap: () => false,
    weaponLineTransition(entry, current) {
      const name = typeof entry === 'string' ? entry : entry.name;

      return transition({
        entry: { name },
        skill: elementalistCatalog.skillsByName.get(name),
        specialization: 'Weaver',
        build,
        ...current
      });
    }
  });

  assert.deepEqual(
    rows.map((row) => row.weaponLine),
    ['A/F', 'A/A']
  );
  assert.deepEqual(
    rows.map((row) => row.skills.map((skill) => skill.index)),
    [[0, 1], [2]]
  );
});

test('weapon palette rows group Elementalist skills by attunement and slot', () => {
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    alternateWeapons: ['', ''],
    specializations: [
      { name: 'Fire', traits: '1-1-1' },
      { name: 'Air', traits: '1-1-1' },
      { name: 'Arcane', traits: '1-1-1' }
    ]
  });
  const app = {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    activeCatalog: elementalistProfession.catalog,
    skills: elementalistCatalog.skills,
    skillByName: elementalistCatalog.skillsByName,
    skillById: elementalistCatalog.skillsById,
    weaponData: elementalistAppAdapter.weaponData
  };
  const rows = weaponPaletteRows(app, 1);

  assert.deepEqual(
    rows.map((row) => row.label),
    ['Fire', 'Water', 'Air', 'Earth']
  );
  for (const row of rows) {
    const slots = row.skills.map((skill) => Number(skill.slot.split('_')[1]));

    assert.deepEqual(
      slots,
      [...slots].sort((left, right) => left - right)
    );
    assert.deepEqual([...new Set(slots)], [1, 2, 3, 4, 5]);
  }

  app.build.weapons = ['Pistol', 'Dagger'];
  assert.deepEqual(
    weaponPaletteRows(app, 1).map((row) => row.label),
    ['Fire', 'Water', 'Air', 'Earth', 'Special']
  );

  app.build.weapons = ['Sword', 'Warhorn'];
  app.build.specializations[2] = { name: 'Weaver', traits: '1-1-1' };
  const weaverRows = weaponPaletteRows(app, 1);

  assert.deepEqual(
    weaverRows.map((row) => row.label),
    ['Fire', 'Water', 'Air', 'Earth', 'Dual']
  );
  const dual = weaverRows.find((row) => row.label === 'Dual');

  assert.equal(dual.skills.length, 6);
  assert.equal(
    dual.skills.every((skill) => skill.slot === 'Weapon_3'),
    true
  );
});

test('Weaver palette composes the active bar and preserves every slot-three cooldown', () => {
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    weapons: ['Sword', 'Warhorn'],
    alternateWeapons: ['', ''],
    startAttunement: 'Fire',
    secondaryAttunement: 'Water',
    specializations: [
      { name: 'Fire', traits: '1-1-1' },
      { name: 'Air', traits: '1-1-1' },
      { name: 'Weaver', traits: '1-1-1' }
    ]
  });
  const app = {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    activeCatalog: elementalistProfession.catalog,
    skills: elementalistCatalog.skills,
    skillByName: elementalistCatalog.skillsByName,
    skillById: elementalistCatalog.skillsById,
    weaponData: elementalistAppAdapter.weaponData,
    results: {
      planningState: {
        availability: {},
        activeWeaponSet: 1,
        atSeconds: 0,
        cooldowns: {
          [elementalistCatalog.skillsByName.get('Pyro Vortex').id]: { remaining: 3400, readyAt: 3400 }
        },
        // Cooldown-only fixtures still provide the canonical empty ammo projection.
        ammoBySkillId: {},
        profession: {
          primaryAttunement: 'Fire',
          secondaryAttunement: 'Water',
          autoattackChains: {}
        }
      }
    }
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

  assert.match(palette.innerHTML, /data-role="weaver-current-bar"/);
  assert.match(
    palette.innerHTML,
    /<details class="weaver-weapon-palette"[^>]*data-palette-storage-key="gw2-weaver-cooldowns-expanded" open>/
  );
  assert.match(palette.innerHTML, /<summary class="weaver-cooldown-toggle">All weapon skill cooldowns<\/summary>/);
  assert.match(palette.innerHTML, /data-role="weaver-primary-bank"/);
  assert.match(palette.innerHTML, /data-role="weaver-slot-three-bank"/);
  assert.match(palette.innerHTML, /data-role="weaver-secondary-bank"/);
  assert.match(
    palette.innerHTML,
    /data-role="weaver-top-palette"[\s\S]*?data-role="profession-palette-section"[\s\S]*?data-role="weaver-current-bar"[\s\S]*?utility-palette-group[\s\S]*?data-role="weapon-palette-section"/
  );

  const currentStart = palette.innerHTML.indexOf('data-role="weaver-current-bar"');
  const currentEnd = palette.innerHTML.indexOf('utility-palette-group', currentStart);
  const currentHtml = palette.innerHTML.slice(currentStart, currentEnd);

  assert.equal((currentHtml.match(/class="pal-skill/g) || []).length, 5);
  assert.doesNotMatch(currentHtml, /data-palette-static="true"/);
  assert.match(currentHtml, /data-skill="Fire Strike"/);
  assert.doesNotMatch(currentHtml, /data-skill="Fire Swipe"/);
  assert.doesNotMatch(currentHtml, /data-skill="Searing Slash"/);
  assert.deepEqual(
    [...currentHtml.matchAll(/data-attunement="([^"]+)"/g)].map((match) => match[1]),
    ['Fire', 'Fire', 'Fire+Water', 'Water', 'Water']
  );

  const bankHtml = [...palette.innerHTML.matchAll(/<section class="weaver-cooldown-lane[^>]*>[\s\S]*?<\/section>/g)]
    .map((match) => match[0])
    .join('');

  assert.equal((bankHtml.match(/class="weaver-cooldown-lane/g) || []).length, 3);
  const bankSkillCount = (bankHtml.match(/class="pal-skill/g) || []).length;

  assert.equal((bankHtml.match(/data-palette-static="true"/g) || []).length, bankSkillCount);
  assert.doesNotMatch(bankHtml, /draggable="true"/);
  assert.doesNotMatch(bankHtml, /data-hotkey-action=/);
  assert.doesNotMatch(bankHtml, /weaver-skill-cell is-equipped/);

  const sameStart = palette.innerHTML.indexOf('data-weaver-variant="same"');
  const dualStart = palette.innerHTML.indexOf('data-weaver-variant="dual"');
  const secondaryStart = palette.innerHTML.indexOf('data-role="weaver-secondary-bank"');
  const sameHtml = palette.innerHTML.slice(sameStart, dualStart);
  const dualHtml = palette.innerHTML.slice(dualStart, secondaryStart);

  assert.equal((sameHtml.match(/class="pal-skill/g) || []).length, 4);
  assert.equal((dualHtml.match(/class="pal-skill/g) || []).length, 6);
  assert.match(dualHtml, /data-skill="Pyro Vortex"[\s\S]*?<span class="pal-cd">3\.400s<\/span>/);
});

test('weapon bar excludes dual attacks outside Weaver', () => {
  const dual = elementalistCatalog.skillsByName.get('Twin Strike');
  const matches = elementalistProfession.weaponSkillMatchesSet;

  assert.equal(
    matches(dual, ['Sword', 'Warhorn'], {
      specialization: 'Tempest',
      build: {}
    }),
    false
  );
  assert.equal(
    matches(dual, ['Sword', 'Warhorn'], {
      specialization: 'Weaver',
      build: {}
    }),
    true
  );
});

test('starting attunement controls render catalog icons', () => {
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    specializations: [
      { name: 'Fire', traits: '1-1-1' },
      { name: 'Air', traits: '1-1-1' },
      { name: 'Weaver', traits: '1-1-1' }
    ]
  });
  const app = {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    activeCatalog: elementalistProfession.catalog,
    results: null,
    changed() {}
  };
  const selector = { innerHTML: '', querySelectorAll: () => [] };
  const previousDocument = globalThis.document;

  globalThis.document = {
    getElementById: (id) => (id === 'start-att-selector' ? selector : null)
  };
  try {
    renderStartResource(app);
  } finally {
    globalThis.document = previousDocument;
  }

  for (const name of ['Fire', 'Water', 'Air', 'Earth']) {
    const icon = elementalistCatalog.skillsByName.get(`${name} Attunement`).icon;

    assert.ok(icon);
    assert.equal(selector.innerHTML.split(icon).length - 1, 2);
  }

  assert.match(selector.innerHTML, /Primary attunement/);
  assert.match(selector.innerHTML, /Secondary attunement/);
});

test('rotation palette exposes each attunement as an action', () => {
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    alternateWeapons: ['', ''],
    specializations: [
      { name: 'Fire', traits: '1-1-1' },
      { name: 'Air', traits: '1-1-1' },
      { name: 'Arcane', traits: '1-1-1' }
    ]
  });
  const app = {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    activeCatalog: elementalistProfession.catalog,
    skills: elementalistCatalog.skills,
    skillByName: elementalistCatalog.skillsByName,
    skillById: elementalistCatalog.skillsById,
    weaponData: elementalistAppAdapter.weaponData,
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

  assert.match(palette.innerHTML, />Attune</);
  for (const [name, badge] of [
    ['Fire', 'F'],
    ['Water', 'W'],
    ['Air', 'A'],
    ['Earth', 'E']
  ]) {
    assert.match(palette.innerHTML, new RegExp(`data-skill="${name} Attunement"`));
    assert.match(
      palette.innerHTML,
      new RegExp(`data-skill="${name} Attunement"[\\s\\S]*?pal-variant-badge">${badge}<`)
    );
  }

  assert.match(palette.innerHTML, /data-skill="Air Attunement"[^>]*draggable="true"/);

  app.build.specializations[2] = { name: 'Tempest', traits: '1-1-1' };
  globalThis.document = {
    getElementById: (id) => (id === 'rotation-palette' ? palette : null)
  };
  try {
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }

  assert.ok(
    palette.innerHTML.indexOf('data-skill="Overload Air"') < palette.innerHTML.indexOf('data-skill="Air Attunement"')
  );
});

test('Evoker derives F5 from the selected familiar', () => {
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    evokerElement: 'Air',
    initialEvokerEmpowered: 0,
    specializations: [
      { name: 'Fire', traits: '1-1-1' },
      { name: 'Air', traits: '1-1-1' },
      { name: 'Evoker', traits: '1-1-1' }
    ]
  });
  const context = {
    build,
    specialization: 'Evoker',
    professionState: { element: 'Air', empoweredCharges: { value: 0, maximum: 3, rate: 0, updatedAt: 0 } },
    catalog: elementalistCatalog
  };
  const f5 = (professionState) =>
    elementalistProfession.ui
      .paletteGroups({ ...context, professionState })
      .find((group) => group.id === 'elementalist-evoker-familiars');

  assert.deepEqual(f5({ element: 'Air', empoweredCharges: { value: 0, maximum: 3, rate: 0, updatedAt: 0 } }).skillIds, [
    elementalistCatalog.skillsByName.get('Zap').id
  ]);
  assert.deepEqual(f5({ element: 'Air', empoweredCharges: { value: 3, maximum: 3, rate: 0, updatedAt: 0 } }).skillIds, [
    elementalistCatalog.skillsByName.get('Lightning Blitz').id
  ]);

  // Before a result exists, the F5 palette follows the build's configured familiar.
  build.evokerElement = 'Earth';
  assert.deepEqual(f5({}).skillIds, [elementalistCatalog.skillsByName.get('Calcify').id]);
  assert.equal(
    elementalistProfession.ui.startControls(context).some((control) => control.label === 'Familiar'),
    false
  );
});

// Familiar edits must use build state, reject invalid choices, and remain scoped to Evoker.
test('Evoker skill selections update the configured familiar independently of simulated state', () => {
  const build = { evokerElement: 'Fire', startAttunement: 'Water' };
  const context = {
    build,
    specialization: 'Evoker',
    professionState: { element: 'Earth', empoweredCharges: { value: 3, maximum: 3, rate: 0, updatedAt: 0 } },
    catalog: elementalistCatalog
  };
  const ui = elementalistProfession.ui;
  const selection = { key: 'evokerElement', index: 0, value: 'Air' };
  assert.equal(ui.skillBarGroups(context)[0].selections[0].selectionValue, 'Fire');
  for (const value of ['Fire', 'Water', 'Air', 'Earth']) {
    assert.equal(ui.updateSkillBarSelection(context, { ...selection, value }), true);
    assert.equal(build.evokerElement, value);
    assert.equal(ui.skillBarGroups(context)[0].selections[0].selectionValue, value);
  }

  for (const invalid of [{ value: 'Void' }, { index: 1 }, { key: 'startAttunement' }]) {
    assert.equal(ui.updateSkillBarSelection(context, { ...selection, ...invalid }), false);
    assert.equal(build.evokerElement, 'Earth');
  }

  assert.equal(build.startAttunement, 'Water');
  for (const specialization of ['Core', 'Tempest', 'Weaver', 'Catalyst']) {
    assert.deepEqual(ui.skillBarGroups({ ...context, specialization }), []);
    assert.equal(ui.updateSkillBarSelection({ ...context, specialization }, selection), false);
  }
});

test('Evoker familiar palette availability follows current charges', () => {
  const skill = elementalistCatalog.skillsByName.get('Ignite');
  for (const charges of [5, 6]) {
    const state = planningFixture(
      elementalistProfession,
      { specialization: 'Evoker', evokerElement: 'Fire' },
      (runtime) => {
        runtime.resourceController.replace('familiarCharges', charges);
        runtime.resourceController.replace('empoweredCharges', 0);
      }
    );
    assert.equal(state.availability[skill.id].ready, charges === 6);
  }
});

test('Evoker layers familiar charges beside F5', () => {
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    evokerElement: 'Air',
    specializations: [
      { name: 'Fire', traits: '1-1-1' },
      { name: 'Air', traits: '1-1-1' },
      { name: 'Evoker', traits: '1-1-1' }
    ]
  });
  const professionState = {
    element: 'Air',
    familiarCharges: { value: 4, maximum: 6, rate: 0, updatedAt: 0 },
    empoweredCharges: { value: 2, maximum: 3, rate: 0, updatedAt: 0 }
  };
  const context = {
    build,
    specialization: 'Evoker',
    professionState,
    catalog: elementalistCatalog
  };
  const familiar = elementalistProfession.ui
    .paletteGroups(context)
    .find((group) => group.id === 'elementalist-evoker-familiars');
  const [charges] = elementalistProfession.ui.resourceViews(context);

  assert.deepEqual(familiar.resourceIds, ['evoker-charges']);
  assert.equal(familiar.resourcePlacement, 'beside');
  assert.match(familiar.className, /elementalist-evoker-air/);
  assert.equal(charges.pipStyle, 'elementalist-evoker-air-2');
  assert.equal(charges.showValue, false);

  const resourceHtml = activeResourceGroup({
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    activeCatalog: elementalistProfession.catalog,
    results: { planningState: { availability: {}, profession: professionState } }
  });

  assert.match(resourceHtml, /data-resource-id="evoker-charges"/);
  assert.match(resourceHtml, /data-resource-count="4"/);
  assert.match(resourceHtml, /active-resource-pips elementalist-evoker-air-2/);
  assert.doesNotMatch(resourceHtml, /<strong>4\/6<\/strong>/);

  const basicReadyHtml = activeResourceGroup({
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    activeCatalog: elementalistProfession.catalog,
    results: {
      planningState: {
        availability: {},
        profession: {
          ...professionState,
          familiarCharges: { value: 6, maximum: 6, rate: 0, updatedAt: 0 },
          empoweredCharges: { value: 0, maximum: 3, rate: 0, updatedAt: 0 }
        }
      }
    }
  });
  const empoweredReadyHtml = activeResourceGroup({
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    activeCatalog: elementalistProfession.catalog,
    results: {
      planningState: {
        availability: {},
        profession: {
          ...professionState,
          familiarCharges: { value: 4, maximum: 6, rate: 0, updatedAt: 0 },
          empoweredCharges: { value: 3, maximum: 3, rate: 0, updatedAt: 0 }
        }
      }
    }
  });

  assert.match(basicReadyHtml, /data-resource-count="6"/);
  assert.match(basicReadyHtml, /active-resource-pips elementalist-evoker-air-0-ready/);
  assert.match(empoweredReadyHtml, /data-resource-count="4"/);
  assert.match(empoweredReadyHtml, /active-resource-pips elementalist-evoker-air-3/);
});

test('Evoker renders stacked starting controls for basic and empowered charges', () => {
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    specializations: [
      { name: 'Fire', traits: '1-1-1' },
      { name: 'Air', traits: '1-1-1' },
      { name: 'Evoker', traits: '1-1-1' }
    ]
  });
  const app = {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    activeCatalog: elementalistProfession.catalog,
    results: null,
    changed() {}
  };
  const selector = { innerHTML: '', querySelectorAll: () => [] };
  const previousDocument = globalThis.document;

  globalThis.document = {
    getElementById: (id) => (id === 'start-att-selector' ? selector : null)
  };
  try {
    renderStartResource(app);
  } finally {
    globalThis.document = previousDocument;
  }

  const basicControls = selector.innerHTML.match(/data-resource-key="initialEvokerCharges"/g) || [];
  const empoweredControls = selector.innerHTML.match(/data-resource-key="initialEvokerEmpowered"/g) || [];
  const activeBasicControls =
    selector.innerHTML.match(
      /class="resource-pip active"[^>]*data-count="\d" data-resource-key="initialEvokerCharges"/g
    ) || [];
  const activeEmpoweredControls =
    selector.innerHTML.match(
      /class="resource-pip active"[^>]*data-count="\d" data-resource-key="initialEvokerEmpowered"/g
    ) || [];

  assert.equal(build.initialEvokerCharges, 6);
  assert.equal(build.initialEvokerEmpowered, 0);
  assert.match(selector.innerHTML, /class="start-resource-controls"/);
  assert.equal(basicControls.length, 6);
  assert.equal(empoweredControls.length, 3);
  assert.equal(activeBasicControls.length, 6);
  assert.equal(activeEmpoweredControls.length, 0);

  const resources = elementalistProfession.ui.resourceViews({
    build: { ...build, initialEvokerCharges: 4, initialEvokerEmpowered: 2 },
    specialization: 'Evoker',
    professionState: {},
    catalog: elementalistCatalog
  });
  const empowered = resources.find((resource) => resource.id === 'evoker-empowered-charges');

  assert.equal(empowered.maximum, 3);
  assert.equal(empowered.buildKey, 'initialEvokerEmpowered');
  assert.equal(empowered.showInPalette, false);
});

test('Evoker familiar stays available when its element differs from the active attunement', () => {
  const skill = elementalistCatalog.skillsByName.get('Zap');
  for (const charges of [5, 6]) {
    const state = planningFixture(
      elementalistProfession,
      { specialization: 'Evoker', evokerElement: 'Air', startAttunement: 'Fire' },
      (runtime) => {
        runtime.resourceController.replace('familiarCharges', charges);
        runtime.resourceController.replace('empoweredCharges', 0);
      }
    );
    assert.equal(state.availability[skill.id].ready, charges === 6);
  }
});

test('core attunements enforce and report their individual recharge', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: [{ type: 'combat-start' }, 'Air Attunement', 'Water Attunement', 'Fire Attunement'],
    startAttunement: 'Fire',
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      alacrity: false
    }
  });
  const swaps = result.steps.filter((step) => String(step.skill).endsWith(' Attunement'));

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    swaps.map((step) => step.start),
    [0, 1040, 6800]
  );
  assert.equal(result.planningState.profession.primaryAttunement, 'Fire');
  assert.ok(result.planningState.cooldowns[5494].remaining > 1000);
  assert.ok(result.planningState.cooldowns[5493].remaining > 1000);
  const waterAvailability =
    result.planningState.availability[elementalistCatalog.skillsByName.get('Water Attunement').id];

  assert.equal(waterAvailability.ready, false);
  assert.equal(waterAvailability.code, 'elementalist.attunement-recharge');
  assert.ok(waterAvailability.retryAt > result.planningState.atSeconds);
  const waterView = paletteSkillView(
    {
      build: elementalistProfession.createBuildDefaults(),
      adapter: elementalistAppAdapter,
      profession: elementalistProfession,
      activeCatalog: elementalistProfession.catalog,
      skillById: elementalistCatalog.skillsById,
      skillByName: elementalistCatalog.skillsByName,
      results: result
    },
    elementalistCatalog.skillsByName.get('Water Attunement')
  );

  assert.equal(waterView.disabled, true);
  assert.equal(waterView.cooldownLabel, '6.800s');
});

test('Ride the Lightning receives its on-hit cooldown reduction', () => {
  const result = runNative({
    lines: [['Fire'], ['Earth'], ['Arcane']],
    rotation: ['Ride the Lightning'],
    startAttunement: 'Air',
    weapons: ['Sword', 'Dagger'],
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      alacrity: false
    }
  });
  const action = result.events.find((event) => event.type === 'action' && event.skillName === 'Ride the Lightning');

  assert.ok(action);
  assert.ok(Math.abs(observedRuntime(result).cooldownController.readyAt(action.skillId) - action.endsAt - 8) < 1e-9);
});

test('Fresh Air grants ferocity when entering Air, not when resetting it', () => {
  const result = runNative({
    lines: [['Fire'], ['Air', '1-1-2'], ['Arcane']],
    rotation: [{ type: 'combat-start' }, 'Air Attunement', 6000],
    startAttunement: 'Fire'
  });
  const freshAir = result.events.filter((event) => event.type === 'buff' && event.kind === 'fresh-air');

  assert.equal(freshAir.length, 1);
  assert.equal(freshAir[0].duration, 5);
});

test('Weaver attunements use the shared four-second recharge', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Weaver']],
    rotation: [{ type: 'combat-start' }, 'Water Attunement', 'Air Attunement'],
    startAttunement: 'Fire',
    secondaryAttunement: 'Fire',
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      alacrity: false
    }
  });
  const swaps = result.steps.filter((step) => String(step.skill).endsWith(' Attunement'));

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    swaps.map((step) => step.start),
    [0, 3200]
  );
});

test('Unravel resets the current Weaver recharge, fully attunes for five seconds, and preserves future swap recharge', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '1-1-1']],
    rotation: [
      { type: 'combat-start' },
      'Air Attunement',
      'Unravel',
      'Fire Attunement',
      'Earth Attunement',
      'Air Attunement'
    ],
    startAttunement: 'Fire',
    secondaryAttunement: 'Fire',
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      alacrity: false
    }
  });
  const swaps = result.events.filter((event) => event.type === 'elementalist.attunement');

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    swaps.map((event) => [
      event.at,
      event.skillName,
      event.fromSecondaryAttunement,
      event.to,
      event.secondaryAttunement
    ]),
    [
      [0, 'Air Attunement', undefined, 'Air', 'Fire'],
      [0, 'Unravel', 'Fire', 'Air', 'Air'],
      [0, 'Fire Attunement', undefined, 'Fire', 'Fire'],
      [3.2, 'Earth Attunement', undefined, 'Earth', 'Earth'],
      [6.4, 'Air Attunement', undefined, 'Air', 'Earth']
    ]
  );
  assert.equal(result.planningState.profession.unravelUntil, 5);
  assert.equal(result.events.filter((event) => event.type === 'buff' && event.kind === 'elements of rage').length, 4);
});
