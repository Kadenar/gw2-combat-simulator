import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID } from '#gw2/professions/warrior/data/ids.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { dragonSlashRelease } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.js';

// Minimal charge scenarios isolate holds from saved rotations, weapon rolls, and benchmark damage.
const combat = { type: 'combat-start' };
const wait = (durationMs) => ({ type: 'wait', durationMs });
const slash = (releaseAtCharges, releaseDelayMs) => ({
  type: 'cast',
  skillId: ID.DRAGON_SLASH_FORCE,
  releaseAtCharges,
  releaseDelayMs
});
const acceptedSlashes = new WeakMap();
function run(rotation, overrides = {}, output = 'detailed') {
  const config = {
    specialization: 'Bladesworn',
    initialResource: 100,
    selectedTraitIds: [],
    attributeInputs: baseAttributeInputs({ power: 2000, precision: 1000 }),
    target: { armor: 2597 },
    ...overrides
  };
  const native = warriorProfession.runtimeFor(config);
  const casts = [];
  // Retain the actual accepted casts so ownership checks do not depend on any release-storage container.
  const result = observeGw2Runtime({
    profession: {
      ...native,
      onCastStart(runtime, cast) {
        native.onCastStart?.(runtime, cast);
        if (cast.skill.dragonSlash) casts.push(cast);
      }
    },
    config,
    rotation,
    output
  });
  acceptedSlashes.set(result, casts);
  return result;
}

const release = (result) =>
  result.events.find((e) => e.resource === 'dragon charges' && e.reason === 'profession mechanic');
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

// Cached declarations must never share a release with a later run that reuses the same reservation IDs.
test('Dragon Trigger release facts belong to one simulation and survive exit immutably', () => {
  const first = run([combat, 'Dragon Trigger', slash(2, 0)]);
  const firstState = observedRuntime(first).profession.specialization.state;
  const [firstCast] = acceptedSlashes.get(first);
  const firstRelease = dragonSlashRelease(firstCast);
  const second = run([combat, 'Dragon Trigger', slash(1, 0)]);
  const [secondCast] = acceptedSlashes.get(second);
  assert.equal(firstCast.id, secondCast.id);
  assert.notEqual(firstCast, secondCast);
  assert.equal(dragonSlashRelease({ ...firstCast }), undefined);
  assert.equal(firstState.dragonTriggerActive, false);
  assert.equal(firstState.dragonCharges.value, 0);
  assert.equal(dragonSlashRelease(firstCast), firstRelease);
  assert.equal(firstRelease.charges, 2);
  assert.equal(dragonSlashRelease(secondCast).charges, 1);
  assert.equal(Object.isFrozen(firstRelease), true);
  observedRuntime(first).mechanics.resourceController.grant('dragonCharges', 1);
  assert.equal(firstRelease.charges, 2);
});

test('release holds add to actual charge completion with and without Tactical Reload', () => {
  for (const reload of [false, true]) {
    const setup = [combat, ...(reload ? ['Tactical Reload'] : []), 'Dragon Trigger'];
    const base = run([...setup, slash(10, 0)]);
    const held = run([...setup, slash(10, 80)]);
    assert.deepEqual(held.warnings, []);
    close(release(held).at - release(base).at, 0.08);
    assert.equal(release(held).chargesReached, 10);
    assert.equal(release(held).flowSpent, release(base).flowSpent);
    const ticks = held.events.filter((e) => e.reason === 'dragon trigger charge');
    close(release(held).at - ticks.at(-1).at, 0.08);
    const score = run([...setup, slash(10, 80)], {}, 'score');
    close(score.totalDamage, held.totalDamage);
    close(score.rotationEndTime, held.rotationEndTime);
  }
});

test('a partial-charge hold freezes charges and spending while regeneration continues', () => {
  const base = run([combat, 'Dragon Trigger', slash(2, 0)]);
  const held = run([combat, 'Dragon Trigger', slash(2, 960)]);
  assert.deepEqual(held.warnings, []);
  close(release(held).at - release(base).at, 0.96);
  assert.equal(release(held).chargesReached, 2);
  assert.equal(release(held).flowSpent, release(base).flowSpent);
  close(release(held).flowAfter - release(base).flowAfter, 0.96 * 2);
  assert.equal(held.events.filter((e) => e.reason === 'dragon trigger charge').length, 2);
});

test('Flow shortages settle before the release delay and retries do not restart the hold', () => {
  const setup = [combat, 'Dragon Trigger'];
  const base = run([...setup, slash(2, 0)], { initialResource: 15 });
  const held = run([...setup, slash(2, 80)], { initialResource: 15 });
  assert.deepEqual(held.warnings, []);
  assert.ok(release(base).at > 0.48);
  close(release(held).at - release(base).at, 0.08);
  assert.equal(release(held).flowSpent, release(base).flowSpent);
});

test('concurrent utility inputs do not become the release-delay anchor', () => {
  const held = run([
    combat,
    'Dragon Trigger',
    { type: 'cast', skillId: ID.FLOW_STABILIZER, concurrentOffsetMs: 2200 },
    { type: 'cast', skillId: ID.FLICKER_STEP, concurrentOffsetMs: 120 },
    slash(10, 80)
  ]);
  assert.deepEqual(held.warnings, []);
  close(release(held).at, 2.48);
});

test('a hold does not survive its Trigger occurrence or postpone the Trigger expiry', () => {
  const held = run([combat, 'Dragon Trigger', slash(1, 80), 'Dragonspike Mine', 'Dragon Trigger', slash(1, 0)]);
  assert.deepEqual(held.warnings, []);
  const entries = held.events.filter((e) => e.reason === 'dragon trigger entry');
  const releases = held.events.filter((e) => e.resource === 'dragon charges' && e.reason === 'profession mechanic');
  close(releases[1].at - entries[1].at, 0.24);
  const expired = run([combat, 'Dragon Trigger', slash(10, 30000), wait(31000)]);
  assert.ok(expired.warnings.some((w) => w.includes('additional release delay')));
  assert.equal(release(expired), undefined);
  assert.equal(observedRuntime(expired).profession.specialization.state.dragonTriggerActive, false);
});
