import assert from 'node:assert/strict';
import test from 'node:test';

import { renderSkillDamage, renderSkillDamageChange } from '#gw2/app/build/panels/skill-damage.js';
import { evaluateSkillDamage } from '#gw2/platform/skill-damage/measure-occurrences.js';
import { inertContainer } from '#tests/helpers/dom.js';
import { firstPresetBuildPath, headlessApp, skillDamageFixture } from '#tests/helpers/skill-damage.js';

// Exercise panel rendering and worker delivery with detached DOM regions.
function panelFixture(t, app) {
  const table = inertContainer();
  const stats = inertContainer();
  const movement = { hidden: true };
  const health = { hidden: true };
  const listeners = new Map();
  // Minimal event targets exercise renderer bindings without browser layout or native interactions.
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
  const fixture = skillDamageFixture(t, {
    changed: (change) => renderSkillDamageChange(app, change),
    schedule: (next) => {
      plan = next;
    }
  });
  app.skillDamage = fixture.lifecycle;
  return {
    ...fixture,
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
      return inputs;
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
    if (delivered) fixture.receive(plan.signature, result, '');

    fixture.click({ sdRow: plan.rows.keys().next().value });
    fixture.click({ sdGroup: plan.groups[0].id });
    fixture.click({ sdFilter: 'equipped' });
    assert.deepEqual(counts(), prepared);
    assert.equal(fixture.stats.innerHTML, 'unchanged stats');
    assert.equal(fixture.runner.schedule.mock.callCount(), 1);
  }

  // Recreating equivalent attributes or changing the other preview must not invalidate this panel.
  app.attributeData = structuredClone(app.attributeData);
  app.attributeWeaponSet = 2;
  app.rotationInsertionIndex = 5;
  renderSkillDamage(app);
  assert.deepEqual(counts(), prepared);
  assert.equal(fixture.runner.schedule.mock.callCount(), 1);
});

// Bindings send preview edits to the lifecycle without replacing the controls being edited.
test('panel bindings publish value changes, clamp on blur and toggle disclosure without losing preparation', async (t) => {
  const app = await headlessApp('guardian', await firstPresetBuildPath('guardian'));
  const fixture = panelFixture(t, app);
  renderSkillDamage(app);
  const body = fixture.host.innerHTML;
  const previousStats = fixture.stats.innerHTML;
  const inputs = fixture.input({ ...app.skillDamage.state.preparation.values, might: -1 });
  assert.equal(app.skillDamage.state.preparation.values.might, 0);
  assert.equal(fixture.host.innerHTML, body);
  assert.notEqual(fixture.stats.innerHTML, previousStats);
  const might = inputs.find((input) => input.dataset.skillDamageControl === 'might');
  fixture.stats.innerHTML = 'unchanged after normalized blur';
  fixture.listeners.get('change')({ target: might });
  assert.equal(might.value, '0');
  assert.equal(fixture.stats.innerHTML, 'unchanged after normalized blur');
  const preparation = app.skillDamage.state.preparation;
  fixture.toggle(false);
  assert.equal(app.skillDamage.state.open, false);
  assert.doesNotMatch(fixture.host.innerHTML, /skill-damage-body/);
  fixture.toggle(true);
  assert.equal(app.skillDamage.state.preparation, preparation);
  assert.match(fixture.host.innerHTML, /skill-damage-body/);
  fixture.click({ sdAction: 'use-config' });
  assert.equal(app.skillDamage.state.preparation.values.might, Number(app.build.assumptions.might));
  fixture.click({ sdAction: 'clear' });
  assert.equal(app.skillDamage.state.preparation.values.might, 0);
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
  fixture.receive(plan.signature, result, '');
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
  fixture.receive(plan.signature, result, '');
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
    fixture.receive(plan.signature, evaluateSkillDamage(plan.request, app.profession), '');
    assert.equal(fixture.movement.hidden, !expected, `${relic}, ${sigil}`);
  }

  // Row filtering must not remove an applicable assumption; variant payloads count even when the primary has none.
  const { plan } = fixture;
  const result = evaluateSkillDamage(plan.request, app.profession);
  result.occurrences[0].variants.push({ measurement: { conditions: [{ condition: 'Torment', stacks: 1 }] } });
  fixture.receive(plan.signature, result, '');
  assert.equal(fixture.movement.hidden, false);
  fixture.listeners.get('click')({ target: { closest: () => ({ dataset: { sdFilter: 'equipped' } }) } });
  assert.equal(fixture.movement.hidden, false);
});

// A callback can reach panel handlers before a destination build has calculated attributes.
test('handlers skip missing attributes and closing still cancels work without reading the build', async (t) => {
  const app = await headlessApp('guardian', await firstPresetBuildPath('guardian'));
  const fixture = panelFixture(t, app);
  renderSkillDamage(app);
  const before = app.skillDamage.state;
  const attributes = app.attributeData;
  const build = app.build;
  app.attributeData = null;
  Object.defineProperty(app, 'build', {
    configurable: true,
    get() {
      throw new Error('Build must not be read');
    }
  });
  assert.doesNotThrow(() => fixture.input({ ...before.preparation.values, might: 0 }));
  assert.doesNotThrow(() => fixture.click({ sdAction: 'clear' }));
  assert.doesNotThrow(() => fixture.click({ sdAction: 'use-config' }));
  assert.equal(app.skillDamage.state, before);
  const cancellations = fixture.runner.cancel.mock.callCount();
  fixture.toggle(false);
  assert.equal(fixture.runner.cancel.mock.callCount(), cancellations + 1);
  assert.doesNotThrow(() => fixture.toggle(true));
  assert.equal(app.skillDamage.state.open, false);
  assert.equal(fixture.runner.schedule.mock.callCount(), 1);
  Object.defineProperty(app, 'build', { configurable: true, writable: true, value: build });
  app.attributeData = attributes;
  fixture.toggle(true);
  assert.equal(app.skillDamage.state.open, true);
});

// Retained failures and completed results must remain visible after rebuilding the disclosure contents.
test('reopening shows worker errors and completed results without stale styling', async (t) => {
  const app = await headlessApp('guardian', await firstPresetBuildPath('guardian'));
  const fixture = panelFixture(t, app);
  renderSkillDamage(app);
  fixture.receive(fixture.plan.signature, null, 'Measurement failed');
  fixture.toggle(false);
  fixture.toggle(true);
  assert.match(fixture.table.innerHTML, /Measurement failed/);
  assert.equal(fixture.runner.schedule.mock.callCount(), 1);
  fixture.input({ ...app.skillDamage.state.preparation.values, might: 0 });
  const plan = fixture.plan;
  fixture.receive(plan.signature, evaluateSkillDamage(plan.request, app.profession), '');
  fixture.toggle(false);
  fixture.toggle(true);
  assert.doesNotMatch(fixture.table.innerHTML, /Measurement failed|is-stale|sd-loading/);
  assert.match(fixture.table.innerHTML, /class="sd-table"/);
});
