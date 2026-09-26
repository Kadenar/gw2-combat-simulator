import assert from 'node:assert/strict';
import test from 'node:test';
import { guardianCatalog, guardianProfession } from '#gw2/professions/guardian/profession.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { guardianUiSkillIdsByName } from '#gw2/professions/guardian/core/presentation.js';
import { projectGuardianPlanningState } from '#gw2/professions/guardian/family-state.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });

// Actual parent completions arm the lifetime used by eligibility, public projections, and palettes.
test('Guardian weapon flips share exact deadlines across availability, snapshots, palette, and cleanup', () => {
  for (const [id, duration, selectedTraitIds, primaryWeapon, secondaryWeapon] of [
    [ID.BINDING_BLADE, 10, [], 'Greatsword', ''],
    [ID.SHIELD_OF_ABSORPTION, 4, [], 'Sword', 'Shield'],
    [ID.ZEALOTS_FLAME, 3, [], 'Sword', 'Torch'],
    [ID.ZEALOTS_FLAME, 4.5, [TRAIT.RADIANT_FIRE], 'Sword', 'Torch']
  ]) {
    const config = { selectedTraitIds, primaryWeapon, secondaryWeapon };
    const result = runGuardian([id], config);
    assert.deepEqual(result.warnings, []);
    const runtime = observedRuntime(result);
    const native = guardianProfession.runtimeFor(config);
    const parent = guardianCatalog.skillsById.get(id);
    const flip = guardianCatalog.skillsById.get(parent.flipSkillId);
    const window = runtime.profession.core.availableFlips[flip.id];
    const end = result.events.find((event) => event.type === 'action').endsAt;
    assert.equal(window.expiresAt, end + duration);
    for (const at of [window.expiresAt - 0.000001, window.expiresAt, window.expiresAt + 0.000001]) {
      const current = { ...runtime, time: at };
      const active = at < window.expiresAt;
      assert.equal(native.availability(current, flip).ready, active);
      if (id === ID.ZEALOTS_FLAME) assert.equal(native.availability(current, parent).ready, !active);
      const projected = projectGuardianPlanningState({ profession: runtime.profession, time: at });
      assert.equal(Object.hasOwn(projected.availableFlips, flip.id), active);
      assert.equal(
        guardianUiSkillIdsByName(guardianCatalog, [parent.name], {
          professionState: projected,
          atSeconds: at
        }).includes(flip.id),
        active
      );
      assert.equal(runtime.profession.core.availableFlips[flip.id], window);
    }

    const expired = runGuardian([id, wait(duration * 1000)], config);
    assert.equal(observedRuntime(expired).profession.core.availableFlips[flip.id], undefined);
    assert.equal(observedRuntime(expired).cooldowns.get(id), runtime.cooldowns.get(id));
  }
});

test('flip refresh replaces the old expiry and consuming it leaves no reusable window', () => {
  const config = { primaryWeapon: 'Greatsword' };
  const prefix = [ID.BINDING_BLADE, wait(1000), { type: 'cooldown-reset' }, ID.BINDING_BLADE];
  const armed = runGuardian(prefix, config);
  const deadline = armed.planningState.profession.availableFlips[ID.PULL].expiresAt;
  const old = runGuardian([ID.BINDING_BLADE], config).planningState.profession.availableFlips[ID.PULL].expiresAt;
  assert.ok(deadline > old);
  const survives = runGuardian([...prefix, wait((old - armed.rotationEndTime) * 1000)], config);
  assert.equal(survives.planningState.profession.availableFlips[ID.PULL].expiresAt, deadline);
  const consumed = runGuardian([...prefix, ID.PULL], config);
  assert.deepEqual(consumed.warnings, []);
  assert.equal(consumed.planningState.profession.availableFlips[ID.PULL], undefined);
});

test('uncommitted parents and flips preserve prior state while committed atomic cancels arm and consume', () => {
  const config = { primaryWeapon: 'Greatsword' };
  const parent = guardianCatalog.skillsById.get(ID.BINDING_BLADE);
  const initial = runGuardian([ID.BINDING_BLADE], config);
  const deadline = initial.planningState.profession.availableFlips[ID.PULL].expiresAt;
  const preserved = runGuardian(
    [ID.BINDING_BLADE, { type: 'cooldown-reset' }, { skillId: ID.BINDING_BLADE, interruptAfterMs: 1 }],
    config
  );
  assert.equal(preserved.planningState.profession.availableFlips[ID.PULL].expiresAt, deadline);
  const committed = runGuardian(
    [{ skillId: ID.BINDING_BLADE, interruptAfterMs: parent.interruptCommitMs }, ID.PULL],
    config
  );
  assert.deepEqual(committed.warnings, []);
  assert.equal(committed.planningState.profession.availableFlips[ID.PULL], undefined);
});

test('specialization flips use the live parent deadline and forge flips persist until form exit', () => {
  const willbender = runGuardian([ID.FLASH_COMBO], { specialization: 'Willbender' });
  const completed = willbender.events.find((event) => event.type === 'action').endsAt;
  assert.equal(willbender.planningState.profession.availableFlips[ID.REPOSE].expiresAt, completed + 6);
  const dragonhunter = runGuardian([ID.SPEAR_OF_JUSTICE], { specialization: 'Dragonhunter' });
  assert.equal(
    dragonhunter.planningState.profession.availableFlips[ID.HUNTERS_VERDICT].expiresAt,
    dragonhunter.planningState.profession.tetherUntil
  );
  const forge = runGuardian([ID.ENTER_RADIANT_FORGE, wait(19000)], { specialization: 'Luminary' });
  assert.equal(forge.planningState.profession.availableFlips[ID.EXIT_RADIANT_FORGE].expiresAt, null);
  const expired = runGuardian([ID.ENTER_RADIANT_FORGE, wait(20000)], { specialization: 'Luminary' });
  assert.equal(expired.planningState.profession.availableFlips[ID.EXIT_RADIANT_FORGE], undefined);
});

test('Binding Blade expiry hides Pull without removing the final tether damage packet', () => {
  const result = runGuardian([ID.BINDING_BLADE, wait(10000)], { primaryWeapon: 'Greatsword' });
  assert.deepEqual(result.warnings, []);
  const action = result.events.find((event) => event.type === 'action');
  const final = result.resolvedEvents.find(
    (event) => event.name === 'Binding Blade — Tether' && event.at === action.endsAt + 10
  );
  assert.ok(final?.damage > 0);
  assert.equal(result.planningState.profession.availableFlips[ID.PULL], undefined);
});
