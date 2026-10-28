import { projectObservedState } from '#tests/helpers/observed-runtime.js';
import { PROFESSION_STATE_IDS as STATE } from '#gw2/professions/state-ids.js';
import { getNativeCatalogAssembly } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { THIEF_CORE_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/index.js';
import { thiefCatalog, thiefNativeModules, thiefProfession } from '#gw2/professions/thief/profession.js';
import { ANTIQUARY_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/antiquary/skills/index.js';
import {
  projectAntiquaryPlanningState,
  createAntiquaryState
} from '#gw2/professions/thief/specializations/antiquary/state.js';
import { DAREDEVIL_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/daredevil/skills/index.js';
import {
  createDaredevilState,
  projectDaredevilPlanningState
} from '#gw2/professions/thief/specializations/daredevil/state.js';
import { DEADEYE_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/deadeye/skills/index.js';
import { SPECTER_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/specter/skills/index.js';
import { composeSkillMechanics } from '#tests/helpers/skill-mechanics.js';
import { runThief } from '#tests/helpers/thief-simulation.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('Antiquary projects its own charge fields and initialized empty grants', () => {
  // The slice must expose its charges without relying on Deadeye's contribution to the family metadata.
  const state = createAntiquaryState();
  state.bonusStealthAttack = { charges: 2, expiresAt: 10 };
  const active = projectAntiquaryPlanningState({
    time: 0,
    profession: { core: {}, specialization: { kind: 'Antiquary', state } }
  });
  assert.equal(active[STATE.BONUS_STEALTH_ATTACK].charges, 2);
  assert.equal(active[STATE.BONUS_STEALTH_ATTACK].expiresAt, 10);

  const inactive = projectAntiquaryPlanningState({
    time: 0,
    profession: { core: {}, specialization: { kind: 'Antiquary', state: createAntiquaryState() } }
  });
  assert.equal(inactive[STATE.BONUS_STEALTH_ATTACK].charges, 0);
  assert.equal(inactive[STATE.BONUS_STEALTH_ATTACK].expiresAt, 0);
});

test('Daredevil projects its Weakening Strikes grant from a detached snapshot', () => {
  // Public consumers need readiness and expiry; the snapshot must not alias live state.
  const state = createDaredevilState();
  Object.assign(state, { weakeningStrikeReady: true, weakeningStrikeExpiresAt: 10 });
  const projected = projectDaredevilPlanningState({
    profession: { core: {}, specialization: { kind: 'Daredevil', state } }
  });
  state.weakeningStrikeReady = false;
  assert.equal(projected[STATE.WEAKENING_STRIKE_READY], true);
  assert.equal(projected[STATE.WEAKENING_STRIKE_EXPIRES_AT], 10);
});

// Tests derive elite names from the same canonical catalog consumed by production.
function eliteSpecializationNames(catalog) {
  return catalog.specializations.filter((specialization) => specialization.elite).map(({ name }) => name);
}

const thiefSkillOwners = new Map(
  [...getNativeCatalogAssembly(thiefNativeModules, undefined).fragments].flatMap(([owner, fragment]) =>
    fragment.skills.map((skill) => [skill.id, owner])
  )
);

const specializationStateKeys = Object.freeze({
  Daredevil: ['selectedDodge', 'weakeningStrikeReady'],
  Deadeye: ['markedTargetId', 'malice', 'maleficentSevenTriggered'],
  Specter: ['shadowClock', 'shadowShroudActive'],
  Antiquary: ['artifactSlots', 'artifactUsesRemaining', 'mistburn', 'holoUtilityCooldownReductionExpirations']
});

test('Thief raw skill mechanics retain a disjoint no-loss union', () => {
  const fragments = [
    ['Core', THIEF_CORE_SKILL_MECHANICS],
    ['Daredevil', DAREDEVIL_SKILL_MECHANICS],
    ['Deadeye', DEADEYE_SKILL_MECHANICS],
    ['Specter', SPECTER_SKILL_MECHANICS],
    ['Antiquary', ANTIQUARY_SKILL_MECHANICS]
  ];
  const catalogById = new Map(thiefCatalog.skills.map((skill) => [String(skill.id), skill]));
  const aggregate = composeSkillMechanics(
    'Thief',
    fragments.map(([, mechanics]) => mechanics)
  );
  const seen = new Set();

  for (const [owner, fragment] of fragments) {
    for (const id of Object.keys(fragment)) {
      assert.equal(seen.has(id), false, id);
      seen.add(id);
      const skill = catalogById.get(id);

      if (skill) assert.equal(thiefSkillOwners.get(skill.id), owner, id);
    }
  }

  assert.deepEqual(
    [...seen].sort((left, right) => Number(left) - Number(right)),
    Object.keys(aggregate).sort((left, right) => Number(left) - Number(right))
  );
});

test('Thief runtimes exclude inactive elite state, catalogs, and registries', () => {
  assert.equal(thiefProfession.catalog, thiefCatalog);
  for (const active of ['Core', ...eliteSpecializationNames(thiefCatalog)]) {
    const config = { specialization: active };
    const runtime = thiefProfession.runtimeFor(config);
    const state = runtime.createState(config);
    const activeElite = active === 'Core' ? null : active;

    assert.equal(runtime, thiefProfession.runtimeFor(config), active);
    assert.equal(state.specialization.kind, active, active);
    assert.deepEqual(
      runtime.catalog.specializations
        .filter((specialization) => specialization.elite)
        .map((specialization) => specialization.name),
      activeElite ? [activeElite] : [],
      active
    );
    assert.equal(
      runtime.catalog.skills.some((skill) => {
        const owner = thiefSkillOwners.get(skill.id);

        return owner !== 'Core' && owner !== activeElite;
      }),
      false,
      `${active}:skills`
    );
    // Live owners select behavior from canonical skill identity; no skill names a scheduler handler.
    assert.equal(
      runtime.catalog.skills.some((skill) => skill.handlerId != null),
      false,
      `${active}:handlers`
    );

    for (const [owner, keys] of Object.entries(specializationStateKeys)) {
      for (const key of keys) {
        assert.equal(Object.hasOwn(state.core, key), false, `${active}:core:${key}`);
        assert.equal(
          Object.hasOwn(state.specialization.state, key),
          owner === active,
          `${active}:specialization:${key}`
        );
      }
    }

    assert.equal(
      Object.hasOwn(runtime.tasks, 'thief.forged-surfer'),
      active === 'Antiquary',
      `${active}:forged-surfer`
    );
    assert.equal(
      Object.hasOwn(runtime.tasks, 'thief.skritt-scuffle'),
      active === 'Antiquary',
      `${active}:skritt-scuffle`
    );

    const resources = thiefProfession.ui
      .resourceViews({
        config,
        professionState: projectObservedState(thiefProfession, { profession: state, config })
      })
      .map((resource) => resource.id);

    assert.equal(resources.includes('malice'), active === 'Deadeye', active);
    assert.equal(resources.includes('shadow-force'), active === 'Specter', active);
    // Available artifact uses are a backend gate, not a palette resource, so no
    // specialization (including Antiquary) contributes an artifact-uses view.
    assert.equal(resources.includes('artifact-uses'), false, active);
  }

  assert.throws(() => thiefProfession.runtimeFor({ specialization: 'Missing' }), /Unknown specialization: Missing/);
});

// Inactive elite modules contribute neither state nor public defaults.
test('Thief public projection omits inactive specialization fields', () => {
  const result = runThief([]);
  for (const key of [
    STATE.MALICE,
    STATE.SHADOW_CLOCK,
    STATE.ARTIFACT_SLOTS,
    STATE.ARTIFACT_USES_REMAINING,
    STATE.HOLO_UTILITY_COOLDOWN_REDUCTION_EXPIRATIONS
  ])
    assert.equal(Object.hasOwn(result.planningState.profession, key), false, key);
});
