import { generateEngineerIds } from './generate-engineer-ids.mjs';
import { generateRevenantIds } from './generate-revenant-ids.mjs';
import { updateElementalistApiData } from './update-elementalist-api-data.mjs';
import {
  parseProfession,
  prepareProfessionApiData,
  publishProfessionData,
  updateProfessionApiData
} from './update-profession-api-data.mjs';
import { updateRangerData } from './update-ranger-data.mjs';
import { updateWarriorData } from './update-warrior-data.mjs';

// The complete refresh of each profession that needs more than its metadata. Dependent identities are validated
// before metadata is published, including when an API name has become ambiguous.
const COMPLETE_REFRESHES = {
  Elementalist: updateElementalistApiData,
  Engineer: () => publishProfessionData(() => prepareProfessionApiData('Engineer'), generateEngineerIds),
  Ranger: updateRangerData,
  Revenant: () => publishProfessionData(() => prepareProfessionApiData('Revenant'), generateRevenantIds),
  Warrior: updateWarriorData
};

// Route professions with dependent generators through their complete refresh; update metadata directly for the rest.
export async function updateProfessionData(args = process.argv.slice(2)) {
  const profession = parseProfession(args);
  const refresh = COMPLETE_REFRESHES[profession] ?? (() => updateProfessionApiData(profession));

  await refresh();
}

// Refresh only when invoked as a CLI so importing the pipeline never fetches or writes data.
if (import.meta.main) await updateProfessionData();
