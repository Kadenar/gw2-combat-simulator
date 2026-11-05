import assert from 'node:assert/strict';
import test from 'node:test';

import { inertContainer } from '#tests/helpers/dom.js';
import { validateDurationMs } from '#ui/rotation/editing/duration-editor.js';
import { positionFloatingEditor } from '#ui/rotation/editing/floating-editor.js';
import {
  mountRotationInsertionCursor,
  normalizeRotationInsertionIndex,
  rotationInsertionGapHtml,
  rotationTimelineEntryHtml,
  updateRotationInsertionCursor
} from '#ui/rotation/insertion-cursor.js';
import { mountRotationWarnings } from '#ui/rotation/warnings.js';

// Nested Escape consumers must leave the outer workspace open when clearing a cursor.
test('insertion Escape is consumed only when a cursor is active', () => {
  const listeners = new Set();
  const root = {
    dataset: {},
    closest: () => null,
    querySelectorAll: () => [],
    ownerDocument: {
      addEventListener: (_name, handler) => listeners.add(handler),
      removeEventListener: (_name, handler) => listeners.delete(handler)
    }
  };
  let clears = 0;
  for (const insertionIndex of [0, null]) {
    mountRotationInsertionCursor({
      root,
      getInsertionIndex: () => insertionIndex,
      getRotationLength: () => 2,
      onSelect() {},
      onClear: () => clears++
    });
    const event = new Event('keydown', { cancelable: true });
    Object.defineProperty(event, 'key', { value: 'Escape' });
    for (const handler of listeners) handler(event);
    assert.equal(event.defaultPrevented, insertionIndex !== null);
  }

  assert.equal(clears, 1);
});

// Minimal timeline double whose gaps track active state, focus, and scrolling through what the handlers read.
function insertionCursorFixture(t, gapCount = 3) {
  const originalElement = Object.getOwnPropertyDescriptor(globalThis, 'Element');
  Object.defineProperty(globalThis, 'Element', { configurable: true, value: class {} });
  t.after(() => {
    if (originalElement) Object.defineProperty(globalThis, 'Element', originalElement);
    else delete globalThis.Element;
  });
  const listeners = new Set();
  const gaps = Array.from({ length: gapCount }, (_, index) => {
    let active = false;
    return {
      dataset: { insertionIndex: String(index) },
      scrolls: 0,
      matches: () => true,
      focus() {
        root.ownerDocument.activeElement = this;
      },
      scrollIntoView() {
        this.scrolls += 1;
      },
      classList: {
        contains: () => active,
        toggle: (_name, value) => {
          active = value;
        }
      },
      setAttribute(name, value) {
        this[name] = value;
      }
    };
  });
  const root = {
    dataset: {},
    closest: () => null,
    querySelectorAll: () => gaps,
    querySelector: () => gaps.find((gap) => gap.classList.contains('active')) ?? null,
    contains: (element) => gaps.includes(element),
    ownerDocument: {
      addEventListener: (_name, handler) => listeners.add(handler),
      removeEventListener: (_name, handler) => listeners.delete(handler)
    }
  };
  const press = (key) => {
    const event = new Event('keydown', { cancelable: true });
    Object.defineProperty(event, 'key', { value: key });
    for (const handler of listeners) handler(event);
    return event;
  };

  return { gaps, root, listeners, press };
}

