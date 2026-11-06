/** Minimal grants protect Herald's ownership, shared expiry, and concentration-to-boon-duration contracts. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { baseAttributeInputs } from '#gw2/platform/attributes/inputs.js';
import { gw2BoonApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { RELIC_GROUPS, relicIdForName } from '#gw2/platform/equipment/relics/catalog.js';
import { RELIC_DATA, RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';
import { relicConcentrationBonus } from '#gw2/platform/equipment/relics/query.js';
import { createRelicRuntime } from '#gw2/platform/equipment/relics/runtime.js';
import { effectStateAt } from '#gw2/platform/results/effect-report.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { migrateGuardianBuild, validateGuardianBuild } from '#gw2/professions/guardian/build/build.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { defineTestProfession } from '#tests/helpers/profession.js';

const boon = (at, overrides = {}) => ({
  type: 'buff',
  at,
  actorType: 'player',
  kind: 'might',
  stacks: 1,
  duration: 6,
  source: 'Fixture',
  sourceId: 941100,
  skillName: 'Fixture Boon',
  ...overrides
});

function fixture() {
  const context = { ...captureEffectEmissions(), relic: createRelicRuntime('Herald'), config: {} };
  return {
    ...context,
    grant(at, overrides = {}) {
      const event = boon(at, overrides);
      context.relic.rules.boon(context, context.relic.state, {
        ...event,
        resolvedAudience: gw2BoonApplicationRecipients({ allies: { count: 4 } }, event)
      });
    },
    concentration: (at) => relicConcentrationBonus(context, at)
  };
}

test('Herald is selectable with no cooldown and survives saved-build normalization', () => {
  assert.equal(relicIdForName('Herald'), RELIC_IDS.HERALD);
  assert.equal(RELIC_DATA.Herald.cooldown, 0);
  assert.ok(RELIC_GROUPS.some((group) => group.items.includes('Herald')));
  const build = migrateGuardianBuild(JSON.parse(JSON.stringify({ relic: 'Herald' })));
  assert.equal(build.relic, 'Herald');
  assert.equal(validateGuardianBuild(build).valid, true);
  assert.equal(relicConcentrationBonus({ config: {} }, 0), 0);
});

test('Herald accepts simultaneous applications, caps at 250 concentration, and refreshes every stack at cap', () => {
  const context = fixture();
  for (let index = 0; index < 11; index += 1) context.grant(0);
  assert.equal(context.concentration(0), 250);
  assert.equal(context.announcements.length, 11, 'same-time applications have no ICD');
  context.grant(2);
  assert.equal(context.concentration(4.999999), 250);
  assert.equal(context.concentration(5), 0);
  assert.deepEqual(context.announcements.at(-1).announcement.effectState, { stacks: 10, maximumStacks: 10 });
  assert.equal(context.announcements.at(-1).announcement.expiresAt, 5);
  context.grant(5);
  assert.equal(context.concentration(5), 25, 'an application at expiry starts a new pool');
  const before = structuredClone(context.relic.state);
  assert.equal(context.concentration(1), 250, 'later grants do not replace earlier observations');
  assert.equal(context.concentration(-0.000001), 0);
  assert.deepEqual(context.relic.state, before, 'attribute queries do not mutate stacks');
});

test('Herald refreshes a partial pool and does not scale its three-second lifetime with boon duration', () => {
  const context = fixture();
  context.grant(0, { duration: 60 });
  context.grant(2, { duration: 60 });
  assert.equal(context.concentration(3), 50);
  assert.equal(context.concentration(5), 0);
  context.grant(5);
  context.grant(8);
  assert.equal(context.concentration(8), 25, 'three-second pulses cannot sustain the previous pool');
});

test('Herald accepts self, ally-only, and player-owned effect boons but excludes companion and external grants', () => {
  const context = fixture();
  context.grant(0);
  context.grant(0, { audience: { recipients: 'party', affectsSelf: false, maximumRecipients: 5 } });
  context.grant(0, { actorType: 'effect', ownerActorType: 'player' });
  assert.equal(context.concentration(0), 75);
  for (const overrides of [
    { actorType: 'summon', ownerActorType: 'player', summonKind: 'pet' },
    { actorType: 'summon', ownerActorType: 'player', summonKind: 'minion' },
    { actorType: 'effect' },
    { actorType: 'ally' },
    { actorType: 'unknown' },
    { kind: 'superspeed' },
    { type: 'boon_extension' },
    { duration: 0 },
    { stacks: 0 },
    { cancelled: true },
    { audience: { recipients: 'self', affectsSelf: false } }
  ])
    context.grant(1, overrides);
  assert.equal(context.concentration(1), 75);
  assert.equal(context.concentration(3), 0, 'ineligible grants cannot refresh the pool');
});

// Real resolution must scale a boon before its reaction earns concentration, including successive same-time grants.
function simulateGrants(grants, config = {}) {
  const profession = defineTestProfession({
    id: 'herald-fixture',
    name: 'Herald Fixture',
    catalog: createCanonicalCatalog(),
    hooks: {
      initialize(context) {
        for (const event of grants) context.effects.emit({ kind: 'packet', event });
      }
    }
  });
  return simulateGw2({
    profession,
    rotation: [{ type: 'wait', durationMs: 10000 }],
    config: { relic: 'Herald', attributeInputs: baseAttributeInputs({ concentration: 0 }), ...config }
  });
}

test('live Herald concentration scales subsequent player and companion boons without companion stack claims', () => {
  const result = simulateGrants([
    boon(0),
    boon(0),
    boon(1, { actorType: 'summon', ownerActorType: 'player', summonKind: 'pet', summonOwner: 'fixture-pet' }),
    boon(2, { actorType: 'summon', ownerActorType: 'player', summonKind: 'minion', summonOwner: 'fixture-minion' }),
    boon(3)
  ]);
  assert.deepEqual(result.warnings, []);
  const grants = result.resolvedEvents.filter((event) => event.type === 'buff' && event.kind === 'might');
  assert.deepEqual(
    grants.map((event) => event.duration),
    [6, 6.1, 6.2, 6.2, 6]
  );
});

test('Herald concentration respects the normal boon-duration cap and fixed-duration grants', () => {
  const result = simulateGrants([boon(0), boon(1), boon(2, { fixedDuration: true })], {
    attributeInputs: baseAttributeInputs({ concentration: 1500 })
  });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(
    result.resolvedEvents
      .filter((event) => event.type === 'buff' && event.kind === 'might')
      .map((event) => event.duration),
    [12, 12, 6]
  );
});

test('Herald reports refreshed stacks until their shared expiry', () => {
  const result = simulateGrants([boon(0), boon(2)]);
  const track = result.effectReport.tracks.find((entry) => entry.name === 'Relic of the Herald');
  assert.ok(track);
  assert.equal(effectStateAt(result.effectReport, track, 1).count, 1);
  assert.equal(effectStateAt(result.effectReport, track, 3).count, 2);
  assert.equal(effectStateAt(result.effectReport, track, 5).count, 0);
});
