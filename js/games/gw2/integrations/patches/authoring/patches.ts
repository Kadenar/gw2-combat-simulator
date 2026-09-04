import {
  PATCHABLE_SKILL_NUMERIC_FIELDS,
  PATCHABLE_EFFECT_NUMERIC_FIELDS
} from '#gw2/integrations/patches/authoring/fields.js';
import { deepFreeze } from '#gw2/integrations/patches/authoring/immutable.js';
import type { NumEdit } from '#gw2/integrations/patches/authoring/patch-types.js';
import type {
  BalanceProfile,
  CanonicalCatalog,
  ConditionEffect,
  ConditionTick,
  Skill,
  SkillEffect,
  SkillId,
  StrikeEffect,
  StrikeTick
} from '#gw2/platform/engine/skills/types.js';
import type { Gw2ModifierRule } from '#gw2/platform/combat/modifiers/types.js';

export const CURRENT_PATCH_ID = 'current';

export interface PatchOverviewEntry {
  readonly subject: string;
  readonly text: string;
  readonly source: 'skill-diff' | 'profile-diff' | 'modifier-diff';
}

const PATCH_OVERVIEW_FIELDS = new Set(['subject', 'text', 'source']);

/** Validates the shape and required fields of authored patch overview entries. */
export function validatePatchOverview(
  entries: readonly PatchOverviewEntry[] | null | undefined,
  label = 'Patch preview overview'
): void {
  if (entries == null) return;
  if (!Array.isArray(entries)) {
    throw new TypeError(`${label} must be an array.`);
  }

  for (const [index, entry] of entries.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new TypeError(`${label}[${index}] must be an object.`);
    }

    for (const field of Object.keys(entry)) {
      if (!PATCH_OVERVIEW_FIELDS.has(field)) {
        throw new TypeError(`${label}[${index}] has unsupported field ${field}.`);
      }
    }

    if (!String(entry.subject || '').trim()) {
      throw new TypeError(`${label}[${index}].subject is required.`);
    }

    if (!String(entry.text || '').trim()) {
      throw new TypeError(`${label}[${index}].text is required.`);
    }

    if (entry.source !== 'skill-diff' && entry.source !== 'profile-diff' && entry.source !== 'modifier-diff') {
      throw new TypeError(`${label}[${index}].source is invalid.`);
    }
  }
}

export interface EffectSelector {
  /** Zero-based index in the skill's complete effects array. */
  readonly effectIndex?: number;
  readonly type?: SkillEffect['type'];
  readonly name?: string;
  readonly condition?: string;
  readonly boon?: string;
  /** Required when a selector intentionally targets multiple effects. */
  readonly all?: boolean;
}

export interface EffectPatch extends EffectSelector {
  /** Zero-based index in the selected effect's ticks, or every matching tick. */
  readonly tickIndex?: number | 'all';
  readonly allyStacks?: NumEdit;
  readonly coefficient?: NumEdit;
  readonly hits?: NumEdit;
  readonly stacks?: NumEdit;
  readonly duration?: NumEdit;
  readonly applications?: NumEdit;
  readonly intervalMs?: NumEdit;
  readonly flatDamage?: NumEdit;
  readonly flatStrikeBase?: NumEdit;
  readonly flatStrikePowerCoeff?: NumEdit;
  readonly durationPerAffinity?: NumEdit;
  readonly durationReductionPerAffinity?: NumEdit;
  readonly damageIncreasePerStack?: NumEdit;
  readonly damagePerCoefficient?: NumEdit;
  readonly audience?: {
    readonly maximumRecipients?: NumEdit;
  };
}

export interface SkillPatchEdit {
  /** Numeric balance fields such as cooldown or initiativeCost. */
  readonly fields?: Readonly<Record<string, NumEdit>>;
  readonly effects?: readonly EffectPatch[];
  /** Complete effects appended after edits/removals of existing effects. */
  readonly addEffects?: readonly SkillEffect[];
  /** Selectors for complete effects removed from the preview skill. */
  readonly removeEffects?: readonly EffectSelector[];

