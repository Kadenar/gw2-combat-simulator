import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { gw2Time } from '#gw2/platform/combat/clock.js';
import { guardianCoreModule } from '#gw2/professions/guardian/core/module.js';
import { bindGuardianCoreUi } from '#gw2/professions/guardian/core/presentation.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { guardianCatalog, guardianProfession } from '#gw2/professions/guardian/profession.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import {
  createObservedProfessionSimulator,
  observedRuntime,
  projectObservedState
} from '#tests/helpers/observed-runtime.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';

const guardianCoreUi = bindGuardianCoreUi(guardianCatalog);

// Attribute assertions use the same calculator composed into the Guardian adapter.

const config = {
  attributeInputs: baseAttributeInputs({
    power: 2000,
    precision: 1000,
    ferocity: 0,
    conditionDamage: 1000,
    vitality: 1000
  }),
  target: { armor: 2597 }
};

test('Empowering Might requires player critical strikes and shares the one-second ICD boundary', () => {
  // Ineligible hits cannot consume readiness; hits within the ICD cannot grant extra party Might.
  for (const [traited, precision, concentration] of [
    [false, 3000, 0],
    [true, 0, 0],
    [true, 3000, 0],
    [true, 3000, 750]
  ]) {
    const result = runGuardian(
      [{ type: 'wait', durationMs: 2500 }],
      {
        selectedTraitIds: traited ? [GUARDIAN_TRAIT_IDS.EMPOWERING_MIGHT] : [],
        attributeInputs: baseAttributeInputs({
          ...config.attributeInputs?.weaponSets[0].commonTotals,
          precision,
          concentration
        }),
        allies: { count: 4 }
      },
      {
        initialize: (runtime) => {
          for (const [at, overrides] of [
            [0.1, { canCrit: false }],
            [0.2, { actorType: 'effect' }],
            [0.3, { offTarget: true }],
            [0.4, { coefficient: 0 }],
            [1, {}],
            [1, {}],
            [1.999, {}],
            [2, {}],
            [2.000001, {}]
          ])
            runtime.effects.emit({
              kind: 'packet',
              event: {
                type: 'damage',
                source: 'guardian',
                sourceId: GUARDIAN_SKILL_IDS.ORB_OF_WRATH,
                skillId: GUARDIAN_SKILL_IDS.ORB_OF_WRATH,
                skillName: 'Orb of Wrath',
                actorType: 'player',
                coefficient: 1,
                at,
                ...overrides
              }
            });
        }
      }
    );
    const might = result.resolvedEvents.filter(
      (event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.EMPOWERING_MIGHT
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      might.map((event) => [event.at, event.kind, event.stacks, event.duration]),
      traited && precision > 0
        ? [
            [1, 'might', 1, concentration ? 12 : 8],
            [2.04, 'might', 1, concentration ? 12 : 8]
          ]
        : []
    );
    for (const event of might) {
      assert.equal(event.resolvedAudience.includesSelf, true);
      assert.equal(event.resolvedAudience.alliedPlayerCount, 4);
    }
  }
});

test('Guardian planning projections detach visible resources and entitlement from the live state', () => {
  // Public planning data stays detached from the live state owner.
  const result = runGuardian(['Virtue of Justice', 'Orb of Wrath']);
  const runtime = observedRuntime(result);
  assert.equal(runtime.profession.core.justiceActiveArmed, false);
  assert.equal(result.planningState.profession[STATE.JUSTICE_ACTIVE_ARMED], false);
  const projected = projectObservedState(guardianProfession, { profession: runtime.profession, time: runtime.time });
  const liveEndurance = runtime.profession.core.endurance.value;
  projected[STATE.ENDURANCE].value = 99;
  runtime.profession.core.justiceActiveArmed = true;
  assert.equal(runtime.profession.core.endurance.value, liveEndurance);
  assert.equal(result.planningState.profession[STATE.JUSTICE_ACTIVE_ARMED], false);
});

test('Symbolic Avenger replaces the oldest stack at its cap and expires stacks independently', () => {
  // Stagger actual symbol hits, then query detached projections at each independent deadline.
  const run = (extra = false) =>
    runGuardian(
      [{ type: 'wait', durationMs: extra ? 20000 : 5000 }],
      { selectedTraitIds: [GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER] },
      {
        initialize: (runtime) => {
          for (const at of [0, 1, 2, 3, 4, 5, ...(extra ? [20] : [])])
            runtime.effects.emit({
              kind: 'packet',
              event: {
                type: 'damage',
                source: 'guardian',
                sourceId: GUARDIAN_SKILL_IDS.SYMBOL_OF_PUNISHMENT,
                skillId: GUARDIAN_SKILL_IDS.SYMBOL_OF_PUNISHMENT,
                actorType: 'player',
                coefficient: 1,
                metadata: { guardianSymbol: true },
                at
              }
            });
        }
      }
    );
  const result = run();
  const profession = observedRuntime(result).profession;
  const rule = guardianCoreModule.modifiers.modifierRules.find((entry) => entry.id === 'guardian.symbolic-avenger');
  assert.equal(profession.core.symbolicAvengerExpirations.length, 5);
  for (const [at, stacks] of [
    [15, 5],
    [15.999, 5],
    [16.000001, 4],
    [17.000001, 3],
    [18.000001, 2],
    [19.000001, 1],
    [20.000001, 0]
  ]) {
    assert.equal(
      rule.amount({ catalog: guardianCatalog, runtime: { profession }, time: at }, rule.target),
      stacks * 0.01
    );
    const projected = projectObservedState(guardianProfession, { profession, time: at });
    assert.equal(projected[STATE.SYMBOLIC_AVENGER_EXPIRATIONS].length, stacks);
    assert.equal(profession.core.symbolicAvengerExpirations.length, 5);
    const items = guardianCoreUi.rotationStateSnapshot({
      balanceContext: { catalog: guardianCatalog, modifierRulesById: new Map() },
      professionState: projected,
      atSeconds: at
    });
    assert.equal(items.length, stacks ? 1 : 0);

    if (stacks) assert.ok(items[0].value.startsWith(stacks + '/5'));
  }

  const finalRuntime = observedRuntime(run(true));
  assert.deepEqual(
    projectObservedState(guardianProfession, {
      profession: finalRuntime.profession,
      time: finalRuntime.time + 0.000001
    })[STATE.SYMBOLIC_AVENGER_EXPIRATIONS],
    [35]
  );
});

test('Furious Focus symbol hits build Symbolic Avenger and trigger Symbolic Exposure', () => {
  const symbols = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    boons: { fury: true },
    selectedTraitIds: [
      GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS,
      GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER,
      GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE
    ]
  })(undefined, ['Virtue of Justice', { type: 'wait', durationMs: 5000 }]);
  assert.deepEqual(symbols.warnings, []);
  const blades = symbols.resolvedEvents.filter((event) => event.name === 'Lesser Symbol of Blades');
  assert.ok(blades.length > 1);
  assert.equal(
    projectObservedState(guardianProfession, {
      profession: observedRuntime(symbols).profession,
      time: symbols.combatEndTime
    })[STATE.SYMBOLIC_AVENGER_EXPIRATIONS].length,
    blades.length
  );
  assert.ok(blades.at(-1).damage > blades[0].damage);
  assert.equal(
    symbols.events.filter(
      (event) =>
        event.type === 'condition' && event.condition === 'Vulnerability' && event.skillName === 'Symbolic Exposure'
    ).length,
    blades.length
  );
});

