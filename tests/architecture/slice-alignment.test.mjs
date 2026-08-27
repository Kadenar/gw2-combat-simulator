import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const ENFORCE_SLICE_ALIGNMENT = true;
const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const PROFESSIONS_ROOT = path.join(REPOSITORY_ROOT, 'js/professions');

const SLOT_FILES = [
  ['data.handlers', 'handlers.js'],
  ['data.skillMechanics', 'skills.js'],
  ['data.extraSkills', 'skills.js'],
  ['data.supplementalSkillMechanics', 'skills.js'],
  ['state.scheduler', 'state.js'],
  ['state.resolver', 'state.js'],
  ['state.project', 'state.js'],
  ['mechanics.modifiers', 'rules.js'],
  ['mechanics.availability', 'rules.js'],
  ['mechanics.castRules', 'rules.js'],
  ['mechanics.schedulerHooks', 'rules.js'],
  ['mechanics.reactions', 'resolver.js'],
  ['mechanics.resolverHooks.eventHandlers', 'resolver.js'],
  ['presentation', 'ui.js']
];

// Scheduler snapshots serialize profession state rather than implement scheduling rules.
// Family migrations may import them from state.ts directly; legacy slices may still re-export them through rules.ts.
const SLOT_PROPERTY_FILES = new Map([
  ['mechanics.schedulerHooks', new Map([['snapshot', new Set(['rules.js', 'state.js'])]])]
]);

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function collectSlices() {
  const professions = await readdir(PROFESSIONS_ROOT, { withFileTypes: true });
  const slices = [];

  for (const profession of professions) {
    if (!profession.isDirectory()) continue;

    const professionRoot = path.join(PROFESSIONS_ROOT, profession.name);

    if (!(await isFile(path.join(professionRoot, 'modules.ts')))) continue;

    const coreModule = path.join(professionRoot, 'core/module.ts');

    if (await isFile(coreModule)) {
      slices.push({
        name: `${profession.name}/core`,
        modulePath: coreModule,
        professionRoot
      });
    }

    const specializationsRoot = path.join(professionRoot, 'specializations');
    let specializations = [];

    try {
      specializations = await readdir(specializationsRoot, {
        withFileTypes: true
      });
    } catch {
      // A native profession may have no specialization slices yet.
    }

    for (const specialization of specializations) {
      if (!specialization.isDirectory()) continue;
      const modulePath = path.join(specializationsRoot, specialization.name, 'module.ts');

      if (await isFile(modulePath)) {
        slices.push({
          name: `${profession.name}/${specialization.name}`,
          modulePath,
          professionRoot
        });
      }
    }
  }

  return slices.sort((left, right) => left.name.localeCompare(right.name));
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;

  return undefined;
}

function findProperty(object, name) {
  if (!object || !ts.isObjectLiteralExpression(object)) return undefined;

  return object.properties.find((property) => ts.isPropertyAssignment(property) && propertyName(property.name) === name)
    ?.initializer;
}

function findNestedProperty(root, names) {
  let value = root;

  for (const name of names) {
    value = findProperty(value, name);

    if (!value) return undefined;
  }

  return value;
}

function findModuleDefinition(sourceFile) {
  let definition;

  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'defineNativeModule' &&
      node.arguments.length > 0 &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      definition = node.arguments[0];

      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return definition;
}

function findDataDefinition(moduleDefinition) {
  const data = findProperty(moduleDefinition, 'data');

  if (ts.isObjectLiteralExpression(data)) return data;

  if (!ts.isCallExpression(data)) return undefined;

  return [...data.arguments].reverse().find((argument) => ts.isObjectLiteralExpression(argument));
}

function collectImports(sourceFile) {
  const imports = new Map();

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }

    const moduleSpecifier = statement.moduleSpecifier.text;
    const clause = statement.importClause;

    if (!clause) continue;

    if (clause.name) imports.set(clause.name.text, moduleSpecifier);

    const bindings = clause.namedBindings;

    if (bindings && ts.isNamespaceImport(bindings)) {
      imports.set(bindings.name.text, moduleSpecifier);
    } else if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        imports.set(element.name.text, moduleSpecifier);
      }
    }
  }

  return imports;
}

function collectReferencedIdentifiers(expression, ignoredProperties = new Set()) {
  const identifiers = new Set();

  function visit(node) {
    if (ts.isTypeNode(node)) return;

    if (ts.isIdentifier(node)) {
      identifiers.add(node.text);

      return;
    }

    if (ts.isPropertyAccessExpression(node)) {
      visit(node.expression);

      return;
    }

    if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node.name);

      if (name && ignoredProperties.has(name)) return;

      visit(node.initializer);

      return;
    }

    if (ts.isShorthandPropertyAssignment(node)) {
      identifiers.add(node.name.text);

      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(expression);

  return identifiers;
}

function professionImports(expression, imports, sliceRoot, ignoredProperties = new Set()) {
  const origins = new Set();

  for (const identifier of collectReferencedIdentifiers(expression, ignoredProperties)) {
    const moduleSpecifier = imports.get(identifier);

    if (!moduleSpecifier?.startsWith('.')) continue;

    const resolvedImport = path.resolve(sliceRoot, moduleSpecifier);

    if (!resolvedImport.startsWith(PROFESSIONS_ROOT + path.sep)) continue;

    if (resolvedImport.includes(`${path.sep}data${path.sep}`)) continue;
    origins.add(path.basename(moduleSpecifier));
  }

  return origins;
}

