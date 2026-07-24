/**
 * Creates intent controller: processes deferred combat intents for Bloodsong, Jagged Mind, Sharper Images.
 * Intents fire after a delay or are batched (e.g., bleeding stacks triggering Bloodsong progress).
 * @param {Object} config - Simulation config
 * @param {Set} traits - Selected traits
 * @param {Object} state - Scheduler state (tracks progress, pending intents)
 * @param {Map} cloneDeaths - Clone death times (ignores intents from dead clones)
 * @param {number} epsilon - Floating-point epsilon
 * @param {Function} baseCriticalChance - Critical hit chance calculator
 * @param {Function} activePrimaryWeapon - Current primary weapon getter
 * @param {Function} queueResources - Resource queuing function
 * @returns {Object} Intent controller with queue(intent), nextAt(), processNext()
 */
export function createSchedulerIntentController({
  state,
  config,
  traits,
  cloneDeaths,
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
      || !traits.has("Bloodsong")
    ) return;

    state.bloodsongProgress +=
      Number(bleedingStacks || 0)
      + (
        traits.has("Jagged Mind")
          ? Number(bladeHits || 0)
            * baseCriticalChance(
              config,
              traits,
              source,
              weaponSet,
            )
          : 0
      );

    while (state.bloodsongProgress >= 5 - epsilon) {
      state.bloodsongProgress -= 5;
      queueResources(
        at + epsilon,
        1,
        activePrimaryWeapon(),
        "Bloodsong",
      );
    }
  };

  /**
   * Processes a single intent: verifies clone alive, handles bleeding/hit intent types.
   * Triggers: Bloodsong (bleeding), Jagged Mind (blade hits), Sharper Images (clone/phantasm hits).
   * @param {Object} intent - Intent with type (bleeding/hit), source, cloneId, at, stacks/hits/blade props
   */
  const process = (intent) => {
    if (
      intent.cloneId
      && (cloneDeaths.get(intent.cloneId) ?? Infinity)
        <= intent.at + epsilon
    ) return;

    if (intent.type === "bleeding") {
      trackBloodsong(intent.at, intent.stacks, 0);
      return;
    }
    if (intent.type !== "hit") return;

    const criticalChance = baseCriticalChance(
      config,
      traits,
      intent.source,
      intent.weaponSet,
    );
    if (intent.blade && traits.has("Jagged Mind")) {
      trackBloodsong(
        intent.at,
        0,
        intent.hits,
        intent.source,
        intent.weaponSet,
      );
    }
    if (
      traits.has("Sharper Images")
      && (intent.source === "Clone" || intent.source === "Phantasm")
    ) {
      state.sharperImagesProgress += intent.hits * criticalChance;
      const bleeding = Math.floor(state.sharperImagesProgress + epsilon);
      if (bleeding > 0) {
        state.sharperImagesProgress -= bleeding;
        trackBloodsong(intent.at, bleeding, 0);
      }
    }
  };

  return {
    /**
     * Queues an intent to be processed later (sorted by time).
     * @param {Object} intent - Intent with at (time) and other properties
     */
    queue(intent) {
      state.pendingCombatIntents.push(intent);
      state.pendingCombatIntents.sort((a, b) => a.at - b.at);
    },

    /**
     * Returns next intent time or Infinity if no pending intents.
     * @returns {number} Time of next intent
     */
    nextAt() {
      return state.pendingCombatIntents[0]?.at ?? Infinity;
    },

    /**
     * Removes and processes next pending intent.
     */
    processNext() {
      const intent = state.pendingCombatIntents.shift();
      if (intent) process(intent);
    },
  };
}
