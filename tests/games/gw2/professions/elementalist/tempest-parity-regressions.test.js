import { runNative } from '#tests/helpers/elementalist-simulation.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { createScheduler } from '#gw2/platform/execution/scheduler.js';
import { createGw2SchedulerPolicy } from '#gw2/platform/execution/gw2-policy/policy.js';
import { gw2CooldownReadyAt } from '#gw2/platform/skills/timing.js';
import {
  ELEMENTALIST_ATTUNEMENT_SKILL_IDS,
  ELEMENTALIST_OVERLOAD_SKILL_IDS
} from '#gw2/professions/elementalist/data/ids.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadProfessionAppAdapter } from '#gw2/app/profession-registry.js';

const repoUrl = (path) => new URL(`../../../../../${path}`, import.meta.url);

// Each overload and its attunement must retain identical recharge progress as temporary Alacrity changes.
test('Tempest attunement lockouts follow overload recharge through temporary Alacrity', () => {
  for (const element of ['Fire', 'Water', 'Air', 'Earth']) {
    const config = { specialization: 'Tempest', startAttunement: element, boons: {} };
    const scheduler = createScheduler({
      profession: elementalistProfession,
      config,
      schedulerPolicy: createGw2SchedulerPolicy(config)
    });
    const grantAlacrity = (at, duration) =>
      scheduler.context.emit({
        type: 'buff',
        kind: 'alacrity',
        at,
        duration,
        stacks: 1,
        source: 'fixture',
        sourceId: 'fixture',
        actorType: 'player'
      });
    const overloadId = ELEMENTALIST_OVERLOAD_SKILL_IDS[element];
    const attunementId = ELEMENTALIST_ATTUNEMENT_SKILL_IDS[element];
    scheduler.run(['__combat_start']);
    scheduler.advanceTo(5);
    grantAlacrity(5, 8);
    assert.equal(scheduler.cast({ type: 'cast', skillId: overloadId }), true);
    scheduler.advanceTo(scheduler.events.findLast((event) => event.type === 'action').endsAt);
    const readyAt = scheduler.state.cooldowns.get(overloadId);
    assert.equal(scheduler.state.cooldowns.get(attunementId), readyAt, element);
    assert.equal(scheduler.state.profession.core.attunementReadyAt[element], readyAt, element);

    scheduler.advanceTo(14);
    grantAlacrity(14, 4);
    scheduler.advanceTo(14);
    const updatedReadyAt = scheduler.state.cooldowns.get(overloadId);
    assert.ok(updatedReadyAt < readyAt, element);
    assert.equal(scheduler.state.cooldowns.get(attunementId), updatedReadyAt, element);
    const other = element === 'Fire' ? 'Water' : 'Fire';
    assert.equal(scheduler.cast({ type: 'cast', skillId: ELEMENTALIST_ATTUNEMENT_SKILL_IDS[other] }), true);
    assert.equal(scheduler.cast({ type: 'cast', skillId: attunementId }), true);
    assert.equal(
      scheduler.events.findLast((event) => event.type === 'action').at,
      gw2CooldownReadyAt(updatedReadyAt),
      element
    );
    assert.deepEqual(scheduler.warnings, []);
  }
});

// Completing an overload must not replace a longer attunement recharge already in progress.
test('Tempest overload completion preserves a longer attunement lockout', () => {
  const config = { specialization: 'Tempest', startAttunement: 'Fire', boons: {} };
  const scheduler = createScheduler({
    profession: elementalistProfession,
    config,
    schedulerPolicy: createGw2SchedulerPolicy(config)
  });
  const attunementId = ELEMENTALIST_ATTUNEMENT_SKILL_IDS.Fire;
  const attunement = scheduler.context.catalog.skillsById.get(attunementId);
  scheduler.context.cooldownController.startRecharge(attunement, 0, 60);
  assert.equal(scheduler.cast({ type: 'cast', skillId: ELEMENTALIST_OVERLOAD_SKILL_IDS.Fire }), true);
  scheduler.advanceTo(scheduler.events.findLast((event) => event.type === 'action').endsAt);
  assert.equal(scheduler.state.cooldowns.get(attunementId), 60);
  assert.equal(scheduler.state.profession.core.attunementReadyAt.Fire, 60);
  assert.deepEqual(scheduler.state.rechargeProgress.get(attunementId), { startedAt: 0, work: 60 });
  assert.deepEqual(scheduler.warnings, []);
});

// A two-skill rotation isolates the instant-cast scheduling rule without
// depending on the composition or indices of a saved full rotation.
test('delayed Tempest shouts do not advance the serial rotation lane', async () => {
  const [savedBuild, adapter] = await Promise.all([
    readFile(repoUrl('data/gw2/builds/elementalist/b-condi-alac-tempest-pistol.json'), 'utf8').then(JSON.parse),
    loadProfessionAppAdapter('elementalist')
  ]);
  const build = adapter.toApplicationBuild({
    ...savedBuild,
    rotation: ['Feel the Burn!', 'Scorching Shot']
  });
  const app = {
    build,
    adapter,
    profession: adapter.profession,
    skillByName: adapter.profession.catalog.skillsByName,
    skillById: adapter.profession.catalog.skillsById,
    attributeWeaponSet: 1
  };

  adapter.recalculate(app);
  const result = adapter.runSimulation(app);
  const [shout, followingSerialCast] = result.steps;

  assert.equal(shout.skill, 'Feel the Burn!');
  assert.equal(followingSerialCast.skill, 'Scorching Shot');
  assert.equal(shout.start, shout.end);
  assert.equal(followingSerialCast.start, shout.start);
  assert.equal(
    result.warnings.some((warning) => warning.includes('Feel the Burn!')),
    false
  );
});

