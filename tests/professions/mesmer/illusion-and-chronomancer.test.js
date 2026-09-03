import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { createDefaultConfig, simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { prepareSimulationConfig } from '#gw2/platform/engine/config.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { formatConcurrentTimelineBadge, formatInterruptTimelineBadge } from '#gw2/app/rotation/timeline/model.js';
import { activeResourceGroup } from '#gw2/app/rotation/palette/resource-view.js';
import { shatterResourceSpends } from '#gw2/app/rotation/timeline/model.js';
import { RELIC_DATA } from '#gw2/platform/equipment/relics/catalog.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import { mesmerProfession } from '#gw2/professions/mesmer/definition.js';
import { CHRONOMANCER_BALANCE_PROFILE_IDS } from '#gw2/professions/mesmer/specializations/chronomancer/profiles.js';

test('Relic of the Claw uses its relic icon in the proc timeline', () => {
  assert.equal(
    RELIC_DATA.Claw.icon,
    'https://render.guildwars2.com/file/19B5DB56E495C70754A8BE3621CADC0FD7402845/3375220.png'
  );
});

test('concurrent timeline badges show both delay and cast timestamp', () => {
  assert.equal(formatConcurrentTimelineBadge(100, '2.23s'), '⊙100ms\n2.23s');
});

test('interrupt timeline badges show both interrupt delay and cast timestamp', () => {
  assert.equal(formatInterruptTimelineBadge(120, '4.56s'), '✂120ms\n4.56s');
});

test('queueing a cooling-down icon waits until it is available', () => {
  const result = simulateMesmer(['Bladecall', 'Bladecall'], defaultSimulationConfig());

  assert.equal(result.steps[0].start, 0);
  assert.equal(result.steps[0].end, 440);
  assert.equal(result.steps[1].start, 4440);
  assert.equal(result.endState.cooldowns.Bladecall.readyAt, 8880);
  assert.equal(result.endState.cooldowns.Bladecall.remaining, 4000);
});

test('Lingering Thoughts recharges one ammo count every six seconds', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    [
      { name: 'Lingering Thoughts', skillId: ID.LINGERING_THOUGHTS },
      { name: 'Lingering Thoughts', skillId: ID.LINGERING_THOUGHTS },
      { name: 'Lingering Thoughts', skillId: ID.LINGERING_THOUGHTS }
    ],
    defaultSimulationConfig({
      specialization: 'Mirage',
      initialResource: 0,
      primaryWeapon: 'Axe',
      boons: {
        ...defaults.boons,
        quickness: false,
        alacrity: false
      }
    })
  );

  assert.deepEqual(
    result.steps.map((step) => step.start),
    [0, 1630, 7380]
  );
  assert.equal(result.endState.ammo['Lingering Thoughts'].rechargeDuration, 6);
});

test('Lingering Thoughts applies its packets and grants its clone 160ms later', () => {
  const result = simulateMesmer(
    [
      { name: 'Lingering Thoughts', skillId: ID.LINGERING_THOUGHTS },
      { name: '__wait', waitMs: 200 }
    ],
    defaultSimulationConfig({
      specialization: 'Mirage',
      selectedTraitIds: [],
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Torch',
      initialResource: 0
    })
  );
  const step = result.steps[0];
  const strikes = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Lingering Thoughts'
  );
  const conditions = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Lingering Thoughts'
  );
  const clone = result.events.find((event) => event.type === 'resource' && event.reason === 'Lingering Thoughts');

  assert.equal(step.end - step.start, 920);
  assert.equal(
    strikes.reduce((sum, event) => sum + event.coefficient, 0),
    1.2
  );
  assert.equal(
    strikes.reduce((sum, event) => sum + event.hits, 0),
    3
  );
  assert.deepEqual(
    conditions.map((event) => [event.condition, event.stacks, event.duration]),
    [
      ['Torment', 3, 4],
      ['Crippled', 3, 1]
    ]
  );
  assert.equal(Math.round((clone.at - step.end / 1000) * 1000), 160);
});

test('Lingering Thoughts creates two Confounding Bolts in an Ethereal field', () => {
  const config = defaultSimulationConfig({
    specialization: 'Mirage',
    selectedTraitIds: [],
    primaryWeapon: 'Staff',
    secondaryWeapon: '',
    weaponSet2Primary: 'Axe',
    weaponSet2Secondary: 'Torch',
    initialResource: 0
  });
  const insideField = simulateMesmer(
    ['Chaos Storm', 'Swap Weapons', { name: 'Lingering Thoughts', skillId: ID.LINGERING_THOUGHTS }],
    config
  );
  const bolts = insideField.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.name.includes('Confounding Bolts')
  );

  assert.equal(bolts.length, 2);
  assert.ok(bolts.every((event) => event.condition === 'Confusion' && event.stacks === 1 && event.duration === 5));

  const withoutField = simulateMesmer(
    [{ name: 'Lingering Thoughts', skillId: ID.LINGERING_THOUGHTS }],
    defaultSimulationConfig({
      specialization: 'Mirage',
      selectedTraitIds: [],
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Torch',
      initialResource: 0
    })
  );

  assert.equal(
    withoutField.resolvedEvents.some((event) => event.type === 'condition' && event.name.includes('Confounding Bolts')),
    false
  );
});

test('Rewinder cooldown applies shatter CDR, source refunds, then Alacrity', () => {
  const secondCastAt = (initialResource) =>
    simulateMesmer(
      ['Rewinder', 'Rewinder'],
      defaultSimulationConfig({
        specialization: 'Chronomancer',
        selectedTraitIds: [TRAIT.MASTER_OF_MISDIRECTION],
        initialResource
      })
    ).steps[1].start;

  // (base cooldown * 0.85 - 3 - 3C) * 2/3, where C is the clone count.
  assert.deepEqual([0, 1, 2, 3].map(secondCastAt), [15000, 13000, 11000, 9000]);

  const fullShatter = simulateMesmer(
    ['Rewinder'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 3
    })
  );

  assert.deepEqual(shatterResourceSpends(fullShatter).get(0), {
    count: 3,
    resource: 'clones',
    sourceSkill: 'Rewinder'
  });
});

test('clone state remains capped at three when input or new summons exceed the cap', () => {
  const initial = simulateMesmer(
    [{ name: '__wait', waitMs: 1 }],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 99
    })
  );

  assert.equal(initial.endState.profession.resource, 3);

  const replaced = simulateMesmer(
    ['Mirror Images', { name: '__wait', waitMs: 1 }],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedSkills: ['Mirror Images'],
      initialResource: 3
    })
  );
  const resourceEvents = replaced.events.filter((event) => event.type === 'resource' && event.resource === 'clones');

  assert.equal(replaced.endState.profession.resource, 3);
  assert.ok(resourceEvents.every((event) => event.value <= 3));
});

test('clone resource pips render without a redundant numeric count', () => {
  const resourceHtml = activeResourceGroup({
    profession: mesmerProfession,
    adapter: { eliteSpecialization: () => 'Chronomancer' },
    build: { initialResource: 0 },
    results: {
      endState: {
        profession: { clones: [{}, {}, {}] }
      }
    }
  });

  assert.match(resourceHtml, /data-resource-id="clones"/);
  assert.equal(resourceHtml.match(/active-resource-pip active/g)?.length, 3);
  assert.doesNotMatch(resourceHtml, /<strong>3\/3<\/strong>/);
});

