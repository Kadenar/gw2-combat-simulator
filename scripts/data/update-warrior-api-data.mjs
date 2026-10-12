import { prepareProfessionApiData, publishProfessionData } from './update-profession-api-data.mjs';

// Keep Warrior snapshot repairs shared by metadata-only and complete refreshes.
export async function prepareWarriorApiData(options = {}) {
  const result = await prepareProfessionApiData('Warrior', {
    ...options,
    snapshotConfig: {
      excludedIds: [62857],
      skillOverrides: {
        30185: { cooldown: 8 }
      },
      repairSkill(skill) {
        return skill.id === 62803 ? { ...skill, flip_skill: null } : skill;
      },
      ...(options.snapshotConfig || {})
    }
  });

  return result;
}

/** Publish the independently requested metadata-only Warrior refresh. */
export async function updateWarriorApiData(options = {}) {
  return publishProfessionData(() => prepareWarriorApiData(options), null, options);
}

// Refresh only when invoked as a CLI so importing the snapshot API never fetches or writes data.
if (import.meta.main) await updateWarriorApiData();
