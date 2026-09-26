import assert from 'node:assert/strict';
import test from 'node:test';
import { observeGw2Runtime, runtimeFor } from '#tests/helpers/live-runtime.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { SCOURGE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';
import { necromancerLifeForceCostMultiplier } from '#gw2/professions/necromancer/core/state.js';

const base = {
  specialization: 'Scourge',
  initialResource: 100,
  stats: { power: 1000, precision: 1000, vitality: 1000 },
  target: { armor: 2597, health: 0, conditions: {} }
};
const cast = (skillId) => ({ type: 'cast', skillId });
const wait = (durationMs) => ({ type: 'wait', durationMs });
const run = (rotation, config = base, extra = {}) =>
  observeGw2Runtime({ profession: necromancerProfession.liveRuntimeFor(config), config, rotation, ...extra });
const state = (result) => runtimeFor(result).profession.specialization.state;
function patched(config, balanceProfiles) {
  const native = necromancerProfession.liveRuntimeFor(config);
  return { ...native, catalog: applyBalanceProfilePatch(native.catalog, { balanceProfiles }) };
}

// Shade state commits at completion, then expires at its own boundary without a restored scheduler snapshot.
test('Manifest owns an exact shade lifetime and cancelled casts create no shade or strike', () => {
  const created = run([cast(ID.MANIFEST_SAND_SHADE)]);
  assert.deepEqual(state(created).shades, [15.48]);
  assert.equal(
    created.events.some((event) => event.type === 'necromancer.state'),
    false
  );
  assert.deepEqual(state(run([cast(ID.MANIFEST_SAND_SHADE), wait(15000)])).shades, []);
  const cancelled = run([{ ...cast(ID.MANIFEST_SAND_SHADE), interruptAfterMs: 100 }]);
  assert.deepEqual(state(cancelled).shades, []);
  assert.equal(cancelled.totalDamage, 0);
  const noLifetime = run([cast(ID.MANIFEST_SAND_SHADE)], base, {
    profession: patched(base, {
      [PROFILE.shade]: { removeEffects: [{ type: 'buff', name: 'active-shade' }] }
    })
  });
  assert.deepEqual(state(noLifetime).shades, []);
  assert.ok(noLifetime.totalDamage > 0);
});

test('Sand Savant selects the live ammo cap and modified recharge work', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.SAND_SAVANT, TRAIT.SINISTER_SHROUD] };
  const one = run([cast(ID.MANIFEST_SAND_SHADE)], config);
  const ammo = runtimeFor(one).ammo.get(ID.MANIFEST_SAND_SHADE);
  assert.equal(ammo.maximum, 1);
  assert.equal(ammo.charges, 0);
  assert.equal(ammo.rechargeWork, 15 * 0.85 * 1.25);
  assert.deepEqual(state(one).shades, [8.48]);
  const recharged = run([cast(ID.MANIFEST_SAND_SHADE), cast(ID.MANIFEST_SAND_SHADE)], config);
  assert.ok(recharged.steps[1].start > 8000);
  assert.equal(state(recharged).shades.length, 1);
  assert.deepEqual(recharged.warnings, []);
  const ordinary = run([cast(ID.MANIFEST_SAND_SHADE), cast(ID.MANIFEST_SAND_SHADE)]);
  assert.equal(runtimeFor(ordinary).ammo.get(ID.MANIFEST_SAND_SHADE).charges, 1);
  assert.equal(state(ordinary).shades.length, 2);
});

test('shade skills consume Core life force once and never enter a draining shroud', () => {
  const result = run([cast(ID.DESERT_SHROUD)]);
  const core = result.planningState.profession;
  assert.equal(core.lifeForce.value, 100 - 50 * core.lifeForceCostMultiplier);
  assert.equal(core.activeShroud, '');
  assert.equal(core.lifeForce.rate, 0);
  const rejected = run([cast(ID.DESERT_SHROUD)], { ...base, selectedTraitIds: [TRAIT.HERALD_OF_SORROW] });
  assert.equal(rejected.steps[0].invalid, true);
  assert.equal(rejected.planningState.profession.lifeForce.value, 100);
  assert.equal(run([cast(ID.SANDSTORM_SHROUD)]).steps[0].invalid, true);
});