  /** Convenience shorthands for the common patch-note cases. */
  readonly coefficient?: NumEdit;
  readonly conditions?: Readonly<Record<string, { readonly stacks?: NumEdit; readonly duration?: NumEdit }>>;
  readonly boons?: Readonly<Record<string, { readonly stacks?: NumEdit; readonly duration?: NumEdit }>>;
  readonly cooldown?: NumEdit;
}

/** Patches a non-skill balance profile using the same numeric/effect grammar. */
export type BalanceProfilePatchEdit = SkillPatchEdit;

export interface ModifierRulePatchEdit {
  /** Direct numeric rule declarations. Resolver-backed fields use parameters. */
  readonly amount?: NumEdit;
  readonly factor?: NumEdit;
  /** Named numeric inputs consumed by a resolver-backed amount or factor. */
  readonly parameters?: Readonly<Record<string, NumEdit>>;
}

export interface ProfessionPatchPreview {
  readonly skills?: Readonly<Record<string, SkillPatchEdit>>;
  readonly balanceProfiles?: Readonly<Record<string, BalanceProfilePatchEdit>>;
  readonly modifierRules?: Readonly<Record<string, ModifierRulePatchEdit>>;
  readonly constants?: Readonly<Record<string, NumEdit>>;
  /** Deterministic summaries generated from skills and modifierRules. */
  readonly overview?: readonly PatchOverviewEntry[];
}

export interface PatchPreview {
  readonly id: string;
  readonly label: string;
  readonly publishedAt?: string;
  readonly sourceUrl?: string;
  readonly constants?: Readonly<Record<string, NumEdit>>;
  readonly professions?: Readonly<Record<string, ProfessionPatchPreview>>;
}

export type PatchRuntimeValues = Readonly<Record<string, NumEdit>>;

const SKILL_NUMERIC_FIELDS = new Set(PATCHABLE_SKILL_NUMERIC_FIELDS);
const EFFECT_NUMERIC_FIELDS = PATCHABLE_EFFECT_NUMERIC_FIELDS;

type MutableRecord = Record<string, unknown>;

/** Applies one numeric edit at a validated direct or dotted path on a cloned catalog record. */
function patchSkillNumericField(skill: MutableRecord, field: string, edit: NumEdit, skillName: string): void {
  const segments = field.split('.');
  const key = segments.pop()!;
  let owner = skill;
  for (const segment of segments) {
    const value = owner[segment];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError(`Skill ${skillName} does not expose ${field}.`);
    }

    owner = value as MutableRecord;
  }

  if (owner[key] == null) {
    throw new TypeError(`Skill ${skillName} does not expose ${field}.`);
  }

  owner[key] = applyNumEdit(Number(owner[key]), edit, `${skillName}.${field}`);
}

/** Coerces a value to a finite number so invalid authored math fails at its boundary. */
function numericValue(value: unknown, label: string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new TypeError(`${label} must be a finite number.`);
  }

  return numeric;
}

/** Applies a validated replacement, guarded replacement, multiplier, or additive numeric edit. */
export function applyNumEdit(current: number, edit: NumEdit, label = 'Patched value'): number {
  const value = numericValue(current, `${label} live value`);
  let result: number;
  if (typeof edit === 'number') {
    result = edit;
  } else if ('from' in edit) {
    const expected = numericValue(edit.from, `${label} from`);
    const tolerance = Math.max(1, Math.abs(expected), Math.abs(value)) * 1e-9;
    if (Math.abs(value - expected) > tolerance) {
      throw new TypeError(`${label} expected live value ${expected}, received ${value}.`);
    }

    result = edit.to;
  } else if ('multiply' in edit) {
    result = value * edit.multiply;
  } else {
    result = value + edit.add;
  }

  return numericValue(result, `${label} result`);
}

/** Applies the configured runtime patch edit for a constant when one exists. */
export function patchRuntimeValue(
  values: PatchRuntimeValues | null | undefined,
  key: string,
  liveValue: number
): number {
  const edit = values?.[key];
  return edit == null ? liveValue : applyNumEdit(liveValue, edit, `Patch constant ${key}`);
}

