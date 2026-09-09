import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, test } from 'node:test';
import { loadProfession, loadProfessionAppAdapter } from '#gw2/app/profession/registry.js';
import { simulationEventLogRows } from '#gw2/app/results/simulation-event-log.js';
import { skillBreakdownRows } from '#gw2/app/results/result-tables.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import {
  REVENANT_LEGEND_IDS as LEGEND,
  REVENANT_SKILL_IDS as SKILL,
  REVENANT_TRAIT_IDS as TRAIT
} from '#gw2/professions/revenant/data/ids.js';
import { CONDUIT_BALANCE_PROFILE_IDS } from '#gw2/professions/revenant/specializations/conduit/profiles.js';
import { revenantProfession } from '#gw2/professions/revenant/definition.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

const revenantAttributeRules = Object.freeze({
  modifyAttributes(context, value) {
    return revenantProfession.resolveRuntime(context?.config || {}).modifyAttributes(context, value);
  },
  modifyCriticalChance(context, value) {
    return revenantProfession.resolveRuntime(context?.config || {}).modifyCriticalChance(context, value);
  },
  modifyStrikeDamage(context, value) {
    return revenantProfession.resolveRuntime(context?.config || {}).modifyStrikeDamage(context, value);
  },
  modifyConditionDamage(context, value) {
    return revenantProfession.resolveRuntime(context?.config || {}).modifyConditionDamage(context, value);
  },
  modifyConditionDuration(context, value) {
    return revenantProfession.resolveRuntime(context?.config || {}).modifyConditionDuration(context, value);
  }
});

const baseConfig = Object.freeze({
  selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
  startingLegend: LEGEND.ASSASSIN,
  initialEnergy: 50,
  selectedDodge: 'Death Drop',
  allianceSide: 'luxon',
  stats: {
    power: 2000,
    precision: 1500,
    ferocity: 500,
    conditionDamage: 1000,
    expertise: 0,
    vitality: 1000
  },
  target: { armor: 2597, conditions: { Vulnerability: 25 } }
});

const simulate = createProfessionSimulator(revenantProfession, baseConfig);

const observationTail = (durationMs) => ({ kind: 'tail', durationMs });

const strikeCoefficient = (effect) =>
  effect.ticks?.reduce((total, tick) => total + Number(tick.coefficient), 0) ?? Number(effect.coefficient);

test('sword follow-ups retain their casting skill while exposing separate damage identities', async () => {
  // Damage labels and packet IDs must split the breakdown without changing activation ownership.
  const profession = await loadProfession('revenant');
  for (const [skillName, followupName, sourceId] of [
    ['Deathstrike', 'Deathstrike — Follow-up', SKILL.DEATHSTRIKE_ID_28625],
    ['Rift Slash', 'Rift Slash — Rift', 29073]
  ]) {
    const result = simulate(
      'Renegade',
      skillName === 'Rift Slash' ? ['Preparation Thrust', 'Brutal Blade', skillName] : [skillName],
      { primaryWeapon: 'Sword', secondaryWeapon: 'Sword' },
      observationTail(2000)
    );
    const primary = result.resolvedEvents.find((event) => event.type === 'damage' && event.name === skillName);
    const followup = result.resolvedEvents.find((event) => event.type === 'damage' && event.name === followupName);
    assert.ok(primary);
    assert.ok(followup);
    assert.equal(followup.sourceId, sourceId);
    assert.notEqual(followup.sourceId, primary.sourceId);
    assert.equal(followup.skillId, primary.skillId);
    assert.equal(followup.activationId, primary.activationId);
    const rows = skillBreakdownRows(result);
    assert.ok(rows.some((row) => row.name === skillName));
    assert.ok(rows.some((row) => row.name === followupName));
    assert.ok(
      simulationEventLogRows(result, null, profession).some((row) => row.description.startsWith(`HIT ${followupName} `))
    );
  }
});

