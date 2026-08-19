import type { SkillEffect } from '../../platform/engine/types.js';
import type {
  NativePatchAuthoringMetadata,
  NativePatchAuthoringBalanceProfile,
  NativePatchAuthoringModifierRule,
  NativePatchAuthoringModule,
  NativePatchAuthoringSkill
} from '../../platform/gw2/native-module-types.js';
import {
  PATCHABLE_EFFECT_NUMERIC_FIELDS,
  type EffectPatch,
  type EffectSelector,
  type ModifierRulePatchEdit,
  type NumEdit,
  type PatchOverviewEntry,
  type PatchPreview,
  type SkillPatchEdit
} from '../../platform/gw2/skill-patch.js';
import {
  compactPatchPreview,
  createEffectTemplate,
  createPatchPreviewDraft,
  generatePatchOverview,
  groupPatchAuthoringSkills,
  numericEditForValue,
  numericEditValue,
  patchSearchText
} from './model.js';

interface AuthoringPayload {
  readonly preview: PatchPreview | null;
  readonly professions: readonly NativePatchAuthoringMetadata[];
  readonly sourceFile: string;
}

type DraftRecord = Record<string, unknown>;

const appRoot = document.querySelector<HTMLElement>('[data-patch-authoring-app]');

if (!appRoot) throw new Error('Patch preview authoring root is missing.');
const app = appRoot;

let payload: AuthoringPayload | null = null;
let draft = createPatchPreviewDraft();
let selectedProfessionId = '';
let selectedModuleId = 'Core';
type AuthoringSection = 'traits' | 'skills' | 'profiles' | 'overview';

let selectedSection: AuthoringSection = 'traits';
let selectedSkillId = '';
let selectedProfileId = '';
let search = '';
let changedOnly = false;
let dirty = false;
let status = 'Loading live authoring metadata…';
let statusKind: 'neutral' | 'success' | 'error' = 'neutral';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function jsonHtml(value: unknown): string {
  return escapeHtml(JSON.stringify(value, null, 2));
}

function officialSourceUrl(): string | null {
  if (!draft.sourceUrl) return null;
  try {
    const url = new URL(draft.sourceUrl);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): DraftRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as DraftRecord) : null;
}

function ensureRecord(parent: DraftRecord, key: string): DraftRecord {
  const existing = asRecord(parent[key]);
  if (existing) return existing;
  const created: DraftRecord = {};
  parent[key] = created;
  return created;
}

function draftRecord(): DraftRecord {
  return draft as unknown as DraftRecord;
}

function professionPatch(professionId: string, create = false): DraftRecord | null {
  const root = draftRecord();
  const professions = create ? ensureRecord(root, 'professions') : asRecord(root.professions);
  if (!professions) return null;
  if (create) return ensureRecord(professions, professionId);
  return asRecord(professions[professionId]);
}

function skillEdit(skillId: string, create = false): DraftRecord | null {
  const patch = professionPatch(selectedProfessionId, create);
  if (!patch) return null;
  const skills = create ? ensureRecord(patch, 'skills') : asRecord(patch.skills);
  if (!skills) return null;
  if (create) return ensureRecord(skills, skillId);
  return asRecord(skills[skillId]);
}

function balanceProfileEdit(profileId: string, create = false): DraftRecord | null {
  const patch = professionPatch(selectedProfessionId, create);
  if (!patch) return null;
  const profiles = create ? ensureRecord(patch, 'balanceProfiles') : asRecord(patch.balanceProfiles);
  if (!profiles) return null;
  if (create) return ensureRecord(profiles, profileId);
  return asRecord(profiles[profileId]);
}

function modifierEdit(ruleId: string, create = false): DraftRecord | null {
  const patch = professionPatch(selectedProfessionId, create);
  if (!patch) return null;
  const rules = create ? ensureRecord(patch, 'modifierRules') : asRecord(patch.modifierRules);
  if (!rules) return null;
  if (create) return ensureRecord(rules, ruleId);
  return asRecord(rules[ruleId]);
}

function removeEmptyRecord(parent: DraftRecord | null, key: string): void {
  const record = parent && asRecord(parent[key]);
  if (record && !Object.keys(record).length) delete parent![key];
}

function cleanupProfessionPatch(): void {
  const root = draftRecord();
  const professions = asRecord(root.professions);
  const patch = professions && asRecord(professions[selectedProfessionId]);
  if (!patch || !professions) return;
  for (const key of ['skills', 'balanceProfiles', 'modifierRules', 'constants']) {
    removeEmptyRecord(patch, key);
  }

  if (!Object.keys(patch).length) delete professions[selectedProfessionId];
  if (!Object.keys(professions).length) delete root.professions;
}

function selectedProfession(): NativePatchAuthoringMetadata | null {
  return payload?.professions.find((profession) => profession.professionId === selectedProfessionId) || null;
}

function selectedModule(): NativePatchAuthoringModule | null {
  return selectedProfession()?.modules.find((module) => module.id === selectedModuleId) || null;
}

function markDirty(message = 'Unsaved changes'): void {
  dirty = true;
  status = message;
  statusKind = 'neutral';
}

function editCount(professionId: string): number {
  const patch = professionPatch(professionId);
  if (!patch) return 0;
  return (
    Object.keys(asRecord(patch.skills) || {}).length +
    Object.keys(asRecord(patch.balanceProfiles) || {}).length +
    Object.keys(asRecord(patch.modifierRules) || {}).length
  );
}

