import { onAcceptedEvent } from '#gw2/professions/elementalist/specializations/evoker/mechanics/event-handlers.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runNative } from '#tests/helpers/elementalist-simulation.js';
import { elementalistCatalog, elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { gw2BaseRecharge } from '#gw2/platform/engine/skills/recharge.js';
import { GW2_ALACRITY_RECHARGE_RATE } from '#gw2/platform/engine/skills/recharge.js';
import { evokerState, grantElectricEnchantments } from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { emitElementalistDamage } from '#gw2/professions/elementalist/core/events.js';
import { EVOKER_BALANCE_PROFILE_IDS } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { modifyFamiliarEffects } from '#gw2/professions/elementalist/specializations/evoker/mechanics/familiars.js';

test('Altruistic Aspect grants its meditation boon only when selected and the cast commits', () => {
  // Use one meditation with no other boon traits to expose the missing completion hook.
  const run = (traits, interrupted = false) =>
    runElementalist({
      config: {
        specialization: 'Evoker',
        evokerElement: 'Fire',
        autoSummonElemental: false,
        selectedTraitIds: traits,
        selectedSkills: ["Fox's Fury"]
      },
      rotation: [
        {
          type: 'cast',
          skillId: elementalistCatalog.skillsByName.get("Fox's Fury").id,
          ...(interrupted ? { interruptAfterMs: 0 } : {})
        }
      ]
    }).resolvedEvents.filter((event) => event.type === 'buff' && event.kind === 'might');
  const base = run([]);
  const boon = run(['Altruistic Aspect']);
  assert.equal(boon.length, base.length + 1);
  assert.equal(boon.at(-1).stacks, 3);
  assert.equal(boon.at(-1).duration, 10);
  assert.deepEqual(run(['Altruistic Aspect'], true), run([], true));
});

test('Ignite retains its final burning tier until the inactivity window expires', () => {
  // Exercise the familiar state transition independently of weapon recharge and rotation timing.
  const state = evokerState.create();
  const skill = elementalistCatalog.skillsByName.get('Ignite');
  const context = { helpers: elementalistCatalog, profession: { specialization: { kind: 'Evoker', state } } };
  for (const [start, duration] of [
    [0, 2],
    [1, 0.5],
    [2, 1],
    [3, 1.5],
    [4, 1.5],
    [18, 1.5],
    [33, 2]
  ]) {
    const effects = modifyFamiliarEffects(context, { skill, start, id: 'ignite' }, [
      { type: 'condition', condition: 'Burning', duration: 99 }
    ]);
    assert.equal(effects[0].duration, duration);
  }
});

// Queue impacts out of order; only an accepted live strike may spend an active grant.
function enchantments({ hits, grants, timeline = [] }) {
  return runElementalist({
    config: { specialization: 'Evoker', evokerElement: 'Air', autoSummonElemental: false },
    rotation: [{ type: 'wait', durationMs: 2000 }, '__combat_start', { type: 'wait', durationMs: 20000 }],
    initialize: (r) => {
      for (const [at, fields = {}] of hits)
        emitElementalistDamage(r, {
          at,
          sourceId: 42,
          skillId: 42,
          skillName: 'Fixture',
          actorType: 'player',
          coefficient: 1,
          skillWeapon: 'Unequipped',
          ...fields
        });
    },
    timeline: [
      ...grants.map(([at, charges, duration]) => ({
        at,
        priority: -30,
        run: (r) => grantElectricEnchantments(evokerState.from(r), at, charges, duration)
      })),
      ...timeline
    ]
  });
}

const enchantedHits = (result) =>
  result.resolvedEvents.filter((e) => e.type === 'damage' && e.skillName === 'Electric Enchantment');

test('Electric Enchantment consumes accepted post-grant hits chronologically and only once', () => {
  const result = enchantments({
    hits: [[5], [4], [3], [2.5], [1], [3, { actorType: 'effect' }], [3, { coefficient: 0 }], [3, { offTarget: true }]],
    grants: [[3, 2, 6]]
  });
  assert.deepEqual(
    enchantedHits(result).map((e) => e.at),
    [3, 4]
  );
  assert.equal(
    evokerState.from(observedRuntime(result)).electricEnchantmentGrants.reduce((sum, g) => sum + g.charges, 0),
    0
  );
});

test('Electric Enchantment includes grant time and excludes expiry for queued strikes', () => {
  for (const at of [2.5, 3, 8.999999, 9, 10]) {
    const result = enchantments({ hits: [[at]], grants: [[3, 1, 6]] });
    assert.equal(enchantedHits(result).length, at >= 3 && at < 9 ? 1 : 0);
  }
});

test('Electric Enchantment keeps overlapping grants independent of future queued hits', () => {
  const result = enchantments({
    hits: [[20], [8], [9], [13]],
    grants: [
      [3, 2, 6],
      [7, 2, 6]
    ],
    timeline: [
      {
        at: 8.001,
        run: (r) =>
          assert.deepEqual(
            evokerState.from(r).electricEnchantmentGrants.map((g) => g.charges),
            [1, 2]
          )
      },
      {
        at: 9.001,
        run: (r) =>
          assert.deepEqual(
            evokerState.from(r).electricEnchantmentGrants.map((g) => g.charges),
            [1]
          )
      }
    ]
  });
  assert.deepEqual(
    enchantedHits(result).map((e) => e.at),
    [8, 9]
  );
});

test('Electric Enchantment cannot spend a grant that has not arrived', () => {
  const result = enchantments({
    hits: [[7], [6]],
    grants: [
      [3, 1, 20],
      [7, 1, 1]
    ]
  });
  assert.deepEqual(
    enchantedHits(result).map((e) => e.at),
    [6, 7]
  );
});

test('Electric Enchantment spends the earliest expiry even when the shorter grant arrives later', () => {
  enchantments({
    hits: [[5]],
    grants: [
      [3, 1, 10],
      [4, 1, 6]
    ],
    timeline: [
      {
        at: 5.001,
        run: (r) =>
          assert.deepEqual(
            evokerState.from(r).electricEnchantmentGrants.map((g) => [g.expiresAt, g.charges]),
            [
              [10, 0],
              [13, 1]
            ]
          )
      }
    ]
  });
});

test('Familiar and meditation enchantments cannot enhance a strike after their idle expiry', () => {
  // Minimal native casts verify grant wiring and expiry through actual strike eligibility.
  for (const [skill, duration] of [
    ['Ignite', 6],
    ["Hare's Agility", 10]
  ]) {
    for (const wait of [duration - 1, duration + 1]) {
      const result = runNative({
        lines: [['Fire'], ['Air'], ['Evoker']],
        rotation: [skill, wait * 1000, 'Fire Strike'],
        startAttunement: 'Fire',
        weapons: ['Sword', 'Dagger'],
        evokerElement: 'Fire',
        selectedSkills: {
          Heal: 'Rejuvenate',
          Utility1: "Hare's Agility",
          Utility2: 'Signet of Fire',
          Utility3: 'Arcane Wave',
          Elite: 'Elemental Procession'
        }
      });
      assert.deepEqual(result.warnings, []);
      const attack = result.events.find((event) => event.type === 'damage' && event.skillName === 'Fire Strike');
      assert.equal(
        enchantedHits(result).some((event) => event.at === attack.at),
        wait < duration,
        `${skill}: late strike`
      );
    }
  }
});

test('Elemental Balance reports the same patched duration used for its active window', () => {
  // Two qualifying entries arm the trait; its marker must explain the effective balance profile.
  const state = evokerState.create({ evokerElement: 'Fire' });
  const events = [];
  const context = {
    helpers: applyBalanceProfilePatch(elementalistCatalog, {
      balanceProfiles: {
        [EVOKER_BALANCE_PROFILE_IDS.elementalBalance]: {
          fields: { durationMultiplier: { from: 5, to: 8 } }
        }
      }
    }),
    traits: new Set(['Elemental Balance']),
    profession: { specialization: { kind: 'Evoker', state } },
    emit: (event) => events.push(event)
  };
  for (const at of [1, 2]) {
    onAcceptedEvent(context, { type: 'elementalist.attunement-enter', at, to: 'Fire' });
  }

  assert.equal(state.elementalBalanceUntil, 10);
  assert.equal(events.find((event) => event.name === 'Elemental Balance').detail, 'CDR armed (8s)');
});

test('Evoker mechanics execute through native hooks', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Lightning Blitz', 4000],
    evokerElement: 'Air',
    initialEvokerCharges: 6,
    initialEvokerEmpowered: 3
  });

  assert.equal(result.planningState.profession.maximumCharges, 6);
  assert.equal(result.planningState.profession.empowered, 0);
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
  assert.equal(result.planningState.profession.charges, 2);
});

