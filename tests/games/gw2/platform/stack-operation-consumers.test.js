import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { projectObservedState } from '#tests/helpers/observed-runtime.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { snapshotProfessionState } from '#gw2/platform/profession-definition/state.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { thiefCatalog } from '#gw2/professions/thief/profession.js';
import { landThiefAxe } from '#gw2/professions/thief/core/mechanics/weapons.js';
import { runThief } from '#tests/helpers/thief-simulation.js';
import { triggerSharpeningStone } from '#gw2/professions/ranger/core/mechanics/skill-reactions.js';
import { rangerCatalog } from '#gw2/professions/ranger/profession.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_SKILL_IDS } from '#gw2/professions/necromancer/data/ids.js';
import { SCOURGE_BALANCE_PROFILE_IDS } from '#gw2/professions/necromancer/specializations/scourge/profiles.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { WARRIOR_SKILL_IDS, WARRIOR_TRAIT_IDS } from '#gw2/professions/warrior/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';

test('axe materialization replaces the oldest grant without mutating earlier state or snapshots', () => {
  const prior = Object.freeze([1, 30, 31, 32, 33, 34, 35].map((expiresAt) => ({ skillId: 71854, expiresAt })));
  let snapshot;
  const result = runThief(
    [{ type: 'wait', durationMs: 1000 }],
    { primaryWeapon: 'Axe' },
    {
      initialize(runtime) {
        runtime.profession.core.spinningAxes = prior;
        runtime.profession.core.outboundAxes = [{ id: 'landing-axe', skillId: 71854, landsAt: 1 }];
        snapshot = snapshotProfessionState(runtime.profession);
      },
      // Exercise landing directly: pending flight cannot mutate the earlier grounded snapshot.
      probes: [[1, (runtime) => landThiefAxe(runtime, { id: 'landing-axe' })]]
    }
  );
  assert.deepEqual(
    observedRuntime(result).profession.core.spinningAxes,
    [31, 32, 33, 34, 35, 11].map((expiresAt) => ({ skillId: 71854, expiresAt }))
  );
  assert.deepEqual(snapshot.spinningAxes, prior);

  // A cast cancelled before its commit point never lands a strike, so it cannot grant axes.
  const cancelled = runThief([{ name: 'Spinning Axe', interruptMs: 1 }], { primaryWeapon: 'Axe' });
  assert.deepEqual(cancelled.warnings, []);
  assert.deepEqual(observedRuntime(cancelled).profession.core.spinningAxes, []);
});

test('Holo-Dancer commits spend grant order even when the newest charge expires first', () => {
  const prior = Object.freeze([0, 30, 5]);
  let snapshot;
  const config = { specialization: 'Antiquary', selectedSkillIds: [13057] };
  const skill = thiefCatalog.skillsByName.get('Prepare Pitfall');
  const result = runThief(['Prepare Pitfall'], config, {
    initialize(runtime) {
      runtime.profession.specialization.state.holoUtilityCooldownReductionExpirations = prior;
      snapshot = snapshotProfessionState(runtime.profession);
    }
  });
  assert.deepEqual(result.warnings, []);
  const runtime = observedRuntime(result);
  // The accepted utility spends the oldest live entry, skipping the one already expired at its start.
  assert.deepEqual(runtime.profession.specialization.state.holoUtilityCooldownReductionExpirations, [5]);
  const reduced = runtime.cooldownController.readyAt(skill.id) - result.steps[0].start / 1000;
  const unreduced =
    observedRuntime(runThief(['Prepare Pitfall'], config)).cooldownController.readyAt(skill.id) -
    result.steps[0].start / 1000;
  assert.ok(Math.abs(reduced - unreduced * 0.2) < 1e-9);
  assert.deepEqual(
    projectObservedState(thiefProfession, { profession: runtime.profession, time: 5 })
      .holoUtilityCooldownReductionExpirations,
    []
  );
  assert.deepEqual(snapshot.holoUtilityCooldownReductionExpirations, prior);
});

test('Sharpening Stone prunes excluded hits and spends the earliest surviving expiry on player strikes', () => {
  const prior = Object.freeze([1, 5, 30]);
  const core = { sharpeningStoneExpirations: prior };
  const queued = [];
  const context = {
    catalog: rangerCatalog,
    profession: { core },
    effects: captureEffectEmissions({ submit: (event) => queued.push(event) }).effects
  };
  const event = { type: 'damage', at: 1, actorType: 'effect', coefficient: 1 };
  triggerSharpeningStone(context, event);
  assert.deepEqual(core.sharpeningStoneExpirations, [5, 30]);
  assert.deepEqual(queued, []);
  triggerSharpeningStone(context, { ...event, actorType: 'player' });
  assert.deepEqual(core.sharpeningStoneExpirations, [30]);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].condition, 'Bleeding');
  assert.deepEqual(prior, [1, 5, 30]);
});