const MODIFIER_PATCH_FIELDS = new Set(['amount', 'factor', 'parameters']);

/** Rejects malformed or empty modifier edits before applying them to a declaration. */
function assertModifierRulePatchEdit(id: string, edit: ModifierRulePatchEdit): void {
  if (!edit || typeof edit !== 'object' || Array.isArray(edit)) {
    throw new TypeError(`Modifier rule ${id} patch must be an object.`);
  }

  for (const field of Object.keys(edit)) {
    if (!MODIFIER_PATCH_FIELDS.has(field)) {
      throw new TypeError(`Modifier rule ${id} patch has unsupported field ${field}.`);
    }
  }

  if (!Object.hasOwn(edit, 'amount') && !Object.hasOwn(edit, 'factor') && !Object.keys(edit.parameters || {}).length) {
    throw new TypeError(`Modifier rule ${id} patch does not edit a value.`);
  }
}

/** Clones and patches one modifier rule while preserving resolver-backed values. */
function patchModifierRule(rule: Gw2ModifierRule, edit: ModifierRulePatchEdit): Readonly<Gw2ModifierRule> {
  assertModifierRulePatchEdit(rule.id, edit);
  const patched = { ...rule } as {
    id: string;
    amount?: Gw2ModifierRule['amount'];
    factor?: Gw2ModifierRule['factor'];
    parameters?: Readonly<Record<string, number>>;
  } & Gw2ModifierRule;
  for (const field of ['amount', 'factor'] as const) {
    if (!Object.hasOwn(edit, field)) continue;
    const current = rule[field];
    if (typeof current === 'function') {
      throw new TypeError(`Modifier rule ${rule.id}.${field} is resolver-backed; patch a named parameter instead.`);
    }

    if (typeof current !== 'number') {
      throw new TypeError(`Modifier rule ${rule.id} does not expose numeric ${field}.`);
    }

    patched[field] = applyNumEdit(current, edit[field]!, `Modifier rule ${rule.id}.${field}`);
  }

  if (Object.hasOwn(edit, 'parameters')) {
    if (!edit.parameters || typeof edit.parameters !== 'object' || Array.isArray(edit.parameters)) {
      throw new TypeError(`Modifier rule ${rule.id} parameters patch must be an object.`);
    }

    const parameters = { ...(rule.parameters || {}) };
    for (const [name, numericEdit] of Object.entries(edit.parameters)) {
      if (!Object.hasOwn(parameters, name)) {
        throw new TypeError(`Modifier rule ${rule.id} does not expose parameter ${name}.`);
      }

      parameters[name] = applyNumEdit(parameters[name], numericEdit, `Modifier rule ${rule.id}.parameters.${name}`);
    }

    patched.parameters = Object.freeze(parameters);
  } else if (rule.parameters) {
    patched.parameters = Object.freeze({ ...rule.parameters });
  }

  return Object.freeze(patched);
}

/**
 * Applies a sparse patch to declarative modifier rules before hook compilation.
 * Untouched declarations retain identity; touched rules and the returned list
 * are frozen without mutating the live declarations.
 */
export function applyModifierRulePatch(
  rules: readonly Gw2ModifierRule[],
  patch: Readonly<Record<string, ModifierRulePatchEdit>> | null | undefined
): readonly Gw2ModifierRule[] {
  if (!Array.isArray(rules)) {
    throw new TypeError('Modifier rules must be an array.');
  }

  if (patch != null && (typeof patch !== 'object' || Array.isArray(patch))) {
    throw new TypeError('Modifier rule patch must be an object.');
  }

  const rulesById = new Map<string, Gw2ModifierRule>();
  for (const rule of rules) {
    const id = String(rule?.id || '').trim();
    if (!id) throw new TypeError('Modifier rule patch target has no stable id.');
    if (rulesById.has(id)) {
      throw new TypeError(`Modifier rule patch target ${id} is duplicated.`);
    }

    rulesById.set(id, rule);
  }

  const edits = Object.entries(patch || {});
  if (!edits.length) return rules;
  const replacements = new Map<Gw2ModifierRule, Readonly<Gw2ModifierRule>>();
  for (const [id, edit] of edits) {
    const rule = rulesById.get(id);
    if (!rule) throw new TypeError(`Patch references unknown modifier rule ${id}.`);
    replacements.set(rule, patchModifierRule(rule, edit));
  }

  return Object.freeze(rules.map((rule) => replacements.get(rule) || rule)) as readonly Gw2ModifierRule[];
}

