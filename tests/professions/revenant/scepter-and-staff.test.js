import assert from 'node:assert/strict';
import { test } from 'node:test';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import { revenantProfession } from '#gw2/professions/revenant/definition.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

const simulate = createProfessionSimulator(revenantProfession, {
  selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
  startingLegend: LEGEND.ASSASSIN,
  initialEnergy: 50,
  primaryWeapon: 'Scepter',
  secondaryWeapon: 'Sword',
  boons: { quickness: true },
  stats: { power: 2000 },
  target: { armor: 2597 }
});
const tail = { kind: 'tail', durationMs: 6000 };
const auraDamage = (result) =>
  result.events.filter((event) => event.type === 'damage' && event.skillId === ID.BLOSSOMING_AURA);

test('Blossoming Aura keeps a fixed fuse after attachment regardless of cast speed', () => {
  // The lasting effect's cadence and cooldown are independent of the initial casting animation.
  for (const quickness of [false, true]) {
    const result = simulate('Core', ['Blossoming Aura'], { boons: { quickness } }, tail);
    const damage = auraDamage(result);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      damage.map((event) => Math.round((event.at - damage[0].at) * 1000)),
      [0, 1000, 2000, 3000, 4000]
    );
    assert.equal(damage.at(-1).coefficient, 2.5);
    assert.equal(result.endState.cooldowns['Blossoming Aura'].readyAt, 8000);
    assert.equal(result.endState.profession.availableFlips[ID.DETONATE_BLOSSOMING_AURA], undefined);
  }
});

test('Manual Aura detonation uses the reached tier and cancels future pulses without restarting cooldown', () => {
  for (let tier = 0; tier < 4; tier += 1) {
    const result = simulate(
      'Core',
      ['Blossoming Aura', { type: 'wait', durationMs: tier * 1000 }, 'Detonate Blossoming Aura'],
      {},
      tail
    );
    const damage = auraDamage(result);
    assert.deepEqual(result.warnings, []);
    assert.equal(damage.filter((event) => event.name === 'Pulsing Damage').length, tier + 1);
    assert.deepEqual(
      damage.filter((event) => event.name === 'Final Damage').map((event) => event.coefficient),
      [1 + tier * 0.5]
    );
    assert.equal(result.endState.cooldowns['Blossoming Aura'].readyAt, 8000);
    assert.equal(result.endState.profession.availableFlips[ID.DETONATE_BLOSSOMING_AURA], undefined);
  }
});

test('Aura stays attached and remains manually detonatable across a legend swap', () => {
  const result = simulate('Core', ['Blossoming Aura', 'Swap Legends', 'Detonate Blossoming Aura'], {}, tail);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    auraDamage(result).map((event) => event.name),
    ['Pulsing Damage', 'Final Damage']
  );
  assert.equal(result.endState.cooldowns['Blossoming Aura'].readyAt, 8000);
});

test('Staff attacks divide their total coefficients per hit and Rejuvenating Assault owns a whirl finisher', () => {
  // Check the damage formula directly, without coupling a saved rotation to a packet snapshot.
  for (const [id, coefficient] of [
    [ID.SURGE_OF_THE_MISTS, 3.24 / 9],
    [ID.REJUVENATING_ASSAULT, 1]
  ]) {
    const strike = revenantCatalog.skillsById.get(id).effects.find((effect) => effect.type === 'strike');
    assert.ok(strike.ticks.every((tick) => tick.coefficient === coefficient));
  }

  assert.ok(
    revenantCatalog.skillsById
      .get(ID.REJUVENATING_ASSAULT)
      .comboFinishers.some((finisher) => finisher.finisherType === 'Whirl')
  );
});

test('Unrelenting Assault triggers Peitha once from its opening shadowstep', () => {
  const result = simulate('Core', ['Unrelenting Assault'], { primaryWeapon: 'Sword', relic: 'Peitha' }, tail);
  assert.deepEqual(result.warnings, []);
  assert.ok(
    result.events.filter((event) => event.type === 'damage' && event.skillId === ID.UNRELENTING_ASSAULT).length > 1
  );
  const triggers = result.events.filter((event) => event.type === 'peitha');
  assert.equal(triggers.length, 1);
  assert.equal(triggers[0].skillId, ID.UNRELENTING_ASSAULT);
});
