import assert from 'node:assert/strict';
import test from 'node:test';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { HARBINGER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/necromancer/specializations/harbinger/profiles.js';

const base = {
  specialization: 'Harbinger',
  initialResource: 30,
  stats: { power: 1000, precision: 1000, vitality: 1000 },
  target: { armor: 2597, health: 0, conditions: {} }
};
const cast = (skillId) => ({ type: 'cast', skillId });
const wait = (durationMs) => ({ type: 'wait', durationMs });
const run = (rotation, config = base, extra = {}) =>
  observeGw2Runtime({ profession: necromancerProfession.runtimeFor(config), config, rotation, ...extra });
const state = (result) => observedRuntime(result).profession.specialization.state;

// Real transition callbacks and owned deadlines keep passive Blight independent of observation partitioning.
test('Harbinger entry grants precede depletion and its passive clock stops on every exit', () => {
  const config = { ...base, initialResource: 0, selectedTraitIds: [TRAIT.CORRUPTED_TALENT] };
  const entered = run([cast(ID.HARBINGER_SHROUD), wait(1000)], config);
  assert.equal(entered.planningState.profession.activeShroud, 'harbinger');
  assert.equal(entered.planningState.profession.lifeForce.value, 10);
  assert.equal(state(entered).blight, 2);
  assert.deepEqual(entered.warnings, []);
  const depleted = run([cast(ID.HARBINGER_SHROUD), wait(2000)], { ...base, initialResource: 5 });
  assert.equal(depleted.planningState.profession.activeShroud, '');
  assert.equal(state(depleted).nextBlightAt, Infinity);
  assert.equal(state(depleted).blight, 0);
  const exited = run([cast(ID.HARBINGER_SHROUD), wait(1500), cast(ID.EXIT_HARBINGER_SHROUD), wait(2000)]);
  assert.equal(state(exited).blight, 2);
  assert.equal(state(exited).nextBlightAt, Infinity);
  const partitioned = run([cast(ID.HARBINGER_SHROUD), wait(1000), wait(1000), wait(1000)]);
  assert.deepEqual(state(partitioned), state(run([cast(ID.HARBINGER_SHROUD), wait(3000)])));
});

test('Blight expiry runs before same-time spending and records no replay state', () => {
  const result = run([wait(24640), cast(ID.ELIXIR_OF_BLISS)], { ...base, initialBlight: 5 });
  const strike = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.ELIXIR_OF_BLISS);
  assert.equal(strike.metadata.blightEmpowered, false);
  assert.equal(state(result).blight, 10);
  assert.deepEqual(state(result).blightExpiries, Array(10).fill(50));
  assert.equal(
    result.events.some((event) => event.type === 'necromancer.blight' || event.type === 'necromancer.state'),
    false
  );
  assert.equal(state(run([wait(25000)], { ...base, initialBlight: 5 })).blight, 0);
});

test('elixir launch spends once and delayed hostile impact preserves the selected empowerment', () => {
  const config = { ...base, initialBlight: 5 };
  const rotation = [{ ...cast(ID.ELIXIR_OF_RISK), impactDelayMs: 1000 }];
  const pending = run(rotation, config);
  assert.equal(state(pending).blight, 10);
  assert.equal(pending.totalDamage, 0);
  const arrived = run([...rotation, wait(1200)], config);
  const strike = arrived.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.ELIXIR_OF_RISK);
  assert.equal(strike.metadata.blightEmpowered, true);
  assert.equal(strike.metadata.necromancerBlight, 0);
  assert.deepEqual(arrived.warnings, []);
  const interrupted = run([{ ...cast(ID.ELIXIR_OF_RISK), interruptAfterMs: 100 }, wait(1000)], config);
  assert.equal(state(interrupted).blight, 5);
  assert.equal(interrupted.totalDamage, 0);
  const missed = run([{ ...cast(ID.ELIXIR_OF_RISK), offTarget: true }], config);
  assert.equal(missed.totalDamage, 0);
  assert.equal(state(missed).blight, 10);
});

test('Cascading Corruption commits one delayed Meltdown and expires its live window', () => {
  const config = {
    ...base,
    initialBlight: 5,
    initialCascadingCorruptionStacks: 19,
    selectedTraitIds: [TRAIT.CASCADING_CORRUPTION]
  };
  const rotation = [cast(ID.ELIXIR_OF_RISK)];
  const pending = run(rotation, config, { combatStartTime: 0 });
  assert.equal(state(pending).cascadingCorruptionStacks, 4);
  assert.equal(
    pending.resolvedEvents.some((event) => event.type === 'damage' && event.sourceId === TRAIT.CASCADING_CORRUPTION),
    false
  );
  const complete = run([...rotation, wait(11000)], config, { combatStartTime: 0 });
  assert.equal(
    complete.events.filter((event) => event.type === 'proc' && event.sourceId === TRAIT.CASCADING_CORRUPTION).length,
    1
  );
  assert.ok(
    complete.resolvedEvents.some((event) => event.type === 'damage' && event.sourceId === TRAIT.CASCADING_CORRUPTION)
  );
  assert.equal(state(complete).meltdownUntil, 0);
  assert.equal(
    run([...rotation, wait(11000)], config, { combatStartTime: 0, output: 'score' }).totalDamage,
    complete.totalDamage
  );
  const setup = run([...rotation, { type: 'combat-start' }], config);
  assert.equal(state(setup).cascadingCorruptionStacks, 19);
});

