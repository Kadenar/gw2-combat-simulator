import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { updateProfessionApiData } from './update-profession-api-data.mjs';

// The profession endpoint omits conjured-weapon, attunement-variant, and
// familiar skills that remain valid native rotation actions. Keep those API
// entities in the Elementalist icon snapshot as well.
const EXTRA_ELEMENTALIST_SKILL_IDS = Object.freeze([
  29415, 29535, 29548, 29618, 29706, 29719, 29948, 29968, 30008, 30047, 30336, 30432, 30662, 30446, 30795, 30864, 29453,
  34609, 34637, 34651, 34714, 34724, 34736, 34743, 34772, 35304, 37873, 40229, 40326, 43080, 43199, 43657, 44637, 44918,
  45216, 45259, 45983, 46024, 49056, 50447, 51646, 51662, 51684, 51711, 62694, 62723, 62813, 62837, 62862, 62876, 62940,
  65179, 71796, 71907, 76643, 77225, 77370, 77226, 5517, 5531, 5532, 5533, 5568, 5595, 5625, 5697, 5720, 5721, 5723,
  5725, 5726, 5727, 5728, 5733
]);

// Refresh on explicit invocation while retaining skills missing from the profession endpoint.
export async function updateElementalistApiData() {
  await updateProfessionApiData('Elementalist', {
    snapshotConfig: {
      extraSkillIds: EXTRA_ELEMENTALIST_SKILL_IDS
    }
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';

if (import.meta.url === invokedPath) await updateElementalistApiData();
