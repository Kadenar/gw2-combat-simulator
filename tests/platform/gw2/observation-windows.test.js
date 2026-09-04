import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultSimulationConfig } from '../../helpers/fixture-harness-core.js';
import { simulateMesmer } from '../../helpers/mesmer-simulation.js';
import { resolveTestGw2Stream } from '../../helpers/gw2-resolver.js';
import { buildScheduledEventStream } from '#gw2/platform/engine/events/scheduled-stream.js';

// Combat starts and target death bound the events and elapsed time used for DPS.
test('DPS excludes elapsed time before the first hit', () => {
  const result = simulateMesmer(
    [{ name: '__wait', waitMs: 1000 }, 'Mind Slash', { name: '__wait', waitMs: 1000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Sword',
      secondaryWeapon: '',
      initialResource: 0
    })
  );

  assert.ok(Math.abs(result.firstHitTime - 1.36) < 1e-12);
  assert.equal(result.dpsStartTime, result.firstHitTime);
  assert.ok(Math.abs(result.dpsWindow - 1) < 1e-12);
  assert.equal(result.dps, result.totalDamage / result.dpsWindow);
});

test('target death finishes the lethal activation and stops future events', () => {
  const defaults = defaultSimulationConfig();
  const result = simulateMesmer(
    ['Bladecall', { name: '__wait', waitMs: 5000 }, 'Unstable Bladestorm'],
    defaultSimulationConfig({
      target: {
        ...defaults.target,
        health: 1
      }
    })
  );
  const damageEvents = result.resolvedEvents.filter((event) => event.type === 'damage');

  assert.equal(result.deathTime, damageEvents[0].at);
  assert.equal(damageEvents.length, 3);
  assert.ok(damageEvents.every((event) => event.at === result.deathTime));
  assert.ok(damageEvents.every((event) => event.skillName === 'Bladecall'));
  assert.equal(
    damageEvents.some((event) => event.skillName === 'Unstable Bladestorm'),
    false
  );
  assert.ok(result.events.every((event) => event.at <= result.deathTime + 0.0001));
});

test('target death finishes untagged multi-hit siblings', () => {
  const stream = buildScheduledEventStream({
    events: [
      {
        type: 'damage',
        at: 1,
        name: 'First sibling',
        skillName: 'Untagged multi-hit',
        flatDamage: 1,
        hits: 1,
        hitIndex: 1,
        totalHits: 2,
        source: 'Player',
        sourceId: 'untagged-multi-hit',
        actorType: 'player'
      },
      {
        type: 'damage',
        at: 1,
        name: 'Second sibling',
        skillName: 'Untagged multi-hit',
        flatDamage: 1,
        hits: 1,
        hitIndex: 2,
        totalHits: 2,
        source: 'Player',
        sourceId: 'untagged-multi-hit',
        actorType: 'player'
      },
      {
        type: 'damage',
        at: 1,
        name: 'Distinct attack',
        skillName: 'Distinct attack',
        flatDamage: 1,
        source: 'Player',
        sourceId: 'distinct-attack',
        actorType: 'player',
        activationId: 'distinct-activation'
      }
    ],
    rotationEndTime: 1
  });
  const result = resolveTestGw2Stream({
    stream,
    config: {
      target: { health: 1 },
      sigilSets: [{ names: [] }]
    },
    traits: new Set(),
    query: {
      statsAt: () => ({
        power: 1_000,
        precision: 1_000,
        ferocity: 0,
        conditionDamage: 0,
        expertise: 0
      }),
      critical: () => ({ chance: 0, damage: 1.5 }),
      strikeMultiplier: () => 1,
      conditionMultiplier: () => 1,
      conditionDurationMultiplier: () => 1,
      activeWeaponSetAt: () => 1
    },
    helpers: {
      conditionName: (name) => name,
      skillsByName: new Map(),
      weaponStrength: () => 1_000
    }
  });

  assert.deepEqual(
    result.resolvedEvents.filter((event) => event.type === 'damage').map((event) => event.name),
    ['First sibling', 'Second sibling']
  );
});

