import { encounterHealth } from '#gw2/app/boss-scenarios/catalog.js';
import type { BossScenarioDraft } from '#gw2/app/boss-scenarios/model.js';
import { encounterExecutionPhases, encounterPhasePlan } from '#gw2/app/boss-scenarios/phases.js';
import type { EncounterConfig, EncounterPhase } from '#gw2/platform/combat/state/encounter.js';
import type { Gw2Config } from '#gw2/platform/simulation/config.js';

export const ENCOUNTER_RESULT_EVENT = 'gw2:encounter-result';

/** Compile encounter stages against each EI target and bar; each target receives its own authored group DPS. */
export function scenarioSimulation(draft: BossScenarioDraft): { config: EncounterConfig | null; reason: string } {
  const evidence = encounterHealth(draft.encounterId, draft.difficulty);
  const targets = evidence?.targets.filter((target) => target.primary && target.health > 0) ?? [];
  const plan = encounterPhasePlan(draft.encounterId, draft.difficulty);

  if (!targets.length) return { config: null, reason: 'This encounter has no verified target health.' };

  const previousEnds = new Map<number, number>();
  const previousBars = new Map<number, number>();
  const phases: EncounterPhase[] = plan.phases.flatMap<EncounterPhase>((definition, index) => {
    const input = draft.phases[index]!;

    // Authored intermissions run after the split, with no damage windows or squad ticks until the next boss phase.
    if (input.kind === 'split')
      return [
        { id: input.id, kind: 'split', durationSeconds: input.durationSeconds ?? 0 },
        ...(input.intermissionSeconds
          ? [
              {
                id: `intermission-${input.id}`,
                kind: 'intermission' as const,
                durationSeconds: input.intermissionSeconds
              }
            ]
          : [])
      ];

    // Fixed opening targets take precedence; the shared Largos choice governs only phases without a fixed target.
    const active = targets.filter((target) =>
      definition.targetIndexes
        ? definition.targetIndexes.includes(target.index)
        : draft.targetIndex === undefined || target.index === draft.targetIndex
    );

    if (!active.length || definition.endHealthPercent === null)
      throw new Error('Encounter phase has no target or health gate.');

    const compiled: Extract<EncounterPhase, { kind: 'boss' }> = {
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
          armor: target.armor,
          hitboxWidth: target.hitboxWidth,
          groupDps: typeof input.groupDps === 'number' ? input.groupDps : input.groupDps[String(target.index)]!,
          endHealthPercent: end,
          startHealthPercent,
          entryHealthLossPercent: definition.entryHealthLossPercent ?? 0
        };
      })
    };
    // Each internal checkpoint uses the same platform target and DPS; only its health gate and downtime differ.
    return encounterExecutionPhases([definition]).map((segment, segmentIndex): EncounterPhase =>
      segment.kind !== 'boss'
        ? { id: segment.id, kind: segment.kind, durationSeconds: segment.durationSeconds! }
        : {
            ...compiled,
            id: segment.id,
            targets: compiled.targets.map((target) => ({
              ...target,
              endHealthPercent: segment.endHealthPercent!,
              // Checkpoints preserve the bar after its first entry rather than replaying a transformation.
              startHealthPercent: segmentIndex === 0 ? target.startHealthPercent : null,
              entryHealthLossPercent: segmentIndex === 0 ? target.entryHealthLossPercent : 0
            }))
          }
    );
  });
  return { config: { phases, repeatFrom: plan.repeats ? phases[0]!.id : null }, reason: '' };
}

/** All analysis jobs inherit the same encounter health, armor, phases, and squad rates as the rotation baseline. */
export function withScenarioConfig(config: Gw2Config, draft: BossScenarioDraft | undefined): Gw2Config {
  if (!draft) return config;

  const { config: encounter, reason } = scenarioSimulation(draft);

  if (!encounter) throw new Error(reason);

  // Size comes from the live encounter target, never a hidden Golem build assumption.
  const { hitboxSize: _hitboxSize, ...professionAssumptions } = config.professionAssumptions ?? {};
  return {
    ...config,
    professionAssumptions,
    encounter,
    // A full subgroup is the player plus four allies; direct pet grants retain their explicit recipients.
    allies: { ...config.allies, count: 4 },
    sharePlayerBoonsWithSummons: false,
    // The runtime alone installs encounter health and armor; authoring only supplies boss-specific assumptions.
    target: { ...config.target, defiant: true }
  };
}
