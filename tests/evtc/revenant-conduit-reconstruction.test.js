import assert from 'node:assert/strict';
import test from 'node:test';
import { reconstructEvtcRotation } from '#gw2/integrations/logs/evtc/rotation/index.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import { revenantProfession } from '#gw2/professions/revenant/definition.js';
import { EVTC_FIXTURE_PLAYER as PLAYER, event, log } from '../helpers/evtc-fixture.js';
import { createProfessionSimulator } from '../helpers/profession-simulation.js';

const simulate = createProfessionSimulator(revenantProfession, {
  selectedLegends: ['LegendaryAssassin', 'LegendaryEntity'],
  initialEnergy: 100,
  primaryWeapon: 'Sword',
  secondaryWeapon: 'Sword',
  stats: { power: 2000, precision: 1500, ferocity: 500, conditionDamage: 0 },
  target: { armor: 2597, conditions: {} },
  boons: { quickness: true }
});

function conduitLog(events, skills = []) {
  return log({
    agents: [{ ...log().agents[0], profession: 9, elite: 79 }],
    skills,
    events
  });
}

test('Cosmic Wisdom imports applications without fabricating casts from initial state or swap extensions', () => {
  // Only a player application supplies an input timestamp; initial state and extensions must not add casts.
  const fixture = conduitLog([
    event({ time: 1000, target: PLAYER, skillId: 76559, buff: 1, value: 6200, buffDamage: 7000, stateChange: 18 }),
    event({ time: 1000, skillId: 29057, value: 540, stateChange: 67 }),
    event({ time: 1360, skillId: 29057, value: 360, activation: 3, stateChange: 68 }),
    event({ time: 1400, source: 0n, target: PLAYER, skillId: 76559, buff: 1, value: 1000, stateChange: 70 }),
    event({ time: 2000, target: PLAYER, skillId: 76559, buff: 1, value: 7000, stateChange: 69 })
  ]);
  const imported = reconstructEvtcRotation(fixture, revenantCatalog);
  assert.deepEqual(imported.warnings, []);
  const casts = imported.actions.filter((action) => action.name === 'Cosmic Wisdom');
  assert.equal(casts.length, 1);
  assert.equal(casts[0].timestampMs + imported.timelineOriginMs, 2000);
  const result = simulate('Conduit', imported.rotation, { startingLegend: 'LegendaryAssassin' });
  assert.deepEqual(result.warnings, []);
  assert.ok(result.endState.profession.cosmicWisdomUntil > 0);
  assert.equal(result.steps.find((step) => step.skill === 'Cosmic Wisdom').start, 1000);
});

test('initial Impossible Odds restores Assassin state without delaying the recorded legend swap', () => {
  // A buff snapshot proves the opening stance; the first real swap must still be ready on replay.
  const fixture = conduitLog(
    [
      event({ time: 1000, target: PLAYER, skillId: 27581, buff: 1, value: 1000, stateChange: 18 }),
      event({ time: 1000, skillId: 29057, value: 540, stateChange: 67 }),
      event({ time: 1360, skillId: 29057, value: 360, activation: 3, stateChange: 68 }),
      event({ time: 1400, target: PLAYER, skillId: 77234, buff: 1, value: 1000 }),
      event({ time: 1500, skillId: 76968, value: 1380, stateChange: 67 }),
      event({ time: 2420, skillId: 76968, value: 920, activation: 3, stateChange: 68 })
    ],
    [{ id: 77234, name: 'Legendary Entity Stance' }]
  );
  for (const startingLegend of ['LegendaryEntity', 'LegendaryAssassin']) {
    const imported = reconstructEvtcRotation(fixture, revenantCatalog, { professionConfig: { startingLegend } });
    assert.deepEqual(imported.warnings, []);
    const result = simulate('Conduit', imported.rotation, { startingLegend });
    assert.deepEqual(result.warnings, []);
    assert.ok(result.steps.some((step) => step.skill === 'Impossible Odds'));
    const swap = result.steps.findLast((step) => step.skill === 'Swap Legends');
    const thrust = result.steps.find((step) => step.skill === 'Preparation Thrust');
    assert.equal(swap.start - thrust.start, 400);
  }

  const withoutEvidence = reconstructEvtcRotation({ ...fixture, events: fixture.events.slice(1) }, revenantCatalog);
  assert.equal(
    withoutEvidence.rotation.some((command) => command.name === 'Impossible Odds'),
    false
  );
});

test('Conduit maps interrupted defense animations and emits one input for a Haze teleport', () => {
  // Internal launch IDs must not consume an extra Haze charge; the defense stunbreak precedes its cancelled animation.
  const fixture = conduitLog(
    [
      event({ time: 1000, skillId: 76718, value: 400, stateChange: 67 }),
      event({ time: 1080, skillId: 76718, value: 80, activation: 4, stateChange: 68 }),
      event({ time: 1200, skillId: 77141, value: 500, stateChange: 67 }),
      event({ time: 1520, skillId: 77141, value: 320, activation: 3, stateChange: 68 }),
      event({ time: 1520, skillId: 77047, value: 300, stateChange: 67 }),
      event({ time: 1760, skillId: 77047, value: 240, activation: 3, stateChange: 68 })
    ],
    [{ id: 77047, name: 'Beguiling Haze' }]
  );
  const imported = reconstructEvtcRotation(fixture, revenantCatalog);
  assert.deepEqual(imported.warnings, []);
  const defense = imported.rotation.find((command) => command.name === "Gladiator's Defense");
  assert.equal(defense?.skillId, 77291);
  assert.equal(imported.rotation.filter((command) => command.name === 'Beguiling Haze').length, 1);
  // Keep the launch inside the combined input, rather than replacing it with a wait before a full simulator cast.
  assert.equal(
    imported.actions.find((action) => action.name === 'Beguiling Haze').timestampMs,
    fixture.events.find((entry) => entry.skillId === 77141).time - imported.timelineOriginMs
  );
  const result = simulate('Conduit', imported.rotation, { startingLegend: 'LegendaryEntity' });
  assert.deepEqual(result.warnings, []);
  assert.equal(
    result.events.some((entry) => entry.type === 'damage' && entry.skillName === "Gladiator's Defense"),
    true
  );
});