/** Returns a declarative tick timeline when the selected effect owns one. */
function effectTicks(effect: SkillEffect): readonly (StrikeTick | ConditionTick)[] | null {
  const ticks = (effect as StrikeEffect | ConditionEffect).ticks;
  return Array.isArray(ticks) ? ticks : null;
}

/** Checks whether an effect satisfies every identity field supplied by a selector. */
function effectMatches(effect: SkillEffect, patch: EffectSelector): boolean {
  if (patch.type != null && effect.type !== patch.type) return false;
  if (patch.name != null && effect.name !== patch.name) return false;
  if (patch.boon != null && effect.boon !== patch.boon) return false;
  if (patch.condition != null) {
    if (effect.condition === patch.condition) return true;
    return Boolean(effectTicks(effect)?.some((tick) => 'condition' in tick && tick.condition === patch.condition));
  }

  return true;
}

/** Resolves a selector to deterministic effect indexes and rejects accidental multi-matches. */
function selectedEffects(
  effects: readonly SkillEffect[],
  patch: EffectSelector,
  label: string
): Array<{ index: number; effect: SkillEffect }> {
  if (patch.effectIndex != null) {
    if (!Number.isInteger(patch.effectIndex) || patch.effectIndex < 0) {
      throw new TypeError(`${label} effectIndex must be a non-negative integer.`);
    }

    const effect = effects[patch.effectIndex];
    if (!effect || !effectMatches(effect, patch)) {
      throw new TypeError(`${label} effect ${patch.effectIndex} did not match.`);
    }

    return [{ index: patch.effectIndex, effect }];
  }

  const matches = effects.flatMap((effect, index) => (effectMatches(effect, patch) ? [{ index, effect }] : []));
  if (!matches.length) throw new TypeError(`${label} did not match an effect.`);
  if (matches.length > 1 && patch.all !== true) {
    throw new TypeError(`${label} matched ${matches.length} effects; set all: true or use effectIndex.`);
  }

  return matches;
}

/** Applies condition selectors to individual strike or condition ticks. */
function tickMatches(tick: StrikeTick | ConditionTick, patch: EffectPatch): boolean {
  return patch.condition == null || ('condition' in tick && tick.condition === patch.condition);
}

/** Applies supported numeric effect edits to one effect or tick object. */
function patchNumericFields(target: MutableRecord, patch: EffectPatch, label: string): void {
  for (const field of EFFECT_NUMERIC_FIELDS) {
    const edit = patch[field];
    if (edit == null) continue;
    if (target[field] == null) {
      throw new TypeError(`${label} does not expose ${field}.`);
    }

    target[field] = applyNumEdit(Number(target[field]), edit, `${label}.${field}`);
  }
}

