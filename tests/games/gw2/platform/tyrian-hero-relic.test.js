/** Minimal casts protect relic eligibility, recipients, boon scaling, and live profession integration. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { RELIC_GROUPS, relicIdForName } from '#gw2/platform/equipment/relics/catalog.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { createRelicRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { migrateGuardianBuild, validateGuardianBuild } from '#gw2/professions/guardian/build/build.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { defineTestProfession } from '#tests/helpers/profession.js';
import { runRanger } from '#tests/helpers/ranger-simulation.js';

const profession = defineTestProfession({
  id: 'tyrian-hero-fixture',
  name: 'Tyrian Hero Fixture',
  catalog: createCanonicalCatalog({
    generated: [
      ...['Shout', 'Command', 'Cantrip'].map((category, index) => ({
        id: 941000 + index,
        name: category,
        categories: [category],
        type: 'Utility',
        castTimeMs: 500,
        effects: []
      })),
      { id: 941003, name: 'Instant Shout', categories: ['Shout'], type: 'Utility', castTimeMs: 0, effects: [] },
      {
        id: 941004,
        name: 'Strike',
        type: 'Weapon',
        weapon: 'Sword',
        castTimeMs: 0,
        effects: [{ type: 'strike', coefficient: 1 }]
      }
    ]
  })
});

const grants = (result) =>
  result.resolvedEvents.filter((event) => event.type === 'buff' && event.sourceId === `relic.${RELIC_IDS.TYRIAN_HERO}`);
const run = (rotation, config = {}) =>
  simulateGw2({
    profession,
    rotation,
    config: { relic: 'Tyrian Hero', attributeInputs: baseAttributeInputs({ concentration: 0 }), ...config }
  });

test('Tyrian Hero is selectable and survives saved-build normalization', () => {
  assert.equal(relicIdForName('Tyrian Hero'), RELIC_IDS.TYRIAN_HERO);
  assert.ok(RELIC_GROUPS.find((group) => group.label === 'Hybrid').items.includes('Tyrian Hero'));
  const build = migrateGuardianBuild(JSON.parse(JSON.stringify({ relic: 'Tyrian Hero' })));
  assert.equal(build.relic, 'Tyrian Hero');
  assert.equal(validateGuardianBuild(build).valid, true);
});

test('Tyrian Hero grants personal Superspeed and five-player boons on either supported category', () => {
  for (const category of ['Shout', 'Command']) {
    const result = run([category, { type: 'wait', durationMs: 1000 }], { allies: { count: 9 } });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      grants(result).map(({ kind, duration, stacks }) => ({ kind, duration, stacks })),
      [
        { kind: 'superspeed', duration: 3, stacks: 1 },
        { kind: 'might', duration: 10, stacks: 2 },
        { kind: 'swiftness', duration: 10, stacks: 1 }
      ]
    );
    for (const event of grants(result)) {
      assert.equal(event.resolvedAudience.includesSelf, true);
      assert.equal(event.resolvedAudience.alliedPlayerCount, event.kind === 'superspeed' ? 0 : 4);
      assert.equal(event.resolvedAudience.recipientCount, event.kind === 'superspeed' ? 1 : 5);
      assert.equal(event.ownerActorType, 'player');
      assert.equal(event.triggeredBy, category);
    }
  }
});

test('Tyrian Hero scales boons with concentration while keeping Superspeed fixed', () => {
  const result = run(['Shout', { type: 'wait', durationMs: 1000 }], {
    attributeInputs: baseAttributeInputs({ concentration: 1500 })
  });
  assert.deepEqual(
    grants(result).map(({ kind, duration }) => ({ kind, duration })),
    [
      { kind: 'superspeed', duration: 3 },
      { kind: 'might', duration: 20 },
      { kind: 'swiftness', duration: 20 }
    ]
  );
});

test('Tyrian Hero ignores interrupted and unrelated casts and has no internal cooldown', () => {
  const result = run([
    { type: 'cast', skillId: 941000, interruptAfterMs: 0 },
    'Cantrip',
    'Instant Shout',
    'Instant Shout',
    { type: 'wait', durationMs: 1000 }
  ]);
  assert.deepEqual(result.warnings, []);
  // Same-time timeline markers coalesce; accepted boon grants must still retain both activations.
  const might = grants(result).filter((event) => event.kind === 'might');
  assert.equal(might.length, 2);
  assert.equal(might[0].at, might[1].at);
  assert.notEqual(might[0].activationId, might[1].activationId);
  assert.ok(grants(result).every((event) => event.triggeredBy === 'Instant Shout'));
});

test('Tyrian Hero requires a player cast with a known eligible skill identity', () => {
  const relic = createRelicRuntime('Tyrian Hero');
  for (const overrides of [
    { actorType: 'summon' },
    { actorType: 'effect', ownerActorType: 'player' },
    { cancelled: true },
    { skillId: 999999 },
    { skillId: undefined }
  ]) {
    const captured = captureEffectEmissions();
    relic.rules.completed({ helpers: profession.catalog, effects: captured.effects }, relic.state, {
      type: 'action',
      at: 0,
      actorType: 'player',
      skillId: 941000,
      skillName: 'Shout',
      ...overrides
    });
    assert.deepEqual(captured.events, []);
    assert.deepEqual(captured.announcements, []);
  }
});

test('Tyrian Hero Might affects damage until it expires', () => {
  const rotation = ['Instant Shout', 'Strike', { type: 'wait', durationMs: 11000 }, 'Strike'];
  const result = run(rotation);
  const baseline = run(rotation, { relic: '' });
  const hits = (simulation) => simulation.resolvedEvents.filter((event) => event.type === 'damage');
  assert.ok(hits(result)[0].damage > hits(baseline)[0].damage);
  assert.equal(hits(result)[1].damage, hits(baseline)[1].damage);
});

test('Tyrian Hero recognizes native Guardian shouts and Ranger commands', () => {
  for (const [simulate, skill] of [
    [runGuardian, '"Hold the Line!"'],
    [runRanger, '"Protect Me!"']
  ]) {
    const result = simulate([skill, { type: 'wait', durationMs: 1000 }], { relic: 'Tyrian Hero' });
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      grants(result).map((event) => event.kind),
      ['superspeed', 'might', 'swiftness']
    );
  }
});
