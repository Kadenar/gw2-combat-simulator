import assert from 'node:assert/strict';
import test from 'node:test';
import { runThief } from '#tests/helpers/thief-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';
import { withSkill, withProfile } from '#tests/helpers/catalog-overrides.js';
import { applyBalanceProfilePatch } from '#gw2/integrations/patches/authoring/patches.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { THIEF_CORE_BALANCE_PROFILE_IDS as PROFILE } from '#gw2/professions/thief/core/profiles.js';

// Variant selection snapshots the chain before completion, but transforms the live, independently editable packets.
test('Falling Spider empowers only the accepted predecessor and preserves effect and tick edits', () => {
  for (const ticks of [false, true]) {
    for (const empowered of [false, true]) {
      const result = runThief(
        [ID.FALLING_SPIDER],
        { primaryWeapon: 'Spear', secondaryWeapon: '' },
        {
          initialize(runtime) {
            runtime.profession.core.spearChainStage = 2;
            runtime.profession.core.spearPreviousSkillId = empowered ? ID.ENTANGLING_ASP : ID.VAMPIRIC_SLASH;
          },
          probes: [
            [
              0.1,
              (runtime) => {
                runtime.profession.core.spearPreviousSkillId = ID.MANTIS_STING;
              }
            ]
          ],
          catalog(catalog) {
            const patched = withProfile(catalog, PROFILE.fallingSpiderEmpowered, {
              damageMultiplier: 1.5,
              resourceGain: 2
            });
            const packet = (effect) =>
              ticks
                ? { type: effect.type, timingAnchor: 'castEnd', ticks: [{ ...effect, atMs: 0 }] }
                : { ...effect, timingAnchor: 'castEnd', atMs: 0 };
            return withSkill(patched, ID.FALLING_SPIDER, {
              effects: [
                packet({ type: 'strike', coefficient: 2 }),
                packet({ type: 'condition', condition: 'Bleeding', stacks: 3, duration: 5 }),
                packet({ type: 'condition', condition: 'Vulnerability', stacks: 4, duration: 6 })
              ]
            });
          }
        }
      );
      assert.deepEqual(result.warnings, []);
      const packets = result.resolvedEvents.filter((event) => event.skillId === ID.FALLING_SPIDER);
      assert.equal(packets.find((event) => event.type === 'damage').coefficient, empowered ? 3 : 2);
      assert.equal(packets.find((event) => event.condition === 'Bleeding').stacks, empowered ? 5 : 3);
      assert.equal(packets.find((event) => event.condition === 'Vulnerability').stacks, 4);
      assert.equal(
        packets.some((event) => event.condition === 'Poisoned'),
        false
      );
      assert.equal(observedRuntime(result).profession.core.spearChainStage, 0);
    }
  }
});

// Patch consumers edit effect timelines directly; removed siblings cannot alter a surviving pulse's observation boundary.
test('Uncatchable honors independent authored pulse timing and component removal', () => {
  for (const removed of ['Bleeding', 'Crippled']) {
    const surviving = removed === 'Bleeding' ? 'Crippled' : 'Bleeding';
    for (const endTimeMs of [1299, 1300]) {
      const result = runThief(
        [ID.DODGE],
        { selectedTraitIds: [TRAIT.UNCATCHABLE] },
        {
          observation: { kind: 'absolute', endTimeMs },
          catalog: (catalog) =>
            applyBalanceProfilePatch(catalog, {
              balanceProfiles: {
                [PROFILE.uncatchable]: {
                  removeEffects: [{ type: 'condition', name: removed }],
                  effects: [{ type: 'condition', name: surviving, intervalMs: { from: 1000, to: 500 } }]
                }
              }
            })
        }
      );
      assert.deepEqual(result.warnings, []);
      const pulses = result.resolvedEvents.filter((event) => event.sourceId === TRAIT.UNCATCHABLE);
      assert.deepEqual(
        pulses.map((event) => event.at),
        endTimeMs === 1299 ? [0.8] : [0.8, 1.3]
      );
      assert.ok(pulses.every((event) => event.condition === surviving && event.actorType === 'player'));
      assert.ok(pulses.every((event) => event.skillId === ID.LESSER_CALTROPS && event.triggeredBy === 'Dodge'));
      assert.ok(pulses.every((event) => event.activationId === result.steps[0].activationId));
    }
  }
});

// Mark rewards belong after same-time cast packets, even though shared materialization creates their boon packets.
test('Deadeye trait boons remain behind deferred completion and retain attribution', () => {
  const before = [];
  const result = runThief(
    [ID.DEADEYES_MARK],
    { specialization: 'Deadeye', selectedTraitIds: [TRAIT.BE_QUICK_OR_BE_KILLED] },
    {
      extend: (native) => ({
        onCastComplete(runtime, cast) {
          native.onCastComplete(runtime, cast);
          runtime.schedule('test.before-completion', runtime.time, undefined, undefined, 10);
        },
        tasks: {
          ...native.tasks,
          'test.before-completion': (runtime) =>
            before.push(runtime.history.some((event) => event.sourceId === 'thief.deadeye.be-quick-or-be-killed'))
        }
      })
    }
  );
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(before, [false]);
  const boon = result.resolvedEvents.find((event) => event.sourceId === 'thief.deadeye.be-quick-or-be-killed');
  assert.ok(boon);
  assert.equal(boon.kind, 'quickness');
  assert.equal(boon.actorType, 'player');
  assert.equal(boon.activationId, result.steps[0].activationId);
  assert.equal(boon.skillId, ID.DEADEYES_MARK);
  assert.equal(boon.resolvedAudience.includesSelf, true);
  assert.equal(boon.resolvedAudience.alliedPlayerCount, 0);
});

// Dodge's declaration owns its base payload; the profession must not silently discard an authored addition.
test('Core Dodge emits its authored effects without a skill-id suppression hook', () => {
  const result = runThief(
    [ID.DODGE],
    {},
    {
      catalog: (catalog) =>
        withSkill(catalog, ID.DODGE, { effects: [{ type: 'boon', boon: 'vigor', duration: 3, stacks: 1 }] })
    }
  );
  assert.deepEqual(result.warnings, []);
  const buffs = result.resolvedEvents.filter((event) => event.kind === 'vigor' && event.skillId === ID.DODGE);
  assert.equal(buffs.length, 1);
  assert.equal(buffs[0].duration, 3);
});
