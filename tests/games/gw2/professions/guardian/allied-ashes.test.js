import assert from 'node:assert/strict';
import test from 'node:test';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { grantAshes } from '#gw2/professions/guardian/specializations/firebrand/mechanics/ashes.js';
import { ASHES_PROFILE } from '#gw2/professions/guardian/specializations/firebrand/ashes-profiles.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';

// A Quickfire-sized grant isolates allied charge retention from the player's tome and strike activity.
function run({ duration = 5, charges = 1, combatStartTime = 3, output, secondGrantAt, end = 6 } = {}) {
  const config = { specialization: 'Firebrand', allies: { count: 2, strikesPerSecond: 2 } };
  const native = guardianProfession.runtimeFor(config);
  const grant = (runtime) =>
    grantAshes(runtime, {
      source: 'quickfire',
      cause: {
        type: 'buff',
        at: runtime.time,
        source: 'test',
        sourceId: 'test.ashes',
        actorType: 'player',
        activationId: `grant:${runtime.time}`,
        skillName: 'Quickfire'
      },
      charges,
      lifetimeSeconds: duration,
      recipients: { includesSelf: false, maximumAllies: 1 }
    });
  return observeGw2Runtime({
    config,
    combatStartTime,
    output,
    rotation: [{ type: 'wait', durationMs: end * 1000 }],
    profession: {
      ...native,
      initialize(runtime) {
        native.initialize?.(runtime);
        grant(runtime);

        if (secondGrantAt != null) runtime.schedule('test.grant', secondGrantAt);
      },
      tasks: { ...native.tasks, 'test.grant': grant }
    }
  });
}

const burns = (result) =>
  result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just'
  );

test('precast Ashes retains its charge for the first eligible allied strike and keeps recipient attribution', () => {
  const result = run();
  assert.deepEqual(
    burns(result).map(({ at, metadata }) => [at, metadata.triggeredByAlly]),
    [[3.5, 1]]
  );
  assert.deepEqual(result.warnings, []);
  const [burn] = burns(result);
  assert.equal(burn.actorType, 'player');
  assert.equal(burn.skillName, 'Quickfire');
  assert.equal(burn.name, 'Quickfire \u2014 Ally 1 Burning');
  assert.equal(burn.procType, undefined);
  assert.equal(burn.icon, undefined);
  assert.match(burn.activationId, /^grant:0:ally:1:/);
  assert.equal(run({ output: 'score' }).totalDamage, result.totalDamage);
  assert.deepEqual(burns(run({ duration: 2 })), []);
});

// Allies refresh like the player: a live grant keeps its strict cooldown, while an exhausted grant starts ready.
test('later Ashes grants refresh the ally grant under the player cooldown policy', () => {
  const interval = guardianProfession.catalog.balanceProfilesById.get(ASHES_PROFILE.mechanic).internalCooldown;
  const options = { combatStartTime: 0, secondGrantAt: 0.8, end: 0.5 + interval + 0.6 };
  const live = burns(run({ ...options, charges: 2 }));
  // The allied strike exactly at the cooldown deadline is blocked; the following strike fires.
  assert.deepEqual(
    live.map(({ at }) => at),
    [0.5, 0.5 + interval + 0.5]
  );
  assert.notEqual(live[1].activationId, live[0].activationId);
  assert.deepEqual(
    burns(run({ ...options, charges: 1 })).map(({ at }) => at),
    [0.5, 1]
  );
});
