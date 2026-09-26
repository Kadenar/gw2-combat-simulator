import assert from 'node:assert/strict';
import test from 'node:test';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { WARRIOR_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/core/profiles.js';

// Exercise Core through the registered live family and its selected catalog.
function run(rotation, overrides = {}, profession = warriorProfession, output = 'detailed') {
  const config = {
    specialization: 'Core',
    primaryWeapon: 'Axe',
    initialResource: 0,
    selectedTraitIds: [],
    stats: { power: 2000, precision: 1000 },
    target: { armor: 2597 },
    ...overrides
  };
  return observeGw2Runtime({
    profession: profession.runtimeFor(config),
    config,
    rotation,
    output
  });
}

test('Burst Mastery refunds a completed miss but cannot refund a canceled spend', () => {
  const config = { primaryWeapon: 'Greatsword', initialResource: 30, selectedTraitIds: [TRAIT.BURST_MASTERY] };
  const completed = run([{ name: 'Arcing Slice', offTarget: true }], config);
  assert.deepEqual(completed.warnings, []);
  assert.equal(completed.planningState.profession.adrenaline, 30 * 0.33);
  assert.ok(
    completed.resolvedEvents.some((event) => event.sourceId === TRAIT.BURST_MASTERY && event.kind === 'swiftness')
  );
  const landed = run(['Arcing Slice'], config);
  assert.ok(
    landed.resolvedEvents.findIndex((event) => event.type === 'damage') <
      landed.resolvedEvents.findIndex((event) => event.sourceId === TRAIT.BURST_MASTERY)
  );
  const cancelled = run([{ name: 'Arcing Slice', interruptAfterMs: 1 }], config);
  assert.equal(cancelled.planningState.profession.adrenaline, 0);
  assert.equal(
    cancelled.resolvedEvents.some((event) => event.sourceId === TRAIT.BURST_MASTERY),
    false
  );
});

test('Empower Allies queues its selected party Might cadence and stops when the component is removed', () => {
  const config = { selectedTraitIds: [TRAIT.EMPOWER_ALLIES] };
  const rotation = [{ type: 'wait', durationMs: 21000 }];
  const result = run(rotation, config);
  assert.deepEqual(result.warnings, []);
  const pulses = result.resolvedEvents.filter((event) => event.sourceId === TRAIT.EMPOWER_ALLIES);
  assert.deepEqual(
    pulses.map((event) => event.at),
    [0, 10, 20]
  );
  assert.ok(pulses.every((event) => event.audience.recipients === 'party'));
  for (const edit of [{ removeEffects: [{ type: 'boon' }] }, { fields: { pulseInterval: 0 } }]) {
    const profession = withPatchPreview(warriorProfession, {
      id: 'empower-live',
      label: 'Empower live',
      professions: { warrior: { balanceProfiles: { [PROFILE.empowerAllies]: edit } } }
    });
    const removed = run(rotation, { ...config, patchId: 'empower-live' }, profession);
    assert.deepEqual(removed.warnings, []);
    assert.equal(
      removed.resolvedEvents.some((event) => event.sourceId === TRAIT.EMPOWER_ALLIES),
      false
    );
  }
});

test('critical burst reactions share the resolved outcome for resources and independently selected conditions', () => {
  const profession = withPatchPreview(warriorProfession, {
    id: 'critical-live',
    label: 'Critical live',
    professions: {
      warrior: {
        balanceProfiles: {
          [PROFILE.bloodlust]: { fields: { procChance: 1 } }
        }
      }
    }
  });
  const config = {
    patchId: 'critical-live',
    initialResource: 30,
    stats: { power: 2000, precision: 4000 },
    selectedTraitIds: [TRAIT.FURIOUS, TRAIT.AXE_MASTERY, TRAIT.BLOODLUST, TRAIT.SUNDERING_BURST]
  };
  const result = run(['Eviscerate'], config, profession);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.adrenaline, 4);
  assert.equal(result.resolvedEvents.find((event) => event.sourceId === TRAIT.SUNDERING_BURST).stacks, 10);
  const bleeding = result.resolvedEvents.find((event) => event.sourceId === TRAIT.BLOODLUST);
  assert.equal(bleeding.skillName, 'Bloodlust');
  assert.equal(bleeding.triggeredBy, 'Eviscerate');
  assert.equal(bleeding.metadata.procCount, 1);
  assert.equal(result.resolvedEvents.find((event) => event.kind === 'furious-surge').stacks, 1);
  const noncritical = run(['Eviscerate'], { ...config, stats: { power: 2000, precision: 0 } }, profession);
  assert.equal(noncritical.planningState.profession.adrenaline, 1);
  assert.equal(noncritical.resolvedEvents.find((event) => event.sourceId === TRAIT.SUNDERING_BURST).stacks, 5);
  assert.equal(
    noncritical.resolvedEvents.some((event) => event.sourceId === TRAIT.BLOODLUST || event.kind === 'furious-surge'),
    false
  );
});