function overviewForProfession(): readonly PatchOverviewEntry[] {
  const patch = professionPatch(selectedProfessionId);
  return patch && Array.isArray(patch.overview) ? (patch.overview as PatchOverviewEntry[]) : [];
}

function hasSkillEdit(skillId: string): boolean {
  return Boolean(skillEdit(skillId));
}

function hasBalanceProfileEdit(profileId: string): boolean {
  return Boolean(balanceProfileEdit(profileId));
}

function hasModifierEdit(ruleId: string): boolean {
  return Boolean(modifierEdit(ruleId));
}

function numberInput(options: {
  entity: string;
  id: string;
  field: string;
  current: number;
  edit?: NumEdit;
  tick?: number;
  effect?: number;
}): string {
  const preview = numericEditValue(options.current, options.edit);
  const changed = options.edit != null;
  return `<label class="patch-number-row${changed ? ' is-changed' : ''}">
    <span>${escapeHtml(options.field)}</span>
    <code>${escapeHtml(options.current)}</code>
    <span aria-hidden="true">→</span>
    <input type="number" step="any" value="${escapeHtml(preview)}"
      data-numeric-entity="${escapeHtml(options.entity)}"
      data-numeric-id="${escapeHtml(options.id)}"
      data-numeric-field="${escapeHtml(options.field)}"
      data-live-value="${escapeHtml(options.current)}"
      ${options.effect == null ? '' : `data-effect-index="${options.effect}"`}
      ${options.tick == null ? '' : `data-tick-index="${options.tick}"`} />
  </label>`;
}

function modifierValueRows(rule: NativePatchAuthoringModifierRule): string {
  const edit = modifierEdit(rule.id) as ModifierRulePatchEdit | null;
  const rows: string[] = [];
  for (const field of ['amount', 'factor'] as const) {
    const value = rule[field];
    if (value.kind === 'static' && value.value != null) {
      rows.push(
        numberInput({
          entity: 'modifier',
          id: rule.id,
          field,
          current: value.value,
          edit: edit?.[field]
        })
      );
    } else if (value.kind === 'resolver') {
      rows.push(
        `<p class="patch-resolver-note"><strong>${field}</strong> is resolver-backed${
          Object.keys(rule.parameters).length
            ? '; edit its named parameters below.'
            : ' and has no patchable parameters.'
        }</p>`
      );
    }
  }

  for (const [name, current] of Object.entries(rule.parameters)) {
    rows.push(
      numberInput({
        entity: 'modifier-parameter',
        id: rule.id,
        field: name,
        current,
        edit: edit?.parameters?.[name]
      })
    );
  }

  return rows.length
    ? rows.join('')
    : '<p class="patch-empty-inline">This declaration has no patchable numeric value.</p>';
}

function traitReference(module: NativePatchAuthoringModule): string {
  if (!module.traits.length) {
    return '<p class="patch-empty-inline">No trait metadata is owned by this module.</p>';
  }

  return `<details class="patch-reference">
    <summary>Trait reference (${module.traits.length})</summary>
    <div class="patch-trait-grid">${module.traits
      .map(
        (trait) => `<article class="patch-trait-card">
          ${trait.icon ? `<img src="${escapeHtml(trait.icon)}" alt="" />` : ''}
          <div><strong>${escapeHtml(trait.name)}</strong><code>${escapeHtml(trait.id)}</code></div>
          <details><summary>Metadata</summary><pre>${jsonHtml(trait)}</pre></details>
        </article>`
      )
      .join('')}</div>
  </details>`;
}

function modifierSection(module: NativePatchAuthoringModule): string {
  const query = search.trim().toLocaleLowerCase();
  const rules = module.modifierRules.filter((rule) => {
    if (changedOnly && !hasModifierEdit(rule.id)) return false;
    return !query || patchSearchText(rule.id, rule.label, rule.targets, rule.operation).includes(query);
  });
  return `<section class="patch-work-section" aria-labelledby="modifier-heading">
    <div class="patch-section-heading">
      <div><p class="patch-eyebrow">Trait authoring</p><h2 id="modifier-heading">Traits &amp; modifiers</h2></div>
      <span>${rules.length} of ${module.modifierRules.length} rules</span>
    </div>
    ${traitReference(module)}
    <div class="patch-card-list">${
      rules.length
        ? rules
            .map((rule) => {
              const changed = hasModifierEdit(rule.id);
              return `<article class="patch-card${changed ? ' is-changed' : ''}">
                <header>
                  <div><h3>${escapeHtml(rule.label || rule.id)}</h3><code>${escapeHtml(rule.id)}</code></div>
                  <div class="patch-badges">
                    ${changed ? '<span class="patch-badge changed">Changed</span>' : ''}
                    ${rule.conditional ? '<span class="patch-badge">Conditional</span>' : ''}
                    <span class="patch-badge">${escapeHtml(rule.operation)}</span>
                  </div>
                </header>
                <p class="patch-targets">${rule.targets.map(escapeHtml).join(' · ')}</p>
                <div class="patch-number-grid">${modifierValueRows(rule)}</div>
                ${
                  changed
                    ? `<button type="button" class="patch-link-button" data-clear-modifier="${escapeHtml(rule.id)}">Remove authored change</button>`
                    : ''
                }
              </article>`;
            })
            .join('')
        : '<p class="patch-empty">No modifier rules match these filters.</p>'
    }</div>
  </section>`;
}

