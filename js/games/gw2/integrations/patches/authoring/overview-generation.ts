import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { NativePatchAuthoringMetadata } from '#gw2/integrations/patches/authoring/module-types.js';
import type {
  EffectPatch,
  ModifierRulePatchEdit,
  PatchOverviewEntry,
  PatchPreview,
  SkillPatchEdit
} from '#gw2/integrations/patches/authoring/patches.js';
import { PATCHABLE_EFFECT_NUMERIC_FIELDS } from '#gw2/integrations/patches/authoring/fields.js';
import type { NumEdit } from '#gw2/integrations/patches/authoring/patch-types.js';

// Pure, DOM-free overview generation shared by the authoring UI, the authoring server, and build-relevant notes.

const FIELD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  ammoCastLockout: 'ammo cast lockout',
  ammoRecharge: 'ammo recharge',
  applications: 'applications',
  atMs: 'timing',
  castTimeMs: 'cast time',
  coefficient: 'coefficient',
  cooldown: 'cooldown',
  duration: 'duration',
  energyCost: 'energy cost',
  hits: 'hits',
  initiativeCost: 'initiative cost',
  intervalMs: 'interval',
  quicknessCastTimeMs: 'Summon Quickness cast time',
  recharge: 'recharge',
  resourceCost: 'resource cost',
  stacks: 'stacks'
});

/** Converts stable storage keys into concise labels shared by generated overview prose and editor field labels. */
export function patchFieldLabel(field: string): string {
  return FIELD_LABELS[field] || field.replaceAll(/([a-z])([A-Z])/g, '$1 $2').toLocaleLowerCase();
}

/** Keeps generated numeric summaries compact while avoiding floating-point noise. */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

/** Describes one numeric edit in human-readable patch-note language. */
function describeNumEdit(field: string, edit: NumEdit): string {
  const label = patchFieldLabel(field);

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
function skillPatchSummary(edit: SkillPatchEdit): string {
  const changes = new Set<string>();
  // Grant summaries use the same stable ids as their authoring controls, including conditional rewards.
  const describeGrants = (grants: SkillPatchEdit['resourceGrants'], prefix: string) => {
    for (const [id, fields] of Object.entries(grants ?? {}))
      for (const [field, value] of Object.entries(fields))
        changes.add(`${prefix}resource grant ${id} ${describeNumEdit(field, value)}`);
  };

  describeGrants(edit.resourceGrants, '');

  // Explain slot reworks in generated notes so saving the preview preserves their meaning.
  if (edit.placement) {
    changes.add(
      edit.placement.type === 'Weapon'
        ? `moved to ${edit.placement.weapon} ${edit.placement.slot.replace('Weapon_', '')}`
        : 'moved to a utility slot'
    );
  }

  for (const [field, numericEdit] of Object.entries(edit.fields || {})) {
    changes.add(describeNumEdit(field, numericEdit));
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
    text: skillPatchSummary(edit),
    source: 'skill-diff'
  }));
}

/** Generates overview entries for profile changes, including variants shown under Skills. */
function generatedBalanceProfileOverview(
  profiles: Readonly<Record<string, SkillPatchEdit>>,
  metadata: NativePatchAuthoringMetadata | undefined
): PatchOverviewEntry[] {
  const names = new Map<string, string>();
  for (const module of metadata?.modules || []) {
    for (const entry of [...(module.balanceProfiles || []), ...(module.skillVariants || [])]) {
      names.set(String(entry.id), entry.name);
      names.set(entry.name, entry.name);
    }
  }

  return Object.entries(profiles).map(([key, edit]) => ({
    subject: names.get(key) || key,
    text: skillPatchSummary(edit),
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

/** Rebuilds read-only overview text from the current authored diff and live metadata. */
export function generatePatchOverview(
  preview: PatchPreview,
  metadata: readonly NativePatchAuthoringMetadata[]
): PatchPreview {
  const generated = structuredClone(preview) as PatchPreview;
  const professions = generated.professions as Record<string, Record<string, unknown>> | undefined;
  delete (generated as unknown as Record<string, unknown>).notes;
  for (const [professionId, patch] of Object.entries(professions || {})) {
    delete patch.notes;
    const professionMetadata = metadata.find((entry) => entry.professionId === professionId);
    const skills = (patch.skills || {}) as Readonly<Record<string, SkillPatchEdit>>;
    const modifierRules = (patch.modifierRules || {}) as Readonly<Record<string, ModifierRulePatchEdit>>;
    const balanceProfiles = (patch.balanceProfiles || {}) as Readonly<Record<string, SkillPatchEdit>>;
    const overview = [
      ...generatedSkillOverview(skills, professionMetadata),
      ...generatedBalanceProfileOverview(balanceProfiles, professionMetadata),
      ...generatedModifierOverview(modifierRules, professionMetadata)
    ];

    if (overview.length) patch.overview = overview;
    else delete patch.overview;
  }

  return generated;
}