test('seeded critical traits agree in detailed and score runs without reading report collections', () => {
  const config = {
    primaryWeapon: 'Rifle',
    stats: { power: 2000, precision: 1800 },
    randomness: { mode: 'seeded', seed: 77 },
    selectedTraitIds: [TRAIT.FURIOUS, TRAIT.BLOODLUST, TRAIT.FORCEFUL_GREATSWORD]
  };
  const rotation = Array(20).fill('Fierce Shot');
  const detailed = run(rotation, config);
  const score = run(rotation, config, warriorProfession, 'score');
  assert.deepEqual(detailed.warnings, []);
  assert.equal(score.totalDamage, detailed.totalDamage);
  assert.equal(score.conditionDamage, detailed.conditionDamage);
  assert.equal(observedRuntime(score).profession.core.adrenaline, observedRuntime(detailed).profession.core.adrenaline);
  assert.ok(detailed.resolvedEvents.some((event) => event.sourceId === TRAIT.FORCEFUL_GREATSWORD));
  assert.ok(detailed.resolvedEvents.some((event) => event.sourceId === TRAIT.BLOODLUST));
});

test('accepted control shares Opportunist cooldown while independent control traits keep their own grants', () => {
  const config = {
    selectedSkills: ['Kick'],
    selectedTraitIds: [
      TRAIT.OPPORTUNIST,
      TRAIT.MERCILESS_HAMMER,
      TRAIT.STALWART_STRENGTH,
      TRAIT.BODY_BLOW,
      TRAIT.AGGRESSIVE_ONSLAUGHT
    ]
  };
  const profession = withPatchPreview(warriorProfession, {
    id: 'control-live',
    label: 'Control live',
    professions: {
      warrior: {
        balanceProfiles: {
          [PROFILE.opportunist]: { fields: { internalCooldown: 100 } }
        }
      }
    }
  });
  const result = run(['Kick', 'Kick'], { ...config, patchId: 'control-live' }, profession);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.adrenaline, 21);
  const from = (trait) => result.resolvedEvents.filter((event) => event.sourceId === trait);
  assert.equal(from(TRAIT.OPPORTUNIST).length, 1);
  assert.equal(from(TRAIT.STALWART_STRENGTH).length, 2);
  assert.equal(from(TRAIT.AGGRESSIVE_ONSLAUGHT).length, 2);
  assert.equal(from(TRAIT.BODY_BLOW).filter((event) => event.condition === 'Weakness').length, 2);
  const missed = run([{ name: 'Kick', offTarget: true }], config);
  assert.equal(missed.planningState.profession.adrenaline, 0);
  assert.deepEqual({ ...observedRuntime(missed).procs.readyAt }, {});
  assert.equal(observedRuntime(missed).profession.core.targetControlledUntil, 0);
});

