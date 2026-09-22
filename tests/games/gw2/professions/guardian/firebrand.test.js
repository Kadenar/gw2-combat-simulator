import assert from 'node:assert/strict';
import test from 'node:test';
import { timelineWeaponRows } from '#gw2/app/rotation/timeline/model.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { guardianCatalog, guardianProfession } from '#gw2/professions/guardian/profession.js';
import { createGuardianCoreState } from '#gw2/professions/guardian/core/state.js';
import { reactToSymbolOfIgnition } from '#gw2/professions/guardian/core/traits/index.js';
import { FIREBRAND_BALANCE_PROFILE_IDS } from '#gw2/professions/guardian/specializations/firebrand/profiles.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import {
  createFirebrandState,
  FIREBRAND_PUBLIC_STATE_PROJECTION
} from '#gw2/professions/guardian/specializations/firebrand/state.js';
import { projectPublicProfessionState } from '#gw2/platform/engine/profession/state.js';

const config = {
  stats: {
    power: 2000,
    precision: 1000,
    ferocity: 0,
    conditionDamage: 1000,
    vitality: 1000
  },
  target: { armor: 2597 }
};

test('Firebrand public projections preserve configured pages and detach the canonical Ashes grant', () => {
  // Public consumers read the canonical grant without sharing mutable runtime state.
  const state = createFirebrandState({ initialTomePages: 2, maximumTomePages: 8 });
  const { keys, defaults } = FIREBRAND_PUBLIC_STATE_PROJECTION;
  const projected = projectPublicProfessionState(state, keys, defaults);
  assert.equal(projected.tomePages, 2);
  assert.equal(projected.maximumTomePages, 8);
  assert.equal(defaults.tomePages, 5);
  assert.deepEqual(projected.ashes, state.ashes);
  assert.notEqual(projected.ashes, state.ashes);
});

test('Firebrand tomes consume shared pages and execute tome damage', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Justice',
      'Chapter 1: Searing Spell',
      'Chapter 4: Scorched Aftermath',
      'Epilogue: Ashes of the Just',
      'Stow Tome',
      'True Strike',
      { type: 'wait', durationMs: 6000 }
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      primaryWeapon: 'Mace',
      initialTomePages: 5
    }
  });

  assert.deepEqual(result.warnings, []);
  assert.equal(result.combatState.profession.ashes.charges, 0);
  assert.ok(result.conditionBreakdown.some((row) => row.name === 'Burning'));
  assert.ok(result.conditionBreakdown.some((row) => row.name === 'Bleeding'));
  assert.equal(
    result.procSteps.some((step) => step.skill === 'Ashes of the Just'),
    true
  );
});

test('Scorched Aftermath applies Burning with its field strikes', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Tome of Justice', 'Chapter 4: Scorched Aftermath', { type: 'wait', durationMs: 6000 }],
    config: { ...config, specialization: 'Firebrand' }
  });
  const packets = result.events.filter((event) => event.skillId === GUARDIAN_SKILL_IDS.SCORCHED_AFTERMATH);
  const strikes = packets.filter((event) => event.type === 'damage');
  const burning = packets.filter((event) => event.type === 'condition' && event.condition === 'Burning');

  // Each field strike carries Burning, regardless of the authored pulse count or spacing.
  assert.ok(strikes.length > 1);
  assert.deepEqual(
    burning.map((event) => event.at),
    strikes.map((event) => event.at)
  );
  const field = packets.find((event) => event.type === 'combo_field');
  assert.equal(field.fieldType, 'Fire');
  assert.equal(field.at, strikes[0].at);
  assert.equal(field.expiresAt - field.at, 4);
});

test('Ashes of the Just grants party charges using Firebrand condition stats', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Justice',
      'Epilogue: Ashes of the Just',
      'Stow Tome',
      'True Strike',
      { type: 'wait', durationMs: 3000 }
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      primaryWeapon: 'Mace',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.RADIANT_FIRE],
      allies: { count: 4, strikesPerSecond: 1 }
    }
  });
  const ashesBuff = result.events.find((event) => event.type === 'buff' && event.kind === 'ashes-of-the-just');

  const allyBurns = result.resolvedEvents.filter(
    (event) =>
      event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just' && event.metadata?.triggeredByAlly
  );
  const personalBurns = result.resolvedEvents.filter(
    (event) =>
      event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just' && !event.metadata?.triggeredByAlly
  );

  assert.equal(ashesBuff.resolvedAudience.recipientCount, 5);
  assert.equal(allyBurns.length, ashesBuff.stacks * 4);
  assert.equal(personalBurns.length, 1);
  // Allied charges inherit the owner's Radiant Fire duration modifier too.
  assert.ok(
    [...allyBurns, ...personalBurns].every((event) => Math.abs(event.effectiveDuration - event.duration * 1.2) < 1e-9)
  );

  assert.ok(result.conditionDamage > 0);
});

