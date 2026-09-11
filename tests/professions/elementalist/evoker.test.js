import assert from 'node:assert/strict';
import test from 'node:test';
import { runNative } from '../../helpers/elementalist-simulation.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/catalog.js';
import {
  createEvokerState,
  grantElectricEnchantments
} from '#gw2/professions/elementalist/specializations/evoker/state.js';
import { onEventScheduled } from '#gw2/professions/elementalist/specializations/evoker/mechanics/event-handlers.js';
import { applyElectricEnchantmentsRetrospectively } from '#gw2/professions/elementalist/specializations/evoker/mechanics/enchantments.js';
import { EVOKER_BALANCE_PROFILE_IDS } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';

// Exercise real event observers, including immutable replacement and reentrant proc emission.
function enchantmentHarness() {
  const state = createEvokerState({ evokerElement: 'Air' });
  const events = [];
  const context = {
    catalog: elementalistCatalog,
    profession: { id: 'elementalist' },
    state: { time: 3, profession: { specialization: { kind: 'Evoker', state } } },
    combatStartTime: 2,
    effectiveEnd: 3,
    epsilon: 1e-6,
    events,
    eventByOrder: (order) => events.find((event) => event.eventOrder === order),
    replaceEvent(event, updates) {
      const index = events.findIndex((candidate) => candidate.eventOrder === event.eventOrder);
      return (events[index] = { ...events[index], ...updates });
    },
    emit(event) {
      const scheduled = { ...event, eventOrder: events.length };
      events.push(scheduled);
      onEventScheduled(context, scheduled);
      return scheduled;
    },
    emitDerived(cause, event) {
      assert.equal(context.eventByOrder(cause.eventOrder).electricEnchantmentConsumed, true);
      return context.emit({ ...event, activationId: cause.activationId });
    }
  };
  const hit = (at, fields = {}) =>
    context.emit({
      type: 'damage',
      actorType: 'player',
      coefficient: 1,
      skillId: 42,
      activationId: 'hit',
      at,
      ...fields
    });
  return { state, context, events, hit };
}

test('Electric Enchantment consumes queued post-grant hits chronologically and only once', () => {
  // Immutable replacement leaves stale references behind; neither traversal may spend the same hit twice.
  const { state, context, events, hit } = enchantmentHarness();
  const later = hit(4);
  const earlier = hit(3);
  const preGrant = hit(2.5);
  const precombat = hit(1);
  const summon = hit(3, { actorType: 'summon' });
  const zero = hit(3, { coefficient: 0 });
  grantElectricEnchantments(state, context.effectiveEnd, 1, 6);
  applyElectricEnchantmentsRetrospectively(context, state);
  assert.equal(state.electricEnchantmentStacks, 0);
  assert.equal(context.eventByOrder(earlier.eventOrder).electricEnchantmentConsumed, true);
  for (const event of [later, preGrant, precombat, summon, zero]) {
    assert.notEqual(context.eventByOrder(event.eventOrder).electricEnchantmentConsumed, true);
  }

  grantElectricEnchantments(state, context.effectiveEnd, 2, 6);
  onEventScheduled(context, earlier);
  assert.equal(state.electricEnchantmentStacks, 2);
  applyElectricEnchantmentsRetrospectively(context, state);
  applyElectricEnchantmentsRetrospectively(context, state);
  assert.equal(state.electricEnchantmentStacks, 1);
  // A subsequently scheduled strike consumes the remaining charge exactly once.
  const forward = hit(5);
  assert.equal(context.eventByOrder(forward.eventOrder).electricEnchantmentConsumed, true);
  assert.equal(state.electricEnchantmentStacks, 0);
  onEventScheduled(context, forward);
  assert.equal(state.electricEnchantmentStacks, 0);
  const payloads = events.filter((event) => event.source === 'Electric Enchantment');
  assert.equal(payloads.length, 9);
  for (const event of payloads) {
    assert.ok(event.at >= context.effectiveEnd);
    assert.equal(event.sourceId, 42);
    assert.equal(event.actorType, 'effect');
    if (event.type !== 'proc') {
      assert.equal(event.ownerActorType, 'player');
      assert.equal(event.activationId, 'hit');
    }
  }
});

