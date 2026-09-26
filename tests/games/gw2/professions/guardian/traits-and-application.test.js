import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadProfession } from '#gw2/app/profession-registry.js';
import { createCalculateAttributes } from '#gw2/platform/builds/attributes.js';
import { createObservedProfessionSimulator, observedRuntime } from '#tests/helpers/observed-runtime.js';
import {
  createGuardianBuildDefaults,
  migrateGuardianBuild,
  validateGuardianBuild
} from '#gw2/professions/guardian/build/build.js';
import { applyGuardianBuildAttributeRules } from '#gw2/professions/guardian/build/attributes.js';
import { guardianCatalog, guardianProfession } from '#gw2/professions/guardian/profession.js';
import { guardianAppAdapter } from '#gw2/professions/guardian/app/app-definition.js';
import { bindGuardianCoreUi } from '#gw2/professions/guardian/core/presentation.js';
import { guardianCoreAttributeRules } from '#gw2/professions/guardian/core/traits/modifiers.js';
import { projectGuardianPlanningState, snapshotGuardianState } from '#gw2/professions/guardian/family-state.js';
import { GUARDIAN_SKILL_IDS, GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';

const guardianCoreUi = bindGuardianCoreUi(guardianCatalog);

// Attribute assertions use the same calculator composed into the Guardian adapter.
const calculateGuardianAttributes = createCalculateAttributes(applyGuardianBuildAttributeRules);

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

test('Guardian combat and planning projections detach counters from the live state', () => {
  // Both public boundaries detach their data from the one live state owner.
  const result = runGuardian(['Virtue of Justice', 'Orb of Wrath']);
  const runtime = observedRuntime(result);
  assert.equal(runtime.profession.core.justiceActiveBurns, 1);
  assert.equal(result.planningState.profession.justiceActiveArmed, false);
  const projected = projectGuardianPlanningState({ profession: runtime.profession, time: runtime.time });
  projected.virtueReadyAt.justice = 99;
  runtime.profession.core.justiceActiveBurns = 9;
  assert.notEqual(runtime.profession.core.virtueReadyAt.justice, 99);
  assert.equal(result.combatState.profession.justiceActiveBurns, 1);
  assert.equal(result.planningState.profession.justiceActiveBurns, 1);
});

test('Symbolic Avenger replaces the oldest stack at its cap and expires stacks independently', () => {
  // Stagger actual symbol hits, then query detached projections at each independent deadline.
  const run = (extra = false) =>
    runGuardian(
      [{ type: 'wait', durationMs: extra ? 20000 : 5000 }],
      { selectedTraitIds: [GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER] },
      (runtime) => {
        for (const at of [0, 1, 2, 3, 4, 5, ...(extra ? [20] : [])])
          runtime.emit({
            type: 'damage',
            source: 'guardian',
            sourceId: GUARDIAN_SKILL_IDS.SYMBOL_OF_PUNISHMENT,
            skillId: GUARDIAN_SKILL_IDS.SYMBOL_OF_PUNISHMENT,
            actorType: 'player',
            coefficient: 1,
            isSymbol: true,
            at
          });
      }
    );
  const result = run();
  const profession = observedRuntime(result).profession;
  const rule = guardianCoreAttributeRules.modifierRules.find((entry) => entry.id === 'guardian.symbolic-avenger');
  assert.equal(profession.core.symbolicAvengerExpirations.length, 5);
  for (const [at, stacks] of [
    [15, 5],
    [15.999, 5],
    [16, 4],
    [17, 3],
    [18, 2],
    [19, 1],
    [20, 0]
  ]) {
    assert.equal(rule.amount({ runtime: { profession }, time: at }, rule.target, rule.parameters), stacks * 0.01);
    const projected = projectGuardianPlanningState({ profession, time: at });
    assert.equal(projected.symbolicAvengerExpirations.length, stacks);
    assert.equal(profession.core.symbolicAvengerExpirations.length, 5);
    const items = guardianCoreUi.rotationStateSnapshot({ professionState: projected, atSeconds: at });
    assert.equal(items.length, stacks ? 1 : 0);
    if (stacks) assert.ok(items[0].value.startsWith(stacks + '/5'));
  }

  assert.deepEqual(observedRuntime(run(true)).profession.core.symbolicAvengerExpirations, [35]);
});

test('Zeal symbol traits emit their full profiles and stack damage', () => {
  const symbols = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    boons: { fury: true },
    selectedTraitIds: [
      GUARDIAN_TRAIT_IDS.FURIOUS_FOCUS,
      GUARDIAN_TRAIT_IDS.SYMBOLIC_AVENGER,
      GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE
    ]
  })(undefined, ['Virtue of Justice', { type: 'wait', durationMs: 5000 }]);
  const zealotsResolution = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    target: { ...config.target, health: 1000000, startingHealthFraction: 0.2 },
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.ZEALOTS_RESOLUTION]
  })(undefined, ['True Strike', { type: 'wait', durationMs: 6000 }]);
  const blades = symbols.resolvedEvents.filter((event) => event.name === 'Lesser Symbol of Blades');
  const resolution = zealotsResolution.resolvedEvents.filter((event) => event.name === 'Lesser Symbol of Resolution');

  assert.equal(blades.length, 5);
  assert.equal(
    blades.every((event) => event.coefficient === 0.65),
    true
  );
  assert.equal(
    blades.every((event) => event.skillWeapon === 'Unequipped'),
    true
  );
  assert.equal(
    snapshotGuardianState(symbols.combatState.profession, symbols.combatState.atSeconds).symbolicAvengerExpirations
      .length,
    5
  );
  assert.ok(blades.at(-1).damage > blades[0].damage);
  assert.equal(
    symbols.events.filter(
      (event) =>
        event.type === 'condition' && event.condition === 'Vulnerability' && event.skillName === 'Symbolic Exposure'
    ).length,
    5
  );
  assert.equal(resolution.length, 5);
  assert.equal(
    resolution.every((event) => event.coefficient === 0.5),
    true
  );
  assert.equal(
    resolution.every((event) => event.skillWeapon === 'Unequipped'),
    true
  );
  assert.equal(zealotsResolution.combatState.profession.zealotsResolutionReadyAt, resolution[0].at + 30);
});

