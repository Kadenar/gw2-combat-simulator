import { SelectedSkillMigrationError } from '#gw2/platform/builds/selected-skills.js';
import { replaceBuild } from '#gw2/app/build/state/persistence.js';
import type { Gw2AppAdapter, ProfessionAppState } from '#gw2/app/types.js';
import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';

/** Owns durable named snapshots independently of the open workspace tabs. */
export interface MyBuild {
  id: string;
  name: string;
  category?: string;
  build: Gw2CanonicalBuild;
}

export function myBuildsStorageKey(adapter: Gw2AppAdapter): string {
  return `${adapter.storageKey}-my-builds-v1`;
}

/** Restores only valid, uniquely identified snapshots for the active profession. */
export function loadMyBuilds(adapter: Gw2AppAdapter): MyBuild[] {
  try {
    const saved = JSON.parse(localStorage.getItem(myBuildsStorageKey(adapter)) || 'null');
    if (saved?.version !== 1 || !Array.isArray(saved.builds)) return [];
    const builds: MyBuild[] = [];
    let migrated = false;
    for (const entry of saved.builds) {
      if (
        !entry ||
        typeof entry.id !== 'string' ||
        !entry.id ||
        typeof entry.name !== 'string' ||
        !entry.name.trim() ||
        entry.build?.profession !== adapter.id ||
        builds.some(({ id }) => id === entry.id)
      )
        continue;
      try {
        builds.push({
          id: entry.id,
          name: entry.name.trim().slice(0, 80),
          category: typeof entry.category === 'string' ? entry.category.trim().slice(0, 80) || undefined : undefined,
          build: replaceBuild(entry.build, adapter)
        });
        if (Object.hasOwn(entry.build, 'selectedSkills')) {
          entry.build = builds.at(-1)!.build;
          migrated = true;
        }
      } catch (error) {
        if (error instanceof SelectedSkillMigrationError) throw error;
        /* One invalid snapshot must not hide the rest of the user's library. */
      }
    }

    // A storage quota failure must not hide successfully converted builds from this session.
    if (migrated) {
      try {
        localStorage.setItem(myBuildsStorageKey(adapter), JSON.stringify(saved));
      } catch {
        /* Retain the original storage and converted in-memory library. */
      }
    }

    return builds;
  } catch (error) {
    if (error instanceof SelectedSkillMigrationError) throw error;
    return [];
  }
}

/** Commits a complete replacement list before the UI adopts it, preventing false successful saves. */
function persistMyBuilds(app: ProfessionAppState, builds: readonly MyBuild[]): void {
  localStorage.setItem(
    myBuildsStorageKey(app.adapter),
    JSON.stringify({
      version: 1,
      builds: builds.map(({ id, name, category, build }) => ({
        id,
        name,
        category,
        build: app.profession.migrateBuild(build)
      }))
    })
  );
}

/**
 * Saves the current build as a new named snapshot or replaces the selected snapshot in place.
 *
 * Merges into the stored library rather than a caller's copy, so a save from another browser tab is never lost.
 */
export function saveMyBuild(app: ProfessionAppState, name: string, id?: string, category?: string): MyBuild[] {
  const cleanName = name.trim().slice(0, 80);
  if (!cleanName) throw new TypeError('Build name is required.');
  const builds = loadMyBuilds(app.adapter);
  if (id && !builds.some((entry) => entry.id === id)) throw new TypeError('Saved build no longer exists.');
  const saved = {
    id: id || crypto.randomUUID(),
    name: cleanName,
    category: category?.trim().slice(0, 80) || undefined,
    build: structuredClone(app.build)
  };
  const next = id ? builds.map((entry) => (entry.id === id ? saved : entry)) : [...builds, saved];
  persistMyBuilds(app, next);
  return next;
}

/** Deletes one user-owned snapshot from the stored library without affecting any open build tab. */
export function deleteMyBuild(app: ProfessionAppState, id: string): MyBuild[] {
  const builds = loadMyBuilds(app.adapter);
  const next = builds.filter((entry) => entry.id !== id);
  if (next.length === builds.length) return builds;
  persistMyBuilds(app, next);
  return next;
}
