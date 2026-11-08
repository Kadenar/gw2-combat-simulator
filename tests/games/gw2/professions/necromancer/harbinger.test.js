import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { effectStateAt } from '#gw2/platform/results/effect-report.js';
import { planningBuffAt } from '#gw2/platform/results/result-queries.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { grantBlight } from '#gw2/professions/necromancer/specializations/harbinger/mechanics/blight.js';
import { harbingerBlightMaximum } from '#gw2/professions/necromancer/specializations/harbinger/state.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { cast, wait } from '#tests/helpers/commands.js';
import { lifeForcePercent } from '#tests/helpers/necromancer-resource.js';
import { observedRuntime, observeGw2Runtime } from '#tests/helpers/observed-runtime.js';
import { createProfessionSimulator } from '#tests/helpers/profession-simulation.js';

const base = {
  specialization: 'Harbinger',
  initialResource: 30,
  attributeInputs: baseAttributeInputs({ power: 1000, precision: 1000, vitality: 1000 }),
  target: { armor: 2597, health: 0, conditions: {} }
};
const run = (rotation, config = base, extra = {}) =>
  observeGw2Runtime({ profession: necromancerProfession.runtimeFor(config), config, rotation, ...extra });
const state = (result) => observedRuntime(result).profession.specialization.state;

// Refreshing Blight at the cap must report the capped count and schedule the refreshed stacks' expiry.
test('Blight grants publish capped counts and schedule refreshed expiry without caller bookkeeping', () => {
  // Leave some initial stacks unrefreshed so the test covers both original and refreshed expiry.
  const maximum = harbingerBlightMaximum(necromancerProfession.runtimeFor(base).catalog);
  const grantTimes = [5, 10];
  assert.ok(maximum > grantTimes.length);
  const grantedCounts = [];
  const simulate = createProfessionSimulator(necromancerProfession);
  const result = simulate(
    [wait(120000)],
    { ...base, initialBlight: maximum },
    {
      timeline: grantTimes.map((at) => ({
        at,
        run(owner) {
          grantedCounts.push(grantBlight(owner.mechanics, 1));
        }
      }))
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    grantedCounts,
    grantTimes.map(() => maximum)
  );
  const updates = result.events.filter((event) => event.kind === 'harbinger-blight');
  for (const at of grantTimes) assert.equal(updates.find((event) => event.at === at)?.stacks, maximum);

  // Unrefreshed stacks expire together. Refreshed stacks expire later by the time between grants.
  const expiries = updates.filter((event) => event.at > grantTimes.at(-1));
  assert.deepEqual(
    expiries.map((event) => event.stacks),
    [2, 1, 0]
  );
  assert.deepEqual(
    expiries.map((event) => event.at - expiries[0].at),
    [0, ...grantTimes]
  );
  assert.equal(result.planningState.profession[STATE.BLIGHT], 0);
});

// Real transition callbacks and owned deadlines keep passive Blight independent of observation partitioning.
test('Harbinger entry grants precede depletion and its passive clock stops on every exit', () => {
  const config = { ...base, initialResource: 0, selectedTraitIds: [TRAIT.CORRUPTED_TALENT] };
  const entered = run([cast(ID.HARBINGER_SHROUD), wait(1000)], config);
  assert.equal(entered.planningState.profession[STATE.ACTIVE_SHROUD], 'harbinger');
  assert.equal(lifeForcePercent(entered.planningState.profession[STATE.LIFE_FORCE]), 10);
  assert.equal(state(entered).blightExpiries.length, 2);
  assert.deepEqual(entered.warnings, []);
  const depleted = run([cast(ID.HARBINGER_SHROUD), wait(2000)], { ...base, initialResource: 5 });
  assert.equal(depleted.planningState.profession[STATE.ACTIVE_SHROUD], '');
  assert.equal(state(depleted).nextBlightAt, Infinity);
  assert.equal(state(depleted).blightExpiries.length, 0);
  const exited = run([cast(ID.HARBINGER_SHROUD), wait(1500), cast(ID.EXIT_HARBINGER_SHROUD), wait(2000)]);
  assert.equal(state(exited).blightExpiries.length, 2);
  assert.equal(state(exited).nextBlightAt, Infinity);
  const partitioned = run([cast(ID.HARBINGER_SHROUD), wait(1000), wait(1000), wait(1000)]);
  assert.deepEqual(state(partitioned), state(run([cast(ID.HARBINGER_SHROUD), wait(3000)])));
});

test('Blight expiry runs before same-time spending and records no replay state', () => {
  const result = run([wait(24640), cast(ID.ELIXIR_OF_BLISS)], { ...base, initialBlight: 5 });
  const strike = result.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.ELIXIR_OF_BLISS);
  assert.equal(
    strike.coefficient,
    necromancerProfession.catalog.skillsById.get(ID.ELIXIR_OF_BLISS).effects.find((effect) => effect.type === 'strike')
      .coefficient
  );
  assert.equal(state(result).blightExpiries.length, 10);
  // New Blight lasts 25 seconds from impact, after launch has resolved the expiring stacks.
  assert.deepEqual(state(result).blightExpiries, Array(10).fill(strike.at + 25));
  assert.equal(
    result.events.some((event) => event.type === 'necromancer.blight' || event.type === 'necromancer.state'),
    false
  );
  assert.equal(state(run([wait(25000)], { ...base, initialBlight: 5 })).blightExpiries.length, 0);
});