function skillSearchText(skill: NativePatchAuthoringSkill): string {
  return patchSearchText(
    skill.id,
    skill.name,
    skill.skill.type,
    skill.skill.slot,
    skill.skill.weapon,
    skill.skill.skillWeapon
  );
}

function effectPatchFor(edit: SkillPatchEdit | null, effectIndex: number, tickIndex?: number): EffectPatch | undefined {
  return edit?.effects?.find((effect) => effect.effectIndex === effectIndex && effect.tickIndex === tickIndex);
}

function effectRemoved(edit: SkillPatchEdit | null, effectIndex: number): boolean {
  return Boolean(edit?.removeEffects?.some((selector) => selector.effectIndex === effectIndex));
}

function effectNumericRows(
  skillId: string,
  effectIndex: number,
  effect: Readonly<SkillEffect>,
  edit: SkillPatchEdit | null
): string {
  const topPatch = effectPatchFor(edit, effectIndex);
  const rows = PATCHABLE_EFFECT_NUMERIC_FIELDS.flatMap((field) => {
    const current = effect[field];
    return typeof current === 'number'
      ? [
          numberInput({
            entity: 'effect',
            id: skillId,
            field,
            current,
            edit: topPatch?.[field]
          })
        ]
      : [];
  });
  const ticks = Array.isArray(effect.ticks) ? effect.ticks : [];
  for (const [tickIndex, tick] of ticks.entries()) {
    const tickPatch = effectPatchFor(edit, effectIndex, tickIndex);
    const tickRows = PATCHABLE_EFFECT_NUMERIC_FIELDS.flatMap((field) => {
      const current = tick[field];
      return typeof current === 'number'
        ? [
            numberInput({
              entity: 'effect',
              id: skillId,
              field,
              current,
              edit: tickPatch?.[field],
              tick: tickIndex
            })
          ]
        : [];
    });
    rows.push(`<div class="patch-tick"><strong>Tick ${tickIndex}</strong>${tickRows.join('')}</div>`);
  }

  return rows.join('');
}

function effectCards(skill: NativePatchAuthoringSkill): string {
  const edit = skillEdit(skill.id.toString()) as SkillPatchEdit | null;
  const effects = (skill.skill.effects || []) as readonly SkillEffect[];
  return effects
    .map((effect, effectIndex) => {
      const removed = effectRemoved(edit, effectIndex);
      const detail = effect.name || effect.condition || effect.boon || effect.kind || '';
      return `<article class="patch-effect${removed ? ' is-removed' : ''}">
        <header>
          <div><span class="patch-effect-index">${effectIndex}</span><strong>${escapeHtml(effect.type)}</strong> ${escapeHtml(detail)}</div>
          <button type="button" class="patch-effect-action" data-toggle-effect="${effectIndex}" data-skill-id="${escapeHtml(skill.id)}">
            ${removed ? 'Restore effect' : 'Delete in preview'}
          </button>
        </header>
        <div class="patch-number-grid">${effectNumericRows(skill.id.toString(), effectIndex, effect, edit)}</div>
        <details><summary>Complete live effect metadata</summary><pre>${jsonHtml(effect)}</pre></details>
      </article>`;
    })
    .join('');
}

function addedEffectEditors(skill: NativePatchAuthoringSkill): string {
  const edit = skillEdit(skill.id.toString()) as SkillPatchEdit | null;
  return (edit?.addEffects || [])
    .map(
      (effect, index) => `<article class="patch-added-effect">
        <header><strong>New effect ${index + 1}</strong><button type="button" data-remove-added-effect="${index}" data-skill-id="${escapeHtml(skill.id)}">Remove</button></header>
        <textarea rows="10" spellcheck="false" data-added-effect="${index}" data-skill-id="${escapeHtml(skill.id)}">${jsonHtml(effect)}</textarea>
      </article>`
    )
    .join('');
}

function skillDetail(skill: NativePatchAuthoringSkill | null): string {
  if (!skill) {
    return '<div class="patch-empty patch-empty-detail">Select a skill to inspect its metadata and author changes.</div>';
  }

  const edit = skillEdit(skill.id.toString()) as SkillPatchEdit | null;
  const rawMetadata = Object.fromEntries(Object.entries(skill.skill).filter(([key]) => key !== 'effects'));
  return `<article class="patch-skill-detail">
    <header class="patch-skill-heading">
      ${skill.skill.icon ? `<img src="${escapeHtml(skill.skill.icon)}" alt="" />` : ''}
      <div><p class="patch-eyebrow">${escapeHtml(skill.moduleId)} skill</p><h2>${escapeHtml(skill.name)}</h2><code>${escapeHtml(skill.id)}</code></div>
      ${
        edit
          ? `<button type="button" class="patch-link-button" data-clear-skill="${escapeHtml(skill.id)}">Remove all skill changes</button>`
          : ''
      }
    </header>
    <section class="patch-detail-section">
      <h3>Numeric fields</h3>
      <div class="patch-number-grid">${
        Object.entries(skill.patchableFields).length
          ? Object.entries(skill.patchableFields)
              .map(([field, current]) =>
                numberInput({
                  entity: 'skill',
                  id: skill.id.toString(),
                  field,
                  current,
                  edit:
                    edit?.fields?.[field] ||
                    (field === 'cooldown' ? edit?.cooldown : undefined) ||
                    (field === 'castTimeMs' ? edit?.castTimeMs : undefined)
                })
              )
              .join('')
          : '<p class="patch-empty-inline">No patchable numeric skill fields.</p>'
      }</div>
    </section>
    <section class="patch-detail-section">
      <div class="patch-section-heading compact"><h3>Effects</h3><span>${(skill.skill.effects as readonly unknown[] | undefined)?.length || 0} live</span></div>
      <div class="patch-effect-list">${effectCards(skill) || '<p class="patch-empty-inline">No live effects.</p>'}</div>
      <div class="patch-add-effect-controls">
        <select data-new-effect-type aria-label="New effect type">
          ${['strike', 'condition', 'boon', 'buff', 'control', 'blind', 'custom'].map((type) => `<option value="${type}">${type}</option>`).join('')}
        </select>
        <button type="button" data-add-effect="${escapeHtml(skill.id)}">Add effect</button>
      </div>
      <div class="patch-added-effect-list">${addedEffectEditors(skill)}</div>
    </section>
    <details class="patch-reference" open><summary>Complete skill metadata</summary><pre>${jsonHtml(rawMetadata)}</pre></details>
    ${edit ? `<details class="patch-reference"><summary>Authored skill patch</summary><pre>${jsonHtml(edit)}</pre></details>` : ''}
  </article>`;
}