test("Zealot's Resolution requires the enemy to be below its threshold before the hit", () => {
  // Crossing the threshold and hitting a target already below it are distinct proc opportunities.
  const run = (rotation, startingHealthFraction = 1) =>
    createObservedProfessionSimulator(guardianProfession, {
      ...config,
      primaryWeapon: 'Mace',
      attributeInputs: baseAttributeInputs({ ...config.attributeInputs.weaponSets[0].commonTotals, power: 4000 }),
      target: { ...config.target, health: 4000, startingHealthFraction },
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.ZEALOTS_RESOLUTION]
    })(undefined, rotation);
  const pulses = (result) =>
    result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION
    );
  assert.equal(pulses(run(['True Strike'])).length, 0);
  assert.equal(pulses(run(['True Strike'], 0.75)).length, 0);
  assert.ok(pulses(run(['True Strike'], 0.74)).length > 0);
  const followup = run(['True Strike', 'Pure Strike']);
  const secondHit = followup.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Pure Strike'
  );
  assert.equal(pulses(followup)[0].at, secondHit.at);
  assert.equal(
    observedRuntime(followup).cooldownController.readyAt(GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION),
    secondHit.at + 30
  );
});

// The original Golem maximum and a just-replaced encounter bar must not affect this pre-impact trait check.
test("Zealot's Resolution uses the struck encounter target's pre-hit health", () => {
  const target = (id, maximumHealth, startHealthPercent, endHealthPercent = 0) => ({
    id,
    name: id,
    maximumHealth,
    startHealthPercent,
    endHealthPercent,
    armor: 2597,
    hitboxWidth: 140,
    groupDps: 0,
    entryHealthLossPercent: 0
  });
  const phase = (id, targets, playerTargetId) => ({
    id,
    kind: 'boss',
    targets,
    playerTargetId,
    durationSeconds: null
  });
  const run = (phases, rotation) =>
    createObservedProfessionSimulator(guardianProfession, {
      ...config,
      primaryWeapon: 'Mace',
      attributeInputs: baseAttributeInputs({ ...config.attributeInputs.weaponSets[0].commonTotals, power: 4000 }),
      target: { ...config.target, health: 4000 },
      encounter: { repeatFrom: null, phases },
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.ZEALOTS_RESOLUTION]
    })(undefined, rotation);
  const pulses = (result) =>
    result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_RESOLUTION
    );
  const parallel = [phase('parallel', [target('first', 4000, 100), target('second', 400000, 75)], 'second')];
  assert.equal(pulses(run(parallel, ['True Strike'])).length, 0);
  assert.ok(pulses(run(parallel, ['True Strike', 'Pure Strike'])).length > 0);
  for (const nextId of ['first', 'second']) {
    const result = run(
      [
        phase('opening', [target('first', 4000, 70, 50)], 'first'),
        phase('next', [target(nextId, 400000, 100)], nextId)
      ],
      ['True Strike']
    );
    assert.equal(result.encounter.phaseId, 'next');
    assert.ok(pulses(result).length > 0);
  }
});

