// Exercise preview transitions through the same headless interface used by the panel.
import assert from 'node:assert/strict';
import test from 'node:test';

import { captureSkillDamageInput } from '#gw2/app/build/skill-damage/input.js';
import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import { firstPresetBuildPath, headlessApp, skillDamageFixture } from '#tests/helpers/skill-damage.js';

const createApp = async () => headlessApp('guardian', await firstPresetBuildPath('guardian'));
const evaluation = () => ({ occurrences: [] });

test('captured inputs detach mutable build facts and retain calculation owners', async () => {
  const app = await createApp();
  app.simulationSettings = { transitionDelays: { weaponSwapMs: 100 } };
  const input = captureSkillDamageInput(app);
  const savedBuild = structuredClone(app.build);
  const traitIds = input.attributeData.activeTraits.map((trait) => trait.id);
  app.build.relic = 'Eagle';
  app.build.assumptions.might = 0;
  app.simulationSettings.transitionDelays.weaponSwapMs = 900;
  app.attributeData.activeTraits.length = 0;
  assert.deepEqual(input.build, savedBuild);
  assert.equal(input.simulationSettings.transitionDelays.weaponSwapMs, 100);
  assert.deepEqual(
    input.attributeData.activeTraits.map((trait) => trait.id),
    traitIds
  );
  for (const key of ['adapter', 'profession', 'activeCatalog', 'weaponData', 'patch'])
    assert.equal(input[key], app[key]);
  assert.equal('analysis' in input, false);
  assert.equal('attributeWeaponSet' in input, false);
});

test('preparation follows mutable inputs and content identity while measurement reuse follows the request', async (t) => {
  const app = await createApp();
  const { lifecycle, runner, receive } = skillDamageFixture(t);
  const refresh = () => lifecycle.refresh(() => captureSkillDamageInput(app));
  refresh();
  const initial = lifecycle.state;
  receive(initial.plan.signature, evaluation(), '');
  app.attributeData = structuredClone(app.attributeData);
  app.attributeWeaponSet = 2;
  app.rotationInsertionIndex = 5;
  refresh();
  assert.equal(lifecycle.state.preparation, initial.preparation);
  assert.equal(runner.schedule.mock.callCount(), 1);

  // A replaced catalog rebuilds presentation, but equivalent requests keep the original completed plan.
  app.activeCatalog = { ...app.activeCatalog };
  refresh();
  assert.notEqual(lifecycle.state.preparation, initial.preparation);
  assert.equal(lifecycle.state.plan.signature, initial.plan.signature);
  assert.equal(lifecycle.state.evaluation.plan, initial.plan);
  assert.equal(runner.schedule.mock.callCount(), 1);

  for (const change of [
    () => {
      app.build.relic = app.build.relic === 'Eagle' ? 'Claw' : 'Eagle';
    },
    () => {
      app.simulationSettings = { transitionDelays: { weaponSwapMs: 100 } };
    },
    () => {
      app.simulationSettings.transitionDelays.weaponSwapMs = 200;
    },
    () => {
      app.patch = app.profession.resolvePatch({ id: activePatchPreview.id });
    }
  ]) {
    const previous = lifecycle.state.preparation;
    change();
    refresh();
    assert.notEqual(lifecycle.state.preparation, previous);
    const prepared = lifecycle.state.preparation;
    refresh();
    assert.equal(lifecycle.state.preparation, prepared);
  }
});

test('normalized duplicate values do not reprepare or notify, and explicit resets leave saved assumptions alone', async (t) => {
  const app = await createApp();
  const changed = t.mock.fn();
  const { lifecycle } = skillDamageFixture(t, { changed });
  const input = captureSkillDamageInput(app);
  lifecycle.refresh(() => input);
  const saved = structuredClone(app.build.assumptions);
  lifecycle.setValues(() => input, { ...lifecycle.state.preparation.values, might: 0 });
  const prepared = lifecycle.state.preparation;
  const notifications = changed.mock.callCount();
  lifecycle.setValues(() => input, { ...lifecycle.state.preparation.values, might: -1 });
  assert.equal(lifecycle.state.preparation, prepared);
  assert.equal(changed.mock.callCount(), notifications);
  lifecycle.resetValues(() => input, 'clear');
  assert.equal(lifecycle.state.preparation.values.might, 0);
  assert.equal(lifecycle.state.preparation.values.targetHealth, 100);
  lifecycle.resetValues(() => input, 'saved');
  assert.equal(lifecycle.state.preparation.values.might, Number(saved.might));
  assert.deepEqual(app.build.assumptions, saved);
});

