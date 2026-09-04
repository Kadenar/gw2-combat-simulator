import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { timelineWeaponRows } from '#gw2/app/rotation/timeline/model.js';
import { paletteSkillView } from '#gw2/app/rotation/palette/model.js';
import { renderPalette } from '#gw2/app/rotation/palette/view.js';
import { activeResourceGroup, renderStartResource } from '#gw2/app/rotation/palette/resource-view.js';
import { weaponPaletteRows } from '#gw2/app/rotation/palette/model.js';
import { elementalistAppAdapter } from '#gw2/professions/elementalist/app/app-definition.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import { elementalistProfession } from '#gw2/professions/elementalist/definition.js';

function canonicalRotation(rotation) {
  return rotation.map((entry) => {
    if (typeof entry === 'number') {
      return { type: 'wait', durationMs: entry };
    }

    if (entry && typeof entry === 'object') return entry;

    return {
      type: 'cast',
      skillId: elementalistCatalog.skillsByName.get(entry).id
    };
  });
}

function createNativeApp({ lines, rotation = [], ...extras }) {
  const commands = canonicalRotation(rotation);
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    specializations: lines.map(([name, traits = '1-1-1']) => ({
      name,
      traits
    })),
    rotation: commands,
    ...extras
  });
  const app = {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    skillByName: elementalistCatalog.skillsByName,
    skillById: elementalistCatalog.skillsById,
    attributeWeaponSet: 1
  };

  elementalistAppAdapter.recalculate(app);

  return { app, commands };
}

function runNative(options) {
  const { app, commands } = createNativeApp(options);

  return simulateGw2({
    profession: elementalistProfession,
    rotation: commands,
    config: elementalistAppAdapter.simulationConfig(app)
  });
}

function resolvedAndScheduledEvents(result) {
  return [...(result.events || []), ...(result.resolvedEvents || [])];
}

test('all native Elementalist specializations use one weapon set', () => {
  assert.equal(elementalistProfession.ui.weaponSwapChangesSet, false);
  assert.equal(elementalistCatalog.skillsByName.has('Swap Weapons'), false);

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

    assert.deepEqual(build.alternateWeapons, ['', ''], specialization);
    assert.equal(build.startingWeaponSet, 1, specialization);
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

  assert.ok(overload.rechargeReadyAt > overload.endsAt);
  assert.deepEqual(
    swaps.map((event) => event.to),
    ['Air', 'Fire']
  );
  assert.ok(swaps[1].at >= overload.rechargeReadyAt);
  assert.equal(result.endState.profession.primaryAttunement, 'Fire');
});

test('Dust Devil retains its measured packet train only after the declared launch cutoff', () => {
  const dustDevil = elementalistCatalog.skillsByName.get('Dust Devil');
  const packetsAfterInterrupt = (interruptAfterMs) => {
    const result = runNative({
      lines: [['Earth'], ['Air'], ['Tempest']],
      rotation: [
        { type: 'cast', skillId: dustDevil.id, interruptAfterMs },
        { type: 'wait', durationMs: 2400 }
      ],
      startAttunement: 'Earth',
      weapons: ['Scepter', 'Dagger']
    });

    return result.events
      .filter((event) => event.type === 'damage' && event.name === 'Dust Devil')
      .map((event) => Math.round(event.at * 1000));
  };

  assert.equal(dustDevil.quicknessCastTimeMs, 320);
  assert.equal(dustDevil.interruptCommitMs, 160);
  assert.deepEqual(packetsAfterInterrupt(159), []);
  assert.deepEqual(packetsAfterInterrupt(160), [160, 1160, 2160]);
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

  assert.equal(result.endState.profession.energy, 20);
  assert.equal(result.endState.profession.maximumEnergy, 30);
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
    selectedSkills: {
      Elite: 'Elemental Celerity'
    },
    targetHealth: 0
  });
  const secondary = result.events.filter((event) => event.fulgorSecondary === true);
  const activePulses = secondary.filter((event) => event.type === 'damage');
  const replacedPulses = secondary.filter((event) => event.cancelled === true);

  assert.equal(activePulses.length, 9);
  assert.equal(replacedPulses.length, 3);
  assert.ok(replacedPulses.every((event) => event.detail === 'replaced by a later Fulgor secondary action'));
});

