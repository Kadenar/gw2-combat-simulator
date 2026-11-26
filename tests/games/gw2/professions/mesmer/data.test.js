import assert from 'node:assert/strict';
import test from 'node:test';

import { createRotationItem } from '#gw2/app/rotation/editing/actions.js';
import { capturePaletteInput } from '#gw2/app/rotation/palette/input.js';
import { queryWeaponSkills } from '#gw2/app/rotation/palette/model.js';
import { mesmerAppAdapter } from '#gw2/professions/mesmer/app/app-definition.js';
import {
  createMesmerBuildDefaults,
  migrateMesmerBuild,
  validateMesmerBuild
} from '#gw2/professions/mesmer/build/build.js';
import { MESMER_CLONE_ATTACK_TASK } from '#gw2/professions/mesmer/core/mechanics/illusions/clones.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerPhantasmTiming } from '#gw2/professions/mesmer/family-mechanics.js';
import { mesmerCatalog, mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { simulateMesmer } from '#tests/helpers/mesmer-simulation.js';

const MECHANIC_SKILLS = Object.freeze({
  Core: Object.freeze([ID.MIND_WRACK, ID.CRY_OF_FRUSTRATION, ID.DIVERSION, ID.DISTORTION]),
  Chronomancer: Object.freeze([ID.SPLIT_SECOND, ID.REWINDER, ID.TIME_SINK, ID.DISTORTION, ID.CONTINUUM_SPLIT]),
  Mirage: Object.freeze([ID.MIND_WRACK, ID.CRY_OF_FRUSTRATION, ID.DIVERSION, ID.DISTORTION]),
  Virtuoso: Object.freeze([
    ID.BLADESONG_HARMONY,
    ID.BLADESONG_SORROW,
    ID.BLADESONG_DISSONANCE,
    ID.BLADESONG_DISTORTION,
    ID.BLADETURN_REQUIEM
  ]),
  Troubadour: Object.freeze([
    ID.LIVELY_LUTE,
    ID.FLUSTERING_FLUTE,
    ID.DEAFENING_DRUM,
    ID.HARMONIOUS_HARP_ALTERNATE,
    ID.CRESCENDO
  ])
});

test('Chronomancer owns its Continuum Shift palette projection', () => {
  const group = mesmerProfession.ui.paletteGroups({
    specialization: 'Chronomancer',
    catalog: mesmerCatalog
  })[0];

  assert.deepEqual(group.skillIds, [...MECHANIC_SKILLS.Chronomancer, ID.CONTINUUM_SHIFT]);
  assert.equal(group.includeActionSkills, true);
});

test('every cataloged phantasm finishes its attack before conversion', () => {
  for (const specialization of ['Core', 'Chronomancer', 'Virtuoso']) {
    const { catalog } = mesmerProfession.runtimeFor({ specialization });
    for (const skill of catalog.skills.filter((skill) => skill.resource?.mode === 'phantasm')) {
      const timing = mesmerPhantasmTiming(skill, specialization);
      const name = `${specialization} ${skill.name}`;
      assert.ok(timing, `${name} is missing a phantasm attack timing`);
      assert.ok(timing.damageAtMs > 0, `${name} has an invalid damage time`);
      assert.ok(timing.spawnAtMs >= timing.damageAtMs, `${name} converts before damage ends`);
      for (const [index, damageAtMs] of timing.damageAtMsByEntity?.entries() ?? []) {
        assert.ok((timing.spawnAtMsByEntity?.[index] ?? timing.spawnAtMs) >= damageAtMs, `${name} entity ${index}`);
      }

      if (specialization === 'Virtuoso') {
        for (const [index, tick] of timing.conversionTicks?.entries() ?? []) {
          assert.ok(tick.atMs >= (timing.damageAtMsByEntity?.[index] ?? timing.damageAtMs), `${name} blade ${index}`);
        }
      } else if (specialization === 'Chronomancer') {
        assert.ok(timing.repeatDamageAtMs >= timing.damageAtMs, `${name} repeats before its first attack ends`);
        assert.ok(timing.repeatSpawnAtMs >= timing.repeatDamageAtMs, `${name} converts before its repeat ends`);
        for (const [index, damageAtMs] of timing.repeatDamageAtMsByEntity?.entries() ?? []) {
          assert.ok(
            (timing.repeatSpawnAtMsByEntity?.[index] ?? timing.repeatSpawnAtMs) >= damageAtMs,
            `${name} repeated entity ${index}`
          );
        }
      }
    }
  }
});

test('every Mesmer specialization registers native owners without scheduler handlers', () => {
  for (const specialization of ['Core', 'Chronomancer', 'Mirage', 'Virtuoso', 'Troubadour']) {
    const runtime = mesmerProfession.runtimeFor({ specialization });
    assert.equal(typeof runtime.initialize, 'function');
    assert.ok(runtime.catalog.skills.every((skill) => skill.handlerId == null));
    assert.equal(typeof runtime.tasks[MESMER_CLONE_ATTACK_TASK], 'function');
  }
});

test('Mesmer explicit variant identities agree across loading, editing, and simulation', () => {
  const specializationCases = [
    ['Axes of Symmetry', 'Core', ID.AXES_OF_SYMMETRY_NON_MIRAGE],
    ['Axes of Symmetry', 'Chronomancer', ID.AXES_OF_SYMMETRY_NON_MIRAGE],
    ['Axes of Symmetry', 'Virtuoso', ID.AXES_OF_SYMMETRY_NON_MIRAGE],
    ['Axes of Symmetry', 'Mirage', ID.AXES_OF_SYMMETRY],
    ['Axes of Symmetry', 'Troubadour', ID.AXES_OF_SYMMETRY_NON_MIRAGE],
    ['Lingering Thoughts', 'Mirage', ID.LINGERING_THOUGHTS],
    ['Lingering Thoughts', 'Core', ID.LINGERING_THOUGHTS_NON_MIRAGE],
    ['Lingering Thoughts', 'Chronomancer', ID.LINGERING_THOUGHTS_NON_MIRAGE],
    ['Lingering Thoughts', 'Virtuoso', ID.LINGERING_THOUGHTS_NON_MIRAGE],
    ['Lingering Thoughts', 'Troubadour', ID.LINGERING_THOUGHTS_NON_MIRAGE],
    ['Bladecall', 'Core', ID.BLADECALL_NON_VIRTUOSO],
    ['Bladecall', 'Chronomancer', ID.BLADECALL_NON_VIRTUOSO],
    ['Bladecall', 'Mirage', ID.BLADECALL_NON_VIRTUOSO],
    ['Bladecall', 'Virtuoso', ID.BLADECALL],
    ['Bladecall', 'Troubadour', ID.BLADECALL_NON_VIRTUOSO],
    ['Lively Lute', 'Troubadour', ID.LIVELY_LUTE],
    ['Harmonious Harp', 'Troubadour', ID.HARMONIOUS_HARP_ALTERNATE]
  ];

  for (const [name, specialization, expectedId] of specializationCases) {
    // IDs, loaded rotations, and selectable weapons must agree with the active runtime catalog.
    const runtime = mesmerProfession.runtimeFor({ specialization });
    assert.equal(runtime.catalog.skillsById.get(expectedId).name, name);
    const loaded = migrateMesmerBuild({
      ...createMesmerBuildDefaults(),
      specialization,
      rotation: [{ type: 'cast', skillId: expectedId }]
    });
    assert.equal(loaded.rotation[0].skillId, expectedId, `${specialization} loaded ${name}`);
    const app = {
      analysis: { needsPatchComparison: () => false, state: { results: null } },
      patch: mesmerAppAdapter.profession.resolvePatch(),
      adapter: mesmerAppAdapter,
      profession: mesmerProfession,
      activeCatalog: mesmerCatalog,
      build: {
        ...createMesmerBuildDefaults(),
        specializations: [{ name: specialization, traits: '1-1-1' }],
        weapons: [runtime.catalog.skillsById.get(expectedId).weapon || 'Axe', 'Sword']
      }
    };
    assert.equal(
      createRotationItem(app, name, { skillId: expectedId }).skillId,
      expectedId,
      `${specialization} editor ${name}`
    );

    if (runtime.catalog.skillsById.get(expectedId).type === 'Weapon') {
      assert.deepEqual(
        queryWeaponSkills(capturePaletteInput(app))
          .filter((skill) => skill.name === name)
          .map((skill) => skill.id),
        [expectedId]
      );
    }
  }

  for (const specialization of ['Core', 'Chronomancer', 'Mirage', 'Virtuoso', 'Troubadour']) {
    // Sword replacements share a tile even though the specialization gives the skill a different name.
    const app = {
      analysis: { needsPatchComparison: () => false, state: { results: null } },
      patch: mesmerAppAdapter.profession.resolvePatch(),
      adapter: mesmerAppAdapter,
      profession: mesmerProfession,
      activeCatalog: mesmerCatalog,
      build: {
        ...createMesmerBuildDefaults(),
        specializations: [{ name: specialization, traits: '1-1-1' }],
        weapons: ['Sword', 'Sword']
      }
    };
    assert.deepEqual(
      queryWeaponSkills(capturePaletteInput(app))
        .filter((skill) => skill.slot === 'Weapon_3' && !skill.flipParentId)
        .map((skill) => skill.id),
      [specialization === 'Troubadour' ? ID.BLADE_LEAP : ID.ILLUSIONARY_LEAP]
    );
    const catalog = mesmerProfession.runtimeFor({ specialization }).catalog;
    assert.equal(catalog.skillsById.has(ID.AXES_OF_SYMMETRY), specialization === 'Mirage');
    assert.equal(catalog.skillsById.has(ID.LINGERING_THOUGHTS), specialization === 'Mirage');
    assert.equal(catalog.skillsById.has(ID.BLADECALL), specialization === 'Virtuoso');
  }
});

// Direct IDs cannot bypass the same replacement rules enforced by the weapon palette.
test('Mesmer rejects shared weapon IDs replaced by the active specialization', () => {
  for (const [specialization, skillId, primaryWeapon] of [
    ['Mirage', ID.AXES_OF_SYMMETRY_NON_MIRAGE, 'Axe'],
    ['Mirage', ID.LINGERING_THOUGHTS_NON_MIRAGE, 'Axe'],
    ['Virtuoso', ID.BLADECALL_NON_VIRTUOSO, 'Dagger']
  ]) {
    const result = simulateMesmer([{ type: 'cast', skillId }], { specialization, primaryWeapon });
    assert.ok(result.warnings.length > 0, `${specialization} rejects ${skillId}`);
    assert.equal(
      result.events.some((event) => event.type === 'damage' && event.skillId === skillId),
      false
    );
  }
});

// Ambiguous Axe labels cannot replace the explicit variant identity.
test('Virtuoso Axe loading requires explicit IDs for ambiguous labels', () => {
  const build = { ...createMesmerBuildDefaults(), weapons: ['Axe', 'Sword'] };
  for (const [name, skillId] of [
    ['Lingering Thoughts', ID.LINGERING_THOUGHTS_NON_MIRAGE],
    ['Axes of Symmetry', ID.AXES_OF_SYMMETRY_NON_MIRAGE]
  ]) {
    const byId = migrateMesmerBuild({ ...build, rotation: [{ type: 'cast', skillId }] });
    for (const entry of [name, { type: 'cast', name }]) {
      const byName = migrateMesmerBuild({ ...build, rotation: [entry] });
      assert.deepEqual(byName.rotation, []);
      assert.deepEqual(byId.rotation, [{ type: 'cast', skillId }]);
      assert.equal(validateMesmerBuild(byName).valid, true);
    }
  }
});
