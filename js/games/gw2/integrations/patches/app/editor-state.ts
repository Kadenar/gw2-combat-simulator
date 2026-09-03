import type { SkillEffect } from '#gw2/platform/engine/types.js';
import type {
  NativePatchAuthoringMetadata,
  NativePatchAuthoringModule
} from '#gw2/integrations/patches/authoring/module-types.js';
import type { EffectSelector, PatchOverviewEntry, PatchPreview } from '#gw2/integrations/patches/authoring/patches.js';
import {
  createEffectTemplate,
  createPatchPreviewDraft,
  generatePatchOverview,
  numericEditForValue
} from '#gw2/integrations/patches/app/model.js';

export interface AuthoringPayload {
  readonly preview: PatchPreview | null;
  readonly professions: readonly NativePatchAuthoringMetadata[];
  readonly sourceFile: string;
}

export type AuthoringSection = 'traits' | 'skills' | 'mechanics' | 'overview';
export type TraitAuthoringView = 'modifiers' | 'effects';
export type AuthoringStatusKind = 'neutral' | 'success' | 'error';

type DraftRecord = Record<string, unknown>;

interface EditorState {
  payload: AuthoringPayload | null;
  draft: PatchPreview;
  selectedProfessionId: string;
  selectedModuleId: string;
  selectedSection: AuthoringSection;
  selectedTraitView: TraitAuthoringView;
  selectedSkillId: string;
  selectedProfileId: string;
  selectedSkillVariantId: string;
  search: string;
  changedOnly: boolean;
  dirty: boolean;
  status: string;
  statusKind: AuthoringStatusKind;
}

/** Owns the single in-memory authoring session shared by the page view and bootstrap. */
export const editorState: EditorState = {
  payload: null,
  draft: createPatchPreviewDraft(),
  selectedProfessionId: '',
  selectedModuleId: 'Core',
  selectedSection: 'traits',
  selectedTraitView: 'modifiers',
  selectedSkillId: '',
  selectedProfileId: '',
  selectedSkillVariantId: '',
  search: '',
  changedOnly: false,
  dirty: false,
  status: 'Loading live authoring metadata…',
  statusKind: 'neutral'
};

/** Updates the status presented beside the save controls without changing the draft. */
export function setEditorStatus(status: string, statusKind: AuthoringStatusKind): void {
  editorState.status = status;
  editorState.statusKind = statusKind;
}

/** Replaces the editor session with freshly loaded metadata and its active preview. */
export function loadEditorPayload(payload: AuthoringPayload): void {
  editorState.payload = payload;
  editorState.draft = structuredClone(payload.preview || createPatchPreviewDraft());
  editorState.selectedProfessionId =
    Object.keys(editorState.draft.professions || {})[0] || payload.professions[0]?.professionId || '';
  editorState.selectedModuleId = 'Core';
  editorState.selectedSkillId = '';
  editorState.selectedProfileId = '';
  editorState.selectedSkillVariantId = '';
  editorState.dirty = false;
}

/** Accepts the server-validated preview as the new clean editing baseline. */
export function acceptSavedDraft(preview: PatchPreview): void {
  editorState.draft = structuredClone(preview);
  editorState.dirty = false;
}

/** Regenerates derived overview text and keeps selections valid for the loaded metadata. */
export function prepareEditorStateForRender(): void {
  const payload = editorState.payload;
  if (!payload) return;

  editorState.draft = generatePatchOverview(editorState.draft, payload.professions);
  const profession = selectedProfession() || payload.professions[0];
  if (profession && profession.professionId !== editorState.selectedProfessionId) {
    editorState.selectedProfessionId = profession.professionId;
  }

  const module = selectedModule() || profession?.modules[0] || null;
  if (module && module.id !== editorState.selectedModuleId) editorState.selectedModuleId = module.id;
}

/** Narrows unknown draft values to mutable object records used by sparse edits. */
function asRecord(value: unknown): DraftRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as DraftRecord) : null;
}

/** Reuses or creates a nested draft object so edit handlers share one mutation path. */
function ensureRecord(parent: DraftRecord, key: string): DraftRecord {
  const existing = asRecord(parent[key]);
  if (existing) return existing;
  const created: DraftRecord = {};
  parent[key] = created;
  return created;
}

