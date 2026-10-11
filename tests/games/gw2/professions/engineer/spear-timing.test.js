import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import { recordBuffApplication } from '#gw2/platform/combat/boons.js';
import { skillFlipReady, armSkillFlip } from '#gw2/platform/execution/skill-flips.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { engineerCatalog, engineerProfession } from '#gw2/professions/engineer/profession.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { engineerSpearSideEffectHandlers } from '#gw2/professions/engineer/core/mechanics/spear.js';
import { applySkillSideEffects } from '#gw2/platform/effects/action-dispatch.js';
import { withSkill } from '#tests/helpers/catalog-overrides.js';
import { runEngineer } from '#tests/helpers/engineer-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { activeStackCount } from '#gw2/platform/combat/resources/timed-stacks.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';

const simulate = createObservedProfessionSimulator(engineerProfession, {
  primaryWeapon: 'Spear',
  attributeInputs: baseAttributeInputs({ power: 2000, conditionDamage: 1000 }),
  target: { armor: 2597, conditions: {} }
});
const artilleryEvents = (result) => result.resolvedEvents.filter((event) => event.sourceId === ID.ELECTRIC_ARTILLERY);

// The authored task observes live target state at its deadline, independently of an earlier committed interruption.
test('Devastator samples Focused at its task deadline and requires a committed cast with the task declared', () => {
  for (const { focused, cancelled = false, removeTask = false } of [
    { focused: true },
    { focused: false },
    { focused: true, cancelled: true },
    { focused: true, removeTask: true }
  ]) {
    const result = runEngineer(
      [
        { type: 'cast', skillId: ID.DEVASTATOR, interruptAfterMs: cancelled ? 100 : 600 },
        { type: 'wait', durationMs: 2000 }
      ],
      { primaryWeapon: 'Spear', boons: { quickness: true } },
      {
        initialize(runtime) {
          if (!focused)
            recordBuffApplication(runtime.buffs, {
              type: 'buff',
              kind: 'engineer-focused',
              at: 0,
              duration: 10,
              stacks: 1,
              resolvedAudience: {
                includesSelf: true,
                includesSummons: false,
                alliedPlayerCount: 0,
                companionIds: [],
                recipientCount: 1
              }
            });
        },
        extend(native) {
          return {
            catalog: withSkill(native.catalog, ID.DEVASTATOR, {
              castTimeMs: 1000,
              interruptCommitMs: 400,
              ...(removeTask ? { tasks: [] } : {})
            }),
            onCastStart(runtime, cast) {
              native.onCastStart(runtime, cast);
              runtime.schedule('test.focus-change', cast.start + (cast.fullEnd - cast.start) * 0.75);
            },
            tasks: {
              ...native.tasks,
              'test.focus-change'(runtime) {
                if (focused)
                  runtime.effects.emit({
                    kind: 'packet',
                    event: {
                      type: 'buff',
                      kind: 'engineer-focused',
                      at: runtime.time,
                      duration: 10,
                      stacks: 1,
                      source: 'Fixture',
                      sourceId: 'fixture',
                      actorType: 'player',
                      audience: { recipients: 'self' }
                    }
                  });
                else
                  runtime.combat.reviseBuffExpiry(
                    'engineer-focused',
                    () => true,
                    () => runtime.time
                  );
              }
            }
          };
        }
      }
    );
    assert.deepEqual(result.warnings, []);
    const followup = result.resolvedEvents.filter((event) => event.sourceId === ID.FOCUSED_DEVASTATION);
    assert.equal(followup.length > 0, focused && !cancelled && !removeTask);
  }
});

