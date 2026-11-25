import assert from 'node:assert/strict';
import { test } from 'node:test';

import { renderSkills } from '#gw2/app/build/panels/skills.js';
import { skillBreakdownRows } from '#gw2/app/results/skill-breakdown.js';
import {
  displayedSkillTiles,
  paletteSkillView,
  paletteView,
  queryWeaponSkills,
  rotationSelectedSlotSkills
} from '#gw2/app/rotation/palette/model.js';
import { renderPalette } from '#gw2/app/rotation/palette/view.js';
import { findNamedRotationSkill } from '#gw2/integrations/logs/shared/rotation/catalog.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { revenantAppAdapter } from '#gw2/professions/revenant/app/app-definition.js';
import { createRevenantBuildDefaults } from '#gw2/professions/revenant/build/build.js';
import { revenantLegendLoadout } from '#gw2/professions/revenant/build/legend-loadout.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as SKILL } from '#gw2/professions/revenant/data/ids.js';
import { revenantCatalog, revenantProfession } from '#gw2/professions/revenant/profession.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { createCalculateAttributes, createProfessionBuildAttributeRules } from '#tests/helpers/build-attributes.js';
import { inertContainer } from '#tests/helpers/dom.js';
import { modifierComparisonRequest } from '#tests/helpers/modifier-contributions.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { paletteInputFixture } from '#tests/helpers/palette.js';
import { loadProfessionAppAdapter } from '#tests/helpers/profession-app-adapter.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

// Attribute assertions use the same calculator composed into the Revenant adapter.
const calculateRevenantAttributes = createCalculateAttributes(
  createProfessionBuildAttributeRules(revenantCatalog),
  revenantProfession.attributeContributions
);

const baseConfig = Object.freeze({
  selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
  startingLegend: LEGEND.ASSASSIN,
  initialEnergy: 50,
  attributeInputs: baseAttributeInputs({
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  }),
  target: { armor: 2597, conditions: { Vulnerability: 25 } }
});

const simulate = createObservedProfessionSimulator(revenantProfession, baseConfig);

const observationTail = (durationMs) => ({ kind: 'tail', durationMs });

test('modifier contribution candidates include every active Revenant trait', () => {
  const build = createRevenantBuildDefaults();
  const app = {
    analysis: { needsPatchComparison: () => false, state: { results: null } },
    patch: revenantAppAdapter.profession.resolvePatch({ id: 'current' }),
    build,
    attributeData: calculateRevenantAttributes(build, []),
    attributeWeaponSet: 1,
    activeCatalog: revenantCatalog
  };
  const activeTraitNames = app.attributeData.activeTraits.map((trait) => trait.name).sort();
  const candidateNames = modifierComparisonRequest(app, revenantAppAdapter)
    .comparisons.map(({ modifier }) => modifier)
    .filter((candidate) => candidate.type === 'Trait')
    .map((candidate) => candidate.name)
    .sort();

  assert.deepEqual(candidateNames, activeTraitNames);
});