/** Exposes the typed preview as the mutable record used to author sparse edits. */
function draftRecord(): DraftRecord {
  return editorState.draft as unknown as DraftRecord;
}

/** Finds or lazily creates one profession's sparse patch section. */
function professionPatch(professionId: string, create = false): DraftRecord | null {
  const root = draftRecord();
  const professions = create ? ensureRecord(root, 'professions') : asRecord(root.professions);
  if (!professions) return null;
  if (create) return ensureRecord(professions, professionId);
  return asRecord(professions[professionId]);
}

/** Finds or lazily creates the draft edit for a skill. */
export function skillEdit(skillId: string, create = false): DraftRecord | null {
  const patch = professionPatch(editorState.selectedProfessionId, create);
  if (!patch) return null;
  const skills = create ? ensureRecord(patch, 'skills') : asRecord(patch.skills);
  if (!skills) return null;
  if (create) return ensureRecord(skills, skillId);
  return asRecord(skills[skillId]);
}

/** Finds or lazily creates the draft edit for a runtime balance profile. */
export function balanceProfileEdit(profileId: string, create = false): DraftRecord | null {
  const patch = professionPatch(editorState.selectedProfessionId, create);
  if (!patch) return null;
  const profiles = create ? ensureRecord(patch, 'balanceProfiles') : asRecord(patch.balanceProfiles);
  if (!profiles) return null;
  if (create) return ensureRecord(profiles, profileId);
  return asRecord(profiles[profileId]);
}

/** Finds or lazily creates the draft edit for a modifier rule. */
export function modifierEdit(ruleId: string, create = false): DraftRecord | null {
  const patch = professionPatch(editorState.selectedProfessionId, create);
  if (!patch) return null;
  const rules = create ? ensureRecord(patch, 'modifierRules') : asRecord(patch.modifierRules);
  if (!rules) return null;
  if (create) return ensureRecord(rules, ruleId);
  return asRecord(rules[ruleId]);
}

/** Removes an empty nested draft section after its last authored value is cleared. */
function removeEmptyRecord(parent: DraftRecord | null, key: string): void {
  const record = parent && asRecord(parent[key]);
  if (record && !Object.keys(record).length) delete parent![key];
}

/** Prunes empty entity and profession containers to keep the saved preview sparse. */
function cleanupProfessionPatch(): void {
  const root = draftRecord();
  const professions = asRecord(root.professions);
  const patch = professions && asRecord(professions[editorState.selectedProfessionId]);
  if (!patch || !professions) return;
  for (const key of ['skills', 'balanceProfiles', 'modifierRules', 'constants']) {
    removeEmptyRecord(patch, key);
  }

  if (!Object.keys(patch).length) delete professions[editorState.selectedProfessionId];
  if (!Object.keys(professions).length) delete root.professions;
}

/** Resolves the currently selected profession from loaded authoring metadata. */
export function selectedProfession(): NativePatchAuthoringMetadata | null {
  return (
    editorState.payload?.professions.find(
      (profession) => profession.professionId === editorState.selectedProfessionId
    ) || null
  );
}

/** Resolves the currently selected specialization module within the active profession. */
export function selectedModule(): NativePatchAuthoringModule | null {
  return selectedProfession()?.modules.find((module) => module.id === editorState.selectedModuleId) || null;
}

/** Marks the in-memory draft unsaved and updates its neutral status message. */
export function markDirty(message = 'Unsaved changes'): void {
  editorState.dirty = true;
  setEditorStatus(message, 'neutral');
}

/** Counts edited entities for profession navigation badges. */
export function editCount(professionId: string): number {
  const patch = professionPatch(professionId);
  if (!patch) return 0;
  return (
    Object.keys(asRecord(patch.skills) || {}).length +
    Object.keys(asRecord(patch.balanceProfiles) || {}).length +
    Object.keys(asRecord(patch.modifierRules) || {}).length
  );
}

/** Returns generated overview entries for the selected profession draft. */
export function overviewForProfession(): readonly PatchOverviewEntry[] {
  const patch = professionPatch(editorState.selectedProfessionId);
  return patch && Array.isArray(patch.overview) ? (patch.overview as PatchOverviewEntry[]) : [];
}

/** Reports whether a skill currently owns any sparse draft edit. */
export function hasSkillEdit(skillId: string): boolean {
  return Boolean(skillEdit(skillId));
}