test('elixir launch spends once and delayed hostile impact preserves the selected empowerment', () => {
  const config = { ...base, initialBlight: 5 };
  const rotation = [{ ...cast(ID.ELIXIR_OF_RISK), impactDelayMs: 1000 }];
  const pending = run(rotation, config);
  assert.equal(state(pending).blightExpiries.length, 10);
  assert.equal(pending.totalDamage, 0);
  const arrived = run([...rotation, wait(1200)], config);
  const strike = arrived.resolvedEvents.find((event) => event.type === 'damage' && event.skillId === ID.ELIXIR_OF_RISK);
  assert.equal(strike.metadata.necromancerBlight, 10);
  assert.deepEqual(arrived.warnings, []);
  const interrupted = run([{ ...cast(ID.ELIXIR_OF_RISK), interruptAfterMs: 100 }, wait(1000)], config);
  assert.equal(state(interrupted).blightExpiries.length, 5);
  assert.equal(interrupted.totalDamage, 0);
  const missed = run([{ ...cast(ID.ELIXIR_OF_RISK), offTarget: true }], config);
  assert.equal(missed.totalDamage, 0);
  assert.equal(state(missed).blightExpiries.length, 10);
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
  assert.equal(planningBuffAt(complete.planningState, 'meltdown'), null);
  assert.equal(
    run([...rotation, wait(11000)], config, { combatStartTime: 0, output: 'score' }).totalDamage,
    complete.totalDamage
  );
  const setup = run([...rotation, { type: 'combat-start' }], config);
  assert.equal(state(setup).cascadingCorruptionStacks, 19);
});

