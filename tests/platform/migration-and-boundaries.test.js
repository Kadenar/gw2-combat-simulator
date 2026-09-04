import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { COMMON_EVENT_TYPES } from '#gw2/platform/engine/events/events.js';
import { SKILL_HANDLER_MODES } from '#gw2/platform/engine/skills/handlers.js';
import { professionRegistry } from '#gw2/app/profession/registry.js';
import { createProfessionWeaponData, WEAPON_DATA } from '#gw2/platform/equipment/weapons/data.js';
import { BUILD_SCHEMA_VERSION, migrateMesmerBuild, validateMesmerBuild } from '#gw2/professions/mesmer/build/build.js';
import { mesmerCatalog } from '#gw2/professions/mesmer/catalog.js';
import { mesmerProfession } from '#gw2/professions/mesmer/definition.js';
import { MESMER_TRAIT_COVERAGE } from '../fixtures/trait-coverage/mesmer.js';
import { guardianCatalog } from '#gw2/professions/guardian/catalog.js';
import { createDefaultConfig, simulateMesmer } from '../helpers/mesmer-simulation.js';
import { snapshotMesmerState } from '#gw2/professions/mesmer/state/index.js';

async function relativeStaticModuleGraph(entryFiles) {
  const visited = new Set();
  const pending = [...entryFiles];
  const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../js');
  const aliasedSourceRoots = [
    ['#gw2/', path.join(sourceRoot, 'games', 'gw2')],
    ['#kernel/', path.join(sourceRoot, 'kernel')],
    ['#ui/', path.join(sourceRoot, 'ui')],
    ['#app/', path.join(sourceRoot, 'app')]
  ];

  while (pending.length) {
    const file = await sourceModulePath(path.resolve(pending.pop()));

    if (visited.has(file)) continue;
    visited.add(file);
    const source = await readFile(file, 'utf8');
    const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const specifiers = [];
    const visit = (node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        !(ts.isImportDeclaration(node) && node.importClause?.isTypeOnly) &&
        !(ts.isExportDeclaration(node) && node.isTypeOnly) &&
        node.moduleSpecifier &&
        ts.isStringLiteralLike(node.moduleSpecifier)
      ) {
        specifiers.push(node.moduleSpecifier.text);
      }

      ts.forEachChild(node, visit);
    };

    visit(syntax);
    for (const specifier of specifiers) {
      // Package aliases resolve through dist at runtime; architecture crawling resolves the same path against source.
      const alias = aliasedSourceRoots.find(([prefix]) => specifier.startsWith(prefix));
      if (!specifier.startsWith('.') && !alias) continue;
      const dependency = alias
        ? path.resolve(alias[1], specifier.slice(alias[0].length))
        : path.resolve(path.dirname(file), specifier);

      if (dependency.endsWith('.js') || dependency.endsWith('.mjs')) {
        pending.push(dependency);
      }
    }
  }

  return visited;
}

async function sourceModulePath(file) {
  if (!file.endsWith('.js')) return file;
  const typeScript = file.replace(/\.js$/, '.ts');

  try {
    await access(typeScript);

    return typeScript;
  } catch {
    return file;
  }
}

test('Mesmer build migrations produce validated schema version 3 data', () => {
  const migrated = migrateMesmerBuild({
    sigils: ['Force', 'Impact'],
    targetStartingHealthPercent: 40,
    assumptions: { targetConditions: { Vulnerability: 10, Slow: true } },
    rotation: ['Mind Stab', { name: '__wait', waitMs: 125 }]
  });

  assert.equal(migrated.schemaVersion, BUILD_SCHEMA_VERSION);
  assert.equal(migrated.profession, 'mesmer');
  assert.equal(migrated.targetStartingHealthPercent, 40);
  assert.equal(migrated.assumptions.targetConditions.Vulnerability, 10);
  assert.equal(migrated.assumptions.targetConditions.Slow, true);
  assert.deepEqual(migrated.rotation[0], {
    type: 'cast',
    skillId: mesmerCatalog.skillsByName.get('Mind Stab').id
  });
  assert.equal(validateMesmerBuild(migrated).valid, true);
  assert.equal(migrateMesmerBuild({ targetStartingHealthPercent: 150 }).targetStartingHealthPercent, 100);
  assert.throws(() => migrateMesmerBuild({ profession: 'guardian' }), /Cannot load guardian/);
});

