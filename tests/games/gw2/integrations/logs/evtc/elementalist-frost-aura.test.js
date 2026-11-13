// Recover the weapon aura without turning shared or passive aura grants into familiar charges.
import assert from 'node:assert/strict';
import test from 'node:test';

import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { elementalistFrostAuraActions } from '#gw2/integrations/logs/evtc/rotation/professions/elementalist.js';
import { ROTATION_PROFILES } from '#gw2/integrations/logs/shared/rotation/profiles.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { runNative } from '#tests/helpers/elementalist-simulation.js';
import { event, log, EVTC_FIXTURE_PLAYER as PLAYER } from '#tests/helpers/evtc-fixture.js';
import { evtcReconstructionContext } from '#tests/helpers/evtc-reconstruction-context.js';

const aura = (overrides = {}) => event({ skillId: 5579, stateChange: 69, target: PLAYER, value: 10000, ...overrides });
const context = (events, recordedActions = []) =>
  evtcReconstructionContext({
    log: log({ events }),
    playerAddress: PLAYER,
    profile: ROTATION_PROFILES.find((profile) => profile.specializationId === 'evoker'),
    catalog: elementalistCatalog,
    recordedActions
  });

test('Frost Aura recovers an owned weapon grant and preserves explicit cast evidence', () => {
  const actions = elementalistFrostAuraActions(context([aura(), aura()]));
  assert.equal(actions.length, 1);
  assert.equal(actions[0].rawSkillId, ID.FROST_AURA);
  assert.equal(actions[0].castOrigin, 'skill');
  assert.deepEqual(elementalistFrostAuraActions(context([aura()], actions)), []);
});

test('Frost Aura rejects shared grants, shorter auras, snapshots, extensions, and other professions', () => {
  for (const overrides of [
    { source: 0x3000n },
    { target: 0x3000n },
    { value: 4000 },
    { value: 5000 },
    { stateChange: 18 },
    { stateChange: 70 },
    { stateChange: 71 }
  ]) {
    assert.deepEqual(elementalistFrostAuraActions(context([aura(overrides)])), []);
  }

  assert.deepEqual(elementalistFrostAuraActions({ ...context([aura()]), profile: { professionId: 'mesmer' } }), []);
});

test('An imported Frost Aura supplies the missing charge for an Evoker familiar', () => {
  const fixture = log({
    agents: [{ ...log().agents[0], profession: 6, elite: 80 }],
    events: [event({ stateChange: 1 }), aura(), event({ time: 2000, stateChange: 2 })]
  });
  const imported = reconstructEvtcRotation(fixture, elementalistCatalog);
  const run = (rotation) =>
    runNative({
      lines: [['Fire'], ['Air'], ['Evoker']],
      rotation: [...rotation, 'Zap'],
      startAttunement: 'Water',
      weapons: ['Scepter', 'Dagger'],
      evokerElement: 'Air',
      initialEvokerCharges: 5
    });
  const result = run(imported.rotation);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.planningState.profession[STATE.FAMILIAR_CHARGES].value, 0);
  assert.equal(result.planningState.profession[STATE.EMPOWERED_CHARGES].value, 1);
  assert.ok(run([]).warnings.some(({ message }) => message.includes('requires 6 charges')));
});