describe('Power Conduit skill profiles', () => {
  const skill = (name) => revenantCatalog.skillsByName.get(name);
  test('retain authored cooldowns, casts, and coefficients', () => {
    const cooldowns = {
      Deathstrike: 15,
      'Shackling Wave': 15,
      'Chilling Isolation': 5,
      'Twin Moon Sweep': 3,
      'Beguiling Haze': 10,
      'Release Potential: Dervish': 10,
      "Gladiator's Defense": 5,
      'Release Potential: Assassin': 10,
      "Eternity's Requiem": 15,
      "Phantom's Onslaught": 8,
      'Mist Unleashed': 3,
      'Cosmic Wisdom': 20
    };

    for (const [name, cooldown] of Object.entries(cooldowns)) {
      assert.equal(skill(name).cooldown, cooldown, name);
    }

    for (const [name, castTimeMs, coefficient] of [
      ['Preparation Thrust', 540, 0.75],
      ['Brutal Blade', 840, 0.8],
      ['Mist Swing', 400, 0.7],
      ['Mist Slash', 600, 0.8],
      ['Arcing Mists', 680, 1.2],
      ['Mist Unleashed', 780, 1.6],
      ["Phantom's Onslaught", 640, 1.6]
    ]) {
      assert.equal(skill(name).castTimeMs, castTimeMs, name);
      assert.equal(
        strikeCoefficient(skill(name).effects.find((effect) => effect.type === 'strike')),
        coefficient,
        name
      );
    }

    for (const name of ['Mist Swing', 'Mist Slash', 'Arcing Mists']) {
      assert.equal(skill(name).quicknessCastTimeMs, undefined, name);
      assert.equal(skill(name).unaffectedByQuickness, true, name);
    }

    for (const [name, quicknessCastTimeMs] of [
      ['Release Potential: Dervish', 680],
      ['Shackling Wave', 800],
      ['Deathstrike', 720],
      ['Twin Moon Sweep', 920],
      ['Preparation Thrust', 360],
      ['Brutal Blade', 560],
      ['Rift Slash', 480],
      ["Eternity's Requiem", 840],
      ["Phantom's Onslaught", 440],
      ['Mist Unleashed', 520],
      ['Release Potential: Assassin', 720]
    ]) {
      assert.equal(skill(name).quicknessCastTimeMs, quicknessCastTimeMs, name);
    }

    assert.equal(skill('Chilling Isolation').castTimeMs, 680);
    assert.equal(skill('Chilling Isolation').quicknessCastTimeMs, undefined);
    assert.equal(skill('Chilling Isolation').unaffectedByQuickness, true);
    assert.equal(skill('Chilling Isolation').defaultInterruptMs, undefined);
    assert.equal(skill('Deathstrike').rechargeAnchor, 'castStart');
    assert.equal(skill('Deathstrike').rechargeOffsetMs, 420);
    assert.equal(skill("Phantom's Onslaught").dashTimeMs, 40);
    assert.equal(skill("Phantom's Onslaught").hitDelayMs, 400);
    assert.equal(skill("Phantom's Onslaught").rechargeAnchor, 'castStart');
    assert.equal(skill("Phantom's Onslaught").rechargeOffsetMs, 40);
    const alternateOnslaught = revenantCatalog.skillsById.get(SKILL.PHANTOMS_ONSLAUGHT_ID_62713);
    assert.equal(alternateOnslaught.rechargeOffsetMs, 40);
    assert.equal(alternateOnslaught.castTimeMs, 640);
    assert.equal(alternateOnslaught.quicknessCastTimeMs, 440);
    assert.equal(
      revenantCatalog.balanceProfilesById
        .get(CONDUIT_BALANCE_PROFILE_IDS.enhancedEmbodiment)
        .effects.find((effect) => effect.kind === 'cosmic-wisdom-extension').duration,
      1
    );
    assert.equal(
      revenantCatalog.skillsById
        .get(SKILL.FORM_OF_THE_DERVISH_ATTACK)
        .effects.find((effect) => effect.type === 'strike').coefficient,
      0.8
    );
    assert.equal(
      revenantCatalog.skillsById.get(SKILL.GLADIATORS_DEFENSE).effects.find((effect) => effect.type === 'strike')
        .coefficient,
      1.5
    );
    assert.equal(
      revenantCatalog.skillsById
        .get(SKILL.RELEASE_POTENTIAL_ASSASSIN)
        .effects.find((effect) => effect.type === 'strike').ticks[0].coefficient,
      0.6
    );
  });

  const config = {
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword',
    boons: { quickness: true, alacrity: true }
  };
  const damageTimeline = (result, skillName) =>
    result.events
      .filter((event) => event.type === 'damage' && event.skillName === skillName)
      .map((event) => [Math.round(event.at * 1000), event.name, event.coefficient]);

  test('resolves Deathstrike and Shackling Wave packet timing', () => {
    const deathstrike = simulate('Conduit', ['Deathstrike'], config);

    assert.deepEqual(damageTimeline(deathstrike, 'Deathstrike'), [
      [320, 'Deathstrike', 0.45],
      [600, 'Deathstrike — Follow-up', 2.67]
    ]);
    assert.deepEqual(deathstrike.endState.cooldowns.Deathstrike, {
      readyAt: 12420,
      remaining: 11700
    });
    assert.deepEqual(
      damageTimeline(simulate('Conduit', ['Shackling Wave'], config, observationTail(1000)), 'Shackling Wave'),
      [
        [640, 'Initial Damage', 1.2],
        [720, 'Additional Strikes', 0.4],
        [800, 'Additional Strikes', 0.4],
        [880, 'Additional Strikes', 0.4],
        [960, 'Additional Strikes', 0.4],
        [1040, 'Additional Strikes', 0.4]
      ]
    );
  });

  test('resolves sword autoattack timing', () => {
    const swordAutos = simulate('Conduit', ['Preparation Thrust', 'Brutal Blade'], config);

    assert.deepEqual(
      swordAutos.events
        .filter((event) => event.type === 'damage' && ['Preparation Thrust', 'Brutal Blade'].includes(event.skillName))
        .map((event) => [event.skillName, Math.round(event.at * 1000)]),
      [
        ['Preparation Thrust', 320],
        ['Brutal Blade', 840]
      ]
    );
  });

  test('retains sword and hammer impact timing', () => {
    for (const [name, impactMs] of [
      ['Mist Slash', 400],
      ['Arcing Mists', 440]
    ]) {
      const strike = skill(name).effects.find((effect) => effect.type === 'strike');

      assert.equal(strike.ticks?.[0]?.atMs ?? strike.atMs, impactMs, `${name} impact`);
    }

    for (const [name, impactMs] of [
      ['Coalescence of Ruin', 560],
      ['Field of the Mists', 560],
      ['Drop the Hammer', 1640]
    ]) {
      const strike = skill(name).effects.find((effect) => effect.type === 'strike');

      assert.equal(strike.ticks?.[0]?.atMs ?? strike.atMs, impactMs, `${name} impact`);
    }
  });

  test('resolves Phantom Onslaught timing and cooldown from dash completion', () => {
    const onslaught = simulate('Vindicator', ["Phantom's Onslaught"], {
      ...config,
      specialization: 'Vindicator',
      selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ALLIANCE,
      primaryWeapon: 'Greatsword',
      secondaryWeapon: ''
    });

    assert.equal(onslaught.steps[0].fullCastMs, 440);
    assert.equal(
      Math.round(
        onslaught.events.find((event) => event.type === 'damage' && event.skillName === "Phantom's Onslaught").at * 1000
      ),
      440
    );
    assert.deepEqual(onslaught.endState.cooldowns["Phantom's Onslaught"], {
      readyAt: 6440,
      remaining: 6000
    });
  });

  test('Phantom Onslaught can repeat after its dash cooldown without delaying the rotation', () => {
    // The follow-up strike occupies the cast lane but must not postpone the next dash's recharge.
    const result = simulate('Renegade', ["Phantom's Onslaught", "Phantom's Onslaught"], {
      ...config,
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      primaryWeapon: 'Greatsword',
      secondaryWeapon: ''
    });

    assert.deepEqual(result.warnings, []);
    assert.equal(result.steps[1].start, 6440);
  });

  test('resolves Rift Slash follow-up timing and upkeep triggers', () => {
    const rift = damageTimeline(
      simulate('Conduit', ['Preparation Thrust', 'Brutal Blade', 'Rift Slash'], config, observationTail(1000)),
      'Rift Slash'
    );

    assert.deepEqual(
      rift.map((event) => event.slice(1)),
      [
        ['Rift Slash', 0.9],
        ['Rift Slash — Rift', 0.2175]
      ]
    );
    assert.equal(rift[1][0] - rift[0][0], 1000);
    assert.deepEqual(
      rift.map((event) => event[0]),
      [1320, 2320]
    );

    const impossibleRift = simulate(
      'Conduit',
      ['Impossible Odds', 'Preparation Thrust', 'Brutal Blade', 'Rift Slash', { type: 'wait', durationMs: 1500 }],
      {
        selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
        startingLegend: LEGEND.ASSASSIN,
        initialEnergy: 100,
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Sword',
        boons: { quickness: true }
      }
    );

    assert.equal(
      impossibleRift.resolvedEvents.filter(
        (event) =>
          event.type === 'damage' && event.skillName === 'Impossible Odds' && event.triggeredBy === 'Rift Slash'
      ).length,
      2
    );
  });

  test('resolves every Eternity Requiem impact', () => {
    const requiem = simulate(
      'Conduit',
      ["Eternity's Requiem"],
      {
        ...config,
        primaryWeapon: 'Greatsword',
        secondaryWeapon: ''
      },
      observationTail(2000)
    );

    assert.deepEqual(damageTimeline(requiem, "Eternity's Requiem"), [
      [1160, "Eternity's Requiem", 1],
      [1240, "Eternity's Requiem", 0.9],
      [1360, "Eternity's Requiem", 0.8],
      [1440, "Eternity's Requiem", 0.7],
      [1480, "Eternity's Requiem", 0.6],
      [1560, "Eternity's Requiem", 0.5],
      [1680, "Eternity's Requiem", 0.4],
      [1760, "Eternity's Requiem", 0.3]
    ]);
  });
});