test('legend palette shows only the destination legend with the shared swap cooldown', async () => {
  const context = {
    catalog: revenantCatalog,
    build: baseConfig,
    specialization: 'Core',
    professionState: {
      ...{
        [STATE.ACTIVE_LEGEND_ID]: LEGEND.ASSASSIN,
        [STATE.ACTIVE_LOADOUT_ID]: LEGEND.ASSASSIN
      },
      [STATE.AVAILABLE_FLIPS]: {}
    }
  };
  const group = revenantProfession.ui
    .paletteGroups(context)
    .find((candidate) => candidate.id === 'revenant-profession');

  assert.deepEqual(
    group.skillEntries.map((entry) => entry.paletteLegendId),
    [LEGEND.DEMON]
  );
  assert.ok(group.skillEntries.every((entry) => entry.skillId === -4 && entry.icon));
  assert.ok(group.skillEntries.every((entry) => !/Legendary|Stance/.test(entry.displayName)));
  const [destination] = group.skillEntries;

  assert.notEqual(revenantProfession.ui.paletteOverride(context, destination).available, false);
  const cooldownContext = {
    ...context,
    time: 1,
    cooldownsBySkillId: { [SKILL.SWAP_LEGENDS]: { readyAtMs: 10000, remainingMs: 9000 } }
  };

  assert.equal(
    paletteSkillView(
      paletteInputFixture({
        planning: {
          availability: {},
          atSeconds: 1,
          ammoBySkillId: {},
          cooldownsBySkillId: cooldownContext.cooldownsBySkillId,
          profession: cooldownContext.professionState
        },
        specialization: 'Core',
        isSkillAvailable: revenantAppAdapter.isSkillAvailable,
        weaponSkillMatchesSet: revenantAppAdapter.weaponSkillMatchesSet,
        slotLoadout: revenantAppAdapter.slotLoadout,
        weaponData: revenantAppAdapter.weaponData,
        ui: revenantAppAdapter.profession.ui,
        projectActions: revenantAppAdapter.profession.ui.paletteActionSkills
      }),
      revenantCatalog.skillsById.get(SKILL.SWAP_LEGENDS),
      { contextAvailable: true }
    ).cooldownLabel,
    '9.000s'
  );
  const swappedGroup = revenantProfession.ui
    .paletteGroups({
      ...context,
      professionState: {
        ...context.professionState,
        [STATE.ACTIVE_LEGEND_ID]: LEGEND.DEMON,
        [STATE.ACTIVE_LOADOUT_ID]: LEGEND.DEMON
      }
    })
    .find((candidate) => candidate.id === 'revenant-profession');

  assert.deepEqual(
    swappedGroup.skillEntries.map((entry) => entry.paletteLegendId),
    [LEGEND.ASSASSIN]
  );
  const loadout = revenantLegendLoadout.view(context);

  assert.equal(loadout.selectionControl, 'icons');
  assert.equal(loadout.selectors.length, 2);
  assert.ok(loadout.bars.every((bar) => bar.icon));
  assert.ok(loadout.bars.every((bar) => !/Legendary|Stance/.test(bar.compactLabel)));
  const legendGroups = revenantLegendLoadout.paletteGroups(context);

  assert.deepEqual(
    legendGroups.map((group) => group.label),
    ['Assassin', 'Demon']
  );
  assert.equal(legendGroups[0].resourceAnchor, true);
  assert.match(legendGroups[0].className, /compact-resource-palette/);
  assert.equal(legendGroups[1].resourceAnchor, false);
  assert.equal(legendGroups[1].className, 'revenant-legend-skills-inactive');
  assert.deepEqual(revenantLegendLoadout.skillChildren(context, SKILL.FACET_OF_ELEMENTS), [SKILL.ELEMENTAL_BLAST]);
  assert.deepEqual(revenantLegendLoadout.skillChildren(context, SKILL.FACET_OF_STRENGTH), [SKILL.BURST_OF_STRENGTH]);
  assert.deepEqual(revenantLegendLoadout.skillChildren(context, SKILL.CALL_TO_ANGUISH), [SKILL.UNYIELDING_IMPACT]);
  const rotationGroups = paletteView(revenantProfession, context);

  assert.deepEqual(
    rotationGroups.map((group) => group.id),
    ['revenant-profession']
  );
  assert.equal(revenantLegendLoadout.palettePlacement, 'after-actions');
  const rotationApp = paletteInputFixture({
    planning: null,
    ui: revenantProfession.ui,
    projectActions: revenantProfession.ui.paletteActionSkills,
    canSwapWeaponSetsInCombat: revenantProfession.resolveProfession({ specialization: 'Core' })
      .canSwapWeaponSetsInCombat,
    specialization: 'Core',
    slotLoadout: revenantLegendLoadout,
    build: context.build,
    catalog: revenantCatalog
  });

  assert.deepEqual(rotationSelectedSlotSkills(rotationApp), []);

  const adapter = await loadProfessionAppAdapter('revenant');
  const canonicalBuild = createRevenantBuildDefaults();

  canonicalBuild.selectedLegends = [LEGEND.ASSASSIN, LEGEND.DEMON];
  canonicalBuild.startingLegend = LEGEND.ASSASSIN;
  const build = adapter.toApplicationBuild(canonicalBuild);

  build.rotation = ['__combat_start', 'Swap Legends'];
  const app = {
    analysis: { needsPatchComparison: () => false, state: { results: simulate('Core', build.rotation) } },
    patch: revenantAppAdapter.profession.resolvePatch({ id: 'current' }),
    build,
    adapter,
    profession: revenantProfession,
    activeCatalog: revenantCatalog,
    weaponData: adapter.weaponData
  };
  const palette = inertContainer();
  const skillBar = { innerHTML: '', classList: { remove() {} }, querySelectorAll: () => [] };
  const previousDocument = globalThis.document;

  globalThis.document = {
    querySelector: () => null,
    getElementById: (id) => (id === 'rotation-palette' ? palette : id === 'skill-bar' ? skillBar : null)
  };
  try {
    renderSkills(app);
    renderPalette(app);
  } finally {
    globalThis.document = previousDocument;
  }

  assert.match(skillBar.innerHTML, /data-loadout-toggle/);
  assert.match(skillBar.innerHTML, /data-loadout-key="selectedLegends:[01]"/);
  assert.doesNotMatch(skillBar.innerHTML, /fixed-loadout-selector-label/);
  assert.doesNotMatch(skillBar.innerHTML, /skill-bar-key/);
  assert.doesNotMatch(skillBar.innerHTML, /skill-bar-type/);
  assert.equal((palette.innerHTML.match(/data-skill="Swap Legends"/g) || []).length, 1);
  assert.match(palette.innerHTML, /data-skill="Swap Legends"[\s\S]*?<span class="pal-cd">10\.000s<\/span>/);
});

