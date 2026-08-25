import type { SkillEffect } from '../../platform/engine/types.js';
import type {
  NativePatchAuthoringMetadata,
  NativePatchAuthoringSkill
} from '../../platform/gw2/authoring/module-types.js';
import {
  PATCHABLE_EFFECT_NUMERIC_FIELDS,
  type EffectPatch,
  type ModifierRulePatchEdit,
  type PatchOverviewEntry,
  type PatchPreview,
  type SkillPatchEdit
} from '../../platform/gw2/authoring/patches.js';
import { type NumEdit } from '../../platform/gw2/authoring/patch-types.js';

type MutableRecord = Record<string, unknown>;

export interface PatchAuthoringSkillGroup {
  readonly key: string;
  readonly label: string;
  readonly skills: readonly NativePatchAuthoringSkill[];
}

interface SkillGroupIdentity {
  readonly key: string;
  readonly label: string;
  readonly order: number;
}

function skillGroupIdentity(entry: NativePatchAuthoringSkill): SkillGroupIdentity {
  const type = String(entry.skill.type || 'Skill');
  if (type === 'Weapon') {
    const weapon = String(entry.skill.weapon || '').trim();
    return weapon
      ? { key: `weapon:${weapon}`, label: `${weapon} weapon`, order: 0 }
      : {
          key: 'weapon:other',
          label: 'Weapon and kit skills',
          order: 1
        };
  }

  if (type === 'Heal') {
    return { key: 'slot:heal', label: 'Heal skills', order: 2 };
  }

  if (type === 'Utility') {
    return { key: 'slot:utility', label: 'Utility skills', order: 3 };
  }

  if (type === 'Elite') {
    return { key: 'slot:elite', label: 'Elite skills', order: 4 };
  }

  if (type === 'Profession') {
    return { key: 'profession', label: 'Profession skills', order: 5 };
  }

  return {
    key: 'triggered',
    label: 'Actions and triggered skills',
    order: 6
  };
}

export function groupPatchAuthoringSkills(
  skills: readonly NativePatchAuthoringSkill[]
): readonly PatchAuthoringSkillGroup[] {
  const groups = new Map<string, SkillGroupIdentity & { skills: NativePatchAuthoringSkill[] }>();
  for (const skill of skills) {
    const identity = skillGroupIdentity(skill);
    const group = groups.get(identity.key) || { ...identity, skills: [] };
    group.skills.push(skill);
    groups.set(identity.key, group);
  }

  return [...groups.values()]
    .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label))
    .map(({ key, label, skills: entries }) => ({
      key,
      label,
      skills: entries.sort((left, right) => left.name.localeCompare(right.name))
    }));
}

export function createPatchPreviewDraft(): PatchPreview {
  return {
    id: 'upcoming-patch',
    label: 'Upcoming Patch',
    professions: {}
  };
}

export function numericEditValue(liveValue: number, edit?: NumEdit): number {
  if (edit == null) return liveValue;
  if (typeof edit === 'number') return edit;
  if ('from' in edit) return edit.to;
  if ('multiply' in edit) return liveValue * edit.multiply;
  return liveValue + edit.add;
}

export function numericEditForValue(liveValue: number, previewValue: number): NumEdit | undefined {
  return Object.is(liveValue, previewValue) ? undefined : { from: liveValue, to: previewValue };
}

export function createEffectTemplate(type: string): SkillEffect {
  switch (type) {
    case 'condition':
      return {
        type,
        condition: 'Bleeding',
        stacks: 1,
        duration: 1,
        atMs: 0
      };
    case 'boon':
      return { type, boon: 'Might', stacks: 1, duration: 1, atMs: 0 };
    case 'buff':
      return { type, kind: 'buff', stacks: 1, duration: 1, atMs: 0 };
    case 'control':
    case 'blind':
      return { type, atMs: 0 };
    case 'custom':
      return { type, eventType: 'custom', event: {}, atMs: 0 };
    default:
      return { type: 'strike', coefficient: 1, hits: 1, atMs: 0 };
  }
}

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
  quicknessCastTimeMs: 'Quickness cast time',
  recharge: 'recharge',
  resourceCost: 'resource cost',
  stacks: 'stacks'
});

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] || field.replaceAll(/([a-z])([A-Z])/g, '$1 $2').toLocaleLowerCase();
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

