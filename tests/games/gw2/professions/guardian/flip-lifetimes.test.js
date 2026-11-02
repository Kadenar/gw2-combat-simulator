import assert from 'node:assert/strict';
import test from 'node:test';

import { guardianUiSkillIds } from '#gw2/professions/guardian/core/presentation.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { guardianCatalog, guardianProfession } from '#gw2/professions/guardian/profession.js';
import { MANTRAS } from '#gw2/professions/guardian/specializations/firebrand/skills/skill-flips.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { wait } from '#tests/helpers/commands.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { observedRuntime, projectObservedState } from '#tests/helpers/observed-runtime.js';

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

      const projected = projectObservedState(guardianProfession, { profession: runtime.profession, time: at });
      assert.equal(Object.hasOwn(projected[STATE.AVAILABLE_FLIPS], flip.id), active);
      assert.equal(
        guardianUiSkillIds(guardianCatalog, [parent.id], {
          professionState: projected,
          atSeconds: at
        }).includes(flip.id),
        active
      );
      assert.equal(runtime.profession.core.availableFlips[flip.id], window);
    }

    const expired = runGuardian([id, wait(duration * 1000)], config);
    assert.equal(observedRuntime(expired).profession.core.availableFlips[flip.id], undefined);
    assert.equal(observedRuntime(expired).cooldownController.readyAt(id), runtime.cooldownController.readyAt(id));
  }
});

test('flip refresh replaces the old expiry and consuming it leaves no reusable window', () => {
  const config = { primaryWeapon: 'Greatsword' };
  const prefix = [ID.BINDING_BLADE, wait(1000), { type: 'cooldown-reset' }, ID.BINDING_BLADE];
  const armed = runGuardian(prefix, config);
  const deadline = armed.planningState.profession[STATE.AVAILABLE_FLIPS][ID.PULL].expiresAt;
  const old = runGuardian([ID.BINDING_BLADE], config).planningState.profession[STATE.AVAILABLE_FLIPS][ID.PULL]
    .expiresAt;
  assert.ok(deadline > old);
  const survives = runGuardian([...prefix, wait((old - armed.rotationEndTime) * 1000)], config);
  assert.equal(survives.planningState.profession[STATE.AVAILABLE_FLIPS][ID.PULL].expiresAt, deadline);
  const consumed = runGuardian([...prefix, ID.PULL], config);
  assert.deepEqual(consumed.warnings, []);
  assert.equal(consumed.planningState.profession[STATE.AVAILABLE_FLIPS][ID.PULL], undefined);
});

test('uncommitted parents and flips preserve prior state while committed atomic cancels arm and consume', () => {
  const config = { primaryWeapon: 'Greatsword' };
  const parent = guardianCatalog.skillsById.get(ID.BINDING_BLADE);
  const initial = runGuardian([ID.BINDING_BLADE], config);
  const deadline = initial.planningState.profession[STATE.AVAILABLE_FLIPS][ID.PULL].expiresAt;
  const preserved = runGuardian(
    [ID.BINDING_BLADE, { type: 'cooldown-reset' }, { skillId: ID.BINDING_BLADE, interruptAfterMs: 1 }],
    config
  );
  assert.equal(preserved.planningState.profession[STATE.AVAILABLE_FLIPS][ID.PULL].expiresAt, deadline);
  const committed = runGuardian(
    [{ skillId: ID.BINDING_BLADE, interruptAfterMs: parent.interruptCommitMs }, ID.PULL],
    config
  );
  assert.deepEqual(committed.warnings, []);
  assert.equal(committed.planningState.profession[STATE.AVAILABLE_FLIPS][ID.PULL], undefined);
});

test('specialization flips use the live parent deadline and forge flips persist until form exit', () => {
  const willbender = runGuardian([ID.FLASH_COMBO], { specialization: 'Willbender' });
  const completed = willbender.events.find((event) => event.type === 'action').endsAt;
  assert.equal(willbender.planningState.profession[STATE.AVAILABLE_FLIPS][ID.REPOSE].expiresAt, completed + 6);
  const dragonhunter = runGuardian([ID.SPEAR_OF_JUSTICE], { specialization: 'Dragonhunter' });
  assert.equal(
    dragonhunter.planningState.profession[STATE.AVAILABLE_FLIPS][ID.HUNTERS_VERDICT].expiresAt,
    dragonhunter.planningState.profession[STATE.TETHER_UNTIL]
  );
  const forge = runGuardian([ID.ENTER_RADIANT_FORGE, wait(19000)], { specialization: 'Luminary' });
  assert.equal(forge.planningState.profession[STATE.AVAILABLE_FLIPS][ID.EXIT_RADIANT_FORGE].expiresAt, null);
  const expired = runGuardian([ID.ENTER_RADIANT_FORGE, wait(20000)], { specialization: 'Luminary' });
  assert.equal(expired.planningState.profession[STATE.AVAILABLE_FLIPS][ID.EXIT_RADIANT_FORGE], undefined);
});