test("Spear's Furious Focus symbol precedes the tether and only later pulses gain Big Game Hunter", () => {
  // Check modifier ordering rather than pinning cast durations: the tether cannot amplify an earlier pulse.
  for (const quickness of [false, true]) {
    const run = (bigGameHunter) =>
      createObservedProfessionSimulator(guardianProfession, {
        ...config,
        specialization: 'Dragonhunter',
        primaryWeapon: 'Longbow',
        boons: { fury: true, quickness },
        selectedTraitIds: [
          GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS,
          GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE,
          ...(bigGameHunter ? [GUARDIAN_TRAIT_IDS.BIG_GAME_HUNTER] : [])
        ]
      })(undefined, ['Spear of Justice', { type: 'wait', durationMs: 5000 }]);
    const baseline = run(false);
    const enhanced = run(true);
    const pulses = (result) =>
      result.resolvedEvents.filter(
        (event) => event.type === 'damage' && event.skillId === GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES
      );
    const normal = pulses(baseline),
      boosted = pulses(enhanced);
    const tether = enhanced.resolvedEvents.find(
      (event) => event.type === 'condition' && event.name === 'Spear of Justice - Active Burning'
    );
    assert.ok(boosted[0].at < tether.at);
    assert.equal(boosted[0].damage, normal[0].damage);
    assertFlooredDamageMultiplier(boosted[1].damage, normal[1].damage, 1.25);
    const field = enhanced.events.find(
      (event) => event.type === 'combo_field' && event.skillId === GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES
    );
    assert.equal(field.at, boosted[0].at);
    assert.deepEqual(enhanced.warnings, []);
    assert.equal(new Set(boosted.map((event) => event.activationId)).size, 1);
    assert.equal(
      enhanced.events.filter((event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE)
        .length,
      1
    );
  }
});

test('Furious Focus uses a separate stochastic weapon-strength activation from its triggering virtue', () => {
  const result = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Dragonhunter',
    primaryWeapon: 'Spear',
    boons: { fury: true },
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS],
    randomness: { mode: 'stochastic', seed: 1 }
  })(undefined, ['Spear of Justice', { type: 'wait', durationMs: 5000 }]);
  const virtue = result.resolvedEvents.find((event) => event.name === 'Spear of Justice' && event.type === 'damage');
  const symbol = result.resolvedEvents.filter(
    (event) => event.name === 'Lesser Symbol of Blades' && event.type === 'damage'
  );

  // The virtue's authored equipped-weapon source resolves to the wielded Spear at emission.
  assert.equal(virtue.weaponStrengthProfileId, 'weapon.spear');
  assert.equal(symbol.length, 5);
  assert.notEqual(symbol[0].activationId, virtue.activationId);
  assert.equal(new Set(symbol.map((event) => event.activationId)).size, 1);
  assert.equal(
    symbol.every((event) => event.weaponStrengthProfileId === 'nonweapon.unequipped'),
    true
  );
});

