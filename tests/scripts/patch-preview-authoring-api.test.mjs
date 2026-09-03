import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  createPatchPreviewAuthoringApi,
  serializeActivePatchPreview,
  validateAuthoringPreview
} from '../../scripts/patch-preview/patch-preview-authoring-api.mjs';
import { validatePatchPreview } from '#gw2/integrations/patches/authoring/patches.js';

test('patch authoring serializer emits the typed active preview module', () => {
  const source = serializeActivePatchPreview({
    id: 'august-preview',
    label: 'August Preview',
    professions: { warrior: { skills: { 1: { cooldown: 8 } } } }
  });

  assert.match(source, /import type \{ PatchPreview \} from "\.\/authoring\/patches\.js"/);
  assert.match(source, /export const activePatchPreview: PatchPreview = \{/);
  assert.match(source, /"august-preview"/);
  assert.match(source, /export default activePatchPreview;/);
});

test('patch authoring API loads the compiled GW2 runtime', async () => {
  const response = {
    end(body) {
      this.body = body;
    },
    writeHead(status) {
      this.status = status;
    }
  };
  const handle = createPatchPreviewAuthoringApi({
    root: process.cwd(),
    buildRoot: path.join(process.cwd(), 'dist')
  });

  assert.equal(await handle({ method: 'GET' }, response, '/api/patch-preview'), true);
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body).sourceFile, 'js/games/gw2/integrations/patches/active-preview.ts');
});

test('patch authoring save queue recovers after a failed write', async () => {
  const preview = { id: 'queue-test', label: 'Queue Test' };
  const request = () => ({
    method: 'PUT',
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(JSON.stringify(preview));
    }
  });
  const response = () => ({
    end(body) {
      this.body = body;
    },
    writeHead(status) {
      this.status = status;
    }
  });
  let writeAttempts = 0;
  const handle = createPatchPreviewAuthoringApi({
    root: process.cwd(),
    buildRoot: path.join(process.cwd(), 'dist'),
    writeFile: async () => {
      writeAttempts += 1;
      if (writeAttempts === 1) throw new Error('Temporary write failure.');
    }
  });
  const failed = response();
  const succeeded = response();

  await handle(request(), failed, '/api/patch-preview');
  await handle(request(), succeeded, '/api/patch-preview');

  assert.equal(failed.status, 500);
  assert.equal(JSON.parse(failed.body).error, 'Temporary write failure.');
  assert.equal(succeeded.status, 200);
  assert.equal(writeAttempts, 2);
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
