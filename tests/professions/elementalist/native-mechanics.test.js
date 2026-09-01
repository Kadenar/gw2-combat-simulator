import assert from 'node:assert/strict';
import test from 'node:test';

import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { TRAIT_COVERAGE_STATUSES } from '../../helpers/trait-coverage.js';
import { skillBreakdownRows } from '#gw2/app/presentation/results/result-tables.js';
import { timelineWeaponRows } from '#gw2/app/rotation/timeline/model.js';
import { paletteSkillView, renderPalette } from '#gw2/app/rotation/palette/view.js';
import { activeResourceGroup, renderStartResource } from '#gw2/app/rotation/palette/resource-view.js';
import { paletteActionSkills, rotationSelectedSlotSkills, weaponPaletteRows } from '#gw2/app/rotation/palette/model.js';
import { elementalistAppAdapter } from '#gw2/content/professions/elementalist/app/app-definition.js';
import { applyElementalistBuildAttributeRules } from '#gw2/content/professions/elementalist/build/attributes.js';
import { elementalistCatalog } from '#gw2/content/professions/elementalist/catalog.js';
import { elementalistProfession } from '#gw2/content/professions/elementalist/definition.js';
import { targetAttunement } from '#gw2/content/professions/elementalist/core/mechanics/attunements.js';
import { createElementalistCoreState } from '#gw2/content/professions/elementalist/core/state.js';
import { applyPistolState } from '#gw2/content/professions/elementalist/core/skills/pistol.js';
import { elementalistCoreModifierRules } from '#gw2/content/professions/elementalist/core/traits/modifiers.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/content/professions/elementalist/data/ids.js';
import { availability as evokerAvailability } from '#gw2/content/professions/elementalist/specializations/evoker/mechanics/availability.js';
import { createEvokerState } from '#gw2/content/professions/elementalist/specializations/evoker/state.js';
import { weaverCastRules } from '#gw2/content/professions/elementalist/specializations/weaver/mechanics/dual-attunements.js';
import { weaverModifierRules } from '#gw2/content/professions/elementalist/specializations/weaver/traits/modifiers.js';
import { ELEMENTALIST_TRAIT_COVERAGE } from '../../fixtures/trait-coverage/elementalist.js';

// Attribute assertions use the same calculator composed into the Elementalist adapter.
const calculateAttributes = createCalculateAttributes(applyElementalistBuildAttributeRules);

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
  const bankStart = palette.innerHTML.indexOf('data-role="weaver-cooldown-bank"');
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
  assert.match(dualHtml, /data-skill="Pyro Vortex"[\s\S]*?<span class="pal-cd">3\.4s<\/span>/);
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
  assert.equal(empowered.startValue, 2);
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
  assert.equal(waterView.cooldownLabel, '8.5s');
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

test('Unravel requires Elements of Rage, disables dual attacks, and has a 25-second recharge', () => {
  const unavailable = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '1-1-2']],
    rotation: ['Unravel'],
    startAttunement: 'Air',
    secondaryAttunement: 'Fire'
  });

  assert.equal(
    unavailable.events.some((event) => event.type === 'action' && event.skillName === 'Unravel'),
    false
  );
  assert.match(unavailable.warnings[0], /requires Elements of Rage/i);

  const dualAttack = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '1-1-1']],
    rotation: ['Unravel', 'Pyro Vortex'],
    startAttunement: 'Fire',
    secondaryAttunement: 'Air',
    weapons: ['Sword', 'Dagger']
  });

  assert.equal(
    dualAttack.events.some((event) => event.type === 'action' && event.skillName === 'Pyro Vortex'),
    false
  );
  assert.match(dualAttack.warnings[0], /while Unravel is active/i);

  const unravel = elementalistCatalog.skillsByName.get('Unravel');
  const queuedDualAttack = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '1-1-1']],
    rotation: [
      'Pyro Vortex',
      {
        type: 'cast',
        skillId: unravel.id,
        concurrentOffsetMs: 100
      }
    ],
    startAttunement: 'Fire',
    secondaryAttunement: 'Air',
    weapons: ['Sword', 'Dagger']
  });

  assert.deepEqual(queuedDualAttack.warnings, []);
  assert.deepEqual(
    queuedDualAttack.steps.map((step) => [step.skill, step.start, step.end]),
    [
      ['Pyro Vortex', 0, 560],
      ['Unravel', 100, 100]
    ]
  );
  assert.equal(
    queuedDualAttack.resolvedEvents.some(
      (event) => event.type === 'damage' && event.skillName === 'Pyro Vortex' && event.at > 0.1
    ),
    true
  );

  const cooldown = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '1-1-1']],
    rotation: ['Unravel', 'Unravel'],
    startAttunement: 'Air',
    secondaryAttunement: 'Fire',
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      alacrity: false
    }
  });

  assert.deepEqual(
    cooldown.steps.map((step) => step.start),
    [0, 25000]
  );
});

test('cooldown reset also resets native attunement recharge', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Air Attunement', { type: 'cooldown-reset' }, 'Fire Attunement'],
    startAttunement: 'Fire',
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      alacrity: false
    }
  });
  const fire = result.steps.find((step) => step.skill === 'Fire Attunement');

  assert.deepEqual(result.warnings, []);
  assert.equal(fire.start, 0);
});

test('autoattack chains carry across attunements until their third strike', () => {
  const fireRoot = elementalistCatalog.skillsByName.get('Fire Strike').id;
  const fireSecond = elementalistCatalog.skillsByName.get('Fire Swipe');
  const airRoot = elementalistCatalog.skillsByName.get('Charged Strike').id;

  assert.deepEqual(
    elementalistCatalog.autoattackChains
      .find((chain) => chain[0] === fireRoot)
      .map((id) => elementalistCatalog.skillsById.get(id).name),
    ['Fire Strike', 'Fire Swipe', 'Searing Slash']
  );

  const carried = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Fire Strike', 'Air Attunement'],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger']
  });

  assert.deepEqual(carried.warnings, []);
  assert.deepEqual(carried.endState.profession.autoattackCarryover, {
    root: fireRoot,
    attunement: 'Fire'
  });
  assert.equal(carried.endState.profession.autoattackChains[fireRoot], fireSecond.id);
  assert.equal(
    elementalistProfession.ui.paletteSkillAvailability(
      {
        specialization: 'Core',
        professionState: carried.endState.profession,
        time: carried.endState.time / 1000,
        catalog: elementalistCatalog,
        build: { startAttunement: 'Fire' }
      },
      fireSecond
    ).available,
    true
  );

  const completed = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Fire Strike', 'Air Attunement', 'Fire Swipe', 'Searing Slash', 'Charged Strike'],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger']
  });

  assert.deepEqual(completed.warnings, []);
  assert.equal(completed.endState.profession.autoattackCarryover, null);
  assert.equal(
    completed.endState.profession.autoattackChains[airRoot],
    elementalistCatalog.skillsByName.get('Polaric Slash').id
  );
});

test('a skill in the new attunement interrupts autoattack carryover', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Fire Strike', 'Air Attunement', 'Polaric Leap', 'Fire Swipe'],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger']
  });

  assert.equal(result.endState.profession.autoattackCarryover, null);
  assert.equal(
    result.events.some((event) => event.type === 'action' && event.skillName === 'Fire Swipe'),
    false
  );
  assert.equal(
    result.warnings.some((warning) => warning.includes('Fire Swipe')),
    true
  );
});

test('Weaver can cancel a carried autoattack by starting the current primary chain', () => {
  const airRoot = elementalistCatalog.skillsByName.get('Charged Strike').id;
  const fireRoot = elementalistCatalog.skillsByName.get('Fire Strike').id;
  const fireSecond = elementalistCatalog.skillsByName.get('Fire Swipe').id;
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '1-1-1']],
    rotation: ['Charged Strike', 'Fire Attunement', 'Fire Strike'],
    startAttunement: 'Air',
    secondaryAttunement: 'Fire',
    weapons: ['Sword', 'Dagger']
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.autoattackCarryover, null);
  assert.equal(result.endState.profession.autoattackChains[airRoot], undefined);
  assert.equal(result.endState.profession.autoattackChains[fireRoot], fireSecond);
});

test('a concurrent attunement swap preserves the in-flight auto chain', () => {
  const airAttunement = elementalistCatalog.skillsByName.get('Air Attunement');
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: [
      'Fire Strike',
      {
        type: 'cast',
        skillId: airAttunement.id,
        concurrentOffsetMs: 100
      },
      'Fire Swipe'
    ],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger']
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some((event) => event.type === 'action' && event.skillName === 'Fire Swipe'),
    true
  );
});

test('Ride the Lightning preserves sword roots without exempting other dagger skills', () => {
  const preserved = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Charged Strike', 'Ride the Lightning', 'Polaric Slash'],
    startAttunement: 'Air',
    weapons: ['Sword', 'Dagger']
  });
  const reset = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Charged Strike', 'Updraft', 'Charged Strike'],
    startAttunement: 'Air',
    weapons: ['Sword', 'Dagger']
  });

  assert.deepEqual(preserved.warnings, []);
  assert.deepEqual(
    preserved.steps.map((step) => step.skill),
    ['Charged Strike', 'Ride the Lightning', 'Polaric Slash']
  );
  assert.deepEqual(reset.warnings, []);
  assert.deepEqual(
    reset.steps.map((step) => step.skill),
    ['Charged Strike', 'Updraft', 'Charged Strike']
  );
});

