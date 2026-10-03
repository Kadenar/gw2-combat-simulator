import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { mesmerCatalog, mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { simulateMesmer, runMesmer } from '#tests/helpers/mesmer-simulation.js';
import { applySkillSideEffects } from '#gw2/platform/simulation/side-effects.js';
import { registerMesmerMechanics } from '#gw2/professions/mesmer/core/mechanics/runtime.js';
import { mesmerCoreHooks } from '#gw2/professions/mesmer/core/hooks.js';
import { troubadourHooks } from '#gw2/professions/mesmer/specializations/troubadour/hooks.js';
import { armMesmerSkillFlip } from '#gw2/professions/mesmer/core/mechanics/flips.js';
import { scheduleAxesClones, completeAxesConfusion } from '#gw2/professions/mesmer/core/skills/weapons/axe.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';

// Verify reward ownership at the successful transaction boundary, independently of the remaining animation.
test('Clarity, blade refunds, and instrument state are visible at commitment before recovery ends', () => {
  for (const [id, config, reward] of [
    [
      ID.MIND_THE_GAP,
      { specialization: 'Core', primaryWeapon: 'Spear', secondaryWeapon: '' },
      (event) => event.kind === 'clarity'
    ],
    [
      ID.BLADESONG_HARMONY,
      { specialization: 'Virtuoso', initialResource: 5, selectedTraitIds: [TRAIT.INFINITE_FORGE] },
      (event) => event.type === 'resource' && event.reason === 'Infinite Forge refund'
    ],
    [
      ID.LIVELY_LUTE,
      { specialization: 'Troubadour', initialResource: 3 },
      (event) => event.type === 'mesmer.instrument'
    ]
  ]) {
    const skill = mesmerCatalog.skillsById.get(id);
    const result = simulateMesmer(
      [{ name: skill.name, interruptMs: (skill.interruptCommitMs + skill.castTimeMs) / 2 }],
      config
    );
    assert.deepEqual(result.warnings, []);
    const cast = result.events.find((event) => event.type === 'action');
    assert.equal(cast.cancelled, false);
    const applied = result.events.find(reward);
    assert.ok(applied, skill.name);
    assert.equal(applied.at, cast.endsAt, skill.name);
    assert.ok(applied.at < cast.fullEndsAt, skill.name);
  }
});

test('Lancer consumes Clarity before preparation and never reuses another activation snapshot', () => {
  const skill = mesmerCatalog.skillsById.get(ID.PHANTASMAL_LANCER);
  const prepared = [];
  const mechanics = {
    castDetails: new Map(),
    skillEffects: { schedule: (_skill, _end, _start, options) => prepared.push(options.clarityConsumed) }
  };
  const runtime = { profession: { core: { clarityUntil: 2 } } };
  registerMesmerMechanics(runtime, mechanics);
  for (const [id, start, until, cancelled] of [
    ['first', 1, 2, true],
    ['next', 1.1, 0, false],
    ['expiry', 2, 2, false]
  ]) {
    runtime.profession.core.clarityUntil = until;
    mechanics.castDetails.set(id, {});
    const cast = { id, skill, start, fullEnd: start + 1, effectiveEnd: start + 1, cancelled, command: {} };
    applySkillSideEffects(runtime, cast, 'castStart', mesmerCoreHooks.sideEffectHandlers);
    assert.equal(runtime.profession.core.clarityUntil, 0);
  }

  assert.deepEqual(prepared, [true, false, false]);
});

test('a replaced flip survives its old expiry task', () => {
  const tasks = [];
  const runtime = {
    time: 1,
    profession: { core: { availableFlips: {} } },
    schedule: (_type, _at, data) => tasks.push(data)
  };
  const skill = { flipArm: { skillId: ID.ABSTRACTION, duration: 2, anchor: 'castCommit' } };
  armMesmerSkillFlip(runtime, { id: 'old', start: 0, skill });
  runtime.time = 2;
  armMesmerSkillFlip(runtime, { id: 'new', start: 1, skill });
  mesmerCoreHooks.tasks['mesmer.flip-expire'](runtime, tasks[0]);
  assert.equal(runtime.profession.core.availableFlips[ID.ABSTRACTION].identity, 'new');
  mesmerCoreHooks.tasks['mesmer.flip-expire'](runtime, tasks[1]);
  assert.equal(runtime.profession.core.availableFlips[ID.ABSTRACTION], undefined);
});

test('Axe variants retain acceptance snapshots versus live pre-cast clone selection', () => {
  const strikes = [],
    conditions = [];
  const runtime = {
    time: 2,
    config: { primaryWeapon: 'Axe' },
    activeWeaponSet: 1,
    helpers: mesmerCatalog,
    profession: { core: { clones: [{ id: 1, weapon: 'Axe', createdAt: 0 }] } }
  };
  runtime.effects = captureEffectEmissions({
    now: () => runtime.time,
    submit: (event) => {
      (event.type === 'damage' ? strikes : conditions).push(event);
      return event;
    }
  }).effects;
  const cast = {
    id: 'axes',
    skill: mesmerCatalog.skillsById.get(ID.AXES_OF_SYMMETRY),
    start: 1,
    fullEnd: 2,
    effectiveEnd: 2,
    command: {}
  };
  scheduleAxesClones(runtime, cast);
  runtime.profession.core.clones.push({ id: 2, weapon: 'Axe', createdAt: 1 }, { id: 3, weapon: 'Axe', createdAt: 1.1 });
  completeAxesConfusion(runtime, {
    ...cast,
    skill: mesmerCatalog.skillsById.get(ID.AXES_OF_SYMMETRY_NON_MIRAGE)
  });
  assert.deepEqual(
    strikes.map((event) => event.metadata.cloneId),
    [1]
  );
  assert.equal(strikes[0].actorType, 'summon');
  assert.equal(conditions.at(-1).stacks, 2);
});

test('Harp start protection is independent of its later playing-state commitment and removable profile', () => {
  for (const removed of [false, true]) {
    const profession = withPatchPreview(mesmerProfession, {
      id: 'harp-protection',
      label: 'Harp protection',
      professions: {
        mesmer: {
          balanceProfiles: removed
            ? { 'mesmer.troubadour.instruments': { removeEffects: [{ type: 'buff', name: 'distortion' }] } }
            : {}
        }
      }
    });
    const result = runMesmer(
      [ID.HARMONIOUS_HARP],
      { patchId: 'harp-protection', specialization: 'Troubadour', selectedTraitIds: [] },
      { profession }
    );
    assert.deepEqual(result.warnings, []);
    const cast = result.events.find((event) => event.type === 'action');
    const playing = result.events.find((event) => event.type === 'mesmer.instrument');
    assert.equal(playing.at, cast.endsAt);
    const protection = result.events.find((event) => event.kind === 'distortion');
    assert.equal(Boolean(protection), !removed);
    if (protection) {
      assert.equal(protection.at, cast.at);
      assert.equal(protection.sourceId, ID.HARMONIOUS_HARP);
      assert.ok(protection.at < playing.at);
    }
  }

  // A canceled start must not reach either emission or instrument state even when manually dispatched.
  applySkillSideEffects(
    {},
    { skill: mesmerCatalog.skillsById.get(ID.HARMONIOUS_HARP), cancelled: true },
    'castStart',
    troubadourHooks.sideEffectHandlers
  );
});

test('a canceled ambush leaves its window available for the next accepted attempt', () => {
  const result = simulateMesmer(
    ['Dodge / Mirage Cloak', { name: 'Imaginary Axes', interruptMs: 100 }, 'Imaginary Axes'],
    { specialization: 'Mirage', primaryWeapon: 'Axe', secondaryWeapon: '', initialResource: 0 }
  );
  assert.deepEqual(result.warnings, []);
  const attempts = result.events.filter((event) => event.type === 'action' && event.skillId === ID.IMAGINARY_AXES);
  assert.equal(attempts[0].cancelled, true);
  assert.equal(attempts[1].cancelled, false);
  assert.ok(result.events.some((event) => event.type === 'damage' && event.activationId === attempts[1].activationId));
  assert.equal(result.planningState.profession.availableAmbush, null);
});
