// Exercise Double Edge through real casts so delayed packets, recharge and payouts follow the accepted outcome.
import assert from 'node:assert/strict';
import test from 'node:test';

import { THIEF_SKILL_IDS as ID } from '#gw2/professions/thief/data/ids.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

test('Cannon preserves the outcome of shots in flight across a risky recast', () => {
  const skillId = ID.STONE_SUMMIT_CANNON;
  const cast = { type: 'cast', skillId, doubleEdgeOutcome: 'backfire' };
  const result = runThief(
    [cast, cast, { type: 'wait', durationMs: 3500 }],
    { specialization: 'Antiquary', selectedSkillIds: [skillId] },
    {
      // Distinct fixture payloads identify each outcome after the second cast has already started.
      catalog: (catalog) =>
        withSkill(catalog, skillId, {
          effects: [
            { type: 'strike', packetLabel: 'success', coefficient: 1, atMs: 1000 },
            { type: 'strike', packetLabel: 'backfire', coefficient: 2 }
          ]
        })
    }
  );
  assert.deepEqual(result.warnings, []);
  const [first, second] = result.events.filter(
    (event) => event.skillId === skillId && event.type === 'action' && event.endsAt != null
  );
  const hits = result.events.filter((event) => event.skillId === skillId && event.type === 'damage');
  const success = hits.find((hit) => hit.activationId === first.activationId);
  assert.ok(success);
  assert.ok(success.at > second.at);
  assert.equal(success.coefficient, 1);
  assert.equal(hits.find((hit) => hit.activationId === second.activationId)?.coefficient, 2);
});

test('a risky Antivenom recast keeps the running recharge whether it commits or is cancelled', () => {
  const skillId = ID.ANTIVENOM_DRAUGHT;
  const runningDeadline = 1;
  for (const cancelled of [false, true]) {
    const result = runThief(
      [{ type: 'cast', skillId, doubleEdgeOutcome: 'backfire', ...(cancelled ? { interruptAfterMs: 80 } : {}) }],
      { specialization: 'Antiquary', selectedSkillIds: [skillId] },
      {
        initialize(runtime) {
          runtime.cooldownController.setReadyAt(skillId, runningDeadline);
          runtime.profession.specialization.state.scoundrelsLuck = 1;
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.ok(
      result.events.some(
        (event) => event.type === 'action' && event.skillId === skillId && Boolean(event.cancelled) === cancelled
      )
    );
    const runtime = observedRuntime(result);
    assert.equal(runtime.cooldownController.readyAt(skillId), runningDeadline);
    // Acceptance spends Luck even when the rotation cancels the use.
    assert.equal(runtime.profession.specialization.state.scoundrelsLuck, 0);
  }
});

test("Holo-Dancer's utility recharge reduction waits for a use that starts a recharge", () => {
  const skillId = ID.CANACH_COIN_TOSS;
  for (const recharging of [false, true]) {
    const result = runThief(
      [{ type: 'cast', skillId, doubleEdgeOutcome: 'success' }],
      { specialization: 'Antiquary', selectedSkillIds: [skillId] },
      {
        initialize(runtime) {
          if (recharging) runtime.cooldownController.setReadyAt(skillId, 5);

          runtime.profession.specialization.state.holoUtilityCooldownReductionExpirations = [10];
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const { state } = observedRuntime(result).profession.specialization;
    // A ready use spends the entry. A risky recast starts no recharge and keeps it.
    assert.equal(state.holoUtilityCooldownReductionExpirations.length, recharging ? 1 : 0);
  }
});

test('Canach-Coin Toss pays consecutive rolls at commitment', () => {
  const skillId = ID.CANACH_COIN_TOSS;
  const cast = { type: 'cast', skillId, doubleEdgeOutcome: 'backfire' };
  const payouts = [];
  let beforeCast;
  const result = runThief(
    [cast, cast],
    { specialization: 'Antiquary', selectedSkillIds: [skillId], initialInitiative: 0 },
    {
      // Observe both phases of the instant cast so passive recovery between inputs cannot count as a payout.
      extend: (native) => ({
        onCastStart(runtime, cast) {
          beforeCast = runtime.resourceController.value('initiative');
          native.onCastStart(runtime, cast);
          assert.equal(runtime.resourceController.value('initiative'), beforeCast);
        },
        onCastCommit(runtime, cast) {
          native.onCastCommit(runtime, cast);
          payouts.push(runtime.resourceController.value('initiative') - beforeCast);
        }
      })
    }
  );
  assert.deepEqual(result.warnings, []);
  // The ready cast succeeds with two heads. The risky recast backfires and pays only for its one head.
  assert.deepEqual(payouts, [5, 1]);
});