// Retained handlers must read each new cursor position rather than the value captured when rows were mounted.
test('cursor movement updates markers and keyboard navigation without rebinding rows', (t) => {
  const { gaps, root, listeners, press } = insertionCursorFixture(t);
  let cursor = null;
  const select = (index) => {
    cursor = updateRotationInsertionCursor(root, index, 2);
  };

  mountRotationInsertionCursor({
    root,
    getInsertionIndex: () => cursor,
    getRotationLength: () => 2,
    onSelect: select,
    onClear: () => select(null)
  });
  const handlers = gaps.map((gap) => gap.onclick);
  root.ownerDocument.activeElement = gaps[2];

  press('ArrowLeft');
  assert.equal(cursor, 1);
  assert.equal(root.ownerDocument.activeElement, gaps[1]);
  assert.equal(root.dataset.insertionNavigation, 'keyboard');
  press('ArrowLeft');
  assert.equal(cursor, 0);
  assert.equal(gaps[0]['aria-label'], 'Insertion point at position 1');
  assert.equal(gaps[1]['aria-label'], 'Set insertion point at position 2');
  press('ArrowRight');
  assert.equal(cursor, 1);
  press('Escape');
  assert.equal(cursor, null);
  assert.equal(gaps[2].classList.contains('active'), true);
  assert.equal(root.ownerDocument.activeElement, gaps[2]);
  gaps[0].onclick({ preventDefault() {}, stopPropagation() {} });
  assert.equal(cursor, 0);
  assert.equal(root.dataset.insertionNavigation, undefined);
  assert.deepEqual(
    gaps.map((gap) => gap.onclick),
    handlers
  );
  assert.equal(listeners.size, 2);
});

// Worker publications remount the cursor; a keyboard user tabbing between gaps must keep their position.
test('mounting marks the cursor without taking focus or scrolling', (t) => {
  const { gaps, root } = insertionCursorFixture(t);
  root.ownerDocument.activeElement = gaps[2];

  mountRotationInsertionCursor({
    root,
    getInsertionIndex: () => 0,
    getRotationLength: () => 2,
    onSelect() {},
    onClear() {}
  });

  assert.equal(gaps[0].classList.contains('active'), true);
  assert.equal(root.ownerDocument.activeElement, gaps[2]);
  assert.equal(gaps[0].scrolls, 0);
});

// The app rejects moves for a stale build revision, so nothing may behave as though the cursor moved.
test('rejected keyboard moves leave focus, scrolling, and hover previews untouched', (t) => {
  const { gaps, root, press } = insertionCursorFixture(t);
  mountRotationInsertionCursor({
    root,
    getInsertionIndex: () => 1,
    getRotationLength: () => 2,
    onSelect() {},
    onClear() {}
  });
  root.ownerDocument.activeElement = gaps[2];

  assert.equal(press('ArrowLeft').defaultPrevented, true);
  assert.equal(press('Escape').defaultPrevented, true);
  assert.equal(root.dataset.insertionNavigation, undefined);
  assert.equal(root.ownerDocument.activeElement, gaps[2]);
  assert.deepEqual(
    gaps.map((gap) => gap.scrolls),
    [0, 0, 0]
  );
});

// Arrows keep the moving cursor visible; clearing it from elsewhere must not jump the viewport to the trailing gap.
test('keyboard moves reveal the cursor unless Escape clears it from outside the timeline', (t) => {
  const { gaps, root, press } = insertionCursorFixture(t);
  let cursor = 2;
  const select = (index) => {
    cursor = updateRotationInsertionCursor(root, index, 2);
  };

  mountRotationInsertionCursor({
    root,
    getInsertionIndex: () => cursor,
    getRotationLength: () => 2,
    onSelect: select,
    onClear: () => select(null)
  });

  press('ArrowLeft');
  assert.equal(cursor, 1);
  assert.equal(gaps[1].scrolls, 1);
  assert.equal(root.ownerDocument.activeElement, undefined);

  const outside = { matches: () => false };
  root.ownerDocument.activeElement = outside;
  press('Escape');
  assert.equal(cursor, null);
  assert.equal(gaps[2].scrolls, 0);
  assert.equal(root.ownerDocument.activeElement, outside);

  root.ownerDocument.activeElement = gaps[1];
  select(1);
  press('Escape');
  assert.equal(root.ownerDocument.activeElement, gaps[2]);
  assert.equal(gaps[2].scrolls, 1);
});