test('Leg Specialist derives accepted immobilization without turning an effect into a player trigger', () => {
  const config = { selectedTraitIds: [TRAIT.LEG_SPECIALIST, TRAIT.OPPORTUNIST] };
  const result = run(['Throw Axe'], config);
  assert.deepEqual(result.warnings, []);
  const immobilize = result.resolvedEvents.find((event) => event.condition === 'Immobilized');
  assert.equal(immobilize.sourceId, TRAIT.LEG_SPECIALIST);
  assert.equal(immobilize.actorType, 'effect');
  assert.equal(
    result.resolvedEvents.some((event) => event.sourceId === TRAIT.OPPORTUNIST),
    false
  );
  const player = run(['Pin Down'], { ...config, primaryWeapon: 'Longbow' });
  assert.deepEqual(player.warnings, []);
  assert.equal(player.planningState.profession.adrenaline, 6);
  assert.ok(player.resolvedEvents.some((event) => event.sourceId === TRAIT.OPPORTUNIST));
  const missed = run([{ name: 'Throw Axe', offTarget: true }], config);
  assert.equal(
    missed.resolvedEvents.some((event) => event.sourceId === TRAIT.LEG_SPECIALIST),
    false
  );
});

test('a multi-hit burst claims captured-tier rewards and endurance once after the first surviving strike', () => {
  const config = {
    primaryWeapon: 'Longbow',
    initialResource: 30,
    selectedTraitIds: [TRAIT.BUILDING_MOMENTUM, TRAIT.BERSERKERS_POWER, TRAIT.BURST_PRECISION, TRAIT.CULL_THE_WEAK]
  };
  const rotation = ['Dodge', 'Dodge', 'Combustive Shot', { type: 'wait', durationMs: 6500 }];
  const result = run(rotation, config);
  const baseline = run(rotation, { ...config, selectedTraitIds: [] });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.endurance - baseline.planningState.profession.endurance, 15);
  const power = result.resolvedEvents.filter((event) => event.kind === 'berserkers-power');
  assert.equal(power.length, 1);
  assert.equal(power[0].stacks, 4);
  const precision = result.resolvedEvents.filter((event) => event.kind === 'burst-precision');
  assert.equal(precision.length, 1);
  assert.equal(precision[0].duration, 4);
  assert.equal(result.resolvedEvents.filter((event) => event.sourceId === TRAIT.CULL_THE_WEAK).length, 1);
  assert.ok(
    result.resolvedEvents.findIndex((event) => event.type === 'damage') < result.resolvedEvents.indexOf(power[0])
  );
  const missed = run(['Dodge', { name: 'Combustive Shot', offTarget: true }], config);
  assert.equal(
    missed.resolvedEvents.some((event) => event.kind === 'berserkers-power' || event.kind === 'burst-precision'),
    false
  );
  assert.deepEqual(observedRuntime(missed).profession.core.burstHitActivations, {});
});

test('Soldier Focus starts at the arriving burst hit and its party rewards do not repeat on pulses', () => {
  const result = run(
    [
      { name: 'Combustive Shot', impactDelayMs: 1000 },
      { type: 'wait', durationMs: 10000 }
    ],
    {
      primaryWeapon: 'Longbow',
      initialResource: 30,
      selectedTraitIds: [TRAIT.MARCHING_ORDERS, TRAIT.SOLDIERS_COMFORT, TRAIT.MARTIAL_CADENCE]
    }
  );
  assert.deepEqual(result.warnings, []);
  const first = result.resolvedEvents.find((event) => event.type === 'damage');
  for (const trait of [TRAIT.MARCHING_ORDERS, TRAIT.SOLDIERS_COMFORT, TRAIT.MARTIAL_CADENCE]) {
    const applications = result.resolvedEvents.filter((event) => event.sourceId === trait);
    assert.equal(applications.length, 1);
    assert.equal(applications[0].at, first.at);
    assert.equal(applications[0].audience.recipients, 'party');
  }

  assert.equal(observedRuntime(result).profession.core.soldierFocusReadyAt, first.at + 10);
});

