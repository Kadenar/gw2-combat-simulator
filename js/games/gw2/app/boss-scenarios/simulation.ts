import type { BossScenarioDraft } from '#gw2/app/boss-scenarios/model.js';
import { encounterHealth } from '#gw2/app/boss-scenarios/catalog.js';
import { encounterPhasePlan } from '#gw2/app/boss-scenarios/phases.js';
import type { EncounterConfig, EncounterPhase } from '#gw2/platform/combat/state/encounter.js';

export const ENCOUNTER_RESULT_EVENT = 'gw2:encounter-result';

/** Compile encounter stages against each EI target and bar; each target receives its own authored group DPS. */
export function scenarioSimulation(draft: BossScenarioDraft): { config: EncounterConfig | null; reason: string } {
  const evidence = encounterHealth(draft.encounterId, draft.difficulty);
  const targets = evidence?.targets.filter((target) => target.primary && target.health > 0) ?? [];
  const plan = encounterPhasePlan(draft.encounterId, draft.difficulty);

  if (!targets.length) return { config: null, reason: 'This encounter has no verified target health.' };

  const previousEnds = new Map<number, number>();
  const previousBars = new Map<number, number>();
  const phases: EncounterPhase[] = plan.phases.map((definition, index) => {
    const input = draft.phases[index]!;

    if (input.kind === 'split') return { id: input.id, kind: 'split', durationSeconds: input.durationSeconds ?? 0 };

    const active = definition.targetIndexes
      ? targets.filter((target) => definition.targetIndexes!.includes(target.index))
      : targets;

    if (!active.length || definition.endHealthPercent === null)
      throw new Error('Encounter phase has no target or health gate.');

    return {
      id: input.id,
      kind: 'boss',
      playerTargetId: String(input.playerTargetIndex ?? active[0]!.index),
      durationSeconds: definition.damageWindow ? (input.windowSeconds ?? definition.damageWindow.defaultSeconds) : null,
      targets: active.map((target) => {
        const end = definition.endHealthPercent!;
        const previousEnd = previousEnds.get(target.index) ?? 100;
        // EI bars are [end %, start %, maximum HP, bar order]; a new bar may restore health (Ura).
        const bars = target.healthBars;
        const barIndex = bars?.findIndex(([lower, upper]) => end >= lower! && end < upper!) ?? -1;
        const bar = barIndex >= 0 ? bars![barIndex]! : null;
        const changedBar = bar !== null && previousBars.get(target.index) !== barIndex;
        const maximumHealth = bar ? bar[2]! : target.health;
        const startHealthPercent = definition.startHealthPercent ?? (changedBar ? bar![1]! : null);
        previousEnds.set(target.index, end);
        previousBars.set(target.index, barIndex);

        if (startHealthPercent === null && previousEnd <= end && !plan.repeats)
          throw new Error('Encounter target gates must descend.');

        return {
          id: String(target.index),
          name: target.name,
          maximumHealth,
          groupDps: typeof input.groupDps === 'number' ? input.groupDps : input.groupDps[String(target.index)]!,
          endHealthPercent: end,
          startHealthPercent,
          entryHealthLossPercent: definition.entryHealthLossPercent ?? 0
        };
      })
    };
  });
  return { config: { phases, repeatFrom: plan.repeats ? phases[0]!.id : null }, reason: '' };
}
