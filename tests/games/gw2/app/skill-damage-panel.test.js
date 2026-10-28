import assert from 'node:assert/strict';
import test from 'node:test';

import { receiveSkillDamage, renderSkillDamage } from '#gw2/app/build/panels/skill-damage.js';
import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import { evaluateSkillDamage } from '#gw2/platform/skill-damage/measure-occurrences.js';
import { inertContainer } from '#tests/helpers/dom.js';
import { firstPresetBuildPath, headlessApp } from '#tests/helpers/skill-damage.js';

// Exercise panel rendering and worker delivery with detached DOM regions.
function panelFixture(t, app) {
  const table = inertContainer();
  const stats = inertContainer();
  const movement = { hidden: true };
  const health = { hidden: true };
  const listeners = new Map();
  // Minimal event targets exercise panel lifecycle and input handling without browser layout or native interactions.
  class PanelDetails {
    classList = { contains: () => true };
    constructor(open) {
      this.open = open;
    }
  }
  class PanelInput {
    type = 'number';
    constructor(key, value) {
      this.dataset = { skillDamageControl: key };
      this.value = String(value);
    }
    matches() {
      return true;
    }
  }
  const host = {
    ...inertContainer(),
    addEventListener: (name, listener) => listeners.set(name, listener),
    querySelector: (selector) =>
      ({
        '[data-sd-region="stats"]': stats,
        '[data-sd-region="table"]': table,
        '[data-sd-target-moving]': movement,
        '[data-sd-target-health]': health
      })[selector] ?? null
  };
  for (const [name, value] of Object.entries({
    document: { getElementById: (id) => (id === 'skill-damage-preview' ? host : null) },
    localStorage: { getItem: () => 'true', setItem() {} },
    HTMLDetailsElement: PanelDetails,
    HTMLInputElement: PanelInput
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, name, previous);
      else delete globalThis[name];
    });
  }

  let plan;
  app.skillDamageRunner = {
    cancel: t.mock.fn(),
    discardQueued: t.mock.fn(),
    schedule: t.mock.fn((next) => {
      plan = next;
    })
  };
  return {
    table,
    stats,
    host,
    listeners,
    movement,
    health,
    click(dataset) {
      listeners.get('click')({ target: { closest: () => ({ dataset }) } });
    },
    input(values) {
      const inputs = Object.entries(values).map(([key, value]) => new PanelInput(key, value));
      host.querySelectorAll = () => inputs;
      listeners.get('input')({ target: inputs[0] });
    },
    toggle(open) {
      listeners.get('toggle')({ target: new PanelDetails(open) });
    },
    get plan() {
      return plan;
    }
  };
}

/** Count real preparation boundaries so presentation tests detect both plan rebuilding and preview execution. */
function observePreparation(t, app) {
  app.adapter = { ...app.adapter, createBuildContext: t.mock.fn(app.adapter.createBuildContext) };
  app.profession = {
    ...app.profession,
    runtimeFor: t.mock.fn(app.profession.runtimeFor),
    ui: {
      ...app.profession.ui,
      previewControls: t.mock.fn(app.profession.ui.previewControls),
      skillDamageState: t.mock.fn(app.profession.ui.skillDamageState)
    }
  };
  return () => ({
    builds: app.adapter.createBuildContext.mock.callCount(),
    controls: app.profession.ui.previewControls.mock.callCount(),
    rows: app.profession.ui.skillDamageState.mock.callCount(),
    runtimes: app.profession.runtimeFor.mock.callCount()
  });
}

// Table interactions and worker delivery reuse the prepared plan and leave the stats region untouched.
test('display updates do not prepare inputs, execute previews, or schedule measurements', async (t) => {
  const app = await headlessApp('guardian', await firstPresetBuildPath('guardian'));
  const fixture = panelFixture(t, app);
  const counts = observePreparation(t, app);
  renderSkillDamage(app);
  const { plan } = fixture;
  const result = evaluateSkillDamage(plan.request, app.profession);
  const prepared = counts();
  assert.ok(prepared.builds > 0 && prepared.rows > 0 && prepared.runtimes > 0);
  // A sentinel detects even an unnecessary write of identical stats markup.
  fixture.stats.innerHTML = 'unchanged stats';
  for (const delivered of [false, true]) {
    if (delivered) receiveSkillDamage(app, plan.signature, result, '');

    fixture.click({ sdRow: plan.rows.keys().next().value });
    fixture.click({ sdGroup: plan.groups[0].id });
    fixture.click({ sdFilter: 'equipped' });
    assert.deepEqual(counts(), prepared);
    assert.equal(fixture.stats.innerHTML, 'unchanged stats');
    assert.equal(app.skillDamageRunner.schedule.mock.callCount(), 1);
  }

  // Recreating equivalent attributes or changing the other preview must not invalidate this panel.
  app.attributeData = structuredClone(app.attributeData);
  app.attributeWeaponSet = 2;
  app.rotationInsertionIndex = 5;
  renderSkillDamage(app);
  assert.deepEqual(counts(), prepared);
  assert.equal(app.skillDamageRunner.schedule.mock.callCount(), 1);
});