test('Ride the Lightning preserves the timed Aerial Agility flip sequence', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Aerial Agility', 'Ride the Lightning', 'Aerial Agility (chain)', 'Aerial Agility (dash)'],
    startAttunement: 'Air',
    weapons: ['Pistol', 'Dagger']
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Aerial Agility', 'Ride the Lightning', 'Aerial Agility (chain)', 'Aerial Agility (dash)']
  );
});

test('Aerial Agility expires after five seconds while its original cooldown keeps counting down', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Aerial Agility', 5100],
    startAttunement: 'Air',
    weapons: ['Pistol', 'Dagger']
  });

  assert.equal(result.endState.profession.autoattackChains[ID.AERIAL_AGILITY], undefined);
  assert.ok(result.endState.cooldowns['Aerial Agility'].remaining > 0);
});

test('using the first Aerial Agility follow-up restarts its full cooldown', () => {
  const unused = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Aerial Agility', 2000],
    startAttunement: 'Air',
    weapons: ['Pistol', 'Dagger']
  });
  const used = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Aerial Agility', 2000, 'Aerial Agility (chain)'],
    startAttunement: 'Air',
    weapons: ['Pistol', 'Dagger']
  });
  const initialDuration = unused.endState.cooldowns['Aerial Agility'].readyAt - unused.steps[0].end;
  const followup = used.steps[2];

  assert.equal(used.endState.cooldowns['Aerial Agility'].readyAt - followup.end, initialDuration);
  assert.ok(used.endState.cooldowns['Aerial Agility'].readyAt > unused.endState.cooldowns['Aerial Agility'].readyAt);
});

test('rotation palette resolves equipped glyphs to the active attunement', () => {
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
    selectedSkills: {
      ...elementalistProfession.createBuildDefaults().selectedSkills,
      Utility2: 'Glyph of Storms (Fire)'
    }
  });
  const app = {
    build,
    adapter: elementalistAppAdapter,
    profession: elementalistProfession,
    skills: elementalistCatalog.skills,
    skillByName: elementalistCatalog.skillsByName,
    skillById: elementalistCatalog.skillsById,
    results: {
      endState: { profession: { primaryAttunement: 'Air' } }
    }
  };

  assert.equal(
    rotationSelectedSlotSkills(app).some((skill) => skill.name === 'Glyph of Storms (Air)'),
    true
  );
  assert.equal(
    elementalistProfession.ui.paletteSkillAvailability(
      {
        build,
        specialization: 'Weaver',
        professionState: { primaryAttunement: 'Air' }
      },
      elementalistCatalog.skillsByName.get('Glyph of Storms (Air)')
    ).available,
    true
  );
});

test('equipped glyphs remain available across attunement variants', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Air Attunement', 'Glyph of Storms (Air)'],
    startAttunement: 'Fire',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Arcane Blast',
      Utility2: 'Glyph of Storms (Fire)',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some((event) => event.type === 'action' && event.skillName === 'Glyph of Storms (Air)'),
    true
  );
});

test('attunement variants of an equipped glyph share their cooldown', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Air Attunement', 'Glyph of Storms (Air)', 10000, 'Fire Attunement', 'Glyph of Storms (Fire)'],
    startAttunement: 'Fire',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Arcane Blast',
      Utility2: 'Glyph of Storms (Fire)',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
  });
  const casts = result.steps.filter((step) => String(step.skill).startsWith('Glyph of Storms'));

  assert.deepEqual(result.warnings, []);
  assert.equal(casts.length, 2);
  assert.ok(casts[1].start - casts[0].start >= 48000);
});

test('Primordial Stance variants share charges and count recharge', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Weaver']],
    rotation: [
      'Primordial Stance (Fire)',
      'Air Attunement',
      'Primordial Stance (Air)',
      'Earth Attunement',
      'Primordial Stance (Earth)'
    ],
    startAttunement: 'Fire',
    secondaryAttunement: 'Fire',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Primordial Stance (Fire)',
      Utility2: 'Glyph of Storms (Fire)',
      Utility3: 'Arcane Wave',
      Elite: 'Weave Self'
    }
  });
  const casts = result.steps.filter((step) => String(step.skill).startsWith('Primordial Stance'));

  assert.deepEqual(result.warnings, []);
  assert.equal(casts.length, 3);
  assert.ok(casts[2].start - casts[0].start >= 16000);
});

test('Primordial Stance pulses use the active attunements at each pulse', () => {
  const result = runNative({
    lines: [['Fire'], ['Earth'], ['Weaver']],
    rotation: ['Primordial Stance (Fire)', 1500, 'Earth Attunement', 4500],
    startAttunement: 'Fire',
    secondaryAttunement: 'Fire',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Primordial Stance (Fire)',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Weave Self'
    }
  });
  const action = result.events.find(
    (event) => event.type === 'action' && event.skillName === 'Primordial Stance (Fire)'
  );
  const hits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Primordial Stance'
  );
  const conditions = result.events.filter(
    (event) => event.type === 'condition' && event.skillName === 'Primordial Stance'
  );

  assert.equal(hits.length, 5);
  assert.deepEqual(
    hits.map((event) => event.at - action.at),
    [1, 2, 3, 4, 5]
  );
  assert.deepEqual(
    conditions.map((event) => [event.at - action.at, event.condition, event.stacks]),
    [
      [1, 'Burning', 1],
      [1, 'Burning', 1],
      [2, 'Bleeding', 2],
      [2, 'Burning', 1],
      [3, 'Bleeding', 2],
      [3, 'Burning', 1],
      [4, 'Bleeding', 2],
      [4, 'Burning', 1],
      [5, 'Bleeding', 2],
      [5, 'Burning', 1]
    ]
  );
});

test("Evasive Arcana uses the active attunement's native trait skill", () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane', '1-1-1']],
    rotation: ['Dodge', 1000],
    startAttunement: 'Fire',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Arcane Blast',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Conjure Fiery Greatsword'
    }
  });

  assert.equal(result.endState.profession.endurance, 57.5);
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Flame Burst (trait)'),
    true
  );
  assert.equal(
    result.events.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Flame Burst (trait)' &&
        event.condition === 'Burning' &&
        event.stacks === 3
    ),
    true
  );
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Flame Burst (trait)'),
    true
  );
});

test('Weaver mechanics execute through native hooks', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Weaver']],
    rotation: ['Weave Self', 'Water Attunement', 'Air Attunement', 'Earth Attunement', 'Tailored Victory'],
    startAttunement: 'Fire',
    secondaryAttunement: 'Fire',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Arcane Blast',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Weave Self'
    }
  });

  assert.equal(
    result.events.some((event) => event.type === 'buff' && event.kind === 'perfect weave'),
    true
  );
  assert.equal(
    result.events.some((event) => event.type === 'action' && event.skillName === 'Tailored Victory'),
    true
  );
  assert.equal(result.endState.profession.perfectWeaveUntil, 0);

  const weaveSelf = result.events.find((event) => event.type === 'action' && event.skillName === 'Weave Self');
  const weaveSelfFire = result.events.find(
    (event) => event.type === 'buff' && event.source === 'Weave Self' && event.kind === 'weave self fire'
  );

  assert.equal(weaveSelfFire.at - weaveSelf.at, 0.52);
  assert.ok(weaveSelfFire.at < weaveSelf.endsAt);
  assert.equal(weaveSelf.rechargeReadyAt - weaveSelfFire.at, 72);
});

test('Evoker mechanics execute through native hooks', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Lightning Blitz', 4000],
    evokerElement: 'Air',
    initialEvokerCharges: 6,
    initialEvokerEmpowered: 3
  });

  assert.equal(result.endState.profession.maximumCharges, 6);
  assert.equal(result.endState.profession.empowered, 0);
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Electric Enchantment')
      .length,
    3
  );
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Electric Enchantment'),
    true
  );
});

test('Elementalist behavior follows skill IDs after display labels change', () => {
  const fireAttunement = { ...elementalistCatalog.skillsById.get(ID.FIRE_ATTUNEMENT), name: 'Renamed attunement' };
  const ignite = { ...elementalistCatalog.skillsById.get(ID.IGNITE), name: 'Renamed familiar' };
  const state = createEvokerState({ evokerElement: 'Fire', initialEvokerCharges: 6 });
  const context = {
    state: {
      profession: {
        core: {},
        specialization: { kind: 'Evoker', state }
      }
    },
    start: 0,
    epsilon: 1e-9,
    commandIndex: 0,
    config: { selectedTraitIds: [] }
  };

  assert.equal(targetAttunement(fireAttunement), 'Fire');
  assert.deepEqual(evokerAvailability(context, ignite), { ready: true });
  state.element = 'Water';
  assert.equal(evokerAvailability(context, ignite).code, 'elementalist.evoker-element');

  const unravel = { ...elementalistCatalog.skillsById.get(ID.UNRAVEL), name: 'Renamed unravel' };
  assert.equal(
    weaverCastRules.availability.handler({ config: { selectedTraitIds: [] } }, unravel).code,
    'elementalist.weaver-elements-of-rage'
  );

  const core = createElementalistCoreState({ pistolBullets: { Earth: true, Air: true } });
  const pistolContext = { state: { profession: { core } }, effectiveEnd: 1, config: { selectedTraitIds: [] } };
  const shatteringStone = {
    ...elementalistCatalog.skillsById.get(ID.SHATTERING_STONE),
    name: 'Renamed core pistol skill'
  };
  applyPistolState(pistolContext, shatteringStone);
  assert.equal(core.shatteringStoneHitsRemaining, 3);

  const purblindingPlasma = {
    ...elementalistCatalog.skillsById.get(ID.PURBLINDING_PLASMA),
    name: 'Renamed Weaver pistol skill'
  };
  assert.equal(weaverCastRules.modifyRechargeDuration({ ...pistolContext, skill: purblindingPlasma }, 15), 10);
});

