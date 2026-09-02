import type { SkillEffect } from '#gw2/platform/engine/types.js';
import type {
  NativePatchAuthoringMetadata,
  NativePatchAuthoringSkill
} from '#gw2/integrations/patches/authoring/module-types.js';
import {
  PATCHABLE_EFFECT_NUMERIC_FIELDS,
  type EffectPatch,
  type ModifierRulePatchEdit,
  type PatchOverviewEntry,
  type PatchPreview,
  type SkillPatchEdit
} from '#gw2/integrations/patches/authoring/patches.js';
import { type NumEdit } from '#gw2/integrations/patches/authoring/patch-types.js';

type MutableRecord = Record<string, unknown>;

export interface PatchAuthoringSkillGroup {
  readonly key: string;
  readonly label: string;
  readonly skills: readonly NativePatchAuthoringSkill[];
  readonly attunementGroups: readonly PatchAuthoringSkillAttunementGroup[];
}

export interface PatchAuthoringSkillAttunementGroup {
  readonly key: string;
  readonly label: string;
  readonly skills: readonly NativePatchAuthoringSkill[];
}

interface SkillGroupIdentity {
  readonly key: string;
  readonly label: string;
  readonly order: number;
}

const ELEMENTALIST_ATTUNEMENT_ORDER = new Map(
  ['Air', 'Earth', 'Fire', 'Water', 'Dual', 'Other'].map((attunement, index) => [attunement, index])
);

/** Normalizes a skill's attunement into the small set of authoring navigation buckets. */
function skillAttunementGroup(entry: NativePatchAuthoringSkill): string | null {
  const attunement = String(entry.skill.attunement || '');
  if (!attunement) return null;
  if (attunement.includes('+')) return 'Dual';
  return ELEMENTALIST_ATTUNEMENT_ORDER.has(attunement) ? attunement : 'Other';
}

/** Adds Elementalist attunement buckets beneath weapon groups while leaving other profession groups flat. */
function groupSkillsByAttunement(
  skills: readonly NativePatchAuthoringSkill[]
): readonly PatchAuthoringSkillAttunementGroup[] {
  if (!skills.some(skillAttunementGroup)) return [];

  const groups = new Map<string, NativePatchAuthoringSkill[]>();
  for (const skill of skills) {
    const label = skillAttunementGroup(skill) || 'Other';
    const entries = groups.get(label) || [];
    entries.push(skill);
    groups.set(label, entries);
  }

  return [...groups]
    .sort(
      ([left], [right]) =>
        (ELEMENTALIST_ATTUNEMENT_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (ELEMENTALIST_ATTUNEMENT_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER)
    )
    .map(([label, entries]) => ({
      key: label.toLocaleLowerCase(),
      label,
      skills: entries
    }));
}

/** Assigns a skill to a stable weapon, slot, profession, or triggered-action group. */
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

/** Builds ordered, searchable skill groups for the authoring navigation. */
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
    .map(({ key, label, skills: entries }) => {
      const sortedSkills = entries.sort((left, right) => left.name.localeCompare(right.name));
      return {
        key,
        label,
        skills: sortedSkills,
        attunementGroups: key.startsWith('weapon:') ? groupSkillsByAttunement(sortedSkills) : []
      };
    });
}

/** Creates the minimal valid preview shell used before an active preview exists. */
export function createPatchPreviewDraft(): PatchPreview {
  return {
    id: 'upcoming-patch',
    label: 'Upcoming Patch',
    professions: {}
  };
}

/** Resolves every supported numeric edit form to the value shown in the editor. */
export function numericEditValue(liveValue: number, edit?: NumEdit): number {
  if (edit == null) return liveValue;
  if (typeof edit === 'number') return edit;
  if ('from' in edit) return edit.to;
  if ('multiply' in edit) return liveValue * edit.multiply;
  return liveValue + edit.add;
}

/** Emits a guarded replacement only when the author changed the live value. */
export function numericEditForValue(liveValue: number, previewValue: number): NumEdit | undefined {
  return Object.is(liveValue, previewValue) ? undefined : { from: liveValue, to: previewValue };
}

/** Provides a valid editable starter payload for each effect type the UI can add. */
export function createEffectTemplate(type: string): SkillEffect {
  switch (type) {
    case 'condition':
      return {
        type,
        condition: 'Bleeding',
        stacks: 1,
        duration: 1
      };
    case 'boon':
      return { type, boon: 'Might', stacks: 1, duration: 1 };
    case 'buff':
      return { type, kind: 'buff', stacks: 1, duration: 1 };
    case 'control':
    case 'blind':
      return { type };
    case 'custom':
      return { type, eventType: 'custom', event: {} };
    default:
      return { type: 'strike', coefficient: 1, hits: 1 };
  }
}

/** Shows both an effect's context label and payload without requiring raw metadata inspection. */
export function effectDetail(effect: Readonly<SkillEffect>): string {
  const firstTick = Array.isArray(effect.ticks) ? effect.ticks[0] : undefined;
  const details = [effect.name, effect.condition, effect.boon, effect.kind, firstTick?.condition].filter(
    (detail): detail is string => typeof detail === 'string' && detail.length > 0
  );
  return [...new Set(details)].join(' · ');
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

const SECOND_FIELDS = new Set([
  'ammoCastLockout',
  'ammoRecharge',
  'baseDuration',
  'cooldown',
  'duration',
  'durationPerTier',
  'enhancedDuration',
  'highDuration',
  'internalCooldown',
  'packetInterval',
  'pulseInterval',
  'recharge',
  'rechargeReduction',
  'summonInterval'
]);

/** Produces author-facing labels and units without changing stable runtime field names. */
export function authoringNumericFieldLabel(field: string, profile = false): string {
  if (profile && field === 'durationMultiplier') return 'duration value (profile-specific)';
  const label = FIELD_LABELS[field] || field.replaceAll(/([a-z])([A-Z])/g, '$1 $2').toLocaleLowerCase();
  if (field.endsWith('Ms')) return `${label.replace(/ ms$/i, '')} (ms)`;
  if (SECOND_FIELDS.has(field)) return `${label} (s)`;
  if (field === 'procChance' || field === 'criticalChance') return `${label} (0-1)`;
  return label;
}

/** Converts stable storage keys into concise labels used by generated overview prose. */
function fieldLabel(field: string): string {
  return FIELD_LABELS[field] || field.replaceAll(/([a-z])([A-Z])/g, '$1 $2').toLocaleLowerCase();
}

/** Keeps generated numeric summaries compact while avoiding floating-point noise. */
function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

/** Describes one numeric edit in human-readable patch-note language. */
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
  return summary ? `${summary[0].toLocaleUpperCase()}${summary.slice(1)}.` : 'Skill metadata changed.';
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
  return summary ? `${summary[0].toLocaleUpperCase()}${summary.slice(1)}.` : 'Modifier metadata changed.';
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

/** Removes undefined and empty containers while retaining meaningful falsy values. */
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

/** Compacts a preview before saving while preserving its required identity fields. */
export function compactPatchPreview(preview: PatchPreview): PatchPreview {
  const compacted = compactValue(structuredClone(preview)) as MutableRecord | undefined;
  if (!compacted) return createPatchPreviewDraft();
  compacted.id = preview.id;
  compacted.label = preview.label;
  return compacted as unknown as PatchPreview;
}

/** Normalizes heterogeneous metadata into one lowercase search string. */
export function patchSearchText(...values: unknown[]): string {
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value == null ? '' : String(value)]))
    .join(' ')
    .toLocaleLowerCase();
}
