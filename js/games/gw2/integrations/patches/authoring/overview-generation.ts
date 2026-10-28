import { PATCHABLE_EFFECT_NUMERIC_FIELDS } from '#gw2/integrations/patches/authoring/fields.js';
import type { NativePatchAuthoringMetadata } from '#gw2/integrations/patches/authoring/module-types.js';
import type { NumEdit } from '#gw2/integrations/patches/authoring/patch-types.js';
import type {
  EffectPatch,
  ModifierRulePatchEdit,
  ProfessionPatchPreview,
  SkillPatchEdit
} from '#gw2/integrations/patches/authoring/patches.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { NumericFieldSpec } from '#gw2/platform/skills/field-specs.js';
import { SHARED_SKILL_FIELDS } from '#gw2/platform/skills/shared-fields.js';

// Presentation entries stay separate from the structured edits saved and consumed by the runtime.
export interface PatchOverviewEntry {
  readonly subject: string;
  readonly text: string;
  readonly source: 'skill-diff' | 'profile-diff' | 'modifier-diff';
}

// Effect fields whose concise label differs from their split storage key; skill fields declare their own labels.
const EFFECT_FIELD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  atMs: 'timing',
  intervalMs: 'interval'
});

/** A skill field's own declaration, or the shared declaration for profile and effect fields of the same name. */
export function numericFieldSpec(
  field: string,
  spec?: Pick<NumericFieldSpec, 'label' | 'unit'>
): Pick<NumericFieldSpec, 'label' | 'unit'> | undefined {
  const shared = Object.hasOwn(SHARED_SKILL_FIELDS, field) ? SHARED_SKILL_FIELDS[field] : undefined;
  return spec ?? (shared?.kind === 'number' ? shared : undefined);
}

/**
 * Converts stable storage keys into concise labels shared by generated overview prose and editor field labels.
 * Profession-owned skill fields pass their declaration, because only the selected profession knows them.
 */
export function patchFieldLabel(field: string, spec?: Pick<NumericFieldSpec, 'label' | 'unit'>): string {
  return (
    numericFieldSpec(field, spec)?.label ||
    EFFECT_FIELD_LABELS[field] ||
    field.replaceAll(/([a-z])([A-Z])/g, '$1 $2').toLocaleLowerCase()
  );
}

/** Keeps generated numeric summaries compact while avoiding floating-point noise. */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

/** Describes one numeric edit in human-readable patch-note language. */
function describeNumEdit(field: string, edit: NumEdit, spec?: Pick<NumericFieldSpec, 'label'>): string {
  const label = patchFieldLabel(field, spec);

  if (typeof edit === 'number') return `${label} set to ${formatNumber(edit)}`;

  if ('from' in edit) {
    return `${label} ${formatNumber(edit.from)} → ${formatNumber(edit.to)}`;
  }

  if ('multiply' in edit) {
    return `${label} x${formatNumber(edit.multiply)}`;
  }

  const sign = edit.add >= 0 ? '+' : '';
  return `${label} ${sign}${formatNumber(edit.add)}`;
}

/** Names the selected effect or tick for deterministic generated summaries. */
function effectTarget(patch: EffectPatch): string {
  const selector =
    patch.effectIndex != null
      ? `effect ${patch.effectIndex}`
      : patch.name || patch.condition || patch.boon || patch.type || 'effect';
  return patch.tickIndex == null ? selector : `${selector} tick ${String(patch.tickIndex)}`;
}

/** Builds a short identity for effects added as complete authored payloads. */
function effectIdentity(effect: Readonly<SkillEffect>): string {
  const detail = effect.name || effect.condition || effect.boon || effect.kind;
  return `${effect.type}${detail ? ` ${String(detail)}` : ''}`;
}

