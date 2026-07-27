import { MESMER_TRAIT_IDS as TRAIT } from "../../data/ids.js";

const PROC_PROGRESS_TOLERANCE = 1e-9;

/**
 * Materializes deterministic Mesmer critical bleeding and reduces all
 * canonical bleeding events into the scheduler-authoritative Bloodsong state.
 */
export function createExpectedProcTracker({
  state,
  config,
  traits,
  epsilon,
  criticalChance,
  activePrimaryWeapon,
  queueResources,
  emitCondition,
  addTraitProc,
}) {
  const trackBloodsong = (at, bleedingStacks) => {
    if (
      config.specialization !== "Virtuoso"
      || !traits.has(TRAIT.BLOODSONG)
    ) return;

    state.profession.bloodsongProgress += Number(bleedingStacks || 0);
    while (
      state.profession.bloodsongProgress
      >= 5 - PROC_PROGRESS_TOLERANCE
    ) {
      state.profession.bloodsongProgress -= 5;
      queueResources(
        at + epsilon,
        1,
        activePrimaryWeapon(),
        "Bloodsong",
      );
    }
  };

  const materializeCriticalTraits = event => {
    const chance = Number(criticalChance(event) || 0);
    if (
      traits.has(TRAIT.SHARPER_IMAGES)
      && (event.source === "Clone" || event.source === "Phantasm")
    ) {
      state.profession.sharperImagesProgress += chance;
      const procCount = Math.floor(
        state.profession.sharperImagesProgress
        + PROC_PROGRESS_TOLERANCE,
      );
      if (procCount > 0) {
        state.profession.sharperImagesProgress -= procCount;
        emitCondition(event, {
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

    if (traits.has(TRAIT.JAGGED_MIND) && event.blade && chance > 0) {
      emitCondition(event, {
        type: "condition",
        at: event.at,
        name: `${event.name} — Jagged Mind`,
        skillName: event.skillName,
        parentSkillName: event.parentSkillName,
        condition: "Bleeding",
        duration: 4,
        stacks: chance,
        source: event.source,
        sourceId: TRAIT.JAGGED_MIND,
        actorType: event.actorType,
      });
      addTraitProc("Jagged Mind", event.at, event.skillName);
    }
  };

  return Object.freeze({
    process(candidate) {
      if (candidate.type === "bleeding") {
        trackBloodsong(candidate.at, candidate.stacks);
      } else if (candidate.type === "hit" && candidate.event) {
        materializeCriticalTraits(candidate.event);
      }
    },
  });
}
