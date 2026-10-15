import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });

for (const specialization of ['Core', 'Druid', 'Galeshot', 'Soulbeast', 'Untamed']) {
  // Commands take priority before the AI opener, during its windup, and after its impact.
  for (const requestedAt of [320, 600, 1200]) {
    test(`${specialization} pet command preempts autonomous activity at ${requestedAt} ms`, () => {
      const result = runRanger(
        [
          '__combat_start',
          ...(specialization === 'Soulbeast' ? ['Leave Beastmode'] : []),
          wait(requestedAt),
          ID.FANG_GRAPPLE,
          wait(6000)
        ],
        { specialization, selectedPet: 'Fanged Iboga', initialUntamedState: 'Ranger' }
      );
      assert.deepEqual(result.warnings, []);
      const actions = result.events.filter((event) => event.type === 'action' && event.source === 'ranger-pet');
      const command = actions.find((event) => event.skillId === ID.FANG_GRAPPLE);
      assert.ok(command);
      assert.equal(command.at, requestedAt / 1000);
      const priorAuto = actions.find((event) => event.skillId === ID.CONSUMING_BITE && event.at < command.at);
      if (requestedAt === 320) {
        assert.equal(priorAuto, undefined);
      } else {
        assert.ok(priorAuto);
        assert.equal(priorAuto.interrupted, true);
        assert.equal(priorAuto.endsAt, command.at);
        const landedHits = result.resolvedEvents.filter(
          (event) => event.type === 'damage' && event.activationId === priorAuto.activationId
        );
        assert.equal(landedHits.length > 0, requestedAt === 1200);
        assert.ok(landedHits.every((event) => event.at <= command.at));
      }

      const following = actions.filter((event) => event.at > command.at);
      assert.ok(following.length > 0);
      assert.ok(following.every((event) => event.at >= command.endsAt));
    });
  }
}

// Each natural Untamed command must finish before another manual command can own the pet lane.
for (const commands of [
  [ID.FELINE_BITE, ID.FURIOUS_POUNCE, ID.FELINE_MAUL],
  [ID.FURIOUS_POUNCE, ID.FELINE_MAUL, ID.FELINE_BITE],
  [ID.FELINE_MAUL, ID.FELINE_BITE, ID.FURIOUS_POUNCE]
]) {
  test(`Untamed queues manual commands without interrupting the preceding command: ${commands.join(', ')}`, () => {
    const result = runRanger(['__combat_start', wait(600), ...commands, wait(10000)], {
      specialization: 'Untamed',
      selectedPet: 'Tiger',
      initialUntamedState: 'Ranger'
    });
    assert.deepEqual(result.warnings, []);
    const actions = commands.map((skillId) =>
      result.events.find((event) => event.type === 'action' && event.skillId === skillId)
    );
    // Each natural F1/F2/F3 command must preempt the AI attack when it is first in the queue.
    const auto = result.events.find(
      (event) => event.type === 'action' && event.source === 'ranger-pet' && event.at < actions[0].at
    );
    assert.ok(auto.interrupted);
    assert.equal(auto.endsAt, actions[0].at);
    for (const [index, action] of actions.entries()) {
      assert.ok(action);
      assert.ok(!action.interrupted && !action.cancelled);
      if (index > 0) assert.ok(action.at >= actions[index - 1].endsAt);
      assert.ok(
        result.resolvedEvents.some((event) => event.type === 'damage' && event.activationId === action.activationId)
      );
    }
  });
}
