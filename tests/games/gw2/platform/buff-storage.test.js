import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { GW2_STANDARD_BOONS, isStandardBoon, recordBuffApplication } from '#gw2/platform/combat/boons.js';
import {
  activeBoonStacks,
  activeBuffStacks,
  boonActive,
  countActiveBoons
} from '#gw2/platform/combat/query/runtime-query.js';
import { createGw2TimelineIndex } from '#gw2/platform/combat-calculation/timeline-index.js';
import { createMechanicCombatServices } from '#gw2/platform/resolver/mechanic-services.js';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { defineTestProfession } from '#tests/helpers/profession.js';
import { observeGw2Runtime, observedRuntime } from '#tests/helpers/observed-runtime.js';
import { captureAcceptedBuffEmissions } from '#tests/helpers/effect-emission.js';
import { replaceThiefBuff } from '#gw2/professions/thief/core/mechanics/buffs.js';
import { recordTimedBuffProc } from '#gw2/platform/equipment/relics/rules/shared.js';
import { RELIC_IDS } from '#gw2/platform/equipment/relics/data.js';

const custom = ['superspeed', 'relic-peitha', 'sigil-severance', 'fixture-buff'];
const profession = defineTestProfession({
  id: 'buff-storage-fixture',
  name: 'Buff storage fixture',
  catalog: createCanonicalCatalog(),
  hooks: {
    buffPolicies: () => custom.filter((kind) => kind !== 'superspeed').map((kind) => ({ kind, maximumStacks: 1 }))
  }
});
const packet = (kind, overrides = {}) => ({
  type: 'buff',
  kind,
  at: 0,
  duration: 2,
  stacks: 1,
  source: 'Fixture',
  sourceId: 'fixture',
  actorType: 'player',
  audience: { recipients: 'self' },
  ...overrides
});

// Exercise actual admission, duration preparation and reaction visibility in both runtime output modes.
for (const output of ['detailed', 'score'])
  test(`accepted stores are exclusive and boon scaling stays isolated (${output})`, () => {
    const seen = [];
    const native = profession.runtimeFor();
    const result = observeGw2Runtime({
      profession: {
        ...native,
        reactions: {
          'buff.applied'(runtime, event) {
            const boon = isStandardBoon(event.kind);
            assert.equal(runtime.combat.boonApplications(event.kind).length > 0, boon);
            assert.equal(runtime.combat.buffApplications(event.kind).length > 0, !boon);
            seen.push(event.kind);
          }
        }
      },
      config: { attributeInputs: baseAttributeInputs({ concentration: 1500 }), target: { health: 0 } },
      output,
      rotation: [{ type: 'wait', durationMs: 1000 }],
      engineInitialize(runtime) {
        for (const kind of [...GW2_STANDARD_BOONS, ...custom])
          runtime.effects.emit({ kind: 'packet', event: packet(kind) });
        runtime.effects.emit({
          kind: 'packet',
          event: { ...packet(''), type: 'boon_extension', at: 0.5, duration: 1 }
        });
      }
    });
    const runtime = observedRuntime(result);
    assert.deepEqual(new Set(seen), new Set([...GW2_STANDARD_BOONS, ...custom]));
    assert.deepEqual([...runtime.boons.keys()], [...GW2_STANDARD_BOONS]);
    assert.deepEqual([...runtime.buffs.keys()], custom);
    for (const kind of custom) {
      assert.equal(runtime.buffs.get(kind)[0].expiresAt, 2);
      assert.equal(runtime.combat.activeBuffStacks(kind, 1, 1), 1);
      assert.deepEqual(runtime.combat.boonSnapshot(kind, 1, { actor: 'player' }), { stacks: 0, duration: 0 });
    }

    assert.equal(runtime.combat.boonSnapshot('fury', 1, { actor: 'player' }).duration, 4);
    assert.equal(countActiveBoons({ runtime, time: 1 }), 12);
    assert.deepEqual(result.warnings ?? [], []);
  });