test("Zealot's Resolution requires the enemy to be below its threshold before the hit", () => {
  // Crossing the threshold and hitting a target already below it are distinct proc opportunities.
  const run = (rotation, startingHealthFraction = 1) =>
    createObservedProfessionSimulator(guardianProfession, {
      ...config,
      primaryWeapon: 'Mace',
      stats: { ...config.stats, power: 4000 },
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
  assert.equal(followup.combatState.profession.zealotsResolutionReadyAt, secondHit.at + 30);
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
      (event) => event.type === 'condition' && event.name === 'Spear of Justice — Active Burning'
    );
    assert.ok(boosted[0].at < tether.at);
    assert.equal(boosted[0].damage, normal[0].damage);
    assertFlooredDamageMultiplier(boosted[1].damage, normal[1].damage, 1.25);
    const field = enhanced.events.find(
      (event) => event.type === 'combo_field' && event.skillId === GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_BLADES
    );
    assert.equal(field.at, boosted[0].at);
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
  // Different heals share the same strict cooldown boundary; canceled casts and utilities cannot claim it.
  const settings = { selectedTraitIds: [GUARDIAN_TRAIT_IDS.HEALERS_RESOLUTION] };
  for (const skillId of [GUARDIAN_SKILL_IDS.SHELTER, GUARDIAN_SKILL_IDS.SIGNET_OF_RESOLVE]) {
    const ordinary = runGuardian([skillId], settings);
    const completion = ordinary.events.find((event) => event.type === 'action' && event.skillId === skillId).endsAt;
    for (const offset of [-0.001, 0, 0.001]) {
      const deadline = completion - offset;
      const result = runGuardian([skillId], settings, (runtime) => {
        runtime.profession.core.healersResolutionReadyAt = deadline;
      });
      const boons = result.events.filter((event) => event.type === 'buff' && event.kind === 'resolution');
      assert.equal(boons.length > 0, offset > 0);
      assert.equal(
        observedRuntime(result).profession.core.healersResolutionReadyAt,
        offset > 0 ? completion + 20 : deadline
      );
    }

    const canceled = runGuardian([{ skillId, interruptAfterMs: 1 }], settings);
    assert.equal(observedRuntime(canceled).profession.core.healersResolutionReadyAt, 0);
  }

  const utility = runGuardian(['Bane Signet'], settings);
  assert.equal(observedRuntime(utility).profession.core.healersResolutionReadyAt, 0);
  const untraited = runGuardian(['Shelter']);
  assert.equal(observedRuntime(untraited).profession.core.healersResolutionReadyAt, 0);
  const scaled = runGuardian(['Shelter'], { ...settings, stats: { concentration: 750 } });
  assert.equal(
    scaled.events.find((event) => event.type === 'buff' && event.sourceId === GUARDIAN_TRAIT_IDS.HEALERS_RESOLUTION)
      .duration,
    12
  );
});

test("Protector's Restoration shares a fixed twenty-second ICD across committed healing skills", () => {
  // Different heals share the same strict cooldown boundary; canceled casts and utilities cannot claim it.
  const settings = { selectedTraitIds: [GUARDIAN_TRAIT_IDS.PROTECTORS_RESTORATION] };
  for (const skillId of [GUARDIAN_SKILL_IDS.SHELTER, GUARDIAN_SKILL_IDS.SIGNET_OF_RESOLVE]) {
    const ordinary = runGuardian([skillId], settings);
    const completion = ordinary.events.find((event) => event.type === 'action' && event.skillId === skillId).endsAt;
    for (const offset of [-0.001, 0, 0.001]) {
      const deadline = completion - offset;
      const result = runGuardian([skillId], settings, (runtime) => {
        runtime.profession.core.protectorsRestorationReadyAt = deadline;
      });
      const boons = result.events.filter((event) => event.type === 'buff' && event.kind === 'protection');
      assert.equal(boons.length > 0, offset > 0);
      assert.equal(
        observedRuntime(result).profession.core.protectorsRestorationReadyAt,
        offset > 0 ? completion + 20 : deadline
      );
    }

    const canceled = runGuardian([{ skillId, interruptAfterMs: 1 }], settings);
    assert.equal(observedRuntime(canceled).profession.core.protectorsRestorationReadyAt, 0);
  }

  const utility = runGuardian(['Bane Signet'], settings);
  assert.equal(observedRuntime(utility).profession.core.protectorsRestorationReadyAt, 0);
  const untraited = runGuardian(['Shelter']);
  assert.equal(observedRuntime(untraited).profession.core.protectorsRestorationReadyAt, 0);
});

test("Protector's Restoration pulses Protection and symbol damage while its Light field enables combos", () => {
  // A short heal/finisher sequence checks real scheduling, boon scaling, and field expiry.
  const run = (waitMs) =>
    createObservedProfessionSimulator(guardianProfession, {
      ...config,
      primaryWeapon: 'Hammer',
      stats: { ...config.stats, concentration: 750 },
      boons: { alacrity: true },
      selectedTraitIds: [GUARDIAN_TRAIT_IDS.PROTECTORS_RESTORATION, GUARDIAN_TRAIT_IDS.SYMBOLIC_EXPOSURE]
    })(undefined, ['Shelter', { type: 'wait', durationMs: waitMs }, 'Mighty Blow', { type: 'wait', durationMs: 3000 }]);
  const result = run(0);
  assert.deepEqual(result.warnings, []);
  const symbolId = GUARDIAN_SKILL_IDS.LESSER_SYMBOL_OF_PROTECTION;
  const strikes = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === symbolId);
  const start = strikes[0].at;
  assert.deepEqual(
    strikes.map((event) => [Math.round((event.at - start) * 1000), event.coefficient]),
    [
      [0, 0.6],
      [1000, 0.6],
      [2000, 0.6]
    ]
  );
  assert.equal(new Set(strikes.map((event) => event.activationId)).size, 1);
  assert.ok(strikes.every((event) => event.weaponStrengthProfileId === 'nonweapon.unequipped'));
  const protection = result.events.filter((event) => event.type === 'buff' && event.skillId === symbolId);
  assert.deepEqual(
    protection.map((event) => [Math.round((event.at - start) * 1000), event.kind, event.duration]),
    [
      [0, 'protection', 1.5],
      [1000, 'protection', 1.5],
      [2000, 'protection', 1.5]
    ]
  );
  assert.ok(protection.every((event) => event.audience.recipients === 'party'));
  const field = result.events.find((event) => event.type === 'combo_field' && event.skillId === symbolId);
  assert.deepEqual([field.at, field.expiresAt, field.fieldType], [start, start + 2, 'Light']);
  const combo = result.resolvedEvents.find((event) => event.type === 'combo' && event.skillName === 'Mighty Blow');
  assert.deepEqual([combo.fieldSourceId, combo.fieldType, combo.finisherType], [symbolId, 'Light', 'Blast']);
  assert.deepEqual(
    result.events
      .filter((event) => event.type === 'condition' && event.skillName === 'Symbolic Exposure')
      .map((event) => Math.round((event.at - start) * 1000)),
    [0, 1000, 2000]
  );
  assert.equal(observedRuntime(result).profession.core.protectorsRestorationReadyAt, start + 20);
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
      primaryWeapon: 'Greatsword',
      selectedTraitIds
    })(undefined, ['Symbol of Resolution', 'Strike', { type: 'wait', durationMs: 6000 }]);
  const righteous = run([GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS]);
  const retribution = run([GUARDIAN_TRAIT_IDS.RIGHTEOUS_INSTINCTS, GUARDIAN_TRAIT_IDS.RETRIBUTION]);
  const first = (result) => result.resolvedEvents.find((event) => event.name === 'Symbol of Resolution — Initial');
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
        (config.stats.precision > 895 ? (config.stats.precision - 895) / 2100 : 0)
    ) < 1e-9
  );
  assert.equal(
    pulses.every((event, index) => index === 0 || event.damage > pulses[index - 1].damage),
    true
  );
  assert.deepEqual(
    retribution.procSteps.filter((step) => step.skill === 'Righteous Instincts').map((step) => step.start),
    [200, 1200, 2200, 3200, 4200]
  );
});

