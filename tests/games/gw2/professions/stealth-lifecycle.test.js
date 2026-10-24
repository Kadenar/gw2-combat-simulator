import { RECIPIENT } from '#gw2/platform/constants.js';
import { stealthActive, revealedActive } from '#gw2/platform/combat/stealth.js';
import { planningBuffAt } from '#gw2/platform/results/result-queries.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { emitStealth } from '#tests/helpers/stealth.js';
import { runThief, thiefHit } from '#tests/helpers/thief-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

const externalSource = { id: 'fixture.external-stealth', name: 'External Stealth' };

// The same admitted packet must drive gameplay and detached observations for both profession owners.
for (const [name, simulate] of [
  ['Thief', runThief],
  ['Ranger', runRanger]
]) {
  test(`${name}: ordinary stealth grants extend to the common cap and expire exclusively`, () => {
    const result = simulate(
      [{ type: 'wait', durationMs: 2000 }],
      {},
      {
        timeline: [
          { at: 0, run: (runtime) => emitStealth(runtime, externalSource, 3) },
          { at: 1, run: (runtime) => emitStealth(runtime, externalSource, 20) }
        ],
        probes: [
          [
            0.5,
            (runtime) => {
              assert.equal(runtime.profession.core.stealthUntil, 3);
              assert.equal(stealthActive(runtime.profession.core, runtime.time), true);
            }
          ]
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    const core = observedRuntime(result).profession.core;
    assert.equal(core.stealthStartedAt, 0);
    assert.equal(core.stealthUntil, 16);
    assert.equal(stealthActive(core, 16), false);
    assert.equal(revealedActive(core, 16), false);
    assert.equal(planningBuffAt(result.planningState, 'stealth').remaining, 14);
  });

  test(`${name}: Revealed rejects self grants until its exclusive expiry`, () => {
    for (const grantAt of [1, 3]) {
      const result = simulate(
        [{ type: 'wait', durationMs: 4000 }],
        {},
        {
          initialize(runtime) {
            runtime.profession.core.revealedUntil = 3;
          },
          timeline: [{ at: grantAt, run: (runtime) => emitStealth(runtime, externalSource, 5) }]
        }
      );
      assert.deepEqual(result.warnings, []);
      const core = observedRuntime(result).profession.core;
      assert.equal(core.stealthUntil, grantAt === 3 ? 8 : 0);
      assert.equal(planningBuffAt(result.planningState, 'stealth')?.remaining ?? 0, grantAt === 3 ? 4 : 0);
    }
  });

  test(`${name}: allied-only stealth cannot grant a player status`, () => {
    const result = simulate(
      [{ type: 'wait', durationMs: 1000 }],
      {},
      {
        timeline: [
          {
            at: 0,
            run: (runtime) =>
              emitStealth(runtime, externalSource, 5, {
                audience: { recipients: RECIPIENT.PARTY, affectsSelf: false }
              })
          }
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    assert.equal(observedRuntime(result).profession.core.stealthUntil, 0);
    assert.equal(planningBuffAt(result.planningState, 'stealth'), null);
  });

  test(`${name}: a later player strike ends stealth in gameplay and observations`, () => {
    const result = simulate(
      [{ type: 'wait', durationMs: 2000 }],
      {},
      {
        timeline: [
          { at: 0, run: (runtime) => emitStealth(runtime, externalSource, 10) },
          { at: 1, run: (runtime) => runtime.effects.emit({ kind: 'packet', event: thiefHit(1) }) }
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    const core = observedRuntime(result).profession.core;
    assert.equal(core.stealthUntil, 1);
    assert.equal(core.revealedUntil, 4);
    assert.equal(planningBuffAt(result.planningState, 'stealth'), null);
  });

  test(`${name}: natural expiry removes the observed status without applying Revealed`, () => {
    const result = simulate(
      [{ type: 'wait', durationMs: 3000 }],
      {},
      {
        timeline: [{ at: 0, run: (runtime) => emitStealth(runtime, externalSource, 3) }]
      }
    );
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    assert.equal(stealthActive(runtime.profession.core, runtime.time), false);
    assert.equal(revealedActive(runtime.profession.core, runtime.time), false);
    assert.equal(planningBuffAt(result.planningState, 'stealth'), null);
  });
}

// A field registered through the resolver exercises actual finisher production and recipient admission.
function smokeField(runtime) {
  runtime.effects.emit({
    kind: 'packet',
    event: {
      type: 'combo_field',
      at: 0,
      expiresAt: 10,
      source: 'Test',
      sourceId: 'test.smoke',
      actorType: 'effect',
      fieldId: 'test.smoke',
      fieldType: 'Smoke',
      ownerId: 'thief',
      ownerActorType: 'player'
    }
  });
}

// A real smoke leap must unlock the follow-up stealth attack, beyond merely reporting a combo buff.
test('Thief: smoke leap stealth enables Backstab through the ordinary packet lifecycle', () => {
  const result = runThief(
    ['Heartseeker', { type: 'wait', durationMs: 100 }, 'Backstab'],
    {},
    {
      initialize: smokeField
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.ok(result.steps.some((step) => step.skill === 'Backstab'));
  assert.equal(stealthActive(observedRuntime(result).profession.core, result.planningState.atSeconds), false);
});

test('Thief: combo protection excludes unrelated concurrent strikes and later hits from its own activation', () => {
  const baseline = runThief(['Heartseeker'], {}, { initialize: smokeField });
  const combo = baseline.events.find((event) => event.kind === 'stealth' && event.comboId);
  assert.ok(stealthActive(observedRuntime(baseline).profession.core, baseline.planningState.atSeconds));
  for (const [priority, delay, sameActivation] of [
    [-10, 0, false],
    [10, 0, false],
    [0, 0.1, true]
  ]) {
    const result = runThief(
      ['Heartseeker', { type: 'wait', durationMs: 500 }],
      {},
      {
        initialize: smokeField,
        timeline: [
          {
            at: combo.at + delay,
            priority,
            run(runtime) {
              runtime.effects.emit({
                kind: 'packet',
                event: thiefHit(runtime.time, {
                  skillId: sameActivation ? ID.HEARTSEEKER : ID.DOUBLE_STRIKE,
                  activationId: sameActivation ? combo.activationId : 'fixture.unrelated'
                })
              });
            }
          }
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    assert.equal(stealthActive(runtime.profession.core, runtime.time), false);
    assert.equal(revealedActive(runtime.profession.core, runtime.time), true);
  }
});

// Unknown external sources still earn entry rewards once; extending their window is not a second entry.
test('Thief: an external source triggers entry traits without catalog membership', () => {
  const simulate = (extend) =>
    runThief(
      [{ type: 'wait', durationMs: 2000 }],
      {
        selectedTraitIds: [TRAIT.LEECHING_VENOMS]
      },
      {
        timeline: [
          { at: 0, run: (runtime) => emitStealth(runtime, externalSource, 3) },
          ...(extend ? [{ at: 1, run: (runtime) => emitStealth(runtime, externalSource, 3) }] : [])
        ]
      }
    );
  const single = simulate(false);
  const result = simulate(true);
  assert.deepEqual(single.warnings, []);
  assert.deepEqual(result.warnings, []);
  // Compare to a real entry so this contract remains independent of the trait's charge tuning.
  const entryCharges = observedRuntime(single).profession.core.venomChargeBatches[ID.SPIDER_VENOM];
  assert.ok(entryCharges?.length > 0);
  const core = observedRuntime(result).profession.core;
  assert.equal(core.stealthUntil, 6);
  assert.deepEqual(core.venomChargeBatches[ID.SPIDER_VENOM], entryCharges);
});