test('Ashes of the Just cannot trigger before its application event', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'True Strike',
      'Tome of Justice',
      'Epilogue: Ashes of the Just',
      'Stow Tome',
      'Symbol of Faith',
      { type: 'wait', durationMs: 2000 }
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      primaryWeapon: 'Mace',
      initialTomePages: 5
    }
  });
  const ashesAppliedAt = result.events.find(
    (event) => event.type === 'guardian.ashes-granted' && event.skillId === GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST
  ).at;
  const ashes = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just'
  );

  assert.ok(ashes.length > 0);
  assert.ok(ashes.every((event) => event.at >= ashesAppliedAt));
});

test('stowing during a tome page preserves its effects and resource spend without reopening the tome', () => {
  // Stow changes only the bar; the in-flight page must finish and its buff applies before aftercast ends.
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Tome of Justice', 'Epilogue: Ashes of the Just', { name: 'Stow Tome', offset: 100 }],
    config: { ...config, specialization: 'Firebrand', initialTomePages: 5 }
  });
  assert.deepEqual(result.warnings, []);
  const cast = result.events.find((e) => e.type === 'action' && e.skillId === GUARDIAN_SKILL_IDS.ASHES_OF_THE_JUST);
  const granted = result.events.find((e) => e.type === 'guardian.ashes-granted');
  const spent = result.events.find((e) => e.type === 'guardian.tome-page-used');
  assert.equal(cast.interrupted, false);
  assert.ok(granted.at > cast.at && granted.at < cast.endsAt);
  assert.equal(result.planningState.profession.tomePages, 5 - spent.pageCost);
  assert.equal(result.planningState.profession.activeTome, '');
});

test('stowing during the third tome skill preserves its earned Swift Scholar refund', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Justice',
      'Chapter 1: Searing Spell',
      'Chapter 2: Igniting Burst',
      'Epilogue: Ashes of the Just',
      { name: 'Stow Tome', offset: 100 }
    ],
    config: { ...config, specialization: 'Firebrand', initialTomePages: 3 }
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.tomePages, 1);
  assert.equal(result.planningState.profession.activeTome, '');
  assert.equal(result.planningState.profession.swiftScholarCount, 0);
  assert.equal(
    result.events.some((event) => event.type === 'weapon_set' && event.automatic),
    false
  );
});

for (const initialTomePages of [1, 5]) {
  test(`an overlapping mantra refunds pages before the tome cost with ${initialTomePages} initial pages`, () => {
    // Refunds use the still-unspent pool, including its cap, before completion can exhaust the tome.
    const result = simulateGw2({
      profession: guardianProfession,
      rotation: [
        'Flame Rush',
        'Flame Rush',
        { type: 'wait', durationMs: 1000 },
        'Tome of Justice',
        'Chapter 2: Igniting Burst',
        { name: 'Flame Surge', offset: 100 }
      ],
      config: {
        ...config,
        specialization: 'Firebrand',
        initialTomePages,
        selectedTraitIds: [GUARDIAN_TRAIT_IDS.WEIGHTY_TERMS]
      }
    });
    assert.deepEqual(result.warnings, []);
    const cast = result.events.find(
      (event) => event.type === 'action' && event.skillId === GUARDIAN_SKILL_IDS.IGNITING_BURST
    );
    const refund = result.events.find((event) => event.type === 'proc' && event.name === 'Weighty Terms');
    const spent = result.events.find((event) => event.type === 'guardian.tome-page-used');
    assert.ok(refund.at > cast.at && refund.at < cast.endsAt);
    assert.equal(spent.at, cast.endsAt);
    assert.equal(spent.pagesRemaining, Math.min(5, initialTomePages + 2) - spent.pageCost);
    assert.equal(result.planningState.profession.tomePages, spent.pagesRemaining);
    assert.equal(result.planningState.profession.activeTome, 'justice');
    assert.equal(
      result.events.some((event) => event.type === 'weapon_set' && event.automatic),
      false
    );
  });
}

test('later tome pages do not restore consumed Ashes charges', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Justice',
      'Epilogue: Ashes of the Just',
      'Chapter 2: Igniting Burst',
      'Stow Tome',
      'True Strike',
      'Pure Strike',
      'Faithful Strike',
      { type: 'wait', durationMs: 2000 }
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      primaryWeapon: 'Mace',
      allies: { count: 0, strikesPerSecond: 1 }
    }
  });
  const personalBurns = result.resolvedEvents.filter(
    (event) =>
      event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just' && !event.metadata?.triggeredByAlly
  );

  assert.equal(personalBurns.length, 2);
  assert.equal(result.combatState.profession.ashes.charges, 0);
});

test('Firebrand page exhaustion keeps the tome open while pages regenerate', () => {
  const exhausted = simulateGw2({
    profession: guardianProfession,
    rotation: ['Tome of Resolve', 'Epilogue: Eternal Oasis', { type: 'wait', durationMs: 8000 }],
    config: {
      ...config,
      specialization: 'Firebrand',
      initialTomePages: 2
    }
  });
  const traited = simulateGw2({
    profession: guardianProfession,
    rotation: [],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.ARCHIVIST_OF_WHISPERS, GUARDIAN_TRAIT_IDS.LOREMASTER]
    }
  });

  assert.deepEqual(exhausted.warnings, []);
  assert.equal(exhausted.planningState.profession.activeTome, 'resolve');
  assert.equal(exhausted.events.find((event) => event.type === 'guardian.tome-page-used').pagesRemaining, 0);
  assert.equal(exhausted.planningState.profession.tomePages, 1);
  assert.equal(traited.planningState.profession.maximumTomePages, 8);
  assert.equal(traited.planningState.profession.tomePages, 8);
  assert.equal(traited.planningState.profession.tomePageInterval, 5);
});

