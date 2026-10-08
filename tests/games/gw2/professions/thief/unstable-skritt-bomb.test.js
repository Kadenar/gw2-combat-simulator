import assert from 'node:assert/strict';
import test from 'node:test';
import { runThief } from '#tests/helpers/thief-simulation.js';
import { thiefProfession } from '#gw2/professions/thief/profession.js';
import { pilferArtifacts } from '#gw2/professions/thief/specializations/antiquary/mechanics/artifacts.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';

const config = { specialization: 'Antiquary', selectedSkillIds: [ID.SKRITT_SCUFFLE] };
const bombReady = (result) => result.planningState.availability[ID.UNSTABLE_SKRITT_BOMB].ready;

// Bombs belong to Scuffle's held grant, so starting inventory and normal pilfers must never unlock them.
test('Unstable Skritt Bomb is a visible profession mechanic granted only by Scuffle', () => {
  const skill = thiefProfession.catalog.skillsById.get(ID.UNSTABLE_SKRITT_BOMB);
  assert.equal(skill.type, 'Profession');
  assert.equal(skill.slot, 'Profession_2');
  assert.equal(skill.slotSelectable, false);
  assert.notEqual(skill.patchAuthoringExcluded, true);
  assert.ok(
    thiefProfession.ui
      .paletteGroups({ specialization: 'Antiquary' })
      .some((group) => group.id.startsWith('thief-artifacts-') && group.skillIds.includes(skill.id))
  );
  for (const [rotation, overrides] of [
    [[], {}],
    [[], { initialPreSteal: 1 }],
    [[ID.SKRITT_SWIPE], {}]
  ]) {
    const result = runThief(rotation, { ...config, ...overrides });
    assert.deepEqual(result.warnings, []);
    assert.equal(bombReady(result), false);
  }

  const granted = runThief([ID.SKRITT_SCUFFLE], config);
  assert.deepEqual(granted.warnings, []);
  assert.equal(bombReady(granted), true);
});

// Manual activation consumes the same single-use inventory as a regular Scuffle artifact and emits damage plus CC.
test('using the bomb consumes the held Scuffle grant and resolves its strike and control', () => {
  const result = runThief([ID.SKRITT_SCUFFLE, ID.UNSTABLE_SKRITT_BOMB], config);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession.artifactUsesRemaining, 0);
  assert.equal(bombReady(result), false);
  assert.equal(result.planningState.availability[ID.CHAK_SHIELD].ready, false);
  const strike = result.events.find((event) => event.type === 'damage' && event.skillId === ID.UNSTABLE_SKRITT_BOMB);
  assert.equal(strike.coefficient, 3);
  const control = result.events.find((event) => event.type === 'control' && event.skillId === ID.UNSTABLE_SKRITT_BOMB);
  assert.equal(control.controlKind, 'knockback');
  assert.ok(result.resolvedEvents.some((event) => event.skillId === ID.UNSTABLE_SKRITT_BOMB && event.damage > 0));
});

// A later assistant grant replenishes the choice; choosing another artifact spends the bomb's shared use too.
test('Scuffle replenishes a spent bomb while other artifact uses consume its availability', () => {
  const renewed = runThief([ID.SKRITT_SCUFFLE, ID.UNSTABLE_SKRITT_BOMB, { type: 'wait', durationMs: 3000 }], config);
  assert.deepEqual(renewed.warnings, []);
  assert.equal(bombReady(renewed), true);
  const alternative = runThief([ID.SKRITT_SCUFFLE, ID.CHAK_SHIELD], config);
  assert.deepEqual(alternative.warnings, []);
  assert.equal(bombReady(alternative), false);
});

// Replacement must remove Scuffle-only choices, including Card Swap's redraw and initiative-driven pilfers.
test('other pilfer sources and Reshuffle replace the bomb choice', () => {
  for (const [rotation, selectedTraitIds] of [
    [[ID.SKRITT_SCUFFLE, ID.SKRITT_SWIPE], []],
    [[ID.SKRITT_SCUFFLE, ID.RESHUFFLE], [TRAIT.CARD_SWAP]]
  ]) {
    const result = runThief(rotation, { ...config, selectedTraitIds });
    assert.deepEqual(result.warnings, []);
    assert.equal(bombReady(result), false);
  }

  const initiativePilfer = runThief([ID.SKRITT_SCUFFLE, { type: 'wait', durationMs: 1000 }], config, {
    timeline: [{ at: 1, run: (runtime) => pilferArtifacts(runtime.mechanics, 'initiative') }]
  });
  assert.deepEqual(initiativePilfer.warnings, []);
  assert.equal(bombReady(initiativePilfer), false);
});
