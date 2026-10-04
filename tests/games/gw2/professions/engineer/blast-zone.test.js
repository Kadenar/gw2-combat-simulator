import assert from 'node:assert/strict';
import test from 'node:test';
import { engineerProfession } from '#gw2/professions/engineer/profession.js';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { ENGINEER_SKILL_IDS as ID, ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';

const simulate = createObservedProfessionSimulator(engineerProfession, {
  selectedTraitIds: [TRAIT.BLAST_ZONE],
  stats: { concentration: 0 },
  target: { armor: 2597, conditions: {} }
});
const fireField = ['Bomb Kit', 'Fire Bomb', { type: 'wait', durationMs: 1000 }];
const blasts = (result) =>
  result.events.filter((event) => event.type === 'combo_finisher' && event.sourceId === TRAIT.BLAST_ZONE);

// Each supported healing toolbelt and F1 replacement produces one player-owned combo at its activation boundary.
test('Blast Zone grants fire-field Might from healing toolbelts and first mech commands', () => {
  for (const [specialization, heal, skill, commandTrait] of [
    ['Core', 'Med Kit', 'Bandage Self'],
    ['Core', 'Healing Turret', 'Regenerating Mist'],
    ['Core', 'A.E.D.', 'Static Shock'],
    ['Scrapper', 'Medic Gyro', 'Reconstruction Field'],
    ['Holosmith', 'Coolant Blast', 'Cauterize'],
    ['Amalgam', 'Mitotic State', 'Symbiotic Shielding'],
    ['Mechanist', 'Rectifier Signet', 'Rolling Smash', TRAIT.MECH_ARMS_SINGLE_EDGE_CUTTERS],
    ['Mechanist', 'Rectifier Signet', 'Explosive Knuckle', TRAIT.MECH_ARMS_HIGH_IMPACT_DRIVERS],
    ['Mechanist', 'Rectifier Signet', 'Spark Revolver', TRAIT.MECH_ARMS_JADE_CANNONS]
  ]) {
    const result = simulate(specialization, [...fireField, skill, { type: 'wait', durationMs: 2000 }], {
      selectedSkillIds: [engineerCatalog.skillsByName.get(heal).id, 5812],
      selectedTraitIds: [TRAIT.BLAST_ZONE, ...(commandTrait ? [commandTrait] : [])]
    });
    assert.deepEqual(result.warnings, [], skill);
    const attempts = blasts(result);
    assert.equal(attempts.length, 1, skill);
    const cast = result.steps.find((step) => step.skill === skill);
    assert.equal(attempts[0].at, (commandTrait ? cast.start : cast.end) / 1000, skill);
    assert.equal(attempts[0].actorType, 'player', skill);
    assert.equal(attempts[0].finisherType, 'Blast', skill);
    const might = result.resolvedEvents.filter(
      (event) => event.type === 'buff' && event.sourceId === TRAIT.BLAST_ZONE && event.kind === 'might'
    );
    assert.deepEqual(
      might.map((event) => [event.stacks, event.duration]),
      [[3, 20]],
      skill
    );
  }
});

// Selection and successful activation gate the finisher; a field gates only the combo reward.
test('Blast Zone excludes heals, other toolbelts, unselected traits, and cancelled casts', () => {
  for (const [specialization, rotation, config] of [
    ['Core', ['Bandage Self'], { selectedTraitIds: [] }],
    ['Core', ['Med Kit', 'Grenade Barrage'], {}],
    ['Core', [{ type: 'cast', skillId: ID.BANDAGE_SELF, interruptAfterMs: 100 }], {}],
    ['Mechanist', ['Discharge Array', 'Jade Mortar'], {}]
  ]) {
    const result = simulate(specialization, rotation, {
      selectedSkillIds: [5802, 5805],
      ...config
    });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(blasts(result), []);
  }

  const noField = simulate('Core', ['Bandage Self'], { selectedSkillIds: [5802] });
  assert.deepEqual(noField.warnings, []);
  assert.equal(blasts(noField).length, 1);
  assert.equal(
    noField.resolvedEvents.some((event) => event.type === 'combo'),
    false
  );
});

// A toolbelt's own field must register before the blast, and accepted combos must reach existing trait consumers once.
test('Blast Zone uses the triggering water field and activates Kinetic Accelerators once', () => {
  const result = simulate('Scrapper', ['Reconstruction Field'], {
    selectedSkillIds: [30357],
    selectedTraitIds: [TRAIT.BLAST_ZONE, TRAIT.KINETIC_ACCELERATORS]
  });
  assert.deepEqual(result.warnings, []);
  const combos = result.resolvedEvents.filter((event) => event.type === 'combo');
  assert.deepEqual(
    combos.map((event) => [event.skillName, event.fieldType]),
    [['Reconstruction Field', 'Water']]
  );
  const quickness = result.resolvedEvents.filter(
    (event) => event.type === 'buff' && event.sourceId === TRAIT.KINETIC_ACCELERATORS && event.kind === 'quickness'
  );
  assert.equal(quickness.length, 1);
});