test('Firebrand page regeneration keeps ticking at capacity after natural recovery or a mantra refund', () => {
  for (const refund of [false, true]) {
    const result = simulateGw2({
      profession: guardianProfession,
      rotation: [
        'Tome of Justice',
        'Chapter 1: Searing Spell',
        'Stow Tome',
        ...(refund ? ['Flame Rush', 'Flame Rush', 'Flame Surge'] : []),
        { type: 'wait', durationMs: 17000 },
        'Tome of Justice',
        'Chapter 1: Searing Spell'
      ],
      config: { ...config, specialization: 'Firebrand', selectedTraitIds: [GUARDIAN_TRAIT_IDS.WEIGHTY_TERMS] }
    });
    assert.deepEqual(result.warnings, []);
    const [first, last] = result.events.filter((event) => event.type === 'guardian.tome-page-used');
    const state = result.planningState.profession;
    // Full-pool ticks advance the original clock without banking extra pages or restarting on the next spend.
    assert.equal(last.pagesRemaining, state.maximumTomePages - last.pageCost);
    assert.equal(last.nextTomePageAt, first.nextTomePageAt + 2 * state.tomePageInterval);
    assert.equal(state.nextTomePageAt, last.nextTomePageAt);
  }
});

test('Firebrand page exhaustion requires an explicit stow before weapon inputs', () => {
  const rotation = ['Tome of Resolve', 'Epilogue: Eternal Oasis', 'True Strike', 'Stow Tome', 'True Strike'];
  const firebrandConfig = {
    ...config,
    specialization: 'Firebrand',
    primaryWeapon: 'Mace',
    initialTomePages: 2
  };
  const result = simulateGw2({
    profession: guardianProfession,
    rotation,
    config: firebrandConfig
  });

  const [blocked, ready] = result.steps.filter((step) => step.skill === 'True Strike');
  assert.ok(blocked.invalid);
  assert.equal(ready.invalid, undefined);
  assert.equal(result.steps.find((step) => step.skill === 'Stow Tome').invalid, undefined);
  assert.equal(result.planningState.profession.activeTome, '');
  assert.equal(result.planningState.profession.swiftScholarCount, 0);
  const transition = guardianProfession.ui.timelineWeaponLineTransition;
  const rows = timelineWeaponRows(rotation, {
    weaponLineTransition(entry, current) {
      const name = typeof entry === 'string' ? entry : entry.name;

      return transition({
        entry: { name },
        skill: guardianCatalog.skillsByName.get(name),
        specialization: 'Firebrand',
        ...current
      });
    }
  });

  assert.deepEqual(
    rows.map((row) => row.weaponLine),
    [null, 'Tome of Resolve', null]
  );
});

test('Firebrand tome page cost waits for a regenerating page', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Resolve',
      // Epilogue: Eternal Oasis costs two pages; starting at one page it must
      // wait for the next scheduled page rather than being discarded.
      'Epilogue: Eternal Oasis'
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      initialTomePages: 1
    }
  });

  const epilogue = result.steps.find((step) => step.skill === 'Epilogue: Eternal Oasis');

  assert.deepEqual(result.warnings, []);
  assert.ok(epilogue && !epilogue.invalid);
  // A missing page delays the cast until the resource's next regeneration tick.
  assert.equal(epilogue.start, result.planningState.profession.tomePageInterval * 1000);
  assert.equal(result.planningState.profession.activeTome, 'resolve');
});

test('Unrelenting Criticism adds Bleeding to each axe hit only while traited', () => {
  const simulate = (selectedTraitIds, primaryWeapon, skill) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: [skill],
      config: { ...config, specialization: 'Firebrand', primaryWeapon, selectedTraitIds }
    });
  const trait = [GUARDIAN_TRAIT_IDS.UNRELENTING_CRITICISM];
  const axe = simulate(trait, 'Axe', 'Core Cleave');
  const procs = (result) =>
    result.events.filter((event) => event.type === 'condition' && event.triggeredBy === 'Unrelenting Criticism');
  const hits = axe.events.filter((event) => event.type === 'damage' && event.skillName === 'Core Cleave');

  // The trait follows qualifying hits; it must not proc for an untraited or non-axe attack.
  assert.ok(hits.length > 0);
  assert.deepEqual(
    procs(axe).map((event) => [event.at, event.condition]),
    hits.map((event) => [event.at, 'Bleeding'])
  );
  assert.deepEqual(procs(simulate([], 'Axe', 'Core Cleave')), []);
  assert.deepEqual(procs(simulate(trait, 'Mace', 'True Strike')), []);
});

