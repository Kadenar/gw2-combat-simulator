import assert from 'node:assert/strict';
import test from 'node:test';
import { UNDERWATER_ONLY_SKILL_IDS } from '#gw2/platform/skills/underwater-skill-ids.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { revenantCatalog } from '#gw2/professions/revenant/catalog.js';
import { RANGER_PETS, RANGER_PET_SKILLS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import { RANGER_CORE_PET_SKILL_MECHANICS } from '#gw2/professions/ranger/core/skills/pets/index.js';
import { normalizeLogProfessionActions } from '#gw2/integrations/logs/shared/rotation/professions/index.js';

test('all profession catalogs and source metadata exclude confirmed underwater skills', async () => {
  // Check every source as well as assembled catalogs so metadata refreshes cannot silently restore water skills.
  for (const profession of [
    'elementalist',
    'engineer',
    'guardian',
    'mesmer',
    'necromancer',
    'ranger',
    'revenant',
    'thief',
    'warrior'
  ]) {
    const catalogModule = await import('#gw2/professions/' + profession + '/catalog.js');
    const { SKILLS } = await import('#gw2/professions/' + profession + '/data/' + profession + '-api-metadata.js');
    const supplemental = ['elementalist', 'guardian'].includes(profession)
      ? []
      : (await import('#gw2/professions/' + profession + '/data/' + profession + '-supplemental-skills.js'))[
          profession.toUpperCase() + '_SUPPLEMENTAL_SKILLS'
        ];
    const metadataIds = new Set([...SKILLS, ...supplemental].map(({ id }) => id));
    for (const id of UNDERWATER_ONLY_SKILL_IDS) {
      assert.equal(metadataIds.has(id), false, profession + ' metadata ' + id);
      assert.equal(catalogModule[profession + 'Catalog'].skillsById.has(id), false, profession + ' catalog ' + id);
    }
  }
});

test('land pets exclude underwater commands and beast skills', () => {
  const metadataIds = new Set(RANGER_PET_SKILLS.map(({ id }) => id));
  const petIds = new Set(RANGER_PETS.flatMap((pet) => [...pet.skillIds, ...pet.beastmodeSkillIds]));
  for (const id of UNDERWATER_ONLY_SKILL_IDS) {
    assert.equal(metadataIds.has(id), false, 'pet metadata ' + id);
    assert.equal(petIds.has(id), false, 'pet reference ' + id);
    assert.equal(RANGER_CORE_PET_SKILL_MECHANICS[id], undefined, 'pet mechanics ' + id);
  }
});

test('Conduit logs discard underwater buttons before resolving identical land skill names', () => {
  // Water follow-ups must be rejected too, while the land follow-up keeps its canonical input mapping.
  const identities = [
    [76805, 'Beguiling Haze'],
    [76917, 'Beguiling Haze'],
    [77141, 'Beguiling Haze'],
    [77159, 'Beguiling Haze'],
    [77001, 'Twin Moon Sweep'],
    [76968, 'Twin Moon Sweep']
  ];
  const actions = normalizeLogProfessionActions({
    profile: { professionId: 'revenant', specializationId: 'conduit', skillIdAliases: {}, skillNameAliases: {} },
    catalog: revenantCatalog,
    recordedActions: identities.map(([rawSkillId, rawName], index) => ({
      rawSkillId,
      rawName,
      start: index * 1000,
      end: index * 1000,
      eventIndex: index,
      status: 'instant',
      isSwap: false,
      metadataAccurate: true
    }))
  });
  assert.deepEqual(
    actions.map(({ rawSkillId }) => rawSkillId),
    [77141, 77159, 76968]
  );
});

test('log normalization cannot turn underwater names into unrelated land commands', () => {
  // Identical display names must not turn Carrion's heal, Whiptail's cloud, or Armor Fish's bite into land skills.
  const identities = [
    [12703, 'Regenerate'],
    [12717, 'Regenerate'],
    [12702, 'Poison Cloud'],
    [12687, 'Poison Cloud'],
    [44885, 'Chomp'],
    [41537, 'Chomp']
  ];
  const actions = normalizeLogProfessionActions({
    profile: { professionId: 'ranger', specializationId: 'soulbeast', skillIdAliases: {}, skillNameAliases: {} },
    catalog: rangerCatalog,
    recordedActions: identities.map(([rawSkillId, rawName], index) => ({
      rawSkillId,
      rawName,
      start: index * 1000,
      end: index * 1000,
      eventIndex: index,
      status: 'instant',
      isSwap: false,
      metadataAccurate: true
    }))
  });
  assert.deepEqual(
    actions.map(({ rawSkillId }) => rawSkillId),
    [12717, 12687, 41537]
  );
});