// Input snapshots detect mutations in place as well as replaced content, while identical values reuse preparation.
test('calculation input changes invalidate preparation and unchanged normalized values reuse it', async (t) => {
  const app = await headlessApp('guardian', await firstPresetBuildPath('guardian'));
  const fixture = panelFixture(t, app);
  const counts = observePreparation(t, app);
  renderSkillDamage(app);

  const assertRefresh = (change) => {
    const before = counts();
    change();
    const after = counts();
    assert.ok(after.builds > before.builds);
    assert.ok(after.rows > before.rows);
    assert.ok(after.runtimes > before.runtimes);
    renderSkillDamage(app);
    assert.deepEqual(counts(), after);
  };

  const updateBuild = (change) =>
    assertRefresh(() => {
      change();
      renderSkillDamage(app);
    });
  updateBuild(() => {
    app.build.relic = app.build.relic === 'Eagle' ? 'Claw' : 'Eagle';
  });
  updateBuild(() => {
    app.simulationSettings = { transitionDelays: { weaponSwapMs: 100 } };
  });
  updateBuild(() => {
    app.simulationSettings.transitionDelays.weaponSwapMs = 200;
  });
  updateBuild(() => {
    app.patch = app.profession.resolvePatch({ id: activePatchPreview.id });
  });
  updateBuild(() => {
    app.activeCatalog = { ...app.activeCatalog };
  });

  // Stats follow the prepared values rather than repeating the previous markup.
  const values = { ...fixture.plan.request.inputs, might: 0 };
  const stats = fixture.stats.innerHTML;
  assertRefresh(() => fixture.input(values));
  assert.notEqual(fixture.stats.innerHTML, stats);
  const prepared = counts();
  fixture.input({ ...values, might: -1 });
  assert.deepEqual(counts(), prepared);
});

// Closing cancels measurement, but reopening can resume the same prepared request without rerunning previews.
test('reopening resumes unfinished work and preserves completed evaluations', async (t) => {
  const app = await headlessApp('guardian', await firstPresetBuildPath('guardian'));
  const fixture = panelFixture(t, app);
  const counts = observePreparation(t, app);
  renderSkillDamage(app);
  const { plan } = fixture;
  const prepared = counts();
  fixture.toggle(false);
  assert.equal(app.skillDamageRunner.cancel.mock.callCount(), 1);
  fixture.toggle(true);
  assert.equal(fixture.plan, plan);
  assert.deepEqual(counts(), prepared);
  assert.equal(app.skillDamageRunner.schedule.mock.callCount(), 2);
  receiveSkillDamage(app, plan.signature, evaluateSkillDamage(plan.request, app.profession), '');
  const completed = counts();
  fixture.toggle(false);
  fixture.toggle(true);
  assert.deepEqual(counts(), completed);
  assert.equal(app.skillDamageRunner.schedule.mock.callCount(), 2);
  assert.doesNotMatch(fixture.table.innerHTML, /is-stale|sd-loading/);
});

// Returning to measured inputs drops queued edits but leaves active work on its warm worker.
test('returning to displayed inputs discards queued work without canceling the runner', async (t) => {
  const app = await headlessApp('guardian', await firstPresetBuildPath('guardian'));
  const fixture = panelFixture(t, app);
  renderSkillDamage(app);
  const { plan } = fixture;
  receiveSkillDamage(app, plan.signature, evaluateSkillDamage(plan.request, app.profession), '');
  fixture.input({ ...plan.request.inputs, might: Number(plan.request.inputs.might) === 0 ? 25 : 0 });
  assert.equal(app.skillDamageRunner.schedule.mock.callCount(), 2);
  fixture.input(plan.request.inputs);
  assert.equal(app.skillDamageRunner.discardQueued.mock.callCount(), 1);
  assert.equal(app.skillDamageRunner.cancel.mock.callCount(), 0);
  assert.equal(app.skillDamageRunner.schedule.mock.callCount(), 2);
  assert.doesNotMatch(fixture.table.innerHTML, /is-stale|sd-loading/);
});

// Failed worker requests stay suppressed until inputs change, and obsolete replies cannot overwrite current state.
test('failed measurements stay visible without preparation or retries until inputs change', async (t) => {
  const app = await headlessApp('guardian', await firstPresetBuildPath('guardian'));
  const fixture = panelFixture(t, app);
  const counts = observePreparation(t, app);
  renderSkillDamage(app);
  const { plan } = fixture;
  const prepared = counts();
  receiveSkillDamage(app, plan.signature, null, 'Measurement failed');
  fixture.click({ sdFilter: 'equipped' });
  fixture.toggle(false);
  fixture.toggle(true);
  assert.deepEqual(counts(), prepared);
  assert.equal(app.skillDamageRunner.schedule.mock.callCount(), 1);
  assert.match(fixture.table.innerHTML, /Measurement failed/);

  fixture.input({ ...plan.request.inputs, might: Number(plan.request.inputs.might) === 0 ? 25 : 0 });
  assert.equal(app.skillDamageRunner.schedule.mock.callCount(), 2);
  assert.doesNotMatch(fixture.table.innerHTML, /Measurement failed/);
  receiveSkillDamage(app, plan.signature, null, 'Obsolete failure');
  assert.doesNotMatch(fixture.table.innerHTML, /Obsolete failure/);
});