test('common weapon data includes Guardian weapon families', () => {
  const guardianWeapons = createProfessionWeaponData(guardianCatalog);
  const mesmerWeapons = createProfessionWeaponData(mesmerCatalog);

  assert.equal(guardianWeapons.Mace.wielding, 'mh');
  assert.equal(guardianWeapons.Sword.wielding, 'mh+oh');
  assert.equal(guardianWeapons.Hammer.wielding, '2h');
  assert.equal(guardianWeapons.Longbow.wielding, '2h');
  assert.equal(mesmerWeapons.Dagger.wielding, 'mh');
  assert.equal(mesmerWeapons.Pistol.wielding, 'oh');
  assert.equal(WEAPON_DATA.Warhorn.wielding, 'oh');
  assert.equal(WEAPON_DATA.Shortbow.wielding, '2h');
});

test('Mesmer state creation and snapshots are profession owned', () => {
  const virtuosoRuntime = mesmerProfession.resolveRuntime({
    specialization: 'Virtuoso'
  });
  const state = virtuosoRuntime.createProfessionState({
    specialization: 'Virtuoso',
    infiniteForge: true
  });

  state.specialization.state.numericResource = 3;
  state.core.clones.push({ id: 1 });
  const snapshot = snapshotMesmerState(state);

  assert.equal(state.specialization.state.nextForgeAt, 3);
  assert.equal(snapshot.numericResource, 3);
  assert.equal(snapshot.cloneCount, 1);
  assert.equal(mesmerProfession.id, 'mesmer');
  assert.equal(Object.hasOwn(virtuosoRuntime.eventReactions, 'damage.resolved'), false);
  assert.equal(typeof virtuosoRuntime.eventReactions['control.resolved'], 'function');
  assert.equal(Object.hasOwn(virtuosoRuntime.eventHandlers, 'damage'), false);
  assert.equal(Object.hasOwn(virtuosoRuntime.eventHandlers, 'control'), false);
  assert.equal(
    Object.keys(virtuosoRuntime.eventHandlers).every((type) => type.startsWith('mesmer.')),
    true
  );
  assert.equal(
    COMMON_EVENT_TYPES.some((type) => Object.hasOwn(virtuosoRuntime.eventHandlers, type)),
    false
  );
});

test('Mesmer conforms to native handler and state contracts', () => {
  for (const [handlerId, strategy] of mesmerCatalog.skillHandlers) {
    assert.ok(handlerId.startsWith('mesmer.'));
    assert.ok(strategy.mode === SKILL_HANDLER_MODES.AUGMENT || strategy.mode === SKILL_HANDLER_MODES.REPLACE);
  }

  for (const skill of mesmerCatalog.skills) {
    if (!skill.handlerId) continue;
    const strategy = mesmerCatalog.skillHandlers.get(skill.handlerId);

    assert.ok(strategy, `${skill.name} has an unresolved handler`);
  }

  const mechanicSkillIds = ['Core', 'Chronomancer', 'Mirage', 'Virtuoso', 'Troubadour'].flatMap((specialization) =>
    mesmerProfession.ui.skillBarGroups({ specialization }).flatMap((group) => group.skillIds)
  );

  assert.ok(mechanicSkillIds.every((skillId) => mesmerCatalog.skillsById.has(skillId)));
  assert.equal(MESMER_TRAIT_COVERAGE.length, mesmerCatalog.traits.length);
  assert.ok(
    Object.keys(mesmerProfession.resolveRuntime({ specialization: 'Chronomancer' }).taskHandlers).every((type) =>
      type.startsWith('mesmer.')
    )
  );

  const projected = simulateMesmer(['Mind Stab'], createDefaultConfig({ specialization: 'Core' })).endState.profession;

  assert.deepEqual(JSON.parse(JSON.stringify(projected)), projected);
});

test('native registry loaders do not pull another profession module graph', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../js/games/gw2');

  // Trace eager imports only so optional dynamic integrations remain a lazy boundary.
  for (const entry of professionRegistry) {
    const graph = await relativeStaticModuleGraph([
      path.join(root, 'professions', entry.id, 'definition.js'),
      path.join(root, 'professions', entry.id, 'app', 'app-definition.js')
    ]);

    for (const file of graph) {
      const relative = path.relative(root, file).replaceAll('\\', '/');

      for (const other of professionRegistry) {
        if (other.id === entry.id) continue;
        assert.equal(relative.startsWith(`professions/${other.id}/`), false, `${entry.id} imports ${relative}`);
      }
    }
  }
});