/** Routes an effect edit to its top-level payload or selected tick timeline. */
function patchEffect(effect: SkillEffect, patch: EffectPatch, label: string): SkillEffect {
  const mutable = effect as unknown as MutableRecord;
  const sourceTicks = effectTicks(effect);
  const maximumRecipients = patch.audience?.maximumRecipients;
  if (maximumRecipients != null) {
    if (patch.tickIndex != null) throw new TypeError(`${label}.audience cannot target a tick.`);
    if (effect.audience?.maximumRecipients == null) {
      throw new TypeError(`${label} does not expose audience.maximumRecipients.`);
    }

    mutable.audience = {
      ...effect.audience,
      maximumRecipients: applyNumEdit(
        effect.audience.maximumRecipients,
        maximumRecipients,
        `${label}.audience.maximumRecipients`
      )
    };
  }

  if (patch.tickIndex == null) {
    if (sourceTicks && EFFECT_NUMERIC_FIELDS.some((field) => patch[field] != null && mutable[field] == null)) {
      if (patch.all === true) {
        return patchEffect(effect, { ...patch, tickIndex: 'all' }, label);
      }

      throw new TypeError(`${label} uses a tick timeline; set tickIndex to a number or "all".`);
    }

    patchNumericFields(mutable, patch, label);
    return effect;
  }

  if (!sourceTicks?.length) {
    throw new TypeError(`${label} does not expose a tick timeline.`);
  }

  const indexes =
    patch.tickIndex === 'all'
      ? sourceTicks.flatMap((tick, index) => (tickMatches(tick, patch) ? [index] : []))
      : [patch.tickIndex];
  if (!indexes.length) throw new TypeError(`${label} did not match a tick.`);
  const ticks = [...sourceTicks] as Array<StrikeTick | ConditionTick>;
  for (const index of indexes) {
    if (!Number.isInteger(index) || index < 0 || !ticks[index]) {
      throw new TypeError(`${label} tickIndex ${index} is invalid.`);
    }

    if (!tickMatches(ticks[index], patch)) {
      throw new TypeError(`${label} tick ${index} did not match.`);
    }

    const tick = { ...ticks[index] } as MutableRecord;
    patchNumericFields(tick, patch, `${label}.ticks[${index}]`);
    ticks[index] = tick as unknown as StrikeTick | ConditionTick;
  }

  mutable.ticks = ticks;
  return effect;
}

/** Expands coefficient, condition, and boon shorthands into the common effect-patch grammar. */
function shorthandEffects(edit: SkillPatchEdit): EffectPatch[] {
  const effects = [...(edit.effects || [])];
  if (edit.coefficient != null) {
    effects.push({
      type: 'strike',
      coefficient: edit.coefficient,
      all: true
    });
  }

  for (const [condition, fields] of Object.entries(edit.conditions || {})) {
    effects.push({
      type: 'condition',
      condition,
      ...fields,
      all: true
    });
  }

  for (const [boon, fields] of Object.entries(edit.boons || {})) {
    effects.push({ type: 'boon', boon, ...fields, all: true });
  }

  return effects;
}

/** Produces an immutable patched skill without mutating the live catalog record. */
function patchSkill(skill: Skill, edit: SkillPatchEdit): Skill {
  const clone = structuredClone(skill) as Skill;
  const mutable = clone as unknown as MutableRecord;
  const fields: Record<string, NumEdit> = {
    ...(edit.fields || {}),
    ...(edit.cooldown == null ? {} : { cooldown: edit.cooldown })
  };
  for (const [field, numericEdit] of Object.entries(fields)) {
    if (!SKILL_NUMERIC_FIELDS.has(field)) {
      throw new TypeError(`Skill ${skill.name} has unsupported patch field ${field}.`);
    }

    patchSkillNumericField(mutable, field, numericEdit, skill.name);
  }

  const effects = [...(clone.effects || [])];
  for (const effectPatch of shorthandEffects(edit)) {
    for (const { index } of selectedEffects(effects, effectPatch, `Skill ${skill.name}`)) {
      effects[index] = patchEffect(effects[index], effectPatch, `${skill.name}.effects[${index}]`);
    }
  }

  const removedIndexes = new Set<number>();
  for (const selector of edit.removeEffects || []) {
    for (const { index } of selectedEffects(effects, selector, `Skill ${skill.name} removal`)) {
      removedIndexes.add(index);
    }
  }

  const retainedEffects = effects.filter((_, index) => !removedIndexes.has(index));
  const addedEffects = (edit.addEffects || []).map((effect, index) => {
    if (!effect || typeof effect !== 'object' || !String(effect.type || '')) {
      throw new TypeError(`Skill ${skill.name} added effect ${index} must declare a type.`);
    }

    return structuredClone(effect);
  });
  mutable.effects = [...retainedEffects, ...addedEffects];
  return deepFreeze(clone);
}