// Inserting near the end moves the cursor past the mounted length before the deferred render rebinds these handlers.
test('cursor handlers read the rotation length live during a deferred render', (t) => {
  const { root, press } = insertionCursorFixture(t);
  let cursor = 1;
  let length = 2;
  let clears = 0;
  mountRotationInsertionCursor({
    root,
    getInsertionIndex: () => cursor,
    getRotationLength: () => length,
    onSelect() {},
    onClear: () => clears++
  });
  cursor = 4;
  length = 5;

  assert.equal(press('Escape').defaultPrevented, true);
  assert.equal(clears, 1);
});

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
});

// Configured duration grids reject off-grid input instead of silently rounding user edits.
test('duration editor enforces configured 40 ms increments', () => {
  for (const value of ['', '0', '39', '41', '100', '40.1', 'Infinity']) {
    assert.equal(validateDurationMs(value, 40, 40).valid, false, value);
  }

  for (const value of [40, 80, 120, 1000]) {
    assert.deepEqual(validateDurationMs(value, 40, 40), { valid: true, value });
  }
});

test('rotation insertion cursors validate positions and expose accessible gaps', () => {
  assert.equal(normalizeRotationInsertionIndex(0, 3), 0);
  assert.equal(normalizeRotationInsertionIndex(3, 3), 3);
  assert.equal(normalizeRotationInsertionIndex(4, 3), null);
  assert.equal(normalizeRotationInsertionIndex(1.5, 3), null);
  assert.equal(normalizeRotationInsertionIndex(null, 3), null);
  assert.equal(normalizeRotationInsertionIndex(undefined, 3), null);

  // Row HTML stays cursor-neutral so moving the cursor cannot invalidate retained rows.
  assert.match(rotationInsertionGapHtml(2), /class="rot-insertion-gap"/);
  assert.match(rotationInsertionGapHtml(2), /Insert at position 3/);
  const entryHtml = rotationTimelineEntryHtml(
    2,
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
    { time: '<2.50s>', message: 'Missing resource' }
  ]);

  assert.match(container.innerHTML, /<details class="rotation-warnings-wrap">/);
  assert.doesNotMatch(container.innerHTML, /rotation-warnings-wrap" open/);
  assert.match(container.innerHTML, /Warnings \(2\)/);
  assert.match(container.innerHTML, /rotation-warning-time">1\.25s/);
  assert.match(container.innerHTML, /rotation-warning-time">&lt;2\.50s&gt;/);
  assert.match(container.innerHTML, /Unsafe &lt;script&gt;/);
  assert.doesNotMatch(container.innerHTML, /Unsafe <script>/);
  assert.match(container.innerHTML, /Missing resource/);

  mountRotationWarnings(container, [{ message: 'Still unsafe', time: '' }], { open: true });
  assert.match(container.innerHTML, /rotation-warnings-wrap" open/);
  assert.doesNotMatch(container.innerHTML, /rotation-warning-time/);

  mountRotationWarnings(container, []);
  assert.equal(container.innerHTML, '');

  container.innerHTML = 'stale warnings';
  mountRotationWarnings(container);
  assert.equal(container.innerHTML, '');
});

// Located diagnostics expose escaped native-button actions; general notices do not pretend to have a destination.
test('rotation warnings bind only their own navigation action', () => {
  const container = inertContainer();
  let activate;
  let calls = 0;
  container.querySelectorAll = () => [
    {
      dataset: { warningIndex: '1' },
      addEventListener(event, handler) {
        assert.equal(event, 'click');
        activate = handler;
      }
    }
  ];
  mountRotationWarnings(container, [
    { time: '', message: 'General notice' },
    {
      time: '1.000s',
      message: 'Rejected <skill>',
      action: { label: 'Show <source>', activate: () => calls++ }
    }
  ]);
  assert.equal((container.innerHTML.match(/<button/g) || []).length, 1);
  assert.match(container.innerHTML, /type="button" class="rotation-warning-link" data-warning-index="1"/);
  assert.match(container.innerHTML, /Show &lt;source&gt;/);
  assert.match(container.innerHTML, /Rejected &lt;skill&gt;/);
  activate();
  assert.equal(calls, 1);
});
