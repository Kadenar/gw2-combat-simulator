import assert from 'node:assert/strict';
import test from 'node:test';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { engineerProfession } from '#gw2/professions/engineer/definition.js';
import { ENGINEER_TRAIT_IDS as TRAIT } from '#gw2/professions/engineer/data/ids.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

const simulate = createProfessionSimulator(engineerProfession, {
  stats: { power: 2000, precision: 1000, ferocity: 0, conditionDamage: 0 },
  target: { armor: 2597, conditions: {} }
});

// Repeated commands isolate charge accumulation from weapon and kit trait interactions.
test('every mech command retains tool-belt classification and Tools reactions', () => {
  const commands = engineerCatalog.skills.filter(
    (skill) => skill.specialization === 'Mechanist' && skill.independentCast
  );
  assert.equal(commands.length, 9);
  assert.ok(commands.every((skill) => skill.countsAsToolbeltSkill === true));
  const result = simulate('Mechanist', ['Discharge Array'], {
    selectedTraitIds: [
      TRAIT.KINETIC_BATTERY,
      TRAIT.OPTIMIZED_ACTIVATION,
      TRAIT.STATIC_DISCHARGE,
      TRAIT.MECHANIZED_DEPLOYMENT
    ]
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.endState.profession.kineticCharges, 1);
  assert.ok(result.events.some((event) => event.kind === 'vigor'));
  assert.ok(result.resolvedEvents.some((event) => event.name === 'Static Discharge'));
  assert.equal(result.endState.cooldowns['Discharge Array'].readyAt, 25500);
});

test('mech command charges count when issued, before the independent animation completes', () => {
  const result = simulate('Mechanist', ['Rolling Smash', 'Discharge Array', 'Fragmentation Shot'], {
    selectedTraitIds: [TRAIT.KINETIC_BATTERY]
  });
  const charges = result.events.filter(
    (event) => event.type === 'engineer.state' && event.reason === 'kinetic-battery'
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    charges.map((event) => [event.at, event.state.kineticCharges]),
    [
      [0, 1],
      [0, 2]
    ]
  );
  assert.equal(result.steps.find((step) => step.skill === 'Fragmentation Shot').start, 0);
});

test('Kinetic Battery resets on the fifth command and grants five seconds of speed and player strike damage', () => {
  const config = { selectedTraitIds: [TRAIT.KINETIC_BATTERY] };
  const four = Array(4).fill('Discharge Array');
  const charging = simulate('Mechanist', four, config);
  assert.equal(charging.endState.profession.kineticCharges, 4);
  assert.equal(
    charging.events.some((event) => event.kind === 'kinetic-battery'),
    false
  );

  const rotation = [
    ...four,
    'Discharge Array',
    'Fragmentation Shot',
    { type: 'wait', durationMs: 5000 },
    'Fragmentation Shot'
  ];
  const active = simulate('Mechanist', rotation, config);
  const disabled = simulate('Mechanist', rotation);
  assert.deepEqual(active.warnings, []);
  assert.deepEqual(disabled.warnings, []);
  assert.equal(active.endState.profession.kineticCharges, 0);
  assert.equal(
    disabled.events.some((event) => event.kind === 'kinetic-battery'),
    false
  );
  for (const kind of ['kinetic-battery', 'quickness', 'superspeed']) {
    const buffs = active.events.filter((event) => event.type === 'buff' && event.kind === kind);
    assert.equal(buffs.length, 1);
    assert.equal(buffs[0].duration, 5);
  }

  const hits = (result) =>
    result.resolvedEvents.filter((event) => event.type === 'damage' && event.skillName === 'Fragmentation Shot');
  assert.ok(Math.abs(hits(active)[0].damage / hits(disabled)[0].damage - 1.15) < 1e-12);
  assert.equal(hits(active)[1].damage, hits(disabled)[1].damage);
});

// Active State follows the inspected time, including before activation and at buff expiry.
test('Kinetic Battery charges and buff timer appear in Active State across Engineer specializations', () => {
  for (const specialization of ['Core', 'Mechanist', 'Holosmith', 'Scrapper', 'Amalgam']) {
    const runtime = engineerProfession.resolveRuntime({ specialization });
    const context = {
      specialization,
      config: { selectedTraitIds: [TRAIT.KINETIC_BATTERY] },
      professionState: { kineticCharges: 4 }
    };
    assert.equal(
      runtime.ui.resourceViews(context).some((view) => view.id === 'kineticCharges'),
      false
    );
    const snapshot = (atSeconds, charges) =>
      Object.fromEntries(
        runtime.ui
          .rotationStateSnapshot({
            ...context,
            professionState: { kineticCharges: charges },
            atSeconds,
            result: { events: [{ type: 'buff', kind: 'kinetic-battery', at: 10, duration: 5 }] }
          })
          .map((item) => [item.id, item.value])
      );
    assert.equal(snapshot(9, 4)['engineer-kinetic-charges'], '4/5');
    assert.equal(snapshot(9, 4)['engineer-kinetic-battery'], undefined);
    assert.equal(snapshot(10, 0)['engineer-kinetic-charges'], '0/5');
    assert.equal(snapshot(10, 0)['engineer-kinetic-battery'], '5.0s');
    assert.equal(snapshot(12, 1)['engineer-kinetic-charges'], '1/5');
    assert.equal(snapshot(12, 1)['engineer-kinetic-battery'], '3.0s');
    assert.equal(snapshot(15, 1)['engineer-kinetic-battery'], undefined);
    assert.equal(
      runtime.ui.rotationStateSnapshot({ specialization }).some((item) => item.id === 'engineer-kinetic-charges'),
      false
    );
    const event = { type: 'engineer.state', reason: 'kinetic-battery', state: { kineticCharges: 4 } };
    assert.match(runtime.ui.eventLogRow(context, event).description, /4\/5/);
    event.state.kineticCharges = 0;
    assert.match(runtime.ui.eventLogRow(context, event).description, /activated/);
  }
});