test('Revenant utilities and Conduit resources render by their related skills', async () => {
  const adapter = await loadProfessionAppAdapter('revenant');
  const canonicalBuild = createRevenantBuildDefaults();

  canonicalBuild.specializations[2] = {
    name: 'Conduit',
    traits: '1-1-1'
  };
  canonicalBuild.selectedLegends = [LEGEND.ENTITY, LEGEND.ASSASSIN];
  canonicalBuild.startingLegend = LEGEND.ENTITY;
  const build = adapter.toApplicationBuild(canonicalBuild);
  const app = {
    analysis: { needsPatchComparison: () => false, state: { results: null } },
    patch: revenantAppAdapter.profession.resolvePatch({ id: 'current' }),
    build,
    adapter,
    profession: revenantProfession,
    activeCatalog: revenantCatalog,
    weaponData: adapter.weaponData
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
  const profession = html.indexOf('revenant-f-skills');
  const affinityGroup = html.indexOf('profession-palette-resource-group resource-above');
  const state = html.indexOf('data-role="profession-resource-stack"');
  const combat = html.indexOf('data-role="weapon-palette-section"');
  const utility = html.indexOf('data-role="loadout-utility-palette-group"');
  const legends = html.indexOf('data-role="loadout-palette-stack"');
  const energy = html.indexOf('data-resource-id="energy"');
  const affinity = html.indexOf('data-resource-id="affinity"');
  const tools = html.indexOf('data-role="timeline-tools-palette-stack"');

  assert.ok(affinityGroup >= 0);
  assert.ok(affinity > affinityGroup);
  assert.ok(profession > affinity);
  assert.ok(profession >= 0);
  assert.ok(combat > profession);
  assert.ok(utility > combat);
  assert.ok(state > utility);
  assert.ok(legends > state);
  assert.ok(energy > legends);
  assert.ok(tools > energy);
  assert.equal(html.match(/data-resource-id="energy"/g)?.length, 1);
  assert.equal(html.match(/data-resource-id="affinity"/g)?.length, 1);
  assert.match(html, /compact-resource-palette revenant-legend-skills/);
  assert.match(html, /compact-profession-resource-revenant-energy/);
  assert.match(html, /<strong>50\/100<\/strong>/);
  const weaponSwap = html.indexOf('data-skill="Swap Weapons"');
  const weaponSwapGroup = html.lastIndexOf('<div class="pal-group', weaponSwap);

  assert.ok(weaponSwap >= 0);
  assert.match(html.slice(weaponSwapGroup, weaponSwap), /class="pal-label"[^>]*>W[12]<\/div>/);
  assert.match(html, /action-palette-group/);
  assert.match(html, /timeline-tools-palette-stack[\s\S]*__combat_start/);
  assert.match(html, /timeline-tools-palette-stack[\s\S]*__cooldown_reset/);
  assert.match(html, /timeline-tools-palette-stack[\s\S]*__wait/);
});

test('weapon swap changes the active Revenant weapon set', () => {
  const result = simulate('Core', ['Swap Weapons'], {
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword',
    weaponSet2Primary: 'Mace',
    weaponSet2Secondary: 'Axe'
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.planningState.activeWeaponSet, 2);
  assert.ok(result.events.some((event) => event.type === 'weapon_set' && event.weaponSet === 2));
});

test('Revenant scepter follow-ups replace and restore weapon slots 2 and 3', () => {
  const app = paletteInputFixture({
    planning: null,
    catalog: revenantCatalog,
    ui: revenantProfession.ui,
    projectActions: revenantProfession.ui.paletteActionSkills,
    canSwapWeaponSetsInCombat: revenantProfession.resolveProfession({ specialization: 'Core' })
      .canSwapWeaponSetsInCombat
  });
  const paletteAfter = (rotation, names) => {
    app.planning = simulate('Core', rotation, {
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Sword'
    }).planningState;

    return displayedSkillTiles(
      app,
      names.map((name) => revenantCatalog.skills.find((candidate) => candidate.name === name))
    ).map((skill) => skill.name);
  };

  assert.match(
    simulate('Core', ['Detonate Blossoming Aura'], {
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Sword'
    })
      .warnings.map(({ message }) => message)
      .join(' '),
    /use Blossoming Aura first/
  );
  assert.deepEqual(paletteAfter([], ['Blossoming Aura']), ['Blossoming Aura']);
  assert.deepEqual(paletteAfter(['Blossoming Aura'], ['Blossoming Aura']), ['Detonate Blossoming Aura']);
  assert.deepEqual(paletteAfter(['Blossoming Aura', 'Detonate Blossoming Aura'], ['Blossoming Aura']), [
    'Blossoming Aura'
  ]);
  assert.deepEqual(paletteAfter(['Otherworldly Bond'], ['Otherworldly Bond']), ['Deactivate Otherworldly Bond']);
  assert.deepEqual(
    paletteAfter(
      ['Otherworldly Bond', { type: 'wait', durationMs: 1000 }, 'Deactivate Otherworldly Bond'],
      ['Otherworldly Bond']
    ),
    ['Otherworldly Bond']
  );
  // Maturation changes the same weapon slot to the enemy pull until the tether is released.
  assert.deepEqual(paletteAfter(['Otherworldly Bond', { type: 'wait', durationMs: 4000 }], ['Otherworldly Bond']), [
    'Otherworldly Attraction (enemy)'
  ]);
});

test('Temporal Rift preserves the Mace autoattack chain', () => {
  const result = simulate('Core', ['Misery Swipe', 'Temporal Rift', 'Anguish Swipe'], {
    primaryWeapon: 'Mace',
    secondaryWeapon: 'Axe'
  });

  assert.equal(result.warnings.length, 0);
  assert.deepEqual(
    result.steps.map((step) => step.skillName),
    ['Misery Swipe', 'Temporal Rift', 'Anguish Swipe']
  );
  assert.equal(result.planningState.profession[STATE.AUTOATTACK_CHAINS][SKILL.MISERY_SWIPE], SKILL.MANIFEST_TOXIN);
});

test('Temporal Rift preserves the Sword autoattack chain until its delayed hit', () => {
  const result = simulate('Core', ['Preparation Thrust', 'Temporal Rift', 'Brutal Blade'], {
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Axe'
  });

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => step.skillName),
    ['Preparation Thrust', 'Temporal Rift', 'Brutal Blade']
  );
  assert.equal(result.planningState.profession[STATE.AUTOATTACK_CHAINS][SKILL.PREPARATION_THRUST], SKILL.RIFT_SLASH);
});

