import assert from 'node:assert/strict';
import test from 'node:test';
import { defineProfessionApp } from '#gw2/app/create-adapter.js';
import { professionRegistry } from '#gw2/app/profession/registry.js';
import { createScheduler } from '#gw2/platform/engine/execution/scheduler.js';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';

test('shared eligibility precedes profession filters and cast state changes', () => {
  let stateChecks = 0;
  let filterChecks = 0;
  const weapon = { id: 1, name: 'Elite weapon', type: 'Weapon', specialization: 'Elite', recharge: 10, effects: [] };
  const excluded = {
    id: 2,
    name: 'Automatic effect',
    type: 'Utility',
    simulatorExcluded: true,
    recharge: 10,
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
        state: { scheduler: () => ({ resource: 10 }) },
        mechanics: {
          execution: {
            availability: {
              phase: 'scheduler',
              hook: 'availability',
              id: 'fixture.state-check',
              order: 0,
              handler: () => {
                stateChecks += 1;
                return { ready: true };
              }
            },
            castLifecycle: [
              {
                phase: 'scheduler',
                hook: 'onCastStart',
                id: 'fixture.spend',
                order: 0,
                handler: ({ state }) => {
                  state.profession.core.resource -= 1;
                }
              }
            ]
          }
        },
        presentation: { paletteSkillAvailability: () => ({ available: true, message: '' }) }
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
    assert.equal(profession.ui.paletteSkillAvailability(context, skill).available, false);
  }

  assert.equal(filterChecks, 0, 'Rejected builds must not reach the profession browser filter');
  assert.equal(adapter.isSkillAvailable(weapon, context), true);
  assert.equal(profession.ui.paletteSkillAvailability(context, weapon).available, true);

  // A rejected command cannot run state checks, spend a resource, or begin its recharge.
  const scheduler = createScheduler({ profession, config: context });
  const rejected = scheduler.run([
    { type: 'cast', skillId: excluded.id },
    { type: 'cast', skillId: wrongSpecialization.id }
  ]);
  assert.equal(stateChecks, 0);
  assert.equal(rejected.state.profession.core.resource, 10);
  assert.equal(rejected.state.cooldowns.size, 0);
  assert.ok(rejected.steps.every((step) => step.invalid));
  assert.equal(rejected.warnings.length, 2);

  const accepted = createScheduler({ profession, config: context }).run([{ type: 'cast', skillId: weapon.id }]);
  assert.deepEqual(accepted.warnings, []);
  assert.equal(accepted.state.profession.core.resource, 9);
  assert.ok(accepted.state.cooldowns.get(weapon.id) > 0);
});

test('every profession inherits build rejection in browser, palette, and resolved runtime', async () => {
  for (const entry of professionRegistry) {
    const adapter = await entry.loadAppAdapter();
    for (const specialization of ['Core', ...adapter.profession.specializationIds]) {
      const context = { specialization };
      const runtime = adapter.profession.resolveRuntime(context);
      for (const skill of [
        { id: -90001, name: 'Other specialization action', type: 'Action', specialization: 'Other specialization' },
        { id: 90002, name: 'Excluded weapon', type: 'Weapon', simulatorExcluded: true }
      ]) {
        const label = `${entry.id}/${specialization}: ${skill.name}`;
        assert.equal(adapter.isSkillAvailable(skill, context), false, label);
        assert.equal(adapter.profession.ui.paletteSkillAvailability(context, skill).available, false, label);
        assert.equal(runtime.ui.paletteSkillAvailability({ config: context }, skill).available, false, label);
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