test('non-Chronomancer alacrity starts the reduced cooldown after the cast', () => {
  const result = simulateMesmer(['Bladecall', 'Bladecall'], defaultSimulationConfig({ specialization: 'Core' }));

  assert.equal(result.steps[1].start, 4440);
});

test('Virtuoso alacrity starts Imaginary Inversion recharge after the cast', () => {
  const result = simulateMesmer(
    ['Imaginary Inversion', 'Imaginary Inversion'],
    defaultSimulationConfig({
      specialization: 'Virtuoso',
      primaryWeapon: 'Spear',
      secondaryWeapon: ''
    })
  );

  assert.equal(result.steps[1].start, 8680);
});

test('Master of Misdirection reduces shatter cooldowns by 15%', () => {
  const result = simulateMesmer(
    [{ name: '__wait', waitMs: 2010 }, 'Continuum Split'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedTraitIds: [TRAIT.MASTER_OF_MISDIRECTION],
      initialResource: 3
    })
  );

  assert.equal(result.steps[1].start, 2010);
  assert.equal(result.endState.cooldowns['Continuum Split'].readyAt, 61510);
});

test('Chronomancer shatter-boon traits count the mesmer and scale per shattered clone', () => {
  const durationFor = (traitId, traitName, kind, initialResource) => {
    const result = simulateMesmer(
      ['Split Second'],
      defaultSimulationConfig({
        specialization: 'Chronomancer',
        selectedTraitIds: [traitId],
        initialResource,
        allies: { count: 4, strikesPerSecond: 1 },
        boons: { quickness: false, alacrity: false }
      })
    );
    const boon = result.events.find(
      (event) => event.type === 'buff' && event.kind === kind && event.sourceSkill === 'Split Second'
    );

    assert.ok(boon);
    assert.equal(boon.stacks, 1);
    assert.equal(boon.audience.recipients, 'party');
    assert.equal(boon.audience.maximumRecipients, 5);
    assert.equal(boon.resolvedAudience.recipientCount, 5);
    assert.ok(result.procSteps.some((step) => step.skill === traitName && step.sourceSkill === 'Split Second'));

    return boon.duration;
  };

  for (const [traitId, traitName, kind] of [
    [TRAIT.SEIZE_THE_MOMENT, 'Seize the Moment', 'quickness'],
    [TRAIT.STRETCHED_TIME, 'Stretched Time', 'alacrity']
  ]) {
    assert.deepEqual(
      [0, 1, 2, 3].map((clones) => durationFor(traitId, traitName, kind, clones)),
      [4, 5, 6, 7]
    );
  }
});

test('Chronomancer shatter boons use boon duration and include Continuum Split', () => {
  const result = simulateMesmer(
    [{ name: '__wait', waitMs: 2010 }, 'Continuum Split'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedTraitIds: [TRAIT.SEIZE_THE_MOMENT],
      initialResource: 1,
      stats: { concentration: 750 },
      boons: { quickness: false, alacrity: false }
    })
  );
  const quickness = result.events.find(
    (event) => event.type === 'buff' && event.kind === 'quickness' && event.sourceSkill === 'Continuum Split'
  );

  assert.ok(quickness);
  assert.equal(quickness.duration, 7.5);
});

test('Chronomancer shatter boons consume patched balance-profile values', () => {
  const profession = {
    resolveRuntime(config) {
      const runtime = mesmerProfession.resolveRuntime(config);

      return {
        ...runtime,
        catalog: applyBalanceProfilePatch(runtime.catalog, {
          balanceProfiles: {
            [CHRONOMANCER_BALANCE_PROFILE_IDS.seizeTheMoment]: {
              fields: { durationPerTier: { from: 1, to: 2 } },
              effects: [
                {
                  effectIndex: 0,
                  duration: { from: 3, to: 4 },
                  audience: { maximumRecipients: { from: 5, to: 10 } }
                }
              ]
            }
          }
        })
      };
    }
  };
  const config = prepareSimulationConfig(
    createDefaultConfig(),
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedTraitIds: [TRAIT.SEIZE_THE_MOMENT],
      initialResource: 2,
      boons: { quickness: false, alacrity: false }
    }),
    { duration: 600 }
  );
  const result = simulateGw2({
    profession,
    rotation: ['Split Second'],
    config
  });
  const quickness = result.events.find((event) => event.type === 'buff' && event.kind === 'quickness');

  assert.ok(quickness);
  assert.equal(quickness.duration, 10);
  assert.equal(quickness.audience.maximumRecipients, 10);
});

test("Fencer's Finesse reduces sword skill cooldowns by 20%", () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    primaryWeapon: 'Sword',
    initialResource: 0
  });
  const baseline = simulateMesmer(['Blurred Frenzy', 'Blurred Frenzy'], config);
  const withTrait = simulateMesmer(['Blurred Frenzy', 'Blurred Frenzy'], {
    ...config,
    selectedTraitIds: [TRAIT.FENCERS_FINESSE]
  });

  assert.equal(baseline.steps[1].start, 8960);
  assert.equal(withTrait.steps[1].start, 7360);
});

test('Flow of Time increases clone critical chance while alacrity is active', () => {
  const result = simulateMesmer(
    ['Phase Retreat', { name: '__wait', waitMs: 2600 }],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedTraitIds: [TRAIT.FLOW_OF_TIME],
      primaryWeapon: 'Staff',
      secondaryWeapon: '',
      initialResource: 0,
      stats: { precision: 1000 },
      boons: { fury: false, alacrity: true }
    })
  );
  const cloneHit = result.resolvedEvents.find((event) => event.type === 'damage' && event.source === 'Clone');

  assert.ok(cloneHit);
  assert.equal(cloneHit.actorType, 'summon');
  assert.equal(cloneHit.summonKind, 'clone');
  assert.ok(Math.abs(cloneHit.criticalChance - 0.2) < 1e-12);
});

test('Phantasmal Fury increases phantasm critical chance', () => {
  const result = simulateMesmer(
    ['Phantasmal Warlock', { name: '__wait', waitMs: 4000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      selectedTraitIds: [TRAIT.PHANTASMAL_FURY],
      primaryWeapon: 'Staff',
      secondaryWeapon: '',
      initialResource: 0,
      stats: { precision: 1000 },
      boons: { fury: false, alacrity: false }
    })
  );
  const phantasmHit = result.resolvedEvents.find((event) => event.type === 'damage' && event.source === 'Phantasm');

  assert.ok(phantasmHit);
  assert.equal(phantasmHit.actorType, 'summon');
  assert.equal(phantasmHit.summonKind, 'phantasm');
  assert.ok(Math.abs(phantasmHit.criticalChance - 0.3) < 1e-12);
});

test('illusions do not inherit the mesmer Fury boon', () => {
  const result = simulateMesmer(
    ['Phantasmal Warlock', { name: '__wait', waitMs: 4000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      selectedTraitIds: [],
      primaryWeapon: 'Staff',
      secondaryWeapon: '',
      initialResource: 0,
      stats: { precision: 1000 },
      boons: { fury: true, alacrity: false }
    })
  );
  const phantasmHit = result.resolvedEvents.find((event) => event.type === 'damage' && event.source === 'Phantasm');

  assert.ok(Math.abs(phantasmHit.criticalChance - 0.05) < 1e-12);
});