test('Vital Draw grants only the siphons that have arrived', () => {
  const config = { ...base, initialResource: 10 };
  const result = run([cast(ID.HARBINGER_SHROUD), cast(ID.VITAL_DRAW)], config);
  assert.ok(Math.abs(result.planningState.profession.lifeForce.value - 9) < 1e-9);
  const missed = run([cast(ID.HARBINGER_SHROUD), { ...cast(ID.VITAL_DRAW), offTarget: true }], config);
  assert.equal(missed.planningState.profession.lifeForce.value, 6);
});

test('Harbinger recharge modifies pistol work while preserving Core shroud reductions', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.DARK_GUNSLINGER, TRAIT.SINISTER_SHROUD] };
  const native = necromancerProfession.runtimeFor(config);
  const seen = [];
  run([cast(ID.WEEPING_SHOTS), cast(ID.HARBINGER_SHROUD), cast(ID.DARK_BARRAGE)], config, {
    profession: {
      ...native,
      onCastStart(runtime, cast) {
        native.onCastStart(runtime, cast);
        if ([ID.WEEPING_SHOTS, ID.DARK_BARRAGE].includes(cast.skill.id)) seen.push(cast.rechargeWork);
      }
    }
  });
  assert.deepEqual(seen, [
    native.catalog.skillsById.get(ID.WEEPING_SHOTS).cooldown * 0.8,
    native.catalog.skillsById.get(ID.DARK_BARRAGE).cooldown * 0.85
  ]);
});

test('Doom Approaches retains independent condition packets when its volley strikes are removed', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.DOOM_APPROACHES] };
  const native = necromancerProfession.runtimeFor(config);
  const profession = {
    ...native,
    catalog: applyBalanceProfilePatch(native.catalog, {
      balanceProfiles: { [PROFILE.darkBarrageDoomApproaches]: { removeEffects: [{ type: 'strike', name: 'Strike' }] } }
    })
  };
  const result = run([cast(ID.HARBINGER_SHROUD), { ...cast(ID.DARK_BARRAGE), interruptAfterMs: 300 }], config, {
    profession
  });
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.skillId === ID.DARK_BARRAGE),
    false
  );
  assert.ok(result.resolvedEvents.some((event) => event.type === 'condition' && event.skillId === ID.DARK_BARRAGE));
  assert.deepEqual(result.warnings, []);
});

// A passive tick inside an accepted cast can fund empowerment, while an interrupted animation spends nothing.
test('shroud attacks spend the Blight present at their actual attack boundary', () => {
  const config = { ...base, initialBlight: 4 };
  const result = run([cast(ID.HARBINGER_SHROUD), wait(700), cast(ID.DEVOURING_CUT)], config);
  const strike = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.DEVOURING_CUT);
  assert.equal(strike.metadata.blightEmpowered, true);
  assert.equal(strike.metadata.necromancerBlight, 1);
  assert.equal(state(result).blight, 1);
  const cancelled = run([cast(ID.HARBINGER_SHROUD), { ...cast(ID.VORACIOUS_ARC), interruptAfterMs: 100 }], config);
  assert.equal(state(cancelled).blight, 4);
  assert.equal(cancelled.totalDamage, 0);
  const delayed = run([cast(ID.HARBINGER_SHROUD), { ...cast(ID.VORACIOUS_ARC), impactDelayMs: 2000 }], config);
  assert.equal(
    delayed.resolvedEvents.some((event) => event.type === 'damage' || event.type === 'condition'),
    false
  );
  assert.equal(
    delayed.events.some((event) => event.type === 'control'),
    false
  );
});

test('Harbinger entry boons retain independent removal and actual party recipients', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.DEATHLY_HASTE, TRAIT.IMPLACABLE_FOE] };
  const native = necromancerProfession.runtimeFor(config);
  const profession = {
    ...native,
    catalog: applyBalanceProfilePatch(native.catalog, {
      balanceProfiles: { [PROFILE.deathlyHaste]: { removeEffects: [{ type: 'boon', name: 'quickness' }] } }
    })
  };
  const result = run([cast(ID.SUMMON_BONE_MINIONS), cast(ID.HARBINGER_SHROUD)], config, { profession });
  assert.equal(
    result.resolvedEvents.some((event) => event.kind === 'quickness'),
    false
  );
  const fury = result.resolvedEvents.find((event) => event.kind === 'fury');
  assert.equal(fury.resolvedAudience.includesSelf, true);
  assert.equal(fury.resolvedAudience.companionIds.length, 2);
  assert.ok(result.resolvedEvents.some((event) => event.kind === 'stability'));
  assert.ok(result.resolvedEvents.some((event) => event.kind === 'implacable-foe'));
});
