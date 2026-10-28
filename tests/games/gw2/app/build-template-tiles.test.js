import assert from 'node:assert/strict';
import test from 'node:test';

import { templateTileContent } from '#gw2/app/build/library/model.js';
import { templateSnowCrowsLink } from '#gw2/app/build/library/view.js';

test('build template tiles separate canonical roles, weapons, and DPS', () => {
  assert.deepEqual(
    templateTileContent({
      label: 'Power Quickness Hare (Scepter/Dagger)',
      build: 'b-power-quick-evoker-hare.json',
      benchmarkDps: 32493
    }),
    { name: 'Power Quickness', weapons: 'Hare Scepter & Dagger', dps: '32,493' }
  );
  assert.deepEqual(
    templateTileContent({
      label: 'Condition Alacrity Spear (2 Kit)',
      build: 'b-condi-alac-amalgam-2kit.json',
      benchmarkDps: 35508
    }),
    { name: 'Condition Alacrity', weapons: 'Spear', dps: '35,508' }
  );
});

test('Evoker template tiles retain familiars across damage, boon, and Inferno builds', () => {
  // Familiar names must survive condensed labels together with weapon and trailing trait variants.
  for (const [label, weapons] of [
    ['Power Hare (Spear)', 'Hare Spear'],
    ['Condition Fox - (Pistol/Dagger)', 'Fox Pistol & Dagger'],
    ['Condition Quickness Fox SE (Scepter/Focus)', 'Fox Scepter & Focus'],
    ['Condition Alacrity Toad (Pistol/Warhorn) - EB', 'Toad Pistol & Warhorn - EB'],
    ['Inferno Fox SE (Scepter/Focus)', 'Inferno Fox Scepter & Focus'],
    ['Healing Otter (Staff)', 'Otter Staff']
  ]) {
    assert.equal(templateTileContent({ label, build: 'b-evoker.json' }).weapons, weapons);
  }
});

test('build template tiles preserve trait variants alongside their weapons', () => {
  // Same-weapon presets need their trait suffix to distinguish BTTH from FA in the selector.
  for (const variant of ['BTTH', 'FA']) {
    const content = templateTileContent({
      label: `Power (Sword/Dagger) - ${variant}`,
      build: 'b-power-catalyst-sword.json'
    });
    assert.equal(content.weapons, `Sword & Dagger - ${variant}`);
    assert.equal(content.name, 'Power');
  }
});

test('power template tiles retain Inferno alongside weapons and other trait variants', () => {
  for (const [label, name, weapons] of [
    ['Inferno (Scepter/Dagger)', 'Power', 'Inferno Scepter & Dagger'],
    ['Inferno (Scepter/Dagger) - BTTH', 'Power', 'Inferno Scepter & Dagger - BTTH'],
    ['Inferno Alacrity (Scepter/Focus)', 'Power Alacrity', 'Inferno Scepter & Focus'],
    ['Power (Scepter/Dagger)', 'Power', 'Inferno Scepter & Dagger']
  ]) {
    const content = templateTileContent({ label, build: 'b-inferno-tempest.json' });
    assert.equal(content.name, name);
    assert.equal(content.weapons, weapons);
  }
});

test('build template actions expose only configured Snow Crows links', () => {
  assert.match(
    templateSnowCrowsLink({ snowCrowsUrl: 'https://snowcrows.com/builds/example?role=power&weapon=hammer' }),
    /href="https:\/\/snowcrows\.com\/builds\/example\?role=power&amp;weapon=hammer"/
  );
  assert.equal(templateSnowCrowsLink({}), '');
});
