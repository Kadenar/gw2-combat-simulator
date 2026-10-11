import { baseAttributeInputs } from '#gw2/platform/builds/attribute-inputs.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { runGw2Runtime } from '#gw2/platform/simulation/runtime.js';
import { necromancerProfession } from '#gw2/professions/necromancer/profession.js';
import { NECROMANCER_SKILL_IDS as ID, NECROMANCER_TRAIT_IDS as TRAIT } from '#gw2/professions/necromancer/data/ids.js';
import { registerNecromancerShroudLifecycle } from '#gw2/professions/necromancer/core/mechanics/shroud-lifecycle.js';
import { creatureSummoned } from '#gw2/professions/necromancer/core/mechanics/state-helpers.js';
import { spiritsStrengthCreatureMultiplier } from '#gw2/professions/necromancer/specializations/ritualist/traits/behavior.js';
import { captureEffectEmissions } from '#tests/helpers/effect-emission.js';
import { bindTriggerPoints } from '#tests/helpers/trigger-points.js';

/** Capture author runtime owners after the selected modules register their own callbacks. */
function run(specialization, rotation, initialize) {
  const config = {
    specialization,
    initialResource: 50,
    attributeInputs: baseAttributeInputs({ power: 1000, precision: 1000, vitality: 1000 }),
    target: { armor: 2597 }
  };
  const profession = necromancerProfession.runtimeFor(config);
  return runGw2Runtime({
    profession: {
      ...profession,
      initialize(runtime) {
        profession.initialize?.(runtime);
        initialize(runtime);
      }
    },
    config,
    rotation
  });
}

test('shroud observers see committed Core transitions and remain isolated across selected elites and runs', () => {
  const traces = [];
  for (const [specialization, entryId] of [
    ['Harbinger', ID.HARBINGER_SHROUD],
    ['Ritualist', ID.RITUALISTS_SHROUD],
    ['Core', ID.DEATH_SHROUD],
    ['Harbinger', ID.HARBINGER_SHROUD]
  ]) {
    // Use the selected form's entry/exit pair; Core entries remain present in elite catalogs.
    const catalog = necromancerProfession.runtimeFor({ specialization }).catalog;
    const entry = catalog.skillsById.get(entryId);
    const exit = catalog.skills.find((skill) => skill.shroudExit === entry.shroudEntry);
    const trace = [];
    traces.push(trace);
    const result = run(
      specialization,
      [
        { type: 'cast', skillId: entry.id },
        { type: 'cast', skillId: exit.id }
      ],
      (runtime) => {
        registerNecromancerShroudLifecycle(runtime, 'test.transitions', {
          onEnter(skill) {
            assert.equal(runtime.profession.specialization.kind, specialization);
            assert.equal(runtime.profession.core.activeShroud, skill.shroudEntry);
            if (specialization === 'Harbinger') {
              assert.ok(Number.isFinite(runtime.profession.specialization.state.nextBlightAt));
            }

            trace.push('enter');
          },
          onExit() {
            assert.equal(runtime.profession.core.activeShroud, '');
            if (specialization === 'Harbinger') {
              assert.equal(runtime.profession.specialization.state.nextBlightAt, Infinity);
            }

            trace.push('exit');
          }
        });
      }
    );
    assert.deepEqual(result.warnings, []);
    for (const previous of traces) assert.deepEqual(previous, ['enter', 'exit']);
  }
});

// Summon points settle resource rewards before the explosion, with selection isolated per runtime.
test('creature summon listeners preserve reward order, captured attribution, and selection isolation', () => {
  const skill = necromancerProfession.catalog.skillsByName.get('Summon Blood Fiend');
  for (const selected of [true, false]) {
    const observed = [];
    let lifeForce = 0;
    const runtime = {
      config: {
        specialization: 'Ritualist',
        selectedTraitIds: selected ? [TRAIT.BOON_OF_CREATION, TRAIT.EXPLOSIVE_GROWTH, TRAIT.SPIRITS_STRENGTH] : []
      },
      helpers: necromancerProfession.catalog,
      resourceController: {
        grant(_resource, amount) {
          lifeForce += amount;
        }
      },
      profession: { core: { lifeForce: { maximum: 100 } } },
      effects: captureEffectEmissions({
        submit(event) {
          observed.push({ lifeForce, event });
        }
      }).effects
    };
    bindTriggerPoints(runtime, necromancerProfession, runtime.config);
    runtime.fireTrigger(creatureSummoned, { skill, at: 2, count: 2, activationId: 'summon' });
    assert.equal(lifeForce, selected ? 20 : 0);
    assert.equal(observed.length, selected ? 1 : 0);
    if (selected) {
      assert.equal(observed[0].lifeForce, 20);
      assert.equal(observed[0].event.activationId, 'summon:explosive-growth:2');
      assert.equal(observed[0].event.parentSkillName, skill.name);
    }

    assert.equal(spiritsStrengthCreatureMultiplier(runtime), selected ? 1.5 : 1);
  }
});
