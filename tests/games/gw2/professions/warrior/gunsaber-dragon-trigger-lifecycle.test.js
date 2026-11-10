// Exercise joint mode rules through their hook interface and native simulations, including what trait observers see.
import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import {
  dragonSlashCompleted,
  dragonSlashReleased,
  focusReset
} from '#gw2/professions/warrior/core/mechanics/trigger-points.js';
import { WARRIOR_SKILL_IDS as ID, WARRIOR_TRAIT_IDS as TRAIT } from '#gw2/professions/warrior/data/ids.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { gunsaberDragonTriggerLifecycle } from '#gw2/professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.js';
import { cast, wait } from '#tests/helpers/commands.js';
import { observedRuntime, observeGw2Runtime } from '#tests/helpers/observed-runtime.js';

const combat = { type: 'combat-start' };

function run(rotation, { config: overrides = {}, extend = () => ({}) } = {}) {
  const config = {
    specialization: 'Bladesworn',
    primaryWeapon: 'Axe',
    initialResource: 100,
    selectedTraitIds: [],
    attributeInputs: baseAttributeInputs({ power: 2000, precision: 1000 }),
    target: { armor: 2597 },
    ...overrides
  };
  const native = warriorProfession.runtimeFor(config);
  const result = observeGw2Runtime({ profession: { ...native, ...extend(native) }, config, rotation });
  assert.deepEqual(result.warnings, []);
  return result;
}

test('mode readiness preserves denial identity and retries without mutating form state', () => {
  const runtime = observedRuntime(run([]));
  const state = runtime.profession.specialization.state;
  runtime.mechanics.resourceController.replace('flow', 0);
  for (const [gunsaber, charging, id, code, reason] of [
    [false, false, ID.BLOOMING_FIRE, 'warrior.gunsaber', /Unsheathe/],
    [false, false, ID.DRAGON_SLASH_FORCE, 'warrior.dragon-trigger', /Enter Dragon Trigger/],
    [true, true, ID.UNSHEATHE_GUNSABER, 'warrior.gunsaber', /already active/],
    [true, true, ID.CHOP, 'warrior.gunsaber', /standard weapon skills/],
    [true, true, ID.BLOOMING_FIRE, 'warrior.dragon-trigger', /Finish Dragon Trigger/],
    [true, true, ID.DRAGON_TRIGGER, 'warrior.dragon-trigger', /already active/]
  ]) {
    state.gunsaberActive = gunsaber;
    state.dragonTriggerActive = charging;
    const result = gunsaberDragonTriggerLifecycle.availability(
      runtime.mechanics.queries,
      runtime.helpers.skillsById.get(id),
      cast(id)
    );
    assert.equal(result.ready, false);
    assert.equal(result.code, code);
    assert.equal(result.retryAt, null);
    assert.match(result.reason, reason);
    assert.equal(state.gunsaberActive, gunsaber);
    assert.equal(state.dragonTriggerActive, charging);
  }

  state.nextDragonChargeAt = runtime.time + 1;
  state.dragonTriggerChargeDeadline = runtime.time + 2;
  const retry = gunsaberDragonTriggerLifecycle.availability(
    runtime.mechanics.queries,
    runtime.helpers.skillsById.get(ID.DRAGON_SLASH_FORCE),
    { ...cast(ID.DRAGON_SLASH_FORCE), releaseAtCharges: 1 }
  );
  assert.equal(retry.code, 'warrior.dragon-trigger-charging');
  assert.equal(retry.retryAt, state.nextDragonChargeAt);
  assert.equal(state.dragonTriggerActive, true);
});

test('Gunsaber observers see entry before charging and stow after charge cleanup and recharge', () => {
  const observed = [];
  const result = run([combat, cast(ID.DRAGON_TRIGGER), wait(240), cast(ID.SHEATHE_GUNSABER)], {
    extend(native) {
      const triggerListeners = new Map(native.triggerListeners);
      triggerListeners.set(focusReset.id, [
        ...(triggerListeners.get(focusReset.id) ?? []),
        (runtime) => {
          const state = runtime.profession.specialization.state;
          assert.equal(state.dragonTriggerActive, false);
          assert.equal(state.dragonCharges.value, 0);
          assert.equal(state.dragonTriggerEventActivationId, '');

          if (state.gunsaberActive) {
            assert.equal(state.flow.value, 100);
            observed.push('entry');
          } else {
            assert.ok(runtime.cooldownController.readyAt(ID.DRAGON_TRIGGER) > runtime.time);
            observed.push('stow');
          }
        }
      ]);
      return { triggerListeners };
    }
  });
  assert.deepEqual(observed, ['entry', 'stow']);
  assert.equal(observedRuntime(result).profession.specialization.state.gunsaberActive, false);
});

test('Slash completion refunds captured Flow before power observers run after mode exit', () => {
  const observed = [];
  let beforeRefund;
  run([combat, cast(ID.DRAGON_TRIGGER), { ...cast(ID.DRAGON_SLASH_FORCE), releaseAtCharges: 2 }], {
    config: { selectedTraitIds: [TRAIT.BURST_MASTERY, TRAIT.BERSERKERS_POWER] },
    extend(native) {
      const triggerListeners = new Map(native.triggerListeners);
      triggerListeners.set(dragonSlashReleased.id, [
        (runtime) => {
          beforeRefund = runtime.resourceController.value('flow');
          assert.equal(runtime.profession.specialization.state.dragonTriggerActive, false);
          assert.equal(runtime.profession.specialization.state.dragonCharges.value, 0);
          observed.push('refund');
        },
        ...(triggerListeners.get(dragonSlashReleased.id) ?? [])
      ]);
      triggerListeners.set(dragonSlashCompleted.id, [
        (runtime) => {
          assert.ok(runtime.resourceController.value('flow') > beforeRefund);
          observed.push('power');
        },
        ...(triggerListeners.get(dragonSlashCompleted.id) ?? [])
      ]);
      return { triggerListeners };
    }
  });
  assert.deepEqual(observed, ['refund', 'power']);
});

test('non-autoattack Gunsaber commitment resets pending chains even when its damage arrives later', () => {
  for (const cancelled of [false, true]) {
    let beforeCommit;
    const result = run(
      [
        cast(ID.UNSHEATHE_GUNSABER),
        cast(ID.SWIFT_CUT),
        {
          ...cast(ID.BLOOMING_FIRE),
          impactDelayMs: 2000,
          ...(cancelled ? { interruptAfterMs: 1 } : {})
        }
      ],
      {
        extend: (native) => ({
          onCastCommit(runtime, accepted) {
            if (accepted.skill.id === ID.BLOOMING_FIRE) beforeCommit = runtime.autoattackController.read(ID.SWIFT_CUT);

            native.onCastCommit?.(runtime, accepted);
          }
        })
      }
    );

    if (!cancelled) assert.equal(beforeCommit, ID.STEEL_DIVIDE);

    assert.equal(
      observedRuntime(result).autoattackController.read(ID.SWIFT_CUT),
      cancelled ? ID.STEEL_DIVIDE : ID.SWIFT_CUT
    );
  }
});
