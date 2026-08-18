import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ROTATION_HOTKEY_ENABLED_STORAGE_KEY,
  ROTATION_HOTKEY_STORAGE_KEY,
  activeRotationHotkeyAction,
  defaultRotationHotkeyBindings,
  duplicateRotationHotkeyCodes,
  formatRotationHotkey,
  loadRotationHotkeyBindings,
  loadRotationHotkeysEnabled,
  normalizeRotationHotkeyBindings,
  rotationHotkeyActionForCode,
  rotationHotkeyActionForSkillSlot,
  rotationLoadoutHotkeyActions,
  rotationUtilityHotkeyAction,
  saveRotationHotkeyBindings,
  saveRotationHotkeysEnabled
} from '../../js/app/rotation/hotkeys.js';
import { paletteSkillHtml } from '../../js/platform/ui/palette.js';

test('rotation hotkeys default to the Guild Wars 2 skill-bar keys', () => {
  assert.deepEqual(defaultRotationHotkeyBindings(), {
    'weapon-1': 'Digit1',
    'weapon-2': 'Digit2',
    'weapon-3': 'Digit3',
    'weapon-4': 'Digit4',
    'weapon-5': 'Digit5',
    'slot-6': 'Digit6',
    'slot-7': 'Digit7',
    'slot-8': 'Digit8',
    'slot-9': 'Digit9',
    'slot-10': 'Digit0',
    'profession-1': 'F1',
    'profession-2': 'F2',
    'profession-3': 'F3',
    'profession-4': 'F4',
    'profession-5': 'F5'
  });
});

test('rotation hotkey overrides are normalized and persisted globally', () => {
  const values = new Map();
  const storage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
  const bindings = normalizeRotationHotkeyBindings({
    'weapon-1': 'KeyQ',
    'slot-7': '',
    'profession-1': 'not a keyboard code',
    unknown: 'KeyZ'
  });

  assert.equal(bindings['weapon-1'], 'KeyQ');
  assert.equal(bindings['slot-7'], '');
  assert.equal(bindings['profession-1'], 'F1');
  saveRotationHotkeyBindings(bindings, storage);

  assert.ok(values.has(ROTATION_HOTKEY_STORAGE_KEY));
  assert.deepEqual(loadRotationHotkeyBindings(storage), bindings);
});

test('rotation hotkeys require a persisted global opt-in', () => {
  const values = new Map();
  const storage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };

  assert.equal(loadRotationHotkeysEnabled(storage), false);
  saveRotationHotkeysEnabled(true, storage);
  assert.equal(values.get(ROTATION_HOTKEY_ENABLED_STORAGE_KEY), 'true');
  assert.equal(loadRotationHotkeysEnabled(storage), true);
  saveRotationHotkeysEnabled(false, storage);
  assert.equal(loadRotationHotkeysEnabled(storage), false);
});

test('skill slots resolve to weapon, utility, and profession actions', () => {
  assert.equal(rotationHotkeyActionForSkillSlot('Weapon_3'), 'weapon-3');
  assert.equal(rotationHotkeyActionForSkillSlot('Profession_5'), 'profession-5');
  assert.equal(rotationHotkeyActionForSkillSlot('Utility'), '');
  assert.equal(rotationHotkeyActionForSkillSlot('Weapon_6'), '');
  assert.equal(rotationUtilityHotkeyAction(0), 'slot-6');
  assert.equal(rotationUtilityHotkeyAction(4), 'slot-10');
  assert.equal(rotationUtilityHotkeyAction(5), '');
});

test('fixed loadout flips retain their parent utility hotkey', () => {
  const children = new Map([
    [12, [120]],
    [120, [1200]]
  ]);
  const hotkeys = rotationLoadoutHotkeyActions(
    [{ skillIds: [11, 12, 13, 14, 15] }],
    (skillId) => children.get(skillId) || []
  );

  assert.equal(hotkeys.get(11), 'slot-6');
  assert.equal(hotkeys.get(12), 'slot-7');
  assert.equal(hotkeys.get(120), 'slot-7');
  assert.equal(hotkeys.get(1200), 'slot-7');
  assert.equal(hotkeys.get(13), 'slot-8');
  assert.equal(hotkeys.get(15), 'slot-10');
});

test('hotkey lookup, duplicate detection, and labels use keyboard codes', () => {
  const bindings = defaultRotationHotkeyBindings();
  bindings['weapon-1'] = 'KeyQ';
  bindings['weapon-2'] = 'KeyQ';

  assert.equal(rotationHotkeyActionForCode(bindings, 'KeyQ'), 'weapon-1');
  assert.deepEqual(duplicateRotationHotkeyCodes(bindings), ['KeyQ']);
  assert.equal(formatRotationHotkey('Digit6'), '6');
  assert.equal(formatRotationHotkey('KeyQ'), 'Q');
  assert.equal(formatRotationHotkey('Numpad4'), 'Numpad 4');
  assert.equal(formatRotationHotkey(''), 'Unbound');
});

test('rotation keys are captured only while the rotation builder is active', () => {
  const bindings = defaultRotationHotkeyBindings();
  const f5 = {
    code: 'F5',
    isComposing: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false
  };

  assert.equal(activeRotationHotkeyAction(bindings, f5, false), null);
  assert.equal(activeRotationHotkeyAction(bindings, f5, true), 'profession-5');
  assert.equal(activeRotationHotkeyAction(bindings, { ...f5, ctrlKey: true }, true), null);
});

test('palette skills expose their logical hotkey action', () => {
  const html = paletteSkillHtml({
    name: 'Test skill',
    hotkeyAction: 'weapon-2'
  });

  assert.match(html, /data-hotkey-action="weapon-2"/);
});
