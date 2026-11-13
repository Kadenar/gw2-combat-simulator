import assert from 'node:assert/strict';
import test from 'node:test';

import { createRotationItem } from '#gw2/app/rotation/editing/actions.js';
import { capturePaletteInput } from '#gw2/app/rotation/palette/input.js';
import { queryWeaponSkills } from '#gw2/app/rotation/palette/model.js';
import { materializeSkillDefinitions } from '#gw2/platform/skills/compose-definitions.js';
import { mesmerAppAdapter } from '#gw2/professions/mesmer/app/app-definition.js';
import {
  createMesmerBuildDefaults,
  migrateMesmerBuild,
  validateMesmerBuild
} from '#gw2/professions/mesmer/build/build.js';
import { MESMER_CLONE_ATTACK_TASK } from '#gw2/professions/mesmer/core/mechanics/illusions/clones.js';
import { MESMER_CORE_PHANTASM_ATTACK_TIMINGS, MESMER_CORE_SKILLS } from '#gw2/professions/mesmer/core/skills/index.js';
import { MESMER_CORE_SHATTERS } from '#gw2/professions/mesmer/core/skills/profession-skills.js';
import { MESMER_SKILL_IDS as ID } from '#gw2/professions/mesmer/data/ids.js';
import { mesmerCatalog, mesmerProfession } from '#gw2/professions/mesmer/profession.js';
import { MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS } from '#gw2/professions/mesmer/specializations/chronomancer/mechanics/definitions.js';
import {
  MESMER_CHRONOMANCER_SHATTERS,
  MESMER_CHRONOMANCER_SKILLS
} from '#gw2/professions/mesmer/specializations/chronomancer/skills/index.js';
import {
  MESMER_MIRAGE_AMBUSH_SKILLS as AMBUSH_ATTACKS,
  MESMER_MIRAGE_SKILLS
} from '#gw2/professions/mesmer/specializations/mirage/skills/index.js';
import { MESMER_TROUBADOUR_SKILLS } from '#gw2/professions/mesmer/specializations/troubadour/skills/index.js';
import { MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS } from '#gw2/professions/mesmer/specializations/virtuoso/mechanics/definitions.js';
import {
  MESMER_VIRTUOSO_SHATTERS,
  MESMER_VIRTUOSO_SKILL_MECHANICS
} from '#gw2/professions/mesmer/specializations/virtuoso/skills/index.js';
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

const SHATTERS = Object.freeze({
  ...MESMER_CORE_SHATTERS,
  ...MESMER_CHRONOMANCER_SHATTERS,
  ...MESMER_VIRTUOSO_SHATTERS
});

// Module collections supply all owned identities, including generated actions and attacks.
const declarations = [
  ...MESMER_CORE_SKILLS,
  ...MESMER_CHRONOMANCER_SKILLS,
  ...MESMER_MIRAGE_SKILLS,
  ...materializeSkillDefinitions(MESMER_VIRTUOSO_SKILL_MECHANICS),
  ...MESMER_TROUBADOUR_SKILLS
];
const MESMER_SKILL_MECHANICS = Object.fromEntries(declarations.map((skill) => [skill.id, skill]));
const PSEUDO_SKILLS = declarations.filter((skill) => skill.id < 0);

const AMBUSH_SKILLS = Object.freeze(Object.values(AMBUSH_ATTACKS));

const phantasmTimingIds = new Set([
  ...Object.keys(MESMER_CORE_PHANTASM_ATTACK_TIMINGS),
  ...Object.keys(MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS),
  ...Object.keys(MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS)
]);
const PHANTASM_ATTACK_TIMINGS = Object.freeze(
  Object.fromEntries(
    [...phantasmTimingIds].map((id) => [
      Number(id),
      {
        ...MESMER_CORE_PHANTASM_ATTACK_TIMINGS[Number(id)],
        ...MESMER_CHRONOMANCER_PHANTASM_ATTACK_TIMINGS[Number(id)],
        ...MESMER_VIRTUOSO_PHANTASM_ATTACK_TIMINGS[Number(id)]
      }
    ])
  )
);
const strikeEffects = (skill) => skill.effects.filter((effect) => effect.type === 'strike');

// Follow-up tooltips expose the same window and recharge units used by the runtime.
test('Mesmer follow-up facts show canonical windows and a percentage of parent base recharge', () => {
  const factsFor = (id) =>
    mesmerAppAdapter.skillTooltip(mesmerCatalog.skillsById.get(id), mesmerAppAdapter.profession.resolvePatch()).facts;
  for (const [id, duration] of [
    [ID.SINGULARITY_SHOT, '3s'],
    [ID.INSPIRING_IMAGERY, '2s']
  ]) {
    assert.equal(factsFor(id).find((fact) => fact.name === 'Follow-up window')?.detail, duration);
  }

  assert.equal(
    factsFor(ID.DIMENSIONAL_APERTURE).find((fact) => fact.name === 'Additional parent recharge')?.detail,
    '+50% of parent base recharge'
  );
  assert.equal(
    factsFor(ID.MIND_SLASH).some((fact) => ['Follow-up window', 'Additional parent recharge'].includes(fact.name)),
    false
  );
});

