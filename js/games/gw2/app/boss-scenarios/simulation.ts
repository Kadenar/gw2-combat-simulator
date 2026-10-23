import type { BossScenarioDraft } from '#gw2/app/boss-scenarios/model.js';
import { encounterHealth } from '#gw2/app/boss-scenarios/catalog.js';
import { encounterPhasePlan } from '#gw2/app/boss-scenarios/phases.js';
import type { EncounterConfig, EncounterPhase } from '#gw2/platform/combat/state/encounter.js';

export const ENCOUNTER_RESULT_EVENT = 'gw2:encounter-result';

/** Compile verified single-target health gates; unsupported mechanics remain explicit authoring-only encounters. */
export function scenarioSimulation(draft: BossScenarioDraft): { config: EncounterConfig | null; reason: string } {
  const evidence = encounterHealth(draft.encounterId, draft.difficulty);
  const targets = evidence?.targets.filter((target) => target.primary && target.health > 0) ?? [];
  const plan = encounterPhasePlan(draft.encounterId, draft.difficulty);

  if (!draft.health || targets.length !== 1 || targets[0]?.healthBars?.length)
    return {
      config: null,
      reason: 'Encounter execution for multiple targets, segmented health, and events is not implemented yet.'
    };

  if (plan.repeats || plan.phases.some((phase) => phase.kind === 'boss' && phase.endHealthPercent === null))
    return { config: null, reason: 'Execution for this encounter’s mechanic-driven phases is not implemented yet.' };

  const phases: EncounterPhase[] = plan.phases.map((definition, index) => {
    const input = draft.phases[index]!;
    return input.kind === 'boss'
      ? { id: input.id, kind: 'boss', endHealthPercent: definition.endHealthPercent!, groupDps: input.groupDps }
      : { id: input.id, kind: 'split', durationSeconds: input.durationSeconds ?? 0 };
  });
  return { config: { health: draft.health, phases }, reason: '' };
}
