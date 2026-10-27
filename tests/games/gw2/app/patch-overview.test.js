import assert from 'node:assert/strict';
import test from 'node:test';
import { generatePatchOverview } from '#gw2/integrations/patches/authoring/overview-generation.js';
import { validatePatchPreview } from '#gw2/integrations/patches/authoring/patches.js';
import { withPatchPreview } from '#gw2/integrations/patches/authoring/profession.js';
import {
  acceptSavedDraft,
  editorState,
  loadEditorPayload,
  overviewForProfession,
  prepareEditorStateForRender,
  setNumericEdit
} from '#gw2/integrations/patches/app/editor-state.js';
import { warriorProfession } from '#gw2/professions/warrior/profession.js';
import { WARRIOR_SKILL_IDS } from '#gw2/professions/warrior/data/ids.js';
import {
  serializeActivePatchPreview,
  validateAuthoringPreview
} from '../../../../scripts/patch-preview/patch-preview-authoring-api.mjs';

const skillId = WARRIOR_SKILL_IDS.TO_THE_LIMIT;
const otherSkillId = WARRIOR_SKILL_IDS.HEAD_BUTT;
const profession = withPatchPreview(warriorProfession, null);
const runtime = { professions: [profession], validatePatchPreview };

// Small declarations exercise the saved schema and presentation boundary independently of benchmark rotations.
function previewFixture() {
  return {
    id: 'overview-test',
    label: 'Overview test',
    professions: { warrior: { skills: { [skillId]: { fields: { cooldown: 12 } } } } }
  };
}

test('rendering and saving keep generated overview entries out of the draft and serialized patch', () => {
  loadEditorPayload({ preview: previewFixture(), professions: [profession.patchAuthoring] });
  const before = structuredClone(editorState.draft);
  prepareEditorStateForRender();
  const entries = overviewForProfession();
  assert.equal(entries[0].subject, warriorProfession.catalog.skillsById.get(skillId).name);
  assert.match(entries[0].text, /Cooldown set to 12/);
  assert.deepEqual(editorState.draft, before);
  assert.equal(editorState.dirty, false);

  const saved = validateAuthoringPreview(editorState.draft, runtime);
  assert.deepEqual(saved, before);
  assert.doesNotMatch(serializeActivePatchPreview(saved), /"overview"\s*:/);
  acceptSavedDraft(saved);
  assert.deepEqual(overviewForProfession(), entries);

  const current = warriorProfession.catalog.skillsById.get(skillId).cooldown;
  setNumericEdit({ entity: 'skill', id: String(skillId), field: 'cooldown', current, next: 7 });
  assert.match(overviewForProfession()[0].text, /7/);
  const updated = validateAuthoringPreview(editorState.draft, runtime);
  assert.equal(Object.hasOwn(updated.professions.warrior, 'overview'), false);
  assert.equal(
    withPatchPreview(warriorProfession, updated).resolvePatch({ id: updated.id }).catalog.skillsById.get(skillId)
      .cooldown,
    7
  );
});

test('persisted overview fields are rejected by runtime and authoring validation', () => {
  const preview = previewFixture();
  preview.professions.warrior.overview = [];
  assert.throws(() => validatePatchPreview(preview), /unsupported field overview/);
  assert.throws(() => validateAuthoringPreview(preview, runtime), /unsupported field overview/);
  assert.throws(() => profession.validatePatch(preview.professions.warrior), /unsupported field overview/);
});

test('build notes derive from relevant edits without including unselected skills', () => {
  const preview = previewFixture();
  preview.professions.warrior.skills[otherSkillId] = { fields: { cooldown: 8 } };
  const patched = withPatchPreview(warriorProfession, preview);
  const config = { selectedTraitIds: [], selectedSkillIds: [skillId] };
  assert.deepEqual(
    patched.patchOverviewFor(config, []).map(({ subject }) => subject),
    [warriorProfession.catalog.skillsById.get(skillId).name]
  );
  assert.deepEqual(
    patched.patchOverviewFor(config, [otherSkillId]).map(({ subject }) => subject),
    [
      warriorProfession.catalog.skillsById.get(skillId).name,
      warriorProfession.catalog.skillsById.get(otherSkillId).name
    ]
  );
  assert.equal(Object.hasOwn(patched.preview.professions.warrior, 'overview'), false);
});

test('derived entries retain metadata labels and authored qualifications for every edit category', () => {
  const patch = validatePatchPreview({
    id: 'fixture',
    label: 'Fixture',
    professions: {
      fixture: {
        skills: { 1: { fields: { cooldown: 5 } } },
        balanceProfiles: { 2: { fields: { coefficient: 2 }, assumption: 'Provisional profile.' } },
        modifierRules: { damage: { amount: 10, assumption: 'Provisional modifier.' } }
      }
    }
  }).professions.fixture;
  const metadata = {
    modules: [
      {
        skills: [{ id: 1, name: 'Skill label' }],
        balanceProfiles: [{ id: 2, name: 'Profile label' }],
        modifierRules: [{ id: 'damage', label: 'Modifier label' }]
      }
    ]
  };
  const entries = generatePatchOverview(patch, metadata);
  assert.deepEqual(
    entries.map(({ subject, source }) => [subject, source]),
    [
      ['Skill label', 'skill-diff'],
      ['Profile label', 'profile-diff'],
      ['Modifier label', 'modifier-diff']
    ]
  );
  assert.match(entries[1].text, /Provisional profile\./);
  assert.match(entries[2].text, /Provisional modifier\./);
  assert.deepEqual(generatePatchOverview({}, metadata), []);
  assert.equal(Object.hasOwn(patch, 'overview'), false);
});
