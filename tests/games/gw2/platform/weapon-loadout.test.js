import { assertFlooredDamageMultiplier } from '#tests/helpers/rounded-damage.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  gw2ActivePrimaryWeapon,
  gw2ConfiguredWeaponSet,
  gw2PrimaryWeapon
} from '#gw2/platform/equipment/weapons/loadout.js';
import { createCanonicalCatalog } from '#gw2/platform/engine/skills/canonical-skill-catalog.js';
import { defineProfession } from '#gw2/platform/engine/profession/contract.js';
import { simulateGw2 } from '#gw2/platform/simulation/simulate.js';
import { defineNativeModule, defineNativeProfession } from '#gw2/platform/profession-definition/profession.js';

// Equipment policy must survive native-family composition and gate headless casts without presentation hooks.
test('profession weapon eligibility is shared with headless simulation', () => {
  const weaponSkillMatchesSet = (_skill, _weapons, context) => context.config.specialization === 'Elite';
  const family = defineNativeProfession({
    id: 'weapon-contract',
    name: 'Weapon Contract',
    weaponSkillMatchesSet,
    modules: [
      defineNativeModule({
        id: 'Core',
        data: {
          generatedSkills: [
            {
              id: 1,
              name: 'Sword Strike',
              type: 'Weapon',
              weapon: 'Sword',
              castTimeMs: 0,
              effects: [{ type: 'strike', coefficient: 1 }]
            }
          ],
          weapons: ['Sword'],
          weaponHands: { Sword: 'mh' }
        },
        state: { scheduler: () => ({}) }
      }),
      defineNativeModule({ id: 'Elite', data: {}, state: { scheduler: () => ({}) } })
    ]
  });
  assert.equal(family.weaponSkillMatchesSet, weaponSkillMatchesSet);
  for (const specialization of ['Core', 'Elite']) {
    const runtime = family.resolveRuntime({ specialization });
    assert.equal(runtime.weaponSkillMatchesSet, weaponSkillMatchesSet);
    assert.equal(runtime.ui, undefined);
    const result = simulateGw2({
      profession: family,
      rotation: ['Sword Strike'],
      config: { primaryWeapon: 'Sword', specialization }
    });
    if (specialization === 'Core') {
      assert.equal(result.totalDamage, 0);
      assert.match(result.warnings.join(' '), /unavailable/);
    } else {
      assert.ok(result.totalDamage > 0);
      assert.deepEqual(result.warnings, []);
    }
  }

  assert.throws(
    () => defineProfession({ id: 'invalid', name: 'Invalid', weaponSkillMatchesSet: true }),
    /weaponSkillMatchesSet must be a function/
  );
});

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

test('active primary weapon prefers the selected set and falls back to set 1', () => {
  const config = { primaryWeapon: 'Sword', weaponSet2Primary: 'Longbow' };

  assert.equal(gw2ActivePrimaryWeapon(config, 2), 'Longbow');
  assert.equal(gw2ActivePrimaryWeapon({ primaryWeapon: 'Sword' }, 2), 'Sword');
  assert.equal(gw2ActivePrimaryWeapon(undefined, 2), undefined);
});

test('GW2 declarative policy enforces active weapons and skill weapon strength', () => {
  const catalog = createCanonicalCatalog({
    generated: [
      {
        id: 930011,
        name: 'Fixture Greatsword',
        type: 'Weapon',
        weapon: 'Greatsword',
        castTimeMs: 0,
        effects: [{ type: 'strike', coefficient: 1 }]
      },
      {
        id: 930012,
        name: 'Fixture Sword',
        type: 'Weapon',
        weapon: 'Sword',
        castTimeMs: 0,
        effects: [{ type: 'strike', coefficient: 1 }]
      }
    ],
    weapons: ['Greatsword', 'Sword'],
    weaponHands: { Greatsword: '2h', Sword: 'mh' }
  });
  const profession = defineProfession({
    id: 'weapon-policy-fixture',
    name: 'Weapon Policy Fixture',
    catalog
  });
  const greatsword = simulateGw2({
    profession,
    rotation: ['Fixture Greatsword']
  });
  const sword = simulateGw2({
    profession,
    rotation: ['Fixture Sword']
  });
  const unavailable = simulateGw2({
    profession,
    rotation: ['Fixture Greatsword'],
    config: { primaryWeapon: 'Sword' }
  });

  assertFlooredDamageMultiplier(greatsword.strikeDamage, sword.strikeDamage, 1.1);
  assert.equal(unavailable.totalDamage, 0);
  assert.match(unavailable.warnings.join(' '), /unavailable/);
});
