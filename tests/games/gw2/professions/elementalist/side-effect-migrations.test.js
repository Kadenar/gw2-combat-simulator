import assert from 'node:assert/strict';
import test from 'node:test';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { withSkill, withProfile } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { EVOKER_BALANCE_PROFILE_IDS as EVOKER } from '#gw2/professions/elementalist/specializations/evoker/profiles.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';

// Live skill fields remain the one amount source; eligibility is commitment, and the shared pool still caps rewards.
test('Elementalist endurance declarations retain patched amounts and committed-cast eligibility', () => {
  for (const [skillId, specialization] of [
    [ID.AQUATIC_STANCE, 'Weaver'],
    [ID.HARES_AGILITY, 'Evoker']
  ]) {
    for (const [mode, amount, initial] of [
      ['full', 23, 0],
      ['committed', 23, 0],
      ['cancelled', 23, 0],
      ['full', 23, 95],
      ['full', 0, 0]
    ]) {
      const profession = {
        ...elementalistProfession,
        runtimeFor(config) {
          const native = elementalistProfession.runtimeFor(config);
          // A synthetic interruptible reward isolates the commit contract without asserting production animation values.
          return {
            ...native,
            catalog: withSkill(native.catalog, skillId, {
              castTimeMs: 1000,
              interruptCommitMs: 200,
              resourceGain: amount
            })
          };
        }
      };
      const result = runElementalist(
        [{ type: 'cast', skillId, ...(mode === 'full' ? {} : { interruptAfterMs: mode === 'committed' ? 400 : 100 }) }],
        {
          specialization,
          primaryWeapon: 'Dagger',
          selectedTraitIds: [],
          initialEndurance: initial,
          selectedSkills: [skillId === ID.AQUATIC_STANCE ? 'Aquatic Stance' : "Hare's Agility"]
        },
        { profession }
      );
      assert.deepEqual(result.warnings, []);
      const runtime = observedRuntime(result);
      assert.equal(
        runtime.profession.core.endurance,
        Math.min(100, initial + runtime.time * 5 + (mode === 'cancelled' ? 0 : amount))
      );
    }
  }
});

// Build a minimal meditation with selected live tuning, keeping all registered familiar and completion owners.
function fox({ might = 0, command = {}, profile = {}, skill = {}, timeline = [] } = {}) {
  const profession = {
    ...elementalistProfession,
    runtimeFor(config) {
      const native = elementalistProfession.runtimeFor(config);
      return {
        ...native,
        catalog: withSkill(withProfile(native.catalog, EVOKER.foxsFury, profile), ID.FOXS_FURY, skill)
      };
    }
  };
  return runElementalist(
    [
      { type: 'cast', skillId: ID.FOXS_FURY, ...command },
      { type: 'wait', durationMs: 2000 }
    ],
    {
      specialization: 'Evoker',
      evokerElement: 'Fire',
      selectedTraitIds: [],
      selectedSkills: ["Fox's Fury"],
      boons: { might }
    },
    { profession, timeline }
  );
}

const foxPackets = (result) =>
  result.resolvedEvents.filter(
    (event) => event.skillId === ID.FOXS_FURY && ['damage', 'condition'].includes(event.type)
  );

test("Fox's Fury selects one live Might tier and does not resample it at impact", () => {
  for (const [might, coefficient] of [
    [6, 1.5],
    [7, 2.25],
    [13, 2.25],
    [14, 3]
  ]) {
    const result = fox({ might, profile: { threshold: 7 } });
    assert.deepEqual(result.warnings, []);
    assert.equal(foxPackets(result).find((event) => event.type === 'damage').coefficient, coefficient);
  }

  const snapshot = fox({
    timeline: [
      {
        at: 0.1,
        run(runtime) {
          runtime.emit({
            type: 'buff',
            at: runtime.time,
            source: 'test',
            sourceId: 'test',
            actorType: 'player',
            kind: 'might',
            stacks: 25,
            duration: 10,
            audience: { recipients: 'self' }
          });
        }
      }
    ]
  });
  assert.equal(foxPackets(snapshot).find((event) => event.type === 'damage').coefficient, 1.5);
});

test("Fox's Fury retains fractional Burning and independent component removal", () => {
  for (const removed of [null, 'strike', 'condition']) {
    const effects = [
      { type: 'strike', name: 'Tier 3', coefficient: 4 },
      { type: 'condition', name: 'Tier 3', condition: 'Burning', stacks: 2.5, duration: 7 }
    ].filter((effect) => effect.type !== removed);
    const result = fox({ might: 25, profile: { effects } });
    assert.deepEqual(result.warnings, []);
    const packets = foxPackets(result);
    const hit = packets.find((event) => event.type === 'damage');
    assert.equal(Boolean(hit), removed !== 'strike');
    if (hit) {
      assert.equal(hit.coefficient, 4);
      assert.equal(hit.weaponStrengthProfileId, 'nonweapon.unequipped');
      assert.equal(hit.activationId, result.steps[0].activationId);
    }

    const burning = packets.filter((event) => event.type === 'condition');
    assert.deepEqual(
      burning.map((event) => event.stacks),
      removed === 'condition' ? [] : [1, 1, 0.5]
    );
    assert.ok(burning.every((event) => event.duration === 7 && event.actorType === 'player'));
  }
});

test("Fox's Fury preserves commitment and applies command delay and targeting to its selected packets", () => {
  assert.deepEqual(foxPackets(fox({ command: { interruptAfterMs: 100 } })), []);
  const committed = fox({ skill: { interruptCommitMs: 200 }, command: { interruptAfterMs: 400 } });
  assert.deepEqual(committed.warnings, []);
  const action = committed.events.find((event) => event.type === 'action' && event.skillId === ID.FOXS_FURY);
  assert.ok(foxPackets(committed).every((event) => event.at > action.endsAt));
  assert.ok(foxPackets(committed).length > 0);
  const baseline = fox();
  const delayed = fox({ command: { impactDelayMs: 250 } });
  assert.deepEqual(delayed.warnings, []);
  const original = foxPackets(baseline),
    shifted = foxPackets(delayed);
  assert.equal(shifted.length, original.length);
  for (let index = 0; index < shifted.length; index++)
    assert.ok(Math.abs(shifted[index].at - original[index].at - 0.25) < 1e-9);
  const completionBoons = (result) =>
    result.resolvedEvents
      .filter(
        (event) => event.type === 'buff' && event.skillId === ID.FOXS_FURY && event.at === result.steps[0].end / 1000
      )
      .map((event) => [event.kind, event.at, event.stacks]);
  assert.deepEqual(completionBoons(delayed), completionBoons(baseline));
  const missed = fox({ command: { offTarget: true } });
  assert.deepEqual(missed.warnings, []);
  assert.ok(foxPackets(missed).every((event) => event.offTarget === true && !(event.damage > 0)));
  assert.deepEqual(completionBoons(missed), completionBoons(baseline));
});