// Health availability is known before worker delivery and updates immediately when equipment changes.
test('target health appears only for relevant damage sources and stays independent of row filters', async (t) => {
  const app = await headlessApp('guardian', await firstPresetBuildPath('guardian'));
  app.build.specializations = [];
  app.attributeData.activeTraits = [];
  app.build.weapons = ['Greatsword', ''];
  app.build.alternateWeapons = ['', ''];
  const fixture = panelFixture(t, app);
  for (const relic of ['Claw', 'Eagle', 'Claw']) {
    app.build.relic = relic;
    const saved = structuredClone(app.build);
    renderSkillDamage(app);
    assert.match(fixture.host.innerHTML, /data-sd-target-health hidden/);
    assert.equal(fixture.health.hidden, relic !== 'Eagle');
    fixture.listeners.get('click')({ target: { closest: () => ({ dataset: { sdFilter: 'equipped' } }) } });
    assert.equal(fixture.health.hidden, relic !== 'Eagle');
    assert.deepEqual(app.build, saved);
  }
});

// Preserve the measurement denominator through the real panel renderer without starting a browser worker.
test('skill damage breakdowns identify individual charges and pulses', async (t) => {
  const app = await headlessApp('necromancer', await firstPresetBuildPath('necromancer'));
  const fixture = panelFixture(t, app);
  const { table, listeners } = fixture;
  renderSkillDamage(app);
  const { plan } = fixture;
  const result = evaluateSkillDamage(plan.request, app.profession);
  receiveSkillDamage(app, plan.signature, result, '');
  for (const [name, unit] of [
    ['Soul Shards', 'charge'],
    ['Signet of Vampirism (passive)', 'pulse']
  ]) {
    const occurrence = plan.request.occurrences.find((entry) => entry.name === name);
    assert.ok(occurrence, name);
    listeners.get('click')({ target: { closest: () => ({ dataset: { sdRow: occurrence.id } }) } });
    assert.match(table.innerHTML, new RegExp(`class="sd-breakdown"><p class="sd-note">Per ${unit}`));
  }
});

// Source labels from the evaluator must remain readable text when rendered beside each condition.
test('condition breakdown renders an escaped attribution column', async (t) => {
  const app = await headlessApp('necromancer', await firstPresetBuildPath('necromancer'));
  const fixture = panelFixture(t, app);
  renderSkillDamage(app);
  const { plan } = fixture;
  const result = evaluateSkillDamage(plan.request, app.profession);
  const row = result.occurrences.find((entry) => entry.measurement?.conditions.length);
  assert.ok(row);
  row.measurement.conditions[0].attribution = 'Trait <source> & skill';
  receiveSkillDamage(app, plan.signature, result, '');
  fixture.listeners.get('click')({ target: { closest: () => ({ dataset: { sdRow: row.id } }) } });
  assert.match(fixture.table.innerHTML, /<span>Condition<\/span><span>Attribution<\/span><span>Stacks<\/span>/);
  assert.match(fixture.table.innerHTML, /class="sd-condition-attribution">Trait &lt;source&gt; &amp; skill<\/span>/);
});

// Movement follows actual condition payloads from any row, including selected equipment and procedural traits.
test('skill damage hides fixed equipment and shows target movement only for Torment sources', async (t) => {
  const app = await headlessApp('guardian', await firstPresetBuildPath('guardian'));
  app.build.specializations = [];
  app.build.weapons = ['Spear', ''];
  app.build.alternateWeapons = ['', ''];
  app.build.precastRelics = [];
  app.build.weaponSigils = [
    ['Force', 'Impact'],
    ['', '']
  ];
  const fixture = panelFixture(t, app);
  for (const [relic, sigil, expected] of [
    ['Claw', 'Impact', false],
    ['Fractal', 'Impact', true],
    ['Claw', 'Torment', true],
    ['Claw', 'Impact', false]
  ]) {
    app.build.relic = relic;
    app.build.weaponSigils[0][1] = sigil;
    renderSkillDamage(app);
    assert.doesNotMatch(fixture.host.innerHTML, /Always applied|sd-fixed/);
    const { plan } = fixture;
    receiveSkillDamage(app, plan.signature, evaluateSkillDamage(plan.request, app.profession), '');
    assert.equal(fixture.movement.hidden, !expected, `${relic}, ${sigil}`);
  }

  // Row filtering must not remove an applicable assumption; variant payloads count even when the primary has none.
  const { plan } = fixture;
  const result = evaluateSkillDamage(plan.request, app.profession);
  result.occurrences[0].variants.push({ measurement: { conditions: [{ condition: 'Torment', stacks: 1 }] } });
  receiveSkillDamage(app, plan.signature, result, '');
  assert.equal(fixture.movement.hidden, false);
  fixture.listeners.get('click')({ target: { closest: () => ({ dataset: { sdFilter: 'equipped' } }) } });
  assert.equal(fixture.movement.hidden, false);
});
