import assert from 'node:assert/strict';
import test from 'node:test';

import { mountInputActivity } from '#gw2/app/input-profile/results.js';
import {
  activeInputProfile,
  INPUT_PROFILE_STORAGE_KEY,
  readInputProfile,
  saveInputProfile,
  subscribeInputProfile
} from '#gw2/app/input-profile/store.js';
import { INPUT_CONTROLS, inputBindingForKey, normalizeInputBindings, parseInputBinding } from '#gw2/input/bindings.js';
import { createInputProfile, InputProfileError, validateInputProfile } from '#gw2/input/profile.js';
import { parseGw2HotkeyBindingsXml } from '#gw2/integrations/keybinds/parser.js';
import { INPUT_CONTROL_IDS } from '#gw2/platform/skills/input-controls.js';

// One local binding snapshot stays independent of the editor and of caller mutations.
test('the current setup persists as a detached snapshot and rejects malformed data', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const profile = createInputProfile();
  profile.bindings['weapon-2'] = 'Mouse4';
  saveInputProfile(profile, storage);
  profile.bindings['weapon-2'] = 'KeyQ';
  const restored = readInputProfile(storage);
  assert.equal(restored.bindings['weapon-2'], 'Mouse4');
  assert.equal(values.size, 1);
  assert.ok(values.has(INPUT_PROFILE_STORAGE_KEY));
  restored.version = 2;
  storage.setItem(INPUT_PROFILE_STORAGE_KEY, JSON.stringify(restored));
  assert.throws(() => readInputProfile(storage), /Invalid/);
});

// Storage availability is independent of profile validity; session bindings remain usable when persistence is blocked.
test('unreadable or incomplete storage starts with defaults but malformed saved data stays visible', () => {
  for (const storage of [
    null,
    {},
    {
      getItem() {
        throw new Error('SecurityError');
      }
    }
  ])
    assert.deepEqual(readInputProfile(storage), createInputProfile());
  for (const raw of ['{', JSON.stringify({ version: 2, bindings: {} })])
    assert.throws(() => readInputProfile({ getItem: () => raw }), InputProfileError);
});

test('host storage without methods and blocked browser storage getters use defaults', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {} });
    assert.deepEqual(readInputProfile(), createInputProfile());
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      }
    });
    assert.deepEqual(readInputProfile(), createInputProfile());
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('a trace analysis error is not reported as a profile validation failure', () => {
  saveInputProfile(createInputProfile(), null);
  let markup = '';
  mountInputActivity(
    {
      insertAdjacentHTML(_position, value) {
        markup += value;
      },
      querySelector() {
        return null;
      }
    },
    {
      version: 1,
      start: 0,
      end: 1,
      actions: null
    }
  );
  assert.match(markup, /analysis unavailable/);
  assert.doesNotMatch(markup, /profile unavailable|Reset keybind profile/);
});

test('failed persistence saves a detached session profile and notifies mounted consumers', () => {
  for (const storage of [
    null,
    {},
    {
      setItem() {
        throw new Error('Storage quota exceeded');
      }
    }
  ]) {
    const draft = createInputProfile();
    draft.bindings['weapon-2'] = 'Shift+KeyQ';
    let notifications = 0;
    const unsubscribe = subscribeInputProfile(() => {
      notifications++;
    });
    try {
      saveInputProfile(draft, storage);
      draft.bindings['weapon-2'] = 'KeyE';
      assert.equal(activeInputProfile().bindings['weapon-2'], 'Shift+KeyQ');
      assert.equal(notifications, 1);
      const invalid = { version: 2, bindings: {} };
      assert.throws(() => saveInputProfile(invalid, storage), InputProfileError);
      assert.equal(activeInputProfile().bindings['weapon-2'], 'Shift+KeyQ');
      assert.equal(notifications, 1);
    } finally {
      unsubscribe();
    }
  }
});