test('Beguiling Haze resets the Sword autoattack chain', () => {
  const result = simulate(
    'Conduit',
    ['Preparation Thrust', 'Brutal Blade', { type: 'cast', skillId: 77141 }, 'Preparation Thrust'],
    {
      selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ENTITY,
      initialEnergy: 100,
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Sword'
    }
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => step.skillName),
    ['Preparation Thrust', 'Brutal Blade', 'Beguiling Haze', 'Preparation Thrust']
  );
  assert.equal(result.planningState.profession[STATE.AUTOATTACK_CHAINS][SKILL.PREPARATION_THRUST], SKILL.BRUTAL_BLADE);
});

test('Citadel Bombardment resets the Renegade autoattack chain', () => {
  const result = simulate(
    'Renegade',
    ['Preparation Thrust', 'Brutal Blade', 'Citadel Bombardment', 'Preparation Thrust'],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100,
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Sword'
    }
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => step.skillName),
    ['Preparation Thrust', 'Brutal Blade', 'Citadel Bombardment', 'Preparation Thrust']
  );
  assert.equal(result.planningState.profession[STATE.AUTOATTACK_CHAINS][SKILL.PREPARATION_THRUST], SKILL.BRUTAL_BLADE);
});

test('Bloodbane Path keeps Bleeding aligned with landed projectile packets', () => {
  const result = simulate(
    'Renegade',
    [{ type: 'cast', skillId: SKILL.BLOODBANE_PATH, interruptAfterMs: 750 }],
    {
      primaryWeapon: 'Shortbow',
      secondaryWeapon: '',
      initialEnergy: 100
    },
    observationTail(2000)
  );
  const packetTimes = (type) =>
    result.events
      .filter((event) => event.type === type && event.skillName === 'Bloodbane Path')
      .map((event) => event.at);

  assert.deepEqual(packetTimes('condition'), packetTimes('damage'));
  assert.ok(packetTimes('condition').length > 0);
});

