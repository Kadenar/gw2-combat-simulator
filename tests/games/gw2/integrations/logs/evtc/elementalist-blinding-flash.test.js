// Paired conditions prove an owned instant input without treating ambient blinds or weakness as casts.
import assert from 'node:assert/strict';
import test from 'node:test';

import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { elementalistBlindingFlashActions } from '#gw2/integrations/logs/evtc/rotation/professions/elementalist.js';
import { ROTATION_PROFILES } from '#gw2/integrations/logs/shared/rotation/profiles.js';
import { ELEMENTALIST_SKILL_IDS as ID } from '#gw2/professions/elementalist/data/ids.js';
import { elementalistCatalog } from '#gw2/professions/elementalist/profession.js';
import { event, log, EVTC_FIXTURE_PLAYER as PLAYER } from '#tests/helpers/evtc-fixture.js';
import { evtcReconstructionContext } from '#tests/helpers/evtc-reconstruction-context.js';

const TARGET = 0x2000n;
const blind = (overrides = {}) => event({ skillId: 720, stateChange: 69, target: TARGET, value: 6000, ...overrides });
const weakness = (overrides = {}) =>
  event({ skillId: 742, stateChange: 69, target: TARGET, value: 4000, ...overrides });
function context(events, recordedActions = []) {
  return evtcReconstructionContext({
    log: log({ events }),
    playerAddress: PLAYER,
    profile: ROTATION_PROFILES.find((profile) => profile.specializationId === 'evoker'),
    catalog: elementalistCatalog,
    recordedActions
  });
}

test('Blinding Flash recovers paired applications, including capped blind and duration bonuses', () => {
  for (const [blindDuration, weaknessDuration] of [
    [6000, 4000],
    [1960, 4000],
    [9000, 6000]
  ]) {
    const actions = elementalistBlindingFlashActions(
      context([blind({ value: blindDuration }), weakness({ value: weaknessDuration })])
    );
    assert.equal(actions.length, 1);
    assert.equal(actions[0].rawSkillId, ID.BLINDING_FLASH);
    assert.equal(actions[0].castOrigin, 'skill');
  }
});

test('Blinding Flash rejects unrelated actors, targets, durations, and non-application evidence', () => {
  const cases = [
    [blind()],
    [weakness()],
    [blind({ source: 0x3000n }), weakness()],
    [blind(), weakness({ source: 0x3000n })],
    [blind({ target: 0x3000n }), weakness()],
    [blind({ target: PLAYER }), weakness({ target: PLAYER })],
    [blind(), weakness({ value: 3000 })],
    [blind({ value: 7000 }), weakness()],
    [blind({ time: 1100 }), weakness()],
    [blind({ stateChange: 18 }), weakness()],
    [blind(), weakness({ stateChange: 70 })]
  ];
  for (const events of cases) assert.deepEqual(elementalistBlindingFlashActions(context(events)), []);
  const foreign = context([blind(), weakness()]);
  assert.deepEqual(elementalistBlindingFlashActions({ ...foreign, profile: { professionId: 'mesmer' } }), []);
});

test('Blinding Flash preserves explicit evidence and does not merge successive ammo uses', () => {
  const events = [blind(), weakness(), weakness(), blind({ time: 1500 }), weakness({ time: 1500 })];
  const actions = elementalistBlindingFlashActions(context(events));
  assert.equal(actions.length, 2);
  const missing = elementalistBlindingFlashActions(context(events, [actions[0]]));
  assert.deepEqual(missing, [actions[1]]);
});

test('EVTC reconstruction exports Blinding Flash as a usable rotation input without a skill-table entry', () => {
  const fixture = log({
    agents: [{ ...log().agents[0], profession: 6, elite: 80 }],
    events: [event({ stateChange: 1 }), blind(), weakness(), event({ time: 2000, stateChange: 2 })]
  });
  const imported = reconstructEvtcRotation(fixture, elementalistCatalog);
  assert.ok(imported.rotation.some((command) => command.skillId === ID.BLINDING_FLASH));
});
