import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const root = new URL('../../js/games/gw2/', import.meta.url);

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
