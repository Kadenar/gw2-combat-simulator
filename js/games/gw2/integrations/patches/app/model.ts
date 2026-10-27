import { AURA, BOON, CONDITION } from '#gw2/platform/constants.js';
import type { SkillEffect } from '#gw2/platform/effects/types.js';
import type { NativePatchAuthoringSkill } from '#gw2/integrations/patches/authoring/module-types.js';
import type { PatchPreview } from '#gw2/integrations/patches/authoring/patches.js';
import { numericFieldSpec, patchFieldLabel } from '#gw2/integrations/patches/authoring/overview-generation.js';
import type { NumericFieldSpec } from '#gw2/platform/skills/field-specs.js';
import { type NumEdit } from '#gw2/integrations/patches/authoring/patch-types.js';

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
        condition: CONDITION.BLEEDING,
        stacks: 1,
        duration: 1
      };
    case 'boon':
      return { type, boon: BOON.MIGHT, stacks: 1, duration: 1 };
    case 'buff':
      return { type, kind: 'buff', stacks: 1, duration: 1 };
    case 'control':
      return { type };
    case 'aura':
      return { type, aura: AURA.FIRE, duration: 1 };
    case 'custom':
      return { type, eventType: 'custom', event: {} };
    default:
      return { type: 'strike', coefficient: 1, hits: 1 };
  }
}

/** Shows both an effect's context label and payload without requiring raw metadata inspection. */
export function effectDetail(effect: Readonly<SkillEffect>): string {
  const firstTick = Array.isArray(effect.ticks) ? effect.ticks[0] : undefined;
  const details = [effect.name, effect.condition, effect.boon, effect.aura, effect.kind, firstTick?.condition].filter(
    (detail): detail is string => typeof detail === 'string' && detail.length > 0
  );
  return [...new Set(details)].join(' · ');
}

/**
 * Produces author-facing labels and units without changing stable runtime field names. A profession-owned skill field
 * passes its declaration; shared skill fields and profile fields resolve without one.
 */
export function authoringNumericFieldLabel(field: string, spec?: Pick<NumericFieldSpec, 'label' | 'unit'>): string {
  const label = patchFieldLabel(field, spec);
  const unit = numericFieldSpec(field, spec)?.unit;

  if (unit === 'milliseconds' || (!unit && field.endsWith('Ms'))) return `${label.replace(/ ms$/i, '')} (ms)`;

  if (unit === 'seconds') return `${label} (s)`;

  if (unit === 'probability') return `${label} (0-1)`;

  // Display the descriptor's storage unit without rescaling patch values.
  if (unit === 'fraction') return `${label} (fraction)`;

  if (unit === 'factor') return `${label} (factor)`;

  if (unit === 'attribute') return `${label} (points)`;

  if (unit === 'percent') return `${label} (%)`;

  return label;
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
  const compacted = compactValue(structuredClone(preview)) as Record<string, unknown> | undefined;

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