// An overlap may wait for an already casting channel, but a miss cannot promise resources after that finite lane ends.
test('a shade overlap waits for an accepted channel hit and rejects a missed channel after completion', () => {
  const config = { ...base, initialResource: 50 * necromancerLifeForceCostMultiplier(base) - 1 };
  const rotation = [cast(ID.GHASTLY_CLAWS), { ...cast(ID.DESERT_SHROUD), concurrentOffsetMs: 0 }];
  const result = run(rotation, config);
  assert.deepEqual(result.warnings, []);
  assert.ok(result.steps[1].start > result.steps[0].start);
  assert.ok(result.steps[1].start < result.steps[0].end);
  const missed = run([{ ...rotation[0], offTarget: true }, rotation[1]], config);
  assert.equal(missed.steps[1].invalid, true);
  assert.equal(missed.steps[1].start, missed.steps[0].end);
  assert.equal(missed.planningState.profession.lifeForce.value, config.initialResource);
});

test('Nourishing Ashes grants from accepted Burning before a subsequent shade command', () => {
  const config = { ...base, initialResource: 10, selectedTraitIds: [TRAIT.DHUUMFIRE, TRAIT.NOURISHING_ASHES] };
  const result = run([cast(ID.MANIFEST_SAND_SHADE), cast(ID.NEFARIOUS_FAVOR)], config);
  assert.deepEqual(result.warnings, []);
  assert.equal(state(result).nourishingAshesReadyAt, 3.44);
  const missed = run([{ ...cast(ID.MANIFEST_SAND_SHADE), offTarget: true }, cast(ID.NEFARIOUS_FAVOR)], config);
  assert.equal(missed.steps.at(-1).invalid, true);
  assert.equal(state(missed).nourishingAshesReadyAt, 0);
  const pending = run([{ ...cast(ID.MANIFEST_SAND_SHADE), impactDelayMs: 1000 }, cast(ID.NEFARIOUS_FAVOR)], config);
  assert.equal(pending.steps.at(-1).invalid, true);
  assert.equal(pending.planningState.profession.lifeForce.value, 10);
});

test('Demonic Lore derived Burning reaches the same live Nourishing Ashes cooldown', () => {
  const config = { ...base, initialResource: 0, selectedTraitIds: [TRAIT.DEMONIC_LORE, TRAIT.NOURISHING_ASHES] };
  const result = run([cast(ID.MANIFEST_SAND_SHADE), cast(ID.MANIFEST_SAND_SHADE)], config);
  assert.equal(result.planningState.profession.lifeForce.value, 5);
  assert.equal(
    result.resolvedEvents.filter((event) => event.type === 'condition' && event.sourceId === TRAIT.DEMONIC_LORE).length,
    1
  );
  assert.deepEqual(result.warnings, []);
});

test('Sandstorm barriers use live Sand Sage attributes at each pulse and at detonation', () => {
  const config = {
    ...base,
    selectedTraitIds: [TRAIT.HERALD_OF_SORROW, TRAIT.SAND_SAGE, TRAIT.ABRASIVE_GRIT, TRAIT.DESERT_EMPOWERMENT]
  };
  const profession = patched(config, {
    [PROFILE.shade]: { effects: [{ type: 'buff', name: 'active-shade', duration: 1.5 }] }
  });
  const result = run([cast(ID.MANIFEST_SAND_SHADE), cast(ID.SANDSTORM_SHROUD), wait(4000)], config, { profession });
  const boons = result.resolvedEvents.filter(
    (event) => event.type === 'buff' && event.kind === 'alacrity' && event.skillId === ID.SANDSTORM_SHROUD
  );
  assert.equal(boons.length, 4);
  assert.ok(boons[0].duration > boons.at(-1).duration);
  assert.equal(boons.at(-1).duration, 1.5);
  assert.deepEqual(state(result).shades, []);
});

