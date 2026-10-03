import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
const root = path.resolve(import.meta.dirname, '../../js/games/gw2');

// Producers author mechanics; the shared service alone admits their packets and announcements into execution.
test('profession and equipment producers cannot bypass the shared emission service', () => {
  const violations = [];
  for (const directory of ['professions', 'platform/equipment']) {
    for (const relative of readdirSync(path.join(root, directory), { recursive: true }).filter((p) =>
      p.endsWith('.ts')
    )) {
      const name = path.join(directory, relative);
      const source = ts.createSourceFile(
        name,
        readFileSync(path.join(root, name), 'utf8'),
        ts.ScriptTarget.Latest,
        true
      );
      function visit(node) {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
          const method = node.expression.name.text;
          const receiver = node.expression.expression;
          if (
            ['emitDerived', 'emitProcedural', 'applyCondition', 'recordProc'].includes(method) ||
            (method === 'enqueue' && ts.isPropertyAccessExpression(receiver) && receiver.name.text === 'queue') ||
            (method === 'emit' && (!ts.isPropertyAccessExpression(receiver) || receiver.name.text !== 'effects'))
          )
            violations.push(
              `${name}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1} ${node.expression.getText(source)}`
            );
        }

        ts.forEachChild(node, visit);
      }

      visit(source);
    }
  }

  assert.deepEqual(violations, []);
});