test('Evoker weapon skills build familiar charges', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Flame Uprising'],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger'],
    evokerElement: 'Fire',
    initialEvokerCharges: 0
  });
  const charge = result.events.find(
    (event) => event.type === 'resource' && event.kind === 'evoker-charges' && event.source === 'Flame Uprising'
  );

  assert.ok(charge);
  assert.equal(charge.change, 2);
  assert.equal(result.endState.profession.charges, 2);
});

test('Fire-specialized Evoker gives Sunspot and Flame Expulsion independent 5-second cooldowns', () => {
  const simulate = (evokerElement) =>
    runNative({
      lines: [
        ['Fire', '1-1-2'],
        ['Earth', '2-1-2'],
        ['Evoker', '1-1-1']
      ],
      rotation: [
        'Raging Ricochet',
        'Earth Attunement',
        'Fire Attunement',
        'Water Attunement',
        'Fire Attunement',
        'Air Attunement'
      ],
      startAttunement: 'Fire',
      weapons: ['Pistol', 'Dagger'],
      evokerElement
    });
  const attempts = (result, direction) =>
    result.events.filter(
      (event) =>
        event.type === 'elementalist.attunement' &&
        (direction === 'enter' ? event.to === 'Fire' : event.from === 'Fire')
    );
  const procs = (result, skillName) =>
    result.events.filter((event) => event.type === 'damage' && event.skillName === skillName);
  const fire = simulate('Fire');
  const fireEntries = attempts(fire, 'enter');
  const fireExits = attempts(fire, 'exit');

  assert.deepEqual(fire.warnings, []);
  assert.equal(fireEntries.length, 2);
  assert.equal(fireExits.length, 3);
  assert.ok(fireEntries.at(-1).at - fireEntries[0].at < 5);
  assert.ok(fireExits.at(-1).at - fireExits[0].at < 5);
  assert.equal(procs(fire, 'Sunspot').length, 1);
  assert.equal(procs(fire, 'Flame Expulsion').length, 1);
  // Independent timers allow the first Sunspot while Flame Expulsion is already cooling down.
  assert.ok(procs(fire, 'Sunspot')[0].at - procs(fire, 'Flame Expulsion')[0].at < 5);

  const nonFire = simulate('Water');

  assert.equal(procs(nonFire, 'Sunspot').length, attempts(nonFire, 'enter').length);
  assert.equal(procs(nonFire, 'Flame Expulsion').length, attempts(nonFire, 'exit').length);
});

test('Flame Expulsion uses its own icon in the damage breakdown', () => {
  const result = runNative({
    lines: [['Fire', '1-1-2'], ['Air'], ['Arcane']],
    rotation: ['Flame Uprising', 'Air Attunement'],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger']
  });
  const expectedIcon = 'https://render.guildwars2.com/file/998095CB1FD2CF0164B8A36BABFDB911DF08DB02/1012313.png';
  const packet = result.events.find((event) => event.type === 'damage' && event.skillName === 'Flame Expulsion');
  const row = skillBreakdownRows(result).find((entry) => entry.name === 'Flame Expulsion');

  assert.equal(packet?.icon, expectedIcon);
  assert.equal(row?.icon, expectedIcon);
});

test('Sunspot uses its own icon in the damage breakdown', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Lightning Strike', 'Fire Attunement'],
    startAttunement: 'Air',
    weapons: ['Scepter', 'Dagger']
  });
  const expectedIcon = 'https://render.guildwars2.com/file/1405047ED70DE30F80B1F6304A787B215BB50878/1012316.png';
  const packet = result.events.find((event) => event.type === 'damage' && event.skillName === 'Sunspot');
  const row = skillBreakdownRows(result).find((entry) => entry.name === 'Sunspot');

  assert.equal(packet?.icon, expectedIcon);
  assert.equal(row?.icon, expectedIcon);
});

test('Earthen Blast uses its own icon in the damage breakdown', () => {
  const result = runNative({
    lines: [['Earth'], ['Air'], ['Arcane']],
    rotation: ['Lightning Strike', 'Earth Attunement'],
    startAttunement: 'Air',
    weapons: ['Scepter', 'Dagger']
  });
  const expectedIcon = 'https://render.guildwars2.com/file/2531DCAFAEAB452C90C4572E1ADCE8236DCF5636/1012304.png';
  const packet = result.events.find((event) => event.type === 'damage' && event.skillName === 'Earthen Blast');
  const row = skillBreakdownRows(result).find((entry) => entry.name === 'Earthen Blast');

  assert.equal(packet?.icon, expectedIcon);
  assert.equal(row?.icon, expectedIcon);
});

test('Air-specialized Evoker leaves Electric Discharge without an internal cooldown', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: [
      'Raging Ricochet',
      'Earth Attunement',
      'Air Attunement',
      'Water Attunement',
      'Air Attunement',
      'Fire Attunement'
    ],
    startAttunement: 'Fire',
    weapons: ['Pistol', 'Dagger'],
    evokerElement: 'Air'
  });
  const entries = result.events.filter((event) => event.type === 'elementalist.attunement' && event.to === 'Air');
  const discharges = result.events.filter(
    (event) => event.type === 'damage' && event.skillName === 'Electric Discharge'
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(entries.length, 2);
  assert.ok(entries.at(-1).at - entries[0].at < 5);
  assert.equal(discharges.length, entries.length);
});

test('Earth-specialized Evoker gives Earthen Blast and Rock Solid independent 5-second cooldowns', () => {
  const simulate = (evokerElement) =>
    runNative({
      lines: [['Earth', '1-2-2'], ['Air'], ['Evoker']],
      rotation: [
        'Raging Ricochet',
        'Air Attunement',
        'Earth Attunement',
        'Water Attunement',
        'Earth Attunement',
        'Fire Attunement'
      ],
      startAttunement: 'Fire',
      weapons: ['Pistol', 'Dagger'],
      evokerElement
    });
  const earthEntries = (result) =>
    result.events.filter((event) => event.type === 'elementalist.attunement' && event.to === 'Earth');
  const earthenBlasts = (result) =>
    result.events.filter((event) => event.type === 'damage' && event.skillName === 'Earthen Blast');
  const rockSolid = (result) => result.events.filter((event) => event.type === 'buff' && event.source === 'Rock Solid');
  const earth = simulate('Earth');
  const entries = earthEntries(earth);

  assert.deepEqual(earth.warnings, []);
  assert.equal(entries.length, 2);
  assert.ok(entries.at(-1).at - entries[0].at < 5);
  assert.equal(earthenBlasts(earth).length, 1);
  assert.equal(rockSolid(earth).length, 1);

  const nonEarth = simulate('Water');

  assert.equal(earthenBlasts(nonEarth).length, earthEntries(nonEarth).length);
  assert.equal(rockSolid(nonEarth).length, earthEntries(nonEarth).length);
});

test('Specialized Elements grants three familiar charges per matching weapon skill', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker', '1-1-3']],
    rotation: ['Flame Uprising'],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger'],
    evokerElement: 'Fire',
    initialEvokerCharges: 0
  });
  const charge = result.events.find(
    (event) => event.type === 'resource' && event.kind === 'evoker-charges' && event.source === 'Flame Uprising'
  );

  assert.equal(result.endState.profession.maximumCharges, 6);
  assert.ok(charge);
  assert.equal(charge.change, 3);
  assert.equal(result.endState.profession.charges, 3);
});

test('Specialized Elements familiar casts reduce active weapon recharge', () => {
  const simulate = (traits) =>
    runNative({
      lines: [['Fire'], ['Air'], ['Evoker', traits]],
      rotation: ['Flame Uprising', 'Ignite'],
      startAttunement: 'Fire',
      weapons: ['Sword', 'Dagger'],
      evokerElement: 'Fire'
    });
  const baseline = simulate('1-1-1');
  const specialized = simulate('1-1-3');

  assert.deepEqual(baseline.warnings, []);
  assert.deepEqual(specialized.warnings, []);
  assert.equal(
    baseline.endState.cooldowns['Flame Uprising'].readyAt - specialized.endState.cooldowns['Flame Uprising'].readyAt,
    512
  );
});

test('Evoker can cast a basic familiar after configured start charges fill', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Flame Uprising', 'Ignite'],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger'],
    evokerElement: 'Fire',
    initialEvokerCharges: 4
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some((event) => event.type === 'action' && event.skillName === 'Ignite'),
    true
  );
  assert.equal(result.endState.profession.charges, 0);
  assert.equal(result.endState.profession.empowered, 1);
});