test('Tempest party boons affect the summoned elemental', () => {
  const simulateSharing = (sharePlayerBoonsWithSummons) =>
    runNative({
      lines: [['Fire'], ['Air'], ['Tempest', '1-1-1']],
      rotation: ['Glyph of Elementals', 'Feel the Burn!', 1000, 'Flame Barrage', 3000],
      startAttunement: 'Fire',
      selectedSkills: {
        Heal: 'Glyph of Elemental Harmony',
        Utility1: 'Feel the Burn!',
        Utility2: 'Signet of Fire',
        Utility3: 'Arcane Wave',
        Elite: 'Glyph of Elementals'
      },
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

  const firstBarrage = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === 'damage' && event.skillName === 'Flame Barrage' && event.hitIndex === 1
    );
  const sharedBarrage = firstBarrage(shared);
  const isolatedBarrage = firstBarrage(isolated);

  const nonCriticalDamage = (event) => event.damage / (1 + event.criticalChance * 0.5);

  assert.ok(Math.abs(nonCriticalDamage(sharedBarrage) - nonCriticalDamage(isolatedBarrage)) < 1e-9);
  assert.ok(sharedBarrage.criticalChance > isolatedBarrage.criticalChance);
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
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: "Fox's Fury",
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
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
    (event) => event.type === 'buff' && event.skillName === 'Deploy Jade Sphere (Fire)'
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
    rotation: ['Fire Attunement', 'Flame Uprising', 'Ring of Fire'],
    startAttunement: 'Air'
  });
  const proc = result.events.find((event) => event.type === 'elementalist.fresh-air');

  assert.ok(proc);
  assert.equal(result.endState.profession.attunementReadyAt.Air, proc.at);
});

test('Fresh Air resets both Air Attunement and Overload Air', () => {
  const result = runNative({
    lines: [['Fire'], ['Air', '1-1-2'], ['Tempest']],
    rotation: [6000, 'Overload Air', 'Fire Attunement', 'Flame Uprising', 'Ring of Fire'],
    startAttunement: 'Air'
  });
  const proc = result.events.find((event) => event.type === 'elementalist.fresh-air');

  assert.ok(proc);
  assert.equal(result.endState.profession.attunementReadyAt.Air, proc.at);
  assert.equal(result.endState.cooldowns['Air Attunement'], undefined);
  assert.equal(result.endState.cooldowns['Overload Air'], undefined);
});

