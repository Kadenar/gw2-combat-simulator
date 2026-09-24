import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { boonApplicationsAt, normalizeBoonDuration } from '#gw2/platform/combat/boons.js';
import { gw2BuffApplicationRecipients } from '#gw2/platform/combat/state/allied-players.js';
import { guardianProfession } from '#gw2/professions/guardian/profession.js';
import { GUARDIAN_TRAIT_IDS } from '#gw2/professions/guardian/data/ids.js';
import { willbenderSkillHandlers } from '#gw2/professions/guardian/specializations/willbender/execution/virtues.js';
import { willbenderEventHandlers } from '#gw2/professions/guardian/specializations/willbender/mechanics/virtue-effects.js';
import { willbenderSchedulerHooks } from '#gw2/professions/guardian/specializations/willbender/mechanics/virtue-rules.js';
import { bindWillbenderUi } from '#gw2/professions/guardian/specializations/willbender/presentation.js';

const willbenderUi = bindWillbenderUi(guardianCatalog);

const virtues = [
  ['justice', 'Rushing Justice'],
  ['resolve', 'Flowing Resolve'],
  ['courage', 'Crashing Courage']
];

// Use real profession state and profiles while isolating hit and refresh boundaries from cast timing.
function contextAt(at, skillName = 'Rushing Justice') {
  const config = { specialization: 'Willbender' };
  const profession = guardianProfession.resolveRuntime(config);
  const events = [];
  return {
    config,
    profession,
    catalog: profession.catalog,
    skill: profession.catalog.skillsByName.get(skillName),
    state: { profession: profession.createProfessionState(config) },
    start: at,
    effectiveEnd: at,
    action: {},
    events,
    emit(event) {
      events.push(event);
      return event;
    },
    tasks: { schedule() {} },
    recordProc() {}
  };
}

test('Willbender virtue deadlines agree across buff history, scheduler, and resolver for off-grid grants', () => {
  for (const [virtue, skill] of virtues) {
    for (const selectedTraitIds of [[], [GUARDIAN_TRAIT_IDS.TYRANTS_MOMENTUM]]) {
      const result = simulateGw2({
        profession: guardianProfession,
        rotation: [{ type: 'wait', durationMs: 1 }, skill, { type: 'wait', durationMs: 11000 }],
        config: { specialization: 'Willbender', selectedTraitIds }
      });
      assert.deepEqual(result.warnings, []);
      const activation = result.events.find((event) => event.type === 'guardian.willbender-virtue-activated');
      const [buff] = boonApplicationsAt(result.events, `willbender-${virtue}`, activation.at);
      assert.ok(buff.expiresAt > activation.at + activation.duration);
      assert.equal(result.planningState.profession[`${virtue}Until`], buff.expiresAt);
      assert.equal(result.combatState.profession[`${virtue}Until`], buff.expiresAt);
    }
  }
});

test('virtue hit cycles include expiry, exclude later hits, and never arm from the zero deadline sentinel', () => {
  for (const at of [0, 9.999999, 10, 10.000001]) {
    const context = contextAt(at);
    const state = context.state.profession.specialization.state;
    for (const [virtue] of virtues) {
      state[`${virtue}Until`] = at === 0 ? 0 : 10;
      state.virtueHitCounts[virtue] = 4;
    }

    willbenderSchedulerHooks.taskHandlers['guardian.willbender-virtue-hit'](context, {
      at,
      payload: { sourceSkillName: 'Boundary strike' }
    });
    const triggers = context.events.filter((event) => event.type === 'guardian.willbender-virtue-triggered');
    assert.deepEqual(
      triggers.map((event) => event.virtue),
      at > 0 && at <= 10 ? virtues.map(([virtue]) => virtue) : []
    );
    for (const [virtue] of virtues) {
      assert.equal(state.virtueHitCounts[virtue], at > 0 && at <= 10 ? 0 : 4);
    }
  }
});

