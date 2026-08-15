import type {
  CanonicalCatalog,
  ConditionEffect,
  ConditionTick,
  Skill,
  SkillEffect,
  SkillId,
  StrikeEffect,
  StrikeTick,
} from "../engine/types.js";

export const CURRENT_PATCH_ID = "current";

export type NumEdit =
  | number
  | { readonly from: number; readonly to: number }
  | { readonly multiply: number }
  | { readonly add: number };

export type PatchNoteStatus =
  "applied" | "tracked" | "not-applicable" | "unchanged" | "superseded";

export interface PatchNote {
  readonly subject: string;
  readonly text: string;
  readonly status: PatchNoteStatus;
  readonly reason?: string;
}

export interface EffectSelector {
  /** Zero-based index in the skill's complete effects array. */
  readonly effectIndex?: number;
  readonly type?: SkillEffect["type"];
  readonly name?: string;
  readonly condition?: string;
  readonly boon?: string;
  /** Required when a selector intentionally targets multiple effects. */
  readonly all?: boolean;
}

export interface EffectPatch extends EffectSelector {
  /** Zero-based index in the selected effect's ticks, or every matching tick. */
  readonly tickIndex?: number | "all";
  readonly coefficient?: NumEdit;
  readonly hits?: NumEdit;
  readonly stacks?: NumEdit;
  readonly duration?: NumEdit;
  readonly applications?: NumEdit;
  readonly atMs?: NumEdit;
  readonly intervalMs?: NumEdit;
}

export interface SkillPatchEdit {
  /** Numeric skill fields such as cooldown, castTimeMs, or initiativeCost. */
  readonly fields?: Readonly<Record<string, NumEdit>>;
  readonly effects?: readonly EffectPatch[];
  /** Complete effects appended after edits/removals of existing effects. */
  readonly addEffects?: readonly SkillEffect[];
  /** Selectors for complete effects removed from the preview skill. */
  readonly removeEffects?: readonly EffectSelector[];

  /** Convenience shorthands for the common patch-note cases. */
  readonly coefficient?: NumEdit;
  readonly conditions?: Readonly<
    Record<string, { readonly stacks?: NumEdit; readonly duration?: NumEdit }>
  >;
  readonly boons?: Readonly<
    Record<string, { readonly stacks?: NumEdit; readonly duration?: NumEdit }>
  >;
  readonly cooldown?: NumEdit;
  readonly castTimeMs?: NumEdit;
}

export interface ProfessionPatchPreview {
  readonly skills?: Readonly<Record<string, SkillPatchEdit>>;
  readonly constants?: Readonly<Record<string, NumEdit>>;
  readonly notes?: readonly PatchNote[];
}

export interface PatchPreview {
  readonly id: string;
  readonly label: string;
  readonly publishedAt?: string;
  readonly sourceUrl?: string;
  readonly constants?: Readonly<Record<string, NumEdit>>;
  readonly notes?: readonly PatchNote[];
  readonly professions?: Readonly<Record<string, ProfessionPatchPreview>>;
}

export type PatchRuntimeValues = Readonly<Record<string, NumEdit>>;

const SKILL_NUMERIC_FIELDS = new Set([
  "ammo",
  "ammoCastLockout",
  "ammoRecharge",
  "castTimeMs",
  "cooldown",
  "energyCost",
  "initiativeCost",
  "quicknessCastTimeMs",
  "recharge",
  "rechargeOffsetMs",
  "resourceCost",
  "selfStunMs",
]);

const EFFECT_NUMERIC_FIELDS = [
  "coefficient",
  "hits",
  "stacks",
  "duration",
  "applications",
  "atMs",
  "intervalMs",
] as const;

type EffectNumericField = (typeof EFFECT_NUMERIC_FIELDS)[number];
type MutableRecord = Record<string, unknown>;

function numericValue(value: unknown, label: string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new TypeError(`${label} must be a finite number.`);
  }
  return numeric;
}

export function applyNumEdit(
  current: number,
  edit: NumEdit,
  label = "Patched value",
): number {
  const value = numericValue(current, `${label} live value`);
  let result: number;
  if (typeof edit === "number") {
    result = edit;
  } else if ("from" in edit) {
    const expected = numericValue(edit.from, `${label} from`);
    const tolerance = Math.max(1, Math.abs(expected), Math.abs(value)) * 1e-9;
    if (Math.abs(value - expected) > tolerance) {
      throw new TypeError(
        `${label} expected live value ${expected}, received ${value}.`,
      );
    }
    result = edit.to;
  } else if ("multiply" in edit) {
    result = value * edit.multiply;
  } else {
    result = value + edit.add;
  }
  return numericValue(result, `${label} result`);
}

