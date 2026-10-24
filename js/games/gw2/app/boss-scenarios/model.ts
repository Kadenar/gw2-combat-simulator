import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { CatalogLookup } from '#gw2/platform/skills/types.js';
import { validateRotationCommand } from '#gw2/platform/builds/rotation.js';
import { ENCOUNTER_TEMPLATES, encounterHealth, encounterDifficulties } from '#gw2/app/boss-scenarios/catalog.js';
import { encounterPhasePlan, type EncounterDifficulty } from '#gw2/app/boss-scenarios/phases.js';

// Per-target inputs and revised phase layouts use a separate document and storage version.
export const BOSS_SCENARIO_VERSION = 3;

export type ScenarioPhaseDraft =
  | {
      id: string;
      kind: 'boss';
      groupDps: number | Record<string, number>;
      playerTargetIndex?: number;
      windowSeconds?: number;
    }
  | { id: string; kind: 'split'; durationSeconds: number | null; intermissionSeconds?: number };

/** One continuous rotation belongs to the build; phases contain squad assumptions only. */
export interface BossScenarioDraft {
  version: typeof BOSS_SCENARIO_VERSION;
  id: string;
  name: string;
  profession: string;
  buildName: string;
  build: Gw2CanonicalBuild;
  patchId: string;
  encounter: string;
  encounterId: string;
  difficulty: EncounterDifficulty;
  health: number | null;
  targetIndex: number | null;
  phases: ScenarioPhaseDraft[];
}

/** Selecting an encounter installs its predefined sequence without touching the player's rotation. */
export function selectScenarioEncounter(
  draft: BossScenarioDraft,
  encounterId: string,
  difficulty: EncounterDifficulty
): void {
  const encounter = ENCOUNTER_TEMPLATES.find((entry) => entry.id === encounterId);

  if (!encounter || !encounterDifficulties(encounterId).includes(difficulty))
    throw new Error('Choose a supported boss and difficulty.');

  const evidence = encounterHealth(encounterId, difficulty);
  const target = evidence?.targets.find((entry) => entry.primary && entry.health > 0);
  const previousDps = draft.phases.find((phase) => phase.kind === 'boss')?.groupDps ?? 0;
  const groupDps = typeof previousDps === 'number' ? previousDps : (Object.values(previousDps)[0] ?? 0);
  draft.encounterId = encounterId;
  draft.encounter = encounter.name;
  draft.difficulty = difficulty;
  draft.health = target?.health ?? null;
  draft.targetIndex = target?.index ?? null;
  draft.phases = encounterPhasePlan(encounterId, difficulty).phases.map((phase) => {
    if (phase.kind === 'split') return { id: phase.id, kind: 'split', durationSeconds: null };

    const active = evidence!.targets.filter(
      (target) => !phase.targetIndexes || phase.targetIndexes.includes(target.index)
    );
    return {
      id: phase.id,
      kind: 'boss',
      // A previous single-target rate cannot imply how a new squad splits damage across targets.
      groupDps: active.length > 1 ? Object.fromEntries(active.map((target) => [String(target.index), 0])) : groupDps,
      ...(active.length > 1 ? { playerTargetIndex: active[0]!.index } : {}),
      ...(phase.damageWindow ? { windowSeconds: phase.damageWindow.defaultSeconds } : {})
    };
  });
}

/** The default encounter copies the active golem build, keeping both editing sessions independent. */
export function createBossScenario(
  encounterId: string,
  build: Gw2CanonicalBuild,
  buildName: string,
  patchId: string,
  copyRotation: boolean
): BossScenarioDraft {
  const draft: BossScenarioDraft = {
    version: BOSS_SCENARIO_VERSION,
    id: crypto.randomUUID(),
    name: '',
    profession: build.profession,
    buildName,
    build: structuredClone(build),
    patchId,
    encounter: '',
    encounterId,
    difficulty: 'normal',
    health: null,
    targetIndex: null,
    phases: []
  };

  if (!copyRotation) draft.build.rotation = [];

  selectScenarioEncounter(draft, encounterId, 'normal');
  draft.name = `${draft.encounter} scenario`;
  return draft;
}