test('Guardian build attributes expose static Zeal and Radiance bonuses', () => {
  const build = createGuardianBuildDefaults();

  build.weapons = ['Greatsword', ''];
  build.specializations = [
    { name: 'Zeal', traits: '2-2-3' },
    { name: 'Radiance', traits: '2-3-3' },
    { name: 'Luminary', traits: '3-3-2' }
  ];
  const all = calculateGuardianAttributes(build, []).attributes;
  const withoutBlade = calculateGuardianAttributes(build, [], 1, 'Zealous Blade').attributes;
  const withoutPower = calculateGuardianAttributes(build, [], 1, 'Radiant Power').attributes;
  const withoutRightHand = calculateGuardianAttributes(build, [], 1, 'Right-Hand Strength').attributes;

  assert.equal(all.Power.final - withoutBlade.Power.final, 240);
  assert.equal(all.Ferocity.final - withoutPower.Ferocity.final, 150);
  assert.equal(all.Precision.final - withoutRightHand.Precision.final, 80);
  assert.equal(all.Power.final - withoutRightHand.Power.final, 0);

  build.weapons = ['Sword', 'Focus'];
  const oneHanded = calculateGuardianAttributes(build, []).attributes;
  const oneHandedWithout = calculateGuardianAttributes(build, [], 1, 'Right-Hand Strength').attributes;

  assert.equal(oneHanded.Power.final - oneHandedWithout.Power.final, 80);

  build.specializations[1] = { name: 'Radiance', traits: '2-2-3' };
  const radiantFire = calculateGuardianAttributes(build, []).attributes;
  const withoutRadiantFire = calculateGuardianAttributes(build, [], 1, 'Radiant Fire').attributes;

  assert.equal(radiantFire['Burning Duration'].traits, 20);
  assert.equal(radiantFire['Burning Duration'].final, 20);
  assert.equal(withoutRadiantFire['Burning Duration'], undefined);

  const app = {
    build,
    skillByName: guardianCatalog.skillsByName,
    attributeWeaponSet: 1
  };

  guardianAppAdapter.recalculate(app);
  assert.equal(guardianAppAdapter.simulationConfig(app).stats.conditionDurationBonuses.Burning, 20);
});

