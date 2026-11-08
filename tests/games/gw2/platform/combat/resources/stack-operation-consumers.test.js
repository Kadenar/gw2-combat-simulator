import assert from 'node:assert/strict';
import test from 'node:test';

import { applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import { activeChargeGrants } from '#gw2/platform/combat/resources/charges.js';
import { NECROMANCER_SKILL_IDS } from '#gw2/professions/necromancer/data/ids.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { triggerSharpeningStone } from '#gw2/professions/ranger/core/skills/slot-skills.js';
import { rangerCatalog } from '#gw2/professions/ranger/profession.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { THIEF_SKILL_IDS } from '#gw2/professions/thief/data/ids.js';
import { thiefCatalog, thiefProfession } from '#gw2/professions/thief/profession.js';
import { WARRIOR_SKILL_IDS, WARRIOR_TRAIT_IDS } from '#gw2/professions/warrior/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { withProfile } from '#tests/helpers/catalog-overrides.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { observedRuntime, observeGw2Runtime, projectObservedState } from '#tests/helpers/observed-runtime.js';
import { snapshotProfessionState } from '#tests/helpers/profession-state.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

test('axe materialization replaces the oldest grant without mutating earlier state or snapshots', () => {
  const skillId = THIEF_SKILL_IDS.SPINNING_AXE_ID_71967;
  const prior = Object.freeze([0, 30, 31, 32, 33, 34, 35].map((expiresAt) => Object.freeze({ skillId, expiresAt })));
  let snapshot;
  // A real throw exercises action registration and scheduled landing while preserving the earlier snapshot.
  const result = runThief(
    [skillId, { type: 'wait', durationMs: 2000 }],
    { primaryWeapon: 'Axe' },
    {
      initialize(runtime) {
        runtime.profession.core.spinningAxes = prior;
        snapshot = snapshotProfessionState(runtime.profession);
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  const core = observedRuntime(result).profession.core;
  assert.equal(core.spinningAxes.length, 6);
  assert.deepEqual(core.spinningAxes.slice(0, -1), prior.slice(2));
  assert.equal(core.spinningAxes.at(-1).skillId, skillId);
  assert.deepEqual(core.outboundAxes, []);
  assert.deepEqual(snapshot.spinningAxes, prior);

  // A cast cancelled before its commit point never lands a strike, so it cannot grant axes.
  const cancelled = runThief([{ skillId, interruptMs: 1 }], { primaryWeapon: 'Axe' });
  assert.deepEqual(cancelled.warnings, []);
  assert.deepEqual(observedRuntime(cancelled).profession.core.spinningAxes, []);
});

test('Holo-Dancer commits spend grant order even when the newest charge expires first', () => {
  const prior = Object.freeze([0, 30, 5]);
  let snapshot;
  const config = { specialization: 'Antiquary', selectedSkillIds: [13057] };
  const skill = thiefCatalog.skillsById.get(13057);
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
    projectObservedState(thiefProfession, { profession: runtime.profession, time: 5 })[
      STATE.HOLO_UTILITY_COOLDOWN_REDUCTION_EXPIRATIONS
    ],
    []
  );
  assert.deepEqual(snapshot.holoUtilityCooldownReductionExpirations, prior);
});

test('Sharpening Stone ignores excluded hits and spends the earliest live expiry on player strikes', () => {
  const prior = Object.freeze([1, 5, 30].map((expiresAt) => ({ charges: 1, expiresAt })));
  // Copies of a pool retain live grant references; detached snapshots preserve historical values.
  const snapshot = structuredClone(prior);
  const core = { sharpeningStoneGrants: [...prior] };
  const queued = [];
  const context = {
    helpers: rangerCatalog,
    profession: { core },
    effects: captureEffectEmissions({ submit: (event) => queued.push(event) }).effects
  };
  const event = { type: 'damage', at: 1, actorType: 'effect', coefficient: 1 };
  triggerSharpeningStone(context, event);
  assert.deepEqual(
    activeChargeGrants(core.sharpeningStoneGrants, event.at),
    [5, 30].map((expiresAt) => ({ charges: 1, expiresAt }))
  );
  assert.deepEqual(queued, []);
  triggerSharpeningStone(context, { ...event, actorType: 'player' });
  assert.deepEqual(activeChargeGrants(core.sharpeningStoneGrants, event.at), [{ charges: 1, expiresAt: 30 }]);
  assert.equal(queued.length, 1);
  assert.equal(queued[0].condition, 'Bleeding');
  assert.equal(prior[1].charges, 0);
  assert.equal(activeChargeGrants(core.sharpeningStoneGrants, event.at)[0], prior[2]);
  assert.deepEqual(
    snapshot,
    [1, 5, 30].map((expiresAt) => ({ charges: 1, expiresAt }))
  );
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
    // The manifest skill owns the cap and its shade action owns each grant's lifetime.
    const catalog = applySkillPatch(native.catalog, {
      skills: {
        [NECROMANCER_SKILL_IDS.MANIFEST_SAND_SHADE]: {
          fields: { maximumStacks },
          sideEffects: {
            shade: { effects: [{ type: 'buff', name: 'active-shade', duration: completion === 1 ? 4 : 0.5 }] }
          }
        }
      }
    });
    const result = observeGw2Runtime({
      config,
      rotation: [
        { type: 'wait', durationMs: completion * 1000 - 480 },
        { type: 'cast', skillId: NECROMANCER_SKILL_IDS.MANIFEST_SAND_SHADE }
      ],
      profession: {
        ...native,
        catalog,
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
    const planning = [...result.planningState.profession[STATE.SHADES]];
    state.shades.push(99);
    assert.deepEqual(result.planningState.profession[STATE.SHADES], planning);
    assert.deepEqual(result.warnings, []);
  }
});
