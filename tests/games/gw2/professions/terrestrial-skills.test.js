import assert from 'node:assert/strict';
import test from 'node:test';
import { UNDERWATER_ONLY_SKILL_IDS } from '#gw2/platform/skills/underwater-skill-ids.js';
import { rangerCatalog } from '#gw2/professions/ranger/catalog.js';
import { warriorCatalog } from '#gw2/professions/warrior/catalog.js';
import { SKILLS as RANGER_API_SKILLS } from '#gw2/professions/ranger/data/ranger-api-metadata.js';
import { SKILLS as WARRIOR_API_SKILLS } from '#gw2/professions/warrior/data/warrior-api-metadata.js';
import { RANGER_PETS, RANGER_PET_SKILLS } from '#gw2/professions/ranger/data/ranger-pet-data.js';
import { RANGER_CORE_PET_SKILL_MECHANICS } from '#gw2/professions/ranger/core/skills/pets/index.js';
import { normalizeLogProfessionActions } from '#gw2/integrations/logs/shared/rotation/professions/index.js';

test('land catalogs, metadata, and pet definitions exclude confirmed underwater skills', () => {
  // Metadata and pet references must stay clean as well as the executable catalogs.
  const metadataIds = new Set([...RANGER_API_SKILLS, ...WARRIOR_API_SKILLS, ...RANGER_PET_SKILLS].map(({ id }) => id));
  const petIds = new Set(RANGER_PETS.flatMap((pet) => [...pet.skillIds, ...pet.beastmodeSkillIds]));
  for (const id of UNDERWATER_ONLY_SKILL_IDS) {
    assert.equal(metadataIds.has(id), false, `metadata ${id}`);
    assert.equal(petIds.has(id), false, `pet reference ${id}`);
    assert.equal(rangerCatalog.skillsById.has(id), false, `Ranger catalog ${id}`);
    assert.equal(warriorCatalog.skillsById.has(id), false, `Warrior catalog ${id}`);
    assert.equal(RANGER_CORE_PET_SKILL_MECHANICS[id], undefined, `pet mechanics ${id}`);
  }
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
