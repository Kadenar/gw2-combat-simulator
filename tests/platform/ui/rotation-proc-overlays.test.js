import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeRotationProcOverlayVisibility,
  readStoredRotationProcOverlayVisibility,
  ROTATION_PROC_OVERLAY_STORAGE_KEYS,
  storeRotationProcOverlayVisibility
} from '../../../js/platform/ui/rotation-proc-overlays.js';

function storageRoot(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  return {
    defaultView: {
      localStorage: {
        getItem(key) {
          return values.get(key) ?? null;
        },
        setItem(key, value) {
          values.set(key, value);
        }
      }
    }
  };
}

test('rotation proc overlay preferences normalize stored checkbox values', () => {
  assert.equal(normalizeRotationProcOverlayVisibility(true), true);
  assert.equal(normalizeRotationProcOverlayVisibility('true'), true);
  assert.equal(normalizeRotationProcOverlayVisibility(false), false);
  assert.equal(normalizeRotationProcOverlayVisibility('false'), false);
  assert.equal(normalizeRotationProcOverlayVisibility(null), false);
});

test('rotation sigil and relic overlay preferences persist independently', () => {
  const root = storageRoot({
    [ROTATION_PROC_OVERLAY_STORAGE_KEYS.sigil]: 'true'
  });

  assert.equal(readStoredRotationProcOverlayVisibility(root, 'sigil'), true);
  assert.equal(readStoredRotationProcOverlayVisibility(root, 'relic'), false);

  storeRotationProcOverlayVisibility(root, 'relic', true);
  storeRotationProcOverlayVisibility(root, 'sigil', false);

  assert.equal(readStoredRotationProcOverlayVisibility(root, 'sigil'), false);
  assert.equal(readStoredRotationProcOverlayVisibility(root, 'relic'), true);
});
