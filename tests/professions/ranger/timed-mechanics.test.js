import assert from 'node:assert/strict';
import test from 'node:test';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { RANGER_SKILL_IDS as ID, RANGER_TRAIT_IDS as TRAIT } from '#gw2/professions/ranger/data/ids.js';
import { rangerProfession } from '#gw2/professions/ranger/definition.js';
import { enterAvatar } from '#gw2/professions/ranger/specializations/druid/mechanics/celestial-avatar.js';
import { druidState } from '#gw2/professions/ranger/specializations/druid/state.js';
import { galeshotModifierRules } from '#gw2/professions/ranger/specializations/galeshot/mechanics/cyclone-bow-rules.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

const simulate = createProfessionSimulator(rangerProfession, {
  initialAstralForce: 100,
  target: { armor: 2597, conditions: {} },
  selectedTraitIds: [TRAIT.NATURAL_MENDER, TRAIT.NATURAL_BALANCE]
});

// Long waits must process the exit before subsequent Natural Mender recovery.
test('Celestial Avatar expires at its deadline and recovers force afterward', () => {
  for (const [waitMs, expectedForce] of [
    [15000, 0],
    [20000, 8]
  ]) {
    const result = simulate('Druid', ['Celestial Avatar', { type: 'wait', durationMs: waitMs }]);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      result.events.filter(({ type }) => type === 'sigil_swap').map(({ at }) => at),
      [0, 15]
    );
    assert.deepEqual(
      result.events.filter(({ type, kind }) => type === 'buff' && kind === 'natural-balance').map(({ at }) => at),
      [0, 15]
    );
    assert.equal(result.endState.profession.celestialAvatarActive, false);
    assert.equal(result.endState.profession.astralForce, expectedForce);
  }
});

test('manual Avatar exit cancels automatic exit and retains half the remaining force', () => {
  const result = simulate('Druid', [
    'Celestial Avatar',
    { type: 'wait', durationMs: 3000 },
    'Release Celestial Avatar',
    { type: 'wait', durationMs: 17000 }
  ]);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.events.filter(({ type }) => type === 'sigil_swap').map(({ at }) => at),
    [0, 3]
  );
  assert.equal(result.endState.profession.astralForce, 80);
});

test('Avatar depletion schedules an earlier exit than the duration limit', () => {
  const scheduler = createScheduler({
    profession: rangerProfession,
    config: { specialization: 'Druid', initialAstralForce: 20, selectedTraitIds: [TRAIT.NATURAL_MENDER] }
  });
  // Exercise the resource lifecycle directly; normal cast availability requires full force.
  enterAvatar(
    { ...scheduler.context, start: 0, effectiveEnd: 0 },
    scheduler.context.catalog.skillsById.get(ID.CELESTIAL_AVATAR)
  );
  scheduler.advanceTo(10);
  assert.deepEqual(
    scheduler.events.filter(({ type }) => type === 'sigil_swap').map(({ at }) => at),
    [0, 3]
  );
  assert.equal(druidState.from(scheduler.context).astralForce, 16);
  assert.equal(druidState.from(scheduler.context).celestialAvatarActive, false);
});

// Check both boon sources and ownership at the actual start/expiry boundaries.
test('Bird of Prey accepts permanent and timed movement buffs only for player-owned damage', () => {
  const rule = galeshotModifierRules.find(({ id }) => id === 'ranger.bird-of-prey');
  const context = {
    config: { selectedTraitIds: [TRAIT.BIRD_OF_PREY] },
    event: { actorType: 'player' },
    time: 1
  };
  assert.equal(rule.when(context), false);
  for (const boon of ['swiftness', 'superspeed']) {
    assert.equal(rule.when({ ...context, config: { ...context.config, boons: { [boon]: true } } }), true);
    const application = { at: 1, expiresAt: 2, resolvedAudience: { includesSelf: true } };
    const runtime = { boons: new Map([[boon, [application]]]) };
    for (const [time, expected] of [
      [0, false],
      [1, true],
      [2, false]
    ]) {
      assert.equal(rule.when({ ...context, runtime, time }), expected);
    }

    assert.equal(rule.when({ ...context, runtime, event: { actorType: 'summon' } }), false);
    assert.equal(rule.when({ ...context, runtime, event: { actorType: 'effect', ownerActorType: 'player' } }), true);
    assert.equal(rule.when({ ...context, runtime, config: { selectedTraitIds: [] } }), false);
    application.resolvedAudience.includesSelf = false;
    assert.equal(rule.when({ ...context, runtime }), false);
  }
});

test('Call of the Wild activates Bird of Prey until its Swiftness expires', () => {
  const run = (selectedTraitIds, waitMs) =>
    simulate('Galeshot', ['Call of the Wild', { type: 'wait', durationMs: waitMs }, 'Splitblade'], {
      primaryWeapon: 'Axe',
      secondaryWeapon: 'Warhorn',
      selectedTraitIds
    });
  const strike = (result) =>
    result.resolvedEvents.find(({ type, skillId }) => type === 'damage' && skillId === ID.SPLITBLADE).damage;
  for (const [waitMs, multiplier] of [
    [0, 1.05],
    [13000, 1]
  ]) {
    const base = run([], waitMs);
    const trait = run([TRAIT.BIRD_OF_PREY], waitMs);
    assert.deepEqual(base.warnings, []);
    assert.deepEqual(trait.warnings, []);
    assert.ok(Math.abs(strike(trait) / strike(base) - multiplier) < 1e-9);
  }
});