// Live control replaces oldest grants without mutating an earlier pool or public snapshot.
test('Insight keeps newest grants in its single live state', () => {
  for (const [maximumStacks, duration, expected] of [
    [3, 4, [32, 5, 5]],
    [0, 4, []],
    [3, 0, null]
  ]) {
    const config = {
      specialization: 'Spellbreaker',
      selectedTraitIds: [WARRIOR_TRAIT_IDS.ATTACKERS_INSIGHT],
      target: { defiant: true }
    };
    const native = warriorProfession.runtimeFor(config);
    const profile = structuredClone(native.catalog.balanceProfilesById.get(WARRIOR_TRAIT_IDS.ATTACKERS_INSIGHT));
    profile.maximumStacks = maximumStacks;
    profile.effects.find((effect) => effect.type === 'buff' && effect.name === 'attackers-insight').duration = duration;
    // Invalid status durations fail before the runtime is exposed; valid replacements remain canonical.
    if (expected === null) {
      assert.throws(() => withProfile(native.catalog, profile.id, profile), /positive duration/);
      continue;
    }

    const prior = Object.freeze([1, 30, 31, 32]);
    let owner;
    let snapshot;
    const run = () =>
      observeGw2Runtime({
        config,
        rotation: [{ type: 'wait', durationMs: 1000 }],
        profession: {
          ...native,
          catalog: withProfile(native.catalog, profile.id, profile),
          initialize(runtime) {
            native.initialize(runtime);
            owner = runtime.profession.specialization.state;
            owner.attackerInsightExpiries = prior;
            snapshot = snapshotProfessionState(runtime.profession);
            runtime.effects.emit({
              kind: 'packet',
              event: {
                type: 'control',
                at: 1,
                actorType: 'player',
                source: 'warrior',
                sourceId: WARRIOR_SKILL_IDS.KICK,
                skillId: WARRIOR_SKILL_IDS.KICK,
                controlKind: 'knockback',
                duration: 1
              }
            });
          }
        }
      });
    const result = run();
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(owner.attackerInsightExpiries, expected);

    assert.deepEqual(snapshot.attackerInsightExpiries, prior);
    assert.deepEqual(prior, [1, 30, 31, 32]);
  }
});

// Completion retains the longest-lived shades and detaches the public projection from future mutations.
test('Scourge retains latest expiries and prunes at completion', () => {
  for (const [maximumStacks, completion, prior, expected] of [
    [3, 1, [1, 30, 31, 32], [30, 31, 32]],
    [4, 1, [1, 30, 31, 32], [5, 30, 31, 32]],
    [4, 5, [5, 30, 31, 32], [5.5, 30, 31, 32]],
    [0, 1, [1, 30, 31, 32], []]
  ]) {
    Object.freeze(prior);
    const config = { specialization: 'Scourge' };
    const native = necromancerProfession.runtimeFor(config);
    const profile = structuredClone(native.catalog.balanceProfilesById.get(SCOURGE_BALANCE_PROFILE_IDS.shade));
    profile.maximumStacks = maximumStacks;
    profile.effects.find((effect) => effect.type === 'buff').duration = completion === 1 ? 4 : 0.5;
    const result = observeGw2Runtime({
      config,
      rotation: [
        { type: 'wait', durationMs: completion * 1000 - 480 },
        { type: 'cast', skillId: NECROMANCER_SKILL_IDS.MANIFEST_SAND_SHADE }
      ],
      profession: {
        ...native,
        catalog: withProfile(native.catalog, profile.id, profile),
        initialize(runtime) {
          native.initialize(runtime);
          runtime.profession.specialization.state.shades = prior;
        }
      }
    });
    const state = observedRuntime(result).profession.specialization.state;
    assert.deepEqual(
      [...state.shades].sort((a, b) => a - b),
      expected
    );
    const planning = [...result.planningState.profession.shades];
    state.shades.push(99);
    assert.deepEqual(result.planningState.profession.shades, planning);
    assert.deepEqual(result.warnings, []);
  }
});
