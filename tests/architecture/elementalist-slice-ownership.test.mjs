import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { SPECIALIZATIONS } from '../../js/professions/elementalist/data/elementalist-api-metadata.js';

const CORE_ROOT = path.resolve(import.meta.dirname, '../../js/professions/elementalist/core');
const ELITE_NAMES = ['Tempest', 'Weaver', 'Catalyst', 'Evoker'];
const ELITE_TRAIT_NAMES = SPECIALIZATIONS.filter((specialization) => specialization.elite).flatMap((specialization) =>
  [specialization.minorTraits, specialization.majorTraits].flat(3).map((trait) => trait.name)
);

// Recurses through owner-local data folders so structural checks cannot miss split skill declarations.
async function typeScriptFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const target = path.join(root, entry.name);
      return entry.isDirectory() ? typeScriptFiles(target) : entry.name.endsWith('.ts') ? [target] : [];
    })
  );
  return files.flat().sort();
}

async function skillDeclarationFiles(root) {
  const files = [path.join(root, 'skills.ts')];
  try {
    files.push(...(await typeScriptFiles(path.join(root, 'skill-data'))));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  return files;
}

async function specializationSkillTokens() {
  const tokens = new Set();
  for (const name of ELITE_NAMES) {
    const root = path.resolve(CORE_ROOT, `../specializations/${name.toLowerCase()}`);
    for (const file of await skillDeclarationFiles(root)) {
      const source = await readFile(file, 'utf8');
      for (const match of source.matchAll(/\[ID\.([A-Z0-9_]+)\]/g)) tokens.add(match[1]);
    }
  }

  return [...tokens];
}

test('Elementalist Core does not own elite-specialization policy', async () => {
  const files = await typeScriptFiles(CORE_ROOT);
  const violations = [];
  const eliteSkillTokens = await specializationSkillTokens();

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const relative = path.relative(CORE_ROOT, file);

    if (/from\s+["'][^"']*specializations\//.test(source)) {
      violations.push(`${relative} imports a specialization slice`);
    }

    for (const name of ELITE_NAMES) {
      if (new RegExp(`\\b${name}\\b`).test(source)) {
        violations.push(`${relative} names ${name}`);
      }
    }

    for (const trait of ELITE_TRAIT_NAMES) {
      if (source.includes(`'${trait}'`) || source.includes(`"${trait}"`)) {
        violations.push(`${relative} names elite trait ${trait}`);
      }
    }

    for (const token of eliteSkillTokens) {
      if (new RegExp(`\\b${token}\\b`).test(source)) {
        violations.push(`${relative} references elite skill token ${token}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('Elementalist Core state excludes specialization-owned fields', async () => {
  const source = await readFile(path.join(CORE_ROOT, 'state.ts'), 'utf8');
  assert.doesNotMatch(
    source,
    /\b(?:secondaryAttunement|unravelUntil|weaveSelfUntil|energy|sphereActiveUntil|charges|empowered|elementalBalanceUntil)\s*:/
  );
});