test('clones do not inherit permanent Might while phantasms remain player-owned', () => {
  const simulateWithMight = (might) =>
    simulateMesmer(
      ['Phase Retreat', 'Phantasmal Warlock', { name: '__wait', waitMs: 4000 }],
      defaultSimulationConfig({
        specialization: 'Core',
        selectedTraitIds: [],
        primaryWeapon: 'Staff',
        secondaryWeapon: '',
        initialResource: 0,
        stats: {
          power: 1000,
          precision: 1000,
          ferocity: 0,
          conditionDamage: 0
        },
        boons: {
          might,
          fury: false,
          quickness: false,
          alacrity: false
        }
      })
    );
  const withoutMight = simulateWithMight(0);
  const withMight = simulateWithMight(25);
  const illusionDamage = (result, source) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.source === source)
      .reduce((sum, event) => sum + event.damage, 0);

  assert.ok(illusionDamage(withoutMight, 'Clone') > 0);
  assert.ok(illusionDamage(withoutMight, 'Phantasm') > 0);
  assert.equal(illusionDamage(withMight, 'Clone'), illusionDamage(withoutMight, 'Clone'));
  assert.ok(illusionDamage(withMight, 'Phantasm') > illusionDamage(withoutMight, 'Phantasm'));
});

test('Shift+click timeline form casts an instant skill 100ms into the prior cast', () => {
  const result = simulateMesmer(
    ['Bladecall', { name: 'Bladesong Distortion', offset: 100 }],
    defaultSimulationConfig()
  );

  assert.equal(result.steps[1].start, 100);
  assert.equal(result.steps[1].end, 100);
  assert.equal(result.endState.time, 440);
  assert.equal(result.endState.cooldowns['Bladesong Distortion'].readyAt, 40100);
});

test('shift-queued Rewinder waits past its parent cast for cooldown expiry', () => {
  const result = simulateMesmer(
    ['Rewinder', { name: '__wait', waitMs: 10000 }, 'Bladecall', { name: 'Rewinder', offset: 100 }],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 3
    })
  );

  assert.equal(result.steps[2].end, 10440);
  assert.equal(result.steps[3].start, 12000);
  assert.deepEqual(result.warnings, []);
});

test('interrupt commands end casts and remove later hit events', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    primaryWeapon: 'Scepter',
    secondaryWeapon: ''
  });
  const full = simulateMesmer(['Confusing Images'], config);
  const interrupted = simulateMesmer([{ name: 'Confusing Images', interruptMs: 250 }], config);

  assert.equal(interrupted.steps[0].end, 250);
  assert.equal(interrupted.steps[0].interrupted, true);
  assert.ok(interrupted.totalDamage < full.totalDamage);
});

test('Winds of Chaos commits by 560 ms and retains its later packets after interruption', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    primaryWeapon: 'Staff',
    secondaryWeapon: '',
    initialResource: 0
  });
  const packets = (interruptMs) => {
    const result = simulateMesmer(
      [
        { name: 'Winds of Chaos', interruptMs },
        { name: '__wait', waitMs: 1000 }
      ],
      config
    );

    return result.resolvedEvents.filter(
      (event) => event.skillName === 'Winds of Chaos' && (event.type === 'damage' || event.type === 'condition')
    );
  };

  assert.deepEqual(packets(559), []);
  assert.deepEqual(
    packets(560).map((event) => [event.type, Math.round(event.at * 1000), event.condition || null]),
    [
      ['damage', 533, null],
      ['damage', 623, null],
      ['condition', 760, 'Torment'],
      ['condition', 760, 'Confusion']
    ]
  );
});

test('Confusing Images applies seven timed confusion pulses and loses later pulses when interrupted', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    primaryWeapon: 'Scepter',
    secondaryWeapon: '',
    initialResource: 0
  });
  const full = simulateMesmer(['Confusing Images'], config);
  const interrupted = simulateMesmer([{ name: 'Confusing Images', interruptMs: 1000 }], config);
  const applications = (result) =>
    result.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === 'Confusing Images' && event.condition === 'Confusion'
    );
  const fullApplications = applications(full);
  const interruptedApplications = applications(interrupted);

  assert.equal(fullApplications.length, 7);
  assert.ok(fullApplications.every((event) => event.stacks === 1));
  assert.ok(fullApplications.every((event, index) => index === 0 || event.at > fullApplications[index - 1].at));
  assert.equal(interruptedApplications.length, 3);
});

test('Chaos Storm uses configured pulse offsets and Lesser Chaos Storm stays periodic', () => {
  const damageEvents = (result, skillName) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === skillName);
  const assertSixPulses = (events) => {
    assert.equal(events.length, 6);
    assert.ok(events.every((event) => event.hits === 1));
    assert.ok(events.every((event, index) => index === 0 || Math.abs(event.at - events[index - 1].at - 1) < 1e-12));
  };

  const chaosStorm = simulateMesmer(
    ['Chaos Storm', { name: '__wait', waitMs: 5000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Staff',
      secondaryWeapon: '',
      initialResource: 0
    })
  );

  assert.deepEqual(
    damageEvents(chaosStorm, 'Chaos Storm').map((event) => Math.round(event.at * 1000)),
    [281, 1279, 2280, 3282, 4279, 5280]
  );

  const lesserChaosStorm = simulateMesmer(
    ['Ether Feast', { name: '__wait', waitMs: 5000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      selectedTraitIds: [TRAIT.METHOD_OF_MADNESS],
      selectedSkills: ['Ether Feast']
    })
  );

  assertSixPulses(damageEvents(lesserChaosStorm, 'Lesser Chaos Storm'));
});

test('Confusing Images starts its cooldown after its channel ends', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    primaryWeapon: 'Scepter',
    secondaryWeapon: '',
    initialResource: 0
  });
  const full = simulateMesmer(['Confusing Images', 'Confusing Images'], config);
  const interrupted = simulateMesmer([{ name: 'Confusing Images', interruptMs: 250 }], config);

  assert.equal(full.steps[0].end, 1920);
  assert.equal(full.steps[1].start, 9120);
  assert.equal(interrupted.endState.cooldowns['Confusing Images'].readyAt, 7450);
});

test('Spatial Surge keeps channel packets completed before an interrupt', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    primaryWeapon: 'Greatsword',
    secondaryWeapon: '',
    initialResource: 0
  });
  const damageEvents = (result) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Spatial Surge');
  const full = damageEvents(simulateMesmer(['Spatial Surge'], config));
  const partial = damageEvents(simulateMesmer([{ name: 'Spatial Surge', interruptMs: 600 }], config));
  const beforeFirstPacket = damageEvents(simulateMesmer([{ name: 'Spatial Surge', interruptMs: 200 }], config));

  assert.equal(full.length, 3);
  assert.equal(partial.length, 2);
  assert.equal(beforeFirstPacket.length, 0);
  assert.ok(partial[1].at > partial[0].at);
});