test('heal acceptance grants Protection while Signet Mastery requires completion', () => {
  const config = { selectedSkills: ['Healing Signet'], selectedTraitIds: [TRAIT.THICK_SKIN, TRAIT.SIGNET_MASTERY] };
  const completed = run(['Healing Signet'], config);
  const cancelled = run([{ name: 'Healing Signet', interruptAfterMs: 1 }], config);
  for (const result of [completed, cancelled]) {
    assert.deepEqual(result.warnings, []);
    assert.equal(result.resolvedEvents.find((event) => event.kind === 'protection').at, 0);
  }

  assert.ok(completed.resolvedEvents.some((event) => event.kind === 'signet-mastery'));
  assert.equal(
    cancelled.resolvedEvents.some((event) => event.kind === 'signet-mastery'),
    false
  );
});

test('movement completion grants Brave Stride and Peak Performance precedes the Physical impact', () => {
  const config = { selectedSkills: ['Kick'], selectedTraitIds: [TRAIT.BRAVE_STRIDE, TRAIT.PEAK_PERFORMANCE] };
  const completed = run(['Kick'], config);
  assert.deepEqual(completed.warnings, []);
  assert.equal(completed.planningState.profession.adrenaline, 6);
  const events = completed.resolvedEvents;
  const peak = events.findIndex((event) => event.kind === 'peak-performance');
  const strike = events.findIndex((event) => event.type === 'damage' && event.skillId === ID.KICK);
  assert.ok(peak >= 0 && strike > peak);
  assert.ok(events.some((event) => event.sourceId === TRAIT.BRAVE_STRIDE && event.kind === 'stability'));
  const cancelled = run([{ name: 'Kick', interruptAfterMs: 1 }], config);
  assert.equal(cancelled.planningState.profession.adrenaline, 0);
  assert.equal(
    cancelled.resolvedEvents.some((event) => event.sourceId === TRAIT.BRAVE_STRIDE),
    false
  );
  assert.ok(cancelled.resolvedEvents.some((event) => event.kind === 'peak-performance'));
});

test('Lesser Signet claims one cooldown on an accepted hit against the current low-health target', () => {
  const config = {
    primaryWeapon: 'Rifle',
    selectedTraitIds: [TRAIT.SIGNET_MASTERY],
    target: { armor: 2597, health: 1000000, startingHealthFraction: 0.4 }
  };
  const result = run([{ name: 'Fierce Shot', offTarget: true }, 'Fierce Shot', 'Fierce Shot'], config);
  assert.deepEqual(result.warnings, []);
  const hit = result.resolvedEvents.find((event) => event.type === 'damage');
  const grants = result.resolvedEvents.filter((event) => event.kind === 'signet-mastery');
  assert.equal(grants.length, 1);
  assert.equal(grants[0].at, hit.at);
  assert.ok(observedRuntime(result).procs.readyAt[TRAIT.SIGNET_MASTERY] > hit.at);
  const healthy = run(['Fierce Shot'], { ...config, target: { ...config.target, startingHealthFraction: 1 } });
  assert.equal(
    healthy.resolvedEvents.some((event) => event.kind === 'signet-mastery'),
    false
  );
});

test('Reckless Dodge components resolve independently and removed strikes cannot grant hit resources', () => {
  const config = { selectedTraitIds: [TRAIT.RECKLESS_DODGE] };
  const completed = run(['Dodge'], config);
  assert.deepEqual(completed.warnings, []);
  assert.equal(completed.planningState.profession.adrenaline, 1);
  assert.ok(
    completed.resolvedEvents.some((event) => event.sourceId === TRAIT.RECKLESS_DODGE && event.type === 'damage')
  );
  const profession = withPatchPreview(warriorProfession, {
    id: 'reckless-live',
    label: 'Reckless live',
    professions: {
      warrior: {
        balanceProfiles: {
          [PROFILE.recklessDodge]: { removeEffects: [{ type: 'strike' }] }
        }
      }
    }
  });
  const removed = run(['Dodge'], { ...config, patchId: 'reckless-live' }, profession);
  assert.deepEqual(removed.warnings, []);
  assert.equal(removed.planningState.profession.adrenaline, 0);
  assert.ok(removed.resolvedEvents.some((event) => event.sourceId === TRAIT.RECKLESS_DODGE && event.kind === 'might'));
});

