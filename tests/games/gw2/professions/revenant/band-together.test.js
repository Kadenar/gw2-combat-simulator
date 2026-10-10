import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { grantCharges } from '#gw2/platform/combat/resources/charges.js';
import { effectStateValue } from '#gw2/platform/combat/effect-state.js';
import { applySkillSideEffects } from '#gw2/platform/effects/action-dispatch.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { RENEGADE_ENHANCED_SKILL_BY_ID } from '#gw2/professions/revenant/data/renegade-enhanced-skills.js';
import { renegadeHooks } from '#gw2/professions/revenant/specializations/renegade/hooks.js';
import { renegadeEffectStates } from '#gw2/professions/revenant/specializations/renegade/effect-state.js';
import { bandTogetherReady } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import { RENEGADE_PROFILE_IDS as PROFILE } from '#gw2/professions/revenant/specializations/renegade/profiles.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { projectObservedState } from '#tests/helpers/observed-runtime.js';

// Exercise the declared acceptance/completion phases independently of summon packet calibration.
function fixture() {
  const config = { specialization: 'Renegade' };
  const native = revenantProfession.runtimeFor(config);
  const runtime = {
    config,
    traits: new Set(),
    time: 1,
    combatStartedAt: () => null,
    profession: native.createState(config),
    helpers: native.catalog
  };
  const emitted = captureEffectEmissions({ now: () => runtime.time });
  runtime.effects = emitted.effects;
  bindTriggerPoints(runtime, revenantProfession, config);
  const state = runtime.profession.specialization.state;
  let sequence = 0;
  const cast = (skillId) => ({
    id: `band-${sequence++}`,
    skill: native.catalog.skillsById.get(skillId),
    start: runtime.time,
    fullEnd: runtime.time + 1,
    effectiveEnd: runtime.time + 1,
    cancelled: false,
    command: {}
  });
  const apply = (accepted, phase) => applySkillSideEffects(runtime, accepted, phase, renegadeHooks.sideEffectHandlers);
  return { runtime, state, cast, apply, emitted };
}

test('ordinary completion replaces Band Together with one finite charge and cannot arm twice', () => {
  const { runtime, state, cast, apply, emitted } = fixture();
  const ordinary = cast(ID.ICERAZORS_IRE);
  apply(ordinary, 'castStart');
  assert.equal(state.bandTogether.charges, 0);
  // A grant arriving during the ordinary cast is replaced, never added to its completion reward.
  state.bandTogether = grantCharges(1, 99);
  runtime.time = ordinary.effectiveEnd;
  apply(ordinary, 'castCommit');
  const duration = runtime.helpers.balanceProfilesById
    .get(PROFILE.bandTogether)
    .effects.find((effect) => effect.kind === 'band-together').duration;
  assert.deepEqual(state.bandTogether, grantCharges(1, runtime.time + duration));
  const granted = state.bandTogether;
  runtime.time += 1;
  apply(ordinary, 'castCommit');
  assert.equal(state.bandTogether, granted);
  assert.equal(emitted.events.filter((event) => event.kind === 'band-together').length, 1);
});

test('only mapped skills are eligible, readiness is read-only, and acceptance excludes exact expiry', () => {
  for (const at of [1.999999, 2, 2.000001]) {
    const { runtime, state, cast, apply } = fixture();
    state.bandTogether = grantCharges(1, 2);
    runtime.time = at;
    const before = structuredClone(state.bandTogether);
    for (const skillId of Object.keys(RENEGADE_ENHANCED_SKILL_BY_ID))
      assert.equal(bandTogetherReady(runtime, Number(skillId)), at < 2);
    assert.equal(bandTogetherReady(runtime, ID.SOULCLEAVES_SUMMIT), false);
    assert.deepEqual(state.bandTogether, before);
    const accepted = cast(ID.ICERAZORS_IRE);
    apply(accepted, 'castStart');
    assert.equal(state.bandTogether.charges, at < 2 ? 0 : 1);
    assert.deepEqual(
      renegadeHooks.modifyEffects(runtime, accepted, accepted.skill.effects),
      at < 2 ? [] : accepted.skill.effects
    );
    const next = cast(ID.DARKRAZORS_DARING);
    apply(next, 'castStart');
    assert.equal(renegadeHooks.modifyEffects(runtime, next, next.skill.effects), next.skill.effects);
  }
});

test('acceptance spends and records the enhanced profile before rewards and preserves it across later grants', () => {
  const { runtime, state, cast, apply, emitted } = fixture();
  state.bandTogether = grantCharges(1, 2);
  runtime.traits.add(TRAIT.ALL_FOR_ONE);
  const accepted = cast(ID.ICERAZORS_IRE);
  let rewards = 0;
  runtime.resourceController = {
    grant(resource) {
      assert.equal(resource, 'energy');
      assert.equal(state.bandTogether.charges, 0);
      assert.deepEqual(renegadeHooks.modifyEffects(runtime, accepted, accepted.skill.effects), []);
      rewards += 1;
    }
  };
  apply(accepted, 'castStart');
  assert.equal(rewards, 1);
  assert.ok(emitted.events.some((event) => event.condition === 'Chilled' && event.activationId === accepted.id));
  // A subsequent grant belongs to a future cast; enhanced completion must leave it untouched.
  state.bandTogether = grantCharges(1, 10);
  const replacement = state.bandTogether;
  runtime.time = 3;
  assert.deepEqual(renegadeHooks.modifyEffects(runtime, accepted, accepted.skill.effects), []);
  apply(accepted, 'castCommit');
  assert.equal(state.bandTogether, replacement);
  assert.equal(state.bandTogether.charges, 1);
  assert.equal(
    emitted.events.some((event) => event.kind === 'band-together'),
    false
  );
});

test('Band Together observations and public grants are detached from their owner', () => {
  const { runtime, state } = fixture();
  state.bandTogether = grantCharges(1, 2);
  const effect = renegadeEffectStates(runtime).find(({ kind }) => kind === 'band-together');
  const projected = projectObservedState(revenantProfession, runtime);
  assert.notEqual(projected.bandTogether, state.bandTogether);
  assert.deepEqual(projected.bandTogether, state.bandTogether);
  projected.bandTogether.charges = 0;
  assert.equal(state.bandTogether.charges, 1);
  assert.equal(effectStateValue(effect, 2).count, 0);
  assert.equal(state.bandTogether.charges, 1);
  state.bandTogether.charges = 0;
  assert.equal(effectStateValue(effect, 1).count, 1);
  assert.equal(
    effectStateValue(
      renegadeEffectStates(runtime).find(({ kind }) => kind === 'band-together'),
      1
    ).count,
    0
  );
});
