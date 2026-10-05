import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const root = new URL('../../js/games/gw2/', import.meta.url);

// Import checks follow parsed declarations so formatting and comments cannot evade ownership boundaries.
function imports(relativePath) {
  const source = ts.createSourceFile(
    relativePath,
    readFileSync(new URL(relativePath, root), 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  return source.statements.filter(ts.isImportDeclaration).map((statement) => statement.moduleSpecifier.text);
}

test('shared execution owners have no profession or browser implementation dependencies', () => {
  for (const file of [
    'platform/execution/cast-execution.ts',
    'platform/resolver/effect-delivery.ts',
    'platform/simulation/coordinator.ts',
    'platform/results/project-runtime.ts'
  ]) {
    for (const dependency of imports(file))
      assert.doesNotMatch(dependency, /#gw2\/(professions|app)\/|#browser\/|#ui\//, file);
  }
});

test('the author-facing ownership capability cannot import the aggregate runtime', () => {
  assert.ok(
    imports('platform/profession-definition/runtime-context.ts').every(
      (dependency) => !dependency.includes('/simulation/runtime')
    )
  );
});

// Every profession now uses capabilities; importing cast facts does not grant access to the execution owner.
test('profession implementations cannot import aggregate runtimes or capability constructors', () => {
  const directory = new URL('professions/', root);
  for (const file of readdirSync(directory, { recursive: true }).filter((file) => file.endsWith('.ts'))) {
    const source = ts.createSourceFile(
      file,
      readFileSync(new URL(file.replaceAll('\\', '/'), directory), 'utf8'),
      ts.ScriptTarget.Latest,
      true
    );
    for (const statement of source.statements.filter(ts.isImportDeclaration)) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings))
        for (const binding of bindings.elements)
          assert.doesNotMatch(
            (binding.propertyName ?? binding.name).text,
            /^(Gw2Runtime|Gw2ResolverRuntime|createMechanicContext|createMechanicQueryContext)$/,
            file
          );
    }
  }
});

test('Dragon Trigger lifecycle and state do not depend on their skill or hook aggregators', () => {
  for (const file of ['dragon-trigger.ts', 'dragon-trigger-state.ts', 'gunsaber.ts', 'flow.ts']) {
    for (const dependency of imports(`professions/warrior/specializations/bladesworn/mechanics/${file}`))
      assert.doesNotMatch(dependency, /bladesworn\/(hooks|skills\/index)\.js$/);
  }
});

// Charging consumes detached release intent; command storage and progression stay in execution.
test('Dragon Trigger cannot inspect the command cursor', () => {
  const file = 'professions/warrior/specializations/bladesworn/mechanics/dragon-trigger.ts';
  const source = ts.createSourceFile(file, readFileSync(new URL(file, root), 'utf8'), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isPropertyAccessExpression(node)) assert.notEqual(node.name.text, 'cursor');
    if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression))
      assert.notEqual(node.argumentExpression.text, 'cursor');
    ts.forEachChild(node, visit);
  }

  visit(source);
});