test('Phantasmal Swordsman independently gates its summon and player hit', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword',
    initialResource: 0
  });
  const interruptedAt = (interruptMs) =>
    simulateMesmer(
      [
        { name: 'Phantasmal Swordsman', interruptMs },
        { name: '__wait', waitMs: 5000 }
      ],
      config
    );
  const summonedAt = (result) =>
    result.events.find((event) => event.type === 'mesmer.phantasm-summoned' && event.name === 'Phantasmal Swordsman')
      ?.at;
  const playerHitAt = (result) =>
    result.events.find(
      (event) => event.type === 'damage' && event.skillName === 'Phantasmal Swordsman' && event.source === 'Player'
    )?.at;
  const cancelled = (result) => result.events.find((event) => event.type === 'action')?.cancelled === true;

  const beforeSummon = interruptedAt(719);
  const summonOnly = interruptedAt(720);
  const beforePlayerHit = interruptedAt(750);
  const withPlayerHit = interruptedAt(760);

  assert.equal(summonedAt(beforeSummon), undefined);
  assert.equal(cancelled(beforeSummon), true);
  assert.equal(summonedAt(summonOnly), 0.72);
  assert.equal(cancelled(summonOnly), false);
  assert.equal(summonedAt(beforePlayerHit), 0.75);
  assert.equal(cancelled(beforePlayerHit), false);
  assert.equal(summonedAt(withPlayerHit), 0.76);
  assert.equal(cancelled(withPlayerHit), false);
  assert.equal(playerHitAt(summonOnly), undefined);
  assert.equal(playerHitAt(beforePlayerHit), undefined);
  assert.ok(Math.abs(playerHitAt(withPlayerHit) - 0.759) < 1e-12);
  assert.equal(summonOnly.endState.cooldowns['Phantasmal Swordsman'].readyAt, 12720);
  assert.ok(
    summonOnly.events.some(
      (event) => event.type === 'damage' && event.skillName === 'Phantasmal Swordsman' && event.source === 'Phantasm'
    )
  );
});

test('Phantasmal Swordsman converts on its measured base and Chronophantasma timelines', () => {
  const conversionAt = (specialization, selectedTraitIds, waitMs) =>
    simulateMesmer(
      ['Phantasmal Swordsman', { name: '__wait', waitMs }],
      defaultSimulationConfig({
        specialization,
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Sword',
        initialResource: 0,
        selectedTraitIds
      })
    ).events.find((event) => event.type === 'resource' && event.reason === 'Phantasmal Swordsman phantasm conversion')
      ?.at;

  assert.equal(Number(conversionAt('Core', [], 4000)?.toFixed(3)), 4.29);
  assert.equal(Number(conversionAt('Chronomancer', [TRAIT.CHRONOPHANTASMA], 8000)?.toFixed(3)), 8);
});

test("Phantasmal Swordsman grants Fencer's Finesse per sword hit", () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword',
    initialResource: 0,
    selectedTraitIds: [TRAIT.FENCERS_FINESSE]
  });
  const simulate = (interruptMs) =>
    simulateMesmer(
      [
        interruptMs == null ? 'Phantasmal Swordsman' : { name: 'Phantasmal Swordsman', interruptMs },
        { name: '__wait', waitMs: 5000 }
      ],
      config
    );
  const applications = (result) =>
    result.events
      .filter((event) => event.type === 'buff' && event.kind === 'fencer')
      .map((event) => ({
        at: Math.round(event.at * 10000),
        stacks: event.stacks
      }));

  assert.deepEqual(
    applications(simulate(null)),
    [7591, 17251, 22011, 22421, 25251, 25591, 28001, 28421, 31261, 31591].map((at) => ({ at, stacks: 1 }))
  );
  assert.deepEqual(
    applications(simulate(720)),
    [15651, 20411, 20821, 23651, 23991, 26401, 26821, 29661, 29991].map((at) => ({ at, stacks: 1 }))
  );
  assert.deepEqual(
    applications(simulate(760)).map((event) => event.at),
    [7591, 16051, 20811, 21221, 24051, 24391, 26801, 27221, 30061, 30391]
  );
});

test('Staff 3 converts after Mage Strike finishes and Chronophantasma repeats it first', () => {
  const rotation = ['Phantasmal Warlock', { name: '__wait', waitMs: 11000 }];
  const baseConfig = {
    initialResource: 0,
    primaryWeapon: 'Staff',
    secondaryWeapon: ''
  };
  const normal = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      ...baseConfig,
      specialization: 'Core',
      selectedTraitIds: []
    })
  );
  const chronophantasma = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      ...baseConfig,
      specialization: 'Chronomancer',
      selectedTraitIds: [TRAIT.CHRONOPHANTASMA]
    })
  );
  const normalConversions = normal.events.filter((event) => event.reason === 'Phantasmal Warlock phantasm conversion');
  const chronoConversions = chronophantasma.events.filter(
    (event) => event.reason === 'Phantasmal Warlock phantasm conversion'
  );
  const repeat = chronophantasma.events.find((event) => event.name === 'Phantasmal Warlock - Chronophantasma');
  const proc = chronophantasma.events.find((event) => event.type === 'proc' && event.name === 'Chronophantasma');

  assert.deepEqual(
    normalConversions.map((event) => [event.amount, Number(event.at.toFixed(4))]),
    [
      [1, 4.9201],
      [1, 5.0201]
    ]
  );
  assert.deepEqual(
    chronoConversions.map((event) => [event.amount, Number(event.at.toFixed(4))]),
    [
      [1, 9.2801],
      [1, 9.3201]
    ]
  );
  assert.ok(Math.abs(proc.at - 4.92) < 0.00001);
  assert.ok(Math.abs(repeat.at - 6.4) < 0.00001);

  const normalDamage = normal.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Phantasmal Warlock'
  );
  const normalTorment = normal.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.name === 'Phantasmal Warlock — Torment'
  );
  const repeatedDamage = chronophantasma.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.name === 'Phantasmal Warlock - Chronophantasma'
  );
  const repeatedTorment = chronophantasma.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.name === 'Phantasmal Warlock - Chronophantasma'
  );

  assert.deepEqual(
    {
      coefficient: normalDamage.reduce((sum, event) => sum + event.coefficient, 0),
      hits: normalDamage.reduce((sum, event) => sum + event.hits, 0)
    },
    { coefficient: 0.9, hits: 6 }
  );
  assert.ok(normalDamage.every((event) => event.weaponStrength === 2877));
  assert.deepEqual(
    normalTorment.map((event) => event.stacks),
    [6, 6]
  );
  assert.ok(normalTorment.every((event) => event.source === 'Phantasm'));
  assert.deepEqual(
    {
      coefficient: repeatedDamage.reduce((sum, event) => sum + event.coefficient, 0),
      hits: repeatedDamage.reduce((sum, event) => sum + event.hits, 0)
    },
    { coefficient: 0.9, hits: 6 }
  );
  assert.ok(repeatedDamage.every((event) => event.weaponStrength === 2877));
  assert.deepEqual(
    repeatedTorment.map((event) => event.stacks),
    [6, 6]
  );
  assert.ok(repeatedTorment.every((event) => event.source === 'Phantasm'));
});