test('large Revenant hitboxes add the second Coalescence cascade and all Requiem impacts', () => {
  const hammerConfig = {
    selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
    startingLegend: LEGEND.RENEGADE,
    initialEnergy: 100,
    primaryWeapon: 'Hammer',
    secondaryWeapon: ''
  };
  const greatswordConfig = {
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100,
    primaryWeapon: 'Greatsword',
    secondaryWeapon: ''
  };
  const hitCounts = (specialization, skill, config, tailMs) =>
    Object.fromEntries(
      ['small', 'large'].map((hitboxSize) => {
        const result = simulate(
          specialization,
          [skill],
          { ...config, professionAssumptions: { hitboxSize } },
          observationTail(tailMs)
        );

        return [
          hitboxSize,
          result.events.filter((event) => event.type === 'damage' && event.skillName === skill).length
        ];
      })
    );

  assert.deepEqual(hitCounts('Renegade', 'Coalescence of Ruin', hammerConfig, 2000), {
    small: 1,
    large: 2
  });
  assert.deepEqual(hitCounts('Vindicator', "Eternity's Requiem", greatswordConfig, 2500), {
    small: 8,
    large: 14
  });

  const largeHammer = simulate(
    'Renegade',
    ['Coalescence of Ruin'],
    { ...hammerConfig, professionAssumptions: { hitboxSize: 'large' } },
    observationTail(2000)
  );

  assert.deepEqual(
    largeHammer.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Coalescence of Ruin')
      .map((event) => Math.round(event.at * 1000)),
    [560, 1520]
  );

  const largeRequiem = simulate(
    'Vindicator',
    ["Eternity's Requiem"],
    { ...greatswordConfig, professionAssumptions: { hitboxSize: 'large' } },
    observationTail(2500)
  );

  assert.deepEqual(
    largeRequiem.events
      .filter((event) => event.type === 'damage' && event.skillName === "Eternity's Requiem")
      .map((event) => event.coefficient),
    [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, ...Array(7).fill(0.3)]
  );
});

test('Drop the Hammer resets Coalescence of Ruin when its delayed hit lands', () => {
  const result = simulate(
    'Renegade',
    ['Drop the Hammer', 'Coalescence of Ruin', { name: '__wait', waitMs: 400 }, 'Coalescence of Ruin'],
    {
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      initialEnergy: 100,
      primaryWeapon: 'Hammer',
      secondaryWeapon: '',
      professionAssumptions: { hitboxSize: 'small' }
    }
  );

  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.filter((step) => step.skill === 'Coalescence of Ruin').map((step) => step.start),
    [500, 1650]
  );
  assert.equal(
    result.events.filter((event) => event.type === 'damage' && event.skillName === 'Coalescence of Ruin').length,
    2
  );
});

