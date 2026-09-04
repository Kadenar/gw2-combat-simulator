import assert from 'node:assert/strict';
import test from 'node:test';
import { chargeReleaseRowLabel } from '#ui/rotation/editors/charge-release-editor.js';
import { validateDurationMs } from '#ui/rotation/editors/duration-editor.js';
import { positionFloatingEditor } from '#ui/rotation/editors/floating-editor.js';
import {
  normalizeRotationInsertionIndex,
  rotationInsertionGapHtml,
  rotationTimelineEntryHtml
} from '#ui/rotation/insertion-cursor.js';
import { mountRotationWarnings } from '#ui/results/rotation-warnings.js';
import { inertContainer } from '../helpers/dom.js';

// Game-neutral rotation controls validate input and render accessible, escaped markup.
test('floating editors flip and clamp beside connected anchors', () => {
  const originalWindow = globalThis.window;
  const classes = new Set();
  const properties = {};
  const style = {
    left: '',
    top: '',
    setProperty(name, value) {
      properties[name] = value;
    }
  };
  const editor = {
    classList: {
      toggle(name, active) {
        if (active) classes.add(name);
        else classes.delete(name);
      }
    },
    getBoundingClientRect: () => ({ width: 200, height: 160 }),
    style
  };

  try {
    globalThis.window = { innerWidth: 500, innerHeight: 400 };
    const rightAnchor = {
      isConnected: true,
      getBoundingClientRect: () => ({ left: 100, right: 140, top: 100, height: 40 })
    };
    assert.equal(positionFloatingEditor(editor, rightAnchor), true);
    assert.equal(style.left, '152px');
    assert.equal(style.top, '44px');
    assert.equal(properties['--floating-editor-arrow-y'], '76px');
    assert.equal(classes.has('opens-left'), false);

    const leftAnchor = {
      isConnected: true,
      getBoundingClientRect: () => ({ left: 190, right: 230, top: 0, height: 20 })
    };
    globalThis.window.innerWidth = 220;
    assert.equal(positionFloatingEditor(editor, leftAnchor), true);
    assert.equal(style.left, '8px');
    assert.equal(style.top, '8px');
    assert.equal(properties['--floating-editor-arrow-y'], '18px');
    assert.equal(classes.has('opens-left'), true);
    assert.equal(positionFloatingEditor(editor, { ...rightAnchor, isConnected: false }), false);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test('duration editor validates and rounds millisecond values', () => {
  assert.deepEqual(validateDurationMs('1000'), { valid: true, value: 1000 });
  assert.deepEqual(validateDurationMs('1.4'), { valid: true, value: 1 });
  assert.equal(validateDurationMs('').valid, false);
  assert.equal(validateDurationMs('Infinity').valid, false);
  assert.equal(validateDurationMs('0.9').valid, false);
  assert.equal(validateDurationMs('501', 1, 500).valid, false);
});

test('charge release rows expose time, Flow, and coefficient', () => {
  assert.equal(
    chargeReleaseRowLabel({
      charges: 3,
      at: 12.75,
      delta: 0.75,
      flowAfter: 7.5,
      coefficient: 5.435
    }),
    '3 charges · 12.750s (+0.750s) · 7.50 Flow · 5.43 coefficient'
  );
});

test('rotation insertion cursors validate positions and expose accessible gaps', () => {
  assert.equal(normalizeRotationInsertionIndex(0, 3), 0);
  assert.equal(normalizeRotationInsertionIndex(3, 3), 3);
  assert.equal(normalizeRotationInsertionIndex(4, 3), null);
  assert.equal(normalizeRotationInsertionIndex(1.5, 3), null);
  assert.equal(normalizeRotationInsertionIndex(null, 3), null);
  assert.equal(normalizeRotationInsertionIndex(undefined, 3), null);

  assert.match(rotationInsertionGapHtml(2, 2), /class="rot-insertion-gap active"/);
  assert.match(rotationInsertionGapHtml(2, null), /Insert at position 3/);
  const entryHtml = rotationTimelineEntryHtml(
    2,
    null,
    '<div class="rot-dead-time">Dead</div><div class="rot-skill">Skill</div>'
  );
  assert.match(
    entryHtml,
    /class="rot-entry"[\s\S]*data-insertion-index="2"[\s\S]*class="rot-dead-time"[\s\S]*class="rot-skill"/
  );
});

test('rotation warnings render a collapsed count and escaped details', () => {
  const container = inertContainer();

  mountRotationWarnings(container, [
    { time: '1.25s', message: 'Unsafe <script>' },
    { time: '2.50s', message: 'Missing resource' }
  ]);

  assert.match(container.innerHTML, /<details class="rotation-warnings-wrap">/);
  assert.doesNotMatch(container.innerHTML, /rotation-warnings-wrap" open/);
  assert.match(container.innerHTML, /Warnings \(2\)/);
  assert.match(container.innerHTML, /rotation-warning-time">1\.25s/);
  assert.match(container.innerHTML, /rotation-warning-time">2\.50s/);
  assert.match(container.innerHTML, /Unsafe &lt;script&gt;/);
  assert.doesNotMatch(container.innerHTML, /Unsafe <script>/);
  assert.match(container.innerHTML, /Missing resource/);

  mountRotationWarnings(container, ['Still unsafe'], { open: true });
  assert.match(container.innerHTML, /rotation-warnings-wrap" open/);

  mountRotationWarnings(container, []);
  assert.equal(container.innerHTML, '');
});