// Repeated spear swings share one selectable action instead of adding a synthetic palette entry.
test('Abyssal Strike repeats without exposing a separate second-swing palette tile', () => {
  const result = simulate('Core', ['Abyssal Strike', 'Abyssal Strike', 'Abyssal Strike', 'Abyssal Strike'], {
    primaryWeapon: 'Spear',
    secondaryWeapon: '',
    boons: { quickness: true }
  });

  assert.equal(result.warnings.length, 0);

  assert.ok(
    result.events.filter((event) => event.type === 'damage').every((event) => event.skillName === 'Abyssal Strike')
  );

  const paletteApp = paletteInputFixture({
    planning: null,
    ui: revenantProfession.ui,
    projectActions: revenantProfession.ui.paletteActionSkills,
    canSwapWeaponSetsInCombat: revenantProfession.resolveProfession({ specialization: 'Core' })
      .canSwapWeaponSetsInCombat,
    catalog: revenantCatalog,
    build: {
      weapons: ['Spear', ''],
      alternateWeapons: ['Sword', 'Sword']
    },
    specialization: 'Core',
    isSkillAvailable: (skill) => !skill.rotationInputExcluded
  });

  assert.deepEqual(
    queryWeaponSkills(paletteApp)
      .filter((skill) => skill.slot === 'Weapon_1')
      .map((skill) => skill.name),
    ['Abyssal Strike']
  );
});

// The shared Greatsword input wins over its excluded hit identity in both palette and name-only log lookup.
test('Phantom’s Onslaught remains the shared Greatsword input for every Revenant specialization', () => {
  for (const specializationName of ['Core', 'Herald', 'Renegade', 'Vindicator', 'Conduit']) {
    const app = paletteInputFixture({
      planning: null,
      ui: revenantProfession.ui,
      projectActions: revenantProfession.ui.paletteActionSkills,
      canSwapWeaponSetsInCombat: revenantProfession.resolveProfession({ specialization: specializationName })
        .canSwapWeaponSetsInCombat,
      catalog: revenantCatalog,
      build: { weapons: ['Greatsword', ''], alternateWeapons: ['', ''] },
      specialization: specializationName,
      isSkillAvailable: (skill) => revenantAppAdapter.isSkillAvailable(skill, { specialization: specializationName })
    });
    assert.deepEqual(
      queryWeaponSkills(app)
        .filter((skill) => skill.name === "Phantom's Onslaught")
        .map((skill) => skill.id),
      [62895]
    );
    assert.equal(
      findNamedRotationSkill("Phantom's Onslaught", revenantCatalog, {
        specializationName,
        skillNameAliases: {},
        skillIdAliases: {}
      }).id,
      62895
    );
  }
});