test('Electric Enchantment enforces each grant window for queued and subsequently scheduled strikes', () => {
  // Both scheduling paths share the same inclusive grant and exclusive expiry boundaries.
  for (const queued of [false, true]) {
    for (const at of [2.5, 3, 8.999, 9, 10]) {
      const { state, context, hit } = enchantmentHarness();
      let strike;
      if (queued) strike = hit(at);
      grantElectricEnchantments(state, 3, 1, 6);
      if (queued) applyElectricEnchantmentsRetrospectively(context, state);
      else strike = hit(at);
      assert.equal(context.eventByOrder(strike.eventOrder).electricEnchantmentConsumed === true, at >= 3 && at < 9);
    }
  }
});

test('Electric Enchantment keeps overlapping grants independent and preserves charges when queuing expired hits', () => {
  const { state, context, hit } = enchantmentHarness();
  grantElectricEnchantments(state, 3, 2, 6);
  grantElectricEnchantments(state, 7, 2, 6);
  context.state.time = 7;
  // A far-future packet cannot discard charges needed by a subsequently scheduled earlier hit.
  const future = hit(20);
  assert.notEqual(context.eventByOrder(future.eventOrder).electricEnchantmentConsumed, true);
  hit(8);
  assert.deepEqual(
    state.electricEnchantmentGrants.map((grant) => grant.stacks),
    [1, 2]
  );
  context.state.time = 9;
  hit(9);
  assert.deepEqual(state.electricEnchantmentGrants, [{ at: 7, expiresAt: 13, stacks: 1 }]);
  context.state.time = 13;
  const expired = hit(13);
  assert.notEqual(context.eventByOrder(expired.eventOrder).electricEnchantmentConsumed, true);
  assert.equal(state.electricEnchantmentStacks, 0);
});

test('Electric Enchantment spends the earliest expiry even when the shorter grant arrives later', () => {
  const { state, hit } = enchantmentHarness();
  grantElectricEnchantments(state, 3, 1, 10);
  grantElectricEnchantments(state, 4, 1, 6);
  hit(5);
  assert.deepEqual(
    state.electricEnchantmentGrants.map((grant) => [grant.expiresAt, grant.stacks]),
    [
      [10, 0],
      [13, 1]
    ]
  );
});

test('Familiar and meditation enchantments expire during idle time and cannot enhance a late strike', () => {
  // Minimal native casts verify grant wiring and end-state cleanup without a saved rotation regression.
  for (const [skill, duration] of [
    ['Ignite', 6],
    ["Hare's Agility", 10]
  ]) {
    for (const wait of [duration - 1, duration + 1]) {
      for (const strike of [false, true]) {
        const result = runNative({
          lines: [['Fire'], ['Air'], ['Evoker']],
          rotation: [skill, wait * 1000, ...(strike ? ['Fire Strike'] : [])],
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
        if (strike) {
          const attack = result.events.find((event) => event.type === 'damage' && event.skillName === 'Fire Strike');
          assert.equal(attack.electricEnchantmentConsumed === true, wait < duration, `${skill}: late strike`);
        } else {
          assert.equal(
            result.endState.profession.electricEnchantmentStacks > 0,
            wait < duration,
            `${skill}: idle expiry`
          );
        }
      }
    }
  }
});

test('Elemental Balance reports the same patched duration used for its active window', () => {
  // Two qualifying entries arm the trait; its marker must explain the effective balance profile.
  const state = createEvokerState({ evokerElement: 'Fire' });
  const events = [];
  const context = {
    catalog: applyBalanceProfilePatch(elementalistCatalog, {
      balanceProfiles: {
        [EVOKER_BALANCE_PROFILE_IDS.elementalBalance]: {
          fields: { durationMultiplier: { from: 5, to: 8 } }
        }
      }
    }),
    traits: new Set(['Elemental Balance']),
    state: { profession: { specialization: { kind: 'Evoker', state } } },
    emit: (event) => events.push(event)
  };
  for (const at of [1, 2]) {
    onEventScheduled(context, { type: 'elementalist.attunement-enter', at, to: 'Fire' });
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
  // The basic familiar removes a fraction of the weapon's full recharge.
  const weapon = baseline.events.find((event) => event.type === 'action' && event.skillName === 'Flame Uprising');
  const reduction = (weapon.rechargeReadyAt - weapon.endsAt) * 1000 * 0.1;
  assert.ok(
    Math.abs(
      baseline.endState.cooldowns['Flame Uprising'].readyAt -
        specialized.endState.cooldowns['Flame Uprising'].readyAt -
        reduction
    ) < 1e-6
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
  assert.equal(result.endState.profession.charges, 0);
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
  // The meditation's own strike may consume one charge at the grant boundary.
  assert.equal(result.endState.profession.electricEnchantmentStacks, 4);
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
