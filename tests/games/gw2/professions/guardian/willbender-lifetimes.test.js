import assert from 'node:assert/strict';
import test from 'node:test';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { boonApplicationsAt } from '#gw2/platform/combat/boons.js';
import { GUARDIAN_SKILL_IDS as ID, GUARDIAN_TRAIT_IDS as TRAIT } from '#gw2/professions/guardian/data/ids.js';
import { bindWillbenderUi } from '#gw2/professions/guardian/specializations/willbender/presentation.js';
import { runGuardian } from '#tests/helpers/guardian-simulation.js';
import { observedRuntime } from '#tests/helpers/observed-runtime.js';

const ui = bindWillbenderUi(guardianCatalog);
const config = { specialization: 'Willbender' };
const wait = (durationMs) => ({ type: 'wait', durationMs });
const virtues = [
  ['justice', ID.RUSHING_JUSTICE],
  ['resolve', ID.FLOWING_RESOLVE],
  ['courage', ID.CRASHING_COURAGE]
];
const state = (result) => observedRuntime(result).profession.specialization.state;
const strike = (runtime, at) =>
  runtime.emit({
    type: 'damage',
    at,
    source: 'guardian',
    sourceId: ID.ORB_OF_WRATH,
    skillId: ID.ORB_OF_WRATH,
    actorType: 'player',
    coefficient: 1,
    weaponStrengthProfileId: 'weapon.scepter'
  });

// Exercise actual hit delivery and state projections at inclusive virtue deadlines.
test('Willbender virtue deadlines agree across delivered buffs and canonical snapshots for off-grid grants', () => {
  for (const [virtue, skill] of virtues) {
    for (const selectedTraitIds of [[], [TRAIT.TYRANTS_MOMENTUM]]) {
      const result = runGuardian([wait(1), skill, wait(11000)], { ...config, selectedTraitIds });
      assert.deepEqual(result.warnings, []);
      const activation = result.events.find((event) => event.kind === `willbender-${virtue}`);
      const [buff] = boonApplicationsAt(result.events, `willbender-${virtue}`, activation.at);
      assert.ok(buff.expiresAt > activation.at + activation.duration);
      assert.equal(result.planningState.profession[`${virtue}Until`], buff.expiresAt);
      assert.equal(state(result)[`${virtue}Until`], buff.expiresAt);
    }
  }
});

test('virtue hit cycles include expiry, exclude later hits, and never arm from the zero deadline sentinel', () => {
  for (const at of [0, 9.999999, 10, 10.000001]) {
    const result = runGuardian([wait(11000)], config, (runtime) => {
      const state = runtime.profession.specialization.state;
      for (const [virtue] of virtues) {
        state[`${virtue}Until`] = at === 0 ? 0 : 10;
        state.virtueHitCounts[virtue] = 4;
      }

      strike(runtime, at);
    });
    const eligible = at > 0 && at <= 10;
    assert.equal(state(result).triggeredVirtueEffects, eligible ? 3 : 0);
    for (const [virtue] of virtues) assert.equal(state(result).virtueHitCounts[virtue], eligible ? 0 : 4);
  }
});

test('virtue reactivation preserves partial hit progress across expiry gaps', () => {
  for (const [virtue, skillId] of virtues) {
    for (const at of [9.999999, 10, 10.000001, 20]) {
      const result = runGuardian([wait(at * 1000), { skillId, offTarget: true }, wait(1000)], config, (runtime) => {
        const state = runtime.profession.specialization.state;
        state[`${virtue}Until`] = 10;
        state.virtueHitCounts[virtue] = 4;
        strike(runtime, at + 0.9);
      });
      assert.deepEqual(result.warnings, []);
      assert.equal(state(result).triggeredVirtueEffects, 1);
      assert.equal(state(result).virtueHitCounts[virtue], 0);
    }
  }
});

test('Lethal Tempo activation and trigger grants share the buff-history and display deadline', () => {
  for (const at of [0.001, 6.040001]) {
    for (const trigger of [false, true]) {
      const result = runGuardian(
        trigger ? [wait((at + 0.1) * 1000)] : [wait(at * 1000), ID.FLOWING_RESOLVE],
        config,
        (runtime) => {
          if (!trigger) return;
          runtime.profession.specialization.state.resolveUntil = 10;
          runtime.profession.specialization.state.virtueHitCounts.resolve = 4;
          strike(runtime, at);
        }
      );
      const application = result.events.find((event) => event.kind === 'lethal-tempo');
      const [buff] = boonApplicationsAt(result.events, 'lethal-tempo', application.at);
      assert.equal(state(result).lethalTempoUntil, buff.expiresAt);
      for (const atSeconds of [buff.expiresAt, buff.expiresAt + 0.000001]) {
        const items = ui.rotationStateSnapshot({
          catalog: guardianCatalog,
          professionState: result.planningState.profession,
          atSeconds
        });
        assert.equal(
          items.some((item) => item.id === 'willbender-lethal-tempo'),
          atSeconds === buff.expiresAt
        );
      }
    }
  }
});

test('virtue snapshots include the expiry instant without showing never-activated windows', () => {
  const empty = runGuardian([], config);
  assert.deepEqual(
    ui.rotationStateSnapshot({
      catalog: guardianCatalog,
      professionState: empty.planningState.profession,
      atSeconds: 0
    }),
    []
  );
  const result = runGuardian([], config, (runtime) => {
    for (const [virtue] of virtues) runtime.profession.specialization.state[`${virtue}Until`] = 10;
  });
  for (const atSeconds of [9.999999, 10, 10.000001]) {
    const items = ui.rotationStateSnapshot({
      catalog: guardianCatalog,
      professionState: result.planningState.profession,
      atSeconds
    });
    assert.equal(items.length, atSeconds <= 10 ? 3 : 0);
  }
});