test('Searing Fissure enables Fire whirl combos only while its field is present', () => {
  const result = simulate('Core', ['Searing Fissure', { type: 'wait', durationMs: 3500 }], {
    primaryWeapon: 'Mace',
    secondaryWeapon: 'Axe',
    initialEnergy: 100
  });

  assert.equal(result.warnings.length, 0);

  const combo = simulate('Conduit', ['Searing Fissure', { type: 'cast', skillId: 76968 }], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.DEMON],
    startingLegend: LEGEND.ENTITY,
    primaryWeapon: 'Mace',
    secondaryWeapon: 'Axe',
    initialEnergy: 100
  });

  assert.deepEqual(
    combo.resolvedEvents
      .filter(
        (event) =>
          event.type === 'combo' &&
          event.skillName === 'Twin Moon Sweep' &&
          event.fieldType === 'Fire' &&
          event.finisherType === 'Whirl'
      )
      .map((event) => [event.at, event.applicationCount, event.outcome.stacks, event.outcome.duration]),
    [[1.52, 2, 1, 1]]
  );

  const noField = simulate('Conduit', [{ type: 'cast', skillId: 76968 }], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.DEMON],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100
  });

  assert.equal(
    noField.resolvedEvents.filter(
      (event) =>
        event.type === 'combo' &&
        event.skillName === 'Twin Moon Sweep' &&
        event.fieldType === 'Fire' &&
        event.finisherType === 'Whirl'
    ).length,
    0
  );
});

test('spear reductions advance base Raze recharge once per activation at its recharge rate', () => {
  // Test the proposed base-progress model with and without Alacrity, observing all delayed pulses.
  for (const alacrity of [false, true]) {
    for (const [skill, seconds] of [
      ['Abyssal Strike', 1],
      ['Abyssal Force', 5],
      ['Abyssal Blitz', 3],
      ['Abyssal Blot', 3]
    ]) {
      const result = simulate('Core', ['Abyssal Raze', skill, { type: 'wait', durationMs: 2500 }], {
        primaryWeapon: 'Spear',
        secondaryWeapon: '',
        initialEnergy: 100,
        boons: { alacrity }
      });
      const reductions = result.procSteps.filter((proc) => proc.skill.endsWith('Abyssal Raze recharge'));
      const rate = 1.25;
      assert.deepEqual(result.warnings, []);
      assert.deepEqual(
        reductions.map((proc) => proc.cooldownReduction),
        [seconds / rate],
        skill
      );
      const expectedReadyAt = result.steps[0].end / 1000 + (15 - seconds) / rate;
      assert.ok(
        Math.abs(
          observedRuntime(result).cooldownController.readAmmo(SKILL.ABYSSAL_RAZE).nextRechargeAt - expectedReadyAt
        ) < 1e-9,
        skill
      );
    }
  }
});

test('Abyssal Raze blasts Abyssal Blot for Dark Aura without Leeching Bolts', () => {
  const result = simulate('Core', ['Abyssal Blot', 'Abyssal Raze'], {
    primaryWeapon: 'Spear',
    secondaryWeapon: '',
    initialEnergy: 100,
    boons: { quickness: true }
  });
  const combo = result.resolvedEvents.find(
    (event) => event.type === 'combo' && event.skillName === 'Abyssal Raze' && event.fieldType === 'Dark'
  );

  // Dark blasts grant Dark Aura; only dark whirl finishers own Leeching Bolts damage.
  assert.equal(combo?.finisherType, 'Blast');
  assert.equal(combo?.name, 'Dark Aura');
  assert.ok(
    result.resolvedEvents.some(
      (event) => event.type === 'aura' && event.name === 'Dark Aura' && event.skillName === 'Abyssal Raze'
    )
  );
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.name === 'Leeching Bolts'),
    false
  );
  assert.equal(skillBreakdownRows(result).find((row) => row.name === 'Abyssal Raze')?.hits, 1);
});

test("Abyssal Strike reduces Raze's displayed cooldown with no charges", () => {
  const result = simulate(
    'Core',
    ['Abyssal Raze', 'Abyssal Raze', 'Abyssal Raze', { type: 'wait', durationMs: 7100 }, 'Abyssal Strike'],
    {
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      initialEnergy: 100
    }
  );

  assert.equal(result.warnings.length, 0);

  assert.equal(observedRuntime(result).cooldownController.readAmmo(SKILL.ABYSSAL_RAZE).nextRechargeAt, 11.8);
  assert.deepEqual(result.planningState.cooldownsBySkillId[SKILL.ABYSSAL_RAZE], {
    readyAtMs: 11800,
    remainingMs: 11800 - Math.round(result.rotationEndTime * 1000)
  });
});