test('Evoker preserves off-attunement recharge while waiting for a swap', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: [
      'Shattering Stone',
      'Water Attunement',
      'Frigid Flurry',
      'Air Attunement',
      'Dazing Discharge',
      'Fire Attunement'
    ],
    startAttunement: 'Earth',
    weapons: ['Pistol', 'Dagger'],
    evokerElement: 'Earth'
  });
  const dazing = result.events.find((event) => event.type === 'action' && event.skillName === 'Dazing Discharge');
  const fire = result.events.find((event) => event.type === 'action' && event.skillName === 'Fire Attunement');

  assert.deepEqual(result.warnings, []);
  assert.equal(fire.at, dazing.endsAt);
});

test('Evoker concurrent actions wait for an active familiar cast', () => {
  const earthAttunement = elementalistCatalog.skillsByName.get('Earth Attunement');
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: [
      'Lightning Blitz',
      {
        type: 'cast',
        skillId: earthAttunement.id,
        concurrentOffsetMs: 100
      }
    ],
    startAttunement: 'Air',
    evokerElement: 'Air',
    initialEvokerEmpowered: 3
  });
  const familiar = result.events.find((event) => event.type === 'action' && event.skillName === 'Lightning Blitz');
  const attunement = result.events.find((event) => event.type === 'action' && event.skillName === 'Earth Attunement');

  assert.deepEqual(result.warnings, []);
  assert.ok(attunement.at >= familiar.endsAt);
});

test('Evoker applies parent charge progression after a concurrent basic familiar', () => {
  const calcify = elementalistCatalog.skillsByName.get('Calcify');
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: [
      'Shatterstone',
      {
        type: 'cast',
        skillId: calcify.id,
        concurrentOffsetMs: 560
      }
    ],
    startAttunement: 'Water',
    weapons: ['Scepter', 'Dagger'],
    evokerElement: 'Earth',
    initialEvokerCharges: 6
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.charges, 1);
  assert.equal(result.endState.profession.empowered, 1);
});

test('Evoker reapplies Rejuvenate after its concurrent basic familiar', () => {
  const calcify = elementalistCatalog.skillsByName.get('Calcify');
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: [
      'Rejuvenate',
      {
        type: 'cast',
        skillId: calcify.id,
        concurrentOffsetMs: 800
      }
    ],
    evokerElement: 'Earth',
    initialEvokerCharges: 0,
    selectedSkills: {
      Heal: 'Rejuvenate',
      Utility1: "Fox's Fury",
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Elemental Procession'
    }
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.charges, 6);
  assert.equal(result.endState.profession.empowered, 1);
});

test('Evasive Arcana does not grant Evoker familiar charges', () => {
  const result = runNative({
    lines: [['Fire'], ['Arcane', '1-1-1'], ['Evoker']],
    rotation: ['Dodge', 1000],
    startAttunement: 'Fire',
    evokerElement: 'Fire',
    initialEvokerCharges: 0
  });

  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Flame Burst (trait)'),
    true
  );
  assert.equal(result.endState.profession.charges, 0);
});

test('Evoker materializes final Electric Enchantment stacks on prior hits', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Charged Strike', 'Polaric Slash', 'Zap'],
    startAttunement: 'Air',
    weapons: ['Sword', 'Dagger'],
    evokerElement: 'Air',
    initialEvokerCharges: 6
  });
  const enchantments = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Electric Enchantment'
  );

  assert.equal(enchantments.length, 2);
  assert.equal(enchantments[0].triggeredBy, 'Charged Strike');
});

test('Specialized Elements forces and locks the selected attunement', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker', '1-1-3']],
    rotation: ['Fire Attunement'],
    startAttunement: 'Fire',
    evokerElement: 'Air'
  });

  assert.equal(result.endState.profession.primaryAttunement, 'Air');
  assert.equal(result.endState.profession.maximumCharges, 6);
  assert.equal(
    result.events.some((event) => event.type === 'elementalist.attunement'),
    false
  );
  assert.equal(
    result.warnings.some((warning) =>
      String(warning).includes('attunement swapping is disabled by Specialized Elements')
    ),
    true
  );
});

test('Zap grants its five-second strike-damage buff', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Zap'],
    evokerElement: 'Air',
    initialEvokerCharges: 6
  });

  assert.equal(
    result.events.some((event) => event.type === 'buff' && event.kind === 'zap buff' && event.duration === 5),
    true
  );
});

test('conjured weapons enforce bundle access and preserve their pickup', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: [
      'Conjure Frost Bow',
      'Frost Volley',
      '__drop_bundle',
      'Flame Uprising',
      '__pickup_Frost Bow',
      'Frost Volley'
    ],
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Conjure Frost Bow',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Conjure Fiery Greatsword'
    }
  });

  assert.deepEqual(
    result.events.filter((event) => event.type === 'action').map((event) => event.skillName),
    ['Conjure Frost Bow', 'Frost Volley', '__drop_bundle', 'Flame Uprising', '__pickup_Frost Bow', 'Frost Volley']
  );
  assert.equal(result.endState.profession.conjureEquipped, 'Frost Bow');
  assert.equal(result.warnings.length, 0);
});

test('Rock Barrier starts its root recharge when Hurl is used', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Rock Barrier', 'Hurl', 'Rock Barrier'],
    weapons: ['Scepter', 'Warhorn'],
    startAttunement: 'Earth'
  });
  const actions = result.events.filter((event) => event.type === 'action');
  const barriers = actions.filter((event) => event.skillName === 'Rock Barrier');
  const hurl = actions.find((event) => event.skillName === 'Hurl');

  assert.equal(barriers.length, 2);
  assert.equal(barriers[0].rechargeReadyAt, null);
  assert.ok(barriers[1].at > hurl.endsAt + 5);
});

test('Pistol bullets grant, consume, and apply their payload', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Raging Ricochet', 'Raging Ricochet'],
    weapons: ['Pistol', 'Warhorn']
  });

  assert.equal(result.endState.profession.pistolBullets.Fire, false);
  assert.equal(
    result.events.some(
      (event) => event.type === 'buff' && event.source === 'Raging Ricochet' && event.kind === 'might'
    ),
    true
  );

  const unavailableExplosion = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Elemental Explosion'],
    weapons: ['Pistol', 'Warhorn']
  });

  assert.equal(
    unavailableExplosion.events.some((event) => event.type === 'action' && event.skillName === 'Elemental Explosion'),
    false
  );
  assert.match(unavailableExplosion.warnings[0], /all four elemental bullets/i);

  const explosion = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Elemental Explosion'],
    weapons: ['Pistol', 'Warhorn'],
    pistolBullets: { Fire: true, Water: true, Air: true, Earth: true }
  });

  assert.deepEqual(explosion.warnings, []);
  assert.equal(
    explosion.events.some((event) => event.type === 'action' && event.skillName === 'Elemental Explosion'),
    true
  );
  assert.deepEqual(explosion.endState.profession.pistolBullets, {
    Fire: false,
    Water: false,
    Air: false,
    Earth: false
  });
});

test('Hammer orbs block reuse and Grand Finale cancels future packets', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Flame Wheel', 'Flame Wheel', 'Grand Finale', 8000],
    weapons: ['Hammer', ''],
    gear: Object.fromEntries(
      Object.keys(elementalistProfession.createBuildDefaults().gear).map((slot) => [slot, "Assassin's"])
    ),
    weaponSigils: [
      ['Air', 'Accuracy'],
      ['Air', 'Accuracy']
    ]
  });

  assert.equal(result.events.filter((event) => event.type === 'action' && event.skillName === 'Flame Wheel').length, 1);
  assert.equal(result.endState.profession.hammerOrbs.Fire, null);
  assert.equal(
    result.events.some((event) => event.cancelled && event.detail === 'cancelled by Grand Finale'),
    true
  );
  assert.equal(
    result.warnings.some((warning) => warning.includes('Grand Finale must consume the active orb')),
    true
  );
  const finale = result.events.find((event) => event.type === 'action' && event.skillName === 'Grand Finale');
  const finaleHits = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Grand Finale');

  assert.equal(finaleHits.length, 1);
  assert.equal(finaleHits[0].coefficient, 1.4);
  assert.ok(Math.abs(finaleHits[0].at - finale.endsAt - 0.68) < 0.001);
  const airProcs = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Sigil of Air'
  );

  assert.equal(airProcs.length, 1);
  assert.equal(airProcs[0].triggeredBy, 'Grand Finale');
});

test('Hammer orbs emit fifteen one-second packets and feed Fresh Air', () => {
  const packets = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Flame Wheel', 16000],
    weapons: ['Hammer', ''],
    startAttunement: 'Fire'
  });
  const strikes = packets.events.filter((event) => event.type === 'damage' && event.skillName === 'Flame Wheel');
  const burning = packets.events.filter((event) => event.type === 'condition' && event.skillName === 'Flame Wheel');

  assert.deepEqual(
    strikes.map((event) => Math.round(event.at * 1000)),
    Array.from({ length: 15 }, (_, index) => (index + 1) * 1000)
  );
  assert.equal(burning.length, 15);
  assert.ok(burning.every((event) => event.condition === 'Burning' && event.stacks === 1 && event.duration === 0.75));

  const freshAir = runNative({
    lines: [['Fire'], ['Air', '3-3-2'], ['Arcane']],
    rotation: ['Fire Attunement', 'Flame Wheel', 'Air Attunement'],
    weapons: ['Hammer', ''],
    startAttunement: 'Air'
  });
  const returnToAir = freshAir.events.find((event) => event.type === 'elementalist.attunement' && event.to === 'Air');
  const reset = freshAir.events.find((event) => event.type === 'elementalist.fresh-air');

  assert.ok(reset);
  assert.equal(returnToAir.at, reset.at);
  assert.ok(returnToAir.at < 8);
});