test('phantasm conditions use the summoner condition sigil modifiers', () => {
  const defaults = defaultSimulationConfig();
  const base = {
    specialization: 'Core',
    selectedTraitIds: [],
    primaryWeapon: 'Staff',
    secondaryWeapon: '',
    initialResource: 0,
    target: {
      ...defaults.target,
      health: 0
    }
  };
  const rotation = ['Phantasmal Warlock', { name: '__wait', waitMs: 9000 }];
  const plain = simulateMesmer(rotation, defaultSimulationConfig(base));
  const withSigils = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      ...base,
      sigilSets: [
        {
          names: ['Bursting', 'Demons'],
          condition: 1.05,
          conditionDurationBonuses: { Torment: 20 }
        },
        { names: [] }
      ]
    })
  );
  const application = (result) =>
    result.resolvedEvents.find((event) => event.type === 'condition' && event.skillName === 'Phantasmal Warlock');
  const plainApplication = application(plain);
  const sigilApplication = application(withSigils);

  assert.equal(sigilApplication.source, 'Phantasm');
  assert.ok(sigilApplication.effectiveDuration > plainApplication.effectiveDuration);
  assert.ok(
    Math.abs(
      sigilApplication.damage /
        sigilApplication.damagingStackSeconds /
        (plainApplication.damage / plainApplication.damagingStackSeconds) -
        1.05
    ) < 0.000001
  );
});

test('Phantasmal Mage separates player, Pledge, and phantasm conditions', () => {
  const result = simulateMesmer(
    ['Phantasmal Mage', { name: '__wait', waitMs: 5000 }],
    defaultSimulationConfig({
      specialization: 'Mirage',
      selectedTraitIds: [TRAIT.THE_PLEDGE],
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Torch',
      initialResource: 0
    })
  );
  const playerBurning = result.resolvedEvents.filter(
    (event) =>
      event.type === 'condition' &&
      event.skillName === 'Phantasmal Mage' &&
      event.condition === 'Burning' &&
      event.source === 'Player'
  );
  const phantasmConditions = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Phantasmal Mage' && event.source === 'Phantasm'
  );
  const phantasmStrike = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Phantasmal Mage' && event.source === 'Phantasm'
  );

  assert.equal(result.steps[0].end, 760);
  assert.equal(phantasmStrike.weaponStrength, 2615.5);
  assert.deepEqual(
    playerBurning.map((event) => [event.stacks, event.duration, event.at]),
    [
      [1, 6, 0.76],
      [2, 3, 0.76]
    ]
  );
  assert.deepEqual(
    phantasmConditions.map((event) => [event.condition, event.stacks, event.duration]),
    [
      ['Burning', 1, 9],
      ['Confusion', 3, 3]
    ]
  );
});

test('Compounding Power triggers for both phantasm summons and clone conversion', () => {
  const result = simulateMesmer(
    ['Phantasmal Warlock', { name: '__wait', waitMs: 11000 }],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedTraitIds: [TRAIT.CHRONOPHANTASMA, TRAIT.COMPOUNDING_POWER],
      primaryWeapon: 'Staff',
      secondaryWeapon: '',
      initialResource: 0
    })
  );
  const triggers = result.events.filter(
    (event) =>
      event.type === 'proc' && event.name === 'Compounding Power' && event.sourceSkill.includes('Phantasmal Warlock')
  );

  assert.deepEqual(
    triggers.map((event) => Number(event.at.toFixed(4))),
    [0.84, 4.92, 9.2801, 9.3201]
  );
});

test('Compounding Power excludes illusion strikes but applies to their conditions', () => {
  const simulate = (selectedTraitIds) =>
    simulateMesmer(
      ['Phantasmal Warlock', { name: '__wait', waitMs: 4000 }],
      defaultSimulationConfig({
        specialization: 'Core',
        selectedTraitIds,
        primaryWeapon: 'Staff',
        secondaryWeapon: '',
        initialResource: 0
      })
    );
  const warlockDamage = (result) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.name === 'Phantasmal Warlock')
      .reduce((sum, event) => sum + event.damage, 0);
  const warlockConditionDamage = (result) =>
    result.resolvedEvents
      .filter((event) => event.type === 'condition' && event.skillName === 'Phantasmal Warlock')
      .reduce((sum, event) => sum + event.damage, 0);
  const withTrait = simulate([TRAIT.COMPOUNDING_POWER]);
  const withoutTrait = simulate([]);

  assert.equal(warlockDamage(withTrait), warlockDamage(withoutTrait));
  assert.ok(warlockConditionDamage(withTrait) > warlockConditionDamage(withoutTrait));
});

test('Vicious Expression and Empowered Illusions respect illusion ownership', () => {
  const assertMultiplier = (withTrait, baseline, expected) => {
    assert.ok(Math.abs(withTrait / baseline - expected) < 1e-12);
  };

  const damageBySource = (result, skillName, source) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillName === skillName && event.source === source)
      .reduce((sum, event) => sum + event.damage, 0);
  const simulateTroubadour = (selectedTraitIds) =>
    simulateMesmer(
      ['Phantasmal Swordsman', 'Lively Lute', { name: '__wait', waitMs: 4000 }],
      defaultSimulationConfig({
        specialization: 'Troubadour',
        selectedTraitIds,
        primaryWeapon: 'Sword',
        secondaryWeapon: 'Sword',
        initialResource: 3
      })
    );
  const baseline = simulateTroubadour([]);
  const vicious = simulateTroubadour([TRAIT.VICIOUS_EXPRESSION]);
  const empowered = simulateTroubadour([TRAIT.EMPOWERED_ILLUSIONS]);
  const both = simulateTroubadour([TRAIT.VICIOUS_EXPRESSION, TRAIT.EMPOWERED_ILLUSIONS]);
  const swordsmanDamage = (result, source) => damageBySource(result, 'Phantasmal Swordsman', source);
  const luteDamage = (result) => damageBySource(result, 'Lively Lute', 'Player');

  assertMultiplier(swordsmanDamage(vicious, 'Phantasm'), swordsmanDamage(baseline, 'Phantasm'), 1.15);
  assertMultiplier(swordsmanDamage(empowered, 'Phantasm'), swordsmanDamage(baseline, 'Phantasm'), 1.15);
  assertMultiplier(swordsmanDamage(both, 'Phantasm'), swordsmanDamage(baseline, 'Phantasm'), 1.15 * 1.15);
  assertMultiplier(swordsmanDamage(vicious, 'Player'), swordsmanDamage(baseline, 'Player'), 1.15);
  assert.equal(swordsmanDamage(empowered, 'Player'), swordsmanDamage(baseline, 'Player'));
  assertMultiplier(luteDamage(vicious), luteDamage(baseline), 1.15);
  assert.equal(luteDamage(empowered), luteDamage(baseline));
  assertMultiplier(luteDamage(both), luteDamage(baseline), 1.15);

  const simulateClone = (selectedTraitIds) =>
    simulateMesmer(
      ['Mirror Images', { name: '__wait', waitMs: 1 }, { name: 'Axes of Symmetry', skillId: ID.AXES_OF_SYMMETRY }],
      defaultSimulationConfig({
        specialization: 'Mirage',
        selectedSkills: ['Mirror Images'],
        selectedTraitIds,
        primaryWeapon: 'Axe',
        secondaryWeapon: 'Torch',
        initialResource: 0
      })
    );
  const cloneBaseline = simulateClone([]);
  const cloneVicious = simulateClone([TRAIT.VICIOUS_EXPRESSION]);
  const cloneEmpowered = simulateClone([TRAIT.EMPOWERED_ILLUSIONS]);
  const cloneBoth = simulateClone([TRAIT.VICIOUS_EXPRESSION, TRAIT.EMPOWERED_ILLUSIONS]);
  const cloneDamage = (result) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.name.includes('Axes of Symmetry') && event.source === 'Clone')
      .reduce((sum, event) => sum + event.damage, 0);

  assertMultiplier(cloneDamage(cloneVicious), cloneDamage(cloneBaseline), 1.15);
  assertMultiplier(cloneDamage(cloneEmpowered), cloneDamage(cloneBaseline), 1.15);
  assertMultiplier(cloneDamage(cloneBoth), cloneDamage(cloneBaseline), 1.15 * 1.15);
});