test('close and reopen retain preparation, reject closed delivery and resume only unfinished work', async (t) => {
  const app = await createApp();
  const { lifecycle, runner, receive } = skillDamageFixture(t, { open: false });
  const input = captureSkillDamageInput(app);
  lifecycle.refresh(() => input);
  assert.equal(lifecycle.state.preparation, null);
  assert.equal(runner.schedule.mock.callCount(), 0);
  lifecycle.setOpen(() => input, true);
  const { plan, preparation } = lifecycle.state;
  const cancellations = runner.cancel.mock.callCount();
  lifecycle.setOpen(() => input, false);
  assert.equal(runner.cancel.mock.callCount(), cancellations + 1);
  receive(plan.signature, evaluation(), '');
  assert.equal(lifecycle.state.evaluation, null);
  lifecycle.setOpen(() => input, true);
  assert.equal(lifecycle.state.preparation, preparation);
  assert.equal(runner.schedule.mock.callCount(), 2);
  receive(plan.signature, evaluation(), '');
  const completed = lifecycle.state.evaluation;
  lifecycle.setOpen(() => input, false);
  assert.equal(runner.cancel.mock.callCount(), cancellations + 2);
  lifecycle.setOpen(() => input, true);
  assert.equal(lifecycle.state.evaluation, completed);
  assert.equal(runner.schedule.mock.callCount(), 2);
});

test('build switches retain choices and pair stale results with their original plan, with only one completed cache', async (t) => {
  const app = await createApp();
  const { lifecycle, runner, receive } = skillDamageFixture(t);
  const firstInput = captureSkillDamageInput(app);
  lifecycle.refresh(() => firstInput);
  lifecycle.setValues(() => firstInput, { ...lifecycle.state.preparation.values, might: 7 });
  const firstPlan = lifecycle.state.plan;
  const firstResult = evaluation();
  receive(firstPlan.signature, firstResult, '');

  app.build = { ...app.build, relic: app.build.relic === 'Eagle' ? 'Claw' : 'Eagle' };
  app.build.assumptions = { ...app.build.assumptions, might: 25 };
  const secondInput = captureSkillDamageInput(app);
  lifecycle.refresh(() => secondInput);
  const secondPlan = lifecycle.state.plan;
  assert.notEqual(secondPlan.signature, firstPlan.signature);
  assert.equal(lifecycle.state.preparation.values.might, 7);
  assert.equal(lifecycle.state.evaluation.plan, firstPlan);
  assert.equal(lifecycle.state.evaluation.result, firstResult);

  const scheduled = runner.schedule.mock.callCount();
  lifecycle.refresh(() => firstInput);
  assert.equal(runner.schedule.mock.callCount(), scheduled);
  assert.equal(runner.discardQueued.mock.callCount(), 1);
  assert.equal(runner.cancel.mock.callCount(), 0);
  receive(secondPlan.signature, evaluation(), '');
  assert.equal(lifecycle.state.evaluation.result, firstResult);

  lifecycle.refresh(() => secondInput);
  receive(secondPlan.signature, evaluation(), '');
  const beforeReturn = runner.schedule.mock.callCount();
  lifecycle.refresh(() => firstInput);
  assert.equal(runner.schedule.mock.callCount(), beforeReturn + 1);
  assert.equal(lifecycle.state.evaluation.signature, secondPlan.signature);
});