test('XML import retains binding choices and unsupported controls without filling defaults', () => {
  const result = parseGw2HotkeyBindingsXml(
    '<InputBindings><action id="19" device="Keyboard" button="65" device2="Mouse" button2="3"/><action id="20" device="Keyboard" button="999"/></InputBindings>'
  );
  assert.deepEqual(result.bindingOptions['weapon-2'], ['KeyA', 'Mouse4']);
  assert.deepEqual(result.bindingOptions['weapon-3'], []);
  assert.equal(result.bindings['weapon-3'], undefined);
  assert.deepEqual(result.skippedActions, ['weapon-3']);
});

// Sparse persistence is the schema: newly introduced controls stay unbound rather than invalidating the setup.
test('sparse profiles retain chosen bindings, leave missing controls unbound, and name invalid controls', () => {
  const profile = validateInputProfile({ version: 1, bindings: { dodge: 'ShiftLeft' } });
  assert.equal(profile.bindings.dodge, 'ShiftLeft');
  assert.equal(profile.bindings['weapon-2'], '');
  let saved;
  saveInputProfile(profile, {
    setItem(_key, value) {
      saved = JSON.parse(value);
    }
  });
  assert.deepEqual(saved, { version: 1, bindings: { dodge: 'ShiftLeft' } });
  assert.throws(
    () => validateInputProfile({ version: 1, bindings: { dodge: 'UnknownCode' } }),
    /Dodge \(dodge\).*UnknownCode/
  );
  assert.throws(
    () => validateInputProfile({ version: 1, bindings: { imaginary: 'KeyQ' } }),
    /unknown control "imaginary"/
  );
  assert.equal(validateInputProfile({ version: 1, bindings: {} }).bindings.dodge, '');
});

test('editor and profile share the physical code and modifier grammar', () => {
  assert.deepEqual(
    INPUT_CONTROLS.map(({ id }) => id),
    [...INPUT_CONTROL_IDS]
  );
  for (const binding of ['ShiftLeft', 'ControlRight', 'AltLeft', 'Mouse3', 'Tab', 'Ctrl+Alt+Shift+KeyQ']) {
    assert.ok(parseInputBinding(binding));
    const copied = normalizeInputBindings({ dodge: binding });
    assert.equal(validateInputProfile(createInputProfile(copied)).bindings.dodge, binding);
  }

  for (const binding of ['Ctrl+Ctrl+KeyQ', 'Shift+Ctrl+KeyQ', 'Bogus', 'Ctrl+']) {
    assert.equal(parseInputBinding(binding), null);
    assert.equal(normalizeInputBindings({ dodge: binding }).dodge, 'KeyV');
  }

  assert.equal(inputBindingForKey('ShiftLeft', { shiftKey: true }), 'ShiftLeft');
  assert.equal(inputBindingForKey('KeyQ', { shiftKey: true, ctrlKey: true }), 'Ctrl+Shift+KeyQ');
});

// This minimal XML fixture covers both GW2 action identity and name-only imports.
const DODGE_BINDING_XML = '<InputBindings><action id="16" name="Dodge" device="Keyboard" button="2"/></InputBindings>';
test('dodge XML imports support the action ID, name fallback, middle mouse and Tab', () => {
  assert.equal(parseGw2HotkeyBindingsXml(DODGE_BINDING_XML.replace(' name="Dodge"', '')).bindings.dodge, 'ShiftLeft');
  assert.equal(
    parseGw2HotkeyBindingsXml(DODGE_BINDING_XML.replace('id="16"', 'id="9999"')).bindings.dodge,
    'ShiftLeft'
  );
  assert.equal(
    parseGw2HotkeyBindingsXml(DODGE_BINDING_XML.replace('device="Keyboard"', 'device="Mouse"')).bindings.dodge,
    'Mouse3'
  );
  assert.equal(parseGw2HotkeyBindingsXml(DODGE_BINDING_XML.replace('button="2"', 'button="22"')).bindings.dodge, 'Tab');
});