test('Cleansing Flame applies Burning on its final strike', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Cleansing Flame'],
    config: { ...config, specialization: 'Firebrand', primaryWeapon: 'Axe', secondaryWeapon: 'Torch' }
  });
  const packets = result.events.filter((event) => event.skillName === 'Cleansing Flame');
  const strikes = packets.filter((event) => event.type === 'damage');
  const burning = packets.filter((event) => event.type === 'condition' && event.condition === 'Burning');

  // Completion carries the condition payload, without pinning the channel's cast time.
  assert.ok(strikes.length > 1);
  assert.deepEqual(
    burning.map((event) => event.at),
    [strikes.at(-1).at]
  );
});

test('Writ of Persistence extends Symbol of Punishment strikes, boons, and field', () => {
  const simulate = (selectedTraitIds) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: ['Symbol of Punishment', { type: 'wait', durationMs: 8000 }],
      config: { ...config, primaryWeapon: 'Scepter', selectedTraitIds }
    });
  const baseline = simulate([]);
  const writ = simulate([GUARDIAN_TRAIT_IDS.WRIT_OF_PERSISTENCE]);
  const packets = (result, type) =>
    result.events.filter((event) => event.skillName === 'Symbol of Punishment' && event.type === type);
  const baseField = packets(baseline, 'combo_field')[0];
  const fields = packets(writ, 'combo_field');

  // The trait adds pulses and continues the original field without a gap.
  assert.ok(packets(baseline, 'damage').length > 0);
  assert.ok(packets(writ, 'damage').length > packets(baseline, 'damage').length);
  assert.ok(packets(writ, 'buff').length > packets(baseline, 'buff').length);
  assert.equal(fields.length, 2);
  assert.equal(fields[0].at, baseField.at);
  assert.equal(fields[0].expiresAt, baseField.expiresAt);
  assert.equal(fields[1].at, fields[0].expiresAt);
  assert.ok(fields[1].expiresAt > baseField.expiresAt);
});

test('Symbol of Ignition burns on other player hits within its active field', () => {
  const simulate = (rotation) =>
    simulateGw2({
      profession: guardianProfession,
      rotation,
      config: { ...config, primaryWeapon: 'Pistol', secondaryWeapon: 'Pistol' }
    });
  const result = simulate(['Symbol of Ignition', 'Peacekeeper', { type: 'wait', durationMs: 6000 }, 'Peacekeeper']);
  const ignitions = (simulation) =>
    simulation.resolvedEvents.filter(
      (event) => event.type === 'condition' && event.skillName === 'Symbol of Ignition' && event.condition === 'Burning'
    );
  const field = result.events.find((event) => event.type === 'guardian.symbol-of-ignition-field');
  const hits = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Peacekeeper');

  // The symbol cannot trigger itself, and hits after its window must not receive its Burning.
  assert.ok(ignitions(result).length > 0);
  assert.ok(hits.some((event) => event.at > field.at + field.duration));
  assert.ok(
    ignitions(result).every(
      (event) =>
        event.at >= field.at && event.at <= field.at + field.duration && hits.some((hit) => hit.at === event.at)
    )
  );
  assert.deepEqual(ignitions(simulate(['Symbol of Ignition', { type: 'wait', durationMs: 6000 }])), []);
});

test('symbol and projectile ignition independently block through 240 ms without triggering themselves', () => {
  // A simultaneous melee/projectile pair may ignite twice; each lane then enforces its own cooldown.
  const core = { ...createGuardianCoreState(), symbolIgnitionStartsAt: 1, symbolIgnitionUntil: 5 };
  const queued = [];
  const context = {
    catalog: guardianCatalog,
    state: { profession: { core } },
    queue: { enqueue: (e) => queued.push(e) }
  };
  const strike = { type: 'damage', actorType: 'player', skillId: GUARDIAN_SKILL_IDS.PEACEKEEPER, coefficient: 1 };
  for (const at of [0.9, 1, 1.239, 1.24, 1.241, 5.001]) {
    for (const projectile of [false, true]) reactToSymbolOfIgnition(context, { ...strike, at, projectile });
  }

  assert.deepEqual(
    queued.map(({ at, projectile }) => [at, projectile]),
    [
      [1, false],
      [1, true],
      [1.241, false],
      [1.241, true]
    ]
  );
  reactToSymbolOfIgnition(context, { ...strike, at: 2, actorType: 'summon' });
  reactToSymbolOfIgnition(context, { ...strike, at: 2, skillId: GUARDIAN_SKILL_IDS.SYMBOL_OF_IGNITION });
  reactToSymbolOfIgnition(context, { ...queued[0], at: 2 });
  reactToSymbolOfIgnition(context, { ...strike, type: 'condition', condition: 'Burning', at: 2 });
  assert.equal(queued.length, 4);
});

