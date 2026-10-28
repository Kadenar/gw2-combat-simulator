import assert from 'node:assert/strict';
import test from 'node:test';

import { professionRegistry } from '#gw2/profession-registry.js';

test('the landing selector records supplied specialization artwork for every profession', () => {
  const artwork = Object.fromEntries(
    professionRegistry
      .filter((entry) => entry.specializationArtwork)
      .map((entry) => [entry.id, entry.specializationArtwork.map(({ name }) => name)])
  );

  assert.deepEqual(artwork, {
    elementalist: ['Core', 'Tempest', 'Weaver', 'Catalyst', 'Evoker'],
    mesmer: ['Core', 'Chronomancer', 'Mirage', 'Virtuoso', 'Troubadour'],
    necromancer: ['Core', 'Reaper', 'Scourge', 'Harbinger', 'Ritualist'],
    ranger: ['Core', 'Druid', 'Soulbeast', 'Untamed', 'Galeshot'],
    thief: ['Core', 'Daredevil', 'Deadeye', 'Specter', 'Antiquary'],
    engineer: ['Core', 'Scrapper', 'Holosmith', 'Mechanist', 'Amalgam'],
    guardian: ['Core', 'Dragonhunter', 'Firebrand', 'Willbender', 'Luminary'],
    warrior: ['Core', 'Berserker', 'Spellbreaker', 'Bladesworn', 'Paragon'],
    revenant: ['Core', 'Herald', 'Renegade', 'Vindicator', 'Conduit']
  });
  assert.equal(
    professionRegistry
      .flatMap((entry) => entry.specializationArtwork || [])
      .every(
        ({ image }) =>
          image.startsWith('https://assets.snowcrows.com/') || image.endsWith('/professions/revenant/core.png')
      ),
    true
  );
});
