import assert from 'node:assert/strict';
import test from 'node:test';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { BERSERKER_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/warrior/specializations/berserker/profiles.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';

// Exercise the registered family with one live Core and specialization owner.
function run(rotation, overrides = {}, source = warriorProfession, output = 'detailed') {
  const config = {
    specialization: 'Berserker',
    primaryWeapon: 'Axe',
    initialResource: 30,
    selectedTraitIds: [],
    stats: { power: 2000, precision: 1000 },
    target: { armor: 2597 },
    ...overrides
  };
  return observeGw2Runtime({ profession: source.runtimeFor(config), config, rotation, output });
}

const wait = (durationMs) => ({ type: 'wait', durationMs });
const state = (result) => observedRuntime(result).profession.specialization.state;

test('Berserk entry spends once, changes the cap, and expiry restores the Core cap', () => {
  const entered = run(['Berserk']);
  assert.deepEqual(entered.warnings, []);
  assert.equal(entered.planningState.profession.adrenaline, 10);
  assert.equal(entered.planningState.profession.maximumAdrenaline, 10);
  assert.equal(state(entered).berserkActive, true);
  const expired = run(['Berserk', wait(20000)]);
  assert.equal(state(expired).berserkActive, false);
  assert.equal(expired.planningState.profession.maximumAdrenaline, 30);
  assert.equal(expired.planningState.profession.adrenaline, 10);
  const unavailable = run(['Decapitate']);
  assert.equal(unavailable.steps[0].invalid, true);
  assert.match(unavailable.warnings[0], /Primal bursts require berserk/);
});

test('Rage extension survives the original expiry and cannot revive mode after expiration', () => {
  const config = { selectedSkills: ['Outrage'] };
  const rotation = ['Berserk', wait(19000), 'Outrage', wait(2000)];
  const extended = run(rotation, config);
  assert.deepEqual(extended.warnings, []);
  assert.equal(state(extended).berserkActive, true);
  assert.equal(state(extended).berserkUntil, 23);
  const expired = run([...rotation, wait(2000)], config);
  assert.equal(state(expired).berserkActive, false);
  const late = run(['Berserk', wait(20000), 'Outrage'], config);
  assert.equal(state(late).berserkActive, false);
  assert.equal(late.planningState.profession.maximumAdrenaline, 30);
  const reentry = run(['Berserk', 'Berserk']);
  assert.equal(observedRuntime(reentry).time, 20);
  assert.equal(reentry.steps[1].invalid, true);
  assert.match(reentry.warnings[0], /requires 30 adrenaline/);
});

test('mode expiration during a Rage cast restores the cap before independent completion traits', () => {
  const result = run(['Berserk', wait(19600), 'Shattering Blow'], {
    selectedSkills: ['Shattering Blow'],
    selectedTraitIds: [TRAIT.LAST_BLAZE]
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(state(result).berserkActive, false);
  assert.equal(state(result).berserkUntil, 0);
  assert.equal(result.planningState.profession.maximumAdrenaline, 30);
  assert.ok(
    result.resolvedEvents.some((event) => event.sourceId === TRAIT.LAST_BLAZE && event.skillId === ID.SHATTERING_BLOW)
  );
});

test('canceled Berserk retains spending while removed mode keeps independent entry boons', () => {
  // Give the instant entry a cancellable reservation to verify the lifecycle contract without editing timing data.
  const delayed = {
    runtimeFor: (config) => ({ ...warriorProfession.runtimeFor(config), castDurationMs: () => 1000 })
  };
  const canceled = run([{ name: 'Berserk', interruptAfterMs: 1 }], {}, delayed);
  assert.deepEqual(canceled.warnings, []);
  assert.equal(canceled.planningState.profession.adrenaline, 0);
  assert.equal(state(canceled).berserkActive, false);
  const removed = withPatchPreview(warriorProfession, {
    id: 'berserk-removed',
    label: 'Berserk removed',
    professions: { warrior: { balanceProfiles: { [PROFILE.resources]: { removeEffects: [{ type: 'buff' }] } } } }
  });
  const result = run(['Berserk'], { patchId: 'berserk-removed' }, removed);
  assert.deepEqual(result.warnings, []);
  assert.equal(state(result).berserkActive, false);
  assert.equal(result.planningState.profession.maximumAdrenaline, 30);
  assert.ok(result.resolvedEvents.some((event) => event.sourceId === TRAIT.BURST_OF_AGGRESSION));
});

test('completed Blood Reckoning clears primal recharge and canceled healing leaves it intact', () => {
  const config = { primaryWeapon: 'Greatsword', selectedSkills: ['Blood Reckoning'] };
  const rotation = ['Berserk', 'Arc Divider'];
  const reset = run([...rotation, 'Blood Reckoning'], config);
  assert.deepEqual(reset.warnings, []);
  assert.equal(observedRuntime(reset).cooldowns.has(ID.ARC_DIVIDER), false);
  const canceled = run([...rotation, { name: 'Blood Reckoning', interruptAfterMs: 1 }], config);
  assert.ok(observedRuntime(canceled).cooldowns.get(ID.ARC_DIVIDER) > observedRuntime(canceled).time);
});

test('primal completion extends mode and applies independent party boons while cancellation cannot', () => {
  const config = { selectedTraitIds: [TRAIT.SMASH_BRAWLER, TRAIT.HEAT_THE_SOUL] };
  const result = run(['Berserk', 'Decapitate'], config);
  assert.deepEqual(result.warnings, []);
  assert.equal(state(result).berserkUntil, 21);
  const boons = result.resolvedEvents.filter((event) => event.sourceId === TRAIT.HEAT_THE_SOUL);
  assert.deepEqual(boons.map((event) => event.kind).sort(), ['fury', 'might', 'quickness']);
  assert.ok(boons.every((event) => event.audience.recipients === 'party'));
  const canceled = run(['Berserk', { name: 'Decapitate', interruptAfterMs: 1 }], config);
  assert.equal(state(canceled).berserkUntil, 20);
  assert.equal(
    canceled.resolvedEvents.some((event) => event.sourceId === TRAIT.HEAT_THE_SOUL),
    false
  );
});

test('King of Fires consumes one actual critical aura on completion and cannot recurse through its own strike', () => {
  const config = {
    selectedSkills: ['Wild Blow'],
    selectedTraitIds: [TRAIT.KING_OF_FIRES],
    stats: { power: 2000, precision: 0 }
  };
  const result = run(['Wild Blow'], config);
  assert.deepEqual(result.warnings, []);
  const detonations = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.KING_OF_FIRES
  );
  assert.equal(detonations.length, 1);
  assert.equal(state(result).fireAuraUntil, 0);
  assert.equal(detonations[0].ownerActorType, 'player');
  const missed = run([{ name: 'Wild Blow', offTarget: true }], config);
  assert.equal(state(missed).kingOfFiresReadyAt, 0);
  assert.equal(
    missed.resolvedEvents.some((event) => event.sourceId === TRAIT.KING_OF_FIRES),
    false
  );
});

test('a critical arriving after completed Berserker activation detonates without reading report history', () => {
  const config = {
    selectedSkills: ['Wild Blow'],
    selectedTraitIds: [TRAIT.KING_OF_FIRES],
    stats: { power: 2000, precision: 0 }
  };
  const rotation = [{ name: 'Wild Blow', impactDelayMs: 1000 }, wait(2000)];
  const detailed = run(rotation, config);
  const score = run(rotation, config, warriorProfession, 'score');
  assert.deepEqual(detailed.warnings, []);
  const strike = detailed.resolvedEvents.find((event) => event.type === 'damage' && event.actorType === 'player');
  const detonation = detailed.resolvedEvents.find(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.KING_OF_FIRES
  );
  assert.equal(detonation.at, strike.at);
  assert.equal(score.totalDamage, detailed.totalDamage);
  assert.equal(score.conditionDamage, detailed.conditionDamage);
});

test('combo Fire Aura can detonate during the critical-aura cooldown and an unused aura expires', () => {
  const config = {
    primaryWeapon: 'Longbow',
    selectedSkills: ['Sundering Leap'],
    selectedTraitIds: [TRAIT.KING_OF_FIRES],
    stats: { power: 2000, precision: 4000 }
  };
  const result = run(['Berserk', 'Scorched Earth', 'Sundering Leap'], config);
  assert.deepEqual(result.warnings, []);
  const detonations = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.sourceId === TRAIT.KING_OF_FIRES
  );
  assert.equal(detonations.length, 2);
  assert.equal(detonations[1].skillId, ID.SUNDERING_LEAP);
  const unused = run(['Chop', wait(5000)], { ...config, primaryWeapon: 'Axe' });
  assert.deepEqual(unused.warnings, []);
  assert.equal(state(unused).fireAuraUntil, 0);
  assert.equal(
    unused.resolvedEvents.some((event) => event.type === 'damage' && event.sourceId === TRAIT.KING_OF_FIRES),
    false
  );
});

test('removing King of Fires strike preserves Burning while removing its aura prevents detonation', () => {
  const config = { patchId: 'king-live', selectedSkills: ['Wild Blow'], selectedTraitIds: [TRAIT.KING_OF_FIRES] };
  for (const type of ['strike', 'buff']) {
    const patched = withPatchPreview(warriorProfession, {
      id: 'king-live',
      label: 'King live',
      professions: {
        warrior: {
          balanceProfiles: { [PROFILE.kingOfFires]: { removeEffects: [{ type }] } }
        }
      }
    });
    const result = run(['Wild Blow', wait(4000)], config, patched);
    assert.deepEqual(result.warnings, []);
    assert.equal(
      result.resolvedEvents.some((event) => event.type === 'damage' && event.sourceId === TRAIT.KING_OF_FIRES),
      false
    );
    assert.equal(
      result.resolvedEvents.some((event) => event.type === 'condition' && event.sourceId === TRAIT.KING_OF_FIRES),
      type === 'strike'
    );
  }
});