test('live empty stores never borrow scheduled grants or non-boon configuration', () => {
  const buff = packet('superspeed', {
    resolvedAudience: {
      includesSelf: true,
      includesSummons: false,
      alliedPlayerCount: 0,
      companionIds: [],
      recipientCount: 1
    }
  });
  const context = {
    time: 0,
    config: { boons: { superspeed: true } },
    timeline: createGw2TimelineIndex({ events: [buff] })
  };
  assert.equal(activeBuffStacks(context, 'superspeed', 1), 1);
  const runtime = { boons: new Map(), buffs: new Map() };
  assert.equal(activeBuffStacks({ ...context, runtime }, 'superspeed', 1), 0);
  recordBuffApplication(runtime.buffs, { ...buff, resolvedAudience: { includesSelf: true } });
  assert.equal(activeBuffStacks({ ...context, runtime }, 'superspeed', 1), 1);
  assert.equal(activeBoonStacks({ ...context, runtime }, 'superspeed'), 0);
  assert.equal(boonActive({ ...context, runtime }, 'superspeed'), false);
  assert.equal(countActiveBoons({ ...context, runtime }), 0);
  assert.equal(activeBuffStacks({ ...context, runtime, time: 2 }, 'superspeed'), 0);
});

test('buff expiry revisions preserve historical intervals and select only the consumed recipient', () => {
  const runtime = { config: {}, boons: new Map(), buffs: new Map() };
  const combat = createMechanicCombatServices(runtime);
  for (const includesSelf of [true, false])
    recordBuffApplication(runtime.buffs, {
      ...packet('fixture-buff', { duration: 10 }),
      resolvedAudience: { includesSelf, includesSummons: !includesSelf, companionIds: includesSelf ? [] : ['pet'] }
    });
  combat.reviseBuffExpiry(
    'fixture-buff',
    (application) => application.resolvedAudience.includesSelf,
    () => 2
  );
  assert.equal(combat.activeBuffStacks('fixture-buff', 1, 1), 1);
  assert.equal(combat.activeBuffStacks('fixture-buff', 2, 1), 0);
  assert.equal(combat.buffApplications('fixture-buff')[1].expiresAt, 10);
  assert.deepEqual(combat.boonApplications('fixture-buff'), []);
});

test('reaction-settled buffs use ordinary acceptance and remain visible in executed history', () => {
  let runtime;
  const result = observeGw2Runtime({
    profession: profession.runtimeFor(),
    config: { target: { health: 0 } },
    rotation: [{ type: 'wait', durationMs: 1000 }],
    engineInitialize(owner) {
      runtime = owner;
      owner.effects.emit({ kind: 'packet', settlement: 'reaction', event: packet('fixture-buff') });
      assert.equal(owner.combat.activeBuffStacks('fixture-buff', owner.time, 1), 1);
    }
  });
  assert.equal(result.events.filter((event) => event.kind === 'fixture-buff').length, 1);
  assert.equal(runtime.buffs.get('fixture-buff').length, 1);
  assert.equal(runtime.boons.has('fixture-buff'), false);
});

test('replacement and overlapping refresh windows retain their distinct historical semantics', () => {
  const runtime = { ...captureAcceptedBuffEmissions(), config: {}, time: 0 };
  runtime.combat = createMechanicCombatServices(runtime);
  replaceThiefBuff(runtime, 'fluid-strikes', 10, 'fixture', 'Fluid Strikes', 'Trait');
  runtime.time = 1;
  replaceThiefBuff(runtime, 'fluid-strikes', 2, 'fixture', 'Fluid Strikes', 'Trait');
  assert.equal(runtime.combat.activeBuffStacks('fluid-strikes', 0.5, 1), 1);
  assert.equal(runtime.combat.activeBuffStacks('fluid-strikes', 2.999999, 1), 1);
  assert.equal(runtime.combat.activeBuffStacks('fluid-strikes', 3, 1), 0);
  assert.equal(runtime.combat.activeBuffStacks('fluid-strikes', 5, 1), 0, 'an older window cannot revive');

  for (const [at, duration] of [
    [0, 10],
    [1, 2]
  ])
    recordTimedBuffProc(
      runtime,
      { at },
      {
        relicId: RELIC_IDS.CLAW,
        kind: 'relic-claw',
        name: 'Relic of the Claw',
        duration
      }
    );
  assert.equal(runtime.combat.activeBuffStacks('relic-claw', 5, 1), 1, 'Claw retains the longer overlapping grant');
  assert.equal(runtime.combat.activeBuffStacks('relic-claw', 10, 1), 0);
});