test("Healer's Resolution grants eight seconds on committed heals with a shared twenty-second ICD", () => {
  // Different heals share the same native cooldown boundary; canceled casts and utilities cannot claim it.
  const settings = { selectedTraitIds: [GUARDIAN_TRAIT_IDS.HEALERS_RESOLUTION] };
  for (const skillId of [GUARDIAN_SKILL_IDS.SHELTER, GUARDIAN_SKILL_IDS.SIGNET_OF_RESOLVE]) {
    const ordinary = runGuardian([skillId], settings);
    const completion = ordinary.events.find((event) => event.type === 'action' && event.skillId === skillId).endsAt;
    for (const offset of [-0.04, 0, 0.04]) {
      const deadline = completion - offset;
      const result = runGuardian([skillId], settings, {
        initialize: (runtime) => {
          runtime.procs.setDeadline('guardian.core.healersResolution', deadline);
        }
      });
      const boons = result.events.filter((event) => event.type === 'buff' && event.kind === 'resolution');
      assert.equal(boons.length > 0, offset > 0);
      assert.equal(
        observedRuntime(result).procs.deadline('guardian.core.healersResolution'),
        gw2Time(offset > 0 ? completion + 20 : deadline)
      );
    }

    const canceled = runGuardian([{ skillId, interruptAfterMs: 1 }], settings);
    assert.equal(observedRuntime(canceled).procs.deadline('guardian.core.healersResolution'), 0);
  }

  const utility = runGuardian(['Bane Signet'], settings);
  assert.equal(observedRuntime(utility).procs.deadline('guardian.core.healersResolution'), 0);
  const untraited = runGuardian(['Shelter']);
  assert.equal(observedRuntime(untraited).procs.deadline('guardian.core.healersResolution'), 0);
  const scaled = runGuardian(['Shelter'], {
    ...settings,
    attributeInputs: baseAttributeInputs({ concentration: 750 })
  });
  assert.equal(
    scaled.events.find((event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.HEALERS_RESOLUTION)
      .duration,
    12
  );
});

test("Protector's Restoration shares an Alacrity-adjusted sixteen-second recharge across committed healing skills", () => {
  // Different heals share the same strict cooldown boundary; canceled casts and utilities cannot claim it.
  const settings = { selectedTraitIds: [GUARDIAN_TRAIT_IDS.PROTECTORS_RESTORATION] };
  for (const skillId of [GUARDIAN_SKILL_IDS.SHELTER, GUARDIAN_SKILL_IDS.SIGNET_OF_RESOLVE]) {
    const ordinary = runGuardian([skillId], settings);
    const completion = ordinary.events.find((event) => event.type === 'action' && event.skillId === skillId).endsAt;
    for (const offset of [-0.04, 0, 0.04]) {
      const deadline = completion - offset;
      const result = runGuardian([skillId], settings, {
        initialize: (runtime) => {
          runtime.cooldownController.setReadyAt(GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_PROTECTION, deadline);
        }
      });
      const boons = result.events.filter((event) => event.type === 'buff' && event.kind === 'protection');
      assert.equal(boons.length > 0, offset >= 0);
      assert.equal(
        observedRuntime(result).cooldownController.readyAt(GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_PROTECTION),
        gw2Time(offset >= 0 ? completion + 16 : deadline)
      );
    }

    const canceled = runGuardian([{ skillId, interruptAfterMs: 1 }], settings);
    assert.equal(
      observedRuntime(canceled).cooldownController.readyAt(GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_PROTECTION),
      undefined
    );
  }

  const utility = runGuardian(['Bane Signet'], settings);
  assert.equal(
    observedRuntime(utility).cooldownController.readyAt(GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_PROTECTION),
    undefined
  );
  const untraited = runGuardian(['Shelter']);
  assert.equal(
    observedRuntime(untraited).cooldownController.readyAt(GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_PROTECTION),
    undefined
  );
});

test("Protector's Restoration pulses Protection and symbol damage while its Light field enables combos", () => {
  // A short heal/finisher sequence checks real scheduling, boon scaling, and field expiry.
  const run = (waitMs) =>
    createObservedProfessionSimulator(guardianProfession, {
      ...config,
      primaryWeapon: 'Hammer',
      attributeInputs: baseAttributeInputs({
        ...config.attributeInputs.weaponSets[0].commonTotals,
        concentration: 750
      }),
      boons: { alacrity: true },
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.PROTECTORS_RESTORATION, GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE]
    })(undefined, ['Shelter', { type: 'wait', durationMs: waitMs }, 'Mighty Blow', { type: 'wait', durationMs: 3000 }]);
  const result = run(0);
  assert.deepEqual(result.warnings, []);
  const symbolId = GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_PROTECTION;
  const strikes = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === symbolId);
  const start = strikes[0].at;
  assert.equal(new Set(strikes.map((event) => event.activationId)).size, 1);
  assert.ok(strikes.every((event) => event.weaponStrengthProfileId === 'nonweapon.unequipped'));
  const protection = result.events.filter((event) => event.type === 'buff' && event.skillId === symbolId);
  assert.ok(protection.length > 0);
  assert.ok(protection.every((event) => event.kind === 'protection' && event.duration === 1.5));
  assert.ok(protection.every((event) => event.audience.recipients === 'party'));
  const field = result.events.find((event) => event.type === 'combo_field' && event.skillId === symbolId);
  assert.deepEqual([field.at, field.expiresAt, field.fieldType], [start, start + 2, 'Light']);
  const combo = result.resolvedEvents.find((event) => event.type === 'combo' && event.skillName === 'Mighty Blow');
  assert.deepEqual(
    [combo.fieldSourceId, combo.fieldType, combo.finisherType],
    [GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_PROTECTION, 'Light', 'Blast']
  );
  assert.equal(
    observedRuntime(result).cooldownController.readyAt(GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_PROTECTION),
    start + 16
  );
  const expired = run(2500);
  assert.deepEqual(expired.warnings, []);
  assert.equal(
    expired.resolvedEvents.some((event) => event.type === 'combo'),
    false
  );
});

