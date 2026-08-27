import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ROTATION_HOTKEY_ENABLED_STORAGE_KEY,
  ROTATION_HOTKEY_STORAGE_KEY,
  activeRotationMouseHotkeyAction,
  activeRotationHotkeyAction,
  defaultRotationHotkeyBindings,
  duplicateRotationHotkeyCodes,
  formatRotationHotkey,
  formatRotationHotkeyBadge,
  loadRotationHotkeyBindings,
  loadRotationHotkeysEnabled,
  normalizeRotationHotkeyBindings,
  rotationHotkeyActionForCode,
  rotationHotkeyActionForSkillName,
  rotationHotkeyActionForSkillSlot,
  rotationLoadoutHotkeyActions,
  rotationUtilityHotkeyAction,
  saveRotationHotkeyBindings,
  saveRotationHotkeysEnabled
} from '../../js/games/gw2/app/rotation/input/hotkeys.js';
import {
  gw2KeyboardCode,
  gw2MouseCode,
  parseGw2HotkeyBindingsXml
} from '../../js/games/gw2/integrations/keybinds/parser.js';
import { paletteSkillHtml } from '../../js/games/gw2/app/presentation/rotation/palette.js';

test('rotation hotkeys default to the Guild Wars 2 skill-bar keys', () => {
  assert.deepEqual(defaultRotationHotkeyBindings(), {
    'weapon-swap': 'Backquote',
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
    'profession-5': 'F5',
    'profession-6': 'F6',
    'profession-7': 'F7'
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

test('rotation hotkeys default on and persist an explicit opt-out', () => {
  const values = new Map();
  const storage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };

  // On by default when no preference has been stored.
  assert.equal(loadRotationHotkeysEnabled(storage), true);
  saveRotationHotkeysEnabled(false, storage);
  assert.equal(values.get(ROTATION_HOTKEY_ENABLED_STORAGE_KEY), 'false');
  assert.equal(loadRotationHotkeysEnabled(storage), false);
  saveRotationHotkeysEnabled(true, storage);
  assert.equal(loadRotationHotkeysEnabled(storage), true);
});

test('skill slots resolve to weapon, utility, and profession actions', () => {
  assert.equal(rotationHotkeyActionForSkillName('Swap Weapons'), 'weapon-swap');
  assert.equal(rotationHotkeyActionForSkillName('Weapon Skill 1'), '');
  assert.equal(rotationHotkeyActionForSkillSlot('Weapon_3'), 'weapon-3');
  assert.equal(rotationHotkeyActionForSkillSlot('Profession_5'), 'profession-5');
  assert.equal(rotationHotkeyActionForSkillSlot('Profession_7'), 'profession-7');
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
  assert.equal(formatRotationHotkey('Mouse5'), 'Mouse 5');
  assert.equal(formatRotationHotkey('Ctrl+Alt+NumpadMultiply'), 'Ctrl+Alt+NumpadMultiply');
  assert.equal(formatRotationHotkey(''), 'Unbound');
});

test('palette hotkey labels stay compact for large key names and modifiers', () => {
  assert.equal(formatRotationHotkeyBadge('Mouse5'), 'M5');
  assert.equal(formatRotationHotkeyBadge('Numpad4'), 'N4');
  assert.equal(formatRotationHotkeyBadge('Ctrl+Alt+Shift+NumpadMultiply'), 'CAS+N*');
  assert.equal(formatRotationHotkeyBadge(''), '');
});

test('rotation keys are captured only while the rotation builder is active', () => {
  const bindings = defaultRotationHotkeyBindings();
  const f5 = {
    code: 'F5',
    isComposing: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false
  };

  assert.equal(activeRotationHotkeyAction(bindings, f5, false), null);
  assert.equal(activeRotationHotkeyAction(bindings, f5, true), 'profession-5');
  assert.equal(activeRotationHotkeyAction(bindings, { ...f5, ctrlKey: true }, true), null);
});

test('rotation hotkeys match imported modifier combinations exactly', () => {
  const bindings = defaultRotationHotkeyBindings();
  bindings['weapon-1'] = 'Alt+Shift+NumpadMultiply';
  const event = {
    code: 'NumpadMultiply',
    isComposing: false,
    ctrlKey: false,
    altKey: true,
    shiftKey: true,
    metaKey: false
  };

  assert.equal(activeRotationHotkeyAction(bindings, event, true), 'weapon-1');
  assert.equal(activeRotationHotkeyAction(bindings, { ...event, shiftKey: false }, true), null);
});

test('rotation hotkeys recognize standard side mouse buttons while active', () => {
  const bindings = defaultRotationHotkeyBindings();
  bindings['slot-6'] = 'Mouse5';
  bindings['slot-7'] = 'Ctrl+Mouse4';
  const mouse5 = { button: 4, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false };
  const ctrlMouse4 = { ...mouse5, button: 3, ctrlKey: true };

  assert.equal(activeRotationMouseHotkeyAction(bindings, mouse5, true), 'slot-6');
  assert.equal(activeRotationMouseHotkeyAction(bindings, mouse5, false), null);
  assert.equal(activeRotationMouseHotkeyAction(bindings, ctrlMouse4, true), 'slot-7');
  assert.equal(activeRotationMouseHotkeyAction(bindings, { ...mouse5, button: 2 }, true), null);
});

test('GW2 keybind XML maps combat actions, modifiers, and keyboard fallbacks', () => {
  const result = parseGw2HotkeyBindingsXml(`<InputBindings>
    <action name="Swap Weapons" id="17" device="Keyboard" button="17"/>
    <action name="Weapon Skill 1" device="Keyboard" button="94" mod="5"/>
    <action name="Healing Skill" id="23" device="Mouse" button="4"
      device2="Keyboard" button2="54"/>
    <action name="Utility Skill 1" id="24" device="Keyboard" button="69"/>
    <action name="Utility Skill 2" id="25" device="Mouse" button="3"/>
    <action name="Utility Skill 3" id="26" device="Mouse" button="9"
      device2="Keyboard" button2="70"/>
    <action name="Profession Skill 6" id="201" device="Keyboard" button="49" mod="2"/>
    <action name="Profession Skill 7" id="202" device="None"/>
  </InputBindings>`);

  assert.deepEqual(result.bindings, {
    'weapon-swap': 'Backquote',
    'weapon-1': 'Alt+Shift+NumpadMultiply',
    'slot-6': 'Mouse5',
    'slot-7': 'KeyE',
    'slot-8': 'Mouse4',
    'slot-9': 'KeyF',
    'profession-6': 'Ctrl+Digit1',
    'profession-7': ''
  });
  assert.deepEqual(result.skippedActions, []);
});

test('GW2 key codes use browser physical-key names and invalid XML is rejected', () => {
  assert.equal(gw2KeyboardCode('32'), 'F1');
  assert.equal(gw2KeyboardCode('81'), 'KeyQ');
  assert.equal(gw2KeyboardCode('94'), 'NumpadMultiply');
  assert.equal(gw2KeyboardCode('96'), 'Numpad1');
  assert.equal(gw2KeyboardCode('999'), null);
  assert.equal(gw2MouseCode('3'), 'Mouse4');
  assert.equal(gw2MouseCode('4'), 'Mouse5');
  assert.equal(gw2MouseCode('5'), null);
  assert.throws(() => parseGw2HotkeyBindingsXml('<settings />'), /not a Guild Wars 2 InputBindings/);
});

test('palette skills expose their logical hotkey action', () => {
  const html = paletteSkillHtml({
    name: 'Test skill',
    hotkeyAction: 'weapon-2'
  });

  assert.match(html, /data-hotkey-action="weapon-2"/);
});
