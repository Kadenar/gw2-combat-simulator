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

  return result;
}

// Refresh only when invoked as a CLI so importing the snapshot API never fetches or writes data.
if (import.meta.main) await updateWarriorApiData();