test('Spear etchings upgrade after three other casts', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Etching: Volcano', 'Flame Spear', 'Seethe', 'Blazing Barrage', 'Volcano'],
    weapons: ['Spear', '']
  });

  assert.equal(
    result.events.some((event) => event.type === 'action' && event.skillName === 'Volcano'),
    true
  );
  assert.equal(result.endState.profession.etchings['Etching: Volcano'], null);
});

test('Spear etching stages replace one another in the weapon palette', () => {
  const family = ['Etching: Volcano', 'Lesser Volcano', 'Volcano'].map((name) =>
    elementalistCatalog.skillsByName.get(name)
  );
  const displayed = (progress) =>
    elementalistProfession.ui
      .paletteWeaponSkills(
        {
          build: { weapons: ['Spear', ''] },
          professionState: {
            etchings: progress ? { 'Etching: Volcano': progress } : {}
          }
        },
        family
      )
      .map((skill) => skill.name);

  assert.deepEqual(displayed(null), ['Etching: Volcano']);
  assert.deepEqual(displayed({ stage: 'lesser', otherCasts: 0 }), ['Lesser Volcano']);
  assert.deepEqual(displayed({ stage: 'full', otherCasts: 3 }), ['Volcano']);
});

test('Alacrity shortens overload dwell and Lucid Singularity follows hit timing', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '1-2-2']],
    rotation: [1000, 'Fire Attunement', 'Overload Fire'],
    startAttunement: 'Air'
  });
  const attunement = result.events.find((event) => event.type === 'elementalist.attunement' && event.to === 'Fire');
  const overload = result.events.find((event) => event.type === 'action' && event.skillName === 'Overload Fire');
  const alacrity = result.events.filter((event) => event.type === 'buff' && event.source === 'Lucid Singularity');

  assert.ok(Math.abs(overload.at - attunement.at - 4.8) < 0.001);
  assert.equal(alacrity.length, 5);
  assert.ok(alacrity[4].duration > alacrity[0].duration * 4);
});

test('Tempest always starts with its initial overload available', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '3-2-1']],
    rotation: ['Overload Air'],
    startAttunement: 'Air'
  });
  const overload = result.events.find((event) => event.type === 'action' && event.skillName === 'Overload Air');

  assert.equal(overload.at, 0);
});

test('Transcendent Tempest precedes same-time Overload completion damage', () => {
  const withTrait = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '3-2-1']],
    rotation: ['Overload Air'],
    startAttunement: 'Air'
  });
  const withoutTrait = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '3-2-2']],
    rotation: ['Overload Air'],
    startAttunement: 'Air'
  });
  const action = withTrait.events.find((event) => event.type === 'action' && event.skillName === 'Overload Air');
  const buff = withTrait.events.find((event) => event.type === 'buff' && event.kind === 'transcendent-tempest');
  const damageAtCompletion = (result, name) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillName === name)
      .sort((left, right) => left.at - right.at)
      .at(-1);
  const finalWithTrait = damageAtCompletion(withTrait, 'Overload Air');
  const finalWithoutTrait = damageAtCompletion(withoutTrait, 'Overload Air');
  const joltWithTrait = damageAtCompletion(withTrait, 'Lightning Jolt');
  const joltWithoutTrait = damageAtCompletion(withoutTrait, 'Lightning Jolt');
  const completionOrder = withTrait.events
    .filter((event) => Math.abs(event.at - action.endsAt) < 0.0001)
    .map((event) => event.kind || event.skillName);

  assert.equal(buff.at, action.endsAt);
  assert.equal(buff.priority, -10);
  assert.ok(completionOrder.indexOf('transcendent-tempest') < completionOrder.indexOf('Lightning Jolt'));
  assert.equal(finalWithTrait.damage, finalWithoutTrait.damage);
  assert.ok(joltWithTrait.damage > joltWithoutTrait.damage * 1.2);
});

test('Overload Air applies a 1.32 non-critical Lightning Jolt to the player and active elemental', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '3-2-1']],
    rotation: ['Glyph of Elementals', 'Overload Air', 10000],
    startAttunement: 'Air',
    targetHealth: 0
  });
  const jolts = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Lightning Jolt'
  );
  const playerJolt = jolts.find((event) => event.actorType === 'effect');
  const elementalJolt = jolts.find((event) => event.actorType === 'summon');
  const triggeringElementalStrike = result.resolvedEvents.find(
    (event) =>
      event.type === 'damage' &&
      event.actorType === 'summon' &&
      event.skillName !== 'Lightning Jolt' &&
      event.at === elementalJolt?.at
  );

  assert.equal(jolts.length, 2);
  assert.equal(playerJolt.coefficient, 1.32);
  assert.equal(playerJolt.resolvedWeaponStrength, 690.5);
  assert.equal(playerJolt.criticalChance, 0);
  assert.equal(elementalJolt.coefficient, 1.32);
  assert.equal(elementalJolt.resolvedWeaponStrength, 690.5);
  assert.equal(elementalJolt.criticalChance, 0);
  assert.equal(elementalJolt.independentSummonStrike, true);
  assert.equal(elementalJolt.summonUsesMight, false);
  assert.equal(elementalJolt.summonUsesProfessionModifiers, false);
  assert.ok(elementalJolt.at > playerJolt.at);
  assert.ok(triggeringElementalStrike);
});

test('Evoker familiar flip interruption cancels both familiar attacks', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Lightning Blitz', 'Zap', 4000],
    evokerElement: 'Air',
    initialEvokerCharges: 6,
    initialEvokerEmpowered: 3
  });

  assert.equal(
    result.resolvedEvents.some(
      (event) => event.type === 'damage' && ['Lightning Blitz', 'Zap'].includes(event.skillName)
    ),
    false
  );
  assert.equal(result.endState.profession.empowered, 1);
});

test("Fox's Fury schedules its bonus hit from cast start", () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ["Fox's Fury"],
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: "Fox's Fury",
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
  });
  const action = result.events.find((event) => event.type === 'action' && event.skillName === "Fox's Fury");
  const hit = result.events.find((event) => event.type === 'damage' && event.skillName === "Fox's Fury");

  assert.ok(hit.at > action.at);
  assert.ok(hit.at < action.endsAt);
});

test('core damage traits expose their exact resolver modifiers', () => {
  const rules = new Map([...elementalistCoreModifierRules, ...weaverModifierRules].map((rule) => [rule.id, rule]));

  assert.equal(rules.get('elementalist.pyromancers-training').factor, 1.07);
  assert.equal(rules.get('elementalist.serrated-stones').factor, 1.05);
  assert.equal(rules.get('elementalist.stormsoul').factor, 1.07);
  assert.equal(rules.get('elementalist.flow-like-water').factor, 1.1);
  assert.equal(rules.get('elementalist.bolt-to-the-heart').factor, 1.2);
  assert.equal(rules.get('elementalist.bountiful-power').amount, 0.2);
  assert.equal(rules.get('elementalist.zephyrs-speed-critical-chance').amount, 0.05);
  assert.equal(rules.get('elementalist.superior-elements').amount, 0.2);
  assert.equal(rules.get('elementalist.weave-self-fire').amount, 0.2);
  assert.equal(rules.get('elementalist.weave-self-fire').operation, 'damage-additive');
  assert.equal(rules.get('elementalist.weave-self-air').amount, 0.1);
  assert.equal(rules.get('elementalist.elements-of-rage-condition').amount, 0.1);
  assert.equal(rules.get('elementalist.elements-of-rage-condition').operation, 'damage-additive');
  assert.equal(rules.get('elementalist.elements-of-rage-strike').amount, 0.15);
  assert.equal(rules.get('elementalist.persisting-flames').operation, 'damage-additive');
  const inferno = rules.get('elementalist.inferno');
  assert.equal(inferno.target, 'conditionDamage');
  assert.equal(
    inferno.factor(
      { time: 0, query: { statsAt: () => ({ power: 1000, conditionDamage: 1000 }) } },
      'conditionDamage',
      inferno.parameters
    ),
    213.5 / 286
  );

  const { app: core } = createNativeApp({
    lines: [['Fire'], ['Air'], ['Arcane']]
  });

  assert.equal(core.attributeData.attributes['Condition Damage'].traits, 180);
  assert.equal(core.attributeData.attributes.Ferocity.traits, 150);
  assert.equal(core.attributeData.attributes.Concentration.traits, 180);
  assert.equal(core.attributeData.attributes['Critical Chance'].traits, 5);
  assert.equal(core.attributeData.attributes['Burning Duration'].traits, 20);

  const { app: water } = createNativeApp({
    lines: [['Water', '1-1-3'], ['Air'], ['Arcane']]
  });

  assert.equal(water.attributeData.attributes.Vitality.traits, 300);
  const withoutSoothingPower = calculateAttributes(water.build, [], 1, 'Soothing Power');

  assert.equal(withoutSoothingPower.attributes.Vitality.traits, 0);
  assert.equal(
    withoutSoothingPower.activeTraits.some((trait) => trait.name === 'Soothing Power'),
    false
  );

  const { app: tempest } = createNativeApp({
    lines: [['Fire'], ['Air'], ['Tempest']]
  });

  assert.equal(tempest.attributeData.attributes.Concentration.traits, 240);

  const { app: weaver } = createNativeApp({
    lines: [['Fire'], ['Earth'], ['Weaver']]
  });

  assert.equal(weaver.attributeData.attributes.Vitality.traits, 180);

  const persistingFlames = runNative({
    lines: [['Fire', '1-3-1'], ['Air'], ['Tempest']],
    rotation: ['Flame Uprising', 5000],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Warhorn']
  });

  assert.equal(
    persistingFlames.events.filter((event) => event.type === 'damage' && event.skillName === 'Flame Uprising').length,
    5
  );
});