/** Reports whether a balance profile or relocated skill variant has a draft edit. */
export function hasBalanceProfileEdit(profileId: string): boolean {
  return Boolean(balanceProfileEdit(profileId));
}

/** Reports whether a modifier rule currently owns any sparse draft edit. */
export function hasModifierEdit(ruleId: string): boolean {
  return Boolean(modifierEdit(ruleId));
}

/** Switches professions and clears selections that cannot cross that boundary. */
export function selectProfession(professionId: string): void {
  editorState.selectedProfessionId = professionId;
  editorState.selectedModuleId = 'Core';
  editorState.selectedSkillId = '';
  editorState.selectedProfileId = '';
  editorState.selectedSkillVariantId = '';
}

/** Switches modules and clears entity selections owned by the previous module. */
export function selectModule(moduleId: string): void {
  editorState.selectedModuleId = moduleId;
  editorState.selectedSkillId = '';
  editorState.selectedProfileId = '';
  editorState.selectedSkillVariantId = '';
}

/** Selects a skill while leaving the surrounding navigation unchanged. */
export function selectSkill(skillId: string): void {
  editorState.selectedSkillId = skillId;
  editorState.selectedSkillVariantId = '';
}

/** Selects a skill variant and restores its parent skill context when available. */
export function selectSkillVariant(variantId: string): void {
  editorState.selectedSkillVariantId = variantId;
  const variant = selectedModule()?.skillVariants.find((entry) => String(entry.id) === variantId);
  editorState.selectedSkillId = String(variant?.profile.parentId || '');
}

/** Selects one trait or mechanic balance profile. */
export function selectProfile(profileId: string): void {
  editorState.selectedProfileId = profileId;
}

/** Updates a top-level preview metadata field while keeping empty optional values absent. */
export function setPreviewField(field: keyof PatchPreview, value: string): void {
  const record = draftRecord();
  if (value) record[field] = value;
  else delete record[field];
}

/** Removes one modifier edit and prunes any newly empty draft containers. */
export function deleteModifierEdit(ruleId: string): void {
  const patch = professionPatch(editorState.selectedProfessionId);
  const rules = patch && asRecord(patch.modifierRules);
  if (rules) delete rules[ruleId];
  cleanupProfessionPatch();
}

/** Removes every authored change for one skill and compacts its profession patch. */
export function deleteSkillEdit(skillId: string): void {
  const patch = professionPatch(editorState.selectedProfessionId);
  const skills = patch && asRecord(patch.skills);
  if (skills) delete skills[skillId];
  cleanupProfessionPatch();
}

/** Removes every authored change for one profile or relocated skill variant. */
export function deleteBalanceProfileEdit(profileId: string): void {
  const patch = professionPatch(editorState.selectedProfessionId);
  const profiles = patch && asRecord(patch.balanceProfiles);
  if (profiles) delete profiles[profileId];
  cleanupProfessionPatch();
}

export interface NumericEditInput {
  readonly entity: string;
  readonly id: string;
  readonly field: string;
  readonly current: number;
  readonly next: number;
  readonly effectIndex?: number;
  readonly tickIndex?: number;
}

/** Applies one effect or tick edit and removes selector-only records when the value is restored. */
function setEffectNumericEdit(
  input: NumericEditInput,
  edit: DraftRecord,
  onEmpty: () => void,
  numericEdit: ReturnType<typeof numericEditForValue>
): void {
  const effects = Array.isArray(edit.effects) ? (edit.effects as DraftRecord[]) : [];
  let effect = effects.find((entry) => entry.effectIndex === input.effectIndex && entry.tickIndex === input.tickIndex);
  if (!effect && numericEdit) {
    effect = {
      effectIndex: input.effectIndex,
      ...(input.tickIndex == null ? {} : { tickIndex: input.tickIndex })
    };
    effects.push(effect);
  }

  if (effect && input.field === 'audience.maximumRecipients') {
    const audience = numericEdit ? ensureRecord(effect, 'audience') : asRecord(effect.audience);
    if (numericEdit) audience!.maximumRecipients = numericEdit;
    else if (audience) delete audience.maximumRecipients;
    removeEmptyRecord(effect, 'audience');
  } else if (effect && numericEdit) effect[input.field] = numericEdit;
  else if (effect) delete effect[input.field];

  const retained = effects.filter((entry) =>
    Object.keys(entry).some((key) => !['effectIndex', 'tickIndex'].includes(key))
  );
  if (retained.length) edit.effects = retained;
  else delete edit.effects;
  if (!Object.keys(edit).length) onEmpty();
}

