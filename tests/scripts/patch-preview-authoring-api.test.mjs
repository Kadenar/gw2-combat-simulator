import assert from 'node:assert/strict';
import test from 'node:test';

import {
  serializeActivePatchPreview,
  validateAuthoringPreview
} from '../../scripts/patch-preview/patch-preview-authoring-api.mjs';
import { validatePatchPreview } from '../../js/platform/gw2/skill-patch.js';

test('patch authoring serializer emits the typed active preview module', () => {
  const source = serializeActivePatchPreview({
    id: 'august-preview',
    label: 'August Preview',
    professions: { warrior: { skills: { 1: { cooldown: 8 } } } }
  });

  assert.match(source, /import type \{ PatchPreview \}/);
  assert.match(source, /export const activePatchPreview: PatchPreview = \{/);
  assert.match(source, /"august-preview"/);
  assert.match(source, /export default activePatchPreview;/);
});

test('patch authoring validation dispatches each profession patch', () => {
  const validatedPatches = [];
  const runtime = {
    validatePatchPreview,
    professions: [
      {
        patchAuthoring: {
          professionId: 'warrior',
          professionName: 'Warrior',
          modules: [
            {
              id: 'Core',
              traits: [],
              skills: [{ id: 1, name: 'Test Skill' }],
              modifierRules: []
            }
          ]
        },
        validatePatch: (patch) => {
          validatedPatches.push(patch);

          return true;
        }
      }
    ]
  };
  const preview = validateAuthoringPreview(
    {
      id: 'august-preview',
      label: 'August Preview',
      professions: { warrior: { skills: { 1: { cooldown: 8 } } } }
    },
    runtime
  );

  assert.equal(preview.id, 'august-preview');
  assert.equal(validatedPatches.length, 1);
  assert.deepEqual(validatedPatches[0], {
    skills: { 1: { cooldown: 8 } },
    overview: [
      {
        subject: 'Test Skill',
        text: 'Cooldown set to 8.',
        source: 'skill-diff'
      }
    ]
  });
  assert.throws(
    () =>
      validateAuthoringPreview(
        {
          id: 'august-preview',
          label: 'August Preview',
          professions: { missing: {} }
        },
        runtime
      ),
    /unknown profession missing/
  );
});