test('core attunement and aura traits emit named boon and damage payloads', () => {
  const fire = runNative({
    lines: [['Fire', '2-2-2'], ['Air'], ['Arcane', '1-2-2']],
    rotation: ['Conjure Frost Bow', '__drop_bundle', 'Fire Attunement', 'Glyph of Elemental Harmony'],
    startAttunement: 'Air',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Conjure Frost Bow',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
  });
  const fireAura = fire.events.find((event) => event.type === 'elementalist.aura' && event.source === 'Conjurer');

  assert.equal(fireAura.aura, 'Fire Aura');
  assert.ok(Math.abs(fireAura.duration - 5.32) < 0.001);
  for (const source of ['Sunspot', 'Arcane Prowess', 'Elemental Attunement']) {
    assert.equal(
      fire.events.some((event) => event.source === source),
      true,
      source
    );
  }

  assert.equal(
    fire.procSteps.some((step) => step.skill === 'Sunspot'),
    true
  );
  assert.deepEqual(
    fire.events.filter((event) => event.type === 'buff' && event.source === 'Conjurer').map((event) => event.kind),
    ['fury', 'swiftness']
  );

  const earth = runNative({
    lines: [['Earth', '1-2-2'], ['Water'], ['Air']],
    rotation: ['Glyph of Elemental Harmony', 'Earth Attunement', 'Signet of Earth'],
    startAttunement: 'Water',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Signet of Earth',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
  });

  for (const source of ["Earth's Embrace", 'Earthen Blast', 'Rock Solid', 'Written in Stone']) {
    assert.equal(
      earth.events.some((event) => event.source === source),
      true,
      source
    );
  }

  assert.equal(
    earth.procSteps.some((step) => step.skill === 'Earthen Blast'),
    true
  );

  const strength = runNative({
    lines: [['Earth', '1-1-2'], ['Water'], ['Air']],
    rotation: ['Signet of Earth'],
    startAttunement: 'Earth',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Signet of Earth',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
  });
  const strengthBleeds = resolvedAndScheduledEvents(strength).filter(
    (event) => event.type === 'condition' && event.source === 'Strength of Stone'
  );

  assert.equal(strengthBleeds.length, 1);
  assert.equal(strengthBleeds[0].stacks, 3);
  assert.equal(strengthBleeds[0].duration, 10);
  assert.equal(
    strength.procSteps.some((step) => step.skill === 'Strength of Stone'),
    true
  );
});

test('core critical-hit and control traits enforce their proc rules', () => {
  const critical = runNative({
    lines: [['Fire'], ['Air', '1-2-3'], ['Arcane', '1-2-1']],
    rotation: ['Updraft', 'Charged Strike', 'Polaric Slash', 'Call Lightning'],
    startAttunement: 'Air'
  });

  for (const source of [
    'Lightning Rod',
    'Elemental Lockdown',
    'Raging Storm',
    'Burning Precision',
    'Arcane Precision'
  ]) {
    assert.equal(
      resolvedAndScheduledEvents(critical).some((event) => event.source === source),
      true,
      source
    );
  }

  assert.equal(
    resolvedAndScheduledEvents(critical).some(
      (event) => event.source === 'Lightning Rod' && event.type === 'condition' && event.condition === 'Weakness'
    ),
    true
  );
  for (const proc of ['Arcane Precision', 'Burning Precision', 'Lightning Rod']) {
    assert.equal(
      critical.procSteps.some((step) => step.skill === proc),
      true,
      proc
    );
  }

  const stamina = runNative({
    lines: [['Fire'], ['Air', '1-2-3'], ['Arcane', '2-2-1']],
    rotation: ['Updraft', 'Charged Strike', 'Polaric Slash', 'Call Lightning'],
    startAttunement: 'Air'
  });

  assert.equal(
    resolvedAndScheduledEvents(stamina).some((event) => event.type === 'buff' && event.source === 'Renewing Stamina'),
    true
  );
});

test('Tempest traits enforce overload dwell, auras, boons, and damage windows', () => {
  const offensive = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '3-2-1']],
    rotation: [1000, 'Fire Attunement', 'Overload Fire'],
    startAttunement: 'Air'
  });
  const attunement = offensive.events.find((event) => event.type === 'elementalist.attunement' && event.to === 'Fire');
  const overload = offensive.events.find((event) => event.type === 'action' && event.skillName === 'Overload Fire');

  assert.ok(Math.abs(overload.at - attunement.at - 3.2) < 0.001);
  for (const source of ['Hardy Conduit', 'Harmonious Conduit', 'Unstable Conduit', 'Transcendent Tempest']) {
    assert.equal(
      offensive.events.some((event) => event.source === source),
      true,
      source
    );
  }

  const auraSupport = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '3-3-3']],
    rotation: ['Overload Fire'],
    startAttunement: 'Fire'
  });

  for (const kind of ['vigor', 'regeneration', 'alacrity']) {
    assert.equal(
      auraSupport.events.some((event) => event.type === 'buff' && event.kind === kind),
      true,
      kind
    );
  }

  const healingAndShout = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '1-1-1']],
    rotation: [{ name: '__combat_start' }, 'Glyph of Elemental Harmony', 'Aftershock!'],
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Aftershock!',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
  });

  assert.equal(
    healingAndShout.events.some((event) => event.source === 'Gale Song'),
    true
  );
  assert.equal(
    healingAndShout.procSteps.some((step) => step.skill === 'Tempestuous Aria'),
    true
  );

  const latent = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '2-1-1']],
    rotation: ['Water Attunement'],
    startAttunement: 'Fire'
  });

  assert.equal(
    latent.events.some((event) => event.source === 'Latent Stamina'),
    true
  );
});

test('Weaver traits enforce dual-attunement, boon, modifier, and recharge rules', () => {
  const dual = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '1-2-1']],
    rotation: ['Air Attunement', 'Pyro Vortex', 'Air Attunement'],
    startAttunement: 'Fire',
    secondaryAttunement: 'Fire',
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      alacrity: false
    }
  });

  assert.equal(
    dual.events.some(
      (event) => event.type === 'condition' && event.skillName === 'Pyro Vortex' && event.condition === 'Weakness'
    ),
    true
  );
  assert.deepEqual(
    dual.events
      .filter(
        (event) =>
          event.type === 'buff' && event.source === 'Pyro Vortex' && ['might', 'swiftness'].includes(event.kind)
      )
      .map((event) => event.kind),
    ['might', 'swiftness']
  );
  assert.equal(
    dual.events.some((event) => event.kind === 'elements of rage'),
    true
  );

  const flow = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '1-1-3']],
    rotation: ['Water Attunement', 'Air Attunement'],
    startAttunement: 'Fire',
    secondaryAttunement: 'Fire',
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      alacrity: false
    }
  });

  assert.deepEqual(
    flow.steps.filter((step) => String(step.skill).endsWith(' Attunement')).map((step) => step.start),
    [0, 3000]
  );

  const flowDualAttack = runNative({
    lines: [['Fire'], ['Earth'], ['Weaver', '1-1-3']],
    rotation: ['Molten Meteor'],
    startAttunement: 'Fire',
    secondaryAttunement: 'Earth',
    weapons: ['Pistol', 'Dagger'],
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      alacrity: false
    }
  });
  const moltenMeteor = flowDualAttack.events.find(
    (event) => event.type === 'action' && event.skillName === 'Molten Meteor'
  );

  assert.ok(Math.abs(moltenMeteor.rechargeReadyAt - moltenMeteor.endsAt - 9.6) < 1e-9);

  const pursuit = runNative({
    lines: [['Fire'], ['Air'], ['Weaver', '2-3-1']],
    rotation: ['Updraft', 'Primordial Stance (Air)'],
    startAttunement: 'Air',
    secondaryAttunement: 'Air',
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: 'Primordial Stance (Air)',
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Weave Self'
    }
  });

  assert.equal(
    pursuit.events.some((event) => event.source === 'Elemental Pursuit'),
    true
  );
  assert.equal(
    pursuit.events.some((event) => String(event.source).startsWith('Primordial Stance') && event.kind === 'protection'),
    true
  );
});

