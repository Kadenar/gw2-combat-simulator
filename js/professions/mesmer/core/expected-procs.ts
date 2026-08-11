import { professionCoreState } from "../../../platform/engine/profession.js";
import { isInternalCooldownReady } from "../../../platform/engine/clock.js";
import { isGw2PlayerActorEvent } from "../../../platform/gw2/event-ownership.js";
import { MESMER_TRAIT_IDS as TRAIT } from "../data/ids.js";
import type {
  SchedulerState,
  SimulationEvent,
} from "../../../platform/engine/types.js";
import type {
  MesmerActivePrimaryWeapon,
  MesmerAddTraitProc,
  MesmerConfig,
  MesmerEmitDerivedEvent,
  MesmerExpectedProcCandidate,
  MesmerExpectedProcTracker,
  MesmerRuntimeState,
  MesmerQueueResources,
} from "../types.js";

const PROC_PROGRESS_TOLERANCE = 1e-9;

interface ExpectedProcTrackerOptions {
  readonly state: SchedulerState<MesmerRuntimeState>;
  readonly config: MesmerConfig;
  readonly traits: ReadonlySet<number>;
  readonly epsilon: number;
  readonly criticalChance: (event: SimulationEvent) => number;
  readonly activePrimaryWeapon: MesmerActivePrimaryWeapon;
  readonly queueResources: MesmerQueueResources;
  readonly emitEvent: MesmerEmitDerivedEvent;
  readonly boonDuration: (boon: string, baseDuration: number) => number;
  readonly addTraitProc: MesmerAddTraitProc;
}

/**
 * Materializes Mesmer critical bleeding from deterministic expected frequency
 * or stochastic hit facts, then reduces all canonical bleeding events into
 * the scheduler-authoritative Bloodsong state.
 */
export function createExpectedProcTracker({
  state,
  config,
  traits,
  epsilon,
  criticalChance,
  activePrimaryWeapon,
  queueResources,
  emitEvent,
  boonDuration,
  addTraitProc,
}: ExpectedProcTrackerOptions): Readonly<MesmerExpectedProcTracker> {
  const stochastic = config.randomness?.mode === "stochastic";
  const sampledCritical = (event: SimulationEvent): boolean => {
    if (typeof event.didCrit !== "boolean") {
      throw new Error(
        `Missing sampled critical outcome for Mesmer event ${String(
          event.skillName || event.name || event.sourceId,
        )}.`,
      );
    }
    return event.didCrit;
  };

  const trackBloodsong = (at: number, bleedingStacks: number) => {
    if (config.specialization !== "Virtuoso" || !traits.has(TRAIT.BLOODSONG))
      return;
    const active = state.profession.specialization;
    if (active.kind !== "Virtuoso") return;
    active.state.bloodsongProgress += Number(bleedingStacks || 0);
    while (active.state.bloodsongProgress >= 5 - PROC_PROGRESS_TOLERANCE) {
      active.state.bloodsongProgress -= 5;
      queueResources(at + epsilon, 1, activePrimaryWeapon(), "Bloodsong", {
        traitId: TRAIT.BLOODSONG,
        traitName: "Bloodsong",
      });
    }
  };

  const materializeMasterFencer = (
    event: SimulationEvent,
    chance: number,
  ): void => {
    if (
      !traits.has(TRAIT.MASTER_FENCER) ||
      !isGw2PlayerActorEvent(event) ||
      !(Number(event.coefficient) > 0) ||
      event.noCrit === true ||
      event.canCrit === false
    ) {
      return;
    }
    const core = professionCoreState(state);
    const criticals = stochastic
      ? sampledCritical(event)
        ? 1
        : 0
      : Math.floor(
          (core.masterFencerProgress += chance) + PROC_PROGRESS_TOLERANCE,
        );
    if (!stochastic && criticals > 0) {
      core.masterFencerProgress -= criticals;
    }
    const readyAt = Number(core.traitReadyAt[TRAIT.MASTER_FENCER] || 0);
    if (criticals <= 0 || !isInternalCooldownReady(event.at, readyAt)) {
      return;
    }

    core.traitReadyAt[TRAIT.MASTER_FENCER] = event.at + 8;
    addTraitProc(
      "Master Fencer",
      event.at,
      event.skillName,
      "8s self fury, 4s allied fury",
    );
    const companionIds = professionCoreState(state).clones.map(
      (clone) => `mesmer.clone:${clone.id}`,
    );
    for (const application of [
      { recipients: "self", duration: 8 },
      { recipients: "allies", duration: 4 },
    ] as const) {
      emitEvent(event, {
        type: "buff",
        at: event.at,
        source: "Trait",
        sourceId: TRAIT.MASTER_FENCER,
        actorType: "player",
        skillId: TRAIT.MASTER_FENCER,
        skillName: "Master Fencer",
        name: `Master Fencer — ${application.recipients} fury`,
        kind: "fury",
        duration: boonDuration("fury", application.duration),
        stacks: 1,
        recipients: application.recipients,
        affectsSelf: application.recipients === "self",
        ...(application.recipients === "allies"
          ? {
              maximumRecipients: 4,
              companionIds,
            }
          : {}),
      });
    }
  };

  const materializeCriticalTraits = (event: SimulationEvent) => {
    const chance = Number(criticalChance(event) || 0);
    materializeMasterFencer(event, chance);
    if (
      traits.has(TRAIT.SHARPER_IMAGES) &&
      (event.source === "Clone" || event.source === "Phantasm")
    ) {
      let procCount = 0;
      if (stochastic) {
        procCount = sampledCritical(event) ? 1 : 0;
      } else {
        professionCoreState(state).sharperImagesProgress += chance;
        procCount = Math.floor(
          professionCoreState(state).sharperImagesProgress +
            PROC_PROGRESS_TOLERANCE,
        );
      }
      if (procCount > 0) {
        if (!stochastic) {
          professionCoreState(state).sharperImagesProgress -= procCount;
        }
        emitEvent(event, {
          type: "condition",
          at: event.at,
          name: `${event.name} — Sharper Images`,
          skillName: event.skillName,
          condition: "Bleeding",
          duration: 5,
          stacks: procCount,
          source: "Player",
          sourceId: TRAIT.SHARPER_IMAGES,
          actorType: "player",
        });
        addTraitProc(
          "Sharper Images",
          event.at,
          event.skillName,
          `${procCount} critical-hit proc${procCount === 1 ? "" : "s"}`,
        );
      }
    }

    if (traits.has(TRAIT.JAGGED_MIND) && event.blade) {
      const jaggedMindStacks = stochastic
        ? sampledCritical(event)
          ? 1
          : 0
        : chance;
      if (!(jaggedMindStacks > 0)) return;
      emitEvent(event, {
        type: "condition",
        at: event.at,
        name: `${event.name} — Jagged Mind`,
        skillName: event.skillName,
        parentSkillName: event.parentSkillName,
        condition: "Bleeding",
        duration: 4,
        stacks: jaggedMindStacks,
        source: event.source,
        sourceId: TRAIT.JAGGED_MIND,
        actorType: event.actorType,
      });
      addTraitProc("Jagged Mind", event.at, event.skillName);
    }
  };

  return Object.freeze({
    process(candidate: MesmerExpectedProcCandidate) {
      if (candidate.type === "bleeding") {
        trackBloodsong(candidate.at, candidate.stacks);
      } else if (candidate.type === "hit" && candidate.event) {
        materializeCriticalTraits(candidate.event);
      }
    },
  });
}
