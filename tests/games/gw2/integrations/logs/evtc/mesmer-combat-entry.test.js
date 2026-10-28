import assert from 'node:assert/strict';
import test from 'node:test';

import { eiMesmerPhaseRetreat } from '#gw2/integrations/logs/evtc/rotation/ei-minions.js';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { LOG_OPENER_WARNING } from '#gw2/integrations/logs/shared/rotation/model.js';
import { ROTATION_PROFILES } from '#gw2/integrations/logs/shared/rotation/profiles.js';
import { MESMER_SKILL_IDS as ID, MESMER_TRAIT_IDS as TRAIT } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/profession.js';
import { event, log, EVTC_FIXTURE_PLAYER as PLAYER } from '#tests/helpers/evtc-fixture.js';
import { evtcReconstructionContext } from '#tests/helpers/evtc-reconstruction-context.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';

/** Core skill evidence applies across Mesmer specializations without inventing casts from unrelated packets. */
test('Phase Retreat imports owned missile creations across Mesmer specializations without duplicate inputs', () => {
  const missile = event({ time: 200, stateChange: 57, skillId: ID.PHASE_RETREAT });
  const fixture = log({
    agents: [{ ...log().agents[0], profession: 7, elite: 73 }],
    skills: [{ id: ID.PHASE_RETREAT, name: 'Phase Retreat' }],
    events: [
      event({ time: 100, stateChange: 1 }),
      missile,
      { ...missile, time: 201 },
      { ...missile, time: 300, source: 0x9999n },
      { ...missile, time: 400, stateChange: 58 },
      { ...missile, time: 500, stateChange: 59 },
      { ...missile, time: 600, stateChange: 0, value: 100 },
      { ...missile, time: 700, skillId: ID.BLINK }
    ]
  });
  const context = evtcReconstructionContext({
    profile: ROTATION_PROFILES.find((p) => p.specializationId === 'troubadour'),
    playerAddress: PLAYER,
    log: fixture,
    catalog: mesmerCatalog,
    recordedActions: []
  });
  for (const profile of ROTATION_PROFILES.filter((p) => p.professionId === 'mesmer')) {
    const actions = eiMesmerPhaseRetreat({ ...context, profile });
    assert.equal(actions.length, 1, profile.specializationId);
    assert.equal(actions[0].rawSkillId, ID.PHASE_RETREAT);
    assert.deepEqual(eiMesmerPhaseRetreat({ ...context, profile, recordedActions: actions }), []);
  }

  assert.deepEqual(
    eiMesmerPhaseRetreat({
      ...context,
      profile: ROTATION_PROFILES.find((p) => p.professionId === 'thief')
    }),
    []
  );
  const imported = reconstructEvtcRotation(fixture, mesmerCatalog);
  assert.equal(imported.rotation.filter((command) => command.skillId === ID.PHASE_RETREAT).length, 1);
  assert.deepEqual(imported.warnings, [LOG_OPENER_WARNING]);
});

/** The player's opening impact must enter combat and retain its burning before the cast's recovery completes. */
test('Mage opening impact and burning survive the imported combat boundary', () => {
  const fixture = log({
    agents: [{ ...log().agents[0], profession: 7, elite: 73 }],
    skills: [{ id: ID.PHANTASMAL_MAGE, name: 'Phantasmal Mage' }],
    events: [
      event({ time: 900, stateChange: 9 }),
      event({ time: 1000, stateChange: 67, skillId: ID.PHANTASMAL_MAGE, value: 760 }),
      event({ time: 1560, stateChange: 1 }),
      event({ time: 1560, skillId: 38323, target: 0x2000n, value: 100 }),
      event({ time: 1760, stateChange: 68, skillId: ID.PHANTASMAL_MAGE, value: 760, activation: 3 })
    ]
  });
  const imported = reconstructEvtcRotation(fixture, mesmerCatalog);
  const result = simulateMesmer([...imported.rotation, { type: 'wait', durationMs: 4000 }], {
    specialization: 'Troubadour',
    primaryWeapon: 'Scepter',
    secondaryWeapon: 'Torch',
    selectedTraitIds: [TRAIT.THE_PLEDGE]
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(result.firstHitTime, result.combatStartTime);
  const opener = result.resolvedEvents.find(
    (e) => e.type === 'damage' && e.actorType === 'player' && e.skillId === ID.PHANTASMAL_MAGE
  );
  assert.equal(opener.at, result.combatStartTime);
  assert.ok(
    result.resolvedEvents.some(
      (e) => e.type === 'condition' && e.condition === 'Burning' && e.at === opener.at && e.damage > 0
    )
  );
  assert.equal(imported.sourceActions[0].startMs, 1000);
  assert.ok(opener.at < result.events.find((e) => e.type === 'action' && e.skillId === ID.PHANTASMAL_MAGE).endsAt);
});

/** A leap while the field is active must grant its aura and trigger the selected aura-gain trait. */
test('Phase Retreat can combo during Chaos Storm recovery and grant Illusionary Membrane', () => {
  const result = simulateMesmer(
    [
      { type: 'cast', skillId: ID.CHAOS_STORM },
      { type: 'cast', skillId: ID.PHASE_RETREAT, concurrentOffsetMs: 360 },
      { type: 'wait', durationMs: 1000 }
    ],
    {
      specialization: 'Troubadour',
      primaryWeapon: 'Staff',
      secondaryWeapon: '',
      selectedTraitIds: [TRAIT.ILLUSIONARY_MEMBRANE]
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.ok(result.events.some((e) => e.type === 'buff' && e.name === 'Illusionary Membrane'));
});
