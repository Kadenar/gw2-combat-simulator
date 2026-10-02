import { paletteAvailability } from '#gw2/app/rotation/palette/model.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { defineProfessionApp } from '#gw2/app/define-profession-app.js';
import { professionRegistry } from '#gw2/profession-registry.js';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';

test('shared eligibility precedes profession filters and cast state changes', () => {
  let stateChecks = 0;
  let filterChecks = 0;
  const weapon = { id: 1, name: 'Elite weapon', type: 'Weapon', specialization: 'Elite', cooldown: 10, effects: [] };
  const excluded = {
    id: 2,
    name: 'Automatic effect',
    type: 'Utility',
    simulatorExcluded: true,
    cooldown: 10,
    effects: []
  };
  const wrongSpecialization = { id: -3, name: 'Elite action', type: 'Action', specialization: 'Elite', effects: [] };
  const profession = defineNativeProfession({
    id: 'eligibility-fixture',
    name: 'Eligibility fixture',
    modules: [
      defineNativeModule({
        id: 'Core',
        data: { generatedSkills: [weapon, excluded, wrongSpecialization] },
        state: { create: () => ({ resource: 10 }) },
        hooks: {
          availability() {
            stateChecks++;
            return { ready: true };
          },
          onCastStart(runtime) {
            runtime.profession.core.resource--;
          }
        },
        presentation: { paletteOverride: () => ({ available: true }) }
      })
    ]
  });
  const adapter = defineProfessionApp({
    profession,
    applyBuildAttributeRules: () => {},
    toApplicationBuild: (build) => build,
    isSkillAvailable: () => {
      filterChecks += 1;
      return true;
    }
  });
  const context = { specialization: 'Core' };
  for (const skill of [excluded, wrongSpecialization]) {
    assert.equal(adapter.isSkillAvailable(skill, context), false);
    assert.equal(paletteAvailability({ profession, results: null }, context, skill).available, false);
  }

  assert.equal(filterChecks, 0, 'Rejected builds must not reach the profession browser filter');
  assert.equal(adapter.isSkillAvailable(weapon, context), true);
  assert.equal(paletteAvailability({ profession, results: null }, context, weapon).available, true);

  // A rejected command cannot run state checks, spend a resource, or begin its recharge.
  const rejected = simulateGw2({
    profession,
    config: context,
    rotation: [
      { type: 'cast', skillId: excluded.id },
      { type: 'cast', skillId: wrongSpecialization.id }
    ]
  });
  assert.equal(stateChecks, 1, 'Only the castable weapon is queried by planning capture');
  assert.equal(rejected.planningState.profession.resource, 10);
  assert.equal(Object.keys(rejected.planningState.cooldowns).length, 0);
  assert.ok(rejected.steps.every((step) => step.invalid));
  assert.equal(rejected.warnings.length, 2);

  const accepted = simulateGw2({ profession, config: context, rotation: [{ type: 'cast', skillId: weapon.id }] });
  assert.deepEqual(accepted.warnings, []);
  assert.equal(accepted.planningState.profession.resource, 9);
  assert.ok(accepted.planningState.cooldowns[weapon.name].readyAt > 0);
});

test('every profession inherits build rejection in browser, palette, and resolved runtime', async () => {
  for (const entry of professionRegistry) {
    const adapter = await entry.loadAppAdapter();
    for (const specialization of [
      'Core',
      ...adapter.profession.nativeDefinition.modules.slice(1).map((module) => module.id)
    ]) {
      const context = { specialization };
      const runtime = adapter.profession.runtimeFor(context);
      for (const skill of [
        { id: -90001, name: 'Other specialization action', type: 'Action', specialization: 'Other specialization' },
        { id: 90002, name: 'Excluded weapon', type: 'Weapon', simulatorExcluded: true }
      ]) {
        const label = `${entry.id}/${specialization}: ${skill.name}`;
        assert.equal(adapter.isSkillAvailable(skill, context), false, label);
        assert.equal(
          paletteAvailability({ profession: adapter.profession, results: null }, context, skill).available,
          false,
          label
        );
        assert.equal(
          paletteAvailability({ profession: adapter.profession, results: null }, context, skill).available,
          false,
          label
        );
        // No runtime state is needed: build rejection must precede profession state access.
        assert.deepEqual(
          runtime.availability({ config: context }, skill),
          {
            ready: false,
            retryAt: null,
            code: 'gw2.build-unavailable',
            reason: `${skill.name} is unavailable for this build.`
          },
          label
        );
      }
    }
  }
});