test('Fire-specialized Evoker gives Sunspot and Flame Expulsion independent cooldowns', () => {
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
        'Air Attunement',
        // Observe the last delayed explosion without changing any proc's ICD.
        1000
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

  const cooldown = elementalistCatalog.balanceProfilesById.get(EVOKER_BALANCE_PROFILE_IDS.evocation).internalCooldown;

  assert.deepEqual(fire.warnings, []);
  assert.equal(fireEntries.length, 2);
  assert.equal(fireExits.length, 3);
  assert.ok(fireEntries.at(-1).at - fireEntries[0].at < cooldown);
  assert.ok(fireExits.at(-1).at - fireExits[0].at < cooldown);
  assert.equal(procs(fire, 'Sunspot').length, 1);
  assert.equal(procs(fire, 'Flame Expulsion').length, 1);
  // Independent timers allow the first Sunspot while Flame Expulsion is already cooling down.
  assert.ok(procs(fire, 'Sunspot')[0].at - procs(fire, 'Flame Expulsion')[0].at < cooldown);

  const nonFire = simulate('Water');

  assert.equal(procs(nonFire, 'Sunspot').length, attempts(nonFire, 'enter').length);
  assert.equal(procs(nonFire, 'Flame Expulsion').length, attempts(nonFire, 'exit').length);
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

  const cooldown = elementalistCatalog.balanceProfilesById.get(EVOKER_BALANCE_PROFILE_IDS.evocation).internalCooldown;

  assert.deepEqual(result.warnings, []);
  assert.equal(entries.length, 2);
  assert.ok(entries.at(-1).at - entries[0].at < cooldown);
  assert.equal(discharges.length, entries.length);
});