// Patched grants must drive live combat, planning, and replay without a separate display-expiry task.
test('Meltdown follows delayed acceptance and patched duration without adding a Blight wake', () => {
  const config = {
    ...base,
    initialBlight: 5,
    initialCascadingCorruptionStacks: 19,
    selectedTraitIds: [TRAIT.CASCADING_CORRUPTION]
  };
  const native = necromancerProfession.runtimeFor(config);
  const catalog = applyBalanceProfilePatch(native.catalog, {
    balanceProfiles: {
      [TRAIT.CASCADING_CORRUPTION]: {
        effects: [{ type: 'buff', name: 'meltdown', duration: 2 }],
        removeEffects: [
          { type: 'strike', name: 'Strike' },
          { type: 'condition', name: 'Torment' }
        ]
      }
    }
  });
  const profession = {
    ...native,
    // Timing is authored through the canonical fixture; balance patches edit payload values only.
    catalog: withProfile(catalog, TRAIT.CASCADING_CORRUPTION, {
      effects: catalog.balanceProfilesById.get(TRAIT.CASCADING_CORRUPTION).effects.map((effect) => ({
        ...effect,
        atMs: 1000
      }))
    })
  };
  const simulate = (delay) => run([cast(ID.ELIXIR_OF_RISK), wait(delay)], config, { profession, combatStartTime: 0 });
  const pending = simulate(500);
  const active = simulate(1000);
  const expired = simulate(3000);
  for (const result of [pending, active, expired]) assert.deepEqual(result.warnings, []);
  assert.equal(planningBuffAt(pending.planningState, 'meltdown'), null);
  assert.equal(observedRuntime(pending).combat.activeBuffStacks('meltdown', pending.planningState.atSeconds, 1), 0);
  const grant = active.events.find((event) => event.type === 'buff' && event.kind === 'meltdown');
  const expiry = observedRuntime(active).buffs.get('meltdown')[0].expiresAt;
  assert.equal(grant.duration, 2);
  assert.equal(planningBuffAt(active.planningState, 'meltdown').remaining, expiry - active.planningState.atSeconds);
  assert.equal(observedRuntime(active).combat.activeBuffStacks('meltdown', active.planningState.atSeconds, 1), 1);
  // Crossing Meltdown's deadline cannot run and rearm Blight's owner before its actual stack expiry.
  assert.ok(Math.min(...state(active).blightExpiries) > expired.planningState.atSeconds);
  assert.equal(state(expired).blightGeneration, state(active).blightGeneration);
  assert.deepEqual(state(expired).blightExpiries, state(active).blightExpiries);
  assert.equal(planningBuffAt(expired.planningState, 'meltdown'), null);
  assert.equal(
    expired.events.some((event) => event.at === expiry),
    false
  );
  const track = expired.effectReport.tracks.find((track) => track.kind === 'meltdown' && track.recipient === 'self');
  assert.equal(effectStateAt(expired.effectReport, track, grant.at - 0.01)?.count ?? 0, 0);
  assert.equal(effectStateAt(expired.effectReport, track, expiry - 0.01).count, 1);
  assert.equal(effectStateAt(expired.effectReport, track, expiry).count, 0);
});

test('overlapping Meltdown procs retain one stack through the last accepted expiry', () => {
  const config = { ...base, initialBlight: 20, selectedTraitIds: [TRAIT.CASCADING_CORRUPTION] };
  const native = necromancerProfession.runtimeFor(config);
  const profession = {
    ...native,
    catalog: applyBalanceProfilePatch(native.catalog, {
      balanceProfiles: {
        [TRAIT.CASCADING_CORRUPTION]: {
          fields: { maximumStacks: { from: 20, to: 5 } },
          effects: [{ type: 'buff', name: 'meltdown', duration: 2 }]
        }
      }
    })
  };
  const rotation = [cast(ID.ELIXIR_OF_RISK), wait(500), { type: 'cooldown-reset' }, cast(ID.ELIXIR_OF_RISK)];
  const active = run(rotation, config, { profession, combatStartTime: 0 });
  const finished = run([...rotation, wait(3000)], config, { profession, combatStartTime: 0 });
  assert.deepEqual(active.warnings, []);
  assert.deepEqual(finished.warnings, []);
  const grants = active.events.filter((event) => event.type === 'buff' && event.kind === 'meltdown');
  assert.equal(grants.length, 2);
  const [firstExpiry, lastExpiry] = grants.map((grant) => grant.at + grant.duration);
  assert.ok(grants[1].at < firstExpiry);
  assert.equal(planningBuffAt(active.planningState, 'meltdown').count, 1);
  assert.ok(
    Math.abs(
      planningBuffAt(active.planningState, 'meltdown').remaining - (lastExpiry - active.planningState.atSeconds)
    ) < 1e-9
  );
  const track = finished.effectReport.tracks.find((track) => track.kind === 'meltdown' && track.recipient === 'self');
  assert.equal(effectStateAt(finished.effectReport, track, grants[1].at).count, 1);
  assert.equal(effectStateAt(finished.effectReport, track, firstExpiry).count, 1);
  assert.equal(effectStateAt(finished.effectReport, track, lastExpiry).count, 0);
});