test('Conduit affinity scales Release Potential and Cosmic Wisdom state', () => {
  const result = simulate('Conduit', ['Phase Traversal', 'Release Potential: Assassin', 'Cosmic Wisdom'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.endState.profession.affinity, 2);
  assert.equal(result.endState.profession.conduitForm, 'Assassin');
  assert.ok(result.endState.profession.cosmicWisdomUntil > 0);

  for (const [legend, generator, release, expectedAffinity] of [
    [LEGEND.ASSASSIN, 'Phase Traversal', 'Release Potential: Assassin', 2],
    [LEGEND.DEMON, 'Pain Absorption', 'Release Potential: Mesmer', 2],
    [LEGEND.ENTITY, "Gladiator's Defense", 'Release Potential: Dervish', 1],
    [LEGEND.CENTAUR, 'Natural Harmony', 'Release Potential: Monk', 1],
    [LEGEND.DWARF, 'Inspiring Reinforcement', 'Release Potential: Warrior', 2]
  ]) {
    const variant = simulate('Conduit', [generator, release], {
      selectedLegends: [legend, LEGEND.ENTITY],
      startingLegend: legend,
      initialEnergy: 100
    });

    assert.equal(variant.warnings.length, 0, release);
    assert.equal(variant.endState.profession.affinity, expectedAffinity, release);
  }
});

test('Form of the Mesmer modifies Demon skill costs and Banish cooldown', () => {
  const blocked = simulate('Conduit', ['Cosmic Wisdom', 'Banish Enchantment'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 4
  });

  assert.match(blocked.warnings[0], /requires 5 energy/);

  const result = simulate('Conduit', ['Cosmic Wisdom', 'Banish Enchantment', 'Banish Enchantment'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 5
  });

  assert.equal(result.warnings.length, 0);
  assert.deepEqual(
    result.steps.filter((step) => step.skill === 'Banish Enchantment').map((step) => step.start),
    [0, 5440]
  );
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'action' && event.skillName === 'Banish Enchantment')
      .map((event) => Number((event.rechargeReadyAt - event.fullEndsAt).toFixed(6))),
    [5, 5]
  );

  const expiringDuringCast = simulate(
    'Conduit',
    [
      'Cosmic Wisdom',
      'Banish Enchantment',
      { type: 'wait', durationMs: 6300 },
      'Banish Enchantment',
      'Banish Enchantment'
    ],
    {
      selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
      startingLegend: LEGEND.DEMON,
      initialEnergy: 100,
      boons: { quickness: true }
    }
  );

  assert.equal(expiringDuringCast.warnings.length, 0);
  assert.deepEqual(
    expiringDuringCast.steps.filter((step) => step.skill === 'Banish Enchantment').map((step) => step.start),
    [0, 6740, 12180]
  );
  assert.deepEqual(
    expiringDuringCast.events
      .filter((event) => event.type === 'action' && event.skillName === 'Banish Enchantment')
      .map((event) => event.rechargeReadyAt),
    [5.44, 12.18, null]
  );

  const blockedAnguish = simulate('Conduit', ['Cosmic Wisdom', 'Call to Anguish'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 9
  });

  assert.match(blockedAnguish.warnings[0], /requires 10 energy/);

  const anguish = simulate('Conduit', ['Cosmic Wisdom', 'Call to Anguish', 'Unyielding Impact'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 10
  });

  assert.equal(anguish.warnings.length, 0);
  // Recovery during the opening cast makes the reduced-cost follow-up immediately affordable.
  assert.deepEqual(
    anguish.steps
      .filter((step) => ['Call to Anguish', 'Unyielding Impact'].includes(step.skill))
      .map((step) => step.start),
    [0, 820]
  );
  assert.deepEqual(
    anguish.events
      .filter((event) => event.type === 'revenant.state' && event.reason === 'energy-spent')
      .map((event) => Number(event.state.energy.toFixed(9))),
    [0, 3.1]
  );

  const normalEmbrace = simulate('Core', ['Embrace the Darkness'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ASSASSIN],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 0
  });

  assert.match(normalEmbrace.warnings[0], /requires 5 energy/);

  const cosmicEmbrace = simulate('Conduit', ['Cosmic Wisdom', 'Embrace the Darkness'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 0
  });

  assert.match(cosmicEmbrace.warnings[0], /requires 1 energy/);

  const affordableEmbrace = simulate('Conduit', ['Cosmic Wisdom', 'Embrace the Darkness'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 1
  });

  assert.equal(affordableEmbrace.warnings.length, 0);
  assert.equal(affordableEmbrace.endState.profession.activeUpkeeps[0].startsAt, 0.44);
});

test('Form of the Assassin fires daggers on skills and Impossible Odds pulses', () => {
  const result = simulate('Conduit', ['Cosmic Wisdom', 'Impossible Odds', { type: 'wait', durationMs: 3100 }], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100
  });

  assert.equal(result.warnings.length, 0);
  const daggers = result.events.filter(
    (event) => event.type === 'damage' && event.skillName === 'Lesser Enchanted Daggers'
  );

  assert.deepEqual(
    daggers.map((event) => event.at),
    [0, 1, 2, 3]
  );
  assert.ok(daggers.every((event) => event.coefficient === 0.06));
  assert.ok(daggers.every((event) => event.triggeredBy === 'Impossible Odds'));
});

test('Form of the Dervish follows every Entity skill and doubles Twin Moon', () => {
  const result = simulate('Conduit', ['Cosmic Wisdom', 'Shielding Hands', 'Hex-Eater Vortex', 'Twin Moon Sweep'], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100
  });

  assert.equal(result.warnings.length, 0);
  const scythes = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Form of the Dervish');

  assert.deepEqual(
    scythes.map((event) => event.triggeredBy),
    ['Shielding Hands', 'Hex-Eater Vortex', 'Twin Moon Sweep', 'Twin Moon Sweep']
  );
  assert.ok(scythes.every((event) => event.coefficient === 0.8));
});

test('Dervish casts retain their scythes through form expiry and concurrent legend swaps', () => {
  // Eligibility belongs to cast start, so a finishing animation cannot lose an already-triggered scythe.
  for (const swap of [[], [{ type: 'cast', skillId: SKILL.SWAP_LEGENDS, concurrentOffsetMs: 640 }]]) {
    const result = simulate(
      'Conduit',
      ['Cosmic Wisdom', { type: 'wait', durationMs: 6500 }, 'Twin Moon Sweep', ...swap],
      {
        selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
        startingLegend: LEGEND.ENTITY,
        initialEnergy: 100,
        boons: { quickness: true }
      },
      observationTail(500)
    );
    const scythes = result.events.filter(
      (event) => event.type === 'damage' && event.skillName === 'Form of the Dervish'
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(scythes.length, 2);
    assert.ok(scythes.every((event) => Math.round(event.at * 1000) === 7420));
  }

  const expired = simulate('Conduit', ['Cosmic Wisdom', { type: 'wait', durationMs: 7000 }, 'Twin Moon Sweep'], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100
  });
  assert.equal(
    expired.events.some((event) => event.skillName === 'Form of the Dervish'),
    false
  );
});

test('Impossible Odds cannot chain from Lesser Enchanted Daggers procs', () => {
  // Triggered dagger damage must not recursively trigger Impossible Odds.
  const procs = simulate('Conduit', ['Cosmic Wisdom', 'Impossible Odds', { type: 'wait', durationMs: 2100 }], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100
  });
  assert.ok(procs.events.some((event) => event.skillName === 'Lesser Enchanted Daggers'));
  assert.equal(
    procs.events.some((event) => event.type === 'damage' && event.skillName === 'Impossible Odds'),
    false
  );
});

