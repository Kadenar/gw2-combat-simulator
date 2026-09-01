import assert from 'node:assert/strict';
import test from 'node:test';

import { embedRoute } from '#app/embed.js';
import { gw2BaseRecharge } from '#gw2/platform/skills/recharge.js';
import { isInternalCooldownReady } from '#kernel/core/clock.js';
import { escapeHtml } from '#ui/shared/html.js';

// Exercises the native package alias against compiled output so runtime resolution cannot silently regress.
test('the GW2 package import alias resolves compiled modules', () => {
  assert.equal(gw2BaseRecharge({ cooldown: 8 }), 8);
});

// Exercises the shared kernel alias through the same compiled-module path used by Node.
test('the kernel package import alias resolves compiled modules', () => {
  assert.equal(isInternalCooldownReady(1.001, 1), true);
});

// Exercises the browser-facing shared aliases without requiring a DOM.
test('the app and UI package import aliases resolve compiled modules', () => {
  assert.equal(embedRoute('index.html'), 'index.html?embed=1');
  assert.equal(escapeHtml('<'), '&lt;');
});