/** Produces an immutable patched balance profile using the shared sparse patch grammar. */
function patchBalanceProfile(profile: BalanceProfile, edit: BalanceProfilePatchEdit): BalanceProfile {
  const clone = structuredClone(profile) as BalanceProfile;
  const mutable = clone as unknown as MutableRecord;
  const fields: Record<string, NumEdit> = {
    ...(edit.fields || {}),
    ...(edit.cooldown == null ? {} : { cooldown: edit.cooldown })
  };
  for (const [field, numericEdit] of Object.entries(fields)) {
    if (!SKILL_NUMERIC_FIELDS.has(field)) {
      throw new TypeError(`Balance profile ${profile.name} has unsupported patch field ${field}.`);
    }

    patchSkillNumericField(mutable, field, numericEdit, profile.name);
  }

  const effects = [...(clone.effects || [])];
  for (const effectPatch of shorthandEffects(edit)) {
    for (const { index } of selectedEffects(effects, effectPatch, `Balance profile ${profile.name}`)) {
      effects[index] = patchEffect(effects[index], effectPatch, `${profile.name}.effects[${index}]`);
    }
  }

  const removedIndexes = new Set<number>();
  for (const selector of edit.removeEffects || []) {
    for (const { index } of selectedEffects(effects, selector, `Balance profile ${profile.name} removal`)) {
      removedIndexes.add(index);
    }
  }

  const addedEffects = (edit.addEffects || []).map((effect, index) => {
    if (!effect || typeof effect !== 'object' || !String(effect.type || '')) {
      throw new TypeError(`Balance profile ${profile.name} added effect ${index} must declare a type.`);
    }

    return structuredClone(effect);
  });
  mutable.effects = [...effects.filter((_, index) => !removedIndexes.has(index)), ...addedEffects];
  return deepFreeze(clone);
}

/** Resolves a skill patch key by stable string ID, numeric ID, or canonical name. */
function findSkill(catalog: Readonly<CanonicalCatalog>, key: string): Skill | undefined {
  const numericId = /^-?\d+$/.test(key) ? Number(key) : null;
  const byId =
    catalog.skillsById.get(key as SkillId) || (numericId == null ? undefined : catalog.skillsById.get(numericId));
  return byId || catalog.skillsByName.get(key);
}

export interface ApplySkillPatchOptions {
  /** Used only after strict validation against the profession-wide catalog. */
  readonly unknownSkills?: 'error' | 'ignore';
}

/** Applies profession skill edits while preserving catalog indexes and object identity. */
export function applySkillPatch(
  catalog: Readonly<CanonicalCatalog>,
  patch: ProfessionPatchPreview | null | undefined,
  options: ApplySkillPatchOptions = {}
): Readonly<CanonicalCatalog> {
  const edits = Object.entries(patch?.skills || {});
  if (!edits.length) return catalog;
  const replacements = new Map<Skill, Skill>();
  for (const [key, edit] of edits) {
    const skill = findSkill(catalog, key);
    if (!skill) {
      if (options.unknownSkills === 'ignore') continue;
      throw new TypeError(`Patch references unknown skill ${key}.`);
    }

    if (replacements.has(skill)) {
      throw new TypeError(`Patch edits skill ${skill.name} more than once.`);
    }

    replacements.set(skill, patchSkill(skill, edit));
  }

  if (!replacements.size) return catalog;
  const replacementFor = (skill: Skill): Skill => replacements.get(skill) || skill;
  const skills = Object.freeze(catalog.skills.map(replacementFor));
  const skillsById = new Map([...catalog.skillsById].map(([id, skill]) => [id, replacementFor(skill)]));
  const skillsByName = new Map([...catalog.skillsByName].map(([name, skill]) => [name, replacementFor(skill)]));
  return Object.freeze({
    ...catalog,
    skills,
    skillsById,
    skillsByName
  });
}