test('Release Potential strength is independent of the equipped weapon set', () => {
  // The conjured scythe and Assassin shockwaves retain their own strength profiles when weapon sets change.
  for (const [legend, name, strength] of [
    [LEGEND.ENTITY, 'Release Potential: Dervish', 1000],
    [LEGEND.ASSASSIN, 'Release Potential: Assassin', 1100]
  ]) {
    for (const primaryWeapon of ['Sword', 'Greatsword']) {
      const result = simulate(
        'Conduit',
        [name],
        {
          selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
          startingLegend: legend,
          primaryWeapon,
          initialEnergy: 100,
          boons: { quickness: true }
        },
        observationTail(500)
      );
      const strikes = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === name);
      assert.ok(strikes.length > 0);
      assert.ok(strikes.every((event) => event.resolvedWeaponStrength === strength));
    }
  }
});

test('Conduit entity skills apply follow-ups and Shared Wisdom effects', () => {
  const beguiling = simulate('Conduit', ['Beguiling Haze', 'Beguiling Haze', 'Beguiling Haze'], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100,
    selectedTraitIds: [TRAIT.SHARED_WISDOM]
  });

  assert.equal(beguiling.warnings.length, 0);
  assert.deepEqual(
    beguiling.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Beguiling Haze')
      .map((event) => [Math.round(event.at * 1000), event.coefficient]),
    [
      [520, 2.2],
      [850, 0.6],
      [1100, 0.6]
    ]
  );
  assert.deepEqual(
    beguiling.steps.map((step) => step.fullCastMs),
    [650, 250, 250]
  );
  assert.equal(beguiling.endState.profession.beguilingHazeCharges, 0);
  const beguilingAmmo = beguiling.schedulerState.ammo.get(revenantCatalog.skillsByName.get('Beguiling Haze').id);

  assert.equal(beguilingAmmo.maximum, 1);
  assert.equal(beguilingAmmo.charges, 0);
  assert.equal(beguilingAmmo.nextRechargeAt, beguiling.endState.profession.beguilingHazeReadyAt);
  // Above the precombat cap, regeneration resumes only when the first hit starts combat.
  const combatDuration = beguiling.steps.at(-1).end / 1000 - beguiling.endState.profession.combatBeganAt;
  assert.ok(Math.abs(beguiling.endState.profession.energy - (80 + 5 * combatDuration)) < 1e-9);

  const recharged = simulate(
    'Conduit',
    ['Beguiling Haze', 'Beguiling Haze', 'Beguiling Haze', { type: 'wait', durationMs: 20000 }],
    {
      selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ENTITY,
      initialEnergy: 100
    }
  );
  const rechargedAmmo = recharged.schedulerState.ammo.get(revenantCatalog.skillsByName.get('Beguiling Haze').id);

  assert.equal(recharged.endState.profession.beguilingHazeCharges, 0);
  assert.equal(rechargedAmmo.maximum, 1);
  assert.equal(rechargedAmmo.charges, 1);
  assert.equal(rechargedAmmo.nextRechargeAt, null);
  assert.equal(beguiling.events.filter((event) => event.type === 'buff' && event.kind === 'fury').length, 3);
  assert.equal(beguiling.events.filter((event) => event.type === 'buff' && event.kind === 'swiftness').length, 3);

  const defense = simulate('Conduit', ["Gladiator's Defense"], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.DEMON],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100,
    selectedTraitIds: [TRAIT.SHARED_WISDOM]
  });

  assert.equal(defense.steps[0].fullCastMs, 320);
  assert.deepEqual(
    defense.events
      .filter((event) => event.type === 'buff')
      .map((event) => event.kind)
      .sort(),
    ['resistance', 'resolution', 'stability', 'swiftness']
  );

  const vortex = simulate(
    'Conduit',
    ['Hex-Eater Vortex'],
    {
      selectedLegends: [LEGEND.ENTITY, LEGEND.DEMON],
      startingLegend: LEGEND.ENTITY,
      initialEnergy: 100,
      selectedTraitIds: [TRAIT.SHARED_WISDOM]
    },
    observationTail(1000)
  );

  assert.equal(
    vortex.events.filter(
      (event) => event.type === 'condition' && event.skillName === 'Hex-Eater Vortex' && event.condition === 'Torment'
    ).length,
    6
  );
  assert.deepEqual(
    vortex.events
      .filter((event) => event.type === 'damage' && event.skillName === 'Hex-Eater Vortex')
      .map((event) => [Math.round(event.at * 1000), event.coefficient]),
    [440, 560, 680, 800, 920, 1040].map((at) => [at, 0.2])
  );
  assert.ok(
    vortex.events.some(
      (event) =>
        event.type === 'buff' && event.kind === 'resolution' && Math.abs(event.duration - 3 * (1 + 75 / 1500)) < 1e-9
    )
  );
});

test('Twin Moon Sweep resolves both attackers and legend resonance', () => {
  const assassin = simulate('Conduit', ['Twin Moon Sweep'], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100
  });
  const strikes = assassin.events.filter((event) => event.type === 'damage' && event.skillName === 'Twin Moon Sweep');

  assert.deepEqual(
    strikes.map((event) => event.coefficient),
    [2.5, 2.5]
  );
  assert.deepEqual(
    strikes.map((event) => event.actorType),
    ['player', 'player']
  );
  assert.deepEqual(
    strikes.map((event) => event.at),
    [0.88, 0.88]
  );
  assert.equal(
    assassin.events.filter((event) => event.condition === 'Bleeding').reduce((sum, event) => sum + event.stacks, 0),
    4
  );
  assert.ok(assassin.events.some((event) => event.condition === 'Immobilized' && event.duration === 2));
  assert.equal(assassin.endState.profession.affinity, 2);

  const demon = simulate(
    'Conduit',
    ['Twin Moon Sweep'],
    {
      selectedLegends: [LEGEND.ENTITY, LEGEND.DEMON],
      startingLegend: LEGEND.ENTITY,
      initialEnergy: 100
    },
    observationTail(1000)
  );

  assert.deepEqual(
    demon.events
      .filter((event) => event.type === 'damage' && /Shatter/.test(event.name))
      .map((event) => [event.at, event.coefficient]),
    [
      [1.4, 0.2],
      [1.4, 0.2]
    ]
  );
  assert.equal(
    demon.events.filter((event) => event.condition === 'Confusion').reduce((sum, event) => sum + event.stacks, 0),
    6
  );

  const swappedBeforeImpact = simulate('Conduit', ['Twin Moon Sweep', { name: 'Swap Legends', offset: 100 }], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100,
    boons: { quickness: true }
  });
  const affinityAtImpact = swappedBeforeImpact.events.find(
    (event) => event.type === 'revenant.state' && event.reason === 'enigmatic-connection-hit'
  );

  assert.equal(swappedBeforeImpact.steps[1].start, 100);
  assert.equal(affinityAtImpact.at, 0.88);
  assert.equal(affinityAtImpact.state.activeLegendId, LEGEND.ASSASSIN);
  assert.equal(affinityAtImpact.state.affinity, 2);
  assert.equal(swappedBeforeImpact.endState.profession.affinity, 2);
});