function slotExpression(moduleDefinition, slot) {
  const names = slot.split('.');

  if (names[0] === 'presentation') {
    return findProperty(moduleDefinition, 'presentation');
  }

  const section = names[0] === 'data' ? findDataDefinition(moduleDefinition) : findProperty(moduleDefinition, names[0]);

  return findNestedProperty(section, names.slice(1));
}

async function auditSlice(slice) {
  const source = await readFile(slice.modulePath, 'utf8');
  const sourceFile = ts.createSourceFile(slice.modulePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const moduleDefinition = findModuleDefinition(sourceFile);

  assert.ok(moduleDefinition, `${slice.name}: defineNativeModule({...}) was not found`);

  const imports = collectImports(sourceFile);
  const sliceRoot = path.dirname(slice.modulePath);
  const violations = [];

  for (const [slot, expectedFile] of SLOT_FILES) {
    const expression = slotExpression(moduleDefinition, slot);

    if (!expression) continue;

    const propertyFiles = SLOT_PROPERTY_FILES.get(slot);
    const origins = professionImports(expression, imports, sliceRoot, new Set(propertyFiles?.keys()));

    if (origins.size === 0) {
      violations.push(`${slice.name}: ${slot} is inline, expected ${expectedFile}`);
      continue;
    }

    for (const origin of origins) {
      if (origin !== expectedFile) {
        violations.push(`${slice.name}: ${slot} imported from ${origin}, expected ${expectedFile}`);
      }
    }

    for (const [property, allowedFiles] of propertyFiles || []) {
      const propertyExpression = findProperty(expression, property);

      if (!propertyExpression) continue;

      const propertyOrigins = professionImports(propertyExpression, imports, sliceRoot);

      if (propertyOrigins.size === 0) {
        violations.push(`${slice.name}: ${slot}.${property} is inline, expected ${[...allowedFiles].join(' or ')}`);
        continue;
      }

      for (const origin of propertyOrigins) {
        if (!allowedFiles.has(origin)) {
          violations.push(
            `${slice.name}: ${slot}.${property} imported from ${origin}, expected ${[...allowedFiles].join(' or ')}`
          );
        }
      }
    }
  }

  return violations;
}

async function auditHandlerBoundary(slice) {
  const sliceRoot = path.dirname(slice.modulePath);
  const handlersPath = path.join(sliceRoot, 'handlers.ts');
  const rulesPath = path.join(sliceRoot, 'rules.ts');
  const violations = [];
  const moduleSource = await readFile(slice.modulePath, 'utf8');
  const moduleFile = ts.createSourceFile(
    slice.modulePath,
    moduleSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const moduleDefinition = findModuleDefinition(moduleFile);
  const handlersSlot = moduleDefinition ? slotExpression(moduleDefinition, 'data.handlers') : undefined;
  const handlersExist = await isFile(handlersPath);

  if (handlersExist && !handlersSlot) {
    violations.push(`${slice.name}: handlers.ts exists without a data.handlers slot`);
  }

  if (handlersExist) {
    const source = await readFile(handlersPath, 'utf8');

    if (!/export\s+const\s+\w*SkillHandlers\b/.test(source)) {
      violations.push(`${slice.name}: handlers.ts does not export a skill-handler registry`);
    }

    if (/\b(?:hasTrait|has[A-Z][A-Za-z]*Trait)\s*\(/.test(source)) {
      violations.push(`${slice.name}: handlers.ts performs a trait lookup`);
    }

    if (/\bTRAIT\s*\.|\b[A-Z_]+_TRAIT_IDS\b/.test(source)) {
      violations.push(`${slice.name}: handlers.ts references trait IDs`);
    }

    if (/source\s*:\s*["']Trait["']/.test(source)) {
      violations.push(`${slice.name}: handlers.ts emits a trait-owned event`);
    }

    if (/Object\.freeze\(\s*\{\s*\}\s*\)/.test(source)) {
      violations.push(`${slice.name}: handlers.ts exports an empty registry`);
    }
  }

  if (await isFile(rulesPath)) {
    const source = await readFile(rulesPath, 'utf8');

    if (/from\s+["']\.\/handlers\.js["']/.test(source)) {
      violations.push(`${slice.name}: rules.ts imports handlers.ts`);
    }
  }

  return violations;
}

async function findForbiddenFiles(directory) {
  const violations = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      violations.push(...(await findForbiddenFiles(entryPath)));
    } else if (['attribute-rules.ts', 'trait-rules.ts'].includes(entry.name)) {
      violations.push(entryPath);
    }
  }

  return violations;
}

test('native profession slices follow the canonical file contract', async () => {
  const slices = await collectSlices();
  const professionRoots = [...new Set(slices.map((slice) => slice.professionRoot))];
  const forbiddenFiles = (await Promise.all(professionRoots.map(findForbiddenFiles))).flat();
  const violations = [
    ...(await Promise.all(slices.map(auditSlice))).flat(),
    ...(await Promise.all(slices.map(auditHandlerBoundary))).flat(),
    ...forbiddenFiles.map((filePath) => `${path.relative(PROFESSIONS_ROOT, filePath)}: forbidden file exists`)
  ];

  if (violations.length > 0) {
    const report = `Slice alignment violations:\n${violations.map((violation) => `- ${violation}`).join('\n')}`;

    if (ENFORCE_SLICE_ALIGNMENT) assert.fail(report);
    console.warn(report);
  }
});