test('torch pulses and fire-whirl bolts ignite through the condition application hook', () => {
  // Condition-only pulses must enter the correct lane without converting every Burning application into a trigger.
  for (const whirling of [false, true]) {
    const result = simulateGw2({
      profession: guardianProfession,
      rotation: whirling
        ? ['Purging Flames', 'Symbol of Ignition', 'Whirling Light', { type: 'wait', durationMs: 6000 }]
        : ['Symbol of Ignition', "Zealot's Flame", { type: 'wait', durationMs: 6000 }],
      config: { ...config, specialization: 'Willbender', primaryWeapon: 'Pistol', secondaryWeapon: 'Torch' }
    });
    assert.deepEqual(result.warnings, []);
    const pulses = result.resolvedEvents.filter(
      (event) =>
        event.type === 'condition' &&
        event.condition === 'Burning' &&
        (whirling
          ? event.finisherType === 'Whirl' && event.fieldType === 'Fire'
          : event.skillId === GUARDIAN_SKILL_IDS.ZEALOTS_FLAME)
    );
    const ignitions = result.resolvedEvents.filter(
      (event) =>
        event.type === 'condition' &&
        event.skillId === GUARDIAN_SKILL_IDS.SYMBOL_OF_IGNITION &&
        event.projectile === whirling
    );
    assert.ok(ignitions.length > 0);
    assert.ok(ignitions.every((ignition) => pulses.some((pulse) => pulse.at === ignition.at)));
    if (whirling) {
      // Whirl strikes use the other lane, so a bolt may ignite at the same instant as a strike.
      assert.ok(
        ignitions.some((ignition) =>
          result.resolvedEvents.some(
            (event) =>
              event.type === 'condition' &&
              event.skillId === GUARDIAN_SKILL_IDS.SYMBOL_OF_IGNITION &&
              event.projectile === false &&
              event.at === ignition.at
          )
        )
      );
    }
  }
});

test('Peacekeeper begins recharge when its cast starts', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Peacekeeper', 'Peacekeeper'],
    config: {
      ...config,
      primaryWeapon: 'Pistol',
      secondaryWeapon: 'Pistol',
      boons: { quickness: true, alacrity: true }
    }
  });

  assert.deepEqual(result.warnings, []);
  const casts = result.events.filter((event) => event.type === 'action' && event.skillName === 'Peacekeeper');
  // Recharge is anchored to cast start and scales with Alacrity.
  assert.equal(casts.length, 2);
  assert.equal(casts[1].at - casts[0].at, guardianCatalog.skillsByName.get('Peacekeeper').cooldown / 1.25);
});

test('Signet of Wrath loses its passive condition damage while recharging', () => {
  const throughDamage = (result) =>
    result.breakdown.find((entry) => entry.name.startsWith('Through the Heart') && entry.conditionDamage > 0)
      .conditionDamage;
  const baseConfig = {
    ...config,
    primaryWeapon: 'Pistol',
    secondaryWeapon: 'Pistol'
  };
  const withoutSignet = simulateGw2({
    profession: guardianProfession,
    rotation: ['Through the Heart', { type: 'wait', durationMs: 9000 }],
    config: baseConfig
  });
  const passive = simulateGw2({
    profession: guardianProfession,
    rotation: ['Through the Heart', { type: 'wait', durationMs: 9000 }],
    config: { ...baseConfig, selectedSkills: ['Signet of Wrath'] }
  });
  const recharging = simulateGw2({
    profession: guardianProfession,
    rotation: ['Signet of Wrath', 'Through the Heart', 'Signet of Wrath', { type: 'wait', durationMs: 9000 }],
    config: { ...baseConfig, selectedSkills: ['Signet of Wrath'] }
  });

  assert.ok(throughDamage(passive) > throughDamage(withoutSignet));
  assert.ok(Math.abs(throughDamage(recharging) - throughDamage(withoutSignet)) < 1e-9);
});

test('Firebrand mantras flip to their final charge and rearm after full recharge', () => {
  const solace = guardianCatalog.skillsByName.get('Mantra of Solace');
  const reprieve = guardianCatalog.skillsByName.get('Restoring Reprieve');
  const respite = guardianCatalog.skillsByName.get('Rejuvenating Respite');
  const flame = guardianCatalog.skillsByName.get('Mantra of Flame');
  const rush = guardianCatalog.skillsByName.get('Flame Rush');
  const surge = guardianCatalog.skillsByName.get('Flame Surge');

  assert.equal(reprieve.flipParentId, solace.id);
  assert.equal(respite.flipParentId, reprieve.id);
  assert.equal(rush.flipParentId, flame.id);
  assert.equal(surge.flipParentId, rush.id);

  const normal = simulateGw2({
    profession: guardianProfession,
    rotation: ['Flame Rush'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['Mantra of Flame']
    }
  });

  assert.ok(normal.planningState.profession.availableFlips[rush.id]);
  assert.equal(normal.planningState.profession.availableFlips[surge.id], undefined);
  assert.equal(normal.planningState.ammo['Flame Rush'].charges, 2);

  const final = simulateGw2({
    profession: guardianProfession,
    rotation: ['Flame Rush', 'Flame Rush'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['Mantra of Flame']
    }
  });

  assert.equal(final.planningState.profession.availableFlips[rush.id], undefined);
  assert.ok(final.planningState.profession.availableFlips[surge.id]);

  const depleted = simulateGw2({
    profession: guardianProfession,
    rotation: ['Flame Rush', 'Flame Rush', 'Flame Surge'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['Mantra of Flame']
    }
  });

  assert.equal(depleted.planningState.profession.availableFlips[rush.id], undefined);
  assert.equal(depleted.planningState.profession.availableFlips[surge.id], undefined);
  assert.equal(depleted.planningState.ammo['Flame Rush'], undefined);
  assert.ok(depleted.planningState.cooldowns['Mantra of Flame'].remaining > 0);
  const rechargeReadyAt = depleted.planningState.cooldowns['Mantra of Flame'].readyAt;
  // A queued normal charge waits for the root recharge, which restores the prepared pool.
  const rearmed = simulateGw2({
    profession: guardianProfession,
    rotation: ['Flame Rush', 'Flame Rush', 'Flame Surge', 'Flame Rush'],
    config: { ...config, specialization: 'Firebrand', selectedSkills: ['Mantra of Flame'] }
  });
  assert.deepEqual(rearmed.warnings, []);
  assert.equal(rearmed.steps.at(-1).start, rechargeReadyAt);
  assert.equal(rearmed.planningState.ammo['Flame Rush'].charges, normal.planningState.ammo['Flame Rush'].charges);
  assert.ok(rearmed.planningState.profession.availableFlips[rush.id]);
});