// Missed custom packets retain their cast's target eligibility through delayed dispatch.
test('off-target spear casts grant no Focused window, charges, damage, or conditions', () => {
  const result = runEngineer(
    [
      { type: 'cast', skillId: ID.CONDUIT_SURGE, offTarget: true },
      { type: 'cast', skillId: ID.LIGHTNING_ROD, offTarget: true },
      { type: 'wait', durationMs: 4500 },
      { type: 'cast', skillId: ID.ELECTRIC_ARTILLERY, offTarget: true },
      { type: 'wait', durationMs: 1000 }
    ],
    { primaryWeapon: 'Spear' }
  );
  assert.deepEqual(result.warnings, []);
  assert.equal(observedRuntime(result).buffs.has('engineer-focused'), false);
  assert.deepEqual(observedRuntime(result).profession.core.lightningRodChargeExpiries, []);
  assert.equal(
    result.resolvedEvents.some((event) => event.type === 'damage' || event.type === 'condition'),
    false
  );
});

// Charge expiry is half-open, and a stale pulse cannot extend another activation's resource window.
test('Lightning Rod replacement retires old pulses and each charge expires after twelve seconds', () => {
  const result = runEngineer(
    [{ type: 'wait', durationMs: 700 }],
    {},
    {
      initialize(runtime) {
        const cast = {
          id: 'first',
          command: {},
          skill: engineerCatalog.skillsById.get(ID.LIGHTNING_ROD),
          start: 0,
          fullEnd: 0,
          effectiveEnd: 0
        };
        applySkillSideEffects(runtime, cast, 'castCommit', engineerSpearSideEffectHandlers);
        runtime.schedule('test.replace-rod', 0.2, cast);
      },
      extend(native) {
        return {
          tasks: {
            ...native.tasks,
            'test.replace-rod'(runtime, cast) {
              applySkillSideEffects(
                runtime,
                {
                  ...cast,
                  id: 'second',
                  start: runtime.time,
                  fullEnd: runtime.time,
                  effectiveEnd: runtime.time
                },
                'castCommit',
                engineerSpearSideEffectHandlers
              );
            }
          }
        };
      }
    }
  );
  const pulses = result.events.filter((event) => event.type === 'engineer.lightning-rod-pulse');
  assert.deepEqual(
    pulses.map((event) => event.activationId),
    ['first', 'second']
  );
  const expiries = observedRuntime(result).profession.core.lightningRodChargeExpiries;
  assert.equal(expiries.length, 1);
  assert.equal(expiries[0], pulses[1].at + 12);
  assert.equal(activeStackCount(expiries, expiries[0] - 0.001), 1);
  assert.equal(activeStackCount(expiries, expiries[0]), 0);
});

// An unused flip disappears at its deadline, including its palette flag and stored charges.
test('Electric Artillery availability ends eight seconds after arming', () => {
  const charging = simulate('Core', ['Lightning Rod']);
  const deadline = charging.planningState.profession.availableFlips[ID.ELECTRIC_ARTILLERY].expiresAt;
  const waitMs = deadline * 1000 - charging.steps[0].end;
  const before = simulate('Core', ['Lightning Rod', { type: 'wait', durationMs: waitMs - 40 }]);
  const expired = simulate('Core', ['Lightning Rod', { type: 'wait', durationMs: waitMs }, 'Electric Artillery']);
  assert.equal(
    skillFlipReady(before.planningState.profession.availableFlips[ID.ELECTRIC_ARTILLERY], before.rotationEndTime),
    true
  );
  assert.equal(before.planningState.profession.availableFlips[ID.ELECTRIC_ARTILLERY].expiresAt, deadline);
  assert.equal(
    skillFlipReady(expired.planningState.profession.availableFlips[ID.ELECTRIC_ARTILLERY], expired.rotationEndTime),
    false
  );
  assert.equal(expired.planningState.profession.availableFlips[ID.ELECTRIC_ARTILLERY], undefined);
  assert.deepEqual(expired.planningState.profession.lightningRodChargeExpiries, []);
  assert.equal(expired.warnings.length, 1);
  assert.match(expired.warnings[0], /Lightning Rod has not finished charging/);
});