test('worker failure stays suppressed across reopening and obsolete replies do not publish', async (t) => {
  const app = await createApp();
  const changed = t.mock.fn();
  const { lifecycle, runner, receive } = skillDamageFixture(t, { changed });
  const input = captureSkillDamageInput(app);
  lifecycle.refresh(() => input);
  const { plan, preparation } = lifecycle.state;
  receive(plan.signature, null, 'Measurement failed');
  lifecycle.setOpen(() => input, false);
  lifecycle.setOpen(() => input, true);
  assert.equal(lifecycle.state.preparation, preparation);
  assert.equal(lifecycle.state.error, 'Measurement failed');
  assert.equal(runner.schedule.mock.callCount(), 1);
  lifecycle.setValues(() => input, {
    ...lifecycle.state.preparation.values,
    might: Number(lifecycle.state.preparation.values.might) === 0 ? 25 : 0
  });
  assert.equal(lifecycle.state.error, '');
  assert.equal(runner.schedule.mock.callCount(), 2);
  const published = changed.mock.callCount();
  receive(plan.signature, null, 'Obsolete failure');
  assert.equal(changed.mock.callCount(), published);
  assert.equal(lifecycle.state.error, '');
});

test('plan failures are cached independently of attribute-strip failures', async (t) => {
  const app = await createApp();
  const original = app.profession;
  app.profession = {
    ...original,
    ui: {
      ...original.ui,
      skillDamageState() {
        throw new Error('Plan failed');
      }
    }
  };
  const { lifecycle, runner } = skillDamageFixture(t);
  let input = captureSkillDamageInput(app);
  lifecycle.refresh(() => input);
  const failed = lifecycle.state.preparation;
  assert.equal(lifecycle.state.plan, null);
  assert.equal(lifecycle.state.error, 'Plan failed');
  assert.equal(runner.schedule.mock.callCount(), 0);
  lifecycle.refresh(() => input);
  assert.equal(lifecycle.state.preparation, failed);
  assert.equal(runner.cancel.mock.callCount(), 1);

  // Attribute queries initialize runtime state after the plan has been created.
  app.profession = {
    ...original,
    runtimeFor: t.mock.fn((config, options) => {
      const runtime = original.runtimeFor(config, options);
      return {
        ...runtime,
        createState() {
          throw new Error('Stats failed');
        }
      };
    })
  };
  input = captureSkillDamageInput(app);
  lifecycle.refresh(() => input);
  assert.ok(lifecycle.state.plan);
  assert.equal(lifecycle.state.error, '');
  assert.equal(lifecycle.state.preparation.statsError, 'Stats failed');
  assert.equal(lifecycle.state.preparation.stats, null);
  assert.equal(runner.schedule.mock.callCount(), 1);
});

test('notifications see committed preparation before a synchronous measurement completes', async (t) => {
  const app = await createApp();
  const changes = [];
  let fixture;
  fixture = skillDamageFixture(t, {
    changed: (change) => {
      changes.push({ change, state: fixture.lifecycle.state });
    },
    schedule: (plan) => fixture.receive(plan.signature, evaluation(), '')
  });
  fixture.lifecycle.refresh(() => captureSkillDamageInput(app));
  assert.deepEqual(
    changes.map(({ change }) => change),
    ['inputs', 'measurement']
  );
  assert.ok(changes[0].state.preparation.stats);
  assert.equal(changes[0].state.evaluation, null);
  assert.equal(changes[1].state.evaluation.plan, changes[0].state.plan);
});