test('pending damage can kill mid-cast and suppress the current skill packet', () => {
  const stream = buildScheduledEventStream({
    events: [
      {
        type: 'damage',
        at: 89.44,
        name: 'Pending Tick',
        skillName: 'Previous Skill',
        flatDamage: 1,
        source: 'Player',
        sourceId: 'previous-skill',
        activationId: 'previous-activation'
      },
      {
        type: 'damage',
        at: 89.44,
        name: 'Same-Time Follow-up',
        skillName: 'Different Skill',
        flatDamage: 10,
        source: 'Player',
        sourceId: 'different-skill',
        activationId: 'different-activation'
      },
      {
        type: 'damage',
        at: 89.6,
        name: 'Current Skill Hit',
        skillName: 'Current Skill',
        flatDamage: 10,
        source: 'Player',
        sourceId: 'current-skill',
        activationId: 'current-activation'
      }
    ],
    rotationEndTime: 89.6
  });
  const result = resolveTestGw2Stream({
    stream,
    config: {
      target: { health: 1 },
      sigilSets: [{ names: [] }]
    },
    traits: new Set(),
    query: {
      statsAt: () => ({
        power: 1_000,
        precision: 1_000,
        ferocity: 0,
        conditionDamage: 0,
        expertise: 0
      }),
      critical: () => ({ chance: 0, damage: 1.5 }),
      strikeMultiplier: () => 1,
      conditionMultiplier: () => 1,
      conditionDurationMultiplier: () => 1,
      activeWeaponSetAt: () => 1
    },
    helpers: {
      conditionName: (name) => name,
      skillsByName: new Map(),
      weaponStrength: () => 1_000
    }
  });

  assert.equal(result.deathTime, 89.44);
  assert.equal(result.lastHitTime, 89.44);
  assert.deepEqual(
    result.resolvedEvents.filter((event) => event.type === 'damage').map((event) => event.name),
    ['Pending Tick']
  );
});

test('explicit combat start keeps precombat projectiles that land afterward', () => {
  const result = simulateMesmer(
    [
      'Bladecall',
      { name: '__wait', waitMs: 1000 },
      { name: '__combat_start' },
      'Unstable Bladestorm',
      { name: '__wait', waitMs: 4000 }
    ],
    defaultSimulationConfig()
  );
  const bladecallHits = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Bladecall'
  );

  assert.equal(bladecallHits.length, 3);
  assert.ok(
    result.resolvedEvents.some((event) => event.type === 'damage' && event.skillName === 'Unstable Bladestorm')
  );
  assert.ok(result.dpsWindow < result.duration);
});

test('delayed combat start uses its offset instead of the preceding cast end', () => {
  const result = simulateMesmer(
    ['Mind Slash', { name: '__combat_start', offset: 100 }, { name: '__wait', waitMs: 1000 }],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Sword',
      secondaryWeapon: '',
      initialResource: 0
    })
  );

  assert.equal(result.steps[1].start, 100);
  assert.equal(result.combatStartTime, 0.1);
  assert.equal(result.hasExplicitCombatStart, true);
  assert.ok(Math.abs(result.firstHitTime - 0.36) < 1e-12);
  assert.equal(result.dpsStartTime, result.firstHitTime);
  assert.ok(Math.abs(result.dpsWindow - 1) < 1e-12);
  assert.equal(result.dps, result.totalDamage / result.dpsWindow);
  assert.ok(result.dps < 100_000);
});

test('DPS duration starts at the first hit in the supplied delayed-start rotation', () => {
  const result = simulateMesmer(
    ['Phantasmal Swordsman', { name: '__combat_start', offset: 700 }, 'Bladecall'],
    defaultSimulationConfig()
  );

  assert.equal(result.steps[1].start, 700);
  assert.ok(Math.abs(result.firstHitTime - 0.759) < 1e-12);
  assert.ok(Math.abs(result.duration - 1.32) < 1e-12);
  assert.ok(Math.abs(result.dpsWindow - 0.561) < 1e-12);
  assert.equal(result.dps, result.totalDamage / result.dpsWindow);
});

test('standalone Combat Start uses the first subsequent hit like Elementalist', () => {
  const result = simulateMesmer(['__combat_start', 'Phantasmal Swordsman', 'Bladecall'], defaultSimulationConfig());

  assert.equal(result.steps[0].start, 0);
  assert.ok(Math.abs(result.firstHitTime - 0.759) < 1e-12);
  assert.ok(Math.abs(result.duration - 1.32) < 1e-12);
  assert.equal(result.dpsStartTime, result.firstHitTime);
  assert.ok(Math.abs(result.dpsWindow - 0.561) < 1e-12);
  assert.equal(result.dps, result.totalDamage / result.dpsWindow);
});

test('zero-length combat windows report zero DPS instead of epsilon DPS', () => {
  const result = simulateMesmer(
    ['Mind Slash', '__combat_start'],
    defaultSimulationConfig({
      specialization: 'Core',
      primaryWeapon: 'Sword',
      secondaryWeapon: '',
      initialResource: 0
    })
  );

  assert.equal(result.dpsStartTime, result.duration);
  assert.equal(result.dpsWindow, 0);
  assert.equal(result.dps, 0);
});
