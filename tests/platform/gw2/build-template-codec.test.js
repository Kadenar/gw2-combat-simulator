import assert from 'node:assert/strict';
import test from 'node:test';

import { decodeGw2BuildTemplate, resolveGw2BuildTemplate } from '../../../js/platform/gw2/builds/templates/codec.js';
import { GW2_BUILD_TEMPLATE_PROFESSIONS } from '../../../js/platform/gw2/builds/templates/data.js';
import { elementalistCatalog } from '../../../js/professions/elementalist/catalog.js';
import { engineerCatalog } from '../../../js/professions/engineer/catalog.js';

const ELEMENTALIST_CODE = '[&DQYfHSkvMBfHEicPwxIAAL4BAADLAMsAJgCWAAAAAAAAAAAAAAAAAAAAAAADVgBnAC8AAA==]';
const ENGINEER_CODE = '[&DQMGJyY5SzYqDwAAhgAAAAcBAACTAQAAex0AAAAAAAAAAAAAAAAAAAAAAAACCQE2AAA=]';

function chatCode(bytes) {
  return `[&${btoa(String.fromCharCode(...bytes))}]`;
}

test('GW2 build templates resolve Elementalist palette IDs to stable catalog skills', () => {
  const decoded = decodeGw2BuildTemplate(ELEMENTALIST_CODE);
  const resolved = resolveGw2BuildTemplate(decoded, {
    catalog: elementalistCatalog,
    expectedProfession: { code: 6, id: 'elementalist', name: 'Elementalist' }
  });

  assert.deepEqual(resolved.specializations, [
    { name: 'Fire', traits: '1-3-1' },
    { name: 'Air', traits: '3-3-2' },
    { name: 'Tempest', traits: '3-1-1' }
  ]);
  assert.deepEqual(resolved.selectedSkills, {
    Heal: 'Wash the Pain Away!',
    Utility1: 'Feel the Burn!',
    Utility2: 'Glyph of Storms (Fire)',
    Utility3: 'Signet of Fire',
    Elite: 'Glyph of Elementals'
  });
  assert.deepEqual(resolved.weaponCandidates, ['Scepter', 'Warhorn', 'Dagger']);
  assert.deepEqual(resolved.weaponOptions, [
    ['Scepter', 'Warhorn'],
    ['Scepter', 'Dagger'],
    ['Dagger', 'Warhorn'],
    ['Dagger', 'Dagger']
  ]);
  assert.deepEqual(resolved.weapons, ['Scepter', 'Warhorn']);
  assert.equal(resolved.warnings.length, 1);

  const glyph = elementalistCatalog.skillsByName.get('Glyph of Storms (Fire)');

  assert.equal(glyph.id, 5736);
  assert.equal(glyph.apiSkillId ?? glyph.id, 5736);
  assert.equal(glyph.loadoutSkillId, 5734);
});

test('the generic decoder also resolves the supplied Engineer template', () => {
  const decoded = decodeGw2BuildTemplate(ENGINEER_CODE);
  const resolved = resolveGw2BuildTemplate(decoded, {
    catalog: engineerCatalog,
    expectedProfession: { code: 3, id: 'engineer', name: 'Engineer' }
  });

  assert.deepEqual(resolved.specializations, [
    { name: 'Explosives', traits: '3-1-2' },
    { name: 'Firearms', traits: '1-2-3' },
    { name: 'Amalgam', traits: '2-1-3' }
  ]);
  assert.deepEqual(resolved.selectedSkills, {
    Heal: 'A.E.D.',
    Utility1: 'Grenade Kit',
    Utility2: 'Bomb Kit',
    Utility3: 'Flamethrower',
    Elite: 'Flux State'
  });
  assert.deepEqual(resolved.weaponCandidates, ['Spear', 'Pistol']);
  assert.deepEqual(resolved.weaponOptions, [
    ['Spear', ''],
    ['Pistol', 'Pistol']
  ]);
  assert.deepEqual(resolved.weapons, ['Spear', '']);
  assert.match(resolved.warnings[0], /Choose the intended weapon set/);
  assert.equal(resolved.warnings.length, 1);
});

test('build-template decoding rejects malformed and mismatched chat codes', () => {
  assert.throws(() => decodeGw2BuildTemplate('not a chat code'), /\[&/);
  assert.throws(() => decodeGw2BuildTemplate(chatCode(Uint8Array.of(0x0d, 6))), /shorter/);

  const wrongHeader = new Uint8Array(44);

  assert.throws(() => decodeGw2BuildTemplate(chatCode(wrongHeader)), /not a/);

  const truncatedWeapons = new Uint8Array(45);

  truncatedWeapons[0] = 0x0d;
  truncatedWeapons[44] = 1;
  assert.throws(() => decodeGw2BuildTemplate(chatCode(truncatedWeapons)), /truncated weapon/);

  const malformedOverrides = new Uint8Array(46);

  malformedOverrides[0] = 0x0d;
  malformedOverrides[44] = 0;
  malformedOverrides[45] = 1;
  assert.throws(() => decodeGw2BuildTemplate(chatCode(malformedOverrides)), /malformed skill-override/);

  assert.throws(
    () =>
      resolveGw2BuildTemplate(decodeGw2BuildTemplate(ELEMENTALIST_CODE), {
        catalog: engineerCatalog,
        expectedProfession: { code: 3, id: 'engineer', name: 'Engineer' }
      }),
    /profession code 6, not Engineer/
  );
  assert.equal(Object.keys(GW2_BUILD_TEMPLATE_PROFESSIONS).length, 9);
});