test('Abyssal Raze recharge reduction carries only excess work into the next queued charge', () => {
  const rotation = ['Abyssal Raze', 'Abyssal Raze', 'Abyssal Raze'];
  const config = { primaryWeapon: 'Spear', secondaryWeapon: '', initialEnergy: 100 };
  // Start Strike just before the first charge returns so its refund reaches the second charge.
  const spent = simulate('Core', rotation, config);
  const beforeReduction = observedRuntime(spent).cooldownController;
  const pool = beforeReduction.readAmmo(SKILL.ABYSSAL_RAZE);
  const pendingRecharge = pool.recharges[0];
  const durationMs = Math.round((pool.nextRechargeAt - spent.rotationEndTime) * 1000) - 800;
  const result = simulate('Core', [...rotation, { type: 'wait', durationMs }, 'Abyssal Strike'], config);

  const rechargeProc = result.procSteps.find((proc) => proc.skill.endsWith('Abyssal Raze recharge'));

  assert.equal(rechargeProc.cooldownReduction, 0.8);
  // Completing the front charge carries only the unused reduction into the next, leaving later work intact.
  const runtime = observedRuntime(result);
  const ammo = runtime.cooldownController.readAmmo(SKILL.ABYSSAL_RAZE);
  const remainingWork = beforeReduction.remaining(
    revenantCatalog.skillsById.get(SKILL.ABYSSAL_RAZE),
    pendingRecharge,
    rechargeProc.start / 1000
  );
  const overflow = 1 - remainingWork;
  assert.equal(ammo.charges, 1);
  assert.equal(ammo.recharges.length, 2);
  assert.ok(overflow > 0 && overflow < 1);
  assert.ok(Math.abs(ammo.recharges[0].work - (15 - overflow)) < 1e-9);
  assert.equal(ammo.recharges[1].work, 15);
  assert.equal(result.planningState.cooldownsBySkillId[SKILL.ABYSSAL_RAZE], undefined);
});

test('Crushing Abyss scales Raze and triggers at three stacks on weapon swap', () => {
  const result = simulate('Core', ['Abyssal Raze', 'Abyssal Raze', 'Abyssal Raze', 'Swap Weapons'], {
    primaryWeapon: 'Spear',
    secondaryWeapon: '',
    weaponSet2Primary: 'Sword',
    weaponSet2Secondary: 'Sword',
    initialEnergy: 100,
    boons: { quickness: true }
  });

  assert.equal(result.warnings.length, 0);
  const razes = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Abyssal Raze');

  assert.deepEqual(
    razes.map((event) => event.coefficient),
    [1, 1, 1, 1]
  );
  // Each impact captures its stacks before the grant; swapping consumes stacks without boosting its strike.
  for (const [index, factor] of [1, 1.33, 1.6600000000000001, 1].entries()) {
    assert.equal(razes[index].metadata.revenantAbyssalRazeDamageFactor, factor);
    assertFlooredDamageMultiplier(razes[index].damage, razes[0].damage, factor);
  }

  assert.ok(
    result.events
      .filter(
        (event) => event.type === 'condition' && event.skillName === 'Abyssal Raze' && event.condition === 'Torment'
      )
      .every((event) => event.duration === 5)
  );
  assert.equal(razes.at(-1).triggeredBy, 'Swap Weapons');
  assert.equal(
    result.events.filter((event) => event.type === 'buff' && event.kind === 'crushing-abyss' && event.duration === 10)
      .length,
    3
  );
  const abyssalRaze = revenantCatalog.skillsById.get(SKILL.ABYSSAL_RAZE);
  const crushingAbyssEffect = abyssalRaze.effects.find(
    (effect) => effect.type === 'buff' && effect.kind === 'crushing-abyss'
  );

  assert.equal(crushingAbyssEffect.sourceId, 72962);
  assert.deepEqual(
    result.procSteps
      .filter((proc) => proc.skill === 'Crushing Abyss')
      .map((proc) => [proc.sourceSkill, proc.detail, proc.icon]),
    ['1/3 stacks', '2/3 stacks', '3/3 stacks'].map((detail) => ['Abyssal Raze', detail, abyssalRaze.icon])
  );
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'condition' && event.name === 'Abyssal Raze - Crushing Abyss Torment')
      .map((event) => [event.stacks, event.duration]),
    [
      [2, 5],
      [4, 5],
      [6, 5]
    ]
  );
  assert.deepEqual(result.planningState.profession[STATE.CRUSHING_ABYSS], []);
});