test('removing the Meltdown buff preserves the proc and delayed explosion without a phantom window', () => {
  const config = {
    ...base,
    initialBlight: 5,
    initialCascadingCorruptionStacks: 19,
    selectedTraitIds: [TRAIT.CASCADING_CORRUPTION]
  };
  const native = necromancerProfession.runtimeFor(config);
  const profession = {
    ...native,
    catalog: applyBalanceProfilePatch(native.catalog, {
      balanceProfiles: { [TRAIT.CASCADING_CORRUPTION]: { removeEffects: [{ type: 'buff', name: 'meltdown' }] } }
    })
  };
  const result = run([cast(ID.ELIXIR_OF_RISK), wait(1000)], config, { profession, combatStartTime: 0 });
  assert.deepEqual(result.warnings, []);
  assert.equal(state(result).cascadingCorruptionStacks, 4);
  assert.ok(result.events.some((event) => event.type === 'proc' && event.sourceId === TRAIT.CASCADING_CORRUPTION));
  assert.ok(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.sourceId === TRAIT.CASCADING_CORRUPTION)
  );
  assert.equal(planningBuffAt(result.planningState, 'meltdown'), null);
  assert.equal(
    result.effectReport.tracks.some((track) => track.kind === 'meltdown'),
    false
  );
});

test('initial accepted Meltdown buffs are visible to combat, planning, and reporting until exclusive expiry', () => {
  // Generic observation now exposes the initial buff already used by the damage modifier.
  const config = { ...base, initialBuffs: [{ kind: 'meltdown', stacks: 1, duration: 2 }] };
  for (const at of [1, 2]) {
    const result = run([wait(at * 1000)], config, { combatStartTime: 0 });
    assert.deepEqual(result.warnings, []);
    const expected = at < 2 ? 1 : 0;
    assert.equal(planningBuffAt(result.planningState, 'meltdown')?.count ?? 0, expected);
    assert.equal(observedRuntime(result).combat.activeBuffStacks('meltdown', at, 1), expected);
    const track = result.effectReport.tracks.find((track) => track.kind === 'meltdown' && track.recipient === 'self');
    assert.equal(effectStateAt(result.effectReport, track, at).count, expected);
  }
});

test('Vital Draw grants only the siphons that have arrived', () => {
  const config = { ...base, initialResource: 10 };
  const result = run([cast(ID.HARBINGER_SHROUD), cast(ID.VITAL_DRAW)], config);
  assert.ok(Math.abs(lifeForcePercent(result.planningState.profession[STATE.LIFE_FORCE]) - 9) < 1e-9);
  const missed = run([cast(ID.HARBINGER_SHROUD), { ...cast(ID.VITAL_DRAW), offTarget: true }], config);
  assert.equal(lifeForcePercent(missed.planningState.profession[STATE.LIFE_FORCE]), 6);
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

// Devouring Cut's declared offset makes the next use eligible 80 ms before its full or interrupted end recharges.
test('Devouring Cut becomes eligible from a recharge started 80 ms before its committed end', () => {
  const config = { ...base, initialResource: 100 };
  const recharge = necromancerProfession.catalog.skillsById.get(ID.DEVOURING_CUT).cooldown / 1.25;
  for (const interruptAfterMs of [undefined, 400]) {
    const result = run(
      [cast(ID.HARBINGER_SHROUD), { ...cast(ID.DEVOURING_CUT), interruptAfterMs }, cast(ID.DEVOURING_CUT)],
      config
    );
    const [, first, second] = result.steps;
    assert.equal(second.start, Math.round(first.end - 80 + recharge * 1000), String(interruptAfterMs));
    assert.deepEqual(result.warnings, []);
  }
});

test('Doom Approaches retains independent condition packets when its volley strikes are removed', () => {
  const config = { ...base, selectedTraitIds: [TRAIT.DOOM_APPROACHES] };
  const native = necromancerProfession.runtimeFor(config);
  const profession = {
    ...native,
    catalog: applySkillPatch(native.catalog, {
      skills: { [ID.DARK_BARRAGE]: { removeEffects: [{ type: 'strike', name: 'Doom Approaches Strike' }] } }
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
  assert.equal(strike.metadata.necromancerBlight, 1);
  assert.equal(state(result).blightExpiries.length, 1);
  const cancelled = run([cast(ID.HARBINGER_SHROUD), { ...cast(ID.VORACIOUS_ARC), interruptAfterMs: 100 }], config);
  assert.equal(state(cancelled).blightExpiries.length, 4);
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
      balanceProfiles: { [TRAIT.DEATHLY_HASTE]: { removeEffects: [{ type: 'boon', name: 'quickness' }] } }
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