test('mantra charge cooldowns carry across the final flip and scale with Alacrity', () => {
  // Both transitions spend the same short cooldown, independently of ammo regeneration.
  for (const alacrity of [false, true]) {
    for (const [root, normal, final] of [
      ['Mantra of Flame', 'Flame Rush', 'Flame Surge'],
      ['Mantra of Solace', 'Restoring Reprieve', 'Rejuvenating Respite'],
      ['Mantra of Potence', 'Potent Haste', 'Overwhelming Celerity'],
      ['Mantra of Liberation', 'Portent of Freedom', 'Unhindered Delivery']
    ]) {
      const result = simulateGw2({
        profession: guardianProfession,
        rotation: [normal, normal, final],
        config: { ...config, specialization: 'Firebrand', selectedSkills: [root], boons: { alacrity } }
      });
      assert.deepEqual(result.warnings, []);
      const cooldown = alacrity ? 800 : 1000;
      const starts = result.steps.map((step) => step.start);
      assert.deepEqual(starts, [0, cooldown, cooldown * 2]);
    }
  }
});

test('Tome of Justice applies Amplified Wrath once before the condition duration cap', () => {
  for (const amplifiedWrath of [false, true]) {
    const result = simulateGw2({
      profession: guardianProfession,
      rotation: ['Peacekeeper', { type: 'wait', durationMs: 3000 }],
      config: {
        ...config,
        specialization: 'Firebrand',
        primaryWeapon: 'Pistol',
        secondaryWeapon: 'Pistol',
        stats: { ...config.stats, expertise: 1500 },
        selectedTraitIds: amplifiedWrath ? [GUARDIAN_TRAIT_IDS.AMPLIFIED_WRATH] : []
      }
    });
    // Expertise doubles the base duration; the trait's separate multiplier must not be baked in twice.
    const passive = result.resolvedEvents.find((event) => event.sourceId === 'guardian.justice-passive');
    assert.equal(passive.effectiveDuration, amplifiedWrath ? 2.4 : 2);
  }
});

test('Firebrand tome transitions are weapon swaps and timeline row changes', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Tome of Justice', 'Stow Tome', 'Tome of Resolve', 'Stow Tome'],
    config: { ...config, specialization: 'Firebrand' }
  });

  assert.deepEqual(
    result.events.filter((event) => event.type === 'weapon_set').map((event) => event.skillName),
    ['Tome of Justice', 'Stow Tome', 'Tome of Resolve', 'Stow Tome']
  );

  const transition = guardianProfession.ui.timelineWeaponLineTransition;
  const rotation = [
    'Tome of Justice',
    'Chapter 1: Searing Spell',
    'Stow Tome',
    'True Strike',
    'Tome of Resolve',
    'Stow Tome'
  ];
  const rows = timelineWeaponRows(rotation, {
    startingWeaponSet: 1,
    weaponLineTransition(entry, current) {
      const name = typeof entry === 'string' ? entry : entry.name;

      return transition({
        entry: { name },
        skill: guardianCatalog.skillsByName.get(name),
        specialization: 'Firebrand',
        ...current
      });
    }
  });

  assert.deepEqual(
    rows.map((row) => row.weaponLine),
    [null, 'Tome of Justice', null, 'Tome of Resolve']
  );
  assert.deepEqual(
    rows.map((row) => row.skills.map((skill) => skill.index)),
    [[0], [1, 2], [3, 4], [5]]
  );
});

