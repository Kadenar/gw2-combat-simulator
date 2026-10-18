import assert from 'node:assert/strict';
import test from 'node:test';
import { professionRegistry } from '#gw2/profession-registry.js';
import { ROTATION_PROFILES } from '#gw2/integrations/logs/shared/rotation/profiles.js';

// Metadata must describe the real catalogs, so new or renamed elites cannot silently disappear from log imports.
test('log profile identities cover registered professions and their implemented elite catalogs', async () => {
  assert.deepEqual(
    new Set(ROTATION_PROFILES.map(({ professionId }) => professionId)),
    new Set(professionRegistry.map(({ id }) => id))
  );

  for (const entry of professionRegistry) {
    const profession = await entry.loadProfession();
    const profiles = ROTATION_PROFILES.filter(({ professionId }) => professionId === entry.id);
    const names = ['Core', ...profession.catalog.specializations.filter(({ elite }) => elite).map(({ name }) => name)];

    assert.equal(new Set(profiles.map(({ specializationId }) => specializationId)).size, profiles.length, entry.id);
    assert.deepEqual(new Set(profiles.map(({ specializationName }) => specializationName)), new Set(names), entry.id);
    for (const profile of profiles) {
      assert.equal(profile.professionName, profession.name, entry.id);
      assert.equal(profile.professionName, entry.name, entry.id);
      assert.equal(profile.specializationId, profile.specializationName.toLowerCase(), entry.id);
    }

    for (const artwork of entry.specializationArtwork ?? []) {
      assert.ok(names.includes(artwork.name), `${entry.id}: ${artwork.name}`);
    }
  }
});