function skillSection(module: NativePatchAuthoringModule): string {
  const query = search.trim().toLocaleLowerCase();
  const skills = [...module.skills]
    .filter((skill) => {
      if (changedOnly && !hasSkillEdit(skill.id.toString())) return false;
      return !query || skillSearchText(skill).includes(query);
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  const groups = groupPatchAuthoringSkills(skills);
  const selected = module.skills.find((skill) => String(skill.id) === selectedSkillId) || null;
  return `<section class="patch-work-section patch-skills" aria-labelledby="skill-heading">
    <div class="patch-section-heading">
      <div><p class="patch-eyebrow">Skill authoring</p><h2 id="skill-heading">Skills</h2></div>
      <span>${skills.length} of ${module.skills.length} skills</span>
    </div>
    <div class="patch-skill-workspace">
      <nav class="patch-skill-list" aria-label="Skills">${
        skills.length
          ? groups
              .map(
                (group) => `<section class="patch-skill-group" data-skill-group="${escapeHtml(group.key)}">
                  <h3 class="patch-skill-group-heading"><span>${escapeHtml(group.label)}</span><small>${group.skills.length}</small></h3>
                  ${group.skills
                    .map(
                      (
                        skill
                      ) => `<button type="button" class="patch-skill-option${String(skill.id) === selectedSkillId ? ' is-selected' : ''}${hasSkillEdit(skill.id.toString()) ? ' is-changed' : ''}" data-select-skill="${escapeHtml(skill.id)}">
                        ${skill.skill.icon ? `<img src="${escapeHtml(skill.skill.icon)}" alt="" />` : ''}
                        <span><strong>${escapeHtml(skill.name)}</strong><small>${escapeHtml(skill.skill.type || 'Skill')} · ${escapeHtml(skill.id)}</small></span>
                      </button>`
                    )
                    .join('')}
                </section>`
              )
              .join('')
          : '<p class="patch-empty-inline">No skills match these filters.</p>'
      }</nav>
      <div class="patch-skill-editor">${skillDetail(selected)}</div>
    </div>
  </section>`;
}

function renderSelectedSkill(): void {
  const module = selectedModule();
  const selected = module?.skills.find((skill) => String(skill.id) === selectedSkillId) || null;
  for (const option of app.querySelectorAll<HTMLButtonElement>('[data-select-skill]')) {
    option.classList.toggle('is-selected', option.dataset.selectSkill === selectedSkillId);
  }

  const editor = app.querySelector<HTMLElement>('.patch-skill-editor');
  if (editor) editor.innerHTML = skillDetail(selected);
}

function balanceProfileEffectRows(
  profileId: string,
  effectIndex: number,
  effect: Readonly<SkillEffect>,
  edit: SkillPatchEdit | null
): string {
  const topPatch = effectPatchFor(edit, effectIndex);
  const rows = PATCHABLE_EFFECT_NUMERIC_FIELDS.flatMap((field) => {
    const current = effect[field];
    return typeof current === 'number'
      ? [
          numberInput({
            entity: 'balance-profile-effect',
            id: profileId,
            field,
            current,
            edit: topPatch?.[field],
            effect: effectIndex
          })
        ]
      : [];
  });
  const ticks = Array.isArray(effect.ticks) ? effect.ticks : [];
  for (const [tickIndex, tick] of ticks.entries()) {
    const tickPatch = effectPatchFor(edit, effectIndex, tickIndex);
    const tickRows = PATCHABLE_EFFECT_NUMERIC_FIELDS.flatMap((field) => {
      const current = tick[field];
      return typeof current === 'number'
        ? [
            numberInput({
              entity: 'balance-profile-effect',
              id: profileId,
              field,
              current,
              edit: tickPatch?.[field],
              effect: effectIndex,
              tick: tickIndex
            })
          ]
        : [];
    });
    rows.push(`<div class="patch-tick"><strong>Tick ${tickIndex}</strong>${tickRows.join('')}</div>`);
  }

  return rows.join('');
}

function balanceProfileDetail(entry: NativePatchAuthoringBalanceProfile | null): string {
  if (!entry) {
    return '<div class="patch-empty patch-empty-detail">Select a balance profile to inspect and author.</div>';
  }

  const id = String(entry.id);
  const edit = balanceProfileEdit(id) as SkillPatchEdit | null;
  const effects = (entry.profile.effects || []) as readonly SkillEffect[];
  const rawMetadata = Object.fromEntries(Object.entries(entry.profile).filter(([key]) => key !== 'effects'));
  return `<article class="patch-skill-detail">
    <header class="patch-skill-heading">
      <div><p class="patch-eyebrow">${escapeHtml(entry.profile.profileKind)} balance profile</p><h2>${escapeHtml(entry.name)}</h2><code>${escapeHtml(id)}</code></div>
      ${edit ? `<button type="button" class="patch-link-button" data-clear-profile="${escapeHtml(id)}">Remove all profile changes</button>` : ''}
    </header>
    <section class="patch-detail-section">
      <h3>Numeric fields</h3>
      <div class="patch-number-grid">${
        Object.entries(entry.patchableFields).length
          ? Object.entries(entry.patchableFields)
              .map(([field, current]) =>
                numberInput({
                  entity: 'balance-profile',
                  id,
                  field,
                  current,
                  edit: edit?.fields?.[field]
                })
              )
              .join('')
          : '<p class="patch-empty-inline">No patchable numeric profile fields.</p>'
      }</div>
    </section>
    <section class="patch-detail-section">
      <div class="patch-section-heading compact"><h3>Effects</h3><span>${effects.length} live</span></div>
      <div class="patch-effect-list">${
        effects.length
          ? effects
              .map((effect, effectIndex) => {
                const detail = effect.name || effect.condition || effect.boon || effect.kind || '';
                return `<article class="patch-effect">
                  <header><div><span class="patch-effect-index">${effectIndex}</span><strong>${escapeHtml(effect.type)}</strong> ${escapeHtml(detail)}</div></header>
                  <div class="patch-number-grid">${balanceProfileEffectRows(id, effectIndex, effect, edit)}</div>
                  <details><summary>Complete live effect metadata</summary><pre>${jsonHtml(effect)}</pre></details>
                </article>`;
              })
              .join('')
          : '<p class="patch-empty-inline">No live effects.</p>'
      }</div>
    </section>
    <details class="patch-reference" open><summary>Complete balance profile metadata</summary><pre>${jsonHtml(rawMetadata)}</pre></details>
    ${edit ? `<details class="patch-reference"><summary>Authored balance profile patch</summary><pre>${jsonHtml(edit)}</pre></details>` : ''}
  </article>`;
}

function balanceProfileSection(module: NativePatchAuthoringModule): string {
  const query = search.trim().toLocaleLowerCase();
  const profiles = [...module.balanceProfiles]
    .filter((entry) => {
      if (changedOnly && !hasBalanceProfileEdit(String(entry.id))) return false;
      return !query || patchSearchText(entry.id, entry.name, entry.profile.profileKind).includes(query);
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  const selected = module.balanceProfiles.find((entry) => String(entry.id) === selectedProfileId) || null;
  return `<section class="patch-work-section patch-skills" aria-labelledby="profile-heading">
    <div class="patch-section-heading">
      <div><p class="patch-eyebrow">Non-skill balance authoring</p><h2 id="profile-heading">Balance profiles</h2></div>
      <span>${profiles.length} of ${module.balanceProfiles.length} profiles</span>
    </div>
    <p class="patch-section-description">Trait effects, mechanic values, and skill-state variants that are not independently castable skills.</p>
    <div class="patch-skill-workspace">
      <nav class="patch-skill-list" aria-label="Balance profiles">${
        profiles.length
          ? profiles
              .map(
                (
                  entry
                ) => `<button type="button" class="patch-skill-option${String(entry.id) === selectedProfileId ? ' is-selected' : ''}${hasBalanceProfileEdit(String(entry.id)) ? ' is-changed' : ''}" data-select-profile="${escapeHtml(entry.id)}">
                  <span><strong>${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.profile.profileKind)} · ${escapeHtml(entry.id)}</small></span>
                </button>`
              )
              .join('')
          : '<p class="patch-empty-inline">No balance profiles match these filters.</p>'
      }</nav>
      <div class="patch-skill-editor">${balanceProfileDetail(selected)}</div>
    </div>
  </section>`;
}

function overviewCard(entry: PatchOverviewEntry): string {
  return `<article class="patch-note-editor is-generated">
    <header>
      <strong>${escapeHtml(entry.subject)}</strong>
      <span class="patch-badge changed">Generated from diff</span>
    </header>
    <p>${escapeHtml(entry.text)}</p>
  </article>`;
}

function overviewEntries(profession: NativePatchAuthoringMetadata): string {
  const query = search.trim().toLocaleLowerCase();
  const entries = overviewForProfession().filter(
    (entry) => !query || patchSearchText(entry.subject, entry.text, entry.source).includes(query)
  );
  return `<section class="patch-note-scope">
    <div class="patch-section-heading compact">
      <div><h3>${escapeHtml(profession.professionName)} changes</h3><p>Generated from the active skill and trait modifier diff.</p></div>
    </div>
    <div class="patch-note-editor-list">${
      entries.length
        ? entries.map(overviewCard).join('')
        : '<p class="patch-empty-inline">No changes for this profession.</p>'
    }</div>
  </section>`;
}

function overviewSection(profession: NativePatchAuthoringMetadata): string {
  const sourceUrl = officialSourceUrl();
  return `<section class="patch-work-section" aria-labelledby="overview-heading">
    <div class="patch-section-heading">
      <div><p class="patch-eyebrow">Published source and local diff</p><h2 id="overview-heading">Patch overview</h2></div>
      <span>${overviewForProfession().length} changes</span>
    </div>
    <p class="patch-section-description">The official patch notes are the canonical explanation. This overview is generated from the skill and trait modifier edits authored in this preview.</p>
    <div class="patch-official-source">
      <div><strong>Official patch notes</strong><p>${sourceUrl ? "Open ArenaNet's published notes for the full context." : 'Add a valid HTTP or HTTPS URL in the preview metadata above.'}</p></div>
      ${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">View official patch notes <span aria-hidden="true">↗</span></a>` : ''}
    </div>
    ${overviewEntries(profession)}
  </section>`;
}

function render(): void {
  if (!payload) {
    app.innerHTML = `<div class="patch-loading">${escapeHtml(status)}</div>`;
    return;
  }

  draft = generatePatchOverview(draft, payload.professions);
  const profession = selectedProfession() || payload.professions[0];
  if (profession && profession.professionId !== selectedProfessionId) {
    selectedProfessionId = profession.professionId;
  }

  const module = selectedModule() || profession?.modules[0] || null;
  if (module && module.id !== selectedModuleId) selectedModuleId = module.id;
  const changed = payload.professions.reduce((total, entry) => total + editCount(entry.professionId), 0);
  app.innerHTML = `<header class="patch-authoring-header">
    <div><p class="patch-eyebrow">Local developer tool</p><h1>Patch Preview Authoring</h1><p>Edit canonical live metadata and save a validated <code>activePatchPreview</code>.</p></div>
    <div class="patch-save-block">
      <span class="patch-status ${statusKind}" role="status">${escapeHtml(status)}</span>
      <button type="button" class="patch-secondary-button" data-reset-preview ${dirty ? '' : 'disabled'}>Reset</button>
      <button type="button" class="patch-primary-button" data-save-preview>Save to disk</button>
    </div>
  </header>
  <section class="patch-preview-meta" aria-label="Preview metadata">
    <label><span>ID</span><input data-preview-field="id" value="${escapeHtml(draft.id)}" required pattern="[a-z0-9][a-z0-9-]*" /></label>
    <label><span>Label</span><input data-preview-field="label" value="${escapeHtml(draft.label)}" required /></label>
    <label><span>Publish date</span><input type="date" data-preview-field="publishedAt" value="${escapeHtml(draft.publishedAt || '')}" /></label>
    <label class="wide"><span>Official patch notes URL</span><input type="url" data-preview-field="sourceUrl" value="${escapeHtml(draft.sourceUrl || '')}" placeholder="https://en-forum.guildwars2.com/topic/..." /></label>
  </section>
  <div class="patch-authoring-layout">
    <aside class="patch-profession-nav">
      <div class="patch-nav-heading"><strong>Profession</strong><span>${changed} edited</span></div>
      ${payload.professions
        .map((entry) => {
          const count = editCount(entry.professionId);
          return `<button type="button" data-select-profession="${escapeHtml(entry.professionId)}" class="${entry.professionId === selectedProfessionId ? 'is-selected' : ''}">
            <span>${escapeHtml(entry.professionName)}</span>${count ? `<strong>${count}</strong>` : ''}
          </button>`;
        })
        .join('')}
    </aside>
    <main class="patch-authoring-main">
      <div class="patch-toolbar">
        <div class="patch-module-tabs" role="tablist" aria-label="Specialization">
          ${(profession?.modules || [])
            .map(
              (entry) =>
                `<button type="button" role="tab" aria-selected="${entry.id === selectedModuleId}" class="${entry.id === selectedModuleId ? 'is-selected' : ''}" data-select-module="${escapeHtml(entry.id)}">${escapeHtml(entry.id)}</button>`
            )
            .join('')}
        </div>
        <div class="patch-filters">
          <input type="search" data-patch-search value="${escapeHtml(search)}" placeholder="Search names, IDs, targets…" />
          <label><input type="checkbox" data-changed-only ${changedOnly ? 'checked' : ''} /> Edited only</label>
        </div>
        <div class="patch-section-tabs" role="tablist" aria-label="Authoring section">
          <button type="button" data-select-section="traits" class="${selectedSection === 'traits' ? 'is-selected' : ''}">Traits &amp; modifiers</button>
          <button type="button" data-select-section="skills" class="${selectedSection === 'skills' ? 'is-selected' : ''}">Skills</button>
          <button type="button" data-select-section="profiles" class="${selectedSection === 'profiles' ? 'is-selected' : ''}">Balance profiles</button>
          <button type="button" data-select-section="overview" class="${selectedSection === 'overview' ? 'is-selected' : ''}">Overview &amp; source</button>
        </div>
      </div>
      ${
        module
          ? selectedSection === 'traits'
            ? modifierSection(module)
            : selectedSection === 'skills'
              ? skillSection(module)
              : selectedSection === 'profiles'
                ? balanceProfileSection(module)
                : overviewSection(profession)
          : '<p class="patch-empty">No authoring metadata is available.</p>'
      }
      <details class="patch-generated-preview"><summary>Preview object to be written</summary><pre>${jsonHtml(compactPatchPreview(draft))}</pre></details>
    </main>
  </div>`;
}

function deleteModifierEdit(ruleId: string): void {
  const patch = professionPatch(selectedProfessionId);
  const rules = patch && asRecord(patch.modifierRules);
  if (rules) delete rules[ruleId];
  cleanupProfessionPatch();
}

function deleteSkillEdit(skillId: string): void {
  const patch = professionPatch(selectedProfessionId);
  const skills = patch && asRecord(patch.skills);
  if (skills) delete skills[skillId];
  cleanupProfessionPatch();
}

function deleteBalanceProfileEdit(profileId: string): void {
  const patch = professionPatch(selectedProfessionId);
  const profiles = patch && asRecord(patch.balanceProfiles);
  if (profiles) delete profiles[profileId];
  cleanupProfessionPatch();
}

function setNumericEdit(input: HTMLInputElement): void {
  const current = Number(input.dataset.liveValue);
  const next = Number(input.value);
  if (!Number.isFinite(current) || !Number.isFinite(next)) {
    throw new TypeError('Preview values must be finite numbers.');
  }

  const entity = input.dataset.numericEntity;
  const id = input.dataset.numericId || '';
  const field = input.dataset.numericField || '';
  const numericEdit = numericEditForValue(current, next);
  if (entity === 'modifier' || entity === 'modifier-parameter') {
    const edit = modifierEdit(id, Boolean(numericEdit));
    if (!edit) return;
    const target = entity === 'modifier-parameter' ? ensureRecord(edit, 'parameters') : edit;
    if (numericEdit) target[field] = numericEdit;
    else delete target[field];
    removeEmptyRecord(edit, 'parameters');
    if (!Object.keys(edit).length) deleteModifierEdit(id);
    return;
  }

  if (entity === 'skill') {
    const edit = skillEdit(id, Boolean(numericEdit));
    if (!edit) return;
    const fields = numericEdit ? ensureRecord(edit, 'fields') : asRecord(edit.fields);
    if (numericEdit) fields![field] = numericEdit;
    else if (fields) delete fields[field];
    removeEmptyRecord(edit, 'fields');
    if (!Object.keys(edit).length) deleteSkillEdit(id);
    return;
  }

  if (entity === 'balance-profile') {
    const edit = balanceProfileEdit(id, Boolean(numericEdit));
    if (!edit) return;
    const fields = numericEdit ? ensureRecord(edit, 'fields') : asRecord(edit.fields);
    if (numericEdit) fields![field] = numericEdit;
    else if (fields) delete fields[field];
    removeEmptyRecord(edit, 'fields');
    if (!Object.keys(edit).length) deleteBalanceProfileEdit(id);
    return;
  }

  if (entity === 'effect') {
    const effectIndex = Number(
      input.closest<HTMLElement>('.patch-effect')?.querySelector<HTMLElement>('[data-toggle-effect]')?.dataset
        .toggleEffect
    );
    const tickIndex = input.dataset.tickIndex;
    const edit = skillEdit(id, Boolean(numericEdit));
    if (!edit || !Number.isInteger(effectIndex)) return;
    const effects = Array.isArray(edit.effects) ? (edit.effects as DraftRecord[]) : [];
    let effect = effects.find(
      (entry) =>
        entry.effectIndex === effectIndex && entry.tickIndex === (tickIndex == null ? undefined : Number(tickIndex))
    );
    if (!effect && numericEdit) {
      effect = {
        effectIndex,
        ...(tickIndex == null ? {} : { tickIndex: Number(tickIndex) })
      };
      effects.push(effect);
    }

    if (effect && numericEdit) effect[field] = numericEdit;
    else if (effect) delete effect[field];
    const retained = effects.filter((entry) =>
      Object.keys(entry).some((key) => !['effectIndex', 'tickIndex'].includes(key))
    );
    if (retained.length) edit.effects = retained;
    else delete edit.effects;
    if (!Object.keys(edit).length) deleteSkillEdit(id);
    return;
  }

  if (entity === 'balance-profile-effect') {
    const effectIndex = Number(input.dataset.effectIndex);
    const tickIndex = input.dataset.tickIndex;
    const edit = balanceProfileEdit(id, Boolean(numericEdit));
    if (!edit || !Number.isInteger(effectIndex)) return;
    const effects = Array.isArray(edit.effects) ? (edit.effects as DraftRecord[]) : [];
    let effect = effects.find(
      (entry) =>
        entry.effectIndex === effectIndex && entry.tickIndex === (tickIndex == null ? undefined : Number(tickIndex))
    );
    if (!effect && numericEdit) {
      effect = {
        effectIndex,
        ...(tickIndex == null ? {} : { tickIndex: Number(tickIndex) })
      };
      effects.push(effect);
    }

    if (effect && numericEdit) effect[field] = numericEdit;
    else if (effect) delete effect[field];
    const retained = effects.filter((entry) =>
      Object.keys(entry).some((key) => !['effectIndex', 'tickIndex'].includes(key))
    );
    if (retained.length) edit.effects = retained;
    else delete edit.effects;
    if (!Object.keys(edit).length) deleteBalanceProfileEdit(id);
  }
}

function toggleEffect(skillId: string, effectIndex: number): void {
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

function addEffect(skillId: string): void {
  const select = app.querySelector<HTMLSelectElement>('[data-new-effect-type]');
  const edit = skillEdit(skillId, true)!;
  const effects = Array.isArray(edit.addEffects) ? (edit.addEffects as SkillEffect[]) : [];
  edit.addEffects = [...effects, createEffectTemplate(select?.value || 'strike')];
}

function removeAddedEffect(skillId: string, index: number): void {
  const edit = skillEdit(skillId);
  if (!edit || !Array.isArray(edit.addEffects)) return;
  const effects = (edit.addEffects as SkillEffect[]).filter((_, effectIndex) => effectIndex !== index);
  if (effects.length) edit.addEffects = effects;
  else delete edit.addEffects;
  if (!Object.keys(edit).length) deleteSkillEdit(skillId);
}

async function loadAuthoring(): Promise<void> {
  status = 'Loading live authoring metadata…';
  statusKind = 'neutral';
  render();
  try {
    const response = await fetch('api/patch-preview', {
      headers: { Accept: 'application/json' }
    });
    const result = (await response.json()) as AuthoringPayload & {
      error?: string;
    };
    if (!response.ok) throw new Error(result.error || 'Authoring API failed.');
    payload = result;
    draft = structuredClone(result.preview || createPatchPreviewDraft());
    selectedProfessionId = Object.keys(draft.professions || {})[0] || result.professions[0]?.professionId || '';
    selectedModuleId = 'Core';
    selectedSkillId = '';
    selectedProfileId = '';
    dirty = false;
    status = result.preview ? `Loaded ${result.sourceFile}` : 'No active preview exists; a new draft is ready.';
    statusKind = 'success';
  } catch (error) {
    status = error instanceof Error ? error.message : 'Unable to load patch authoring metadata.';
    statusKind = 'error';
  }

  render();
}

async function saveAuthoring(): Promise<void> {
  const candidate = compactPatchPreview(generatePatchOverview(draft, payload?.professions || []));
  status = 'Validating and writing active-preview.ts…';
  statusKind = 'neutral';
  render();
  try {
    const response = await fetch('api/patch-preview', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ preview: candidate })
    });
    const result = (await response.json()) as {
      preview?: PatchPreview;
      sourceFile?: string;
      rebuildRequired?: boolean;
      error?: string;
    };
    if (!response.ok || !result.preview) {
      throw new Error(result.error || 'Patch preview save failed.');
    }

    draft = structuredClone(result.preview);
    dirty = false;
    status = `Saved ${result.sourceFile}. Rebuild or restart the simulator to load it.`;
    statusKind = 'success';
  } catch (error) {
    status = error instanceof Error ? error.message : 'Patch preview save failed.';
    statusKind = 'error';
  }

  render();
}

app.addEventListener('click', (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button');
  if (!button) return;
  if (button.dataset.selectProfession) {
    selectedProfessionId = button.dataset.selectProfession;
    selectedModuleId = 'Core';
    selectedSkillId = '';
    selectedProfileId = '';
  } else if (button.dataset.selectModule) {
    selectedModuleId = button.dataset.selectModule;
    selectedSkillId = '';
    selectedProfileId = '';
  } else if (button.dataset.selectSection) {
    selectedSection = button.dataset.selectSection as AuthoringSection;
  } else if (button.dataset.selectSkill) {
    selectedSkillId = button.dataset.selectSkill;
    renderSelectedSkill();
    return;
  } else if (button.dataset.selectProfile) {
    selectedProfileId = button.dataset.selectProfile;
  } else if (button.dataset.clearModifier) {
    deleteModifierEdit(button.dataset.clearModifier);
    markDirty();
  } else if (button.dataset.clearSkill) {
    deleteSkillEdit(button.dataset.clearSkill);
    markDirty();
  } else if (button.dataset.clearProfile) {
    deleteBalanceProfileEdit(button.dataset.clearProfile);
    markDirty();
  } else if (button.dataset.toggleEffect != null) {
    toggleEffect(button.dataset.skillId || '', Number(button.dataset.toggleEffect));
    markDirty();
  } else if (button.dataset.addEffect) {
    addEffect(button.dataset.addEffect);
    markDirty();
  } else if (button.dataset.removeAddedEffect != null) {
    removeAddedEffect(button.dataset.skillId || '', Number(button.dataset.removeAddedEffect));
    markDirty();
  } else if (button.hasAttribute('data-save-preview')) {
    void saveAuthoring();
    return;
  } else if (button.hasAttribute('data-reset-preview')) {
    void loadAuthoring();
    return;
  }

  render();
});

app.addEventListener('change', (event) => {
  const target = event.target;
  if (target instanceof HTMLSelectElement && target.hasAttribute('data-new-effect-type')) {
    return;
  }

  try {
    if (target instanceof HTMLInputElement && target.dataset.previewField) {
      const field = target.dataset.previewField as keyof PatchPreview;
      const record = draftRecord();
      if (target.value) record[field] = target.value;
      else delete record[field];
      markDirty();
    } else if (target instanceof HTMLInputElement && target.dataset.numericEntity) {
      setNumericEdit(target);
      markDirty();
    } else if (target instanceof HTMLInputElement && target.hasAttribute('data-changed-only')) {
      changedOnly = target.checked;
    } else if (target instanceof HTMLInputElement && target.hasAttribute('data-patch-search')) {
      search = target.value;
    } else if (target instanceof HTMLTextAreaElement && target.dataset.addedEffect != null) {
      const parsed = JSON.parse(target.value) as SkillEffect;
      if (!parsed || typeof parsed !== 'object' || !parsed.type) {
        throw new TypeError('An added effect must be a JSON object with a type.');
      }

      const edit = skillEdit(target.dataset.skillId || '', true)!;
      const effects = [...((edit.addEffects || []) as SkillEffect[])];
      effects[Number(target.dataset.addedEffect)] = parsed;
      edit.addEffects = effects;
      markDirty();
    }
  } catch (error) {
    status = error instanceof Error ? error.message : 'Invalid authoring value.';
    statusKind = 'error';
  }

  render();
});

window.addEventListener('beforeunload', (event) => {
  if (!dirty) return;
  event.preventDefault();
});

void loadAuthoring();