test('resolution traits affect strike damage, critical chance, and might', () => {
  const run = (selectedTraitIds) =>
    createObservedProfessionSimulator(guardianProfession, {
      ...config,
      // Isolate Might's increasing Power from independent critical rolls on successive pulses.
      criticalDamageMode: 'averaged',
      primaryWeapon: 'Greatsword',
      selectedTraitIds
    })(undefined, ['Symbol of Resolution', 'Strike', { type: 'wait', durationMs: 6000 }]);
  const righteous = run([GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS]);
  const retribution = run([GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS, GUARDIAN_TRAIT_IDS.RETRIBUTION]);
  const first = (result) => result.resolvedEvents.find((event) => event.name === 'Symbol of Resolution - Initial');
  const followup = (result) => result.resolvedEvents.find((event) => event.name === 'Strike');
  const pulses = retribution.resolvedEvents.filter((event) => event.name === 'Symbol of Resolution');

  // The delivered self boon precedes same-time damage, so the initial and subsequent strikes receive its modifiers.
  assertFlooredDamageMultiplier(first(retribution).damage, first(righteous).damage, 1.1);
  assertFlooredDamageMultiplier(followup(retribution).damage, followup(righteous).damage, 1.1);
  assert.equal(followup(retribution).criticalChance, first(retribution).criticalChance);
  assert.ok(
    Math.abs(
      first(retribution).criticalChance -
        0.25 -
        (config.attributeInputs.weaponSets[0].commonTotals.precision > 895
          ? (config.attributeInputs.weaponSets[0].commonTotals.precision - 895) / 2100
          : 0)
    ) < 1e-9
  );
  assert.equal(
    pulses.every((event, index) => index === 0 || event.damage > pulses[index - 1].damage),
    true
  );
});

