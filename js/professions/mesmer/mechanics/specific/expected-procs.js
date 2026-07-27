/**
 * Tracks deterministic expected procs for Bloodsong, Jagged Mind, and Sharper Images.
 * Candidates fire after a delay or are batched before resource gains.
 * @param {Object} config - Simulation config
 * @param {Set} traits - Selected traits
 * @param {Object} state - Scheduler state with expected-proc progress
 * @param {number} epsilon - Floating-point epsilon
 * @param {Function} baseCriticalChance - Critical hit chance calculator
 * @param {Function} activePrimaryWeapon - Current primary weapon getter
 * @param {Function} queueResources - Resource queuing function
 * @returns {Object} Tracker with queue(candidate), nextAt(), processNext()
 */
import { MESMER_TRAIT_IDS as TRAIT } from "../../data/ids.js";

export function createExpectedProcTracker({
  state,
  config,
  traits,
  epsilon,
  baseCriticalChance,
  activePrimaryWeapon,
  queueResources,
}) {
  /**
   * Advances Bloodsong progress by bleeding stacks + (Jagged Mind: blade hits × crit chance).
   * Queues blade gain when progress ≥ 5.
   * @param {number} at - Time of tracking
   * @param {number} bleedingStacks - Bleeding stacks to add
   * @param {number} bladeHits - Blade attack hits (for Jagged Mind calc)
   * @param {string} source - Action source (Player/Clone/Phantasm)
   * @param {number} weaponSet - Weapon set for crit calc
   */
  const trackBloodsong = (
    at,
    bleedingStacks,
    bladeHits = 0,
    source = "Player",
    weaponSet = state.activeWeaponSet,
  ) => {
    if (
      config.specialization !== "Virtuoso"
      || !traits.has(TRAIT.BLOODSONG)
    ) return;

    state.profession.bloodsongProgress +=
      Number(bleedingStacks || 0)
      + (
        traits.has(TRAIT.JAGGED_MIND)
          ? Number(bladeHits || 0)
            * baseCriticalChance(
              config,
              traits,
              source,
              weaponSet,
            )
          : 0
      );

    while (state.profession.bloodsongProgress >= 5 - epsilon) {
      state.profession.bloodsongProgress -= 5;
      queueResources(
        at + epsilon,
        1,
        activePrimaryWeapon(),
        "Bloodsong",
      );
    }
  };

  /**
   * Processes one expected-proc candidate after verifying its source is active.
   * Triggers: Bloodsong (bleeding), Jagged Mind (blade hits), Sharper Images (clone/phantasm hits).
   * @param {Object} candidate - Bleeding or hit candidate
   */
  const process = (candidate) => {
    if (candidate.type === "bleeding") {
      trackBloodsong(candidate.at, candidate.stacks, 0);
      return;
    }
    if (candidate.type !== "hit") return;

    const criticalChance = baseCriticalChance(
      config,
      traits,
      candidate.source,
      candidate.weaponSet,
    );
    if (candidate.blade && traits.has(TRAIT.JAGGED_MIND)) {
      trackBloodsong(
        candidate.at,
        0,
        candidate.hits,
        candidate.source,
        candidate.weaponSet,
      );
    }
    if (
      traits.has(TRAIT.SHARPER_IMAGES)
      && (candidate.source === "Clone" || candidate.source === "Phantasm")
    ) {
      state.profession.sharperImagesProgress += candidate.hits * criticalChance;
      const bleeding = Math.floor(state.profession.sharperImagesProgress + epsilon);
      if (bleeding > 0) {
        state.profession.sharperImagesProgress -= bleeding;
        trackBloodsong(candidate.at, bleeding, 0);
      }
    }
  };

  return {
    process,
    /**
     * Queues a candidate to be processed later.
     * @param {Object} candidate - Candidate with an `at` timestamp
     */
    queue(candidate) {
      state.profession.pendingExpectedProcs.push(candidate);
      state.profession.pendingExpectedProcs.sort((a, b) => a.at - b.at);
    },

    /**
     * Returns the next candidate time or Infinity.
     */
    nextAt() {
      return state.profession.pendingExpectedProcs[0]?.at ?? Infinity;
    },

    /**
     * Removes and processes the next candidate.
     */
    processNext() {
      const candidate = state.profession.pendingExpectedProcs.shift();
      if (candidate) process(candidate);
    },
  };
}
