import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import { activeResourceGroup } from '#gw2/app/rotation/palette/resource-view.js';
import {
  formatConcurrentTimelineBadge,
  formatInterruptTimelineBadge,
  mechanicResourceSpends
} from '#gw2/app/rotation/timeline/model.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { defaultSimulationConfig } from '#tests/helpers/fixture-harness-core.js';
import { createDefaultConfig, runMesmer, simulateMesmer } from '#tests/helpers/mesmer-simulation.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { assertFlooredDamageMultiplier, assertRoundedDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import { prepareSimulationConfig } from '#tests/helpers/simulation-config.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('concurrent timeline badges show both delay and cast timestamp', () => {
  assert.equal(formatConcurrentTimelineBadge(100, '2.23s'), '⊙100ms\n2.23s');
});

test('interrupt timeline badges show both interrupt delay and cast timestamp', () => {
  assert.equal(formatInterruptTimelineBadge(120, '4.56s'), '✂120ms\n4.56s');
});

test('queueing a cooling-down icon waits until it is available', () => {
  const result = simulateMesmer(['Bladecall', 'Bladecall'], defaultSimulationConfig());

  assert.equal(result.steps[0].start, 0);
  assert.equal(result.steps[1].start, 4440);
  assert.equal(result.planningState.cooldowns[ID.BLADECALL].readyAt, 8880);
  assert.equal(result.planningState.cooldowns[ID.BLADECALL].remaining, 4000);
});

// Controlled recharge data exercises the real profession without pinning the live balance value.
test('Lingering Thoughts spends available ammo before waiting for serial recharge', () => {
  const config = defaultSimulationConfig({
    specialization: 'Mirage',
    initialResource: 0,
    primaryWeapon: 'Axe',
    selectedTraitIds: []
  });
  const native = mesmerProfession.runtimeFor(config);
  const result = observeGw2Runtime({
    profession: {
      ...native,
      catalog: withSkill(native.catalog, ID.LINGERING_THOUGHTS, {
        ammo: 2,
        ammoRecharge: 5,
        cooldown: 0,
        ammoCastLockout: 0,
        castTimeMs: 400,
        rechargeAnchor: 'castStart',
        rechargeOffsetMs: 0
      })
    },
    config,
    rotation: Array(4).fill({ type: 'cast', skillId: ID.LINGERING_THOUGHTS })
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.steps.map((step) => step.start),
    [0, 400, 4000, 8000]
  );
  assert.equal(result.planningState.ammoBySkillId[ID.LINGERING_THOUGHTS].charges, 0);
  assert.deepEqual(
    observedRuntime(result)
      .cooldownController.readAmmo(ID.LINGERING_THOUGHTS)
      .recharges.map((progress) => progress.work),
    [5, 5]
  );
});

// Damage resolves before the deferred clone; clone timing follows cast completion.
test('Lingering Thoughts grants its clone after its damage and cast completion', () => {
  const config = defaultSimulationConfig({
    specialization: 'Mirage',
    selectedTraitIds: [],
    primaryWeapon: 'Axe',
    secondaryWeapon: 'Torch',
    initialResource: 0
  });
  const native = mesmerProfession.runtimeFor(config);
  const skill = native.catalog.skillsById.get(ID.LINGERING_THOUGHTS);
  const result = observeGw2Runtime({
    profession: {
      ...native,
      catalog: withSkill(native.catalog, skill.id, {
        resource: { ...skill.resource, count: 1, atMs: 200 }
      })
    },
    config,
    rotation: [
      { type: 'cast', skillId: skill.id },
      { type: 'wait', durationMs: 400 }
    ]
  });
  const step = result.steps[0];
  const strikes = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === skill.id);
  const clone = result.events.find((event) => event.type === 'resource' && event.reason === skill.name);
  assert.deepEqual(result.warnings, []);
  assert.ok(strikes.length > 0);
  assert.ok(strikes.every((event) => event.at < clone.at));
  assert.equal(Math.round(clone.at * 1000 - step.end), 200);
  assert.equal(result.planningState.profession.resource, 1);
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

  assert.deepEqual(mechanicResourceSpends(fullShatter).get(0), {
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

  assert.equal(initial.planningState.profession.resource, 3);

  const replaced = simulateMesmer(
    ['Mirror Images', { name: '__wait', waitMs: 1 }],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedSkillIds: [10202],
      initialResource: 3
    })
  );
  const resourceEvents = replaced.events.filter((event) => event.type === 'resource' && event.resource === 'clones');

  assert.equal(replaced.planningState.profession.resource, 3);
  assert.ok(resourceEvents.every((event) => event.value <= 3));
});