test('Earth-specialized Evoker gives Earthen Blast and Rock Solid independent cooldowns', () => {
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

  const cooldown = elementalistCatalog.balanceProfilesById.get(EVOKER_BALANCE_PROFILE_IDS.evocation).internalCooldown;

  assert.deepEqual(earth.warnings, []);
  assert.equal(entries.length, 2);
  assert.ok(entries.at(-1).at - entries[0].at < cooldown);
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

  assert.equal(result.planningState.profession.maximumCharges, 6);
  assert.ok(charge);
  assert.equal(charge.change, 3);
  assert.equal(result.planningState.profession.charges, 3);
});

test('Specialized Elements familiar casts reduce active weapon recharge', () => {
  const simulate = (traits, alacrity) =>
    runNative({
      lines: [['Fire'], ['Air'], ['Evoker', traits]],
      rotation: ['Flame Uprising', 'Ignite'],
      startAttunement: 'Fire',
      weapons: ['Sword', 'Dagger'],
      evokerElement: 'Fire',
      assumptions: { ...elementalistProfession.createBuildDefaults().assumptions, alacrity }
    });

  for (const alacrity of [false, true]) {
    const baseline = simulate('1-1-1', alacrity);
    const specialized = simulate('1-1-3', alacrity);
    const weaponSkill = elementalistCatalog.skillsByName.get('Flame Uprising');
    const reduction = (gw2BaseRecharge(weaponSkill) * 1000 * 0.1) / GW2_ALACRITY_RECHARGE_RATE;

    assert.deepEqual(baseline.warnings, []);
    assert.deepEqual(specialized.warnings, []);
    assert.ok(
      Math.abs(
        baseline.planningState.cooldowns['Flame Uprising'].readyAt -
          specialized.planningState.cooldowns['Flame Uprising'].readyAt -
          reduction
      ) < 1e-6
    );
  }
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
  assert.equal(result.planningState.profession.charges, 0);
  assert.equal(result.planningState.profession.empowered, 1);
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
  const air = result.events.find((event) => event.type === 'elementalist.attunement' && event.to === 'Air');
  assert.ok(fire.at >= dazing.endsAt);
  assert.equal(fire.at, Math.ceil((air.at + 1.5 / 1.25) * 25) / 25);
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

test('Evoker does not award a completed parent charge grant twice', () => {
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
  assert.equal(result.planningState.profession.charges, 0);
  assert.equal(result.planningState.profession.empowered, 1);
});

test('Evoker spends a completed Rejuvenate refill only once', () => {
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
  assert.equal(result.planningState.profession.charges, 0);
  assert.equal(result.planningState.profession.empowered, 1);
});

test('Evoker queues early familiar inputs only when pending charges can make them available', () => {
  // A pending resource grant can unblock the input; existing charges still permit a real overlap.
  for (const initialEvokerCharges of [3, 4, 6]) {
    const result = runNative({
      lines: [['Fire'], ['Air'], ['Evoker']],
      rotation: ['Sand Squall', { type: 'cast', skillId: 77226, concurrentOffsetMs: 100 }],
      startAttunement: 'Earth',
      weapons: ['Pistol', 'Warhorn'],
      evokerElement: 'Earth',
      initialEvokerCharges
    });
    const parent = result.events.find((event) => event.type === 'action' && event.skillName === 'Sand Squall');
    const familiar = result.events.find((event) => event.type === 'action' && event.skillName === 'Calcify');
    if (initialEvokerCharges === 3) {
      assert.equal(familiar, undefined);
      assert.match(result.warnings.join('\n'), /requires 6 charges/);
    } else {
      assert.deepEqual(result.warnings, []);
      if (initialEvokerCharges === 4) {
        assert.equal(familiar.at, parent.endsAt);
        assert.equal(result.planningState.profession.charges, 0);
      } else {
        assert.ok(familiar.at < parent.endsAt);
        assert.equal(result.planningState.profession.charges, 2);
      }
    }
  }
});

test('Elemental Procession uses familiar weapon strength and lets Buoyant Deluge trigger Lightning Rod', () => {
  const result = runNative({
    lines: [['Fire'], ['Air', '1-1-3'], ['Evoker']],
    rotation: ['Elemental Procession', 4000],
    evokerElement: 'Earth',
    selectedSkills: {
      Heal: 'Rejuvenate',
      Utility1: "Fox's Fury",
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Elemental Procession'
    }
  });
  const processionStrikes = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.triggeredBy === 'Elemental Procession'
  );
  const otterControl = result.events.find((event) => event.type === 'control' && event.skillName === 'Buoyant Deluge');

  assert.deepEqual(result.warnings, []);
  assert.ok(processionStrikes.length > 0);
  assert.ok(processionStrikes.every((event) => event.weaponStrengthProfileId === 'nonweapon.profession-mechanic'));
  assert.ok(otterControl);
  assert.equal(
    result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillName === 'Lightning Rod' && event.at === otterControl.at
    ).length,
    1
  );
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
  assert.equal(result.planningState.profession.charges, 0);
});