/** Imports must match the boss-owned sequence; manual phase layouts and per-phase rotations are not supported. */
export function parseBossScenario(
  value: unknown,
  profession: string,
  parseBuild: (value: unknown) => Gw2CanonicalBuild,
  catalog: CatalogLookup | null = null
): BossScenarioDraft {
  const record = value as Partial<BossScenarioDraft> | null;
  const text = (item: unknown): item is string =>
    typeof item === 'string' && item.trim().length > 0 && item.length <= 160;
  const finite = (item: unknown, maximum: number): item is number =>
    typeof item === 'number' && Number.isFinite(item) && item >= 0 && item <= maximum;

  if (
    !record ||
    record.version !== BOSS_SCENARIO_VERSION ||
    record.profession !== profession ||
    !text(record.id) ||
    !text(record.name) ||
    !text(record.buildName) ||
    !text(record.patchId) ||
    !ENCOUNTER_TEMPLATES.some((entry) => entry.id === record.encounterId && entry.name === record.encounter) ||
    !encounterDifficulties(record.encounterId!).includes(record.difficulty!) ||
    record.build?.profession !== profession ||
    !Array.isArray(record.phases)
  ) {
    throw new Error('Invalid scenario: check its version, profession, boss, and difficulty.');
  }

  const evidence = encounterHealth(record.encounterId!, record.difficulty!);
  const target = evidence?.targets.find((entry) => entry.primary && entry.health > 0);

  if (record.health !== (target?.health ?? null) || record.targetIndex !== (target?.index ?? null))
    throw new Error('Scenario health must match Elite Insights.');

  const definitions = encounterPhasePlan(record.encounterId!, record.difficulty!).phases;

  if (
    record.phases.length !== definitions.length ||
    record.phases.some((phase, index) => {
      const definition = definitions[index]!;
      const active = evidence!.targets.filter(
        (target) => !definition.targetIndexes || definition.targetIndexes.includes(target.index)
      );
      const validDps =
        phase?.kind === 'boss' &&
        (active.length === 1
          ? finite(phase.groupDps, 1e9)
          : typeof phase.groupDps === 'object' &&
            phase.groupDps !== null &&
            !Array.isArray(phase.groupDps) &&
            Object.keys(phase.groupDps).length === active.length &&
            active.every((target) => finite((phase.groupDps as Record<string, number>)[String(target.index)], 1e9)));
      return (
        !phase ||
        phase.id !== definition.id ||
        phase.kind !== definition.kind ||
        'commands' in phase ||
        'endSplit' in phase ||
        'endHealthPercent' in phase ||
        (phase.kind === 'boss'
          ? !validDps ||
            (active.length > 1
              ? !active.some((target) => target.index === phase.playerTargetIndex)
              : phase.playerTargetIndex !== undefined) ||
            (phase.windowSeconds !== undefined &&
              (!definition.damageWindow || !finite(phase.windowSeconds, 86400) || phase.windowSeconds === 0))
          : (phase.durationSeconds !== null && !finite(phase.durationSeconds, 86400)) ||
            (phase.intermissionSeconds !== undefined && !finite(phase.intermissionSeconds, 86400)))
      );
    })
  )
    throw new Error(
      'Phase inputs must match the selected boss; DPS, split durations, and intermissions must be non-negative.'
    );

  // Validate raw commands before build normalization can discard malformed imported input.
  if (
    !Array.isArray(record.build.rotation) ||
    record.build.rotation.length > 10000 ||
    record.build.rotation.some(
      (command) => validateRotationCommand(command, catalog, { requireKnownSkill: catalog !== null }).length
    )
  )
    throw new Error('Invalid rotation.');

  const build = structuredClone(parseBuild(record.build));

  return {
    version: BOSS_SCENARIO_VERSION,
    id: record.id,
    name: record.name.trim(),
    profession,
    buildName: record.buildName.trim(),
    build,
    patchId: record.patchId,
    encounter: record.encounter!,
    encounterId: record.encounterId!,
    difficulty: record.difficulty!,
    health: record.health!,
    targetIndex: record.targetIndex!,
    phases: record.phases.map((phase) =>
      phase.kind === 'boss'
        ? {
            id: phase.id,
            kind: 'boss',
            groupDps: structuredClone(phase.groupDps),
            ...(phase.playerTargetIndex !== undefined ? { playerTargetIndex: phase.playerTargetIndex } : {}),
            ...(phase.windowSeconds !== undefined ? { windowSeconds: phase.windowSeconds } : {})
          }
        : {
            id: phase.id,
            kind: 'split',
            durationSeconds: phase.durationSeconds,
            // An intermission is optional encounter authoring, independent of the split's own duration.
            ...(phase.intermissionSeconds !== undefined ? { intermissionSeconds: phase.intermissionSeconds } : {})
          }
    )
  };
}
