import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { revenantCatalog, revenantProfession } from '#gw2/professions/revenant/profession.js';
import { REVENANT_LEGEND_IDS as LEGEND, REVENANT_SKILL_IDS as ID } from '#gw2/professions/revenant/data/ids.js';
import { createObservedProfessionSimulator } from '#tests/helpers/observed-runtime.js';

const simulate = createObservedProfessionSimulator(revenantProfession, {
  selectedLegends: [LEGEND.ASSASSIN, LEGEND.DEMON],
  startingLegend: LEGEND.ASSASSIN,
  initialEnergy: 50,
  primaryWeapon: 'Scepter',
  secondaryWeapon: 'Sword',
  boons: { quickness: true },
  attributeInputs: baseAttributeInputs({ power: 2000 }),
  target: { armor: 2597 }
});
const tail = { kind: 'tail', durationMs: 6000 };
const auraDamage = (result) =>
  result.events.filter((event) => event.type === 'damage' && event.skillId === ID.BLOSSOMING_AURA);

test('Enemy Attraction requires a mature tether and releases it with vulnerability and control', () => {
  // Follow-ups own the active tether; the pull consumes it and starts the parent recharge.
  const inactive = simulate('Core', ['Otherworldly Attraction (enemy)']);
  assert.ok(inactive.warnings.some(({ message: warning }) => warning.includes('unavailable')));
  const early = simulate('Core', ['Otherworldly Bond', 'Otherworldly Attraction (enemy)']);
  assert.ok(early.warnings.some(({ message: warning }) => warning.includes('unavailable')));
  const result = simulate('Core', [
    'Otherworldly Bond',
    { type: 'wait', durationMs: 4000 },
    'Otherworldly Attraction (enemy)'
  ]);
  assert.deepEqual(result.warnings, []);
  const effects = result.events.filter((event) => event.skillId === ID.OTHERWORLDLY_ATTRACTION_ENEMY);
  assert.ok(
    effects.some(
      (event) =>
        event.type === 'condition' && event.condition === 'Vulnerability' && event.stacks === 6 && event.duration === 10
    )
  );
  assert.ok(effects.some((event) => event.type === 'control' && event.controlKind === 'pull'));
  assert.equal(result.planningState.profession.availableFlips[ID.OTHERWORLDLY_ATTRACTION_ENEMY], undefined);
  assert.equal(result.planningState.profession.availableFlips[ID.DEACTIVATE_OTHERWORLDLY_BOND], undefined);
  assert.ok(result.planningState.cooldowns[ID.OTHERWORLDLY_BOND].remaining > 0);
});

test('Tether cancellation, expiry and weapon swap close follow-ups and start recharge', () => {
  // Every release path must sever the pending pull, including one that never matured.
  for (const ending of [
    [{ type: 'wait', durationMs: 1000 }, 'Deactivate Otherworldly Bond'],
    [{ type: 'wait', durationMs: 7000 }],
    ['Swap Weapons']
  ]) {
    const result = simulate('Core', ['Otherworldly Bond', ...ending], { weaponSet2Primary: 'Staff' });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.planningState.profession.availableFlips[ID.OTHERWORLDLY_ATTRACTION_ENEMY], undefined);
    assert.equal(result.planningState.profession.availableFlips[ID.DEACTIVATE_OTHERWORLDLY_BOND], undefined);
    assert.ok(result.planningState.cooldowns[ID.OTHERWORLDLY_BOND].remaining > 0);
  }
});

test('Blossoming Aura divides its total pulsing coefficient across its strikes', () => {
  // The tooltip describes total pulse damage; each strike must receive only its share.
  const pulse = revenantCatalog.skillsById
    .get(ID.BLOSSOMING_AURA)
    .effects.find((effect) => effect.type === 'strike' && effect.name === 'Pulsing Damage');
  assert.equal(
    pulse.ticks.reduce((total, tick) => total + tick.coefficient, 0),
    1.2
  );
  assert.ok(pulse.ticks.every((tick) => tick.coefficient === 0.3));
});

test('Blossoming Aura keeps a fixed fuse after attachment regardless of cast speed', () => {
  // The lasting effect's cadence and cooldown are independent of the initial casting animation.
  for (const quickness of [false, true]) {
    const result = simulate('Core', ['Blossoming Aura'], { boons: { quickness } }, tail);
    const damage = auraDamage(result);
    assert.deepEqual(result.warnings, []);
    assert.equal(damage.at(-1).coefficient, 2.5);
    assert.equal(result.planningState.cooldowns[ID.BLOSSOMING_AURA].readyAt, 6400);
    assert.equal(result.planningState.profession.availableFlips[ID.DETONATE_BLOSSOMING_AURA], undefined);
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
    assert.equal(result.planningState.cooldowns[ID.BLOSSOMING_AURA].readyAt, 6400);
    assert.equal(result.planningState.profession.availableFlips[ID.DETONATE_BLOSSOMING_AURA], undefined);
  }
});

test('Aura stays attached and remains manually detonatable across a legend swap', () => {
  const result = simulate('Core', ['Blossoming Aura', 'Swap Legends', 'Detonate Blossoming Aura'], {}, tail);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    auraDamage(result).map((event) => event.name),
    ['Pulsing Damage', 'Final Damage']
  );
  assert.equal(result.planningState.cooldowns[ID.BLOSSOMING_AURA].readyAt, 6400);
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