test('Compounding Power gives player strikes two percent and conditions one percent per stack', () => {
  const simulate = (selectedTraitIds) =>
    simulateMesmer(
      ['Mirror Images', 'Winds of Chaos', 'Cry of Frustration', { name: '__wait', waitMs: 5000 }],
      defaultSimulationConfig({
        specialization: 'Core',
        selectedTraitIds,
        primaryWeapon: 'Staff',
        secondaryWeapon: '',
        initialResource: 0
      })
    );
  const playerStrike = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === 'damage' && event.name === 'Winds of Chaos' && event.source === 'Player'
    ).damage;
  const playerCondition = (result) =>
    result.resolvedEvents.find(
      (event) => event.type === 'condition' && event.skillName === 'Cry of Frustration' && event.source === 'Player'
    ).damage;
  const withTrait = simulate([TRAIT.COMPOUNDING_POWER]);
  const withoutTrait = simulate([]);

  assert.ok(Math.abs(playerStrike(withTrait) / playerStrike(withoutTrait) - 1.04) < 1e-12);
  assert.ok(Math.abs(playerCondition(withTrait) / playerCondition(withoutTrait) - 1.02) < 1e-12);
});

test('Winds of Chaos uses its measured 760ms Quickness cast time', () => {
  const result = simulateMesmer(
    ['Winds of Chaos'],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Staff',
      secondaryWeapon: ''
    })
  );

  assert.equal(result.steps[0].end - result.steps[0].start, 760);
});

test('Phantasmal Warlock uses its full 840ms Quickness cast time', () => {
  const result = simulateMesmer(
    ['Phantasmal Warlock'],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Staff',
      secondaryWeapon: ''
    })
  );

  assert.equal(result.steps[0].end - result.steps[0].start, 840);
});

test('Phantasmal Warlock summons when shortened to 640ms', () => {
  const simulate = (interruptMs) =>
    simulateMesmer(
      [
        { name: 'Phantasmal Warlock', interruptMs },
        { name: '__wait', waitMs: 4000 }
      ],
      defaultSimulationConfig({
        specialization: 'Core',
        primaryWeapon: 'Staff',
        secondaryWeapon: '',
        initialResource: 0
      })
    );
  const summoned = (result) =>
    result.events.some((event) => event.type === 'mesmer.phantasm-summoned' && event.name === 'Phantasmal Warlock');
  const cancelled = (result) => result.events.find((event) => event.type === 'action')?.cancelled === true;

  const beforeCommit = simulate(639);
  const atCommit = simulate(640);

  assert.equal(summoned(beforeCommit), false);
  assert.equal(cancelled(beforeCommit), true);
  assert.equal(summoned(atCommit), true);
  assert.equal(cancelled(atCommit), false);
});

test('corrected Mesmer skills use their measured Quickness cast times', () => {
  const coreConfig = {
    specialization: 'Core',
    initialResource: 0
  };
  const counterspell = simulateMesmer(
    ['Illusionary Counter', 'Counterspell'],
    defaultSimulationConfig({
      ...coreConfig,
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Sword'
    })
  );

  assert.equal(counterspell.steps[1].end - counterspell.steps[1].start, 600);

  const signet = simulateMesmer(['Signet of the Ether'], defaultSimulationConfig(coreConfig));

  assert.equal(signet.steps[0].end - signet.steps[0].start, 919);

  const chaosStorm = simulateMesmer(
    ['Chaos Storm'],
    defaultSimulationConfig({
      ...coreConfig,
      primaryWeapon: 'Staff',
      secondaryWeapon: ''
    })
  );

  assert.equal(chaosStorm.steps[0].end - chaosStorm.steps[0].start, 480);

  const inversion = simulateMesmer(
    ['Imaginary Inversion'],
    defaultSimulationConfig({
      ...coreConfig,
      primaryWeapon: 'Spear',
      secondaryWeapon: ''
    })
  );

  assert.equal(inversion.steps[0].end - inversion.steps[0].start, 680);
  const inversionHit = inversion.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Imaginary Inversion'
  );

  assert.equal(Math.round((inversionHit.at - inversion.steps[0].start / 1000) * 1000), 600);

  const gravityWell = simulateMesmer(
    ['Gravity Well'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 0,
      selectedSkills: ['Gravity Well']
    })
  );

  assert.equal(gravityWell.steps[0].end - gravityWell.steps[0].start, 1080);

  const scepterChain = simulateMesmer(
    ['Ether Bolt', 'Ether Blast', 'Ether Clone'],
    defaultSimulationConfig({
      ...coreConfig,
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Sword'
    })
  );

  assert.deepEqual(
    scepterChain.steps.map((step) => step.end - step.start),
    [440, 520, 840]
  );

  const confusingImages = simulateMesmer(
    ['Confusing Images'],
    defaultSimulationConfig({
      ...coreConfig,
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Sword'
    })
  );

  assert.equal(confusingImages.steps[0].end - confusingImages.steps[0].start, 1920);

  const pistolSkills = simulateMesmer(
    ['Phantasmal Duelist', 'Magic Bullet'],
    defaultSimulationConfig({
      ...coreConfig,
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Pistol'
    })
  );

  assert.deepEqual(
    pistolSkills.steps.map((step) => step.end - step.start),
    [560, 440]
  );

  const axeSkills = simulateMesmer(
    ['Lacerating Chop', 'Ethereal Chop', 'Mirror Strikes', 'Lingering Thoughts', 'Axes of Symmetry'],
    defaultSimulationConfig({
      specialization: 'Mirage',
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Pistol',
      initialResource: 0
    })
  );

  assert.deepEqual(
    axeSkills.steps.map((step) => step.end - step.start),
    [430, 530, 720, 920, 1000]
  );

  const greatswordSkills = simulateMesmer(
    ['Mind Stab', 'Phantasmal Berserker', 'Illusionary Wave'],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Greatsword',
      secondaryWeapon: '',
      initialResource: 0
    })
  );

  assert.deepEqual(
    greatswordSkills.steps.map((step) => step.end - step.start),
    [320, 560, 640]
  );
});

test('Mind Stab applies its supplied Vulnerability coefficient scaling', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    primaryWeapon: 'Greatsword',
    secondaryWeapon: '',
    selectedTraitIds: [],
    modifiers: { strike: 1, condition: 1 }
  });
  const damageAt = (vulnerability) =>
    simulateMesmer(['Mind Stab'], {
      ...config,
      target: {
        ...config.target,
        conditions: {
          ...config.target.conditions,
          Vulnerability: vulnerability
        }
      }
    }).resolvedEvents.find((event) => event.type === 'damage' && event.skillName === 'Mind Stab').damage;

  assert.ok(Math.abs(damageAt(25) / damageAt(0) - 1.5625) < 1e-12);
});