test('Elemental Polyphony applies both active Weaver attunement bonuses', () => {
  const common = {
    lines: [['Fire'], ['Earth'], ['Weaver', '1-1-3']],
    rotation: ['Flame Uprising', 3000],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Warhorn']
  };
  const fireFire = runNative({
    ...common,
    secondaryAttunement: 'Fire'
  });
  const fireEarth = runNative({
    ...common,
    secondaryAttunement: 'Earth'
  });
  const strike = (result) =>
    result.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Flame Uprising').damage;
  const burning = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillName === 'Flame Uprising' && event.condition === 'Burning'
    ).damage;

  assert.equal(strike(fireEarth), strike(fireFire));
  assert.ok(burning(fireEarth) > burning(fireFire));
});

test('Catalyst traits enforce energy, empowerment, aura, and sphere rules', () => {
  const sphere = runNative({
    lines: [['Fire'], ['Air'], ['Catalyst', '3-3-3']],
    rotation: ['Deploy Jade Sphere (Fire)', 'Arcane Wave', 1000, 'Air Attunement'],
    initialCatalystEnergy: 30
  });

  assert.equal(
    sphere.events.some((event) => event.type === 'resource' && event.source === 'Energized Elements'),
    true
  );
  assert.equal(
    resolvedAndScheduledEvents(sphere).some(
      (event) => event.type === 'elementalist.aura' && event.source === 'Elemental Epitome'
    ),
    true
  );
  assert.equal(
    sphere.events.some(
      (event) =>
        event.type === 'buff' &&
        event.skillName === 'Deploy Jade Sphere (Fire)' &&
        event.kind === 'quickness' &&
        event.duration >= 2
    ),
    true
  );

  const control = runNative({
    lines: [['Fire'], ['Air'], ['Catalyst', '2-1-1']],
    rotation: ['Deploy Jade Sphere (Fire)', 'Arcane Wave', 1000, 'Air Attunement', 'Updraft'],
    initialCatalystEnergy: 30
  });

  for (const source of ['Elemental Synergy', 'Elemental Epitome']) {
    assert.equal(
      control.procSteps.some((step) => step.skill === source),
      true,
      source
    );
  }

  assert.equal(
    control.procSteps.some((step) => step.skill === 'Vicious Empowerment'),
    true
  );
  assert.equal(
    control.procSteps.some((step) => step.skill === 'Empowering Auras'),
    true
  );
});

test('Evoker traits enforce familiar boons, enchantments, and charge rules', () => {
  const offensive = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Zap', 'Charged Strike', 'Polaric Slash', 3000],
    startAttunement: 'Air',
    evokerElement: 'Air',
    initialEvokerCharges: 6
  });

  assert.equal(
    offensive.events.some((event) => event.source === "Familiar's Prowess"),
    true
  );
  assert.equal(
    offensive.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Electric Enchantment')
      .length,
    2
  );
  assert.equal(offensive.endState.profession.maximumCharges, 6);

  const boons = runNative({
    lines: [['Fire'], ['Air'], ['Evoker', '2-2-2']],
    rotation: ['Zap', "Fox's Fury"],
    evokerElement: 'Air',
    initialEvokerCharges: 6,
    selectedSkills: {
      Heal: 'Glyph of Elemental Harmony',
      Utility1: "Fox's Fury",
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Glyph of Elementals'
    }
  });

  assert.equal(
    boons.events.some((event) => event.type === 'buff' && event.source === "Familiar's Blessing"),
    true
  );
  assert.equal(
    boons.events.some(
      (event) => event.type === 'buff' && event.source === "Fox's Fury" && event.kind === 'might' && event.stacks === 3
    ),
    true
  );

  const dynamo = runNative({
    lines: [['Fire'], ['Air'], ['Evoker', '1-3-1']],
    rotation: ['Air Attunement'],
    startAttunement: 'Fire',
    evokerElement: 'Air',
    initialEvokerCharges: 0
  });

  assert.equal(
    dynamo.events.some((event) => event.type === 'resource' && event.source === 'Elemental Dynamo'),
    true
  );
});

test('Elementalist trait coverage documents implementation scope', () => {
  const traitsById = new Map(elementalistCatalog.traits.map((trait) => [trait.id, trait]));
  const implemented = ELEMENTALIST_TRAIT_COVERAGE.filter(
    (entry) => entry.status === TRAIT_COVERAGE_STATUSES.IMPLEMENTED
  );

  for (const entry of implemented) {
    const trait = traitsById.get(entry.traitId);

    assert.ok(trait, String(entry.traitId));
    assert.doesNotMatch(entry.effects[0].description, /Reviewed Elementalist behavior/);
    assert.equal(entry.effects[0].description, String(trait.description).trim());
    assert.equal(Object.hasOwn(entry, 'tests'), false, trait.name);
  }

  for (const name of ['Conjurer', 'Gathered Focus', 'Harmonious Conduit', 'Lucid Singularity']) {
    const trait = elementalistCatalog.traits.find((candidate) => candidate.name === name);
    const entry = ELEMENTALIST_TRAIT_COVERAGE.find((candidate) => candidate.traitId === trait.id);

    assert.equal(entry.status, TRAIT_COVERAGE_STATUSES.IMPLEMENTED, name);
  }
});

test('Fire Elemental autonomously alternates Flame Burst and Fireball', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Glyph of Elementals', 15000],
    startAttunement: 'Fire',
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      quickness: false
    }
  });
  const elementalActions = result.events.filter(
    (event) => event.type === 'action' && event.actorType === 'summon' && event.at < 16
  );
  const flameBurst = result.events.find((event) => event.type === 'damage' && event.skillName === 'Flame Burst');
  const fireball = result.events.find((event) => event.type === 'damage' && event.skillName === 'Fireball');

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    elementalActions.map((event) => [event.skillName, Math.round(event.at * 1000), Boolean(event.interrupted)]),
    [
      ['Flame Burst', 1410, false],
      ['Fireball', 6050, false],
      ['Fireball', 9250, false],
      ['Fireball', 12450, false],
      ['Fireball', 15650, false]
    ]
  );

  assert.equal(
    result.events.some((event) => event.skillName === 'Flame Barrage'),
    false
  );
  assert.equal(
    result.events.filter((event) => event.type === 'damage' && event.skillName === 'Fireball' && event.at < 16).length,
    3
  );
  // Autonomous fire attacks retain their documented bases and may scale with the elemental's Might/modifiers.
  assert.equal(flameBurst.summonDamagePerCoefficient, 1150);
  assert.equal(fireball.summonDamagePerCoefficient, 830);
  assert.notEqual(flameBurst.summonUsesMight, false);
  assert.notEqual(fireball.summonUsesEquipmentModifiers, false);
  assert.equal(result.endState.profession.availableFlips['Flame Barrage'], Infinity);
  assert.equal(result.endState.cooldowns['Glyph of Elementals'], undefined);
});

test('Flame Barrage replaces the active Glyph and obeys rotation timing', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Glyph of Elementals', 1000, 'Flame Barrage', 'Flame Barrage', 4000],
    startAttunement: 'Air',
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      quickness: false,
      alacrity: false
    }
  });
  const elementalActions = result.events.filter((event) => event.type === 'action' && event.actorType === 'summon');

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.summonedElemental.element, 'Fire');
  assert.deepEqual(
    elementalActions.filter((event) => event.skillName === 'Flame Barrage').map((event) => Math.round(event.at * 1000)),
    [2250, 17250]
  );
  assert.ok(
    elementalActions.some(
      (event) => event.skillName === 'Flame Burst' && Math.round(event.at * 1000) === 1410 && event.interrupted === true
    )
  );
  assert.ok(
    elementalActions
      .filter((event) => event.skillName === 'Flame Barrage')
      .every((event) => event.playerCommandedElementalSkill === true && event.autonomousElementalSkill === false)
  );

  const firstBarrageDamage = result.events.filter(
    (event) => event.type === 'damage' && event.skillName === 'Flame Barrage' && event.at < 5
  );

  assert.deepEqual(
    firstBarrageDamage.map((event) => Math.round(event.at * 1000)),
    [3370, 3570, 3770, 3770]
  );
  assert.ok(firstBarrageDamage.every((event) => event.actorType === 'summon'));

  const firstBarrageBurns = result.events.filter(
    (event) => event.type === 'condition' && event.skillName === 'Flame Barrage' && event.at < 5
  );

  assert.equal(firstBarrageBurns.length, 1);
  assert.ok(
    firstBarrageBurns.every(
      (event) =>
        event.actorType === 'player' && event.condition === 'Burning' && event.stacks === 3 && event.duration === 3
    )
  );

  assert.deepEqual(
    firstBarrageDamage.map((event) => event.coefficient),
    [0.15, 0.15, 0.15, 1.8]
  );
  assert.ok(
    firstBarrageDamage.every(
      (event) =>
        event.summonDamagePerCoefficient === 2500 &&
        event.summonUsesMight === false &&
        event.summonUsesEquipmentModifiers === false
    )
  );

  const resolvedBarrages = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Flame Barrage' && event.hitIndex === 1
  );

  assert.equal(resolvedBarrages.length, 2);
  assert.equal(resolvedBarrages[0].damage, resolvedBarrages[1].damage);
  assert.equal(result.endState.profession.availableFlips['Flame Barrage'], Infinity);

  const armedResult = runNative({
    lines: [['Fire'], ['Air'], ['Arcane']],
    rotation: ['Glyph of Elementals', 1000],
    startAttunement: 'Air'
  });
  const build = elementalistAppAdapter.toApplicationBuild({
    ...elementalistProfession.createBuildDefaults(),
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
    results: armedResult
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

  assert.doesNotMatch(palette.innerHTML, /data-skill="Glyph of Elementals"/);
  assert.match(palette.innerHTML, /class="pal-skill" data-skill="Flame Barrage"[\s\S]*?draggable="true"/);
  assert.equal(
    elementalistCatalog.skillsByName.get('Flame Barrage').icon,
    'https://render.guildwars2.com/file/64A5054179704B60614F90964DE1FB3D39AEC972/867446.png'
  );
  assert.match(palette.innerHTML, /64A5054179704B60614F90964DE1FB3D39AEC972/);
  assert.doesNotMatch(palette.innerHTML, /011D983FEAFB946EF0F45E7F290838CFA31D63D0/);
});