test('Revenant Peitha triggers resolve at the observed projectile impact', () => {
  for (const {
    specialization,
    rotation,
    selectedLegends,
    startingLegend,
    sourceSkill,
    sourceName,
    delay,
    weapons = {}
  } of [
    {
      specialization: 'Conduit',
      rotation: ['Deathstrike', { name: '__wait', waitMs: 1000 }],
      selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
      startingLegend: LEGEND.ASSASSIN,
      sourceSkill: 'Deathstrike',
      sourceName: 'Deathstrike',
      delay: 0.24
    },
    {
      specialization: 'Conduit',
      rotation: ['Beguiling Haze', { name: '__wait', waitMs: 1000 }],
      selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ENTITY,
      sourceSkill: 'Beguiling Haze',
      sourceName: 'Beguiling Haze',
      delay: 0.32
    },
    {
      specialization: 'Vindicator',
      rotation: ["Phantom's Onslaught", { name: '__wait', waitMs: 1000 }],
      selectedLegends: [LEGEND.ALLIANCE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ALLIANCE,
      sourceSkill: "Phantom's Onslaught",
      sourceName: "Phantom's Onslaught",
      delay: 0.68,
      weapons: {
        primaryWeapon: 'Greatsword',
        secondaryWeapon: ''
      }
    },
    {
      specialization: 'Renegade',
      rotation: ['Phase Smash', { name: '__wait', waitMs: 1000 }],
      selectedLegends: [LEGEND.RENEGADE, LEGEND.ASSASSIN],
      startingLegend: LEGEND.RENEGADE,
      sourceSkill: 'Phase Smash',
      sourceName: 'Phase Smash',
      delay: 0,
      weapons: {
        primaryWeapon: 'Hammer',
        secondaryWeapon: ''
      }
    }
  ]) {
    const result = simulate(specialization, rotation, {
      selectedLegends,
      startingLegend,
      relic: 'Peitha',
      initialEnergy: 100,
      ...weapons
    });
    const source = result.events.find(
      (event) => event.type === 'damage' && event.skillName === sourceSkill && event.name === sourceName
    );
    const peitha = result.events.find((event) => event.type === 'peitha' && event.skillName === sourceSkill);
    const torment = result.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillName === 'Relic of Peitha'
    );

    assert.ok(source, `${sourceSkill} source`);
    assert.ok(peitha, `${sourceSkill} Peitha event`);
    assert.ok(torment, `${sourceSkill} Peitha torment`);
    assert.ok(Math.abs(peitha.at - source.at - delay) < 1e-9, `${sourceSkill} impact delay`);
    assert.equal(torment.at, peitha.at, `${sourceSkill} torment timing`);
  }
});

test('Conduit form attacks carry usable icons into skill breakdowns', () => {
  const dervish = simulate('Conduit', ['Cosmic Wisdom', "Gladiator's Defense"], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100
  });
  const expectedIcon = revenantCatalog.skillsById.get(SKILL.FORM_OF_THE_DERVISH_ATTACK).icon;
  const attack = dervish.events.find((event) => event.type === 'damage' && event.skillName === 'Form of the Dervish');
  const row = skillBreakdownRows(dervish).find((entry) => entry.name === 'Form of the Dervish');

  assert.match(expectedIcon, /^https:\/\/render\.guildwars2\.com\//);
  assert.equal(expectedIcon, 'https://render.guildwars2.com/file/0CB866CA45E05F72B3B9CEDED5CAA1563FBD6B4A/3680046.png');
  assert.equal(revenantCatalog.skillsById.get(SKILL.FORM_OF_THE_DERVISH_ATTACK_ELITE).icon, expectedIcon);
  assert.equal(attack.icon, expectedIcon);
  assert.equal(row.icon, expectedIcon);

  const assassin = simulate('Conduit', ['Cosmic Wisdom', 'Impossible Odds', { type: 'wait', durationMs: 1100 }], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100
  });
  const expectedDaggersIcon = revenantCatalog.skillsById.get(SKILL.LESSER_ENCHANTED_DAGGERS).icon;
  const daggers = assassin.events.find(
    (event) => event.type === 'damage' && event.skillName === 'Lesser Enchanted Daggers'
  );
  const daggersRow = skillBreakdownRows(assassin).find((entry) => entry.name === 'Lesser Enchanted Daggers');

  assert.match(expectedDaggersIcon, /^https:\/\/render\.guildwars2\.com\//);
  assert.equal(daggers.icon, expectedDaggersIcon);
  assert.equal(daggersRow.icon, expectedDaggersIcon);
});