test('Combustive Shot owns one captured tier field and its finite persistent pulses', () => {
  for (const tier of [1, 2, 3]) {
    const result = run(['Combustive Shot', 'Signet of Fury', { type: 'wait', durationMs: 10000 }], {
      primaryWeapon: 'Longbow',
      initialResource: tier * 10,
      selectedSkills: ['Signet of Fury']
    });
    assert.deepEqual(result.warnings, []);
    const fields = result.events.filter(
      (event) => event.type === 'combo_field' && event.skillId === ID.COMBUSTIVE_SHOT
    );
    assert.equal(fields.length, 1);
    assert.equal(fields[0].expiresAt - fields[0].at, tier * 3);
    const pulses = result.resolvedEvents.filter(
      (event) => event.type === 'damage' && event.skillId === ID.COMBUSTIVE_SHOT
    );
    assert.equal(pulses.length, tier + 1);
    assert.ok(pulses.every((event) => event.metadata.warriorBurstTier === tier));
    assert.equal(pulses.at(-1).at, fields[0].expiresAt);
  }

  const cancelled = run(
    [
      { name: 'Combustive Shot', interruptAfterMs: 1 },
      { type: 'wait', durationMs: 10000 }
    ],
    { primaryWeapon: 'Longbow', initialResource: 30 }
  );
  assert.deepEqual(cancelled.warnings, []);
  assert.equal(
    cancelled.events.some(
      (event) => event.type === 'combo_field' || event.type === 'damage' || event.type === 'condition'
    ),
    false
  );
});

test('Combustive Shot component removal preserves independent conditions and zero cadence cannot recur', () => {
  const profession = withPatchPreview(warriorProfession, {
    id: 'combustive-live',
    label: 'Combustive live',
    professions: {
      warrior: {
        balanceProfiles: {
          [PROFILE.combustiveShot]: { removeEffects: [{ type: 'strike' }], fields: { pulseInterval: 0 } }
        }
      }
    }
  });
  const result = run(
    ['Combustive Shot', { type: 'wait', durationMs: 10000 }],
    { patchId: 'combustive-live', primaryWeapon: 'Longbow', initialResource: 30 },
    profession
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.skillId === ID.COMBUSTIVE_SHOT),
    false
  );
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'condition' && event.skillId === ID.COMBUSTIVE_SHOT).length,
    1
  );
  assert.ok(result.conditionDamage > 0);
});

test('a landed hit funds the next burst and misses cannot grant adrenaline', () => {
  const hit = run(['Chop', 'Eviscerate'], { initialResource: 9 });
  assert.deepEqual(hit.warnings, []);
  assert.equal(hit.planningState.profession.adrenaline, 1);
  const missed = run([{ name: 'Chop', offTarget: true }, 'Eviscerate'], { initialResource: 9 });
  assert.equal(missed.steps[1].invalid, true);
  assert.equal(missed.planningState.profession.adrenaline, 9);
});

test('pending travel cannot fund an earlier burst but its accepted impact can fund a later one', () => {
  const result = run(
    [{ name: 'Chop', impactDelayMs: 1000 }, 'Eviscerate', { type: 'wait', durationMs: 1000 }, 'Eviscerate'],
    { initialResource: 9 }
  );
  assert.equal(result.steps[1].invalid, true);
  assert.equal(Boolean(result.steps.at(-1).invalid), false);
  assert.equal(result.planningState.profession.adrenaline, 1);
});

test('burst tier is captured at spend and cancellation retains the spend without a hit gain', () => {
  const completed = run(['Arcing Slice'], { primaryWeapon: 'Greatsword', initialResource: 30 });
  assert.deepEqual(completed.warnings, []);
  const strike = completed.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.ARCING_SLICE);
  assert.equal(strike.metadata.warriorAdrenalineSpent, 30);
  assert.equal(strike.metadata.warriorBurstTier, 3);
  assert.equal(completed.planningState.profession.adrenaline, 1);
  const cancelled = run([{ name: 'Arcing Slice', interruptAfterMs: 1 }], {
    primaryWeapon: 'Greatsword',
    initialResource: 30
  });
  assert.deepEqual(cancelled.warnings, []);
  assert.equal(cancelled.planningState.profession.adrenaline, 0);
  assert.equal(
    cancelled.resolvedEvents.some((event) => event.type === 'damage'),
    false
  );
});

