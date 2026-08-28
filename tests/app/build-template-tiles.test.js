import assert from 'node:assert/strict';
import test from 'node:test';

import { templateSnowCrowsLink, templateTileContent } from '../../js/games/gw2/app/build/panels/presets.js';

test('build template tiles separate canonical roles, weapons, and DPS', () => {
  assert.deepEqual(
    templateTileContent({
      label: 'Power Quickness Hare (Scepter/Dagger)',
      build: 'b-power-quick-evoker-hare.json',
      benchmarkDps: 32493
    }),
    { name: 'Power Quickness', weapons: 'Scepter & Dagger', dps: '32,493 DPS' }
  );
  assert.deepEqual(
    templateTileContent({
      label: 'Condition Alacrity Spear (2 Kit)',
      build: 'b-condi-alac-amalgam-2kit.json',
      benchmarkDps: 35508
    }),
    { name: 'Condition Alacrity', weapons: 'Spear', dps: '35,508 DPS' }
  );
});

test('build template actions expose only configured Snow Crows links', () => {
  assert.match(
    templateSnowCrowsLink({ snowCrowsUrl: 'https://snowcrows.com/builds/example?role=power&weapon=hammer' }),
    /href="https:\/\/snowcrows\.com\/builds\/example\?role=power&amp;weapon=hammer"/
  );
  assert.equal(templateSnowCrowsLink({}), '');
});