test('Evoker familiar grants enchant only hits at or after the grant', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Charged Strike', 'Polaric Slash', 'Zap', 'Call Lightning', 1000],
    startAttunement: 'Air',
    weapons: ['Sword', 'Dagger'],
    evokerElement: 'Air',
    initialEvokerCharges: 6
  });
  const enchantments = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Electric Enchantment'
  );
  const grant = result.events.find(
    (event) => event.type === 'proc' && event.source === 'Electric Enchantment' && event.detail?.startsWith('+')
  );

  assert.deepEqual(result.warnings, []);
  assert.ok(grant);
  assert.ok(enchantments.length > 0);
  assert.ok(enchantments.every((event) => event.at >= grant.at));
});

test("Hare's Agility cannot spend new charges on pre-grant strikes", () => {
  // A late meditation cannot change earlier damage or spend charges against combat history.
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker']],
    rotation: ['Fire Strike', 5000, "Hare's Agility"],
    startAttunement: 'Fire',
    weapons: ['Sword', 'Dagger'],
    evokerElement: 'Fire',
    selectedSkills: {
      Heal: 'Rejuvenate',
      Utility1: "Hare's Agility",
      Utility2: 'Signet of Fire',
      Utility3: 'Arcane Wave',
      Elite: 'Elemental Procession'
    }
  });

  assert.deepEqual(result.warnings, []);
  const grant = result.events.find(
    (event) => event.type === 'proc' && event.source === 'Electric Enchantment' && event.detail?.startsWith('+')
  );
  const enchantments = result.resolvedEvents.filter(
    (event) => ['damage', 'condition'].includes(event.type) && event.skillName === 'Electric Enchantment'
  );
  assert.ok(grant);
  assert.ok(enchantments.length > 0);
  assert.ok(enchantments.every((event) => event.at >= grant.at));
});

test('Specialized Elements forces and locks the selected attunement', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Evoker', '1-1-3']],
    rotation: ['Fire Attunement'],
    startAttunement: 'Fire',
    evokerElement: 'Air'
  });

  assert.equal(result.planningState.profession.primaryAttunement, 'Air');
  assert.equal(result.planningState.profession.maximumCharges, 6);
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