test('Binding Blade expiry hides Pull without removing the final tether damage packet', () => {
  const result = runGuardian([ID.BINDING_BLADE, wait(10000)], { primaryWeapon: 'Greatsword' });
  assert.deepEqual(result.warnings, []);
  const action = result.events.find((event) => event.type === 'action');
  const final = result.resolvedEvents.find(
    (event) => event.name === 'Binding Blade — Tether' && event.at === action.endsAt + 10
  );
  assert.ok(final?.damage > 0);
  assert.equal(result.planningState.profession[STATE.AVAILABLE_FLIPS][ID.PULL], undefined);
});

// Every family retains its prepared pool until spent, then retires and rearms through the same controller.
for (const { rootId, normalId, finalId } of MANTRAS) {
  test(`${guardianCatalog.skillsById.get(rootId).name} shares preparation, final-charge retirement, and rearm`, () => {
    const config = { specialization: 'Firebrand', selectedSkillIds: [rootId] };
    assert.equal(guardianCatalog.skillsById.get(normalId).flipParentId, rootId);
    assert.equal(guardianCatalog.skillsById.get(finalId).flipParentId, normalId);

    const prepared = runGuardian([wait(25000)], config);
    assert.deepEqual(prepared.warnings, []);
    assert.ok(observedRuntime(prepared).profession.core.availableFlips[normalId]);
    assert.equal(prepared.planningState.ammoBySkillId[normalId].charges, 3);
    for (const other of MANTRAS.filter((entry) => entry.rootId !== rootId)) {
      assert.equal(observedRuntime(prepared).profession.core.availableFlips[other.normalId], undefined);
    }

    const normal = runGuardian([normalId], config);
    assert.deepEqual(normal.warnings, []);
    assert.ok(observedRuntime(normal).profession.core.availableFlips[normalId]);
    assert.equal(normal.planningState.ammoBySkillId[normalId].charges, 2);

    const final = runGuardian([normalId, normalId], config);
    assert.deepEqual(final.warnings, []);
    assert.equal(observedRuntime(final).profession.core.availableFlips[normalId], undefined);
    assert.ok(observedRuntime(final).profession.core.availableFlips[finalId]);

    const depleted = runGuardian([normalId, normalId, finalId], config);
    assert.deepEqual(depleted.warnings, []);
    assert.equal(observedRuntime(depleted).profession.core.availableFlips[normalId], undefined);
    assert.equal(observedRuntime(depleted).profession.core.availableFlips[finalId], undefined);
    assert.equal(depleted.planningState.ammoBySkillId[normalId], undefined);
    assert.ok(depleted.planningState.cooldownsBySkillId[rootId].remainingMs > 0);

    const rearmed = runGuardian([normalId, normalId, finalId, normalId], config);
    assert.deepEqual(rearmed.warnings, []);
    assert.equal(rearmed.steps.at(-1).start, depleted.planningState.cooldownsBySkillId[rootId].readyAtMs);
    assert.ok(observedRuntime(rearmed).profession.core.availableFlips[normalId]);
    assert.equal(rearmed.planningState.ammoBySkillId[normalId].charges, 2);
  });
}

// Truth's final charge must reach the same trait trigger as the other mantra families.
test('Voice of Truth refunds Weighty Terms pages only when the final charge is spent', () => {
  const config = {
    specialization: 'Firebrand',
    selectedSkillIds: [ID.MANTRA_OF_TRUTH],
    selectedTraitIds: [TRAIT.WEIGHTY_TERMS],
    initialTomePages: 0
  };
  const normal = runGuardian([ID.ECHO_OF_TRUTH, ID.ECHO_OF_TRUTH], config);
  const final = runGuardian([ID.ECHO_OF_TRUTH, ID.ECHO_OF_TRUTH, ID.VOICE_OF_TRUTH], config);
  assert.deepEqual(normal.warnings, []);
  assert.deepEqual(final.warnings, []);
  assert.equal(normal.planningState.profession[STATE.TOME_PAGES].value, 0);
  assert.equal(final.planningState.profession[STATE.TOME_PAGES].value, 2);
  assert.ok(final.planningState.cooldownsBySkillId[ID.MANTRA_OF_TRUTH].remainingMs > 0);
});
