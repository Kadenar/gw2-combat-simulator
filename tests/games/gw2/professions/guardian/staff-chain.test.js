// Staff autos use shared chain state so ordering and resets never depend on timed flip windows.
import assert from 'node:assert/strict';
import test from 'node:test';

import { isAutoattackSkill } from '#gw2/platform/skills/autoattack-chain-index.js';
import { GUARDIAN_SKILL_IDS as ID } from '#gw2/professions/guardian/data/ids.js';
import { guardianCatalog } from '#gw2/professions/guardian/profession.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

const config = { primaryWeapon: 'Staff' };
const chain = [ID.BOLT_OF_WRATH, ID.SEARING_LIGHT, ID.SEEKING_JUDGMENT];

test('staff catalog declares an autoattack chain without flip relationships', () => {
  assert.ok(guardianCatalog.autoattackChains.some((ids) => ids.join(',') === chain.join(',')));
  for (const id of chain) {
    const skill = guardianCatalog.skillsById.get(id);
    assert.equal(skill.autoattack, true);
    assert.equal(isAutoattackSkill(skill), true);
    assert.equal(skill.flipSkillId, null);
    assert.equal(skill.flipParentId, null);
    assert.equal(skill.flipDuration, undefined);
  }
});

test('staff advances and completes through shared chain state without arming flips', () => {
  for (let length = 1; length <= chain.length; length++) {
    const result = runGuardian(chain.slice(0, length), config);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.rotationApm.actionCount, 0);
    assert.equal(result.rotationApm.apm, 0);
    const core = observedRuntime(result).profession.core;
    assert.equal(core.autoattackChains[ID.BOLT_OF_WRATH], chain[length]);
    assert.deepEqual(core.availableFlips, {});
  }

  const repeated = runGuardian([...chain, ID.BOLT_OF_WRATH], config);
  assert.deepEqual(repeated.warnings, []);
  assert.equal(observedRuntime(repeated).profession.core.autoattackChains[ID.BOLT_OF_WRATH], ID.SEARING_LIGHT);
});

test('staff rejects skipped steps and restarting an unfinished chain', () => {
  for (const rotation of [
    [ID.SEARING_LIGHT],
    [ID.SEEKING_JUDGMENT],
    [ID.BOLT_OF_WRATH, ID.SEEKING_JUDGMENT],
    [ID.BOLT_OF_WRATH, ID.BOLT_OF_WRATH]
  ]) {
    const result = runGuardian(rotation, config);
    assert.equal(result.steps.at(-1).invalid, true);
    assert.match(result.warnings.at(-1).message, /cast .* first/);
  }
});

test('staff chain survives waiting and resets after another damaging cast', () => {
  const delayed = runGuardian([ID.BOLT_OF_WRATH, { type: 'wait', durationMs: 2000 }, ID.SEARING_LIGHT], config);
  assert.deepEqual(delayed.warnings, []);
  assert.equal(observedRuntime(delayed).profession.core.autoattackChains[ID.BOLT_OF_WRATH], ID.SEEKING_JUDGMENT);

  const reset = runGuardian([ID.BOLT_OF_WRATH, ID.HOLY_STRIKE], config);
  assert.deepEqual(reset.warnings, []);
  assert.equal(observedRuntime(reset).profession.core.autoattackChains[ID.BOLT_OF_WRATH], undefined);
  const restarted = runGuardian([ID.BOLT_OF_WRATH, ID.HOLY_STRIKE, ID.BOLT_OF_WRATH], config);
  assert.deepEqual(restarted.warnings, []);
  assert.equal(observedRuntime(restarted).profession.core.autoattackChains[ID.BOLT_OF_WRATH], ID.SEARING_LIGHT);
});