export function patchRuntimeValue(
  values: PatchRuntimeValues | null | undefined,
  key: string,
  liveValue: number,
): number {
  const edit = values?.[key];
  return edit == null
    ? liveValue
    : applyNumEdit(liveValue, edit, `Patch constant ${key}`);
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value as MutableRecord)) deepFreeze(child);
  return Object.freeze(value);
}

function effectTicks(
  effect: SkillEffect,
): readonly (StrikeTick | ConditionTick)[] | null {
  const ticks = (effect as StrikeEffect | ConditionEffect).ticks;
  return Array.isArray(ticks) ? ticks : null;
}

function effectMatches(effect: SkillEffect, patch: EffectSelector): boolean {
  if (patch.type != null && effect.type !== patch.type) return false;
  if (patch.name != null && effect.name !== patch.name) return false;
  if (patch.boon != null && effect.boon !== patch.boon) return false;
  if (patch.condition != null) {
    if (effect.condition === patch.condition) return true;
    return Boolean(
      effectTicks(effect)?.some(
        (tick) => "condition" in tick && tick.condition === patch.condition,
      ),
    );
  }
  return true;
}

function selectedEffects(
  effects: readonly SkillEffect[],
  patch: EffectSelector,
  label: string,
): Array<{ index: number; effect: SkillEffect }> {
  if (patch.effectIndex != null) {
    if (!Number.isInteger(patch.effectIndex) || patch.effectIndex < 0) {
      throw new TypeError(
        `${label} effectIndex must be a non-negative integer.`,
      );
    }
    const effect = effects[patch.effectIndex];
    if (!effect || !effectMatches(effect, patch)) {
      throw new TypeError(
        `${label} effect ${patch.effectIndex} did not match.`,
      );
    }
    return [{ index: patch.effectIndex, effect }];
  }
  const matches = effects.flatMap((effect, index) =>
    effectMatches(effect, patch) ? [{ index, effect }] : [],
  );
  if (!matches.length) throw new TypeError(`${label} did not match an effect.`);
  if (matches.length > 1 && patch.all !== true) {
    throw new TypeError(
      `${label} matched ${matches.length} effects; set all: true or use effectIndex.`,
    );
  }
  return matches;
}

function tickMatches(
  tick: StrikeTick | ConditionTick,
  patch: EffectPatch,
): boolean {
  return (
    patch.condition == null ||
    ("condition" in tick && tick.condition === patch.condition)
  );
}

function patchNumericFields(
  target: MutableRecord,
  patch: EffectPatch,
  label: string,
): void {
  for (const field of EFFECT_NUMERIC_FIELDS) {
    const edit = patch[field];
    if (edit == null) continue;
    if (target[field] == null) {
      throw new TypeError(`${label} does not expose ${field}.`);
    }
    target[field] = applyNumEdit(
      Number(target[field]),
      edit,
      `${label}.${field}`,
    );
  }
}