test('Relic of Fireworks triggers on Dragonhunter virtues', () => {
  const result = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Dragonhunter',
    primaryWeapon: 'Spear',
    relic: 'Fireworks'
  })(undefined, ['Spear of Justice', { type: 'wait', durationMs: 3000 }]);
  const procs = result.procSteps.filter((step) => step.skill === 'Relic of Fireworks');

  assert.ok(procs.length > 0);
  assert.ok(procs.every((step) => step.sourceSkill === 'Spear of Justice'));
});

// The initial strike can activate or refresh the relic, but ongoing tethers must allow its buff to expire.
test('Binding Blade activates and refreshes Fireworks without proccing on tether damage', () => {
  const simulate = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    primaryWeapon: 'Greatsword',
    relic: 'Fireworks'
  });
  for (const opening of [[], ['Spear of Justice']]) {
    const result = simulate('Dragonhunter', [...opening, 'Binding Blade', { type: 'wait', durationMs: 11000 }]);
    assert.deepEqual(result.warnings, []);
    const procs = result.procSteps.filter((step) => step.skill === 'Relic of Fireworks');
    assert.equal(procs.length, opening.length + 1);
    assert.equal(procs.at(-1).sourceSkill, 'Binding Blade');
    assert.equal(procs.at(-1).detail, opening.length ? 'refreshed' : 'activated');
    assert.ok(result.resolvedEvents.some((event) => event.name === 'Binding Blade - Tether' && event.damage > 0));
  }
});

test('Dragonhunter traps and control traits apply their complete effects', () => {
  const trap = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Dragonhunter',
    relic: 'Dragonhunter',
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.HUNTERS_PREMONITION]
  })(undefined, ['Procession of Blades', { type: 'wait', durationMs: 5000 }]);

  assert.equal(trap.procSteps.filter((step) => step.skill === 'Relic of the Dragonhunter').length, 10);
  assert.equal(
    trap.events.some(
      (event) =>
        event.type === 'buff' &&
        event.kind === 'aegis' &&
        event.skillName === 'Procession of Blades' &&
        event.duration === 3
    ),
    true
  );

  const maw = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    target: { ...config.target, defiant: true },
    specialization: 'Dragonhunter',
    initialEndurance: 0,
    selectedTraitIds: [
      GUARDIAN_TRAIT_IDS.DULLED_SENSES,
      GUARDIAN_TRAIT_IDS.HEAVY_LIGHT,
      GUARDIAN_TRAIT_IDS.HUNTERS_DETERMINATION
    ]
  })(undefined, ["Dragon's Maw", { type: 'wait', durationMs: 1500 }]);

  assert.deepEqual(maw.warnings, []);
  assert.equal(
    maw.procSteps.some((step) => step.skill === 'Heavy Light'),
    true
  );
  assert.equal(
    maw.procSteps.some((step) => step.skill === "Hunter's Determination"),
    true
  );
  assert.equal(maw.planningState.profession[STATE.ENDURANCE].value, 100);
});