test('clone resource pips render without a redundant numeric count', () => {
  const resourceHtml = activeResourceGroup({
    activeCatalog: mesmerProfession.catalog,
    profession: mesmerProfession,
    adapter: { eliteSpecialization: () => 'Chronomancer' },
    build: { initialResource: 0 },
    results: {
      planningState: {
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

  assert.ok(Math.abs(result.steps.find((step) => step.skillId != null).start - 2040) < 1e-9);
  assert.equal(result.planningState.cooldowns[ID.CONTINUUM_SPLIT].readyAt, 61560);
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
      attributeInputs: baseAttributeInputs({ concentration: 750 }),
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
    runtimeFor(config) {
      const runtime = mesmerProfession.runtimeFor(config);

      return {
        ...runtime,
        catalog: applyBalanceProfilePatch(runtime.catalog, {
          balanceProfiles: {
            [TRAIT.SEIZE_THE_MOMENT]: {
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
  const result = runMesmer(['Split Second'], config, { profession });
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
      attributeInputs: baseAttributeInputs({ precision: 1000 }),
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
      attributeInputs: baseAttributeInputs({ precision: 1000 }),
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
      attributeInputs: baseAttributeInputs({ precision: 1000 }),
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
        attributeInputs: baseAttributeInputs({
          power: 1000,
          precision: 1000,
          ferocity: 0,
          conditionDamage: 0
        }),
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

test('Shift+click timeline form schedules a concurrent instant skill on the next action tick', () => {
  const result = simulateMesmer(
    ['Bladecall', { name: 'Bladesong Distortion', offset: 100 }],
    defaultSimulationConfig()
  );

  assert.equal(result.steps[1].start, 120);
  assert.equal(result.planningState.atSeconds * 1000, 440);
  assert.equal(result.planningState.cooldowns[ID.BLADESONG_DISTORTION].readyAt, 40120);
});

test('shift-queued Rewinder waits past its parent cast for cooldown expiry', () => {
  const result = simulateMesmer(
    ['Rewinder', { name: '__wait', waitMs: 10000 }, 'Bladecall', { name: 'Rewinder', offset: 100 }],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      initialResource: 3
    })
  );
  assert.equal(result.steps.findLast((step) => step.skill === 'Rewinder').start, 12000);
  assert.deepEqual(result.warnings, []);
});

// Cast-local selection keeps whole stacks and alternates 2/3 even when an earlier attempt was cancelled.
test('Chaos Storm alternates whole Poison pulses across successful casts', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    primaryWeapon: 'Staff',
    secondaryWeapon: '',
    initialResource: 0
  });
  const rotation = [
    { name: 'Chaos Storm', interruptMs: 100 },
    'Chaos Storm',
    'Chaos Storm',
    'Chaos Storm',
    { type: 'wait', durationMs: 6000 }
  ];
  const result = simulateMesmer(rotation, config);
  assert.deepEqual(result.warnings, []);
  const casts = result.events.filter((event) => event.type === 'action' && event.skillId === ID.CHAOS_STORM);
  const poison = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillId === ID.CHAOS_STORM && event.condition === 'Poisoned'
  );
  assert.deepEqual(
    casts.map((cast) => poison.filter((event) => event.activationId === cast.activationId).length),
    [0, 2, 3, 2]
  );
  assert.ok(poison.every((event) => event.stacks === 1 && event.duration === 4));
  const rerun = simulateMesmer(['Chaos Storm', { type: 'wait', durationMs: 6000 }], config);
  assert.equal(
    rerun.resolvedEvents.filter((event) => event.type === 'condition' && event.condition === 'Poisoned').length,
    2
  );
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
  assert.equal(full.steps[1].start, 9120);
  assert.equal(interrupted.planningState.cooldowns[ID.CONFUSING_IMAGES].readyAt, 7480);
});

test('Phantasmal Swordsman registers its player hit before a later overlapping action', () => {
  const result = simulateMesmer(
    ['Phantasmal Swordsman', { name: 'Signet of Midnight', offset: 800 }],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Sword',
      secondaryWeapon: 'Sword',
      selectedSkillIds: [10234],
      initialResource: 0
    })
  );
  const playerHit = result.events.find(
    (event) => event.type === 'damage' && event.skillName === 'Phantasmal Swordsman' && event.source === 'Player'
  );
  const overlappingAction = result.events.find(
    (event) => event.type === 'action' && event.skillName === 'Signet of Midnight'
  );

  assert.ok(playerHit.at < overlappingAction.at);
  assert.ok(playerHit.eventOrder < overlappingAction.eventOrder);
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
  assertRoundedDamageMultiplier(
    sigilApplication.damageTicks.find((tick) => tick.fraction === 1).damage,
    plainApplication.damageTicks.find((tick) => tick.fraction === 1).damage,
    1.05
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
      event.actorType === 'player'
  );
  const phantasmConditions = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.skillName === 'Phantasmal Mage' && event.source === 'Phantasm'
  );
  const phantasmStrike = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Phantasmal Mage' && event.source === 'Phantasm'
  );
  assert.equal(phantasmStrike.weaponStrength, 2615.5);
  assert.deepEqual(
    playerBurning.map((event) => [event.stacks, event.duration]).sort((left, right) => left[0] - right[0]),
    [
      [1, 6],
      [1, 3],
      [1, 3]
    ]
  );
  assert.deepEqual(
    phantasmConditions.map((event) => [event.condition, event.stacks, event.duration]),
    [['Burning', 1, 9], ...Array.from({ length: 3 }, () => ['Confusion', 1, 3])]
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
      .filter(
        (event) =>
          event.type === 'damage' && event.skillName === 'Phantasmal Warlock' && event.summonKind === 'phantasm'
      )
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
    assertFlooredDamageMultiplier(withTrait, baseline, expected);
  };

  const damageBySource = (result, skillName, source) =>
    result.resolvedEvents.find(
      (event) => event.type === 'damage' && event.skillName === skillName && event.source === source
    ).damage;
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
        selectedSkillIds: [10202],
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
    result.resolvedEvents.find(
      (event) => event.type === 'damage' && event.name.includes('Axes of Symmetry') && event.source === 'Clone'
    ).damage;

  assertMultiplier(cloneDamage(cloneVicious), cloneDamage(cloneBaseline), 1.15);
  assertMultiplier(cloneDamage(cloneEmpowered), cloneDamage(cloneBaseline), 1.15);
  assertMultiplier(cloneDamage(cloneBoth), cloneDamage(cloneBaseline), 1.15 * 1.15);
});

test('Compounding Power gives player strikes and conditions one percent per stack', () => {
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
      (event) => event.type === 'damage' && event.skillName === 'Winds of Chaos' && event.actorType === 'player'
    ).damage;
  const playerCondition = (result) =>
    result.resolvedEvents
      .find(
        (event) => event.type === 'condition' && event.skillName === 'Cry of Frustration' && event.source === 'Player'
      )
      .damageTicks.find((tick) => tick.fraction === 1).damage;
  const withTrait = simulate([TRAIT.COMPOUNDING_POWER]);
  const withoutTrait = simulate([]);

  assertFlooredDamageMultiplier(playerStrike(withTrait), playerStrike(withoutTrait), 1.02);
  assertRoundedDamageMultiplier(playerCondition(withTrait), playerCondition(withoutTrait), 1.02);
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

  assertFlooredDamageMultiplier(damageAt(25), damageAt(0), 1.5625);
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

  assert.equal(hits.length, 6);
  assert.equal(baseHits.length, 4);
  assert.deepEqual(
    hits.map((event) => event.coefficient),
    [2.5, 0.1, 0.004, 0.00016, 0.0000064, 0.000000256]
  );
  assert.ok(hits.every((event, index) => index === 0 || event.at > hits[index - 1].at));
});

// A second utility must wait for Mimic's reduced recharge before the scheduler accepts it.
test('Mimic allows the next utility to repeat after its reduced recharge', () => {
  const result = simulateMesmer(
    ['Mimic', 'Tale of the Tortured Mastermind', 'Tale of the Tortured Mastermind'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      selectedSkillIds: [29578, 77066],
      initialResource: 0
    })
  );

  assert.deepEqual(result.warnings, []);
  const proc = result.events.find((event) => event.type === 'proc' && event.source === 'Mimic');
  assert.ok(proc);
  const utilities = result.steps.filter((step) => step.skill === 'Tale of the Tortured Mastermind');
  assert.equal(utilities[1].start, Math.round((proc.at + 1 / 1.25) * 1000));
});

