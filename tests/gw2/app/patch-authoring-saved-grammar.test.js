import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/catalog.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import {
  acceptSavedDraft,
  editorState,
  loadEditorPayload,
  setNumericEdit
} from '#gw2/integrations/patches/app/editor-state.js';
import { bindPatchAuthoringView, renderPatchAuthoring } from '#gw2/integrations/patches/app/render.js';

// Exercise accepted saved grammar through loading, rendering, editing, and runtime application on tiny declarations.
for (const section of ['skills', 'balanceProfiles']) {
  for (const stacked of [false, true]) {
    test(`${section} editor round-trips ${stacked ? 'stacked selectors and shorthands' : 'zero and coefficient shorthand'}`, () => {
      const source = {
        id: 1,
        name: 'Fixture',
        cooldown: 10,
        ...(section === 'balanceProfiles' ? { profileKind: 'mechanic' } : {}),
        effects: [
          { type: 'strike', name: 'Initial', coefficient: 1 },
          ...(stacked
            ? [
                {
                  type: 'strike',
                  ticks: [
                    { atMs: 0, coefficient: 1 },
                    { atMs: 100, coefficient: 2 }
                  ]
                },
                { type: 'condition', condition: 'Burning', stacks: 1, duration: 3 },
                {
                  type: 'boon',
                  boon: 'might',
                  stacks: 1,
                  duration: 5,
                  audience: { recipients: 'party', maximumRecipients: 5 }
                },
                { type: 'blind', name: 'Removed' }
              ]
            : [])
        ]
      };
      const catalog = createCanonicalCatalog({ [section === 'skills' ? 'generated' : section]: [source] });
      const apply = (patch) => {
        const result =
          section === 'skills' ? applySkillPatch(catalog, patch) : applyBalanceProfilePatch(catalog, patch);
        return result[section][0];
      };

      const edit = {
        fields: { cooldown: 0 },
        coefficient: { multiply: 2 },
        ...(stacked
          ? {
              cooldown: 4,
              effects: [
                { name: 'Initial', coefficient: { add: 1 } },
                { effectIndex: 0, coefficient: { multiply: 3 } },
                { effectIndex: 1, tickIndex: 'all', coefficient: { add: 1 } },
                { boon: 'might', audience: { maximumRecipients: 2 } }
              ],
              conditions: { Burning: { duration: { add: 2 } } },
              boons: { might: { stacks: 3 } },
              removeEffects: [{ name: 'Removed' }],
              addEffects: [{ type: 'blind', name: 'Added' }]
            }
          : {})
      };
      const preview = { id: 'fixture', label: 'Fixture', professions: { warrior: { [section]: { Fixture: edit } } } };
      const original = structuredClone(preview);
      const entry = {
        id: source.id,
        name: source.name,
        moduleId: 'Core',
        [section === 'skills' ? 'skill' : 'profile']: source,
        patchableFields: { cooldown: 10 }
      };
      const payload = {
        preview,
        sourceFile: 'active-preview.ts',
        professions: [
          {
            professionId: 'warrior',
            professionName: 'Warrior',
            modules: [
              {
                id: 'Core',
                traits: [],
                modifierRules: [],
                skills: [],
                balanceProfiles: [],
                skillVariants: [],
                [section]: [entry]
              }
            ]
          }
        ]
      };
      loadEditorPayload(payload);
      editorState.selectedSection = section === 'skills' ? 'skills' : 'mechanics';
      editorState.selectedSkillId = '1';
      editorState.selectedProfileId = '1';
      const root = { innerHTML: '', addEventListener() {} };
      bindPatchAuthoringView(root, { onSave() {}, onReset() {} });
      const displayed = (field) => {
        editorState.selectedSkillId = '1';
        editorState.selectedProfileId = '1';
        renderPatchAuthoring();
        return [...root.innerHTML.matchAll(/<input\b[^>]*>/g)]
          .map(([input]) => input)
          .filter((input) => input.includes(`data-numeric-field="${field}"`))
          .map((input) => Number(input.match(/\bvalue="([^"]*)"/)[1]));
      };

      const expected = apply(preview.professions.warrior);
      assert.deepEqual(apply(editorState.draft.professions.warrior), expected);
      assert.deepEqual(displayed('cooldown'), [expected.cooldown]);
      assert.deepEqual(
        displayed('coefficient'),
        expected.effects
          .filter((effect) => effect.type === 'strike')
          .flatMap((effect) => (effect.ticks ? effect.ticks.map((tick) => tick.coefficient) : [effect.coefficient]))
      );
      if (stacked) {
        assert.deepEqual(displayed('duration'), [5, 5]);
        assert.deepEqual(displayed('audience.maximumRecipients'), [2]);
      }

      for (const next of [7, 1]) {
        setNumericEdit({
          entity: section === 'skills' ? 'effect' : 'balance-profile-effect',
          id: '1',
          field: 'coefficient',
          current: 1,
          next,
          effectIndex: 0
        });
        setNumericEdit({
          entity: section === 'skills' ? 'skill' : 'balance-profile',
          id: '1',
          field: 'cooldown',
          current: 10,
          next: 10
        });
        acceptSavedDraft(editorState.draft);
        loadEditorPayload({ ...payload, preview: editorState.draft });
        const result = apply(editorState.draft.professions.warrior);
        assert.equal(result.effects[0].coefficient, next);
        assert.equal(result.cooldown, 10);
        assert.deepEqual(result.effects.slice(1), expected.effects.slice(1));
        assert.equal(displayed('coefficient')[0], next);
        assert.deepEqual(displayed('cooldown'), [10]);
      }

      assert.deepEqual(preview, original);
    });
  }
}
