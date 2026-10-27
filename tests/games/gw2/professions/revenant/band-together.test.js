import { createCombatEngagement } from '#gw2/platform/combat/engagement.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { recordBuffApplication } from '#gw2/platform/combat/boons.js';
import { gw2BuffApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { createMechanicCombatServices } from '#gw2/platform/resolver/mechanic-services.js';
import { effectStateValue, observeBuffState } from '#gw2/platform/combat/effect-state.js';
import { applySkillSideEffects } from '#gw2/platform/effects/action-dispatch.js';
import { revenantProfession } from '#gw2/professions/revenant/profession.js';
import { REVENANT_SKILL_IDS as ID, REVENANT_TRAIT_IDS as TRAIT } from '#gw2/professions/revenant/data/ids.js';
import { RENEGADE_ENHANCED_SKILL_BY_ID } from '#gw2/professions/revenant/data/renegade-enhanced-skills.js';
import { renegadeHooks } from '#gw2/professions/revenant/specializations/renegade/hooks.js';
import { bandTogetherReady } from '#gw2/professions/revenant/specializations/renegade/mechanics/kalla-and-band-together.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { projectObservedState } from '#tests/helpers/observed-runtime.js';

// Exercise the declared acceptance/completion phases independently of summon packet calibration.
// Trait selection is fixed here because a build's traits never change once its runtime is in use.
function fixture(traits = []) {
  const config = { specialization: 'Renegade' };
  const native = revenantProfession.runtimeFor(config);
  const runtime = {
    config,
    traits: new Set(traits),
    time: 1,
    engagement: createCombatEngagement({ authoredMarkers: 1 }).query,
    profession: native.createState(config),
    helpers: native.catalog
  };
  runtime.buffs = new Map();
  runtime.companions = new Map();
  runtime.combat = createMechanicCombatServices(runtime);
  const acceptBuff = (event) => {
    if (event.type === 'buff')
      recordBuffApplication(runtime.buffs, {
        ...event,
        resolvedAudience: gw2BuffApplicationRecipients(config, event)
      });

    return event;
  };

  const emitted = captureEffectEmissions({ now: () => runtime.time, submit: acceptBuff });
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
  const grant = (expiresAt) =>
    acceptBuff({
      type: 'buff',
      kind: 'band-together',
      at: runtime.time,
      duration: expiresAt - runtime.time,
      stacks: 1,
      actorType: 'player',
      audience: { recipients: 'self' }
    });
  const observe = () =>
    observeBuffState('band-together', runtime.combat.buffApplications('band-together'), runtime.time, {
      maximumStacks: 1
    });
  return { runtime, state, cast, apply, emitted, grant, observe };
}

test('ordinary completion replaces the timed Band Together buff and cannot grant twice', () => {
  const { runtime, cast, apply, emitted, grant, observe } = fixture();
  const ordinary = cast(ID.ICERAZORS_IRE);
  apply(ordinary, 'castStart');
  assert.equal(bandTogetherReady(runtime, ID.ICERAZORS_IRE), false);
  // A grant arriving during the ordinary cast is replaced, never added to its completion reward.
  grant(99);
  runtime.time = ordinary.effectiveEnd;
  apply(ordinary, 'castCommit');
  const duration = runtime.helpers.skillsById
    .get(ID.LEGENDARY_RENEGADE_STANCE)
    .effects.find((effect) => effect.kind === 'band-together').duration;
  assert.equal(effectStateValue(observe(), runtime.time).count, 1);
  assert.equal(effectStateValue(observe(), runtime.time).expiresAt, runtime.time + duration);
  const granted = runtime.combat.buffApplications('band-together');
  runtime.time += 1;
  apply(ordinary, 'castCommit');
  assert.equal(runtime.combat.buffApplications('band-together'), granted);
  assert.equal(emitted.events.filter((event) => event.kind === 'band-together').length, 1);
});

test('only mapped skills are eligible, readiness is read-only, and acceptance excludes exact expiry', () => {
  for (const at of [1.999999, 2, 2.000001]) {
    const { runtime, cast, apply, grant } = fixture();
    grant(2);
    runtime.time = at;
    const before = structuredClone(runtime.combat.buffApplications('band-together'));
    for (const skillId of Object.keys(RENEGADE_ENHANCED_SKILL_BY_ID))
      assert.equal(bandTogetherReady(runtime, Number(skillId)), at < 2);
    assert.equal(bandTogetherReady(runtime, ID.SOULCLEAVES_SUMMIT), false);
    assert.deepEqual(runtime.combat.buffApplications('band-together'), before);
    const accepted = cast(ID.ICERAZORS_IRE);
    apply(accepted, 'castStart');
    assert.equal(bandTogetherReady(runtime, ID.ICERAZORS_IRE), false);
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
  const { runtime, cast, apply, emitted, grant } = fixture([TRAIT.ALL_FOR_ONE]);
  grant(2);
  const accepted = cast(ID.ICERAZORS_IRE);
  let rewards = 0;
  runtime.resourceController = {
    grant(resource) {
      assert.equal(resource, 'energy');
      assert.equal(bandTogetherReady(runtime, ID.ICERAZORS_IRE), false);
      assert.deepEqual(renegadeHooks.modifyEffects(runtime, accepted, accepted.skill.effects), []);
      rewards += 1;
    }
  };
  apply(accepted, 'castStart');
  assert.equal(rewards, 1);
  assert.ok(emitted.events.some((event) => event.condition === 'Chilled' && event.activationId === accepted.id));
  // A subsequent grant belongs to a future cast; enhanced completion must leave it untouched.
  grant(10);
  const replacement = runtime.combat.buffApplications('band-together');
  runtime.time = 3;
  assert.deepEqual(renegadeHooks.modifyEffects(runtime, accepted, accepted.skill.effects), []);
  apply(accepted, 'castCommit');
  assert.equal(runtime.combat.buffApplications('band-together'), replacement);
  assert.equal(bandTogetherReady(runtime, ID.ICERAZORS_IRE), true);
  assert.equal(
    emitted.events.some((event) => event.kind === 'band-together'),
    false
  );
});

test('Band Together observations are detached and profession state contains no duplicate buff', () => {
  const { runtime, state, grant, observe, cast, apply } = fixture();
  grant(2);
  const effect = observe();
  const projected = projectObservedState(revenantProfession, runtime);
  assert.equal(Object.hasOwn(state, 'bandTogether'), false);
  assert.equal(Object.hasOwn(projected, 'bandTogether'), false);
  assert.equal(effectStateValue(effect, 2).count, 0);
  assert.equal(bandTogetherReady(runtime, ID.ICERAZORS_IRE), true);
  apply(cast(ID.ICERAZORS_IRE), 'castStart');
  assert.equal(effectStateValue(effect, 1).count, 1);
  assert.equal(effectStateValue(observe(), 1).count, 0);
});