test('Phantasmal Berserker uses its phantasm coefficient and Bountiful reduction', () => {
  const coefficientAt = (selectedTraitIds) =>
    simulateMesmer(
      ['Phantasmal Berserker', { name: '__wait', waitMs: 2000 }],
      defaultSimulationConfig({
        specialization: 'Core',
        primaryWeapon: 'Greatsword',
        secondaryWeapon: '',
        selectedTraitIds,
        initialResource: 0
      })
    )
      .events.filter((event) => event.type === 'damage' && event.skillName === 'Phantasmal Berserker')
      .reduce((sum, event) => sum + event.coefficient, 0);

  assert.ok(Math.abs(coefficientAt([]) - 2.4) < 1e-12);
  assert.ok(Math.abs(coefficientAt([TRAIT.BOUNTIFUL_BLADES]) - 2.784) < 1e-12);
});

test('Mirror Blade resolves target-facing bounce damage as separate hits', () => {
  const simulateMirrorBlade = (selectedTraitIds) =>
    simulateMesmer(
      ['Mirror Blade', { name: '__wait', waitMs: 1000 }],
      defaultSimulationConfig({
        specialization: 'Core',
        primaryWeapon: 'Greatsword',
        secondaryWeapon: '',
        selectedTraitIds,
        initialResource: 0
      })
    );
  const result = simulateMirrorBlade([TRAIT.BOUNTIFUL_BLADES]);
  const hits = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Mirror Blade');
  const baseHits = simulateMirrorBlade([]).resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Mirror Blade'
  );

  assert.equal(hits.length, 4);
  assert.equal(baseHits.length, 3);
  assert.deepEqual(
    hits.map((event) => event.coefficient),
    [2.5, 0.1, 0.004, 0.00016]
  );
  assert.ok(hits.every((event, index) => index === 0 || event.at > hits[index - 1].at));
});

test('Pistol 4 converts after Illusionary Unload and its Chronophantasma repeat', () => {
  const rotation = ['Phantasmal Duelist', { name: '__wait', waitMs: 15000 }];
  const baseConfig = {
    initialResource: 0,
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Pistol'
  };
  const normal = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      ...baseConfig,
      specialization: 'Core',
      selectedTraitIds: []
    })
  );
  const chronophantasma = simulateMesmer(
    rotation,
    defaultSimulationConfig({
      ...baseConfig,
      specialization: 'Chronomancer',
      selectedTraitIds: [TRAIT.CHRONOPHANTASMA]
    })
  );
  const normalConversion = normal.events.find((event) => event.reason === 'Phantasmal Duelist phantasm conversion');
  const chronoConversion = chronophantasma.events.find(
    (event) => event.reason === 'Phantasmal Duelist phantasm conversion'
  );
  const resummon = chronophantasma.events.find(
    (event) => event.type === 'mesmer.phantasm-resummoned' && event.name === 'Phantasmal Duelist'
  );
  const repeat = chronophantasma.events.find(
    (event) => event.type === 'mesmer.phantasm-attack' && event.name === 'Phantasmal Duelist' && event.repeat
  );

  assert.equal(normalConversion.amount, 1);
  assert.ok(Math.abs(normalConversion.at - 3.3601) < 0.00001);
  assert.ok(Math.abs(resummon.at - 3.36) < 0.00001);
  assert.ok(Math.abs(repeat.at - 5.82) < 0.00001);
  assert.equal(chronoConversion.amount, 1);
  assert.ok(Math.abs(chronoConversion.at - 6.3601) < 0.00001);
});

test('Mimic resets the next utility skill within its ten-second window', () => {
  const result = simulateMesmer(
    ['Mimic', 'Tale of the Tortured Mastermind', 'Tale of the Tortured Mastermind'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      selectedSkills: ['Mimic', 'Tale of the Tortured Mastermind'],
      initialResource: 0
    })
  );

  assert.deepEqual(result.warnings, []);
  assert.equal(result.steps[0].end, 640);
  assert.equal(result.steps[1].start, 640);
  assert.equal(result.steps[2].start, 1040);
  assert.ok(
    result.events.some(
      (event) =>
        event.type === 'proc' && event.source === 'Mimic' && event.targetSkillName === 'Tale of the Tortured Mastermind'
    )
  );
});

test('phantasms and Chronophantasma repeats use per-entity packet cadences', () => {
  const cases = [
    {
      skill: 'Phantasmal Swordsman',
      attackNames: ['Sword Attack', 'Blurred Frenzy'],
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Sword',
      initial: [845, 1321, 1362, 1645, 1679, 1920, 1962, 2246, 2279],
      repeat: [4560, 5040, 5080, 5360, 5400, 5640, 5680, 5960, 6000]
    },
    {
      skill: 'Phantasmal Duelist',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Pistol',
      initial: [830, 1030, 1230, 1430, 1630, 1830, 2030, 2230],
      repeat: [3860, 4060, 4260, 4460, 4660, 4860, 5060, 5260]
    },
    {
      skill: 'Phantasmal Mage',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Torch',
      initial: [2000],
      repeat: [3920]
    },
    {
      skill: 'Phantasmal Berserker',
      primaryWeapon: 'Greatsword',
      secondaryWeapon: 'Sword',
      traits: [TRAIT.CHRONOPHANTASMA, TRAIT.BOUNTIFUL_BLADES],
      initial: [720, 840, 960, 980, 1080, 1100, 1220, 1340],
      repeat: [3160, 3320, 3320, 3400, 3440, 3520, 3560, 3680]
    },
    {
      skill: 'Phantasmal Disenchanter',
      primaryWeapon: 'Greatsword',
      secondaryWeapon: 'Sword',
      selectedSkills: ['Phantasmal Disenchanter'],
      initial: [1240],
      repeat: [3230]
    },
    {
      skill: 'Phantasmal Warden',
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Focus',
      initial: [880, 1240, 1600, 1960, 2320, 2680, 3080, 3440, 3800, 4160, 4520, 4880],
      repeat: [8020, 8380, 8740, 9100, 9460, 9820, 10220, 10580, 10940, 11300, 11670, 12020]
    },
    {
      skill: 'Phantasmal Warlock',
      primaryWeapon: 'Staff',
      secondaryWeapon: '',
      initial: [1200, 1300, 2000, 2100, 2800, 2900],
      repeat: [5560, 5600, 6360, 6400, 7160, 7200]
    },
    {
      skill: 'Phantasmal Lancer',
      primaryWeapon: 'Spear',
      secondaryWeapon: '',
      initial: [1160],
      repeat: [3300]
    }
  ];

  for (const testCase of cases) {
    const result = simulateMesmer(
      [testCase.skill, { name: '__wait', waitMs: 15000 }],
      defaultSimulationConfig({
        specialization: 'Chronomancer',
        selectedTraitIds: testCase.traits || [TRAIT.CHRONOPHANTASMA],
        ...(testCase.selectedSkills ? { selectedSkills: testCase.selectedSkills } : {}),
        primaryWeapon: testCase.primaryWeapon,
        secondaryWeapon: testCase.secondaryWeapon,
        initialResource: 0
      })
    );
    const castEnd = result.steps[0].end / 1000;
    const initialEvents = result.events.filter(
      (event) =>
        event.type === 'damage' &&
        event.source === 'Phantasm' &&
        (testCase.attackNames ? testCase.attackNames.includes(event.name) : event.name === testCase.skill)
    );
    const repeatEvents = result.events.filter(
      (event) =>
        event.type === 'damage' &&
        event.source === 'Phantasm' &&
        (testCase.attackNames
          ? testCase.attackNames.some((name) => event.name === `${name} - Chronophantasma`)
          : event.name === `${testCase.skill} - Chronophantasma`)
    );
    const offsets = (events) => events.map((event) => Math.round((event.at - castEnd) * 1000)).sort((a, b) => a - b);

    assert.deepEqual(offsets(initialEvents), testCase.initial, `${testCase.skill} initial`);
    assert.deepEqual(offsets(repeatEvents), testCase.repeat, `${testCase.skill} repeat`);
  }
});

