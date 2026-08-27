/**
 * @fileoverview Generates a report of the active patch preview.
 * @module patch-preview-report
 * @example
 *   node scripts/patch-preview/patch-preview-report.mjs
 */

import { activePatchPreview } from '../../dist/js/patches/active-preview.js';
import { loadProfession } from '../../dist/js/app/profession/registry.js';

if (!activePatchPreview) {
  console.log('No active patch preview is authored.');
  process.exit(0);
}

console.log(`Patch preview: ${activePatchPreview.label} (${activePatchPreview.id})`);

// Describes a numeric edit for reporting purposes.
function describeNumericEdit(edit) {
  if (typeof edit === 'number') return `set to ${edit}`;

  if ('from' in edit) return `${edit.from} -> ${edit.to}`;

  if ('multiply' in edit) return `multiply by ${edit.multiply}`;

  return `add ${edit.add}`;
}

// Generates a report of the active patch preview, including professions, skills, modifier rules, and constants.
for (const [professionId, patch] of Object.entries(activePatchPreview.professions || {})) {
  const profession = await loadProfession(professionId);

  if (!profession) {
    throw new Error(`Unknown patch-preview profession ${professionId}.`);
  }

  profession.catalogFor?.(activePatchPreview.id);

  for (const specialization of ['Core', ...(profession.specializationIds || [])]) {
    profession.resolveRuntime({
      specialization,
      patchId: activePatchPreview.id
    });
  }

  console.log(`\n${profession.name}`);

  for (const key of Object.keys(patch.skills || {})) {
    const numericId = /^\d+$/.test(key) ? Number(key) : null;
    const skill =
      profession.catalog.skillsById.get(key) ||
      (numericId == null ? null : profession.catalog.skillsById.get(numericId)) ||
      profession.catalog.skillsByName.get(key);

    if (!skill) throw new Error(`Unknown ${profession.name} skill ${key}.`);
    console.log(`  [ ] skill ${skill.name} (${String(skill.id)})`);
  }

  const modifierTargets = new Map((profession.previewModifierRuleTargets || []).map((target) => [target.id, target]));

  for (const [id, edit] of Object.entries(patch.modifierRules || {})) {
    const target = modifierTargets.get(id);

    if (!target) {
      throw new Error(`Unknown ${profession.name} modifier rule ${id}.`);
    }

    for (const field of ['amount', 'factor']) {
      if (!Object.hasOwn(edit, field)) continue;
      console.log(`  [ ] modifier ${id} (${target.moduleId}) ${field}: ${describeNumericEdit(edit[field])}`);
    }

    for (const [name, numericEdit] of Object.entries(edit.parameters || {})) {
      console.log(`  [ ] modifier ${id} (${target.moduleId}) parameters.${name}: ${describeNumericEdit(numericEdit)}`);
    }
  }

  for (const key of Object.keys(patch.constants || {})) {
    console.log(`  [ ] constant ${key}`);
  }
}

for (const key of Object.keys(activePatchPreview.constants || {})) {
  console.log(`\n[ ] global constant ${key}`);
}