// Preview calculations ignore the rotation and identify patch data without traversing its catalog.
test('rotation edits reuse preparation and patch keys invalidate without serializing catalogs', async (t) => {
  const app = await createApp();
  const patch = app.patch;
  app.patch = {
    ...patch,
    toJSON() {
      throw new Error('Do not serialize the resolved patch');
    }
  };
  const { lifecycle, runner, receive } = skillDamageFixture(t);
  const capture = () => captureSkillDamageInput(app);
  lifecycle.refresh(capture);
  const prepared = lifecycle.state.preparation;
  receive(lifecycle.state.plan.signature, evaluation(), '');
  app.build.rotation.push({ type: 'cast', skillId: app.activeCatalog.skills[0].id });
  const input = capture();
  assert.deepEqual(input.build.rotation, []);
  lifecycle.refresh(() => input);
  assert.equal(lifecycle.state.preparation, prepared);
  assert.equal(runner.schedule.mock.callCount(), 1);
  // A balance choice can change while retaining the same catalog and calculation owners.
  app.patch = { ...app.patch, key: `${patch.key}:changed` };
  lifecycle.refresh(capture);
  assert.notEqual(lifecycle.state.preparation, prepared);
});

// Only the selected-value query runs again when the build and available controls are unchanged.
test('value changes reuse baseline attributes and content changes invalidate them', async (t) => {
  const app = await createApp();
  app.profession = { ...app.profession, runtimeFor: t.mock.fn(app.profession.runtimeFor) };
  const queries = () =>
    app.profession.runtimeFor.mock.calls.filter(({ arguments: args }) => args[1]?.traitTriggers === false).length;
  const { lifecycle } = skillDamageFixture(t);
  const capture = () => captureSkillDamageInput(app);
  lifecycle.refresh(capture);
  const first = lifecycle.state.preparation;
  const preparedQueries = queries();
  assert.equal(preparedQueries, 2);
  lifecycle.setValues(capture, { ...first.values, might: Number(first.values.might) === 0 ? 25 : 0 });
  assert.equal(queries(), preparedQueries + 1);
  assert.equal(lifecycle.state.preparation.stats.baseline, first.stats.baseline);
  assert.notDeepEqual(lifecycle.state.preparation.stats.current, first.stats.current);
  app.activeCatalog = { ...app.activeCatalog };
  lifecycle.refresh(capture);
  assert.equal(queries(), preparedQueries + 3);
  assert.notEqual(lifecycle.state.preparation.stats.baseline, first.stats.baseline);
});

// Disclosure and normalized duplicate events must remain cheap even with a large build.
test('closed refreshes, closing and unchanged values do not capture inputs', async (t) => {
  const app = await createApp();
  const capture = t.mock.fn(() => captureSkillDamageInput(app));
  const { lifecycle, runner } = skillDamageFixture(t, { open: false });
  lifecycle.refresh(capture);
  assert.equal(capture.mock.callCount(), 0);
  lifecycle.setOpen(capture, true);
  assert.equal(capture.mock.callCount(), 1);
  lifecycle.setValues(capture, lifecycle.state.preparation.values);
  assert.equal(capture.mock.callCount(), 1);
  const cancellations = runner.cancel.mock.callCount();
  lifecycle.setOpen(capture, false);
  assert.equal(runner.cancel.mock.callCount(), cancellations + 1);
  lifecycle.refresh(capture);
  assert.equal(capture.mock.callCount(), 1);
});

// Failed control discovery must leave the displayed values and their cache entry together.
test('preparation exceptions preserve the last committed values and cache', async (t) => {
  const app = await createApp();
  const { lifecycle, runner } = skillDamageFixture(t);
  const capture = () => captureSkillDamageInput(app);
  lifecycle.refresh(capture);
  const before = lifecycle.state;
  const original = app.profession;
  app.profession = {
    ...original,
    ui: {
      ...original.ui,
      previewControls() {
        throw new Error('Controls unavailable');
      }
    }
  };
  assert.throws(
    () =>
      lifecycle.setValues(capture, {
        ...before.preparation.values,
        might: Number(before.preparation.values.might) === 0 ? 25 : 0
      }),
    /Controls unavailable/
  );
  assert.equal(lifecycle.state, before);
  assert.throws(() => lifecycle.resetValues(capture, 'clear'), /Controls unavailable/);
  assert.equal(lifecycle.state, before);
  assert.equal(runner.schedule.mock.callCount(), 1);
  app.profession = original;
  lifecycle.refresh(capture);
  assert.equal(lifecycle.state.preparation, before.preparation);
});
