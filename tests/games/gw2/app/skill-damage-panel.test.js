import { evaluateSkillDamage } from '#gw2/platform/skill-damage/measure-occurrences.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { receiveSkillDamage, renderSkillDamage } from '#gw2/app/build/panels/skill-damage.js';
import { inertContainer } from '#tests/helpers/dom.js';
import { firstPresetBuildPath, headlessApp } from '#tests/helpers/skill-damage.js';

// Exercise panel rendering and worker delivery with detached DOM regions.
function panelFixture(t, app) {
  const table = inertContainer();
  const stats = inertContainer();
  const movement = { hidden: true };
  const health = { hidden: true };
  const listeners = new Map();
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
    localStorage: { getItem: () => 'true' }
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
    cancel() {},
    schedule: (next) => {
      plan = next;
    }
  };
  return {
    table,
    host,
    listeners,
    movement,
    health,
    get plan() {
      return plan;
    }
  };
}

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