test('Alacrity shortens overload dwell and Lucid Singularity follows hit timing', () => {
  const simulate = (alacrity) =>
    runNative({
      lines: [['Fire'], ['Air'], ['Tempest', '1-2-2']],
      rotation: [1000, 'Fire Attunement', 'Overload Fire'],
      startAttunement: 'Air',
      assumptions: { ...elementalistProfession.createBuildDefaults().assumptions, alacrity }
    });
  const result = simulate(true);
  const baseline = simulate(false);

  const attunement = result.events.find((event) => event.type === 'elementalist.attunement' && event.to === 'Fire');
  const overload = result.events.find((event) => event.type === 'action' && event.skillName === 'Overload Fire');
  const alacrity = result.events.filter((event) => event.type === 'buff' && event.source === 'Lucid Singularity');

  const baseEntry = baseline.events.find((event) => event.type === 'elementalist.attunement' && event.to === 'Fire');
  const baseOverload = baseline.events.find((event) => event.type === 'action' && event.skillName === 'Overload Fire');
  // Dwell scales with Alacrity; the trait follows overload hits and rewards completion.
  assert.ok(Math.abs(overload.at - attunement.at - (baseOverload.at - baseEntry.at) / 1.25) < 0.001);
  const hits = result.events.filter((event) => event.type === 'damage' && event.skillName === 'Overload Fire');
  assert.ok(alacrity.length > 1);
  assert.ok(alacrity.every((buff) => hits.some((hit) => hit.at === buff.at) || buff.at === overload.endsAt));
  assert.ok(alacrity.at(-1).duration > alacrity[0].duration);
});

test('Tempest always starts with its initial overload available', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '3-2-1']],
    rotation: ['Overload Air'],
    startAttunement: 'Air'
  });
  const overload = result.events.find((event) => event.type === 'action' && event.skillName === 'Overload Air');

  assert.equal(overload.at, 0);
});

test('Transcendent Tempest precedes same-time Overload completion damage', () => {
  const withTrait = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '3-2-1']],
    rotation: ['Overload Air'],
    startAttunement: 'Air'
  });
  const withoutTrait = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '3-2-2']],
    rotation: ['Overload Air'],
    startAttunement: 'Air'
  });
  const action = withTrait.events.find((event) => event.type === 'action' && event.skillName === 'Overload Air');
  const buff = withTrait.events.find((event) => event.type === 'buff' && event.kind === 'transcendent-tempest');
  const damageAtCompletion = (result, name) =>
    result.resolvedEvents
      .filter((event) => event.type === 'damage' && event.skillName === name)
      .sort((left, right) => left.at - right.at)
      .at(-1);
  const finalWithTrait = damageAtCompletion(withTrait, 'Overload Air');
  const finalWithoutTrait = damageAtCompletion(withoutTrait, 'Overload Air');
  const joltWithTrait = damageAtCompletion(withTrait, 'Lightning Jolt');
  const joltWithoutTrait = damageAtCompletion(withoutTrait, 'Lightning Jolt');
  const completionOrder = withTrait.events
    .filter((event) => Math.abs(event.at - action.endsAt) < 0.0001)
    .map((event) => event.kind || event.skillName);

  assert.equal(buff.at, action.endsAt);
  assert.ok(completionOrder.indexOf('transcendent-tempest') < completionOrder.indexOf('Lightning Jolt'));
  assert.equal(finalWithTrait.damage, finalWithoutTrait.damage);
  assert.ok(joltWithTrait.damage > joltWithoutTrait.damage);
});

test('Overload Air grants separate non-critical Lightning Jolts to the player and active elemental', () => {
  const result = runNative({
    lines: [['Fire'], ['Air'], ['Tempest', '3-2-1']],
    rotation: ['Glyph of Elementals', 'Overload Air', 10000],
    startAttunement: 'Air',
    targetHealth: 0
  });
  const jolts = result.resolvedEvents.filter(
    (event) => event.type === 'damage' && event.skillName === 'Lightning Jolt'
  );
  const playerJolt = jolts.find((event) => event.actorType === 'effect');
  const elementalJolt = jolts.find((event) => event.actorType === 'summon');
  const triggeringElementalStrike = result.resolvedEvents.find(
    (event) =>
      event.type === 'damage' &&
      event.actorType === 'summon' &&
      event.skillName !== 'Lightning Jolt' &&
      event.at === elementalJolt?.at
  );

  assert.equal(jolts.length, 2);
  assert.equal(playerJolt.weaponStrengthProfileId, 'nonweapon.unequipped');
  assert.equal(playerJolt.criticalChance, 0);
  assert.equal(elementalJolt.weaponStrengthProfileId, playerJolt.weaponStrengthProfileId);
  assert.equal(elementalJolt.criticalChance, 0);
  assert.equal(elementalJolt.independentSummonStrike, true);
  assert.equal(elementalJolt.summonUsesMight, false);
  assert.equal(elementalJolt.summonUsesProfessionModifiers, false);
  assert.ok(elementalJolt.at > playerJolt.at);
  assert.ok(triggeringElementalStrike);
});