function describeNumEdit(field: string, edit: NumEdit): string {
  const label = fieldLabel(field);
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

function effectTarget(patch: EffectPatch): string {
  const selector =
    patch.effectIndex != null
      ? `effect ${patch.effectIndex}`
      : patch.name || patch.condition || patch.boon || patch.type || 'effect';
  return patch.tickIndex == null ? selector : `${selector} tick ${String(patch.tickIndex)}`;
}

function effectIdentity(effect: Readonly<SkillEffect>): string {
  const detail = effect.name || effect.condition || effect.boon || effect.kind;
  return `${effect.type}${detail ? ` ${String(detail)}` : ''}`;
}

function skillPatchSummary(edit: SkillPatchEdit): string {
  const changes = new Set<string>();
  for (const [field, numericEdit] of Object.entries(edit.fields || {})) {
    changes.add(describeNumEdit(field, numericEdit));
  }

  for (const [field, numericEdit] of [
    ['cooldown', edit.cooldown],
    ['castTimeMs', edit.castTimeMs],
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
    for (const field of PATCHABLE_EFFECT_NUMERIC_FIELDS) {
      const numericEdit = effect[field];
      if (numericEdit != null) {
        changes.add(`${effectTarget(effect)} ${describeNumEdit(field, numericEdit)}`);
      }
    }
  }

  for (const effect of edit.addEffects || []) {
    changes.add(`added ${effectIdentity(effect)} effect`);
  }

  for (const selector of edit.removeEffects || []) {
    changes.add(`removed ${effectTarget(selector)}`);
  }

  const summary = [...changes].join('; ');
  return summary ? `${summary[0].toLocaleUpperCase()}${summary.slice(1)}.` : 'Skill metadata changed.';
}

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

function generatedBalanceProfileOverview(
  profiles: Readonly<Record<string, SkillPatchEdit>>,
  metadata: NativePatchAuthoringMetadata | undefined
): PatchOverviewEntry[] {
  const names = new Map<string, string>();
  for (const module of metadata?.modules || []) {
    for (const entry of module.balanceProfiles || []) {
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
  return summary ? `${summary[0].toLocaleUpperCase()}${summary.slice(1)}.` : 'Modifier metadata changed.';
}

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

export function generatePatchOverview(
  preview: PatchPreview,
  metadata: readonly NativePatchAuthoringMetadata[]
): PatchPreview {
  const generated = structuredClone(preview) as PatchPreview;
  const professions = generated.professions as Record<string, MutableRecord> | undefined;
  delete (generated as unknown as MutableRecord).notes;
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

function compactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const values = value.map(compactValue).filter((entry) => entry !== undefined);
    return values.length ? values : undefined;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value).flatMap(([key, child]) => {
      const compacted = compactValue(child);
      return compacted === undefined ? [] : [[key, compacted]];
    });
    return entries.length ? Object.fromEntries(entries) : undefined;
  }

  return value === undefined ? undefined : value;
}

export function compactPatchPreview(preview: PatchPreview): PatchPreview {
  const compacted = compactValue(structuredClone(preview)) as MutableRecord | undefined;
  if (!compacted) return createPatchPreviewDraft();
  compacted.id = preview.id;
  compacted.label = preview.label;
  return compacted as unknown as PatchPreview;
}

export function patchSearchText(...values: unknown[]): string {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value == null ? '' : String(value)]))
    .join(' ')
    .toLocaleLowerCase();
}