test('Mesmer mechanics are the sole simulation source and use stable skill ids', () => {
  assert.equal(
    Object.keys(MESMER_SKILL_MECHANICS).every((id) => Number.isInteger(Number(id))),
    true
  );

  assert.equal(MESMER_SKILL_MECHANICS['Winds of Chaos'], undefined);
  // Bladecall variants share strike definitions; interruption persistence belongs to each specialization's cast.
  const bladecallEffects = (id) =>
    MESMER_SKILL_MECHANICS[id].effects.map((effect) => ({ ...effect, persistsAfterInterrupt: undefined }));
  assert.deepEqual(bladecallEffects(ID.BLADECALL_NON_VIRTUOSO), bladecallEffects(ID.BLADECALL));
  assert.equal(
    Object.values(MESMER_SKILL_MECHANICS).some((mechanics) => mechanics.blade === false),
    false
  );
  // Each keyed entry supplies its own identity and presentation.
  for (const skill of Object.values(MESMER_SKILL_MECHANICS)) {
    assert.equal(typeof skill.name, 'string');
    assert.ok(skill.icon);
  }

  assert.equal(mesmerCatalog.skillsById.get(ID.FLYING_CUTTER).specialization, undefined);
  assert.equal(mesmerCatalog.skillsById.get(ID.UNSTABLE_BLADESTORM).specialization, undefined);
  assert.equal(SHATTERS[ID.MIND_WRACK].resolver, 'mesmer.core.clone-shatter');
  assert.equal(SHATTERS[ID.BLADESONG_HARMONY].resolver, 'mesmer.virtuoso.bladesong');
  assert.equal(SHATTERS[ID.BLADESONG_HARMONY].minimumResource, 1);
});

test('every Mesmer catalog skill exposes normalized effects', () => {
  assert.equal(
    mesmerCatalog.skills.every((skill) => Array.isArray(skill.effects)),
    true
  );
  assert.equal(mesmerCatalog.skillsById.get(62560).id, ID.BLADECALL_NON_VIRTUOSO);
});

test('Mesmer relic options exclude profession-inapplicable relics', () => {
  const excluded = ['Krait', 'Weaver', 'Fire'];

  assert.equal(mesmerAppAdapter.relicNames.includes('Claw'), true);
  assert.equal(mesmerAppAdapter.relicNames.includes('Director'), true);
  assert.equal(mesmerAppAdapter.relicNames.includes('Mount Balrior'), true);
  assert.equal(mesmerAppAdapter.relicNames.includes('Nourys'), true);
  assert.equal(mesmerAppAdapter.relicNames.includes('Steamshrieker'), true);
  assert.deepEqual(
    mesmerAppAdapter.relicNames.filter((name) => excluded.includes(name)),
    []
  );
});

test('Chronomancer owns its Continuum Shift palette projection', () => {
  const group = mesmerProfession.ui.paletteGroups({
    specialization: 'Chronomancer',
    catalog: mesmerCatalog
  })[0];

  assert.deepEqual(group.skillIds, [...MECHANIC_SKILLS.Chronomancer, ID.CONTINUUM_SHIFT]);
  assert.equal(group.includeActionSkills, true);
});

test('every cataloged phantasm has an attack timing before clone conversion', () => {
  const phantasms = mesmerCatalog.skills.filter((skill) => skill.resource?.mode === 'phantasm');

  assert.deepEqual(
    phantasms.map((skill) => skill.name),
    [
      'Phantasmal Swordsman',
      'Phantasmal Duelist',
      'Phantasmal Mage',
      'Phantasmal Warlock',
      'Phantasmal Berserker',
      'Phantasmal Warden',
      'Phantasmal Disenchanter',
      'Phantasmal Defender',
      'Echo of Memory',
      'Phantasmal Sharpshooter',
      'Phantasmal Lancer'
    ]
  );
  for (const skill of phantasms) {
    const timing = PHANTASM_ATTACK_TIMINGS[skill.id];

    assert.ok(timing, `${skill.name} is missing a phantasm attack timing`);
    assert.ok(timing.damageAtMs > 0, `${skill.name} has an invalid damage time`);
    assert.ok(timing.spawnAtMs >= timing.damageAtMs, `${skill.name} converts before damage ends`);
    assert.ok(timing.repeatDamageAtMs >= timing.damageAtMs, `${skill.name} has an invalid Chronophantasma damage time`);
    assert.ok(timing.repeatSpawnAtMs >= timing.repeatDamageAtMs, `${skill.name} converts before its repeat ends`);
    for (const [index, damageAtMs] of timing.damageAtMsByEntity?.entries() ?? []) {
      assert.ok(
        (timing.spawnAtMsByEntity?.[index] ?? timing.spawnAtMs) >= damageAtMs,
        `${skill.name} entity ${index} converts before damage ends`
      );
    }

    for (const [index, damageAtMs] of timing.repeatDamageAtMsByEntity?.entries() ?? []) {
      assert.ok(
        (timing.repeatSpawnAtMsByEntity?.[index] ?? timing.repeatSpawnAtMs) >= damageAtMs,
        `${skill.name} repeat entity ${index} converts before damage ends`
      );
    }
  }
});