// Consuming a projectile is separate from landing it, and later actions may run during its flight.
test('Artillery damage and conditions wait for impact without delaying the next cast', () => {
  const rotation = ['Lightning Rod', 'Electric Artillery'];
  const released = simulate('Core', rotation, {}, { kind: 'rotation' });
  assert.deepEqual(released.warnings, []);
  assert.equal(
    artilleryEvents(released).some((event) => ['damage', 'condition'].includes(event.type)),
    false
  );
  assert.equal(
    skillFlipReady(released.planningState.profession.availableFlips[ID.ELECTRIC_ARTILLERY], released.rotationEndTime),
    false
  );
  assert.deepEqual(released.planningState.profession.lightningRodChargeExpiries, []);

  const landed = simulate('Core', [...rotation, 'Conduit Surge', { type: 'wait', durationMs: 1000 }]);
  assert.deepEqual(landed.warnings, []);
  const cast = landed.steps.find((step) => step.skillId === ID.ELECTRIC_ARTILLERY);
  const conduit = landed.steps.find((step) => step.skillId === ID.CONDUIT_SURGE);
  const impact = landed.events.find((event) => event.type === 'engineer.electric-artillery');
  assert.equal(conduit.start, cast.end);
  assert.ok(Math.abs(impact.at - cast.end / 1000 - 0.6) < 1e-9);
  const packets = artilleryEvents(landed).filter((event) => ['damage', 'condition'].includes(event.type));
  assert.ok(packets.length > 0);
  assert.ok(packets.every((event) => event.at === impact.at));
  // Conduit Surge establishes Focused during flight, so Artillery resolves the Focused branch.
  assert.equal(packets.find((event) => event.type === 'damage').coefficient, 1.5);
  assert.equal(
    packets.filter((event) => event.condition === 'Vulnerability').reduce((sum, event) => sum + event.stacks, 0),
    8
  );

  const lostFocus = simulate(
    'Core',
    ['Conduit Surge', 'Lightning Rod', { type: 'wait', durationMs: 8600 }, 'Electric Artillery'],
    {},
    { kind: 'tail', durationMs: 1000 }
  );
  const unfocusedHit = artilleryEvents(lostFocus).find((event) => event.type === 'damage');
  const lateCast = lostFocus.steps.find((step) => step.skillId === ID.ELECTRIC_ARTILLERY);
  assert.ok(lateCast.end < lostFocus.steps[0].end + 10000);
  assert.ok(unfocusedHit.at > lostFocus.steps[0].end / 1000 + 10);
  assert.equal(unfocusedHit.coefficient, 1);
});

// Charges are snapshotted at release, including a charge that naturally expires before impact.
test('Artillery snapshots release charges and preserves the armed sequence on cancellation', () => {
  const initialize = (runtime) => {
    runtime.profession.core.lightningRodChargeExpiries = [0, 0.1, 100];
    armSkillFlip(runtime.profession.core.availableFlips, ID.ELECTRIC_ARTILLERY, 0);
  };

  const cancelled = runEngineer([{ skillId: ID.ELECTRIC_ARTILLERY, interruptMs: 0 }], {}, { initialize });
  assert.deepEqual(observedRuntime(cancelled).profession.core.lightningRodChargeExpiries, [0, 0.1, 100]);
  assert.equal(
    cancelled.events.some((event) => event.type === 'engineer.electric-artillery'),
    false
  );
  const released = runEngineer([ID.ELECTRIC_ARTILLERY, { type: 'wait', durationMs: 700 }], {}, { initialize });
  const projectile = released.events.find((event) => event.type === 'engineer.electric-artillery');
  assert.equal(projectile.charges, 1);
  assert.deepEqual(observedRuntime(released).profession.core.lightningRodChargeExpiries, []);
  assert.equal(observedRuntime(released).profession.core.availableFlips[ID.ELECTRIC_ARTILLERY], undefined);
});
