import assert from 'node:assert/strict';
import test from 'node:test';

import { navigationRoute } from '#browser/page/embed.js';
import { gw2BaseRecharge } from '#gw2/platform/engine/skills/recharge.js';
import { canonicalTime } from '#kernel/core/clock.js';
import { escapeHtml } from '#ui/shared/html.js';

// Exercises the native package alias against compiled output so runtime resolution cannot silently regress.
test('the GW2 package import alias resolves compiled modules', () => {
  assert.equal(gw2BaseRecharge({ cooldown: 8 }), 8);
});

// Exercises the shared kernel alias through the same compiled-module path used by Node.
test('the kernel package import alias resolves compiled modules', () => {
  assert.equal(canonicalTime(0.1 + 0.2), 0.3);
});

// Exercises the browser-facing shared aliases without requiring a DOM.
test('the browser and UI package import aliases resolve compiled modules', () => {
  assert.equal(navigationRoute('index.html', '?embed=1'), 'index.html?embed=1');
  assert.equal(escapeHtml('<'), '&lt;');
});
