/**
 * @fileoverview Generates a report of the active patch preview.
 * @module patch-preview-report
 * @example
 *   node scripts/patch-preview/patch-preview-report.mjs
 */

import { fileURLToPath } from 'node:url';

import { activePatchPreview } from '#gw2/integrations/patches/active-preview.js';
import { withActivePatchPreview } from '#gw2/integrations/patches/active-profession.js';
import { loadProfession } from '#gw2/profession-registry.js';

import { assertPromotionReady, reworkChecklist, reworkExtensionPoints } from './rework-lifecycle.mjs';

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

// Generates a report of the active patch preview, including professions, skills, and modifier rules.
for (const [professionId, patch] of Object.entries(activePatchPreview.professions || {})) {
  const nativeProfession = await loadProfession(professionId);

  if (!nativeProfession) {
    throw new Error(`Unknown patch-preview profession ${professionId}.`);
  }

  // Reporting opts into patch decoration after the neutral profession is loaded.
  const profession = withActivePatchPreview(nativeProfession);

  profession.resolvePatch({ id: activePatchPreview.id }).catalog;

  for (const specialization of [
    'Core',
    ...(profession.nativeDefinition.modules.slice(1).map((module) => module.id) || [])
  ]) {
    profession.resolveProfession({
      specialization,
      patchId: activePatchPreview.id
    });
  }

  console.log(`\n${profession.name}`);

  // Every temporary declaration gets a removal checklist, including reused tooltip IDs.
  const tooltipModule = await import(`#gw2/professions/${professionId}/app/tooltips.js`);
  console.log('  Reworks');
  for (const item of reworkChecklist(profession, tooltipModule[`${professionId}Tooltips`], patch)) {
    console.log(`  [ ] ${item}`);
  }

  console.log('  Provisional controls');
  for (const control of patch.provisional ?? []) {
    console.log(`  [ ] ${control.id}: ${control.label} (${control.profileId}.${control.field})`);
  }

  for (const key of Object.keys(patch.skills || {})) {
    const numericId = /^\d+$/.test(key) ? Number(key) : null;
    const skill =
      profession.catalog.skillsById.get(key) ||
      (numericId == null ? null : profession.catalog.skillsById.get(numericId));

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
}

console.log('\nRework extension points');
for (const point of await reworkExtensionPoints(fileURLToPath(new URL('../../js', import.meta.url)))) {
  console.log(`  [ ] ${point.variant}: js/${point.file}:${point.line}`);
}

if (process.argv.includes('--promotion')) assertPromotionReady(activePatchPreview);