test('direct Mesmer strikes use configured offsets from cast start', () => {
  const assertOffsets = (rotation, config, expectations) => {
    const result = simulateMesmer([...rotation, { name: '__wait', waitMs: 6000 }], defaultSimulationConfig(config));

    for (const [skill, stepIndex, expected] of expectations) {
      const castStart = result.steps[stepIndex].start / 1000;
      const offsets = result.resolvedEvents
        .filter((event) => event.type === 'damage' && event.source === 'Player' && event.skillName === skill)
        .map((event) => Math.round((event.at - castStart) * 1000));

      assert.deepEqual(offsets, expected, skill);
    }
  };

  assertOffsets(
    ['Chaos Storm'],
    {
      specialization: 'Chronomancer',
      primaryWeapon: 'Staff',
      secondaryWeapon: ''
    },
    [['Chaos Storm', 0, [281, 1279, 2280, 3282, 4279, 5280]]]
  );
  assertOffsets(
    ['Confusing Images'],
    {
      specialization: 'Chronomancer',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Pistol'
    },
    [['Confusing Images', 0, [921, 1081, 1199, 1441, 1560, 1679, 1841]]]
  );
  assertOffsets(
    ['Winds of Chaos'],
    {
      specialization: 'Chronomancer',
      primaryWeapon: 'Staff',
      secondaryWeapon: ''
    },
    [['Winds of Chaos', 0, [533, 623]]]
  );
  assertOffsets(
    ['Illusionary Wave', 'Mind Stab', 'Mirror Blade', 'Spatial Surge'],
    {
      specialization: 'Chronomancer',
      selectedTraitIds: [TRAIT.BOUNTIFUL_BLADES],
      primaryWeapon: 'Greatsword',
      secondaryWeapon: 'Sword'
    },
    [
      ['Illusionary Wave', 0, [401]],
      ['Mind Stab', 1, [200]],
      ['Mirror Blade', 2, [602, 767, 918, 1084]],
      ['Spatial Surge', 3, [360, 520, 680]]
    ]
  );
  assertOffsets(['Well of Calamity'], { specialization: 'Chronomancer', selectedSkills: ['Well of Calamity'] }, [
    ['Well of Calamity', 0, [559, 1559, 2561, 3554]]
  ]);
  assertOffsets(['Bladesong Dissonance'], { specialization: 'Virtuoso', initialResource: 5 }, [
    ['Bladesong Dissonance', 0, [400]]
  ]);
  assertOffsets(
    ['Illusionary Counter', 'Counterspell'],
    {
      specialization: 'Chronomancer',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Sword'
    },
    [['Counterspell', 1, [322]]]
  );
  assertOffsets(
    ['Illusionary Riposte', 'Counter Blade'],
    {
      specialization: 'Chronomancer',
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Sword'
    },
    [['Counter Blade', 1, [484]]]
  );
  assertOffsets(
    ['Ether Bolt', 'Ether Blast', 'Ether Clone'],
    {
      specialization: 'Chronomancer',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Sword'
    },
    [
      ['Ether Bolt', 0, [400]],
      ['Ether Blast', 1, [481]],
      ['Ether Clone', 2, [442]]
    ]
  );
  assertOffsets(
    ['Magic Bullet'],
    {
      specialization: 'Chronomancer',
      primaryWeapon: 'Scepter',
      secondaryWeapon: 'Pistol'
    },
    [['Magic Bullet', 0, [362]]]
  );
});

test('Well of Calamity uses its measured cast, pulse conditions, and ethereal field', () => {
  const result = simulateMesmer(
    [
      { name: 'Well of Calamity', interruptMs: 700 },
      { name: '__wait', waitMs: 4000 }
    ],
    defaultSimulationConfig({ specialization: 'Chronomancer', selectedSkills: ['Well of Calamity'] })
  );
  const conditions = result.resolvedEvents
    .filter((event) => event.type === 'condition' && event.skillName === 'Well of Calamity')
    .map((event) => [event.condition, Math.round(event.at * 1000), event.stacks, event.duration]);
  const well = mesmerCatalog.skillsByName.get('Well of Calamity');

  assert.equal(result.steps[0].end - result.steps[0].start, 700);
  assert.deepEqual(conditions, [
    ['Crippled', 559, 1, 2],
    ['Weakness', 559, 1, 2],
    ['Crippled', 1559, 1, 2],
    ['Weakness', 1559, 1, 2],
    ['Crippled', 2561, 1, 2],
    ['Weakness', 2561, 1, 2],
    ['Crippled', 3554, 1, 2],
    ['Weakness', 3554, 1, 2]
  ]);
  assert.deepEqual(well.comboFields, [
    {
      ownerId: 'mesmer',
      fieldType: 'Ethereal',
      duration: 3,
      startMs: 559,
      startAnchor: 'castStart'
    }
  ]);
});

test('Well of Action keeps all measured pulses after its first pulse commits an interrupted cast', () => {
  const result = simulateMesmer(
    [
      { name: 'Well of Action', interruptMs: 600 },
      { name: '__wait', waitMs: 3000 }
    ],
    defaultSimulationConfig({ specialization: 'Chronomancer', selectedSkills: ['Well of Action'] })
  );
  const packets = result.resolvedEvents
    .filter((event) => event.type === 'damage' && event.skillName === 'Well of Action')
    .map((event) => Math.round(event.at * 1000));
  const well = mesmerCatalog.skillsByName.get('Well of Action');

  assert.equal(result.steps[0].end - result.steps[0].start, 600);
  assert.deepEqual(packets, [518, 1519, 2520]);
  assert.deepEqual(well.comboFields, [
    {
      ownerId: 'mesmer',
      fieldType: 'Ethereal',
      duration: 3,
      startMs: 518,
      startAnchor: 'castStart'
    }
  ]);
});

test('Chronomancer wells use their measured Quickness cast times', () => {
  // Exercise the scheduler so these measurements remain the actual runtime durations, not just catalog metadata.
  const result = simulateMesmer(
    ['Well of Action', 'Well of Eternity'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedSkills: ['Well of Action', 'Well of Eternity']
    })
  );
  const durations = Object.fromEntries(result.steps.map((step) => [step.skill, step.end - step.start]));

  assert.equal(durations['Well of Action'], 800);
  assert.equal(durations['Well of Eternity'], 400);
});