test('Dragonhunter virtues apply tether, passive aegis, and virtue traits', () => {
  const selectedTraitIds = [
    GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE,
    GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION,
    GUARDIAN_TRAIT_IDS.UNSCATHED_CONTENDER,
    GUARDIAN_TRAIT_IDS.INSPIRING_VIRTUE,
    GUARDIAN_TRAIT_IDS.BIG_GAME_HUNTER
  ];
  const result = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Dragonhunter',
    primaryWeapon: 'Spear',
    boons: { quickness: true },
    selectedTraitIds
  })(undefined, ['Spear of Justice', 'Helio Rush', { type: 'wait', durationMs: 13000 }]);
  const activeBurning = result.resolvedEvents.filter((event) => event.name === 'Spear of Justice — Active Burning');
  const spearStrike = result.resolvedEvents.find(
    (event) => event.type === 'damage' && event.skillName === 'Spear of Justice'
  );
  const buffs = result.events.filter((event) => event.type === 'buff');

  assert.deepEqual(result.warnings, []);
  assert.equal(spearStrike.coefficient, 0.8);
  assert.equal(activeBurning.length, 12);
  assert.equal(
    activeBurning.every((event) => event.duration === 2),
    true
  );
  assert.equal(result.combatState.profession.tetherUntil, 0);
  // The observation ends after the tether, so its expired flip must not remain in planning state.
  assert.equal(result.planningState.profession.availableFlips[GUARDIAN_SKILL_IDS.HUNTERS_VERDICT], undefined);
  assert.equal(
    buffs.some((event) => event.kind === 'aegis' && event.skillName === 'Shield of Courage' && event.duration === 20),
    true
  );
  assert.equal(
    buffs.some((event) => event.kind === 'might' && event.stacks === 3 && event.duration === 5),
    true
  );
  assert.equal(
    buffs.some((event) => event.kind === 'resolution' && event.duration === 3.75),
    true
  );
  assert.equal(
    buffs.some((event) => event.kind === 'resolution' && event.skillName === 'Helio Rush' && event.duration === 5),
    true
  );
  assert.equal(
    buffs.some((event) => event.kind === 'guardian-inspiring-virtue' && event.duration === 6),
    true
  );

  const verdict = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Dragonhunter',
    primaryWeapon: 'Spear',
    boons: { quickness: true },
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.BIG_GAME_HUNTER]
  })(undefined, ['Spear of Justice', "Hunter's Verdict", { type: 'wait', durationMs: 3000 }]);

  assert.deepEqual(verdict.warnings, []);
  assert.equal(verdict.resolvedEvents.filter((event) => event.name === 'Spear of Justice — Active Burning').length, 1);
  assert.equal(
    verdict.events.some(
      (event) => event.type === 'control' && event.skillName === "Hunter's Verdict" && event.controlKind === 'pull'
    ),
    true
  );

  const courage = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Dragonhunter',
    selectedTraitIds: [
      GUARDIAN_TRAIT_IDS.INSPIRED_VIRTUE,
      GUARDIAN_TRAIT_IDS.VIRTUE_OF_RESOLUTION,
      GUARDIAN_TRAIT_IDS.INDOMITABLE_COURAGE
    ]
  })(undefined, ['Shield of Courage']);

  assert.equal(
    courage.events.some((event) => event.type === 'buff' && event.kind === 'protection'),
    true
  );
  assert.equal(
    courage.events.some(
      (event) => event.type === 'buff' && event.kind === 'stability' && event.stacks === 3 && event.duration === 4
    ),
    true
  );

  const soaring = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    specialization: 'Dragonhunter',
    primaryWeapon: 'Spear',
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.SOARING_DEVASTATION]
  })(undefined, ['Wings of Resolve']);

  assert.equal(
    soaring.resolvedEvents.some(
      (event) => event.type === 'damage' && event.skillName === 'Wings of Resolve' && event.coefficient === 1.5
    ),
    true
  );
  assert.equal(
    soaring.resolvedEvents.some((event) => event.condition === 'Immobilized' && event.duration === 3),
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
  const mawStrike = maw.resolvedEvents.find((event) => event.type === 'damage' && event.skillName === "Dragon's Maw");

  assert.deepEqual(maw.warnings, []);
  assert.equal(mawStrike.coefficient, 3.6);
  assert.equal(
    maw.resolvedEvents.some((event) => event.condition === 'Slow' && event.duration === 4),
    true
  );
  assert.equal(
    maw.resolvedEvents.some((event) => event.condition === 'Crippled' && event.duration === 4),
    true
  );
  assert.equal(
    maw.events.some(
      (event) => event.type === 'buff' && event.kind === 'might' && event.stacks === 10 && event.duration === 8
    ),
    true
  );
  assert.equal(
    maw.procSteps.some((step) => step.skill === 'Heavy Light'),
    true
  );
  assert.equal(
    maw.procSteps.some((step) => step.skill === "Hunter's Determination"),
    true
  );
  assert.equal(maw.planningState.profession.endurance, 100);
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

test('Glacial Heart and Master of Consecrations replace their numeric effects', () => {
  const glacial = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    primaryWeapon: 'Hammer',
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.GLACIAL_HEART]
  })(undefined, ['Glacial Blow']);
  const purging = createObservedProfessionSimulator(guardianProfession, {
    ...config,
    selectedTraitIds: [GUARDIAN_TRAIT_IDS.MASTER_OF_CONSECRATIONS]
  })(undefined, ['Purging Flames', { type: 'wait', durationMs: 9000 }]);

  assert.deepEqual(glacial.warnings, []);
  assert.equal(
    glacial.resolvedEvents.some(
      (event) => event.type === 'damage' && event.skillName === 'Glacial Blow' && event.coefficient === 2.5
    ),
    true
  );
  assert.equal(
    glacial.resolvedEvents.some((event) => event.type === 'combo' && event.skillName === 'Glacial Blow'),
    false
  );
  assert.equal(
    glacial.resolvedEvents.some((event) => event.condition === 'Chilled' && event.duration === 2.5),
    true
  );
  assert.equal(
    purging.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Purging Flames').length,
    8
  );
  assert.deepEqual(
    purging.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillName === 'Purging Flames')
      .map((event) => Math.round(event.at * 1000)),
    [320, 1320, 2320, 3320, 4320, 5320, 6320, 7320]
  );
  const purgingAction = purging.events.find((event) => event.type === 'action' && event.skillName === 'Purging Flames');

  assert.equal(purgingAction.comboFields[0].fieldType, 'Fire');
  assert.equal(purgingAction.comboFields[0].duration, 7);
});

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

  assert.equal(result.planningState.profession.availableFlips[GUARDIAN_SKILL_IDS.SPEAR_OF_JUSTICE], undefined);
  assert.equal(professionSkillNames.includes('Spear of Justice'), false);
  assert.equal(professionSkillNames.filter((name) => name === 'Exit Radiant Forge').length, 1);
});

