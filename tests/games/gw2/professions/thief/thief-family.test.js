import { flattenProfessionState } from '#gw2/platform/profession-definition/state.js';
import { projectPublicProfessionState, snapshotProfessionState } from '#gw2/platform/profession-definition/state.js';
import { getNativeCatalogAssembly } from '#gw2/platform/profession-definition/assemble-module-catalog.js';
import { thiefCoreModule } from '#gw2/professions/thief/core/module.js';
import { THIEF_CORE_SKILL_MECHANICS } from '#gw2/professions/thief/core/skills/index.js';
import { thiefCatalog, thiefNativeModules, thiefProfession } from '#gw2/professions/thief/profession.js';
import { antiquaryModule } from '#gw2/professions/thief/specializations/antiquary/module.js';
import { ANTIQUARY_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/antiquary/skills/index.js';
import {
  ANTIQUARY_PUBLIC_STATE_PROJECTION,
  createAntiquaryState
} from '#gw2/professions/thief/specializations/antiquary/state.js';
import { daredevilModule } from '#gw2/professions/thief/specializations/daredevil/module.js';
import { DAREDEVIL_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/daredevil/skills/index.js';
import {
  createDaredevilState,
  DAREDEVIL_PUBLIC_STATE_PROJECTION
} from '#gw2/professions/thief/specializations/daredevil/state.js';
import { deadeyeModule } from '#gw2/professions/thief/specializations/deadeye/module.js';
import { DEADEYE_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/deadeye/skills/index.js';
import { specterModule } from '#gw2/professions/thief/specializations/specter/module.js';
import { SPECTER_SKILL_MECHANICS } from '#gw2/professions/thief/specializations/specter/skills/index.js';
import { composeSkillMechanics } from '#tests/helpers/skill-mechanics.js';
import { runThief } from '#tests/helpers/thief-simulation.js';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import ts from 'typescript';

test('Antiquary projects its own charge fields and preserves the inactive initiative layout fallback', () => {
  // The slice must expose its charges without relying on Deadeye's contribution to the family metadata.
  const { keys, defaults } = ANTIQUARY_PUBLIC_STATE_PROJECTION;
  const state = createAntiquaryState();
  state.bonusStealthAttack = { charges: 2, expiresAt: 10 };
  const active = projectPublicProfessionState(state, keys, defaults);
  assert.equal(active.initiativePipRows, 3);
  assert.equal(active.bonusStealthAttack.charges, 2);
  assert.equal(active.bonusStealthAttack.expiresAt, 10);

  const inactive = projectPublicProfessionState({}, keys, defaults);
  assert.equal(Object.hasOwn(inactive, 'initiativePipRows'), true);
  assert.equal(inactive.initiativePipRows, undefined);
  assert.equal(inactive.bonusStealthAttack.charges, 0);
  assert.equal(inactive.bonusStealthAttack.expiresAt, 0);
});

test('Daredevil projects its Weakening Strikes grant from a detached snapshot', () => {
  // Public consumers need readiness and expiry; the snapshot must not alias live state.
  const state = createDaredevilState();
  Object.assign(state, { weakeningStrikeReady: true, weakeningStrikeExpiresAt: 10 });
  const snapshot = snapshotProfessionState({ core: {}, specialization: { kind: 'Daredevil', state } });
  const { keys, defaults } = DAREDEVIL_PUBLIC_STATE_PROJECTION;
  const projected = projectPublicProfessionState(snapshot, keys, defaults);
  state.weakeningStrikeReady = false;
  assert.equal(projected.weakeningStrikeReady, true);
  assert.equal(projected.weakeningStrikeExpiresAt, 10);
});

// Tests derive elite names from the same canonical catalog consumed by production.
function eliteSpecializationNames(catalog) {
  return catalog.specializations.filter((specialization) => specialization.elite).map(({ name }) => name);
}

function nativeModifierRules(module) {
  const modifiers = module.modifiers;

  return modifiers.modifierRules || [];
}

function collectTypeScriptSources(directoryUrl, relativeDirectory = '') {
  return readdirSync(directoryUrl, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directoryUrl);

      if (entry.isDirectory()) return collectTypeScriptSources(url, relativePath);
      if (!entry.isFile() || !entry.name.endsWith('.ts')) return [];
      return [{ relativePath, source: readFileSync(url, 'utf8') }];
    });
}

const slices = Object.freeze([
  ['core', thiefCoreModule],
  ['specializations/daredevil', daredevilModule],
  ['specializations/deadeye', deadeyeModule],
  ['specializations/specter', specterModule],
  ['specializations/antiquary', antiquaryModule]
]);
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

// Validate live module ownership; dependency restrictions guard imports rather than source spelling.
test('Thief modules register unique behavior owners and respect dependency boundaries', () => {
  const modifierRuleOwners = new Map();

  for (const [directory, module] of slices) {
    const directoryUrl = new URL(`../../../../../js/games/gw2/professions/thief/${directory}/`, import.meta.url);
    const sources = collectTypeScriptSources(directoryUrl);
    // Resolve import and reexport targets so aliases are checked and comments cannot create false violations.
    for (const { relativePath, source } of sources) {
      const parsed = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true);
      for (const statement of parsed.statements) {
        if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
        const specifier = statement.moduleSpecifier?.text;
        if (!specifier) continue;
        const alias = '#gw2/professions/thief/';
        const target = specifier.startsWith(alias)
          ? specifier.slice(alias.length)
          : specifier.startsWith('.')
            ? path.posix.normalize(path.posix.join(directory, path.posix.dirname(relativePath), specifier))
            : null;
        if (!target) continue;
        const label = `${directory}/${relativePath} -> ${target}`;
        if (target.startsWith('specializations/')) assert.ok(target.startsWith(`${directory}/`), label);
        assert.ok(
          !/^(?:assumptions|attribute-rules|definition|family|handlers|resolver|state|ui)\.js$/.test(target),
          label
        );
        if (relativePath !== 'module.ts') assert.notEqual(target, 'catalog.js', label);
      }
    }

    assert.equal(typeof module.state?.create, 'function');
    assert.ok((module.data?.generatedSkills?.length || 0) + (module.data?.extraSkills?.length || 0) > 0);
    for (const rule of nativeModifierRules(module)) {
      assert.equal(modifierRuleOwners.has(rule.id), false, rule.id);
      modifierRuleOwners.set(rule.id, module.id);
    }
  }

  assert.equal(modifierRuleOwners.get('thief.havoc-specialist'), 'Daredevil');
  assert.equal(modifierRuleOwners.get('thief.malicious-stealth-attack'), 'Deadeye');
  assert.equal(modifierRuleOwners.get('thief.strength-of-shadows'), 'Specter');
  assert.equal(modifierRuleOwners.get('thief.meticulous-custodian-artifact-strike'), 'Antiquary');

  for (const module of thiefNativeModules) {
    assert.ok(module.traitDefinitions.length > 0, module.id);
    assert.equal(new Set(module.traitDefinitions.map((trait) => trait.id)).size, module.traitDefinitions.length);
  }
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
        professionState: flattenProfessionState(state)
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
    'malice',
    'shadowClock',
    'artifactSlots',
    'artifactUsesRemaining',
    'holoUtilityCooldownReductionExpirations'
  ])
    assert.equal(Object.hasOwn(result.planningState.profession, key), false, key);
});