test('removed Sandstorm protection pulses leave detonation and its barrier traits independent', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.HERALD_OF_SORROW, TRAIT.DESERT_EMPOWERMENT] };
  const profession = patched(config, {
    [PROFILE.sandstormShroud]: { removeEffects: [{ type: 'boon', name: 'protection pulses' }] }
  });
  const result = run([cast(ID.SANDSTORM_SHROUD), wait(4000)], config, { profession });
  const protection = result.resolvedEvents.filter((event) => event.kind === 'protection');
  assert.equal(protection.length, 1);
  assert.equal(protection[0].at, 3.5);
  assert.equal(result.resolvedEvents.filter((event) => event.kind === 'alacrity').length, 1);
  assert.ok(result.totalDamage > 0);
  assert.equal(
    run([cast(ID.SANDSTORM_SHROUD), wait(4000)], config, { profession, output: 'score' }).totalDamage,
    result.totalDamage
  );
});

test('Desert Shroud pulses preserve selected conditions after strike removal and respect the observation end', () => {
  const profession = patched(base, { [PROFILE.desertShroud]: { removeEffects: [{ type: 'strike', name: 'Strike' }] } });
  const result = run([cast(ID.DESERT_SHROUD), wait(1500)], base, { profession });
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.sourceId === ID.DESERT_SHROUD),
    false
  );
  assert.ok(result.resolvedEvents.some((event) => event.type === 'condition' && event.sourceId === ID.DESERT_SHROUD));
  assert.ok(result.events.every((event) => event.at <= 1.5));
  assert.deepEqual(result.warnings, []);
});

test('replacing a capped shade cannot expire a surviving shade at the discarded deadline', () => {
  const rotation = [
    cast(ID.MANIFEST_SAND_SHADE),
    cast(ID.MANIFEST_SAND_SHADE),
    cast(ID.MANIFEST_SAND_SHADE),
    { type: 'cooldown-reset' },
    cast(ID.MANIFEST_SAND_SHADE),
    wait(13560)
  ];
  const result = run(rotation);
  assert.deepEqual(state(result).shades, [15.96, 16.44, 16.92]);
  assert.deepEqual(state(run([...rotation, wait(480)])).shades, [16.44, 16.92]);
  assert.deepEqual(result.warnings, []);
});

test('Nefarious Favor cleanses one condition type and F5 transfers only on an accepted hit', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.PLAGUE_SENDING] };
  const native = necromancerProfession.liveRuntimeFor(config);
  const profession = {
    ...native,
    initialize(runtime) {
      native.initialize(runtime);
      runtime.profession.core.selfConditions = ['Bleeding', 'Bleeding', 'Burning'].map((condition) => ({
        condition,
        appliedAt: 0,
        expiresAt: 10,
        stacks: 1,
        sourceSkillId: ID.BLOOD_IS_POWER
      }));
    }
  };
  const cleanse = run([cast(ID.NEFARIOUS_FAVOR)], config, { profession });
  assert.deepEqual(
    cleanse.planningState.profession.selfConditions.map((entry) => entry.condition),
    ['Burning']
  );
  const hit = run([cast(ID.NEFARIOUS_FAVOR), cast(ID.DESERT_SHROUD)], config, { profession });
  assert.deepEqual(hit.planningState.profession.selfConditions, []);
  assert.equal(runtimeFor(hit).profession.core.plagueSendingArmed, false);
  assert.ok(hit.resolvedEvents.some((event) => event.transferredCondition && event.condition === 'Burning'));
  const missed = run([cast(ID.NEFARIOUS_FAVOR), { ...cast(ID.DESERT_SHROUD), offTarget: true }], config, {
    profession
  });
  assert.equal(missed.planningState.profession.selfConditions.length, 1);
  assert.equal(runtimeFor(missed).profession.core.plagueSendingArmed, true);
});

test('later Sandstorm barriers include companions summoned after the first pulse', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.HERALD_OF_SORROW] };
  const result = run([cast(ID.SANDSTORM_SHROUD), cast(ID.SUMMON_BONE_MINIONS), wait(4000)], config);
  const protection = result.resolvedEvents.filter((event) => event.kind === 'protection');
  assert.equal(protection[0].resolvedAudience.companionIds.length, 0);
  assert.equal(protection.at(-1).resolvedAudience.companionIds.length, 2);
  assert.deepEqual(result.warnings, []);
});
