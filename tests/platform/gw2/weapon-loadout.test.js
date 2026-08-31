import assert from 'node:assert/strict';
import test from 'node:test';

import { gw2ConfiguredWeaponSet, gw2PrimaryWeapon } from '#gw2/platform/equipment/weapons/loadout.js';

test('configured weapon accessors read the caller-selected set without fallback', () => {
  const config = {
    primaryWeapon: 'Sword',
    secondaryWeapon: 'Focus',
    weaponSet2Primary: 'Longbow'
  };

  assert.deepEqual(gw2ConfiguredWeaponSet(config, 1), ['Sword', 'Focus']);
  assert.deepEqual(gw2ConfiguredWeaponSet(config, 2), ['Longbow', undefined]);
  assert.equal(gw2PrimaryWeapon(config, 1), 'Sword');
  assert.equal(gw2PrimaryWeapon(config, 2), 'Longbow');
});

test('configured weapon accessors normalize non-second sets and tolerate absent config', () => {
  assert.deepEqual(gw2ConfiguredWeaponSet({ primaryWeapon: 'Dagger' }, 0), ['Dagger', undefined]);
  assert.deepEqual(gw2ConfiguredWeaponSet(undefined, 2), [undefined, undefined]);
  assert.equal(gw2PrimaryWeapon(undefined, 1), undefined);
});