test('virtue reactivation preserves partial hit progress across expiry gaps in both phases', () => {
  for (const [virtue, skill] of virtues) {
    for (const at of [9.999999, 10, 10.000001, 20]) {
      const scheduler = contextAt(at, skill);
      const resolver = contextAt(at, skill);
      for (const context of [scheduler, resolver]) {
        const state = context.state.profession.specialization.state;
        state[`${virtue}Until`] = 10;
        state.virtueHitCounts[virtue] = 4;
      }

      willbenderSkillHandlers['guardian.willbender-virtue'].beforeEffects(scheduler, scheduler.skill);
      const activation = scheduler.events.find((event) => event.type === 'guardian.willbender-virtue-activated');
      willbenderEventHandlers['guardian.willbender-virtue-activated'](resolver, activation);
      for (const context of [scheduler, resolver]) {
        assert.equal(context.state.profession.specialization.state.virtueHitCounts[virtue], 4);
      }

      assert.equal(
        scheduler.state.profession.specialization.state[`${virtue}Until`],
        resolver.state.profession.specialization.state[`${virtue}Until`]
      );
      // The first eligible hit completes the preserved cycle instead of starting again from zero.
      willbenderSchedulerHooks.taskHandlers['guardian.willbender-virtue-hit'](scheduler, {
        at,
        payload: { sourceSkillName: 'Boundary strike' }
      });
      assert.equal(scheduler.state.profession.specialization.state.virtueHitCounts[virtue], 0);
      assert.equal(scheduler.events.filter((event) => event.type === 'guardian.willbender-virtue-triggered').length, 1);
    }
  }
});

test('Lethal Tempo activation and trigger grants share one deadline with buff history and snapshots', () => {
  for (const at of [0.001, 6.040001]) {
    for (const grant of ['activation', 'trigger']) {
      const scheduler = contextAt(at, 'Flowing Resolve');
      const resolver = contextAt(at, 'Flowing Resolve');
      if (grant === 'activation') {
        willbenderSkillHandlers['guardian.willbender-virtue'].beforeEffects(scheduler, scheduler.skill);
      } else {
        scheduler.state.profession.specialization.state.resolveUntil = 10;
        scheduler.state.profession.specialization.state.virtueHitCounts.resolve = 4;
        willbenderSchedulerHooks.taskHandlers['guardian.willbender-virtue-hit'](scheduler, {
          at,
          payload: { sourceSkillName: 'Boundary strike' }
        });
      }

      const transition = scheduler.events.find((event) => event.type.startsWith('guardian.willbender-virtue-'));
      willbenderEventHandlers[transition.type](resolver, transition);
      const emittedBuff = scheduler.events.find((event) => event.type === 'buff' && event.kind === 'lethal-tempo');
      const preparedBuff = normalizeBoonDuration({
        ...emittedBuff,
        resolvedAudience: gw2BuffApplicationRecipients(scheduler.config, emittedBuff)
      });
      const [buff] = boonApplicationsAt([preparedBuff], 'lethal-tempo', at);
      for (const context of [scheduler, resolver]) {
        assert.equal(context.state.profession.specialization.state.lethalTempoUntil, buff.expiresAt);
        for (const snapshotAt of [buff.expiresAt, buff.expiresAt + 0.000001]) {
          const items = willbenderUi.rotationStateSnapshot({
            catalog: guardianCatalog,
            state: context.state,
            atSeconds: snapshotAt
          });
          assert.equal(
            items.some((item) => item.id === 'willbender-lethal-tempo'),
            snapshotAt === buff.expiresAt
          );
        }
      }
    }
  }
});

test('virtue snapshots include the expiry instant without showing never-activated windows', () => {
  const context = contextAt(0);
  assert.deepEqual(
    willbenderUi.rotationStateSnapshot({
      catalog: guardianCatalog,
      state: context.state,
      atSeconds: 0
    }),
    []
  );
  for (const [virtue] of virtues) context.state.profession.specialization.state[`${virtue}Until`] = 10;
  for (const atSeconds of [9.999999, 10, 10.000001]) {
    const items = willbenderUi.rotationStateSnapshot({
      catalog: guardianCatalog,
      state: context.state,
      atSeconds
    });
    assert.equal(items.length, atSeconds <= 10 ? 3 : 0);
  }
});
