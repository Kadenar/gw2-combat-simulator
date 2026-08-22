import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { updateProfessionApiData } from './update-profession-api-data.mjs';

export async function updateWarriorApiData(options = {}) {
  const result = await updateProfessionApiData('Warrior', {
    ...options,
    refreshCommand: 'npm run update:warrior-data',
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

  return result;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';

if (import.meta.url === invokedPath) await updateWarriorApiData();
