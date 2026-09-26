import { runNative } from '#tests/helpers/elementalist-simulation.js';
import { elementalistProfession } from '#gw2/professions/elementalist/profession.js';
import { runElementalist } from '#tests/helpers/elementalist-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
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

// Overload and attunement hold the same remaining work as actual Alacrity applications change.
test('Tempest attunement lockouts follow overload recharge through temporary Alacrity', () => {
  for (const element of ['Fire', 'Water', 'Air', 'Earth']) {
    const overloadId = ELEMENTALIST_OVERLOAD_SKILL_IDS[element],
      attunementId = ELEMENTALIST_ATTUNEMENT_SKILL_IDS[element];
    const other = element === 'Fire' ? 'Water' : 'Fire';
    let first, second;
    const grant = (at, duration) => ({
      at,
      run: (runtime) =>
        runtime.emit({
          type: 'buff',
          kind: 'alacrity',
          at,
          duration,
          stacks: 1,
          source: 'fixture',
          sourceId: 'fixture',
          actorType: 'player'
        })
    });
    const result = runElementalist({
      config: { specialization: 'Tempest', startAttunement: element, boons: {} },
      rotation: [
        '__combat_start',
        { type: 'wait', durationMs: 5000 },
        overloadId,
        { type: 'wait', durationMs: 6000 },
        ELEMENTALIST_ATTUNEMENT_SKILL_IDS[other],
        attunementId
      ],
      timeline: [
        grant(5, 8),
        {
          at: 10,
          run: (r) => {
            first = r.cooldowns.get(overloadId);
            assert.equal(r.cooldowns.get(attunementId), first, element);
          }
        },
        grant(14, 4),
        {
          at: 14.001,
          run: (r) => {
            second = r.cooldowns.get(overloadId);
            assert.equal(r.cooldowns.get(attunementId), second, element);
          }
        }
      ]
    });
    assert.deepEqual(result.warnings, []);
    assert.ok(second < first, element);
    assert.equal(result.events.findLast((e) => e.type === 'action').at, gw2CooldownReadyAt(second));
  }
});

// A completed overload cannot shorten a longer recharge already owned by the attunement.
test('Tempest overload completion preserves a longer attunement lockout', () => {
  const id = ELEMENTALIST_ATTUNEMENT_SKILL_IDS.Fire;
  const result = runElementalist({
    config: { specialization: 'Tempest', startAttunement: 'Fire', boons: {} },
    rotation: [ELEMENTALIST_OVERLOAD_SKILL_IDS.Fire],
    initialize: (r) => r.cooldownController.startRecharge(r.helpers.skillsById.get(id), 0, 60)
  });
  assert.deepEqual(result.warnings, []);
  assert.equal(observedRuntime(result).cooldowns.get(id), 60);
  assert.deepEqual(observedRuntime(result).rechargeProgress.get(id), { startedAt: 0, work: 60 });
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
  const result = runElementalist({ config: adapter.simulationConfig(app), rotation: build.rotation });
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