test('resource skills grant only on completion and their public state is detached', () => {
  const config = { selectedSkills: ['Signet of Fury'] };
  const cancelled = run([{ name: 'Signet of Fury', interruptAfterMs: 1 }], config);
  assert.equal(cancelled.planningState.profession.adrenaline, 0);
  const completed = run(['Signet of Fury'], config);
  assert.deepEqual(completed.warnings, []);
  assert.equal(completed.planningState.profession.adrenaline, 30);
  completed.planningState.profession.adrenaline = 0;
  assert.equal(observedRuntime(completed).profession.core.adrenaline, 30);
});

test('signet readiness rechecks successive actual pulses and recharge suppression preserves cadence', () => {
  const result = run([{ type: 'combat-start' }, 'Eviscerate'], {
    initialResource: 6,
    selectedSkills: ['Signet of Rage']
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.steps.at(-1).start, 6000);
  assert.equal(result.planningState.profession.adrenaline, 1);
  const suppressed = run([{ type: 'combat-start' }, 'Signet of Rage', { type: 'wait', durationMs: 6000 }], {
    selectedSkills: ['Signet of Rage']
  });
  assert.deepEqual(suppressed.warnings, []);
  assert.equal(suppressed.planningState.profession.adrenaline, 0);
  assert.equal(observedRuntime(suppressed).profession.core.nextSignetPulseAt, 9);
});

test('Rifle Butt completion restores ammo and clears burst recharge while cancellation preserves both', () => {
  for (const cancelled of [false, true]) {
    const result = run(
      ['Kill Shot', 'Volley', { name: 'Rifle Butt', offTarget: true, ...(cancelled ? { interruptAfterMs: 1 } : {}) }],
      { primaryWeapon: 'Rifle', initialResource: 30 }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.ammo.Volley.charges, cancelled ? 1 : 2);
    assert.equal(result.planningState.cooldowns['Kill Shot'] != null, cancelled);
  }
});

test('weapon recharge resets belong to completed activations independently of hostile hit acceptance', () => {
  for (const [weapon, secondaryWeapon, first, reset] of [
    ['Hammer', undefined, 'Fierce Blow', 'Backbreaker'],
    ['Mace', 'Mace', 'Crushing Blow', 'Tremor']
  ]) {
    for (const cancelled of [false, true]) {
      const result = run([first, { name: reset, offTarget: true, ...(cancelled ? { interruptAfterMs: 1 } : {}) }], {
        primaryWeapon: weapon,
        secondaryWeapon
      });
      assert.deepEqual(result.warnings, []);
      assert.equal(result.planningState.cooldowns[first] != null, cancelled, reset);
    }
  }
});

test('Counterblow arms one follow-up and a canceled manual attack still consumes it', () => {
  const config = { primaryWeapon: 'Mace' };
  const completed = run(['Counterblow', 'Tactical Blow'], config);
  assert.deepEqual(completed.warnings, []);
  assert.equal(completed.planningState.profession.adrenaline, 6);
  assert.equal(completed.planningState.profession.availableFlips[ID.TACTICAL_BLOW], undefined);
  const consumed = run(['Counterblow', { name: 'Tactical Blow', interruptAfterMs: 1 }, 'Tactical Blow'], config);
  assert.equal(consumed.steps.at(-1).invalid, true);
  assert.equal(consumed.planningState.profession.adrenaline, 0);
});

test('a canceled block or an expired channel cannot leave an available Tactical Blow', () => {
  for (const rotation of [
    [{ name: 'Counterblow', interruptAfterMs: 1 }, 'Tactical Blow'],
    ['Counterblow', { type: 'wait', durationMs: 3000 }, 'Tactical Blow']
  ]) {
    const result = run(rotation, { primaryWeapon: 'Mace' });
    assert.equal(result.steps.at(-1).invalid, true);
    assert.equal(result.planningState.profession.availableFlips[ID.TACTICAL_BLOW], undefined);
  }
});

test('weapon swaps commit the set before Core traits and repeated swaps share one Fury cooldown', () => {
  const config = {
    alternatePrimaryWeapon: 'Sword',
    selectedTraitIds: [TRAIT.VERSATILE_RAGE, TRAIT.FURIOUS_BURST, TRAIT.MARTIAL_CADENCE]
  };
  const first = run([{ type: 'combat-start' }, { type: 'wait', durationMs: 1000 }, 'Swap Weapons'], config);
  assert.deepEqual(first.warnings, []);
  assert.equal(first.planningState.activeWeaponSet, 2);
  assert.equal(observedRuntime(first).profession.core.soldierFocusReadyAt, 1);
  assert.equal(
    first.planningState.profession.adrenaline,
    warriorProfession.catalog.balanceProfilesById.get(TRAIT.VERSATILE_RAGE).resourceGain
  );
  const repeated = run([{ type: 'combat-start' }, 'Swap Weapons', { type: 'cooldown-reset' }, 'Swap Weapons'], config);
  assert.deepEqual(repeated.warnings, []);
  assert.equal(repeated.planningState.activeWeaponSet, 1);
  assert.equal(
    repeated.resolvedEvents.filter((event) => event.type === 'buff' && event.sourceId === TRAIT.FURIOUS_BURST).length,
    1
  );
});

test('Fierce Blow observes accepted control arriving during travel and excludes missed or expired control', () => {
  const coefficient = (rotation) => {
    const result = run(rotation, { primaryWeapon: 'Hammer' });
    assert.deepEqual(result.warnings, []);
    return result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.FIERCE_BLOW)
      .coefficient;
  };

  const baseline = coefficient(['Fierce Blow']);
  assert.equal(
    coefficient([{ name: 'Fierce Blow', impactDelayMs: 1000 }, 'Staggering Blow', { type: 'wait', durationMs: 1000 }]),
    baseline * 1.5
  );
  assert.equal(
    coefficient([
      { name: 'Fierce Blow', impactDelayMs: 1000 },
      { name: 'Staggering Blow', offTarget: true },
      { type: 'wait', durationMs: 1000 }
    ]),
    baseline
  );
  assert.equal(coefficient(['Staggering Blow', { type: 'wait', durationMs: 2000 }, 'Fierce Blow']), baseline);
});