test('Fresh Air lookahead preserves a scheduled reset across an intervening attunement', () => {
  const result = runNative({
    lines: [['Fire'], ['Air', '3-3-2'], ['Tempest', '3-1-2']],
    weapons: ['Hammer', ''],
    rotation: ['Earth Attunement', 'Rocky Loop', 'Water Attunement', 'Air Attunement'],
    startAttunement: 'Air',
    targetHealth: 0
  });
  const air = result.steps.find((step) => step.skill === 'Air Attunement');
  const reset = result.events.find(
    (event) => event.type === 'elementalist.fresh-air' && event.sourceSkill === 'Rocky Loop'
  );

  assert.equal(Math.round(reset.at * 1000), 2000);
  assert.equal(air.start, 2000);
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
    weaponSwapChangesSet: false,
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
    weaponSwapChangesSet: false,
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
    weaponSwapChangesSet: false,
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
    skills: elementalistCatalog.skills,
    skillByName: elementalistCatalog.skillsByName,
    skillById: elementalistCatalog.skillsById,
    weaponData: elementalistAppAdapter.weaponData,
    results: {
      endState: {
        activeWeaponSet: 1,
        time: 0,
        cooldowns: {
          'Pyro Vortex': { remaining: 3400, readyAt: 3400 }
        },
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
  assert.match(dualHtml, /data-skill="Pyro Vortex"[\s\S]*?<span class="pal-cd">3\.40s<\/span>/);
});

test('weapon bar excludes dual attacks outside Weaver', () => {
  const dual = elementalistCatalog.skillsByName.get('Twin Strike');
  const matches = elementalistProfession.ui.weaponSkillMatchesSet;

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

test('Evoker selects its familiar in the skill bar and derives F5', () => {
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
    professionState: { element: 'Air', empowered: 0 },
    catalog: elementalistCatalog
  };
  const familiar = elementalistProfession.ui
    .skillBarGroups(context)
    .find((group) => group.id === 'elementalist-evoker-familiar');
  const selection = familiar.selections[0];

  assert.deepEqual(familiar.skillIds, []);
  assert.equal(selection.selectionKey, 'evokerElement');
  assert.equal(selection.selectionValue, 'Air');
  assert.deepEqual(
    selection.optionEntries.map((option) => option.value),
    ['Fire', 'Water', 'Air', 'Earth']
  );
  assert.equal(
    selection.optionEntries.every((option) => option.icon),
    true
  );

  const f5 = (professionState) =>
    elementalistProfession.ui
      .paletteGroups({ ...context, professionState })
      .find((group) => group.id === 'elementalist-evoker-familiars');

  assert.deepEqual(f5({ element: 'Air', empowered: 0 }).skillIds, [elementalistCatalog.skillsByName.get('Zap').id]);
  assert.deepEqual(f5({ element: 'Air', empowered: 3 }).skillIds, [
    elementalistCatalog.skillsByName.get('Lightning Blitz').id
  ]);

  assert.equal(
    elementalistProfession.ui.updateSkillBarSelection(context, {
      key: 'evokerElement',
      index: 0,
      value: 'Earth'
    }),
    true
  );
  assert.equal(build.evokerElement, 'Earth');
  assert.deepEqual(f5({}).skillIds, [elementalistCatalog.skillsByName.get('Calcify').id]);
  assert.equal(
    elementalistProfession.ui.startControls(context).some((control) => control.label === 'Familiar'),
    false
  );
});

test('Evoker familiar palette availability follows current charges', () => {
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    evokerElement: 'Fire',
    initialEvokerCharges: 3,
    specializations: [
      { name: 'Fire', traits: '1-1-1' },
      { name: 'Air', traits: '1-1-1' },
      { name: 'Evoker', traits: '1-1-1' }
    ]
  });
  const ignite = elementalistCatalog.skillsByName.get('Ignite');
  const context = {
    build,
    specialization: 'Evoker',
    professionState: {
      element: 'Fire',
      charges: 5,
      maximumCharges: 6,
      empowered: 0
    },
    catalog: elementalistCatalog
  };

  const unavailable = elementalistProfession.ui.paletteSkillAvailability(context, ignite);

  assert.equal(unavailable.available, false);
  assert.match(unavailable.message, /requires 6 familiar charges/);
  assert.equal(
    elementalistProfession.ui.paletteSkillAvailability(
      {
        ...context,
        professionState: { ...context.professionState, charges: 6 }
      },
      ignite
    ).available,
    true
  );
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
    charges: 4,
    maximumCharges: 6,
    empowered: 2
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
    results: { endState: { profession: professionState } }
  });

  assert.match(resourceHtml, /data-resource-id="evoker-charges"/);
  assert.match(resourceHtml, /data-resource-count="4"/);
  assert.match(resourceHtml, /active-resource-pips elementalist-evoker-air-2/);
  assert.doesNotMatch(resourceHtml, /<strong>4\/6<\/strong>/);

  const basicReadyHtml = activeResourceGroup({
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    results: {
      endState: { profession: { ...professionState, charges: 6, maximumCharges: 6, empowered: 0 } }
    }
  });
  const empoweredReadyHtml = activeResourceGroup({
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    results: {
      endState: { profession: { ...professionState, charges: 4, empowered: 3 } }
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
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    evokerElement: 'Air',
    specializations: [
      { name: 'Fire', traits: '1-1-1' },
      { name: 'Air', traits: '1-1-1' },
      { name: 'Evoker', traits: '1-1-1' }
    ]
  });
  const zap = elementalistCatalog.skillsByName.get('Zap');
  // Active attunement is Fire while the selected familiar is the Air familiar.
  // The shared core attunement gate must not veto the familiar; the Evoker slice
  // governs it by charges instead.
  const context = {
    build,
    specialization: 'Evoker',
    catalog: elementalistCatalog,
    professionState: { element: 'Air', charges: 6, maximumCharges: 6, empowered: 0, primaryAttunement: 'Fire' }
  };

  assert.deepEqual(elementalistProfession.ui.paletteSkillAvailability(context, zap), {
    available: true,
    message: ''
  });
  assert.equal(
    elementalistProfession.ui.paletteSkillAvailability(
      { ...context, professionState: { ...context.professionState, charges: 5 } },
      zap
    ).available,
    false
  );
});

