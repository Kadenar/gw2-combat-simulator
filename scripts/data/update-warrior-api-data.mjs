import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { updateProfessionApiData } from './update-profession-api-data.mjs';

export async function updateWarriorApiData(options = {}) {
  const result = await updateProfessionApiData('Warrior', {
    ...options,
    snapshotConfig: {
      excludedIds: [62857],
      skillOverrides: {
        30185: { recharge: 8 }
      },
      repairSkill(skill) {
        return skill.id === 62803 ? { ...skill, flip_skill: null } : skill;
      },
      ...(options.snapshotConfig || {})
    }
  });
  const source = await readFile(result.output, 'utf8');
  await writeFile(
    result.output,
    source.replace(
      'Run scripts/data/update-profession-api-data.mjs --profession Warrior to refresh.',
      'Run npm run update:warrior-data to refresh.'
    ),
    'utf8'
  );
  return result;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) await updateWarriorApiData();