// Endurance is granted when the well expires, after its support boons have been applied.
test('Well of Precognition grants support boons and restores endurance at field expiry', () => {
  const result = simulateMesmer(
    ['Well of Precognition', { name: '__wait', waitMs: 4000 }],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedSkillIds: [29526],
      boons: { quickness: false, alacrity: false },
      attributeInputs: baseAttributeInputs({ concentration: 0 })
    })
  );
  const cast = result.steps[0];
  const events = result.events.filter((event) => event.skillId === ID.WELL_OF_PRECOGNITION);
  assert.ok(events.some((event) => event.type === 'buff' && event.kind === 'aegis'));
  assert.ok(events.some((event) => event.type === 'buff' && event.kind === 'stability'));
  const field = events.find((event) => event.type === 'combo_field');
  assert.equal(field.fieldType, 'Ethereal');
  assert.equal(field.expiresAt - field.at, 3);
  const endurance = events.find((event) => event.type === 'resource' && event.resource === 'endurance');
  assert.equal(endurance.at, field.expiresAt);
  assert.equal(endurance.amount, 30);
  assert.equal(result.planningState.cooldowns[ID.WELL_OF_PRECOGNITION].readyAt - cast.end, 40000);
  assert.deepEqual(result.warnings, []);
});

test('cancelled Well of Precognition grants no protection, field, or endurance', () => {
  const result = simulateMesmer(
    [
      { name: 'Well of Precognition', interruptMs: 100 },
      { name: '__wait', waitMs: 4000 }
    ],
    defaultSimulationConfig({ specialization: 'Chronomancer' })
  );
  assert.equal(
    result.events.some(
      (event) => event.skillId === ID.WELL_OF_PRECOGNITION && ['buff', 'combo_field', 'resource'].includes(event.type)
    ),
    false
  );
});
