import type { Gw2CanonicalBuild } from '#gw2/platform/builds/types.js';
import type { CatalogLookup } from '#gw2/platform/skills/types.js';
import { validateRotationCommand } from '#gw2/platform/builds/rotation.js';
import { ENCOUNTER_TEMPLATES, encounterHealth, encounterDifficulties } from '#gw2/app/boss-scenarios/catalog.js';
import { encounterPhasePlan, type EncounterDifficulty } from '#gw2/app/boss-scenarios/phases.js';

export type ScenarioPhaseDraft =
  { id: string; kind: 'boss'; groupDps: number } | { id: string; kind: 'split'; durationSeconds: number | null };

/** One continuous rotation belongs to the build; phases contain squad assumptions only. */
export interface BossScenarioDraft {
  version: 2;
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
  const groupDps = draft.phases.find((phase) => phase.kind === 'boss')?.groupDps ?? 0;
  draft.encounterId = encounterId;
  draft.encounter = encounter.name;
  draft.difficulty = difficulty;
  draft.health = target?.health ?? null;
  draft.targetIndex = target?.index ?? null;
  draft.phases = encounterPhasePlan(encounterId, difficulty).phases.map((phase) =>
    phase.kind === 'boss'
      ? { id: phase.id, kind: 'boss', groupDps }
      : { id: phase.id, kind: 'split', durationSeconds: null }
  );
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
    version: 2,
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
    record.version !== 2 ||
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
      return (
        !phase ||
        phase.id !== definition.id ||
        phase.kind !== definition.kind ||
        'commands' in phase ||
        'endSplit' in phase ||
        'endHealthPercent' in phase ||
        (phase.kind === 'boss'
          ? !finite(phase.groupDps, 1e9)
          : phase.durationSeconds !== null && !finite(phase.durationSeconds, 86400))
      );
    })
  )
    throw new Error('Phase inputs must match the selected boss; DPS and split durations must be non-negative.');

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
    version: 2,
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
        ? { id: phase.id, kind: 'boss', groupDps: phase.groupDps }
        : { id: phase.id, kind: 'split', durationSeconds: phase.durationSeconds }
    )
  };
}
