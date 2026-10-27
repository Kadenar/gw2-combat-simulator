import { SHARED_PROFILE_FIELDS } from '#gw2/platform/skills/profile-fields.js';
import { requireSkillAction } from '#gw2/platform/effects/actions.js';
import { skillAuthoringReference } from '#gw2/integrations/patches/authoring/fields.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createCanonicalCatalog } from '#gw2/platform/skills/catalog.js';
import { applyBalanceProfilePatch, applySkillPatch } from '#gw2/integrations/patches/authoring/patches.js';
import {
  acceptSavedDraft,
  editorState,
  loadEditorPayload,
  setNumericEdit,
  toggleEffect
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
                { type: 'condition', condition: 'Blindness', stacks: 1, duration: 3, name: 'Removed' }
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
              addEffects: [{ type: 'condition', condition: 'Blindness', stacks: 1, duration: 3, name: 'Added' }]
            }
          : {})
      };
      const preview = {
        id: 'fixture',
        label: 'Fixture',
        professions: { warrior: { [section]: { [source.id]: edit } } }
      };
      const original = structuredClone(preview);
      const entry = {
        id: source.id,
        name: source.name,
        moduleId: 'Core',
        [section === 'skills' ? 'skill' : 'profile']: source,
        fieldSpecs: SHARED_PROFILE_FIELDS,
        patchableFields: { cooldown: 10 }
      };
      const payload = {
        preview,
        sourceFile: 'active-preview.ts',
        professions: [
          {
            professionId: 'warrior',
            professionName: 'Warrior',
            skillFields: {},
            modules: [
              {
                id: 'Core',
                traits: [],
                modifierRules: [],
                skills: [],
                balanceProfiles: [],
                [section]: [entry]
              }
            ]
          }
        ]
      };
      loadEditorPayload(payload);
      editorState.selectedSection = section === 'skills' ? 'skills' : 'traits';
      editorState.selectedTraitView = 'effects';
      editorState.selectedSkillId = '1';
      editorState.selectedProfileId = '1';
      const root = { innerHTML: '', addEventListener() {} };
      bindPatchAuthoringView(root, { onSave() {}, onReset() {} });
      assert.doesNotMatch(root.innerHTML, /data-select-section="mechanics"/);
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
        assert.deepEqual(displayed('duration'), [5, 5, 3]);
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

        // Reverting the final edit removes the profession now that display prose cannot keep it alive.
        if (!stacked && next === 1) assert.equal(editorState.draft.professions, undefined);

        const result = apply(editorState.draft.professions?.warrior);

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

// Reopening an action edit must preserve its scope even when sibling actions reuse the same effect identity.
for (const impact of [false, true]) {
  test(`${impact ? 'Impact' : 'Cast'} action rewards round-trip without editing native or sibling effects`, () => {
    const effect = { type: 'boon', name: 'Reward', boon: 'might', stacks: 1, duration: 5 };
    const catalog = createCanonicalCatalog({
      generated: [
        {
          id: 1,
          name: 'Fixture',
          effects: [
            effect,
            ...(impact
              ? [
                  {
                    type: 'strike',
                    coefficient: 1,
                    reactions: [
                      {
                        on: 'damage.resolved',
                        actor: 'player',
                        packets: 'each',
                        when: () => true,
                        do: { type: 'fixture.reward', id: 'first', effects: [effect] }
                      }
                    ]
                  }
                ]
              : [])
          ],
          sideEffects: [
            ...(!impact
              ? [{ on: 'castCommit', when: () => true, do: { type: 'fixture.reward', id: 'first', effects: [effect] } }]
              : []),
            { on: 'castCommit', do: { type: 'fixture.reward', id: 'second', effects: [effect] } }
          ]
        }
      ]
    });
    const source = skillAuthoringReference(catalog.skills[0], catalog.skillFields);
    assert.equal(impact ? source.effects[1].reactions[0].when : source.sideEffects[0].when, undefined);
    const payload = {
      preview: {
        id: 'fixture',
        label: 'Fixture',
        professions: {
          warrior: {
            skills: {
              1: {
                assumption: 'Fixture tuning assumption',
                sideEffects: { first: { effects: [{ type: 'boon', name: 'Reward', stacks: 3 }] } }
              }
            }
          }
        }
      },
      sourceFile: 'active-preview.ts',
      professions: [
        {
          professionId: 'warrior',
          professionName: 'Warrior',
          skillFields: {},
          modules: [
            {
              id: 'Core',
              traits: [],
              modifierRules: [],
              balanceProfiles: [],
              skills: [{ id: 1, name: source.name, moduleId: 'Core', skill: source, patchableFields: {} }]
            }
          ]
        }
      ]
    };
    loadEditorPayload(payload);
    editorState.selectedSection = 'skills';
    editorState.selectedSkillId = '1';
    const root = { innerHTML: '', addEventListener() {} };
    bindPatchAuthoringView(root, { onSave() {}, onReset() {} });
    renderPatchAuthoring();
    assert.match(root.innerHTML, /data-action-id="first"/);
    const apply = () => applySkillPatch(catalog, editorState.draft.professions?.warrior).skills[0];
    assert.equal(requireSkillAction(apply(), 'first').effects[0].stacks, 3);
    setNumericEdit({
      entity: 'effect',
      id: '1',
      actionId: 'first',
      effectIndex: 0,
      field: 'duration',
      current: 5,
      next: 7
    });
    toggleEffect('1', 0, 'second');
    acceptSavedDraft(editorState.draft);
    loadEditorPayload({ ...payload, preview: editorState.draft });
    const patched = apply();
    assert.equal(patched.effects[0].stacks, 1);
    assert.equal(patched.effects[0].duration, 5);
    assert.equal(requireSkillAction(patched, 'first').effects[0].stacks, 3);
    assert.equal(requireSkillAction(patched, 'first').effects[0].duration, 7);
    assert.equal(requireSkillAction(patched, 'second').effects.length, 0);
    assert.equal(requireSkillAction(catalog.skills[0], 'second').effects.length, 1);
    toggleEffect('1', 0, 'second');
    assert.equal(requireSkillAction(apply(), 'second').effects.length, 1);
    setNumericEdit({
      entity: 'effect',
      id: '1',
      actionId: 'first',
      effectIndex: 0,
      field: 'duration',
      current: 5,
      next: 5
    });
    setNumericEdit({
      entity: 'effect',
      id: '1',
      actionId: 'first',
      effectIndex: 0,
      field: 'stacks',
      current: 1,
      next: 1
    });
    assert.equal(editorState.draft.professions, undefined);
  });
}