test('Dragonhunter relic boosts the triggering trap hit and expires for later attacks', () => {
  // A fresh trap receives the bonus immediately, without making the timed buff permanent or stacking it twice.
  for (const trap of ["Dragon's Maw", 'Purification', 'Procession of Blades']) {
    const simulate = (relic) =>
      createObservedProfessionSimulator(guardianProfession, {
        ...config,
        primaryWeapon: 'Greatsword',
        specialization: 'Dragonhunter',
        relic
      })(undefined, [
        trap,
        { type: 'wait', durationMs: 5000 },
        'Strike',
        { type: 'wait', durationMs: 6000 },
        'Leap of Faith'
      ]);
    const baseline = simulate('');
    const boosted = simulate('Dragonhunter');
    const hits = (result) => result.resolvedEvents.filter((event) => event.type === 'damage');
    const original = hits(baseline);
    const actual = hits(boosted);
    assertFlooredDamageMultiplier(actual[0].damage, original[0].damage, 1.1);
    assertFlooredDamageMultiplier(actual.at(-2).damage, original.at(-2).damage, 1.1);
    assert.equal(actual.at(-1).damage, original.at(-1).damage, trap);
    assert.deepEqual(boosted.warnings, []);
  }
});

for (const [name, primaryWeapon, traitId] of [
  ['Purging Flames', 'Mace', GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS],
  ['Symbol of Faith', 'Mace', GUARDIAN_TRAIT_IDS.WRIT_OF_PERSISTENCE]
]) {
  test(`${name} only creates trait field extensions after commitment`, () => {
    // A single cast isolates cancellation from the later damage, conditions, and fields its trait adds.
    const simulate = (selectedTraitIds, interruptMs) =>
      createObservedProfessionSimulator(guardianProfession, { ...config, primaryWeapon, selectedTraitIds })(undefined, [
        { name, ...(interruptMs == null ? {} : { interruptMs }) },
        { type: 'wait', durationMs: 9000 }
      ]);
    const baseline = simulate([]);
    const committed = simulate([traitId]);
    const cancelled = simulate([traitId], 0);
    const packets = (result, type) => result.events.filter((event) => event.skillName === name && event.type === type);

    for (const result of [baseline, committed, cancelled]) assert.deepEqual(result.warnings, []);
    assert.equal(packets(cancelled, 'action')[0].cancelled, true);
    assert.equal(Boolean(packets(committed, 'action')[0].cancelled), false);
    for (const type of ['damage', 'condition', 'combo_field']) assert.deepEqual(packets(cancelled, type), []);

    const lastBaseStrike = Math.max(...packets(baseline, 'damage').map((event) => event.at));
    assert.ok(Number.isFinite(lastBaseStrike));
    assert.ok(packets(committed, 'damage').some((event) => event.at > lastBaseStrike));

    if (name === 'Purging Flames') {
      assert.ok(
        packets(committed, 'action')[0].comboFields[0].duration > packets(baseline, 'action')[0].comboFields[0].duration
      );
      assert.ok(
        packets(committed, 'condition').some((event) => event.condition === 'Burning' && event.at > lastBaseStrike)
      );
    } else {
      assert.ok(
        Math.max(...packets(committed, 'combo_field').map((event) => event.expiresAt)) >
          Math.max(...packets(baseline, 'combo_field').map((event) => event.expiresAt))
      );
    }
  });
}