test('elite specializations expose their profession mechanics', () => {
  const spear = guardianCatalog.skillsByName.get('Spear of Justice');
  const verdict = guardianCatalog.skillsByName.get("Hunter's Verdict");
  const dragonhunter = guardianProfession.ui.paletteGroups({
    specialization: 'Dragonhunter'
  })[0].skillIds;
  const firebrand = guardianProfession.ui
    .paletteGroups({
      specialization: 'Firebrand',
      professionState: {
        activeTome: 'justice',
        tomePages: { value: 5, maximum: 5, updatedAt: 0, rate: 0, interval: 8, amount: 1, nextAt: Infinity }
      }
    })
    .flatMap((group) => group.skillIds);
  const firebrandResources = guardianProfession.ui.resourceViews({
    specialization: 'Firebrand',
    simulationTime: 10,
    professionState: {
      tomePages: { value: 3, maximum: 5, updatedAt: 0, rate: 0, interval: 8, amount: 1, nextAt: Infinity },

      tomeDormantReadyAt: { justice: 20, resolve: 10, courage: 0 }
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
  const initial = createObservedProfessionSimulator(guardianProfession, { ...config, startingWeaponSet: 2 })(
    undefined,
    []
  );
  const swapped = createObservedProfessionSimulator(guardianProfession, { ...config, startingWeaponSet: 2 })(
    undefined,
    ['Swap Weapons']
  );

  assert.equal(initial.planningState.activeWeaponSet, 2);
  assert.equal(swapped.planningState.activeWeaponSet, 1);
  assert.equal(swapped.events.find((event) => event.type === 'weapon_set').weaponSet, 1);
});

test('Guardian builds migrate and validate against real catalog metadata', () => {
  const defaults = createGuardianBuildDefaults();
  const migrated = migrateGuardianBuild({
    ...defaults,
    rotation: ['Virtue of Justice', 'True Strike']
  });

  assert.equal(validateGuardianBuild(migrated).valid, true);
  assert.deepEqual(
    migrated.rotation.map((command) => command.skillId),
    [
      guardianProfession.catalog.skillsByName.get('Virtue of Justice').id,
      guardianProfession.catalog.skillsByName.get('True Strike').id
    ]
  );
  assert.equal(
    validateGuardianBuild({
      ...migrated,
      weapons: ['Greatsword', 'Torch']
    }).valid,
    false
  );
});

test('Guardian is registered at the profession composition boundary', async () => {
  assert.equal(await loadProfession('guardian'), guardianProfession);
});