function patchEffect(
  effect: SkillEffect,
  patch: EffectPatch,
  label: string,
): SkillEffect {
  const mutable = effect as unknown as MutableRecord;
  const sourceTicks = effectTicks(effect);
  if (patch.tickIndex == null) {
    if (
      sourceTicks &&
      EFFECT_NUMERIC_FIELDS.some(
        (field) => patch[field] != null && mutable[field] == null,
      )
    ) {
      if (patch.all === true) {
        return patchEffect(effect, { ...patch, tickIndex: "all" }, label);
      }
      throw new TypeError(
        `${label} uses a tick timeline; set tickIndex to a number or "all".`,
      );
    }
    patchNumericFields(mutable, patch, label);
    return effect;
  }
  if (!sourceTicks?.length) {
    throw new TypeError(`${label} does not expose a tick timeline.`);
  }
  const indexes =
    patch.tickIndex === "all"
      ? sourceTicks.flatMap((tick, index) =>
          tickMatches(tick, patch) ? [index] : [],
        )
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

function shorthandEffects(edit: SkillPatchEdit): EffectPatch[] {
  const effects = [...(edit.effects || [])];
  if (edit.coefficient != null) {
    effects.push({
      type: "strike",
      coefficient: edit.coefficient,
      all: true,
    });
  }
  for (const [condition, fields] of Object.entries(edit.conditions || {})) {
    effects.push({
      type: "condition",
      condition,
      ...fields,
      all: true,
    });
  }
  for (const [boon, fields] of Object.entries(edit.boons || {})) {
    effects.push({ type: "boon", boon, ...fields, all: true });
  }
  return effects;
}

function patchSkill(skill: Skill, edit: SkillPatchEdit): Skill {
  const clone = structuredClone(skill) as Skill;
  const mutable = clone as unknown as MutableRecord;
  const fields: Record<string, NumEdit> = {
    ...(edit.fields || {}),
    ...(edit.cooldown == null ? {} : { cooldown: edit.cooldown }),
    ...(edit.castTimeMs == null ? {} : { castTimeMs: edit.castTimeMs }),
  };
  for (const [field, numericEdit] of Object.entries(fields)) {
    if (!SKILL_NUMERIC_FIELDS.has(field)) {
      throw new TypeError(
        `Skill ${skill.name} has unsupported patch field ${field}.`,
      );
    }
    if (mutable[field] == null) {
      throw new TypeError(`Skill ${skill.name} does not expose ${field}.`);
    }
    mutable[field] = applyNumEdit(
      Number(mutable[field]),
      numericEdit,
      `${skill.name}.${field}`,
    );
  }
  const effects = [...(clone.effects || [])];
  for (const effectPatch of shorthandEffects(edit)) {
    for (const { index } of selectedEffects(
      effects,
      effectPatch,
      `Skill ${skill.name}`,
    )) {
      effects[index] = patchEffect(
        effects[index],
        effectPatch,
        `${skill.name}.effects[${index}]`,
      );
    }
  }
  const removedIndexes = new Set<number>();
  for (const selector of edit.removeEffects || []) {
    for (const { index } of selectedEffects(
      effects,
      selector,
      `Skill ${skill.name} removal`,
    )) {
      removedIndexes.add(index);
    }
  }
  const retainedEffects = effects.filter(
    (_, index) => !removedIndexes.has(index),
  );
  const addedEffects = (edit.addEffects || []).map((effect, index) => {
    if (!effect || typeof effect !== "object" || !String(effect.type || "")) {
      throw new TypeError(
        `Skill ${skill.name} added effect ${index} must declare a type.`,
      );
    }
    return structuredClone(effect);
  });
  mutable.effects = [...retainedEffects, ...addedEffects];
  return deepFreeze(clone);
}

function findSkill(catalog: Readonly<CanonicalCatalog>, key: string): Skill {
  const numericId = /^\d+$/.test(key) ? Number(key) : null;
  const byId =
    catalog.skillsById.get(key as SkillId) ||
    (numericId == null ? undefined : catalog.skillsById.get(numericId));
  const skill = byId || catalog.skillsByName.get(key);
  if (!skill) throw new TypeError(`Patch references unknown skill ${key}.`);
  return skill;
}

export function applySkillPatch(
  catalog: Readonly<CanonicalCatalog>,
  patch: ProfessionPatchPreview | null | undefined,
): Readonly<CanonicalCatalog> {
  const edits = Object.entries(patch?.skills || {});
  if (!edits.length) return catalog;
  const replacements = new Map<Skill, Skill>();
  for (const [key, edit] of edits) {
    const skill = findSkill(catalog, key);
    if (replacements.has(skill)) {
      throw new TypeError(`Patch edits skill ${skill.name} more than once.`);
    }
    replacements.set(skill, patchSkill(skill, edit));
  }
  const replacementFor = (skill: Skill): Skill =>
    replacements.get(skill) || skill;
  const skills = Object.freeze(catalog.skills.map(replacementFor));
  const skillsById = new Map(
    [...catalog.skillsById].map(([id, skill]) => [id, replacementFor(skill)]),
  );
  const skillsByName = new Map(
    [...catalog.skillsByName].map(([name, skill]) => [
      name,
      replacementFor(skill),
    ]),
  );
  return Object.freeze({
    ...catalog,
    skills,
    skillsById,
    skillsByName,
  });
}

export function professionPatchFor(
  preview: PatchPreview | null | undefined,
  professionId: string,
): ProfessionPatchPreview | null {
  return preview?.professions?.[professionId] || null;
}

export function patchRuntimeValuesFor(
  preview: PatchPreview | null | undefined,
  professionId: string,
): PatchRuntimeValues {
  return Object.freeze({
    ...(preview?.constants || {}),
    ...(professionPatchFor(preview, professionId)?.constants || {}),
  });
}

export function validatePatchPreview(preview: PatchPreview): PatchPreview {
  if (!preview || typeof preview !== "object") {
    throw new TypeError("Patch preview must be an object.");
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(preview.id || "")) {
    throw new TypeError("Patch preview id must be lowercase and stable.");
  }
  if (preview.id === CURRENT_PATCH_ID) {
    throw new TypeError(`Patch preview id cannot be ${CURRENT_PATCH_ID}.`);
  }
  if (!String(preview.label || "").trim()) {
    throw new TypeError("Patch preview label is required.");
  }
  return deepFreeze(structuredClone(preview));
}