test('Luminary UI excludes virtue aliases and lists the forge exit once', () => {
  const result = createObservedProfessionSimulator(guardianProfession, { ...config, specialization: 'Luminary' })(
    undefined,
    ['Radiant Justice', 'Enter Radiant Forge']
  );
  const professionSkillIds = guardianProfession.ui.paletteGroups({
    specialization: 'Luminary',

    professionState: result.planningState.profession
  })[0].skillIds;
  const professionSkillNames = professionSkillIds.map((id) => guardianCatalog.skillsById.get(id)?.name);

  assert.equal(result.planningState.profession[STATE.AVAILABLE_FLIPS][GUARDIAN_SKILL_IDS.SPEAR_OF_JUSTICE], undefined);
  assert.equal(professionSkillNames.includes('Spear of Justice'), false);
  assert.equal(professionSkillNames.filter((name) => name === 'Exit Radiant Forge').length, 1);
});

test('elite specializations expose their profession mechanics', () => {
  const spear = guardianCatalog.skillsById.get(29887);
  const verdict = guardianCatalog.skillsById.get(33134);
  const dragonhunter = guardianProfession.ui.paletteGroups({
    specialization: 'Dragonhunter'
  })[0].skillIds;
  const firebrand = guardianProfession.ui
    .paletteGroups({
      specialization: 'Firebrand',
      professionState: {
        [STATE.ACTIVE_TOME]: 'justice',
        [STATE.TOME_PAGES]: {
          value: 5,
          maximum: 5,
          updatedAt: 0,
          unitsPerSecond: 0,
          interval: 8,
          unitsPerTick: 1,
          nextAt: Infinity
        }
      }
    })
    .flatMap((group) => group.skillIds);
  const firebrandResources = guardianProfession.ui.resourceViews({
    catalog: guardianCatalog,
    specialization: 'Firebrand',
    simulationTime: 10,
    professionState: {
      [STATE.TOME_PAGES]: {
        value: 3,
        maximum: 5,
        updatedAt: 0,
        unitsPerSecond: 0,
        interval: 8,
        unitsPerTick: 1,
        nextAt: Infinity
      },

      [STATE.VIRTUE_READY_AT]: { justice: 20, resolve: 10, courage: 0 }
    }
  });

  assert.equal(dragonhunter.includes(GUARDIAN_SKILL_IDS.WINGS_OF_RESOLVE), true);
  assert.equal(dragonhunter.includes(GUARDIAN_SKILL_IDS.SHIELD_OF_COURAGE), true);
  assert.equal(spear.flipParentId, null);
  assert.equal(verdict.flipParentId, spear.id);
  assert.equal(firebrand.includes(GUARDIAN_SKILL_IDS.SEARING_SPELL), true);
  assert.equal(firebrandResources[0].value, 3);
  assert.equal(firebrandResources[1].id, 'tome-dormancy');
  assert.equal(firebrandResources[1].displayMode, 'status');
  assert.equal(firebrandResources[1].statusItemsLabel, undefined);
  assert.deepEqual(
    firebrandResources[1].statusItems.map(({ id, valueLabel }) => [id, valueLabel]),
    [
      ['justice', 'Dormant 10.0s'],
      ['resolve', 'Ready'],
      ['courage', 'Ready']
    ]
  );
});

test('Guardian declarative scheduling respects the configured starting set', () => {
  // Starting on set two still requires equipped weapons when swapping back to set one.
  const equipped = { ...config, primaryWeapon: 'Sword', weaponSet2Primary: 'Scepter', startingWeaponSet: 2 };
  const initial = createObservedProfessionSimulator(guardianProfession, equipped)(undefined, []);
  const swapped = createObservedProfessionSimulator(guardianProfession, equipped)(undefined, ['Swap Weapons']);

  assert.equal(initial.planningState.activeWeaponSet, 2);
  assert.equal(swapped.planningState.activeWeaponSet, 1);
  assert.equal(swapped.events.find((event) => event.type === 'weapon_set').weaponSet, 1);
});