test('selected Earth Elemental auto-summons, attacks, and executes Stomp', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Catalyst', '2-1-1']],
    rotation: ['Stomp', 'Stomp', 9000],
    selectedSkills: {
      ...elementalistProfession.createBuildDefaults().selectedSkills,
      Elite: 'Glyph of Elementals (Earth)'
    },
    assumptions: {
      ...elementalistProfession.createBuildDefaults().assumptions,
      quickness: false,
      alacrity: false
    }
  });
  const summonActions = result.events.filter((event) => event.type === 'action' && event.actorType === 'summon');
  const stompDamage = result.events.find((event) => event.type === 'damage' && event.skillName === 'Stomp');
  const immobilize = result.events.find(
    (event) => event.type === 'condition' && event.skillName === 'Stomp' && event.condition === 'Immobilized'
  );
  const cripple = result.events.find(
    (event) => event.type === 'condition' && event.skillName === 'Stomp' && event.condition === 'Crippled'
  );
  const protection = result.events.find(
    (event) => event.type === 'buff' && event.skillName === 'Stomp' && event.kind === 'protection'
  );
  const weakness = result.events.find(
    (event) => event.type === 'condition' && event.skillName === 'Enervating Punch' && event.condition === 'Weakness'
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.summonedElemental.element, 'Earth');
  assert.equal(
    result.events.some((event) => event.type === 'action' && String(event.skillName).startsWith('Glyph of Elementals')),
    false
  );
  assert.deepEqual(
    summonActions.slice(0, 4).map((event) => event.skillName),
    ['Stomp', 'Enervating Punch', 'Punch', 'Punch']
  );
  assert.equal(stompDamage.source, 'Earth Elemental');
  assert.equal(stompDamage.actorType, 'summon');
  assert.equal(Math.round(stompDamage.at * 1000), 1560);
  assert.deepEqual(
    summonActions.filter((event) => event.skillName === 'Stomp').map((event) => Math.round(event.at * 1000)),
    [0, 18000]
  );
  assert.equal(cripple.condition, 'Crippled');
  assert.equal(cripple.duration, 5);
  assert.equal(immobilize.condition, 'Immobilized');
  assert.equal(immobilize.duration, 1);
  assert.equal(immobilize.actorType, 'player');
  assert.equal(immobilize.elementalOwnedCondition, true);
  assert.equal(protection.duration, 3);
  assert.equal(protection.audience.recipients, 'party');
  assert.equal(protection.audience.maximumRecipients, 5);
  assert.equal(weakness.duration, 3);
  assert.equal(weakness.actorType, 'player');
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Vicious Empowerment' && step.sourceSkill === 'Stomp'),
    true
  );
  assert.equal(result.endState.profession.availableFlips.Stomp, Infinity);
  assert.equal(result.endState.profession.availableFlips['Flame Barrage'], undefined);
});

test('Elementalist small-hitbox caps exclude only excess multi-hit packets', () => {
  const cases = [
    {
      skill: 'Meteor Shower',
      small: 12,
      large: 24,
      weapons: ['Staff', ''],
      startAttunement: 'Fire'
    },
    {
      skill: 'Lightning Orb',
      small: 11,
      large: 20,
      weapons: ['Scepter', 'Warhorn'],
      startAttunement: 'Air'
    },
    {
      skill: 'Frost Storm',
      small: 14,
      large: 24,
      rotationPrefix: ['Conjure Frost Bow'],
      selectedSkill: 'Conjure Frost Bow',
      startAttunement: 'Water'
    },
    {
      skill: 'Invoke Lightning',
      small: 9,
      large: 20,
      rotationPrefix: ['Conjure Lightning Hammer'],
      selectedSkill: 'Conjure Lightning Hammer',
      startAttunement: 'Air'
    },
    {
      skill: 'Glyph of Storms (Air)',
      small: 20,
      large: 36,
      selectedSkill: 'Glyph of Storms (Air)',
      startAttunement: 'Air'
    },
    {
      skill: 'Glyph of Storms (Water)',
      small: 11,
      large: 18,
      selectedSkill: 'Glyph of Storms (Water)',
      startAttunement: 'Water'
    },
    {
      skill: 'Dust Storm',
      small: 6,
      large: 8,
      weapons: ['Scepter', 'Warhorn'],
      startAttunement: 'Earth'
    },
    {
      skill: 'Fiery Whirl',
      small: 4,
      large: 8,
      rotationPrefix: ['Conjure Fiery Greatsword'],
      selectedSkill: 'Conjure Fiery Greatsword',
      selectedSlot: 'Elite',
      startAttunement: 'Fire'
    }
  ];

  for (const hitboxSize of ['small', 'large']) {
    for (const entry of cases) {
      const selectedSkills = {
        ...elementalistProfession.createBuildDefaults().selectedSkills,
        ...(entry.selectedSkill ? { [entry.selectedSlot || 'Utility1']: entry.selectedSkill } : {})
      };
      const result = runNative({
        lines: [['Fire'], ['Air'], ['Arcane']],
        rotation: [...(entry.rotationPrefix || []), entry.skill, 20000],
        startAttunement: entry.startAttunement,
        weapons: entry.weapons || ['Sword', 'Dagger'],
        selectedSkills,
        assumptions: {
          ...elementalistProfession.createBuildDefaults().assumptions,
          hitboxSize,
          quickness: false
        }
      });
      const strikes = result.events.filter((event) => event.type === 'damage' && event.skillName === entry.skill);

      assert.equal(strikes.length, entry[hitboxSize], `${entry.skill} on ${hitboxSize}`);
    }
  }
});

test('large Elementalist hitboxes extend Wildfire by two packets', () => {
  const counts = Object.fromEntries(
    ['small', 'large'].map((hitboxSize) => {
      const result = runNative({
        lines: [['Fire'], ['Air'], ['Arcane']],
        rotation: ['Wildfire', 20000],
        startAttunement: 'Fire',
        weapons: ['Scepter', 'Warhorn'],
        assumptions: {
          ...elementalistProfession.createBuildDefaults().assumptions,
          hitboxSize,
          quickness: false
        }
      });

      return [
        hitboxSize,
        result.events.filter((event) => event.type === 'damage' && event.skillName === 'Wildfire').length
      ];
    })
  );

  assert.deepEqual(counts, { small: 9, large: 11 });
});

test('Elementalist actions expose Dodge and contextual conjure controls', () => {
  const selectedSkills = {
    Heal: 'Glyph of Elemental Harmony',
    Utility1: 'Conjure Frost Bow',
    Utility2: 'Signet of Fire',
    Utility3: 'Arcane Wave',
    Elite: 'Glyph of Elementals'
  };
  const { app } = createNativeApp({
    lines: [['Fire'], ['Air'], ['Arcane']],
    selectedSkills
  });

  Object.assign(app, {
    skills: elementalistCatalog.skills,
    weaponData: elementalistAppAdapter.weaponData
  });

  assert.deepEqual(
    paletteActionSkills(app).map((skill) => skill.name),
    ['Dodge']
  );

  const renderResult = (result) => {
    app.results = result;
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

    return palette.innerHTML;
  };

  const initialHtml = renderResult(null);

  assert.match(initialHtml, /data-skill="Dodge"/);
  assert.doesNotMatch(initialHtml, /data-skill="__drop_bundle"/);
  assert.doesNotMatch(initialHtml, /data-skill="__pickup_/);

  const equippedHtml = renderResult(
    runNative({
      lines: [['Fire'], ['Air'], ['Arcane']],
      rotation: ['Conjure Frost Bow'],
      selectedSkills
    })
  );

  assert.match(equippedHtml, /data-skill="Frost Volley"/);
  assert.match(equippedHtml, /data-skill="__drop_bundle"/);
  assert.doesNotMatch(equippedHtml, /data-skill="__pickup_/);
  assert.doesNotMatch(equippedHtml, /data-skill="Flame Uprising"/);

  const pickupHtml = renderResult(
    runNative({
      lines: [['Fire'], ['Air'], ['Arcane']],
      rotation: ['Conjure Frost Bow', '__drop_bundle'],
      selectedSkills
    })
  );

  assert.match(pickupHtml, /data-skill="__pickup_Frost Bow"/);
  assert.doesNotMatch(pickupHtml, /data-skill="__drop_bundle"/);
  assert.match(pickupHtml, /data-skill="Flame Uprising"/);
});
