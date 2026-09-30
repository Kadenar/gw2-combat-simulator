import assert from 'node:assert/strict';
import test from 'node:test';
import { runRanger } from '#tests/helpers/ranger-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { RANGER_SKILL_IDS as ID } from '#gw2/professions/ranger/data/ids.js';

const wait = (durationMs) => ({ type: 'wait', durationMs });
const onTick = (seconds) =>
  assert.ok(Math.abs(seconds * 25 - Math.round(seconds * 25)) < 1e-8, `${seconds} is off tick`);

// Non-aligned input and fractional action-rate scaling must still produce action-tick scheduler boundaries.
test('pet scheduling quantizes commands, autonomous work, and effects to 40 ms across species', () => {
  for (const [selectedPet, skillId] of [
    ['Tiger', ID.FURIOUS_POUNCE],
    ['Carrion Devourer', ID.POISONOUS_CLOUD],
    ['Fanged Iboga', ID.NARCOTIC_SPORES_PET],
    ['Jacaranda', ID.JACARANDAS_EMBRACE],
    ['Lynx', ID.RENDING_POUNCE]
  ]) {
    for (const grantQuickness of [false, true]) {
      const result = runRanger(
        ['__combat_start', wait(101), skillId, wait(9000)],
        { selectedPet },
        {
          initialize(runtime) {
            if (!grantQuickness) return;
            runtime.emit({
              type: 'buff',
              source: 'test',
              sourceId: 'pet-timing',
              actorType: 'effect',
              kind: 'quickness',
              at: 0,
              duration: 5,
              stacks: 1,
              audience: { recipients: 'summons', affectsSelf: false, maximumRecipients: 1 }
            });
          }
        }
      );
      assert.deepEqual(result.warnings, []);
      const events = result.events.filter((event) => event.source === 'ranger-pet');
      assert.ok(events.some((event) => event.type === 'action' && event.skillId === skillId));
      for (const event of events) {
        onTick(event.at);
        if (event.type === 'action') {
          onTick(event.endsAt);
          onTick(event.fullEndsAt);
        }
      }

      const state = observedRuntime(result).profession.core;
      onTick(state.petAutoBusyUntil);
      onTick(state.petAutoNextAt);
      for (const at of Object.values(state.petAutoCooldowns)) onTick(at);
      const actions = events.filter((event) => event.type === 'action');
      for (let index = 1; index < actions.length; index++)
        assert.ok(actions[index].at + 1e-9 >= actions[index - 1].endsAt, `${selectedPet} overlapped its own cast`);
    }
  }
});

// A minimal Maul verifies packet ownership and ordering without depending on a saved rotation.
test('Maul applies two bleeding stacks alongside each of its strikes', () => {
  const result = runRanger([ID.FELINE_MAUL, wait(2000)], {
    specialization: 'Untamed',
    selectedPet: 'Tiger',
    initialUntamedState: 'Ranger'
  });
  assert.deepEqual(result.warnings, []);
  const hits = result.events.filter((event) => event.skillId === ID.FELINE_MAUL && event.type === 'damage');
  const bleeds = result.events.filter(
    (event) => event.skillId === ID.FELINE_MAUL && event.type === 'condition' && event.condition === 'Bleeding'
  );
  assert.equal(hits.length, 2);
  assert.equal(bleeds.length, 2);
  assert.ok(hits[1].at > hits[0].at);
  for (const [index, bleed] of bleeds.entries()) {
    assert.equal(bleed.stacks, 2);
    assert.equal(bleed.at, hits[index].at);
    assert.equal(bleed.activationId, hits[index].activationId);
    assert.ok(bleed.eventOrder > hits[index].eventOrder);
  }
});

// Delayed commands must finish their own animation before the autonomous lane resumes.
test('queued pet commands retain exclusive ownership of the pet lane', () => {
  const result = runRanger(['__combat_start', wait(101), ID.FURIOUS_POUNCE, ID.FELINE_MAUL, wait(7000)], {
    specialization: 'Untamed',
    selectedPet: 'Tiger',
    initialUntamedState: 'Ranger'
  });
  assert.deepEqual(result.warnings, []);
  const actions = result.events.filter((event) => event.type === 'action' && event.source === 'ranger-pet');
  assert.ok(actions.some((event) => event.skillId === ID.FURIOUS_POUNCE));
  assert.ok(actions.some((event) => event.skillId === ID.FELINE_MAUL));
  for (let index = 1; index < actions.length; index++) assert.ok(actions[index].at + 1e-9 >= actions[index - 1].endsAt);
});
