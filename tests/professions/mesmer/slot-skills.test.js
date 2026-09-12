import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';

// Slot skills retain cooldown, resource, and channel behavior across Mesmer specializations.
// Mimic's cooldown reset must also clear an ammo utility's independently tracked cast lockout.
test('Mimic clears the cast lockout on an ammo utility', () => {
  const result = simulateMesmer(
    ['Mimic', 'Tale of the Honorable Rogue', 'Tale of the Honorable Rogue'],
    defaultSimulationConfig({ specialization: 'Troubadour', selectedTraitIds: [] })
  );
  const casts = result.steps.filter((step) => step.skill === 'Tale of the Honorable Rogue');
  assert.equal(casts.length, 2);
  assert.equal(casts[1].start, casts[0].start);
  assert.deepEqual(result.warnings, []);
});

test('Signet of the Ether resets every phantasm skill cooldown', () => {
  const result = simulateMesmer(
    ['Phantasmal Duelist', 'Phantasmal Warlock', 'Signet of the Ether', 'Phantasmal Duelist', 'Phantasmal Warlock'],
    defaultSimulationConfig({
      specialization: 'Core',
      initialResource: 0
    })
  );

  assert.equal(result.steps.length, 5);
  assert.ok(Math.abs(result.steps[3].start - result.steps[2].end) <= 1);
  assert.ok(Math.abs(result.steps[4].start - result.steps[3].end) <= 1);
});

test('Signet of the Ether re-locks 300ms after its cast completes', () => {
  const result = simulateMesmer(
    ['Signet of the Ether', { name: '__wait', waitMs: 500 }],
    defaultSimulationConfig({
      specialization: 'Core',
      boons: {
        ...defaultSimulationConfig().boons,
        alacrity: false,
        quickness: false
      }
    })
  );
  const cast = result.steps[0];
  const cooldown = result.endState.cooldowns['Signet of the Ether'];

  assert.equal(cooldown.readyAt - cast.end, 30300);
});

test('Signet of Illusions passively generates one resource every ten combat seconds', () => {
  const passiveEvents = (specialization) =>
    simulateMesmer(
      [{ name: '__wait', waitMs: 20001 }],
      defaultSimulationConfig({
        specialization,
        selectedSkills: ['Signet of Illusions'],
        initialResource: 0
      })
    ).events.filter((event) => event.type === 'resource' && event.reason === 'Signet of Illusions');

  assert.deepEqual(
    passiveEvents('Core').map((event) => [event.at, event.resource]),
    [
      [10, 'clones'],
      [20, 'clones']
    ]
  );
  assert.deepEqual(
    passiveEvents('Virtuoso').map((event) => [event.at, event.resource]),
    [
      [10, 'blades'],
      [20, 'blades']
    ]
  );
  assert.equal(
    simulateMesmer(
      [{ name: '__wait', waitMs: 20001 }],
      defaultSimulationConfig({
        specialization: 'Core',
        selectedSkills: [],
        initialResource: 0
      })
    ).events.some((event) => event.reason === 'Signet of Illusions'),
    false
  );
});

test('Signet of Illusions starts its passive cycle at combat start', () => {
  const result = simulateMesmer(
    [{ name: '__wait', waitMs: 5000 }, '__combat_start', { name: '__wait', waitMs: 10001 }],
    defaultSimulationConfig({
      specialization: 'Core',
      selectedSkills: ['Signet of Illusions'],
      initialResource: 0
    })
  );
  const passiveEvents = result.events.filter(
    (event) => event.type === 'resource' && event.reason === 'Signet of Illusions'
  );

  assert.deepEqual(
    passiveEvents.map((event) => event.at),
    [15]
  );
});

test('Signet of Illusions restarts its ten-second cycle after recharge', () => {
  const result = simulateMesmer(
    ['Signet of Illusions', { name: '__wait', waitMs: 70001 }],
    defaultSimulationConfig({
      specialization: 'Core',
      selectedSkills: ['Signet of Illusions'],
      initialResource: 0,
      boons: {
        quickness: false,
        alacrity: false
      }
    })
  );
  const passiveEvents = result.events.filter(
    (event) => event.type === 'resource' && event.reason === 'Signet of Illusions'
  );

  assert.deepEqual(
    passiveEvents.map((event) => event.at),
    [71.68]
  );
});

test('Signet of Illusions does not recharge Continuum Split or Crescendo', () => {
  const chronomancer = simulateMesmer(
    ['Continuum Split', { name: '__wait', waitMs: 2000 }, 'Split Second', 'Signet of Illusions'],
    defaultSimulationConfig({
      specialization: 'Chronomancer',
      selectedSkills: ['Signet of Illusions'],
      initialResource: 0
    })
  );

  assert.ok(chronomancer.endState.cooldowns['Continuum Split']);
  assert.equal(chronomancer.endState.cooldowns['Split Second'], undefined);

  const troubadour = simulateMesmer(
    ['Lively Lute', 'Crescendo', 'Signet of Illusions'],
    defaultSimulationConfig({
      specialization: 'Troubadour',
      selectedSkills: ['Signet of Illusions'],
      initialResource: 1
    })
  );

  assert.ok(troubadour.endState.cooldowns.Crescendo);
  assert.equal(troubadour.endState.cooldowns['Lively Lute'], undefined);
});