test('Firebrand tome swaps share sigil cooldowns and require combat', () => {
  // Opening and stowing use the equipped sigil set; immediate follow-up transitions cannot bypass its cooldown.
  for (const inCombat of [false, true]) {
    const result = simulateGw2({
      profession: guardianProfession,
      rotation: [
        ...(inCombat ? ['__combat_start'] : []),
        'Tome of Justice',
        { type: 'wait', durationMs: 10000 },
        'Stow Tome',
        'Tome of Resolve',
        'Stow Tome'
      ],
      config: {
        ...config,
        specialization: 'Firebrand',
        sigilSets: [{ names: ['Hydromancy'] }, { names: ['Geomancy'] }]
      }
    });
    assert.deepEqual(result.warnings, []);
    const procs = result.procSteps.filter((step) => step.type === 'sigil_proc');
    assert.deepEqual(
      procs.map((step) => [step.skill, step.sourceSkill]),
      inCombat
        ? [
            ['Sigil of Hydromancy', 'Tome of Justice'],
            ['Sigil of Hydromancy', 'Stow Tome']
          ]
        : []
    );
    assert.ok(result.events.filter((event) => event.type === 'weapon_set').every((event) => event.weaponSet === 1));
  }
});

test('Feel My Wrath splits party and self quickness and triggers Quickfire', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['"Feel My Wrath!"', '"Feel My Wrath!"', { type: 'wait', durationMs: 2000 }],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['"Feel My Wrath!"'],
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.QUICKFIRE],
      boons: { quickness: true },
      allies: { count: 1, strikesPerSecond: 1 }
    }
  });
  const quickness = result.events.filter(
    (event) => event.type === 'buff' && event.skillName === '"Feel My Wrath!"' && event.kind === 'quickness'
  );

  assert.deepEqual(
    quickness.map((event) => event.resolvedAudience.alliedPlayerCount),
    [1, 0, 1, 0]
  );

  assert.equal(
    result.resolvedEvents.filter((event) => event.skillName === 'Quickfire' && event.metadata?.triggeredByAlly === 1)
      .length,
    2
  );
});

test('Quickfire grants one Ashes charge to a self-only quickness recipient', () => {
  const result = simulateGw2({
    profession: guardianProfession,
    rotation: ['Tome of Justice', 'Chapter 2: Igniting Burst', { type: 'wait', durationMs: 3000 }],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.QUICKFIRE],
      allies: { count: 0, strikesPerSecond: 0 }
    }
  });
  const quickfireBurns = result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just'
  );

  assert.equal(result.procSteps.filter((step) => step.skill === 'Quickfire').length, 1);
  assert.equal(quickfireBurns.length, 1);
  assert.equal(quickfireBurns[0].metadata?.triggeredByAlly, undefined);
});

test('dormant Tome equips preserve recharge and do not trigger virtue traits', () => {
  const simulate = (rotation) =>
    simulateGw2({
      profession: guardianProfession,
      rotation,
      config: {
        ...config,
        specialization: 'Firebrand',
        selectedTraitIds: [GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS, GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE]
      }
    });
  const readyAt = simulate(['Tome of Justice']).combatState.profession.virtueReadyAt.justice;
  const result = simulate([
    'Tome of Justice',
    'Stow Tome',
    { type: 'wait', durationMs: readyAt * 500 },
    'Tome of Justice',
    'Stow Tome',
    { type: 'wait', durationMs: readyAt * 500 },
    'Tome of Justice'
  ]);
  const activations = result.events.filter((event) => event.type === 'guardian.firebrand-virtue-activated');

  // Reopening halfway through dormancy keeps the original deadline; reopening at expiry rearms traits.
  assert.deepEqual(
    activations.map((event) => event.passiveReadyAt),
    [readyAt, readyAt, readyAt * 2]
  );
  assert.deepEqual(
    result.procSteps.filter((step) => step.skill === 'Lesser Symbol of Blades').map((step) => step.start),
    [0, readyAt * 1000]
  );
  assert.equal(
    result.events.filter(
      (event) => event.type === 'buff' && event.skillName === 'Tome of Justice' && event.kind === 'quickness'
    ).length,
    2
  );
  assert.equal(
    result.events.filter((event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE)
      .length,
    2
  );
  assert.equal(result.combatState.profession.virtueReadyAt.justice, readyAt * 2);
  assert.deepEqual(result.warnings, []);
});

test('Power of the Virtuous reduces each Tome dormancy duration', () => {
  const simulate = (selectedTraitIds) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: ['Tome of Justice', 'Stow Tome', 'Tome of Resolve', 'Stow Tome', 'Tome of Courage'],
      config: { ...config, specialization: 'Firebrand', selectedTraitIds }
    });
  const baseline = simulate([]).planningState.profession.tomeDormantReadyAt;
  const traited = simulate([GUARDIAN_TRAIT_IDS.POWER_OF_THE_VIRTUOUS]).planningState.profession.tomeDormantReadyAt;

  // Apply the trait multiplier to each tome's own dormancy, not a copied cooldown table.
  for (const virtue of ['justice', 'resolve', 'courage']) {
    assert.equal(traited[virtue], baseline[virtue] * 0.85);
  }
});

