import assert from 'node:assert/strict';
import { test } from 'node:test';
import { engineerCatalog } from '#gw2/professions/engineer/catalog.js';
import { engineerProfession } from '#gw2/professions/engineer/definition.js';
import { ENGINEER_SKILL_IDS as ID } from '#gw2/professions/engineer/data/ids.js';
import { createEngineerCoreState } from '#gw2/professions/engineer/core/state.js';
import { handleLightningRodCharge, scheduleElectricArtillery } from '#gw2/professions/engineer/core/mechanics/spear.js';
import { createProfessionSimulator } from '../../helpers/profession-simulation.js';

const simulate = createProfessionSimulator(engineerProfession, {
  primaryWeapon: 'Spear',
  stats: { power: 2000, conditionDamage: 1000 },
  target: { armor: 2597, conditions: {} }
});
const artilleryEvents = (result) => result.resolvedEvents.filter((event) => event.sourceId === ID.ELECTRIC_ARTILLERY);

// Charge expiry is half-open, and a stale pulse cannot extend another activation's resource window.
test('Lightning Rod charges expire after twelve seconds', () => {
  const core = createEngineerCoreState();
  core.lightningRodActivationId = 'rod';
  const context = { state: { profession: { core } } };
  handleLightningRodCharge(context, { at: 1, payload: { activationId: 'rod' } });
  assert.deepEqual(core.lightningRodChargeExpiries, [13]);
  handleLightningRodCharge(context, { at: 13, payload: { activationId: 'stale' } });
  assert.deepEqual(core.lightningRodChargeExpiries, [13]);
  handleLightningRodCharge(context, { at: 13, payload: { activationId: 'rod' } });
  assert.deepEqual(core.lightningRodChargeExpiries, [25]);
});

// An unused flip disappears at its deadline, including its palette flag and stored charges.
test('Electric Artillery availability ends eight seconds after arming', () => {
  const charging = simulate('Core', ['Lightning Rod']);
  const deadline = charging.endState.profession.electricArtilleryReadyAt + 8;
  const waitMs = deadline * 1000 - charging.steps[0].end;
  const before = simulate('Core', ['Lightning Rod', { type: 'wait', durationMs: waitMs - 40 }]);
  const expired = simulate('Core', ['Lightning Rod', { type: 'wait', durationMs: waitMs }, 'Electric Artillery']);
  assert.equal(before.endState.profession.electricArtilleryAvailable, true);
  assert.equal(before.endState.profession.electricArtilleryExpiresAt, deadline);
  assert.equal(expired.endState.profession.electricArtilleryAvailable, false);
  assert.equal(expired.endState.profession.availableFlips[ID.ELECTRIC_ARTILLERY], false);
  assert.deepEqual(expired.endState.profession.lightningRodChargeExpiries, []);
  assert.equal(expired.warnings.length, 1);
  assert.match(expired.warnings[0], /Lightning Rod has not finished charging/);
});

// Consuming a projectile is separate from landing it, and later actions may run during its flight.
test('Artillery damage and conditions wait for impact without delaying the next cast', () => {
  const rotation = ['Lightning Rod', 'Electric Artillery'];
  const released = simulate('Core', rotation, {}, { kind: 'rotation' });
  assert.deepEqual(released.warnings, []);
  assert.equal(
    artilleryEvents(released).some((event) => ['damage', 'condition'].includes(event.type)),
    false
  );
  assert.equal(released.endState.profession.electricArtilleryAvailable, false);
  assert.deepEqual(released.endState.profession.lightningRodChargeExpiries, []);

  const landed = simulate('Core', [...rotation, 'Conduit Surge', { type: 'wait', durationMs: 1000 }]);
  assert.deepEqual(landed.warnings, []);
  const cast = landed.steps.find((step) => step.skillId === ID.ELECTRIC_ARTILLERY);
  const conduit = landed.steps.find((step) => step.skillId === ID.CONDUIT_SURGE);
  const impact = landed.events.find((event) => event.type === 'engineer.electric-artillery');
  assert.equal(conduit.start, cast.end);
  assert.ok(Math.abs(impact.at - cast.end / 1000 - 0.6) < 1e-9);
  const packets = artilleryEvents(landed).filter((event) => ['damage', 'condition'].includes(event.type));
  assert.ok(packets.length > 0);
  assert.ok(packets.every((event) => event.at === impact.at));
  // Conduit Surge establishes Focused during flight, so Artillery resolves the Focused branch.
  assert.equal(packets.find((event) => event.type === 'damage').coefficient, 1.5);
  assert.equal(packets.find((event) => event.condition === 'Vulnerability').stacks, 8);

  const lostFocus = simulate(
    'Core',
    ['Conduit Surge', 'Lightning Rod', { type: 'wait', durationMs: 8240 }, 'Electric Artillery'],
    {},
    { kind: 'tail', durationMs: 1000 }
  );
  const unfocusedHit = artilleryEvents(lostFocus).find((event) => event.type === 'damage');
  const lateCast = lostFocus.steps.find((step) => step.skillId === ID.ELECTRIC_ARTILLERY);
  assert.ok(lateCast.end < lostFocus.steps[0].end + 10000);
  assert.ok(unfocusedHit.at > lostFocus.steps[0].end / 1000 + 10);
  assert.equal(unfocusedHit.coefficient, 1);
});

// Charges are snapshotted at release, including a charge that naturally expires before impact.
test('Artillery snapshots release charges and preserves the armed sequence on cancellation', () => {
  const core = createEngineerCoreState();
  Object.assign(core, {
    lightningRodActivationId: 'rod',
    lightningRodChargeExpiries: [10, 10.1, 20],
    electricArtilleryAvailable: true,
    availableFlips: { [ID.ELECTRIC_ARTILLERY]: true }
  });
  const emitted = [];
  const cancelledOwners = [];
  const context = {
    action: { cancelled: true },
    state: { profession: { core, specialization: { kind: 'Core', state: {} } } },
    effectiveEnd: 10,
    events: emitted,
    emit: (event) => {
      emitted.push(event);
      return event;
    },
    tasks: { cancelOwner: (owner) => cancelledOwners.push(owner) }
  };
  const skill = engineerCatalog.skillsById.get(ID.ELECTRIC_ARTILLERY);
  scheduleElectricArtillery(context, skill);
  assert.equal(emitted.length, 0);
  assert.equal(cancelledOwners.length, 0);
  assert.equal(core.electricArtilleryAvailable, true);
  assert.deepEqual(core.lightningRodChargeExpiries, [10, 10.1, 20]);
  context.action.cancelled = false;
  scheduleElectricArtillery(context, skill);
  const impact = emitted.find((event) => event.type === 'engineer.electric-artillery');
  assert.equal(impact.charges, 2);
  assert.equal(impact.at, 10.6);
  assert.deepEqual(core.lightningRodChargeExpiries, []);
  assert.deepEqual(cancelledOwners, ['engineer.lightning-rod:rod']);
});