/** Applies balance-profile edits while preserving catalog indexes and object identity. */
export function applyBalanceProfilePatch(
  catalog: Readonly<CanonicalCatalog>,
  patch: ProfessionPatchPreview | null | undefined,
  options: { readonly unknownProfiles?: 'error' | 'ignore' } = {}
): Readonly<CanonicalCatalog> {
  const edits = Object.entries(patch?.balanceProfiles || {});
  if (!edits.length) return catalog;
  const replacements = new Map<BalanceProfile, BalanceProfile>();
  for (const [key, edit] of edits) {
    const numericId = /^-?\d+$/.test(key) ? Number(key) : null;
    const profile =
      catalog.balanceProfilesById.get(key) ||
      (numericId == null ? undefined : catalog.balanceProfilesById.get(numericId)) ||
      catalog.balanceProfilesByName.get(key);
    if (!profile) {
      if (options.unknownProfiles === 'ignore') continue;
      throw new TypeError(`Patch references unknown balance profile ${key}.`);
    }

    if (replacements.has(profile)) {
      throw new TypeError(`Patch edits balance profile ${profile.name} more than once.`);
    }

    replacements.set(profile, patchBalanceProfile(profile, edit));
  }

  if (!replacements.size) return catalog;
  const replacementFor = (profile: BalanceProfile): BalanceProfile => replacements.get(profile) || profile;
  const balanceProfiles = Object.freeze(catalog.balanceProfiles.map(replacementFor));
  return Object.freeze({
    ...catalog,
    balanceProfiles,
    balanceProfilesById: new Map(
      [...catalog.balanceProfilesById].map(([id, profile]) => [id, replacementFor(profile)])
    ),
    balanceProfilesByName: new Map(
      [...catalog.balanceProfilesByName].map(([name, profile]) => [name, replacementFor(profile)])
    )
  });
}

/** Returns the patch section authored for a profession. */
export function professionPatchFor(
  preview: PatchPreview | null | undefined,
  professionId: string
): ProfessionPatchPreview | null {
  return preview?.professions?.[professionId] || null;
}

/** Merges global and profession-specific runtime patch constants. */
export function patchRuntimeValuesFor(
  preview: PatchPreview | null | undefined,
  professionId: string
): PatchRuntimeValues {
  return Object.freeze({
    ...(preview?.constants || {}),
    ...(professionPatchFor(preview, professionId)?.constants || {})
  });
}

/** Validates and normalizes a complete patch preview declaration. */
export function validatePatchPreview(preview: PatchPreview): PatchPreview {
  if (!preview || typeof preview !== 'object') {
    throw new TypeError('Patch preview must be an object.');
  }

  if (!/^[a-z0-9][a-z0-9-]*$/.test(preview.id || '')) {
    throw new TypeError('Patch preview id must be lowercase and stable.');
  }

  if (preview.id === CURRENT_PATCH_ID) {
    throw new TypeError(`Patch preview id cannot be ${CURRENT_PATCH_ID}.`);
  }

  if (!String(preview.label || '').trim()) {
    throw new TypeError('Patch preview label is required.');
  }

  if (Object.hasOwn(preview, 'notes')) {
    throw new TypeError('Patch preview has unsupported field notes.');
  }

  if (preview.sourceUrl != null) {
    if (typeof preview.sourceUrl !== 'string') {
      throw new TypeError('Patch preview source URL must be a string.');
    }

    let sourceUrl: URL;
    try {
      sourceUrl = new URL(preview.sourceUrl);
    } catch {
      throw new TypeError('Patch preview source URL must be an absolute URL.');
    }

    if (sourceUrl.protocol !== 'https:' && sourceUrl.protocol !== 'http:') {
      throw new TypeError('Patch preview source URL must use HTTP or HTTPS.');
    }
  }

  for (const [professionId, patch] of Object.entries(preview.professions || {})) {
    if (Object.hasOwn(patch, 'notes')) {
      throw new TypeError(`${professionId} patch has unsupported field notes.`);
    }

    validatePatchOverview(patch.overview, `${professionId} patch overview`);
  }

  return deepFreeze(structuredClone(preview));
}