test('Firebrand specialization traits drive pages, quickness, and tome bonuses', () => {
  const lore = simulateGw2({
    profession: guardianProfession,
    rotation: [
      'Tome of Justice',
      'Chapter 1: Searing Spell',
      'Chapter 2: Igniting Burst',
      'Chapter 3: Heated Rebuke',
      'Stow Tome',
      'Tome of Justice'
    ],
    config: {
      ...config,
      specialization: 'Firebrand',
      initialTomePages: 5,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.LEGENDARY_LORE]
    }
  });

  assert.equal(lore.planningState.profession.tomePages, 3);
  assert.equal(
    lore.events.filter(
      (event) => event.type === 'buff' && event.skillName === 'Tome of Justice' && event.kind === 'quickness'
    ).length,
    1
  );
  assert.equal(
    lore.events.filter(
      (event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.LEGENDARY_LORE && event.kind === 'might'
    ).length,
    3
  );
  assert.ok(
    lore.events
      .filter((event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.LEGENDARY_LORE)
      .every((event) => event.stacks === 2 && event.duration === 10)
  );

  const weighted = simulateGw2({
    profession: guardianProfession,
    rotation: ['Potent Haste', 'Potent Haste', 'Overwhelming Celerity'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['Mantra of Potence'],
      initialTomePages: 1,
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.WEIGHTY_TERMS]
    }
  });

  assert.deepEqual(weighted.warnings, []);
  assert.equal(weighted.planningState.profession.tomePages, 3);
  assert.deepEqual(
    weighted.resolvedEvents
      .filter((event) => event.type === 'condition' && event.sourceId === GUARDIAN_TRAIT_IDS.WEIGHTY_TERMS)
      .map((event) => [event.condition, event.duration]),
    [['Slow', 1.5]]
  );

  const liberated = simulateGw2({
    profession: guardianProfession,
    rotation: ['Shelter'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedSkills: ['Shelter'],
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.LIBERATORS_VOW]
    }
  });

  assert.equal(
    liberated.events.some(
      (event) =>
        event.type === 'buff' &&
        event.kind === 'quickness' &&
        event.sourceId === GUARDIAN_SKILL_IDS.SHELTER &&
        event.duration === 2
    ),
    true
  );
});

test('Firebrand grandmaster support traits react to boons and control', () => {
  const quickfire = simulateGw2({
    profession: guardianProfession,
    rotation: ['Tome of Courage', 'Epilogue: Unbroken Lines', { type: 'wait', durationMs: 2000 }],
    config: {
      ...config,
      specialization: 'Firebrand',
      maximumTomePages: 8,
      initialTomePages: 8,
      allies: { count: 1, strikesPerSecond: 1 },
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.STALWART_SPEED, GUARDIAN_TRAIT_IDS.QUICKFIRE]
    }
  });

  assert.equal(
    quickfire.procSteps.some((step) => step.skill === 'Stalwart Speed'),
    true
  );
  assert.equal(
    quickfire.procSteps.some((step) => step.skill === 'Quickfire'),
    true
  );
  const stoic = simulateGw2({
    profession: guardianProfession,
    rotation: ['Tome of Courage', 'Chapter 2: Daring Challenge'],
    config: {
      ...config,
      specialization: 'Firebrand',
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR]
    }
  });
  const stoicBuffs = stoic.events.filter(
    (event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.STOIC_DEMEANOR
  );

  assert.deepEqual(
    stoicBuffs.map((event) => [event.kind, event.stacks, event.duration]),
    [
      ['resistance', 1, 2],
      ['might', 3, 10]
    ]
  );
});

test('Firebrand dormant passives and Imbued Haste use timeline state', () => {
  const passive = simulateGw2({
    profession: guardianProfession,
    rotation: ['Whirling Wrath', { type: 'wait', durationMs: 80000 }],
    config: {
      ...config,
      specialization: 'Firebrand',
      primaryWeapon: 'Greatsword'
    }
  });

  assert.ok(passive.combatState.profession.justicePassiveBurns > 0);
  assert.equal(
    passive.resolvedEvents
      .filter((event) => event.sourceId === 'guardian.justice-passive')
      .every((event) => event.skillId === GUARDIAN_SKILL_IDS.TOME_OF_JUSTICE && event.skillName === 'Tome of Justice'),
    true
  );
  const aegis = passive.events.filter(
    (event) => event.type === 'buff' && event.skillId === GUARDIAN_SKILL_IDS.TOME_OF_COURAGE && event.kind === 'aegis'
  );
  const interval = guardianCatalog.balanceProfilesById.get(FIREBRAND_BALANCE_PROFILE_IDS.passiveCourage).pulseInterval;
  assert.ok(aegis.length > 1);
  assert.equal(aegis[0].at, 0);
  assert.ok(aegis.slice(1).every((event, index) => event.at - aegis[index].at === interval));

  const tome = (selectedTraitIds) =>
    simulateGw2({
      profession: guardianProfession,
      rotation: ['Tome of Justice', 'Chapter 1: Searing Spell', { type: 'wait', durationMs: 3000 }],
      config: {
        ...config,
        specialization: 'Firebrand',
        selectedTraitIds
      }
    });
  const normal = tome([]);
  const imbued = tome([GUARDIAN_TRAIT_IDS.IMBUED_HASTE]);

  assert.ok(imbued.conditionDamage > normal.conditionDamage);
});
