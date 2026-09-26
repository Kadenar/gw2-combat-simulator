import assert from 'node:assert/strict';
import test from 'node:test';
import { boonApplicationsAt } from '#gw2/platform/combat/boons.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { runtimeFor } from '#tests/helpers/live-runtime.js';

const config = { specialization: 'Firebrand', selectedTraitIds: [TRAIT.QUICKFIRE] };
const wait = (durationMs) => ({ type: 'wait', durationMs });
const state = (result) => runtimeFor(result).profession.specialization.state;
const burns = (result) =>
  result.resolvedEvents.filter(
    (event) => event.type === 'condition' && event.sourceId === 'guardian.ashes-of-the-just'
  );
const quickness = (runtime, at, audience = { recipients: 'self' }) =>
  runtime.emit({
    type: 'buff',
    source: 'fixture',
    sourceId: 'quickness',
    actorType: 'player',
    at,
    kind: 'quickness',
    duration: 1,
    stacks: 1,
    audience
  });
const strike = (runtime, at) =>
  runtime.emit({
    type: 'damage',
    source: 'guardian',
    sourceId: ID.ORB_OF_WRATH,
    skillId: ID.ORB_OF_WRATH,
    actorType: 'player',
    at,
    coefficient: 1,
    weaponStrengthProfileId: 'weapon.scepter',
    activationId: `hit-${at}`
  });

// Grants mutate one charge owner; emitted history and public snapshots remain detached.
test('Ashes spending cannot mutate its delivered buff or public snapshot', () => {
  const result = runGuardian(
    [ID.TOME_OF_JUSTICE, ID.ASHES_OF_THE_JUST, wait(1000)],
    { specialization: 'Firebrand' },
    (runtime) => strike(runtime, 1)
  );
  const buff = result.events.find((event) => event.kind === 'ashes-of-the-just');
  assert.equal(state(result).ashes.charges, buff.stacks - 1);
  const remaining = result.planningState.profession.ashes.charges;
  state(result).ashes.charges = 0;
  assert.equal(result.planningState.profession.ashes.charges, remaining);
  assert.equal(buff.stacks, remaining + 1);
});

test('Ashes buff history, expiry cleanup, and planning state share the effect-clock deadline', () => {
  const result = runGuardian([wait(1), ID.TOME_OF_JUSTICE, ID.ASHES_OF_THE_JUST, wait(11000)], {
    specialization: 'Firebrand'
  });
  assert.deepEqual(result.warnings, []);
  const application = result.events.find((event) => event.kind === 'ashes-of-the-just');
  const [buff] = boonApplicationsAt(result.events, 'ashes-of-the-just', application.at);
  assert.ok(buff.expiresAt > application.at + application.duration);
  assert.equal(state(result).ashes.expiresAt, buff.expiresAt);
  assert.equal(result.planningState.profession.ashes.expiresAt, buff.expiresAt);
  assert.equal(state(result).ashes.charges, 0);
});

test('Quickfire refresh preserves live charges and readiness but cannot revive an expired grant', () => {
  for (const at of [10.599999, 10.6]) {
    const result = runGuardian([wait(10700)], config, (runtime) => {
      runtime.profession.specialization.state.ashes = { charges: 2, expiresAt: 10.6, readyAt: 11 };
      runtime.schedule('guardian.firebrand.ashes-expiry', 10.6, undefined, undefined, 10);
      quickness(runtime, at);
    });
    assert.equal(state(result).ashes.charges, at < 10.6 ? 3 : 1);
    assert.equal(state(result).ashes.readyAt, at < 10.6 ? 11 : 0);
    assert.equal(state(result).ashes.expiresAt, 20.6);
  }
});

test('Quickfire allies can consume their tick-aligned grant exactly at expiry', () => {
  for (const at of [0, 0.001]) {
    const result = runGuardian([wait(11000)], { ...config, allies: { count: 1, strikesPerSecond: 0.1 } }, (runtime) => {
      quickness(runtime, at, { recipients: 'party', affectsSelf: false });
    });
    assert.equal(burns(result).length, 1);
    assert.equal(burns(result)[0].metadata.triggeredByAlly, 1);
  }
});

test('tome and Quickfire grants allow an expiry-time hit before cleanup in either insertion order', () => {
  for (const tome of [false, true]) {
    const rotation = tome ? [ID.TOME_OF_JUSTICE, ID.ASHES_OF_THE_JUST, wait(11000)] : [wait(11000)];
    const expiry = tome ? 10.56 : 10;
    for (const offset of [-0.000001, 0, 0.000001]) {
      for (const hitFirst of [false, true]) {
        const result = runGuardian(
          rotation,
          { ...config, selectedTraitIds: tome ? [] : config.selectedTraitIds },
          (runtime) => {
            const hit = () => strike(runtime, expiry + offset);
            const grant = () => {
              if (!tome) quickness(runtime, 0);
            };

            if (hitFirst) {
              hit();
              grant();
            } else {
              grant();
              hit();
            }
          }
        );
        assert.equal(burns(result).length, Number(offset <= 0), `tome=${tome} offset=${offset} hitFirst=${hitFirst}`);
        assert.equal(state(result).ashes.charges, 0);
      }
    }
  }
});