test('Release Potential variants use affinity and equipped-legend effects', () => {
  for (const [legend, name, expected] of [
    [LEGEND.DEMON, 'Release Potential: Mesmer', [280]],
    [LEGEND.ENTITY, 'Release Potential: Dervish', [560]],
    [LEGEND.ASSASSIN, 'Release Potential: Assassin', [160, 480, 800]]
  ]) {
    const timing = simulate(
      'Conduit',
      [name],
      {
        selectedLegends: legend === LEGEND.ENTITY ? [LEGEND.ENTITY, LEGEND.ASSASSIN] : [legend, LEGEND.ENTITY],
        startingLegend: legend,
        initialEnergy: 100,
        boons: { quickness: true }
      },
      observationTail(1000)
    );

    assert.deepEqual(
      timing.events
        .filter((event) => event.type === 'damage' && event.skillName === name)
        .map((event) => Math.round(event.at * 1000)),
      expected,
      name
    );
  }

  const mesmer = simulate('Conduit', ['Pain Absorption', 'Banish Enchantment', 'Release Potential: Mesmer'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 100
  });
  const enemyTorment = mesmer.events.find(
    (event) =>
      event.type === 'condition' && event.skillName === 'Release Potential: Mesmer' && event.condition === 'Torment'
  );

  assert.ok(Math.abs(enemyTorment.duration - 3.9) < 1e-9);
  assert.equal(mesmer.endState.profession.selfConditions.length, 1);
  assert.ok(
    Math.abs(
      mesmer.endState.profession.selfConditions[0].expiresAt - mesmer.endState.profession.selfConditions[0].at - 4.4
    ) < 1e-9
  );
  assert.ok(
    mesmer.events.some((event) => event.type === 'control' && event.controlKind === 'daze' && event.duration === 2)
  );

  const dervishDemon = simulate('Conduit', ["Gladiator's Defense", 'Release Potential: Dervish'], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.DEMON],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100
  });

  assert.ok(
    dervishDemon.events.some(
      (event) =>
        event.skillName === 'Release Potential: Dervish' &&
        event.condition === 'Bleeding' &&
        event.stacks === 3 &&
        event.duration === 6
    )
  );

  const dervishAllEffects = simulate(
    'Conduit',
    ['Twin Moon Sweep', "Gladiator's Defense", 'Release Potential: Dervish'],
    {
      selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
      startingLegend: LEGEND.ENTITY,
      initialEnergy: 100
    }
  );

  assert.equal(dervishAllEffects.endState.profession.affinity, 3);
  assert.ok(
    dervishAllEffects.events.some(
      (event) =>
        event.skillName === 'Release Potential: Dervish' &&
        event.condition === 'Bleeding' &&
        event.stacks === 3 &&
        event.duration === 6
    )
  );
  assert.ok(
    dervishAllEffects.events.some(
      (event) =>
        event.skillName === 'Release Potential: Dervish' &&
        event.kind === 'might' &&
        event.stacks === 10 &&
        Math.abs(event.duration - 8 * (1 + 75 / 1500)) < 1e-9
    )
  );

  const dervishCentaur = simulate('Conduit', ["Gladiator's Defense", 'Release Potential: Dervish'], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.CENTAUR],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100
  });

  assert.ok(
    dervishCentaur.events.some(
      (event) =>
        event.skillName === 'Release Potential: Dervish' &&
        event.kind === 'might' &&
        event.stacks === 10 &&
        Math.abs(event.duration - 8 * (1 + 225 / 1500)) < 1e-9
    )
  );
  assert.ok(
    dervishCentaur.events.some(
      (event) =>
        event.skillName === 'Release Potential: Dervish' &&
        event.kind === 'fury' &&
        Math.abs(event.duration - 8 * (1 + 225 / 1500)) < 1e-9
    )
  );
});

test('Conduit affinity traits distinguish legend and weapon energy costs', () => {
  const enigmatic = simulate('Conduit', ['Pain Absorption', 'Banish Enchantment'], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
    startingLegend: LEGEND.DEMON,
    initialEnergy: 100
  });

  assert.equal(enigmatic.endState.profession.affinity, 3);

  const withoutConductive = simulate('Conduit', ['Chilling Isolation'], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100
  });
  const withConductive = simulate('Conduit', ['Chilling Isolation'], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.ASSASSIN],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100,
    selectedTraitIds: [TRAIT.CONDUCTIVE_ARMAMENTS]
  });

  assert.equal(withoutConductive.endState.profession.affinity, 0);
  assert.equal(withConductive.endState.profession.affinity, 1);

  const reset = simulate('Conduit', ['Phase Traversal', 'Swap Legends'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100
  });

  assert.equal(reset.endState.profession.affinity, 0);

  const lingering = simulate('Conduit', ['__combat_start', 'Phase Traversal', 'Swap Legends'], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100,
    selectedTraitIds: [TRAIT.LINGERING_DETERMINATION]
  });

  assert.equal(lingering.endState.profession.affinity, 2);

  const upkeep = simulate('Conduit', ['Impossible Odds', { type: 'wait', durationMs: 3100 }], {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100
  });

  assert.equal(upkeep.endState.profession.affinity, 2);

  const expandedRotation = ['Phase Traversal', 'Jade Winds', 'Impossible Odds'];
  const ordinary = simulate('Conduit', expandedRotation, {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100
  });
  const expanded = simulate('Conduit', expandedRotation, {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.ENTITY],
    startingLegend: LEGEND.ASSASSIN,
    initialEnergy: 100,
    selectedTraitIds: [TRAIT.EXPANDED_CONSCIOUSNESS]
  });

  assert.equal(expanded.endState.profession.affinity, 5);
  assert.ok(Math.abs(expanded.endState.profession.energy - ordinary.endState.profession.energy - 15) < 1e-9);
});

test('Conduit grandmasters alter release, invocation, and Cosmic Wisdom', () => {
  const kinetic = simulate('Conduit', ['Release Potential: Warrior'], {
    selectedLegends: [LEGEND.DWARF, LEGEND.ENTITY],
    startingLegend: LEGEND.DWARF,
    selectedTraitIds: [TRAIT.KINETIC_INSIGHT]
  });

  assert.equal(
    kinetic.schedulerState.cooldowns.get(revenantCatalog.skillsByName.get('Release Potential: Warrior').id),
    8.75
  );

  const cosmic = simulate('Conduit', ['__combat_start', 'Cosmic Wisdom', 'Swap Legends', 'Release Potential: Mesmer'], {
    selectedLegends: [LEGEND.ENTITY, LEGEND.DEMON],
    startingLegend: LEGEND.ENTITY,
    initialEnergy: 100,
    selectedTraitIds: [TRAIT.ENHANCED_EMBODIMENT, TRAIT.FOUND_PURPOSE, TRAIT.LINGERING_DETERMINATION, TRAIT.MISTFIRE]
  });

  assert.equal(cosmic.endState.profession.legendSwapReadyAt, 6);
  assert.equal(cosmic.endState.profession.cosmicWisdomUntil, 8);
  assert.ok(
    cosmic.events.some(
      (event) => event.type === 'damage' && event.skillName === 'Mistfire' && event.coefficient === 0.6
    )
  );
  assert.ok(
    cosmic.events.some(
      (event) =>
        event.type === 'condition' &&
        event.skillName === 'Mistfire' &&
        event.condition === 'Burning' &&
        event.duration === 6
    )
  );
  assert.equal(
    cosmic.events.filter(
      (event) => event.type === 'buff' && event.skillName === 'Swap Legends' && event.audience?.recipients === 'party'
    ).length,
    3
  );

  const disable = simulate('Conduit', ['Abyssal Blot', { name: 'Call to Anguish', offset: 100 }], {
    selectedLegends: [LEGEND.DEMON, LEGEND.ENTITY],
    startingLegend: LEGEND.DEMON,
    primaryWeapon: 'Spear',
    secondaryWeapon: '',
    initialEnergy: 100,
    selectedTraitIds: [TRAIT.MISTFIRE]
  });
  const disableProcs = disable.events.filter((event) => event.skillName === 'Mistfire');

  assert.equal(
    disableProcs.filter((event) => event.type === 'condition' && event.condition === 'Burning' && event.stacks === 1)
      .length,
    1
  );
  assert.equal(disableProcs.filter((event) => event.type === 'damage').length, 0);
});

