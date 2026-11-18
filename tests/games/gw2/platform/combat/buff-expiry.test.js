// Synthetic deadlines protect tied reads, explicit removal, refresh, cleanup ordering, and capped grants.
import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { buffApplicationExpiry } from '#gw2/platform/combat/buff-expiry.js';
import { effectStateValue } from '#gw2/platform/combat/effect-state.js';
import { createLiveEffects } from '#gw2/platform/combat/live-effects.js';
import { endStealth, revealedActive, stealthActive } from '#gw2/platform/combat/stealth.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import {
  activeStackCount,
  addTimedStacks,
  consumeOldestStacks,
  expireStacks,
  purgeExpiredStacks
} from '#kernel/resources/timed-stacks.js';
import { observeGw2Runtime } from '#tests/helpers/observed-runtime.js';
import { runThief, thiefHit } from '#tests/helpers/thief-simulation.js';

const grant = (kind, at = 0, duration = 1) => ({
  type: 'buff',
  kind,
  at,
  duration,
  stacks: 1,
  source: 'fixture',
  sourceId: 'buff',
  actorType: 'player',
  audience: { recipients: 'self' }
});

// A blocked command must wait for the entire cleanup phase, including work created by cleanup.
test('the coordinator drains all tied expiry work before retrying a blocked command', () => {
  for (const followup of [false, true]) {
    const trace = [];
    const result = runThief(
      [ID.ASSASSINS_SIGNET, ID.ASSASSINS_SIGNET],
      { selectedSkillIds: [ID.ASSASSINS_SIGNET] },
      {
        initialize(runtime) {
          runtime.mechanics.scheduleExpiry('fixture.cleanup', 0, 'first');

          if (!followup) runtime.mechanics.scheduleExpiry('fixture.cleanup', 0, 'second');
        },
        extend(native) {
          return {
            tasks: {
              ...native.tasks,
              'fixture.cleanup'(runtime, label) {
                trace.push(label);

                if (followup && label === 'first') runtime.schedule('fixture.cleanup', runtime.time, 'second');
              }
            }
          };
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(trace, ['first', 'second']);
    assert.equal(result.steps.filter((step) => step.skillId === ID.ASSASSINS_SIGNET).length, 2);
  }
});

// Expiring stacks can affect this hit without reserving capacity for the replacement's future lifetime.
test('a capped grant replaces tied expiries without dropping the grant or exceeding capacity', () => {
  assert.equal(activeStackCount([1, 3], 1), 2);
  const grant = addTimedStacks([1, 3], 1, 1, 4, 2);
  assert.equal(grant.added, 1);
  assert.equal(activeStackCount(grant.expiries, 1), 2);
  assert.equal(activeStackCount(grant.expiries, 1.5), 2);
  assert.deepEqual(grant.expiries, [3, 5]);
  assert.deepEqual(addTimedStacks([1, 3], 1, 1, 0, 2), { expiries: [1, 3], added: 0 });
});

test('gameplay purges keep a tied stack while cleanup expiry removes it', () => {
  assert.deepEqual(purgeExpiredStacks([1, 3], 1), [1, 3]);
  assert.deepEqual(expireStacks([1, 3], 1), [3]);
  assert.deepEqual(purgeExpiredStacks([1, 3], 1.000001), [3]);
});

test('natural buff and boon deadlines stay live through their own timestamp', () => {
  const effects = createLiveEffects();
  for (const kind of ['assassins-signet', 'might', 'fury']) {
    effects.grant(grant(kind));
    const stacks = (at) => effects.queries.stacks(kind, at, 25);
    const state = () => effects.queries.effectStates(kind, 1, { kind }, true)[0];
    assert.equal(stacks(1), 1);
    assert.equal(effectStateValue(state(), 1).count, 1);
    assert.equal(state(), state(), 'repeated reads reuse the same observation');
    assert.equal(stacks(1.000001), 0);
  }
});

test('explicit removal is immediate and a same-time replacement survives the old deadline', () => {
  const effects = createLiveEffects();
  effects.grant(grant('assassins-signet'));
  assert.equal(effects.queries.stacks('assassins-signet', 1, 25), 1);
  effects.endBuffs('assassins-signet', 1, () => true);
  assert.equal(effects.queries.stacks('assassins-signet', 1, 25), 0);
  effects.grant(grant('assassins-signet', 1, 2));
  assert.equal(effects.queries.stacks('assassins-signet', 1, 25), 1);
  assert.equal(effects.queries.stacks('assassins-signet', 3, 25), 1);
  assert.equal(effects.queries.stacks('assassins-signet', 3.000001, 25), 0);
});

// Removal records its own instant; the natural deadline stays in `expiresAt` for refresh and reporting.
test('early removal keeps the natural deadline and ends live and observed state at removal', () => {
  const effects = createLiveEffects();
  effects.grant(grant('assassins-signet', 0, 2));
  const observed = effects.queries.effectStates('assassins-signet', 0.5, { kind: 'assassins-signet' }, true)[0];
  effects.endBuffs('assassins-signet', 1, () => true);
  const [ended] = effects.queries.buffApplications('assassins-signet');
  assert.equal(ended.expiresAt, 2);
  assert.equal(ended.removedAt, 1);
  assert.equal(buffApplicationExpiry(ended), 1);
  assert.equal(effects.queries.stacks('assassins-signet', 0.5, 25), 1);
  assert.equal(effects.queries.stacks('assassins-signet', 1, 25), 0);
  const removed = effects.queries.effectStates('assassins-signet', 0.5, { kind: 'assassins-signet' }, true)[0];
  assert.notEqual(removed, observed, 'removal invalidates the cached observation');
  assert.deepEqual(effectStateValue(removed, 0.75), { count: 1, expiresAt: 1, source: removed.source });
  assert.equal(effectStateValue(removed, 1).count, 0);
});

test('a boon extension at the exact deadline extends the pool', () => {
  const effects = createLiveEffects();
  effects.grant(grant('fury'));
  effects.extend({ type: 'boon_extension', kind: 'fury', at: 1, duration: 2 });
  assert.equal(effects.queries.boonDuration('fury', 2), 1);
  assert.equal(effects.queries.stacks('fury', 2, 1), 1);
  assert.equal(effects.queries.stacks('fury', 3.000001, 1), 0);
});

test('private timers and stack consumption share natural expiry without reviving removed state', () => {
  const state = { stealthStartedAt: 0, stealthUntil: 1, revealedUntil: 0 };
  assert.equal(stealthActive(state, 1), true);
  endStealth(state, 1);
  assert.equal(stealthActive(state, 1), false);
  assert.equal(revealedActive(state, 1), true);
  assert.equal(revealedActive(state, 4), true);
  assert.equal(revealedActive(state, 4.000001), false);
  assert.equal(activeStackCount([1, 1], 1), 2);
  const spent = consumeOldestStacks([1, 1], 1, 1);
  assert.equal(activeStackCount(spent.expiries, 1), 1);
});

test('the coordinator resolves tied hits and their reactions before expiry cleanup', () => {
  const trace = [];
  const result = runThief(
    [{ type: 'wait', durationMs: 1040 }],
    {},
    {
      initialize(runtime) {
        runtime.mechanics.effects.emit({ kind: 'packet', event: grant('assassins-signet') });
        for (const [index, at] of [1, 1, 1.000001].entries())
          runtime.mechanics.effects.emit({ kind: 'packet', event: thiefHit(at, { name: String(index) }) });
        runtime.mechanics.scheduleExpiry('fixture.expiry', 1, undefined, { priority: -1000 });
      },
      extend(native) {
        return {
          tasks: {
            ...native.tasks,
            'fixture.expiry'() {
              trace.push('expiry');
            }
          },
          reactions: {
            ...native.reactions,
            'damage.resolving'(runtime, event) {
              trace.push(['hit', runtime.combat.activeBuffStacks('assassins-signet', runtime.time)]);
              return native.reactions?.['damage.resolving']?.(runtime, event);
            }
          }
        };
      }
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(trace, [['hit', 1], ['hit', 1], 'expiry', ['hit', 0]]);
});

// The same native deadline must affect resolved power without extending either buff to a later hit.
test("Revealed Training and Assassin's Signet contribute power through their exact expiry", () => {
  const config = {
    specialization: 'Core',
    primaryWeapon: 'Dagger',
    selectedTraitIds: [TRAIT.REVEALED_TRAINING],
    selectedSkillIds: [ID.ASSASSINS_SIGNET],
    attributeInputs: baseAttributeInputs({ power: 1000, precision: 1000 })
  };
  const result = observeGw2Runtime({
    profession: thiefProfession.runtimeFor(config),
    config,
    rotation: [ID.ASSASSINS_SIGNET, { type: 'wait', durationMs: 5040 }],
    damageDiagnostics: true,
    engineInitialize(runtime) {
      runtime.profession.core.revealedUntil = 5;
      for (const at of [5, 5.000001]) runtime.effects.emit({ kind: 'packet', event: thiefHit(at) });
    }
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.resolvedEvents.filter((event) => event.type === 'damage').map((event) => event.damageCalculation.power),
    [1740, 1080]
  );
});
