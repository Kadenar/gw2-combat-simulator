import assert from 'node:assert/strict';
import test from 'node:test';
import { thiefProfession } from '#gw2/professions/thief/definition.js';
import { THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

const simulate = createProfessionSimulator(thiefProfession, {
  primaryWeapon: 'Axe',
  secondaryWeapon: 'Dagger',
  selectedSkills: ['Skritt Scuffle', 'Hide in Shadows'],
  target: { armor: 2597, conditions: {} }
});

// Inspect projected simulation state through the same callback used by the insertion bar.
function activeState(result, specialization = 'Core', config = {}) {
  assert.deepEqual(result.warnings, []);
  return Object.fromEntries(
    thiefProfession.ui
      .rotationStateSnapshot({
        specialization,
        professionState: result.endState.profession,
        atSeconds: result.endState.time / 1000,
        build: { weapons: ['Axe', 'Dagger'] },
        config
      })
      .map((item) => [item.id, item.value])
  );
}

test('ground axes accumulate per emitted projectile, cap at six, and expire independently', () => {
  assert.equal(activeState(simulate('Core', ['Venomous Volley']))['thief-spinning-axes'], '3/6');
  assert.equal(
    activeState(simulate('Core', ['Venomous Volley', 'Venomous Volley', 'Spinning Axe']))['thief-spinning-axes'],
    '6/6'
  );
  const expired = simulate('Core', ['Spinning Axe', { type: 'wait', durationMs: 9500 }, 'Spinning Axe']);
  assert.equal(activeState(expired)['thief-spinning-axes'], '1/6');
  assert.equal(
    activeState(simulate('Core', ['Spinning Axe', { type: 'wait', durationMs: 10000 }]))['thief-spinning-axes'],
    '0/6'
  );
  const interrupted = simulate('Core', [{ name: 'Venomous Volley', interruptMs: 300 }]);
  assert.equal(activeState(interrupted)['thief-spinning-axes'], '0/6');
});

test('all recall variants consume axes and cancelled recalls preserve the pool', () => {
  for (const [secondaryWeapon, recall] of [
    ['Dagger', 'Harrowing Storm'],
    ['Pistol', 'Orchestrated Assault'],
    ['', 'Recall Axes']
  ]) {
    const result = simulate('Core', ['Venomous Volley', recall], { secondaryWeapon });
    assert.equal(activeState(result)['thief-spinning-axes'], '0/6');
    const interrupted = simulate('Core', ['Venomous Volley', { name: recall, interruptMs: 100 }], { secondaryWeapon });
    assert.equal(activeState(interrupted)['thief-spinning-axes'], '3/6');
  }

  for (const [specialization, salvo] of [
    ['Core', 'Cunning Salvo'],
    ['Deadeye', 'Malicious Cunning Salvo']
  ]) {
    assert.equal(
      activeState(simulate(specialization, ['Hide in Shadows', salvo]), specialization)['thief-spinning-axes'],
      '1/6'
    );
  }
});

test('Prodigious Pincher projects spending progress and resets on a pilfer', () => {
  const config = { selectedTraitIds: [TRAIT.PRODIGIOUS_PINCHER] };
  const progress = simulate('Antiquary', ['Skritt Swipe', 'Venomous Volley'], config);
  assert.equal(progress.endState.profession.initiativeSpentSincePilfer, 3);
  assert.equal(activeState(progress, 'Antiquary', config)['antiquary-prodigious-pincher'], '3/15');
  const pilfer = simulate('Antiquary', Array(5).fill('Venomous Volley'), config);
  assert.equal(pilfer.endState.profession.initiativeSpentSincePilfer, 0);
  assert.equal(activeState(pilfer, 'Antiquary', config)['antiquary-prodigious-pincher'], '0/15');
  assert.equal(
    activeState(simulate('Antiquary', ['Venomous Volley']), 'Antiquary')['antiquary-prodigious-pincher'],
    undefined
  );
});

test('Skritt Scuffle advances its next-pilfer countdown and clears it after the final grant', () => {
  const started = simulate('Antiquary', ['Skritt Scuffle']);
  assert.equal(activeState(started, 'Antiquary')['antiquary-skritt-scuffle'], '3.0s');
  const advanced = simulate('Antiquary', ['Skritt Scuffle', { type: 'wait', durationMs: 4000 }]);
  assert.equal(activeState(advanced, 'Antiquary')['antiquary-skritt-scuffle'], '2.0s');
  const ended = simulate('Antiquary', ['Skritt Scuffle', { type: 'wait', durationMs: 15000 }]);
  assert.equal(activeState(ended, 'Antiquary')['antiquary-skritt-scuffle'], undefined);
});

test('Surfer exposes the buff window independently of the bomb-hit assumption', () => {
  for (const [selectedTraitIds, duration] of [
    [[], 10],
    [[TRAIT.METICULOUS_CUSTODIAN], 12]
  ]) {
    const config = { selectedTraitIds, deterministicChoices: { forgedSurferBombsHit: 1 } };
    const rotation = ['Skritt Swipe', 'Forged Surfer Dash'];
    const active = simulate('Antiquary', rotation, config);
    assert.equal(activeState(active, 'Antiquary')['antiquary-forged-surfer-dash'], `${duration.toFixed(1)}s`);
    const expired = simulate('Antiquary', [...rotation, { type: 'wait', durationMs: duration * 1000 }], config);
    assert.equal(activeState(expired, 'Antiquary')['antiquary-forged-surfer-dash'], undefined);
  }
});

test('Distracting Throw stays visible alongside Revealed and disappears at expiry', () => {
  const professionState = { distractingThrowBuffUntil: 10, revealedUntil: 8, spinningAxeExpirations: [5, 9] };
  const values = (atSeconds) =>
    Object.fromEntries(
      thiefProfession.ui
        .rotationStateSnapshot({ specialization: 'Antiquary', professionState, atSeconds })
        .map((item) => [item.id, item.value])
    );
  assert.equal(values(5)['thief-distracting-throw'], '5.0s');
  assert.equal(values(5)['thief-revealed'], '3.0s');
  assert.equal(values(5)['thief-spinning-axes'], '1/6');
  assert.equal(values(10)['thief-distracting-throw'], undefined);
});
