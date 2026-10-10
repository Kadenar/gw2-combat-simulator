import assert from 'node:assert/strict';
import test from 'node:test';
import { receiveSkillDamage, renderSkillDamage } from '#gw2/app/build/panels/skill-damage.js';
import { inertContainer } from '#tests/helpers/dom.js';
import { firstPresetBuildPath, headlessApp } from '#tests/helpers/skill-damage.js';

// Preserve the measurement denominator through the real panel renderer without starting a browser worker.
test('skill damage breakdowns identify individual charges and pulses', async (t) => {
  const app = await headlessApp('necromancer', await firstPresetBuildPath('necromancer'));
  const table = inertContainer();
  const stats = inertContainer();
  const listeners = new Map();
  const host = {
    ...inertContainer(),
    addEventListener: (name, listener) => listeners.set(name, listener),
    querySelector: (selector) =>
      ({ '[data-sd-region="stats"]': stats, '[data-sd-region="table"]': table })[selector] ?? null
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
  renderSkillDamage(app);
  const result = app.adapter.calculateSkillDamage(plan.request);
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