test('Mighty Throw secondary-target shards create no damage or adrenaline opportunity', () => {
  const result = run(['Mighty Throw'], { primaryWeapon: 'Spear' });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.adrenaline, 1);
  assert.equal(
    result.resolvedEvents.some((event) => event.metadata?.packetKind === 'warrior.mighty-throw-shard'),
    false
  );
});

test('Gunstinger completion restores pistol ammunition while a canceled cast leaves the spent charge unavailable', () => {
  for (const cancelled of [false, true]) {
    const result = run(["Dragon's Roar", { name: 'Gunstinger', ...(cancelled ? { interruptAfterMs: 1 } : {}) }], {
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Pistol'
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.ammo["Dragon's Roar"].charges, cancelled ? 0 : 3);
  }
});

test("Dragon's Roar consumes its captured rounds and committed bullets survive the end of the cast", () => {
  const result = run(["Dragon's Roar", { type: 'wait', durationMs: 2000 }], { secondaryWeapon: 'Pistol' });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.ammo["Dragon's Roar"].charges, 0);
  const bullets = result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillId === ID.DRAGONS_ROAR);
  assert.equal(bullets.length, 6);
  assert.ok(bullets.at(-1).at > result.steps[0].end / 1000);
  const cancelled = run(
    [
      { name: "Dragon's Roar", interruptAfterMs: 1 },
      { type: 'wait', durationMs: 2000 }
    ],
    { secondaryWeapon: 'Pistol' }
  );
  assert.deepEqual(cancelled.warnings, []);
  assert.equal(cancelled.planningState.ammo["Dragon's Roar"].charges, 0);
  assert.equal(
    cancelled.resolvedEvents.some((event) => event.type === 'damage'),
    false
  );
});