test('Mesmer weapon autoattacks are cataloged as individual chain skills', () => {
  const expectedChains = [
    [ID.MIND_SLASH, ID.MIND_GASH, ID.MIND_SPIKE],
    [ID.ETHER_BOLT, ID.ETHER_BLAST, ID.ETHER_CLONE],
    [ID.LACERATING_CHOP, ID.ETHEREAL_CHOP, ID.MIRROR_STRIKES],
    [ID.PSYCUT, ID.PSYSTRIKE, ID.MIND_PIERCE]
  ];

  assert.deepEqual(mesmerCatalog.autoattackChains, expectedChains);
  for (const chain of expectedChains) {
    const [rootId, ...childIds] = chain;
    const rootSkill = mesmerCatalog.skillsById.get(rootId);

    assert.equal(strikeEffects(rootSkill)[0].ticks?.length ?? strikeEffects(rootSkill)[0].hits, 1);
    assert.notEqual(strikeEffects(rootSkill)[0].name, 'Full autoattack chain');
    assert.equal(rootSkill.chainRoot, rootId);
    assert.equal(rootSkill.chainStep, 1);
    assert.equal(rootSkill.nextChainId, childIds[0]);
    chain.forEach((skillId, index) => {
      const nextChainId = chain[index + 1] ?? null;

      assert.equal(mesmerCatalog.skillsById.get(skillId).nextChainId, nextChainId);
    });
  }
});

// Explicit declarations retain supported weapon and mantra parent identities after assembly.
test('weapon and mantra sequence flips are cataloged', () => {
  for (const [parentId, followUpId] of [
    [ID.ILLUSIONARY_COUNTER, ID.COUNTERSPELL],
    [ID.MANTRA_OF_PAIN, ID.POWER_SPIKE],
    [ID.MANTRA_OF_RECOVERY, ID.POWER_RETURN],
    [ID.SINGULARITY_SHOT, ID.DIMENSIONAL_APERTURE],
    [ID.INSPIRING_IMAGERY, ID.ABSTRACTION],
    [ID.TEMPORAL_CURTAIN, ID.INTO_THE_VOID],
    [ID.ILLUSIONARY_RIPOSTE, ID.COUNTER_BLADE],
    [ID.ILLUSIONARY_LEAP, ID.SWAP]
  ]) {
    assert.equal(mesmerCatalog.skillsById.get(parentId).flipSkillId, followUpId);
    assert.equal(mesmerCatalog.skillsById.get(followUpId).flipParentId, parentId);
  }
});

test('every terrestrial Mirage main-hand weapon has a selectable ambush skill', () => {
  assert.deepEqual(
    AMBUSH_SKILLS.map((skill) => [skill.weapon, skill.name]),
    [
      ['Axe', 'Imaginary Axes'],
      ['Dagger', 'Phantom Razor'],
      ['Greatsword', 'Split Surge'],
      ['Rifle', 'Effervescence'],
      ['Scepter', 'Ether Barrage'],
      ['Spear', 'Fractured Glass'],
      ['Staff', 'Chaos Vortex'],
      ['Sword', 'Mirage Thrust']
    ]
  );
  assert.ok(AMBUSH_SKILLS.every((skill) => skill.ambush && skill.slot === 'Weapon_1' && skill.icon));
  // Catalog loading must retain the actor variants on the same skill that selects the ambush handler.
  for (const skill of AMBUSH_SKILLS) {
    const loaded = mesmerCatalog.skillsById.get(skill.id);
    assert.equal(loaded.ambush, true);
    assert.equal(loaded.specialization, 'Mirage');
    assert.deepEqual(loaded.player, skill.player);
    assert.deepEqual(loaded.clone, skill.clone);
  }
});

test('Mesmer triggered skill identities and dynamic handler profiles are explicit', () => {
  assert.ok(PSEUDO_SKILLS.every((skill) => skill.id < 0));

  const shared = mesmerCatalog.skillsById.get(10218);

  assert.equal(shared.handlerId, undefined);
  assert.ok(shared.effects.length > 0);
  const replacing = mesmerCatalog.skillsById.get(10174);

  assert.equal(replacing.phantasm, true);
  assert.ok(replacing.effects.length > 0);
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
