import assert from 'node:assert/strict';
import test from 'node:test';

import { resourceDisplayViews } from '#gw2/app/rotation/palette/resource-view.js';
import { normalizeTransitionDelays } from '#gw2/platform/execution/transition-lockouts.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { thiefAppAdapter } from '#gw2/professions/thief/app/app-definition.js';
import { createThiefBuildDefaults, validateThiefBuild } from '#gw2/professions/thief/build/build.js';
import { THIEF_STOLEN_SKILL_IDS } from '#gw2/professions/thief/core/mechanics/steal.js';
import { THIEF_SKILL_IDS as ID, THIEF_TRAIT_IDS as TRAIT } from '#gw2/professions/thief/data/ids.js';
import { allArtifactChoices } from '#gw2/professions/thief/specializations/antiquary/mechanics/artifacts.js';
import { DEADEYE_STOLEN_SKILL_IDS } from '#gw2/professions/thief/specializations/deadeye/skills/stolen-skills.js';
import { runThief } from '#tests/helpers/thief-simulation.js';

// Pre-steal supplies inventory before setup; trait-derived reuse keeps its normal choice lock.
test('Core and Daredevil pre-steal grant and consume their normal stolen choices', () => {
  for (const specialization of ['Core', 'Daredevil']) {
    for (const selectedTraitIds of [[], [TRAIT.IMPROVISATION]]) {
      const config = { specialization, initialPreSteal: 1, selectedTraitIds };
      const initial = runThief([], config);
      assert.deepEqual(initial.warnings, []);
      assert.deepEqual(initial.planningState.profession[STATE.STORED_STOLEN_SKILL_IDS], THIEF_STOLEN_SKILL_IDS);
      assert.equal(initial.planningState.profession[STATE.STORED_STOLEN_SKILL_COUNT], selectedTraitIds.length ? 2 : 1);
      assert.equal(initial.events.filter((event) => event.type === 'damage').length, 0);
      const used = runThief([ID.DETONATE_PLASMA], config);
      assert.deepEqual(used.warnings, []);
      assert.equal(used.planningState.profession[STATE.STORED_STOLEN_SKILL_COUNT], selectedTraitIds.length ? 1 : 0);
      assert.deepEqual(
        used.planningState.profession[STATE.STORED_STOLEN_SKILL_IDS],
        selectedTraitIds.length ? [ID.DETONATE_PLASMA] : []
      );
      const refreshed = runThief([ID.DETONATE_PLASMA, ID.STEAL], config);
      assert.deepEqual(refreshed.warnings, []);
      assert.deepEqual(refreshed.planningState.profession[STATE.STORED_STOLEN_SKILL_IDS], THIEF_STOLEN_SKILL_IDS);
      assert.equal(
        refreshed.planningState.profession[STATE.STORED_STOLEN_SKILL_COUNT],
        selectedTraitIds.length ? 2 : 1
      );
    }
  }
});

// Deadeye initialization shares Mark's choice policy while leaving the target unmarked and Mark ready.
test('Deadeye pre-steal respects Fire for Effect and Improvisation without applying a mark', () => {
  for (const fireForEffect of [false, true]) {
    for (const improvisation of [false, true]) {
      const config = {
        specialization: 'Deadeye',
        initialPreSteal: 1,
        selectedTraitIds: [
          TRAIT.MALICIOUS_INTENT,
          ...(fireForEffect ? [TRAIT.FIRE_FOR_EFFECT] : []),
          ...(improvisation ? [TRAIT.IMPROVISATION] : [])
        ]
      };
      const choices = fireForEffect ? [ID.STEAL_TIME] : DEADEYE_STOLEN_SKILL_IDS;
      const skillId = fireForEffect ? ID.STEAL_TIME : ID.STEAL_WARMTH;
      const initial = runThief([], config);
      const state = initial.planningState.profession;
      assert.deepEqual(initial.warnings, []);
      assert.deepEqual(state[STATE.STORED_STOLEN_SKILL_IDS], choices);
      assert.equal(state[STATE.STORED_STOLEN_SKILL_COUNT], improvisation ? 2 : 1);
      assert.equal(state[STATE.MARKED_TARGET_ID], null);
      assert.equal(state[STATE.MALICE].value, 0);
      assert.equal(initial.planningState.availability[ID.DEADEYES_MARK].ready, true);
      assert.equal(initial.planningState.availability[skillId].ready, true);
      assert.equal(initial.events.filter((event) => event.type === 'damage').length, 0);
      const used = runThief([skillId], config);
      assert.deepEqual(used.warnings, []);
      assert.equal(used.planningState.profession[STATE.STORED_STOLEN_SKILL_COUNT], improvisation ? 1 : 0);
      assert.deepEqual(used.planningState.profession[STATE.STORED_STOLEN_SKILL_IDS], improvisation ? [skillId] : []);
      // Availability follows the narrowed choice list while Improvisation retains a use.
      assert.equal(used.planningState.availability[skillId].ready, improvisation);
      assert.equal(used.planningState.availability[ID.STEAL_DEFENSES].ready, false);
      const refreshed = runThief([skillId, ID.DEADEYES_MARK], config);
      assert.deepEqual(refreshed.warnings, []);
      assert.deepEqual(refreshed.planningState.profession[STATE.STORED_STOLEN_SKILL_IDS], choices);
      assert.equal(refreshed.planningState.profession[STATE.STORED_STOLEN_SKILL_COUNT], improvisation ? 2 : 1);
      assert.equal(refreshed.planningState.profession[STATE.MARKED_TARGET_ID], 'primary-target');
    }
  }
});