/** Collapses every skill-style field and effect edit into one generated sentence. */
function skillPatchSummary(
  edit: SkillPatchEdit,
  skillFields: Readonly<Record<string, Pick<NumericFieldSpec, 'label' | 'unit'>>> = {}
): string {
  const changes = new Set<string>();
  // Grant summaries use the same stable ids as their authoring controls, including conditional rewards.
  const describeGrants = (grants: SkillPatchEdit['resourceGrants'], prefix: string) => {
    for (const [id, fields] of Object.entries(grants ?? {}))
      for (const [field, value] of Object.entries(fields))
        changes.add(`${prefix}resource grant ${id} ${describeNumEdit(field, value)}`);
  };

  describeGrants(edit.resourceGrants, '');
  // Inline rewards retain their action identity in generated patch notes.
  for (const [id, changesForAction] of Object.entries(edit.sideEffects ?? {}))
    changes.add(`${id}: ${skillPatchSummary(changesForAction)}`);

  // Explain slot reworks alongside numeric changes when displaying the structured preview.
  if (edit.placement) {
    changes.add(
      edit.placement.type === 'Weapon'
        ? `moved to ${edit.placement.weapon} ${edit.placement.slot.replace('Weapon_', '')}`
        : 'moved to a utility slot'
    );
  }

  for (const [field, numericEdit] of Object.entries(edit.fields || {})) {
    changes.add(describeNumEdit(field, numericEdit, skillFields[field]));
  }

  for (const [field, numericEdit] of [
    ['cooldown', edit.cooldown],
    ['coefficient', edit.coefficient]
  ] as const) {
    if (numericEdit != null) changes.add(describeNumEdit(field, numericEdit));
  }

  for (const [condition, fields] of Object.entries(edit.conditions || {})) {
    for (const [field, numericEdit] of Object.entries(fields)) {
      if (numericEdit != null) {
        changes.add(`${condition} ${describeNumEdit(field, numericEdit)}`);
      }
    }
  }

  for (const [boon, fields] of Object.entries(edit.boons || {})) {
    for (const [field, numericEdit] of Object.entries(fields)) {
      if (numericEdit != null) {
        changes.add(`${boon} ${describeNumEdit(field, numericEdit)}`);
      }
    }
  }

  for (const effect of edit.effects || []) {
    describeGrants(effect.resourceGrants, `${effectTarget(effect)} `);
    for (const field of PATCHABLE_EFFECT_NUMERIC_FIELDS) {
      const numericEdit = effect[field];

      if (numericEdit != null) {
        changes.add(`${effectTarget(effect)} ${describeNumEdit(field, numericEdit)}`);
      }
    }

    const maximumRecipients = effect.audience?.maximumRecipients;

    if (maximumRecipients != null) {
      changes.add(`${effectTarget(effect)} ${describeNumEdit('maximumRecipients', maximumRecipients)}`);
    }
  }

  for (const effect of edit.addEffects || []) {
    changes.add(`added ${effectIdentity(effect)} effect`);
  }

  for (const selector of edit.removeEffects || []) {
    changes.add(`removed ${effectTarget(selector)}`);
  }

  const summary = [...changes].join('; ');
  const text = summary ? `${summary[0].toLocaleUpperCase()}${summary.slice(1)}.` : 'Skill metadata changed.';
  // Trait balance edits retain the same provisional qualification as their displayed patch notes.
  return edit.assumption ? `${text} ${edit.assumption}` : text;
}

/** Generates overview entries for authored skill changes using live display names. */
function generatedSkillOverview(
  skills: Readonly<Record<string, SkillPatchEdit>>,
  metadata: NativePatchAuthoringMetadata | undefined
): PatchOverviewEntry[] {
  const names = new Map<string, string>();
  for (const module of metadata?.modules || []) {
    for (const skill of module.skills) {
      names.set(String(skill.id), skill.name);
      names.set(skill.name, skill.name);
    }
  }

  return Object.entries(skills).map(([key, edit]) => ({
    subject: names.get(key) || key,
    text: skillPatchSummary(edit, metadata?.skillFields),
    source: 'skill-diff'
  }));
}

/** Generates overview entries for profile changes, including variants shown under Skills. */
function generatedBalanceProfileOverview(
  profiles: Readonly<Record<string, SkillPatchEdit>>,
  metadata: NativePatchAuthoringMetadata | undefined
): PatchOverviewEntry[] {
  const names = new Map<string, string>();
  const fields = new Map<string, Readonly<Record<string, NumericFieldSpec>>>();
  for (const module of metadata?.modules || []) {
    for (const entry of module.balanceProfiles) {
      names.set(String(entry.id), entry.name);
      fields.set(String(entry.id), entry.fieldSpecs);
      names.set(entry.name, entry.name);
    }
  }

  return Object.entries(profiles).map(([key, edit]) => ({
    subject: names.get(key) || key,
    text: skillPatchSummary(edit, fields.get(key)),
    source: 'profile-diff'
  }));
}

/** Summarizes static and resolver-parameter modifier edits in one sentence. */
function modifierPatchSummary(edit: ModifierRulePatchEdit): string {
  const changes: string[] = [];
  for (const field of ['amount', 'factor'] as const) {
    const numericEdit = edit[field];

    if (numericEdit != null) {
      changes.push(describeNumEdit(field, numericEdit));
    }
  }

  for (const [name, numericEdit] of Object.entries(edit.parameters || {})) {
    changes.push(`parameter ${describeNumEdit(name, numericEdit)}`);
  }

  const summary = changes.join('; ');
  // Provisional percentages must stay visibly qualified whenever notes are rebuilt from numeric edits.
  const text = summary ? `${summary[0].toLocaleUpperCase()}${summary.slice(1)}.` : 'Modifier metadata changed.';
  return edit.assumption ? `${text} ${edit.assumption}` : text;
}

/** Generates overview entries for modifier-rule changes using declaration labels. */
function generatedModifierOverview(
  edits: Readonly<Record<string, ModifierRulePatchEdit>>,
  metadata: NativePatchAuthoringMetadata | undefined
): PatchOverviewEntry[] {
  const labels = new Map<string, string>();
  for (const module of metadata?.modules || []) {
    for (const rule of module.modifierRules) {
      labels.set(rule.id, rule.label || rule.id);
    }
  }

  return Object.entries(edits).map(([id, edit]) => ({
    subject: labels.get(id) || id,
    text: modifierPatchSummary(edit),
    source: 'modifier-diff'
  }));
}

/** Derives presentation text for one profession without copying or modifying the saved patch. */
export function generatePatchOverview(
  patch: ProfessionPatchPreview,
  metadata: NativePatchAuthoringMetadata | undefined
): readonly PatchOverviewEntry[] {
  return [
    ...generatedSkillOverview(patch.skills ?? {}, metadata),
    ...generatedBalanceProfileOverview(patch.balanceProfiles ?? {}, metadata),
    ...generatedModifierOverview(patch.modifierRules ?? {}, metadata)
  ];
}
