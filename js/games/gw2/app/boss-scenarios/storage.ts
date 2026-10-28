import { BOSS_SCENARIO_VERSION, type BossScenarioDraft } from '#gw2/app/boss-scenarios/model.js';

interface ScenarioLibrary {
  activeId: string;
  scenarios: BossScenarioDraft[];
}

type ScenarioStorage = Pick<Storage, 'getItem' | 'setItem'>;
const storageKey = (contentId: string) => `gw2-boss-scenarios-${contentId}-v${BOSS_SCENARIO_VERSION}`;

/** Read only the current format's namespace, leaving older drafts untouched without attempting conversion. */
export function loadScenarioLibrary(
  storage: ScenarioStorage,
  contentId: string,
  parse: (value: unknown) => BossScenarioDraft
): (ScenarioLibrary & { recovered: boolean }) | null {
  const raw = storage.getItem(storageKey(contentId));

  if (raw === null) return null;

  const scenarios: BossScenarioDraft[] = [];
  let activeId = '';
  let recovered = false;
  try {
    const saved = JSON.parse(raw);

    if (saved?.version !== BOSS_SCENARIO_VERSION || !Array.isArray(saved.scenarios) || saved.scenarios.length > 100)
      throw new Error('Invalid scenario library.');

    // A stale skill or damaged draft must not hide unrelated valid scenarios or disable new saves.
    for (const value of saved.scenarios) {
      try {
        const draft = parse(value);

        if (scenarios.some((entry) => entry.id === draft.id)) throw new Error('Duplicate scenario id.');

        scenarios.push(draft);
      } catch {
        recovered = true;
      }
    }

    activeId = scenarios.some((draft) => draft.id === saved.activeId) ? saved.activeId : (scenarios[0]?.id ?? '');
    recovered ||= activeId !== saved.activeId;
  } catch {
    recovered = true;
  }

  // Back up before replacing damaged data, then persist recovery so reloads cannot accumulate duplicate backups.
  if (recovered) {
    storage.setItem(`${storageKey(contentId)}-recovery-${crypto.randomUUID()}`, raw);
    saveScenarioLibrary(storage, contentId, { activeId, scenarios });
  }

  return { activeId, scenarios, recovered };
}

/** New work saves independently of previous formats, so an obsolete draft cannot block the current editor. */
export function saveScenarioLibrary(storage: ScenarioStorage, contentId: string, library: ScenarioLibrary): void {
  storage.setItem(
    storageKey(contentId),
    JSON.stringify({ version: BOSS_SCENARIO_VERSION, activeId: library.activeId, scenarios: library.scenarios })
  );
}