/** Routes a numeric value to the correct sparse entity, effect, or tick edit. */
export function setNumericEdit(input: NumericEditInput): void {
  if (!Number.isFinite(input.current) || !Number.isFinite(input.next)) {
    throw new TypeError('Preview values must be finite numbers.');
  }

  const numericEdit = numericEditForValue(input.current, input.next);
  if (input.entity === 'modifier' || input.entity === 'modifier-parameter') {
    const edit = modifierEdit(input.id, Boolean(numericEdit));
    if (!edit) return;
    const target = input.entity === 'modifier-parameter' ? ensureRecord(edit, 'parameters') : edit;
    if (numericEdit) target[input.field] = numericEdit;
    else delete target[input.field];
    removeEmptyRecord(edit, 'parameters');
    if (!Object.keys(edit).length) deleteModifierEdit(input.id);
    return;
  }

  if (input.entity === 'skill' || input.entity === 'balance-profile') {
    const getEdit = input.entity === 'skill' ? skillEdit : balanceProfileEdit;
    const deleteEdit = input.entity === 'skill' ? deleteSkillEdit : deleteBalanceProfileEdit;
    const edit = getEdit(input.id, Boolean(numericEdit));
    if (!edit) return;
    const fields = numericEdit ? ensureRecord(edit, 'fields') : asRecord(edit.fields);
    if (numericEdit) fields![input.field] = numericEdit;
    else if (fields) delete fields[input.field];
    removeEmptyRecord(edit, 'fields');
    if (!Object.keys(edit).length) deleteEdit(input.id);
    return;
  }

  if ((input.entity === 'effect' || input.entity === 'balance-profile-effect') && Number.isInteger(input.effectIndex)) {
    const skill = input.entity === 'effect';
    const edit = skill ? skillEdit(input.id, Boolean(numericEdit)) : balanceProfileEdit(input.id, Boolean(numericEdit));
    if (!edit) return;
    setEffectNumericEdit(
      input,
      edit,
      () => (skill ? deleteSkillEdit(input.id) : deleteBalanceProfileEdit(input.id)),
      numericEdit
    );
  }
}

/** Toggles preview removal for one existing skill effect without deleting live metadata. */
export function toggleEffect(skillId: string, effectIndex: number): void {
  const edit = skillEdit(skillId, true)!;
  const removals = Array.isArray(edit.removeEffects) ? (edit.removeEffects as EffectSelector[]) : [];
  const removed = removals.some((selector) => selector.effectIndex === effectIndex);
  const next = removed
    ? removals.filter((selector) => selector.effectIndex !== effectIndex)
    : [...removals, { effectIndex }];
  if (next.length) edit.removeEffects = next;
  else delete edit.removeEffects;
  if (!Object.keys(edit).length) deleteSkillEdit(skillId);
}

/** Appends a valid starter effect of the selected type to a skill draft. */
export function addEffect(skillId: string, type: string): void {
  const edit = skillEdit(skillId, true)!;
  const effects = Array.isArray(edit.addEffects) ? (edit.addEffects as SkillEffect[]) : [];
  edit.addEffects = [...effects, createEffectTemplate(type || 'strike')];
}

/** Replaces one newly authored effect after the view validates its JSON shape. */
export function setAddedEffect(skillId: string, index: number, effect: SkillEffect): void {
  const edit = skillEdit(skillId, true)!;
  const effects = [...((edit.addEffects || []) as SkillEffect[])];
  effects[index] = effect;
  edit.addEffects = effects;
}

/** Removes one newly authored effect and clears the skill edit when it becomes empty. */
export function removeAddedEffect(skillId: string, index: number): void {
  const edit = skillEdit(skillId);
  if (!edit || !Array.isArray(edit.addEffects)) return;
  const effects = (edit.addEffects as SkillEffect[]).filter((_, effectIndex) => effectIndex !== index);
  if (effects.length) edit.addEffects = effects;
  else delete edit.addEffects;
  if (!Object.keys(edit).length) deleteSkillEdit(skillId);
}