test('Bolstered Bonds and Kinetic Insight modify runtime attributes and damage', () => {
  const context = {
    config: {
      specialization: 'Conduit',
      selectedTraitIds: [TRAIT.KINETIC_INSIGHT]
    },
    time: 1,
    event: { skillName: 'Release Potential: Warrior', actorType: 'player' },
    runtime: {
      profession: {
        affinity: 3,
        cosmicWisdomUntil: 7,
        selectedLegendIds: [LEGEND.ASSASSIN, LEGEND.ENTITY]
      }
    }
  };
  const attributes = revenantAttributeRules.modifyAttributes(context, {
    power: 1000,
    precision: 1000,
    toughness: 1000,
    vitality: 1000,
    ferocity: 0,
    conditionDamage: 0,
    expertise: 0,
    concentration: 0,
    healingPower: 0
  });

  assert.equal(attributes.power, 1300);
  assert.equal(attributes.ferocity, 300);
  assert.equal(attributes.precision, 1150);
  assert.equal(attributes.conditionDamage, 150);
  assert.equal(revenantAttributeRules.modifyStrikeDamage(context, 1), 1.75);

  const numinousContext = {
    ...context,
    config: {
      specialization: 'Conduit',
      attributeProvenance: {
        professionStaticRulesApplied: true
      },
      selectedTraitIds: [
        TRAIT.DETERMINED_RESOLUTION,
        TRAIT.SERENE_REJUVENATION,
        TRAIT.CONTAINED_TEMPER,
        TRAIT.YEARNING_EMPOWERMENT,
        TRAIT.NUMINOUS_GIFT
      ]
    }
  };
  const numinousAttributes = revenantAttributeRules.modifyAttributes(numinousContext, {
    conditionDurationBonuses: {
      Poisoned: 10,
      Torment: 10
    }
  });

  assert.deepEqual(numinousAttributes.conditionDurationBonuses, {
    Poisoned: 10,
    Torment: 10
  });
  assert.equal(
    revenantAttributeRules.modifyConditionDuration(
      {
        ...numinousContext,
        condition: 'Poisoned'
      },
      0.6
    ),
    0.6
  );
  assert.equal(numinousAttributes.strikeDamageReduction, 0.05);
  assert.equal(numinousAttributes.healingEffectiveness, 0.05);
  assert.equal(numinousAttributes.containedTemperEnergyGainBonus, 5);
});

test("Conduit runtime rejects Vindicator's Alliance legend", () => {
  const result = simulate('Conduit', ['Swap Legends'], {
    selectedLegends: [LEGEND.ALLIANCE, LEGEND.ENTITY],
    startingLegend: LEGEND.ALLIANCE
  });

  assert.deepEqual(result.endState.profession.selectedLegendIds, [LEGEND.ENTITY, LEGEND.ASSASSIN]);
  assert.equal(result.endState.profession.activeLegendId, LEGEND.ASSASSIN);
});

test('Alacrity changes cooldowns but never passive energy regeneration', () => {
  const rotation = ['__combat_start', { type: 'wait', durationMs: 5000 }];
  const without = simulate('Core', rotation, {
    initialEnergy: 0,
    boons: { alacrity: false }
  });
  const withAlacrity = simulate('Core', rotation, {
    initialEnergy: 0,
    boons: { alacrity: true }
  });

  assert.equal(without.endState.profession.energy, 25);
  assert.equal(withAlacrity.endState.profession.energy, 25);
});

test('Alacrity does not reduce Revenant legend or weapon swap cooldowns', () => {
  const config = {
    selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
    startingLegend: LEGEND.ASSASSIN,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword',
    weaponSet2Primary: 'Mace',
    weaponSet2Secondary: 'Axe',
    boons: { alacrity: true }
  };
  const legends = simulate('Core', ['__combat_start', 'Swap Legends', 'Swap Legends'], config);

  assert.deepEqual(
    legends.steps.filter((step) => step.skill === 'Swap Legends').map((step) => step.start),
    [0, 10000]
  );

  const weapons = simulate('Core', ['__combat_start', 'Swap Weapons', 'Swap Weapons'], config);

  assert.deepEqual(
    weapons.steps.filter((step) => step.skill === 'Swap Weapons').map((step) => step.start),
    [0, 10000]
  );
});

test('Revenant state events use the shared event-log row contract', () => {
  const rows = simulationEventLogRows(
    {
      events: [
        {
          type: 'revenant.state',
          at: 1.02,
          reason: 'kallas-fervor',
          state: { energy: 30.9 }
        }
      ],
      resolvedEvents: [],
      endState: { profession: {} }
    },
    null,
    revenantProfession
  );

  assert.deepEqual(rows, [
    {
      at: 1.02,
      type: 'revenant.state',
      description: 'kallas-fervor - Energy 30',
      className: 'resource',
      phantasmClone: false
    }
  ]);
});

test('Revenant is a loadable native fixed-bar application', async () => {
  assert.equal((await loadProfession('revenant')).id, 'revenant');
  const adapter = await loadProfessionAppAdapter('revenant');

  assert.equal(adapter.profession.id, 'revenant');
  assert.equal(adapter.slotLoadout.id, 'revenant-legends');
  const html = await readFile(new URL('../../../revenant.html', import.meta.url), 'utf8');

  assert.match(html, /data-profession="revenant"/);
});
