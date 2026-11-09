import assert from 'node:assert/strict';
import test from 'node:test';

import { gw2CooldownReadyAt } from '#gw2/platform/combat/action-tick.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { guardianVirtueReadyAt } from '#gw2/professions/guardian/virtue-readiness.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { wait } from '#tests/helpers/commands.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';

// Queries observe controller mutations immediately and use the active specialization's virtue identities.
for (const [specialization, ids] of [
  ['Core', [ID.JUSTICE, ID.RESOLVE, ID.COURAGE]],
  ['Dragonhunter', [ID.SPEAR_OF_JUSTICE, ID.WINGS_OF_RESOLVE, ID.SHIELD_OF_COURAGE]],
  ['Willbender', [ID.RUSHING_JUSTICE, ID.FLOWING_RESOLVE, ID.CRASHING_COURAGE]],
  ['Luminary', [ID.RADIANT_JUSTICE, ID.RADIANT_RESOLVE, ID.RADIANT_COURAGE]]
]) {
  test(`${specialization} readiness reads recharge edits and resets on the action tick`, () => {
    const result = runGuardian(
      [wait(100)],
      { specialization },
      {
        timeline: [
          {
            at: 0.01,
            run(runtime) {
              const context = runtime.mechanics;
              for (const [index, virtue] of ['justice', 'resolve', 'courage'].entries()) {
                const id = ids[index];
                const skill = context.helpers.skillsById.get(id);

                // Ammo availability is exercised separately through its pool and use lockout.
                if (skill.ammo) continue;

                runtime.cooldownController.setReadyAt(id, 2.001);
                assert.equal(guardianVirtueReadyAt(context, virtue), 2.04);
                runtime.cooldownController.reduceSkillRecharge(skill, 0.5, runtime.time);
                const reduced = guardianVirtueReadyAt(context, virtue);
                assert.ok(reduced < 2.04);
                assert.equal(reduced, gw2CooldownReadyAt(runtime.cooldownController.readyAt(id)));
                runtime.cooldownController.clear(id);
                assert.equal(guardianVirtueReadyAt(context, virtue), 0);
              }
            }
          }
        ]
      }
    );
    assert.deepEqual(result.warnings, []);
  });
}

// Resolve can become available with one remaining charge while the spent charge is still recovering.
test('Willbender readiness distinguishes use lockout, remaining ammo, and exhausted ammo', () => {
  const result = runGuardian(
    [wait(1200)],
    { specialization: 'Willbender' },
    {
      timeline: [
        {
          at: 0.1,
          run(runtime) {
            const skill = runtime.mechanics.helpers.skillsById.get(ID.FLOWING_RESOLVE);
            runtime.cooldownController.spendAmmo(skill, runtime.time);
            runtime.cooldownController.setAmmoLockout(skill, 0.5, runtime.time);
            assert.equal(runtime.cooldownController.readAmmo(ID.FLOWING_RESOLVE).charges, 1);
            assert.ok(guardianVirtueReadyAt(runtime.mechanics, 'resolve') > runtime.time);
          }
        },
        {
          at: 1,
          run(runtime) {
            const context = runtime.mechanics;
            const controller = runtime.cooldownController;
            const skill = context.helpers.skillsById.get(ID.FLOWING_RESOLVE);
            assert.ok(controller.readAmmo(skill.id).nextRechargeAt > runtime.time);
            assert.ok(guardianVirtueReadyAt(context, 'resolve') <= runtime.time);
            controller.spendAmmo(skill, runtime.time);
            assert.equal(controller.readAmmo(skill.id).charges, 0);
            assert.ok(guardianVirtueReadyAt(context, 'resolve') > runtime.time);
            controller.restoreAmmo(skill, 1, runtime.time);
            assert.ok(guardianVirtueReadyAt(context, 'resolve') <= runtime.time);
          }
        }
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
});

// A skill reset cannot end Firebrand dormancy; Renewed Focus explicitly resets that independent timer.
test('Firebrand dormancy survives a skill cooldown reset and ends on Renewed Focus completion', () => {
  let dormantUntil;
  const result = runGuardian(
    [ID.TOME_OF_JUSTICE, ID.STOW_TOME, wait(1000), ID.RENEWED_FOCUS],
    { specialization: 'Firebrand' },
    {
      timeline: [
        {
          at: 0.5,
          run(runtime) {
            dormantUntil = guardianVirtueReadyAt(runtime.mechanics, 'justice');
            assert.ok(dormantUntil > runtime.time);
            runtime.cooldownController.setReadyAt(ID.TOME_OF_JUSTICE, 100);
            assert.equal(guardianVirtueReadyAt(runtime.mechanics, 'justice'), dormantUntil);
            runtime.cooldownController.clear(ID.TOME_OF_JUSTICE);
            assert.equal(guardianVirtueReadyAt(runtime.mechanics, 'justice'), dormantUntil);
          }
        }
      ]
    }
  );
  assert.deepEqual(result.warnings, []);
  const focus = result.events.find((event) => event.type === 'action' && event.skillId === ID.RENEWED_FOCUS);
  assert.ok(focus.endsAt < dormantUntil);
  assert.equal(result.planningState.profession[STATE.VIRTUE_READY_AT].justice, focus.endsAt);
});
