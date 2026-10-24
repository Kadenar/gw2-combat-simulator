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
): ScenarioLibrary | null {
  const raw = storage.getItem(storageKey(contentId));

  if (raw === null) return null;

  const saved = JSON.parse(raw);

  if (saved?.version !== BOSS_SCENARIO_VERSION || !Array.isArray(saved.scenarios) || saved.scenarios.length > 100)
    throw new Error('Invalid scenario library.');

  const scenarios = saved.scenarios.map(parse) as BossScenarioDraft[];

  if (
    typeof saved.activeId !== 'string' ||
    new Set(scenarios.map((draft) => draft.id)).size !== scenarios.length ||
    (scenarios.length > 0 && !scenarios.some((draft) => draft.id === saved.activeId))
  )
    throw new Error('Invalid scenario selection.');

  return { activeId: saved.activeId, scenarios };
}

/** New work saves independently of previous formats, so an obsolete draft cannot block the current editor. */
export function saveScenarioLibrary(storage: ScenarioStorage, contentId: string, library: ScenarioLibrary): void {
  storage.setItem(storageKey(contentId), JSON.stringify({ version: BOSS_SCENARIO_VERSION, ...library }));
}