test('Signet of the Ether does not generate a clone', () => {
  const result = simulateMesmer(
    ['Signet of the Ether'],
    defaultSimulationConfig({
      specialization: 'Core',
      initialResource: 0
    })
  );

  assert.equal(result.endState.profession.resource, 0);
  assert.equal(
    result.events.some((event) => event.type === 'resource' && event.reason === 'Signet of the Ether'),
    false
  );
});

test('shift-queued Mirror Images after an instant action still grants clones', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Sword'
  });
  const result = simulateMesmer(['Feedback', { name: 'Mirror Images', offset: 100 }], config);

  assert.equal(result.endState.time, 100);
  assert.equal(result.endState.profession.resource, 2);
});

test('shift-queued Mirror Images after a resource-generating cast grants both clones', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Dagger',
    secondaryWeapon: 'Sword'
  });
  const result = simulateMesmer(['Bladecall', { name: 'Mirror Images', offset: 100 }], config);
  const mirrorImagesResource = result.events.find(
    (event) => event.type === 'resource' && event.reason === 'Mirror Images'
  );

  assert.equal(mirrorImagesResource?.amount, 2);
  assert.equal(result.endState.profession.resource, 3);
});

test('clones from shift-queued Mirror Images are available to the next shatter', () => {
  const config = defaultSimulationConfig({
    specialization: 'Core',
    initialResource: 0,
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Sword'
  });
  const result = simulateMesmer(['Feedback', { name: 'Mirror Images', offset: 100 }, 'Mind Wrack'], config);

  assert.equal(result.steps.length, 3);
  assert.equal(result.steps[2].start, 100);
  assert.equal(result.endState.profession.resource, 0);
});

test('Power Spike opens with two charges and reverts to Mantra of Pain when spent', () => {
  const result = simulateMesmer(
    ['Power Spike', 'Power Spike', 'Power Spike'],
    defaultSimulationConfig({ specialization: 'Core' })
  );

  // The third cast has no charges left, so the flip reverts to its parent.
  assert.deepEqual(
    result.steps.filter((step) => !step.invalid).map((step) => step.skill),
    ['Power Spike', 'Power Spike']
  );
  assert.equal(result.steps[0].start, 0);
  assert.equal(result.steps[1].start, 0);
  assert.equal(result.endState.profession.availableFlips['Power Spike'], undefined);
  assert.equal(result.endState.ammo['Power Spike'], undefined);
  assert.equal(result.endState.ammoBySkillId[ID.POWER_SPIKE], undefined);
  assert.match(result.warnings.at(-1), /Mantra of Pain is not active/);
});

test('Re-channeling Mantra of Pain refills Power Spike to two charges', () => {
  const result = simulateMesmer(
    ['Power Spike', 'Power Spike', 'Mantra of Pain', 'Power Spike'],
    defaultSimulationConfig({ specialization: 'Core' })
  );

  assert.deepEqual(
    result.steps.map((step) => step.skill),
    ['Power Spike', 'Power Spike', 'Mantra of Pain', 'Power Spike']
  );
  assert.ok(result.endState.profession.availableFlips['Power Spike']);
  assert.equal(result.endState.profession.availableFlips['Power Spike'].persistent, true);
  assert.deepEqual(
    {
      charges: result.endState.ammo['Power Spike'].charges,
      maximum: result.endState.ammo['Power Spike'].maximum
    },
    { charges: 1, maximum: 2 }
  );
});

test('Power Spike records its strike damage', () => {
  const result = simulateMesmer(['Power Spike'], defaultSimulationConfig({ specialization: 'Core' }));

  assert.ok(result.breakdown.some((entry) => entry.sourceSkill === 'Power Spike' && entry.strikeDamage > 0));
});

test('Power Spike woven into the Mantra of Pain channel is invalid and unsimulated', () => {
  const result = simulateMesmer(
    ['Power Spike', 'Power Spike', 'Mantra of Pain', { name: 'Power Spike', offset: 100 }],
    defaultSimulationConfig({ specialization: 'Core' })
  );
  const woven = result.steps.find((step) => step.ri === 3);

  assert.equal(woven.invalid, true);
  // Only the two opener spikes are simulated; the woven one is skipped, so the
  // refilled mantra keeps both charges.
  assert.equal(result.steps.filter((step) => step.skill === 'Power Spike' && !step.invalid).length, 2);
  assert.equal(result.endState.profession.availableFlips['Power Spike'].persistent, true);
  assert.equal(result.endState.ammo['Power Spike'].charges, 2);
  assert.match(result.warnings.at(-1), /Mantra of Pain is still channeling/);
});

test('Power Spike stays invalid even when another instant is chained into the channel first', () => {
  // Weaving an instant (Feedback) into the channel and then Power Spike after it
  // must still be caught: the flip is not armed until the channel completes,
  // regardless of the immediately preceding command.
  const result = simulateMesmer(
    [
      'Power Spike',
      'Power Spike',
      'Mantra of Pain',
      { name: 'Feedback', offset: 100 },
      { name: 'Power Spike', offset: 100 }
    ],
    defaultSimulationConfig({ specialization: 'Core' })
  );
  const woven = result.steps.find((step) => step.ri === 4);

  assert.equal(woven.invalid, true);
  assert.equal(result.steps.filter((step) => step.skill === 'Power Spike' && !step.invalid).length, 2);
  assert.equal(result.endState.ammo['Power Spike'].charges, 2);
});