test('core attunements enforce and report their individual recharge', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Air Attunement', 'Water Attunement', 'Fire Attunement'],
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
    [0, 1275, 8500]
  );
  assert.equal(result.endState.profession.primaryAttunement, 'Fire');
  assert.ok(result.endState.cooldowns['Air Attunement'].remaining > 1000);
  assert.ok(result.endState.cooldowns['Water Attunement'].remaining > 1000);
  const waterAvailability = elementalistProfession.ui.paletteSkillAvailability(
    {
      specialization: 'Core',
      professionState: result.endState.profession,
      time: result.endState.time / 1000,
      catalog: elementalistCatalog,
      build: { startAttunement: 'Fire' }
    },
    elementalistCatalog.skillsByName.get('Water Attunement')
  );

  assert.deepEqual(waterAvailability, { available: true, message: '' });
  const waterView = paletteSkillView(
    {
      build: elementalistProfession.createBuildDefaults(),
      adapter: elementalistAppAdapter,
      profession: elementalistProfession,
      skillById: elementalistCatalog.skillsById,
      skillByName: elementalistCatalog.skillsByName,
      results: result
    },
    elementalistCatalog.skillsByName.get('Water Attunement')
  );

  assert.equal(waterView.disabled, true);
  assert.equal(waterView.cooldownLabel, '8.50s');
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
  assert.equal(action.rechargeReadyAt - action.endsAt, 10);
});

test('Fresh Air grants ferocity when entering Air, not when resetting it', () => {
  const result = runNative({
    lines: [['Fire'], ['Air', '1-1-2'], ['Arcane']],
    rotation: ['Air Attunement', 6000],
    startAttunement: 'Fire'
  });
  const freshAir = result.events.filter((event) => event.type === 'buff' && event.kind === 'fresh air');

  assert.equal(freshAir.length, 1);
  assert.equal(freshAir[0].duration, 5);
});

test('Weaver attunements use the shared four-second recharge', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Weaver']],
    rotation: ['Water Attunement', 'Air Attunement'],
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
    [0, 4000]
  );
});

test('Unravel resets the current Weaver recharge, fully attunes for five seconds, and preserves future swap recharge', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '1-1-1']],
    rotation: ['Air Attunement', 'Unravel', 'Fire Attunement', 'Earth Attunement', 'Air Attunement'],
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
      [4, 'Earth Attunement', undefined, 'Earth', 'Earth'],
      [8, 'Air Attunement', undefined, 'Air', 'Earth']
    ]
  );
  assert.equal(result.endState.profession.unravelUntil, 5);
  assert.equal(result.events.filter((event) => event.type === 'buff' && event.kind === 'elements of rage').length, 4);
});