// Starting artifacts share Swipe's inventory policy without granting its temporary effects.
test('Antiquary pre-steal respects extra uses and normal artifact replacement', () => {
  for (const [selectedTraitIds, uses] of [
    [[], 1],
    [[TRAIT.IMPROVISATION], 2],
    [[TRAIT.PROLIFIC_PLUNDERER], 2],
    [[TRAIT.IMPROVISATION, TRAIT.PROLIFIC_PLUNDERER], 3]
  ]) {
    const config = { specialization: 'Antiquary', initialPreSteal: 1, selectedTraitIds };
    const initial = runThief([], config);
    const state = initial.planningState.profession;
    assert.deepEqual(initial.warnings, []);
    assert.deepEqual(state[STATE.ARTIFACT_SLOTS], allArtifactChoices());
    assert.equal(state[STATE.ARTIFACT_USES_REMAINING], uses);
    assert.equal(state[STATE.STORED_STOLEN_SKILL_COUNT], 0);
    assert.equal(state[STATE.SCOUNDRELS_LUCK], 0);
    assert.deepEqual(state[STATE.COMBAT_HIGH_EXPIRATIONS], []);
    assert.equal(initial.events.filter((event) => event.type === 'damage').length, 0);
    const skillId = allArtifactChoices()[0].skillId;
    const used = runThief([skillId], config);
    assert.deepEqual(used.warnings, []);
    assert.equal(used.planningState.profession[STATE.ARTIFACT_USES_REMAINING], uses - 1);
    assert.ok(!used.planningState.profession[STATE.ARTIFACT_SLOTS].some((slot) => slot.skillId === skillId));
    const refreshed = runThief([skillId, ID.SKRITT_SWIPE], config);
    assert.deepEqual(refreshed.warnings, []);
    assert.equal(refreshed.planningState.profession[STATE.ARTIFACT_USES_REMAINING], uses);
    assert.deepEqual(refreshed.planningState.profession[STATE.ARTIFACT_SLOTS], allArtifactChoices());
  }
});

// The saved starting pip reaches runtime configuration; unrelated specializations never receive its inventory.
test('pre-steal persists as a bounded starting resource and is specialization scoped', () => {
  const defaults = createThiefBuildDefaults();
  assert.equal(defaults.initialPreSteal, 0);
  for (const initialPreSteal of [-1, 0.5, 2]) {
    assert.equal(validateThiefBuild({ ...defaults, initialPreSteal }).valid, false);
  }

  const saved = { ...defaults, initialPreSteal: 1 };
  assert.equal(validateThiefBuild(saved).valid, true);
  const build = thiefAppAdapter.toApplicationBuild(JSON.parse(JSON.stringify(saved)));
  const profession = thiefAppAdapter.profession;
  const app = {
    patch: thiefAppAdapter.profession.resolvePatch(),
    build,
    adapter: thiefAppAdapter,
    profession,
    activeCatalog: profession.catalog,
    attributeWeaponSet: 1
  };
  app.attributeData = thiefAppAdapter
    .createBuildContext({
      build: app.build,
      transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
      patch: thiefAppAdapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
    })
    .attributes(app.attributeWeaponSet === 2 ? 2 : 1);
  assert.equal(
    thiefAppAdapter
      .createBuildContext({
        build: app.build,
        transitionDelays: normalizeTransitionDelays(app.simulationSettings?.transitionDelays),
        patch: thiefAppAdapter.profession.resolvePatch({ id: app.patch.id ?? 'current' })
      })
      .simulationConfig().initialPreSteal,
    1
  );
  for (const specialization of ['Core', 'Daredevil', 'Antiquary', 'Deadeye', 'Specter']) {
    const supported = ['Core', 'Daredevil', 'Deadeye', 'Antiquary'].includes(specialization);
    const result = runThief([], { specialization, initialPreSteal: supported ? 0 : 1 });
    assert.equal(result.planningState.profession[STATE.STORED_STOLEN_SKILL_COUNT], 0);
    assert.equal(result.planningState.profession[STATE.ARTIFACT_USES_REMAINING] ?? 0, 0);
    const controls = resourceDisplayViews(profession, { build, specialization, catalog: profession.catalog }).filter(
      (view) => view.id === 'pre-steal'
    );
    // Composition must expose exactly the active module's control, without Core duplicating an elite's contribution.
    assert.equal(controls.length, supported ? 1 : 0);
    const [control] = controls;

    if (control) {
      assert.equal(control.buildKey, 'initialPreSteal');
      assert.equal(control.maximum, 1);
      assert.equal(control.canStart, true);
      assert.equal(control.showInPalette, false);
    }
  }
});
